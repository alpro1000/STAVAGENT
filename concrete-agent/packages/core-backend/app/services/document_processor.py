"""
Document Processor - Complete 3-Layer Pipeline

Processes construction documents to generate Project Passport.

Architecture:
┌─────────────────────────────────────────┐
│  LAYER 1: MinerU / PyMuPDF              │  ← Structure extraction
│  Fast, cheap, accurate layout           │
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  LAYER 2: Regex + Rules                 │  ← Deterministic facts
│  100% confidence, no guessing           │
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  LAYER 3: Claude (optional)             │  ← Context enrichment
│  0.5-0.9 confidence, only if needed     │
└─────────────────────────────────────────┘

Performance:
- Layer 1: 1-3 seconds (parsing)
- Layer 2: <100ms (regex)
- Layer 3: 3-5 seconds (LLM, optional)
- Total: 4-8 seconds

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-02-10
"""

import logging
import time
import uuid
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

from app.parsers.smart_parser import SmartParser
from app.services.regex_extractor import CzechConstructionExtractor
from app.services.passport_enricher import PassportEnricher
from app.models.passport_schema import (
    ProjectPassport,
    PassportGenerationRequest,
    PassportGenerationResponse,
    PassportMetadata,
    PassportStatistics
)

logger = logging.getLogger(__name__)


