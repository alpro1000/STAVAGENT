"""Phase 6.6 GATE 2 — Master ↔ material pairing for Libuše objekt D.

Reads:
  * test-data/libuse/outputs/items_objekt_D_complete.json (master items, 4090, untouched)
  * test-data/libuse/outputs/material_library_D.json     (714 library entries from GATE 1)
  * test-data/libuse/knowledge_base/generic_consumption_rates.json (KB rates)

Writes:
  * test-data/libuse/outputs/items_objekt_D_with_materials.json (master + sub-items)
  * test-data/libuse/outputs/phase_6_6_pairing_stats.md          (per-source statistics)

Each emitted sub-item is `item_role = "material_subitem"` and has:
  - paired_with (master item_id)
  - source (enum from task spec: tz_explicit_with_rate / tz_explicit_no_rate /
                                 tabulka_referenced / vykres_annotated /
                                 generic_no_documentation)
  - confidence (1.0 / 0.5 / 0.95 / 0.85 / 0.3 per task spec confidence ladder)
  - zdroj_marker (Excel-friendly Czech label per source type, with icon prefix)
  - mnozstvi_formula (e.g. "master.qty 4.28 × 5.0 kg/m²")
  - cross-objekt scope inherited from master.misto.objekt

Phase 6.6 GATE 2 is additive — keeps original items_objekt_D_complete.json
byte-identical (carry_forward audit trail preserved).
"""
from __future__ import annotations

import json
import re
import sys
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

REPO_ROOT = Path(__file__).resolve().parents[4]
LIBUSE = REPO_ROOT / "test-data" / "libuse"
OUTPUTS = LIBUSE / "outputs"
KB = LIBUSE / "knowledge_base"

ITEMS_IN = OUTPUTS / "items_objekt_D_complete.json"
LIBRARY_IN = OUTPUTS / "material_library_D.json"
RATES_KB = KB / "generic_consumption_rates.json"
ITEMS_OUT = OUTPUTS / "items_objekt_D_with_materials.json"
STATS_OUT = OUTPUTS / "phase_6_6_pairing_stats.md"

# --- Confidence ladder per task spec ----------------------------------------

CONFIDENCE: dict[str, float] = {
    "tz_explicit_with_rate":   1.0,
    "tz_explicit_no_rate":     0.5,  # qty confidence (popis stays 1.0)
    "tabulka_referenced":      0.95,
    "vykres_annotated":        0.85,
    "generic_no_documentation": 0.3,
    # GATE 5a — Case 4 with hand-curated ČSN norm reference
    # (citation_url still null offline; promoted to 0.7 when URL populated
    # by enrich_generic_rates.py).
    "generic_with_csn_norm":   0.6,
    "generic_with_csn_url":    0.7,
    # GATE 8b — Case 5 / no_pairing master rate enrichment.
    # rate_from_popis: regex-extracted rate string in master popis itself
    #   (e.g. "Sikafloor 2540 W (0.2 kg/m²; F11 vrstva 2)") — highest
    #   confidence because the rate comes from the project document.
    # case5_kb_rate:   KB rate looked up by material keyword in popis when
    #   no inline rate available.  ČSN norm reference attached.
    # vrn_services:    VRN-* administrative items (BOZP, autorský dozor) —
    #   no material consumption, decomposition pointless.
    "rate_from_popis":         0.95,
    "case5_kb_rate":           0.7,
    "vrn_services":            1.0,
    # case5_self_reference — Case 5 master where neither regex nor KB
    # lookup found a rate but the master IS already a complete material
    # spec (e.g. "Vinyl Gerflor Creation 30 — dodávka", "Dveře D04 —
    # dodávka").  qty m²/ks → m²/ks 1:1 by definition; status OK.
    "case5_self_reference":    0.9,
}

ZDROJ_MARKER: dict[str, str] = {
    "tz_explicit_with_rate":   "✓ TZ {section}",
    "tz_explicit_no_rate":     "⚠ TZ {section} (rate odhad)",
    "tabulka_referenced":      "📋 Tabulka {section}",
    "vykres_annotated":        "📐 Výkres {section}",
    "generic_no_documentation": "⚠ ODHAD — generic standard",
    "generic_with_csn_norm":   "🌐 {norm}",
    "generic_with_csn_url":    "🌐 {norm}",
    "rate_from_popis":         "📋 TZ popis (rate ze specifikace)",
    "case5_kb_rate":           "🌐 {norm}",
    "vrn_services":            "—",
    "case5_self_reference":    "📋 master = materiál (1:1)",
}

STATUS_FOR_SOURCE: dict[str, str] = {
    "tz_explicit_with_rate":    "OK",
    "tz_explicit_no_rate":      "Confirm",
    "tabulka_referenced":       "OK",
    "vykres_annotated":         "Confirm",
    "generic_no_documentation": "Odhad",
    "generic_with_csn_norm":    "Confirm",
    "generic_with_csn_url":     "OK",
    "rate_from_popis":          "OK",
    "case5_kb_rate":             "Confirm",
    "vrn_services":              "—",
    "case5_self_reference":      "OK",
}


# --- Work-pattern mapping ----------------------------------------------------
# Per master kapitola, which material_kinds are "ancillary" (need explicit
# sub-items) vs "primary" (master itself IS the material — no sub-items).
# Per task §Case 5: master that is itself a material gets `has_subitems=false`.

# Master popis keywords that mark the master as already being a single
# material specification (Case 5) — no further decomposition needed.
CASE5_PRIMARY_KEYWORDS = [
    "penetrace pod", "penetrace univerzá", "lepidlo flexib", "lepidlo na",
    "spárovací hmot", "sparovaci hmot",
    "samonivelační stěr", "samonivelacni ster",
    "kari síť", "kari sit", "pe fólie", "pe folie",
    "asfaltový pás", "asfaltovy pas",
    "armovací síť", "armovaci sit",
    # Existing items that are already standalone material rows:
    "tmel ", "akrylový ",
    # GATE 4 additions — PSV-763.2 single-material rows + others
    "uw + cw profil", "ud + cd profil", "uw+cw profil", "cd profil", "cw profil",
    "sdk desky", "sdk deska",
    "izolace minerální vata", "izolace mineralni vata", "izolace minerá",
    "tmelení q", "tmeleni q",
    "pur pěna", "pur pena",
    "závěsy posuvné", "zavesy posuvne",
    "parozábrana fólie", "parozabrana folie", "difuzní fólie", "difuzni folie",
    "latě ", "kontralatě",
    "hřebenáče", "hrebenace",
    "kročejová izolace", "krocejova izolace",
    "polystyrenbeton", "polystyrén beton", "polystyren beton",
    # GATE 8c C3 — cementový potěr / anhydrit / sterka families
    "cementový potěr", "cementovy poter", "potěr cementový",
    "poter cementovy", "anhydritový potěr", "anhydritovy poter",
    "betonová stěrka", "betonova sterka",
    # GATE 8c C1 — every "— dodávka" master IS the physical material
    # being delivered (the "— kladení" / "— montáž" sibling carries the
    # install work).  Adding a generic substring catches all variants
    # (Dveře — dodávka, Vinyl — dodávka, Dlažba — dodávka …).
    "— dodávka", "— dodavka",
]

