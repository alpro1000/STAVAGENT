# app/core/__init__.py
# Re-exports for backward compatibility
# auth.py provides verify_token used by integrations/monolit_adapter.py

try:
    from app.core.auth import verify_token
    __all__ = ["verify_token"]
except ImportError:
    # Graceful fallback if auth module is missing
    verify_token = None
    __all__ = []
