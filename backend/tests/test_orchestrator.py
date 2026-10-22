import pytest
from unittest.mock import patch, AsyncMock
from backend.app.orchestrator import process_merged_pr_pipeline
from backend.app.database import get_dashboard_stats, get_reflection_by_id
from backend.app.schemas import PRReflection

@pytest.mark.asyncio
async def test_process_merged_pr_pipeline_success():
    delivery_id = "test-delivery-orch-1"
    payload = {
        "action": "closed",
        "pull_request": {
            "number": 55,
            "title": "feat: async request queue",
            "user": {"login": "alice"},
            "html_url": "https://github.com/test/project/pull/55",
            "body": "Fixes #10",
            "merged": True,
            "merged_at": "2026-10-22T09:00:00Z"
        },
        "repository": {
            "name": "project",
            "owner": {"login": "test"},
            "full_name": "test/project"
        }
    }

    mock_pr_context = {
        "files": [{"filename": "queue.py", "status": "modified", "additions": 20, "deletions": 5, "has_patch": True}],
        "diff_text": "--- queue.py\n+async def enqueue(): pass",
        "diff_char_count": 35,
        "linked_issue_numbers": [10],
        "linked_issues": [{"number": 10, "title": "Add async support"}]
    }

    mock_reflection = PRReflection(
        issue_details="Need non-blocking queue for worker processes.",
        execution_summary="Implemented asyncio.Queue with backpressure limits.",
        key_learnings=[
            "Asyncio queues prevent blocking the main event loop.",
            "Always enforce maxsize to prevent unconstrained memory usage.",
            "Write tests simulating slow consumers."
        ]
    )

    with patch("backend.app.orchestrator.GitHubClient.hydrate_pr_context", new_callable=AsyncMock) as mock_hydrate, \
         patch("backend.app.orchestrator.generate_pr_reflection", new_callable=AsyncMock) as mock_gen, \
         patch("backend.app.orchestrator.send_reflection_email", new_callable=AsyncMock) as mock_email:
        
        mock_hydrate.return_value = mock_pr_context
        mock_gen.return_value = mock_reflection
        mock_email.return_value = (True, None)

        result = await process_merged_pr_pipeline(delivery_id, payload)

        assert result is not None
        assert result["processing_status"] == "completed"
        assert result["email_status"] == "sent"
        assert result["duration_ms"] >= 0

        # Verify database record
        stats = get_dashboard_stats()
        assert stats.total_processed_merged >= 1
        assert stats.successfully_emailed >= 1
