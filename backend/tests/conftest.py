import sys
import os
from pathlib import Path

# Add project root (lec14) to Python path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Configure test environment variables before importing app
os.environ["GITHUB_WEBHOOK_SECRET"] = "test-secret-key-12345"
os.environ["GEMINI_MODEL"] = "gemini-1.5-flash"
os.environ["SMTP_HOST"] = "smtp.test.local"
os.environ["SMTP_PORT"] = "587"
os.environ["SMTP_EMAIL"] = "tester@test.local"
os.environ["SMTP_APP_PASSWORD"] = "testpassword123"
os.environ["RECIPIENT_EMAIL"] = "recipient@test.local"

import pytest
from typing import Generator
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database import init_db

@pytest.fixture(autouse=True)
def setup_test_db():
    """Ensure database schema is fresh and cleanly initialized for tests."""
    init_db()
    yield

@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client
