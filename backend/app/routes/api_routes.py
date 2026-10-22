import time
import re
from pathlib import Path
from typing import Optional, List, Tuple
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, Request
from pydantic import BaseModel

from backend.app.config import settings, BASE_DIR
from backend.app.database import (
    get_dashboard_stats,
    get_reflections,
    get_reflection_by_id,
    record_delivery,
    get_tracked_repositories,
    get_tracked_repository_by_id,
    get_tracked_repository_by_name,
    add_tracked_repository,
    delete_tracked_repository,
    save_reflection
)
from backend.app.ai_pipeline import generate_pr_reflection
from backend.app.schemas import (

    DashboardStats,
    ReflectionRecord,
    SettingsStatus,
    TestEmailRequest,
    PRReflection,
    TrackedRepository,
    AddRepositoryRequest,
    WebhookGuideInfo,
    InspectGitHubInputRequest,
    InspectedRepository,
    GitHubInspectionResponse,
    BatchAddRepositoriesRequest,
    BatchAddRepositoriesResponse,
    DeveloperPreviewResponse,
    DeveloperPRsResponse,
    DeveloperPreviewRequest,
    DeveloperPRItem,
    RepoContributionStat,
    DeveloperPRStats
)
from backend.app.github_client import GitHubClient
from backend.app.email_service import send_reflection_email
from backend.app.orchestrator import process_merged_pr_pipeline
from backend.app.logger import logger

router = APIRouter(prefix="/api", tags=["Application API"])

def parse_github_input(raw_input: str) -> Tuple[str, str, Optional[str]]:
    """
    Parses any GitHub input into either a user profile or a repository.
    Returns:
        Tuple of (type: "profile" | "repository", target_or_owner: str, repo: Optional[str])
    """
    cleaned = raw_input.strip()
    if not cleaned:
        raise ValueError("GitHub input cannot be empty.")
    
    # Remove http(s)://
    cleaned = re.sub(r"^https?://", "", cleaned)
    # Remove github.com/
    cleaned = re.sub(r"^github\.com/", "", cleaned)
    # Remove trailing .git
    cleaned = re.sub(r"\.git$", "", cleaned)
    
    parts = [p.strip() for p in cleaned.split("/") if p.strip()]
    if not parts:
        raise ValueError("Please provide a valid GitHub username or repository URL.")
        
    if len(parts) == 1:
        username = parts[0]
        if not re.match(r"^[a-zA-Z0-9_\-\.]+$", username):
            raise ValueError(f"Invalid characters in GitHub username: {username}")
        return "profile", username, None

    owner, repo = parts[0], parts[1]
    if not re.match(r"^[a-zA-Z0-9_\-\.]+$", owner) or not re.match(r"^[a-zA-Z0-9_\-\.]+$", repo):
        raise ValueError(f"Invalid characters in repository name: {owner}/{repo}")
    return "repository", owner, repo

def parse_github_repo_input(raw_input: str) -> Tuple[str, str]:
    """Parse owner and repo name from GitHub URL or shorthand. Backward compatible."""
    input_type, owner, repo = parse_github_input(raw_input)
    if input_type == "profile":
        raise ValueError(f"'{raw_input}' is a GitHub profile URL. Please select individual repositories from this profile to track.")
    return owner, repo  # type: ignore

@router.get("/repositories", response_model=List[TrackedRepository])
def list_repositories():
    """Retrieve all tracked GitHub repositories."""
    return get_tracked_repositories()

