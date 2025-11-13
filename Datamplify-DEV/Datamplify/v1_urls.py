from django.contrib import admin
from django.urls import path,include

urlpatterns = [
    path('flowboard/',include('FlowBoard.urls')),
    path('connections/',include('Connections.urls')),
    path('authentication/',include('authentication.urls')),
    path('taskplan/',include('TaskPlan.urls')),
    path('monitor/',include('Monitor.urls')),
    path('schedule/',include('Tasks_Scheduler.urls')),
]
