from django.urls import path
from Tasks_Scheduler.views import Schedulers,UpcomingRuns,ScheduleKPI,ScheduleDetail,UpdateScheduleStatus

urlpatterns = [
    path('schedule',Schedulers.as_view(),name='schedule post,get'),
    path('schedule_update/<schedule_id>',Schedulers.as_view(),name='schedule put,delete'),
    path('upcoming_runs/',UpcomingRuns.as_view(),name='upcoming Schedule runs'),
    path('kpis/',ScheduleKPI.as_view(),name='scheduled Kpis'),
    path('ScheduleDetail/<schedule_id>',ScheduleDetail.as_view(),name='ScheduleDetail get'),
    path('status_Update/',UpdateScheduleStatus.as_view(),name='make active and inactive apis'),
]