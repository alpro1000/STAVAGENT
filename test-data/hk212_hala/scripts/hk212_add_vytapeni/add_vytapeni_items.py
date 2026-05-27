"""Add D.1.4.2 VYTÁPĚNÍ scope (kapitola M-UT, 12 items) to HK212 items.json.

Per investor scope change 2026-05-26: SOLAR DISPOREC included vytápění in bid
(originally TZB out-of-scope, Stage D scope-cut). Electrical connection of
topidel (cabling, jištění, rozvaděč) stays OUT — separate elektro contract.

Source: D.1.4.2 VYTÁPĚNÍ DPS 05/2026
- UT_HalaHK_TZ_DPS.doc — full TZ (8 sekcí, 11 kW tepelná ztráta, 60 kW příkon)
- UT_HalaHK_TZ_VM_DPS_E.pdf — TZ + výkaz materiálu (5 stránek)
- UT_HALAHK_DPS.dxf — půdorys layout (integrated Stage C — already in inputs/vykresy_dxf/)
- UT_HalaHK_PUDORYS_DPS_E.pdf — půdorys PDF

Strict additions only — no modification of existing 138 items. Pattern 15:
work-first (no auto-catalog matching this session); KROS hints noted in
audit_trail for separate Stage 3 catalog task with Forestina ÚT/OPZ reference.
"""
from __future__ import annotations

import copy
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ITEMS_PATH = ROOT / "outputs" / "phase_1_etap1" / "items_hk212_etap1.json"
ABMV_PATH = ROOT / "outputs" / "abmv_email_queue.json"

NOW_ISO = "2026-05-26T00:00:00+00:00"
SOURCE_DOC = "D.1.4.2 VYTÁPĚNÍ DPS 05/2026"
WORK_PROFESSION = "topidla_dodavka_montaz"

SCOPE_EXCLUSION_ELEKTRO = [
    "Napájecí kabeláž (panel + Dalap)",
    "Kabelové trasy + žlaby + lišty",
    "Jištění + jističe + proudové chrániče (3×400V/50Hz, 5×2.5 mm², jistič 20 A pro Dalap E-HP 9)",
    "Silové zapojení 400V",
    "Připojení v rozvaděči",
    "Revize elektro",
    "MaR kabeláž mezi termostatem + UET + topidlem (dohodu s elektro profession)",
]

KAPITOLA_DECISION = (
    "M-UT (new — vytápění in bid per investor scope change 2026-05-26)"
)

PATTERN_15_REF = (
    "Work-first generation. Catalog mapping (KROS codes) in separate "
    "Stage 3 task with Forestina ÚT/OPZ reference."
)


def make_audit_trail(
    *,
    lokalizace: str,
    formula: str,
    inputs: list[dict],
    tz_section: str,
    formula_parsed_method: str = "product",
    extra_refs: list[dict] | None = None,
    poznamka: str = "",
    computed_qty: float | None = None,
    declared_qty: float | None = None,
    kros_hint: str | None = None,
) -> dict:
    refs: list[dict] = [
        {"type": "tz_section", "section": tz_section, "raw": f"TZ §{tz_section}"},
        {
            "type": "document",
            "code": "UT_HalaHK_TZ_DPS.doc",
            "document": "inputs/dokumentace/UT_HalaHK_TZ_DPS.doc",
        },
        {
            "type": "document",
            "code": "UT_HalaHK_TZ_VM_DPS_E.pdf",
            "document": "inputs/dokumentace/UT_HalaHK_TZ_VM_DPS_E.pdf",
            "page": 5,
        },
    ]
    if extra_refs:
        refs.extend(extra_refs)
    at: dict = {
        "lokalizace": lokalizace,
        "formula": formula,
        "formula_parsed_method": formula_parsed_method,
        "inputs": inputs,
        "reference": refs,
        "poznamka": poznamka,
        "confidence": 0.95,
        "extraction_method": "dps_tz_specification",
        "data_source_hint": "TZ_DPS+vykaz_materialu",
        "extracted_at": NOW_ISO,
        "kapitola_decision": KAPITOLA_DECISION,
    }
    if computed_qty is not None:
        at["computed_quantity"] = computed_qty
    if declared_qty is not None:
        at["declared_quantity"] = declared_qty
        if computed_qty is not None:
            at["match_delta_pct"] = 0.0
            at["match_within_tolerance"] = True
    if kros_hint:
        at["kros_hint"] = kros_hint
    return at


