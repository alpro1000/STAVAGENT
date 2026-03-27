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
    CrossValidationIssue,
    CrossValidationResult,
    DiffEntry,
    DocType,
    DocumentDiff,
    DocumentFlag,
    DocumentIdentity,
    DocumentSummary,
    MaterialEntry,
    NormComplianceSummary,
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
# Gemini AI enrichment for TZ documents
# ===========================================================================

_TZ_AI_PROMPT = """Analyzuj následující technickou zprávu (TZ) ze stavebního projektu.
Vrať JSON s těmito poli:

{{
  "summary": "Stručný popis dokumentu (2-3 věty česky)",
  "materials": [
    {{"name": "Beton", "spec": "C30/37 XC4 XD1", "quantity": 150.0, "unit": "m³"}},
    ...
  ],
  "volumes": [
    {{"description": "Celkový objem betonu", "value": 150.0, "unit": "m³"}},
    ...
  ],
  "risks": [
    "Riziko: ...",
    ...
  ],
  "standards": ["ČSN EN 206", "ČSN 73 6214", ...],
  "key_requirements": ["Minimální teplota betonáže +5°C", ...]
}}

Pokud informace v textu není, nevymýšlej ji. Vrať prázdný seznam.
Text dokumentu (první 4000 znaků):

{text}
"""


async def enrich_summary_with_ai(
    summary: DocumentSummary,
    text_content: str,
) -> DocumentSummary:
    """Enrich DocumentSummary with Gemini AI analysis."""
    try:
        from app.core.gemini_client import GeminiClient, VertexGeminiClient

        # Try Vertex AI first (free on Cloud Run), fallback to API key
        client = None
        model_name = "unknown"
        try:
            client = VertexGeminiClient()
            model_name = getattr(client, 'model_name', 'vertex-gemini')
        except Exception:
            try:
                client = GeminiClient()
                model_name = getattr(client, 'model_name', 'gemini')
            except Exception as e:
                logger.debug("No Gemini client available: %s", e)
                summary.flags.append(DocumentFlag(
                    severity="info",
                    message="AI enrichment nedostupný (chybí Gemini API)",
                ))
                return summary

        prompt = _TZ_AI_PROMPT.format(text=text_content[:4000])
        result = client.call(prompt, temperature=0.2)

        if not isinstance(result, dict) or "raw_text" in result:
            logger.warning("AI enrichment returned non-JSON: %s", str(result)[:200])
            summary.flags.append(DocumentFlag(
                severity="info",
                message="AI vrátil nestrukturovanou odpověď",
            ))
            return summary

        # Merge AI results into summary
        summary.ai_summary = result.get("summary", "")
        summary.ai_model_used = model_name
        summary.ai_confidence = 0.7

        # AI materials (supplement regex-extracted ones)
        for mat_data in result.get("materials", [])[:20]:
            if isinstance(mat_data, dict):
                summary.ai_materials.append(MaterialEntry(
                    name=mat_data.get("name", ""),
                    spec=mat_data.get("spec"),
                    quantity=mat_data.get("quantity"),
                    unit=mat_data.get("unit"),
                ))

        # AI volumes
        for vol_data in result.get("volumes", [])[:10]:
            if isinstance(vol_data, dict):
                summary.ai_volumes.append(VolumeEntry(
                    description=vol_data.get("description", ""),
                    value=float(vol_data.get("value", 0)),
                    unit=vol_data.get("unit", ""),
                ))

        # AI risks
        for risk in result.get("risks", [])[:10]:
            if isinstance(risk, str) and risk.strip():
                summary.ai_risks.append(risk.strip())

        # Supplement regex results with AI results
        ai_standards = result.get("standards", [])
        existing = set(summary.standards)
        for std in ai_standards:
            if isinstance(std, str) and std not in existing:
                summary.standards.append(std)

        ai_reqs = result.get("key_requirements", [])
        existing_reqs = set(summary.key_requirements)
        for req in ai_reqs:
            if isinstance(req, str) and req not in existing_reqs:
                summary.key_requirements.append(req)

        if summary.ai_summary:
            summary.description = summary.ai_summary

        logger.info("AI enrichment OK: model=%s, materials=%d, volumes=%d, risks=%d",
                     model_name, len(summary.ai_materials), len(summary.ai_volumes), len(summary.ai_risks))

    except Exception as e:
        logger.warning("AI enrichment failed: %s", e)
        summary.flags.append(DocumentFlag(
            severity="info",
            message=f"AI enrichment selhal: {str(e)[:100]}",
        ))

    return summary


