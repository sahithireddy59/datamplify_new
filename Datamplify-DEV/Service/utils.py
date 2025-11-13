from sqlalchemy import text
from Datamplify.settings import logger
from django.utils.timezone import now
from Datamplify import settings
import datetime,json,io,base64
from cryptography.fernet import Fernet
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from authentication import models as auth_models
from Connections import models as conn_models
from FlowBoard import models as flow_models
from TaskPlan import models as task_models
from rest_framework.pagination import PageNumberPagination
# from Connections.utils import generate_engine
import boto3,os,uuid,paramiko

# def encode_value(value):
#     f = Fernet(settings.Fernet_Key)
#     encrypted = f.encrypt(value.encode())
#     return encrypted.decode()


# def decode_value(encrypted_value) :
#     f = Fernet(settings.Fernet_Key)
#     decrypted = f.decrypt(encrypted_value.encode())
#     return decrypted.decode()

try:
    s3 = boto3.client('s3', aws_access_key_id=settings.AWS_S3_ACCESS_KEY_ID, aws_secret_access_key=settings.AWS_S3_SECRET_ACCESS_KEY)
except Exception as e:
    print(e)

class UUIDEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, uuid.UUID):
            return str(obj)
        return super().default(obj)

def encode_value(input_string):
    input_bytes = str(input_string).encode('utf-8')
    encoded_bytes = base64.b64encode(input_bytes)
    encoded_string = encoded_bytes.decode('utf-8')
    return encoded_string

def decode_value(encoded_string):
    decoded_bytes = base64.b64decode(encoded_string.encode('utf-8'))
    decoded_string = decoded_bytes.decode('utf-8')
    return decoded_string



def file_files_save(file_path,file_path112):
    if settings.file_save_path=='s3':
        # t1=created_at.strftime('%Y-%m-%d_%H-%M-%S')+str(file_path)
        t1=str(datetime.datetime.now()).replace(' ','_').replace(':','_')+'_IN_'+str(file_path)
        file_path1 = f'Datamplify/files/{t1}'
        print(file_path1)
        try:
            file_path112.seek(0)
            s3.upload_fileobj(file_path112, settings.AWS_STORAGE_BUCKET_NAME, file_path1, ExtraArgs={'ACL': 'public-read'})
        except:
            try:
                with open(file_path112.temporary_file_path(), 'rb') as data:  ## read that binary data in a file(before replace file data)
                    s3.upload_fileobj(data, settings.AWS_STORAGE_BUCKET_NAME, file_path1)  ## pass that data in data and replaced file name in file key.
            except:
                data = ContentFile(file_path112.read())
                s3.upload_fileobj(data, settings.AWS_STORAGE_BUCKET_NAME, file_path1, ExtraArgs={'ACL': 'public-read'})
        file_url = f"https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com/{file_path1}"
        data_fn={
            "file_key":file_path1,
            "file_url":file_url
        }
        return data_fn
    else:
        # t1=created_at.strftime('%Y-%m-%d_%H-%M-%S')+str(file_path)
        t1=str(datetime.datetime.now()).replace(' ','_').replace(':','_')+'_IN_'+str(file_path)
        file_path1 = f'insightapps/files/{t1}'   
        # with default_storage.open(file_path112, 'w') as file:
        #     file.write(file_path1)   
        file_content = ContentFile(file_path112.read())
        default_storage.save(file_path1, file_content)
        file_url = f"{settings.file_save_url}media/{file_path1}"
        data_fn={
            "file_key":file_path1,
            "file_url":file_url
        }
        return data_fn  



def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '0.0.0.0')

def get_last_model_id(type):
    if type.lower() =='flow':
        last_obj = flow_models.FlowBoard.objects.count()
    elif type.lower() =='task':
        last_obj = task_models.TaskPlan.objects.count()
    else:
        0
    return last_obj if last_obj else 0

