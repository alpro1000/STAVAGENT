"""
KB Research API — Standards/norms/prices search with multilingual expert mode.

Endpoints:
  POST /api/v1/kb/research          — Simple Perplexity/Gemini search, saves text answer
  POST /api/v1/kb/expert-research   — Expert structured JSON (standards, laws, technologies)
                                      Uses standards_researcher.md prompt.
                                      Works in ANY language (CS/RU/UA/SK/EN auto-detected).

Flow (expert-research):
  1. Language detection from query text
  2. KB cache check — return instantly if found
  3. Gemini call with standards_researcher.md expert prompt
  4. Parse structured JSON from LLM output
  5. Save to KB/<auto-category>/expert_<key>.json
  6. Return structured response

Flow (research):
  1. KB cache check
  2. Perplexity sonar-pro (Czech construction sites)
  3. Gemini fallback
  4. Save to KB/<auto-category>/research_<key>.json
"""

import json
import re
import hashlib
import logging

from datetime import datetime
from pathlib import Path
from typing import Optional, List, Any, Dict

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/kb", tags=["KB Research"])

# ── Category auto-detection ───────────────────────────────────────────────────
# Covers: Czech, Russian, Ukrainian, Slovak, English keywords

_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "B2_csn_standards": [
        # Czech/Slovak
        "čsn", "en 206", "norma", "standard", "vl4", "tkp", "vyhláška",
        "nařízení", "zákon", "eurokód", "eurocode", "tolerance", "stn",
        # Russian
        "гост", "снип", "сп ", "норматив", "нормы", "стандарт", "тр ", "тсн",
        # Ukrainian
        "дбн", "дсту", "норми", "будівельні норми", "технічні умови",
        # English
        "standard", "norm", "code", "regulation", "eurocode",
    ],
    "B3_current_prices": [
        # Czech
        "cena", "kč/m²", "kč/m³", "kč/kg", "sazba", "tarif", "ceník",
        "náklady", "ocenění",
        # Russian
        "цена", "стоимость", "расценка", "руб/м", "смета", "прайс",
        # Ukrainian
        "ціна", "вартість", "розцінка", "кошторис",
        # English
        "price", "cost", "rate", "estimate",
    ],
    "B4_production_benchmarks": [
        # Czech
        "výkon", "produktivita", "nph", "nhp", "norma práce", "směna",
        "takt", "tempo", "parta", "m²/den", "m³/den",
        # Russian
        "выработка", "производительность", "норма времени", "нормочас", "смена",
        # Ukrainian
        "виробіток", "продуктивність", "норма часу",
        # English
        "productivity", "output rate", "crew productivity",
    ],
    "B7_regulations": [
        # Czech
        "zákon č", "zákon o", "bozp", "bezpečnost", "hygiena",
        "nařízení vlády", "osha", "risk", "riziko",
        # Russian
        "закон", "охрана труда", "безопасность", "федеральный", "приказ",
        # Ukrainian
        "охорона праці", "закон україни", "безпека",
        # English
        "law", "safety", "regulation", "directive", "legislation",
    ],
    "B9_Equipment_Specs": [
        # Czech
        "jeřáb", "čerpadlo", "pumpa", "autodomíchávač", "rypadlo", "stroj",
        # Russian
        "кран", "насос", "автобетоносмеситель", "экскаватор", "машина",
        # Ukrainian
        "кран", "насос", "автобетонозмішувач", "екскаватор",
        # English
        "crane", "pump", "mixer", "excavator", "equipment",
    ],
}
_DEFAULT_CATEGORY = "B5_tech_cards"

_CONSTRUCTION_SEARCH_DOMAINS = [
    # Czech
    "stavebnistandardy.cz", "csnonline.cz", "unmz.cz",
    "technicke-normy-csn.cz", "podminky.urs.cz", "urs.cz",
    "beton.cz", "casopisstavebnictvi.cz", "konstrukce.cz", "betonserver.cz",
]


def _detect_category(question: str) -> str:
    q = question.lower()
    scores: dict[str, int] = {}
    for cat, keywords in _CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in q)
        if score:
            scores[cat] = score
    return max(scores, key=scores.get) if scores else _DEFAULT_CATEGORY


