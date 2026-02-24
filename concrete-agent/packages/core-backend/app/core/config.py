"""
Configuration for Czech Building Audit System
WITH Perplexity API support for live KB
"""
from pathlib import Path
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class MultiRoleConfig(BaseSettings):
    """Multi-Role Expert System Configuration"""
    enabled: bool = True
    green_roles: list[str] = ["SME", "ARCH_LIGHT", "ENG_LIGHT", "SUP_LIGHT"]
    amber_roles: list[str] = ["SME", "ARCH", "ENG", "SUP_LIGHT"]
    red_roles: list[str] = ["SME", "ARCH", "ENG", "SUP"]
    hitl_on_red: bool = True
    hitl_price_threshold: float = 0.15
    hitl_on_conflict_levels: list[int] = [1, 2]
    require_agreement_roles: list[str] = ["ENG", "SME"]
    consensus_max_iterations: int = 3
    model_config = SettingsConfigDict(env_prefix="MULTI_ROLE_")


class Settings(BaseSettings):
    """Main application settings"""

    @property
    def BASE_DIR(self) -> Path:
        """Base directory of the project"""
        return Path(__file__).resolve().parent.parent.parent

    # ==========================================
    # PROJECT PATHS
    # ==========================================
    DATA_DIR: Optional[Path] = None
    PROJECT_DIR: Optional[Path] = None
    KB_DIR: Optional[Path] = None
    PROMPTS_DIR: Optional[Path] = None
    LOGS_DIR: Optional[Path] = None
    WEB_DIR: Optional[Path] = None
    
    # ==========================================
    # API KEYS
    # ==========================================
    ANTHROPIC_API_KEY: str = Field(default="", description="Anthropic Claude API key")
    GOOGLE_API_KEY: str = Field(default="", description="Google AI API key (Gemini)")
    OPENAI_API_KEY: str = Field(default="", description="OpenAI API key (optional)")
    PERPLEXITY_API_KEY: str = Field(default="", description="Perplexity API key for live KB")
    NANONETS_API_KEY: str = Field(default="", description="Nanonets API key for document processing")
    
    # ==========================================
    # AI MODELS
    # ==========================================
    CLAUDE_MODEL: str = Field(default="claude-sonnet-4-6", description="Claude model (Sonnet 4.6 - latest Feb 2026)")
    GEMINI_MODEL: str = Field(default="gemini-2.0-flash", description="Gemini model (2.0 Flash GA - stable, fast, cheap)")
    GPT4_MODEL: str = Field(default="gpt-4o", description="GPT-4 model (gpt-4o includes vision, gpt-4-vision-preview deprecated)")
    CLAUDE_MAX_TOKENS: int = Field(default=4000, description="Max tokens for Claude")
    GPT4_MAX_TOKENS: int = Field(default=4000, description="Max tokens for GPT-4")

    # Multi-Role LLM selection: "claude", "gemini", "auto" (Gemini with Claude fallback)
    MULTI_ROLE_LLM: str = Field(default="gemini", description="LLM for Multi-Role: claude, gemini, auto")
    
    # ==========================================
    # WORKFLOW FEATURE FLAGS
    # ==========================================
    ENABLE_WORKFLOW_A: bool = Field(default=True, description="Enable Workflow A")
    ENABLE_WORKFLOW_B: bool = Field(default=False, description="Enable Workflow B")
    USE_MINERU: bool = Field(default=True, description="Use MinerU for PDF parsing (FREE, no API costs)")
    USE_CLAUDE_VISION: bool = Field(default=True, description="Use Claude Vision instead of GPT-4 Vision (3-5x cheaper)")
    ENABLE_KROS_MATCHING: bool = Field(default=True, description="Enable KROS matching")
    ENABLE_RTS_MATCHING: bool = Field(default=True, description="Enable RTS matching")
    ENABLE_RESOURCE_CALCULATION: bool = Field(default=True, description="Enable TOV calculation")
    
    # ==========================================
    # LIVE KNOWLEDGE BASE (Perplexity)
    # ==========================================
    ALLOW_WEB_SEARCH: bool = Field(
        default=True,
        description="Allow Perplexity API for live KB search"
    )
    USE_PERPLEXITY_PRIMARY: bool = Field(
        default=False,
        description="Use Perplexity as primary KB (vs fallback)"
    )
    PERPLEXITY_CACHE_TTL: int = Field(
        default=86400,
        description="Cache TTL for Perplexity results (seconds, default 24h)"
    )
    PERPLEXITY_SEARCH_DOMAINS: list[str] = Field(
        default=["podminky.urs.cz", "urs.cz", "cenovamapa.cz"],
        description="Allowed domains for Perplexity search"
    )
    USE_OFFICIAL_NORMS: bool = Field(
        default=True,
        description="Prioritize official Czech norms"
    )
    
    # ==========================================
    # AUDIT CONFIGURATION
    # ==========================================
    ENRICHMENT_ENABLED: bool = Field(
        default=True,
        description="Enable lightweight enrichment layer",
    )
    AUDIT_GREEN_THRESHOLD: float = Field(default=0.95, description="GREEN threshold")
    AUDIT_AMBER_THRESHOLD: float = Field(default=0.75, description="AMBER threshold")
    ENRICH_SCORE_EXACT: float = Field(default=0.9, description="Exact enrichment match threshold")
    ENRICH_SCORE_PARTIAL: float = Field(default=0.6, description="Partial enrichment match threshold")
    ENRICH_MAX_EVIDENCE: int = Field(default=3, description="Maximum evidence items per position")
    
    # ==========================================
    # PRICE MANAGEMENT
    # ==========================================
    AUTO_UPDATE_PRICES: bool = Field(default=False, description="Auto-update prices")
    
    # ==========================================
    # PARSING CONFIGURATION
    # ==========================================
    PRIMARY_PARSER: str = Field(
        default="claude",
        description="Primary parser: 'mineru', 'nanonets', 'claude'"
    )
    FALLBACK_ENABLED: bool = Field(
        default=True,
        description="Enable fallback to other parsers if primary fails"
    )
    MAX_FILE_SIZE_MB: int = Field(
        default=50,
        description="Maximum file size for upload in MB"
    )
    PARSER_H_ENABLE: bool = Field(
        default=True,
        description="Enable Task H normalisation pipeline",
    )

    # PDF text recovery configuration (Task F2)
    PDF_VALID_CHAR_RATIO: float = Field(
        default=0.60,
        description="Minimum ratio of valid characters for primary text to be accepted",
    )
    PDF_FALLBACK_VALID_RATIO: float = Field(
        default=0.70,
        description="Minimum ratio of valid characters for fallback extractor acceptance",
    )
    PDF_PUA_RATIO: float = Field(
        default=0.50,
        description="Ratio of Private Use Area glyphs that marks a page as encoded",
    )
    PDF_MAX_PAGES_FOR_FALLBACK: int = Field(
        default=15,
        description="Maximum number of pages to process with fallback extractors",
    )
    PDF_MAX_PAGES_FOR_OCR: int = Field(
        default=5,
        description="Maximum number of pages to queue for OCR fallback",
    )
    PDF_PAGE_TIMEOUT_SEC: int = Field(
        default=2,
        description="Per-page timeout for fallback extraction subprocesses",
    )
    PDF_ENABLE_POPPLER: bool = Field(
        default=True,
        description="Enable Poppler/pdftotext fallback extraction",
    )
    PDF_ENABLE_OCR: bool = Field(
        default=True,
        description="Enable OCR queuing for pages without usable text",
    )
    PDF_OCR_PAGE_TIMEOUT_SEC: float = Field(
        default=3.0,
        description="Maximum time allowed for OCR on a single page",
    )
    PDF_OCR_TOTAL_TIMEOUT_SEC: float = Field(
        default=20.0,
        description="Maximum cumulative OCR time budget per document",
    )
    
    # MinerU Settings
    MINERU_OUTPUT_DIR: Optional[Path] = None
    MINERU_OCR_ENGINE: str = Field(
        default="paddle",
        description="OCR engine for MinerU: 'paddle', 'tesseract'"
    )
    
    # ==========================================
    # RATE LIMITING
    # ==========================================
    CLAUDE_TOKENS_PER_MINUTE: int = Field(
        default=25000,
        description="Claude token limit per minute (safe margin from 30k)"
    )
    GPT4_TOKENS_PER_MINUTE: int = Field(
        default=8000,
        description="GPT-4 token limit per minute (safe margin from 10k)"
    )
    NANONETS_CALLS_PER_MINUTE: int = Field(
        default=80,
        description="Nanonets API calls per minute (safe margin from 100)"
    )
    PRICE_UPDATE_INTERVAL_DAYS: int = Field(default=90, description="Update interval")
    
    # ==========================================
    # LOGGING
    # ==========================================
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")
    LOG_CLAUDE_CALLS: bool = Field(default=True, description="Log Claude calls")
    LOG_GPT4_CALLS: bool = Field(default=True, description="Log GPT-4 calls")
    LOG_PERPLEXITY_CALLS: bool = Field(default=True, description="Log Perplexity calls")
    
    # ==========================================
    # DATABASE & CACHE - Phase 4
    # ==========================================
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost/concrete_agent_dev",
        description="PostgreSQL database URL (async)"
    )
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis URL for caching and sessions"
    )
    SESSION_TTL: int = Field(
        default=3600,
        description="Session TTL in seconds (default 1 hour)"
    )
    CACHE_TTL: int = Field(
        default=300,
        description="Default cache TTL in seconds (default 5 minutes)"
    )

    # ==========================================
    # CELERY - Phase 4 (Background Tasks)
    # ==========================================
    CELERY_BROKER_URL: str = Field(
        default="redis://localhost:6379/1",
        description="Celery broker URL (Redis database 1)"
    )
    CELERY_RESULT_BACKEND: str = Field(
        default="redis://localhost:6379/1",
        description="Celery result backend URL"
    )
    CELERY_TASK_TRACK_STARTED: bool = Field(
        default=True,
        description="Track when tasks are started"
    )
    CELERY_TASK_TIME_LIMIT: int = Field(
        default=1800,
        description="Hard time limit for tasks (30 minutes)"
    )
    CELERY_TASK_SOFT_TIME_LIMIT: int = Field(
        default=1500,
        description="Soft time limit for tasks (25 minutes)"
    )
    CELERY_ACCEPT_CONTENT: list[str] = Field(
        default=["json"],
        description="Accepted content types for Celery"
    )
    CELERY_TASK_SERIALIZER: str = Field(
        default="json",
        description="Task serialization format"
    )
    CELERY_RESULT_SERIALIZER: str = Field(
        default="json",
        description="Result serialization format"
    )

    # ==========================================
    # ENVIRONMENT
    # ==========================================
    ENVIRONMENT: str = Field(default="development", description="Environment")
    
    # ==========================================
    # MULTI-ROLE CONFIGURATION
    # ==========================================
    multi_role: MultiRoleConfig = Field(default_factory=MultiRoleConfig)
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    def __init__(self, **kwargs):
        """Initialize settings with proper path defaults"""
        super().__init__(**kwargs)

        base = self.BASE_DIR

        if self.DATA_DIR is None:
            self.DATA_DIR = base / "data"
        if self.PROJECT_DIR is None:
            self.PROJECT_DIR = self.DATA_DIR / "projects"
        if self.KB_DIR is None:
            self.KB_DIR = base / "app" / "knowledge_base"
        if self.PROMPTS_DIR is None:
            self.PROMPTS_DIR = base / "app" / "prompts"
        if self.LOGS_DIR is None:
            self.LOGS_DIR = base / "logs"
        if self.WEB_DIR is None:
            self.WEB_DIR = base / "web"
        if self.MINERU_OUTPUT_DIR is None:
            self.MINERU_OUTPUT_DIR = base / "temp" / "mineru"
        
        try:
            self.DATA_DIR.mkdir(parents=True, exist_ok=True)
            self.PROJECT_DIR.mkdir(parents=True, exist_ok=True)

            self.LOGS_DIR.mkdir(parents=True, exist_ok=True)
            (self.LOGS_DIR / "claude_calls").mkdir(exist_ok=True)
            (self.LOGS_DIR / "gpt4_calls").mkdir(exist_ok=True)
            (self.LOGS_DIR / "perplexity_calls").mkdir(exist_ok=True)
        except Exception as e:
            import warnings
            warnings.warn(f"Could not create directories: {e}")
    
    @property
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.ENVIRONMENT.lower() == "production"
    
    @property
    def is_development(self) -> bool:
        """Check if running in development"""
        return self.ENVIRONMENT.lower() == "development"
    
    @property
    def has_perplexity(self) -> bool:
        """Check if Perplexity is configured"""
        return bool(self.PERPLEXITY_API_KEY) and self.ALLOW_WEB_SEARCH


