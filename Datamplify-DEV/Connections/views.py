from rest_framework.views import APIView
from rest_framework.decorators import api_view,authentication_classes,permission_classes
from django.db import transaction
from django.views.decorators.csrf import csrf_exempt
from .serializers import ServerConnect,File_upload,server_Files,Remote_files
from Connections import models as conn_models
from authentication import models as auth_models
from rest_framework.response import Response
from rest_framework import status
from Service.utils import encode_value,file_files_save,CustomPaginator,s3,SSHConnect,encrypt_json,decrypt_json
from Connections.utils import server_connection,get_table_details,discover_endpoint_schema
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
            conn_data = conn_models.Connections.objects.get(id=id,user_id__in = accessible_user_ids)
            if conn_models.DatabaseConnections.objects.filter(connection_name__iexact = connection_name, user_id__in=accessible_user_ids).exclude(id=conn_data.table_id).exists():
                return Response({'message': ' Connection Name  Exists'}, status=status.HTTP_406_NOT_ACCEPTABLE)
            try:
                conn_type = conn_models.DataSources.objects.get(id=db_type, type__iexact='DATABASE')
            except conn_models.DataSources.DoesNotExist:
                return Response({'message': ' Connection Not Implemented'}, status=status.HTTP_406_NOT_ACCEPTABLE)
            
            encoded_passw=encode_value(password)
            server_conn=server_connection(username, encoded_passw, db_name, hostname,port,service_name,conn_type.name.upper(),server_path)
            User = auth_models.UserProfile.objects.get(id = user_id)
            if server_conn['status']==200:
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
                )
                return Response({'message':'Update Successfull','id':id},status=status.HTTP_200_OK)
            else:
                return Response({'message':server_conn['message']},status=status.HTTP_400_BAD_REQUEST)
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
            selected_sheets = serializer.validated_data.get('selected_sheets', [])
            sheet_relationships = serializer.validated_data.get('sheet_relationships', {})
            
            if conn_models.FileConnections.objects.filter(connection_name__iexact = conn_name, user_id=user_id).exists():
                return Response({'message': ' Connection Name  Exists'}, status=status.HTTP_406_NOT_ACCEPTABLE)
            try:
                conn_type = conn_models.DataSources.objects.get(id=file_type, type__iexact='FILES')
            except conn_models.DataSources.DoesNotExist:
                return Response({'message': 'File Connection Type Not Found. Available CSV ID=2, EXCEL ID=28'}, status=status.HTTP_406_NOT_ACCEPTABLE)

            file_path=file_path112.name.replace(' ','').replace('&','').replace('-','_') ## .replace('_','')
            
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
                    updated_at=updated_at,
                    selected_sheets=selected_sheets if selected_sheets else [],
                    sheet_relationships=sheet_relationships if sheet_relationships else {}
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
            return Response({'message':"Invalid Data"}, status=status.HTTP_406_NOT_ACCEPTABLE)
        

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
            selected_sheets = serializer.validated_data.get('selected_sheets', [])
            sheet_relationships = serializer.validated_data.get('sheet_relationships', {})
            
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

            # Validate Excel file has sheet selection if it's an Excel file
            if conn_type.name.upper() == 'EXCEL':
                if not selected_sheets or len(selected_sheets) == 0:
                    return Response({'message': 'Excel files require at least one sheet to be selected'}, status=status.HTTP_406_NOT_ACCEPTABLE)

            file_conn.file_type = conn_type
            file_conn.source = file_url
            file_conn.datapath = file_key
            file_conn.connection_name = conn_name
            file_conn.selected_sheets = selected_sheets if selected_sheets else []
            file_conn.sheet_relationships = sheet_relationships if sheet_relationships else {}
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
            "selected_sheets": file_conn.selected_sheets or [],
            "sheet_relationships": file_conn.sheet_relationships or {}
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
        

from django.db.models import Q, Exists, OuterRef


# class Connection_list(APIView):
#     authentication_classes = [OAuth2Authentication]
#     permission_classes = [CustomIsAuthenticated]

#     @method_decorator(require_permission('connection.view'))
#     @csrf_exempt
#     @transaction.atomic()
#     def get(self, request):
        
#         user= request.user
#         user_id = user.id
#         accessible_user_ids = [user_id]
#         if hasattr(user, 'created_by') and user.created_by:
#             accessible_user_ids.append(user.created_by.id)

#         paginator = CustomPaginator()
#         page_number = request.query_params.get(paginator.page_query_param, 1)
#         page_size = request.query_params.get(paginator.page_size_query_param, 1000)
#         search = request.query_params.get('search', '').strip()

#         try:
#             page_number = int(page_number)
#             page_size = min(int(page_size), paginator.max_page_size)
#         except (ValueError, TypeError):
#             return Response({"error": "Invalid Parameters"}, status=400)

#         offset = (page_number - 1) * page_size
#         limit = page_size
#         index = offset + limit

#         # -------------------------
#         # Filter Connections first based on search on related tables
#         # -------------------------
#         db_ids = conn_models.DatabaseConnections.objects.filter(
#             user_id__in=accessible_user_ids,
#             is_connected=True,
#             connection_name__icontains=search
#         ).values_list('id', flat=True)

#         file_ids = conn_models.FileConnections.objects.filter(
#             user_id__in=accessible_user_ids,
#             connection_name__icontains=search
#         ).values_list('id', flat=True)

