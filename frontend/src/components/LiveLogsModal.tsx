import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Terminal } from '../icons';
import { fetchRecentLogs } from '../api';

interface LiveLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LiveLogsModal: React.FC<LiveLogsModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchRecentLogs(120);
      setLogs(data);
    } catch (err) {
      setLogs(['Failed to load system logs.']);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLogs();
      if (autoRefresh) {
        const interval = setInterval(loadLogs, 3000);
        return () => clearInterval(interval);
      }
    }
  }, [isOpen, autoRefresh]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-slate-950 text-slate-100 rounded-2xl max-w-4xl w-full border border-slate-800 shadow-2xl flex flex-col h-[75vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Terminal Header */}
        <div className="px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <span className="font-mono text-xs text-slate-400 pl-2 flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-blue-400" />
              pr_chronicler.log &mdash; Live Stream
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`text-[11px] px-2.5 py-1 rounded border font-mono transition-colors ${
                autoRefresh
                  ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              {autoRefresh ? '● Auto-refresh (3s)' : '○ Paused'}
            </button>
            <button
              onClick={loadLogs}
              disabled={loading}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800"
              title="Refresh logs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 ml-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Log Viewer Body */}
        <div className="flex-1 p-5 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1 bg-slate-950 select-text">
          {logs.length === 0 ? (
            <div className="text-slate-500 italic">No log entries found.</div>
          ) : (
            logs.map((line, i) => {
              const isError = line.includes('| ERROR') || line.includes('FAILED');
              const isWarning = line.includes('| WARNING');
              const isSuccess = line.includes('SUCCEEDED') || line.includes('ACCEPTED') || line.includes('COMPLETE');
              
              let colorClass = 'text-slate-300';
              if (isError) colorClass = 'text-rose-400 font-semibold';
              else if (isWarning) colorClass = 'text-amber-300';
              else if (isSuccess) colorClass = 'text-emerald-300';

              return (
                <div key={i} className={`${colorClass} hover:bg-slate-900/60 px-1 py-0.5 rounded`}>
                  {line}
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};
