from django.shortcuts import render
from Datamplify import settings
import requests
from oauth2_provider.models import Application
from oauth2_provider.models import AccessToken,RefreshToken,Application
from authentication.models import UserProfile
import datetime
from pytz import utc
from requests.auth import HTTPBasicAuth



# def get_access_token(username,password):
#     token_url = settings.TOKEN_URL
#     client_id = settings.CLIENT_ID
#     client_secret = settings.CLIENT_SECRET
#     print("Authenticating with:")
#     print("client_id:", client_id)
#     print("client_secret:", client_secret)
#     print("token_url:", token_url)
#     response = requests.post(
#         token_url,
#         data={
#             'grant_type': 'password',
#             'username': username,
#             'password': password
#         },
#         auth=(client_id,client_secret), 
#         headers={'Content-Type': 'application/x-www-form-urlencoded'}
#     )
#     if response.status_code==200:
#         data = {
#             'status':200,
#             'data':response.json()
#         }
#     else:
#         data = {
#             'status':response.status_code,
#             'data':response
#         }
#     return data

from django.utils import timezone
from datetime import timedelta


def get_access_token(
    user,
    scope="read write"
):
    """
    Internal OAuth token generator (NO HTTP, NO password)
    """

    try:
        application = Application.objects.get(client_id=settings.CLIENT_ID)
    except Application.DoesNotExist:
        raise ValueError("Invalid OAuth client")

    expires = timezone.now() + timedelta(
        seconds=settings.OAUTH2_PROVIDER["ACCESS_TOKEN_EXPIRE_SECONDS"]
    )

    # 1️⃣ Create access token
    access_token = AccessToken.objects.create(
        user=user,
        application=application,
        token=secrets.token_urlsafe(32),
        expires=expires,
        scope=scope,
    )

    # 2️⃣ Create refresh token (optional but recommended)
    RefreshToken.objects.create(
        user=user,
        application=application,
        token=secrets.token_urlsafe(32),
        access_token=access_token,
    )

    # 3️⃣ Return OAuth-compliant response
    return {
        'status':200,
        "access_token": access_token.token,
        "token_type": "Bearer",
        "expires_in": settings.OAUTH2_PROVIDER["ACCESS_TOKEN_EXPIRE_SECONDS"],
        "scope": scope,
    }

# def get_access_token(username, password):
#     token_url = settings.TOKEN_URL
#     client_id = settings.CLIENT_ID
#     client_secret = settings.CLIENT_SECRET
#     data = {
#         'grant_type': 'password',
#         'username': username,
#         'password': password,
#         'client_id': client_id,
#         'client_secret': client_secret,
#         'user':username
#     }
#     response = requests.post(token_url, data=data)
#     if response.status_code==200:
#         data = {
#             'status':200,
#             'data':response.json()
#         }
#     else:
#         try:
#             content = response.json()
#         except Exception:
#             content = response.text
#         data = {
#             'status': response.status_code,
#             'data': content
#         }
#     return data


def get_access_token_updated(username, password):
    for name, config in settings.DATABASES.items():
        engine = config.get('ENGINE')
        if engine=='django.db.backends.sqlite3':
            token_url = 'http://127.0.0.1:8000/v1/oauth2/token/'
        else:
            token_url = settings.TOKEN_URL
    client_id = settings.CLIENT_ID
    client_secret = settings.CLIENT_SECRET
    data = {
        'grant_type': 'password',
        'username': username,
        'password': password,
        'client_id': client_id,
        'client_secret': client_secret,
        'user':username
    }
    headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    try:
        response = requests.post(token_url, data=data, headers=headers)
    except:
        token_url = 'http://127.0.0.1:8000/v1/oauth2/token/'
        response = requests.post(token_url, data=data, headers=headers)
    if response.status_code==200:
        data = {
            'status':200,
            'data':response.json()
        }
        return data
    else:
        data = {
            'grant_type': 'password',
            'username': username,
            'password': password,
            'client_id': settings.CLIENT_ID
        }
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        response = requests.post(
            token_url,
            data=data,
            headers=headers,
            auth=HTTPBasicAuth(settings.CLIENT_ID, settings.CLIENT_SECRET)
        )
        if response.status_code==200:
            data = {
                'status':200,
                'data':response.json()
            }
        else:
            data = {
                'status':response.status_code,
                'data':response
            }
    return data

        
