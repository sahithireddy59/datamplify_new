from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction 
from Service.utils import generate_user_unique_code,file_save_1,s3,UUIDEncoder,CustomPaginator,SSHConnect,decode_value
from FlowBoard.serializers import Create_FLow,Update_FlowBoard,Server_file,List_server_file
from FlowBoard import models as flow_model
from Connections import models as conn_models
from authentication import models as auth_models
from Monitor import models as mon_models
from Tasks_Scheduler import models as scheduler_models
from authentication.utils import token_function
from drf_yasg.utils import swagger_auto_schema
from Monitor.utils import airflow_token
from datetime import datetime
from Datamplify import settings
from pytz import utc
import os,json,requests,uuid,stat,duckdb
from datetime import timezone
import pandas as pd
from pathlib import Path
from authentication.permissions import require_permission,CustomIsAuthenticated
from django.utils.decorators import method_decorator
from oauth2_provider.contrib.rest_framework import OAuth2Authentication




class FlowBoard(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    serializer_class = Create_FLow
    @swagger_auto_schema(request_body=Create_FLow)
    @method_decorator(require_permission('flowboard.create'))
    @csrf_exempt
    @transaction.atomic
    def post(self, request):
        """
        To Create a FlowBoard and save and Create a DAG on it
        """
        user_id = request.user.id
        serializer = self.serializer_class(data = request.data)
        if serializer.is_valid(raise_exception=True):
            flow_name = serializer.validated_data['flow_name']
            flow = serializer.validated_data['flow_plan']
            drawflow = serializer.validated_data['drawflow']
            user = auth_models.UserProfile.objects.get(id=user_id)
            if flow_model.FlowBoard.objects.filter(Flow_name__exact=flow_name,user_id = user_id).exists():
                return Response({'message':f'Flow name already Exists'},status=status.HTTP_406_NOT_ACCEPTABLE)  
            Flow_id = generate_user_unique_code(request,'FLOW')
            flow['dag_id'] = Flow_id
            flow['flow_name'] = flow_name
            flow['username'] = user.username
            flow['user_id'] = user_id
            configs_dir = os.path.join(settings.config_dir, 'FlowBoard', str(user_id))
            os.makedirs(configs_dir, exist_ok=True)
            file_path = os.path.join(configs_dir, f'{Flow_id}.json')
            with open(file_path, 'w') as f:
                json.dump(flow,f, indent=4,cls=UUIDEncoder)
            file_data = drawflow.read().decode('utf-8')  
            file_path = file_save_1(file_data,'',Flow_id,'FlowBoard',"")
            id = flow_model.FlowBoard.objects.create(
                Flow_id = Flow_id,
                Flow_name=flow_name,
                DrawFlow=file_path['file_url'],
                user_id = user
            )
            return Response({'message':'Saved SucessFully','Flow_Board_id':id.id},status=status.HTTP_200_OK)
        else:
            return Response({'message':'Serializer Error'},status=status.HTTP_400_BAD_REQUEST)
        
        
    serializer_class1 = Update_FlowBoard
    @swagger_auto_schema(request_body=Update_FlowBoard)
    @method_decorator(require_permission('flowboard.edit'))
    def put(self, request):
        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        serializer = self.serializer_class1(data = request.data)
        if serializer.is_valid(raise_exception=True):
            id = serializer.validated_data['id']
            flow_name = serializer.validated_data['flow_name']
            flow = serializer.validated_data['flow_plan']
            drawflow = serializer.validated_data['drawflow']
            user = auth_models.UserProfile.objects.get(id=user_id)
            if flow_model.FlowBoard.objects.filter(Flow_name__exact=flow_name,user_id__in=accessible_user_ids).exclude(id=id).exists():
                return Response({'message':f'Flow name already Exists'},status=status.HTTP_406_NOT_ACCEPTABLE)
            if flow_model.FlowBoard.objects.filter(id = id,user_id__in=accessible_user_ids).exists():
                Flow_data = flow_model.FlowBoard.objects.get(id = id,user_id__in=accessible_user_ids)
            else:
                    return Response({'message':'Data Flow Not Created'},status=status.HTTP_404_NOT_FOUND)
                    
            flow['dag_id'] = Flow_data.Flow_id
            flow['flow_name'] = flow_name
            
            flow_owner_id = Flow_data.user_id.id if hasattr(Flow_data.user_id, 'id') else Flow_data.user_id
            # flow_user_name = Flow_data.user_id.username if hasattr(Flow_data.user_id, 'id') else Flow_data.user_id.username
            from django.utils.encoding import force_str

            user_obj = getattr(Flow_data, "user_id", None)
            if user_obj and hasattr(user_obj, "username"):
                flow['username'] = force_str(user_obj.username)
            else:
                flow['username'] = ""
            flow['user_id'] = flow_owner_id

            configs_dir = f'{settings.config_dir}/FlowBoard/{str(flow_owner_id)}'
            file_path = os.path.join(configs_dir, f'{Flow_data.Flow_id}.json')
            new_file_path = os.path.join(configs_dir, f'{Flow_data.Flow_id}.json')
            data = flow
            with open(file_path, 'w') as f:
                json.dump(data, f, indent=4,cls=UUIDEncoder,ensure_ascii=False)
            os.rename(file_path,new_file_path)
            datasrc_key = Flow_data.DrawFlow.split('FlowBoard/')[1]
            file_data = drawflow.read().decode('utf-8')  
            file_path = file_save_1(file_data,'',Flow_data.Flow_id,'FlowBoard',f'Datamplify/FlowBoard/{datasrc_key}')
            updated_data = flow_model.FlowBoard.objects.filter(id = id).update(
                Flow_name  = flow_name,
                DrawFlow = file_path['file_url'],
                updated_at=datetime.now(utc)
            )                
            return Response({'message':'updated SucessFully','Flow_Board_id':str(id)},status=status.HTTP_200_OK)
        else:
                return Response({'message':'Serializer Error'},status=status.HTTP_400_BAD_REQUEST)
        
        

class FlowOperation(APIView):  
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    @csrf_exempt
    @transaction.atomic()
    @method_decorator(require_permission('flowboard.view'))
    def get(self,request,id):
        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        if flow_model.FlowBoard.objects.filter(id=id,user_id__in=accessible_user_ids).exists():
            data = flow_model.FlowBoard.objects.get(id = id,user_id__in=accessible_user_ids)
            dag_id = data.Flow_id
            flow_owner_id = data.user_id.id if hasattr(data.user_id, 'id') else data.user_id
            configs_dir = f'{settings.config_dir}/FlowBoard/{str(flow_owner_id)}'
            file_path = os.path.join(configs_dir, f'{dag_id}.json')
            with open(file_path, 'r') as f:
                dag_json = json.load(f)

            transformation = requests.get(data.DrawFlow)
            transformations_flow = transformation.json()

            return Response({
                    'message': 'success',
                    'id':id,
                    'Flow_id': dag_id,
                    'flow_plan':dag_json,
                    'drawflow':transformations_flow,
                    'flow_name':data.Flow_name
                }, status=status.HTTP_200_OK)
            
        else:
            return Response({'message':'Flow Plan Not Found'},status=status.HTTP_404_NOT_FOUND)
        
    
    @method_decorator(require_permission('flowboard.delete'))   
    def delete(self,request,id):
        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        if flow_model.FlowBoard.objects.filter(id = id,user_id__in=accessible_user_ids).exists():
            flow_data = flow_model.FlowBoard.objects.get(id = id,user_id__in=accessible_user_ids)
            air_token = airflow_token()
            url =f"{settings.airflow_host}/api/v2/dags/{flow_data.Flow_id}"
            headers = {
                "Authorization": f"Bearer {air_token}"
            }
            response = requests.delete(url, headers=headers)
            flow_owner_id = flow_data.user_id.id if hasattr(flow_data.user_id, 'id') else flow_data.user_id
            configs_dir = f'{settings.config_dir}/FlowBoard/{str(flow_owner_id)}'
            file_path = os.path.join(configs_dir, f'{flow_data.Flow_id}.json')
            if os.path.exists(file_path):
                os.remove(file_path)
            datasrc_key = flow_data.DrawFlow.split('FlowBoard/')[1]
            s3.delete_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=f'Datamplify/FlowBoard/{str(datasrc_key)}')               
            flow_model.FlowBoard.objects.filter(id = id,user_id=user_id).delete()
            mon_models.RunHistory.objects.filter(source_id = flow_data.Flow_id).delete()
            scheduler_models.Schedule.objects.filter(source_id = flow_data.Flow_id).delete()
            return Response({'message':'Deleted Successfully'},status=status.HTTP_200_OK)
        else:
            return Response({'message':'Data Flow Not Created'},status=status.HTTP_404_NOT_FOUND)
        
            






