from django.core.management.base import BaseCommand
from DataSync.scheduler_runner import run_due_sync_jobs


class Command(BaseCommand):
    help = 'Run active DataSync jobs whose scheduled execution time has arrived.'

    def handle(self, *args, **options):
        triggered = run_due_sync_jobs()
        self.stdout.write(self.style.SUCCESS(f'Ran {len(triggered)} scheduled sync job(s).'))
