# integrations/registry.py

# class IntegrationRegistry:
#     _adapters = {}

#     @classmethod
#     def register(cls, integration_name: str, adapter_cls):
#         cls._adapters[integration_name] = adapter_cls

#     @classmethod
#     def get_adapter(cls, integration_name: str):
#         if integration_name not in cls._adapters:
#             raise ValueError(f"Integration not registered: {integration_name}")
#         return cls._adapters[integration_name]()



from abc import ABC, abstractmethod
import requests
from base64 import b64encode
from decouple import config
from Datamplify.settings import Integration_Credentials





class BaseAuth(ABC):

    REQUIRED_FIELDS = set()
    TEST_ENDPOINTS = []

    def __init__(self, payload: dict):
        self.payload = payload
        self.final_result = {}

    def validate_payload(self, payload: dict):
        if payload:
            missing = self.REQUIRED_FIELDS - payload.keys()
            if missing:
                raise ValueError(f"Missing fields: {missing}")

    @abstractmethod
    def build_headers(self) -> dict:
        pass

    def validate_credentials(self) -> bool:
        self.validate_payload(self.payload)

        headers = self.build_headers()


        for endpoint in self.TEST_ENDPOINTS:
            try:
                response = requests.get(
                    self.build_url(endpoint),
                    headers=headers,
                    timeout=15
                )
                if response.status_code == 200:
                    return True
            except requests.RequestException:
                continue

        return False

    def build_url(self, endpoint: str) -> str:
        return f"{self.payload['site_url'].rstrip('/')}{endpoint}"

    def export_credentials(self) -> dict:
        self.final_result['credentials']=self.payload
        return self.final_result



class TokenAuth(BaseAuth):
    SITE_URL = None
    TEST_ENDPOINT = ""
    TOKEN_NAME = "Authorization"

    
    def __init__(self,payload):
        self.payload = payload
        if self.SITE_URL is None:
            self.SITE_URL = self.payload['site_url']
        self.final_result = {}
        self.validate_payload(payload)

    def build_url(self):
        self.payload['site_url'] = self.SITE_URL
        return f"{self.SITE_URL.rstrip('/')}{self.TEST_ENDPOINT}"

    def build_headers(self):
        return {
        self.TOKEN_NAME: f"Bearer {self.payload['api_token']}",
        "Content-Type": "application/json"
        }

    def validate_credentials(self) -> bool:
        self.validate_payload(self.payload)
        headers = self.build_headers()
        try:
            response = requests.get(self.build_url(), headers=headers)
        except Exception as e:
            return False
        if response.status_code ==200:
            self.store_token()
            return response.json()
        else:
            return False
        
    def store_token(self):
        self.final_result['token_metadata'] = {}

from requests.auth import HTTPBasicAuth
       
class OAuthBaseAuth(BaseAuth):
    TOKEN_ENDPOINT = ""
    GRANT_TYPE = "client_credentials"
    SCOPE = None
    SITE_URL = None

    # def __init__(self,payload):
    #     self.payload = payload
    #     self.final_result = {}

    def build_headers(self) -> dict:
        return {
            "Content-Type": "application/x-www-form-urlencoded"
        }

    def token_payload(self) -> dict:
        scope = self.payload.get("scopes",None) or self.SCOPE
        if scope is not None:
            scope = ' '.join(scope)

        return {
            "grant_type": self.GRANT_TYPE,
            "client_id": self.payload["client_id"],
            "client_secret": self.payload["client_secret"],
            **({"scope": scope} if scope else {})
        }

    def validate_credentials(self) -> bool:
        self.validate_payload(self.payload)
        if self.GRANT_TYPE =='client_credentials':
            body_arg = 'json' if self.build_headers()['Content-Type'] =='application/json' else 'data'
            try:
                r = requests.post(
                    self.token_url(),
                    headers=self.build_headers(),
                    **{body_arg: self.token_payload()},
                    timeout=30
                )
            except requests.RequestException:
                return False
            if r.status_code != 200:
                return False

            token_data = r.json()
        elif self.GRANT_TYPE =='authorization_code':
            import urllib.parse
            clean_code = urllib.parse.unquote(self.payload['code'])
            self.payload['site_url'] = None
            import os
            os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'
            oauth = OAuth2Session(self.client_id, redirect_uri=self.redirect_uri, scope=self.scopes)
            try:
                token_data = oauth.fetch_token(self.TOKEN_ENDPOINT, code=clean_code, auth=HTTPBasicAuth(self.client_id,self.client_secret))

            except Exception as e:
                return False
        self.store_token(token_data)
        return True

    def token_url(self) -> str:
        site_url =  self.payload.get('site_url') or self.SITE_URL
        self.payload['site_url'] = site_url
        return f"{site_url.rstrip('/')}{self.TOKEN_ENDPOINT}"

    def store_token(self, token_data: dict):
        self.final_result['token_metadata'] = token_data

    


