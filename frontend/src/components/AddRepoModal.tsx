import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Github, 
  RefreshCw, 
  AlertCircle, 
  Search, 
  Check, 
  Star, 
  GitFork, 
  Lock, 
  Globe, 
  ExternalLink,
  ChevronRight,
  User,
  CheckCircle2
} from '../icons';
import { addRepository, inspectGitHubTarget, batchAddRepositories } from '../api';
import { TrackedRepository, GitHubInspectionResponse, InspectedRepository, GitHubUserProfile } from '../types';

interface AddRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (repo: TrackedRepository) => void;
  onBatchSuccess?: (repos: TrackedRepository[]) => void;
}

const LANGUAGE_COLORS: Record<string, string> = {
  JavaScript: 'bg-amber-400',
  TypeScript: 'bg-blue-500',
  Python: 'bg-emerald-500',
  Rust: 'bg-orange-500',
  Go: 'bg-cyan-500',
  Java: 'bg-red-500',
  'C++': 'bg-pink-500',
  C: 'bg-slate-500',
  Ruby: 'bg-rose-600',
  PHP: 'bg-indigo-400',
  HTML: 'bg-orange-600',
  CSS: 'bg-purple-500',
  Shell: 'bg-teal-500',
  Swift: 'bg-amber-600',
  Kotlin: 'bg-violet-500',
};

function detectInputType(raw: string): 'empty' | 'profile' | 'repository' {
  const cleaned = raw.trim().replace(/^https?:\/\//, '').replace(/^github\.com\//, '').replace(/\.git$/, '');
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length === 0) return 'empty';
  if (parts.length === 1) return 'profile';
  return 'repository';
}

