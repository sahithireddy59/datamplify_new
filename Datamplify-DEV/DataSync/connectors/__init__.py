from .base import BaseConnector
from .hubspot import HubSpotConnector
from .postgresql import PostgreSQLConnector
from .mysql import MySQLConnector


def get_connector(sync_connector):
    """Factory function to get appropriate connector instance"""
    connector_map = {
        'hubspot': HubSpotConnector,
        'postgresql': PostgreSQLConnector,
        'mysql': MySQLConnector,
    }
    
    connector_class = connector_map.get(sync_connector.connector_type)
    if not connector_class:
        raise ValueError(f"Unsupported connector type: {sync_connector.connector_type}")
    
    return connector_class(sync_connector)


__all__ = ['BaseConnector', 'HubSpotConnector', 'PostgreSQLConnector', 'MySQLConnector', 'get_connector']
