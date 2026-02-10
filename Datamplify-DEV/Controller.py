from abc import ABC,abstractmethod
from Connections.utils import generate_engine
from Service.utils import encrypt_json
import pandas as pd
from sqlalchemy import text
from dataclasses import dataclass
from typing import List, Optional
import re,ast,requests
from Datamplify import settings



@dataclass(frozen=True, slots=True)
class ExecutionContext:
    source_id: int
    target_id: int
    user_id: int
    src_table: str
    tgt_table: str
    columns: list
    source_conn_info: dict
    target_conn_info: dict
    batch_size: int = 50000


@dataclass
class CanonicalColumn:
    name: str
    base: str
    length: Optional[int] = None
    precision: Optional[int] = None
    scale: Optional[int] = None

def parse_dtype(dtype: str) -> dict:
    dtype = dtype.strip().lower()

    match = re.match(r"(\w+)(?:\((\d+)(?:,(\d+))?\))?", dtype)
    if not match:
        return {"base": dtype}

    base, p1, p2 = match.groups()

    return {
        "base": base,
        "length": int(p1) if p1 and not p2 else None,
        "precision": int(p1) if p2 else None,
        "scale": int(p2) if p2 else None,
    }

def to_canonical(col_name: str, dtype: str) -> CanonicalColumn:
    parsed = parse_dtype(dtype)
    base = parsed["base"]

    if base in ("varchar", "varchar2", "nvarchar", "nvarchar2", "string"):
        return CanonicalColumn(col_name, "string", length=parsed["length"])
    if base in ("char", "nchar"):
        return CanonicalColumn(col_name, "char", length=parsed["length"])
    if base in ("text", "clob", "nclob", "long", "tinytext", "mediumtext", "longtext"):
        return CanonicalColumn(col_name, "text")
    if base in ("enum", "set"):
        return CanonicalColumn(col_name, "string")  # Enums/sets mapped to string

    if base in ("int", "integer", "smallint", "mediumint", "tinyint", "serial", "smallserial"):
        return CanonicalColumn(col_name, "integer")
    if base in ("bigint", "int8", "bigserial", "long"):
        return CanonicalColumn(col_name, "bigint")

    if base in ("number", "numeric", "decimal", "money", "smallmoney"):
        return CanonicalColumn(
            col_name,
            "decimal",
            precision=parsed["precision"],
            scale=parsed["scale"],
        )

    if base in ("float", "double", "real", "binary_float", "binary_double"):
        return CanonicalColumn(col_name, "float")

    if base in ("boolean", "bool", "bit"):
        return CanonicalColumn(col_name, "boolean")

    if base in ("uuid", "uniqueidentifier"):
        return CanonicalColumn(col_name, "uuid")

    if base in ("date"):
        return CanonicalColumn(col_name, "date")
    if base in ("datetime", "datetime2", "smalldatetime", "timestamp", "timestamptz", "timestamp with time zone", "timestamp without time zone", "time"):
        return CanonicalColumn(col_name, "timestamp")

    if base in ("json", "jsonb", "variant", "hstore"):
        return CanonicalColumn(col_name, "json")

    if base in ("blob", "bytea", "raw", "binary", "varbinary", "image", "longblob", "mediumblob", "tinyblob"):
        return CanonicalColumn(col_name, "binary")

    if base in ("geometry", "geography", "sdo_geometry"):
        return CanonicalColumn(col_name, "json")  # Map spatial types to JSON

    return CanonicalColumn(col_name, "text")

class BaseExtractor(ABC):

    @abstractmethod
    def extract(self,query):
        raise NotImplementedError


class BaseLoader(ABC):
    @abstractmethod
    def Create_table(self,query):
        raise NotImplementedError

    @abstractmethod
    def load(self,query):
        raise NotImplementedError

class ExtractorFactory:
    @staticmethod
    def create(context):
        conn_type = context.source_conn_info['type']
        match conn_type.lower():
            case "postgresql":
                return PostgresExtractor(context)
            case "oracle":
                return OracleExtractor(context)
            case "mysql":
                return MySQlExtractor(context)
            case "microsoftsqlserver":
                return MicrosoftSqlServerExtractor(context)
            case "snowflake":
                return SnowFlakeExtractor(context)
            case "mongodb":
                return MongoExtractor(context)
            case "ninja":
                return NinjaExtractor(context)
            case "halopsa":
                return HalopsaExtractor(context)
            case "connectwise":
                return ConnectwiseExtractor(context)
            case "shopify"|"tally" | "quickbooks" |"jira" |"hubspot"|"dbt"|"pax8"|"bamboohr" |"zoho_crm" |"zoho_books" | "zoho_inventory" | "salesforce":
                return IntegrationExtractor(context,conn_type.lower())
            case _:
                raise NotImplementedError
            
