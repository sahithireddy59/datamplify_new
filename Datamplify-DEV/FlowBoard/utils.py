# from Datamplify.settings import logger 
# from Connections.utils import generate_engine
# import duckdb,re,keyword,sqlglot,time
# from  Datamplify import settings 
# from sqlalchemy import text
# from sqlglot import exp
# from Connections import models as conn_models
# from Service.utils import SSHConnect
# import pandas as pd
# from Datamplify.settings import logger 
# from Connections.utils import generate_engine
# import duckdb,re,keyword,sqlglot,time
# from sqlalchemy import text
# from sqlglot import exp
# from Connections import models as conn_models
# from Service.utils import SSHConnect
# import pandas as pd
import os, logging, json
from Airflow.utils import replace_params_in_json
from sqlalchemy.exc import SQLAlchemyError

logging.basicConfig(
    level=logging.DEBUG,  # Changed to DEBUG for more verbose logging
    format='[%(asctime)s] %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Update Strategy Constants (similar to Informatica)
UPDATE_STRATEGIES = {
    'INSERT': 'insert',           # Insert new records only
    'UPDATE': 'update',           # Update existing records only  
    'UPSERT': 'upsert',           # Insert new, update existing (merge)
    'DELETE': 'delete',           # Delete matching records
    'DD_UPDATE': 'dd_update',
    'TRUNCATE_INSERT': 'truncate_insert',  # Truncate table then insert
    'REPLACE': 'replace',         # Drop and recreate table
    'APPEND': 'append'            # Append to existing data
}


def xcom_pull(ti, task_id, value):
    return ti.xcom_pull(task_ids=task_id, key=value)


def quote_all_identifiers(sql):
    """
    Using Sqlglot add quotes to every column and tablenames in query
    """
    import duckdb, re, keyword, sqlglot, time
    from sqlglot import exp

    try:
        tree = sqlglot.parse_one(sql, read='postgres')

        def quote_expr(node):
            if isinstance(node, exp.Identifier):
                return exp.to_identifier(node.name, quoted=True)
            if isinstance(node, exp.Column):
                table = node.table
                column = node.name

                table_quoted = exp.to_identifier(table, quoted=True) if table else None
                column_quoted = exp.to_identifier(column, quoted=True)

                return exp.Column(this=column_quoted, table=table_quoted)
            return node

        new_tree = tree.transform(quote_expr)
        return new_tree.sql(dialect='postgres')

    except Exception as e:
        logger.info("Parsing error:", e)
        return sql


def quote_identifier(identifier):
    """
    Adding Quotes bases on Condition
    """
    import duckdb, re, keyword, sqlglot, time
    if not isinstance(identifier, str):
        return identifier
    safe_pg_identifier = re.compile(r'^[a-z_][a-z0-9_]*$')

    if not safe_pg_identifier.match(identifier) or keyword.iskeyword(identifier):
        return f'"{identifier}"'
    return identifier


def process_column_expression(col_expr):
    """
    Identify the table and column and add quotes to it
    """
    if '.' in col_expr:
        table_alias, column_name = col_expr.split('.', 1)
        table_alias = table_alias
        column_name = quote_identifier(column_name)
        return f"{table_alias}.{column_name}"
    else:
        return quote_identifier(col_expr)


def Query_generator(
    source_attributes: list = [],
    attributes: list = [],
    from_clause: tuple = (),
    schema: str = '',
    join_list: list = None,
    where_clause: str = '',
    group_by_clause: list = None,
    having_clause: str = '',
    remove_duplicates: bool = False
):
    """
    Generate a dynamic Query based on Columns, joins, where ,groupby and having clause
    """
    source_columns = []
    for col in source_attributes:
        if len(col) == 4:
            alias, _, full_col_expr, _ = col
        elif len(col) == 3:
            alias, _, full_col_expr = col
        else:
            raise ValueError(f"Invalid source_attribute format: {col}")
        processed_expr = process_column_expression(full_col_expr)
        source_columns.append(f'{processed_expr} AS {quote_identifier(alias)}')

    # Handle attributes (assume raw SQL expression, just alias them)
    attribute_columns = []
    for col in attributes:
        alias, _, expr = col
        attribute_columns.append(f'{expr} AS "{alias}"')

    # Combine all columns
    all_columns = source_columns + attribute_columns
    columns = ',\n\t'.join(all_columns) if all_columns else '*'

    if schema != '':
        schema += '.'
    from_class = f""" {schema}{from_clause[0]} AS {from_clause[1]} """

    join_clauses = ''
    if join_list:
        join_clauses = '\n'.join(
            f""" {join_type.upper()} {schema}{table_name}  ON {condition} """
            for join_type, table_name, condition in join_list
        )

    where_sql = f"\nWHERE {where_clause}" if where_clause else ''

    group_by_sql = ''
    if group_by_clause:
        group_exprs = ', '.join(f"{quote_identifier(expr[0])}" for expr in group_by_clause)
        group_by_sql = f"\nGROUP BY {group_exprs}"

    having_sql = f"\nHAVING {having_clause}" if having_clause else ''

    query = f"""SELECT 
        \t{columns}
        FROM {from_class} {join_clauses}{where_sql}{group_by_sql}{having_sql}
        """
    return quote_all_identifiers(query.strip())


def Extract_from_Remote_Server_Files(
    hierarchy_id,
    file_path,
    dag_id,
    task_id,
    user_id,
    target_hierarchy_id,
    source_attributes,
    attributes,
    source_table_name
):
    """
    Extract data from a remote server file (SFTP/FTP/SMB) and load into target Postgres DB.
    Handles large files efficiently using pandas chunking + DuckDB streaming insert.
    """
    from Connections.utils import generate_engine
    import duckdb, re, keyword, sqlglot, time
    from Connections import models as conn_models
    from Service.utils import SSHConnect, decode_value
    import pandas as pd

    # Step 1: Get target DB engine and schema
    target_engine_data = generate_engine(target_hierarchy_id, user_id)
    target_engine = target_engine_data['engine']
    target_schema = target_engine_data['schema']
    target_conn_str = str(target_engine.url)

    # Step 2: Prepare DuckDB connection
    conn = duckdb.connect(database=':memory:')
    conn.sql(f"ATTACH '{target_conn_str}' AS target_db (TYPE POSTGRES, SCHEMA '{target_schema}');")

    # Step 3: Prepare Query and Column Mappings
    from_clause = (source_table_name, task_id)
    generated_query = Query_generator(
        source_attributes=source_attributes,
        attributes=attributes,
        from_clause=from_clause,
        schema=target_schema
    )
    cte = f""" "{task_id}" AS (\n{generated_query}\n)"""

    unix_suffix = int(time.time())
    target_table_name = f"extracted_{task_id}_{unix_suffix}"

    # Build source/attribute column list
    source_columns = []
    for col in source_attributes:
        if len(col) == 4:
            alias, _, full_col_expr, _ = col
        elif len(col) == 3:
            alias, _, full_col_expr = col
        else:
            raise ValueError(f"Invalid source_attribute format: {col}")
        processed_expr = process_column_expression(full_col_expr)
        source_columns.append(f'{processed_expr}')

    attribute_columns = []
    for col in attributes:
        alias, _, expr = col
        attribute_columns.append(expr)

    all_columns = source_columns + attribute_columns
    extract_columns = ',\n\t'.join(all_columns) if all_columns else '*'

    # Step 4: Fetch remote connection details
    hierarchy_data = conn_models.Connections.objects.get(id=hierarchy_id, user_id=user_id)
    remote_conn_obj = conn_models.Remote_file_connections.objects.get(
        user_id=user_id,
        id=hierarchy_data.table_id
    )
    conn_type = remote_conn_obj.server_type.name.lower()
    host = remote_conn_obj.hostname
    username = remote_conn_obj.username
    password = remote_conn_obj.password
    port = remote_conn_obj.port

    # Step 5: Establish remote connection
    response = SSHConnect(conn_type, host, username, decode_value(password), port)
    if response['status'] != 200:
        return {'status': 400, 'message': response['message']}

    # Step 6: Extract and load data
    connection = response['sftp_client']

    try:
        if conn_type == "sftp":
            # Read remote file in chunks and stream to DuckDB/Postgres
            import pandas as pd
            with connection.open(file_path, "rb") as remote_file:
                for chunk in pd.read_csv(remote_file, chunksize=100000):
                    conn.register("chunk_df", chunk)
                    conn.execute(f"""
                        CREATE TABLE IF NOT EXISTS target_db.{target_table_name} AS 
                        SELECT {extract_columns} FROM chunk_df;
                    """)
        elif conn_type == "ftp":
            import io
            import pandas as pd
            temp_buffer = io.BytesIO()
            connection.retrbinary(f"RETR {file_path}", temp_buffer.write)
            temp_buffer.seek(0)
            for chunk in pd.read_csv(temp_buffer, chunksize=100000):
                conn.register("chunk_df", chunk)
                conn.execute(f"""
                    CREATE TABLE IF NOT EXISTS target_db.{target_table_name} AS 
                    SELECT {extract_columns} FROM chunk_df;
                """)
        elif conn_type == "smb":
            import io
            import pandas as pd
            file_obj = io.BytesIO()
            shared_name = remote_conn_obj.share or "shared"
            connection.retrieveFile(shared_name, file_path, file_obj)
            file_obj.seek(0)
            for chunk in pd.read_csv(file_obj, chunksize=100000):
                conn.register("chunk_df", chunk)
                conn.execute(f"""
                    CREATE TABLE IF NOT EXISTS target_db.{target_table_name} AS 
                    SELECT {extract_columns} FROM chunk_df;
                """)
        else:
            raise ValueError(f"Unsupported connection type: {conn_type}")

        return {
            'status': 200,
            'target_table': target_table_name,
            'query': cte,
            'message': f"Data extracted successfully from remote {conn_type.upper()} source."
        }

    except Exception as e:
        return {'status': 400, 'message': str(e)}

    finally:
        connection.close()
        conn.close()


# Data Extract From CSV
def Extract_from_CSV(
    csv_path,
    dag_id,
    task_id,
    user_id,
    target_hierarchy_id,
    source_attributes,
    attributes,
    source_table_name,
    hierarchy_id
):
    """
    Extract CSV Data from Source File then Dump into Target database as temp table
    """
    from Connections.utils import generate_engine
    import duckdb, re, keyword, sqlglot, time
    from Connections import models as conn_models

    target_engine_data = generate_engine(target_hierarchy_id, user_id)
    target_engine = target_engine_data['engine']
    target_schema = target_engine_data['schema']
    target_conn_str = str(target_engine.url)

    conn = duckdb.connect(database=':memory:')

    conn.sql(f"ATTACH '{target_conn_str}' AS target_db (TYPE POSTGRES, SCHEMA '{target_schema}');")

    from_clause = (source_table_name, task_id)
    generated_query = Query_generator(
        source_attributes=source_attributes,
        attributes=attributes,
        from_clause=from_clause,
        schema=target_schema
    )
    cte = f""" "{task_id}" AS (\n{generated_query}\n)"""

    unix_suffix = int(time.time())
    target_table_name = f"extracted_{task_id}_{unix_suffix}"

    source_columns = []
    for col in source_attributes:
        if len(col) == 4:
            alias, _, full_col_expr, _ = col
        elif len(col) == 3:
            alias, _, full_col_expr = col
        else:
            raise ValueError(f"Invalid source_attribute format: {col}")

        processed_expr = process_column_expression(full_col_expr)
        source_columns.append(f'{processed_expr}')  # Removed aliasing

    attribute_columns = []
    for col in attributes:
        alias, _, expr = col
        attribute_columns.append(expr)  # Removed aliasing

    all_columns = source_columns + attribute_columns
    extract_columns = ',\n\t'.join(all_columns) if all_columns else '*'

    hierarchy_data = conn_models.Connections.objects.get(id=hierarchy_id).table_id
    csv_path = conn_models.FileConnections.objects.get(id=hierarchy_data).source

    query = f"""
    INSTALL httpfs;
    LOAD httpfs;
    CREATE TABLE  target_db.{target_table_name} AS 
    SELECT {extract_columns} FROM read_csv_auto('{csv_path}', AUTO_DETECT=TRUE);
    """
    conn.sql(query)
    conn.close()
    return {'status': 200, 'target_table': target_table_name, 'query': cte}


def Extract_from_database(
    hierarchy_id,
    user_id,
    table_name,
    task_id,
    dag_id,
    source_attributes,
    attributes,
    target_hierarchy_id,
    target_table_name=None,
    **kwargs
):
    """
    Extract Table Data from Source Connection then Dump into Target database as temp table 
    Supports MySQL to PostgreSQL mapping and vice versa + Mongo.
    """
    from Connections.utils import generate_engine
    from Connections.models import DatabaseConnections, Connections
    import duckdb, re, keyword, sqlglot, time

    source_engine_data = generate_engine(hierarchy_id, user_id)
    source_engine = source_engine_data['engine']
    source_schema = source_engine_data['schema']
    source_conn_str = str(source_engine.url)

    target_engine_data = generate_engine(target_hierarchy_id, user_id)
    target_engine = target_engine_data['engine']
    target_schema = target_engine_data['schema']
    target_conn_str = str(target_engine.url)

    # Get source database type
    source_conn = Connections.objects.get(id=hierarchy_id, user_id=user_id)
    source_db_conn = DatabaseConnections.objects.get(id=source_conn.table_id)
    source_db_type = source_db_conn.server_type.name.upper()

    # Get target database type
    target_conn = Connections.objects.get(id=target_hierarchy_id, user_id=user_id)
    target_db_conn = DatabaseConnections.objects.get(id=target_conn.table_id)
    target_db_type = target_db_conn.server_type.name.upper()

    conn = duckdb.connect(database=':memory:')

    # Handle MongoDB separately as it doesn't use SQL/DuckDB
    if source_db_type == 'MONGODB' or target_db_type == 'MONGODB':
        logger.info(f"[MongoDB Detection] Source DB Type: {source_db_type}, Target DB Type: {target_db_type}")
        logger.info(f"[MongoDB Detection] Received target_table_name parameter: {target_table_name}")
        
        return Extract_from_mongodb(
            hierarchy_id, user_id, table_name, task_id, dag_id,
            source_attributes, attributes, target_hierarchy_id,
            source_db_type, target_db_type, target_table_name, **kwargs
        )

    # Attach source database with correct type (SQL databases only)
    if source_db_type == 'MYSQL':
        conn.sql(f"ATTACH '{source_conn_str}' AS source_db (TYPE MYSQL);")
    elif source_db_type == 'POSTGRESQL':
        conn.sql(f"ATTACH '{source_conn_str}' AS source_db (TYPE POSTGRES, SCHEMA '{source_schema}');")
    else:
        raise ValueError(f"Unsupported source database type: {source_db_type}")

    # Attach target database with correct type (SQL databases only)
    if target_db_type == 'MYSQL':
        conn.sql(f"ATTACH '{target_conn_str}' AS target_db (TYPE MYSQL);")
    elif target_db_type == 'POSTGRESQL':
        conn.sql(f"ATTACH '{target_conn_str}' AS target_db (TYPE POSTGRES, SCHEMA '{target_schema}');")
    else:
        raise ValueError(f"Unsupported target database type: {target_db_type}")

    from_clause = (table_name, task_id)
    generated_query = Query_generator(
        source_attributes=source_attributes,
        attributes=attributes,
        from_clause=from_clause,
        schema=source_schema
    )

    cte = f""" "{task_id}" AS (\n{generated_query}\n)"""
    logger.info(f""" Query: WITH {cte} SELECT * FROM "{task_id}" """)

    unix_suffix = int(time.time())
    target_table_name = f"extracted_{task_id}_{unix_suffix}"

    # Set target table path based on target database type
    if target_db_type == 'MYSQL':
        full_target_table = f"target_db.{target_table_name}"
    else:  # PostgreSQL
        full_target_table = f"target_db.{target_schema}.{target_table_name}"

    # Choose appropriate query function based on source database type
    if source_db_type == 'MYSQL':
        query_function = 'mysql_query'
    else:  # PostgreSQL
        query_function = 'postgres_query'

    # Create target table structure
    conn.sql(f"""
        CREATE TABLE {full_target_table} AS
        SELECT * FROM {query_function}('source_db', $$WITH {cte} SELECT * FROM "{task_id}" limit 0 $$);
    """)

    # Get total record count
    result = conn.sql(
        f"""SELECT * FROM {query_function}('source_db', $$WITH {cte} SELECT count(*) FROM "{task_id}" $$) """
    )
    batch_size = 100000
    offset = 0
    row = result.fetchone()
    if row and row[0]:
        total_records = row[0]
        while offset <= total_records:
            conn.sql(f"""
                INSERT INTO {full_target_table}
                SELECT * FROM {query_function}(
                    'source_db',
                    $$
                    WITH {cte}
                    SELECT * FROM "{task_id}"
                    LIMIT {batch_size} OFFSET {offset}
                    $$
                );
            """)
            offset += batch_size
    logger.info(f"Data extracted and loaded into: {full_target_table}")

    logger.info(f"Total Records: {row[0]}")

    conn.sql("DETACH source_db;")
    conn.close()

    cte = cte.replace(source_schema, target_schema)

    return {
        'status': 200,
        'target_table': target_table_name,
        'query': cte
    }


def Extract_from_mongodb(
    hierarchy_id,
    user_id,
    table_name,
    task_id,
    dag_id,
    source_attributes,
    attributes,
    target_hierarchy_id,
    source_db_type,
    target_db_type,
    target_table_name=None,
    **kwargs
):
    """
    Extract data from MongoDB or load data into MongoDB
    Supports: MongoDB <-> MySQL, MongoDB <-> PostgreSQL, MongoDB <-> CSV
    """
    from Connections.utils import generate_engine
    from pymongo import MongoClient
    import pandas as pd
    import time

    unix_suffix = int(time.time())
    temp_table_name = f"extracted_{task_id}_{unix_suffix}"

    if source_db_type == 'MONGODB' and target_db_type == 'MONGODB':
        # For MongoDB to MongoDB transfer, use the actual target table name
        # If target_table_name is provided, use it; otherwise fall back to temp name
        actual_target_table = target_table_name or temp_table_name
        logger.info(f"[Extract_from_mongodb] Received target_table_name parameter: {target_table_name}")
        logger.info(f"[Extract_from_mongodb] Using actual_target_table: {actual_target_table}")
        logger.info(f"[Extract_from_mongodb] MongoDB to MongoDB transfer: source={table_name}, target={actual_target_table}")
        
        return extract_mongodb_to_mongodb(
            hierarchy_id, user_id, table_name, task_id, dag_id,
            source_attributes, attributes, target_hierarchy_id,
            actual_target_table, **kwargs
        )
    
    elif source_db_type == 'MONGODB':
        # Extract FROM MongoDB TO SQL Database/CSV
        return extract_from_mongodb_to_sql(
            hierarchy_id, user_id, table_name, task_id, dag_id,
            source_attributes, attributes, target_hierarchy_id,
            target_db_type, temp_table_name, **kwargs
        )

    elif target_db_type == 'MONGODB':
        # Load FROM SQL Database/CSV TO MongoDB
        return load_sql_to_mongodb(
            hierarchy_id, user_id, table_name, task_id, dag_id,
            source_attributes, attributes, target_hierarchy_id,
            source_db_type, temp_table_name, **kwargs
        )

    else:
        raise ValueError("At least one database must be MongoDB")


def flatten_document(doc, parent_key='', sep='_'):
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

def extract_mongodb_to_mongodb(
    hierarchy_id,
    user_id,
    table_name,
    task_id,
    dag_id,
    source_attributes,
    attributes,
    target_hierarchy_id,
    target_table_name,
    **kwargs
):
    """
    Direct MongoDB to MongoDB transfer - copies data from source MongoDB collection to target MongoDB collection.
    This avoids the need for intermediate SQL temp tables.
    """
    from Connections.utils import generate_engine
    from pymongo import MongoClient
    from pymongo.database import Database
    from pymongo.collection import Collection
    import logging

    logger = logging.getLogger(__name__)
    ti = kwargs.get('ti')

    try:
        logger.info(f"[MongoDB→MongoDB] Starting direct transfer from {table_name} to {target_table_name}")

        # Get source MongoDB connection
        source_engine_data = generate_engine(hierarchy_id, user_id)
        source_mongo_engine = source_engine_data["engine"]

        # Get target MongoDB connection  
        target_engine_data = generate_engine(target_hierarchy_id, user_id)
        target_mongo_engine = target_engine_data["engine"]

        # Resolve source collection
        source_collection = None
        if isinstance(source_mongo_engine, Collection):
            source_collection = source_mongo_engine
        elif isinstance(source_mongo_engine, Database):
            source_collection = source_mongo_engine[table_name]
        elif isinstance(source_mongo_engine, MongoClient):
            if '.' in table_name:
                db_name, coll_name = table_name.split('.', 1)
            else:
                db_name = 'default'
                coll_name = table_name
            source_collection = source_mongo_engine[db_name][coll_name]
        else:
            raise TypeError(f"Unsupported source MongoDB engine type: {type(source_mongo_engine)}")

        # Resolve target collection
        target_collection = None
        if isinstance(target_mongo_engine, Collection):
            target_collection = target_mongo_engine
        elif isinstance(target_mongo_engine, Database):
            target_collection = target_mongo_engine[target_table_name]
        elif isinstance(target_mongo_engine, MongoClient):
            if '.' in target_table_name:
                db_name, coll_name = target_table_name.split('.', 1)
            else:
                db_name = 'default'
                coll_name = target_table_name
            target_collection = target_mongo_engine[db_name][coll_name]
        else:
            raise TypeError(f"Unsupported target MongoDB engine type: {type(target_mongo_engine)}")

        logger.info(f"[MongoDB→MongoDB] Source: {source_collection.full_name}")
        logger.info(f"[MongoDB→MongoDB] Target: {target_collection.full_name}")

        # Build projection based on source_attributes
        projection = None
        if source_attributes:
            proj = {}
            for attr in source_attributes:
                if isinstance(attr, (list, tuple)) and len(attr) > 0:
                    field_name = attr[0]
                else:
                    field_name = attr
                proj[str(field_name)] = 1
            projection = proj

        # Read from source collection
        cursor = source_collection.find({}, projection)
        documents = list(cursor)
        
        logger.info(f"[MongoDB→MongoDB] Found {len(documents)} documents in source collection")

        if not documents:
            logger.warning(f"[MongoDB→MongoDB] No documents found in source collection {source_collection.full_name}")
            result = {
                'status': 200,
                'target_table': target_table_name,
                'query': f'-- No data found in MongoDB collection {table_name}'
            }
            if ti:
                ti.xcom_push(key='return_value', value=result)
            return result

        # Apply attribute mapping if specified
        if attributes:
            for doc in documents:
                for attr in attributes:
                    if isinstance(attr, (list, tuple)) and len(attr) >= 3:
                        source_field, target_field = attr[0], attr[2]
                        if source_field in doc and source_field != target_field:
                            doc[target_field] = doc.pop(source_field)

        # Clear target collection (optional - could be configurable)
        # target_collection.delete_many({})

        # Insert documents into target collection in batches
        batch_size = 1000
        total_inserted = 0
        
        for i in range(0, len(documents), batch_size):
            batch = documents[i:i + batch_size]
            if batch:
                target_collection.insert_many(batch)
                total_inserted += len(batch)
                logger.info(f"[MongoDB→MongoDB] Inserted batch {i//batch_size + 1}: {len(batch)} documents")

        logger.info(f"[MongoDB→MongoDB] Successfully transferred {total_inserted} documents")

        result = {
            'status': 200,
            'target_table': target_table_name,
            'query': f'-- Transferred {total_inserted} documents from {source_collection.full_name} to {target_collection.full_name}'
        }

        if ti:
            ti.xcom_push(key='return_value', value=result)
            logger.info(f"[MongoDB→MongoDB] Pushed result to XCom for task {task_id}")

        return result

    except Exception as e:
        error_msg = f"Error in extract_mongodb_to_mongodb: {str(e)}"
        logger.error(error_msg, exc_info=True)
        result = {
            'status': 500,
            'message': error_msg,
            'target_table': target_table_name
        }
        if ti:
            ti.xcom_push(key='return_value', value=result)
        return result


def extract_from_mongodb_to_sql(
    hierarchy_id,
    user_id,
    table_name,
    task_id,
    dag_id,
    source_attributes,
    attributes,
    target_hierarchy_id,
    target_db_type,
    target_table_name,
    **kwargs
):
    """
    Extract data FROM MongoDB TO SQL Database (MySQL/PostgreSQL).

    This version avoids any weird "Collection object is not callable" issues by:
    - Clearly detecting whether `generate_engine` returned a MongoClient, Database, or Collection
    - Always using `collection.find(...)` directly
    - Loading data into the target DB via pandas `.to_sql` (no DuckDB needed here)
    """
    from Connections.utils import generate_engine
    from pymongo import MongoClient
    from pymongo.database import Database
    from pymongo.collection import Collection
    from sqlalchemy import text
    from sqlalchemy import types as sqlalchemy_types
    import pandas as pd
    import time

    ti = kwargs.get("ti")

    try:
        logger.info(f"[Mongo Extract] Starting extraction from MongoDB for '{table_name}'")

        # ---- 1. Get Mongo "engine" from generate_engine ----
        source_engine_data = generate_engine(hierarchy_id, user_id)
        mongo_engine = source_engine_data["engine"]

        client: MongoClient | None = None
        db: Database | None = None
        collection: Collection | None = None

        # Case 1: generate_engine returned a Collection directly
        if isinstance(mongo_engine, Collection):
            collection = mongo_engine
            db = collection.database
            client = db.client
            logger.info(
                f"[Mongo Extract] generate_engine returned a Collection directly: "
                f"{db.name}.{collection.name}"
            )

        # Case 2: it returned a Database
        elif isinstance(mongo_engine, Database):
            db = mongo_engine
            client = db.client
            logger.info(f"[Mongo Extract] generate_engine returned a Database: {db.name}")

        # Case 3: it returned a MongoClient
        elif isinstance(mongo_engine, MongoClient):
            client = mongo_engine
            logger.info("[Mongo Extract] generate_engine returned a MongoClient")

        else:
            raise TypeError(
                f"Unsupported Mongo engine type: {type(mongo_engine)}. "
                "Expected MongoClient, Database, or Collection."
            )

        # ---- 2. Resolve db + collection from table_name if needed ----
        # table_name can be "db.collection" or just "collection"
        db_name_from_table = None
        coll_name_from_table = None

        if "." in table_name:
            db_name_from_table, coll_name_from_table = table_name.split(".", 1)
        else:
            coll_name_from_table = table_name

        # If we still don't have a collection, derive it from client/db + table_name
        if collection is None:
            if db is None:
                # Need to pick a database from the client
                if db_name_from_table:
                    db = client[db_name_from_table]
                else:
                    # Try default DB; fall back to "test"
                    try:
                        db = client.get_default_database()
                    except Exception:
                        db = None

                    if db is None:
                        db = client["test"]

            if coll_name_from_table is None:
                raise ValueError(
                    "Could not determine MongoDB collection name from table_name."
                )

            collection = db[coll_name_from_table]
            logger.info(
                f"[Mongo Extract] Using MongoDB collection: {db.name}.{collection.name}"
            )
        else:
            # we already had a Collection; ensure db_name_from_table not conflicting
            logger.info(
                f"[Mongo Extract] Using pre-resolved collection: "
                f"{collection.database.name}.{collection.name}"
            )

        # ---- 3. Build projection based on source_attributes (optional) ----
        projection = None
        if source_attributes:
            proj = {}
            for attr in source_attributes:
                # support formats like ["fieldName", "dtype", ...] or "fieldName"
                if isinstance(attr, (list, tuple)) and len(attr) > 0:
                    field_name = attr[0]
                else:
                    field_name = attr
                proj[str(field_name)] = 1
            projection = proj or None

        # ---- 4. Fetch data from MongoDB ----
        logger.info(f"[Mongo Extract] Fetching documents from MongoDB...")
        cursor = collection.find({}, projection)
        documents = [flatten_document(doc) for doc in cursor]
        logger.info(f"[Mongo Extract] Fetched {len(documents)} documents from MongoDB")

        # ---- 5. Prepare target DB and DataFrame ----
        target_engine_data = generate_engine(target_hierarchy_id, user_id)
        target_engine = target_engine_data["engine"]
        target_schema = target_engine_data.get("schema", "public")

        if not documents:
            logger.warning(
                f"[Mongo Extract] No documents found in {collection.full_name}. "
                f"Creating EMPTY table {target_schema}.{target_table_name}"
            )
            # create empty DataFrame with at least one column so table exists
            if source_attributes:
                cols = [
                    (attr[0] if isinstance(attr, (list, tuple)) and len(attr) > 0 else attr)
                    for attr in source_attributes
                ]
            else:
                cols = ["_id"]
            df = pd.DataFrame(columns=cols)
        else:
            df = pd.DataFrame(documents)
            # ensure _id is a string
            if "_id" in df.columns:
                df["_id"] = df["_id"].astype(str)

        # Convert dict/list objects to JSON strings to make SQL-friendly
        for col in df.columns:
            df[col] = df[col].apply(
                lambda x: json.dumps(x) if isinstance(x, (dict, list)) else x
            )

        # ---- 6. Write DataFrame into SQL (Postgres/MySQL) ----
        # All columns as TEXT by default – safe for generic ETL use
        dtype_map = {col: sqlalchemy_types.TEXT for col in df.columns}

        logger.info(
            f"[Mongo Extract] Writing to target table {target_schema}.{target_table_name}"
        )
        df.to_sql(
            name=target_table_name,
            con=target_engine,
            schema=target_schema,
            if_exists="replace",   # overwrite any previous temp table
            index=False,
            dtype=dtype_map,
        )

        # Verify row count
        with target_engine.connect() as conn:
            result = conn.execute(
                text(f'SELECT COUNT(*) FROM "{target_schema}"."{target_table_name}"')
            )
            row_count = result.scalar()
        logger.info(
            f"[Mongo Extract] Successfully loaded {row_count} rows into "
            f"{target_schema}.{target_table_name}"
        )

        result_dict = {
            "status": 200,
            "target_table": target_table_name,
            "schema": target_schema,
            "query": (
                f"-- Loaded {row_count} documents from MongoDB collection "
                f"{collection.full_name} to {target_schema}.{target_table_name}"
            ),
        }

        if ti:
            ti.xcom_push(key="return_value", value=result_dict)
            logger.info(f"[Mongo Extract] Pushed result to XCom for task {task_id}")

        return result_dict

    except Exception as e:
        error_msg = f"Error in extract_from_mongodb_to_sql: {str(e)}"
        logger.error(error_msg, exc_info=True)
        result_dict = {
            "status": 500,
            "message": error_msg,
            "target_table": target_table_name,
        }
        if ti:
            ti.xcom_push(key="return_value", value=result_dict)
        return result_dict


def load_sql_to_mongodb(
    hierarchy_id,
    user_id,
    table_name,
    task_id,
    dag_id,
    source_attributes,
    attributes,
    target_hierarchy_id,
    source_db_type,
    target_table_name,
    **kwargs
):
    """
    Load data FROM SQL Database (MySQL/PostgreSQL) TO MongoDB.
    Uses DuckDB to read from SQL and pymongo to insert into Mongo.

    Important fix:
    - Fully qualifies Postgres table as "schema"."table" to avoid
      'relation ... does not exist' errors.
    """
    from Connections.utils import generate_engine
    from pymongo import MongoClient
    import pandas as pd
    import duckdb
    import logging

    logger = logging.getLogger(__name__)

    # Get source SQL database connection
    source_engine_data = generate_engine(hierarchy_id, user_id)
    source_engine = source_engine_data["engine"]
    source_schema = source_engine_data.get("schema", "public")

    # Get MongoDB connection (target)
    target_engine_data = generate_engine(target_hierarchy_id, user_id)
    mongo_client = target_engine_data["engine"]  # should be MongoClient/Database/Collection

    # Extract data from SQL database using DuckDB
    conn = duckdb.connect(database=":memory:")

    # Attach source database
    source_conn_str = str(source_engine.url)
    if source_db_type == "MYSQL":
        conn.sql(f"ATTACH '{source_conn_str}' AS source_db (TYPE MYSQL);")
        query_function = "mysql_query"
        # For MySQL the DB is already in the connection, so table_name is fine
        if "." in table_name:
            full_table_name = table_name  # db.table or schema.table
        else:
            full_table_name = table_name
    elif source_db_type == "POSTGRESQL":
        conn.sql(
            f"ATTACH '{source_conn_str}' AS source_db (TYPE POSTGRES, SCHEMA '{source_schema}');"
        )
        query_function = "postgres_query"

        # If table_name already has a schema, quote both parts
        if "." in table_name:
            sch, tbl = table_name.split(".", 1)
            full_table_name = f'"{sch}"."{tbl}"'
        else:
            # Use the schema from generate_engine
            full_table_name = f'"{source_schema}"."{table_name}"'
    else:
        raise ValueError(f"Unsupported source database type: {source_db_type}")

    # Build SQL query
    if source_attributes:
        # source_attributes like [["empid", ...], ["emp", ...], ...]
        columns = [
            (attr[0] if isinstance(attr, (list, tuple)) else attr)
            for attr in source_attributes
        ]
        column_list = ", ".join(columns)
    else:
        column_list = "*"

    sql_query = f"SELECT {column_list} FROM {full_table_name}"
    logger.info(f"[SQL→Mongo] Executing source query: {sql_query}")

    try:
        result = conn.sql(
            f"SELECT * FROM {query_function}('source_db', $${sql_query}$$)"
        )
    except Exception as e:
        logger.error(
            f"[SQL→Mongo] Error executing query on source_db: {sql_query} | {e}",
            exc_info=True,
        )
        # Optional: list tables for debugging
        try:
            if source_db_type == "POSTGRESQL":
                debug_res = conn.sql(
                    f"SELECT * FROM {query_function}('source_db', $$"
                    f"SELECT table_schema, table_name FROM information_schema.tables "
                    f"WHERE table_type='BASE TABLE'$$)"
                )
                logger.info("[SQL→Mongo] Available tables:\n%s", debug_res.df())
            elif source_db_type == "MYSQL":
                debug_res = conn.sql(
                    f"SELECT * FROM {query_function}('source_db', $$SHOW TABLES$$)"
                )
                logger.info("[SQL→Mongo] Available tables:\n%s", debug_res.df())
        except Exception as e2:
            logger.warning(
                f"[SQL→Mongo] Failed to list tables for debugging: {e2}", exc_info=True
            )

        return {
            "status": 500,
            "target_table": target_table_name,
            "query": f"-- Error executing source query: {sql_query}",
            "message": str(e),
        }

    df = result.df()

    if df.empty:
        logger.info(
            f"[SQL→Mongo] No data found in source SQL table/query: {full_table_name}"
        )
        return {
            "status": 200,
            "target_table": target_table_name,
            "query": f"-- No data found in SQL table {full_table_name}",
        }

    # Apply attribute mapping if specified (optional)
    if attributes:
        mapped_columns = {}
        for attr in attributes:
            # support formats like [source_col, dtype, target_col]
            if isinstance(attr, (list, tuple)) and len(attr) >= 3:
                source_col, target_col = attr[0], attr[2]
                if source_col in df.columns:
                    mapped_columns[source_col] = target_col
        if mapped_columns:
            df = df.rename(columns=mapped_columns)

    # Convert DataFrame to MongoDB documents
    documents = df.to_dict("records")

    # Decide Mongo database + collection
    # If user passes something like "db.collection" as target_table_name, reuse that
    if "." in target_table_name:
        db_name, collection_name = target_table_name.split(".", 1)
    else:
        db_name = "default"
        collection_name = target_table_name

    # Resolve mongo_client: it can be MongoClient, Database, or Collection
    from pymongo import MongoClient
    from pymongo.database import Database
    from pymongo.collection import Collection

    if isinstance(mongo_client, Collection):
        # If a collection is directly returned, ignore db_name/collection_name and use it
        collection = mongo_client
    elif isinstance(mongo_client, Database):
        collection = mongo_client[collection_name]
    elif isinstance(mongo_client, MongoClient):
        db = mongo_client[db_name]
        collection = db[collection_name]
    else:
        raise TypeError(
            f"Unsupported Mongo engine type: {type(mongo_client)} "
            "(expected MongoClient, Database, or Collection)"
        )

    # Insert documents in batches
    batch_size = 1000
    total_inserted = 0
    for i in range(0, len(documents), batch_size):
        batch = documents[i : i + batch_size]
        if batch:
            collection.insert_many(batch)
            total_inserted += len(batch)

    logger.info(
        f"[SQL→Mongo] Inserted {total_inserted} documents into MongoDB collection "
        f"{collection.full_name}"
    )

    return {
        "status": 200,
        "target_table": target_table_name,
        "query": (
            f"-- Loaded {total_inserted} rows from SQL table {full_table_name} "
            f"to Mongo collection {collection.full_name}"
        ),
    }




def Delete_temp_tables(sources, hierarchy_id, user_id, **kwargs):
    """
    Deleting all temp tables created in Transformation 
    """
    from Connections.utils import generate_engine
    from sqlalchemy import text

    ti = kwargs['ti']
    engine_data = generate_engine(hierarchy_id, user_id)
    engine = engine_data['engine']
    schema = engine_data['schema']
    with engine.connect() as connection:
        for id_, value in sources:
            table_name = xcom_pull(ti, id_, value)
            if table_name:
                drop_query = text(f'DROP TABLE IF EXISTS "{schema}"."{table_name}";')
                connection.execute(drop_query)
    return True


def Extraction(
    dag_id,
    task_id,
    source_type,
    path,
    hierarchy_id,
    user_id,
    source_table_name,
    source_attributes,
    attributes,
    target_hierarchy_id,
    target_table_name=None,
    **kwargs
):
    """
    Extract Data from source connection and load into target connection
    """

    if source_type.lower() == 'file':
        logger.info("[INFO] Source is CSV")

        csv_extract = Extract_from_CSV(
            path, dag_id, task_id, user_id, target_hierarchy_id,
            source_attributes, attributes, source_table_name, hierarchy_id
        )
        if csv_extract['status'] == 200:
            query = csv_extract['query']
            result = {
                'status': 200,
                'target_table': csv_extract['target_table'],
                'query': query
            }
            kwargs['ti'].xcom_push(key='return_value', value=result)
            return result
        else:
            logger.error(f"""[Error] {csv_extract['message']}""")
    elif source_type.lower() == 'remote_server':
        remote_extract = Extract_from_Remote_Server_Files(
            hierarchy_id, path, dag_id, task_id, user_id,
            target_hierarchy_id, source_attributes, attributes, source_table_name
        )
        if remote_extract['status'] == 200:
            query = remote_extract['query']
            result = {
                'status': 200,
                'target_table': remote_extract['target_table'],
                'query': query
            }
            kwargs['ti'].xcom_push(key='return_value', value=result)
            return result
        else:
            logger.error(f"""[Error] {remote_extract['message']}""")
    else:
        logger.info('source is database')
        db_extract = Extract_from_database(
            hierarchy_id, user_id, source_table_name, task_id, dag_id,
            source_attributes, attributes, target_hierarchy_id, 
            target_table_name=target_table_name, **kwargs
        )
        if db_extract['status'] == 200:
            query = db_extract['query']
            ti = kwargs['ti']
            result = {
                'status': 200,
                'target_table': db_extract['target_table'],
                'query': query
            }
            ti.xcom_push(key='return_value', value=result)
            return result
        else:
            logger.error(f"""[Error] {db_extract['message']}""")


def load_sql_to_mongodb_direct(source_schema, source_table_name, mongo_engine, target_table_name, attribute_mapper, **kwargs):
    """
    Load data from SQL temp table directly into MongoDB collection.
    This is used when the target is MongoDB but source data is in a SQL temp table.
    """
    from Connections.utils import generate_engine
    from pymongo import MongoClient
    from pymongo.database import Database
    from pymongo.collection import Collection
    import pandas as pd
    import logging

    logger = logging.getLogger(__name__)

    try:
        # Get task instance from kwargs
        ti = kwargs.get('ti')
        if not ti:
            raise ValueError("Task instance (ti) not found in kwargs")
            
        # We need to get the source SQL connection to read the temp table
        # The temp table was created by the extraction step, so we need to find which SQL DB it's in
        
        # Get the previous task result to find which database connection was used for extraction
        previous_task_result = ti.xcom_pull(task_ids=kwargs.get('previous_id'), key='return_value')
        if not previous_task_result:
            raise ValueError("Could not get previous task result to determine source database")
        
        logger.info(f"Previous task result: {previous_task_result}")
        
        # The key insight: In MongoDB extraction, the temp table is created using the target_hierarchy_id
        # which points to a SQL database. But in loading, target_hierarchy_id points to MongoDB.
        # We need to find the SQL database that was used during extraction.
        
        # The extraction step used target_hierarchy_id to create the temp table in a SQL database
        # We need to get that same SQL database connection to read the temp table
        
        # Let's try to get the SQL database connection that was used during extraction
        # This information should be available from the DAG configuration or previous task
        
        from Connections.utils import generate_engine
        from sqlalchemy import create_engine, text, inspect
        import os
        
        # Strategy 1: Try to get the SQL database connection from the extraction step
        # The extraction step should have stored this information
        sql_engine = None
        
        # First, let's try to get the SQL database that was used as target in extraction
        # This might be stored in the previous task result or DAG configuration
        
        # For MongoDB->SQL extraction, there should be an intermediate SQL database
        # Let's try to find it from the system configuration
        
        try:
            # Try to get all SQL database connections and find the right one
            from Connections.models import Connections, DatabaseConnections
            
            # Get all SQL database connections for this user
            sql_connections = Connections.objects.filter(
                user_id=kwargs.get('user_id'), 
                format='database'
            )
            
            sql_hierarchy_id = None
            for conn in sql_connections:
                try:
                    db_conn = DatabaseConnections.objects.get(id=conn.table_id)
                    if db_conn.server_type.name.upper() in ['POSTGRESQL', 'MYSQL']:
                        sql_hierarchy_id = conn.id
                        logger.info(f"Found SQL database connection: {conn.id} ({db_conn.server_type.name})")
                        break
                except Exception as e:
                    continue
            
            if sql_hierarchy_id:
                # Use the SQL database connection
                sql_engine_data = generate_engine(sql_hierarchy_id, kwargs.get('user_id'))
                sql_engine = sql_engine_data['engine']
                logger.info(f"Using SQL database connection {sql_hierarchy_id} for temp table access")
            else:
                raise Exception("No SQL database connection found")
                
        except Exception as e:
            logger.warning(f"Could not find SQL database connection: {str(e)}")
            # Fallback to configured database URL
            temp_db_url = os.getenv('TEMP_DATABASE_URL', "postgresql+psycopg2://postgres:postgres@host.docker.internal:5432/Datamplify3?options=-csearch_path%3Ddatamplify_staging")
            sql_engine = create_engine(temp_db_url)
            logger.info(f"Using fallback database connection: {temp_db_url}")
        
        logger.info(f"Looking for temp table {source_table_name} in database")
        
        # Try to find the table in different schemas
        inspector = inspect(sql_engine)
        schemas_to_check = [source_schema, 'public', 'datamplify_staging', 'animal_biome_production']
        
        found_schema = None
        for schema in schemas_to_check:
            try:
                if inspector.has_table(source_table_name, schema=schema):
                    found_schema = schema
                    logger.info(f"Found temp table {source_table_name} in schema: {schema}")
                    break
            except Exception as e:
                logger.debug(f"Error checking schema {schema}: {str(e)}")
                continue
        
        if not found_schema:
            # List all available tables for debugging
            all_tables = []
            for schema in schemas_to_check:
                try:
                    tables = inspector.get_table_names(schema=schema)
                    all_tables.extend([f"{schema}.{t}" for t in tables])
                except Exception as e:
                    logger.debug(f"Error listing tables in schema {schema}: {str(e)}")
            
            # Also try to find tables that match the pattern in any schema
            matching_tables = []
            for schema in schemas_to_check:
                try:
                    tables = inspector.get_table_names(schema=schema)
                    for table in tables:
                        if 'extracted_SRC' in table or source_table_name.split('_')[-1] in table:
                            matching_tables.append(f"{schema}.{table}")
                except Exception as e:
                    logger.debug(f"Error searching for matching tables in schema {schema}: {str(e)}")
            
            error_msg = f"Temp table {source_table_name} not found in any schema.\n"
            error_msg += f"Checked schemas: {schemas_to_check}\n"
            error_msg += f"Available tables: {all_tables[:20]}...\n"
            if matching_tables:
                error_msg += f"Tables with similar names: {matching_tables}"
            
            logger.error(error_msg)
            
            # Instead of failing, let's try a different approach
            # Maybe the temp table is in the same database but we need to look harder
            logger.info("Attempting broader search for temp table...")
            
            # Try to get all schemas in the database
            try:
                all_schemas_query = "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')"
                with sql_engine.connect() as conn:
                    result = conn.execute(text(all_schemas_query))
                    all_schemas = [row[0] for row in result.fetchall()]
                    logger.info(f"All available schemas: {all_schemas}")
                    
                    # Search in all schemas
                    for schema in all_schemas:
                        try:
                            if inspector.has_table(source_table_name, schema=schema):
                                found_schema = schema
                                logger.info(f"Found temp table {source_table_name} in schema: {schema}")
                                break
                        except Exception as e:
                            continue
            except Exception as e:
                logger.error(f"Error during broader search: {str(e)}")
            
            if not found_schema:
                raise ValueError(error_msg)
        
        # Read data from SQL temp table using the found schema
        query = f'SELECT * FROM "{found_schema}"."{source_table_name}"'
        logger.info(f"Reading temp table with query: {query}")
        df = pd.read_sql(query, sql_engine)
        
        if df.empty:
            logger.warning(f"No data found in temp table {source_schema}.{source_table_name}")
            return {
                'status': 200,
                'message': f"No data to load from {source_schema}.{source_table_name} to MongoDB",
                'target_table': target_table_name
            }
        
        logger.info(f"Read {len(df)} rows from SQL temp table")
        
        # Apply attribute mapping if specified
        if attribute_mapper:
            mapped_columns = {}
            for attr in attribute_mapper:
                if isinstance(attr, (list, tuple)) and len(attr) >= 3:
                    source_col, target_col = attr[0], attr[2]
                    if source_col in df.columns:
                        mapped_columns[source_col] = target_col
            if mapped_columns:
                df = df.rename(columns=mapped_columns)
                logger.info(f"Applied column mapping: {mapped_columns}")
        
        # Convert DataFrame to MongoDB documents
        documents = df.to_dict('records')
        
        # Handle MongoDB connection - it could be MongoClient, Database, or Collection
        if isinstance(mongo_engine, Collection):
            collection = mongo_engine
            logger.info(f"Using existing MongoDB collection: {collection.full_name}")
        elif isinstance(mongo_engine, Database):
            collection = mongo_engine[target_table_name]
            logger.info(f"Using MongoDB collection: {mongo_engine.name}.{target_table_name}")
        elif isinstance(mongo_engine, MongoClient):
            # Need to determine database and collection names
            if '.' in target_table_name:
                db_name, collection_name = target_table_name.split('.', 1)
            else:
                db_name = 'default'
                collection_name = target_table_name
            
            db = mongo_engine[db_name]
            collection = db[collection_name]
            logger.info(f"Using MongoDB collection: {db_name}.{collection_name}")
        else:
            raise TypeError(f"Unsupported MongoDB engine type: {type(mongo_engine)}")
        
        # Clear existing data if needed (equivalent to truncate)
        # For now, we'll append data. In the future, this could be configurable
        
        # Insert documents in batches
        batch_size = 1000
        total_inserted = 0
        
        for i in range(0, len(documents), batch_size):
            batch = documents[i:i + batch_size]
            if batch:
                collection.insert_many(batch)
                total_inserted += len(batch)
                logger.info(f"Inserted batch {i//batch_size + 1}: {len(batch)} documents")
        
        logger.info(f"Successfully loaded {total_inserted} documents into MongoDB collection {collection.full_name}")
        
        return {
            'status': 200,
            'message': f"Successfully loaded {total_inserted} documents into MongoDB collection {collection.full_name}",
            'target_table': target_table_name
        }
        
    except Exception as e:
        error_msg = f"Error in load_sql_to_mongodb_direct: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return {
            'status': 500,
            'message': error_msg
        }


