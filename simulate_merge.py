#!/usr/bin/env python3
"""
simulate_merge.py

Simulates GitHub pull request webhook payloads sent to:
http://localhost:8000/webhook/github

Implements the three mandatory test scenarios:
  Case 1: Merged PR (action="closed", pull_request.merged=true)
  Case 2: Closed but unmerged PR (action="closed", pull_request.merged=false)
  Case 3: Opened or updated PR (action="opened", pull_request.merged=false)
"""

import sys
import os
import json
import time
import hmac
import hashlib
import uuid
import argparse
from typing import Dict, Any, Optional
import httpx

# Attempt to load local environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

DEFAULT_WEBHOOK_URL = os.getenv("WEBHOOK_TARGET_URL", "http://localhost:8000/webhook/github")
WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET", "")

def generate_signature(payload_bytes: bytes, secret: str) -> str:
    """Compute HMAC SHA-256 signature matching GitHub's X-Hub-Signature-256 header."""
    if not secret:
        return ""
    signature = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()
    return f"sha256={signature}"

def build_payload(scenario: str, repo: str = "astral-sh/uv", pr_number: int = 1234) -> Dict[str, Any]:
    """Construct realistic GitHub pull_request webhook payloads for test scenarios."""
    owner, repo_name = repo.split("/") if "/" in repo else ("test-org", repo)
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    base_pr = {
        "id": 987654321 + pr_number,
        "number": pr_number,
        "state": "closed" if scenario in ("merged", "unmerged") else "open",
        "title": "feat(core): implement zero-overhead dependency resolution caching",
        "body": (
            "## Summary\n"
            "This pull request implements zero-overhead caching for local wheel packages.\n"
            "Resolves #542\n"
            "Fixes #618\n\n"
            "### Changes\n"
            "- Added fast path in `resolver.rs`\n"
            "- Updated caching policy in `cache_manager.py`\n"
            "- Added regression test suite."
        ),
        "html_url": f"https://github.com/{owner}/{repo_name}/pull/{pr_number}",
        "user": {
            "login": "open-source-contributor",
            "id": 45678
        },
        "created_at": "2026-10-20T10:00:00Z",
        "updated_at": timestamp
    }

    repository = {
        "id": 11223344,
        "name": repo_name,
        "full_name": f"{owner}/{repo_name}",
        "owner": {
            "login": owner,
            "id": 998877
        },
        "html_url": f"https://github.com/{owner}/{repo_name}"
    }

    if scenario == "merged":
        # Case 1: Merged PR
        base_pr["merged"] = True
        base_pr["merged_at"] = timestamp
        action = "closed"
    elif scenario == "unmerged":
        # Case 2: Closed but unmerged PR
        base_pr["merged"] = False
        base_pr["merged_at"] = None
        action = "closed"
        base_pr["title"] = "refactor: abandoned experimental prototype"
    elif scenario == "opened":
        # Case 3: Opened or updated PR
        base_pr["merged"] = False
        base_pr["merged_at"] = None
        action = "opened"
        base_pr["title"] = "wip: draft implementation of async stream parser"
    else:
        raise ValueError(f"Unknown scenario: {scenario}")

    return {
        "action": action,
        "number": pr_number,
        "pull_request": base_pr,
        "repository": repository
    }

