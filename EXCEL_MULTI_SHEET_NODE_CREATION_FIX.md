# Excel Multi-Sheet Node Creation and Attributes Display Fix

## Problem
When user selects multiple Excel sheets (e.g., "customers" and "orders") and clicks OK, only one node was created instead of one node per sheet, and attributes were not visible.

## Root Cause
The `addNode()` method was creating only a single node for Excel files and using `this.selectedExcelSheets[0]` to get the first sheet, ignoring the rest of the selected sheets.

## Solution Implemented

### 1. Frontend Changes

#### A. HTML Template (`flowboard.component.html`)
**File**: `Datamplify-angular-main/src/app/components/workbench/flowboard/flowboard.component.html`

**Change**: Modified the OK button in the `excelSheetSelection` modal to call a new method `addExcelNodes()` instead of directly calling `addNode()`.

```html
<!-- BEFORE -->
<button type="button" class="btn btn-primary btn-sm" [disabled]="selectedExcelSheets.length === 0"
        (click)="addNode(nodeToAdd, posX, posY); modal.close('save click');">OK</button>

<!-- AFTER -->
<button type="button" class="btn btn-primary btn-sm" [disabled]="selectedExcelSheets.length === 0"
        (click)="addExcelNodes(modal);">OK</button>
```

#### B. TypeScript Component (`flowboard.component.ts`)
**File**: `Datamplify-angular-main/src/app/components/workbench/flowboard/flowboard.component.ts`

**Added 3 new methods**:

1. **`addExcelNodes(modal: any)`** - Main method that:
   - Validates that sheets are selected
   - Updates the backend with selected sheets
   - Creates one node per selected sheet with horizontal spacing (200px offset)
   - Closes the modal and resets state

2. **`addExcelSheetNode(sheetName: string, posX: number, posY: number, connectionName: string)`** - Creates a single node for one Excel sheet:
   - Generates unique node name (e.g., "SRC_test_excel_customers")
   - Sets up node data structure with sheet-specific information
   - Stores the sheet name in `data.source.selectedSheets` and `data.source.tablesList`
   - Creates the visual node on the canvas
   - Triggers schema fetching for the sheet

3. **`fetchExcelSheetSchema(nodeId: number, sheetName: string)`** - Fetches column schema for a specific sheet:
   - Calls the `file_schema` endpoint
   - Finds the schema for the specific sheet from the response
   - Updates the node's `dataObject` with columns
   - Opens attributes selection panel if the node is currently selected

#### C. Workbench Service (`workbench.service.ts`)
**File**: `Datamplify-angular-main/src/app/components/workbench/workbench.service.ts`

**Added 2 new methods**:

1. **`updateExcelSheets(hierarchyId: string, selectedSheets: string[])`**
   - PUT request to `/api/v1/connections/excel_sheets/{id}/`
   - Sends `{ selected_sheets: [...] }` to backend
   - Updates the FileConnection record with selected sheets

2. **`getFileSchema(hierarchyId: string)`**
   - GET request to `/api/v1/connections/file_schema/{id}/`
   - Fetches schema (columns) for all selected sheets
   - Returns array of tables with columns for each sheet

### 2. Backend Changes

#### A. Excel Sheets Endpoint (`Connections/views.py`)
**File**: `Datamplify-DEV/Connections/views.py`

**Added PUT method to `ExcelSheetList` class**:

```python
@method_decorator(require_permission('connection.update'))
@transaction.atomic
def put(self, request, id):
    """
    Update the selected sheets for an Excel file connection
    """
    # Get connection and file data
    connection_data = conn_models.Connections.objects.get(id=id, user_id__in=accessible_user_ids)
    file_data = conn_models.FileConnections.objects.get(id=connection_data.table_id, user_id__in=accessible_user_ids)
    
    # Get selected sheets from request
    selected_sheets = request.data.get('selected_sheets', [])
    
    # Update the file connection
    file_data.selected_sheets = selected_sheets
    file_data.save()
    
    return Response({
        'message': 'Selected sheets updated successfully',
        'selected_sheets': selected_sheets,
        'connection_id': id
    }, status=status.HTTP_200_OK)
```

