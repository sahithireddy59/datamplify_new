from django.shortcuts import render

from django.utils import timezone as dj_timezone
from math import ceil
from dateutil import tz
from datetime import timedelta

# Create your views here.
from rest_framework.views import APIView
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction 
from authentication.utils import token_function
from authentication.models import UserProfile
from Datamplify import settings
# Create your views here.
from rest_framework.response import Response
from rest_framework import status
from pytz import utc
import requests
from datetime import timezone,datetime
from FlowBoard.models import FlowBoard
from TaskPlan.models import TaskPlan
from Tasks_Scheduler.models import Schedule
from Service.utils import CustomPaginator,UUIDEncoder
from .serializers import Create_Schedulers,schedule_update
import os,json
from Tasks_Scheduler.utils import calculate_next_run
from authentication.permissions import require_permission,CustomIsAuthenticated
from django.utils.decorators import method_decorator
from oauth2_provider.contrib.rest_framework import OAuth2Authentication
from authentication.permissions import has_permission

class Schedulers(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]
    serializer_class = Create_Schedulers

    @csrf_exempt
    @method_decorator(require_permission('scheduler.create'))
    @transaction.atomic
    def post(self,request):
        user_id = request.user.id
        serializer = self.serializer_class(data = request.data)
        if serializer.is_valid(raise_exception=True):
            scheduler_type = serializer.validated_data['scheduler_type']
            cron_tab = serializer.validated_data['cron_tab']
            timezone = serializer.validated_data['timezone']
            source_type = serializer.validated_data['source_type']
            source_id = serializer.validated_data['source_id']
            user= UserProfile.objects.get(id=user_id)
            next_run = calculate_next_run(scheduler_type.lower(),cron_tab,timezone)
            if Schedule.objects.filter(source_id=source_id).exists():
                return Response({"message":"Task is already scheduled. Please update it."},status=status.HTTP_406_NOT_ACCEPTABLE)
            
            Schedule_creation = Schedule.objects.create(
                source_type = source_type.lower(),
                source_id = source_id,
                schedule_type = scheduler_type,
                schedule_value = cron_tab,
                timezone = timezone,
                next_run = next_run,
                last_run = None,
                status='active',
                user_id = user
            )
            if source_type.lower() == 'flowboard':
                if FlowBoard.objects.filter(id = source_id,user_id=user_id).exists():    
                    Flow_data = FlowBoard.objects.get(id = source_id,user_id=user_id)
                    configs_dir = f'{settings.config_dir}/FlowBoard/{str(user_id)}'
                    file_path = os.path.join(configs_dir, f'{Flow_data.Flow_id}.json')
                    with open(file_path, "r") as f:
                        data = json.load(f)
                    data['schedule_id'] =Schedule_creation.id
                    with open(file_path, "w") as f:  # 'w' mode to overwrite
                        json.dump(data, f, indent=4, cls=UUIDEncoder)
                    name = Flow_data.Flow_name
                    source_id =Flow_data.id 
                else:
                    return Response({'message':"Flow Board Doesn't Exists"},status=status.HTTP_404_NOT_FOUND)
            elif source_type.lower() =='taskplan':
                if TaskPlan.objects.filter(id = source_id,user_id=user_id).exists():    
                    Task_data = TaskPlan.objects.get(id = source_id,user_id=user_id)
                    configs_dir = f'{settings.config_dir}/TaskPlan/{str(user_id)}'
                    file_path = os.path.join(configs_dir, f'{Task_data.Task_id}.json')
                    with open(file_path, "r") as f:
                        data = json.load(f)
                    data['schedule_id'] =Schedule_creation.id
                    with open(file_path, "w") as f:  # 'w' mode to overwrite
                        json.dump(data, f, indent=4, cls=UUIDEncoder)
                    name = Task_data.Task_name
                    source_id = Task_data.id
                else:
                    return Response({'message':"Flow Board Doesn't Exists"},status=status.HTTP_404_NOT_FOUND)
            
            else:
                return Response({'messgae':'Source is Invalid'},status=status.HTTP_400_BAD_REQUEST)

            Schedule_creation.source_name = name
            Schedule_creation.save()
            if source_type.lower() =='flowboard':
                FlowBoard.objects.filter(id=source_id,user_id=user_id).update(scheduled=True,schedule_id = Schedule_creation.id)
            else:
                TaskPlan.objects.filter(id=source_id,user_id=user_id).update(scheduled=True,schedule_id = Schedule_creation.id)

            return Response({'message':f'{name} Scheduled Succesfully','Schedule_id':Schedule_creation.id},status=status.HTTP_200_OK)

        else:
            return Response({'message':'Serializer Error'},status=status.HTTP_400_BAD_REQUEST)
        
    @csrf_exempt
    @method_decorator(require_permission('scheduler.view'))
    @transaction.atomic
    def get(self, request):
        # Authenticate user``

        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if user.created_by_id:
            accessible_user_ids.append(user.created_by_id)
        paginator = CustomPaginator()
        page_number = request.query_params.get(paginator.page_query_param, 1)
        page_size = request.query_params.get(paginator.page_size_query_param, paginator.page_size)
        search = request.query_params.get('search','')
        status_filter =request.query_params.get('status','all') 
        try:
            page_number = int(page_number)
            page_size = min(int(page_size), paginator.max_page_size)
        except (ValueError, TypeError):
            return Response({"error": "Invalid pagination parameters"}, status=400)
        # if status_filter.lower() =='all':
        schedule_data = Schedule.objects.filter(user_id__in=accessible_user_ids).order_by('-updated_at')
        if search:
            schedule_data = schedule_data.filter(source_name__icontains = search)

        if status_filter!='all':
            schedule_data = schedule_data.filter(status = status_filter)

        total_schedules = schedule_data.count()
        total_pages = ceil(total_schedules / page_size)
        offset = (page_number - 1) * page_size
        limit = page_size

        data = schedule_data.values('id','last_run','next_run',
                                    'status','source_name','source_type','status','schedule_value')[offset:offset + limit]
        # data = []
        # for sched in schedules:
        #     data.append({
        #         "id": sched.id,
        #         "source_type": sched.source_type,
        #         "source_id": sched.source_id,
        #         "scheduler_type": sched.scheduler_type,
        #         "schedule_value": sched.schedule_value,
        #         "timezone": sched.timezone,
        #         "next_run": sched.next_run,
        #         "last_run": sched.last_run,
        #         "status": sched.status
        #     })
        return Response({"schedules": data,'total_pages': total_pages,
                            "total_records":total_schedules,
                            'page_number': page_number,
                            'page_size': page_size}, status=status.HTTP_200_OK)

    update_serializer = schedule_update
    @csrf_exempt
    @method_decorator(require_permission('scheduler.edit'))
    @transaction.atomic
    def put(self, request, schedule_id):

        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        try:
            schedule = Schedule.objects.get(id=schedule_id, user_id__in=accessible_user_ids, status='active')
        except Schedule.DoesNotExist:
            return Response({'message': 'Schedule not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.serializer_class(data = request.data)
        if serializer.is_valid(raise_exception=True):
            scheduler_type = serializer.validated_data['scheduler_type']
            cron_tab = serializer.validated_data['cron_tab']
            timezone = serializer.validated_data['timezone']
        else:
            return Response({'message':'Serializer Error'},status=status.HTTP_400_BAD_REQUEST)

        # Update JSON file
        # if schedule.source_type == 'flowboard':
        #     Flow_data = FlowBoard.objects.get(id=schedule.source_id, user_id=user_id)
        #     configs_dir = f'{settings.config_dir}/FlowBoard/{str(user_id)}'
        #     file_path = os.path.join(configs_dir, f'{Flow_data.Flow_id}.json')
        # elif schedule.source_type == 'taskplan':
        #     Task_data = TaskPlan.objects.get(id=schedule.source_id, user_id=user_id)
        #     configs_dir = f'{settings.config_dir}/TaskPlan/{str(user_id)}'
        #     file_path = os.path.join(configs_dir, f'{Task_data.Task_id}.json')
        # else:
        #     return Response({'message': 'Invalid source type'}, status=status.HTTP_400_BAD_REQUEST)

        # if os.path.exists(file_path):
        #     with open(file_path, 'r') as f:
        #         file_data = json.load(f)
        #     file_data['schedule_time'] = cron_tab
        #     file_data['timezone'] = timezone
        #     with open(file_path, 'w') as f:
        #         json.dump(file_data, f, indent=4)
        
        # Update schedule
        schedule.schedule_type = scheduler_type
        schedule.schedule_value = cron_tab
        schedule.timezone = timezone
        schedule.next_run = calculate_next_run(scheduler_type, cron_tab, timezone)
        schedule.save()
        
        return Response({'message': 'Schedule updated successfully','Schedule_id':schedule_id}, status=status.HTTP_200_OK)

    @csrf_exempt
    @method_decorator(require_permission('scheduler.delete'))
    @transaction.atomic
    def delete(self, request, schedule_id):

        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        try:
            schedule = Schedule.objects.get(id=schedule_id, user_id__in=accessible_user_ids)
        except Schedule.DoesNotExist:
            return Response({'message': 'Schedule not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Update JSON file: remove schedule_time
        if schedule.source_type == 'flowboard':
            Flow_data = FlowBoard.objects.get(id=schedule.source_id, user_id__in=accessible_user_ids)
            flow_owner_id = Flow_data.user_id.id if hasattr(Flow_data.user_id, 'id') else Flow_data.user_id

            configs_dir = f'{settings.config_dir}/FlowBoard/{str(flow_owner_id)}'
            file_path = os.path.join(configs_dir, f'{Flow_data.Flow_id}.json')
            Flow_data.scheduled = False
            Flow_data.schedule_id = None
            Flow_data.save()
        elif schedule.source_type == 'taskplan':
            Task_data = TaskPlan.objects.get(id=schedule.source_id, user_id__in=accessible_user_ids)
            task_owner_id = Task_data.user_id.id if hasattr(Task_data.user_id, 'id') else Task_data.user_id

            configs_dir = f'{settings.config_dir}/TaskPlan/{str(task_owner_id)}'
            file_path = os.path.join(configs_dir, f'{Task_data.Task_id}.json')
            Task_data.scheduled=False
            Task_data.schedule_id =None
            Task_data.save()
        else:
            return Response({'message': 'Invalid source type'}, status=status.HTTP_400_BAD_REQUEST)

        if os.path.exists(file_path):
            with open(file_path, 'r') as f:
                file_data = json.load(f)
            file_data['schedule_id'] = None
            with open(file_path, 'w') as f:
                json.dump(file_data, f, indent=4)
        
        # Soft delete in DB
        schedule.delete()

        return Response({'message': 'Schedule deleted successfully'}, status=status.HTTP_200_OK)




class UpcomingRuns(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    @csrf_exempt
    @method_decorator(require_permission('scheduler.view'))
    @transaction.atomic
    def get(self, request):

        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if user.created_by_id:
            accessible_user_ids.append(user.created_by_id)
        paginator = CustomPaginator()
        page_number = request.query_params.get(paginator.page_query_param, 1)
        page_size = request.query_params.get(paginator.page_size_query_param, paginator.page_size)
        search = request.query_params.get('search','')
        now_utc = dj_timezone.now()
        try:
            page_number = int(page_number)
            page_size = min(int(page_size), paginator.max_page_size)
        except (ValueError, TypeError):
            return Response({"error": "Invalid pagination parameters"}, status=400)
        
        upcoming_schedules = Schedule.objects.filter(user_id__in=accessible_user_ids,status='active').order_by('next_run')
        if search:
            upcoming_schedules = upcoming_schedules.filter( status='active',source_name__icontains = search)[offset:offset + limit]

        total_schedules = upcoming_schedules.count()
        total_pages = ceil(total_schedules / page_size)
        offset = (page_number - 1) * page_size
        limit = page_size

        result = []
        for sched in upcoming_schedules:
            if not sched.next_run:
                continue

            # Convert next_run to user's timezone
            try:
                user_tz = tz.gettz(sched.timezone)
                next_run_local = sched.next_run.astimezone(user_tz)
            except Exception:
                next_run_local = sched.next_run  # fallback

            time_diff = next_run_local - now_utc

            # Format remaining time
            if time_diff.total_seconds() <= 0:
                human_readable = "Due now"
            elif time_diff < timedelta(minutes=60):
                mins = int(time_diff.total_seconds() // 60)
                human_readable = f"in {mins} minute{'s' if mins > 1 else ''}"
            elif time_diff < timedelta(hours=24):
                hours = int(time_diff.total_seconds() // 3600)
                human_readable = f"in {hours} hour{'s' if hours > 1 else ''}"
            elif time_diff < timedelta(days=2):
                human_readable = f"tomorrow at {next_run_local.strftime('%I:%M %p')}"
            else:
                human_readable = next_run_local.strftime('%d-%b-%Y %I:%M %p')

            result.append({
                "id": sched.id,
                "source_name": sched.source_name,
                "source_type": sched.source_type,
                "schedule_type": sched.schedule_type,
                "schedule_value": sched.schedule_value,
                "timezone": sched.timezone,
                "next_run": next_run_local.strftime('%Y-%m-%d %I:%M %p'),
                "time_remaining": human_readable,
            })

        return Response({'data':result,
                            'total_pages': total_pages,
                            "total_records":total_schedules,
                            'page_number': page_number,
                            'page_size': page_size},status=status.HTTP_200_OK)
    



class ScheduleKPI(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    @csrf_exempt
    @method_decorator(require_permission('scheduler.view'))
    @transaction.atomic
    def get(self, request):

        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)

        total_count = Schedule.objects.filter(user_id__in=accessible_user_ids).count()

        active_count = Schedule.objects.filter(user_id__in=accessible_user_ids, status='active').count()

        inactive_count = Schedule.objects.filter(user_id__in=accessible_user_ids, status='inactive').count()

        data = {
            "total_schedules": total_count,
            "active_schedules": active_count,
            "inactive_schedules": inactive_count
        }

        return Response(data, status=status.HTTP_200_OK)
    



class ScheduleDetail(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    @csrf_exempt
    @method_decorator(require_permission('scheduler.view'))
    @transaction.atomic
    def get(self, request, schedule_id):
        # Token validation

        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)

        try:
            schedule = Schedule.objects.get(id=schedule_id, user_id__in=accessible_user_ids)
        except Schedule.DoesNotExist:
            return Response({'message': 'Schedule not found'}, status=status.HTTP_404_NOT_FOUND)

        # Prepare response
        data = {
            "id": schedule.id,
            "source_name": schedule.source_name,
            "source_type": schedule.source_type,
            "source_id": schedule.source_id,
            "schedule_type": schedule.schedule_type,
            "schedule_value": schedule.schedule_value,
            "timezone": schedule.timezone,
            "next_run": schedule.next_run,
            "last_run": schedule.last_run,
            "status": schedule.status
        }

        return Response(data, status=status.HTTP_200_OK)
    



class UpdateScheduleStatus(APIView):
    authentication_classes = [OAuth2Authentication]
    permission_classes = [CustomIsAuthenticated]

    @csrf_exempt
    @method_decorator(require_permission('scheduler.edit'))
    @transaction.atomic
    def patch(self, request):

        user= request.user
        user_id = user.id
        accessible_user_ids = [user_id]
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        schedule_id = request.data.get('schedule_id')
        new_status = request.data.get('status', '').lower()  # expecting 'active' or 'inactive'

        if not schedule_id or new_status not in ['active', 'inactive']:
            return Response({'message': 'Invalid input. Required: schedule_id and valid status (active/inactive).'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            schedule = Schedule.objects.get(id=schedule_id, user_id__in=accessible_user_ids)
        except Schedule.DoesNotExist:
            return Response({'message': 'Schedule not found for this user.'},
                            status=status.HTTP_404_NOT_FOUND)

        # Update status only if it’s different
        if schedule.status == new_status:
            return Response({'message': f'Schedule is already {new_status}.'},
                            status=status.HTTP_200_OK)
        
        

        schedule.status = new_status
        schedule.save(update_fields=['status'])

        return Response({
            'message': f'Schedule {schedule.source_name} updated successfully to {new_status}.',
            'schedule_id': str(schedule.id),
            'new_status': schedule.status
        }, status=status.HTTP_200_OK)
