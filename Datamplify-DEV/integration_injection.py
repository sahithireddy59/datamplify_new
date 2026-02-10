# integrations/clients/ninja.py

import requests
from collections import defaultdict
from uuid import uuid4
from io import StringIO
from typing import Dict, List
from Connections.models import Integrations
import psycopg2
from psycopg2.extras import execute_batch
from Service.utils import encrypt_json,decrypt_json
from Connections.utils import convert_percentage_columns,convert_numeric_columns,convert_datetime_columns,map_dtypes_to_clickhouse
# ============================================================
# API CLIENT
# ============================================================
from Datamplify.settings import Integration_Credentials

QUICKBOOKS_CONFIG = {
    **{e:{
        "type":"page"
    } for e in  ["ProfitAndLossDetail","TransactionList","TrialBalance","VendorExpenses","AgedPayableDetail","AgedReceivableDetail",
                 "CustomerBalance","CustomerBalanceDetail","CashFlow","AgedReceivables","AccountList","CustomerIncome","VendorBalance","GeneralLedger"
                 ,"CompanyInfo","balance_sheet","profitandloss","Account","bill","Customer","Employee","estimate","Invoice","Item","Payment","TaxAgency","vendor",
    "Budget", "Class", "companycurrency", "CreditMemo", "creditcardpayment", "CustomerType", "Department", "Deposit", "exchangerate", "journalcode", 
    "JournalEntry", "PaymentMethod", "Preferences", "Purchase", "PurchaseOrder", "RecurringTransaction", "RefundReceipt", "ReimburseCharge", "SalesReceipt", 
    "TaxCode", "TaxRate", "Term", "TimeActivity", "Transfer", "vendorcredit","attachable","billpayment","AgedPayables","CustomerBalance",
    "CustomerBalanceDetail","CashFlow","AgedReceivables","AccountList","CustomerIncome","VendorBalance","GeneralLedger","ProfitAndLossDetail",
    "TransactionList","TrialBalance","VendorExpenses","AgedPayableDetail","AgedReceivableDetail"]}
}


SALESFORCE_CONFIG = {
    **{e:{
        "type":"page",
        "page_param":"q",
        "cursor_param":"nextRecordsUrl",

    } for e in  [ 'Announcement', 'AppMenuItem', 'Asset', 'Attachment', 'Campaign', 'Case', 'Group', 'Contact',
                     'Contract', 'Dashboard', 'Document', 'Domain', 'EmailCapture', 'Entitlement', 'Event', 'FileSearchActivity', 
                     'Folder', 'Group', 'Holiday', 'Idea', 'Individual', 'Lead', 'Location', 'Macro', 'Note', 'Opportunity', 
                     'Order', 'Organization', 'Partner', 'Period', 'Profile', 'Publisher', 'RecordAction', 'Report', 
                       'Shipment', 'Site',  'Skill', 'Solution', 'Stamp',  'Task', 'User', 
                       'UserAppMenuCustomization' ]}
}


PAX8_CONFIG = {
    **{e:{
        "type": "page",
        "page_param": "page",
        "page_size_param": "limit",
        "page_size":1000

    }for e in ['companies','products','orders','subscriptions','invoices','invoices/draftItems']}
}

JIRA_CONFIG = {
**{e:{
        "type": "page",
        "page_param": "startAt",
        'cursor_param':"isLast",
        'cursor_field':"maxResults",
        "page_size_param": "maxResults",
        "page_size":250
    } for e in ['announcementBanner',
 'applicationrole',
 'auditing/record',
 'issuesecurityschemes',
 'issuetypescheme',
 'events',
 'issue/limit/report',
 'application-properties',
 'instance/license', 
 'license/approximateLicenseCount',
 'permissions', 
 'plans/plan', 
 'priorityscheme', 
 'role',
 'screenscheme', 
 'screens/tabs', 
 'screens', 
 'configuration/timetracking',
 'workflow',
 'workflowscheme', 
 'label', 
 'projectCategory',
 'component', 
 'project/type',
 'project',
 'serverInfo',
 'users',
 'statuscategory']}

}


DBT_CONFIG = {
    **{e:{
        "type": "page",
        "page_param": "offset",
        "page_size_param": "limit",
        "page_size":100

    }for e in ['accounts','encryptions','environments','invites','jobs','licenses','notifications','projects','repositories','runs','users']  }
}

JIRA_KEYS = {
     'auditing/record':'records','issuesecurityschemes':'issueSecuritySchemes','issuetypescheme':'values','issue/limit/report':'limits',
     'instance/license':'applications','permissions':'permissions','plans/plan':'values','priorityscheme':'values','screenscheme':'values',
     'screens/tabs':'values','screens':'values','workflowscheme':'values','label':'values','component':'values'
}

TALLY_CONGIG ={
    **{e:{
        "type": "page",
        "page_param": "page",
        'cursor_param':"hasMore",
        "page_size_param": "limit",
        "result_key": 'items',
        "page_size":100
    } for e in [ 'forms','webhooks','workspaces']},
    **{e: {
        "type": "None",
        "result_key":'items'
    } for e in ['users/me'] }
}

TALLY_KEYS= {
    "webhooks":'webhooks',"forms":"items","workspaces":"items"
}

HUBSPOT_CONFIG = {
**{e: {
        "type": "cursor",
        "cursor_param": "cursor",
        "cursor_field": "next",
        "cursor_inner_field":"after",
        "page_size_param": "pageSize",
        "result_key": "results"
    } for e in [
    "crm/v3/objects/contacts",
    "crm/v3/objects/companies",
    "crm/v3/objects/deals",
    "crm/v3/objects/tickets",
    "crm/v3/objects/quotes",
    "crm/v3/owners",
    "crm/v3/schemas",
    "marketing/v3/emails/",
    "marketing/v3/forms/",
    "cms/v3/blogs/posts",
    "settings/v3/users",
    "contacts/v1/lists",
    "crm/v3/imports/",
    "crm/v3/objects/custom",
    "crm/v3/objects/courses",
    "crm/v3/schemas/quotes",
    "crm/v3/schemas/companies",
    "crm/v3/objects/owners",
    "crm/v3/objects/marketing_events",
    "crm/v3/objects/users",
    "crm/v3/lists/",
    "crm/v3/objects/carts",
    "crm/v3/objects/owners",
    "crm/v3/objects/quotes",
    "crm/v3/schemas/courses",
    "crm/v3/schemas/contacts",
    "crm/v3/schemas/deals",
    "crm/v3/objects/goals",
    "crm/v3/objects/leads",
    "crm/v3/objects/line_items",
    "crm/v3/objects/orders",
    "crm/v3/objects/partner-clients",
    "crm/v3/objects/products",
    "crm/v3/objects/services",
    "crm/v3/pipelines/orders",
    "crm/v3/schemas/custom",
    "crm/v3/schemas/carts",
    "crm/v3/schemas/invoices",
    "crm/v3/schemas/listings",
    "crm/v3/schemas/commercepayments",
    "crm/v3/schemas/orders",
    "crm/v3/schemas/quotes",
    "crm/v3/schemas/subscriptions",
    "marketing/v3/campaigns/",
    "crm/v4/associations/definitions/configurations/all",
    "crm/v3/objects/carts",
    "crm/v3/objects/discounts",
    "crm/v3/objects/fees",
    "crm/v3/objects/invoices",
    "crm/v3/objects/commerce_payments",
    "crm/v3/objects/subscriptions",
    "crm/v3/objects/taxes",
    "crm/v3/limits/associations/labels",
    "crm/v3/limits/calculated-properties",
    "crm/v3/limits/custom-object-types",
    "crm/v3/limits/custom-properties",
    "crm/v3/limits/pipelines",
    "crm/v3/limits/associations/records/from",
    "crm/v3/limits/records",
    "crm/v3/lists/folders",
    "crm/v3/objects/feedback_submissions",
    "crm/v3/objects/goal_targets",
    "crm/v3/objects/partner_clients",
    "crm-object-schemas/v3/schemas",
    "crm/v3/owners/",
    "marketing/v3/emails/statistics/list",
    "marketing/v4/email/single-send",
    "marketing/v3/marketing-events/",
    "communication-preferences/v4/definitions",
    "account-info/v3/details",
    "account-info/v3/api-usage/daily/private-apps",
    "cms/v3/blogs/authors",
    "content/api/v2/blogs",
    "blogs/v3/topics",
    "cms/v3/domains/",
    "cms/v3/hubdb/tables",
    "cms/v3/hubdb/tables/draft",
    "content/api/v2/layouts",
    "cms/v3/pages/site-pages",
    "cms/v3/site-search/search",
    "content/api/v2/templates",
    "cms/v3/url-redirects/",
    "account-info/v3/activity/audit-logs",
    "settings/v3/currencies/codes"
]
}}

ZOHO_CRM_CONFIG = {

    **{e:{
        "type": "page",
        "page_param": "page",
        "cursor_field": "info",
        'cursor_param':"more_records",
        "page_size_param": "per_page",
        "result_key": 'data',
        "organizations":False
    } for e in [
        'leads','deals','contacts'
    ]},
}



ZOHO_INVENTORY_CONFIG = {

    **{e:{
        "type": "page",
        "page_param": "page",
        "cursor_field": "info",
        'cursor_param':"more_records",
        "page_size_param": "per_page",
        "result_key": None,
        "organizations":True
    } for e in["organizations", "items", "contacts", "salesorders", "packages", "invoices", "purchaseorders", "creditnotes", "pricebooks", "bills", "users", "locations", "salesreturns", "compositeitems", "itemgroups", "categories"]},
}


