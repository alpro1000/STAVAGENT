"""
ADK Spike — SO-202 input fixture (hardcoded, no field-finder).

Values lifted verbatim from the golden test fixtures
(tests/test_mcp_golden_so202.py + so250b.py) so the flow reaches a real Excel
without any extraction layer. The flow is the measured artefact, not parsing.
"""

# Object-level inputs for detect_object_type (name + charakteristika ONLY).
SO202_OBJECT = {
    "object_code": "SO-202",
    "object_name": "Most na sil. I/6 přes Lomnický potok",
    "charakteristika": "Trvalý dálniční most o třech polích.",
}

# Per-element inputs (drop-in for classify / create_work_breakdown / calculate).
# Concrete classes are the AUTHORITATIVE values from the golden fixture.
SO202_ELEMENTS = [
    {"name": "NK mostovka", "object_code": "SO-202", "volume_m3": 605,
     "concrete_class": "C35/45", "is_prestressed": True, "span_m": 20, "num_spans": 6},
    {"name": "Římsy monolitické", "object_code": "SO-202", "volume_m3": 30,
     "concrete_class": "C30/37"},
    {"name": "Pilíře P2-P3", "object_code": "SO-202", "volume_m3": 20,
     "concrete_class": "C35/45"},
    {"name": "Opěra OP1 — dřík + úložný práh", "object_code": "SO-202", "volume_m3": 55,
     "concrete_class": "C30/37"},
    {"name": "Piloty OP1 Ø900", "object_code": "SO-202", "volume_m3": 50.9,
     "concrete_class": "C30/37"},
]

# ── The ONE injected nuance: a concrete-class contradiction on one element ────
# The pier element ("Pilíře P2-P3") has two disagreeing "sources":
#   - PD / výkres (drawing)         → C35/45   (authoritative per priority)
#   - zjednodušení statiky (simpl.) → C30/37   (a simplification in the calc note)
# The LLM/planner must DECIDE which source wins (it does NOT compute a number).
NUANCE_ELEMENT_NAME = "Pilíře P2-P3"
NUANCE_CONTRADICTION = {
    "field": "concrete_class",
    "element_name": NUANCE_ELEMENT_NAME,
    "candidates": [
        {"value": "C35/45", "source": "PD_vykres", "source_label": "PD / výkres tvaru"},
        {"value": "C30/37", "source": "statika_zjednoduseni",
         "source_label": "zjednodušení statiky (poznámka výpočtu)"},
    ],
}