class ConnectWiseAuth(BaseAuth):

    REQUIRED_FIELDS = {
        "company_id",
        "site_url",
        "public_key",
        "private_key",
    }

    TEST_ENDPOINTS = [
        "/v4_6_release/apis/3.0/company/companies",
        "/v4_6_release/apis/3.0/company/configurations",
        "/v4_6_release/apis/3.0/service/tickets",
    ]

    CLIENT_ID = "006d3e9d-26aa-461b-914c-1b6901beea3b"

    def build_headers(self) -> dict:
        token = b64encode(
            f"{self.payload['company_id']}+{self.payload['public_key']}:{self.payload['private_key']}".encode()
        ).decode()

        return {
            "Authorization": f"Basic {token}",
            "clientID": self.CLIENT_ID,
            "Content-Type": "application/json",
        }


class HaloPsaAuth(OAuthBaseAuth):

    REQUIRED_FIELDS = {
        "code"   
    }
    GRANT_TYPE = "authorization_code"
    TOKEN_ENDPOINT = "https://datamplify.halopsa.com/auth/token"
    client_id = Integration_Credentials['HALOPSA']['CLIENT_ID']
    client_secret = Integration_Credentials['HALOPSA']['CLIENT_SECRET']
    redirect_uri = Integration_Credentials['HALOPSA']['REDIRECT_URI']
    scopes = ['all']
    api = 'https://datamplify.halopsa.com/'

    authorization_base_url = 'https://datamplify.halopsa.com/auth/authorize'


    def get_token_url(self):
        
        oauth = OAuth2Session(self.client_id, redirect_uri=self.redirect_uri, scope=self.scopes)
        authorization_url, state= oauth.authorization_url(self.authorization_base_url)
        data = {
            # "redirection_url":authorization_url
            "redirection_url":f'{authorization_url}&prompt=login'
        }
        return data

class Pax8Auth(OAuthBaseAuth):

    REQUIRED_FIELDS = {
        "client_id",
        "client_secret"   
    }
    GRANT_TYPE ='client_credentials'


    TOKEN_ENDPOINT = "/v1/token"
    
    SITE_URL = "https://api.pax8.com"

    def build_headers(self):
        return {
        'Content-Type': 'application/json',
        'accept':'application/json'
    }

    def token_payload(self) -> dict:
        scope = self.payload.get("scopes",None) or self.SCOPE
        if scope is not None:
            scope = ' '.join(scope)

        return {
            "grant_type": self.GRANT_TYPE,
            "client_id": self.payload["client_id"],
            "client_secret": self.payload["client_secret"],
            "audience":"https://api.pax8.com",
            **({"scope": scope} if scope else {})
        }


class NinjaAuth(OAuthBaseAuth):
    REQUIRED_FIELDS = {
        "client_id",
        "client_secret",
        "scopes"
    }
    TOKEN_ENDPOINT = "/oauth/token"
    SITE_URL = 'https://api.ninjaone.com'
    GRANT_TYPE ='client_credentials'




class ShopifyAuth(TokenAuth):
    REQUIRED_FIELDS ={
        "api_token",
        "shop_name"
    }
    API_VERSION = "2024-01"
    TEST_ENDPOINT = f"/admin/api/{str(API_VERSION)}/shop.json"
    TOKEN_NAME = "X-Shopify-Access-Token"

    def __init__(self,payload):
        self.payload = payload
        self.SITE_URL = self.payload['shop_name']
        self.final_result={}

    def build_headers(self):
        return {
        self.TOKEN_NAME: self.payload['api_token'],
        "Content-Type": "application/json"
        }



class BambooHrAuth(TokenAuth):
    REQUIRED_FIELDS ={
        "api_token",
        "domain"
    }
    SITE_URL = 'https://api.bamboohr.com/api/gateway.php' 
    
    def __init__(self,payload):
        self.payload = payload
        self.final_result = {}
        self.validate_payload(payload)
        self.TEST_ENDPOINT = f"/{self.payload['domain'].rstrip('/')}/v1/company_information"


    def build_headers(self):
        import base64
        encoded_key = base64.b64encode(f"{self.payload['api_token']}:x".encode()).decode()
        return {
        self.TOKEN_NAME: f"Basic {encoded_key}",
        "Content-Type": "application/json"
        }


class DbtAuth(TokenAuth):
    REQUIRED_FIELDS ={
        "account_id",
        "api_token"
    }
    TEST_ENDPOINT = F"/api/v2/accounts/"

    

class TallyAuth(TokenAuth):
    REQUIRED_FIELDS = {
        "api_token"
    }
    TEST_ENDPOINT = "/users/me"
    SITE_URL = "https://api.tally.so/"

