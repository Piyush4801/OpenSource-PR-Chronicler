import React, { useState, useRef, useEffect } from 'react';
import { Plus, Github, ExternalLink, MoreVertical, Trash2, Webhook, Star, GitPullRequest, AlertCircle, CheckCircle2 } from '../icons';
import { TrackedRepository } from '../types';

interface TrackedReposPanelProps {
  repositories: TrackedRepository[];
  onOpenAddModal: () => void;
  onOpenDeveloperPreview?: () => void;
  onOpenWebhookSetup: (repo: TrackedRepository) => void;
  onOpenRemoveConfirm: (repo: TrackedRepository) => void;
  onFilterContributionsByRepo: (repoName: string) => void;
}

export const TrackedReposPanel: React.FC<TrackedReposPanelProps> = ({
  repositories,
  onOpenAddModal,
  onOpenDeveloperPreview,
  onOpenWebhookSetup,
  onOpenRemoveConfirm,
  onFilterContributionsByRepo
}) => {
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close 3-dot menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    if (activeMenuId !== null) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [activeMenuId]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Panel Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/60">
            <Github className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-semibold text-slate-900 tracking-tight">Tracked Repositories</h2>
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-700 rounded-full">
                {repositories.length}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Repositories monitored for merged PR reflections</p>
          </div>
        </div>

        {/* Action Buttons: Preview Developer & Add Repository */}
        <div className="flex items-center space-x-2">
          {onOpenDeveloperPreview && (
            <button
              type="button"
              onClick={onOpenDeveloperPreview}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/70 border border-slate-200/80 rounded-xl transition-all cursor-pointer shadow-2xs"
              title="Preview GitHub Developer PR Analytics"
            >
              <span>Preview Developer</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenAddModal}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-sm hover:shadow transition-all group cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 transition-transform group-hover:rotate-90 duration-200" />
            <span>Add Repository</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 flex-1 flex flex-col">
        {repositories.length === 0 ? (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center py-8 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-400 mb-3">
              <Github className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">No repositories tracked yet</h3>
            <p className="text-xs text-slate-500 max-w-xs mt-1 mb-4 leading-relaxed">
              Connect a GitHub repository to begin capturing merged pull requests and generating reflections.
            </p>
            <button
              type="button"
              onClick={onOpenAddModal}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200/60 rounded-xl transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect First Repository</span>
            </button>
          </div>
        ) : (
          /* Repository Rows List */
          <div className="space-y-2.5">
            {repositories.map((repo) => {
              const isActive = repo.webhook_status === 'active';
              const isMenuOpen = activeMenuId === repo.id;

              return (
                <div
                  key={repo.id}
                  className="p-3 bg-slate-50/70 hover:bg-slate-50 border border-slate-200/70 hover:border-slate-300 rounded-xl transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
                      <Github className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <a
                          href={repo.repo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-slate-900 hover:text-blue-600 truncate transition-colors font-mono"
                          title={repo.repo_name}
                        >
                          {repo.repo_name}
                        </a>
                        {repo.stars_count > 0 && (
                          <span className="inline-flex items-center space-x-0.5 text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200/60">
                            <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                            <span>{repo.stars_count > 1000 ? `${(repo.stars_count / 1000).toFixed(1)}k` : repo.stars_count}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 mt-1">
                        {/* Webhook Status Indicator */}
                        <button
                          type="button"
                          onClick={() => onOpenWebhookSetup(repo)}
                          className={`inline-flex items-center space-x-1 text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          }`}
                          title={isActive ? 'Webhook active and verified' : 'Click to view webhook setup instructions'}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                          <span>{isActive ? 'Webhook Active' : 'Setup Required'}</span>
                        </button>

                        {/* Contributions badge */}
                        <span className="text-[11px] text-slate-500">
                          {repo.contributions_count} {repo.contributions_count === 1 ? 'reflection' : 'reflections'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & 3-dot Menu */}
                  <div className="relative shrink-0 flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => setActiveMenuId(isMenuOpen ? null : repo.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                      title="Repository options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Dropdown Menu */}
                    {isMenuOpen && (
                      <div 
                        ref={menuRef}
                        className="absolute right-0 top-8 z-30 w-48 bg-white rounded-xl shadow-lg border border-slate-200/90 py-1.5 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100"
                      >
                        <a
                          href={repo.repo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setActiveMenuId(null)}
                          className="flex items-center space-x-2 px-3.5 py-2 hover:bg-slate-50 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                          <span>View on GitHub</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onFilterContributionsByRepo(repo.repo_name);
                          }}
                          className="w-full text-left flex items-center space-x-2 px-3.5 py-2 hover:bg-slate-50 transition-colors"
                        >
                          <GitPullRequest className="w-3.5 h-3.5 text-slate-400" />
                          <span>View Contributions</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onOpenWebhookSetup(repo);
                          }}
                          className="w-full text-left flex items-center space-x-2 px-3.5 py-2 hover:bg-slate-50 transition-colors"
                        >
                          <Webhook className="w-3.5 h-3.5 text-slate-400" />
                          <span>Webhook Setup</span>
                        </button>

                        <div className="my-1 border-t border-slate-100"></div>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onOpenRemoveConfirm(repo);
                          }}
                          className="w-full text-left flex items-center space-x-2 px-3.5 py-2 hover:bg-rose-50 text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>Remove Repository</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