class LoaderFactory:
    @staticmethod
    def create(context):
        conn_type = context.target_conn_info['type']
        match str(conn_type).lower():
            case "postgresql":
                return PostgresLoader(context)
            case "oracle":
                return OracleLoader(context)
            case "mysql":
                return MySQLLoader(context)
            case "microsoftsqlserver":
                return MicrosoftSqlServerLoader(context)
            case "snowflake":
                return SnowflakeLoader(context)
            case "mongodb":
                return MongoLoader(context)
            case _:
                raise NotImplementedError



def flatten_document(doc, parent_key='', sep='_'):
    import json
    """
    Flatten a nested document/dictionary into a single level dictionary.
    """
    items = []
    for k, v in doc.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_document(v, new_key, sep=sep).items())
        elif isinstance(v, list):
            # Convert lists to JSON strings to handle them properly
            items.append((new_key, json.dumps(v) if v else None))
        else:
            items.append((new_key, v))
    return dict(items)


import time
from collections import defaultdict
from integration_injection import NinjaClient,HalopsaClient,ConnectwiseClient,Normalizer,Clickhouse,ShopifyClient,TallyClient,QuickbooksClient,SalesforceClient,JiraClient,HubspotClientToken,DbtClient,Pax8Client,BambooHrClient,ZohoClient
class NinjaExtractor(BaseExtractor):
    def __init__(self, context):
        self.token_metadata = context.source_conn_info['token_metadata']
        self.credentials = context.source_conn_info['credentials']
        self.Integration_id = context.source_conn_info['integration_id']
        self.clickhouse = Clickhouse()
        self.conn = self.clickhouse.client

    


    def Load_data(self,table_name:str):
        ninja_client = NinjaClient(self.token_metadata,self.credentials,self.Integration_id)
        normalizer = Normalizer(table_name)
        unix_suffix = int(time.time())
        database = f'Dummy_database_{self.Integration_id}_{unix_suffix}'
        self.clickhouse.Create_database(database)
        schema_buffer = defaultdict(list)
        schema_locked = False
        # batch_size = 1000 if schema_locked==False else 5000
        batch_size=10000

        for batch in ninja_client.stream_batches(table_name,batch_size):
            if batch ==[]:
                break  
            relations={} 
            tables,relations = normalizer.normalize(batch)
            if not schema_locked:
                for table, rows in tables.items():
                    schema_buffer[table].extend(rows)
                    self.clickhouse.create_tables(database,schema_buffer)
                    schema_locked = True
                    schema_buffer.clear()
            else:
                for table, rows in tables.items():
                    dataframe = pd.DataFrame(rows)
                    from integration_injection import normalize_columns
                    dataframe = normalize_columns(dataframe)

                    table = re.sub(r"[^a-zA-Z0-9_]", "_", table)
                    self.clickhouse.copy_insert(table, database,dataframe)

                    # self.conn.commit()
        self.database = database
        # clickhouse.drop_database(database)
        return relations if relations else {}


    def extract(self, query: str):
    # Use the native DataFrame stream for better performance
        try:
            with self.conn.query_df_stream(query) as stream:
                # Check if there's actually data to stream
                has_data = False
                for df in stream:
                    has_data = True
                    if not df.empty:
                        yield df
                
                # If no data was found and you REALLY need to drop the DB:
                if not has_data:
                    # Log a warning before such a destructive action
                    print(f"No data found for query. Considering cleanup for {self.database}")
                    self.clickhouse.drop_database(self.database) 
        
        except Exception as e:
            # Proper error handling for stream failures
            print(f"Stream interrupted: {e}")
            raise

def infer_clickhouse_type(value):
    if value is None:
        return "Nullable(String)"
    if isinstance(value, bool):
        return "Nullable(UInt8)"
    if isinstance(value, int):
        return "Nullable(Int64)"
    if isinstance(value, float):
        return "Nullable(Float64)"
    if isinstance(value, str):
        return "Nullable(String)"
    return "Nullable(String)"


def merge_ch_type(old, new):
    if old == new:
        return old
    return "Nullable(String)"   # safe promotion

