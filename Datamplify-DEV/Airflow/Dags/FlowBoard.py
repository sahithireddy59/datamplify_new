



# # def check_dag_status(**context):
# #     ti = context['ti']
# #     dag_run = ti.get_dagrun()
# #     failed_tasks = []

# #     for task_instance in dag_run.get_task_instances():
# #         if task_instance.task_id not in ['dag_success_marker', 'cleanup_temporary_tables'] \
# #                 and task_instance.state != State.SUCCESS:
# #             failed_tasks.append((task_instance.task_id, task_instance.state))


# #     if failed_tasks:
# #         raise Exception(f"DAG failed due to task(s): {failed_tasks}")



# # def update_schedule_on_start(context):
# #     import pendulum
# #     dag_run = context.get('dag_run')
# #     if not dag_run:
# #         return

# #     # Check if DAG is triggered by scheduler (not manual)
# #     if dag_run.run_type == 'scheduled':
# #         from Tasks_Scheduler.models import Schedule  # import inside to avoid Airflow import issues

# #         dag_id = dag_run.dag_id
# #         execution_date = dag_run.execution_date
# #         next_run_date = dag_run.next_dagrun or pendulum.now('UTC')

# #         # Example: extract schedule_id if you include it in DAG ID or tags
# #         schedule_id = dag_id.split('_')[-1]  # adapt this to your logic

# #         # Update Django model
# #         Schedule.objects.filter(id=schedule_id).update(
# #             last_run_time=execution_date,
# #             next_run_time=next_run_date,
# #             updated_at=timezone.now()
# #         )
# #         print(f"Updated Schedule {schedule_id}: last_run={execution_date}, next_run={next_run_date}")
# #     else:
# #         print(f" DAG {dag_run.dag_id} was manually triggered. Skipping schedule update.")


# # def check_upstream_status(**context):
# #     ti = context["ti"]
# #     task = context["task"]

# #     # The runtime context gives upstream states in ti.task.upstream_task_ids
# #     failed_upstreams = [
# #         t for t in task.upstream_task_ids
# #         if ti.get_dependency_state(task_id=t) == "failed"
# #     ]

# #     if failed_upstreams:
# #         raise AirflowFailException(
# #             f"❌ Upstream tasks failed: {failed_upstreams} → failing DAG."
# #         )

# # from airflow.operators.dummy import DummyOperator



# # def update_schedule_start(context,config):
# #     dag_run = context["dag_run"]
# #     dag = context["dag"]

# #     # Only when it's run by scheduler (not manually triggered)
# #     if dag_run.run_type != "scheduled":
# #         return
# #     # Retrieve custom params
# #     schedule_id = dag.params.get("schedule_id")
# #     dag_id = dag_run.dag_id

# #     current_run = dag_run.execution_date
# #     next_run = dag.following_schedule(current_run)
# #     prev_run = dag.previous_schedule(current_run)

# #     try:
# #         from Tasks_Scheduler.models import Schedule
# #         from Monitor.models import RunHistory
# #         from FlowBoard.models import FlowBoard
# #         schedule_obj = Schedule.objects.get(id=schedule_id)
# #         schedule_obj.last_run = prev_run
# #         schedule_obj.next_run = next_run
# #         schedule_obj.updated_at = datetime.now()
# #         schedule_obj.save()


# #         # Now you can access fields
# #         RunHistory.objects.create(
# #             run_id=dag_run.run_id,
# #             source_type='flowboard',
# #             source_id=schedule_obj.source_id,
# #             name = schedule_obj.source_name,
# #             status ='running',
# #             user_id = schedule_obj.user_id

# #         )

# #     except Exception as e:
# #         print(f"⚠️ Error updating schedule times: {e}")


# # def run_external_command(user_command,return_type,fail=False):
# #     """
# #     command Line Execution
# #     """
# #     full_command = textwrap.dedent(f"""
# #         {user_command}
# #     """).strip()
# #     try:
# #         result = subprocess.run(
# #             full_command,
# #             shell=True,
# #             check=True,
# #             capture_output=True,
# #             text=True,
# #             executable="/bin/bash"
# #         )

# #         output = result.stdout.strip()
# #         if fail and not output:
# #             raise ValueError("Command succeeded but returned no output")
# #         else:
# #             pass
# #         return cast_output_by_type(output,return_type)
# #     except subprocess.CalledProcessError as e:
# #         raise
        



