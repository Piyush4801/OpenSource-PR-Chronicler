import hmac
import hashlib
import json
import uuid
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

SECRET = "test-secret-key-12345"

def sign_payload(body: bytes) -> str:
    sig = hmac.new(SECRET.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"sha256={sig}"

@patch("backend.app.routes.webhook_routes.process_merged_pr_pipeline", new_callable=AsyncMock)
def test_webhook_merged_pr_accepted(mock_pipeline, client: TestClient):
    payload = {
        "action": "closed",
        "pull_request": {
            "number": 101,
            "title": "fix: fix memory leak in caching layer",
            "merged": True,
            "merged_at": "2026-10-22T08:00:00Z",
            "html_url": "https://github.com/org/repo/pull/101",
            "user": {"login": "dev1"},
            "body": "Fixes #50"
        },
        "repository": {
            "name": "repo",
            "full_name": "org/repo",
            "owner": {"login": "org"}
        }
    }
    raw = json.dumps(payload).encode("utf-8")
    delivery_id = str(uuid.uuid4())
    headers = {
        "X-GitHub-Event": "pull_request",
        "X-GitHub-Delivery": delivery_id,
        "X-Hub-Signature-256": sign_payload(raw),
        "Content-Type": "application/json"
    }

    response = client.post("/webhook/github", content=raw, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "accepted"
    assert data["delivery_id"] == delivery_id
    mock_pipeline.assert_called_once()

@patch("backend.app.routes.webhook_routes.process_merged_pr_pipeline", new_callable=AsyncMock)
def test_webhook_duplicate_delivery(mock_pipeline, client: TestClient):
    payload = {
        "action": "closed",
        "pull_request": {
            "number": 102,
            "title": "fix: duplicate delivery test",
            "merged": True,
            "merged_at": "2026-10-22T08:00:00Z",
            "html_url": "https://github.com/org/repo/pull/102",
            "user": {"login": "dev1"},
            "body": "No issue"
        },
        "repository": {
            "name": "repo",
            "full_name": "org/repo",
            "owner": {"login": "org"}
        }
    }
    raw = json.dumps(payload).encode("utf-8")
    delivery_id = str(uuid.uuid4())
    headers = {
        "X-GitHub-Event": "pull_request",
        "X-GitHub-Delivery": delivery_id,
        "X-Hub-Signature-256": sign_payload(raw),
        "Content-Type": "application/json"
    }

    # First delivery: accepted
    r1 = client.post("/webhook/github", content=raw, headers=headers)
    assert r1.status_code == 200
    assert r1.json()["status"] == "accepted"
    assert mock_pipeline.call_count == 1

    # Second delivery: duplicate
    r2 = client.post("/webhook/github", content=raw, headers=headers)
    assert r2.status_code == 200
    assert r2.json()["status"] == "duplicate"
    # Should not invoke pipeline second time
    assert mock_pipeline.call_count == 1

def test_webhook_unmerged_pr_ignored(client: TestClient):
    payload = {
        "action": "closed",
        "pull_request": {
            "number": 103,
            "title": "wip: discarded pr",
            "merged": False,
            "merged_at": None,
            "html_url": "https://github.com/org/repo/pull/103",
            "user": {"login": "dev1"}
        },
        "repository": {
            "name": "repo",
            "full_name": "org/repo",
            "owner": {"login": "org"}
        }
    }
    raw = json.dumps(payload).encode("utf-8")
    headers = {
        "X-GitHub-Event": "pull_request",
        "X-GitHub-Delivery": str(uuid.uuid4()),
        "X-Hub-Signature-256": sign_payload(raw),
        "Content-Type": "application/json"
    }

    response = client.post("/webhook/github", content=raw, headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "ignored"

def test_webhook_opened_pr_ignored(client: TestClient):
    payload = {
        "action": "opened",
        "pull_request": {
            "number": 104,
            "title": "feat: new feature",
            "merged": False,
            "html_url": "https://github.com/org/repo/pull/104",
            "user": {"login": "dev1"}
        },
        "repository": {
            "name": "repo",
            "full_name": "org/repo",
            "owner": {"login": "org"}
        }
    }
    raw = json.dumps(payload).encode("utf-8")
    headers = {
        "X-GitHub-Event": "pull_request",
        "X-GitHub-Delivery": str(uuid.uuid4()),
        "X-Hub-Signature-256": sign_payload(raw),
        "Content-Type": "application/json"
    }

    response = client.post("/webhook/github", content=raw, headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "ignored"

def test_webhook_invalid_signature_rejected(client: TestClient):
    payload = {"action": "closed", "pull_request": {"number": 105, "merged": True}}
    raw = json.dumps(payload).encode("utf-8")
    headers = {
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": "sha256=invalidbadhash1234567890abcdef",
        "Content-Type": "application/json"
    }

    response = client.post("/webhook/github", content=raw, headers=headers)
    assert response.status_code == 401
    assert "Invalid GitHub webhook signature" in response.json()["detail"]

def test_webhook_malformed_payload(client: TestClient):
    raw = b"this is not a valid json object"
    headers = {
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": sign_payload(raw),
        "Content-Type": "application/json"
    }
    response = client.post("/webhook/github", content=raw, headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "ignored"