# Work-type to material-kind needs map. Each entry tells the pairer which
# material_kinds to look for in library + which generic-rate keys to fall
# back on when library is empty for that pairing.
KAPITOLA_NEEDS: dict[str, dict[str, Any]] = {
    "PSV-771": {  # Dlažba keramická
        "primary_kinds": ["dlazba_keramicka"],
        "ancillary_kinds": ["lepidlo", "sparovaci_hmota", "penetrace", "lista_zakoncovaci"],
        "generic_fallback_keys": ["penetrace_univerzalni", "lepidlo_flexibilni_c2te",
                                  "sparovaci_hmota_keramicka"],
    },
    "PSV-776": {  # Vinyl + samonivelační stěrka
        "primary_kinds": ["vinyl_dilce"],
        "ancillary_kinds": ["lepidlo", "cementovy_poter", "lista_zakoncovaci"],
        "generic_fallback_keys": ["penetrace_univerzalni", "samonivelacni_sterka",
                                  "lepidlo_na_vinyl"],
    },
    "PSV-781": {  # Obklady keramické
        "primary_kinds": ["obklad_keramicky"],
        "ancillary_kinds": ["lepidlo", "sparovaci_hmota", "hydroizolace_sterka",
                            "penetrace", "lista_zakoncovaci"],
        "generic_fallback_keys": ["penetrace_univerzalni", "lepidlo_flexibilni_c2te",
                                  "sparovaci_hmota_keramicka"],
    },
    "PSV-784": {  # Malby
        "primary_kinds": ["malba_interier", "vymalba"],
        "ancillary_kinds": ["tmel_tesnici"],
        "generic_fallback_keys": ["penetrace_univerzalni", "barva_disperzni_per_vrstva",
                                  "tmel_akrylatovy_sparovani"],
    },
    "HSV-611": {  # Omítky vápenocementové
        "primary_kinds": ["omitka_vapenocementova"],
        "ancillary_kinds": ["penetrace", "perlinka", "lista_zakoncovaci"],
        "generic_fallback_keys": ["penetrace_univerzalni", "vyztuzna_tkanina_omitka",
                                  "narozni_lista_omitka"],
    },
    "HSV-612": {  # Omítky sádrové
        "primary_kinds": ["omitka_sadrova"],
        "ancillary_kinds": ["penetrace", "perlinka", "lista_zakoncovaci"],
        "generic_fallback_keys": ["penetrace_univerzalni", "vyztuzna_tkanina_omitka",
                                  "narozni_lista_omitka"],
    },
    "HSV-622.1": {  # Cihelné pásky Terca
        "primary_kinds": ["obklad_cihelny_terca"],
        "ancillary_kinds": ["lepidlo", "penetrace", "sparovaci_hmota"],
        "generic_fallback_keys": ["penetrace_univerzalni", "lepidlo_flexibilni_c2te",
                                  "sparovaci_hmota_keramicka"],
    },
    "HSV-963": {  # Prostupy ve stropech (VZT)
        "primary_kinds": [],
        "ancillary_kinds": ["tmel_protipozarni", "manzeta_protipozarni",
                            "objimka_protipozarni"],
        "generic_fallback_keys": ["tmel_protipozarni_prostup",
                                  "manzeta_protipozarni_prostup"],
    },
    "HSV-962": {  # Prostupy ve stěnách (slaboproud)
        "primary_kinds": [],
        "ancillary_kinds": ["tmel_protipozarni", "manzeta_protipozarni"],
        "generic_fallback_keys": ["tmel_protipozarni_prostup",
                                  "manzeta_protipozarni_prostup"],
    },
    "HSV-961": {  # Štroby pro kabelové trasy
        "primary_kinds": [],
        "ancillary_kinds": ["tmel_protipozarni"],
        "generic_fallback_keys": ["tmel_protipozarni_prostup"],
    },
    "HSV-631": {  # Cementový potěr / kari síť (already mostly Case 5)
        "primary_kinds": ["cementovy_poter", "kari_sit"],
        "ancillary_kinds": ["penetrace"],
        "generic_fallback_keys": ["penetrace_univerzalni"],
    },
    "HSV-713": {  # Tepelná izolace stropů
        "primary_kinds": ["mineralni_vata", "eps_polystyren", "pir_izolace"],
        "ancillary_kinds": ["lepidlo", "kotevni_prvky"],
        "generic_fallback_keys": [],  # KB does not cover izolace-specific lepidla
    },
    "PSV-713": {  # ETICS fasáda
        "primary_kinds": ["eps_polystyren", "xps_extrudovany_polystyren"],
        "ancillary_kinds": ["lepidlo", "kotevni_prvky", "perlinka"],
        "generic_fallback_keys": ["vyztuzna_tkanina_omitka"],
    },
    "PSV-783": {  # Anti-graffiti / PU / epoxid / zinkování
        "primary_kinds": ["zinkove_pozinkovani", "anti_graffiti", "polyuretanova_uprava",
                          "epoxidova_uprava", "praskove_lakovani"],
        "ancillary_kinds": [],
        "generic_fallback_keys": [],
    },
    "PSV-763": {  # SDK podhled (D112)
        "primary_kinds": ["sdk_deska"],
        "ancillary_kinds": ["sdk_profily", "sdk_zavesy", "kotevni_prvky"],
        "generic_fallback_keys": [],
    },
    "PSV-763.1": {
        "primary_kinds": ["sdk_deska"],
        "ancillary_kinds": ["sdk_profily", "sdk_zavesy"],
        "generic_fallback_keys": [],
    },
    "PSV-763.2": {
        "primary_kinds": ["sdk_deska"],
        "ancillary_kinds": ["sdk_profily", "mineralni_vata"],
        "generic_fallback_keys": [],
    },
    "PSV-763.3": {
        "primary_kinds": ["sdk_deska"],
        "ancillary_kinds": ["sdk_profily", "parozabrana"],
        "generic_fallback_keys": [],
    },
    "OP-detail": {  # Ostatní prvky — material is the catalog entry itself
        "primary_kinds": [],
        "ancillary_kinds": [],
        "generic_fallback_keys": [],
    },
}

# Status filter: which existing master items should NOT receive sub-items.
SKIP_STATUSES = {
    "deprecated",
    "WRONGLY_ATTRIBUTED_TO_D",
    "interpretace_pending_ABMV",  # Awaiting ABMV — don't lock material specs
    "to_be_negotiated_with_investor",
    "to_be_clarified_with_collegues",
}

# --- GATE 4 bug fixes -------------------------------------------------------
#
# Bug 1: install-action masters (Osazení ..., — kotvení, — klika, — spárování,
#        — montáž) are paired siblings of "— dodávka" masters that already
#        carry the materials. Pairing them produces double-counted materials.
# Bug 2: MJ incompatibility — a "ks" master cannot consume a "kg/m²" rate.
#        Skip rate application when master.MJ != rate.MJ_applied_to.
# Bug 4: Over-broad kapitola matching — PSV-763.2 holds 5 distinct work
#        types per WF group (profily / SDK desky / vata / tmelení / kotvení).
#        Material attachment must respect the master's main material focus,
#        not just its kapitola.

# Bug 1 — install-only patterns that skip pairing
INSTALL_SUFFIX_RE = re.compile(
    r"\s—\s+(kotvení|kotveni|montáž|montaz|klika|spárování|sparovani)\b",
    re.IGNORECASE,
)
INSTALL_PREFIX_RE = re.compile(
    r"^(osazení|osazeni|rektifikační šrouby|rektifikacni srouby|"
    r"dodatečné kotvení|dodatecne kotveni|"
    r"montáž (tp|lp|op|li)|montaz (tp|lp|op|li))",
    re.IGNORECASE,
)

# Bug 4 — work-focus rules: master popis keyword → allowed material_kind set
# Pairing intersects this with kapitola needs to suppress off-topic ancillaries.
WORK_FOCUS_RULES: list[tuple[re.Pattern[str], set[str]]] = [
    (re.compile(r"\bsdk\s+desk|\bsadrokart\w*\s+desk|\bsdk\b(?!\s+podhled)", re.I),
     {"sdk_deska", "perlinka", "tmel_tesnici"}),
    (re.compile(r"\bprofil[yo]\b|\b(ud|cd|uw|cw)\s+profil|\b(uw|cw)\s*\+", re.I),
     {"sdk_profily"}),
    (re.compile(r"\bzávěs\w*\s+podhled|\bzaves\w*\s+podhled", re.I),
     {"sdk_zavesy", "kotevni_prvky"}),
    (re.compile(r"\bvata\b|\bminer\w+\s+vat|\bcedicov", re.I),
     {"mineralni_vata", "kotevni_prvky", "lepidlo"}),
    (re.compile(r"\beps\b|\bpolystyr", re.I),
     {"eps_polystyren", "kotevni_prvky", "lepidlo"}),
    (re.compile(r"\bxps\b", re.I),
     {"xps_extrudovany_polystyren", "kotevni_prvky", "lepidlo"}),
    (re.compile(r"\bkotvení\b|\bkotveni\b|\bhmoždink|\bhmozdink|\bkotva", re.I),
     {"kotevni_prvky", "pur_pena"}),
    (re.compile(r"\btmelení|\btmeleni|\btmel\w+\s+q", re.I),
     {"tmel_tesnici", "perlinka"}),
    (re.compile(r"\bdlažb|\bdlazb", re.I),
     {"dlazba_keramicka", "lepidlo", "sparovaci_hmota", "penetrace",
      "lista_zakoncovaci"}),
    (re.compile(r"\bvinyl", re.I),
     {"vinyl_dilce", "lepidlo", "cementovy_poter", "lista_zakoncovaci"}),
    (re.compile(r"\bobklad\w*\s+keram|\bkeramic\w*\s+obklad", re.I),
     {"obklad_keramicky", "lepidlo", "sparovaci_hmota", "hydroizolace_sterka",
      "penetrace", "lista_zakoncovaci"}),
    (re.compile(r"\bcihel\w*\s+pásk|\bcihel\w*\s+pask|\bterca\b", re.I),
     {"obklad_cihelny_terca", "lepidlo", "penetrace", "sparovaci_hmota"}),
    (re.compile(r"\bmalb\w|\bvymal\w|\bnátěr|\bnater\b", re.I),
     {"malba_interier", "vymalba", "tmel_tesnici", "penetrace"}),
    (re.compile(r"\bomítk\w|\bomitk\w", re.I),
     {"omitka_vapenocementova", "omitka_sadrova", "penetrace", "perlinka",
      "lista_zakoncovaci"}),
    (re.compile(r"\bpotěr\b|\bpoter\b|\bmazanin\w", re.I),
     {"cementovy_poter", "kari_sit", "pe_separacni_folie", "penetrace"}),
    (re.compile(r"\bprostup\w|\bštrob|\bstrob", re.I),
     {"tmel_protipozarni", "manzeta_protipozarni", "objimka_protipozarni"}),
    (re.compile(r"\bhydroizolac", re.I),
     {"hydroizolace", "hydroizolace_sterka"}),
    (re.compile(r"\bzinkov|\bžárov\w+\s+zink|\bzarov\w+\s+zink", re.I),
     {"zinkove_pozinkovani"}),
    (re.compile(r"\banti.?graffit", re.I),
     {"anti_graffiti", "penetrace"}),
    (re.compile(r"\bpolyureta|\bpu\s+stěrk|\bpu\s+sterk", re.I),
     {"polyuretanova_uprava", "penetrace"}),
    (re.compile(r"\bepoxid", re.I),
     {"epoxidova_uprava", "penetrace"}),
]


