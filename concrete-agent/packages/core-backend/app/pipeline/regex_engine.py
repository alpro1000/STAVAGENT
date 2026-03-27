"""
Layer 3: Universal Regex Extraction Engine — deterministic, confidence=1.0.

Every extracted value has name, value, unit, confidence, source.
Type-specific extractors run based on classification result.
"""

import logging
import re
from typing import Any, Optional

from .models import (
    DocType,
    ExtractedData,
    ExtractedFact,
    ExtractionSource,
    IdentificationData,
    NormReference,
    QuantityItem,
    RiskItem,
    SectionOutline,
)

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════
#  MAIN ENTRY POINT
# ═══════════════════════════════════════════════════════════

def extract_all(
    text: str,
    doc_type: DocType,
    tables: Optional[list] = None,
) -> ExtractedData:
    """Run all applicable extractors. Returns ExtractedData with confidence=1.0 facts."""
    data = ExtractedData()

    # Universal extractors (run for ALL document types)
    data.identification = _extract_identification(text)
    data.norms = _extract_norms(text)
    data.sections_outline = _extract_sections(text)
    data.risks = _extract_risks(text)
    data.cross_references = _extract_cross_references(text)

    # Type-specific extractors
    type_extractors: dict[DocType, Any] = {
        DocType.TZ_SILNOPROUD: _extract_elektro,
        DocType.TZ_ZTI: _extract_zti,
        DocType.TZ_VZT: _extract_vzt,
        DocType.TZ_UT: _extract_ut,
        DocType.TZ_STATIKA: _extract_statika,
        DocType.TZ_PBRS: _extract_pbrs,
        DocType.GEOLOGIE: _extract_geologie,
        DocType.SOUPIS_PRACI: _extract_vykaz,
        DocType.VYKAZ_VYMER: _extract_vykaz,
        DocType.VYKRESY: _extract_vykres,
    }

    extractor = type_extractors.get(doc_type)
    if extractor:
        type_facts = extractor(text)
        data.facts.extend(type_facts)
    else:
        # Generic extraction for unknown types
        data.facts.extend(_extract_generic_params(text))

    # Always extract materials and equipment
    data.materials = _extract_materials(text)
    data.equipment = _extract_equipment(text)

    logger.info(
        f"[RegexEngine] Extracted: {len(data.facts)} facts, "
        f"{len(data.norms)} norms, {len(data.risks)} risks, "
        f"{len(data.materials)} materials, {len(data.equipment)} equipment"
    )
    return data


# ═══════════════════════════════════════════════════════════
#  UNIVERSAL EXTRACTORS
# ═══════════════════════════════════════════════════════════

def _extract_identification(text: str) -> IdentificationData:
    """Extract project identification from first ~3000 chars."""
    head = text[:3000]
    ident = IdentificationData()

    patterns = {
        "stavba": r"[Ss]tavba[:\s]+(.+?)(?:\n|Investor|Místo|Formát)",
        "investor": r"[Ii]nvestor[:\s]+(.+?)(?:\n|Tel|IČ|Stavba)",
        "misto": r"[Mm]ísto\s+stavby[:\s]+(.+?)(?:\n|Kraj|Investor)",
        "kraj": r"[Kk]raj[:\s]+(.+?)(?:\n|Okres|Místo)",
        "projektant": r"[Pp]rojektant[:\s]+(.+?)(?:\n|IČ|ČKAIT|Investor)",
        "datum": r"[Dd]atum[:\s]+(\d{1,2}[\./]\d{1,2}[\./]\d{2,4})",
        "cislo_zakazky": r"(?:číslo|č\.)\s*(?:zakázky|zak\.)[:\s]*(\S+)",
        "stupen_pd": r"(?:stupeň|stupen)\s*(?:PD)?[:\s]*(D[ÚU]R|DSP|DPS|DVZ|DSPS|PDPS)",
        "ico": r"IČ(?:O)?[:\s]*(\d{8})",
        "ckait": r"ČKAIT[:\s]*(\d{7})",
    }

    for field, pattern in patterns.items():
        m = re.search(pattern, head, re.IGNORECASE)
        if m:
            setattr(ident, field, m.group(1).strip())

    return ident


