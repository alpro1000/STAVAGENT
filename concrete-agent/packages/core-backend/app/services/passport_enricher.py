"""
Passport Enricher - Layer 3

Uses Claude/Gemini to enrich the passport with context, risks, and relationships.

CRITICAL RULES:
1. NEVER overwrite Layer 2 facts (confidence=1.0)
2. ONLY add enrichments (confidence=0.5-0.9)
3. If unsure → null, NEVER guess
4. All enrichments MUST have confidence scores

Enriches:
- Project description and summary
- Risks based on document context
- Location details (address, city, cadastral)
- Timeline and phases
- Stakeholders (investor, contractor, designer)
- Technical highlights
- Relationships between elements

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-02-10
"""

import json
import logging
from typing import Dict, Any, List, Optional
from anthropic import Anthropic
import google.generativeai as genai
from openai import OpenAI
import httpx

from app.core.config import settings
from app.models.passport_schema import (
    ProjectPassport,
    ProjectLocation,
    ProjectTimeline,
    RiskAssessment,
    ProjectStakeholder,
    StructureType
)

logger = logging.getLogger(__name__)


class PassportEnricher:
    """
    Enriches project passport using LLM.

    Supports multiple AI models with intelligent fallback:

    | Model | Provider | Cost | Speed | Quality | Use Case |
    |-------|----------|------|-------|---------|----------|
    | Gemini 2.0 Flash | Google | FREE* | Fast (3s) | Good | Default, cost-sensitive |
    | Claude Haiku | Anthropic | $0.25/MTok | Very Fast (2s) | Good | Speed-critical |
    | GPT-4o Mini | OpenAI | $0.15/MTok | Fast (3s) | Good | Alternative to Gemini |
    | Claude Sonnet | Anthropic | $3/MTok | Medium (4s) | Excellent | High-quality enrichment |
    | GPT-4 Turbo | OpenAI | $10/MTok | Slow (6s) | Excellent | Complex analysis |
    | Perplexity | Perplexity | $1/MTok | Medium (4s) | Good+Web | Real-time data needed |

    *FREE: 1500 requests/day, then $0.075/MTok

    Typical passport enrichment:
    - Input: ~2K tokens (document summary)
    - Output: ~500 tokens (enrichments)
    - Total: ~2.5K tokens = $0.0075 (Claude Sonnet) or FREE (Gemini)
    """

    # =============================================================================
    # PROMPTS
    # =============================================================================

    ENRICHMENT_PROMPT = """Máš strukturovaná data z české Technické zprávy pro stavební projekt.

EXTRAHOVANÁ FAKTA (100% jistota - NEPŘEPISUJ):
{extracted_facts}

PLNÝ TEXT DOKUMENTU:
{document_text}

ÚKOL: Doplň POUZE chybějící informace pro následující kategorie.

PRAVIDLA:
1. Fakta z EXTRAHOVANÁ FAKTA jsou SPRÁVNÁ — nepřepisuj je ani neměň
2. Doplň pouze: popis projektu, lokaci, časový plán, účastníky, rizika, technické zajímavosti
3. Pokud informace v textu není → vrať null, NEVYMÝŠLEJ
4. U každého doplnění uveď confidence (0.5-0.9, nikdy 1.0 protože jsou z LLM)
5. Vrať POUZE JSON, žádný další text

VRAŤ JSON:
{{
  "enrichments": {{
    "description": "Stručný popis projektu (2-3 věty) nebo null",
    "structure_type": "building|bridge|tunnel|foundation|retaining_wall|slab|other nebo null",

    "location": {{
      "address": "Ulice a číslo popisné nebo null",
      "city": "Město nebo null",
      "postal_code": "PSČ nebo null",
      "cadastral_area": "Katastrální území nebo null",
      "parcel_numbers": ["č. parcely"] nebo null
    }},

    "timeline": {{
      "start_date": "YYYY-MM nebo null",
      "completion_date": "YYYY-MM nebo null",
      "duration_months": číslo nebo null,
      "phases": [
        {{"name": "název fáze", "duration_months": číslo}}
      ] nebo []
    }},

    "stakeholders": [
      {{
        "role": "Investor|Dodavatel|Projektant|...",
        "name": "Název firmy/osoby nebo null",
        "contact": "Kontakt nebo null"
      }}
    ],

    "risks": [
      {{
        "risk_category": "technical|environmental|schedule|cost",
        "risk_description": "Popis rizika",
        "severity": "high|medium|low",
        "mitigation": "Opatření nebo null",
        "source_text": "Text, který vedl k identifikaci rizika"
      }}
    ],

    "technical_highlights": [
      "Technicky zajímavý aspekt 1",
      "Technicky zajímavý aspekt 2"
    ]
  }},

  "confidence_scores": {{
    "description": 0.8,
    "structure_type": 0.9,
    "location": 0.7,
    "timeline": 0.5,
    "stakeholders": 0.7,
    "risks": 0.6,
    "technical_highlights": 0.7
  }}
}}

PŘÍKLADY RIZIK:
- "Vysoké třídy prostředí XC4 XF4 XD2 vyžadují kvalitní beton a péči" (technical, medium)
- "Vodotěsná konstrukce (bílá vana) - riziko netěsností při špatné realizaci" (technical, high)
- "Hloubení základů v hustě zastavěné oblasti - riziko vlivu na okolní budovy" (environmental, medium)
- "Velký objem betonu (1500 m³) - nutná koordinace dodávek" (schedule, medium)

VRAŤ POUZE JSON, žádný další text před ani za."""

    # Model configurations
    GEMINI_MODEL = "gemini-2.0-flash"  # Note: gemini-2.0-flash-exp is deprecated, use stable version
    CLAUDE_MODEL = "claude-3-5-sonnet-20241022"
    CLAUDE_HAIKU_MODEL = "claude-3-5-haiku-20241022"
    OPENAI_MODEL = "gpt-4-turbo-preview"
    OPENAI_MINI_MODEL = "gpt-4o-mini"
    PERPLEXITY_MODEL = "llama-3.1-sonar-large-128k-online"

    def __init__(self, preferred_model: Optional[str] = None):
        """
        Initialize enricher with LLM clients.

        Args:
            preferred_model: Preferred model to use. Options:
                - "gemini" (default, FREE)
                - "claude-sonnet" (most capable, expensive)
                - "claude-haiku" (fast, cheap)
                - "openai" (GPT-4 Turbo)
                - "openai-mini" (GPT-4o Mini, cheap)
                - "perplexity" (with web search)
                - "auto" (fallback chain)
        """
        self.preferred_model = preferred_model or settings.MULTI_ROLE_LLM or "gemini"

        # Initialize all available clients
        self.gemini_model = None
        self.claude_client = None
        self.openai_client = None
        self.perplexity_available = False

        # Gemini (FREE)
        if settings.GOOGLE_API_KEY:
            try:
                genai.configure(api_key=settings.GOOGLE_API_KEY)
                # Try primary model, fallback to stable versions if not available
                for model_to_try in [self.GEMINI_MODEL, "gemini-1.5-flash", "gemini-1.5-pro"]:
                    try:
                        self.gemini_model = genai.GenerativeModel(model_to_try)
                        logger.info(f"✅ Gemini initialized: {model_to_try}")
                        break
                    except Exception as model_error:
                        logger.debug(f"Model {model_to_try} not available: {model_error}")
                        continue
                
                if not self.gemini_model:
                    logger.warning("No Gemini model available (tried 2.0-flash, 1.5-flash, 1.5-pro)")
            except Exception as e:
                logger.warning(f"Failed to initialize Gemini: {e}")

        # Claude (Anthropic)
        if settings.ANTHROPIC_API_KEY:
            try:
                self.claude_client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
                logger.info(f"✅ Claude initialized: {self.CLAUDE_MODEL}")
            except Exception as e:
                logger.warning(f"Failed to initialize Claude: {e}")

        # OpenAI
        if hasattr(settings, 'OPENAI_API_KEY') and settings.OPENAI_API_KEY:
            try:
                # OpenAI SDK v1.3+ uses http_client for proxy configuration
                # NOT the deprecated 'proxies' parameter
                init_kwargs = {"api_key": settings.OPENAI_API_KEY}
                
                # Support HTTP/HTTPS proxy if configured
                http_proxy = getattr(settings, 'HTTP_PROXY', None) or getattr(settings, 'HTTPS_PROXY', None)
                if http_proxy:
                    try:
                        import httpx
                        http_client = httpx.Client(proxies=http_proxy)
                        init_kwargs["http_client"] = http_client
                        logger.info(f"🔗 OpenAI configured with proxy: {http_proxy}")
                    except ImportError:
                        logger.warning("httpx not available for proxy support")
                
                self.openai_client = OpenAI(**init_kwargs)
                logger.info(f"✅ OpenAI initialized: {self.OPENAI_MODEL}")
            except TypeError as e:
                if "proxies" in str(e):
                    logger.error("❌ OpenAI SDK version mismatch: 'proxies' parameter is deprecated. Use http_client instead or upgrade to OpenAI SDK >= 1.3")
                else:
                    logger.warning(f"Failed to initialize OpenAI: {e}")
            except Exception as e:
                logger.warning(f"Failed to initialize OpenAI: {e}")

        # Perplexity
        if hasattr(settings, 'PERPLEXITY_API_KEY') and settings.PERPLEXITY_API_KEY:
            self.perplexity_available = True
            logger.info(f"✅ Perplexity initialized: {self.PERPLEXITY_MODEL}")

        # Log available models
        available = []
        if self.gemini_model: available.append("Gemini")
        if self.claude_client: available.append("Claude")
        if self.openai_client: available.append("OpenAI")
        if self.perplexity_available: available.append("Perplexity")

        logger.info(f"Available LLM providers: {', '.join(available) if available else 'None'}")

    # =============================================================================
    # MAIN ENRICHMENT METHOD
    # =============================================================================

    async def enrich_passport(
        self,
        passport: ProjectPassport,
        document_text: str,
        enable_ai: bool = True
    ) -> ProjectPassport:
        """
        Enrich passport with AI-extracted context.

        Args:
            passport: Passport with Layer 2 facts already populated
            document_text: Full document text for context
            enable_ai: If False, skip AI enrichment

        Returns:
            Enriched passport
        """
        if not enable_ai:
            logger.info("AI enrichment disabled, returning passport as-is")
            return passport

        logger.info("Starting AI enrichment (Layer 3)")

        # Check if enrichment is needed
        if not self._needs_enrichment(passport):
            logger.info("Passport already well-populated, skipping enrichment")
            return passport

        # Prepare facts summary for LLM
        facts_summary = self._prepare_facts_summary(passport)

        # Truncate document text if too long (keep first 10k chars)
        truncated_text = document_text[:10000] if len(document_text) > 10000 else document_text

        # Build prompt
        prompt = self.ENRICHMENT_PROMPT.format(
            extracted_facts=facts_summary,
            document_text=truncated_text
        )

        # Call LLM with fallback
        enrichments = await self._call_llm(prompt)

        if not enrichments:
            logger.warning("LLM returned no enrichments")
            return passport

        # Merge enrichments into passport
        enriched_passport = self._merge_enrichments(passport, enrichments)

        logger.info("AI enrichment complete")
        return enriched_passport

    # =============================================================================
    # LLM CALLING
    # =============================================================================

    async def _call_llm(self, prompt: str) -> Optional[Dict[str, Any]]:
        """
        Call LLM with intelligent fallback chain based on preferred model.

        Fallback order:
        - Preferred model → Gemini → Claude → OpenAI → Perplexity

        Returns parsed JSON or None if all failed
        """
        # Determine call order based on preference
        call_order = self._get_call_order()

        for provider_name in call_order:
            try:
                logger.info(f"Calling {provider_name} for enrichment")
                result = None

                if provider_name == "Gemini" and self.gemini_model:
                    result = await self._call_gemini(prompt)
                elif provider_name == "Claude Sonnet" and self.claude_client:
                    result = await self._call_claude(prompt, self.CLAUDE_MODEL)
                elif provider_name == "Claude Haiku" and self.claude_client:
                    result = await self._call_claude(prompt, self.CLAUDE_HAIKU_MODEL)
                elif provider_name == "OpenAI" and self.openai_client:
                    result = await self._call_openai(prompt, self.OPENAI_MODEL)
                elif provider_name == "OpenAI Mini" and self.openai_client:
                    result = await self._call_openai(prompt, self.OPENAI_MINI_MODEL)
                elif provider_name == "Perplexity" and self.perplexity_available:
                    result = await self._call_perplexity(prompt)

                if result:
                    logger.info(f"✅ {provider_name} enrichment successful")
                    return result

            except Exception as e:
                logger.warning(f"{provider_name} enrichment failed: {e}")
                continue

        logger.error("All LLM providers failed")
        return None

    def _get_call_order(self) -> List[str]:
        """Get LLM call order based on preferred model"""
        # Map preference to call order
        orders = {
            "gemini": ["Gemini", "Claude Haiku", "OpenAI Mini", "Claude Sonnet", "OpenAI"],
            "claude-sonnet": ["Claude Sonnet", "Gemini", "OpenAI", "Claude Haiku"],
            "claude-haiku": ["Claude Haiku", "Gemini", "OpenAI Mini", "Claude Sonnet"],
            "openai": ["OpenAI", "Gemini", "Claude Sonnet", "Claude Haiku"],
            "openai-mini": ["OpenAI Mini", "Gemini", "Claude Haiku", "OpenAI"],
            "perplexity": ["Perplexity", "Gemini", "Claude Sonnet", "OpenAI"],
            "auto": ["Gemini", "Claude Haiku", "OpenAI Mini", "Claude Sonnet", "OpenAI", "Perplexity"]
        }

        return orders.get(self.preferred_model, orders["gemini"])

    async def _call_gemini(self, prompt: str) -> Optional[Dict[str, Any]]:
        """Call Gemini API"""
        response = self.gemini_model.generate_content(
            prompt,
            generation_config={
                'temperature': 0.3,
                'max_output_tokens': 2048,
            }
        )

        if response and response.text:
            return self._parse_json_response(response.text)
        return None

    async def _call_claude(self, prompt: str, model: str) -> Optional[Dict[str, Any]]:
        """Call Claude API"""
        response = self.claude_client.messages.create(
            model=model,
            max_tokens=2048,
            temperature=0.3,
            messages=[{"role": "user", "content": prompt}]
        )

        if response and response.content:
            return self._parse_json_response(response.content[0].text)
        return None

    async def _call_openai(self, prompt: str, model: str) -> Optional[Dict[str, Any]]:
        """Call OpenAI API"""
        response = self.openai_client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=2048,
            response_format={"type": "json_object"}
        )

        if response and response.choices:
            text = response.choices[0].message.content
            return self._parse_json_response(text)
        return None

    async def _call_perplexity(self, prompt: str) -> Optional[Dict[str, Any]]:
        """Call Perplexity API (with web search capabilities)"""
        perplexity_key = getattr(settings, 'PERPLEXITY_API_KEY', None)
        if not perplexity_key:
            return None

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {perplexity_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.PERPLEXITY_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "max_tokens": 2048
                }
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("choices"):
                    text = data["choices"][0]["message"]["content"]
                    return self._parse_json_response(text)

        return None

    def _parse_json_response(self, text: str) -> Optional[Dict[str, Any]]:
        """Parse JSON from LLM response, handling markdown code blocks"""
        try:
            # Remove markdown code blocks if present
            text = text.strip()
            if text.startswith('```'):
                # Find first { and last }
                start = text.find('{')
                end = text.rfind('}')
                if start != -1 and end != -1:
                    text = text[start:end+1]

            return json.loads(text)

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            logger.debug(f"Response text: {text[:500]}")
            return None

    # =============================================================================
    # FACTS PREPARATION
    # =============================================================================

    def _prepare_facts_summary(self, passport: ProjectPassport) -> str:
        """Prepare summary of extracted facts for LLM"""
        lines = []

        # Concrete specs
        if passport.concrete_specifications:
            lines.append("BETON:")
            for spec in passport.concrete_specifications:
                exp_classes = ", ".join([e.value for e in spec.exposure_classes])
                lines.append(f"  - {spec.concrete_class} (třídy: {exp_classes})")

        # Reinforcement
        if passport.reinforcement:
            lines.append("\nVÝZTUŽ:")
            for steel in passport.reinforcement:
                mass_str = f", celkem {steel.total_mass_tons}t" if steel.total_mass_tons else ""
                lines.append(f"  - {steel.steel_grade.value}{mass_str}")

        # Quantities
        if passport.quantities:
            lines.append("\nOBJEMY:")
            for qty in passport.quantities[:10]:  # Top 10
                if qty.volume_m3:
                    lines.append(f"  - {qty.element_type}: {qty.volume_m3} m³")
                elif qty.area_m2:
                    lines.append(f"  - {qty.element_type}: {qty.area_m2} m²")
                elif qty.mass_tons:
                    lines.append(f"  - {qty.element_type}: {qty.mass_tons} t")

        # Dimensions
        if passport.dimensions:
            lines.append("\nROZMĚRY:")
            dim = passport.dimensions
            if dim.floors_underground:
                lines.append(f"  - Podzemní podlaží: {dim.floors_underground}")
            if dim.floors_above_ground:
                lines.append(f"  - Nadzemní podlaží: {dim.floors_above_ground}")
            if dim.height_m:
                lines.append(f"  - Výška: {dim.height_m} m")
            if dim.built_up_area_m2:
                lines.append(f"  - Zastavěná plocha: {dim.built_up_area_m2} m²")

        # Special requirements
        if passport.special_requirements:
            lines.append("\nSPECIÁLNÍ POŽADAVKY:")
            for req in passport.special_requirements:
                lines.append(f"  - {req.requirement_type}: {req.description}")

        return "\n".join(lines) if lines else "Žádná fakta nebyla extrahována"

    # =============================================================================
    # ENRICHMENT MERGING
    # =============================================================================

    def _merge_enrichments(
        self,
        passport: ProjectPassport,
        enrichments: Dict[str, Any]
    ) -> ProjectPassport:
        """Merge AI enrichments into passport"""

        enrich_data = enrichments.get('enrichments', {})
        confidence_scores = enrichments.get('confidence_scores', {})

        # Description
        if enrich_data.get('description'):
            passport.description = enrich_data['description']

        # Structure type
        if enrich_data.get('structure_type'):
            try:
                passport.structure_type = StructureType(enrich_data['structure_type'])
            except ValueError:
                logger.warning(f"Invalid structure_type: {enrich_data['structure_type']}")

        # Location
        if enrich_data.get('location'):
            loc_data = enrich_data['location']
            if any(loc_data.values()):  # At least one field populated
                passport.location = ProjectLocation(
                    address=loc_data.get('address'),
                    city=loc_data.get('city'),
                    postal_code=loc_data.get('postal_code'),
                    cadastral_area=loc_data.get('cadastral_area'),
                    parcel_numbers=loc_data.get('parcel_numbers'),
                    confidence=confidence_scores.get('location', 0.7)
                )

        # Timeline
        if enrich_data.get('timeline'):
            timeline_data = enrich_data['timeline']
            if any(timeline_data.values()):
                passport.timeline = ProjectTimeline(
                    start_date=timeline_data.get('start_date'),
                    completion_date=timeline_data.get('completion_date'),
                    duration_months=timeline_data.get('duration_months'),
                    phases=timeline_data.get('phases', []),
                    confidence=confidence_scores.get('timeline', 0.6)
                )

        # Stakeholders
        if enrich_data.get('stakeholders'):
            passport.stakeholders = [
                ProjectStakeholder(
                    role=s['role'],
                    name=s.get('name'),
                    contact=s.get('contact'),
                    confidence=confidence_scores.get('stakeholders', 0.7)
                )
                for s in enrich_data['stakeholders']
            ]

        # Risks
        if enrich_data.get('risks'):
            passport.risks = [
                RiskAssessment(
                    risk_category=r['risk_category'],
                    risk_description=r['risk_description'],
                    severity=r['severity'],
                    mitigation=r.get('mitigation'),
                    source_text=r['source_text'],
                    confidence=confidence_scores.get('risks', 0.6)
                )
                for r in enrich_data['risks']
            ]

        # Technical highlights
        if enrich_data.get('technical_highlights'):
            passport.technical_highlights = enrich_data['technical_highlights']

        return passport

    # =============================================================================
    # HELPER METHODS
    # =============================================================================

    def _needs_enrichment(self, passport: ProjectPassport) -> bool:
        """
        Check if passport needs AI enrichment.

        Returns True if many fields are null/empty.
        """
        null_count = 0

        if not passport.description:
            null_count += 1
        if not passport.structure_type:
            null_count += 1
        if not passport.location:
            null_count += 1
        if not passport.timeline:
            null_count += 1
        if not passport.stakeholders:
            null_count += 1
        if not passport.risks:
            null_count += 1

        # If more than 3 key fields are missing, enrichment is needed
        return null_count > 3


# =============================================================================
# CONVENIENCE FUNCTION
# =============================================================================

async def enrich_passport(
    passport: ProjectPassport,
    document_text: str,
    enable_ai: bool = True
) -> ProjectPassport:
    """
    Convenience function to enrich a passport.

    Usage:
        enriched = await enrich_passport(passport, full_text)
    """
    enricher = PassportEnricher()
    return await enricher.enrich_passport(passport, document_text, enable_ai)
