# STAVAGENT Parsers Inventory & Workflow C Implementation

**Дата:** 2025-12-28
**Статус:** ✅ Все парсеры найдены и проанализированы

---

## 🎯 Цель

Использовать **ВСЕ** существующие парсеры на полную для создания Workflow C (Document Analysis → Work List Generation).

---

## 📦 Инвентаризация Парсеров

### 1. **MinerU (magic-pdf)** ⭐ НОВЫЙ
**Файл:** `concrete-agent/packages/core-backend/app/core/mineru_client.py`
**Библиотека:** `magic-pdf==1.3.12` (установлен в requirements.txt)

**Возможности:**
```python
class MinerUClient:
    def parse_pdf_estimate(pdf_path: str) -> Dict:
        """
        Парсинг PDF смет с сохранением структуры таблиц

        Features:
        - Сохраняет структуру таблиц (tables preservation)
        - Извлекает позиции с ценами (positions extraction)
        - Извлекает totals (суммы)
        - OCR engine: paddle или tesseract

        Returns:
            {
                "positions": [...],
                "totals": {...},
                "metadata": {...}
            }
        """

    def parse_technical_drawings(pdf_path: str) -> Dict:
        """
        Парсинг технических чертежей с OCR

        Features:
        - Извлечение размеров (100 x 200, L=500)
        - Извлечение материалов (beton, C20/25, B500)
        - OCR для сканированных чертежей

        Returns:
            {
                "dimensions": [...],
                "materials": [...],
                "raw_text": "..."
            }
        """
```

**Когда использовать:**
- ✅ PDF сметы с таблицами (лучше всего сохраняет структуру)
- ✅ Технические чертежи PDF (OCR для сканов)
- ✅ Сложные многостраничные PDF документы
- ⚠️ НЕ для DOCX (только PDF)

---

### 2. **SmartParser** (Универсальный)
**Файл:** `concrete-agent/packages/core-backend/app/parsers/smart_parser.py`

**Возможности:**
```python
class SmartParser:
    """
    Умный выбор парсера на основе формата и размера

    Logic:
    - File < 20MB → Standard parsers (pandas, pdfplumber)
    - File > 20MB → Streaming parsers (memory-efficient)
    - Auto-detect format (Excel, PDF, XML)
    """

    def parse(file_path: Path) -> Dict:
        """Auto-detect and parse"""
        # Automatically chooses:
        # - ExcelParser for .xlsx/.xls
        # - PDFParser for .pdf
        # - XMLParser for .xml
```

**Когда использовать:**
- ✅ Универсальный entry point (не знаешь формат → используй SmartParser)
- ✅ Автоматический выбор memory-efficient parser для больших файлов
- ✅ Fallback если специализированный парсер не подходит

---

### 3. **PDFParser** (pdfplumber)
**Файл:** `concrete-agent/packages/core-backend/app/parsers/pdf_parser.py`

**Возможности:**
```python
class PDFParser:
    """
    Parse construction estimates from PDF files

    Uses: pdfplumber (table extraction)

    Features:
    - Extract tables from all pages
    - Convert tables to positions[]
    - Normalize positions (unit detection, quantity parsing)
    """

    def parse(file_path: Path) -> Dict:
        """
        Returns:
            {
                "document_info": {...},
                "positions": [...],
                "diagnostics": {...}
            }
        """
```

**Когда использовать:**
- ✅ PDF сметы с таблицами (простая структура)
- ✅ Быстрый парсинг без OCR
- ⚠️ НЕ для сканированных PDF (нет OCR)
- ⚠️ MinerU лучше для сложных таблиц

---

### 4. **DrawingSpecsParser** (Технические спецификации)
**Файл:** `concrete-agent/packages/core-backend/app/parsers/drawing_specs_parser.py`

