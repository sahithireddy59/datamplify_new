# Update Strategy Guide - Informatica Style

This guide explains how to use update strategies in the ETL system, similar to Informatica PowerCenter.

## Available Update Strategies

### 1. **APPEND** (Default)
- **Description**: Insert all records into the target table
- **Use Case**: When you want to add all source records to existing target data
- **Configuration**:
```json
{
    "update_strategy": "append"
}
```

### 2. **INSERT**
- **Description**: Insert only new records (skip duplicates based on key columns)
- **Use Case**: When you want to add only new records and avoid duplicates
- **Configuration**:
```json
{
    "update_strategy": "insert",
    "key_columns": ["emp_id"]
}
```

### 3. **UPDATE**
- **Description**: Update only existing records based on key columns
- **Use Case**: When you want to modify existing records without adding new ones
- **Configuration**:
```json
{
    "update_strategy": "update",
    "key_columns": ["emp_id"]
}
```

### 4. **UPSERT** (Merge)
- **Description**: Insert new records and update existing ones based on key columns
- **Use Case**: Most common strategy for data synchronization
- **Configuration**:
```json
{
    "update_strategy": "upsert",
    "key_columns": ["emp_id"]
}
```

### 5. **DELETE**
- **Description**: Delete records from target that match source based on key columns
- **Use Case**: When you want to remove specific records
- **Configuration**:
```json
{
    "update_strategy": "delete",
    "key_columns": ["emp_id"]
}
```

### 6. **TRUNCATE_INSERT**
- **Description**: Truncate target table and insert all source records
- **Use Case**: Full refresh of target table
- **Configuration**:
```json
{
    "update_strategy": "truncate_insert"
}
```

### 7. **REPLACE**
- **Description**: Drop and recreate target table with source data
- **Use Case**: Complete table replacement with structure changes
- **Configuration**:
```json
{
    "update_strategy": "replace"
}
```

## Key Columns

Key columns are used to identify matching records between source and target tables. They are required for:
- INSERT (with duplicate checking)
- UPDATE
- UPSERT
- DELETE

### Single Key Column
```json
{
    "key_columns": ["emp_id"]
}
```

### Multiple Key Columns (Composite Key)
```json
{
    "key_columns": ["emp_id", "department"]
}
```

## Complete Example Configuration

```json
{
    "dag_name": "employee_sync",
    "tasks": [
        {
            "type": "source_data_object",
            "id": "SRC_employees",
            "format": "database",
            "hierarchy_id": "source-connection-id",
            "source_table_name": "employees",
            "source_attributes": [
                ["emp_id", "integer", "emp_id", "integer"],
                ["name", "text", "name", "text"],
                ["department", "text", "department", "text"],
                ["salary", "integer", "salary", "integer"]
            ]
        },
        {
            "type": "target_data_object",
            "id": "TGT_employees",
            "format": "database",
            "hierarchy_id": "target-connection-id",
            "target_table_name": "employees_target",
            "truncate": false,
            "create": true,
            "update_strategy": "upsert",
            "key_columns": ["emp_id"],
            "previous_task_id": "SRC_employees"
        }
    ]
}
```

## Strategy Selection Guidelines

| Scenario | Recommended Strategy | Key Columns Required |
|----------|---------------------|---------------------|
| Initial data load | `truncate_insert` or `append` | No |
| Daily incremental updates | `upsert` | Yes |
| Add new records only | `insert` | Yes |
| Update existing records only | `update` | Yes |
| Remove obsolete records | `delete` | Yes |
| Complete table refresh | `replace` or `truncate_insert` | No |

## Performance Considerations

1. **UPSERT**: Slower than INSERT but handles both new and updated records
2. **TRUNCATE_INSERT**: Fastest for full refresh scenarios
3. **UPDATE/INSERT**: Use when you know the data pattern (only updates or only inserts)
4. **Key Columns**: Ensure key columns are indexed for better performance

## Error Handling

- If key columns are required but not provided, the system will log a warning and fall back to APPEND strategy
- Invalid update strategies will default to APPEND
- Database-specific syntax is automatically handled (PostgreSQL, MySQL, MongoDB)

## MongoDB Support

For MongoDB targets, update strategies are implemented using MongoDB operations:
- **UPSERT**: Uses `replaceOne` with `upsert: true`
- **INSERT**: Uses `insertMany` with duplicate key handling
- **UPDATE**: Uses `updateMany` for matching documents
- **DELETE**: Uses `deleteMany` for matching documents
- **REPLACE**: Drops and recreates collection

## UI Integration

The update strategy options will be available in the FlowBoard UI as dropdown selections in the target configuration panel, allowing users to:
1. Select update strategy from dropdown
2. Specify key columns via multi-select
3. Preview the generated SQL/MongoDB operations
4. Validate configuration before saving