from requests_oauthlib import OAuth2Session
class QuickbooksAuth(OAuthBaseAuth):
    REQUIRED_FIELDS = {
        "code",
        "state"    }
    GRANT_TYPE = "authorization_code"
    TOKEN_ENDPOINT = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
    client_id = Integration_Credentials['QUICKBOOKS']['CLIENT_ID']
    client_secret = Integration_Credentials['QUICKBOOKS']['CLIENT_SECRET']
    redirect_uri = Integration_Credentials['QUICKBOOKS']['REDIRECT_URI']
    scopes = ['com.intuit.quickbooks.accounting',
                'com.intuit.quickbooks.payment', 'openid', 'profile', 'email', 'phone', 'address']
    api = 'https://sandbox-quickbooks.api.intuit.com'

    authorization_base_url = 'https://appcenter.intuit.com/connect/oauth2'
 
        

    def get_token_url(self):
        
        oauth = OAuth2Session(self.client_id, redirect_uri=self.redirect_uri, scope=self.scopes)
        authorization_url, state= oauth.authorization_url(self.authorization_base_url)
        data = {
            # "redirection_url":authorization_url
            "redirection_url":f'{authorization_url}&prompt=login'
        }
        return data

import urllib.parse
class JiraAuth(OAuthBaseAuth):
    REQUIRED_FIELDS = {
        "code"
    }
    GRANT_TYPE = "authorization_code"
    TOKEN_ENDPOINT = 'https://auth.atlassian.com/oauth/token'
    client_id = Integration_Credentials['JIRA']['CLIENT_ID']
    client_secret = Integration_Credentials['JIRA']['CLIENT_SECRET']
    redirect_uri = Integration_Credentials['JIRA']['REDIRECT_URI']
    scopes = ['offline_access','read:account', 'read:me','read:jira-work','read:jira-user','manage:jira-configuration','manage:jira-project']
    api = 'https://auth.atlassian.com/authorize'

    authorization_base_url = 'https://auth.atlassian.com/authorize'
    
    def get_token_url(self):
        import time
        state = "anti_csrf_" + str(int(time.time()))
        params = {
            "audience":"api.atlassian.com",
            'prompt': "consent"
        }
        
        oauth = OAuth2Session(self.client_id, redirect_uri=self.redirect_uri, scope=self.scopes,state=state)
        authorization_url, state= oauth.authorization_url(self.authorization_base_url)
        data = {
            "redirection_url":f'{authorization_url}?{urllib.parse.urlencode(params)}'
        }
        return data    




class GoogleSheetsAuth(OAuthBaseAuth):
    REQUIRED_FIELDS = {
        "code"
    }
    GRANT_TYPE = "authorization_code"
    TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
    client_id = Integration_Credentials['GOOGLESHEETS']['CLIENT_ID']
    client_secret = Integration_Credentials['GOOGLESHEETS']['CLIENT_SECRET']
    redirect_uri = config('GOOGLESHEET_REDIRECT_URI')
    scopes =GOOGLE_AUTH_SCOPE = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    # 'profile%20email%20openid'
]
    api = 'https://accounts.google.com/o/oauth2/auth'

    authorization_base_url = 'https://accounts.google.com/o/oauth2/auth'

    def get_token_url(self):
        import time
        state = "anti_csrf_" + str(int(time.time()))
        params = {
            'response_type':'code',
            'access_type':'offline',
            'prompt':'consent'
        }
        
        oauth = OAuth2Session(self.client_id, redirect_uri=self.redirect_uri, scope=self.scopes,state=state)
        authorization_url, state= oauth.authorization_url(self.authorization_base_url)
        data = {
            "redirection_url":f'{authorization_url}?{urllib.parse.urlencode(params)}'
        }
        return data


class HubSpotAuth(TokenAuth):
    REQUIRED_FIELD = {
        "api_token"
    }
    SITE_URL = "https://api.hubapi.com"
    TEST_ENDPOINT = "/crm/v3/objects/contacts?limit=10&archived=false"


class HubspotAuth(OAuthBaseAuth):
    REQUIRED_FIELDS = {
        "client_id",
        "client_secret",
        "scopes"

    }
    GRANT_TYPE = "client_credentials"
    TOKEN_ENDPOINT = 'https://api.hubapi.com/oauth/v1/token'
    # client_id = 'bc9c1cce-f40a-4117-9db9-085319f5a18b'
    # client_secret = '1c35cbc2-6663-472c-92bd-69d3dfe0c814'
    client_id = '4ead0fa0-1b53-42e7-ad62-38db62caf7e7'
    client_secret = '3dcaead8-9d93-4534-9233-c47ab6c9344e'
    redirect_uri = 'https://qa.insightapps.ai/authentication/hubspot'

    # [cms.functions.read, social, marketing-email, crm.dealsplits.read_write, cms.knowledge_base.articles.read, collector.graphql_schema.read,
    #  cms.knowledge_base.settings.read, cms.membership.access_groups.read, hubdb, conversations.custom_channels.read, transactional-email, cms.performance.read, integrations.zoom-app.playbooks.read,
    #  business_units_view.read, marketing.campaigns.read, marketing.campaigns.revenue.read, automation.sequences.read, ctas.read, communication_preferences.statuses.batch.read]
