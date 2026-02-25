"""
KB Research API — Поиск по нормам/ГОСТЫ/ценам через Perplexity + кэш в базе знаний.

POST /api/v1/kb/research
  {
    "question":    "Jak se dělá bednění pilíře mostu?",
    "save_to_kb":  true,          // default true — кэшировать ответ
    "category":    null           // null = авто-определение из ключевых слов
  }

Flow:
  1. Проверить KB cache (research_<md5>.json в папке категории)
  2. Если найдено — вернуть из кэша без затрат API
  3. Perplexity sonar-pro — широкий поиск по стройным сайтам ЧР
  4. Если Perplexity недоступен — fallback: Gemini direct call
  5. Сохранить в KB/<category>/research_<key>.json
  6. Вернуть ответ + источники + флаги
"""

import json
import hashlib
import logging

from datetime import datetime
from pathlib import Path
from typing import Optional, List

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/kb", tags=["KB Research"])

# ── Category auto-detection ───────────────────────────────────────────────────

_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "B2_csn_standards": [
        "čsn", "en 206", "norma", "standard", "vl4", "tkp", "vyhláška",
        "nařízení", "zákon", "eurokód", "eurocode", "tolerance",
    ],
    "B3_current_prices": [
        "cena", "kč/m²", "kč/m³", "kč/kg", "sazba", "tarif", "ceník",
        "náklady", "ocenění", "price", "preis",
    ],
    "B4_production_benchmarks": [
        "výkon", "produktivita", "nph", "nhp", "norma práce", "směna",
        "takt", "tempo", "parta", "m²/den", "m³/den",
    ],
    "B7_regulations": [
        "zákon č", "zákon o", "bozp", "bezpečnost", "hygiena",
        "nařízení vlády", "osha", "risk", "riziko",
    ],
    "B9_Equipment_Specs": [
        "jeřáb", "čerpadlo", "pumpa", "autodomíchávač", "rypadlo",
        "stroj", "crane", "pump", "excavator",
    ],
}
_DEFAULT_CATEGORY = "B5_tech_cards"

_CZECH_CONSTRUCTION_DOMAINS = [
    "stavebnistandardy.cz",
    "csnonline.cz",
    "unmz.cz",
    "technicke-normy-csn.cz",
    "podminky.urs.cz",
    "urs.cz",
    "beton.cz",
    "casopisstavebnictvi.cz",
    "konstrukce.cz",
    "betonserver.cz",
]


def _detect_category(question: str) -> str:
    q = question.lower()
    scores: dict[str, int] = {}
    for cat, keywords in _CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in q)
        if score:
            scores[cat] = score
    return max(scores, key=scores.get) if scores else _DEFAULT_CATEGORY


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


# ── Endpoint ──────────────────────────────────────────────────────────────────

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
