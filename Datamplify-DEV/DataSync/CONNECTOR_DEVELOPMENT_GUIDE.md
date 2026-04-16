# DataSync Connector Development Guide

This document explains how the current DataSync flow works and how to add another connector to it.

It is written against the code in:
- [engine.py](/C:/Users/vsahithi/Desktop/datamplify_new/Datamplify-DEV/DataSync/engine.py)
- [base.py](/C:/Users/vsahithi/Desktop/datamplify_new/Datamplify-DEV/DataSync/connectors/base.py)
- [models.py](/C:/Users/vsahithi/Desktop/datamplify_new/Datamplify-DEV/DataSync/models.py)
- [views.py](/C:/Users/vsahithi/Desktop/datamplify_new/Datamplify-DEV/DataSync/views.py)
- [__init__.py](/C:/Users/vsahithi/Desktop/datamplify_new/Datamplify-DEV/DataSync/connectors/__init__.py)

## 1. Core objects

The sync system has five main model types.

- `SyncConnector`
  - stores one connector configuration
  - has `connector_type`, `connector_role`, `config`
  - may also hold OAuth tokens

- `SyncJob`
  - joins one source connector and one destination connector
  - stores job-level sync mode and schedule

- `SyncTable`
  - one row per source table/object inside a job
  - stores `source_table`, `destination_table`, `cursor_field`, `primary_key_field`

- `SyncRun`
  - one execution of a job
  - stores status, counters, errors, duration

- `SyncCursor`
  - stores incremental state per `SyncTable`
  - current code uses `last_value`

## 2. End-to-end flow

The normal flow is:

1. UI or API creates/imports a `SyncConnector`.
2. UI calls connector schema discovery.
3. User creates a `SyncJob` and adds `SyncTable` rows.
4. UI or scheduler triggers the job.
5. `start_sync_job()` creates a `SyncRun`.
6. `SyncEngine.start_sync()` loads both connector classes and runs the sync.

The trigger path starts in:
- [views.py](/C:/Users/vsahithi/Desktop/datamplify_new/Datamplify-DEV/DataSync/views.py)

The connector factory is:
- [__init__.py](/C:/Users/vsahithi/Desktop/datamplify_new/Datamplify-DEV/DataSync/connectors/__init__.py)

The sync engine is:
- [engine.py](/C:/Users/vsahithi/Desktop/datamplify_new/Datamplify-DEV/DataSync/engine.py)

## 3. What the engine does

For each enabled `SyncTable`, the engine does this:

1. resolve sync mode
2. resolve primary key
3. resolve cursor field for incremental modes
4. load saved cursor from `SyncCursor`
5. fetch source data page by page using `fetch_data(...)`
6. create destination table if needed
7. write rows using destination `write_data(...)`
8. update `SyncCursor.last_value`
9. update row counts and logs

Important current behavior:

- `full`
  - fetches all pages
  - destination write mode becomes `replace`

- `incremental`
  - auto-selects the actual strategy
  - if `cursor_field` exists and is different from PK, it becomes `incremental_cursor`
  - otherwise it falls back to `incremental_id`

- `incremental_id`
  - uses the primary key as cursor
  - only catches new rows with greater IDs
  - does not catch updates to old rows

- `incremental_cursor` and `incremental_timestamp`
  - use the selected cursor field

- `history`
  - destination write mode becomes `history`
  - keeps row versions

Current paging behavior in the engine:

- fetch limit is `1000`
- there is a hard safety limit of `100` pages
- rows are accumulated in memory before final write

That behavior is important if you are building a connector for very large sources.

## 4. Connector interface

Every connector class inherits from `BaseConnector`:
- [base.py](/C:/Users/vsahithi/Desktop/datamplify_new/Datamplify-DEV/DataSync/connectors/base.py)

Required methods:

- `test_connection(self) -> Dict[str, Any]`
- `discover_schema(self) -> List[Dict[str, Any]]`
- `fetch_data(self, table_name, cursor_value=None, cursor_field=None, limit=None) -> Dict[str, Any]`
- `write_data(self, table_name, data, primary_key, mode='upsert') -> Dict[str, Any]`

Optional methods:

- `get_table_schema(self, table_name)`
- `create_table(self, table_name, schema)`
- `validate_config(self)`
- `set_runtime_context(...)`

Source-only connectors can raise `NotImplementedError` from `write_data`.

Destination-only connectors can implement discovery minimally if not used as a source, but in practice source connectors need discovery and fetch, destination connectors need write and table creation.

## 5. Data shape expected by the engine

### `discover_schema()`

Return a list like:

```python
[
    {
        "name": "contacts",
        "row_count": 12345,
        "columns": [
            {"name": "id", "type": "TEXT", "nullable": False},
            {"name": "updated_at", "type": "TIMESTAMP", "nullable": True},
        ],
        "supports_incremental": True,
        "primary_key": "id",
        "cursor_field": "updated_at",
    }
]
```

Important fields:

- `name`
  - source object/table name used later in `SyncTable.source_table`

- `columns`
  - used by UI and for understanding available fields

- `primary_key`
  - engine uses this when `SyncTable.primary_key_field` is missing

- `cursor_field`
  - engine uses this for auto incremental mode

### `fetch_data()`

Return a dict like:

```python
{
    "data": [
        {"id": 1, "name": "A"},
        {"id": 2, "name": "B"},
    ],
    "next_cursor": "2",
    "has_more": True,
    "count": 2,
}
```

Rules:

- `data` must be a list of flat dictionaries
- keys become destination column names
- `next_cursor` should match the selected incremental field or paging token
- `has_more` tells the engine whether to fetch the next page

If the source uses page tokens instead of sortable values, you can still return `next_cursor`, but note that the current engine only stores `SyncCursor.last_value`. It does not yet use `SyncCursor.next_page_token` in the run loop.

### `write_data()`

Return a dict like:

```python
{
    "inserted": 100,
    "updated": 0,
    "deleted": 0,
    "failed": 0,
}
```

The engine adds these up into `SyncRun`.

## 6. How source connectors should behave

A source connector needs to do three things well:

1. authenticate
2. discover objects/tables
3. fetch pages consistently

### SQL source pattern

The PostgreSQL connector is the reference SQL connector:
- [postgresql.py](/C:/Users/vsahithi/Desktop/datamplify_new/Datamplify-DEV/DataSync/connectors/postgresql.py)

Current SQL source logic:

- `discover_schema()`
  - lists tables from `information_schema.tables`
  - fetches columns from `information_schema.columns`
  - tries to find the PK from PostgreSQL metadata
  - if no PK is present, it infers one from names like `id`, `empid`, or `*_id`
  - tries to resolve a useful cursor field such as `updated_at`

- `fetch_data()`
  - builds a query like:

```sql
SELECT * FROM "schema"."table"
WHERE "cursor_field" > %s
ORDER BY "cursor_field"
LIMIT 1000
```

This is why a SQL connector should:

- provide a stable sort field for paging
- make sure the cursor field is sortable
- prefer indexed cursor fields for performance

### API source pattern

The HubSpot connector is the reference API connector:
- [hubspot.py](/C:/Users/vsahithi/Desktop/datamplify_new/Datamplify-DEV/DataSync/connectors/hubspot.py)

Current API source logic:

- `discover_schema()`
  - calls the provider metadata endpoint
  - maps provider properties into generic `columns`

- `fetch_data()`
  - for full fetch, calls list endpoint
  - for incremental fetch, calls search/filter endpoint
  - transforms API responses into flat dictionaries

This is the right pattern for another SaaS/API connector.

## 7. How destination connectors should behave

A destination connector needs to:

1. create destination tables
2. expose table schema for existence checks
3. write rows in different modes

The PostgreSQL connector is also the main destination implementation.

Current write modes:

- `upsert`
  - `INSERT ... ON CONFLICT (...) DO UPDATE`

- `replace`
  - upserts incoming rows
  - marks missing rows as soft deleted with `_datamplify_deleted = TRUE`

- `history`
  - keeps version history
  - uses `_datamplify_active`, `_datamplify_start`, `_datamplify_end`

Current system columns written by PostgreSQL destination:

- `_datamplify_id`
- `_datamplify_synced`
- `_datamplify_deleted`
- `_datamplify_active`
- `_datamplify_start`
- `_datamplify_end`

Incremental/upsert mode mainly uses:

- `_datamplify_id`
- `_datamplify_synced`

`replace` also uses:

- `_datamplify_deleted`

`history` also uses:

- `_datamplify_active`
- `_datamplify_start`
- `_datamplify_end`

## 8. Registering a new connector

There are three required changes.

### Step 1: create the connector class

Add a new file in:
- [connectors](/C:/Users/vsahithi/Desktop/datamplify_new/Datamplify-DEV/DataSync/connectors)

Example:

