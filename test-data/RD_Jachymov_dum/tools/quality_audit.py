#!/usr/bin/env python3
"""
Position-by-position quality audit — 5 dimensions per item.

Pragmatic flags-only worksheet (NO auto-fix). Goal: ~50-100 actionable flags
for human review, not noise.

Dimensions:
  1. Popis terminology   — detect RU loanwords, mixed styles, non-URS terms
  2. MJ-qty sanity       — popis describes work-type that should match the MJ
  3. URS family ↔ kapitola — first digit of urs_code_proposed should match
                              the chapter family (HSV-1 → 1xx, HSV-2 → 2xx, …)
  4. Subdodavatel logical — kapitola → expected subdodavatel set
  5. Confidence appropriate — source-text signal → expected confidence band

Output:
  outputs/items_quality_audit.json  — structured per-issue
  outputs/items_quality_report.md   — human worksheet
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

PROJ = Path(__file__).resolve().parent.parent
ITEMS = PROJ / "outputs" / "items_rd_jachymov_complete.json"
OUT_JSON = PROJ / "outputs" / "items_quality_audit.json"
OUT_MD = PROJ / "outputs" / "items_quality_report.md"

TODAY = str(date.today())


def strip_dia(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s or "") if not unicodedata.combining(c))


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", strip_dia(s).lower()).strip()


# ──────────────────────────────────────────────────────────────────────────────
# Dimension 1 — Popis terminology
# ──────────────────────────────────────────────────────────────────────────────
# Known RU loanwords / non-Czech construction terms that should never appear
SUSPECT_TERMS = [
    (re.compile(r"\bfigur[ay]\b", re.IGNORECASE),
     "'figura' RU loan — use 'jám' (TKP 131) or 'rýh' (TKP 132)"),
    (re.compile(r"\boчистk", re.IGNORECASE),
     "Cyrillic letters — non-Czech text"),
    (re.compile(r"\bprovedení(?=\s+(?:dozdívek|vyzdění|zdiva))", re.IGNORECASE),
     "Verbose 'provedení X' construct — URS catalog prefers direct verb-noun"),
    (re.compile(r"\bzhotoven[íi]\b(?=\s+(?:zdiva|stěn|příček))", re.IGNORECASE),
     "Verbose 'zhotovení X' — URS prefers 'vyzdění X'"),
]


def check_popis_terminology(it: dict) -> list[dict]:
    flags = []
    popis = it.get("popis", "")
    for pat, why in SUSPECT_TERMS:
        m = pat.search(popis)
        if m:
            flags.append({
                "dimension": "popis_terminology",
                "severity": "medium",
                "matched": m.group(0),
                "reason": why,
            })
    # Detect mixed Czech/Russian fragments via cyrillic presence
    if re.search(r"[А-Яа-я]", popis):
        flags.append({
            "dimension": "popis_terminology",
            "severity": "high",
            "matched": "Cyrillic char present",
            "reason": "Non-Czech text — replace with Czech URS standard term",
        })
    # Detect ellipsis / "..." style placeholders
    if "..." in popis or "…" in popis or "TBD" in popis.upper():
        flags.append({
            "dimension": "popis_terminology",
            "severity": "medium",
            "matched": "ellipsis / TBD",
            "reason": "Placeholder text — must be resolved before tender",
        })
    return flags


# ──────────────────────────────────────────────────────────────────────────────
# Dimension 2 — MJ-qty sanity
# ──────────────────────────────────────────────────────────────────────────────
# Maps keywords found in popis → expected MJ category
# Format: (keyword_regex, expected_mj_set, description)
MJ_RULES = [
    # ── PRIMARY-NOUN rules (anchored to popis start — strongest signal) ────
    (re.compile(r"^Špalet", re.IGNORECASE), {"bm", "m", "m²", "m2"},
     "Špalety → bm (perimeter) or m² (plocha) per ÚRS leaf"),
    (re.compile(r"^Hydroiz\w+\s+stěrk|^Stěrk\w+\s+hydroiz", re.IGNORECASE), {"m²", "m2"},
     "Hydroizolační stěrka → m² (plocha aplikace)"),
    # Žaluzie: pattern matches anywhere — žaluzie always counted in ks/kpl regardless of position in popis
    (re.compile(r"\bžaluzi\w*\b", re.IGNORECASE), {"ks", "kpl"},
     "Žaluzie → ks/kpl (discrete items, never m²/bm)"),
    (re.compile(r"^Rozvod\w*\s+(?:vod|kanal|otopn|topn|Cu|PEX|teplé|studené)", re.IGNORECASE), {"bm", "m"},
     "Rozvody (vodovod/kanalizace/topení) → bm"),
    (re.compile(r"^Soklík\w*|^Sokl\b(?!\s+XPS|\s+ETICS)", re.IGNORECASE), {"bm", "m"},
     "Soklíky (podlahové) → bm"),
    (re.compile(r"^Bourání\b|^Demont", re.IGNORECASE), {"m³", "m3", "m²", "m2", "ks", "t", "kpl"},
     "Bourání/demontáž → varies (m³ pro objem, m² pro plochu, ks pro kus); flag only obviously wrong"),
    (re.compile(r"^Patk\w+|^Patka\b", re.IGNORECASE), {"ks", "kpl", "m³", "m3"},
     "Patky → ks (discrete) nebo m³ (objem betonu)"),
    (re.compile(r"^Ocelov\w+\s+(?:vazni|sloupk|stropni|trám)|^IPE\b|^HEA\b|^IPN\b|^Jekl", re.IGNORECASE), {"kg", "t", "bm", "m"},
     "Ocelové konstrukce → kg/t (weight) or bm (length)"),
    (re.compile(r"^Bedněn\w+", re.IGNORECASE), {"m²", "m2"},
     "Bednění → m²"),
    (re.compile(r"^Výztuž|^Kari\s+síť", re.IGNORECASE), {"kg", "t"},
     "Výztuž / kari síť → kg/t"),

    # ── SECONDARY rules (substring match anywhere in popis) ────────────────
    # 3D — volume
    (re.compile(r"\bbeton\s+C\s*\d{1,2}/\d{1,2}|\bbeton\s+tř\.\s+C", re.IGNORECASE), {"m³", "m3", "ks", "kpl"},
     "Beton s explicit class (C25/30 etc.) → typically m³; ks/kpl acceptable pro discrete patky"),
    (re.compile(r"\bhloubení\s+(?:rýh|jam|zápatí)|\bvýkop\s+\w+", re.IGNORECASE), {"m³", "m3"},
     "hloubení rýh/jam / výkop → m³ (NOTE: pažení výkopů je m²)"),
    (re.compile(r"\bornic\w+\b", re.IGNORECASE), {"m³", "m3", "m²", "m2", "ha"},
     "ornice → m³ nebo m² (per ÚRS varianty)"),
    # štěrk lože/násyp/podsyp — only if NOT compound with terasa/dvorek/dlažba (those are m² install)
    (re.compile(r"^štěrk\w+\s+(?:lože|násyp|podsyp)|^zhutněn\w+\s+štěrk", re.IGNORECASE), {"m³", "m3"},
     "štěrkopískové lože / násyp (samostatná položka) → m³"),
    (re.compile(r"\bvodorovn[éý]\s+přemístění\b|\bodvoz\s+výkop", re.IGNORECASE), {"m³", "m3"},
     "přemístění výkopku → m³"),
    # 2D — area (only when popis explicitly about nášlap/podlaha + material)
    (re.compile(r"\bnášlapn\w+\s+vrstv\w*\s+(?:vinyl|laminát|biodesk)|^Nášlapn", re.IGNORECASE), {"m²", "m2"},
     "nášlapná vrstva → m²"),
    (re.compile(r"\bobklad\s+keramick|\bdlažb\w+\s+keramick.*lepen", re.IGNORECASE), {"m²", "m2"},
     "keramický obklad / lepená dlažba → m²"),
    (re.compile(r"\b(?:obklad\w*|štuk\w+|omítk\w+|tenkovrstv|výmalb)\b", re.IGNORECASE), {"m²", "m2"},
     "povrchová úprava → m²"),
    (re.compile(r"\bETICS\b|\bzateplen[íi]\b|\bEPS\s+\d", re.IGNORECASE), {"m²", "m2"},
     "ETICS / EPS plocha → m²"),
    (re.compile(r"\bbedněn\w+\s+(?:z\s+prken|z\s+desek|krov)", re.IGNORECASE), {"m²", "m2"},
     "bednění z prken/desek → m²"),
    (re.compile(r"\bhydroizolac\w*\b|\bseparační\s+folie|izolace\s+PE", re.IGNORECASE), {"m²", "m2"},
     "hydroizolace / fólie → m²"),
    (re.compile(r"\b(?:SDK\s+podhled|sádrokarton\w+\s+podhled)\b", re.IGNORECASE), {"m²", "m2"},
     "SDK podhled → m²"),
    (re.compile(r"\btepelná\s+izolace\b|\bizolace\s+(?:střech|podlah|krov)", re.IGNORECASE), {"m²", "m2"},
     "tepelná izolace → m²"),
    # 1D — linear
    (re.compile(r"\b(?:rozvod\w*\s+(?:vod|kanal|topen)|potrubí\b)", re.IGNORECASE), {"bm", "m"},
     "rozvody / potrubí → bm"),
    (re.compile(r"\b(?:soklík\w*|lišty\b)", re.IGNORECASE), {"bm", "m"},
     "soklíky / lišty → bm"),
    # Krov prvky → bm, BUT only when popis primary noun is the prvek (NOT "desky NAD kleštinami" etc.)
    (re.compile(r"^Krokv\w*|^Kleštin\w*|^Pozednic\w*|^Vazni\w+", re.IGNORECASE), {"bm", "m"},
     "Krov prvek jako primary noun → bm"),
    (re.compile(r"\bvěnec\b|\bpřeklad\w*", re.IGNORECASE), {"bm", "m", "m³", "m3", "ks", "kpl"},
     "věnec / překlad → bm / m³ / ks / kpl (per leaf — kpl acceptable pro maltové uložení / kompozitní)"),
    (re.compile(r"\bšpalet\w*\b", re.IGNORECASE), {"bm", "m", "m²", "m2"},
     "špalety → bm (perimeter) nebo m² (plocha)"),
    # ks/kpl — discrete
    (re.compile(r"^Okno\b|plastov[áé]\s+okn", re.IGNORECASE), {"ks"},
     "okno → ks"),
    (re.compile(r"\b(?:vstupní|vnitřní)\s+dveř", re.IGNORECASE), {"ks"},
     "dveře → ks"),
    (re.compile(r"\bWC\b\s+(?:kombi|keramick|závěs|závesn|s\s+nádr)", re.IGNORECASE), {"ks", "kpl"},
     "WC → ks/kpl"),
    (re.compile(r"\bumyvadl\w*\b|\bvana\s+koupeln|\bsprchov[ýé]\s+kout", re.IGNORECASE), {"ks", "kpl"},
     "sanitární keramika → ks/kpl"),
    (re.compile(r"\bdřez\b|\bbaterie\b", re.IGNORECASE), {"ks", "kpl"},
     "dřez / baterie → ks/kpl"),
    (re.compile(r"\bradiator\w*|\bradiátor\w*", re.IGNORECASE), {"ks", "kpl"},
     "radiátor → ks/kpl"),
    (re.compile(r"\b(?:kotel|krb|kamna|tepelné\s+čerpadlo|bojler)\b", re.IGNORECASE), {"ks", "kpl"},
     "tepelný zdroj → ks/kpl"),
    # kg/t — weight
    (re.compile(r"\b(?:výztuž|kari\s*síť|žebrov\w+\s+výztuž)\b", re.IGNORECASE), {"kg", "t"},
     "výztuž → kg/t"),
]


def check_mj_qty(it: dict) -> list[dict]:
    flags = []
    popis = it.get("popis", "")
    mj = it.get("mj", "")
    for pat, expected_set, desc in MJ_RULES:
        if pat.search(popis):
            if mj not in expected_set:
                flags.append({
                    "dimension": "mj_qty_sanity",
                    "severity": "high",
                    "current_mj": mj,
                    "expected_mj_set": sorted(expected_set),
                    "matched_keyword": pat.pattern[:50],
                    "reason": f"Popis contains pattern → expected MJ ∈ {sorted(expected_set)} — got '{mj}'. {desc}",
                })
            return flags  # Only flag first matching rule
    return flags


# ──────────────────────────────────────────────────────────────────────────────
# Dimension 3 — URS family ↔ kapitola consistency
# ──────────────────────────────────────────────────────────────────────────────
# kapitola_prefix → expected URS code first-digit set
KAPITOLA_TO_URS_FAMILY = {
    "HSV-1": {"1"},                  # zemní
    "HSV-2": {"2", "3"},             # základy (TKP 271/273/274) — 2xx + 3xx (310-313 nadzákladové)
    "HSV-3": {"3"},                  # svislé (TKP 311-317, 342)
    "HSV-4": {"4"},                  # vodorovné (TKP 411-413, 431)
    "HSV-5": {"7", "5", "6"},        # krov (762) + krytina (765) + klempíř (764) — straddles families
    "HSV-6": {"9", "7"},             # bourání (96x, 97x, 98x), demontáž (76x demontáž tag)
    "HSV-7": {"6", "7"},             # ETICS (622) + sokl (622) + omítka fasádní (612 / 7xx)
    "PSV-71": {"7"},                 # 711-715
    "PSV-72": {"7"},                 # 721-725
    "PSV-73": {"7"},                 # 731-735
    "PSV-76": {"7", "6"},            # 761-767 + někdy 6xx (611 zámeč)
    "PSV-77": {"7", "5", "9"},       # 771-776 + někdy 596 (chodník) for terén
    "PSV-78": {"7", "6"},            # 781-784 + 612 (omítka štuková)
    "PSV-95": {"3", "0"},            # detekce požární (M-3xx, 03x)
    "M-21":   {"2", "0", "7"},       # silnoproud — různě (210, 070, 740)
    "VRN":    {"0", "9"},            # VRN 0xx, 9xx
}


def check_urs_family(it: dict) -> list[dict]:
    flags = []
    code = it.get("urs_code_proposed") or it.get("urs_code_family_6digit")
    kapitola = it.get("kapitola", "")
    kap_prefix = kapitola.split()[0] if kapitola else ""
    expected = KAPITOLA_TO_URS_FAMILY.get(kap_prefix)
    if not code or not expected:
        return flags
    first_digit = str(code)[0]
    if first_digit not in expected:
        flags.append({
            "dimension": "urs_family_consistency",
            "severity": "informational",
            "kapitola": kap_prefix,
            "urs_code": code,
            "first_digit": first_digit,
            "expected_first_digits": sorted(expected),
            "reason": (
                f"URS kód {code} prvních digit '{first_digit}' neodpovídá {kap_prefix} expected {sorted(expected)} — "
                f"likely cross-category položka per Corpus Pattern 04 (workflow gate ≠ catalog kapitola). "
                f"Example: 'Anglický dvorek dlažba' v HSV-1 chapter má kód 564 (TKP dlažba) — legitimate. Verify."
            ),
        })
    return flags


# ──────────────────────────────────────────────────────────────────────────────
# Dimension 4 — Subdodavatel logical match
# ──────────────────────────────────────────────────────────────────────────────
# kapitola → expected subdodavatel set (loose — multiple trades may cover one kapitola)
KAPITOLA_TO_SUBDOD = {
    "HSV-1": {"zemni_prace", "VRN_management"},
    "HSV-2": {"zelezobetonarsky_specialny", "zednik", "bila_vana_csb02", "bednici_tesar",
              "izolater_HI", "podlahar", "prefa_bloky_specialista"},
    "HSV-3": {"zednik", "prefa_bloky_specialista", "ocel_zamecnik_konstrukce"},
    "HSV-4": {"zelezobetonarsky_specialny", "ocelobeton_strop_IPE_trapez", "krov_tesarsky_kompletni",
              "ocel_zamecnik_konstrukce", "podlahar", "zednik"},
    "HSV-5": {"krov_tesarsky_kompletni", "plech_falcovany_hlinik", "klempir",
              "izolater_TI", "biodeska_konstrukcni"},
    "HSV-6": {"bourani_demolice", "mykolog", "azbestovy_specialista"},
    "HSV-7": {"fasadnik_etics", "klempir"},
    "PSV-71": {"izolater_HI", "izolater_TI", "obkladac"},
    "PSV-72": {"vodar", "instalater_TUV_akumulacni_zasobnik"},
    "PSV-73": {"topenar", "kominik", "specialista_TC_multisplit", "vodar",
               "instalater_TUV_akumulacni_zasobnik"},
    "PSV-76": {"okennar", "klempir", "truhlar", "zamecnik_PSV", "specialista_RC3_dvere",
               "okenni_zaluzie_kastlik_purenit"},
    "PSV-77": {"podlahar", "obkladac"},
    "PSV-78": {"malir", "obkladac", "sadrokartonar", "zednik"},
    "PSV-95": {"elektroinstalater", "revize_specialista"},
    "M-21":   {"elektroinstalater"},
    "VRN":    {"VRN_management", "geodet", "revize_specialista", "mykolog", "azbestovy_specialista"},
}


def check_subdodavatel(it: dict) -> list[dict]:
    flags = []
    kapitola = it.get("kapitola", "")
    kap_prefix = kapitola.split()[0] if kapitola else ""
    sub = it.get("subdodavatel", "")
    expected = KAPITOLA_TO_SUBDOD.get(kap_prefix)
    if not expected or not sub:
        return flags
    if sub not in expected:
        flags.append({
            "dimension": "subdodavatel_logical",
            "severity": "informational",
            "kapitola": kap_prefix,
            "current_subdodavatel": sub,
            "expected_set": sorted(expected),
            "reason": (
                f"Subdodavatel '{sub}' neodpovídá {kap_prefix} default set — typically Pattern 04 "
                f"cross-category (e.g. HSV-1 'Anglický dvorek dlažba' executed podlahárem, ne zemními pracemi). "
                f"Verify reflects real trade assignment for this work."
            ),
        })
    return flags


# ──────────────────────────────────────────────────────────────────────────────
# Dimension 5 — Confidence appropriate for source
# ──────────────────────────────────────────────────────────────────────────────
# source text patterns → expected confidence band
SOURCE_CONFIDENCE_RULES = [
    (re.compile(r"DXF\s+DIMENSION", re.IGNORECASE), (0.93, 1.0),
     "DXF DIMENSION explicit"),
    (re.compile(r"DXF\s+INSERT\b", re.IGNORECASE), (0.85, 0.99),
     "DXF INSERT block count"),
    (re.compile(r"DXF\s+LWPOLYLINE", re.IGNORECASE), (0.85, 0.95),
     "DXF LWPOLYLINE bbox"),
    (re.compile(r"DXF\s+HATCH", re.IGNORECASE), (0.85, 0.95),
     "DXF HATCH area"),
    (re.compile(r"DXF\s+MTEXT", re.IGNORECASE), (0.80, 0.95),
     "DXF MTEXT extraction"),
    (re.compile(r"PDF\s+řez\b|řez\s+\w+-\w+\s+explicit", re.IGNORECASE), (0.90, 1.0),
     "PDF řez explicit composition"),
    (re.compile(r"TZ\s+statika.*?explicit|TZ.*?explicit", re.IGNORECASE), (0.85, 0.95),
     "TZ explicit citation"),
    (re.compile(r"regex\s+TZ|TZ.*?regex", re.IGNORECASE), (0.80, 0.90),
     "TZ regex pattern match"),
    (re.compile(r"Methvin\s+(?:empiric|standard)", re.IGNORECASE), (0.75, 0.85),
     "Methvin empirical rate"),
    (re.compile(r"geometric\s+(?:calc|deriv|inference)|geometry-from-TZ", re.IGNORECASE), (0.70, 0.85),
     "Geometric inference"),
    (re.compile(r"ČSN\s+default|silent\s+fallback|standard\s+(?:assump|RD)", re.IGNORECASE), (0.70, 0.85),
     "ČSN/standard fallback"),
    (re.compile(r"AI\s+(?:fallback|estimate|inference)", re.IGNORECASE), (0.65, 0.75),
     "AI fallback"),
]


def check_confidence(it: dict) -> list[dict]:
    flags = []
    source = it.get("source", "")
    conf = it.get("mnozstvi_confidence", 0)
    if not source or conf is None:
        return flags
    # Find first matching rule
    matched = None
    for pat, band, desc in SOURCE_CONFIDENCE_RULES:
        if pat.search(source):
            matched = (band, desc)
            break
    if not matched:
        return flags
    band, desc = matched
    lo, hi = band
    if conf < lo - 0.05 or conf > hi + 0.05:  # ±0.05 tolerance
        flags.append({
            "dimension": "confidence_appropriate",
            "severity": "low" if (conf < lo) else "informational",
            "current_confidence": conf,
            "expected_band": list(band),
            "source_signal": desc,
            "reason": f"Source signal '{desc}' suggests confidence {lo}-{hi}, got {conf} — "
                      f"{'under-rated' if conf < lo else 'over-rated'}",
        })
    return flags


# ──────────────────────────────────────────────────────────────────────────────
# Main runner
# ──────────────────────────────────────────────────────────────────────────────
def main() -> int:
    doc = json.loads(ITEMS.read_text())
    items = doc["items"]
    # Skip deprecated items — these were intentionally zeroed in audit v2
    active = [it for it in items if it.get("status_flag") != "deprecated_audit_v2"]

    all_issues: list[dict] = []
    for it in active:
        item_flags = []
        for fn in (check_popis_terminology, check_mj_qty,
                   check_urs_family, check_subdodavatel, check_confidence):
            item_flags.extend(fn(it))
        for f in item_flags:
            f["item_id"] = it["id"]
            f["popis"] = it.get("popis", "")[:80]
            f["kapitola"] = it.get("kapitola", "")
            all_issues.append(f)

    # Aggregate counts
    by_dim = Counter(f["dimension"] for f in all_issues)
    by_sev = Counter(f.get("severity", "") for f in all_issues)

    out = {
        "_schema_version": "1.0",
        "_generated_at": TODAY,
        "_generated_by": "tools/quality_audit.py",
        "items_checked": len(active),
        "items_total_incl_deprecated": len(items),
        "issues_found_total": len(all_issues),
        "summary_by_dimension": dict(by_dim),
        "summary_by_severity": dict(by_sev),
        "issues": all_issues,
    }
    OUT_JSON.write_text(json.dumps(out, indent=2, ensure_ascii=False))

    # ── Report ──
    md = [
        "# Position-by-position Quality Audit — RD Jáchymov",
        "",
        f"**Generated:** {TODAY}",
        f"**Items checked:** {len(active)} (active, excl. 4 deprecated)",
        f"**Issues flagged:** {len(all_issues)}",
        "",
        "> Pragmatic stylistic-quality worksheet. NOT auto-fixed — human review per row.",
        "> Goal is to surface ~50-100 actionable issues, not exhaustive noise.",
        "> Dimensions:",
        "> 1. Popis terminology (RU loanwords, mixed Czech/RU, ellipsis placeholders)",
        "> 2. MJ-qty sanity (mj must match work-type in popis: beton → m³, okno → ks, …)",
        "> 3. URS family ↔ kapitola (URS code first digit ↔ chapter family)",
        "> 4. Subdodavatel logical match (kapitola → expected trade set)",
        "> 5. Confidence appropriate for source (DXF=0.95, regex=0.85, fallback=0.75, …)",
        "",
        "## Summary",
        "",
        "| Dimension | Issues |",
        "|---|--:|",
    ]
    for d, n in by_dim.most_common():
        md.append(f"| {d} | {n} |")
    md.append("")
    md.append(f"**By severity:** " + " · ".join(f"{k}={v}" for k, v in by_sev.most_common()))
    md.append("")

    # Issues per dimension
    for dim in ("popis_terminology", "mj_qty_sanity", "urs_family_consistency",
                "subdodavatel_logical", "confidence_appropriate"):
        dim_issues = [f for f in all_issues if f["dimension"] == dim]
        if not dim_issues:
            continue
        md.extend([
            "", "---", "",
            f"## {dim} ({len(dim_issues)} issues)",
            "",
            "| item_id | severity | popis (truncated) | reason |",
            "|---|---|---|---|",
        ])
        # Sort by severity (high → medium → low → informational)
        sev_order = {"high": 0, "medium": 1, "low": 2, "informational": 3}
        dim_issues.sort(key=lambda x: sev_order.get(x.get("severity", "low"), 9))
        for f in dim_issues:
            sev_icon = {"high": "🟥", "medium": "🟧", "low": "🟨", "informational": "⚪"}.get(
                f.get("severity"), "❓")
            reason = f.get("reason", "")[:120].replace("|", "/")
            popis = f["popis"][:60].replace("|", "/")
            md.append(f"| `{f['item_id']}` | {sev_icon} {f.get('severity','?')} | {popis} | {reason} |")

    OUT_MD.write_text("\n".join(md))
    print(
        f"\n✓ {OUT_JSON.relative_to(PROJ)} ({OUT_JSON.stat().st_size:,} bytes)\n"
        f"✓ {OUT_MD.relative_to(PROJ)} ({OUT_MD.stat().st_size:,} bytes)\n"
        f"\nIssues: {len(all_issues)} total — "
        + " · ".join(f"{k}={v}" for k, v in by_dim.most_common())
        + f"\nBy severity: " + " · ".join(f"{k}={v}" for k, v in by_sev.most_common()),
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
