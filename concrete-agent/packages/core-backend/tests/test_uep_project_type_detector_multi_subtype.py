"""Multi-subtype MEP detection tests — PR4a §3.1.

`detect_project_type()` returns a `ProjectTypeDetection` whose
`mep_subtypes` list captures every D.1.4 sub-discipline detected in
the upload. Subtypes are a flat set (no winner-take-all), so a single
TZ pack with silnoproud + ZTI + VZT all three reports back.

The umbrella `top_choice` is unaffected by subtype detection — a
residential project that ships an embedded D.1.4 silnoproud document
returns `top_choice="residential"` AND
`mep_subtypes=["mep_d14_silnoproud"]`.
"""

from __future__ import annotations

from app.services.uep.project_type_detector import detect_project_type


def test_pure_silnoproud_project_returns_single_subtype() -> None:
    d = detect_project_type(
        filenames=["D_1_4_1_silnoproud.pdf", "rozvadec_R1.dxf"],
        tz_text=(
            "Silnoproudé instalace dle ČSN 33 2000. Hlavní rozvaděč RH "
            "s celkovým instalovaným výkonem 25 kW."
        ),
    )
    assert "mep_d14_silnoproud" in d.mep_subtypes
    # No false positives from other subtypes.
    assert "mep_d14_vzt" not in d.mep_subtypes
    assert "mep_d14_zti" not in d.mep_subtypes


def test_bundled_silnoproud_zti_vzt_returns_three_subtypes() -> None:
    """Canonical Czech residential D&B pack — 3 disciplines together."""

    d = detect_project_type(
        filenames=[
            "D_1_4_1_silnoproud.pdf",
            "D_1_4_4_ZTI_vodovod.pdf",
            "D_1_4_3_VZT.pdf",
        ],
    )
    assert set(d.mep_subtypes) >= {
        "mep_d14_silnoproud",
        "mep_d14_zti",
        "mep_d14_vzt",
    }


def test_mep_only_residential_pack_detects_subtypes_via_filenames() -> None:
    """The Libuše-style MEP-only upload (PR3 test_mep_only_libuse_vzt_chl
    shape extended) — top_choice stays `mep_only`, subtypes populated."""

    d = detect_project_type(
        filenames=[
            "D_1NP_vzt.dxf",
            "D_2NP_vzt.dxf",
            "D_1NP_topeni_UT.pdf",
            "D_silnoproud_R1.pdf",
        ]
    )
    assert d.top_choice == "mep_only"
    assert "mep_d14_vzt" in d.mep_subtypes
    assert "mep_d14_ut" in d.mep_subtypes
    assert "mep_d14_silnoproud" in d.mep_subtypes


def test_residential_with_embedded_d14_still_reports_subtypes() -> None:
    """A RD upload with a single embedded D.1.4 doc keeps top_choice =
    residential AND surfaces the D.1.4 subtype for matrix routing."""

    d = detect_project_type(
        filenames=[
            "RD_Jachymov_souhrnna_TZ.pdf",
            "pudorys_1np.dxf",
            "D_1_4_5_topeni.pdf",
        ],
        tz_text="Rodinný dům RD Jachymov, dvoupodlažní obytný objekt.",
    )
    assert d.top_choice == "residential"
    # Subtype detection runs independently of umbrella scoring.
    assert "mep_d14_ut" in d.mep_subtypes


def test_no_mep_signal_returns_empty_subtypes() -> None:
    """A pure bridge / road / residential upload with no D.1.4 hint
    must NOT fabricate subtype entries."""

    d = detect_project_type(
        filenames=["SO_201_most_2062-1.pdf", "opera.dwg"],
        tz_text="Most evidenční číslo 2062-1, mostní konstrukce.",
    )
    assert d.top_choice == "bridge"
    assert d.mep_subtypes == []


def test_subtype_detection_from_tz_content_only() -> None:
    """No D.1.4 filename hints, only TZ content describes the
    discipline — subtype should still be reported."""

    d = detect_project_type(
        filenames=["tz.pdf"],
        tz_text=(
            "Vnitřní vodovod proveden z PEX-Al-PEX podle ČSN 75 5455. "
            "Vnitřní kanalizace PP-HT systém. Dešťová kanalizace "
            "napojena na zasakovací objekt podle ČSN 75 9010."
        ),
    )
    assert "mep_d14_zti" in d.mep_subtypes


def test_mar_bms_keywords_detected() -> None:
    d = detect_project_type(
        filenames=["D_1_4_6_MaR.pdf"],
        tz_text=(
            "BMS server Niagara s komunikačními protokoly BACnet IP a "
            "Modbus. Frekvenční měniče na hlavních ventilátorech VZT."
        ),
    )
    # MaR detected from both filename and content; VZT from "ventilátorech".
    assert "mep_d14_mar" in d.mep_subtypes


def test_plyn_keywords_detected() -> None:
    d = detect_project_type(
        filenames=["D_plynovod.pdf"],
        tz_text="Plynovodní přípojka DN25, HUP osazen v kovové skříňce na fasádě.",
    )
    assert "mep_d14_plyn" in d.mep_subtypes


def test_slaboproud_eps_keywords_detected() -> None:
    d = detect_project_type(
        filenames=["EPS_smyckovy_plan.pdf"],
        tz_text=(
            "Požární poplachová signalizace EPS dle ČSN 73 0875. "
            "Strukturovaná kabeláž Cat6a, datový rozvaděč R-DAT."
        ),
    )
    assert "mep_d14_slaboproud" in d.mep_subtypes


def test_mep_subtypes_order_is_deterministic() -> None:
    """Two semantically identical inputs must return mep_subtypes in
    identical order, regardless of the order the patterns matched in."""

    d1 = detect_project_type(
        filenames=["D_silnoproud.pdf", "D_VZT.pdf", "D_ZTI.pdf"]
    )
    d2 = detect_project_type(
        filenames=["D_ZTI.pdf", "D_silnoproud.pdf", "D_VZT.pdf"]
    )
    assert d1.mep_subtypes == d2.mep_subtypes
    # Sorted alphabetically.
    assert d1.mep_subtypes == sorted(d1.mep_subtypes)


def test_empty_input_returns_empty_subtypes() -> None:
    d = detect_project_type()
    assert d.mep_subtypes == []
