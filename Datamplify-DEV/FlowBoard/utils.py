
import os,logging
from Airflow.utils import replace_params_in_json
import pandas as pd
from Service.utils import flatten_document
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def xcom_pull(ti,task_id,value):
    return ti.xcom_pull(task_ids=task_id,key=value)

def quote_all_identifiers(sql,query_type='clickhouse',target_type='postgres'):
    """
    Using Sqlglot add quotes to every column and tablenames in query
    """
    import duckdb,re,keyword,sqlglot,time
    from sqlglot import exp
    sqlglot_dialects = {'postgresql':'postgres','oracle':'oracle','mysql':'mysql','sqlite':'sqlite','microsoftsqlserver':'tsql','snowflake':'snowflake','clickhouse':'clickhouse'}

    target_dialect = sqlglot_dialects.get(target_type.lower(),'postgres')
    read_dialect = sqlglot_dialects.get(query_type.lower(),'postgres')
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
        return new_tree.sql(dialect=target_dialect)

    except Exception as e:
        logger.info("Parsing error:", e)
        return sql


def quote_identifier(identifier):
    """
    Adding Quotes bases on Condition
    """
    import duckdb,re,keyword,sqlglot,time
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
        return f""" "{table_alias}"."{column_name}" """
    else:
        return quote_identifier(col_expr)
    
