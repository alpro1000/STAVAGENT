"""
Position Grouper — deterministic linking of beton + armatura + opalubka.

For each concrete position (unit m³, concrete class in description):
1. Check if "vč. bednění" / "vč. výztuže" → mark as included, no separate link
2. Scan next 3-5 positions for rebar (t/kg) and formwork (m²) candidates
3. Link candidates to the concrete position as group members

Algorithm is strictly deterministic — regex only, no AI.
Runs once after bulk import. Results stored in CoreMetadata.

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-28
"""

import logging
import re
from typing import Optional

from app.models.item_schemas import ProjectItem

logger = logging.getLogger(__name__)

# ── Regex patterns ───────────────────────────────────────────────────────────

# Concrete class detection: C20/25, C30/37, C35/45, C40/50, etc.
_CONCRETE_CLASS_RE = re.compile(
    r"\bC\s*(\d{2})\s*/\s*(\d{2})\b",
    re.IGNORECASE,
)

# Inclusion markers: "vč. bednění", "včetně výztuže", etc.
_INCLUDE_FORMWORK_RE = re.compile(
    r"v[čc](?:etně|\.)\s*bedn[eě]n[ií]",
    re.IGNORECASE,
)
_INCLUDE_REBAR_RE = re.compile(
    r"v[čc](?:etně|\.)\s*v[ýy]ztu[žz][eě]",
    re.IGNORECASE,
)

# Rebar keywords in description
_REBAR_KEYWORDS = re.compile(
    r"v[ýy]ztu[žz]|armatura|ocel\s+betonářská|B500|ocelové\s+pruty|kari\s+sít",
    re.IGNORECASE,
)

# Formwork keywords in description
_FORMWORK_KEYWORDS = re.compile(
    r"bedn[eě]n[ií]|šalov[áa]n[ií]|odbedněn[ií]",
    re.IGNORECASE,
)

# Units
_CONCRETE_UNITS = {"m³", "m3", "M3"}
_REBAR_UNITS = {"t", "kg", "T", "KG"}
_FORMWORK_UNITS = {"m²", "m2", "M2"}

# Max positions to scan after a concrete position
_SCAN_WINDOW = 5


# ── Public API ───────────────────────────────────────────────────────────────

def group_positions(items: list[ProjectItem]) -> list[ProjectItem]:
    """
    Group related positions: beton + armatura + opalubka.

    Modifies items in-place (sets core.group_* fields).
    Returns the same list with updated grouping metadata.
    """
    # Phase 1: Identify concrete positions
    concrete_indices: list[int] = []
    for i, item in enumerate(items):
        if _is_concrete(item):
            item.core.group_role = "beton"
            item.core.group_members = []

            # Check inclusion markers
            popis = _get_popis(item)
            if _INCLUDE_REBAR_RE.search(popis):
                item.core.armatura_included = True
            if _INCLUDE_FORMWORK_RE.search(popis):
                item.core.opalubka_included = True

            concrete_indices.append(i)

    # Phase 2: For each concrete position, scan next positions for candidates
    for ci in concrete_indices:
        beton = items[ci]
        beton_popis = _get_popis(beton)
        beton_words = _extract_keywords(beton_popis)

        # Scan window: next _SCAN_WINDOW positions, stop at next concrete
        end = min(ci + _SCAN_WINDOW + 1, len(items))
        for j in range(ci + 1, end):
            candidate = items[j]

            # Stop at next concrete position or next section
            if _is_concrete(candidate):
                break
            if candidate.core.group_role is not None:
                continue  # Already linked to another group

            cand_popis = _get_popis(candidate)
            cand_mj = _get_unit(candidate)

            # Check for rebar candidate
            if (not beton.core.armatura_included
                    and cand_mj in _REBAR_UNITS
                    and _is_rebar_candidate(cand_popis, beton_words)):
                candidate.core.group_role = "armatura"
                candidate.core.group_leader_id = beton.item_id
                beton.core.group_members.append(candidate.item_id)
                logger.debug(f"[Grouper] Linked rebar {candidate.item_id} → {beton.item_id}")
                continue

            # Check for formwork candidate
            if (not beton.core.opalubka_included
                    and cand_mj in _FORMWORK_UNITS
                    and _is_formwork_candidate(cand_popis, beton_words)):
                candidate.core.group_role = "opalubka"
                candidate.core.group_leader_id = beton.item_id
                beton.core.group_members.append(candidate.item_id)
                logger.debug(f"[Grouper] Linked formwork {candidate.item_id} → {beton.item_id}")
                continue

    # Stats
    grouped_count = sum(1 for it in items if it.core.group_role == "beton" and it.core.group_members)
    rebar_count = sum(1 for it in items if it.core.group_role == "armatura")
    formwork_count = sum(1 for it in items if it.core.group_role == "opalubka")
    included_rebar = sum(1 for it in items if it.core.armatura_included)
    included_formwork = sum(1 for it in items if it.core.opalubka_included)

    logger.info(
        f"[Grouper] {len(concrete_indices)} concrete positions, "
        f"{grouped_count} with linked members, "
        f"{rebar_count} rebar linked, {formwork_count} formwork linked, "
        f"{included_rebar} with included rebar, {included_formwork} with included formwork"
    )

    return items


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_popis(item: ProjectItem) -> str:
    """Get description from estimate block."""
    return (item.estimate.popis or "") + " " + (item.estimate.popis_detail or "")


