from Service.utils import decode_value,flatten_document,decrypt_json
from sqlalchemy import create_engine
from urllib.parse import quote
from pathlib import Path
from cassandra.auth import PlainTextAuthProvider
from cassandra.cluster import Cluster
from pymongo import MongoClient
from Connections import models as conn_models
from sqlalchemy import text
import pyodbc,os
from datetime import datetime






def promote_type(existing, new):
    if existing == new:
        return existing

    # null never wins
    if existing == "null":
        return new
    if new == "null":
        return existing

    # numeric widening
    if existing == "integer" and new == "float":
        return "float"
    if existing == "float" and new == "integer":
        return "float"

    # date + datetime
    if {existing, new} == {"date", "datetime"}:
        return "datetime"

    # fallback
    return "string"

from collections import defaultdict


def detect_primitive_type(value) -> str:
    if value is None:
        return "null"

    if isinstance(value, bool):
        return "boolean"

    if isinstance(value, int):
        return "integer"

    if isinstance(value, float):
        return "float"

    if isinstance(value, str):
        # try datetime
        try:
            datetime.fromisoformat(value.replace("Z", "+00:00"))
            return "datetime"
        except Exception:
            return "string"

    if isinstance(value, dict):
        return "object"

    if isinstance(value, list):
        return "array"

    return "string"


def discover_schema_with_types(obj, table, collector):

    if not isinstance(obj, dict):
        return

    for k, v in obj.items():
        if isinstance(v, dict):
            child_table = f"{table}__{k}"
            discover_schema_with_types(v, child_table, collector)

        elif isinstance(v, list):
            child_table = f"{table}__{k}"
            for item in v:
                if isinstance(item, dict):
                    discover_schema_with_types(item, child_table, collector)
                else:
                    dtype = detect_primitive_type(item)
                    collector.add_column(child_table, "value", dtype)

        else:
            dtype = detect_primitive_type(v)
            collector.add_column(table, k, dtype)
# def discover_tabular_schema(
#     rows: list[list],
#     table: str,
#     collector,
#     sample_rows: int = 100,
# ):
#     if not rows or len(rows) < 2:
#         return

#     header = rows[0]
#     data_rows = rows[1 : sample_rows + 1]

#     for col_index, col_name in enumerate(header):
#         detected_type = "string"

#         for row in data_rows:
#             if col_index >= len(row):
#                 continue

#             value = row[col_index]
#             if value in (None, "", "NULL"):
#                 continue

#             detected_type = merge_types(
#                 detected_type,
#                 detect_primitive_type(value),
#             )

#         collector.add_column(
#             table=table,
#             column=normalize_column_name(col_name),
#             dtype=detected_type,
#         )

class TypedSchemaCollector:
    def __init__(self):
        self.tables = defaultdict(dict)  # table → col → type

    def add_column(self, table, column, dtype):
        if column not in self.tables[table]:
            self.tables[table][column] = dtype
        else:
            self.tables[table][column] = promote_type(
                self.tables[table][column], dtype
            )

    def result(self):
        import re
        tables =[]
        for table,col in self.tables.items():
            col = [{"col": re.sub(r"[^a-zA-Z0-9_]", "_", col), "dtype": dtype}
                for col, dtype in col.items() ]
            tables.append({'tables':re.sub(r"[^a-zA-Z0-9_]", "_", table),'columns':col})
        
        return tables


def discover_endpoint_schema(
    client,
    endpoint: str,
    root_table: str,
    sample_pages: int = 1,
):
    collector = TypedSchemaCollector()

    # for page in range(1, sample_pages + 1):
    records = client.fetch_page(endpoint, {})
    if not records:
        return []

    for record in records:
        discover_schema_with_types(record, root_table, collector)
    # discover_tabular_schema(records, root_table, collector)

    return collector.result()

import pandas as pd




def is_date_column(series):
    """
    Returns True if the column likely contains date strings.
    """
    # Check if the column is of object type
    if series.dtype == 'object':
        # Verify if the column is not fully numeric
        if not pd.to_numeric(series[series.notna()], errors='coerce').notna().all():
            # Attempt to convert to datetime and check if any conversion was successful
            converted = pd.to_datetime(series, errors='coerce')
            return converted.notna().any()  # Return True if any entry is a valid date

    return False


from dateutil import parser


