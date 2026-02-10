from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator
from airflow.operators.trigger_dagrun import TriggerDagRunOperator
from airflow.operators.empty import EmptyOperator
from datetime import datetime
import os, json, sys, django, textwrap, glob,uuid
from airflow.providers.smtp.operators.smtp import EmailOperator
from airflow.sensors.python import PythonSensor
from airflow.utils.trigger_rule import TriggerRule
from airflow.utils.task_group import TaskGroup
from datetime import timezone,datetime
from airflow.exceptions import AirflowFailException


# FlowBoard Functionalities:
# 1.Expression,
# 2.Joins
# 3.Remove duplicates
# 4.Filter
# 5.Extraction


import sys
# Use the mounted project path in Docker container
sys.path.insert(0, "/opt/airflow/project")

# Initialize Django properly
import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Datamplify.settings")

try:
    import django
    django.setup()
except Exception as e:
    print(f"[WARN] Django setup failed: {e}")

from TaskPlan.utils import run_sql_commands 
from Connections.utils import generate_engine
from Monitor.models import RunHistory
from Datamplify.settings import logger
from Connections import models as conn_models
from Service.utils import SSHConnect
from Service.utils import decode_value





GLOBAL_PARAM_HOLDER = '__global_param_store__'

# def run_dynamic_bash_command(commands,parent_task_id, **kwargs):
#     """
#     Run Linux Cli Commands and return Result Output
#     """
#     ti = kwargs['ti']
#     final_cmd = replace_params_in_json(commands, xcom_cache=None, parent_task_name=parent_task_id,**kwargs)
#     import subprocess
#     result = subprocess.run(final_cmd, shell=True, capture_output=True, text=True)
#     result.check_returncode()
#     return result.stdout



def run_dynamic_bash_command(commands, user_id,parent_task_id=None,remote_id=None,**kwargs):
    

    """
    Executes a bash command remotely via SSH on user's configured server.
    """
    ti = kwargs['ti']
    commands = replace_params_in_json(commands, xcom_cache=None, parent_task_name=parent_task_id,**kwargs)

    if not remote_id:
        raise ValueError("Remote server ID is required for remote execution")

    # Fetch remote connection details from DB
    hierarchy_data = conn_models.Connections.objects.get(id=remote_id,user_id=user_id)
    remote_conn = conn_models.Remote_file_connections.objects.get(user_id = user_id,id = hierarchy_data.table_id)
    host = remote_conn.hostname
    username = remote_conn.username
    password = remote_conn.password
    port = remote_conn.port or 22

    response = SSHConnect(remote_conn.server_type.name, host, username, decode_value(password), port)
    if response['status'] != 200:
        return {'status': 400, 'message': response['message']}
    
    ssh = response['ssh_client']

    # ssh = paramiko.SSHClient()
    # ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    # ssh.connect(hostname=host, port=port, username=username, password=password)


    try:
        stdin, stdout, stderr = ssh.exec_command(commands)

        out = stdout.read().decode()
        err = stderr.read().decode()
        exit_code = stdout.channel.recv_exit_status()

        if err:
            print(f" STDERR:\n{err}")

        if exit_code != 0:
            raise Exception(f"Command failed on remote host with exit code {exit_code}")

    finally:
        ssh.close()

    return out

# def check_for_dynamic_file(path):
#     """
#     Check File Present in The Linux Server or not
#     """
#     pattern = path.strip()
#     print(pattern)
#     matched_files = glob.glob(pattern)
#     print(matched_files)
#     return len(matched_files) > 0


import fnmatch
import posixpath
import stat

def _sftp_walk(sftp, top):
    """
    Generator like os.walk but for SFTP (yields (dirpath, dirnames, filenames) )
    """
    try:
        entries = sftp.listdir_attr(top)
    except IOError:
        return

    dirnames = []
    filenames = []
    for e in entries:
        mode = e.st_mode
        name = e.filename
        if stat.S_ISDIR(mode):
            dirnames.append(name)
        else:
            filenames.append(name)

    yield top, dirnames, filenames

    for d in dirnames:
        new_top = posixpath.join(top, d)
        yield from _sftp_walk(sftp, new_top)


