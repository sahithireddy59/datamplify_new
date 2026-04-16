from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.db.models import OuterRef, Subquery
from django.utils import timezone
from oauth2_provider.contrib.rest_framework import OAuth2Authentication
from authentication.permissions import CustomIsAuthenticated
from .models import SyncConnector, SyncJob, SyncTable, SyncRun, SyncLog
from .serializers import (
    SyncConnectorSerializer, SyncJobSerializer, SyncJobCreateSerializer,
    SyncTableSerializer, SyncRunSerializer, SyncRunListSerializer, SyncLogSerializer
)
from .connectors import get_connector
from .easyconnect_bridge import list_available_connections, import_connection_as_sync_connector
from .schedule_utils import calculate_next_sync_at
from .scheduler_runner import run_due_sync_jobs, start_sync_job
import traceback


class SyncConnectorViewSet(viewsets.ModelViewSet):
    """ViewSet for managing sync connectors"""
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]
    serializer_class = SyncConnectorSerializer
    
    def get_queryset(self):
        user_id = self.request.user.id
        return SyncConnector.objects.filter(user_id=user_id)
    
    def perform_create(self, serializer):
        serializer.save(user_id=self.request.user.id)

    @action(detail=False, methods=['get'])
    def available(self, request):
        """List supported EasyConnect connections that can be used in Sync."""
        connector_role = request.query_params.get('role', 'source')
        if connector_role not in ['source', 'destination']:
            return Response({
                'error': 'role must be source or destination'
            }, status=status.HTTP_400_BAD_REQUEST)

        data = list_available_connections(request.user, connector_role)
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def import_connection(self, request):
        """Create or refresh a DataSync connector from an EasyConnect connection."""
        hierarchy_id = request.data.get('hierarchy_id')
        connector_role = request.data.get('connector_role')

        if not hierarchy_id or connector_role not in ['source', 'destination']:
            return Response({
                'error': 'hierarchy_id and valid connector_role are required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            connector = import_connection_as_sync_connector(request.user, hierarchy_id, connector_role)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({
                'error': str(exc),
                'traceback': traceback.format_exc(),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        serializer = self.get_serializer(connector)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        """Test connector connection"""
        connector = self.get_object()
        
        try:
            connector_instance = get_connector(connector)
            result = connector_instance.test_connection()
            
            # Update connector test status
            connector.last_tested = timezone.now()
            connector.test_status = 'success' if result['success'] else 'failed'
            connector.test_message = result.get('message', '')
            connector.save()
            
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            connector.last_tested = timezone.now()
            connector.test_status = 'error'
            connector.test_message = str(e)
            connector.save()
            
            return Response({
                'success': False,
                'message': f'Connection test failed: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='test')
    def test_connection_legacy(self, request, pk=None):
        return self.test_connection(request, pk)
    
    @action(detail=True, methods=['post'])
    def discover_schema(self, request, pk=None):
        """Discover tables/objects from source connector"""
        connector = self.get_object()
        
        if connector.connector_role != 'source':
            return Response({
                'error': 'Schema discovery only available for source connectors'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            connector_instance = get_connector(connector)
            discovery_result = connector_instance.discover_schema()
            if isinstance(discovery_result, dict):
                tables = discovery_result.get('tables', [])
                skipped_endpoints = discovery_result.get('skipped_endpoints', [])
            else:
                tables = discovery_result
                skipped_endpoints = []
            
            return Response({
                'success': True,
                'tables': tables,
                'count': len(tables),
                'skipped_endpoints': skipped_endpoints,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
                'traceback': traceback.format_exc()
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='discover')
    def discover_schema_legacy(self, request, pk=None):
        return self.discover_schema(request, pk)
    
    @action(detail=True, methods=['post'])
    def refresh_token(self, request, pk=None):
        """Refresh OAuth token for API connectors"""
        connector = self.get_object()
        
        try:
            connector_instance = get_connector(connector)
            if hasattr(connector_instance, 'refresh_access_token'):
                result = connector_instance.refresh_access_token()
                
                if result['success']:
                    connector.access_token = result['access_token']
                    connector.token_expires_at = result['expires_at']
                    if 'refresh_token' in result:
                        connector.refresh_token = result['refresh_token']
                    connector.save()
                    
                    return Response({
                        'success': True,
                        'message': 'Token refreshed successfully'
                    }, status=status.HTTP_200_OK)
                else:
                    return Response(result, status=status.HTTP_400_BAD_REQUEST)
            else:
                return Response({
                    'error': 'Token refresh not supported for this connector type'
                }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SyncJobViewSet(viewsets.ModelViewSet):
    """ViewSet for managing sync jobs"""
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return SyncJobCreateSerializer
        return SyncJobSerializer
    
    def get_queryset(self):
        user_id = self.request.user.id
        active_runs = SyncRun.objects.filter(
            sync_job=OuterRef('pk'),
            status__in=['pending', 'running']
        ).order_by('-created_at')
        return SyncJob.objects.filter(user_id=user_id).select_related(
            'source_connector', 'destination_connector'
        ).prefetch_related('tables').annotate(
            current_run_id=Subquery(active_runs.values('id')[:1]),
            current_run_status=Subquery(active_runs.values('status')[:1]),
        )
    
    def perform_create(self, serializer):
        serializer.save(user_id=self.request.user.id)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            self.perform_create(serializer)
        except Exception as exc:
            return Response({
                'success': False,
                'error': str(exc),
                'traceback': traceback.format_exc(),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_update(self, serializer):
        sync_job = serializer.save()
        sync_job.next_sync_at = calculate_next_sync_at(
            sync_job.sync_frequency,
            sync_job.cron_expression
        )
        sync_job.save(update_fields=['next_sync_at', 'updated_at'])
    
    @action(detail=True, methods=['post'])
    def trigger(self, request, pk=None):
        """Manually trigger a sync job"""
        sync_job = self.get_object()

        try:
            sync_run = start_sync_job(sync_job, trigger_type='manual')
            if sync_run is None:
                return Response({
                    'success': False,
                    'error': 'A sync run is already pending or running for this job.'
                }, status=status.HTTP_409_CONFLICT)
            
            return Response({
                'success': True,
                'run_id': str(sync_run.id),
                'message': 'Sync triggered successfully'
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
                'traceback': traceback.format_exc()
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        """Pause a sync job"""
        sync_job = self.get_object()
        sync_job.status = 'paused'
        sync_job.save()
        
        return Response({
            'success': True,
            'message': 'Sync job paused'
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a paused sync job"""
        sync_job = self.get_object()
        sync_job.status = 'active'
        sync_job.next_sync_at = calculate_next_sync_at(
            sync_job.sync_frequency,
            sync_job.cron_expression
        )
        sync_job.save()
        
        return Response({
            'success': True,
            'message': 'Sync job activated'
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def run_due(self, request):
        """Run scheduled sync jobs whose next run time has arrived."""
        triggered = [job_id for job_id in run_due_sync_jobs() if self.get_queryset().filter(id=job_id).exists()]

        return Response({
            'success': True,
            'triggered_jobs': triggered,
            'count': len(triggered)
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['get'])
    def runs(self, request, pk=None):
        """Get sync runs for this job"""
        sync_job = self.get_object()
        runs = SyncRun.objects.filter(sync_job=sync_job).order_by('-created_at')[:50]
        serializer = SyncRunListSerializer(runs, many=True)
        
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def add_tables(self, request, pk=None):
        """Add tables to sync job"""
        sync_job = self.get_object()
        tables_data = request.data.get('tables', [])
        
        created_tables = []
        for table_data in tables_data:
            table_data['sync_job'] = sync_job.id
            serializer = SyncTableSerializer(data=table_data)
            if serializer.is_valid():
                table = serializer.save(sync_job=sync_job)
                created_tables.append(serializer.data)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            'success': True,
            'tables': created_tables,
            'count': len(created_tables)
        }, status=status.HTTP_201_CREATED)


class SyncTableViewSet(viewsets.ModelViewSet):
    """ViewSet for managing sync tables"""
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]
    serializer_class = SyncTableSerializer
    
    def get_queryset(self):
        user_id = self.request.user.id
        return SyncTable.objects.filter(sync_job__user_id=user_id)
    
    @action(detail=True, methods=['post'])
    def toggle_enabled(self, request, pk=None):
        """Enable/disable a sync table"""
        sync_table = self.get_object()
        sync_table.is_enabled = not sync_table.is_enabled
        sync_table.save()
        
        return Response({
            'success': True,
            'is_enabled': sync_table.is_enabled
        }, status=status.HTTP_200_OK)


class SyncRunViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing sync runs"""
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return SyncRunListSerializer
        return SyncRunSerializer
    
    def get_queryset(self):
        user_id = self.request.user.id
        queryset = SyncRun.objects.filter(sync_job__user_id=user_id).select_related('sync_job')
        
        # Filter by job
        job_id = self.request.query_params.get('job_id') or self.request.query_params.get('sync_job')
        if job_id:
            queryset = queryset.filter(sync_job_id=job_id)
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset.order_by('-created_at')
    
    @action(detail=True, methods=['get'])
    def logs(self, request, pk=None):
        """Get logs for a sync run"""
        sync_run = self.get_object()
        logs = SyncLog.objects.filter(sync_run=sync_run).order_by('-timestamp')[:1000]
        serializer = SyncLogSerializer(logs, many=True)
        
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a running sync"""
        sync_run = self.get_object()
        
        if sync_run.status not in ['pending', 'running']:
            return Response({
                'error': 'Can only cancel pending or running syncs'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        sync_run.status = 'cancelled'
        sync_run.completed_at = timezone.now()
        if sync_run.started_at:
            duration = (sync_run.completed_at - sync_run.started_at).total_seconds()
            sync_run.duration_seconds = int(duration)
        sync_run.save()

        previous_job_status = (sync_run.error_details or {}).get('previous_job_status', 'active')
        sync_job = sync_run.sync_job
        sync_job.status = 'paused' if previous_job_status == 'paused' else 'active'
        sync_job.save(update_fields=['status', 'updated_at'])
        
        return Response({
            'success': True,
            'message': 'Sync cancelled'
        }, status=status.HTTP_200_OK)


class SyncStatsView(APIView):
    """Get sync statistics for dashboard"""
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]
    
    def get(self, request):
        user_id = request.user.id
        
        # Get job counts
        total_jobs = SyncJob.objects.filter(user_id=user_id).count()
        active_jobs = SyncJob.objects.filter(user_id=user_id, status='active').count()
        paused_jobs = SyncJob.objects.filter(user_id=user_id, status='paused').count()
        error_jobs = SyncJob.objects.filter(user_id=user_id, status='error').count()
        
        # Get recent runs
        recent_runs = SyncRun.objects.filter(
            sync_job__user_id=user_id
        ).order_by('-created_at')[:10]
        
        success_count = recent_runs.filter(status='success').count()
        failed_count = recent_runs.filter(status='failed').count()
        running_count = recent_runs.filter(status='running').count()
        
        # Get total rows synced today
        from datetime import datetime, timedelta
        today = datetime.now().date()
        today_runs = SyncRun.objects.filter(
            sync_job__user_id=user_id,
            created_at__date=today
        )
        
        total_rows_today = sum([
            run.rows_inserted + run.rows_updated 
            for run in today_runs
        ])
        
        return Response({
            'jobs': {
                'total': total_jobs,
                'active': active_jobs,
                'paused': paused_jobs,
                'error': error_jobs
            },
            'recent_runs': {
                'success': success_count,
                'failed': failed_count,
                'running': running_count
            },
            'today': {
                'total_rows': total_rows_today,
                'total_runs': today_runs.count()
            }
        }, status=status.HTTP_200_OK)
