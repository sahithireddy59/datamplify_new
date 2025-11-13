from django.urls import path
from FlowBoard.views import FlowBoard,FlowOperation,Flow_List,ListoutServerfiles,Server_file_schema


urlpatterns = [
    path('flow/',FlowBoard.as_view(),name= 'save_flow'), #post,put
    path('flow/<id>',FlowOperation.as_view(),name = 'get flow'),  #get ,Delete
    path('list/',Flow_List.as_view(),name='Flow List'),

    path('server_files/',ListoutServerfiles.as_view(),name='server files list'),
    path('file_schema/',Server_file_schema.as_view(),name='file columns'),

    ]