def convert_numeric_columns(df):
    # Identify columns that are objects and contain commas
    numeric_columns = []
    for col in df.columns:
        if df[col].dtype == 'object':  # Check if column is string-like
            try:
                if df[col].str.contains(',', na=False).any():  # Check for ',' with na=False to handle NaN
                    numeric_columns.append(col)
            except AttributeError:
                print(f"Skipping column {col}: Not a string column or contains invalid data")
            try:
                if pd.api.types.is_numeric_dtype(df[col]):
                    df[col] = pd.to_numeric(df[col][df[col].notna()])
                    sum_mod = (df[col] % 1).sum()
                    if isinstance(sum_mod,float) and sum_mod != 0.0:
                        df[col] = pd.to_numeric(df[col],errors='coerce').astype(float)
                    else:
                        df[col] = pd.to_numeric(df[col][df[col].notna()],errors='coerce').astype(int)
            except Exception as e:
                pass
    
    for column in numeric_columns:
        try:
            df[column] = df[column].str.replace(',', '', regex=False)
            # Uncomment if you want to replace NaN with 0
            # df[column].fillna(0, inplace=True)
        except Exception as e:
            print(f"Error converting column {column} to numeric: {e}")
            continue
    return df



def convert_percentage_columns(df):
    # Identify columns that are objects and contain '%'
    percentage_columns = []
    for col in df.columns:
        if df[col].dtype == 'object':  # Check if column is string-like
            try:
                if df[col].str.contains('%', na=False).any():  # Check for '%' with na=False to handle NaN
                    percentage_columns.append(col)
            except AttributeError:
                print(f"Skipping column {col}: Not a string column or contains invalid data")
    
    for column in percentage_columns:
        try:
            df[column] = (df[column].str.rstrip('%').astype(float) / 100.0).round(3)
            # Uncomment if you want to replace NaN with 0
            # df[column].fillna(0, inplace=True)
        except Exception as e:
            print(f"Error converting column {column} to percentage: {e}")
            continue
    return df


def convert_datetime_columns(df):

    potential_date_columns = [col for col in df.columns if is_date_column(df[col])]     


    for column in potential_date_columns:
        try:
                # Use apply with dateutil's parse to convert the column
                # df[column] = df[column].apply(lambda x: parser.parse(x) if pd.notnull(x) else x)
            try:

                df[column] = df[column].apply(
                    lambda x: parser.parse(x) if pd.notnull(x) and isinstance(x, str) else  x)

                if pd.api.types.is_datetime64_any_dtype(df[column]):
                    df[column] = df[column].dt.tz_localize(None)

                # default_datetime = datetime(1970, 1, 1)  # Unix epoch start
                # df[column] = df[column].fillna(default_datetime)
                # df[column] = df[column].where(pd.notnull(df[column]), None)
                # df[column] =df[column].where(pd.NaT(df[column]),None)
                df[column] = pd.to_datetime(df[column],errors = 'coerce')
                df[column] = df[column].apply(lambda x: pd.Timestamp(x) if pd.notna(x) and not pd.NaT(x) else None)
            except Exception as e:
                continue
        except Exception as e:
            # If conversion fails, print an error message (optional) and skip the column
            continue
    return df






def map_dtypes_to_clickhouse(df):
    try:
        type_mapping = {

            'String':'String',
            'object': 'String',
            'int64': 'Int64',
            'int32':'Int64',
            'UInt64':'Int64',
            'float64': 'Float64',
            'bool': 'Bool',
            'datetime64[ns]': "DateTime64",
            'datetime64[ns, tzoffset(None, -28800)]':"DateTime64"  # Handle datetime
        }
        clickhouse_schema = []
        for column in df.columns:
            dtype = str(df[column].dtype)
            if dtype=='float64':
                sum_mod = (df[column] % 1).sum()
                if isinstance(sum_mod, float) and sum_mod != 0.0: 
                    dtype = 'float64'  # Keep it as int64
                else:
                    dtype = 'int64' # Keep it as float64
            if df[column].isnull().any():
                clickhouse_schema.append(f""" "{column}" Nullable(DateTime64) DEFAULT '1970-01-01 00:00:00' """ if 'datetime' in  str(dtype.lower()) else f""" "{column}" Nullable({type_mapping[dtype]})""")
            else:
                clickhouse_schema.append(f""" "{column}" DateTime64 DEFAULT '1970-01-01 00:00:00' """ if 'datetime' in  str(dtype.lower()) else f""" "{column}" {type_mapping[dtype]} """)
            # else:
            #     raise ValueError(f"Unsupported dtypes: {dtype} for column: {column}")

        return ", ".join(clickhouse_schema)
    except Exception as e:
        print(e)



