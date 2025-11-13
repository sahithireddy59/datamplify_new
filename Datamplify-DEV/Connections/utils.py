from Service.utils import decode_value 
from sqlalchemy import create_engine
from urllib.parse import quote
from pathlib import Path
from cassandra.auth import PlainTextAuthProvider
from cassandra.cluster import Cluster
from pymongo import MongoClient
from Connections import models as conn_models
from sqlalchemy import text
import pyodbc,os






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
        print(f"🔍 MongoDB connection attempt:")
        print(f"   - Host: {hostname}:{port}")
        print(f"   - Database: {database}")
        print(f"   - Username: {username}")
        print(f"   - Password (encoded): {'*' * len(password) if password else 'None'}")
        
        # Try to decode the password to see the actual value
        try:
            from Service.utils import decode_value
            decoded_password = decode_value(password)
            print(f"   - Password (decoded): {'*' * len(decoded_password) if decoded_password else 'None'}")
            password = decoded_password  # Use decoded password for connection
        except Exception as decode_error:
            print(f"   - Password decode failed: {decode_error}")
            print(f"   - Using password as-is")
        
        if (username=='' or username==None) and (password =='' or password==None):
            print(f"🔍 Connecting without authentication...")
            client = MongoClient(hostname, int(port))
        else:
            # Try different authentication methods (most common MongoDB connection patterns)
            # Also try with URL encoding and without
            from urllib.parse import quote_plus
            encoded_password = quote_plus(password)
            
            auth_methods = [
                # First try without URL encoding (raw password)
                f'mongodb://{username}:{password}@{hostname}:{int(port)}/?authSource=admin',
                f'mongodb://{username}:{password}@{hostname}:{int(port)}/{database}?authSource=admin',
                f'mongodb://{username}:{password}@{hostname}:{int(port)}/{database}?authSource={database}',
                f'mongodb://{username}:{password}@{hostname}:{int(port)}/{database}',
                # Then try with URL encoding
                f'mongodb://{username}:{encoded_password}@{hostname}:{int(port)}/?authSource=admin',
                f'mongodb://{username}:{encoded_password}@{hostname}:{int(port)}/{database}?authSource=admin',
                f'mongodb://{username}:{encoded_password}@{hostname}:{int(port)}/{database}?authSource={database}',
                f'mongodb://{username}:{encoded_password}@{hostname}:{int(port)}/{database}',
            ]
            
            print(f"🔍 Will try {len(auth_methods)} different connection methods")
            
            client = None
            for i, connection_string in enumerate(auth_methods):
                try:
                    auth_source = "admin" if i == 0 else (database if i == 1 else "default")
                    print(f"🔍 Attempt {i+1}: Connecting with authSource={auth_source}...")
                    print(f"🔍 Connection string: mongodb://{username}:***@{hostname}:{int(port)}/{database}?authSource={auth_source if i < 2 else 'default'}")
                    
                    client = MongoClient(connection_string)
                    # Test the connection
                    print(f"🔍 Testing connection with: {connection_string.replace(password, '***')}")
                    result = client.admin.command('ping')
                    print(f"✅ Authentication successful with method {i+1}: {result}")
                    break
                    
                except Exception as auth_error:
                    print(f"❌ Authentication method {i+1} failed: {auth_error}")
                    continue
            
            if not client:
                raise Exception("All authentication methods failed")
        
        db = client[database]
        data = {
            "status":200,
            "engine":db,
            "cursor":None
        }
        return data
    except Exception as e:
        data={
            "status":400,
            "message" : f"{str(e)}"
        }
        return data

from urllib.parse import quote_plus


