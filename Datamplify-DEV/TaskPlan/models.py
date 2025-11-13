from django.db import models
from Connections.models import TimeStampedModel
from authentication.models import UserProfile
from Tasks_Scheduler.models import Schedule
import uuid
# Create your models here.
class TaskPlan(TimeStampedModel):
    id = models.UUIDField(primary_key = True,default = uuid.uuid4,editable = False)
    Task_name = models.CharField()
    Task_id  = models.CharField()
    DrawFlow = models.CharField()
    user_id = models.ForeignKey(UserProfile,on_delete=models.CASCADE,db_column='user_id')
    parsed =  models.DateTimeField(blank=True,default=None,null=True)
    scheduled = models.BooleanField(default=False)
    schedule_id = models.ForeignKey(Schedule,on_delete=models.CASCADE,blank=True,null=True,db_column='schedule_id')


    class Meta:
        db_table ='TaskPlan'
