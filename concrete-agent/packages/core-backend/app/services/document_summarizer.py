"""
Document Summarizer Service

Extracts structured data from construction documents (PDF, Excel, DOCX).
Unlike summary_generator.py (audit-focused), this module extracts:
- Project info (name, location, type, investor)
- Work items (all positions with quantities)
- Key quantities summary (total concrete, reinforcement, formwork)
- Timeline (start, end, milestones)
- Requirements (standards, environmental, safety)

Version: 1.0.0
Date: 2026-01-08
"""

import json
import logging
import time
import re
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from app.core.config import settings
from app.core.claude_client import ClaudeClient

logger = logging.getLogger(__name__)


class DocumentLanguage(str, Enum):
    """Language for document processing"""
    CZECH = "cs"
    ENGLISH = "en"
    SLOVAK = "sk"


@dataclass
class WorkItem:
    """Single work item extracted from document"""
    work_type: str  # e.g., "Beton C30/37"
    quantity: float
    unit: str  # e.g., "m³", "t", "m²"
    note: str = ""
    source_row: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.work_type,
            "quantity": self.quantity,
            "unit": self.unit,
            "note": self.note,
            "source_row": self.source_row,
        }


@dataclass
class ProjectInfo:
    """Project identification information"""
    name: str
    location: str = ""
    construction_type: str = ""  # bridge, building, road, etc.
    investor: str = ""
    object_id: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "location": self.location,
            "type": self.construction_type,
            "investor": self.investor,
            "object_id": self.object_id,
        }


@dataclass
class KeyQuantities:
    """Summary of key quantities"""
    total_concrete_m3: float = 0.0
    total_reinforcement_t: float = 0.0
    total_formwork_m2: float = 0.0
    estimated_cost_czk: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "total_concrete_m3": self.total_concrete_m3,
            "total_reinforcement_t": self.total_reinforcement_t,
            "total_formwork_m2": self.total_formwork_m2,
        }
        if self.estimated_cost_czk is not None:
            result["estimated_cost_czk"] = self.estimated_cost_czk
        return result


@dataclass
class Timeline:
    """Project timeline information"""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    milestones: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "start": self.start_date,
            "end": self.end_date,
            "milestones": self.milestones,
        }


@dataclass
class DocumentSummary:
    """Complete structured summary of a document"""
    project_info: ProjectInfo
    work_items: List[WorkItem]
    quantities: KeyQuantities
    timeline: Timeline
    requirements: List[str]

    # Metadata
    source_file: str
    extracted_at: datetime
    extraction_time_seconds: float
    confidence: float
    language: DocumentLanguage

    def to_dict(self) -> Dict[str, Any]:
        return {
            "project_info": self.project_info.to_dict(),
            "work_items": [item.to_dict() for item in self.work_items],
            "quantities": self.quantities.to_dict(),
            "timeline": self.timeline.to_dict(),
            "requirements": self.requirements,
            "metadata": {
                "source_file": self.source_file,
                "extracted_at": self.extracted_at.isoformat(),
                "extraction_time_seconds": self.extraction_time_seconds,
                "confidence": self.confidence,
                "language": self.language.value,
            },
        }