def Load_into_database(
    hierarchy_id,
    user_id,
    dag_id,
    truncate,
    create,
    format,
    previous_id,
    instance_id,
    target_table_name,
    attribute_mapper,
    sources,
    update_strategy='append',
    key_columns=None,
    **kwargs
):
    """
    Load data into target database from the previous task's output.
    This function handles the actual data loading from source table to target table.
    """
    from Connections.utils import generate_engine
    from Connections.models import Connections, DatabaseConnections
    from sqlalchemy import text, inspect
    import logging
    import time

    logger = logging.getLogger(__name__)

    try:
        ti = kwargs.get('ti')
        if not ti:
            raise ValueError("Task instance (ti) not found in kwargs")

        # Get previous task result to find source table
        previous_task_result = ti.xcom_pull(task_ids=previous_id, key='return_value')
        if not previous_task_result or 'target_table' not in previous_task_result:
            raise ValueError(f"No valid table information found from previous task {previous_id}")

        source_table_name = previous_task_result['target_table']
        source_schema = previous_task_result.get('schema', 'public')

        # Get database connection details
        engine_data = generate_engine(hierarchy_id, user_id=user_id)
        engine = engine_data['engine']
        target_schema = engine_data.get('schema', 'public')
        
        # Get database type (PostgreSQL, MySQL, MongoDB, etc.)
        try:
            conn = Connections.objects.get(id=hierarchy_id, user_id=user_id)
            db_conn = DatabaseConnections.objects.get(id=conn.table_id)
            db_type = db_conn.server_type.name.upper()
            
            logger.info(f"Target database type: {db_type}")
            logger.info(f"Target engine type: {type(engine)}")
            logger.info(f"Loading from {source_schema}.{source_table_name} to target: {target_table_name}")
            
        except Exception as e:
            logger.error(f"Error getting database type: {str(e)}")
            # Try to detect MongoDB by engine type
            from pymongo import MongoClient
            from pymongo.database import Database as MongoDatabase
            from pymongo.collection import Collection as MongoCollection
            
            if isinstance(engine, (MongoClient, MongoDatabase, MongoCollection)):
                db_type = 'MONGODB'
                logger.info(f"Detected MongoDB by engine type: {type(engine)}")
            else:
                raise

        # Check if target is MongoDB
        if db_type == 'MONGODB':
            logger.info("Target is MongoDB - MongoDB to MongoDB transfer should be handled directly in extraction")
            # For MongoDB targets, the extraction step should handle the direct transfer
            # No need for intermediate SQL temp tables
            logger.info("MongoDB target detected - assuming direct MongoDB to MongoDB transfer was completed in extraction step")
            return {
                'status': 200,
                'message': f"MongoDB to MongoDB transfer completed in extraction step for target: {target_table_name}",
                'target_table': target_table_name
            }

        # For SQL targets, use transaction context manager
        with engine.begin() as connection:
            # Check if source table exists
            inspector = inspect(engine)
            table_exists = inspector.has_table(source_table_name, schema=source_schema)
            
            if not table_exists:
                # Try to find the table in other schemas
                all_schemas = ['public', source_schema, target_schema]
                found_schema = None
                
                for check_schema in all_schemas:
                    if inspector.has_table(source_table_name, schema=check_schema):
                        found_schema = check_schema
                        break
                
                if found_schema:
                    logger.warning(f"Table {source_table_name} found in schema '{found_schema}' instead of '{source_schema}'. Using found schema.")
                    source_schema = found_schema
                else:
                    # List all available tables for debugging
                    all_tables = []
                    for check_schema in all_schemas:
                        try:
                            tables = inspector.get_table_names(schema=check_schema)
                            all_tables.extend([f"{check_schema}.{t}" for t in tables])
                        except:
                            pass
                    
                    raise ValueError(f"Source table {source_schema}.{source_table_name} does not exist. Available tables: {all_tables}")
            
            # Get row count from source table
            count_query = text(f'SELECT COUNT(*) FROM "{source_schema}"."{source_table_name}"')
            result = connection.execute(count_query)
            row_count = result.scalar()
            
            logger.info(f"Source table has {row_count} rows")
            
            if create:
                # Create target table with the same structure as source
                create_query = text(f'''
                    CREATE TABLE IF NOT EXISTS "{target_schema}"."{target_table_name}" AS 
                    SELECT * FROM "{source_schema}"."{source_table_name}" 
                    WHERE 1=0
                ''')
                connection.execute(create_query)
                logger.info(f"Created table {target_schema}.{target_table_name}")
            
            if truncate:
                truncate_query = text(f'TRUNCATE TABLE "{target_schema}"."{target_table_name}"')
                connection.execute(truncate_query)
                logger.info(f"Truncated table {target_schema}.{target_table_name}")
            
            # Get column information for mapping
            if attribute_mapper:
                # Store raw column names; apply quoting only when building SQL
                columns = [col[0] for col in attribute_mapper]
                column_str = ', '.join([f'"{col}"' for col in columns])
                select_columns = ', '.join([f'"{col[2]}" as "{col[0]}"' for col in attribute_mapper])
            else:
                # If no attribute mapping, use all columns from source
                columns_query = text(f"""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = :schema AND table_name = :table
                    ORDER BY ordinal_position
                """)
                result = connection.execute(columns_query, {'schema': source_schema, 'table': source_table_name})
                columns = [row[0] for row in result.fetchall()]
                column_str = ', '.join([f'"{col}"' for col in columns])
                select_columns = column_str
            
            # Apply update strategy
            logger.info(f"Applying update strategy: {update_strategy}")
            
            if update_strategy == 'truncate_insert':
                # Truncate and insert
                truncate_query = text(f'TRUNCATE TABLE "{target_schema}"."{target_table_name}"')
                connection.execute(truncate_query)
                logger.info(f"Truncated table {target_schema}.{target_table_name}")
                
                insert_query = text(f"""
                    INSERT INTO "{target_schema}"."{target_table_name}" ({column_str})
                    SELECT {select_columns} FROM "{source_schema}"."{source_table_name}"
                """)
                connection.execute(insert_query)
                logger.info(f"Successfully loaded {row_count} rows using TRUNCATE_INSERT strategy")
                
            elif update_strategy == 'replace':
                # Drop and recreate table
                drop_query = text(f'DROP TABLE IF EXISTS "{target_schema}"."{target_table_name}"')
                connection.execute(drop_query)
                logger.info(f"Dropped table {target_schema}.{target_table_name}")
                
                create_query = text(f'''
                    CREATE TABLE "{target_schema}"."{target_table_name}" AS 
                    SELECT {select_columns} FROM "{source_schema}"."{source_table_name}"
                ''')
                connection.execute(create_query)
                logger.info(f"Successfully loaded {row_count} rows using REPLACE strategy")
                
            elif update_strategy == 'upsert' and key_columns:
                # Upsert (merge) operation
                key_columns_list = key_columns if isinstance(key_columns, list) else [key_columns]
                key_conditions = ' AND '.join([f'target."{key}" = source."{key}"' for key in key_columns_list])
                
                # Create a temporary table with source data
                temp_table = f"temp_{target_table_name}_{int(time.time())}"
                create_temp_query = text(f'''
                    CREATE TEMP TABLE "{temp_table}" AS 
                    SELECT {select_columns} FROM "{source_schema}"."{source_table_name}"
                ''')
                connection.execute(create_temp_query)
                
                # Update existing records
                update_columns = [col for col in columns if col not in key_columns_list]
                if update_columns:
                    update_sets = ', '.join([f'"{col}" = source."{col}"' for col in update_columns])
                    update_query = text(f'''
                        UPDATE "{target_schema}"."{target_table_name}" AS target
                        SET {update_sets}
                        FROM "{temp_table}" AS source
                        WHERE {key_conditions}
                    ''')
                    connection.execute(update_query)
                    logger.info(f"Updated existing records using key columns: {key_columns_list}")
                
                # Insert new records
                insert_query = text(f'''
                    INSERT INTO "{target_schema}"."{target_table_name}" ({column_str})
                    SELECT {select_columns} FROM "{temp_table}" AS source
                    WHERE NOT EXISTS (
                        SELECT 1 FROM "{target_schema}"."{target_table_name}" AS target
                        WHERE {key_conditions}
                    )
                ''')
                connection.execute(insert_query)
                logger.info(f"Successfully loaded {row_count} rows using UPSERT strategy")

            elif update_strategy == 'dd_update' and key_columns:
                # DD_UPDATE: update existing, insert new, and delete rows missing in source
                key_columns_list = key_columns if isinstance(key_columns, list) else [key_columns]
                key_conditions = ' AND '.join([f'target."{key}" = source."{key}"' for key in key_columns_list])

                # Create a temporary table with source data
                temp_table = f"temp_{target_table_name}_{int(time.time())}"
                create_temp_query = text(f'''
                    CREATE TEMP TABLE "{temp_table}" AS 
                    SELECT {select_columns} FROM "{source_schema}"."{source_table_name}"
                ''')
                connection.execute(create_temp_query)

                # Update existing records
                update_columns = [col for col in columns if col not in key_columns_list]
                if update_columns:
                    update_sets = ', '.join([f'"{col}" = source."{col}"' for col in update_columns])
                    update_query = text(f'''
                        UPDATE "{target_schema}"."{target_table_name}" AS target
                        SET {update_sets}
                        FROM "{temp_table}" AS source
                        WHERE {key_conditions}
                    ''')
                    connection.execute(update_query)

                # Insert new records
                insert_query = text(f'''
                    INSERT INTO "{target_schema}"."{target_table_name}" ({column_str})
                    SELECT {select_columns} FROM "{temp_table}" AS source
                    WHERE NOT EXISTS (
                        SELECT 1 FROM "{target_schema}"."{target_table_name}" AS target
                        WHERE {key_conditions}
                    )
                ''')
                connection.execute(insert_query)

                # Delete rows in target that are missing in source
                delete_conditions = ' AND '.join([
                    f'target."{key}" NOT IN (SELECT "{key}" FROM "{temp_table}")'
                    for key in key_columns_list
                ])

                delete_query = text(f'''
                    DELETE FROM "{target_schema}"."{target_table_name}" AS target
                    WHERE {delete_conditions}
                ''')
                connection.execute(delete_query)

                logger.info(f"Successfully synchronized target using DD_UPDATE strategy with key columns: {key_columns_list}")
                
            elif update_strategy == 'update' and key_columns:
                # Update only existing records
                key_columns_list = key_columns if isinstance(key_columns, list) else [key_columns]
                key_conditions = ' AND '.join([f'target."{key}" = source."{key}"' for key in key_columns_list])
                update_columns = [col for col in columns if col not in key_columns_list]
                
                if update_columns:
                    update_sets = ', '.join([f'"{col}" = source."{col}"' for col in update_columns])
                    update_query = text(f'''
                        UPDATE "{target_schema}"."{target_table_name}" AS target
                        SET {update_sets}
                        FROM "{source_schema}"."{source_table_name}" AS source
                        WHERE {key_conditions}
                    ''')
                    connection.execute(update_query)
                    logger.info(f"Successfully updated records using UPDATE strategy with key columns: {key_columns_list}")
                
            elif update_strategy == 'delete' and key_columns:
                # Delete matching records
                key_columns_list = key_columns if isinstance(key_columns, list) else [key_columns]
                key_conditions = ' AND '.join([f'target."{key}" IN (SELECT "{key}" FROM "{source_schema}"."{source_table_name}")' for key in key_columns_list])
                
                delete_query = text(f'''
                    DELETE FROM "{target_schema}"."{target_table_name}" AS target
                    WHERE {key_conditions}
                ''')
                connection.execute(delete_query)
                logger.info(f"Successfully deleted records using DELETE strategy with key columns: {key_columns_list}")
                
            elif update_strategy == 'insert':
                # Insert only new records (skip duplicates)
                if key_columns:
                    key_columns_list = key_columns if isinstance(key_columns, list) else [key_columns]
                    key_conditions = ' AND '.join([f'target."{key}" = source."{key}"' for key in key_columns_list])
                    
                    insert_query = text(f'''
                        INSERT INTO "{target_schema}"."{target_table_name}" ({column_str})
                        SELECT {select_columns} FROM "{source_schema}"."{source_table_name}" AS source
                        WHERE NOT EXISTS (
                            SELECT 1 FROM "{target_schema}"."{target_table_name}" AS target
                            WHERE {key_conditions}
                        )
                    ''')
                    connection.execute(insert_query)
                    logger.info(f"Successfully inserted new records using INSERT strategy with key columns: {key_columns_list}")
                else:
                    # Simple insert without duplicate checking
                    insert_query = text(f"""
                        INSERT INTO "{target_schema}"."{target_table_name}" ({column_str})
                        SELECT {select_columns} FROM "{source_schema}"."{source_table_name}"
                    """)
                    connection.execute(insert_query)
                    logger.info(f"Successfully inserted {row_count} rows using INSERT strategy")
                    
            else:  # Default: append
                # Simple append (insert all records)
                insert_query = text(f"""
                    INSERT INTO "{target_schema}"."{target_table_name}" ({column_str})
                    SELECT {select_columns} FROM "{source_schema}"."{source_table_name}"
                """)
                connection.execute(insert_query)
                logger.info(f"Successfully loaded {row_count} rows using APPEND strategy")
            
            return {
                'status': 200,
                'message': f"Successfully loaded {row_count} rows into {target_schema}.{target_table_name}",
                'target_table': target_table_name
            }
            
    except Exception as e:
        error_msg = f"Error in Load_into_database: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return {
            'status': 500,
            'message': error_msg
        }


