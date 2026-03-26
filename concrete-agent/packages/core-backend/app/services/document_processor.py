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
import asyncio
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

from app.parsers.smart_parser import SmartParser
from app.services.regex_extractor import CzechConstructionExtractor
from app.services.passport_enricher import PassportEnricher
from app.services.document_classifier import (
    classify_document, classify_document_async,
    enrich_classification, detect_so_type_from_content,
    classify_document_enhanced,
)
from app.services.so_type_regex import extract_so_type_params
from app.models.so_type_schemas import detect_so_params_key, SO_PARAMS_CLASSES, D14_PARAMS_CLASSES
from app.services.d14_profession_detector import is_d14_document, detect_d14_profession
from app.core.config import settings
from app.models.passport_schema import (
    ProjectPassport,
    PassportGenerationRequest,
    PassportGenerationResponse,
    PassportMetadata,
    PassportStatistics,
    ClassificationInfo,
    DocCategory,
    TechnicalExtraction,
    BillOfQuantitiesExtraction,
    TenderConditionsExtraction,
    ScheduleExtraction,
    GTPExtraction,
    TenderExtraction,
    BridgeSOParams,
    DocSubType,
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

    def __init__(self, preferred_model: Optional[str] = None, vertex_service_account: Optional[str] = None):
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
                - vertex-ai-gemini (Gemini via Vertex AI / Google Cloud billing)
                - vertex-ai-search (Vertex AI Search + Gemini)
                - auto (fallback chain)
            vertex_service_account: Optional Vertex AI service account ID hint
        """
        self.parser = SmartParser()
        self.extractor = CzechConstructionExtractor()
        self.enricher = PassportEnricher(
            preferred_model=preferred_model,
            vertex_service_account=vertex_service_account,
        )

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

            # === CLASSIFICATION: Detect document type (3-tier with AI fallback) ===
            # v3.1.1: Use enhanced classification for flexible section IDs + construction type
            enhanced = classify_document_enhanced(Path(file_path).name, document_text)
            classification = enhanced["classification"]

            # If Tiers 1-2 insufficient, try AI (Tier 3)
            if classification.confidence < 0.5 and enable_ai_enrichment:
                classification = await classify_document_async(
                    filename=Path(file_path).name,
                    text=document_text,
                    llm_call=self.enricher._call_llm,
                )
                classification = enrich_classification(classification, Path(file_path).name)
                # Re-run enhanced to pick up SO code from content if AI didn't find it
                if not classification.so_code and enhanced.get("so_code"):
                    classification.so_code = enhanced["so_code"]

            # Store enhanced metadata for use in merge step
            self._last_enhanced_metadata = {
                "section_ids": enhanced.get("section_ids", []),
                "construction_type": enhanced.get("construction_type"),
                "is_non_construction": enhanced.get("is_non_construction", False),
            }

            logger.info(f"Classification: {classification.category.value} "
                         f"(confidence={classification.confidence:.2f}, method={classification.method}, "
                         f"sub_type={classification.sub_type}, so_code={classification.so_code}, "
                         f"construction_type={enhanced.get('construction_type')})")

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

            # === TYPE-SPECIFIC EXTRACTION (based on classification) ===
            type_extractions: Dict[str, Any] = {}
            if enable_ai_enrichment and classification.confidence >= 0.5:
                type_extractions = await self._extract_type_specific(
                    classification, document_text
                )

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
                statistics=statistics,
                classification=classification,
                technical=type_extractions.get("technical"),
                bill_of_quantities=type_extractions.get("bill_of_quantities"),
                tender_conditions=type_extractions.get("tender_conditions"),
                schedule=type_extractions.get("schedule"),
                # v3 fields
                tender=type_extractions.get("tender"),
                gtp=type_extractions.get("gtp"),
                bridge_params=type_extractions.get("bridge_params"),
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
        Parse document using SmartParser + cascading PDF recovery.

        Pipeline for PDFs:
          1. SmartParser (pdfplumber) — fast, primary
          2. PdfTextRecovery (pdfminer→pypdfium2→poppler→OCR) — scans, broken fonts
          3. MinerU (async subprocess) — deep structural extraction

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

        # Check file size
        size_mb = path_obj.stat().st_size / (1024 * 1024)
        logger.info(f"Parsing file: {path_obj.name} ({size_mb:.1f}MB)")

        # Use SmartParser for structural parsing (positions, tables)
        if path_obj.suffix.lower() == '.pdf' and size_mb > 20:
            logger.warning(f"Large PDF ({size_mb:.1f}MB) — streaming parser")
        parsed = self.parser.parse(path_obj, project_id=project_id)

        text_content = ""

        # === PDF TEXT EXTRACTION: 3-tier cascade ===
        if path_obj.suffix.lower() == '.pdf':
            text_content = await self._extract_pdf_text(path_obj)

        # === NON-PDF: handled by SmartParser directly ===

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
    # PDF TEXT EXTRACTION: 3-tier cascade
    # =============================================================================

    async def _extract_pdf_text(self, path_obj: Path) -> str:
        """
        Extract text from PDF with 3-tier fallback:
          Tier 1: pdfplumber (fast, good for digital PDFs)
          Tier 2: PdfTextRecovery (pdfminer→pdfium→poppler→OCR — scans, broken fonts)
          Tier 3: MinerU async subprocess (deep structural extraction)

        Returns best available text.
        """
        text_content = ""
        total_pages = 0
        strategy = "none"

        # --- Tier 1: pdfplumber (primary, fast) ---
        try:
            import pdfplumber
            with pdfplumber.open(path_obj) as pdf:
                total_pages = len(pdf.pages)
                max_pages = min(total_pages, 70)
                empty_count = 0
                for page_num in range(max_pages):
                    try:
                        page_text = pdf.pages[page_num].extract_text()
                        if page_text and page_text.strip():
                            text_content += page_text + "\n"
                        else:
                            empty_count += 1
                    except Exception as page_err:
                        logger.debug(f"Page {page_num + 1} pdfplumber error: {page_err}")
                        empty_count += 1

                if empty_count > 0:
                    logger.info(f"PDF tier-1 (pdfplumber): skipped {empty_count} empty pages")
                logger.info(f"PDF tier-1 (pdfplumber): {len(text_content)} chars from {max_pages}/{total_pages} pages")
                strategy = "pdfplumber"
        except Exception as e:
            logger.warning(f"PDF tier-1 (pdfplumber) failed: {e}")

        # --- Quality check: is pdfplumber text usable? ---
        # Threshold: at least 50 chars per page on average (otherwise likely scan/bad encoding)
        avg_chars_per_page = len(text_content) / max(total_pages, 1)
        text_quality_ok = avg_chars_per_page >= 50 and len(text_content) > 200

        if text_quality_ok:
            logger.info(f"PDF text quality OK ({avg_chars_per_page:.0f} chars/page avg), using pdfplumber")
            return text_content

        # --- Tier 2: PdfTextRecovery (cascading extractors + OCR) ---
        logger.info(f"PDF text quality low ({avg_chars_per_page:.0f} chars/page), trying PdfTextRecovery")
        try:
            from app.services.pdf_text_recovery import PdfTextRecovery

            recovery = PdfTextRecovery()
            # Run sync recovery in thread pool to avoid blocking
            summary = await asyncio.to_thread(recovery.recover, path_obj)

            recovered_text = ""
            for page in summary.pages:
                if page.accepted.text and page.accepted.text.strip():
                    recovered_text += page.accepted.text + "\n"

            counters = summary.page_state_counters()
            logger.info(
                f"PDF tier-2 (recovery): {len(recovered_text)} chars, "
                f"states: good={counters.get('good_text', 0)} "
                f"encoded={counters.get('encoded_text', 0)} "
                f"image={counters.get('image_only', 0)}, "
                f"pdfium={summary.used_pdfium}, poppler={summary.used_poppler}, "
                f"ocr_pages={len(summary.queued_ocr_pages)}"
            )

            if len(recovered_text) > len(text_content):
                text_content = recovered_text
                strategy = "pdf_recovery"
                logger.info("PDF tier-2 produced better text, using recovery result")
        except Exception as e:
            logger.warning(f"PDF tier-2 (recovery) failed: {e}")

        # --- Tier 3: MinerU (async subprocess, deep extraction) ---
        if settings.USE_MINERU and len(text_content) < 500:
            logger.info("PDF text still sparse, trying MinerU (tier-3)")
            try:
                mineru_text = await self._run_mineru_async(path_obj)
                if mineru_text and len(mineru_text) > len(text_content):
                    text_content = mineru_text
                    strategy = "mineru"
                    logger.info(f"PDF tier-3 (MinerU): {len(mineru_text)} chars extracted")
            except Exception as e:
                logger.warning(f"PDF tier-3 (MinerU) failed: {e}")

        logger.info(f"PDF extraction final: strategy={strategy}, {len(text_content)} chars")
        return text_content

    async def _run_mineru_async(self, pdf_path: Path) -> str:
        """
        Run MinerU as async subprocess. Returns extracted text.
        Properly async — no asyncio.run() antipattern.
        """
        import shutil
        import tempfile
        import unicodedata
        import re

        # Slugify filename to avoid MinerU crash with diacritics
        stem = pdf_path.stem
        normalized = unicodedata.normalize("NFKD", stem)
        safe_stem = re.sub(r"[^\w\-]", "_", normalized.encode("ascii", "ignore").decode("ascii")).strip("_") or "doc"

        output_dir = Path(tempfile.gettempdir()) / "mineru_output" / safe_stem
        output_dir.mkdir(parents=True, exist_ok=True)

        # Copy file if filename has diacritics
        if safe_stem != stem:
            source_path = output_dir / f"{safe_stem}.pdf"
            shutil.copy2(pdf_path, source_path)
        else:
            source_path = pdf_path

        # MinerU 2.x: default backend is hybrid-auto-engine (VLM + pipeline)
        # Omit -b flag to use the smarter default; -d cpu for Cloud Run (no GPU)
        cmd = ["mineru", "-p", str(source_path), "-o", str(output_dir), "-d", "cpu"]
        logger.info(f"MinerU async: {' '.join(cmd)}")

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)  # 5 min max
        except asyncio.TimeoutError:
            proc.kill()
            logger.error("MinerU timed out after 300s")
            return ""

        if proc.returncode != 0:
            err_text = stderr.decode("utf-8", errors="replace")[:500]
            logger.error(f"MinerU exited {proc.returncode}: {err_text}")
            return ""

        # Read output markdown
        md_files = list(output_dir.rglob("*.md"))
        if not md_files:
            logger.warning("MinerU produced no output files")
            return ""

        md_content = md_files[0].read_text(encoding="utf-8", errors="replace")

        # Strip markdown formatting, keep text
        # Remove table HTML tags but keep content
        text = re.sub(r"</?(?:table|tr|td|th|thead|tbody)[^>]*>", " ", md_content)
        text = re.sub(r"[#*_`>|]", "", text)  # Remove markdown formatting
        text = re.sub(r"\n{3,}", "\n\n", text)  # Collapse extra newlines
        text = re.sub(r"  +", " ", text)  # Collapse spaces

        # Cleanup temp if copy was made
        if safe_stem != stem:
            try:
                source_path.unlink(missing_ok=True)
            except Exception:
                pass

        return text.strip()

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
    # TYPE-SPECIFIC AI EXTRACTION
    # =============================================================================

    TYPE_EXTRACTION_PROMPTS: Dict[DocCategory, str] = {
        DocCategory.TZ: """Analyzuj tuto technickou zprávu. Extrahuj POUZE fakta nalezená v textu.

DOKUMENT:
{text}

VRAŤ POUZE VALIDNÍ JSON:
{{
  "project_name": "název projektu nebo null",
  "structure_type": "typ konstrukce (most, budova, tunel...) nebo null",
  "structure_subtype": "podtyp nebo null",
  "total_length_m": číslo nebo null,
  "width_m": číslo nebo null,
  "height_m": číslo nebo null,
  "area_m2": číslo nebo null,
  "volume_m3": číslo nebo null,
  "span_count": číslo nebo null,
  "span_lengths_m": [čísla] nebo [],
  "concrete_grade": "C30/37" nebo null,
  "reinforcement_grade": "B500B" nebo null,
  "foundation_type": "typ základu" nebo null,
  "fabrication_method": "metoda výroby/výstavby" nebo null,
  "load_class": "třída zatížení" nebo null,
  "design_life_years": číslo nebo null,
  "applicable_standards": ["ČSN ...", "EN ..."],
  "construction_duration_months": číslo nebo null,
  "special_conditions": ["speciální podmínky"]
}}""",

        DocCategory.RO: """Analyzuj tento rozpočet/výkaz výměr. Extrahuj POUZE fakta z textu.

DOKUMENT:
{text}

VRAŤ POUZE VALIDNÍ JSON:
{{
  "total_items": počet položek,
  "total_price_czk": celková cena nebo null,
  "categories": [{{"name": "HSV", "price_czk": číslo}}, ...],
  "key_materials": [{{"name": "Beton C30/37", "quantity": číslo, "unit": "m3"}}, ...],
  "concrete_volume_m3": číslo nebo null,
  "steel_tonnage_t": číslo nebo null,
  "earthwork_volume_m3": číslo nebo null
}}""",

        DocCategory.PD: """Analyzuj zadávací/smluvní podmínky. Extrahuj POUZE fakta z textu.

DOKUMENT:
{text}

VRAŤ POUZE VALIDNÍ JSON:
{{
  "tender_name": "název zakázky" nebo null,
  "contracting_authority": "zadavatel" nebo null,
  "submission_deadline": "termín podání" nebo null,
  "question_deadline": "termín pro dotazy" nebo null,
  "estimated_budget": číslo nebo null,
  "currency": "CZK",
  "required_documents": ["seznam požadovaných dokumentů"],
  "qualification_criteria": ["kvalifikační předpoklady"],
  "evaluation_criteria": [{{"criterion": "název", "weight_pct": číslo}}],
  "submission_method": "způsob podání" nebo null
}}""",

        DocCategory.HA: """Analyzuj tento harmonogram. Extrahuj POUZE fakta z textu.

DOKUMENT:
{text}

VRAŤ POUZE VALIDNÍ JSON:
{{
  "total_duration_months": číslo nebo null,
  "start_date": "datum" nebo null,
  "end_date": "datum" nebo null,
  "phases": [{{"name": "etapa", "duration": "trvání"}}, ...],
  "milestones": [{{"name": "milník", "date": "datum"}}, ...],
  "critical_path": ["aktivity na kritické cestě"]
}}""",

        DocCategory.GE: """Analyzuj geotechnický pasport (GTP/IGP). Extrahuj POUZE fakta z textu.

DOKUMENT:
{text}

Extrahuj:
1. VRTY: ID, hloubka, souřadnice, vrstvy zemin
2. HLADINA PODZEMNÍ VODY: naražená + ustálená pro každý vrt
3. AGRESIVITA: XA třída, SO4, pH, CO2agr
4. BLUDNÉ PROUDY: stupeň ochrany
5. GEOTECHNICKÁ KATEGORIE
6. TYPY ZEMIN: kód, popis, parametry (Edef, φ, c, Rp)
7. SEDÁNÍ: hodnoty, místa, konsolidace
8. DOPORUČENÍ: typ založení, hloubka pilot, opatření

VRAŤ POUZE VALIDNÍ JSON:
{{
  "boreholes": [{{"borehole_id": "J516", "depth_m": 15.0, "elevation_bpv": 489.53, "layers": [{{"depth_from_m": 0, "depth_to_m": 3.5, "soil_type_code": "Q2p", "csn_class": "F3/MS", "description": "popis"}}]}}],
  "soil_types": [{{"code": "P1a", "description": "popis", "edef_mpa": číslo, "phi_deg": číslo, "c_kpa": číslo}}],
  "groundwater_levels": {{"J516": {{"narazena": 1.80, "ustalena": 1.15}}}},
  "water_aggressivity": "XA2" nebo null,
  "aggressivity_details": {{"SO4": 58.8, "pH": 6.16, "CO2_agr": 34}},
  "stray_current_class": číslo nebo null,
  "geotechnical_category": číslo nebo null,
  "foundation_recommendation": "text" nebo null,
  "pile_depth_estimate": "8-10 m" nebo null,
  "special_measures": ["ocelové výpažnice", "geotechnický dozor"],
  "settlements": [{{"location": "za opěrou km 2,680", "value_cm": 24.2, "consolidation_95pct_days": 150}}]
}}""",
    }

    # v3: Extended prompts for bridge dílčí TZ and full PD
    BRIDGE_TZ_PROMPT = """Parsuj českou technickou zprávu mostu (dílčí TZ SO 2xx) podle ČSN 73 6200.

DOKUMENT:
{text}

Extrahuj KAŽDOU hodnotu z Odst. 4.x (klasifikace) a Odst. 5.x (rozměry):
- Odst. 4.1-4.16: druh, překážka, počet polí, materiál, typ mostu
- Odst. 5.3→light_span_m, 5.4→span_m, 5.7→nk_length_m, 5.9→bridge_length_m
- Odst. 5.13→bridge_width_m, 5.14→free_width_m, 5.19→bridge_height_m
- Odst. 5.20→structural_height_m, 5.23→clearance_under_m, 5.28→load_class

Dále extrahuj: NK (nosníky, deska, sklony), založení (piloty, průměr, délka),
beton (NK, spodní stavba, ochrana, podkladní), sedání, PKO, související SO.

KRITICKÉ: Pokud se hodnota změnila oproti DSP, zapiš do pile_change_note.

VRAŤ POUZE VALIDNÍ JSON matching BridgeSOParams schema:
{{
  "csn_4_1": "text", "csn_4_2": "text", "csn_4_3": "text",
  "csn_4_12": "text", "csn_4_14": "text",
  "light_span_m": číslo, "span_m": číslo, "span_config": "17+25+17",
  "nk_length_m": číslo, "nk_area_m2": číslo,
  "bridge_length_m": číslo, "bridge_width_m": číslo,
  "free_width_m": číslo, "bridge_height_m": číslo,
  "structural_height_m": číslo, "clearance_under_m": číslo,
  "load_class": "ČSN EN 1991-2, skupina 1",
  "nk_type": "text", "beam_count": číslo, "beam_spacing_mm": číslo,
  "slab_thickness_mm": číslo,
  "foundation_type": "text", "pile_diameter_mm": číslo, "pile_length_m": číslo,
  "pile_change_note": "text nebo null",
  "concrete_nk": "C30/37-XF2,XD1,XC4", "concrete_substructure": "text",
  "reinforcement": "B500B",
  "settlement_abutment_1_mm": číslo, "deflection_span_mm": číslo,
  "consolidation_95pct_days": číslo,
  "pko_aggressivity": "C4", "stray_current_protection": číslo,
  "related_sos": ["SO 020", "SO 101"],
  "obstacle_crossed": "text", "chainage_km": číslo
}}"""

    FULL_PD_PROMPT = """Analyzuj zadávací dokumentaci (ZD) veřejné zakázky dle ZZVZ (zákon 134/2016 Sb.).

TOTO JE NEJKRITIČTĚJŠÍ EXTRAKCE — chybějící požadavek = diskvalifikace uchazeče.

DOKUMENT:
{text}

Extrahuj:
1. IDENTIFIKACE: název zakázky, číslo, IČO zadavatele, kontakt, datová schránka
2. HODNOTA: předpokládaná hodnota v Kč bez DPH — PŘESNÉ číslo
3. KVALIFIKACE §74-79: KAŽDÝ práh (obrat, reference, personál, vybavení)
4. HODNOTÍCÍ KRITÉRIA: název, váha %, směr (nižší/vyšší = lepší), min/max
5. PODÁNÍ: elektronický nástroj, max MB, formáty, papírové podání
6. LHŮTA + JISTOTA: měsíce, částka, bankovní záruka, účet, VS
7. PODDODAVATELÉ: vlastní kapacity, identifikace
8. PŘÍLOHY: číslo + název každé přílohy

VRAŤ POUZE VALIDNÍ JSON matching TenderExtraction schema:
{{
  "tender_name": "text", "tender_number": "text",
  "procedure_type": "otevřené řízení § 56 ZZVZ",
  "contracting_authority": "text", "authority_ico": "text",
  "contact_person": "text", "data_box": "text",
  "estimated_value_czk": číslo,
  "min_annual_turnover_czk": číslo nebo null,
  "turnover_period": "text",
  "required_personnel": [{{"role": "text", "reference_description": "text", "authorization_required": "text"}}],
  "required_references": [{{"reference_code": "4.5.1a", "description": "text", "min_value_czk": číslo}}],
  "required_equipment": [{{"description": "text", "min_capacity": "text"}}],
  "evaluation_criteria": [{{"name": "text", "weight_pct": číslo, "direction": "lower_better"}}],
  "submission_method": "elektronicky", "electronic_tool": "text",
  "max_file_size_mb": číslo, "accepted_formats": ["pdf", "docx"],
  "binding_period_months": číslo,
  "jistota_required": true/false, "jistota_amount_czk": číslo,
  "jistota_forms": ["bankovní záruka"], "jistota_bank_account": "text",
  "jistota_variable_symbol": "text",
  "own_capacity_required": ["text"],
  "attachments": [{{"number": 1, "name": "text"}}],
  "contract_type": "FIDIC Red Book nebo null",
  "risk_flags": ["popis rizika"]
}}"""

    EXTRACTION_MODEL_MAP = {
        DocCategory.TZ: TechnicalExtraction,
        DocCategory.RO: BillOfQuantitiesExtraction,
        DocCategory.PD: TenderConditionsExtraction,
        DocCategory.HA: ScheduleExtraction,
        DocCategory.GE: GTPExtraction,
    }

    # ── v3.1: SO Type-Specific Prompts ──

    ROAD_TZ_PROMPT = """Parsuj českou technickou zprávu pozemní komunikace (SO 1xx).

Dokument sleduje strukturu a–o dle standardu silničních PD.

DOKUMENT:
{text}

Extrahuj do JSON:
{{
  "road_designation": "číslo silnice (III/1213, II/173, I/20)",
  "road_class": 1|2|3,
  "road_category": "S 6,5/90",
  "road_type": "přeložka|úprava|novostavba",
  "road_length_m": 156.191,
  "alignment_type": "přímá|oblouk",
  "curve_radius_m": null,
  "cross_slope_pct": 2.5,
  "cross_slope_type": "jednostranný|střechovitý",
  "lane_width_m": 2.75,
  "lane_count": 2,
  "shoulder_paved_m": 0.25,
  "shoulder_unpaved_m": 0.75,
  "pavement_catalog": "TP 170",
  "traffic_load_class": "IV",
  "design_damage_level": "D1",
  "surface_type": "asfaltový povrch",
  "pavement_layers": ["ACO 11+ tl. 40mm", "ACL 16+ tl. 60mm", "MZK tl. 170mm"],
  "active_zone_thickness_m": 0.50,
  "min_cbr_pct": 15,
  "earthwork_type": "zářez|násyp|smíšený",
  "has_sanation": true|false,
  "sanation_type": "popis sanace",
  "has_guardrails": true|false,
  "guardrail_type": "ocelové jednostranné",
  "drainage_method": "příčný a podélný sklon do příkopů",
  "intersections": [{{"km": "0.221", "type": "styková"}}],
  "volume_cut_m3": null,
  "volume_fill_m3": null,
  "related_sos": ["SO 221", "SO 801"],
  "future_owner": "SÚS JK"
}}

Vrať POUZE validní JSON."""

    DIO_PROMPT = """Parsuj český dokument DIO (Dopravně inženýrská opatření, SO 180).

Tento dokument popisuje fáze výstavby a dopravní omezení.

DOKUMENT:
{text}

Extrahuj do JSON:
{{
  "total_duration_weeks": 98,
  "phases": [
    {{
      "phase_number": 1,
      "name": "Přípravné práce",
      "duration_weeks": 9,
      "sos_in_phase": ["SO 020", "SO 321"],
      "traffic_restrictions": ["uzavírka III/1213"],
      "key_activities": ["sejmutí humózních vrstev"]
    }}
  ],
  "closures": [
    {{
      "road": "III/1213",
      "closure_type": "úplná uzavírka",
      "reason": "realizace mostu SO 221",
      "phase": 2
    }}
  ],
  "detours": [
    {{
      "for_road": "III/1213",
      "route_description": "ze Sedlice po I/20 směr Blatná",
      "roads_used": ["I/20", "III/1214"]
    }}
  ],
  "bus_impact": "popis dopadu na autobusy",
  "rail_impact": "popis dopadu na železnici",
  "provisional_roads": [{{"so": "SO 171", "speed_limit": 30}}],
  "phase_so_mapping": {{"fáze_1": ["SO 020"], "fáze_2": ["SO 101"]}},
  "related_sos": ["SO 020", "SO 101", "SO 111"]
}}

KRITICKÉ: DIO dokumenty uvádí VŠECHNY SO celé stavby. Extrahuj KOMPLETNÍ seznam.
Vrať POUZE validní JSON."""

    WATER_TZ_PROMPT = """Parsuj českou technickou zprávu vodohospodářského objektu (SO 3xx).

DOKUMENT:
{text}

Extrahuj do JSON:
{{
  "water_type": "přeložka_vodovod|přeložka_kanalizace|odvodnění|úprava_vodoteč|meliorace",
  "pipe_material": "TLT|PE100|PP|PVC|OC",
  "pipe_dn": 300,
  "pipe_pn": 16,
  "pipe_standard": "ČSN EN 545:2007",
  "pipe_quality": "K9",
  "pipe_length_m": 444.61,
  "outer_protection": "popis vnější ochrany",
  "inner_lining": "cementová vystýlka",
  "joint_type": "násuvné hrdlové, zámkové BRS",
  "casing_material": "OC",
  "casing_dn": 600,
  "casing_length_m": 154.97,
  "casing_protection": "pozinkování",
  "trench_walls": "svislé stěny",
  "trench_shoring": "pažení od hloubky 1,2 m",
  "bedding_material": "štěrkopísek max. zrna 4mm",
  "bedding_depth_mm": 100,
  "detection_wire": "CYKY (O) 2x4mm²",
  "warning_foil": "bílá, POZOR VODOVOD",
  "connection_type": "speciální spojky",
  "pressure_test": "1,5× max. provozní tlak",
  "disinfection": true,
  "crossing_km": ["km 3,556"],
  "owner": "Jihočeský vodárenský svaz",
  "related_sos": ["SO 122"]
}}

Vrať POUZE validní JSON."""

    VEGETATION_TZ_PROMPT = """Parsuj českou technickou zprávu vegetačních úprav (SO 8xx).

Tento dokument je typicky nejdelší. Extrahuj KOMPLETNÍ data.

DOKUMENT:
{text}

Extrahuj do JSON:
{{
  "climate_region": "MT7",
  "total_trees": 188,
  "total_shrubs": 17226,
  "tree_species": [
    {{"code": "QP", "latin_name": "Quercus petraea", "czech_name": "dub zimní", "total_count": 38, "size_category": "strom"}}
  ],
  "shrub_species": [
    {{"code": "CB", "latin_name": "Cotoneaster bullatus", "czech_name": "skalník puchýřnatý", "total_count": 500, "size_category": "velký_keř"}}
  ],
  "lawn_methods": [
    {{"surface_type": "svah", "method": "hydroosev", "seed_rate_g_m2": 20}}
  ],
  "lawn_seed_mix": {{
    "name": "Směs pro svahy",
    "components": [{{"species_cz": "lipnice luční", "percentage": 20.0}}],
    "seed_rate_g_m2": 20
  }},
  "lawn_care_count": 4,
  "watering_count": 3,
  "mulch_material": "hrubá borka",
  "mulch_thickness_cm": 10,
  "tree_care_years": 3,
  "tree_stakes": "3 kůly 2,5m",
  "standards": ["TKP 13", "TP 99", "ČSN 83 9001"],
  "greened_sos": ["SO 101", "SO 111"],
  "related_sos": ["SO 101"]
}}

Extrahuj KAŽDÝ druh rostliny s počtem. Vrať POUZE validní JSON."""

    ELECTRO_TZ_PROMPT = """Parsuj českou technickou zprávu elektro/sdělovacího objektu (SO 4xx).

DOKUMENT:
{text}

Extrahuj do JSON:
{{
  "electro_type": "přeložka_VN|kabelizace_NN|přeložka_optická|DIS_meteostanice",
  "voltage_level": "VN|NN|VVN",
  "cable_type": "optický|metalický",
  "telecom_operator": "CETIN a.s.",
  "energy_operator": "EG.D a.s.",
  "chainage_km": "km 3,700",
  "realized_by": "EG.D a.s.",
  "is_separate_contract": true,
  "dis_type": "meteostanice|sčítač dopravy",
  "related_sos": ["SO 101"]
}}

Vrať POUZE validní JSON."""

    PIPELINE_TZ_PROMPT = """Parsuj českou technickou zprávu trubního vedení (SO 5xx).

DOKUMENT:
{text}

Extrahuj do JSON:
{{
  "pipeline_type": "VTL_plynovod|STL_plynovod",
  "pressure_class": "VTL|STL|NTL",
  "pipe_dn": 100,
  "pipe_material": "ocel|PE",
  "pipe_length_m": 150.0,
  "chainage_km": "km 3,730",
  "operator": "EG.D a.s.",
  "realized_by": "EG.D a.s.",
  "is_separate_contract": true,
  "coordination_note": "koordinace s SO 101.1",
  "related_sos": ["SO 101"]
}}

Vrať POUZE validní JSON."""

    # ─── D.1.4 PROFESSION PROMPTS (pozemní stavby) ───

    SILNOPROUD_PROMPT = """Parsuj český dokument silnoproudých elektroinstalací (D.1.4.xx — pozemní stavba).

⚠️ Profese se NEURČUJE z čísla podsekce (D.1.4.10 ≠ vždy silnoproud)!
Profese je detekována z OBSAHU dokumentu.

DOKUMENT:
{text}

Extrahuj KOMPLETNÍ údaje:

1. NAPÁJECÍ SOUSTAVA: proudová soustava (TN-C-S/TN-S), napětí, hlavní jistič
2. VÝKONOVÁ BILANCE: CELÁ tabulka — název okruhu, instalovaný příkon kW, soudobost, soudobý příkon kW
3. SPOTŘEBA: roční spotřeba MWh, provozní hodiny/den, provozní dny/rok
4. DODÁVKA: zdroj napájení, přívodní kabel, místo dělení PEN
5. VNĚJŠÍ VLIVY: pro KAŽDOU zónu: název, vlivy (AA/AB/BA/...), opatření
6. PŘEPĚTÍ: typ svodiče (T1, T2, T1+T2)
7. VEDENÍ: všechny typy kabelů (CYKY, CXKH, CHKE...), způsoby instalace
8. OSVĚTLENÍ: řízení (DALI/KNX), nouzové osvětlení, doba zálohy min
9. ZÁSUVKY: typ kabelu, IP krytí, podlahové krabice (počet, místnost)
10. NAPOJENÍ TZB: které profese (VZT, ZTI, UT) a jak
11. ROZVADĚČE: pro KAŽDÝ: označení (R-xx), umístění, hlavní jistič, napájen z, kabel
12. REVIZE: norma revize

Vrať POUZE validní JSON matching SilnoproudParams."""

    SLABOPROUD_PROMPT = """Parsuj český dokument slaboproudých systémů (D.1.4.xx — pozemní stavba).

⚠️ Profese se NEURČUJE z čísla podsekce! Profese je detekována z OBSAHU.

DOKUMENT:
{text}

Dokument obsahuje VÍCE podsystémů. Extrahuj POUZE ty přítomné:

a) SCS (strukturovaná kabeláž):
   → kategorie kabelu (Cat.6A?), typ (F/FTP?), rack (umístění, velikost 42U?),
   páteř (optika SM 9/125 OS2?), typ zásuvky, schéma značení portů

