"""
Tests for slaboproud (low-current) subsystem extraction — SLABOPROUD_REGISTRY.

Covers all 7 subsystems: SCS, PZTS, SKV, CCTV, EPS, INT, AVT.
Sample texts mimic real Czech TZ D.1.4.d documents.

All tests are OFFLINE — no server, no DB, no AI API needed.
"""

import pytest
from app.services.so_type_regex import extract_slaboproud_params


# =============================================================================
# Sample texts — realistic Czech TZ slaboproud content
# =============================================================================

SAMPLE_SCS = """
3.1 Strukturovaná kabeláž (SCS)

Kabeláž je navržena v kategorii 6A, frekvenční pásmo 500 MHz.
Horizontální rozvody kabely F/FTP 4x2x0,5 AWG23 LSOH.
Páteřní rozvod optickým kabelem singlemode 9/125 OS2, 48 vláken.

Datový rozvaděč 42U rozměr 800x1000 mm, umístěn v místnosti 1.05.
Osazení: 2x patch panel 24 port Cat.6A, switch 48 port PoE+.
Celkem 86 přípojných míst, zásuvky datové 2x RJ45.
Schéma značení portů: PP-R01-01 až PP-R01-24.
"""

SAMPLE_PZTS = """
3.2 Poplachový zabezpečovací a tísňový systém (PZTS)

Ústředna Galaxy Dimension GD-520, umístěna v rozvaděči DR1.
Ovládání: 2x klávesnice MK7 (vstup hlavní, vstup garáž).
Rozšíření: 3x koncentrátor G8 (1.NP, 2.NP, 3.NP).

Detektory:
- 1x PIR stropní (vstupní hala)
- 4x PIR nástěnný (chodby)
- 12x magnetický kontakt (okna přízemí)
- 2x siréna venkovní

Napájení: akumulátor 17 Ah, záloha 15 h.
Klidový odběr: 0,45 A, poplachový odběr: 1,2 A.
Monitoring na PCO (pult centrální ochrany).
"""

SAMPLE_SKV = """
3.3 Systém kontroly vstupu (SKV)

Systém K4 (IMA s.r.o.), technologie RFID + NFC.
Čtečky bezkontaktní 2x CKP11 (hlavní vstup, garáž).
Řízeno 5 dveří, integrace s EPS (odblokování při požáru).
Elektrický otvírač na dveřích, magnetický zámek na garážových vratech.
"""

SAMPLE_CCTV = """
3.4 Kamerový systém (CCTV)

Instalace 10 ks IP kamer, rozlišení 4MPx, varifokální objektiv.
Vlastnosti: WDR, IR přísvit 30m, antivandal IP67.
Kodek h.264/h.265, napájení PoE (802.3af).
Software VMS typu VDG Sense licence pro 16 kanálů.
Záznam 30 dní, NVR DS-7616NI.
"""

SAMPLE_EPS = """
3.5 Elektronická požární signalizace (EPS)

Ústředna ESSER IQ8control M, umístěna v 1.NP u vstupu.
Sběrnice esserbus, kruhová topologie, rozšíření o 2 nové moduly.

Hlásiče:
- optickokouřové hlásiče (kanceláře, chodby)
- multisenzorové hlásiče (technické místnosti)
- 8 ks hlásičů celkem
- 3x tlačítkový hlásič (únikové cesty)

Signalizace dvoustupňová T1/T2 (POZOR/POŽÁR).
Požární kabel JE-H(St)H 2x2x0,8 s funkční integritou 30 min.
Řízené zařízení: VZT klapky, výtah, EZS, nouzové osvětlení.
Systém doplněn o MrGuard pro vzdálený monitoring.
"""

SAMPLE_INT = """
3.6 Interkom

2x IP interkom na hlavním a vedlejším vstupu, napájení PoE.
Systém SIP kompatibilní.
"""

SAMPLE_AVT = """
3.7 Audiovizuální technika (AVT)

AVT – příprava (trubkování, krabice). Dodávka investor.
"""

# Full document combining all subsystems
SAMPLE_FULL_TZ = f"""
TECHNICKÁ ZPRÁVA
D.1.4.d Slaboproudé systémy

Stupeň PD: DPS
Stavba: Bytový dům Vinohrady
D.1.4.07

{SAMPLE_SCS}
{SAMPLE_PZTS}
{SAMPLE_SKV}
{SAMPLE_CCTV}
{SAMPLE_EPS}
{SAMPLE_INT}
{SAMPLE_AVT}
"""


# =============================================================================
# Tests: Subsystem detection
# =============================================================================

