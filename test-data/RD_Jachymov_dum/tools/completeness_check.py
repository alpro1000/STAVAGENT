#!/usr/bin/env python3
"""
Completeness audit for items.json — orthogonal to Phase 0a (which checks
*sources* probed); this checks *works* present in soupis.

Four sections per Czech residential RD renovation + nástavba practice:

  A. TKP family coverage     — TKP 0–9 catalog families (zemní / základy /
                               svislé / vodorovné / komunikace / povrchy /
                               konstrukce / trubní / bourání), each must
                               have ≥ 1 item OR explicit N/A justification.

  B. Subdodavatel coverage   — each of 37 mapped trades (subdodavatel_mapping.json)
                               must have ≥ 1 item it executes, OR be marked
                               "not_in_scope" (e.g. mykolog if mykologický
                               průzkum negative).

  C. RD renovation anchor    — checklist of ~50 typical works for Czech RD
                               rekonstrukce + nástavba (HSV demolice + HSV
                               nová stavba + PSV finálka + TZB instalace +
                               VRN). Mark ✓ found / ✗ missing / N/A.

  D. TZ keyword scan         — regex search in TZ ARS + TZ statika + TZ
                               PBŘ for "provedení X", "instalace Y",
                               "montáž Z" patterns. Each verb-noun match
                               should map to a token in some item popis.
                               Unmapped → flag for review.

Output:
  outputs/items_completeness_audit.json — structured per section
  outputs/items_completeness_report.md  — human worksheet
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
ITEMS_JSON = PROJ / "outputs" / "items_rd_jachymov_complete.json"
SUBDOD_JSON = PROJ / "inputs" / "meta" / "subdodavatel_mapping.json"
TZ_DIR = PROJ / "inputs" / "tz"
OUT_JSON = PROJ / "outputs" / "items_completeness_audit.json"
OUT_MD = PROJ / "outputs" / "items_completeness_report.md"

TODAY = str(date.today())


def strip_dia(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", strip_dia(s).lower()).strip()


# ── Section A: TKP family map ───────────────────────────────────────────────
# Czech URS catalog top-level family per first 1-3 digits (per ÚRS TSKP třídník)
TKP_FAMILIES = {
    "0":   "VRN, společné konstrukce, ZS, doprava",
    "1":   "Zemní práce (sejmutí ornice, hloubení rýh/jam, výkopy)",
    "2":   "Základové konstrukce, ŽB pasy/desky/věnce, hydroizolace",
    "3":   "Svislé konstrukce (zdivo, příčky, sloupy)",
    "4":   "Vodorovné konstrukce (stropy, schodiště, překlady)",
    "5":   "Komunikace, zpevněné plochy, dlažby (NA mostech / silnicích — pro RD typicky 564 chodník + dvorek)",
    "6":   "Úpravy povrchů, omítky vnitřní/vnější, ETICS",
    "7":   "Konstrukce ostatní (izolace, výplně otvorů, klempířina, podlahy, malby, obklady)",
    "8":   "Trubní vedení (kanalizace venkovní, vodovod venkovní)",
    "9":   "Ostatní konstrukce (bourání, demolice, lešení, přesun hmot, VRN konstrukčního charakteru)",
}

# ── Section C: RD renovation anchor checklist ───────────────────────────────
# Tuples: (anchor_id, czech_label, keyword_tokens_OR, applicability_check)
# applicability_check: None = always required; (other_field, value) = required only if condition met
RD_ANCHORS = [
    # Demolice (HSV-6 / 9xx family)
    ("D01", "Bourání plechové krytiny",        ["bourani plech", "demontaz plech", "krytina"], "demolice_strecha"),
    ("D02", "Bourání keramických obkladů",      ["bourani obkladu", "demontaz obklad", "keramick"], "demolice_koupelna"),
    ("D03", "Bourání příček + zdiva",           ["bourani pricek", "bourani zdiva", "pricky"], "demolice_dispozice"),
    ("D04", "Bourání podlah",                   ["bourani podlah", "demontaz podlah"], "demolice_podlaha"),
    ("D05", "Bourání střešní krytiny + krov",   ["bourani strech", "bourani krov", "demolice krytiny"], "demolice_strecha"),
    ("D06", "Demontáž oken + dveří",            ["demontaz okna", "demontaz dvere", "vybourani okna"], "demolice_otvory"),
    ("D07", "Odstranění komínu",                ["bourani komin", "demolice komin", "odstrane komin"], "demolice_komin"),

    # Zemní + základy (TKP 1+2)
    ("Z01", "Sejmutí ornice",                   ["sejmuti ornic", "ornice"], None),
    ("Z02", "Hloubení rýh pro pasy",            ["hloubeni ryh"], "novy_zaklad"),
    ("Z03", "Hloubení jam (figury nepoužívat)", ["hloubeni jam"], "novy_zaklad"),
    ("Z04", "Odvoz výkopku na deponii",         ["odvoz vykopku", "vodorovne premisteni"], "novy_zaklad"),
    ("Z05", "Štěrkopískový zásyp / podsyp",    ["zasyp", "podsyp", "sterkopisk"], "novy_zaklad"),
    ("Z06", "Pažení výkopů (pokud nutno)",      ["pazeni", "rozepreni"], None),

    # ŽB konstrukce (TKP 2)
    ("B01", "Základové pasy / patky",           ["zaklad pas", "zaklad patk", "patky", "pas"], "novy_zaklad"),
    ("B02", "Základová deska na terénu",        ["zb deska", "zakladova deska"], "novy_zaklad"),
    ("B03", "Pozední věnec",                    ["pozedni venec", "venec"], None),
    ("B04", "Nabetonávka stropu",               ["nabetonavk"], "ocelobeton_strop"),
    ("B05", "Hydroizolace pod základ (BV)",     ["bila vana", "hydroizolac", "separac pe"], "bila_vana"),
    ("B06", "Bednění + odbednění ŽB",           ["bedneni", "odbedneni"], None),

    # Svislé konstrukce (TKP 3)
    ("S01", "Cihelné zdivo + překlady",         ["cihelne zdivo", "preklady"], "novostavba_zdivo"),
    ("S02", "Nadezdívka / dozdívka",            ["nadezdivk", "dozdivk"], None),
    ("S03", "SDK příčky + předstěny",           ["sdk pricky", "predsteny", "sadrokarton"], "sdk_kit"),

    # Vodorovné (TKP 4)
    ("V01", "Strop ocelobetonový (IPE+trapéz)", ["strop ocelobeton", "ipe", "trapez"], "ocelobeton_strop"),
    ("V02", "Schodiště (ŽB / dřevěné)",         ["schodist"], None),
    ("V03", "Krov dřevěný + krokve",            ["krov", "krokve", "krokev"], "krov"),
    ("V04", "Bednění krovu / OSB",              ["bedneni krov", "osb", "biodeska"], "krov"),

    # Krytina + klempířina (TKP 762/764/765)
    ("K01", "Falcovaná plechová krytina",       ["falcovan", "plechova krytina"], "krov"),
    ("K02", "Klempířina — atika",               ["klempir atik", "atik"], None),
    ("K03", "Klempířina — okap + svod",         ["okap", "svod"], None),
    ("K04", "Klempířina — parapety",            ["parapet"], None),

    # Fasáda (TKP 6 + 622)
    ("F01", "ETICS zateplení (EPS/MW)",         ["etics", "kontaktni zatepleni"], "fasada_etics"),
    ("F02", "Sokl XPS / tenkostěnný",           ["sokl xps", "sokl"], "fasada_etics"),
    ("F03", "Špalety oken (perimeter EPS)",     ["spalet"], "fasada_etics"),
    ("F04", "Tenkovrstvá omítka fasády",        ["tenkovrstv", "fasada omitka"], "fasada_etics"),

    # Výplně otvorů (TKP 766/767/611)
    ("O01", "Plastová okna trojsklem",          ["okno", "plastov okna"], "novostavba_otvory"),
    ("O02", "Vstupní dveře venkovní",           ["vstupni dvere", "venkovni dvere"], None),
    ("O03", "Vnitřní dveře + zárubně",          ["vnitrni dvere", "zarubn"], None),
    ("O04", "Venkovní žaluzie / kastlík",       ["zaluzie", "kastlik"], None),

    # Izolace (TKP 711/712/713)
    ("I01", "TI mezi krokvemi / nad krovem",    ["ti krov", "nad krokve", "mezi krokv", "pir"], "krov"),
    ("I02", "Podlahová TI (EPS)",               ["eps podlah", "podlahov eps", "tepelna izolace podlah"], None),
    ("I03", "Kročejová izolace",                ["krocejov"], None),
    ("I04", "Hydroizolace koupelen (stěrka)",   ["hydroizolac koupeln", "sterka koupeln"], "koupelna"),

    # Podlahy (TKP 771-775)
    ("P01", "Cementový potěr / lite směs",      ["potěr", "potřr", "anhydrit", "lit smes", "samonivelacni"], None),
    ("P02", "Vinyl / laminát nášlap",           ["vinyl", "laminat", "naslapn"], None),
    ("P03", "Keramická dlažba",                 ["dlazba"], None),
    ("P04", "Sokl k podlaze",                   ["sokl"], None),

    # Povrchové úpravy (TKP 612/783/784)
    ("U01", "Vnitřní omítka štuková",           ["omítk", "omitk", "stuk"], None),
    ("U02", "Obklad koupelen keramický",        ["obklad koupeln", "keramick obklad"], "koupelna"),
    ("U03", "Výmalba — finalní",                ["vymalb", "natěr", "nater", "mal"], None),

    # ZTI + vytápění + ELI (TKP 721-731 + M-21/22)
    ("T01", "Vodovod vnitřní rozvody",          ["vodovod rozvod", "rozvody vodovod"], None),
    ("T02", "Kanalizace splašková",             ["kanalizace splask", "odpadni rozvod", "ht potrubi"], None),
    ("T03", "Vytápění radiátory + rozvody",     ["radiator", "topen rozvod", "vytapeni"], "vytapeni"),
    ("T04", "Tepelné čerpadlo / kotel",         ["tepelne cerpadlo", "elektrokotel", "kotel"], "vytapeni"),
    ("T05", "Komín / komínové těleso",          ["komin"], "komin"),
    ("T06", "Sanita — WC, umyvadlo, vana",      ["sanit", "wc", "umyvadl", "vana koupeln", "sprch"], "koupelna"),
    ("T07", "ELI silnoproud — rozvody",         ["eli silnoproud", "silnoprou", "elektroinstalac"], None),
    ("T08", "ELI svítidla + zásuvky",           ["svitidl", "zasuvk", "vypin"], None),
    ("T09", "PD / detekce požární",             ["detekce poz", "edhp", "detekce kour"], None),

    # VRN (TKP 0)
    ("R01", "Zařízení staveniště + buňky",      ["zarizeni staveni", "bunk", "ZS"], None),
    ("R02", "Geodet + vytýčení",                ["geodet", "vytyceni"], None),
    ("R03", "BOZP koordinátor",                 ["bozp"], None),
    ("R04", "Odpady — odvoz na skládku",        ["odpad", "skladkovne", "skladkov"], None),
    ("R05", "Revize závěrečné",                 ["reviz"], None),
    ("R06", "Dokumentace skutečného provedení", ["DSP skuteč", "dokument provedeni"], None),
    ("R07", "Pojištění stavby",                 ["pojiste"], None),
    ("R08", "Energie staveniště",               ["energie staveni"], None),
    ("R09", "Kolaudace",                        ["kolaudac"], None),
]

# Applicability conditions — derived from project metadata. For RD Jáchymov:
APPLICABILITY = {
    "demolice_strecha": True,    # TZ demolice ARS dům — krytina + krov stávající
    "demolice_koupelna": True,   # 3 koupelny bourány komplet
    "demolice_dispozice": True,  # TZ §3.2 ARS dům — bourání příček
    "demolice_podlaha": True,    # TZ §3 — všechny podlahy nové
    "demolice_otvory": True,     # všechny okna + venkovní dveře nové
    "demolice_komin": False,     # komín ZACHOVÁN (nový kotel napojen)
    "novy_zaklad": True,         # opěrná stěna BV + sklad new
    "ocelobeton_strop": True,    # 2.NP + 3.NP nový strop IPE + trapéz
    "bila_vana": True,           # opěrná stěna BV ČSB02
    "novostavba_zdivo": True,    # nadezdívka 3.NP + sklad zdivo
    "sdk_kit": True,             # podhledy + příčky modernizace
    "krov": True,                # nový krov 3.NP nástavba
    "fasada_etics": True,        # ETICS EPS 70F 160 mm celý dům
    "novostavba_otvory": True,   # 16 oken nových + 2 vstupní + ~15 vnitřních
    "koupelna": True,            # 3 koupelny nové
    "vytapeni": True,            # TČ multisplit + krb + kamna + elektrokotel
    "komin": True,               # komín stávající zachován + nový kotel napojen
}


def item_text(it: dict) -> str:
    """Concatenated normalized searchable text per item."""
    parts = [
        it.get("popis", ""),
        it.get("subkapitola", ""),
        it.get("kapitola", ""),
    ]
    return norm(" ".join(parts))


def match_anchor(items: list[dict], keyword_tokens: list[str]) -> list[dict]:
    """Return items where ANY keyword token is found in normalized popis/kapitola."""
    norm_toks = [norm(t) for t in keyword_tokens]
    hits = []
    for it in items:
        txt = item_text(it)
        for tok in norm_toks:
            if tok in txt:
                hits.append(it)
                break
    return hits


# ── Section D: TZ keyword scan ──────────────────────────────────────────────
# Verb-noun patterns that indicate a discrete construction work
TZ_VERB_PATTERNS = [
    # "provedení X" / "provede se X"
    re.compile(r"\b(?:prove(?:dení|de|deno|den se))\s+([a-záčďéěíňóřšťúůýž][^,;\.\n]{4,60})", re.IGNORECASE),
    # "montáž X"
    re.compile(r"\b(?:montáž|montaz)\s+([a-záčďéěíňóřšťúůýž][^,;\.\n]{4,60})", re.IGNORECASE),
    # "instalace X"
    re.compile(r"\b(?:instalac(?:e|i)|instalova(?:t|t se))\s+([a-záčďéěíňóřšťúůýž][^,;\.\n]{4,60})", re.IGNORECASE),
    # "dodávka X" / "dodávky X"
    re.compile(r"\b(?:dodávk[ay])\s+([a-záčďéěíňóřšťúůýž][^,;\.\n]{4,60})", re.IGNORECASE),
    # "osazení X"
    re.compile(r"\b(?:osazení|osadi se)\s+([a-záčďéěíňóřšťúůýž][^,;\.\n]{4,60})", re.IGNORECASE),
    # "vybourání X" / "bourání X"
    re.compile(r"\b(?:vybou?rán[ií]|bourán[ií]|odstraně[níi])\s+([a-záčďéěíňóřšťúůýž][^,;\.\n]{4,60})", re.IGNORECASE),
]

STOP_PHRASES_RE = re.compile(r"\b(?:tj|tzn|tj\.|tzn\.|nebo|atd|apod|např|i|a)\b", re.IGNORECASE)


def scan_tz_verbs(tz_text: str) -> list[str]:
    """Pull verb-noun construction work mentions from TZ text."""
    finds = []
    for pat in TZ_VERB_PATTERNS:
        for m in pat.finditer(tz_text):
            obj = m.group(1).strip()
            obj = re.sub(r"\s+", " ", obj)
            obj = re.sub(r"^(?:nového?|nové?|nových|nový|nová|nové)\s+", "", obj, flags=re.IGNORECASE)
            # Trim trailing common stopwords
            obj_words = obj.split()
            if len(obj_words) > 8:
                obj = " ".join(obj_words[:8])
            if len(obj) >= 5 and not STOP_PHRASES_RE.fullmatch(obj):
                finds.append(obj)
    return finds


def main() -> int:
    items = json.loads(ITEMS_JSON.read_text())["items"]
    sub_doc = json.loads(SUBDOD_JSON.read_text())
    trades = sub_doc.get("trades", {})

    print(f"[1/4] Section A — TKP family coverage ...", file=sys.stderr)
    # A. TKP first-digit histogram from urs_code_proposed
    tkp_hist = Counter()
    tkp_samples: dict[str, list[dict]] = defaultdict(list)
    for it in items:
        code = it.get("urs_code_proposed") or it.get("urs_code_family_6digit")
        d = str(code)[0] if code and str(code)[0].isdigit() else "?"
        tkp_hist[d] += 1
        if len(tkp_samples[d]) < 3:
            tkp_samples[d].append({"id": it["id"], "popis": it["popis"][:80]})
    tkp_coverage = []
    for d, label in TKP_FAMILIES.items():
        n = tkp_hist.get(d, 0)
        gap = (n == 0)
        tkp_coverage.append({
            "tkp_family": d,
            "label": label,
            "n_items": n,
            "samples": tkp_samples.get(d, []),
            "gap_flag": gap,
        })
    n_orphans = tkp_hist.get("?", 0)

    print(f"[2/4] Section B — Subdodavatel coverage ...", file=sys.stderr)
    # B. Subdodavatel coverage — each of 37 trades vs item subdodavatel
    trade_hits = Counter(it.get("subdodavatel") for it in items)
    sub_coverage = []
    for trade_id, meta in trades.items():
        if trade_id == "needs_mapping":
            continue
        n = trade_hits.get(trade_id, 0)
        sub_coverage.append({
            "trade": trade_id,
            "label_cz": meta.get("label_cz", ""),
            "n_items": n,
            "kapitoly_expected": meta.get("kapitoly", []),
            "gap_flag": (n == 0),
        })
    n_trades = len(sub_coverage)
    n_trades_with_items = sum(1 for s in sub_coverage if s["n_items"] > 0)

    print(f"[3/4] Section C — RD anchor checklist ...", file=sys.stderr)
    # C. Anchor checklist
    anchor_results = []
    for anchor_id, label, tokens, app_key in RD_ANCHORS:
        applicable = APPLICABILITY.get(app_key, True) if app_key else True
        if not applicable:
            anchor_results.append({
                "anchor_id": anchor_id, "label": label, "applicable": False,
                "status": "n_a", "n_hits": 0, "sample_ids": [],
                "applicability_reason": f"{app_key} = False per project metadata",
            })
            continue
        hits = match_anchor(items, tokens)
        anchor_results.append({
            "anchor_id": anchor_id, "label": label, "applicable": True,
            "status": "ok" if hits else "missing",
            "n_hits": len(hits),
            "sample_ids": [h["id"] for h in hits[:3]],
            "keywords_used": tokens,
        })
    n_anchors_applicable = sum(1 for a in anchor_results if a["applicable"])
    n_anchors_ok = sum(1 for a in anchor_results if a["status"] == "ok")
    n_anchors_missing = sum(1 for a in anchor_results if a["status"] == "missing")
    n_anchors_na = sum(1 for a in anchor_results if a["status"] == "n_a")

    print(f"[4/4] Section D — TZ keyword scan ...", file=sys.stderr)
    # D. TZ verb-noun scan
    tz_files = []
    for sub in ["260219_dum", "260217_sklad", "common"]:
        sub_dir = TZ_DIR / sub
        if sub_dir.exists():
            tz_files.extend(sub_dir.glob("*.pdf"))
    tz_finds: list[dict] = []
    items_text_all = " ".join(item_text(it) for it in items)
    try:
        import pypdf
    except ImportError:
        pypdf = None
    if pypdf:
        for pdf in tz_files:
            try:
                reader = pypdf.PdfReader(str(pdf))
                text = "\n".join(p.extract_text() or "" for p in reader.pages)
                verbs = scan_tz_verbs(text)
                for v in verbs:
                    v_norm = norm(v)
                    # Check if first 2-3 distinctive tokens appear in any item text
                    tokens = [t for t in v_norm.split() if len(t) >= 4][:3]
                    found = bool(tokens) and all(t in items_text_all for t in tokens)
                    tz_finds.append({
                        "tz_file": pdf.name,
                        "verb_phrase": v,
                        "covered_in_items": found,
                        "lookup_tokens": tokens,
                    })
            except Exception as e:
                tz_finds.append({"tz_file": pdf.name, "_error": str(e)[:120]})
    # Dedupe by normalized verb phrase
    seen_phrases: set[str] = set()
    tz_unique: list[dict] = []
    for f in tz_finds:
        if "_error" in f:
            tz_unique.append(f)
            continue
        key = norm(f["verb_phrase"])[:60]
        if key in seen_phrases:
            continue
        seen_phrases.add(key)
        tz_unique.append(f)
    n_tz_total = len(tz_unique)
    n_tz_covered = sum(1 for t in tz_unique if t.get("covered_in_items"))
    n_tz_uncovered = n_tz_total - n_tz_covered

    # ── Output ──────────────────────────────────────────────────────────────
    out = {
        "_schema_version": "1.0",
        "_generated_at": TODAY,
        "_generated_by": "tools/completeness_check.py",
        "_purpose": (
            "Verify all WORKS for RD Jáchymov are accounted for in items.json. "
            "Orthogonal to Phase 0a (which checks SOURCES probed); this checks "
            "item-level completeness via 4 sections."
        ),
        "_items_total": len(items),
        "section_A_tkp_coverage": {
            "_purpose": "Czech URS TSKP family coverage (0-9). Each family should have ≥1 item OR explicit N/A.",
            "n_families_with_items": sum(1 for c in tkp_coverage if c["n_items"] > 0),
            "n_families_total": len(TKP_FAMILIES),
            "n_orphan_items_no_code": n_orphans,
            "families": tkp_coverage,
        },
        "section_B_subdodavatel_coverage": {
            "_purpose": "Each mapped trade (37) should have ≥1 item OR explicit not_in_scope.",
            "n_trades_total": n_trades,
            "n_trades_with_items": n_trades_with_items,
            "n_trades_missing": n_trades - n_trades_with_items,
            "trades": sub_coverage,
        },
        "section_C_rd_anchor_checklist": {
            "_purpose": "~70 typical works for Czech RD rekonstrukce + nástavba.",
            "n_anchors_total": len(RD_ANCHORS),
            "n_applicable": n_anchors_applicable,
            "n_ok": n_anchors_ok,
            "n_missing": n_anchors_missing,
            "n_na": n_anchors_na,
            "anchors": anchor_results,
        },
        "section_D_tz_verb_scan": {
            "_purpose": "Regex 'provedení X' / 'montáž Y' / 'instalace Z' in TZ → coverage check in items.",
            "n_tz_files_scanned": len(tz_files),
            "n_unique_verb_phrases": n_tz_total,
            "n_covered_in_items": n_tz_covered,
            "n_uncovered": n_tz_uncovered,
            "_caveat": "Token coverage is fuzzy; FAR-uncovered items may still be present via different phrasing. Manual review of uncovered list recommended.",
            "phrases": tz_unique,
        },
        "_summary": {
            "tkp_gaps": sum(1 for c in tkp_coverage if c["gap_flag"]),
            "subdodavatel_gaps": n_trades - n_trades_with_items,
            "anchor_missing": n_anchors_missing,
            "tz_phrases_uncovered": n_tz_uncovered,
        },
    }
    OUT_JSON.write_text(json.dumps(out, indent=2, ensure_ascii=False))

    # ── Human report ───────────────────────────────────────────────────────
    md = [
        "# Completeness Audit — RD Jáchymov items.json",
        "",
        f"**Generated:** {TODAY}",
        f"**Items total:** {len(items)}",
        f"**TZ files scanned:** {len(tz_files)}",
        "",
        "> **Pozor.** Tato kontrola dělá strukturovaný sweep — neznačí *garanci* úplnosti.",
        "> Cíl: poskytnout worksheet kde uživatel rychle vidí potenciální mezery.",
        "> Mnoho 'missing' anchor položek mohou být ve skutečnosti přítomny pod jiným popis-stringem.",
        "> Sekce D (TZ verb scan) má největší false-positive rate (regex noise).",
        "",
        "## Souhrn (top-line gaps)",
        "",
        f"| Sekce | Metrika | Hodnota |",
        f"|---|---|--:|",
        f"| A. TKP families | rodin s ≥1 položkou / total | {sum(1 for c in tkp_coverage if c['n_items']>0)} / {len(TKP_FAMILIES)} |",
        f"| A. TKP families | položek bez kódu | {n_orphans} |",
        f"| B. Subdodavatel | trades s ≥1 položkou / 36 | {n_trades_with_items} / {n_trades} |",
        f"| C. RD anchors | OK / applicable / missing | {n_anchors_ok} / {n_anchors_applicable} / **{n_anchors_missing}** |",
        f"| C. RD anchors | N/A (per project) | {n_anchors_na} |",
        f"| D. TZ verbs | covered / unique | {n_tz_covered} / {n_tz_total} |",
        "",
        "---",
        "",
        "## Sekce A — TKP family coverage",
        "",
        "| TKP | Popis | N položek | Vzorek |",
        "|--:|---|--:|---|",
    ]
    for c in tkp_coverage:
        samples_str = "; ".join(f"`{s['id']}`" for s in c["samples"][:2])
        flag = " 🟠 GAP" if c["gap_flag"] else ""
        md.append(f"| {c['tkp_family']} | {c['label']} | {c['n_items']}{flag} | {samples_str} |")
    if n_orphans:
        md.append(f"| ? | bez urs_code_proposed (orphans) | {n_orphans} | (review) |")

    md.extend(["", "---", "", "## Sekce B — Subdodavatel coverage", "",
               "| Trade | Label | N položek | Kapitoly | Status |",
               "|---|---|--:|---|---|"])
    for s in sub_coverage:
        kap = ", ".join(s["kapitoly_expected"]) if s["kapitoly_expected"] else "—"
        status = "🟠 BEZ POLOŽKY" if s["gap_flag"] else "✓"
        md.append(f"| `{s['trade']}` | {s['label_cz']} | {s['n_items']} | {kap} | {status} |")

    md.extend(["", "---", "", "## Sekce C — RD renovation anchor checklist", "",
               "| ID | Anchor | Status | N | Vzorek items |",
               "|---|---|---|--:|---|"])
    for a in anchor_results:
        if not a["applicable"]:
            md.append(f"| {a['anchor_id']} | {a['label']} | ⚪ N/A | — | {a.get('applicability_reason', '')} |")
            continue
        icon = "✓" if a["status"] == "ok" else "❌ **MISSING**"
        samples = "; ".join(f"`{i}`" for i in a["sample_ids"])
        md.append(f"| {a['anchor_id']} | {a['label']} | {icon} | {a['n_hits']} | {samples} |")

    md.extend(["", "---", "", "## Sekce D — TZ verb-noun scan (top 40)", "",
               "| TZ soubor | Phrase | Covered? | Tokens |",
               "|---|---|---|---|"])
    for f in tz_unique[:40]:
        if "_error" in f:
            md.append(f"| {f['tz_file']} | _error: {f['_error'][:60]}_ | — | — |")
            continue
        icon = "✓" if f.get("covered_in_items") else "❌"
        toks = ", ".join(f.get("lookup_tokens", []))
        phrase = f["verb_phrase"][:70].replace("|", "/")
        md.append(f"| {f['tz_file'][:30]} | {phrase} | {icon} | {toks} |")
    if n_tz_total > 40:
        md.append(f"| (...) | _+ {n_tz_total - 40} more phrases in JSON_ | — | — |")

    OUT_MD.write_text("\n".join(md))
    print(
        f"\n✓ {OUT_JSON.relative_to(PROJ)} ({OUT_JSON.stat().st_size:,} bytes)\n"
        f"✓ {OUT_MD.relative_to(PROJ)} ({OUT_MD.stat().st_size:,} bytes)\n"
        f"\nGaps: TKP={sum(1 for c in tkp_coverage if c['gap_flag'])} "
        f"sub={n_trades-n_trades_with_items} anchors={n_anchors_missing} "
        f"tz_uncovered={n_tz_uncovered}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
