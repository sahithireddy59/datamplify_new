import psycopg2
from psycopg2.extras import execute_values, RealDictCursor
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import hashlib
import json
from .base import BaseConnector


class PostgreSQLConnector(BaseConnector):
    """PostgreSQL database connector"""
    RESERVED_METADATA_COLUMNS = {
        '_datamplify_id',
        '_datamplify_synced',
        '_datamplify_deleted',
        '_datamplify_active',
        '_datamplify_start',
        '_datamplify_end',
    }
    
    def __init__(self, sync_connector):
        super().__init__(sync_connector)
        self.connection = None
    
    def _get_connection(self):
        """Get database connection"""
        if self.connection is None or self.connection.closed:
            self.connection = psycopg2.connect(
                host=self.config.get('host'),
                port=self.config.get('port', 5432),
                database=self.config.get('database'),
                user=self.config.get('username'),
                password=self.config.get('password')
            )
        return self.connection
    
    def test_connection(self) -> Dict[str, Any]:
        """Test PostgreSQL connection"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute('SELECT 1')
            cursor.close()
            
            return {
                'success': True,
                'message': 'Connection successful'
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'Connection failed: {str(e)}'
            }
    
    def discover_schema(self) -> List[Dict[str, Any]]:
        """Discover tables in PostgreSQL database"""
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        schema = self.config.get('schema', 'public')
        
        # Get all tables
        cursor.execute("""
            SELECT 
                table_name,
                (SELECT COUNT(*) FROM information_schema.columns 
                 WHERE table_schema = t.table_schema AND table_name = t.table_name) as column_count
            FROM information_schema.tables t
            WHERE table_schema = %s AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """, (schema,))
        
        tables = []
        for row in cursor.fetchall():
            table_name = row['table_name']
            
            columns, primary_key = self._get_table_metadata(cursor, schema, table_name)
            cursor_field = self._resolve_cursor_field(columns, primary_key)
            
            # Get row count
            cursor.execute(f'SELECT COUNT(*) as count FROM "{schema}"."{table_name}"')
            row_count = cursor.fetchone()['count']
            
            tables.append({
                'name': table_name,
                'schema': schema,
                'row_count': row_count,
                'columns': columns,
                'supports_incremental': True,
                'primary_key': primary_key,
                'cursor_field': cursor_field
            })
        
        cursor.close()
        return tables

    def get_table_schema(self, table_name: str) -> List[Dict[str, Any]]:
        """Get schema for a PostgreSQL table."""
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        schema = self.config.get('schema', 'public')

        try:
            columns, primary_key = self._get_table_metadata(cursor, schema, table_name)
        except Exception:
            conn.rollback()
            cursor.close()
            raise
        cursor.close()

        if not columns:
            raise Exception(f'Table {schema}.{table_name} does not exist')

        return [
            {
                'name': column['name'],
                'type': column['type'],
                'nullable': column['nullable'],
                'primary_key': column['name'] == primary_key
            }
            for column in columns
        ]
    
    def fetch_data(self, table_name: str, cursor_value: Optional[str] = None,
                   cursor_field: Optional[str] = None, limit: Optional[int] = 1000) -> Dict[str, Any]:
        """Fetch data from PostgreSQL table"""
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        schema = self.config.get('schema', 'public')
        columns, primary_key = self._get_table_metadata(cursor, schema, table_name)
        resolved_cursor_field = self._resolve_requested_field(columns, cursor_field, primary_key)
        
        # Build query
        query = f'SELECT * FROM "{schema}"."{table_name}"'
        params = []
        
        if cursor_value and resolved_cursor_field:
            query += f' WHERE "{resolved_cursor_field}" > %s'
            params.append(cursor_value)
        
        if resolved_cursor_field:
            query += f' ORDER BY "{resolved_cursor_field}"'
        
        if limit:
            query += f' LIMIT {limit}'
        
        cursor.execute(query, params)
        records = cursor.fetchall()
        
        # Convert to list of dicts
        data = [dict(record) for record in records]
        
        # Get next cursor value
        next_cursor = None
        if data and resolved_cursor_field:
            next_cursor = data[-1].get(resolved_cursor_field)
        
        cursor.close()
        
        return {
            'data': data,
            'next_cursor': str(next_cursor) if next_cursor else None,
            'has_more': len(data) == limit,
            'count': len(data)
        }

    def _get_table_metadata(self, cursor, schema: str, table_name: str):
        cursor.execute("""
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
        """, (schema, table_name))

        columns = []
        primary_key = None
        for col in cursor.fetchall():
            if col['column_default'] and 'nextval' in str(col['column_default']) and primary_key is None:
                primary_key = col['column_name']
            columns.append({
                'name': col['column_name'],
                'type': col['data_type'],
                'nullable': col['is_nullable'] == 'YES',
                'default': col['column_default']
            })

        if not columns:
            return [], None

        cursor.execute("""
            SELECT a.attname AS column_name
            FROM pg_index i
            JOIN pg_class c
              ON c.oid = i.indrelid
            JOIN pg_namespace n
              ON n.oid = c.relnamespace
            JOIN pg_attribute a
              ON a.attrelid = i.indrelid
             AND a.attnum = ANY(i.indkey)
            WHERE n.nspname = %s
              AND c.relname = %s
              AND i.indisprimary
        """, (schema, table_name))
        primary_key_row = cursor.fetchone()
        if primary_key_row:
            primary_key = primary_key_row['column_name']

        if primary_key is None:
            primary_key = self._infer_identifier_column(columns)

        return columns, primary_key

    def _resolve_cursor_field(self, columns: List[Dict[str, Any]], primary_key: Optional[str]) -> Optional[str]:
        cursor_candidates = [
            'updated_at', 'modified_at', 'created_at', 'last_modified',
            'updatedon', 'timestamp'
        ]
        timestamp_field = next(
            (col['name'] for col in columns if col['name'].lower() in cursor_candidates),
            None
        )
        return timestamp_field or primary_key or self._infer_identifier_column(columns)

    def _infer_identifier_column(self, columns: List[Dict[str, Any]]) -> Optional[str]:
        id_candidates = ['id', 'empid', 'employee_id', 'emp_id']
        by_name = {col['name'].lower(): col['name'] for col in columns}
        for candidate in id_candidates:
            if candidate in by_name:
                return by_name[candidate]

        suffix_match = next(
            (col['name'] for col in columns if col['name'].lower().endswith('id')),
            None
        )
        return suffix_match or (columns[0]['name'] if columns else None)

    def _resolve_requested_field(self, columns: List[Dict[str, Any]], requested_field: Optional[str], primary_key: Optional[str]) -> Optional[str]:
        if not columns:
            return requested_field

        by_name = {col['name'].lower(): col['name'] for col in columns}
        if requested_field and requested_field.lower() in by_name:
            return by_name[requested_field.lower()]

        return self._resolve_cursor_field(columns, primary_key)
    
    def write_data(self, table_name: str, data: List[Dict[str, Any]],
                   primary_key: str, mode: str = 'upsert') -> Dict[str, Any]:
        """Write data to PostgreSQL table"""
        if not data:
            return {'inserted': 0, 'updated': 0, 'deleted': 0, 'failed': 0}
        
        conn = self._get_connection()
        cursor = conn.cursor()
        
        schema = self.config.get('schema', 'public')
        full_table_name = f'"{schema}"."{table_name}"'
        
        sync_timestamp = datetime.now(timezone.utc)
        prepared_data = [
            self._prepare_record(record, sync_timestamp, primary_key, mode, row_index=index)
            for index, record in enumerate(data, start=1)
        ]
        primary_key = self._resolve_write_primary_key(prepared_data, primary_key)
        columns = list(prepared_data[0].keys())
        
        inserted = 0
        updated = 0
        deleted = 0
        failed = 0
        
        try:
            if mode == 'upsert':
                columns_str = ', '.join([f'"{col}"' for col in columns])
                update_str = ', '.join([f'"{col}" = EXCLUDED."{col}"' for col in columns if col != primary_key])
                values_list = [[record.get(col) for col in columns] for record in prepared_data]
                query = f"""
                    INSERT INTO {full_table_name} ({columns_str})
                    VALUES %s
                    ON CONFLICT ("{primary_key}")
                    DO UPDATE SET {update_str}
                """

                execute_values(cursor, query, values_list, page_size=1000)
                inserted = len(data)
            
            elif mode == 'insert':
                columns_str = ', '.join([f'"{col}"' for col in columns])
                values_list = [[record.get(col) for col in columns] for record in prepared_data]
                query = f"INSERT INTO {full_table_name} ({columns_str}) VALUES %s"
                execute_values(cursor, query, values_list, page_size=1000)
                inserted = len(prepared_data)
            
            elif mode == 'replace':
                columns_str = ', '.join([f'"{col}"' for col in columns])
                values_list = [[record.get(col) for col in columns] for record in prepared_data]

                upsert_query = f"""
                    INSERT INTO {full_table_name} ({columns_str}) VALUES %s
                    ON CONFLICT ("{primary_key}")
                    DO UPDATE SET {', '.join([f'"{col}" = EXCLUDED."{col}"' for col in columns if col != primary_key])}
                """
                execute_values(
                    cursor,
                    upsert_query,
                    values_list,
                    page_size=1000
                )
                inserted = len(prepared_data)

                deleted = self._mark_missing_rows_deleted(
                    cursor=cursor,
                    full_table_name=full_table_name,
                    primary_key=primary_key,
                    incoming_records=prepared_data,
                    sync_timestamp=sync_timestamp
                )

            elif mode == 'history':
                self._ensure_metadata_columns(cursor, schema, table_name, mode)
                history_result = self._write_history_data(
                    cursor=cursor,
                    schema=schema,
                    table_name=table_name,
                    full_table_name=full_table_name,
                    primary_key=primary_key,
                    source_data=data,
                    sync_timestamp=sync_timestamp
                )
                inserted = history_result['inserted']
                updated = history_result['updated']
                deleted = history_result['deleted']
            
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise Exception(f"Write failed: {str(e)}")
        finally:
            cursor.close()
        
        return {
            'inserted': inserted,
            'updated': updated,
            'deleted': deleted,
            'failed': failed
        }

    def ensure_conflict_target(self, table_name: str, primary_key: str, sample_record: Dict[str, Any], mode: str = 'upsert') -> None:
        """Ensure the destination table can upsert on the resolved key."""
        if not primary_key:
            return

        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        schema = self.config.get('schema', 'public')
        try:
            table_schema = self.get_table_schema(table_name)
            column_names = {column['name'] for column in table_schema}

            if primary_key not in column_names:
                inferred_type = self._infer_postgres_type(sample_record.get(primary_key))
                cursor.execute(
                    f'ALTER TABLE "{schema}"."{table_name}" ADD COLUMN IF NOT EXISTS "{primary_key}" {inferred_type}'
                )

            self._ensure_metadata_columns(cursor, schema, table_name, mode)
            if mode == 'history':
                index_name = f'{table_name}_{primary_key}_sync_active_key'
                safe_index_name = index_name[:63]
                cursor.execute(
                    f'''
                    CREATE UNIQUE INDEX IF NOT EXISTS "{safe_index_name}"
                    ON "{schema}"."{table_name}" ("{primary_key}")
                    WHERE COALESCE("_datamplify_active", TRUE) = TRUE
                    '''
                )
            else:
                index_name = f'{table_name}_{primary_key}_sync_key'
                safe_index_name = index_name[:63]
                cursor.execute(
                    f'CREATE UNIQUE INDEX IF NOT EXISTS "{safe_index_name}" ON "{schema}"."{table_name}" ("{primary_key}")'
                )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()

    def _with_datamplify_metadata(self, record: Dict[str, Any], sync_timestamp: datetime, primary_key: Optional[str] = None) -> Dict[str, Any]:
        prepared = dict(record)
        prepared['_datamplify_id'] = self._build_datamplify_id(record, primary_key)
        prepared['_datamplify_synced'] = sync_timestamp
        prepared['_datamplify_deleted'] = bool(prepared.get('_datamplify_deleted', False))
        return prepared

    def _with_history_metadata(self, record: Dict[str, Any], sync_timestamp: datetime, primary_key: Optional[str] = None) -> Dict[str, Any]:
        prepared = self._with_datamplify_metadata(record, sync_timestamp, primary_key)
        prepared['_datamplify_active'] = True
        prepared['_datamplify_start'] = sync_timestamp
        prepared['_datamplify_end'] = None
        return prepared

    def _build_datamplify_id(self, record: Dict[str, Any], primary_key: Optional[str]) -> str:
        if primary_key and primary_key in record and record.get(primary_key) is not None:
            identity_payload = {primary_key: record.get(primary_key)}
        else:
            identity_payload = {
                key: record.get(key)
                for key in sorted(record.keys())
                if not key.startswith('_datamplify_')
            }

        encoded = json.dumps(identity_payload, sort_keys=True, default=str, separators=(',', ':'))
        return hashlib.md5(encoded.encode('utf-8')).hexdigest()

    def _prepare_record(self, record: Dict[str, Any], sync_timestamp: datetime, primary_key: Optional[str], mode: str, row_index: int = 0) -> Dict[str, Any]:
        prepared = dict(record)
        prepared['_datamplify_id'] = self._build_datamplify_id(record, primary_key)
        prepared['_datamplify_synced'] = sync_timestamp

        if mode in ['replace', 'history']:
            prepared['_datamplify_deleted'] = bool(prepared.get('_datamplify_deleted', False))

        if mode == 'history':
            prepared['_datamplify_active'] = True
            prepared['_datamplify_start'] = sync_timestamp
            prepared['_datamplify_end'] = None

        return prepared

    def _resolve_write_primary_key(self, records: List[Dict[str, Any]], requested_primary_key: Optional[str]) -> str:
        if not records:
            return requested_primary_key or 'id'

        keys = list(records[0].keys())
        by_name = {key.lower(): key for key in keys}

        if requested_primary_key and requested_primary_key.lower() in by_name:
            return by_name[requested_primary_key.lower()]

        inferred = self._infer_identifier_column([{'name': key} for key in keys])
        return inferred or requested_primary_key or 'id'

    def _infer_postgres_type(self, value: Any) -> str:
        if value is None:
            return 'TEXT'
        if isinstance(value, bool):
            return 'BOOLEAN'
        if isinstance(value, int):
            return 'BIGINT'
        if isinstance(value, float):
            return 'NUMERIC'
        if isinstance(value, datetime):
            return 'TIMESTAMP'
        return 'TEXT'

    def _ensure_metadata_columns(self, cursor, schema: str, table_name: str, mode: str) -> None:
        for column_name, column_type in self._get_metadata_columns(mode):
            cursor.execute(
                f'ALTER TABLE "{schema}"."{table_name}" ADD COLUMN IF NOT EXISTS "{column_name}" {column_type}'
            )

    def _get_metadata_columns(self, mode: str) -> List[tuple]:
        if mode == 'history':
            return [
                ('_datamplify_id', 'TEXT'),
                ('_datamplify_synced', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'),
                ('_datamplify_deleted', 'BOOLEAN DEFAULT FALSE'),
                ('_datamplify_active', 'BOOLEAN DEFAULT TRUE'),
                ('_datamplify_start', 'TIMESTAMP NULL'),
                ('_datamplify_end', 'TIMESTAMP NULL'),
            ]
        if mode == 'replace':
            return [
                ('_datamplify_id', 'TEXT'),
                ('_datamplify_synced', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'),
                ('_datamplify_deleted', 'BOOLEAN DEFAULT FALSE'),
            ]
        return [
            ('_datamplify_id', 'TEXT'),
            ('_datamplify_synced', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'),
        ]

    def _write_history_data(
        self,
        cursor,
        schema: str,
        table_name: str,
        full_table_name: str,
        primary_key: str,
        source_data: List[Dict[str, Any]],
        sync_timestamp: datetime
    ) -> Dict[str, int]:
        source_columns = list(source_data[0].keys())
        metadata_columns = [
            '_datamplify_id',
            '_datamplify_synced',
            '_datamplify_deleted',
            '_datamplify_active',
            '_datamplify_start',
            '_datamplify_end'
        ]
        comparison_columns = [column for column in source_columns if column != primary_key]

        temp_table = 'temp_history_stage'
        cursor.execute(f'DROP TABLE IF EXISTS {temp_table}')
        cursor.execute(
            f'CREATE TEMP TABLE {temp_table} (LIKE "{schema}"."{table_name}" INCLUDING DEFAULTS) ON COMMIT DROP'
        )

        staged_rows = [
            self._prepare_record(record, sync_timestamp, primary_key, 'history', row_index=index)
            for index, record in enumerate(source_data, start=1)
        ]
        insert_columns = source_columns + metadata_columns
        temp_insert_columns = ', '.join([f'"{column}"' for column in insert_columns])
        temp_insert_values = [[row.get(column) for column in insert_columns] for row in staged_rows]
        execute_values(
            cursor,
            f'INSERT INTO {temp_table} ({temp_insert_columns}) VALUES %s',
            temp_insert_values,
            page_size=1000
        )

        changed_condition = ' OR '.join(
            [f'target."{column}" IS DISTINCT FROM incoming."{column}"' for column in comparison_columns]
        ) or 'FALSE'

        cursor.execute(
            f'''
            UPDATE {full_table_name} AS target
            SET "_datamplify_active" = FALSE,
                "_datamplify_end" = %s,
                "_datamplify_synced" = %s
            FROM {temp_table} AS incoming
            WHERE target."{primary_key}" = incoming."{primary_key}"
              AND COALESCE(target."_datamplify_active", TRUE) = TRUE
              AND ({changed_condition})
            ''',
            (sync_timestamp, sync_timestamp)
        )
        updated = cursor.rowcount

        source_select_list = ', '.join([f'incoming."{column}"' for column in insert_columns])
        cursor.execute(
            f'''
            INSERT INTO {full_table_name} ({temp_insert_columns})
            SELECT {source_select_list}
            FROM {temp_table} AS incoming
            LEFT JOIN {full_table_name} AS active
              ON active."{primary_key}" = incoming."{primary_key}"
             AND COALESCE(active."_datamplify_active", TRUE) = TRUE
            WHERE active."{primary_key}" IS NULL
            '''
        )
        inserted = cursor.rowcount

        cursor.execute(
            f'''
            UPDATE {full_table_name} AS target
            SET "_datamplify_deleted" = TRUE,
                "_datamplify_active" = FALSE,
                "_datamplify_end" = %s,
                "_datamplify_synced" = %s
            WHERE COALESCE(target."_datamplify_active", TRUE) = TRUE
              AND NOT EXISTS (
                  SELECT 1
                  FROM {temp_table} AS incoming
                  WHERE incoming."{primary_key}"::text = target."{primary_key}"::text
              )
            ''',
            (sync_timestamp, sync_timestamp)
        )
        deleted = cursor.rowcount

        return {
            'inserted': inserted,
            'updated': updated,
            'deleted': deleted
        }

    def _mark_missing_rows_deleted(self, cursor, full_table_name: str, primary_key: str, incoming_records: List[Dict[str, Any]], sync_timestamp: datetime) -> int:
        primary_keys = [record.get(primary_key) for record in incoming_records if record.get(primary_key) is not None]
        if not primary_keys:
            return 0

        temp_table = 'temp_sync_keys'
        cursor.execute(f'DROP TABLE IF EXISTS {temp_table}')
        cursor.execute(f'CREATE TEMP TABLE {temp_table} ("{primary_key}" TEXT) ON COMMIT DROP')
        execute_values(
            cursor,
            f'INSERT INTO {temp_table} ("{primary_key}") VALUES %s',
            [[str(value)] for value in primary_keys],
            page_size=1000
        )
        cursor.execute(
            f'''
            UPDATE {full_table_name} AS target
            SET "_datamplify_deleted" = TRUE,
                "_datamplify_synced" = %s
            WHERE NOT EXISTS (
                SELECT 1
                FROM {temp_table} AS incoming
                WHERE incoming."{primary_key}" = target."{primary_key}"::text
            )
              AND COALESCE(target."_datamplify_deleted", FALSE) = FALSE
            ''',
            (sync_timestamp,)
        )
        return cursor.rowcount
    
    def create_table(self, table_name: str, schema: List[Dict[str, Any]], mode: str = 'replace') -> bool:
        """Create table in PostgreSQL"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        db_schema = self.config.get('schema', 'public')
        
        # Build CREATE TABLE statement
        columns_def = []
        for col in schema:
            if col["name"] in self.RESERVED_METADATA_COLUMNS:
                continue
            col_def = f'"{col["name"]}" {col["type"]}'
            if not col.get('nullable', True):
                col_def += ' NOT NULL'
            if col.get('primary_key'):
                col_def += ' PRIMARY KEY'
            columns_def.append(col_def)
        
        # Add only the metadata needed for the selected sync mode
        for column_name, column_type in self._get_metadata_columns(mode):
            columns_def.append(f'{column_name} {column_type}')
        
        query = f'''
            CREATE TABLE IF NOT EXISTS "{db_schema}"."{table_name}" (
                {', '.join(columns_def)}
            )
        '''
        
        try:
            cursor.execute(query)
            conn.commit()
            cursor.close()
            return True
        except Exception as e:
            conn.rollback()
            cursor.close()
            raise Exception(f"Table creation failed: {str(e)}")

    def reset_transaction(self):
        """Clear an aborted transaction on the shared connection."""
        conn = self._get_connection()
        if conn and not conn.closed:
            conn.rollback()
    
    def __del__(self):
        """Close connection on cleanup"""
        if self.connection and not self.connection.closed:
            self.connection.close()