def server_connection(username, password, database, hostname,port,service_name,parameter,server_path):
    try:
        password1234=quote_plus(decode_value(password))
    except:
        pass
    match str(parameter).upper():
        case "POSTGRESQL":
            url = "postgresql://{}:{}@{}:{}/{}".format(username,password1234,hostname,port,database)
        case "ORACLE":
            url = 'oracle+cx_oracle://{}:{}@{}:{}/{}'.format(username,password1234,hostname,port,service_name)
        case "MYSQL":
            url = f'mysql+mysqlconnector://{username}:{password1234}@{hostname}:{port}/{database}'
        case "SNOWFLAKE":
            encoded_password = quote(password1234)
            url = f'snowflake://{username}:{encoded_password}@{hostname}/{database}?port={port}'
        case "IBMDB2":
            url = f'ibm_db_sa://{username}:{password1234}@{hostname}:{port}/{database}'
        case "MICROSOFTSQLSERVER":
            driver='ODBC Driver 17 for SQL Server'
            # connection_string = f'DRIVER={driver};SERVER={hostname};DATABASE={database};Trusted_Connection=yes;' 
            if (username and password1234 == None) or (username and password1234 == '') or (username and password1234 == ""):
                connection_string = f'DRIVER={{{driver}}};SERVER={hostname};DATABASE={database};Trusted_Connection=yes;' #;UID={username};PWD={password1234}
            else:
                connection_string = f'DRIVER={{{driver}}};SERVER={hostname};DATABASE={database};UID={username};PWD={password1234}'  #;Trusted_Connection=yes;
            conn = pyodbc.connect(connection_string)
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
            mongo=mongo_db(username, password, database, hostname,port)
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
        return {"status":400,"message":"Invalid Credentials"}
    data={
        "status":200,
        "engine":engine,
        "cursor":cursor
    }
    return data




