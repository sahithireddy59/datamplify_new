
# integrations/clients/ninja.py

import requests

from sqlalchemy import create_engine,text

class NinjaClient:
    BASE_URL = "https://api.ninjaone.com/v2"
    page_size =100
    def __init__(self, credentials: dict):
        self.access_token ='WgxBc9qZwPe3xjTcYS9kZHs4dl_srJXqpx96nZfxX24.gqYMCHxhHtnl58dEGbe1sOxzQx4BC3SQ4u_uxxnphFI'
        

    def headers(self):
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json"
        }

    def fetch_page(self,endpoint: str,page: int):
        response = requests.get(
            f"{self.BASE_URL}/organizations-detailed",
            headers=self.headers(),
            params={
                "page": page,
                "pageSize": self.page_size,
                "orderBy": "id"
            },
            timeout=30
        )
        response.raise_for_status()
        return response.json()

    def stream_records(self,endpoint: str):
        """
        Streams one record at a time (LOW memory)
        """
        page = 1

        while True:
            records = self.fetch_page(endpoint, page)

            if not records:
                break

            for record in records:
                yield record

            page += 1

    def stream_batches(self,endpoint: str,batch_size: int = 10000):
        """
        Streams batches for loader
        """
        batch = []

        for record in self.stream_records(endpoint):
            batch.append(record)

            if len(batch) >= batch_size:
                yield batch
                batch = []

        if batch:
            yield batch


class IntegrationDataOrchestrator:

    def fetch_data(self, integration_type: str, credentials: dict, endpoint: str, params=None):
        if integration_type == "ninja":
            client = NinjaClient(credentials)

        # elif integration_type == "halopsa":
        #     client = HaloPSAClient(credentials)

        # elif integration_type == "connectwise":
        #     client = ConnectWiseClient(credentials)

        else:
            raise ValueError("Unsupported integration")

        return client





def flatten_json(data: dict,parent_key: str = "",sep: str = "_") -> dict:
    items = {}
    if isinstance(data,dict):
        for key, value in data.items():
            new_key = f"{parent_key}{sep}{key}" if parent_key else key

            if isinstance(value, dict):
                items.update(flatten_json(value, new_key, sep))

            elif isinstance(value, list):
                # Convert list → string (safe default)
                items[new_key] = ",".join(map(str, value))

            else:
                items[new_key] = value

    else:
        for i in data:
            new_key = f"{parent_key}{sep}'!'" 
            items.update(flatten_json(i, new_key, sep))
    return items



from datetime import datetime

def infer_type(value):
    if value is None:
        return "string"

    if isinstance(value, bool):
        return "bool"

    if isinstance(value, int):
        return "int"

    if isinstance(value, float):
        return "float"

    if isinstance(value, str):
        try:
            datetime.fromisoformat(value.replace("Z", "+00:00"))
            return "timestamp"
        except ValueError:
            return "string"

    return "string"


def merge_types(old, new):
    if old == new:
        return old

    # Promote safely
    priority = ["bool", "int", "float", "timestamp", "string"]
    return priority[max(priority.index(old), priority.index(new))]


def infer_schema(records: list[dict]) -> dict:
    schema = {}

    for record in records:
        for col, value in record.items():
            dtype = infer_type(value)

            if col not in schema:
                schema[col] = dtype
            else:
                schema[col] = merge_types(schema[col], dtype)

    return schema


def normalize_record(record: dict, schema: dict) -> dict:
    return {
        column: record.get(column)
        for column in schema.keys()
    }



def extract_records(page_response):
    """
    Converts any page response into an iterable of dict records.
    """

    if page_response is None:
        return []

    # Case 1: list
    if isinstance(page_response, list):
        records = []
        for item in page_response:
            if isinstance(item, dict):
                records.append(item)
            else:
                # list of scalars → wrap
                records.append({"value": item})
        return records

    # Case 2: dict
    if isinstance(page_response, dict):
        return [page_response]

    # Case 3: scalar
    return [{"value": page_response}]


def stream_records(fetch_page, start_page=1):
    """
    Streams one record at a time across all pages.
    """

    page = start_page

    while True:
        page_response = fetch_page(page)

        # Stop condition
        if not page_response:
            break

        records = extract_records(page_response)

        for record in records:
            yield record

        page += 1


from uuid import uuid4

def get_pk(record, pk_field):
    return record.get(pk_field) or str(uuid4())

from uuid import uuid4
from collections import defaultdict


