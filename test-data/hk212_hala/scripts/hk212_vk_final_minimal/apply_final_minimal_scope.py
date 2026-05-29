"""HK212 venkovní úpravy FINAL minimal scope per user decision 2026-05-27.

Per user explicit decision after pre-mutation audit revealed TZ ARS B p09 + p21
material conflict with task §1.3 Variant A asphalt assumption:

  KEEP (14 M-VK items, unchanged):
    - 4 rampy per A101 (M-VK-001..004) — user "4 рампы" decision, NE řez-detail scope-down
    - Externí přípojky (M-VK-005..008) — kanalizace + NN
    - Přeložka vodovodu (M-VK-009) — podmíněná, ABMV_23 still open
    - Hydrant (M-VK-010)
    - Retenční nádrž (M-VK-011) — ABMV_24 still open
    - Liniový žlab (M-VK-012) — 40 m SZ+JZ unchanged
    - Vegetace (M-VK-018 ohumusování + M-VK-019 vyspádování)

  DROP (5 items, _status_flag preserved per Pattern 14 — NE deleted):
    - M-VK-013 ŠD zpevněných ploch
    - M-VK-014 Asfalt ACO 11+
    - M-VK-015 Obrubník silniční (zpevněných ploch — NE rampy obrubník)
    - M-VK-016 Vodorovné značení parkování
    - M-VK-017 Komunikační napojení

  ADD (4 new okapní chodník):
    - M-VK-020 Beton C25/30 XF3 okapní chodník — 11.20 m³
    - M-VK-021 KARI Q188 + boční bednění — 56.00 m²
    - M-VK-022 ŠD 32/63 podklad — 8.40 m³
    - M-VK-023 Dilatační lišty — 20 m

  ABMV (5 resolved as paper trail + 1 new open):
    - ABMV_26..30 resolved_per_user_decision_2026-05-27
    - ABMV_31 open — Material okapního chodníku verification

User decision basis (verbatim quote from task §2.6):
  "Documentation conflicts TZ ARS B p09 (dlažba 1.5 m) vs řezy A103 (beton
   0.7 m sokl) vs C.3 (silent material). User decision: minimal scope —
   beton okapní chodník (per řezy) + 4 rampy (per A101) + liniový žlab
   (existing). Drop asfalt 489 m² (TZ p21 contradicts). Drop dlažba 143 m²
   (user override TZ — operative choice). Drop parkoviště (TZ p21).
   Drop manipulační drátkobeton (assumption out). Keep all 4 rampy per
   A101 (user override prior řez-detail scope down)."
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ITEMS_PATH = ROOT / "outputs" / "phase_1_etap1" / "items_hk212_etap1.json"
ABMV_PATH = ROOT / "outputs" / "abmv_email_queue.json"

NOW_ISO = "2026-05-27T20:30:00+00:00"
USER_DECISION_DATE = "2026-05-27"

# IDs to drop (set status flag, preserve in audit_trail per Pattern 14)
DROP_IDS = {
    "M-VK-013": "ŠD zpevněných ploch — asfalt scope drop",
    "M-VK-014": "Asfalt ACO 11+ — TZ ARS B p21 zachovat SZ existing 6.87 m",
    "M-VK-015": "Obrubník silniční zpevněných ploch — drop spolu s asfaltem",
    "M-VK-016": "Vodorovné značení parkování — TZ ARS B p21 bez nárůstu OA",
    "M-VK-017": "Komunikační napojení — drop, napojuje se na DROPped asfalt",
}

PATTERN_15_REF = (
    "Work-first generation. KROS catalog mapping in separate Stage 3 task."
)


def make_okapni_item(
    *,
    item_id: str,
    popis: str,
    mj: str,
    mnozstvi: float,
    raw_description: str,
    qty_formula: str,
    audit_formula: str,
    audit_inputs: list[dict],
    audit_poznamka: str,
    kros_hint: str,
    formula_parsed_method: str = "product",
) -> dict:
    refs = [
        {
            "type": "document",
            "code": "A103 řezy A-B detail",
            "document": "inputs/vykresy_pdf/A103_rez_AB_DPS_2026-05.pdf",
            "stage": "DPS 06/2026",
            "evidence": "Hatched concrete 0.7 m × 0.18-0.20 m perimeter element visible in řezy detail screenshots 2026-05-27",
        },
        {
            "type": "document",
            "code": "A101 půdorys 1NP",
            "document": "inputs/vykresy_pdf/A101_pudorys_1np_DPS_2026-05.pdf",
            "stage": "DPS 06/2026",
            "evidence": "Perimeter dimensions: west 28.868 + east 29.515 + sever 10.192 + jih 11.074 = 79.65 m (po odečtu 4 vstupů)",
        },
        {
            "type": "document",
            "code": "C.3 KOO situace",
            "document": "inputs/situace/C3_koordinacni_situace_DPS_2026-05.pdf",
            "stage": "DPS 06/2026",
            "evidence": "Legenda silent na material navrženého perimeter elementu — pouze EXISTING asfalt SZ komunikace marked",
        },
        {
            "type": "user_measurement",
            "code": "Read interaktivního CAD viewer 2026-05-27",
            "document": "session record 2026-05-27 řez detail screenshots",
        },
    ]
    audit: dict = {
        "lokalizace": "venkovní úpravy areálu — perimetr haly (mimo 4 vstupy) · SO-13",
        "formula": audit_formula,
        "formula_parsed_method": formula_parsed_method,
        "inputs": audit_inputs,
        "reference": refs,
        "poznamka": audit_poznamka,
        "confidence": 0.80,
        "extraction_method": "user_measurement_riez_detail + ČSN_73_0210_standard_practice",
        "data_source_hint": "A103_riez_detail + A101_obvod_měření + ČSN_standard",
        "extracted_at": NOW_ISO,
        "kapitola_decision": (
            "M-VK okapní chodník (final scope per user decision "
            f"{USER_DECISION_DATE} — minimal scope per documentation conflicts)"
        ),
        "kros_hint": kros_hint,
        "scope_basis": (
            f"User decision {USER_DECISION_DATE}: minimal scope — beton okapní "
            "chodník (per řezy graphical authority) + 4 rampy (per A101 graphical "
            "authority) + liniový žlab (existing). TZ ARS B p09 dlažba 1.5 m spec "
            "explicitly overridden per user choice."
        ),
    }
    return {
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
            "Řezy A103 detail screenshots 2026-05-27 + user měření obvodu A101 "
            f"+ user decision {USER_DECISION_DATE} (minimal scope override)"
        ),
        "raw_description": raw_description,
        "confidence": 0.80,
        "subdodavatel_chapter": "venkovni_upravy",
        "_vyjasneni_ref": ["ABMV_31"],
        "_status_flag": None,
        "_data_source": "A103_riez_detail+A101_měření+ČSN_73_0210",
        "_completeness": 1.0,
        "_qty_formula": qty_formula,
        "_export_wrapper_hint": None,
        "_pattern_15_ref": PATTERN_15_REF,
        "_kros_hint": kros_hint,
        "_scope_basis": (
            "User decision 2026-05-27 minimal scope — beton okapní chodník per řezy "
            "graphical authority. Material verification pending — viz ABMV_31."
        ),
        "audit_trail": audit,
    }


def build_okapni_items() -> list[dict]:
    items: list[dict] = []
    OBVOD = 80.0   # rounded from 79.65 measured
    SIRE  = 0.7
    TLOUSTKA_BETON = 0.20
    TLOUSTKA_PODKLAD = 0.15

    items.append(make_okapni_item(
        item_id="M-VK-020",
        popis=(
            "Beton C25/30 XF3 — okapní chodník po obvodu haly (sokl 0.7 m × "
            "~80 m mimo 4 vstupy), tl 200 mm"
        ),
        mj="m³",
        mnozstvi=11.20,
        raw_description="beton okapní chodník perimetr haly",
        qty_formula=f"{OBVOD} m × {SIRE} m × {TLOUSTKA_BETON} m = 11.20 m³",
        audit_formula=f"{OBVOD} × {SIRE} × {TLOUSTKA_BETON} = 11.20 m³",
        audit_inputs=[
            {"label": "obvod_mimo_vstupy", "value": OBVOD, "unit": "m",
             "rozpis": "79.65 měřeno A101 → 80.0 rounded (sever 10.19 + jih 11.07 + záp 28.87 + vých 29.52 mínus 4 vstupy 12.20 = 79.65)"},
            {"label": "sire_chodniku", "value": SIRE, "unit": "m",
             "rozpis": "0.7 m per řezy A103 detail screenshots 2026-05-27"},
            {"label": "tloustka_betonu", "value": TLOUSTKA_BETON, "unit": "m",
             "rozpis": "0.183-0.197 m measured z řezů → 0.20 m round-up"},
            {"label": "objem_betonu", "value": 11.20, "unit": "m³"},
            {"label": "expozice", "value": "XF3", "unit": "",
             "rozpis": "Zmrazování/rozmrazování bez chemikálií (hala ne přiléhá veřejné solící komunikaci)"},
        ],
        audit_poznamka=(
            "Beton C25/30 XF3 okapní chodník (sokl) po obvodu haly — drip apron "
            "pro odvod vody od fasády + ochrana paty stěny. Šířka 0.7 m, výška "
            "0.18-0.20 m, sklon 1-2% od fasády. Dilatační spáry à ~4 m. "
            "Per ČSN 73 0210 + ČSN EN 13670 pro venkovní betonové plochy. "
            "TZ ARS B p09 spec 'chodník pro pěší ze zámkové dlažby 1.5 m' "
            "explicitly OVERRIDDEN per user decision 2026-05-27 — material "
            "interpretation per A103 řezy detail (beton hatching) + minimal "
            "scope basis."
        ),
        kros_hint="565xxx (komunikace pozemní — beton venkovní)",
    ))

    items.append(make_okapni_item(
        item_id="M-VK-021",
        popis="Výztuž KARI síť Q188 + boční bednění + dilatační lišty — okapní chodník",
        mj="m²",
        mnozstvi=56.00,
        raw_description="KARI Q188 + bednění okapního chodníku",
        qty_formula=f"{OBVOD} × {SIRE} = 56.00 m² (1:1 s plochou chodníku)",
        formula_parsed_method="direct",
        audit_formula=f"{OBVOD} × {SIRE} = 56.00 m²",
        audit_inputs=[
            {"label": "obvod_mimo_vstupy", "value": OBVOD, "unit": "m"},
            {"label": "sire", "value": SIRE, "unit": "m"},
            {"label": "plocha_chodniku", "value": 56.00, "unit": "m²"},
            {"label": "kari_typ", "value": "Q188 (Ø6 mm, oka 150×150 mm)", "unit": ""},
            {"label": "bednini", "value": "pouze vnější hrana (vnitřní = stěna haly)",
             "unit": ""},
        ],
        audit_poznamka=(
            "KARI síť Q188 v jedné vrstvě uprostřed tloušťky betonu. Vnější boční "
            "bednění (vnitřní hrana = stěna haly, slouží jako vnitřní bednění). "
            "Dilatační lišty mezi segmenty à ~4 m (viz separátní položka M-VK-023). "
            "Funkce výztuže: prevence náhodných smršťovacích trhlin + diferenciální "
            "sedání mezi tuhým halou a stlačitelnou zeminou."
        ),
        kros_hint="631xxx (KARI síť) + 564xxx (bednění)",
    ))

    items.append(make_okapni_item(
        item_id="M-VK-022",
        popis="Drcený štěrk ŠD 32/63 podklad okapního chodníku tl 150 mm",
        mj="m³",
        mnozstvi=8.40,
        raw_description="ŠD podklad okapního chodníku",
        qty_formula=f"{OBVOD} × {SIRE} × {TLOUSTKA_PODKLAD} = 8.40 m³",
        audit_formula=f"{OBVOD} × {SIRE} × {TLOUSTKA_PODKLAD} = 8.40 m³",
        audit_inputs=[
            {"label": "obvod_mimo_vstupy", "value": OBVOD, "unit": "m"},
            {"label": "sire", "value": SIRE, "unit": "m"},
            {"label": "tloustka_podkladu", "value": TLOUSTKA_PODKLAD, "unit": "m"},
            {"label": "objem_sd", "value": 8.40, "unit": "m³"},
            {"label": "frakce", "value": "32/63 mm", "unit": ""},
            {"label": "hutneni", "value": "Edef2 ≥ 45 MPa", "unit": ""},
        ],
        audit_poznamka=(
            "Podkladní vrstva ŠD 32/63 mm pod okapní chodník. Hutnění Edef2 ≥ 45 "
            "MPa. Funkce: drenáž (proti zdvihu mrazem) + pevný podklad pro beton. "
            "Tloušťka 150 mm standardní pro nenáročné venkovní betonové plochy."
        ),
        kros_hint="564xxx (komunikace — podkladní vrstvy)",
    ))

    items.append(make_okapni_item(
        item_id="M-VK-023",
        popis="Dilatační lišty + těsnění spár mezi segmenty okapního chodníku (à ~4 m)",
        mj="m",
        mnozstvi=20.0,
        raw_description="dilatační lišty okapní chodník 20× á 4 m segment",
        qty_formula=f"{OBVOD} / 4 = 20 ks dilatací (~1 m každá)",
        formula_parsed_method="quotient",
        audit_formula=f"{OBVOD} / 4 = 20 ks dilatací",
        audit_inputs=[
            {"label": "obvod_mimo_vstupy", "value": OBVOD, "unit": "m"},
            {"label": "segment_delka", "value": 4.0, "unit": "m"},
            {"label": "pocet_dilataci", "value": 20.0, "unit": "ks"},
            {"label": "material", "value": "polyetylénová pěnová páska 5×10 mm + horní zalévací zálivka",
             "unit": ""},
        ],
        audit_poznamka=(
            "Dilatační spáry à ~4 m oddělují segmenty okapního chodníku. Nutné "
            "kvůli teplotnímu pracování betonu + kontrolovanému umístění trhlin. "
            "Materiál: polyetylenová pěnová páska 5×10 mm vložená během betonáže "
            "+ horní povrchová zálivka (polyuretanová tmel) odolná povětrnostním "
            "vlivům + UV. Také rohové dilatace u 4 vstupů."
        ),
        kros_hint="938xxx (dilatační spáry + těsnění)",
    ))

    return items


def build_resolved_abmvs() -> list[dict]:
    """5 ABMVs as paper trail of considered+rejected scopes per user decision."""
    return [
        {
            "id": "ABMV_26",
            "category": "design_clarification",
            "severity": "medium",
            "status": f"resolved_per_user_decision_{USER_DECISION_DATE}",
            "title": "Material zpevněných ploch okolo haly",
            "summary_cs": (
                "Considered: Variant A asfalt 4-layer (ACO 11+ + ACL 16+ + MZK + "
                "ŠD) per task §1.3 user preliminary preference. Audit revealed "
                "TZ ARS B p09 + p21 explicitly specifies 'chodník pro pěší ze "
                "zámkové dlažby šířky 1.5 m', NE asfalt. C.3 KOO situace legenda "
                "obsahuje pouze 'STÁVAJÍCÍ VOZOVKA - ASFALT' — žádná položka "
                "navržená nová zpevněná plocha."
            ),
            "resolution_note": (
                f"User decision {USER_DECISION_DATE}: minimal scope per "
                "documentation conflicts. Pouze beton okapní chodník + 4 rampy + "
                "existing liniový žlab. NE asfalt (TZ p21 zachovat SZ existing). "
                "NE dlažba 1.5 m (user explicitly excluded, override TZ p09)."
            ),
            "resolution_date": USER_DECISION_DATE,
            "resolution_source": (
                "User decision 2026-05-27 + audit outputs/zpevnene_plochy_audit.md"
            ),
            "items_affected": ["M-VK-013 dropped", "M-VK-014 dropped"],
            "created_at": NOW_ISO,
        },
        {
            "id": "ABMV_27",
            "category": "design_clarification",
            "severity": "low",
            "status": f"resolved_per_user_decision_{USER_DECISION_DATE}",
            "title": "Plocha zpevněných ploch dimenze",
            "summary_cs": (
                "Considered: 545 m² celá žlutá zóna z C.3 měření user (parkoviště "
                "125 + manipulace 150 + napojení 50 + okolí 220). After TZ ARS "
                "audit: SZ komunikace EXISTING (ZACHOVAT), parkoviště nepodporeno "
                "(TZ p21 'bez nárůstu OA'), manipulační drátkobeton není v TZ."
            ),
            "resolution_note": (
                f"User decision {USER_DECISION_DATE}: 545 m² scope dropped entirely. "
                "Bid scope = pouze okapní chodník 56 m² (per řezy A103 detail) + "
                "rampy 43 m² (per A101). Total venkovní pavement scope = 99 m², "
                "NE 545 m² preliminary estimate."
            ),
            "resolution_date": USER_DECISION_DATE,
            "items_affected": ["M-VK-013..017 all dropped"],
            "created_at": NOW_ISO,
        },
        {
            "id": "ABMV_28",
            "category": "scope_clarification",
            "severity": "low",
            "status": f"resolved_per_user_decision_{USER_DECISION_DATE}",
            "title": "Manipulační drátkobeton okolo vrat",
            "summary_cs": (
                "Considered: agent assumption v earlier scenarios — drátkobeton "
                "C25/30 XF4 s vlákny pro VZV provoz okolo sekčních vrat (~200 m²). "
                "NE TZ explicit spec; user assumption-based extension."
            ),
            "resolution_note": (
                f"User decision {USER_DECISION_DATE}: dropped from scope. NE TZ "
                "explicit, NE bid. If SOLAR DISPOREC requests post-bid → change "
                "request workflow."
            ),
            "resolution_date": USER_DECISION_DATE,
            "items_affected": [],
            "created_at": NOW_ISO,
        },
        {
            "id": "ABMV_29",
            "category": "scope_clarification",
            "severity": "low",
            "status": f"resolved_per_user_decision_{USER_DECISION_DATE}",
            "title": "Parkoviště 10 stání",
            "summary_cs": (
                "Considered: 10 kolmá parkovací stání 2.5×5.0 m = 125 m² asfalt + "
                "vodorovné značení (M-VK-016) per agent earlier assumption."
                " TZ ARS B p21 explicit: 'Navýšení pohybu osobních vozidel se "
                "nepředpokládá. Jako skladníci budou pracovat stávající zaměstnanci.'"
            ),
            "resolution_note": (
                f"User decision {USER_DECISION_DATE}: dropped per TZ p21 'bez "
                "nárůstu OA'. If SOLAR DISPOREC requests post-bid (e.g. expansion "
                "of zaměstnanců) → change request."
            ),
            "resolution_date": USER_DECISION_DATE,
            "items_affected": ["M-VK-016 dropped"],
            "created_at": NOW_ISO,
        },
        {
            "id": "ABMV_30",
            "category": "design_clarification",
            "severity": "low",
            "status": f"resolved_per_user_decision_{USER_DECISION_DATE}",
            "title": "Beton expozice XF3 vs XF4 pro okapní chodník",
            "summary_cs": (
                "Considered: XF3 (zmrazování bez chemikálií) vs XF4 (s chemikáliemi "
                "rozmrazovacích solí). Závisí na expozici hala perimetru: pokud "
                "hala přiléhá k veřejné solící komunikaci → XF4. Per audit: hala "
                "nepřiléhá veřejné komunikaci (pouze stávající areálová obslužná)."
            ),
            "resolution_note": (
                f"User decision {USER_DECISION_DATE}: XF3 confirmed per hala "
                "neaplikuje rozmrazovací soli na svém perimetru. M-VK-020 beton "
                "C25/30 XF3."
            ),
            "resolution_date": USER_DECISION_DATE,
            "items_affected": ["M-VK-020"],
            "created_at": NOW_ISO,
        },
        {
            "id": "ABMV_31",
            "category": "design_clarification",
            "severity": "low",
            "status": "open",
            "title": "Material okapního chodníku verification — projektant confirm",
            "summary_cs": (
                "Okapní chodník 0.7 m × 80 m × 0.20 m calculated as beton C25/30 "
                "XF3 + KARI per řezy A103 detail screenshots 2026-05-27 hatching "
                "interpretation. TZ ARS silent na material tohoto specific element "
                "(TZ p09 mentions only dlažbu 1.5 m, dropped per user). Verify "
                "s projektant Volka při execution kick-off."
            ),
            "blocks_vv": [],
            "addressee": ["projektant Volka", "SOLAR DISPOREC"],
            "items_affected": ["M-VK-020", "M-VK-021", "M-VK-022", "M-VK-023"],
            "resolution_required_before": "execution kick-off (Stage 4)",
            "created_at": NOW_ISO,
        },
    ]


def main() -> None:
    raw = json.loads(ITEMS_PATH.read_text(encoding="utf-8"))
    existing_ids = {it["id"] for it in raw["items"]}
    counts = {"dropped": 0, "added": 0, "kept_unchanged": 0}

    # Step 2.2: DROP items (set _status_flag, preserve audit_trail)
    for item in raw["items"]:
        if item["id"] in DROP_IDS:
            reason = DROP_IDS[item["id"]]
            item["_status_flag"] = f"dropped_per_user_decision_{USER_DECISION_DATE}"
            item["_drop_reason"] = reason
            # Pattern 14 forward journey
            journey = item.setdefault("_analytical_journey", [])
            journey.append({
                "timestamp": NOW_ISO,
                "phase": "user_decision_scope_drop",
                "previous_state": {
                    "_status_flag": None,
                    "active": True,
                    "mnozstvi": item["mnozstvi"],
                    "mj": item["mj"],
                },
                "current_state": {
                    "_status_flag": item["_status_flag"],
                    "active": False,
                    "mnozstvi": item["mnozstvi"],  # preserved for audit
                    "mj": item["mj"],
                },
                "source": (
                    f"User decision {USER_DECISION_DATE} — minimal scope final. "
                    f"Drop reason: {reason}. Item preserved in JSON for audit "
                    "trail; excluded from sequential_list XLSX active rows."
                ),
                "correction_type": "scope_reduction_per_user_decision",
            })
            counts["dropped"] += 1

    # Step 2.3: ADD 4 new okapní chodník items
    new_items = build_okapni_items()
    for it in new_items:
        if it["id"] in existing_ids:
            raise SystemExit(f"FATAL: id collision {it['id']!r}")
    raw["items"].extend(new_items)
    counts["added"] = len(new_items)
    counts["kept_unchanged"] = sum(
        1 for it in raw["items"]
        if it.get("kapitola") == "M-VK"
        and it["id"] not in DROP_IDS
        and it["id"] not in {n["id"] for n in new_items}
    )

    if counts["dropped"] != len(DROP_IDS):
        raise SystemExit(
            f"FATAL: expected {len(DROP_IDS)} drops, got {counts['dropped']}"
        )

    # Step 2.6: revisions[] entry
    raw["metadata"].setdefault("revisions", []).append({
        "date": USER_DECISION_DATE,
        "change": (
            "HK212 venkovní úpravy FINAL minimal scope per user decision — "
            "drop 5 asfalt/parkoviště items (M-VK-013..017), add 4 okapní "
            "chodník items (M-VK-020..023). 4 rampy + 4 přípojky + retenční "
            "+ hydrant + žlab + vegetace UNCHANGED."
        ),
        "reason": (
            "Documentation conflicts TZ ARS B p09 (dlažba 1.5 m) vs řezy A103 "
            "(beton 0.7 m sokl) vs C.3 (silent material) + PBR p21 (přístupové "
            "komunikace STÁVAJÍCÍ). User decision 2026-05-27: minimal scope — "
            "beton okapní chodník (per řezy graphical authority) + 4 rampy "
            "(per A101 graphical authority, user override prior řez-detail "
            "scope-down) + liniový žlab (existing, NE změna). Drop asfalt 489 m² "
            "(TZ p21 contradicts). Drop dlažba 143 m² (user override TZ — "
            "operative choice). Drop parkoviště 10 stání (TZ p21 'bez nárůstu OA'). "
            "Drop manipulační drátkobeton (assumption out, NE TZ supported). "
            "Keep all 4 rampy per A101 (user override prior řez-detail scope down "
            "z 43 m² na 23 m² — graphical A101 authority wins over partial řez)."
        ),
        "previous_count": 169,
        "new_count": 169 + counts["added"],
        "items_dropped": [
            f"{i} (status: dropped_per_user_decision_{USER_DECISION_DATE})"
            for i in DROP_IDS
        ],
        "items_added": [it["id"] for it in new_items],
        "items_modified": [],
        "active_m_vk_count": counts["kept_unchanged"] + counts["added"],
        "total_m_vk_count_in_json": 19 + counts["added"],
        "abmvs_added": [f"ABMV_{n}" for n in range(26, 32)],
        "abmvs_resolved_count": 5,
        "abmvs_new_open": 1,
        "user_decision_basis": (
            "User professional judgment as přípravář in messy DPS documentation. "
            "Minimal scope reduces audit risk while honoring řezy graphical "
            "authority for beton okapní + A101 graphical authority for 4 rampy. "
            "Documentation conflict explicitly noted in commit message."
        ),
        "audit_doc_reference": "outputs/zpevnene_plochy_audit.md (cherry-picked from prior branch)",
        "pattern_14_compliance": (
            "5 dropped items preserved in JSON with _analytical_journey "
            "forward audit trail; NE pure delete."
        ),
        "pattern_15_compliance": (
            "4 new okapní items: work-first, KROS hint only, Stage 3 catalog "
            "mapping separately."
        ),
        "pattern_36_compliance": (
            "A101 + A103 DPS 2026-05 used (DSP 2025-10 in _superseded/ from "
            "prior PR #1235)."
        ),
        "pattern_37_compliance": (
            "git fetch + git ls-remote claude/* executed at session start; "
            "no parallel session on M-VK scope confirmed."
        ),
    })

    ITEMS_PATH.write_text(
        json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"items.json: 169 → {169 + counts['added']} entries "
          f"({counts['dropped']} dropped + {counts['added']} added)")
    print(f"  active M-VK: {counts['kept_unchanged'] + counts['added']} "
          f"(was 19, now 14 kept + 4 new = 18 active)")

    # ABMV updates
    abmv = json.loads(ABMV_PATH.read_text(encoding="utf-8"))
    new_abmvs = build_resolved_abmvs()
    existing_abmv_ids = {it["id"] for it in abmv["items"]}
    for a in new_abmvs:
        if a["id"] in existing_abmv_ids:
            raise SystemExit(f"FATAL: ABMV id collision {a['id']!r}")
    abmv["items"].extend(new_abmvs)
    ABMV_PATH.write_text(
        json.dumps(abmv, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"abmv_email_queue.json: +6 ABMV (5 resolved as paper trail "
          "+ 1 new open ABMV_31)")


if __name__ == "__main__":
    main()
