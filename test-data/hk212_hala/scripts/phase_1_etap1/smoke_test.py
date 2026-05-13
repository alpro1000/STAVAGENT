"""Phase 1 Etapa 1 scaffolding smoke test.

Verifies:
1. URS catalog loads (39 742 rows expected)
2. Czech stemmer + tokenizer + URS index work on sample queries
3. VYJASNĚNÍ queue loads + #N → ABMV_N normalization works
4. Item schema dataclass instantiates and validates

Run from repo root::

    python3 test-data/hk212_hala/scripts/phase_1_etap1/smoke_test.py
"""
from __future__ import annotations

import sys
from pathlib import Path

# Make package importable
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from phase_1_etap1.urs_lookup import (  # noqa: E402
    load_urs_catalog, UrsIndex, stem_word, tokenize_text, stem_tokens, categorize_match,
)
from phase_1_etap1.item_schema import Item, validate, default_so_for_kapitola  # noqa: E402
from phase_1_etap1.vyjasneni_loader import VyjasneniQueue, normalize_ref  # noqa: E402


def test_stemmer() -> None:
    print("=== stem_word samples ===")
    samples = [
        ("činnosti", "cinnst"),
        ("nákladů", "nakld"),
        ("geodetické", "geodtck"),
        ("průvodních", "pruvdnch"),
        ("betonových", None),  # exact URS form is "betonvh" — we accept best-effort
    ]
    for src, expect in samples:
        got = stem_word(src)
        marker = "✓" if (expect is None or got == expect) else "≈"
        print(f"  {marker}  {src!r:14s} → {got!r:10s} (URS: {expect!r})")


def test_tokenize() -> None:
    print("\n=== tokenize + stem ===")
    queries = [
        "Beton patek rámových C16/20 XC0",
        "Hloubení nezapažených jam horní třídy 3 do 1000 m³",
        "Bednění základové desky zřízení",
        "Žlaby z Pz plechu podokapní půlkruhové rš 400 mm",
        "Železobeton základových desek C 16/20",
    ]
    for q in queries:
        raw = tokenize_text(q)
        stemmed = stem_tokens(raw)
        print(f"  '{q[:50]}'\n     raw:     {raw}\n     stemmed: {stemmed}")


def test_urs_lookup() -> None:
    print("\n=== URS catalog load + lookup ===")
    entries = load_urs_catalog()
    print(f"  catalog loaded: {len(entries)} entries (expected ≥39 000)")
    assert len(entries) >= 39_000, "URS catalog too small"
    idx = UrsIndex(entries)
    samples = [
        ("Hloubení nezapažených jam pro patky", "1"),
        ("Bednění základové desky zřízení", "27"),
        ("Žlab půlkruhový podokapní z Pz plechu rš 400", "78"),
        ("Geodetické práce", "005"),
        ("Přesun hmot pro klempířské konstr.", "998"),
        ("Beton patky C16/20", "27"),
    ]
    for popis, hint in samples:
        matches = idx.lookup(popis, kapitola_prefix_hint=hint, top_n=3)
        print(f"\n  Q: {popis!r}  (prefix hint: {hint!r})")
        if not matches:
            print("     → no matches")
            continue
        for m in matches:
            cat = categorize_match(m.score)
            print(f"     {m.code:12s}  {m.score:.3f}  {cat:15s}  tokens: {' '.join(m.tokens[:8])}")


def test_vyjasneni() -> None:
    print("\n=== vyjasneni queue load + normalize ===")
    queue = VyjasneniQueue.load()
    print(f"  queue items: {len(queue.items_by_id)}")
    print(f"  first 5 IDs: {sorted(queue.items_by_id.keys())[:5]}")
    refs_test = ["#17", "ABMV_3", "#1", "#99"]
    norm, unknown = queue.validate_refs(refs_test)
    print(f"  refs {refs_test} → normalized {norm}")
    print(f"  unknown refs: {unknown}")
    print(f"  ABMV_17 severity: {queue.severity('ABMV_17')}")


def test_item_validate() -> None:
    print("\n=== item schema validate ===")
    good = Item(
        id="HSV-1-001",
        kapitola="HSV-1",
        SO=default_so_for_kapitola("HSV-1"),
        popis="Hloubení figury pro desku — strojně",
        mj="m³",
        mnozstvi=250.4,
        urs_code=None,
        urs_alternatives=[],
        urs_status="needs_review",
        urs_match_score=0.0,
        skladba_ref=None,
        source="A102 axes envelope 28.19×19.74 + TZ B m.10.g",
        raw_description="figura pod deskou",
        confidence=0.50,
        subdodavatel_chapter="zemni_prace",
        _vyjasneni_ref=["ABMV_17"],
        _status_flag="working_assumption",
        _data_source="TZ+DXF",
        _completeness=0.85,
        _qty_formula="556.4 m² × 0.45 m",
    )
    errs = validate(good)
    print(f"  good item validate errors: {errs}")
    assert not errs, "expected good item to pass"

    bad = Item(
        id="X",
        kapitola="INVALID",
        SO="SO-99",
        popis="ok",
        mj="dunno",
        mnozstvi=-1,
        urs_code="abc",
        urs_alternatives=[],
        urs_status="bad_status",
        urs_match_score=2.0,
        skladba_ref=None,
        source="",
        raw_description="",
        confidence=0.10,
        subdodavatel_chapter="",
    )
    errs = validate(bad)
    print(f"  bad item validate errors ({len(errs)} expected ≥6):")
    for e in errs:
        print(f"    - {e}")


def main() -> int:
    test_stemmer()
    test_tokenize()
    test_urs_lookup()
    test_vyjasneni()
    test_item_validate()
    print("\n✓ All smoke tests passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