class Flow_List(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

      # optional: define scope requirement
    @csrf_exempt
    @method_decorator(require_permission('flowboard.view'))
    def get(self, request):
        from math import ceil
        user = request.user
        user_id = user.id
        paginator = CustomPaginator()
        page_number = request.query_params.get(paginator.page_query_param, 1)
        page_size = request.query_params.get(paginator.page_size_query_param, paginator.page_size)
        search = request.query_params.get('search', '')

        accessible_user_ids = [user_id]

        if user.created_by_id:
            accessible_user_ids.append(user.created_by_id)
        

        try:
            page_number = int(page_number)
            page_size = min(int(page_size), paginator.max_page_size)
        except (ValueError, TypeError):
            return Response({"error": "Invalid pagination parameters"}, status=400)

        flow_data = flow_model.FlowBoard.objects.filter(
                user_id__in=accessible_user_ids,
            ).order_by('-updated_at')
        if search:
            flow_data = flow_data.filter(Flow_name__icontains=search)
        total_records  = flow_data.count()


        total_pages = ceil(total_records / page_size)
        offset = (page_number - 1) * page_size

        data = flow_data.values('id', 'Flow_name', 'Flow_id', 'created_at', 'updated_at','user_id'
        )[offset:offset + page_size]

        return Response({
            'data': data,
            'total_pages': total_pages,
            'total_records': total_records,
            'page_number': page_number,
            'page_size': page_size
        }, status=status.HTTP_200_OK)
    

# class ListoutServerfiles(APIView):
#     def get(self, request):
#         tok1 = token_function(request)
#         if tok1["status"]==200:
#             user_id = tok1['user_id']
#             type = request.query_params.get('type','csv')
#             path = request.data.get('path','')
#             remote_server = request.data.get()
#             connection_type = 'sftp'
#             host = "202.65.155.123"
#             username = "ubuntu"
#             password = "YLW2Lr0WBz72"
#             remote_path = "/var/www/Datamplify/"
#             ssh  =SSHConnect(connection_type,host,username,password)
#             if ssh['status'] !=200:
#                 return Response({'message':ssh['message']},status=status.HTTP_400_BAD_REQUEST)
#             ssh = ssh['connection']
#             entries = ssh.listdir_attr(remote_path)
#             files =[]
#             for entry in entries:
#                 mode = entry.st_mode
#                 name = entry.filename
#                 print(f"{mode=}{name=}")
#                 if stat.S_ISDIR(mode):
#                     continue
#                 if name.lower().endswith(f".{type}"):
#                     files.append(name.rstrip(f'.{type}'))
#             return Response({'files':files},status=status.HTTP_200_OK)
#         else:
#            return Response({'message':tok1['message']},status=status.HTTP_401_UNAUTHORIZED)
    


class ListoutServerfiles(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    serializer_class = List_server_file
    @method_decorator(require_permission('connection.view'))
    @csrf_exempt
    @transaction.atomic()
    def post(self,request):
        
        serializer = self.serializer_class(data = request.data)
        if serializer.is_valid(raise_exception=True):
            path = serializer.validated_data['path']

            user= request.user
            user_id = user.id
            accessible_user_ids = [user_id]
            if hasattr(user, 'created_by') and user.created_by:
                accessible_user_ids.append(user.created_by.id)
            type = serializer.validated_data['type']
            conn_id =serializer.validated_data['conn_id']

            # --- Validate required input ---
            if not conn_id:
                return Response({'message': 'connection is required'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                # --- Fetch server connection details ---
                datasource = conn_models.Connections.objects.get(id = conn_id,user_id__in=accessible_user_ids)
                connection = conn_models.Remote_file_connections.objects.get(
                    user_id__in=accessible_user_ids,
                    id=datasource.table_id
                )
            except:
                return Response({'message': 'Connection not found for this user.'}, status=status.HTTP_404_NOT_FOUND)

            # --- Establish SFTP Connection ---
            # try:
                # transport = paramiko.Transport((connection.hostname, connection.port or 22))
                # transport.connect(username=connection.username, password=connection.password)
                # sftp = paramiko.SFTPClient.from_transport(transport)
            ssh_connection = SSHConnect(connection.server_type.name.lower(),connection.hostname,connection.username,decode_value(connection.password),connection.port)
            if ssh_connection['status'] !=200:
                print(ssh_connection['message'])
                return Response({'message': f'Failed to connect to server'}, status=status.HTTP_400_BAD_REQUEST)
            sftp = ssh_connection['sftp_client']
            remote_path = path or "/"
            files = []

            try:
                # --- Check if path exists ---
                try:
                    sftp.listdir(remote_path)  # will raise IOError if path doesn’t exist
                except IOError:
                    return Response({'message': 'Path does not exist.'}, status=status.HTTP_400_BAD_REQUEST)

                # --- List files in directory ---
                entries = sftp.listdir_attr(remote_path)
                for entry in entries:
                    mode = entry.st_mode
                    name = entry.filename
                    if stat.S_ISDIR(mode):
                        continue
                    if name.lower().endswith(f".{type.lower()}"):
                        files.append(name)

                sftp.close()
                return Response({'files': files}, status=status.HTTP_200_OK)
            except Exception as e:
                sftp.close()
                return Response({'message': f'Error reading directory: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            return Response({'message':'Serializer Error'},status=status.HTTP_400_BAD_REQUEST)
        
class Server_file_schema(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    serializer_class = Server_file
    @method_decorator(require_permission('connection.view'))
    @csrf_exempt
    @transaction.atomic()
    def post(self,request):
        serializer = self.serializer_class(data = request.data)
        if serializer.is_valid(raise_exception=True):
            path = serializer.validated_data['path']
            conn_id = serializer.validated_data["conn_id"]
            user= request.user
            user_id = user.id
            accessible_user_ids = [user_id]
            if hasattr(user, 'created_by') and user.created_by:
                accessible_user_ids.append(user.created_by.id)
            if not conn_id:
                return Response({'message': 'connection is required'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                # --- Fetch server connection details ---
                datasource = conn_models.Connections.objects.get(id = conn_id,user_id__in=accessible_user_ids)
                connection = conn_models.Remote_file_connections.objects.get(
                    user_id__in=accessible_user_ids,
                    id=datasource.table_id
                )
            except:
                return Response({'message': 'Connection not found for this user.'}, status=status.HTTP_404_NOT_FOUND)

            # --- Establish SFTP Connection ---
            # try:
                # transport = paramiko.Transport((connection.hostname, connection.port or 22))
                # transport.connect(username=connection.username, password=connection.password)
                # sftp = paramiko.SFTPClient.from_transport(transport)
            ssh_connection = SSHConnect(connection.server_type.name.lower(),connection.hostname,connection.username,decode_value(connection.password),connection.port)
            if ssh_connection['status'] !=200:
                return Response({'message': f'Failed to connect to server'}, status=status.HTTP_400_BAD_REQUEST)
            ssh = ssh_connection['sftp_client']
            tables=[]
            with ssh.open(path,'r') as f:
                data= pd.read_csv(f,nrows=10)
                conn = duckdb.connect(database=':memory:')
                conn.register('remote_file',data)
                schema = conn.query("describe SELECT * FROM 'remote_file'").df()
                file_path = Path(path)
                file_name = file_path.stem
                columns = [
                {"col": row["column_name"], "dtype": row["column_type"].lower()}
                for _, row in schema.iterrows()
                ]
                tables.append({
                    "tables": file_name,  # table name = file name without extension
                    "columns": columns
                })
                return Response({
                    "message": "success",
                    "tables": tables,
                    "database_name": file_name,
                    "schema": "remote",
                    "connection_name": connection.connection_name,
                    "id": conn_id
                }, status=status.HTTP_200_OK)
        else:
            return Response({'message':'Serializer Error'},status=status.HTTP_400_BAD_REQUEST)
        
