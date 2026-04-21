from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional


class BaseConnector(ABC):
    """Base class for all connectors"""




    def __init__(self, sync_connector):
        self.sync_connector = sync_connector
        self.config = sync_connector.config
        self.connector_type = sync_connector.connector_type
        self.connector_role = sync_connector.connector_role
        self.runtime_context = {}

    def set_runtime_context(self, **kwargs):
        """Attach per-run context used while reading or writing data."""
        self.runtime_context = kwargs
    
    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """
        Test the connection to the source/destination
        
        Returns:
            dict: {'success': bool, 'message': str}
        """
        pass
    
    @abstractmethod
    def discover_schema(self) -> List[Dict[str, Any]]:
        """
        Discover available tables/objects from source
        
        Returns:
            list: [{'name': str, 'row_count': int, 'columns': [...]}]
        """
        pass

    def list_tables(self) -> List[Dict[str, Any]]:
        """
        Return a lightweight list of tables/objects for fast UI loading.

        Falls back to full schema discovery when a connector does not provide
        a cheaper implementation.
        """
        discovery_result = self.discover_schema()
        if isinstance(discovery_result, dict):
            return discovery_result.get('tables', [])
        return discovery_result
    
    @abstractmethod
    def fetch_data(self, table_name: str, cursor_value: Optional[str] = None, 
                   cursor_field: Optional[str] = None, limit: Optional[int] = None) -> Dict[str, Any]:
        """
        Fetch data from source
        
        Args:
            table_name: Name of table/object to fetch
            cursor_value: Last synced value for incremental sync
            cursor_field: Field to use for incremental sync
            limit: Maximum number of records to fetch
        
        Returns:
            dict: {'data': [...], 'next_cursor': str, 'has_more': bool}
        """
        pass
    
    @abstractmethod
    def write_data(self, table_name: str, data: List[Dict[str, Any]], 
                   primary_key: str, mode: str = 'upsert') -> Dict[str, Any]:
        """
        Write data to destination
        
        Args:
            table_name: Destination table name
            data: List of records to write
            primary_key: Primary key field for upsert
            mode: 'insert', 'upsert', or 'replace'
        
        Returns:
            dict: {'inserted': int, 'updated': int, 'failed': int}
        """
        pass
    
    def get_table_schema(self, table_name: str) -> List[Dict[str, Any]]:
        """
        Get schema for a specific table
        
        Returns:
            list: [{'name': str, 'type': str, 'nullable': bool}]
        """
        raise NotImplementedError("get_table_schema not implemented")
    
    def create_table(self, table_name: str, schema: List[Dict[str, Any]]) -> bool:
        """
        Create table in destination with given schema
        
        Args:
            table_name: Table name to create
            schema: List of column definitions
        
        Returns:
            bool: Success status
        """
        raise NotImplementedError("create_table not implemented")
    
    def validate_config(self) -> Dict[str, Any]:
        """
        Validate connector configuration
        
        Returns:
            dict: {'valid': bool, 'errors': []}
        """
        errors = []
        
        # Override in subclasses to add specific validation
        
        return {
            'valid': len(errors) == 0,
            'errors': errors
        }
