from Connections import models as conn_models
from Service.utils import decode_value, decrypt_json
from .models import SyncConnector


SUPPORTED_SOURCES = {
    'POSTGRESQL': 'postgresql',
    'MYSQL': 'mysql',
    'ORACLE': 'oracle',
    'SNOWFLAKE': 'snowflake',
    'MICROSOFTSQLSERVER': 'mssql',
    'HUBSPOT': 'hubspot',
    'SALESFORCE': 'salesforce',
    'SHOPIFY': 'shopify',
    'QUICKBOOKS': 'quickbooks',
    'JIRA': 'jira',
    'PAX8': 'pax8',
    'BAMBOOHR': 'bamboohr',
    'ZOHO_CRM': 'zoho_crm',
    'ZOHO_BOOKS': 'zoho_books',
    'ZOHO_INVENTORY': 'zoho_inventory',
    'TALLY': 'tally',
    'DBT': 'dbt',
}

SUPPORTED_DESTINATIONS = {
    'POSTGRESQL': 'postgresql',
    'MYSQL': 'mysql',
}


def get_accessible_user_ids(user):
    accessible_user_ids = [user.id]
    if hasattr(user, 'created_by') and user.created_by:
        accessible_user_ids.append(user.created_by.id)
    return accessible_user_ids


def list_available_connections(user, role):
    accessible_user_ids = get_accessible_user_ids(user)
    supported_types = SUPPORTED_SOURCES if role == 'source' else SUPPORTED_DESTINATIONS

    connections = (
        conn_models.Connections.objects
        .filter(user_id__in=accessible_user_ids, type__name__in=supported_types.keys())
        .select_related('type')
        .order_by('type__name', 'id')
    )

    results = []
    for connection in connections:
        item = build_connection_summary(connection, role, accessible_user_ids)
        if item:
            results.append(item)

    return results


def build_connection_summary(connection, role, accessible_user_ids):
    source_type = connection.type.name.upper()
    supported_types = SUPPORTED_SOURCES if role == 'source' else SUPPORTED_DESTINATIONS
    connector_type = supported_types.get(source_type)
    if not connector_type:
        return None

    if connection.type.type == 'DATABASE':
        details = conn_models.DatabaseConnections.objects.filter(
            id=connection.table_id,
            user_id__in=accessible_user_ids,
            is_connected=True
        ).first()
        if not details:
            return None
        return {
            'hierarchy_id': str(connection.id),
            'name': details.connection_name,
            'connector_type': connector_type,
            'connector_role': role,
            'source_type': source_type,
            'source_category': connection.type.type,
            'schema': details.schema,
            'database': details.database,
        }

    if connection.type.type == 'INTEGRATIONS':
        details = conn_models.Integrations.objects.filter(id=connection.table_id, is_active=True).first()
        if not details:
            return None
        return {
            'hierarchy_id': str(connection.id),
            'name': details.connection_name,
            'connector_type': connector_type,
            'connector_role': role,
            'source_type': source_type,
            'source_category': connection.type.type,
            'schema': None,
            'database': details.site_url,
        }

    return None


def import_connection_as_sync_connector(user, hierarchy_id, connector_role):
    accessible_user_ids = get_accessible_user_ids(user)
    connection = (
        conn_models.Connections.objects
        .select_related('type')
        .filter(id=hierarchy_id, user_id__in=accessible_user_ids)
        .first()
    )

    if not connection:
        raise ValueError('EasyConnect connection not found.')

    source_type = connection.type.name.upper()
    supported_types = SUPPORTED_SOURCES if connector_role == 'source' else SUPPORTED_DESTINATIONS
    connector_type = supported_types.get(source_type)
    if not connector_type:
        raise ValueError(f'{source_type} is not supported as a {connector_role} sync connector.')

    payload = None
    access_token = None
    refresh_token = None

    if connection.type.type == 'DATABASE':
        details = conn_models.DatabaseConnections.objects.filter(
            id=connection.table_id,
            user_id__in=accessible_user_ids,
            is_connected=True
        ).first()
        if not details:
            raise ValueError('Database connection details not found.')

        payload = {
            'host': details.hostname,
            'port': details.port,
            'database': details.database,
            'username': details.username,
            'password': decode_value(details.password) if details.password else '',
            'schema': details.schema or 'public',
            'service_name': details.service_name,
            'database_path': details.database_path,
        }
        if connector_type == 'oracle':
            payload['schema'] = details.schema or (details.username.upper() if details.username else None)
        elif connector_type == 'snowflake':
            payload['schema'] = details.schema
        elif connector_type == 'mssql':
            payload['driver'] = 'ODBC Driver 18 for SQL Server'
        connector_name = details.connection_name

    elif connection.type.type == 'INTEGRATIONS':
        details = conn_models.Integrations.objects.filter(id=connection.table_id, is_active=True).first()
        if not details:
            raise ValueError('Integration connection details not found.')

        credentials = decrypt_json(details.credentials or {})
        token_metadata = decrypt_json(details.token_metadata or {})
        connector_name = details.connection_name
        access_token = credentials.get('api_token') or token_metadata.get('access_token')
        refresh_token = token_metadata.get('refresh_token')
        payload = {
            'site_url': details.site_url,
            'credentials': credentials,
            'token_metadata': token_metadata,
            'integration_id': str(details.id),
        }
    else:
        raise ValueError('Unsupported EasyConnect connection category.')

    sync_connector, _ = SyncConnector.objects.update_or_create(
        user_id=user.id,
        name=connector_name,
        connector_role=connector_role,
        defaults={
            'connector_type': connector_type,
            'config': payload or {},
            'access_token': access_token,
            'refresh_token': refresh_token,
            'is_active': True,
        }
    )
    return sync_connector