class ConnectwiseExtractor(BaseExtractor):
    def __init__(self, context):
        self.token_metadata = context.source_conn_info['token_metadata']
        self.credentials = context.source_conn_info['credentials']
        self.Integration_id = context.source_conn_info['integration_id']
        self.clickhouse = Clickhouse()
        self.conn = self.clickhouse.client
        self.table_schema_cache = {}
        self.table_columns_cache = {}
    

    def Load_data(self,table_name:str):
        connectwiseclient = ConnectwiseClient(self.token_metadata,self.credentials,self.Integration_id)
        normalizer = Normalizer(table_name)
        unix_suffix = int(time.time())
        database = f'Dummy_database_{self.Integration_id}_{unix_suffix}'
        self.clickhouse.Create_database(database)
        # batch_size = 1000 if schema_locked==False else 5000
        batch_size=1

        for batch in connectwiseclient.stream_batches(table_name,batch_size):
            if batch ==[]:
                break   
            tables,relations = normalizer.normalize(batch)
            for table, rows in tables.items():

                # 1️⃣ First time table seen → infer schema
                if table not in self.table_schema_cache:
                    schema = {}

                    for row in rows:
                        for col, val in row.items():
                            dtype = infer_clickhouse_type(val)
                            schema[col] = merge_ch_type(schema.get(col), dtype)

                    self.clickhouse.ensure_table(database, table, schema)

                    self.table_schema_cache[table] = schema
                    self.table_columns_cache[table] = set(schema.keys())

                # 2️⃣ Detect new columns
                discovered_cols = set().union(*(row.keys() for row in rows))
                new_cols = discovered_cols - self.table_columns_cache[table]

                if new_cols:
                    new_schema = {
                        col: infer_clickhouse_type(
                            next(row[col] for row in rows if col in row)
                        )
                        for col in new_cols
                    }

                    self.clickhouse.evolve_schema(database, table, new_schema)

                    self.table_schema_cache[table].update(new_schema)
                    self.table_columns_cache[table].update(new_cols)

                # 3️⃣ Insert batch AS-IS (typed)
                self.clickhouse.copy_insert(table,database, rows,self.table_schema_cache)
        #     if not schema_locked:
        #         for table, rows in tables.items():
        #             schema_buffer[table].extend(rows)
        #             self.clickhouse.create_tables(database,schema_buffer)
        #             schema_locked = True
        #             # self.conn.commit()
        #             schema_buffer.clear()
        #     else:
        #         for table, rows in tables.items():
        #             dataframe = pd.DataFrame(rows)
        #             from integration_injection import normalize_columns
        #             dataframe = normalize_columns(dataframe)

        #             table = re.sub(r"[^a-zA-Z0-9_]", "_", table)
        #             self.clickhouse.copy_insert(table, database,dataframe)

        #             # self.conn.commit()
        self.database = database
        # # clickhouse.drop_database(database)
        return relations

    

    def extract(self, query: str):
    # Use the native DataFrame stream for better performance
        try:
            with self.conn.query_df_stream(query) as stream:
                # Check if there's actually data to stream
                has_data = False
                for df in stream:
                    has_data = True
                    if not df.empty:
                        yield df
                
                # If no data was found and you REALLY need to drop the DB:
                if not has_data:
                    # Log a warning before such a destructive action
                    print(f"No data found for query. Considering cleanup for {self.database}")
                    self.clickhouse.drop_database(self.database) 
        
        except Exception as e:
            # Proper error handling for stream failures
            print(f"Stream interrupted: {e}")
            raise