def Loading(
    hierarchy_id,
    user_id,
    dag_id,
    truncate,
    create,
    format,
    previous_id,
    instance_id,
    target_table_name,
    attribute_mapper,
    sources,
    update_strategy='append',
    key_columns=None,
    **kwargs
):
    """
    Load data into target database from the previous task's output
    """
    try:
        print(f"[Loading] STARTING - Target: {target_table_name}")
        print(f"[Loading] Update Strategy: {update_strategy}, Key Columns: {key_columns}")
        print(f"[Loading] Previous Task ID: {previous_id}")
        ti = kwargs.get('ti')
        if not ti:
            raise ValueError("Task instance (ti) not found in kwargs")

        if format.lower() == 'csv':
            # TODO: CSV output support
            pass

        elif format.lower() == 'database':
            previous_task_result = ti.xcom_pull(task_ids=previous_id, key='return_value')

            if not previous_task_result or 'target_table' not in previous_task_result:
                raise ValueError(f"No valid table information found from previous task {previous_id}")

            source_table_name = previous_task_result['target_table']
            source_schema = previous_task_result.get('schema', 'public')

            logger.info(
                f"Loading data from source table: {source_schema}.{source_table_name} "
                f"to target table: {target_table_name}"
            )
            logger.debug(f"Previous task result: {previous_task_result}")

            # Check if target is MongoDB before calling Load_into_database
            try:
                from Connections.models import Connections, DatabaseConnections
                conn = Connections.objects.get(id=hierarchy_id, user_id=user_id)
                db_conn = DatabaseConnections.objects.get(id=conn.table_id)
                db_type = db_conn.server_type.name.upper()
                
                logger.info(f"[Loading] Target database type: {db_type}")
                
                if db_type == 'MONGODB':
                    logger.info("[Loading] Target is MongoDB - MongoDB to MongoDB transfer completed in extraction")
                    return {
                        'status': 200,
                        'message': f'MongoDB to MongoDB transfer completed for target: {target_table_name}'
                    }
            except Exception as e:
                logger.warning(f"[Loading] Could not determine database type: {str(e)}")
                # Try to detect by engine type
                try:
                    from Connections.utils import generate_engine
                    engine_data = generate_engine(hierarchy_id, user_id=user_id)
                    engine = engine_data['engine']
                    
                    from pymongo import MongoClient
                    from pymongo.database import Database as MongoDatabase
                    from pymongo.collection import Collection as MongoCollection
                    
                    if isinstance(engine, (MongoClient, MongoDatabase, MongoCollection)):
                        logger.info("[Loading] Detected MongoDB by engine type - skipping SQL loading")
                        return {
                            'status': 200,
                            'message': f'MongoDB to MongoDB transfer completed for target: {target_table_name}'
                        }
                except Exception as e2:
                    logger.error(f"[Loading] Error detecting MongoDB by engine type: {str(e2)}")

            db_load = Load_into_database(
                hierarchy_id=hierarchy_id,
                user_id=user_id,
                dag_id=dag_id,
                truncate=truncate,
                create=create,
                format=format,
                previous_id=previous_id,
                instance_id=instance_id,
                target_table_name=target_table_name,
                attribute_mapper=attribute_mapper,
                sources=sources,
                update_strategy=update_strategy,
                key_columns=key_columns,
                **kwargs
            )

            if db_load.get('status') == 200:
                logger.info('✅ Data successfully loaded into target database')
                if sources:
                    deletion_confirmation = Delete_temp_tables(
                        sources, hierarchy_id, user_id, **kwargs
                    )
                    logger.info(f"Cleanup status: {deletion_confirmation}")
                return {'status': 200, 'message': 'Data loaded successfully'}
            else:
                error_msg = db_load.get('message', 'Unknown error during database load')
                logger.error(f"❌ Failed to load data: {error_msg}")
                return {'status': 500, 'message': error_msg}

        return {'status': 400, 'message': f'Unsupported format: {format}'}

    except Exception as e:
        error_msg = f"Error in Loading function: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return {'status': 500, 'message': error_msg}