# # def Loop_parameters(task_details, user_id, **kwargs):
# #     """
# #     Creates Loop Parameters for command and sql and Push into Xcom Variables on Loop parameters Task Instance
# #     """
# #     ti = kwargs['ti']
# #     param_name = task_details['parameter_name']

# #     if task_details['loop_type'] == 'command':
# #         return_value = run_external_command(task_details['command'], task_details['return_type'], task_details['fail'])
# #     elif task_details['loop_type'] == 'sql':
# #         result = run_sql_commands(task_details['command'], task_details['hierarchy_id'], user_id)
# #         return_value = cast_output_by_type(result, task_details['return_type'])

# #     ti.xcom_push(key=param_name, value=return_value)



# # import json
# # def fetch_and_lock_dag_configs(limit=100):
# #     CONFIG_DIR = '/var/www/Configs/FlowBoard'
# #     # try:
# #     #     with connection.cursor() as cursor:
# #     #         cursor.execute("""
# #     #             WITH to_parse AS (
# #     #                 SELECT "Flow_id", "user_id"
# #     #                 FROM "FlowBoard"
# #     #                 WHERE "parsed" IS NULL OR "updated_at" > "parsed"
# #     #                 ORDER BY "updated_at" ASC
# #     #                 LIMIT %s
# #     #                 FOR UPDATE SKIP LOCKED
# #     #             )
# #     #             UPDATE "FlowBoard"
# #     #             SET "parsed" = NOW()
# #     #             FROM to_parse
# #     #             WHERE "FlowBoard"."Flow_id" = to_parse."Flow_id"
# #     #             RETURNING "FlowBoard"."Flow_id" AS flow_id, "FlowBoard"."user_id" AS user_id;
# #     #         """, [limit])
            
# #     #         rows = cursor.fetchall()
# #     #         print('[DEBUG] Locked rows:', rows)

# #     #         if not rows:
# #     #             return

# #     #         for flow_id, user_id in rows:
# #     #             full_path = os.path.join(base_dir, f'{user_id}/{flow_id}.json')
# #     #             try:
# #     #                 with open(full_path) as f:
# #     #                     config_json = json.load(f)
# #     #                     yield flow_id, config_json
# #     #             except Exception as e:
# #     #                 print(f"[ERROR] Failed to parse {full_path}: {e}")

# #     # except Exception as e:
# #     #     print(f"[ERROR] Database error: {e}")
# #     json_count = 0
# #     try:
# #         with os.scandir(CONFIG_DIR) as users:
# #             for user_entry in users:
# #                 if not user_entry.is_dir():
# #                     continue
# #                 with os.scandir(user_entry.path) as files:
# #                     for file_entry in files:
# #                         if not file_entry.is_file() or not file_entry.name.endswith('.json'):
# #                             continue
# #                         json_count += 1
# #                         if json_count > limit:
# #                             return
# #                         flow_id = file_entry.name[:-5]
# #                         filepath = file_entry.path
# #                         try:
# #                             with open(filepath) as f:
# #                                 config = json.load(f)
# #                                 yield flow_id, config
# #                         except Exception as e:
# #                             print(f" Failed to load {filepath}: {e}")
# #     except Exception as e:
# #         print(f"[ERROR] Scanning config directory {CONFIG_DIR} failed: {e}")



# # def get_configs():
# #     # CONFIG_DIR = '/var/www/configs' if settings.DATABASES['default']['NAME'] == 'analytify_qa' else 'configs'
# #     configs = []

# #     for file in os.listdir(CONFIG_DIR):
# #         if file.endswith(".json"):
# #             with open(os.path.join(CONFIG_DIR, file)) as f:
# #                 configs.append(json.load(f))
# #     return configs

# # import sys, os
# # sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
# # sys.path.insert(0, '/var/www/Datamplify')  # adjust if different
# # os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Datamplify.settings")
# # try:
# #     import django
# #     django.setup()
# # except Exception as e:
# #     # keep parse from failing loudly; Airflow scheduler logs will show this if misconfigured
# #     print(f"[WARN] Django setup failed at parse time: {e}")
# # sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))




# # from Flowboard_genaric_dag import generate_dynamic_dag
# # import uuid
# # dag_configs = list(fetch_and_lock_dag_configs() or [])

