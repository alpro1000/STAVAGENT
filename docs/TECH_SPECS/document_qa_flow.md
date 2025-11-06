# Document Q&A Flow - Technical Specification

**Created:** 2025-11-06
**Status:** 🟡 Implementation Pending
**Priority:** ⭐⭐⭐⭐⭐ CRITICAL (Killer Feature!)
**Phase:** 4 - Backend Infrastructure

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [User Journey](#user-journey)
3. [System Architecture](#system-architecture)
4. [Document Parsing Pipeline](#document-parsing-pipeline)
5. [Question Generation](#question-generation)
6. [Answer Extraction](#answer-extraction)
7. [UI/UX Flow](#uiux-flow)
8. [Incremental Updates](#incremental-updates)
9. [Implementation Details](#implementation-details)
10. [Testing Strategy](#testing-strategy)

---

## Executive Summary

### Problem Statement

**Competitor approach (RozpočetPRO):**
```
User enters text description
  ↓
System asks 3 clarification questions
  ↓
USER MANUALLY TYPES answers to each question ❌
  ↓
System generates budget
```

**Pain points:**
- User must remember/know all technical details
- Time-consuming (typing specifications manually)
- Error-prone (user may provide wrong info)
- No validation against uploaded documents
- No reference/source tracking

### Our Solution: Document Intelligence

**Concrete Agent approach:**
```
User uploads documents (TechSpec.pdf, Materials.xlsx, Drawings.pdf)
  ↓
System parses ALL documents automatically
  ↓
System generates clarification questions
  ↓
System AUTOMATICALLY answers questions by READING uploaded documents ✅
  ↓
User REVIEWS answers (with sources/page numbers)
  ↓
User can confirm, edit, or add notes
  ↓
System generates budget with validated context
```

**Advantages:**
- ✅ No manual typing required
- ✅ Answers extracted from authoritative sources (documents)
- ✅ Full traceability (page numbers, sheet names)
- ✅ Higher accuracy (based on actual documents, not memory)
- ✅ Faster (automated extraction)
- ✅ Incremental updates (add more docs later → auto-update)

### Success Criteria

- ✅ Extract 90%+ answers automatically from uploaded documents
- ✅ Show source references (filename, page/sheet, line number)
- ✅ Confidence scores for each answer (0-100%)
- ✅ User can edit any answer
- ✅ Support incremental document uploads
- ✅ Real-time recalculation when docs updated

---

## User Journey

### Scenario: New Construction Project

**User has:**
- TechSpec.pdf (technical specification from architect)
- Materials.xlsx (bill of materials from supplier)
- Drawings.pdf (construction drawings)
- Budget_Template.xlsx (client's budget template)

**Step-by-step flow:**

```
Day 1, 14:00 - Initial Upload
═══════════════════════════════

User:
  1. Creates new project "Novostavba RD Valcha"
  2. Uploads 3 documents:
     - TechSpec_v1.pdf (15 pages)
     - Materials.xlsx (5 sheets)
     - Site_Plans.pdf (8 pages)
  3. Clicks "Analyze Documents"

System:
  1. Parses all 3 documents (2-3 minutes)
  2. Extracts all text, tables, specifications
  3. Indexes content for search
  4. Generates clarification questions:

     Found Information:
     ✅ Building area: 120 m²
     ✅ Foundation type: Concrete slab
     ✅ Wall material: Mentioned "brick" (not specific)
     ✅ Roof structure: Timber truss

     Missing/Unclear Information:
     ❓ Q1: Jaký specifický typ zdiva? (Porotherm, Ytong, jiný?)
     ❓ Q2: Jaká třída betonu pro základy? (C20/25, C25/30, C30/37?)
     ❓ Q3: Jaký materiál střešní krytiny?
     ❓ Q4: Specifikace instalací (elektřina, voda, topení)?

  5. Attempts to answer each question by searching documents

User sees in UI:
  ╔══════════════════════════════════════════════════╗
  ║ 🤖 Document Analysis Complete                   ║
  ║                                                  ║
  ║ Analyzed: 3 files, 28 pages total               ║
  ║ Auto-answered: 3/4 questions                     ║
  ║ Need clarification: 1 question                   ║
  ╚══════════════════════════════════════════════════╝

  ┌──────────────────────────────────────────────────┐
  │ ❓ Q1: Jaký specifický typ zdiva?               │
  │                                                  │
  │ ✅ Found in documents:                           │
  │ "Porotherm 40 Profi"                            │
  │                                                  │
  │ 📄 Source: Materials.xlsx                        │
  │    Sheet "Zdivo", Row 3, Column "Produkt"       │
  │ 🎯 Confidence: 95%                               │
  │                                                  │
  │ [✓ Correct] [✏️ Edit] [➕ Add Note]             │
  └──────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────┐
  │ ❓ Q2: Jaká třída betonu pro základy?           │
  │                                                  │
  │ ✅ Found in documents:                           │
  │ "C25/30"                                        │
  │                                                  │
  │ 📄 Source: TechSpec_v1.pdf                       │
  │    Page 12, Section 3.2 "Základové konstrukce"  │
  │ 🎯 Confidence: 90%                               │
  │                                                  │
  │ [✓ Correct] [✏️ Edit] [➕ Add Note]             │
  └──────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────┐
  │ ❓ Q3: Jaký materiál střešní krytiny?           │
  │                                                  │
  │ ⚠️ Partial answer found:                        │
  │ "Betonová taška (výrobce neuved en)"             │
  │                                                  │
  │ 📄 Source: TechSpec_v1.pdf, Page 15              │
  │ 🎯 Confidence: 70%                               │
  │                                                  │
  │ 💬 Please clarify:                               │
  │ [Bramac, červená barva, 30-letá záruka________]  │
  │                                                  │
  │ [✓ Confirm & Update] [✏️ Edit Completely]       │
  └──────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────┐
  │ ❓ Q4: Specifikace instalací?                   │
  │                                                  │
  │ ❌ Not found in uploaded documents               │
  │                                                  │
  │ 💬 Please provide:                               │
  │ [_____________________________________________]   │
  │                                                  │
  │ 💡 Tip: Upload installation specification        │
  │    document if available                         │
  │                                                  │
  │ [✓ Add Answer] [📎 Upload Document]             │
  └──────────────────────────────────────────────────┘

  [✨ Generate Budget with These Answers]

User actions:
  - Clicks [✓ Correct] for Q1 and Q2
  - Fills clarification for Q3: "Bramac, červená barva..."
  - For Q4: Uploads new document "HVAC_Spec.pdf"

System:
  - Re-analyzes with new document
  - Updates Q4 answer automatically
  - All 4 questions now answered
  - Ready to generate budget


Day 1, 15:30 - Budget Generation
═════════════════════════════════

User clicks [✨ Generate Budget]

System:
  1. Collects validated context:
     {
       "foundation": {
         "concrete_grade": "C25/30",
         "source": "TechSpec_v1.pdf page 12",
         "confidence": 0.90
       },
       "walls": {
         "material": "Porotherm 40 Profi",
         "source": "Materials.xlsx sheet 'Zdivo' row 3",
         "confidence": 0.95
       },
       "roofing": {
         "material": "Betonová taška Bramac, červená",
         "source": "TechSpec_v1.pdf page 15 + user clarification",
         "confidence": 1.00,
         "note": "30-letá záruka confirmed by user"
       },
       "hvac": {
         "system": "Plynový kondenzační kotel Vaillant 24kW",
         "source": "HVAC_Spec.pdf page 2",
         "confidence": 0.95
       }
     }

  2. Claude Multi-Role generates detailed budget
  3. Returns 150+ positions with full specifications
  4. All positions tagged with source documents


Day 2, 10:00 - Incremental Update
══════════════════════════════════

Client calls:
  "Actually, change windows from Veka to Rehau"

User in chat:
  "Změnit okna na Rehau místo Veka"

System:
  1. Finds position: "Okna plastová trojsklo Veka"
  2. Updates: "Okna plastová trojsklo Rehau"
  3. Queries price database:
     - Veka: 8,500 Kč/m²
     - Rehau: 9,200 Kč/m²
     - Delta: +700 Kč/m²
  4. Recalculates: 15 m² × 700 Kč = +10,500 Kč total

User sees:
  ╔════════════════════════════════════════╗
  ║ ✅ Budget Updated                      ║
  ║                                        ║
  ║ Changed: Okna plastová                 ║
  ║ From: Veka (8,500 Kč/m²)               ║
  ║ To: Rehau (9,200 Kč/m²)                ║
  ║                                        ║
  ║ Impact: +10,500 Kč                     ║
  ║ New total: 2,510,500 Kč                ║
  ║                                        ║
  ║ Reason: Rehau is premium brand         ║
  ╚════════════════════════════════════════╝


Day 3, 14:00 - Additional Document
═══════════════════════════════════

Architect sends updated spec:
  "Changes_From_Client.docx"

User uploads:
  [📎 Upload] Changes_From_Client.docx

System parses and finds:
  - Added: Terrace 20 m² (new feature)
  - Changed: Living room +5 m² (bigger)
  - Removed: Fireplace (cancelled)

System automatically:
  1. Adds terrace positions:
     - Terrace foundation
     - Terrace paving
     - Terrace drainage
  2. Recalculates living room finishes (+5 m²)
  3. Removes fireplace-related positions

User sees:
  ╔════════════════════════════════════════╗
  ║ 🆕 Document Changes Detected           ║
  ║                                        ║
  ║ From: Changes_From_Client.docx         ║
  ║                                        ║
  ║ Changes applied:                       ║
  ║ ➕ Added terrace (20 m²) +125,000 Kč   ║
  ║ 📏 Larger living room (+5 m²) +8,500 Kč│
  ║ ➖ Removed fireplace -45,000 Kč        ║
  ║                                        ║
  ║ Net change: +88,500 Kč                 ║
  ║ New total: 2,599,000 Kč                ║
  ║                                        ║
  ║ [✓ Accept Changes] [📋 Review Details]│
  ╚════════════════════════════════════════╝
```

---

## System Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. DOCUMENT UPLOAD                                      │
│                                                         │
│ User → [Upload] TechSpec.pdf, Materials.xlsx, Drawings │
│   ↓                                                     │
│ FastAPI /upload endpoint                               │
│   ↓                                                     │
│ Save to storage (S3 or local)                          │
│   ↓                                                     │
│ Create document records in PostgreSQL                  │
│   ↓                                                     │
│ Enqueue parsing job (Celery)                           │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ 2. DOCUMENT PARSING (Background Job)                   │
│                                                         │
│ Celery worker picks up job                             │
│   ↓                                                     │
│ Route to appropriate parser:                           │
│   - PDF → MinerU + pdfplumber                          │
│   - Excel → openpyxl + pandas                          │
│   - Word → python-docx                                 │
│   ↓                                                     │
│ Extract:                                                │
│   - Full text content                                  │
│   - Tables and structured data                         │
│   - Images (for drawings)                              │
│   - Metadata                                            │
│   ↓                                                     │
│ Save to PostgreSQL:                                     │
│   - indexed_content (full text for search)             │
│   - extracted_data (structured JSONB)                  │
│   ↓                                                     │
│ Update document status: "completed"                    │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ 3. ANALYSIS & QUESTION GENERATION                      │
│                                                         │
│ User clicks "Analyze Documents"                         │
│   ↓                                                     │
│ Claude analyzes all indexed_content                    │
│   ↓                                                     │
│ Prompt:                                                 │
│   "Analyze these construction documents:                │
│    [Document 1 content...]                              │
│    [Document 2 content...]                              │
│                                                         │
│    Extract:                                             │
│    1. What information IS present?                      │
│    2. What information is MISSING or unclear?           │
│    3. Generate clarification questions"                 │
│   ↓                                                     │
│ Claude returns:                                         │
│   {                                                     │
│     "found": [                                          │
│       {"field": "building_area", "value": "120m²", ...} │
│     ],                                                  │
│     "missing": [...],                                   │
│     "questions": [                                      │
│       {                                                 │
│         "id": "q1",                                     │
│         "question": "Jaký typ zdiva?",                  │
│         "category": "materials",                        │
│         "priority": "high"                              │
│       }                                                 │
│     ]                                                   │
│   }                                                     │
│   ↓                                                     │
│ Save questions to PostgreSQL                            │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ 4. AUTOMATIC ANSWER EXTRACTION                         │
│                                                         │
│ For each question:                                      │
│   ↓                                                     │
│ Claude searches in document content:                    │
│   Prompt:                                               │
│     "Find answer to: '{question}'                       │
│                                                         │
│      Search in:                                         │
│      Document 1 (TechSpec.pdf):                         │
│      [Page 1 content...]                                │
│      [Page 2 content...]                                │
│      ...                                                │
│                                                         │
│      Document 2 (Materials.xlsx):                       │
│      Sheet 'Zdivo': [table data...]                     │
│      Sheet 'Betony': [table data...]                    │
│      ...                                                │
│                                                         │
│      Return:                                            │
│      - answer (if found)                                │
│      - source (document, page/sheet, line)              │
│      - confidence (0-100%)                              │
│      - excerpt (relevant text snippet)"                 │
│   ↓                                                     │
│ Claude returns:                                         │
│   {                                                     │
│     "question_id": "q1",                                │
│     "answer": "Porotherm 40 Profi",                     │
│     "source": {                                         │
│       "document": "Materials.xlsx",                     │
│       "sheet": "Zdivo",                                 │
│       "row": 3,                                         │
│       "column": "Produkt"                               │
│     },                                                  │
│     "confidence": 0.95,                                 │
│     "excerpt": "Zdivo: Porotherm 40 Profi, 248x400..."  │
│   }                                                     │
│   ↓                                                     │
│ Save answer to PostgreSQL (chat_history table)         │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ 5. USER REVIEW & VALIDATION                            │
│                                                         │
│ UI shows Q&A with sources                               │
│   ↓                                                     │
│ User actions:                                           │
│   - [✓ Correct] → Accept answer                        │
│   - [✏️ Edit] → Modify answer                          │
│   - [➕ Note] → Add context/clarification               │
│   - [📎 Upload] → Add more documents                   │
│   ↓                                                     │
│ Save user feedback:                                     │
│   - Original answer preserved                           │
│   - User edits tracked                                  │
│   - Confidence updated to 100% if confirmed             │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ 6. BUDGET GENERATION                                    │
│                                                         │
│ User clicks "Generate Budget"                           │
│   ↓                                                     │
│ Collect all validated answers                           │
│   ↓                                                     │
│ Build complete context JSON                             │
│   ↓                                                     │
│ Claude Multi-Role generates budget:                     │
│   - Uses validated specifications                       │
│   - Tags positions with source documents                │
│   - Includes confidence scores                          │
│   ↓                                                     │
│ Save budget version to PostgreSQL                       │
│   ↓                                                     │
│ Return to user                                          │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ 7. INCREMENTAL UPDATES                                  │
│                                                         │
│ When user uploads new document:                         │
│   ↓                                                     │
│ Parse new document                                      │
│   ↓                                                     │
│ Re-run answer extraction with NEW content              │
│   ↓                                                     │
│ Detect changes:                                         │
│   - New information found                               │
│   - Conflicts with existing answers                     │
│   - Additional details                                  │
│   ↓                                                     │
│ Update answers if better source found                   │
│   ↓                                                     │
│ Recalculate budget if needed                            │
│   ↓                                                     │
│ Notify user of changes via WebSocket                    │
└─────────────────────────────────────────────────────────┘
```

---

## Document Parsing Pipeline

### Parser Selection

```python
# app/parsers/document_parser_factory.py
from pathlib import Path
from app.parsers import PDFParser, ExcelParser, WordParser

class DocumentParserFactory:
    """Factory for selecting appropriate parser"""

    @staticmethod
    def get_parser(file_path: Path):
        suffix = file_path.suffix.lower()

        if suffix == '.pdf':
            return PDFParser()  # Uses MinerU + pdfplumber
        elif suffix in ['.xlsx', '.xls']:
            return ExcelParser()  # Uses openpyxl + pandas
        elif suffix in ['.docx', '.doc']:
            return WordParser()  # Uses python-docx
        elif suffix == '.xml':
            return XMLParser()  # For KROS format
        else:
            raise ValueError(f"Unsupported file type: {suffix}")
```

### PDF Parsing (Technical Documents)

```python
# app/parsers/pdf_document_parser.py
from app.core.mineru_client import MinerUClient
import pdfplumber

class PDFDocumentParser:
    """Enhanced PDF parser for technical documents"""

    def __init__(self):
        self.mineru = MinerUClient()

    async def parse(self, file_path: Path) -> dict:
        """
        Parse PDF with focus on structure and searchability

        Returns:
            {
                "full_text": "Page 1: ...\nPage 2: ...",
                "pages": [
                    {
                        "number": 1,
                        "text": "...",
                        "tables": [...],
                        "sections": [
                            {"heading": "3.2 Základy", "content": "..."}
                        ]
                    }
                ],
                "metadata": {
                    "total_pages": 15,
                    "has_tables": True,
                    "has_images": True
                }
            }
        """

        # Try MinerU first (best quality)
        try:
            result = await self.mineru.parse_technical_document(file_path)
            return self._structure_mineru_output(result)
        except Exception as e:
            logger.warning(f"MinerU failed: {e}, falling back to pdfplumber")

        # Fallback to pdfplumber
        with pdfplumber.open(file_path) as pdf:
            pages = []
            full_text = []

            for page_num, page in enumerate(pdf.pages, start=1):
                # Extract text
                text = page.extract_text() or ""

                # Extract tables
                tables = page.extract_tables()

                # Detect sections (headings)
                sections = self._detect_sections(text)

                pages.append({
                    "number": page_num,
                    "text": text,
                    "tables": tables,
                    "sections": sections
                })

                full_text.append(f"Page {page_num}:\n{text}")

            return {
                "full_text": "\n\n".join(full_text),
                "pages": pages,
                "metadata": {
                    "total_pages": len(pdf.pages),
                    "has_tables": any(p["tables"] for p in pages),
                    "has_images": False  # pdfplumber doesn't extract images
                }
            }

    def _detect_sections(self, text: str) -> list:
        """Detect document sections by headings"""
        import re

        sections = []
        # Pattern for Czech/Slovak section headings
        # Examples: "3.2 Základové konstrukce", "IV. Střecha"
        pattern = r'(?:^|\n)((?:\d+\.)*\d+\.?\s+[A-ZČŘŠŽĎŤŇ][^\n]+)'

        for match in re.finditer(pattern, text):
            heading = match.group(1).strip()
            # Get content until next heading
            start = match.end()
            next_match = re.search(pattern, text[start:])
            end = start + next_match.start() if next_match else len(text)

            sections.append({
                "heading": heading,
                "content": text[start:end].strip()
            })

        return sections
```

### Excel Parsing (Materials, Specs)

```python
# app/parsers/excel_document_parser.py
import openpyxl
import pandas as pd

class ExcelDocumentParser:
    """Excel parser for materials lists and specifications"""

    async def parse(self, file_path: Path) -> dict:
        """
        Parse Excel with all sheets

        Returns:
            {
                "full_text": "Sheet Zdivo: ...\nSheet Betony: ...",
                "sheets": [
                    {
                        "name": "Zdivo",
                        "data": [[row1], [row2], ...],
                        "headers": ["Položka", "Produkt", "Množství"],
                        "summary": "Material list for walls: 15 items"
                    }
                ],
                "metadata": {
                    "total_sheets": 5,
                    "total_rows": 147
                }
            }
        """

        wb = openpyxl.load_workbook(file_path, data_only=True)
        sheets = []
        full_text = []
        total_rows = 0

        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]

            # Convert to pandas for easier handling
            df = pd.DataFrame(ws.values)

            # Detect header row
            header_row = self._detect_header_row(df)
            if header_row is not None:
                df.columns = df.iloc[header_row]
                df = df.iloc[header_row + 1:]

            # Clean data
            df = df.dropna(how='all')

            # Convert to list for JSON
            data = df.values.tolist()
            headers = df.columns.tolist() if header_row is not None else []

            # Create text summary
            text_summary = f"Sheet '{sheet_name}':\n"
            text_summary += f"Headers: {', '.join(str(h) for h in headers)}\n"
            text_summary += f"Rows:\n"

            for idx, row in enumerate(data[:100], start=1):  # First 100 rows
                text_summary += f"  Row {idx}: {' | '.join(str(cell) for cell in row if cell)}\n"

            sheets.append({
                "name": sheet_name,
                "data": data,
                "headers": headers,
                "summary": f"{len(data)} rows"
            })

            full_text.append(text_summary)
            total_rows += len(data)

        return {
            "full_text": "\n\n".join(full_text),
            "sheets": sheets,
            "metadata": {
                "total_sheets": len(sheets),
                "total_rows": total_rows
            }
        }

    def _detect_header_row(self, df: pd.DataFrame, max_rows: int = 10) -> int:
        """Detect which row contains column headers"""
        # Look for row with most non-null values
        scores = []
        for idx in range(min(max_rows, len(df))):
            row = df.iloc[idx]
            score = row.notna().sum()
            scores.append((idx, score))

        if scores:
            return max(scores, key=lambda x: x[1])[0]
        return None
```

### Word Document Parsing

```python
# app/parsers/word_document_parser.py
from docx import Document

class WordDocumentParser:
    """Parser for Word documents"""

    async def parse(self, file_path: Path) -> dict:
        """
        Parse Word document

        Returns:
            {
                "full_text": "...",
                "paragraphs": [...],
                "tables": [...],
                "metadata": {...}
            }
        """

        doc = Document(file_path)

        paragraphs = []
        tables = []
        full_text = []

        # Extract paragraphs
        for para in doc.paragraphs:
            if para.text.strip():
                paragraphs.append({
                    "text": para.text,
                    "style": para.style.name
                })
                full_text.append(para.text)

        # Extract tables
        for table in doc.tables:
            table_data = []
            for row in table.rows:
                row_data = [cell.text for cell in row.cells]
                table_data.append(row_data)
            tables.append(table_data)

            # Add table to full_text
            full_text.append("\nTABLE:")
            for row in table_data:
                full_text.append(" | ".join(row))

        return {
            "full_text": "\n".join(full_text),
            "paragraphs": paragraphs,
            "tables": tables,
            "metadata": {
                "total_paragraphs": len(paragraphs),
                "total_tables": len(tables)
            }
        }
```

---

## Question Generation

### Claude Prompt for Analysis

```python
# app/prompts/document_analysis_prompt.py

DOCUMENT_ANALYSIS_PROMPT = """
You are a construction project analyst. Analyze uploaded documents and extract key information.

UPLOADED DOCUMENTS:
{documents}

YOUR TASKS:

1. **Extract Present Information**
   List all key specifications found in documents:
   - Building area, dimensions
   - Foundation type and specifications
   - Wall materials and types
   - Roof structure and covering
   - Installation systems (HVAC, plumbing, electrical)
   - Special requirements

   For each item, cite the source:
   - Document name
   - Page number or sheet name
   - Specific section or row

2. **Identify Missing Information**
   Determine what critical information is missing or unclear:
   - Ambiguous specifications (e.g., "brick" but not specific type)
   - Incomplete data (e.g., concrete grade not specified)
   - Missing systems (e.g., no HVAC specification found)

3. **Generate Clarification Questions**
   Create 3-6 prioritized questions to fill gaps:
   - HIGH priority: Critical for cost estimation
   - MEDIUM priority: Important but can estimate
   - LOW priority: Nice to have

   Questions should be:
   - Specific and technical
   - In Czech language
   - Easy to answer from additional documents or expert knowledge

OUTPUT FORMAT:
{
  "found": [
    {
      "field": "building_area",
      "value": "120 m²",
      "source": {
        "document": "TechSpec.pdf",
        "page": 3,
        "section": "1.2 Základní parametry"
      },
      "confidence": 1.0
    },
    ...
  ],
  "missing": [
    {
      "field": "concrete_grade_foundation",
      "reason": "Not specified in TechSpec.pdf",
      "impact": "Cannot accurately price foundation work"
    },
    ...
  ],
  "questions": [
    {
      "id": "q1",
      "question": "Jaký konkrétní typ zdiva plánujete použít? (např. Porotherm 40, Ytong P2-400)",
      "category": "materials",
      "priority": "high",
      "context": "V dokumentech je uvedeno pouze 'cihelné zdivo', ale pro cenový odhad potřebujeme přesný typ."
    },
    ...
  ]
}
"""
```

### Question Types

```python
# app/models/question_types.py
from enum import Enum

class QuestionCategory(str, Enum):
    MATERIALS = "materials"
    DIMENSIONS = "dimensions"
    SPECIFICATIONS = "specifications"
    SYSTEMS = "systems"  # HVAC, plumbing, electrical
    FINISHES = "finishes"
    OTHER = "other"

class QuestionPriority(str, Enum):
    HIGH = "high"      # Critical for estimation
    MEDIUM = "medium"  # Important but can estimate
    LOW = "low"        # Nice to have

class Question(BaseModel):
    id: str
    question: str
    category: QuestionCategory
    priority: QuestionPriority
    context: str  # Why this question is needed

    # Answer (filled later)
    answer: Optional[str] = None
    answer_source: Optional[dict] = None
    answer_confidence: Optional[float] = None

    # User interaction
    user_edited: bool = False
    user_note: Optional[str] = None
    confirmed: bool = False
```

---

## Answer Extraction

### Claude Prompt for Answer Search

```python
# app/prompts/answer_extraction_prompt.py

ANSWER_EXTRACTION_PROMPT = """
You are a document search assistant. Find the answer to a specific question in uploaded documents.

QUESTION:
{question}

CONTEXT:
{context}

DOCUMENTS TO SEARCH:
{documents}

YOUR TASK:
Search through all documents and find the most relevant answer to the question.

SEARCH STRATEGY:
1. Look for exact matches first
2. Look for related terms and synonyms
3. Check tables and specifications
4. Consider context from surrounding text

IF FOUND:
- Extract the exact answer
- Cite the precise source (document, page/sheet, line/row)
- Include relevant excerpt (2-3 sentences of context)
- Assign confidence score (0-100%)

IF NOT FOUND:
- State that answer was not found
- Suggest what additional information would help

OUTPUT FORMAT:
{
  "found": true/false,
  "answer": "exact answer text",
  "source": {
    "document": "filename",
    "location": "page 12" or "sheet 'Materials' row 5",
    "section": "optional section heading"
  },
  "excerpt": "surrounding text for context",
  "confidence": 0.95,
  "reasoning": "why this is the correct answer"
}

EXAMPLES:

Question: "Jaký typ zdiva?"
Answer: {
  "found": true,
  "answer": "Porotherm 40 Profi",
  "source": {
    "document": "Materials.xlsx",
    "location": "sheet 'Zdivo', row 3, column 'Produkt'",
    "section": null
  },
  "excerpt": "Zdivo: Porotherm 40 Profi, rozměr 248x400x249mm, pevnost P15",
  "confidence": 0.98,
  "reasoning": "Clearly specified in materials list with exact product name"
}

Question: "Jaká třída betonu?"
Answer: {
  "found": true,
  "answer": "C25/30",
  "source": {
    "document": "TechSpec.pdf",
    "location": "page 12",
    "section": "3.2 Základové konstrukce"
  },
  "excerpt": "Základy budou provedeny z betonu třídy C25/30 dle ČSN EN 206.",
  "confidence": 0.95,
  "reasoning": "Explicitly stated in technical specification section about foundations"
}

Question: "Jaký typ topení?"
Answer: {
  "found": false,
  "answer": null,
  "source": null,
  "excerpt": null,
  "confidence": 0.0,
  "reasoning": "No mention of heating system found in any uploaded documents. Recommend uploading HVAC specification or asking directly."
}
"""
```

### Implementation

```python
# app/services/answer_extraction_service.py
from app.core.claude_client import claude_client
from app.models import Question

class AnswerExtractionService:
    """Service for extracting answers from documents"""

    async def extract_answer(
        self,
        question: Question,
        documents: list[dict]
    ) -> dict:
        """
        Extract answer to question from documents

        Args:
            question: Question object
            documents: List of parsed documents

        Returns:
            {
                "found": True,
                "answer": "...",
                "source": {...},
                "confidence": 0.95
            }
        """

        # Build document context
        doc_context = self._build_document_context(documents)

        # Query Claude
        prompt = ANSWER_EXTRACTION_PROMPT.format(
            question=question.question,
            context=question.context,
            documents=doc_context
        )

        response = await claude_client.query(
            prompt=prompt,
            max_tokens=2000,
            temperature=0.0  # Deterministic for accuracy
        )

        # Parse JSON response
        import json
        result = json.loads(response)

        return result

    def _build_document_context(self, documents: list[dict]) -> str:
        """Build formatted context from documents"""

        context_parts = []

        for doc in documents:
            doc_part = f"DOCUMENT: {doc['filename']}\n"
            doc_part += f"TYPE: {doc['file_type']}\n"
            doc_part += f"CONTENT:\n{doc['indexed_content']}\n"
            doc_part += "=" * 80 + "\n"

            context_parts.append(doc_part)

        return "\n".join(context_parts)
```

---

## UI/UX Flow

### Q&A Component

```typescript
// frontend/components/document-qa/QAFlow.tsx
interface Answer {
  questionId: string;
  found: boolean;
  answer: string | null;
  source: {
    document: string;
    location: string;
    section?: string;
  } | null;
  confidence: number;
  userEdited: boolean;
  userNote?: string;
  confirmed: boolean;
}

export function QAFlow({ projectId }: { projectId: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);

  // Fetch Q&A data
  useEffect(() => {
    loadQuestionsAndAnswers();
  }, [projectId]);

  const handleConfirm = (questionId: string) => {
    updateAnswer(questionId, { confirmed: true });
  };

  const handleEdit = (questionId: string, newAnswer: string) => {
    updateAnswer(questionId, {
      answer: newAnswer,
      userEdited: true,
      confidence: 1.0
    });
  };

  const handleAddNote = (questionId: string, note: string) => {
    updateAnswer(questionId, { userNote: note });
  };

  return (
    <div className="space-y-4">
      <h2>Document Analysis Results</h2>

      {questions.map((question) => {
        const answer = answers.find(a => a.questionId === question.id);

        return (
          <QACard
            key={question.id}
            question={question}
            answer={answer}
            onConfirm={() => handleConfirm(question.id)}
            onEdit={(newAnswer) => handleEdit(question.id, newAnswer)}
            onAddNote={(note) => handleAddNote(question.id, note)}
          />
        );
      })}

      <button
        onClick={generateBudget}
        disabled={!allQuestionsAnswered(questions, answers)}
      >
        ✨ Generate Budget with These Answers
      </button>
    </div>
  );
}
```

### Q&A Card Component

```typescript
// frontend/components/document-qa/QACard.tsx
export function QACard({
  question,
  answer,
  onConfirm,
  onEdit,
  onAddNote
}: QACardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedAnswer, setEditedAnswer] = useState(answer?.answer || '');

  const getStatusIcon = () => {
    if (!answer || !answer.found) return '❌';
    if (answer.confidence >= 0.9) return '✅';
    return '⚠️';
  };

  const getStatusText = () => {
    if (!answer || !answer.found) return 'Not found in documents';
    if (answer.confidence >= 0.9) return 'Found in documents';
    return 'Partial answer found';
  };

  return (
    <div className="border rounded-lg p-4 bg-white">
      {/* Question */}
      <div className="mb-3">
        <span className="text-sm text-gray-500">
          {question.priority === 'high' && '🔴 High Priority'}
          {question.priority === 'medium' && '🟡 Medium Priority'}
          {question.priority === 'low' && '🟢 Low Priority'}
        </span>
        <h3 className="font-semibold mt-1">❓ {question.question}</h3>
        <p className="text-sm text-gray-600 mt-1">{question.context}</p>
      </div>

      {/* Answer */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{getStatusIcon()}</span>
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>

        {answer?.found && (
          <>
            {isEditing ? (
              <textarea
                value={editedAnswer}
                onChange={(e) => setEditedAnswer(e.target.value)}
                className="w-full border rounded p-2"
                rows={3}
              />
            ) : (
              <p className="bg-gray-50 p-3 rounded">{answer.answer}</p>
            )}

            {/* Source */}
            {answer.source && (
              <div className="mt-2 text-sm text-gray-600">
                <span className="font-medium">📄 Source:</span>{' '}
                {answer.source.document}, {answer.source.location}
                {answer.source.section && ` (${answer.source.section})`}
              </div>
            )}

            {/* Confidence */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-gray-600">🎯 Confidence:</span>
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600"
                  style={{ width: `${answer.confidence * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium">
                {(answer.confidence * 100).toFixed(0)}%
              </span>
            </div>

            {/* User note */}
            {answer.userNote && (
              <div className="mt-2 bg-blue-50 p-2 rounded text-sm">
                <strong>📝 Your note:</strong> {answer.userNote}
              </div>
            )}
          </>
        )}

        {!answer?.found && (
          <textarea
            placeholder="Please provide the answer here..."
            className="w-full border rounded p-2 mt-2"
            rows={3}
            onChange={(e) => setEditedAnswer(e.target.value)}
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {answer?.found && !isEditing && !answer.confirmed && (
          <button
            onClick={onConfirm}
            className="px-3 py-1 bg-green-600 text-white rounded text-sm"
          >
            ✓ Correct
          </button>
        )}

        {answer?.confirmed && (
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm">
            ✓ Confirmed
          </span>
        )}

        {isEditing ? (
          <>
            <button
              onClick={() => {
                onEdit(editedAnswer);
                setIsEditing(false);
              }}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
            >
              💾 Save
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1 border rounded text-sm"
            >
              ❌ Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="px-3 py-1 border rounded text-sm"
          >
            ✏️ Edit
          </button>
        )}

        <button
          onClick={() => {
            const note = prompt('Add your note:');
            if (note) onAddNote(note);
          }}
          className="px-3 py-1 border rounded text-sm"
        >
          ➕ Add Note
        </button>
      </div>
    </div>
  );
}
```

---

## Incremental Updates

### Document Addition Flow

```python
# app/services/document_qa_service.py

class DocumentQAService:
    """Service for document Q&A flow"""

    async def handle_new_document(
        self,
        project_id: str,
        document_id: str
    ):
        """
        Handle newly uploaded document:
        1. Parse document
        2. Re-run answer extraction
        3. Detect changes
        4. Update budget if needed
        5. Notify user
        """

        # 1. Get existing Q&A state
        existing_qa = await self.get_project_qa(project_id)

        # 2. Parse new document
        document = await parse_document(document_id)

        # 3. Re-extract answers with NEW document included
        all_documents = await get_project_documents(project_id)

        updated_answers = []
        for question in existing_qa['questions']:
            # Re-run answer extraction
            new_answer = await answer_extraction_service.extract_answer(
                question=question,
                documents=all_documents  # Including new document!
            )

            # Compare with existing answer
            existing_answer = existing_qa['answers'].get(question.id)

            if self._is_better_answer(new_answer, existing_answer):
                updated_answers.append({
                    'question_id': question.id,
                    'old_answer': existing_answer.get('answer'),
                    'new_answer': new_answer['answer'],
                    'reason': 'Better source found in new document'
                })

        # 4. If answers changed, recalculate budget
        if updated_answers:
            await self.recalculate_budget(project_id, updated_answers)

        # 5. Send WebSocket notification
        await websocket_manager.send_to_project(
            project_id=project_id,
            event={
                'type': 'document_added',
                'document': document.filename,
                'updates': len(updated_answers),
                'changes': updated_answers
            }
        )

    def _is_better_answer(self, new_answer: dict, existing_answer: dict) -> bool:
        """Determine if new answer is better than existing"""

        if not existing_answer:
            return new_answer['found']

        # Higher confidence = better
        if new_answer['confidence'] > existing_answer.get('confidence', 0) + 0.1:
            return True

        # More specific answer = better
        if len(new_answer.get('answer', '')) > len(existing_answer.get('answer', '')) * 1.5:
            return True

        return False
```

### Chat-based Updates

```python
# app/api/routes_chat.py

@router.post("/projects/{project_id}/chat")
async def chat_message(project_id: str, message: str):
    """
    Handle chat message that may update budget

    Example: "Změnit okna na Rehau místo Veka"
    """

    # 1. Classify intent
    intent = await classify_chat_intent(message)

    if intent['type'] == 'modify_position':
        # Extract what to change
        changes = intent['changes']  # {from: "Veka", to: "Rehau", category: "windows"}

        # 2. Find affected positions
        positions = await find_positions(project_id, category=changes['category'])

        # 3. Update positions
        updated_positions = []
        for pos in positions:
            if changes['from'] in pos.description:
                old_price = pos.unit_price
                new_price = await get_price(changes['to'], pos.unit)

                pos.description = pos.description.replace(changes['from'], changes['to'])
                pos.unit_price = new_price
                pos.total_price = new_price * pos.quantity

                updated_positions.append({
                    'id': pos.id,
                    'old_price': old_price,
                    'new_price': new_price,
                    'delta': new_price - old_price
                })

        # 4. Recalculate budget
        total_delta = sum(p['delta'] * get_quantity(p['id']) for p in updated_positions)

        # 5. Create new budget version
        await create_budget_version(
            project_id=project_id,
            trigger_type='chat_modification',
            changes=updated_positions,
            delta_cost=total_delta
        )

        # 6. Return response
        return {
            'type': 'budget_updated',
            'changes': updated_positions,
            'total_delta': total_delta,
            'message': f"✅ Changed {len(updated_positions)} positions from {changes['from']} to {changes['to']}. Total impact: {total_delta:+,.0f} Kč"
        }
```

---

## Implementation Details

### API Endpoints

```python
# app/api/routes_document_qa.py
from fastapi import APIRouter, UploadFile, File

router = APIRouter()

@router.post("/projects/{project_id}/documents/upload")
async def upload_document(
    project_id: str,
    file: UploadFile = File(...)
):
    """Upload document to project"""
    # Save file
    # Create document record
    # Enqueue parsing job
    pass

@router.post("/projects/{project_id}/analyze")
async def analyze_documents(project_id: str):
    """Generate questions from uploaded documents"""
    # Load all documents
    # Generate questions via Claude
    # Extract answers automatically
    pass

@router.get("/projects/{project_id}/qa")
async def get_qa(project_id: str):
    """Get all questions and answers"""
    pass

@router.post("/projects/{project_id}/qa/{question_id}/confirm")
async def confirm_answer(project_id: str, question_id: str):
    """Confirm answer is correct"""
    pass

@router.post("/projects/{project_id}/qa/{question_id}/edit")
async def edit_answer(
    project_id: str,
    question_id: str,
    new_answer: str,
    note: str = None
):
    """Edit answer"""
    pass

@router.post("/projects/{project_id}/generate-budget")
async def generate_budget_from_qa(project_id: str):
    """Generate budget from validated Q&A"""
    pass
```

---

## Testing Strategy

### Unit Tests

```python
# tests/test_answer_extraction.py
import pytest

@pytest.mark.asyncio
async def test_extract_answer_from_pdf():
    """Test answer extraction from PDF"""
    question = Question(
        id="q1",
        question="Jaká třída betonu?",
        category="materials",
        priority="high"
    )

    documents = [
        {
            'filename': 'TechSpec.pdf',
            'indexed_content': 'Page 12: Základy z betonu C25/30...'
        }
    ]

    result = await answer_extraction_service.extract_answer(question, documents)

    assert result['found'] == True
    assert 'C25/30' in result['answer']
    assert result['confidence'] > 0.9
```

### Integration Tests

```python
# tests/test_document_qa_flow.py
@pytest.mark.asyncio
async def test_full_qa_flow():
    """Test complete Q&A flow"""
    # 1. Upload documents
    project_id = await create_project()
    await upload_document(project_id, 'test_files/TechSpec.pdf')

    # 2. Analyze
    qa = await analyze_documents(project_id)
    assert len(qa['questions']) > 0

    # 3. Verify auto-answers
    answered = [q for q in qa['questions'] if q.get('answer')]
    assert len(answered) > 0

    # 4. Generate budget
    budget = await generate_budget_from_qa(project_id)
    assert len(budget['positions']) > 0
```

---

## Success Metrics

**After implementation:**

- ✅ 90%+ answers extracted automatically
- ✅ Average confidence score > 85%
- ✅ Users edit < 20% of answers
- ✅ Time saved: 80% vs manual typing
- ✅ Source traceability: 100%
- ✅ User satisfaction: > 4.5/5

---

**Document Status:** ✅ Complete
**Next Steps:** Implement according to backend_infrastructure.md first
**Dependencies:** PostgreSQL, Redis, Celery (from backend_infrastructure.md)

---

**Last Updated:** 2025-11-06
**Author:** Claude Code (AI Development Assistant)
**Reviewed By:** [Pending]
