from django.urls import path 
from Connections.views import (Server_Connection,Server_Connection_update,get_available_schemas,
    File_Connection,File_operations,Connection_list,ETL_connection_list,Server_tables,FileSchema,ExcelSheetList,ServerFileSchemaView,ListFilesView,Remote_file_connection,Remote_operations,
    IntegrationAuthView,Integration_schema,IntegrationOperations,Integration_endpoints,IntegrationAuthUrl)
urlpatterns = [

    #Databases
    path('Database_connection/',Server_Connection.as_view(),name= 'Database Server Connection'), #post

    path('Database_connection/<id>',Server_Connection_update.as_view(),name = 'Connection Update'), #update

    path('Server_tables/<id>/',Server_tables.as_view(),name='get connected database tables'),


    path('get_schema/',get_available_schemas,name='get postgres schmea'),


    #Files
    path('File_connection/',File_Connection.as_view(),name='File Source'),

    path('File_connection/<id>',File_operations.as_view(),name='file put,update,delete'),

    path('file_schema/<id>/',FileSchema.as_view(),name='file columns'),

    path('excel_sheets/<id>/',ExcelSheetList.as_view(),name='list excel sheets'),


    #Remote Connection
    path('remote_file/',Remote_file_connection.as_view(),name='remove file connection'),

    path('remote_connection/<id>',Remote_operations.as_view(),name='file put,update,delete'),

    path('server_files/',ServerFileSchemaView.as_view(),name='get columns from server files'),

    path('ListFiles/',ListFilesView.as_view(),name='server_files_list'),


    # Connection APis
    path('Connection_list/',Connection_list.as_view(),name = 'Connections List'),
    
    path('ETL_connection_list/',ETL_connection_list.as_view(),name='type wise connections'),


    path('Integration/<str:type>',IntegrationAuthView.as_view(),name='intgration api'),

    path('Integration_schema/',Integration_schema.as_view(),name='schema integration'),

    path('Integrations/<id>',IntegrationOperations.as_view(),name='integration operations'),

    path('Integration_tables/<id>',Integration_endpoints.as_view(),name='list of tables'),

    path('integration_url/<str:type>',IntegrationAuthUrl.as_view(),name='redirection_url'),


]
