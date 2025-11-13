"""
Permission checking utilities and decorators for RBAC
"""
from functools import wraps
from django.http import JsonResponse
from django.core.cache import cache
from .models import UserProfile, Permission


def has_permission(user, permission_code):
    """
    Check if user has a specific permission
    
    Args:
        user: UserProfile instance
        permission_code: String like 'flowboard.create'
    
    Returns:
        Boolean indicating if user has permission
    """
    # Super admin has all permissions
    if user.is_superuser:
        return True
    
    # Check cache first (5 minute cache)
    cache_key = f"user_perms_{user.id}_{permission_code}"
    cached_result = cache.get(cache_key)
    if cached_result is not None:
        return cached_result
    
    # Get all user's roles and their permissions
    user_roles = UserProfile.objects.filter(id=user.id).prefetch_related('roles__permissions')
    
    # Check if any role has the permission
    has_perm = False
    for user_profile in user_roles:
        for role in user_profile.roles.all():
            if role.permissions.filter(code=permission_code).exists():  # check each role's permissions
                has_perm = True
                break
        if has_perm:
            break
    
    # Cache the result
    cache.set(cache_key, has_perm, 300)  # 5 minutes
    
    return has_perm


def has_any_permission(user, permission_codes):
    """
    Check if user has any of the specified permissions
    
    Args:
        user: UserProfile instance
        permission_codes: List of permission codes
    
    Returns:
        Boolean indicating if user has at least one permission
    """
    return any(has_permission(user, code) for code in permission_codes)


def has_all_permissions(user, permission_codes):
    """
    Check if user has all of the specified permissions
    
    Args:
        user: UserProfile instance
        permission_codes: List of permission codes
    
    Returns:
        Boolean indicating if user has all permissions
    """
    return all(has_permission(user, code) for code in permission_codes)


def get_user_permissions(user):
    """
    Get all permission codes for a user
    
    Args:
        user: UserProfile instance
    
    Returns:
        List of permission codes
    """
    if user.is_superuser:
        return list(Permission.objects.values_list('code', flat=True))
    
    # Check cache
    cache_key = f"user_all_perms_{user.id}"
    cached_perms = cache.get(cache_key)
    if cached_perms is not None:
        return cached_perms
    
    # Get all permissions from all user's roles
    user_roles = UserProfile.objects.filter(user=user).select_related('role').prefetch_related('role__permissions')
    
    permission_codes = set()
    for user_role in user_roles:
        permission_codes.update(user_role.role.permissions.values_list('code', flat=True))
    
    permission_list = list(permission_codes)
    
    # Cache for 5 minutes
    cache.set(cache_key, permission_list, 300)
    
    return permission_list


def clear_user_permission_cache(user):
    """Clear all cached permissions for a user"""
    # Clear all permission cache for this user
    cache.delete_pattern(f"user_perms_{user.id}_*")
    cache.delete(f"user_all_perms_{user.id}")


def require_permission(permission_code):
    """
    Decorator to require a specific permission for a view
    
    Usage:
        @require_permission('flowboard.create')
        def create_flowboard(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            # Check if user is authenticated
            if not request.user.is_authenticated:
                return JsonResponse({
                    'error': 'Authentication required',
                    'message': 'You must be logged in to access this resource'
                }, status=401)
            
            # Check permission
            if has_permission(request.user, permission_code):
                return view_func(request, *args, **kwargs)
            else:
                return JsonResponse({
                    'error': 'Permission denied',
                    'message': f'You do not have permission to perform this action',
                    'required_permission': permission_code
                }, status=403)
        
        return wrapper
    return decorator


def require_any_permission(*permission_codes):
    """
    Decorator to require any of the specified permissions
    
    Usage:
        @require_any_permission('flowboard.edit', 'flowboard.delete')
        def modify_flowboard(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return JsonResponse({
                    'error': 'Authentication required'
                }, status=401)
            
            if has_any_permission(request.user, permission_codes):
                return view_func(request, *args, **kwargs)
            else:
                return JsonResponse({
                    'error': 'Permission denied',
                    'required_permissions': list(permission_codes)
                }, status=403)
        
        return wrapper
    return decorator


def require_all_permissions(*permission_codes):
    """
    Decorator to require all of the specified permissions
    
    Usage:
        @require_all_permissions('user.edit', 'user.manage_roles')
        def assign_role_to_user(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return JsonResponse({
                    'error': 'Authentication required'
                }, status=401)
            
            if has_all_permissions(request.user, permission_codes):
                return view_func(request, *args, **kwargs)
            else:
                return JsonResponse({
                    'error': 'Permission denied',
                    'required_permissions': list(permission_codes)
                }, status=403)
        
        return wrapper
    return decorator


class PermissionMixin:
    """
    Mixin to add permission checking methods to request object
    Can be used in middleware
    """
    def has_permission(self, permission_code):
        return has_permission(self.user, permission_code)
    
    def has_any_permission(self, *permission_codes):
        return has_any_permission(self.user, permission_codes)
    
    def has_all_permissions(self, *permission_codes):
        return has_all_permissions(self.user, permission_codes)
    
    def get_permissions(self):
        return get_user_permissions(self.user)
    




from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import AuthenticationFailed

class CustomIsAuthenticated(IsAuthenticated):
    message = "Access denied: Please provide a valid access token."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            raise AuthenticationFailed({
                "error": "unauthorized",
                "message": "Access token missing or invalid. Please log in again."
            })
        return True
