"""
Catalog matching chain (Work-First / Catalog-Last) — deterministic core.

Brings catalog code matching (OTSKP / ÚRS fulltext search) onto the canonical
chain so a bare keyword hit can no longer claim ``confidence = 1.0``:

    work description
      → UWO gate (work-type axis + element-family axis)   ← filters wrong baskets
      → param prefilter (concrete_class, …)               ← drops mismatched params
      → ranking (named pluggable step, deterministic default, audited/replayable)
      → honest confidence per candidate

Boundaries (task §1.3 / §4):
  * This module never sets ``confidence = 1.0``. 1.0 is reserved for exact
    *code* lookup (a verified DB row keyed by code) and 0.99 for a human
    confirmation — both live OUTSIDE this module.
  * A keyword candidate caps at 0.9 (task ladder); an embeddings candidate
    carries the AI band ~0.70–0.80 and can never pick the final code.
  * The embeddings retrieve is a pluggable seam (``_EMBEDDINGS_PROVIDER``) with
    a deterministic-keyword default; the live pgvector/Vertex provider plugs in
    here without changing any downstream contract.

Test seams are module-level globals (monkeypatched by tests), never function
params — FastMCP cannot build a JSON schema for a ``Callable`` parameter.
"""

from __future__ import annotations

import logging
import re
from typing import Callable, Optional

from app.mcp.tools.classifier import _classify

logger = logging.getLogger(__name__)


# ── Work-type axis (UWO work axis) ───────────────────────────────────────────
# Ordered most-specific-first: a name like "betonářská ocel" must resolve to
# `vyztuz`, not `beton`; "obklad pilířů" to `obklad`, not `beton`. Czech stems
# avoid \w boundaries on diacritics (Pattern 30).
WORK_TYPE_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"l[ií]cov|obklad|kamenn\w*\s*(?:obklad|zdiv)", re.I), "obklad"),
    (re.compile(r"izolac|hydroizol|natav|asfaltov", re.I), "izolace"),
    # Prestressing tendons (předpínací výztuž Y1860) are their own OTSKP basket —
    # resolve BEFORE ordinary `vyztuz`, which the phrase also matches via "výztuž".
    (re.compile(r"předp[íi]n|predpin|předpjat|predpjat|Y1860", re.I), "predpinaci"),
    (re.compile(r"v[ýy]ztuž|vyztuz|armatur|beton[áa]řsk\w*\s*ocel|\bB\s?500", re.I), "vyztuz"),
    (re.compile(r"bedněn|bedneni|skruž|skruz", re.I), "bedneni"),
    (re.compile(r"demolic|bour[áa]n|frézov|frezov|odstraněn", re.I), "demolice"),
    (re.compile(r"v[ýy]kop|zemn[íi]\s*pr[áa]c|n[áa]syp|odkop|odtěžen", re.I), "zemni"),
    (re.compile(r"beton", re.I), "beton"),
]


def classify_work_type(text: str) -> str:
    """Deterministic work-type axis. Returns 'ostatni' when no stem matches."""
    for pattern, wt in WORK_TYPE_RULES:
        if pattern.search(text or ""):
            return wt
    return "ostatni"


def element_family(text: str) -> str:
    """Element-family axis — reuses the existing element classifier (no dup)."""
    try:
        return _classify(text or "")["element_type"]
    except Exception:  # pragma: no cover - classifier is defensive itself
        return "jine"


def work_type_ok(query_wt: str, cand_wt: str) -> bool:
    """Coarse work-type axis (8 buckets). Permissive when either side is unknown
    ('ostatni') — an OTSKP item whose name omits the work verb must not be
    dropped — but a KNOWN mismatch (beton vs obklad) is fatal."""
    return cand_wt == query_wt or cand_wt == "ostatni" or query_wt == "ostatni"


