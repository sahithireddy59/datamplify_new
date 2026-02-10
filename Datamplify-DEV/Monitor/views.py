from django.shortcuts import render
from rest_framework.views import APIView
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction 
from authentication.utils import token_function
from Monitor.utils import airflow_token,count_by_date,time_ago
from Datamplify import settings
# Create your views here.
from rest_framework.response import Response
from django.http import JsonResponse
from rest_framework import status
from pytz import utc
import requests
from datetime import timezone,datetime,timedelta
from django.utils.timezone import now
from Monitor.serializers import flow_status,task_status
from rest_framework.views import APIView
from rest_framework.response import Response
from FlowBoard.models import FlowBoard
from TaskPlan.models import TaskPlan
from Service.utils import CustomPaginator
from .models import RunHistory
from django.db.models import Count
from math import ceil
from authentication.permissions import require_permission,require_any_permission,CustomIsAuthenticated
from django.utils.decorators import method_decorator
from oauth2_provider.contrib.rest_framework import OAuth2Authentication
from authentication.permissions import has_permission
import pytz

                 
@csrf_exempt
def airflow_token_api(request):
    if request.method == 'GET':
        login_url = settings.airflow_url
        payload = {
            "username": settings.airflow_username,
            "password": settings.airflow_password
        }
        try:
            response = requests.post(
                login_url,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            if response.status_code == 201:
                data = response.json()
                return JsonResponse({'token': data.get('access_token')}, status=200)
            else:
                return JsonResponse({'error': 'Unauthorized'}, status=401)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Invalid request method'}, status=405)     
   
         

class Trigger_dag(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    @csrf_exempt
    @transaction.atomic()
    def post(self,request,id):

        user_id = request.user.id
        type = request.query_params.get('type','flowboard')

        if type.lower() =='flowboard':
            required_perm = "flowboard.execute"
            
        else:
            required_perm = "taskplan.execute"
            
        had_perm  = has_permission(request,required_perm)
        
        if not had_perm:
            return Response({"message":"Permission Denied"},status=status.HTTP_401_UNAUTHORIZED)
        if type.lower() =='flowboard':
            required_perm = "flowboard.execute"
            model_data = FlowBoard.objects.get(Flow_id = id)
            name = model_data.Flow_name
        else:
            required_perm = "taskplan.execute"
            model_data = TaskPlan.objects.get(Task_id=id)
            name=model_data.Task_name

        air_token = airflow_token()
        url =f"{settings.airflow_host}/api/v2/dags/{id}/dagRuns"
        headers = {
            "Authorization": f"Bearer {air_token}"
        }
        import pytz
        now = datetime.now(pytz.utc)
        iso_time = now.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
        payload ={
            "conf":{},
            "logical_date": f"{iso_time}",

            }
        response = requests.post(url, headers=headers,json=payload)
        if response.status_code == 200:
            data = response.json()
            resp = {
                "run_id":data.get("dag_run_id"),
                "dag_id":data.get("dag_id"),
            }
            RunHistory.objects.create(
                run_id = data.get("dag_run_id"),
                source_type = type.lower(),
                source_id = id,
                name = name,
                status = 'running',
                started_at = now,
                finished_at = None,
                user_id=user_id    
            )
            return Response(resp,status=status.HTTP_200_OK)
        elif response.status_code ==404:
            return Response({'message':response.json()},status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({'message':response.json()},status=status.HTTP_400_BAD_REQUEST)
        


class DataFlow_status(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    serializer_class = flow_status

    @csrf_exempt
    @transaction.atomic()
    def post(self,request):

        user_id = request.user.id
        serializer = self.serializer_class(data = request.data)
        if serializer.is_valid(raise_exception=True):
            dag_id = serializer.validated_data['dag_id']
            run_id = serializer.validated_data['run_id']
            air_token = airflow_token()
            url =f"{settings.airflow_host}/api/v2/dags/{dag_id}/dagRuns/{run_id}/taskInstances"
            headers = {
                "Authorization": f"Bearer {air_token}"
            }
            response = requests.get(url, headers=headers)
            if response.status_code ==200:
                data = response.json()
                response_data = {
                    "tasks": [ {"task": task['task_id'], "state": task['state']} for task in data['task_instances'] ]
                }
                url =f"{settings.airflow_host}/api/v2/dags/{dag_id}/dagRuns/{run_id}"
                headers = {
                    "Authorization": f"Bearer {air_token}"
                }
                response = requests.get(url, headers=headers)
                if response.status_code ==200:
                    data = response.json()
                    final_status = data.get('state')
                    response_data['status'] = final_status
                    RunHistory.objects.filter(run_id=run_id,source_id = dag_id,user_id= user_id).update(status = final_status.lower(),finished_at = datetime.now(pytz.utc))
                    return Response(response_data,status=status.HTTP_200_OK)
                else:
                    return Response( response.json(),status=status.HTTP_400_BAD_REQUEST) 
            else:
                return Response( response.json(),status=status.HTTP_400_BAD_REQUEST) 
        else:
                return Response({'message':'Serializer Error'},status=status.HTTP_400_BAD_REQUEST)
                    

     
class Dataflow_Task_status(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]
    serializer_class = task_status

    @csrf_exempt
    @transaction.atomic()
    def post(self,request):
        serializer = self.serializer_class(data = request.data)
        if serializer.is_valid(raise_exception=True):
            dag_id = serializer.validated_data['dag_id']
            run_id = serializer.validated_data['run_id']
            task_id = serializer.validated_data['task_id']
            air_token = airflow_token() 
            logs_url = f"{settings.airflow_host}/api/v2/dags/{dag_id}/dagRuns/{run_id}/taskInstances/{task_id}/logs/1?map_index=-1"
            headers = {
                    "Authorization": f"Bearer {air_token}"
            }
            response = requests.get(logs_url, headers=headers)
            if response.status_code ==200:
                return Response(response.json(),status=status.HTTP_200_OK)
            else:
                return Response(response.json(),status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({'message':'Serializer Error'},status=status.HTTP_400_BAD_REQUEST)
        


################################# Dashboard Page ###################################

# class DashboardStatsAPIView(APIView):
#     authentication_classes = [OAuth2Authentication]
#     permission_classes = [CustomIsAuthenticated]

#     def get(self, request, *args, **kwargs):
        
#         user_id = request.user.id
#         period_days = int(request.query_params.get("period", 7))
#         type = request.query_params.get('type',None)
#         today = datetime.now(pytz.utc)
#         current_start = today - timedelta(days=period_days)
#         previous_start = today - timedelta(days=2 * period_days)

#         # --- Totals (static) ---
#         total_flowboard = FlowBoard.objects.filter(user_id=user_id).count()
#         total_taskplan = TaskPlan.objects.filter(user_id=user_id).count()
#         # --- Runs (current & previous) ---
#         current_flowboards =FlowBoard.objects.filter(created_at__gte = current_start,user_id = user_id).count()
#         # previous_flowboards = FlowBoard.objects.filter(
#         #     created_at__gte=previous_start,
#         #     created_at__lt=current_start
#         # ).count(),
#         current_taskplans = TaskPlan.objects.filter(created_at__gte = current_start,user_id=user_id).count()
#         # previous_taskplans =TaskPlan.objects.filter(
#         #     created_at__gte=previous_start,
#         #     created_at__lt=current_start
#         # ).count(),
#         current_runs = RunHistory.objects.filter(started_at__gte=current_start,user_id=user_id)
#         previous_runs = RunHistory.objects.filter(
#             started_at__gte=previous_start,
#             started_at__lt=current_start
#         )

#         # Current counts
#         kpi_runs = RunHistory.objects.filter(user_id=user_id)
        
#         kpi_data = count_by_date(kpi_runs)
#         count = kpi_data['counts']
        
#         #taskplan
#         taskplan_success_count = current_runs.filter(status="success",source_type = 'taskplan').count()
#         taskplan_failure_count = current_runs.filter(status="failed",source_type='taskplan').count()
#         taskplan_running_count = current_runs.filter(status="running",source_type = 'taskplan').count()

#         taskplan_data = [
#             {'name':'success','value':taskplan_success_count},
#             {'name':'failure','value':taskplan_failure_count},
#             {'name':'running','value':taskplan_running_count}
#         ]

#         #flowboard
#         flowboard_success_count = current_runs.filter(status="success",source_type = 'flowboard').count()
#         flowboard_failure_count = current_runs.filter(status="failed",source_type = 'flowboard').count()
#         flowboard_running_count = current_runs.filter(status="running",source_type = 'flowboard').count()

#         flowboard_data = [
#             {'name':'success','value':flowboard_success_count},
#             {'name':'failed','value':flowboard_failure_count},
#             {'name':'running','value':flowboard_running_count}
#         ]

#         # TaskBoard rates
#         # task_success_rate = (taskplan_success_count / total_runs * 100) if total_runs else 0
#         # task_failure_rate = (taskplan_failure_count / total_runs * 100) if total_runs else 0
#         # task_running_rate = (taskplan_running_count / total_runs * 100) if total_runs else 0

#         # Flowboard rates
#         # flow_success_rate = (flowboard_success_count / total_runs * 100) if total_runs else 0
#         # flow_failure_rate = (flowboard_failure_count / total_runs * 100) if total_runs else 0
#         # flow_running_rate = (flowboard_running_count / total_runs * 100) if total_runs else 0

#         # Rates
#         rate = kpi_data['rate']

#         # Previous period counts
#         prev_total = previous_runs.count()
#         prev_success = previous_runs.filter(status="success").count()
#         prev_failure = previous_runs.filter(status="failed").count()
#         prev_running = previous_runs.filter(status="running").count()

#         # --- Trend Calculation ---
#         def calc_trend(current, previous):
#             if previous == 0:
#                 return 100 if current > 0 else 0
#             return round(((current - previous) / previous) * 100, 1)

        

#         top_flowboards = (
#             RunHistory.objects
#             .filter(source_type="flowboard",user_id = user_id)
#             .values("source_id", "name")
#             .annotate(total_runs=Count("id"))
#             .order_by("-total_runs")[:5]
#         )
        
#         # Top 5 TaskPlan runs
#         top_taskplans = (
#             RunHistory.objects
#             .filter(source_type="taskplan",user_id = user_id)
#             .values("source_id", "name")
#             .annotate(total_runs=Count("id"))
#             .order_by("-total_runs")[:5]
#         )

#         # --- Status Distribution ---
#         status_distribution = {
#             'taskplan':taskplan_data,
#             'flowboard':flowboard_data
#         }
#         activity_list = ['recent','success','failed','running']
#         # --- Recent Activity (last 10 runs) ---
#         activity = {}

#         for type in activity_list:
#             if type ==None or type.lower() =='recent':
#                 recent_runs = current_runs.order_by("-started_at")[:5]
#             else:
#                 recent_runs = current_runs.filter(status=type).order_by("-started_at")[:5]
#             activity_list=[]
#             for run in recent_runs:
#                 if run.source_type.lower() == "flowboard":
#                     source = FlowBoard.objects.filter(Flow_id=run.source_id).first()
#                     name = source.Flow_name if source else "Unknown Flow"
#                 else:
#                     source = TaskPlan.objects.filter(Task_id=run.source_id).first()
#                     name = source.Task_name if source else "Unknown Task"
#                 if source:
#                     activity_list.append({
#                         "name": name,
#                         "type": run.source_type,
#                         "status": run.status,
#                         "id":source.id,
#                         "started_at": time_ago(run.started_at),
#                     })
#             activity[type] = activity_list

#         kpis= [
#                 round(rate['success'], 1),
#                 round(rate['failed'], 1),
#                 #  round(running_rate, 1),
#                 #  total_runs,
#                 total_flowboard,
#                 total_taskplan
#             ]
#         trends = [
#             calc_trend(count['success'], prev_success),
#             calc_trend(count['failed'], prev_failure),
#             current_flowboards,
#             current_taskplans
#         ]
                
#         kpi_list = ['Success Rate','Failure Rate','Total Flowboards','Total Taskplans']
#         kpi_data = [{'value':kpi,'change':trend,'trend':'up' if trend >=0 else 'down','title':title} for kpi,trend,title in zip(kpis,trends,kpi_list)]
#         # --- Final Response ---
#         data = {
#             'kpis':kpi_data,
            
#             "bar":{
#                 "flowboard":top_flowboards,
#                 "taskplan":top_taskplans
#             },
#             "status_distribution": status_distribution,
#             # "trends": trends,  # ⬅️ Added here
#             "recent_activity": activity,
#         }
#         return Response(data,status=status.HTTP_200_OK)
                

from django.db.models import Q, Count
from django.utils import timezone
from datetime import timedelta, datetime

# class DashboardStatsAPIView(APIView):
#     authentication_classes = [OAuth2Authentication]
#     permission_classes = [CustomIsAuthenticated]

#     @method_decorator(require_any_permission('flowboard.view', 'taskplan.view'))
#     def get(self, request, *args, **kwargs):
#         user_id = request.user.id
#         period_days = int(request.query_params.get("period", 7))
#         today = now()
#         current_start = today - timedelta(days=period_days)
#         previous_start = today - timedelta(days=2 * period_days)

#         # --- Permission-based data ---
#         has_flow_perm = request.user.has_perm('flowboard.view')
#         has_task_perm = request.user.has_perm('taskplan.view')

#         # Pre-filter data
#         flow_qs = FlowBoard.objects.filter(user_id=user_id) if has_flow_perm else FlowBoard.objects.none()
#         task_qs = TaskPlan.objects.filter(user_id=user_id) if has_task_perm else TaskPlan.objects.none()
#         run_qs = RunHistory.objects.filter(user_id=user_id)

#         # Current runs in one query
#         current_runs = run_qs.filter(started_at__gte=current_start)
#         previous_runs = run_qs.filter(started_at__gte=previous_start, started_at__lt=current_start)

#         # --- Totals ---
#         total_flowboard = flow_qs.count() if has_flow_perm else 0
#         total_taskplan = task_qs.count() if has_task_perm else 0

#         # --- Run counts (aggregated per status/type) ---
#         agg_current = (
#             current_runs.values("status", "source_type")
#             .annotate(total=Count("id"))
#         )
#         agg_prev = previous_runs.values("status","source_type").annotate(total=Count("id"))

#         # Quick lookup
#         def get_count(source_type, status):
#             return next(
#                 (a["total"] for a in agg_current if a["source_type"] == source_type and a["status"] == status),
#                 0
#             )

#         # --- Taskplan & Flowboard status distribution ---
#         taskplan_data = [
#             {"name": "success", "value": get_count("taskplan", "success")},
#             {"name": "failure", "value": get_count("taskplan", "failed")},
#             {"name": "running", "value": get_count("taskplan", "running")},
#         ]
#         flowboard_data = [
#             {"name": "success", "value": get_count("flowboard", "success")},
#             {"name": "failed", "value": get_count("flowboard", "failed")},
#             {"name": "running", "value": get_count("flowboard", "running")},
#         ]

#         # --- KPI Rates ---
#         # total_current = sum([a["total"] for a in agg_current])
#         status_map = {f"{a['source_type']}__{a['status']}": a["total"] for a in agg_current}
#         taskplan_success = status_map.get("taskplan__success", 0)
#         flowboard_success = status_map.get("flowboard__success", 0)

#         taskplan_failed  = status_map.get("taskplan__failed", 0)
#         flowboard_failed = status_map.get("flowboard__failed", 0)

#         total_success = taskplan_success + flowboard_success
#         total_failure = taskplan_failed + flowboard_failed
#         total_current = total_success + total_failure

#         success_rate = (total_success / total_current * 100) if total_current else 0
#         failure_rate = (total_failure / total_current * 100) if total_current else 0


#         # success_rate = (get_count("taskplan", "success") + get_count("flowboard", "success")) / total_current * 100 if total_current else 0
#         # failure_rate = (get_count("taskplan", "failed") + get_count("flowboard", "failed")) / total_current * 100 if total_current else 0

#         # --- Trends ---
#         prev_status_map = {
#             f"{a['source_type']}__{a['status']}": a["total"]
#             for a in agg_prev
#         }

#         prev_taskplan_success = prev_status_map.get("taskplan__success", 0)
#         prev_flowboard_success = prev_status_map.get("flowboard__success", 0)

#         prev_taskplan_failed = prev_status_map.get("taskplan__failed", 0)
#         prev_flowboard_failed = prev_status_map.get("flowboard__failed", 0)

#         prev_total_success = prev_taskplan_success + prev_flowboard_success
#         prev_total_failure = prev_taskplan_failed + prev_flowboard_failed

#         prev_total_runs = prev_total_success + prev_total_failure

#         prev_success_rate = (prev_total_success / prev_total_runs * 100) if prev_total_runs else 0
#         prev_failure_rate = (prev_total_failure / prev_total_runs * 100) if prev_total_runs else 0




#         def calc_trend(current, previous):
#             if previous == 0:
#                 return 100 if current > 0 else 0
#             return round(((current - previous) / previous) * 100, 1)

#         # --- Top 5 Flowboards / Taskplans ---
#         top_flowboards = (
#             current_runs.filter(source_type="flowboard")
#             .values("source_id", "name")
#             .annotate(total_runs=Count("id"))
#             .order_by("-total_runs")[:5]
#             if has_flow_perm else []
#         )
#         top_taskplans = (
#             current_runs.filter(source_type="taskplan")
#             .values("source_id", "name")
#             .annotate(total_runs=Count("id"))
#             .order_by("-total_runs")[:5]
#             if has_task_perm else []
#         )

#         # --- Recent Activity (in one query) ---
#         recent_runs = current_runs.order_by("-started_at")[:20]
#         activity = {"recent": [], "success": [], "failed": [], "running": []}

#         flow_map = {
#             flow_id: (flow_name, obj_id)
#             for flow_id, flow_name, obj_id in flow_qs.values_list("Flow_id", "Flow_name", "id")
#         }

#         task_map = {
#             task_id: (task_name, obj_id)
#             for task_id, task_name, obj_id in task_qs.values_list("Task_id", "Task_name", "id")
#         }

#         for run in recent_runs:
#             source_name,source_id = (
#                 flow_map.get(run.source_id,('Unknown',None))
#                 if run.source_type == "flowboard"
#                 else task_map.get(run.source_id)
#             ) or "Unknown"

#             run_obj = {
#                 "name": source_name,
#                 "type": run.source_type,
#                 "status": run.status,
#                 "id": source_id,
#                 "started_at": time_ago(run.started_at),
#             }

#             activity["recent"].append(run_obj)
#             if run.status in activity:
#                 activity[run.status].append(run_obj)

#         # --- Final KPIs ---
#         kpis = [
#             {"value": round(success_rate, 1), "change": calc_trend(success_rate, prev_success_rate), "trend": "up", "title": "Success Rate"},
#             {"value": round(failure_rate, 1), "change": calc_trend(failure_rate, prev_failure_rate), "trend": "up", "title": "Failure Rate"},
#             {"value": total_flowboard, "change": total_flowboard, "trend": "up", "title": "Total Flowboards"},
#             {"value": total_taskplan, "change": total_taskplan, "trend": "up", "title": "Total Taskplans"},
#         ]

#         return Response({
#             "kpis": kpis,
#             "bar": {"flowboard": list(top_flowboards), "taskplan": list(top_taskplans)},
#             "status_distribution": {
#                 "taskplan": taskplan_data,
#                 "flowboard": flowboard_data,
#             },
#             "recent_activity": activity
#         }, status=status.HTTP_200_OK)


from django.views.decorators.cache import cache_page

# class DashboardStatsAPIView(APIView):
#     authentication_classes = [OAuth2Authentication]
#     permission_classes = [CustomIsAuthenticated]

#     # @method_decorator(require_any_permission('flowboard.view', 'taskplan.view'))
#     # @method_decorator(cache_page(60 * 2), name='get')
#     def get(self, request, *args, **kwargs):
#         user = request.user
#         user_id = user.id
#         user_perms = request.custom_permissions

#         period_days = int(request.query_params.get("period", 7))
#         today = now()
#         current_start = today - timedelta(days=period_days)
#         previous_start = today - timedelta(days=2 * period_days)

#         # Permissions
#         print(user_perms)
#         has_flow_perm = 'flowboard.view' in user_perms
#         has_task_perm = 'taskplan.view' in user_perms
#         if not (has_flow_perm or has_task_perm):
#             return Response({"detail": "Permission denied"}, status=403)

#         # Prefetch only once
#         run_qs = RunHistory.objects.filter(user_id=user_id)

#         # Current + Previous runs (1 query each)
#         current_runs = run_qs.filter(started_at__gte=current_start)
#         previous_runs = run_qs.filter(started_at__gte=previous_start, started_at__lt=current_start)

#         # Totals (use .only() to reduce column fetch)
#         flow_qs = FlowBoard.objects.filter(user_id=user_id).only("Flow_id", "Flow_name") if has_flow_perm else FlowBoard.objects.none()
#         task_qs = TaskPlan.objects.filter(user_id=user_id).only("Task_id", "Task_name") if has_task_perm else TaskPlan.objects.none()

#         total_flowboard = flow_qs.values('id').count() if has_flow_perm else 0
#         total_taskplan = task_qs.values('id').count() if has_task_perm else 0

#         # ---------- AGGREGATIONS (HIGHLY OPTIMIZED) ----------
#         agg_current = list(
#             current_runs.values("status", "source_type").annotate(total=Count("id"))
#         )
#         agg_prev = list(
#             previous_runs.values("status", "source_type").annotate(total=Count("id"))
#         )

#         # Build maps using dicts (O(1) lookup instead of heavy loops)
#         status_map = {f"{a['source_type']}__{a['status']}": a["total"] for a in agg_current}
#         prev_status_map = {f"{a['source_type']}__{a['status']}": a["total"] for a in agg_prev}

#         # Current success / failure totals
#         taskplan_success = status_map.get("taskplan__success", 0)
#         flowboard_success = status_map.get("flowboard__success", 0)
#         taskplan_failed = status_map.get("taskplan__failed", 0)
#         flowboard_failed = status_map.get("flowboard__failed", 0)

#         total_success = taskplan_success + flowboard_success
#         total_failure = taskplan_failed + flowboard_failed
#         total_current = total_success + total_failure

#         success_rate = (total_success / total_current * 100) if total_current else 0
#         failure_rate = (total_failure / total_current * 100) if total_current else 0

#         # ---------- PREVIOUS PERIOD RATES ----------
#         prev_taskplan_success = prev_status_map.get("taskplan__success", 0)
#         prev_flowboard_success = prev_status_map.get("flowboard__success", 0)
#         prev_taskplan_failed = prev_status_map.get("taskplan__failed", 0)
#         prev_flowboard_failed = prev_status_map.get("flowboard__failed", 0)

#         prev_total_success = prev_taskplan_success + prev_flowboard_success
#         prev_total_failure = prev_taskplan_failed + prev_flowboard_failed

#         prev_total_runs = prev_total_success + prev_total_failure

#         prev_success_rate = (prev_total_success / prev_total_runs * 100) if prev_total_runs else 0
#         prev_failure_rate = (prev_total_failure / prev_total_runs * 100) if prev_total_runs else 0

#         # ---------- Trend ----------
#         def calc_trend(current, previous):
#             if previous == 0:
#                 return 100 if current > 0 else 0
#             return round(((current - previous) / previous) * 100, 1)

#         # ---------- STATUS DISTRIBUTION ----------
#         def m(type, st):
#             return status_map.get(f"{type}__{st}", 0)

#         taskplan_data = [
#             {"name": "success", "value": m("taskplan", "success")},
#             {"name": "failure", "value": m("taskplan", "failed")},
#             {"name": "running", "value": m("taskplan", "running")},
#         ]

#         flowboard_data = [
#             {"name": "success", "value": m("flowboard", "success")},
#             {"name": "failed", "value": m("flowboard", "failed")},
#             {"name": "running", "value": m("flowboard", "running")},
#         ]

#         # ---------- TOP 5 ----------
#         top_flowboards = list(
#             current_runs.filter(source_type="flowboard")
#                 .values("source_id", "name")
#                 .annotate(total_runs=Count("id"))
#                 .order_by("-total_runs")[:5]
#         ) if has_flow_perm else []

#         top_taskplans = list(
#             current_runs.filter(source_type="taskplan")
#                 .values("source_id", "name")
#                 .annotate(total_runs=Count("id"))
#                 .order_by("-total_runs")[:5]
#         ) if has_task_perm else []

#         # ---------- RECENT ACTIVITY ----------
#         recent_runs = list(
#                 current_runs
#                 .only("source_id", "source_type", "status", "started_at")
#                 .order_by("-started_at")[:20]
#             )

#         # Pre-map FlowBoards & TaskPlans once (fast O(N))
#         flow_map = {
#             f_id: (f_name, oid)
#             for f_id, f_name, oid in flow_qs.values_list("Flow_id", "Flow_name", "id")
#         }
#         task_map = {
#             t_id: (t_name, oid)
#             for t_id, t_name, oid in task_qs.values_list("Task_id", "Task_name", "id")
#         }

#         activity = {"recent": [], "success": [], "failed": [], "running": []}

#         for run in recent_runs:
#             source_name, source_id = (
#                 flow_map.get(run.source_id, ("Unknown", None))
#                 if run.source_type == "flowboard"
#                 else task_map.get(run.source_id, ("Unknown", None))
#             )

#             row = {
#                 "name": source_name,
#                 "type": run.source_type,
#                 "status": run.status,
#                 "id": source_id,
#                 "started_at": time_ago(run.started_at),
#             }

#             activity["recent"].append(row)
#             if run.status in activity:
#                 activity[run.status].append(row)

#         # ---------- FINAL KPIs ----------
#         kpis = [
#             {"value": round(success_rate, 1), "change": calc_trend(success_rate, prev_success_rate), "trend": "up", "title": "Success Rate"},
#             {"value": round(failure_rate, 1), "change": calc_trend(failure_rate, prev_failure_rate), "trend": "up", "title": "Failure Rate"},
#             {"value": total_flowboard, "change": total_flowboard, "trend": "up", "title": "Total Flowboards"},
#             {"value": total_taskplan, "change": total_taskplan, "trend": "up", "title": "Total Taskplans"},
#         ]

#         return Response({
#             "kpis": kpis,
#             "bar": {"flowboard": top_flowboards, "taskplan": top_taskplans},
#             "status_distribution": {"taskplan": taskplan_data, "flowboard": flowboard_data},
#             "recent_activity": activity
#         })

from django.db.models import Count, Q, Max

import authentication.models as auth_models

class DashboardStatsAPIView(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        user_id = user.id
        # user_perms = set(
        #     auth_models.Permission.objects.filter(
        #         roles__users=user_id
        #     ).distinct().values_list('code', flat=True)
        # )
        user_perms = request.custom_permissions

        # ---------- PERIOD ----------
        period_days = int(request.query_params.get("period", 7))
        today = now()
        current_start = today - timedelta(days=period_days)
        previous_start = today - timedelta(days=2 * period_days)

        # ---------- PERMISSIONS ----------
        has_flow_perm = 'flowboard.view' in user_perms
        has_task_perm = 'taskplan.view' in user_perms

        if not (has_flow_perm or has_task_perm):
            return Response({"detail": "Permission denied"}, status=403)

        # ---------- BASE QUERYSET (REUSED EVERYWHERE) ----------
        run_qs = RunHistory.objects.filter(
            user_id=user_id,
            started_at__gte=previous_start
        )

        # ---------- SINGLE AGGREGATION (CURRENT + PREVIOUS) ----------
        agg = list(
            run_qs
            .values("source_type", "status")
            .annotate(
                current=Count(
                    "id",
                    filter=Q(started_at__gte=current_start)
                ),
                previous=Count(
                    "id",
                    filter=Q(started_at__lt=current_start)
                ),
            )
        )

        # ---------- MAPS ----------
        current_map = {
            f"{a['source_type']}__{a['status']}": a["current"]
            for a in agg
        }
        prev_map = {
            f"{a['source_type']}__{a['status']}": a["previous"]
            for a in agg
        }

        # ---------- TOTALS ----------
        def g(m, t, s): return m.get(f"{t}__{s}", 0)

        task_success = g(current_map, "taskplan", "success")
        flow_success = g(current_map, "flowboard", "success")
        task_failed = g(current_map, "taskplan", "failed")
        flow_failed = g(current_map, "flowboard", "failed")

        total_success = task_success + flow_success
        total_failure = task_failed + flow_failed
        total_current = total_success + total_failure

        success_rate = (total_success / total_current * 100) if total_current else 0
        failure_rate = (total_failure / total_current * 100) if total_current else 0

        # ---------- PREVIOUS ----------
        prev_success = (
            g(prev_map, "taskplan", "success") +
            g(prev_map, "flowboard", "success")
        )
        prev_failure = (
            g(prev_map, "taskplan", "failed") +
            g(prev_map, "flowboard", "failed")
        )

        prev_total = prev_success + prev_failure

        prev_success_rate = (prev_success / prev_total * 100) if prev_total else 0
        prev_failure_rate = (prev_failure / prev_total * 100) if prev_total else 0

        # ---------- TREND ----------
        def calc_trend(current, previous):
            if previous == 0:
                return 100 if current > 0 else 0
            return round(((current - previous) / previous) * 100, 1)

        # ---------- STATUS DISTRIBUTION ----------
        taskplan_data = [
            {"name": "success", "value": g(current_map, "taskplan", "success")},
            {"name": "failure", "value": g(current_map, "taskplan", "failed")},
            {"name": "running", "value": g(current_map, "taskplan", "running")},
        ]

        flowboard_data = [
            {"name": "success", "value": g(current_map, "flowboard", "success")},
            {"name": "failed", "value": g(current_map, "flowboard", "failed")},
            {"name": "running", "value": g(current_map, "flowboard", "running")},
        ]

        # ---------- TOTAL COUNTS ----------
        total_flowboard = (
            FlowBoard.objects.filter(user_id=user_id).count()
            if has_flow_perm else 0
        )
        total_taskplan = (
            TaskPlan.objects.filter(user_id=user_id).count()
            if has_task_perm else 0
        )

        # ---------- TOP 5 (NO NAME IN GROUP BY) ----------
        top_flowboards = list(
            run_qs.filter(
                source_type="flowboard",
                started_at__gte=current_start
            )
            .values("source_id")
            .annotate(
                total_runs=Count("id"),
                name=Max("name")
            )
            .order_by("-total_runs")[:5]
        ) if has_flow_perm else []

        top_taskplans = list(
            run_qs.filter(
                source_type="taskplan",
                started_at__gte=current_start
            )
            .values("source_id")
            .annotate(
                total_runs=Count("id"),
                name=Max("name")
            )
            .order_by("-total_runs")[:5]
        ) if has_task_perm else []

        # ---------- RECENT ACTIVITY ----------
        recent_runs = list(
            run_qs
            .filter(started_at__gte=current_start)
            .only("source_id", "source_type", "status", "started_at")
            .order_by("-started_at")[:20]
        )

        flow_map = {
            f.Flow_id: (f.Flow_name, f.id)
            for f in FlowBoard.objects.filter(user_id=user_id)
        } if has_flow_perm else {}

        task_map = {
            t.Task_id: (t.Task_name, t.id)
            for t in TaskPlan.objects.filter(user_id=user_id)
        } if has_task_perm else {}

        activity = {"recent": [], "success": [], "failed": [], "running": []}

        for run in recent_runs:
            source_name, source_id = (
                flow_map.get(run.source_id, ("Unknown", None))
                if run.source_type == "flowboard"
                else task_map.get(run.source_id, ("Unknown", None))
            )

            row = {
                "name": source_name,
                "type": run.source_type,
                "status": run.status,
                "id": source_id,
                "started_at": time_ago(run.started_at),
            }

            activity["recent"].append(row)
            if run.status in activity:
                activity[run.status].append(row)

        # ---------- KPIS ----------
        kpis = [
            {"value": round(success_rate, 1), "change": calc_trend(success_rate, prev_success_rate), "trend": "up", "title": "Success Rate"},
            {"value": round(failure_rate, 1), "change": calc_trend(failure_rate, prev_failure_rate), "trend": "up", "title": "Failure Rate"},
            {"value": total_flowboard, "change": total_flowboard, "trend": "up", "title": "Total Flowboards"},
            {"value": total_taskplan, "change": total_taskplan, "trend": "up", "title": "Total Taskplans"},
        ]

        return Response({
            "kpis": kpis,
            "bar": {"flowboard": top_flowboards, "taskplan": top_taskplans},
            "status_distribution": {"taskplan": taskplan_data, "flowboard": flowboard_data},
            "recent_activity": activity
        })

class Kpi_values(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    def get(self,request):
        
        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if user.created_by_id:
            accessible_user_ids.append(user.created_by_id)
        today = datetime.now(pytz.utc)
        current_start = today - timedelta(days=1)
        
        current_data = RunHistory.objects.filter(started_at__gte=current_start,user_id__in=accessible_user_ids)

        kpi_data = count_by_date(current_data)
        counts = kpi_data['counts']
        rates = kpi_data['rate']
        Total_runs = kpi_data['total_runs']

        kpi_data = {
            'Running':counts['running'],
            'success':counts['success'],
            'failed':counts['failed'],
            'success_rate':rates['success'],
            'failure_rate':rates['failed']
        }
        return Response(kpi_data,status=status.HTTP_200_OK)

class Rescent_Runs(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    @method_decorator(require_permission('monitor.view'))
    def get(self,request):

        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if  user.created_by_id:
            accessible_user_ids.append(user.created_by_id)
        
        

        paginator = CustomPaginator()
        page_number = request.query_params.get(paginator.page_query_param, 1)
        page_size = request.query_params.get(paginator.page_size_query_param, 1000)
        search = request.query_params.get('search', '').strip()

        Runs_data = RunHistory.objects.filter(user_id__in=accessible_user_ids).order_by('-updated_at')
        if search:
            Runs_count = Runs_data.filter(name__icontains = search)
        
        Runs_count = Runs_data.count()

        try:
            page_number = int(page_number)
            page_size = min(int(page_size), paginator.max_page_size)
        except (ValueError, TypeError):
            return Response({"error": "Invalid pagination parameters"}, status=400)
        
        total_pages = ceil(Runs_count / page_size)
        offset = (page_number - 1) * page_size
        limit = page_size

        Runs_data = Runs_data.values('run_id','source_type','source_id','name','status','started_at')[offset:offset + limit]
        Runs_list = {
            'data':Runs_data,
            'total_pages': total_pages,
            "total_records":Runs_count,
            'page_number': page_number,
            'page_size': page_size
        }
        
        return Response({'runs_list':Runs_list},status=status.HTTP_200_OK)
        