def _get_unit(item: ProjectItem) -> str:
    """Get unit from estimate block."""
    return (item.estimate.mj or "").strip()


def _is_concrete(item: ProjectItem) -> bool:
    """Check if item is a concrete position: unit m³ + concrete class in description."""
    mj = _get_unit(item)
    if mj not in _CONCRETE_UNITS:
        return False
    popis = _get_popis(item)
    return bool(_CONCRETE_CLASS_RE.search(popis))


def _extract_keywords(text: str) -> set[str]:
    """Extract significant words from description for matching."""
    # Remove common Czech construction filler words
    text = text.lower()
    # Split into words, keep only 4+ char words
    words = set()
    for w in re.split(r"[\s,;.:()\[\]{}\"\']+", text):
        w = w.strip()
        if len(w) >= 4 and w not in _STOP_WORDS:
            words.add(w)
    return words


def _is_rebar_candidate(popis: str, beton_words: set[str]) -> bool:
    """Check if description matches rebar pattern + shares words with concrete."""
    if not _REBAR_KEYWORDS.search(popis):
        return False
    # Check for shared context words (e.g., "stěn" in both)
    cand_words = _extract_keywords(popis)
    shared = beton_words & cand_words
    # At least one shared word OR rebar keyword is strong enough
    return len(shared) >= 1 or bool(_REBAR_KEYWORDS.search(popis))


def _is_formwork_candidate(popis: str, beton_words: set[str]) -> bool:
    """Check if description matches formwork pattern + shares words with concrete."""
    if not _FORMWORK_KEYWORDS.search(popis):
        return False
    cand_words = _extract_keywords(popis)
    shared = beton_words & cand_words
    return len(shared) >= 1 or bool(_FORMWORK_KEYWORDS.search(popis))


# Czech stop words for construction descriptions
_STOP_WORDS = {
    "beton", "betonu", "betonový", "betonová", "betonové",
    "prostý", "prostého", "železo", "železový",
    "třídy", "třída", "tloušťky", "tloušťka",
    "včetně", "práce", "prací", "stavba", "stavby",
    "materiálu", "materiál", "montáž", "montáže",
    "cena", "ceny", "celkem", "celková",
    "výška", "výšky", "délka", "délky", "šířka", "šířky",
    "příp", "resp", "event", "popř",
    "položka", "položky",
}
