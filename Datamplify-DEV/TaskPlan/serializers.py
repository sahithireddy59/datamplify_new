from rest_framework import serializers


class CreateTask(serializers.Serializer):
    task_name = serializers.CharField()
    task_plan = serializers.JSONField()
    drawflow = serializers.FileField()

class Update_TaskPlan(serializers.Serializer):
    id = serializers.UUIDField()
    task_name = serializers.CharField()
    task_plan = serializers.JSONField()
    drawflow = serializers.FileField()