def check_for_dynamic_file(remote_id,user_id, pattern):
    """
    Check if any remote file on the SFTP server matches `pattern`.
    - ssh_client: an active Paramiko SSHClient (connected).
    - pattern: POSIX remote path with glob, e.g. '/data/incoming/*.csv' or '/data/**/2025-*.csv'
    Returns: list_of_matches (list of full remote paths). Empty list means none found.
    """

    hierarchy_data = conn_models.Connections.objects.get(id=remote_id,user_id=user_id)
    remote_conn = conn_models.Remote_file_connections.objects.get(user_id = user_id,id = hierarchy_data.table_id)
    host = remote_conn.hostname
    username = remote_conn.username
    password = remote_conn.password
    port = remote_conn.port or 22
    print(hierarchy_data)

    response = SSHConnect(remote_conn.server_type.name, host, username, decode_value(password), port)
    if response['status'] != 200:
        return {'status': 400, 'message': response['message']}
    
    ssh = response['ssh_client']
    sftp = None
    matched = []
    try:
        sftp = ssh.open_sftp()

        # Normalize pattern and separate base dir & pattern part
        pattern = pattern.strip()
        # If user gives something like /a/b/*.txt -> base_dir=/a/b, name_pattern=*.txt
        base_dir = posixpath.dirname(pattern) or '.'
        name_pattern = posixpath.basename(pattern)

        # If pattern contains a recursive wildcard '**', do recursive walk from base_dir
        if '**' in pattern:
            # We'll match on the full relative path after base_dir, using fnmatch on the tail
            # Build a matching predicate where we join the relative path's components
            # against the pattern part (we use the original pattern relative to base_dir)
            # Example: pattern '/a/**/foo-*.csv' -> base_dir '/a', rel_pattern '**/foo-*.csv'
            rel_pattern = posixpath.relpath(pattern, base_dir)
            # Ensure rel_pattern uses forward slashes
            rel_pattern = rel_pattern.replace('\\', '/')

            for dirpath, dirnames, filenames in _sftp_walk(sftp, base_dir):
                # check filenames in this dir
                for fn in filenames:
                    full = posixpath.join(dirpath, fn)
                    # compute relative path from base_dir
                    rel = posixpath.relpath(full, base_dir).replace('\\', '/')
                    if fnmatch.fnmatch(rel, rel_pattern):
                        matched.append(full)

        else:
            # Non-recursive: list only the base_dir and fnmatch against name_pattern
            try:
                files = sftp.listdir(base_dir)
            except IOError:
                # directory might not exist or permission denied
                files = []

            for fn in files:
                if fnmatch.fnmatch(fn, name_pattern):
                    matched.append(posixpath.join(base_dir, fn))

    except Exception as e:
        # optionally log/print the exception
        print("sftp check error:", repr(e))
    finally:
        if sftp:
            try:
                sftp.close()
            except Exception:
                pass

    return matched

def fail_task(user_id,**context):
    dag_run = context["dag_run"]
    if not dag_run:
        logger.info("dag_run not available in DAGlevel callback. Skipping RunHistory update.")
        return
    dag = context["dag"]
    dag_id = dag_run.dag_id
    from Monitor.models import RunHistory
    from TaskPlan.models import TaskPlan
    run_id = getattr(dag_run, "run_id", None)
    if dag_run.run_type == "scheduled":
        schedule_id = dag.params.get("schedule_id")
    

        current_run = dag_run.execution_date
        next_run = dag.following_schedule(current_run)
        prev_run = dag.previous_schedule(current_run)

    
        from Tasks_Scheduler.models import Schedule
        
        schedule_obj = Schedule.objects.get(id=schedule_id)
        schedule_obj.last_run = prev_run
        schedule_obj.next_run = next_run
        schedule_obj.updated_at = datetime.now()
        schedule_obj.save()
    
    if RunHistory.objects.filter(source_id = dag_id,run_id=run_id).exists():
        RunHistory.objects.filter(
                run_id=run_id or str(current_run),
                source_id=dag_id
            ).update(
                status="failed",
                finished_at=now
            )
    else:
        if TaskPlan.objects.filter(Task_id = dag_id).exists():
            source_name = TaskPlan.objects.get(Task_id = dag_id).Task_name
            RunHistory.objects.create(
                run_id=run_id,
                source_type='taskplan',
                source_id=dag_id,
                name = source_name,
                status ='failed',
                user_id = user_id,
                started_at = now,
                finished_at = now

            )
    raise AirflowFailException("Upstream task failed  DAG marked failed.")