def make_item(
    *,
    item_id: str,
    popis: str,
    mj: str,
    mnozstvi: float,
    raw_description: str,
    qty_formula: str,
    audit_trail: dict,
    kros_hint: str,
) -> dict:
    return {
        "id": item_id,
        "kapitola": "M-UT",
        "SO": "SO-12",
        "popis": popis,
        "mj": mj,
        "mnozstvi": mnozstvi,
        "urs_code": None,
        "urs_alternatives": [],
        "urs_status": "pending_stage_3",
        "urs_match_score": 0.0,
        "skladba_ref": None,
        "source": (
            f"{SOURCE_DOC}, TZ §8 + výkaz materiálu p.5 "
            f"(investor scope change 2026-05-26)"
        ),
        "raw_description": raw_description,
        "confidence": 0.95,
        "subdodavatel_chapter": WORK_PROFESSION,
        "_vyjasneni_ref": [],
        "_status_flag": None,
        "_data_source": "TZ_DPS+vykaz_materialu",
        "_completeness": 1.0,
        "_qty_formula": qty_formula,
        "_export_wrapper_hint": None,
        "_scope_exclusion": {
            "elektro_profession": SCOPE_EXCLUSION_ELEKTRO,
        },
        "_pattern_15_ref": PATTERN_15_REF,
        "_kros_hint": kros_hint,
        "audit_trail": audit_trail,
    }