def _extract_norms(text: str) -> list[NormReference]:
    """Extract all referenced standards and norms."""
    norms: list[NormReference] = []
    seen: set[str] = set()

    patterns = [
        # ČSN, ČSN EN, ČSN ISO
        r"(ČSN\s+(?:EN\s+)?(?:ISO\s+)?\d[\d\s\-]+\d)",
        # Zákony, vyhlášky, nařízení
        r"(zákon\s+č\.\s*\d+/\d+\s*Sb\.)",
        r"(vyhláška\s+č\.\s*\d+/\d+\s*Sb\.)",
        r"(nařízení\s+vlády\s+č\.\s*\d+/\d+\s*Sb\.)",
        # TKP, VTP, TPG
        r"(TKP\s+\d+)",
        r"(VTP\s+\w+/\d+)",
        r"(TPG\s+\d[\d\s]+\d)",
        # EU
        r"(EU\s+(?:nařízení|směrnice)\s+\d+/\d+)",
        # Eurocode
        r"(Eurocode\s+\d+)",
        r"(EN\s+199\d[\-\d]*)",
    ]

    for pattern in patterns:
        for m in re.finditer(pattern, text, re.IGNORECASE):
            code = re.sub(r"\s+", " ", m.group(1).strip())
            if code not in seen:
                seen.add(code)
                norms.append(NormReference(code=code))

    return norms


def _extract_sections(text: str) -> list[SectionOutline]:
    """Extract document section headings."""
    sections: list[SectionOutline] = []
    seen: set[str] = set()

    for m in re.finditer(
        r"^(\d+(?:\.\d+){0,3})\s+([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][^\n]{5,80})",
        text,
        re.MULTILINE,
    ):
        num = m.group(1)
        title = m.group(2).strip()
        key = f"{num}|{title[:30]}"
        if key not in seen:
            seen.add(key)
            sections.append(SectionOutline(number=num, title=title))

    return sections[:50]  # cap at 50


def _extract_risks(text: str) -> list[RiskItem]:
    """Extract risk indicators from text."""
    risks: list[RiskItem] = []
    risk_patterns = [
        (r"(?i)zakáz[áa]no\s+(.{10,80})", "high"),
        (r"(?i)nebezpeč[ií]\s+(.{10,80})", "high"),
        (r"(?i)nutno\s+(.{10,80})", "medium"),
        (r"(?i)musí\s+být\s+(.{10,80})", "medium"),
        (r"(?i)podmínkou\s+je\s+(.{10,80})", "medium"),
        (r"(?i)pozor\s+(.{10,80})", "medium"),
        (r"(?i)upozorn[ěe]n[ií]\s+(.{10,80})", "low"),
        (r"(?i)doporuč(?:uje|ení)\s+(.{10,80})", "low"),
    ]
    seen: set[str] = set()
    for pattern, severity in risk_patterns:
        for m in re.finditer(pattern, text):
            txt = m.group(1).strip().rstrip(".")
            if txt not in seen:
                seen.add(txt)
                risks.append(RiskItem(severity=severity, text=txt))

    return risks[:30]


def _extract_cross_references(text: str) -> list[str]:
    """Extract mentions of other documents."""
    refs: list[str] = []
    seen: set[str] = set()
    patterns = [
        r"viz\s+příloha\s+(.{5,60})",
        r"dle\s+(?:posudku|výkresu|projektu)\s+(.{5,60})",
        r"(?:statický|geotechnický|geologický)\s+posudek",
        r"projekt\s+(?:hromosvodu|uzemn[ěe]n[ií]|elektro)",
    ]
    for pattern in patterns:
        for m in re.finditer(pattern, text, re.IGNORECASE):
            ref = m.group(0).strip() if m.lastindex is None else m.group(1).strip()
            if ref not in seen:
                seen.add(ref)
                refs.append(ref)
    return refs[:20]


