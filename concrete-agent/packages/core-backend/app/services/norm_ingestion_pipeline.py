"""
NormIngestionPipeline — Full 4-layer extraction orchestrator.

PDF → Layer1 (pdfplumber/MinerU) → Layer2 (Regex, conf=1.0)
    → Layer3a (Gemini Flash, conf=0.7) → Layer3b (Perplexity, conf=0.85)
    → Compile rules → NKB

Principle: each layer ADDS to previous results,
never overwrites data with higher confidence.

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-27
"""

import hashlib
import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings
from app.models.extraction_schemas import (
    ExtractionResult,
    ExtractionSource,
    ExtractedValue,
)
from app.services.regex_norm_extractor import RegexNormExtractor

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
# Main Pipeline Orchestrator
# ===========================================================================

class NormIngestionPipeline:
    """
    Orchestrator: PDF → L1 → L2 → L3a → L3b → NKB

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
    ) -> ExtractionResult:
        """
        Full pipeline for extracting rules from a normative document.

        Pipeline:
        ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
        │ Layer 1  │───▶│   Layer 2    │───▶│  Layer 3a    │───▶│  Layer 3b    │
        │ PDF→Text │    │ Regex (1.0)  │    │ Gemini (0.7) │    │ Pplx (0.85) │
        └──────────┘    └──────────────┘    └──────────────┘    └──────────────┘
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

        # ── LAYER 2: Regex (confidence=1.0) ──
        logger.info("[L2] Running regex extraction...")
        regex_result = RegexNormExtractor.extract_all(text)

        # Merge regex results
        result.norm_references = regex_result.norm_references
        result.tolerances = regex_result.tolerances
        result.deadlines = regex_result.deadlines
        result.materials = regex_result.materials
        result.dimensions = regex_result.dimensions
        result.formulas = regex_result.formulas
        result.document_meta = regex_result.document_meta

        logger.info(
            "[L2] Done: %d norms, %d tolerances, %d deadlines, %d materials, %d formulas",
            len(result.norm_references), len(result.tolerances),
            len(result.deadlines), len(result.materials), len(result.formulas),
        )

        # ── LAYER 3a: Gemini Flash (confidence=0.7) ──
        logger.info("[L3a] Calling Gemini Flash for enrichment...")
        gemini_result: Dict[str, Any] = {}
        try:
            gemini_result = await call_gemini_enrichment(text, result)
            result.ai_summary = gemini_result.get("summary")
            result.ai_key_requirements = gemini_result.get("key_requirements", [])
            result.ai_risks = gemini_result.get("risks_warnings", [])
            result.ai_volumes = gemini_result.get("volumes_quantities", [])
            result.ai_cross_references = gemini_result.get("cross_references", [])
            logger.info(
                "[L3a] Done: %d requirements, %d risks, %d volumes",
                len(result.ai_key_requirements), len(result.ai_risks), len(result.ai_volumes),
            )
        except Exception as e:
            logger.warning("[L3a] Gemini failed: %s", e)

        # ── LAYER 3b: Perplexity (confidence=0.85) ──
        if not skip_perplexity and result.norm_references:
            logger.info("[L3b] Calling Perplexity for verification...")
            try:
                tasks = _build_verification_tasks(result, gemini_result)

                # Call 1: Verify norms
                if tasks["norms_to_verify"]:
                    result.verified_norms = await perplexity_verify_norms(
                        tasks["norms_to_verify"]
                    )
                    logger.info("[L3b] Verified %d norms", len(result.verified_norms))

                # Call 2: Supplement missing data
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
        result.extracted_rules = compile_rules(result, gemini_result)
        logger.info("[DONE] %s: %d rules ready for NKB", filename, len(result.extracted_rules))

        return result
