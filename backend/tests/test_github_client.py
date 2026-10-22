import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock
from backend.app.github_client import GitHubClient

@pytest.mark.asyncio
async def test_issue_reference_parsing():
    client = GitHubClient()
    text = """
    This PR closes #42 and also fixes #99.
    Furthermore it resolves #105.
    Unrelated numbers like 500 or #abc should be ignored.
    Also case variations: Closes #42, FIXES #200.
    """
    issues = client.extract_linked_issue_numbers(text)
    assert issues == [42, 99, 105, 200]

@pytest.mark.asyncio
async def test_fetch_pr_files_pagination_and_patch_counting():
    client = GitHubClient()

    # Mock page 1 (2 files) and page 2 (1 file)
    page1_data = [
        {
            "filename": "src/cache.py",
            "status": "modified",
            "additions": 10,
            "deletions": 2,
            "changes": 12,
            "patch": "@@ -1,5 +1,13 @@\n+import redis\n+cache = {}\n"
        },
        {
            "filename": "src/image.png",
            "status": "added",
            "additions": 0,
            "deletions": 0,
            "changes": 0,
            # no patch text (e.g. binary file)
        }
    ]

    page2_data = [
        {
            "filename": "tests/test_cache.py",
            "status": "added",
            "additions": 25,
            "deletions": 0,
            "changes": 25,
            "patch": "@@ -0,0 +1,25 @@\n+def test_cache():\n+    assert True\n"
        }
    ]

    mock_client = AsyncMock()
    
    # Configure sequential responses for page 1 and page 2
    r1 = MagicMock()
    r1.status_code = 200
    r1.json.return_value = page1_data

    r2 = MagicMock()
    r2.status_code = 200
    r2.json.return_value = page2_data

    r3 = MagicMock()
    r3.status_code = 200
    r3.json.return_value = []

    mock_client.get.side_effect = [r1, r2, r3]

    files, full_diff, total_chars = await client.fetch_pr_files("test-owner", "test-repo", 42, client=mock_client)

    assert len(files) == 3
    assert files[0]["filename"] == "src/cache.py"
    assert files[1]["has_patch"] is False
    assert "[Patch truncated or binary file]" in full_diff
    assert total_chars == len(full_diff)
    assert total_chars > 0

@pytest.mark.asyncio
async def test_fetch_issue_details_success_and_404():
    client = GitHubClient()
    mock_client = AsyncMock()

    # Success response
    r_ok = MagicMock()
    r_ok.status_code = 200
    r_ok.json.return_value = {
        "title": "Cache eviction bug",
        "body": "Keys do not expire after TTL.",
        "html_url": "https://github.com/org/repo/issues/50",
        "labels": [{"name": "bug"}]
    }

    mock_client.get.return_value = r_ok
    issue = await client.fetch_issue_details("org", "repo", 50, client=mock_client)
    assert issue is not None
    assert issue["title"] == "Cache eviction bug"
    assert "bug" in issue["labels"]

    # 404 response
    r_404 = MagicMock()
    r_404.status_code = 404
    mock_client.get.return_value = r_404
    missing = await client.fetch_issue_details("org", "repo", 999, client=mock_client)
    assert missing is None
