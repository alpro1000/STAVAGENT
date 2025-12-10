"""
Gemini API Client - compatible interface with ClaudeClient
COST SAVINGS: Gemini 2.0 Flash = FREE (1500 req/day) or $0.075/MTok vs Claude $3/MTok
"""
from pathlib import Path
import json
import logging
import re
from typing import Dict, Any, Optional
import pandas as pd

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    logging.warning("google-generativeai not installed. Gemini client unavailable.")

from app.core.config import settings

logger = logging.getLogger(__name__)


class GeminiClient:
    """Client for interacting with Google Gemini API - drop-in replacement for ClaudeClient"""

    def __init__(self):
        if not GEMINI_AVAILABLE:
            raise ImportError("google-generativeai package required. Install: pip install google-generativeai")

        # Configure Gemini API
        if not settings.GOOGLE_API_KEY:
            raise ValueError("GOOGLE_API_KEY not set in environment")

        genai.configure(api_key=settings.GOOGLE_API_KEY)

        # Default model: gemini-2.0-flash-exp (newest, FREE, fast)
        # Alternatives: gemini-1.5-flash, gemini-1.5-pro
        self.model_name = getattr(settings, 'GEMINI_MODEL', 'gemini-2.0-flash-exp')

        # Safety settings - allow technical content
        self.safety_settings = [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]

        # Generation config
        self.max_tokens = getattr(settings, 'CLAUDE_MAX_TOKENS', 4096)  # Reuse Claude config

        logger.info(f"✅ Gemini client initialized with model: {self.model_name}")

    def _create_model(self, temperature: float = 0.3):
        """Create Gemini model instance with config"""
        generation_config = {
            "temperature": temperature,
            "max_output_tokens": self.max_tokens,
            "response_mime_type": "text/plain",  # Will parse JSON ourselves
        }

        return genai.GenerativeModel(
            model_name=self.model_name,
            generation_config=generation_config,
            safety_settings=self.safety_settings
        )

    def call(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3
    ) -> Dict[str, Any]:
        """
        Call Gemini API with prompt - compatible with ClaudeClient.call()

        Args:
            prompt: User prompt
            system_prompt: Optional system prompt (prepended to user prompt)
            temperature: Sampling temperature

        Returns:
            Parsed JSON response
        """
        try:
            model = self._create_model(temperature)

            # Gemini doesn't have separate system prompt, prepend to user message
            full_prompt = prompt
            if system_prompt:
                full_prompt = f"{system_prompt}\n\n{prompt}"

            logger.debug(f"Calling Gemini {self.model_name} with prompt length: {len(full_prompt)} chars")

            # Call Gemini
            response = model.generate_content(full_prompt)

            # Extract text
            if not response.parts:
                raise ValueError("Gemini returned empty response")

            result_text = response.text

            # Remove markdown code blocks if present (same as Claude)
            code_block_match = re.search(r'```(?:json)?\s*(.*?)\s*```', result_text, re.DOTALL)
            if code_block_match:
                result_text = code_block_match.group(1).strip()
            else:
                result_text = result_text.strip()

            # Try to parse as JSON
            try:
                return json.loads(result_text)
            except json.JSONDecodeError:
                logger.warning("Gemini response is not valid JSON, returning raw text")
                return {"raw_text": result_text}

        except Exception as e:
            logger.exception(f"Gemini API call failed: {e}")
            raise

    def parse_excel(
        self,
        file_path: Path,
        prompt_name: str = "parsing/parse_vykaz_vymer"
    ) -> Dict[str, Any]:
        """
        Parse Excel file using Gemini (compatible with ClaudeClient)

        NOTE: Uses text representation of Excel (no native Excel upload yet)
        """
        try:
            logger.info(f"Parsing Excel file with Gemini: {file_path}")

            # Read Excel file
            df = pd.read_excel(file_path, sheet_name=0)

            # Convert to string representation
            excel_text = df.to_string(index=False, max_rows=1000)
            sample_text = df.head(20).to_string(index=False)

            # Load prompt from settings.PROMPTS_DIR
            prompts_dir = settings.PROMPTS_DIR / "claude"  # Reuse Claude prompts
            prompt_path = prompts_dir / f"{prompt_name}.txt"

            if prompt_path.exists():
                with open(prompt_path, 'r', encoding='utf-8') as f:
                    parsing_prompt = f.read()
            else:
                # Fallback generic prompt
                parsing_prompt = "Parse this Excel file and return positions as JSON with 'positions' array."

            # Build full prompt
            full_prompt = f"""{parsing_prompt}

===== UKÁZKA PRVNÍCH 20 ŘÁDKŮ =====
{sample_text}

===== CELÝ DOKUMENT =====
{excel_text}
"""

            logger.info(f"Sending {len(df)} rows to Gemini for parsing")

            # Call Gemini
            result = self.call(full_prompt)

            logger.info(f"Parsed {result.get('total_positions', 0)} positions")

            return result

        except Exception as e:
            logger.exception("Failed to parse Excel with Gemini")
            raise

    def parse_xml(
        self,
        file_path: Path,
        prompt_name: str = None
    ) -> Dict[str, Any]:
        """
        Parse XML file using Gemini (compatible with ClaudeClient)
        """
        try:
            logger.info(f"Parsing XML file with Gemini: {file_path}")

            # Read XML file
            with open(file_path, 'r', encoding='utf-8') as f:
                xml_content = f.read()

            # Auto-detect format (same logic as Claude)
            if prompt_name is None:
                if '<unixml' in xml_content.lower():
                    prompt_name = "parsing/parse_kros_unixml"
                    logger.info("Detected KROS UNIXML format")
                elif '<TZ>' in xml_content or '<Row>' in xml_content:
                    prompt_name = "parsing/parse_kros_table_xml"
                    logger.info("Detected KROS Table XML format")
                else:
                    prompt_name = "parsing/parse_vykaz_vymer"

            # Load prompt
            prompts_dir = settings.PROMPTS_DIR / "claude"
            prompt_path = prompts_dir / f"{prompt_name}.txt"

            if prompt_path.exists():
                with open(prompt_path, 'r', encoding='utf-8') as f:
                    parsing_prompt = f.read()
            else:
                parsing_prompt = "Parse this XML file and return positions as JSON."

            # Limit XML size for Gemini (it has 1M context but best to be conservative)
            max_chars = 100000  # Gemini can handle more than Claude
            if len(xml_content) > max_chars:
                logger.warning(f"XML truncated from {len(xml_content)} to {max_chars} chars")
                xml_content = xml_content[:max_chars] + "\n\n[... XML ZKRÁCENO ...]"

            # Build full prompt
            full_prompt = f"""{parsing_prompt}

===== XML DOKUMENT =====
{xml_content}
"""

            logger.info(f"Sending XML to Gemini (size: {len(xml_content)} chars)")

            # Call Gemini
            result = self.call(full_prompt)

            positions_count = len(result.get('positions', []))
            logger.info(f"Parsed {positions_count} positions from XML")

            return result

        except Exception as e:
            logger.exception("Failed to parse XML with Gemini")
            raise

    def parse_pdf(
        self,
        file_path: Path,
        prompt_name: str = "parsing/parse_vykaz_vymer"
    ) -> Dict[str, Any]:
        """
        Parse PDF file using Gemini (compatible with ClaudeClient)

        NOTE: Gemini 1.5+ supports native PDF upload (better than Claude!)
        """
        try:
            logger.info(f"Parsing PDF file with Gemini: {file_path}")

            # Load prompt
            prompts_dir = settings.PROMPTS_DIR / "claude"
            prompt_path = prompts_dir / f"{prompt_name}.txt"

            if prompt_path.exists():
                with open(prompt_path, 'r', encoding='utf-8') as f:
                    parsing_prompt = f.read()
            else:
                parsing_prompt = "Parse this PDF file and return positions as JSON."

            # Upload PDF file to Gemini
            uploaded_file = genai.upload_file(file_path)
            logger.info(f"Uploaded PDF to Gemini: {uploaded_file.name}")

            # Create model and generate
            model = self._create_model(temperature=0.3)

            # Call with PDF file + prompt
            response = model.generate_content([uploaded_file, parsing_prompt])

            # Extract and parse
            result_text = response.text.strip()

            # Remove markdown
            result_text = result_text.replace("```json\n", "").replace("```json", "")
            result_text = result_text.replace("```\n", "").replace("```", "")
            result_text = result_text.strip()

            try:
                result = json.loads(result_text)
            except json.JSONDecodeError:
                logger.warning("Gemini PDF parse result is not valid JSON")
                result = {"raw_text": result_text}

            logger.info(f"Parsed {result.get('total_positions', 0)} positions from PDF")

            return result

        except Exception as e:
            logger.exception("Failed to parse PDF with Gemini")
            raise

    def audit_position(
        self,
        position: Dict[str, Any],
        knowledge_base: Dict[str, Any],
        prompt_name: str = "audit/audit_position"
    ) -> Dict[str, Any]:
        """
        Audit a single position using Gemini (compatible with ClaudeClient)
        """
        try:
            # Load audit prompt
            prompts_dir = settings.PROMPTS_DIR / "claude"
            prompt_path = prompts_dir / f"{prompt_name}.txt"

            if prompt_path.exists():
                with open(prompt_path, 'r', encoding='utf-8') as f:
                    audit_prompt = f.read()
            else:
                audit_prompt = "Audit this position and return assessment as JSON."

            # Build context
            full_prompt = f"""{audit_prompt}

===== POZICE K AUDITU =====
{json.dumps(position, indent=2, ensure_ascii=False)}

===== KNOWLEDGE BASE =====
{json.dumps(knowledge_base, indent=2, ensure_ascii=False)}
"""

            # Call Gemini
            result = self.call(full_prompt)

            return result

        except Exception as e:
            logger.exception("Failed to audit position with Gemini")
            raise