#     scopes = ['cms.domains.read','crm.lists.read',
#               'crm.objects.appointments.read','crm.objects.carts.read','crm.objects.commercepayments.read',
#               'crm.objects.companies.read','crm.objects.contacts.read','crm.objects.courses.read',
#                 'crm.objects.custom.read','crm.objects.deals.read',
#                 'crm.objects.feedback_submissions.read','crm.objects.goals.read',
#                 'crm.objects.invoices.read','crm.objects.leads.read','crm.objects.line_items.read','crm.objects.listings.read','crm.objects.marketing_events.read',
#                 'crm.objects.orders.read','crm.objects.owners.read','crm.objects.partner-clients.read','crm.objects.partner-services.read',
#                 'crm.objects.projects.read','crm.objects.quotes.read',
#                 'crm.objects.services.read','crm.objects.subscriptions.read','crm.objects.users.read','crm.pipelines.orders.read',
#                 'crm.schemas.appointments.read','crm.schemas.carts.read','crm.schemas.courses.read','crm.schemas.commercepayments.read','crm.schemas.companies.read',
                
#                 'crm.schemas.quotes.read', 'content', 'crm.schemas.line_items.read', 'tax_rates.read', 'automation','actions', 'timeline', 'forms', 'files',   'account-info.security.read',
#         'record_images.signed_urls.read', 'integration-sync', 'crm.objects.products.read', 'tickets',
#            'e-commerce', 'settings.currencies.read', 'external_integrations.forms.access',
#             'accounting',  'sales-email-read', 'communication_preferences.read_write', 'crm.schemas.projects.read',
#               'crm.extensions_calling_transcripts.read',  'crm.schemas.subscriptions.read', 'communication_preferences.read', 'crm.schemas.invoices.read',
#                 'settings.security.security_health.read', 'crm.objects.forecasts.read', 'crm.schemas.forecasts.read', 'files.ui_hidden.read',
#                   'crm.schemas.custom.read', 'settings.users.read', 'crm.schemas.contacts.read', 'media_bridge.read', 'crm.schemas.orders.read',
#                     'crm.schemas.deals.read',
#                  'settings.users.teams.read', 'conversations.read', 'scheduler.meetings.meeting-link.read', 'crm.schemas.services.read', 'crm.schemas.listings.read']
    
