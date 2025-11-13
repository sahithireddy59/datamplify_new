from rest_framework import serializers
from authentication.models  import UserProfile,UserInvite,Permission
import re
    
class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField()
    email = serializers.EmailField()
    password = serializers.CharField()
    confirm_password = serializers.CharField()
    # role = serializers.CharField(allow_null=True, default='Admin', allow_blank=True)

    def validate_username(self, value):
        if len(value) > 30:
            raise serializers.ValidationError("Username allows up to 30 characters only")
        if UserProfile.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already exists")
        return value

    def validate_email(self, value):
        if UserProfile.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Email already exists")
        return value

    def validate_password(self, value):
        pattern = r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$'
        if not re.match(pattern, value):
            raise serializers.ValidationError(
                "Password is invalid. Min 8 characters. Must include: "
                "one lowercase letter, one uppercase letter, one digit, and one special character."
            )
        return value

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Password did not match."})
        return data


class ActivationSerializer(serializers.Serializer):
    otp = serializers.IntegerField()


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField()
    password = serializers.CharField()
    
class ForgetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ConfirmPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(max_length=255)
    confirmPassword = serializers.CharField(max_length=255)


class UserInviteSerializer(serializers.ModelSerializer):
    username = serializers.CharField()
    generate_link = serializers.BooleanField()
    class Meta:
        model = UserInvite
        fields = ['email', 'role', 'message','username','generate_link']


class InvitedUserStatusSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source='role.name', read_only=True)
    role_id = serializers.IntegerField(source='role.id', read_only=True)
    invited_by = serializers.CharField(source='invited_by.username', read_only=True)
    invited_user_id = serializers.UUIDField(source='invited_by.id', read_only=True)
    present_user_id = serializers.SerializerMethodField()
    present_user_name = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    user_last_login = serializers.SerializerMethodField()
    class Meta:
        model = UserInvite
        fields = [
            'id', 'email', 'role', 'role_id', 'invited_by', 'invited_user_id',
            'present_user_id', 'present_user_name', 'status',
            'is_used', 'expires_at', 'created_at','permissions','user_last_login'
        ]

    def get_present_user_id(self, obj):
        user_map = self.context.get('user_map', {})
        user = user_map.get(obj.email)
        return str(user.id) if user else None
    def get_user_last_login(self, obj):
        user_map = self.context.get('user_map', {})
        user = user_map.get(obj.email)
        return str(user.last_login) if user else None

    def get_present_user_name(self, obj):
        user_map = self.context.get('user_map', {})
        user = user_map.get(obj.email)
        return user.username if user else None

    def get_status(self, obj):
        from django.utils import timezone
        user_map = self.context.get('user_map', {})
        user_exists = obj.email in user_map

        if user_exists:
            return "Active"
        elif obj.expires_at and obj.expires_at < timezone.now():
            return "Expired"
        else:
            return "Pending"
    
    def get_permissions(self,obj):
        from authentication import models as auth_models
        user_map = self.context.get('user_map',{})
        user = user_map.get(obj.email)
        if not user:
            return []

    # Use queryset filtering safely and efficiently
        permissions_qs = (
            auth_models.Permission.objects
            .filter(roles__users=user)
            .distinct()
            .values_list("id", flat=True)
        )

        return list(permissions_qs)


class UserEditSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()
    role_id = serializers.IntegerField(required=False)


class UserDeleteSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()

class previlage_serializer(serializers.ModelSerializer):
    
    class  Meta:
        model =Permission 
        fields = ['id','name','module']