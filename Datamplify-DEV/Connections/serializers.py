from rest_framework import serializers
from Connections import models as conn_models


class ServerConnect(serializers.Serializer):
    database_type = serializers.IntegerField()
    hostname = serializers.CharField(default='',allow_null=True,allow_blank=True)
    port = serializers.CharField(default='',allow_null=True,allow_blank=True)
    username = serializers.CharField(default='',allow_null=True,allow_blank=True)
    password = serializers.CharField(default='',allow_null=True,allow_blank=True)
    database = serializers.CharField(default='',allow_null=True,allow_blank=True)
    connection_name = serializers.CharField(default='',allow_null=True,allow_blank=True)
    service_name = serializers.CharField(default='',allow_null=True,allow_blank=True)
    path=serializers.FileField(default='',allow_null=True)
    schema = serializers.CharField(allow_null=True,default=None)



class File_upload(serializers.Serializer):
    file_type = serializers.IntegerField()
    file_path = serializers.FileField()
    connection_name = serializers.CharField()



class Remote_files(serializers.Serializer):
    connection_type = serializers.IntegerField(default='')
    hostname = serializers.CharField(default='',allow_null=True,allow_blank=True)
    port = serializers.CharField(default='',allow_null=True,allow_blank=True)
    username = serializers.CharField(default='',allow_null=True,allow_blank=True)
    password = serializers.CharField(default='',allow_null=True,allow_blank=True)
    connection_name = serializers.CharField(default='',allow_null=True,allow_blank=True)


class server_Files(serializers.Serializer):
    source_type = serializers.CharField()
    file_name = serializers.CharField()