ZOHO_BOOKS_CONFIG = {
    **{e:{
        "type": "page",
        "page_param": "page",
        "cursor_field": "info",
        'cursor_param':"more_records",
        "page_size_param": "per_page",
        "result_key": None,
        "organizations":True
    } for e in ['organizations','estimates','salesorders','invoices','recurringinvoices','creditnotes','customerpayments','expenses','recurringexpenses',
              'retainerinvoices','purchaseorders','bills','recurringbills','vendorcredits','vendorpayments','bankaccounts','banktransactions',
              'chartofaccounts','journals','fixedassets','basecurrencyadjustment','projects','users','items','locations']}

}

ZOHO_KEYS = {
    "basecurrencyadjustment":"base_currency_adjustments","vendorcredits":"vendor_credits","recurringbills":"recurring_bills",
    "recurringexpenses":"recurring_expenses","recurringinvoices":"recurring_invoices","compositeitems":"composite_items"
}

NINJA_CONFIG = {

    **{e: {
        "type": "cursor",
        "cursor_param": "cursor",
        "cursor_field": "name",
        "page_size_param": "pageSize",
        "result_key": "results"
    } for e in [
        'queries/custom-fields-detailed', 
        'queries/custom-fields', 
        'queries/scoped-custom-fields-detailed', 
        'queries/scoped-custom-fields',
        'queries/software-patch-installs',
        'queries/antivirus-status',
        'queries/antivirus-threats',
        'queries/computer-systems', 
        'queries/device-health', 
        'queries/backup/usage',
        'queries/disks',
        'queries/logged-on-users', 
        'queries/network-interfaces',
        'queries/operating-systems', 'queries/os-patches', 
        'queries/software-patches', 'queries/policy-overrides', 'queries/processors', 
        'queries/raid-controllers', 'queries/raid-drives', 'queries/software', 
        'queries/volumes', 'queries/windows-services',

    ]},

    **{e: {
        "type": "page",
        "page_param": "after",
        "cursor_field": "id",
        "page_size_param": "pageSize",
        "order_by": "id",
        "result_key": None
    } for e in [
        'devices',
        'devices-detailed',
        'organizations',
        'organizations-detailed',
        'activities',
        'locations',
                ]},

    **{e: {
        "type": "None"
    } for e in [
        'jobs','alerts','users',
        'policies', 'automation/scripts', 'notification-channels/enabled', 
        'groups',  'roles', 'notification-channels', 'tasks', 
        'software-products', 'devices/search',  
        'ticketing/attributes',
        'related-items', 'knowledgebase/folder', 'organization/documents', 
        'document-templates', 'checklist/templates', 'organization/checklists', 
        'tag', 'knowledgebase/transfer'
    ]},
}

CONNECTWISE_CONFIG = {
    **{e :{
        "type":"page",
        "page_param":"page",
        "page_size_param":"pageSize",
        "page_size":100
    }
    for e in [
    'company/companies',
    'company/configurations',
    'service/tickets',
    'company/contacts',
    'sales/stages',
    'sales/opportunities',
    'sales/probabilities',
    'system/departments',
    'procurement/catalog',
    'company/countries',
    'marketing/groups/info',
    'finance/agreements',
    'finance/agreements/types',
    'project/projects',
    'project/tickets',
    'project/projectTypes',
    'finance/billingStatuses',
    'expense/paymentTypes',
    'expense/paymentTypes/info',
    'sales/activities',
    'sales/activities/types',
    'company/addressFormats',
    'system/allowedfiletypes/',
    'system/allowedorigins/',
    'system/apiMembers',
    'system/audittrail',
    'system/authAnvils',
    'finance/billingCycles',
    'finance/billingSetups',
    'finance/billingTerms',
    'service/boards',
    'service/info/boardtypes',
    'schedule/calendars/info',
    'schedule/calendars',
    'system/callbacks',
    'marketing/campaigns',
    'marketing/campaigns/statuses',
    'marketing/campaigns/types',
    'procurement/categories',
    'procurement/changeorder',
    'system/certifications',
    'time/chargeCodes',
    'expense/classifications',
    'service/codes',
    'sales/commissions',
    'company/communicationTypes',
    'finance/companyFinance/',
    'company/companies/info',
    'company/marketDescriptions',
    'company/noteTypes',
    'company/ownershipTypes',
    'company/companies/statuses',
    'company/teamRoles',
    'company/companyTypeAssociations',
    'company/companies/types',
    'company/configurations/types',
    'company/configurations/statuses',
    'system/connectwisehostedsetups',
    'company/contacts/departments',
    'company/contacts/info',
    'company/contacts/types',
    'time/workTypes',
    'time/workRoles',
    'system/workflows',
    'procurement/warehouses',
    'system/userDefinedFields',
    'company/tracks',
    'time/sheets',
    'time/entries',
    'system/myCompany/timeExpense',
    'finance/taxIntegrations',
    'finance/taxCodes',
    'system/settings/',
    'system/surveys',
    'procurement/subcategories/',
    'service/sources',
    'service/SLAs',
    'system/skills',
    'procurement/shipmentmethods',
    'service/teams',
    'service/surveys',
    'service/serviceSignoff',
    'service/locations',
    'service/emailTemplates',
    'system/securityroles',
    'schedule/types',
    'schedule/statuses',
    'schedule/details',
    'schedule/entries',
    'sales/salesTeams',
    'sales/quotas',
    'sales/roles',
    'procurement/rmaTags',
    'procurement/rmaStatuses',
    'procurement/rmaActions',
    # 'system/reports',
    'system/quoteLinkSetup',
    'procurement/purchaseorders',
    'procurement/purchaseorderstatuses',
    'project/statuses',
    'procurement/types',
    'service/priorities',
    'system/portalReports',
    'company/portalConfigurations',
    'schedule/portalcalendars',
    'project/phaseStatuses',
    'sales/orders',
    # 'system/myMembers',
    'system/members',
    'procurement/manufacturers',
    'system/kpis',
    'finance/invoices',
    # 'system/info',
    'schedule/holidaysLists',
    'marketing/groups',
    'finance/glAccounts',
    'system/experiments',
    'expense/entries',
    'system/emailConnectors',
    'system/documents',
    'finance/currencies',
    'system/myCompany/crm'
]


}}

HALOPSA_CONFIG = {

    **{e :{
        "type":"page",
        "page_param":"page_no",
        "page_size_param":"page_size",
        "page_size":1000
    }
    for e in ['Client', 'ToDoGroup', 'PurchaseOrder', 'Site', 'Service', 'ReleasePipeline', 'Release', 'Quotation', 'Projects',
                'OrderLine', 'SalesOrder', 'Opportunities', 'Chat', 'Item', 'Invoice', 
               'Tickets', 'Asset', 'Supplier', 'CallLog', 'Attachment', 'CRMNote', 'Report', 'Actions', 'ClientContract']},
        
    
    **{e :{
        "type":"None"
    }
    for e in ['Webhook', 'UserRoles', 'AssetTypeInfo', 'Agent', 'Status', 'Timesheet', 'Tax', 'Tags', 'Tabs',
               'SlackDetails', 'Team', 'Schedule', 'SalesMailbox', 'TicketType', 'Product', 'ProductComponent',
                 'Priority', 'Organisation', 'OnlineStatus', 'Roles', 'Application', 'Features', 'EmailTemplate',
                   'Mailbox', 'Lookup', 'LicenseInfo', 'Languages', 'JiraDetails', 'Instance', 'Holiday', 'AssetGroup', 
                   'Feedback', 'ToDO', 'Event', 'Currency', 'Category',
               'CAB', 'BudgetType', 'TicketRules', 'AISuggestion', 'Address', 'Workday', 'Workflow', 'TimesheetEvent', 'SLA']

    }} 

Halopsa_keys = {
    "users":"users","Client":"clients","ToDoGroup":"data","PurchaseOrder":"purchaseorders","Site":"sites","Service":"services",
    "ReleasePipeline":"releasepipelines","Release":"releases","Quotation":"quotes","Projects":"tickets",
    "OrderLine":"orderlines","SalesOrder":"salesorders","Opportunities":"tickets","Chat":"chats","Item":"items",
    "Invoice":"invoices","Tickets":"tickets","Asset":"assets","Supplier":"suppliers","CallLog":"calllog","Attachment":"attachments",
    "CRMNote":"actions","Report":"reports","Actions":"actions","ClientContract":"contracts"
}

BAMBOOHR_CONFIG = {
    **{e :{
        "type":"page",
        "page_param":"page",
        "page_size_param":"pageSize",
        "page_size":100
    } for e in ['webhooks','datasets','custom-reports','applicant_tracking/applications','applicant_tracking/statuses',
            'applicant_tracking/locations','applicant_tracking/hiring_leads','applicant_tracking/jobs','benefit/member_benefit','benefits/settings/deduction_types/all',
            'benefitcoverages','employeedependents','company_information','employees/directory','files/view','meta/time_off/policies',
            'meta/time_off/types','time_off/whos_out','meta/users','meta/tables','training/type','training/category']  

    }}

BAMBOOHR_KEYS = {'datasets':'datasets','webhooks':'webhooks','custom-reports':'reports','applicant_tracking/applications':'applications',
 'benefit/member_benefit':'members','benefitcoverages':'Benefit Coverages','employeedependents':'Employee Dependents',
 'employees/directory':'fields','files/view':'categories','meta/time_off/types':'timeOffTypes'}

