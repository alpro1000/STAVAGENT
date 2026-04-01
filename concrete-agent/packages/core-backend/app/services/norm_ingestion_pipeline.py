"""
NormIngestionPipeline — Full 4-layer chunked extraction orchestrator.

PDF → Layer1 (pdfplumber/MinerU) → Chunk → per-chunk [Layer2 (Regex) + Layer3a (Gemini)]
    → Merge all chunks → Layer3b (Perplexity on merged) → Conflict detection
    → Domain implications → Compile rules → NKB

Principle: each layer ADDS to previous results,
never overwrites data with higher confidence.

Author: STAVAGENT Team
Version: 2.0.0
Date: 2026-04-01
"""

import hashlib
import json
import logging
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from app.core.config import settings
from app.models.extraction_schemas import (
    ChunkExtractionResult,
    ChunkInfo,
    DomainImplication,
    ExtractionResult,
    ExtractionSource,
    ExtractedValue,
    FactConflict,
)
from app.services.regex_norm_extractor import RegexNormExtractor
from app.services.document_chunker import chunk_pdf_text

logger = logging.getLogger(__name__)


# ===========================================================================
# Layer 1: PDF → Text
# ===========================================================================

async def extract_text_from_pdf(file_path: str) -> Tuple[str, str, int]:
    """
    Layer 1: Extract text from PDF.
    pdfplumber for text PDFs, MinerU for scans.

    Returns: (full_text, parser_used, page_count)
    """
    text = ""
    pages = 0

    # Try pdfplumber first (fast, free)
    try:
        import pdfplumber
        pages_text = []
        with pdfplumber.open(file_path) as pdf:
            pages = len(pdf.pages)
            for page in pdf.pages[:50]:
                page_text = page.extract_text() or ""
                # Also extract tables
                tables = page.extract_tables() or []
                for table in tables:
                    for row in table:
                        if row:
                            page_text += "\n" + " | ".join(str(c or "") for c in row)
                pages_text.append(page_text)
        text = "\n\n--- PAGE BREAK ---\n\n".join(pages_text)
    except Exception as e:
        logger.warning("[L1] pdfplumber failed: %s", e)

    # Check if text is sufficient
    if pages > 0:
        chars_per_page = len(text) / max(pages, 1)
        if chars_per_page > 500:
            return text, "pdfplumber", pages

    # Fallback: MinerU for scans
    try:
        from app.parsers.mineru_client import parse_pdf_with_mineru
        mineru_text = parse_pdf_with_mineru(file_path)
        if mineru_text and len(mineru_text) > len(text):
            logger.info("[L1] MinerU OCR: %d chars (pdfplumber had %d)", len(mineru_text), len(text))
            return mineru_text, "mineru", pages
    except Exception as e:
        logger.debug("[L1] MinerU unavailable: %s", e)

    return text, "pdfplumber", pages


# ===========================================================================
# Layer 3a: Gemini Flash enrichment (confidence=0.7)
# ===========================================================================

_GEMINI_EXTRACT_PROMPT = """Jsi expert na českou stavební dokumentaci.
Analyzuj text normativního dokumentu a extrahuj STRUKTUROVANÁ data.

PRAVIDLA:
1. Extrahuj POUZE to, co je explicitně uvedeno v textu
2. Pokud hodnota není v dokumentu → null (NE vymýšlej)
3. Čísla jako float/int, ne string
4. Pro každý fakt uveď číslo strany nebo kapitoly

IGNORUJ tyto položky (již extrahované regex):
{already_extracted}

EXTRAHUJ v JSON:
{{
  "summary": "2-3 věty shrnující účel dokumentu",
  "key_requirements": [
    {{
      "id": "REQ_001",
      "section": "čl. X.X",
      "requirement": "popis požadavku",
      "type": "mandatory|recommended|informative",
      "applies_to": ["kolej", "most", "beton"],
      "parameters": {{}},
      "page": 0
    }}
  ],
  "risks_warnings": [
    {{
      "id": "RISK_001",
      "description": "popis rizika",
      "severity": "high|medium|low",
      "mitigation": "doporučené opatření",
      "page": 0
    }}
  ],
  "volumes_quantities": [
    {{
      "item": "popis",
      "value": 0,
      "unit": "m³|ks|bm",
      "page": 0
    }}
  ],
  "cross_references": [
    {{
      "from_section": "čl. X.X",
      "to_norm": "ČSN ...",
      "relationship": "requires|supplements|replaces"
    }}
  ]
}}

OUTPUT: pouze JSON, bez markdown bloků."""


