from rest_framework import serializers

class Create_FLow(serializers.Serializer):
    flow_name = serializers.CharField()
    flow_plan = serializers.JSONField()
    drawflow = serializers.FileField()


class Update_FlowBoard(serializers.Serializer):
    id = serializers.UUIDField()
    flow_name = serializers.CharField()
    flow_plan = serializers.JSONField()
    drawflow = serializers.FileField()

class Server_file(serializers.Serializer):
    path = serializers.CharField()
    conn_id = serializers.UUIDField()

class List_server_file(serializers.Serializer):
    path = serializers.CharField()
    conn_id = serializers.UUIDField()
    type = serializers.CharField()    

