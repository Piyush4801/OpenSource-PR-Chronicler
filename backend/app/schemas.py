from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime

class PRReflection(BaseModel):
    issue_details: str = Field(
        description="Root cause or requested requirement"
    )

    execution_summary: str = Field(
        description="Implementation details grounded in PR changes"
    )

    key_learnings: List[str] = Field(
        min_length=3,
        max_length=4,
        description="Three to four engineering takeaways"
    )

class ReflectionRecord(BaseModel):
    id: int
    delivery_id: str
    repo_name: str
    repo_owner: str
    pr_number: int
    pr_title: str
    pr_author: str
    pr_url: str
    merged_at: Optional[str] = None
    diff_char_count: int = 0
    linked_issues: List[str] = []
    issue_details: Optional[str] = None
    execution_summary: Optional[str] = None
    key_learnings: List[str] = []
    email_status: str  # "sent", "failed", "skipped_unconfigured"
    email_error: Optional[str] = None
    processing_status: str  # "completed", "failed", "ignored"
    processing_error: Optional[str] = None
    duration_ms: int = 0
    created_at: str

class WebhookResponse(BaseModel):
    status: str  # "accepted", "ignored", "duplicate", "error"
    message: str
    delivery_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

class DashboardStats(BaseModel):
    total_processed_merged: int
    successfully_emailed: int
    failed_attempts: int
    total_ignored_events: int
    unique_repos_count: int
    recent_reflections: List[ReflectionRecord]
    unique_repos: List[str]
    last_processing_time: Optional[str] = None

class SettingsStatus(BaseModel):
    gemini_configured: bool
    gemini_model: str
    github_token_configured: bool
    github_webhook_secret_configured: bool
    smtp_configured: bool
    smtp_host: str
    smtp_port: int
    smtp_email_configured: bool
    recipient_email: Optional[str] = None

class TestEmailRequest(BaseModel):
    recipient_email: Optional[str] = None

class TrackedRepository(BaseModel):
    id: int
    repo_name: str
    repo_owner: str
    repo_url: str
    description: Optional[str] = None
    stars_count: int = 0
    webhook_status: str  # "setup_required", "active", "error"
    created_at: str
    last_event_at: Optional[str] = None
    contributions_count: int = 0

class AddRepositoryRequest(BaseModel):
    url: str

class WebhookGuideInfo(BaseModel):
    repo_name: str
    webhook_url: str
    content_type: str = "application/json"
    secret_configured: bool
    events_required: List[str] = ["Pull requests"]
    status: str
    instructions: str
    user_has_admin_note: str

class InspectGitHubInputRequest(BaseModel):
    input: str

class InspectedRepository(BaseModel):
    repo_name: str
    repo_owner: str
    repo_url: str
    description: Optional[str] = None
    stars_count: int = 0
    language: Optional[str] = None
    is_private: bool = False
    is_fork: bool = False
    updated_at: Optional[str] = None
    already_tracked: bool = False
    tracked_id: Optional[int] = None
    webhook_status: Optional[str] = None

class GitHubInspectionResponse(BaseModel):
    type: str  # "profile" or "repository"
    query: str
    user: Optional[Dict[str, Any]] = None
    repositories: List[InspectedRepository] = []

class BatchAddRepositoriesRequest(BaseModel):
    urls: List[str]

class BatchAddRepositoriesResponse(BaseModel):
    added: List[TrackedRepository]
    already_tracked: List[str] = []
    total_added: int

# --- Developer Profile & PR Analytics Schemas ---

class DeveloperPRItem(BaseModel):
    id: int
    number: int
    title: str
    repo_name: str
    repository: Optional[str] = None  # Standardized alias: "owner/repository"
    repo_url: str
    html_url: str
    status: str  # "merged", "open", "closed"
    state: str   # Normalized lifecycle status ("merged", "open", "closed")
    created_at: str
    updated_at: str
    closed_at: Optional[str] = None
    merged_at: Optional[str] = None
    author: str
    body: Optional[str] = None

class RepoContributionStat(BaseModel):
    repo_name: str
    merged_count: int = 0
    open_count: int = 0
    closed_count: int = 0
    total_count: int = 0

class DeveloperPRStats(BaseModel):
    merged_count: int = 0
    open_count: int = 0
    closed_unmerged_count: int = 0
    total_prs: int = 0
    merge_rate: str = "0%"
    total_repos_count: int = 0
    is_incomplete: bool = False

class DeveloperPreviewResponse(BaseModel):
    user: Dict[str, Any]
    stats: DeveloperPRStats
    repo_breakdown: List[RepoContributionStat] = []
    prs: List[DeveloperPRItem] = []

class DeveloperPRsResponse(BaseModel):
    username: str
    status_filter: Optional[str] = None
    repo_filter: Optional[str] = None
    total_count: int
    page: int = 1
    per_page: int = 30
    has_more: bool = False
    prs: List[DeveloperPRItem] = []
    repo_breakdown: List[RepoContributionStat] = []

class DeveloperPreviewRequest(BaseModel):
    input: str