class Normalizer:
    def __init__(self, root_table: str, pk_field: str | None = None):
        self.root_table = root_table
        self.pk_field = pk_field or "id"

    def normalize(self, record: dict) -> dict[str, list[dict]]:
        """
        Normalize a single API record into tables.
        """
        tables = defaultdict(list)

        root_id = record.get(self.pk_field) or str(uuid4())

        root_row = {}
        self._walk(
            obj=record,
            table=self.root_table,
            parent_id=None,
            current_row=root_row,
            tables=tables,
            root_id=root_id
        )

        root_row[self.pk_field] = root_id
        tables[self.root_table].append(root_row)

        return tables

    def _walk(
        self,
        obj,
        table,
        parent_id,
        current_row,
        tables,
        root_id,
        parent_table=None
    ):
        """
        Walk JSON recursively and emit normalized rows.
        """

        if isinstance(obj, dict):
            for key, value in obj.items():
                if isinstance(value, dict):
                    # flatten nested dict
                    self._walk(
                        value,
                        table,
                        parent_id,
                        current_row,
                        tables,
                        root_id,
                        parent_table
                    )

                elif isinstance(value, list):
                    # create child table
                    child_table = f"{table}__{key}"

                    for item in value:
                        child_row = {}

                        # attach FK
                        fk_name = f"{table}_id"
                        child_row[fk_name] = root_id

                        self._walk(
                            item,
                            child_table,
                            root_id,
                            child_row,
                            tables,
                            root_id,
                            parent_table=table
                        )

                        tables[child_table].append(child_row)

                else:
                    # scalar → column
                    current_row[key] = value

        elif isinstance(obj, list):
            # list at root (rare but possible)
            for item in obj:
                self._walk(
                    item,
                    table,
                    parent_id,
                    current_row,
                    tables,
                    root_id,
                    parent_table
                )

        else:
            # scalar fallback
            current_row["value"] = obj

def sanitize(name: str) -> str:
    return str(name).replace("-", "_")

def infer_schema(rows):
    columns = set()
    for row in rows:
        columns.update(row.keys())

    return {col: "TEXT" for col in columns}

class TableManager:
    def __init__(self,engine):
        self.engine = engine
        self.cursor = engine.connect()
        pass
    def ensure_table(self, table_name, rows):
        table = sanitize(table_name)
        schema = infer_schema(rows)

        cols_sql = ", ".join(
            f'"{col}" {dtype}'
            for col, dtype in schema.items()
        )

        sql = f"""
        CREATE TABLE IF NOT EXISTS "{table}" (
            {cols_sql}
        )
        """
        self.cursor.execute(text(sql))
        self.cursor.commit()
    
    def insert_rows(self, table_name, rows):
        table = sanitize(table_name)

        if not rows:
            return

        cols = rows[0].keys()
        col_sql = ", ".join(f'"{c}"' for c in cols)
        val_sql = ", ".join(f':{sanitize(c)}' for c in cols)

        sql = f"""
        INSERT INTO "{table}" ({col_sql})
        VALUES ({val_sql})
        """
        # params = {sanitize(k): v for k, v in row.items()}

        self.cursor.execute(text(sql), rows)

        self.cursor.commit()


object1 = IntegrationDataOrchestrator()
ninja = object1.fetch_data('ninja',{},'organizations-detailed')
# page_data = object1.fetch_data('ninja',{},'agents',1)

table_buffers = defaultdict(list)

# for record in ninja.stream_records('organizations-detailed'):
    
#     tables = norm.normalize(record)
#     engine = create_engine(url, pool_size=10, max_overflow=20)
#     tm = TableManager(engine)

#     for table_name, rows in tables.items():
#         table_buffers[table_name].extend(rows)

        
#         tm.ensure_table(table_name, rows)
#         tm.insert_rows(table_name, rows)
url = "postgresql://{}:{}@{}:{}/{}".format('postgres','u8ivT0ad696h','datamplify.cj3oddyv0bsk.us-west-1.rds.amazonaws.com','5432','Datamplify_testing')
engine = create_engine(url)
tm = TableManager(engine)
norm = Normalizer("organizations_detailed")

table_buffers = defaultdict(list)
SCHEMA_SAMPLE_LIMIT = 5000
FLUSH_LIMIT = 10000

# for record in ninja.stream_batches("organizations-detailed"):
#     tables = norm.normalize(record)

#     for table, rows in tables.items():
#         table_buffers[table].extend(rows)

#     # Once enough data collected → create schema
#     if sum(len(v) for v in table_buffers.values()) >= SCHEMA_SAMPLE_LIMIT:
#         for table, rows in table_buffers.items():
#             tm.ensure_table(table, rows)
#         break  # schema locked

# # Continue streaming + bulk inserts
# for record in ninja.stream_records("organizations-detailed"):
#     tables = norm.normalize(record)

#     for table, rows in tables.items():
#         table_buffers[table].extend(rows)

#         if len(table_buffers[table]) >= FLUSH_LIMIT:
#             tm.insert_rows(table, table_buffers[table])
#             table_buffers[table].clear()

# # Final flush
# for table, rows in table_buffers.items():
#     tm.insert_rows(table, rows)



# # print(page_data)
# # flatten_data = flatten_json(page_data)
# # schema = infer_schema(flatten_data)
# # import pandas as pd

# # df = pd.DataFrame(flatten_data)
# # print(df.columns)




import cProfile
import pstats

def run():
    for record in ninja.stream_records("organizations-detailed"):
        tables = norm.normalize(record)
        for table, rows in tables.items():
            table_buffers[table].extend(rows)
            if len(table_buffers[table]) >= FLUSH_LIMIT:
                tm.insert_rows(table, table_buffers[table])
                table_buffers[table].clear()

cProfile.run("run()", "profile.out")

p = pstats.Stats("profile.out")
p.sort_stats("cumtime").print_stats(30)