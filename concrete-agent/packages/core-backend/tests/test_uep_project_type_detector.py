"""Project type detector tests — PR3 §3.6."""

from __future__ import annotations

from app.services.uep.project_type_detector import (
    AMBIGUITY_GAP,
    ProjectTypeDetection,
    detect_project_type,
)


def test_residential_RD_jachymov_shape() -> None:
    d = detect_project_type(
        filenames=["B_Souhrnna_TZ_EAR.pdf", "D.1.1.2.1.01_pudorys.pdf", "situace.dxf"],
        tz_text="Rodinný dům RD Jachymov, dvoupodlažní obytný objekt.",
    )
    assert d.top_choice == "residential"


def test_bridge_zihle_shape() -> None:
    d = detect_project_type(
        filenames=["SO_201_most_2062-1.pdf", "opera.dwg"],
        tz_text="Most evidenční číslo 2062-1, mostní konstrukce, opěry, drik pilíře.",
    )
    assert d.top_choice == "bridge"


def test_road_so_250_shape() -> None:
    d = detect_project_type(
        filenames=["SO_250.pdf"],
        tz_text="Silnice II/350, vozovka kryt ACL, staničení 1+200 - 2+100 km",
    )
    assert d.top_choice == "road"


def test_industrial_hk212_shape() -> None:
    d = detect_project_type(
        filenames=["A101_pudorys_1np.dxf"],
        tz_text="Průmyslová hala Hradec Králové, výrobní hala s technologickou linkou.",
    )
    assert d.top_choice == "industrial"


def test_mep_only_libuse_vzt_chl() -> None:
    d = detect_project_type(
        filenames=["D_1NP_vzt.dxf", "D_2NP_chl.dxf", "D_3NP_vzt.dxf"]
    )
    assert d.top_choice == "mep_only"


def test_empty_input_returns_no_top_choice() -> None:
    d = detect_project_type()
    assert d.top_choice is None
    assert d.candidates == []
    assert d.ambiguous_candidates == []


def test_ambiguous_bridge_vs_road_keywords() -> None:
    # Mixed signals — bridge term in filename + road term in TZ.
    # Filename has weight 2.0; content weight 1.0. So one of each
    # gives 2 vs 1 → bridge wins (gap 1/3 ≈ 0.33 > AMBIGUITY_GAP).
    # Make it 1 filename bridge + 2 content road = 2 vs 2 → tied.
    d = detect_project_type(
        filenames=["most_201.dxf"],
        tz_text="Silnice II/350 vozovka.",
    )
    # Exactly tied → both surfaced as ambiguous candidates.
    if d.top_choice is None:
        assert set(d.ambiguous_candidates) >= {"bridge", "road"}
    else:
        # If tie-break landed on one, the other should be in candidates.
        assert {c.project_type for c in d.candidates} >= {"bridge", "road"}


def test_filename_outweighs_content() -> None:
    """Per task §3.6: filename is a stronger signal than content
    because content can mention many project types peripherally."""

    # Filename screams 'most' (×2 weight = 2.0).
    # Content mentions 'silnice' once (×1 weight = 1.0).
    d = detect_project_type(
        filenames=["SO_201_most_2062.dxf"],
        tz_text="Most přechází nad silnicí II/350.",
    )
    assert d.top_choice == "bridge"


def test_ambiguity_gap_threshold() -> None:
    """Two candidates within AMBIGUITY_GAP → ambiguous list, no top_choice.

    Equal-weight construction: 3 bridge filenames (weight 2 each = 6)
    + 1 bridge content hit (1) = 7. Same for road: 7. → ratio 0.5 / 0.5
    → gap 0 < 0.15 → both ambiguous.
    """

    d = detect_project_type(
        filenames=[
            "most_1.pdf", "most_2.pdf", "most_3.pdf",
            "silnice_1.pdf", "silnice_2.pdf", "silnice_3.pdf",
        ],
        tz_text="Most. Silnice.",
    )
    assert d.top_choice is None, f"expected ambiguous, got {d.candidates}"
    assert "bridge" in d.ambiguous_candidates
    assert "road" in d.ambiguous_candidates


def test_files_scanned_count_reported() -> None:
    d = detect_project_type(filenames=["a.pdf", "b.dxf", "c.dwg"])
    assert d.files_scanned == 3


def test_tz_chars_scanned_capped_at_200k() -> None:
    huge_tz = "Most " * 100_000  # 500_000 chars
    d = detect_project_type(filenames=[], tz_text=huge_tz)
    assert d.tz_chars_scanned == 200_000
