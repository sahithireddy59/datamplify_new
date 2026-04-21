from .base import BaseConnector
from .integration_source import GenericIntegrationSourceConnector
from .postgresql import PostgreSQLConnector
from .mysql import MySQLConnector
from .sql_source import SQLSourceConnector


def get_connector(sync_connector):
    """Factory function to get appropriate connector instance"""
    connector_map = {
        'hubspot': GenericIntegrationSourceConnector,
        'salesforce': GenericIntegrationSourceConnector,
        'shopify': GenericIntegrationSourceConnector,
        'quickbooks': GenericIntegrationSourceConnector,
        'jira': GenericIntegrationSourceConnector,
        'pax8': GenericIntegrationSourceConnector,
        'bamboohr': GenericIntegrationSourceConnector,
        'zoho_crm': GenericIntegrationSourceConnector,
        'zoho_books': GenericIntegrationSourceConnector,
        'zoho_inventory': GenericIntegrationSourceConnector,
        'tally': GenericIntegrationSourceConnector,
        'dbt': GenericIntegrationSourceConnector,
        'oracle': SQLSourceConnector,
        'snowflake': SQLSourceConnector,
        'mssql': SQLSourceConnector,
        'postgresql': PostgreSQLConnector,
        'mysql': MySQLConnector,
    }
    
    connector_class = connector_map.get(sync_connector.connector_type)
    if not connector_class:
        raise ValueError(f"Unsupported connector type: {sync_connector.connector_type}")
    
    return connector_class(sync_connector)


__all__ = ['BaseConnector', 'GenericIntegrationSourceConnector', 'PostgreSQLConnector', 'MySQLConnector', 'SQLSourceConnector', 'get_connector']