@router.post("/repositories/inspect", response_model=GitHubInspectionResponse)
async def inspect_github_target(req: InspectGitHubInputRequest):
    """
    Inspect a GitHub URL or identifier.
    Automatically detects whether the target is a User Profile or a Repository.
    Fetches live public repositories from GitHub and checks tracking status against the database.
    """
    try:
        input_type, target, repo = parse_github_input(req.input)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    github_client = GitHubClient()

    if input_type == "profile":
        # 1. Fetch user profile
        user_ok, user_data, user_err = await github_client.fetch_user_profile(target)
        if not user_ok or not user_data:
            raise HTTPException(status_code=404, detail=user_err or f"GitHub user '{target}' not found.")

        # 2. Fetch public repositories
        repos_ok, repos_list, repos_err = await github_client.fetch_user_repositories(target)
        if not repos_ok:
            raise HTTPException(status_code=400, detail=repos_err or f"Failed to fetch repositories for '{target}'.")

        inspected_repos: List[InspectedRepository] = []
        for r in repos_list:
            full_name = r["repo_name"]
            existing = get_tracked_repository_by_name(full_name)
            inspected_repos.append(InspectedRepository(
                repo_name=full_name,
                repo_owner=r["repo_owner"],
                repo_url=r["repo_url"],
                description=r["description"],
                stars_count=r["stars_count"],
                language=r["language"],
                is_private=r["is_private"],
                is_fork=r["is_fork"],
                updated_at=r["updated_at"],
                already_tracked=existing is not None,
                tracked_id=existing.id if existing else None,
                webhook_status=existing.webhook_status if existing else None
            ))

        return GitHubInspectionResponse(
            type="profile",
            query=target,
            user=user_data,
            repositories=inspected_repos
        )

    else:
        # Repository inspection
        owner, repo_name = target, repo
        full_repo_name = f"{owner}/{repo_name}"

        exists, metadata, error_msg = await github_client.verify_repository(owner, repo_name)
        if not exists or not metadata:
            raise HTTPException(status_code=404, detail=error_msg or f"Repository '{full_repo_name}' not found on GitHub.")

        existing = get_tracked_repository_by_name(full_repo_name)
        inspected_repo = InspectedRepository(
            repo_name=metadata.get("repo_name", full_repo_name),
            repo_owner=metadata.get("repo_owner", owner),
            repo_url=metadata.get("repo_url", f"https://github.com/{full_repo_name}"),
            description=metadata.get("description"),
            stars_count=metadata.get("stars_count", 0),
            language=None,
            is_private=metadata.get("is_private", False),
            is_fork=False,
            already_tracked=existing is not None,
            tracked_id=existing.id if existing else None,
            webhook_status=existing.webhook_status if existing else None
        )

        return GitHubInspectionResponse(
            type="repository",
            query=full_repo_name,
            user={"username": owner},
            repositories=[inspected_repo]
        )

@router.post("/repositories/batch", response_model=BatchAddRepositoriesResponse, status_code=201)
async def batch_add_repositories(req: BatchAddRepositoriesRequest):
    """
    Connect multiple GitHub repositories to track in a single operation.
    Validates, prevents duplicates, stores persistently, and returns the added records.
    """
    if not req.urls:
        raise HTTPException(status_code=400, detail="Repository URLs list cannot be empty.")

    added: List[TrackedRepository] = []
    already_tracked: List[str] = []
    github_client = GitHubClient()

    for raw_url in req.urls:
        try:
            input_type, owner, repo = parse_github_input(raw_url)
            if input_type != "repository" or not repo:
                continue
            full_repo_name = f"{owner}/{repo}"
        except Exception:
            continue

        existing = get_tracked_repository_by_name(full_repo_name)
        if existing:
            already_tracked.append(existing.repo_name)
            continue

        # Verify repository exists on GitHub
        exists, metadata, _ = await github_client.verify_repository(owner, repo)
        if not exists or not metadata:
            continue

        try:
            new_record = add_tracked_repository(
                repo_name=metadata.get("repo_name", full_repo_name),
                repo_owner=metadata.get("repo_owner", owner),
                repo_url=metadata.get("repo_url", f"https://github.com/{full_repo_name}"),
                description=metadata.get("description"),
                stars_count=metadata.get("stars_count", 0),
                webhook_status="setup_required"
            )
            added.append(new_record)
        except Exception as e:
            logger.error(f"Error batch-saving repository {full_repo_name}: {e}")

    logger.info(f"Batch added {len(added)} repositories (already tracked: {len(already_tracked)})")
    return BatchAddRepositoriesResponse(
        added=added,
        already_tracked=already_tracked,
        total_added=len(added)
    )