def _extract_materials(text: str) -> list[str]:
    """Extract mentioned materials."""
    materials: set[str] = set()
    material_patterns = [
        r"(CYKY[\w\s\-+x\.]{3,30})",
        r"(CXKH[\w\s\-+x\.]{3,30})",
        r"(H07RN[\w\s\-+x\.]{3,20})",
        r"(AYKY[\w\s\-+x\.]{3,30})",
        r"(1-YY[\w\s\-+x\.]{3,30})",
        r"(NAYY[\w\s\-+x\.]{3,30})",
        r"(PPR\s+\w+)",
        r"(PE\s*\d+[\w\s]*)",
        r"(PVC[\-\s]\w+)",
        r"(C\d+/\d+[\s\-\w,]*)",       # concrete class
        r"(B500[ABC])",                  # steel grade
    ]
    for pattern in material_patterns:
        for m in re.finditer(pattern, text):
            materials.add(m.group(1).strip())
    return sorted(materials)[:50]


def _extract_equipment(text: str) -> list[str]:
    """Extract mentioned equipment/products."""
    equipment: set[str] = set()
    brands = [
        "SOLAX", "TIGO", "ESIT", "ABB", "Siemens", "Schneider", "OEZ",
        "Viessmann", "Junkers", "Bosch", "Vaillant", "Rehau", "Uponor",
        "Schiedel", "Danfoss", "Honeywell", "PERI", "DOKA", "ULMA",
    ]
    for brand in brands:
        pattern = rf"({re.escape(brand)}[\w\s\-]{{3,40}})"
        for m in re.finditer(pattern, text, re.IGNORECASE):
            equipment.add(m.group(1).strip())
    return sorted(equipment)[:30]


# ═══════════════════════════════════════════════════════════
#  TYPE-SPECIFIC EXTRACTORS
# ═══════════════════════════════════════════════════════════

def _fact(name: str, value: Any, unit: Optional[str] = None, raw: Optional[str] = None) -> ExtractedFact:
    return ExtractedFact(name=name, value=value, unit=unit, confidence=1.0, raw_text=raw)


def _extract_elektro(text: str) -> list[ExtractedFact]:
    """Extract electrical parameters (silnoproud, FVE)."""
    facts: list[ExtractedFact] = []
    patterns = [
        (r"(\d+[\.,]?\d*)\s*(kWp)\b", "installed_power"),
        (r"(\d+[\.,]?\d*)\s*(kW)\b", "power"),
        (r"(\d+[\.,]?\d*)\s*(kVA)\b", "apparent_power"),
        (r"(\d+[\.,]?\d*)\s*(MW)\b", "power_mw"),
        (r"(\d+)\s*(V)\b(?!\w)", "voltage"),
        (r"(\d+[\.,]?\d*)\s*(kV)\b", "voltage_kv"),
        (r"(\d+[\.,]?\d*)\s*(A)\b(?!\w)", "current"),
        (r"(\d+[\.,]?\d*)\s*(Hz)\b", "frequency"),
        (r"(IP\s*\d{2})\b", "ip_rating"),
    ]
    seen: set[str] = set()
    for pattern, name in patterns:
        for m in re.finditer(pattern, text):
            val = m.group(1).replace(",", ".")
            unit = m.group(2) if m.lastindex and m.lastindex >= 2 else None
            key = f"{name}:{val}:{unit}"
            if key not in seen:
                seen.add(key)
                try:
                    numeric = float(val)
                except ValueError:
                    numeric = val
                facts.append(_fact(name, numeric, unit, m.group(0)))

    return facts


def _extract_zti(text: str) -> list[ExtractedFact]:
    """Extract plumbing parameters (ZTI)."""
    facts: list[ExtractedFact] = []
    patterns = [
        (r"DN\s*(\d+)", "pipe_dn"),
        (r"(\d+[\.,]?\d*)\s*(l/s)", "flow_rate"),
        (r"(\d+[\.,]?\d*)\s*(m³/h)", "flow_rate_m3h"),
        (r"(\d+[\.,]?\d*)\s*(kPa|bar|MPa)", "pressure"),
        (r"(\d+[\.,]?\d*)\s*m³\s*(?:akumulační|retenční|nádrž)", "tank_volume"),
    ]
    for pattern, name in patterns:
        for m in re.finditer(pattern, text):
            val = m.group(1).replace(",", ".")
            unit = m.group(2) if m.lastindex and m.lastindex >= 2 else None
            try:
                facts.append(_fact(name, float(val), unit, m.group(0)))
            except ValueError:
                facts.append(_fact(name, val, unit, m.group(0)))
    return facts