**Возможности:**
```python
class DrawingSpecsParser:
    """
    Extract technical specifications from drawing PDFs

    Uses: pdfplumber + regex patterns

    Detects:
    - Concrete classes: C30/37, C25/30
    - Exposure classes: XC3, XF2, XD1
    - Reinforcement: B500B, B500A
    - Steel grades: S355, S235
    - Geometry: Ø200, L=500, 100x200
    - Cover depth: krytí 40mm
    - Surface categories: Aa, Bb, C1a
    - Norms: ČSN EN 206, ČSN 73 1201
    - Bridge keywords: pilota, opěra, římsa
    """

    def parse_files(drawing_files: List[Dict]) -> Dict:
        """
        Returns:
            {
                "specifications": [
                    {
                        "file": "drawing_01.pdf",
                        "page": 3,
                        "anchor": "C30/37",
                        "text": "Beton C30/37, XC4/XF1, krytí 40mm",
                        "confidence": 0.92,
                        "technical_specs": {
                            "concrete_class": "C30/37",
                            "exposure_env": ["XC4", "XF1"],
                            "cover_depth": "40mm"
                        }
                    },
                    ...
                ],
                "diagnostics": {...}
            }
        """
```

**Когда использовать:**
- ✅ Извлечение технических спецификаций из чертежей
- ✅ Обогащение позиций параметрами из drawings
- ✅ Детерминистический парсинг (без ML/OCR, быстрый)

---

### 5. **ExcelParser** (pandas)
**Файл:** `concrete-agent/packages/core-backend/app/parsers/excel_parser.py`

**Возможности:**
```python
class ExcelParser:
    """
    Parse Excel estimates using pandas

    Features:
    - Multi-sheet support
    - Header detection
    - Position normalization
    - Quantity/unit extraction
    """

    def parse(file_path: Path) -> Dict:
        """
        Returns:
            {
                "positions": [...],
                "diagnostics": {...}
            }
        """
```

**Когда использовать:**
- ✅ Excel сметы (BOQ в .xlsx/.xls)
- ✅ Файлы < 20MB (для больших → MemoryEfficientExcelParser)

---

### 6. **KROSParser** (KROS XML)
**Файл:** `concrete-agent/packages/core-backend/app/parsers/kros_parser.py`

**Возможности:**
```python
class KROSParser:
    """
    Parse KROS XML files (Czech construction standard)

    Features:
    - KROS code extraction
    - Position hierarchy (chapters, sections)
    - Price data
    """
```

**Когда использовать:**
- ✅ KROS XML файлы (чешский стандарт смет)
- ✅ Интеграция с KROS системами

---

### 7. **XC4Parser** (Exposure Classes)
**Файл:** `concrete-agent/packages/core-backend/app/parsers/xc4_parser.py`

**Возможности:**
```python
class XC4Parser:
    """
    Parse exposure class specifications

    Detects: XC1-XC4, XD1-XD3, XF1-XF4, XA1-XA3, XS1-XS3
    """
```

**Когда использовать:**
- ✅ Парсинг и валидация exposure classes из документации
- ✅ Часть DrawingSpecsParser

---

## 🎯 Workflow C: Стратегия использования парсеров

### Phase 1: Document Upload & Parsing

