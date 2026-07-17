"""Dotazy na projektanta — třetí kategorie nálezů (element 24, task v2.1 §2.11).

Rozpor mezi zdroji jednoho projektu (TZ ↔ výkres ↔ výkaz) NENÍ chyba enginu
ani automaticky chyba projektu — je to DOTAZ NA PROJEKTANTA, běžná realita
dokumentace (typicky třída betonu: TZ C25/30 vs. legenda výkresu C20/25).

Tři úrovně nálezů (AC15):
  * otazka_na_projektanta — rozpor mezi RŮZNÝMI zdroji (TZ vs. výkres)
  * sloppy_wording        — nedbalá formulace, upřesní RDS (Pattern 53:
                            katalogové DO-pásmo «do C40/50» obsahující
                            projektovou třídu C35/45 NENÍ rozpor)
  * chyba_v_dokumentaci   — JEDEN zdroj si protiřečí sám sobě

Engine rozpory DETEKUJE a REPORTUJE; nikdy je tiše neřeší volbou jednoho
zdroje — u oceněného rozporu počítá OBĚ varianty a cenovou deltu v CZK
(OTSKP DB). Neznámá/nečitelná hodnota = ticho (žádný guess).

Pure detector — no I/O. The OTSKP price-delta helper has a monkeypatchable
seam (_FIND_OTSKP) mirroring the module-level-seam convention (extract_tz_fields
_LLM; MCP authoring rules: no Callable in tool signatures).
"""
from __future__ import annotations

import logging
import re
from typing import Any, Optional

logger = logging.getLogger(__name__)

LEVEL_OTAZKA = "otazka_na_projektanta"
LEVEL_SLOPPY = "sloppy_wording"
LEVEL_CHYBA = "chyba_v_dokumentaci"

# ČSN EN 206 class, e.g. C25/30, LC30/33. Tolerates spacing variants.
_CLASS_RE = re.compile(r"\b(L?C)\s*(\d{2,3})\s*/\s*(\d{2,3})\b", re.IGNORECASE)
# Katalogové DO-pásmo («Z BET DO C40/50» je pásmo, ne třída — Pattern 53).
_DO_BAND_RE = re.compile(r"\bdo\s+L?C\s*\d{2,3}\s*/\s*\d{2,3}\b", re.IGNORECASE)


def normalize_concrete_class(value: Any) -> Optional[str]:
    """Canonical 'C25/30' / 'LC30/33' from a free-form claim value, or None.

    None = nečitelná hodnota → ticho (unknown documentation is silent, §2.11);
    the caller must NOT turn an unparseable claim into a finding.
    """
    if not isinstance(value, str):
        return None
    m = _CLASS_RE.search(value)
    if not m:
        return None
    return f"{m.group(1).upper()}{int(m.group(2))}/{int(m.group(3))}"


def _cube_strength(normalized: str) -> int:
    m = _CLASS_RE.search(normalized)
    return int(m.group(2)) if m else 0


def detect_concrete_class_findings(claims: list[dict]) -> list[dict]:
    """Classify concrete-class claims from project sources into §2.11 findings.

    Each claim: {source_document, anchor, concrete_class} — source_document is
    the document identity ('TZ', 'výkres D.4.2', 'výkaz'), anchor the page/field
    citation, concrete_class the VERBATIM value as written in that source.

    Returns a list of findings (possibly empty — agreement or unreadable
    values are SILENT). A finding carries level, the verbatim sources, and
    the distinct normalized classes (for the caller's variant calculation).
    Never resolves the conflict — reporting only.
    """
    findings: list[dict] = []

    parsed = []
    for c in claims or []:
        if not isinstance(c, dict):
            continue
        raw = c.get("concrete_class")
        norm = normalize_concrete_class(raw)
        if norm is None:
            continue  # nečitelné = ticho, žádný guess
        parsed.append({
            "source_document": c.get("source_document") or "neznámý zdroj",
            "anchor": c.get("anchor"),
            "concrete_class": raw,
            "normalized_class": norm,
            "is_band": bool(isinstance(raw, str) and _DO_BAND_RE.search(raw)),
        })

    if len(parsed) < 2:
        return findings

    bands = [p for p in parsed if p["is_band"]]
    specifics = [p for p in parsed if not p["is_band"]]

    # Pattern 53: DO-pásmo obsahující projektovou třídu = sloppy wording,
    # nikdy oceněný rozpor. Třída NAD pásmem je skutečný rozpor (otazka).
    for band in bands:
        band_max = _cube_strength(band["normalized_class"])
        for spec in specifics:
            spec_cube = _cube_strength(spec["normalized_class"])
            if spec_cube <= band_max:
                if spec["normalized_class"] != band["normalized_class"]:
                    findings.append({
                        "level": LEVEL_SLOPPY,
                        "field": "concrete_class",
                        "sources": [_citace(band), _citace(spec)],
                        "classes": sorted({band["normalized_class"], spec["normalized_class"]}),
                        "message_cs": (
                            f"Katalogové pásmo „{band['concrete_class']}“ "
                            f"({band['source_document']}) je DO-pásmo, ne třída — "
                            f"projektová třída {spec['normalized_class']} "
                            f"({spec['source_document']}) leží uvnitř pásma. "
                            "Nedbalá formulace, upřesní RDS; není to oceněný rozpor."
                        ),
                    })
            else:
                findings.append({
                    "level": LEVEL_OTAZKA,
                    "field": "concrete_class",
                    "sources": [_citace(band), _citace(spec)],
                    "classes": sorted({band["normalized_class"], spec["normalized_class"]}),
                    "message_cs": (
                        f"Třída {spec['normalized_class']} ({spec['source_document']}) "
                        f"převyšuje katalogové pásmo „{band['concrete_class']}“ "
                        f"({band['source_document']}). Dotaz na projektanta — "
                        "kalkulátor počítá obě varianty, žádnou tiše nevybírá."
                    ),
                })

    # Specifické třídy: rozpor mezi zdroji / uvnitř jednoho zdroje.
    distinct = sorted({p["normalized_class"] for p in specifics})
    if len(distinct) >= 2:
        by_doc: dict[str, set] = {}
        for p in specifics:
            by_doc.setdefault(p["source_document"], set()).add(p["normalized_class"])
        internal = [doc for doc, cls in by_doc.items() if len(cls) >= 2]

        level = LEVEL_CHYBA if internal else LEVEL_OTAZKA
        if internal:
            message = (
                f"Zdroj {', '.join(internal)} si protiřečí sám sobě "
                f"(třídy {', '.join(distinct)}). Chyba v dokumentaci — "
                "kalkulátor počítá všechny varianty, žádnou tiše nevybírá."
            )
        else:
            docs = ", ".join(sorted(by_doc))
            message = (
                f"Rozpor tříd betonu mezi zdroji ({docs}): {', '.join(distinct)}. "
                "Dotaz na projektanta — kalkulátor počítá obě varianty, "
                "žádnou tiše nevybírá."
            )
        findings.append({
            "level": level,
            "field": "concrete_class",
            "sources": [_citace(p) for p in specifics],
            "classes": distinct,
            "message_cs": message,
        })

    return findings