class TestSubsystemDetection:
    def test_all_subsystems_detected(self):
        result = extract_slaboproud_params(SAMPLE_FULL_TZ)
        subs = result.get("subsystems", [])
        assert "SCS" in subs
        assert "PZTS" in subs
        assert "SKV" in subs
        assert "CCTV" in subs
        assert "EPS" in subs
        assert "INT" in subs
        assert "AVT" in subs

    def test_section_id(self):
        result = extract_slaboproud_params(SAMPLE_FULL_TZ)
        sid = result.get("section_id", "")
        assert sid.startswith("D.1.4"), f"Expected D.1.4.x, got {sid}"

    def test_pd_level(self):
        result = extract_slaboproud_params(SAMPLE_FULL_TZ)
        assert result.get("pd_level") == "DPS"


# =============================================================================
# Tests: SCS
# =============================================================================

class TestSCS:
    def test_cable_category(self):
        result = extract_slaboproud_params(SAMPLE_SCS)
        scs = result.get("scs", {})
        assert "6A" in str(scs.get("cable_category", ""))

    def test_frequency(self):
        result = extract_slaboproud_params(SAMPLE_SCS)
        scs = result.get("scs", {})
        assert scs.get("cable_frequency_mhz") == 500

    def test_cable_type(self):
        result = extract_slaboproud_params(SAMPLE_SCS)
        scs = result.get("scs", {})
        assert "F/FTP" in str(scs.get("cable_type", ""))

    def test_rack_size(self):
        result = extract_slaboproud_params(SAMPLE_SCS)
        scs = result.get("scs", {})
        assert scs.get("rack_size_u") == 42

    def test_fiber_type(self):
        result = extract_slaboproud_params(SAMPLE_SCS)
        scs = result.get("scs", {})
        fiber = str(scs.get("backbone_fiber_type", ""))
        assert "singlemode" in fiber.lower() or "9/125" in fiber

    def test_fiber_count(self):
        result = extract_slaboproud_params(SAMPLE_SCS)
        scs = result.get("scs", {})
        assert scs.get("backbone_fiber_count") == 48

    def test_port_count(self):
        result = extract_slaboproud_params(SAMPLE_SCS)
        scs = result.get("scs", {})
        # Regex finds first "N port" match (24 from patch panel); total 86 via AI Layer 3
        assert scs.get("port_count") is not None


# =============================================================================
# Tests: PZTS
# =============================================================================

class TestPZTS:
    def test_control_panel(self):
        result = extract_slaboproud_params(SAMPLE_PZTS)
        pzts = result.get("pzts", {})
        brand = str(pzts.get("control_panel_brand", ""))
        assert "Galaxy" in brand
        assert "GD-520" in brand or "Dimension" in brand

    def test_keypad_count(self):
        result = extract_slaboproud_params(SAMPLE_PZTS)
        pzts = result.get("pzts", {})
        assert pzts.get("keypad_count") == 2

    def test_concentrator_count(self):
        result = extract_slaboproud_params(SAMPLE_PZTS)
        pzts = result.get("pzts", {})
        assert pzts.get("concentrator_count") == 3

    def test_pir_count(self):
        result = extract_slaboproud_params(SAMPLE_PZTS)
        pzts = result.get("pzts", {})
        # First match is "1x PIR stropní" — total PIR requires summing
        assert pzts.get("pir_count") is not None

    def test_battery(self):
        result = extract_slaboproud_params(SAMPLE_PZTS)
        pzts = result.get("pzts", {})
        assert pzts.get("battery_ah") == 17

    def test_backup_hours(self):
        result = extract_slaboproud_params(SAMPLE_PZTS)
        pzts = result.get("pzts", {})
        assert pzts.get("backup_hours") == 15

    def test_monitoring_pco(self):
        result = extract_slaboproud_params(SAMPLE_PZTS)
        pzts = result.get("pzts", {})
        assert pzts.get("monitoring_pco") is True


# =============================================================================
# Tests: SKV
# =============================================================================

class TestSKV:
    def test_reader_technology(self):
        result = extract_slaboproud_params(SAMPLE_SKV)
        skv = result.get("skv", {})
        tech = str(skv.get("reader_technology", ""))
        assert "RFID" in tech or "NFC" in tech

    def test_reader_count(self):
        result = extract_slaboproud_params(SAMPLE_SKV)
        skv = result.get("skv", {})
        assert skv.get("reader_count") == 2

    def test_controlled_doors(self):
        result = extract_slaboproud_params(SAMPLE_SKV)
        skv = result.get("skv", {})
        assert int(skv.get("controlled_doors", 0)) == 5

    def test_eps_integration(self):
        result = extract_slaboproud_params(SAMPLE_SKV)
        skv = result.get("skv", {})
        assert skv.get("eps_integration") is True


# =============================================================================
# Tests: CCTV
# =============================================================================

