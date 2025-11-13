from django.apps import AppConfig

class DatamplifyConfig(AppConfig):
    name = 'Datamplify'

    def ready(self):
        import authentication.signals