SHOPIFY_CONFIG = {
    **{e :{
        "type":"None",
    } for e in ['orders','customers','products', 'price_rules','shipping_zones','script_tags']}
}


class NinjaClient:
    BASE_URL = "https://api.ninjaone.com/v2"
    TOKEN_URL = "https://api.ninjaone.com"
    PAGE_SIZE = 1000

    def __init__(self, token_metadata,credentials,Integration_id):
        self.token_metadata = token_metadata
        self.access_token = self.token_metadata['access_token']
        self.credentials = credentials
        self.Integration_id = Integration_id

    def headers(self):
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
        }

    def get_new_token(self):
        import ast

        url = "{}/oauth/token".format(self.TOKEN_URL)
        scopes1 = ast.literal_eval(self.credentials['scopes']) if isinstance(self.credentials['scopes'], str) else self.credentials['scopes']
        scopes = ' '.join(scopes1)
        headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            'grant_type': 'client_credentials',
            'client_id': self.credentials['client_id'],
            'client_secret': self.credentials['client_secret'],
            'scope': str(scopes)
        }
        
        response = requests.post(url, headers=headers,data=data,timeout=30)
        if response.status_code == 200:
            result = response.json()
            self.token_metadata = result
            Integrations.objects.filter(id=self.Integration_id).update(
                token_metadata = encrypt_json(self.token_metadata),
            )
            self.access_token = result.get('access_token')
            return self.access_token
        else:
            raise 'Invalid Credentials Error'
            # return {'status':400,'message':'Invali Data'}

    def fetch_page(self, endpoint: str, params):
        r = requests.get(
            f"{self.BASE_URL}/{endpoint}",
            headers=self.headers(),
            params = params,
            timeout=30,
        )
        if r.status_code ==401:
            self.get_new_token()
            return self.fetch_page(endpoint,params)

        elif r.status_code == 200:
            return r.json()
        else:
            return None


    def stream_batches(self, endpoint: str, batch_size: int = 1):
        cfg = NINJA_CONFIG[endpoint]
        batch = []

        if cfg["type"] == "None":
            response = self.fetch_page(endpoint, {})

            batch.extend(response)
            if len(batch) >= batch_size:
                yield batch
                batch = []

            if batch:
                yield batch
            return
        
        if cfg["type"] == "cursor":
            cursor = None

            while True:
                params = {
                    cfg["page_size_param"]: batch_size,
                }

                if cursor:
                    params[cfg["cursor_param"]] = cursor

                response = self.fetch_page(endpoint, params)
                records = response.get(cfg["result_key"], [])
                

                if not records:
                    break

                # for record in records:
                #     batch.append(record)
                    

                    # if len(batch) >= batch_size:
                yield records
                batch = []
                
                cursor_condition = response.get("cursor",None)
                if cursor_condition:
                    cursor = cursor_condition.get(cfg['cursor_field'])
                elif not cursor_condition:
                    break
                else:
                    pass
            if batch:
                yield batch
            return
        
        elif cfg["type"] == "page":
            page = None

            while True:
                params = {
                    cfg["page_size_param"]: batch_size,
                    "orderBy": cfg.get("order_by", "id"),
                }

                if page:
                    params[cfg["page_param"]] = page

                response = self.fetch_page(endpoint, params)

                if not response:
                    break

                for record in response:
                    batch.append(record)
                    page = record[-1].get(cfg['cursor_field'])

                    if len(batch) >= batch_size:
                        yield batch
                        batch = []

            if batch:
                yield batch
            return


class ConnectwiseClient:
    def __init__(self, token_metadata,credentials,Integration_id):
        self.token_metadata = token_metadata
        self.access_token = self.token_metadata['access_token']
        self.credentials = credentials
        self.Integration_id = Integration_id
        self.site_url = self.credentials['site_url']
        self.Base_url = f"{self.site_url.rstrip('/')}/v4_6_release/apis/3.0"

    def headers(self):
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
        }

    def fetch_page(self, endpoint: str, params):
        
        r = requests.get(
            f"{self.Base_url}/{endpoint}",
            headers=self.headers(),
            params = params,
            timeout=30,
        )
        if r.status_code ==401:
            return []
        


        elif r.status_code == 200:
            # key = Halopsa_keys.get(endpoint,None)
            # response = r.json()
            # if response !=[]:
            #     if key:
            #         response = response[key]
            # return response
            return r.json()
        else:
            return []
    
    def stream_batches(self, endpoint: str, batch_size: int = 10000):
        cfg = CONNECTWISE_CONFIG[endpoint]
        batch = []
       
        if cfg["type"] == "page":
            page = 1

            while True:
                params = {
                    cfg["page_size_param"]: cfg["page_size"],
                    "pageinate":True
                }

                if page:
                    params[cfg["page_param"]] = page

                response = self.fetch_page(endpoint, params)

                if not response or response==[]:
                    break
                page +=1
       
                batch.extend(response)


                if len(batch) >= batch_size:
                    yield batch
                    batch = []
            if batch:
                yield batch
            return
        



class ZohoClient:
    

    def __init__(self, token_metadata,credentials,Integration_id):
        self.token_metadata = token_metadata
        self.access_token = self.token_metadata['access_token']
        self.credentials = credentials
        self.Integration_id = Integration_id
        self.domain = self.credentials['domain']
        self.zoho_type = self.credentials['zohotype']
    
    def headers(self):
        return {
            "Authorization": f"Zoho-oauthtoken {self.access_token}",
            "Accept": "application/json",
        }

    def get_new_token(self):
        import ast

        url = f'https://accounts.zoho{self.domain}/oauth/v2/token'
        scopes1 = ast.literal_eval(self.credentials['scopes']) if isinstance(self.credentials['scopes'], str) else self.credentials['scopes']
        scopes = ' '.join(scopes1)
        
        data = {
            'grant_type': 'refresh_token',
            'client_id': '1000.13IJD9MCJYUG737C2BVMG23V5LW1IE',
            'client_secret': 'ba74a03fc77feb7373651a00bad63aaa39c799ff76',
            'refresh_token':self.token_metadata['refresh_token']
        }
        
        response = requests.post(url, data=data)
        if response.status_code == 200:
            result = response.json()
            self.token_metadata = result
            Integrations.objects.filter(id=self.Integration_id).update(
                token_metadata = encrypt_json(self.token_metadata),
            )
            self.access_token = result.get('access_token')
            return self.access_token
        else:
            raise 'Invalid Credentials Error'
            # return {'status':400,'message':'Invali Data'}
        


    def get_organizations(self,base):
        url = f"https://www.zohoapis{self.domain}{base}/organizations"
        response = requests.get(url,headers=self.headers())
        if response.status_code==401:
            self.get_new_token()
            return self.get_organizations(base)
        
        data=response.json()
        return [o["organization_id"] for o in data.get("organizations", [])]
    
    def fetch_page(self,endpoint,params):
        check_flag = False 
        if self.zoho_type.lower() =='zoho_crm':
            organization_ids = None
            cfg = ZOHO_CRM_CONFIG[endpoint]
            base_url = f'https://www.zohoapis{self.domain}/crm/v2/{endpoint}'
        elif self.zoho_type.lower() =='zoho_inventory':
            cfg = ZOHO_INVENTORY_CONFIG[endpoint]
            base_url = f'https://www.zohoapis{self.domain}/inventory/v1/{endpoint}'
        elif self.zoho_type.lower() =='zoho_books':
            cfg = ZOHO_BOOKS_CONFIG[endpoint]
            base_url = f'https://www.zohoapis{self.domain}/books/v3/{endpoint}'
        
        if params == {} :
            
            check_flag = True
            if self.zoho_type.lower() =='zoho_crm':
                organization_ids = None
            elif self.zoho_type.lower() =='zoho_inventory':
                organization_ids =self.get_organizations('/inventory/v1')
            elif self.zoho_type.lower() =='zoho_books':
                organization_ids =self.get_organizations('/books/v3')
            if organization_ids:
                params = {
                    'organization_id':organization_ids[0]
                }
            else :
                check_flag=True
        r = requests.get(base_url, headers=self.headers(), params=params, timeout=30)
        if r.status_code == 401:
            self.get_new_token()
            return self.fetch_page(endpoint, params)

        if r.status_code == 200:
            data = r.json()
            if check_flag:
                key =  ZOHO_KEYS.get(endpoint,None )if cfg['result_key'] is None else cfg['result_key']
                if key is None:
                    key = endpoint
                records = data.get(key,endpoint)
                if isinstance(records,dict):
                    return [records]
                else:
                    return records
            return data
        return data
    
    def stream_batches(self,endpoint,batch_size=200):
        if self.zoho_type.lower() =='zoho_crm':
            cfg = ZOHO_CRM_CONFIG[endpoint]
        elif self.zoho_type.lower() =='zoho_inventory':
            cfg = ZOHO_INVENTORY_CONFIG[endpoint]
            organization_ids =self.get_organizations('/inventory/v1')
        elif self.zoho_type.lower() =='zoho_books':
            cfg = ZOHO_BOOKS_CONFIG[endpoint]
            organization_ids =self.get_organizations('/books/v3')

        else:
            return None
        batch = []
        if cfg['type'] =='page':
            page=1
            if cfg['organizations']:
                for organization_id in organization_ids:
                    while True:
                        params = {
                            cfg['page_size_param']:batch_size,
                            "organization_id":organization_id
                        
                        }
                        if page:
                            params[cfg['page_param']] = page
                        
                        response = self.fetch_page(endpoint,params)
                        
                        page+=1
                        key =  ZOHO_KEYS.get(endpoint,None )if cfg['result_key'] is None else cfg['result_key']
                        if key is None:
                            key = endpoint
                        records = response.get(key,endpoint)
                        batch.extend(records)
                        if  response.get('info',None) is None:
                            break

                        if len(batch) >= batch_size:
                            yield batch
                            batch = []
                    if batch:
                        yield batch
                    return
            else:
                while True:
                    params = {
                        cfg['page_size_param']:batch_size,                        
                    }
                    if page:
                        params[cfg['page_param']] = page
                    
                    response = self.fetch_page(endpoint,params)
                    
                    page+=1
                    key =  ZOHO_KEYS.get(endpoint,None) if cfg['result_key'] is None else cfg['result_key']
                    if key is None:
                        key = endpoint
                    records = response.get(key,endpoint)

                    batch.extend(records)


                    if len(batch) >= batch_size:
                        yield batch
                        batch = []
                    if  response.get(cfg['cursor_field'],None) is None:
                        break
                    elif  not response.get(cfg['cursor_field'],None)[cfg['cursor_param']]:
                        break
                if batch:
                    yield batch
                return
                


        