#         remote_ids = conn_models.Remote_file_connections.objects.filter(
#             user_id__in=accessible_user_ids,
#             connection_name__icontains = search
#         ).values_list('id', flat=True)

#         integration_ids = conn_models.Integrations.objects.filter(
#             connection_name__icontains = search
#         ).values_list('id', flat=True)
#         # Filter connections based on matching table_id in filtered DB or File connections
#         connections = conn_models.Connections.objects.filter(
#             user_id__in=accessible_user_ids
#         ).filter(
#             Q(type=1, table_id__in=db_ids) |
#             Q(type=2, table_id__in=file_ids) |
#             Q(type=3,table_id__in=remote_ids) |
#             Q(type=6,table_id__in=db_ids) |
#             Q(type=7,table_id__in=db_ids) |
#             Q(type=8,table_id__in=db_ids) |
#             Q(type=9,table_id__in=db_ids) |
#             Q(type=10,table_id__in =db_ids)|
#             Q(type=11,table_id__in=integration_ids) |
#             Q(type=12,table_id__in=integration_ids) |
#             Q(type=13,table_id__in = integration_ids)|Q(type=14,table_id__in = integration_ids)|Q(type=15,table_id__in = integration_ids)|Q(type=16,table_id__in = integration_ids)|Q(type=17,table_id__in = integration_ids)|Q(type=18,table_id__in = integration_ids)|Q(type=19,table_id__in = integration_ids)|
#             Q(type=20,table_id__in = integration_ids)|Q(type=21,table_id__in = integration_ids)|Q(type=22,table_id__in = integration_ids)|Q(type=23,table_id__in = integration_ids)|Q(type=24,table_id__in = integration_ids)|Q(type=25,table_id__in = integration_ids)|Q(type=26,table_id__in = integration_ids)|
#             Q(type=27,table_id__in = integration_ids)
#         ).order_by('id')  

#         total_count = connections.count()
#         connections = connections[offset:index]

#         response_data = []

#         for i in connections:
#             server_type = conn_models.DataSources.objects.get(id=i.type.id)
#             try:
#                 if server_type.type == 'DATABASE':
#                     server_data = conn_models.DatabaseConnections.objects.get(
#                         id=i.table_id,
#                         user_id__in=accessible_user_ids,
#                         is_connected=True,
#                         connection_name__icontains=search
#                     )
#                 elif server_type.type == 'FILES':
#                     server_data = conn_models.FileConnections.objects.get(
#                         id=i.table_id,
#                         user_id__in=accessible_user_ids,
#                         connection_name__icontains=search
#                     )
#                 elif server_type.type == 'REMOTE_FILES':
#                     server_data = conn_models.Remote_file_connections.objects.get(
#                         id=i.table_id,
#                         user_id__in=accessible_user_ids,
#                         connection_name__icontains=search
#                     )
#                 elif server_type.type == 'INTEGRATIONS':
#                     server_data = conn_models.Integrations.objects.get(
#                         id=i.table_id,
#                         connection_name__icontains=search
#                     )
#                 else:
#                     continue

#                 response_data.append({
#                     'display_name': server_data.connection_name,
#                     'hierarchy_id': i.id,
#                     'server_type': server_type.name,
#                     'type_id':server_type.id,
#                     'type': server_type.type,
#                     'created_at': server_data.created_at,
#                     'updated_at': server_data.updated_at
#                 })
#             except Exception:
#                 continue

#         return Response({
#             'data': response_data,
#             'page': page_number,
#             'page_size': page_size,
#             'total_items': total_count
#         }, status=status.HTTP_200_OK)
    