def fetch_filename_extension(file_name):
    try:
        file_name, file_extension = os.path.splitext(file_name.name)
    except:
        server_path = Path(str(file_name)) 
        file_name, file_extension = server_path.stem, server_path.suffix
    return file_name, file_extension


def cassandra_db(cluster):
    try:
        session = cluster.connect()
        # print("Connected to cluster:", cluster.metadata.cluster_name)
        cluster.shutdown()
        data = {
            "status":200,
            "engine":None,
            "cursor":None
        }
        return data
    except Exception as e:
        data={
            "status":400,
            "message" : f"{str(e)}"
        }
        return data
    
def server_path_function(server_path,parameter):
    if server_path==None or server_path=='':
        data = {
            "status":406,
            "message":"database_path is mandatory"
        }
        return data
    else:
        if parameter=="MICROSOFTACCESS":
            # database_path = r'C:\path\to\your\database.accdb'
            url = f'access+pyodbc:///?Driver={{Microsoft Access Driver (*.mdb, *.accdb)}};DBQ={str(server_path)}'
        elif parameter=="SQLITE":
            # database_path = 'path/to/your/database.db'
            # url = f'sqlite:///{str(server_path)}'
            file_name, file_extension = fetch_filename_extension(server_path)
            if file_extension =='.db' or file_extension=='.sqlite' or file_extension=='.sqlite3' or file_extension=='':
                pass
            else:
                data = {
                    "status":406,
                    "message":"not acceptable/invalid file"
                }
                return data
            try:
                BASE_DIR = Path(__file__).resolve().parent.parent  # Adjust BASE_DIR as needed
                db_file_path = os.path.join(BASE_DIR, str(server_path))
                url = f'sqlite:///{db_file_path}'
            except:
                # database_path = 'path/to/your/database.db'
                url = f'sqlite:///{str(server_path)}'
        data = {
            "status":200,
            "url":url
        }
        return data



def mongo_db(username, password, database, hostname, port):
    try:
        if (username=='' or username==None) and (password =='' or password==None):
            client = MongoClient(hostname, int(port))
        else:
            connection_string = f'mongodb://{username}:{password}@{hostname}:{int(port)}/{database}'
            client = MongoClient(connection_string)
        
        db = client[database]
        data = {
            "status":200,
            "engine":db,
            "cursor":db
        }
        return data
    except Exception as e:
        data={
            "status":400,
            "message" : f"{str(e)}"
        }
        return data

from urllib.parse import quote_plus


