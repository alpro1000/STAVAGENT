"""Common helpers for kapitola item builders."""
from __future__ import annotations

from typing import Any

from .item_schema import (
    Item, SUBDOD_BY_KAPITOLA, URS_PREFIX_BY_KAPITOLA,
    default_so_for_kapitola, validate,
)
from .urs_lookup import UrsIndex, categorize_match, confidence_for


def build_item(
    *,
    seq: int,
    kapitola: str,
    popis: str,
    mj: str,
    mnozstvi: float,
    source: str,
    raw_description: str,
    qty_formula: str,
    vyjasneni_refs: list[str] | None = None,
    status_flag: str | None = None,
    data_source: str = "TZ+DXF",
    completeness: float = 1.0,
    so: str | None = None,
    subdod: str | None = None,
    custom_rpol: bool = False,
    id_prefix: str | None = None,
) -> Item:
    """Construct an Item with URS fields left blank (to be filled by matcher).

    ``custom_rpol=True`` produces Rpol-NNN id and pre-populates urs_status='custom_item'.
    """
    if custom_rpol:
        iid = f"Rpol-{seq:03d}"
        urs_status = "custom_item"
        score = 0.0
    else:
        prefix = id_prefix or kapitola
        iid = f"{prefix}-{seq:03d}"
        urs_status = "needs_review"  # default until matcher runs
        score = 0.0

    return Item(
        id=iid,
        kapitola=kapitola,
        SO=so or default_so_for_kapitola(kapitola),
        popis=popis,
        mj=mj,
        mnozstvi=round(mnozstvi, 3),
        urs_code=None,
        urs_alternatives=[],
        urs_status=urs_status,
        urs_match_score=score,
        skladba_ref=None,
        source=source,
        raw_description=raw_description,
        confidence=confidence_for(urs_status),
        subdodavatel_chapter=subdod or SUBDOD_BY_KAPITOLA.get(kapitola, "GD_provoz"),
        _vyjasneni_ref=vyjasneni_refs or [],
        _status_flag=status_flag,
        _data_source=data_source,
        _completeness=completeness,
        _qty_formula=qty_formula,
        _export_wrapper_hint=None,
    )


def apply_urs_lookup(items: list[Item], idx: UrsIndex) -> None:
    """Run URS matching against every non-custom item, populate code + alternatives + confidence in place."""
    for item in items:
        if item.urs_status == "custom_item":
            # Custom Rpol-NNN items skip URS catalog lookup
            continue
        prefix = URS_PREFIX_BY_KAPITOLA.get(item.kapitola)
        # First pass with prefix hint
        matches = idx.lookup(item.popis, kapitola_prefix_hint=prefix, top_n=3)
        # Second pass without prefix for broader recall if top score is weak
        if not matches or matches[0].score < 0.50:
            broad = idx.lookup(item.popis, kapitola_prefix_hint=None, top_n=3)
            # merge unique by code, keep highest score
            seen: dict[str, Any] = {m.code: m for m in matches}
            for m in broad:
                if m.code not in seen or m.score > seen[m.code].score:
                    seen[m.code] = m
            matches = sorted(seen.values(), key=lambda m: m.score, reverse=True)[:3]

        if not matches:
            item.urs_status = "needs_review"
            item.urs_match_score = 0.0
            item.confidence = confidence_for("needs_review")
            continue

        top = matches[0]
        item.urs_status = categorize_match(top.score)
        item.urs_match_score = top.score
        item.urs_alternatives = [
            {"code": m.code, "score": m.score, "tokens": " ".join(m.tokens[:8])}
            for m in matches
        ]
        if item.urs_status in ("matched_high", "matched_medium"):
            item.urs_code = top.code
        item.confidence = confidence_for(item.urs_status)


def validate_all(items: list[Item]) -> tuple[int, list[tuple[str, list[str]]]]:
    """Return (valid_count, list_of_(id, errors) for failures)."""
    failures = []
    ok = 0
    for it in items:
        errs = validate(it)
        if errs:
            failures.append((it.id, errs))
        else:
            ok += 1
    return ok, failures