#     b=['crm.schemas.quotes.read', 'content, crm.schemas.line_items.read', 'tax_rates.read', 'social', 'automation','actions',
#       'collector.graphql_schema.read', 'timeline', 'forms', 'files', 'hubdb', 'transactional-email', 'account-info.security.read',
#         'record_images.signed_urls.read', 'integration-sync', 'crm.objects.products.read', 'tickets', 'cms.performance.read',
#           'integrations.zoom-app.playbooks.read', 'e-commerce', 'settings.currencies.read', 'external_integrations.forms.access',
#             'accounting', 'business_units_view.read', 'sales-email-read', 'communication_preferences.read_write', 'ctas.read', 'crm.schemas.projects.read',
#               'crm.extensions_calling_transcripts.read', 'marketing-email', 'crm.dealsplits.read_write', 'crm.schemas.subscriptions.read', 'communication_preferences.read', 'crm.schemas.invoices.read',
#                 'settings.security.security_health.read', 'crm.objects.forecasts.read', 'crm.schemas.forecasts.read', 'files.ui_hidden.read',
#                   'crm.schemas.custom.read', 'settings.users.read', 'crm.schemas.contacts.read', 'media_bridge.read', 'crm.schemas.orders.read',
#                 'conversations.custom_channels.read', 'marketing.campaigns.read', 'marketing.campaigns.revenue.read', 'automation.sequences.read', 'communication_preferences.statuses.batch.read', 'crm.schemas.deals.read',
#                  'settings.users.teams.read', 'conversations.read', 'scheduler.meetings.meeting-link.read', 'crm.schemas.services.read', 'crm.schemas.listings.read']
#     a=['crm.schemas.contacts.read','crm.schemas.custom.read','crm.schemas.deals.read','crm.schemas.invoices.read','crm.schemas.line_items.read','crm.schemas.listings.read','crm.schemas.orders.read','crm.schemas.projects.read', #;;
#                 'crm.schemas.quotes.read','crm.schemas.services.read','crm.schemas.subscriptions.read','settings.currencies.read','settings.users.read','settings.users.teams.read','account-info.security.read','accounting','actions','automation',
#                 'automation.sequences.read','business_units_view.read','business-intelligence','collector.graphql_query.execute','collector.graphql_schema.read','communication_preferences.read',
# 'communication_preferences.statuses.batch.read','content','conversations.read','ctas.read','e-commerce','files','files.ui_hidden.read','forms','hubdb','integration-sync',
# 'marketing.campaigns.read','marketing.campaigns.revenue.read','media_bridge.read','oauth','sales-email-read','social','scheduler.meetings.meeting-link.read','tax_rates.read','tickets','transactional-email','timeline',
# 'crm.extensions_calling_transcripts.read','marketing-email','crm.dealsplits.read_write','conversations.custom_channels.read','record_images.signed_urls.read', 'settings.security.security_health.read',
# 'crm.objects.products.read', 'crm.objects.forecasts.read', 'cms.performance.read', 'crm.schemas.forecasts.read', 'integrations.zoom-app.playbooks.read',
#  'external_integrations.forms.access', 'communication_preferences.read_write']

    scopes = [
    "crm.schemas.contacts.read",
    "crm.objects.deals.read",
    "crm.objects.custom.read",
    "crm.objects.courses.read",
    "crm.schemas.companies.read",
    "crm.schemas.quotes.read",
    "crm.objects.owners.read",
    "crm.objects.marketing_events.read",
    "conversations.read",
    "crm.objects.users.read",
    "settings.users.read",
    "crm.lists.read",
    "content",
    "tickets",
    "crm.import",
    "account-info.security.read",
    "settings.currencies.read",
    "communication_preferences.read",
    "crm.objects.companies.read",
    "crm.objects.contacts.read",
    "crm.objects.goals.read",
    "crm.objects.leads.read",
    "crm.objects.line_items.read",
    "crm.objects.orders.read",
    "crm.objects.products.read",
    "crm.objects.subscriptions.read",
    "crm.schemas.custom.read",
]
    options_scopes = ['crm.schemas.listings.read', 'crm.objects.feedback_submissions.read', 'communication_preferences.statuses.batch.read', 'marketing.campaigns.read', 'crm.schemas.carts.read', 'crm.schemas.invoices.read', 'crm.objects.services.read', 'hubdb', 'cms.domains.read', 'crm.objects.listings.read', 'cms.membership.access_groups.read', 'cms.knowledge_base.articles.read', 'crm.schemas.deals.read', 'crm.objects.commercepayments.read', 'cms.knowledge_base.settings.read', 'crm.objects.carts.read', 'ctas.read', 'crm.objects.quotes.read', 'crm.objects.partner-clients.read', 'crm.dealsplits.read_write', 'crm.pipelines.orders.read', 'crm.objects.appointments.read', 'crm.schemas.line_items.read', 'conversations.custom_channels.read', 'cms.performance.read', 'settings.users.teams.read', 'cms.functions.read', 'crm.schemas.services.read', 'crm.schemas.orders.read', 'crm.schemas.courses.read', 'crm.schemas.commercepayments.read', 'crm.schemas.subscriptions.read', 'crm.schemas.appointments.read', 'marketing.campaigns.revenue.read', 'crm.objects.invoices.read']

        # scopes = ['oauth']
    api = 'https://app.hubspot.com/oauth/authorize'

    authorization_base_url = 'https://app.hubspot.com/oauth/authorize'
    
    def get_token_url(self):
        
        oauth = OAuth2Session(self.client_id, redirect_uri=self.redirect_uri, scope=self.scopes)
        authorization_url, state= oauth.authorization_url(self.authorization_base_url)
        data = {
            "redirection_url":f'{authorization_url}&optional_scope={self.options_scopes}&prompt=login'
        }
        return data

    def validate_credentials(self):
        data = {
            'grant_type': 'authorization_code',
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'redirect_uri': self.redirect_uri,
            'code': self.payload['code'],
        }
        token_data = requests.post(self.TOKEN_ENDPOINT, data=data)
        if token_data.status_code == 200:
            self.store_token(token_data.json())
            return True
        else:
            return False


 

    
class SalesforceAuth(OAuthBaseAuth):
    REQUIRED_FIELDS = {
        "code",
    }
    GRANT_TYPE = "authorization_code"
    TOKEN_ENDPOINT = 'https://login.salesforce.com/services/oauth2/token'
    client_id = Integration_Credentials['SALESFORCE']['CLIENT_ID']
    client_secret = Integration_Credentials['SALESFORCE']['CLIENT_SECRET']
    redirect_uri = Integration_Credentials['SALESFORCE']['REDIRECT_URI']
    scopes = ['full refresh_token']
    api = 'https://login.salesforce.com/services/oauth2/authorize'

    authorization_base_url = 'https://login.salesforce.com/services/oauth2/authorize'
    
    def get_token_url(self):
        
        oauth = OAuth2Session(self.client_id, redirect_uri=self.redirect_uri, scope=self.scopes)
        authorization_url, state= oauth.authorization_url(self.authorization_base_url)
        data = {
            # "redirection_url":authorization_url
            "redirection_url":f'{authorization_url}&prompt=login'
        }
        return data