class HalopsaExtractor(BaseExtractor):
    def __init__(self, context):
        self.token_metadata = context.source_conn_info['token_metadata']
        self.credentials = context.source_conn_info['credentials']
        self.Integration_id = context.source_conn_info['integration_id']
        self.clickhouse = Clickhouse()
        self.conn = self.clickhouse.client
        self.table_schema_cache = {}
        self.table_columns_cache = {}


    def Load_data(self,table_name:str):
        halopsaclient = HalopsaClient(self.token_metadata,self.credentials,self.Integration_id)
        normalizer = Normalizer(table_name)
        unix_suffix = int(time.time())
        database = f'Dummy_database_{self.Integration_id}_{unix_suffix}'
        self.clickhouse.Create_database(database)
        # batch_size = 1000 if schema_locked==False else 5000
        batch_size=1

        for batch in halopsaclient.stream_batches(table_name,batch_size):
            if batch ==[]:
                break   
            tables,relations = normalizer.normalize(batch)
            for table, rows in tables.items():

                # 1️⃣ First time table seen → infer schema
                if table not in self.table_schema_cache:
                    schema = {}

                    for row in rows:
                        for col, val in row.items():
                            dtype = infer_clickhouse_type(val)
                            schema[col] = merge_ch_type(schema.get(col), dtype)

                    self.clickhouse.ensure_table(database, table, schema)

                    self.table_schema_cache[table] = schema
                    self.table_columns_cache[table] = set(schema.keys())

                # 2️⃣ Detect new columns
                discovered_cols = set().union(*(row.keys() for row in rows))
                new_cols = discovered_cols - self.table_columns_cache[table]

                if new_cols:
                    new_schema = {
                        col: infer_clickhouse_type(
                            next(row[col] for row in rows if col in row)
                        )
                        for col in new_cols
                    }

                    self.clickhouse.evolve_schema(database, table, new_schema)

                    self.table_schema_cache[table].update(new_schema)
                    self.table_columns_cache[table].update(new_cols)

                # 3️⃣ Insert batch AS-IS (typed)
                self.clickhouse.copy_insert(table,database, rows,self.table_schema_cache)
        #     if not schema_locked:
        #         for table, rows in tables.items():
        #             schema_buffer[table].extend(rows)
        #             self.clickhouse.create_tables(database,schema_buffer)
        #             schema_locked = True
        #             # self.conn.commit()
        #             schema_buffer.clear()
        #     else:
        #         for table, rows in tables.items():
        #             dataframe = pd.DataFrame(rows)
        #             from integration_injection import normalize_columns
        #             dataframe = normalize_columns(dataframe)

        #             table = re.sub(r"[^a-zA-Z0-9_]", "_", table)
        #             self.clickhouse.copy_insert(table, database,dataframe)

        #             # self.conn.commit()
        self.database = database
        # # clickhouse.drop_database(database)
        return relations




    def extract(self, query: str):
    # Use the native DataFrame stream for better performance
        try:
            with self.conn.query_df_stream(query) as stream:
                # Check if there's actually data to stream
                has_data = False
                for df in stream:
                    has_data = True
                    if not df.empty:
                        yield df
                
                # If no data was found and you REALLY need to drop the DB:
                if not has_data:
                    # Log a warning before such a destructive action
                    print(f"No data found for query. Considering cleanup for {self.database}")
                    self.clickhouse.drop_database(self.database) 
        
        except Exception as e:
            # Proper error handling for stream failures
            print(f"Stream interrupted: {e}")
            raise





class IntegrationExtractor(BaseExtractor):
    def __init__(self, context,integration_type):
        self.integration_type = integration_type
        self.token_metadata = context.source_conn_info['token_metadata']
        self.credentials = context.source_conn_info['credentials']
        self.Integration_id = context.source_conn_info['integration_id']
        self.clickhouse = Clickhouse()
        self.conn = self.clickhouse.client
        self.table_schema_cache = {}
        self.table_columns_cache = {}

    def get_integration_client(self):
        match self.integration_type:
            case 'shopify':
                return ShopifyClient
            case "tally":
                return TallyClient
            case "quickbooks":
                return QuickbooksClient
            case "jira":
                return JiraClient
            case "hubspot":
                return HubspotClientToken
            case "dbt":
                return DbtClient
            case "pax8":
                return Pax8Client
            case "bamboohr":
                return BambooHrClient
            case "zoho_crm"|"zoho_books" |"zoho_inventory":
                return ZohoClient
            case "salesforce":
                return SalesforceClient
        
    def Load_data(self,table_name:str):
        client_type = self.get_integration_client()
        client = client_type(self.token_metadata,self.credentials,self.Integration_id)
        normalizer = Normalizer(table_name)
        unix_suffix = int(time.time())
        database = f'Dummy_database_{self.Integration_id}_{unix_suffix}'
        self.clickhouse.Create_database(database)
        # batch_size = 1000 if schema_locked==False else 5000
        batch_size=10000
        relations=set()
        for batch in client.stream_batches(table_name,batch_size):
            if batch ==[]:
                relations=set()
                break 
            tables,relations = normalizer.normalize(batch)
            for table, rows in tables.items():

                # 1️⃣ First time table seen → infer schema
                if table not in self.table_schema_cache:
                    schema = {}

                    for row in rows:
                        for col, val in row.items():
                            dtype = infer_clickhouse_type(val)
                            schema[col] = merge_ch_type(schema.get(col), dtype)

                    self.clickhouse.ensure_table(database, table, schema)

                    self.table_schema_cache[table] = schema
                    self.table_columns_cache[table] = set(schema.keys())

                # 2️⃣ Detect new columns
                discovered_cols = set().union(*(row.keys() for row in rows))
                new_cols = discovered_cols - self.table_columns_cache[table]

                if new_cols:
                    new_schema = {
                        col: infer_clickhouse_type(
                            next(row[col] for row in rows if col in row)
                        )
                        for col in new_cols
                    }

                    self.clickhouse.evolve_schema(database, table, new_schema)

                    self.table_schema_cache[table].update(new_schema)
                    self.table_columns_cache[table].update(new_cols)

                # 3️⃣ Insert batch AS-IS (typed)
                self.clickhouse.copy_insert(table,database, rows,self.table_schema_cache)
        #     if not schema_locked:
        #         for table, rows in tables.items():
        #             schema_buffer[table].extend(rows)
        #             self.clickhouse.create_tables(database,schema_buffer)
        #             schema_locked = True
        #             # self.conn.commit()
        #             schema_buffer.clear()
        #     else:
        #         for table, rows in tables.items():
        #             dataframe = pd.DataFrame(rows)
        #             from integration_injection import normalize_columns
        #             dataframe = normalize_columns(dataframe)

        #             table = re.sub(r"[^a-zA-Z0-9_]", "_", table)
        #             self.clickhouse.copy_insert(table, database,dataframe)

        #             # self.conn.commit()
        self.database = database
        # # clickhouse.drop_database(database)
        return relations if relations else []




    def extract(self, query: str):
    # Use the native DataFrame stream for better performance
        try:
            with self.conn.query_df_stream(query) as stream:
                # Check if there's actually data to stream
                has_data = False
                for df in stream:
                    has_data = True
                    if not df.empty:
                        yield df
                
                # If no data was found and you REALLY need to drop the DB:
                if not has_data:
                    # Log a warning before such a destructive action
                    print(f"No data found for query. Considering cleanup for {self.database}")
                    self.clickhouse.drop_database(self.database) 
        
        except Exception as e:
            # Proper error handling for stream failures
            print(f"Stream interrupted: {e}")
            raise



