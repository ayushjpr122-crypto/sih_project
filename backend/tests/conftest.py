"""Shared pytest fixtures: isolated SQLite DB + TestClient."""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))
for _p in (str(REPO_ROOT / "src" / "models"), str(REPO_ROOT / "src" / "data")):
    if _p not in sys.path:
        sys.path.insert(0, _p)

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from app.db.database import Base, get_db  # noqa: E402
from app.main import create_app  # noqa: E402

TEST_DIR = tempfile.mkdtemp(prefix="sih26006-test-")
TEST_DB_URL = f"sqlite:///{TEST_DIR}/test.db"
TEST_ENGINE = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(bind=TEST_ENGINE, autoflush=False, autocommit=False)


@pytest.fixture(scope="session", autouse=True)
def _tables():
    import app.db.models  # noqa: F401  (register tables on metadata)

    Base.metadata.create_all(bind=TEST_ENGINE)
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture()
def db_session():
    s = TestingSession()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture()
def client(db_session):
    app = create_app()

    def _override():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c


DEMO_PAYLOAD = {
    "cargo_type": "Coking Coal",
    "cargo_quantity_t": 75000,
    "origin": "Australia",
    "destination": "Paradip",
    "horizon_days": 30,
    "contract_type": "Medium-term",
}
