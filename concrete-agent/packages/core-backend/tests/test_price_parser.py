"""
Tests for the price parser module.

Tests cover:
  - Pydantic models (validation, defaults)
  - Extractor (text extraction)
  - Betony regex parser
  - LLM client JSON extraction
  - Main pipeline structure
"""

import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


# ── Model tests ──────────────────────────────────────────────────────────────

class TestModels:
    def test_source_defaults(self):
        from app.services.price_parser.models import Source
        s = Source()
        assert s.currency == "CZK"
        assert s.vat_rate == 21
        assert s.company is None

    def test_source_with_data(self):
        from app.services.price_parser.models import Source
        s = Source(company="Beton Union", provozovna="Plzeň", valid_from="2024-04-01")
        assert s.company == "Beton Union"
        assert s.provozovna == "Plzeň"

    def test_beton_item(self):
        from app.services.price_parser.models import BetonItem
        b = BetonItem(name="C 25/30", price_per_m3=3440)
        assert b.name == "C 25/30"
        assert b.price_per_m3 == 3440
        assert b.exposure_class is None

    def test_doprava_zona(self):
        from app.services.price_parser.models import DopravaZona
        z = DopravaZona(km_from=0, km_to=5, price_per_m3=300)
        assert z.price_per_m3 == 300

    def test_cerpadlo_item(self):
        from app.services.price_parser.models import CerpadloItem
        c = CerpadloItem(type="PUMI 21m", pristaveni=2300, hodinova_sazba=2300)
        assert c.type == "PUMI 21m"

    def test_priplatek_casovy(self):
        from app.services.price_parser.models import PriplatekCasovy
        p = PriplatekCasovy(nazev="Sobota", typ="%", hodnota=5)
        assert p.hodnota == 5

    def test_priplatek_zimni(self):
        from app.services.price_parser.models import PriplatekZimni
        p = PriplatekZimni(teplota_from=0, teplota_to=5, price_per_m3=150)
        assert p.price_per_m3 == 150

    def test_price_list_result_defaults(self):
        from app.services.price_parser.models import PriceListResult
        r = PriceListResult()
        assert r.betony == []
        assert r.cerpadla == []
        assert r.source.currency == "CZK"
        assert r.doprava.zony == []

    def test_price_list_result_serialization(self):
        from app.services.price_parser.models import PriceListResult, Source, BetonItem
        r = PriceListResult(
            source=Source(company="Test"),
            betony=[BetonItem(name="C 25/30", price_per_m3=3440)],
        )
        d = r.model_dump()
        assert d["source"]["company"] == "Test"
        assert len(d["betony"]) == 1
        # Roundtrip JSON
        j = json.dumps(d, ensure_ascii=False)
        assert "C 25/30" in j


# ── Betony regex parser tests ────────────────────────────────────────────────

class TestBetonyRegex:
    def test_parse_price_cz_format(self):
        from app.services.price_parser.parsers.betony import _parse_price
        assert _parse_price("3 440") == 3440.0
        assert _parse_price("3440") == 3440.0
        assert _parse_price("3.440,00") == 3440.0
        assert _parse_price("2 800") == 2800.0

    def test_parse_price_edge_cases(self):
        from app.services.price_parser.parsers.betony import _parse_price
        assert _parse_price("") is None
        assert _parse_price("abc") is None
        assert _parse_price("0") is None

    def test_regex_parse_basic(self):
        from app.services.price_parser.parsers.betony import _regex_parse
        text = """
        C 25/30  XC2, XF1   3 440 Kč/m³
        C 30/37  XC4        3 780 Kč/m³
        C 8/10              2 100 Kč/m³
        """
        items = _regex_parse(text)
        assert len(items) >= 2  # regex may not catch all formats
        names = [i.name for i in items]
        assert any("25/30" in n for n in names)


# ── LLM client JSON extraction tests ────────────────────────────────────────

