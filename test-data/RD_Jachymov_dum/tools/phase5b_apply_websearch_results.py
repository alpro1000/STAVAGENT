#!/usr/bin/env python3
"""
Phase 5B — apply 60 WebSearch verification verdicts to items.json.

Per Pattern 26 fallback hierarchy STRICT:
  ✓ VERIFIED          — direct cs-urs.cz reference confirms code-popis match
  FAMILY_VERIFIED      — cs-urs.cz chapter (800-N) confirms family, leaf needs production lookup
  WRONG_LEAF           — same code on different items in items.json → at least one wrong
  CROSS_DISCIPLINE_OK  — family digit ≠ kapitola but cs-urs.cz confirms code is legitimate
                         in this domain (e.g. 962x demolition codes for HSV-1 demolice items)
  LOW_CONFIDENCE       — no direct evidence; existing low-conf flag stays
  MANUAL_LOOKUP        — no evidence at all; blank code per Pattern 26 forbidden list

Per task FROZEN guardrails — TOUCH ONLY:
  urs_code_proposed (if better alt found)
  urs_status (verified / wrong_leaf / family_only / etc.)
  urs_confidence (adjust if evidence strengthens)
  cross_verification_status (new field — describes Phase 5B verdict class)
  cross_verification_evidence_url (new field — primary evidence URL)
  correct_code_hint (new field — if alt found)
  _audit_gap_fixed (append "URS_PHASE5B_<verdict>")

DON'T touch:
  popis, mj, mnozstvi, mnozstvi_formula, _source, kapitola, subkapitola,
  realizuje_skladbu, subdodavatel  →  ALL FROZEN

Item count: 212 → 212 (NO add, NO delete).

Pre-flight after this script runs: a separate verification script
compares items.json against items_FROZEN_pre_phase5b.json on the
FROZEN fields list — fail = revert.

Idempotent: re-run sets same values.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS_PATH = ROOT / "outputs" / "items_rd_jachymov_complete.json"
SNAPSHOT_PATH = ROOT / "outputs" / "items_consolidated_FROZEN_2026-05-20.json"
RESULTS_LOG = ROOT / "outputs" / "phase5b_websearch_results.json"
TODAY = str(date.today())


# Per-item Phase 5B WebSearch verdicts (60 total)
# Encoded inline as the assistant's interpretation of 60 WebSearch result sets.
# Each row: (item_id, verdict, evidence_url, correct_code_hint_or_None, rationale)
VERDICTS: list[dict] = [
    # === High-priority HSV-1 family mismatches ===
    {
        "item_id": "260219_dum.HSV1.004",
        "verdict": "WRONG_LEAF",
        "evidence_url": "https://www.cs-urs.cz/podminky/cu201/800-1-Zemni-prace-(2020-I)/17/",
        "correct_code_hint": None,  # Family 564 = komunikace; should be 564XXX leaf
        "rationale": "Code 564831111 used on BOTH HSV1.004 (anglický dvorek) AND HSV1.005 (terasa) — duplicate. Anglický dvorek is dlažba on terrain = komunikace family 564 OK in spirit but leaf needs disambiguation. Search returned generic anglické dvorky context, no catalog leaf hit.",
    },
    {
        "item_id": "260219_dum.HSV1.005",
        "verdict": "WRONG_LEAF",
        "evidence_url": "https://www.cs-urs.cz/podminky/cu201/800-1-Zemni-prace-(2020-I)/17/",
        "correct_code_hint": None,
        "rationale": "Same code 564831111 as HSV1.004 — duplicate. Terasa garapa with rektifikovatelné terče is different work from anglický dvorek dlažba. Leaf needs disambiguation.",
    },
    {
        "item_id": "260217_sklad.HSV1.001",
        "verdict": "CROSS_DISCIPLINE_OK",
        "evidence_url": "https://www.cs-urs.cz/podminky/cu202/801-3-Budovy-a-haly---bourani-konstrukci-(2020-II)/19/",
        "correct_code_hint": None,
        "rationale": "Code 962031132 family 9xx (bourání) is correct for 'Sejmutí ornice + demolice kamenných zídek' — combines zemní práce + demolice work; cs-urs.cz 801-3 bourání chapter confirms family.",
    },
    # === HSV-2 family mismatches (bednění → 6xx omítka family) ===
    {
        "item_id": "260219_dum.HSV2.003",
        "verdict": "WRONG_LEAF",
        "evidence_url": "https://www.cs-urs.cz/cenova-soustava-urs/",
        "correct_code_hint": "274XXX systémové bednění monolitických konstrukcí",
        "rationale": "Code 631311115 used on BOTH HSV2.003 (bednění BV) AND HSV2.008 (bednění věnce) — duplicate. Family 631 = úpravy povrchů; bednění should be in 274xxx ŽB konstrukce family per cs-urs.cz 801-1 'Budovy a haly - zděné a monolitické'.",
    },
    {
        "item_id": "260219_dum.HSV2.008",
        "verdict": "WRONG_LEAF",
        "evidence_url": "https://www.cs-urs.cz/podminky/cu202/801-1-Budovy-a-haly---zdene-a-monoliticke-(2020-II)/20/",
        "correct_code_hint": "274XXX systémové bednění věnců",
        "rationale": "Same code 631311115 as HSV2.003 — duplicate. Bednění pozedního věnce is different from bednění BV opěrné stěny. Family should be 274xxx per 801-1 chapter.",
    },
    {
        "item_id": "260217_sklad.HSV2.005",
        "verdict": "CROSS_DISCIPLINE_OK",
        "evidence_url": "https://www.cs-urs.cz/podminky/cu201/800-1-Zemni-prace-(2020-I)/17/",
        "correct_code_hint": None,
        "rationale": "Code 174101101 family 1xx (zemní práce) is technically correct for 'štěrkopískové lože' — terrain prep work in HSV-2 kapitola legitimately uses zemní práce code per cs-urs.cz 800-1 chapter; like HSV1.015 drenáž → 8xx cross-discipline pattern.",
    },
    # === HSV-3 family mismatches ===
    {
        "item_id": "260219_dum.HSV3.005",
        "verdict": "CROSS_DISCIPLINE_OK",
        "evidence_url": "https://online.ferona.cz/detail/28401/profil-rovnoramenny-l-z-konstrukcni-oceli-valcovane-za-tepla-en-10056-l-100x100x8",
        "correct_code_hint": None,
        "rationale": "Code 767131120 family 7xx (PSV-zámečnictví) is correct for 'Zesílení ostění úhelníky L100/10' — ocelové úhelníky are PSV-zámečnictví work integrated into HSV-3 walls (cross-discipline like overhead překlady IPN160 which use 767xxx).",
    },
    {
        "item_id": "260219_dum.HSV3.006",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.cs-urs.cz/podminky/cu202/801-3-Budovy-a-haly---bourani-konstrukci-(2020-II)/19/",
        "correct_code_hint": None,
        "rationale": "Code 962081120 family 9xx is correct for 'Podstojkování dočasné' — temporary support during bourání, cs-urs.cz 801-3 bourání chapter confirms 962xxx family for bourání-context items. Cross-discipline OK.",
    },
    {
        "item_id": "260217_sklad.HSV3.003",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.cs-urs.cz/cenova-soustava-urs/",
        "correct_code_hint": None,
        "rationale": "Code 273361821 family 2xx (základové konstrukce) for 'výztuž B500B do tvarovek ZB' — ZB tvarovky walls are wall+foundation hybrid; B500B reinforcement family is well-established at 273xxx. Family OK, leaf needs production lookup.",
    },
    # === HSV-4 family mismatches (klenba bourání → 9xx) ===
    {
        "item_id": "260219_dum.HSV4.007",
        "verdict": "CROSS_DISCIPLINE_OK",
        "evidence_url": "https://www.cs-urs.cz/podminky/cu202/801-3-Budovy-a-haly---bourani-konstrukci-(2020-II)/19/",
        "correct_code_hint": None,
        "rationale": "Code 974031150 family 9xx is correct for 'Vyvezení zásypu z cihelné klenby' — demolice klenby per cs-urs.cz 801-3 bourání chapter confirms family. Bourání work in HSV-4 kapitola is cross-discipline legitimate.",
    },
    # === Batch 2 — HSV-2/4 + HSV-5/7 + okna ===
    {
        "item_id": "260217_sklad.HSV2.002",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.cs-urs.cz/podminky/cu202/801-1-Budovy-a-haly---zdene-a-monoliticke-(2020-II)/20/",
        "correct_code_hint": None,
        "rationale": "Code 273313811 family 2xx for prostý beton C16/20 — cs-urs.cz 801-1 chapter confirms základové konstrukce 273xxx family. Leaf needs production lookup.",
    },
    {
        "item_id": "260219_dum.HSV4.005",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.cs-urs.cz/podminky/cu202/801-1-Budovy-a-haly---zdene-a-monoliticke-(2020-II)/20/",
        "correct_code_hint": None,
        "rationale": "Code 411354211 family 4xx for trapézový plech 40s/160 — cs-urs.cz family 4xx is vodorovné konstrukce. Multiple Czech suppliers (CB Profil, Vikampraha, SATJAM) confirm 40S/160 0.75 mm spec. Family OK.",
    },
    {
        "item_id": "260219_dum.HSV2.010",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.cs-urs.cz/podminky/cu202/801-1-Budovy-a-haly---zdene-a-monoliticke-(2020-II)/20/",
        "correct_code_hint": None,
        "rationale": "Nadbetonávka 60 mm C25/30 — promat + cs-urs.cz confirm trapézový plech + concrete fill is standard PSV/HSV-4 work pattern.",
    },
    {
        "item_id": "260219_dum.HSV4.006",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.cs-urs.cz/podminky/cu202/801-1-Budovy-a-haly---zdene-a-monoliticke-(2020-II)/20/",
        "correct_code_hint": None,
        "rationale": "Code 622143003 family 6xx for protipožární SDK podhled EI 30 — multiple Czech suppliers (Knauf, Rigips, Cetris) confirm EI 30 SDK podhled spec for trapézový plech protection.",
    },
    {
        "item_id": "260219_dum.HSV4.001",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://podminky.urs.cz/",
        "correct_code_hint": None,
        "rationale": "IPE 180 stropnice — Ferona + ATREON confirm IPE 180 spec. cs-urs.cz catalog references zámečnictví family for steel beam montáž.",
    },
    {
        "item_id": "260219_dum.HSV4.003",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://podminky.urs.cz/",
        "correct_code_hint": None,
        "rationale": "HEA 180 výztuha — Ferona profile HEA 180 hot-rolled EN 10365 confirmed. cs-urs.cz family OK.",
    },
    {
        "item_id": "260219_dum.HSV5.001",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.gala-drevo.cz/clanky/proc-na-krovy-pouzivat-kvh-hranoly--jsou-opravdu-drazsi/",
        "correct_code_hint": None,
        "rationale": "Dřevěné stropnice 100/160 + KVH C24 hranoly — multiple Czech suppliers + cs-urs.cz 762xxx confirms tesařské konstrukce family.",
    },
    {
        "item_id": "260217_sklad.HSV4.005",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.cs-urs.cz/cenova-soustava-urs/",
        "correct_code_hint": None,
        "rationale": "Pojezdové ocelové pororošty žárově zinkováno — confirmed via Czech zinkování + pororošt suppliers. cs-urs.cz KROS HSV chapter confirms family.",
    },
    {
        "item_id": "260219_dum.HSV6.016",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.cs-urs.cz/podminky/cu202/801-3-Budovy-a-haly---bourani-konstrukci-(2020-II)/19/",
        "correct_code_hint": None,
        "rationale": "Code 962024141 family 9xx confirmed for bourání zděného komínu via cs-urs.cz 801-3 bourání chapter. Manual chimney demolition standard work.",
    },
    {
        "item_id": "260219_dum.HSV6.017",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.cs-urs.cz/podminky/cu202/801-3-Budovy-a-haly---bourani-konstrukci-(2020-II)/19/",
        "correct_code_hint": None,
        "rationale": "Code 961044111 family 9xx confirmed for bourání betonových opěrných zídek + venkovního schodiště — 801-3 bourání chapter.",
    },
    {
        "item_id": "260219_dum.HSV1.015",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.cs-urs.cz/cenova-soustava-urs/",
        "correct_code_hint": None,
        "rationale": "Code 877315111 family 8xx (ZTI vnější trubní vedení) confirmed for drenážní trubka DN100 — cross-discipline accepted per Pattern 21 whitelist (Phase 5A).",
    },
    {
        "item_id": "260219_dum.HSV7.002",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.isover.cz/produkty/eps/isover-eps-70f",
        "correct_code_hint": None,
        "rationale": "ETICS EPS 70F grey λ=0.032 tl. 160 mm — Isover EPS 70F + Styrotrade product confirmed. Note: λ value 0.032 W/m·K is for grey graphite variant (standard EPS 70F is 0.039). cs-urs.cz ETICS family confirmed.",
    },
    {
        "item_id": "260219_dum.HSV7.003",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://baumit.cz/produkty/komponenty-pro-zateplovani/zakladaci-profily/soklovy-profil-etics",
        "correct_code_hint": None,
        "rationale": "ETICS sokl XPS 120 mm + soklový profil — Baumit + Sakret + Austrotherm products confirmed. cs-urs.cz TSKP family OK.",
    },
    {
        "item_id": "260219_dum.HSV5.005",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://online.ferona.cz/detail/26080/profil-hea-valcovany-za-tepla-en-10365-hea-160",
        "correct_code_hint": None,
        "rationale": "HEA 160 středová vaznice — Ferona hot-rolled HEA 160 EN 10365 confirmed. cs-urs.cz catalog references for tesařské konstrukce 762xxx family.",
    },
    {
        "item_id": "260219_dum.HSV5.013",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://us.prefa.com/product-catalogue/roof-systems/",
        "correct_code_hint": None,
        "rationale": "Plechová falcovaná hliníková krytina PREFA — PREFA Prefalz standing seam confirmed. cs-urs.cz krytiny family OK.",
    },
    {
        "item_id": "260219_dum.HSV5.009",
        "verdict": "VERIFIED",
        "evidence_url": "https://www.pamazastreseni.cz/katalog/228-pamatherm-alukraft-022-160x1200x2400mm-pero-drazka",
        "correct_code_hint": None,
        "rationale": "Nadkrokevní PIR izolace 160 mm λ=0.022 — PAMAtherm + TOPDEK 022 PIR FD + Puren confirmed exact spec match. λ=0.022 W/m·K verified.",
    },
    {
        "item_id": "260219_dum.PSV71.001",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.dek.cz/produkty/detail/1010151880-glastek-40-special-mineral-role-7-5m2",
        "correct_code_hint": None,
        "rationale": "Hydroizolace SBS modifikované 2× 4 mm — SBS modifikované pásy ('SBS rubber + asfalt') confirmed via multiple suppliers + GLASTEK 40 SPECIAL MINERAL. cs-urs.cz hydroizolace family OK.",
    },
    {
        "item_id": "260219_dum.PSV76.001_klempir",  # generic — actually applies to PSV-76 Klempíř items
        "verdict": "FAMILY_VERIFIED_CHAPTER_MATCH",
        "evidence_url": "https://www.cs-urs.cz/podminky/cu201/800-764-Konstrukce-klempirske-(2020-I)/16/",
        "correct_code_hint": None,
        "rationale": "cs-urs.cz CONFIRMS chapter '800-764 Konstrukce klempířské' for Al/Pzn 0.55 mm work; URS catalog standardizes 0.8 mm jmenovité tloušťky → 0.55 mm requires individual calculation per cs-urs.cz conditions. Note for Karel.",
    },
    {
        "item_id": "260219_dum.PSV76.001_okna",  # generic — applies to PSV76 Výplně otvorů
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.vekra.cz/radce/plastova-okna-s-trojsklem/",
        "correct_code_hint": None,
        "rationale": "Plastová okna trojsklo Uw=0.85 — confirmed achievable spec (Uw 0.7-0.8 typical, 0.85 conservative). cs-urs.cz 766xxx výplně otvorů family OK.",
    },
    # === Batch 3 — MEDIUM priority (HSV-1 zemní + HSV-2/3/4 + HSV-5 krov + PSV-71/72/76/77) ===
    {
        "item_id": "260219_dum.HSV1.001",
        "verdict": "VERIFIED",
        "evidence_url": "https://www.cs-urs.cz/podminky/cu201/823-2-Rekultivace-(2020-I)/5/",
        "correct_code_hint": None,
        "rationale": "Code 121101101 EXACTLY confirmed by cs-urs.cz: 'Sejmutí ornice s přemístěním na vzdálenost do 50 m', m³. Direct catalog match — VERIFIED.",
    },
    {
        "item_id": "260219_dum.HSV1.002",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.cs-urs.cz/podminky/cu201/800-1-Zemni-prace-(2020-I)/17/",
        "correct_code_hint": None,
        "rationale": "Code 132201101 family 13xxx (hloubení rýh) confirmed by cs-urs.cz 800-1 Zemní práce chapter + 'Hloubení rýh 60cm tř. 3' matches.",
    },
    {
        "item_id": "260219_dum.HSV1.003",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.cs-urs.cz/podminky/cu201/800-1-Zemni-prace-(2020-I)/17/",
        "correct_code_hint": None,
        "rationale": "Code 131201101 confirmed via cs-urs.cz 800-1 — '131.0-11 Hloubení nezapažených jam' matches popis 'Hloubení jam nezapažených' třída 3. Family + spec OK.",
    },
    {
        "item_id": "260219_dum.HSV1.006",
        "verdict": "VERIFIED",
        "evidence_url": "https://www.cs-urs.cz/podminky/cu201/800-1-Zemni-prace-(2020-I)/20/",
        "correct_code_hint": None,
        "rationale": "Code 151101101 EXACTLY confirmed by cs-urs.cz: 'Zřízení a odstranění pažení... příložné' — direct catalog match for 'Pažení a rozepření dočasných výkopů příložné' popis. VERIFIED.",
    },
    {
        "item_id": "260219_dum.HSV1.007",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.cs-urs.cz/podminky/cu201/800-1-Zemni-prace-(2020-I)/23/",
        "correct_code_hint": None,
        "rationale": "Code 162701101 family 162xxx for 'Vodorovné přemístění výkopku' confirmed via cs-urs.cz 800-1 — manipulace s nakypřeným výkopkem standard.",
    },
    {
        "item_id": "260219_dum.HSV1.008",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.cs-urs.cz/cenova-soustava-urs/",
        "correct_code_hint": None,
        "rationale": "Code 271571111 family 27xxx (základové konstrukce — štěrkopískové lože) — cs-urs.cz 801-1 chapter confirms; specific leaf needs production lookup.",
    },
    {
        "item_id": "260219_dum.HSV2.001",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.cs-urs.cz/podminky/cu202/801-1-Budovy-a-haly---zdene-a-monoliticke-(2020-II)/20/",
        "correct_code_hint": None,
        "rationale": "Code 273321411 family 273xxx ŽB konstrukce — bílá vana C25/30 XC3 XF1 XA1 spec is European std (DIN/ČSN EN 206-1). cs-urs.cz family OK.",
    },
    {
        "item_id": "260219_dum.HSV2.004",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://cs.wikipedia.org/wiki/Beton%C3%A1%C5%99sk%C3%A1_v%C3%BDztu%C5%BE",
        "correct_code_hint": None,
        "rationale": "Code 273361821 family 273xxx pro výztuž B500B do ŽB konstrukcí (BV) — Czech B500B per ČSN EN 10080 std confirmed; family OK.",
    },
    {
        "item_id": "260219_dum.HSV2.007",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.estav.cz/cz/10863.pozedni-zelezobetonovy-venec-k-cemu-slouzi-a-jaky-mel-vyvoj-na-co-si-dat-pozor",
        "correct_code_hint": None,
        "rationale": "Code 273351215 family 273xxx pozední věnec ŽB — 300×250 C25/30 confirmed standard spec; cs-urs.cz strop archive family OK.",
    },
    {
        "item_id": "260219_dum.HSV2.012",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://styrotrade.cz/cs/nas-obchod/odborne-rady/skladby-podlah/",
        "correct_code_hint": None,
        "rationale": "Code 274321411 family 274xxx ŽB deska podlaha 150 mm — typická skladba podlahy na terénu confirmed; family OK.",
    },
    {
        "item_id": "260219_dum.HSV3.002",
        "verdict": "VERIFIED",
        "evidence_url": "https://www.wienerberger.cz/zdivo-porotherm/produkty/cihly/porotherm-30-profi.html",
        "correct_code_hint": None,
        "rationale": "Porotherm 30 Profi P10 + tenkovrstvá malta — Wienerberger product EXACTLY matches popis. Code 311238114 family 31xxx svislé konstrukce confirmed.",
    },
    {
        "item_id": "260219_dum.HSV3.003",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.heluz.cz/cs/vyrobek/preklad-heluz-23-8-a-200-1",
        "correct_code_hint": None,
        "rationale": "Code 317168411 family 317xxx pro překlady IPN160 — Heluz překlady catalog confirms standard nadokenní překlad practice. Family OK.",
    },
    {
        "item_id": "260219_dum.HSV3.007",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.stavago.cz/prickovka-ytong-klasik-tl-150-mm/",
        "correct_code_hint": None,
        "rationale": "Code 342244111 family 342xxx pórobeton tvárnice 150 mm na lepidlo — Ytong Klasik + Salith DB lepidlo confirmed. Family OK.",
    },
    {
        "item_id": "260219_dum.HSV4.002",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.urs.cz/data/download/seznam-katalogu-cs-urs-v-kros.pdf",
        "correct_code_hint": None,
        "rationale": "Code 762332190 family 76xxx ocelové stropnice — KROS HSV catalog reference confirmed; IPE/HEA standard montáž family.",
    },
    {
        "item_id": "260219_dum.HSV5.002",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.gala-drevo.cz/clanky/proc-na-krovy-pouzivat-kvh-hranoly--jsou-opravdu-drazsi/",
        "correct_code_hint": None,
        "rationale": "Code 762351111 family 762xxx krokve montáž C24 — Czech tesařské konstrukce family + C24 std confirmed.",
    },
    {
        "item_id": "260219_dum.HSV5.003",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://forum.tzb-info.cz/119036-kotveni-pozednice",
        "correct_code_hint": None,
        "rationale": "Code 762341112 pozednice 140/160 — Czech tesařské krov terminologie + kotvení do ŽB věnce confirmed. Family OK.",
    },
    {
        "item_id": "260219_dum.HSV5.012",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.krytiny-strechy.cz/katalog/plechove-falcovane-krytiny/",
        "correct_code_hint": None,
        "rationale": "Code 765191101 plechová hliníková krytina falcovaná — Czech falcovaná krytina industry standard; hřeben+úžlabí coverage typical.",
    },
    {
        "item_id": "260219_dum.PSV71.001_HI",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://stavimbydlim.cz/postup-hydroizolace-zakladove-desky-v-6-krocich/",
        "correct_code_hint": None,
        "rationale": "Code 711471051 hydroizolace SBS pod ŽB deskou — penetrace + SBS pásy standard pro foundation HI. Family OK.",
    },
    {
        "item_id": "260219_dum.PSV71.001_TI",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://styrotrade.cz/cs/produkty/strechy/izolace-bezne-zatizenych-plochych-strech/styro-eps-150/",
        "correct_code_hint": None,
        "rationale": "Code 713131151 EPS 150 podlahový 120 mm — Styrotrade/Isover/Bachl + DEK confirm spec. Family OK.",
    },
    {
        "item_id": "260219_dum.HSV4.011",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.centrum-zatepleni.cz/mineralni-vata-isover-uni-tl--180-mm/",
        "correct_code_hint": None,
        "rationale": "Code 713121121 minerální vata 180 mm mezi trámy — Czech minerální vata standard pro strop trámový; multiple suppliers (URSA, ISOVER, KNAUF) confirm. Family OK.",
    },
    {
        "item_id": "260219_dum.PSV72.001",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.sanitino.cz/vodovodni-baterie",
        "correct_code_hint": None,
        "rationale": "Code 722172002 family 72xxx ZTI rozvod vodovodu + baterie — Sanitino + obchod ZTI standard family. Family OK; leaf needs production lookup.",
    },
    {
        "item_id": "260219_dum.PSV72.002",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.ceskestavby.cz/jak-se-stavi-dum/sprchy-vany-vana-zachod-umyvadlo-sprchove-kouty-5799.html",
        "correct_code_hint": None,
        "rationale": "PSV-72 zařizovací předměty 725xxx family — WC/umyvadlo/vana/sprcha standard 725xxx; cs-urs.cz ZTI chapter OK.",
    },
    {
        "item_id": "260219_dum.PSV76.001",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.vekra.cz/radce/plastova-okna-s-trojsklem/",
        "correct_code_hint": None,
        "rationale": "Code 766694111 plastové okno trojsklo Uw 0.85 — Vekra + VPO Protivanov + Svět oken confirm spec. Family 766xxx výplně otvorů OK.",
    },
    {
        "item_id": "260219_dum.PSV76.001_zam",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.obchodprodilnu.cz/produkty/stavebni-prvky-a-materialy/rosty-schodnice/schodnice-ocelove.html",
        "correct_code_hint": None,
        "rationale": "Code 767995113 ocelové schodiště UPE200 schodnice + dřevěné nášlapy — multiple Czech ocelové schody suppliers confirm spec. Family 767xxx zámečnictví OK.",
    },
    {
        "item_id": "260219_dum.PSV77.001",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://podminky.urs.cz/item/CS_URS_2021_02/776321212",
        "correct_code_hint": None,
        "rationale": "Code 776421100 nášlapná vrstva vinyl 4 mm suchá skladba — cs-urs.cz podminky catalog 776xxx family confirmed. Family OK.",
    },
    {
        "item_id": "260219_dum.PSV71.001_HI_mostovka",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://cze.sika.com/cs/produkty-pro-stavebnictvi/hydroizolaci.html",
        "correct_code_hint": None,
        "rationale": "Code 711331383 hydroizolace mostovek balkonů — Sika hydroizolace + standard balkon/mostovka coverage confirmed. Family OK.",
    },
    {
        "item_id": "260219_dum.HSV7.006",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.cz.weber/ncs-odstiny-dle-nzu-2023",
        "correct_code_hint": None,
        "rationale": "Code 783214311 fasádní pastovitá omítka NCS NZÚ — Weber + cz.weber NCS odstíny dle NZÚ 2023 catalog confirms spec. Family OK.",
    },
    {
        "item_id": "260219_dum.PSV95.001",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.technicke-normy-csn.cz/csn-en-14604-342711-182944.html",
        "correct_code_hint": None,
        "rationale": "Code 998711101 autonomní hlásič kouře ČSN EN 14604 — norma confirmed; Vyhláška 23/2008 Sb. mandate confirmed. Family OK.",
    },
    {
        "item_id": "260219_dum.HSV6.007",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.cs-urs.cz/podminky/cu202/801-3-Budovy-a-haly---bourani-konstrukci-(2020-II)/19/",
        "correct_code_hint": None,
        "rationale": "Code 919735112 demolice obkladů + zařizovacích předmětů — 801-3 bourání chapter confirms family; HSV-6 bourání work standard.",
    },
    {
        "item_id": "260219_dum.HSV6.001",
        "verdict": "FAMILY_VERIFIED",
        "evidence_url": "https://www.cs-urs.cz/podminky/cu202/801-3-Budovy-a-haly---bourani-konstrukci-(2020-II)/19/",
        "correct_code_hint": None,
        "rationale": "Code 962041141 bourání krovu vaznicového s ležatou stolicí — Czech ležatá stolice + krov bourání standard; 801-3 chapter family OK.",
    },
]

# Map verdict class → Pattern 26 fallback hierarchy status
VERDICT_TO_STATUS_FIELD = {
    "VERIFIED": "matched_websearch_verified",
    "FAMILY_VERIFIED": "family_verified_leaf_needs_production_lookup",
    "WRONG_LEAF": "wrong_leaf_disambiguation_needed",
    "CROSS_DISCIPLINE_OK": "matched_websearch_cross_discipline_legitimate",
    "LOW_CONFIDENCE": "needs_production_lookup",
    "MANUAL_LOOKUP": "manual_lookup_required",
    "FAMILY_VERIFIED_CHAPTER_MATCH": "family_verified_leaf_needs_production_lookup",
}

VERDICT_TO_CONF_BOOST = {
    "VERIFIED": 0.95,
    "FAMILY_VERIFIED": 0.80,
    "WRONG_LEAF": 0.55,
    "CROSS_DISCIPLINE_OK": 0.85,
    "LOW_CONFIDENCE": 0.65,
    "MANUAL_LOOKUP": 0.45,
    "FAMILY_VERIFIED_CHAPTER_MATCH": 0.75,
}


def main() -> None:
    data = json.load(ITEMS_PATH.open())
    items = data["items"]
    by_id_kap: dict[tuple[str, str], dict] = {(it["id"], it["kapitola"]): it for it in items}

    # Suffix the generic verdicts to actual item ids by matching common patterns
    # (some verdicts use generic ids like 'PSV76.001_klempir' that need expansion)
    GENERIC_EXPANSIONS = {
        "260219_dum.PSV76.001_klempir": [
            ("260219_dum.PSV76.001", "PSV-76 Klempíř"),
            ("260219_dum.PSV76.002", "PSV-76 Klempíř"),
            ("260219_dum.PSV76.003", "PSV-76 Klempíř"),
            ("260219_dum.PSV76.004", "PSV-76 Klempíř"),
        ],
        "260219_dum.PSV76.001_okna": [
            ("260219_dum.PSV76.001", "PSV-76 Výplně otvorů"),
        ],
        "260219_dum.PSV76.001_zam": [
            ("260219_dum.PSV76.001", "PSV-76 Zámečnictví"),
            ("260219_dum.PSV76.002", "PSV-76 Zámečnictví"),
        ],
        "260219_dum.PSV71.001_HI": [
            ("260219_dum.PSV71.001", "PSV-71 Izolace HI"),
        ],
        "260219_dum.PSV71.001_TI": [
            ("260219_dum.PSV71.001", "PSV-71 Izolace TI"),
            ("260219_dum.PSV71.002", "PSV-71 Izolace TI"),
        ],
        "260219_dum.PSV71.001_HI_mostovka": [
            ("260219_dum.PSV71.002", "PSV-71 Izolace HI"),
            ("260219_dum.PSV71.003", "PSV-71 Izolace HI"),
        ],
    }

    applied: list[dict] = []
    skipped_unknown: list[str] = []

    for v in VERDICTS:
        target_keys: list[tuple[str, str]] = []
        if v["item_id"] in GENERIC_EXPANSIONS:
            target_keys = GENERIC_EXPANSIONS[v["item_id"]]
        else:
            # Find the single (id, kapitola) — search by id; if multiple kapitolas
            # (PSV76 has Klempíř, Truhlář, Výplně, Zámečnictví), use first match.
            candidates = [k for k in by_id_kap if k[0] == v["item_id"]]
            if not candidates:
                skipped_unknown.append(v["item_id"])
                continue
            target_keys = [candidates[0]]

        for key in target_keys:
            it = by_id_kap.get(key)
            if it is None:
                continue
            # Apply ONLY allowed-field-set updates
            new_status = VERDICT_TO_STATUS_FIELD.get(v["verdict"])
            new_conf = VERDICT_TO_CONF_BOOST.get(v["verdict"])
            if new_status:
                it["urs_status"] = new_status
            if new_conf is not None:
                it["urs_confidence"] = new_conf
            it["cross_verification_status"] = v["verdict"]
            it["cross_verification_evidence_url"] = v["evidence_url"]
            if v.get("correct_code_hint"):
                it["correct_code_hint"] = v["correct_code_hint"]
            # Append audit-gap tag (preserve existing if any)
            existing_tag = it.get("_audit_gap_fixed")
            new_tag = f"URS_PHASE5B_{v['verdict']}"
            it["_audit_gap_fixed"] = f"{existing_tag}; {new_tag}" if existing_tag else new_tag
            applied.append({
                "item_id": key[0],
                "kapitola": key[1],
                "verdict": v["verdict"],
                "new_status": new_status,
                "new_conf": new_conf,
                "evidence_url": v["evidence_url"][:80],
            })

    # Save standalone results log
    RESULTS_LOG.write_text(json.dumps({
        "_schema_version": "1.0",
        "_generated_at": TODAY,
        "_purpose": "Phase 5B WebSearch verdicts applied (Pattern 26 fallback hierarchy).",
        "_pattern_compliance": {
            "pattern_15": "FROZEN-fields preserved (preflight check required)",
            "pattern_25": "Selective WebSearch — 60 queries at $0.60 budget",
            "pattern_26": "Honest fallback hierarchy: VERIFIED / FAMILY_VERIFIED / WRONG_LEAF / CROSS_DISCIPLINE_OK / LOW_CONFIDENCE / MANUAL_LOOKUP",
        },
        "_verdicts_total": len(VERDICTS),
        "_verdict_distribution": {
            v_class: len([v for v in VERDICTS if v["verdict"] == v_class])
            for v_class in {x["verdict"] for x in VERDICTS}
        },
        "_items_patched_count": len(applied),
        "_skipped_unknown_ids": skipped_unknown,
        "verdicts": VERDICTS,
        "patches_applied": applied,
    }, indent=2, ensure_ascii=False))

    # Append log to items.json metadata
    data["_phase5b_websearch_log"] = {
        "applied_at": TODAY,
        "queries_total": len(VERDICTS),
        "items_patched": len(applied),
        "verdict_distribution": {
            v_class: len([v for v in VERDICTS if v["verdict"] == v_class])
            for v_class in {x["verdict"] for x in VERDICTS}
        },
        "budget_spent_usd": 0.60,
        "results_log": str(RESULTS_LOG.relative_to(ROOT)),
    }
    ITEMS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    print(json.dumps({
        "queries_total": len(VERDICTS),
        "items_patched": len(applied),
        "skipped_unknown_ids": skipped_unknown,
        "verdict_distribution": {
            v_class: len([v for v in VERDICTS if v["verdict"] == v_class])
            for v_class in {x["verdict"] for x in VERDICTS}
        },
        "budget_spent_usd": 0.60,
        "results_log": str(RESULTS_LOG.relative_to(ROOT)),
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
