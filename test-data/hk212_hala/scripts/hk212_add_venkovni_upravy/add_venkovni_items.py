"""Add SO-13 Venkovní úpravy (M-VK kapitola, 19 items) + 3 ABMV to HK212.

Per investor SOLAR DISPOREC phone call 2026-05-27 — venkovní úpravy in bid:
  - 4 vstupní/nájezdové rampy per A101 půdorys (R1..R4, total ~43 m²)
  - Externí přípojky (KG PVC dešťová DN200 + splašková DN150 + NN)
  - Přeložka vodovodního řadu (PODMÍNĚNÁ → ABMV_23)
  - Hydrant podzemní DN80
  - Retenční nádrž 30 m³ prefab betonová 6.15×2.75×2.0 m (→ ABMV_24)
  - Liniový žlab pojízdný B125+ (DIFFERENT from PSV-78x-005/006 pochozí podél fasády)
  - Zpevněné plochy ~325 m² (parkoviště 10× + manipulace + napojení)
  - Vegetace + finiš (ohumusování, vyspádování)

Source documents (Pattern 36 staging — DPS replaces DSP):
  - inputs/situace/C3_koordinacni_situace_DPS_2026-05.pdf  (NEW, replaces older C3_situace_kaceni for koord scope)
  - inputs/vykresy_pdf/A101_pudorys_1np_DPS_2026-05.pdf    (NEW DPS, supersedes DSP 2025-10 → _superseded/)
  - inputs/vykresy_pdf/A103_rez_AB_DPS_2026-05.pdf         (NEW DPS, supersedes DSP 2025-10 → _superseded/)

Pattern 15 work-first: no auto KROS/URS matching; _kros_hint preserved
for Stage 3 catalog task with Forestina komplet ÚP reference.

Pattern 37 sync ritual applied at session start: git fetch + grep last_number
+ ls-remote claude/* branches — no parallel session on SO-13 scope (this is
the first generation of venkovní úpravy items for HK212).

Cross-deduplication verified against existing 150 items:
  - kácení S.1/S.2: already in HSV-1-020..022 → SKIP
  - náhradní výsadba: HSV-1-024 → SKIP (ohumusování+travou is different)
  - obetonování stáv. sítí: HSV-1-009/010 → SKIP from D
  - MEARIN pochozí fasáda: PSV-78x-005/006 → M-VK liniový žlab explicitly POJÍZDNÝ
  - pomocné výkopy DN150 vodovod + DN200 kanalizace: HSV-1-011/012 → M-VK přípojky
    add only potrubí materiál + montáž + napojení (no double-count of výkop m³)
  - hydrant: VRN-021 = revize only → M-VK adds dodávka + montáž
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ITEMS_PATH = ROOT / "outputs" / "phase_1_etap1" / "items_hk212_etap1.json"
ABMV_PATH = ROOT / "outputs" / "abmv_email_queue.json"

NOW_ISO = "2026-05-27T00:00:00+00:00"

SOURCE_C3 = "inputs/situace/C3_koordinacni_situace_DPS_2026-05.pdf"
SOURCE_A101 = "inputs/vykresy_pdf/A101_pudorys_1np_DPS_2026-05.pdf"
SOURCE_A103 = "inputs/vykresy_pdf/A103_rez_AB_DPS_2026-05.pdf"

PATTERN_15_REF = (
    "Work-first generation. KROS/URS catalog mapping in separate Stage 3 "
    "task with Forestina komplet ÚP reference (sample at "
    "test-data/hk212_hala/inputs/_reference/ if available)."
)

KAPITOLA_DECISION = (
    "M-VK / SO-13 (new — venkovní úpravy in bid per investor phone call "
    "2026-05-27, SOLAR DISPOREC scope expansion)"
)

SCOPE_EXCLUSION_ELEKTRO_NN = [
    "Silové NN zapojení v rozvaděči = elektro profession",
    "Měření spotřeby + revize NN přípojky",
    "Kabel CYKY 4×N samotný (chránička HDPE je v scope SO-13 jako "
    "stavební příprava, samotný kabel + zapojení v elektro VV)",
]


def _refs(*extra_refs: dict) -> list[dict]:
    base: list[dict] = [
        {"type": "document", "code": "C.3 KOO situace", "document": SOURCE_C3,
         "stage": "DPS 06/2026"},
        {"type": "document", "code": "A101 půdorys 1NP", "document": SOURCE_A101,
         "stage": "DPS 06/2026"},
        {"type": "document", "code": "A103 řez A-B", "document": SOURCE_A103,
         "stage": "DPS 06/2026"},
    ]
    base.extend(extra_refs)
    return base


def make_item(
    *,
    item_id: str,
    popis: str,
    mj: str,
    mnozstvi: float,
    raw_description: str,
    qty_formula: str,
    audit_inputs: list[dict],
    audit_formula: str,
    audit_poznamka: str,
    kros_hint: str,
    extra_refs: list[dict] | None = None,
    extra_refs_obj: list[dict] | None = None,
    confidence: float = 0.80,
    scope_exclusion: dict | None = None,
    status_flag: str | None = None,
    vyjasneni_ref: list[str] | None = None,
    cross_dedup_note: str | None = None,
    formula_parsed_method: str = "direct",
) -> dict:
    refs = _refs(*(extra_refs_obj or []))
    audit: dict = {
        "lokalizace": "venkovní úpravy areálu — SO-13",
        "formula": audit_formula,
        "formula_parsed_method": formula_parsed_method,
        "inputs": audit_inputs,
        "reference": refs,
        "poznamka": audit_poznamka,
        "confidence": confidence,
        "extraction_method": "dps_situace_a101_a103",
        "data_source_hint": "C3_DPS+A101_DPS+A103_DPS",
        "extracted_at": NOW_ISO,
        "kapitola_decision": KAPITOLA_DECISION,
        "kros_hint": kros_hint,
    }
    if cross_dedup_note:
        audit["cross_dedup_note"] = cross_dedup_note

    item: dict = {
        "id": item_id,
        "kapitola": "M-VK",
        "SO": "SO-13",
        "popis": popis,
        "mj": mj,
        "mnozstvi": mnozstvi,
        "urs_code": None,
        "urs_alternatives": [],
        "urs_status": "pending_stage_3",
        "urs_match_score": 0.0,
        "skladba_ref": None,
        "source": (
            "C.3 KOORDINAČNÍ SITUACE DPS 06/2026 + A101 půdorys + A103 řez "
            "(investor scope change 2026-05-27)"
        ),
        "raw_description": raw_description,
        "confidence": confidence,
        "subdodavatel_chapter": "venkovni_upravy",
        "_vyjasneni_ref": vyjasneni_ref or [],
        "_status_flag": status_flag,
        "_data_source": "C3_DPS+A101_DPS+A103_DPS",
        "_completeness": 1.0,
        "_qty_formula": qty_formula,
        "_export_wrapper_hint": None,
        "_pattern_15_ref": PATTERN_15_REF,
        "_kros_hint": kros_hint,
        "audit_trail": audit,
    }
    if scope_exclusion:
        item["_scope_exclusion"] = scope_exclusion
    return item


# ----------------------------------------------------------------------
# Geometric primitives derived from A101 půdorys per agent measurement
# ----------------------------------------------------------------------

# Ramp areas measured on A101 (gradient annotations 2.00° / 5.65° + dimensions)
R1_AREA = 4.0 * 2.3        # 9.20  m² — N sectional gate ramp, axis 1, B–C
R2_AREA = 5.0 * 2.3        # 11.50 m² — S sectional gate ramp, axis 6, B–C area
R3_AREA = 4.0 * 2.3        # 9.20  m² — S sectional gate ramp, axis 6, D–E
R4_AREA = 2.2 * 6.1        # 13.42 m² — W pedestrian accessibility ramp, axis 6/A
RAMP_TOTAL_AREA = R1_AREA + R2_AREA + R3_AREA + R4_AREA  # 43.32 m²

RAMP_PERIMETER_OBRUBNIK_M = 30.0  # estimated edge length around all 4 ramps (obrubník)

# Zpevněné plochy per user decision 2 (2026-05-27)
PARK_AREA = 10 * 2.5 * 5.0   # 125 m² — 10 kolmá parkovací stání
MANIP_AREA = 150.0           # 150 m² — manipulační plochy okolo haly
NAPOJ_AREA = 50.0            # 50 m² — komunikační napojení
ASFALT_AREA = PARK_AREA + MANIP_AREA + NAPOJ_AREA  # 325 m²

OBRUBNIK_M = 90.0  # 80-100 bm range midpoint
PARK_STANI_COUNT = 10

# Retenční nádrž per C.3 explicit annotation
RETENCNI_L, RETENCNI_W, RETENCNI_H = 6.15, 2.75, 2.0


def build_items() -> list[dict]:
    items: list[dict] = []

    # ============ A. Rampy (4 items) ============

    items.append(make_item(
        item_id="M-VK-001",
        popis=(
            "Beton C25/30 XF3 — vstupní/nájezdové rampy tl 150 mm, "
            "4 lokality (R1 sever, R2+R3 jih, R4 západ bezbariérová)"
        ),
        mj="m³",
        mnozstvi=round(RAMP_TOTAL_AREA * 0.15, 2),
        raw_description="beton C25/30 XF3 rampy + okapní pas u ramp",
        qty_formula=(
            f"R1+R2+R3+R4 = 9.20+11.50+9.20+13.42 = "
            f"{RAMP_TOTAL_AREA:.2f} m² × 0.15 m = "
            f"{RAMP_TOTAL_AREA*0.15:.2f} m³"
        ),
        formula_parsed_method="product",
        audit_formula=(
            f"({R1_AREA}+{R2_AREA}+{R3_AREA}+{R4_AREA}) × 0.15 = "
            f"{RAMP_TOTAL_AREA*0.15:.2f} m³"
        ),
        audit_inputs=[
            {"label": "R1_sever_4.0×2.3_5.65deg", "value": R1_AREA, "unit": "m²"},
            {"label": "R2_jih_5.0×2.3_5.65deg", "value": R2_AREA, "unit": "m²"},
            {"label": "R3_jih_4.0×2.3_5.65deg", "value": R3_AREA, "unit": "m²"},
            {"label": "R4_zapad_2.2×6.1_2.00deg_bezbarierove",
             "value": R4_AREA, "unit": "m²"},
            {"label": "total_ramp_area", "value": RAMP_TOTAL_AREA, "unit": "m²"},
            {"label": "thickness", "value": 0.15, "unit": "m"},
            {"label": "concrete_volume", "value": round(RAMP_TOTAL_AREA*0.15, 2),
             "unit": "m³"},
        ],
        audit_poznamka=(
            "Beton C25/30 XF3 (zmrazování/rozmrazování s rozmrazovacími prostředky). "
            "Dimenzování per ČSN EN 206 + XF3 expozice. Sklon 5.65° sekční vrata + "
            "2.00° bezbariérová pěší rampa per A101. Okapní pas u ramp included v ploše."
        ),
        kros_hint="565xxx (komunikace pozemní — beton)",
    ))

    items.append(make_item(
        item_id="M-VK-002",
        popis="Výztuž KARI síť Q188 + bednění boční rampy 4 lokality",
        mj="m²",
        mnozstvi=round(RAMP_TOTAL_AREA, 2),
        raw_description="výztuž KARI Q188 + boční bednění rampy",
        qty_formula=f"{RAMP_TOTAL_AREA:.2f} m² (1:1 s plochou ramp)",
        audit_formula=f"4 lokality rampy = {RAMP_TOTAL_AREA:.2f} m²",
        audit_inputs=[
            {"label": "rampa_plocha_total", "value": RAMP_TOTAL_AREA, "unit": "m²"},
            {"label": "kari_typ", "value": "Q188 (6 mm, 150/150)", "unit": ""},
        ],
        audit_poznamka=(
            "KARI Q188 typická síť pro betonové plochy pojezdové. Boční bednění + "
            "dilatační lišty součástí položky."
        ),
        kros_hint="631xxx (výztuž) + 564xxx (bednění)",
    ))

    items.append(make_item(
        item_id="M-VK-003",
        popis="Drcený štěrk ŠD 32/63 podklad rampy + okapní pas tl 200 mm",
        mj="m³",
        mnozstvi=round(RAMP_TOTAL_AREA * 0.20, 2),
        raw_description="podkladní vrstva ŠD 32/63",
        qty_formula=f"{RAMP_TOTAL_AREA:.2f} m² × 0.20 m = {RAMP_TOTAL_AREA*0.20:.2f} m³",
        formula_parsed_method="product",
        audit_formula=f"{RAMP_TOTAL_AREA:.2f} × 0.20 = {RAMP_TOTAL_AREA*0.20:.2f} m³",
        audit_inputs=[
            {"label": "rampa_plocha", "value": RAMP_TOTAL_AREA, "unit": "m²"},
            {"label": "tloustka", "value": 0.20, "unit": "m"},
        ],
        audit_poznamka=(
            "ŠD 32/63 frakce. Hutnění Edef2 ≥ 45 MPa per typ pojezdové plochy."
        ),
        kros_hint="564xxx (komunikace — podkladní vrstvy)",
    ))

    items.append(make_item(
        item_id="M-VK-004",
        popis="Obrubník betonový ABO 100×250×1000 kolem ramp + lůžko z betonu C16/20",
        mj="m",
        mnozstvi=RAMP_PERIMETER_OBRUBNIK_M,
        raw_description="obrubník betonový kolem ramp",
        qty_formula=(
            f"obvod ramp ~{RAMP_PERIMETER_OBRUBNIK_M} bm "
            "(odhad z A101, 4 rampy obvod)"
        ),
        audit_formula=f"~{RAMP_PERIMETER_OBRUBNIK_M} m",
        audit_inputs=[
            {"label": "obrubnik_typ", "value": "ABO 100×250×1000", "unit": ""},
            {"label": "delka_obvodu_ramp", "value": RAMP_PERIMETER_OBRUBNIK_M,
             "unit": "m"},
        ],
        audit_poznamka=(
            "Obrubník stojící ABO 100×250×1000 mm v lůžku z betonu C16/20. "
            "Boční opěra C16/20 na rubové straně. Precizní výměra po C.3 detail "
            "(zatím odhad z A101 plus uniform offset)."
        ),
        kros_hint="916xxx (osazení obrubníku)",
        status_flag="precision_pending_dps_detail",
    ))

    # ============ B. Externí přípojky (4 items) ============

    items.append(make_item(
        item_id="M-VK-005",
        popis=(
            "Přípojka kanalizace dešťové KG PVC SN8 DN200 — potrubí "
            "+ uložení v pískovém loži + zásyp + napojení"
        ),
        mj="m",
        mnozstvi=40.0,
        raw_description="dešťová přípojka KG PVC SN8 DN200",
        qty_formula="~40 m (odhad z C.3 trasy od haly k retenční nádrži/napojení)",
        audit_formula="40 m",
        audit_inputs=[
            {"label": "delka_pripojky", "value": 40.0, "unit": "m"},
            {"label": "potrubi", "value": "KG PVC SN8 DN200", "unit": ""},
            {"label": "ulozeni", "value": "pískové lože tl 100 mm + obsyp tl 300 mm",
             "unit": ""},
        ],
        audit_poznamka=(
            "Trasa od haly přes retenční nádrž k bodu napojení na stávající "
            "dešťovou kanalizaci (per C.3 INŽENÝRSKÉ SÍTĚ_NAVRŽENÉ). "
            "Sklon min 0.5 % per ČSN EN 1610."
        ),
        kros_hint="871xxx (kanalizace — potrubí)",
        cross_dedup_note=(
            "HSV-1-012 pokrývá pomocné výkopy pro novou areálovou kanalizaci "
            "DN200 (m³ výkop labor). Stage 3 verify NO double-count of "
            "výkop m³ — M-VK-005 mnozstvi = délka potrubí + materiál + montáž."
        ),
    ))

    items.append(make_item(
        item_id="M-VK-006",
        popis=(
            "Přípojka kanalizace splaškové KG PVC SN8 DN150 — potrubí "
            "+ uložení + zásyp + napojení"
        ),
        mj="m",
        mnozstvi=30.0,
        raw_description="splašková přípojka KG PVC SN8 DN150",
        qty_formula="~30 m (odhad z C.3, od haly k bodu napojení na areálovou)",
        audit_formula="30 m",
        audit_inputs=[
            {"label": "delka_pripojky", "value": 30.0, "unit": "m"},
            {"label": "potrubi", "value": "KG PVC SN8 DN150", "unit": ""},
        ],
        audit_poznamka=(
            "Per C.3 INŽENÝRSKÉ SÍTĚ_NAVRŽENÉ — Přípojka kanalizace splaškové. "
            "Hala má sociální zázemí dle A101? — pokud bez sociálního zázemí, "
            "M-VK-006 jen pro odvod technologických (filtrace strojů) nebo OFF."
        ),
        kros_hint="871xxx (kanalizace — potrubí)",
        status_flag="precision_pending_internal_zti_layout",
        cross_dedup_note=(
            "HSV-1-012 pomocné výkopy DN200 — výkop pro splaškovou DN150 může "
            "sdílet trench s dešťovou. Stage 3 verify uložení do společné rýhy."
        ),
    ))

    items.append(make_item(
        item_id="M-VK-007",
        popis=(
            "Revizní šachta betonová Ø1000 mm, h ~1.5-2.0 m, vč. poklopu "
            "litinového B125 a vnitřních stupadel"
        ),
        mj="ks",
        mnozstvi=3.0,
        raw_description="revizní šachta Ø1000 + poklop B125 + stupadla",
        qty_formula="3 ks (per C.3 — revizní šachta na zlomu trasy, šachta na DK + DKS)",
        audit_formula="3 ks",
        audit_inputs=[
            {"label": "sachta_typ", "value": "betonová Ø1000 skruž + dno + poklop",
             "unit": ""},
            {"label": "vyska_typicka", "value": "1.5-2.0", "unit": "m"},
            {"label": "poklop_trida", "value": "B125 (pochozí + lehký provoz)",
             "unit": ""},
        ],
        audit_poznamka=(
            "Revizní šachty na trase přípojek (M-VK-005 + M-VK-006) — typicky "
            "na zlomu, max po 50 m, na napojení. Per C.3 značení 'REVIZNÍ ŠACHTA'. "
            "B125 dostačující pokud mimo komunikaci; pokud v parkovišti → upgrade D400."
        ),
        kros_hint="894xxx (šachty + skruže) + 899xxx (poklop)",
        status_flag="precision_pending_load_class",
    ))

    items.append(make_item(
        item_id="M-VK-008",
        popis=(
            "Přípojka NN — chránička HDPE Ø110 mm + pomocné výkopy "
            "+ pískové lože + zásyp + výstražná páska"
        ),
        mj="m",
        mnozstvi=40.0,
        raw_description="NN přípojka — stavební příprava (chránička + výkop)",
        qty_formula="~40 m (od přípojkové skříně PRIS na hraně pozemku → hala)",
        audit_formula="40 m",
        audit_inputs=[
            {"label": "delka_pripojky", "value": 40.0, "unit": "m"},
            {"label": "chranicka", "value": "HDPE Ø110 mm červená", "unit": ""},
            {"label": "hloubka_ulozeni", "value": "0.7-1.0", "unit": "m"},
        ],
        audit_poznamka=(
            "Per C.3 INŽENÝRSKÉ SÍTĚ_NAVRŽENÉ — Přípojka NN od stávající přípojkové "
            "skříně PRIS na hraně pozemku k hale. Pouze STAVEBNÍ PŘÍPRAVA: výkop, "
            "chránička HDPE, pískové lože, zásyp s výstražnou páskou. Silový kabel "
            "+ jištění + zapojení v rozvaděči = elektro profession (viz _scope_exclusion)."
        ),
        kros_hint="460xxx (chránička HDPE) + 132xxx (výkop)",
        scope_exclusion={"elektro_profession": SCOPE_EXCLUSION_ELEKTRO_NN},
    ))

    # ============ C. Voda + požár (2 items) ============

    items.append(make_item(
        item_id="M-VK-009",
        popis=(
            "Přeložka stávajícího vodovodního řadu (rerouting) — kompletní práce "
            "vč. potrubí, výkop, napojení, tlakové zkoušky"
        ),
        mj="kpl",
        mnozstvi=1.0,
        raw_description=(
            "PODMÍNĚNÁ položka — přeložka vodovodního řadu mimo trasu navrhované haly"
        ),
        qty_formula="1 kpl (rozsah TBD per vlastník vodovodu confirmation)",
        formula_parsed_method="paushal",
        audit_formula="1 kpl",
        audit_inputs=[
            {"label": "rozsah", "value": "TBD — confirmation pending", "unit": ""},
            {"label": "odhad_delka", "value": "20-40", "unit": "m"},
            {"label": "potrubi_predpoklad", "value": "litina LT DN150 nebo PE100 DN160",
             "unit": ""},
            {"label": "cena_odhad", "value": "150 000", "unit": "Kč"},
        ],
        audit_poznamka=(
            "Per C.3 INŽENÝRSKÉ SÍTĚ_NAVRŽENÉ — 'PŘELOŽKA VODOVODNÍHO ŘADU'. "
            "PODMÍNĚNÁ položka — viz ABMV_23: pokud vodovod mimo pozemek 1939/1, "
            "přeložku provádí vlastník vodovodu (Hradec Králové vodárny), NE "
            "zhotovitel HK212. Pokud vodovod na pozemku → zhotovitel. Investor "
            "SOLAR DISPOREC + vodárenská společnost musí confirm před zahájením prací."
        ),
        kros_hint="827xxx (vodovod — přeložky) — Stage 3 stanovit po confirmation",
        vyjasneni_ref=["ABMV_23"],
        status_flag="podminena_polozka_pending_vlastnik_confirmation",
        confidence=0.65,
    ))

    items.append(make_item(
        item_id="M-VK-010",
        popis=(
            "Hydrant podzemní DN80 vč. uzávěru, šoupátka, zemní soupravy, "
            "poklopu litinového a napojení na vodovodní řad"
        ),
        mj="ks",
        mnozstvi=1.0,
        raw_description="hydrant podzemní DN80",
        qty_formula="1 ks (per C.3 značení 'HYDRANT (Podz.)')",
        audit_formula="1 ks",
        audit_inputs=[
            {"label": "typ", "value": "podzemní hydrant DN80 + uzávěr + soupravy",
             "unit": ""},
            {"label": "umisteni", "value": "per C.3 — PBŘ požadavek", "unit": ""},
        ],
        audit_poznamka=(
            "Per C.3 — hydrant podzemní pro PBŘ. Vyhláška 23/2008 Sb. + ČSN 73 0873. "
            "Komplet vč. napojení šoupátkem na areálový vodovod, zemní souprava, "
            "litinový poklop H. Funkční zkouška součástí montáže."
        ),
        kros_hint="892xxx (armatury vodovodní — hydrant)",
    ))

    # ============ D. Hospodaření s deštěm (2 items — obetonování DROPPED, in HSV-1) ============

    items.append(make_item(
        item_id="M-VK-011",
        popis=(
            f"Retenční nádrž 30 m³ — prefabrikovaná betonová, "
            f"rozměry {RETENCNI_L}×{RETENCNI_W}×{RETENCNI_H} m, vč. usazení do "
            "připraveného výkopu a napojení na dešťovou kanalizaci"
        ),
        mj="ks",
        mnozstvi=1.0,
        raw_description="retenční nádrž 30 m³ prefab beton",
        qty_formula=(
            f"1 ks (per C.3 explicit: 'RETENČNÍ NÁDRŽ 30m³ — "
            f"{RETENCNI_L}×{RETENCNI_W}×{RETENCNI_H}M')"
        ),
        audit_formula="1 ks prefab",
        audit_inputs=[
            {"label": "objem_uzitny", "value": 30.0, "unit": "m³"},
            {"label": "rozmery_LxWxH", "value": f"{RETENCNI_L}×{RETENCNI_W}×{RETENCNI_H}",
             "unit": "m"},
            {"label": "rozmery_overeno_C3", "value": "ano — explicitní text C.3", "unit": ""},
            {"label": "typ", "value": "prefabrikovaná betonová (default)", "unit": ""},
        ],
        audit_poznamka=(
            f"Per C.3 explicitní text 'RETENČNÍ NÁDRŽ 30m³ — "
            f"{RETENCNI_L}x{RETENCNI_W}x{RETENCNI_H}M'. PREFAB betonová default "
            "(per user decision 2026-05-27). Pokud statika Volka explicitně "
            "potřebuje monolitní variantu, confirm před objednávkou — viz ABMV_24. "
            "V scope: usazení do připraveného výkopu, napojení na M-VK-005 dešťovou "
            "přípojku, přepad/odvod do retence. Výkop pro nádrž součástí HSV-1 (kontrola)."
        ),
        kros_hint="425xxx (nádrže) — stanovit po confirmation typu",
        vyjasneni_ref=["ABMV_24"],
        confidence=0.85,
    ))

    items.append(make_item(
        item_id="M-VK-012",
        popis=(
            "Liniový žlab POJÍZDNÝ tř. zatížení B125 — odvodnění zpevněných ploch "
            "parkoviště + manipulace, vč. mřížky"
        ),
        mj="m",
        mnozstvi=40.0,
        raw_description="liniový žlab pojízdný B125 pro venkovní plochy",
        qty_formula="~40 m (perimetr asfaltových ploch SVĚTLO odlišný od PSV-78x)",
        audit_formula="40 m",
        audit_inputs=[
            {"label": "delka", "value": 40.0, "unit": "m"},
            {"label": "trida_zatizeni", "value": "B125 (pojízdné, osobní automobily)",
             "unit": ""},
            {"label": "typ_predpoklad", "value": "betonový žlab NW150-200 + mřížka B125",
             "unit": ""},
        ],
        audit_poznamka=(
            "POJÍZDNÝ liniový žlab pro odvod vody ze zpevněných asfaltových ploch "
            "(parkoviště + manipulační plochy). Tř. zatížení B125 (osobní automobily) "
            "ne pochozí. Stage 3 verify finální typ + délka."
        ),
        kros_hint="935xxx (odvodňovací žlaby + mřížky)",
        cross_dedup_note=(
            "EXPLICITNĚ ODLIŠENO od PSV-78x-005 (MEA Mearin Plus 3000 NW300 podél "
            "JZ + SZ fasády HALY) + PSV-78x-006 (Mřížka pochozí). M-VK-012 je "
            "POJÍZDNÝ žlab v jiné lokaci (perimetr venkovních asfaltů), "
            "jiné load class (B125 ne pochozí). NO geometric overlap with PSV-78x."
        ),
    ))

    # ============ E. Zpevněné plochy + parkoviště (5 items) ============

    items.append(make_item(
        item_id="M-VK-013",
        popis="Drcené kamenivo ŠD 32/63 podklad zpevněných ploch tl 200 mm",
        mj="m³",
        mnozstvi=round(ASFALT_AREA * 0.20, 1),
        raw_description="podkladní vrstva ŠD 32/63 pod asfalt",
        qty_formula=(
            f"{ASFALT_AREA} m² × 0.20 m = {ASFALT_AREA*0.20:.1f} m³ "
            f"(parkoviště {PARK_AREA} + manipulace {MANIP_AREA} + napojení {NAPOJ_AREA})"
        ),
        formula_parsed_method="product",
        audit_formula=f"{ASFALT_AREA} × 0.20 = {ASFALT_AREA*0.20:.1f} m³",
        audit_inputs=[
            {"label": "parkovani_kolma_10x_2.5x5.0", "value": PARK_AREA, "unit": "m²"},
            {"label": "manipulacni_plochy", "value": MANIP_AREA, "unit": "m²"},
            {"label": "komunikacni_napojeni", "value": NAPOJ_AREA, "unit": "m²"},
            {"label": "asfalt_plocha_total", "value": ASFALT_AREA, "unit": "m²"},
            {"label": "podklad_tloustka", "value": 0.20, "unit": "m"},
        ],
        audit_poznamka=(
            "Per user decision 2026-05-27 — full venkovní scope. ŠD 32/63 hutněná "
            "Edef2 ≥ 60 MPa pro pojezdové plochy. Geotextilie separační pod ŠD "
            "(součást plochy)."
        ),
        kros_hint="564xxx (komunikace — podkladní vrstvy)",
    ))

    items.append(make_item(
        item_id="M-VK-014",
        popis="Asfaltový beton ACO 11+ tl 50 mm obrusná vrstva — parkoviště + manipulace",
        mj="m²",
        mnozstvi=ASFALT_AREA,
        raw_description="asfalt ACO 11+ obrusná vrstva",
        qty_formula=(
            f"parkovani {PARK_AREA} + manipulace {MANIP_AREA} + napojeni {NAPOJ_AREA} "
            f"= {ASFALT_AREA} m²"
        ),
        audit_formula=f"{PARK_AREA}+{MANIP_AREA}+{NAPOJ_AREA} = {ASFALT_AREA} m²",
        audit_inputs=[
            {"label": "parkovani_kolma", "value": PARK_AREA, "unit": "m²",
             "rozpis": "10 stání × 2.5×5.0 m"},
            {"label": "manipulacni", "value": MANIP_AREA, "unit": "m²"},
            {"label": "komunikacni_napojeni", "value": NAPOJ_AREA, "unit": "m²"},
            {"label": "tloustka", "value": 0.05, "unit": "m"},
            {"label": "smes", "value": "ACO 11+ (asfaltobeton obrusný, frakce 11 mm)",
             "unit": ""},
        ],
        audit_poznamka=(
            "Obrusná vrstva pro osobní + lehký nákladní provoz. Spojovací postřik "
            "0.50 kg/m² na podkladní vrstvě, ACO 11+ tl 50 mm hutněný. Pokud nebude "
            "podkladní AC vrstva → posoudit ACP 16 jako mezilehlá; zatím pouze 1× obrusná."
        ),
        kros_hint="577xxx (asfaltové vrstvy obrusné)",
        status_flag="acp_underlayer_pending_dpr_detail",
    ))

    items.append(make_item(
        item_id="M-VK-015",
        popis="Obrubník betonový silniční ABO 100×250×1000 mm + lůžko z betonu C16/20",
        mj="m",
        mnozstvi=OBRUBNIK_M,
        raw_description="obrubník silniční kolem zpevněných ploch",
        qty_formula=f"~{OBRUBNIK_M} bm (rozpis user 80-100 bm midpoint)",
        audit_formula=f"~{OBRUBNIK_M} m",
        audit_inputs=[
            {"label": "obrubnik", "value": "ABO 100×250×1000 mm", "unit": ""},
            {"label": "delka_total", "value": OBRUBNIK_M, "unit": "m"},
            {"label": "luzko", "value": "beton C16/20 + boční opěra", "unit": ""},
        ],
        audit_poznamka=(
            "Obrubník silniční na hraně parkoviště + manipulačních ploch. Boční "
            "opěra C16/20 na rubové straně. Stage 3 precision per C.3 detail "
            "(geo-měření po vytýčení)."
        ),
        kros_hint="916xxx (osazení obrubníku)",
    ))

    items.append(make_item(
        item_id="M-VK-016",
        popis=(
            "Vodorovné značení parkovacích stání — symbol P + krajní čáry, "
            "barva bílá nestripovaná retroflexní"
        ),
        mj="ks",
        mnozstvi=PARK_STANI_COUNT,
        raw_description="vodorovné značení 10× parkovací stání",
        qty_formula=f"{PARK_STANI_COUNT} ks (10 kolmá stání)",
        audit_formula=f"{PARK_STANI_COUNT} ks",
        audit_inputs=[
            {"label": "pocet_stani", "value": PARK_STANI_COUNT, "unit": "ks"},
            {"label": "rozmer_stani", "value": "2.5 × 5.0", "unit": "m"},
            {"label": "uprava", "value": "kolmá", "unit": ""},
            {"label": "barva", "value": "bílá strojně stříkaná retroflexní", "unit": ""},
        ],
        audit_poznamka=(
            "Per user decision 2026-05-27 — 10 kolmá parkovací stání. Značení per "
            "TP 65 + ČSN 73 6056. P4 symbol modré (= veřejné parkování) jen pokud "
            "potřeba; pro investorský areál typicky bez P4 (jen krajní čáry + číslo)."
        ),
        kros_hint="91611xxx (vodorovné značení)",
    ))

    items.append(make_item(
        item_id="M-VK-017",
        popis=(
            "Komunikační napojení na stávající vozovku — vč. úpravy navazujícího "
            "pásu asfaltu, frézování styčné spáry, zalévací zálivka"
        ),
        mj="m²",
        mnozstvi=NAPOJ_AREA,
        raw_description="komunikační napojení na stáv. asfalt",
        qty_formula=f"{NAPOJ_AREA} m² (napojovací plocha per user decision)",
        audit_formula=f"{NAPOJ_AREA} m²",
        audit_inputs=[
            {"label": "plocha_napojeni", "value": NAPOJ_AREA, "unit": "m²"},
            {"label": "obsazeno", "value": "frézování spáry + zálivka + sjezd", "unit": ""},
        ],
        audit_poznamka=(
            "Připojení nové asfaltové plochy na stávající vozovku (per C.3 — "
            "STÁVAJÍCÍ VOZOVKA-ASFALT). Frézování po obvodu spáry, asfaltová "
            "zálivka, případně sjezd s obrubníkem snížení."
        ),
        kros_hint="565xxx (napojení komunikací)",
    ))

    # ============ F. Vegetace + finiš (2 items) ============

    items.append(make_item(
        item_id="M-VK-018",
        popis=(
            "Ohumusování tl 100 mm + osetí trávou parkové směsi — "
            "rekultivace zbytkových ploch okolo haly"
        ),
        mj="m²",
        mnozstvi=500.0,
        raw_description="ohumusování + osetí travou — rekultivace",
        qty_formula="~500 m² (odhad zbytkové plochy pozemku 1939/1 mimo halu+asfalt)",
        audit_formula="500 m²",
        audit_inputs=[
            {"label": "plocha_rekultivace", "value": 500.0, "unit": "m²"},
            {"label": "ornice_tloustka", "value": 0.10, "unit": "m"},
            {"label": "travni_smes", "value": "parková (suchovzdorná)", "unit": ""},
        ],
        audit_poznamka=(
            "Rekultivace zbytkových ploch pozemku 1939/1 po dokončení stavby. "
            "Ornice + travní semeno + ošetření po vzejití."
        ),
        kros_hint="181xxx (terénní úpravy + osetí)",
        cross_dedup_note=(
            "DIFFERENT from HSV-1-024 (Náhradní výsadba DŘEVIN — replacement trees). "
            "M-VK-018 = travní porost na zbytkových plochách. NO overlap."
        ),
    ))

    items.append(make_item(
        item_id="M-VK-019",
        popis=(
            "Vyspádování okolního terénu k odvodňovacím prvkům (žlabům, retenční "
            "nádrži) — hutněná zemina, finální úprava"
        ),
        mj="m²",
        mnozstvi=300.0,
        raw_description="vyspádování okolního terénu",
        qty_formula="~300 m² (perimeter haly + okolo retenční nádrže)",
        audit_formula="300 m²",
        audit_inputs=[
            {"label": "plocha_spadovani", "value": 300.0, "unit": "m²"},
            {"label": "min_sklon", "value": "2 %", "unit": ""},
            {"label": "smer", "value": "od haly k retenční nádrži + žlabům", "unit": ""},
        ],
        audit_poznamka=(
            "Min sklon 2 % od haly. Finální urovnání s hutněním podloží. Cíl: "
            "žádná stagnující voda u základů, voda vedena do M-VK-012 žlabů a "
            "M-VK-005 dešťové přípojky."
        ),
        kros_hint="171xxx (zemní práce — finální úpravy)",
    ))

    return items


# ----------------------------------------------------------------------
# ABMV — 3 new items
# ----------------------------------------------------------------------

def build_abmv() -> list[dict]:
    return [
        {
            "id": "ABMV_23",
            "category": "design_clarification",
            "severity": "high",
            "status": "open",
            "title": "Přeložka vodovodního řadu — vlastník confirmation pending",
            "summary_cs": (
                "C.3 koordinační situace DPS 06/2026 zakreslena 'PŘELOŽKA VODOVODNÍHO "
                "ŘADU' jako navržená inženýrská síť. Pokud stávající řad mimo pozemek "
                "1939/1 → přeložku provádí vlastník vodovodu (Hradec Králové "
                "vodárny), NE zhotovitel. Pokud na pozemku → zhotovitel HK212."
            ),
            "blocks_vv": ["M-VK-009 mnozstvi + cena finalize"],
            "addressee": ["SOLAR DISPOREC", "Hradec Králové vodárny (provozovatel)"],
            "items_affected": ["M-VK-009"],
            "resolution_required_before": "zahájení prací M-VK-009",
            "created_at": NOW_ISO,
        },
        {
            "id": "ABMV_24",
            "category": "design_clarification",
            "severity": "medium",
            "status": "open",
            "title": "Retenční nádrž 30 m³ typ — prefab default, monolit pending",
            "summary_cs": (
                "M-VK-011 default = prefabrikovaná betonová nádrž 6.15×2.75×2.0 m "
                "per user decision 2026-05-27. Pokud projektant statika (Volka) "
                "explicitně potřebuje MONOLITNÍ variantu (důvod: zatížení, "
                "geologie, prostorové omezení), confirm PŘED objednávkou prefab. "
                "Cenový dopad: monolit ~+40 % vs prefab."
            ),
            "blocks_vv": ["M-VK-011 objednávka prefab"],
            "addressee": ["projektant statika (Volka)", "SOLAR DISPOREC"],
            "items_affected": ["M-VK-011"],
            "resolution_required_before": "objednávka prefab",
            "created_at": NOW_ISO,
        },
        {
            "id": "ABMV_25",
            "category": "scope_clarification",
            "severity": "low",
            "status": "open",
            "title": "Venkovní VZT jednotka s rekuperací — VZT profession scope",
            "summary_cs": (
                "C.3 koordinační situace zakresluje 'VENKOVNÍ VZT JEDNOTKA S "
                "REKUPERACÍ' na východní straně haly. NE zahrnuto v SO-13 — "
                "spadá do VZT profession (Viktoria Yasinovska samostatný rozpočet, "
                "originally Stage D scope-cut as VZT-001..015). Tento ABMV je "
                "cross-reference záznam, NE blocker."
            ),
            "blocks_vv": [],
            "addressee": ["Viktoria Yasinovska (VZT zpracovatel)"],
            "items_affected": [],
            "scope_owner": "VZT_profession",
            "cross_reference": "C.3 značení 'VENKOVNÍ VZT JEDNOTKA S REKUPERA[CÍ]'",
            "created_at": NOW_ISO,
        },
    ]


def main() -> None:
    raw = json.loads(ITEMS_PATH.read_text(encoding="utf-8"))
    existing_ids = {it["id"] for it in raw["items"]}
    new_items = build_items()

    for it in new_items:
        if it["id"] in existing_ids:
            raise SystemExit(f"FATAL: id collision {it['id']!r}")

    prev_count = len(raw["items"])
    raw["items"].extend(new_items)
    new_count = len(raw["items"])
    expected = prev_count + 19
    if new_count != expected:
        raise SystemExit(f"FATAL: expected {expected}, got {new_count}")

    raw["metadata"].setdefault("revisions", []).append({
        "date": "2026-05-27",
        "change": (
            "Added SO-13 Venkovní úpravy (19 items M-VK-001..019) per investor "
            "scope change — full external infrastructure scope"
        ),
        "reason": (
            "SOLAR DISPOREC phone call 2026-05-27 — venkovní úpravy in bid: "
            "4 rampy per A101, externí přípojky, přeložka vodovodu (podmíněná), "
            "hydrant, retenční nádrž 30 m³ prefab, liniový žlab pojízdný, "
            "zpevněné plochy 325 m² (10× parkování + manipulace + napojení), "
            "ohumusování + vyspádování"
        ),
        "previous_count": prev_count,
        "new_count": new_count,
        "new_kapitola": "M-VK / SO-13",
        "new_abmv": ["ABMV_23", "ABMV_24", "ABMV_25"],
        "source_documents": [
            SOURCE_C3 + " (DPS 06/2026 — NEW, replaces older C3_situace_kaceni for koord scope)",
            SOURCE_A101 + " (DPS 06/2026 — NEW, supersedes DSP 2025-10 in _superseded/)",
            SOURCE_A103 + " (DPS 06/2026 — NEW, supersedes DSP 2025-10 in _superseded/)",
        ],
        "items_added": [it["id"] for it in new_items],
        "items_modified": [],
        "items_removed": [],
        "pattern_15_ref": PATTERN_15_REF,
        "pattern_36_staging": (
            "Old DSP 2025-10 versions of A101 + A103 moved to "
            "inputs/vykresy_pdf/_superseded/2026-05-27_DSP/ per Pattern 36 "
            "file staging convention. New DPS 06/2026 versions canonical."
        ),
        "pattern_37_sync_ritual": (
            "git fetch + grep last_number + ls-remote claude/* executed at "
            "session start — no parallel session on SO-13 scope detected."
        ),
        "cross_deduplication": {
            "kaceni_S1_S2": "covered by HSV-1-020..022 — NOT duplicated",
            "nahradni_vysadba_dreviny": (
                "covered by HSV-1-024 — DIFFERENT from M-VK-018 ohumusování+travou"
            ),
            "obetonovani_stav_siti": (
                "covered by HSV-1-009/010 — DROPPED from SO-13 (originally planned in D)"
            ),
            "mearin_pochozi_fasada": (
                "PSV-78x-005/006 podél JZ+SZ fasády POCHOZÍ — explicitly differentiated "
                "from M-VK-012 POJÍZDNÝ B125+ pro venkovní asfalty"
            ),
            "pomocne_vykopy_pripojek": (
                "HSV-1-011 vodovod DN150 + HSV-1-012 kanalizace DN200 cover labor only; "
                "M-VK-005/006/008 add potrubí materiál + montáž + napojení (no double-count)"
            ),
            "hydrant": "VRN-021 = revize only — M-VK-010 adds dodávka+montáž",
        },
    })

    ITEMS_PATH.write_text(
        json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"items.json: {prev_count} → {new_count} items written")
    print(f"  M-VK kapitola: 19 items (M-VK-001..019)")

    abmv = json.loads(ABMV_PATH.read_text(encoding="utf-8"))
    new_abmv = build_abmv()
    existing_abmv_ids = {it["id"] for it in abmv["items"]}
    for a in new_abmv:
        if a["id"] in existing_abmv_ids:
            raise SystemExit(f"FATAL: ABMV id collision {a['id']!r}")
    abmv["items"].extend(new_abmv)
    ABMV_PATH.write_text(
        json.dumps(abmv, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"abmv_email_queue.json: +3 ABMV (ABMV_23, _24, _25)")


if __name__ == "__main__":
    main()