# # if not dag_configs:
# #     # print("[INFO] No new DAG configs found to parse.")
# #     pass
# # else:
        
# #     for dag_id, config in dag_configs:
# #         # try:
# #         print(f"[INFO] Attempting DAG generation for {dag_id}")
# #         dag = generate_dynamic_dag(
# #             dag_id=str(dag_id),
# #             user_id=uuid.UUID(config['user_id']),
# #             user_name=config['username'],
# #             config=config
# #         )
# #         # if not isinstance(dag, DAG):
# #         #     print.error(f" {dag_id}: Not a DAG instance: {type(dag)}")
# #         #     continue
# #         if not dag.dag_id:
# #             print.error(f" {dag_id}: dag_id is None")
# #             continue

# #         # Optional debug dump

# #         globals()[dag_id] = dag
# #         # except Exception as e:
# #         #     print(f" DAG creation failed for {dag_id}: {e}")
# #         #     continue
# #             # traceback.print_exc()


# # try:
# #         with connection.cursor() as cursor:
# #             cursor.execute("""
# #                 WITH to_parse AS (
# #                     SELECT "Flow_id", "user_id"
# #                     FROM "FlowBoard"
# #                     WHERE "parsed" IS NULL OR "updated_at" > "parsed"
# #                     ORDER BY "updated_at" ASC
# #                     LIMIT %s
# #                     FOR UPDATE SKIP LOCKED
# #                 )
# #                 UPDATE "FlowBoard"
# #                 SET "parsed" = NOW()
# #                 FROM to_parse
# #                 WHERE "FlowBoard"."Flow_id" = to_parse."Flow_id"
# #                 RETURNING "FlowBoard"."Flow_id" AS flow_id, "FlowBoard"."user_id" AS user_id;
# #             """, [limit])
            
# #             rows = cursor.fetchall()
# #             print('[DEBUG] Locked rows:', rows)

# #             if not rows:
# #                 return

# #             for flow_id, user_id in rows:
# #                 full_path = os.path.join(base_dir, f'{user_id}/{flow_id}.json')
# #                 try:
# #                     with open(full_path) as f:
# #                         config_json = json.load(f)
# #                         yield flow_id, config_json
# #                 except Exception as e:
# #                     print(f"[ERROR] Failed to parse {full_path}: {e}")

# #     except Exception as e:
# #         print(f"[ERROR] Database error: {e}")


# import os
# import json
# import uuid
# from airflow import DAG
# from Flowboard_genaric_dag import generate_dynamic_dag

# CONFIG_DIR = '/var/www/Configs/FlowBoard'
# MAX_DAGS = 100  # Limit DAGs parsed per scheduler cycle

# def fetch_and_lock_dag_configs(limit=100):
#     """Generator that fetches JSON DAG configs from folder"""
#     count = 0
#     try:
#         with os.scandir(CONFIG_DIR) as users:
#             for user_entry in users:
#                 if not user_entry.is_dir():
#                     continue
#                 with os.scandir(user_entry.path) as files:
#                     for file_entry in files:
#                         if not file_entry.is_file() or not file_entry.name.endswith('.json'):
#                             continue
#                         count += 1
#                         if count > limit:
#                             return
#                         flow_id = file_entry.name[:-5]
#                         filepath = file_entry.path
#                         try:
#                             with open(filepath) as f:
#                                 config = json.load(f)
#                                 yield flow_id, config
#                         except Exception as e:
#                             print(f"[ERROR] Failed to load {filepath}: {e}")
#     except Exception as e:
#         print(f"[ERROR] Scanning config directory failed: {e}")
#     """
#     Fetch FlowBoard DAG configs that are new or updated, lock rows to avoid double parsing,
#     mark them as parsed, and yield (flow_id, config_json) tuples.
#     """
#     # from django.db import connection

#     # try:
#     #     with connection.cursor() as cursor:
#     #         cursor.execute("""
#     #             WITH to_parse AS (
#     #                 SELECT "Flow_id", "user_id"
#     #                 FROM "FlowBoard"
#     #                 WHERE "parsed" IS NULL OR "updated_at" > "parsed"
#     #                 ORDER BY "updated_at" ASC
#     #                 LIMIT %s
#     #                 FOR UPDATE SKIP LOCKED
#     #             )
#     #             UPDATE "FlowBoard"
#     #             SET "parsed" = NOW()
#     #             FROM to_parse
#     #             WHERE "FlowBoard"."Flow_id" = to_parse."Flow_id"
#     #             RETURNING "FlowBoard"."Flow_id" AS flow_id, "FlowBoard"."user_id" AS user_id;
#     #         """, [limit])
            
