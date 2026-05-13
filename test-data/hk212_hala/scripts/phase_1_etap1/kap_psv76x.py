"""Kapitola PSV-76x — Otvory (okna, vrata, dveře).

Per task spec §4.6: 10-14 items.

Facts (§1):
- Okna: 21 ks plast rám 1000×1000 mm, šedá, izol. dvojsklo (V1..V21 v DXF)
- Vrata sekční: 4 ks (3000×4000 working, ABMV_2 šířka 3000 vs 3500)
- Vnější dveře dvoukřídlé: 2 ks 1050×2100
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
        items.append(build_item(seq=s, kapitola="PSV-76x", **kw))

    # ── Okna 21 ks ───────────────────────────────────────────────────────
    add(
        popis="Dodávka okno plastové 1000 × 1000 mm, izol. dvojsklo Ug ≤ 1.1, barva šedá",
        mj="ks", mnozstvi=21.0,
        qty_formula="21 ks (V1..V21 z DXF A101 INSERT OKNO_1k)",
        source="DXF A101 INSERT OKNO_1k × 21 + RE-RUN §3.5 otvory",
        raw_description="okno plast 1000x1000 šedá",
    )
    add(
        popis="Montáž okna plastového do osazovacího otvoru, vč. kotvení a pěny",
        mj="ks", mnozstvi=21.0,
        qty_formula="= dodávka okna",
        source="standardní pár dodávka+montáž",
        raw_description="montáž okna plast",
    )
    add(
        popis="Vnější parapet pozinkovaný plech, š. 200 mm, s krytkami",
        mj="bm", mnozstvi=21 * 1.05,
        qty_formula="21 ks × 1.05 m (šířka okna + přesah)",
        source="standardní vnější parapet pod okno",
        raw_description="parapet pozink vnější",
    )
    add(
        popis="Vnější okenní lemy plastové — rohové + nadokenní",
        mj="bm", mnozstvi=21 * 3.0,
        qty_formula="21 ks × 3 bm (perimetr 3 stran, parapet samostatně)",
        source="standardní detail osazení",
        raw_description="okenní lemy plast",
    )

    # ── Vrata sekční 4 ks ────────────────────────────────────────────────
    add(
        popis="Dodávka sekční vrata 3000 × 4000 mm (š × v) s tepelněizolační výplní, motorická",
        mj="ks", mnozstvi=4.0,
        qty_formula="4 ks (DXF A101 INSERT 'Vrata sekční' = 4)",
        source="DXF A101 + RE-RUN §3.5 + TZ B m.3.2",
        raw_description="vrata sekční 3000×4000 výsuvná",
        vyjasneni_refs=["ABMV_2"],  # 3000 (DXF) vs 3500 (TZ B) šířka
    )
    add(
        popis="Elektrický pohon vrat sekčních s dálkovým ovládáním + nouzové odblokování",
        mj="ks", mnozstvi=4.0,
        qty_formula="4 ks pohon (jeden na každá vrata)",
        source="standardní vybavení sekčních vrat",
        raw_description="el. pohon vrat + dálkové ovl.",
    )
    add(
        popis="Nouzové ruční odblokování vrat sekčních — pro výpadek el.",
        mj="ks", mnozstvi=4.0,
        qty_formula="4 ks ruční odblok",
        source="BOZP požadavek ČSN",
        raw_description="nouzové odblok vrat",
    )
    add(
        popis="Montáž sekčních vrat — osazení do otvoru, ukotvení, nastavení",
        mj="ks", mnozstvi=4.0,
        qty_formula="= dodávka vrat",
        source="standardní pár dodávka+montáž",
        raw_description="montáž vrat sekčních",
    )

    # ── Dveře vnější 2-křídlé 2 ks ───────────────────────────────────────
    add(
        popis="Dodávka vnější dvoukřídlé dveře 1050 × 2100 mm, izol. plnostěnné, klika a zámek",
        mj="ks", mnozstvi=2.0,
        qty_formula="2 ks (DXF A101 INSERT 'Vnější dveře dvoukřídlé')",
        source="DXF A101 + RE-RUN §3.5",
        raw_description="vnější dveře 2-křídlé 1050x2100",
    )
    add(
        popis="Montáž vnějších 2-křídlých dveří — osazení, kotvení, pěna",
        mj="ks", mnozstvi=2.0,
        qty_formula="= dodávka dveří",
        source="standardní pár",
        raw_description="montáž vnějších dveří",
    )
    add(
        popis="Kompletní zámkový systém + klika pro vnější 2-křídlé dveře",
        mj="kpl", mnozstvi=2.0,
        qty_formula="2 kpl",
        source="standardní vybavení dveří",
        raw_description="zámek + klika vnější dveře",
    )
    add(
        popis="Práh + lemování ostění vnějších dveří — pozink plech",
        mj="kpl", mnozstvi=2.0,
        qty_formula="2 kpl",
        source="standardní detail ostění",
        raw_description="práh + lemování dveří",
    )

    return items
