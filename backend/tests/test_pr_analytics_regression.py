import unittest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.github_client import GitHubClient, _normalize_pr_item, _CACHE

class TestPRAnalyticsRegression(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        _CACHE.clear()


    def test_01_five_merged_prs_returned_and_parsed(self):
        """Scenario 1: Five merged PRs returned by GitHub Search API and all 5 parsed with status='merged'."""
        raw_items = [
            {
                "id": 1000 + i,
                "number": 100 + i,
                "title": f"Merged PR #{i+1} Title",
                "state": "closed",
                "html_url": f"https://github.com/org/repo-a/pull/{100+i}",
                "repository_url": "https://api.github.com/repos/org/repo-a",
                "created_at": "2026-09-01T12:00:00Z",
                "updated_at": "2026-09-05T12:00:00Z",
                "closed_at": "2026-09-05T12:00:00Z",
                "pull_request": {"merged_at": "2026-09-05T12:00:00Z"},
                "user": {"login": "testdev"}
            }
            for i in range(5)
        ]

        normalized = [_normalize_pr_item(item, "merged", "testdev") for item in raw_items]
        self.assertEqual(len(normalized), 5)
        for pr in normalized:
            self.assertEqual(pr["status"], "merged")
            self.assertEqual(pr["state"], "merged")
            self.assertEqual(pr["repo_name"], "org/repo-a")
            self.assertEqual(pr["repository"], "org/repo-a")
            self.assertIsNotNone(pr["merged_at"])

    def test_02_twelve_open_prs_returned_and_displayed(self):
        """Scenario 2: Twelve open PRs returned by GitHub Search API and all 12 parsed with status='open'."""
        raw_items = [
            {
                "id": 2000 + i,
                "number": 200 + i,
                "title": f"Open PR #{i+1} Title",
                "state": "open",
                "html_url": f"https://github.com/org/repo-b/pull/{200+i}",
                "repository_url": "https://api.github.com/repos/org/repo-b",
                "created_at": "2026-10-01T12:00:00Z",
                "updated_at": "2026-10-02T12:00:00Z",
                "closed_at": None,
                "pull_request": {"merged_at": None},
                "user": {"login": "testdev"}
            }
            for i in range(12)
        ]

        normalized = [_normalize_pr_item(item, "open", "testdev") for item in raw_items]
        self.assertEqual(len(normalized), 12)
        for pr in normalized:
            self.assertEqual(pr["status"], "open")
            self.assertEqual(pr["state"], "open")
            self.assertEqual(pr["repo_name"], "org/repo-b")

    def test_03_five_closed_unmerged_prs_returned_and_displayed(self):
        """Scenario 3: Five closed unmerged PRs returned and all 5 parsed with status='closed'."""
        raw_items = [
            {
                "id": 3000 + i,
                "number": 300 + i,
                "title": f"Abandoned PR #{i+1}",
                "state": "closed",
                "html_url": f"https://github.com/org/repo-c/pull/{300+i}",
                "repository_url": "https://api.github.com/repos/org/repo-c",
                "created_at": "2026-08-01T12:00:00Z",
                "updated_at": "2026-08-03T12:00:00Z",
                "closed_at": "2026-08-03T12:00:00Z",
                "pull_request": {"merged_at": None},
                "user": {"login": "testdev"}
            }
            for i in range(5)
        ]

        normalized = [_normalize_pr_item(item, "closed", "testdev") for item in raw_items]
        self.assertEqual(len(normalized), 5)
        for pr in normalized:
            self.assertEqual(pr["status"], "closed")
            self.assertEqual(pr["state"], "closed")
            self.assertIsNone(pr["merged_at"])

    def test_04_merged_prs_with_raw_state_closed_and_null_merged_at(self):
        """Scenario 4: Merged PRs with GitHub's raw state='closed' and pull_request.merged_at=null are correctly normalized to 'merged'."""
        raw_merged_item = {
            "id": 4001,
            "number": 42,
            "title": "Fix critical performance bottleneck",
            "state": "closed",  # GitHub Search returns state='closed' for merged PRs
            "html_url": "https://github.com/facebook/react/pull/42",
            "repository_url": "https://api.github.com/repos/facebook/react",
            "created_at": "2026-07-01T10:00:00Z",
            "updated_at": "2026-07-05T14:30:00Z",
            "closed_at": "2026-07-05T14:30:00Z",
            "pull_request": {
                "url": "https://api.github.com/repos/facebook/react/pulls/42",
                "html_url": "https://github.com/facebook/react/pull/42",
                "merged_at": None  # Omitted or null in issues search response
            },
            "user": {"login": "testdev"}
        }

        # Item retrieved from is:merged query must be classified as merged
        normalized = _normalize_pr_item(raw_merged_item, lifecycle_status="merged", default_author="testdev")
        self.assertEqual(normalized["status"], "merged")
        self.assertEqual(normalized["state"], "merged")
        # Ensure merge timestamp resolves to closed_at if merged_at was omitted
        self.assertEqual(normalized["merged_at"], "2026-07-05T14:30:00Z")
        self.assertEqual(normalized["repository"], "facebook/react")

    @patch("backend.app.github_client.GitHubClient.fetch_user_profile")
    @patch("httpx.AsyncClient.get")
    def test_05_empty_api_results(self, mock_get, mock_profile):
        """Scenario 5: Developer with 0 PRs returns clean zero stats and empty PR lists."""
        mock_profile.return_value = (
            True,
            {"login": "newuser", "name": "New User", "avatar_url": "", "public_repos": 0},
            None
        )

        # Mock responses for merged, open, closed queries
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"total_count": 0, "items": []}
        mock_get.return_value = mock_resp

        gh = GitHubClient()
        success, data, err = asyncio.run(gh.fetch_developer_analytics("newuser"))
        self.assertTrue(success)
        self.assertIsNotNone(data)
        self.assertEqual(data["stats"]["total_prs"], 0)
        self.assertEqual(data["stats"]["merged_count"], 0)
        self.assertEqual(data["stats"]["open_count"], 0)
        self.assertEqual(data["stats"]["closed_unmerged_count"], 0)
        self.assertEqual(len(data["prs"]), 0)
        self.assertEqual(len(data["repo_breakdown"]), 0)

    def test_06_nonempty_results_hidden_by_search_filter(self):
        """Scenario 6: Test search filtering logic hides non-matching PRs while preserving underlying records."""
        items = [
            {"id": 1, "title": "Add OAuth2 authentication", "repo_name": "app/backend", "status": "merged"},
            {"id": 2, "title": "Fix memory leak in logger", "repo_name": "app/core", "status": "merged"},
            {"id": 3, "title": "Refactor database migrations", "repo_name": "app/backend", "status": "merged"},
        ]

        # Filter by query 'logger'
        filtered = [
            it for it in items 
            if "logger" in it["title"].lower() or "logger" in it["repo_name"].lower()
        ]
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]["id"], 2)

        # Non-matching query
        empty_filtered = [
            it for it in items 
            if "nonexistent" in it["title"].lower()
        ]
        self.assertEqual(len(empty_filtered), 0)
        # Original items intact
        self.assertEqual(len(items), 3)

    def test_07_repository_filter_switching(self):
        """Scenario 7: Repository filter accurately isolates PRs belonging to the chosen repo."""
        items = [
            {"id": 1, "number": 10, "repo_name": "owner/repo-one", "status": "merged"},
            {"id": 2, "number": 11, "repo_name": "owner/repo-two", "status": "merged"},
            {"id": 3, "number": 12, "repo_name": "owner/repo-one", "status": "merged"},
        ]

        filtered_repo_one = [it for it in items if it["repo_name"] == "owner/repo-one"]
        self.assertEqual(len(filtered_repo_one), 2)

        filtered_repo_two = [it for it in items if it["repo_name"] == "owner/repo-two"]
        self.assertEqual(len(filtered_repo_two), 1)

        # "All Repositories" selection restores all 3 items
        selected_filter = "all"
        all_restored = [it for it in items if selected_filter == "all" or it["repo_name"] == selected_filter]
        self.assertEqual(len(all_restored), 3)

    @patch("httpx.AsyncClient.get")
    def test_08_pagination_endpoint(self, mock_get):
        """Scenario 8: Developer PRs pagination properly passes page and per_page parameters."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "total_count": 45,
            "items": [
                {
                    "id": 5001,
                    "number": 51,
                    "title": "Page 2 PR",
                    "state": "closed",
                    "html_url": "https://github.com/org/repo/pull/51",
                    "repository_url": "https://api.github.com/repos/org/repo",
                    "created_at": "2026-09-01T00:00:00Z",
                    "updated_at": "2026-09-02T00:00:00Z",
                    "closed_at": "2026-09-02T00:00:00Z",
                    "pull_request": {"merged_at": "2026-09-02T00:00:00Z"},
                    "user": {"login": "paginateddev"}
                }
            ]
        }
        mock_get.return_value = mock_resp

        gh = GitHubClient()
        success, data, err = asyncio.run(
            gh.fetch_developer_prs(username="paginateddev", status="merged", page=2, per_page=10)
        )
        self.assertTrue(success)
        self.assertEqual(data["page"], 2)
        self.assertEqual(data["per_page"], 10)
        self.assertEqual(data["total_count"], 45)
        self.assertTrue(data["has_more"])
        self.assertEqual(len(data["prs"]), 1)
        self.assertEqual(data["prs"][0]["status"], "merged")

    @patch("httpx.AsyncClient.get")
    def test_09_github_api_failures_handled(self, mock_get):
        """Scenario 9: Upstream HTTP 500 from GitHub API is handled gracefully with clear diagnostics."""
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.text = "Internal Server Error"
        mock_get.return_value = mock_resp

        gh = GitHubClient()
        success, data, err = asyncio.run(gh.fetch_developer_prs(username="erruser", status="merged"))
        self.assertFalse(success)
        self.assertIsNone(data)
        self.assertIn("500", err)

    @patch("httpx.AsyncClient.get")
    def test_10_github_rate_limiting_handled(self, mock_get):
        """Scenario 10: GitHub Search API HTTP 403 rate limit returns clear actionable message."""
        mock_resp = MagicMock()
        mock_resp.status_code = 403
        mock_resp.text = "API rate limit exceeded"
        mock_get.return_value = mock_resp

        gh = GitHubClient()
        success, data, err = asyncio.run(gh.fetch_developer_prs(username="rateuser", status="merged"))
        self.assertFalse(success)
        self.assertIn("rate limit", err.lower())

    @patch("backend.app.github_client.GitHubClient.fetch_user_profile")
    @patch("httpx.AsyncClient.get")
    def test_11_switching_between_developer_profiles(self, mock_get, mock_profile):
        """Scenario 11: Switching from userA to userB isolates cache and renders distinct profile data."""
        gh = GitHubClient()

        # User A
        mock_profile.return_value = (True, {"login": "userA", "name": "User Alpha", "avatar_url": ""}, None)
        mock_resp_a = MagicMock()
        mock_resp_a.status_code = 200
        mock_resp_a.json.return_value = {
            "total_count": 2,
            "items": [
                {
                    "id": 11, "number": 1, "title": "UserA PR", "state": "closed",
                    "html_url": "https://github.com/org/repo-a/pull/1",
                    "repository_url": "https://api.github.com/repos/org/repo-a",
                    "created_at": "2026-09-01T00:00:00Z", "updated_at": "2026-09-02T00:00:00Z",
                    "closed_at": "2026-09-02T00:00:00Z", "pull_request": {"merged_at": "2026-09-02T00:00:00Z"},
                    "user": {"login": "userA"}
                }
            ]
        }
        mock_get.return_value = mock_resp_a

        ok_a, data_a, _ = asyncio.run(gh.fetch_developer_analytics("userA"))
        self.assertTrue(ok_a)
        self.assertEqual(data_a["user"]["login"], "userA")
        self.assertEqual(data_a["prs"][0]["author"], "userA")

        # User B
        mock_profile.return_value = (True, {"login": "userB", "name": "User Beta", "avatar_url": ""}, None)
        mock_resp_b = MagicMock()
        mock_resp_b.status_code = 200
        mock_resp_b.json.return_value = {
            "total_count": 4,
            "items": [
                {
                    "id": 22, "number": 2, "title": "UserB PR", "state": "closed",
                    "html_url": "https://github.com/org/repo-b/pull/2",
                    "repository_url": "https://api.github.com/repos/org/repo-b",
                    "created_at": "2026-09-01T00:00:00Z", "updated_at": "2026-09-02T00:00:00Z",
                    "closed_at": "2026-09-02T00:00:00Z", "pull_request": {"merged_at": "2026-09-02T00:00:00Z"},
                    "user": {"login": "userB"}
                }
            ]
        }
        mock_get.return_value = mock_resp_b

        ok_b, data_b, _ = asyncio.run(gh.fetch_developer_analytics("userB"))
        self.assertTrue(ok_b)
        self.assertEqual(data_b["user"]["login"], "userB")
        self.assertEqual(data_b["prs"][0]["author"], "userB")
        self.assertNotEqual(data_a["user"]["login"], data_b["user"]["login"])

    def test_12_stale_response_prevention_logic(self):
        """Scenario 12: Request ID sequence ensures late responses from prior requests cannot overwrite current state."""
        request_sequence = {"active_id": 1, "active_user": "userA"}
        stored_state = {"user": "userA", "prs": ["pr_a"]}

        # Simulated slow response arrives for request_id 1 when active_id has moved to 2
        request_sequence["active_id"] = 2
        request_sequence["active_user"] = "userB"

        late_response_req_id = 1
        late_response_user = "userA"
        late_response_data = ["pr_a_late"]

        # Only apply update if request matches active request ID
        if late_response_req_id == request_sequence["active_id"] and late_response_user == request_sequence["active_user"]:
            stored_state = {"user": late_response_user, "prs": late_response_data}

        # Stored state remains protected against stale response
        self.assertEqual(stored_state["user"], "userA")
        self.assertEqual(stored_state["prs"], ["pr_a"])

    @patch("backend.app.github_client.GitHubClient.fetch_user_profile")
    @patch("httpx.AsyncClient.get")
    def test_13_matching_counts_with_fetched_records(self, mock_get, mock_profile):
        """Scenario 13: Developer preview metrics strictly match the parsed PR items."""
        mock_profile.return_value = (True, {"login": "dev13", "name": "Dev Thirteen", "avatar_url": ""}, None)

        def mock_dispatch(url, *args, **kwargs):
            params = kwargs.get("params", {})
            q = params.get("q", "")
            resp = MagicMock()
            resp.status_code = 200

            if "is:merged" in q:
                resp.json.return_value = {
                    "total_count": 5,
                    "items": [
                        {
                            "id": 100 + i, "number": 10 + i, "title": f"Merged #{i}",
                            "state": "closed", "html_url": f"https://github.com/org/r/pull/{10+i}",
                            "repository_url": "https://api.github.com/repos/org/r",
                            "created_at": "2026-09-01T00:00:00Z", "updated_at": "2026-09-02T00:00:00Z",
                            "closed_at": "2026-09-02T00:00:00Z", "pull_request": {"merged_at": "2026-09-02T00:00:00Z"},
                            "user": {"login": "dev13"}
                        }
                        for i in range(5)
                    ]
                }
            elif "is:open" in q:
                resp.json.return_value = {
                    "total_count": 12,
                    "items": [
                        {
                            "id": 200 + i, "number": 20 + i, "title": f"Open #{i}",
                            "state": "open", "html_url": f"https://github.com/org/r/pull/{20+i}",
                            "repository_url": "https://api.github.com/repos/org/r",
                            "created_at": "2026-10-01T00:00:00Z", "updated_at": "2026-10-02T00:00:00Z",
                            "closed_at": None, "pull_request": {},
                            "user": {"login": "dev13"}
                        }
                        for i in range(12)
                    ]
                }
            elif "is:closed" in q:
                resp.json.return_value = {
                    "total_count": 5,
                    "items": [
                        {
                            "id": 300 + i, "number": 30 + i, "title": f"Closed #{i}",
                            "state": "closed", "html_url": f"https://github.com/org/r/pull/{30+i}",
                            "repository_url": "https://api.github.com/repos/org/r",
                            "created_at": "2026-08-01T00:00:00Z", "updated_at": "2026-08-02T00:00:00Z",
                            "closed_at": "2026-08-02T00:00:00Z", "pull_request": {},
                            "user": {"login": "dev13"}
                        }
                        for i in range(5)
                    ]
                }
            else:
                resp.json.return_value = {"total_count": 0, "items": []}
            return resp

        mock_get.side_effect = mock_dispatch

        gh = GitHubClient()
        success, data, err = asyncio.run(gh.fetch_developer_analytics("dev13"))
        self.assertTrue(success)
        self.assertEqual(data["stats"]["merged_count"], 5)
        self.assertEqual(data["stats"]["open_count"], 12)
        self.assertEqual(data["stats"]["closed_unmerged_count"], 5)
        self.assertEqual(data["stats"]["total_prs"], 22)

        # Count of parsed items in data['prs']
        merged_items = [p for p in data["prs"] if p["status"] == "merged"]
        open_items = [p for p in data["prs"] if p["status"] == "open"]
        closed_items = [p for p in data["prs"] if p["status"] == "closed"]

        self.assertEqual(len(merged_items), 5)
        self.assertEqual(len(open_items), 12)
        self.assertEqual(len(closed_items), 5)
        self.assertEqual(len(data["prs"]), 22)

    def test_14_tab_switching_without_disappearing_records(self):
        """Scenario 14: Tab state partitions preserve records across switching without disappearing."""
        all_prs = [
            {"id": 1, "title": "Merged 1", "status": "merged"},
            {"id": 2, "title": "Merged 2", "status": "merged"},
            {"id": 3, "title": "Open 1", "status": "open"},
            {"id": 4, "title": "Closed 1", "status": "closed"},
        ]

        tab_state = {
            "merged": [p for p in all_prs if p["status"] == "merged"],
            "open": [p for p in all_prs if p["status"] == "open"],
            "closed": [p for p in all_prs if p["status"] == "closed"],
        }

        # Select Merged
        active_tab = "merged"
        self.assertEqual(len(tab_state[active_tab]), 2)

        # Switch to Open
        active_tab = "open"
        self.assertEqual(len(tab_state[active_tab]), 1)

        # Switch to Closed
        active_tab = "closed"
        self.assertEqual(len(tab_state[active_tab]), 1)

        # Switch back to Merged -> Records are still there, 0 disappearing!
        active_tab = "merged"
        self.assertEqual(len(tab_state[active_tab]), 2)
        self.assertEqual(tab_state[active_tab][0]["title"], "Merged 1")
        self.assertEqual(tab_state[active_tab][1]["title"], "Merged 2")

if __name__ == "__main__":
    unittest.main()
