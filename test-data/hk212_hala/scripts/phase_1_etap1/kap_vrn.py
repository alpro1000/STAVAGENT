"""Kapitola VRN — Vedlejší rozpočtové náklady.

Per task spec §4.10: 15-20 items. Inspiration z Rožmitál SOL precedent (12
VRN položek) extended o stroje-related VRN (energetická bilance ABMV_1,
vytyčení sítí — situace má 8-12 správců).

Standard VRN URS prefix: 005xxx.
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
        items.append(build_item(seq=s, kapitola="VRN", **kw))

    # Zařízení staveniště (předpoklad výstavby 4 měsíce)
    delka_stavby_mesicu = 4

    add(
        popis="Zařízení staveniště — buňka kancelář stavbyvedoucího + technika",
        mj="měsíc", mnozstvi=delka_stavby_mesicu,
        qty_formula=f"{delka_stavby_mesicu} měsíců × 1 ks",
        source="Rožmitál precedent + standardní VRN",
        raw_description="ZS buňka kancelář",
    )
    add(
        popis="Zařízení staveniště — buňka sociální / šatna / WC",
        mj="měsíc", mnozstvi=delka_stavby_mesicu,
        qty_formula=f"{delka_stavby_mesicu} měsíců × 1 ks",
        source="standardní VRN BOZP",
        raw_description="ZS sociální buňka",
    )
    add(
        popis="Zařízení staveniště — buňka sklad materiálu + nářadí",
        mj="měsíc", mnozstvi=delka_stavby_mesicu,
        qty_formula=f"{delka_stavby_mesicu} měsíců × 1 ks",
        source="standardní VRN",
        raw_description="ZS skladovací buňka",
    )
    add(
        popis="Oplocení staveniště — provizorní, výška 2 m, vstupní brána",
        mj="bm", mnozstvi=150.0,
        qty_formula="placeholder ~150 bm (perimetr staveniště + pomocné plochy)",
        source="ČSN požadavek na ohraničení stavby",
        raw_description="oplocení staveniště provizorní",
        completeness=0.75,
    )
    add(
        popis="Vodovodní přípojka pro stavbu — vytvoření + měření spotřeby",
        mj="paušál", mnozstvi=1.0,
        qty_formula="paušál",
        source="standardní VRN",
        raw_description="vodovodní přípojka stavby",
    )
    add(
        popis="Elektrická přípojka pro stavbu — staveništní rozvaděč + měření",
        mj="paušál", mnozstvi=1.0,
        qty_formula="paušál",
        source="standardní VRN",
        raw_description="el. přípojka stavby",
    )
    add(
        popis="WC mobilní pro pracovníky — 2 ks",
        mj="měsíc", mnozstvi=delka_stavby_mesicu * 2,
        qty_formula=f"2 ks × {delka_stavby_mesicu} měsíců",
        source="standardní BOZP",
        raw_description="WC mobilní",
    )
    add(
        popis="BOZP koordinace na stavbě — koordinátor BOZP průběžně",
        mj="měsíc", mnozstvi=delka_stavby_mesicu,
        qty_formula=f"{delka_stavby_mesicu} měsíců",
        source="zákon 309/2006 Sb. + zákon 591/2006 Sb.",
        raw_description="BOZP koordinace",
    )
    add(
        popis="Plán BOZP + dokumentace bezpečnosti práce",
        mj="paušál", mnozstvi=1.0,
        qty_formula="paušál",
        source="zákon 309/2006 Sb.",
        raw_description="plán BOZP",
    )
    add(
        popis="Pojištění stavby + odpovědnostní pojistka",
        mj="paušál", mnozstvi=1.0,
        qty_formula="paušál",
        source="standardní VRN",
        raw_description="pojištění stavby",
    )

    # Odpady (zákon 541/2020 Sb.)
    add(
        popis="Likvidace odpadů kategorie O (běžný) — kontejner + odvoz + skládkovné",
        mj="m³", mnozstvi=30.0,
        qty_formula="placeholder ~30 m³ stavebního odpadu kat. O",
        source="zákon 541/2020 Sb. odpady",
        raw_description="odpady kategorie O",
        completeness=0.70,
    )
    add(
        popis="Likvidace odpadů kategorie N (nebezpečné — barvy, oleje, tmely)",
        mj="m³", mnozstvi=2.0,
        qty_formula="placeholder ~2 m³ kat. N",
        source="zákon 541/2020 Sb. + ČSN",
        raw_description="odpady kategorie N",
        completeness=0.70,
    )

    # Doprava + geodet
    add(
        popis="Doprava materiálu na stavbu vodorovně — paušál pro veškerou montáž",
        mj="t·km", mnozstvi=1500.0,
        qty_formula="placeholder ~1500 t·km (30 t materiálů × 50 km)",
        source="standardní VRN doprava",
        raw_description="doprava materiálu paušál",
        completeness=0.70,
    )
    add(
        popis="Geodetické zaměření před zahájením stavby — vytýčení",
        mj="paušál", mnozstvi=1.0,
        qty_formula="paušál (Rožmitál URS 00511 R)",
        source="Rožmitál precedent 00511 R + standardní VRN",
        raw_description="geodetické zaměření vytýčení",
    )
    add(
        popis="Geodetické zaměření skutečného provedení (DSPS) — po dokončení stavby",
        mj="paušál", mnozstvi=1.0,
        qty_formula="paušál",
        source="standardní VRN DSPS",
        raw_description="geodetické zaměření DSPS",
    )

    # Vyjádření a vytýčení sítí
    add(
        popis="Vyjádření správců sítí — komplet pro 8-12 sítí (RWE/CETIN/ČEZ/Opatovice/Pošta/atd.)",
        mj="kpl", mnozstvi=1.0,
        qty_formula="1 kpl pro všech 8-12 správců sítí (per RE-RUN §6)",
        source="C3 situace + RE-RUN §6 externí sítě (10 sítí přes pozemek)",
        raw_description="vyjádření správců sítí",
    )
    add(
        popis="Vytýčení stávajících sítí na povrchu před zahájením výkopů",
        mj="bm", mnozstvi=200.0,
        qty_formula="placeholder ~200 bm trasování sítí na pozemku",
        source="RE-RUN §6 externí sítě + povinné vytýčení",
        raw_description="vytýčení stávajících sítí",
        completeness=0.75,
    )

    # Předávací protokoly + kolaudace
    add(
        popis="Předávací protokoly + dokumentace skutečného provedení (DSPS)",
        mj="paušál", mnozstvi=1.0,
        qty_formula="paušál",
        source="standardní VRN DSPS",
        raw_description="předávací protokoly DSPS",
    )
    add(
        popis="Kolaudační řízení — příprava + účast na jednání + revize dokumentace",
        mj="paušál", mnozstvi=1.0,
        qty_formula="paušál",
        source="zákon 183/2006 Sb. stavební + RE-RUN",
        raw_description="kolaudační řízení",
    )

    # Revize (povinné)
    add(
        popis="Revize elektroinstalace + protokol",
        mj="paušál", mnozstvi=1.0,
        qty_formula="paušál (Rožmitál 00523 R precedent)",
        source="Rožmitál 00523 R + ČSN 33 1500",
        raw_description="revize elektro",
    )
    add(
        popis="Revize hydrantového systému + tlaková zkouška",
        mj="paušál", mnozstvi=1.0,
        qty_formula="paušál",
        source="ČSN 73 0873 + PBŘ §1",
        raw_description="revize hydrant",
    )
    add(
        popis="Revize hromosvodu / LPS — měření ekvipotenciality, zemniče, svody",
        mj="paušál", mnozstvi=1.0,
        qty_formula="paušál",
        source="ČSN EN 62305 + PBŘ",
        raw_description="revize LPS",
    )

    return items