def server_connection(username, password, database, hostname,port,service_name,parameter,server_path, schema=None):
    try:
        password1234=quote_plus(decode_value(password))
    except:
        pass
    match str(parameter).upper():
        case "POSTGRESQL":
            url = "postgresql://{}:{}@{}:{}/{}".format(username,password1234,hostname,port,database)
        case "ORACLE":
            url = (f"oracle+oracledb://{username}:{password1234}@{hostname}:{port}/"f"?service_name={service_name}"
)
        case "MYSQL":
            url = f'mysql+mysqlconnector://{username}:{password1234}@{hostname}:{port}/{database}'
        case "SNOWFLAKE":
            snowflake_options = [f'port={port}']
            if schema:
                snowflake_options.append(f'schema={quote_plus(str(schema))}')
            query_string = '&'.join(snowflake_options)
            url = f'snowflake://{username}:{password1234}@{hostname}/{database}?{query_string}'
        case "IBMDB2":
            url = f'ibm_db_sa://{username}:{password1234}@{hostname}:{port}/{database}'
        case "MICROSOFTSQLSERVER":
            driver='ODBC Driver 18 for SQL Server'
            # connection_string = f'DRIVER={driver};SERVER={hostname};DATABASE={database};Trusted_Connection=yes;' 
            if (username and password1234 == None) or (username and password1234 == '') or (username and password1234 == ""):
                connection_string = f'DRIVER={{{driver}}};SERVER={hostname};DATABASE={database};Trusted_Connection=yes;Encrypt=no;TrustServerCertificate=yes;' #;UID={username};PWD={password1234}
            else:
                connection_string = f'DRIVER={{{driver}}};SERVER={hostname};DATABASE={database};UID={username};PWD={decode_value(password)};Encrypt=no;TrustServerCertificate=yes;'  #;Trusted_Connection=yes;
            try:
                conn = pyodbc.connect(connection_string)
            except Exception as e:
                return {"status":400,"message":"Invalid Credentials"}
            engine = conn
            cursor = conn.cursor()
            data={
                "status":200,
                "engine":engine,
                "cursor":cursor
            }
            return data
        case "MICROSOFTACCESS":
            sq_msacces=server_path_function(server_path,parameter)
            if sq_msacces['status']==200:
                url = sq_msacces['url']
            else:
                return sq_msacces
        case "SQLITE":
            sq_msacces=server_path_function(server_path,parameter)
            if sq_msacces['status']==200:
                url = sq_msacces['url']
            else:
                return sq_msacces
        case "SYBASE":
            url = f'sybase+pyodbc://{username}:{password1234}@{hostname}:{port}/{database}'
        case "MONGODB":
            mongo=mongo_db(username, password1234, database, hostname,port)
            return mongo
        case "CASSANDRA":
            auth_provider = PlainTextAuthProvider(username=username, password=password1234)
            cluster = Cluster([hostname], port=port, auth_provider=auth_provider)
            cassandra = cassandra_db(cluster)
            return cassandra
        case "SAP HANA":
            connection_string = f"hana+hdbcli://{username}:{password1234}@{hostname}:{port}/{database}"
        case "SAP BW":
            connection_string = f"hana+hdbcli://{username}:{password1234}@{hostname}:{port}/{database}"
            
        # engine = create_engine(url, echo=True)
        case "MICROSOFTSQLSERVER": 
            if int(port)==1433:
                engine = conn
                cursor = conn.cursor()
            else:
                data={
                    "status":400,
                    "message":"Invalid port"
                }
                return data
    try:
        engine = create_engine(url)
        cursor = engine.connect()
    except Exception as e:
        return {"status":400,"message":str(e)}
    data={
        "status":200,
        "engine":engine,
        "cursor":cursor
    }
    return data




def generate_engine(id,user_id):
        accessible_user_ids = [user_id]
        user = conn_models.UserProfile.objects.get(id = user_id)
        if hasattr(user, 'created_by') and user.created_by:
            accessible_user_ids.append(user.created_by.id)
        Connection_details= conn_models.Connections.objects.get(id=id,user_id__in =accessible_user_ids)
        server_type = conn_models.DataSources.objects.get(id=Connection_details.type.id)
        if server_type.type.lower() =='database':
            database_details = conn_models.DatabaseConnections.objects.get(id=Connection_details.table_id)
            data = server_connection(database_details.username,database_details.password,database_details.database,database_details.hostname,
                                    database_details.port,database_details.service_name,server_type.name,database_details.database_path,
                                    schema=database_details.schema)
            data['schema'] = database_details.schema
            data['type'] = server_type.name
            return data
        elif server_type.type.lower()=='integrations':
            data={}
            Integration_details  = conn_models.Integrations.objects.get(id = Connection_details.table_id)
            data['token_metadata'] = decrypt_json(Integration_details.token_metadata)
            data['credentials'] = decrypt_json(Integration_details.credentials)
            data['type'] = server_type.name
            data['integration_id'] = Connection_details.table_id
            return data
        else:
            raise 'Not Implemented'
        # if server_type.lower() =='postgresql':

        #      postgres_url = f"postgresql://{database_details.username}:{password}@{database_details.hostname}:{database_details.port}/{database_details.database}?options=-csearch_path%3D{database_details.schema}"
        # else:
        #      return 'Unspported Database'
        # engine = create_engine(postgres_url)
        # return {"engine":engine,
        #         "schema":database_details.schema}

                


