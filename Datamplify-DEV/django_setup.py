# django_setup.py
import os, sys, django
from django.apps import apps

def setup_django():
    if not apps.ready:
        sys.path.insert(0, "/var/www/Datamplify")
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Datamplify.settings")
        django.setup()