class ZohoAuth(OAuthBaseAuth):
    REQUIRED_FIELDS = {
        "code"
    }
    GRANT_TYPE = "authorization_code"
    client_id = '1000.13IJD9MCJYUG737C2BVMG23V5LW1IE'
    client_secret = 'ba74a03fc77feb7373651a00bad63aaa39c799ff76'
    redirect_uri = 'https://app.analytify.ai/authentication/zoho'




    def __init__(self, integration_type,payload):
        self.integration = integration_type
        self.payload = payload
        self.final_result = {}
        match self.integration.lower():
            case "zoho_crm":
                self.scopes=["ZohoCRM.modules.ALL"]
            case "zoho_books":
                self.scopes=["ZohoBooks.fullaccess.all","ZohoBooks.settings.READ"]
            case "zoho_inventory":
                self.scopes=["ZohoInventory.contacts.READ","ZohoInventory.items.READ","ZohoInventory.compositeitems.READ",
                       "ZohoInventory.inventoryadjustments.READ","ZohoInventory.transferorders.READ","ZohoInventory.settings.READ",
                       "ZohoInventory.salesorders.READ","ZohoInventory.packages.READ","ZohoInventory.shipmentorders.READ",
                       "ZohoInventory.invoices.READ","ZohoInventory.customerpayments.READ","ZohoInventory.salesreturns.READ","ZohoInventory.creditnotes.READ",
                       "ZohoInventory.purchaseorders.READ","ZohoInventory.purchasereceives.READ","ZohoInventory.bills.READ"]
        # self.validate_payload(payload)
        self.domain = self.domain_mapping(self.payload['country'].lower())
        self.payload['scopes'] = self.scopes
        self.payload['domain'] = self.domain
        self.payload['zohotype'] = self.integration

        self.TOKEN_ENDPOINT =f'https://accounts.zoho{self.domain}/oauth/v2/token'
        
    
    def get_token_url(self):

        
        
        self.authorization_base_url = f'https://accounts.zoho{self.domain}/oauth/v2/auth'

        oauth = OAuth2Session(self.client_id, redirect_uri=self.redirect_uri, scope=self.scopes)
        authorization_url, state= oauth.authorization_url(self.authorization_base_url)
        params = {
            'response_type': 'code',
            'access_type': 'offline',
            'prompt': 'consent'
        }
        data = {
            # "redirection_url":authorization_url
            "redirection_url":f'{authorization_url}?{urllib.parse.urlencode(params)}'
        }
        return data
    
    def domain_mapping(self,country):
        country_domain_map = {
            "united states": ".com",
            "europe": ".eu",
            "india": ".in",
            "australia": ".com.au",
            "japan": ".jp",
            "canada": ".ca",
            "china": ".com.cn",
            "saudi arabia": ".sa",
        }
        country_normalized = str(country).strip().lower()
        domain = country_domain_map.get(country_normalized, ".com")
        return domain

  

class ImmyBotAuth(OAuthBaseAuth):
    REQUIRED_FIELDS = {
        "client_id",
        "client_secret",
        "azure_domain",
        "instance_subdomain"
    }

    GRANT_TYPE = 'client_credentials'

    def __init__(self,payload):
        self.payload= payload
        self.final_result={}
        self.TOKEN_ENDPOINT = self.get_token_url()

    def token_url(self):
        try:

            openid_config_url = f"https://login.windows.net/{self.payload['azure_domain']}/.well-known/openid-configuration"
            token_endpoint = requests.get(openid_config_url).json()['token_endpoint']
            self.tenant_id = token_endpoint.split('/')[3]
            self.SCOPE = f"https://{self.payload['instance_subdomain']}.immy.bot/.default"
            return  f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        except Exception as e:
            return False
AUTH_REGISTRY = {}

def register_auth(name: str):
    def decorator(cls):
        AUTH_REGISTRY[name.lower()] = cls
        return cls
    return decorator

@register_auth("openai")
class OpenAIAuth(BaseAuth):
    REQUIRED_FIELDS = {"api_key"}

    def build_headers(self):
        return {"Authorization": f"Bearer {self.payload['api_key']}"}

    def validate_credentials(self) -> bool:
        self.validate_payload(self.payload)
        try:
            r = requests.get(
                "https://api.openai.com/v1/models",
                headers={**self.build_headers(), "Content-Type": "application/json"},
                timeout=15,
            )
            return r.status_code == 200
        except:
            return False
        