#     #         rows = cursor.fetchall()
#     #         if not rows:
#     #             return  # nothing to parse
            
#     #         for flow_id, user_id in rows:
#     #             full_path = os.path.join(CONFIG_DIR, str(user_id), f"{flow_id}.json")
#     #             try:
#     #                 with open(full_path) as f:
#     #                     config_json = json.load(f)
#     #                     yield flow_id, config_json
#     #             except FileNotFoundError:
#     #                 print(f"[ERROR] JSON file not found: {full_path}")
#     #             except json.JSONDecodeError:
#     #                 print(f"[ERROR] Invalid JSON in file: {full_path}")
#     #             except Exception as e:
#     #                 print(f"[ERROR] Failed to load {full_path}: {e}")

#     # except Exception as e:
#     #     print(f"[ERROR] Database error: {e}")


# # ---------------------------
# # Lazy DAG generation
# # ---------------------------
# for dag_id, config in fetch_and_lock_dag_configs():
#     def lazy_dag(dag_id=dag_id, config=config):
#         from Flowboard_genaric_dag import generate_dynamic_dag
#         return generate_dynamic_dag(
#             dag_id=str(dag_id),
#             user_id=uuid.UUID(config['user_id']),
#             user_name=config['username'],
#             config=config
#         )
#     globals()[dag_id] = lazy_dag()

import os
import json
import uuid
import logging
from airflow import DAG
from datetime import datetime
from functools import lru_cache

# ---------------------------------------------
# CONFIGURATION
# ---------------------------------------------
# Use the mounted path in Docker container
CONFIG_DIR = '/opt/airflow/project/Configs/FlowBoard'
MAX_DAGS = 100000  # supports 10k+ DAGs efficiently
log = logging.getLogger(__name__)
# log.info(f'context-------{get_parsing_context()}')



# ---------------------------------------------
# UTILITY FUNCTIONS
# ---------------------------------------------
def list_dag_files(limit=None):
    """List all user DAG config JSONs from the directory."""
    count = 0
    try:
        for user_entry in os.scandir(CONFIG_DIR):
            if not user_entry.is_dir():
                continue
            for file_entry in os.scandir(user_entry.path):
                if file_entry.is_file() and file_entry.name.endswith('.json'):
                    dag_id = file_entry.name[:-5]
                    full_path = file_entry.path
                    yield dag_id, full_path
                    count += 1
                    if limit and count >= limit:
                        return
    except Exception as e:
        log.error(f"[ERROR] Failed to scan {CONFIG_DIR}: {e}")


@lru_cache(maxsize=2048)
def load_config(path: str):
    """Load JSON config from file (cached)."""
    try:
        with open(path) as f:
            return json.load(f)
    except Exception as e:
        log.error(f"[ERROR] Failed to load JSON {path}: {e}")
        return None


def generate_dynamic_dag_from_file(dag_id, path):
    """Lazy-load the JSON file only when the DAG is accessed."""
    config = load_config(path)
    if not config:
        raise ValueError(f"Config for DAG {dag_id} not found or invalid.")
    from Flowboard_genaric_dag import generate_dynamic_dag  # imported only when needed

    return generate_dynamic_dag(
        dag_id=str(dag_id),
        user_id=uuid.UUID(config['user_id']),
        user_name=config.get('username', 'unknown'),
        config=config
    )


# ---------------------------------------------
# DAG REGISTRATION (Lazy-Load pattern)
# ---------------------------------------------
for dag_id, path in list_dag_files(limit=MAX_DAGS):
    # Create lightweight placeholder callable
    def _factory(dag_id=dag_id, path=path):
        return generate_dynamic_dag_from_file(dag_id, path)

    globals()[dag_id] = _factory() # Lazy registration only, not creation


# ---------------------------------------------
# NOTES:
# - Airflow will call _factory(dag_id) only when it needs the DAG.
# - This keeps parse time constant even with 10,000+ configs.
# - Avoids globals() registration inside generate_dynamic_dag().
# ---------------------------------------------