def passes_uwo_gate(query_wt: str, query_ef: str, cand_wt: str, cand_ef: str) -> bool:
    """A candidate enters the basket only if BOTH axes are compatible.

    Element-family (24 buckets) is permissive on the residual 'jine'. This is the
    KEYWORD gate; embeddings candidates skip the family axis (see match_catalog).
    """
    elem_ok = cand_ef == query_ef or cand_ef == "jine" or query_ef == "jine"
    return work_type_ok(query_wt, cand_wt) and elem_ok


# ── Parameter prefilter (after retrieve, before ranking) ─────────────────────
_CONCRETE_CLASS_RE = re.compile(r"C\s*(\d{2,3})\s*/\s*(\d{2,3})", re.I)


def extract_params(text: str) -> dict:
    """Explicit, deterministic params used to disqualify candidates."""
    params: dict = {}
    m = _CONCRETE_CLASS_RE.search(text or "")
    if m:
        params["concrete_class"] = f"C{m.group(1)}/{m.group(2)}"
    return params


def strip_concrete_class(text: str) -> str:
    """Remove a concrete-class token (C30/37) for the RETRIEVAL embedding ONLY.

    The class does NOT define the work basket — piers are piers at any class — but
    leaving it in the embedded query lets a class the catalog lacks (e.g. C35/45,
    which sits between the catalog's C30/37 and C40/50 pier lines) de-anchor recall
    into the wrong basket (live: C35/45 pulled the whole shortlist into tunnels,
    zero series-334 retrieved). Class is still applied downstream via params
    (param_prefilter + honest_confidence), so precision is unaffected; this only
    frees recall to find the right element regardless of the queried class.
    """
    return re.sub(r"\s{2,}", " ", _CONCRETE_CLASS_RE.sub(" ", text or "")).strip()


def param_prefilter(query_params: dict, cand_params: dict) -> bool:
    """Drop a candidate that contradicts an EXPLICIT query param.

    Only a present-on-both-and-different value disqualifies. A candidate that
    is silent on a param is kept (silence is not contradiction).
    """
    for key, q_val in query_params.items():
        c_val = cand_params.get(key)
        if c_val is not None and c_val != q_val:
            return False
    return True


def _params_match(query_params: dict, cand_params: dict) -> bool:
    """True only if every query param is explicitly echoed by the candidate."""
    if not query_params:
        return False
    return all(cand_params.get(k) == v for k, v in query_params.items())


# ── Scoring + honest confidence ──────────────────────────────────────────────
def _tokens(text: str) -> set[str]:
    return {t for t in re.split(r"[^0-9a-zá-ž/]+", (text or "").lower()) if len(t) >= 3}


def name_score(query: str, name: str) -> float:
    """Jaccard token overlap, query-recall-weighted (0..1)."""
    q, n = _tokens(query), _tokens(name)
    if not q:
        return 0.0
    return round(len(q & n) / len(q | n), 4)


def honest_confidence(source: str, score: float, params_exact: bool,
                      similarity: float = 0.0, param_contradiction: bool = False) -> float:
    """Confidence ladder — NEVER 1.0 here (that is the code-lookup path).

    embeddings → AI band [0.70, 0.80]; keyword → [0.5 .. 0.9].

    ``param_contradiction`` only reaches here for embeddings (keyword still hard-drops
    on a contradicting param): it softens the AI-band score so a vector hit whose
    catalog class differs from the query's ranks below a clean-class hit yet stays
    above keyword noise — the query may name a class (e.g. C35/45) the catalog simply
    doesn't carry for that element, which must not delete the correct position.
    """
    if source == "embeddings":
        base = 0.70 + 0.10 * similarity
        if param_contradiction:
            base -= 0.07
        return round(min(0.80, max(0.60, base)), 2)
    base = 0.5 + 0.4 * score
    if params_exact:
        base += 0.1
    return round(min(0.9, base), 2)