async def call_gemini_enrichment(
    text: str,
    regex_result: ExtractionResult,
    max_input_chars: int = 30000,
) -> Dict[str, Any]:
    """
    Layer 3a: Gemini Flash enrichment.
    Passes already-extracted data to avoid duplication.
    """
    # Build list of already extracted items for dedup prompt
    already_found = {
        "norms": [v.value for v in regex_result.norm_references[:30]],
        "tolerances": [f"{v.value} {v.unit or ''}" for v in regex_result.tolerances[:20]],
        "deadlines": [f"{v.value} {v.unit or ''}" for v in regex_result.deadlines[:10]],
        "materials": [v.value for v in regex_result.materials[:20]],
    }

    truncated_text = text[:max_input_chars]
    if len(text) > max_input_chars:
        truncated_text += f"\n\n[...zkráceno, celkem {len(text)} znaků]"

    prompt = _GEMINI_EXTRACT_PROMPT.format(
        already_extracted=json.dumps(already_found, ensure_ascii=False, indent=2)
    )
    full_prompt = f"{prompt}\n\n---\n\nDOKUMENT:\n{truncated_text}"

    try:
        # Try Vertex AI first (free on Cloud Run)
        try:
            from app.core.gemini_client import VertexGeminiClient
            client = VertexGeminiClient()
            response = client.call(full_prompt, temperature=0.1)
            if response:
                return _parse_json_response(response) or {}
        except Exception as e:
            logger.debug("[L3a] Vertex AI failed: %s", e)

        # Fallback to API key
        if settings.GOOGLE_API_KEY:
            from app.core.gemini_client import GeminiClient
            client = GeminiClient()
            response = client.call(full_prompt, temperature=0.1)
            if response:
                return _parse_json_response(response) or {}

    except Exception as e:
        logger.warning("[L3a] Gemini enrichment failed: %s", e)

    return {}


def _parse_json_response(text: str) -> Optional[Dict]:
    """Extract JSON from LLM response text."""
    if not text:
        return None
    if isinstance(text, dict):
        return text
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        pass
    match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', str(text), re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    # Try finding first { ... }
    match = re.search(r'\{[\s\S]*\}', str(text))
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return None


# ===========================================================================
# Layer 3b: Perplexity verification + supplement (confidence=0.85)
# ===========================================================================

_VERIFY_PROMPT = """Ověř aktuálnost těchto českých stavebních norem a předpisů.
Pro každou normu zjisti:
1. Je stále platná? (ano/ne/zrušena/nahrazena)
2. Jaká je aktuální verze/změna?
3. Existuje novější verze?
4. Pokud nahrazena — čím?

Normy k ověření:
{norms_to_verify}

Odpověz v JSON:
{{
  "verifications": [
    {{
      "norm": "ČSN ...",
      "is_current": true,
      "current_version": "...",
      "replaced_by": null,
      "last_update": "YYYY-MM",
      "notes": "..."
    }}
  ]
}}"""

_SUPPLEMENT_PROMPT = """Najdi aktuální informace k těmto stavebním tématům
v kontextu české infrastruktury:

{questions}

Pro každou odpověď uveď zdroj (URL nebo název dokumentu).
Odpověz v JSON:
{{
  "answers": [
    {{
      "question": "...",
      "answer": "...",
      "source": "...",
      "confidence": 0.0
    }}
  ]
}}"""


