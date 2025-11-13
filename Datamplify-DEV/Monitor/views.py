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
from datetime import datetime
from Monitor.serializers import flow_status,task_status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils.timezone import now, timedelta
from django.utils import timezone
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

    def get(self,request,id):
        """Test endpoint to verify URL routing works"""
        return Response({'message': f'GET request received for DAG ID: {id}', 'path': request.path})
    
    @csrf_exempt
    @transaction.atomic()
    def post(self,request,id):
        print(f"🔍 Trigger_dag POST called with id: {id}")
        print(f"🔍 Request path: {request.path}")
        print(f"🔍 Query params: {request.query_params}")

        user_id = request.user.id
        type = request.query_params.get('type','flowboard')
        print(f"🔍 User ID: {user_id}, Type: {type}")

        if type.lower() =='flowboard':
            required_perm = "flowboard.execute"
            
        else:
            required_perm = "taskplan.execute"
            
        had_perm  = has_permission(request.user,required_perm)
        
        if not had_perm:
            return Response({"message":"Permission Denied"},status=status.HTTP_401_UNAUTHORIZED)
        try:
            if type.lower() =='flowboard':
                required_perm = "flowboard.execute"
                print(f"🔍 Looking for FlowBoard with Flow_id: {id}")
                model_data = FlowBoard.objects.get(Flow_id = id)
                name = model_data.Flow_name
                print(f"✅ Found FlowBoard: {name}")
            else:
                required_perm = "taskplan.execute"
                print(f"🔍 Looking for TaskPlan with Task_id: {id}")
                model_data = TaskPlan.objects.get(Task_id=id)
                name=model_data.Task_name
                print(f"✅ Found TaskPlan: {name}")
        except FlowBoard.DoesNotExist:
            print(f"❌ FlowBoard with Flow_id '{id}' not found in database")
            print(f"🔍 Available FlowBoard IDs: {list(FlowBoard.objects.values_list('Flow_id', flat=True))}")
            return Response({'message': f'FlowBoard with ID {id} not found'}, status=status.HTTP_404_NOT_FOUND)
        except TaskPlan.DoesNotExist:
            print(f"❌ TaskPlan with Task_id '{id}' not found in database")
            return Response({'message': f'TaskPlan with ID {id} not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"❌ Error finding model data: {e}")
            import traceback
            traceback.print_exc()
            return Response({'message': f'Error finding model data: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        print(f"🔍 Getting Airflow authentication...")
        air_auth = airflow_token()
        if not air_auth:
            print(f"❌ Failed to get Airflow authentication")
            return Response({'message': 'Failed to authenticate with Airflow'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        print(f"✅ Airflow authentication successful")
        
        # Use API v1 with correct endpoint format (dagRuns with capital R)
        url = f"{settings.airflow_host}/api/v1/dags/{id}/dagRuns"
        now = timezone.now()
        iso_time = now.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
        
        print(f"🔍 Airflow URL: {url}")
        print(f"🔍 Payload timestamp: {iso_time}")
        payload ={
            "conf":{},
            "logical_date": f"{iso_time}",

            }
        # Use auth object (either HTTPBasicAuth or Session)
        print(f"🔍 Making Airflow API call...")
        if hasattr(air_auth, 'get'):  # It's a session
            response = air_auth.post(url, json=payload)
        else:  # It's HTTPBasicAuth
            response = requests.post(url, auth=air_auth, json=payload)
        
        print(f"🔍 Airflow API response status: {response.status_code}")
        print(f"🔍 Airflow API response text: {response.text[:500]}")
        
        # Handle JSON parsing safely
        try:
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
            elif response.status_code == 404:
                try:
                    error_data = response.json()
                except:
                    error_data = {"error": "DAG not found", "details": response.text[:200]}
                return Response({'message': error_data}, status=status.HTTP_404_NOT_FOUND)
            else:
                try:
                    error_data = response.json()
                except:
                    error_data = {"error": f"Airflow API error (status: {response.status_code})", "details": response.text[:200]}
                return Response({'message': error_data}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'message': f"Error communicating with Airflow: {str(e)}",
                'status_code': response.status_code,
                'response_text': response.text[:200] if hasattr(response, 'text') else 'No response text'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        


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
            air_auth = airflow_token()
            if not air_auth:
                return Response({'message': 'Failed to authenticate with Airflow'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # Use API v1 with correct endpoint format
            url = f"{settings.airflow_host}/api/v1/dags/{dag_id}/dagRuns/{run_id}/taskInstances"
            
            # Use auth object instead of headers
            if hasattr(air_auth, 'get'):  # It's a session
                response = air_auth.get(url)
            else:  # It's HTTPBasicAuth
                response = requests.get(url, auth=air_auth)
            try:
                if response.status_code == 200:
                    data = response.json()
                    response_data = {
                        "tasks": [ {"task": task['task_id'], "state": task['state']} for task in data['task_instances'] ]
                    }
                    # Get DAG run status using API v1
                    url = f"{settings.airflow_host}/api/v1/dags/{dag_id}/dagRuns/{run_id}"
                    
                    if hasattr(air_auth, 'get'):  # It's a session
                        response = air_auth.get(url)
                    else:  # It's HTTPBasicAuth
                        response = requests.get(url, auth=air_auth)
                    if response.status_code == 200:
                        try:
                            data = response.json()
                            final_status = data.get('state')
                            response_data['status'] = final_status
                            RunHistory.objects.filter(run_id=run_id,source_id = dag_id,user_id= user_id).update(status = final_status.lower(),finished_at = timezone.now())
                            return Response(response_data,status=status.HTTP_200_OK)
                        except:
                            return Response({'message': 'Error parsing DAG run status response'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                    else:
                        try:
                            error_data = response.json()
                        except:
                            error_data = {"error": f"Airflow API error (status: {response.status_code})", "details": response.text[:200]}
                        return Response(error_data, status=status.HTTP_400_BAD_REQUEST) 
                else:
                    try:
                        error_data = response.json()
                    except:
                        error_data = {"error": f"Airflow API error (status: {response.status_code})", "details": response.text[:200]}
                    return Response(error_data, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                return Response({
                    'message': f"Error communicating with Airflow: {str(e)}",
                    'status_code': response.status_code if 'response' in locals() else 'unknown'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR) 
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
            air_auth = airflow_token()
            if not air_auth:
                return Response({'message': 'Failed to authenticate with Airflow'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # Use API v1 for task logs
            logs_url = f"{settings.airflow_host}/api/v1/dags/{dag_id}/dagRuns/{run_id}/taskInstances/{task_id}/logs/1?map_index=-1"
            # Use auth object instead of headers
            if hasattr(air_auth, 'get'):  # It's a session
                response = air_auth.get(logs_url)
            else:  # It's HTTPBasicAuth
                response = requests.get(logs_url, auth=air_auth)
            try:
                if response.status_code == 200:
                    # Task logs might be plain text, not JSON
                    try:
                        # Try to parse as JSON first
                        log_data = response.json()
                        return Response(log_data, status=status.HTTP_200_OK)
                    except:
                        # If not JSON, return the text content wrapped in a JSON response
                        log_content = response.text
                        return Response({
                            "logs": log_content,
                            "task_id": task_id,
                            "dag_id": dag_id,
                            "run_id": run_id
                        }, status=status.HTTP_200_OK)
                else:
                    try:
                        error_data = response.json()
                    except:
                        error_data = {"error": f"Airflow API error (status: {response.status_code})", "details": response.text[:200]}
                    return Response(error_data, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                return Response({
                    'message': f"Error communicating with Airflow: {str(e)}",
                    'status_code': response.status_code if 'response' in locals() else 'unknown'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
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
#         today = datetime.now(timezone.utc)
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

class DashboardStatsAPIView(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    @method_decorator(require_any_permission('flowboard.view', 'taskplan.view'))
    def get(self, request, *args, **kwargs):
        user_id = request.user.id
        period_days = int(request.query_params.get("period", 7))
        today = now()
        current_start = today - timedelta(days=period_days)
        previous_start = today - timedelta(days=2 * period_days)

        # --- Permission-based data ---
        has_flow_perm = request.user.has_perm('flowboard.view')
        has_task_perm = request.user.has_perm('taskplan.view')

        # Pre-filter data
        flow_qs = FlowBoard.objects.filter(user_id=user_id) if has_flow_perm else FlowBoard.objects.none()
        task_qs = TaskPlan.objects.filter(user_id=user_id) if has_task_perm else TaskPlan.objects.none()
        run_qs = RunHistory.objects.filter(user_id=user_id)

        # Current runs in one query
        current_runs = run_qs.filter(started_at__gte=current_start)
        previous_runs = run_qs.filter(started_at__gte=previous_start, started_at__lt=current_start)

        # --- Totals ---
        total_flowboard = flow_qs.count() if has_flow_perm else 0
        total_taskplan = task_qs.count() if has_task_perm else 0

        # --- Run counts (aggregated per status/type) ---
        agg_current = (
            current_runs.values("status", "source_type")
            .annotate(total=Count("id"))
        )
        agg_prev = previous_runs.values("status").annotate(total=Count("id"))

        # Quick lookup
        def get_count(source_type, status):
            return next(
                (a["total"] for a in agg_current if a["source_type"] == source_type and a["status"] == status),
                0
            )

        # --- Taskplan & Flowboard status distribution ---
        taskplan_data = [
            {"name": "success", "value": get_count("taskplan", "success")},
            {"name": "failure", "value": get_count("taskplan", "failed")},
            {"name": "running", "value": get_count("taskplan", "running")},
        ]
        flowboard_data = [
            {"name": "success", "value": get_count("flowboard", "success")},
            {"name": "failed", "value": get_count("flowboard", "failed")},
            {"name": "running", "value": get_count("flowboard", "running")},
        ]

        # --- KPI Rates ---
        total_current = sum([a["total"] for a in agg_current])
        success_rate = (get_count("taskplan", "success") + get_count("flowboard", "success")) / total_current * 100 if total_current else 0
        failure_rate = (get_count("taskplan", "failed") + get_count("flowboard", "failed")) / total_current * 100 if total_current else 0

        # --- Trends ---
        prev_success = next((a["total"] for a in agg_prev if a["status"] == "success"), 0)
        prev_failure = next((a["total"] for a in agg_prev if a["status"] == "failed"), 0)

        def calc_trend(current, previous):
            if previous == 0:
                return 100 if current > 0 else 0
            return round(((current - previous) / previous) * 100, 1)

        # --- Top 5 Flowboards / Taskplans ---
        top_flowboards = (
            current_runs.filter(source_type="flowboard")
            .values("source_id", "name")
            .annotate(total_runs=Count("id"))
            .order_by("-total_runs")[:5]
            if has_flow_perm else []
        )
        top_taskplans = (
            current_runs.filter(source_type="taskplan")
            .values("source_id", "name")
            .annotate(total_runs=Count("id"))
            .order_by("-total_runs")[:5]
            if has_task_perm else []
        )

        # --- Recent Activity (in one query) ---
        recent_runs = current_runs.order_by("-started_at")[:10]
        activity = {"recent": [], "success": [], "failed": [], "running": []}

        flow_map = dict(flow_qs.values_list("Flow_id", "Flow_name"))
        task_map = dict(task_qs.values_list("Task_id", "Task_name"))

        for run in recent_runs:
            source_name = (
                flow_map.get(run.source_id)
                if run.source_type == "flowboard"
                else task_map.get(run.source_id)
            ) or "Unknown"

            run_obj = {
                "name": source_name,
                "type": run.source_type,
                "status": run.status,
                "id": run.id,
                "started_at": time_ago(run.started_at),
            }

            activity["recent"].append(run_obj)
            if run.status in activity:
                activity[run.status].append(run_obj)

        # --- Final KPIs ---
        kpis = [
            {"value": round(success_rate, 1), "change": calc_trend(success_rate, prev_success), "trend": "up", "title": "Success Rate"},
            {"value": round(failure_rate, 1), "change": calc_trend(failure_rate, prev_failure), "trend": "up", "title": "Failure Rate"},
            {"value": total_flowboard, "change": total_flowboard, "trend": "up", "title": "Total Flowboards"},
            {"value": total_taskplan, "change": total_taskplan, "trend": "up", "title": "Total Taskplans"},
        ]

        return Response({
            "kpis": kpis,
            "bar": {"flowboard": list(top_flowboards), "taskplan": list(top_taskplans)},
            "status_distribution": {
                "taskplan": taskplan_data,
                "flowboard": flowboard_data,
            },
            "recent_activity": activity
        }, status=status.HTTP_200_OK)


class Kpi_values(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    def get(self,request):
        
        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        today = timezone.now()
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
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        
        
        Runs_count = RunHistory.objects.filter(user_id__in=accessible_user_ids).count()

        paginator = CustomPaginator()
        page_number = request.query_params.get(paginator.page_query_param, 1)
        page_size = request.query_params.get(paginator.page_size_query_param, 1000)
        search = request.query_params.get('search', '').strip()

        try:
            page_number = int(page_number)
            page_size = min(int(page_size), paginator.max_page_size)
        except (ValueError, TypeError):
            return Response({"error": "Invalid pagination parameters"}, status=400)
        
        total_pages = ceil(Runs_count / page_size)
        offset = (page_number - 1) * page_size
        limit = page_size

        Runs_data = RunHistory.objects.filter(user_id=user_id,name__icontains = search).values('run_id','source_type','source_id','name','status','started_at').order_by('-updated_at')[offset:offset + limit]
        Runs_list = {
            'data':Runs_data,
            'total_pages': total_pages,
            "total_records":Runs_count,
            'page_number': page_number,
            'page_size': page_size
        }
        
        return Response({'runs_list':Runs_list},status=status.HTTP_200_OK)
        