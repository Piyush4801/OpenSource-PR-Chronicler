import time
from typing import Dict, Any, Optional
from datetime import datetime

from backend.app.logger import logger
from backend.app.github_client import GitHubClient
from backend.app.ai_pipeline import generate_pr_reflection
from backend.app.email_service import send_reflection_email
from backend.app.database import save_reflection, record_delivery
from backend.app.schemas import PRReflection

async def process_merged_pr_pipeline(
    delivery_id: str,
    payload: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """
    Main asynchronous pipeline for processing merged GitHub Pull Requests.
    Executes:
      1. GitHub context hydration (files, pagination, diff chars, linked issues)
      2. LangChain + Gemini Flash reflection generation
      3. Pydantic schema validation
      4. SMTP email dispatch in background worker
      5. SQLite persistence & metrics logging
    """
    start_time = time.perf_counter()
    pr_data = payload.get("pull_request", {})
    repo_data = payload.get("repository", {})

    repo_full_name = repo_data.get("full_name", "")
    owner = repo_data.get("owner", {}).get("login", "") or (repo_full_name.split("/")[0] if "/" in repo_full_name else "")
    repo_name = repo_data.get("name", "") or (repo_full_name.split("/")[1] if "/" in repo_full_name else "")
    
    pr_number = pr_data.get("number", 0)
    pr_title = pr_data.get("title", "")
    pr_author = pr_data.get("user", {}).get("login", "unknown")
    pr_url = pr_data.get("html_url", "")
    pr_body = pr_data.get("body", "")
    merged_at = pr_data.get("merged_at")

    logger.info(
        f"START Pipeline [delivery={delivery_id}]: {owner}/{repo_name} PR #{pr_number} "
        f"'{pr_title}' by @{pr_author}"
    )

    client = GitHubClient()
    diff_chars = 0
    reflection: Optional[PRReflection] = None
    email_status = "pending"
    email_error: Optional[str] = None
    processing_status = "completed"
    processing_error: Optional[str] = None
    linked_issue_keys = []

    try:
        # Step 1: Hydrate PR files, diffs, and linked issues
        logger.info(f"Hydrating PR #{pr_number} context from GitHub REST API...")
        pr_context = await client.hydrate_pr_context(
            owner=owner,
            repo=repo_name,
            pr_number=pr_number,
            pr_title=pr_title,
            pr_body=pr_body
        )
        diff_chars = pr_context.get("diff_char_count", 0)
        linked_issue_keys = [f"#{num}" for num in pr_context.get("linked_issue_numbers", [])]

        # Step 2: Generate grounded reflection via LangChain LCEL + Gemini Flash
        logger.info(f"Generating reflection via LangChain for PR #{pr_number}...")
        reflection = await generate_pr_reflection(
            repo_owner=owner,
            repo_name=repo_name,
            pr_number=pr_number,
            pr_title=pr_title,
            pr_author=pr_author,
            pr_body=pr_body,
            pr_context=pr_context
        )

        # Step 3: Dispatch reflection email
        logger.info(f"Dispatching reflection email for PR #{pr_number}...")
        email_sent, email_err = await send_reflection_email(
            repo_name=f"{owner}/{repo_name}",
            pr_number=pr_number,
            pr_title=pr_title,
            pr_author=pr_author,
            pr_url=pr_url,
            merged_at=merged_at,
            reflection=reflection
        )

        if email_sent:
            email_status = "sent"
            logger.info(f"Email successfully delivered for PR #{pr_number}")
        else:
            email_status = "skipped_unconfigured" if "not configured" in (email_err or "") else "failed"
            email_error = email_err
            logger.warning(f"Email dispatch status '{email_status}' for PR #{pr_number}: {email_err}")

    except Exception as exc:
        processing_status = "failed"
        processing_error = str(exc)
        logger.exception(f"Pipeline error processing PR #{pr_number}: {exc}")

    end_time = time.perf_counter()
    duration_ms = int((end_time - start_time) * 1000)

    # Persist reflection details into database
    record_id = save_reflection(
        delivery_id=delivery_id,
        repo_name=f"{owner}/{repo_name}",
        repo_owner=owner,
        pr_number=pr_number,
        pr_title=pr_title,
        pr_author=pr_author,
        pr_url=pr_url,
        merged_at=merged_at,
        diff_char_count=diff_chars,
        linked_issues=linked_issue_keys,
        issue_details=reflection.issue_details if reflection else None,
        execution_summary=reflection.execution_summary if reflection else None,
        key_learnings=reflection.key_learnings if reflection else [],
        email_status=email_status,
        email_error=email_error,
        processing_status=processing_status,
        processing_error=processing_error,
        duration_ms=duration_ms
    )

    # Update delivery table status
    record_delivery(
        delivery_id=delivery_id,
        event_action="closed",
        repo_full_name=f"{owner}/{repo_name}",
        pr_number=pr_number,
        is_merged=True,
        status=processing_status
    )

    logger.info(
        f"COMPLETE Pipeline [delivery={delivery_id}]: PR #{pr_number} status={processing_status}, "
        f"email={email_status}, diff_chars={diff_chars}, duration={duration_ms}ms"
    )

    return {
        "id": record_id,
        "delivery_id": delivery_id,
        "repo": f"{owner}/{repo_name}",
        "pr_number": pr_number,
        "processing_status": processing_status,
        "email_status": email_status,
        "duration_ms": duration_ms
    }
