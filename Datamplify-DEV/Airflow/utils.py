# # airflow_utils/airflow_user.py

# from flask_appbuilder.security.sqla.models import User, Role
# from airflow.app import create_app
# from airflow import settings

# app = create_app()
# sm = app.appbuilder.sm
# session = settings.Session()

# def create_static_role(role_name="standard_user"):
#     existing_role = sm.find_role(role_name)
#     if existing_role:
#         print(f"✅ Role '{role_name}' already exists.")
#         return

#     role = sm.add_role(role_name)

#     permissions = [
#         ("can_read", "DAG"),
#         ("can_edit", "DAG"),
#         ("can_trigger", "DAG"),
#         ("can_dag_read", "DAG"),
#         ("can_dag_edit", "DAG"),
#         ("can_log", "TaskInstance"),
#         ("can_read", "TaskInstance"),
#         ("can_delete", "DagRun"),
#     ]

#     for perm_name, view_menu in permissions:
#         sm.add_permission_role(role, perm_name, view_menu)

#     session.commit()
#     print(f"✅ Role '{role_name}' created with permissions.")

# def create_airflow_user(username, email, password, role_name="standard_user"):
#     existing_user = sm.find_user(username=username)
#     if existing_user:
#         print(f"User '{username}' already exists.")
#         return

#     role = sm.find_role(role_name)
#     if not role:
#         print(f"❌ Role '{role_name}' not found.")
#         return

#     sm.add_user(
#         username=username,
#         first_name=username.capitalize(),
#         last_name="User",
#         email=email,
#         role=role,
#         password=password,
#     )

#     session.commit()
#     print(f"✅ Created Airflow user '{username}' with role '{role_name}'.")

from airflow import DAG
from airflow.operators.python import PythonOperator
import os, json, sys, django, textwrap, uuid
import traceback
from datetime import datetime,timezone

from datetime import datetime
# from Datamplify.settings import logger
import pendulum,re


sys.path.insert(0, '/var/www/Datamplify')
now = datetime.now(timezone.utc)

# from FlowBoard.utils import (Extraction,Loading,ETL_Filter,Remove_duplicates,Expressions,Join,Rank,Union,Router,Pivot)
# from Connections.utils import generate_engine





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
        if value is None:
            value = ti.xcom_pull(task_ids='__init_global_params', key=var_name)

        # Try fallback: SQL param tasks (task_ids start with '__sqlparam__')
        if value is None:
            try:
                sql_task_id = f'__sqlparam__{var_name}'
                value = ti.xcom_pull(task_ids=sql_task_id, key=var_name)
            except Exception:
                pass
        if value is None:
            loop_task_id = f'{var_name}'
            try:
                value = ti.xcom_pull(task_ids=loop_task_id, key=var_name)
            except Exception:
                pass

        if value is None:
            return "None"

        if index is not None:
            try:
                value = value[int(index)]
            except Exception:
                return  "None"

        return str(value)

    return re.sub(pattern, replacer, val)



# from airflow.operators.dummy import DummyOperator
def dag_success_callback(context):
    from Monitor.models import RunHistory

    dag_run = context["dag_run"]
    run_id = dag_run.run_id
    dag_id = dag_run.dag_id

    RunHistory.objects.filter(
        run_id=run_id,
        source_id=dag_id
    ).update(
        status="success",
        finished_at=now
    )




def dag_failure_callback(context):
    from Monitor.models import RunHistory

    dag_run = context["dag_run"]
    run_id = dag_run.run_id
    dag_id = dag_run.dag_id

    RunHistory.objects.filter(
        run_id=run_id,
        source_id=dag_id
    ).update(
        status="failed",
        finished_at=now
    )


GLOBAL_PARAM_HOLDER = '__global_param_store__'


def init_global_params(param_list,config, **context):
    ti = context['ti']
    conf = context.get('dag_run').conf or {}

    for param in param_list:
        name = param['param_name']
        default_val = param.get('value', 'None')
        if name in conf:
            print(f"Overriding param '{name}' from trigger input")
        else:
            print(f"Using default param '{name}' from config")

        raw_value = conf.get(name, default_val)
        resolved_value = resolve_value(raw_value, ti, {}, parent_task_name=None)
        ti.xcom_push(key=name, value=resolved_value)
    
    config['tasks'] = replace_params_in_json(config['tasks'],xcom_cache=None,parent_task_name = None,**context)


    return config['tasks']



