from rest_framework import serializers
from .models import SyncConnector, SyncJob, SyncTable, SyncRun, SyncLog, SyncCursor
from .schedule_utils import calculate_next_sync_at


class SyncConnectorSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncConnector
        fields = [
            'id', 'name', 'connector_type', 'connector_role', 'config',
            'is_active', 'last_tested', 'test_status', 'test_message',
            'user_id', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_tested', 'test_status', 'test_message']
        extra_kwargs = {
            'config': {'write_only': True}  # Don't expose credentials in responses
        }


class SyncTableSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncTable
        fields = [
            'id', 'source_table', 'source_schema', 'destination_table',
            'is_enabled', 'sync_mode', 'cursor_field', 'primary_key_field',
            'column_mapping', 'source_filter', 'row_count', 'last_synced_value',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'row_count', 'last_synced_value']


class SyncJobSerializer(serializers.ModelSerializer):
    source_connector_name = serializers.CharField(source='source_connector.name', read_only=True)
    destination_connector_name = serializers.CharField(source='destination_connector.name', read_only=True)
    tables = SyncTableSerializer(many=True, read_only=True)
    table_count = serializers.SerializerMethodField()
    current_run_id = serializers.UUIDField(read_only=True)
    current_run_status = serializers.CharField(read_only=True)
    display_status = serializers.SerializerMethodField()
    
    class Meta:
        model = SyncJob
        fields = [
            'id', 'name', 'description', 'source_connector', 'destination_connector',
            'source_connector_name', 'destination_connector_name',
            'destination_schema', 'table_prefix', 'sync_mode', 'sync_frequency',
            'cron_expression', 'status', 'last_sync_at', 'next_sync_at',
            'dag_id', 'tables', 'table_count', 'current_run_id', 'current_run_status',
            'display_status', 'user_id', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_sync_at', 'next_sync_at', 'dag_id']
    
    def get_table_count(self, obj):
        return obj.tables.filter(is_enabled=True).count()

    def get_display_status(self, obj):
        return obj.current_run_status or obj.status


class SyncJobCreateSerializer(serializers.ModelSerializer):
    tables = SyncTableSerializer(many=True, required=False)
    
    class Meta:
        model = SyncJob
        fields = [
            'name', 'description', 'source_connector', 'destination_connector',
            'destination_schema', 'table_prefix', 'sync_mode', 'sync_frequency',
            'cron_expression', 'tables'
        ]
    
    def create(self, validated_data):
        tables_data = validated_data.pop('tables', [])
        validated_data.setdefault('status', 'active')
        validated_data['next_sync_at'] = calculate_next_sync_at(
            validated_data.get('sync_frequency'),
            validated_data.get('cron_expression')
        )
        sync_job = SyncJob.objects.create(**validated_data)
        
        for table_data in tables_data:
            SyncTable.objects.create(sync_job=sync_job, **table_data)
        
        return sync_job

    def validate(self, attrs):
        source_connector = attrs.get('source_connector')
        destination_connector = attrs.get('destination_connector')
        sync_frequency = attrs.get('sync_frequency')
        cron_expression = attrs.get('cron_expression')

        if source_connector and source_connector.connector_role != 'source':
            raise serializers.ValidationError({
                'source_connector': 'Selected connector is not configured as a source.'
            })

        if destination_connector and destination_connector.connector_role != 'destination':
            raise serializers.ValidationError({
                'destination_connector': 'Selected connector is not configured as a destination.'
            })

        if source_connector and destination_connector and source_connector.id == destination_connector.id:
            raise serializers.ValidationError('Source and destination connectors must be different.')

        if sync_frequency == 'custom' and not cron_expression:
            raise serializers.ValidationError({
                'cron_expression': 'Cron expression is required for custom sync frequency.'
            })

        if sync_frequency == 'custom' and cron_expression and calculate_next_sync_at(sync_frequency, cron_expression) is None:
            raise serializers.ValidationError({
                'cron_expression': 'Custom cron scheduling is unavailable because cron parsing is not configured on the backend.'
            })

        return attrs


class SyncLogSerializer(serializers.ModelSerializer):
    table_name = serializers.CharField(source='sync_table.source_table', read_only=True)
    
    class Meta:
        model = SyncLog
        fields = ['id', 'level', 'message', 'details', 'table_name', 'timestamp']
        read_only_fields = ['id', 'timestamp']


class SyncRunSerializer(serializers.ModelSerializer):
    job_name = serializers.CharField(source='sync_job.name', read_only=True)
    logs = SyncLogSerializer(many=True, read_only=True)
    
    class Meta:
        model = SyncRun
        fields = [
            'id', 'sync_job', 'job_name', 'status', 'trigger_type',
            'dag_run_id', 'started_at', 'completed_at', 'duration_seconds',
            'tables_synced', 'rows_inserted', 'rows_updated', 'rows_deleted',
            'rows_failed', 'error_message', 'error_details', 'logs', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class SyncRunListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing runs"""
    job_name = serializers.CharField(source='sync_job.name', read_only=True)
    
    class Meta:
        model = SyncRun
        fields = [
            'id', 'sync_job', 'job_name', 'status', 'trigger_type',
            'started_at', 'completed_at', 'duration_seconds',
            'tables_synced', 'rows_inserted', 'rows_updated', 'rows_deleted',
            'rows_failed', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
