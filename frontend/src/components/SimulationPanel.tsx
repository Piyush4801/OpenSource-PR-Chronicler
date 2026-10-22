import React, { useState } from 'react';
import { X, Play, RefreshCw } from '../icons';
import { sendSimulatedWebhook } from '../api';

interface SimulationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SimulationPanel: React.FC<SimulationPanelProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [scenario, setScenario] = useState<'merged' | 'unmerged' | 'opened'>('merged');
  const [repo, setRepo] = useState('astral-sh/uv');
  const [prNumber, setPrNumber] = useState<number>(1240);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  if (!isOpen) return null;

  const handleSimulate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const action = scenario === 'opened' ? 'opened' : 'closed';
      const merged = scenario === 'merged';
      const res = await sendSimulatedWebhook(action, merged, repo, prNumber);
      setResult(res);
      if (res.status === 'accepted') {
        setTimeout(onSuccess, 1000);
      }
    } catch (err: any) {
      setResult({ status: 'error', message: err.message || 'Simulation call failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Webhook Event Simulator
            </h3>
            <p className="text-xs text-slate-500">
              Trigger simulated GitHub pull_request webhooks to test pipeline behavior.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scenario Selection */}
        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Select Test Scenario
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setScenario('merged')}
                className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-all ${
                  scenario === 'merged'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-800 font-semibold ring-1 ring-blue-600'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-semibold">Case 1: Merged</div>
                <div className="text-[10px] text-slate-500">Pipeline runs</div>
              </button>
              <button
                type="button"
                onClick={() => setScenario('unmerged')}
                className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-all ${
                  scenario === 'unmerged'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-800 font-semibold ring-1 ring-blue-600'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-semibold">Case 2: Closed</div>
                <div className="text-[10px] text-slate-500">Ignored (200)</div>
              </button>
              <button
                type="button"
                onClick={() => setScenario('opened')}
                className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-all ${
                  scenario === 'opened'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-800 font-semibold ring-1 ring-blue-600'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-semibold">Case 3: Opened</div>
                <div className="text-[10px] text-slate-500">Ignored (200)</div>
              </button>
            </div>
          </div>

          {/* Repo Name */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Repository (Owner/Name)
            </label>
            <input
              type="text"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="e.g. astral-sh/uv or facebook/react"
            />
          </div>

          {/* PR Number */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Pull Request Number
            </label>
            <input
              type="number"
              value={prNumber}
              onChange={(e) => setPrNumber(parseInt(e.target.value) || 1)}
              className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Result Box */}
          {result && (
            <div
              className={`p-3 rounded-lg border text-xs font-mono ${
                result.status === 'accepted'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : result.status === 'ignored'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <div className="font-bold uppercase tracking-wider mb-1">
                Status: {result.status}
              </div>
              <div className="text-[11px] leading-relaxed break-words">{result.message}</div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSimulate}
            disabled={loading}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
          >
            {loading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {loading ? 'Dispatching...' : 'Dispatch Webhook'}
          </button>
        </div>

      </div>
    </div>
  );
};
