# app/core/__init__.py
# Re-exports for backward compatibility
# auth.py provides verify_token used by integrations/monolit_adapter.py

try:
    from app.core.auth import verify_token
    __all__ = ["verify_token"]
except ImportError:
    # Graceful fallback: callable that raises ImportError clearly
    # instead of None (which would cause AttributeError when called)
    def verify_token(*args, **kwargs):  # type: ignore[misc]
        raise ImportError(
            "auth module is not available — "
            "ensure app/core/auth.py exists and its dependencies are installed"
        )
    __all__ = ["verify_token"]
