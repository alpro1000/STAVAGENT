"""Kapitola M — Anchorage strojů + bezpečnostní oplocení.

Per task spec §4.9: 5-8 items. **VŠECHNY položky** flag ABMV_3 + ABMV_16
(specifikace strojů nedodaná). Bezp. oplocení dodatečně ABMV_8 ("BUDE
UPŘESNĚNO" v A106 × 3 instances).

Custom items use Rpol-NNN prefix per Rožmitál precedent (urs_status=
'custom_item'). URS catalog match skipped.
"""
from __future__ import annotations

from .item_schema import Item
from .kapitola_helpers import build_item

STROJE_REFS = ["ABMV_3", "ABMV_16"]


def build_items() -> list[Item]:
    items: list[Item] = []
    s = 0

    def add(**kw):
        nonlocal s
        s += 1
        items.append(build_item(seq=s, kapitola="M", custom_rpol=True, **kw))

    add(
        popis="Chemická kotva M20 × 200 mm pro anchorage strojů (DRIFT_E1, DEFRAME, filtrační)",
        mj="ks", mnozstvi=48.0,
        qty_formula="3 stroje × ~16 kotev/stroj = 48 ks (placeholder)",
        source="A107 INSERT kotvící body — typ + počet UPŘESNIT (ABMV_3, ABMV_16)",
        raw_description="kotvící body strojů — chem.kotva M20",
        vyjasneni_refs=STROJE_REFS,
        status_flag="specifikace_pending_strojaru",
        completeness=0.40,
    )
    add(
        popis="Lokální výztuž desky pod stroji — B500B vázaná, dopl. nad rámec KARI",
        mj="kg", mnozstvi=80.0,
        qty_formula="placeholder ~80 kg (3 anchorage zóny × ~25 kg každá)",
        source="statika D.1.2 + standardní dodatečná výztuž v anchorage zónách",
        raw_description="lokální dodatečná výztuž pod stroji",
        vyjasneni_refs=STROJE_REFS,
        status_flag="specifikace_pending_strojaru",
        completeness=0.45,
    )
    add(
        popis="Beton lokálního zesílení podlahy pod stroji C25/30 XC4",
        mj="m³", mnozstvi=4.5,
        qty_formula="3 stroje × 1.5 m³ (zesílená podloží zóna ~10 m² × 0.15 m)",
        source="standardní detail zesílení podlahy pod technologií",
        raw_description="beton zesílení pod stroji",
        vyjasneni_refs=STROJE_REFS,
        status_flag="specifikace_pending_strojaru",
        completeness=0.45,
    )
    add(
        popis="Bezpečnostní oplocení strojů — Troax-type, výška 2.2 m, mřížová síť, panely modulární",
        mj="bm", mnozstvi=80.0,
        qty_formula="placeholder ~80 bm (perimetr 3 strojů × ~25 m každý)",
        source="A106 MTEXT 'BUDE UPŘESNĚNO' × 3 + RE-RUN §3.9",
        raw_description="bezp. oplocení strojů 2.2 m",
        vyjasneni_refs=STROJE_REFS + ["ABMV_8"],
        status_flag="specifikace_pending_strojaru",
        completeness=0.35,
    )
    add(
        popis="Montáž bezp. oplocení + sloupky kotvené do podlahy + branka pro přístup",
        mj="bm", mnozstvi=80.0,
        qty_formula="= dodávka oplocení",
        source="standardní pár",
        raw_description="montáž bezp. oplocení",
        vyjasneni_refs=STROJE_REFS + ["ABMV_8"],
        status_flag="specifikace_pending_strojaru",
        completeness=0.35,
    )
    add(
        popis="Bezpečnostní tabulky + značení — výstrahy, zákazy, BOZP piktogramy",
        mj="kpl", mnozstvi=1.0,
        qty_formula="1 kpl (komplet značení pro 3 stroje)",
        source="ČSN ISO 7010 + BOZP požadavek",
        raw_description="bezp. tabulky + značení",
        vyjasneni_refs=STROJE_REFS,
        status_flag="specifikace_pending_strojaru",
        completeness=0.45,
    )
    add(
        popis="El. připojení strojů — kabel CYKY × přívody + průchodky podlahou",
        mj="kpl", mnozstvi=3.0,
        qty_formula="3 ks (jedno na každý stroj)",
        source="A107 + ABMV_1 (80 kW per stroj) + ABMV_3 specifikace",
        raw_description="el. přívody strojů",
        vyjasneni_refs=STROJE_REFS + ["ABMV_1"],
        status_flag="specifikace_pending_strojaru",
        completeness=0.40,
    )

    return items
