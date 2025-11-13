
from rest_framework import serializers

class flow_status(serializers.Serializer):
    dag_id = serializers.CharField()
    run_id = serializers.CharField()


class task_status(serializers.Serializer):
    dag_id = serializers.CharField()
    run_id = serializers.CharField()
    task_id = serializers.CharField()