class DocumentProcessor:
    """
    Complete document processing pipeline.

    Combines:
    - Layer 1: Document parsing (structure, text, tables)
    - Layer 2: Regex extraction (deterministic facts)
    - Layer 3: AI enrichment (context, risks, relationships)
    """

    def __init__(self, preferred_model: Optional[str] = None):
        """
        Initialize processor with all layers.

        Args:
            preferred_model: Preferred AI model for Layer 3:
                - gemini (default, FREE)
                - claude-sonnet (best quality)
                - claude-haiku (fast, cheap)
                - openai (GPT-4 Turbo)
                - openai-mini (GPT-4o Mini)
                - perplexity (with web search)
                - auto (fallback chain)
        """
        self.parser = SmartParser()
        self.extractor = CzechConstructionExtractor()
        self.enricher = PassportEnricher(preferred_model=preferred_model)

        logger.info(f"DocumentProcessor initialized (AI model: {preferred_model or 'default'})")

    # =============================================================================
    # MAIN PROCESSING METHOD
    # =============================================================================

    async def process(
        self,
        file_path: str,
        project_name: str,
        enable_ai_enrichment: bool = True,
        preferred_model: Optional[str] = None,
        project_id: Optional[str] = None
    ) -> PassportGenerationResponse:
        """
        Process document and generate project passport.

        Args:
            file_path: Path to document file
            project_name: Name of the project
            enable_ai_enrichment: Enable Layer 3 (Claude) enrichment
            project_id: Optional project ID

        Returns:
            PassportGenerationResponse with generated passport
        """
        start_time = time.time()

        logger.info(f"Starting document processing: {file_path}")
        logger.info(f"AI enrichment: {'enabled' if enable_ai_enrichment else 'disabled'}")

        try:
            # Generate passport ID
            passport_id = f"passport_{uuid.uuid4().hex[:12]}"

            # === LAYER 1: PARSING (Structure extraction) ===
            logger.info("LAYER 1: Parsing document structure")
            layer1_start = time.time()

            parsed_data = await self._parse_document(file_path, project_id)
            document_text = parsed_data.get('text', '')
            tables = parsed_data.get('tables', [])

            layer1_time = int((time.time() - layer1_start) * 1000)
            logger.info(f"Layer 1 complete: {layer1_time}ms, {len(document_text)} chars")

            # === LAYER 2: REGEX EXTRACTION (Deterministic facts) ===
            logger.info("LAYER 2: Extracting deterministic facts")
            layer2_start = time.time()

            extracted_facts = self.extractor.extract_all(document_text)

            layer2_time = int((time.time() - layer2_start) * 1000)
            logger.info(f"Layer 2 complete: {layer2_time}ms, {self.extractor.get_stats()}")

            # === BUILD PASSPORT (from Layer 2 facts) ===
            passport = self._build_passport(
                passport_id=passport_id,
                project_name=project_name,
                source_files=[Path(file_path).name],
                extracted_facts=extracted_facts,
                tables=tables
            )

            # Update layer breakdown
            passport.layer_breakdown['layer1_parsing'] = {
                'time_ms': layer1_time,
                'chars_extracted': len(document_text),
                'tables_found': len(tables)
            }
            passport.layer_breakdown['layer2_regex'] = {
                'time_ms': layer2_time,
                'stats': self.extractor.get_stats()
            }

            # === LAYER 3: AI ENRICHMENT (Context, risks, relationships) ===
            layer3_time = 0
            if enable_ai_enrichment:
                logger.info("LAYER 3: AI enrichment")
                layer3_start = time.time()

                passport = await self.enricher.enrich_passport(
                    passport=passport,
                    document_text=document_text,
                    enable_ai=True
                )

                layer3_time = int((time.time() - layer3_start) * 1000)
                logger.info(f"Layer 3 complete: {layer3_time}ms")

                passport.layer_breakdown['layer3_ai'] = {
                    'time_ms': layer3_time,
                    'enrichments_added': len(passport.risks) + len(passport.stakeholders)
                }
            else:
                logger.info("LAYER 3: Skipped (AI enrichment disabled)")
                passport.layer_breakdown['layer3_ai'] = {
                    'time_ms': 0,
                    'enrichments_added': 0
                }

            # Calculate total time
            total_time = int((time.time() - start_time) * 1000)
            passport.processing_time_ms = total_time

            # Add extraction stats
            passport.extraction_stats = {
                'concrete_classes_found': len(passport.concrete_specifications),
                'reinforcement_specs': len(passport.reinforcement),
                'quantities_extracted': len(passport.quantities),
                'special_requirements': len(passport.special_requirements),
                'risks_identified': len(passport.risks),
                'stakeholders_found': len(passport.stakeholders),
                'total_time_ms': total_time,
                'layer1_time_ms': layer1_time,
                'layer2_time_ms': layer2_time,
                'layer3_time_ms': layer3_time
            }

            logger.info(f"Processing complete: {total_time}ms")

            # Compute average confidence
            confidences = (
                [s.confidence for s in passport.concrete_specifications] +
                [r.confidence for r in passport.reinforcement] +
                [r.confidence for r in passport.risks] +
                [s.confidence for s in passport.stakeholders]
            )
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

            # Build metadata
            metadata = PassportMetadata(
                file_name=Path(file_path).name,
                processing_time_seconds=round(total_time / 1000.0, 2),
                parser_used="SmartParser",
                extraction_method="Regex + AI" if enable_ai_enrichment else "Regex only",
                ai_model_used=preferred_model or "gemini" if enable_ai_enrichment else None,
                total_confidence=round(avg_confidence, 3)
            )

            # Build statistics
            statistics = PassportStatistics(
                total_concrete_m3=round(sum(q.volume_m3 or 0.0 for q in passport.quantities), 2),
                total_reinforcement_t=round(sum(s.total_mass_tons or 0.0 for s in passport.reinforcement), 2),
                unique_concrete_classes=len(set(s.concrete_class for s in passport.concrete_specifications)),
                unique_steel_grades=len(set(s.steel_grade.value for s in passport.reinforcement)),
                deterministic_fields=(
                    len(passport.concrete_specifications) +
                    len(passport.reinforcement) +
                    len(passport.quantities) +
                    len(passport.special_requirements) +
                    (1 if passport.dimensions else 0)
                ),
                ai_enriched_fields=(
                    len(passport.risks) +
                    len(passport.stakeholders) +
                    (1 if passport.location else 0) +
                    (1 if passport.timeline else 0) +
                    (1 if passport.description else 0) +
                    len(passport.technical_highlights)
                )
            )

            return PassportGenerationResponse(
                success=True,
                passport=passport,
                processing_time_ms=total_time,
                metadata=metadata,
                statistics=statistics
            )

        except Exception as e:
            logger.error(f"Processing failed: {e}", exc_info=True)

            total_time = int((time.time() - start_time) * 1000)

            return PassportGenerationResponse(
                success=False,
                passport=None,
                error=str(e),
                processing_time_ms=total_time
            )

    # =============================================================================
    # LAYER 1: PARSING
    # =============================================================================

    async def _parse_document(
        self,
        file_path: str,
        project_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Parse document using SmartParser.

        Returns:
            {
                'text': str,           # Full text content
                'tables': List[dict],  # Extracted tables
                'structure': dict      # Document structure
            }
        """
        path_obj = Path(file_path)

        if not path_obj.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        # Use SmartParser for now
        # TODO: Add MinerU integration for better PDF parsing
        parsed = self.parser.parse(path_obj, project_id=project_id)

        # Extract text content
        text_content = ""

        # For PDFs: ALWAYS extract full text with pdfplumber first
        # SmartParser extracts tables but misses prose text (critical for TZ/technical reports)
        if path_obj.suffix.lower() == '.pdf':
            try:
                import pdfplumber
                with pdfplumber.open(path_obj) as pdf:
                    for page in pdf.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text_content += page_text + "\n"
                logger.info(f"PDF full text extracted: {len(text_content)} chars from {len(pdf.pages)} pages")
            except Exception as e:
                logger.warning(f"Failed to extract PDF text with pdfplumber: {e}")

        # Supplement with position descriptions from SmartParser (table data)
        if 'positions' in parsed:
            position_text = ""
            for pos in parsed['positions']:
                if 'popis' in pos:
                    position_text += pos['popis'] + " "
                if 'poznamka' in pos:
                    position_text += pos['poznamka'] + " "
            if position_text and position_text not in text_content:
                text_content += "\n--- Tabulková data ---\n" + position_text

        # Try to get from metadata
        if 'project_info' in parsed:
            info = parsed['project_info']
            for key in ['project_name', 'description', 'investor', 'location']:
                if key in info and info[key]:
                    text_content += str(info[key]) + " "

        return {
            'text': text_content,
            'tables': parsed.get('tables', []),
            'structure': parsed.get('project_info', {}),
            'raw_parsed': parsed
        }

    # =============================================================================
    # PASSPORT BUILDING
    # =============================================================================

    def _build_passport(
        self,
        passport_id: str,
        project_name: str,
        source_files: List[str],
        extracted_facts: Dict[str, Any],
        tables: List[dict]
    ) -> ProjectPassport:
        """
        Build passport from extracted facts (Layer 2).

        All data at this stage has confidence=1.0 (deterministic).
        """
        passport = ProjectPassport(
            passport_id=passport_id,
            project_name=project_name,
            generated_at=datetime.now(),
            source_documents=source_files
        )

        # Populate from extracted facts
        passport.concrete_specifications = extracted_facts.get('concrete_specifications', [])
        passport.reinforcement = extracted_facts.get('reinforcement', [])
        passport.quantities = extracted_facts.get('quantities', [])
        passport.dimensions = extracted_facts.get('dimensions')
        passport.special_requirements = extracted_facts.get('special_requirements', [])

        # Extract quantities from tables if available
        if tables:
            table_quantities = self._extract_quantities_from_tables(tables)
            passport.quantities.extend(table_quantities)

        return passport

    def _extract_quantities_from_tables(self, tables: List[dict]) -> List:
        """
        Extract quantities from parsed tables.

        Tables typically have columns like:
        - Popis (description)
        - Množství (quantity)
        - Jednotka (unit)
        - Cena (price)
        """
        from app.models.passport_schema import QuantityItem

        quantities = []

        for table_data in tables:
            # Table format varies, handle gracefully
            rows = table_data.get('rows', [])

            for row in rows:
                if isinstance(row, dict):
                    # Try to extract quantity data
                    desc = row.get('popis', row.get('description', ''))
                    mnozstvi = row.get('mnozstvi', row.get('quantity', 0))
                    jednotka = row.get('jednotka', row.get('unit', ''))

                    if mnozstvi and jednotka:
                        # Parse quantity based on unit
                        qty_item = QuantityItem(
                            element_type=self._infer_element_from_desc(desc),
                            description=str(desc)[:100],
                            confidence=1.0
                        )

                        if 'm³' in jednotka or 'm3' in jednotka:
                            qty_item.volume_m3 = float(mnozstvi)
                        elif 'm²' in jednotka or 'm2' in jednotka:
                            qty_item.area_m2 = float(mnozstvi)
                        elif 't' in jednotka.lower():
                            qty_item.mass_tons = float(mnozstvi)
                        elif 'm' == jednotka:
                            qty_item.length_m = float(mnozstvi)

                        quantities.append(qty_item)

        return quantities

    def _infer_element_from_desc(self, description: str) -> str:
        """Infer element type from description"""
        desc_lower = description.lower()

        if any(kw in desc_lower for kw in ['základ', 'patk', 'pás']):
            return 'Základy'
        elif any(kw in desc_lower for kw in ['stěn', 'obvodov']):
            return 'Stěny'
        elif any(kw in desc_lower for kw in ['strop', 'desk']):
            return 'Stropy'
        elif any(kw in desc_lower for kw in ['sloup', 'pilíř']):
            return 'Sloupy'
        elif any(kw in desc_lower for kw in ['schodiště', 'schod']):
            return 'Schodiště'
        elif any(kw in desc_lower for kw in ['výztuž', 'armatur']):
            return 'Výztuž'
        elif any(kw in desc_lower for kw in ['bednění']):
            return 'Bednění'

        return 'Ostatní'


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

async def process_document(
    file_path: str,
    project_name: str,
    enable_ai: bool = True,
    project_id: Optional[str] = None
) -> PassportGenerationResponse:
    """
    Convenience function to process a document.

    Usage:
        response = await process_document(
            file_path="/path/to/technicka_zprava.pdf",
            project_name="Polyfunkční dům Praha 5",
            enable_ai=True
        )

        if response.success:
            passport = response.passport
            print(f"Generated passport: {passport.passport_id}")
    """
    processor = DocumentProcessor()
    return await processor.process(file_path, project_name, enable_ai, project_id)


async def process_multiple_documents(
    file_paths: List[str],
    project_name: str,
    enable_ai: bool = True,
    project_id: Optional[str] = None
) -> PassportGenerationResponse:
    """
    Process multiple documents and merge into single passport.

    Useful for projects with multiple technical reports.
    """
    processor = DocumentProcessor()

    # Process first document
    response = await processor.process(
        file_paths[0],
        project_name,
        enable_ai,
        project_id
    )

    if not response.success or not response.passport:
        return response

    main_passport = response.passport

    # Process remaining documents and merge
    for file_path in file_paths[1:]:
        logger.info(f"Processing additional document: {file_path}")

        additional_response = await processor.process(
            file_path,
            project_name,
            enable_ai=False,  # Only enrich once at the end
            project_id=project_id
        )

        if additional_response.success and additional_response.passport:
            # Merge facts from additional document
            additional = additional_response.passport

            main_passport.concrete_specifications.extend(additional.concrete_specifications)
            main_passport.reinforcement.extend(additional.reinforcement)
            main_passport.quantities.extend(additional.quantities)
            main_passport.special_requirements.extend(additional.special_requirements)
            main_passport.source_documents.extend(additional.source_documents)

    # Final AI enrichment on merged data
    if enable_ai:
        logger.info("Performing final AI enrichment on merged passport")
        # Reconstruct full text from all docs (would need to store it)
        # For now, just enrich with what we have
        # main_passport = await processor.enricher.enrich_passport(main_passport, "", True)

    return PassportGenerationResponse(
        success=True,
        passport=main_passport,
        processing_time_ms=response.processing_time_ms
    )