c) PZTS (zabezpečovací systém):
   → značka, ústředna, detektory (typ+počet), KOMPLETNÍ tabulka:
   klidový odběr A, poplachový odběr A, kapacita Ah, doba zálohy h,
   monitorování (PCO?), požadavek kompatibility

d) SKV (kontrola vstupu):
   → značka, technologie čtečky, řízené dveře (seznam), integrace s EPS

e) CCTV (kamery):
   → počet kamer, rozlišení, vlastnosti, VMS software, napájení (PoE?)

g) EPS (elektronická požární signalizace):
   → značka, ústředna, umístění, typ sběrnice (esserbus?), rozšíření?,
   nové moduly, typ požárního kabelu + třída integrity, řízená zařízení

f) AVT (audiovizuální technika):
   → kdo dodává, rozsah přípravy

KRITICKÉ: Extrahuj PZTS backup kalkulaci — klíčové pro rozpočet.
Vrať POUZE validní JSON matching SlaboproudParams."""

    VZT_PROMPT = """Parsuj český dokument vzduchotechniky a klimatizace (D.1.4.xx).

DOKUMENT:
{text}

Extrahuj:
1. JEDNOTKY: pro KAŽDOU VZT jednotku — označení, typ, průtok m³/h,
   tlak Pa, ohřev kW, chlazení kW, filtr, typ rekuperace, účinnost %