@router.post("/repositories", response_model=TrackedRepository, status_code=201)
async def create_tracked_repository(req: AddRepositoryRequest):
    """
    Connect a GitHub repository to track merged PR reflections.
    Validates URL, verifies existence via GitHub API, checks uniqueness, and saves persistently.
    """
    try:
        owner, repo = parse_github_repo_input(req.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    full_repo_name = f"{owner}/{repo}"

    # Check whether the repository is already tracked
    existing = get_tracked_repository_by_name(full_repo_name)
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Repository '{existing.repo_name}' is already tracked in your dashboard."
        )

    # Verify repository existence via GitHub REST API
    github_client = GitHubClient()
    exists, metadata, error_msg = await github_client.verify_repository(owner, repo)

    if not exists:
        logger.warning(f"Repository verification failed for '{full_repo_name}': {error_msg}")
        raise HTTPException(status_code=400, detail=error_msg or f"Repository '{full_repo_name}' could not be verified.")

    # Save repository persistently
    try:
        new_repo = add_tracked_repository(
            repo_name=metadata.get("repo_name", full_repo_name),
            repo_owner=metadata.get("repo_owner", owner),
            repo_url=metadata.get("repo_url", f"https://github.com/{full_repo_name}"),
            description=metadata.get("description"),
            stars_count=metadata.get("stars_count", 0),
            webhook_status="setup_required"
        )
        logger.info(f"Successfully added repository '{full_repo_name}' (ID: {new_repo.id}) to tracked list.")
        return new_repo
    except Exception as e:
        logger.error(f"Database error adding repository '{full_repo_name}': {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save repository: {str(e)}")