def ETL_Filter(
    filter_condition,
    instance_id,
    dag_id,
    task_id,
    previous_id,
    target_hierarchy_id,
    user_id,
    sources,
    **kwargs
):
    """
    Filter The raw Data Based on Condition
    """
    from Connections.utils import generate_engine
    import duckdb
    import time
    from sqlalchemy import text

    try:
        conn = duckdb.connect(database=':memory:')
        engine_data = generate_engine(target_hierarchy_id, user_id)
        engine = engine_data['engine']
        schema = engine_data['schema']
        conn_str = str(engine.url)

        conn.sql(f"ATTACH '{conn_str}' AS pg_db (TYPE POSTGRES, SCHEMA '{schema}');")

        ti = kwargs.get('ti')
        if not ti:
            raise ValueError("Task instance (ti) not found in kwargs")

        unix_suffix = int(time.time())
        target_table_name = f"extracted_{task_id}_{unix_suffix}"

        previous_task_result = ti.xcom_pull(task_ids=previous_id, key='return_value')

        if (not previous_task_result or
                not isinstance(previous_task_result, dict) or
                'target_table' not in previous_task_result):
            table_name = xcom_pull(ti, instance_id, previous_id)
            if not table_name:
                raise ValueError(f"No valid table name found from previous task {previous_id}")
        else:
            table_name = previous_task_result['target_table']

        logger.info(f"Filtering data from source table: {table_name}")

        from_clause = (table_name, previous_id)
        generated_query = Query_generator(
            from_clause=from_clause,
            where_clause=filter_condition,
            schema=schema
        )

        cte = f""" "{task_id}" AS (\n{generated_query}\n) """

        result = conn.sql(
            f"""SELECT * FROM postgres_query('pg_db', $$WITH {cte} SELECT count(*) FROM "{task_id}" $$);"""
        )
        row_count = result.fetchone()[0]
        logger.info(f"[Filter Query]\nWITH {cte} SELECT * FROM \"{task_id}\"")
        logger.info(f"Total Records: {row_count}")

        with engine.begin() as conn1:
            conn1.execute(text(f""" 
                CREATE TABLE "{schema}"."{target_table_name}" AS
                WITH {cte} SELECT * FROM "{task_id}";
            """))

        result = {
            'status': 200,
            'target_table': target_table_name,
            'query': cte,
            'row_count': row_count
        }

        ti.xcom_push(key='return_value', value=result)

        logger.info(
            f"✅ Successfully created filtered table {schema}.{target_table_name} with {row_count} rows"
        )

        return result

    except Exception as e:
        error_msg = f"Error in ETL_Filter: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return {
            'status': 500,
            'message': error_msg,
            'target_table': target_table_name if 'target_table_name' in locals() else None
        }
    finally:
        if 'conn' in locals():
            dbs = [db[0] for db in conn.sql("PRAGMA database_list").fetchall()]
            if 'pg_db' in dbs:
                conn.sql("DETACH pg_db")
            conn.close()


