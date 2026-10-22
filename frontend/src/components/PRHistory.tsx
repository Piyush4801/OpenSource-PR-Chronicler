import React from 'react';
import { Search, Filter, GitPullRequest, Mail, CheckCircle2, AlertCircle, Github } from '../icons';
import { PRReflectionRecord } from '../types';

interface PRHistoryProps {
  reflections: PRReflectionRecord[];
  repositories: string[];
  onSelectReflection: (reflection: PRReflectionRecord) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  repoFilter: string;
  setRepoFilter: (repo: string) => void;
}

export const PRHistory: React.FC<PRHistoryProps> = ({
  reflections,
  repositories,
  onSelectReflection,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  repoFilter,
  setRepoFilter
}) => {
  // Apply filtering
  const filteredReflections = reflections.filter((ref) => {
    if (repoFilter && ref.repo_name.toLowerCase() !== repoFilter.toLowerCase()) {
      return false;
    }
    if (statusFilter && ref.processing_status !== statusFilter) {
      return false;
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchTitle = ref.pr_title.toLowerCase().includes(term);
      const matchRepo = ref.repo_name.toLowerCase().includes(term);
      const matchAuthor = ref.pr_author.toLowerCase().includes(term);
      const matchNumber = String(ref.pr_number).includes(term);
      return matchTitle || matchRepo || matchAuthor || matchNumber;
    }
    return true;
  });

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm flex flex-col">
      {/* Header and Filter Controls */}
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row gap-3 md:items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 tracking-tight">PR Contribution History</h2>
          <p className="text-xs text-slate-400 mt-0.5">Complete record of merged pull requests and AI reflection summaries</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by repo, title, PR #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Repository Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-xl text-xs">
            <Github className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={repoFilter}
              onChange={(e) => setRepoFilter(e.target.value)}
              className="bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer pr-1"
            >
              <option value="">All Repositories</option>
              {repositories.map((repo) => (
                <option key={repo} value={repo}>
                  {repo}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-xl text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer pr-1"
            >
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* PR Table / Stream */}
      {filteredReflections.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-400 mb-3">
            <GitPullRequest className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">No pull requests found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
            Try adjusting your search query, repository filter, or status criteria.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {filteredReflections.map((ref) => {
            const isSent = ref.email_status === 'sent';
            const isSkipped = ref.email_status === 'skipped_unconfigured';

            return (
              <div
                key={ref.id}
                onClick={() => onSelectReflection(ref)}
                className="p-5 hover:bg-slate-50/70 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
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
                      <span className="text-[11px] text-slate-400">
                        • {new Date(ref.merged_at).toLocaleDateString()}
                      </span>
                    )}
                    {ref.linked_issues && ref.linked_issues.length > 0 && (
                      <div className="flex items-center space-x-1">
                        {ref.linked_issues.map((issue, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          >
                            {issue}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {ref.pr_title}
                  </h3>

                  <p className="text-xs text-slate-500 line-clamp-1 leading-relaxed">
                    {ref.issue_details || ref.execution_summary || 'Reflection generated and dispatched.'}
                  </p>
                </div>

                <div className="flex items-center space-x-2.5 shrink-0">
                  <span className="inline-flex items-center space-x-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Completed</span>
                  </span>

                  <span
                    className={`inline-flex items-center space-x-1 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                      isSent
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : isSkipped
                        ? 'bg-slate-100 text-slate-600 border-slate-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    <Mail className="w-3 h-3" />
                    <span>{isSent ? 'Emailed' : isSkipped ? 'Email Skipped' : 'Email Failed'}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