def cleanup_on_success(user_id,**context):
    """
    MAINTAIN RUNHISTORY here
    """
    dag_run = context["dag_run"]
    if not dag_run:
        logger.info("dag_run not available in DAGlevel callback. Skipping RunHistory update.")
        return
    dag = context["dag"]
    from Monitor.models import RunHistory
    from TaskPlan.models import TaskPlan
    dag_id = dag_run.dag_id
    run_id = getattr(dag_run, "run_id", None)
    if dag_run.run_type == "scheduled":
        schedule_id = dag.params.get("schedule_id")
        

        current_run = dag_run.execution_date
        next_run = dag.following_schedule(current_run)
        prev_run = dag.previous_schedule(current_run)

        
        from Tasks_Scheduler.models import Schedule
        schedule_obj = Schedule.objects.get(id=schedule_id)
        schedule_obj.last_run = prev_run
        schedule_obj.next_run = next_run
        schedule_obj.updated_at = datetime.now()
        schedule_obj.save()
    
    if RunHistory.objects.filter(source_id = dag_id).exists():
        RunHistory.objects.filter(
                run_id=run_id or str(current_run),
                source_id=dag_id
            ).update(
                status="failed",
                finished_at=now
            )
    else:
        if TaskPlan.objects.filter(Task_id = dag_id).exists():
            source_name = TaskPlan.objects.get(Task_id = dag_id).Task_name
            RunHistory.objects.create(
                run_id=run_id,
                source_type='taskplan',
                source_id=dag_id,
                name = source_name,
                status ='success',
                user_id = user_id,
                started_at = now,
                finished_at = now

            )
    
import re,pytz
now = datetime.now(pytz.utc)

 # from airflow.operators.dummy import DummyOperator
def dag_success_callback(context):
    # dag_run = context["dag_run"]
    # if not dag_run:
    #     print(" dag_run not available in DAG-level callback. Skipping RunHistory update.")
    #     return
    # run_id = dag_run.run_id
    # dag_id = dag_run.dag_id
    dag_run = context.get("dag_run")
    dag_id = context.get("dag").dag_id if "dag" in context else None
    run_id = getattr(dag_run, "run_id", None)

    if not run_id:
        # Fallbacks for scheduled DAGs
        logical_date = context.get("logical_date")
        execution_date = context.get("execution_date")

        print(f" No run_id found. Fallback using dag_id={dag_id}, execution_date={execution_date}")

    # Proceed only if we have dag_id
    if not dag_id:
        print(" DAG ID missing  cannot update RunHistory")
        return

    RunHistory.objects.filter(
        run_id=run_id or str(execution_date) ,
        source_id=dag_id
    ).update(
        status="success",
        finished_at=now
    )
    update_schedule_start(context)




def dag_failure_callback(context):
    # dag_run = context["dag_run"]
    # if not dag_run:
    #     print("⚠️ dag_run not available in DAG-level callback. Skipping RunHistory update.")
    #     return
    # run_id = dag_run.run_id
    # dag_id = dag_run.dag_id
    dag_run = context.get("dag_run")
    dag_id = context.get("dag").dag_id if "dag" in context else None
    run_id = getattr(dag_run, "run_id", None)

    if not run_id:
        # Fallbacks for scheduled DAGs
        logical_date = context.get("logical_date")
        execution_date = context.get("execution_date")

        print(f" No run_id found. Fallback using dag_id={dag_id}, execution_date={execution_date}")

    # Proceed only if we have dag_id
    if not dag_id:
        print(" DAG ID missing  cannot update RunHistory.")
        return

    RunHistory.objects.filter(
        run_id=run_id or str(execution_date),
        source_id=dag_id
    ).update(
        status="failed",
        finished_at=now
    )
    update_schedule_start(context)






def resolve_value(val, ti, xcom_cache, parent_task_name):
    """
    Check For parameter names and values in Task instance from 3 Levels:

    1.Parent Task
    2.__init_global_params Task (This Task is Initialised Starting of Pipeline)
    3.__sqlparam__{var_name} (This parameters used for SQL parameters )

    If None of the Xcom Keys Match it return None
    """

    if not isinstance(val, str):
        return val
    pattern = r'\$([a-zA-Z_]\w*)(?:\[(\d+)\])?'
    def replacer(match):
        var_name = match.group(1)
        index = match.group(2)
        value = None

        # Try parent task (like loop_start)
        if parent_task_name:
            value = ti.xcom_pull(task_ids=parent_task_name, key=var_name)

        # Then try __init_global_params
        

        # Try fallback: SQL param tasks (task_ids start with '__sqlparam__')
        
        if value is None:
            loop_task_id = f'{var_name}'
            try:
                value = ti.xcom_pull(task_ids=loop_task_id, key=var_name)
            except Exception:
                pass

        if value is None:
            try:
                sql_task_id = f'__sqlparam__{var_name}'
                value = ti.xcom_pull(task_ids=sql_task_id, key=var_name)
            except Exception:
                pass

        if value is None:
            value = ti.xcom_pull(task_ids='__init_global_params', key=var_name)
            
        if value is None:
            return "None"

        if index is not None:
            try:
                value = value[int(index)]
            except Exception:
                return  "None"

        return str(value)

    return re.sub(pattern, replacer, val)

