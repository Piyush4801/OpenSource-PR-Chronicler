import React, { useState } from 'react';
import { X, ExternalLink, Copy, Check, Code2, BookOpen, Lightbulb } from '../icons';
import { PRReflectionRecord } from '../types';

interface ReflectionModalProps {
  reflection: PRReflectionRecord | null;
  onClose: () => void;
}

export const ReflectionModal: React.FC<ReflectionModalProps> = ({ reflection, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!reflection) return null;

  const handleCopy = () => {
    const textToCopy = `[OS-Log] PR Reflection: ${reflection.repo_name} (#${reflection.pr_number})
Title: ${reflection.pr_title}
URL: ${reflection.pr_url}

1. ISSUE DETAILS
${reflection.issue_details}

2. EXECUTION SUMMARY
${reflection.execution_summary}

3. KEY LEARNINGS
${reflection.key_learnings.map((k, i) => `${i + 1}. ${k}`).join('\n')}
`;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Top Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200/60">
                {reflection.repo_name}
              </span>
              <span className="text-xs font-medium text-slate-500">
                PR #{reflection.pr_number}
              </span>
              <span className="text-xs text-slate-400">
                by @{reflection.pr_author}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              {reflection.pr_title}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 ml-4">
            <button
              onClick={handleCopy}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
              title="Copy structured reflection text"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
            <a
              href={reflection.pr_url}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors"
              title="Open Pull Request on GitHub"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Technical Metadata Bar */}
        <div className="px-6 py-2.5 bg-slate-100/70 border-b border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span>
              <strong>Diff Size:</strong> {reflection.diff_char_count.toLocaleString()} chars
            </span>
            <span>
              <strong>Duration:</strong> {(reflection.duration_ms / 1000).toFixed(1)}s
            </span>
            {reflection.linked_issues && reflection.linked_issues.length > 0 && (
              <span>
                <strong>Linked Issues:</strong>{' '}
                <span className="text-blue-600">{reflection.linked_issues.join(', ')}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                reflection.email_status === 'sent'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              Email: {reflection.email_status}
            </span>
          </div>
        </div>

        {/* Reflection 3 Mandatory Sections */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          
          {/* Section 1: Issue Details */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center justify-center h-5 w-5 rounded bg-indigo-50 text-indigo-600 text-xs font-bold">
                1
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                Issue Details &amp; Root Cause
              </h3>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {reflection.issue_details || 'No issue details recorded.'}
            </div>
          </div>

          {/* Section 2: Execution Summary */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center justify-center h-5 w-5 rounded bg-blue-50 text-blue-600 text-xs font-bold">
                2
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Code2 className="h-3.5 w-3.5 text-blue-600" />
                Execution Summary &amp; Implementation Details
              </h3>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {reflection.execution_summary || 'No execution summary recorded.'}
            </div>
          </div>

          {/* Section 3: Key Learnings */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center justify-center h-5 w-5 rounded bg-amber-50 text-amber-700 text-xs font-bold">
                3
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-amber-600" />
                Key Engineering Learnings
              </h3>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
              <ul className="space-y-2.5">
                {reflection.key_learnings.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Delivery ID: <span className="font-mono text-slate-600">{reflection.delivery_id}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1.5"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy Reflection'}
            </button>
            <a
              href={reflection.pr_url}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-medium text-white flex items-center gap-1.5 shadow-xs"
            >
              Inspect on GitHub
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

      </div>
    </div>
  );
};