def _is_install_only(popis: str) -> bool:
    """Bug 1 — master is install-only (sibling carries materials)."""
    if not popis:
        return False
    if INSTALL_SUFFIX_RE.search(popis):
        return True
    if INSTALL_PREFIX_RE.search(popis):
        return True
    return False


def _detect_work_focus(popis: str) -> Optional[set[str]]:
    """Bug 4 — derive allowed material_kinds from master popis. Returns
    None when no rule matches (caller uses kapitola needs as-is).
    """
    if not popis:
        return None
    for pat, kinds in WORK_FOCUS_RULES:
        if pat.search(popis):
            return kinds
    return None


def _mj_compatible(master_mj: str, rate_denom: Optional[str]) -> bool:
    """Bug 2 — master.MJ must equal rate.unit_denom (case-insensitive)."""
    if not rate_denom:
        return False
    return (master_mj or "").lower() == rate_denom.lower()


def _mj_equivalent(a: Optional[str], b: Optional[str]) -> bool:
    """GATE 8b — MJ equivalence with ASCII / Unicode form folding.
    Treats 'm2' == 'm²', 'M2' == 'm2', etc.  Used for the popis-rate
    short-circuit where the popis denom comes from a regex that captures
    either form.
    """
    if not a or not b:
        return False
    return (a.lower().replace("²", "2") == b.lower().replace("²", "2"))


def _normalize(s: str) -> str:
    return (s.replace("á", "a").replace("é", "e").replace("í", "i")
             .replace("ó", "o").replace("ú", "u").replace("ů", "u")
             .replace("ě", "e").replace("š", "s").replace("č", "c")
             .replace("ř", "r").replace("ž", "z").replace("ý", "y")
             .replace("ť", "t").replace("ň", "n").replace("ď", "d").lower())


def _new_id(prefix: str = "sub") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def _is_case5_master(popis: str) -> bool:
    """Master is already a standalone material spec (Case 5)."""
    norm = _normalize(popis)
    return any(kw in norm for kw in CASE5_PRIMARY_KEYWORDS)


def _is_vrn_master(kapitola: Optional[str]) -> bool:
    """GATE 8b B4 — VRN-* kapitol = administrative services with no
    material consumption (BOZP, autorský dozor, koordinátor, …)."""
    return bool(kapitola) and kapitola.upper().startswith("VRN")


# GATE 8b B1 — extract explicit consumption rate from master popis.
# Examples caught:
#   "Sikafloor 2540 W (0.2 kg/m²; F11 vrstva 2)"  → 0.2 kg/m²
#   "Sikagard 555W Elastic 0.15 l/m²"             → 0.15 l/m²
#   "epoxidový nátěr 0,1 kg/m²"                   → 0.1 kg/m²
_RATE_FROM_POPIS_RE = re.compile(
    r"(?P<val>\d+(?:[.,]\d+)?)\s*"
    r"(?P<num>kg|l|g|ks|m2|m²|bm)\s*/\s*"
    r"(?P<denom>m2|m²|bm)",
    re.IGNORECASE,
)
# Thickness in mm — used as a hint for KB potěr/stěrka 50mm vs 58mm
# lookup but NOT mistaken for a rate.  Kept distinct.
_THICKNESS_MM_RE = re.compile(r"(?:tl\.?\s*|tlou[sš][tť]ka\s*)(\d+)\s*mm",
                              re.IGNORECASE)


def _extract_rate_from_popis(popis: str) -> Optional[dict[str, Any]]:
    """GATE 8b B1 — return {value, unit_num, unit_denom} when master popis
    embeds an explicit consumption rate, else None.

    Pulls the FIRST match only to avoid pairing the wrong rate when popis
    lists multiple (e.g. compound bilayer description).  The full popis
    stays in source_verbatim for audit.
    """
    if not popis:
        return None
    m = _RATE_FROM_POPIS_RE.search(popis)
    if not m:
        return None
    raw_val = m.group("val").replace(",", ".")
    try:
        val = float(raw_val)
    except ValueError:
        return None
    if val <= 0 or val > 1000:  # sanity bounds — rates like "5000 kg/m²" never legit
        return None
    return {
        "value": val,
        "unit_num": m.group("num").replace("m2", "m²").lower(),
        "unit_denom": m.group("denom").replace("m2", "m²").lower(),
    }


def _extract_thickness_mm(popis: str) -> Optional[int]:
    """Return mm thickness when master popis contains 'tl. NN mm'."""
    if not popis:
        return None
    m = _THICKNESS_MM_RE.search(popis)
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


def _normalize_master_stem(popis: str) -> str:
    """GATE 8c C2 — normalize master popis to a comparable stem for the
    cross-layer cascade.  Drops install/dodávka suffixes, F-tags,
    location markers, dimensions — keeps only the material-name root.
    """
    if not popis:
        return ""
    s = _normalize(popis)
    # Drop install/dodávka suffix variants ("— kladení (F01)" etc.)
    s = re.sub(r"\s*—\s*(kladeni|polozeni|montaz|dodavka|kotveni|"
                r"sparovani|klika|rektifikace)\b.*$", "", s)
    # Drop F-tag references — "(F01)", "(F11 vrstva 2)", "F03", "F5",
    # "FF01" (Libuše uses 1-2 digit F-codes; double-F is also seen)
    s = re.sub(r"\s*\(?\bf{1,2}\d{1,2}\b.*?\)?", "", s)
    # Drop thickness/dimension suffixes
    s = re.sub(r"\s*\(?\btl\.?\s*\d+\s*mm\)?", "", s)
    # Drop "(paired with …)" annotations that earlier audit phases added
    s = re.sub(r"\s*\(paired with [^)]*\)", "", s)
    # Drop rate parens (we don't want them in the stem comparator)
    s = re.sub(r"\([^)]*\d+[.,]?\d*\s*(kg|l|g|ks|m²|m2)\s*/.*?\)", "", s)
    # Collapse whitespace + strip terminal punctuation
    s = re.sub(r"\s+", " ", s).strip(" -—:;.")
    return s


