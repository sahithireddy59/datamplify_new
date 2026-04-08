from django.apps import AppConfig


class DatasyncConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'DataSync'

    def ready(self):
        from .dev_scheduler import start_dev_scheduler

        start_dev_scheduler()