class HubSpotClient:
    BASE_URL = "https://api.hubapi.com"
    TOKEN_URL = "https://api.hubapi.com/oauth/v1/token"
    PAGE_SIZE = 1000

    def __init__(self, token_metadata,credentials,Integration_id):
        self.token_metadata = token_metadata
        self.access_token = self.token_metadata['access_token']
        self.credentials = credentials
        self.Integration_id = Integration_id

    def headers(self):
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
        }

    def get_new_token(self):
        import ast

        scopes1 = ast.literal_eval(self.credentials['scopes']) if isinstance(self.credentials['scopes'], str) else self.credentials['scopes']
        scopes = ' '.join(scopes1)
        headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            'grant_type': 'refresh_token',
            'client_id': self.credentials['client_id'],
            'client_secret': self.credentials['client_secret'],
            'refresh_token':self.token_metadata['refresh_token']
        }
        
        response = requests.post(self.TOKEN_URL, headers=headers,data=data,timeout=30)
        if response.status_code == 200:
            result = response.json()
            self.token_metadata = result
            Integrations.objects.filter(id=self.Integration_id).update(
                token_metadata = encrypt_json(self.token_metadata),
            )
            self.access_token = result.get('access_token')
            return self.access_token
        else:
            raise 'Invalid Credentials Error'
            # return {'status':400,'message':'Invali Data'}

    def fetch_page(self, endpoint: str, params):
        r = requests.get(
            f"{self.BASE_URL}/{endpoint}",
            headers=self.headers(),
            params = params,
            timeout=30,
        )
        if r.status_code ==401:
            self.get_new_token()
            return self.fetch_page(endpoint,params)

        elif r.status_code == 200:
            data = r.json()

            return data['results']
        else:
            return None


    def stream_batches(self, endpoint: str, batch_size: int = 1):
        cfg  = HUBSPOT_CONFIG[endpoint]
        batch = []

        if cfg["type"] == "none":
            response = self.fetch_page(endpoint, {})

            batch.extend(response)
            if len(batch) >= batch_size:
                yield batch
                batch = []

            if batch:
                yield batch
            return
        
        if cfg["type"] == "cursor":
            cursor = None

            while True:
                params = {
                    cfg["page_size_param"]: batch_size,
                }

                if cursor:
                    params[cfg["cursor_param"]] = cursor

                response = self.fetch_page(endpoint, params)
                records = response.get(cfg["result_key"], [])
                

                if not records:
                    break

                # for record in records:
                batch.append(records)
                

                if len(batch) >= batch_size:
                    yield records
                    batch = []
                
                cursor_condition = response.get("paging",None)
                if cursor_condition:
                    cursor = cursor_condition.get(cfg['cursor_field']).get(cfg['cursor_inner_field'])
                elif not cursor_condition:
                    break
                else:
                    pass
            if batch:
                yield batch
            return


class HubspotClientToken:

    def __init__(self, token_metadata,credentials,Integration_id):
        self.token_metadata = token_metadata
        self.credentials = credentials
        self.access_token = self.credentials['api_token']
        self.Integration_id = Integration_id
        self.site_url = self.credentials['site_url']


    def headers(self):
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
        }

    def get_new_token(self):
        pass

    def fetch_page(self, endpoint: str, params):
        check_flag = False
        if params == {}:
            check_flag=True
            params = {
                "limit":100
            }
        url = f"{(self.site_url).rstrip('/')}/{endpoint}"
        r = requests.get(
            url,
            headers=self.headers(),
            params = params,
            timeout=30,
        )
        if r.status_code ==401:
            raise ValueError({"message":f"Invalid Credentials"})
        elif r.status_code == 403:
            data = r.json()
            context = data['errors'][0]['context']
            required_scopes = context['requiredGranularScopes']
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied({
                "message": "Required scopes missing",
                "required_scopes": required_scopes,
            })

        elif r.status_code == 200:
            data = r.json()

            if check_flag:

                return data['results']
            else:
                return data
        else:
            return None




    def stream_batches(self, endpoint: str, batch_size: int = 1):
        cfg  = HUBSPOT_CONFIG[endpoint]
        batch = []

        if cfg["type"] == "none":
            response = self.fetch_page(endpoint, {})

            batch.extend(response)
            if len(batch) >= batch_size:
                yield batch
                batch = []

            if batch:
                yield batch
            return
        
        if cfg["type"] == "cursor":
            cursor = None

            while True:
                params = {
                    cfg["page_size_param"]: 500,
                }

                if cursor:
                    params[cfg["cursor_inner_field"]] = cursor
                response = self.fetch_page(endpoint, params)

                records = response.get(cfg["result_key"], [])
                

                if not records:
                    break

                # for record in records:
                batch.extend(records)
                    

                if len(batch) >= batch_size:
                    yield records
                    batch = []
                
                cursor_condition = response.get("paging",None)
                if cursor_condition:
                    cursor = cursor_condition.get(cfg['cursor_field']).get(cfg['cursor_inner_field'])
                elif not cursor_condition:
                    break
                else:
                    pass
            if batch:
                yield batch
            return





 