# ===========================================================================
# TZ ↔ Soupis cross-validation
# ===========================================================================

def cross_validate_project(proj: Dict[str, Any]) -> Optional[CrossValidationResult]:
    """
    Cross-validate TZ documents against soupis prací.

    Checks:
    - Materials in TZ are covered by soupis positions
    - Standards referenced in TZ have corresponding positions
    - Key requirements have matching work items
    """
    tz_docs = []
    soupis_docs = []

    for key, doc_data in proj.get("documents", {}).items():
        dt = doc_data.get("doc_type", "")
        if dt.startswith("tz_"):
            tz_docs.append(doc_data)
        elif dt == "soupis_praci":
            soupis_docs.append(doc_data)

    if not tz_docs or not soupis_docs:
        return None  # Need both TZ and soupis for validation

    issues: List[CrossValidationIssue] = []

    # Collect all materials from TZ (regex + AI)
    tz_materials: List[Dict[str, str]] = []
    for tz in tz_docs:
        for mat in tz.get("materials", []):
            tz_materials.append(mat)
        for mat in tz.get("ai_materials", []):
            tz_materials.append(mat)

    # Collect searchable text from soupis
    soupis_text = ""
    soupis_positions = 0
    for sp in soupis_docs:
        soupis_text += (sp.get("searchable_text", "") + " ").lower()
        soupis_positions += sp.get("positions_count", 0)

    # Check each TZ material against soupis
    matched = 0
    for mat in tz_materials:
        mat_name = (mat.get("name", "") or "").lower()
        mat_spec = (mat.get("spec", "") or "").lower()

        # Search in soupis text
        found = False
        if mat_spec and len(mat_spec) > 2:
            if mat_spec in soupis_text:
                found = True
        if not found and mat_name and len(mat_name) > 3:
            if mat_name in soupis_text:
                found = True

        if found:
            matched += 1
        else:
            display = f"{mat.get('name', '')} {mat.get('spec', '')}".strip()
            if display:
                issues.append(CrossValidationIssue(
                    severity="warning",
                    category="material_mismatch",
                    tz_reference=display,
                    soupis_reference="chybí v soupisu prací",
                    message=f"Materiál '{display}' z TZ nenalezen v soupisu prací",
                ))

    # Check TZ standards
    tz_standards = set()
    for tz in tz_docs:
        for std in tz.get("standards", []):
            tz_standards.add(std)

    # Coverage score
    total_tz = len(tz_materials)
    coverage = matched / total_tz if total_tz > 0 else 1.0

    if coverage < 0.5 and total_tz > 2:
        issues.append(CrossValidationIssue(
            severity="error",
            category="low_coverage",
            message=f"Pouze {matched}/{total_tz} materiálů z TZ nalezeno v soupisu ({coverage:.0%})",
        ))

    return CrossValidationResult(
        validated=True,
        issues=issues[:30],
        tz_materials_count=total_tz,
        soupis_materials_count=soupis_positions,
        coverage_score=round(coverage, 2),
    )


# ===========================================================================
# Perplexity standards verification (supplement AI enrichment)
# ===========================================================================

async def verify_standards_with_perplexity(summary: DocumentSummary) -> DocumentSummary:
    """Use Perplexity to verify extracted standards are current and correct."""
    if not settings.has_perplexity:
        return summary
    if not summary.standards:
        return summary

    try:
        import httpx
        standards_list = ", ".join(summary.standards[:10])
        prompt = (
            f"Ověř platnost těchto českých stavebních norem: {standards_list}. "
            f"Pro každou normu: je stále platná? Byla nahrazena? "
            f"Odpověz stručně česky, max 3 věty na normu."
        )

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.PERPLEXITY_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "sonar-pro",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "max_tokens": 1024,
                },
            )

        if response.status_code == 200:
            data = response.json()
            text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            if text:
                summary.flags.append(DocumentFlag(
                    severity="info",
                    message=f"Perplexity ověření norem: {text[:500]}",
                    source="perplexity",
                ))
                logger.info("[Perplexity] Standards verification: %d chars", len(text))
        else:
            logger.warning("[Perplexity] HTTP %d for standards verification", response.status_code)

    except Exception as e:
        logger.debug("[Perplexity] Standards verification failed: %s", e)

    return summary


