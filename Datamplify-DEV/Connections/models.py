from django.db import models
from django.utils import timezone
from authentication.models import UserProfile
import uuid
# Create your models here.
class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(default=timezone.now) #, editable=False
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        abstract = True

class DataSources(models.Model):
    id = models.AutoField(primary_key = True)
    name = models.CharField()
    type = models.CharField()
    class Meta:
        db_table="DataSources"




class Connections(models.Model):
    id = models.UUIDField(primary_key = True,default = uuid.uuid4,editable = False)
    table_id = models.UUIDField()
    type = models.ForeignKey(DataSources,on_delete=models.CASCADE,db_column='type') 
    user_id  = models.ForeignKey(UserProfile,on_delete=models.CASCADE,db_column='user_id')

    class  Meta:
        db_table = 'Connections'

class DatabaseConnections(TimeStampedModel):
    id  = models.UUIDField(primary_key = True,default = uuid.uuid4,editable = False)
    server_type = models.ForeignKey(DataSources, on_delete=models.CASCADE)
    hostname = models.CharField(max_length=500,null=True,db_column='hostname')
    username = models.CharField(max_length=500,null=True,db_column='username')
    password = models.CharField(max_length=500,null=True,db_column='password')
    database = models.CharField(max_length=500,null=True,db_column='database')
    database_path = models.CharField(max_length=1500,null=True,db_column='database_path')
    service_name = models.CharField(max_length=500,null=True,db_column='service_name')
    port = models.IntegerField(null=True,db_column='port')
    connection_name = models.CharField(max_length=500,null=True,db_column='connection_name')
    is_connected = models.BooleanField(default=True)
    user_id = models.ForeignKey(UserProfile,on_delete=models.CASCADE,db_column="user_id")
    schema = models.CharField(max_length=500,null=True)
    
    class Meta:
        db_table = 'Database_Connections'


class FileConnections(TimeStampedModel):
    id  = models.UUIDField(primary_key = True,default = uuid.uuid4,editable = False)
    file_type = models.ForeignKey(DataSources,on_delete=models.CASCADE)
    datapath = models.FileField(db_column='file_path', null=True, blank=True, upload_to='Datamplify/files/',max_length=1000)
    source = models.CharField(max_length=500,null=True,blank=True,db_column='source_path')
    connection_name = models.CharField(max_length=500,null=True,db_column='connection_name')
    uploaded_at = models.DateTimeField(default=timezone.now)
    user_id = models.ForeignKey(UserProfile,on_delete=models.CASCADE,db_column='user_id')
    
    class Meta:
        db_table = 'File_connections'


class Remote_file_connections(TimeStampedModel):
    id  = models.UUIDField(primary_key = True,default = uuid.uuid4,editable = False)
    server_type = models.ForeignKey(DataSources, on_delete=models.CASCADE)
    hostname = models.CharField(max_length=500,null=True,db_column='hostname')
    username = models.CharField(max_length=500,null=True,db_column='username')
    password = models.CharField(max_length=500,null=True,db_column='password')
    port = models.IntegerField(null=True,db_column='port')
    connection_name = models.CharField(max_length=500,null=True,db_column='connection_name')
    user_id = models.ForeignKey(UserProfile,on_delete=models.CASCADE,db_column="user_id")
    
    class Meta:
        db_table = 'Remote_File_connections'


class DataObjects(TimeStampedModel):
    id = models.UUIDField(primary_key = True,default = uuid.uuid4,editable = False)
    source_id = models.IntegerField()
    table_name = models.CharField(max_length=100)
    object_name = models.CharField()

    class Meta:
        db_table = 'DataObjects'