def generate_engine(id,user_id):
        conn_table_id = conn_models.Connections.objects.get(id=id,user_id = user_id).table_id
        database_details = conn_models.DatabaseConnections.objects.get(id=conn_table_id)
        server_type = conn_models.DataSources.objects.get(id=database_details.server_type.id).name
        data = server_connection(database_details.username,database_details.password,database_details.database,database_details.hostname,
                                 database_details.port,database_details.service_name,server_type,database_details.database_path)
        data['schema'] = database_details.schema
        return data
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
            cursor_data = cursor.execute(text("""SELECT
                    TABLE_NAME,
                    LISTAGG(COLUMN_NAME || ':' || DATA_TYPE, ', ') WITHIN GROUP (ORDER BY ORDINAL_POSITION) AS columns
                FROM
                    INFORMATION_SCHEMA.COLUMNS
                WHERE
                    TABLE_SCHEMA = CURRENT_DATABASE()  -- Or specify a schema/database
                    AND TABLE_CATALOG = CURRENT_SCHEMA()
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
            # For MongoDB, cursor is actually a database connection
            # Get list of collections and their sample documents for schema inference
            
            def map_python_to_sql_type(python_type, value, field_name=""):
                """Map Python types to SQL types for better compatibility"""
                if python_type == 'str':
                    # Check if it looks like a date/timestamp
                    if isinstance(value, str):
                        if 'T' in value and ('Z' in value or '+' in value or '-' in value[-6:]):
                            return 'TIMESTAMP'
                        # Check for status/enum-like fields
                        if field_name.lower() in ['status', 'state', 'type', 'category'] and len(value) < 50:
                            return 'VARCHAR(50)'
                        # Check for email
                        if 'email' in field_name.lower() or '@' in value:
                            return 'VARCHAR(255)'
                        # Regular text
                        if len(value) < 100:
                            return 'VARCHAR(255)'
                        else:
                            return 'TEXT'
                    return 'TEXT'
                elif python_type == 'int':
                    return 'INTEGER'
                elif python_type == 'float':
                    return 'DECIMAL'
                elif python_type == 'bool':
                    return 'BOOLEAN'
                elif python_type == 'datetime':
                    return 'TIMESTAMP'
                elif python_type == 'date':
                    return 'DATE'
                elif python_type == 'ObjectId':
                    return 'VARCHAR(24)'  # ObjectId is 24 characters
                else:
                    return 'TEXT'  # Default fallback
            
            def map_to_target_datatype(src_dtype):
                """Map source MongoDB datatype to target PostgreSQL datatype"""
                mapping = {
                    'VARCHAR(24)': 'TEXT',  # ObjectId
                    'VARCHAR(255)': 'VARCHAR(255)',
                    'VARCHAR(50)': 'VARCHAR(50)', 
                    'TEXT': 'TEXT',
                    'INTEGER': 'INTEGER',
                    'DECIMAL': 'DECIMAL',
                    'BOOLEAN': 'BOOLEAN',
                    'TIMESTAMP': 'TIMESTAMP',
                    'DATE': 'DATE',
                    'array': 'JSONB'  # Arrays become JSONB in PostgreSQL
                }
                return mapping.get(src_dtype, 'TEXT')
            
            tables = []
            try:
                print(f"🔍 MongoDB get_table_details: cursor type = {type(cursor)}")
                print(f"🔍 MongoDB cursor object: {cursor}")
                
                db = cursor  # cursor is actually the MongoDB database object
                
                # Debug the database object
                print(f"🔍 Database object type: {type(db)}")
                print(f"🔍 Database object attributes: {dir(db)}")
                print(f"🔍 Has list_collection_names: {hasattr(db, 'list_collection_names')}")
                print(f"🔍 Has collection_names: {hasattr(db, 'collection_names')}")
                
                # Check if db has the required methods
                if not hasattr(db, 'list_collection_names') and not hasattr(db, 'collection_names'):
                    print(f"❌ MongoDB object doesn't have collection listing methods")
                    print(f"❌ Available methods: {[attr for attr in dir(db) if not attr.startswith('_')]}")
                    return []
                
                print(f"🔍 Attempting to list MongoDB collections...")
                
                # Test basic MongoDB connection first
                try:
                    print(f"🔍 Connected to MongoDB database: {db.name}")
                    # Test if we can access the database
                    db_name = db.name
                    print(f"🔍 Connected to MongoDB database: {db_name}")
                    
                    # Test if we can run a simple command
                    server_info = db.client.server_info()
                    print(f"🔍 MongoDB server version: {server_info.get('version', 'unknown')}")
                    
                except Exception as test_error:
                    print(f"❌ Basic MongoDB connection test failed: {test_error}")
                # Get list of collections
                print(f"🔍 Getting collection names...")
                try:
                    collection_names = db.list_collection_names()
                    print(f"🔍 Found {len(collection_names)} collections: {collection_names}")
                except Exception as list_error:
                    print(f"❌ Error listing collections: {list_error}")
                    # Try alternative method
                    try:
                        print(f"🔍 Trying alternative collection listing method...")
                        collection_names = db.collection_names()
                        print(f"🔍 Alternative method found {len(collection_names)} collections: {collection_names}")
                    except Exception as alt_error:
                        print(f"❌ Alternative method also failed: {alt_error}")
                        # Try getting collections manually
                        try:
                            print(f"🔍 Trying manual collection detection...")
                            collections_info = db.command("listCollections")
                            collection_names = [col['name'] for col in collections_info['cursor']['firstBatch']]
                            print(f"🔍 Manual method found {len(collection_names)} collections: {collection_names}")
                        except Exception as manual_error:
                            print(f"❌ Manual method failed: {manual_error}")
                            collection_names = []
                
                if not collection_names:
                    print(f"⚠️ No collections found in MongoDB database")
                    
                    # Try to create a test collection to verify write access
                    try:
                        print(f"🔍 Attempting to create a test collection...")
                        test_collection = db['test_collection']
                        test_collection.insert_one({"test": "data", "created_at": "2025-11-13"})
                        print(f"✅ Test collection created successfully")
                        
                        # Re-list collections
                        collection_names = db.list_collection_names()
                        print(f"🔍 After creating test collection, found: {collection_names}")
                        
                    except Exception as create_error:
                        print(f"❌ Could not create test collection: {create_error}")
                        print(f"❌ This might be a permissions issue")
                    
                    if not collection_names:
                        # Return placeholder if still no collections
                        print(f"❌ Still no collections found after attempting to create test collection")
                        return [{"tables": "No collections found", "columns": [{"col": "_id", "dtype": "ObjectId"}]}]
                
                for collection_name in collection_names:
                    try:
                        print(f"🔍 Processing collection: {collection_name}")
                        collection = db[collection_name]
                        
                        # Get a sample document to infer schema
                        print(f"🔍 Getting sample document from {collection_name}")
                        sample_doc = collection.find_one()
                        print(f"🔍 Sample document: {sample_doc}")
                        
                        columns = []
                        if sample_doc:
                            # Infer schema from sample document including nested fields
                            def flatten_document(doc, prefix=""):
                                fields = []
                                for key, value in doc.items():
                                    if key == '_id':
                                        continue  # Handle _id separately
                                    
                                    field_name = f"{prefix}{key}" if prefix else key
                                    
                                    if isinstance(value, dict):
                                        # Nested object - flatten it and only include the nested fields
                                        print(f"   - Found nested object: {field_name} (flattening...)")
                                        nested_fields = flatten_document(value, f"{field_name}.")
                                        fields.extend(nested_fields)
                                        # Don't add the parent dict object to the fields list
                                    elif isinstance(value, list):
                                        # Array field
                                        fields.append({"col": field_name, "dtype": "array"})
                                        print(f"   - Field: {field_name} (array)")
                                    else:
                                        # Regular field - map Python types to SQL types
                                        python_type = type(value).__name__
                                        sql_type = map_python_to_sql_type(python_type, value, field_name)
                                        fields.append({"col": field_name, "dtype": sql_type})
                                        print(f"   - Field: {field_name} ({python_type} → {sql_type})")
                                
                                return fields
                            
                            columns = flatten_document(sample_doc)
                        else:
                            print(f"⚠️ No documents found in collection {collection_name}")
                        
                        # Add _id field which is always present in MongoDB
                        columns.insert(0, {"col": "_id", "dtype": "VARCHAR(24)"})
                        
                        # Convert to the same format as other databases (column:datatype string)
                        column_strings = []
                        for col in columns:
                            column_strings.append(f"{col['col']}:{col['dtype']}")
                        
                        # Create the same structure as other databases
                        column_string = ','.join(column_strings)
                        print(f"🔍 Column string: {column_string}")
                        
                        # Process the same way as other databases
                        column_list = column_string.split(',')
                        processed_columns = []
                        for col in column_list:
                            col_name = col.split(":")[0].strip()
                            src_dtype = col.split(":")[1].strip()
                            
                            # Map source datatype to target datatype suggestion
                            target_dtype = map_to_target_datatype(src_dtype)
                            
                            processed_columns.append({
                                "col": col_name, 
                                "dtype": src_dtype,  # Source datatype
                                "target_dtype": target_dtype  # Target datatype suggestion
                            })
                            print(f"   - {col_name}: {src_dtype} → {target_dtype}")
                        
                        table_data = {"tables": collection_name, "columns": processed_columns}
                        tables.append(table_data)
                        print(f"✅ Added collection {collection_name} with {len(processed_columns)} columns")
                        print(f"🔍 Final processed columns:")
                        for col in processed_columns:
                            print(f"   - {col['col']}: {col['dtype']}")
                        
                    except Exception as col_error:
                        print(f"❌ Error processing collection {collection_name}: {col_error}")
                        import traceback
                        traceback.print_exc()
                        continue
                
                print(f"🎯 Returning {len(tables)} MongoDB collections: {[t['tables'] for t in tables]}")
                return tables
                
            except Exception as e:
                print(f"❌ Error getting MongoDB collections: {e}")
                import traceback
                traceback.print_exc()
                return []

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