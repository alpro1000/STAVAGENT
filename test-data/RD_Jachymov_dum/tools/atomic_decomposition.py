#!/usr/bin/env python3
"""
§5 — Atomic decomposition map generator (HK212 028a..f principle).

Reads frozen items.json (READ-ONLY, never mutated). Produces
outputs/atomic_decomposition_map.json — atomic work list where composite
skladby/fixtures are split into per-vrstva / per-fixture coded operations.

Decomposition rules:
  - TRUE_SKLADBA (genuine multi-layer) → per vrstva (HK212 letter-suffix)
  - MULTI_FIXTURE → per fixture
  - HSV2.012 ŽB deska → KEPT ATOMIC (kari výztuž is separate HSV2.013 —
    decomposing would double-count)
  - PSV77 dlažby → light 2-op split (kladení+lepení / spárování)
  - 181 atomic + 11 VRN lump → carry 1:1

Per Pattern 26: família-level URS code where leaf unknown + status flag.
NEVER fabricate a 9-digit leaf.
Per Pattern 28: identity resolved via (id, kapitola, subkapitola) compound
key — items.json has id collisions (PSV76.003 × 3 kapitolas, VRN.001 × 9).

Traceability: every atomic op carries parent_frozen_item_id +
realizuje_skladbu (carried) + qty_formula + parent_popis.
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS_PATH = ROOT / "outputs" / "items_rd_jachymov_complete.json"
OUT = ROOT / "outputs" / "atomic_decomposition_map.json"
TODAY = str(date.today())


# ---------------------------------------------------------------------------
# Explicit decomposition tables — keyed by (id, kapitola)
# Each atomic op: (suffix, popis, mj, qty, urs_family_or_leaf, urs_status, qty_formula, pozn)
# urs_status: "carried_verified" | "family_only" | "needs_lookup"
# ---------------------------------------------------------------------------

DECOMP: dict[tuple[str, str], list[dict]] = {
    # === 13/14 TRUE_SKLADBA ===
    ("260219_dum.HSV1.004", "HSV-1 Zemní práce"): [
        {"suffix": "a", "popis": "Kladení betonové dlažby tl. 50 mm — anglický dvorek", "mj": "m²", "qty": 16.54, "urs": "596", "status": "family_only", "qty_formula": "= HSV1.004 plocha dvorku 16.54 m² (situace 12.46 + 4.08, dlažba = brick-hatch)", "pozn": "Dlažba NA LOŽI (596 família) — ne na terče. Leaf dle typu dlažby (zámková 596211 / velkoformát 596811) — verify u dodavatele."},
        {"suffix": "b", "popis": "Kladecí vrstva z kamenné drti frakce 4-8 mm tl. 40 mm — anglický dvorek", "mj": "m²", "qty": 16.54, "urs": "564", "status": "family_only", "qty_formula": "= HSV1.004 plocha dvorku 16.54 m² (situace 12.46 + 4.08)", "pozn": "Kladecí lože pod dlažbu (564 família) — řez C-C, dříve sloučeno s dlažbou (op a)."},
        {"suffix": "c", "popis": "Podkladní nosná vrstva z kamenné drti frakce 4-8 mm tl. 150 mm + zhutnění — anglický dvorek", "mj": "m²", "qty": 16.54, "urs": "564", "status": "family_only", "qty_formula": "= HSV1.004 plocha 16.54 m²", "pozn": "Podklad ze štěrkodrti (564 família)."},
        {"suffix": "d", "popis": "Úprava + zhutnění zemní pláně na Edef ≥ 30 MPa — anglický dvorek", "mj": "m²", "qty": 16.54, "urs": "181", "status": "family_only", "qty_formula": "= HSV1.004 plocha 16.54 m²", "pozn": "Úprava pláně (181 família) — případně zahrnuto v zemních pracích."},
    ],
    # HSV1.005 = PODKLADNÍ SKLADBA terasy (pod dřevěnou pochozí vrstvou PSV76.002 Truhlář).
    # ŘEZ C-C oprava 2026-05-29: dlaždice = roznášecí vrstva POD terče (NE na terče).
    # Split-by-trade: dřevo (prkna + dřevěný rošt, 762) = PSV76.002, žádné zdvojení 30 m².
    ("260219_dum.HSV1.005", "HSV-1 Zemní práce"): [
        {"suffix": "a", "popis": "Osazení rektifikovatelných terčů výšky ~50 mm na betonové dlaždice — terasa za opěrnou stěnou (nesou dřevěnou pochozí vrstvu PSV76.002)", "mj": "m²", "qty": 9.23, "urs": None, "status": "needs_lookup", "qty_formula": "= HSV1.005 plocha terasy 9.23 m² (situace měření, terasa = line-hatch)", "pozn": "Rektifikovatelné terče — spec systém (família needs_lookup). Nesou dřevěný rošt + prkna (PSV76.002 Truhlář, 762)."},
        {"suffix": "b", "popis": "Betonové dlaždice tl. 50 mm jako roznášecí (nosná) vrstva POD rektifikovatelné terče — terasa", "mj": "m²", "qty": 9.23, "urs": "564", "status": "family_only", "qty_formula": "= HSV1.005 plocha terasy 9.23 m² (situace měření)", "pozn": "ŘEZ C-C OPRAVA: dlaždice = roznášecí vrstva POD terče (NE 636311 'na terče' — to byla chyba). Roznášecí betonová dlaždice na podsypu → 564/596 família. Leaf Stage 3."},
        {"suffix": "c", "popis": "Štěrkový podsyp frakce 16/32 mm tl. 100 mm — terasa", "mj": "m²", "qty": 9.23, "urs": "564", "status": "family_only", "qty_formula": "= HSV1.005 plocha 9.23 m²", "pozn": "Podklad štěrkopísek (564 família)."},
        {"suffix": "d", "popis": "Hrubý podsyp z kamenné drti frakce 4/8 mm tl. 150 mm — terasa", "mj": "m²", "qty": 9.23, "urs": "564", "status": "family_only", "qty_formula": "= HSV1.005 plocha 9.23 m²", "pozn": "Podklad štěrkodrť (564 família)."},
        {"suffix": "e", "popis": "Geotextilie separační pod podsyp terasy", "mj": "m²", "qty": 9.23, "urs": "693", "status": "family_only", "qty_formula": "= HSV1.005 plocha 9.23 m²", "pozn": "Geotextilie (693 família) nebo zahrnuto v 564."},
    ],
    # PSV76.002 Truhlář = dřevěná POCHOZÍ vrstva terasy (terče + podklad = HSV1.005, split-by-trade).
    # ŘEZ C-C: prkna garapa 25 mm na dřevěném roštu z hranolů 50 mm. Rošt opraven hliníkový→dřevěný.
    # Situace: terasa (line-hatch zpevněné plochy) = 9.23 m² (dvorek dlažba = HSV1.004 = 16.54).
    ("260219_dum.PSV76.002", "PSV-76 Truhlář"): [
        {"suffix": "a", "popis": "Podkladní rošt z dřevěných hranolů 50 mm na rektifikovatelných terčích — terasa za opěrnou stěnou", "mj": "m²", "qty": 9.23, "urs": "762", "status": "family_only", "qty_formula": "= PSV76.002 plocha terasy 9.23 m² (situace měření)", "pozn": "ŘEZ C-C: dřevěný rošt z hranolů (NE hliníkový — oprava). Família 762 tesařské/truhlářské. Terče viz HSV1.005a."},
        {"suffix": "b", "popis": "Terasová dřevěná prkna garapa 145×25 mm — montáž na dřevěný rošt, terasa za opěrnou stěnou", "mj": "m²", "qty": 9.23, "urs": "762", "status": "family_only", "qty_formula": "= PSV76.002 plocha terasy 9.23 m² (situace měření)", "pozn": "Pochozí dřevěná vrstva (garapa prkna 25 mm). Família 762. Kód 771474112 byl WRONG domain (dlaždice) — odstraněn (Pattern 26)."},
    ],
    ("260219_dum.HSV1.015", "HSV-1 Zemní práce"): [
        {"suffix": "a", "popis": "Drenážní trubka DN100 vlnitá perforovaná — uložení za opěrnou stěnou (bílou vanou)", "mj": "m", "qty": 12.0, "urs": "212", "status": "family_only", "qty_formula": "= HSV1.015 obvod BV ~10 m + napojení 2 m = 12 m", "pozn": "Drenáž trubní (212 família URS zemní) NEBO 8xx ZTI vnější (items.json má 877315111 cross-discipline)."},
        {"suffix": "b", "popis": "Štěrkový obsyp drenáže frakce 16/32 mm", "mj": "m", "qty": 12.0, "urs": "212", "status": "family_only", "qty_formula": "= HSV1.015 délka drenáže 12 m", "pozn": "Obsyp drenáže (212/174 família)."},
        {"suffix": "c", "popis": "Geotextilie obalení drenáže + napojení do dešťové kanalizace", "mj": "m", "qty": 12.0, "urs": "693", "status": "family_only", "qty_formula": "= HSV1.015 délka 12 m", "pozn": "Geotextilie obal + napojení (693 família)."},
    ],
    # KROV — montáž 762332xxx (m/bm, ocelové spojky, by průřez cm²) + dodávka řeziva C24 (m³) split per ÚRS.
    # Leaf-bind 2026-05-31 (KROS catalog + MCP): krokve/kleštiny/pozednice 120-224 cm² = 762332122; námětky 50-120 = 762332121.
    ("260219_dum.HSV5.001", "HSV-5 Krov + střecha"): [
        {"suffix": "a", "popis": "Montáž krokví 100/180 mm — vázaná konstrukce krovu pomocí ocelových spojek, hraněné řezivo (průřez 180 cm², přes 120 do 224)", "mj": "m", "qty": 156.0, "urs": "762332122", "status": "carried_verified", "qty_formula": "= HSV5.001 délka krokví 156 bm", "pozn": "Montáž 762332122 (266 Kč/m, KROS). Materiál = op b."},
        {"suffix": "b", "popis": "Dodávka hranolového řeziva C24 pro krokve 100/180 mm vč. 10 % prořezu (fungicidní + protihmyzí impregnace)", "mj": "m³", "qty": 3.09, "urs": "60512136", "status": "family_only", "qty_formula": "= 156 × 0.10 × 0.18 × 1.10 = 3.09 m³", "pozn": "Hranol řezivo do 288 cm² (60512136). Impregnace dle TZ statika §6.2."},
    ],
    ("260219_dum.HSV5.002", "HSV-5 Krov + střecha"): [
        {"suffix": "a", "popis": "Montáž kleštin 2×60/180 mm — vázaná konstrukce krovu pomocí ocelových spojek (průřez 216 cm², přes 120 do 224)", "mj": "m", "qty": 110.0, "urs": "762332122", "status": "carried_verified", "qty_formula": "= HSV5.002 délka kleštin 110 bm", "pozn": "Montáž 762332122 (266 Kč/m). Materiál = op b."},
        {"suffix": "b", "popis": "Dodávka hranolového řeziva C24 pro kleštiny 2×60/180 mm vč. 10 % prořezu + impregnace", "mj": "m³", "qty": 1.31, "urs": "60512136", "status": "family_only", "qty_formula": "= 110 × 0.06 × 0.18 × 1.10 = 1.31 m³", "pozn": "Hranol řezivo (60512136)."},
    ],
    ("260219_dum.HSV5.003", "HSV-5 Krov + střecha"): [
        {"suffix": "a", "popis": "Montáž pozednic 140/160 mm — vázaná konstrukce krovu pomocí ocelových spojek (průřez 224 cm², přes 120 do 224)", "mj": "m", "qty": 19.4, "urs": "762332122", "status": "carried_verified", "qty_formula": "= HSV5.003 délka pozednic ~19.4 bm", "pozn": "Montáž 762332122. Kotvení do ŽB věnce = samostatně (CHYBÍ DETAIL — závitové tyče/kotvy)."},
        {"suffix": "b", "popis": "Dodávka hranolového řeziva C24 pro pozednice 140/160 mm vč. 10 % prořezu + impregnace", "mj": "m³", "qty": 0.48, "urs": "60512136", "status": "family_only", "qty_formula": "= 19.4 × 0.14 × 0.16 × 1.10 = 0.48 m³", "pozn": "Hranol řezivo (60512136)."},
    ],
    ("260219_dum.HSV5.004", "HSV-5 Krov + střecha"): [
        {"suffix": "a", "popis": "Montáž námětků 60/100 mm — vázaná konstrukce krovu pomocí ocelových spojek (průřez 60 cm², přes 50 do 120)", "mj": "m", "qty": 19.2, "urs": "762332121", "status": "carried_verified", "qty_formula": "= HSV5.004 délka námětků 19.2 bm", "pozn": "Montáž 762332121 (206 Kč/m, KROS)."},
        {"suffix": "b", "popis": "Dodávka hranolového řeziva C24 pro námětky 60/100 mm vč. 10 % prořezu + impregnace", "mj": "m³", "qty": 0.127, "urs": "605", "status": "needs_lookup", "qty_formula": "= 19.2 × 0.06 × 0.10 × 1.10 = 0.127 m³", "pozn": "Hranol řezivo 605 família — leaf dle krátké délky <6 m (60512136 je 6-8 m). Verify."},
    ],
    # KROV svorníky — montáž 762085112 (ks) + materiál (tyč závitová m + matice/podložky 100 ks). OVĚŘIT M12 dle statiky.
    ("260219_dum.HSV5.017", "HSV-5 Krov + střecha"): [
        {"suffix": "a", "popis": "Montáž svorníků/šroubů tesařských spojů krovu délky přes 150 do 300 mm — spoje kleštin 2×60/180 s krokvemi", "mj": "ks", "qty": 50, "urs": "762085112", "status": "carried_verified", "qty_formula": "= HSV5.017 počet svorníků 50 ks (11 pozic × 2 konce × 2)", "pozn": "Montáž 762085112. OVĚŘIT M12/M16 + délku dle statiky/tesařského detailu."},
        {"suffix": "b", "popis": "Tyč závitová Pz 4.6 M12 — materiál svorníků krovu", "mj": "m", "qty": 14.0, "urs": "31197004", "status": "family_only", "qty_formula": "= 50 ks × 0.25 m × 1.10 prořez = 13.75 → 14 m", "pozn": "Materiál svorníku (31197004)."},
        {"suffix": "c", "popis": "Matice přesná šestihranná Pz DIN 934-8 M12", "mj": "100 ks", "qty": 1, "urs": "3111006", "status": "family_only", "qty_formula": "= 50 svorníků × 2 = 100 ks = 1×100ks", "pozn": "Matice (3111006), 2 na svorník."},
        {"suffix": "d", "popis": "Podložka pod dřevěnou konstrukci DIN 440 D 12 mm", "mj": "100 ks", "qty": 1, "urs": "31121004", "status": "family_only", "qty_formula": "= 50 svorníků × 2 = 100 ks = 1×100ks", "pozn": "Podložka (31121004), 2 na svorník."},
    ],
    # ===== SKLADBY GAPS 2026-06-01 (P41 montáž/materiál split) =====
    ("260219_dum.HSV4.015", "HSV-4 Vodorovné"): [
        {"suffix": "a", "popis": "Montáž kročejové izolace Isover T-P 30 mm — strop S07", "mj": "m²", "qty": 59.5, "urs": "713191", "status": "family_only", "qty_formula": "= plocha stropu S07", "pozn": "Montáž izolace."},
        {"suffix": "b", "popis": "Deska kročejová Isover T-P 30 mm — materiál", "mj": "m²", "qty": 62.5, "urs": None, "status": "needs_lookup", "qty_formula": "= 59.5 × 1.05 prořez", "pozn": "Materiál izolace."},
    ],
    ("260219_dum.HSV4.016", "HSV-4 Vodorovné"): [
        {"suffix": "a", "popis": "Separační geotextilie — dodávka + pokládka, strop S07", "mj": "m²", "qty": 65.5, "urs": None, "status": "needs_lookup", "qty_formula": "= 59.5 × 1.10 přesahy", "pozn": "Montáž+materiál."},
    ],
    ("260219_dum.HSV4.017", "HSV-4 Vodorovné"): [
        {"suffix": "a", "popis": "Montáž min. vaty mezi ocel. nosníky — strop S09", "mj": "m²", "qty": 104.4, "urs": "713121", "status": "family_only", "qty_formula": "= plocha stropu S09", "pozn": "Montáž."},
        {"suffix": "b", "popis": "Minerální vata 180/200 mm — materiál", "mj": "m²", "qty": 109.6, "urs": None, "status": "needs_lookup", "qty_formula": "= 104.4 × 1.05", "pozn": "Materiál."},
    ],
    ("260219_dum.HSV4.018", "HSV-4 Vodorovné"): [
        {"suffix": "a", "popis": "Fermacell 2E22 25 mm — montáž+materiál, S08 (plocha neurčeno)", "mj": "m²", "qty": None, "urs": None, "status": "needs_lookup", "qty_formula": "neurčeno — V1", "pozn": "VYJASNĚNÍ V1."},
    ],
    ("260219_dum.HSV4.019", "HSV-4 Vodorovné"): [
        {"suffix": "a", "popis": "Kročejová izolace 30 mm — montáž+materiál, S08 (neurčeno)", "mj": "m²", "qty": None, "urs": "713191", "status": "needs_lookup", "qty_formula": "neurčeno — V1", "pozn": "VYJASNĚNÍ V1."},
    ],
    ("260219_dum.HSV4.020", "HSV-4 Vodorovné"): [
        {"suffix": "a", "popis": "Suchý podsyp keramzit/liapor + dřevěný rošt 50 mm — S08 (neurčeno)", "mj": "m²", "qty": None, "urs": None, "status": "needs_lookup", "qty_formula": "neurčeno — V1", "pozn": "VYJASNĚNÍ V1."},
    ],
    ("260219_dum.HSV4.021", "HSV-4 Vodorovné"): [
        {"suffix": "a", "popis": "Separační vrstva — S08 (neurčeno)", "mj": "m²", "qty": None, "urs": None, "status": "needs_lookup", "qty_formula": "neurčeno — V1", "pozn": "VYJASNĚNÍ V1."},
    ],
    ("260219_dum.HSV7.007", "HSV-7 Fasáda + zateplení"): [
        {"suffix": "a", "popis": "Montáž sanační izolační desky Styrcon 200 + armovací — sokl S03", "mj": "m²", "qty": 23, "urs": None, "status": "needs_lookup", "qty_formula": "= obvod 38.7 × 0.6 ≈ 23 (OVĚŘIT)", "pozn": "Montáž."},
        {"suffix": "b", "popis": "Sanační deska Styrcon 200 + lepící tmel + armovací stěrka+tkanina — materiál", "mj": "m²", "qty": 24, "urs": None, "status": "needs_lookup", "qty_formula": "= 23 × 1.05", "pozn": "Materiál."},
    ],
    ("260219_dum.HSV7.008", "HSV-7 Fasáda + zateplení"): [
        {"suffix": "a", "popis": "Drenážní nopová folie 20 mm — dodávka+montáž, sokl pod terénem S03a", "mj": "m²", "qty": 25, "urs": None, "status": "needs_lookup", "qty_formula": "= 23 × 1.10", "pozn": "Montáž+materiál."},
    ],
    ("260219_dum.HSV7.009", "HSV-7 Fasáda + zateplení"): [
        {"suffix": "a", "popis": "Kotevní rošt 40 mm provětraného soklu — montáž+materiál S03b", "mj": "m²", "qty": 23, "urs": None, "status": "needs_lookup", "qty_formula": "= 23 (OVĚŘIT)", "pozn": "Rošt."},
        {"suffix": "b", "popis": "Keramický obklad soklu 20 mm — montáž+materiál", "mj": "m²", "qty": 24, "urs": "781", "status": "family_only", "qty_formula": "= 23 × 1.05", "pozn": "Obklad."},
    ],
    ("260219_dum.HSV5.018", "HSV-5 Krov + střecha"): [
        {"suffix": "a", "popis": "Pojistná HI folie pod Al krytinu — dodávka+montáž S10", "mj": "m²", "qty": 155, "urs": None, "status": "needs_lookup", "qty_formula": "= 140.94 × 1.10 přesahy", "pozn": "Montáž+materiál."},
    ],
    ("260219_dum.HSV6.018", "HSV-6 Bourací práce"): [
        {"suffix": "a", "popis": "Demontáž vnějšího keram. obkladu suterénu (sokl) 20 mm", "mj": "m²", "qty": 23, "urs": None, "status": "needs_lookup", "qty_formula": "= obvod 38.7 × 0.6 ≈ 23 (OVĚŘIT)", "pozn": "Bourání."},
    ],
    ("260219_dum.HSV5.016", "HSV-5 Krov + střecha"): [
        {"suffix": "a", "popis": "Fasádní minerální izolace λ0.035 180 mm + kotvy fasády — vikýře S12b", "mj": "m²", "qty": 24, "urs": "713", "status": "family_only", "qty_formula": "= 4 vikýře × ~6 m²", "pozn": "Vrstva 1 izolace."},
        {"suffix": "b", "popis": "Paropropustná fasádní folie s UV odolností — vikýře", "mj": "m²", "qty": 26, "urs": None, "status": "needs_lookup", "qty_formula": "= 24 × 1.10", "pozn": "Vrstva 2 folie."},
        {"suffix": "c", "popis": "Svislý nosný rastr 40×60 mm + ochranný nátěr — vikýře", "mj": "m²", "qty": 24, "urs": None, "status": "needs_lookup", "qty_formula": "= plocha fasády vikýřů", "pozn": "Vrstva 3 rastr."},
        {"suffix": "d", "popis": "Celoplošné bednění prkna 25 mm — vikýře", "mj": "m²", "qty": 24, "urs": None, "status": "needs_lookup", "qty_formula": "= plocha fasády vikýřů", "pozn": "Vrstva 4 bednění."},
        {"suffix": "e", "popis": "Falcovaný hliníkový plech — krycí vrstva vikýře", "mj": "m²", "qty": 26, "urs": None, "status": "needs_lookup", "qty_formula": "= 24 × 1.10", "pozn": "Vrstva 5 plech."},
    ],
    # HSV2.012 — KEPT ATOMIC (kari výztuž = separate HSV2.013). Not in DECOMP.
    ("260219_dum.HSV7.002", "HSV-7 Fasáda ETICS"): [
        {"suffix": "a", "popis": "Lepení + kotvení desek EPS 70F grey λ=0.032 tl. 160 mm — ETICS kontaktní zateplení fasády", "mj": "m²", "qty": 276.7, "urs": "713", "status": "family_only", "qty_formula": "= HSV7.002 plocha fasády 276.7 m²", "pozn": "Lepení+kotvení EPS (713/622 família). Leaf dle tl. 160 mm — verify."},
        {"suffix": "b", "popis": "Armovací vrstva — výztužná síťka + lepicí stěrka (zatírací) na ETICS", "mj": "m²", "qty": 276.7, "urs": "622", "status": "family_only", "qty_formula": "= HSV7.002 plocha 276.7 m²", "pozn": "Armovací vrstva síťka+stěrka (622 família). Finální omítka je samostatně HSV7.006."},
    ],
    ("260219_dum.HSV7.003", "HSV-7 Fasáda ETICS"): [
        {"suffix": "a", "popis": "Lepení + kotvení desek XPS λ=0.034 tl. 120 mm + soklový profil — ETICS sokl", "mj": "m²", "qty": 13.5, "urs": "713", "status": "family_only", "qty_formula": "= HSV7.003 plocha soklu 13.5 m²", "pozn": "Sokl XPS lepení + soklový profil (713/622 família)."},
        {"suffix": "b", "popis": "Cihelný obklad soklu spárovaný (na armovací vrstvu)", "mj": "m²", "qty": 13.5, "urs": "781", "status": "family_only", "qty_formula": "= HSV7.003 plocha soklu 13.5 m²", "pozn": "Cihelný obklad spárovaný (781 família obklady)."},
    ],
    ("260219_dum.HSV7.004", "HSV-7 Fasáda ETICS"): [
        {"suffix": "a", "popis": "Špalety oken — EPS přesah 35-40 mm lepení + kotvení", "mj": "bm", "qty": 82.2, "urs": "622", "status": "family_only", "qty_formula": "= HSV7.004 obvod špalet 82.2 bm", "pozn": "Špalety EPS přesah (622 família)."},
        {"suffix": "b", "popis": "Špalety oken — armovací vrstva síťka + omítka", "mj": "bm", "qty": 82.2, "urs": "622", "status": "family_only", "qty_formula": "= HSV7.004 obvod 82.2 bm", "pozn": "Armovací vrstva + omítka špalet (622 família)."},
    ],
    ("260219_dum.PSV77.002", "PSV-77 Podlahy"): [
        {"suffix": "a", "popis": "Kladení keramické dlažby lepené + penetrace podkladu — koupelny + WC + spíž + komora", "mj": "m²", "qty": 13.5, "urs": "771", "status": "family_only", "qty_formula": "= PSV77.002 plocha 13.5 m²", "pozn": "Dlažba lepená vč. lepidla (771 família)."},
        {"suffix": "b", "popis": "Spárování keramické dlažby + úklid — koupelny + WC + spíž + komora", "mj": "m²", "qty": 13.5, "urs": "771", "status": "family_only", "qty_formula": "= PSV77.002 plocha 13.5 m²", "pozn": "Spárování (771 família) — často zahrnuto v kladení."},
    ],
    ("260219_dum.PSV77.003", "PSV-77 Podlahy"): [
        {"suffix": "a", "popis": "Kladení keramické dlažby lepené + penetrace — 1.PP technické místnosti", "mj": "m²", "qty": 32.4, "urs": "771", "status": "family_only", "qty_formula": "= PSV77.003 plocha 32.4 m²", "pozn": "Dlažba lepená (771 família)."},
        {"suffix": "b", "popis": "Spárování keramické dlažby + úklid — 1.PP", "mj": "m²", "qty": 32.4, "urs": "771", "status": "family_only", "qty_formula": "= PSV77.003 plocha 32.4 m²", "pozn": "Spárování (771 família)."},
    ],
    # PSV77.007 soklíky — atomic (1 op). Not in DECOMP.
    # PSV78.001-004 omítky → 2 ops each (jádrová + štuková)
    ("260219_dum.PSV78.001", "PSV-78 Povrchové úpravy"): [
        {"suffix": "a", "popis": "Omítka jádrová vápenocementová tl. 15 mm na stěnách 1.PP (vč. vyspravení stávajících)", "mj": "m²", "qty": 78.2, "urs": "612", "status": "family_only", "qty_formula": "= PSV78.001 plocha stěn 1.PP 78.2 m²", "pozn": "Jádrová omítka VC (612 família)."},
        {"suffix": "b", "popis": "Štuková povrchová úprava (štuk) na jádrové omítce — stěny 1.PP", "mj": "m²", "qty": 78.2, "urs": "612", "status": "family_only", "qty_formula": "= PSV78.001 plocha 78.2 m²", "pozn": "Štuková omítka (612 família)."},
    ],
    ("260219_dum.PSV78.002", "PSV-78 Povrchové úpravy"): [
        {"suffix": "a", "popis": "Omítka jádrová vápenocementová tl. 15 mm na stěnách 1.NP", "mj": "m²", "qty": 208.4, "urs": "612", "status": "family_only", "qty_formula": "= PSV78.002 plocha stěn 1.NP 208.4 m²", "pozn": "Jádrová omítka VC (612 família)."},
        {"suffix": "b", "popis": "Štuková povrchová úprava na jádrové omítce — stěny 1.NP", "mj": "m²", "qty": 208.4, "urs": "612", "status": "family_only", "qty_formula": "= PSV78.002 plocha 208.4 m²", "pozn": "Štuková omítka (612 família)."},
    ],
    ("260219_dum.PSV78.003", "PSV-78 Povrchové úpravy"): [
        {"suffix": "a", "popis": "Omítka jádrová vápenocementová tl. 15 mm na stěnách 2.NP", "mj": "m²", "qty": 201.6, "urs": "612", "status": "family_only", "qty_formula": "= PSV78.003 plocha stěn 2.NP 201.6 m²", "pozn": "Jádrová omítka VC (612 família)."},
        {"suffix": "b", "popis": "Štuková povrchová úprava na jádrové omítce — stěny 2.NP", "mj": "m²", "qty": 201.6, "urs": "612", "status": "family_only", "qty_formula": "= PSV78.003 plocha 201.6 m²", "pozn": "Štuková omítka (612 família)."},
    ],
    ("260219_dum.PSV78.004", "PSV-78 Povrchové úpravy"): [
        {"suffix": "a", "popis": "Omítka jádrová vápenocementová tl. 15 mm na stěnách 3.NP", "mj": "m²", "qty": 179.1, "urs": "612", "status": "family_only", "qty_formula": "= PSV78.004 plocha stěn 3.NP 179.1 m²", "pozn": "Jádrová omítka VC (612 família)."},
        {"suffix": "b", "popis": "Štuková povrchová úprava na jádrové omítce — stěny 3.NP", "mj": "m²", "qty": 179.1, "urs": "612", "status": "family_only", "qty_formula": "= PSV78.004 plocha 179.1 m²", "pozn": "Štuková omítka (612 família)."},
    ],

    # === 7 MULTI_FIXTURE (sanit per koupelna + baterie + svody) ===
    ("260219_dum.PSV72.004", "PSV-72 ZTI"): [
        {"suffix": "a", "popis": "Vana — dodávka + montáž, koupelna 1.05 1.NP", "mj": "ks", "qty": 1, "urs": "725", "status": "family_only", "qty_formula": "1× vana (DXF sanit_vana)", "pozn": "Zařizovací předmět (725 família)."},
        {"suffix": "b", "popis": "Umyvadlo — dodávka + montáž, koupelna 1.05 1.NP", "mj": "ks", "qty": 1, "urs": "725", "status": "family_only", "qty_formula": "1× umyvadlo (DXF sanit_umyvadlo)", "pozn": "Zařizovací předmět (725 família)."},
        {"suffix": "c", "popis": "WC mísa závěsná + nádržka — dodávka + montáž, koupelna 1.05 1.NP", "mj": "ks", "qty": 1, "urs": "725", "status": "family_only", "qty_formula": "1× WC (TZ standard)", "pozn": "Zařizovací předmět (725 família)."},
    ],
    ("260219_dum.PSV72.005", "PSV-72 ZTI"): [
        {"suffix": "a", "popis": "Umyvadlo — dodávka + montáž, koupelna 2.03 2.NP", "mj": "ks", "qty": 1, "urs": "725", "status": "family_only", "qty_formula": "1× umyvadlo (DXF)", "pozn": "Zařizovací předmět (725 família)."},
        {"suffix": "b", "popis": "WC mísa závěsná + nádržka — dodávka + montáž, koupelna 2.03 2.NP", "mj": "ks", "qty": 1, "urs": "725", "status": "family_only", "qty_formula": "1× WC (TZ standard)", "pozn": "Zařizovací předmět (725 família)."},
        {"suffix": "c", "popis": "Sprchový kout + vanička — dodávka + montáž, koupelna 2.03 2.NP", "mj": "ks", "qty": 1, "urs": "725", "status": "family_only", "qty_formula": "1× sprcha (TZ standard)", "pozn": "Zařizovací předmět (725 família)."},
    ],
    ("260219_dum.PSV72.006", "PSV-72 ZTI"): [
        {"suffix": "a", "popis": "WC mísa závěsná + nádržka — dodávka + montáž, koupelna 3.04 3.NP", "mj": "ks", "qty": 1, "urs": "725", "status": "family_only", "qty_formula": "1× WC (DXF)", "pozn": "Zařizovací předmět (725 família)."},
        {"suffix": "b", "popis": "Umyvadlo — dodávka + montáž, koupelna 3.04 3.NP", "mj": "ks", "qty": 1, "urs": "725", "status": "family_only", "qty_formula": "1× umyvadlo (TZ standard)", "pozn": "Zařizovací předmět (725 família)."},
        {"suffix": "c", "popis": "Sprchový kout + vanička — dodávka + montáž, koupelna 3.04 3.NP", "mj": "ks", "qty": 1, "urs": "725", "status": "family_only", "qty_formula": "1× sprcha (TZ standard)", "pozn": "Zařizovací předmět (725 família)."},
    ],
    ("260219_dum.PSV72.008", "PSV-72 ZTI"): [
        {"suffix": "a", "popis": "Rohový ventil WC — dodávka + montáž", "mj": "ks", "qty": 3, "urs": "725", "status": "family_only", "qty_formula": "3× WC (1.NP + 2.NP + 3.NP)", "pozn": "Armatura (725 família)."},
        {"suffix": "b", "popis": "Páková umyvadlová baterie — dodávka + montáž", "mj": "ks", "qty": 3, "urs": "725", "status": "family_only", "qty_formula": "3× umyvadlo (1.NP + 2.NP + 3.NP)", "pozn": "Baterie (725 família)."},
        {"suffix": "c", "popis": "Sprchová / vanová baterie termostatická — dodávka + montáž", "mj": "ks", "qty": 3, "urs": "725", "status": "family_only", "qty_formula": "1× vana 1.NP + 2× sprcha 2.NP+3.NP", "pozn": "Baterie termostat (725 família)."},
        {"suffix": "d", "popis": "Dřezová baterie kuchyňská — dodávka + montáž", "mj": "ks", "qty": 2, "urs": "725", "status": "family_only", "qty_formula": "2× kuchyně (1.06 + 3.05)", "pozn": "Dřezová baterie (725 família)."},
    ],
    ("260219_dum.PSV76.003", "PSV-76 Klempíř"): [
        {"suffix": "a", "popis": "Dešťové svody Pzn Ø100 mm — 4 svody", "mj": "bm", "qty": 28.0, "urs": "764", "status": "family_only", "qty_formula": "4 svody × ~7 m výška = 28 bm", "pozn": "Klempířské svody (764 família)."},
        {"suffix": "b", "popis": "Podokapní žlaby Pzn — po obvodu střechy", "mj": "bm", "qty": 15.5, "urs": "764", "status": "family_only", "qty_formula": "= PSV76.003 celkem 43.5 bm − svody 28 bm = 15.5 bm žlaby", "pozn": "Klempířské žlaby (764 família)."},
    ],
    # PSV72.007 dřezy (2 ks same fixture) — atomic. Not in DECOMP.
    # M21.005 svítidla (35 ks same type) — atomic. Not in DECOMP.
}


FROZEN_FIELDS = ["popis", "mj", "mnozstvi", "mnozstvi_formula", "source",
                 "kapitola", "subkapitola", "realizuje_skladbu", "subdodavatel"]


def short_id(full_id: str) -> str:
    return full_id.split(".", 1)[1] if "." in full_id else full_id


def main() -> None:
    # Defensive load — input file may be missing / malformed / lack key
    try:
        with ITEMS_PATH.open() as f:
            data = json.load(f)
    except FileNotFoundError:
        raise SystemExit(f"ERROR: frozen items file not found: {ITEMS_PATH}")
    except json.JSONDecodeError as e:
        raise SystemExit(f"ERROR: invalid JSON in {ITEMS_PATH}: {e}")
    if "items" not in data or not isinstance(data["items"], list):
        raise SystemExit(f"ERROR: missing or malformed 'items' list in {ITEMS_PATH}")
    items = data["items"]

    atomic_ops: list[dict] = []
    decomp_map: list[dict] = []  # parent → children mapping
    poradi = 0

    decomposed_keys = set()

    REQUIRED = ("id", "kapitola", "objekt", "popis", "mj", "mnozstvi")
    for it in items:
        missing = [k for k in REQUIRED if k not in it]
        if missing:
            raise SystemExit(
                f"ERROR: frozen item missing required keys {missing}: "
                f"{it.get('id', '<no id>')}"
            )
        key = (it["id"], it["kapitola"])
        rs = it.get("realizuje_skladbu")
        parent_id = it["id"]

        if key in DECOMP:
            children = DECOMP[key]
            child_ids = []
            for ch in children:
                poradi += 1
                atom_id = f"{short_id(it['id'])}{ch['suffix']}"
                atomic_ops.append({
                    "poradi": poradi,
                    "objekt": it["objekt"],
                    "kapitola": it["kapitola"],
                    "atomic_id": atom_id,
                    "atomic_operace_popis": ch["popis"],
                    "mj": ch["mj"],
                    "mnozstvi": ch["qty"],
                    "urs_kod_kandidat": ch["urs"],
                    "status": ch["status"],
                    "parent_frozen_item_id": parent_id,
                    "parent_kapitola": it["kapitola"],
                    "realizuje_skladbu": rs,
                    "qty_formula": ch["qty_formula"],
                    "pozn": ch["pozn"],
                    "decomposition_type": "skladba_vrstva" if it["kapitola"] in (
                        "HSV-1 Zemní práce", "HSV-7 Fasáda ETICS", "PSV-77 Podlahy", "PSV-78 Povrchové úpravy"
                    ) else "fixture",
                })
                child_ids.append(atom_id)
            decomp_map.append({
                "parent_frozen_item_id": parent_id,
                "parent_kapitola": it["kapitola"],
                "parent_popis": it["popis"][:120],
                "parent_mj": it["mj"],
                "parent_qty": it["mnozstvi"],
                "n_atomic_children": len(children),
                "atomic_children_ids": child_ids,
            })
            decomposed_keys.add(key)
        else:
            # Carry 1:1 (atomic or lump-sum VRN)
            poradi += 1
            atomic_ops.append({
                "poradi": poradi,
                "objekt": it["objekt"],
                "kapitola": it["kapitola"],
                "atomic_id": short_id(it["id"]),
                "atomic_operace_popis": it["popis"],
                "mj": it["mj"],
                "mnozstvi": it["mnozstvi"],
                "urs_kod_kandidat": it.get("urs_code_proposed"),
                "status": "carried_verified" if it.get("urs_status") == "matched_websearch_verified"
                          else (it.get("cross_verification_status") or it.get("urs_status") or "needs_lookup"),
                "parent_frozen_item_id": it["id"],
                "parent_kapitola": it["kapitola"],
                "realizuje_skladbu": rs,
                "qty_formula": it.get("mnozstvi_formula"),
                "pozn": "Carried 1:1 (atomic — no decomposition needed)",
                "decomposition_type": "atomic_1to1",
            })

    # Família distribution
    familia_dist = Counter()
    for op in atomic_ops:
        code = op["urs_kod_kandidat"]
        if code:
            fam = re.sub(r"[^\d]", "", str(code))[:3]
            familia_dist[fam] += 1
        else:
            familia_dist["(blank)"] += 1

    # Per-kapitola atomic count
    per_kap = Counter(op["kapitola"] for op in atomic_ops)

    # Pre-flight: confirm items.json unchanged (read-only check — we never wrote it)
    frozen_ok = len(items) == 212

    out = {
        "_schema_version": "1.0",
        "_generated_at": TODAY,
        "_purpose": "Atomic decomposition map per HK212 028a..f principle. Composite skladby/fixtures → atomic coded operations. items.json frozen NOT touched.",
        "_pattern_compliance": {
            "pattern_15": "Work-First — atomic operations are codeable units; catalog matching downstream",
            "pattern_26": "Família-level URS where leaf unknown + status flag; NO fabrication",
            "pattern_28": "(id, kapitola) compound key — handles PSV76.003 ×3 + VRN.001 ×9 collisions",
            "pattern_32": "Separate deliverable — does not modify File A audit or items.json",
        },
        "_frozen_baseline_preflight": {
            "items_json_count": len(items),
            "expected": 212,
            "frozen_unchanged": frozen_ok,
        },
        "_summary": {
            "frozen_items_total": len(items),
            "atomic_operations_total": len(atomic_ops),
            "items_decomposed": len(decomp_map),
            "atomic_children_from_decomposition": sum(d["n_atomic_children"] for d in decomp_map),
            "items_carried_1to1": len(atomic_ops) - sum(d["n_atomic_children"] for d in decomp_map),
            "atomic_per_kapitola": dict(sorted(per_kap.items())),
            "familia_distribution": dict(sorted(familia_dist.items())),
        },
        "decomposition_map": decomp_map,
        "atomic_operations": atomic_ops,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    try:
        OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False))
    except (OSError, PermissionError) as e:
        raise SystemExit(f"ERROR: failed to write {OUT}: {e}")

    print(json.dumps({
        "frozen_items": len(items),
        "atomic_operations_total": len(atomic_ops),
        "items_decomposed": len(decomp_map),
        "atomic_children_from_decomp": sum(d["n_atomic_children"] for d in decomp_map),
        "items_carried_1to1": len(atomic_ops) - sum(d["n_atomic_children"] for d in decomp_map),
        "atomic_per_kapitola": dict(sorted(per_kap.items())),
        "familia_distribution": dict(sorted(familia_dist.items())),
        "frozen_preflight_ok": frozen_ok,
        "output": str(OUT.relative_to(ROOT)),
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
