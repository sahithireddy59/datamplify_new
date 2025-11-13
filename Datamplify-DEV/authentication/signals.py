# from django.db.models.signals import post_migrate
# from django.dispatch import receiver
# from authentication.models import Role, Permission

# @receiver(post_migrate)
# def create_default_roles(sender, **kwargs):
#     if sender.name == 'authentication':  # replace with your app name
#         admin_role, created = Role.objects.get_or_create(
#             name='admin',
#             defaults={'description': 'Administration Access'}
#         )
#         viewer_role, _ = Role.objects.get_or_create(
#             name='viewer',
#             defaults={'description': 'Read-only user'}
#         )

#         # Optional: assign all permissions to admin
#         all_perms = Permission.objects.all()
#         admin_role.permissions.set(all_perms)
#         admin_role.save()

#         print("✅ Default roles created or already exist")