def replace_params_in_json(data, xcom_cache=None, parent_task_name=None, **kwargs):
    """
    Here the config file Json Data convert into a proper key and pass to Resolve value functions

    json data encounters - list,dict,string
    """
    ti = kwargs.get('ti')

    if ti is None:
        return data
    if xcom_cache is None:
        xcom_cache = {}
    if isinstance(data, dict):
        return {
            replace_params_in_json(k, xcom_cache=xcom_cache, parent_task_name=parent_task_name, **kwargs):
            replace_params_in_json(v, xcom_cache=xcom_cache, parent_task_name=parent_task_name, **kwargs)
            for k, v in data.items()
        }
    elif isinstance(data, list):
        return [replace_params_in_json(i, xcom_cache=xcom_cache, parent_task_name=parent_task_name, **kwargs) for i in data]
    elif isinstance(data, str) and '$' in data:
        return resolve_value(data, ti, xcom_cache, parent_task_name)
    return data




def task_creator(task_conf,dag_id,user_id,target_hierarchy_id,source_id,task_map,config=None,**kwargs):
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

    from FlowBoard.utils import (Extraction,Loading,ETL_Filter,Remove_duplicates,Expressions,Join,Rank,Union,Router,Pivot,UpdateStrategy)

    """
    It Intializes The tasks Based on those Type for Execution of Pipelines
    """
    task_id = task_conf['id']
    task_type = task_conf['type']
    # overall_task_list.append(task_id)
    match task_type:
        case 'source_data_object':
            # Try to find the target table name from the config for MongoDB to MongoDB transfers
            target_table_name = None
            if config:
                for task in config.get('tasks', []):
                    if task.get('type') == 'target_data_object':
                        target_table_name = task.get('target_table_name')
                        break
            
            op_kwargs = {
                'dag_id': dag_id,
                'task_id': task_id,
                'source_type': task_conf['format'],
                'path': task_conf['path'],
                'hierarchy_id': task_conf['hierarchy_id'],
                'user_id': user_id,
                'source_table_name': task_conf['source_table_name'],
                'source_attributes': task_conf.get('source_attributes', ''),
                "attributes": task_conf.get('attributes', ''),
                "target_hierarchy_id": target_hierarchy_id
            }
            
            # Add target table name if found
            if target_table_name:
                op_kwargs['target_table_name'] = target_table_name
            
            task = PythonOperator(
                task_id=task_id,
                python_callable=Extraction,
                op_kwargs=op_kwargs
            )
        case "target_data_object":
            previous_task_id = task_conf['previous_task_id']
            print(f"[task_creator] Creating target task {task_id}")
            print(f"[task_creator] previous_task_id from config: {previous_task_id}")
            print(f"[task_creator] previous_task_id type: {type(previous_task_id)}")
            
            task = PythonOperator(
                task_id=task_id,
                python_callable=Loading,
                op_kwargs={
                    'hierarchy_id': task_conf['hierarchy_id'],
                    'user_id': user_id,
                    'dag_id': dag_id,
                    'truncate': task_conf['truncate'],
                    'create': task_conf['create'],
                    'format': task_conf['format'],
                    'previous_id': previous_task_id,
                    'instance_id':task_conf.get('previous_instance_id',None),
                    'target_table_name': task_conf['target_table_name'],
                    'attribute_mapper': task_conf.get('attribute_mapper', ''),
                    'sources': source_id,
                    'update_strategy': task_conf.get('update_strategy', 'append'),
                    'key_columns': task_conf.get('key_columns', None)
                }
            )
        case "Filter":
            task = PythonOperator(
                task_id=task_id,
                python_callable=ETL_Filter,
                op_args=[
                    task_conf['filter_conditions'], 
                    task_conf.get('previous_instance_id',None),
                    dag_id, 
                    task_id, 
                    task_conf['previous_task_id'], 
                    target_hierarchy_id, 
                    user_id, 
                    source_id
                    ]
            )
        case  "Expression":
            task = PythonOperator(
                task_id=task_id,
                python_callable=Expressions,
                op_args=[
                    task_conf['expressions_list'], 
                    dag_id, 
                    task_id, 
                    task_conf['previous_task_id'], 
                    task_conf.get('previous_instance_id',None),
                    target_hierarchy_id, 
                    user_id, 
                    source_id
                    ]
            )
        case  "Rollup":
            task = PythonOperator(
                task_id=task_id,
                python_callable=Remove_duplicates,
                op_args=[
                    task_conf['group_attributes'], 
                    task_conf['having_clause'], 
                    task_id, 
                    dag_id, 
                    task_conf['previous_task_id'], 
                    task_conf.get('previous_instance_id',None),
                    task_conf.get('attributes', ''), 
                    target_hierarchy_id, 
                    user_id, 
                    source_id
                    ]
            )
        case  "Joiner":
            task = PythonOperator(
                task_id=task_id,
                python_callable=Join,
                op_args=[
                    task_conf['primary_table'], 
                    task_conf['joining_list'], 
                    task_conf['where_clause'], 
                    dag_id, 
                    task_id, 
                    task_conf['previous_task_id'], 
                    task_conf.get('previous_instance_id',None),
                    task_conf.get('attributes', ''), 
                    target_hierarchy_id, 
                    user_id, 
                    source_id
                    ]

            )
        case "Rank":
            task = PythonOperator(
                task_id=task_id,
                python_callable=Rank,
                op_args=[
                    task_conf['source_attributes'],
                    task_conf['order_by_cols'],
                    task_conf['partition_by_cols'],
                    task_conf['rank_column_name'],
                    task_conf['Records'],
                    task_conf['rank_type'],
                    dag_id,
                    task_id,
                    task_conf['previous_task_id'],
                    task_conf.get('previous_instance_id',None),
                    target_hierarchy_id,
                    user_id,
                    task_conf['sort']
                ],
            )

        case "Union":
            task = PythonOperator(
                task_id=task_id,
                python_callable=Union,
                op_args=[task_conf['previous_task_id'],
                        task_conf.get('previous_instance_id',None),
                        task_conf['column_mappings'],
                        task_conf['type'], 
                        dag_id, 
                        task_id,
                        target_hierarchy_id,
                        user_id]
            )

        case "Router":
            task = PythonOperator(
                task_id=task_id,
                python_callable=Router,
                op_args=[
                        task_conf['conditions'], 
                        dag_id, 
                        task_id, 
                        task_conf['previous_task_id'], 
                        task_conf.get('previous_instance_id',None),
                        target_hierarchy_id, 
                        user_id
                        ]
            )
        case "Pivot":
            task = PythonOperator(
                task_id=task_id,
                python_callable=Pivot,
                op_args=[
                    task_conf.get('pivot_group_by_columns', ''),
                    task_conf.get('pivot_column', ''),
                    task_conf.get('pivot_values', ''),
                    task_conf.get('pivot_value_columns', ''),
                    task_conf.get('pivot_aggregation', ''),
                    task_conf.get('previous_instance_id',None),
                    dag_id,
                    task_id,
                    user_id
                ]
            )

        case "UpdateStrategy":
            task = PythonOperator(
                task_id=task_id,
                python_callable=UpdateStrategy,
                op_args=[
                    task_conf.get('update_strategy', 'append'),
                    task_conf.get('key_columns', []),
                    task_conf.get('previous_instance_id', None),
                    dag_id,
                    task_id,
                    target_hierarchy_id,
                    user_id,
                    source_id
                ]
            )

        case _:
            raise ValueError(f"Unsupported task type: '{task_type}' for task ID '{task_id}'")
        
    task_map[task_id] = task
    return task_map




def cleanup_on_success(tasks_list,user_id,hierarchy_id,**kwargs):
    from Connections.utils import generate_engine

    """
    Cleans Temporary Tables Created by Each Task Instances and it run End of The Pipeline
    """
    ti = kwargs['ti']
    if not user_id or not hierarchy_id:
        return

    engine_data = generate_engine(hierarchy_id, user_id)
    engine = engine_data['engine']
    schema = engine_data['schema']
    for task_id in tasks_list:
        table_name = ti.xcom_pull(task_ids=task_id, key=task_id)

        if table_name and table_name is not None:
            with engine.connect() as cursor:
                cursor.execute(f'DROP TABLE IF EXISTS "{schema}"."{table_name}"')




def create_sql_param_task(param, user_id):
    from TaskPlan.utils import run_sql_commands 

    """
    It Create Sql Parameters and assign Value by Executing SQl Query 
    """
    def _sql_param_fn(**kwargs):
        ti = kwargs['ti']
        result = run_sql_commands(param['query'], param['database'], user_id)
        value = cast_output_by_type(result, param['data_type'])
        ti.xcom_push(key=param['param_name'], value=value)

    return _sql_param_fn

