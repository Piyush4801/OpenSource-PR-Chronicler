import React, { useState, useEffect } from 'react';
import { X, User, RefreshCw, AlertCircle, Search, ChevronRight, Github } from '../icons';
import { fetchDeveloperPreview } from '../api';
import { DeveloperPreviewResponse } from '../types';

interface DeveloperPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDeveloper: (data: DeveloperPreviewResponse) => void;
}

export const DeveloperPreviewModal: React.FC<DeveloperPreviewModalProps> = ({
  isOpen,
  onClose,
  onSelectDeveloper,
}) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInput('');
      setError(null);
      setLoading(false);
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

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Please enter a GitHub username or profile URL.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchDeveloperPreview(trimmed);
      onSelectDeveloper(data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to fetch developer analytics. Please check the username.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between bg-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Preview GitHub Developer</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect public pull-request contributions, repository distribution, and portfolio metrics.
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

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="dev-input" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                GitHub Username or Profile URL
              </label>
              <div className="relative rounded-xl shadow-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="dev-input"
                  type="text"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. Piyush4801 or https://github.com/Piyush4801"
                  disabled={loading}
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 text-sm text-slate-900 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono transition-all placeholder:text-slate-400 disabled:opacity-60"
                />
              </div>

              {/* Quick Try Chips */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                <span className="text-slate-400">Quick try:</span>
                <button
                  type="button"
                  onClick={() => {
                    setInput('Piyush4801');
                    setError(null);
                  }}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition-colors"
                >
                  Piyush4801
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInput('https://github.com/Piyush4801');
                    setError(null);
                  }}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition-colors"
                >
                  https://github.com/Piyush4801
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInput('tiangolo');
                    setError(null);
                  }}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition-colors"
                >
                  tiangolo
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

            {/* Information Notice */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 space-y-1 leading-relaxed">
              <div className="font-semibold text-slate-800 flex items-center space-x-1.5">
                <Github className="w-3.5 h-3.5 text-slate-700" />
                <span>Developer Preview Mode</span>
              </div>
              <p className="text-slate-500 text-[11px]">
                Analyzes live public pull requests (merged, open, and closed-unmerged) using GitHub REST Search API. Does not require webhooks or repository admin privileges.
              </p>
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
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex items-center space-x-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing PR History...</span>
                </>
              ) : (
                <>
                  <span>Load Developer Analytics</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
