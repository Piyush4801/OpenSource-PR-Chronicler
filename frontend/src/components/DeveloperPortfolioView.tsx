import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  GitMerge, 
  GitPullRequest, 
  GitPullRequestClosed, 
  GitBranch, 
  ExternalLink, 
  Search, 
  X, 
  Filter, 
  User, 
  LogOut, 
  Star,
  CheckCircle2,
  FolderGit2,
  Calendar,
  AlertCircle,
  RefreshCw,
  Mail
} from '../icons';
import { DeveloperPreviewResponse, DeveloperPRItem } from '../types';
import { fetchDeveloperPRs } from '../api';
import { DispatchReflectionModal } from './DispatchReflectionModal';

interface DeveloperPortfolioViewProps {
  data: DeveloperPreviewResponse;
  onExitPreview: () => void;
  onSwitchDeveloper: () => void;
}

export const DeveloperPortfolioView: React.FC<DeveloperPortfolioViewProps> = ({
  data,
  onExitPreview,
  onSwitchDeveloper,
}) => {
  const { user, stats, repo_breakdown, prs } = data;

  // Selected PR for generating AI reflection and sending email
  const [selectedDispatchPR, setSelectedDispatchPR] = useState<DeveloperPRItem | null>(null);

  // Active Lifecycle View Mode: 'all' | 'merged' | 'open' | 'closed'
  type ViewMode = 'all' | 'merged' | 'open' | 'closed';
  const [activeTab, setActiveTab] = useState<ViewMode>('merged');
  const [analyticsView, setAnalyticsView] = useState<ViewMode>('merged');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRepoFilter, setSelectedRepoFilter] = useState<string>('all');

  // Independent Tab PR records
  const [tabPRs, setTabPRs] = useState<{
    all: DeveloperPRItem[];
    merged: DeveloperPRItem[];
    open: DeveloperPRItem[];
    closed: DeveloperPRItem[];
  }>({
    all: [],
    merged: [],
    open: [],
    closed: [],
  });

  const [tabLoading, setTabLoading] = useState<{
    all: boolean;
    merged: boolean;
    open: boolean;
    closed: boolean;
  }>({
    all: false,
    merged: false,
    open: false,
    closed: false,
  });

  const [tabErrors, setTabErrors] = useState<{
    all: string | null;
    merged: string | null;
    open: string | null;
    closed: string | null;
  }>({
    all: null,
    merged: null,
    open: null,
    closed: null,
  });

  const [tabLoaded, setTabLoaded] = useState<{
    all: boolean;
    merged: boolean;
    open: boolean;
    closed: boolean;
  }>({
    all: false,
    merged: false,
    open: false,
    closed: false,
  });

  // Track active request ID to discard stale responses
  const activeRequestIdRef = useRef(0);
  const activeUserRef = useRef(user.login);

  // When developer profile or preview data changes, reset and partition initial PRs
  useEffect(() => {
    activeUserRef.current = user.login;
    const initialMerged = prs.filter((p) => p.status === 'merged');
    const initialOpen = prs.filter((p) => p.status === 'open');
    const initialClosed = prs.filter((p) => p.status === 'closed');

    setTabPRs({
      all: prs,
      merged: initialMerged,
      open: initialOpen,
      closed: initialClosed,
    });

    setTabLoaded({
      all: prs.length > 0 || stats.total_prs === 0,
      merged: initialMerged.length > 0 || stats.merged_count === 0,
      open: initialOpen.length > 0 || stats.open_count === 0,
      closed: initialClosed.length > 0 || stats.closed_unmerged_count === 0,
    });

    setTabErrors({
      all: null,
      merged: null,
      open: null,
      closed: null,
    });

    setSearchTerm('');
    setSelectedRepoFilter('all');
  }, [user.login, prs, stats.total_prs, stats.merged_count, stats.open_count, stats.closed_unmerged_count]);

  // Fetch PR records for a specific lifecycle tab on demand
  const loadTabPRs = async (tab: ViewMode, force = false) => {
    const expectedCount = tab === 'merged' 
      ? stats.merged_count 
      : tab === 'open' 
      ? stats.open_count 
      : tab === 'closed'
      ? stats.closed_unmerged_count
      : stats.total_prs;

    // If already populated and not force-refreshing, skip
    if (!force && tabLoaded[tab] && tabPRs[tab].length > 0) return;
    if (!force && expectedCount === 0) return;

    const reqId = ++activeRequestIdRef.current;
    const currentUser = user.login;

    setTabLoading((prev) => ({ ...prev, [tab]: true }));
    setTabErrors((prev) => ({ ...prev, [tab]: null }));

    try {
      const res = await fetchDeveloperPRs(
        currentUser,
        tab === 'all' ? undefined : tab,
        selectedRepoFilter === 'all' ? undefined : selectedRepoFilter,
        1,
        100
      );

      // Verify request is still fresh and user hasn't changed
      if (reqId === activeRequestIdRef.current && currentUser === activeUserRef.current) {
        setTabPRs((prev) => ({ ...prev, [tab]: res.prs }));
        setTabLoaded((prev) => ({ ...prev, [tab]: true }));
      }
    } catch (err: any) {
      if (reqId === activeRequestIdRef.current && currentUser === activeUserRef.current) {
        setTabErrors((prev) => ({ 
          ...prev, 
          [tab]: err.message || 'Unable to load pull requests. Please try again.' 
        }));
      }
    } finally {
      if (reqId === activeRequestIdRef.current && currentUser === activeUserRef.current) {
        setTabLoading((prev) => ({ ...prev, [tab]: false }));
      }
    }
  };

  // When activeTab changes, ensure PR records are loaded if missing
  useEffect(() => {
    loadTabPRs(activeTab);
  }, [activeTab, user.login]);

  // Repositories breakdown memos by lifecycle
  const allRepos = useMemo(() => {
    return repo_breakdown.filter((r) => r.total_count > 0);
  }, [repo_breakdown]);

  const mergedRepos = useMemo(() => {
    return repo_breakdown.filter((r) => r.merged_count > 0);
  }, [repo_breakdown]);

  const openRepos = useMemo(() => {
    return repo_breakdown.filter((r) => r.open_count > 0);
  }, [repo_breakdown]);

  const closedRepos = useMemo(() => {
    return repo_breakdown.filter((r) => r.closed_count > 0);
  }, [repo_breakdown]);

  // Recent PR spotlights by lifecycle
  const recentAllPRs = useMemo(() => {
    const list = tabPRs.all.length > 0 ? tabPRs.all : prs;
    return list.slice(0, 5);
  }, [tabPRs.all, prs]);

  const recentMergedPRs = useMemo(() => {
    const mergedList = tabPRs.merged.length > 0 
      ? tabPRs.merged 
      : prs.filter((p) => p.status === 'merged');
    return mergedList.slice(0, 5);
  }, [tabPRs.merged, prs]);

  const recentOpenPRs = useMemo(() => {
    const openList = tabPRs.open.length > 0 
      ? tabPRs.open 
      : prs.filter((p) => p.status === 'open');
    return openList.slice(0, 5);
  }, [tabPRs.open, prs]);

  const recentClosedPRs = useMemo(() => {
    const closedList = tabPRs.closed.length > 0 
      ? tabPRs.closed 
      : prs.filter((p) => p.status === 'closed');
    return closedList.slice(0, 5);
  }, [tabPRs.closed, prs]);

  // Filter PRs by current active tab, search query, and repo filter
  const currentTabItems = tabPRs[activeTab] || [];
  const filteredPRs = useMemo(() => {
    return currentTabItems.filter((pr) => {
      // 1. Repo filter match
      if (selectedRepoFilter !== 'all') {
        const cleanFilter = selectedRepoFilter.toLowerCase();
        const cleanRepo = (pr.repo_name || pr.repository || '').toLowerCase();
        if (cleanRepo !== cleanFilter) return false;
      }

      // 2. Search query match (title, repo, or #number)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchTitle = (pr.title || '').toLowerCase().includes(query);
        const matchRepo = (pr.repo_name || pr.repository || '').toLowerCase().includes(query);
        const matchNumber = String(pr.number).includes(query);
        if (!matchTitle && !matchRepo && !matchNumber) return false;
      }

      return true;
    });
  }, [currentTabItems, selectedRepoFilter, searchTerm]);

  // Distinct repositories list for filter dropdown
  const allRepoNames = useMemo(() => {
    return Array.from(new Set(repo_breakdown.map((r) => r.repo_name))).sort();
  }, [repo_breakdown]);


  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* 1. Developer Profile Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            {user.avatar_url ? (
              <img 
                src={user.avatar_url} 
                alt={user.login} 
                className="w-16 h-16 rounded-2xl border-2 border-white shadow-md object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xl">
                {user.login.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  {user.name || user.login}
                </h1>
                <span className="text-sm font-mono text-slate-500">@{user.login}</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Developer Preview
                </span>
              </div>
              {user.bio && (
                <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                  {user.bio}
                </p>
              )}
              <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                <span><strong>{user.public_repos}</strong> public repos</span>
                <span>&bull;</span>
                <span><strong>{stats.total_prs}</strong> pull requests analyzed</span>
                <span>&bull;</span>
                <a 
                  href={user.html_url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-blue-600 hover:text-blue-700 inline-flex items-center space-x-1 font-medium transition-colors"
                >
                  <span>View on GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2.5 self-stretch md:self-auto justify-end">
            <button
              onClick={onSwitchDeveloper}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-all shadow-sm cursor-pointer"
            >
              Switch Developer
            </button>
            <button
              onClick={onExitPreview}
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit Preview</span>
            </button>
          </div>
        </div>

        {/* Data separation disclaimer notice */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Public GitHub PR analytics view. Data is fetched directly from GitHub Search API and remains separate from webhook-monitored repositories.</span>
          </div>
          {stats.is_incomplete && (
            <span className="text-amber-600 font-medium">Note: GitHub Search returned partial results due to API limits.</span>
          )}
        </div>
      </div>

      {/* 2. PR Analytics Metric Cards (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Merged PRs */}
        <div 
          onClick={() => {
            setActiveTab('merged');
            setAnalyticsView('merged');
          }}
          className={`bg-white rounded-2xl border p-5 shadow-sm transition-all cursor-pointer ${
            activeTab === 'merged' ? 'border-purple-500 ring-2 ring-purple-100 shadow-md' : 'border-slate-200/80 hover:border-purple-300'
          }`}
          title="Click to view Merged Pull Requests"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Merged PRs</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
              <GitMerge className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
              {stats.merged_count}
            </div>
            <p className="text-xs text-purple-700 font-medium mt-1">Successfully merged code</p>
          </div>
        </div>

        {/* Card 2: Open PRs */}
        <div 
          onClick={() => {
            setActiveTab('open');
            setAnalyticsView('open');
          }}
          className={`bg-white rounded-2xl border p-5 shadow-sm transition-all cursor-pointer ${
            activeTab === 'open' ? 'border-emerald-500 ring-2 ring-emerald-100 shadow-md' : 'border-slate-200/80 hover:border-emerald-300'
          }`}
          title="Click to view Active Open Pull Requests"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Open PRs</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <GitPullRequest className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
              {stats.open_count}
            </div>
            <p className="text-xs text-emerald-700 font-medium mt-1">Currently active or under review</p>
          </div>
        </div>

        {/* Card 3: Closed (Unmerged) */}
        <div 
          onClick={() => {
            setActiveTab('closed');
            setAnalyticsView('closed');
          }}
          className={`bg-white rounded-2xl border p-5 shadow-sm transition-all cursor-pointer ${
            activeTab === 'closed' ? 'border-rose-500 ring-2 ring-rose-100 shadow-md' : 'border-slate-200/80 hover:border-rose-300'
          }`}
          title="Click to view Closed Unmerged Pull Requests"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Closed (Unmerged)</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <GitPullRequestClosed className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
              {stats.closed_unmerged_count}
            </div>
            <p className="text-xs text-rose-700 font-medium mt-1">Closed without merge</p>
          </div>
        </div>

        {/* Card 4: Total Pull Requests */}
        <div 
          onClick={() => {
            setActiveTab('all');
            setAnalyticsView('all');
          }}
          className={`bg-white rounded-2xl border p-5 shadow-sm transition-all cursor-pointer ${
            activeTab === 'all' ? 'border-blue-500 ring-2 ring-blue-100 shadow-md' : 'border-slate-200/80 hover:border-blue-300'
          }`}
          title="Click to view All Pull Requests"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Pull Requests</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <GitBranch className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
              {stats.total_prs}
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {stats.merge_rate} merge rate
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Across {stats.total_repos_count} repositories</p>
        </div>
      </div>

      {/* 3. Pull Request Contribution Analytics Section (Interactive All, Merged, Open, Closed Breakdown) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              {analyticsView === 'all' && (
                <>
                  <GitBranch className="w-4 h-4 text-blue-600" />
                  <span>All Pull Requests Analytics</span>
                </>
              )}
              {analyticsView === 'merged' && (
                <>
                  <GitMerge className="w-4 h-4 text-purple-600" />
                  <span>Merged PR Analytics</span>
                </>
              )}
              {analyticsView === 'open' && (
                <>
                  <GitPullRequest className="w-4 h-4 text-emerald-600" />
                  <span>Active Open PR Analytics</span>
                </>
              )}
              {analyticsView === 'closed' && (
                <>
                  <GitPullRequestClosed className="w-4 h-4 text-rose-600" />
                  <span>Closed (Unmerged) PR Analytics</span>
                </>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {analyticsView === 'all' &&
                `Complete public pull request contribution history across all ${stats.total_repos_count} open-source repositories.`}
              {analyticsView === 'merged' &&
                'Production contributions that successfully passed code review and merged into open-source codebases.'}
              {analyticsView === 'open' &&
                'Active pull requests currently under code review or awaiting maintainer review across open-source codebases.'}
              {analyticsView === 'closed' &&
                'Pull requests closed without merge (e.g. superseded branches, alternative proposals, or archived ideas).'}
            </p>
          </div>

          {/* 4-way Switcher: All, Merged, Open, Closed */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100/90 rounded-xl self-start lg:self-auto border border-slate-200/60">
            <button
              type="button"
              onClick={() => {
                setAnalyticsView('all');
                setActiveTab('all');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer ${
                analyticsView === 'all'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5 text-blue-600" />
              <span>All ({stats.total_prs})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAnalyticsView('merged');
                setActiveTab('merged');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer ${
                analyticsView === 'merged'
                  ? 'bg-white text-purple-700 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitMerge className="w-3.5 h-3.5 text-purple-600" />
              <span>Merged ({stats.merged_count})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAnalyticsView('open');
                setActiveTab('open');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer ${
                analyticsView === 'open'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitPullRequest className="w-3.5 h-3.5 text-emerald-600" />
              <span>Open ({stats.open_count})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAnalyticsView('closed');
                setActiveTab('closed');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer ${
                analyticsView === 'closed'
                  ? 'bg-white text-rose-700 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitPullRequestClosed className="w-3.5 h-3.5 text-rose-600" />
              <span>Closed ({stats.closed_unmerged_count})</span>
            </button>
          </div>
        </div>

        {/* Repository Distribution row */}
        <div className="py-4">
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              {analyticsView === 'all' && 'All PR Distribution by Repository'}
              {analyticsView === 'merged' && 'Merged PR Distribution by Repository'}
              {analyticsView === 'open' && 'Active Open PR Distribution by Repository'}
              {analyticsView === 'closed' && 'Closed PR Distribution by Repository'}
            </div>
            <span className="text-[11px] text-slate-500">
              {analyticsView === 'all' && `${allRepos.length} repos contributed to`}
              {analyticsView === 'merged' && `${mergedRepos.length} repos with merged PRs`}
              {analyticsView === 'open' && `${openRepos.length} repos with active open PRs`}
              {analyticsView === 'closed' && `${closedRepos.length} repos with closed PRs`}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* View: All */}
            {analyticsView === 'all' && (
              allRepos.length === 0 ? (
                <span className="text-xs text-slate-400 italic">No repositories found.</span>
              ) : (
                allRepos.map((r) => (
                  <button
                    key={r.repo_name}
                    onClick={() => {
                      setSelectedRepoFilter(r.repo_name);
                      setActiveTab('all');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center space-x-1.5 cursor-pointer ${
                      selectedRepoFilter === r.repo_name
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-blue-50/50 hover:bg-blue-100/60 text-blue-800 border-blue-200/70'
                    }`}
                  >
                    <FolderGit2 className="w-3.5 h-3.5" />
                    <span>{r.repo_name}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      selectedRepoFilter === r.repo_name ? 'bg-blue-700 text-white' : 'bg-blue-200/60 text-blue-900'
                    }`}>
                      {r.total_count}
                    </span>
                  </button>
                ))
              )
            )}

            {/* View: Merged */}
            {analyticsView === 'merged' && (
              mergedRepos.length === 0 ? (
                <span className="text-xs text-slate-400 italic">No merged pull requests found yet.</span>
              ) : (
                mergedRepos.map((r) => (
                  <button
                    key={r.repo_name}
                    onClick={() => {
                      setSelectedRepoFilter(r.repo_name);
                      setActiveTab('merged');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center space-x-1.5 cursor-pointer ${
                      selectedRepoFilter === r.repo_name
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-purple-50/50 hover:bg-purple-100/60 text-purple-800 border-purple-200/70'
                    }`}
                  >
                    <FolderGit2 className="w-3.5 h-3.5" />
                    <span>{r.repo_name}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      selectedRepoFilter === r.repo_name ? 'bg-purple-700 text-white' : 'bg-purple-200/60 text-purple-900'
                    }`}>
                      {r.merged_count}
                    </span>
                  </button>
                ))
              )
            )}

            {/* View: Open */}
            {analyticsView === 'open' && (
              openRepos.length === 0 ? (
                <span className="text-xs text-slate-400 italic">No open pull requests currently.</span>
              ) : (
                openRepos.map((r) => (
                  <button
                    key={r.repo_name}
                    onClick={() => {
                      setSelectedRepoFilter(r.repo_name);
                      setActiveTab('open');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center space-x-1.5 cursor-pointer ${
                      selectedRepoFilter === r.repo_name
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-emerald-50/50 hover:bg-emerald-100/60 text-emerald-800 border-emerald-200/70'
                    }`}
                  >
                    <FolderGit2 className="w-3.5 h-3.5" />
                    <span>{r.repo_name}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      selectedRepoFilter === r.repo_name ? 'bg-emerald-700 text-white' : 'bg-emerald-200/60 text-emerald-900'
                    }`}>
                      {r.open_count}
                    </span>
                  </button>
                ))
              )
            )}

            {/* View: Closed */}
            {analyticsView === 'closed' && (
              closedRepos.length === 0 ? (
                <span className="text-xs text-slate-400 italic">No closed unmerged pull requests found.</span>
              ) : (
                closedRepos.map((r) => (
                  <button
                    key={r.repo_name}
                    onClick={() => {
                      setSelectedRepoFilter(r.repo_name);
                      setActiveTab('closed');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center space-x-1.5 cursor-pointer ${
                      selectedRepoFilter === r.repo_name
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-rose-50/50 hover:bg-rose-100/60 text-rose-800 border-rose-200/70'
                    }`}
                  >
                    <FolderGit2 className="w-3.5 h-3.5" />
                    <span>{r.repo_name}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      selectedRepoFilter === r.repo_name ? 'bg-rose-700 text-white' : 'bg-rose-200/60 text-rose-900'
                    }`}>
                      {r.closed_count}
                    </span>
                  </button>
                ))
              )
            )}
          </div>
        </div>

        {/* Recent pull requests list by selected lifecycle view */}
        {analyticsView === 'all' && recentAllPRs.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
              Recent Pull Requests (All)
            </div>
            <div className="space-y-2">
              {recentAllPRs.map((pr) => {
                const isMerged = pr.status === 'merged';
                const isOpen = pr.status === 'open';
                return (
                  <div 
                    key={pr.id}
                    className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/70 hover:border-slate-300 transition-all flex items-center justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isMerged
                            ? 'bg-purple-100 text-purple-700'
                            : isOpen
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}>
                          {isMerged ? 'Merged' : isOpen ? 'Open' : 'Closed'}
                        </span>
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {pr.title}
                        </span>
                        <span className="text-xs font-mono text-slate-500 font-medium">#{pr.number}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-2">
                        <span className="font-medium text-slate-700">{pr.repo_name}</span>
                        <span>&bull;</span>
                        <span>Updated on {new Date(pr.updated_at || pr.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedDispatchPR(pr)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:text-white bg-purple-50 hover:bg-purple-600 rounded-lg transition-all border border-purple-200/80 cursor-pointer shadow-2xs"
                        title="Generate AI reflection and send email for this pull request"
                      >
                        <Mail className="w-3 h-3" />
                        <span>Send Email</span>
                      </button>
                      <a
                        href={pr.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
                      >
                        <span>View PR</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {analyticsView === 'merged' && recentMergedPRs.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
              Recent Merged Pull Requests
            </div>
            <div className="space-y-2">
              {recentMergedPRs.map((pr) => (
                <div 
                  key={pr.id}
                  className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/70 hover:border-slate-300 transition-all flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {pr.title}
                      </span>
                      <span className="text-xs font-mono text-purple-700 font-medium">#{pr.number}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-2">
                      <span className="font-medium text-slate-700">{pr.repo_name}</span>
                      <span>&bull;</span>
                      {(pr.merged_at || pr.closed_at) && (
                        <span>Merged on {new Date(pr.merged_at || pr.closed_at || '').toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedDispatchPR(pr)}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:text-white bg-purple-50 hover:bg-purple-600 rounded-lg transition-all border border-purple-200/80 cursor-pointer shadow-2xs"
                      title="Generate AI reflection and send email for this pull request"
                    >
                      <Mail className="w-3 h-3" />
                      <span>Send Email</span>
                    </button>
                    <a
                      href={pr.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
                    >
                      <span>View PR</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {analyticsView === 'open' && recentOpenPRs.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
              Recent Active Open Pull Requests
            </div>
            <div className="space-y-2">
              {recentOpenPRs.map((pr) => (
                <div 
                  key={pr.id}
                  className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/70 hover:border-slate-300 transition-all flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {pr.title}
                      </span>
                      <span className="text-xs font-mono text-emerald-700 font-medium">#{pr.number}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-2">
                      <span className="font-medium text-slate-700">{pr.repo_name}</span>
                      <span>&bull;</span>
                      <span>Opened on {new Date(pr.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedDispatchPR(pr)}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:text-white bg-purple-50 hover:bg-purple-600 rounded-lg transition-all border border-purple-200/80 cursor-pointer shadow-2xs"
                      title="Generate AI reflection and send email for this pull request"
                    >
                      <Mail className="w-3 h-3" />
                      <span>Send Email</span>
                    </button>
                    <a
                      href={pr.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
                    >
                      <span>View PR</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {analyticsView === 'closed' && recentClosedPRs.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
              Recent Closed (Unmerged) Pull Requests
            </div>
            <div className="space-y-2">
              {recentClosedPRs.map((pr) => (
                <div 
                  key={pr.id}
                  className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/70 hover:border-slate-300 transition-all flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {pr.title}
                      </span>
                      <span className="text-xs font-mono text-rose-700 font-medium">#{pr.number}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-2">
                      <span className="font-medium text-slate-700">{pr.repo_name}</span>
                      <span>&bull;</span>
                      {pr.closed_at && (
                        <span>Closed on {new Date(pr.closed_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedDispatchPR(pr)}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:text-white bg-purple-50 hover:bg-purple-600 rounded-lg transition-all border border-purple-200/80 cursor-pointer shadow-2xs"
                      title="Generate AI reflection and send email for this pull request"
                    >
                      <Mail className="w-3 h-3" />
                      <span>Send Email</span>
                    </button>
                    <a
                      href={pr.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
                    >
                      <span>View PR</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>


      {/* 4. Contributions by Repository Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <FolderGit2 className="w-4 h-4 text-blue-600" />
              <span>Contributions by Repository</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any repository row to filter the pull-request list below.
            </p>
          </div>

          {selectedRepoFilter !== 'all' && (
            <button
              onClick={() => setSelectedRepoFilter('all')}
              className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100/70 rounded-xl transition-colors border border-blue-200 self-start sm:self-auto"
            >
              <span>Filtering by: {selectedRepoFilter}</span>
              <X className="w-3.5 h-3.5 ml-1" />
            </button>
          )}
        </div>

        {/* Repository Table / Cards */}
        <div className="mt-4 overflow-x-auto">
          {repo_breakdown.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No repository contributions found for @{user.login}.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-3">Repository</th>
                  <th className="py-3 px-3 text-center">Merged</th>
                  <th className="py-3 px-3 text-center">Open</th>
                  <th className="py-3 px-3 text-center">Closed</th>
                  <th className="py-3 px-3 text-center">Total PRs</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {repo_breakdown.map((r) => {
                  const isSelected = selectedRepoFilter === r.repo_name;
                  return (
                    <tr
                      key={r.repo_name}
                      onClick={() => setSelectedRepoFilter(isSelected ? 'all' : r.repo_name)}
                      className={`cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-blue-50/70 font-medium' 
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3 px-3 font-medium text-slate-900 flex items-center space-x-2">
                        <FolderGit2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-xs">{r.repo_name}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full font-bold text-[10px] bg-purple-50 text-purple-700 border border-purple-200">
                          {r.merged_count}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {r.open_count}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full font-bold text-[10px] bg-rose-50 text-rose-700 border border-rose-200">
                          {r.closed_count}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-800">
                        {r.total_count}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={`text-[11px] font-medium ${
                          isSelected ? 'text-blue-700 font-semibold' : 'text-slate-400'
                        }`}>
                          {isSelected ? 'Filtered' : 'Filter PRs'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 5. Interactive Open Source & PRs Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        {/* Section Header with 3 Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <GitPullRequest className="w-4 h-4 text-emerald-600" />
              <span>Open Source &amp; PRs</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Explore individual pull requests across lifecycle states.
            </p>
          </div>

          {/* 4 State Tabs: All, Merged, Open, Closed */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100/80 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => {
                setActiveTab('all');
                setAnalyticsView('all');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5 text-blue-600" />
              <span>All ({stats.total_prs})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('merged');
                setAnalyticsView('merged');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'merged'
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitMerge className="w-3.5 h-3.5 text-purple-600" />
              <span>Merged ({stats.merged_count})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('open');
                setAnalyticsView('open');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'open'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitPullRequest className="w-3.5 h-3.5 text-emerald-600" />
              <span>Open ({stats.open_count})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('closed');
                setAnalyticsView('closed');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'closed'
                  ? 'bg-white text-rose-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitPullRequestClosed className="w-3.5 h-3.5 text-rose-600" />
              <span>Closed ({stats.closed_unmerged_count})</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Controls */}
        <div className="py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title or repository..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Repository Dropdown Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-medium text-slate-500">Repository:</span>
            <select
              value={selectedRepoFilter}
              onChange={(e) => setSelectedRepoFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 max-w-[200px]"
            >
              <option value="all">All Repositories</option>
              {allRepoNames.map((repo) => (
                <option key={repo} value={repo}>{repo}</option>
              ))}
            </select>
          </div>
        </div>

        {/* PR List Items */}
        <div className="mt-4 space-y-3">
          {/* Loading State */}
          {tabLoading[activeTab] ? (
            <div className="py-8 space-y-3">
              <div className="flex items-center justify-center space-x-2 text-xs text-slate-500 font-medium mb-3">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>Loading {activeTab} pull requests...</span>
              </div>
              <div className="p-4 rounded-xl border border-slate-200/60 bg-slate-50/50 animate-pulse space-y-2">
                <div className="h-4 bg-slate-200/70 rounded w-2/3"></div>
                <div className="h-3 bg-slate-200/50 rounded w-1/3"></div>
              </div>
              <div className="p-4 rounded-xl border border-slate-200/60 bg-slate-50/50 animate-pulse space-y-2">
                <div className="h-4 bg-slate-200/70 rounded w-1/2"></div>
                <div className="h-3 bg-slate-200/50 rounded w-1/4"></div>
              </div>
              <div className="p-4 rounded-xl border border-slate-200/60 bg-slate-50/50 animate-pulse space-y-2">
                <div className="h-4 bg-slate-200/70 rounded w-3/4"></div>
                <div className="h-3 bg-slate-200/50 rounded w-1/3"></div>
              </div>
            </div>
          ) : tabErrors[activeTab] ? (
            /* API Error State with Diagnostics & Retry */
            <div className="py-8 px-4 text-center bg-rose-50/50 rounded-xl border border-rose-200/80 my-2">
              <AlertCircle className="w-6 h-6 text-rose-500 mx-auto mb-2" />
              <h3 className="text-xs font-semibold text-rose-800">Unable to load pull requests</h3>
              <p className="text-[11px] text-rose-600 mt-1 max-w-md mx-auto">{tabErrors[activeTab]}</p>
              <button
                onClick={() => loadTabPRs(activeTab, true)}
                className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : currentTabItems.length > 0 && filteredPRs.length === 0 ? (
            /* No Filter Matches State */
            <div className="py-12 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Filter className="w-5 h-5 text-slate-400 mx-auto mb-2" />
              <p className="text-xs text-slate-700 font-medium">No pull requests match your filters.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Try clearing the search query or repository selection.</p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedRepoFilter('all');
                }}
                className="mt-3 inline-flex items-center space-x-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Filters</span>
              </button>
            </div>
          ) : currentTabItems.length === 0 ? (
            /* Success with Zero Results */
            <div className="py-12 text-center bg-slate-50/30 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-500 font-medium">
                {activeTab === 'all' && 'No pull requests found.'}
                {activeTab === 'merged' && 'No merged pull requests found.'}
                {activeTab === 'open' && 'No open pull requests currently.'}
                {activeTab === 'closed' && 'No closed unmerged pull requests found.'}
              </p>
            </div>
          ) : (
            /* Success with Results */
            <>
              {/* Partial Results Banner if API limited */}
              {(stats.is_incomplete || (
                (activeTab === 'all'
                  ? stats.total_prs
                  : activeTab === 'merged'
                  ? stats.merged_count
                  : activeTab === 'open'
                  ? stats.open_count
                  : stats.closed_unmerged_count) > currentTabItems.length
              )) && (
                <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/70 text-[11px] text-amber-800 flex items-center justify-between">
                  <span>
                    Displaying {currentTabItems.length} of {
                      activeTab === 'all'
                        ? stats.total_prs
                        : activeTab === 'merged'
                        ? stats.merged_count
                        : activeTab === 'open'
                        ? stats.open_count
                        : stats.closed_unmerged_count
                    } {activeTab === 'all' ? 'total' : activeTab} pull requests.
                  </span>
                  <button
                    onClick={() => loadTabPRs(activeTab, true)}
                    className="text-amber-800 font-semibold hover:underline flex items-center space-x-1 ml-2 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Sync</span>
                  </button>
                </div>
              )}

              {filteredPRs.map((pr) => {
                const isMerged = pr.status === 'merged';
                const isOpen = pr.status === 'open';

                return (
                  <div
                    key={pr.id}
                    className="p-4 rounded-xl border border-slate-200/80 hover:border-slate-300 hover:shadow-sm transition-all bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Lifecycle Status Pill: Merged (Purple), Open (Green), Closed (Muted Red) */}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isMerged
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : isOpen
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {isMerged ? 'Merged' : isOpen ? 'Open' : 'Closed Unmerged'}
                        </span>

                        {/* Clickable PR Title */}
                        <a
                          href={pr.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-xs text-slate-900 hover:text-blue-600 line-clamp-1 transition-colors"
                          title={pr.title}
                        >
                          {pr.title}
                        </a>

                        {/* Monospace PR Number */}
                        <span className="text-xs font-mono text-slate-400 font-medium">
                          #{pr.number}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        {/* Target Repository badge */}
                        <button
                          type="button"
                          onClick={() => setSelectedRepoFilter(pr.repo_name)}
                          className="font-medium text-slate-700 hover:text-blue-600 flex items-center space-x-1 transition-colors cursor-pointer"
                          title={`Filter by ${pr.repo_name}`}
                        >
                          <FolderGit2 className="w-3 h-3 text-slate-400" />
                          <span>{pr.repo_name}</span>
                        </button>

                        <span>&bull;</span>

                        {/* Timestamp */}
                        {isMerged && (pr.merged_at || pr.closed_at) && (
                          <span>Merged {new Date(pr.merged_at || pr.closed_at || '').toLocaleDateString()}</span>
                        )}

                        {isOpen && (
                          <span>Opened {new Date(pr.created_at).toLocaleDateString()}</span>
                        )}

                        {!isMerged && !isOpen && (pr.closed_at || pr.updated_at) && (
                          <span>Closed {new Date(pr.closed_at || pr.updated_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons: Send Reflection Email + GitHub */}
                    <div className="flex items-center space-x-2 shrink-0 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setSelectedDispatchPR(pr)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-600 hover:text-white transition-all border border-purple-200/80 cursor-pointer shadow-2xs"
                        title="Generate AI reflection and send email for this pull request"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Send Reflection Email</span>
                      </button>

                      <a
                        href={pr.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-xl transition-colors"
                      >
                        <span>View on GitHub</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* AI Reflection & Email Dispatch Modal */}
      <DispatchReflectionModal
        pr={selectedDispatchPR}
        isOpen={selectedDispatchPR !== null}
        onClose={() => setSelectedDispatchPR(null)}
      />
    </div>
  );
};