class PostgresExtractor(BaseExtractor):

    def __init__(self, context):
        self.engine = context.source_conn_info['engine']
        self.schema = context.source_conn_info['schema']

    def extract(self, query: str):
        with self.engine.connect() as conn:
            result = conn.execution_options(stream_results=True).execute(query)
            columns = result.keys()

            for batch in result.partitions(50000):
                if not batch:
                    continue
                yield pd.DataFrame(batch, columns=columns)


class OracleExtractor(BaseExtractor):

    def __init__(self, context):
        self.engine = context.source_conn_info['engine']
        self.schema = context.source_conn_info['schema']

    def extract(self, query: str):
        with self.engine.connect() as conn:
            result = conn.execution_options(stream_results=True).execute(query)
            columns = result.keys()

            for batch in result.partitions(50000):
                if not batch:
                    continue
                yield pd.DataFrame(batch, columns=columns)


class MySQlExtractor(BaseExtractor):

    def __init__(self, context):
        self.engine = context.source_conn_info['engine']
        self.schema = context.source_conn_info['schema']

    def extract(self, query: str):
        with self.engine.connect() as conn:
            result = conn.execution_options(stream_results=True).execute(query)
            columns = result.keys()

            for batch in result.partitions(50000):
                if not batch:
                    continue
                yield pd.DataFrame(batch, columns=columns)

                
class MicrosoftSqlServerExtractor(BaseExtractor): 

    def __init__(self,context): 
        self.engine = context.source_conn_info['engine']
        self.schema = context.source_conn_info['schema']
    
    def extract(self, query: str): 
        with self.engine.connect() as conn: 
            result = conn.execute(query) 
            columns = result.keys() 
            for batch in result.partitions(50000): 
                if not batch: 
                    continue 
                yield pd.DataFrame(batch, columns=columns)


class SnowFlakeExtractor(BaseExtractor):

    def __init__(self, context):
        self.engine = context.source_conn_info['engine']
        self.schema = context.source_conn_info['schema']

    def extract(self, query: str):
        with self.engine.connect() as conn:
            result = conn.execution_options(stream_results=True).execute(query)
            columns = result.keys()

            for batch in result.partitions(50000):
                if not batch:
                    continue
                yield pd.DataFrame(batch, columns=columns)


class MongoExtractor(BaseExtractor):

    def __init__(self, context):
        self.client = context.source_conn_info['engine']
        self.source_table_name = context.source_conn_info['src_table']
        self.columns = context.source_conn_info['columns']

    def extract(self, projection=None):
        projection = None
        if self.columns:
            proj = {}
            for attr in self.columns:
                # support formats like ["fieldName", "dtype", ...] or "fieldName"
                if isinstance(attr, (list, tuple)) and len(attr) > 0:
                    field_name = attr[0]
                else:
                    field_name = attr
                proj[str(field_name)] = 1
            projection = proj or None

        collection  = self.client[self.source_table_name]
        cursor = collection.find({}, projection)
        documents = [flatten_document(doc) for doc in cursor]
        if not documents:
            if self.columns:
                cols = [
                    (attr[0] if isinstance(attr, (list, tuple)) and len(attr) > 0 else attr)
                    for attr in self.columns
                ]
            else:
                cols = ["_id"]
            df = pd.DataFrame(columns=cols)
        else:
            df = pd.DataFrame(documents)
            if "_id" in df.columns:
                df["_id"] = df["_id"].astype(str)

        import json

        for col in df.columns:
            df[col] = df[col].apply(
                lambda x: json.dumps(x) if isinstance(x, (dict, list)) else x
            )
        yield df

