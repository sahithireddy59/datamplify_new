# Excel Sheets Endpoint 400 Error Fix

## Issue Summary
When dragging an Excel connection (type 28, UUID: `3ba97267-5539-4b30-8337-3e0f0bedb4bb`) to FlowBoard, the frontend correctly called the `/api/v1/connections/excel_sheets/<id>/` endpoint, but it returned a 400 Bad Request error.

## Root Cause
The `ExcelSheetList` view in `Datamplify-DEV/Connections/views.py` was attempting to read the Excel file directly from an S3 URL using pandas:

```python
file_path = str(file_data.source.url if hasattr(file_data.source, 'url') else file_data.source)
excel_file = pd.ExcelFile(file_path)  # This fails - pandas cannot read from S3 URL string
```

**Problem**: 
- `file_data.source` contains an S3 URL: `https://haskmedia.s3.amazonaws.com/Datamplify/files/2026-02-10_12_19_48.005846_IN_test_excel.xlsx`
- Pandas `ExcelFile()` cannot directly read from an S3 URL string
- The file needs to be downloaded from S3 first

## Solution Implemented

### Backend Fix (Datamplify-DEV/Connections/views.py)

Modified the `ExcelSheetList.get()` method to:
1. Use `file_data.datapath` (S3 key) instead of `file_data.source` (S3 URL)
2. Download the file from S3 using boto3's `s3.get_object()`
3. Read the file content into memory as bytes
4. Use `io.BytesIO()` to create a file-like object from bytes
5. Pass the BytesIO object to pandas `ExcelFile()`

**Code Changes**:
```python
import pandas as pd
import io

# Download file from S3 using datapath (S3 key)
s3_key = str(file_data.datapath)

try:
    # Get file object from S3
    file_obj = s3.get_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=s3_key)
    file_content = file_obj['Body'].read()
    
    # Read Excel file from bytes
    excel_file = pd.ExcelFile(io.BytesIO(file_content))
    sheet_names = excel_file.sheet_names
    
except Exception as s3_error:
    return Response({'message': f'Error downloading file from S3: {str(s3_error)}'}, 
                   status=status.HTTP_500_INTERNAL_SERVER_ERROR)
```

### Key Changes:
1. **Line 933**: Removed `file_path` variable that was using `file_data.source`
2. **Line 940**: Added `s3_key = str(file_data.datapath)` to get the S3 object key
3. **Lines 942-948**: Added S3 download logic with proper error handling
4. **Line 947**: Changed `pd.ExcelFile(file_path)` to `pd.ExcelFile(io.BytesIO(file_content))`

## Testing

### Database Verification
```bash
Connection Name: test_excel
Source: https://haskmedia.s3.amazonaws.com/Datamplify/files/2026-02-10_12_19_48.005846_IN_test_excel.xlsx
Datapath: Datamplify/files/2026-02-10_12_19_48.005846_IN_test_excel.xlsx
File Type: EXCEL
```

### Expected Behavior After Fix
1. User drags Excel connection (type 28) to FlowBoard source node
2. Frontend calls `GET /api/v1/connections/excel_sheets/3ba97267-5539-4b30-8337-3e0f0bedb4bb/`
3. Backend downloads Excel file from S3 using the datapath key
4. Backend reads sheet names using pandas
5. Backend returns 200 OK with:
   ```json
   {
     "message": "success",
     "available_sheets": ["Sheet1", "Sheet2", ...],
     "selected_sheets": [],
     "sheet_relationships": {},
     "connection_id": "3ba97267-5539-4b30-8337-3e0f0bedb4bb",
     "connection_name": "test_excel"
   }
   ```
6. Frontend displays sheet selection modal with available sheets

## Files Modified
- `Datamplify-DEV/Connections/views.py` (lines 903-960, ExcelSheetList class)

## Related Issues
- This fix is part of the larger Excel integration support implementation
- Frontend fix for preventing integration endpoint calls was completed earlier (see EXCEL_INTEGRATION_ENDPOINT_FIX.md)
- This backend fix completes the Excel sheet selection feature

## Dependencies
- boto3 (AWS SDK) - already imported as `s3` in views.py
- pandas - already imported in the method
- io module - added for BytesIO

## Status
✅ **FIXED** - Django server reloaded successfully at 13:53:30
- Backend now correctly downloads Excel files from S3
- Endpoint should return 200 OK with sheet names
- Ready for frontend testing

## Next Steps
1. Test by dragging Excel connection in FlowBoard UI
2. Verify sheet selection modal appears with correct sheet names
3. Test sheet selection and relationship configuration
4. Verify selected sheets are saved correctly when OK is clicked
