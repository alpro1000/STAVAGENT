#!/usr/bin/env python3
"""
Stage 1A — anchor checklist gap audit (Pattern 20 §C extended).

Runs RD Jáchymov frozen items.json against a ~40-anchor checklist of
typical RD rekonstrukce + nadstavba works, with EXPLICIT focus on the
"implicit pomocné/VRN práce" class that Audit v2 §C missed (přesun hmot,
lešení, hromosvod, slaboproud, etc. — works rarely stated in TZ but needed
for realizace).

items.json is FROZEN — this is analysis only, NO mutation. Output drafts
have generic Czech popis + NO catalog codes (Stage 3 catalog binding is
separate, per Pattern 15 work-first).

Per-anchor verdict: COVERED / GAP / N/A.
GAP severity: critical (rozpočet incomplete без této položky) / important /
medium / informational.

Output: outputs/anchor_checklist_gap_audit.json
"""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS_PATH = ROOT / "outputs" / "items_rd_jachymov_complete.json"
PBR_PATH = ROOT / "inputs" / "tz" / "260219_dum" / "D_3_PBR_dum_TUSPO.pdf"
OUT = ROOT / "outputs" / "anchor_checklist_gap_audit.json"
TODAY = str(date.today())


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", (s or "").lower())
    return "".join(c for c in s if not unicodedata.combining(c))


# ---------------------------------------------------------------------------
# Anchor checklist — ~40 typical RD works.
# Focus: the IMPLICIT POMOCNÉ/VRN class first (the Audit v2 §C blind spot),
# then the standard construction anchors for cross-check.
#
# Each anchor: (id, label, keyword_tokens_OR, applicability, gap_severity,
#               suggested_draft_or_None)
# ---------------------------------------------------------------------------