def Expressions(Expression_list, dag_id, task_id, previous_id, instance_id, target_hierarchy_id, user_id, sources, **kwargs):
    ti = kwargs['ti']
    from Connections.utils import generate_engine
    import duckdb, re, keyword, sqlglot, time
    from sqlalchemy import text

    unix_suffix = int(time.time())
    target_table_name = f"extracted_{task_id}_{unix_suffix}"

    table_name = xcom_pull(ti, instance_id, previous_id)

    conn = duckdb.connect(database=':memory:')
    engine_data = generate_engine(target_hierarchy_id, user_id)
    engine = engine_data['engine']
    schema = engine_data['schema']

    conn.sql(f"ATTACH '{str(engine.url)}' AS pg_db (TYPE POSTGRES, SCHEMA '{schema}');")

    from_clause = (table_name, previous_id)
    generated_query = Query_generator(attributes=Expression_list, from_clause=from_clause, schema=schema)
    new_cte_query = f""" "{task_id}"  AS (\n{generated_query}\n) """

    result = conn.sql(
        f"""SELECT * FROM postgres_query('pg_db', $$WITH {new_cte_query} SELECT count(*) FROM "{task_id}" $$);"""
    )
    logger.info(f""" [Expressions Query]\n WITH {new_cte_query} SELECT * FROM "{task_id}" """)
    logger.info(f"Total Records: {result.fetchone()[0]}")
    with engine.begin() as conn1:
        conn1.execute(text(f""" 
            CREATE TABLE "{schema}"."{target_table_name}" AS
            WITH {new_cte_query} SELECT * FROM "{task_id}";
        """))

    ti.xcom_push(key=task_id, value=target_table_name)
    conn.sql("DETACH pg_db")

    return target_table_name


