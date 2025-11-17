
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime
import os, json, sys, django, textwrap, uuid
from airflow.utils.trigger_rule import TriggerRule
from airflow.utils import timezone as airflow_timezone
import traceback
from datetime import datetime,timezone
import sys, os





def generate_dynamic_dag(dag_id, user_id, user_name, config, **kwargs):
    # sys.path.insert(0, '/var/www/Datamplify')  # adjust if different
    # os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Datamplify.settings")
    # sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


    from Airflow.utils import dag_failure_callback,dag_success_callback,init_global_params,GLOBAL_PARAM_HOLDER,replace_params_in_json,task_creator,cleanup_on_success,create_sql_param_task

    from datetime import datetime
    import pendulum

    now = datetime.now()
    airflow_timezone = 'UTC'
    Schedule_time = None
    # from Tasks_Scheduler.models import Schedule
    # if config.get('schedule_id',None) !=None:
    #     Schedule_data = Schedule.objects.get(user_id=user_id,id = config['schedule_id'])
    #     if Schedule_data.status.lower() =='active':
    #         airflow_timezone = Schedule_data.timezone 
            # Schedule_time =  Schedule_data.schedule_value 
        


# Current year, month, day
    now = pendulum.now(airflow_timezone)
    current_year = now.year
    current_month = now.month
    current_day = now.day
    tzinfo=airflow_timezone
    dag = DAG(
        dag_id,
        default_args={
            'owner': 'airflow',
            'start_date': pendulum.datetime(current_year, current_month, current_day,tz=airflow_timezone), # timezone-aware
            'retries': 0
        },
        # start_date=datetime(current_year, current_month, current_day, tzinfo=),
        schedule=Schedule_time,  # ✅ correct param
        catchup=False,
        description=config.get('flow_name', 'No Description'),
        is_paused_upon_creation=False,
        tags=[str(user_name), str(config.get('flow_name', ''))],
        on_success_callback=dag_success_callback,
        on_failure_callback=dag_failure_callback,
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
            # python_callable=init_global_params(param_list),
            python_callable=init_global_params,
            op_kwargs = {
                "param_list":param_list,
                "config":config
                                        }

        )
        global_store_task = PythonOperator(
            task_id=GLOBAL_PARAM_HOLDER,
            python_callable=lambda: print("Global param holder"),
            trigger_rule='all_done'
        )


        

        overall_task_list = []
        task_map = {}
        for task_conf in config['tasks']:
            parameter_task= None
            task_map = task_creator(task_conf,dag_id,user_id,target_hierarchy_id,source_id,task_map,config=config)
            task_id = task_conf['id']
            if task_conf['type'] =='loop':
                for t in task_conf['loop_tasks']:
                    task_id = t['id']
                    overall_task_list.append(task_id)
            else:
                overall_task_list.append(task_id)
            

        cleanup_task = PythonOperator(
            task_id='cleanup_temporary_tables',
            # python_callable=lambda **kwargs: cleanup_on_success(),
            python_callable=cleanup_on_success,
            op_kwargs={
                'tasks_list': overall_task_list,
                'user_id': user_id,
                'hierarchy_id': target_hierarchy_id
            },
            trigger_rule=TriggerRule.ALL_DONE,  # This ensures it runs no matter what
        )
        
# dag_success_marker = PythonOperator(
#             task_id='dag_success_marker',
#             python_callable=check_dag_status,
#             trigger_rule=TriggerRule.ALL_DONE  # Important: Run regardless of prior failures
#         )
        # dag_success_marker = PythonOperator(
        #     task_id="dag_success_marker",
        #     python_callable=check_upstream_status,
        #     trigger_rule=TriggerRule.ALL_DONE,
        # )
        
        if config.get('flow',[]):
            for parent, child in config.get('flow', []):
                task_map[parent] >> task_map[child]
            last_task = config.get('flow')[-1][-1]
            task_map[last_task] >> cleanup_task 
        else:
            init_param_task >> cleanup_task 

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


# def generate_dynamic_dag(dag_id, user_id, user_name, config, **kwargs):
#     import pendulum
#     from Airflow.utils import (
#         dag_failure_callback, dag_success_callback, init_global_params, 
#         GLOBAL_PARAM_HOLDER, replace_params_in_json, task_creator, cleanup_on_success, create_sql_param_task
#     )

#     airflow_timezone = 'UTC'
#     now = pendulum.now(airflow_timezone)
#     dag = DAG(
#         dag_id,
#         default_args={'owner': 'airflow', 'start_date': now, 'retries': 0},
#         schedule=None,
#         catchup=False,
#         description=config.get('flow_name', ''),
#         is_paused_upon_creation=False,
#         tags=[str(user_name), str(config.get('flow_name', ''))],
#         on_success_callback=dag_success_callback,
#         on_failure_callback=dag_failure_callback,
#     )

#     task_map = {}
#     overall_task_list = []

#     target_hierarchy_id = next(
#         (t["hierarchy_id"] for t in config['tasks'] if t["type"] == "target_data_object"),
#         next((t["hierarchy_id"] for t in config['tasks'] if t["type"] == "source_data_object"), None)
#     )
#     source_id = [(i['id'], i['source_table_name']) for i in config['tasks'] if i['type'] == 'source_data_object']

#     with dag:
#         # Initialize global params
#         init_param_task = PythonOperator(
#             task_id='__init_global_params',
#             python_callable=lambda **kwargs: init_global_params(config.get('parameters', []), **kwargs)
#         )
#         task_map[GLOBAL_PARAM_HOLDER] = PythonOperator(
#             task_id=GLOBAL_PARAM_HOLDER,
#             python_callable=lambda: print("Global param holder"),
#             trigger_rule='all_done'
#         )

#         # Create all tasks dynamically
#         for task_conf in config['tasks']:
#             task_conf = replace_params_in_json(task_conf)
#             task_map = task_creator(task_conf, dag_id, user_id, target_hierarchy_id, source_id, task_map)
#             overall_task_list.append(task_conf['id'])

#         # Wire dependencies
#         for parent, child in config.get('flow', []):
#             if parent in task_map and child in task_map:
#                 task_map[parent] >> task_map[child]

#         # Cleanup task
#         cleanup_task = PythonOperator(
#             task_id='cleanup_temporary_tables',
#             python_callable=lambda **kwargs: cleanup_on_success(),
#             op_kwargs={'tasks_list': overall_task_list, 'user_id': user_id, 'hierarchy_id': target_hierarchy_id},
#             trigger_rule=TriggerRule.ALL_DONE,
#         )

#         # Attach cleanup at the end of the flow
#         if config.get('flow', []):
#             last_task = config.get('flow')[-1][-1]
#             task_map[last_task] >> cleanup_task
#         else:
#             init_param_task >> cleanup_task

#         # SQL param tasks
#         for param in config.get('sql_parameters', []):
#             task_name = f"__sqlparam__{param['param_name']}"
#             sql_task = PythonOperator(
#                 task_id=task_name,
#                 python_callable=create_sql_param_task(param, user_id)
#             )
#             task_map[task_name] = sql_task
#             if param['order'] == 'before':
#                 sql_task >> task_map[param['dependent_task']]
#             elif param['order'] == 'after':
#                 task_map[param['dependent_task']] >> sql_task

#     globals()[dag_id] = dag
#     return dag