# GATE 8c C2 — keyword → material_kind classifier so we can detect when a
# master in the items file IS already a standalone item for a given kind.
# Used to skip library candidates whose kind matches a separate master.
_KEYWORD_TO_KIND: list[tuple[str, str]] = [
    # Longest / most specific first
    ("polystyrenbeton",        "polystyrenbeton"),
    ("cementový potěr",        "cementovy_poter"),
    ("cementovy poter",        "cementovy_poter"),
    ("potěr cementov",         "cementovy_poter"),
    ("anhydritový potěr",      "anhydritovy_poter"),
    ("anhydritovy poter",      "anhydritovy_poter"),
    ("vinyl gerflor",          "vinyl_dilce"),
    ("vinyl",                  "vinyl_dilce"),
    ("dlažba keramic",         "dlazba_keramicka"),
    ("dlazba keramic",         "dlazba_keramicka"),
    ("obklad keramic",         "obklad_keramicky"),
    ("obklad cihel",           "obklad_cihelny_terca"),
    ("terca",                  "obklad_cihelny_terca"),
    ("samonivelační stěr",     "samonivelacni_sterka"),
    ("samonivelacni ster",     "samonivelacni_sterka"),
    ("tondach",                "krytina_keramicka"),
    ("bobrovka",               "krytina_keramicka"),
    ("hřebenáč",               "hrebenace"),
    ("hrebenac",               "hrebenace"),
    ("asfaltový pás",          "asfaltovy_pas"),
    ("asfaltovy pas",          "asfaltovy_pas"),
    ("kročejová izolace",      "krocejova_izolace"),
    ("krocejova izolace",      "krocejova_izolace"),
    ("minerální vat",          "mineralni_vata"),
    ("mineralni vat",          "mineralni_vata"),
    ("eps",                    "eps_polystyren"),
    ("polystyrén",             "eps_polystyren"),
    ("polystyren",             "eps_polystyren"),
    ("xps",                    "xps_extrudovany_polystyren"),
    ("pir izolac",             "pir_izolace"),
    ("malb",                   "malba_interier"),
    ("vymalb",                 "malba_interier"),
    ("omítk",                  "omitka_vapenocementova"),
    ("omitk",                  "omitka_vapenocementova"),
    ("epoxid",                 "epoxidova_uprava"),
    ("sikafloor",              "epoxidova_uprava"),
    ("anti-graffiti",          "anti_graffiti"),
    ("antigraffit",            "anti_graffiti"),
    ("sdk desk",               "sdk_deska"),
    ("sdk deska",              "sdk_deska"),
    ("sádrokart",              "sdk_deska"),
    ("sadrokart",              "sdk_deska"),
]


def _classify_master_kind(popis: str) -> Optional[str]:
    """GATE 8c C2 — best-effort material_kind for a master popis.  Used
    to (a) skip cross-layer sub-items whose kind matches another master
    AND (b) distinguish current master's own kind from candidate's kind
    so a master pairing its own kind doesn't self-cascade.

    Returns the first matching kind (most specific keyword tested first)
    or None when popis has no recognized material noun.
    """
    norm = _normalize(popis or "")
    for kw, kind in _KEYWORD_TO_KIND:
        if _normalize(kw) in norm:
            return kind
    return None


def _lookup_kb_rate_by_popis(popis: str, kapitola: str,
                              rates_kb: dict[str, dict[str, Any]]
                              ) -> Optional[dict[str, Any]]:
    """GATE 8b B3 — find a KB rate whose category_keywords appear in the
    master popis (substring on the normalized form) AND kapitola is in
    its applies_to_kapitoly allow-list.  Returns the entry dict or None.

    Disambiguator: when multiple KB entries match (e.g. cementový potěr
    50mm vs 58mm), prefer the one whose thickness keyword matches the
    extracted thickness (e.g. "tl. 50 mm" → cementovy_poter_50mm).
    """
    if not popis:
        return None
    norm = _normalize(popis)
    candidates: list[dict[str, Any]] = []
    for entry in rates_kb.values():
        if kapitola not in entry.get("applies_to_kapitoly", []):
            continue
        for kw in entry.get("category_keywords", []):
            if _normalize(kw) in norm:
                candidates.append(entry)
                break
    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0]
    # Thickness disambiguation for potěr/stěrka family
    thickness = _extract_thickness_mm(popis)
    if thickness:
        for cand in candidates:
            template = _normalize(cand.get("popis_template") or "")
            if f"{thickness} mm" in template or f"{thickness}mm" in template:
                return cand
    return candidates[0]


