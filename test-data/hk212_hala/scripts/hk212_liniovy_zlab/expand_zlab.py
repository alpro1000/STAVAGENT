"""HK212 — Liniový žlab SZ+JZ fasáda COMPLETE: M-VK-012 → 10 atomic položek.

Customer SOLAR DISPOREC 2026-05-27: "nezapomeňte na ten žlab ze dvou stran
domu včetně podkladu a zapravení" (= betonové lože + obetonování).
TZ ARS D.1.1: liniový žlab kolem SZ + JZ fasády zapuštěný v komunikaci.
User měření 2026-05-27: délka 46.5 m (supersedes guessed 40 m).
Pojízdný (TZ bilance 5 nákladních/týden) → rošt D400 litina.

Coding RESOLVED Stage 3 by user 2026-05-27 (real ÚRS codes, NE Pattern 15
work-first this time): class 221 Komunikace (montáž žlabu) + 011 A08 (montáž
mříže) + materiál polymerbeton + litina.

§3 double-count check: kros_catalog.db (9173 items subset) lacks 935*/592*
drainage codes → CANNOT disprove. Per §9: KEEP both #4 (935113111 osazení
žlabu s krycím roštem) + #6 (953941212 osazení mříže), flag ABMV_36 for
user final review.

M-VK-012 (40 m guessed B125) → superseded_by_user_measurement_and_codes_2026-05-27.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ITEMS_PATH = ROOT / "outputs" / "phase_1_etap1" / "items_hk212_etap1.json"
ABMV_PATH = ROOT / "outputs" / "abmv_email_queue.json"

NOW_ISO = "2026-05-27T23:55:00+00:00"
ZLAB_L = 46.5  # user měření 2026-05-27

PATTERN_15_REF = "Coding RESOLVED Stage 3 by user 2026-05-27 — real ÚRS codes assigned."

CODING_RESOLUTION = {
    "resolved_2026_05_27": "Liniový žlab CODING RESOLVED Stage 3 (user 2026-05-27)",
    "kept_codes": {
        "935113111": "Osazení odvodňovacího polymerbetonového žlabu s krycím roštem š do 210 mm — class 221 Komunikace",
        "59227005": "Žlab odvodňovací polymerbeton spádový š 130 mm — materiál (kaskáda 005-011 dle hloubky spádu)",
        "55241040": "Mříž 600/40T D400 litina — materiál (nebo 28661702 rošt vtokový D400)",
        "953941212": "Osazování kovových mříží v rámu — class 011 A08",
        "ACO.10935": "Vpust ACO Drain dolní díl odtok DN150 — napojení na dešťovou kanalizaci",
        "ACO.447778": "Čela žlabu kombi (začátek/konec)",
    },
    "rejected_prior_wrong_class": [
        "771591481 + 59054099 — class 771 dlaždice / napojení na kontaktní izolaci (terasové/vnitřní) — WRONG",
        "721212121.HLE + 721219128 + HLE.HL50Fxxx — class 721 ZTI vnitřní sprchové žlaby nerez DN50 — WRONG",
    ],
    "lesson": (
        "Venkovní pojízdný liniový žlab = class 221 (montáž žlabu) + 011 A08 "
        "(montáž mříže), NE 721 ZTI ani 771 dlaždice. Marker: "
        "'pojízdný / do komunikace / ACO Drain / rošt litinový D400'."
    ),
    "double_count_flag": (
        "935113111 'osazení s krycím roštem' vs 953941212 separate mříž osazení. "
        "kros_catalog.db subset (9173 items) neobsahuje 935*/592* → CANNOT verify. "
        "Per §9 KEEP both (KROS link 953941212 ↔ 55241040 naznačuje separate "
        "montáž mříže). User final review Stage 3 — viz ABMV_36."
    ),
}


def make_item(*, item_id, popis, mj, mnozstvi, urs_code, urs_status, qty_formula,
              audit_formula, audit_inputs, audit_poznamka, kros_hint,
              confidence=0.85, vyjasneni=None, coding_note=None, dc_flag=None,
              formula_parsed_method="product") -> dict:
    at = {
        "lokalizace": "venkovní úpravy — liniový žlab SZ + JZ fasáda zapuštěný v komunikaci · SO-13",
        "formula": audit_formula,
        "formula_parsed_method": formula_parsed_method,
        "inputs": audit_inputs,
        "reference": [
            {"type": "tz_section", "section": "ARS D.1.1",
             "raw": "liniovým žlabem kolem SZ a JZ fasády zapuštěným v komunikaci"},
            {"type": "user_measurement", "code": "2026-05-27",
             "raw": f"délka žlabu {ZLAB_L} m (supersedes guessed 40 m)"},
            {"type": "customer_reminder", "code": "SOLAR DISPOREC 2026-05-27",
             "raw": "žlab ze dvou stran domu včetně podkladu a zapravení"},
        ],
        "poznamka": audit_poznamka,
        "confidence": confidence,
        "extraction_method": "user_resolved_urs_stage_3 + tz_ars_d11",
        "data_source_hint": "TZ_ARS_D11 + user_měření + user_ÚRS_codes_2026-05-27",
        "extracted_at": NOW_ISO,
        "kapitola_decision": (
            "M-VK liniový žlab complete — M-VK-012 superseded, 10 atomic položek "
            "s real ÚRS codes (user Stage 3 resolution 2026-05-27)"
        ),
        "kros_hint": kros_hint,
    }
    if coding_note:
        at["coding_resolution"] = CODING_RESOLUTION
    if dc_flag:
        at["double_count_flag"] = dc_flag
    return {
        "id": item_id,
        "kapitola": "M-VK",
        "SO": "SO-13",
        "popis": popis,
        "mj": mj,
        "mnozstvi": mnozstvi,
        "urs_code": urs_code,
        "urs_alternatives": [],
        "urs_status": urs_status,
        "urs_match_score": 1.0 if urs_code else 0.0,
        "skladba_ref": None,
        "source": (
            "TZ ARS D.1.1 + customer SOLAR DISPOREC 2026-05-27 + user měření 46.5 m "
            "+ user ÚRS coding resolution Stage 3 2026-05-27"
        ),
        "raw_description": f"liniový žlab — {popis[:50]}",
        "confidence": confidence,
        "subdodavatel_chapter": "venkovni_upravy",
        "_vyjasneni_ref": vyjasneni or ["ABMV_35"],
        "_status_flag": None,
        "_data_source": "TZ_ARS_D11+user_měření+user_ÚRS_2026-05-27",
        "_completeness": 1.0,
        "_qty_formula": qty_formula,
        "_export_wrapper_hint": None,
        "_pattern_15_ref": PATTERN_15_REF,
        "_kros_hint": kros_hint,
        "audit_trail": at,
    }


def build_items() -> list[dict]:
    vykop = round(ZLAB_L * 0.30 * 0.35, 1)   # 4.9
    loze = round(ZLAB_L * 0.30 * 0.15, 1)    # 2.1
    rost_ks = 47

    return [
        make_item(
            item_id="M-VK-040",
            popis="Výkop rýhy pro liniový žlab š 300 mm, hl 350 mm (SZ + JZ fasáda)",
            mj="m³", mnozstvi=vykop, urs_code=None, urs_status="pending_stage_3",
            qty_formula=f"{ZLAB_L} × 0.30 × 0.35 = {vykop} m³",
            audit_formula=f"{ZLAB_L} × 0.30 × 0.35 = {vykop} m³",
            audit_inputs=[
                {"label": "delka", "value": ZLAB_L, "unit": "m"},
                {"label": "sirka", "value": 0.30, "unit": "m"},
                {"label": "hloubka", "value": 0.35, "unit": "m"},
            ],
            audit_poznamka="Výkop rýhy na hloubku žlab + betonové lože. class 132/162 — Stage 3 kód.",
            kros_hint="132xxx výkop rýhy / 162xxx (Stage 3)",
        ),
        make_item(
            item_id="M-VK-041",
            popis="Odvoz vykopané zeminy z rýhy žlabu na skládku",
            mj="m³", mnozstvi=vykop, urs_code=None, urs_status="pending_stage_3",
            qty_formula=f"= výkop M-VK-040 = {vykop} m³", formula_parsed_method="direct",
            audit_formula=f"= {vykop} m³",
            audit_inputs=[{"label": "objem", "value": vykop, "unit": "m³"}],
            audit_poznamka="Odvoz zeminy z rýhy (nahrazena žlabem + betonem). Stage 3 kód.",
            kros_hint="162xxx odvoz (Stage 3)",
        ),
        make_item(
            item_id="M-VK-042",
            popis="Žlab odvodňovací polymerbeton spádový š 130 mm (materiál, kaskáda spádu 0,5 %)",
            mj="m", mnozstvi=ZLAB_L, urs_code="59227005", urs_status="user_resolved_stage_3",
            qty_formula=f"{ZLAB_L} m (user měření)", formula_parsed_method="direct",
            audit_formula=f"{ZLAB_L} m",
            audit_inputs=[
                {"label": "delka", "value": ZLAB_L, "unit": "m"},
                {"label": "sirka_zlabu", "value": 130, "unit": "mm"},
                {"label": "spad", "value": "0.5 % kaskáda (59227005-011 dle hloubky dna)", "unit": ""},
            ],
            audit_poznamka=(
                "Materiál žlab polymerbeton spádový. Pro 46.5 m bez bodu sběru → "
                "spádový systém (kaskáda 59227005-011 rostoucí hloubka dna) NEBO "
                "uklon v betonovém loži ke 2 vpustím. Default spádový polymerbeton, "
                "2 vpusti (SZ + JZ větev ~23 m úsek). Hydraulický výpočet ACO → ABMV_35."
            ),
            kros_hint="59227005 (polymerbeton žlab, kaskáda 006-011 dle hloubky)",
            coding_note=True,
        ),
        make_item(
            item_id="M-VK-043",
            popis="Osazení odvodňovacího polymerbetonového žlabu s krycím roštem š do 210 mm",
            mj="m", mnozstvi=ZLAB_L, urs_code="935113111", urs_status="user_resolved_stage_3",
            qty_formula=f"{ZLAB_L} m (1:1 s žlabem)", formula_parsed_method="direct",
            audit_formula=f"{ZLAB_L} m",
            audit_inputs=[
                {"label": "delka", "value": ZLAB_L, "unit": "m"},
                {"label": "trida", "value": "221 Komunikace", "unit": ""},
            ],
            audit_poznamka=(
                "Montáž žlabu — class 221 Komunikace. Popis ÚRS 'osazení s krycím "
                "roštem' → viz double_count_flag vs M-VK-045 (953941212 separate "
                "montáž mříže). Coding resolution log v audit_trail."
            ),
            kros_hint="935113111 (osazení žlabu s krycím roštem, class 221)",
            coding_note=True,
            dc_flag=CODING_RESOLUTION["double_count_flag"],
            vyjasneni=["ABMV_35", "ABMV_36"],
        ),
        make_item(
            item_id="M-VK-044",
            popis="Rošt / mříž litinová D400 600/40T (materiál, pojízdný — nákladní doprava)",
            mj="kus", mnozstvi=rost_ks, urs_code="55241040", urs_status="user_resolved_stage_3",
            qty_formula=f"{ZLAB_L} m / ~1.0 m per rošt = {rost_ks} ks", formula_parsed_method="quotient",
            audit_formula=f"{ZLAB_L} / 1.0 ≈ {rost_ks} ks",
            audit_inputs=[
                {"label": "delka_zlabu", "value": ZLAB_L, "unit": "m"},
                {"label": "rost_delka", "value": 1.0, "unit": "m/ks"},
                {"label": "trida_zatizeni", "value": "D400 (pojízdný nákladní)", "unit": ""},
            ],
            audit_poznamka=(
                "Materiál rošt litina D400 (TZ bilance 5 nákladních vozidel/týden → "
                "D400). Alternativa 28661702 rošt vtokový D400. KROS link "
                "55241040 ↔ montáž 953941212 (M-VK-045)."
            ),
            kros_hint="55241040 (mříž 600/40T D400) nebo 28661702 (rošt vtokový D400)",
            coding_note=True,
        ),
        make_item(
            item_id="M-VK-045",
            popis="Osazování kovových mříží litinových D400 v rámu (montáž roštu)",
            mj="kus", mnozstvi=rost_ks, urs_code="953941212", urs_status="user_resolved_stage_3",
            qty_formula=f"{rost_ks} ks (1:1 s roštem M-VK-044)", formula_parsed_method="direct",
            audit_formula=f"{rost_ks} ks",
            audit_inputs=[
                {"label": "pocet_rostu", "value": rost_ks, "unit": "ks"},
                {"label": "trida", "value": "011 A08", "unit": ""},
            ],
            audit_poznamka=(
                "Montáž mříže — class 011 A08. ⚠️ DOUBLE-COUNT FLAG vs M-VK-043 "
                "(935113111 'osazení žlabu s krycím roštem'). Default KEEP per KROS "
                "link 953941212 ↔ 55241040 (naznačuje separate montáž mříže). "
                "kros_catalog.db subset neobsahuje 935* → nelze ověřit. User final "
                "review Stage 3 — pokud 935113111 už zahrnuje osazení roštu → DROP "
                "tuto položku, M-VK-044 zůstane jen materiál. Viz ABMV_36."
            ),
            kros_hint="953941212 (osazování mříží v rámu, class 011 A08)",
            coding_note=True,
            dc_flag=CODING_RESOLUTION["double_count_flag"],
            vyjasneni=["ABMV_35", "ABMV_36"],
        ),
        make_item(
            item_id="M-VK-046",
            popis="Betonové lože C25/30 pod žlab min 150 mm (\"podklad\" per customer)",
            mj="m³", mnozstvi=loze, urs_code=None, urs_status="pending_stage_3",
            qty_formula=f"{ZLAB_L} × 0.30 × 0.15 = {loze} m³",
            audit_formula=f"{ZLAB_L} × 0.30 × 0.15 = {loze} m³",
            audit_inputs=[
                {"label": "delka", "value": ZLAB_L, "unit": "m"},
                {"label": "sirka", "value": 0.30, "unit": "m"},
                {"label": "tloustka_loze", "value": 0.15, "unit": "m"},
            ],
            audit_poznamka=(
                "Betonové lože C25/30 pod žlab = 'podklad' per customer reminder "
                "2026-05-27. class 564 — Stage 3 kód. Sklon ke spádu žlabu."
            ),
            kros_hint="564xxx betonové lože (Stage 3, class 564)",
        ),
        make_item(
            item_id="M-VK-047",
            popis="Obetonování žlabu C25/30 po vrchní hranu (\"zapravení\" boky per customer)",
            mj="m³", mnozstvi=1.7, urs_code=None, urs_status="pending_stage_3",
            qty_formula="boky žlabu po vrchní hranu ≈ 1.7 m³",
            audit_formula="2 × (0.085 × 0.20) × 46.5 ≈ 1.7 m³",
            audit_inputs=[
                {"label": "delka", "value": ZLAB_L, "unit": "m"},
                {"label": "obetonovani", "value": "oba boky po vrchní hranu", "unit": ""},
            ],
            audit_poznamka=(
                "Obetonování boků žlabu C25/30 = 'zapravení' per customer reminder "
                "2026-05-27. Stabilizace žlabu proti pojezdu D400. class 564 — Stage 3."
            ),
            kros_hint="564xxx obetonování (Stage 3, class 564)",
        ),
        make_item(
            item_id="M-VK-048",
            popis="Vpust ACO Drain dolní díl, odtok DN150 — napojení na dešťovou kanalizaci (SZ + JZ větev)",
            mj="kus", mnozstvi=2, urs_code="ACO.10935", urs_status="user_resolved_stage_3",
            qty_formula="2 ks = SZ větev + JZ větev", formula_parsed_method="sum",
            audit_formula="1 + 1 = 2 ks",
            audit_inputs=[
                {"label": "sz_vetev", "value": 1, "unit": "ks"},
                {"label": "jz_vetev", "value": 1, "unit": "ks"},
                {"label": "odtok", "value": "DN150 → dešťová kanalizace", "unit": ""},
            ],
            audit_poznamka=(
                "Vpust ACO Drain DN150 napojená na dešťovou kanalizaci (M-ZTI K1 "
                "dešťová větev). 2 ks = sběrný bod každé větve (SZ + JZ ~23 m úsek). "
                "Počet dle hydraulického výpočtu ACO → ABMV_35."
            ),
            kros_hint="ACO.10935 (vpust ACO Drain DN150)",
            coding_note=True,
        ),
        make_item(
            item_id="M-VK-049",
            popis="Čela žlabu kombi (začátek/konec) — 2 čela × 2 větve",
            mj="kus", mnozstvi=4, urs_code="ACO.447778", urs_status="user_resolved_stage_3",
            qty_formula="2 čela × 2 větve = 4 ks", formula_parsed_method="product",
            audit_formula="2 × 2 = 4 ks",
            audit_inputs=[
                {"label": "cela_per_vetev", "value": 2, "unit": "ks"},
                {"label": "pocet_vetvi", "value": 2, "unit": ""},
            ],
            audit_poznamka="Čela žlabu (začátek + konec) každé větve SZ + JZ = 4 ks.",
            kros_hint="ACO.447778 (čela žlabu kombi)",
            coding_note=True,
        ),
    ]


def main() -> None:
    raw = json.loads(ITEMS_PATH.read_text(encoding="utf-8"))
    existing_ids = {it["id"] for it in raw["items"]}

    # Supersede M-VK-012
    found = False
    for item in raw["items"]:
        if item["id"] != "M-VK-012":
            continue
        found = True
        item["_status_flag"] = "superseded_by_user_measurement_and_codes_2026-05-27"
        item["_superseded_by"] = (
            "M-VK-040..049 — 10 atomic položek, délka 46.5 m (user měření), "
            "real ÚRS codes (user Stage 3 resolution), betonové lože + obetonování "
            "+ 2 vpusti DN150 + 4 čela"
        )
        journey = item.setdefault("_analytical_journey", [])
        journey.append({
            "timestamp": NOW_ISO,
            "phase": "superseded_by_user_measurement_and_urs_codes",
            "previous_state": {
                "mnozstvi": item["mnozstvi"], "mj": item["mj"],
                "popis": item["popis"], "active": True,
            },
            "current_state": {"_status_flag": item["_status_flag"], "active": False},
            "source": (
                "User měření 46.5 m (supersedes guessed 40 m) + customer reminder "
                "'včetně podkladu a zapravení' + user ÚRS coding resolution 2026-05-27. "
                "Single guessed B125 line → 10 atomic položek with real codes."
            ),
            "correction_type": "guessed_superseded_by_user_measurement_and_codes",
        })
        break
    if not found:
        raise SystemExit("FATAL: M-VK-012 not found")

    new_items = build_items()
    for it in new_items:
        if it["id"] in existing_ids:
            raise SystemExit(f"FATAL: collision {it['id']}")
    prev = len(raw["items"])
    raw["items"].extend(new_items)
    new = len(raw["items"])
    if new != prev + 10:
        raise SystemExit(f"FATAL: expected {prev+10}, got {new}")

    raw["metadata"].setdefault("revisions", []).append({
        "date": "2026-05-27",
        "change": (
            "Liniový žlab SZ+JZ COMPLETE — M-VK-012 (40 m guessed B125) superseded "
            "→ 10 atomic položek (M-VK-040..049) délka 46.5 m + real ÚRS codes "
            "(user Stage 3 resolution) + betonové lože + obetonování + 2 vpusti DN150 + 4 čela."
        ),
        "reason": (
            "Customer SOLAR DISPOREC 2026-05-27 'žlab ze dvou stran domu včetně "
            "podkladu a zapravení'. User měření 46.5 m (supersedes 40 m). User "
            "resolved ÚRS coding Stage 3: class 221 (montáž žlabu) + 011 A08 "
            "(montáž mříže) + materiál polymerbeton + litina D400 (pojízdný). "
            "3 prior wrong-class attempts rejected (721 ZTI, 771 dlaždice)."
        ),
        "previous_count": prev,
        "new_count": new,
        "items_added": [it["id"] for it in new_items],
        "items_superseded": ["M-VK-012"],
        "urs_codes_assigned": ["935113111", "59227005", "55241040", "953941212", "ACO.10935", "ACO.447778"],
        "urs_codes_rejected": CODING_RESOLUTION["rejected_prior_wrong_class"],
        "coding_lesson": CODING_RESOLUTION["lesson"],
        "abmvs_added": ["ABMV_35", "ABMV_36"],
        "double_count_status": "KEEP both 935113111 + 953941212 — kros_catalog.db subset cannot verify, flag ABMV_36",
        "pattern_14_compliance": "M-VK-012 superseded with _analytical_journey + _superseded_by",
    })

    ITEMS_PATH.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"items.json: {prev} → {new} (M-VK-012 superseded, +10 atomic)")

    abmv = json.loads(ABMV_PATH.read_text(encoding="utf-8"))
    new_abmvs = [
        {
            "id": "ABMV_35",
            "category": "design_clarification",
            "severity": "medium",
            "status": "open",
            "title": "Liniový žlab — délka 46.5 m + load class + počet vpustí",
            "summary_cs": (
                "Žlab délka 46.5 m (user měření 2026-05-27, supersedes guessed 40 m). "
                "Spádový polymerbeton š130 + rošt D400 litina (nákladní doprava "
                "5/týden). 2 vpusti DN150 (SZ + JZ větev). Verify projektant: "
                "load class D400 + počet vpustí dle hydraulického výpočtu ACO "
                "(spád 0.5 % na 46.5 m → ověřit počet sběrných bodů)."
            ),
            "blocks_vv": [],
            "addressee": ["projektant Volka", "SOLAR DISPOREC", "ACO technik"],
            "items_affected": [f"M-VK-{n:03d}" for n in range(40, 50)],
            "resolution_required_before": "objednávka žlabu",
            "created_at": NOW_ISO,
        },
        {
            "id": "ABMV_36",
            "category": "coding_clarification",
            "severity": "low",
            "status": "open",
            "title": "Rošt montáž double-count — 935113111 vs 953941212",
            "summary_cs": (
                "935113111 'osazení žlabu s krycím roštem' (M-VK-043) vs 953941212 "
                "separate montáž mříže (M-VK-045). kros_catalog.db subset (9173 "
                "items) neobsahuje 935*/592* → nelze ověřit zda 935 už zahrnuje "
                "osazení roštu. Default KEEP both per KROS link 953941212 ↔ "
                "55241040. User final review Stage 3: pokud 935113111 zahrnuje "
                "rošt montáž → DROP M-VK-045, M-VK-044 zůstane jen materiál."
            ),
            "blocks_vv": [],
            "addressee": ["rozpočtář Stage 3", "SOLAR DISPOREC"],
            "items_affected": ["M-VK-043", "M-VK-045"],
            "resolution_required_before": "Stage 3 finalizace ceny",
            "created_at": NOW_ISO,
        },
    ]
    for a in new_abmvs:
        if a["id"] in {x["id"] for x in abmv["items"]}:
            raise SystemExit(f"FATAL: ABMV collision {a['id']}")
    abmv["items"].extend(new_abmvs)
    ABMV_PATH.write_text(json.dumps(abmv, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("abmv_email_queue.json: +2 ABMV (ABMV_35 délka/load, ABMV_36 rošt double-count)")


if __name__ == "__main__":
    main()
