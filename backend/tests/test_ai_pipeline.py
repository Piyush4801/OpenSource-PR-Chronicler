import pytest
from pydantic import ValidationError
from backend.app.schemas import PRReflection
from backend.app.ai_pipeline import generate_fallback_reflection

def test_pr_reflection_schema_valid():
    valid_data = {
        "issue_details": "Fixes race condition in async event emitter.",
        "execution_summary": "Introduced Mutex lock around listener dispatch loop in events.py.",
        "key_learnings": [
            "Always synchronize shared state in multi-threaded runtimes.",
            "Benchmarked latency impact of Mutex vs atomic flags.",
            "Added comprehensive concurrency regression tests."
        ]
    }
    reflection = PRReflection.model_validate(valid_data)
    assert reflection.issue_details == valid_data["issue_details"]
    assert len(reflection.key_learnings) == 3

def test_pr_reflection_schema_invalid_too_few_learnings():
    invalid_data = {
        "issue_details": "Some issue",
        "execution_summary": "Some summary",
        "key_learnings": [
            "Only one takeaway"
        ]
    }
    with pytest.raises(ValidationError):
        PRReflection.model_validate(invalid_data)

def test_pr_reflection_schema_invalid_too_many_learnings():
    invalid_data = {
        "issue_details": "Some issue",
        "execution_summary": "Some summary",
        "key_learnings": [
            "Takeaway 1", "Takeaway 2", "Takeaway 3", "Takeaway 4", "Takeaway 5"
        ]
    }
    with pytest.raises(ValidationError):
        PRReflection.model_validate(invalid_data)

def test_fallback_reflection_generation():
    files = [
        {"filename": "src/parser.py", "status": "modified", "additions": 15, "deletions": 3},
        {"filename": "tests/test_parser.py", "status": "added", "additions": 40, "deletions": 0}
    ]
    linked_issues = [{"number": 12, "title": "Crash on empty JSON string"}]

    fallback = generate_fallback_reflection(
        repo_name="my-org/my-project",
        pr_number=88,
        pr_title="Fix crash on empty JSON payloads",
        files=files,
        linked_issues=linked_issues,
        diff_char_count=520
    )

    assert isinstance(fallback, PRReflection)
    assert "#12" in fallback.issue_details
    assert "src/parser.py" in fallback.execution_summary
    assert len(fallback.key_learnings) >= 3 and len(fallback.key_learnings) <= 4