###################################  Loaders ########################

class MongoLoader(BaseLoader):
    
    def __init__():
        pass

    def load():

        pass


class PostgresLoader(BaseLoader):
    def __init__(self, context):
        self.engine = context.target_conn_info['engine']
        self.schema = context.target_conn_info['schema']
        self.cursor = context.target_conn_info['cursor']
    
    def to_postgres(self,col: CanonicalColumn) -> str:
        match col.base:
            case "string":
                return f"VARCHAR({col.length})" if col.length else "TEXT"
            case "char":
                return f"CHAR({col.length})" if col.length else "CHAR"
            case "text":
                return "TEXT"
            case "integer":
                return "INTEGER"
            case "bigint":
                return "BIGINT"
            case "decimal":
                return (
                    f"NUMERIC({col.precision},{col.scale or 0})"
                    if col.precision else "NUMERIC"
                )
            case "float":
                return "DOUBLE PRECISION"
            case "boolean":
                return "BOOLEAN"
            case "uuid":
                return "UUID"
            case "date":
                return "DATE"
            case "timestamp":
                return "TIMESTAMP"
            case "json":
                return "JSONB"
            case "binary":
                return "BYTEA"
            case _:
                return "TEXT"
    
    def Create_table(self,target_table,attributes):

        ddl_columns = []

        for col in attributes:
            if len(col) >= 1:
                col_name = col[0]
                data_type = col[1]
            else:
                raise ValueError(f"Invalid source_attribute format: {col}")
            canonical_type = to_canonical(col_name,data_type)
            dtype = self.to_postgres(canonical_type)
            ddl_columns.append(f"{col_name}  {dtype}")

        if not ddl_columns:
            raise ValueError("No columns provided for CREATE TABLE")

        columns_sql = ",\n    ".join(ddl_columns)

        full_table = (
            f""" {self.schema}.{target_table} """
            if self.schema else f""" {target_table}  """
        )
        query = f"""
                CREATE TABLE {full_table} (
                    {columns_sql}
                )
                """.strip()
        self.cursor.execute(query)
        return full_table

    def load(self, dataframe, table_name):
        dataframe.to_sql(
            table_name,
            self.engine,
            schema=self.schema,
            if_exists="append",
            index=False,
            chunksize=50000,
            method="multi"
        )
    

class MySQLLoader(BaseLoader):
    def __init__(self, context):
        self.engine = context.target_conn_info['engine']
        self.schema = context.target_conn_info['schema']
        self.cursor = context.target_conn_info['cursor']

    def to_mysql(self, col: CanonicalColumn) -> str:
        match col.base:
            case "string":
                return f"VARCHAR({col.length})" if col.length else "TEXT"

            case "char":
                return f"CHAR({col.length})" if col.length else "CHAR(1)"

            case "text":
                return "TEXT"

            case "integer":
                return "INT"

            case "bigint":
                return "BIGINT"

            case "decimal":
                if col.precision:
                    return f"DECIMAL({col.precision},{col.scale or 0})"
                return "DECIMAL"

            case "float":
                return "DOUBLE"

            case "boolean":
                return "TINYINT(1)"   # MySQL convention

            case "uuid":
                return "CHAR(36)"     # safest cross-version choice

            case "date":
                return "DATE"

            case "timestamp":
                return "DATETIME"

            case "json":
                return "JSON"

            case "binary":
                return "BLOB"

            case _:
                return "TEXT"


    def Create_table(self,target_table,attributes):
        ddl_columns = []

        for col in attributes:
            if len(col) < 2:
                raise ValueError(f"Invalid attribute format: {col}")

            col_name, data_type = col[0], col[1]

            canonical = to_canonical(col_name, data_type)
            mysql_type = self.to_mysql(canonical)

            ddl_columns.append(f"`{col_name}` {mysql_type}")

        if not ddl_columns:
            raise ValueError("No columns provided for CREATE TABLE")

        columns_sql = ",\n    ".join(ddl_columns)

        full_table = (
            f"`{self.schema}`.`{target_table}`"
            if self.schema else f"`{target_table}`"
        )

        query = f"""
        CREATE TABLE {full_table} (
            {columns_sql}
        );
        """.strip()

        self.cursor.execute(query)
        return True

    def load(self, df, table_name):
        df.to_sql(
            table_name,
            self.engine,
            if_exists="append",
            index=False,
            chunksize=50000,
            method="multi"
        )