# ===========================================================================
# NKB Compliance check
# ===========================================================================

def run_norm_compliance(
    project_id: str,
    summary: DocumentSummary,
    construction_type: Optional[str] = None,
) -> Optional[NormComplianceSummary]:
    """Run NKB compliance check on a document summary."""
    try:
        from app.services.norm_matcher import check_compliance

        # Build document_data from summary
        doc_data = {
            "materials": [m.model_dump() for m in summary.materials + summary.ai_materials],
            "standards": summary.standards,
            "objects": [],
            "searchable_text": summary.searchable_text or "",
        }

        # Auto-detect construction type from doc_type
        if not construction_type:
            dt = summary.doc_type.value
            if "most" in dt:
                construction_type = "mostní"
            elif dt in ("tz_komunikace", "tz_zemni_prace"):
                construction_type = "dopravní"
            elif dt in ("tz_zti", "tz_vzt", "tz_ut", "tz_elektro"):
                construction_type = "pozemní"

        report = check_compliance(
            project_id=project_id,
            document_data=doc_data,
            construction_type=construction_type,
        )

        if report.total_rules_checked == 0:
            return None

        # Convert to lightweight summary for response
        top_findings = []
        for f in report.findings[:5]:
            top_findings.append({
                "rule_id": f.rule_id,
                "norm": f.norm_designation,
                "title": f.rule_title,
                "status": f.status.value,
                "message": f.message,
                "severity": f.severity,
            })

        return NormComplianceSummary(
            score=report.score,
            total_checked=report.total_rules_checked,
            passed=report.passed,
            warnings=report.warnings,
            violations=report.violations,
            norms_referenced=report.norms_referenced,
            top_findings=top_findings,
        )

    except Exception as e:
        logger.warning("NKB compliance check failed: %s", e)
        return None


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
    enable_ai: Optional[str] = Form("true"),
):
    """
    Add a document to a project.

    Flow: upload → detect type → parse → AI enrich (Gemini) → diff → cross-validate → update project.json

    Args:
        project_id: UUID of the project
        file: The document file
        force_type: Optional override for doc_type (e.g. "tz_beton")
        enable_ai: "true"/"false" — enable Gemini AI enrichment for TZ documents
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
        ai_enabled = enable_ai != "false"
        summary: Optional[DocumentSummary] = None

        if doc_type == DocType.SOUPIS_PRACI and ext in (".xlsx", ".xlsm", ".xls", ".xml"):
            # Sync: Excel/XML → universal_parser
            summary = _parse_soupis_sync(tmp_path, filename)

        elif ext == ".pdf":
            # Async PDF: pdfplumber → MinerU fallback → Gemini AI enrichment
            summary = await _parse_pdf_async(tmp_path, filename, doc_type, enable_ai=ai_enabled)

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

        # -- 7. Cross-validate TZ ↔ Soupis if both present --
        updated_proj = load_project_json(project_id)
        xval = cross_validate_project(updated_proj)

        # -- 8. Perplexity standards verification (async, non-blocking) --
        if ai_enabled and summary.standards:
            try:
                summary = await verify_standards_with_perplexity(summary)
            except Exception as e:
                logger.debug("Perplexity verification skipped: %s", e)

        # -- 9. NKB norm compliance check --
        norm_compliance = run_norm_compliance(project_id, summary)

        action = "aktualizován" if is_update else "přidán"
        ai_note = f", AI: {summary.ai_model_used}" if summary.ai_model_used else ""
        nkb_note = f", NKB: {norm_compliance.score:.0%}" if norm_compliance else ""
        return AddDocumentResponse(
            project_id=project_id,
            status=ProcessingStatus.COMPLETE,
            identity=identity,
            summary=summary,
            diff=diff,
            cross_validation=xval,
            norm_compliance=norm_compliance,
            message=f"Dokument '{filename}' {action} ({doc_type.value}{ai_note}{nkb_note}).",
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


async def _parse_pdf_async(
    file_path: str, filename: str, doc_type: DocType, enable_ai: bool = True,
) -> Optional[DocumentSummary]:
    """
    Extract text from PDF, generate TZ summary, enrich with full pipeline.

    If enable_ai=True for TZ docs, uses NormIngestionPipeline:
      L1 (pdfplumber/MinerU) → L2 (50+ regex, conf=1.0)
      → L3a (Gemini with dedup, conf=0.7) → L3b (Perplexity verify+supplement)
    """
    # For TZ docs with AI, use the full ingestion pipeline
    if enable_ai and doc_type.value.startswith("tz_"):
        try:
            from app.services.norm_ingestion_pipeline import NormIngestionPipeline
            with open(file_path, "rb") as f:
                file_bytes = f.read()
            extraction = await NormIngestionPipeline.ingest(
                file_path=file_path,
                file_bytes=file_bytes,
                filename=filename,
                skip_perplexity=not settings.has_perplexity,
            )

            # Build DocumentSummary from ExtractionResult
            text = ""
            try:
                import pdfplumber
                with pdfplumber.open(file_path) as pdf:
                    for page in pdf.pages[:30]:
                        text += (page.extract_text() or "") + "\n"
            except Exception:
                pass

            summary = generate_summary_from_tz(filename, doc_type, text or "")

            # Enrich summary with pipeline results
            if extraction.ai_summary:
                summary.ai_summary = extraction.ai_summary
                summary.description = extraction.ai_summary
                summary.ai_model_used = "gemini-flash"
                summary.ai_confidence = 0.7

            # Add rich regex materials
            for mat in extraction.materials:
                if mat.value and str(mat.value) not in [m.spec for m in summary.materials]:
                    summary.materials.append(MaterialEntry(
                        name=str(mat.value), spec=str(mat.value),
                    ))

            # Add AI requirements
            for req in extraction.ai_key_requirements:
                req_text = req.get("requirement", "")
                if req_text and req_text not in summary.key_requirements:
                    summary.key_requirements.append(req_text)

            # Add AI risks
            for risk in extraction.ai_risks:
                desc = risk.get("description", "")
                if desc:
                    summary.ai_risks.append(desc)

            # Add AI volumes
            for vol in extraction.ai_volumes:
                summary.ai_volumes.append(VolumeEntry(
                    description=vol.get("item", ""),
                    value=float(vol.get("value", 0)),
                    unit=vol.get("unit", ""),
                ))

            # Add norm references from rich regex
            existing_stds = set(summary.standards)
            for ref in extraction.norm_references:
                ref_str = str(ref.value)
                if ref_str not in existing_stds:
                    summary.standards.append(ref_str)
                    existing_stds.add(ref_str)

            # Add Perplexity verification results as flags
            for v in extraction.verified_norms:
                norm = v.get("norm", "")
                is_current = v.get("is_current", True)
                if not is_current:
                    replaced_by = v.get("replaced_by", "neznámo")
                    summary.flags.append(DocumentFlag(
                        severity="warning",
                        message=f"Norma {norm} byla nahrazena: {replaced_by}",
                        source="perplexity",
                    ))

            # Store extraction stats in raw_extraction
            summary.raw_extraction["ingestion_stats"] = extraction.stats
            summary.raw_extraction["extracted_rules_count"] = len(extraction.extracted_rules)

            logger.info(
                "Full pipeline for %s: %d norms, %d tolerances, %d rules",
                filename, len(extraction.norm_references),
                len(extraction.tolerances), len(extraction.extracted_rules),
            )
            return summary

        except Exception as e:
            logger.warning("Full pipeline failed for %s, falling back: %s", filename, e)
            # Fall through to legacy path

    # Legacy path: simple extraction
    text = ""
    try:
        import pdfplumber
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages[:30]:
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
        try:
            from app.parsers.mineru_client import parse_pdf_with_mineru
            mineru_text = parse_pdf_with_mineru(file_path)
            if mineru_text:
                text = mineru_text
                logger.info("MinerU OCR succeeded for %s: %d chars", filename, len(text))
        except Exception as e:
            logger.debug("MinerU unavailable: %s", e)

    if not text.strip():
        return DocumentSummary(
            doc_type=doc_type,
            title=filename,
            flags=[DocumentFlag(
                severity="warning",
                message="PDF neobsahuje extrahovatelný text. Vyžaduje OCR (MinerU).",
            )],
        )

    summary = generate_summary_from_tz(filename, doc_type, text)

    if enable_ai and doc_type.value.startswith("tz_"):
        summary = await enrich_summary_with_ai(summary, text)

    return summary


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