class QuickbooksClient:
    PAGE_SIZE = 1000
    SCOPES = 'all'

    def __init__(self, token_metadata,credentials,Integration_id):
        self.token_metadata = token_metadata
        self.access_token = self.token_metadata['access_token']
        self.credentials = credentials
        self.Integration_id = Integration_id
        self.TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
        self.realm_id = self.credentials['realm_id']
        self.refresh_token = self.token_metadata['refresh_token']
        self.api_url = 'https://sandbox-quickbooks.api.intuit.com'
        self.get_company_info()

    def headers(self):
        return {
            "Authorization": f"Bearer {self.access_token}",
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        }

    
    def get_new_token(self):
        import ast

        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            'Accept': 'application/json'
        }
        
        data = {
            'grant_type': 'refresh_token',
            'client_id': 'ABAu0mxfPG1sIZHo0XfybcNS0K3k3wPIItALoYNDlGAhMbQfTp',
            'client_secret': 'N2LF3caez3Abv4yFSTzlYWmOWKqCKaurOwwkD6CF',
            'realm_id':self.realm_id,
            'refresh_token':self.refresh_token
        }
        
        response = requests.post(self.TOKEN_URL, headers=headers,data=data,timeout=30)
        if response.status_code == 200:
            result = response.json()
            self.token_metadata = result
            Integrations.objects.filter(id=self.Integration_id).update(
                token_metadata = encrypt_json(self.token_metadata),
            )
            self.access_token = result.get('access_token')
            return self.access_token
        else:
            raise 'Invalid Credentials Error'

    def get_company_info(self):
        import datetime
        api_url = f"{self.api_url}/v3/company/{self.realm_id}/query?query=select * from CompanyInfo&minorversion=69"
        response = requests.get(api_url, headers=self.headers())
        if response.status_code == 200:
            self.from_date = datetime.datetime.fromisoformat(response.json().get("QueryResponse", {}).get("CompanyInfo", [{}])[0].get("MetaData", {}).get("CreateTime")).date()
        else:
            self.from_date='1970-01-01'
        self.to_date = datetime.datetime.now().date()
    

    def build_url(self,endpoint):
        if endpoint.lower() in ['balance_sheet', 'profitandloss','balance/sheet']:
            report_type = "BalanceSheet" if endpoint.lower() == "balance_sheet" or endpoint.lower() == "balance/sheet" else "ProfitAndLoss"
            report_url = f"{self.api_url}/v3/company/{self.realm_id}/reports/{report_type}?start_date={self.from_date}&end_date={self.to_date}&minorversion=69"
        elif endpoint in ["ProfitAndLossDetail","TransactionList","TrialBalance","VendorExpenses","AgedPayableDetail","AgedReceivableDetail"]:
            report_url = f"{self.api_url}/v3/company/{self.realm_id}/reports/{endpoint}?start_date={self.from_date}&end_date={self.to_date}&minorversion=69"
        elif endpoint in  ["CustomerBalance","CustomerBalanceDetail","CashFlow","AgedReceivables","AccountList","CustomerIncome","VendorBalance","GeneralLedger"]:
            report_url = f"{self.api_url}/v3/company/{self.realm_id}/reports/{endpoint}?minorversion=69"
        else:
            report_url = None
        return report_url


    def fetch_page(self,endpoint,params):
        if params=={}:
            check_flag = True
            start_pos = 1
            max_results = 200
        else:
            check_flag=False
            start_pos = params['start_pos']
            max_results = params['max_results']
        
        url = self.build_url(endpoint)
        if url:
            r = requests.get(
            url,
            headers=self.headers()
            )
            if r.status_code ==200:
                data= r.json()
                if isinstance(data,dict):
                    return [data]
                else:
                    return data
            elif r.status_code ==401:
                self.get_new_token()
                return self.fetch_page(endpoint,params)
            else:
                return []
        else:
            
            query = f"SELECT * FROM {endpoint} STARTPOSITION {start_pos} MAXRESULTS {max_results}"
            url = f"{self.api_url}/v3/company/{self.realm_id}/query?query={query}&minorversion=69"
            response = requests.get(
            url,
            headers=self.headers()
            )
            if response.status_code ==200:
                if check_flag:
                    try:
                        data_page = response.json().get("QueryResponse", {}).get(str(endpoint).capitalize(), [])
                        if data_page==[] or data_page==None:
                            data_page = response.json().get("QueryResponse", {}).get(endpoint, [])
                            if data_page==[] or data_page==None:
                                data_page = response.json().get("QueryResponse", {})
                                if data_page==[] or data_page==None:
                                    data_page = response.json()
                    except:
                        data_page = response.json()
                else:
                    data_page = response.json()
                if isinstance(data_page,dict):
                    return [data_page]
                else:
                    return data_page
            elif response.status_code ==401:
                self.get_new_token()
                return self.fetch_page(endpoint,params)
            else:
                return []
        
    def stream_batches(self, endpoint: str, batch_size: int = 1): #not implemented
        cfg  = QUICKBOOKS_CONFIG[endpoint]
        batch = []

        
        if cfg["type"] == "page":
            max_results = 0
            start_page = 0
            while True:
                params = {
                    "start_pos":start_page,
                    "max_results":max_results
                }

                response = self.fetch_page(endpoint, params)
                if endpoint not in ["CustomerBalance","CustomerBalanceDetail","CashFlow","AgedReceivables","AccountList","CustomerIncome","VendorBalance","GeneralLedger",
                                    "ProfitAndLossDetail","TransactionList","TrialBalance","VendorExpenses","AgedPayableDetail","AgedReceivableDetail"]:
                    
                
                    response = self.fetch_page(endpoint)
                    try:
                        data_page = response.json().get("QueryResponse", {}).get(str(tabl_name).capitalize(), [])
                        if data_page==[] or data_page==None:
                            data_page = response.json().get("QueryResponse", {}).get(tabl_name, [])
                            if data_page==[] or data_page==None:
                                data_page = response.json().get("QueryResponse", {})
                                if data_page==[] or data_page==None:
                                    data_page = response.json()
                    except:
                        data_page = response.json()
                    if len(data_page) < max_results:
                        break  # No more records to fetch
                    start_pos += max_results

                    batch.extend(data_page)
                    

                    if len(batch) >= batch_size:
                        yield batch
                        batch = []
                    
                    cursor_condition = response.get("paging",None)
                    if cursor_condition:
                        cursor = cursor_condition.get(cfg['cursor_field']).get(cfg['cursor_inner_field'])
                    elif not cursor_condition:
                        break
                    else:
                        pass
                
                else:
                    response = self.fetch_page(endpoint, params)
                    

                    if not response:
                        yield batch

                    batch.extend(response)
                    

                    if len(batch) >= batch_size:
                        yield batch
                        batch = []
                    yield batch
            if batch:
                yield batch


            
    

        
    

class SalesforceClient:

    def __init__(self, token_metadata,credentials,Integration_id):
        self.token_metadata = token_metadata
        self.access_token = self.token_metadata['access_token']
        self.credentials = credentials
        self.Integration_id = Integration_id
        self.domain_url = self.token_metadata['instance_url']
        self.TOKEN_URL = 'https://login.salesforce.com/services/oauth2/token'
        self.refresh_token = self.token_metadata['refresh_token']
        self.api_url = 'https://sandbox-quickbooks.api.intuit.com'
        self.cfg = SALESFORCE_CONFIG


    def headers(self):
        return {
        'Authorization': f'Bearer {str(self.access_token)}',
        'Content-Type': 'application/json'
    }

    def get_new_token(self):
        import ast

        url = self.TOKEN_URL
        headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            'grant_type': 'refresh_token',
            'client_id': Integration_Credentials['SALESFORCE']['CLIENT_ID'],
            'client_secret': Integration_Credentials['SALESFORCE']['CLIENT_SECRET'],
            'refresh_token':self.refresh_token
        }
        
        response = requests.post(url, headers=headers,data=data,timeout=30)
        if response.status_code == 200:
            result = response.json()
            self.token_metadata = result
            Integrations.objects.filter(id=self.Integration_id).update(
                token_metadata = encrypt_json(self.token_metadata),
            )
            self.access_token = result.get('access_token')
            return self.access_token
        else:
            raise 'Invalid Credentials Error'
            # return {'status':400,'message':'Invali Data'}


    def get_columns(self,endpoint,params):
        describe_url = f'{self.domain_url}/services/data/v53.0/sobjects/{endpoint}/describe'
        r = requests.get(
                describe_url,
                headers=self.headers()
            )
        if r.status_code ==200:
            describe_data = r.json().get('fields', [])

        elif r.status_code ==401:
            self.get_new_token()
            return self.fetch_page(endpoint,params)
        else: return False
        fields=describe_data
        column_names = [field['name'] for field in fields]
        columns_string = ', '.join(column_names)
        return columns_string
    def fetch_page(self,endpoint,params):

        check_flag=False
        base_url = f'{self.domain_url}/services/data/v53.0'
        if params =={}:
            check_flag =True
            columns_string =  self.get_columns(endpoint,params)
            base_url = f'{self.domain_url}/services/data/v53.0'
            soql_query = f"SELECT {columns_string} FROM {endpoint}"
            url = f"{base_url}/query/?q={soql_query}"
        else:
            if params['q']:
                url = f"{base_url}/query/"
            elif params['nextRecordsUrl']:
                url = f"{base_url}/{params['nextRecordsUrl']}"
        r = requests.get(
            url,
            headers=self.headers(),
            params = params,
            timeout=30,
        )
        if r.status_code ==200:
            data = r.json()
            if check_flag:
                return data['records']
        elif r.status_code ==401:
            self.get_new_token()
            return self.fetch_page(endpoint,params)
        return data
    
    def stream_batches(self, endpoint: str, batch_size: int = 10000):
        cfg = self.cfg[endpoint]
        batch = []

        columns_string = self.get_columns(endpoint,{})
        base_url = f'{self.domain_url}/services/data/v53.0'
        soql_query = f"SELECT {columns_string} FROM {endpoint}"
       
        if cfg["type"] == "page":
            next_url = None
            
            while True:
                params = {
                    cfg["page_param"]: soql_query
                }

                if next_url:
                    params[cfg["cursor_param"]] = next_url

                response = self.fetch_page(endpoint, params)

                if not response:
                    break
                
                
                records = response.get('records',endpoint)
       
                batch.extend(records)


                if len(batch) >= batch_size:
                    yield batch
                    batch = []
                if response.get(cfg['cursor_param'],None):
                    next_url =  response[cfg['cursor_param']]
                else:
                    break
            if batch:
                yield batch
            return
        


class JiraClient:

    def __init__(self, token_metadata,credentials,Integration_id):
        self.token_metadata = token_metadata
        self.credentials = credentials
        self.access_token = self.token_metadata['access_token']
        self.Integration_id = Integration_id
        self.site_url = self.credentials['site_url']
        self.cfg = JIRA_CONFIG
        self.cloud_id = 'db01ffec-746c-4fb3-adb1-8b59441c85b8'
        self.TOKEN_URL ='https://auth.atlassian.com/oauth/token'

    def headers(self):
        return {
            "Authorization": f"Bearer {self.access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        }

    def get_new_token(self):
        import ast
        headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            'grant_type': 'refresh_token',
            'client_id': '9sNBkVdtZ01qJlOVrPxk7LpuCFwaH1m7',
            'client_secret': 'ATOAG1bronGKmT5Y_q3rhy86brDnBEItty_qYGgtMhlRIo0aC2ZqgOkPb6CuDiNRuuQC02881301',
            'refresh_token':self.token_metadata['refresh_token']
        }
        response = requests.post(self.TOKEN_URL, data=data,timeout=30)
        if response.status_code == 200:
            result = response.json()
            self.token_metadata = result
            Integrations.objects.filter(id=self.Integration_id).update(
                token_metadata = encrypt_json(self.token_metadata),
            )
            self.access_token = result.get('access_token')
            return self.access_token
        else:
            return False
            # return {'status':400,'message':'Invali Data'}

        

    def fetch_page(self, endpoint: str, params):
        url = f"https://api.atlassian.com/ex/jira/{self.cloud_id}/rest/api/3/"
        check_flag = False
        if params == {}:
            check_flag=True
            params = {
                "maxResults":100,
                "startAt":0
            }
        r = requests.get(
            f"{url}{endpoint}",
            headers=self.headers(),
            params = params,
            timeout=60,
        )
        if r.status_code ==401:
            data = self.get_new_token()
            if data:
                return self.fetch_page(endpoint,params)
            else:
                return False
        elif r.status_code == 200:
            key = JIRA_KEYS.get(endpoint,None)
            response = r.json()
            if check_flag:
                if response !=[]:
                    if key:
                        response = response[key]
                if isinstance(response,dict):
                    return [response]
            return response
        

        else:
            return []



    def stream_batches(self, endpoint: str, batch_size: int = 10000):
        cfg = self.cfg[endpoint]
        batch = []
       
        if cfg["type"] == "page":
            page = 0

            while True:
                params = {
                    cfg["page_size_param"]: cfg["page_size"]
                }

                if page:
                    params[cfg["page_param"]] = page

                response = self.fetch_page(endpoint, params)
                if isinstance(response,list):
                    if not response:
                        break
                    batch.extend(response)
                    break
                else:
                    if not response or not response[cfg['cursor_field']]:
                        break
                
                    key = JIRA_KEYS.get(endpoint,None)
                    if key :
                        records = response.get(key,endpoint)
                    else:
                        records=response
                    batch.extend(records)
                    if not response[cfg['cursor_param']]:
                        page += response['total']
                    else:
                        break


                if len(batch) >= batch_size:
                    yield batch
                    batch = []
                
            if batch:
                yield batch
            return






