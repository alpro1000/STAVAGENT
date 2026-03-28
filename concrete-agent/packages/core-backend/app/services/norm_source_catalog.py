"""
Normative Source Catalog — definitions of all 15 external sources.

Each source has: code, URL, priority, scraping strategy, document types.
Used by norm_audit_service.py to drive the gap analysis.

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-28
"""

from app.models.audit_schemas import (
    DocType,
    NormSource,
    SourcePriority,
)

# ---------------------------------------------------------------------------
# All sources, ordered by priority
# ---------------------------------------------------------------------------

NORM_SOURCES: dict[str, NormSource] = {
    # ═══════ ★★★ HIGH PRIORITY ═══════

    "sz": NormSource(
        source_code="sz",
        name="Správa železnic — vnitřní předpisy",
        url="https://www.spravazeleznic.cz/o-nas/vnitrni-predpisy-spravy-zeleznic/dokumenty-a-predpisy",
        description="TKP 1–33, Předpisy S-řady (S1–S6), VTP, TNŽ, Metodické pokyny M20/MP*, Směrnice SŽ/SŽDC",
        priority=SourcePriority.HIGH,
        doc_types=[DocType.TKP, DocType.VTP, DocType.PREDPIS, DocType.METODIKA],
        oblasti=["koleje", "mosty"],
        scraper_implemented=True,
    ),

    "pjpk_tp": NormSource(
        source_code="pjpk_tp",
        name="ŘSD/PJPK — Technické podmínky (TP)",
        url="https://pjpk.rsd.cz/technicke-podminky-tp/",
        description="Celý seznam platných TP — TP 70, TP 82, TP 83, TP 96, TP 102, TP 104, TP 114, TP 133, TP 170, TP 200, TP 203 atd.",
        priority=SourcePriority.HIGH,
        doc_types=[DocType.TP],
        oblasti=["silnice", "mosty"],
        scraper_implemented=True,
    ),

    "pjpk_tkp": NormSource(
        source_code="pjpk_tkp",
        name="ŘSD/PJPK — TKP staveb PK",
        url="https://pjpk.rsd.cz/technicke-kvalitativni-podminky-staveb-tkp/",
        description="Všechny kapitoly TKP pro pozemní komunikace ve formátu PDF",
        priority=SourcePriority.HIGH,
        doc_types=[DocType.TKP],
        oblasti=["silnice", "mosty"],
        scraper_implemented=True,
    ),

    "mmr_pravo": NormSource(
        source_code="mmr_pravo",
        name="MMR — stavební právo a legislativa",
        url="https://www.mmr.gov.cz/cs/ministerstvo/stavebni-pravo/pravo-a-legislativa/prehled-platnych-pravnich-predpisu/prehled-platnych-pravnich-predpisu-ve-stavebnim-pravu",
        description="Zákony a vyhlášky: 283/2021, 266/1994, 22/1997, 134/2016, vyhláška 146/2024 atd.",
        priority=SourcePriority.HIGH,
        doc_types=[DocType.ZAKON],
        oblasti=["zákony"],
        scraper_implemented=True,
    ),

    "mmr_csn": NormSource(
        source_code="mmr_csn",
        name="MMR — závazné normy ČSN",
        url="https://mmr.gov.cz/cs/ministerstvo/stavebni-pravo/pravo-a-legislativa/novy-stavebni-zakon/normy-csn",
        description="Oficiální seznam ČSN závazných dle vyhlášky č. 146/2024 Sb.",
        priority=SourcePriority.HIGH,
        doc_types=[DocType.NORMA],
        oblasti=["beton", "mosty", "silnice", "občanská"],
        scraper_implemented=True,
    ),

    "rsd_data": NormSource(
        source_code="rsd_data",
        name="ŘSD — datové předpisy (XC4)",
        url="https://rsd.cz/technicke-dokumenty/datove-predpisy",
        description="XC4 (digitální soupisy prací), B1, C4 a další datové předpisy",
        priority=SourcePriority.HIGH,
        doc_types=[DocType.DATOVY_PREDPIS],
        oblasti=["silnice"],
        scraper_implemented=True,
    ),

    "zakonyprolidi": NormSource(
        source_code="zakonyprolidi",
        name="Zákony pro lidi — aktuální znění zákonů",
        url="https://www.zakonyprolidi.cz/",
        description="Konsolidované znění zákonů 283/2021, 266/1994, 134/2016, 22/1997",
        priority=SourcePriority.HIGH,
        doc_types=[DocType.ZAKON],
        oblasti=["zákony"],
        is_signal_only=True,
        scraper_implemented=True,
    ),

    # ═══════ ★★ MEDIUM PRIORITY ═══════

    "pjpk_vl": NormSource(
        source_code="pjpk_vl",
        name="ŘSD/PJPK — Vzorové listy",
        url="https://pjpk.rsd.cz/vzorove-listy/",
        description="Vzorové listy staveb pozemních komunikací",
        priority=SourcePriority.MEDIUM,
        doc_types=[DocType.TP],
        oblasti=["silnice"],
        scraper_implemented=True,
    ),

    "rsd_smernice": NormSource(
        source_code="rsd_smernice",
        name="ŘSD — Směrnice a pokyny pro výstavbu",
        url="https://www.rsd.cz/technicke-dokumenty/smernice-a-pokyny-pro-vystavbu",
        description="Směrnice MD, pokyny ŘSD pro projektování a výstavbu",
        priority=SourcePriority.MEDIUM,
        doc_types=[DocType.METODIKA, DocType.PREDPIS],
        oblasti=["silnice"],
        scraper_implemented=True,
    ),

    "rsd_ppk": NormSource(
        source_code="rsd_ppk",
        name="ŘSD — PPK",
        url="https://www.rsd.cz/technicke-dokumenty/ppk-a-dopravni-znaceni",
        description="PPK soubory — standardy ŘSD pro opakující se prvky staveb",
        priority=SourcePriority.MEDIUM,
        doc_types=[DocType.PREDPIS],
        oblasti=["silnice"],
        scraper_implemented=True,
    ),

    "agentura_cas": NormSource(
        source_code="agentura_cas",
        name="Agentura ČAS — bezplatný přístup k ČSN",
        url="https://agenturacas.gov.cz/",
        description="Seznam ČSN dostupných zdarma. Signální zdroj pro detekci nových verzí.",
        priority=SourcePriority.MEDIUM,
        doc_types=[DocType.NORMA],
        oblasti=["beton", "mosty", "silnice", "občanská"],
        is_signal_only=True,
        scraper_implemented=True,
    ),

    "unmz": NormSource(
        source_code="unmz",
        name="ÚNMZ — aktualizace norem",
        url="https://www.unmz.cz/",
        description="Oznámení o vydání nebo zrušení norem relevantních pro stavebnictví",
        priority=SourcePriority.MEDIUM,
        doc_types=[DocType.NORMA],
        oblasti=["beton", "mosty", "občanská"],
        is_signal_only=True,
        scraper_implemented=True,
    ),

    "ckait": NormSource(
        source_code="ckait",
        name="ČKAIT — standardy pro projektanty",
        url="https://www.ckait.cz/",
        description="Standardy inženýrských služeb, doporučené postupy pro projektování",
        priority=SourcePriority.MEDIUM,
        doc_types=[DocType.METODIKA],
        oblasti=["občanská"],
        scraper_implemented=True,
    ),

    "psp_sbirka": NormSource(
        source_code="psp_sbirka",
        name="PSP — Sbírka zákonů ČR",
        url="https://www.psp.cz/sqw/sbirka.sqw",
        description="Originální text zákonů a vyhlášek ve formátu PDF přímo ze Sbírky zákonů",
        priority=SourcePriority.MEDIUM,
        doc_types=[DocType.ZAKON],
        oblasti=["zákony"],
        is_signal_only=True,
        scraper_implemented=False,
    ),

    # ═══════ ★ LOW PRIORITY ═══════

    "rsd_metodiky": NormSource(
        source_code="rsd_metodiky",
        name="ŘSD — Metodiky ŘSD ČR",
        url="https://www.rsd.cz/technicke-dokumenty/metodiky-rsd-cr",
        description="Interní metodiky pro projektování, realizaci, měření",
        priority=SourcePriority.LOW,
        doc_types=[DocType.METODIKA],
        oblasti=["silnice"],
        scraper_implemented=True,
    ),
}


def get_sources_by_priority(min_priority: int = 1) -> list[NormSource]:
    """Return sources filtered by minimum priority, sorted priority DESC."""
    return sorted(
        [s for s in NORM_SOURCES.values() if s.priority.value >= min_priority],
        key=lambda s: s.priority.value,
        reverse=True,
    )


def get_source(code: str) -> NormSource | None:
    return NORM_SOURCES.get(code)