@register_auth("deepseek")
class DeepseekAuth(BaseAuth):
    REQUIRED_FIELDS = {"api_key"}

    def build_headers(self):
        return {
            "Authorization": f"Bearer {self.payload['api_key']}",
            "Content-Type": "application/json",
        }

    def validate_credentials(self) -> bool:
        self.validate_payload(self.payload)
        try:
            r = requests.get(
                "https://api.deepseek.com/v1/models",
                headers=self.build_headers(),
                timeout=15,
            )
            return r.status_code == 200
        except requests.RequestException:
            return False

@register_auth("gemini")
class GeminiAuth(BaseAuth):
    REQUIRED_FIELDS = {"api_key"}
    # Gemini uses ?key=... so site_url is just host
    SITE_URL = "https://generativelanguage.googleapis.com"

    def __init__(self, payload: dict):
        payload = payload or {}
        payload.setdefault("site_url", self.SITE_URL)
        super().__init__(payload)

    def build_headers(self) -> dict:
        # Gemini API key is in query param, not header
        return {"Content-Type": "application/json"}

    def validate_credentials(self) -> bool:
        """
        Override BaseAuth.validate_credentials because Gemini doesn't use a simple GET test endpoint
        and needs API key in query string.
        """
        self.validate_payload(self.payload)

        model = self.payload.get("default_model") or "gemini-1.5-flash"
        url = f"{self.payload['site_url'].rstrip('/')}/v1beta/models/{model}:generateContent"
        url = f"{url}?key={self.payload['api_key']}"

        try:
            r = requests.post(
                url,
                headers=self.build_headers(),
                json={"contents": [{"parts": [{"text": "ping"}]}]},
                timeout=15,
            )
            # 200 => ok, 400 can also mean model/payload issue but key valid;
            # treat 401/403 as invalid auth.
            return r.status_code in (200, 400)
        except requests.RequestException:
            return False

@register_auth("anthropic")
class AnthropicAuth(BaseAuth):
    REQUIRED_FIELDS = {"api_key"}
    SITE_URL = "https://api.anthropic.com"

    def __init__(self, payload: dict):
        payload = payload or {}
        payload.setdefault("site_url", self.SITE_URL)
        super().__init__(payload)

    def build_headers(self) -> dict:
        return {
            "x-api-key": self.payload["api_key"],
            "anthropic-version": self.payload.get("anthropic_version") or "2023-06-01",
            "content-type": "application/json",
        }

    def validate_credentials(self) -> bool:
        """
        Override because Anthropic validation is best via a tiny messages call.
        """
        self.validate_payload(self.payload)

        model = self.payload.get("default_model") or "claude-3-haiku-20240307"
        url = f"{self.payload['site_url'].rstrip('/')}/v1/messages"

        try:
            r = requests.post(
                url,
                headers=self.build_headers(),
                json={
                    "model": model,
                    "max_tokens": 1,
                    "messages": [{"role": "user", "content": "ping"}],
                },
                timeout=15,
            )
            # If key invalid -> typically 401/403.
            return r.status_code in (200, 400)
        except requests.RequestException:
            return False

@register_auth("azure_openai")
class AzureOpenAIAuth(BaseAuth):
    REQUIRED_FIELDS = {"api_key", "endpoint", "deployment"}
    # NOTE: For Azure, we don't use payload['site_url'] for auth; we use endpoint+deployment.
    # But we still set site_url to keep BaseAuth consistent.
    SITE_URL = "https://example.openai.azure.com"

    def __init__(self, payload: dict):
        payload = payload or {}
        payload.setdefault("site_url", payload.get("endpoint") or self.SITE_URL)
        super().__init__(payload)

    def build_headers(self) -> dict:
        return {
            "api-key": self.payload["api_key"],
            "Content-Type": "application/json",
        }

    def validate_credentials(self) -> bool:
        """
        Validate with a tiny chat completions call.
        """
        self.validate_payload(self.payload)

        endpoint = self.payload["endpoint"].rstrip("/")
        deployment = self.payload["deployment"]
        api_version = self.payload.get("api_version") or "2024-10-21"

        url = f"{endpoint}/openai/deployments/{deployment}/chat/completions?api-version={api_version}"

        try:
            r = requests.post(
                url,
                headers=self.build_headers(),
                json={
                    "messages": [{"role": "user", "content": "ping"}],
                    "max_tokens": 1,
                },
                timeout=20,
            )
            # Invalid key / access -> 401/403. Other failures can still mean key is okay.
            return r.status_code in (200, 400)
        except requests.RequestException:
            return False

