"""UWO vocabulary — Gate 2 hermetic tests (loader + invariants + fixture smoke).

No network, no DB, no LLM. Reads the repo YAML directly.

Three test families:
  1. Invariants — the shared validator returns zero violations on the real
     file, and actually FIRES on a broken copy (validator is not a rubber
     stamp).
  2. Market-proofing — the ratified check: adding a German label/keyword is
     filling an empty slot, NEVER a schema migration (rule 1 of the header).
  3. Fixture smoke (Alexander, domain review 2026-07-14) — the vocabulary
     must cover its own acceptance corpus BEFORE the HK212 harness: every
     work named by the three golden fixtures maps to an existing code (or an
     honestly-declared domain), never "no code at all".
"""

import copy
from pathlib import Path

import pytest
import yaml

from app.services.uwo_vocabulary import (
    BUILT_ATOM_PREFIXES,
    load_vocabulary,
    get_code,
    is_covered,
    domain_of,
    validate_vocabulary,
    _vocabulary_path,
)


@pytest.fixture(scope="module")
def raw() -> dict:
    return yaml.safe_load(Path(_vocabulary_path()).read_text(encoding="utf-8"))


# ── 1. Invariants ────────────────────────────────────────────────────────────

def test_yaml_exists_and_versioned(raw):
    assert raw["schema_version"] == 1
    assert str(raw["vocabulary_version"]).startswith("v1")


def test_validator_returns_zero_violations(raw):
    assert validate_vocabulary(raw) == []


def test_validator_actually_fires_on_broken_copies(raw):
    # Not a rubber stamp: each broken copy must produce a violation.
    broken = copy.deepcopy(raw)
    del broken["codes"][0]["label"]["de"]  # lang slot removed
    assert any("lang map" in m for m in validate_vocabulary(broken))

    broken = copy.deepcopy(raw)
    broken["codes"][0]["unit_canonical"] = "palec"  # unit off-whitelist
    assert any("whitelist" in m for m in validate_vocabulary(broken))

    broken = copy.deepcopy(raw)
    broken["codes"].append(dict(broken["codes"][0]))  # duplicate
    assert any("duplicate" in m for m in validate_vocabulary(broken))

    broken = copy.deepcopy(raw)
    declared = next(c for c in broken["codes"] if c["coverage"] == "declared")
    declared["coverage"] = "covered"  # coverage-contract breach
    assert any("coverage contract" in m for m in validate_vocabulary(broken))

    broken = copy.deepcopy(raw)
    broken["codes"][0]["params"] = [{"name": "x", "kind": "national_number"}]
    assert any("kind" in m for m in validate_vocabulary(broken))


def test_loader_shape_and_honest_accessors():
    vocab = load_vocabulary()
    assert vocab["version"] and vocab["codes"] and vocab["domains"]
    assert get_code("CONCRETE.POUR.STRUCTURE") is not None
    assert get_code("CONCRETE.POUR.INVENTED") is None  # never invented
    assert is_covered("CONCRETE.POUR.STRUCTURE") is True
    assert is_covered("STEEL.RAILING.INSTALL") is False  # declared ≠ covered
    assert is_covered("TOTALLY.UNKNOWN.CODE") is False
    assert domain_of("MASONRY.ANYTHING.HERE") == "MASONRY"  # declared-empty domain
    assert domain_of("SPACEFLIGHT.LAUNCH.PAD") is None


def test_coverage_contract_covered_only_under_built_branches():
    vocab = load_vocabulary()
    covered = [c for c, e in vocab["codes"].items() if e["coverage"] == "covered"]
    assert covered, "no covered codes at all?"
    for code in covered:
        assert code.startswith(BUILT_ATOM_PREFIXES), code


def test_no_vrn_codes():
    # VRN/ZS = cost articles (ČSN 73 0212), billing constructs — never vocabulary.
    assert not [c for c in load_vocabulary()["codes"] if c.startswith("SITE.")]


def test_rule4_second_dimension_is_a_param_not_a_unit():
    # The three ratified two-dimensional cases (header rule 4).
    move = get_code("TRANSPORT.MATERIAL.MOVE")
    assert move["unit_canonical"] == "t"
    assert any(p["name"] == "distance_m" for p in move["params"])

    rental = get_code("SCAFFOLDING.STANDARD.RENTAL")
    assert rental["unit_canonical"] == "m2_day"
    assert any(p["name"] == "duration_days" for p in rental["params"])

    railing = get_code("STEEL.RAILING.INSTALL")
    assert railing["unit_canonical"] == "m"
    assert any(p["name"] == "mass_kg_per_m" for p in railing["params"])


def test_falsework_is_m3_and_has_strip():
    # Skruž ≠ bednění: m³ obestavěného prostoru (OTSKP canon), and removal
    # is its own work item.
    assert get_code("FORMWORK.FALSEWORK.ERECT")["unit_canonical"] == "m3"
    assert get_code("FORMWORK.FALSEWORK.STRIP")["unit_canonical"] == "m3"


def test_roughins_are_meters_not_kpl():
    # kpl would degenerate quantity to 1 and G2 Quantify would pass vacuously.
    assert get_code("PLUMBING.ROUGHIN.INSTALL")["unit_canonical"] == "m"
    assert get_code("ELECTRICAL.ROUGHIN.INSTALL")["unit_canonical"] == "m"


# ── 2. Market-proofing (ratified invariant test) ─────────────────────────────

def test_adding_german_label_is_slot_fill_not_migration(raw):
    de_filled = copy.deepcopy(raw)
    de_filled["codes"][0]["label"]["de"] = "Schalung herstellen"
    de_filled["codes"][0]["keywords"]["de"] = ["schalung", "einschalen"]
    assert validate_vocabulary(de_filled) == []  # schema unchanged


