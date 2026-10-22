import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database import (
    get_tracked_repositories, 
    delete_tracked_repository, 
    get_tracked_repository_by_name,
    add_tracked_repository
)

class TestRepositoriesAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_01_list_repositories(self):
        response = self.client.get("/api/repositories")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)

    @patch("backend.app.github_client.GitHubClient.fetch_user_profile")
    @patch("backend.app.github_client.GitHubClient.fetch_user_repositories")
    def test_02_inspect_valid_profile_url(self, mock_repos, mock_profile):
        """Scenario 1: Valid GitHub profile URL inspection returns user & repo list."""
        mock_profile.return_value = (
            True,
            {
                "username": "Piyush4801",
                "name": "Piyush Sarode",
                "avatar_url": "https://avatars.githubusercontent.com/u/123",
                "html_url": "https://github.com/Piyush4801",
                "bio": "Open source contributor & developer",
                "public_repos": 2,
                "followers": 10,
                "type": "User"
            },
            None
        )
        mock_repos.return_value = (
            True,
            [
                {
                    "repo_name": "Piyush4801/openairinterface5g",
                    "repo_owner": "Piyush4801",
                    "repo_url": "https://github.com/Piyush4801/openairinterface5g",
                    "description": "5G wireless access network",
                    "stars_count": 5,
                    "language": "C",
                    "is_private": False,
                    "is_fork": True,
                    "updated_at": "2026-10-20T10:00:00Z"
                },
                {
                    "repo_name": "Piyush4801/awesome-project",
                    "repo_owner": "Piyush4801",
                    "repo_url": "https://github.com/Piyush4801/awesome-project",
                    "description": "Awesome tools for developers",
                    "stars_count": 42,
                    "language": "Python",
                    "is_private": False,
                    "is_fork": False,
                    "updated_at": "2026-10-21T12:00:00Z"
                }
            ],
            None
        )

        # Test full profile URL
        res = self.client.post("/api/repositories/inspect", json={"input": "https://github.com/Piyush4801"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["type"], "profile")
        self.assertEqual(data["user"]["username"], "Piyush4801")
        self.assertEqual(len(data["repositories"]), 2)
        self.assertEqual(data["repositories"][0]["repo_name"], "Piyush4801/openairinterface5g")
        self.assertEqual(data["repositories"][0]["language"], "C")
        self.assertEqual(data["repositories"][1]["language"], "Python")

    @patch("backend.app.github_client.GitHubClient.verify_repository")
    def test_03_inspect_valid_repo_url_and_shorthand(self, mock_verify):
        """Scenarios 2 & 3: Valid repo URL and shorthand inspection."""
        mock_verify.return_value = (
            True,
            {
                "repo_name": "astral-sh/uv",
                "repo_owner": "astral-sh",
                "repo_url": "https://github.com/astral-sh/uv",
                "description": "An extremely fast Python package and project manager",
                "stars_count": 45000,
                "is_private": False,
                "default_branch": "main"
            },
            None
        )

        # Full URL
        res1 = self.client.post("/api/repositories/inspect", json={"input": "https://github.com/astral-sh/uv"})
        self.assertEqual(res1.status_code, 200)
        data1 = res1.json()
        self.assertEqual(data1["type"], "repository")
        self.assertEqual(data1["repositories"][0]["repo_name"], "astral-sh/uv")

        # Shorthand
        res2 = self.client.post("/api/repositories/inspect", json={"input": "astral-sh/uv"})
        self.assertEqual(res2.status_code, 200)
        data2 = res2.json()
        self.assertEqual(data2["type"], "repository")

    @patch("backend.app.github_client.GitHubClient.fetch_user_profile")
    def test_04_nonexistent_github_account_rejected(self, mock_profile):
        """Scenario 4: Nonexistent GitHub account returns 404."""
        mock_profile.return_value = (
            False,
            None,
            "GitHub account '@nonexistent_user_999999' was not found."
        )

        res = self.client.post("/api/repositories/inspect", json={"input": "https://github.com/nonexistent_user_999999"})
        self.assertEqual(res.status_code, 404)
        self.assertIn("not found", res.json()["detail"])

    @patch("backend.app.github_client.GitHubClient.verify_repository")
    def test_05_nonexistent_repository_rejected(self, mock_verify):
        """Scenario 5: Nonexistent repository returns 404."""
        mock_verify.return_value = (
            False,
            None,
            "Repository 'org/fake-repo-99999' was not found on GitHub."
        )

        res = self.client.post("/api/repositories/inspect", json={"input": "https://github.com/org/fake-repo-99999"})
        self.assertEqual(res.status_code, 404)
        self.assertIn("not found on GitHub", res.json()["detail"])

    @patch("backend.app.github_client.GitHubClient.verify_repository")
    def test_06_add_and_duplicate_prevention(self, mock_verify):
        """Scenario 6: Adding repository and preventing duplicate entries."""
        mock_verify.return_value = (
            True,
            {
                "repo_name": "test-org/unique-project-101",
                "repo_owner": "test-org",
                "repo_url": "https://github.com/test-org/unique-project-101",
                "description": "Unique test project",
                "stars_count": 99,
                "is_private": False,
                "default_branch": "main"
            },
            None
        )

        # 1. Add repository
        res1 = self.client.post("/api/repositories", json={"url": "https://github.com/test-org/unique-project-101"})
        self.assertEqual(res1.status_code, 201)
        data1 = res1.json()
        repo_id = data1["id"]
        self.assertEqual(data1["webhook_status"], "setup_required")

        # 2. Duplicate attempt must return 409 Conflict
        res2 = self.client.post("/api/repositories", json={"url": "https://github.com/test-org/unique-project-101"})
        self.assertEqual(res2.status_code, 409)
        self.assertIn("already tracked", res2.json()["detail"])

        # 3. Clean up
        del_res = self.client.delete(f"/api/repositories/{repo_id}")
        self.assertEqual(del_res.status_code, 200)

    @patch("backend.app.github_client.GitHubClient.verify_repository")
    def test_07_batch_repository_addition(self, mock_verify):
        """Scenario 7: Multiple repository selection and batch addition."""
        def mock_verify_side_effect(owner, repo):
            return (
                True,
                {
                    "repo_name": f"{owner}/{repo}",
                    "repo_owner": owner,
                    "repo_url": f"https://github.com/{owner}/{repo}",
                    "description": f"Description for {repo}",
                    "stars_count": 10,
                    "is_private": False,
                    "default_branch": "main"
                },
                None
            )
        mock_verify.side_effect = mock_verify_side_effect

        urls = [
            "https://github.com/batch-user/repo-alpha",
            "https://github.com/batch-user/repo-beta"
        ]

        res = self.client.post("/api/repositories/batch", json={"urls": urls})
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["total_added"], 2)
        self.assertEqual(len(data["added"]), 2)

        # Check webhook status is 'setup_required'
        for repo in data["added"]:
            self.assertEqual(repo["webhook_status"], "setup_required")
            # Clean up
            self.client.delete(f"/api/repositories/{repo['id']}")

    def test_08_repository_removal(self):
        """Scenario 9: Repository removal returns confirmation."""
        # Insert a temporary repo
        record = add_tracked_repository(
            repo_name="temp-owner/temp-to-delete",
            repo_owner="temp-owner",
            repo_url="https://github.com/temp-owner/temp-to-delete",
            description="Temporary",
            stars_count=1,
            webhook_status="setup_required"
        )

        res = self.client.delete(f"/api/repositories/{record.id}")
        self.assertEqual(res.status_code, 200)
        self.assertIn("was removed from tracking", res.json()["message"])

        # Ensure not found now
        res_del_again = self.client.delete(f"/api/repositories/{record.id}")
        self.assertEqual(res_del_again.status_code, 404)

    @patch("backend.app.github_client.GitHubClient.fetch_user_profile")
    def test_09_github_api_rate_limit_handled(self, mock_profile):
        """Scenario 10: GitHub API rate limit error handled cleanly."""
        mock_profile.return_value = (
            False,
            None,
            "GitHub API rate limit exceeded. Please configure a GITHUB_TOKEN."
        )

        res = self.client.post("/api/repositories/inspect", json={"input": "https://github.com/heavyuser"})
        self.assertEqual(res.status_code, 404)
        self.assertIn("rate limit", res.json()["detail"].lower())

    def test_10_webhook_guide_endpoint(self):
        """Scenario 4: Webhook instructions provide correct endpoint and permissions."""
        record = add_tracked_repository(
            repo_name="org-guide/sample-guide-repo",
            repo_owner="org-guide",
            repo_url="https://github.com/org-guide/sample-guide-repo",
            description="Guide sample",
            stars_count=20,
            webhook_status="setup_required"
        )

        res = self.client.get(f"/api/repositories/{record.id}/webhook-info")
        self.assertEqual(res.status_code, 200)
        info = res.json()
        self.assertEqual(info["repo_name"], "org-guide/sample-guide-repo")
        self.assertIn("/webhook/github", info["webhook_url"])
        self.assertEqual(info["status"], "setup_required")
        self.assertIn("Pull requests", info["events_required"])
        self.assertIn("admin", info["user_has_admin_note"].lower())

        # Cleanup
        delete_tracked_repository(record.id)

if __name__ == "__main__":
    unittest.main()