@register_auth("meta_llama")
class MetaLlamaAuth(BaseAuth):
    """
    Meta LLaMA is usually self-hosted (Ollama/vLLM/TGI) or via a provider.
    Best practice: treat it as OpenAI-compatible base_url.

    payload required:
      - base_url (example: http://localhost:8000/v1 OR https://my-llama-host/v1)
    optional:
      - api_key (if your gateway requires it)
    """
    REQUIRED_FIELDS = {"base_url"}
    TEST_ENDPOINTS = ["/models"]

    def __init__(self, payload: dict):
        payload = payload or {}
        # Use base_url as site_url so BaseAuth.build_url('/models') works
        payload["site_url"] = payload.get("base_url", "").rstrip("/")
        super().__init__(payload)

    def build_headers(self) -> dict:
        headers = {"Content-Type": "application/json"}
        api_key = self.payload.get("api_key")
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        return headers

class IntegrationAuthOrchestrator:

    def authenticate(self, integration_type: str, payload: dict) -> dict:
        auth = self._get_auth_handler(integration_type, payload)

        # payload validation happens in __init__
        if not auth.validate_credentials():
            raise ValueError("Invalid credentials")

        return {
            "connected": True,
            "credentials": auth.export_credentials(),
        }

    def _get_auth_handler(self, integration_type: str, payload: dict):
        match integration_type.lower():

            case "connectwise":
                return ConnectWiseAuth(payload)

            case "ninja":
                return NinjaAuth(payload)

            case "halopsa":
                return HaloPsaAuth(payload)
            
            case "shopify":
                return ShopifyAuth(payload)
            
            case "tally":
                return TallyAuth(payload)
            
            case "quickbooks":
                return QuickbooksAuth(payload)
            
            case "salesforce":
                return SalesforceAuth(payload)
            
            case "jira":
                return JiraAuth(payload)
            
            # case "hubspot": #['oauth']
            #     return HubspotAuth(payload)
            case "hubspot": 
                return HubSpotAuth(payload)
            
            case "googlesheet":
                return GoogleSheetsAuth(payload)
            
            case "dbt":
                return DbtAuth(payload)
        
            case "pax8":
                return Pax8Auth(payload)

            case "bamboohr":
                return BambooHrAuth(payload)
            
            case "zoho_crm":
                return ZohoAuth(integration_type,payload)
            
            case "zoho_books":
                return ZohoAuth(integration_type,payload)
            
            case "zoho_inventory":
                return ZohoAuth(integration_type,payload)
            
            case "googleanalytic":
                return GoogleAnalyticsAuth(payload)
            case "deepseek":
                 return DeepseekAuth(payload)
            case "gemini":
                return GeminiAuth(payload)
            case "anthropic":
                return AnthropicAuth(payload)
            case "azure_openai":
                return AzureOpenAIAuth(payload)
            case "meta_llama":
                return MetaLlamaAuth(payload)
            case "openai":
                return OpenAIAuth(payload)   # if you add it too

        raise ValueError("Unsupported integration type")



class GoogleAnalyticsAuth(BaseAuth):
    REQUIRED_FIELDS = [
        "type",
        "project_id",
        "private_key_id",
        "private_key",
        "client_email",
        "client_id",
        "client_x509_cert_url"
    ]

    def __init__(self,payload):
        self.payload = payload
        self.final_result= {}
        # self.site_url =None
    
    def validate_payload(self):
        if self.payload:
            missing = self.REQUIRED_FIELDS -self.payload.keys()
            if missing:
                raise ValueError(f"'Missing fields':{missing}")
            
    def build_headers(self):
        pass
    def get_service_info(self):
        return {
            "type": self.payload['type'],
            "project_id": self.payload["project_id"],
            "private_key_id": self.payload["private_key_id"],
            "private_key": self.payload["private_key"].replace('\\n', '\n'),
            "client_email": self.payload["client_email"],
            "client_id": self.payload["client_id"],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": self.payload["client_x509_cert_url"]
        }
    
    def validate_credentials(self) -> bool:
        self.validate_payload()

        from google.analytics.data_v1beta.types import RunReportRequest, DateRange, Dimension, Metric
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        from google.oauth2 import service_account

        try:
            credentials = service_account.Credentials.from_service_account_info(self.get_service_info())
        except Exception as e:
            return False
        # client = BetaAnalyticsDataClient(credentials=credentials)
        # property_id = self.payload["property_id"]
        # dimensions = self.payload.get("dimensions") or ["date", "country", "deviceCategory"]
        # metrics = self.payload.get("metrics") or ["activeUsers", "newUsers"]
        # request_data = RunReportRequest(
        #     property=f"properties/{property_id}",
        #     dimensions=[Dimension(name=d) for d in dimensions],
        #     metrics=[Metric(name=m) for m in metrics],
        #     date_ranges=[DateRange(start_date="2015-08-14", end_date="today")]
        # )
        # try:
        #     response = client.run_report(request_data)
        # except Exception as e:
        #     return False
        return True