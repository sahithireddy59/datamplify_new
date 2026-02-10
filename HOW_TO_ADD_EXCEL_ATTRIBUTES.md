# How to Add Excel Attributes - Step by Step Guide

## Understanding the Issue

The **Source Attributes table is EMPTY by design** until you manually select which columns you want to add. This is the expected behavior for all source nodes in the system.

The schema (column information) is loaded in the background, but you need to explicitly select which columns you want to use in your data flow.

## Step-by-Step Instructions

### Step 1: Create Excel Nodes ✅ (Already Done)
You've already created the nodes successfully:
- `SRC_test_excel_customers` (with 4 columns loaded)
- `SRC_test_excel_orders` (with 5 columns loaded)

The console logs confirm the schema is loaded:
```
[getSelectedNodeData] Schema already loaded in schemaList, columns: 4
[getSelectedNodeData] dataObject: {tables: 'customers', columns: Array(4)}
```

### Step 2: Select the Node
1. Click on the `SRC_test_excel_customers` node on the canvas
2. The node should be highlighted/selected
3. The right panel should show node details

### Step 3: Go to Source Attributes Tab
1. In the right panel, you'll see several tabs:
   - General
   - Connection
   - Data Object
   - **Source Attributes** ← Click this tab
   - Attributes
2. Click on the "Source Attributes" tab

### Step 4: You'll See an Empty Table
The table will show:
- Headers: #, Attribute, Data Type, Src Column Name, Src Data Type, Action
- A message: "No attributes added yet. Click 'Select Attribute To Add' button above to add columns."
- A button at the top: "Select Attribute To Add"

**This is NORMAL and EXPECTED!** The table is empty because you haven't selected any columns yet.

### Step 5: Click "Select Attribute To Add" Button
1. At the top of the Source Attributes tab, click the blue button that says:
   ```
   [+] Select Attribute To Add
   ```
2. A modal window should pop up titled "Select Attributes"

### Step 6: Select Columns in the Modal
In the modal, you should see:
1. A search box at the top
2. A group called "customers" with a checkbox
3. Under "customers", you should see 4 columns:
   - ☐ customer_id
   - ☐ customer_name
   - ☐ email
   - ☐ city

**To select columns:**
- Option A: Check the "customers" group checkbox to select all 4 columns
- Option B: Check individual column checkboxes for specific columns

### Step 7: Click OK
1. After selecting the columns you want, click the "OK" button at the bottom of the modal
2. The modal will close

### Step 8: Verify Attributes Are Added
Now the Source Attributes table should show rows for each selected column:
- Row 1: customer_id (string)
- Row 2: customer_name (string)
- Row 3: email (string)
- Row 4: city (string)

Each row will have:
- Attribute name (editable text field)
- Data type dropdown
- Source column dropdown
- Source data type (read-only)
- Delete button

### Step 9: Repeat for Orders Node
1. Click on the `SRC_test_excel_orders` node
2. Go to "Source Attributes" tab
3. Click "Select Attribute To Add"
4. Select columns from the "orders" group
5. Click "OK"
6. Verify attributes are added

## Troubleshooting

### Issue: Modal doesn't open when I click "Select Attribute To Add"
**Check:**
1. Open browser console (F12)
2. Look for errors (red text)
3. Look for log: `[openAttributesSelection] Called`
4. Share the console output

### Issue: Modal opens but shows "No attributes available"
**Check:**
1. Look for log: `[openAttributesSelection] flatList for Excel:`
2. If flatList is empty, the schema wasn't loaded
3. Share the console output

### Issue: I select columns and click OK, but table is still empty
**Check:**
1. Look for log: `[applySelectedAttributes] Called`
2. Look for log: `[applySelectedAttributes] flatSelected (checked attributes):`
3. Make sure you actually checked the checkboxes before clicking OK
4. Share the console output

## What the Console Should Show

### When you click "Select Attribute To Add":
```
[openAttributesSelection] Called
[openAttributesSelection] Selected node ID: 1
[openAttributesSelection] dataObject.columns: [{col: 'customer_id', dtype: 'string'}, ...]
[openAttributesSelection] schemaList: [{tables: 'customers', columns: [...]}]
[openAttributesSelection] Processing source_data_object
[openAttributesSelection] Processing non-standard source type (Excel, etc.)
[openAttributesSelection] flatList for Excel: [{label: 'customer_id', value: 'customer_id', dataType: 'string', group: 'customers'}, ...]
[openAttributesSelection] Final groupAttributesList: [{group: 'customers', attributes: [...]}]
```

### When you click OK after selecting columns:
```
[applySelectedAttributes] Called
[applySelectedAttributes] groupAttributesList: [...]
[applySelectedAttributes] flatSelected (checked attributes): [{label: 'customer_id', ...}, ...]
[applySelectedAttributes] Processing source_data_object
[applySelectedAttributes] isSourceClicked: true
[applySelectedAttributes] Using schemaList for non-standard source
```

## Key Points

1. ✅ **Schema is loaded** - Your console logs confirm this
2. ✅ **Nodes are created** - Both customers and orders nodes exist
3. ⚠️ **Attributes are NOT auto-added** - This is by design
4. 👉 **You MUST manually select** which columns to add using the "Select Attribute To Add" button

## Next Steps

Please try the steps above and let me know:
1. Does the modal open when you click "Select Attribute To Add"?
2. Do you see the columns listed in the modal?
3. After selecting and clicking OK, do the attributes appear in the table?

If any step fails, please share:
- Screenshot of what you see
- Console logs (especially any errors in red)
- Which step failed