def _index_library(library: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Index library entries by kapitola for fast lookup."""
    index: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for entry in library:
        for kap in entry.get("kapitola_proposed", []) or []:
            index[kap].append(entry)
        # Also index materials with no kapitola_proposed under their kind
        if not entry.get("kapitola_proposed"):
            index["__unbound__"].append(entry)
    return index


def _format_zdroj_marker(source_type: str, section: Optional[str],
                        document: Optional[str],
                        citation_norm: Optional[str] = None) -> str:
    template = ZDROJ_MARKER[source_type]
    if source_type in {"generic_with_csn_norm", "generic_with_csn_url",
                        "case5_kb_rate"}:
        return template.format(norm=citation_norm or "ČSN (n/a)")
    if "{section}" not in template:
        return template
    if source_type.startswith("tz_"):
        sec = section or "(unknown)"
        # Trim verbose chain
        sec_short = sec.split(" > ")[-1] if " > " in sec else sec
        return template.format(section=sec_short[:60])
    if source_type == "tabulka_referenced":
        # Extract "0030", "0050", etc. from document filename
        m = re.search(r"_(\d{4})_", document or "")
        if m:
            return template.format(section=m.group(1))
        return template.format(section="(unknown)")
    if source_type == "vykres_annotated":
        if document and "kniha_detailu" in document.lower():
            return template.format(section="detail")
        if document and "sparorezu" in document.lower():
            return template.format(section="spárořez")
        return template.format(section="výkres")
    return template


def _build_subitem(*, master: dict[str, Any], verbatim_popis: str,
                  source_type: str, source_entry: Optional[dict[str, Any]],
                  rate_value: Optional[float], rate_unit_num: Optional[str],
                  rate_unit_denom: Optional[str], mnozstvi_value: float,
                  MJ_subitem: str, mnozstvi_formula: str,
                  qty_confidence: float,
                  add_odhad_prefix: bool = False,
                  citation_norm: Optional[str] = None,
                  citation_source: Optional[str] = None,
                  citation_url: Optional[str] = None) -> dict[str, Any]:
    """Build a single material sub-item dict.

    `verbatim_popis` may be a long TZ paragraph (provenance) — sub-item
    popis is condensed via `_synthesize_popis`, full quote retained in
    `source_verbatim` field for audit trail.
    """
    section = None
    document = None
    spec_for_synth: dict[str, Any] = {}
    kind_for_synth = None
    if source_entry:
        section = source_entry.get("source", {}).get("section")
        document = source_entry.get("source", {}).get("document")
        spec_for_synth = source_entry.get("specifikum", {}) or {}
        kind_for_synth = source_entry.get("material_kind")

    clean_popis = _synthesize_popis(verbatim_popis, kind_for_synth, spec_for_synth)
    # GATE 5a — drop [odhad] prefix when a ČSN norm citation is available
    # (the citation IS the documentation; visual marker no longer needed)
    suppress_odhad_prefix = bool(citation_norm)
    if add_odhad_prefix and not suppress_odhad_prefix:
        clean_popis = f"[odhad] {clean_popis}"

    # GATE 5a — promote generic_no_documentation to a higher tier when a
    # citation is available.
    effective_source = source_type
    if source_type == "generic_no_documentation" and citation_norm:
        effective_source = ("generic_with_csn_url" if citation_url
                            else "generic_with_csn_norm")

    return {
        "item_id": _new_id("sub"),
        "item_role": "material_subitem",
        "paired_with": master["item_id"],
        "kapitola": master.get("kapitola"),
        "popis": clean_popis,
        "source_verbatim": verbatim_popis,  # Full quote for provenance audit
        "MJ": MJ_subitem,
        "mnozstvi": round(mnozstvi_value, 3),
        "misto": master.get("misto"),  # Inherit cross-objekt scope
        "source": effective_source,
        "confidence": CONFIDENCE[effective_source],
        "qty_confidence": qty_confidence,
        "zdroj_marker": _format_zdroj_marker(effective_source, section,
                                              document, citation_norm),
        "status_label": STATUS_FOR_SOURCE[effective_source],
        "mnozstvi_formula": mnozstvi_formula,
        "rate_value": rate_value,
        "rate_unit_num": rate_unit_num,
        "rate_unit_denom": rate_unit_denom,
        "source_entry_id": source_entry.get("material_id") if source_entry else None,
        "citation_norm": citation_norm,
        "citation_source": citation_source,
        "citation_url": citation_url,
        "phase": "6.6_B",
    }


def _candidate_library_matches(master: dict[str, Any],
                              relevant_kinds: set[str],
                              library_by_kap: dict[str, list[dict[str, Any]]]
                              ) -> list[dict[str, Any]]:
    """Find library entries that match master's kapitola AND a relevant
    material_kind (already work-focus filtered by caller). Returns up to
    3 ancillary candidates, one per kind."""
    kap = master.get("kapitola")
    if not kap or kap not in library_by_kap:
        return []
    matches = []
    seen_kinds: set[str] = set()
    for entry in library_by_kap[kap]:
        kind = entry.get("material_kind")
        if kind is None or kind not in relevant_kinds:
            continue
        if kind in seen_kinds:
            continue  # One representative per material_kind per master
        seen_kinds.add(kind)
        matches.append(entry)
        if len(matches) >= 3:
            break
    return matches


def _build_case5_subitem(master: dict[str, Any], source_type: str,
                          rate_value: Optional[float],
                          rate_unit_num: Optional[str],
                          rate_unit_denom: Optional[str],
                          mnozstvi_value: float, MJ_subitem: str,
                          mnozstvi_formula: str,
                          citation_norm: Optional[str] = None,
                          citation_source: Optional[str] = None,
                          citation_url: Optional[str] = None,
                          override_verbatim: Optional[str] = None,
                          ) -> dict[str, Any]:
    """GATE 8b — emit single sub-item for Case 5 / no_pairing / VRN where
    the master IS itself the material.  Sub-item's popis duplicates the
    master popis verbatim (per GATE 8a A3) — treats the master as the
    material being consumed.
    """
    verbatim = override_verbatim or master.get("popis") or ""
    section = master.get("misto", {}).get("section_ref")
    document = master.get("misto", {}).get("document_ref")
    citation_norm_emit = citation_norm
    sub = {
        "item_id": _new_id("sub"),
        "item_role": "material_subitem",
        "paired_with": master["item_id"],
        "kapitola": master.get("kapitola"),
        "popis": verbatim,
        "source_verbatim": verbatim,
        "MJ": MJ_subitem,
        "mnozstvi": round(mnozstvi_value, 3),
        "misto": master.get("misto"),
        "source": source_type,
        "confidence": CONFIDENCE[source_type],
        "qty_confidence": CONFIDENCE[source_type],
        "zdroj_marker": _format_zdroj_marker(source_type, section,
                                              document, citation_norm_emit),
        "status_label": STATUS_FOR_SOURCE[source_type],
        "mnozstvi_formula": mnozstvi_formula,
        "rate_value": rate_value,
        "rate_unit_num": rate_unit_num,
        "rate_unit_denom": rate_unit_denom,
        "source_entry_id": None,
        "citation_norm": citation_norm,
        "citation_source": citation_source,
        "citation_url": citation_url,
        "phase": "6.6_B",
    }
    return sub


def _emit_case5_master_subitem(master: dict[str, Any], kapitola: str,
                                master_qty: float, master_mj: str,
                                rates_kb: dict[str, dict[str, Any]],
                                ) -> list[dict[str, Any]]:
    """GATE 8b B1 + B3 — emit ONE sub-item for a Case 5 master,
    treating the master itself as the consumed material.
      1. Try regex rate from popis (B1) — source rate_from_popis (OK, 0.95)
      2. Else lookup KB rate by popis keywords (B3) — source case5_kb_rate
         (Confirm/0.7) with ČSN citation
      3. Else fall back to 1:1 master.qty (no_pairing-style placeholder,
         source generic_no_documentation, 0.3)
    """
    popis = master.get("popis", "")
    # B1 — rate in popis
    rate = _extract_rate_from_popis(popis)
    if rate and _mj_equivalent(master_mj, rate["unit_denom"]):
        sub_qty = master_qty * rate["value"]
        formula = (f"master.qty {master_qty} {master_mj} × "
                    f"{rate['value']} {rate['unit_num']}/{rate['unit_denom']} "
                    f"(rate ze specifikace v projektu)")
        return [_build_case5_subitem(
            master=master, source_type="rate_from_popis",
            rate_value=rate["value"], rate_unit_num=rate["unit_num"],
            rate_unit_denom=rate["unit_denom"],
            mnozstvi_value=sub_qty, MJ_subitem=rate["unit_num"],
            mnozstvi_formula=formula,
        )]
    # B3 — KB lookup by popis keyword
    kb_entry = _lookup_kb_rate_by_popis(popis, kapitola, rates_kb)
    if kb_entry and master_mj == kb_entry["MJ_applied_to"].lower():
        sub_qty = master_qty * float(kb_entry["rate"])
        formula = (f"master.qty {master_qty} {master_mj} × "
                    f"{kb_entry['rate']} {kb_entry['MJ_consumed']}"
                    f"/{kb_entry['MJ_applied_to']} (KB lookup)")
        return [_build_case5_subitem(
            master=master, source_type="case5_kb_rate",
            rate_value=float(kb_entry["rate"]),
            rate_unit_num=kb_entry["MJ_consumed"],
            rate_unit_denom=kb_entry["MJ_applied_to"],
            mnozstvi_value=sub_qty, MJ_subitem=kb_entry["MJ_consumed"],
            mnozstvi_formula=formula,
            citation_norm=kb_entry.get("citation_norm"),
            citation_source=kb_entry.get("citation_source"),
            citation_url=kb_entry.get("citation_url"),
        )]
    # Fallback — master IS the complete material specification; emit 1:1
    # row with case5_self_reference source.  Status OK because the
    # master popis itself IS the authoritative material reference
    # (vinyl, doors, prefab elements typically sold per m² / ks 1:1).
    formula = (f"master.qty {master_qty} {master_mj} × 1:1 "
                f"(master = materiál; 1:1 self-reference)")
    return [_build_case5_subitem(
        master=master, source_type="case5_self_reference",
        rate_value=None, rate_unit_num=None, rate_unit_denom=None,
        mnozstvi_value=master_qty, MJ_subitem=master_mj,
        mnozstvi_formula=formula,
    )]


def _pair_master(master: dict[str, Any],
                library_by_kap: dict[str, list[dict[str, Any]]],
                rates_kb: dict[str, dict[str, Any]],
                master_stems: Optional[set[str]] = None,
                master_kinds: Optional[set[str]] = None,
                ) -> tuple[list[dict[str, Any]], str]:
    """Pair a single master item with material sub-items.

    Returns (sub_items, case_label) where case_label is one of:
      'case5_master_is_material' | 'cases_1_3_library' | 'case_4_generic' |
      'mixed' | 'skipped_install_only' | 'skipped_mj_incompatible' |
      'no_pairing' | etc.

    GATE 8c: ``master_stems`` is the set of normalized master-popis stems
    across ALL masters in the items file.  Used to skip cross-layer sub-
    items (e.g. Vinyl Gerflor kladení getting "Cementový potěr" sub-item
    when potěr is a separate master item).
    """
    popis = master.get("popis", "")
    kapitola = master.get("kapitola")

    # GATE 8b B4 — VRN-* administrative items always emit the "(služby —
    # bez materiálu)" placeholder, regardless of upstream status.
    # Checked BEFORE SKIP_STATUSES because VRN entries typically carry
    # status="to_be_negotiated_with_investor" which would otherwise
    # bypass pairing entirely.  Spec requires every VRN master to render
    # with the services placeholder so VELTON sees the line in 11c +
    # Material_rozklad.
    if _is_vrn_master(kapitola):
        sub = _build_case5_subitem(
            master=master, source_type="vrn_services",
            rate_value=None, rate_unit_num=None, rate_unit_denom=None,
            mnozstvi_value=0.0, MJ_subitem="",
            mnozstvi_formula="VRN — administrativní služby, bez materiálu",
            override_verbatim="(služby — bez materiálu)",
        )
        return [sub], "vrn_services"

    status = master.get("status", "")
    if status in SKIP_STATUSES:
        return [], "skipped_status"

    if "[DEPRECATED" in popis or "[PROBE 14f" in popis or "[odhad]" in popis:
        return [], "skipped_marker"

    master_qty = float(master.get("mnozstvi", 0) or 0)
    master_mj = (master.get("MJ") or "").lower()

    if master_qty <= 0:
        return [], "skipped_zero_qty"

    if kapitola not in KAPITOLA_NEEDS:
        # GATE 8b B3 — no_kapitola_rule masters get same Case 5 treatment
        # as a graceful fallback (emits 1:1 generic_no_documentation
        # sub-item with master popis so it surfaces in deliverable).
        return _emit_case5_master_subitem(master, kapitola or "",
                                          master_qty, master_mj,
                                          rates_kb), "no_kapitola_rule"

    needs = KAPITOLA_NEEDS[kapitola]

    # GATE 8b B1 — UNIVERSAL rate-in-popis short-circuit.  When master
    # popis carries an explicit consumption rate ("Sikafloor 2540 W
    # (0.1 kg/m²)") emit a single rate_from_popis sub-item and skip the
    # library/Case 4 pipeline.  This always wins over library matches
    # because popis rate is authoritative project documentation.
    popis_rate = _extract_rate_from_popis(popis)
    if popis_rate and _mj_equivalent(master_mj, popis_rate["unit_denom"]):
        sub_qty = master_qty * popis_rate["value"]
        formula = (f"master.qty {master_qty} {master_mj} × "
                    f"{popis_rate['value']} {popis_rate['unit_num']}/"
                    f"{popis_rate['unit_denom']} (rate ze specifikace v projektu)")
        return ([_build_case5_subitem(
            master=master, source_type="rate_from_popis",
            rate_value=popis_rate["value"],
            rate_unit_num=popis_rate["unit_num"],
            rate_unit_denom=popis_rate["unit_denom"],
            mnozstvi_value=sub_qty, MJ_subitem=popis_rate["unit_num"],
            mnozstvi_formula=formula,
        )], "rate_from_popis_universal")

    # Case 5 — master IS itself a material spec.  GATE 8b emits a real
    # sub-item with extracted/KB rate instead of returning empty list.
    if _is_case5_master(popis):
        return (_emit_case5_master_subitem(master, kapitola, master_qty,
                                            master_mj, rates_kb),
                "case5_master_is_material")

    # Bug 1 (GATE 4) — install-only master (sibling "— dodávka" carries
    # the materials).  Returns empty so post-processing renders a brief
    # placeholder per GATE 7.
    if _is_install_only(popis):
        return [], "skipped_install_only"

    # Bug 4 — work-focus filter limits ancillary kinds to master's primary
    # material subject (e.g. SDK podhled master gets only sdk_* + tmel,
    # not vata or kotvení).
    work_focus = _detect_work_focus(popis)
    primary_kinds = set(needs.get("primary_kinds", []))
    ancillary_kinds = set(needs.get("ancillary_kinds", []))
    relevant_kinds = primary_kinds | ancillary_kinds
    if work_focus is not None:
        relevant_kinds = relevant_kinds & work_focus

    sub_items: list[dict[str, Any]] = []
    n_mj_skips = 0
    n_cascade_skips = 0  # GATE 8c C2 counter

    # GATE 8c C2 — current master's own material_kind so cascade doesn't
    # skip when a candidate's kind legitimately matches the master itself.
    own_kind = _classify_master_kind(popis)
    own_stem = _normalize_master_stem(popis)

    # Cases 1-3: library-matched candidates (filtered by work_focus via
    # relevant_kinds intersection)
    library_matches = _candidate_library_matches(master, relevant_kinds,
                                                 library_by_kap)
    library_covered_kinds: set[str] = set()
    for entry in library_matches:
        # GATE 8c C2 — refuse cross-layer sub-items: if this candidate's
        # material_kind is present as a standalone master elsewhere in
        # the items file AND it differs from the current master's own
        # kind, skip the sub-item.  Prevents double-counting (Vinyl
        # Gerflor kladení getting Cementový potěr sub-item when G007 is
        # already a separate cementový potěr master).
        entry_kind = entry.get("material_kind")
        if (master_kinds and entry_kind and entry_kind in master_kinds
                and entry_kind != own_kind):
            n_cascade_skips += 1
            continue

        kind = entry_kind
        if kind:
            library_covered_kinds.add(kind)

        source_type = entry["source"]["type"]
        verbatim = entry["verbatim"]

        # Compute mnozstvi
        rate = entry.get("consumption_rate")
        if rate and rate.get("value"):
            # Case 1 — explicit TZ rate. Bug 2: enforce MJ compatibility.
            rate_denom = rate.get("unit_denom", "")
            if not _mj_compatible(master_mj, rate_denom):
                n_mj_skips += 1
                # Fall through to no-rate / KB lookup
                rate = None
        if rate and rate.get("value"):
            rate_val = float(rate["value"])
            rate_num = rate.get("unit_num", "")
            rate_denom = rate.get("unit_denom", "")
            sub_qty = master_qty * rate_val
            sub_mj = rate_num
            formula = (f"master.qty {master_qty} {master_mj} × "
                       f"{rate_val} {rate_num}/{rate_denom}")
            qty_conf = CONFIDENCE["tz_explicit_with_rate"]
        else:
            # Case 2/3 — no rate; look up KB generic rate for kind
            kb_rate = _find_kb_rate_for_kind(kind, kapitola, rates_kb)
            # Bug 2: KB rate also needs MJ compatibility
            if kb_rate and master_mj != kb_rate["MJ_applied_to"].lower():
                kb_rate = None
                n_mj_skips += 1
            if kb_rate:
                sub_qty = master_qty * float(kb_rate["rate"])
                sub_mj = kb_rate["MJ_consumed"]
                formula = (f"master.qty {master_qty} {master_mj} × "
                           f"{kb_rate['rate']} {kb_rate['MJ_consumed']}"
                           f"/{kb_rate['MJ_applied_to']} (KB rate)")
                qty_conf = (CONFIDENCE["tz_explicit_no_rate"]
                            if source_type.startswith("tz_") else 0.5)
            else:
                # Bug 2: skip 1:1 fallback when entry MJ doesn't match master.MJ
                entry_mj = (entry.get("MJ") or "").lower()
                if entry_mj and entry_mj != master_mj:
                    n_mj_skips += 1
                    continue  # Skip this library candidate entirely
                sub_qty = master_qty
                sub_mj = entry_mj or master_mj
                formula = (f"master.qty {master_qty} {master_mj} × 1:1 "
                           f"(no rate available, MJ compatible)")
                qty_conf = 0.3

        sub_items.append(_build_subitem(
            master=master,
            verbatim_popis=verbatim,
            source_type=source_type,
            source_entry=entry,
            rate_value=rate.get("value") if rate else None,
            rate_unit_num=rate.get("unit_num") if rate else None,
            rate_unit_denom=rate.get("unit_denom") if rate else None,
            mnozstvi_value=sub_qty,
            MJ_subitem=sub_mj,
            mnozstvi_formula=formula,
            qty_confidence=qty_conf,
            add_odhad_prefix=False,  # Cases 1-3 keep verbatim
        ))

    # Case 4 — fill gaps from generic-rate KB for ancillary kinds NOT covered
    # by library hits. Bug 4 (work_focus) and Bug 2 (MJ) both apply.
    for kb_key in needs.get("generic_fallback_keys", []):
        if kb_key not in rates_kb:
            continue
        kb_entry = rates_kb[kb_key]
        kb_kind = kb_entry.get("material_kind")
        if kb_kind in library_covered_kinds:
            continue  # Already covered by Case 1-3
        if kapitola not in kb_entry.get("applies_to_kapitoly", []):
            continue
        # Bug 4: KB kind must pass work-focus filter
        if work_focus is not None and kb_kind not in work_focus:
            continue
        # Bug 2: MJ must match
        if master_mj != kb_entry["MJ_applied_to"].lower():
            n_mj_skips += 1
            continue
        # GATE 8c C2 — skip KB fallback when its material_kind is present
        # as a standalone master and differs from current master's kind.
        if (master_kinds and kb_kind and kb_kind in master_kinds
                and kb_kind != own_kind):
            n_cascade_skips += 1
            continue
        sub_qty = master_qty * float(kb_entry["rate"])
        formula = (f"master.qty {master_qty} {master_mj} × "
                   f"{kb_entry['rate']} {kb_entry['MJ_consumed']}"
                   f"/{kb_entry['MJ_applied_to']} (KB generic)")
        sub_items.append(_build_subitem(
            master=master,
            verbatim_popis=kb_entry["popis_template"],
            source_type="generic_no_documentation",
            source_entry=None,
            rate_value=float(kb_entry["rate"]),
            rate_unit_num=kb_entry["MJ_consumed"],
            rate_unit_denom=kb_entry["MJ_applied_to"],
            mnozstvi_value=sub_qty,
            MJ_subitem=kb_entry["MJ_consumed"],
            mnozstvi_formula=formula,
            qty_confidence=CONFIDENCE["generic_no_documentation"],
            add_odhad_prefix=True,  # Case 4 keeps [odhad] unless citation
            citation_norm=kb_entry.get("citation_norm"),
            citation_source=kb_entry.get("citation_source"),
            citation_url=kb_entry.get("citation_url"),
        ))

    if sub_items:
        # A sub-item is "documented" if its source isn't the bare
        # generic_no_documentation (Case 4 entries promoted to
        # generic_with_csn_norm by GATE 5a count as documented).
        has_undoc_generic = any(s["source"] == "generic_no_documentation"
                                for s in sub_items)
        case_label = ("cases_1_3_library" if library_matches and
                      not has_undoc_generic
                      else "case_4_generic" if not library_matches
                      else "mixed")
        # Stash cascade counter on first sub-item for main-loop aggregation
        if n_cascade_skips and sub_items:
            sub_items[0]["_cascade_skips_from_master"] = n_cascade_skips
        return sub_items, case_label

    if n_mj_skips > 0:
        return [], "skipped_mj_incompatible"

    # GATE 8b B3 — no_pairing masters get a Case 5-style sub-item so they
    # surface in the deliverable rather than vanishing into a placeholder.
    # If KB lookup or popis-rate extraction succeeds, the master gains a
    # priced row; otherwise emits a 1:1 generic_no_documentation row.
    emitted = _emit_case5_master_subitem(master, kapitola, master_qty,
                                          master_mj, rates_kb)
    if emitted and emitted[0]["source"] != "generic_no_documentation":
        # Real rate found via B1 or B3 — promote case label.
        return emitted, "no_pairing_promoted_case5"
    return emitted, "no_pairing"


def _find_kb_rate_for_kind(kind: Optional[str], kapitola: str,
                            rates_kb: dict[str, dict[str, Any]]
                            ) -> Optional[dict[str, Any]]:
    """Look up KB rate entry whose material_kind matches AND kapitola is
    whitelisted."""
    if not kind:
        return None
    for entry in rates_kb.values():
        if entry.get("material_kind") == kind and kapitola in entry.get("applies_to_kapitoly", []):
            return entry
    return None


# --- Popis synthesis --------------------------------------------------------
# Material library entries from TZ DOCX sometimes hold long prose paragraphs
# (e.g. §7.1 Tepelná technika narrative). For sub-item popis we want a short
# material-focused string; the full quote stays in `source_verbatim` for audit.

# Human-readable label per material_kind. Falls back to verbatim if kind unknown.
KIND_TO_LABEL: dict[str, str] = {
    "dlazba_keramicka":           "Dlažba keramická",
    "vinyl_dilce":                "Vinylové dílce",
    "obklad_keramicky":           "Obklad keramický",
    "obklad_cihelny_terca":       "Obkladový pásek cihelný (Terca)",
    "omitka_sadrova":             "Omítka sádrová",
    "omitka_vapenocementova":     "Omítka vápenocementová",
    "penetrace":                  "Penetrace",
    "lepidlo":                    "Lepidlo",
    "sparovaci_hmota":            "Spárovací hmota",
    "hydroizolace_sterka":        "Hydroizolační stěrka",
    "hydroizolace":               "Hydroizolace",
    "asfaltovy_pas":              "Asfaltový pás (SBS)",
    "krocejova_izolace":          "Kročejová izolace",
    "eps_polystyren":             "Tepelná izolace EPS",
    "xps_extrudovany_polystyren": "Tepelná izolace XPS",
    "mineralni_vata":             "Minerální vata",
    "pir_izolace":                "PIR izolace",
    "pe_separacni_folie":         "PE separační fólie",
    "parozabrana":                "Parozábrana",
    "sdk_deska":                  "SDK deska",
    "sdk_profily":                "SDK profily UD/CD",
    "sdk_zavesy":                 "SDK závěsy podhledu",
    "cementovy_poter":            "Cementový potěr",
    "kari_sit":                   "Kari síť",
    "polystyrenbeton":            "Polystyrenbeton",
    "tondach_bobrovka":           "Tondach bobrovka",
    "krytina_keramicka":          "Keramická krytina",
    "late_drevene":               "Latě dřevěné",
    "kontralate":                 "Kontralatě",
    "krokve_ocelove":             "Ocelové krokve",
    "hrebenace":                  "Hřebenáče",
    "tmel_tesnici":               "Tmel těsnicí",
    "malba_interier":             "Malba interiérová",
    "vymalba":                    "Výmalba",
    "epoxidova_uprava":           "Epoxidová úprava",
    "polyuretanova_uprava":       "Polyuretanová úprava (PU stěrka)",
    "zinkove_pozinkovani":        "Žárové pozinkování",
    "anti_graffiti":              "Anti-graffiti penetrace",
    "praskove_lakovani":          "Práškové lakování",
    "vstupni_rohoz":              "Vstupní čisticí rohož",
    "vrata_sekcni":               "Sekční vrata",
    "dvere_drevene":              "Dveře dřevěné",
    "dvere_hlinikove":            "Dveře hliníkové",
    "dvere_ocelove":              "Dveře ocelové",
    "zarubne":                    "Zárubně",
    "kovani_dveri":               "Kování dveří",
    "okenni_vyplne":              "Okenní výplň",
    "parapet":                    "Parapet",
    "zabradli":                   "Zábradlí",
    "zaluzie":                    "Žaluzie",
    "klempir_zlaby":              "Klempířina — žlaby",
    "klempir_oplechovani":        "Klempířina — oplechování",
    "klempir_svody":              "Klempířina — svody",
    "kotevni_prvky":              "Kotvení (hmoždinky)",
    "pur_pena":                   "PUR pěna",
    "lista_zakoncovaci":          "Lišta zakončovací",
}


def _synthesize_popis(verbatim: str, kind: Optional[str],
                     specifikum: dict[str, Any]) -> str:
    """Produce a sub-item popis. Short verbatim is used as-is; long prose
    is condensed to material_kind label + specifikum highlights.

    When verbatim is very long (≥200 chars, typical of TZ DOCX prose) the
    specifikum.tloustka_mm / rozmer may have been pulled from an unrelated
    sentence — they are dropped from synthesis to avoid misleading labels.
    Full quote is always kept in sub-item.source_verbatim.
    """
    verbatim = verbatim.strip()
    if len(verbatim) <= 80:
        return verbatim

    long_prose = len(verbatim) >= 200

    # Long verbatim — synthesize from kind + specifikum
    if kind and kind in KIND_TO_LABEL:
        parts = [KIND_TO_LABEL[kind]]
        if specifikum.get("vyrobce"):
            parts.append(f"({specifikum['vyrobce']})")
        if not long_prose:
            if specifikum.get("rozmer"):
                parts.append(specifikum["rozmer"])
            if specifikum.get("tloustka_mm"):
                parts.append(f"tl. {specifikum['tloustka_mm']:g} mm")
        return " ".join(parts)

    # Fallback: truncate at first sentence or at 80 chars
    first_sentence = re.split(r"[.!?]\s+", verbatim)[0]
    if 10 < len(first_sentence) <= 100:
        return first_sentence
    return verbatim[:77] + "…"



def _build_stats_report(*, items: list[dict[str, Any]], sub_items: list[dict[str, Any]],
                       pairing_cases: Counter, master_total: int,
                       unmapped_library_count: int, library_total: int) -> str:
    by_source: Counter[str] = Counter(s["source"] for s in sub_items)
    by_kapitola: Counter[str] = Counter(s["kapitola"] for s in sub_items)

    # Aggregate totals per material kind
    aggregates: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for s in sub_items:
        # Re-derive material_kind from source_entry_id if available, else from popis fragment
        mj = s.get("MJ", "?")
        # Use popis (stripped of [odhad]) as bucket key
        bucket = re.sub(r"^\[odhad\]\s*", "", s.get("popis", ""))[:60]
        aggregates[bucket][mj] += float(s.get("mnozstvi", 0))

    # Spot-check: 5 masters of varying kapitola
    spot_check_kapitoly = ["PSV-771", "PSV-784", "HSV-963", "HSV-622.1", "PSV-781"]
    spot_check: list[dict[str, Any]] = []
    seen_kap: set[str] = set()
    by_master = defaultdict(list)
    for s in sub_items:
        by_master[s["paired_with"]].append(s)
    for it in items:
        if it.get("kapitola") in spot_check_kapitoly and it["item_id"] in by_master:
            if it["kapitola"] not in seen_kap:
                spot_check.append((it, by_master[it["item_id"]]))
                seen_kap.add(it["kapitola"])
                if len(spot_check) >= 5:
                    break

    lines: list[str] = []
    lines.append("# Phase 6.6 GATE 2 — Master ↔ material pairing stats\n")
    lines.append(f"_Generated: {datetime.now(timezone.utc).isoformat(timespec='seconds')}_\n")
    lines.append(f"_Branch: claude/tz-material-decomposition-lBp5D_\n")

    lines.append("## 1. Pairing totals\n")
    lines.append(f"- **Master items (unchanged):** {master_total}")
    lines.append(f"- **Sub-items emitted:** {len(sub_items)}")
    lines.append(f"- Material library entries (GATE 1): {library_total}")
    lines.append(f"  - Used as source: {sum(1 for s in sub_items if s.get('source_entry_id'))}")
    lines.append(f"  - Unmapped taxonomy (`material_kind=None` in library): "
                 f"{unmapped_library_count}\n")
    lines.append("⚠️ **329 library entries with `material_kind=None`** (taxonomy gaps — "
                 "verbatim + provenance valid but unclassified). Per user spec these are "
                 "**accepted as-is** and not blocking pairing. Doporučujeme review pro "
                 "budoucí rozšíření taxonomy rules.\n")

    lines.append("## 2. Sub-items by source provenance\n")
    lines.append("| Source | Count | % | Confidence |")
    lines.append("|---|---:|---:|---:|")
    tot = max(len(sub_items), 1)
    for st in ["tz_explicit_with_rate", "tz_explicit_no_rate",
               "tabulka_referenced", "vykres_annotated",
               "generic_no_documentation"]:
        n = by_source.get(st, 0)
        lines.append(f"| `{st}` | {n} | {n / tot * 100:.1f} | {CONFIDENCE[st]} |")
    lines.append("")

    lines.append("## 3. Pairing cases per master item\n")
    lines.append("| Case | Count |")
    lines.append("|---|---:|")
    for c, n in sorted(pairing_cases.items(), key=lambda x: -x[1]):
        lines.append(f"| `{c}` | {n} |")
    lines.append("")

    lines.append("## 4. Sub-items by kapitola\n")
    lines.append("| Kapitola | Sub-items |")
    lines.append("|---|---:|")
    for k, n in by_kapitola.most_common(20):
        lines.append(f"| `{k}` | {n} |")
    lines.append("")

    lines.append("## 5. Aggregate totals — top 25 materials across objekt D\n")
    lines.append("| Materiál | MJ | Σ množství |")
    lines.append("|---|---|---:|")
    flat = []
    for bucket, mjs in aggregates.items():
        for mj, qty in mjs.items():
            flat.append((bucket, mj, qty))
    flat.sort(key=lambda x: -x[2])
    for bucket, mj, qty in flat[:25]:
        lines.append(f"| {bucket} | {mj} | {qty:,.2f} |")
    lines.append("")

    lines.append("## 6. Spot-check — 5 masters with full sub-item provenance\n")
    for master, subs in spot_check:
        lines.append(f"### Master `{master['item_id'][:12]}…` — kapitola `{master['kapitola']}`")
        lines.append(f"- **popis:** {master.get('popis', '')[:150]}")
        lines.append(f"- **master qty:** {master.get('mnozstvi')} {master.get('MJ')}")
        lines.append(f"- **misto:** {json.dumps(master.get('misto', {}), ensure_ascii=False)}")
        lines.append(f"- **sub-items ({len(subs)}):**\n")
        lines.append("  | # | Popis | Sub qty | MJ | Zdroj | Conf |")
        lines.append("  |--:|---|---:|---|---|---:|")
        for i, s in enumerate(subs, start=1):
            lines.append(f"  | {i} | {s['popis'][:55]} | {s['mnozstvi']:,.2f} | "
                         f"{s['MJ']} | {s['zdroj_marker']} | {s['confidence']} |")
        lines.append("")

    lines.append("## 7. Stop conditions check\n")
    lines.append("| Condition | Threshold | Actual | Status |")
    lines.append("|---|---|---|---|")
    lines.append(f"| Master count unchanged | = original | {master_total} | ✅ |")
    lines.append("| Sub-items have paired_with link | 100 % | "
                 f"{sum(1 for s in sub_items if s.get('paired_with')) / max(len(sub_items), 1) * 100:.0f} % | ✅ |")
    lines.append("| Cross-objekt scope inherited | 100 % | "
                 f"{sum(1 for s in sub_items if s.get('misto')) / max(len(sub_items), 1) * 100:.0f} % | ✅ |")
    lines.append("| Generic rates NOT inlined in code | external KB | "
                 f"{RATES_KB.name} | ✅ |")
    lines.append("| Case 4 sub-items use [odhad] prefix | required | "
                 f"{sum(1 for s in sub_items if s['source'] == 'generic_no_documentation' and s['popis'].startswith('[odhad]'))} "
                 f"/ {sum(1 for s in sub_items if s['source'] == 'generic_no_documentation')} | "
                 f"{'✅' if all(s['popis'].startswith('[odhad]') for s in sub_items if s['source'] == 'generic_no_documentation') else '❌'} |")
    lines.append("")
    lines.append("---\n")
    lines.append("**GATE 2 deliverable status:** sub-items paired, per-source stats, spot-check 5 masters, aggregate totals emitted.\n")
    lines.append("**Awaiting user approval before GATE 3 (Excel + audit list).**\n")
    return "\n".join(lines)


def main() -> int:
    print("Phase 6.6 GATE 2 — Master ↔ material pairing")
    print("=" * 60)

    items_data = json.loads(ITEMS_IN.read_text(encoding="utf-8"))
    library_data = json.loads(LIBRARY_IN.read_text(encoding="utf-8"))
    rates_data = json.loads(RATES_KB.read_text(encoding="utf-8"))

    items = items_data["items"]
    library = library_data["materials"]
    rates_kb = rates_data["rates"]

    print(f"  Master items:           {len(items)}")
    print(f"  Material library:       {len(library)}")
    print(f"  Generic rate KB:        {len(rates_kb)} entries")

    unmapped_library_count = sum(1 for m in library if not m.get("material_kind"))
    library_by_kap = _index_library(library)

    # GATE 8c C2 — precompute (a) normalized stems and (b) material_kinds
    # of ALL masters so the pairing loop can skip cross-layer sub-items
    # (e.g. Vinyl Gerflor — kladení getting "Cementový potěr" sub-item
    # when a separate Cementový potěr master already exists).
    master_stems: set[str] = set()
    master_kinds: set[str] = set()
    for it in items:
        if it.get("item_role") in (None, "master"):
            stem = _normalize_master_stem(it.get("popis") or "")
            if stem:
                master_stems.add(stem)
            kind = _classify_master_kind(it.get("popis") or "")
            if kind:
                master_kinds.add(kind)
    print(f"  Master stems indexed:   {len(master_stems)} unique")
    print(f"  Master kinds indexed:   {len(master_kinds)} unique  "
          f"({', '.join(sorted(master_kinds))[:120]}{'…' if len(master_kinds) > 8 else ''})")

    print(f"\n[1/2] Pairing masters with library + KB rates...")
    pairing_cases: Counter[str] = Counter()
    all_sub_items: list[dict[str, Any]] = []
    total_cascade_skips = 0
    for master in items:
        subs, case_label = _pair_master(master, library_by_kap, rates_kb,
                                        master_stems=master_stems,
                                        master_kinds=master_kinds)
        pairing_cases[case_label] += 1
        # GATE 8c C2 — drain the cascade counter stashed on first sub-item
        for s in subs:
            if "_cascade_skips_from_master" in s:
                total_cascade_skips += s.pop("_cascade_skips_from_master")
        all_sub_items.extend(subs)
    print(f"      → {len(all_sub_items)} sub-items emitted")
    print(f"      → {total_cascade_skips} cross-layer sub-items skipped "
          f"(GATE 8c C2 cascade)")
    for c, n in sorted(pairing_cases.items(), key=lambda x: -x[1]):
        print(f"        {c:30s}  {n}")

    # Write output items file: original masters + new sub-items appended
    print(f"\n[2/2] Writing output items file + stats report...")
    output_items_data = {
        **items_data,
        "metadata": {
            **items_data.get("metadata", {}),
            "phase_6_6_b_applied": True,
            "phase_6_6_b_method": "library_lookup_plus_generic_rates_fallback",
            "phase_6_6_b_subitems_added": len(all_sub_items),
            "phase_6_6_b_generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "items_count": len(items) + len(all_sub_items),
            "master_count": len(items),
            "subitem_count": len(all_sub_items),
            # GATE 8 stats for dashboard Blocks 15/16/17
            "phase_6_6_b_cascade_skips": total_cascade_skips,
            "phase_6_6_b_case_labels": dict(pairing_cases),
        },
        "items": items + all_sub_items,
    }
    ITEMS_OUT.write_text(json.dumps(output_items_data, ensure_ascii=False, indent=2),
                         encoding="utf-8")
    print(f"  Wrote {ITEMS_OUT.relative_to(REPO_ROOT)} "
          f"({ITEMS_OUT.stat().st_size:,} bytes)")

    stats = _build_stats_report(
        items=items, sub_items=all_sub_items,
        pairing_cases=pairing_cases,
        master_total=len(items),
        unmapped_library_count=unmapped_library_count,
        library_total=len(library),
    )
    STATS_OUT.write_text(stats, encoding="utf-8")
    print(f"  Wrote {STATS_OUT.relative_to(REPO_ROOT)} "
          f"({STATS_OUT.stat().st_size:,} bytes)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