# ── Pluggable ranking seam (task §4 reranker contract) ───────────────────────
# Element-family agreement is a strong PRECISION signal but NOT a gate (a
# classifier miss must never drop a hit — that lesson is the family-axis fix).
# It is applied here as a ranking bonus on the sort key only, so a candidate
# matching the query's specific family outranks an off-family hit even at higher
# similarity, WITHOUT touching the honest displayed confidence.
FAMILY_RANK_BONUS = 0.15


def _rank_score(c: dict) -> float:
    return c.get("confidence", 0.0) + (FAMILY_RANK_BONUS if c.get("family_match") else 0.0)


def deterministic_ranker(query: str, candidates: list[dict]) -> list[dict]:
    """Default ranker. Stable order: (confidence + family bonus) ↓, score ↓, cheaper first."""
    return sorted(
        candidates,
        key=lambda c: (-_rank_score(c), -c.get("score", 0.0), c.get("unit_price_czk") or 0.0),
    )


# Module-level default ranker — swap for a P6 cross-encoder without touching
# callers. Replaced via monkeypatch in tests, never passed as a param.
_RANKER: Callable[[str, list[dict]], list[dict]] = deterministic_ranker


def rank(query: str, candidates: list[dict], ranker: Optional[Callable] = None) -> tuple[list[dict], dict]:
    """Named pluggable ranking step. Returns (ordered, audit_record).

    The audit record makes ranking REPLAYABLE: a replay reads ``output_codes``
    instead of re-running the ranker. Ranking only reorders — it never mutates a
    candidate's confidence, so it cannot override a 1.0 (code) / 0.99 (human)
    that lives upstream.
    """
    active = ranker or _RANKER
    ordered = active(query, list(candidates))
    audit = {
        "ranker": getattr(active, "__name__", "custom"),
        "input_codes": [c.get("code") for c in candidates],
        "output_codes": [c.get("code") for c in ordered],
    }
    return ordered, audit


# ── Embeddings retrieve seam (recall) ────────────────────────────────────────
# Set in Phase 1b to a pgvector + gemini-embedding-001 provider:
#   (query: str, limit: int) -> list[dict]   each dict: code/description/unit/
#   unit_price_czk/source='embeddings'/similarity. Tests monkeypatch this.
_EMBEDDINGS_PROVIDER: Optional[Callable[[str, int], list[dict]]] = None


def retrieve_candidates(
    query: str,
    keyword_search_fn: Callable[[str], list[dict]],
    *,
    embeddings_provider: Optional[Callable[[str, int], list[dict]]] = None,
    limit: int = 20,
) -> list[dict]:
    """Recall: deterministic keyword search ∪ optional embeddings (dedup by code).

    Embeddings repair recall (a correct code absent from the keyword shortlist
    can still surface) without becoming a source of truth — its candidates carry
    ``source='embeddings'`` and land in the AI confidence band downstream.
    """
    provider = embeddings_provider if embeddings_provider is not None else _EMBEDDINGS_PROVIDER
    by_code: dict[str, dict] = {}
    for c in keyword_search_fn(query):
        by_code.setdefault(c["code"], {**c, "source": c.get("source", "keyword")})
    if provider is not None:
        # Embed a CLASS-STRIPPED query: retrieval = work-first recall (class-
        # independent); the class is re-applied downstream in match_catalog's
        # param_prefilter + confidence. Keyword search keeps the full query.
        for c in provider(strip_concrete_class(query), limit):
            by_code.setdefault(c["code"], {**c, "source": "embeddings"})
    return list(by_code.values())


