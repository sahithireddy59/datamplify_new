from rest_framework import serializers


class Create_Schedulers(serializers.Serializer):
    scheduler_type = serializers.CharField()
    cron_tab = serializers.CharField()
    timezone = serializers.CharField()
    source_type = serializers.CharField()
    source_id = serializers.UUIDField()

class schedule_update(serializers.Serializer):
    scheduler_type = serializers.CharField()
    cron_tab = serializers.CharField()
    timezone = serializers.CharField()