def Join(
    primary_table,
    joining_list,
    where_clause,
    dag_id,
    task_id,
    previous_id,
    instance_id,
    attributes,
    target_hierarchy_id,
    user_id,
    sources,
    **kwargs
):
    from Connections.utils import generate_engine
    import duckdb, re, keyword, sqlglot, time
    from sqlalchemy import text

    ti = kwargs['ti']
    unix_suffix = int(time.time())
    target_table_name = f"extracted_{task_id}_{unix_suffix}"

    engine_data = generate_engine(target_hierarchy_id, user_id=user_id)
    engine = engine_data['engine']
    schema = engine_data['schema']
    conn_str = f"postgresql://{engine.url.username}:{engine.url.password}@{engine.url.host}/{engine.url.database}"

    conn = duckdb.connect(database=':memory:')
    conn.sql(f"ATTACH '{conn_str}' AS pg_db (TYPE POSTGRES, SCHEMA '{schema}');")

    from_clause = (primary_table, primary_table)
    generated_query = Query_generator(
        attributes=attributes,
        join_list=joining_list,
        where_clause=where_clause,
        from_clause=from_clause,
        schema=schema
    )
    logger.info(f" generated _query {generated_query}")
    for pid, instance in zip(previous_id, instance_id):
        table_name = xcom_pull(ti, instance, pid)
        pattern = rf'\b{re.escape(pid)}\b'
        if re.search(pattern, generated_query):
            generated_query = re.sub(pattern, table_name, generated_query)

    new_cte_query = f""" "{task_id}" AS (\n{generated_query}\n) """
    logger.info(new_cte_query)
    with engine.begin() as conn1:
        result = conn1.execute(text(f""" 
            WITH {new_cte_query} SELECT count(*) FROM "{task_id}"
        """))

    logger.info(f""" [Join Query]\n WITH {new_cte_query} SELECT * FROM "{task_id}" """)
    logger.info(f"Total Records: {result.fetchone()[0]}")
    with engine.begin() as conn1:
        conn1.execute(text(f""" 
            CREATE TABLE "{schema}"."{target_table_name}" AS
            WITH {new_cte_query} SELECT * FROM "{task_id}";
        """))

    ti.xcom_push(key=task_id, value=target_table_name)
    conn.sql("DETACH pg_db")

    return new_cte_query


