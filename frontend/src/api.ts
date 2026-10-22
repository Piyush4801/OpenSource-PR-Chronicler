import { 
  DashboardStats, 
  PRReflectionRecord, 
  SettingsStatus, 
  TrackedRepository, 
  WebhookGuideInfo,
  GitHubInspectionResponse,
  BatchAddRepositoriesResponse,
  DeveloperPreviewResponse,
  DeveloperPRsResponse
} from './types';

const API_BASE = '/api';

export async function fetchDeveloperPreview(input: string): Promise<DeveloperPreviewResponse> {
  const res = await fetch(`${API_BASE}/developer/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to fetch developer analytics');
  }
  return res.json();
}

export async function fetchDeveloperPRs(
  username: string,
  status?: string,
  repo?: string,
  page: number = 1,
  perPage: number = 30
): Promise<DeveloperPRsResponse> {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.append('status', status);
  if (repo && repo !== 'all') params.append('repo', repo);
  params.append('page', String(page));
  params.append('per_page', String(perPage));

  const res = await fetch(`${API_BASE}/developer/${encodeURIComponent(username)}/prs?${params.toString()}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to fetch developer pull requests');
  }
  return res.json();
}

export async function fetchTrackedRepositories(): Promise<TrackedRepository[]> {
  const res = await fetch(`${API_BASE}/repositories`);
  if (!res.ok) throw new Error('Failed to load tracked repositories');
  return res.json();
}

export async function inspectGitHubTarget(input: string): Promise<GitHubInspectionResponse> {
  const res = await fetch(`${API_BASE}/repositories/inspect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to inspect GitHub target');
  }
  return res.json();
}

export async function batchAddRepositories(urls: string[]): Promise<BatchAddRepositoriesResponse> {
  const res = await fetch(`${API_BASE}/repositories/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to batch add repositories');
  }
  return res.json();
}

export async function addRepository(url: string): Promise<TrackedRepository> {
  const res = await fetch(`${API_BASE}/repositories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to add repository');
  }
  return res.json();
}


export async function removeRepository(id: number): Promise<{ status: string; message: string; repo_id: number }> {
  const res = await fetch(`${API_BASE}/repositories/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to remove repository');
  }
  return res.json();
}

export async function fetchRepoWebhookInfo(id: number): Promise<WebhookGuideInfo> {
  const res = await fetch(`${API_BASE}/repositories/${id}/webhook-info`);
  if (!res.ok) throw new Error('Failed to load webhook configuration guide');
  return res.json();
}


export async function fetchStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to load dashboard statistics');
  return res.json();
}

export async function fetchReflections(search?: string, status?: string): Promise<PRReflectionRecord[]> {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (status) params.append('status', status);
  params.append('limit', '100');

  const res = await fetch(`${API_BASE}/reflections?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to load PR reflections');
  return res.json();
}

export async function fetchReflectionById(id: number): Promise<PRReflectionRecord> {
  const res = await fetch(`${API_BASE}/reflections/${id}`);
  if (!res.ok) throw new Error(`Failed to load reflection #${id}`);
  return res.json();
}

export async function fetchSettingsStatus(): Promise<SettingsStatus> {
  const res = await fetch(`${API_BASE}/settings/status`);
  if (!res.ok) throw new Error('Failed to load settings status');
  return res.json();
}

export async function sendTestEmail(recipientEmail?: string): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/test-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient_email: recipientEmail }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to dispatch test email');
  }
  return res.json();
}

export async function fetchRecentLogs(lines: number = 100): Promise<string[]> {
  const res = await fetch(`${API_BASE}/logs?lines=${lines}`);
  if (!res.ok) throw new Error('Failed to fetch logs');
  const data = await res.json();
  return data.logs || [];
}

export async function sendSimulatedWebhook(
  action: 'closed' | 'opened',
  merged: boolean,
  repo: string = 'astral-sh/uv',
  prNumber?: number
): Promise<any> {
  const number = prNumber || Math.floor(Math.random() * 9000) + 1000;
  const [owner, name] = repo.split('/');
  const timestamp = new Date().toISOString();

  const payload = {
    action,
    number,
    pull_request: {
      id: 990000 + number,
      number,
      title: merged 
        ? `feat(engine): optimize asynchronous event dispatch queue` 
        : `wip: experiment with alternate parser`,
      body: `## Summary\nImplements zero-overhead caching and resolves issue.\nFixes #104\nCloses #208`,
      html_url: `https://github.com/${repo}/pull/${number}`,
      user: { login: 'oss-contributor' },
      merged,
      merged_at: merged ? timestamp : null,
      created_at: timestamp,
    },
    repository: {
      id: 887766,
      name: name || repo,
      full_name: repo,
      owner: { login: owner || 'org' },
      html_url: `https://github.com/${repo}`,
    }
  };

  const res = await fetch('/webhook/github', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-GitHub-Event': 'pull_request',
      'X-GitHub-Delivery': `sim-${Date.now()}-${number}`,
    },
    body: JSON.stringify(payload),
  });

  return res.json();
}

export interface DispatchReflectionResult {
  status: string;
  message: string;
  record_id?: number;
  email_sent: boolean;
  email_status: string;
  email_error?: string | null;
  recipient?: string | null;
  reflection?: {
    issue_details?: string;
    execution_summary?: string;
    key_learnings?: string[];
    repo_name?: string;
    pr_number?: number;
    pr_title?: string;
  };
}

export async function dispatchPRReflection(params: {
  repo_name: string;
  pr_number: number;
  pr_title: string;
  pr_url: string;
  author?: string;
  merged_at?: string | null;
  recipient_email?: string;
  pr_body?: string;
}): Promise<DispatchReflectionResult> {
  const res = await fetch(`${API_BASE}/developer/dispatch-reflection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to dispatch PR reflection');
  }

  return res.json();
}

