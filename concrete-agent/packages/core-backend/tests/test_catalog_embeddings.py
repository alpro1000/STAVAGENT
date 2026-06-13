"""
Hermetic tests for the catalog embeddings pieces (Phase 1b).

No GCS / no DB / no Vertex — the OTSKP XML parser, the SQLite builder, the
row→candidate mapper, the vector literal, and the provider registration are all
exercised purely. The live pgvector query + Vertex embed are integration steps
validated on deploy (see the recon doc runbook).
"""

import sqlite3

import pytest

from app.services import catalog_matching as cm
from app.services import catalog_embeddings as ce


# ── OTSKP XML parser ─────────────────────────────────────────────────────────
_XML_PLAIN = """<?xml version="1.0" encoding="utf-8"?>
<XC4><CenoveSoustavy><Polozky>
  <Polozka><znacka>272311</znacka><nazev>Beton pilířů C35/45 železobeton</nazev>
    <MJ>M3</MJ><jedn_cena>3200,50</jedn_cena><technicka_specifikace>NK</technicka_specifikace></Polozka>
  <Polozka><znacka>334222</znacka><nazev>Obklad pilířů z lomového kamene</nazev>
    <MJ>M2</MJ><jedn_cena>1800</jedn_cena></Polozka>
</Polozky></CenoveSoustavy></XC4>"""

_XML_NS = """<?xml version="1.0" encoding="utf-8"?>
<XC4 xmlns="http://sfdi.cz/otskp"><Polozky>
  <Polozka><znacka>171101</znacka><nazev>Násyp ze sypaniny</nazev>
    <MJ>M3</MJ><jedn_cena>250</jedn_cena></Polozka>
</Polozky></XC4>"""


def test_parse_otskp_xml_plain():
    items = ce_parse(_XML_PLAIN)
    assert len(items) == 2
    beton = next(i for i in items if i["code"] == "272311")
    assert beton["nazev"].startswith("Beton pilířů")
    assert beton["mj"] == "M3"
    assert beton["cena"] == pytest.approx(3200.50)  # czech comma decimal handled
    assert beton["spec"] == "NK"


def test_parse_otskp_xml_namespaced():
    items = ce_parse(_XML_NS)
    assert [i["code"] for i in items] == ["171101"]


def test_parse_otskp_xml_rejects_empty():
    with pytest.raises(ValueError):
        ce_parse("<XC4><Polozky></Polozky></XC4>")


def ce_parse(xml: str):
    from scripts.ingest_otskp_catalog import parse_otskp_xml
    return parse_otskp_xml(xml)


def test_build_sqlite_roundtrip(tmp_path):
    from scripts.ingest_otskp_catalog import build_sqlite, parse_otskp_xml
    items = parse_otskp_xml(_XML_PLAIN)
    db = tmp_path / "otskp.db"
    n = build_sqlite(items, str(db), "OTSKP 2026 TEST")
    assert n == 2
    conn = sqlite3.connect(str(db))
    row = conn.execute("SELECT nazev, mj, cena, catalog_version FROM otskp WHERE code='272311'").fetchone()
    conn.close()
    assert row[0].startswith("Beton pilířů")
    assert row[3] == "OTSKP 2026 TEST"


# ── row → candidate mapper ───────────────────────────────────────────────────
def test_build_candidates_from_rows():
    rows = [("272311", "Beton pilířů C35/45", "M3", 3200.0, 0.91)]
    cands = ce.build_candidates_from_rows(rows)
    assert cands[0]["code"] == "272311"
    assert cands[0]["description"] == "Beton pilířů C35/45"
    assert cands[0]["source"] == "embeddings"
    assert cands[0]["similarity"] == pytest.approx(0.91)
    assert cands[0]["unit_price_czk"] == 3200.0


def test_vector_literal_format():
    assert ce._vector_literal([0.1, 0.2, 0.3]).startswith("[")
    assert ce._vector_literal([1.0, 2.0]).endswith("]")


# ── provider registration wires the chain seam ───────────────────────────────
def test_register_embeddings_provider(monkeypatch):
    monkeypatch.setattr(cm, "_EMBEDDINGS_PROVIDER", None)

    def fake_provider(query, limit):
        return [{"code": "272311", "description": "Beton pilířů C35/45", "unit": "M3",
                 "unit_price_czk": 3200.0, "source": "embeddings", "similarity": 0.9}]

    ce.register_embeddings_provider(fake_provider)
    assert cm._EMBEDDINGS_PROVIDER is fake_provider

    # …and the chain consumes it (recall repaired, AI-band confidence)
    raw = cm.retrieve_candidates("beton pilířů C35/45", lambda q: [])
    carrier = cm.match_catalog("beton pilířů C35/45", raw)
    cand = next(c for c in carrier["candidates"] if c["code"] == "272311")
    assert cand["source"] == "embeddings"
    assert 0.70 <= cand["confidence"] <= 0.80


def test_register_defaults_to_pgvector_provider(monkeypatch):
    monkeypatch.setattr(cm, "_EMBEDDINGS_PROVIDER", None)
    ce.register_embeddings_provider()
    assert cm._EMBEDDINGS_PROVIDER is ce.pgvector_provider


# ── ingest hardening (runbook ops-feedback) ──────────────────────────────────
def test_doc_text_truncates_overlong_spec():
    from scripts.ingest_otskp_catalog import _MAX_TEXT_CHARS, _doc_text
    item = {"nazev": "Beton pilířů", "spec": "X" * 50000}  # multi-page spec
    assert len(_doc_text(item)) == _MAX_TEXT_CHARS


def test_token_budgeted_batches_splits_on_budget():
    from scripts.ingest_otskp_catalog import _BATCH_TOKEN_BUDGET, _token_budgeted_batches
    big = "Y" * (_BATCH_TOKEN_BUDGET * 4)  # one item alone ≈ the whole budget
    pairs = [({"code": str(n)}, big) for n in range(3)]
    batches = list(_token_budgeted_batches(pairs))
    assert len(batches) == 3  # never packs two budget-filling items together
    assert all(len(b) == 1 for b in batches)


def test_token_budgeted_batches_respects_max_items():
    from scripts.ingest_otskp_catalog import _MAX_BATCH_ITEMS, _token_budgeted_batches
    pairs = [({"code": str(n)}, "short") for n in range(_MAX_BATCH_ITEMS + 5)]
    batches = list(_token_budgeted_batches(pairs))
    assert max(len(b) for b in batches) <= _MAX_BATCH_ITEMS
    assert sum(len(b) for b in batches) == _MAX_BATCH_ITEMS + 5


def test_load_xml_text_reads_local_path(tmp_path):
    from scripts.ingest_otskp_catalog import load_xml_text, parse_otskp_xml
    p = tmp_path / "otskp.xml"
    p.write_text(_XML_PLAIN, encoding="utf-8")
    items = parse_otskp_xml(load_xml_text(str(p)))  # non-gs:// → local read, no GCS
    assert len(items) == 2


def test_pgvector_migration_revision_id_within_alembic_limit():
    # alembic_version.version_num defaults to VARCHAR(32) — a longer id fails the
    # journal write (the runbook bug). Guard it here.
    import pathlib
    import re
    mig = pathlib.Path(__file__).resolve().parent.parent / "alembic" / "versions" / "2026_06_11_otskp_embeddings_pgvector.py"
    m = re.search(r'^revision:\s*str\s*=\s*"([^"]+)"', mig.read_text(), re.M)
    assert m and len(m.group(1)) <= 32, "revision id must be ≤ 32 chars"
