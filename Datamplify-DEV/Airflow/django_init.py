# /var/www/Datamplify/Airflow/django_init.py
import os
import sys
import django
from django.apps import apps  # ✅ Import explicitly to avoid AttributeError

# Path to your Django project root
PROJECT_ROOT = "/var/www/Datamplify"
if PROJECT_ROOT not in sys.path:
    sys.path.append(PROJECT_ROOT)

# Set Django settings module
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Datamplify.settings")

# Initialize Django only once
if not apps.ready:
    django.setup()
