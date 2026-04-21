from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from .models import SyncJob, SyncRun, SyncTable, SyncLog, SyncCursor
from .connectors import get_connector
from .schedule_utils import calculate_next_sync_at
from authentication.models import UserProfile
import traceback
from datetime import datetime


class SyncInterrupted(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


class SyncEngine:
    """Core sync engine that orchestrates data synchronization"""
    DEFAULT_BATCH_SIZE = 1000000
    
    def __init__(self, sync_job: SyncJob, sync_run: SyncRun):
        self.sync_job = sync_job
        self.sync_run = sync_run
        self.source_connector = None
        self.dest_connector = None
    
    def start_sync(self):
        """Start the sync process"""
        try:
            self._log('info', f'Starting sync job: {self.sync_job.name}')
            
            # Update run status
            self.sync_run.status = 'running'
            self.sync_run.started_at = timezone.now()
            self.sync_run.save()
            
            # Initialize connectors
            self.source_connector = get_connector(self.sync_job.source_connector)
            self.dest_connector = get_connector(self.sync_job.destination_connector)
            
            # Test connections
            self._test_connections()
            
            # Get enabled tables
            tables = self.sync_job.tables.filter(is_enabled=True)
            
            if not tables.exists():
                raise Exception("No tables enabled for sync")
            
            self._log('info', f'Found {tables.count()} tables to sync')
            
            # Sync each table
            total_inserted = 0
            total_updated = 0
            total_deleted = 0
            total_failed = 0
            
            for sync_table in tables:
                try:
                    result = self._sync_table(sync_table)
                    total_inserted += result['inserted']
                    total_updated += result['updated']
                    total_deleted += result.get('deleted', 0)
                    total_failed += result['failed']
                except SyncInterrupted:
                    raise
                except Exception as e:
                    if self._is_permission_skip_error(e):
                        self._log('warning', f'Skipping table {sync_table.source_table}: {str(e)}', sync_table)
                    else:
                        self._log('error', f'Failed to sync table {sync_table.source_table}: {str(e)}', sync_table)
                    total_failed += 1
            
            # Update run statistics
            self.sync_run.tables_synced = tables.count()
            self.sync_run.rows_inserted = total_inserted
            self.sync_run.rows_updated = total_updated
            self.sync_run.rows_deleted = total_deleted
            self.sync_run.rows_failed = total_failed
            
            # Determine final status
            if total_failed == 0:
                self.sync_run.status = 'success'
            elif total_failed < tables.count():
                self.sync_run.status = 'partial_success'
            else:
                self.sync_run.status = 'failed'
            
            self._log('info', f'Sync completed: {total_inserted} inserted, {total_updated} updated, {total_deleted} deleted, {total_failed} failed')
        except SyncInterrupted as e:
            self.sync_run.status = 'cancelled'
            self.sync_run.error_message = str(e)
            self._log('warning', f'Sync stopped: {str(e)}')
        except Exception as e:
            self.sync_run.status = 'failed'
            self.sync_run.error_message = str(e)
            self.sync_run.error_details = {'traceback': traceback.format_exc()}
            self._log('error', f'Sync failed: {str(e)}')
        
        finally:
            # Update run completion
            self.sync_run.completed_at = timezone.now()
            if self.sync_run.started_at:
                duration = (self.sync_run.completed_at - self.sync_run.started_at).total_seconds()
                self.sync_run.duration_seconds = int(duration)
            self.sync_run.save()
            
            # Update job last sync time
            previous_job_status = (self.sync_run.error_details or {}).get('previous_job_status', 'active')
            self.sync_job.last_sync_at = timezone.now()
            if self.sync_run.status == 'failed':
                self.sync_job.status = 'error'
            elif previous_job_status == 'paused':
                self.sync_job.status = 'paused'
            elif self.sync_job.status in ['error', 'running']:
                self.sync_job.status = 'active'
            self.sync_job.next_sync_at = calculate_next_sync_at(
                self.sync_job.sync_frequency,
                self.sync_job.cron_expression,
                self.sync_job.last_sync_at
            )
            self.sync_job.save()
            self._send_completion_email()
    
    def _test_connections(self):
        """Test source and destination connections"""
        self._log('info', 'Testing source connection')
        source_test = self.source_connector.test_connection()
        if not source_test['success']:
            raise Exception(f"Source connection failed: {source_test['message']}")
        
        self._log('info', 'Testing destination connection')
        dest_test = self.dest_connector.test_connection()
        if not dest_test['success']:
            raise Exception(f"Destination connection failed: {dest_test['message']}")
    
    def _sync_table(self, sync_table: SyncTable) -> dict:
        """Sync a single table"""
        self._check_control_state()
        self._log('info', f'Syncing table: {sync_table.source_table}', sync_table)
        
        # Determine sync mode
        configured_mode = sync_table.sync_mode or self.sync_job.sync_mode
        primary_key = self._resolve_primary_key(sync_table)
        resolved_mode, cursor_field = self._resolve_sync_strategy(sync_table, configured_mode, primary_key)
        execution_mode = resolved_mode
        self._set_connector_context(sync_table, execution_mode)
        
        # Get cursor for incremental sync
        cursor_value = None
        cursor = None
        
        if resolved_mode.startswith('incremental') and cursor_field:
            cursor, created = SyncCursor.objects.get_or_create(sync_table=sync_table)
            cursor_value = cursor.last_value
            if cursor_value is None:
                execution_mode = 'full'
                self._log('info', f'No saved cursor for {resolved_mode}. Running initial full load ordered by {cursor_field}.', sync_table)
            else:
                self._log('info', f'{resolved_mode} sync from {cursor_field}: {cursor_value}', sync_table)
        
        # Fetch data from source
        self._log('info', f'Fetching data from source', sync_table)

        batch_size = self._get_batch_size()
        all_data = []
        has_more = True
        page = 0
        total_fetched = 0
        total_inserted = 0
        total_updated = 0
        total_deleted = 0
        total_failed = 0
        destination_initialized = False
        effective_write_mode = self._get_write_mode(execution_mode)
        
        while has_more:
            self._check_control_state()
            page += 1
            self._log('info', f'Fetching page {page}', sync_table)
            
            result = self.source_connector.fetch_data(
                table_name=sync_table.source_table,
                cursor_value=cursor_value,
                cursor_field=cursor_field,
                limit=batch_size
            )
            
            data = result['data']
            has_more = result.get('has_more', False)
            cursor_value = result.get('next_cursor')

            if not data:
                break

            total_fetched += len(data)
            self._log('info', f'Fetched {len(data)} records (total: {total_fetched})', sync_table)

            if not destination_initialized:
                self._check_control_state()
                destination_created, effective_write_mode = self._ensure_destination_table(
                    sync_table,
                    data[0],
                    primary_key,
                    execution_mode
                )
                destination_initialized = True
                if destination_created and effective_write_mode == 'replace':
                    effective_write_mode = 'insert'
                    self._log('info', 'Using bulk insert for initial full load into a newly created destination table', sync_table)
                elif effective_write_mode == 'insert':
                    self._log('info', 'Using truncate-and-reload path for full refresh into an existing destination table', sync_table)

            if self._can_stream_write(effective_write_mode):
                self._check_control_state()
                write_result = self.dest_connector.write_data(
                    table_name=sync_table.destination_table,
                    data=data,
                    primary_key=primary_key,
                    mode=effective_write_mode
                )
                total_inserted += write_result.get('inserted', 0)
                total_updated += write_result.get('updated', 0)
                total_deleted += write_result.get('deleted', 0)
                total_failed += write_result.get('failed', 0)
                self._log('info', f'Wrote batch of {len(data)} records to destination', sync_table)
            else:
                all_data.extend(data)

        if total_fetched == 0 and not all_data:
            self._log('info', f'No data to sync', sync_table)
            return {'inserted': 0, 'updated': 0, 'deleted': 0, 'failed': 0}

        if all_data:
            if not destination_initialized:
                self._check_control_state()
                _, effective_write_mode = self._ensure_destination_table(sync_table, all_data[0], primary_key, execution_mode)

            self._check_control_state()
            self._log('info', f'Writing {len(all_data)} records to destination', sync_table)

            write_result = self.dest_connector.write_data(
                table_name=sync_table.destination_table,
                data=all_data,
                primary_key=primary_key,
                mode=effective_write_mode
            )
            total_inserted += write_result.get('inserted', 0)
            total_updated += write_result.get('updated', 0)
            total_deleted += write_result.get('deleted', 0)
            total_failed += write_result.get('failed', 0)
        
        # Update cursor
        if resolved_mode.startswith('incremental') and cursor_field and cursor_value:
            cursor = cursor or SyncCursor.objects.get_or_create(sync_table=sync_table)[0]
            cursor.last_value = cursor_value
            cursor.last_sync_at = timezone.now()
            cursor.save()
        
        # Update table statistics
        sync_table.row_count = total_fetched
        sync_table.last_synced_value = cursor_value
        sync_table.save()
        
        final_result = {
            'inserted': total_inserted,
            'updated': total_updated,
            'deleted': total_deleted,
            'failed': total_failed
        }
        self._log('info', f'Table sync completed: {final_result}', sync_table)
        
        return final_result

    def _get_effective_cursor_field(self, sync_table: SyncTable, sync_mode: str, primary_key: str = None):
        """Resolve the cursor field for the selected sync mode."""
        if sync_mode == 'incremental':
            return sync_table.cursor_field or primary_key
        if sync_mode == 'incremental_id':
            return sync_table.primary_key_field or sync_table.cursor_field or primary_key or 'id'
        if sync_mode in ['incremental_timestamp', 'incremental_cursor']:
            return sync_table.cursor_field
        return None

    def _resolve_sync_strategy(self, sync_table: SyncTable, sync_mode: str, primary_key: str):
        """Map auto incremental mode to the best available cursor strategy."""
        if sync_mode != 'incremental':
            return sync_mode, self._get_effective_cursor_field(sync_table, sync_mode, primary_key)

        cursor_field = sync_table.cursor_field
        if cursor_field and cursor_field != primary_key:
            return 'incremental_cursor', cursor_field

        if primary_key:
            return 'incremental_id', primary_key

        return 'full', None

    def _get_write_mode(self, sync_mode: str) -> str:
        if sync_mode == 'history':
            return 'history'
        if sync_mode.startswith('incremental'):
            return 'upsert'
        return 'replace'
    
    def _resolve_primary_key(self, sync_table: SyncTable) -> str:
        """Resolve the best primary key for source and destination operations."""
        if sync_table.primary_key_field:
            return sync_table.primary_key_field

        try:
            source_schema = self.source_connector.discover_schema()
        except Exception:
            source_schema = []

        if isinstance(source_schema, dict):
            source_schema = source_schema.get('tables', [])
        elif not isinstance(source_schema, list):
            source_schema = []

        table_metadata = next(
            (table for table in source_schema if table.get('name') == sync_table.source_table),
            None
        )

        inferred_primary_key = None
        if table_metadata:
            inferred_primary_key = (
                table_metadata.get('primary_key')
                or table_metadata.get('cursor_field')
            )

        if not inferred_primary_key:
            inferred_primary_key = sync_table.cursor_field or 'id'

        if sync_table.primary_key_field != inferred_primary_key:
            sync_table.primary_key_field = inferred_primary_key
            sync_table.save(update_fields=['primary_key_field', 'updated_at'])

        return inferred_primary_key

    def _ensure_destination_table(self, sync_table: SyncTable, sample_record: dict, primary_key: str, sync_mode: str):
        """Ensure destination table exists, create if needed"""
        write_mode = self._get_write_mode(sync_mode)
        try:
            # Try to get existing schema
            self.dest_connector.get_table_schema(sync_table.destination_table)
            if write_mode == 'replace' and hasattr(self.dest_connector, 'prepare_full_reload'):
                self.dest_connector.prepare_full_reload(sync_table.destination_table)
                return False, 'insert'
            if hasattr(self.dest_connector, 'ensure_conflict_target'):
                self.dest_connector.ensure_conflict_target(
                    table_name=sync_table.destination_table,
                    primary_key=primary_key,
                    sample_record=sample_record,
                    mode=write_mode
                )
            return False, write_mode
        except Exception:
            if hasattr(self.dest_connector, 'reset_transaction'):
                self.dest_connector.reset_transaction()
            # Table doesn't exist, create it
            self._log('info', f'Creating destination table: {sync_table.destination_table}', sync_table)
            
            # Infer schema from sample record
            schema = []
            for key, value in sample_record.items():
                col_type = self._infer_column_type(value)
                schema.append({
                    'name': key,
                    'type': col_type,
                    'nullable': True,
                    'primary_key': sync_mode != 'history' and key == primary_key
                })
            
            self.dest_connector.create_table(
                sync_table.destination_table,
                schema,
                mode=write_mode
            )
            if hasattr(self.dest_connector, 'ensure_conflict_target'):
                self.dest_connector.ensure_conflict_target(
                    table_name=sync_table.destination_table,
                    primary_key=primary_key,
                    sample_record=sample_record,
                    mode=write_mode
                )
            return True, write_mode
    
    def _infer_column_type(self, value) -> str:
        """Infer SQL column type from Python value"""
        if value is None:
            return 'TEXT'
        elif isinstance(value, bool):
            return 'BOOLEAN'
        elif isinstance(value, int):
            return 'BIGINT'
        elif isinstance(value, float):
            return 'NUMERIC'
        elif isinstance(value, datetime):
            return 'TIMESTAMP'
        else:
            return 'TEXT'
    
    def _log(self, level: str, message: str, sync_table: SyncTable = None):
        """Log sync activity"""
        print(f"[{level.upper()}] {message}")
        
        SyncLog.objects.create(
            sync_run=self.sync_run,
            sync_table=sync_table,
            level=level,
            message=message
        )

    def _check_control_state(self):
        self.sync_job.refresh_from_db(fields=['status'])
        self.sync_run.refresh_from_db(fields=['status'])

        if self.sync_run.status == 'cancelled':
            raise SyncInterrupted('Sync run was cancelled.')

        if self.sync_job.status == 'paused' and self.sync_run.trigger_type != 'manual':
            raise SyncInterrupted('Sync job was paused.')

    def _get_batch_size(self) -> int:
        configured_value = (
            self.sync_job.source_connector.config.get('batch_size')
            or self.sync_job.destination_connector.config.get('batch_size')
            or self.DEFAULT_BATCH_SIZE
        )
        try:
            return max(1000, int(configured_value))
        except (TypeError, ValueError):
            return self.DEFAULT_BATCH_SIZE

    def _can_stream_write(self, write_mode: str) -> bool:
        return write_mode in ['insert', 'upsert']

    def _is_permission_skip_error(self, error: Exception) -> bool:
        message = str(error).lower()
        return 'missing scopes' in message or 'permission_denied' in message

    def _set_connector_context(self, sync_table: SyncTable, sync_mode: str):
        context = {
            'sync_job_id': str(self.sync_job.id),
            'sync_job_name': self.sync_job.name,
            'sync_run_id': str(self.sync_run.id),
            'sync_table_id': str(sync_table.id),
            'source_table': sync_table.source_table,
            'source_schema': sync_table.source_schema or self.sync_job.source_connector.config.get('schema'),
            'destination_table': sync_table.destination_table,
            'destination_schema': self.sync_job.destination_schema,
            'sync_mode': sync_mode,
        }
        if hasattr(self.source_connector, 'set_runtime_context'):
            self.source_connector.set_runtime_context(**context)
        if hasattr(self.dest_connector, 'set_runtime_context'):
            self.dest_connector.set_runtime_context(**context)

    def _send_completion_email(self):
        try:
            user = UserProfile.objects.filter(id=self.sync_job.user_id).only('email', 'username').first()
            recipient_email = self.sync_job.notification_email or (user.email if user else None)
            if not recipient_email:
                return

            subject = f"DataSync job {self.sync_job.name} completed with status {self.sync_run.status}"
            message = (
                f"Hi {(user.username if user else recipient_email) or recipient_email},\n\n"
                f"Your DataSync job has finished.\n\n"
                f"Job Name: {self.sync_job.name}\n"
                f"Run Status: {self.sync_run.status}\n"
                f"Trigger Type: {self.sync_run.trigger_type}\n"
                f"Tables Synced: {self.sync_run.tables_synced}\n"
                f"Rows Inserted: {self.sync_run.rows_inserted}\n"
                f"Rows Updated: {self.sync_run.rows_updated}\n"
                f"Rows Deleted: {self.sync_run.rows_deleted}\n"
                f"Rows Failed: {self.sync_run.rows_failed}\n"
                f"Started At: {self.sync_run.started_at}\n"
                f"Completed At: {self.sync_run.completed_at}\n"
            )

            if self.sync_run.error_message:
                message += f"\nError: {self.sync_run.error_message}\n"

            send_mail(
                subject=subject,
                message=message,
                from_email=settings.EMAIL_HOST_USER,
                recipient_list=[recipient_email],
                fail_silently=True,
            )
        except Exception:
            self._log('warning', 'Failed to send sync completion email')
