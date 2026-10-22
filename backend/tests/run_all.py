#!/usr/bin/env python3
"""
Automated unit & integration test runner for OpenSource PR Chronicler.
Runs cleanly and prints real-time test execution results.
"""

import sys
import os
import hmac
import hashlib
import json
import uuid
import unittest
from unittest.mock import patch, MagicMock, AsyncMock
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Setup environment before app imports
os.environ["GITHUB_WEBHOOK_SECRET"] = "test-secret-key-12345"
os.environ["GEMINI_MODEL"] = "gemini-1.5-flash"
os.environ["SMTP_HOST"] = "smtp.test.local"
os.environ["SMTP_PORT"] = "587"
os.environ["SMTP_EMAIL"] = "tester@test.local"
os.environ["SMTP_APP_PASSWORD"] = "testpassword123"
os.environ["RECIPIENT_EMAIL"] = "recipient@test.local"

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import init_db, get_dashboard_stats
from backend.app.schemas import PRReflection
from backend.app.github_client import GitHubClient
from backend.app.ai_pipeline import generate_fallback_reflection
from backend.app.email_service import build_plain_text_email, build_html_email, _send_smtp_sync

SECRET = "test-secret-key-12345"

def sign_payload(body: bytes) -> str:
    sig = hmac.new(SECRET.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"sha256={sig}"

class TestPRChroniclerSuite(unittest.TestCase):
    def setUp(self):
        init_db()
        self.client = TestClient(app)

    # ---------------- Webhook Tests ----------------
    @patch("backend.app.routes.webhook_routes.process_merged_pr_pipeline", new_callable=AsyncMock)
    def test_01_webhook_merged_pr_accepted(self, mock_pipeline):
        payload = {
            "action": "closed",
            "pull_request": {
                "number": 201,
                "title": "fix: resolve memory leak in worker pool",
                "merged": True,
                "merged_at": "2026-10-22T08:00:00Z",
                "html_url": "https://github.com/org/repo/pull/201",
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
        res = self.client.post("/webhook/github", content=raw, headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "accepted")
        self.assertEqual(data["delivery_id"], delivery_id)
        mock_pipeline.assert_called_once()
        print("  [PASS] test_01_webhook_merged_pr_accepted")

    @patch("backend.app.routes.webhook_routes.process_merged_pr_pipeline", new_callable=AsyncMock)
    def test_02_webhook_duplicate_delivery(self, mock_pipeline):
        payload = {
            "action": "closed",
            "pull_request": {
                "number": 202,
                "title": "test: duplicate check",
                "merged": True,
                "merged_at": "2026-10-22T08:00:00Z",
                "html_url": "https://github.com/org/repo/pull/202",
                "user": {"login": "dev1"}
            },
            "repository": {"name": "repo", "full_name": "org/repo", "owner": {"login": "org"}}
        }
        raw = json.dumps(payload).encode("utf-8")
        delivery_id = str(uuid.uuid4())
        headers = {
            "X-GitHub-Event": "pull_request",
            "X-GitHub-Delivery": delivery_id,
            "X-Hub-Signature-256": sign_payload(raw),
            "Content-Type": "application/json"
        }
        r1 = self.client.post("/webhook/github", content=raw, headers=headers)
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r1.json()["status"], "accepted")

        r2 = self.client.post("/webhook/github", content=raw, headers=headers)
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.json()["status"], "duplicate")
        self.assertEqual(mock_pipeline.call_count, 1)
        print("  [PASS] test_02_webhook_duplicate_delivery")

    def test_03_webhook_unmerged_pr_ignored(self):
        payload = {
            "action": "closed",
            "pull_request": {"number": 203, "title": "abandoned draft", "merged": False, "merged_at": None},
            "repository": {"name": "repo", "full_name": "org/repo", "owner": {"login": "org"}}
        }
        raw = json.dumps(payload).encode("utf-8")
        headers = {
            "X-GitHub-Event": "pull_request",
            "X-GitHub-Delivery": str(uuid.uuid4()),
            "X-Hub-Signature-256": sign_payload(raw),
            "Content-Type": "application/json"
        }
        res = self.client.post("/webhook/github", content=raw, headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "ignored")
        print("  [PASS] test_03_webhook_unmerged_pr_ignored")

    def test_04_webhook_opened_pr_ignored(self):
        payload = {
            "action": "opened",
            "pull_request": {"number": 204, "title": "new pr", "merged": False},
            "repository": {"name": "repo", "full_name": "org/repo", "owner": {"login": "org"}}
        }
        raw = json.dumps(payload).encode("utf-8")
        headers = {
            "X-GitHub-Event": "pull_request",
            "X-GitHub-Delivery": str(uuid.uuid4()),
            "X-Hub-Signature-256": sign_payload(raw),
            "Content-Type": "application/json"
        }
        res = self.client.post("/webhook/github", content=raw, headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "ignored")
        print("  [PASS] test_04_webhook_opened_pr_ignored")

    def test_05_webhook_invalid_signature_rejected(self):
        payload = {"action": "closed", "pull_request": {"number": 205, "merged": True}}
        raw = json.dumps(payload).encode("utf-8")
        headers = {
            "X-GitHub-Event": "pull_request",
            "X-Hub-Signature-256": "sha256=invalidbadhash1234567890abcdef",
            "Content-Type": "application/json"
        }
        res = self.client.post("/webhook/github", content=raw, headers=headers)
        self.assertEqual(res.status_code, 401)
        print("  [PASS] test_05_webhook_invalid_signature_rejected")

    # ---------------- GitHub Client Tests ----------------
    def test_06_issue_reference_parsing(self):
        gh = GitHubClient()
        text = "This PR closes #42 and also fixes #99. Resolves #105. Duplicate closes #42."
        issues = gh.extract_linked_issue_numbers(text)
        self.assertEqual(issues, [42, 99, 105])
        print("  [PASS] test_06_issue_reference_parsing")

    # ---------------- AI Schema & Fallback Tests ----------------
    def test_07_pr_reflection_schema_validation(self):
        valid_data = {
            "issue_details": "Fixes race condition in async event emitter.",
            "execution_summary": "Introduced Mutex lock around listener dispatch loop in events.py.",
            "key_learnings": [
                "Always synchronize shared state in multi-threaded runtimes.",
                "Benchmarked latency impact of Mutex vs atomic flags.",
                "Added comprehensive concurrency regression tests."
            ]
        }
        obj = PRReflection.model_validate(valid_data)
        self.assertEqual(len(obj.key_learnings), 3)

        # Failure test: only 1 takeaway (< 3 items)
        invalid_data = dict(valid_data, key_learnings=["Only one takeaway"])
        with self.assertRaises(Exception):
            PRReflection.model_validate(invalid_data)

        # Failure test: 5 takeaways (> 4 items)
        invalid_5 = dict(valid_data, key_learnings=["1", "2", "3", "4", "5"])
        with self.assertRaises(Exception):
            PRReflection.model_validate(invalid_5)

        print("  [PASS] test_07_pr_reflection_schema_validation")

    def test_08_fallback_reflection_generation(self):
        files = [{"filename": "src/parser.py", "status": "modified", "additions": 15, "deletions": 3}]
        linked = [{"number": 12, "title": "Crash on empty JSON"}]
        fallback = generate_fallback_reflection(
            repo_name="my-org/my-project",
            pr_number=88,
            pr_title="Fix crash on empty JSON",
            files=files,
            linked_issues=linked,
            diff_char_count=520
        )
        self.assertIsInstance(fallback, PRReflection)
        self.assertIn("#12", fallback.issue_details)
        self.assertIn("src/parser.py", fallback.execution_summary)
        self.assertGreaterEqual(len(fallback.key_learnings), 3)
        self.assertLessEqual(len(fallback.key_learnings), 4)
        print("  [PASS] test_08_fallback_reflection_generation")

    # ---------------- Email Service Tests ----------------
    def test_09_email_templates(self):
        refl = PRReflection(
            issue_details="Root cause: null pointer exception",
            execution_summary="Added null safe guard",
            key_learnings=["Lesson 1", "Lesson 2", "Lesson 3"]
        )
        plain = build_plain_text_email("repo/name", 10, "Title", "author", "http://gh/10", "2026-10-22", refl)
        self.assertIn("repo/name", plain)
        self.assertIn("#10", plain)
        self.assertIn("Root cause: null pointer exception", plain)

        html = build_html_email("repo/name", 10, "Title", "author", "http://gh/10", "2026-10-22", refl)
        self.assertIn("<!DOCTYPE html>", html)
        self.assertIn("repo/name", html)
        self.assertIn("Root cause: null pointer exception", html)
        print("  [PASS] test_09_email_templates")

    @patch("smtplib.SMTP")
    def test_10_smtp_dispatch_mocked(self, mock_smtp):
        mock_server = MagicMock()
        mock_smtp.return_value = mock_server

        success, err = _send_smtp_sync(
            subject="[OS-Log] PR Merged: test/repo (#1)",
            plain_text="Text",
            html_content="<p>HTML</p>",
            recipient="user@test.local"
        )
        self.assertTrue(success)
        self.assertIsNone(err)
        mock_server.starttls.assert_called_once()
        mock_server.login.assert_called_once()
        mock_server.send_message.assert_called_once()
        print("  [PASS] test_10_smtp_dispatch_mocked")

    # ---------------- Application API & Telemetry Tests ----------------
    def test_11_dashboard_stats_and_settings_apis(self):
        res = self.client.get("/api/stats")
        self.assertEqual(res.status_code, 200)
        stats = res.json()
        self.assertIn("total_processed_merged", stats)
        self.assertIn("successfully_emailed", stats)

        res_settings = self.client.get("/api/settings/status")
        self.assertEqual(res_settings.status_code, 200)
        settings = res_settings.json()
        self.assertIn("gemini_model", settings)
        self.assertNotIn("password", json.dumps(settings).lower())
        print("  [PASS] test_11_dashboard_stats_and_settings_apis")

if __name__ == "__main__":
    print("\n=======================================================")
    print("RUNNING AUTOMATED TEST SUITE: OPENSOURCE PR CHRONICLER")
    print("=======================================================")
    from backend.tests.test_repositories import TestRepositoriesAPI
    from backend.tests.test_developer_analytics import TestDeveloperAnalytics
    suite = unittest.TestSuite()
    suite.addTests(unittest.TestLoader().loadTestsFromTestCase(TestPRChroniclerSuite))
    suite.addTests(unittest.TestLoader().loadTestsFromTestCase(TestRepositoriesAPI))
    suite.addTests(unittest.TestLoader().loadTestsFromTestCase(TestDeveloperAnalytics))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
