"""Per-request domain context using contextvars with a server-wide default."""
from __future__ import annotations

import logging
import sys
import threading
from contextvars import ContextVar

logger = logging.getLogger("archestra.context")
logger.addHandler(logging.StreamHandler(sys.stderr))
logger.setLevel(logging.INFO)

VALID_DOMAINS: frozenset[str] = frozenset({"energy", "logistics", "healthcare"})

_lock = threading.Lock()
_default_domain: str = "energy"
_active_domain: ContextVar[str] = ContextVar("active_domain")


def set_default_domain(domain: str) -> None:
    """Set the server-wide default domain (persists across requests)."""
    global _default_domain
    if domain not in VALID_DOMAINS:
        raise ValueError(f"Unknown domain: {domain}. Valid: {sorted(VALID_DOMAINS)}")
    with _lock:
        _default_domain = domain
    logger.info("Server default domain set to: %s", domain)


def get_default_domain() -> str:
    return _default_domain


def set_active_domain(domain: str) -> None:
    """Set domain for the current async context."""
    if domain not in VALID_DOMAINS:
        raise ValueError(f"Unknown domain: {domain}. Valid: {sorted(VALID_DOMAINS)}")
    _active_domain.set(domain)


def get_active_domain() -> str:
    """Get domain for the current context, falling back to server default."""
    try:
        return _active_domain.get()
    except LookupError:
        return _default_domain