def generate_user_unique_code(request,type):
    """Generate a unique code using IP + timestamp + model last ID."""
    ip = get_client_ip(request).replace('.', '')  
    timestamp = now().strftime("%Y%m%d%H%M%S")     
    last_id = get_last_model_id(type)         

    seed = f"{ip}-{timestamp}-{last_id}"
    # hash_part = hashlib.md5(seed.encode()).hexdigest()[:6].upper()  # Short hash

    # return f"{ip}-{hash_part}-{last_id}"
    return seed



def delete_file(data):
    try: 
        a1='media/'+str(data)
        os.remove(a1)
    except:
        pass



def file_save_1(data,server_id,queryset_id,ip,dl_key):
    if settings.file_save_path=='s3':
        t1=str(datetime.datetime.now()).replace(' ','_').replace(':','_')
        file_path = f'{t1}{server_id}{queryset_id}.txt'
        # with open(file_path, 'w') as file:
        #     json.dump(data, file, indent=4)
        json_data = json.dumps(data, indent=4)
        file_buffer = io.BytesIO(json_data.encode('utf-8'))
        file_key = f'Datamplify/{ip}/{file_path}'
        if dl_key=="":
            s3.upload_fileobj(file_buffer, Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=file_key)
            file_url = f"https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com/{file_key}"
        else:
            s3.delete_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=str(dl_key))
            s3.upload_fileobj(file_buffer, Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=file_key)
            file_url = f"https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com/{file_key}"
        data_fn={
            "file_key":file_key,
            "file_url":file_url
        }
        return data_fn
    else:
        if dl_key=="" or dl_key==None:
            pass
        else:
            delete_file(str(dl_key))
        
        # t1=created_at.strftime('%Y-%m-%d_%H-%M-%S')
        t1=str(datetime.datetime.now()).replace(' ','_').replace(':','_')
        file_path = f'insightapps/{ip}/{t1}.txt'
        json_data = json.dumps(data, indent=4)
        with default_storage.open(file_path, 'w') as file:
            file.write(json_data)
        file_url = f"{settings.file_save_url}media/{file_path}"
        data_fn={
            "file_key":file_path,
            "file_url":file_url
        }
        return data_fn
    

class CustomPaginator(PageNumberPagination):
    page = 1 # records per page
    page_size_query_param = 'page_size'
    page_size = 10
    max_page_size = 1000000 #max records per page



# def SSHConnect(host,username,password):
#     ssh = paramiko.SSHClient()
#     ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
#     ssh.connect(host, username=username, password=password)
#     sshconnection = ssh.open_sftp()
#     return sshconnection

import paramiko
from ftplib import FTP
# from smb.SMBConnection import SMBConnection

def SSHConnect(connection_type, host, username, password, port=None, share=None):
    if connection_type.lower()== "sftp":
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(host, port or 22, username=username, password=password)
            return {
                'ssh_client': ssh,
                'sftp_client': ssh.open_sftp(),
                'status': 200
            }
        except Exception as e:
            print(e)
            return {'status':400,'message':str(e)}

    elif connection_type.lower() == "ftp":
        try:
            ftp = FTP()
            ftp.connect(host, port or 21)
            ftp.login(user=username, passwd=password)
            return {'connection':ftp,'status':200}
        except Exception as e:
            return {'status':400,'message':str(e)}
        
    elif connection_type.lower() == "smb":
        # try:
        #     conn = SMBConnection(username, password, "client", "server", use_ntlm_v2=True)
        #     conn.connect(host, port or 445)
        #     return {'connection':conn,'status':200}
        # except Exception as e:
        #     return {'status':400,'message':str(e)}
        pass

    else:
        raise ValueError(f"Unsupported connection type: {connection_type}")







# def Load_into_CSV(hierarchy_id, user_id, target_table, remote_id=None,
#                   remote_path=None, local_path=None, chunk_size=100000):
#     """
#     Load data from a target Postgres table into a CSV file.
#     Optionally uploads to a remote server (SFTP/FTP/SMB).

