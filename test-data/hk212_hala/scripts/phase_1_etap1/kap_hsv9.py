"""Kapitola HSV-9 — Vodorovné dopravy a pomocné lešení.

Per task spec §4.4: 4-6 items.
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
        items.append(build_item(seq=s, kapitola="HSV-9", **kw))

    add(
        popis="Přesun hmot HSV vodorovně — beton, výztuž, ocel, klempířina",
        mj="t·km", mnozstvi=200.0,
        qty_formula="placeholder 200 t·km (in-site přesuny, default)",
        source="ČSN přesun hmot HSV",
        raw_description="přesun hmot HSV vodorovně",
        completeness=0.75,
    )
    add(
        popis="Pomocné lešení pro montáž ocelové konstrukce, výška do 6 m",
        mj="m³", mnozstvi=200.0,
        qty_formula="placeholder ~200 m³ prostorové lešení pro halu 28×19×6 m",
        source="standardní lešení pro montáž OK",
        raw_description="pomocné lešení OK",
        completeness=0.70,
    )
    add(
        popis="Demontáž pomocného lešení po dokončení montáže",
        mj="m³", mnozstvi=200.0,
        qty_formula="= pomocné lešení",
        source="standardní pár",
        raw_description="demontáž pomocného lešení",
        completeness=0.70,
    )
    add(
        popis="Pomocné lešení pro montáž opláštění (Kingspan) a klempířiny — pojízdné",
        mj="m³", mnozstvi=120.0,
        qty_formula="placeholder ~120 m³ pojízdné lešení pro obvodový plášť",
        source="standardní lešení pro fasádu",
        raw_description="pomocné lešení fasáda",
        completeness=0.70,
    )

    return items