def Query_generator(source_attributes: list = [],attributes: list =[],from_clause: tuple =(),schema: str ='',join_list: list = None,where_clause: str = '',group_by_clause: list =None,having_clause: str = '',remove_duplicates:bool = False):
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
        alias, _, expr= col
        attribute_columns.append(f'{expr} AS "{alias}"')

    # Combine all columns
    all_columns = source_columns + attribute_columns
    columns = ',\n\t'.join(all_columns) if all_columns else '*'

    if schema !='' and schema !=None:
        schema +='.'
    else:
        schema=''
    from_class = f""" {schema}{from_clause[0]} AS {from_clause[1]} """

    join_clauses = ''
    if join_list  and join_list!=[]:
        join_clauses = '\n'.join(
            f""" {join_type.upper()} {schema}{table_name}  ON {condition} """
            for join_type, table_name,  condition in join_list
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




def Extract_from_Remote_Server_Files(hierarchy_id, file_path, dag_id, task_id, user_id,
                                     target_hierarchy_id, source_attributes, attributes,
                                     source_table_name,conf,ti=None):
    """
    Extract data from a remote server file (SFTP/FTP/SMB) and load into target Postgres DB.
    
    Handles large files efficiently using pandas chunking + DuckDB streaming insert.
    """
    from Connections.utils import generate_engine
    import duckdb,re,keyword,sqlglot,time
    from Connections import models as conn_models
    from Service.utils import SSHConnect
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
    generated_query = replace_params_in_json(generated_query,ti=ti)
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
    hierarchy_data = conn_models.Connections.objects.get(id=hierarchy_id,user_id=user_id)
    remote_conn_obj = conn_models.Remote_file_connections.objects.get(user_id = user_id,id = hierarchy_data.table_id)
    conn_type = remote_conn_obj.server_type.name.lower()
    host = remote_conn_obj.hostname
    username = remote_conn_obj.username
    password = remote_conn_obj.password
    port = remote_conn_obj.port

    # Step 5: Establish remote connection
    from Service.utils import decode_value
    response = SSHConnect(conn_type, host, username, decode_value(password), port)
    if response['status'] != 200:
        return {'status': 400, 'message': response['message']}

    # Step 6: Extract and load data
    connection = response['sftp_client']
    source_file_params = conf.get("source", None)
    if source_file_params:
        source_param_map = {p["id"]: p.get("value") for p in source_file_params}
        if task_id in source_param_map:
            file_path = source_param_map[task_id]
    try:
        if conn_type == "sftp":
            # Read remote file in chunks and stream to DuckDB/Postgres
            try:
                with connection.open(file_path, "rb") as remote_file:
                    for chunk in pd.read_csv(remote_file, chunksize=100000):
                        conn.register("chunk_df", chunk)
                        conn.execute(f"""
                            CREATE TABLE IF NOT EXISTS target_db.{target_table_name} AS 
                            SELECT {extract_columns} FROM chunk_df;
                        """)
            except Exception as e:
                raise Exception(e)
        elif conn_type == "ftp":
            import io
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
            # SMB read logic (read into buffer)
            import io
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
def Extract_from_CSV(csv_path,dag_id,task_id,user_id,target_hierarchy_id,source_attributes,attributes,source_table_name,hierarchy_id,ti=None):
    """
    Extract CSV Data from Source File then Dump into Target database as temp table
    
    """
    from Connections.utils import generate_engine
    import duckdb,re,keyword,sqlglot,time
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
    generated_query = replace_params_in_json(generated_query,ti=ti)
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

    # if csv_path:
    #     type ='csv'
    #     host = "202.65.155.123"
    #     username = "ubuntu"
    #     password = "YLW2Lr0WBz72"
    #     remote_path = "/var/www/Datamplify/"
    #     connection_type='sftp'
    #     sftp = SSHConnect(connection_type,host,username,password)
    #     with sftp.open("/remote/csv_files/large.csv", "rb") as f:
    #         for chunk in pd.read_csv(f, chunksize=100000):
    #             # Register chunk as temp view
    #             conn.register("chunk_df", chunk)
                
    #             # Insert chunk into DuckDB table
    #             conn.execute(f"""
    #                 CREATE TABLE if not exists target_db.{target_table_name} AS 
    #             SELECT {extract_columns} FROM read_csv_auto(chunk_df, AUTO_DETECT=TRUE);
    #             """)
    # else:
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
    return {'status': 200,'target_table':target_table_name,'query': cte}

def mongodb_insertion(source_attributes,source_engine,table_name,target_schema,target_table_name):
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

    collection  = source_engine[table_name]
    cursor = collection.find({}, projection)
    documents = [flatten_document(doc) for doc in cursor]
    if not documents:
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
        if "_id" in df.columns:
            df["_id"] = df["_id"].astype(str)

    import json

    for col in df.columns:
        df[col] = df[col].apply(
            lambda x: json.dumps(x) if isinstance(x, (dict, list)) else x
        )
    return df

import re

def Extract_from_Integrations(hierarchy_id, user_id,tables_list, table_name, task_id, dag_id,
                           source_attributes, attributes, target_hierarchy_id,ti):

    from Controller import Orchastera
    import time
    unix_suffix = int(time.time())

    target_table_name = f"extracted_{task_id}_{unix_suffix}"

    orch_data = Orchastera(hierarchy_id,target_hierarchy_id,user_id,table_name,target_table_name,source_attributes) 
    
    relations = orch_data.extractor.Load_data(table_name)
    # table_name =re.sub(r"[^a-zA-Z0-9_]", "_", tables_list[0])
    # from_clause = (table_name,table_name)
    
    # join_index = {}

    # for p, c, pk, fk in relations:
    #     join_index[p] = (p, c, pk, fk)
    #     join_index[c] = (p, c, pk, fk)

    # join_list = []

    # for table in tables_list[1:]:
    #     if table in join_index:
    #         p, c, pk, fk = join_index[table]
    #         join_list.append(('LEFT JOIN', table, f"{p}.{pk}= {c}.{fk}"))
    base_table = re.sub(r"[^a-zA-Z0-9_]", "_", tables_list[0])
    from_clause = (base_table, base_table)
    if len(tables_list)>1:

        join_index = {}
        for p, c, pk, fk in relations:
            join_index.setdefault(p, (p, c, pk, fk))
            join_index.setdefault(c, (p, c, pk, fk))


        join_list = [
            ('LEFT JOIN', table, f"{join_index[table][0]}.{join_index[table][2]} = {join_index[table][1]}.{join_index[table][3]}")
            for table in tables_list[1:] if table in join_index
        ]
    else:
        join_list=[]
    
    generated_query = Query_generator(
        source_attributes=source_attributes,
        attributes=attributes,
        from_clause=from_clause,
        schema=f'"{orch_data.extractor.database}"',
        join_list = join_list,
        # read_type = orch_data.context.target_conn_info['type'].lower()
    )

    generated_query = replace_params_in_json(generated_query,ti=ti)

    cte = f""" {task_id} AS (\n{generated_query}\n)"""

    logger.info(f""" Query: WITH {cte} SELECT * FROM "{task_id}" """)
    
    Total_attributes = source_attributes+attributes

    orch_query =quote_all_identifiers(f""" WITH {cte} SELECT * FROM {task_id} """,'postgresql',orch_data.context.target_conn_info['type'].lower())

    result = orch_data.run(orch_query,target_table_name,Total_attributes)

    return {
        'status': 200,
        'target_table': target_table_name,
        'query':cte
    }


def Extract_from_database(hierarchy_id, user_id, table_name, task_id, dag_id,
                           source_attributes, attributes, target_hierarchy_id,ti):
    """
    Extract Table Data from Source Connection then Dump into Target database as temp table 
    """
    # from Connections.utils import generate_engine
    # import duckdb,re,keyword,sqlglot,time
    from Controller import Orchastera
    import time
    unix_suffix = int(time.time())

    target_table_name = f"extracted_{task_id}_{unix_suffix}"

    orch_data = Orchastera(hierarchy_id,target_hierarchy_id,user_id,table_name,target_table_name,source_attributes) 

    source_schema =orch_data.context.source_conn_info['schema'] 
    target_schema = orch_data.context.target_conn_info['schema']

    from_clause = (table_name, task_id)
    generated_query = Query_generator(
        source_attributes=source_attributes,
        attributes=attributes,
        from_clause=from_clause,
        schema=source_schema,
        # read_type = orch_data.context.target_conn_info['type'].lower()
    )

    generated_query = replace_params_in_json(generated_query,ti=ti)
    cte = f""" "{task_id}" AS (\n{generated_query}\n)"""
    logger.info(f""" Query: WITH {cte} SELECT * FROM "{task_id}" """)

    full_target_table = f"target_db.{target_schema}.{target_table_name}"

    orch_query =quote_all_identifiers(f""" WITH {cte} SELECT * FROM {task_id} """,'postgresql',orch_data.context.target_conn_info['type'].lower())

    Total_attributes = source_attributes+attributes

    result = orch_data.run(orch_query,target_table_name,Total_attributes)

    if orch_data.context.source_conn_info['type'].lower() in ['mongodb']:
        source_schema = target_schema

    cte = cte.replace(source_schema,target_schema)

    return {
        'status': 200,
        'target_table': target_table_name,
        'query':cte
    }

	
def Strategy_key(strategy,schema,target_table,source_columns,table_name,previous_id,update_columns_str,joins=None):
    queries = []
    if schema !='' and schema !=None:
        schema +='.'
    else:
        schema=''
    match strategy.lower():
        case 'append':
            queries.append(f"""
                Insert into {schema}"{target_table}" select {source_columns} from {schema}"{table_name}"                
                """)
        case 'insert':
            queries.append(f"""
                Insert into {schema}"{target_table}"
                select {source_columns} from {schema}"{table_name}"  as "{previous_id}" where not exists (select 1 from {schema}"{target_table}" as "{target_table}" where {joins})
                """)
        case 'update':
            queries.append(f"""
                update {schema}"{target_table}" as "{target_table}"
                set {update_columns_str} from {schema}"{table_name}" as "{previous_id}" where {joins}
                """)
        case 'upsert':
            queries.append(f"""
                update {schema}"{target_table}" as "{target_table}"
                set {update_columns_str} from {schema}"{table_name}" as "{previous_id}" where {joins}
                """)
            queries.append(f"""
                Insert into {schema}"{target_table}"
                select {source_columns} from {schema}"{table_name}"  as "{previous_id}" where not exists (select 1 from {schema}"{target_table}" as "{target_table}" where {joins})
                """)
        case 'delete':
            queries.append(f"""
                Delete from {schema}"{target_table}" as "{target_table}"
                where Exists (select 1 from {schema}"{table_name}" as "{previous_id}" where {joins})
                """)
        case 'dd_update':
            queries.append(f"""
                Delete from {schema}"{target_table}" as "{target_table}"
                where not Exists (select 1 from {schema}"{table_name}" as "{previous_id}" where {joins})"""
                )
            
        case 'truncate_and_insert':
            queries.append(f'Truncate Table if Exists {schema}"{target_table}"')
            queries.append(f'Insert into {schema}"{target_table}" as "{target_table}" select {source_columns} from {schema}"{table_name}"')
        case 'replace_table':
            queries.append(f'Drop Table if Exists {schema}"{target_table}"')
            queries.append(f'Create Table {schema}"{target_table}" as select {source_columns} from {schema}"{table_name}"')
            queries.append(f'Insert into {schema}"{target_table}"  select {source_columns} from {schema}"{table_name}"')
    return queries

# Target into CSV and Remote server code in Service.utils FIle

def Load_into_database(hierarchy_id, user_id, truncate_table, create_table, target_table, attribute_mapper,previous_id, extract_table_name,strategy,join_key=None):
    """
    Load Transformed Data into Target Database
    """
    from Connections.utils import generate_engine
    import duckdb,re,keyword,sqlglot,time
    from sqlalchemy import text


    with duckdb.connect(database=':memory:') as conn:

        engine_data = generate_engine(hierarchy_id, user_id=user_id)
        engine = engine_data['engine']
        schema = engine_data['schema']
        type = engine_data['type']
        cursor = engine.connect()
        if truncate_table:
            cursor.execute(f'TRUNCATE TABLE {schema}."{target_table}"')
            logger.info(f"Table Truncated: {target_table}")
        if create_table:
            create_query = f'''
                CREATE TABLE "{schema}"."{target_table}" AS 
                SELECT *
                FROM  {schema}.{extract_table_name}
                WHERE 1 = 0
            '''
            # for snowflake
            # create_query = f""" SELECT *
            #     INTO {target_table}
            #     FROM {extract_table_name}
            #     WHERE 1 = 0;"""

            final_query = quote_all_identifiers(create_query,'postgresql',type.lower())
            cursor.execute(text(final_query))

            logger.info(f"Table Created {target_table}")
            update_columns_str = f""
            source_columns = ' * '
            joins=None
        else:
            # table_params1 = ', '.join(f"{i[0]}" for i in attribute_mapper)
            # table_params = f"({table_params1})"
            # trans_params = ', '.join(f""" cast("{i[2]}" as {i[3]}) as "{i[0]}" """ for i in attribute_mapper)
            source_columns_values = []
            update_columns = []
            for i in attribute_mapper:
                source_columns_values.append(f""" cast({process_column_expression(i[2])} as {i[3]}) as "{i[0]}" """)
                update_columns.append(f' "{i[0]}" = {process_column_expression(i[2])}')
            source_columns = ', '.join(source_columns_values)
            update_columns_str = ', '.join(update_columns)
            if join_key:
                join_cond = []
                for cond in join_key:
                    join_cond.append(f""" "{target_table}".{cond.get('target')} = "{previous_id}".{cond.get('source')} """)

                joins = ' AND '.join(join_cond)
            else:
                joins = ''

        result_count = cursor.execute(text(f"""SELECT count(*) FROM "{schema}"."{extract_table_name}";"""))
        row_count = result_count.fetchone()[0]
        
        queries = Strategy_key(strategy,schema,target_table,source_columns,extract_table_name,previous_id,update_columns_str,joins)
        for query in queries:
            with engine.connect() as conn1:
                trans = conn.begin()
                try:
                    ex_query = quote_all_identifiers(query,'postgresql',type.lower())
                    conn1.execute(text(ex_query))
                except Exception as e:
                    trans.rollback()
                    raise Exception('Error',e)
                    
                finally:
                    trans.commit()

        # if row_count >0:
        #     # insert_query = f"""
        #     # INSERT INTO "{schema}"."{target_table}" {table_params}
        #     # SELECT {trans_params}
        #     # FROM (SELECT * FROM "{schema}"."{extract_table_name}") AS "{extract_table_name}"
        #     # """
        #     # logger.info(f"{insert_query}")
        #     # result = cursor.execute(text(insert_query))
        #     batch_size = 10000000
        #     offset = 0

        #     while offset <=row_count:
        #         insert_query = f"""
        #         INSERT INTO "{schema}"."{target_table}" {table_params}
        #         SELECT {trans_params}
        #         FROM (
        #             SELECT * FROM "{schema}"."{extract_table_name}"
        #             LIMIT {batch_size} OFFSET {offset}
        #         ) AS "{extract_table_name}";
        #         """
        #         # logger.info(f"Executing batch: {offset} → {offset + batch_size}")
        #         # logger.debug(f"Query: {insert_query}")

        #         cursor.execute(text(insert_query))
        #         offset += batch_size

        #     logger.info(f"✅ All {row_count} rows inserted successfully into {target_table}.")
        # else:
        #     logger.info(f"No records found in source table {extract_table_name}.")
        logger.info(f"Total Records inserted into {target_table} : {row_count}")
        conn.commit()

    return {'status': 200, 'message': 'success'}




def Delete_temp_tables(sources,hierarchy_id,user_id,**kwargs):
    """
    Deleting all temp tables created in Transformation 
    """
    from Connections.utils import generate_engine
    from sqlalchemy import text


    ti = kwargs['ti']
    engine_data = generate_engine(hierarchy_id,user_id)
    engine = engine_data['engine']
    schema = engine_data['schema']
    with engine.connect() as connection:
        for id, value in sources:
            table_name = xcom_pull(ti,id,value)
            if table_name:
                drop_query = text(f'DROP TABLE IF EXISTS "{schema}"."{table_name}";')
                connection.execute(drop_query)
            else:
                pass
    return True


def Extraction(dag_id,task_id,source_type,path,hierarchy_id,user_id,tables_list,source_table_name,source_attributes,attributes,target_hierarchy_id,**context):
        """
        Extract Data from source connection and load into target connection
        """
        ti = context['ti']
        if source_type.lower() == 'file':
            logger.info("[INFO] Source is CSV")
            csv_extract = Extract_from_CSV(path,dag_id,task_id,user_id,target_hierarchy_id,source_attributes,attributes,source_table_name,hierarchy_id,ti=ti)
            if csv_extract['status'] == 200:
                query = csv_extract['query']
                ti.xcom_push(key=task_id, value=query)
                ti.xcom_push(key=task_id, value=csv_extract['target_table'])
                return query
            else:
                logger.error(f"""[Error] {csv_extract['message']}""")
        elif source_type.lower() =='remote_server':
            conf = context.get('dag_run').conf or {}

            remote_extract = Extract_from_Remote_Server_Files(hierarchy_id,path,dag_id,task_id,user_id,target_hierarchy_id,source_attributes,attributes,source_table_name,conf,ti)
            if remote_extract['status'] == 200:
                query = remote_extract['query']
                ti.xcom_push(key=task_id, value=remote_extract['target_table'])
                # kwargs['ti'].xcom_push(key=source_table_name, value=remote_extract['target_table'])
                return query
            else:
                logger.error(f"""[Error] {remote_extract['message']}""")
        elif source_type.lower() == 'database':
            db_extract = Extract_from_database(hierarchy_id,user_id,source_table_name,task_id,dag_id,source_attributes,attributes,target_hierarchy_id,ti)
            if db_extract['status'] == 200:
                query = db_extract['query']

                ti.xcom_push(key=task_id, value=db_extract['target_table'])
                return query
            else:
                logger.error(f"""[Error] {db_extract['message']}""")
        elif source_type.lower() =='integrations':
            db_extract = Extract_from_Integrations(hierarchy_id,user_id,tables_list,source_table_name,task_id,dag_id,source_attributes,attributes,target_hierarchy_id,ti)
            if db_extract['status'] == 200:
                query = db_extract['query']

                ti.xcom_push(key=task_id, value=db_extract['target_table'])
                return query
            else:
                logger.error(f"""[Error] {db_extract['message']}""")


def Loading(hierarchy_id,user_id,dag_id,truncate,create,format,previous_id,instance_id,target_table_name,attribute_mapper,sources,join_key = None,strategy='APPEND',**kwargs):
        ti = kwargs['ti']
        if format.lower() == 'csv':
            pass
        elif format.lower() == 'database':
            previous_query = xcom_pull(ti,instance_id,previous_id)
            table_name = xcom_pull(ti,instance_id,previous_id)
            db_load = Load_into_database(hierarchy_id,user_id, truncate,create, target_table_name,attribute_mapper,previous_id,table_name,strategy,join_key)
            if db_load['status'] ==200:
                logger.info(' Data Dumped into Target Database')
                deletetion_confirmation = Delete_temp_tables(sources,hierarchy_id,user_id,**kwargs)
                logger.info(deletetion_confirmation)
            else:
                logger.error({db_load['message']})
        else:
            pass



def ETL_Filter(filter_condition, instance_id,dag_id, task_id, previous_id, target_hierarchy_id, user_id,sources, **kwargs):
    """
    Filter The raw Data Based on Condition
    """
    from Connections.utils import generate_engine
    import duckdb,re,keyword,sqlglot,time   
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

    table_name = xcom_pull(ti,instance_id,previous_id)
    from_clause = (table_name, previous_id)
    generated_query = Query_generator(from_clause=from_clause, where_clause=filter_condition,schema=schema)
    generated_query = replace_params_in_json(generated_query,ti=ti)

    cte = f""" "{task_id}" AS (\n{generated_query}\n) """


    result = conn.sql(f"""SELECT * FROM postgres_query('pg_db', $$WITH  {cte} SELECT count(*) FROM "{task_id}" $$);""")
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



def Expressions(Expression_list, dag_id, task_id, previous_id, instance_id,target_hierarchy_id, user_id,sources, **kwargs):
    ti = kwargs['ti']
    from Connections.utils import generate_engine
    import duckdb,re,keyword,sqlglot,time
    from sqlalchemy import text




    unix_suffix = int(time.time())
    target_table_name = f"extracted_{task_id}_{unix_suffix}"

    table_name = xcom_pull(ti,instance_id,previous_id)

    conn = duckdb.connect(database=':memory:')
    engine_data = generate_engine(target_hierarchy_id, user_id)
    engine = engine_data['engine']
    schema = engine_data['schema']

    conn.sql(f"ATTACH '{str(engine.url)}' AS pg_db (TYPE POSTGRES, SCHEMA '{schema}');")
    
    from_clause = (table_name, previous_id)    
    generated_query = Query_generator(attributes=Expression_list,from_clause=from_clause,schema=schema)
    generated_query = replace_params_in_json(generated_query,ti=ti)
    new_cte_query = f""" "{task_id}"  AS (\n{generated_query}\n) """

    result = conn.sql(f"""SELECT * FROM postgres_query('pg_db', $$WITH {new_cte_query} SELECT count(*) FROM "{task_id}" $$);""")
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



def Join(primary_table, joining_list, where_clause, dag_id, task_id, previous_id, instance_id,attributes, target_hierarchy_id, user_id,sources, **kwargs):
    from Connections.utils import generate_engine
    import duckdb,re,keyword,sqlglot,time
    from sqlalchemy import text


    ti = kwargs['ti']
    unix_suffix = int(time.time())
    target_table_name = f"extracted_{task_id}_{unix_suffix}"


    engine_data = generate_engine(target_hierarchy_id, user_id=user_id)
    engine = engine_data['engine']
    schema = engine_data['schema']

    from_clause = (primary_table,primary_table)
    generated_query = Query_generator(attributes=attributes,join_list=joining_list,where_clause=where_clause,from_clause=from_clause,schema=schema)
    generated_query = replace_params_in_json(generated_query,ti=ti)
    logger.info(f" generated _query {generated_query}")
    for pid,instance in zip(previous_id,instance_id):
        table_name = xcom_pull(ti,instance,pid)
        pattern = rf'\b{re.escape(pid)}\b'
        if re.search(pattern, generated_query):
            generated_query = re.sub(pattern,  table_name, generated_query) 

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
    return new_cte_query



def Remove_duplicates(group_attributes, having_clause, task_id, dag_id, previous_id,instance_id, attributes, hierarchy_id, user_id,sources,**kwargs):
    from Connections.utils import generate_engine
    import duckdb,re,keyword,sqlglot,time
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

    table_name = xcom_pull(ti,instance_id,previous_id)
    from_clause = (table_name, previous_id)
    generated_query = Query_generator(
        source_attributes=group_attributes,
        attributes=attributes,
        group_by_clause=group_attributes,
        having_clause=having_clause,
        from_clause=from_clause,
        schema=schema
    )
    generated_query = replace_params_in_json(generated_query,ti=ti)

    cte = f""" "{task_id}" AS (\n{generated_query}\n) """

    result = conn.sql(f""" SELECT * FROM postgres_query('pg_db', $$WITH  {cte} SELECT count(*) FROM "{task_id}" $$);""")
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






def Rank(source_attributes,order_by_cols,partition_by_cols,rank_col_name,Records,rank_type, dag_id, task_id, previous_id, instance_id,target_hierarchy_id, user_id, sort, **kwargs):
    """
    Assigns ranking values to rows in a dataset based on specified columns.

    Args:
        rank_by_cols (list): List of columns to rank by
        rank_type (str): Type of rank to apply: 'RANK', 'DENSE_RANK', 'ROW_NUMBER', or 'NTILE'
        partition_by_cols (list): List of columns to partition by (optional)
        output_col (str): Name of the output column to contain the rank values
        dag_id (str): DAG identifier
        task_id (str): Task identifier
        previous_id (str): Previous task identifier to pull data from
        target_hierarchy_id (str): Target hierarchy identifier
        user_id (str): User identifier
        sources (list): Source information
        ascending (bool): Whether to rank in ascending (True) or descending (False) order
        include_ties (bool): Whether to include ties in ranking
        **kwargs: Additional keyword arguments

    Returns:
        str: Name of the created output table
    """
    from Connections.utils import generate_engine
    import duckdb,re,keyword,sqlglot,time
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

    # Get source table name
    source_table_name = xcom_pull(ti,instance_id,previous_id)

    # Determine the correct rank function based on rank_type
    rank_function = rank_type.upper()
    if rank_function not in ['RANK', 'DENSE_RANK', 'ROW_NUMBER', 'NTILE']:
        # Default to RANK if invalid type provided
        rank_function = 'RANK'

    # Format the ORDER BY clause
    order_direction = ' DESC' if sort.lower() == 'top' else 'ASC'
    order_by_clause = ", ".join([f'"{previous_id}"."{col}" {order_direction}' for col in order_by_cols])

    # Format the PARTITION BY clause if partition columns are provided
    partition_by_clause = ""
    if partition_by_cols and len(partition_by_cols) > 0:
        partition_by_str = ", ".join([f'"{previous_id}"."{col}"' for col in partition_by_cols])
        partition_by_clause = f"PARTITION BY {partition_by_str}"

    

    
    rank_attribute = [(rank_col_name, 'Integer', f'{rank_function}() OVER ({partition_by_clause} ORDER BY {order_by_clause})')]
    where_condtion = f"{rank_col_name} <= {Records}"
    # Generate the query using Query_generator
    from_clause = (source_table_name, previous_id)
    generated_query = Query_generator(
        source_attributes=source_attributes,
        attributes=rank_attribute,
        from_clause=from_clause,
        schema=schema,
    )
    generated_query = replace_params_in_json(generated_query,ti=ti)
    
    # Create CTE
    cte = f""" "{task_id}" AS (
        select * from ({generated_query}) temp where {where_condtion}
        )"""
    logger.info(f"[Rank Transformation] Generated query with Query_generator:\n{cte}")

    # Execute the query and create the target table using the generated query
    with engine.begin() as conn1:
        conn1.execute(text(f"""
            CREATE TABLE "{schema}"."{target_table_name}" AS
            WITH {cte} SELECT * FROM "{task_id}";
        """))

    # Count records in result
    with engine.begin() as conn1:
        result = conn1.execute(text(f"""
            SELECT COUNT(*) FROM "{schema}"."{target_table_name}"
        """))
        total_count = result.fetchone()[0]

    logger.info(f"Rank transformation created table with {total_count} total records")

    # Store result table name in XCom
    ti.xcom_push(key=task_id, value=target_table_name)
    conn.sql("DETACH pg_db")

    return cte




def Normalizer(group_by_cols, pivot_col, value_cols, output_cols, dag_id, task_id, previous_id, target_hierarchy_id, user_id, **kwargs):
    """
    Converts denormalized (pivoted) data into normalized form, similar to unpivoting or melting data.

    Args:
        group_by_cols (list): List of columns to group by (remain as-is)
        pivot_col (str): Name of the output column to contain the pivoted column names
        value_cols (list): List of columns to be normalized (unpivoted)
        output_cols (list): Names of output columns for the normalized data
        dag_id (str): DAG identifier
        task_id (str): Task identifier
        previous_id (str): Previous task identifier to pull data from
        target_hierarchy_id (str): Target hierarchy identifier
        user_id (str): User identifier
        sources (list): Source information
        **kwargs: Additional keyword arguments

    Returns:
        str: Name of the created output table
    """
    from Connections.utils import generate_engine

    conn = duckdb.connect(database=':memory:')
    engine_data = generate_engine(target_hierarchy_id, user_id)
    engine = engine_data['engine']
    schema = engine_data['schema']
    conn_str = str(engine.url)

    conn.sql(f"ATTACH '{conn_str}' AS pg_db (TYPE POSTGRES, SCHEMA '{schema}');")

    ti = kwargs['ti']
    unix_suffix = int(time.time())
    target_table_name = f"extracted_{task_id}_{unix_suffix}"

    # Get source table name
    source_table_name = xcom_pull(ti,previous_id,previous_id)

    # Build UNION ALL queries for each value column to normalize using Query_generator
    union_queries = []

    for value_col in value_cols:
        # Create attributes for Query_generator
        source_attributes = [(col, 'string', f't."{col}"') for col in group_by_cols]
        pivot_attributes = [
            (pivot_col, 'string', f"'{value_col}'"),
            (output_cols[0], 'string', f't."{value_col}"')
        ]

        # Generate query for this value column
        from_clause = (source_table_name, 't')
        where_clause = f't."{value_col}" IS NOT NULL'

        generated_query = Query_generator(
            source_attributes=source_attributes,
            attributes=pivot_attributes,
            from_clause=from_clause,
            schema=schema,
            where_clause=where_clause
        )
        generated_query = replace_params_in_json(generated_query,ti=ti)

    #     union_queries.append(generated_query)

    # # Combine all queries with UNION ALL
    # combined_query = " UNION ALL ".join(union_queries)

    # Create CTE
    cte = f""" "{task_id}" AS (
        {combined_query}
        )"""
    logger.info(f"[Normalizer Transformation] Generated query with Query_generator:\n{cte}")

    # Execute the combined query and create the target table
    with engine.begin() as conn1:
        conn1.execute(text(f"""
            CREATE TABLE "{schema}"."{target_table_name}" AS
            {combined_query}
        """))

    # Count records in result
    with engine.begin() as conn1:
        result = conn1.execute(text(f"""
            SELECT COUNT(*) FROM "{schema}"."{target_table_name}"
        """))
        total_count = result.fetchone()[0]

    logger.info(f"Normalizer transformation created table with {total_count} total records")

    # Store result table name in XCom
    ti.xcom_push(key=task_id, value=target_table_name)
    conn.sql("DETACH pg_db")

    return target_table_name


def Pivot(group_by_cols,pivot_col,value_col,agg_func,pivot_values,dag_id,task_id,previous_id,instance_id,target_hierarchy_id,user_id,**kwargs):
    """
    Pivot transformation: Converts rows into columns based on pivot column values.

    Args:
        group_by_cols (list): Columns to keep as-is (remain in output).
        pivot_col (str): Column whose distinct values become new columns.
        value_col (str): Column to aggregate (e.g. sales amount).
        agg_func (str): Aggregation function to apply (SUM, AVG, COUNT...).
        pivot_values (list): Explicit values in pivot_col that become columns.
        dag_id (str): DAG identifier.
        task_id (str): Task identifier.
        previous_id (str): Previous task identifier to pull data from.
        target_hierarchy_id (str): Target hierarchy identifier.
        user_id (str): User identifier.
        **kwargs: Additional keyword args (e.g. Airflow task instance).

    Returns:
        str: Name of the created pivoted table.
    """
    from Connections.utils import generate_engine
    import duckdb,re,keyword,sqlglot,time
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

    # Get source table name from XCom
    table_name = xcom_pull(ti,instance_id,previous_id)


    # Build SELECT list
    # group by cols
    # for col in group_by_cols:
    #     select_parts.append(f't."{col}"')

    # pivoted cols
    attributes = []
    NUMERIC_TOKENS = {"smallint","integer","bigint","decimal","numeric","real","double precision","float","int","int4","int8"}
    def is_numeric_type(dt):
        if not dt:
            return False
        dt = dt.lower()
        # crude but practical check
        return any(tok in dt for tok in NUMERIC_TOKENS)

    for val in pivot_values:
    # escape single quotes in pivot value
        val_esc = str(val).replace("'", "''")
        for m in value_col:
            dt = m['dtype']
            agg = agg_func.upper()
            v_col = m['column']
            alias_col_name = f"{v_col}_{val_esc}"

            if is_numeric_type(dt):
                # numeric column: safe to use SUM/AVG/MAX/MIN etc. with ELSE 0 for SUM/AVG
                if agg == "COUNT":
                    expr = f'COUNT(CASE WHEN "{previous_id}"."{pivot_col}" = \'{val_esc}\' THEN "{previous_id}"."{v_col}" ELSE NULL END) '
                elif agg in ("SUM", "AVG", "MAX", "MIN"):
                    # For AVG it's sometimes better to leave ELSE NULL, but ELSE 0 is also common for SUM.
                    else_part = "0" if agg == "SUM" else "NULL"
                    expr = f'{agg}(CASE WHEN "{previous_id}"."{pivot_col}" = \'{val_esc}\' THEN "{previous_id}"."{v_col}" ELSE {else_part} END) '
                else:
                    # generic: use agg with numeric-safe ELSE 0
                    expr = f'{agg}(CASE WHEN "{previous_id}"."{pivot_col}" = \'{val_esc}\' THEN "{previous_id}"."{v_col}" ELSE 0 END) AS '
            else:
                # non-numeric: cannot SUM strings. Use COUNT (occurrences) or use MAX/MIN to pick a sample.
                if agg == "COUNT":
                    expr = f'COUNT(CASE WHEN "{previous_id}"."{pivot_col}" = \'{val_esc}\' THEN "{previous_id}"."{v_col}" ELSE NULL END) '
                elif agg in ("MAX", "MIN"):
                    expr = f'{agg}(CASE WHEN "{previous_id}"."{pivot_col}" = \'{val_esc}\' THEN "{previous_id}"."{v_col}" ELSE NULL END) '
                else:
                    # fallback: COUNT of occurrences (safe)
                    expr = f'COUNT(CASE WHEN "{previous_id}"."{pivot_col}" = \'{val_esc}\' THEN "{previous_id}"."{v_col}" ELSE NULL END) '

            attributes.append([alias_col_name, dt, expr])
    source_attributes  = []
    for index in group_by_cols:
        col_list = [index,"",index]
        source_attributes.append(col_list)




    # Final query
    from_clause = (table_name, previous_id)
    generated_query = Query_generator(
        source_attributes=source_attributes,
        attributes=attributes,
        from_clause=from_clause,
        schema=schema,
        group_by_clause=source_attributes
    )
    generated_query = replace_params_in_json(generated_query,ti=ti)
    cte = f""" "{task_id}" AS (\n{generated_query}\n)"""
    logger.info(f"[Pivot Transformation] Generated Query:\n{cte}")

    # Count records
    result = conn.sql(f"""SELECT * FROM postgres_query('pg_db', $$WITH  {cte} SELECT count(*) FROM "{task_id}" $$);""")
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


def Union(previous_ids, instance_id,column_mappings, type, dag_id, task_id, target_hierarchy_id, user_id, **kwargs):
    """
    Combines data from multiple input sources into a single output, similar to Informatica Union transformation.

    Args:
        previous_ids (list): List of previous task IDs to pull data from
        column_mappings (list): List of output column mappings, where each mapping is:
                               [(output_column, [source1_column, source2_column, ...]), ...]
        remove_duplicates (bool): Whether to remove duplicate rows from the result
        dag_id (str): DAG identifier
        task_id (str): Task identifier
        target_hierarchy_id (str): Target hierarchy identifier
        user_id (str): User identifier
        sources (list): Source information
        **kwargs: Additional keyword arguments

    Returns:
        str: Name of the created output table
    """
    from Connections.utils import generate_engine
    import duckdb,re,keyword,sqlglot,time
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

    # Get source table names
    source_tables = []
    for instance,prev_id in zip(previous_ids,instance_id):
        table_name = xcom_pull(ti,instance,prev_id)
        source_tables.append((table_name, prev_id))

    # Build UNION query for each source using Query_generator
    union_queries = []

    for idx, (source_table, prev_id) in enumerate(source_tables):
        attributes = []

        for mapping in column_mappings:
            alias_name = mapping["aliasName"]

            if idx < len(mapping["columns"]) and mapping["columns"][idx]:
                col_name = mapping["columns"][idx]["col"]
                attributes.append((alias_name, '', f'"{col_name}"'))
            else:
                # No mapping -> use NULL::dtype for type consistency
                dtype = mapping["columns"][0]["dtype"] if mapping["columns"] else "text"
                attributes.append((alias_name, '', f'NULL'))

        # Generate query for this source
        from_clause = (source_table, source_table)

        generated_query = Query_generator(
            attributes=attributes,
            from_clause=from_clause,
            schema=schema
        )
        generated_query = replace_params_in_json(generated_query,ti=ti)

        union_queries.append(generated_query)

    # Combine all source queries with UNION or UNION ALL
    combined_query = f" {type} ".join(union_queries)

    # Create CTE
    cte = f""" "{task_id}" AS (
        {combined_query}
        )"""
    logger.info(f"[Union Transformation] Generated query with Query_generator:\n{cte}")

    # Execute the combined query and create the target table
    with engine.begin() as conn1:
        conn1.execute(text(f"""
            CREATE TABLE "{schema}"."{target_table_name}" AS
            {combined_query}
        """))

    # Count records in result
    with engine.begin() as conn1:
        result = conn1.execute(text(f"""
            SELECT COUNT(*) FROM "{schema}"."{target_table_name}"
        """))
        total_count = result.fetchone()[0]

    logger.info(f"Union transformation created table with {total_count} total records")

    # Store result table name in XCom
    ti.xcom_push(key=task_id, value=target_table_name)
    conn.sql("DETACH pg_db")

    return target_table_name


def Updatestrategy(source_attributes,target_table,join_key,dag_id,task_id,previous_id,target_hierarchy_id,user_id,strategy='APPEND',**kwargs):
    from Connections.utils import generate_engine
    import duckdb,re,keyword,sqlglot,time
    from sqlalchemy import text


    conn = duckdb.connect(database=':memory:')
    engine_data = generate_engine(target_hierarchy_id, user_id)
    engine = engine_data['engine']
    schema = engine_data['schema']

    ti = kwargs['ti']
    unix_suffix = int(time.time())
    target_table_name = f"extracted_{task_id}_{unix_suffix}"
    table_name = xcom_pull(ti,previous_id,previous_id)
    from_clause = (table_name, previous_id)
    generated_query = Query_generator(
        source_attributes=source_attributes,
        from_clause=from_clause,
        schema=schema
    )
    generated_query = replace_params_in_json(generated_query,ti=ti)
    cte = f""" "{task_id}" AS (\n{generated_query}\n) """
    source_columns_values = []
    update_columns = []
    for col in source_attributes:
        if len(col) == 4:
            alias, _, full_col_expr, _ = col
        elif len(col) == 3:
            alias, _, full_col_expr = col
        else:
            raise ValueError(f"Invalid source_attribute format: {col}")
        processed_expr = process_column_expression(full_col_expr)
        source_columns_values.append(f'{processed_expr} AS {quote_identifier(alias)}')
        update_columns.append(f' {alias} = source.{alias}')
    source_columns = ', '.join(source_columns_values)
    update_columns_str = ', '.join(update_columns)

    join_cond = []
    for cond in join_key:
        join_cond.append(f"target.{cond.get('target')} = source.{cond.get('source')}")

    joins = ' AND '.join(join_cond)
    # queries = []
    # match strategy.lower(): 
        # case 'append':
        #     queries.append(f"""
        #         Insert into {schema}."{target_table}" select {source_columns} from {schema}."{table_name}"                 
        #         """)
        # case 'insert':
        #     queries.append(f"""
        #         Insert into {schema}."{target_table}" 
        #         select {source_columns} from {schema}."{table_name}"  as source where not exists (select 1 from {schema}."{target_table}" as target where {joins})
        #         """)
        # case 'update': # ✅
        #     queries.append(f"""
        #         update {schema}."{target_table}" as target
        #         set {update_columns_str} from {schema}."{table_name}" as source where {joins}
        #         """)
        # case 'upsert':
        #     queries.append(f"""
        #         update {schema}."{target_table}" as target
        #         set {update_columns_str} from {schema}."{table_name}" as source where {joins}
        #         """)
        #     queries.append(f"""
        #         Insert into {schema}."{target_table}" 
        #         select {source_columns} from {schema}."{table_name}"  as source where not exists (select 1 from {schema}."{target_table}" as target where {joins})
        #         """)
        # case 'delete':
        #     queries.append(f"""
        #         Delete from {schema}."{target_table}" as target 
        #         where Exists (select 1 from {schema}."{table_name}" as source where {joins})
        #         """)
        # case 'dd_update':
        #     queries.append(f"""
        #         Delete from {schema}."{target_table}" as target 
        #         where not Exists (select 1 from {schema}."{table_name}" as source where {joins})"""
        #         )
            
        # case 'truncate_and_insert':
        #     queries.append(f'Truncate Table if Exists {schema}."{target_table}"')
        #     queries.append(f'Insert into {schema}."{target_table}" as target select {source_columns} from {schema}."{table_name}"')

        # case 'replace_table':
        #     queries.append(f'Drop Table if Exists {schema}{target_table}')
        #     queries.append(f'Create Table {schema}.{target_table} as select {source_columns} from {schema}."{table_name}"')
        #     queries.append(f'Insert into {schema}.{target_table}  select {source_columns} from {schema}."{table_name}"')
    
    # for query in queries:
    #     with engine.connect() as conn1:
    #         trans = conn.begin()
    #         try:
    #             conn1.execute(text(query))
    #         except Exception as e:
    #             trans.rollback()
    #             raise Exception('Error',e)
                
    #         finally:
    #             trans.commit()
    # queries = Strategy_key(strategy,schema,target_table,source_columns,table_name,joins,update_columns_str)
    # for query in queries:
    #     with engine.connect() as conn1:
    #         trans = conn.begin()
    #         try:
    #             conn1.execute(text(query))
    #         except Exception as e:
    #             trans.rollback()
    #             raise Exception('Error',e)
                
    #         finally:
    #             trans.commit()

    with engine.begin() as conn1:
        conn1.execute(text(f""" 
            CREATE TABLE "{schema}"."{target_table_name}" AS
            WITH {cte} SELECT * FROM "{table_name}";
        """))
    kwargs['ti'].xcom_push(key=task_id, value=target_table_name)

    return cte
            



def Router(conditions, dag_id, task_id, previous_id,instance_id, target_hierarchy_id, user_id, **kwargs):
    """
    Route data based on conditions to different output paths.

    Args:
        conditions (list): List of (condition, output_name) tuples where:
                         - condition: SQL where clause condition
                         - output_name: Name identifier for the output path
        dag_id (str): DAG identifier
        task_id (str): Task identifier
        previous_id (str): Previous task identifier to pull data from
        target_hierarchy_id (str): Target hierarchy identifier
        user_id (str): User identifier
        sources (list): Source information
        **kwargs: Additional keyword arguments

    Returns:
        dict: A dictionary mapping output names to their respective table names
    """
    from Connections.utils import generate_engine
    import duckdb,re,keyword,sqlglot,time
    from sqlalchemy import text


    conn = duckdb.connect(database=':memory:')
    engine_data = generate_engine(target_hierarchy_id, user_id)
    engine = engine_data['engine']
    schema = engine_data['schema']
    conn_str = str(engine.url)

    conn.sql(f"ATTACH '{conn_str}' AS pg_db (TYPE POSTGRES, SCHEMA '{schema}');")

    ti = kwargs['ti']
    unix_suffix = int(time.time())

    table_name = xcom_pull(ti,instance_id,previous_id)

    result_tables = {}

    # Process each condition and create corresponding output tables
    for condition, output_name in conditions:
        output_table_name = f"extracted_{task_id}_{output_name}_{unix_suffix}"

        # Generate query with the specific condition
        from_clause = (table_name, previous_id)
        generated_query = Query_generator(from_clause=from_clause, where_clause=condition,schema=schema)
        generated_query = replace_params_in_json(generated_query,ti=ti)

        cte = f""" "{output_name}" AS (\n{generated_query}\n) """

        # Log the query and count of records
        result = conn.sql(f"""SELECT * FROM postgres_query('pg_db', $$WITH {cte} SELECT count(*) FROM "{output_name}" $$);""")
        logger.info(f""" [Router Query for {output_name}]\n WITH {cte} SELECT * FROM "{output_name}" """)
        logger.info(f"Total Records for {output_name}: {result.fetchone()[0]}")

        # Create the output table
        with engine.begin() as conn1:
            conn1.execute(text(f"""
                CREATE TABLE "{schema}"."{output_table_name}" AS
                WITH {cte} SELECT * FROM "{output_name}";
            """))

        # Store the output table name
        result_tables[output_name] = cte

        # Push to XCom for each output path
        ti.xcom_push(key=output_name, value=output_table_name)

    # Store the routing map in XCom
        # ti.xcom_push(key=output_name, value=cte)
    conn.sql("DETACH pg_db")

    return result_tables