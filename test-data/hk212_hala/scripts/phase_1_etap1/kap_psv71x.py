"""Kapitola PSV-71x — Hydroizolace soklu.

Per task spec §4.5: 3-5 items. Obvod 95 m × výška svislé hydroizolace 0.3 m
+ horizontální páska na styku obvod-deska.
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
        items.append(build_item(seq=s, kapitola="PSV-71x", **kw))

    obvod = 95.0
    vyska = 0.3

    add(
        popis="Penetrace soklu — penetrační nátěr pod hydroizolaci",
        mj="m²", mnozstvi=obvod * vyska,
        qty_formula=f"{obvod} bm × {vyska} m = {obvod*vyska} m²",
        source="ČSN skladba hydroizolace + RE-RUN §3.2",
        raw_description="penetrace soklu",
    )
    add(
        popis="Hydroizolace svislá soklu — SBS modifikovaný asfaltový pás, natavený",
        mj="m²", mnozstvi=obvod * vyska,
        qty_formula=f"{obvod} bm × {vyska} m = {obvod*vyska} m²",
        source="TZ B + ČSN skladba hydroizolace soklu",
        raw_description="hydroizolace svislá soklu",
    )
    add(
        popis="Hydroizolační lišty rohové + napojení svislé na vodorovnou pásku",
        mj="bm", mnozstvi=obvod,
        qty_formula=f"obvod {obvod} bm",
        source="standardní detail napojení izolace",
        raw_description="lišty hydroizolace",
    )
    add(
        popis="Ochranná vrstva hydroizolace — nopová folie HDPE, š. 0.5 m",
        mj="m²", mnozstvi=obvod * 0.5,
        qty_formula=f"{obvod} bm × 0.5 m",
        source="ČSN ochrana hydroizolace před zásypem",
        raw_description="nopová folie ochrana izolace",
        completeness=0.85,
    )

    return items