def _citace(p: dict) -> dict:
    """Citation with BOTH the verbatim value and the anchor (§2.11: každý
    nález = citace zdrojů s kotvou dokument + strana/pole)."""
    return {
        "source_document": p["source_document"],
        "anchor": p["anchor"],
        "concrete_class": p["concrete_class"],
        "normalized_class": p["normalized_class"],
    }


# ── Cenová delta přes OTSKP DB (§2.11: kde je rozpor oceněný) ─────────────────

async def _default_find_otskp(query: str, max_results: int = 5) -> dict:
    from app.mcp.tools.otskp import find_otskp_code

    return await find_otskp_code(query, max_results=max_results)


# Module-level seam — tests monkeypatch this (never a Callable tool param).
_FIND_OTSKP = _default_find_otskp

# Same binding floor discipline as breakdown catalog-binding: below the floor
# there is no reliable item, and a delta from an unreliable item would be the
# sebevědomě-špatně class — honest None instead.
_DELTA_BINDING_FLOOR = 0.5


async def concrete_class_delta_czk(
    class_a: str,
    class_b: str,
    volume_m3: Optional[float],
    element_type: str,
) -> dict:
    """CZK delta between two concrete-class variants, priced from the OTSKP DB.

    Looks up the beton item per class with the SAME canonical query the
    breakdown catalog-binding uses (verb + element noun), extended by the
    class. delta = (unit_price(b) − unit_price(a)) × volume. Any leg missing
    (no reliable OTSKP item, missing volume) → cena_delta_czk=None + reason —
    honest-fail, never a fabricated number.
    """
    from app.mcp.tools.breakdown import _canonical_query

    base_query = _canonical_query("beton", element_type)
    if base_query is None:
        # Review 2026-07-17 finding 3: _canonical_query now returns None for a
        # polluted label-fallback type — WITHOUT this guard the f-string below
        # would issue the literal query "None C30/37" and could fabricate a
        # delta from a nonsense item (the exact class the floor hardening kills).
        return {
            "class_a": class_a,
            "class_b": class_b,
            "cena_delta_czk": None,
            "reason": (
                "typ nemá kanonické katalogové substantivum (zamusořený "
                "label-fallback) — delta se neoceňuje, ověřte ručně"
            ),
        }

    async def _unit_price(cls: str) -> Optional[dict]:
        result = await _FIND_OTSKP(f"{base_query} {cls}", max_results=5)
        candidates = (result or {}).get("results") or []
        top = candidates[0] if candidates else None
        if not top or (top.get("confidence") or 0.0) < _DELTA_BINDING_FLOOR:
            return None
        if top.get("unit_price_czk") is None:
            return None
        return top

    out: dict = {
        "class_a": class_a,
        "class_b": class_b,
        "cena_delta_czk": None,
        "reason": None,
    }

    if not volume_m3 or volume_m3 <= 0:
        out["reason"] = "chybí objem betonu (volume_m3) — delta se neoceňuje"
        return out

    top_a = await _unit_price(class_a)
    top_b = await _unit_price(class_b)
    if top_a is None or top_b is None:
        missing = [c for c, t in ((class_a, top_a), (class_b, top_b)) if t is None]
        out["reason"] = (
            f"v OTSKP nenalezena spolehlivá položka betonu pro {', '.join(missing)} "
            "— delta se nefabrikuje, ověřte ručně"
        )
        return out

    delta = round((top_b["unit_price_czk"] - top_a["unit_price_czk"]) * volume_m3, 0)
    out["cena_delta_czk"] = delta
    out["delta_formula"] = (
        f"({top_b['unit_price_czk']} − {top_a['unit_price_czk']}) Kč/m³ "
        f"× {volume_m3} m³ = {delta} Kč ({class_b} vs {class_a})"
    )
    out["otskp_items"] = {
        class_a: {"code": top_a.get("code"), "unit_price_czk": top_a.get("unit_price_czk")},
        class_b: {"code": top_b.get("code"), "unit_price_czk": top_b.get("unit_price_czk")},
    }
    return out