#     Args:
#         hierarchy_id (int): ID for target DB connection
#         user_id (int): User ID
#         target_table (str): Table name to export
#         remote_id (int): Optional remote connection ID (SFTP/FTP/SMB)
#         remote_path (str): Remote path to save CSV
#         local_path (str): Local file path if not using remote
#         chunk_size (int): Rows per batch (default 100k)
#     """

#     # Step 1: Prepare target DB connection
#     engine_data = generate_engine(hierarchy_id, user_id=user_id)
#     engine = engine_data['engine']
#     schema = engine_data['schema']
#     conn_str = f"""postgresql://{engine.url.username}:{engine.url.password}@{engine.url.host}/{engine.url.database}"""

#     conn = duckdb.connect(database=':memory:')
#     conn.sql(f"ATTACH '{conn_str}' AS pg_db (TYPE POSTGRES, SCHEMA '{schema}');")

#     # Step 2: Prepare local or remote file
#     timestamp = int(time.time())
#     filename = f"{target_table}_{timestamp}.csv"
#     temp_local_path = local_path or f"/tmp/{filename}"

#     # Step 3: Export data in chunks
#     print(f"⏳ Exporting data from {schema}.{target_table} → {temp_local_path}")

#     # Count rows
#     result = conn.sql(f"SELECT COUNT(*) AS cnt FROM pg_db.{target_table};").fetchone()
#     total_rows = result[0] if result else 0
#     print(f"Total rows to export: {total_rows}")

#     offset = 0
#     write_header = True

#     while offset < total_rows:
#         query = f"""
#             SELECT * FROM pg_db.{target_table}
#             LIMIT {chunk_size} OFFSET {offset};
#         """
#         df = conn.sql(query).df()
#         mode = 'w' if write_header else 'a'
#         df.to_csv(temp_local_path, index=False, header=write_header, mode=mode)
#         write_header = False
#         offset += chunk_size
#         print(f"✅ Exported rows: {min(offset, total_rows)} / {total_rows}")

#     print(f"✅ Export completed locally: {temp_local_path}")

#     # Step 4: If remote_id is provided, upload to remote server
#     if remote_id:
#         remote_conn_obj = conn_models.Connections.objects.get(id=remote_id)
#         conn_type = remote_conn_obj.conn_type.name.lower()
#         host = remote_conn_obj.host
#         username = remote_conn_obj.username
#         password = remote_conn_obj.password
#         port = remote_conn_obj.port
#         share = getattr(remote_conn_obj, "share", None)

#         response = SSHConnect(conn_type, host, username, password, port, share)
#         if response['status'] != 200:
#             return {'status': 400, 'message': response['message']}

#         connection = response['connection']
#         try:
#             if conn_type == "sftp":
#                 with connection.open(remote_path or f"/remote/{filename}", "wb") as remote_file:
#                     with open(temp_local_path, "rb") as f:
#                         remote_file.write(f.read())
#                 print(f"✅ Uploaded CSV to SFTP: {remote_path or f'/remote/{filename}'}")

#             elif conn_type == "ftp":
#                 with open(temp_local_path, "rb") as f:
#                     connection.storbinary(f"STOR {remote_path or filename}", f)
#                 print(f"✅ Uploaded CSV to FTP: {remote_path or filename}")

#             elif conn_type == "smb":
#                 with open(temp_local_path, "rb") as f:
#                     connection.storeFile(share, remote_path or filename, f)
#                 print(f"✅ Uploaded CSV to SMB share: {remote_path or filename}")

#             else:
#                 raise ValueError(f"Unsupported remote connection type: {conn_type}")

#             return {'status': 200, 'message': f'CSV exported and uploaded to {conn_type.upper()} successfully'}

#         except Exception as e:
#             return {'status': 400, 'message': str(e)}

#         finally:
#             connection.close()
#     else:
#         return {'status': 200, 'message': f'CSV exported locally to {temp_local_path}'}

