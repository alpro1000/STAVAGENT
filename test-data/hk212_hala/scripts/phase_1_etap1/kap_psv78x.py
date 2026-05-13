"""Kapitola PSV-78x — Klempířina + odvodnění.

Per task spec §4.8: 10-14 items.

Facts (§1):
- Lindab Round Downpipe 150/100 Antique White: 4 ks (working, ABMV_20)
- Wavin Tegra střešní vpusti: 3 ks
- MEA Mearin Plus 3000 NW300 liniový žlab: 1 typ, podél JZ + SZ fasády
- Atikové oplechování titanzinek + lemy
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
        items.append(build_item(seq=s, kapitola="PSV-78x", **kw))

    obvod_strechy = 95.0
    liniovy_zlab = 30.0  # podél JZ + SZ fasády

    add(
        popis="Dodávka Lindab Round Downpipe 150/100 Antique White, vč. kolen a spojek",
        mj="ks", mnozstvi=4.0,
        qty_formula="4 ks (A104 DXF count working, ABMV_20: A101=3 vs A104=4)",
        source="DXF A104 Lindab × 4 + RE-RUN §3.7 klempíř",
        raw_description="Lindab Round Downpipe 150/100",
        vyjasneni_refs=["ABMV_20"],
    )
    add(
        popis="Montáž svodů Lindab — příchytky, kotvení do fasády",
        mj="kpl", mnozstvi=4.0,
        qty_formula="4 kpl (jeden na každý svod)",
        source="standardní pár dodávka+montáž",
        raw_description="montáž Lindab svodů",
        vyjasneni_refs=["ABMV_20"],
    )
    add(
        popis="Wavin Tegra střešní vpust Round Iron Cover + Concrete Ring DN300",
        mj="ks", mnozstvi=3.0,
        qty_formula="3 ks (A101 INSERT Wavin × 3 dle DXF parse)",
        source="DXF A101 INSERT Wavin Tegra × 3 + RE-RUN §3.7",
        raw_description="Wavin Tegra střešní vpust",
    )
    add(
        popis="Montáž střešních vpustí Wavin Tegra — osazení, napojení na svody",
        mj="ks", mnozstvi=3.0,
        qty_formula="= dodávka",
        source="standardní pár",
        raw_description="montáž střešních vpustí",
    )
    add(
        popis="MEA Mearin Plus 3000 NW300 liniový žlab — podél JZ a SZ fasády",
        mj="bm", mnozstvi=liniovy_zlab,
        qty_formula=f"~{liniovy_zlab} bm podél JZ + SZ fasády (RE-RUN §3.7)",
        source="DXF A105 INSERT MEA Mearin + RE-RUN §3.7",
        raw_description="MEA Mearin Plus 3000 NW300",
        completeness=0.85,
    )
    add(
        popis="Mřížka MEA Mearin Plus 3000 + osazovací rám — pochozí provedení",
        mj="bm", mnozstvi=liniovy_zlab,
        qty_formula="= liniový žlab",
        source="standardní vybavení liniového žlabu",
        raw_description="mřížka MEA + rám",
        completeness=0.85,
    )
    add(
        popis="Atikové oplechování titanzinek tl. 0.7 mm, rš 500 mm — po obvodu střechy",
        mj="bm", mnozstvi=obvod_strechy,
        qty_formula=f"obvod střechy {obvod_strechy} bm",
        source="TZ B + standardní detail atiky",
        raw_description="atikové oplechování TiZn",
    )
    add(
        popis="Lemování úžlabí střechy titanzinek — diagonální linie",
        mj="bm", mnozstvi=15.0,
        qty_formula="placeholder ~15 bm (úžlabí pultové střechy 5.25°)",
        source="standardní detail úžlabí",
        raw_description="lemování úžlabí",
        completeness=0.75,
    )
    add(
        popis="Lemování nároží titanzinek — vertikální rohy fasády",
        mj="bm", mnozstvi=4 * 6.3,
        qty_formula="4 nároží × 6.3 m výška",
        source="standardní detail nároží",
        raw_description="lemování nároží",
    )
    add(
        popis="Krytí spár klempířských konstrukcí — silikonový tmel",
        mj="bm", mnozstvi=120.0,
        qty_formula="placeholder ~120 bm (spáry mezi všemi klempířskými prvky)",
        source="standardní detail",
        raw_description="krytí spár klempířských",
        completeness=0.70,
    )
    add(
        popis="Ostatní oplechování — parapety střešních vpustí, lemy prostupů",
        mj="bm", mnozstvi=25.0,
        qty_formula="placeholder ~25 bm (vpusti + prostupy)",
        source="standardní detail",
        raw_description="ostatní oplechování",
        completeness=0.70,
    )
    add(
        popis="Doprava klempířiny + materiálu na stavbu — paušál",
        mj="paušál", mnozstvi=1.0,
        qty_formula="paušál",
        source="standardní VRN klempíř",
        raw_description="doprava klempířiny",
    )

    return items
