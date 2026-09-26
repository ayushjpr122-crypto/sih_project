"""SQLAlchemy engine/session. PostgreSQL-compatible, SQLite fallback for prototype.

Tables use lowercase identifiers, explicit types, indexed FK columns
(per postgres-best-practices / database-design skills).
"""
from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings
from app.core.logging import get_logger

log = get_logger("db")

Base = declarative_base()

connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    # Ensure parent dir exists for sqlite file.
    try:
        db_path = settings.database_url.split("sqlite:///")[-1]
        if db_path and db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db() -> None:
    from app.db import models  # noqa: F401  (register tables)

    Base.metadata.create_all(bind=engine)
    log.info("DB initialized url=%s", _safe_url(settings.database_url))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _safe_url(url: str) -> str:
    # Never log credentials.
    if "@" in url:
        return url.split("@")[-1]
    return url
