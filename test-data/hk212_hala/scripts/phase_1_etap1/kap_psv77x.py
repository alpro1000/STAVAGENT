"""Kapitola PSV-77x — Podlahy (průmyslová stěrka 495 m²).

Per task spec §4.7: 5-8 items. Working assumption (ABMV_10):
epoxidová nebo PU stěrka 4-5 mm, zatížení 1600 kg/m².
Lokální zesílení podlahy v anchorage zonách strojů (ABMV_3 + ABMV_16).
"""
from __future__ import annotations

from .item_schema import Item
from .kapitola_helpers import build_item


def build_items() -> list[Item]:
    items: list[Item] = []
    s = 0

    def add(**kw):
        nonlocal s
        s += 1
        items.append(build_item(seq=s, kapitola="PSV-77x", **kw))

    plocha = 495.0

    add(
        popis="Penetrace + primer pod průmyslovou stěrku podlahy",
        mj="m²", mnozstvi=plocha,
        qty_formula=f"{plocha} m² (celá plocha podlahy)",
        source="standardní skladba pod stěrku",
        raw_description="penetrace + primer pod stěrku",
    )
    add(
        popis="Průmyslová epoxidová / PU stěrka podlahy tl. 4-5 mm, zatížení 1600 kg/m²",
        mj="m²", mnozstvi=plocha,
        qty_formula=f"{plocha} m²",
        source="TZ B m.podlaha + statika užitné zatížení 16 kN/m²",
        raw_description="EP / PU stěrka 4-5 mm",
        vyjasneni_refs=["ABMV_10"],  # EP vs PU volba — typ stěrky není upřesněn v TZ
    )
    add(
        popis="Lokální zesílení podlahy v anchorage zónách strojů — vyšší tl. stěrky 8 mm",
        mj="m²", mnozstvi=30.0,
        qty_formula="placeholder ~30 m² (3 stroje × ~10 m² každé anchorage zóna)",
        source="A107 kotvící body × cca 10 m² každý + ABMV_3+16 stroje",
        raw_description="lokální zesílení podlahy pod stroji",
        vyjasneni_refs=["ABMV_3", "ABMV_16"],
        status_flag="placeholder_engineering_estimate",
        completeness=0.55,
    )
    add(
        popis="Dilatační lišty podlahy — kovové, řezané spáry á 6 m",
        mj="bm", mnozstvi=60.0,
        qty_formula="placeholder ~60 bm (pole dilatace á 6 m na 495 m² ploše)",
        source="ČSN podlahové dilatace ve velkoplošných podlahách",
        raw_description="dilatační lišty podlahy",
        completeness=0.80,
    )
    add(
        popis="Lemovací úhelníky podlahy — pozink po obvodu stěrky",
        mj="bm", mnozstvi=95.0,
        qty_formula="obvod desky 95 bm",
        source="standardní detail lemu stěrky",
        raw_description="lemovací úhelníky stěrky",
    )
    add(
        popis="Protiskluzový posyp křemičitým pískem — pro PU variantu",
        mj="m²", mnozstvi=plocha,
        qty_formula=f"{plocha} m² (pokud zvolena PU varianta)",
        source="standardní úprava skluznosti R10/R11",
        raw_description="protiskluzový posyp",
        vyjasneni_refs=["ABMV_10"],
        status_flag="working_assumption",
        completeness=0.70,
    )

    return items