def _extract_vzt(text: str) -> list[ExtractedFact]:
    """Extract HVAC parameters."""
    facts: list[ExtractedFact] = []
    patterns = [
        (r"(\d+[\.,]?\d*)\s*m[³3]/h", "airflow_m3h"),
        (r"(\d+[\.,]?\d*)\s*Pa\b", "static_pressure"),
        (r"(\d+[\.,]?\d*)\s*°C", "temperature"),
        (r"(\d+[\.,]?\d*)\s*%\s*(?:rh|RH|vlhkost)", "humidity"),
        (r"účinnost\s*(?:rekuperace)?\s*(\d+)\s*%", "recovery_efficiency"),
    ]
    for pattern, name in patterns:
        for m in re.finditer(pattern, text):
            val = m.group(1).replace(",", ".")
            try:
                facts.append(_fact(name, float(val), None, m.group(0)))
            except ValueError:
                pass
    return facts


def _extract_ut(text: str) -> list[ExtractedFact]:
    """Extract heating parameters."""
    facts: list[ExtractedFact] = []
    patterns = [
        (r"tepelné?\s+ztrát[ay]\s*[:=]?\s*(\d+[\.,]?\d*)\s*(kW)", "heat_loss"),
        (r"jmenovitý\s+výkon\s*[:=]?\s*(\d+[\.,]?\d*)\s*(kW)", "nominal_power"),
        (r"(\d+)/(\d+)\s*°C", "supply_return_temp"),
        (r"třída\s+([A-G])\b", "energy_class"),
    ]
    for pattern, name in patterns:
        for m in re.finditer(pattern, text, re.IGNORECASE):
            val = m.group(1).replace(",", ".")
            unit = m.group(2) if m.lastindex and m.lastindex >= 2 else None
            try:
                facts.append(_fact(name, float(val), unit, m.group(0)))
            except ValueError:
                facts.append(_fact(name, val, unit, m.group(0)))
    return facts


def _extract_statika(text: str) -> list[ExtractedFact]:
    """Extract structural parameters."""
    facts: list[ExtractedFact] = []
    patterns = [
        (r"C\s*(\d+)\s*/\s*(\d+)", "concrete_class"),
        (r"B\s*(\d+)\s*([A-C])", "steel_grade"),
        (r"(\d+[\.,]?\d*)\s*(kN/m[²2])", "load"),
        (r"(\d+[\.,]?\d*)\s*(kN/m)\b", "line_load"),
        (r"(\d+[\.,]?\d*)\s*(kN)\b", "point_load"),
        (r"krytí\s*(?:výztuže)?\s*(\d+)\s*mm", "cover"),
    ]
    for pattern, name in patterns:
        for m in re.finditer(pattern, text):
            raw = m.group(0)
            if name == "concrete_class":
                facts.append(_fact(name, f"C{m.group(1)}/{m.group(2)}", None, raw))
            elif name == "steel_grade":
                facts.append(_fact(name, f"B{m.group(1)}{m.group(2)}", None, raw))
            else:
                val = m.group(1).replace(",", ".")
                unit = m.group(2) if m.lastindex and m.lastindex >= 2 else None
                try:
                    facts.append(_fact(name, float(val), unit, raw))
                except ValueError:
                    pass
    return facts


