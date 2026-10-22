import React from 'react';
import { 
  GitPullRequest, 
  Mail, 
  AlertTriangle, 
  FolderGit2, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Clock,
  Radio,
  Key,
  ShieldCheck,
  Github
} from '../icons';
import { DashboardStats, PRReflectionRecord, TrackedRepository } from '../types';
import { TrackedReposPanel } from './TrackedReposPanel';

interface StatsOverviewProps {
  stats: DashboardStats | null;
  repositories: TrackedRepository[];
  onSelectReflection: (reflection: PRReflectionRecord) => void;
  onViewAllHistory: () => void;
  onOpenAddRepoModal: () => void;
  onOpenDeveloperPreview?: () => void;
  onOpenWebhookSetup: (repo: TrackedRepository) => void;
  onOpenRemoveConfirm: (repo: TrackedRepository) => void;
  onFilterContributionsByRepo: (repoName: string) => void;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  stats,
  repositories,
  onSelectReflection,
  onViewAllHistory,
  onOpenAddRepoModal,
  onOpenDeveloperPreview,
  onOpenWebhookSetup,
  onOpenRemoveConfirm,
  onFilterContributionsByRepo
}) => {
  if (!stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-slate-200/60 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-200/60 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-slate-200/60 rounded-2xl" />
          <div className="h-96 bg-slate-200/60 rounded-2xl" />
        </div>
      </div>
    );
  }

  // Calculate real metrics
  const statCards = [
    {
      label: 'Merged PRs Processed',
      value: stats.total_processed_merged,
      icon: GitPullRequest,
      desc: 'Validated via GitHub Webhook',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-100/80',
    },
    {
      label: 'Emailed Reflections',
      value: stats.successfully_emailed,
      icon: Mail,
      desc: 'Dispatched via SMTP & TLS',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100/80',
    },
    {
      label: 'Failed Attempts',
      value: stats.failed_attempts,
      icon: AlertTriangle,
      desc: 'Exceptions or network errors',
      color: stats.failed_attempts > 0 ? 'text-amber-600' : 'text-slate-400',
      bg: stats.failed_attempts > 0 ? 'bg-amber-50' : 'bg-slate-50',
      border: stats.failed_attempts > 0 ? 'border-amber-100/80' : 'border-slate-100/80',
    },
    {
      label: 'Repositories Tracked',
      value: repositories.length > 0 ? repositories.length : stats.unique_repos_count,
      icon: FolderGit2,
      desc: 'Unique open-source projects',
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      border: 'border-indigo-100/80',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Dashboard Welcome Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-navy-900 to-slate-900 p-6 sm:p-8 text-white shadow-sm border border-slate-800">
        {/* Soft Blue Ambient Glow */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
              <span>Event-Driven AI Reflection Dispatcher</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Your open-source journey, documented.
            </h1>
            <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed font-normal">
              Turn every merged pull request into meaningful engineering knowledge.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              type="button"
              onClick={onOpenAddRepoModal}
              className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl shadow-sm transition-all"
            >
              <span>+ Add Repository</span>
            </button>
            <button
              type="button"
              onClick={onViewAllHistory}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
            >
              <span>PR History</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Four Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  {card.label}
                </span>
                <div className={`p-2 rounded-xl ${card.bg} ${card.color} border ${card.border}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 mb-1">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono">
                  {card.value}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-normal">
                {card.desc}
              </p>
            </div>
          );
        })}
      </div>

      {/* 3. Main Split Grid: Recent Contributions (2 cols) + Sidebar Panels (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Recent Contributions & Reflections */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
                Recent Contributions & Reflections
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                AI structured takeaways generated from merged pull requests
              </p>
            </div>
            <button
              type="button"
              onClick={onViewAllHistory}
              className="inline-flex items-center space-x-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              <span>View All</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {stats.recent_reflections.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-3">
                <GitPullRequest className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">No PRs chronicled yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
                Connect a repository or trigger a test event using the Webhook Simulator.
              </p>
              <button
                type="button"
                onClick={onOpenAddRepoModal}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all"
              >
                + Add Repository
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100/90">
              {stats.recent_reflections.map((ref) => {
                const isSent = ref.email_status === 'sent';
                const isSkipped = ref.email_status === 'skipped_unconfigured';

                return (
                  <div
                    key={ref.id}
                    className="p-5 hover:bg-slate-50/70 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {/* Meta badges: Repo, PR#, Author, Date */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100/80">
                          {ref.repo_name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 font-medium">
                          #{ref.pr_number}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          by <span className="text-slate-600 font-medium">@{ref.pr_author}</span>
                        </span>
                        {ref.merged_at && (
                          <span className="text-[11px] text-slate-400 flex items-center space-x-1">
                            <span>•</span>
                            <span>{new Date(ref.merged_at).toLocaleDateString()}</span>
                          </span>
                        )}
                        {/* Linked Issue Badges */}
                        {ref.linked_issues && ref.linked_issues.length > 0 && (
                          <div className="flex items-center space-x-1">
                            {ref.linked_issues.map((issue, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                title="Linked GitHub Issue"
                              >
                                {issue}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Clickable PR Title */}
                      <button
                        type="button"
                        onClick={() => onSelectReflection(ref)}
                        className="text-left text-sm font-semibold text-slate-900 hover:text-blue-600 transition-colors line-clamp-1 cursor-pointer"
                        title="Click to view detailed reflection and takeaways"
                      >
                        {ref.pr_title}
                      </button>

                      {/* Issue details snippet */}
                      <p className="text-xs text-slate-500 line-clamp-1 leading-relaxed">
                        {ref.issue_details || ref.execution_summary || 'Reflection generated and stored.'}
                      </p>
                    </div>

                    {/* Right side status badges */}
                    <div className="flex items-center space-x-2.5 shrink-0">
                      {/* Processing Status Badge */}
                      <span className="inline-flex items-center space-x-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Completed</span>
                      </span>

                      {/* Email Status Badge */}
                      <span
                        className={`inline-flex items-center space-x-1 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                          isSent
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : isSkipped
                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                        title={ref.email_error || undefined}
                      >
                        <Mail className="w-3 h-3" />
                        <span>
                          {isSent ? 'Emailed' : isSkipped ? 'Email Skipped' : 'Email Failed'}
                        </span>
                      </span>

                      {/* View Details Button */}
                      <button
                        type="button"
                        onClick={() => onSelectReflection(ref)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200/80 rounded-lg shadow-2xs transition-all"
                      >
                        View
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Tracked Repositories Panel + Telemetry */}
        <div className="space-y-6">
          {/* Tracked Repositories Panel */}
          <TrackedReposPanel
            repositories={repositories}
            onOpenAddModal={onOpenAddRepoModal}
            onOpenDeveloperPreview={onOpenDeveloperPreview}
            onOpenWebhookSetup={onOpenWebhookSetup}
            onOpenRemoveConfirm={onOpenRemoveConfirm}
            onFilterContributionsByRepo={onFilterContributionsByRepo}
          />

          {/* System Telemetry Panel */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                <Radio className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                System Telemetry
              </h3>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400">Last PR Processed:</span>
                <span className="font-medium text-slate-800 font-mono text-[11px]">
                  {stats.last_processing_time
                    ? new Date(stats.last_processing_time).toLocaleTimeString()
                    : 'Awaiting event'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400">Ignored Events:</span>
                <span className="font-medium text-slate-800 font-mono text-[11px]">
                  {stats.total_ignored_events} events
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400">Pipeline Engine:</span>
                <span className="font-semibold text-blue-600 font-mono text-[11px]">
                  LangChain + Gemini Flash
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-400">Database Layer:</span>
                <span className="font-medium text-slate-700 font-mono text-[11px]">
                  SQLite Persistence
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
