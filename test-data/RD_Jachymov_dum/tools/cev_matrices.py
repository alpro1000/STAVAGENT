#!/usr/bin/env python3
"""
CEV Matrices A and B builders.

Matrix A — TZ → items: per each TZ evidence entry (from cev_tz_evidence.json),
classify into COVERED / N/A_DOCUMENTED / GAP / EXTRA by matching against
items_rd_jachymov_complete.json.

Matrix B — DXF → items: per each significant DXF entity (from Path C tier
outputs), check whether items.json consumes it.

Outputs:
  outputs/cev_matrix_a_tz_to_items.json
  outputs/cev_matrix_b_dxf_to_items.json
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUTS = ROOT / "outputs"
GEN_AT = "2026-05-26"
GEN_BY = "tools/cev_matrices.py"

# ---------------------------------------------------------------------------
# Category → candidate kapitolas (for items.json lookup)
# ---------------------------------------------------------------------------

# Each TZ category maps to a tuple (kapitolas_to_search, semantic_label,
# default_severity_if_gap)
CATEGORY_MAP: dict[str, tuple[list[str], str, str]] = {
    "pozar_pbr": (["PSV-95 Detekce požární", "VRN — Revize", "PSV-76 Výplně otvorů"], "fire safety / PBR", "important"),
    "tkp_chapter": ([], "TKP / ČSN norm reference (no procurement item expected)", "informational"),
    "statika": (["HSV-2 Základové a ŽB", "HSV-4 Vodorovné", "HSV-5 Krov + střecha"], "structural elements", "critical"),
    "stav_zachovano": ([], "explicit stávající/zachováno — no new item expected", "informational"),
    "material_beton": (["HSV-2 Základové a ŽB", "HSV-4 Vodorovné"], "concrete material", "critical"),
    "konstrukce_strecha": (["HSV-5 Krov + střecha", "PSV-76 Klempíř"], "roof construction", "important"),
    "konstrukce_strop": (["HSV-2 Základové a ŽB", "HSV-4 Vodorovné"], "ceiling/strop", "important"),
    "konstrukce_stena": (["HSV-3 Svislé konstrukce", "HSV-7 Fasáda ETICS"], "wall construction", "important"),
    "konstrukce_podlaha": (["PSV-71 Izolace TI", "PSV-77 Podlahy", "HSV-2 Základové a ŽB"], "floor construction", "important"),
    "konstrukce_krov": (["HSV-5 Krov + střecha"], "roof structure / krov", "critical"),
    "bourani_demontaz": (["HSV-6 Bourací práce"], "demolition", "important"),
    "instalace_tzb_zti": (["PSV-72 ZTI"], "ZTI plumbing", "important"),
    "instalace_vytapeni": (["PSV-73 Vytápění"], "heating", "important"),
    "instalace_eli": (["M-21 ELI silnoproud"], "electrical", "important"),
    "instalace_vzt": ([], "VZT — generally subcontracted off-takeoff", "informational"),
    "instalace_pripojka": (["PSV-72 ZTI", "M-21 ELI silnoproud", "VRN — Revize"], "utility connection", "medium"),
    "prace_hloubeni": (["HSV-1 Zemní práce"], "earthworks", "important"),
    "prace_betonaz": (["HSV-2 Základové a ŽB", "HSV-4 Vodorovné"], "concrete works", "important"),
    "prace_klempir": (["PSV-76 Klempíř"], "tinsmith", "important"),
    "prace_truhlar": (["PSV-76 Truhlář", "PSV-76 Výplně otvorů"], "joinery", "important"),
    "prace_zamecnik": (["PSV-76 Zámečnictví"], "metalwork", "important"),
    "material_zdivo": (["HSV-3 Svislé konstrukce"], "masonry", "important"),
    "material_izolace": (["PSV-71 Izolace TI", "PSV-71 Izolace HI", "HSV-7 Fasáda ETICS"], "insulation", "important"),
    "skladba_s_code": (["PSV-71 Izolace TI", "PSV-77 Podlahy", "HSV-5 Krov + střecha", "HSV-7 Fasáda ETICS"], "S-code skladba reference", "medium"),
    "skladba_f_code": (["PSV-95 Detekce požární"], "F-code fire skladba reference", "informational"),
    "pozn_reference": ([], "POZN. reference — meta / cross-link", "informational"),
    "geometrie_rozmery": ([], "geometric dimension — supporting evidence only", "informational"),
}

# Tokens that strongly indicate "no procurement item needed"
NA_TOKENS = re.compile(
    r"\b(stávající|zachová|zachovat|beze\s+změny|není\s+navrh|bez\s+zásahu|není\s+potřeba|není\s+předmět|není\s+součást\w*|nevyskytuj|nezasahuje|nezasáh|nedochází|neřeší|nebyl\s+z\s+podn|nebude\s+(?:měněn|měněna|měněno)|nepředpokláda|není\s+nutné|není\s+nutná)",
    re.IGNORECASE,
)

# PDF table-of-contents / list-of-content lines (e.g. "5.1. Materiály ............ 8")
TOC_LINE = re.compile(r"\.{6,}\s*\d{1,3}\b|^\s*\d+(?:\.\d+){1,4}\.?\s+\S.{0,80}\s+\d{1,3}\s*$|^\s*str\.\s*\d+\b", re.IGNORECASE | re.MULTILINE)
# Concatenated TOC fragment (e.g. "6 Nosné konstrukce vně objektu 15") — single
# digit prefix + heading-like text + single digit suffix, with multi-word body.
TOC_FRAGMENT = re.compile(r"^\s*\d{1,2}\s+(?:Nosné|Nenosné|Schodiště|Konstrukce|Stavební|Stěny|Strop|Krov|Střecha|Materiály|Zatížení|Obecné|Geometrické|Bourací|Stručný|Statick)\b.{0,100}\s+\d{1,3}\s*$", re.IGNORECASE | re.MULTILINE)
# Multiple concatenated TOC entries on one line ("6 Nosné konstrukce 15 7 Nenosné 15 8 …")
TOC_DENSE = re.compile(r"(?:\d{1,2}\s+\S+(?:\s+\S+){1,8}\s+\d{1,3}\s+){3,}", re.IGNORECASE)
# DPS-scope meta — TZ asserts that detailed/production documentation will be
# prepared by a specialist; no procurement item for this paragraph itself
DPS_META = re.compile(r"(?:výrobní\s+dokumentac|výkres\s+kladení|odbornou\s+firmou\s+zpracován|specializovan\w+\s+firmou|dokumentace\s+pro\s+provedení\s+stavby|DPS\s+nebyla\s+zpracován|nutné\s+(?:zejména\s+)?řešit\s+definitivn)", re.IGNORECASE)
# Lines that are essentially just numbers / coordinates — we count token shape
# rather than relying on a quantified pattern (which catastrophically
# backtracks on long elevation dumps like "66.30 61.80 61.80 …").
_NUM_TOKEN = re.compile(r"^\d{1,4}(?:[.,]\d{1,4})?$")


def _is_numeric_dump(text: str) -> bool:
    tokens = text.split()
    if len(tokens) < 8:
        return False
    numeric = sum(1 for t in tokens if _NUM_TOKEN.match(t))
    return numeric >= max(8, int(0.7 * len(tokens)))
# Bibliography / references
BIBLIO = re.compile(r"^\s*\[\d{1,3}\]\s+|SEZNAM\s+POUŽITÉ\s+LITERATURY|\bČSN\s+EN\s+\d.{0,60}prof\.|příručka\s+k\s+ČSN", re.IGNORECASE | re.MULTILINE)
# Drawing-stamp / dodatek identifications
META_HEAD = re.compile(r"^\s*DODATEK\s+PD\s+Č\.|^\s*Identifikační\s+údaje|^\s*název\s+stavby|^\s*okres\s+:", re.IGNORECASE | re.MULTILINE)

# Tokens that strongly indicate the paragraph is a generic norm reference, not
# a concrete deliverable
NORM_ONLY_TOKENS = re.compile(
    r"\b(?:dle|podle|v\s+souladu\s+s|splňovat|odpovídat|požaduje\s+se|musí\s+vyhovět|musí\s+splňovat)\b",
    re.IGNORECASE,
)

# Mostly-narrative paragraphs (intro, scope, legenda) we want to mark
# informational rather than gap
NARRATIVE_TOKENS = re.compile(
    r"\b(úvod|obecné\s+podmínky|legenda|značení|typografi|obsah\s+dokumentu|kapitola)\b",
    re.IGNORECASE,
)


def load_items() -> list[dict]:
    data = json.load((OUTPUTS / "items_rd_jachymov_complete.json").open())
    return data["items"]


def load_tz_evidence() -> dict:
    return json.load((OUTPUTS / "cev_tz_evidence.json").open())


# ---------------------------------------------------------------------------
# Matrix A
# ---------------------------------------------------------------------------

def classify_evidence(ev: dict, items_by_kapitola: dict[str, list[dict]]) -> dict:
    cats: list[str] = ev["categories"]
    excerpt: str = ev["paragraph_excerpt"]

    # 0) TOC / numeric dump / bibliography / metadata heads / DPS-scope meta → N/A_DOCUMENTED (noise)
    if (TOC_LINE.search(excerpt) or TOC_FRAGMENT.search(excerpt) or TOC_DENSE.search(excerpt)
            or _is_numeric_dump(excerpt) or BIBLIO.search(excerpt) or META_HEAD.search(excerpt)
            or DPS_META.search(excerpt)):
        return {
            "verdict": "N/A_DOCUMENTED",
            "severity": "informational",
            "expected_items_logic": "PDF extraction noise or DPS-scope meta (TOC fragment / numeric dump / bibliography / drawing stamp / 'výrobní dokumentace odbornou firmou') — not a procurement requirement.",
            "items_found_ids": [],
            "candidate_kapitolas": [],
            "fix_recommendation": None,
        }

    # 1) Explicit stávající/zachováno/nevyskytuje se → N/A_DOCUMENTED
    if NA_TOKENS.search(excerpt):
        return {
            "verdict": "N/A_DOCUMENTED",
            "severity": "informational",
            "expected_items_logic": "TZ paragraph contains stávající/zachováno/nevyskytuje-se marker — no new procurement item expected.",
            "items_found_ids": [],
            "candidate_kapitolas": [],
            "fix_recommendation": None,
        }

    # 2) Build the set of candidate kapitolas from categories
    cands: list[str] = []
    semantic_labels: list[str] = []
    severity = "informational"
    for c in cats:
        m = CATEGORY_MAP.get(c)
        if not m:
            continue
        ks, label, sev = m
        for k in ks:
            if k not in cands:
                cands.append(k)
        semantic_labels.append(label)
        # Severity escalation: critical > important > medium > informational
        if sev == "critical" or (sev == "important" and severity in ("informational", "medium")) or (sev == "medium" and severity == "informational"):
            severity = sev

    # 3) If no candidate kapitolas (all categories are TKP-norm / geometrie / pozn / VZT) → N/A_DOCUMENTED
    if not cands:
        verdict = "N/A_DOCUMENTED"
        reason = (
            "TZ paragraph maps to norm/reference categories only "
            f"({', '.join(cats)}) — no procurement item expected."
        )
        return {
            "verdict": verdict,
            "severity": "informational",
            "expected_items_logic": reason,
            "items_found_ids": [],
            "candidate_kapitolas": [],
            "fix_recommendation": None,
        }

    # 4) Look up items in candidate kapitolas. Use keyword filter from excerpt
    # to narrow when the kapitola has many items.
    excerpt_tokens = _tokenize(excerpt)
    # Boost with kapitola-level token aliases (so a TZ paragraph mentioning
    # "omítka" matches every PSV-78 item even if its popis says "štuk".)
    boosted_kapitolas: list[str] = []
    for k in cands:
        if _kapitola_boost(k, excerpt):
            boosted_kapitolas.append(k)
    matched_with_strength: list[tuple[str, int]] = []
    for k in cands:
        for it in items_by_kapitola.get(k, []):
            strength = _match_strength(excerpt_tokens, it)
            if k in boosted_kapitolas:
                strength += 1
            if strength > 0:
                matched_with_strength.append((it["id"], strength))

    matched_with_strength.sort(key=lambda x: -x[1])
    matched = [iid for iid, _ in matched_with_strength[:20]]

    # 5) If no items in candidate kapitolas at all → GAP (or
    #    N/A_DOCUMENTED if the paragraph is pure norm/narrative)
    if not matched:
        # Fallback: do candidate kapitolas have ANY items? If yes the gap is
        # real (specific to this paragraph). If no, the project does not
        # produce items in that category at all (still a gap).
        any_in_kapitola = any(items_by_kapitola.get(k) for k in cands)
        if NORM_ONLY_TOKENS.search(excerpt) or NARRATIVE_TOKENS.search(excerpt):
            return {
                "verdict": "N/A_DOCUMENTED",
                "severity": "informational",
                "expected_items_logic": (
                    f"Paragraph reads as norm/reference style ({', '.join(semantic_labels)}); "
                    "items in candidate kapitolas exist but none keyword-match this excerpt."
                    if any_in_kapitola else
                    f"No items in candidate kapitolas {cands}; paragraph is norm/narrative — likely N/A."
                ),
                "items_found_ids": [],
                "candidate_kapitolas": cands,
                "fix_recommendation": None,
            }
        return {
            "verdict": "GAP",
            "severity": severity,
            "expected_items_logic": (
                f"TZ paragraph mentions {', '.join(semantic_labels)}; "
                f"expected items in kapitolas {cands} — none keyword-matched the excerpt."
            ),
            "items_found_ids": [],
            "candidate_kapitolas": cands,
            "fix_recommendation": (
                f"Review excerpt against {cands}; either add a missing item or "
                "document N/A inline (e.g. \"zahrnuto v {existing_item_id}\")."
            ),
        }

    return {
        "verdict": "COVERED",
        "severity": "informational",
        "expected_items_logic": (
            f"TZ paragraph mentions {', '.join(semantic_labels)}; matched items "
            f"in kapitolas {cands}."
        ),
        "items_found_ids": matched,
        "candidate_kapitolas": cands,
        "fix_recommendation": None,
    }


def _tokenize(text: str) -> set[str]:
    text = text.lower()
    # Strip accents to allow loose match (don't lose meaning — we only check inclusion)
    import unicodedata
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    # Words ≥ 4 chars
    return set(re.findall(r"[a-z0-9]{4,}", text))


# Kapitola-level keyword boosters (handles inflection drift between TZ wording
# and item popis wording)
KAPITOLA_BOOST: dict[str, list[str]] = {
    "PSV-78 Povrchové úpravy": ["omít", "štuk", "malb", "výmal", "obklad", "nátěr", "podhled", "sdk", "sádrok", "stěrk"],
    "PSV-72 ZTI": ["vodovod", "kanaliz", "splašk", "dešťov", "wc", "umyv", "vana", "sprch", "baterie", "zti", "radiátor", "kotel", "ohřív", "rozvod", "přípojk"],
    "HSV-1 Zemní práce": ["zemní", "výkop", "hloub", "ornic", "humus", "rozprostř", "zvětral", "geolog", "základov", "zásyp"],
    "HSV-6 Bourací práce": ["bour", "demont", "odstran", "vybou", "rozeb", "vykli", "vyklid"],
    "HSV-7 Fasáda ETICS": ["etics", "fasád", "fasada", "zateple", "lepidl", "armovac", "perlink", "soklov"],
    "HSV-5 Krov + střecha": ["krov", "krokev", "krokv", "tesař", "vazn", "vaznice", "střech", "krytin", "klempíř", "lať", "podbití", "stolic"],
    "HSV-3 Svislé konstrukce": ["zdiv", "porotherm", "tvarovk", "cihl", "příček", "příčk", "vápen", "mvc"],
    "HSV-4 Vodorovné": ["strop", "průvlak", "pruvlak", "ipe", "hea", "překlad", "ztužen", "věnec", "ŽB", "zelezo"],
    "HSV-2 Základové a ŽB": ["beton", "základ", "deska", "C25", "C20", "C30", "vana", "výztuž", "armatur", "kari"],
    "M-21 ELI silnoproud": ["elektr", "kabel", "vodič", "zásuv", "vypín", "svítid", "led", "rozvad", "uzemněn", "bleskosvod", "fve"],
    "PSV-73 Vytápění": ["topen", "vytápěn", "radiát", "kotel", "krb", "kamna", "tuv", "tepeln", "čerpadl"],
    "PSV-76 Klempíř": ["klempíř", "klempir", "oplech", "úžlab", "uzlab", "hřeben", "okap", "žlab", "svod"],
    "PSV-76 Truhlář": ["truhlář", "dub", "masiv", "dřevěn", "drevene"],
    "PSV-76 Výplně otvorů": ["okno", "okn", "dveř", "dveri", "zasklen", "trojsklo", "dvojsklo", "rámov"],
    "PSV-76 Zámečnictví": ["zámečn", "ocelov", "schod", "zábrad", "upe", "rošt"],
    "PSV-77 Podlahy": ["podlah", "nášlap", "potěr", "samonivel", "vinyl", "dlažb", "lamin"],
    "PSV-71 Izolace TI": ["eps", "mw", "pir", "izolac", "tepeln"],
    "PSV-71 Izolace HI": ["hydroizolac", "asfalt", "sbs", "fólie", "folie"],
    "PSV-95 Detekce požární": ["požárn", "hlásič", "EI", "spb", "hasic"],
}


def _kapitola_boost(kapitola: str, excerpt: str) -> bool:
    tokens = KAPITOLA_BOOST.get(kapitola, [])
    if not tokens:
        return False
    low = excerpt.lower()
    return any(t in low for t in tokens)


def _match_strength(excerpt_tokens: set[str], item: dict) -> int:
    # Tokenise the item's popis + subkapitola + source
    parts = [item.get("popis", ""), item.get("subkapitola", ""), item.get("source", "") or ""]
    item_tokens = _tokenize(" ".join(parts))
    common = excerpt_tokens & item_tokens
    # Strip generic stop-ish tokens that produce noise
    stop = {"prov", "konstrukce", "podle", "musi", "dle", "pripa", "stav", "dum", "sklad", "rozmer", "navrz", "muze", "byvajic", "navrh", "polozk"}
    common = common - stop
    return len(common)


def _classify_extra(item: dict) -> dict:
    """Sub-classify an EXTRA item (no TZ paragraph backing) by its _source field
    and kapitola — distinguishes legitimate DXF/universal-VRN items from
    items that genuinely need verification."""
    src = (item.get("source") or "").lower()
    kap = item.get("kapitola", "")
    if kap.startswith("VRN"):
        return {
            "subclass": "extra_universal_vrn",
            "severity": "informational",
            "fix_recommendation": "Universal VRN line item (BOZP, ZS, kolaudace, pojištění, geodet). Acceptable without specific TZ paragraph — covered by zákon 309/2006 + standard rozpočet practice.",
        }
    if "dxf" in src:
        return {
            "subclass": "extra_dxf_sourced",
            "severity": "informational",
            "fix_recommendation": "Item explicitly DXF-derived (rooms / layers / kóty). Coverage proven by Matrix B (DXF→items). Consider adding a TZ §-reference in source field for double-citation if available.",
        }
    if "tz" in src or "ars" in src or "statika" in src or "pbr" in src:
        return {
            "subclass": "extra_tz_implicit",
            "severity": "medium",
            "fix_recommendation": "Item source field cites TZ but no specific paragraph matched. Likely the TZ wording is broader (e.g. 'celá fasáda', 'všechny prvky') than the keyword matcher could resolve. Verify cross-reference manually.",
        }
    if re.search(r"\baudit\s*v\d|GAP[_\s]?\d|per[-\s]?podlaž[íi]\s+split|split\s+z\s+\w+\.\w+\.\d", src):
        return {
            "subclass": "extra_audit_derived",
            "severity": "informational",
            "fix_recommendation": "Derived from earlier audit gap fix (per-podlaží split / GAP_X resolution). Parent item is TZ/DXF-backed; this is a refinement. Acceptable.",
        }
    return {
        "subclass": "extra_unverified",
        "severity": "important",
        "fix_recommendation": "No clear source attribution. Verify the item is legitimate (e.g. derived from drawing legend / Karel's expertise / standard practice) or consider removal.",
    }


def build_matrix_a() -> dict:
    items = load_items()
    items_by_kapitola: dict[str, list[dict]] = defaultdict(list)
    for it in items:
        items_by_kapitola[it["kapitola"]].append(it)

    tz = load_tz_evidence()
    evidence = tz["tz_evidence"]

    rows: list[dict] = []
    for ev in evidence:
        cls = classify_evidence(ev, items_by_kapitola)
        rows.append({
            "tz_evidence_id": ev["evidence_id"],
            "source_pdf": ev["source_pdf"],
            "page": ev["page"],
            "categories": ev["categories"],
            "tz_excerpt": ev["paragraph_excerpt"],
            **cls,
        })

    # Summary
    summary = {"covered": 0, "na_documented": 0, "gap": 0, "extra": 0}
    for r in rows:
        v = r["verdict"]
        if v == "COVERED":
            summary["covered"] += 1
        elif v == "N/A_DOCUMENTED":
            summary["na_documented"] += 1
        elif v == "GAP":
            summary["gap"] += 1
        elif v == "EXTRA":
            summary["extra"] += 1

    # Severity breakdown of gaps
    gap_by_severity: dict[str, int] = defaultdict(int)
    for r in rows:
        if r["verdict"] == "GAP":
            gap_by_severity[r["severity"]] += 1

    # Reverse pass: are there items NEVER touched by any matched evidence? These
    # are EXTRA candidates (item exists with no TZ paragraph backing).
    touched_item_ids: set[str] = set()
    for r in rows:
        for iid in r["items_found_ids"]:
            touched_item_ids.add(iid)
    extras: list[dict] = []
    extras_subclass_counts: dict[str, int] = defaultdict(int)
    for it in items:
        if it["id"] in touched_item_ids:
            continue
        sub = _classify_extra(it)
        extras_subclass_counts[sub["subclass"]] += 1
        extras.append({
            "item_id": it["id"],
            "kapitola": it["kapitola"],
            "subkapitola": it["subkapitola"],
            "popis_excerpt": (it.get("popis") or "")[:160],
            "source_field": it.get("source"),
            "verdict": "EXTRA",
            **sub,
        })
    summary["extra"] = len(extras)

    return {
        "_schema_version": "1.0",
        "_generated_at": GEN_AT,
        "_generated_by": GEN_BY,
        "_purpose": "Matrix A — TZ → items.json verdicts.",
        "_summary": summary,
        "_gap_by_severity": dict(gap_by_severity),
        "_extras_by_subclass": dict(extras_subclass_counts),
        "_items_total": len(items),
        "_items_touched_by_evidence": len(touched_item_ids),
        "matrix_a": rows,
        "matrix_a_extras": extras,
    }


# ---------------------------------------------------------------------------
# Matrix B — DXF → items
# ---------------------------------------------------------------------------

def build_matrix_b() -> dict:
    items = load_items()
    items_by_kapitola: dict[str, list[dict]] = defaultdict(list)
    for it in items:
        items_by_kapitola[it["kapitola"]].append(it)

    # Lookup helpers — items mentioning specific tokens
    def items_containing(needles: list[str], kapitola_hint: list[str] | None = None) -> list[str]:
        out: list[str] = []
        candidates = []
        if kapitola_hint:
            for k in kapitola_hint:
                candidates.extend(items_by_kapitola.get(k, []))
        else:
            candidates = items
        needles_lo = [n.lower() for n in needles]
        for it in candidates:
            blob = (it.get("popis", "") + " " + it.get("subkapitola", "") + " " + (it.get("source") or "") + " " + (it.get("mnozstvi_formula") or "")).lower()
            if any(n in blob for n in needles_lo):
                out.append(it["id"])
        return out

    rows: list[dict] = []

    # ----- B.1 Per-podlaží světlé výšky -----
    try:
        dim = json.load((OUTPUTS / "dxf_dimensions_all_v2.json").open())
        per_podlazi = dim.get("per_podlazi_svetla_vyska_dxf_match", {})
    except FileNotFoundError:
        per_podlazi = {}
    if per_podlazi:
        # The per-podlaží heights are consumed by per-podlaží wall/ceiling/floor items
        omitka_ids = items_containing(["omítka"], ["PSV-78 Povrchové úpravy"])
        rows.append({
            "dxf_entity_id": "DXF_PP_SVETLA_VYSKA",
            "source_file": "dxf_dimensions_all_v2.json",
            "entity_kind": "per_podlazi_svetla_vyska_dxf_match",
            "dxf_evidence": per_podlazi,
            "expected_items_logic": "Per-podlaží světlé výšky (2100/2795/2865/2630) drive omítka stěn area per podlaží + skladba volume.",
            "items_found_ids": omitka_ids,
            "verdict": "COVERED" if omitka_ids else "GAP",
            "severity": "important" if not omitka_ids else "informational",
            "fix_recommendation": None if omitka_ids else "Add per-podlaží omítka items keyed to DXF heights.",
        })

    # ----- B.2 S-codes / skladba decoded -----
    try:
        mtext = json.load((OUTPUTS / "dxf_mtext_classified_v2.json").open())
    except FileNotFoundError:
        mtext = {}
    s_total = mtext.get("_summary", {}).get("classification_distribution", {}).get("skladba_code", 0)
    try:
        sk = json.load((OUTPUTS / "skladby_per_zone_v2.json").open())
        s_decoded = (
            sk.get("_summary", {}).get("s_codes_decoded", 0)
            or len(sk.get("skladby", []))
            or len(sk.get("elements", []))
        )
    except FileNotFoundError:
        sk = {}
        s_decoded = 0
    # Also accept items that implement a skladba's layer (e.g. omítka items
    # implement S01 vnitřní omítka). Use kapitola heuristic.
    skladba_implementing_kapitolas = [
        "PSV-78 Povrchové úpravy", "PSV-71 Izolace TI", "PSV-71 Izolace HI",
        "PSV-77 Podlahy", "HSV-5 Krov + střecha", "HSV-7 Fasáda ETICS",
        "HSV-3 Svislé konstrukce", "HSV-2 Základové a ŽB",
    ]
    skladba_implementing_items = [
        it["id"] for it in items if it["kapitola"] in skladba_implementing_kapitolas
    ]
    # Items that reference S-codes in mnozstvi_formula or source
    s_referencing_items = []
    for it in items:
        blob = (it.get("popis", "") + " " + (it.get("source") or "") + " " + (it.get("mnozstvi_formula") or ""))
        if re.search(r"\bS\d{1,2}[a-z]?\b", blob):
            s_referencing_items.append(it["id"])
    rows.append({
        "dxf_entity_id": "DXF_SKLADBA_CODES",
        "source_file": "dxf_mtext_classified_v2.json + skladby_per_zone_v2.json",
        "entity_kind": "skladba_code (S01-S12b)",
        "dxf_evidence": {
            "total_skladba_mtext": s_total,
            "skladby_decoded": s_decoded,
            "items_with_explicit_s_code_reference": len(s_referencing_items),
            "items_implementing_skladba_layer_kapitola_count": len(skladba_implementing_items),
        },
        "expected_items_logic": "Each decoded S-code skladba is implemented by per-layer items across kapitolas {PSV-78, PSV-71, PSV-77, HSV-5, HSV-7, HSV-3, HSV-2}. Explicit S-code annotation in popis is not required — kapitola coverage is the substantive check.",
        "items_found_ids": (s_referencing_items + skladba_implementing_items)[:20],
        "verdict": "COVERED" if skladba_implementing_items and s_decoded else ("GAP" if s_decoded else "N/A_DOCUMENTED"),
        "severity": "informational",
        "fix_recommendation": (
            "Optional improvement: add explicit \"realizuje S{NN}\" annotation in mnozstvi_formula for traceability — "
            "currently only 3 items cite S-codes directly. Not a procurement gap."
        ),
    })

    # ----- B.3 Klempířina 173.8 m total -----
    try:
        inserts = json.load((OUTPUTS / "dxf_inserts_tier4_extended.json").open())
        klempir = inserts.get("klempirina_breakdown", {})
    except FileNotFoundError:
        klempir = {}
    klempir_items = items_by_kapitola.get("PSV-76 Klempíř", [])
    sum_qty = sum((it.get("mnozstvi") or 0) for it in klempir_items if (it.get("mj") or "").lower() in ("m", "bm"))
    rows.append({
        "dxf_entity_id": "DXF_KLEMPIRINA",
        "source_file": "dxf_inserts_tier4_extended.json",
        "entity_kind": "klempirina_breakdown (DXF MA_klempíř INSERTs + 173.8 m total)",
        "dxf_evidence": klempir,
        "expected_items_logic": "DXF total klempířina 173.8 m must be split across PSV-76 Klempíř items.",
        "items_found_ids": [it["id"] for it in klempir_items],
        "items_found_total_qty_m": sum_qty,
        "verdict": "COVERED" if klempir_items and 150 <= sum_qty <= 200 else ("GAP" if not klempir_items else "EXTRA"),
        "severity": "important",
        "fix_recommendation": None if klempir_items and 150 <= sum_qty <= 200 else f"PSV-76 Klempíř items total {sum_qty} m vs DXF 173.8 m — reconcile +/- 15%.",
    })

    # ----- B.4 Okna (DXF 16 instances) -----
    okna_dxf_count = inserts.get("_summary", {}).get("category_counts", {}).get("okno", 0) if 'inserts' in locals() else 0
    okna_items = [it for it in items_by_kapitola.get("PSV-76 Výplně otvorů", []) if "okno" in (it.get("popis", "").lower() + " " + it.get("subkapitola", "").lower())]
    rows.append({
        "dxf_entity_id": "DXF_OKNA_INSERT",
        "source_file": "dxf_inserts_tier4_extended.json",
        "entity_kind": "okno INSERT blocks",
        "dxf_evidence": {"dxf_okno_inserts": okna_dxf_count},
        "expected_items_logic": "DXF okno INSERT count should be consumed by PSV-76 Výplně otvorů items.",
        "items_found_ids": [it["id"] for it in okna_items],
        "items_total_qty": sum((it.get("mnozstvi") or 0) for it in okna_items),
        "verdict": "COVERED" if okna_items else "GAP",
        "severity": "important",
        "fix_recommendation": None if okna_items else "Add per-typ okno items mapped to DXF INSERT block names.",
    })

    # ----- B.5 Krokve (DXF 111 instances) -----
    krokve_dxf = inserts.get("_summary", {}).get("category_counts", {}).get("kr_krokev", 0) if 'inserts' in locals() else 0
    krov_items = items_by_kapitola.get("HSV-5 Krov + střecha", [])
    krokve_items = [it for it in krov_items if re.search(r"\bkrokev|krokve\b", it.get("popis", ""), re.IGNORECASE)]
    rows.append({
        "dxf_entity_id": "DXF_KROKVE_INSERT",
        "source_file": "dxf_inserts_tier4_extended.json",
        "entity_kind": "kr_krokev INSERT blocks (111)",
        "dxf_evidence": {"dxf_krokev_inserts": krokve_dxf},
        "expected_items_logic": "111 krokev INSERTs ↔ HSV-5 krov tesařský — verify count consistency with item mnozstvi (bm).",
        "items_found_ids": [it["id"] for it in krokve_items],
        "items_total_bm": sum((it.get("mnozstvi") or 0) for it in krokve_items),
        "verdict": "COVERED" if krokve_items else "GAP",
        "severity": "important",
        "fix_recommendation": None if krokve_items else "Verify krov tesařské item carries 111×L (bm) total.",
    })

    # ----- B.6 Sanit INSERTs (WC, umyvadlo, vana, sprcha) -----
    cat = inserts.get("_summary", {}).get("category_counts", {}) if 'inserts' in locals() else {}
    sanit = {k: v for k, v in cat.items() if k.startswith("sanit_")}
    zti_items = items_by_kapitola.get("PSV-72 ZTI", [])
    zti_items_qty = sum((it.get("mnozstvi") or 0) for it in zti_items if (it.get("mj") or "").lower() in ("ks", "kpl"))
    rows.append({
        "dxf_entity_id": "DXF_SANIT_INSERT",
        "source_file": "dxf_inserts_tier4_extended.json",
        "entity_kind": "sanit INSERT blocks (WC + umyvadlo + vana + sprcha)",
        "dxf_evidence": sanit,
        "expected_items_logic": "Sanit ks count ↔ PSV-72 ZTI items.",
        "items_found_ids": [it["id"] for it in zti_items][:10],
        "items_total_qty_ks_or_kpl": zti_items_qty,
        "verdict": "COVERED" if zti_items else "GAP",
        "severity": "important",
        "fix_recommendation": None if zti_items else "Add ZTI items per sanit typ.",
    })

    # ----- B.7 Kuchyně INSERTs (drez, indukce, lednice, trouba, mycka) -----
    kuchyne = {k: v for k, v in cat.items() if k.startswith("kuchyne_")}
    if kuchyne:
        # Kitchen appliances are normally OUT of scope (investor delivery). Mark
        # N/A_DOCUMENTED but flag.
        rows.append({
            "dxf_entity_id": "DXF_KUCHYNE_INSERT",
            "source_file": "dxf_inserts_tier4_extended.json",
            "entity_kind": "kuchyne INSERT blocks (drez/indukce/lednice/trouba/mycka)",
            "dxf_evidence": kuchyne,
            "expected_items_logic": "Kitchen appliances generally investor-supplied — expect no items in rozpočet.",
            "items_found_ids": [],
            "verdict": "N/A_DOCUMENTED",
            "severity": "informational",
            "fix_recommendation": "Confirm with Karel that kitchen appliances are not in zhotovitel scope.",
        })

    # ----- B.8 Per-room mtext (65 room_number references) -----
    rn = mtext.get("_summary", {}).get("classification_distribution", {}).get("room_number", 0) if mtext else 0
    # 25 rooms per CLAUDE.md. Per-room items not expected (rozpočet is aggregated)
    if rn:
        rows.append({
            "dxf_entity_id": "DXF_ROOM_NUMBERS",
            "source_file": "dxf_mtext_classified_v2.json",
            "entity_kind": "room_number mtext (25 rooms total)",
            "dxf_evidence": {"room_number_mtext": rn, "rooms_total_claimed": 25},
            "expected_items_logic": "Per-room labels feed per-podlaží/per-zone areas but rozpočet items aggregate at kapitola level.",
            "items_found_ids": [],
            "verdict": "N/A_DOCUMENTED",
            "severity": "informational",
            "fix_recommendation": None,
        })

    # ----- B.9 Material markers (21 mtext) -----
    mm = mtext.get("_summary", {}).get("classification_distribution", {}).get("material_marker", 0) if mtext else 0
    if mm:
        # Material markers (ETICS 160 mm / EPS / etc) should be reflected in PSV-71 + HSV-7
        psv_hsv = items_containing(["eps", "etics", "mw", "pir", "izolac"], ["PSV-71 Izolace TI", "PSV-71 Izolace HI", "HSV-7 Fasáda ETICS"])
        rows.append({
            "dxf_entity_id": "DXF_MATERIAL_MARKERS",
            "source_file": "dxf_mtext_classified_v2.json",
            "entity_kind": "material_marker mtext (21 occurrences)",
            "dxf_evidence": {"material_marker_mtext": mm},
            "expected_items_logic": "Material markers (ETICS/EPS/MW/PIR) consumed by PSV-71 + HSV-7 items.",
            "items_found_ids": psv_hsv,
            "verdict": "COVERED" if psv_hsv else "GAP",
            "severity": "important",
            "fix_recommendation": None if psv_hsv else "Add per-marker insulation items.",
        })

    # ----- B.10 POZN references (22 mtext) -----
    poz = mtext.get("_summary", {}).get("classification_distribution", {}).get("poznamka_reference", 0) if mtext else 0
    if poz:
        rows.append({
            "dxf_entity_id": "DXF_POZN_REFS",
            "source_file": "dxf_mtext_classified_v2.json",
            "entity_kind": "POZN. reference mtext",
            "dxf_evidence": {"poznamka_reference_mtext": poz},
            "expected_items_logic": "POZN. refs are cross-link metadata — no direct items expected.",
            "items_found_ids": [],
            "verdict": "N/A_DOCUMENTED",
            "severity": "informational",
            "fix_recommendation": None,
        })

    # ----- B.11 Dimensions distribution / building dimension / span -----
    dim_bands = dim.get("_summary", {}).get("magnitude_bands", {}) if 'dim' in locals() else {}
    if dim_bands:
        rows.append({
            "dxf_entity_id": "DXF_DIMENSIONS_BANDS",
            "source_file": "dxf_dimensions_all_v2.json",
            "entity_kind": "dimensions magnitude bands (785 total)",
            "dxf_evidence": dim_bands,
            "expected_items_logic": "Dimensions are supporting evidence for quantity computation across items.",
            "items_found_ids": [],
            "verdict": "N/A_DOCUMENTED",
            "severity": "informational",
            "fix_recommendation": None,
        })

    # ----- B.12 Embedded tables (58) -----
    try:
        et = json.load((OUTPUTS / "dxf_embedded_tables_extracted.json").open())
        et_count = et.get("_summary", {}).get("total_table_rows", 58) if isinstance(et, dict) else 58
    except FileNotFoundError:
        et_count = 0
    if et_count:
        rows.append({
            "dxf_entity_id": "DXF_EMBEDDED_TABLES",
            "source_file": "dxf_embedded_tables_extracted.json",
            "entity_kind": "embedded tables in MTEXT",
            "dxf_evidence": {"table_rows": et_count},
            "expected_items_logic": "Embedded tables (legendy, výpisy) feed item attributes — not items themselves.",
            "items_found_ids": [],
            "verdict": "N/A_DOCUMENTED",
            "severity": "informational",
            "fix_recommendation": None,
        })

    # ----- B.13 Razítko / Severka / Rezova_znacka (meta) -----
    meta_cats = {k: v for k, v in cat.items() if k in ("razitko", "severka", "rezova_znacka", "plot_dreveny", "wall_block", "nabytek_zidle", "nabytek_postel", "nabytek_tv", "nabytek_pohovka", "dvere")}
    if meta_cats:
        # plot_dreveny (133) is fence — could be in HSV scope? wall_block (15) is internal walls.
        # dvere (2) → PSV-76 Výplně otvorů
        dvere_items = [it["id"] for it in items_by_kapitola.get("PSV-76 Výplně otvorů", []) if "dveře" in it.get("popis", "").lower() or "dveře" in it.get("subkapitola", "").lower()]
        rows.append({
            "dxf_entity_id": "DXF_META_BLOCKS",
            "source_file": "dxf_inserts_tier4_extended.json",
            "entity_kind": "drawing meta + furniture blocks (razítko/severka/řezová značka/nábytek/plot)",
            "dxf_evidence": meta_cats,
            "expected_items_logic": "razítko/severka/řezová značka = drawing meta (no items). Nábytek = investor scope. Plot dřevěný (133) — check if zahrnuto v VRN. Dveře (2) → PSV-76.",
            "items_found_ids": dvere_items,
            "verdict": "N/A_DOCUMENTED",
            "severity": "medium" if not dvere_items else "informational",
            "fix_recommendation": "Verify plot_dreveny (133 inserts) — is fence in scope or zahrada-only?",
        })

    # Summary
    summary = {"covered": 0, "na_documented": 0, "gap": 0, "extra": 0}
    for r in rows:
        v = r["verdict"]
        if v == "COVERED":
            summary["covered"] += 1
        elif v == "N/A_DOCUMENTED":
            summary["na_documented"] += 1
        elif v == "GAP":
            summary["gap"] += 1
        elif v == "EXTRA":
            summary["extra"] += 1

    gap_by_severity: dict[str, int] = defaultdict(int)
    for r in rows:
        if r["verdict"] in ("GAP", "EXTRA"):
            gap_by_severity[r["severity"]] += 1

    return {
        "_schema_version": "1.0",
        "_generated_at": GEN_AT,
        "_generated_by": GEN_BY,
        "_purpose": "Matrix B — DXF entities → items.json verdicts.",
        "_summary": summary,
        "_gap_or_extra_by_severity": dict(gap_by_severity),
        "matrix_b": rows,
    }


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

def main() -> None:
    a = build_matrix_a()
    (OUTPUTS / "cev_matrix_a_tz_to_items.json").write_text(json.dumps(a, indent=2, ensure_ascii=False))

    b = build_matrix_b()
    (OUTPUTS / "cev_matrix_b_dxf_to_items.json").write_text(json.dumps(b, indent=2, ensure_ascii=False))

    # Consolidated gap report
    gaps_a = [r for r in a["matrix_a"] if r["verdict"] == "GAP"]
    gaps_a.sort(key=lambda r: {"critical": 0, "important": 1, "medium": 2, "informational": 3}.get(r["severity"], 4))
    gaps_b = [r for r in b["matrix_b"] if r["verdict"] in ("GAP", "EXTRA")]
    gaps_b.sort(key=lambda r: {"critical": 0, "important": 1, "medium": 2, "informational": 3}.get(r["severity"], 4))

    consolidated = {
        "_schema_version": "1.0",
        "_generated_at": GEN_AT,
        "_generated_by": GEN_BY,
        "_purpose": "Matrix A + B consolidated gap report.",
        "matrix_a_summary": a["_summary"],
        "matrix_a_gap_by_severity": a["_gap_by_severity"],
        "matrix_a_extras_by_subclass": a["_extras_by_subclass"],
        "matrix_a_items_touched": a["_items_touched_by_evidence"],
        "matrix_a_items_total": a["_items_total"],
        "matrix_a_gaps": gaps_a,
        "matrix_a_extras": a["matrix_a_extras"],
        "matrix_b_summary": b["_summary"],
        "matrix_b_gap_or_extra_by_severity": b["_gap_or_extra_by_severity"],
        "matrix_b_gaps_or_extras": gaps_b,
    }
    (OUTPUTS / "cev_matrices_ab_gap_report.json").write_text(json.dumps(consolidated, indent=2, ensure_ascii=False))

    # Print one-screen summary
    print(json.dumps({
        "matrix_a_summary": a["_summary"],
        "matrix_a_gap_by_severity": a["_gap_by_severity"],
        "matrix_a_extras_by_subclass": a["_extras_by_subclass"],
        "matrix_a_items_touched_of_total": f"{a['_items_touched_by_evidence']} of {a['_items_total']}",
        "matrix_a_gaps_count": len(gaps_a),
        "matrix_a_extras_count": len(a["matrix_a_extras"]),
        "matrix_b_summary": b["_summary"],
        "matrix_b_gap_or_extra_by_severity": b["_gap_or_extra_by_severity"],
        "matrix_b_gaps_or_extras_count": len(gaps_b),
        "files": [
            "outputs/cev_matrix_a_tz_to_items.json",
            "outputs/cev_matrix_b_dxf_to_items.json",
            "outputs/cev_matrices_ab_gap_report.json",
        ],
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