def _extract_pbrs(text: str) -> list[ExtractedFact]:
    """Extract fire safety parameters."""
    facts: list[ExtractedFact] = []
    patterns = [
        (r"požární\s+úsek\s+(\S+)", "fire_compartment"),
        (r"SPB\s*[:=]?\s*(\w+)", "spb"),
        (r"požární\s+odolnost\s+(REI?\s*\d+)", "fire_resistance"),
    ]
    for pattern, name in patterns:
        for m in re.finditer(pattern, text, re.IGNORECASE):
            facts.append(_fact(name, m.group(1).strip(), None, m.group(0)))
    return facts


def _extract_geologie(text: str) -> list[ExtractedFact]:
    """Extract geological parameters."""
    facts: list[ExtractedFact] = []
    patterns = [
        (r"HPV\s*[:=]?\s*(\d+[\.,]?\d*)\s*m", "groundwater_hpv"),
        (r"Rdt\s*[:=]?\s*(\d+[\.,]?\d*)\s*(kPa|MPa)", "bearing_capacity"),
        (r"φ\s*[:=]?\s*(\d+[\.,]?\d*)\s*°", "friction_angle"),
        (r"c\s*[:=]?\s*(\d+[\.,]?\d*)\s*(kPa)", "cohesion"),
        (r"Edef\s*[:=]?\s*(\d+[\.,]?\d*)\s*(MPa)", "deformation_modulus"),
        (r"radon(?:ový)?\s+index\s*[:=]?\s*(\w+)", "radon_index"),
        (r"(XA[1-3])", "aggressivity"),
    ]
    for pattern, name in patterns:
        for m in re.finditer(pattern, text, re.IGNORECASE):
            val = m.group(1).replace(",", ".")
            unit = m.group(2) if m.lastindex and m.lastindex >= 2 else None
            try:
                facts.append(_fact(name, float(val), unit, m.group(0)))
            except ValueError:
                facts.append(_fact(name, val, unit, m.group(0)))
    return facts


def _extract_vykaz(text: str) -> list[ExtractedFact]:
    """Extract bill of quantities positions."""
    # This is for simple tabular extractions from text.
    # Complex XLSX parsing is handled by universal_parser.
    facts: list[ExtractedFact] = []
    # Simple position pattern: number + description + quantity + unit
    for m in re.finditer(
        r"^(\d{1,4})\s+(.{10,80}?)\s+(\d+[\.,]?\d*)\s+(ks|m|m²|m³|t|kg|kpl|hod|h)\b",
        text,
        re.MULTILINE,
    ):
        facts.append(_fact(
            "position",
            {"pc": m.group(1), "description": m.group(2).strip(),
             "quantity": float(m.group(3).replace(",", ".")), "unit": m.group(4)},
            None,
            m.group(0),
        ))
    return facts


def _extract_vykres(text: str) -> list[ExtractedFact]:
    """Extract drawing-specific data."""
    facts: list[ExtractedFact] = []
    # Scale
    for m in re.finditer(r"(1:\d{2,4})", text):
        facts.append(_fact("scale", m.group(1), None, m.group(0)))
    # Format
    for m in re.finditer(r"formát\s*(A\d)", text, re.IGNORECASE):
        facts.append(_fact("paper_format", m.group(1), None, m.group(0)))
    return facts


def _extract_generic_params(text: str) -> list[ExtractedFact]:
    """Fallback: extract common Czech construction parameters from any text."""
    facts: list[ExtractedFact] = []

    # Concrete classes
    for m in re.finditer(r"C\s*(\d+)\s*/\s*(\d+)", text):
        facts.append(_fact("concrete_class", f"C{m.group(1)}/{m.group(2)}", None, m.group(0)))

    # Steel grades
    for m in re.finditer(r"B\s*(500)\s*([A-C])", text):
        facts.append(_fact("steel_grade", f"B{m.group(1)}{m.group(2)}", None, m.group(0)))

    # Powers
    for m in re.finditer(r"(\d+[\.,]?\d*)\s*(kW|kWp|MW)\b", text):
        val = float(m.group(1).replace(",", "."))
        facts.append(_fact("power", val, m.group(2), m.group(0)))

    # DN values
    for m in re.finditer(r"DN\s*(\d+)", text):
        facts.append(_fact("pipe_dn", int(m.group(1)), "mm", m.group(0)))

    return facts