def get_table_details(database_type,cursor,schema='public'):
    match database_type.lower():
        case 'mysql':
            cursor_data = cursor.execute(text("""SELECT
                    TABLE_NAME,
                    GROUP_CONCAT(CONCAT(COLUMN_NAME, ':', DATA_TYPE) ORDER BY ORDINAL_POSITION) AS columns
                FROM
                    INFORMATION_SCHEMA.COLUMNS
                WHERE
                    TABLE_SCHEMA = DATABASE()  -- Or specify a specific database name
                GROUP BY
                    TABLE_NAME
                ORDER BY
                    TABLE_NAME;"""))

        case 'oracle':
            cursor_data = cursor.execute(text("""SELECT
                    TABLE_NAME,
                    LISTAGG(COLUMN_NAME || ':' || DATA_TYPE, ', ') WITHIN GROUP (ORDER BY COLUMN_ID) AS columns
                FROM
                    ALL_TAB_COLUMNS
                WHERE
                    OWNER = USER
                GROUP BY
                    TABLE_NAME
                ORDER BY
                    TABLE_NAME"""))

        case 'snowflake':
            cursor_data = cursor.execute(text(f"""SELECT
                    TABLE_NAME,
                    LISTAGG(COLUMN_NAME || ':' || DATA_TYPE, ', ') WITHIN GROUP (ORDER BY ORDINAL_POSITION) AS columns
                FROM
                    INFORMATION_SCHEMA.COLUMNS
                WHERE
                    TABLE_SCHEMA =  '{schema}' -- Or specify a schema/database
                    AND TABLE_CATALOG = CURRENT_DATABASE()
                    GROUP BY
                    TABLE_NAME
                ORDER BY
                    TABLE_NAME;"""))

        case 'sqlite':
            try:
                cursor_data = cursor.execute(text("""SELECT
                        m.name AS table_name,
                        GROUP_CONCAT(p.name || ':' || p.type, ', ') AS columns
                    FROM sqlite_master AS m
                    JOIN pragma_table_info(m.name) AS p
                    GROUP BY m.name
                    ORDER BY m.name;"""))
            except Exception as e:
                print(e)

        case 'microsoftsqlserver':
            cursor_data = cursor.execute("""SELECT
                t.name AS table_name,
                STRING_AGG(c.name + ':' + TYPE_NAME(c.user_type_id), ', ') WITHIN GROUP (ORDER BY c.column_id) AS columns
            FROM sys.tables AS t
            INNER JOIN sys.columns AS c ON t.object_id = c.object_id
            INNER JOIN sys.schemas AS s ON t.schema_id = s.schema_id
            WHERE s.name = 'dbo'  -- Or specify the schema name
            GROUP BY t.name
            ORDER BY t.name;""")

        case 'postgresql':
            cursor_data = cursor.execute(text(f"""SELECT 
                    table_name, 
                    STRING_AGG(column_name || ':' || data_type, ',' ORDER BY ordinal_position) AS columns 
                FROM information_schema.columns 
                WHERE table_schema = '{schema}' 
                GROUP BY table_name 
                ORDER BY table_name;"""))

        case 'mariadb':
            cursor_data = cursor.execute(text("""SELECT
                    TABLE_NAME,
                    GROUP_CONCAT(CONCAT(COLUMN_NAME, ':', DATA_TYPE) ORDER BY ORDINAL_POSITION) AS columns
                FROM
                    INFORMATION_SCHEMA.COLUMNS
                WHERE
                    TABLE_SCHEMA = DATABASE()  -- Or specify a specific database name
                GROUP BY
                    TABLE_NAME
                ORDER BY
                    TABLE_NAME;"""))

        case 'db2':
            cursor_data = cursor.execute(text("""SELECT
                    TABNAME AS table_name,
                    LISTAGG(COLNAME || ':' || TYPENAME, ', ') WITHIN GROUP (ORDER BY COLNO) AS columns
                FROM SYSCAT.COLUMNS
                WHERE TABSCHEMA = CURRENT SCHEMA
                GROUP BY TABNAME
                ORDER BY TABNAME;"""))
        case 'mongodb':
            tables = []
            collections = cursor.list_collection_names()

            for coll_name in collections:
                collection = cursor[coll_name]

                fields = {}

                doc  = collection.find({})
                dict_items = [flatten_document(doc) for doc in doc]

                for row in dict_items:
                    for key,value in row.items():
                        fields[key] = type(value).__name__  
                    break  

                # Convert Python type → SQL type (optional mapping)
                sql_type_map = {
                    "int": "integer",
                    "float": "numeric",
                    "str": "character varying",
                    "datetime": "timestamp",
                    "ObjectId": "character varying",
                    "bool": "boolean",
                    "list": "json",
                    "dict": "json",
                    "NoneType": "character varying",
                    "ObjectId":"integer"
                }

                columns_list = []
                for col, py_type in fields.items():
                    sql_type = sql_type_map.get(py_type, "character varying")
                    columns_list.append({
                        "col": col,
                        "dtype": sql_type
                    })

                tables.append({
                    "tables": coll_name,
                    "columns": columns_list
                })
            return tables

        case _:
            raise ValueError(f"Unsupported database type: {database_type}")
    tables = []
    for row in cursor_data.fetchall():
        table_name = row[0]  # Get the table name
        column_string = row[1]  # Get the comma-separated string of column::datatype
        column_list = column_string.split(',')  # Split into a list

        # Process each column and extract name + data type
        columns = [{"col": col.split(":")[0].strip(), "dtype": col.split(":")[1].strip()} for col in column_list]

        # Append structured data to the list
        table_data = {"tables": table_name, "columns": columns}
        tables.append(table_data)

    return tables


