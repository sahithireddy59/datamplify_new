import json
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from integration_injection import (
    BambooHrClient,
    BAMBOOHR_CONFIG,
    DbtClient,
    DBT_CONFIG,
    HubspotClientToken,
    HUBSPOT_CONFIG,
    JiraClient,
    JIRA_CONFIG,
    Pax8Client,
    PAX8_CONFIG,
    QuickbooksClient,
    QUICKBOOKS_CONFIG,
    SalesforceClient,
    SALESFORCE_CONFIG,
    ShopifyClient,
    SHOPIFY_CONFIG,
    TallyClient,
    TALLY_CONGIG,
    ZohoClient,
    ZOHO_BOOKS_CONFIG,
    ZOHO_CRM_CONFIG,
    ZOHO_INVENTORY_CONFIG,
)

from .base import BaseConnector


class GenericIntegrationSourceConnector(BaseConnector):
    """Reusable source connector for EasyConnect-backed SaaS integrations."""

    CLIENT_REGISTRY = {
        'hubspot': (HubspotClientToken, HUBSPOT_CONFIG),
        'salesforce': (SalesforceClient, SALESFORCE_CONFIG),
        'shopify': (ShopifyClient, SHOPIFY_CONFIG),
        'quickbooks': (QuickbooksClient, QUICKBOOKS_CONFIG),
        'jira': (JiraClient, JIRA_CONFIG),
        'pax8': (Pax8Client, PAX8_CONFIG),
        'bamboohr': (BambooHrClient, BAMBOOHR_CONFIG),
        'zoho_crm': (ZohoClient, ZOHO_CRM_CONFIG),
        'zoho_books': (ZohoClient, ZOHO_BOOKS_CONFIG),
        'zoho_inventory': (ZohoClient, ZOHO_INVENTORY_CONFIG),
        'tally': (TallyClient, TALLY_CONGIG),
        'dbt': (DbtClient, DBT_CONFIG),
    }

    def __init__(self, sync_connector):
        super().__init__(sync_connector)
        self.client = None

    def _get_client_bundle(self):
        bundle = self.CLIENT_REGISTRY.get(self.connector_type)
        if not bundle:
            raise ValueError(f'Unsupported integration connector type: {self.connector_type}')
        return bundle

    def _get_client(self):
        if self.client is None:
            client_class, _ = self._get_client_bundle()
            self.client = client_class(
                self.config.get('token_metadata', {}) or {},
                self.config.get('credentials', {}) or {},
                self.config.get('integration_id'),
            )
        return self.client

    def _get_endpoints(self) -> List[str]:
        _, config_map = self._get_client_bundle()
        return list(config_map.keys())

    def _resolve_endpoint_name(self, table_name: str) -> str:
        endpoints = self._get_endpoints()
        if table_name in endpoints:
            return table_name

        normalized_name = self._normalize_endpoint_name(table_name)
        exact_matches = [
            endpoint for endpoint in endpoints
            if self._normalize_endpoint_name(endpoint) == normalized_name
        ]
        if exact_matches:
            return exact_matches[0]

        preferred_prefixes = [
            f'crm/v3/objects/{table_name}',
            f'crm/v3/objects/{table_name.replace("_", "-")}',
            f'crm/v3/schemas/{table_name}',
            f'crm/v3/schemas/{table_name.replace("_", "-")}',
        ]
        for candidate in preferred_prefixes:
            if candidate in endpoints:
                return candidate

        raise KeyError(table_name)

    def test_connection(self) -> Dict[str, Any]:
        try:
            client = self._get_client()
            endpoint = self._get_endpoints()[0]
            next(client.stream_batches(endpoint, batch_size=1), [])
            return {'success': True, 'message': 'Connection successful'}
        except StopIteration:
            return {'success': True, 'message': 'Connection successful'}
        except Exception as exc:
            return {'success': False, 'message': f'Connection failed: {str(exc)}'}

    def discover_schema(self) -> List[Dict[str, Any]]:
        client = self._get_client()
        tables = []
        skipped_endpoints = []

        for endpoint in self._get_endpoints():
            sample_batch = []
            discovery_error = None
            if self._should_skip_schema_sampling(endpoint):
                discovery_error = self._get_sampling_skip_reason(endpoint)
                skipped_endpoints.append({
                    'name': endpoint,
                    'reason': discovery_error,
                })
            else:
                try:
                    sample_batch = next(client.stream_batches(endpoint, batch_size=1), [])
                except Exception as exc:
                    discovery_error = self._format_discovery_error(exc)
                    skipped_endpoints.append({
                        'name': endpoint,
                        'reason': discovery_error,
                    })

            rows = self._normalize_batch(sample_batch)
            sample_row = rows[0] if rows else {}
            columns = [
                {
                    'name': key,
                    'type': self._infer_column_type(value),
                    'nullable': True,
                }
                for key, value in sample_row.items()
            ]
            primary_key = self._infer_primary_key(columns)
            cursor_field = self._infer_cursor_field(columns, primary_key)
            supports_history = bool(primary_key)

            if self.connector_type == 'hubspot':
                primary_key = self._resolve_hubspot_primary_key(columns, primary_key)
                cursor_field = self._resolve_hubspot_cursor_field(columns, primary_key)
                supports_history = self._supports_hubspot_history(endpoint, columns, primary_key)

            tables.append({
                'name': endpoint,
                'label': self._build_table_label(endpoint),
                'destination_name': self._build_destination_name(endpoint),
                'row_count': None,
                'columns': columns,
                'supports_incremental': cursor_field is not None,
                'supports_history': supports_history,
                'primary_key': primary_key,
                'cursor_field': cursor_field,
                'discovery_status': 'partial' if discovery_error else 'ready',
                'discovery_error': discovery_error,
            })

        return {
            'tables': tables,
            'skipped_endpoints': skipped_endpoints,
        }

    def list_tables(self) -> List[Dict[str, Any]]:
        tables = []
        for endpoint in self._get_endpoints():
            tables.append({
                'name': endpoint,
                'label': self._build_table_label(endpoint),
                'destination_name': self._build_destination_name(endpoint),
                'row_count': None,
                'columns': [],
                'supports_incremental': False,
                'supports_history': False,
                'primary_key': None,
                'cursor_field': None,
                'discovery_status': 'pending',
                'discovery_error': None,
            })
        return tables

    def fetch_data(
        self,
        table_name: str,
        cursor_value: Optional[str] = None,
        cursor_field: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> Dict[str, Any]:
        client = self._get_client()
        endpoint = self._resolve_endpoint_name(table_name)
        collected_rows: List[Dict[str, Any]] = []

        try:
            for batch in client.stream_batches(endpoint, batch_size=max(limit or 1000, 1000)):
                collected_rows.extend(self._normalize_batch(batch))
        except Exception as exc:
            raise PermissionError(self._format_runtime_error(exc)) from exc

        if cursor_value and cursor_field:
            collected_rows = [
                row for row in collected_rows
                if self._is_newer(row.get(cursor_field), cursor_value)
            ]

        next_cursor = None
        if collected_rows and cursor_field:
            next_cursor = self._max_cursor_value(collected_rows, cursor_field)

        return {
            'data': collected_rows,
            'next_cursor': str(next_cursor) if next_cursor is not None else None,
            'has_more': False,
            'count': len(collected_rows),
        }

    def write_data(self, table_name: str, data: List[Dict[str, Any]], primary_key: str, mode: str = 'upsert') -> Dict[str, Any]:
        raise NotImplementedError(f'{self.connector_type} is a source-only connector')

    def _normalize_batch(self, batch: Any) -> List[Dict[str, Any]]:
        if batch is None:
            return []

        if isinstance(batch, dict):
            batch = [batch]

        rows: List[Dict[str, Any]] = []
        for row in batch:
            if isinstance(row, dict):
                rows.append(self._flatten_row(row))
        return rows

    def _flatten_row(self, row: Dict[str, Any], prefix: str = '') -> Dict[str, Any]:
        flattened: Dict[str, Any] = {}
        for key, value in row.items():
            normalized_key = f'{prefix}__{key}' if prefix else str(key)
            if isinstance(value, dict):
                flattened.update(self._flatten_row(value, normalized_key))
            elif isinstance(value, list):
                flattened[normalized_key] = json.dumps(value, default=str)
            elif isinstance(value, Decimal):
                flattened[normalized_key] = float(value)
            elif isinstance(value, (datetime, date)):
                flattened[normalized_key] = value.isoformat()
            else:
                flattened[normalized_key] = value
        return flattened

    def _infer_primary_key(self, columns: List[Dict[str, Any]]) -> Optional[str]:
        preferred = ['id', 'Id', 'ID', 'key']
        available = {column['name'].lower(): column['name'] for column in columns}
        for candidate in preferred:
            if candidate.lower() in available:
                return available[candidate.lower()]
        for column in columns:
            if self._is_stable_identifier_column(column['name']):
                return column['name']
        return None

    def _infer_cursor_field(self, columns: List[Dict[str, Any]], primary_key: Optional[str]) -> Optional[str]:
        timestamp_candidates = [
            'updated_at', 'updatedat', 'modified_at', 'modifiedat',
            'last_modified', 'lastmodified', 'timestamp', 'created_at',
            'createdat', 'datecreated', 'datemodified',
        ]
        available = {column['name'].lower(): column['name'] for column in columns}
        for candidate in timestamp_candidates:
            if candidate in available:
                return available[candidate]
        if primary_key and self._is_stable_identifier_column(primary_key):
            return primary_key
        return None

    def _resolve_hubspot_primary_key(self, columns: List[Dict[str, Any]], fallback_primary_key: Optional[str]) -> Optional[str]:
        available = {column['name'].lower(): column['name'] for column in columns}
        for candidate in ['id', 'hs_object_id', 'objectid']:
            if candidate in available:
                return available[candidate]
        if fallback_primary_key and self._is_stable_identifier_column(fallback_primary_key):
            return fallback_primary_key
        return None

    def _resolve_hubspot_cursor_field(self, columns: List[Dict[str, Any]], primary_key: Optional[str]) -> Optional[str]:
        available = {column['name'].lower(): column['name'] for column in columns}
        for candidate in ['hs_lastmodifieddate', 'updatedat', 'updated_at', 'lastmodifieddate', 'createdate']:
            if candidate in available:
                return available[candidate]
        return self._infer_cursor_field(columns, primary_key)

    def _supports_hubspot_history(
        self,
        endpoint: str,
        columns: List[Dict[str, Any]],
        primary_key: Optional[str],
    ) -> bool:
        normalized = endpoint.strip('/').lower()
        if '/schemas/' in normalized:
            return False
        if '/objects/' not in normalized:
            return False
        if not columns or not primary_key:
            return False
        if not self._is_stable_identifier_column(primary_key):
            return False
        return True

    def _is_stable_identifier_column(self, column_name: Optional[str]) -> bool:
        if not column_name:
            return False

        normalized = str(column_name).strip().lower()
        if not normalized:
            return False

        blocked_names = {
            'name', 'title', 'label', 'description', 'value', 'text',
            'email', 'domain', 'slug', 'path', 'url'
        }
        if normalized in blocked_names:
            return False

        if normalized in {'id', 'key', 'objectid', 'hs_object_id'}:
            return True

        return normalized.endswith('id')

    def _normalize_endpoint_name(self, value: str) -> str:
        return re.sub(r'[^a-z0-9]', '', str(value).lower().split('/')[-1])

    def _infer_column_type(self, value: Any) -> str:
        if value is None:
            return 'TEXT'
        if isinstance(value, bool):
            return 'BOOLEAN'
        if isinstance(value, int):
            return 'BIGINT'
        if isinstance(value, float):
            return 'NUMERIC'
        return 'TEXT'

    def _is_newer(self, candidate: Any, cursor_value: str) -> bool:
        if candidate is None:
            return False

        left = self._coerce_cursor(candidate)
        right = self._coerce_cursor(cursor_value)

        try:
            return left > right
        except Exception:
            return str(candidate) > str(cursor_value)

    def _max_cursor_value(self, rows: List[Dict[str, Any]], cursor_field: str) -> Any:
        values = [row.get(cursor_field) for row in rows if row.get(cursor_field) is not None]
        if not values:
            return None
        return max(values, key=self._coerce_cursor)

    def _coerce_cursor(self, value: Any):
        if isinstance(value, (int, float)):
            return value

        text = str(value)
        for caster in (int, float):
            try:
                return caster(text)
            except Exception:
                continue

        try:
            return datetime.fromisoformat(text.replace('Z', '+00:00'))
        except Exception:
            return text

    def _build_table_label(self, endpoint: str) -> str:
        if self.connector_type != 'hubspot':
            return endpoint.replace('/', ' ').replace('_', ' ').title()

        normalized = endpoint.strip('/').replace('-', '_')
        parts = [part for part in normalized.split('/') if part not in {'crm', 'marketing', 'cms', 'content', 'settings', 'communication-preferences', 'account-info'}]
        if 'objects' in parts:
            object_index = parts.index('objects')
            if object_index + 1 < len(parts):
                return parts[object_index + 1].replace('_', ' ')
        if 'schemas' in parts:
            schema_index = parts.index('schemas')
            if schema_index + 1 < len(parts):
                return f"{parts[schema_index + 1].replace('_', ' ')} schema"
            return 'schemas'
        return parts[-1].replace('_', ' ') if parts else normalized.replace('_', ' ')

    def _build_destination_name(self, endpoint: str) -> str:
        label = self._build_table_label(endpoint).strip().lower()
        cleaned = re.sub(r'[^a-z0-9]+', '_', label).strip('_')
        return cleaned or 'sync_table'

    def _should_skip_schema_sampling(self, endpoint: str) -> bool:
        normalized = endpoint.strip('/').lower()
        return self.connector_type == 'bamboohr' and normalized == 'custom-reports'

    def _get_sampling_skip_reason(self, endpoint: str) -> str:
        normalized = endpoint.strip('/').lower()
        if self.connector_type == 'bamboohr' and normalized == 'custom-reports':
            return 'Schema sampling skipped to avoid slow BambooHR report discovery'
        return 'Schema sampling skipped'

    def _format_discovery_error(self, exc: Exception) -> str:
        return self._format_runtime_error(exc)

    def _format_runtime_error(self, exc: Exception) -> str:
        message = str(exc)

        if 'Required scopes missing' in message:
            scopes = self._extract_scopes_from_error(message)
            if scopes:
                return f"Missing scopes: {', '.join(scopes)}"
            return 'Missing required scopes'

        if "'NoneType' object has no attribute 'get'" in message:
            return 'Unsupported or empty response from endpoint'

        if "'errors'" in message:
            return 'Endpoint returned an unsupported error payload'

        return message

    def _extract_scopes_from_error(self, message: str) -> List[str]:
        matches = re.findall(r"ErrorDetail\\(string='([^']+)', code='permission_denied'\\)", message)
        scopes = []
        for item in matches:
            if item == 'Required scopes missing':
                continue
            if item not in scopes:
                scopes.append(item)
        return scopes