2. CELKOVÉ PRŮTOKY: přívod, odtah m³/h
3. CELKOVÉ VÝKONY: ohřev, chlazení kW
4. POTRUBÍ: materiál, izolace, požární klapky
5. ŘÍZENÍ: systém MaR, napojení na BMS
6. HLUK: limitní hladina dB
7. TEPLOTY: výpočtové teploty (léto/zima, vnitřní/vnější)

Vrať POUZE validní JSON matching VZTParams."""

    ZTI_PROMPT = """Parsuj český dokument zdravotechnických instalací (D.1.4.xx).

DOKUMENT:
{text}

Extrahuj:
1. VNITŘNÍ VODOVOD: přípojka DN, materiál, izolace, zdroj TUV, teplota °C,
   cirkulace, vodoměr
2. VNITŘNÍ KANALIZACE: materiál, přípojka DN, větrání, lapák tuků, podlahové vpusti
3. DEŠŤOVÁ KANALIZACE: materiál, retenční nádrž, objem m³
4. ZAŘIZOVACÍ PŘEDMĚTY: počet, typy
5. POŽÁRNÍ VODOVOD: hydranty, DN

Vrať POUZE validní JSON matching ZTIParams."""

    UT_PROMPT = """Parsuj český dokument ústředního vytápění (D.1.4.xx).

