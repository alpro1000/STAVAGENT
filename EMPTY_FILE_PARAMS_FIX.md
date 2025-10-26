# Empty File Parameter Validation Fix

## Problem
When clients sent empty values for optional file parameters (e.g., `-F 'rozpocet='` or `-F 'zmeny='`), FastAPI received empty strings instead of `None` or `UploadFile`, causing validation errors:

```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body", "rozpocet"],
      "msg": "Value error, Expected UploadFile, received: <class 'str'>",
      "input": "",
      "ctx": {"error": {}}
    }
  ]
}
```

## Solution

### 1. Added Normalization Functions (`app/api/routes.py`)

#### `_normalize_optional_file(file: Any) -> Optional[UploadFile]`
- Converts empty strings to `None` for optional single file parameters
- Uses duck typing to handle both FastAPI and Starlette `UploadFile` types
- Validates that files have non-empty filenames

#### `_normalize_file_list(files: List[Any]) -> List[UploadFile]`
- Filters out empty strings from file lists
- Ensures only valid `UploadFile` objects with filenames are kept

### 2. Updated Parameter Types

Changed parameter types in `upload_project()` to accept both strings and UploadFiles:
- Single files: `Union[UploadFile, str, None]`
- File lists: `Union[List[UploadFile], List[str], List[Any]]`

This allows FastAPI to accept the empty strings without validation errors, then we normalize them in the function body.

### 3. Extended File Format Support

Updated `ALLOWED_EXTENSIONS` to support additional formats:
- **vykaz**: Added `.csv` (for CSV exports from construction software)
- **vykresy**: Added `.txt` (for text-based drawing descriptions)
- **dokumentace**: Added `.txt` (for text documentation)

## Usage Examples

### Empty Optional File Parameter
```bash
curl -X POST "http://localhost:8000/api/upload" \
  -F "project_name=My Project" \
  -F "workflow=A" \
  -F "rozpocet=" \
  -F "vykaz_vymer=@vykaz.xml" \
  -F "vykresy=@drawing.pdf"
```

### Empty List Parameters
```bash
curl -X POST "http://localhost:8000/api/upload" \
  -F "project_name=My Project" \
  -F "workflow=B" \
  -F "zmeny=" \
  -F "dokumentace=" \
  -F "vykresy=@drawing.pdf"
```

### CSV Vykaz File
```bash
curl -X POST "http://localhost:8000/api/upload" \
  -F "project_name=CSV Project" \
  -F "workflow=A" \
  -F "vykaz_vymer=@vykaz.csv" \
  -F "vykresy=@drawing.pdf"
```

### TXT Drawing Description
```bash
curl -X POST "http://localhost:8000/api/upload" \
  -F "project_name=TXT Project" \
  -F "workflow=A" \
  -F "vykaz_vymer=@vykaz.xml" \
  -F "vykresy=@drawing.txt"
```

## Testing

Created comprehensive test suite in `tests/test_empty_file_params.py`:

### Test Coverage
1. ✅ Empty single file parameter (`rozpocet`)
2. ✅ Empty list parameter (`zmeny`)
3. ✅ All optional files empty
4. ✅ Workflow B with empty optional files
5. ✅ CSV file support for vykaz
6. ✅ TXT file support for vykresy
7. ✅ TXT file support for dokumentace

### Test Results
```
tests/test_empty_file_params.py::TestEmptyFileParameters::test_empty_rozpocet_parameter PASSED
tests/test_empty_file_params.py::TestEmptyFileParameters::test_empty_zmeny_list_parameter PASSED
tests/test_empty_file_params.py::TestEmptyFileParameters::test_all_optional_files_empty PASSED
tests/test_empty_file_params.py::TestEmptyFileParameters::test_workflow_b_with_empty_optional_files PASSED
tests/test_empty_file_params.py::TestNewFileExtensions::test_csv_vykaz_file PASSED
tests/test_empty_file_params.py::TestNewFileExtensions::test_txt_vykresy_file PASSED
tests/test_empty_file_params.py::TestNewFileExtensions::test_txt_dokumentace_file PASSED

7 passed, 7 warnings in 1.50s
```

### Existing Tests
All existing security tests continue to pass:
```
tests/test_file_security.py - 9 passed
```

## Implementation Details

### Key Changes in `app/api/routes.py`

1. **Import Addition**
   ```python
   from typing import Dict, Any, List, Optional, Union
   ```

2. **Extended Allowed Extensions**
   ```python
   ALLOWED_EXTENSIONS = {
       'vykaz': {'.xml', '.xlsx', '.xls', '.pdf', '.csv'},
       'vykresy': {'.pdf', '.dwg', '.dxf', '.png', '.jpg', '.jpeg', '.txt'},
       'dokumentace': {'.pdf', '.doc', '.docx', '.xlsx', '.xls', '.txt'},
   }
   ```

3. **Normalization in upload_project()**
   ```python
   # Normalize empty strings to None/empty lists
   vykaz_vymer = _normalize_optional_file(vykaz_vymer)
   rozpocet = _normalize_optional_file(rozpocet)
   vykresy = _normalize_file_list(vykresy) if isinstance(vykresy, list) else []
   dokumentace = _normalize_file_list(dokumentace) if isinstance(dokumentace, list) else []
   zmeny = _normalize_file_list(zmeny) if isinstance(zmeny, list) else []
   ```

## Benefits

✅ **Client Flexibility**: Clients can now send empty optional file parameters without worrying about validation errors

✅ **Better Error Handling**: Clear separation between missing files (empty string) and required files (validation error)

✅ **Extended Format Support**: Support for CSV and TXT files enables more diverse data sources

✅ **Backward Compatible**: Existing functionality remains unchanged for clients that don't send empty parameters

## Notes

- The normalization uses duck typing (`hasattr(file, 'filename')`) to handle both FastAPI and Starlette `UploadFile` types
- Empty strings are silently converted to `None` or filtered out, not causing errors
- The existing filtering logic (checking `f.filename`) continues to work as before
- All changes are minimal and surgical, affecting only the necessary parts of the code
