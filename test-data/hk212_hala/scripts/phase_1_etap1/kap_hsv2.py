"""Kapitola HSV-2 — Základy + železobetonová deska.

Per task spec §4.2: 14-18 items. Granularity per Rožmitál precedent:
4-5 položek per ŽB element (beton + bednění zřízení + bednění odstr + výztuž
+ přesun hmot per kapitola).

Facts (§1):
- 14 patek rámových 1.5×1.5×(2×0.6) m, dvoustupňové C16/20 XC0
- 8 patek štítových 0.8×0.8×(0.2+0.6) m, dvoustupňové C16/20 XC0
- 1 atypický základ / pilota variant Ø800/L=8m C25/30 XC4
- Krátké pasy mezi patkami C16/20 XC0
- Deska 495 m² × 0.2 m C25/30 XC4 + KARI Ø8 100×100 oba povrchy + B500B
- Hydroizolace pod deskou + svislá soklu
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
        items.append(build_item(seq=s, kapitola="HSV-2", **kw))

    # ── Patky rámové (14 ks, dvoustupňové) ───────────────────────────────
    add(
        popis="Beton patek rámových C16/20 XC0 prostý, dvoustupňové",
        mj="m³", mnozstvi=14 * 1.35,
        qty_formula="14 ks × 1.5 × 1.5 × 0.6 m = 18.9 m³",
        source="A105 + statika D.1.2 + RE-RUN §3.3 + §3.4",
        raw_description="patky rámové C16/20",
    )
    add(
        popis="Bednění patek rámových dvoustupňových — zřízení",
        mj="m²", mnozstvi=14 * 7.2,
        qty_formula="14 ks × 4 × (1.5 × 0.6 × 2 stupně) — obvodový plech / dřevo",
        source="A105 + skladba dvoustupňová",
        raw_description="bednění patek rámových zřízení",
    )
    add(
        popis="Bednění patek rámových dvoustupňových — odstranění",
        mj="m²", mnozstvi=14 * 7.2,
        qty_formula="= bednění zřízení",
        source="standardní pár",
        raw_description="bednění patek rámových odstranění",
    )

    # ── Patky štítové (8 ks) ─────────────────────────────────────────────
    add(
        popis="Beton patek štítových C16/20 XC0 prostý, dvoustupňové",
        mj="m³", mnozstvi=8 * 0.512,
        qty_formula="8 ks × 0.8 × 0.8 × 0.8 m = 4.10 m³",
        source="A105 + statika D.1.2 + RE-RUN §3.3 sloupy HEA 200 = 8 ks",
        raw_description="patky štítové C16/20",
    )
    add(
        popis="Bednění patek štítových — zřízení",
        mj="m²", mnozstvi=8 * 2.6,
        qty_formula="8 ks × (0.8 × 0.8 × obvod 3.2 m × 2 stupně) — zjednodušeně",
        source="A105 layout",
        raw_description="bednění patek štítových zřízení",
    )
    add(
        popis="Bednění patek štítových — odstranění",
        mj="m²", mnozstvi=8 * 2.6,
        qty_formula="= bednění zřízení",
        source="standardní pár",
        raw_description="bednění patek štítových odstranění",
    )

    # ── Pasy mezi patkami ─────────────────────────────────────────────────
    add(
        popis="Beton krátkých pasů v rozích a propojení mezi patkami C16/20 XC0",
        mj="m³", mnozstvi=30 * 0.4 * 0.6,
        qty_formula="~30 bm × 0.4 × 0.6 m = 7.2 m³",
        source="A105 layout estimate",
        raw_description="pasy C16/20",
        completeness=0.80,
    )
    add(
        popis="Bednění pasů — zřízení",
        mj="m²", mnozstvi=30 * 1.2,
        qty_formula="~30 bm × 2 × 0.6 m boční plocha = 36 m²",
        source="A105 layout",
        raw_description="bednění pasů zřízení",
        completeness=0.80,
    )

    # ── Výztuž patek a pasů ──────────────────────────────────────────────
    add(
        popis="Výztuž patek a pasů ze svařovaných sítí + vázaná B500B",
        mj="kg", mnozstvi=600.0,
        qty_formula="placeholder 600 kg per RE-RUN §3.4 statika dimensioning",
        source="statika D.1.2 + RE-RUN §3.4 B500B",
        raw_description="výztuž patek + pasů B500B",
        completeness=0.75,
    )

    # ── Atypický základ / pilota varianta ────────────────────────────────
    add(
        popis="VARIANTA — pilota Ø800 / L=8 m C25/30 XC4 vrtná",
        mj="ks", mnozstvi=1.0,
        qty_formula="1 ks pilota Ø800 × 8 m délka",
        source="A105 MTEXT 'ATYPICKÝ ZÁKLAD ... PILOTA Ø800 L=8,0m'",
        raw_description="pilota Ø800 / L=8m variant",
        vyjasneni_refs=["ABMV_11"],
        status_flag="variant_pending_IGP",
        completeness=0.65,
    )
    add(
        popis="VARIANTA — vrtání piloty Ø800 do hor. tř. 3-4",
        mj="bm", mnozstvi=8.0,
        qty_formula="1 ks × 8 m délka",
        source="A105 + variant pilota L=8m",
        raw_description="vrtání piloty",
        vyjasneni_refs=["ABMV_11"],
        status_flag="variant_pending_IGP",
        completeness=0.65,
    )
    add(
        popis="VARIANTA — výztuž piloty 8× R25 podélná + třmínky Ø10 á 200 B500B",
        mj="kg", mnozstvi=380.0,
        qty_formula="8 ks × 3.86 kg/m × 8 m + třmínky placeholder",
        source="statika D.1.2 + A105 výztuž piloty",
        raw_description="výztuž piloty R25 + třmínky",
        vyjasneni_refs=["ABMV_11"],
        status_flag="variant_pending_IGP",
        completeness=0.70,
    )

    # ── Železobetonová deska 495 m² × 0.2 m C25/30 XC4 ───────────────────
    add(
        popis="Beton podlahové desky C25/30 XC4, tl. 200 mm — strojně rovnaný povrch",
        mj="m³", mnozstvi=495 * 0.2,
        qty_formula="495 m² × 0.2 m = 99 m³",
        source="TZ B + statika D.1.2 + RE-RUN §3.4 deska C25/30",
        raw_description="deska C25/30 XC4",
    )
    add(
        popis="Bednění obvodové desky — zřízení",
        mj="bm", mnozstvi=95.0,
        qty_formula="obvod desky ~95 bm",
        source="A101 půdorys + RE-RUN §3.2",
        raw_description="bednění desky obvodové",
    )
    add(
        popis="Výztuž desky KARI síť Ø8 oka 100×100 mm B500B — horní vrstva",
        mj="kg", mnozstvi=495 * 3.95,
        qty_formula="495 m² × 3.95 kg/m² (KARI Ø8 100×100)",
        source="statika D.1.2 + RE-RUN §3.4 KARI horní + dolní",
        raw_description="KARI Ø8 100×100 horní",
    )
    add(
        popis="Výztuž desky KARI síť Ø8 oka 100×100 mm B500B — dolní vrstva",
        mj="kg", mnozstvi=495 * 3.95,
        qty_formula="= horní vrstva",
        source="statika D.1.2 + RE-RUN §3.4",
        raw_description="KARI Ø8 100×100 dolní",
    )
    add(
        popis="Distanční podložky výztuže desky — plast / beton, krytí 30 mm",
        mj="ks", mnozstvi=2475.0,
        qty_formula="495 m² × 5 ks/m² (typická hustota)",
        source="ČSN krytí 30 mm dle XC4",
        raw_description="distanční podložky KARI",
    )

    # ── Hydroizolace ─────────────────────────────────────────────────────
    add(
        popis="Hydroizolace plošná pod podlahovou desku — 1× SBS modifikovaný asfaltový pás",
        mj="m²", mnozstvi=495.0,
        qty_formula="= plocha desky",
        source="TZ B + standardní skladba pod desku",
        raw_description="hydroizolace pod desku",
    )

    return items