def replace_params_in_json(data, xcom_cache=None, parent_task_name=None,ti=None, **kwargs):
    """
    Here the config file Json Data convert into a proper key and pass to Resolve value functions

    json data encounters - list,dict,string
    """
    ti = ti or kwargs.get("ti")

    if ti is None:
        print('yess')
        return data
    print('nooooooo')
    if xcom_cache is None:
        xcom_cache = {}
    if isinstance(data, dict):
        return {
            replace_params_in_json(k, xcom_cache=xcom_cache, parent_task_name=parent_task_name,ti=ti ,**kwargs):
            replace_params_in_json(v, xcom_cache=xcom_cache, parent_task_name=parent_task_name, ti=ti ,**kwargs)
            for k, v in data.items()
        }
    elif isinstance(data, list):
        return [replace_params_in_json(i, xcom_cache=xcom_cache, parent_task_name=parent_task_name, ti=ti ,**kwargs) for i in data]
    elif isinstance(data, str) and '$' in data:
        value =  resolve_value(data, ti, xcom_cache, parent_task_name)
        ti.xcom_push(key=data,value=value)
        return value
    return data



# def set_param(ti, key, value):
#     ti.xcom_push(key=key, value=value)
#     ti.xcom_push(key=key, value=value, task_id=GLOBAL_PARAM_HOLDER)

def init_global_params(param_list,user_id):
    """
    Create Global Parameter with default Value None and Push into Xcom Variables for __init_global_params Task
    """

    def _func(**context):
        ti = context['ti']
        conf = context.get('dag_run').conf or {}

        for param in param_list:
            name = param['param_name']
            default_val = param.get('value', 'None')
            if name in conf:
                logger.info(f"Overriding param '{name}' from trigger input")
            else:
                logger.info(f"Using default param '{name}' from config")

            raw_value = conf.get(name, default_val)
            resolved_value = resolve_value(raw_value, ti, {}, parent_task_name=None)
            ti.xcom_push(key=name, value=resolved_value)
        ##make dag status as running for schedulers
        dag_run = context["dag_run"]
        if not dag_run:
            logger.info("dag_run not available in DAGlevel callback. Skipping RunHistory update.")
            return
        dag = context["dag"]
        from Monitor.models import RunHistory
        from TaskPlan.models import TaskPlan
        dag_id = dag_run.dag_id
        run_id = getattr(dag_run, "run_id", None)
        if dag_run.run_type == "scheduled":
            schedule_id = dag.params.get("schedule_id")
            

            current_run = dag_run.execution_date
            next_run = dag.following_schedule(current_run)
            prev_run = dag.previous_schedule(current_run)

            
            from Tasks_Scheduler.models import Schedule
            schedule_obj = Schedule.objects.get(id=schedule_id)
            schedule_obj.last_run = prev_run
            schedule_obj.next_run = next_run
            schedule_obj.updated_at = datetime.now()
            schedule_obj.save()
        
        if RunHistory.objects.filter(source_id = dag_id).exists():
            RunHistory.objects.filter(
                    run_id=run_id or str(current_run),
                    source_id=dag_id
                ).update(
                    status="running",
                )
        else:
            if TaskPlan.objects.filter(Task_id = dag_id).exists():
                source_name = TaskPlan.objects.get(Task_id = dag_id).Task_name
                RunHistory.objects.create(
                    run_id=run_id,
                    source_type='taskplan',
                    source_id=dag_id,
                    name = source_name,
                    status ='running',
                    user_id = user_id,
                    started_at = now,
                    finished_at = None

                )
    return _func


def create_sql_param_task(param, user_id):
    """
    It Create Sql Parameters and assign Value by Executing SQl Query 
    """
    def _sql_param_fn(**kwargs):
        ti = kwargs['ti']
        result = run_sql_commands(param['query'], param['database'], user_id)
        value = cast_output_by_type(result, param['data_type'])
        ti.xcom_push(key=param['param_name'], value=value)

    return _sql_param_fn