```python
# Workflow C endpoint
@router.post("/api/workflow/c/import")
async def workflow_c_import(
    technical_zadanie: UploadFile,       # TZ (PDF/DOCX)
    specifications: List[UploadFile],    # Спецификации (PDF/DOCX/Excel)
    drawings: List[UploadFile],          # Чертежи (DWG/PDF)
    project_type: str                    # "bridge" | "building" | "tunnel"
):
    """
    Workflow C: Document Analysis → Work List Generation
    """

    # ========================================
    # STEP 1: Parse TZ (Technical Zadanie)
    # ========================================

    tz_suffix = Path(technical_zadanie.filename).suffix.lower()

    if tz_suffix == '.pdf':
        # Option A: MinerU (best for complex PDF)
        mineru = MinerUClient()
        if mineru.available:
            tz_data = mineru.parse_pdf_estimate(tz_path)
            # Extract text + tables + structure
        else:
            # Fallback: PDFParser
            pdf_parser = PDFParser()
            tz_data = pdf_parser.parse(tz_path)

    elif tz_suffix in ['.docx', '.doc']:
        # TODO: Add DOCX parser (python-docx or mammoth)
        # For now: convert DOCX → PDF → parse
        tz_data = await convert_docx_to_pdf_and_parse(tz_path)

    else:
        # SmartParser fallback
        smart_parser = SmartParser()
        tz_data = smart_parser.parse(tz_path)

    # ========================================
    # STEP 2: Parse Specifications
    # ========================================

    specs_data = []
    for spec_file in specifications:
        spec_suffix = Path(spec_file.filename).suffix.lower()

        if spec_suffix == '.pdf':
            # MinerU or PDFParser
            if spec_suffix == '.pdf' and mineru.available:
                data = mineru.parse_pdf_estimate(spec_path)
            else:
                data = PDFParser().parse(spec_path)

        elif spec_suffix in ['.xlsx', '.xls']:
            # ExcelParser
            data = ExcelParser().parse(spec_path)

        else:
            # SmartParser
            data = SmartParser().parse(spec_path)

        specs_data.append(data)

    # ========================================
    # STEP 3: Parse Drawings
    # ========================================

    drawing_specs = DrawingSpecsParser().parse_files(drawing_files)

    # Also extract images from drawings using MinerU
    drawing_images = []
    for drawing_file in drawing_files:
        if Path(drawing_file['path']).suffix.lower() == '.pdf':
            # MinerU can extract images from PDF
            drawing_data = mineru.parse_technical_drawings(drawing_file['path'])
            drawing_images.append(drawing_data)

    # ========================================
    # STEP 4: Merge all parsed data
    # ========================================

    combined_data = {
        "tz": tz_data,
        "specifications": specs_data,
        "drawing_specs": drawing_specs,
        "drawing_images": drawing_images
    }

    # ========================================
    # STEP 5: Generate WBS using Multi-Role AI
    # ========================================

    wbs = await generate_work_breakdown_structure(
        project_type=project_type,
        tz_content=tz_data,
        specs=specs_data,
        drawings=drawing_specs,
        ai_client=multi_role_client
    )

    return {
        "project_id": project_id,
        "work_list": wbs.items,
        "milestones": wbs.milestones
    }
```

---

## 🧠 WBS Generator Strategy

### Using Multi-Role AI + Parsers

