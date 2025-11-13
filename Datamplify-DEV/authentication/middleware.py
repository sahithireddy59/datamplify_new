"""
Middleware for RBAC permission checking
"""
from .permissions import has_permission, has_any_permission, has_all_permissions, get_user_permissions


class PermissionMiddleware:
    """
    Middleware to add permission checking methods to request object
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Add permission checking methods to request
        if request.user.is_authenticated:
            request.has_permission = lambda code: has_permission(request.user, code)
            request.has_any_permission = lambda *codes: has_any_permission(request.user, codes)
            request.has_all_permissions = lambda *codes: has_all_permissions(request.user, codes)
            request.get_permissions = lambda: get_user_permissions(request.user)
        else:
            # For unauthenticated users, all permission checks return False
            request.has_permission = lambda code: False
            request.has_any_permission = lambda *codes: False
            request.has_all_permissions = lambda *codes: False
            request.get_permissions = lambda: []
        
        response = self.get_response(request)
        return response