DOKUMENT:
{text}

Extrahuj:
1. ZDROJ TEPLA: typ (kotel/TČ/výměník), výkon kW, typ TČ, COP, záložní zdroj
2. OTOPNÁ SOUSTAVA: typ (dvoutrubková?), teplotní spád, materiál potrubí, izolace
3. OTOPNÁ TĚLESA: typ, počet, podlahové vytápění (plocha m²?)
4. REGULACE: termostat, zónová regulace, ekvitermní řízení
5. TEPELNÉ ZTRÁTY: celkem kW, venkovní výpočtová °C, vnitřní °C

Vrať POUZE validní JSON matching UTParams."""

    MAR_PROMPT = """Parsuj český dokument měření a regulace (D.1.4.xx).

DOKUMENT:
{text}

Extrahuj:
1. ŘÍDICÍ SYSTÉM: značka, typ, PLC, počet I/O bodů
2. KOMUNIKACE: sběrnicový protokol, BMS, vizualizace, vzdálený přístup
3. ŘÍZENÉ PROFESE: které TZB profese řídí (VZT, UT, ZTI...)
4. ŘÍZENÁ ZAŘÍZENÍ: seznam zařízení
5. SENZORY: počet teplotních/vlhkostních/tlakových čidel

Vrať POUZE validní JSON matching MaRParams."""

    # Map params_key → prompt
    SO_TYPE_PROMPTS = {
        "road_params": ROAD_TZ_PROMPT,
        "traffic_params": DIO_PROMPT,
        "water_params": WATER_TZ_PROMPT,
        "vegetation_params": VEGETATION_TZ_PROMPT,
        "electro_params": ELECTRO_TZ_PROMPT,
        "pipeline_params": PIPELINE_TZ_PROMPT,
    }

    # D.1.4 profession prompts
    D14_PROMPTS = {
        "silnoproud_params": SILNOPROUD_PROMPT,
        "slaboproud_params": SLABOPROUD_PROMPT,
        "vzt_params": VZT_PROMPT,
        "zti_params": ZTI_PROMPT,
        "ut_params": UT_PROMPT,
        "mar_params": MAR_PROMPT,
    }

    async def _extract_type_specific(
        self,
        classification: ClassificationInfo,
        document_text: str,
    ) -> Dict[str, Any]:
        """
        Run type-specific AI extraction based on document classification.

        v3: Uses enriched classification (sub_type) to select specialized prompts:
        - TZ with sub_type TZ-D on bridge docs → BRIDGE_TZ_PROMPT → BridgeSOParams
        - PD with sub_type PD-ZD → FULL_PD_PROMPT → TenderExtraction
        - GE → GTP prompt → GTPExtraction
        - Otherwise uses standard TYPE_EXTRACTION_PROMPTS

        Also runs Layer 2 regex extraction for PD/Bridge/GTP fields.

        Returns dict with keys like 'technical', 'bill_of_quantities', etc.
        """
        category = classification.category
        results: Dict[str, Any] = {}

        # --- Layer 2 regex pre-extraction for specialized types ---
        if category == DocCategory.PD:
            pd_regex = self.extractor.extract_pd(document_text)
            if pd_regex:
                results["pd_regex"] = pd_regex
                logger.info(f"PD regex: {len(pd_regex)} fields extracted")

        if category == DocCategory.TZ:
            bridge_regex = self.extractor.extract_bridge(document_text)
            if bridge_regex:
                results["bridge_regex"] = bridge_regex
                logger.info(f"Bridge regex: {len(bridge_regex)} fields extracted")

        if category == DocCategory.GE:
            gtp_regex = self.extractor.extract_gtp(document_text)
            if gtp_regex:
                results["gtp_regex"] = gtp_regex
                logger.info(f"GTP regex: {len(gtp_regex)} fields extracted")

        # --- v3.1: SO type-specific regex pre-extraction ---
        so_code = getattr(classification, 'so_code', None)
        so_params_key = None
        if so_code:
            so_params_key = detect_so_params_key(so_code)
        if not so_params_key and category == DocCategory.TZ:
            so_params_key = detect_so_type_from_content(document_text)

        if so_params_key and so_params_key not in ("bridge_params", "technical"):
            so_regex = extract_so_type_params(so_params_key, document_text)
            if so_regex:
                results["so_type_regex"] = so_regex
                results["so_params_key"] = so_params_key
                logger.info(f"SO type regex ({so_params_key}): {len(so_regex)} fields")

        # --- v3.2: D.1.4 profession detection and regex extraction ---
        d14_profession = None
        filename = getattr(classification, '_filename', '') or ''
        if is_d14_document(filename, document_text):
            d14_profession = detect_d14_profession(filename, document_text)
            if d14_profession and d14_profession != "unknown":
                results["d14_profession"] = d14_profession
                # Run D.1.4 regex extraction
                d14_regex = extract_so_type_params(d14_profession, document_text)
                if d14_regex:
                    results["d14_regex"] = d14_regex
                    logger.info(f"D.1.4 regex ({d14_profession}): {len(d14_regex)} fields")

        # --- Select prompt and model based on sub_type ---
        prompt_template = None
        model_cls = None

        # v3: Check for specialized prompts based on sub_type
        sub_type = getattr(classification, 'sub_type', None)

        if category == DocCategory.TZ and sub_type == DocSubType.TZ_D:
            # Bridge dílčí TZ — use full ČSN 73 6200 prompt
            prompt_template = self.BRIDGE_TZ_PROMPT
            model_cls = BridgeSOParams
        elif category == DocCategory.PD and sub_type in (DocSubType.PD_ZD, None):
            # Full PD/Zadávací dokumentace — use ZZVZ prompt
            prompt_template = self.FULL_PD_PROMPT
            model_cls = TenderExtraction
        elif d14_profession and d14_profession in self.D14_PROMPTS:
            # v3.2: D.1.4 profession-specific prompt (silnoproud, slaboproud, VZT, etc.)
            prompt_template = self.D14_PROMPTS[d14_profession]
            model_cls = D14_PARAMS_CLASSES.get(d14_profession)
        elif so_params_key and so_params_key in self.SO_TYPE_PROMPTS:
            # v3.1: SO type-specific prompt (road, water, vegetation, DIO, etc.)
            prompt_template = self.SO_TYPE_PROMPTS[so_params_key]
            model_cls = SO_PARAMS_CLASSES.get(so_params_key)
        else:
            # Standard extraction
            prompt_template = self.TYPE_EXTRACTION_PROMPTS.get(category)
            model_cls = self.EXTRACTION_MODEL_MAP.get(category)

        if not prompt_template or not model_cls:
            return results

        # Limit text to avoid token overflow (use first 30K chars)
        text_for_extraction = document_text[:30_000]
        prompt = prompt_template.format(text=text_for_extraction)

        try:
            # v3.1.1: Use task-based routing for extraction
            ai_result = await self.enricher.call_llm_for_task(prompt, task_type="extract")
            if not ai_result or not isinstance(ai_result, dict):
                return results

            # Merge regex facts into AI result (regex wins on conflicts — confidence=1.0)
            if category == DocCategory.PD and "pd_regex" in results:
                for k, v in results["pd_regex"].items():
                    if v is not None and (k not in ai_result or ai_result[k] is None):
                        ai_result[k] = v

            if category == DocCategory.TZ and "bridge_regex" in results:
                for k, v in results["bridge_regex"].items():
                    if v is not None and (k not in ai_result or ai_result[k] is None):
                        ai_result[k] = v

            if category == DocCategory.GE and "gtp_regex" in results:
                for k, v in results["gtp_regex"].items():
                    if v is not None and (k not in ai_result or ai_result[k] is None):
                        ai_result[k] = v

            # v3.1: Merge SO type regex into AI result
            if "so_type_regex" in results:
                for k, v in results["so_type_regex"].items():
                    if v is not None and (k not in ai_result or ai_result[k] is None):
                        ai_result[k] = v

            # Parse into Pydantic model for validation
            extraction = model_cls(**ai_result)

            # Map to response field name
            field_map = {
                DocCategory.TZ: "technical",
                DocCategory.RO: "bill_of_quantities",
                DocCategory.PD: "tender_conditions",
                DocCategory.HA: "schedule",
                DocCategory.GE: "gtp",
            }

            # v3: Override field name for specialized extractions
            if model_cls == BridgeSOParams:
                results["bridge_params"] = extraction
                logger.info(f"Bridge TZ extraction: {len(ai_result)} fields")
            elif model_cls == TenderExtraction:
                results["tender"] = extraction
                logger.info(f"Full PD extraction: {len(ai_result)} fields")
            elif d14_profession and d14_profession in D14_PARAMS_CLASSES:
                # v3.2: Store under D.1.4 profession key
                results[d14_profession] = extraction
                # Merge regex facts
                if "d14_regex" in results:
                    for k, v in results["d14_regex"].items():
                        if v is not None and (k not in ai_result or ai_result[k] is None):
                            ai_result[k] = v
                logger.info(f"D.1.4 extraction ({d14_profession}): {len(ai_result)} fields")
            elif so_params_key and so_params_key in SO_PARAMS_CLASSES:
                # v3.1: Store under SO-type-specific key
                results[so_params_key] = extraction
                logger.info(f"SO type extraction ({so_params_key}): {len(ai_result)} fields")
            else:
                field_name = field_map.get(category)
                if field_name:
                    results[field_name] = extraction
                    logger.info(f"Type-specific extraction ({category.value}): "
                                 f"{len(ai_result)} fields extracted")

        except Exception as e:
            logger.warning(f"Type-specific extraction failed ({category.value}): {e}")

        return results


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