```python
async def generate_work_breakdown_structure(
    project_type: str,
    tz_content: Dict,
    specs: List[Dict],
    drawings: Dict,
    ai_client: MultiRoleClient
) -> WBS:
    """
    Generate Work Breakdown Structure using Multi-Role AI

    Roles used:
    - Document Validator → validate completeness of TZ
    - Project Manager → create milestones and phases
    - Structural Engineer → define structural work items
    - Concrete Specialist → define concrete work items
    - Cost Estimator → estimate quantities
    """

    # ========================================
    # STEP 1: Extract project requirements
    # ========================================

    requirements = extract_project_requirements(
        tz_content=tz_content,
        project_type=project_type
    )
    # {
    #     "building_type": "bridge",
    #     "span_length": 50,  # meters
    #     "deck_width": 12,   # meters
    #     "foundation_type": "drilled_piles",
    #     "concrete_volumes": {
    #         "piles": 450,  # m3
    #         "caps": 125,   # m3
    #         "deck": 600    # m3
    #     }
    # }

    # ========================================
    # STEP 2: Ask Document Validator
    # ========================================

    validation_result = await ai_client.askMultiRole(
        question=f"""
        Validate completeness of this project documentation:

        Project Type: {project_type}
        Requirements: {json.dumps(requirements, indent=2)}

        TZ Summary: {tz_content.get('summary', 'N/A')}
        Specifications: {len(specs)} files
        Drawings: {len(drawings['specifications'])} specs found

        Questions:
        1. Is the documentation complete enough to generate a work list?
        2. What critical information is missing?
        3. What assumptions should we make?
        4. Completeness score (0-100%)?
        """,
        context={
            "project_type": project_type,
            "requirements": requirements
        },
        enableKb=True
    )

    # If completeness < 60%, stop and ask user for missing docs
    if validation_result.get('completeness_score', 0) < 60:
        raise InsufficientDocumentationError(
            missing_items=validation_result['missing_items'],
            recommendations=validation_result['recommendations']
        )

    # ========================================
    # STEP 3: Ask Project Manager for milestones
    # ========================================

    milestones_result = await ai_client.askMultiRole(
        question=f"""
        Create project milestones for this {project_type} project:

        Requirements:
        {json.dumps(requirements, indent=2)}

        Create 5-8 milestones with:
        - Milestone name (Czech)
        - Phase (preparation, foundation, structure, finishing)
        - Estimated duration (days)
        - Dependencies

        Format as JSON array.
        """,
        context={
            "role_preference": "project_manager"
        }
    )

    milestones = extract_milestones_from_answer(milestones_result)

    # ========================================
    # STEP 4: Ask Structural Engineer for structural work
    # ========================================

    structural_work = await ai_client.askMultiRole(
        question=f"""
        Define structural work items for {project_type}:

        Requirements: {json.dumps(requirements, indent=2)}
        Drawing Specs: {json.dumps(drawings['specifications'][:10], indent=2)}

        Create detailed work items for:
        - Foundation (piles, caps, footings)
        - Structural elements (columns, beams, slabs)
        - Connections and joints

        For each item provide:
        - Description (Czech)
        - Quantity (best estimate)
        - Unit (m3, m2, m, kg, ks)
        - Material specs (concrete class, reinforcement)
        - Related milestone

        Format as JSON array.
        """,
        context={
            "role_preference": "structural_engineer",
            "drawing_specs": drawings['specifications']
        }
    )

    # ========================================
    # STEP 5: Ask Concrete Specialist for concrete work
    # ========================================

    concrete_work = await ai_client.askMultiRole(
        question=f"""
        Define concrete work items for {project_type}:

        Requirements: {json.dumps(requirements, indent=2)}
        Drawing Specs (concrete classes): {extract_concrete_classes(drawings)}

        Create work items for:
        - Concrete pouring (by element type)
        - Formwork (by complexity)
        - Reinforcement (by grade)
        - Curing and protection

        Use concrete classes from drawings: {extract_concrete_classes(drawings)}
        Use exposure classes from drawings: {extract_exposure_classes(drawings)}

        Format as JSON array.
        """,
        context={
            "role_preference": "concrete_specialist"
        }
    )

    # ========================================
    # STEP 6: Ask Cost Estimator for quantities
    # ========================================

    quantities_result = await ai_client.askMultiRole(
        question=f"""
        Estimate quantities for all work items:

        Structural Work: {len(structural_work['items'])} items
        Concrete Work: {len(concrete_work['items'])} items

        Known volumes from TZ:
        {json.dumps(requirements.get('concrete_volumes', {}), indent=2)}

        Refine quantities based on:
        - TZ data
        - Drawing dimensions
        - Industry standards (ČSN, KROS norms)

        Return updated work items with accurate quantities.
        """,
        context={
            "role_preference": "cost_estimator",
            "work_items": structural_work['items'] + concrete_work['items']
        }
    )

    # ========================================
    # STEP 7: Merge and create WBS
    # ========================================

    wbs = WorkBreakdownStructure(
        project_id=project_id,
        project_type=project_type,
        milestones=milestones,
        work_items=merge_work_items(
            structural_work['items'],
            concrete_work['items'],
            quantities_result['items']
        ),
        total_estimated_cost_czk=sum_costs(work_items),
        total_duration_days=sum_durations(milestones),
        confidence=calculate_confidence(validation_result, work_items),
        generated_by="Multi-Role AI (PM + SE + CS + CE)",
        created_at=datetime.now().isoformat()
    )

    return wbs
```

