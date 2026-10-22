import re
import time
import asyncio
import httpx
from typing import List, Dict, Any, Optional, Tuple
from backend.app.config import settings
from backend.app.logger import logger

# In-memory TTL cache to reduce GitHub API requests and respect rate limits
_CACHE: Dict[str, Tuple[float, Any]] = {}
CACHE_TTL_SECONDS = 300.0  # 5 minutes

def _get_cached_item(key: str) -> Optional[Any]:
    if key in _CACHE:
        timestamp, value = _CACHE[key]
        if time.time() - timestamp < CACHE_TTL_SECONDS:
            return value
        del _CACHE[key]
    return None

def _set_cached_item(key: str, value: Any) -> None:
    _CACHE[key] = (time.time(), value)

# Regex to match linked issues like: Fixes #123, closes #456, resolved #789
ISSUE_REF_REGEX = re.compile(
    r"(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)", 
    re.IGNORECASE
)

def _normalize_pr_item(item: Dict[str, Any], lifecycle_status: str, default_author: str) -> Dict[str, Any]:
    """
    Standardize a GitHub Search API issue/PR item into the unified DeveloperPRItem schema.
    Guarantees that items from 'is:merged' are strictly classified as 'merged',
    items from 'is:open' are 'open', and items from 'is:closed is:unmerged' are 'closed'.
    """
    html_url = item.get("html_url", "")
    repo_url = item.get("repository_url", "")
    repo_name = repo_url.replace("https://api.github.com/repos/", "") if repo_url else ""
    if not repo_name or repo_name == repo_url:
        parts = html_url.replace("https://github.com/", "").split("/pull/")
        repo_name = parts[0] if parts else "unknown/repository"

    pull_req = item.get("pull_request", {}) or {}
    merged_at = pull_req.get("merged_at")

    # Determine canonical lifecycle status
    if lifecycle_status == "merged" or bool(merged_at):
        canonical_status = "merged"
    elif lifecycle_status == "open" or item.get("state") == "open":
        canonical_status = "open"
    elif lifecycle_status == "closed":
        canonical_status = "closed"
    else:
        # Fallback if lifecycle_status is generic or "all"
        canonical_status = "merged" if bool(merged_at) else ("open" if item.get("state") == "open" else "closed")

    closed_at = item.get("closed_at")
    final_merged_at = merged_at or (closed_at if canonical_status == "merged" else None)

    author = default_author
    user_obj = item.get("user")
    if isinstance(user_obj, dict) and user_obj.get("login"):
        author = user_obj["login"]

    return {
        "id": item.get("id", 0),
        "number": item.get("number", 0),
        "title": item.get("title", ""),
        "repo_name": repo_name,
        "repository": repo_name,
        "repo_url": f"https://github.com/{repo_name}",
        "html_url": html_url,
        "status": canonical_status,
        "state": canonical_status,
        "created_at": item.get("created_at", ""),
        "updated_at": item.get("updated_at", ""),
        "closed_at": closed_at,
        "merged_at": final_merged_at,
        "author": author,
        "body": (item.get("body") or "")[:500]
    }

