from django.db import models
from django.contrib.postgres.fields import JSONField
import uuid


class SyncConnector(models.Model):
    """Source or destination connector configuration"""
    CONNECTOR_TYPES = [
        ('hubspot', 'HubSpot'),
        ('salesforce', 'Salesforce'),
        ('shopify', 'Shopify'),
        ('quickbooks', 'QuickBooks'),
        ('jira', 'Jira'),
        ('pax8', 'Pax8'),
        ('bamboohr', 'BambooHR'),
        ('zoho_crm', 'Zoho CRM'),
        ('zoho_books', 'Zoho Books'),
        ('zoho_inventory', 'Zoho Inventory'),
        ('tally', 'Tally'),
        ('dbt', 'dbt'),
        ('oracle', 'Oracle'),
        ('snowflake', 'Snowflake'),
        ('mssql', 'Microsoft SQL Server'),
        ('postgresql', 'PostgreSQL'),
        ('mysql', 'MySQL'),
        ('api', 'REST API'),
    ]
    
    CONNECTOR_ROLES = [
        ('source', 'Source'),
        ('destination', 'Destination'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    connector_type = models.CharField(max_length=50, choices=CONNECTOR_TYPES)
    connector_role = models.CharField(max_length=20, choices=CONNECTOR_ROLES)
    
    # Connection configuration (encrypted)
    config = models.JSONField(default=dict, help_text="Connection credentials and settings")
    
    # OAuth tokens for API connectors
    access_token = models.TextField(null=True, blank=True)
    refresh_token = models.TextField(null=True, blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    last_tested = models.DateTimeField(null=True, blank=True)
    test_status = models.CharField(max_length=20, null=True, blank=True)
    test_message = models.TextField(null=True, blank=True)
    
    # Metadata
    user_id = models.UUIDField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'datasync_connectors'
        indexes = [
            models.Index(fields=['user_id', 'connector_type']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.connector_type})"


class SyncJob(models.Model):
    """Sync job configuration"""
    SYNC_MODES = [
        ('full', 'Full Refresh (Historical)'),
        ('incremental', 'Incremental Mode (Auto)'),
        ('incremental_timestamp', 'Incremental (Timestamp)'),
        ('incremental_id', 'Incremental (ID)'),
        ('incremental_cursor', 'Incremental (Cursor)'),
        ('history', 'History Mode (SCD2)'),
    ]
    
    SYNC_FREQUENCIES = [
        ('manual', 'Manual'),
        ('15min', 'Every 15 minutes'),
        ('hourly', 'Hourly'),
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('custom', 'Custom Cron'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('running', 'Running'),
        ('paused', 'Paused'),
        ('error', 'Error'),
        ('configuring', 'Configuring'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    
    # Connectors
    source_connector = models.ForeignKey(
        SyncConnector, 
        on_delete=models.CASCADE, 
        related_name='source_jobs'
    )
    destination_connector = models.ForeignKey(
        SyncConnector, 
        on_delete=models.CASCADE, 
        related_name='destination_jobs'
    )
    
    # Destination configuration
    destination_schema = models.CharField(max_length=255, default='public')
    table_prefix = models.CharField(max_length=50, null=True, blank=True)
    
    # Sync configuration
    sync_mode = models.CharField(max_length=50, choices=SYNC_MODES, default='full')
    sync_frequency = models.CharField(max_length=20, choices=SYNC_FREQUENCIES, default='manual')
    cron_expression = models.CharField(max_length=100, null=True, blank=True)
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='configuring')
    last_sync_at = models.DateTimeField(null=True, blank=True)
    next_sync_at = models.DateTimeField(null=True, blank=True)
    
    # Airflow DAG ID
    dag_id = models.CharField(max_length=255, null=True, blank=True)
    
    # Metadata
    user_id = models.UUIDField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'datasync_jobs'
        indexes = [
            models.Index(fields=['user_id', 'status']),
            models.Index(fields=['status', 'next_sync_at']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.source_connector.name} → {self.destination_connector.name})"


class SyncTable(models.Model):
    """Individual table/object configuration within a sync job"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sync_job = models.ForeignKey(SyncJob, on_delete=models.CASCADE, related_name='tables')
    
    # Source table/object
    source_table = models.CharField(max_length=255, help_text="Source table or API object name")
    source_schema = models.CharField(max_length=255, null=True, blank=True)
    
    # Destination table
    destination_table = models.CharField(max_length=255)
    
    # Sync configuration
    is_enabled = models.BooleanField(default=True)
    sync_mode = models.CharField(max_length=50, null=True, blank=True, help_text="Override job sync mode")
    
    # Incremental sync configuration
    cursor_field = models.CharField(max_length=255, null=True, blank=True, help_text="Field for incremental sync")
    primary_key_field = models.CharField(max_length=255, null=True, blank=True)
    
    # Column mapping
    column_mapping = models.JSONField(default=dict, help_text="Source to destination column mapping")
    
    # Filters
    source_filter = models.JSONField(default=dict, null=True, blank=True, help_text="Filter conditions for source data")
    
    # Statistics
    row_count = models.BigIntegerField(null=True, blank=True)
    last_synced_value = models.CharField(max_length=255, null=True, blank=True, help_text="Last cursor value")
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'datasync_tables'
        unique_together = [['sync_job', 'source_table']]
        indexes = [
            models.Index(fields=['sync_job', 'is_enabled']),
        ]
    
    def __str__(self):
        return f"{self.source_table} → {self.destination_table}"


class SyncRun(models.Model):
    """Sync execution history"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('success', 'Success'),
        ('partial_success', 'Partial Success'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sync_job = models.ForeignKey(SyncJob, on_delete=models.CASCADE, related_name='runs')
    
    # Execution details
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    trigger_type = models.CharField(max_length=20, default='manual', help_text="manual, scheduled, api")
    
    # Airflow details
    dag_run_id = models.CharField(max_length=255, null=True, blank=True)
    
    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.IntegerField(null=True, blank=True)
    
    # Statistics
    tables_synced = models.IntegerField(default=0)
    rows_inserted = models.BigIntegerField(default=0)
    rows_updated = models.BigIntegerField(default=0)
    rows_deleted = models.BigIntegerField(default=0)
    rows_failed = models.BigIntegerField(default=0)
    
    # Error details
    error_message = models.TextField(null=True, blank=True)
    error_details = models.JSONField(default=dict, null=True, blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'datasync_runs'
        indexes = [
            models.Index(fields=['sync_job', '-created_at']),
            models.Index(fields=['status', '-created_at']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Run {self.id} - {self.sync_job.name} ({self.status})"


class SyncLog(models.Model):
    """Detailed sync logs"""
    LOG_LEVELS = [
        ('debug', 'Debug'),
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('error', 'Error'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sync_run = models.ForeignKey(SyncRun, on_delete=models.CASCADE, related_name='logs')
    sync_table = models.ForeignKey(SyncTable, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Log details
    level = models.CharField(max_length=10, choices=LOG_LEVELS, default='info')
    message = models.TextField()
    details = models.JSONField(default=dict, null=True, blank=True)
    
    # Timing
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'datasync_logs'
        indexes = [
            models.Index(fields=['sync_run', '-timestamp']),
            models.Index(fields=['level', '-timestamp']),
        ]
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"[{self.level}] {self.message[:50]}"


class SyncCursor(models.Model):
    """Track sync state for incremental syncs"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sync_table = models.OneToOneField(SyncTable, on_delete=models.CASCADE, related_name='cursor')
    
    # Cursor state
    last_value = models.CharField(max_length=255, null=True, blank=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    
    # For API pagination
    next_page_token = models.TextField(null=True, blank=True)
    
    # Metadata
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'datasync_cursors'
    
    def __str__(self):
        return f"Cursor for {self.sync_table.source_table}: {self.last_value}"
