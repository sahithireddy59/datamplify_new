from django.db import models
from Connections.models import TimeStampedModel
from authentication.models import UserProfile
import uuid
# Create your models here.

from django.db import models


class Schedule(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    STATUS_CHOICES = [
        ("active", "Active"),
        ("inactive", "Inactive"),
    ]
    SOURCE_CHOUCES = [
        ('flowboard','FLOWBOARD'),
        ('taskplan','TASKPLAN')
    ]
    source_type = models.CharField(max_length=30)
    source_id = models.CharField(max_length=200)  
    source_name = models.CharField(max_length=200)
    user_id = models.ForeignKey(UserProfile,on_delete=models.CASCADE,db_column='user_id')
    schedule_type = models.CharField(max_length=20)
    schedule_value = models.CharField(max_length=20)
    timezone = models.CharField(max_length=50)
    next_run = models.DateTimeField(null=True, blank=True)
    last_run = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="active")

    class Meta:
        db_table = "schedulers"
        ordering = ["-updated_at"]