def test_market_scheme_params_exist_where_national_taxonomies_live():
    by_param = {
        p["name"]
        for e in load_vocabulary()["codes"].values()
        for p in e.get("params") or []
        if p["kind"] == "market_scheme"
    }
    # DIN 18300 Bodenklassen retired 2016 → soil_class must be market-typed, etc.
    assert {"soil_class", "surface_class", "curing_class", "inspection_regime"} <= by_param


# ── 3. Fixture smoke — the vocabulary covers its own acceptance corpus ───────
# Curated from the three golden fixtures (hand-carried inventory with source
# refs — hermetic, does NOT read test-data/ at runtime):
#   SO-250  test-data/tz/SO-250_golden_test.md   (zárubní zeď, 42 DC)
#   SO-202  test-data/tz/SO-202_D6_most_golden_test.md (most, 6 polí, předpjatá NK)
#   VP4     test-data/tz/VP4_FORESTINA_operna_zed_golden_test.md (opěrná zeď)

FIXTURE_WORKS = [
    # (fixture, work as named by the golden, expected vocabulary code)
    ("SO-250", "podkladní beton C12/15",            "CONCRETE.POUR.BLINDING"),
    ("SO-250", "beton základu C25/30",              "CONCRETE.POUR.STRUCTURE"),
    ("SO-250", "beton dříku C30/37",                "CONCRETE.POUR.STRUCTURE"),
    ("SO-250", "bednění líce C2d",                  "FORMWORK.PANEL.ERECT"),
    ("SO-250", "odbednění",                         "FORMWORK.PANEL.STRIP"),
    ("SO-250", "výztuž B500B",                      "REINFORCEMENT.REBAR.INSTALL"),
    ("SO-250", "dilatační celky (42 DC)",           "CONCRETE.JOINT.DILATATION"),
    ("SO-250", "drenáž za zdí",                     "EARTHWORK.DRAINAGE.INSTALL"),
    ("SO-250", "hydroizolace rubu",                 "WATERPROOFING.MEMBRANE.APPLY"),
    ("SO-250", "výkop jam tř. I-III",               "EARTHWORK.EXCAVATION.PIT"),
    ("SO-250", "odvoz výkopku",                     "TRANSPORT.SPOIL.REMOVE"),
    ("SO-250", "zábradlí",                          "STEEL.RAILING.INSTALL"),
    ("SO-202", "piloty Ø900 vrtané",                "PILING.BORED.INSTALL"),
    ("SO-202", "armokoše pilot",                    "REINFORCEMENT.REBAR.CAGE"),
    ("SO-202", "pevná skruž pro NK",                "FORMWORK.FALSEWORK.ERECT"),
    ("SO-202", "odstranění skruže",                 "FORMWORK.FALSEWORK.STRIP"),
    ("SO-202", "bednění NK",                        "FORMWORK.PANEL.ERECT"),
    ("SO-202", "beton NK C35/45 XF2",               "CONCRETE.POUR.STRUCTURE"),
    ("SO-202", "předpínací výztuž Y1860",           "REINFORCEMENT.PRESTRESS.TENDON"),
    ("SO-202", "ošetřování betonu třída 4",         "CONCRETE.CURING.SURFACE"),
    ("SO-202", "římsový vozík",                     "FORMWORK.TRAVELER.OPERATE"),
    ("SO-202", "přechodová deska beton C25/30",     "CONCRETE.POUR.STRUCTURE"),
    ("SO-202", "podkladní betony C12/15 X0",        "CONCRETE.POUR.BLINDING"),
    ("SO-202", "zábradlí + zábradelní svodidlo",    "STEEL.RAILING.INSTALL"),
    ("VP4",    "beton stěny C25/30",                "CONCRETE.POUR.STRUCTURE"),
    ("VP4",    "bednění Framax (547 m²)",           "FORMWORK.PANEL.ERECT"),
    ("VP4",    "výztuž D12 (150 kg/m³)",            "REINFORCEMENT.REBAR.INSTALL"),
]


@pytest.mark.parametrize("fixture,work,expected_code", FIXTURE_WORKS)
def test_fixture_work_maps_to_existing_code(fixture, work, expected_code):
    entry = get_code(expected_code)
    assert entry is not None, f"{fixture}: '{work}' has NO vocabulary code ({expected_code} missing)"
    # Honest-path guarantee: even a non-covered code lives in a DECLARED
    # domain, so the router can answer not_covered_branch — never a void.
    assert domain_of(expected_code) is not None, f"{expected_code}: domain undeclared"


def test_fixture_corpus_spans_both_coverage_states():
    # The smoke corpus must exercise BOTH paths: built-branch atoms (covered)
    # and honestly-declared gaps — otherwise the honest path is untested.
    states = {get_code(code)["coverage"] for _, _, code in FIXTURE_WORKS}
    assert states == {"covered", "declared"}

# ── Shape guard: malformed entries → violation, never AttributeError ─────────
# (Amazon Q review on PR #1509 — the honest-empty contract must hold even for
# structurally-broken YAML, e.g. a bare string where a mapping is expected.)

def test_non_dict_code_entry_is_violation_not_exception():
    violations = validate_vocabulary({
        "codes": ["not-a-mapping"],
        "domains": [{"key": "X", "label": {"cs": "x", "de": "", "es": ""}}],
    })
    assert violations, "malformed codes[] entry must be reported"
    assert any("malformed entries" in m for m in violations)


def test_non_dict_domain_entry_is_violation_not_exception():
    violations = validate_vocabulary({"codes": [], "domains": ["oops"]})
    assert violations
    assert any("malformed entries" in m for m in violations)
