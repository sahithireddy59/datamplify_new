from django.urls import path 
from django.http import JsonResponse
from Monitor.views import Trigger_dag,DataFlow_status,Dataflow_Task_status,airflow_token_api,DashboardStatsAPIView,Rescent_Runs,Kpi_values

urlpatterns = [
path('test/', lambda request: JsonResponse({'message': 'Monitor URLs working'}), name='monitor_test'),
path('airflow_token/', airflow_token_api, name='airflow_token_api'),
path('Trigger/<str:id>/',Trigger_dag.as_view(),name = 'Trigger'),
path('Trigger/<str:id>',Trigger_dag.as_view(),name = 'Trigger_no_slash'),  # Fallback without slash 
path('status/',DataFlow_status.as_view(),name='Flow status'), 
path('task_status/',Dataflow_Task_status.as_view(),name='Task status'),

path('Home',DashboardStatsAPIView.as_view(),name='Home Dashboard'),

path('rescent_runs/',Rescent_Runs.as_view(),name='rescent runs'),

path('kpi_values/',Kpi_values.as_view(),name='Monitor Kpis')
]