class DocumentSummarizer:
    """
    Extracts structured data from construction documents.

    Uses LLM to intelligently parse documents and extract:
    - Project information
    - Work items with quantities
    - Key totals
    - Timeline
    - Requirements/standards
    """

    # LLM prompt for structured extraction (Czech)
    EXTRACTION_PROMPT_CS = """Analyzuj tento stavební dokument a extrahuj strukturované informace.

DOKUMENT:
{document_content}

Vrať JSON s těmito sekcemi:

1. **project_info** - Informace o projektu:
   - name: Název projektu/stavby
   - location: Místo realizace (km, adresa, město)
   - type: Typ stavby (most, budova, silnice, tunel, inženýrská síť, jiné)
   - investor: Investor/Objednatel (pokud je uveden)
   - object_id: ID objektu (SO-xxx, IO-xxx, apod.)

2. **work_items** - Seznam VŠECH pracovních položek:
   Každá položka obsahuje:
   - type: Typ práce (např. "Beton C30/37", "Výztuž B500B", "Bednění systémové")
   - quantity: Množství (číslo)
   - unit: Jednotka (m³, t, kg, m², ks, m, apod.)
   - note: Poznámka (umístění, specifikace)

3. **quantities** - Souhrnné klíčové objemy:
   - total_concrete_m3: Celkový objem betonu v m³
   - total_reinforcement_t: Celková hmotnost výztuže v tunách (pokud v kg, přepočítej)
   - total_formwork_m2: Celková plocha bednění v m²
   - estimated_cost_czk: Odhadovaná cena v CZK (pokud je uvedena)

4. **timeline** - Časový harmonogram:
   - start: Datum zahájení (YYYY-MM-DD nebo null)
   - end: Datum dokončení (YYYY-MM-DD nebo null)
   - milestones: Seznam milníků ["Založení: YYYY-MM-DD", "Nosná kce: YYYY-MM-DD"]

5. **requirements** - Seznam požadavků a norem:
   - Stavební normy (ČSN EN, TKP, atd.)
   - Environmentální požadavky
   - Bezpečnostní požadavky (BOZP)
   - Kvalitativní požadavky

DŮLEŽITÉ:
- Extrahuj VŠECHNY pracovní položky, ne jen beton
- Pokud hodnota není v dokumentu, použij null nebo prázdný seznam
- Množství převeď na čísla (bez textu jako "cca" nebo "přibližně")
- Pro výztuž v kg přepočítej na tuny (děleno 1000)

Odpověz POUZE validním JSON bez dalšího textu:
{{
    "project_info": {{"name": "...", "location": "...", "type": "...", "investor": "...", "object_id": "..."}},
    "work_items": [{{"type": "...", "quantity": 0.0, "unit": "...", "note": "..."}}],
    "quantities": {{"total_concrete_m3": 0.0, "total_reinforcement_t": 0.0, "total_formwork_m2": 0.0, "estimated_cost_czk": null}},
    "timeline": {{"start": null, "end": null, "milestones": []}},
    "requirements": []
}}"""

    EXTRACTION_PROMPT_EN = """Analyze this construction document and extract structured information.

DOCUMENT:
{document_content}

Return JSON with these sections:

1. **project_info** - Project information:
   - name: Project/structure name
   - location: Location (km, address, city)
   - type: Construction type (bridge, building, road, tunnel, utilities, other)
   - investor: Client/Investor (if mentioned)
   - object_id: Object ID (SO-xxx, IO-xxx, etc.)

2. **work_items** - List of ALL work items:
   Each item contains:
   - type: Work type (e.g., "Concrete C30/37", "Reinforcement B500B", "Formwork system")
   - quantity: Quantity (number)
   - unit: Unit (m³, t, kg, m², pcs, m, etc.)
   - note: Note (location, specification)

3. **quantities** - Summary of key quantities:
   - total_concrete_m3: Total concrete volume in m³
   - total_reinforcement_t: Total reinforcement weight in tons
   - total_formwork_m2: Total formwork area in m²
   - estimated_cost_czk: Estimated cost in CZK (if available)

4. **timeline** - Schedule:
   - start: Start date (YYYY-MM-DD or null)
   - end: Completion date (YYYY-MM-DD or null)
   - milestones: List of milestones ["Foundation: YYYY-MM-DD", "Superstructure: YYYY-MM-DD"]

5. **requirements** - List of requirements and standards:
   - Construction standards (EN, local codes)
   - Environmental requirements
   - Safety requirements (H&S)
   - Quality requirements

IMPORTANT:
- Extract ALL work items, not just concrete
- Use null or empty list if value is not in document
- Convert quantities to numbers (remove text like "approx.")
- Convert reinforcement in kg to tons (divide by 1000)

Respond ONLY with valid JSON without any other text:
{{
    "project_info": {{"name": "...", "location": "...", "type": "...", "investor": "...", "object_id": "..."}},
    "work_items": [{{"type": "...", "quantity": 0.0, "unit": "...", "note": "..."}}],
    "quantities": {{"total_concrete_m3": 0.0, "total_reinforcement_t": 0.0, "total_formwork_m2": 0.0, "estimated_cost_czk": null}},
    "timeline": {{"start": null, "end": null, "milestones": []}},
    "requirements": []
}}"""

    def __init__(self):
        self.claude = ClaudeClient()

    async def summarize_document(
        self,
        content: str,
        file_name: str,
        language: DocumentLanguage = DocumentLanguage.CZECH,
    ) -> DocumentSummary:
        """
        Extract structured data from document content.

        Args:
            content: Text content extracted from document (PDF, Excel, DOCX)
            file_name: Original file name for metadata
            language: Language for extraction (affects prompt)

        Returns:
            DocumentSummary with all extracted data
        """
        start_time = time.time()

        logger.info(f"Starting document summarization for: {file_name}")

        # Select prompt based on language
        if language == DocumentLanguage.CZECH:
            prompt = self.EXTRACTION_PROMPT_CS.format(document_content=content[:30000])
        elif language == DocumentLanguage.SLOVAK:
            # Slovak uses Czech prompt (similar language)
            prompt = self.EXTRACTION_PROMPT_CS.format(document_content=content[:30000])
        else:
            prompt = self.EXTRACTION_PROMPT_EN.format(document_content=content[:30000])

        # Call LLM
        try:
            response = await self.claude.generate(
                prompt=prompt,
                max_tokens=4000,
                temperature=0.1,  # Low temperature for structured extraction
            )

            # Parse JSON response
            extracted_data = self._parse_llm_response(response)
            confidence = 0.85 if extracted_data else 0.3

        except Exception as e:
            logger.error(f"LLM extraction failed: {e}")
            extracted_data = self._create_empty_extraction()
            confidence = 0.0

        extraction_time = time.time() - start_time

        # Build structured summary
        summary = self._build_summary(
            extracted_data=extracted_data,
            file_name=file_name,
            extraction_time=extraction_time,
            confidence=confidence,
            language=language,
        )

        logger.info(
            f"Document summarization complete: {len(summary.work_items)} work items, "
            f"{summary.quantities.total_concrete_m3:.2f} m³ concrete, "
            f"confidence: {confidence:.0%}"
        )

        return summary

    def _parse_llm_response(self, response: str) -> Dict[str, Any]:
        """Parse LLM response to extract JSON"""
        try:
            # Try direct JSON parse
            return json.loads(response)
        except json.JSONDecodeError:
            pass

        # Try to find JSON in response
        try:
            # Match JSON object
            json_match = re.search(r'\{[\s\S]*"project_info"[\s\S]*\}', response)
            if json_match:
                return json.loads(json_match.group())
        except (json.JSONDecodeError, AttributeError):
            pass

        # Try to extract from markdown code block
        try:
            code_block = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response)
            if code_block:
                return json.loads(code_block.group(1))
        except (json.JSONDecodeError, AttributeError):
            pass

        logger.warning("Failed to parse LLM response as JSON")
        return self._create_empty_extraction()

    def _create_empty_extraction(self) -> Dict[str, Any]:
        """Create empty extraction structure"""
        return {
            "project_info": {
                "name": "",
                "location": "",
                "type": "",
                "investor": "",
                "object_id": "",
            },
            "work_items": [],
            "quantities": {
                "total_concrete_m3": 0.0,
                "total_reinforcement_t": 0.0,
                "total_formwork_m2": 0.0,
                "estimated_cost_czk": None,
            },
            "timeline": {
                "start": None,
                "end": None,
                "milestones": [],
            },
            "requirements": [],
        }

    def _build_summary(
        self,
        extracted_data: Dict[str, Any],
        file_name: str,
        extraction_time: float,
        confidence: float,
        language: DocumentLanguage,
    ) -> DocumentSummary:
        """Build DocumentSummary from extracted data"""

        # Build ProjectInfo
        pi_data = extracted_data.get("project_info", {})
        project_info = ProjectInfo(
            name=pi_data.get("name", "") or "",
            location=pi_data.get("location", "") or "",
            construction_type=pi_data.get("type", "") or "",
            investor=pi_data.get("investor", "") or "",
            object_id=pi_data.get("object_id", "") or "",
        )

        # Build WorkItems
        work_items = []
        for item in extracted_data.get("work_items", []):
            if isinstance(item, dict):
                work_items.append(WorkItem(
                    work_type=item.get("type", "") or "",
                    quantity=self._safe_float(item.get("quantity", 0)),
                    unit=item.get("unit", "") or "",
                    note=item.get("note", "") or "",
                    source_row=item.get("source_row"),
                ))

        # Build KeyQuantities
        q_data = extracted_data.get("quantities", {})
        quantities = KeyQuantities(
            total_concrete_m3=self._safe_float(q_data.get("total_concrete_m3", 0)),
            total_reinforcement_t=self._safe_float(q_data.get("total_reinforcement_t", 0)),
            total_formwork_m2=self._safe_float(q_data.get("total_formwork_m2", 0)),
            estimated_cost_czk=self._safe_float(q_data.get("estimated_cost_czk")) if q_data.get("estimated_cost_czk") else None,
        )

        # Build Timeline
        t_data = extracted_data.get("timeline", {})
        timeline = Timeline(
            start_date=t_data.get("start"),
            end_date=t_data.get("end"),
            milestones=t_data.get("milestones", []) or [],
        )

        # Requirements
        requirements = extracted_data.get("requirements", []) or []
        if not isinstance(requirements, list):
            requirements = [str(requirements)]

        return DocumentSummary(
            project_info=project_info,
            work_items=work_items,
            quantities=quantities,
            timeline=timeline,
            requirements=requirements,
            source_file=file_name,
            extracted_at=datetime.now(),
            extraction_time_seconds=extraction_time,
            confidence=confidence,
            language=language,
        )

    def _safe_float(self, value: Any) -> float:
        """Safely convert value to float"""
        if value is None:
            return 0.0
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            # Remove common text patterns
            cleaned = re.sub(r'[^\d.,\-]', '', value)
            # Handle European format (1.234,56)
            if ',' in cleaned and '.' in cleaned:
                cleaned = cleaned.replace('.', '').replace(',', '.')
            elif ',' in cleaned:
                cleaned = cleaned.replace(',', '.')
            try:
                return float(cleaned) if cleaned else 0.0
            except ValueError:
                return 0.0
        return 0.0


# Convenience function for direct use
async def summarize_document(
    content: str,
    file_name: str,
    language: str = "cs",
) -> Dict[str, Any]:
    """
    Convenience function to summarize a document.

    Args:
        content: Text content from document
        file_name: Original file name
        language: Language code (cs, en, sk)

    Returns:
        Dictionary with structured summary
    """
    summarizer = DocumentSummarizer()

    lang = DocumentLanguage.CZECH
    if language == "en":
        lang = DocumentLanguage.ENGLISH
    elif language == "sk":
        lang = DocumentLanguage.SLOVAK

    summary = await summarizer.summarize_document(
        content=content,
        file_name=file_name,
        language=lang,
    )

    return summary.to_dict()
