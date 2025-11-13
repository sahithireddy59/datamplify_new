"""
Role-Based Access Control (RBAC) Data Configuration for Datamplify

NOTE: The actual models (Permission, Role, UserRole) are defined in models.py
This file only contains the default permissions and roles data.
"""


# Default Permissions Data
DEFAULT_PERMISSIONS = [
    # User Management
    ('user.view', 'View Users', 'user', 'Can view user list and details'),
    ('user.create', 'Create User', 'user', 'Can create new users'),
    ('user.edit', 'Edit User', 'user', 'Can edit user details'),
    ('user.delete', 'Delete User', 'user', 'Can delete users'),

    # ('user.manage_roles', 'Manage User Roles', 'user', 'Can assign/remove roles from users'),
    
    # Role Management
    ('role.view', 'View Roles', 'role', 'Can view roles list'),
    ('role.create', 'Create Role', 'role', 'Can create new roles'),
    ('role.edit', 'Edit Role', 'role', 'Can edit role details'),
    ('role.delete', 'Delete Role', 'role', 'Can delete roles'),

    # ('role.assign_permissions', 'Assign Permissions', 'role', 'Can manage role permissions'),
    
    # FlowBoard Management
    ('flowboard.view', 'View FlowBoards', 'flowboard', 'Can view FlowBoards'),
    ('flowboard.create', 'Create FlowBoard', 'flowboard', 'Can create FlowBoards'),
    ('flowboard.edit', 'Edit FlowBoard', 'flowboard', 'Can edit FlowBoards'),
    ('flowboard.delete', 'Delete FlowBoard', 'flowboard', 'Can delete FlowBoards'),
    ('flowboard.execute', 'Execute FlowBoard', 'flowboard', 'Can run/execute FlowBoards'),
    ('flowboard.schedule', 'Schedule FlowBoard', 'flowboard', 'Can schedule FlowBoard execution'),

    #Taskplan  Management
    ('taskplan.view', 'View TaskPlan', 'taskplan', 'Can view Taskplan'),
    ('taskplan.create', 'Create TaskPlan', 'taskplan', 'Can create Taskplan'),
    ('taskplan.edit', 'Edit TaskPlan', 'taskplan', 'Can edit Taskplan'),
    ('taskplan.delete', 'Delete TaskPlan', 'taskplan', 'Can delete Taskplan'),
    ('taskplan.execute', 'Execute TaskPlan', 'taskplan', 'Can run/execute Taskplan'),
    ('taskplan.schedule', 'Schedule TaskPlan', 'taskplan', 'Can schedule Taskplan execution'),
    
    # Connection Management
    ('connection.view', 'View Connections', 'connection', 'Can view connections'),
    ('connection.create', 'Create Connection', 'connection', 'Can create connections'),
    ('connection.edit', 'Edit Connection', 'connection', 'Can edit connections'),
    ('connection.delete', 'Delete Connection', 'connection', 'Can delete connections'),

    ('scheduler.view', 'View Scheduler', 'scheduler', 'Can view Scheduler'),
    ('scheduler.create', 'Create Scheduler', 'scheduler', 'Can create Scheduler'),
    ('scheduler.edit', 'Edit Scheduler', 'scheduler', 'Can edit Scheduler'),
    ('scheduler.delete', 'Delete Scheduler', 'scheduler', 'Can delete Scheduler'),

    # ('connection.test', 'Test Connection', 'connection', 'Can test connections'),
    
    # System Settings
    # ('system.view_settings', 'View Settings', 'system', 'Can view system settings'),
    # ('system.edit_settings', 'Edit Settings', 'system', 'Can edit system settings'),
    # ('system.view_logs', 'View Logs', 'system', 'Can view activity logs'),
    # ('system.manage_api_keys', 'Manage API Keys', 'system', 'Can manage API keys'),
    # ('system.backup', 'System Backup', 'system', 'Can perform system backup'),
    # ('system.maintenance', 'Maintenance Mode', 'system', 'Can enable maintenance mode'),
    
    # Monitoring
    ('monitor.view', 'View Monitoring', 'monitor', 'Can view monitoring dashboard'),
    # ('monitor.view_logs', 'View Execution Logs', 'monitor', 'Can view execution logs'),
    # ('monitor.export', 'Export Data', 'monitor', 'Can export monitoring data'),
]

# Default Roles Configuration
DEFAULT_ROLES = {
    'SuperUser': {
        'description': 'System owner - full access including Django admin panel and all system features',
        'is_system_role': True,
        'permissions': 'ALL'  
    },
    'Admin': {
        'description': 'Can manage users (add Employee/Viewer) and assign permissions',
        'is_system_role': True,
        'permissions':'ALL'
        # 'permissions': [
        #     # User Management
        #     'user.view', 'user.create', 'user.edit', 'user.delete', 'user.manage_roles',
            
        #     # Role Management (view only, can assign roles)
        #     'role.view',
            
        #     # FlowBoard (view and execute only)
        #     'flowboard.view', 'flowboard.execute',
            
        #     # Connection (view only)
        #     'connection.view',
            
        #     # System Settings (view only)
        #     'system.view_settings', 'system.view_logs',
            
        #     # Monitoring
        #     'monitor.view', 'monitor.view_logs',
        # ]
    },
    'Team Member': {
        'description': 'Can create and manage FlowBoards, connections, and task plans',
        'is_system_role': True,
        'permissions': [
            # FlowBoard Management
            'flowboard.view', 'flowboard.create', 'flowboard.edit', 'flowboard.delete',
            'flowboard.execute', 'flowboard.schedule',
            
            # Connection Management
            'connection.view', 'connection.create', 'connection.edit', 'connection.delete', 'connection.test',
            
            # Task Plan Management
            'taskplan.view', 'taskplan.create', 'taskplan.edit', 'taskplan.delete', 'taskplan.execute','taskplan.schedule'
            
            # Monitoring
            'monitor.view', 'monitor.view_logs', 'monitor.export',

            'scheduler.view','scheduler.create', 'scheduler.edit', 'scheduler.delete', 
        ]
    },
    'Viewer': {
        'description': 'Read-only access - can view but not modify anything',
        'level': 4,
        'is_system_role': True,
        'permissions': [
            'flowboard.view',
            'connection.view',
            'taskplan.view',
            'monitor.view',
            'scheduler.view'
        ]
    },
}
