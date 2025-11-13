from django.urls import path,include
from oauth2_provider.views import AuthorizationView, TokenView
from authentication.utils import get_access_token
from oauth2_provider import urls as oauth2_urls
from authentication.views import (SignUp,AccountActivate,Login,user_info_view,ForgotPasswordView,ConfirmPasswordView,user_delete,InviteUser,SetPassword,
                                  EditUser,UsersList,Get_previlages,user_delete,DeleteInviteUser,Activateoldusers)
from authentication.roles import CreateRole,RoleList,RoleDetail

urlpatterns = [
    path('o/',include(oauth2_urls)),

    path('signup/',SignUp.as_view(),name='Registeration'),

    path('activate_account/<str:token>',AccountActivate.as_view(),name='Account_Activation'),

    path('reset_password/',ForgotPasswordView.as_view(),name='reset Password'),

    path('reset_password/confirm/<token>',ConfirmPasswordView.as_view(), name='Forgot Password Confirm'),

    path("user_delete/<str:email>/",user_delete.as_view(),name = 'user deletion'),

    path('login/',Login.as_view(),name = 'User Login'),

    path('me/', user_info_view), #airflow user data



    ###### Rolese #####

    path('role/',CreateRole.as_view(),name='create role'),

    path('roles_list/',RoleList.as_view(),name='list of roles'),

    path('role/<int:role_id>/',RoleDetail.as_view(),name="role details"),


    ######## Invite Users ##############
    path('invite/user/',InviteUser.as_view(),name='imvite user'),

    path('invite/password/<token>',SetPassword.as_view(),name='password set'),


    path('users_list/',UsersList.as_view(),name='list of users'),

    path('user/',EditUser.as_view(),name='Edit  user'),

    path('user/delete/<id>',DeleteInviteUser.as_view(),name = "delere user"),

    

    path('previlages/',Get_previlages.as_view(),name='previlages list'),

    # path('activate_old_users/<user_id>',Activateoldusers.as_view(),name='activate users')


    
    


]
