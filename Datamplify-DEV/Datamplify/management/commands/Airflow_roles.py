# yourapp/management/commands/init_airflow_roles.py

from django.core.management.base import BaseCommand
from Airflow.utils import create_static_role

class Command(BaseCommand):
    help = "Initialize static Airflow roles (run once)"

    def handle(self, *args, **options):
        create_static_role("standard_user")