async def perplexity_verify_norms(norms: List[str]) -> List[Dict[str, Any]]:
    """Call 1: Verify norm currency via Perplexity."""
    if not settings.has_perplexity or not norms:
        return []

    try:
        import httpx
        prompt = _VERIFY_PROMPT.format(
            norms_to_verify="\n".join(f"- {n}" for n in norms[:10])
        )
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.PERPLEXITY_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "sonar-pro",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1,
                    "max_tokens": 2048,
                },
            )

        if resp.status_code == 200:
            data = resp.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            parsed = _parse_json_response(content)
            if parsed:
                return parsed.get("verifications", [])
        else:
            logger.warning("[L3b] Perplexity verify HTTP %d", resp.status_code)

    except Exception as e:
        logger.warning("[L3b] Perplexity verify failed: %s", e)
    return []


async def perplexity_supplement(questions: List[str]) -> List[Dict[str, Any]]:
    """Call 2: Supplement missing data via Perplexity."""
    if not settings.has_perplexity or not questions:
        return []

    try:
        import httpx
        prompt = _SUPPLEMENT_PROMPT.format(
            questions="\n".join(f"{i+1}. {q}" for i, q in enumerate(questions[:5]))
        )
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.PERPLEXITY_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "sonar-pro",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1,
                    "max_tokens": 2048,
                },
            )

        if resp.status_code == 200:
            data = resp.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            parsed = _parse_json_response(content)
            if parsed:
                return parsed.get("answers", [])
        else:
            logger.warning("[L3b] Perplexity supplement HTTP %d", resp.status_code)

    except Exception as e:
        logger.warning("[L3b] Perplexity supplement failed: %s", e)
    return []


def _build_verification_tasks(
    regex_result: ExtractionResult,
    gemini_result: Dict[str, Any],
) -> Dict[str, Any]:
    """Determine what needs verification and supplementation."""
    norms_to_verify: List[str] = []
    questions: List[str] = []
    seen_norms: set = set()

    # Verify ČSN, zákony, vyhlášky (not internal SŽ docs)
    for ref in regex_result.norm_references:
        norm_str = str(ref.value)
        if any(prefix in norm_str for prefix in ["ČSN", "zákon", "vyhlášk", "nařízení"]):
            if norm_str not in seen_norms:
                seen_norms.add(norm_str)
                norms_to_verify.append(norm_str)

    # AI cross-references not confirmed by regex → questions for Perplexity
    for ref in gemini_result.get("cross_references", [])[:5]:
        to_norm = ref.get("to_norm", "")
        if to_norm and to_norm not in seen_norms:
            questions.append(
                f"Jaká je aktuální verze normy {to_norm} "
                f"a její hlavní požadavky pro stavební praxi?"
            )

    return {
        "norms_to_verify": norms_to_verify[:10],
        "questions": questions[:5],
    }


# ===========================================================================
# Rule compilation
# ===========================================================================

