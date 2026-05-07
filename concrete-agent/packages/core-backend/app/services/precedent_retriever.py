"""
precedent_retriever.py — KB B5 reference project matching for AI Reasoner.

Walks `B5_tech_cards/real_world_examples/` + `B5_tech_cards/ZS_templates/`,
parses each METADATA.md, scores against AdvisorContext, returns top-K
similar precedents.

Used by norm_advisor.py to inject few-shot examples into the LLM prompt so
generated output aligns to similar past projects (mostovy patterns vs urban
highway patterns, small vs large scope, etc).

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-05-08 (Žihle Session 5 — AI Reasoner precedent retrieval)
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import List, Optional

from app.core.config import settings
from app.models.norm_schemas import AdvisorContext, Precedent

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Scope bucketing
# ---------------------------------------------------------------------------
# Aligned with B5_tech_cards/ZS_templates/PATTERNS.md Pattern A:
#   small <20 M, mid 20-70 M, large >70 M (Kč bez DPH)
SCOPE_THRESHOLDS_M_KC = {"small_max": 20.0, "mid_max": 70.0}


def derive_scope_range(scope_kc_bez_dph: Optional[float]) -> Optional[str]:
    """Bucket project size into 'small' / 'mid' / 'large'."""
    if scope_kc_bez_dph is None or scope_kc_bez_dph <= 0:
        return None
    m = scope_kc_bez_dph / 1_000_000.0
    if m < SCOPE_THRESHOLDS_M_KC["small_max"]:
        return "small"
    if m < SCOPE_THRESHOLDS_M_KC["mid_max"]:
        return "mid"
    return "large"


# ---------------------------------------------------------------------------
# METADATA.md parsing
# ---------------------------------------------------------------------------
# Each KB precedent METADATA.md has a "Project metadata" or similar table with
# bold-labelled rows. We extract a few canonical fields via regex.

_FIELD_PATTERNS = {
    "project_type":     re.compile(r"\*\*Project type:?\*\*\s*\|?\s*([^\|\n]+)", re.IGNORECASE),
    "project_size":     re.compile(r"\*\*Project size:?\*\*\s*\|?\s*([^\|\n]+)", re.IGNORECASE),
    "duration":         re.compile(r"\*\*(?:Duration|Doba realizace):?\*\*\s*\|?\s*([^\|\n]+)", re.IGNORECASE),
    "zs_pomer":         re.compile(r"\*\*ZS\s*po(?:měr|mer):?\*\*\s*\|?\s*([^\|\n]+)", re.IGNORECASE),
    "status":           re.compile(r"\*\*(?:Status|Success status):?\*\*\s*\|?\s*([^\|\n]+)", re.IGNORECASE),
}

# Match Kč amount like "10 585 736 Kč" or "70 M Kč" or "12.20 M"
_AMOUNT_KC = re.compile(r"([\d\s.,]+)\s*(M\s*)?Kč")
_AMOUNT_M = re.compile(r"([\d.,]+)\s*M\b")

# Match duration like "11 měs" or "11 měsíců" or "7"
_DURATION_MES = re.compile(r"([\d.]+)\s*(?:měs|měsíc)", re.IGNORECASE)
# Match percentage like "22.6 %" or "5.0%"
_PCT = re.compile(r"([\d.,]+)\s*%")


def _parse_amount_to_kc(text: str) -> Optional[float]:
    """Extract Kč amount from a string. Handles '10 585 736 Kč' and '70 M Kč'."""
    if not text:
        return None
    m = _AMOUNT_M.search(text)
    if m:
        try:
            return float(m.group(1).replace(",", ".")) * 1_000_000.0
        except ValueError:
            pass
    m = _AMOUNT_KC.search(text)
    if m:
        try:
            num = m.group(1).replace(" ", "").replace(" ", "").replace(",", ".")
            # Czech decimal: if there are 2+ dots from thousand grouping, drop them
            if num.count(".") > 1:
                num = num.replace(".", "")
            val = float(num)
            if m.group(2):    # 'M' modifier
                val *= 1_000_000.0
            return val
        except ValueError:
            pass
    return None


def _parse_duration_mes(text: str) -> Optional[float]:
    """Extract duration in months from a string."""
    if not text:
        return None
    m = _DURATION_MES.search(text)
    if m:
        try:
            return float(m.group(1).replace(",", "."))
        except ValueError:
            pass
    return None


def _parse_pct(text: str) -> Optional[float]:
    """Extract percentage from a string."""
    if not text:
        return None
    m = _PCT.search(text)
    if m:
        try:
            return float(m.group(1).replace(",", "."))
        except ValueError:
            pass
    return None


def _extract_summary_lines(content: str, max_lines: int = 6) -> List[str]:
    """Extract first ~6 fact-bearing lines from METADATA.md (skip headings/blank)."""
    out = []
    for line in content.splitlines():
        s = line.strip()
        if not s or s.startswith("#") or s.startswith("---") or s.startswith("|"):
            continue
        if s.startswith("**") and ":" in s:
            out.append(s)
        if len(out) >= max_lines:
            break
    return out


def _parse_metadata_md(path: Path) -> dict:
    """Extract structured fields from a METADATA.md file."""
    try:
        content = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as e:
        logger.warning(f"[Precedent] cannot read {path}: {e}")
        return {}

    fields = {}
    for key, pattern in _FIELD_PATTERNS.items():
        m = pattern.search(content)
        if m:
            fields[key] = m.group(1).strip()

    return {
        "project_type": (fields.get("project_type") or "").lower().split("(")[0].strip() or None,
        "scope_kc_bez_dph": _parse_amount_to_kc(fields.get("project_size", "")),
        "duration_mes": _parse_duration_mes(fields.get("duration", "")),
        "zs_pomer_pct": _parse_pct(fields.get("zs_pomer", "")),
        "status": fields.get("status"),
        "summary_lines": _extract_summary_lines(content),
    }


# ---------------------------------------------------------------------------
# KB walk + scoring
# ---------------------------------------------------------------------------
KB_SCAN_DIRS = [
    "B5_tech_cards/real_world_examples",
    "B5_tech_cards/ZS_templates",
]


def _kb_root() -> Path:
    """Return the configured KB_DIR (settings ensures it's set)."""
    return Path(settings.KB_DIR)


def _walk_kb_metadata(kb_root: Optional[Path] = None) -> List[Path]:
    """Find every METADATA.md under the configured B5 scan dirs."""
    root = kb_root or _kb_root()
    paths = []
    for sub in KB_SCAN_DIRS:
        base = root / sub
        if not base.exists():
            continue
        paths.extend(base.rglob("METADATA.md"))
    return paths


def _score_precedent(p: Precedent, ctx: AdvisorContext) -> float:
    """Score a precedent against context.

    Higher score = more similar.
    Components:
      +5  exact project_type match
      +3  scope within ±50 % of context scope
      +1  scope within ±100 %
      +2  scope_range bucket match (small/mid/large)
      +1  duration within ±30 %
      +0.5 status indicates completed pilot ('tender_ready' / 'success')
    """
    score = 0.0
    ctx_pt = (ctx.project_type or ctx.construction_type or "").lower()
    if p.project_type and ctx_pt and p.project_type == ctx_pt:
        score += 5.0
    elif p.project_type and ctx_pt and (ctx_pt in p.project_type or p.project_type in ctx_pt):
        score += 2.0    # partial type match (e.g. 'mostovy' vs 'mostovy III. třídy')

    if p.scope_kc_bez_dph and ctx.scope_kc_bez_dph and ctx.scope_kc_bez_dph > 0:
        ratio = p.scope_kc_bez_dph / ctx.scope_kc_bez_dph
        if 0.5 <= ratio <= 2.0:
            score += 3.0
        elif 0.25 <= ratio <= 4.0:
            score += 1.0

    ctx_range = ctx.scope_range or derive_scope_range(ctx.scope_kc_bez_dph)
    if p.scope_range and ctx_range and p.scope_range == ctx_range:
        score += 2.0

    if p.duration_mes and ctx.duration_mes and ctx.duration_mes > 0:
        d_ratio = p.duration_mes / ctx.duration_mes
        if 0.7 <= d_ratio <= 1.3:
            score += 1.0

    if p.status and any(t in p.status.lower() for t in ("tender_ready", "complete", "success")):
        score += 0.5

    return round(score, 2)


def retrieve_precedents(
    ctx: AdvisorContext,
    top_k: int = 3,
    kb_root: Optional[Path] = None,
) -> List[Precedent]:
    """Find top-K KB precedents most similar to the given AdvisorContext.

    Workflow:
      1. Walk B5 KB_SCAN_DIRS for METADATA.md files
      2. Parse each METADATA.md → Precedent object
      3. Score each precedent vs ctx
      4. Sort by score desc, take top_k

    Returns empty list when KB is missing / no precedents found / all score 0.
    Caller should handle empty result gracefully (no precedent injection).
    """
    if top_k < 1:
        return []

    root = kb_root or _kb_root()
    md_paths = _walk_kb_metadata(root)
    if not md_paths:
        logger.info("[Precedent] no METADATA.md found under B5 KB scan dirs")
        return []

    candidates: List[Precedent] = []
    for md in md_paths:
        try:
            rel = md.parent.relative_to(root)
        except ValueError:
            rel = md.parent
        meta = _parse_metadata_md(md)
        if not meta:
            continue
        scope_range = derive_scope_range(meta.get("scope_kc_bez_dph"))
        precedent = Precedent(
            name=md.parent.name,
            path=str(rel),
            project_type=meta.get("project_type"),
            scope_kc_bez_dph=meta.get("scope_kc_bez_dph"),
            scope_range=scope_range,
            duration_mes=meta.get("duration_mes"),
            zs_pomer_pct=meta.get("zs_pomer_pct"),
            status=meta.get("status"),
            summary_lines=meta.get("summary_lines") or [],
        )
        precedent.score = _score_precedent(precedent, ctx)
        candidates.append(precedent)

    # Drop zero-score (clearly no signal) — caller can re-run with broader ctx
    candidates = [p for p in candidates if p.score > 0]
    candidates.sort(key=lambda p: p.score, reverse=True)
    top = candidates[:top_k]
    logger.info(
        f"[Precedent] retrieve_precedents: {len(md_paths)} candidates → "
        f"{len(top)} top-{top_k} (scores={[p.score for p in top]})"
    )
    return top


# ---------------------------------------------------------------------------
# Few-shot prompt block
# ---------------------------------------------------------------------------

def format_precedents_for_prompt(precedents: List[Precedent]) -> str:
    """Render precedents as a few-shot examples block for the LLM prompt.

    Returns empty string when no precedents — caller skips section entirely.
    """
    if not precedents:
        return ""

    lines = [
        "## REFERENČNÍ PRECEDENTY (top-{n} z KB B5)".format(n=len(precedents)),
        "",
        "Použij tyto dokončené projekty jako few-shot příklady. Tvůj výstup MUSÍ být",
        "konzistentní s patterny / pásmy pomě­rů demonstrovanými níže — pokud se odchyluje,",
        "explicitně zdůvodni proč.",
        "",
    ]
    for i, p in enumerate(precedents, start=1):
        scope_str = f"{p.scope_kc_bez_dph:,.0f} Kč" if p.scope_kc_bez_dph else "n/a"
        if p.scope_kc_bez_dph and p.scope_kc_bez_dph >= 1_000_000:
            scope_str = f"{p.scope_kc_bez_dph/1_000_000:.1f} M Kč"
        zs_str = f"{p.zs_pomer_pct:.1f} %" if p.zs_pomer_pct is not None else "n/a"
        dur_str = f"{p.duration_mes:.0f} měs" if p.duration_mes else "n/a"
        lines.append(f"### Precedent {i}: {p.name}  (similarity score = {p.score})")
        lines.append(f"- KB path: `{p.path}`")
        lines.append(f"- Project type: **{p.project_type or 'n/a'}**")
        lines.append(f"- Scope: {scope_str}  ({p.scope_range or 'n/a'})")
        lines.append(f"- Duration: {dur_str}")
        lines.append(f"- ZS poměr: {zs_str}")
        lines.append(f"- Status: {p.status or 'n/a'}")
        if p.summary_lines:
            lines.append("- Klíčová fakta:")
            for s in p.summary_lines[:5]:
                lines.append(f"  - {s}")
        lines.append("")
    lines.append("---")
    return "\n".join(lines)