import subprocess
def run_external_command(user_command,return_type,remote_id,user_id,fail=False,ti=None):
    """
    command Line Execution
    """
    
    # full_command = textwrap.dedent(f"""
    #     {user_command}
    # """).strip()
    # try:
    #     result = subprocess.run(
    #         full_command,
    #         shell=True,
    #         check=True,
    #         capture_output=True,
    #         text=True,
    #         executable="/bin/bash"
    #     )


    if not remote_id:
        raise ValueError("Remote server ID is required for remote execution")

    # Fetch remote connection details from DB
    hierarchy_data = conn_models.Connections.objects.get(id=remote_id,user_id=user_id)
    remote_conn = conn_models.Remote_file_connections.objects.get(user_id = user_id,id = hierarchy_data.table_id)
    host = remote_conn.hostname
    username = remote_conn.username
    password = remote_conn.password
    port = remote_conn.port or 22

    print(f" Connecting to remote server: {host}")
    response = SSHConnect(remote_conn.server_type.name, host, username, decode_value(password), port)
    if response['status'] != 200:
        return {'status': 400, 'message': response['message']}
    
    ssh = response['ssh_client']

    # ssh = paramiko.SSHClient()
    # ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    # ssh.connect(hostname=host, port=port, username=username, password=password)


    try:
        user_command = replace_params_in_json(user_command,ti=ti)
        print(f"🚀 Executing remote command on {host}:\n{user_command}")
        stdin, stdout, stderr = ssh.exec_command(user_command)

        output = stdout.read().decode()
        err = stderr.read().decode()
        exit_code = stdout.channel.recv_exit_status()

        print(f" STDOUT:\n{output}")
        if err:
            print(f" STDERR:\n{err}")

        if exit_code != 0:
            raise Exception(f"Command failed on remote host with exit code {exit_code}")
        if fail and not output:
            raise ValueError("Command succeeded but returned no output")
        else:
            pass
        return cast_output_by_type(output,return_type)
    finally:
        ssh.close()
        # output = result.stdout.strip()
        
    
        

def cast_output_by_type(raw_output, return_type: str, delimiter: str = ','):
    """
    Based on Data Type and Delimeter it Return the output from Raw output 
    """
    if isinstance(raw_output, str):
        raw_output = raw_output.strip().strip(delimiter)

    if return_type.lower() in ['array[string]', 'array<str>', 'array_str']:
        if isinstance(raw_output, list):
            return [str(item).strip() for item in raw_output]
        return [item.strip() for item in raw_output.split(delimiter) if item.strip()]

    elif return_type.lower() in ['array[int]', 'array[integer]', 'array<int>']:
        if isinstance(raw_output, list):
            return [int(item) for item in raw_output if str(item).strip().isdigit()]
        return [int(item.strip()) for item in raw_output.split(delimiter) if item.strip().isdigit()]

    elif return_type.lower() in ['array[float]', 'array<float>']:
        if isinstance(raw_output, list):
            return [float(item) for item in raw_output if str(item).strip()]
        return [float(item.strip()) for item in raw_output.split(delimiter) if item.strip()]

    elif return_type.lower() in ['string', 'str']:
        return str(raw_output)

    elif return_type.lower() in ['int', 'integer']:
        return int(raw_output)

    elif return_type.lower() in ['float', 'double']:
        return float(raw_output)

    elif return_type.lower() in ['boolean', 'bool']:
        if isinstance(raw_output, str):
            return raw_output.strip().lower() in ['true', '1', 'yes']
        return bool(raw_output)

    elif return_type.lower() in ['timestamp', 'date', 'time']:
        from dateutil import parser
        return parser.parse(str(raw_output))

    return raw_output


def Loop_parameters(task_details, user_id, **kwargs):
    """
    Creates Loop Parameters for command and sql and Push into Xcom Variables on Loop parameters Task Instance
    """
    ti = kwargs['ti']
    param_name = task_details['parameter_name']

    if task_details['loop_type'] == 'command':
        return_value = run_external_command(task_details['command'], task_details['return_type'],task_details['remote_id'],user_id, task_details['fail'],ti)
    elif task_details['loop_type'] == 'sql':
        result = run_sql_commands(task_details['command'], task_details['hierarchy_id'], user_id)
        return_value = cast_output_by_type(result, task_details['return_type'])

    ti.xcom_push(key=param_name, value=return_value)