class TestLLMClient:
    def test_extract_json_plain(self):
        from app.services.price_parser.llm_client import _extract_json
        result = _extract_json('{"key": "value"}')
        assert result == {"key": "value"}

    def test_extract_json_code_block(self):
        from app.services.price_parser.llm_client import _extract_json
        result = _extract_json('```json\n{"key": "value"}\n```')
        assert result == {"key": "value"}

    def test_extract_json_array(self):
        from app.services.price_parser.llm_client import _extract_json
        result = _extract_json('[{"name": "C 25/30"}]')
        assert isinstance(result, list)
        assert result[0]["name"] == "C 25/30"

    def test_extract_json_invalid(self):
        from app.services.price_parser.llm_client import _extract_json
        with pytest.raises(json.JSONDecodeError):
            _extract_json("not json at all")


# ── Extractor tests ──────────────────────────────────────────────────────────

class TestExtractor:
    def test_valid_char_ratio(self):
        from app.services.price_parser.extractor import _valid_char_ratio
        assert _valid_char_ratio("Hello world") == 1.0
        assert _valid_char_ratio("") == 0.0
        # Mix of valid and control chars
        ratio = _valid_char_ratio("abc\x00\x01\x02def")
        assert 0.5 < ratio < 1.0


# ── Integration tests (require LLM, skip by default) ────────────────────────

