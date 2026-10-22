export interface PRReflectionRecord {
  id: number;
  delivery_id: string;
  repo_name: string;
  repo_owner: string;
  pr_number: number;
  pr_title: string;
  pr_author: string;
  pr_url: string;
  merged_at: string | null;
  diff_char_count: number;
  linked_issues: string[];
  issue_details: string | null;
  execution_summary: string | null;
  key_learnings: string[];
  email_status: 'sent' | 'failed' | 'skipped_unconfigured' | 'pending';
  email_error: string | null;
  processing_status: 'completed' | 'failed' | 'ignored';
  processing_error: string | null;
  duration_ms: number;
  created_at: string;
}

export interface DashboardStats {
  total_processed_merged: number;
  successfully_emailed: number;
  failed_attempts: number;
  total_ignored_events: number;
  unique_repos_count: number;
  recent_reflections: PRReflectionRecord[];
  unique_repos: string[];
  last_processing_time: string | null;
}

export interface SettingsStatus {
  gemini_configured: boolean;
  gemini_model: string;
  github_token_configured: boolean;
  github_webhook_secret_configured: boolean;
  smtp_configured: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_email_configured: boolean;
  recipient_email: string | null;
}

export interface TrackedRepository {
  id: number;
  repo_name: string;
  repo_owner: string;
  repo_url: string;
  description: string | null;
  stars_count: number;
  webhook_status: 'setup_required' | 'active' | 'error';
  created_at: string;
  last_event_at: string | null;
  contributions_count: number;
}

export interface WebhookGuideInfo {
  repo_name: string;
  webhook_url: string;
  content_type: string;
  secret_configured: boolean;
  events_required: string[];
  status: string;
  instructions: string;
  user_has_admin_note: string;
}

export interface InspectedRepository {
  repo_name: string;
  repo_owner: string;
  repo_url: string;
  description: string | null;
  stars_count: number;
  language: string | null;
  is_private: boolean;
  is_fork: boolean;
  updated_at: string | null;
  already_tracked: boolean;
  tracked_id: number | null;
  webhook_status: string | null;
}

export interface GitHubUserProfile {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  public_repos: number;
  type?: string;
}

export interface GitHubInspectionResponse {
  type: 'profile' | 'repository';
  query: string;
  user: GitHubUserProfile | null;
  repositories: InspectedRepository[];
}

export interface BatchAddRepositoriesResponse {
  added: TrackedRepository[];
  already_tracked: string[];
  total_added: number;
}

export interface DeveloperPRItem {
  id: number;
  number: number;
  title: string;
  repo_name: string;
  repository?: string;
  repo_url: string;
  html_url: string;
  status: 'merged' | 'open' | 'closed';
  state: 'merged' | 'open' | 'closed' | string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  author: string;
  body?: string | null;
}

export interface RepoContributionStat {
  repo_name: string;
  merged_count: number;
  open_count: number;
  closed_count: number;
  total_count: number;
}

export interface DeveloperPRStats {
  merged_count: number;
  open_count: number;
  closed_unmerged_count: number;
  total_prs: number;
  merge_rate: string;
  total_repos_count: number;
  is_incomplete: boolean;
}

export interface DeveloperPreviewResponse {
  user: GitHubUserProfile;
  stats: DeveloperPRStats;
  repo_breakdown: RepoContributionStat[];
  prs: DeveloperPRItem[];
}

export interface DeveloperPRsResponse {
  username: string;
  status_filter?: string | null;
  repo_filter?: string | null;
  total_count: number;
  page: number;
  per_page: number;
  has_more?: boolean;
  prs: DeveloperPRItem[];
  repo_breakdown: RepoContributionStat[];
}


