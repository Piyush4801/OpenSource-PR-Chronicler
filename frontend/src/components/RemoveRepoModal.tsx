import React, { useState } from 'react';
import { X, AlertTriangle, Trash2, RefreshCw } from '../icons';
import { removeRepository } from '../api';
import { TrackedRepository } from '../types';

interface RemoveRepoModalProps {
  isOpen: boolean;
  repo: TrackedRepository | null;
  onClose: () => void;
  onSuccess: (repoId: number) => void;
}

export const RemoveRepoModal: React.FC<RemoveRepoModalProps> = ({
  isOpen,
  repo,
  onClose,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !repo) return null;

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await removeRepository(repo.id);
      onSuccess(repo.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to remove repository.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Remove Repository?</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{repo.repo_name}</p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to stop tracking <strong className="text-slate-800">{repo.repo_name}</strong>?
          </p>

          <div className="mt-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 leading-relaxed">
            <span className="font-semibold text-slate-800">Historical Data Preserved: </span>
            Removing this repository will only stop active tracking. All historical PR reflections and learning records will remain safely saved in your contribution log.
          </div>

          {error && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}
        </div>

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
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-sm transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Removing...</span>
              </>
            ) : (
              <span>Confirm Removal</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