settings = Settings()


class ArtifactPaths:
    """Utility helpers for addressing project artifact storage."""

    @staticmethod
    def _project_dir(project_id: str) -> Path:
        return settings.PROJECT_DIR / project_id

    @staticmethod
    def artifacts_dir(project_id: str) -> Path:
        """Return path to the artifact directory for *project_id*."""
        return ArtifactPaths._project_dir(project_id) / "artifacts"

    @staticmethod
    def raw_dir(project_id: str) -> Path:
        """Return path to the raw uploads directory for *project_id*."""
        return ArtifactPaths._project_dir(project_id) / "raw"

    @staticmethod
    def project_json(project_id: str) -> Path:
        """Return path to project metadata file."""
        return ArtifactPaths._project_dir(project_id) / "project.json"

    @staticmethod
    def project_info(project_id: str) -> Path:
        return ArtifactPaths.artifacts_dir(project_id) / "project_info.json"

    @staticmethod
    def parsed_positions(project_id: str) -> Path:
        return ArtifactPaths.artifacts_dir(project_id) / "parsed_positions.json"

    @staticmethod
    def audit_results(project_id: str) -> Path:
        return ArtifactPaths.artifacts_dir(project_id) / "audit_results.json"

    @staticmethod
    def drawing_specs(project_id: str) -> Path:
        return ArtifactPaths.artifacts_dir(project_id) / "drawing_specs.json"

    @staticmethod
    def generated_positions(project_id: str) -> Path:
        return ArtifactPaths.artifacts_dir(project_id) / "generated_positions.json"

    @staticmethod
    def tech_card(project_id: str, position_id: str) -> Path:
        return ArtifactPaths.artifacts_dir(project_id) / f"tech_card.{position_id}.json"

    @staticmethod
    def resource_sheet(project_id: str, position_id: str) -> Path:
        return ArtifactPaths.artifacts_dir(project_id) / f"resource_sheet.{position_id}.json"

    @staticmethod
    def materials(project_id: str, position_id: str) -> Path:
        return ArtifactPaths.artifacts_dir(project_id) / f"materials.{position_id}.json"

    @staticmethod
    def enriched_position(project_id: str, position_id: str) -> Path:
        """Path to enriched position artifact."""
        return (
            ArtifactPaths.artifacts_dir(project_id)
            / "enriched_positions"
            / f"{position_id}_enriched.json"
        )

    @staticmethod
    def enrichment_metadata(project_id: str) -> Path:
        """Path to enrichment metadata."""
        return (
            ArtifactPaths.artifacts_dir(project_id)
            / "enrichment_metadata.json"
        )

# Validation
if not settings.ANTHROPIC_API_KEY and settings.ENABLE_WORKFLOW_A:
    import warnings
    warnings.warn(
        "ANTHROPIC_API_KEY not set! Workflow A will not work.",
        UserWarning
    )

if settings.ALLOW_WEB_SEARCH and not settings.PERPLEXITY_API_KEY:
    import warnings
    warnings.warn(
        "ALLOW_WEB_SEARCH is enabled but PERPLEXITY_API_KEY not set. "
        "Will use local KB only.",
        UserWarning
    )
