import requests
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from .base import BaseConnector


class HubSpotConnector(BaseConnector):
    """HubSpot API connector"""
    
    BASE_URL = "https://api.hubapi.com"
    MAX_PAGE_SIZE = 100
    
    # Standard HubSpot objects
    STANDARD_OBJECTS = [
        'contacts', 'companies', 'deals', 'tickets', 'products',
        'line_items', 'quotes', 'calls', 'emails', 'meetings',
        'notes', 'tasks'
    ]
    
    def __init__(self, sync_connector):
        super().__init__(sync_connector)
        self.access_token = sync_connector.access_token
        self.refresh_token = sync_connector.refresh_token
    
    def _get_headers(self):
        """Get API request headers"""
        return {
            'Authorization': f'Bearer {self.access_token}',
            'Content-Type': 'application/json'
        }
    
    def test_connection(self) -> Dict[str, Any]:
        """Test HubSpot API connection"""
        try:
            response = requests.get(
                f"{self.BASE_URL}/crm/v3/objects/contacts",
                headers=self._get_headers(),
                params={'limit': 1},
                timeout=10
            )
            
            if response.status_code == 200:
                return {
                    'success': True,
                    'message': 'Connection successful'
                }
            elif response.status_code == 401:
                return {
                    'success': False,
                    'message': 'Authentication failed. Please refresh your access token.'
                }
            else:
                return {
                    'success': False,
                    'message': f'Connection failed with status {response.status_code}'
                }
        except Exception as e:
            return {
                'success': False,
                'message': f'Connection error: {str(e)}'
            }
    
    def discover_schema(self) -> List[Dict[str, Any]]:
        """Discover available HubSpot objects"""
        tables = []
        
        # Add standard objects
        for obj_type in self.STANDARD_OBJECTS:
            try:
                # Get object properties
                props_response = requests.get(
                    f"{self.BASE_URL}/crm/v3/properties/{obj_type}",
                    headers=self._get_headers(),
                    timeout=10
                )
                
                if props_response.status_code == 200:
                    properties = props_response.json().get('results', [])
                    
                    # Get row count
                    count_response = requests.get(
                        f"{self.BASE_URL}/crm/v3/objects/{obj_type}",
                        headers=self._get_headers(),
                        params={'limit': 1},
                        timeout=10
                    )
                    
                    row_count = 0
                    if count_response.status_code == 200:
                        row_count = count_response.json().get('total', 0)
                    
                    # Map properties to columns
                    columns = []
                    for prop in properties:
                        columns.append({
                            'name': prop.get('name'),
                            'label': prop.get('label'),
                            'type': self._map_hubspot_type(prop.get('type')),
                            'description': prop.get('description', '')
                        })
                    
                    tables.append({
                        'name': obj_type,
                        'label': obj_type.replace('_', ' ').title(),
                        'row_count': row_count,
                        'columns': columns,
                        'supports_incremental': True,
                        'cursor_field': 'hs_lastmodifieddate',
                        'primary_key': 'id'
                    })
            except Exception as e:
                print(f"Error discovering {obj_type}: {str(e)}")
                continue
        
        # TODO: Discover custom objects
        
        return tables
    
    def fetch_data(self, table_name: str, cursor_value: Optional[str] = None,
                   cursor_field: Optional[str] = None, limit: Optional[int] = 100) -> Dict[str, Any]:
        """Fetch data from HubSpot"""
        page_size = min(limit or self.MAX_PAGE_SIZE, self.MAX_PAGE_SIZE)
        
        # Get all properties for this object
        props_response = requests.get(
            f"{self.BASE_URL}/crm/v3/properties/{table_name}",
            headers=self._get_headers()
        )
        
        properties = []
        if props_response.status_code == 200:
            properties = [p['name'] for p in props_response.json().get('results', [])]
        
        # Build request params
        params = {
            'limit': page_size,
            'properties': ','.join(properties[:50])  # HubSpot has a limit on properties
        }
        
        # Add filter for incremental sync
        if cursor_value and cursor_field:
            # HubSpot uses search API for filtering
            search_url = f"{self.BASE_URL}/crm/v3/objects/{table_name}/search"
            payload = {
                'filterGroups': [{
                    'filters': [{
                        'propertyName': cursor_field,
                        'operator': 'GT',
                        'value': cursor_value
                    }]
                }],
                'properties': properties[:50],
                'limit': page_size
            }
            
            response = requests.post(
                search_url,
                headers=self._get_headers(),
                json=payload
            )
        else:
            # Full fetch
            response = requests.get(
                f"{self.BASE_URL}/crm/v3/objects/{table_name}",
                headers=self._get_headers(),
                params=params
            )
        
        if response.status_code != 200:
            raise Exception(f"HubSpot API error: {response.status_code} - {response.text}")
        
        data = response.json()
        results = data.get('results', [])
        
        # Transform data
        records = []
        for result in results:
            record = {
                'id': result.get('id'),
                **result.get('properties', {})
            }
            records.append(record)
        
        # Get next cursor
        paging = data.get('paging', {})
        next_cursor = paging.get('next', {}).get('after')
        
        return {
            'data': records,
            'next_cursor': next_cursor,
            'has_more': next_cursor is not None,
            'count': len(records)
        }
    
    def write_data(self, table_name: str, data: List[Dict[str, Any]],
                   primary_key: str, mode: str = 'upsert') -> Dict[str, Any]:
        """HubSpot is a source-only connector"""
        raise NotImplementedError("HubSpot connector is source-only")
    
    def refresh_access_token(self) -> Dict[str, Any]:
        """Refresh OAuth access token"""
        if not self.refresh_token:
            return {
                'success': False,
                'message': 'No refresh token available'
            }
        
        try:
            response = requests.post(
                'https://api.hubapi.com/oauth/v1/token',
                data={
                    'grant_type': 'refresh_token',
                    'client_id': self.config.get('client_id'),
                    'client_secret': self.config.get('client_secret'),
                    'refresh_token': self.refresh_token
                }
            )
            
            if response.status_code == 200:
                token_data = response.json()
                expires_in = token_data.get('expires_in', 3600)
                
                return {
                    'success': True,
                    'access_token': token_data['access_token'],
                    'refresh_token': token_data.get('refresh_token', self.refresh_token),
                    'expires_at': datetime.utcnow() + timedelta(seconds=expires_in)
                }
            else:
                return {
                    'success': False,
                    'message': f'Token refresh failed: {response.text}'
                }
        except Exception as e:
            return {
                'success': False,
                'message': f'Token refresh error: {str(e)}'
            }
    
    def _map_hubspot_type(self, hubspot_type: str) -> str:
        """Map HubSpot property type to SQL type"""
        type_mapping = {
            'string': 'VARCHAR(255)',
            'number': 'NUMERIC',
            'date': 'DATE',
            'datetime': 'TIMESTAMP',
            'bool': 'BOOLEAN',
            'enumeration': 'VARCHAR(100)',
            'phone_number': 'VARCHAR(50)',
            'email': 'VARCHAR(255)'
        }
        return type_mapping.get(hubspot_type, 'TEXT')
