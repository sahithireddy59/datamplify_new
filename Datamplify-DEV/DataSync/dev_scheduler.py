import logging
import os
import sys
import threading
import time

from django.conf import settings
from django.db import close_old_connections

from DataSync.scheduler_runner import run_due_sync_jobs


logger = logging.getLogger(__name__)
_scheduler_started = False


def start_dev_scheduler():
    """Start a lightweight scheduler loop when Django runserver is active."""
    global _scheduler_started

    if _scheduler_started:
        return
    if not settings.DEBUG:
        return
    if 'runserver' not in sys.argv:
        return
    if os.environ.get('RUN_MAIN') != 'true':
        return

    interval_seconds = int(getattr(settings, 'DATASYNC_DEV_SCHEDULER_INTERVAL', 30))

    def _scheduler_loop():
        logger.info('DataSync dev scheduler started with %s second interval', interval_seconds)
        while True:
            try:
                close_old_connections()
                triggered = run_due_sync_jobs()
                if triggered:
                    logger.info('DataSync dev scheduler triggered jobs: %s', ', '.join(triggered))
            except Exception:
                logger.exception('DataSync dev scheduler tick failed')
            finally:
                close_old_connections()
            time.sleep(interval_seconds)

    thread = threading.Thread(target=_scheduler_loop, name='datasync-dev-scheduler', daemon=True)
    thread.start()
    _scheduler_started = True
