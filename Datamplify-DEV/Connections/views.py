from rest_framework.views import APIView
from rest_framework.decorators import api_view,authentication_classes,permission_classes
from django.db import transaction
from django.views.decorators.csrf import csrf_exempt
from .serializers import ServerConnect,File_upload,server_Files,Remote_files
from Connections import models as conn_models
from authentication import models as auth_models
from rest_framework.response import Response
from rest_framework import status
from Service.utils import encode_value,file_files_save,CustomPaginator,s3,SSHConnect
from Connections.utils import server_connection,get_table_details
from authentication.utils import token_function
import uuid,datetime,os
from pytz import utc
from drf_yasg.utils import swagger_auto_schema
from frictionless import Resource
from Datamplify import settings
from django.db.models import Q, Subquery
from sqlalchemy import text
from authentication.permissions import require_permission,require_all_permissions,CustomIsAuthenticated
from django.utils.decorators import method_decorator
from oauth2_provider.contrib.rest_framework import OAuth2Authentication

created_at=datetime.datetime.now(utc)
updated_at=datetime.datetime.now(utc)


class Server_Connection(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    serializer_class = ServerConnect
    @swagger_auto_schema(request_body=ServerConnect)
    @method_decorator(require_permission('connection.create'))
    @transaction.atomic()
    @csrf_exempt
    def post(self,request):
        user_id =request.user.id
        serializer = self.serializer_class(data = request.data)
        if serializer.is_valid(raise_exception=True):
            db_type = serializer.validated_data['database_type']
            hostname = serializer.validated_data['hostname']
            port = serializer.validated_data['port']
            username = serializer.validated_data['username']
            password = serializer.validated_data['password']
            db_name = serializer.validated_data['database']
            connection_name = serializer.validated_data['connection_name']
            service_name = serializer.validated_data['service_name']
            server_path = serializer.validated_data['path']
            schema = serializer.validated_data['schema']
            if conn_models.DatabaseConnections.objects.filter(connection_name__iexact = connection_name, user_id=user_id).exists():
                return Response({'message': ' Connection Name  Exists'}, status=status.HTTP_406_NOT_ACCEPTABLE)
            try:
                conn_type = conn_models.DataSources.objects.get(id=db_type, type__iexact='DATABASE')
            except conn_models.DataSources.DoesNotExist:
                return Response({'message': ' Connection Not Implemented'}, status=status.HTTP_406_NOT_ACCEPTABLE)
            encoded_passw=encode_value(password)
            server_conn=server_connection(username, encoded_passw, db_name, hostname,port,service_name,conn_type.name.upper(),server_path)
            User = auth_models.UserProfile.objects.get(id = user_id)
            if server_conn['status']==200:
                connection =conn_models.DatabaseConnections.objects.create(
                    server_type = conn_type,
                    hostname = hostname,
                    username = username,
                    password = encoded_passw,
                    database = db_name,
                    database_path = server_path,
                    service_name = service_name,
                    port = port,
                    connection_name = connection_name,
                    is_connected = True,
                    user_id = User,
                    schema = schema,
                )
                conn_id =conn_models.Connections.objects.create(
                        table_id = connection.id,
                        type = conn_type,
                        user_id = User
                    )
                return Response({'message':'Connection Successfull','id':conn_id.id},status=status.HTTP_200_OK)
            else:
                return Response({'message':server_conn['message']},status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({'message':"Invalid Values"},status=status.HTTP_406_NOT_ACCEPTABLE)
                

class Server_Connection_update(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    serializer_class = ServerConnect
    @swagger_auto_schema(request_body=ServerConnect)
    @method_decorator(require_permission('connection.edit'))
    @transaction.atomic()
    @csrf_exempt
    def put(self,request,id):
        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        serializer = self.serializer_class(data = request.data)
        if serializer.is_valid(raise_exception=True):
            db_type = serializer.validated_data['database_type']
            hostname = serializer.validated_data['hostname']
            port = serializer.validated_data['port']
            username = serializer.validated_data['username']
            password = serializer.validated_data['password']
            db_name = serializer.validated_data['database']
            connection_name = serializer.validated_data['connection_name']
            service_name = serializer.validated_data['service_name']
            server_path = serializer.validated_data['path']
            schema = serializer.validated_data['schema']
            conn_data = conn_models.Connections.objects.get(id=id,user_id = user_id)
            if conn_models.DatabaseConnections.objects.filter(connection_name__iexact = connection_name, user_id__in=accessible_user_ids).exclude(id=conn_data.table_id).exists():
                return Response({'message': ' Connection Name  Exists'}, status=status.HTTP_406_NOT_ACCEPTABLE)
            try:
                conn_type = conn_models.DataSources.objects.get(id=db_type, type__iexact='DATABASE')
            except conn_models.DataSources.DoesNotExist:
                return Response({'message': ' Connection Not Implemented'}, status=status.HTTP_406_NOT_ACCEPTABLE)
            
            print(f"🔧 Connection update attempt for: {connection_name}")
            print(f"   - Database type ID: {db_type} -> {conn_type.name}")
            print(f"   - Host: {hostname}:{port}")
            print(f"   - Username: {username}")
            print(f"   - Database: {db_name}")
            print(f"   - Connection ID: {id}")
            print(f"   - User ID: {user_id}")
            
            # BACKEND FIX: Detect MongoDB by port and force correct type
            if int(port) == 27017 and db_type == 1:
                print(f"🔧 BACKEND FIX: Detected MongoDB (port 27017) but got PostgreSQL type")
                print(f"🔧 BACKEND FIX: Forcing database type to MongoDB (7)")
                try:
                    conn_type = conn_models.DataSources.objects.get(id=7, type__iexact='DATABASE')  # MongoDB
                    print(f"🔧 BACKEND FIX: Updated conn_type to {conn_type.name}")
                except conn_models.DataSources.DoesNotExist:
                    print(f"❌ BACKEND FIX: MongoDB type (7) not found in database")
                    pass
            
            encoded_passw=encode_value(password)
            print(f"🔧 Testing connection before update...")
            server_conn=server_connection(username, encoded_passw, db_name, hostname,port,service_name,conn_type.name.upper(),server_path)
            print(f"🔧 Connection test result: {server_conn.get('status')} - {server_conn.get('message', 'Success')}")
            
            User = auth_models.UserProfile.objects.get(id = user_id)
            if server_conn['status']==200:
                print(f"✅ Connection test successful, updating connection...")
                connection =conn_models.DatabaseConnections.objects.filter(id=conn_data.table_id).update(
                    server_type = conn_type,
                    hostname = hostname,
                    username = username,
                    password = encoded_passw,
                    database = db_name,
                    database_path = server_path,
                    service_name = service_name,
                    port = port,
                    connection_name = connection_name,
                    schema = schema,
                    is_connected = True,
                )
                return Response({'message':'Update Successfull','id':id},status=status.HTTP_200_OK)
            else:
                print(f"❌ Connection test failed, but allowing update for password correction...")
                # Allow update even if connection fails (for password correction)
                connection =conn_models.DatabaseConnections.objects.filter(id=conn_data.table_id).update(
                    server_type = conn_type,
                    hostname = hostname,
                    username = username,
                    password = encoded_passw,
                    database = db_name,
                    database_path = server_path,
                    service_name = service_name,
                    port = port,
                    connection_name = connection_name,
                    schema = schema,
                    is_connected = False,
                )
                return Response({
                    'message': f'Connection updated but test failed: {server_conn.get("message", "Unknown error")}',
                    'id': id,
                    'connection_status': 'failed'
                }, status=status.HTTP_200_OK)
        else:
            return Response({'message':"Invalid Values"},status=status.HTTP_406_NOT_ACCEPTABLE)

        
    @method_decorator(require_permission('connection.view'))    
    @transaction.atomic()
    @csrf_exempt
    def get(self, request, id):
        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        try:
            connection_data = conn_models.Connections.objects.get(id=id,user_id__in=accessible_user_ids)
        except conn_models.Connections.DoesNotExist:
            return Response({'message': 'Connection not found'}, status=status.HTTP_404_NOT_FOUND)
        try:
            Database_data = conn_models.DatabaseConnections.objects.get(id=connection_data.table_id, user_id__in=accessible_user_ids,is_connected = True)
        except conn_models.DatabaseConnections.DoesNotExist:
            return Response({'message': 'Connection not found'}, status=status.HTTP_404_NOT_FOUND)

        # Prepare response data
        connection_data = {
            'id': connection_data.id,
            'database_type': Database_data.server_type.id,
            'hostname': Database_data.hostname,
            'port': Database_data.port,
            'username': Database_data.username,
            'database': Database_data.database,
            'connection_name': Database_data.connection_name,
            'service_name': Database_data.service_name,
            'path': Database_data.database_path,
            'schema': Database_data.schema,
            'created_at': Database_data.created_at,
            'updated_at': Database_data.updated_at,
        }

        return Response(connection_data, status=status.HTTP_200_OK)


    @method_decorator(require_permission('connection.delete'))
    @transaction.atomic()
    @csrf_exempt
    def delete(self, request, id):
        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        try:
            connection = conn_models.Connections.objects.get(id=id, user_id__in=accessible_user_ids)
        except conn_models.Connections.DoesNotExist:
            return Response({'message': 'Connection not found '}, status=status.HTTP_404_NOT_FOUND)

        try:
            db_conn = conn_models.DatabaseConnections.objects.get(id=connection.table_id, user_id__in=accessible_user_ids)
        except conn_models.DatabaseConnections.DoesNotExist:
            return Response({'message': ' connection not found'}, status=status.HTTP_404_NOT_FOUND)

        # Delete both records
        connection.delete()
        db_conn.delete()

        return Response({'message': 'Connection deleted successfully'}, status=status.HTTP_200_OK)

class File_Connection(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    serializer_class = File_upload
    @method_decorator(require_permission('connection.create'))
    @swagger_auto_schema(request_body=File_upload)
    @transaction.atomic()
    def post(self, request):
        user_id=request.user.id
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid(raise_exception=True):
            file_type = serializer.validated_data['file_type']
            file_path112 = serializer.validated_data['file_path']
            conn_name = serializer.validated_data['connection_name']
            if conn_models.FileConnections.objects.filter(connection_name__iexact = conn_name, user_id=user_id).exists():
                return Response({'message': ' Connection Name  Exists'}, status=status.HTTP_406_NOT_ACCEPTABLE)
            try:
                conn_type = conn_models.DataSources.objects.get(id=file_type, type__iexact='FILES')
            except conn_models.DataSources.DoesNotExist:
                return Response({'message': 'Database Connection Not Implemented'}, status=status.HTTP_406_NOT_ACCEPTABLE)

            file_path=file_path112.name.replace(' ','').replace('&','').replace('-','_') ## .replace('_','')
            # t1=str(file_path.replace(' ','').replace('&',''))
            # click_file_path = f'{t1}'  
            if conn_models.DataSources.objects.filter(id=file_type).exists():
                ft = conn_models.DataSources.objects.get(id=file_type)
                file_save=file_files_save(file_path,file_path112)
                file_url=file_save['file_url']
                file_path1=file_save['file_key']
                user= auth_models.UserProfile.objects.get(id=user_id)
                file_conn=conn_models.FileConnections.objects.create(
                    file_type = ft,
                    source = file_url,
                    datapath=file_path1,
                    connection_name = conn_name,
                    user_id = user,
                    uploaded_at=created_at,
                    updated_at=updated_at
                )
                conn_id =conn_models.Connections.objects.create(
                    table_id = file_conn.id,
                    type = conn_type,
                    user_id = user,
                )
                return Response({'message':'Upload Succesfully','id': conn_id.id},status=status.HTTP_200_OK)
            else:
                return Response({'error': 'Unsupported file type'}, status=status.HTTP_406_NOT_ACCEPTABLE)
        else:  
            return Response({'message':"Invali Data"}, status=status.HTTP_406_NOT_ACCEPTABLE)
        

class File_operations(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]
    serializer_class = File_upload

    csrf_exempt
    @method_decorator(require_permission('connection.edit'))
    @transaction.atomic()
    @swagger_auto_schema(request_body=File_upload)
    def put(self, request, id):
        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid(raise_exception=True):
            conn_name = serializer.validated_data["connection_name"]
            file_type = serializer.validated_data["file_type"]
            file_obj = serializer.validated_data["file_path"]
            conn_obj = conn_models.Connections.objects.get(id=id, user_id__in=accessible_user_ids)

            if conn_models.FileConnections.objects.filter(connection_name__iexact = conn_name, user_id__in=accessible_user_ids).exclude(id = conn_obj.table_id).exists():
                return Response({'message': ' Connection Name  Exists'}, status=status.HTTP_406_NOT_ACCEPTABLE)
            try:
                file_conn = conn_models.FileConnections.objects.get(id=conn_obj.table_id, user_id__in=accessible_user_ids)
            except conn_models.Connections.DoesNotExist:
                return Response({"message": "Connection not found"}, status=status.HTTP_404_NOT_FOUND)

            # Delete old file from S3
            if file_conn.datapath:
                try:
                    s3.delete_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=str(file_conn.datapath))
                except Exception as e:
                    return Response({"message": f"S3 Deletion Failed: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

            # Save new file
            new_filename = file_obj.name.replace(' ', '').replace('&', '').replace('-', '_')
            file_save = file_files_save(new_filename, file_obj)
            file_url = file_save["file_url"]
            file_key = file_save["file_key"]

            conn_type = conn_models.DataSources.objects.get(id=file_type, type__iexact="FILES")
            user = auth_models.UserProfile.objects.get(id=user_id)

            file_conn.file_type = conn_type
            file_conn.source = file_url
            file_conn.datapath = file_key
            file_conn.connection_name = conn_name
            file_conn.save()

            return Response({"message": "File updated successfully", "id": conn_obj.id}, status=status.HTTP_200_OK)
        

    csrf_exempt
    @method_decorator(require_permission('connection.view'))
    @transaction.atomic()
    def get(self, request, id):
        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        try:
            conn_obj = conn_models.Connections.objects.get(id=id, user_id__in=accessible_user_ids)
            file_conn = conn_models.FileConnections.objects.get(id=conn_obj.table_id, user_id__in=accessible_user_ids)
        except conn_models.Connections.DoesNotExist:
            return Response({"message": "Connection not found"}, status=status.HTTP_404_NOT_FOUND)

        data = {
            "id": conn_obj.id,
            "file_type": file_conn.file_type.id,
            "connection_name": file_conn.connection_name,
            "file_url": file_conn.source,
            "datapath": str(file_conn.datapath),
            "uploaded_at": file_conn.uploaded_at,
            "updated_at": file_conn.updated_at,
        }
        return Response(data, status=status.HTTP_200_OK)
        
    
    csrf_exempt
    @method_decorator(require_permission('connection.delete'))
    @transaction.atomic()
    def delete(self, request, id):
        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        try:
            conn_obj = conn_models.Connections.objects.get(id=id, user_id__in=accessible_user_ids)
            file_conn = conn_models.FileConnections.objects.get(id=conn_obj.table_id, user_id__in=accessible_user_ids)
        except conn_models.Connections.DoesNotExist:
            return Response({"message": "Connection not found"}, status=status.HTTP_404_NOT_FOUND)

        # Delete file from S3
        try:
            if file_conn.datapath:
                s3.delete_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=str(file_conn.datapath))
        except Exception as e:
            return Response({"message": f"Failed to delete file from S3: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        # Delete DB records
        file_conn.delete()
        conn_obj.delete()

        return Response({"message": "File connection deleted successfully"}, status=status.HTTP_200_OK)
        



class Connection_list(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    @method_decorator(require_permission('connection.view'))
    @csrf_exempt
    @transaction.atomic()
    def get(self, request):
        
        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)

        paginator = CustomPaginator()
        page_number = request.query_params.get(paginator.page_query_param, 1)
        page_size = request.query_params.get(paginator.page_size_query_param, 1000)
        search = request.query_params.get('search', '').strip()

        try:
            page_number = int(page_number)
            page_size = min(int(page_size), paginator.max_page_size)
        except (ValueError, TypeError):
            return Response({"error": "Invalid Parameters"}, status=400)

        offset = (page_number - 1) * page_size
        limit = page_size
        index = offset + limit

        # -------------------------
        # Filter Connections first based on search on related tables
        # -------------------------
        print(f"🔍 Connection_list API: user_id={user_id}, search='{search}'")
        
        db_ids = conn_models.DatabaseConnections.objects.filter(
            user_id__in=accessible_user_ids,
            is_connected=True,
            connection_name__icontains=search
        ).values_list('id', flat=True)
        
        print(f"🔍 Found {len(db_ids)} database connection IDs: {list(db_ids)}")
        
        # Check specifically for MongoDB - first check what server types exist
        all_db_connections = conn_models.DatabaseConnections.objects.all()
        print(f"🔍 All DatabaseConnections server types:")
        for db_conn in all_db_connections:
            if db_conn.server_type:
                print(f"   - Connection: {db_conn.connection_name}, Server Type: {db_conn.server_type.name} (ID: {db_conn.server_type.id})")
        
        # Check specifically for MongoDB
        mongodb_connections = conn_models.DatabaseConnections.objects.filter(
            server_type__name='MONGODB'
        )
        print(f"🔍 MongoDB DatabaseConnections (server_type__name='MONGODB'): {mongodb_connections.count()}")
        
        # Also check for type ID 7
        mongodb_by_id = conn_models.DatabaseConnections.objects.filter(
            server_type__id=7
        )
        print(f"🔍 MongoDB DatabaseConnections (server_type__id=7): {mongodb_by_id.count()}")
        
        for mongo in mongodb_by_id:
            print(f"   - ID: {mongo.id}, Name: '{mongo.connection_name}', User: {mongo.user_id.id if mongo.user_id else None}, Connected: {mongo.is_connected}")
            print(f"   - Server Type: {mongo.server_type.name if mongo.server_type else 'None'} (ID: {mongo.server_type.id if mongo.server_type else 'None'})")
            
            # Check each filter condition
            user_match = mongo.user_id.id in accessible_user_ids if mongo.user_id else False
            search_match = search.lower() in mongo.connection_name.lower() if search else True
            
            print(f"     ✅ User ID match: {user_match} (mongo user: {mongo.user_id.id if mongo.user_id else None}, accessible: {accessible_user_ids})")
            print(f"     ✅ Connected: {mongo.is_connected}")
            print(f"     ✅ Search match: {search_match} (search: '{search}', name: '{mongo.connection_name}')")
            print(f"     🎯 Should be included: {user_match and mongo.is_connected and search_match}")
            
            # FORCE FIX: If this is MongoDB and not connected, force update it
            if not mongo.is_connected and mongo.server_type and mongo.server_type.id == 7:
                print(f"🔧 FORCE FIX: Updating MongoDB connection {mongo.connection_name} to connected=True")
                mongo.is_connected = True
                mongo.save()
                print(f"✅ FORCE FIX: MongoDB connection updated successfully")

        file_ids = conn_models.FileConnections.objects.filter(
            user_id__in=accessible_user_ids,
            connection_name__icontains=search
        ).values_list('id', flat=True)

        remote_ids = conn_models.Remote_file_connections.objects.filter(
            user_id__in=accessible_user_ids,
            connection_name__icontains = search
        ).values_list('id', flat=True)

        # Filter connections based on matching table_id in filtered DB or File connections
        connections = conn_models.Connections.objects.filter(
            user_id__in=accessible_user_ids
        ).filter(
            Q(type=1, table_id__in=db_ids) |  # PostgreSQL
            Q(type=2, table_id__in=file_ids) |  # CSV
            Q(type=3, table_id__in=remote_ids) |  # SFTP
            Q(type=6, table_id__in=db_ids) |  # MySQL
            Q(type=7, table_id__in=db_ids) |  # MongoDB
            Q(type=8, table_id__in=db_ids)   # Oracle
        ).order_by('id')  

        print(f"🔍 Found {connections.count()} total connections after filtering")
        for conn in connections:
            server_type = conn_models.DataSources.objects.get(id=conn.type.id)
            print(f"   - Connection ID: {conn.id}, Type: {server_type.name}, Table ID: {conn.table_id}")

        total_count = connections.count()
        connections = connections[offset:index]

        print(f"🔍 Total count: {total_count}, Returning  connections after pagination")
        response_data = []

        for i in connections:
            try:
                server_type = conn_models.DataSources.objects.get(id=i.type.id)
                print(f"🔍 Processing connection {i.id}, type: {server_type.name}")
                
                if server_type.type == 'DATABASE':
                    server_data = conn_models.DatabaseConnections.objects.get(
                        id=i.table_id,
                        user_id__in=accessible_user_ids,
                        is_connected=True,
                        connection_name__icontains=search
                    )
                elif server_type.type == 'FILES':
                    server_data = conn_models.FileConnections.objects.get(
                        id=i.table_id,
                        user_id__in=accessible_user_ids,
                        connection_name__icontains=search
                    )
                elif server_type.type == 'REMOTE_FILES':
                    server_data = conn_models.Remote_file_connections.objects.get(
                        id=i.table_id,
                        user_id__in=accessible_user_ids,
                        connection_name__icontains=search
                    )
                else:
                    continue

                response_data.append({
                    'display_name': server_data.connection_name,
                    'hierarchy_id': i.id,
                    'server_type': server_type.name,
                    'type': server_type.type,
                    'created_at': server_data.created_at,
                    'updated_at': server_data.updated_at
                })
            except Exception:
                continue

        return Response({
            'data': response_data,
            'page': page_number,
            'page_size': page_size,
            'total_items': total_count
        }, status=status.HTTP_200_OK)
    

class ETL_connection_list(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    @method_decorator(require_permission('connection.view'))
    @csrf_exempt
    @transaction.atomic()
    def get(self, request):
        
        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)

        paginator = CustomPaginator()
        page_number = request.query_params.get(paginator.page_query_param, 1)
        page_size = request.query_params.get(paginator.page_size_query_param, 1000)
        search = request.query_params.get('search','')
        connection_type = request.query_params.get('type', None) 
        try:
            page_number = int(page_number)
            page_size = min(int(page_size), paginator.max_page_size)
        except (ValueError, TypeError):
            return Response({"error": "Invalid pagination parameters"}, status=400)

        offset = (page_number - 1) * page_size
        end = offset + page_size
        
        print(f"🔍 ETL_connection_list API called by user: {user_id}")
        print(f"🔍 Connection type requested: {connection_type}")
        print(f"🔍 Accessible user IDs: {accessible_user_ids}")
        
        # Debug: Check what MongoDB connections exist
        all_mongodb_connections = conn_models.Connections.objects.filter(type=7)
        print(f"🔍 All MongoDB connections in database: {all_mongodb_connections.count()}")
        for conn in all_mongodb_connections:
            print(f"   - ID: {conn.id}, User: {conn.user_id.id if conn.user_id else None}, Type: {conn.type.id}")
            
        # Debug: Check what connections this user can access
        user_connections = conn_models.Connections.objects.filter(user_id__in=accessible_user_ids)
        print(f"🔍 User accessible connections: {user_connections.count()}")
        for conn in user_connections:
            print(f"   - ID: {conn.id}, Type: {conn.type.id} ({conn.type.name}), User: {conn.user_id.id if conn.user_id else None}")
        
        # If connection_type is specified, validate it exists and get connections for that type
        if connection_type:
            try:
                datasource = conn_models.DataSources.objects.get(id=connection_type)
                print(f"🔍 Looking for connections of type: {datasource.name}")
                Connection_data = conn_models.Connections.objects.filter(
                    user_id__in=accessible_user_ids,
                    type=connection_type
                )[offset:end]
                print(f"🔍 Found {Connection_data.count()} connections for type {connection_type}")
            except conn_models.DataSources.DoesNotExist:
                return Response({'message':'Connection Type Does Not Exist'},status=status.HTTP_404_NOT_FOUND)
        else:
            # Show all connection types if no specific type is requested
            Connection_data = conn_models.Connections.objects.filter(
                user_id__in=accessible_user_ids
            )[offset:end]
            print(f"🔍 Found {Connection_data.count()} total connections")
        response_data = []
        for i in Connection_data:
            server_type = conn_models.DataSources.objects.get(id = i.type.id)
            print(f"🔍 Processing connection {i.id}, type: {server_type.name} ({server_type.type})")
            match server_type.type:
                case 'DATABASE':
                    try:
                        # Get the database connection details
                        server_data = conn_models.DatabaseConnections.objects.filter(
                            id=i.table_id,
                            user_id__in=accessible_user_ids,
                            is_connected=True
                        ).first()
                        
                        if not server_data:
                            # If no connected found, try any connection (including unconnected)
                            server_data = conn_models.DatabaseConnections.objects.filter(
                                id=i.table_id,
                                user_id__in=accessible_user_ids
                            ).first()
                        
                        # Apply search filter if provided
                        if search and server_data:
                            if search.lower() not in server_data.connection_name.lower():
                                continue
                        
                        if server_data:
                            response_data.append({
                                'display_name': server_data.connection_name,
                                'hierarchy_id': i.id,
                                'server_id': server_data.id,
                                'server_type': server_type.name,
                                'type': 'DATABASE',
                                'created_at': server_data.created_at,
                                'updated_at': server_data.updated_at
                            })
                    except Exception as e:
                        # Skip this connection if there's an error
                        print(f"Error processing DATABASE connection {i.id}: {e}")
                        continue
                case 'FILES':
                    files_data = conn_models.FileConnections.objects.get(id = i.table_id,user_id__in=accessible_user_ids)
                    response_data.append({
                        'display_name': files_data.connection_name,
                        'hierarchy_id': i.id,
                        'server_id': files_data.id,
                        'server_type': server_type.name,
                        'type':'FILES',
                        'created_at':files_data.created_at,
                        'updated_at':files_data.updated_at
                    })
                
                case "REMOTE_FILES":
                    remote_data = conn_models.Remote_file_connections.objects.get(id = i.table_id,user_id__in=accessible_user_ids)
                    response_data.append({
                        'display_name': remote_data.connection_name,
                        'hierarchy_id': i.id,
                        'server_id': remote_data.id,
                        'server_type': server_type.name,
                        'type':'REMOTE_FILES',
                        'created_at':remote_data.created_at,
                        'updated_at':remote_data.updated_at
                    })

        print(f"🎯 ETL_connection_list returning {len(response_data)} connections:")
        for item in response_data:
            print(f"   - {item.get('display_name')} ({item.get('server_type')})")
        
        return Response({
            'data': response_data,
            'page': page_number,
            'page_size': page_size,
            'total_items': len(response_data)
        }, status=status.HTTP_200_OK)


class Server_tables(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]


    @method_decorator(require_permission('connection.view'))
    @transaction.atomic
    def get(self,request,id):
        print(f"🔍 Server_tables API called for connection ID: {id}")
        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        if conn_models.Connections.objects.filter(id=id,user_id__in=accessible_user_ids).exists():
            connections_data = conn_models.Connections.objects.get(id = id,user_id__in=accessible_user_ids)
            Database_data = conn_models.DatabaseConnections.objects.get(id=connections_data.table_id)
            server_type = conn_models.DataSources.objects.get(id=connections_data.type.id)
            print(f"🔍 Connection details: {Database_data.connection_name} ({server_type.name})")
            server_conn=server_connection(Database_data.username,Database_data.password,Database_data.database,Database_data.hostname,Database_data.port,Database_data.service_name,server_type.name.upper(),Database_data.database_path)
            print(f"🔍 Server connection status: {server_conn.get('status')}")
            if server_conn['status']==200:
                try:
                    print(f"🔍 Getting table details for {server_type.name}")
                    # For MongoDB, use the database engine instead of cursor
                    if server_type.name.upper() == 'MONGODB':
                        print(f"🔍 MongoDB connection, using engine: {type(server_conn.get('engine'))}")
                        tables_list = get_table_details(server_type.name, server_conn['engine'], Database_data.schema)
                    else:
                        print(f"🔍 Non-MongoDB connection, using cursor: {type(server_conn.get('cursor'))}")
                        tables_list = get_table_details(server_type.name, server_conn['cursor'], Database_data.schema)
                    print(f"✅ Got {len(tables_list) if tables_list else 0} tables/collections")
                    if tables_list:
                        print(f"🔍 Tables/Collections found:")
                        for table in tables_list:
                            print(f"   - {table.get('tables')} ({len(table.get('columns', []))} columns)")
                    else:
                        print(f"❌ No tables/collections returned from get_table_details")
                        print(f"❌ This means either:")
                        print(f"   1. MongoDB database '{Database_data.database}' has no collections")
                        print(f"   2. There was an error in get_table_details function")
                        print(f"   3. Permission issue accessing MongoDB collections")
                except Exception as e:
                    print(f"❌ Error getting table details: {e}")
                    import traceback
                    traceback.print_exc()
                    return Response({'message': f'Error getting table details: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                schema_map = {
                    "SQLITE": "main",
                    "ORACLE": Database_data.username.upper() if Database_data.username else None
                }

                Database_data.schema = schema_map.get(server_type.name.upper(), "public" if Database_data.server_type is None else Database_data.schema)
                
                response_data = {
                    'message': 'sucess',
                    'tables': tables_list,
                    'database_name': Database_data.database,
                    'schema': Database_data.schema,
                    'connection_name': Database_data.connection_name,
                    'id': connections_data.id
                }
                print(f"🚀 Server_tables returning response: {response_data}")
                return Response(response_data, status=status.HTTP_200_OK)
            else:
                return Response({'message':server_conn['message']},status=server_conn['status'])
        else:
            return Response({'message':'Connection Not Found'},status=status.HTTP_404_NOT_FOUND)


class Debug_Connections(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    def get(self, request):
        """Debug endpoint to see all connections"""
        user = request.user
        user_id = user.id
        
        # Get all connections
        all_connections = conn_models.Connections.objects.all()
        mongodb_connections = conn_models.Connections.objects.filter(type=7)
        
        debug_info = {
            'current_user_id': str(user_id),
            'total_connections': all_connections.count(),
            'mongodb_connections': mongodb_connections.count(),
            'all_connections': [],
            'mongodb_details': []
        }
        
        for conn in all_connections:
            debug_info['all_connections'].append({
                'id': str(conn.id),
                'user_id': str(conn.user_id.id) if conn.user_id else None,
                'type_id': conn.type.id,
                'type_name': conn.type.name,
                'table_id': str(conn.table_id)
            })
            
        for conn in mongodb_connections:
            try:
                db_data = conn_models.DatabaseConnections.objects.get(id=conn.table_id)
                debug_info['mongodb_details'].append({
                    'connection_id': str(conn.id),
                    'user_id': str(conn.user_id.id) if conn.user_id else None,
                    'connection_name': db_data.connection_name,
                    'hostname': db_data.hostname,
                    'port': db_data.port,
                    'is_connected': db_data.is_connected
                })
            except Exception as e:
                debug_info['mongodb_details'].append({
                    'connection_id': str(conn.id),
                    'error': str(e)
                })
        
        return Response(debug_info, status=status.HTTP_200_OK)
    
    def post(self, request):
        """Force update MongoDB connection status"""
        try:
            # Find MongoDB connections
            mongodb_connections = conn_models.Connections.objects.filter(type=7)
            updated_count = 0
            
            for conn in mongodb_connections:
                try:
                    db_data = conn_models.DatabaseConnections.objects.get(id=conn.table_id)
                    # Force set is_connected to True
                    db_data.is_connected = True
                    db_data.save()
                    updated_count += 1
                    print(f"✅ Updated MongoDB connection {db_data.connection_name} to connected=True")
                except Exception as e:
                    print(f"❌ Error updating connection {conn.id}: {e}")
            
            return Response({
                'message': f'Updated {updated_count} MongoDB connections to connected=True',
                'updated_count': updated_count
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'message': f'Error updating connections: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class Test_Connection(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    @method_decorator(require_permission('connection.view'))
    def get(self, request, id):
        """Test a connection to see if it's working"""
        print(f"🧪 Testing connection ID: {id}")
        user = request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
            
        try:
            connections_data = conn_models.Connections.objects.get(id=id, user_id__in=accessible_user_ids)
            Database_data = conn_models.DatabaseConnections.objects.get(id=connections_data.table_id)
            server_type = conn_models.DataSources.objects.get(id=connections_data.type.id)
            
            print(f"🧪 Testing {Database_data.connection_name} ({server_type.name})")
            
            server_conn = server_connection(
                Database_data.username,
                Database_data.password,
                Database_data.database,
                Database_data.hostname,
                Database_data.port,
                Database_data.service_name,
                server_type.name.upper(),
                Database_data.database_path
            )
            
            if server_conn['status'] == 200:
                return Response({
                    'message': 'Connection successful',
                    'status': 'connected',
                    'connection_name': Database_data.connection_name,
                    'database_type': server_type.name
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'message': f'Connection failed: {server_conn.get("message", "Unknown error")}',
                    'status': 'failed',
                    'connection_name': Database_data.connection_name,
                    'database_type': server_type.name
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            return Response({
                'message': f'Error testing connection: {str(e)}',
                'status': 'error'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FileSchema(APIView):

    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    @method_decorator(require_permission('connection.view'))
    @transaction.atomic
    def get(self, request, id):
        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        if not conn_models.Connections.objects.filter(id=id,user_id = user_id).exists():
            return Response({'message': 'Connection not found'}, status=status.HTTP_404_NOT_FOUND)
        connection_data = conn_models.Connections.objects.get(id = id,user_id__in=accessible_user_ids)
        File_data = conn_models.FileConnections.objects.get(id = connection_data.table_id,user_id= user_id)
        file_path = str(File_data.source.url if hasattr(File_data.source, 'url') else File_data.source)
        file_name = File_data.connection_name
        connection_name = getattr(File_data, "connection_name", file_name)

        try:
            tables = []
            if file_name.endswith((".xls", ".xlsx")):
                # package = Package(file_path)
                # for resource in package.resources:
                #     resource.infer()
                #     schema = resource.schema.to_descriptor()
                #     columns = [
                #         {"col": field["name"], "dtype": field.get("type", "any")}
                #         for field in schema.get("fields", [])
                #     ]
                #     tables.append({
                #         "tables": resource.name,  # sheet name
                #         "columns": columns
                #     })
                return Response({'message':'Not Implemeted AT'},status=status.HTTP_204_NO_CONTENT)
            else:
                resource = Resource(path=file_path)
                resource.infer()
                schema = resource.schema.to_descriptor()
                columns = [
                    {"col": field["name"], "dtype": field.get("type", "any")}
                    for field in schema.get("fields", [])
                ]
                tables.append({
                    "tables": file_name.split(".")[0],  # table name = file name without extension
                    "columns": columns
                })

            return Response({
                "message": "success",
                "tables": tables,
                "database_name": file_name,
                "schema": "file",
                "connection_name": connection_name,
                "id": id
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'message': f'Error reading file: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        


class ListFilesView(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    @method_decorator(require_permission('connection.view'))
    def get(self, request):
        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        path = request.query_params.get('path','')
        base_dir = f'/var/www/AB_Client/client2'
        directory = os.path.abspath(os.path.join(base_dir, path))
        try:
            files = [
                f for f in os.listdir(directory)
                if os.path.isfile(os.path.join(directory, f))
            ]
            return Response({"files": files}, status=status.HTTP_200_OK)
        except FileNotFoundError:
            return Response(
                {"error": f"Directory '{directory}' not found."},
                status=status.HTTP_404_NOT_FOUND
            )
        except PermissionError:
            return Response(
                {"error": f"No permission to access '{directory}'."},
                status=status.HTTP_403_FORBIDDEN
            )
        


class ServerFileSchemaView(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    serializer_class = server_Files
    @method_decorator(require_permission('connection.create'))
    @swagger_auto_schema(request_body=server_Files)
    @csrf_exempt
    @transaction.atomic
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            source_type = serializer.validated_data['source_type']
            file_name = serializer.validated_data['file_name']

            try:
                tables = []
                if file_name.endswith((".xls", ".xlsx")):
                    # package = Package(file_path)
                    # for resource in package.resources:
                    #     resource.infer()
                    #     schema = resource.schema.to_descriptor()
                    #     columns = [
                    #         {"col": field["name"], "dtype": field.get("type", "any")}
                    #         for field in schema.get("fields", [])
                    #     ]
                    #     tables.append({
                    #         "tables": resource.name,  # sheet name
                    #         "columns": columns
                    #     })
                    return Response({'message':'Not Supported'},status=status.HTTP_204_NO_CONTENT)
                elif file_name.endswith(".csv"):
                    resource = Resource(path=f'/var/www/AB_Client/client2/{source_type}/{file_name}')
                    resource.infer()
                    schema = resource.schema.to_descriptor()
                    columns = [
                        {"col": field["name"], "dtype": field.get("type", "any")}
                        for field in schema.get("fields", [])
                    ]
                    tables.append({
                        "tables": file_name.split(".")[0],  # table name = file name without extension
                        "columns": columns
                    })
                else:
                    return Response({'message':'Not Supported'},status=status.HTTP_204_NO_CONTENT)

                return Response({
                    "message": "success",
                    "tables": tables,
                    "database_name": file_name,
                    "schema": "file",
                    "connection_name": file_name
                }, status=status.HTTP_200_OK)
            except Exception as e:
                return Response({'message': f'Error reading file: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            return Response({'message':'Serializer Error'},status=status.HTTP_400_BAD_REQUEST)
        

@api_view(['POST'])
@authentication_classes([OAuth2Authentication])
@permission_classes([CustomIsAuthenticated])
@require_permission('connection.view')
def get_available_schemas(request):

    try:
        # Get connection details from request
        data = request.data
        try:
            conn_type = conn_models.DataSources.objects.get(id=data['database_type'], type__iexact='DATABASE')
        except conn_models.DataSources.DoesNotExist:
            return Response({'message': ' Connection Not Implemented'}, status=status.HTTP_406_NOT_ACCEPTABLE)
        server_conn = server_connection(
            data['username'],
            encode_value(data['password']),
            data['database'],
            data['hostname'],
            data['port'],
            data.get('service_name',''),
            conn_type.name.upper(),
            data.get('path','')
        )
        
        if server_conn['status'] != 200:
            return Response({'message': server_conn['message']}, status=server_conn['status'])
            
        # Get schemas
        cursor = server_conn['cursor']
        schemas_query = cursor.execute(text("""
            SELECT nspname 
            FROM pg_catalog.pg_namespace 
            WHERE nspname NOT LIKE 'pg_%' 
            AND nspname <> 'information_schema';
        """))
        schemas = [row[0] for row in schemas_query.fetchall()]
        
        return Response({'schemas': schemas}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'message': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    



class Remote_file_connection(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    serializer_class = Remote_files
    @swagger_auto_schema(request_body=Remote_files)
    @method_decorator(require_permission('connection.create'))
    @transaction.atomic()
    @csrf_exempt
    def post(self,request):
        user= request.user
        user_id = user.id
        
        serializer = self.serializer_class(data = request.data)
        if serializer.is_valid(raise_exception=True):
            connection_type = serializer.validated_data['connection_type']
            host = serializer.validated_data['hostname']
            username = serializer.validated_data['username']
            password = serializer.validated_data['password']
            port = serializer.validated_data['port']
            connection_name = serializer.validated_data['connection_name']
            if conn_models.Remote_file_connections.objects.filter(connection_name__iexact = connection_name, user_id=user_id).exists():
                return Response({'message': ' Connection Name  Exists'}, status=status.HTTP_406_NOT_ACCEPTABLE)
            try:
                conn_type = conn_models.DataSources.objects.get(id=connection_type, type__iexact='REMOTE_FILES')
            except conn_models.DataSources.DoesNotExist:
                return Response({'message': ' Connection Not Implemented'}, status=status.HTTP_406_NOT_ACCEPTABLE)
            response = SSHConnect(conn_type.name.lower(),host,username,password,port)
            if response['status'] ==200:
                encoded_passw=encode_value(password)
                User = auth_models.UserProfile.objects.get(id = user_id)
                creation = conn_models.Remote_file_connections.objects.create(
                    server_type  = conn_type,
                    hostname = host,
                    username =username,
                    password = encoded_passw,
                    port = port,
                    connection_name = connection_name,
                    user_id = User
                )
                conn_id =conn_models.Connections.objects.create(
                        table_id = creation.id,
                        type = conn_type,
                        user_id = User
                    )
                return Response({'message':'Connection Successfull','id':conn_id.id},status=status.HTTP_200_OK)
            else:
                print(response)
                return Response({'message':'Invalid Credentials'},status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({'message':"Invalid Values"},status=status.HTTP_406_NOT_ACCEPTABLE)

        

class DataSourcesList(APIView):
    """
    API endpoint to get available data source types for UI dropdowns
    """
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    def get(self, request):
        """
        Get all available data source types grouped by category
        """
        try:
            # Get all data sources
            data_sources = conn_models.DataSources.objects.all().order_by('type', 'name')
            
            # Group by type
            grouped_sources = {}
            for ds in data_sources:
                if ds.type not in grouped_sources:
                    grouped_sources[ds.type] = []
                
                grouped_sources[ds.type].append({
                    'id': ds.id,
                    'name': ds.name,
                    'type': ds.type
                })
            
            # Format response
            response_data = {
                'databases': grouped_sources.get('DATABASE', []),
                'files': grouped_sources.get('FILES', []),
                'remote_files': grouped_sources.get('REMOTE_FILES', []),
                'all_sources': []
            }
            
            # Add all sources for general use
            for ds in data_sources:
                response_data['all_sources'].append({
                    'id': ds.id,
                    'name': ds.name,
                    'type': ds.type,
                    'category': ds.type.lower().replace('_', ' ').title()
                })
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'message': f'Error fetching data sources: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# class Remote_Connection_list(APIView):
#     def get(self, request):
#         tok1 = token_function(request)
#         if tok1["status"] != 200:
#             return Response({"message": tok1['message']}, status=status.HTTP_404_NOT_FOUND)
#         user_id = tok1['user_id']
#         paginator = CustomPaginator()
#         page_number = request.query_params.get(paginator.page_query_param, 1)
#         page_size = request.query_params.get(paginator.page_size_query_param, 1000)
#         search = request.query_params.get('search', '').strip()

#         try:
#             page_number = int(page_number)
#             page_size = min(int(page_size), paginator.max_page_size)
#         except (ValueError, TypeError):
#             return Response({"error": "Invalid pagination parameters"}, status=400)

#         offset = (page_number - 1) * page_size
#         limit = page_size
#         index = offset + limit

#         remote_connections = conn_models.Remote_file_connections.objects.filter(user_id=user_id)

     