# ── Language detection ────────────────────────────────────────────────────────

def _detect_language(text: str) -> str:
    """
    Detect query language: 'cs', 'ru', 'uk', 'sk', 'en'.
    Uses character set + construction-domain keywords.
    """
    # Ukrainian markers (check before Russian — many shared words)
    ua_markers = ["будівництво", "будівель", "норми будівництва", "дбн", "дсту",
                  "законодавство", "армування", "бетонування", "опалубка", "зведення"]
    # Russian markers
    ru_markers = ["строительство", "бетонирование", "армирование", "гост", "снип",
                  "норматив", "опалубка", "производительность", "госстрой", " рф "]
    # Czech markers
    cs_markers = ["stavebnictví", "betonáž", "výztuž", "bednění", "čsn", "tkp",
                  "stavba", "norma", "budova"]
    # Slovak markers
    sk_markers = ["stavebníctvo", "betón", "výstuž", "debnenie", "stn", "stavba"]

    t = text.lower()

    # Has Cyrillic?
    has_cyrillic = bool(re.search(r'[а-яёА-ЯЁ]', text))
    has_ukrainian_cyrillic = bool(re.search(r'[іїєґІЇЄҐ]', text))

    if has_cyrillic or has_ukrainian_cyrillic:
        if has_ukrainian_cyrillic or any(m in t for m in ua_markers):
            return "uk"
        if any(m in t for m in ru_markers):
            return "ru"
        # Default Cyrillic → Russian
        return "ru"

    if any(m in t for m in cs_markers):
        return "cs"
    if any(m in t for m in sk_markers):
        return "sk"

    return "en"


# ── KB cache helpers ──────────────────────────────────────────────────────────

def _cache_key(question: str) -> str:
    return hashlib.md5(question.lower().strip().encode()).hexdigest()[:12]


def _find_cached(question: str, kb_dir: Path) -> Optional[dict]:
    key = _cache_key(question)
    for cat_dir in kb_dir.iterdir():
        if not cat_dir.is_dir():
            continue
        p = cat_dir / f"research_{key}.json"
        if p.exists():
            try:
                return json.loads(p.read_text(encoding="utf-8"))
            except Exception:
                pass
    return None


