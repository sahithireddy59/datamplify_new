from typing import Any, Dict, List, Optional

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import URL

from .base import BaseConnector


class SQLSourceConnector(BaseConnector):
    """Generic SQLAlchemy-backed source connector for non-Postgres databases."""

    def __init__(self, sync_connector):
        super().__init__(sync_connector)
        self.engine = None

    def _get_engine(self):
        if self.engine is None:
            self.engine = create_engine(self._build_connection_string())
        return self.engine

    def _build_connection_string(self):
        connector_type = self.connector_type
        username = self.config.get('username', '')
        password = self.config.get('password', '')
        host = self.config.get('host', '')
        port = self.config.get('port')
        database = self.config.get('database', '')
        service_name = self.config.get('service_name')

        if connector_type == 'oracle':
            return URL.create(
                'oracle+oracledb',
                username=username,
                password=password,
                host=host,
                port=port,
                database='',
                query={'service_name': service_name} if service_name else None,
            )

        if connector_type == 'snowflake':
            schema = self.config.get('schema')
            query = {}
            if port:
                query['port'] = str(port)
            if schema:
                query['schema'] = str(schema)
            return URL.create(
                'snowflake',
                username=username,
                password=password,
                host=host,
                database=database,
                query=query or None,
            )

        if connector_type == 'mssql':
            driver = self.config.get('driver', 'ODBC Driver 18 for SQL Server')
            return URL.create(
                'mssql+pyodbc',
                username=username,
                password=password,
                host=host,
                port=port,
                database=database,
                query={
                    'driver': driver,
                    'Encrypt': 'no',
                    'TrustServerCertificate': 'yes',
                },
            )

        raise ValueError(f'Unsupported SQL source connector type: {connector_type}')

    def _get_schema_name(self) -> Optional[str]:
        schema = self.config.get('schema')
        if schema:
            return schema
        if self.connector_type == 'oracle':
            username = self.config.get('username')
            return username.upper() if username else None
        if self.connector_type == 'mssql':
            return 'dbo'
        return None

    def _get_schema_candidates(self) -> List[Optional[str]]:
        configured = self._get_schema_name()
        candidates: List[Optional[str]] = [configured]

        if isinstance(configured, str):
            candidates.extend([configured.upper(), configured.lower()])

        if self.connector_type == 'snowflake':
            current_schema = self._get_current_schema()
            if current_schema:
                candidates.extend([current_schema, current_schema.upper(), current_schema.lower()])

        ordered: List[Optional[str]] = []
        for candidate in candidates:
            if candidate not in ordered:
                ordered.append(candidate)
        return ordered

    def _get_current_schema(self) -> Optional[str]:
        try:
            with self._get_engine().connect() as conn:
                return conn.execute(text('SELECT CURRENT_SCHEMA()')).scalar()
        except Exception:
            return None

    def test_connection(self) -> Dict[str, Any]:
        try:
            with self._get_engine().connect() as conn:
                conn.execute(text('SELECT 1'))
            return {'success': True, 'message': 'Connection successful'}
        except Exception as exc:
            return {'success': False, 'message': f'Connection failed: {str(exc)}'}

    def discover_schema(self) -> List[Dict[str, Any]]:
        engine = self._get_engine()
        inspector = inspect(engine)
        tables = []
        selected_schema = None
        table_names: List[str] = []

        for schema_candidate in self._get_schema_candidates():
            try:
                table_names = inspector.get_table_names(schema=schema_candidate)
            except Exception:
                continue
            if table_names:
                selected_schema = schema_candidate
                break

        if not table_names:
            return []

        for table_name in table_names:
            columns = []
            pk_constraint = inspector.get_pk_constraint(table_name, schema=selected_schema) or {}
            pk_columns = pk_constraint.get('constrained_columns') or []
            primary_key = pk_columns[0] if pk_columns else None

            for column in inspector.get_columns(table_name, schema=selected_schema):
                columns.append({
                    'name': column['name'],
                    'type': str(column.get('type')),
                    'nullable': column.get('nullable', True),
                    'primary_key': column['name'] == primary_key,
                    'default': column.get('default'),
                })

            cursor_field = self._resolve_cursor_field(columns, primary_key)
            resolved_primary_key = primary_key or self._infer_identifier_column(columns)

            tables.append({
                'name': table_name,
                'schema': selected_schema,
                'row_count': None,
                'columns': columns,
                'supports_incremental': cursor_field is not None,
                'supports_history': self._is_valid_history_key(resolved_primary_key),
                'primary_key': resolved_primary_key,
                'cursor_field': cursor_field,
            })

        return tables

    def list_tables(self) -> List[Dict[str, Any]]:
        inspector = inspect(self._get_engine())
        selected_schema = None
        table_names: List[str] = []

        for schema_candidate in self._get_schema_candidates():
            try:
                table_names = inspector.get_table_names(schema=schema_candidate)
            except Exception:
                continue
            if table_names:
                selected_schema = schema_candidate
                break

        return [
            {
                'name': table_name,
                'label': table_name,
                'destination_name': table_name,
                'schema': selected_schema,
                'row_count': None,
                'columns': [],
                'supports_incremental': False,
                'supports_history': False,
                'primary_key': None,
                'cursor_field': None,
                'discovery_status': 'pending',
                'discovery_error': None,
            }
            for table_name in table_names
        ]

    def fetch_data(
        self,
        table_name: str,
        cursor_value: Optional[str] = None,
        cursor_field: Optional[str] = None,
        limit: Optional[int] = 1000,
    ) -> Dict[str, Any]:
        engine = self._get_engine()
        schema = self._resolve_existing_table_schema(table_name)
        metadata = MetaData()
        table = Table(table_name, metadata, schema=schema, autoload_with=engine)

        columns_meta = self.get_table_schema(table_name)
        primary_key = next((column['name'] for column in columns_meta if column.get('primary_key')), None)
        resolved_cursor_field = self._resolve_requested_field(columns_meta, cursor_field, primary_key)

        query = select(table)
        if cursor_value and resolved_cursor_field and resolved_cursor_field in table.c:
            query = query.where(table.c[resolved_cursor_field] > cursor_value)
        if resolved_cursor_field and resolved_cursor_field in table.c:
            query = query.order_by(table.c[resolved_cursor_field])
        if limit:
            query = query.limit(limit)

        with engine.connect() as conn:
            rows = conn.execute(query).mappings().all()

        data = [dict(row) for row in rows]
        next_cursor = None
        if data and resolved_cursor_field:
            next_cursor = data[-1].get(resolved_cursor_field)

        return {
            'data': data,
            'next_cursor': str(next_cursor) if next_cursor is not None else None,
            'has_more': len(data) == limit if limit else False,
            'count': len(data),
        }

    def write_data(self, table_name: str, data: List[Dict[str, Any]], primary_key: str, mode: str = 'upsert') -> Dict[str, Any]:
        raise NotImplementedError(f'{self.connector_type} is currently source-only in DataSync')

    def get_table_schema(self, table_name: str) -> List[Dict[str, Any]]:
        inspector = inspect(self._get_engine())
        schema = self._resolve_existing_table_schema(table_name)
        pk_constraint = inspector.get_pk_constraint(table_name, schema=schema) or {}
        pk_columns = set(pk_constraint.get('constrained_columns') or [])

        columns = []
        for column in inspector.get_columns(table_name, schema=schema):
            columns.append({
                'name': column['name'],
                'type': str(column.get('type')),
                'nullable': column.get('nullable', True),
                'primary_key': column['name'] in pk_columns,
            })
        return columns

    def _resolve_existing_table_schema(self, table_name: str) -> Optional[str]:
        inspector = inspect(self._get_engine())
        for schema_candidate in self._get_schema_candidates():
            try:
                if table_name in inspector.get_table_names(schema=schema_candidate):
                    return schema_candidate
            except Exception:
                continue
        return self._get_schema_name()

    def _resolve_cursor_field(self, columns: List[Dict[str, Any]], primary_key: Optional[str]) -> Optional[str]:
        cursor_candidates = [
            'updated_at', 'modified_at', 'created_at', 'last_modified',
            'updatedon', 'timestamp',
        ]
        by_name = {column['name'].lower(): column['name'] for column in columns}
        for candidate in cursor_candidates:
            if candidate in by_name:
                return by_name[candidate]
        if primary_key and self._is_valid_identifier_column(primary_key):
            return primary_key
        inferred_identifier = self._infer_identifier_column(columns)
        if inferred_identifier and self._is_valid_identifier_column(inferred_identifier):
            return inferred_identifier
        return None

    def _infer_identifier_column(self, columns: List[Dict[str, Any]]) -> Optional[str]:
        by_name = {column['name'].lower(): column['name'] for column in columns}
        for candidate in ['id', 'empid', 'employee_id', 'emp_id']:
            if candidate in by_name:
                return by_name[candidate]
        suffix_match = next(
            (column['name'] for column in columns if self._is_valid_identifier_column(column['name'])),
            None
        )
        return suffix_match

    def _is_valid_identifier_column(self, column_name: Optional[str]) -> bool:
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

        if normalized in {'id', 'key', 'objectid', 'hs_object_id', 'empid', 'employee_id', 'emp_id'}:
            return True

        return normalized.endswith('id')

    def _is_valid_history_key(self, primary_key: Optional[str]) -> bool:
        return self._is_valid_identifier_column(primary_key)

    def _resolve_requested_field(
        self,
        columns: List[Dict[str, Any]],
        requested_field: Optional[str],
        primary_key: Optional[str],
    ) -> Optional[str]:
        by_name = {column['name'].lower(): column['name'] for column in columns}
        if requested_field and requested_field.lower() in by_name:
            return by_name[requested_field.lower()]
        return self._resolve_cursor_field(columns, primary_key)