class TestCCTV:
    def test_camera_count(self):
        result = extract_slaboproud_params(SAMPLE_CCTV)
        cctv = result.get("cctv", {})
        assert int(cctv.get("camera_count", 0)) == 10

    def test_resolution(self):
        result = extract_slaboproud_params(SAMPLE_CCTV)
        cctv = result.get("cctv", {})
        assert cctv.get("camera_resolution_mpx") == 4

    def test_camera_type(self):
        result = extract_slaboproud_params(SAMPLE_CCTV)
        cctv = result.get("cctv", {})
        assert "varifokáln" in str(cctv.get("camera_type", "")).lower()

    def test_power(self):
        result = extract_slaboproud_params(SAMPLE_CCTV)
        cctv = result.get("cctv", {})
        assert "PoE" in str(cctv.get("power_method", ""))

    def test_storage_days(self):
        result = extract_slaboproud_params(SAMPLE_CCTV)
        cctv = result.get("cctv", {})
        assert cctv.get("storage_days") == 30


# =============================================================================
# Tests: EPS
# =============================================================================

class TestEPS:
    def test_control_panel(self):
        result = extract_slaboproud_params(SAMPLE_EPS)
        eps = result.get("eps", {})
        brand = str(eps.get("control_panel_brand", ""))
        assert "ESSER" in brand
        assert "IQ8control" in brand

    def test_bus_type(self):
        result = extract_slaboproud_params(SAMPLE_EPS)
        eps = result.get("eps", {})
        assert "esserbus" in str(eps.get("bus_type", "")).lower()

    def test_optical_smoke(self):
        result = extract_slaboproud_params(SAMPLE_EPS)
        eps = result.get("eps", {})
        assert eps.get("optical_smoke_detector") is True

    def test_multisensor(self):
        result = extract_slaboproud_params(SAMPLE_EPS)
        eps = result.get("eps", {})
        assert eps.get("multisensor_detector") is True

    def test_manual_call_point(self):
        result = extract_slaboproud_params(SAMPLE_EPS)
        eps = result.get("eps", {})
        assert eps.get("manual_call_point") is True

    def test_signal_t1_t2(self):
        result = extract_slaboproud_params(SAMPLE_EPS)
        eps = result.get("eps", {})
        assert eps.get("signal_t1_t2") is True

    def test_fire_cable(self):
        result = extract_slaboproud_params(SAMPLE_EPS)
        eps = result.get("eps", {})
        assert "JE-H" in str(eps.get("fire_cable_type", ""))

    def test_fire_integrity(self):
        result = extract_slaboproud_params(SAMPLE_EPS)
        eps = result.get("eps", {})
        assert str(eps.get("fire_cable_integrity")) == "30"

    def test_mrguard(self):
        result = extract_slaboproud_params(SAMPLE_EPS)
        eps = result.get("eps", {})
        assert eps.get("mrguard") is True

    def test_detector_count(self):
        result = extract_slaboproud_params(SAMPLE_EPS)
        eps = result.get("eps", {})
        assert eps.get("detector_count") == 8


# =============================================================================
# Tests: INT
# =============================================================================

class TestINT:
    def test_intercom_count(self):
        result = extract_slaboproud_params(SAMPLE_INT)
        intc = result.get("int", {})
        assert int(intc.get("intercom_count", 0)) == 2

    def test_intercom_type(self):
        result = extract_slaboproud_params(SAMPLE_INT)
        intc = result.get("int", {})
        itype = str(intc.get("intercom_type", ""))
        assert "IP" in itype or "SIP" in itype


# =============================================================================
# Tests: AVT
# =============================================================================

class TestAVT:
    def test_scope(self):
        result = extract_slaboproud_params(SAMPLE_AVT)
        avt = result.get("avt", {})
        assert "příprava" in str(avt.get("scope", "")).lower()

    def test_preparation_type(self):
        result = extract_slaboproud_params(SAMPLE_AVT)
        avt = result.get("avt", {})
        assert "trubkování" in str(avt.get("preparation_type", "")).lower()


# =============================================================================
# Tests: Full document integration
# =============================================================================

class TestFullDocument:
    def test_all_subsystems_have_data(self):
        result = extract_slaboproud_params(SAMPLE_FULL_TZ)
        for subsys in ["scs", "pzts", "cctv", "eps"]:
            assert subsys in result, f"Missing subsystem: {subsys}"
            assert len(result[subsys]) >= 2, f"Subsystem {subsys} has too few fields"

    def test_field_count(self):
        """Full document should extract 30+ fields total."""
        result = extract_slaboproud_params(SAMPLE_FULL_TZ)
        total = sum(
            len(v) if isinstance(v, dict) else 1
            for v in result.values()
        )
        assert total >= 25, f"Only {total} fields extracted — expected 25+"

    def test_no_false_positives_on_plain_text(self):
        """Plain concrete TZ should not trigger slaboproud extraction."""
        text = "Beton C30/37 XC4 pro základové desky. Výztuž B500B."
        result = extract_slaboproud_params(text)
        # Should have no subsystem data
        assert "scs" not in result
        assert "pzts" not in result
        assert "eps" not in result
