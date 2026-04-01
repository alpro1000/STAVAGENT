"""
Seed test data for calculator suggestions.

Provides realistic extraction results for a bridge project SO-203
to enable development and testing without real document uploads.

Called on startup via seed_test_data().

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-04-01
"""

from app.services.calculator_suggestions import store_project_facts

# Test project portal_project_id — use a deterministic value for dev
TEST_PROJECT_ID = "test-so203-bridge"


def seed_test_data():
    """Seed extraction results for test project SO-203 bridge."""

    facts = [
        # ── Document 1: TZ Statika (D.1.2) ──
        {
            "document_name": "TZ Statika D.1.2 — Nosná konstrukce mostu SO-203",
            "building_object": "SO-203",
            "source_type": "regex",
            "extractions": {
                "base_construction": {
                    "concrete_class": "C40/50",
                    "exposure_classes": "XD1+XF2",
                    "steel_grade": "B500B",
                },
            },
            "raw_text": (
                "Nosná konstrukce mostu SO-203 bude provedena z předpjatého "
                "betonu třídy C40/50 v prostředí XD1+XF2. "
                "Konzistence betonu S4 nebo samozhutnitelný SCC dle požadavku TDS. "
                "Minimální krycí vrstva výztuže 50 mm. "
                "Celkový objem nosné konstrukce 1386,7 m³. "
                "Beton musí splňovat požadavky ČSN EN 206+A2 a TKP 18. "
                "Konstrukční ocel B500B dle ČSN EN 10080. "
                "Předpínací výztuž Y1860S7 — lana 15,7 mm. "
                "Požadavek na pohledový beton třídy PB2 na vnějších plochách."
            ),
            "pages": {
                "concrete_class": 12,
                "exposure_classes": 14,
                "steel_grade": 15,
            },
        },

        # ── Document 2: TZ Inženýrské objekty ──
        {
            "document_name": "TZ Inženýrské objekty — SO-203 Most přes údolí",
            "building_object": "SO-203",
            "source_type": "regex",
            "extractions": {
                "base_construction": {
                    "concrete_class": "C40/50",
                },
                "most": {
                    "rozpeti_m": 85,
                    "zatizitelnost_t": 48,
                },
            },
            "raw_text": (
                "Most SO-203 — jednopruhový most přes údolí potoka, "
                "délka 85 m, nosná konstrukce z předpjatého betonu C40/50. "
                "Základy pilířů C30/37 v prostředí XC2+XA1. "
                "Pilíře — dříky z betonu C35/45, stupeň prostředí XC4+XF1. "
                "Římsy z betonu C30/37 XF4 s vozduchovou přísadou. "
                "Opěry z betonu C25/30, stupeň prostředí XC2. "
                "Přechodové desky z betonu C25/30 XC2. "
                "Masivní betonáž základů — požadavek na kontrolu teploty."
            ),
            "pages": {
                "concrete_class": 8,
            },
        },

        # ── Document 3: Výkaz výměr (Bill of Quantities) ──
        {
            "document_name": "Výkaz výměr — SO-203",
            "building_object": "SO-203",
            "source_type": "regex",
            "extractions": {},
            "raw_text": (
                "NOSNÁ KONSTRUKCE MOSTU — předpjatý beton C40/50: 1 386,7 m³\n"
                "ZÁKLADY PILÍŘŮ — železobeton C30/37: 245,0 m³\n"
                "DŘÍKY PILÍŘŮ — železobeton C35/45: 180,5 m³\n"
                "ŘÍMSY — železobeton C30/37 XF4: 42,8 m³\n"
                "OPĚRY — železobeton C25/30: 310,2 m³\n"
                "PŘECHODOVÉ DESKY — železobeton C25/30: 28,4 m³\n"
                "VÝZTUŽ betonářská B500B: 186,5 t\n"
                "BEDNĚNÍ nosné konstrukce: 2 850 m²\n"
            ),
            "pages": {},
        },

        # ── Document 4: General project requirements (no specific SO) ──
        {
            "document_name": "Souhrnná technická zpráva — Obecné podmínky",
            "building_object": None,  # applies to all SOs
            "source_type": "ai",
            "extractions": {},
            "raw_text": (
                "Stavba bude realizována v období říjen 2026 — květen 2028. "
                "Při zimní betonáži (T < 5°C) je nutno zajistit prohřev "
                "a uteplení po dobu min. 72 hodin. "
                "Všechny nosné betony musí splňovat ČSN EN 206+A2 a ČSN EN 13670. "
                "Maximální teplota čerstvého betonu při ukládání: 30°C. "
                "Minimální teplota čerstvého betonu při ukládání: 10°C."
            ),
            "pages": {},
        },

        # ── Document 5: Facts for a different SO (should be filtered out) ──
        {
            "document_name": "TZ Statika — SO-201 Opěrná zeď",
            "building_object": "SO-201",
            "source_type": "regex",
            "extractions": {
                "base_construction": {
                    "concrete_class": "C25/30",
                    "exposure_classes": "XC2",
                },
            },
            "raw_text": (
                "Opěrná zeď SO-201: beton C25/30, stupeň prostředí XC2. "
                "Objem betonu 180,0 m³."
            ),
            "pages": {
                "concrete_class": 3,
            },
        },
    ]

    store_project_facts(TEST_PROJECT_ID, facts)

    # Also seed a project with conflicting data for testing
    conflicting_facts = [
        {
            "document_name": "TZ Statika — Konflikní projekt",
            "building_object": "SO-301",
            "source_type": "regex",
            "extractions": {
                "base_construction": {
                    "concrete_class": "C30/37",
                },
            },
            "raw_text": "Nosná konstrukce C30/37 v prostředí XD1.",
            "pages": {"concrete_class": 5},
        },
        {
            "document_name": "Výkaz výměr — Konfliktní projekt",
            "building_object": "SO-301",
            "source_type": "regex",
            "extractions": {
                "base_construction": {
                    "concrete_class": "C40/50",
                },
            },
            "raw_text": "NOSNÁ KONSTRUKCE beton C40/50: 500 m³",
            "pages": {"concrete_class": 1},
        },
    ]
    store_project_facts("test-conflict-project", conflicting_facts)

    # Seed a project with insufficient concrete class for exposure
    insufficient_facts = [
        {
            "document_name": "TZ — Nedostatečná třída",
            "building_object": "SO-401",
            "source_type": "regex",
            "extractions": {
                "base_construction": {
                    "concrete_class": "C25/30",
                    "exposure_classes": "XA2",
                },
            },
            "raw_text": "Beton C25/30 v agresivním prostředí XA2. Objem 120 m³.",
            "pages": {"concrete_class": 2, "exposure_classes": 2},
        },
    ]
    store_project_facts("test-insufficient-class", insufficient_facts)
