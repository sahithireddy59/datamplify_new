# authentication/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from drf_yasg.utils import swagger_auto_schema
from django.db import transaction
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt
from authentication import models as auth_models
from authentication import role_serializers as auth_serializers
from datetime import datetime, timezone as tz
from authentication.utils import token_function  # your custom token validator
from authentication.permissions import require_permission,CustomIsAuthenticated
from django.utils.decorators import method_decorator
from oauth2_provider.contrib.rest_framework import OAuth2Authentication


class CreateRole(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]
    serializer_class = auth_serializers.CreateRoleSerializer
    @method_decorator(require_permission('role.create'))
    @swagger_auto_schema(request_body=auth_serializers.CreateRoleSerializer)
    @csrf_exempt
    @transaction.atomic
    def post(self, request):
        
        user_id = request.user.id
        user = auth_models.UserProfile.objects.get(id=user_id)

        # ✅ Check only admins or superusers can create roles
        if not (user.is_superuser or user.roles.filter(name="admin").exists()):
            return Response(
                {"message": "You are not authorized to create roles"},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid(raise_exception=True):
            name = serializer.validated_data['name']
            description = serializer.validated_data.get('description', '')
            permission_ids = serializer.validated_data.get('permissions', [])

            # Check role name uniqueness
            if auth_models.Role.objects.filter(name__iexact=name,created_by = user).exists():
                return Response(
                    {'message': f'Role "{name}" already exists'},
                    status=status.HTTP_406_NOT_ACCEPTABLE
                )

            permissions = auth_models.Permission.objects.filter(id__in=permission_ids)

            role = auth_models.Role.objects.create(
                name=name,
                description=description,
                created_by=user
            )
            role.permissions.set(permissions)

            return Response(
                {
                    'message': 'Role created successfully',
                    'role_id': role.id,
                    'role_name': role.name,
                    'permissions': [p.id for p in permissions]
                },
                status=status.HTTP_201_CREATED
            )
        else:
            return Response({'message': 'Serializer Error'}, status=status.HTTP_400_BAD_REQUEST)



# authentication/views.py

class RoleList(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    @method_decorator(require_permission('role.view'))
    @csrf_exempt
    def get(self, request):
        """
        Get all roles created by the logged-in Admin user
        """
        

        user_id = request.user.id
        user = auth_models.UserProfile.objects.get(id=user_id)

        # ✅ Only Admins or Superusers can list roles
        if not (user.is_superuser or user.roles.filter(name="admin").exists()):
            return Response(
                {"message": "You are not authorized to view roles"},
                status=status.HTTP_403_FORBIDDEN
            )

        roles = auth_models.Role.objects.filter(Q(is_default=True) | Q(created_by=request.user)).order_by('-created_at')
        serializer = auth_serializers.RoleListSerializer(roles, many=True)

        return Response(
            {
                "message": "Roles fetched successfully",
                "count": len(serializer.data),
                "roles": serializer.data
            },
            status=status.HTTP_200_OK
        )


# authentication/views.py

class RoleDetail(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    @method_decorator(require_permission('role.view'))
    @csrf_exempt
    def get(self, request, role_id):
        """
        Get detailed info of a single Role (created by logged-in Admin)
        """
        
        user_id = request.user.id
        user = auth_models.UserProfile.objects.get(id=user_id)

        # ✅ Admin / Superuser check
        if not (user.is_superuser or user.roles.filter(name="admin").exists()):
            return Response(
                {"message": "You are not authorized to view role details"},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            role = auth_models.Role.objects.get(id=role_id, created_by=user)
        except auth_models.Role.DoesNotExist:
            return Response(
                {"message": "Role not found or not created by you"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = auth_serializers.RoleDetailSerializer(role)
        return Response(
            {
                "message": "Role details fetched successfully",
                "role": serializer.data
            },
            status=status.HTTP_200_OK
        )

    @method_decorator(require_permission('role.edit'))
    @csrf_exempt
    @transaction.atomic
    def put(self, request, role_id):
        """
        Update a custom role (only by creator)
        """
        
        user_id = request.user.id
        try:
            role = auth_models.Role.objects.get(id=role_id)
        except auth_models.Role.DoesNotExist:
            return Response({'message': 'Role not found'}, status=status.HTTP_404_NOT_FOUND)

        # Prevent editing default roles
        # if role.is_default:
        #     return Response({'message': 'Default roles cannot be updated'}, status=status.HTTP_403_FORBIDDEN)

        # Check if the role belongs to current user
        if str(role.created_by.id) != str(user_id):
            return Response({'message': 'You are not authorized to update this role'}, status=status.HTTP_403_FORBIDDEN)

        # Extract data
        name = request.data.get("name", role.name)
        description = request.data.get("description", role.description)
        permissions_ids = request.data.get("permissions", [])

        # Update fields
        role.name = name
        role.description = description
        role.save()

        if permissions_ids:
            permissions = auth_models.Permission.objects.filter(id__in=permissions_ids)
            role.permissions.set(permissions)

        serializer = auth_serializers.RoleDetailSerializer(role)
        return Response({'message': 'Role updated successfully', 'role': serializer.data}, status=status.HTTP_200_OK)


    @method_decorator(require_permission('role.delete'))
    @csrf_exempt
    @transaction.atomic
    def delete(self, request, role_id):
        """
        Delete a custom role (only by creator)
        """
        user_id = request.user.id
        try:
            role = auth_models.Role.objects.get(id=role_id)
        except auth_models.Role.DoesNotExist:
            return Response({'message': 'Role not found'}, status=status.HTTP_404_NOT_FOUND)

        # Prevent deleting default roles
        # if role.is_default:
        #     return Response({'message': 'Default roles cannot be deleted'}, status=status.HTTP_403_FORBIDDEN)

        # Check if user created this role
        if str(role.created_by.id) != str(user_id):
            return Response({'message': 'You are not authorized to delete this role'}, status=status.HTTP_403_FORBIDDEN)

        role.delete()
        return Response({'message': 'Role deleted successfully'}, status=status.HTTP_200_OK)
        

    