def _get_mongodb_columns(cursor, table_name):
    collection = cursor[table_name]
    fields = {}

    for row in collection.find({}):
        flat_row = flatten_document(row)
        for key, value in flat_row.items():
            fields[key] = type(value).__name__
        break

    sql_type_map = {
        "int": "integer",
        "float": "numeric",
        "str": "character varying",
        "datetime": "timestamp",
        "ObjectId": "integer",
        "bool": "boolean",
        "list": "json",
        "dict": "json",
        "NoneType": "character varying",
    }

    return [
        {
            "col": col,
            "dtype": sql_type_map.get(py_type, "character varying")
        }
        for col, py_type in fields.items()
    ]


def get_table_names(database_type, cursor, schema='public'):
    database_type = database_type.lower()

    match database_type:
        case 'mysql' | 'mariadb':
            cursor_data = cursor.execute(text("""SELECT
                    TABLE_NAME
                FROM
                    INFORMATION_SCHEMA.TABLES
                WHERE
                    TABLE_SCHEMA = DATABASE()
                ORDER BY
                    TABLE_NAME;"""))
            return [{"tables": row[0]} for row in cursor_data.fetchall()]

        case 'oracle':
            cursor_data = cursor.execute(text("""SELECT
                    TABLE_NAME
                FROM
                    USER_TABLES
                ORDER BY
                    TABLE_NAME"""))
            return [{"tables": row[0]} for row in cursor_data.fetchall()]

        case 'snowflake':
            cursor_data = cursor.execute(text("""SELECT
                    TABLE_NAME
                FROM
                    INFORMATION_SCHEMA.TABLES
                WHERE
                    TABLE_SCHEMA = :schema
                    AND TABLE_CATALOG = CURRENT_DATABASE()
                ORDER BY
                    TABLE_NAME;"""), {"schema": schema})
            return [{"tables": row[0]} for row in cursor_data.fetchall()]

        case 'sqlite':
            cursor_data = cursor.execute(text("""SELECT
                    name
                FROM
                    sqlite_master
                WHERE
                    type = 'table'
                    AND name NOT LIKE 'sqlite_%'
                ORDER BY
                    name;"""))
            return [{"tables": row[0]} for row in cursor_data.fetchall()]

        case 'microsoftsqlserver':
            cursor_data = cursor.execute(text("""SELECT
                    t.name
                FROM
                    sys.tables AS t
                INNER JOIN sys.schemas AS s ON t.schema_id = s.schema_id
                WHERE
                    s.name = :schema
                ORDER BY
                    t.name;"""), {"schema": schema or "dbo"})
            return [{"tables": row[0]} for row in cursor_data.fetchall()]

        case 'postgresql':
            cursor_data = cursor.execute(text("""SELECT
                    table_name
                FROM
                    information_schema.tables
                WHERE
                    table_schema = :schema
                    AND table_type = 'BASE TABLE'
                ORDER BY
                    table_name;"""), {"schema": schema})
            return [{"tables": row[0]} for row in cursor_data.fetchall()]

        case 'db2':
            cursor_data = cursor.execute(text("""SELECT
                    TABNAME
                FROM
                    SYSCAT.TABLES
                WHERE
                    TABSCHEMA = CURRENT SCHEMA
                ORDER BY
                    TABNAME;"""))
            return [{"tables": row[0]} for row in cursor_data.fetchall()]

        case 'mongodb':
            return [{"tables": coll_name} for coll_name in cursor.list_collection_names()]

        case _:
            raise ValueError(f"Unsupported database type: {database_type}")


