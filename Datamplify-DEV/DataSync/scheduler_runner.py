import threading

from django.db import close_old_connections
from django.utils import timezone

from DataSync.engine import SyncEngine
from DataSync.models import SyncJob, SyncRun


def _run_sync_job(sync_job_id, sync_run_id):
    close_old_connections()
    try:
        sync_job = SyncJob.objects.select_related('source_connector', 'destination_connector').get(id=sync_job_id)
        sync_run = SyncRun.objects.get(id=sync_run_id)
        SyncEngine(sync_job, sync_run).start_sync()
    finally:
        close_old_connections()


def start_sync_job(sync_job, trigger_type='manual'):
    """Create a run and execute it on a background thread."""
    if SyncRun.objects.filter(sync_job=sync_job, status__in=['pending', 'running']).exists():
        return None

    previous_job_status = sync_job.status
    sync_run = SyncRun.objects.create(
        sync_job=sync_job,
        status='pending',
        trigger_type=trigger_type,
        started_at=timezone.now(),
        error_details={'previous_job_status': previous_job_status}
    )

    sync_job.status = 'running'
    sync_job.save(update_fields=['status', 'updated_at'])

    worker = threading.Thread(
        target=_run_sync_job,
        args=(sync_job.id, sync_run.id),
        name=f'datasync-{trigger_type}-{sync_job.id}',
        daemon=True,
    )
    worker.start()
    return sync_run


def run_due_sync_jobs():
    """Start all active sync jobs whose next execution time has arrived."""
    now = timezone.now()
    due_jobs = SyncJob.objects.filter(
        status='active',
        sync_frequency__in=['15min', 'hourly', 'daily', 'weekly', 'custom'],
        next_sync_at__isnull=False,
        next_sync_at__lte=now
    )

    triggered = []
    for sync_job in due_jobs:
        sync_run = start_sync_job(sync_job, trigger_type='scheduled')
        if sync_run:
            triggered.append(str(sync_job.id))

    return triggered