# 172161619-20251022142122-29

def task_creator(task_conf,dag_id,user_id,target_hierarchy_id,source_id,task_map,parent_task_id,**kwargs):
    """
    It Intializes The tasks Based on those Type for Execution of Pipelines
    """
    task_id = task_conf['id']
    task_type = task_conf['type']
    # overall_task_list.append(task_id)


    if task_type == 'taskCommand':
        if task_conf['command_type'].lower() == 'external':

            user_command = task_conf['commands'].strip()
            # full_command = textwrap.dedent(f"""
            #     cd /var/www/AB_Client/
            #     python3 -m venv script_env && source script_env/bin/activate
            #     if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
            #     {user_command}
            #     deactivate
            # """).strip()
            # full_command = textwrap.dedent(f"""{user_command}
            #  """).strip()
            task = PythonOperator(
                task_id=task_id,
                python_callable=run_dynamic_bash_command,
                op_kwargs={"commands": user_command,"parent_task_id":parent_task_id,"user_id":user_id,"remote_id":task_conf["remote_id"]},
            )

        elif task_conf['command_type'].lower() == 'file_watcher':
            task = PythonSensor(
                task_id=task_id,
                python_callable=check_for_dynamic_file,
                op_kwargs={"remote_id":task_conf['remote_id'],"user_id":user_id,"pattern": task_conf['commands']},
                poke_interval=task_conf.get('sleep_interval', 1),
                timeout=task_conf.get('time_out', 5),
                mode='poke'
            )
    elif task_type == 'dbCommand':
        task = PythonOperator(
            task_id=task_id,
            python_callable=run_sql_commands,
            op_args=[task_conf['queries'], task_conf['hierarchy_id'], user_id]
        )
    elif task_type == 'dataFlow':
        def _trigger_runtime(**kwargs):
            ti = kwargs['ti']
            # resolve dynamically during execution
            resolved_conf = replace_params_in_json(task_conf, xcom_cache=None, parent_task_name=None, ti=ti)
            param_list = resolved_conf.get('parameters',[])
            sftp_source = resolved_conf.get('file_source',[])
            param_conf = {
                "params": param_list,
                "source":sftp_source  # always list of {"param_name": ..., "value": ...}
                
            }
            trigger_op = TriggerDagRunOperator(
                task_id=f"dynamic_trigger_{resolved_conf['trigger_dag']}",
                trigger_dag_id=resolved_conf["trigger_dag"],
                conf=param_conf,
                wait_for_completion=True,
            )

            # execute the operator manually inside the PythonOperator runtime
            trigger_op.execute(context=kwargs)

        task = PythonOperator(
            task_id=task_id,
            python_callable=_trigger_runtime,
        )
    elif task_type.lower() == 'email':
        task = EmailOperator(
            task_id=task_id,
            from_email="Support Datamplify <support@analytify.ai>",
            to=task_conf.get('to_email', ''),
            cc=task_conf.get('cc', '').split(',') if task_conf.get('cc') else None,
            subject=task_conf.get('subject', 'Pipeline Success'),
            html_content=task_conf.get('message', 'Success'),
            conn_id="smtp_default",
            custom_headers={"Reply-To": "noreply@datamplify.com"}
        )
    
    elif task_type.lower() == 'loop':
        task =  PythonOperator(
            task_id=task_id,
            python_callable=Loop_parameters,
            op_kwargs={'task_details':task_conf,'user_id': user_id}
        )
        for loop_tasks  in task_conf.get('loop_tasks',[]):
            task_map = task_creator(loop_tasks,dag_id,user_id,target_hierarchy_id,source_id,task_map,task_id)
    elif task_type.lower() =='loop_end':
        task = EmptyOperator(task_id = task_id)
    task_map[task_id] = task
    return task_map




def update_schedule_start(context):
    dag_run = context["dag_run"]
    if not dag_run:
        logger.info("dag_run not available in DAGlevel callback. Skipping RunHistory update.")
        return
    dag = context["dag"]

    # Only when it's run by scheduler (not manually triggered)
    if dag_run.run_type != "scheduled":
        schedule_id = dag.params.get("schedule_id")
        dag_id = dag_run.dag_id

        current_run = dag_run.execution_date
        next_run = dag.following_schedule(current_run)
        prev_run = dag.previous_schedule(current_run)
        from Tasks_Scheduler.models import Schedule
        from FlowBoard.models import FlowBoard
        schedule_obj = Schedule.objects.get(id=schedule_id)
        schedule_obj.last_run = prev_run
        schedule_obj.next_run = next_run
        schedule_obj.updated_at = datetime.now()
        schedule_obj.save()
        return
    # Retrieve custom params
    

    try:
        

        from Monitor.models import RunHistory

        # Now you can access fields
        RunHistory.objects.create(
            run_id=dag_run.run_id,
            source_type='taskplan',
            source_id=schedule_obj.source_id,
            name = schedule_obj.source_name,
            status ='running',
            user_id = schedule_obj.user_id

        )

    except Exception as e:
        logger.info(f"⚠️ Error updating schedule times: {e}")


