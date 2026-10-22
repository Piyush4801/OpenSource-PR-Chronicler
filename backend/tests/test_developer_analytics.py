import unittest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.routes.api_routes import extract_developer_username

class TestDeveloperAnalytics(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_01_extract_developer_username(self):
        """Test username normalization from various input formats."""
        self.assertEqual(extract_developer_username("Piyush4801"), "Piyush4801")
        self.assertEqual(extract_developer_username("https://github.com/Piyush4801"), "Piyush4801")
        self.assertEqual(extract_developer_username("http://github.com/Piyush4801"), "Piyush4801")
        self.assertEqual(extract_developer_username("github.com/Piyush4801"), "Piyush4801")
        self.assertEqual(extract_developer_username("https://github.com/Piyush4801/"), "Piyush4801")
        self.assertEqual(extract_developer_username("  https://github.com/tiangolo  "), "tiangolo")
        
        with self.assertRaises(ValueError):
            extract_developer_username("")
        with self.assertRaises(ValueError):
            extract_developer_username("   ")

    @patch("backend.app.github_client.GitHubClient.fetch_user_profile")
    @patch("backend.app.github_client.GitHubClient.fetch_developer_analytics")
    def test_02_developer_preview_success(self, mock_analytics, mock_profile):
        """Test developer preview with merged, open, and closed PR counts."""
        mock_analytics.return_value = (
            True,
            {
                "user": {
                    "login": "Piyush4801",
                    "name": "Piyush Sarode",
                    "avatar_url": "https://avatars.githubusercontent.com/u/123",
                    "html_url": "https://github.com/Piyush4801",
                    "bio": "Open-source contributor",
                    "public_repos": 24,
                    "followers": 15,
                    "type": "User"
                },
                "stats": {
                    "merged_count": 5,
                    "open_count": 12,
                    "closed_unmerged_count": 5,
                    "total_prs": 22,
                    "merge_rate": "23%",
                    "total_repos_count": 8,
                    "is_incomplete": False
                },
                "repo_breakdown": [
                    {
                        "repo_name": "jaegertracing/jaeger-ui",
                        "merged_count": 1,
                        "open_count": 3,
                        "closed_count": 0,
                        "total_count": 4
                    },
                    {
                        "repo_name": "meshery/meshery",
                        "merged_count": 1,
                        "open_count": 2,
                        "closed_count": 0,
                        "total_count": 3
                    }
                ],
                "prs": [
                    {
                        "id": 9901,
                        "number": 4524,
                        "title": "fix: improve image alt text",
                        "repo_name": "jaegertracing/jaeger-ui",
                        "repo_url": "https://github.com/jaegertracing/jaeger-ui",
                        "html_url": "https://github.com/jaegertracing/jaeger-ui/pull/4524",
                        "status": "merged",
                        "state": "closed",
                        "created_at": "2026-09-28T10:00:00Z",
                        "updated_at": "2026-09-30T07:15:26Z",
                        "closed_at": "2026-09-30T07:15:26Z",
                        "merged_at": "2026-09-30T07:15:26Z",
                        "author": "Piyush4801",
                        "body": "Fixes accessibility issue"
                    }
                ]
            },
            None
        )

        # Test POST /api/developer/preview with full URL
        res_post = self.client.post("/api/developer/preview", json={"input": "https://github.com/Piyush4801"})
        self.assertEqual(res_post.status_code, 200)
        data = res_post.json()
        self.assertEqual(data["user"]["login"], "Piyush4801")
        self.assertEqual(data["stats"]["merged_count"], 5)
        self.assertEqual(data["stats"]["open_count"], 12)
        self.assertEqual(data["stats"]["closed_unmerged_count"], 5)
        self.assertEqual(data["stats"]["total_prs"], 22)
        self.assertEqual(data["stats"]["merge_rate"], "23%")
        self.assertEqual(len(data["repo_breakdown"]), 2)
        self.assertEqual(data["prs"][0]["repo_name"], "jaegertracing/jaeger-ui")

        # Test GET /api/developer/{username}/preview
        res_get = self.client.get("/api/developer/Piyush4801/preview")
        self.assertEqual(res_get.status_code, 200)

    @patch("backend.app.github_client.GitHubClient.fetch_developer_analytics")
    def test_03_nonexistent_developer(self, mock_analytics):
        """Test nonexistent developer returns 404."""
        mock_analytics.return_value = (
            False,
            None,
            "GitHub user '@nonexistent_user_999999' not found."
        )

        res = self.client.get("/api/developer/nonexistent_user_999999/preview")
        self.assertEqual(res.status_code, 404)
        self.assertIn("not found", res.json()["detail"].lower())

    @patch("backend.app.github_client.GitHubClient.fetch_developer_analytics")
    def test_04_user_with_zero_prs(self, mock_analytics):
        """Test developer with zero PR contributions."""
        mock_analytics.return_value = (
            True,
            {
                "user": {
                    "login": "newuser",
                    "name": "New Contributor",
                    "avatar_url": "",
                    "html_url": "https://github.com/newuser",
                    "bio": None,
                    "public_repos": 1,
                    "followers": 0,
                    "type": "User"
                },
                "stats": {
                    "merged_count": 0,
                    "open_count": 0,
                    "closed_unmerged_count": 0,
                    "total_prs": 0,
                    "merge_rate": "0%",
                    "total_repos_count": 0,
                    "is_incomplete": False
                },
                "repo_breakdown": [],
                "prs": []
            },
            None
        )

        res = self.client.get("/api/developer/newuser/preview")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["stats"]["total_prs"], 0)
        self.assertEqual(data["stats"]["merge_rate"], "0%")
        self.assertEqual(len(data["repo_breakdown"]), 0)

    @patch("backend.app.github_client.GitHubClient.fetch_developer_prs")
    def test_05_developer_prs_filtering(self, mock_prs):
        """Test filtered and paginated PRs endpoint."""
        mock_prs.return_value = (
            True,
            {
                "username": "Piyush4801",
                "status_filter": "merged",
                "repo_filter": "jaegertracing/jaeger-ui",
                "total_count": 1,
                "page": 1,
                "per_page": 30,
                "prs": [
                    {
                        "id": 9901,
                        "number": 4524,
                        "title": "fix: improve image alt text",
                        "repo_name": "jaegertracing/jaeger-ui",
                        "repo_url": "https://github.com/jaegertracing/jaeger-ui",
                        "html_url": "https://github.com/jaegertracing/jaeger-ui/pull/4524",
                        "status": "merged",
                        "state": "closed",
                        "created_at": "2026-09-28T10:00:00Z",
                        "updated_at": "2026-09-30T07:15:26Z",
                        "closed_at": "2026-09-30T07:15:26Z",
                        "merged_at": "2026-09-30T07:15:26Z",
                        "author": "Piyush4801",
                        "body": "Fixes accessibility issue"
                    }
                ],
                "repo_breakdown": [
                    {
                        "repo_name": "jaegertracing/jaeger-ui",
                        "merged_count": 1,
                        "open_count": 0,
                        "closed_count": 0,
                        "total_count": 1
                    }
                ]
            },
            None
        )

        res = self.client.get("/api/developer/Piyush4801/prs?status=merged&repo=jaegertracing/jaeger-ui")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status_filter"], "merged")
        self.assertEqual(data["repo_filter"], "jaegertracing/jaeger-ui")
        self.assertEqual(len(data["prs"]), 1)

    @patch("backend.app.github_client.GitHubClient.fetch_developer_analytics")
    def test_06_rate_limit_handling(self, mock_analytics):
        """Test rate limit error returns clean 400 with explanation."""
        mock_analytics.return_value = (
            False,
            None,
            "GitHub Search API rate limit reached. Please check or configure GITHUB_TOKEN."
        )

        res = self.client.get("/api/developer/anyuser/preview")
        self.assertEqual(res.status_code, 400)
        self.assertIn("rate limit", res.json()["detail"].lower())

if __name__ == "__main__":
    unittest.main()