def _save_to_kb(kb_dir: Path, category: str, key: str, record: dict) -> bool:
    try:
        target = kb_dir / category
        target.mkdir(parents=True, exist_ok=True)
        (target / f"research_{key}.json").write_text(
            json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return True
    except Exception as exc:
        logger.warning(f"[KBResearch] Save failed: {exc}")
        return False


# ── Models ────────────────────────────────────────────────────────────────────

class KBResearchRequest(BaseModel):
    question:   str
    save_to_kb: bool = True
    category:   Optional[str] = None  # None = auto-detect


class SourceItem(BaseModel):
    url:   str
    title: str


class KBResearchResponse(BaseModel):
    answer:      str
    sources:     List[SourceItem]
    from_kb:     bool
    kb_saved:    bool
    kb_category: str
    model_used:  str


class ExpertResearchRequest(BaseModel):
    """
    Multilingual expert research request.
    Works in: Czech, Russian, Ukrainian, Slovak, English.
    """
    question:   str
    save_to_kb: bool = True
    category:   Optional[str] = None   # None = auto-detect
    language:   Optional[str] = None   # None = auto-detect from question


class ExpertResearchResponse(BaseModel):
    """Structured expert research result with standards, laws, technologies."""
    query_language:   str
    domain:           str
    standards:        List[Dict[str, Any]]
    laws_regulations: List[Dict[str, Any]]
    technologies:     List[Dict[str, Any]]
    materials:        List[Dict[str, Any]]
    safety_requirements: List[Dict[str, Any]]
    summary:          str
    confidence_level: str
    recommended_kb_category: str
    from_kb:          bool
    kb_saved:         bool
    model_used:       str


# ── Perplexity helper ─────────────────────────────────────────────────────────

async def _call_perplexity(question: str) -> tuple[str, list[SourceItem]]:
    """
    Direct Perplexity sonar-pro call.
    Returns (answer_text, sources_list).
    Raises on failure.
    """
    from app.core.perplexity_client import PerplexityClient
    client = PerplexityClient()
    raw = await client._search(
        query=question,
        domains=_CZECH_CONSTRUCTION_DOMAINS,
        search_recency_filter="year",
    )
    content = (
        raw.get("choices", [{}])[0]
           .get("message", {})
           .get("content", "")
    )
    citations = raw.get("citations", [])
    sources = []
    for c in citations:
        if isinstance(c, str):
            sources.append(SourceItem(url=c, title=c))
        elif isinstance(c, dict):
            sources.append(SourceItem(url=c.get("url", ""), title=c.get("title", c.get("url", ""))))
    return content, sources


# ── Gemini fallback ───────────────────────────────────────────────────────────

async def _call_gemini_fallback(question: str) -> str:
    """
    Direct Gemini call when Perplexity is unavailable.
    Uses GOOGLE_API_KEY + GEMINI_MODEL from settings.
    """
    api_key = getattr(settings, "GOOGLE_API_KEY", None)
    if not api_key:
        raise ValueError("GOOGLE_API_KEY not configured")

    model = getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash-lite")
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )

    system_prompt = (
        "Jsi expert na české stavební normy, technologické postupy a ceníky. "
        "Odpovídej stručně a prakticky v češtině. Odkazuj na konkrétní normy "
        "(ČSN, TKP, EN) pokud jsou relevantní."
    )

    payload = {
        "contents": [
            {"role": "user", "parts": [{"text": f"{system_prompt}\n\n{question}"}]}
        ],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 800},
    }

    async with httpx.AsyncClient(timeout=30.0) as http:
        resp = await http.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

    return (
        data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
    )


# ── Expert Gemini call with standards_researcher prompt ───────────────────────

def _load_standards_researcher_prompt() -> str:
    """Load the standards_researcher.md prompt from prompts/roles/."""
    try:
        prompt_path = (
            settings.BASE_DIR
            / "app" / "prompts" / "roles" / "standards_researcher.md"
        )
        return prompt_path.read_text(encoding="utf-8")
    except Exception as exc:
        logger.warning(f"[KBExpert] Could not load standards_researcher.md: {exc}")
        return (
            "You are a multilingual construction engineering expert. "
            "Detect query language and respond in the same language. "
            "Find applicable standards (ČSN, GOST, EN, DBN), laws, and technologies. "
            "Output a structured JSON with keys: query_language, domain, standards, "
            "laws_regulations, technologies, materials, safety_requirements, summary, "
            "confidence_level, recommended_for_kb_category."
        )


def _extract_json_from_response(text: str) -> Optional[dict]:
    """Extract JSON object from LLM response (handles markdown code blocks)."""
    # Try to find ```json ... ``` block
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Try raw JSON object
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    return None


async def _call_gemini_expert(question: str, system_prompt: str) -> dict:
    """
    Call Gemini with the standards_researcher expert prompt.
    Returns parsed structured JSON dict.
    """
    api_key = getattr(settings, "GOOGLE_API_KEY", None)
    if not api_key:
        raise ValueError("GOOGLE_API_KEY not configured")

    model = getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash-lite")
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )

    full_prompt = (
        f"{system_prompt}\n\n"
        f"---\n\n"
        f"USER QUERY:\n{question}\n\n"
        f"IMPORTANT: Output ONLY valid JSON. No prose before or after the JSON object."
    )

    payload = {
        "contents": [
            {"role": "user", "parts": [{"text": full_prompt}]}
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 3000,
        },
    }

    async with httpx.AsyncClient(timeout=60.0) as http:
        resp = await http.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

    raw_text = (
        data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
    )

    parsed = _extract_json_from_response(raw_text)
    if not parsed:
        # Fallback: wrap raw text as summary
        parsed = {
            "query_language": "en",
            "domain": "construction",
            "standards": [],
            "laws_regulations": [],
            "technologies": [],
            "materials": [],
            "safety_requirements": [],
            "summary": raw_text[:2000],
            "confidence_level": "low",
            "recommended_for_kb_category": "B5_tech_cards",
        }

    return parsed