---

## 📊 Parser Selection Matrix

| Document Type | Primary Parser | Fallback | Notes |
|---------------|---------------|----------|-------|
| **PDF смета (таблицы)** | MinerU | PDFParser | MinerU лучше сохраняет структуру |
| **PDF чертежи** | DrawingSpecsParser + MinerU | PDFParser | DrawingSpecs для text, MinerU для images |
| **PDF TZ (сканированный)** | MinerU (OCR mode) | - | OCR required |
| **PDF TZ (digital)** | MinerU or PDFParser | SmartParser | Digital PDF легче парсить |
| **Excel смета** | ExcelParser | SmartParser | Стандартный Excel парсинг |
| **DOCX спецификация** | ❌ **TODO** | Convert to PDF | Нужен python-docx или mammoth |
| **XML KROS** | KROSParser | - | Специализированный формат |
| **DWG чертежи** | ❌ **TODO** | Convert to PDF | Нужен ezdxf или aspose |
| **Большие файлы (>20MB)** | SmartParser (auto-streaming) | - | Memory-efficient parsers |

---

## ⚠️ Missing Parsers (TODO)

### 1. DOCX Parser
**Библиотеки:**
- `python-docx` - популярная, простая
- `mammoth` - лучше для сложных документов
- `docx2txt` - lightweight, только текст

**Установка:**
```bash
pip install python-docx mammoth
```

**Пример:**
```python
from docx import Document

def parse_docx(file_path: Path) -> Dict:
    doc = Document(file_path)

    text_content = []
    tables = []

    for paragraph in doc.paragraphs:
        text_content.append(paragraph.text)

    for table in doc.tables:
        table_data = []
        for row in table.rows:
            row_data = [cell.text for cell in row.cells]
            table_data.append(row_data)
        tables.append(table_data)

    return {
        "text": "\n".join(text_content),
        "tables": tables,
        "paragraphs": len(doc.paragraphs)
    }
```

---

### 2. DWG Parser
**Библиотеки:**
- `ezdxf` - популярная, open-source
- `aspose-cad` - commercial, более мощная

**Установка:**
```bash
pip install ezdxf
```

**Пример:**
```python
import ezdxf

def parse_dwg(file_path: Path) -> Dict:
    # DWG → DXF conversion needed first
    # Or use aspose-cad for direct DWG parsing

    doc = ezdxf.readfile(file_path)

    entities = []
    for entity in doc.modelspace():
        if entity.dxftype() == 'TEXT':
            entities.append({
                "type": "text",
                "content": entity.dxf.text,
                "position": (entity.dxf.insert.x, entity.dxf.insert.y)
            })

    return {
        "entities": entities,
        "layers": [layer.dxf.name for layer in doc.layers]
    }
```

---

### 3. Image OCR (для сканированных чертежей)
**Библиотеки:**
- `pytesseract` - Tesseract OCR wrapper
- `paddleocr` - PaddlePaddle OCR (better for technical drawings)
- `easyocr` - EasyOCR (multi-language)

**Примечание:** MinerU уже использует PaddleOCR, но можно улучшить для чертежей.

---

## 🚀 Implementation Plan

### Phase 1: Улучшить MinerU integration (1 день)

**Задачи:**
1. Добавить DOCX support через conversion:
   ```python
   async def parse_docx_via_conversion(docx_path: Path) -> Dict:
       # Convert DOCX → PDF using LibreOffice or docx2pdf
       pdf_path = convert_docx_to_pdf(docx_path)

       # Parse with MinerU
       mineru = MinerUClient()
       return mineru.parse_pdf_estimate(pdf_path)
   ```