class GitHubClient:
    """Asynchronous client for GitHub REST API."""

    def __init__(self, token: Optional[str] = None):
        self.token = token or settings.github_token
        self.base_url = "https://api.github.com"


    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "OpenSource-PR-Chronicler/1.0",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    async def fetch_pr_files(
        self, 
        owner: str, 
        repo: str, 
        pull_number: int,
        client: Optional[httpx.AsyncClient] = None
    ) -> Tuple[List[Dict[str, Any]], str, int]:
        """
        Fetch all changed files for a pull request using pagination.
        Returns:
            Tuple of:
            - list of file metadata objects
            - concatenated patch/diff string
            - total patch character length
        """
        files: List[Dict[str, Any]] = []
        combined_patches: List[str] = []
        page = 1
        per_page = 100
        close_client = False

        if client is None:
            client = httpx.AsyncClient(timeout=30.0)
            close_client = True

        endpoint_url = f"{self.base_url}/repos/{owner}/{repo}/pulls/{pull_number}/files"

        try:
            while True:
                params = {"per_page": per_page, "page": page}
                logger.info(f"GitHub API request: GET {endpoint_url} (page {page})")
                
                response = await client.get(
                    endpoint_url,
                    headers=self._get_headers(),
                    params=params
                )
                logger.info(f"GitHub API response: {response.status_code} for {endpoint_url} (page {page})")

                if response.status_code == 404:
                    logger.warning(f"PR files not found: {owner}/{repo} PR #{pull_number}")
                    break
                elif response.status_code == 403 or response.status_code == 429:
                    logger.error(f"GitHub rate limit exceeded: {response.text}")
                    break
                elif response.status_code != 200:
                    logger.error(f"GitHub API error {response.status_code}: {response.text}")
                    break

                page_files = response.json()
                if not page_files or not isinstance(page_files, list):
                    break

                for file_item in page_files:
                    filename = file_item.get("filename", "")
                    status = file_item.get("status", "unknown")
                    additions = file_item.get("additions", 0)
                    deletions = file_item.get("deletions", 0)
                    changes = file_item.get("changes", 0)
                    patch = file_item.get("patch", "")

                    files.append({
                        "filename": filename,
                        "status": status,
                        "additions": additions,
                        "deletions": deletions,
                        "changes": changes,
                        "has_patch": bool(patch)
                    })

                    if patch:
                        combined_patches.append(f"--- {filename} ({status}, +{additions}/-{deletions})\n{patch}")
                    else:
                        combined_patches.append(f"--- {filename} ({status}) [Patch truncated or binary file]")

                if len(page_files) < per_page:
                    break
                page += 1

        except httpx.RequestError as e:
            logger.error(f"Network error querying GitHub PR files: {e}")
        finally:
            if close_client:
                await client.aclose()

        full_diff_text = "\n\n".join(combined_patches)
        total_char_count = len(full_diff_text)
        logger.info(
            f"Hydrated PR #{pull_number} from {owner}/{repo}: {len(files)} files, "
            f"total diff char count = {total_char_count}"
        )
        return files, full_diff_text, total_char_count

    def extract_linked_issue_numbers(self, text: Optional[str]) -> List[int]:
        """Extract issue numbers referenced with 'Fixes #12', 'Closes #34', etc."""
        if not text:
            return []
        matches = ISSUE_REF_REGEX.findall(text)
        return sorted(list(set(int(m) for m in matches)))

    async def fetch_issue_details(
        self,
        owner: str,
        repo: str,
        issue_number: int,
        client: Optional[httpx.AsyncClient] = None
    ) -> Optional[Dict[str, Any]]:
        """Fetch linked issue title and description if available."""
        close_client = False
        if client is None:
            client = httpx.AsyncClient(timeout=20.0)
            close_client = True

        endpoint_url = f"{self.base_url}/repos/{owner}/{repo}/issues/{issue_number}"
        try:
            logger.info(f"GitHub API request: GET {endpoint_url}")
            response = await client.get(endpoint_url, headers=self._get_headers())
            logger.info(f"GitHub API response: {response.status_code} for {endpoint_url}")

            if response.status_code == 200:
                data = response.json()
                return {
                    "number": issue_number,
                    "title": data.get("title", ""),
                    "body": data.get("body", "") or "",
                    "url": data.get("html_url", ""),
                    "labels": [l.get("name") for l in data.get("labels", []) if isinstance(l, dict)]
                }
            else:
                logger.warning(f"Could not fetch issue #{issue_number}: HTTP {response.status_code}")
                return None
        except httpx.RequestError as e:
            logger.warning(f"Network error fetching issue #{issue_number}: {e}")
            return None
        finally:
            if close_client:
                await client.aclose()

    async def hydrate_pr_context(
        self,
        owner: str,
        repo: str,
        pr_number: int,
        pr_title: str,
        pr_body: Optional[str]
    ) -> Dict[str, Any]:
        """
        Orchestrates retrieval of PR files and any referenced issues.
        """
        async with httpx.AsyncClient(timeout=35.0) as client:
            files, diff_text, total_chars = await self.fetch_pr_files(owner, repo, pr_number, client=client)
            
            # Combine PR title and body to find linked issues
            combined_text = f"{pr_title}\n{pr_body or ''}"
            linked_issue_nums = self.extract_linked_issue_numbers(combined_text)

            linked_issues: List[Dict[str, Any]] = []
            for issue_num in linked_issue_nums:
                issue_info = await self.fetch_issue_details(owner, repo, issue_num, client=client)
                if issue_info:
                    linked_issues.append(issue_info)

            return {
                "files": files,
                "diff_text": diff_text,
                "diff_char_count": total_chars,
                "linked_issue_numbers": linked_issue_nums,
                "linked_issues": linked_issues
            }

    async def verify_repository(self, owner: str, repo: str) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """
        Verify that a repository exists on GitHub and fetch its metadata.
        Returns:
            Tuple of (exists: bool, metadata: Optional[Dict], error_message: Optional[str])
        """
        endpoint_url = f"{self.base_url}/repos/{owner}/{repo}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.get(endpoint_url, headers=self._get_headers())
                if response.status_code == 200:
                    data = response.json()
                    metadata = {
                        "repo_name": data.get("full_name", f"{owner}/{repo}"),
                        "repo_owner": data.get("owner", {}).get("login", owner),
                        "repo_url": data.get("html_url", f"https://github.com/{owner}/{repo}"),
                        "description": data.get("description"),
                        "stars_count": data.get("stargazers_count", 0),
                        "is_private": data.get("private", False),
                        "default_branch": data.get("default_branch", "main")
                    }
                    return True, metadata, None
                elif response.status_code == 404:
                    return False, None, f"Repository '{owner}/{repo}' was not found on GitHub. Please check the URL or repository name."
                elif response.status_code in (403, 429):
                    return False, None, "GitHub API rate limit reached or access forbidden. Please check your GITHUB_TOKEN."
                else:
                    return False, None, f"GitHub API error HTTP {response.status_code}: {response.text[:200]}"
            except httpx.RequestError as e:
                return False, None, f"Network error contacting GitHub API: {str(e)}"

    async def fetch_user_profile(self, username: str) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """Fetch user or org profile details."""
        endpoint_url = f"{self.base_url}/users/{username}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.get(endpoint_url, headers=self._get_headers())
                if response.status_code == 200:
                    data = response.json()
                    user_info = {
                        "login": data.get("login", username),
                        "username": data.get("login", username),
                        "name": data.get("name") or data.get("login", username),
                        "avatar_url": data.get("avatar_url", ""),
                        "html_url": data.get("html_url", f"https://github.com/{username}"),
                        "bio": data.get("bio"),
                        "public_repos": data.get("public_repos", 0),
                        "followers": data.get("followers", 0),
                        "type": data.get("type", "User")
                    }
                    return True, user_info, None
                elif response.status_code == 404:
                    return False, None, f"GitHub account '@{username}' was not found. Please verify the username or profile URL."
                elif response.status_code in (403, 429):
                    return False, None, "GitHub API rate limit exceeded. Please configure a GITHUB_TOKEN."
                else:
                    return False, None, f"GitHub API error HTTP {response.status_code}: {response.text[:200]}"
            except httpx.RequestError as e:
                return False, None, f"Network error contacting GitHub API: {str(e)}"

    async def fetch_user_repositories(
        self, 
        username: str, 
        max_repos: int = 200
    ) -> Tuple[bool, List[Dict[str, Any]], Optional[str]]:
        """Fetch public repositories for a user or organization with automatic pagination."""
        endpoint_url = f"{self.base_url}/users/{username}/repos"
        repos: List[Dict[str, Any]] = []
        page = 1
        per_page = 100
        
        async with httpx.AsyncClient(timeout=25.0) as client:
            while len(repos) < max_repos:
                params = {"per_page": per_page, "page": page, "sort": "updated"}
                try:
                    response = await client.get(endpoint_url, headers=self._get_headers(), params=params)
                    if response.status_code == 200:
                        data = response.json()
                        if not data:
                            break
                        for item in data:
                            repos.append({
                                "repo_name": item.get("full_name", f"{username}/{item.get('name')}"),
                                "repo_owner": item.get("owner", {}).get("login", username),
                                "repo_url": item.get("html_url", f"https://github.com/{username}/{item.get('name')}"),
                                "description": item.get("description"),
                                "stars_count": item.get("stargazers_count", 0),
                                "language": item.get("language"),
                                "is_private": item.get("private", False),
                                "is_fork": item.get("fork", False),
                                "updated_at": item.get("updated_at")
                            })
                        if len(data) < per_page:
                            break
                        page += 1
                    elif response.status_code == 404:
                        return False, [], f"GitHub account '@{username}' was not found."
                    elif response.status_code in (403, 429):
                        return False, [], "GitHub API rate limit exceeded. Please configure a GITHUB_TOKEN."
                    else:
                        return False, [], f"GitHub API error HTTP {response.status_code}: {response.text[:200]}"
                except httpx.RequestError as e:
                    return False, [], f"Network error contacting GitHub API: {str(e)}"
                    
        return True, repos, None

    async def fetch_developer_analytics(self, username: str) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:

        """
        Fetch complete PR analytics for a developer using GitHub REST Search API.
        Retrieves items & counts for merged, open, and closed-unmerged PRs, computes merge rate,
        gathers repository-wise breakdown, and returns normalized analytics.
        Uses in-memory caching to respect rate limits.
        """
        cache_key = f"analytics:{username.lower()}"
        cached = _get_cached_item(cache_key)
        if cached:
            logger.info(f"Returning cached developer analytics for '{username}'")
            return True, cached, None

        # 1. Fetch user profile
        user_ok, user_data, user_err = await self.fetch_user_profile(username)
        if not user_ok or not user_data:
            return False, None, user_err or f"GitHub user '@{username}' not found."

        async with httpx.AsyncClient(timeout=25.0) as client:
            headers = self._get_headers()
            
            # 2. Asynchronously query the 3 distinct PR lifecycle categories with items & counts
            try:
                tasks = [
                    client.get(
                        f"{self.base_url}/search/issues",
                        headers=headers,
                        params={"q": f"type:pr author:{username} is:merged", "sort": "updated", "order": "desc", "per_page": 100, "page": 1}
                    ),
                    client.get(
                        f"{self.base_url}/search/issues",
                        headers=headers,
                        params={"q": f"type:pr author:{username} is:open", "sort": "updated", "order": "desc", "per_page": 100, "page": 1}
                    ),
                    client.get(
                        f"{self.base_url}/search/issues",
                        headers=headers,
                        params={"q": f"type:pr author:{username} is:closed is:unmerged", "sort": "updated", "order": "desc", "per_page": 100, "page": 1}
                    ),
                ]
                responses = await asyncio.gather(*tasks, return_exceptions=True)
            except Exception as e:
                return False, None, f"Network error querying GitHub PR analytics: {str(e)}"

        # Check for errors in responses
        for resp in responses:
            if isinstance(resp, Exception):
                logger.error(f"GitHub search request failed: {resp}")
                return False, None, f"Network error contacting GitHub API: {str(resp)}"
            if resp.status_code in (403, 429):
                logger.warning(f"GitHub search rate limit exceeded: {resp.text[:200]}")
                return False, None, "GitHub Search API rate limit reached. Please check or configure GITHUB_TOKEN."
            elif resp.status_code != 200:
                logger.error(f"GitHub Search API error HTTP {resp.status_code}: {resp.text[:200]}")
                return False, None, f"GitHub Search API returned HTTP {resp.status_code}."

        res_merged, res_open, res_closed = responses  # type: ignore

        merged_data = res_merged.json() if res_merged.status_code == 200 else {}
        open_data = res_open.json() if res_open.status_code == 200 else {}
        closed_data = res_closed.json() if res_closed.status_code == 200 else {}

        merged_count = merged_data.get("total_count", 0)
        open_count = open_data.get("total_count", 0)
        closed_unmerged_count = closed_data.get("total_count", 0)

        is_incomplete = bool(
            merged_data.get("incomplete_results") or
            open_data.get("incomplete_results") or
            closed_data.get("incomplete_results")
        )

        # 3. Parse individual PR items from all 3 category results
        parsed_prs: List[Dict[str, Any]] = []
        for it in merged_data.get("items", []):
            parsed_prs.append(_normalize_pr_item(it, "merged", username))
        for it in open_data.get("items", []):
            parsed_prs.append(_normalize_pr_item(it, "open", username))
        for it in closed_data.get("items", []):
            parsed_prs.append(_normalize_pr_item(it, "closed", username))

        # Sort all PRs by updated_at descending
        parsed_prs.sort(key=lambda x: x.get("updated_at", ""), reverse=True)

        # Aggregate repository breakdown across all parsed PR items
        repo_map: Dict[str, Dict[str, int]] = {}
        for pr in parsed_prs:
            repo_name = pr["repo_name"]
            if repo_name not in repo_map:
                repo_map[repo_name] = {"merged": 0, "open": 0, "closed": 0, "total": 0}
            repo_map[repo_name][pr["status"]] += 1
            repo_map[repo_name]["total"] += 1

        repo_breakdown = [
            {
                "repo_name": repo,
                "merged_count": counts["merged"],
                "open_count": counts["open"],
                "closed_count": counts["closed"],
                "total_count": counts["total"]
            }
            for repo, counts in sorted(repo_map.items(), key=lambda x: x[1]["total"], reverse=True)
        ]

        # Reconcile counts: if search subquery returned 0 due to API behavior but items exist, use parsed counts
        parsed_merged = sum(1 for p in parsed_prs if p["status"] == "merged")
        parsed_open = sum(1 for p in parsed_prs if p["status"] == "open")
        parsed_closed = sum(1 for p in parsed_prs if p["status"] == "closed")

        merged_count = max(merged_count, parsed_merged)
        open_count = max(open_count, parsed_open)
        closed_unmerged_count = max(closed_unmerged_count, parsed_closed)
        total_prs = merged_count + open_count + closed_unmerged_count
        merge_rate = f"{(merged_count / total_prs * 100):.0f}%" if total_prs > 0 else "0%"

        total_repos_count = len(repo_breakdown)

        logger.info(
            f"[developer_analytics] username='{username}' -> "
            f"merged={merged_count} (items={parsed_merged}), "
            f"open={open_count} (items={parsed_open}), "
            f"closed={closed_unmerged_count} (items={parsed_closed}), "
            f"total_repos={total_repos_count}"
        )

        result = {
            "user": user_data,
            "stats": {
                "merged_count": merged_count,
                "open_count": open_count,
                "closed_unmerged_count": closed_unmerged_count,
                "total_prs": total_prs,
                "merge_rate": merge_rate,
                "total_repos_count": total_repos_count,
                "is_incomplete": is_incomplete
            },
            "repo_breakdown": repo_breakdown,
            "prs": parsed_prs
        }

        _set_cached_item(cache_key, result)
        return True, result, None

    async def fetch_developer_prs(
        self,
        username: str,
        status: Optional[str] = None,
        repo: Optional[str] = None,
        page: int = 1,
        per_page: int = 30
    ) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """
        Fetch filtered and paginated PRs for a developer.
        Supports status filter ('merged', 'open', 'closed') and repository filter.
        Uses explicit Search API queries (e.g. type:pr author:{username} is:merged).
        """
        cache_key = f"prs:{username.lower()}:{status}:{repo}:{page}:{per_page}"
        cached = _get_cached_item(cache_key)
        if cached:
            return True, cached, None

        # Build search query using standard GitHub Search API syntax
        query_parts = ["type:pr", f"author:{username}"]
        if status == "merged":
            query_parts.append("is:merged")
        elif status == "open":
            query_parts.append("is:open")
        elif status == "closed":
            query_parts.append("is:closed is:unmerged")
        
        if repo:
            query_parts.append(f"repo:{repo}")

        search_query = " ".join(query_parts)

        async with httpx.AsyncClient(timeout=20.0) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/search/issues",
                    headers=self._get_headers(),
                    params={
                        "q": search_query,
                        "page": page,
                        "per_page": per_page,
                        "sort": "updated",
                        "order": "desc"
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    total_count = data.get("total_count", 0)
                    parsed_prs: List[Dict[str, Any]] = []
                    repo_map: Dict[str, Dict[str, int]] = {}

                    for item in data.get("items", []):
                        pr_item = _normalize_pr_item(item, status or "all", username)
                        parsed_prs.append(pr_item)

                        r_name = pr_item["repo_name"]
                        if r_name not in repo_map:
                            repo_map[r_name] = {"merged": 0, "open": 0, "closed": 0, "total": 0}
                        repo_map[r_name][pr_item["status"]] += 1
                        repo_map[r_name]["total"] += 1

                    repo_breakdown = [
                        {
                            "repo_name": r,
                            "merged_count": counts["merged"],
                            "open_count": counts["open"],
                            "closed_count": counts["closed"],
                            "total_count": counts["total"]
                        }
                        for r, counts in sorted(repo_map.items(), key=lambda x: x[1]["total"], reverse=True)
                    ]

                    has_more = (page * per_page) < total_count
                    result = {
                        "username": username,
                        "status_filter": status,
                        "repo_filter": repo,
                        "total_count": total_count,
                        "page": page,
                        "per_page": per_page,
                        "has_more": has_more,
                        "prs": parsed_prs,
                        "repo_breakdown": repo_breakdown
                    }
                    _set_cached_item(cache_key, result)

                    logger.info(
                        f"[developer_prs] username='{username}', status='{status}', repo='{repo}', page={page} -> "
                        f"HTTP {response.status_code}, total_count={total_count}, items_returned={len(parsed_prs)}, has_more={has_more}"
                    )
                    return True, result, None

                elif response.status_code in (403, 429):
                    logger.warning(f"GitHub Search API rate limit reached for username='{username}': {response.text[:200]}")
                    return False, None, "GitHub Search API rate limit reached. Please configure GITHUB_TOKEN."
                else:
                    logger.error(f"GitHub Search API error HTTP {response.status_code}: {response.text[:200]}")
                    return False, None, f"GitHub Search API error HTTP {response.status_code}: {response.text[:200]}"
            except httpx.RequestError as e:
                logger.error(f"Network error contacting GitHub API for username='{username}': {str(e)}")
                return False, None, f"Network error contacting GitHub API: {str(e)}"