# ── Expert research endpoint ──────────────────────────────────────────────────

@router.post("/expert-research", response_model=ExpertResearchResponse)
async def expert_research(request: ExpertResearchRequest):
    """
    Multilingual expert standards research.

    Thinks like a senior construction specialist. Automatically finds:
    - Applicable ČSN / GOST / EN / DBN / STN standards
    - Laws and regulations (Building Act, BOZP, etc.)
    - Construction technologies and procedures
    - Material specifications
    - Safety requirements

    Works in ANY language (Czech, Russian, Ukrainian, Slovak, English).
    Detects language from query and responds in the same language.

    Results are saved to the knowledge base and used in all calculators
    via the multi-role system (enable_kb=true in /api/v1/multi-role/ask).

    Example:
    ```json
    {
        "question": "Какие нормы применяются при бетонировании мостов?"
    }
    ```
    """
    question = request.question.strip()
    if not question:
        return ExpertResearchResponse(
            query_language="en", domain="unknown",
            standards=[], laws_regulations=[], technologies=[],
            materials=[], safety_requirements=[],
            summary="Please provide a question.",
            confidence_level="low", recommended_kb_category="B5_tech_cards",
            from_kb=False, kb_saved=False, model_used="none",
        )

    kb_dir   = settings.BASE_DIR / "app" / "knowledge_base"
    key      = "exp_" + _cache_key(question)
    category = request.category or _detect_category(question)
    language = request.language or _detect_language(question)

    logger.info(f"[KBExpert] question='{question[:80]}' lang={language} cat={category}")

    # ── 1. KB cache ────────────────────────────────────────────────────────────
    cached = _find_cached(key, kb_dir)  # reuse helper with key as pseudo-question
    if cached and "standards" in cached:
        logger.info(f"[KBExpert] Cache hit key={key}")
        return ExpertResearchResponse(
            query_language=cached.get("query_language", language),
            domain=cached.get("domain", ""),
            standards=cached.get("standards", []),
            laws_regulations=cached.get("laws_regulations", []),
            technologies=cached.get("technologies", []),
            materials=cached.get("materials", []),
            safety_requirements=cached.get("safety_requirements", []),
            summary=cached.get("summary", ""),
            confidence_level=cached.get("confidence_level", "medium"),
            recommended_kb_category=cached.get("recommended_for_kb_category", category),
            from_kb=True, kb_saved=False, model_used="kb_cache",
        )

    # ── 2. Call Gemini with expert prompt ──────────────────────────────────────
    system_prompt = _load_standards_researcher_prompt()
    result: dict = {}
    model_used = "unavailable"

    try:
        result = await _call_gemini_expert(question, system_prompt)
        model_used = f"gemini/{getattr(settings, 'GEMINI_MODEL', 'gemini-2.5-flash-lite')}"
        logger.info(
            f"[KBExpert] Gemini OK — lang={result.get('query_language')} "
            f"standards={len(result.get('standards', []))} "
            f"laws={len(result.get('laws_regulations', []))}"
        )
    except Exception as exc:
        logger.error(f"[KBExpert] Gemini call failed: {exc}", exc_info=True)
        result = {
            "query_language": language,
            "domain": "unknown",
            "standards": [],
            "laws_regulations": [],
            "technologies": [],
            "materials": [],
            "safety_requirements": [],
            "summary": f"Research failed: {str(exc)[:200]}",
            "confidence_level": "low",
            "recommended_for_kb_category": category,
        }

    # Normalise recommended category from LLM output
    recommended_cat = result.get("recommended_for_kb_category", category)

    # ── 3. Save to KB ──────────────────────────────────────────────────────────
    kb_saved = False
    if request.save_to_kb and model_used != "unavailable":
        record = {
            **result,
            "query": question,
            "kb_category": recommended_cat,
            "model_used": model_used,
            "saved_at": datetime.utcnow().isoformat(),
        }
        kb_saved = _save_to_kb(kb_dir, recommended_cat, key, record)
        if kb_saved:
            logger.info(f"[KBExpert] Saved → KB/{recommended_cat}/expert_{key}.json")

    return ExpertResearchResponse(
        query_language=result.get("query_language", language),
        domain=result.get("domain", ""),
        standards=result.get("standards", []),
        laws_regulations=result.get("laws_regulations", []),
        technologies=result.get("technologies", []),
        materials=result.get("materials", []),
        safety_requirements=result.get("safety_requirements", []),
        summary=result.get("summary", ""),
        confidence_level=result.get("confidence_level", "medium"),
        recommended_kb_category=recommended_cat,
        from_kb=False, kb_saved=kb_saved, model_used=model_used,
    )