class Connection_list(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    @method_decorator(require_permission('connection.view'))
    @transaction.atomic()
    def get(self, request):
        user = request.user
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
        limit = offset + page_size

        # ------------------------------------------------------------------
        # EXISTS subqueries (NO ID PREFETCH)
        # ------------------------------------------------------------------

        db_qs = conn_models.DatabaseConnections.objects.filter(
            id=OuterRef('table_id'),
            user_id__in=accessible_user_ids,
            is_connected=True
        )
        file_qs = conn_models.FileConnections.objects.filter(
            id=OuterRef('table_id'),
            user_id__in=accessible_user_ids
        )
        remote_qs = conn_models.Remote_file_connections.objects.filter(
            id=OuterRef('table_id'),
            user_id__in=accessible_user_ids
        )
        integration_qs = conn_models.Integrations.objects.filter(
            id=OuterRef('table_id')
        )

        if search:
            db_qs = db_qs.filter(connection_name__icontains=search)
            file_qs = file_qs.filter(connection_name__icontains=search)
            remote_qs = remote_qs.filter(connection_name__icontains=search)
            integration_qs = integration_qs.filter(connection_name__icontains=search)

        # ------------------------------------------------------------------
        # Main optimized Connections query
        # ------------------------------------------------------------------

        connections_qs = (
            conn_models.Connections.objects
            .filter(user_id__in=accessible_user_ids)
            .annotate(
                has_db=Exists(db_qs),
                has_file=Exists(file_qs),
                has_remote=Exists(remote_qs),
                has_integration=Exists(integration_qs),
            )
            .filter(
                Q(type=2, has_file=True) |
                Q(type=3, has_remote=True) |
                Q(type__in=[1,6, 7, 8, 9, 10], has_db=True) |
                Q(type__in=range(11, 28), has_integration=True)
            )
            .order_by('id')
        )

        total_count = connections_qs.count()
        connections = list(connections_qs[offset:limit])

        if not connections:
            return Response({
                'data': [],
                'page': page_number,
                'page_size': page_size,
                'total_items': total_count
            }, status=status.HTTP_200_OK)

        # ------------------------------------------------------------------
        # Bulk fetch DataSources
        # ------------------------------------------------------------------

        type_ids = {c.type_id for c in connections}
        data_sources_map = {
            ds.id: ds
            for ds in conn_models.DataSources.objects.filter(id__in=type_ids)
        }

        # ------------------------------------------------------------------
        # Bulk fetch connection tables ONLY for paginated rows
        # ------------------------------------------------------------------

        table_ids = {c.table_id for c in connections}

        db_map = {
            d.id: d for d in conn_models.DatabaseConnections.objects.filter(id__in=table_ids)
        }
        file_map = {
            f.id: f for f in conn_models.FileConnections.objects.filter(id__in=table_ids)
        }
        remote_map = {
            r.id: r for r in conn_models.Remote_file_connections.objects.filter(id__in=table_ids)
        }
        integration_map = {
            i.id: i for i in conn_models.Integrations.objects.filter(id__in=table_ids)
        }

        # ------------------------------------------------------------------
        # Build response (UNCHANGED FORMAT)
        # ------------------------------------------------------------------

        response_data = []

        for conn in connections:
            server_type = data_sources_map.get(conn.type_id)
            if not server_type:
                continue

            if server_type.type == 'DATABASE':
                server_data = db_map.get(conn.table_id)
            elif server_type.type == 'FILES':
                server_data = file_map.get(conn.table_id)
            elif server_type.type == 'REMOTE_FILES':
                server_data = remote_map.get(conn.table_id)
            elif server_type.type == 'INTEGRATIONS':
                server_data = integration_map.get(conn.table_id)
            else:
                continue

            if not server_data:
                continue

            response_data.append({
                'display_name': server_data.connection_name,
                'hierarchy_id': conn.id,
                'server_type': server_type.name,
                'type_id': server_type.id,
                'type': server_type.type,
                'created_at': server_data.created_at,
                'updated_at': server_data.updated_at
            })

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
        connection_type = request.query_params.get('type',1) 
        try:
            page_number = int(page_number)
            page_size = min(int(page_size), paginator.max_page_size)
        except (ValueError, TypeError):
            return Response({"error": "Invalid pagination parameters"}, status=400)

        offset = (page_number - 1) * page_size
        limit = page_size
        index=int((offset + limit) / 2)
        try:
            conn_models.DataSources.objects.get(id=connection_type)
        except:
            return Response({'message':'Connection Type Does Not Exist'},status=status.HTTP_404_NOT_FOUND)

        Connection_data = conn_models.Connections.objects.filter(user_id__in=accessible_user_ids,type =connection_type)[offset:index]
        response_data = []
        for i in Connection_data:
            server_type = conn_models.DataSources.objects.get(id = i.type.id)
            match server_type.type:
                case 'DATABASE':
                    server_data = conn_models.DatabaseConnections.objects.get(id = i.table_id,user_id__in=accessible_user_ids,is_connected=True,connection_name__icontains = search)
                    response_data.append({
                        'display_name': server_data.connection_name,
                        'hierarchy_id': i.id,
                        'server_id': server_data.id,
                        'server_type': server_type.name,
                        'type':'SERVER',
                        'created_at':server_data.created_at,
                        'updated_at':server_data.updated_at
                    })
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
                
                case "INTEGRATIONS":
                    integration_data = conn_models.Integrations.objects.get(id = i.table_id)
                    response_data.append({
                        'display_name': integration_data.connection_name,
                        'hierarchy_id': i.id,
                        'server_id': integration_data.id,
                        'server_type': server_type.name,
                        'type':'INTEGRATIONS',
                        'created_at':integration_data.created_at,
                        'updated_at':integration_data.updated_at
                    })

                case _:
                    return Response({'message':'Unspported Source'},status=status.HTTP_404_NOT_FOUND)
        response_data = {
             'data':response_data,
             'page': page_number,
            'page_size': page_size
        }
        return Response(response_data, status=status.HTTP_200_OK)



class Server_tables(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]


    @method_decorator(require_permission('connection.view'))
    @transaction.atomic
    def get(self,request,id):
        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        if conn_models.Connections.objects.filter(id=id,user_id__in=accessible_user_ids).exists():
            connections_data = conn_models.Connections.objects.get(id = id,user_id__in=accessible_user_ids)
            Database_data = conn_models.DatabaseConnections.objects.get(id=connections_data.table_id)
            server_type = conn_models.DataSources.objects.get(id=connections_data.type.id)
            server_conn=server_connection(Database_data.username,Database_data.password,Database_data.database,Database_data.hostname,Database_data.port,Database_data.service_name,server_type.name.upper(),Database_data.database_path)
            if server_conn['status']==200:
                tables_list = get_table_details(server_type.name,server_conn['cursor'],Database_data.schema)
                schema_map = {
                    "SQLITE": "main",
                    "ORACLE": Database_data.username.upper() if Database_data.username else None
                }

                Database_data.schema = schema_map.get(server_type.name.upper(), "public" if Database_data.server_type is None else Database_data.schema)
                return Response({'message':'sucess','tables':tables_list,'database_name':Database_data.database,'schema':Database_data.schema,'connection_name':Database_data.connection_name,'id':connections_data.id},status = status.HTTP_200_OK)
            else:
                return Response({'message':server_conn['message']},status=server_conn['status'])
        else:
            return Response({'message':'Connection Not Found'},status=status.HTTP_404_NOT_FOUND)
        
        


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
        file_path_str = str(File_data.datapath) if hasattr(File_data, 'datapath') else file_path
        file_name = File_data.connection_name
        connection_name = getattr(File_data, "connection_name", file_name)

        print(f"[FileSchema] Connection ID: {id}")
        print(f"[FileSchema] File name: {file_name}")
        print(f"[FileSchema] File path: {file_path}")
        print(f"[FileSchema] File path str (datapath): {file_path_str}")

        try:
            tables = []
            if file_path_str.endswith((".xls", ".xlsx")):
                # Handle Excel files with sheet selection
                import pandas as pd
                import boto3
                import io
                from botocore.exceptions import ClientError
                import traceback
                
                selected_sheets = File_data.selected_sheets or []
                print(f"[FileSchema] Selected sheets from DB: {selected_sheets}")
                
                if not selected_sheets or len(selected_sheets) == 0:
                    return Response({'message': 'No sheets selected for this Excel file'}, status=status.HTTP_400_BAD_REQUEST)
                
                # Download file from S3
                try:
                    # Create S3 client with explicit credentials from Django settings
                    s3 = boto3.client(
                        's3',
                        aws_access_key_id=settings.AWS_S3_ACCESS_KEY_ID,
                        aws_secret_access_key=settings.AWS_S3_SECRET_ACCESS_KEY,
                        region_name=settings.AWS_S3_REGION_NAME
                    )
                    
                    # Extract bucket and key from the URL
                    # file_path format: https://haskmedia.s3.amazonaws.com/Datamplify/files/...
                    # or: https://datamplify.s3.amazonaws.com/Datamplify/files/...
                    if 'haskmedia.s3.amazonaws.com' in file_path:
                        bucket_name = 'haskmedia'
                        s3_key = file_path.replace('https://haskmedia.s3.amazonaws.com/', '')
                    elif 'datamplify.s3.amazonaws.com' in file_path:
                        bucket_name = 'datamplify'
                        s3_key = file_path.replace('https://datamplify.s3.amazonaws.com/', '')
                    else:
                        # Fallback: use datapath as key
                        bucket_name = 'haskmedia'
                        s3_key = file_path_str
                    
                    print(f"[FileSchema] Downloading from S3: bucket={bucket_name}, key={s3_key}")
                    response = s3.get_object(Bucket=bucket_name, Key=s3_key)
                    file_content = response['Body'].read()
                    file_obj = io.BytesIO(file_content)
                    print(f"[FileSchema] File downloaded successfully, size: {len(file_content)} bytes")
                except ClientError as e:
                    print(f"[FileSchema] S3 download error: {str(e)}")
                    traceback.print_exc()
                    return Response({
                        'message': f'Error downloading file from S3: {str(e)}'
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                except Exception as e:
                    print(f"[FileSchema] Unexpected error during S3 download: {str(e)}")
                    traceback.print_exc()
                    return Response({
                        'message': f'Unexpected error downloading file: {str(e)}'
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
                # Read Excel file and extract schema for selected sheets
                for sheet_name in selected_sheets:
                    print(f"[FileSchema] Processing sheet: {sheet_name}")
                    try:
                        # Read only first few rows to infer schema
                        df = pd.read_excel(file_obj, sheet_name=sheet_name, nrows=100)
                        file_obj.seek(0)  # Reset file pointer for next sheet
                        
                        # Infer column types
                        columns = []
                        for col in df.columns:
                            dtype = str(df[col].dtype)
                            
                            # Map pandas dtypes to generic types
                            if 'int' in dtype:
                                col_type = 'integer'
                            elif 'float' in dtype:
                                col_type = 'number'
                            elif 'datetime' in dtype:
                                col_type = 'datetime'
                            elif 'bool' in dtype:
                                col_type = 'boolean'
                            else:
                                col_type = 'string'
                            
                            columns.append({
                                "col": str(col),
                                "dtype": col_type
                            })
                        
                        tables.append({
                            "tables": sheet_name,
                            "columns": columns
                        })
                        print(f"[FileSchema] Added sheet '{sheet_name}' with {len(columns)} columns to tables")
                    except Exception as e:
                        print(f"[FileSchema] Error reading sheet '{sheet_name}': {str(e)}")
                        import traceback
                        traceback.print_exc()
                        return Response({
                            'message': f'Error reading sheet "{sheet_name}": {str(e)}'
                        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
            else:
                # Handle CSV files
                print(f"[FileSchema] Processing as CSV file")
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

            print(f"[FileSchema] Returning {len(tables)} tables")
            for i, table in enumerate(tables):
                print(f"[FileSchema] Table {i}: name='{table['tables']}', columns={len(table['columns'])}")

            return Response({
                "message": "success",
                "tables": tables,
                "database_name": file_name,
                "schema": "file",
                "connection_name": connection_name,
                "id": id,
                "sheet_relationships": File_data.sheet_relationships or {}
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'message': f'Error reading file: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        


class ExcelSheetList(APIView):
    """
    API endpoint to list all available sheets in an uploaded Excel file
    """
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    @method_decorator(require_permission('connection.view'))
    @transaction.atomic
    def get(self, request, id):
        user = request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        
        try:
            connection_data = conn_models.Connections.objects.get(id=id, user_id__in=accessible_user_ids)
            file_data = conn_models.FileConnections.objects.get(id=connection_data.table_id, user_id__in=accessible_user_ids)
        except conn_models.Connections.DoesNotExist:
            return Response({'message': 'Connection not found'}, status=status.HTTP_404_NOT_FOUND)
        except conn_models.FileConnections.DoesNotExist:
            return Response({'message': 'File connection not found'}, status=status.HTTP_404_NOT_FOUND)
        
        file_name = file_data.connection_name
        
        # Check if it's an Excel file by checking the datapath (actual filename)
        file_path_str = str(file_data.datapath)
        if not file_path_str.endswith(('.xls', '.xlsx')):
            return Response({'message': 'This endpoint only works with Excel files'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            import pandas as pd
            import io
            import boto3
            
            # Download file from S3 using datapath (S3 key)
            s3_key = str(file_data.datapath)
            
            try:
                # Create S3 client with explicit credentials from Django settings
                s3_client = boto3.client(
                    's3',
                    aws_access_key_id=settings.AWS_S3_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_S3_SECRET_ACCESS_KEY,
                    region_name=settings.AWS_S3_REGION_NAME
                )
                
                # Get file object from S3
                file_obj = s3_client.get_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=s3_key)
                file_content = file_obj['Body'].read()
                
                # Read Excel file from bytes
                excel_file = pd.ExcelFile(io.BytesIO(file_content))
                sheet_names = excel_file.sheet_names
                
            except Exception as s3_error:
                import traceback
                error_details = traceback.format_exc()
                return Response({
                    'message': f'Error downloading file from S3: {str(s3_error)}',
                    'details': error_details,
                    's3_key': s3_key,
                    'bucket': settings.AWS_STORAGE_BUCKET_NAME
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # Get currently selected sheets
            selected_sheets = file_data.selected_sheets or []
            sheet_relationships = file_data.sheet_relationships or {}
            
            return Response({
                'message': 'success',
                'available_sheets': sheet_names,
                'selected_sheets': selected_sheets,
                'sheet_relationships': sheet_relationships,
                'connection_id': id,
                'connection_name': file_name
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            return Response({
                'message': f'Error reading Excel file: {str(e)}',
                'details': error_details
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @method_decorator(require_permission('connection.update'))
    @transaction.atomic
    def put(self, request, id):
        """
        Update the selected sheets for an Excel file connection
        """
        user = request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        
        print(f"[ExcelSheetList PUT] Connection ID: {id}")
        print(f"[ExcelSheetList PUT] Request data: {request.data}")
        
        try:
            connection_data = conn_models.Connections.objects.get(id=id, user_id__in=accessible_user_ids)
            file_data = conn_models.FileConnections.objects.get(id=connection_data.table_id, user_id__in=accessible_user_ids)
        except conn_models.Connections.DoesNotExist:
            return Response({'message': 'Connection not found'}, status=status.HTTP_404_NOT_FOUND)
        except conn_models.FileConnections.DoesNotExist:
            return Response({'message': 'File connection not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Get selected sheets from request
        selected_sheets = request.data.get('selected_sheets', [])
        print(f"[ExcelSheetList PUT] Selected sheets to save: {selected_sheets}")
        
        if not isinstance(selected_sheets, list):
            return Response({'message': 'selected_sheets must be a list'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Update the file connection with selected sheets
        file_data.selected_sheets = selected_sheets
        file_data.save()
        
        print(f"[ExcelSheetList PUT] Saved successfully. Verifying: {file_data.selected_sheets}")
        
        return Response({
            'message': 'Selected sheets updated successfully',
            'selected_sheets': selected_sheets,
            'connection_id': id
        }, status=status.HTTP_200_OK)


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
        match conn_type.name.lower():
            case 'postgresql':
                
                schemas_query = cursor.execute(text("""
                    SELECT nspname 
                    FROM pg_catalog.pg_namespace 
                    WHERE nspname NOT LIKE 'pg_%' 
                    AND nspname <> 'information_schema';
                """))
            case 'snowflake':
                schemas_query = cursor.execute(text(""" 
                    SELECT
                        SCHEMA_NAME
                    FROM INFORMATION_SCHEMA.SCHEMATA
                    ORDER BY SCHEMA_NAME;

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
                return Response({'message':'Invalid Credentials'},status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({'message':"Invalid Values"},status=status.HTTP_406_NOT_ACCEPTABLE)
        
    
class Remote_operations(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    serializer_class = Remote_files
    @swagger_auto_schema(request_body=Remote_files)
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
            connection_type = serializer.validated_data['connection_type']
            host = serializer.validated_data['hostname']
            username = serializer.validated_data['username']
            password = serializer.validated_data['password']
            port = serializer.validated_data['port']
            connection_name = serializer.validated_data['connection_name']
            conn_obj = conn_models.Connections.objects.get(id=id, user_id__in=accessible_user_ids)

            if conn_models.Remote_file_connections.objects.filter(connection_name__iexact = connection_name, user_id__in=accessible_user_ids).exclude(id=conn_obj.table_id).exists():
                return Response({'message': ' Connection Name  Exists'}, status=status.HTTP_406_NOT_ACCEPTABLE)
            try:
                remote_conn = conn_models.Remote_file_connections.objects.get(id=conn_obj.table_id, user_id__in=accessible_user_ids)
            except conn_models.Connections.DoesNotExist:
                return Response({"message": "Connection not found"}, status=status.HTTP_404_NOT_FOUND)

            try:
                conn_type = conn_models.DataSources.objects.get(id=connection_type, type__iexact='REMOTE_FILES')
            except conn_models.DataSources.DoesNotExist:
                return Response({'message': ' Connection Not Implemented'}, status=status.HTTP_406_NOT_ACCEPTABLE)
            response = SSHConnect(conn_type.name.lower(),host,username,password,port)
            if response['status'] ==200:
                encoded_passw=encode_value(password)
                User = auth_models.UserProfile.objects.get(id = user_id)
                remote_conn.hostname = host
                remote_conn.username =username
                remote_conn.password = encoded_passw
                remote_conn.port = port
                remote_conn.connection_name = connection_name
                remote_conn.save()
                return Response({'message':'Update Successfull','id':id},status=status.HTTP_200_OK)
            else:
                return Response({'message':'Invalid Credentials'},status=status.HTTP_400_BAD_REQUEST)
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
            remote_conn = conn_models.Remote_file_connections.objects.get(id=connection_data.table_id, user_id__in=accessible_user_ids)
        except conn_models.Connections.DoesNotExist:
                return Response({"message": "Connection not found"}, status=status.HTTP_404_NOT_FOUND)
        
        connection_data = {
            'id': connection_data.id,
            'database_type': remote_conn.server_type.id,
            'hostname': remote_conn.hostname,
            'port': remote_conn.port,
            'username': remote_conn.username,
            'connection_name': remote_conn.connection_name,
            'created_at': remote_conn.created_at,
            'updated_at': remote_conn.updated_at
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
            remote_conn = conn_models.Remote_file_connections.objects.get(id=connection.table_id, user_id__in=accessible_user_ids)
        except conn_models.Connections.DoesNotExist:
            return Response({"message": "Connection not found"}, status=status.HTTP_404_NOT_FOUND)

        # Delete both records
        connection.delete()
        remote_conn.delete()

        return Response({'message': 'Connection deleted successfully'}, status=status.HTTP_200_OK)



    


        
    
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

     

##################33333333333 integrations ############################3





# integrations/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from Integration_controller import IntegrationAuthOrchestrator


class IntegrationAuthView(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    # @method_decorator(require_permission('connection.edit'))
    @transaction.atomic()
    @csrf_exempt
    def post(self, request, type):

        payload = request.data.get("payload")
        if not payload:
            return Response(
                {"message": "payload is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if conn_models.Integrations.objects.filter(connection_name__iexact = payload['display_name']).exists():
            return Response({'message': ' Connection Name  Exists'}, status=status.HTTP_406_NOT_ACCEPTABLE)

        try:
            Datasource = conn_models.DataSources.objects.get(name=type.upper(),type='INTEGRATIONS')
        except Exception as e:
            return Response({'message':'Invalid Integration'},status=status.HTTP_400_BAD_REQUEST)

        orchestrator = IntegrationAuthOrchestrator()

        try:
            result = orchestrator.authenticate(
                integration_type=type,
                payload=payload,
            )
        except ValueError as exc:
            return Response(
                {"connected": False, "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        integration_id = conn_models.Integrations.objects.create(
            integration_type = type,
            site_url = result['credentials']['credentials'].get('site_url',None),
            credentials = encrypt_json(result['credentials']['credentials']),
            token_metadata = encrypt_json(result['credentials'].get('token_metadata',{})),
            is_active = True,
            connection_name = payload['display_name']
        )
        User = auth_models.UserProfile.objects.get(id=request.user.id)
        hierarchy_id = conn_models.Connections.objects.create(table_id = integration_id.id,user_id = User,type=Datasource)

        return Response({'message':'connected','id':hierarchy_id.id}, status=status.HTTP_200_OK)
    
class IntegrationOperations(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    @transaction.atomic()
    @csrf_exempt
    def put(self, request, id):
        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        
        try:
            conn_data = conn_models.Connections.objects.get(id=id,user_id__in =accessible_user_ids)
        except Exception as e:
            return Response({"message":"Connection Not Found"},status=status.HTTP_404_NOT_FOUND)    

        payload = request.data.get("payload")
        if not payload:
            return Response(
                {"message": "payload is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # if conn_models.Integrations.objects.filter(connection_name__iexact = payload['display_name']).exclude(id=conn_data.table_id).exists():
        #     return Response({'message': ' Connection Name  Exists'}, status=status.HTTP_406_NOT_ACCEPTABLE)

        try:
            Datasource = conn_models.DataSources.objects.get(name=conn_data.type.name.upper(),type='INTEGRATIONS')
        except Exception as e:
            return Response({'message':'Invalid Integration'},status=status.HTTP_400_BAD_REQUEST)

        orchestrator = IntegrationAuthOrchestrator()

        try:
            result = orchestrator.authenticate(
                integration_type=conn_data.type.name.lower(),
                payload=payload,
            )
        except ValueError as exc:
            return Response(
                {"connected": False, "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        integration_id = conn_models.Integrations.objects.filter(id = conn_data.table_id).update(
            site_url = result['credentials']['credentials'].get('site_url',None),
            credentials = encrypt_json(result['credentials']['credentials']),
            token_metadata = encrypt_json(result['credentials'].get('token_metadata',{})),
            is_active = True,
            updated_at = updated_at)
        return Response({'message':'connected','id':id}, status=status.HTTP_200_OK)


    def get(self,request,id):
        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        try:
            connection_data = conn_models.Connections.objects.get(id=id,user_id__in=accessible_user_ids)
        except conn_models.Connections.DoesNotExist:
            return Response({'message': 'Connection not found'}, status=status.HTTP_404_NOT_FOUND)
        
        integration_conn = conn_models.Integrations.objects.get(id=connection_data.table_id)
        credentials = decrypt_json(integration_conn.credentials)
        credentials.pop('client_secret',None)
        credentials.pop('api_token',None)
        credentials.pop('private_key',None)
        credentials.pop('api_key', None)
        data = {
            "integration_type":integration_conn.integration_type,
            "connection_name":integration_conn.connection_name,
            "site_url":integration_conn.site_url,
            "credentials":credentials,
            "id":id
        }
        return Response(data,status=status.HTTP_200_OK)
    
    @transaction.atomic()
    @csrf_exempt
    def delete(self,request,id):
        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        try:
            connection = conn_models.Connections.objects.get(id=id, user_id__in=accessible_user_ids)
        except conn_models.Connections.DoesNotExist:
            return Response({'message': 'Connection not found '}, status=status.HTTP_404_NOT_FOUND)
        integration_conn = conn_models.Integrations.objects.get(id=connection.table_id)
        connection.delete()
        integration_conn.delete()
        return Response({'message':"Deleted sucessfully"},status=status.HTTP_200_OK)


from integration_injection import (NinjaClient,HalopsaClient,ZohoClient,TallyClient,JiraClient,BambooHrClient,Pax8Client,DbtClient,SalesforceClient,QuickbooksClient,GoogleSheetClient,
                    ShopifyClient,GoogleAnalyticClient,HubSpotClient,HubspotClientToken)


class Integration_schema(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    # @method_decorator(require_permission('connection.edit'))
    @transaction.atomic()
    @csrf_exempt

    def post(self,request):
        id = request.data.get('id')
        endpoint = request.data.get('endpoint')
        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        if conn_models.Connections.objects.filter(id=id,user_id__in=accessible_user_ids).exists():
            connections_data = conn_models.Connections.objects.get(id = id,user_id__in=accessible_user_ids)
            Integration_data = conn_models.Integrations.objects.get(id=connections_data.table_id)
            integration_type = conn_models.DataSources.objects.get(id = connections_data.type.id).name
            if integration_type.lower()=='ninja':
                client = NinjaClient(decrypt_json(Integration_data.token_metadata),decrypt_json(Integration_data.credentials),Integration_data.id) 
            elif integration_type.lower()=='halopsa':
                client = HalopsaClient(decrypt_json(Integration_data.token_metadata),decrypt_json(Integration_data.credentials),Integration_data.id)
            elif integration_type.lower() in ['zoho_crm','zoho_books','zoho_inventory']:
                client = ZohoClient(decrypt_json(Integration_data.token_metadata),decrypt_json(Integration_data.credentials),Integration_data.id)
            elif integration_type.lower() =='tally' :
                client = TallyClient(decrypt_json(Integration_data.token_metadata),decrypt_json(Integration_data.credentials),Integration_data.id)
            elif integration_type.lower() == 'jira':
                client = JiraClient(decrypt_json(Integration_data.token_metadata),decrypt_json(Integration_data.credentials),Integration_data.id)
            elif integration_type.lower() == 'bamboohr':
                client = BambooHrClient(decrypt_json(Integration_data.token_metadata),decrypt_json(Integration_data.credentials),Integration_data.id)
            elif integration_type.lower() == 'pax8':
                client = Pax8Client(decrypt_json(Integration_data.token_metadata),decrypt_json(Integration_data.credentials),Integration_data.id)
            elif integration_type.lower() == 'dbt':
                client = DbtClient(decrypt_json(Integration_data.token_metadata),decrypt_json(Integration_data.credentials),Integration_data.id)
            elif integration_type.lower() =='salesforce':
                client = SalesforceClient(decrypt_json(Integration_data.token_metadata),decrypt_json(Integration_data.credentials),Integration_data.id)
            elif integration_type.lower()=='quickbooks':
                client = QuickbooksClient(decrypt_json(Integration_data.token_metadata),decrypt_json(Integration_data.credentials),Integration_data.id)
            elif integration_type.lower() =='googlesheet':
                client = GoogleSheetClient(decrypt_json(Integration_data.token_metadata),decrypt_json(Integration_data.credentials),Integration_data.id)
            elif integration_type.lower() =='shopify':
                client = ShopifyClient(decrypt_json(Integration_data.token_metadata),decrypt_json(Integration_data.credentials),Integration_data.id)
            elif integration_type.lower()=='googleanalytic':
                client = GoogleAnalyticClient(decrypt_json(Integration_data.token_metadata),decrypt_json(Integration_data.credentials),Integration_data.id)
            elif integration_type.lower()=='hubspot':
                client = HubspotClientToken(decrypt_json(Integration_data.token_metadata),decrypt_json(Integration_data.credentials),Integration_data.id)
            elif integration_type.lower() in ['openai', 'azure_openai', 'anthropic', 'gemini', 'deepseek', 'meta_llama']:
                # LLM integrations don't have traditional schemas like databases
                # Return a simple schema structure for LLM endpoints in the expected format
                llm_schema = [
                    {
                        'tables': endpoint,  # Use the endpoint name as the table name
                        'columns': [
                            {'col': 'prompt', 'dtype': 'text'},
                            {'col': 'response', 'dtype': 'text'},
                            {'col': 'model', 'dtype': 'text'},
                            {'col': 'timestamp', 'dtype': 'timestamp'}
                        ]
                    }
                ]
                return Response({'message':'success','tables':llm_schema},status=status.HTTP_200_OK)
            else:
                return Response({'message': f'Integration type {integration_type} not supported'}, status=status.HTTP_400_BAD_REQUEST)
            
            result = discover_endpoint_schema(client,endpoint,endpoint,1)
            return Response({'message':'sucess','tables':result},status=status.HTTP_200_OK)

        else:
            return Response({'message':'Connection Not Found'},status=status.HTTP_404_NOT_FOUND)     



class Integration_endpoints(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    # @method_decorator(require_permission('connection.edit'))
    @transaction.atomic()
    @csrf_exempt
    def get(self,request,id):
        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        try:
            connection_data = conn_models.Connections.objects.get(id=id,user_id__in=accessible_user_ids)
        except conn_models.Connections.DoesNotExist:
            return Response({'message': 'Connection not found'}, status=status.HTTP_404_NOT_FOUND)
        
        type =connection_data.type.name
        match type.lower():
            case "ninja":
                from integration_injection import NINJA_CONFIG
                endpoints_list = NINJA_CONFIG.keys()
            case "halopsa":
                from integration_injection import HALOPSA_CONFIG
                endpoints_list = HALOPSA_CONFIG.keys()
            case "connectwise":
                pass
            case "zoho_crm":
                from integration_injection import ZOHO_CRM_CONFIG
                endpoints_list = ZOHO_CRM_CONFIG.keys()
            case "zoho_inventory":
                from integration_injection import ZOHO_INVENTORY_CONFIG
                endpoints_list = ZOHO_INVENTORY_CONFIG.keys()
            case "zoho_books":
                from integration_injection import ZOHO_BOOKS_CONFIG
                endpoints_list = ZOHO_BOOKS_CONFIG.keys()
            case "tally":
                from integration_injection import TALLY_CONGIG
                endpoints_list = TALLY_CONGIG.keys()
            case "bamboohr":
                from integration_injection import BAMBOOHR_CONFIG
                endpoints_list = BAMBOOHR_CONFIG.keys()
            case "quickbooks":
                from integration_injection import QUICKBOOKS_CONFIG
                endpoints_list = QUICKBOOKS_CONFIG.keys()
            case "salesforce":
                from integration_injection import SALESFORCE_CONFIG
                endpoints_list  = SALESFORCE_CONFIG.keys()
            case "dbt":
                from integration_injection import DBT_CONFIG
                endpoints_list = DBT_CONFIG.keys()
            case "pax8":
                from integration_injection import PAX8_CONFIG
                endpoints_list=PAX8_CONFIG.keys()
            case "jira":
                from integration_injection import JIRA_CONFIG
                endpoints_list = JIRA_CONFIG.keys()
            case "shopify":
                from integration_injection import SHOPIFY_CONFIG
                endpoints_list = SHOPIFY_CONFIG.keys()
            case "hubspot":
                from integration_injection import HUBSPOT_CONFIG
                endpoints_list = HUBSPOT_CONFIG.keys()
            case "openai":
                from integration_injection import OPENAI_CONFIG
                endpoints_list = OPENAI_CONFIG.keys()
            case "azure_openai":
                from integration_injection import AZURE_OPENAI_CONFIG
                endpoints_list = AZURE_OPENAI_CONFIG.keys()
            case "anthropic":
                from integration_injection import ANTHROPIC_CONFIG
                endpoints_list = ANTHROPIC_CONFIG.keys()
            case "gemini":
                from integration_injection import GEMINI_CONFIG
                endpoints_list = GEMINI_CONFIG.keys()
            case "deepseek":
                from integration_injection import DEEPSEEK_CONFIG
                endpoints_list = DEEPSEEK_CONFIG.keys()
            case "meta_llama":
                from integration_injection import META_LLAMA_CONFIG
                endpoints_list = META_LLAMA_CONFIG.keys()
            case _:
                return Response({'message':"not implemented"},status=status.HTTP_400_BAD_REQUEST)

        return Response({"endpoints":endpoints_list},status=status.HTTP_200_OK)
        


class IntegrationAuthUrl(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    # @method_decorator(require_permission('connection.edit'))
    @transaction.atomic()
    @csrf_exempt
    def post(self, request, type):
        payload = request.data.get("payload",None)
        if payload:
            if conn_models.Integrations.objects.filter(connection_name__iexact = payload['display_name']).exists():
                return Response({'message': ' Connection Name  Exists'}, status=status.HTTP_406_NOT_ACCEPTABLE)
        else:
            payload={}
        try:
            Datasource = conn_models.DataSources.objects.get(name=type.upper(),type='INTEGRATIONS')
        except Exception as e:
            return Response({'message':'Invalid Integration'},status=status.HTTP_400_BAD_REQUEST)
        zoho_country = request.query_params.get('country',None)
        payload['country']=zoho_country
        integration_class = IntegrationAuthOrchestrator()
        integration = integration_class._get_auth_handler(type.lower(),payload)
        data = integration.get_token_url()
        # if payload:
        #     integration_id = conn_models.Integrations.objects.create(
        #     integration_type = type,
        #     site_url = None,
        #     credentials = encrypt_json(payload),
        #     token_metadata = {},
        #     is_active = False,
        #     connection_name = payload['display_name']
        #     )
        #     User = auth_models.UserProfile.objects.get(id=request.user.id)
        #     hierarchy_id = conn_models.Connections.objects.create(table_id = integration_id.id,user_id = User,type=Datasource)

        #     data['hierarchy_id'] = hierarchy_id.id

        return Response(data,status=status.HTTP_200_OK)