def generate_dynamic_dag(dag_id, user_id, user_name, config, **kwargs):
    from datetime import datetime
    import pendulum

    now = datetime.now()
    airflow_timezone = 'UTC'
    Schedule_time = None
    from Tasks_Scheduler.models import Schedule
    if config.get('schedule_id',None) !=None:
        Schedule_data = Schedule.objects.get(user_id=user_id,id = config['schedule_id'])
        if Schedule_data.status.lower() =='active':
            airflow_timezone = Schedule_data.timezone 
            Schedule_time =  Schedule_data.schedule_value 
        


# Current year, month, day
    now = pendulum.now(airflow_timezone)
    current_year = now.year
    current_month = now.month
    current_day = now.day
    tzinfo=airflow_timezone
    dag = DAG(dag_id, default_args={
        'owner': 'airflow',
        'start_date': pendulum.datetime(current_year, current_month, current_day,tz=airflow_timezone),
        'retries': 0
    },  catchup=False, is_paused_upon_creation=False,description = config['task_name'], tags=[f"{user_name}",f"{config['task_name']}"],
    schedule=Schedule_time, 
    params={
        "schedule_id": config.get("schedule_id"),
        "user_id": config.get("user_id"),
    },
    # on_success_callback=dag_success_callback,
    # on_failure_callback=dag_failure_callback)
    )
    task_map = {}
    with dag:
        target_hierarchy_id = next((task["hierarchy_id"] for task in config['tasks'] if task["type"] == "target_data_object"),
                                next((task["hierarchy_id"] for task in config['tasks'] if task["type"] == "source_data_object"), None))

        source_id = [(i['id'], i['source_table_name']) for i in config['tasks'] if i['type'] == 'source_data_object']

        param_list = config.get('parameters', [])
        sql_param_list = config.get('sql_parameters', [])
        
        init_param_task = PythonOperator(
            task_id='__init_global_params',
            python_callable=init_global_params(param_list,user_id),
        )
        global_store_task = PythonOperator(
            task_id=GLOBAL_PARAM_HOLDER,
            python_callable=lambda: logger.info("Global param holder"),
            trigger_rule='all_done'
        )

        overall_task_list = []
        task_map = {}
        for task_conf in config['tasks']:
            parameter_task= None
            task_map = task_creator(task_conf,dag_id,user_id,target_hierarchy_id,source_id,task_map,parameter_task)
            task_id = task_conf['id']
            if task_conf['type'] =='loop':
                for t in task_conf['loop_tasks']:
                    task_id = t['id']
                    overall_task_list.append(task_id)
            else:
                overall_task_list.append(task_id)
            

        cleanup_task = PythonOperator(
            task_id='CLEAN_UP_ALL_DONE',
            python_callable=cleanup_on_success,
            op_kwargs={
                'user_id': user_id,
            },
            trigger_rule=TriggerRule.ALL_SUCCESS,  # This ensures it runs no matter what
        )
        # task_map['__init_global_params'] = init_param_task
        # task_map[GLOBAL_PARAM_HOLDER] = global_store_task
        
        # for param in sql_param_list:
        #     task_name = f"__sqlparam__{param['param_name']}"
        #     sql_task = PythonOperator(
        #         task_id=task_name,
        #         python_callable=create_sql_param_task(param, user_id),
        #         provide_context=True
        #     )
        #     task_map[task_name] = sql_task
        #     if param['order'] == 'before':
        #         sql_task >> task_map[param['dependent_task']]
        #     else:
        #         task_map[param['dependent_task']] >> sql_task

        dag_success_marker = PythonOperator(
            task_id="CLEAN_UP_ON_FAILURE",
            op_kwargs={
                'user_id': user_id,
            },
            python_callable=fail_task,
            trigger_rule=TriggerRule.ONE_FAILED,
        )
        if config.get('flow',[]):
            for parent, child in config.get('flow', []):
                task_map[parent] >> task_map[child]
            last_task = config.get('flow')[-1][-1]
            task_map[last_task] >> [cleanup_task, dag_success_marker]
        else:
            init_param_task >> [cleanup_task ,dag_success_marker]

        for param in sql_param_list:
            task_name = f"__sqlparam__{param['param_name']}"
            sql_task = PythonOperator(
                task_id=task_name,
                python_callable=create_sql_param_task(param, user_id),
            )
            task_map[task_name] = sql_task
            if param['order'] == 'before':
                sql_task >> task_map[param['dependent_task']]
            elif param['order'] =='after':
                task_map[param['dependent_task']] >> sql_task  
            else:
                sql_task  
    globals()[dag_id] = dag
    return dag