# ── Simple research endpoint ──────────────────────────────────────────────────

@router.post("/research", response_model=KBResearchResponse)
async def research_question(request: KBResearchRequest):
    """
    Vyhledá odpověď na otázku o normách/postupech/cenách.

    1. Nejprve zkontroluje KB cache (žádné API náklady).
    2. Pak volá Perplexity sonar-pro na česky stavební stránky.
    3. Při výpadku Perplexity přepne na Gemini.
    4. Výsledek uloží jako research_<key>.json do příslušné KB složky.
    """
    question = request.question.strip()
    if not question:
        return KBResearchResponse(
            answer="Prosím zadejte otázku.",
            sources=[],
            from_kb=False,
            kb_saved=False,
            kb_category="",
            model_used="none",
        )

    kb_dir   = settings.BASE_DIR / "app" / "knowledge_base"
    key      = _cache_key(question)
    category = request.category or _detect_category(question)

    # ── 1. KB cache ────────────────────────────────────────────────────────────
    cached = _find_cached(question, kb_dir)
    if cached:
        logger.info(f"[KBResearch] Cache hit key={key}")
        return KBResearchResponse(
            answer=cached.get("answer", ""),
            sources=[SourceItem(**s) for s in cached.get("sources", [])],
            from_kb=True,
            kb_saved=False,
            kb_category=cached.get("kb_category", category),
            model_used="kb_cache",
        )

    # ── 2. Perplexity ──────────────────────────────────────────────────────────
    answer     = ""
    sources: list[SourceItem] = []
    model_used = "unavailable"

    try:
        answer, sources = await _call_perplexity(question)
        model_used = "perplexity/sonar-pro"
        logger.info(f"[KBResearch] Perplexity OK — {len(sources)} sources")
    except Exception as perp_err:
        logger.warning(f"[KBResearch] Perplexity failed: {perp_err} — trying Gemini")

        # ── 3. Gemini fallback ─────────────────────────────────────────────────
        try:
            answer     = await _call_gemini_fallback(question)
            model_used = f"gemini/{getattr(settings, 'GEMINI_MODEL', 'gemini-2.5-flash-lite')}"
            logger.info("[KBResearch] Gemini fallback OK")
        except Exception as gem_err:
            logger.warning(f"[KBResearch] Gemini fallback failed: {gem_err}")
            answer = (
                "Omlouváme se — vyhledávání momentálně nefunguje. "
                "Zkontrolujte PERPLEXITY_API_KEY nebo GOOGLE_API_KEY."
            )
            model_used = "unavailable"

    # ── 4. Save to KB ──────────────────────────────────────────────────────────
    kb_saved = False
    if request.save_to_kb and answer and model_used != "unavailable":
        record = {
            "question":    question,
            "answer":      answer,
            "sources":     [s.model_dump() for s in sources],
            "kb_category": category,
            "model_used":  model_used,
            "saved_at":    datetime.utcnow().isoformat(),
        }
        kb_saved = _save_to_kb(kb_dir, category, key, record)
        if kb_saved:
            logger.info(f"[KBResearch] Saved → KB/{category}/research_{key}.json")

    return KBResearchResponse(
        answer=answer,
        sources=sources,
        from_kb=False,
        kb_saved=kb_saved,
        kb_category=category,
        model_used=model_used,
    )