def send_simulated_event(
    scenario: str,
    target_url: str = DEFAULT_WEBHOOK_URL,
    secret: str = WEBHOOK_SECRET,
    repo: str = "astral-sh/uv",
    pr_number: Optional[int] = None
) -> bool:
    if pr_number is None:
        pr_number = int(time.time()) % 10000 + 1000

    payload_dict = build_payload(scenario, repo=repo, pr_number=pr_number)
    payload_bytes = json.dumps(payload_dict, indent=2).encode("utf-8")
    delivery_id = str(uuid.uuid4())

    headers = {
        "Content-Type": "application/json",
        "X-GitHub-Event": "pull_request",
        "X-GitHub-Delivery": delivery_id,
        "User-Agent": "GitHub-Hookshot/simulated"
    }

    if secret:
        headers["X-Hub-Signature-256"] = generate_signature(payload_bytes, secret)

    print(f"\n=======================================================")
    print(f"SIMULATING SCENARIO: {scenario.upper()}")
    print(f"Target:      {target_url}")
    print(f"Repository:  {repo} (#{pr_number})")
    print(f"Action:      {payload_dict['action']}")
    print(f"Merged:      {payload_dict['pull_request']['merged']}")
    print(f"Delivery ID: {delivery_id}")
    print(f"HMAC Header: {'Present (sha256)' if 'X-Hub-Signature-256' in headers else 'None (no secret)'}")
    print(f"=======================================================")

    start_time = time.perf_counter()
    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.post(target_url, headers=headers, content=payload_bytes)
            elapsed = (time.perf_counter() - start_time) * 1000

        print(f"HTTP Status: {response.status_code} ({elapsed:.1f}ms)")
        try:
            resp_json = response.json()
            print(f"Response Body:\n{json.dumps(resp_json, indent=2)}")
        except Exception:
            print(f"Response Raw: {response.text}")

        # Verification rules
        if scenario == "merged":
            if response.status_code == 200 and resp_json.get("status") == "accepted":
                print(">>> SUCCESS: Merged PR was accepted for processing pipeline!")
                return True
            else:
                print(">>> FAILURE: Expected HTTP 200 with status='accepted'.")
                return False
        else:
            if response.status_code == 200 and resp_json.get("status") == "ignored":
                print(f">>> SUCCESS: {scenario.capitalize()} event was correctly ignored with HTTP 200!")
                return True
            else:
                print(">>> FAILURE: Expected HTTP 200 with status='ignored'.")
                return False

    except httpx.ConnectError:
        print(f"\n[ERROR] Connection refused at {target_url}!")
        print("Ensure the FastAPI backend is running: './venv/bin/uvicorn backend.app.main:app --port 8000'")
        return False
    except Exception as e:
        print(f"\n[ERROR] Request failed: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Simulate GitHub Pull Request webhook events.")
    parser.add_argument(
        "--scenario",
        choices=["merged", "unmerged", "opened", "all"],
        default="all",
        help="Scenario to test (default: all)"
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_WEBHOOK_URL,
        help=f"Webhook target URL (default: {DEFAULT_WEBHOOK_URL})"
    )
    parser.add_argument(
        "--secret",
        default=WEBHOOK_SECRET,
        help="GitHub webhook secret for HMAC SHA-256 calculation"
    )
    parser.add_argument(
        "--repo",
        default="astral-sh/uv",
        help="Repository full name (default: astral-sh/uv)"
    )
    parser.add_argument(
        "--pr",
        type=int,
        default=None,
        help="PR number (default: randomized)"
    )

    args = parser.parse_args()

    print("===================================================================")
    print("OpenSource PR Chronicler: Webhook Simulator")
    print("===================================================================")

    if args.scenario == "all":
        print("Running all three mandatory test scenarios:\n")
        successes = []
        # Case 1: Merged PR
        s1 = send_simulated_event("merged", target_url=args.url, secret=args.secret, repo=args.repo, pr_number=args.pr)
        successes.append(("Case 1: Merged PR", s1))
        time.sleep(1)

        # Case 2: Closed but unmerged PR
        s2 = send_simulated_event("unmerged", target_url=args.url, secret=args.secret, repo=args.repo)
        successes.append(("Case 2: Closed unmerged PR", s2))
        time.sleep(1)

        # Case 3: Opened PR
        s3 = send_simulated_event("opened", target_url=args.url, secret=args.secret, repo=args.repo)
        successes.append(("Case 3: Opened PR", s3))

        print("\n===================================================================")
        print("TEST SUMMARY RESULTS:")
        all_passed = True
        for name, passed in successes:
            status_str = "PASSED" if passed else "FAILED"
            print(f"  {name:30} : [{status_str}]")
            if not passed:
                all_passed = False
        print("===================================================================")
        sys.exit(0 if all_passed else 1)
    else:
        passed = send_simulated_event(args.scenario, target_url=args.url, secret=args.secret, repo=args.repo, pr_number=args.pr)
        sys.exit(0 if passed else 1)

if __name__ == "__main__":
    main()
