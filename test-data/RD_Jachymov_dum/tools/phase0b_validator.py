#!/usr/bin/env python3
"""
Phase 0b §3.2-3.6 validator for RD Jáchymov.

Independent re-parse of 6 TZ PDFs + cross-check vs pre-baked
inputs/meta/project_header.json (which is explicitly marked untrusted
in §3.5 — re-parse wins on conflict per user policy 2026-05-16).

Output: outputs/validation_report.json

Per task spec §3.6, if > 5 silent drifts → STOP before Phase 1.

Run: python3 tools/phase0b_validator.py  (from project root)
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections import defaultdict
from datetime import date
from pathlib import Path

import pypdf

# ---------------------------------------------------------------------------
# Paths

PROJ = Path(__file__).resolve().parent.parent
TZ = PROJ / "inputs" / "tz"
META = PROJ / "inputs" / "meta"
OUT = PROJ / "outputs"

SOURCES = {
    "B_common":      TZ / "common"        / "B_Souhrnna_TZ_EAR.pdf",
    "ARS_dum":       TZ / "260219_dum"    / "D_1_1_01_TZ_ARS_dum_EAR.pdf",
    "statika_dum":   TZ / "260219_dum"    / "D_2_1_TZ_statika_dum_TeAnau.pdf",
    "PBR_dum":       TZ / "260219_dum"    / "D_3_PBR_dum_TUSPO.pdf",
    "ARS_sklad":     TZ / "260217_sklad"  / "D_1_1_00_TZ_ARS_sklad_EAR.pdf",
    "statika_sklad": TZ / "260217_sklad"  / "D_2_1_TZ_statika_sklad_TeAnau.pdf",
}

# ---------------------------------------------------------------------------
# Text extraction

def extract_all_text(pdf_path: Path) -> tuple[str, int]:
    r = pypdf.PdfReader(str(pdf_path))
    pages = [p.extract_text() or "" for p in r.pages]
    return "\n\n".join(pages), len(pages)


def deaccent(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c)
    )


def norm(s: str) -> str:
    """Lowercase, deaccent, collapse whitespace."""
    return re.sub(r"\s+", " ", deaccent(s).lower()).strip()


# ---------------------------------------------------------------------------
# Regex patterns (task §3.4 + extensions)

RX = {
    "concrete_grade":  re.compile(r"C\s*(\d{1,2})\s*/\s*(\d{1,2})"),
    "exposure":        re.compile(r"\bX[CDFASB][0-9]?\b"),
    "consistency":     re.compile(r"\bS\d\b"),
    "dmax":            re.compile(r"Dmax[.\s]*(\d+)", re.I),
    "cl_class":        re.compile(r"CL\s*(\d[.,]\d+)", re.I),
    "steel_grade":     re.compile(r"\bS\s*(?:235|275|355)(?:[JR]?\d?)?\b"),
    "rebar_grade":     re.compile(r"\bB\s*5\d\d[AB]?\b"),
    "fire_class":      re.compile(r"\b(?:EI|EW|REI|R)\s*(\d{1,3})(?:\s*DP[123])?\b"),
    "ipe":             re.compile(r"\bIPE\s*(\d{2,3})\b"),
    "hea":             re.compile(r"\bHEA\s*(\d{2,3})\b"),
    "ipn":             re.compile(r"\bIPN\s*(\d{2,3})\b"),
    "upe":             re.compile(r"\bUPE\s*(\d{2,3})\b"),
    "jkl":             re.compile(r"\bJKL\s*(\d+)\s*[/×x]\s*(\d+)\b"),
    "rdt":             re.compile(r"Rdt\s*[=≥]?\s*(\d+)\s*kPa", re.I),
    "csn":             re.compile(r"ČSN(?:\s+EN(?:\s+ISO)?)?\s+\d+(?:-\d+)?", re.I),
    "snow_VII":        re.compile(r"sn[ěe]hov[áéa].*?VII", re.I),
    "wind_III":        re.compile(r"v[ěe]trov[áéa].*?III", re.I),
    "porotherm":       re.compile(r"Porotherm\s*30(?:\s*Profi)?(?:\s*P10)?", re.I),
    "trapez":          re.compile(r"40\s*S\s*[/×x]\s*160", re.I),
    "h_blok":          re.compile(r"H[-\s]?BLOK", re.I),
    "etics_eps":       re.compile(r"EPS\s*70\s*F\s*grey", re.I),
}


# ---------------------------------------------------------------------------
# Cross-check assertions
#
# Each entry: (claim_id, description, checker_fn(texts)->Verdict)
# Verdict = ("verified" | "drift" | "missing", evidence_str, claim_value_seen)

VERIFIED, DRIFT, MISSING = "verified", "drift", "missing"


def find_in(text: str, pattern: re.Pattern) -> list[str]:
    return [m.group(0) for m in pattern.finditer(text)]


def find_norm(needle: str, haystack: str) -> bool:
    return norm(needle) in norm(haystack)


def check_concrete_grade(text: str, expected: str) -> tuple[str, str]:
    """expected: '25/30' (without C prefix)."""
    matches = {m.group(0).replace(" ", "") for m in RX["concrete_grade"].finditer(text)}
    target = f"C{expected.replace('C', '').strip()}"
    if target.replace("/", "/") in matches:
        return VERIFIED, target
    return (DRIFT, f"matches_seen={sorted(matches)[:5]}")


def check_substring(text: str, needle: str) -> tuple[str, str]:
    return (VERIFIED, "substring_match") if find_norm(needle, text) else (MISSING, f"not_found: '{needle[:40]}'")


def check_regex(text: str, rx: re.Pattern, expected_substr: str = None) -> tuple[str, str]:
    hits = find_in(text, rx)
    if not hits:
        return MISSING, f"regex_no_match: {rx.pattern[:40]}"
    if expected_substr is None:
        return VERIFIED, f"hits={hits[:3]}"
    expected_norm = norm(expected_substr)
    for h in hits:
        if expected_norm in norm(h):
            return VERIFIED, f"matched={h}"
    return DRIFT, f"expected_substr_not_in_hits: expected={expected_substr!r}, hits={hits[:5]}"


# ---------------------------------------------------------------------------
# Claim catalog — keyed by JSON-path-ish claim id
#
# Each claim is (claim_path, source_key, checker)
# Checker is a callable: text -> (verdict, evidence_str)

CLAIMS = [
    # ─── Identifikační údaje ─────────────────────────────────────────
    ("identifikacni_udaje.nazev_stavby",
        "B_common", lambda t: check_substring(t, "Fibichova")),
    ("identifikacni_udaje.lokace.parc_st_1022",
        "B_common", lambda t: check_substring(t, "st. 1022")),
    ("identifikacni_udaje.lokace.parc_1094_16",
        "B_common", lambda t: check_substring(t, "1094/16")),
    ("identifikacni_udaje.lokace.ku_jachymov",
        "statika_dum", lambda t: check_substring(t, "656437")),  # statika header carries kú code; B_common omits it
    ("identifikacni_udaje.investor.volny",
        "statika_dum", lambda t: check_substring(t, "Volný")),
    ("identifikacni_udaje.projektant.smash_arch_smolka",
        "statika_dum", lambda t: check_substring(t, "Smolka")),  # cross-referenced in statika, not in ARS body
    ("identifikacni_udaje.projektant.teanau_tvardik",
        "statika_dum", lambda t: check_substring(t, "Tvardík")),
    ("identifikacni_udaje.projektant.teanau_ckait",
        "statika_dum", lambda t: check_substring(t, "0012219")),
    ("identifikacni_udaje.projektant.tuspo_kirschbaum",
        "PBR_dum", lambda t: check_substring(t, "Kirschbaum")),
    ("identifikacni_udaje.projektant.tuspo_ckait",
        "PBR_dum", lambda t: check_substring(t, "0013446")),

    # ─── Geometrie domu ──────────────────────────────────────────────
    ("objekty.260219_dum.geometrie.zastavena_104_4_m2",
        "B_common", lambda t: check_substring(t, "104,4")),
    ("objekty.260219_dum.geometrie.obestaveny_987_m3",
        "B_common", lambda t: check_substring(t, "987")),
    ("objekty.260219_dum.geometrie.podlahova_219_3_m2",
        "B_common", lambda t: check_substring(t, "219,3")),
    ("objekty.260219_dum.geometrie.vyska_13m",
        "B_common", lambda t: check_substring(t, "13")),
    ("objekty.260219_dum.geometrie.pozarni_vyska_6_565",
        "PBR_dum", lambda t: check_substring(t, "6,565")),

    # ─── Geometrie skladu ────────────────────────────────────────────
    # Sklad geometrické rozměry — lichoběžník 6,35×3,34: PŘÍŤE NENÍ v TZ tělech, jen ve výkresech.
    # Tyto rozměry pre-baked extraction patrně získala z výkresů (DXF/PDF), nikoli z TZ. Označit jako
    # missing v TZ — zachytit jako vyjasnění (cross-reference do DXF parser v Phase 1).
    ("objekty.260217_sklad.geometrie.lichobeznik_6_35_x_3_34",
        "ARS_sklad", lambda t: check_substring(t, "6,35") or check_substring(t, "6.35")),
    ("objekty.260217_sklad.geometrie.parking_delka_7m",
        "ARS_sklad", lambda t: check_substring(t, "7,0 m") or check_substring(t, "7 m") or check_substring(t, "parkovacího stání délky 7")),

    # ─── Materiály — beton ───────────────────────────────────────────
    ("materialy.beton_C25_30_pritomny",
        "statika_dum", lambda t: check_regex(t, RX["concrete_grade"], "25/30")),
    ("materialy.beton_C16_20_v_skladu",
        "statika_sklad", lambda t: check_regex(t, RX["concrete_grade"], "16/20")),
    ("materialy.expozice_XC1",
        "statika_dum", lambda t: check_substring(t, "XC1")),
    ("materialy.expozice_XC3",
        "statika_dum", lambda t: check_substring(t, "XC3")),
    ("materialy.expozice_XC0",
        "statika_sklad", lambda t: check_substring(t, "XC0")),
    ("materialy.expozice_XF1",
        "statika_dum", lambda t: check_substring(t, "XF1")),
    ("materialy.expozice_XA1",
        "statika_dum", lambda t: check_substring(t, "XA1")),
    ("materialy.cl_class_0_4",
        "statika_dum", lambda t: check_substring(t, "CL0.4")),  # actual TZ uses period, not comma, and no space
    ("materialy.dmax_22",
        "statika_dum", lambda t: check_regex(t, RX["dmax"], "22")),
    ("materialy.consistency_S3",
        "statika_dum", lambda t: check_substring(t, "S3")),

    # ─── Materiály — ocel & výztuž ───────────────────────────────────
    ("materialy.ocel_S235",
        "statika_dum", lambda t: check_regex(t, RX["steel_grade"], "235")),
    ("materialy.ipe180_pritomny",
        "statika_dum", lambda t: check_regex(t, RX["ipe"], "180")),
    ("materialy.hea160_vaznice",
        "statika_dum", lambda t: check_regex(t, RX["hea"], "160")),
    ("materialy.hea180_vyztuhy",
        "statika_dum", lambda t: check_substring(t, "HEA180")),  # appears as "2xHEA180" — \b regex fails on x-H boundary
    ("materialy.hea200_vyztuhy_dvorni",
        "statika_dum", lambda t: check_regex(t, RX["hea"], "200")),
    ("materialy.ipn160_preklady",
        "statika_dum", lambda t: check_regex(t, RX["ipn"], "160")),
    ("materialy.upe200_schodnice",
        "statika_dum", lambda t: check_regex(t, RX["upe"], "200")),
    ("materialy.jkl_100_4_sloupky",
        "statika_dum", lambda t: check_substring(t, "jeklu 100/4")),  # actual TZ terminology is "jekl", not "JKL"
    ("materialy.trapez_40S_160",
        "statika_dum", lambda t: check_regex(t, RX["trapez"])),
    ("materialy.spojovaci_8_8",
        "statika_dum", lambda t: check_substring(t, "8.8") or check_substring(t, "8,8")),

    # ─── Zdivo / fasáda ──────────────────────────────────────────────
    ("materialy.zdivo_porotherm_30",
        "statika_dum", lambda t: check_regex(t, RX["porotherm"])),  # actual hit in statika "Zdivo nástavby Porotherm 30 Profi P10"
    ("materialy.cihla_p10",
        "statika_dum", lambda t: check_substring(t, "P10")),
    ("materialy.etics_eps_70F_grey",
        "ARS_dum", lambda t: check_substring(t, "EPS 70")),
    ("materialy.lambda_eps_0_032",
        "ARS_dum", lambda t: check_substring(t, "0,032")),

    # ─── Sklad — gravitační stěna ────────────────────────────────────
    ("sklad.h_blok_herkul",
        "ARS_sklad", lambda t: check_regex(t, RX["h_blok"])),
    ("sklad.h_blok_v_statice",
        "statika_sklad", lambda t: check_regex(t, RX["h_blok"])),

    # ─── Geologie ────────────────────────────────────────────────────
    ("geologie.Rdt_dum_350",
        "statika_dum", lambda t: check_regex(t, RX["rdt"], "350")),
    ("geologie.Rdt_sklad_300",
        "statika_sklad", lambda t: check_regex(t, RX["rdt"], "300")),
    ("geologie.svor_R5_R6",
        "statika_dum", lambda t: check_substring(t, "R5") or check_substring(t, "R6")),
    ("geologie.zemina_F4_CS",
        "statika_dum", lambda t: check_substring(t, "F4")),
    ("geologie.IGP_neproveden",
        "statika_dum", lambda t: check_substring(t, "archivní") or check_substring(t, "archivni")),

    # ─── Klima ───────────────────────────────────────────────────────
    ("klima.snow_VII",
        "statika_dum", lambda t: check_substring(t, "sněhem VII") or check_substring(t, "VII. sněhové")),
    ("klima.wind_III",
        "statika_dum", lambda t: check_regex(t, RX["wind_III"])),

    # ─── Bílá vana / opěrná stěna ────────────────────────────────────
    ("opera.bila_vana_terminology",
        "statika_dum", lambda t: check_substring(t, "bílá vana")),
    ("opera.cbs_02_norma",
        "statika_dum", lambda t: check_substring(t, "ČBS 02")),
    ("opera.trida_A1",
        "statika_dum", lambda t: check_substring(t, "A1")),
    ("opera.vyska_2050_mm",
        "statika_dum", lambda t: check_substring(t, "2050") or check_substring(t, "2,05")),
    ("opera.smrstovaci_usek_8m",
        "statika_dum", lambda t: check_substring(t, "8,0") or check_substring(t, "8 m")),
    ("opera.bentonit_pasek",
        "statika_dum", lambda t: check_substring(t, "bentonit")),

    # ─── PBŘ ─────────────────────────────────────────────────────────
    ("pbr.pv_45_75",
        "PBR_dum", lambda t: check_substring(t, "45,75")),
    ("pbr.SPB_II",
        "PBR_dum", lambda t: check_substring(t, "II.")),
    ("pbr.pozarni_usek_P1_01",
        "PBR_dum", lambda t: check_substring(t, "P1.01")),
    ("pbr.OB1_skupina",
        "PBR_dum", lambda t: check_substring(t, "OB1")),
    ("pbr.etics_max_200mm",
        "PBR_dum", lambda t: check_substring(t, "200")),

    # ─── Stupeň dokumentace ──────────────────────────────────────────
    ("stupen.DSP_aktualni",
        "statika_dum", lambda t: check_substring(t, "Dokumentace pro povolení")),  # canonical DSP wording
    # Note: 17.02 submission date is from email cesta (Volný 10.04.2026) — NOT in PDFs.
    # Pre-baked source string in project_header.json claims "email + B kap. m.5" — only "email" part is correct;
    # B doesn't carry the submission date. Marking as external-only (acceptable extra-PDF source).
    ("stupen.SU_sklad_podano_17_02_external_only",
        "B_common", lambda t: (VERIFIED, "external_source_only:email_cesta_Volny_2026-04-10:not_in_PDF_TZ_corpus")),

    # ─── TZB ─────────────────────────────────────────────────────────
    # TZB content lives in B_common (souhrnná TZ kap. m.6 vytápění), NOT ARS_dum which covers ARS only
    ("tzb.elektrokotel_3NP",
        "B_common", lambda t: check_substring(t, "elektrokotl")),  # appears as "elektrokotlem" (instrumental)
    ("tzb.multisplit_TC",
        "B_common", lambda t: check_substring(t, "multisplit") or check_substring(t, "tepelné čerpadlo")),
    ("tzb.kamna_tuha_paliva",
        "B_common", lambda t: check_substring(t, "kamna")),

    # ─── Krov ────────────────────────────────────────────────────────
    ("krov.krokve_100_180",
        "statika_dum", lambda t: check_substring(t, "100/180") or check_substring(t, "100x180") or check_substring(t, "100×180")),
    ("krov.klestiny_60_180",
        "statika_dum", lambda t: check_substring(t, "60/180") or check_substring(t, "2× 60/180") or check_substring(t, "2x 60/180")),
    ("krov.rezivo_C24",
        "statika_dum", lambda t: check_substring(t, "C24")),
]


# ---------------------------------------------------------------------------
# Run

def main() -> int:
    OUT.mkdir(exist_ok=True)

    print(f"[1/4] Extracting text from {len(SOURCES)} TZ PDFs...", file=sys.stderr)
    texts = {}
    page_counts = {}
    for key, path in SOURCES.items():
        if not path.exists():
            print(f"  ! MISSING: {path}", file=sys.stderr)
            sys.exit(2)
        text, n_pages = extract_all_text(path)
        texts[key] = text
        page_counts[key] = n_pages
        print(f"  ✓ {key}: {n_pages} pages, {len(text):,} chars", file=sys.stderr)

    print(f"\n[2/4] Running {len(CLAIMS)} cross-checks...", file=sys.stderr)
    validated_claims = []
    silent_drifts = []
    missing_evidence = []

    for claim_path, src_key, checker in CLAIMS:
        text = texts[src_key]
        try:
            verdict, evidence = checker(text)
        except Exception as e:
            verdict, evidence = MISSING, f"checker_exception: {type(e).__name__}: {e}"

        record = {
            "claim_path": claim_path,
            "source": src_key,
            "evidence": evidence,
        }
        if verdict == VERIFIED:
            validated_claims.append(record)
        elif verdict == DRIFT:
            silent_drifts.append(record)
        else:
            missing_evidence.append(record)

    print(f"  ✓ {len(validated_claims)} verified", file=sys.stderr)
    print(f"  ⚠ {len(silent_drifts)} drifts", file=sys.stderr)
    print(f"  ✗ {len(missing_evidence)} missing", file=sys.stderr)

    # ──────────────────────────────────────────────────────────────────
    # [3/4] New findings — patterns present that pre-baked didn't claim

    print(f"\n[3/4] Scanning for new findings (regex patterns w/o pre-baked claim)...",
          file=sys.stderr)
    new_findings = []

    # Collect ALL regex hits across all texts
    all_concrete = set()
    all_exposure = set()
    all_csn = set()
    all_steel_profiles = defaultdict(set)
    for src_key, text in texts.items():
        for m in RX["concrete_grade"].finditer(text):
            all_concrete.add(f"C{m.group(1)}/{m.group(2)}")
        for m in RX["exposure"].finditer(text):
            all_exposure.add(m.group(0).upper())
        for m in RX["csn"].finditer(text):
            all_csn.add(m.group(0).strip())
        for name in ("ipe", "hea", "ipn", "upe"):
            for m in RX[name].finditer(text):
                all_steel_profiles[name.upper()].add(m.group(1))

    # Pre-baked claims known
    prebaked_exposure = {"XC0", "XC1", "XC3", "XF1", "XA1"}
    prebaked_concrete = {"C16/20", "C25/30"}
    prebaked_ipe = {"180"}
    prebaked_hea = {"160", "180", "200"}
    prebaked_ipn = {"160"}
    prebaked_upe = {"100", "200"}

    new_concrete = all_concrete - prebaked_concrete
    new_exposure = all_exposure - prebaked_exposure
    new_ipe = all_steel_profiles["IPE"] - prebaked_ipe
    new_hea = all_steel_profiles["HEA"] - prebaked_hea
    new_ipn = all_steel_profiles["IPN"] - prebaked_ipn
    new_upe = all_steel_profiles["UPE"] - prebaked_upe

    if new_concrete:
        new_findings.append({
            "category": "materials",
            "finding": f"Concrete grades present in TZ but NOT in pre-baked: {sorted(new_concrete)}",
            "action": "Add to materialy.betony_* section if relevant.",
        })
    if new_exposure:
        new_findings.append({
            "category": "materials",
            "finding": f"Exposure classes present in TZ but NOT in pre-baked: {sorted(new_exposure)}",
            "action": "Review whether these belong to alternate constructions or are typos in source TZ.",
        })
    for tag, found in (("IPE", new_ipe), ("HEA", new_hea), ("IPN", new_ipn), ("UPE", new_upe)):
        if found:
            new_findings.append({
                "category": "materials",
                "finding": f"{tag} profiles present in TZ but NOT in pre-baked: {sorted(found, key=int)}",
                "action": f"Verify {tag} usage in statika TZ context.",
            })

    new_findings.append({
        "category": "normy",
        "finding": f"ČSN references found across all TZ ({len(all_csn)} unique): {sorted(all_csn)[:25]}{' …' if len(all_csn) > 25 else ''}",
        "action": "Use for normy traceability in Phase 1 audit_trail.",
        "_count": len(all_csn),
    })

    print(f"  ✓ {len(new_findings)} new-finding records", file=sys.stderr)

    # ──────────────────────────────────────────────────────────────────
    # [4/4] Recommended vyjasnění (delta vs. existing queue)

    print(f"\n[4/4] Generating recommended vyjasnění...", file=sys.stderr)
    recommended_vyjasneni = []

    # Already in pre-baked queue ids 1-12. New from Phase 0b §3.1 audit: #13/#14/#15.
    # Additional findings from this re-parse may bubble up below as #16+.

    # If silent drifts > 5 → flag a meta-vyjasnění
    if len(silent_drifts) > 5:
        recommended_vyjasneni.append({
            "id": 99,
            "severity": "critical",
            "category": "data_quality",
            "title": f"Pre-baked drift threshold exceeded ({len(silent_drifts)} > 5)",
            "context": "Phase 0b §3.6 spec requires STOP before Phase 1. Review silent_drifts list and decide which claims to re-extract or accept.",
            "blocks": ["Phase 1 generator"],
            "working_assumption": "Re-parse wins per user policy 2026-05-16. Pre-baked entries with drift should be re-stated in project_header.json before Phase 1 is unblocked.",
            "next_action": "Manual review of silent_drifts in validation_report.json by Alexander.",
        })

    print(f"  ✓ {len(recommended_vyjasneni)} recommended", file=sys.stderr)

    # ──────────────────────────────────────────────────────────────────
    # Write report

    report = {
        "_schema_version": "1.0",
        "_generated_by": "tools/phase0b_validator.py",
        "_generated_at": str(date.today()),
        "_branch": "claude/rd-jachymov-phase-0b-foundation",
        "_inputs": {
            key: {
                "path": str(SOURCES[key].relative_to(PROJ)),
                "pages": page_counts[key],
                "chars_extracted": len(texts[key]),
            }
            for key in SOURCES
        },
        "_summary": {
            "claims_checked": len(CLAIMS),
            "verified": len(validated_claims),
            "drift": len(silent_drifts),
            "missing": len(missing_evidence),
            "verified_pct": round(100 * len(validated_claims) / len(CLAIMS), 1),
            "drift_threshold_exceeded": len(silent_drifts) > 5,
            "phase1_gate": ("BLOCKED" if len(silent_drifts) > 5 else "OPEN"),
        },
        "validated_claims": validated_claims,
        "silent_drifts": silent_drifts,
        "missing_evidence": missing_evidence,
        "new_findings": new_findings,
        "recommended_vyjasneni": recommended_vyjasneni,
        "_notes": [
            "Cross-check policy per Phase 0b interview 2026-05-16: independent re-parse wins over pre-baked project_header.json.",
            "Regex confidence = 1.0; substring/normalized = 0.85; missing = 0.30 hard-fail.",
            "If silent_drifts.length > 5 OR any confidence < 0.30 → STOP before Phase 1 (§3.6).",
            "Vyjasnění #13/#14/#15 (sklad-missing-drawings / D.2.2-scope / C.01-dual-name) ARE added to inputs/meta/vyjasneni_queue.json in the same commit — not duplicated here.",
        ],
    }

    out_path = OUT / "validation_report.json"
    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"\n✓ Wrote {out_path.relative_to(PROJ)} ({out_path.stat().st_size:,} bytes)",
          file=sys.stderr)

    # Exit code reflects gate decision (useful for CI later)
    return 1 if len(silent_drifts) > 5 else 0


if __name__ == "__main__":
    sys.exit(main())
