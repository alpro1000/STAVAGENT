"""
Project Document Management API — add, update, and track documents per project.

POST /api/v1/project/{project_id}/add-document  — upload + detect + parse + summarize
GET  /api/v1/project/{project_id}/documents      — list all documents
GET  /api/v1/project/{project_id}/status/{filename} — processing status

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-26
"""

import hashlib
import json
import logging
import os
import re
import tempfile
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.config import settings
from app.models.document_schemas import (
    AddDocumentResponse,
    DiffEntry,
    DocType,
    DocumentDiff,
    DocumentFlag,
    DocumentIdentity,
    DocumentSummary,
    MaterialEntry,
    ProcessingStatus,
    VolumeEntry,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/project", tags=["project-documents"])


# ===========================================================================
# Document type detection
# ===========================================================================

# Filename regex → DocType mapping
_FILENAME_PATTERNS: List[Tuple[re.Pattern, DocType]] = [
    (re.compile(r"soupis|polozk|rozpoc|budget|boq|vykaz", re.IGNORECASE), DocType.SOUPIS_PRACI),
    (re.compile(r"beton|concret", re.IGNORECASE), DocType.TZ_BETON),
    (re.compile(r"bedne|formwork|schal", re.IGNORECASE), DocType.TZ_BEDNENI),
    (re.compile(r"vyztu[zž]|armov|rebar|reinfor", re.IGNORECASE), DocType.TZ_VYZTUZE),
    (re.compile(r"hydro|izolac|waterproof", re.IGNORECASE), DocType.TZ_HYDROIZOLACE),
    (re.compile(r"zemn[ií]|earth|excav", re.IGNORECASE), DocType.TZ_ZEMNI_PRACE),
    (re.compile(r"komuni|silnic|road|traffic|vozovk", re.IGNORECASE), DocType.TZ_KOMUNIKACE),
    (re.compile(r"most|bridge|lávk", re.IGNORECASE), DocType.TZ_MOSTY),
    (re.compile(r"elektr|silnoproud|slaboproud|nn\b|vn\b", re.IGNORECASE), DocType.TZ_ELEKTRO),
    (re.compile(r"(?:^|[_.\s-])zti(?:[_.\s-]|$)|kanal|vodovod|plumb", re.IGNORECASE), DocType.TZ_ZTI),
    (re.compile(r"(?:^|[_.\s-])vzt(?:[_.\s-]|$)|vzduchotech|hvac|ventil", re.IGNORECASE), DocType.TZ_VZT),
    (re.compile(r"(?:^|[_.\s-])ut(?:[_.\s-]|$)|vytáp|heat|topení|kotel", re.IGNORECASE), DocType.TZ_UT),
    (re.compile(r"situac|site.?plan|koordin", re.IGNORECASE), DocType.SITUACE),
]

# Content markers — checked if filename detection fails
_CONTENT_PATTERNS: List[Tuple[re.Pattern, DocType]] = [
    (re.compile(r"(?:Export Komplet|#RTSROZP#|\bPOL\d|položk[ay])", re.IGNORECASE), DocType.SOUPIS_PRACI),
    (re.compile(r"beton\w*\s+(?:C\d|tříd)", re.IGNORECASE), DocType.TZ_BETON),
    (re.compile(r"bednění|formwork|DOKA|PERI", re.IGNORECASE), DocType.TZ_BEDNENI),
    (re.compile(r"výztuž|armatur|B500[ABB]", re.IGNORECASE), DocType.TZ_VYZTUZE),
    (re.compile(r"hydroizolac|asfaltov|bitumen", re.IGNORECASE), DocType.TZ_HYDROIZOLACE),
    (re.compile(r"zemní\s+práce|výkop|zásyp", re.IGNORECASE), DocType.TZ_ZEMNI_PRACE),
    (re.compile(r"komunikac|vozovk|asfalt.*beton|silnic", re.IGNORECASE), DocType.TZ_KOMUNIKACE),
    (re.compile(r"most\w*\s+(?:přes|ev\.|km)", re.IGNORECASE), DocType.TZ_MOSTY),
]


def detect_document_type(filename: str, content_head: str = "") -> DocType:
    """
    Detect document type from filename, then content.

    1. Extension check: xlsx/xml → SOUPIS_PRACI shortcut
    2. Filename regex matching
    3. Content regex matching (first 3000 chars)
    4. Fallback to UNKNOWN
    """
    ext = Path(filename).suffix.lower()

    # Excel/XML → likely soupis prací
    if ext in (".xlsx", ".xlsm", ".xls", ".xml"):
        # Check filename first — could be TZ in Excel form
        for pattern, doc_type in _FILENAME_PATTERNS:
            if pattern.search(filename):
                return doc_type
        return DocType.SOUPIS_PRACI

    # Filename patterns
    for pattern, doc_type in _FILENAME_PATTERNS:
        if pattern.search(filename):
            return doc_type

    # Content patterns (if content available)
    if content_head:
        for pattern, doc_type in _CONTENT_PATTERNS:
            if pattern.search(content_head):
                return doc_type

    return DocType.UNKNOWN


# ===========================================================================
# Summary generation
# ===========================================================================

def _decimal_to_float(val: Any) -> Optional[float]:
    """Convert Decimal or numeric to float."""
    if val is None:
        return None
    if isinstance(val, Decimal):
        return float(val)
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def generate_summary_from_soupis(parsed_doc: Any) -> DocumentSummary:
    """Generate DocumentSummary from a ParsedDocument (soupis prací)."""
    positions = parsed_doc.all_positions
    chapters = set()
    total_price = 0.0
    materials: List[MaterialEntry] = []

    for pos in positions:
        if pos.chapter_name:
            chapters.add(pos.chapter_name)
        tp = _decimal_to_float(pos.total_price)
        if tp:
            total_price += tp

    # Extract first few concrete/rebar materials
    for pos in positions[:200]:
        desc_lower = (pos.description or "").lower()
        if any(kw in desc_lower for kw in ("beton", "výztuž", "ocel", "cement")):
            materials.append(MaterialEntry(
                name=pos.description[:120],
                spec=pos.code,
                quantity=_decimal_to_float(pos.quantity),
                unit=pos.unit,
            ))

    searchable = "\n".join(
        f"{p.code or ''} {p.description}" for p in positions[:50]
    )[:2000]

    return DocumentSummary(
        doc_type=DocType.SOUPIS_PRACI,
        title=parsed_doc.project_name or parsed_doc.source_file,
        description=f"{len(positions)} položek, {len(chapters)} kapitol",
        positions_count=len(positions),
        total_price=total_price if total_price > 0 else None,
        chapters=sorted(chapters),
        materials=materials[:20],
        searchable_text=searchable,
        raw_extraction={
            "source_format": parsed_doc.source_format.value,
            "so_count": len(parsed_doc.stavebni_objekty),
            "positions_count": len(positions),
            "coverage_pct": parsed_doc.coverage_pct,
            "warnings": parsed_doc.parser_warnings[:10],
        },
    )


def generate_summary_from_tz(
    filename: str, doc_type: DocType, text_content: str
) -> DocumentSummary:
    """Generate DocumentSummary from TZ text content (PDF)."""
    materials: List[MaterialEntry] = []
    standards: List[str] = []
    key_requirements: List[str] = []
    flags: List[DocumentFlag] = []

    # Extract ČSN references
    for m in re.finditer(r"ČSN\s+(?:EN\s+)?[\d\s-]+", text_content[:5000]):
        std = m.group().strip()
        if std not in standards:
            standards.append(std)

    # Extract concrete grades
    for m in re.finditer(r"C\s?\d{2}/\d{2,3}(?:\s+X[A-Z]\d)?", text_content[:5000]):
        materials.append(MaterialEntry(name="Beton", spec=m.group().strip()))

    # Extract steel grades
    for m in re.finditer(r"B\s?500[AB]", text_content[:5000]):
        materials.append(MaterialEntry(name="Výztuž", spec=m.group().strip()))

    # Key requirements (sentences with "musí", "požaduje", "nesmí")
    for sentence in re.split(r"[.!]\s+", text_content[:5000]):
        if re.search(r"musí|požaduj|nesmí|nutno|povinně", sentence, re.IGNORECASE):
            req = sentence.strip()[:200]
            if len(req) > 20:
                key_requirements.append(req)

    if not materials and not standards:
        flags.append(DocumentFlag(
            severity="warning",
            message="Nepodařilo se extrahovat materiály ani normy z textu",
        ))

    return DocumentSummary(
        doc_type=doc_type,
        title=filename,
        description=f"Technická zpráva — {doc_type.value}",
        materials=materials[:20],
        standards=standards[:15],
        key_requirements=key_requirements[:10],
        flags=flags,
        searchable_text=text_content[:2000],
    )


# ===========================================================================
# Diff computation
# ===========================================================================

def compute_diff(
    old_summary: Optional[DocumentSummary],
    new_summary: DocumentSummary,
    old_hash: str,
    new_hash: str,
    document_key: str,
) -> DocumentDiff:
    """Compute field-level diff between two versions of the same document."""
    if old_summary is None:
        return DocumentDiff(
            document_key=document_key,
            is_update=False,
            content_changed=True,
            new_hash=new_hash,
        )

    content_changed = old_hash != new_hash
    changes: List[DiffEntry] = []

    # Compare key scalar fields
    for field_name, significance in [
        ("positions_count", "medium"),
        ("total_price", "high"),
        ("title", "low"),
        ("description", "low"),
    ]:
        old_val = getattr(old_summary, field_name, None)
        new_val = getattr(new_summary, field_name, None)
        if old_val != new_val:
            # For numeric fields, check if change is significant (>2%)
            if isinstance(old_val, (int, float)) and isinstance(new_val, (int, float)) and old_val != 0:
                pct = abs(new_val - old_val) / abs(old_val)
                if pct < 0.02:
                    continue  # Within 2% tolerance
                significance = "high" if pct > 0.1 else "medium"
            changes.append(DiffEntry(
                field=field_name,
                old_value=old_val,
                new_value=new_val,
                significance=significance,
            ))

    # Compare chapters list
    old_ch = set(old_summary.chapters)
    new_ch = set(new_summary.chapters)
    added = new_ch - old_ch
    removed = old_ch - new_ch
    if added or removed:
        changes.append(DiffEntry(
            field="chapters",
            old_value=sorted(removed) if removed else None,
            new_value=sorted(added) if added else None,
            significance="medium",
        ))

    # Compare materials count
    if len(old_summary.materials) != len(new_summary.materials):
        changes.append(DiffEntry(
            field="materials_count",
            old_value=len(old_summary.materials),
            new_value=len(new_summary.materials),
            significance="low",
        ))

    return DocumentDiff(
        document_key=document_key,
        is_update=True,
        content_changed=content_changed,
        changes=changes,
        previous_hash=old_hash,
        new_hash=new_hash,
    )


# ===========================================================================
# Project JSON storage
# ===========================================================================

def _project_json_path(project_id: str) -> Path:
    """Path to project.json file."""
    base_dir = settings.PROJECT_DIR
    base_dir.mkdir(parents=True, exist_ok=True)
    return base_dir / f"{project_id}.json"


def load_project_json(project_id: str) -> Dict[str, Any]:
    """Load project.json or create initial structure."""
    path = _project_json_path(project_id)
    if path.exists():
        try:
            with path.open("r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            logger.warning("Corrupt project.json for %s, reinitializing", project_id)

    return {
        "project_id": project_id,
        "version": 0,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "documents": {},       # key: filename::doc_type → DocumentSummary dict
        "identities": {},      # key: filename::doc_type → DocumentIdentity dict
        "processing": {},      # key: filename → ProcessingStatus
        "project_summary": {}, # aggregated info
    }


def save_project_json(project_id: str, data: Dict[str, Any]) -> None:
    """Atomically save project.json."""
    path = _project_json_path(project_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    data["updated_at"] = datetime.now().isoformat()
    data["version"] = data.get("version", 0) + 1

    tmp_path = path.with_suffix(".tmp")
    with tmp_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    tmp_path.rename(path)

    logger.info("Project %s: saved project.json v%d", project_id, data["version"])


def update_project_with_document(
    project_id: str,
    identity: DocumentIdentity,
    summary: DocumentSummary,
) -> int:
    """Add/update a document in project.json. Returns new version."""
    proj = load_project_json(project_id)
    key = identity.key

    proj["identities"][key] = identity.model_dump(mode="json")
    proj["documents"][key] = summary.model_dump(mode="json")
    proj["processing"].pop(identity.filename, None)

    # Update aggregated summary
    _update_project_summary(proj)

    save_project_json(project_id, proj)
    return proj["version"]


def _update_project_summary(proj: Dict[str, Any]) -> None:
    """Recompute aggregated project summary from all documents."""
    total_positions = 0
    total_price = 0.0
    doc_types = set()
    all_materials: List[str] = []

    for doc_data in proj["documents"].values():
        total_positions += doc_data.get("positions_count", 0)
        tp = doc_data.get("total_price")
        if tp:
            total_price += float(tp)
        dt = doc_data.get("doc_type")
        if dt:
            doc_types.add(dt)
        for mat in doc_data.get("materials", [])[:5]:
            name = mat.get("name", "")
            if name:
                all_materials.append(name)

    proj["project_summary"] = {
        "document_count": len(proj["documents"]),
        "total_positions": total_positions,
        "total_price": total_price if total_price > 0 else None,
        "doc_types": sorted(doc_types),
        "materials_sample": all_materials[:10],
    }


# ===========================================================================
# Content reading helpers
# ===========================================================================

def _read_content_head(file_path: str, max_bytes: int = 3000) -> str:
    """Read first N bytes of a file as text (best-effort)."""
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read(max_bytes)
    except Exception:
        return ""


def _compute_sha256(content: bytes) -> str:
    """SHA-256 hex digest of file content."""
    return hashlib.sha256(content).hexdigest()


# ===========================================================================
# Main endpoint
# ===========================================================================

@router.post("/{project_id}/add-document", response_model=AddDocumentResponse)
async def add_document(
    project_id: str,
    file: UploadFile = File(...),
    force_type: Optional[str] = Form(None),
):
    """
    Add a document to a project.

    Flow: upload → detect type → parse (sync for Excel, async for PDF via MinerU)
    → generate summary → compute diff → update project.json

    Args:
        project_id: UUID of the project
        file: The document file
        force_type: Optional override for doc_type (e.g. "tz_beton")
    """
    filename = file.filename or "unknown"
    content = await file.read()
    content_hash = _compute_sha256(content)
    ext = Path(filename).suffix.lower()

    logger.info(
        "Project %s: add-document '%s' (%d bytes, ext=%s)",
        project_id, filename, len(content), ext,
    )

    # -- 1. Save temp file --
    tmp_path = None
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # -- 2. Detect document type --
        if force_type:
            try:
                doc_type = DocType(force_type)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unknown doc_type: {force_type}. Valid: {[t.value for t in DocType]}",
                )
        else:
            content_head = _read_content_head(tmp_path)
            doc_type = detect_document_type(filename, content_head)

        identity = DocumentIdentity(
            filename=filename,
            doc_type=doc_type,
            content_hash=content_hash,
            file_size=len(content),
        )

        # -- 3. Check if this is an update (same filename::doc_type with different hash) --
        proj = load_project_json(project_id)
        old_identity_data = proj["identities"].get(identity.key)
        old_summary_data = proj["documents"].get(identity.key)
        is_update = old_identity_data is not None

        if is_update and old_identity_data.get("content_hash") == content_hash:
            return AddDocumentResponse(
                project_id=project_id,
                status=ProcessingStatus.COMPLETE,
                identity=identity,
                summary=DocumentSummary(**old_summary_data) if old_summary_data else None,
                diff=DocumentDiff(
                    document_key=identity.key,
                    is_update=True,
                    content_changed=False,
                ),
                message="Dokument se nezměnil (stejný hash).",
                version=proj.get("version", 0),
            )

        # -- 4. Route to parser --
        summary: Optional[DocumentSummary] = None

        if doc_type == DocType.SOUPIS_PRACI and ext in (".xlsx", ".xlsm", ".xls", ".xml"):
            # Sync: Excel/XML → universal_parser
            summary = _parse_soupis_sync(tmp_path, filename)

        elif ext == ".pdf":
            # Sync PDF parsing via pdfplumber text extraction
            summary = _parse_pdf_sync(tmp_path, filename, doc_type)

        else:
            # Generic: try universal_parser, fallback to basic summary
            summary = _parse_generic(tmp_path, filename, doc_type)

        if summary is None:
            summary = DocumentSummary(doc_type=doc_type, title=filename)

        # -- 5. Compute diff --
        old_summary = DocumentSummary(**old_summary_data) if old_summary_data else None
        old_hash = old_identity_data.get("content_hash", "") if old_identity_data else ""
        diff = compute_diff(old_summary, summary, old_hash, content_hash, identity.key)

        # -- 6. Update project.json --
        new_version = update_project_with_document(project_id, identity, summary)

        action = "aktualizován" if is_update else "přidán"
        return AddDocumentResponse(
            project_id=project_id,
            status=ProcessingStatus.COMPLETE,
            identity=identity,
            summary=summary,
            diff=diff,
            message=f"Dokument '{filename}' {action} ({doc_type.value}).",
            version=new_version,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("add-document error for %s/%s: %s", project_id, filename, e, exc_info=True)
        raise HTTPException(status_code=422, detail=f"Chyba zpracování: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


# ===========================================================================
# Parser wrappers
# ===========================================================================

def _parse_soupis_sync(file_path: str, filename: str) -> Optional[DocumentSummary]:
    """Parse Excel/XML soupis prací via universal_parser."""
    try:
        from app.parsers.universal_parser import parse_any
        doc = parse_any(file_path)
        doc.source_file = filename
        return generate_summary_from_soupis(doc)
    except Exception as e:
        logger.warning("Soupis parse failed for %s: %s", filename, e)
        return DocumentSummary(
            doc_type=DocType.SOUPIS_PRACI,
            title=filename,
            flags=[DocumentFlag(severity="error", message=f"Parse error: {str(e)}")],
        )


def _parse_pdf_sync(
    file_path: str, filename: str, doc_type: DocType
) -> Optional[DocumentSummary]:
    """Extract text from PDF and generate TZ summary."""
    text = ""
    try:
        import pdfplumber
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages[:30]:  # Max 30 pages
                page_text = page.extract_text() or ""
                text += page_text + "\n"
    except Exception as e:
        logger.warning("PDF text extraction failed for %s: %s", filename, e)
        return DocumentSummary(
            doc_type=doc_type,
            title=filename,
            flags=[DocumentFlag(severity="error", message=f"PDF extraction failed: {e}")],
        )

    if not text.strip():
        # Could queue MinerU here for OCR, but for now return empty summary with flag
        return DocumentSummary(
            doc_type=doc_type,
            title=filename,
            flags=[DocumentFlag(
                severity="warning",
                message="PDF neobsahuje extrahovatelný text. Vyžaduje OCR (MinerU).",
            )],
        )

    return generate_summary_from_tz(filename, doc_type, text)


def _parse_generic(
    file_path: str, filename: str, doc_type: DocType
) -> Optional[DocumentSummary]:
    """Try universal_parser, fallback to basic summary."""
    try:
        from app.parsers.universal_parser import parse_any
        doc = parse_any(file_path)
        doc.source_file = filename
        return generate_summary_from_soupis(doc)
    except (NotImplementedError, ValueError):
        # Format not supported by universal_parser (IFC, DXF stubs)
        return DocumentSummary(
            doc_type=doc_type,
            title=filename,
            flags=[DocumentFlag(
                severity="info",
                message=f"Formát zatím nepodporován plným parserem ({Path(filename).suffix})",
            )],
        )
    except Exception as e:
        logger.warning("Generic parse failed for %s: %s", filename, e)
        return DocumentSummary(
            doc_type=doc_type,
            title=filename,
            flags=[DocumentFlag(severity="error", message=str(e))],
        )


# ===========================================================================
# List & status endpoints
# ===========================================================================

@router.get("/{project_id}/documents")
async def list_documents(project_id: str):
    """List all documents in a project with summaries."""
    proj = load_project_json(project_id)
    docs = []
    for key, summary_data in proj.get("documents", {}).items():
        identity_data = proj.get("identities", {}).get(key, {})
        docs.append({
            "key": key,
            "identity": identity_data,
            "summary": summary_data,
        })
    return {
        "project_id": project_id,
        "version": proj.get("version", 0),
        "document_count": len(docs),
        "documents": docs,
        "project_summary": proj.get("project_summary", {}),
    }


@router.get("/{project_id}/status/{filename}")
async def document_status(project_id: str, filename: str):
    """Check processing status for a specific file."""
    proj = load_project_json(project_id)
    status = proj.get("processing", {}).get(filename)

    if status:
        return {"filename": filename, "status": status}

    # Check if already complete
    for key in proj.get("documents", {}):
        if key.startswith(f"{filename}::"):
            return {"filename": filename, "status": "complete"}

    return {"filename": filename, "status": "not_found"}