ANCHORS = [
    # ═══ IMPLICIT POMOCNÉ + VRN PRÁCE (the blind spot) ═══
    ("PM01", "Přesun hmot pro budovu (vnitrostaveništní)",
     ["presun hmot", "vnitrostaveni", "manipulace s materialem"], True, "critical",
     {"kapitola": "VRN — Přesun hmot", "popis": "Přesun hmot pro budovu — vnitrostaveništní vertikální + horizontální doprava materiálu (rekonstrukce vícepodlažní + nástavba 3.NP)", "mj": "t", "pozn": "POVINNÁ položka každého rozpočtu (998xxx URS família). Pro RD s nástavbou 3.NP nutný vertikální přesun. Buď % z HSV nebo dle tonáže."}),
    ("PM02", "Lešení fasádní (ETICS + krov + klempířina)",
     ["leseni", "lesenarsk", "fasadni leseni"], True, "critical",
     {"kapitola": "VRN — Lešení", "popis": "Fasádní lešení trubkové/rámové vč. montáže + pronájmu + demontáže — pro ETICS fasádu 276.7 m² + krov + klempířinu (výška domu 13 m)", "mj": "m²", "pozn": "POVINNÉ pro ETICS 276.7 m² fasády. URS 941xxx família. Plocha ~ obvod 38.7 m × výška 13 m = ~500 m² lešenné plochy."}),
    ("PM03", "Hromosvod / ochrana před bleskem (LPS)",
     ["hromosvod", "bleskosvod", "jimac", "uzemnen", "ochrana pred bleskem"], "verify_pbr", "important",
     {"kapitola": "M-22 ELI slaboproud + hromosvod", "popis": "Hromosvod (LPS) — jímací soustava + svody + uzemnění dle ČSN EN 62305 (nový krov + hliníková falcovaná krytina, dům 13 m v exponované poloze Krušnohoří)", "mj": "kpl", "pozn": "PBŘ D.3 hromosvod NEZMIŇUJE explicitně — VERIFY u projektanta zda ČSN EN 62305 risk analysis vyžaduje LPS. Nový krov + kovová krytina + exponovaná poloha → pravděpodobně ano."}),
    ("PM04", "Slaboproud (data/TV/zvonek/domofon/anténa)",
     ["slaboproud", "datova zasuvk", "datove rozvod", "strukturovana kabel", "domofon", "zvonek", "antenni", "STA rozvod"], True, "medium",
     {"kapitola": "M-22 ELI slaboproud", "popis": "Slaboproudé rozvody — datové zásuvky + TV/STA + zvonek/domofon + anténa (3 bytové jednotky)", "mj": "kpl", "pozn": "M-21 silnoproud je pokryt; slaboproud chybí. Pro 3 byty obvyklé. Rozsah dle vyjasnění #7 (počty)."}),
    ("PM05", "Okapový chodník + obvodová drenáž domu",
     ["okapovy chodnik", "obvodova drenaz", "drenaz domu"], "medium_check", "medium",
     {"kapitola": "HSV-1 Zemní práce", "popis": "Okapový chodník po obvodu domu (kačírek/dlažba) + obvodová drenáž paty základů (mimo BV drenáže HSV1.015)", "mj": "m", "pozn": "HSV1.015 pokrývá drenáž za BV opěrnou stěnou; okapový chodník po obvodu domu samostatně. Verify dle situace."}),
    ("PM06", "Terénní + sadové úpravy finální",
     ["terenni uprav", "sadove uprav", "ohumusovan", "zatravnen", "finalni uprava terenu"], "medium_check", "medium",
     {"kapitola": "HSV-1 Zemní práce", "popis": "Terénní úpravy finální — ohumusování + zatravnění + úprava zahrady po stavbě", "mj": "m²", "pozn": "Dokončovací práce zahrady. Často minimální rozsah u rekonstrukce. Verify scope s investorem."}),

    # ═══ STANDARD CONSTRUCTION ANCHORS (cross-check coverage) ═══
    # Demolice
    ("D01", "Bourání krytiny + krov", ["bourani plech", "bourani krov", "bourani krytin", "bourani stresn"], True, "important", None),
    ("D02", "Bourání obkladů koupelen", ["bourani obkladu", "keramick obklad", "obkladu a zarizovac"], True, "important", None),
    ("D03", "Bourání příček + otvory", ["bourani pricek", "bourani lehkych", "otvoru v nosnych"], True, "important", None),
    ("D04", "Bourání/sejmutí podlah", ["sejmuti podlah", "bourani podlah"], True, "important", None),
    ("D05", "Demontáž oken + dveří", ["demontaz vsech oken", "demontaz drevenych oken", "demontaz stavajicich vstupnich", "demontaz stavajicich vnitrnich"], True, "important", None),
    ("D06", "Bourání komínu (vrchní část)", ["bourani vrchni casti", "zbourani komin", "komin"], True, "medium", None),
    ("D07", "Bourání opěrných zídek + venkovní schody", ["bourani stavajicich opernych", "opernych zidek"], True, "medium", None),
    # Zemní + ŽB
    ("Z01", "Sejmutí ornice", ["sejmuti ornic"], True, "medium", None),
    ("Z02", "Hloubení rýh / jam", ["hloubeni ryh", "hloubeni jam"], True, "important", None),
    ("Z03", "Odvoz výkopku", ["odvoz vykopku", "vodorovne premisteni", "premisteni vykopku"], True, "medium", None),
    ("B01", "Bílá vana opěrná stěna (beton+výztuž+bednění)", ["bila vana"], True, "critical", None),
    ("B02", "ŽB deska podlahy 1.NP", ["zb deska podlahy", "deska 1.np", "deska podlahy"], True, "important", None),
    ("B03", "Pozední věnec ŽB", ["pozedni venec"], True, "important", None),
    ("B04", "Nabetonávka stropu ocelobeton", ["nabetonavk"], True, "important", None),
    # Svislé + vodorovné
    ("S01", "Nadezdívka 3.NP + dozdívky", ["nadezdivka", "dozdivk"], True, "important", None),
    ("S02", "Ocelové překlady IPN160", ["ocelove preklady", "preklady ipn", "ipn160"], True, "important", None),
    ("V01", "Ocelobetonový strop (IPE+HEA+trapéz)", ["ocelova stropnice", "ipe180", "ocelobeton", "trapezovy plech"], True, "critical", None),
    ("V02", "Krov tesařský (krokve+kleštiny+vaznice)", ["krokve", "klestiny", "vaznice", "krov"], True, "critical", None),
    ("V03", "Schodiště ocelové/dřevěné", ["ocelove schodist", "drevene stupne", "schodist"], True, "important", None),
    # Krytina + klempířina
    ("K01", "Falcovaná hliníková krytina", ["plechova falcovan", "hlinikova krytina", "falcovan"], True, "important", None),
    ("K02", "Klempířina (oplechování+svody+žlaby+parapety)", ["klempir", "oplechovani", "svody", "parapet"], True, "important", None),
    # Fasáda
    ("F01", "ETICS kontaktní zateplení", ["etics kontaktni", "kontaktni zatepleni"], True, "critical", None),
    ("F02", "ETICS sokl + špalety", ["etics sokl", "spalet"], True, "medium", None),
    ("F03", "Tenkovrstvá fasádní omítka", ["tenkovrstva", "pastovita probarvena", "fasada"], True, "important", None),
    # Výplně
    ("O01", "Plastová okna trojsklem", ["plastove okno", "okno izolacnim trojsklem"], True, "critical", None),
    ("O02", "Vstupní + vnitřní dveře", ["plastove vstupni dvere", "vnitrni dvere"], True, "important", None),
    # Izolace + podlahy + povrchy
    ("I01", "TI nadkrokevní PIR + mezi trámy", ["nadkrokevni", "pir", "minerální vata mezi tramy", "mineralni vata mezi"], True, "important", None),
    ("I02", "Podlahová TI EPS", ["podlahovy eps", "eps 150"], True, "medium", None),
    ("I03", "Hydroizolace koupelen stěrka", ["hydroizolacni sterka koupelen", "sterka koupelen", "hydroizolace koupelen"], True, "important", None),
    ("P01", "Nášlapné vrstvy (vinyl+dlažba)", ["naslapn", "vinyl", "keramicka dlazba"], True, "important", None),
    ("P02", "Suchá podlaha Fermacell", ["sucha podlah", "fermacell"], True, "medium", None),
    ("U01", "Vnitřní omítky jádrová+štuk", ["omitka jadrova", "stukova"], True, "important", None),
    ("U02", "SDK podhledy", ["sdk podhled", "sadrokarton podhled"], True, "medium", None),
    ("U03", "Obklady koupelen keramické", ["keramicky obklad", "obklad sten koupeln"], True, "important", None),
    ("U04", "Výmalba interiérová", ["vymalba", "interierova vymalba"], True, "medium", None),
    # TZB + ELI
    ("T01", "ZTI vodovod + kanalizace rozvody", ["rozvody studen", "rozvody vodovod", "odpadni rozvody"], True, "important", None),
    ("T02", "Sanita (WC+umyvadlo+vana+sprcha)", ["sanitarni keramik", "wc", "umyvadlo", "vana", "sprch"], True, "important", None),
    ("T03", "Vytápění (TČ+krb+kamna+rozvody)", ["tepelne cerpadlo", "kamna", "krb", "rozvody otopne", "elektrokotel"], True, "important", None),
    ("T04", "M-21 silnoproud rozvody+svítidla", ["silnoproud", "rozvody", "svitidl", "zasuvk"], True, "important", None),
    ("T05", "Detekce požární (hlásiče)", ["autonomni hlasic", "detekce poz", "hlasic kour"], True, "medium", None),
    # VRN standard
    ("R01", "Zařízení staveniště", ["zarizeni staveni", "bunka"], True, "important", None),
    ("R02", "Geodet zaměření", ["geodet"], True, "medium", None),
    ("R03", "BOZP koordinátor", ["bozp", "koordinator"], True, "medium", None),
    ("R04", "Odvoz + likvidace suti", ["odvoz a likvidace", "likvidace stavebni suti", "kontejnery na sut"], True, "important", None),
    ("R05", "Revize závěrečné", ["revize"], True, "medium", None),
    ("R06", "Mykologický + azbestový průzkum", ["mykologick", "azbestov"], True, "medium", None),
    ("R07", "Kolaudace", ["kolaudac"], True, "medium", None),
]