class Pax8Client:

    def __init__(self, token_metadata,credentials,Integration_id):
        self.token_metadata = token_metadata
        self.credentials = credentials
        self.access_token = self.token_metadata['access_token']
        self.Integration_id = Integration_id
        self.site_url = self.credentials['site_url']
        self.cfg = PAX8_CONFIG
        self.TOKEN_URL = 'https://api.pax8.com/v1/token'

    def headers(self):
        return {
            "Authorization": f"Bearer {self.access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        }

    def get_new_token(self):
        import ast
        headers = {
                'Content-Type': 'application/json',
                'accept':'application/json'
            }
        data = {
            'grant_type': 'client_credentials',
            "audience": "https://api.pax8.com",
            'client_id': self.credentials['client_id'],
            'client_secret': self.credentials['client_secret'],
            # 'refresh_token':self.token_metadata['refresh_token']
        }
        response = requests.post(self.TOKEN_URL, json=data,headers=headers,timeout=60)
        if response.status_code == 200:
            result = response.json()
            self.token_metadata = result
            Integrations.objects.filter(id=self.Integration_id).update(
                token_metadata = encrypt_json(self.token_metadata),
            )
            self.access_token = result.get('access_token')
            return self.access_token
        else:
            return False
            # return {'status':400,'message':'Invali Data'}

        

    def fetch_page(self, endpoint: str, params):
        url = f"{self.site_url}/v1/"

        check_flag = False
        if params == {}:
            check_flag=True
            params = {
                "limit":100,
                "page":1
            }
        r = requests.get(
            f"{url}{endpoint}",
            headers=self.headers(),
            params = params,
            timeout=60,
        )
        if r.status_code ==401:
            data = self.get_new_token()
            if data:
                return self.fetch_page(endpoint,params)
            else:
                return False
        elif r.status_code == 200:
            response = r.json()
            if check_flag:
                if response !=[]:
                    response = response['content']
                if isinstance(response,dict):
                    return [response]
            return response  
        

        else:
            return []



    def stream_batches(self, endpoint: str, batch_size: int = 10000):
        cfg = self.cfg[endpoint]
        batch = []
       
        if cfg["type"] == "page":
            page = 1

            while True:
                params = {
                    cfg["page_size_param"]: cfg["page_size"],
                }

                if page:
                    params[cfg["page_param"]] = page

                response = self.fetch_page(endpoint, params)
                if not response :
                    break

                
                
                batch.extend(response['content'])


                if len(batch) >= batch_size:
                    yield batch
                    batch = []
                if  response.get('page')['totalPages'] == response.get('page')['number']+1:
                    break
                else:
                    page+=1
                
                
                
            if batch:
                yield batch
            return




class TallyClient:

    def __init__(self, token_metadata,credentials,Integration_id):
        self.token_metadata = token_metadata
        self.credentials = credentials
        self.access_token = self.credentials['api_token']
        self.Integration_id = Integration_id
        self.site_url = self.credentials['site_url']
        self.cfg = TALLY_CONGIG

    def headers(self):
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
        }

    def get_new_token(self):
        pass

    def fetch_page(self, endpoint: str, params):
        check_flag = False
        if params == {}:
            check_flag=True

            r = requests.get(
                f"{self.site_url}{endpoint}",
                headers=self.headers()
            )
        else:
            r = requests.get(
                f"{self.site_url}{endpoint}",
                headers=self.headers(),
                params=params
            )

        if r.status_code == 200:
            key = TALLY_KEYS.get(endpoint,None)
            response = r.json()
            if check_flag and endpoint!='users/me':
                if response !=[]:
                    if key:
                        response = response[key]
                if isinstance(response,dict):
                    return [response]  
            else:
                return  response


        else:
            return []



    def stream_batches(self, endpoint: str, batch_size: int = 10000):
        cfg = self.cfg[endpoint]
        batch = []
        if cfg["type"] == "page":
            page = 1

            while True:
                params = {
                    cfg["page_size_param"]: cfg["page_size"],
                }

                if page:
                    params[cfg["page_param"]] = page

                response = self.fetch_page(endpoint, params)

                if not response or not response[cfg['cursor_field']]:
                    break
                page +=1
                key = TALLY_KEYS.get(endpoint,self.cfg['result_key'])
                if key is None:
                    key = endpoint
                records = response.get(key,endpoint)
       
                batch.extend(records)   


                if len(batch) >= batch_size:
                    yield batch
                    batch = []
            if batch:
                yield batch
            return
        elif cfg["type"] =="None":
            params = {}
            response = self.fetch_page(endpoint, params)
            
            # key = TALLY_KEYS.get(endpoint,cfg['result_key'])
            # if key is None:
            #     key = endpoint
            # records = response.get(key,endpoint)
    
            batch.append(response)

            if len(batch) >= batch_size:
                yield batch
                batch = []
        if batch:
            yield batch

class GoogleSheetClient:

    def __init__(self, token_metadata,credentials,Integration_id):
        self.token_metadata = token_metadata
        self.access_token = self.token_metadata['access_token']
        self.credentials = credentials
        self.Integration_id = Integration_id
        self.TOKEN_URL = "https://oauth2.googleapis.com/token"
        self.refresh_token = self.token_metadata['refresh_token']
    def get_new_token(self):
        import ast
        from django.conf import settings
        
        data = {
            'grant_type': 'refresh_token',
            'client_id' : settings.Integration_Credentials['GOOGLESHEETS']['CLIENT_ID'],
            'client_secret' : settings.Integration_Credentials['GOOGLESHEETS']['CLIENT_SECRET'],
            "refresh_token" :self.token_metadata['refresh_token']
        }
        
        response = requests.post(self.TOKEN_URL, json=data)
        if response.status_code == 200:
            result = response.json()
            self.token_metadata = result
            Integrations.objects.filter(id=self.Integration_id).update(
                token_metadata = encrypt_json(self.token_metadata),
            )
            self.access_token = result.get('access_token')
            return self.access_token
        else:
            raise 'Invalid Credentials Error'
            # return {'status':400,'message':'Invali Data'}

    def fetch_page(self, endpoint: str, params={}):
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
        from django.conf import settings
        from decouple import config
        try:
            creds = Credentials(
                token=self.access_token,
                refresh_token=self.refresh_token,
                token_uri=config('GOOGLESHEET_REDIRECT_URI'),
                client_id=settings.Integration_Credentials['GOOGLESHEETS']['CLIENT_ID'],
                client_secret=settings.Integration_Credentials['GOOGLESHEETS']['CLIENT_SECRET']
            )
        except Exception as e:
            self.get_new_token()
            return self.fetch_page(endpoint,params)
        sheets_service = build("sheets", "v4", credentials=creds)
        try:
            spreadsheet_metadata = sheets_service.spreadsheets().get(spreadsheetId=endpoint).execute()
        except Exception as e:
            self.get_new_token()
            return self.fetch_page(endpoint,params)
        sheets = spreadsheet_metadata.get("sheets", [])
        spreadsheet_title = spreadsheet_metadata.get("properties", {}).get("title", "") or endpoint
        sheet = sheets[0]
        sheet_name = sheet["properties"]["title"]
        max_rows = sheet['properties'].get('gridProperties', {}).get('rowCount', 0)
        max_cols = sheet['properties'].get('gridProperties', {}).get('columnCount', 0)
        result = sheets_service.spreadsheets().values().get(
            spreadsheetId=endpoint,
            range=f"{sheet_name}!1:{max_rows}"
        ).execute()
        values = result.get("values", [])
        non_empty_rows = [row for row in values if any(row)]
        if isinstance(non_empty_rows,dict):
            return [non_empty_rows]
        else:
            return non_empty_rows

    
