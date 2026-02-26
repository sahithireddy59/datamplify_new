"""
Bulk Loading Utilities for High-Performance Data Loading
Implements database-specific bulk loading methods for 10-100x faster performance
"""

import logging
import pandas as pd
from io import StringIO
import tempfile
import os
from sqlalchemy import text

logger = logging.getLogger(__name__)


class BulkLoader:
    """
    High-performance bulk loading for different database types
    """
    
    def __init__(self, engine, db_type, schema='public'):
        self.engine = engine
        self.db_type = db_type.lower()
        self.schema = schema
    
    def bulk_load(self, data, table_name, batch_size=10000, if_exists='append'):
        """
        Main bulk load method - routes to database-specific implementation
        
        Args:
            data: List of dictionaries or DataFrame
            table_name: Target table name
            batch_size: Number of records per batch
            if_exists: 'append', 'replace', or 'fail'
        
        Returns:
            Number of records loaded
        """
        # Convert to DataFrame if needed
        if isinstance(data, list):
            df = pd.DataFrame(data)
        else:
            df = data
        
        if df.empty:
            logger.warning(f"No data to load into {table_name}")
            return 0
        
        total_records = len(df)
        logger.info(f"Starting bulk load of {total_records} records into {table_name}")
        
        # Route to database-specific method
        if self.db_type == 'postgresql':
            records_loaded = self._bulk_load_postgresql(df, table_name, batch_size, if_exists)
        elif self.db_type == 'snowflake':
            records_loaded = self._bulk_load_snowflake(df, table_name, batch_size, if_exists)
        elif self.db_type == 'mysql':
            records_loaded = self._bulk_load_mysql(df, table_name, batch_size, if_exists)
        elif self.db_type == 'oracle':
            records_loaded = self._bulk_load_oracle(df, table_name, batch_size, if_exists)
        else:
            # Fallback to pandas to_sql with batching
            logger.warning(f"Using fallback method for {self.db_type}")
            records_loaded = self._bulk_load_fallback(df, table_name, batch_size, if_exists)
        
        logger.info(f"Successfully loaded {records_loaded} records into {table_name}")
        return records_loaded
    
    def _bulk_load_postgresql(self, df, table_name, batch_size, if_exists):
        """
        PostgreSQL COPY command - 100x faster than INSERT
        """
        logger.info(f"Using PostgreSQL COPY for {table_name}")
        
        total_loaded = 0
        
        # Process in batches
        for start_idx in range(0, len(df), batch_size):
            end_idx = min(start_idx + batch_size, len(df))
            batch_df = df.iloc[start_idx:end_idx]
            
            # Create CSV buffer
            csv_buffer = StringIO()
            batch_df.to_csv(csv_buffer, index=False, header=False, sep='\t', na_rep='\\N')
            csv_buffer.seek(0)
            
            # Use raw connection for COPY
            with self.engine.raw_connection() as conn:
                cursor = conn.cursor()
                
                try:
                    # COPY command
                    copy_sql = f"""
                    COPY "{self.schema}"."{table_name}" ({','.join([f'"{col}"' for col in df.columns])})
                    FROM STDIN WITH (FORMAT CSV, DELIMITER E'\\t', NULL '\\N')
                    """
                    
                    cursor.copy_expert(copy_sql, csv_buffer)
                    conn.commit()
                    
                    batch_loaded = len(batch_df)
                    total_loaded += batch_loaded
                    logger.info(f"Loaded batch: {batch_loaded} records ({total_loaded}/{len(df)})")
                    
                except Exception as e:
                    conn.rollback()
                    logger.error(f"Error in PostgreSQL COPY: {str(e)}")
                    # Fallback to INSERT for this batch
                    batch_df.to_sql(table_name, self.engine, schema=self.schema, 
                                   if_exists='append', index=False, method='multi')
                    total_loaded += len(batch_df)
                finally:
                    cursor.close()
        
        return total_loaded
    
    def _bulk_load_snowflake(self, df, table_name, batch_size, if_exists):
        """
        Snowflake COPY INTO from staged files
        """
        logger.info(f"Using Snowflake COPY INTO for {table_name}")
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as tmp_file:
            tmp_path = tmp_file.name
            df.to_csv(tmp_file, index=False)
        
        try:
            with self.engine.connect() as conn:
                # Create internal stage if not exists
                stage_name = f"datamplify_stage_{table_name}"
                conn.execute(text(f"CREATE TEMPORARY STAGE IF NOT EXISTS {stage_name}"))
                
                # Put file to stage
                conn.execute(text(f"PUT file://{tmp_path} @{stage_name}"))
                
                # Copy into table
                copy_sql = f"""
                COPY INTO "{self.schema}"."{table_name}"
                FROM @{stage_name}
                FILE_FORMAT = (TYPE = 'CSV' FIELD_DELIMITER = ',' SKIP_HEADER = 1)
                ON_ERROR = 'CONTINUE'
                PURGE = TRUE
                """
                
                result = conn.execute(text(copy_sql))
                conn.commit()
                
                logger.info(f"Snowflake COPY completed for {table_name}")
                return len(df)
                
        except Exception as e:
            logger.error(f"Error in Snowflake COPY: {str(e)}")
            # Fallback
            return self._bulk_load_fallback(df, table_name, batch_size, if_exists)
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    
    def _bulk_load_mysql(self, df, table_name, batch_size, if_exists):
        """
        MySQL LOAD DATA INFILE
        """
        logger.info(f"Using MySQL LOAD DATA for {table_name}")
        
        # Create temporary CSV file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as tmp_file:
            tmp_path = tmp_file.name
            df.to_csv(tmp_file, index=False, header=False)
        
        try:
            with self.engine.connect() as conn:
                load_sql = f"""
                LOAD DATA LOCAL INFILE '{tmp_path}'
                INTO TABLE `{self.schema}`.`{table_name}`
                FIELDS TERMINATED BY ','
                LINES TERMINATED BY '\\n'
                ({','.join([f'`{col}`' for col in df.columns])})
                """
                
                conn.execute(text(load_sql))
                conn.commit()
                
                return len(df)
                
        except Exception as e:
            logger.error(f"Error in MySQL LOAD DATA: {str(e)}")
            return self._bulk_load_fallback(df, table_name, batch_size, if_exists)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    
    def _bulk_load_oracle(self, df, table_name, batch_size, if_exists):
        """
        Oracle bulk insert with executemany
        """
        logger.info(f"Using Oracle bulk insert for {table_name}")
        
        total_loaded = 0
        
        # Process in batches
        for start_idx in range(0, len(df), batch_size):
            end_idx = min(start_idx + batch_size, len(df))
            batch_df = df.iloc[start_idx:end_idx]
            
            # Convert to list of tuples
            data_tuples = [tuple(row) for row in batch_df.values]
            
            # Create INSERT statement
            placeholders = ','.join([':' + str(i+1) for i in range(len(df.columns))])
            insert_sql = f"""
            INSERT INTO "{self.schema}"."{table_name}" 
            ({','.join([f'"{col}"' for col in df.columns])})
            VALUES ({placeholders})
            """
            
            with self.engine.connect() as conn:
                conn.execute(text(insert_sql), data_tuples)
                conn.commit()
                
                total_loaded += len(batch_df)
                logger.info(f"Loaded batch: {len(batch_df)} records ({total_loaded}/{len(df)})")
        
        return total_loaded
    
    def _bulk_load_fallback(self, df, table_name, batch_size, if_exists):
        """
        Fallback method using pandas to_sql with batching
        """
        logger.info(f"Using fallback bulk insert for {table_name}")
        
        # Use pandas to_sql with method='multi' for better performance
        df.to_sql(
            table_name,
            self.engine,
            schema=self.schema,
            if_exists=if_exists,
            index=False,
            method='multi',
            chunksize=batch_size
        )
        
        return len(df)


def get_bulk_loader(engine, db_type, schema='public'):
    """
    Factory function to create BulkLoader instance
    
    Args:
        engine: SQLAlchemy engine
        db_type: Database type (postgresql, snowflake, mysql, oracle)
        schema: Schema name
    
    Returns:
        BulkLoader instance
    """
    return BulkLoader(engine, db_type, schema)
