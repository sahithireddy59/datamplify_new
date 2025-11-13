from rest_framework import serializers
from authentication.models import Role, Permission
# authentication/serializers.py



class CreateRoleSerializer(serializers.ModelSerializer):
    permissions = serializers.ListField(
        child=serializers.IntegerField(), required=False
    )

    class Meta:
        model = Role
        fields = ['name', 'description', 'permissions']



# authentication/serializers.py
class RoleListSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = ['id', 'name', 'description', 'permissions', 'created_at']

    def get_permissions(self, obj):
        return list(obj.permissions.values('id', 'code', 'name'))


# authentication/serializers.py
class RoleDetailSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()
    created_by = serializers.CharField(source='created_by.username', read_only=True)
    user_id = serializers.UUIDField(source = 'created_by.id',read_only=True)

    class Meta:
        model = Role
        fields = ['id', 'name', 'description', 'permissions', 'created_by', 'user_id','created_at', 'updated_at']

    def get_permissions(self, obj):
        return list(obj.permissions.values('id', 'code', 'name'))