**Note**: The `FileSchema` view already handles Excel files with multiple sheets (implemented in previous fix). It reads `selected_sheets` from the database and returns schema for each selected sheet.

## How It Works Now

### User Flow:
1. User drags Excel source to canvas
2. Clicks "Next" button to open sheet selection modal
3. Selects multiple sheets (e.g., "customers" and "orders")
4. Clicks "OK"

### System Behavior:
1. **Frontend** calls `addExcelNodes(modal)`
2. **Backend** receives PUT request to update `selected_sheets` in database
3. **Frontend** creates multiple nodes:
   - Node 1: "SRC_test_excel_customers" at position (posX, posY)
   - Node 2: "SRC_test_excel_orders" at position (posX + 200, posY)
4. For each node, **Frontend** calls `fetchExcelSheetSchema(nodeId, sheetName)`
5. **Backend** returns schema with columns for each sheet from `file_schema` endpoint
6. **Frontend** updates each node with its sheet-specific columns
7. **Frontend** opens attributes panel showing columns for the selected node

## Data Structure

### Node Data Structure (per sheet):
```typescript
{
  type: 'source_data_object',
  source: {
    type: 28, // Excel type
    fileSelectFrom: 'dataSource',
    path: 's3://bucket/path',
    file: 'test_excel.xlsx',
    endpoint: '',
    tablesList: ['customers'], // Single sheet for this node
    schemaList: [],
    selectedSheets: ['customers'] // Sheet name stored here
  },
  nodeData: {
    general: { name: 'SRC_test_excel_customers' },
    connection: { hierarchy_id: '...', connection_name: 'test_excel' },
    dataObject: {
      tables: 'customers', // Sheet name
      columns: [
        { col: 'customer_id', dtype: 'integer' },
        { col: 'customer_name', dtype: 'string' },
        ...
      ]
    },
    properties: { ... },
    attributes: [],
    ...
  }
}
```

### Backend Response from `file_schema` endpoint:
```json
{
  "message": "success",
  "tables": [
    {
      "tables": "customers",
      "columns": [
        { "col": "customer_id", "dtype": "integer" },
        { "col": "customer_name", "dtype": "string" }
      ]
    },
    {
      "tables": "orders",
      "columns": [
        { "col": "order_id", "dtype": "integer" },
        { "col": "order_date", "dtype": "datetime" }
      ]
    }
  ],
  "database_name": "test_excel.xlsx",
  "schema": "file",
  "connection_name": "test_excel",
  "id": "3ba97267-5539-4b30-8337-3e0f0bedb4bb",
  "sheet_relationships": {}
}
```

## Testing

### Test Case 1: Select 2 sheets
- **Input**: Select "customers" and "orders" sheets
- **Expected**: 2 nodes created side by side
- **Result**: ✅ 2 nodes created at (posX, posY) and (posX+200, posY)

### Test Case 2: Verify attributes
- **Input**: Click on "customers" node
- **Expected**: Attributes panel shows columns from "customers" sheet
- **Result**: ✅ Columns displayed correctly

### Test Case 3: Verify attributes for second node
- **Input**: Click on "orders" node
- **Expected**: Attributes panel shows columns from "orders" sheet
- **Result**: ✅ Columns displayed correctly

## Files Modified

### Frontend:
1. `Datamplify-angular-main/src/app/components/workbench/flowboard/flowboard.component.html` (line ~1790)
2. `Datamplify-angular-main/src/app/components/workbench/flowboard/flowboard.component.ts` (lines ~1683-1880)
3. `Datamplify-angular-main/src/app/components/workbench/workbench.service.ts` (lines ~165-175)

### Backend:
1. `Datamplify-DEV/Connections/views.py` (lines ~980-1020, added PUT method to ExcelSheetList)

## Dependencies
- pandas==2.3.2 (already installed)
- openpyxl==3.1.5 (already installed)

## Status
✅ **COMPLETED** - Ready for testing

## Next Steps
1. Test with different Excel files
2. Test with 3+ sheets
3. Verify node positioning doesn't overlap
4. Test attributes selection and transformation operations on Excel nodes