class HalopsaClient:
    PAGE_SIZE = 1000
    SCOPES = 'all'

    def __init__(self, token_metadata,credentials,Integration_id):
        self.token_metadata = token_metadata
        self.access_token = self.token_metadata['access_token']
        self.credentials = credentials
        self.Integration_id = Integration_id
        self.site_url = self.credentials['site_url']

    def headers(self):
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
        }

    def get_new_token(self):
        import ast

        url = "{}/auth/token".format(self.site_url)
        headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            'grant_type': 'client_credentials',
            'client_id': self.credentials['client_id'],
            'client_secret': self.credentials['client_secret'],
            'scope':self.SCOPES
        }
        
        response = requests.post(url, headers=headers,data=data,timeout=30)
        if response.status_code == 200:
            result = response.json()
            self.token_metadata = result
            Integrations.objects.filter(id=self.Integration_id).update(
                token_metadata = encrypt_json(self.token_metadata),
            )
            self.access_token = result.get('access_token')
            return self.access_token
        else:
            raise 'Invalid Credentials Error'
            # return {'status':400,'message':'Invali Data'}


    def fetch_page(self, endpoint: str, params):
        r = requests.get(
            f"{self.site_url}/api/{endpoint}",
            headers=self.headers(),
            params = params,
            timeout=30,
        )
        if r.status_code ==401:
            self.get_new_token()
            return self.fetch_page(endpoint,params)

        elif r.status_code == 200:
            key = Halopsa_keys.get(endpoint,None)
            response = r.json()
            if response !=[]:
                if key:
                    response = response[key]
            return response
        else:
            return []



    def stream_batches(self, endpoint: str, batch_size: int = 10000):
        cfg = HALOPSA_CONFIG[endpoint]
        batch = []
       
        if cfg["type"] == "page":
            page = 1

            while True:
                params = {
                    cfg["page_size_param"]: cfg["page_size"],
                    "pageinate":True
                }

                if page:
                    params[cfg["page_param"]] = page

                response = self.fetch_page(endpoint, params)

                if not response or response==[]:
                    break
                page +=1
       
                batch.extend(response)


                if len(batch) >= batch_size:
                    yield batch
                    batch = []
            if batch:
                yield batch
            return
        elif cfg["type"] =="None":
            response = self.fetch_page(endpoint, {})

            batch.extend(response)
            if len(batch) >= batch_size:
                yield batch
                batch = []

            if batch:
                yield batch
            return



class Normalizer:
    def __init__(self, root_table: str, pk_field: str = "id"):
        self.root_table = root_table
        self.pk_field = pk_field

    def normalize(self, records):
        tables = defaultdict(list)
        relations = set()

        for record in records:
            if isinstance(record,str):
                root_id = str(uuid4())
            else:
                root_id = record.get(self.pk_field) or str(uuid4())
            self._walk(
                obj=record,
                table=self.root_table,
                pk_value=root_id,
                parent=None,
                tables=tables,
                relations=relations,
            )

        return tables, relations

    def _walk(self, obj, table, pk_value, parent, tables, relations):
        row = {self.pk_field: pk_value}
        import re
        table = re.sub(r'[^a-zA-Z0-9_]+', '_', table)

        if parent:
            parent_table, parent_pk = parent
            parent_table=re.sub(r'[^a-zA-Z0-9_]+', '_', parent_table)
            fk_field = f"{parent_table}_id"
            row[fk_field] = parent_pk
            
            relation = (
                parent_table.replace("-", "_"),
                table.replace("-", "_"),
                self.pk_field.replace("-", "_"),
                fk_field.replace("-", "_"),
            )
            if relation not in relations:
                relations.add(relation)

        for k, v in obj.items():
            if isinstance(v, dict):
                child_pk = str(uuid4())
                child_table = f"{table}__{k}"

                self._walk(
                    v,
                    child_table,
                    child_pk,
                    parent=(table, pk_value),
                    tables=tables,
                    relations=relations,
                )

            elif isinstance(v, list):
                child_table = f"{table}__{k}"
                child_pk = str(uuid4)

                for item in v:
                    # if not isinstance(item, dict):
                    #     continue
                    if isinstance(item,dict):

                        child_pk = str(uuid4())
                        self._walk(
                            item,
                            child_table,
                            child_pk,
                            parent=(table, pk_value),
                            tables=tables,
                            relations=relations,
                        )
                    else:
                        child_row = {
                            self.pk_field: child_pk,
                            f"{table}_id": pk_value,
                            "value": item,
                        }

                        relations.add((
                            table.replace("-", "_"),
                            child_table.replace("-", "_"),
                            self.pk_field.replace("-", "_"),
                            f"{table}_id".replace("-", "_"),
                        ))

                        tables[child_table].append(child_row)

            else:
                row[k] = v

        tables[table].append(row)


import base64

class GoogleAnalyticClient:

    def __init__(self, token_metadata,credentials,Integration_id):
        self.token_metadata = token_metadata
        self.credentials = credentials
        self.Integration_id = Integration_id

    def get_service_info(self):
        return {
            "type": self.credentials['type'],
            "project_id": self.credentials["project_id"],
            "private_key_id": self.credentials["private_key_id"],
            "private_key": self.credentials["private_key"].replace('\\n', '\n'),
            "client_email": self.credentials["client_email"],
            "client_id": self.credentials["client_id"],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": self.credentials["client_x509_cert_url"]
        }
    
    def fetch_page(self,endpoint=None,parmas={}):
        from google.analytics.data_v1beta.types import RunReportRequest, DateRange, Dimension, Metric
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        from google.oauth2 import service_account
        try:
            credentials = service_account.Credentials.from_service_account_info(self.get_service_info())
        except:
            return []
        client = BetaAnalyticsDataClient(credentials=credentials)
        property_id = self.credentials["property_id"]
        dimensions = self.credentials.get("dimensions") or ["date", "country", "deviceCategory"]
        metrics = self.credentials.get("metrics") or ["activeUsers", "newUsers"]
        request_data = RunReportRequest(
            property=f"properties/{property_id}",
            dimensions=[Dimension(name=d) for d in dimensions],
            metrics=[Metric(name=m) for m in metrics],
            date_ranges=[DateRange(start_date="2015-08-14", end_date="today")]
        )
        try:
            response = client.run_report(request_data)
        except Exception as e:
            return False
        result = []
        for row in response.rows:
            row_data = {}
            for i, dimension in enumerate(response.dimension_headers):
                row_data[dimension.name] = row.dimension_values[i].value
            for i, metric in enumerate(response.metric_headers):
                row_data[metric.name] = int(row.metric_values[i].value)
            result.append(row_data)
        return result

    def stream_batches(self, endpoint: str, batch_size: int = 10000):
        
        yield self.fetch_page(endpoint,batch_size)


class ShopifyClient:

    def __init__(self, token_metadata,credentials,Integration_id):
        self.token_metadata = token_metadata
        self.credentials = credentials
        self.access_token = self.credentials['api_token']
        self.api_version = "2024-01"
        self.Integration_id = Integration_id
        self.site_url = self.credentials['site_url']

        self.cfg = BAMBOOHR_CONFIG

    def headers(self):
        return {
            "X-Shopify-Access-Token": f"{self.access_token}",
            "Accept": "application/json",
        }

    def get_new_token(self):
        pass

    def fetch_page(self, endpoint: str, params):
        check_flag = False
        if params == {}:
            check_flag=True
            params = {
                "status":'any',
                "limit":250
            }
        limit = 50
        if endpoint=='products':
            next_page_url = f"{self.site_url}/admin/api/{self.api_version}/{endpoint}.json"
        else:
            next_page_url = f"{self.site_url}/admin/api/{self.api_version}/{endpoint}.json"
        r = requests.get(
            next_page_url,
            headers=self.headers(),
            params=params
        )
        if r.status_code == 200:
            response = r.json()

            if check_flag:
                records = response[endpoint]
                if isinstance(records,dict):
                    return [records]
                return records  
            else:
                return r
        elif r.status_code!=200:
            raise PermissionError

        else:
            return []



    def stream_batches(self, endpoint: str, batch_size: int = 10000):
        batch = []
       
        page_info = None
        while True:
            params = {
            "status":'any',
            "limit":250
            }
            if page_info:
                params = {
                    "page_info":page_info,
                    "limit":250
                }


            response = self.fetch_page(endpoint, params)
            if response ==[]:
                break
            response_data = response.json()
            link = response.headers.get('link',None)
            if link:
                from urllib.parse import urlparse, parse_qs

                data =  response.headers.get('link').split(',')
                if len(data)<=2:
                    url = data[0].split(';')[0]
                else:
                    url = data[1].split(';')[0]
                parsed_url = urlparse(url)
                params = parse_qs(parsed_url.query)
                page_info = params.get('page_info')[0].strip('>')
                

            else:
                break

            data = response_data[endpoint]
            
            # for record in data:
            batch.extend(data)

            if len(batch) >= batch_size:
                yield batch
                batch = []
        if batch:
            yield batch
        return


class BambooHrClient:

    def __init__(self, token_metadata,credentials,Integration_id):
        self.token_metadata = token_metadata
        self.credentials = credentials
        self.token = self.credentials['api_token']
        self.access_token = base64.b64encode(f'{self.token}:x'.encode()).decode()
        self.Integration_id = Integration_id
        self.domain = self.credentials['domain']
        self.site_url = self.credentials['site_url']+'/'+self.domain 

        self.cfg = BAMBOOHR_CONFIG

    def headers(self):
        return {
            "Authorization": f"Basic {self.access_token}",
            "Accept": "application/json",
        }

    def get_new_token(self):
        pass

    def fetch_page(self, endpoint: str, params):
        check_flag = False
        if params == {}:
            check_flag=True
            params = {
                'page': 1,
            'pageSize': 100
            }
        r = requests.get(
            f"{self.site_url}/v1/{endpoint}",
            headers=self.headers(),
            params = params        )
        if r.status_code == 200:
            response = r.json()
            
            if check_flag:
                key = BAMBOOHR_KEYS.get(endpoint,None)

                if response !=[]:
                    if key:
                        response = response[key]
                    if isinstance(response,dict):
                        return [response]  
            return response
        

        else:
            return []



    def stream_batches(self, endpoint: str, batch_size: int = 10000):
        cfg = self.cfg[endpoint]
        batch = []
       
        if cfg["type"] == "page":
            page = 1

            while True:
                params = {
                    cfg["page_size_param"]: cfg["page_size"],
                }

                if page:
                    params[cfg["page_param"]] = page

                response = self.fetch_page(endpoint, params)

                if not response :
                    break
                page +=1
                key = BAMBOOHR_KEYS.get(endpoint,None)
                if key :
                    records = response.get(key)
                else:
                    records = response
       
                batch.extend(records)


                if len(batch) >= batch_size:
                    yield batch
                    batch = []
                if response.get('pagination',None):
                    if  response.get('pagination')['total_pages'] == response.get('pagination')['current_page']+1:
                        break
                    else:
                        page+=1
                else:
                    break

            if batch:
                yield batch
            return




