from django.urls import path 
from TaskPlan.views import TaskPlan,Taskoperations,Task_List


urlpatterns = [
path('task/',TaskPlan.as_view(),name = 'Create Taskplan'), #post ,Update
path('task/<id>',Taskoperations.as_view(),name='get Task'), #GET ,Delete
path('list/',Task_List.as_view(),name='Task List')


]
