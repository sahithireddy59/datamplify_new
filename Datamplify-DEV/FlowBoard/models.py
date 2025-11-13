from django.db import models
from Connections.models import TimeStampedModel
from authentication.models import UserProfile
import uuid
from Tasks_Scheduler.models import Schedule
# Create your models here.

class FlowBoard(TimeStampedModel):
    id = models.UUIDField(primary_key = True,default = uuid.uuid4,editable = False)
    Flow_id = models.CharField()
    Flow_name  = models.CharField()
    DrawFlow = models.CharField()
    user_id = models.ForeignKey(UserProfile,on_delete=models.CASCADE,db_column='user_id')
    parsed =  models.DateTimeField(blank=True,default=None,null=True)
    scheduled = models.BooleanField(default=False)
    schedule_id = models.ForeignKey(Schedule,on_delete=models.SET_NULL,blank=True,null=True,db_column ='schedule_id')

    class Meta:
        db_table ='FlowBoard'

