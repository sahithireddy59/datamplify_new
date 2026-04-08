from sqlalchemy import create_engine, text, inspect
from typing import List, Dict, Any, Optional
from .base import BaseConnector


class MySQLConnector(BaseConnector):
    """MySQL database connector using SQLAlchemy"""
    
    def __init__(self, sync_connector):
        super().__init__(sync_connector)
        self.engine = None
    
    def _get_connection(self):
        """Get database connection"""
        if self.engine is None:
            connection_string = (
                f"mysql+pymysql://{self.config.get('username')}:{self.config.get('password')}"
                f"@{self.config.get('host')}:{self.config.get('port', 3306)}"
                f"/{self.config.get('database', '')}"
            )
            self.engine = create_engine(connection_string)
        return self.engine
    
    def test_connection(self) -> Dict[str, Any]:
        """Test MySQL connection"""
        try:
            engine = self._get_connection()
            with engine.connect() as conn:
                conn.execute(text('SELECT 1'))
            
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
        """Discover tables in MySQL database"""
        engine = self._get_connection()
        inspector = inspect(engine)
        
        database = self.config.get('database')
        
        tables = []
        for table_name in inspector.get_table_names():
            # Get columns
            columns = []
            primary_key = None
            for col in inspector.get_columns(table_name):
                if col.get('primary_key') and primary_key is None:
                    primary_key = col['name']
                columns.append({
                    'name': col['name'],
                    'type': str(col['type']),
                    'nullable': col['nullable'],
                    'primary_key': col.get('primary_key', False),
                    'default': col.get('default')
                })

            cursor_candidates = [
                'updated_at', 'modified_at', 'created_at', 'last_modified',
                'updatedon', 'timestamp'
            ]
            cursor_field = next(
                (col['name'] for col in columns if col['name'].lower() in cursor_candidates),
                primary_key
            )
            
            # Get row count
            with engine.connect() as conn:
                result = conn.execute(text(f"SELECT COUNT(*) as count FROM `{table_name}`"))
                row_count = result.scalar()
            
            tables.append({
                'name': table_name,
                'database': database,
                'row_count': row_count,
                'columns': columns,
                'supports_incremental': True,
                'primary_key': primary_key,
                'cursor_field': cursor_field
            })
        
        return tables
    
    def fetch_data(self, table_name: str, cursor_value: Optional[str] = None,
                   cursor_field: Optional[str] = None, limit: Optional[int] = 1000) -> Dict[str, Any]:
        """Fetch data from MySQL table"""
        engine = self._get_connection()
        
        # Build query
        query = f'SELECT * FROM `{table_name}`'
        params = {}
        
        if cursor_value and cursor_field:
            query += f' WHERE `{cursor_field}` > :cursor_value'
            params['cursor_value'] = cursor_value
        
        if cursor_field:
            query += f' ORDER BY `{cursor_field}`'
        
        if limit:
            query += f' LIMIT {limit}'
        
        with engine.connect() as conn:
            result = conn.execute(text(query), params)
            columns = result.keys()
            data = [dict(zip(columns, row)) for row in result.fetchall()]
        
        # Get next cursor value
        next_cursor = None
        if data and cursor_field:
            next_cursor = data[-1].get(cursor_field)
        
        return {
            'data': data,
            'next_cursor': str(next_cursor) if next_cursor else None,
            'has_more': len(data) == limit,
            'count': len(data)
        }
    
    def write_data(self, table_name: str, data: List[Dict[str, Any]],
                   primary_key: str, mode: str = 'upsert') -> Dict[str, Any]:
        """Write data to MySQL table"""
        if not data:
            return {'inserted': 0, 'updated': 0, 'failed': 0}
        
        engine = self._get_connection()
        
        columns = list(data[0].keys())
        
        inserted = 0
        updated = 0
        failed = 0
        
        try:
            with engine.begin() as conn:
                if mode == 'upsert':
                    # Use INSERT ... ON DUPLICATE KEY UPDATE
                    columns_str = ', '.join([f'`{col}`' for col in columns])
                    placeholders = ', '.join([f':{col}' for col in columns])
                    update_str = ', '.join([f'`{col}` = VALUES(`{col}`)' for col in columns if col != primary_key])
                    
                    query = f"""
                        INSERT INTO `{table_name}` ({columns_str})
                        VALUES ({placeholders})
                        ON DUPLICATE KEY UPDATE {update_str}
                    """
                    
                    for record in data:
                        try:
                            result = conn.execute(text(query), record)
                            if result.rowcount == 1:
                                inserted += 1
                            else:
                                updated += 1
                        except Exception as e:
                            print(f"Error inserting record: {str(e)}")
                            failed += 1
        except Exception as e:
            raise Exception(f"Write failed: {str(e)}")
        
        return {
            'inserted': inserted,
            'updated': updated,
            'failed': failed
        }
    
    def __del__(self):
        """Close connection on cleanup"""
        if self.engine:
            self.engine.dispose()