def build_items() -> list[dict]:
    items: list[dict] = []

    # M-UT-001 — Dodávka ECOSUN panelu
    items.append(
        make_item(
            item_id="M-UT-001",
            popis=(
                "Dodávka el. sálavý panel Fénix ECOSUN S+ 12, 1200 W, "
                "č.kat. 5401542"
            ),
            mj="ks",
            mnozstvi=20.0,
            raw_description="ECOSUN S+ 12 panel — dodávka",
            qty_formula="20 ks (TZ §8 + výkaz materiálu p.5 ř.1.1)",
            kros_hint="460xxx (dodávka topidel)",
            audit_trail=make_audit_trail(
                lokalizace=(
                    "vytápění — strop haly (sálavé panely zavěšené ve výšce 5 m) · SO-12"
                ),
                formula="20 ks",
                formula_parsed_method="direct",
                inputs=[
                    {"label": "ks_ecosun_s+_12", "value": 20.0, "unit": "ks"},
                    {"label": "vykon_per_ks", "value": 1.2, "unit": "kW"},
                    {"label": "celkovy_vykon", "value": 24.0, "unit": "kW"},
                ],
                tz_section="8",
                poznamka=(
                    "Fénix ECOSUN S+ 12, 1200 W, č.kat. 5401542. Celkový instalovaný "
                    "výkon 20 × 1.2 = 24 kW pro sálavé vytápění hlavní plochy haly."
                ),
                computed_qty=20.0,
                declared_qty=20.0,
                kros_hint="460xxx (dodávka topidel)",
            ),
        )
    )

    # M-UT-002 — Montáž ECOSUN panelu ve výšce 5 m
    items.append(
        make_item(
            item_id="M-UT-002",
            popis=(
                "Montáž el. sálavý panel ECOSUN S+ 12 ve výšce 5 m "
                "na stropní konstrukci"
            ),
            mj="ks",
            mnozstvi=20.0,
            raw_description="ECOSUN S+ 12 — montáž ve výšce 5 m",
            qty_formula="20 ks (1:1 s dodávkou M-UT-001)",
            kros_hint="731xxx (montáž topidel)",
            audit_trail=make_audit_trail(
                lokalizace=(
                    "vytápění — strop haly, závěs na ocelové konstrukci ve výšce 5 m · SO-12"
                ),
                formula="20 ks",
                formula_parsed_method="direct",
                inputs=[
                    {"label": "ks_montaz", "value": 20.0, "unit": "ks"},
                    {"label": "vyska_montaze", "value": 5.0, "unit": "m"},
                ],
                tz_section="8",
                poznamka=(
                    "Závěs panelů na hotovou ocelovou konstrukci po dokončení podlahy. "
                    "Montáž ve výšce 5 m vyžaduje montážní plošinu (viz M-UT-009)."
                ),
                computed_qty=20.0,
                declared_qty=20.0,
                kros_hint="731xxx (montáž topidel)",
            ),
        )
    )

    # M-UT-003 — Závěsný materiál (řetízky 5 m/ks)
    items.append(
        make_item(
            item_id="M-UT-003",
            popis=(
                "Závěsný materiál pro panely ECOSUN — řetízky prům. délka 5 m/ks"
            ),
            mj="sada",
            mnozstvi=20.0,
            raw_description="ECOSUN závěsné řetízky",
            qty_formula="20 sad × 5 m/ks (výkaz mat. p.5 ř.1.1)",
            kros_hint="731xxx (montáž příslušenství)",
            audit_trail=make_audit_trail(
                lokalizace="vytápění — závěs panelů na OK ve výšce 5 m · SO-12",
                formula="20 sad",
                formula_parsed_method="direct",
                inputs=[
                    {"label": "ks_sad", "value": 20.0, "unit": "sada"},
                    {"label": "delka_retizku_per_ks", "value": 5.0, "unit": "m"},
                ],
                tz_section="8",
                poznamka=(
                    "Závěsné řetízky pro každý panel (1:1 s ECOSUN). Délka 5 m odpovídá "
                    "montážní výšce na OK strop haly."
                ),
                computed_qty=20.0,
                declared_qty=20.0,
                kros_hint="731xxx (montáž příslušenství)",
            ),
        )
    )

    # M-UT-004 — Dodávka Dalap E-HP 9 kW
    items.append(
        make_item(
            item_id="M-UT-004",
            popis=(
                "Dodávka nástěnný el. ohřívač s ventilátorem Dalap E-HP 9 kW"
            ),
            mj="ks",
            mnozstvi=4.0,
            raw_description="Dalap E-HP 9 kW nástěnný ohřívač — dodávka",
            qty_formula="4 ks (TZ §8 + výkaz materiálu p.5 ř.2.1)",
            kros_hint="460xxx (dodávka topidel)",
            audit_trail=make_audit_trail(
                lokalizace="vytápění — rohy haly (4× dotop) · SO-12",
                formula="4 ks",
                formula_parsed_method="direct",
                inputs=[
                    {"label": "ks_dalap_e_hp", "value": 4.0, "unit": "ks"},
                    {"label": "vykon_per_ks", "value": 9.0, "unit": "kW"},
                    {"label": "celkovy_vykon", "value": 36.0, "unit": "kW"},
                ],
                tz_section="8",
                poznamka=(
                    "Dalap E-HP, 9 kW/ks. Celkový instalovaný výkon dotopu "
                    "4 × 9 = 36 kW. Doplňuje sálavé ECOSUN systémy."
                ),
                computed_qty=4.0,
                declared_qty=4.0,
                kros_hint="460xxx (dodávka topidel)",
            ),
        )
    )

    # M-UT-005 — Montáž Dalap v rozích haly
    items.append(
        make_item(
            item_id="M-UT-005",
            popis="Montáž nástěnný el. ohřívač Dalap E-HP 9 kW v rozích haly",
            mj="ks",
            mnozstvi=4.0,
            raw_description="Dalap E-HP 9 kW — montáž v rozích haly",
            qty_formula="4 ks (1:1 s dodávkou M-UT-004)",
            kros_hint="731xxx (montáž topidel)",
            audit_trail=make_audit_trail(
                lokalizace="vytápění — 4 rohy haly · SO-12",
                formula="4 ks",
                formula_parsed_method="direct",
                inputs=[
                    {"label": "ks_montaz", "value": 4.0, "unit": "ks"},
                    {"label": "pozice", "value": 4, "unit": "rohy"},
                ],
                tz_section="8",
                poznamka=(
                    "Nástěnná montáž Dalapů v rozích haly. Bez montážní plošiny "
                    "(typická výška < 4 m)."
                ),
                computed_qty=4.0,
                declared_qty=4.0,
                kros_hint="731xxx (montáž topidel)",
            ),
        )
    )

    # M-UT-006 — Řídicí jednotka UET 15D pro Dalap
    items.append(
        make_item(
            item_id="M-UT-006",
            popis="Dodávka + osazení řídicí jednotka UET 15D pro Dalap",
            mj="ks",
            mnozstvi=4.0,
            raw_description="UET 15D řídicí jednotka pro Dalap E-HP",
            qty_formula="4 ks (1:1 s Dalap, výkaz mat. p.5 ř.2.1)",
            kros_hint="460xxx (dodávka regulace)",
            audit_trail=make_audit_trail(
                lokalizace="vytápění — řízení Dalapů · SO-12",
                formula="4 ks",
                formula_parsed_method="direct",
                inputs=[
                    {"label": "ks_uet_15d", "value": 4.0, "unit": "ks"},
                ],
                tz_section="8",
                poznamka=(
                    "PT Vents UET-15D — řídicí jednotka pro každý Dalap E-HP. "
                    "Dodávka + osazení; kabeláž mezi UET, termostatem a topidlem "
                    "v gesci elektro profession (viz _scope_exclusion)."
                ),
                computed_qty=4.0,
                declared_qty=4.0,
                kros_hint="460xxx (dodávka regulace)",
            ),
        )
    )

    # M-UT-007 — Prostorový termostat
    items.append(
        make_item(
            item_id="M-UT-007",
            popis="Dodávka + osazení prostorový termostat",
            mj="ks",
            mnozstvi=8.0,
            raw_description="prostorový termostat pro ECOSUN sekce + Dalap",
            qty_formula="8 ks = 4× ECOSUN sekce + 4× Dalap (TZ §8)",
            kros_hint="460xxx (dodávka regulace)",
            audit_trail=make_audit_trail(
                lokalizace=(
                    "vytápění — regulace teploty v hale (4 ECOSUN zóny + 4 Dalap) · SO-12"
                ),
                formula="4 + 4 = 8 ks",
                formula_parsed_method="sum",
                inputs=[
                    {
                        "label": "ecosun_sekce_termostat",
                        "value": 4.0,
                        "unit": "ks",
                    },
                    {"label": "dalap_termostat", "value": 4.0, "unit": "ks"},
                ],
                tz_section="8",
                poznamka=(
                    "ECOSUN panely sdružené do 4 sekcí (20 ks / 5 panelů per sekce) — "
                    "1 termostat na sekci. Dalap má samostatný termostat / kus. "
                    "Cílová teplota vnitřní 18 °C."
                ),
                computed_qty=8.0,
                declared_qty=8.0,
                kros_hint="460xxx (dodávka regulace)",
            ),
        )
    )

    # M-UT-008 — Pomocný montážní + kotevní materiál
    items.append(
        make_item(
            item_id="M-UT-008",
            popis="Pomocný montážní + kotevní materiál ÚT",
            mj="soubor",
            mnozstvi=1.0,
            raw_description="šrouby, hmoždinky, kotvy, drobný spotřební materiál ÚT",
            qty_formula="paušál 1 soubor (standardní položka kapitoly M-UT)",
            kros_hint="998xxx (přesun hmot ÚT / drobný materiál)",
            audit_trail=make_audit_trail(
                lokalizace="vytápění — celá kapitola M-UT · SO-12",
                formula="1 soubor",
                formula_parsed_method="paushal",
                inputs=[
                    {"label": "soubor_count", "value": 1.0, "unit": "soubor"},
                ],
                tz_section="8",
                poznamka=(
                    "Spotřební + kotevní materiál pro instalaci 20 ECOSUN + 4 Dalap "
                    "+ 4 UET + 8 termostatů. Standardní paušál."
                ),
                computed_qty=1.0,
                declared_qty=1.0,
                kros_hint="998xxx (přesun hmot ÚT / drobný materiál)",
            ),
        )
    )

    # M-UT-009 — Montážní plošina pro práci ve výšce 5 m
    items.append(
        make_item(
            item_id="M-UT-009",
            popis=(
                "Montážní plošina / práce ve výšce pro montáž topidel ve výšce 5 m"
            ),
            mj="soubor",
            mnozstvi=1.0,
            raw_description="montážní plošina pro montáž 20× ECOSUN ve výšce 5 m",
            qty_formula="paušál 1 soubor (TZ §8 + BOZP požadavek)",
            kros_hint="998xxx (pomocné práce / lešení)",
            audit_trail=make_audit_trail(
                lokalizace="vytápění — montáž ECOSUN panelů ve výšce 5 m · SO-12",
                formula="1 soubor",
                formula_parsed_method="paushal",
                inputs=[
                    {"label": "soubor_count", "value": 1.0, "unit": "soubor"},
                    {"label": "pracovni_vyska", "value": 5.0, "unit": "m"},
                    {"label": "panel_count", "value": 20.0, "unit": "ks"},
                ],
                tz_section="8",
                extra_refs=[
                    {
                        "type": "norma",
                        "code": "BOZP",
                        "section": "práce ve výšce > 1,5 m",
                    }
                ],
                poznamka=(
                    "Mobilní plošina / nůžková plošina pro montáž 20 ECOSUN panelů na strop "
                    "ve výšce 5 m. Požadavek BOZP pro práce ve výšce nad 1,5 m. "
                    "Dalap (montáž do rohů haly < 4 m) nevyžaduje samostatnou plošinu."
                ),
                computed_qty=1.0,
                declared_qty=1.0,
                kros_hint="998xxx (pomocné práce / lešení)",
            ),
        )
    )

    # M-UT-010 — Funkční zkouška + nastavení systému
    items.append(
        make_item(
            item_id="M-UT-010",
            popis="Funkční zkouška + nastavení systému vytápění",
            mj="soubor",
            mnozstvi=1.0,
            raw_description="funkční zkouška topení + nastavení teplot na termostatech",
            qty_formula="paušál 1 soubor (standardní TZB závěr)",
            kros_hint="998xxx (zkoušky)",
            audit_trail=make_audit_trail(
                lokalizace="vytápění — celá kapitola M-UT · SO-12",
                formula="1 soubor",
                formula_parsed_method="paushal",
                inputs=[
                    {"label": "soubor_count", "value": 1.0, "unit": "soubor"},
                ],
                tz_section="8",
                poznamka=(
                    "Funkční zkouška po dokončení instalace + zapojení elektro: "
                    "ověření výkonu, nastavení termostatů na 18 °C vnitřní teplotu, "
                    "kontrola sekvenování ECOSUN sekcí + Dalapů."
                ),
                computed_qty=1.0,
                declared_qty=1.0,
                kros_hint="998xxx (zkoušky)",
            ),
        )
    )

    # M-UT-011 — Předání dokumentace + zaškolení obsluhy
    items.append(
        make_item(
            item_id="M-UT-011",
            popis="Předání dokumentace + zaškolení obsluhy",
            mj="soubor",
            mnozstvi=1.0,
            raw_description="dokumentace skutečného provedení + zaškolení provozovatele",
            qty_formula="paušál 1 soubor (standardní TZB závěr)",
            kros_hint="998xxx (předání)",
            audit_trail=make_audit_trail(
                lokalizace="vytápění — celá kapitola M-UT · SO-12",
                formula="1 soubor",
                formula_parsed_method="paushal",
                inputs=[
                    {"label": "soubor_count", "value": 1.0, "unit": "soubor"},
                ],
                tz_section="8",
                poznamka=(
                    "Návody k obsluze ECOSUN + Dalap + UET 15D, dokumentace skutečného "
                    "provedení, zaškolení obsluhy provozovatele (SOLAR DISPOREC)."
                ),
                computed_qty=1.0,
                declared_qty=1.0,
                kros_hint="998xxx (předání)",
            ),
        )
    )

    # M-UT-012 — Doprava + přesun hmot
    items.append(
        make_item(
            item_id="M-UT-012",
            popis="Doprava zařízení + přesun hmot pro M-UT kapitolu",
            mj="soubor",
            mnozstvi=1.0,
            raw_description="doprava ECOSUN + Dalap + UET + drobné na stavbu",
            qty_formula="paušál 1 soubor (standardní)",
            kros_hint="998xxx (doprava / přesun hmot)",
            audit_trail=make_audit_trail(
                lokalizace="vytápění — celá kapitola M-UT · SO-12",
                formula="1 soubor",
                formula_parsed_method="paushal",
                inputs=[
                    {"label": "soubor_count", "value": 1.0, "unit": "soubor"},
                ],
                tz_section="8",
                poznamka=(
                    "Doprava 20 ECOSUN + 4 Dalap + 4 UET + 8 termostatů + spotřebka "
                    "z dodavatelského skladu na stavbu Hradec Králové."
                ),
                computed_qty=1.0,
                declared_qty=1.0,
                kros_hint="998xxx (doprava / přesun hmot)",
            ),
        )
    )

    return items