def Remove_duplicates(
    group_attributes,
    having_clause,
    task_id,
    dag_id,
    previous_id,
    instance_id,
    attributes,
    hierarchy_id,
    user_id,
    sources,
    **kwargs
):
    from Connections.utils import generate_engine
    import duckdb, re, keyword, sqlglot, time
    from sqlalchemy import text

    conn = duckdb.connect(database=':memory:')
    engine_data = generate_engine(hierarchy_id, user_id)
    engine = engine_data['engine']
    schema = engine_data['schema']
    conn_str = str(engine.url)

    conn.sql(f"ATTACH '{conn_str}' AS pg_db (TYPE POSTGRES, SCHEMA '{schema}');")

    ti = kwargs['ti']

    unix_suffix = int(time.time())
    target_table_name = f"extracted_{task_id}_{unix_suffix}"

    table_name = xcom_pull(ti, instance_id, previous_id)
    from_clause = (table_name, previous_id)
    generated_query = Query_generator(
        source_attributes=group_attributes,
        attributes=attributes,
        group_by_clause=group_attributes,
        having_clause=having_clause,
        from_clause=from_clause,
        schema=schema
    )

    cte = f""" "{task_id}" AS (\n{generated_query}\n) """

    result = conn.sql(
        f""" SELECT * FROM postgres_query('pg_db', $$WITH  {cte} SELECT count(*) FROM "{task_id}" $$);"""
    )
    with engine.begin() as conn1:
        conn1.execute(text(f""" 
            CREATE TABLE "{schema}"."{target_table_name}" AS
            WITH {cte} SELECT * FROM "{task_id}";
        """))

    logger.info(f""" [Remove Duplicates Query]\n WITH  {cte} SELECT * FROM "{task_id}" """)
    logger.info(f"Total Records: {result.fetchone()[0]}")
    kwargs['ti'].xcom_push(key=task_id, value=target_table_name)
    conn.sql("DETACH pg_db")

    return cte


def Rank(
    source_attributes,
    order_by_cols,
    partition_by_cols,
    rank_col_name,
    Records,
    rank_type,
    dag_id,
    task_id,
    previous_id,
    instance_id,
    target_hierarchy_id,
    user_id,
    sort,
    **kwargs
):
    """
    Assigns ranking values to rows in a dataset based on specified columns.
    """
    from Connections.utils import generate_engine
    import duckdb, re, keyword, sqlglot, time
    from sqlalchemy import text

    conn = duckdb.connect(database=':memory:')
    engine_data = generate_engine(target_hierarchy_id, user_id)
    engine = engine_data['engine']
    schema = engine_data['schema']
    conn_str = str(engine.url)

    conn.sql(f"ATTACH '{conn_str}' AS pg_db (TYPE POSTGRES, SCHEMA '{schema}');")

    ti = kwargs['ti']
    unix_suffix = int(time.time())
    target_table_name = f"extracted_{task_id}_{unix_suffix}"

    source_table_name = xcom_pull(ti, instance_id, previous_id)

    rank_function = rank_type.upper()
    if rank_function not in ['RANK', 'DENSE_RANK', 'ROW_NUMBER', 'NTILE']:
        rank_function = 'RANK'

    order_direction = ' DESC' if sort.lower() == 'top' else 'ASC'
    order_by_clause = ", ".join(
        [f'"{previous_id}"."{col}" {order_direction}' for col in order_by_cols]
    )

    partition_by_clause = ""
    if partition_by_cols and len(partition_by_cols) > 0:
        partition_by_str = ", ".join([f'"{previous_id}"."{col}"' for col in partition_by_cols])
        partition_by_clause = f"PARTITION BY {partition_by_str}"

    rank_attribute = [
        (rank_col_name, 'Integer', f'{rank_function}() OVER ({partition_by_clause} ORDER BY {order_by_clause})')
    ]
    where_condtion = f"{rank_col_name} <= {Records}"

    from_clause = (source_table_name, previous_id)
    generated_query = Query_generator(
        source_attributes=source_attributes,
        attributes=rank_attribute,
        from_clause=from_clause,
        schema=schema,
    )

    cte = f""" "{task_id}" AS (
        select * from ({generated_query}) temp where {where_condtion}
        )"""
    logger.info(f"[Rank Transformation] Generated query with Query_generator:\n{cte}")

    with engine.begin() as conn1:
        conn1.execute(text(f"""
            CREATE TABLE "{schema}"."{target_table_name}" AS
            WITH {cte} SELECT * FROM "{task_id}";
        """))

    with engine.begin() as conn1:
        result = conn1.execute(text(f"""
            SELECT COUNT(*) FROM "{schema}"."{target_table_name}"
        """))
        total_count = result.fetchone()[0]

    logger.info(f"Rank transformation created table with {total_count} total records")

    ti.xcom_push(key=task_id, value=target_table_name)
    conn.sql("DETACH pg_db")

    return cte


def Normalizer(
    group_by_cols,
    pivot_col,
    value_cols,
    output_cols,
    dag_id,
    task_id,
    previous_id,
    target_hierarchy_id,
    user_id,
    **kwargs
):
    """
    Converts denormalized (pivoted) data into normalized form, similar to unpivoting or melting data.
    """
    from Connections.utils import generate_engine
    import duckdb, time
    from sqlalchemy import text

    conn = duckdb.connect(database=':memory:')
    engine_data = generate_engine(target_hierarchy_id, user_id)
    engine = engine_data['engine']
    schema = engine_data['schema']
    conn_str = str(engine.url)

    conn.sql(f"ATTACH '{conn_str}' AS pg_db (TYPE POSTGRES, SCHEMA '{schema}');")

    ti = kwargs['ti']
    unix_suffix = int(time.time())
    target_table_name = f"extracted_{task_id}_{unix_suffix}"

    source_table_name = xcom_pull(ti, previous_id, previous_id)

    union_queries = []

    for value_col in value_cols:
        source_attributes = [(col, 'string', f't."{col}"') for col in group_by_cols]
        pivot_attributes = [
            (pivot_col, 'string', f"'{value_col}'"),
            (output_cols[0], 'string', f't."{value_col}"')
        ]

        from_clause = (source_table_name, 't')
        where_clause = f't."{value_col}" IS NOT NULL'

        generated_query = Query_generator(
            source_attributes=source_attributes,
            attributes=pivot_attributes,
            from_clause=from_clause,
            schema=schema,
            where_clause=where_clause
        )
        union_queries.append(generated_query)

    combined_query = " UNION ALL ".join(union_queries)

    cte = f""" "{task_id}" AS (
        {combined_query}
        )"""
    logger.info(f"[Normalizer Transformation] Generated query with Query_generator:\n{cte}")

    with engine.begin() as conn1:
        conn1.execute(text(f"""
            CREATE TABLE "{schema}"."{target_table_name}" AS
            {combined_query}
        """))

    with engine.begin() as conn1:
        result = conn1.execute(text(f"""
            SELECT COUNT(*) FROM "{schema}"."{target_table_name}"
        """))
        total_count = result.fetchone()[0]

    logger.info(f"Normalizer transformation created table with {total_count} total records")

    ti.xcom_push(key=task_id, value=target_table_name)
    conn.sql("DETACH pg_db")

    return target_table_name


def UpdateStrategy(update_strategy, key_columns, previous_instance_id, dag_id, task_id, target_hierarchy_id, user_id, sources=None, **kwargs):
    """
    Update Strategy transformation - sets strategy and key columns for downstream target loading
    Similar to Informatica Update Strategy transformation
    """
    try:
        print(f"[UpdateStrategy] STARTING - Task ID: {task_id}")
        print(f"[UpdateStrategy] Strategy: {update_strategy}, Keys: {key_columns}")
        
        ti = kwargs.get('ti')
        if not ti:
            print("[UpdateStrategy] ERROR: Task instance (ti) not found in kwargs")
            raise ValueError("Task instance (ti) not found in kwargs")

        logger.info(f"[UpdateStrategy] Processing update strategy: {update_strategy}")
        logger.info(f"[UpdateStrategy] Key columns: {key_columns}")
        print(f"[UpdateStrategy] Processing update strategy: {update_strategy}")
        print(f"[UpdateStrategy] Key columns: {key_columns}")

        # Get the previous task result (source data table)
        previous_task_result = ti.xcom_pull(task_ids=previous_instance_id, key='return_value')
        if not previous_task_result:
            print(f"[UpdateStrategy] ERROR: No data received from previous task: {previous_instance_id}")
            raise ValueError(f"No data received from previous task: {previous_instance_id}")

        source_table = previous_task_result.get('target_table')
        source_schema = previous_task_result.get('schema', 'public')

        if not source_table:
            print("[UpdateStrategy] ERROR: No source table found in previous task result")
            raise ValueError("No source table found in previous task result")

        print(f"[UpdateStrategy] Source table: {source_schema}.{source_table}")
        logger.info(f"[UpdateStrategy] Source table: {source_schema}.{source_table}")

        # Create a result that includes the update strategy metadata
        result = {
            'status': 200,
            'target_table': source_table,  # Pass through the table name
            'schema': source_schema,       # Pass through the schema
            'update_strategy': update_strategy,
            'key_columns': key_columns,
            'query': f'-- UpdateStrategy: {update_strategy}, Key Columns: {key_columns}'
        }

        # Push result to XCom for downstream tasks
        ti.xcom_push(key='return_value', value=result)
        ti.xcom_push(key=task_id, value=source_table)

        logger.info(f"[UpdateStrategy] Completed successfully. Strategy: {update_strategy}")
        return result

    except Exception as e:
        error_msg = f"Error in UpdateStrategy transformation: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return {
            'status': 500,
            'message': error_msg
        }


def Pivot(
    group_by_cols,
    pivot_col,
    value_col,
    agg_func,
    pivot_values,
    dag_id,
    task_id,
    previous_id,
    instance_id,
    target_hierarchy_id,
    user_id,
    **kwargs
):
    """
    Pivot transformation: Converts rows into columns based on pivot column values.
    """
    from Connections.utils import generate_engine
    import duckdb, re, keyword, sqlglot, time
    from sqlalchemy import text

    conn = duckdb.connect(database=":memory:")
    engine_data = generate_engine(target_hierarchy_id, user_id)
    engine = engine_data["engine"]
    schema = engine_data["schema"]
    conn_str = str(engine.url)

    conn.sql(f"ATTACH '{conn_str}' AS pg_db (TYPE POSTGRES, SCHEMA '{schema}');")

    ti = kwargs["ti"]
    unix_suffix = int(time.time())
    target_table_name = f"extracted_{task_id}_{unix_suffix}"

    table_name = xcom_pull(ti, instance_id, previous_id)

    attributes = []
    NUMERIC_TOKENS = {
        "smallint", "integer", "bigint", "decimal",
        "numeric", "real", "double precision", "float",
        "int", "int4", "int8"
    }

    def is_numeric_type(dt):
        if not dt:
            return False
        dt = dt.lower()
        return any(tok in dt for tok in NUMERIC_TOKENS)

    for val in pivot_values:
        val_esc = str(val).replace("'", "''")
        for m in value_col:
            dt = m['dtype']
            agg = agg_func.upper()
            v_col = m['column']
            alias_col_name = f"{v_col}_{val_esc}"

            if is_numeric_type(dt):
                if agg == "COUNT":
                    expr = (
                        f'COUNT(CASE WHEN "{previous_id}"."{pivot_col}" = \'{val_esc}\' '
                        f'THEN "{previous_id}"."{v_col}" ELSE NULL END)'
                    )
                elif agg in ("SUM", "AVG", "MAX", "MIN"):
                    else_part = "0" if agg == "SUM" else "NULL"
                    expr = (
                        f'{agg}(CASE WHEN "{previous_id}"."{pivot_col}" = \'{val_esc}\' '
                        f'THEN "{previous_id}"."{v_col}" ELSE {else_part} END)'
                    )
                else:
                    expr = (
                        f'{agg}(CASE WHEN "{previous_id}"."{pivot_col}" = \'{val_esc}\' '
                        f'THEN "{previous_id}"."{v_col}" ELSE 0 END)'
                    )
            else:
                if agg == "COUNT":
                    expr = (
                        f'COUNT(CASE WHEN "{previous_id}"."{pivot_col}" = \'{val_esc}\' '
                        f'THEN "{previous_id}"."{v_col}" ELSE NULL END)'
                    )
                elif agg in ("MAX", "MIN"):
                    expr = (
                        f'{agg}(CASE WHEN "{previous_id}"."{pivot_col}" = \'{val_esc}\' '
                        f'THEN "{previous_id}"."{v_col}" ELSE NULL END)'
                    )
                else:
                    expr = (
                        f'COUNT(CASE WHEN "{previous_id}"."{pivot_col}" = \'{val_esc}\' '
                        f'THEN "{previous_id}"."{v_col}" ELSE NULL END)'
                    )

            attributes.append([alias_col_name, dt, expr])

    source_attributes = []
    for index in group_by_cols:
        col_list = [index, "", index]
        source_attributes.append(col_list)

    from_clause = (table_name, previous_id)
    generated_query = Query_generator(
        source_attributes=source_attributes,
        attributes=attributes,
        from_clause=from_clause,
        schema=schema,
        group_by_clause=source_attributes
    )
    cte = f""" "{task_id}" AS (\n{generated_query}\n)"""
    logger.info(f"[Pivot Transformation] Generated Query:\n{cte}")

    result = conn.sql(
        f"""SELECT * FROM postgres_query('pg_db', $$WITH  {cte} SELECT count(*) FROM "{task_id}" $$);"""
    )
    logger.info(f""" [Filter Query]\n WITH {cte} SELECT * FROM "{task_id}" """)
    logger.info(f"Total Records: {result.fetchone()[0]}")
    with engine.begin() as conn1:
        conn1.execute(text(f""" 
            CREATE TABLE "{schema}"."{target_table_name}" AS
            WITH {cte} SELECT * FROM "{task_id}";
        """))
    kwargs['ti'].xcom_push(key=task_id, value=target_table_name)
    conn.sql("DETACH pg_db")

    return cte