def app_login_check(client_id,client_secret):
    data = {
        'grant_type': 'client_credentials',
        'client_id': client_id,
        'client_secret': client_secret
    }
    headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    try:
        token_url = settings.TOKEN_URL
        response = requests.post(token_url, data=data, headers=headers)
    except:
        token_url = 'http://127.0.0.1:8000/v1/authentication/oauth2/token/'
        response = requests.post(token_url, data=data, headers=headers)
    if response.status_code == 200:
        return 200
    else:
        return 401



def generate_access_from_refresh(refresh_token):
    TOKEN_URL = settings.TOKEN_URL
    client_id = settings.CLIENT_ID
    client_secret = settings.CLIENT_SECRET
    REFRESH_TOKEN = refresh_token

    data = {
        'grant_type': 'refresh_token',
        'refresh_token': REFRESH_TOKEN,
        'client_id': client_id,
        'client_secret': client_secret,
        # Add any additional parameters as needed
    }
    response = requests.post(TOKEN_URL, data=data)
    if response.status_code==200:
        data = {
            'status':200,
            'data':response.json()
        }
    else:
        data = {
            'status':response.status_code,
            'data':response
        }
    return data




def tok_user_check(user):
    if UserProfile.objects.filter(id=user,is_active=True).exists():
        usertable=UserProfile.objects.get(id=user)
        data = {
            "status":200,
            "user_id":user,
            "usertable":usertable,
            "username":usertable.username,
            "email":usertable.email
        }
    else:
        data = {
            "status":404,
            "message":"User Not Activated, Please activate the account"
        }
    return data

def token_function(request):
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    token = None
    if auth_header.startswith('Bearer '):
        token = auth_header.split('Bearer ')[1]
    try:
        token1=AccessToken.objects.get(token=token)
    except Exception as e:
        data = {"message":"Invalid Access Token",
                "status":404}
        return data
    user = token1.user_id
    if token1.expires < datetime.datetime.now(utc):
        ap_tb=Application.objects.get(id=token1.application_id) # token1
        if ap_tb.authorization_grant_type=="client_credentials":
            pass
        else:
            try:
                rf_token=RefreshToken.objects.get(access_token_id=token1.id,user_id=user)
            except:
                data = {"message":'Session Expired, Please login again',
                            "status":408}
                return data
            refresh_token=generate_access_from_refresh(rf_token.token)
            if refresh_token['status']==200:
                RefreshToken.objects.filter(id=rf_token.id).delete()
                AccessToken.objects.filter(id=token1.id).delete()
                pass
            else:
                RefreshToken.objects.filter(id=rf_token.id).delete()
                AccessToken.objects.filter(id=token1.id).delete()
                data = {"message":'Session Expired, Please login again',
                        "status":408}
                return data
    else:
        try:
            fn_data=tok_user_check(user)
            return fn_data
        except:
            data = {
                "status":400,
                "message":"Admin not exists/Not assssigned/Role Not created"
            }
            return data      

import secrets

def app_create(name,redirect_uris,user,type):
    client_id = secrets.token_urlsafe(32)

    client_secret = secrets.token_urlsafe(64)
    app = Application.objects.create(
        name=name,
        client_id=client_id,
        client_secret=client_secret,
        redirect_uris=redirect_uris,
        client_type=Application.CLIENT_CONFIDENTIAL,
        authorization_grant_type = type,
        user_id = user

    )
    return client_id,client_secret
