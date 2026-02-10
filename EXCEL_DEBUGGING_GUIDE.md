# Excel Attributes Debugging Guide

## Current Status
The code has been updated with enhanced logging to help debug why attributes are not displaying.

## Testing Steps

### 1. Clear Browser Cache and Reload
```
1. Open browser DevTools (F12)
2. Right-click the reload button
3. Select "Empty Cache and Hard Reload"
4. Or press Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
```

### 2. Create Excel Nodes
```
1. Go to FlowBoard
2. Select Excel connection "test_excel"
3. Click "Next" button
4. Select both "customers" and "orders" sheets
5. Click "OK"
```

### 3. Check Console Logs During Node Creation
Look for these logs in browser console:
```
[fetchExcelSheetSchema] Fetching schema for sheet "customers" from connection...
[fetchExcelSheetSchema] Excel schema response: {...}
[fetchExcelSheetSchema] Found schema for sheet "customers": {...}
[fetchExcelSheetSchema] Updated node X with Y columns
[fetchExcelSheetSchema] dataObject.columns: [...]
```

**Expected:** You should see schema being fetched and stored for BOTH sheets

### 4. Click on Customers Node
```
1. Click on "SRC_test_excel_customers" node
2. Check console for:
   [getSelectedNodeData] Excel node selected
   [getSelectedNodeData] schemaList: [...]
   [getSelectedNodeData] dataObject: {...}
```

**Expected:** Should show schema is already loaded

### 5. Go to Source Attributes Tab
```
1. Click on "Source Attributes" tab in the right panel
2. You should see an empty table with headers:
   - #
   - Attribute
   - Data Type
   - Src Column Name
   - Src Data Type
   - Action
3. At the top, there's a button "Select Attribute To Add"
```

### 6. Click "Select Attribute To Add" Button
```
1. Click the "Select Attribute To Add" button
2. Check console for:
   [openAttributesSelection] Called
   [openAttributesSelection] Selected node ID: X
   [openAttributesSelection] dataObject.columns: [...]
   [openAttributesSelection] schemaList: [...]
   [openAttributesSelection] Processing source_data_object
   [openAttributesSelection] Processing non-standard source type (Excel, etc.)
   [openAttributesSelection] flatList for Excel: [...]
   [openAttributesSelection] Final groupAttributesList: [...]
```

**Expected:** Modal should open with list of columns

### 7. Select Attributes
```
1. In the modal, you should see a group called "customers"
2. Expand the group
3. You should see 4 columns:
   - customer_id (string)
   - customer_name (string)
   - email (string)
   - city (string)
4. Check the checkboxes for columns you want
5. Click "Apply" button
```

### 8. Verify Attributes Are Added
```
1. Modal should close
2. Source Attributes table should now show the selected columns
3. Each row should have:
   - Attribute name
   - Data type dropdown
   - Source column dropdown
   - Source data type
   - Delete button
```

### 9. Repeat for Orders Node
```
1. Click on "SRC_test_excel_orders" node
2. Go to "Source Attributes" tab
3. Click "Select Attribute To Add"
4. Select columns from "orders" group
5. Click "Apply"
6. Verify attributes are added
```

## Common Issues and Solutions

### Issue 1: "No columns found in dataObject"
**Symptom:** Console shows `dataObject.columns: []` or `dataObject.columns: undefined`

**Solution:**
1. Check if schema was fetched: Look for `[fetchExcelSheetSchema] Updated node X with Y columns`
2. If not fetched, check backend logs for errors
3. If fetched but not stored, check `[fetchExcelSheetSchema] dataObject.columns:` log

### Issue 2: "Modal doesn't open"
**Symptom:** Clicking "Select Attribute To Add" does nothing

**Solution:**
1. Check console for errors
2. Verify `[openAttributesSelection] Called` appears in console
3. Check if `groupAttributesList` is populated: Look for `[openAttributesSelection] Final groupAttributesList:`

### Issue 3: "Modal opens but no columns shown"
**Symptom:** Modal opens but shows "No attributes available"

**Solution:**
1. Check `[openAttributesSelection] flatList for Excel:` in console
2. If empty, check `[openAttributesSelection] schemaList:` - should have columns
3. If schemaList is empty, schema wasn't loaded - go back to Issue 1

### Issue 4: "Attributes not saved after clicking Apply"
**Symptom:** Modal closes but Source Attributes table is still empty

**Solution:**
1. Check console for `[applySelectedAttributes] Called`
2. Check `[applySelectedAttributes] flatSelected (checked attributes):` - should show selected columns
3. Check `[applySelectedAttributes] sourceAttributes:` after update
4. Verify `updateNode('')` is called

## Key Console Logs to Look For

### During Node Creation:
```
Created Excel node for sheet "customers" with ID: X
[fetchExcelSheetSchema] Fetching schema for sheet "customers"
[fetchExcelSheetSchema] Updated node X with 4 columns
[fetchExcelSheetSchema] dataObject.columns: [{col: 'customer_id', dtype: 'string'}, ...]
```

### When Clicking Node:
```
Node selected: {id: X, ...}
[getSelectedNodeData] Excel node selected
[getSelectedNodeData] Schema already loaded in schemaList, columns: 4
```

### When Opening Attribute Selection:
```
[openAttributesSelection] Called
[openAttributesSelection] Selected node ID: X
[openAttributesSelection] dataObject.columns: [{col: 'customer_id', dtype: 'string'}, ...]
[openAttributesSelection] schemaList: [{tables: 'customers', columns: [...]}]
[openAttributesSelection] Processing non-standard source type (Excel, etc.)
[openAttributesSelection] flatList for Excel: [{label: 'customer_id', value: 'customer_id', dataType: 'string', group: 'customers'}, ...]
[openAttributesSelection] Final groupAttributesList: [{group: 'customers', attributes: [...]}]
```

### When Applying Attributes:
```
[applySelectedAttributes] Called
[applySelectedAttributes] flatSelected (checked attributes): [{label: 'customer_id', ...}, ...]
[applySelectedAttributes] Processing source_data_object
[applySelectedAttributes] isSourceClicked: true
[applySelectedAttributes] Using schemaList for non-standard source
```

## What to Share for Debugging

If attributes still don't show, please share:

1. **Browser Console Logs:**
   - All logs starting with `[fetchExcelSheetSchema]`
   - All logs starting with `[getSelectedNodeData]`
   - All logs starting with `[openAttributesSelection]`
   - Any error messages (in red)

2. **Backend Logs:**
   - All logs starting with `[FileSchema]`
   - Any error messages

3. **Screenshots:**
   - The FlowBoard canvas with both nodes
   - The Source Attributes tab (empty state)
   - The attribute selection modal (if it opens)

4. **Node Data (from console):**
   ```javascript
   // In browser console, type:
   drawflow.drawflow.Home.data
   // Copy and share the output
   ```

## Expected Behavior

✅ **Working Correctly:**
- Two nodes created (one per sheet)
- Schema fetched for both nodes
- Clicking node shows it's selected
- "Select Attribute To Add" button is visible
- Clicking button opens modal with columns
- Selecting and applying adds rows to Source Attributes table

❌ **Not Working:**
- Nodes created but no schema fetched
- Modal doesn't open
- Modal opens but no columns shown
- Attributes not saved after clicking Apply
- Source Attributes table remains empty

## Files Modified
- `Datamplify-angular-main/src/app/components/workbench/flowboard/flowboard.component.ts`
  - Added extensive logging to `fetchExcelSheetSchema` (lines ~1856-1927)
  - Added extensive logging to `openAttributesSelection` (lines ~2720-2730)