@router.delete("/repositories/{repo_id}")
def remove_tracked_repository(repo_id: int):
    """
    Remove a repository from tracked list.
    Preserves all existing contribution reflections in pr_reflections.
    """
    existing = get_tracked_repository_by_id(repo_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Tracked repository not found.")

    deleted = delete_tracked_repository(repo_id)
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to remove repository.")

    logger.info(f"Removed repository '{existing.repo_name}' (ID: {repo_id}) from tracked list.")
    return {
        "status": "success",
        "message": f"Repository '{existing.repo_name}' was removed from tracking. Historical PR reflections are preserved.",
        "repo_id": repo_id
    }

@router.get("/repositories/{repo_id}/webhook-info", response_model=WebhookGuideInfo)
def get_repository_webhook_info(repo_id: int, request: Request):
    """Retrieve setup guide and endpoint instructions for configuring the GitHub webhook."""
    repo = get_tracked_repository_by_id(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Tracked repository not found.")

    # Build default webhook target URL based on host
    base_host = request.headers.get("host", "127.0.0.1:8000")
    protocol = "https" if "https" in request.headers.get("x-forwarded-proto", "") else "http"
    webhook_url = f"{protocol}://{base_host}/webhook/github"

    return WebhookGuideInfo(
        repo_name=repo.repo_name,
        webhook_url=webhook_url,
        content_type="application/json",
        secret_configured=bool(settings.github_webhook_secret and settings.github_webhook_secret.strip()),
        events_required=["Pull requests"],
        status=repo.webhook_status,
        instructions=(
            f"1. Navigate to https://github.com/{repo.repo_name}/settings/hooks/new on GitHub.\n"
            f"2. Set Payload URL to: {webhook_url}\n"
            f"3. Select Content type: 'application/json'\n"
            f"4. Enter your GITHUB_WEBHOOK_SECRET if configured.\n"
            f"5. Under 'Which events would you like to trigger this webhook?', select 'Let me select individual events' and check 'Pull requests'.\n"
            f"6. Click 'Add webhook' to save."
        ),
        user_has_admin_note=(
            "Configuring GitHub webhooks requires Admin or Maintainer privileges on the target repository. "
            "If you are an external contributor without repository admin rights, you can test and dispatch reflections "
            "for this repository at any time using the built-in Webhook Simulator or CLI script (simulate_merge.py)."
        )
    )


@router.get("/stats", response_model=DashboardStats)
def get_stats():
    """Retrieve aggregate statistics and recent PR reflections."""
    return get_dashboard_stats()

@router.get("/reflections", response_model=List[ReflectionRecord])
def list_reflections(
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None)
):
    """Retrieve paginated and searchable list of PR reflections."""
    return get_reflections(limit=limit, search=search, status=status)

@router.get("/reflections/{reflection_id}", response_model=ReflectionRecord)
def get_reflection(reflection_id: int):
    """Retrieve details of a single PR reflection."""
    record = get_reflection_by_id(reflection_id)
    if not record:
        raise HTTPException(status_code=404, detail="Reflection record not found")
    return record

@router.get("/settings/status", response_model=SettingsStatus)
def get_settings_status():
    """
    Check configuration health of GitHub, Gemini, and SMTP.
    Never exposes passwords, tokens, or API keys.
    """
    return SettingsStatus(
        gemini_configured=bool(settings.google_api_key and settings.google_api_key.strip()),
        gemini_model=settings.gemini_model,
        github_token_configured=bool(settings.github_token and settings.github_token.strip()),
        github_webhook_secret_configured=bool(settings.github_webhook_secret and settings.github_webhook_secret.strip()),
        smtp_configured=bool(settings.smtp_email and settings.smtp_app_password and settings.recipient_email),
        smtp_host=settings.smtp_host,
        smtp_port=settings.smtp_port,
        smtp_email_configured=bool(settings.smtp_email),
        recipient_email=settings.recipient_email
    )

@router.post("/test-email")
async def send_test_email(req: TestEmailRequest):
    """Send a test reflection email to verify SMTP configuration."""
    target = req.recipient_email or settings.recipient_email
    if not target:
        raise HTTPException(
            status_code=400,
            detail="No recipient email provided or configured in RECIPIENT_EMAIL"
        )

    sample_reflection = PRReflection(
        issue_details="Test run verification: Testing SMTP connectivity and HTML formatting from OpenSource PR Chronicler.",
        execution_summary="Validated smtplib connection, STARTTLS handshake, and multi-part HTML rendering.",
        key_learnings=[
            "Verified that outbound email credentials function properly.",
            "Ensured that responsive HTML templates render cleanly across email clients.",
            "Established real-time delivery readiness for merged PR reflections."
        ]
    )

    success, err = await send_reflection_email(
        repo_name="demo/test-repository",
        pr_number=42,
        pr_title="Verify SMTP and HTML Email Dispatch Pipeline",
        pr_author="system-test",
        pr_url="https://github.com/demo/test-repository/pull/42",
        merged_at="2026-10-22T00:00:00Z",
        reflection=sample_reflection,
        target_recipient=target
    )

    if not success:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {err}")

    return {
        "status": "success",
        "message": f"Test reflection email successfully dispatched to {target}"
    }

@router.get("/logs")
def get_recent_logs(lines: int = Query(80, ge=10, le=500)):
    """Retrieve recent lines from pr_chronicler.log for UI inspection."""
    log_file = Path(settings.log_file_path)
    if not log_file.exists():
        return {"logs": ["Log file has not been created yet."]}

    try:
        with open(log_file, "r", encoding="utf-8", errors="replace") as f:
            all_lines = f.readlines()
            return {"logs": [line.rstrip("\r\n") for line in all_lines[-lines:]]}
    except Exception as e:
        return {"logs": [f"Error reading log file: {e}"]}

# --- Developer Profile & PR Analytics Endpoints ---

def extract_developer_username(raw_input: str) -> str:
    """
    Extracts and normalizes GitHub username from raw input.
    Accepts:
    - 'Piyush4801'
    - 'https://github.com/Piyush4801'
    - 'github.com/Piyush4801'
    - 'https://github.com/Piyush4801/'
    """
    cleaned = raw_input.strip()
    if not cleaned:
        raise ValueError("GitHub username or URL cannot be empty.")
    
    cleaned = re.sub(r"^https?://", "", cleaned)
    cleaned = re.sub(r"^github\.com/", "", cleaned)
    cleaned = re.sub(r"\.git$", "", cleaned)
    
    parts = [p.strip() for p in cleaned.split("/") if p.strip()]
    if not parts:
        raise ValueError("Please provide a valid GitHub username or profile URL.")
    
    username = parts[0]
    if not re.match(r"^[a-zA-Z0-9_\-\.]+$", username):
        raise ValueError(f"Invalid characters in GitHub username: '{username}'")
    return username

@router.post("/developer/preview", response_model=DeveloperPreviewResponse)
async def preview_developer_post(req: DeveloperPreviewRequest):
    """
    Inspect and preview a developer's GitHub profile and complete PR analytics.
    Retrieves merged, open, and closed-unmerged counts, merge rate, repository breakdown,
    and recent PR contributions.
    """
    try:
        username = extract_developer_username(req.input)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    github_client = GitHubClient()
    success, data, err = await github_client.fetch_developer_analytics(username)
    if not success or not data:
        status_code = 404 if "not found" in (err or "").lower() else 400
        raise HTTPException(status_code=status_code, detail=err or "Failed to fetch developer analytics.")
    return data

@router.get("/developer/{username}/preview", response_model=DeveloperPreviewResponse)
async def get_developer_preview(username: str):
    """
    Retrieve full PR analytics and profile preview for a specified GitHub developer.
    """
    try:
        clean_user = extract_developer_username(username)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    github_client = GitHubClient()
    success, data, err = await github_client.fetch_developer_analytics(clean_user)
    if not success or not data:
        status_code = 404 if "not found" in (err or "").lower() else 400
        raise HTTPException(status_code=status_code, detail=err or "Failed to fetch developer analytics.")
    return data

@router.get("/developer/{username}/prs", response_model=DeveloperPRsResponse)
async def get_developer_prs(
    username: str,
    status: Optional[str] = Query(None, description="Status filter: 'merged', 'open', or 'closed'"),
    repo: Optional[str] = Query(None, description="Target repository filter (e.g. 'owner/repo')"),
    page: int = Query(1, ge=1, le=100),
    per_page: int = Query(30, ge=5, le=100)
):
    """
    Retrieve paginated and filtered PRs for a developer with repository breakdown.
    Supports status filter ('merged', 'open', 'closed') and target repository filter.
    """
    try:
        clean_user = extract_developer_username(username)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    github_client = GitHubClient()
    success, data, err = await github_client.fetch_developer_prs(
        username=clean_user,
        status=status,
        repo=repo,
        page=page,
        per_page=per_page
    )
    if not success or not data:
        raise HTTPException(status_code=400, detail=err or "Failed to fetch developer pull requests.")
    return data

class DispatchReflectionRequest(BaseModel):
    repo_name: str
    pr_number: int
    pr_title: str
    pr_url: str
    author: Optional[str] = "unknown"
    merged_at: Optional[str] = None
    recipient_email: Optional[str] = None
    pr_body: Optional[str] = ""

@router.post("/developer/dispatch-reflection")
async def dispatch_developer_pr_reflection(req: DispatchReflectionRequest):
    """
    Generate grounded AI reflection for a developer's PR and dispatch an educational reflection email.
    """
    start_time = time.perf_counter()
    logger.info(f"Manual reflection dispatch requested for {req.repo_name} PR #{req.pr_number} by @{req.author}")

    parts = req.repo_name.strip("/").split("/")
    if len(parts) >= 2:
        owner, repo_short = parts[0], parts[1]
    else:
        owner = req.author or "unknown"
        repo_short = req.repo_name

    client = GitHubClient()
    diff_chars = 0
    linked_issue_keys = []

    try:
        # Step 1: Hydrate PR files, diffs, and linked issues
        logger.info(f"Hydrating PR #{req.pr_number} context from GitHub API...")
        pr_context = await client.hydrate_pr_context(
            owner=owner,
            repo=repo_short,
            pr_number=req.pr_number,
            pr_title=req.pr_title,
            pr_body=req.pr_body or ""
        )
        diff_chars = pr_context.get("diff_char_count", 0)
        linked_issue_keys = [f"#{num}" for num in pr_context.get("linked_issue_numbers", [])]
    except Exception as exc:
        logger.warning(f"Could not fully hydrate context for PR #{req.pr_number}: {exc}. Using base metadata.")
        pr_context = {
            "files": [],
            "diff_content": "",
            "diff_char_count": 0,
            "linked_issues": [],
            "linked_issue_numbers": []
        }

    try:
        # Step 2: Generate grounded reflection via Gemini Flash / LangChain
        logger.info(f"Generating reflection via AI pipeline for PR #{req.pr_number}...")
        reflection = await generate_pr_reflection(
            repo_owner=owner,
            repo_name=repo_short,
            pr_number=req.pr_number,
            pr_title=req.pr_title,
            pr_author=req.author or "unknown",
            pr_body=req.pr_body or "",
            pr_context=pr_context
        )
    except Exception as exc:
        logger.error(f"Error generating AI reflection: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to generate AI reflection: {exc}")

    # Step 3: Dispatch reflection email
    target_email = req.recipient_email or settings.recipient_email
    email_sent = False
    email_error = None
    email_status = "skipped_unconfigured"

    if target_email and settings.smtp_email and settings.smtp_app_password:
        try:
            email_sent, email_error = await send_reflection_email(
                repo_name=req.repo_name,
                pr_number=req.pr_number,
                pr_title=req.pr_title,
                pr_author=req.author or "unknown",
                pr_url=req.pr_url,
                merged_at=req.merged_at,
                reflection=reflection,
                target_recipient=target_email
            )
            email_status = "sent" if email_sent else "failed"
        except Exception as exc:
            email_sent = False
            email_error = str(exc)
            email_status = "failed"
    else:
        email_status = "skipped_unconfigured"
        email_error = "SMTP not configured (set SMTP_EMAIL, SMTP_APP_PASSWORD, and RECIPIENT_EMAIL in Setup Guide)"

    duration_ms = int((time.perf_counter() - start_time) * 1000)
    delivery_id = f"manual-{int(time.time())}-{req.pr_number}"

    # Step 4: Persist in SQLite database reflections table
    record_id = save_reflection(
        delivery_id=delivery_id,
        repo_name=req.repo_name,
        repo_owner=owner,
        pr_number=req.pr_number,
        pr_title=req.pr_title,
        pr_author=req.author or "unknown",
        pr_url=req.pr_url,
        merged_at=req.merged_at,
        diff_char_count=diff_chars,
        linked_issues=linked_issue_keys,
        issue_details=reflection.issue_details,
        execution_summary=reflection.execution_summary,
        key_learnings=reflection.key_learnings,
        email_status=email_status,
        email_error=email_error,
        processing_status="completed",
        processing_error=None,
        duration_ms=duration_ms
    )

    message = (
        f"Reflection generated and email successfully delivered to {target_email}!"
        if email_sent
        else f"Reflection generated successfully! (Note: {email_error})"
    )

    return {
        "status": "success",
        "message": message,
        "record_id": record_id,
        "email_sent": email_sent,
        "email_status": email_status,
        "email_error": email_error,
        "recipient": target_email,
        "reflection": {
            "issue_details": reflection.issue_details,
            "execution_summary": reflection.execution_summary,
            "key_learnings": reflection.key_learnings,
            "repo_name": req.repo_name,
            "pr_number": req.pr_number,
            "pr_title": req.pr_title
        }
    }


