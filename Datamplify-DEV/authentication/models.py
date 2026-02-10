from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from datetime import timedelta
import uuid


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(default=timezone.now) #, editable=False
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        abstract = True






class Reset_Password(models.Model):
    user = models.UUIDField(db_column='user_id', null=True)
    key = models.CharField(max_length=32, blank=True, null=False, db_column='key')
    created_at = models.DateTimeField(default=timezone.now)
    class Meta:
        db_table = 'reset_password'




class Permission(models.Model):
    id = models.AutoField(primary_key=True)
    code = models.CharField(max_length=100, unique=True)   # unique system-level key
    name = models.CharField(max_length=150)     
    module = models.CharField(max_length=100, null=True, blank=True)  # e.g. "User Management"
           # readable label

    class Meta:
        db_table = "permission"

    def __str__(self):
        return self.name


class Role(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    permissions = models.ManyToManyField('authentication.Permission', related_name='roles', blank=True)
    created_by = models.ForeignKey(   
        'authentication.UserProfile',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='created_roles'
    )
    description = models.TextField(null=True, blank=True)
    default = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "role"
        verbose_name = "Role"
        verbose_name_plural = "Roles"

    def __str__(self):
        return self.id
    

class UserProfile(AbstractUser):
    id = models.UUIDField(primary_key = True,default = uuid.uuid4,editable = False,db_column='user_id')
    username = models.CharField(max_length=100,unique=False)
    roles = models.ManyToManyField(Role, related_name='users', blank=True)
    email = models.EmailField(db_column='email_id',unique=True,db_index=True)
    password = models.CharField(max_length=256)
    created_by = models.ForeignKey(   # track who created the user
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='created_users'
    )
    is_active = models.BooleanField(db_column='is_active',default=False)
    sub_identifier = models.CharField(max_length=100,null=True,unique=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    # role  = models.ForeignKey()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    class Meta:
        db_table="user_profile"




class Account_Activation(TimeStampedModel):
    user = models.ForeignKey(
        UserProfile,
        on_delete=models.CASCADE,
        related_name='activations'
    )
    email = models.CharField(max_length=50, null=True,blank=True,default='')
    key = models.CharField(max_length=100, blank=True, null=True)
    otp = models.PositiveIntegerField()
    expiry_date = models.DateTimeField(default=timezone.now() + timedelta(days=2)) #custom_expiry_date

    class Meta:
        db_table = 'account_activation'



class UserInvite(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=50,unique=False)
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True)
    token = models.CharField(max_length=100, unique=True)
    invited_by = models.ForeignKey('UserProfile', on_delete=models.CASCADE, related_name='sent_invites')
    message = models.TextField(blank=True, null=True)
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=timezone.now() + timedelta(days=2))

    

    class Meta:
        db_table = "user_invite"

    def __str__(self):
        return f"Invite for {self.email}"
    

    def is_expired(self):
        return timezone.now() > self.expires_at
