"""KROS Parser - explicit XC4/OTSKP ingestion and fallbacks."""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
import xml.etree.ElementTree as ET

from app.parsers.xc4_parser import parse_xml_tree as parse_aspe_xml_tree
from app.utils.position_normalizer import normalize_positions

logger = logging.getLogger(__name__)


class KROSParser:
    """Parse KROS XML files (UNIXML, Tabulární and AspeEsticon XC4 formats)"""

    def parse(self, file_path: Path, project_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Parse KROS XML file
        
        Args:
            file_path: Path to KROS XML file
            
        Returns:
            {
                "document_info": {...},
                "positions": [...]
            }
        """
        project_prefix = f"[project={project_id}] " if project_id else ""

        logger.info("%s🧱 Parsing KROS XML: %s", project_prefix, file_path.name)

        kros_format = "UNKNOWN"

        try:
            tree = ET.parse(file_path)
            root = tree.getroot()

            if self._has_xc4_prices(root):
                kros_format = "OTSKP_XC4"
            else:
                # Detect KROS format only if explicit XC4 subtree is missing
                kros_format = self._detect_format(root)
            logger.info("%sDetected KROS format: %s", project_prefix, kros_format)

            # Parse based on format
            parser_diagnostics: Dict[str, Any] = {}
            positions: List[Dict[str, Any]] = []

            if kros_format == "OTSKP_XC4":
                positions = self._parse_xc4_price_lists(root, register_runtime=True)

            if not positions:
                if self._has_xc4_prices(root):
                    logger.info(
                        "%sXC4 subtree detected but explicit parse returned 0 items",
                        project_prefix,
                    )
                if kros_format == "KROS_UNIXML":
                    positions = self._parse_unixml(root)
                elif kros_format == "KROS_TABULAR":
                    positions = self._parse_tabular(root)
                elif kros_format == "ASPE_XC4":
                    positions, parser_diagnostics = self._parse_aspe_xc4(root)
                else:
                    logger.warning("Unknown KROS format, trying generic XML parsing")
                    positions = self._parse_generic(root)

            logger.info(
                "%sExtracted %s raw positions from KROS XML", project_prefix, len(positions)
            )

            # Normalize positions and capture statistics
            normalized_positions, normalization_stats = normalize_positions(
                positions,
                return_stats=True
            )

            parsed_total = normalization_stats["normalized_total"]
            logger.info("Parsed KROS XML: %s positions", parsed_total)

            parser_diagnostics = parser_diagnostics or {
                "parsed": len(positions),
                "skipped": []
            }

            return {
                "document_info": {
                    "filename": file_path.name,
                    "format": "kros_xml",
                    "kros_format": kros_format
                },
                "positions": normalized_positions,
                "diagnostics": {
                    "raw_total": normalization_stats["raw_total"],
                    "normalized_total": normalization_stats["normalized_total"],
                    "skipped_total": normalization_stats["skipped_total"],
                    "kros_format": kros_format,
                    "parsing": parser_diagnostics
                }
            }

        except Exception as e:
            logger.error(f"❌ KROS XML parsing failed: {str(e)}", exc_info=True)
            return {
                "document_info": {
                    "filename": file_path.name,
                    "format": "kros_xml",
                    "error": str(e)
                },
                "positions": [],
                "diagnostics": {
                    "raw_total": 0,
                    "normalized_total": 0,
                    "skipped_total": 0,
                    "kros_format": kros_format,
                    "parsing": {"parsed": 0, "skipped": []}
                }
            }
    
    @staticmethod
    def _detect_format(root: ET.Element) -> str:
        """
        Detect KROS XML format
        
        Returns:
            "KROS_UNIXML", "KROS_TABULAR", or "UNKNOWN"
        """
        # Check for UNIXML markers
        if root.find(".//Polozky") is not None or root.find(".//Polozka") is not None:
            return "KROS_UNIXML"

        # Check for Tabular markers
        if root.find(".//TZ") is not None or root.find(".//Row") is not None:
            return "KROS_TABULAR"

        # Check for AspeEsticon XC4 markers
        if root.find(".//objekty") is not None and root.find(".//polozka") is not None:
            source = root.findtext(".//zdroj")
            if source and source.strip().lower() == "aspeesticon":
                return "ASPE_XC4"
            return "ASPE_XC4"

        return "UNKNOWN"

    @staticmethod
    def _has_xc4_prices(root: ET.Element) -> bool:
        """Return True if the XML tree contains XC4 price-list nodes."""

        def _local(tag: str) -> str:
            return tag.split("}")[-1] if tag else ""

        if _local(root.tag) == "XC4":
            return True

        return root.find(".//XC4") is not None

    # ------------------------------------------------------------------
    # XC4 Cenové soustavy (TSKP / OTSKP)
    # ------------------------------------------------------------------

    def _parse_xc4_price_lists(
        self,
        root: ET.Element,
        *,
        register_runtime: bool = True,
    ) -> List[Dict[str, Any]]:
        """Parse XC4 Cenové soustavy (TSKP / OTSKP) structures."""

        cenove_nodes = list(self._iter_cenove_soustavy(root))
        if not cenove_nodes:
            return []

        positions: List[Dict[str, Any]] = []
        runtime_registered = 0
        runtime_catalog: Dict[str, Dict[str, Any]] | None = None
        runtime_loader = None

        if register_runtime:
            try:  # Lazy import to avoid circular dependency during KB bootstrap
                from app.core.kb_loader import init_kb_loader

                runtime_loader = init_kb_loader()
                runtime_catalog = runtime_loader.kb_b1.setdefault("tskp", {})
            except Exception:  # pragma: no cover - runtime KB may not be available yet
                runtime_catalog = None
        for cs_node in cenove_nodes:
            cs_type = self._find_text(cs_node, "typ_CS") or self._find_text(cs_node, "typ_cs")
            cs_type = (cs_type or "").strip().upper()
            if cs_type and cs_type not in {"TSKP", "OTSKP"}:
                continue

            polozky = self._find_child(cs_node, "Polozky")
            if polozky is None:
                continue

            for item in self._iter_children(polozky, "Polozka"):
                code = (self._find_text(item, "znacka") or "").strip()
                name = (self._find_text(item, "nazev") or "").strip()
                unit = (self._find_text(item, "MJ") or "").strip()
                tech_spec = (self._find_text(item, "technicka_specifikace") or "").strip()
                unit_price = (self._find_text(item, "jedn_cena") or "").strip()

                if not code and not name:
                    continue

                position: Dict[str, Any] = {
                    "code": code,
                    "name": name,
                    "unit": unit,
                    "tech_spec": tech_spec,
                    "unit_price": unit_price,
                    "system": cs_type or "TSKP",
                }

                positions.append(position)

                if runtime_catalog is not None and code:
                    runtime_registered += self._register_runtime_position(
                        runtime_catalog,
                        code,
                        name,
                        unit,
                        tech_spec,
                        cs_type or "TSKP",
                    )

        if runtime_registered and runtime_loader is not None:
            runtime_loader.invalidate_kros_index()  # invalidate cached index so new codes are visible

        return positions

    @staticmethod
    def _register_runtime_position(
        catalog: Dict[str, Dict[str, Any]],
        code: str,
        name: str,
        unit: str,
        tech_spec: str,
        system: str,
    ) -> int:
        normalized = re.sub(r"[^A-Z0-9]", "", code.upper()) if code else ""
        payload = {
            "code": code,
            "normalized": normalized,
            "name": name,
            "unit": unit,
            "tech_spec": tech_spec,
            "system": system or "TSKP",
        }

        catalog[code] = payload
        registered = 1

        if normalized and normalized not in catalog:
            catalog[normalized] = payload
            registered += 1

        return registered

    # Helper utilities -------------------------------------------------

    @staticmethod
    def _iter_cenove_soustavy(root: ET.Element) -> Iterable[ET.Element]:
        """Yield <CenoveSoustavy> nodes using the explicit XC4 structure."""

        visited: set[int] = set()

        def _local(tag: str) -> str:
            return tag.split("}")[-1] if tag else ""

        def _children(element: Optional[ET.Element], tag: str) -> Iterable[ET.Element]:
            if element is None:
                return []
            return [child for child in element if _local(child.tag).lower() == tag.lower()]

        building_info = None
        if _local(root.tag).lower() == "buildinginformation":
            building_info = root
        else:
            for candidate in root.iter():
                if _local(candidate.tag).lower() == "buildinginformation":
                    building_info = candidate
                    break

        if building_info is not None:
            for classification in _children(building_info, "Classification"):
                for system in _children(classification, "System"):
                    for items in _children(system, "Items"):
                        for item in _children(items, "Item"):
                            for children in _children(item, "Children"):
                                for nested in _children(children, "Item"):
                                    xc4 = next(iter(_children(nested, "XC4")), None)
                                    if xc4 is None:
                                        continue
                                    for cs_node in _children(xc4, "CenoveSoustavy"):
                                        identifier = id(cs_node)
                                        if identifier not in visited:
                                            visited.add(identifier)
                                            yield cs_node

        # Fallback for simplified XC4 exports (rooted at <XC4>)
        for xc4 in root.iter():
            if _local(xc4.tag).lower() != "xc4":
                continue
            for cs_node in _children(xc4, "CenoveSoustavy"):
                identifier = id(cs_node)
                if identifier not in visited:
                    visited.add(identifier)
                    yield cs_node

    @staticmethod
    def _find_child(element: Optional[ET.Element], tag: str) -> Optional[ET.Element]:
        if element is None:
            return None
        tag_lower = tag.lower()
        for child in element:
            if child.tag.split("}")[-1].lower() == tag_lower:
                return child
        return None

    @staticmethod
    def _iter_children(element: Optional[ET.Element], tag: str) -> Iterable[ET.Element]:
        if element is None:
            return []
        tag_lower = tag.lower()
        for child in element:
            if child.tag.split("}")[-1].lower() == tag_lower:
                yield child

    @staticmethod
    def _find_text(element: Optional[ET.Element], tag: str) -> Optional[str]:
        if element is None:
            return None
        child = KROSParser._find_child(element, tag)
        if child is None:
            return None
        return child.text

    def _parse_aspe_xc4(self, root: ET.Element) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """Parse AspeEsticon XC4 XML format."""

        logger.info("Parsing AspeEsticon XC4 format")
        positions, diagnostics = parse_aspe_xml_tree(root)
        logger.info(
            "Parsed %s positions (%s skipped)",
            len(positions),
            len(diagnostics.get("skipped", []))
        )
        return positions, diagnostics
    
    def _parse_unixml(self, root: ET.Element) -> List[Dict[str, Any]]:
        """
        Parse KROS UNIXML format
        
        Structure:
        <UNIXML>
          <Polozky>
            <Polozka>
              <Cislo>1</Cislo>
              <Popis>Description</Popis>
              <Mnozstvi>12.5</Mnozstvi>
              <MJ>m³</MJ>
              <Kod>121-01-001</Kod>
            </Polozka>
          </Polozky>
        </UNIXML>
        """
        logger.info("Parsing KROS UNIXML format")
        
        positions = []
        
        # Find all position elements
        # Try different possible paths
        position_elements = (
            root.findall(".//Polozka") or
            root.findall(".//polozka") or
            root.findall(".//Position") or
            root.findall(".//Item")
        )
        
        if not position_elements:
            logger.warning("No position elements found in UNIXML")
            return []
        
        logger.info(f"Found {len(position_elements)} position elements")
        
        for idx, element in enumerate(position_elements, start=1):
            position = {}
            
            # Extract all child elements
            for child in element:
                tag = child.tag
                value = child.text
                
                if value:
                    position[tag] = value.strip()
            
            # Add index if Cislo not present
            if 'Cislo' not in position and 'cislo' not in position:
                position['number'] = str(idx)
            
            if position:
                positions.append(position)
        
        logger.info(f"Extracted {len(positions)} positions from UNIXML")
        return positions
    
    def _parse_tabular(self, root: ET.Element) -> List[Dict[str, Any]]:
        """
        Parse KROS Tabular format
        
        Structure:
        <TZ>
          <Row>
            <A>1</A>              <!-- Position number -->
            <B>121151113</B>      <!-- Code -->
            <C>Description</C>    <!-- Description -->
            <F>123.000</F>        <!-- Quantity -->
            <G>29.10</G>          <!-- Unit price -->
            <H>m³</H>             <!-- Unit -->
          </Row>
        </TZ>
        """
        logger.info("Parsing KROS Tabular format")
        
        positions = []
        
        # Find all row elements
        row_elements = root.findall(".//Row") or root.findall(".//row")
        
        if not row_elements:
            logger.warning("No row elements found in Tabular format")
            return []
        
        logger.info(f"Found {len(row_elements)} row elements")
        
        # Column mapping for tabular format
        # These are common KROS column letters
        column_map = {
            'A': 'number',
            'B': 'code',
            'C': 'description',
            'D': 'additional_info',
            'E': 'unit',
            'F': 'quantity',
            'G': 'unit_price',
            'H': 'total_price',
            'I': 'note'
        }
        
        for element in row_elements:
            position = {}
            
            # Extract all column values
            for child in element:
                tag = child.tag
                value = child.text
                
                if value:
                    # Map column letter to field name
                    field_name = column_map.get(tag, tag.lower())
                    position[field_name] = value.strip()
            
            # Skip empty rows
            if not position:
                continue
            
            # Skip header rows (often have text like "Popis" in description)
            if position.get('description', '').lower() in ['popis', 'description', 'nazev']:
                continue
            
            positions.append(position)
        
        logger.info(f"Extracted {len(positions)} positions from Tabular format")
        return positions
    
    def _parse_generic(self, root: ET.Element) -> List[Dict[str, Any]]:
        """
        Generic XML parser for unknown KROS formats
        
        Tries to find any repeating element that might contain positions
        """
        logger.info("Trying generic XML parsing")
        
        positions = []
        
        # Find all leaf elements (elements with text but no children)
        def find_repeated_elements(element):
            """Find elements that repeat (likely position records)"""
            child_tags = {}
            for child in element:
                tag = child.tag
                if tag not in child_tags:
                    child_tags[tag] = []
                child_tags[tag].append(child)
            
            # Return tags that appear multiple times
            return {
                tag: elements 
                for tag, elements in child_tags.items() 
                if len(elements) > 1
            }
        
        repeated = find_repeated_elements(root)
        
        if not repeated:
            logger.warning("No repeated elements found in XML")
            return []
        
        # Use the most common repeated element as position container
        most_common_tag = max(repeated.keys(), key=lambda k: len(repeated[k]))
        logger.info(f"Using <{most_common_tag}> as position elements ({len(repeated[most_common_tag])} found)")
        
        for element in repeated[most_common_tag]:
            position = {}
            
            # Extract all child text
            for child in element:
                if child.text:
                    position[child.tag] = child.text.strip()
            
            if position:
                positions.append(position)
        
        logger.info(f"Extracted {len(positions)} positions from generic parsing")
        return positions
    
    def get_supported_extensions(self) -> set:
        """Return supported file extensions"""
        return {'.xml'}


# ==============================================================================
# USAGE EXAMPLE
# ==============================================================================

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        xml_path = Path(sys.argv[1])
        
        parser = KROSParser()
        result = parser.parse(xml_path)
        
        print(f"\n📊 Parsing Results:")
        print(f"File: {result['document_info']['filename']}")
        print(f"Format: {result['document_info'].get('kros_format', 'UNKNOWN')}")
        print(f"Positions found: {len(result['positions'])}")
        
        if result['positions']:
            print(f"\n📝 First 3 positions:")
            for pos in result['positions'][:3]:
                print(f"\n  Position: {pos.get('position_number', 'N/A')}")
                print(f"  Code: {pos.get('code', 'N/A')}")
                print(f"  Description: {pos.get('description', 'N/A')[:50]}")
                print(f"  Quantity: {pos.get('quantity', 0)} {pos.get('unit', '')}")
                if 'unit_price' in pos:
                    print(f"  Price: {pos['unit_price']} CZK")
    else:
        print("Usage: python kros_parser.py <path_to_xml>")
        print("Example: python kros_parser.py data/raw/project1/vykaz_vymer/estimate.xml")
