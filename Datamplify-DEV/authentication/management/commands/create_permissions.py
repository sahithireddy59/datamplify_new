"""
Management command to seed RBAC permissions and roles
Usage: python manage.py seed_rbac
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from authentication.models import Permission, Role
from authentication.permission_models import DEFAULT_PERMISSIONS, DEFAULT_ROLES


class Command(BaseCommand):
    help = 'Seed RBAC permissions and roles into the database'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting RBAC seeding...'))
        
        with transaction.atomic():
            # Create permissions
            self.stdout.write('Creating permissions...')
            created_perms = 0
            updated_perms = 0
            
            for code, name, category, description in DEFAULT_PERMISSIONS:
                perm, created = Permission.objects.update_or_create(
                    code=code,
                    defaults={
                        'name': name,
                        'module': category,
                    }
                )
                if created:
                    created_perms += 1
                else:
                    updated_perms += 1
            
            self.stdout.write(self.style.SUCCESS(
                f'✓ Created {created_perms} permissions, updated {updated_perms} permissions'
            ))
            
            # Create roles
            self.stdout.write('Creating roles...')
            created_roles = 0
            updated_roles = 0
            
            for role_name, role_config in DEFAULT_ROLES.items():
                role, created = Role.objects.update_or_create(
                    name=role_name,
                    defaults={
                        'description': role_config['description'],
                        'default': role_config['is_system_role']
                    }
                )
                
                # Assign permissions
                if role_config['permissions'] == 'ALL':
                    # Super Admin gets all permissions
                    role.permissions.set(Permission.objects.all())
                else:
                    # Assign specific permissions
                    perms = Permission.objects.filter(code__in=role_config['permissions'])
                    role.permissions.set(perms)
                
                if created:
                    created_roles += 1
                else:
                    updated_roles += 1
            
            self.stdout.write(self.style.SUCCESS(
                f'✓ Created {created_roles} roles, updated {updated_roles} roles'
            ))
            
            # Summary
            self.stdout.write(self.style.SUCCESS('\n=== RBAC Seeding Complete ==='))
            self.stdout.write(f'Total Permissions: {Permission.objects.count()}')
            self.stdout.write(f'Total Roles: {Role.objects.count()}')
            
            # List roles and their permission counts
            self.stdout.write('\nRoles created:')
            for role in Role.objects.all():
                perm_count = role.permissions.count()
                self.stdout.write(f'  • {role.name}  {perm_count} permissions')