def get_single_table_details(database_type, cursor, table_name, schema='public'):
    database_type = database_type.lower()

    match database_type:
        case 'mysql' | 'mariadb':
            cursor_data = cursor.execute(text("""SELECT
                    COLUMN_NAME,
                    DATA_TYPE
                FROM
                    INFORMATION_SCHEMA.COLUMNS
                WHERE
                    TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = :table_name
                ORDER BY
                    ORDINAL_POSITION;"""), {"table_name": table_name})
            columns = [{"col": row[0], "dtype": row[1]} for row in cursor_data.fetchall()]

        case 'oracle':
            cursor_data = cursor.execute(text("""SELECT
                    COLUMN_NAME,
                    DATA_TYPE
                FROM
                    ALL_TAB_COLUMNS
                WHERE
                    OWNER = USER
                    AND TABLE_NAME = :table_name
                ORDER BY
                    COLUMN_ID"""), {"table_name": table_name})
            columns = [{"col": row[0], "dtype": row[1]} for row in cursor_data.fetchall()]

        case 'snowflake':
            cursor_data = cursor.execute(text("""SELECT
                    COLUMN_NAME,
                    DATA_TYPE
                FROM
                    INFORMATION_SCHEMA.COLUMNS
                WHERE
                    TABLE_SCHEMA = :schema
                    AND TABLE_CATALOG = CURRENT_DATABASE()
                    AND TABLE_NAME = :table_name
                ORDER BY
                    ORDINAL_POSITION;"""), {"schema": schema, "table_name": table_name})
            columns = [{"col": row[0], "dtype": row[1]} for row in cursor_data.fetchall()]

        case 'sqlite':
            escaped_table_name = table_name.replace("'", "''")
            cursor_data = cursor.execute(text(f"PRAGMA table_info('{escaped_table_name}');"))
            columns = [{"col": row[1], "dtype": row[2] or "string"} for row in cursor_data.fetchall()]

        case 'microsoftsqlserver':
            cursor_data = cursor.execute(text("""SELECT
                    c.name,
                    TYPE_NAME(c.user_type_id)
                FROM
                    sys.tables AS t
                INNER JOIN sys.columns AS c ON t.object_id = c.object_id
                INNER JOIN sys.schemas AS s ON t.schema_id = s.schema_id
                WHERE
                    s.name = :schema
                    AND t.name = :table_name
                ORDER BY
                    c.column_id;"""), {"schema": schema or "dbo", "table_name": table_name})
            columns = [{"col": row[0], "dtype": row[1]} for row in cursor_data.fetchall()]

        case 'postgresql':
            cursor_data = cursor.execute(text("""SELECT
                    column_name,
                    data_type
                FROM
                    information_schema.columns
                WHERE
                    table_schema = :schema
                    AND table_name = :table_name
                ORDER BY
                    ordinal_position;"""), {"schema": schema, "table_name": table_name})
            columns = [{"col": row[0], "dtype": row[1]} for row in cursor_data.fetchall()]

        case 'db2':
            cursor_data = cursor.execute(text("""SELECT
                    COLNAME,
                    TYPENAME
                FROM
                    SYSCAT.COLUMNS
                WHERE
                    TABSCHEMA = CURRENT SCHEMA
                    AND TABNAME = :table_name
                ORDER BY
                    COLNO;"""), {"table_name": table_name})
            columns = [{"col": row[0], "dtype": row[1]} for row in cursor_data.fetchall()]

        case 'mongodb':
            columns = _get_mongodb_columns(cursor, table_name)

        case _:
            raise ValueError(f"Unsupported database type: {database_type}")

    return {"tables": table_name, "columns": columns}


def get_table_details(database_type, cursor, schema='public'):
    tables = []
    for table in get_table_names(database_type, cursor, schema):
        tables.append(get_single_table_details(database_type, cursor, table["tables"], schema))
    return tables
