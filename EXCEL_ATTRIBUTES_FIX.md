# Excel Attributes Display Fix - Race Condition Resolution

## Problem Summary
When selecting multiple Excel sheets (e.g., "customers" and "orders"), attributes display correctly for the last node created ("orders") but not for earlier nodes ("customers"). When selecting only one sheet, it works fine.

## Root Cause
**Race Condition in Multi-Node Creation:**
1. When creating multiple nodes in `addExcelSheetNode()`, each node sets `this.selectedNode = node`
2. "customers" node is created first, sets `selectedNode` to customers, starts schema fetch
3. "orders" node is created immediately after, sets `selectedNode` to orders, starts schema fetch
4. When customers schema returns, it checks `if (this.selectedNode && this.selectedNode.id === nodeId)` but `selectedNode` is now pointing to "orders"
5. So only the last node ("orders") gets its attributes populated

## Solution Implemented

### 1. Fixed TypeScript Compilation Errors (COMPLETED ✅)
**File:** `Datamplify-angular-main/src/app/components/workbench/flowboard/flowboard.component.ts`

**Problem:** Extra closing braces at lines 1900-1914 breaking code structure in `fetchExcelSheetSchema` method

**Fix:** Removed duplicate closing braces and fixed method structure:
- Lines 1856-1925: Cleaned up `fetchExcelSheetSchema` method
- Removed orphaned closing braces that were causing compilation errors
- Method now properly closes with correct brace nesting

### 2. Removed Race Condition Logic (COMPLETED ✅)
**File:** `Datamplify-angular-main/src/app/components/workbench/flowboard/flowboard.component.ts`

**Changes in `addExcelSheetNode()` method (lines ~1830-1855):**
- ❌ REMOVED: `setTimeout(() => { this.selectedNode = node; ... }, 100);`
- ❌ REMOVED: Setting `this.selectedNode` during node creation
- ✅ RESULT: Schema is now fetched and stored for ALL nodes, not just the selected one

**Changes in `fetchExcelSheetSchema()` method (lines ~1856-1925):**
- ❌ REMOVED: Conditional check `if (this.selectedNode && this.selectedNode.id === nodeId)`
- ❌ REMOVED: Call to `openAttributesSelection()` after schema load
- ✅ RESULT: Schema is stored in node data for all nodes without UI interference

### 3. Updated Node Selection Logic (COMPLETED ✅)
**File:** `Datamplify-angular-main/src/app/components/workbench/flowboard/flowboard.component.ts`

**Changes in `getSelectedNodeData()` method (lines ~1597-1630):**
```typescript
// OLD: Only checked dataObject.columns
if (!dataObject.columns || dataObject.columns.length === 0) {
  this.fetchExcelSheetSchema(this.selectedNode.id, sheetName);
}

// NEW: Checks both schemaList and dataObject.columns
const schemaList = this.selectedNode.data.source.schemaList;
const dataObject = this.selectedNode.data.nodeData.dataObject;

if (schemaList && schemaList.length > 0 && schemaList[0].columns && schemaList[0].columns.length > 0) {
  // Schema already loaded in schemaList
} else if (dataObject.columns && dataObject.columns.length > 0) {
  // Schema already loaded in dataObject
} else {
  // Fetch schema
  this.fetchExcelSheetSchema(this.selectedNode.id, sheetName);
}
```

## How It Works Now

### Node Creation Flow:
1. User selects multiple sheets (e.g., "customers", "orders")
2. `addExcelNodes()` creates one node per sheet with 200px spacing
3. For each node, `addExcelSheetNode()` is called:
   - Creates node with unique name (e.g., "SRC_test_excel_customers")
   - Stores sheet name in `data.source.selectedSheets` and `data.source.tablesList`
   - Calls `fetchExcelSheetSchema(nodeId, sheetName)` WITHOUT setting `selectedNode`
4. `fetchExcelSheetSchema()` for each node:
   - Fetches schema from backend via `getDataObjectsForFile(connectionId)`
   - Finds schema for specific sheet in response
   - Stores schema in `node.data.source.schemaList` format
   - Also stores in `node.data.nodeData.dataObject` for backward compatibility
   - Updates node data in drawflow
   - **Does NOT call `openAttributesSelection()`** to avoid race conditions