class MicrosoftSqlServerLoader(BaseLoader):

    def __init__(self,context):
        self.engine = context.target_conn_info['engine']
        self.schema = context.target_conn_info['schema']
        self.engine.fast_executemany = True
        self.cursor = context.target_conn_info['cursor']

    def to_sqlserver(self, col: CanonicalColumn) -> str:
        match col.base:
            case "string":
                return f"NVARCHAR({col.length})" if col.length else "NVARCHAR(MAX)"

            case "char":
                return f"NCHAR({col.length})" if col.length else "NCHAR(1)"

            case "text":
                return "NVARCHAR(MAX)"

            case "integer":
                return "INT"

            case "bigint":
                return "BIGINT"

            case "decimal":
                if col.precision:
                    return f"DECIMAL({col.precision},{col.scale or 0})"
                return "DECIMAL"

            case "float":
                return "FLOAT"

            case "boolean":
                return "BIT"

            case "uuid":
                return "UNIQUEIDENTIFIER"

            case "date":
                return "DATE"

            case "timestamp":
                return "DATETIME2"

            case "json":
                return "NVARCHAR(MAX)"   # SQL Server stores JSON as text

            case "binary":
                return "VARBINARY(MAX)"

            case _:
                return "NVARCHAR(MAX)"
            
    def Create_table(self, target_table, attributes):

        ddl_columns = []

        for col in attributes:
            if len(col) < 2:
                raise ValueError(f"Invalid attribute format: {col}")

            col_name, data_type = col[0], col[1]

            canonical = to_canonical(col_name, data_type)
            sqlserver_type = self.to_sqlserver(canonical)

            ddl_columns.append(f"[{col_name}] {sqlserver_type}")

        if not ddl_columns:
            raise ValueError("No columns provided for CREATE TABLE")

        columns_sql = ",\n    ".join(ddl_columns)

        full_table = (
            f"[{self.schema}].[{target_table}]"
            if self.schema else f"[{target_table}]"
        )

        query = f"""
        CREATE TABLE {full_table} (
            {columns_sql}
        );
        """.strip()

        self.cursor.execute(query)
        return True
    
    def load(self, df, table_name):
        df.to_sql(
            table_name,
            self.engine,
            if_exists="append",
            index=False,
            chunksize=50000
        )


class OracleLoader(BaseLoader):

    def __init__(self,context):
        self.engine = context.target_conn_info['engine']
        self.schema = context.target_conn_info['schema']

    def to_oracle(self, col: CanonicalColumn) -> str:
        match col.base:
            case "string":
                return f"VARCHAR2({col.length})" if col.length else "CLOB"

            case "char":
                return f"CHAR({col.length})" if col.length else "CHAR(1)"

            case "text":
                return "CLOB"

            case "integer":
                return "NUMBER(10)"

            case "bigint":
                return "NUMBER(19)"

            case "decimal":
                if col.precision:
                    return f"NUMBER({col.precision},{col.scale or 0})"
                return "NUMBER"

            case "float":
                return "BINARY_DOUBLE"

            case "boolean":
                return "NUMBER(1)"      

            case "uuid":
                return "RAW(16)"        

            case "date":
                return "DATE"

            case "timestamp":
                return "TIMESTAMP"

            case "json":
                return "CLOB"           

            case "binary":
                return "BLOB"

            case _:
                return "CLOB"
            
    def Create_table(self,target_table,attributes):

        ddl_columns = []

        for col in attributes:
            if len(col) < 2:
                raise ValueError(f"Invalid attribute format: {col}")

            col_name, data_type = col[0], col[1]
            canonical = to_canonical(col_name, data_type)
            oracle_type = self.to_oracle(canonical)

            ddl_columns.append(f'"{col_name}" {oracle_type}')

        columns_sql = ",\n    ".join(ddl_columns)

        full_table = (
            f"{self.schema}.{target_table}"
            if self.schema else target_table
        )

        query = f"""
        CREATE TABLE {full_table} (
            {columns_sql}
        )
        """

        self.cursor.execute(query)
        return True

    def load(self, df, table_name):
        cols = ",".join(df.columns)
        binds = ",".join([f":{i+1}" for i in range(len(df.columns))])

        if self.schema:
            full_table = f""" "{self.schema}"."{table_name}" """
        else:
            full_table = f""" "{table_name}" """

        sql = f"INSERT INTO {full_table} ({cols}) VALUES ({binds})"
        rows = list(df.itertuples(index=False, name=None))

        conn = self.engine.raw_connection()   # NO context manager
        try:
            cur = conn.cursor()
            cur.executemany(sql, rows)
            conn.commit()
        finally:
            cur.close()
            conn.close()