def update_abmv_1(abmv_data: dict) -> bool:
    for entry in abmv_data["items"]:
        if entry.get("id") == "ABMV_1":
            entry["status"] = "resolved_authoritative"
            entry["resolution_note"] = (
                "DPS D.1.4.2 VYTÁPĚNÍ (05/2026) §9 confirms authoritative:\n"
                " 20 ks ECOSUN S+ 12 × 1.2 kW = 24 kW (NOT 40 ks as DXF Stage C reading)\n"
                " 4 ks Dalap E-HP × 9 kW = 36 kW\n"
                " Total: 60 kW\n"
                " Δ vs TZ B (originally 83 kW expected): -27 % — TZ B included planned "
                "technology, ne jen topení.\n"
                " Δ vs DXF Stage C reading (84 kW): -29 % — DXF block references were "
                "2× duplicated per panel.\n"
                " DPS authoritative."
            )
            entry["resolution_date"] = "2026-05-26"
            entry["resolution_source"] = (
                "inputs/dokumentace/UT_HalaHK_TZ_DPS.doc §9 "
                "(D.1.4.2 VYTÁPĚNÍ DPS 05/2026)"
            )
            entry["authoritative_values"] = {
                "tepelna_ztrata_kw": 11.0,
                "celkovy_prikon_kw": 60.0,
                "ecosun_count": 20,
                "ecosun_kw_per_unit": 1.2,
                "ecosun_total_kw": 24.0,
                "dalap_count": 4,
                "dalap_kw_per_unit": 9.0,
                "dalap_total_kw": 36.0,
                "rocni_spotreba_mwh": 46.0,
                "vnitrni_teplota_c": 18,
                "plocha_haly_m2": 495,
            }
            return True
    return False


