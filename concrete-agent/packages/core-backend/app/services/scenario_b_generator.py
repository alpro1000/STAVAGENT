"""
Scenario B: TZ → Volumes → Výkaz výměr

Generates bill of quantities (výkaz výměr) from technical documentation (TZ).
Unlike Workflow B (drawings → estimate), this extracts structural compositions
and volumes directly from TZ text, not from drawings.

Pipeline:
  1. Parse TZ document (PDF/DOCX/DWG) → text
  2. Extract construction elements (Gemini: structure types, concrete classes, dimensions)
  3. Extract volumes from TZ text (ONLY from the uploaded document, never from examples)
  4. Generate výkaz výměr positions (beton + výztuž + bednění per element)
  5. Assign OTSKP codes (code_detector)

Note: All volumes come strictly from the uploaded TZ document.
"""

import logging
import json
from typing import Dict, Any, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# Prompt for extracting construction elements from TZ
EXTRACT_ELEMENTS_PROMPT = """Jsi expert na české stavební technické zprávy (TZ).

Z následujícího textu technické zprávy EXTRAHUJ všechny monolitické betonové konstrukce.

Pro KAŽDOU konstrukci uveď:
- nazev: název konstrukce (např. "Základová deska", "Opěrná zeď OP1")
- typ: typ elementu (zakladova_deska, zakladovy_pas, stena, sloup, stropni_deska, mostovka, pilir, opera, rimsa, schodiste, jiny)
- beton_trida: třída betonu (např. "C30/37")
- stupen_vlivu: stupeň vlivu prostředí (např. "XC2", "XF3")
- rozmery: rozměry z TZ (tloušťka, šířka, délka, výška) — POUZE pokud jsou v textu
- objem_m3: objem v m³ — POUZE pokud je v textu (nedoplňuj vlastní odhady)
- plocha_m2: plocha bednění v m² — POUZE pokud je v textu
- armatura_kg_m3: vyztužení v kg/m³ — POUZE pokud je v textu
- poznamky: relevantní poznámky z TZ (dilatační spáry, etapizace, betonáž v taktech)

DŮLEŽITÉ:
- Extrahuj POUZE data, která jsou přímo v textu
- NEVYMÝŠLEJ objemy ani rozměry, které v textu nejsou
- Pokud objem není uveden, ponech null
- Odpověz POUZE validním JSON polem

Text TZ:
{text}

Odpověz jako JSON pole:
[
  {{
    "nazev": "...",
    "typ": "...",
    "beton_trida": "...",
    "stupen_vlivu": "...",
    "rozmery": {{ "tloustka_m": null, "sirka_m": null, "delka_m": null, "vyska_m": null }},
    "objem_m3": null,
    "plocha_m2": null,
    "armatura_kg_m3": null,
    "poznamky": "..."
  }}
]"""

# Prompt for generating výkaz výměr from extracted elements
GENERATE_VYKAZ_PROMPT = """Na základě extrahovaných konstrukcí vytvoř výkaz výměr (soupis prací).

Pro KAŽDOU konstrukci vytvoř standardní sadu pozic:
1. Betonáž (m³) — třída betonu, stupeň vlivu
2. Výztuž (t nebo kg) — pokud je znám podíl vyztužení
3. Bednění (m²) — pokud je známa plocha

Pravidla:
- Kódy generuj ve formátu OTSKP (6 číslic, začínají 2xxxxx pro beton, 3xxxxx pro výztuž, 4xxxxx pro bednění)
- Každá pozice: kod, popis, mnozstvi, mj (m³/t/m²), poznamka
- Pokud objem není znám, uveď 0 a poznámku "Doplnit dle výkresů"
- NEVYMÝŠLEJ množství — použij POUZE data z extrakce

Extrahované konstrukce:
{elements}

Odpověz jako JSON pole pozic:
[
  {{
    "kod": "231311...",
    "popis": "Betonáž základové desky z betonu C30/37 XC2",
    "mnozstvi": 0,
    "mj": "m³",
    "typ_prace": "beton",
    "konstrukce": "Základová deska",
    "beton_trida": "C30/37",
    "poznamka": "..."
  }}
]"""


