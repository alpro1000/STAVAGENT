"""24. typ — uzavřený rám (tubus): klasifikace (PR1 Wave 1).

Task: docs/tasks/TASK_Element24_UzavrenyRam_Tubus_v2_1.md (§2.1 + AC1).
Golden: test-data/tz/SO-11-20-04_podchod_golden_test.md (§1).

Diskriminátor (Q9, ratifikováno 2026-07-16): UZAVŘENÝ průřez → tubus; otevřený
rám/polorám NENÍ tubus; názvy objektů NEROZHODUJÍ (SŽ zove podchody «železniční
most v km X»). Primární closed-frame signál jede raw-text early-detectem
(head-noun normalizer řeže participiální ocas — golden věta by jinak dorazila
do keyword matcheru jako holé «nosná konstrukce» = deck). Hermetické: bez sítě,
bez DB, bez AI (AC13).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.mcp.tools.classifier import ELEMENT_TYPES, _classify  # noqa: E402


# ── golden SO 11-20-04 (AC1) ─────────────────────────────────────────────────

def test_golden_nk_sentence_beats_head_noun_deck():
    """TZ §3.7.1 doslova: closed-frame signál MUSÍ přebít «nosná konstrukce»
    (deck vocab) i head-noun tail-cut."""
    r = _classify(
        "nosná konstrukce je navržena jako uzavřený železobetonový rám "
        "tvořený deseti dilatačními celky"
    )
    assert r["element_type"] == "uzavreny_ram_tubus"
    assert r["element_type"] not in ("jine", "mostovkova_deska")
    assert r["confidence"] >= 0.9
    assert r["construction_mode"] == "monolit"


def test_golden_object_name_sz_most_trap():
    """SŽ administrativně zove podchod «železniční most» — název nerozhoduje."""
    r = _classify("Železniční most v km 123,980 (Podchod)")
    assert r["element_type"] == "uzavreny_ram_tubus"
    assert r["subtype"] == "podchod"
    assert r["construction_mode"] == "monolit"


def test_golden_soupis_line_389325():
    """Jádrová položka výkazu (OTSKP 389325) musí bindovat na tubus —
    soupis-join to potřebuje pro golden kubaturu 1 046,800 m³."""
    r = _classify("MOSTNÍ RÁMOVÉ KONSTRUKCE ZE ŽELEZOBETONU C30/37")
    assert r["element_type"] == "uzavreny_ram_tubus"
    assert r["concrete_class_detected"] == "C30/37"


# ── AC1 anti-kritérium: polorám NENÍ tubus ───────────────────────────────────

def test_open_half_frame_is_schodiste_never_tubus():
    """TZ §3.7.2 doslova: «otevřený železobetonový polorám» (schodiště) —
    otevřený průřez → NIKDY fáze tubusu (AC1)."""
    r = _classify("Konstrukce schodišť je řešena jako otevřený železobetonový polorám")
    assert r["element_type"] == "schodiste"
    assert r["element_type"] != "uzavreny_ram_tubus"


def test_plain_ramovy_most_is_not_tubus():
    """Rámový most bez tubus-signálů = otevřený rám → NENÍ tubus (mostovka
    rodina / fallback). Vstup do rodiny rozhoduje průřez, ne slovo «rám»."""
    r = _classify("rámový most přes potok")
    assert r["element_type"] != "uzavreny_ram_tubus"


# ── podtypy (jedno pole, ne čtyři typy — §2.1) ───────────────────────────────

def test_subtypes_resolved_deterministically():
    cases = [
        ("rámový propustek pod tratí", "ramovy_propustek"),
        ("uzavřená rámová konstrukce podjezdu", "podjezd"),
        ("hloubený tunel — kolektor 30 sekcí", "hloubeny_tunel"),
        ("tubus kolektoru", "kolektor"),
        ("tubus", None),  # bez podtypového slova → honest None, žádný default
    ]
    for name, expected in cases:
        r = _classify(name)
        assert r["element_type"] == "uzavreny_ram_tubus", name
        assert r["subtype"] == expected, (name, r["subtype"])


def test_administrative_propustek_boundary_affects_subtype_not_family():
    """Hranice propustek/most (světlost 2 m, SŽ) mění PODTYP, ne rodinu:
    propustek i podchod jsou týž element_type."""
    a = _classify("rámový propustek")
    b = _classify("podchod pod nástupišti")
    assert a["element_type"] == b["element_type"] == "uzavreny_ram_tubus"
    assert a["subtype"] == "ramovy_propustek" and b["subtype"] == "podchod"


# ── monolit / prefab (§2.6 — schéma rozšiřitelné, v PR1 dvě hodnoty) ─────────

def test_prefab_signals_flip_construction_mode():
    r = _classify("prefabrikované rámy IZM, montáž dílců propustku")
    assert r["element_type"] == "uzavreny_ram_tubus"
    assert r["construction_mode"] == "prefab"
    assert r["subtype"] == "ramovy_propustek"


def test_default_mode_is_monolit():
    r = _classify("tubus podchodu, betonáž na místě")
    assert r["construction_mode"] == "monolit"


# ── pasti okolních vocab ─────────────────────────────────────────────────────

def test_kabelovod_never_tubus():
    """SO 11-60-01 kabelovod — «kolektor» rodinné slovo nesmí chytat kabelovody."""
    r = _classify("ŽST Turnov, kabelovod v km 123")
    assert r["element_type"] != "uzavreny_ram_tubus"


def test_existing_types_untouched():
    """Kontrolní ne-regrese: 3 stávající typy klasifikují beze změny a NIKDY
    nenesou tubus-pole (response shape ostatních 23 typů nedotčen, task §3)."""
    for name, expected in [
        ("Nosná konstrukce mostovka", "mostovkova_deska"),
        ("Mostovka z předpjatého betonu", "mostovkova_deska"),
        ("Opěrná zeď úhlová", "operna_zed"),
    ]:
        r = _classify(name)
        assert r["element_type"] == expected, name
        assert "construction_mode" not in r and "subtype" not in r, name


# ── profil (kalibrace n=1) ───────────────────────────────────────────────────

def test_profile_carries_turnov_calibration():
    """rebar 131 kg/m³ = SO 11-20-04 (389365/389325), n=1 kalibrace — hodnota
    pinnuta vč. range; orientation 'special' = tubus NEJDE obecnými
    orientation-větvemi (task §2.10, pin #1514)."""
    p = ELEMENT_TYPES["uzavreny_ram_tubus"]
    assert p["rebar_kg_m3"] == 131
    assert p["rebar_range"] == [90, 160]
    assert p["orientation"] == "special"
    r = _classify("tubus podchodu")
    assert r["rebar_ratio_kg_m3"] == 131


def test_yaml_family_invariant():
    """type_core.family == w3_family[w3_name] (generátorový invariant) platí
    i pro novou rodinu `frame`."""
    from app.mcp.tools.classifier import _load_rules

    rules = _load_rules()
    tc = rules["type_core"]["uzavreny_ram_tubus"]
    assert tc["family"] == "frame"
    assert rules["w3_family"][tc["w3_name"]] == "frame"
    assert tc.get("bridge_boost") is True
