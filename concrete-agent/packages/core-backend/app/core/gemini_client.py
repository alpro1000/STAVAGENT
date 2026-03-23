"""
Gemini API Client - compatible interface with ClaudeClient
COST SAVINGS: Gemini 2.5 Flash Lite = cheap ($0.075/MTok) vs Claude $3/MTok

Includes VertexGeminiClient for Cloud Run (uses ADC, no API key needed).
"""
from pathlib import Path
import json
import logging
import os
import re
import time
from typing import Dict, Any, Optional
import pandas as pd

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    logging.warning("google-generativeai not installed. Gemini client unavailable.")

try:
    import vertexai
    from vertexai.generative_models import GenerativeModel as VertexGenerativeModel
    VERTEX_AVAILABLE = True
except ImportError:
    VERTEX_AVAILABLE = False

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

        # Default model: gemini-2.5-flash-lite (Feb 2026, fast, cheap)
        # Alternatives: gemini-2.5-pro (higher quality), gemini-2.5-flash-lite (balanced)
        self.model_name = getattr(settings, 'GEMINI_MODEL', 'gemini-2.5-flash-lite')

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


class VertexGeminiClient:
    """
    Vertex AI Gemini client — drop-in replacement for GeminiClient.
    Uses Application Default Credentials (ADC) on Cloud Run — no API key needed.
    Billing goes through Google Cloud project credits.
    """

    # Models to try, newest GA first (verified 2026-03-23, europe-west3 only)
    # NOTE: gemini-2.0-flash, gemini-2.0-flash-lite, gemini-3-* are NOT available in europe-west3.
    #       Only gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite are available.
    VERTEX_MODELS = [
        "gemini-2.5-flash",         # GA: speed + intelligence, configurable thinking
        "gemini-2.5-flash-lite",    # GA: cheap high-volume (default)
        "gemini-2.5-pro",           # GA: highest quality (expensive, last resort)
    ]

    def __init__(self):
        logger.info("=== VertexGeminiClient INIT START ===")

        if not VERTEX_AVAILABLE:
            logger.error("❌ google-cloud-aiplatform NOT installed — pip install google-cloud-aiplatform")
            raise ImportError("google-cloud-aiplatform package required. Install: pip install google-cloud-aiplatform")
        logger.info("✅ [1/5] google-cloud-aiplatform package available")

        # Resolve project ID: env var → Cloud Run metadata
        project_id = os.getenv("GOOGLE_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT")
        _project_source = "env (GOOGLE_PROJECT_ID / GOOGLE_CLOUD_PROJECT)"
        if not project_id:
            logger.info("      GOOGLE_PROJECT_ID/GOOGLE_CLOUD_PROJECT not set — trying GCP metadata server")
            try:
                import requests as _req
                resp = _req.get(
                    "http://metadata.google.internal/computeMetadata/v1/project/project-id",
                    headers={"Metadata-Flavor": "Google"}, timeout=2
                )
                if resp.status_code == 200:
                    project_id = resp.text.strip()
                    _project_source = "GCP metadata server"
                else:
                    logger.warning(f"      metadata server returned HTTP {resp.status_code}")
            except Exception as _meta_err:
                logger.warning(f"      metadata server unreachable: {_meta_err} (not on Cloud Run?)")
        if not project_id:
            logger.error("❌ [2/5] project_id NOT found — set GOOGLE_PROJECT_ID env var")
            raise ValueError("GOOGLE_PROJECT_ID not found")
        logger.info(f"✅ [2/5] project_id={project_id!r} (source: {_project_source})")

        location = os.getenv("VERTEX_LOCATION", "europe-west3")
        logger.info(f"✅ [3/5] location={location!r} (env VERTEX_LOCATION or default europe-west3)")

        # Init Vertex AI SDK
        creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if creds_path and os.path.exists(creds_path):
            logger.info("      credentials: GOOGLE_APPLICATION_CREDENTIALS=***REDACTED*** (file exists)")
            from google.oauth2 import service_account
            credentials = service_account.Credentials.from_service_account_file(
                creds_path, scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
            vertexai.init(project=project_id, location=location, credentials=credentials)
            logger.info("✅ [4/5] vertexai.init() — service account file credentials")
        elif creds_path:
            logger.warning(f"      GOOGLE_APPLICATION_CREDENTIALS set but file not found: {creds_path!r}")
            vertexai.init(project=project_id, location=location)
            logger.info("✅ [4/5] vertexai.init() — ADC (GOOGLE_APPLICATION_CREDENTIALS missing, fallback)")
        else:
            logger.info("      GOOGLE_APPLICATION_CREDENTIALS not set — using ADC (Cloud Run SA or gcloud auth)")
            vertexai.init(project=project_id, location=location)
            logger.info("✅ [4/5] vertexai.init() — Application Default Credentials (ADC)")

        # Try models until one works
        preferred = os.getenv("GEMINI_MODEL", "")
        models_to_try = [preferred] + self.VERTEX_MODELS if preferred else self.VERTEX_MODELS
        # Remove empty strings and duplicates while preserving order
        seen: set = set()
        models_to_try = [m for m in models_to_try if m and not (m in seen or seen.add(m))]  # type: ignore[func-returns-value]
        logger.info(f"      [5/5] trying models in order: {models_to_try}")

        self.model_name = None
        self._model_cls = None
        for m in models_to_try:
            try:
                self._model_cls = VertexGenerativeModel(m)
                self.model_name = m
                logger.info(f"✅ [5/5] model selected: {m!r}")
                break
            except Exception as e:
                logger.warning(f"      ✗ model {m!r} unavailable: {type(e).__name__}: {e}")

        if not self._model_cls:
            logger.error(f"❌ [5/5] no model available (tried: {models_to_try}) — check IAM role roles/aiplatform.user")
            raise ValueError(f"No Vertex AI model available (tried: {models_to_try})")

        self.max_tokens = 4096
        self._project_id = project_id
        self._location = location
        logger.info(f"✅ VertexGeminiClient READY: model={self.model_name!r} project={project_id!r} location={location!r}")
        logger.info("=== VertexGeminiClient INIT DONE ===")

    def _create_model(self, temperature: float = 0.3):
        """Return model with generation config"""
        return self._model_cls

    def call(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3
    ) -> Dict[str, Any]:
        """Call Vertex AI Gemini — same interface as GeminiClient.call()"""
        t0 = time.monotonic()
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"

        prompt_chars = len(full_prompt)
        prompt_tokens_est = prompt_chars // 4
        logger.info(
            f"→ Vertex Gemini call: model={self.model_name!r} "
            f"prompt={prompt_chars}ch (~{prompt_tokens_est}tok) temperature={temperature}"
        )

        try:
            generation_config = {
                "temperature": temperature,
                "max_output_tokens": self.max_tokens,
            }

            response = self._model_cls.generate_content(
                full_prompt,
                generation_config=generation_config,
            )

            elapsed_ms = int((time.monotonic() - t0) * 1000)

            if not response.text:
                logger.error(f"❌ Vertex Gemini empty response ({elapsed_ms}ms) — finish_reason={getattr(response, 'prompt_feedback', 'n/a')}")
                raise ValueError("Vertex Gemini returned empty response")

            result_text = response.text.strip()
            response_chars = len(result_text)

            # Remove markdown code blocks
            code_block_match = re.search(r'```(?:json)?\s*(.*?)\s*```', result_text, re.DOTALL)
            if code_block_match:
                result_text = code_block_match.group(1).strip()
                logger.debug("      stripped markdown code block from response")

            try:
                parsed = json.loads(result_text)
                logger.info(
                    f"✅ Vertex Gemini OK: {elapsed_ms}ms, "
                    f"response={response_chars}ch (~{response_chars//4}tok), "
                    f"json keys={list(parsed.keys()) if isinstance(parsed, dict) else type(parsed).__name__}"
                )
                return parsed
            except json.JSONDecodeError as json_err:
                logger.warning(
                    f"⚠️  Vertex Gemini response is not valid JSON ({elapsed_ms}ms): {json_err} — "
                    f"returning raw_text ({response_chars}ch). Preview: {result_text[:120]!r}"
                )
                return {"raw_text": result_text}

        except Exception as e:
            elapsed_ms = int((time.monotonic() - t0) * 1000)
            logger.error(
                f"❌ Vertex Gemini call FAILED ({elapsed_ms}ms): {type(e).__name__}: {e}. "
                f"model={self.model_name!r} project={self._project_id!r} location={self._location!r}"
            )
            logger.exception("Vertex Gemini full traceback:")
            raise

    def parse_excel(self, file_path: Path, prompt_name: str = "parsing/parse_vykaz_vymer") -> Dict[str, Any]:
        """Parse Excel — delegates to call() with same logic as GeminiClient"""
        from app.core.config import settings
        df = pd.read_excel(file_path, sheet_name=0)
        excel_text = df.to_string(index=False, max_rows=1000)
        sample_text = df.head(20).to_string(index=False)

        prompts_dir = settings.PROMPTS_DIR / "claude"
        prompt_path = prompts_dir / f"{prompt_name}.txt"
        parsing_prompt = prompt_path.read_text(encoding='utf-8') if prompt_path.exists() else "Parse this Excel file and return positions as JSON."

        full_prompt = f"{parsing_prompt}\n\n===== UKÁZKA PRVNÍCH 20 ŘÁDKŮ =====\n{sample_text}\n\n===== CELÝ DOKUMENT =====\n{excel_text}"
        return self.call(full_prompt)

    def parse_xml(self, file_path: Path, prompt_name: str = None) -> Dict[str, Any]:
        """Parse XML — delegates to call()"""
        from app.core.config import settings
        with open(file_path, 'r', encoding='utf-8') as f:
            xml_content = f.read()

        if prompt_name is None:
            if '<unixml' in xml_content.lower():
                prompt_name = "parsing/parse_kros_unixml"
            elif '<TZ>' in xml_content or '<Row>' in xml_content:
                prompt_name = "parsing/parse_kros_table_xml"
            else:
                prompt_name = "parsing/parse_vykaz_vymer"

        prompts_dir = settings.PROMPTS_DIR / "claude"
        prompt_path = prompts_dir / f"{prompt_name}.txt"
        parsing_prompt = prompt_path.read_text(encoding='utf-8') if prompt_path.exists() else "Parse this XML file and return positions as JSON."

        max_chars = 100000
        if len(xml_content) > max_chars:
            xml_content = xml_content[:max_chars] + "\n\n[... XML ZKRÁCENO ...]"

        full_prompt = f"{parsing_prompt}\n\n===== XML DOKUMENT =====\n{xml_content}"
        return self.call(full_prompt)

    def parse_pdf(self, file_path: Path, prompt_name: str = "parsing/parse_vykaz_vymer") -> Dict[str, Any]:
        """Parse PDF via Vertex AI Gemini"""
        from app.core.config import settings
        from vertexai.generative_models import Part

        prompts_dir = settings.PROMPTS_DIR / "claude"
        prompt_path = prompts_dir / f"{prompt_name}.txt"
        parsing_prompt = prompt_path.read_text(encoding='utf-8') if prompt_path.exists() else "Parse this PDF file and return positions as JSON."

        with open(file_path, 'rb') as f:
            pdf_bytes = f.read()
        pdf_part = Part.from_data(data=pdf_bytes, mime_type="application/pdf")

        response = self._model_cls.generate_content(
            [pdf_part, parsing_prompt],
            generation_config={"temperature": 0.3, "max_output_tokens": self.max_tokens},
        )

        result_text = response.text.strip()
        result_text = result_text.replace("```json\n", "").replace("```json", "").replace("```\n", "").replace("```", "").strip()

        try:
            return json.loads(result_text)
        except json.JSONDecodeError:
            return {"raw_text": result_text}

    def audit_position(self, position: Dict[str, Any], knowledge_base: Dict[str, Any], prompt_name: str = "audit/audit_position") -> Dict[str, Any]:
        """Audit position — same as GeminiClient"""
        from app.core.config import settings
        prompts_dir = settings.PROMPTS_DIR / "claude"
        prompt_path = prompts_dir / f"{prompt_name}.txt"
        audit_prompt = prompt_path.read_text(encoding='utf-8') if prompt_path.exists() else "Audit this position and return assessment as JSON."

        full_prompt = f"""{audit_prompt}\n\n===== POZICE K AUDITU =====\n{json.dumps(position, indent=2, ensure_ascii=False)}\n\n===== KNOWLEDGE BASE =====\n{json.dumps(knowledge_base, indent=2, ensure_ascii=False)}"""
        return self.call(full_prompt)