class SnowflakeLoader(BaseLoader):

    def __init__(self, context):
        self.engine = context.target_conn_info['engine']
        self.schema = context.target_conn_info['schema']
        self.cursor = context.target_conn_info['cursor']

    def to_snowflake(self, col: CanonicalColumn) -> str:
        match col.base:
            case "string":
                return f"VARCHAR({col.length})" if col.length else "STRING"

            case "char":
                return f"CHAR({col.length})" if col.length else "CHAR"

            case "text":
                return "STRING"

            case "integer":
                return "INTEGER"

            case "bigint":
                return "BIGINT"

            case "decimal":
                if col.precision:
                    return f"NUMBER({col.precision},{col.scale or 0})"
                return "NUMBER"

            case "float":
                return "FLOAT"

            case "boolean":
                return "BOOLEAN"

            case "uuid":
                return "STRING"   # Snowflake has no native UUID type

            case "date":
                return "DATE"

            case "timestamp":
                return "TIMESTAMP_NTZ"  # or TIMESTAMP_TZ / TIMESTAMP_LTZ depending on requirement

            case "json":
                return "VARIANT"

            case "binary":
                return "BINARY"

            case _:
                return "STRING"
        
    def Create_table(self, target_table, attributes):

        ddl_columns = []

        for col in attributes:
            if len(col) < 2:
                raise ValueError(f"Invalid attribute format: {col}")

            col_name, data_type = col[0], col[1]

            canonical = to_canonical(col_name, data_type)
            snowflake_type = self.to_snowflake(canonical)

            # Use double quotes to preserve exact column name casing
            ddl_columns.append(f'"{col_name}" {snowflake_type}')

        if not ddl_columns:
            raise ValueError("No columns provided for CREATE TABLE")

        columns_sql = ",\n    ".join(ddl_columns)

        # Quoting table name to preserve exact casing
        full_table = f'"{self.schema}"."{target_table}"' if self.schema else f'"{target_table}"'

        query = f"""
        CREATE TABLE {full_table} (
            {columns_sql}
        );
        """.strip()

        self.cursor.execute(query)
        return True

    def load(self, df, table_name):
        df.to_sql(
            table_name,
            self.engine,
            schema="PUBLIC",
            if_exists="append",
            index=False,
            chunksize=10000,
            method="multi"
        )





class Orchastera:
    def __init__(self,source_id,target_id,user_id,source_table_name,target_table_name,columns):
        
        # self.source_id = source_id
        # self.target_id = target_id
        # self.user_id = user_id
        # self.source_table_name = source_table_name
        # self.target_table_name = target_table_name
        # self.src_columns = columns 
        # self.source_conn_info = generate_engine(self.source_id, self.user_id)
        # self.target_conn_info = generate_engine(self.target_id, self.user_id)


        # self.source_conn_info['src_table'] = self.target_conn_info['src_table'] = self.source_table_name
        # self.source_conn_info['columns'] = self.target_conn_info['columns'] = self.src_columns
        # self.source_conn_info['tgt_table'] = self.target_conn_info['tgt_table'] = self.target_table_name
        
        self.context = ExecutionContext(
            source_id=source_id,
            target_id=target_id,
            user_id=user_id,
            src_table=source_table_name,
            tgt_table=target_table_name,
            columns=columns,
            source_conn_info=generate_engine(source_id, user_id),
            target_conn_info=generate_engine(target_id, user_id)
        )
        # if self.context.source_conn_info["status"] or self.context.target_conn_info["status"]==400:
        #     return {"status":400,"message":"Invalid Credentials"}
        self.extractor = ExtractorFactory.create(self.context)
        self.loader = LoaderFactory.create(self.context)
 
    def run(self, query, target_table,attributes=None):
        created=False
        for batch in self.extractor.extract(query):
            if attributes is not None and created:
                self.loader.Create_table(target_table,attributes)
                created=True
            self.loader.load(batch, target_table)
    



        
class IntegrationOrchastera:

    def __init__(self,hierarchy_id,user_id):
        self.hierarchy_id = hierarchy_id
        self.user_id = user_id
    

    