### Node Selection Flow:
1. User clicks on any Excel node (customers or orders)
2. `getSelectedNodeData()` is triggered:
   - Sets `this.selectedNode = node`
   - Checks if schema is already loaded in `schemaList` or `dataObject.columns`
   - If schema exists, does nothing (schema is already there)
   - If schema doesn't exist, calls `fetchExcelSheetSchema()` to load it
3. User clicks "Select Attribute To Add" button in "Source Attributes" tab
4. `openAttributesSelection()` is called:
   - Reads schema from `node.data.source.schemaList`
   - Builds `groupAttributesList` with all columns
   - Opens modal for attribute selection
5. User selects attributes and clicks "Apply"
6. `applySelectedAttributes()` stores selected attributes in node data

## Current State

### ✅ Working:
- Multiple Excel nodes are created successfully (one per sheet)
- Schema is fetched and stored for ALL nodes
- No race conditions during node creation
- TypeScript compilation successful (no errors)
- Backend returns correct schema for each sheet

### ⚠️ User Action Required:
- Users must manually click "Select Attribute To Add" button to see attributes
- This is by design to avoid automatic UI popups during multi-node creation
- Each node stores its schema independently

### 📊 Data Flow:
```
Backend Response:
{
  tables: [
    { tables: 'customers', columns: [{col: 'customer_id', dtype: 'string'}, ...] },
    { tables: 'orders', columns: [{col: 'order_id', dtype: 'string'}, ...] }
  ]
}

Node Data Structure:
node.data.source.schemaList = [
  {
    tables: 'customers',
    columns: [{col: 'customer_id', dtype: 'string'}, ...]
  }
]

node.data.nodeData.dataObject = {
  tables: 'customers',
  columns: [{col: 'customer_id', dtype: 'string'}, ...]
}
```

## Testing Instructions

1. **Create Multiple Excel Nodes:**
   - Select Excel connection "test_excel"
   - Click "Next" button
   - Select both "customers" and "orders" sheets
   - Click "OK"
   - Verify: Two nodes are created on canvas

2. **Check Customers Node:**
   - Click on "SRC_test_excel_customers" node
   - Go to "Source Attributes" tab
   - Click "Select Attribute To Add" button
   - Verify: Modal opens with 4 columns (customer_id, customer_name, email, city)

3. **Check Orders Node:**
   - Click on "SRC_test_excel_orders" node
   - Go to "Source Attributes" tab
   - Click "Select Attribute To Add" button
   - Verify: Modal opens with order columns

4. **Verify Console Logs:**
   - Open browser console
   - Look for logs like:
     ```
     [fetchExcelSheetSchema] Updated node X with Y columns
     [getSelectedNodeData] Schema already loaded in schemaList, columns: Y
     [openAttributesSelection] flatList for Excel: [...]
     ```

## Files Modified

1. **Datamplify-angular-main/src/app/components/workbench/flowboard/flowboard.component.ts**
   - Lines 1597-1630: `getSelectedNodeData()` - Updated schema checking logic
   - Lines 1830-1855: `addExcelSheetNode()` - Removed `selectedNode` assignment
   - Lines 1856-1925: `fetchExcelSheetSchema()` - Fixed compilation errors, removed conditional UI logic

## Next Steps (If Issues Persist)

If attributes still don't display for some nodes:

1. **Check Console Logs:**
   - Look for `[fetchExcelSheetSchema]` logs to verify schema is being stored
   - Look for `[openAttributesSelection]` logs to verify schema is being read

2. **Verify Node Data:**
   - In browser console, type: `drawflow.drawflow.Home.data[nodeId].data.source.schemaList`
   - Should show array with columns

3. **Check Backend Response:**
   - Look for `[FileSchema]` logs in Django console
   - Verify it returns schema for all sheets

4. **Manual Debugging:**
   - Add breakpoint in `openAttributesSelection()` method
   - Check `this.selectedNode.data.source.schemaList` value
   - Check `flatList` after processing

## Related Documentation
- EXCEL_SUPPORT_IMPLEMENTATION_SUMMARY.md - Overall Excel integration implementation
- EXCEL_MULTI_SHEET_NODE_CREATION_FIX.md - Multi-sheet node creation fix
- EXCEL_SHEETS_ENDPOINT_FIX.md - Backend sheet listing endpoint fix
- EXCEL_INTEGRATION_ENDPOINT_FIX.md - Initial backend integration fix