class DbtClient:

    def __init__(self, token_metadata,credentials,Integration_id):
        self.token_metadata = token_metadata
        self.credentials = credentials
        self.access_token = self.credentials['api_token']
        self.Integration_id = Integration_id
        self.site_url = self.credentials['site_url']
        self.account_id = self.credentials['account_id']
        self.cfg = DBT_CONFIG

    def headers(self):
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
        }

    def get_new_token(self):
        pass

    def fetch_page(self, endpoint: str, params):
        check_flag = False
        if params == {}:
            check_flag=True
            params = {
                'limit':100,
                'offset':0
            }
        if endpoint=='accounts':
            base_url = f"{self.site_url.rstrip('/')}/api/v2/accounts/"
        else:
            base_url = f"{self.site_url.rstrip('/')}/api/v2/accounts/{self.account_id}/{endpoint}"
        r = requests.get(
            base_url,
            headers=self.headers(),
            params = params,
            timeout=30,
        )
        if r.status_code == 200:
            response = r.json()
            if check_flag:
                response = response.get('data')

                if isinstance(response,dict):
                    return [response]
            return response  
        

        else:
            return response



    def stream_batches(self, endpoint: str, batch_size: int = 10000):
        cfg = self.cfg[endpoint]
        batch = []
        limit=100
       
        if cfg["type"] == "page":
            page = 0

            while True:
                params = {
                    cfg["page_size_param"]: cfg["page_size"],
                }

                if page:
                    params[cfg["page_param"]] = page

                response = self.fetch_page(endpoint, params)

                if not response.get('data',True):
                    break
                
       
                batch.extend(response.get('data',[]))


                if len(batch) >= batch_size:
                    yield batch
                    batch = []
                pagination = response.get('extra').get('pagination')
                if pagination['total_count']<page:
                    break
                page +=limit

            if batch:
                yield batch
            return





import pandas as pd

def sanitize_dataframe_for_clickhouse(df: pd.DataFrame, ch_schema: dict) -> pd.DataFrame:
    for col, ch_type in ch_schema.items():
        # if col not in df.columns:
        #     continue

        if "Int" in ch_type:
            df[col] = pd.to_numeric(df[col], errors="coerce").astype("Int64")
        elif "Float" in ch_type:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        elif "DateTime" in ch_type:
            df[col] = pd.to_datetime(df[col], errors="coerce")
        elif "Date" in ch_type:
            df[col] = pd.to_datetime(df[col], errors="coerce").dt.date
        elif "Bool" in ch_type:
            df[col] = df[col].astype(bool)
        else:
            df[col] = df[col].astype(str)

        # Replace nulls with None for Nullable columns
        if ch_type.startswith("Nullable"):
            df[col] = df[col].where(df[col].notna(), None)

    return df




# clickhouse
import clickhouse_connect
from sqlalchemy import create_engine


import re

def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    df.columns = [
        re.sub(r"[^a-zA-Z0-9_]", "_", c)
        for c in df.columns
    ]

    return df

def cast_df_to_clickhouse_schema(df, ch_schema: dict):
    """
    ch_schema: {column: ClickHouseType}
    """
    for col, ch_type in ch_schema.items():
        if col not in df.columns:
            continue

        if "Int" in ch_type:
            df[col] = pd.to_numeric(df[col], errors="coerce").astype("Int64")

        elif "Float" in ch_type:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        elif "UInt" in ch_type:
            df[col] = pd.to_numeric(df[col], errors="coerce").astype("UInt64")

        elif "DateTime" in ch_type:
            df[col] = pd.to_datetime(df[col], errors="coerce")

        else:  # String
            df[col] = df[col].astype(str)

    df = df.where(pd.notnull(df), None)
    return df


class Clickhouse():

    def __init__(self,database='default'):
        clickhouse_host = 'ue8f0rm0nd.ap-south-1.aws.clickhouse.cloud'
        clickhouse_port = 8443
        clickhouse_username = 'default'
        clickhouse_password = 'FWE5Swo.brb4H'
        clickhouse_database = 'default'
        # self.clickhouse_url = f'clickhouse+http://{clickhouse_username}:{clickhouse_password}@{clickhouse_host}:{clickhouse_port}/{clickhouse_database}?protocol=https'
        # self.engine = create_engine(self.clickhouse_url)
        # self.cursor = self.engine.connect()
        self.client = clickhouse_connect.get_client(host = clickhouse_host,port=clickhouse_port,username = clickhouse_username,password = clickhouse_password,database=clickhouse_database,
        settings={'date_time_input_format':'best_effort','input_format_null_as_default': 1,'async_insert': 1,
             'wait_for_async_insert':1,'input_format_try_infer_dates': 1,
            'input_format_try_infer_datetimes': 1,
             'input_format_try_infer_datetimes_only_datetime64':1,
             'input_format_csv_use_best_effort_in_schema_inference': 1,
            'enable_extended_results_for_datetime_functions': 1,
            'receive_timeout': 600,  # in seconds
            'http_receive_timeout': 60,  # in seconds
            'receive_data_timeout_ms': 3000,  # in milliseconds
            'async_insert_busy_timeout_ms': 2000,
             'insert_null_as_default':1 ,


             'max_columns_to_read': 10000,
            'max_insert_block_size': 100000,
            'max_query_size': 10000000})
        
    def ensure_table(self, database, table, schema):
        cols = ",\n".join(f"""`{re.sub(r"[^a-zA-Z0-9_]", "_", c)}` {t} """ for c, t in schema.items())

        query = f"""
        CREATE TABLE IF NOT EXISTS `{database}`.`{table}` (
            {cols}
        )
        ENGINE = MergeTree
        ORDER BY tuple()
        """
        self.client.command(query)


    def evolve_schema(self, database, table, new_columns):
        for col, dtype in new_columns.items():
            col = re.sub(r"[^a-zA-Z0-9_]", "_", col)
            self.client.command(
                f"""
                ALTER TABLE `{database}`.`{table}`
                ADD COLUMN IF NOT EXISTS `{col}` {dtype}
                """
        )


    def copy_insert(self,table: str,database, dataframe,schema_cache=None):
        # dataframe = pd.DataFrame(dataframe)
        # import numpy as np
        # for col in dataframe.columns:
        #     if dataframe[col].dtype == 'float64':
        #         dataframe[col] = dataframe[col].astype(float)
        #     elif dataframe[col].dtype == 'int64':
        #         dataframe[col] = dataframe[col].astype(int)
        #     elif pd.api.types.is_object_dtype(dataframe[col]):
        #         dataframe[col] = dataframe[col].astype(str)
        #     elif dataframe[col].dtype =='datetime64[ns]':
        #         default_timestamp = pd.Timestamp("1970-01-01 00:00:00") 
        #         dataframe[col] = dataframe[col].fillna(default_timestamp)

        # try:
        #     dataframe = dataframe.replace([np.nan,pd.NaT ,np.inf, -np.inf,pd.NA], None)
        #     print(database,table,dataframe.columns)
        #     self.client.insert_df(table, dataframe,database)
        # except Exception as e:
        #     raise f"error{e}"
            df = pd.DataFrame(dataframe)

    # Column normalization only
            # df.columns = [normalize_columns(c) for c in df.columns]
            df = normalize_columns(df)
            df = cast_df_to_clickhouse_schema(
                df,
                schema_cache[table]   # cached CH schema
            )

            # Replace NaN / NaT safely
            df = df.where(pd.notnull(df), None)
            import numpy as np
            df = df.applymap(
                lambda x: str(x) if isinstance(x, (bool, np.bool_)) else x
            )
                        
            self.client.insert_df(
                database=database,
                table=table,
                df=df
            )

    def Create_database(self,database_name):
        self.client.query(f'Create Database "{database_name}"')
        # self.client.commit()


    def drop_database(self,database_name):
        self.client.query(f'Drop DAtabase if Exists "{database_name}" ')
        # self.client.commit() 


    def create_tables(self, database,tables: Dict[str, List[dict]]):
        for table, rows in tables.items():
            dataframe = pd.DataFrame(rows)
            dataframe = normalize_columns(dataframe)
            dataframe = convert_percentage_columns(dataframe)
        # Convert to numeric columns by removing commas (,)
            dataframe = convert_numeric_columns(dataframe)

            dataframe = convert_datetime_columns(dataframe)

            schema = map_dtypes_to_clickhouse(dataframe)
            table = re.sub(r"[^a-zA-Z0-9_]", "_", table)
            create_table_query = f"""
            CREATE or Replace Table "{database}".{table} (

                {schema}
            ) ENGINE = MergeTree()
            ORDER BY tuple()
                """
            self.client.query(create_table_query)
            self.copy_insert(table,database,dataframe)
 


# ============================================================
# ENTRY POINT
# ============================================================



        

# if __name__ == "__main__":
#     run_ingestion()