export const AddRepoModal: React.FC<AddRepoModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  onBatchSuccess 
}) => {
  // Step 1: 'input', Step 2: 'selection' (for profile repos)
  const [step, setStep] = useState<'input' | 'selection'>('input');
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile inspection results
  const [inspectedUser, setInspectedUser] = useState<GitHubUserProfile | null>(null);
  const [inspectedRepos, setInspectedRepos] = useState<InspectedRepository[]>([]);
  const [selectedRepoUrls, setSelectedRepoUrls] = useState<Set<string>>(new Set());

  // Filter within selection modal
  const [repoSearch, setRepoSearch] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');

  useEffect(() => {
    if (isOpen) {
      setStep('input');
      setInputValue('');
      setError(null);
      setLoading(false);
      setInspectedUser(null);
      setInspectedRepos([]);
      setSelectedRepoUrls(new Set());
      setRepoSearch('');
      setSelectedLanguage('all');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const detected = detectInputType(inputValue);

  // Action: Inspect or directly add based on input
  const handleProceed = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setError('Please provide a GitHub profile URL, repository URL, or username.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const inspectRes: GitHubInspectionResponse = await inspectGitHubTarget(trimmed);

      if (inspectRes.type === 'profile') {
        // Switch to repository picker modal
        setInspectedUser(inspectRes.user);
        setInspectedRepos(inspectRes.repositories);
        // Default: none selected or un-tracked
        setSelectedRepoUrls(new Set());
        setStep('selection');
      } else {
        // Individual repository
        const singleRepo = inspectRes.repositories[0];
        if (singleRepo && singleRepo.already_tracked) {
          setError(`Repository '${singleRepo.repo_name}' is already tracked in your dashboard.`);
          setLoading(false);
          return;
        }

        // Add repository directly
        const added = await addRepository(singleRepo ? singleRepo.repo_url : trimmed);
        onSuccess(added);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to inspect GitHub target. Please check the URL and your network connection.');
    } finally {
      setLoading(false);
    }
  };

  // Direct repo addition shortcut
  const handleDirectAddRepo = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const added = await addRepository(trimmed);
      onSuccess(added);
    } catch (err: any) {
      setError(err.message || 'Failed to add repository.');
    } finally {
      setLoading(false);
    }
  };

  // Handle batch adding selected repositories
  const handleBatchAdd = async () => {
    if (selectedRepoUrls.size === 0) {
      setError('Please select at least one repository to add.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const urls = Array.from(selectedRepoUrls);
      const res = await batchAddRepositories(urls);

      if (res.added.length > 0) {
        if (onBatchSuccess) {
          onBatchSuccess(res.added);
        } else {
          onSuccess(res.added[0]);
        }
      } else if (res.already_tracked.length > 0) {
        setError(`Selected repositories are already tracked: ${res.already_tracked.join(', ')}`);
      } else {
        setError('No repositories could be added. Please verify repository availability.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to batch add repositories.');
    } finally {
      setLoading(false);
    }
  };

  // Repository selection helpers
  const toggleRepoSelection = (repoUrl: string, isAlreadyTracked: boolean) => {
    if (isAlreadyTracked) return;
    setSelectedRepoUrls((prev) => {
      const next = new Set(prev);
      if (next.has(repoUrl)) {
        next.delete(repoUrl);
      } else {
        next.add(repoUrl);
      }
      return next;
    });
  };

  // Filtered repositories inside Step 2
  const filteredRepos = useMemo(() => {
    return inspectedRepos.filter((repo) => {
      const matchesSearch = 
        repo.repo_name.toLowerCase().includes(repoSearch.toLowerCase()) ||
        (repo.description && repo.description.toLowerCase().includes(repoSearch.toLowerCase()));
      const matchesLang = selectedLanguage === 'all' || repo.language === selectedLanguage;
      return matchesSearch && matchesLang;
    });
  }, [inspectedRepos, repoSearch, selectedLanguage]);

  // List of distinct languages for filter
  const availableLanguages = useMemo(() => {
    const set = new Set<string>();
    inspectedRepos.forEach((r) => {
      if (r.language) set.add(r.language);
    });
    return Array.from(set).sort();
  }, [inspectedRepos]);

  // Available (un-tracked) repos in current filtered view
  const unTrackedFiltered = useMemo(() => {
    return filteredRepos.filter((r) => !r.already_tracked);
  }, [filteredRepos]);

  const allFilteredSelected = unTrackedFiltered.length > 0 && 
    unTrackedFiltered.every((r) => selectedRepoUrls.has(r.repo_url));

  const toggleSelectAllFiltered = () => {
    setSelectedRepoUrls((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        unTrackedFiltered.forEach((r) => next.delete(r.repo_url));
      } else {
        unTrackedFiltered.forEach((r) => next.add(r.repo_url));
      }
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className={`w-full bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden transform transition-all flex flex-col ${
          step === 'selection' ? 'max-w-3xl max-h-[90vh]' : 'max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between bg-white shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm shrink-0">
              <Github className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
                  {step === 'input' ? 'Add GitHub Repositories' : 'Select Repositories to Track'}
                </h2>
                {step === 'selection' && inspectedUser && (
                  <span className="text-xs px-2 py-0.5 font-medium rounded-full bg-blue-100 text-blue-700">
                    @{inspectedUser.login}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {step === 'input'
                  ? 'Paste a GitHub profile URL, repository URL, or username to discover and track pull requests.'
                  : `Browse public repositories for @${inspectedUser?.login || 'user'} and choose which ones to track.`}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP 1: Input / Search */}
        {step === 'input' && (
          <form onSubmit={handleProceed}>
            <div className="p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="repo-input" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    GitHub Profile or Repository
                  </label>
                  {detected !== 'empty' && (
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center space-x-1 ${
                      detected === 'profile' 
                        ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                      {detected === 'profile' ? (
                        <>
                          <User className="w-3 h-3" />
                          <span>Detected: GitHub Profile</span>
                        </>
                      ) : (
                        <>
                          <Github className="w-3 h-3" />
                          <span>Detected: GitHub Repository</span>
                        </>
                      )}
                    </span>
                  )}
                </div>

                <div className="relative rounded-xl shadow-sm">
                  <input
                    id="repo-input"
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="https://github.com/Piyush4801 or https://github.com/owner/repo"
                    disabled={loading}
                    autoFocus
                    className="w-full px-4 py-3 text-sm text-slate-900 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono transition-all placeholder:text-slate-400 disabled:opacity-60"
                  />
                </div>

                {/* Quick Examples */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="text-slate-400">Quick try:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setInputValue('https://github.com/Piyush4801');
                      setError(null);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition-colors"
                  >
                    https://github.com/Piyush4801
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputValue('Piyush4801');
                      setError(null);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition-colors"
                  >
                    Piyush4801
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputValue('astral-sh/uv');
                      setError(null);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition-colors"
                  >
                    astral-sh/uv
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3 text-xs text-rose-800 animate-in fade-in duration-100">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium leading-relaxed">{error}</div>
                </div>
              )}

              {/* Informational Guidance */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 space-y-1.5 leading-relaxed">
                <div className="font-semibold text-slate-800 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Supported GitHub URL formats:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-500 pl-1 text-[11px]">
                  <li><strong className="text-slate-700">User Profile:</strong> <code className="text-slate-700">https://github.com/username</code> or <code className="text-slate-700">username</code> (browse & select repositories)</li>
                  <li><strong className="text-slate-700">Repository:</strong> <code className="text-slate-700">https://github.com/owner/repo</code> or <code className="text-slate-700">owner/repo</code> (direct connect)</li>
                </ul>
              </div>
            </div>

            {/* Footer Controls */}
            <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              
              {detected === 'repository' && (
                <button
                  type="button"
                  onClick={handleDirectAddRepo}
                  disabled={loading || !inputValue.trim()}
                  className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
                  ) : (
                    <span>Add Directly</span>
                  )}
                </button>
              )}

              <button
                type="submit"
                disabled={loading || !inputValue.trim()}
                className="inline-flex items-center space-x-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying with GitHub...</span>
                  </>
                ) : (
                  <>
                    <span>{detected === 'profile' ? 'Browse Repositories' : 'Inspect & Add'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Profile Repositories Selection Modal */}
        {step === 'selection' && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* User Profile Card */}
            {inspectedUser && (
              <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200/70 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3.5">
                  {inspectedUser.avatar_url ? (
                    <img 
                      src={inspectedUser.avatar_url} 
                      alt={inspectedUser.login} 
                      className="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
                      {inspectedUser.login.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-slate-900">{inspectedUser.name || inspectedUser.login}</span>
                      <span className="text-xs text-slate-500 font-mono">@{inspectedUser.login}</span>
                      <a 
                        href={inspectedUser.html_url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-slate-400 hover:text-blue-600 transition-colors"
                        title="View profile on GitHub"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    {inspectedUser.bio && (
                      <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">{inspectedUser.bio}</p>
                    )}
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center space-x-3">
                      <span><strong>{inspectedRepos.length}</strong> public repositories found</span>
                      <span>&bull;</span>
                      <span className="text-blue-600 font-medium">{selectedRepoUrls.size} selected</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setStep('input');
                    setError(null);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/70 rounded-lg transition-colors border border-slate-200"
                >
                  Change Profile
                </button>
              </div>
            )}

            {/* Search and Filters Bar */}
            <div className="px-6 py-3 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white shrink-0">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  placeholder="Filter repositories by name or description..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                />
                {repoSearch && (
                  <button 
                    onClick={() => setRepoSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Language Filter */}
              {availableLanguages.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-medium text-slate-500">Language:</span>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                  >
                    <option value="all">All Languages</option>
                    {availableLanguages.map((lang) => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Select All Toggle */}
              {unTrackedFiltered.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAllFiltered}
                  className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200/60 whitespace-nowrap"
                >
                  {allFilteredSelected ? 'Deselect All' : `Select All (${unTrackedFiltered.length})`}
                </button>
              )}
            </div>

            {/* Error Message if batch fails */}
            {error && (
              <div className="mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-xs text-rose-800 shrink-0">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{error}</div>
              </div>
            )}

            {/* Repositories Scrollable List */}
            <div className="px-6 py-3 flex-1 overflow-y-auto space-y-2.5 min-h-[260px] max-h-[380px]">
              {filteredRepos.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-xs text-slate-500 font-medium">No repositories matched your filter.</p>
                  {(repoSearch || selectedLanguage !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setRepoSearch('');
                        setSelectedLanguage('all');
                      }}
                      className="mt-2 text-xs text-blue-600 hover:underline"
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              ) : (
                filteredRepos.map((repo) => {
                  const isSelected = selectedRepoUrls.has(repo.repo_url);
                  const isTracked = repo.already_tracked;
                  const langColor = repo.language ? (LANGUAGE_COLORS[repo.language] || 'bg-slate-400') : null;

                  return (
                    <div
                      key={repo.repo_name}
                      onClick={() => toggleRepoSelection(repo.repo_url, isTracked)}
                      className={`p-3.5 rounded-xl border transition-all flex items-start space-x-3.5 cursor-pointer ${
                        isTracked
                          ? 'bg-slate-50/70 border-slate-200/80 opacity-75 cursor-not-allowed'
                          : isSelected
                          ? 'bg-blue-50/50 border-blue-400 shadow-sm ring-1 ring-blue-400/30'
                          : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className="pt-0.5">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                            isTracked
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                              : isSelected
                              ? 'bg-blue-600 text-white'
                              : 'border border-slate-300 bg-white'
                          }`}
                        >
                          {(isSelected || isTracked) && <Check className="w-3 h-3 stroke-[2.5]" />}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-xs text-slate-900 truncate">
                            {repo.repo_name}
                          </span>

                          {/* Visibility badge */}
                          <span className={`inline-flex items-center space-x-1 text-[10px] font-medium px-1.5 py-0.2 rounded-full ${
                            repo.is_private 
                              ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {repo.is_private ? <Lock className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
                            <span>{repo.is_private ? 'Private' : 'Public'}</span>
                          </span>

                          {/* Fork badge */}
                          {repo.is_fork && (
                            <span className="inline-flex items-center space-x-0.5 text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-500">
                              <GitFork className="w-2.5 h-2.5" />
                              <span>Fork</span>
                            </span>
                          )}

                          {/* Already Tracked Badge */}
                          {isTracked && (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Already Tracked</span>
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        {repo.description ? (
                          <p className="text-xs text-slate-600 line-clamp-1 mt-1 leading-relaxed">
                            {repo.description}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 italic mt-0.5">No description provided</p>
                        )}

                        {/* Repo Meta Footer */}
                        <div className="mt-2 flex items-center space-x-4 text-[11px] text-slate-500">
                          {repo.language && (
                            <span className="flex items-center space-x-1.5">
                              <span className={`w-2 h-2 rounded-full ${langColor}`} />
                              <span>{repo.language}</span>
                            </span>
                          )}

                          <span className="flex items-center space-x-1">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <span>{repo.stars_count}</span>
                          </span>

                          {repo.updated_at && (
                            <span>Updated {new Date(repo.updated_at).toLocaleDateString()}</span>
                          )}

                          <a
                            href={repo.repo_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-slate-400 hover:text-blue-600 flex items-center space-x-0.5 transition-colors"
                          >
                            <span>GitHub</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selection Footer Controls */}
            <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-600">
                <span className="font-semibold text-slate-800">{selectedRepoUrls.size}</span> of {unTrackedFiltered.length} selectable repositories chosen
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setStep('input')}
                  disabled={loading}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-all disabled:opacity-50"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={handleBatchAdd}
                  disabled={loading || selectedRepoUrls.size === 0}
                  className="inline-flex items-center space-x-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Repositories...</span>
                    </>
                  ) : (
                    <span>
                      Add Selected {selectedRepoUrls.size > 0 ? `(${selectedRepoUrls.size})` : 'Repositories'}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