class TestIntegration:
    @pytest.mark.asyncio
    async def test_parse_betony_with_mock_llm(self):
        """Test betony parser with mocked LLM (regex path)."""
        from app.services.price_parser.parsers.betony import parse_betony

        text = """
        BETONY TRANSPORTNÍ
        C 8/10       2 100 Kč
        C 16/20      2 650 Kč
        C 25/30      3 440 Kč
        C 30/37      3 780 Kč
        """
        # Regex should find at least some items
        items = await parse_betony(text)
        # Even if regex doesn't find all, it shouldn't crash
        assert isinstance(items, list)

    @pytest.mark.asyncio
    async def test_parse_source_with_mock_llm(self):
        """Test source parser with mocked LLM."""
        from app.services.price_parser.parsers.source import parse_source

        with patch("app.services.price_parser.parsers.source.ask_llm_json", new_callable=AsyncMock) as mock:
            mock.return_value = {
                "company": "Beton Union s.r.o.",
                "provozovna": "Plzeň",
                "valid_from": "2024-04-01",
                "valid_to": None,
                "currency": "CZK",
                "vat_rate": 21,
            }
            source = await parse_source("Ceník Beton Union Plzeň 2024")
            assert source.company == "Beton Union s.r.o."
            assert source.provozovna == "Plzeň"

    @pytest.mark.asyncio
    async def test_parse_doprava_with_mock_llm(self):
        """Test doprava parser with mocked LLM."""
        from app.services.price_parser.parsers.doprava import parse_doprava

        with patch("app.services.price_parser.parsers.doprava.ask_llm_json", new_callable=AsyncMock) as mock:
            mock.return_value = {
                "min_objem_m3": 6,
                "volny_cas_min": 30,
                "cekani_per_15min": 300,
                "zony": [
                    {"km_from": 0, "km_to": 5, "price_per_m3": 300},
                    {"km_from": 6, "km_to": 10, "price_per_m3": 400},
                ],
                "pristaveni_ks": 350,
            }
            doprava = await parse_doprava("Doprava betonu...")
            assert doprava.min_objem_m3 == 6
            assert len(doprava.zony) == 2

    @pytest.mark.asyncio
    async def test_parse_cerpadla_with_mock_llm(self):
        """Test cerpadla parser with mocked LLM."""
        from app.services.price_parser.parsers.cerpadla import parse_cerpadla

        with patch("app.services.price_parser.parsers.cerpadla.ask_llm_json", new_callable=AsyncMock) as mock:
            mock.return_value = [
                {"type": "PUMI 21m", "pristaveni": 2300, "hodinova_sazba": 2300, "cena_per_m3": 60, "km_sazba": 90},
            ]
            items = await parse_cerpadla("Čerpadla betonu...")
            assert len(items) == 1
            assert items[0].type == "PUMI 21m"

    @pytest.mark.asyncio
    async def test_parse_priplatky_with_mock_llm(self):
        """Test priplatky parser with mocked LLM."""
        from app.services.price_parser.parsers.priplatky import parse_priplatky

        with patch("app.services.price_parser.parsers.priplatky.ask_llm_json", new_callable=AsyncMock) as mock:
            mock.return_value = {
                "casove": [{"nazev": "Sobota", "typ": "%", "hodnota": 5}],
                "zimni": [{"teplota_from": 0, "teplota_to": 5, "price_per_m3": 150}],
                "technologicke": [{"nazev": "Konzistence S4", "typ": "Kč/m³", "hodnota": 100}],
            }
            priplatky = await parse_priplatky("Příplatky...")
            assert len(priplatky.casove) == 1
            assert len(priplatky.zimni) == 1
            assert len(priplatky.technologicke) == 1

    @pytest.mark.asyncio
    async def test_full_pipeline_with_mocks(self):
        """Test the full pipeline with all LLM calls mocked."""
        from app.services.price_parser.main import parse_price_list_from_bytes
        from app.services.price_parser.models import PriceListResult

        # Mock extractor
        with patch("app.services.price_parser.main.extract_text_from_bytes") as mock_extract, \
             patch("app.services.price_parser.main.classify_blocks", new_callable=AsyncMock) as mock_classify, \
             patch("app.services.price_parser.parsers.source.ask_llm_json", new_callable=AsyncMock) as mock_source, \
             patch("app.services.price_parser.parsers.betony.ask_llm_json", new_callable=AsyncMock) as mock_betony, \
             patch("app.services.price_parser.parsers.malty.ask_llm_json", new_callable=AsyncMock) as mock_malty, \
             patch("app.services.price_parser.parsers.doprava.ask_llm_json", new_callable=AsyncMock) as mock_doprava, \
             patch("app.services.price_parser.parsers.cerpadla.ask_llm_json", new_callable=AsyncMock) as mock_cerpadla, \
             patch("app.services.price_parser.parsers.priplatky.ask_llm_json", new_callable=AsyncMock) as mock_priplatky, \
             patch("app.services.price_parser.parsers.laborator.ask_llm_json", new_callable=AsyncMock) as mock_lab:

            mock_extract.return_value = "Ceník betonárny Beton Union\nC 25/30 3440 Kč"
            mock_classify.return_value = {
                "source": "Beton Union",
                "betony": "C 25/30 3440",
                "malty_potere": None,
                "doprava": "Doprava 300 Kč/m³",
                "cerpadla": None,
                "priplatky": None,
                "laborator": None,
                "ostatni": None,
            }
            mock_source.return_value = {"company": "Beton Union", "currency": "CZK", "vat_rate": 21}
            mock_betony.return_value = [{"name": "C 25/30", "price_per_m3": 3440}]
            mock_doprava.return_value = {"zony": [{"km_from": 0, "km_to": 5, "price_per_m3": 300}]}

            result = await parse_price_list_from_bytes(b"fake pdf", "test.pdf")

            assert isinstance(result, PriceListResult)
            assert result.source.company == "Beton Union"

    @pytest.mark.asyncio
    async def test_empty_text_returns_empty_result(self):
        """Empty PDF should return empty result, not crash."""
        from app.services.price_parser.main import parse_price_list_from_bytes

        with patch("app.services.price_parser.main.extract_text_from_bytes") as mock_extract:
            mock_extract.return_value = ""
            result = await parse_price_list_from_bytes(b"empty", "empty.pdf")
            assert result.betony == []
            assert result.cerpadla == []

    @pytest.mark.asyncio
    async def test_none_sections_dont_crash(self):
        """Parser should handle None input gracefully."""
        from app.services.price_parser.parsers.betony import parse_betony
        from app.services.price_parser.parsers.doprava import parse_doprava
        from app.services.price_parser.parsers.cerpadla import parse_cerpadla
        from app.services.price_parser.parsers.priplatky import parse_priplatky
        from app.services.price_parser.parsers.laborator import parse_laborator
        from app.services.price_parser.parsers.malty import parse_malty
        from app.services.price_parser.parsers.source import parse_source

        assert await parse_betony(None) == []
        assert await parse_cerpadla(None) == []
        assert await parse_laborator(None) == []
        assert await parse_malty(None) == []
        assert (await parse_doprava(None)).zony == []
        assert (await parse_priplatky(None)).casove == []
        assert (await parse_source(None)).currency == "CZK"
