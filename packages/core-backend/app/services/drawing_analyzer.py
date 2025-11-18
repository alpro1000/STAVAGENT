"""
Drawing Analyzer Service
Handles analysis of construction drawings and linking to estimate positions
"""
from pathlib import Path
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid

from app.core.gpt4_client import gpt4_vision_client
from app.models.drawing import (
    DrawingAnalysisResult,
    ConstructionElement,
    MaterialSpecification,
    ExposureClass,
    SurfaceCategory,
    DrawingEstimateLink
)

logger = logging.getLogger(__name__)


class DrawingAnalyzer:
    """Service for analyzing construction drawings"""
    
    def __init__(self):
        self.gpt4_client = gpt4_vision_client
    
    async def upload_and_analyze_drawing(
        self,
        project_id: str,
        drawing_file_path: Path,
        drawing_type: str = "general"
    ) -> Dict[str, Any]:
        """
        Upload and analyze a construction drawing
        
        Args:
            project_id: ID of the project
            drawing_file_path: Path to the drawing file
            drawing_type: Type of drawing (situace, půdorys, řez, detail)
        
        Returns:
            Analysis result
        """
        try:
            drawing_id = f"dwg_{uuid.uuid4().hex[:8]}"
            
            logger.info(f"Analyzing drawing {drawing_id} for project {project_id}")
            
            # Perform comprehensive analysis (OCR + Vision)
            analysis = self.gpt4_client.analyze_drawing_comprehensive(drawing_file_path)
            
            if not analysis.get("success"):
                return {
                    "success": False,
                    "drawing_id": drawing_id,
                    "error": analysis.get("error", "Analysis failed")
                }
            
            # Extract vision analysis
            vision_data = analysis.get("vision_analysis", {})
            ocr_data = analysis.get("ocr_analysis", {})
            
            # Build DrawingAnalysisResult
            result = self._build_analysis_result(
                drawing_id=drawing_id,
                project_id=project_id,
                file_name=drawing_file_path.name,
                vision_data=vision_data,
                ocr_data=ocr_data
            )
            
            logger.info(f"Drawing {drawing_id} analyzed successfully")
            
            return {
                "success": True,
                "drawing_id": drawing_id,
                "project_id": project_id,
                "analysis": result
            }
        
        except Exception as e:
            logger.error(f"Drawing analysis failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    def _build_analysis_result(
        self,
        drawing_id: str,
        project_id: str,
        file_name: str,
        vision_data: Dict[str, Any],
        ocr_data: Dict[str, Any]
    ) -> DrawingAnalysisResult:
        """
        Build structured analysis result from raw AI outputs
        
        Args:
            drawing_id: ID of the drawing
            project_id: ID of the project
            file_name: Name of the file
            vision_data: Vision analysis data
            ocr_data: OCR analysis data
        
        Returns:
            Structured DrawingAnalysisResult
        """
        # Extract metadata from vision analysis
        drawing_analysis = vision_data.get("drawing_analysis", {})
        
        # Extract construction elements
        elements = []
        for elem_data in vision_data.get("construction_elements", []):
            try:
                element = ConstructionElement(
                    element_type=elem_data.get("element_type", ""),
                    dimensions=str(elem_data.get("dimensions", "")),
                    material=elem_data.get("material", {}).get("specification", ""),
                    position_mark=elem_data.get("element_mark"),
                    quantity=elem_data.get("quantity")
                )
                elements.append(element)
            except Exception as e:
                logger.warning(f"Failed to parse element: {e}")
        
        # Extract material specifications
        materials = []
        for mat_data in vision_data.get("materials_summary", []):
            try:
                material = MaterialSpecification(
                    material_type=mat_data.get("material_type", ""),
                    specification=mat_data.get("specification", ""),
                    quantity=mat_data.get("estimated_volume_m3"),
                    unit="m³" if mat_data.get("material_type") == "BETON" else "kg",
                    location=", ".join(mat_data.get("elements_using", [])),
                    standard=mat_data.get("standard")
                )
                materials.append(material)
            except Exception as e:
                logger.warning(f"Failed to parse material: {e}")
        
        # Extract exposure classes
        exposure_classes = []
        for exp_data in vision_data.get("exposure_classes_detail", []):
            try:
                exposure = ExposureClass(
                    code=exp_data.get("code", ""),
                    description=exp_data.get("description", ""),
                    requirements=exp_data.get("requirements", [])
                )
                exposure_classes.append(exposure)
            except Exception as e:
                logger.warning(f"Failed to parse exposure class: {e}")
        
        # Extract surface categories
        surface_categories = []
        for surf_data in vision_data.get("surface_categories_detail", []):
            try:
                surface = SurfaceCategory(
                    category=surf_data.get("category", ""),
                    finish_requirements=surf_data.get("requirements", "")
                )
                surface_categories.append(surface)
            except Exception as e:
                logger.warning(f"Failed to parse surface category: {e}")
        
        # Extract text from OCR
        text_extracted = []
        for text_block in ocr_data.get("text_blocks", []):
            text_extracted.append(text_block.get("text", ""))
        
        # Extract standards
        standards = vision_data.get("standards_identified", [])
        if isinstance(standards, list) and standards and isinstance(standards[0], dict):
            standards = [s.get("standard", "") for s in standards]
        
        # Determine confidence
        confidence = drawing_analysis.get("confidence", "MEDIUM")
        
        # Build result
        result = DrawingAnalysisResult(
            drawing_id=drawing_id,
            project_id=project_id,
            file_name=file_name,
            text_extracted=text_extracted,
            elements=elements,
            materials=materials,
            standards=standards or [],
            exposure_classes=exposure_classes,
            surface_categories=surface_categories,
            drawing_title=drawing_analysis.get("drawing_title"),
            drawing_number=drawing_analysis.get("drawing_number"),
            scale=drawing_analysis.get("scale"),
            date=ocr_data.get("metadata", {}).get("date"),
            confidence=confidence,
            notes=vision_data.get("visual_observations", []) + vision_data.get("recommendations", [])
        )
        
        return result
    
    async def link_drawing_to_estimate(
        self,
        drawing_id: str,
        drawing_analysis: DrawingAnalysisResult,
        estimate_positions: List[Dict[str, Any]]
    ) -> List[DrawingEstimateLink]:
        """
        Link construction elements from drawing to estimate positions
        
        Args:
            drawing_id: ID of the drawing
            drawing_analysis: Analysis result from drawing
            estimate_positions: List of positions from estimate
        
        Returns:
            List of links between drawing elements and estimate positions
        """
        links = []
        
        try:
            logger.info(f"Linking drawing {drawing_id} to estimate with {len(estimate_positions)} positions")
            
            # For each construction element in drawing
            for element in drawing_analysis.elements:
                # Try to match with estimate positions
                for position in estimate_positions:
                    # Simple matching logic based on keywords
                    confidence = self._calculate_match_confidence(element, position)
                    
                    if confidence > 0.5:  # Only create link if confidence is reasonable
                        link = DrawingEstimateLink(
                            drawing_id=drawing_id,
                            position_number=position.get("position_number", ""),
                            element_type=element.element_type,
                            confidence=confidence,
                            notes=f"Matched based on {element.element_type} and description"
                        )
                        links.append(link)
            
            logger.info(f"Created {len(links)} links between drawing and estimate")
            return links
        
        except Exception as e:
            logger.error(f"Failed to link drawing to estimate: {e}")
            return []
    
    def _calculate_match_confidence(
        self,
        element: ConstructionElement,
        position: Dict[str, Any]
    ) -> float:
        """
        Calculate confidence score for matching element to position
        
        Args:
            element: Construction element from drawing
            position: Position from estimate
        
        Returns:
            Confidence score (0.0 to 1.0)
        """
        confidence = 0.0
        
        position_desc = position.get("description", "").lower()
        element_type = element.element_type.lower()
        
        # Check for keyword matches
        keywords_map = {
            "základy": ["základ", "patk", "pas"],
            "piloty": ["pilot", "mikropilot"],
            "pilíře": ["pilíř", "sloup", "stojk"],
            "opěry": ["opěr", "pažící", "opor"],
            "beton": ["beton", "železobeton"],
            "ocel": ["ocel", "výztuž", "armatury"]
        }
        
        # Check element type matches
        for key, keywords in keywords_map.items():
            if key in element_type:
                for keyword in keywords:
                    if keyword in position_desc:
                        confidence += 0.3
                        break
        
        # Check material matches
        if element.material:
            material_lower = element.material.lower()
            if any(mat in material_lower for mat in ["beton", "c25", "c30", "c35"]):
                if any(mat in position_desc for mat in ["beton", "c25", "c30", "c35"]):
                    confidence += 0.3
        
        # Cap at 1.0
        return min(confidence, 1.0)


# Create singleton instance for import
drawing_analyzer = DrawingAnalyzer()
