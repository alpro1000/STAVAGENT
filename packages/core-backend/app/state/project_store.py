"""In-memory project store shared across services and API routes."""
from typing import Any, Dict

# Centralized in-memory store for project metadata/state.
# Imported by both API routes and background workflows.
project_store: Dict[str, Dict[str, Any]] = {}