def main() -> None:
    try:
        with ITEMS_PATH.open() as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        raise SystemExit(f"ERROR loading items.json: {e}")
    items = data.get("items", [])
    if not items:
        raise SystemExit("ERROR: no items in items.json")

    # Build searchable corpus per item (dum scope primarily; sklad cross-checked)
    item_texts = []
    for it in items:
        blob = norm(" ".join([
            it.get("popis", ""), it.get("subkapitola", ""),
            it.get("kapitola", ""), it.get("mnozstvi_formula") or "",
        ]))
        item_texts.append((it["id"], it["kapitola"], blob))

    # PBR hromosvod verification (already known NOT FOUND, recorded for PM03)
    pbr_has_hromosvod = False  # verified empirically — D_3_PBR_dum_TUSPO.pdf has no LPS mention

    results = []
    counts = {"COVERED": 0, "GAP": 0, "N/A": 0}
    gaps = []

    for anchor in ANCHORS:
        aid, label, tokens, applic, severity, draft = anchor
        # Applicability resolution
        if applic == "verify_pbr":
            applicable = True  # applicable but needs PBR verification
        elif applic in ("medium_check",):
            applicable = True
        else:
            applicable = bool(applic)

        # Match against items
        matched = []
        for iid, kap, blob in item_texts:
            if any(norm(tok) in blob for tok in tokens):
                matched.append(iid)

        if not applicable:
            verdict = "N/A"
        elif matched:
            verdict = "COVERED"
        else:
            verdict = "GAP"

        counts[verdict] += 1
        row = {
            "anchor_id": aid,
            "label": label,
            "verdict": verdict,
            "applicable": applicable,
            "matched_item_ids": matched[:6],
            "matched_count": len(matched),
        }
        if verdict == "GAP":
            row["gap_severity"] = severity
            if aid == "PM03":
                row["pbr_verification"] = "D_3_PBR_dum_TUSPO.pdf scanned — NO hromosvod/bleskosvod/LPS/uzemnění mention found. PBŘ does not explicitly require LPS. Needs projektant confirmation per ČSN EN 62305 risk analysis."
            if draft:
                row["suggested_item_draft"] = draft
            gaps.append(row)
        results.append(row)

    # Severity rollup for gaps
    sev_count = {}
    for g in gaps:
        sev_count[g["gap_severity"]] = sev_count.get(g["gap_severity"], 0) + 1

    out = {
        "_schema_version": "1.0",
        "_generated_at": TODAY,
        "_purpose": "Stage 1A — anchor checklist gap audit. RD Jáchymov frozen items vs ~40 typical RD works. Focus: implicit pomocné/VRN works (Audit v2 §C blind spot). items.json FROZEN — analysis only.",
        "_pattern_compliance": {
            "pattern_20": "§C domain anchor checklist — extended with implicit pomocné/VRN class",
            "pattern_15": "Work-first — gaps as generic popis drafts, NO catalog codes",
            "pattern_26": "Honest — gaps flagged, no fabrication; PM03 hromosvod marked needs-verify not assumed",
            "pattern_32": "Separate analysis — items.json frozen NOT touched",
        },
        "_frozen_baseline": {
            "items_json_count": len(items),
            "touched": False,
        },
        "_summary": {
            "anchors_total": len(ANCHORS),
            "verdicts": counts,
            "gaps_by_severity": sev_count,
        },
        "anchor_results": results,
        "gaps_with_drafts": gaps,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False))

    print(json.dumps({
        "anchors_total": len(ANCHORS),
        "verdicts": counts,
        "gaps_by_severity": sev_count,
        "GAP_list": [{"id": g["anchor_id"], "label": g["label"], "severity": g["gap_severity"]} for g in gaps],
        "frozen_touched": False,
        "output": str(OUT.relative_to(ROOT)),
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