class ScenarioBGenerator:
    """Generates výkaz výměr from technical documentation (TZ)."""

    def __init__(self):
        self._gemini_client = None

    async def _get_gemini(self):
        """Lazy-init Gemini client."""
        if self._gemini_client is None:
            try:
                from app.core.gemini_client import VertexGeminiClient
                self._gemini_client = VertexGeminiClient()
            except Exception:
                from app.core.gemini_client import GeminiClient
                self._gemini_client = GeminiClient()
        return self._gemini_client

    async def generate_from_tz(
        self,
        text: str,
        filename: str = "",
        project_name: str = "",
    ) -> Dict[str, Any]:
        """
        Full pipeline: TZ text → extracted elements → výkaz výměr.

        Args:
            text: Full text of the TZ document (already parsed from PDF/DOCX)
            filename: Original filename for context
            project_name: Project name

        Returns:
            Dict with elements, positions, warnings
        """
        logger.info(f"ScenarioB: Generating výkaz from TZ ({len(text)} chars)")

        # Step 1: Extract construction elements
        elements = await self._extract_elements(text)
        logger.info(f"ScenarioB: Extracted {len(elements)} construction elements")

        if not elements:
            return {
                "success": False,
                "error": "Žádné betonové konstrukce nenalezeny v dokumentu",
                "elements": [],
                "positions": [],
                "warnings": ["TZ neobsahuje popis monolitických betonových konstrukcí"],
            }

        # Step 2: Generate výkaz výměr positions
        positions = await self._generate_positions(elements)
        logger.info(f"ScenarioB: Generated {len(positions)} positions")

        # Step 3: Detect OTSKP codes
        positions = await self._detect_codes(positions)

        # Step 4: Build warnings
        warnings = []
        zero_qty = [p for p in positions if not p.get("mnozstvi")]
        if zero_qty:
            warnings.append(f"{len(zero_qty)} pozic bez množství — doplnit dle výkresů")

        elements_without_volume = [e for e in elements if not e.get("objem_m3")]
        if elements_without_volume:
            names = [e["nazev"] for e in elements_without_volume[:5]]
            warnings.append(f"Objemy nenalezeny v TZ pro: {', '.join(names)}")

        return {
            "success": True,
            "project_name": project_name,
            "source_file": filename,
            "elements": elements,
            "positions": positions,
            "total_elements": len(elements),
            "total_positions": len(positions),
            "warnings": warnings,
            "summary": {
                "beton_m3": sum(p.get("mnozstvi", 0) for p in positions if p.get("mj") == "m³"),
                "vyzuz_t": sum(p.get("mnozstvi", 0) for p in positions if p.get("mj") == "t"),
                "bedneni_m2": sum(p.get("mnozstvi", 0) for p in positions if p.get("mj") == "m²"),
                "beton_tridy": list(set(e.get("beton_trida", "") for e in elements if e.get("beton_trida"))),
            },
        }

    async def _extract_elements(self, text: str) -> List[Dict[str, Any]]:
        """Extract construction elements from TZ text using Gemini."""
        gemini = await self._get_gemini()

        # Truncate text to fit context window
        max_chars = 30000
        truncated = text[:max_chars] if len(text) > max_chars else text

        prompt = EXTRACT_ELEMENTS_PROMPT.replace("{text}", truncated)

        try:
            response = await gemini.acall(prompt)
            # Parse JSON from response
            json_str = response.strip()
            if json_str.startswith("```"):
                json_str = json_str.split("```")[1]
                if json_str.startswith("json"):
                    json_str = json_str[4:]
            elements = json.loads(json_str)
            if not isinstance(elements, list):
                elements = [elements]
            return elements
        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"ScenarioB: Element extraction failed: {e}")
            return []

    async def _generate_positions(self, elements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate výkaz výměr positions from extracted elements."""
        gemini = await self._get_gemini()

        prompt = GENERATE_VYKAZ_PROMPT.replace("{elements}", json.dumps(elements, ensure_ascii=False, indent=2))

        try:
            response = await gemini.acall(prompt)
            json_str = response.strip()
            if json_str.startswith("```"):
                json_str = json_str.split("```")[1]
                if json_str.startswith("json"):
                    json_str = json_str[4:]
            positions = json.loads(json_str)
            if not isinstance(positions, list):
                positions = [positions]
            return positions
        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"ScenarioB: Position generation failed: {e}")
            # Fallback: generate basic positions from elements
            return self._fallback_positions(elements)

    def _fallback_positions(self, elements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Deterministic fallback: generate positions without LLM."""
        positions = []
        for i, elem in enumerate(elements, 1):
            nazev = elem.get("nazev", f"Konstrukce {i}")
            beton = elem.get("beton_trida", "C30/37")
            objem = elem.get("objem_m3") or 0
            plocha = elem.get("plocha_m2") or 0
            arm_rate = elem.get("armatura_kg_m3") or 0

            # Beton position
            positions.append({
                "kod": f"23{i:04d}1",
                "popis": f"Betonáž {nazev} z betonu {beton}",
                "mnozstvi": objem,
                "mj": "m³",
                "typ_prace": "beton",
                "konstrukce": nazev,
                "beton_trida": beton,
                "poznamka": "" if objem else "Doplnit dle výkresů",
            })

            # Výztuž position (if rate known)
            if arm_rate and objem:
                positions.append({
                    "kod": f"36{i:04d}1",
                    "popis": f"Výztuž {nazev} z oceli B500B",
                    "mnozstvi": round(arm_rate * objem / 1000, 2),  # kg → t
                    "mj": "t",
                    "typ_prace": "vyzuz",
                    "konstrukce": nazev,
                    "poznamka": f"{arm_rate} kg/m³",
                })

            # Bednění position (if area known)
            if plocha:
                positions.append({
                    "kod": f"35{i:04d}1",
                    "popis": f"Bednění {nazev}",
                    "mnozstvi": plocha,
                    "mj": "m²",
                    "typ_prace": "bedneni",
                    "konstrukce": nazev,
                    "poznamka": "",
                })

        return positions

    async def _detect_codes(self, positions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Try to detect real OTSKP codes for generated positions."""
        try:
            from app.services.code_detector import detect_code_system
            for pos in positions:
                result = detect_code_system(pos.get("kod", ""), pos.get("popis", ""))
                if result and result.get("confidence", 0) > 0.7:
                    pos["otskp_code"] = result.get("code_normalized")
                    pos["otskp_confidence"] = result.get("confidence")
        except Exception as e:
            logger.debug(f"Code detection skipped: {e}")
        return positions


# Singleton
scenario_b = ScenarioBGenerator()