# def get_configs():
#     CONFIG_DIR = '/var/www/configs' if settings.DATABASES['default']['NAME'] == 'analytify_qa' else 'configs'
#     configs = []
#     for file in os.listdir(CONFIG_DIR):
#         if file.endswith(".json"):
#             with open(os.path.join(CONFIG_DIR, file)) as f:
#                 configs.append(json.load(f))
#     return configs

# for config in get_configs():
#     try:
#         globals()[config['dag_id']] = generate_dynamic_dag(config['dag_id'], config['user_id'], config['username'], config)
#     except Exception as e:
#         pass
#         # print(f"Exception {config['dag_id']}  as {e}")
#         # print(f"{config['dag_id']} exception: {e}")



def fetch_and_lock_dag_configs(limit=100):
    # Use the mounted path in Docker container
    CONFIG_DIR = '/opt/airflow/project/Configs/TaskPlan'
    # try:
    #     with connection.cursor() as cursor:
    #         cursor.execute("""
    #             WITH to_parse AS (
    #                 SELECT "Flow_id", "user_id"
    #                 FROM "FlowBoard"
    #                 WHERE "parsed" IS NULL OR "updated_at" > "parsed"
    #                 ORDER BY "updated_at" ASC
    #                 LIMIT %s
    #                 FOR UPDATE SKIP LOCKED
    #             )
    #             UPDATE "FlowBoard"
    #             SET "parsed" = NOW()
    #             FROM to_parse
    #             WHERE "FlowBoard"."Flow_id" = to_parse."Flow_id"
    #             RETURNING "FlowBoard"."Flow_id" AS flow_id, "FlowBoard"."user_id" AS user_id;
    #         """, [limit])
            
    #         rows = cursor.fetchall()
    #         print('[DEBUG] Locked rows:', rows)

    #         if not rows:
    #             return

    #         for flow_id, user_id in rows:
    #             full_path = os.path.join(base_dir, f'{user_id}/{flow_id}.json')
    #             try:
    #                 with open(full_path) as f:
    #                     config_json = json.load(f)
    #                     yield flow_id, config_json
    #             except Exception as e:
    #                 print(f"[ERROR] Failed to parse {full_path}: {e}")

    # except Exception as e:
    #     print(f"[ERROR] Database error: {e}")
    for user_id in os.listdir(CONFIG_DIR):
        user_dir = os.path.join(CONFIG_DIR, user_id)
        if not os.path.isdir(user_dir):
            continue
        for filename in os.listdir(user_dir):
            if filename.endswith('.json'):
                flow_id = filename[:-5]
                filepath = os.path.join(user_dir, filename)
                try:
                    with open(filepath) as f:
                        config = json.load(f)
                        yield flow_id, config
                except Exception as e:
                    logger.error(f" Failed to load {filepath}: {e}")



# def get_configs():
#     # CONFIG_DIR = '/var/www/configs' if settings.DATABASES['default']['NAME'] == 'analytify_qa' else 'configs'
#     configs = []

#     for file in os.listdir(CONFIG_DIR):
#         if file.endswith(".json"):
#             with open(os.path.join(CONFIG_DIR, file)) as f:
#                 configs.append(json.load(f))
#     return configs
dag_configs = list(fetch_and_lock_dag_configs() or [])

if not dag_configs:
    # print("[INFO] No new DAG configs found to parse.")
    pass
else:
    for dag_id, config in dag_configs:
        # try:
        globals()[dag_id] = generate_dynamic_dag(
            dag_id=dag_id,
            user_id=uuid.UUID(config['user_id']),
            user_name=config['username'],
            config=config
        )
        # except Exception as e:
        #     logger.error(f" DAG creation failed for {dag_id}: {e}")