# ── Orchestration: gate → prefilter → confidence → rank → carrier ────────────
def match_catalog(query: str, raw_candidates: list[dict], *, ranker: Optional[Callable] = None) -> dict:
    """Run the deterministic chain over already-retrieved candidates.

    Returns a CARRIER (not a table): ranked candidates each with honest
    confidence + provenance, plus the query's UWO basket and the ranking audit.
    """
    q_wt = classify_work_type(query)
    q_ef = element_family(query)
    q_params = extract_params(query)

    # Gate trace — makes "why isn't there an embeddings hit in the output?"
    # answerable from the response alone, no log-diving. Distinguishes "provider
    # returned nothing" (retrieved.embeddings == 0) from "retrieved but filtered"
    # (kept.embeddings == 0 with a non-zero dropped.* bucket).
    trace = {
        "retrieved": {"keyword": 0, "embeddings": 0},
        "kept": {"keyword": 0, "embeddings": 0},
        "dropped": {"work_type": 0, "family_axis": 0, "param_prefilter": 0},
        # embeddings kept despite a class contradiction (soft prefilter), penalised
        # in confidence rather than dropped.
        "soft_param_mismatch": {"embeddings": 0},
    }

    gated: list[dict] = []
    for c in raw_candidates:
        popis = c.get("description", "") or c.get("nazev", "")
        c_wt = c.get("work_type") or classify_work_type(popis)
        c_ef = c.get("element_family") or element_family(popis)
        source = c.get("source", "keyword")
        trace["retrieved"][source if source in trace["retrieved"] else "keyword"] += 1
        # Embeddings recall exists to REPAIR the keyword classifier's misses, so
        # gating it by that same element-family classifier (24 fuzzy buckets)
        # discards exactly the high-similarity hits it was meant to surface
        # (live: "beton mostních pilířů C35/45" → query family driki_piliru, every
        # embeddings candidate dropped because the catalog popisy classify to
        # other specific families). Embeddings keep only the coarse, reliable
        # work-type axis; their AI-band confidence still bars them from claiming
        # truth. Keyword candidates keep the full two-axis gate.
        if source == "embeddings":
            if not work_type_ok(q_wt, c_wt):
                trace["dropped"]["work_type"] += 1
                continue
        elif not work_type_ok(q_wt, c_wt):
            trace["dropped"]["work_type"] += 1
            continue
        elif not passes_uwo_gate(q_wt, q_ef, c_wt, c_ef):
            trace["dropped"]["family_axis"] += 1
            continue
        c_params = c.get("params") or extract_params(popis)
        param_ok = param_prefilter(q_params, c_params)
        if not param_ok:
            # Keyword keeps the hard drop (precision). Embeddings soften: a class
            # named in the query that the catalog item contradicts must NOT delete a
            # semantically-correct vector — OTSKP prices on a discrete class ladder
            # and the queried class may not exist for this element. Keep + penalise.
            if source == "embeddings":
                trace["soft_param_mismatch"]["embeddings"] += 1
            else:
                trace["dropped"]["param_prefilter"] += 1
                continue
        trace["kept"][source if source in trace["kept"] else "keyword"] += 1
        score = name_score(query, popis)
        gated.append({
            **c,
            "description": popis,
            "popis_full": popis,  # reranker (P6) reads full prose
            "work_type": c_wt,
            "element_family": c_ef,
            # Precision signal for the ranker (NOT a gate): candidate shares the
            # query's SPECIFIC element family ('jine' is the non-committal residual).
            "family_match": bool(q_ef and q_ef != "jine" and c_ef == q_ef),
            "params": c_params,
            "score": score,
            "source": source,
            "confidence": honest_confidence(
                source, score, _params_match(q_params, c_params),
                c.get("similarity", 0.0), param_contradiction=not param_ok,
            ),
            "provenance": {
                "retrieve": source,
                "uwo_gate": {"work_type": c_wt, "element_family": c_ef},
                "param_prefilter": "passed" if param_ok else "softened",
            },
        })

    ordered, ranking_audit = rank(query, gated, ranker)
    return {
        "candidates": ordered,
        "ranking_audit": ranking_audit,
        "query_work_type": q_wt,
        "query_element_family": q_ef,
        "query_params": q_params,
        "retrieve_summary": trace,
    }