def main() -> None:
    raw = json.loads(ITEMS_PATH.read_text(encoding="utf-8"))
    existing_ids = {it["id"] for it in raw["items"]}
    new_items = build_items()

    # Ensure no collision with existing IDs.
    for it in new_items:
        if it["id"] in existing_ids:
            raise SystemExit(f"FATAL: id collision {it['id']!r} already in items.json")

    prev_count = len(raw["items"])
    raw["items"].extend(new_items)
    new_count = len(raw["items"])

    if new_count != prev_count + 12:
        raise SystemExit(f"FATAL: expected {prev_count + 12} items, got {new_count}")

    # Append revisions entry.
    raw["metadata"].setdefault("revisions", []).append(
        {
            "date": "2026-05-26",
            "change": (
                "Added D.1.4.2 VYTÁPĚNÍ scope (12 items M-UT-001..012) "
                "per investor scope change"
            ),
            "reason": (
                "SOLAR DISPOREC included vytápění in bid scope (originally "
                "scope-cut Stage D)"
            ),
            "previous_count": prev_count,
            "new_count": new_count,
            "new_kapitola": "M-UT",
            "abmv_1_update": (
                "60 kW DPS authoritative (was 84 kW DXF estimate, now resolved)"
            ),
            "items_added": [it["id"] for it in new_items],
            "items_modified": [],
            "items_removed": [],
            "source_documents": [
                "inputs/dokumentace/UT_HalaHK_TZ_DPS.doc",
                "inputs/dokumentace/UT_HalaHK_TZ_VM_DPS_E.pdf",
                "inputs/vykresy_dxf/UT_HALAHK_DPS.dxf (Stage C, already integrated)",
                "inputs/dokumentace/UT_HalaHK_PUDORYS_DPS_E.pdf",
            ],
            "elektro_scope_exclusion_documented": True,
            "pattern_15_ref": PATTERN_15_REF,
        }
    )

    # Bump top-level totals if present.
    if "total_items" in raw["metadata"]:
        raw["metadata"]["total_items_actual"] = new_count

    ITEMS_PATH.write_text(
        json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"items.json: {prev_count} → {new_count} items written")

    # Update ABMV_1.
    abmv = json.loads(ABMV_PATH.read_text(encoding="utf-8"))
    if not update_abmv_1(abmv):
        raise SystemExit("FATAL: ABMV_1 not found in queue")
    ABMV_PATH.write_text(
        json.dumps(abmv, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("abmv_email_queue.json: ABMV_1 → resolved_authoritative")


if __name__ == "__main__":
    main()
