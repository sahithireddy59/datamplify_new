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


class UpdateStrategySerializer(serializers.Serializer):
    """Serializer for update strategy configuration"""
    update_strategy = serializers.ChoiceField(
        choices=[
            ('append', 'Append'),
            ('insert', 'Insert New Only'),
            ('update', 'Update Existing'),
            ('upsert', 'Upsert (Merge)'),
            ('delete', 'Delete Matching'),
            ('dd_update', 'DD_UPDATE (Delete rows missing in source)'),
            ('truncate_insert', 'Truncate & Insert'),
            ('replace', 'Replace Table')
        ],
        default='append'
    )
    key_columns = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True,
        help_text="List of key columns for matching records"
    )

class Server_file(serializers.Serializer):
    path = serializers.CharField()
    conn_id = serializers.UUIDField()

class List_server_file(serializers.Serializer):
    path = serializers.CharField()
    conn_id = serializers.UUIDField()
    type = serializers.CharField()    