```python
from typing import List, Dict, Any, Optional
from .base import BaseConnector


class MyConnector(BaseConnector):
    def test_connection(self) -> Dict[str, Any]:
        return {"success": True, "message": "ok"}

    def discover_schema(self) -> List[Dict[str, Any]]:
        return []

    def fetch_data(
        self,
        table_name: str,
        cursor_value: Optional[str] = None,
        cursor_field: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> Dict[str, Any]:
        return {
            "data": [],
            "next_cursor": None,
            "has_more": False,
            "count": 0,
        }

    def write_data(self, table_name: str, data: List[Dict[str, Any]], primary_key: str, mode: str = "upsert") -> Dict[str, Any]:
        raise NotImplementedError("source-only connector")
```

### Step 2: register it in the connector factory

Update:
- [__init__.py](/C:/Users/vsahithi/Desktop/datamplify_new/Datamplify-DEV/DataSync/connectors/__init__.py)

Add the import and map entry:

```python
from .my_connector import MyConnector

connector_map = {
    "my_connector": MyConnector,
}
```

### Step 3: allow the connector type in the model

Update `SyncConnector.CONNECTOR_TYPES` in:
- [models.py](/C:/Users/vsahithi/Desktop/datamplify_new/Datamplify-DEV/DataSync/models.py)

Example:

```python
('my_connector', 'My Connector')
```

If the model choices change, create and apply a migration.

## 9. What a good connector should decide

Before you write another connector, define these clearly.

- Is it source-only, destination-only, or both?
- What is the natural primary key?
- What field should be used for incremental sync?
- Does the source support filtering with `>` on a cursor field?
- Does the source use numeric cursor values, timestamps, or paging tokens?
- Are returned rows flat, or do nested fields need flattening?
- Does the destination support upsert with conflict keys?

## 10. Recommended connector checklist

Use this checklist when implementing a new connector.

- `test_connection()` returns clear errors
- `discover_schema()` returns `name`, `columns`, `primary_key`, `cursor_field`
- `fetch_data()` supports both full fetch and incremental fetch
- `fetch_data()` returns deterministic page order
- `write_data()` returns inserted/updated/deleted/failed counts
- `get_table_schema()` works for destination existence checks
- `create_table()` can build the destination table from a sample schema
- connector is added to `CONNECTOR_TYPES`
- connector is registered in `connectors/__init__.py`
- connector config is serializable into `SyncConnector.config`

## 11. Current limitations you should know before extending

These are limitations of the current engine, not your connector.

- incremental first run becomes a full read
  - if there is no saved cursor, the engine reads the full dataset first

- paging is generic, not connector-specialized
  - the engine loops over `has_more`
  - connectors must supply a good `next_cursor`

- `next_page_token` exists in `SyncCursor` but is not used by the engine yet
  - token-based APIs may need engine changes for best support

- large datasets are accumulated in memory in the current engine
  - connectors for very large sources may need future streaming improvements

- `incremental_id` does not detect updates to existing rows
  - it only catches rows with larger IDs

- deletes are destination-mode dependent
  - full replace and history logic handle delete-style behavior
  - connector-native CDC delete support does not exist yet

## 12. Practical advice for the next connector

If you are building another API connector:

- start from [hubspot.py](/C:/Users/vsahithi/Desktop/datamplify_new/Datamplify-DEV/DataSync/connectors/hubspot.py)
- implement metadata discovery first
- then implement one object fetch end to end
- then add incremental filter support

If you are building another SQL connector:

- start from [postgresql.py](/C:/Users/vsahithi/Desktop/datamplify_new/Datamplify-DEV/DataSync/connectors/postgresql.py)
- implement connection handling
- implement `discover_schema()`
- implement `fetch_data()` with `WHERE cursor > value ORDER BY cursor LIMIT n`
- implement destination DDL and upsert only if it is also a destination

## 13. Minimum code changes for a new source connector

For a new source-only connector, the minimum practical change set is:

1. create `DataSync/connectors/<name>.py`
2. implement `test_connection`, `discover_schema`, `fetch_data`
3. raise `NotImplementedError` from `write_data`
4. register it in `connectors/__init__.py`
5. add it to `SyncConnector.CONNECTOR_TYPES`
6. create migration if model choices changed

## 14. Minimum code changes for a new destination connector

For a new destination-only connector, the minimum practical change set is:

1. create `DataSync/connectors/<name>.py`
2. implement `test_connection`
3. implement `write_data`
4. implement `get_table_schema`
5. implement `create_table`
6. register it in `connectors/__init__.py`
7. add it to `SyncConnector.CONNECTOR_TYPES`
8. create migration if model choices changed

## 15. Suggested next step

If you are about to build a connector now, the safest sequence is:

1. choose whether it is source or destination
2. pick the reference connector to copy
3. implement only connection test and one-table fetch first
4. verify `discover_schema()` output in the API
5. then wire incremental sync

That keeps the first version small and easier to debug.
