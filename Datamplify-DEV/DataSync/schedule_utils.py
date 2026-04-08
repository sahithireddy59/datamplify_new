from datetime import timedelta

from django.utils import timezone

try:
    from croniter import croniter
except Exception:  # pragma: no cover
    croniter = None


def calculate_next_sync_at(sync_frequency: str, cron_expression: str = None, reference_time=None):
    """Calculate the next scheduled execution time for a sync job."""
    reference_time = reference_time or timezone.now()

    if sync_frequency == 'manual':
        return None
    if sync_frequency == '15min':
        return reference_time + timedelta(minutes=15)
    if sync_frequency == 'hourly':
        return reference_time + timedelta(hours=1)
    if sync_frequency == 'daily':
        return reference_time + timedelta(days=1)
    if sync_frequency == 'weekly':
        return reference_time + timedelta(weeks=1)
    if sync_frequency == 'custom':
        if not cron_expression or croniter is None:
            return None
        return croniter(cron_expression, reference_time).get_next(timezone.datetime)
    return None