def compile_rules(
    result: ExtractionResult,
    gemini_result: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Compile final rules for NKB from all layers.
    Merges regex (1.0) + Gemini (0.7) + Perplexity (0.85).
    """
    rules: List[Dict[str, Any]] = []

    # From regex: tolerances → rules
    for i, tol in enumerate(result.tolerances):
        rules.append({
            "rule_id": f"auto_tolerance_{i}",
            "rule_type": "tolerance",
            "value": tol.value,
            "unit": tol.unit,
            "confidence": tol.confidence,
            "source": tol.source.value,
            "context": tol.context,
            "page": tol.page,
            "is_verified": False,
            "needs_human_review": True,
        })

    # From regex: deadlines → rules
    for i, dl in enumerate(result.deadlines):
        rules.append({
            "rule_id": f"auto_deadline_{i}",
            "rule_type": "deadline",
            "value": dl.value,
            "unit": dl.unit,
            "confidence": dl.confidence,
            "source": dl.source.value,
            "context": dl.context,
            "page": dl.page,
            "is_verified": False,
            "needs_human_review": True,
        })

    # From Gemini: key_requirements → rules
    for req in gemini_result.get("key_requirements", []):
        rules.append({
            "rule_id": req.get("id", f"auto_req_{len(rules)}"),
            "rule_type": req.get("type", "requirement"),
            "value": req.get("requirement"),
            "section": req.get("section"),
            "applies_to": req.get("applies_to", []),
            "parameters": req.get("parameters", {}),
            "confidence": 0.7,
            "source": "gemini_flash",
            "page": req.get("page"),
            "is_verified": False,
            "needs_human_review": True,
        })

    # Boost confidence for Perplexity-verified norms
    verified_norms = {v.get("norm"): v for v in result.verified_norms}
    for rule in rules:
        context = rule.get("context", "") or ""
        for norm_str, verification in verified_norms.items():
            if norm_str and norm_str in context:
                if verification.get("is_current"):
                    rule["confidence"] = min(rule["confidence"] + 0.15, 0.95)
                    rule["verified_by_perplexity"] = True
                else:
                    rule["norm_outdated"] = True
                    rule["replaced_by"] = verification.get("replaced_by")

    return rules


# ===========================================================================
# Chunk merge + conflict detection + domain implications
# ===========================================================================


def _merge_chunk_results(
    chunk_results: List[ChunkExtractionResult],
) -> Tuple[ExtractionResult, Dict[str, Any]]:
    """
    Merge per-chunk extractions into a single ExtractionResult.
    Detects conflicts and deduplicates facts.
    Returns (merged_result, merged_gemini_dict).
    """
    merged = ExtractionResult()
    merged_gemini: Dict[str, Any] = {
        "key_requirements": [],
        "risks_warnings": [],
        "volumes_quantities": [],
        "cross_references": [],
    }
    summaries: List[str] = []

    for cr in chunk_results:
        # Tag each fact with chunk_id
        for field in ("norm_references", "tolerances", "deadlines",
                      "formulas", "materials", "dimensions"):
            src_list: List[ExtractedValue] = getattr(cr, field)
            dst_list: List[ExtractedValue] = getattr(merged, field)
            for v in src_list:
                v.chunk_id = cr.chunk.chunk_id
                dst_list.append(v)

        # Merge document_meta (first wins for same key)
        for k, v in cr.document_meta.items():
            if k not in merged.document_meta:
                v.chunk_id = cr.chunk.chunk_id
                merged.document_meta[k] = v

        # Merge AI results
        merged_gemini["key_requirements"].extend(cr.ai_key_requirements)
        merged_gemini["risks_warnings"].extend(cr.ai_risks)
        merged_gemini["volumes_quantities"].extend(cr.ai_volumes)
        merged_gemini["cross_references"].extend(cr.ai_cross_references)
        if cr.ai_summary:
            summaries.append(cr.ai_summary)

        merged.chunk_details.append(cr.chunk)

    # Deduplicate facts (same value → keep highest confidence)
    merged.norm_references = _deduplicate_facts(merged.norm_references)
    merged.tolerances = _deduplicate_facts(merged.tolerances)
    merged.materials = _deduplicate_facts(merged.materials)
    merged.deadlines = _deduplicate_facts(merged.deadlines)
    merged.formulas = _deduplicate_facts(merged.formulas)

    # Merge AI into result
    merged.ai_key_requirements = merged_gemini["key_requirements"]
    merged.ai_risks = merged_gemini["risks_warnings"]
    merged.ai_volumes = merged_gemini["volumes_quantities"]
    merged.ai_cross_references = merged_gemini["cross_references"]
    merged.ai_summary = " | ".join(summaries) if summaries else None

    merged.chunks_processed = len(chunk_results)

    return merged, merged_gemini


def _deduplicate_facts(facts: List[ExtractedValue]) -> List[ExtractedValue]:
    """Deduplicate by value string. Keep highest confidence per unique value."""
    best: Dict[str, ExtractedValue] = {}
    for f in facts:
        key = str(f.value).strip().lower()
        if key not in best or f.confidence > best[key].confidence:
            best[key] = f
    return list(best.values())


def _detect_conflicts(result: ExtractionResult) -> List[FactConflict]:
    """
    Find facts where different chunks report different values for the same parameter.
    E.g., chunk A says C30/37, chunk B says C40/50 for concrete.
    """
    conflicts: List[FactConflict] = []

    # Check concrete grades: multiple different C-grades = potential conflict
    concrete_facts = [
        f for f in result.materials
        if re.match(r"C\s*\d{2,3}\s*/\s*\d{2,3}", str(f.value))
    ]
    if len(concrete_facts) >= 2:
        grades = set()
        for f in concrete_facts:
            normalized = re.sub(r"\s", "", str(f.value))
            grades.add(normalized)
        if len(grades) > 1:
            # Multiple different concrete grades — may be intentional (different elements)
            # but flag if from different chunks
            chunk_grade: Dict[str, ExtractedValue] = {}
            for f in concrete_facts:
                cid = f.chunk_id or "unknown"
                normalized = re.sub(r"\s", "", str(f.value))
                if cid not in chunk_grade:
                    chunk_grade[cid] = f
                elif re.sub(r"\s", "", str(chunk_grade[cid].value)) != normalized:
                    conflicts.append(FactConflict(
                        parameter="concrete_grade",
                        fact_a=chunk_grade[cid],
                        fact_b=f,
                        resolution="both_kept",
                    ))

    # Check exposure classes — multiple sources is normal, but contradictory is not
    exposure_facts = [
        f for f in result.materials
        if re.match(r"X[CDFSAM]\d", str(f.value))
    ]
    # Exposure classes are additive, not conflicting — skip conflict detection

    return conflicts


# ── Domain implications (ČSN EN 206, etc.) ───────────────────

_EXPOSURE_MIN_CONCRETE = {
    "XC1": "C20/25", "XC2": "C25/30", "XC3": "C30/37", "XC4": "C30/37",
    "XD1": "C30/37", "XD2": "C30/37", "XD3": "C35/45",
    "XS1": "C30/37", "XS2": "C35/45", "XS3": "C35/45",
    "XF1": "C30/37", "XF2": "C25/30", "XF3": "C30/37", "XF4": "C30/37",
    "XA1": "C30/37", "XA2": "C35/45", "XA3": "C35/45",
}

_EXPOSURE_IMPLICATIONS = {
    "XF4": "Požadavek na provzdušnění betonu (air-entraining admixture)",
    "XA2": "Použít síranuvzdorný cement (CEM III nebo CEM I + SR)",
    "XA3": "Použít síranuvzdorný cement, ochranná opatření",
    "XD3": "Chlorid-resistant, max w/c=0.45",
    "XS3": "Chlorid-resistant, max w/c=0.45, zvýšené krytí výztuže",
}


def _derive_domain_implications(result: ExtractionResult) -> List[DomainImplication]:
    """Derive logical consequences from extracted facts."""
    implications: List[DomainImplication] = []

    exposure_classes: Set[str] = set()
    for f in result.materials:
        val = str(f.value).strip()
        if re.match(r"^X[CDFSAM]\d$", val):
            exposure_classes.add(val)

    for xc in exposure_classes:
        min_concrete = _EXPOSURE_MIN_CONCRETE.get(xc)
        if min_concrete:
            implications.append(DomainImplication(
                trigger_fact=xc,
                implication=f"Minimální třída betonu {min_concrete} dle ČSN EN 206",
                rule_source="ČSN EN 206",
            ))
        extra = _EXPOSURE_IMPLICATIONS.get(xc)
        if extra:
            implications.append(DomainImplication(
                trigger_fact=xc,
                implication=extra,
                rule_source="ČSN EN 206",
                confidence=0.9,
            ))

    # SCC detection
    for f in result.materials:
        val = str(f.value).lower()
        if "scc" in val or "samozhutnitelný" in val or "samoupl" in val:
            implications.append(DomainImplication(
                trigger_fact=str(f.value),
                implication="SCC beton — nevyžaduje vibrování, jiný způsob podání",
                rule_source="ČSN EN 206 + TKP",
            ))

    # Prestressed concrete
    for f in result.materials:
        val = str(f.value).lower()
        if "předpjat" in val or "předpín" in val:
            implications.append(DomainImplication(
                trigger_fact=str(f.value),
                implication="Předpjatý beton — nepřerušovaná betonáž, bez pracovních spár",
                rule_source="ČSN EN 13670",
            ))

    return implications


# ===========================================================================
# Main Pipeline Orchestrator
# ===========================================================================

class NormIngestionPipeline:
    """
    Orchestrator: PDF → L1 → Chunk → per-chunk [L2+L3a] → Merge → L3b → NKB

    Each layer ADDS data, never overwrites.
    Confidence decreases with each layer.
    """

    @classmethod
    async def ingest(
        cls,
        file_path: str,
        file_bytes: bytes,
        filename: str,
        skip_perplexity: bool = False,
        doc_type: str = "tz",
    ) -> ExtractionResult:
        """
        Full chunked pipeline for extracting rules from a construction document.

        Pipeline:
        ┌──────────┐   ┌─────────┐   ┌─────────────────────────────┐   ┌──────────┐
        │ Layer 1  │──▶│ Chunker │──▶│ per-chunk: L2 + L3a         │──▶│  Merge   │
        │ PDF→Text │   │         │   │ (regex 1.0 + Gemini 0.7)    │   │          │
        └──────────┘   └─────────┘   └─────────────────────────────┘   └────┬─────┘
                                                                             │
                         ┌──────────────┐   ┌──────────────┐   ┌────────────┘
                         │  Layer 3b    │◀──│  Conflicts   │◀──│
                         │ Pplx (0.85)  │   │  + Implics   │
                         └──────────────┘   └──────────────┘
        """
        result = ExtractionResult(
            document_hash=hashlib.sha256(file_bytes).hexdigest(),
            filename=filename,
        )

        # ── LAYER 1: PDF → Text ──
        logger.info("[L1] Extracting text from %s...", filename)
        text, parser_used, page_count = await extract_text_from_pdf(file_path)
        result.parser_used = parser_used
        result.total_pages = page_count
        result.raw_text_length = len(text)

        if not text.strip():
            logger.warning("[L1] No text extracted from %s", filename)
            return result

        logger.info("[L1] Done: %d pages, %d chars via %s", page_count, len(text), parser_used)

        # ── CHUNK ──
        chunks = chunk_pdf_text(text, page_count, doc_type=doc_type)
        logger.info("[CHUNK] Split into %d chunks (strategy: %s)",
                     len(chunks),
                     chunks[0][0].strategy if chunks else "none")

        if not chunks:
            logger.warning("[CHUNK] No chunks produced, returning empty result")
            return result

        # ── PER-CHUNK: L2 (Regex) + L3a (Gemini) ──
        chunk_results: List[ChunkExtractionResult] = []

        for chunk_info, chunk_text in chunks:
            logger.info("[L2+L3a] Processing chunk %s (%d chars, pages %d-%d)...",
                         chunk_info.chunk_id, chunk_info.char_count,
                         chunk_info.page_start, chunk_info.page_end)

            cr = ChunkExtractionResult(chunk=chunk_info)

            # L2: Regex on this chunk
            regex_chunk = RegexNormExtractor.extract_all(chunk_text)
            # Adjust page numbers relative to chunk
            _adjust_pages(regex_chunk.norm_references, chunk_info.page_start)
            _adjust_pages(regex_chunk.tolerances, chunk_info.page_start)
            _adjust_pages(regex_chunk.deadlines, chunk_info.page_start)
            _adjust_pages(regex_chunk.materials, chunk_info.page_start)
            _adjust_pages(regex_chunk.dimensions, chunk_info.page_start)
            _adjust_pages(regex_chunk.formulas, chunk_info.page_start)

            cr.norm_references = regex_chunk.norm_references
            cr.tolerances = regex_chunk.tolerances
            cr.deadlines = regex_chunk.deadlines
            cr.formulas = regex_chunk.formulas
            cr.materials = regex_chunk.materials
            cr.dimensions = regex_chunk.dimensions
            cr.document_meta = regex_chunk.document_meta

            # L3a: Gemini enrichment on this chunk (no truncation needed — chunks are sized)
            try:
                # Build a temporary ExtractionResult for the dedup prompt
                temp_result = ExtractionResult(
                    norm_references=cr.norm_references,
                    tolerances=cr.tolerances,
                    deadlines=cr.deadlines,
                    materials=cr.materials,
                )
                gemini_chunk = await call_gemini_enrichment(
                    chunk_text, temp_result, max_input_chars=len(chunk_text)
                )
                cr.ai_summary = gemini_chunk.get("summary")
                cr.ai_key_requirements = gemini_chunk.get("key_requirements", [])
                cr.ai_risks = gemini_chunk.get("risks_warnings", [])
                cr.ai_volumes = gemini_chunk.get("volumes_quantities", [])
                cr.ai_cross_references = gemini_chunk.get("cross_references", [])
            except Exception as e:
                logger.warning("[L3a] Gemini failed for chunk %s: %s",
                               chunk_info.chunk_id, e)

            chunk_results.append(cr)

        # ── MERGE all chunk results ──
        logger.info("[MERGE] Merging %d chunk results...", len(chunk_results))
        merged, merged_gemini = _merge_chunk_results(chunk_results)

        # Copy metadata from merged into result
        result.norm_references = merged.norm_references
        result.tolerances = merged.tolerances
        result.deadlines = merged.deadlines
        result.materials = merged.materials
        result.dimensions = merged.dimensions
        result.formulas = merged.formulas
        result.document_meta = merged.document_meta
        result.ai_summary = merged.ai_summary
        result.ai_key_requirements = merged.ai_key_requirements
        result.ai_risks = merged.ai_risks
        result.ai_volumes = merged.ai_volumes
        result.ai_cross_references = merged.ai_cross_references
        result.chunk_details = merged.chunk_details
        result.chunks_processed = merged.chunks_processed

        logger.info(
            "[MERGE] Done: %d norms, %d materials, %d tolerances, %d AI reqs from %d chunks",
            len(result.norm_references), len(result.materials),
            len(result.tolerances), len(result.ai_key_requirements),
            result.chunks_processed,
        )

        # ── CONFLICTS ──
        result.conflicts = _detect_conflicts(result)
        if result.conflicts:
            logger.info("[CONFLICT] Detected %d conflicts", len(result.conflicts))

        # ── DOMAIN IMPLICATIONS ──
        result.domain_implications = _derive_domain_implications(result)
        if result.domain_implications:
            logger.info("[IMPLICATIONS] Derived %d domain implications",
                         len(result.domain_implications))

        # ── LAYER 3b: Perplexity on MERGED results (single call) ──
        if not skip_perplexity and result.norm_references:
            logger.info("[L3b] Calling Perplexity for verification (merged)...")
            try:
                tasks = _build_verification_tasks(result, merged_gemini)

                if tasks["norms_to_verify"]:
                    result.verified_norms = await perplexity_verify_norms(
                        tasks["norms_to_verify"]
                    )
                    logger.info("[L3b] Verified %d norms", len(result.verified_norms))

                if tasks["questions"]:
                    result.supplemented_data = await perplexity_supplement(
                        tasks["questions"]
                    )
                    logger.info("[L3b] Supplemented %d items", len(result.supplemented_data))

            except Exception as e:
                logger.warning("[L3b] Perplexity failed: %s", e)
        else:
            logger.info("[L3b] Skipped (no norms or skip_perplexity=True)")

        # ── COMPILE: assemble extracted_rules for NKB ──
        result.extracted_rules = compile_rules(result, merged_gemini)
        logger.info("[DONE] %s: %d rules from %d chunks, %d conflicts, %d implications",
                     filename, len(result.extracted_rules), result.chunks_processed,
                     len(result.conflicts), len(result.domain_implications))

        return result


def _adjust_pages(facts: List[ExtractedValue], page_offset: int) -> None:
    """Adjust page numbers when regex extracted from a chunk starting at page_offset.

    RegexNormExtractor numbers pages starting from 1 within the chunk text.
    We remap: if chunk starts at page 5, regex page 1 → actual page 5.
    """
    if page_offset <= 1:
        return
    for f in facts:
        if f.page is not None:
            f.page = f.page + page_offset - 1
