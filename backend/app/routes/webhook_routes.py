import hmac
import hashlib
import json
from typing import Optional
from fastapi import APIRouter, Request, Header, BackgroundTasks, HTTPException, status
from fastapi.responses import JSONResponse

from backend.app.config import settings
from backend.app.logger import logger
from backend.app.database import is_delivery_processed, record_delivery, update_repo_webhook_status
from backend.app.orchestrator import process_merged_pr_pipeline
from backend.app.schemas import WebhookResponse

router = APIRouter(prefix="/webhook", tags=["Webhook"])

def verify_github_signature(raw_body: bytes, signature_header: Optional[str], secret: Optional[str]) -> bool:
    """
    Verify GitHub HMAC SHA-256 signature against webhook secret.
    If no secret is configured on the server, allow request with warning.
    """
    if not secret:
        # Secret not configured in environment
        return True

    if not signature_header:
        logger.warning("Missing X-Hub-Signature-256 header while GITHUB_WEBHOOK_SECRET is set")
        return False

    prefix = "sha256="
    if not signature_header.startswith(prefix):
        logger.warning(f"Malformed signature header format: {signature_header[:20]}")
        return False

    received_sig = signature_header[len(prefix):]
    expected_sig = hmac.new(
        secret.encode("utf-8"),
        raw_body,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(received_sig, expected_sig)

@router.post("/github", response_model=WebhookResponse)
async def github_webhook_endpoint(
    request: Request,
    background_tasks: BackgroundTasks,
    x_github_event: Optional[str] = Header(None, alias="X-GitHub-Event"),
    x_github_delivery: Optional[str] = Header(None, alias="X-GitHub-Delivery"),
    x_hub_signature_256: Optional[str] = Header(None, alias="X-Hub-Signature-256")
):
    """
    Asynchronous GitHub webhook handler.
    Validates HMAC signature, filters for closed+merged PRs, deduplicates deliveries,
    and enqueues background processing.
    """
    # 1. Read raw body for signature verification
    try:
        raw_body = await request.body()
    except Exception as e:
        logger.error(f"Failed to read webhook request body: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not read request body")

    # 2. Authenticity verification
    is_valid_sig = verify_github_signature(raw_body, x_hub_signature_256, settings.github_webhook_secret)
    if not is_valid_sig:
        logger.warning("Webhook HMAC signature validation FAILED - rejecting request with 401")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid GitHub webhook signature (X-Hub-Signature-256 mismatch)"
        )

    # 3. Parse JSON payload safely
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception as e:
        logger.error(f"Malformed JSON payload in webhook: {e}")
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"status": "ignored", "message": f"Malformed JSON payload: {e}"}
        )

    event_type = x_github_event or payload.get("event") or "pull_request"
    action = payload.get("action")
    pr_data = payload.get("pull_request")
    repo_data = payload.get("repository", {})
    repo_name = repo_data.get("full_name") or repo_data.get("name") or "unknown_repo"

    # Quick ping/handshake event support
    if event_type == "ping":
        logger.info(f"Received GitHub ping event for repository: {repo_name}")
        if repo_name:
            update_repo_webhook_status(repo_name, "active")
        return WebhookResponse(
            status="accepted",
            message=f"GitHub ping acknowledged for {repo_name}",
            delivery_id=x_github_delivery
        )

    # Validate that this is a pull_request event with PR payload
    if not pr_data or not isinstance(pr_data, dict):
        logger.info(f"Ignored webhook event: not a valid pull_request payload (event={event_type}, action={action})")
        return WebhookResponse(
            status="ignored",
            message=f"Event ignored: missing pull_request object (event={event_type})"
        )

    pr_number = pr_data.get("number")
    pr_title = pr_data.get("title", "")
    is_merged = bool(pr_data.get("merged", False))
    merged_at = pr_data.get("merged_at")

    # Build unique delivery identifier for deduplication
    delivery_id = x_github_delivery or f"{repo_name}#{pr_number}@{merged_at or action}"

    if repo_name:
        update_repo_webhook_status(repo_name, "active")

    logger.info(
        f"Webhook received: repo='{repo_name}', PR #{pr_number} ('{pr_title}'), "
        f"action='{action}', merged={is_merged}, delivery='{delivery_id}'"
    )

    # 4. Filter check: Must be action == 'closed' AND merged == True
    if action != "closed" or not is_merged:
        reason = f"Event ignored: action='{action}', merged={is_merged}. Only closed and merged PRs are chronicled."
        logger.info(f"IGNORED: {reason} (repo={repo_name}, PR #{pr_number})")
        
        # Audit delivery as ignored
        record_delivery(
            delivery_id=delivery_id,
            event_action=action or "unknown",
            repo_full_name=repo_name,
            pr_number=pr_number,
            is_merged=is_merged,
            status="ignored"
        )
        
        return WebhookResponse(
            status="ignored",
            message=reason,
            delivery_id=delivery_id
        )

    # 5. Deduplication check
    if is_delivery_processed(delivery_id):
        reason = f"Duplicate delivery detected for delivery_id='{delivery_id}'. Skipping duplicate processing."
        logger.info(reason)
        return WebhookResponse(
            status="duplicate",
            message=reason,
            delivery_id=delivery_id
        )

    # 6. Record delivery as queued/processing
    record_delivery(
        delivery_id=delivery_id,
        event_action=action,
        repo_full_name=repo_name,
        pr_number=pr_number,
        is_merged=True,
        status="processing"
    )

    # 7. Asynchronously trigger the processing pipeline via background tasks
    logger.info(f"ACCEPTED: PR #{pr_number} from '{repo_name}' enqueued for reflection pipeline")
    background_tasks.add_task(
        process_merged_pr_pipeline,
        delivery_id=delivery_id,
        payload=payload
    )

    return WebhookResponse(
        status="accepted",
        message=f"Pull request #{pr_number} merge event accepted for asynchronous chronicling",
        delivery_id=delivery_id
    )