2. Улучшить `_extract_materials()` и `_extract_dimensions()`:
   - Использовать regex patterns из DrawingSpecsParser
   - Добавить extraction для exposure classes, reinforcement grades

3. Добавить integration с DrawingSpecsParser:
   ```python
   def parse_drawing_comprehensive(pdf_path: Path) -> Dict:
       # Text extraction
       drawing_specs = DrawingSpecsParser().parse_files([pdf_path])

       # Image/dimensions extraction
       mineru_data = MinerUClient().parse_technical_drawings(pdf_path)

       # Merge results
       return {
           "technical_specs": drawing_specs['specifications'],
           "dimensions": mineru_data['dimensions'],
           "materials": mineru_data['materials']
       }
   ```

---

### Phase 2: Создать Workflow C endpoint (2 дня)

**Задачи:**
1. Создать `routes_workflow_c.py`:
   ```python
   @router.post("/api/workflow/c/import")
   async def workflow_c_import(...):
       # Parse all documents
       # Generate WBS with Multi-Role AI
       # Return work list
   ```

2. Создать `wbs_generator.py`:
   ```python
   class WorkBreakdownStructure:
       # WBS data model

   async def generate_work_breakdown_structure(...):
       # Multi-Role AI orchestration
   ```

3. Создать helper functions:
   - `extract_project_requirements(tz_content, project_type)`
   - `extract_concrete_classes(drawings)`
   - `extract_exposure_classes(drawings)`
   - `merge_work_items(structural, concrete, quantities)`

---

### Phase 3: URS Matcher integration (1 день)

**Задачи:**
1. Создать endpoint `/api/jobs/match-work-list`:
   ```python
   @router.post('/jobs/match-work-list')
   async def match_work_list(work_list: List[Dict]):
       # For each work item
       # Match with URS codes
       # Return enriched work list
   ```

2. Создать `coreClient.js` в URS Matcher:
   ```javascript
   async function uploadToWorkflowC(files, projectType) {
       const formData = new FormData();
       formData.append('technical_zadanie', files.tz);
       formData.append('project_type', projectType);

       const response = await fetch(
           `${CORE_API_URL}/api/workflow/c/import`,
           { method: 'POST', body: formData }
       );

       return response.json();
   }
   ```

3. UI для Workflow C в URS Matcher

---

### Phase 4: Testing + Documentation (1 день)

**Задачи:**
1. Test cases:
   - Bridge TZ → WBS generation → URS matching
   - Building TZ → WBS generation → URS matching

2. Documentation:
   - Update `CLAUDE.md` with Workflow C
   - Create `WORKFLOW_C_GUIDE.md`

---

## 📝 Summary

### Что уже есть (используем на 100%):

1. ✅ **MinerU (magic-pdf)** - high-quality PDF parsing с OCR
2. ✅ **SmartParser** - универсальный парсер с auto-detection
3. ✅ **PDFParser** - pdfplumber для простых PDF
4. ✅ **DrawingSpecsParser** - технические спецификации из чертежей
5. ✅ **ExcelParser** - Excel сметы
6. ✅ **KROSParser** - KROS XML
7. ✅ **Multi-Role AI** - 6 specialist roles для WBS generation

### Что добавить:

1. ⚠️ **DOCX Parser** - python-docx или conversion через LibreOffice
2. ⚠️ **DWG Parser** - ezdxf (или conversion DWG→PDF→parse)
3. ⚠️ **Improved OCR** - улучшить MinerU для технических чертежей

### Total Time Estimate:

- Phase 1: Improve MinerU - 1 день
- Phase 2: Workflow C - 2 дня
- Phase 3: URS Matcher - 1 день
- Phase 4: Testing - 1 день
- **Total: 5-6 дней**

---

**Автор:** Claude (AI Assistant)
**Дата:** 2025-12-28
**Версия:** 1.0
**Статус:** ✅ Готово к разработке