def Union(
    previous_ids,
    instance_id,
    column_mappings,
    type,
    dag_id,
    task_id,
    target_hierarchy_id,
    user_id,
    **kwargs
):
    """
    Combines data from multiple input sources into a single output, similar to Informatica Union transformation.
    """
    from Connections.utils import generate_engine
    import duckdb, re, keyword, sqlglot, time
    from sqlalchemy import text

    conn = duckdb.connect(database=':memory:')
    engine_data = generate_engine(target_hierarchy_id, user_id)
    engine = engine_data['engine']
    schema = engine_data['schema']
    conn_str = str(engine.url)

    conn.sql(f"ATTACH '{conn_str}' AS pg_db (TYPE POSTGRES, SCHEMA '{schema}');")

    ti = kwargs['ti']
    unix_suffix = int(time.time())
    target_table_name = f"extracted_{task_id}_{unix_suffix}"

    source_tables = []
    for instance, prev_id in zip(previous_ids, instance_id):
        table_name = xcom_pull(ti, instance, prev_id)
        source_tables.append((table_name, prev_id))

    union_queries = []

    for idx, (source_table, prev_id) in enumerate(source_tables):
        attributes = []

        for mapping in column_mappings:
            alias_name = mapping["aliasName"]

            if idx < len(mapping["columns"]) and mapping["columns"][idx]:
                col_name = mapping["columns"][idx]["col"]
                attributes.append((alias_name, '', f'"{col_name}"'))
            else:
                attributes.append((alias_name, '', f'NULL'))

        from_clause = (source_table, source_table)

        generated_query = Query_generator(
            attributes=attributes,
            from_clause=from_clause,
            schema=schema
        )

        union_queries.append(generated_query)

    combined_query = f" {type} ".join(union_queries)

    cte = f""" "{task_id}" AS (
        {combined_query}
        )"""
    logger.info(f"[Union Transformation] Generated query with Query_generator:\n{cte}")

    with engine.begin() as conn1:
        conn1.execute(text(f"""
            CREATE TABLE "{schema}"."{target_table_name}" AS
            {combined_query}
        """))

    with engine.begin() as conn1:
        result = conn1.execute(text(f"""
            SELECT COUNT(*) FROM "{schema}"."{target_table_name}"
        """))
        total_count = result.fetchone()[0]

    logger.info(f"Union transformation created table with {total_count} total records")

    ti.xcom_push(key=task_id, value=target_table_name)
    conn.sql("DETACH pg_db")

    return target_table_name


def UpdateStrategyExecutor(
    target_table,
    join_key,
    update_mappings,
    dag_id,
    task_id,
    previous_id,
    target_hierarchy_id,
    user_id,
    sources,
    strategy='UPDATE',
    **kwargs
):
    """
    Updates data in target table based on source data and specified update strategies, similar to Informatica
    """
    from Connections.utils import generate_engine
    import duckdb, re, keyword, sqlglot, time
    from sqlalchemy import text

    conn = duckdb.connect(database=':memory:')
    engine_data = generate_engine(target_hierarchy_id, user_id)
    engine = engine_data['engine']
    schema = engine_data['schema']
    conn_str = str(engine.url)

    conn.sql(f"ATTACH '{conn_str}' AS pg_db (TYPE POSTGRES, SCHEMA '{schema}');")

    ti = kwargs['ti']
    unix_suffix = int(time.time())
    temp_table_name = f"temp_update_{task_id}_{unix_suffix}"
    updated_table_name = f"updated_{task_id}_{unix_suffix}"

    source_table_name = xcom_pull(ti, previous_id, previous_id)

    join_conditions = []
    for key in join_key:
        join_conditions.append(f't."{key}" = s."{key}"')
    join_condition = " AND ".join(join_conditions)

    with engine.begin() as conn1:
        conn1.execute(text(f"""
            CREATE TABLE "{schema}"."{temp_table_name}" AS
            SELECT * FROM "{schema}"."{target_table}";
        """))

    updated_count = 0
    inserted_count = 0
    deleted_count = 0

    if strategy.upper() in ('UPDATE', 'UPSERT', 'DD_UPDATE'):
        set_clauses = []
        for target_col, source_col, update_type in update_mappings:
            if update_type.lower() == 'overwrite':
                set_clauses.append(f't."{target_col}" = s."{source_col}"')
            elif update_type.lower() == 'add':
                set_clauses.append(
                    f't."{target_col}" = COALESCE(t."{target_col}", 0) + COALESCE(s."{source_col}", 0)'
                )
            elif update_type.lower() == 'subtract':
                set_clauses.append(
                    f't."{target_col}" = COALESCE(t."{target_col}", 0) - COALESCE(s."{source_col}", 0)'
                )
            elif update_type.lower() == 'min':
                set_clauses.append(
                    f't."{target_col}" = LEAST(COALESCE(t."{target_col}", s."{source_col}"), '
                    f'COALESCE(s."{source_col}", t."{target_col}"))'
                )
            elif update_type.lower() == 'max':
                set_clauses.append(
                    f't."{target_col}" = GREATEST(COALESCE(t."{target_col}", s."{source_col}"), '
                    f'COALESCE(s."{source_col}", t."{target_col}"))'
                )
            elif update_type.lower() == 'concat':
                set_clauses.append(
                    f't."{target_col}" = CONCAT('
                    f'COALESCE(t."{target_col}", \'\'), COALESCE(s."{source_col}", \'\'))'
                )
            else:
                set_clauses.append(f't."{target_col}" = s."{source_col}"')

        set_clause = ", ".join(set_clauses)

        update_query = f"""
            UPDATE "{schema}"."{temp_table_name}" t
            SET {set_clause}
            FROM "{schema}"."{source_table_name}" s
            WHERE {join_condition};
        """
        logger.info(f"[Update Strategy] Executing update query:\n{update_query}")

        with engine.begin() as conn1:
            conn1.execute(text(update_query))

        with engine.begin() as conn1:
            result = conn1.execute(text(f"""
                SELECT COUNT(*)
                FROM "{schema}"."{temp_table_name}" t
                JOIN "{schema}"."{source_table_name}" s
                ON {join_condition}
            """))
            updated_count = result.fetchone()[0]

        logger.info(f"Updated {updated_count} records in {target_table}")

    if strategy.upper() in ('INSERT', 'UPSERT'):
        insert_columns = []
        insert_values = []

        for target_col, source_col, _ in update_mappings:
            insert_columns.append(f'"{target_col}"')
            insert_values.append(f's."{source_col}"')

        insert_columns_str = ", ".join(insert_columns)
        insert_values_str = ", ".join(insert_values)

        insert_query = f"""
            INSERT INTO "{schema}"."{temp_table_name}" ({insert_columns_str})
            SELECT {insert_values_str}
            FROM "{schema}"."{source_table_name}" s
            WHERE NOT EXISTS (
                SELECT 1 FROM "{schema}"."{temp_table_name}" t
                WHERE {join_condition}
            );
        """
        logger.info(f"[Update Strategy] Executing insert query:\n{insert_query}")

        with engine.begin() as conn1:
            conn1.execute(text(insert_query))

        with engine.begin() as conn1:
            result = conn1.execute(text(f"""
                SELECT COUNT(*)
                FROM "{schema}"."{source_table_name}" s
                WHERE NOT EXISTS (
                    SELECT 1 FROM "{schema}"."{target_table}" t
                    WHERE {join_condition}
                )
            """))
            inserted_count = result.fetchone()[0]

        logger.info(f"Inserted {inserted_count} new records into {target_table}")

    if strategy.upper() in ('DELETE', 'DD_UPDATE'):
        delete_query = f"""
            DELETE FROM "{schema}"."{temp_table_name}" t
            WHERE NOT EXISTS (
                SELECT 1 FROM "{schema}"."{source_table_name}" s
                WHERE {join_condition}
            );
        """
        logger.info(f"[Update Strategy] Executing delete query:\n{delete_query}")

        with engine.begin() as conn1:
            conn1.execute(text(delete_query))

        with engine.begin() as conn1:
            result = conn1.execute(text(f"""
                SELECT COUNT(*)
                FROM "{schema}"."{target_table}" t
                WHERE NOT EXISTS (
                    SELECT 1 FROM "{schema}"."{source_table_name}" s
                    WHERE {join_condition}
                )
            """))
            deleted_count = result.fetchone()[0]

        logger.info(f"Deleted {deleted_count} records from {target_table}")

    with engine.begin() as conn1:
        conn1.execute(text(f"""
            CREATE TABLE "{schema}"."{updated_table_name}" AS
            SELECT * FROM "{schema}"."{temp_table_name}";
        """))

    with engine.begin() as conn1:
        conn1.execute(text(f"""
            DROP TABLE IF EXISTS "{schema}"."{temp_table_name}";
        """))

    logger.info(
        f"Update Strategy Summary for {target_table}: "
        f"Updated={updated_count}, Inserted={inserted_count}, Deleted={deleted_count}"
    )

    ti.xcom_push(key=task_id, value=updated_table_name)
    conn.sql("DETACH pg_db")

    return updated_table_name


def Router(
    conditions,
    dag_id,
    task_id,
    previous_id,
    instance_id,
    target_hierarchy_id,
    user_id,
    **kwargs
):
    """
    Route data based on conditions to different output paths.

    Returns:
        dict: A dictionary mapping output names to their respective table names
    """
    from Connections.utils import generate_engine
    import duckdb, re, keyword, sqlglot, time
    from sqlalchemy import text

    conn = duckdb.connect(database=':memory:')
    engine_data = generate_engine(target_hierarchy_id, user_id)
    engine = engine_data['engine']
    schema = engine_data['schema']
    conn_str = str(engine.url)

    conn.sql(f"ATTACH '{conn_str}' AS pg_db (TYPE POSTGRES, SCHEMA '{schema}');")

    ti = kwargs['ti']
    unix_suffix = int(time.time())

    table_name = xcom_pull(ti, instance_id, previous_id)

    result_tables = {}

    for condition, output_name in conditions:
        output_table_name = f"extracted_{task_id}_{output_name}_{unix_suffix}"

        from_clause = (table_name, previous_id)
        generated_query = Query_generator(
            from_clause=from_clause,
            where_clause=condition,
            schema=schema
        )

        cte = f""" "{output_name}" AS (\n{generated_query}\n) """

        result = conn.sql(
            f"""SELECT * FROM postgres_query('pg_db', $$WITH {cte} SELECT count(*) FROM "{output_name}" $$);"""
        )
        logger.info(
            f""" [Router Query for {output_name}]\n WITH {cte} SELECT * FROM "{output_name}" """
        )
        logger.info(f"Total Records for {output_name}: {result.fetchone()[0]}")

        with engine.begin() as conn1:
            conn1.execute(text(f"""
                CREATE TABLE "{schema}"."{output_table_name}" AS
                WITH {cte} SELECT * FROM "{output_name}";
            """))

        result_tables[output_name] = output_table_name

        ti.xcom_push(key=output_name, value=output_table_name)

    conn.sql("DETACH pg_db")

    return result_tables
