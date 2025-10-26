"""
GPT-4 Vision Client for analyzing construction drawings
Supports PDF, PNG, JPG, and DWG files
"""
from pathlib import Path
import json
import base64
import logging
from typing import Dict, Any, Optional

from openai import OpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)


class GPT4VisionClient:
    """Client for interacting with GPT-4 Vision API"""
    
    def __init__(self):
        self.client = None
        self.model = "gpt-4-vision-preview"  # or "gpt-4o" for newer version
        self.max_tokens = 4096
        self.prompts_dir = settings.PROMPTS_DIR / "gpt4"
    
    def _ensure_client(self):
        """Lazy initialization of OpenAI client"""
        if self.client is None:
            self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
    
    def _load_prompt_from_file(self, prompt_name: str) -> str:
        """
        Load prompt from file
        
        Args:
            prompt_name: Name like 'ocr/scan_construction_drawings' or 'vision/analyze_technical_drawings'
        
        Returns:
            Prompt text
        """
        prompt_path = self.prompts_dir / f"{prompt_name}.txt"
        
        if not prompt_path.exists():
            raise FileNotFoundError(f"Prompt file not found: {prompt_path}")
        
        try:
            with open(prompt_path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            logger.error(f"Failed to load prompt from {prompt_path}: {e}")
            raise
    
    def _encode_image(self, image_path: Path) -> str:
        """
        Encode image to base64
        
        Args:
            image_path: Path to image file
        
        Returns:
            Base64 encoded image
        """
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    
    def _get_image_media_type(self, file_path: Path) -> str:
        """
        Get media type for image
        
        Args:
            file_path: Path to file
        
        Returns:
            Media type string
        """
        suffix = file_path.suffix.lower()
        media_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        }
        return media_types.get(suffix, 'image/jpeg')
    
    def analyze_drawing_with_ocr(
        self,
        image_path: Path,
        prompt_name: str = "ocr/scan_construction_drawings"
    ) -> Dict[str, Any]:
        """
        Analyze drawing using OCR to extract text
        
        Args:
            image_path: Path to drawing image (PDF converted to image, PNG, JPG)
            prompt_name: Name of OCR prompt file
        
        Returns:
            OCR analysis result with extracted text
        """
        try:
            self._ensure_client()
            
            # Load OCR prompt
            ocr_prompt = self._load_prompt_from_file(prompt_name)
            
            logger.info(f"Analyzing drawing with OCR: {image_path}")
            
            # Encode image
            base64_image = self._encode_image(image_path)
            
            # Build message with image
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": ocr_prompt
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=self.max_tokens
            )
            
            # Extract and parse response
            result_text = response.choices[0].message.content
            
            # Remove markdown if present
            result_text = result_text.replace("```json\n", "").replace("```json", "")
            result_text = result_text.replace("```\n", "").replace("```", "")
            result_text = result_text.strip()
            
            try:
                result = json.loads(result_text)
            except json.JSONDecodeError:
                logger.warning("OCR result is not valid JSON, returning raw text")
                result = {"raw_text": result_text, "error": "Failed to parse JSON"}
            
            logger.info(f"OCR analysis completed for {image_path}")
            return result
        
        except Exception as e:
            logger.error(f"OCR analysis failed: {e}")
            raise
    
    def analyze_drawing_with_vision(
        self,
        image_path: Path,
        prompt_name: str = "vision/analyze_technical_drawings"
    ) -> Dict[str, Any]:
        """
        Analyze technical drawing using Vision AI
        
        Args:
            image_path: Path to drawing image
            prompt_name: Name of vision prompt file
        
        Returns:
            Vision analysis result with construction elements, materials, etc.
        """
        try:
            self._ensure_client()
            
            # Load Vision prompt
            vision_prompt = self._load_prompt_from_file(prompt_name)
            
            logger.info(f"Analyzing drawing with Vision: {image_path}")
            
            # Encode image
            base64_image = self._encode_image(image_path)
            
            # Build message with image
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": vision_prompt
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=self.max_tokens
            )
            
            # Extract and parse response
            result_text = response.choices[0].message.content
            
            # Remove markdown if present
            result_text = result_text.replace("```json\n", "").replace("```json", "")
            result_text = result_text.replace("```\n", "").replace("```", "")
            result_text = result_text.strip()
            
            try:
                result = json.loads(result_text)
            except json.JSONDecodeError:
                logger.warning("Vision result is not valid JSON, returning raw text")
                result = {"raw_text": result_text, "error": "Failed to parse JSON"}
            
            logger.info(f"Vision analysis completed for {image_path}")
            return result
        
        except Exception as e:
            logger.error(f"Vision analysis failed: {e}")
            raise
    
    def analyze_drawing_comprehensive(
        self,
        image_path: Path
    ) -> Dict[str, Any]:
        """
        Comprehensive drawing analysis combining both OCR and Vision
        
        Args:
            image_path: Path to drawing image
        
        Returns:
            Combined analysis result
        """
        try:
            logger.info(f"Starting comprehensive analysis for {image_path}")
            
            # Run both analyses
            ocr_result = self.analyze_drawing_with_ocr(image_path)
            vision_result = self.analyze_drawing_with_vision(image_path)
            
            # Combine results
            combined_result = {
                "file_name": image_path.name,
                "analysis_type": "comprehensive",
                "ocr_analysis": ocr_result,
                "vision_analysis": vision_result,
                "success": True
            }
            
            logger.info(f"Comprehensive analysis completed for {image_path}")
            return combined_result
        
        except Exception as e:
            logger.error(f"Comprehensive analysis failed: {e}")
            return {
                "file_name": image_path.name,
                "analysis_type": "comprehensive",
                "success": False,
                "error": str(e)
            }


# Create singleton instance for import
gpt4_vision_client = GPT4VisionClient()
