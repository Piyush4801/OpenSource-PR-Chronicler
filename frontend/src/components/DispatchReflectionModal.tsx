import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Send, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Lightbulb, 
  BookOpen,
  Copy,
  Check
} from '../icons';
import { dispatchPRReflection, DispatchReflectionResult } from '../api';
import { DeveloperPRItem } from '../types';

interface DispatchReflectionModalProps {
  pr: DeveloperPRItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const DispatchReflectionModal: React.FC<DispatchReflectionModalProps> = ({
  pr,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DispatchReflectionResult | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !pr) return null;

  const repoName = pr.repo_name || pr.repository || 'unknown/repo';

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await dispatchPRReflection({
        repo_name: repoName,
        pr_number: pr.number,
        pr_title: pr.title,
        pr_url: pr.html_url,
        author: pr.author,
        merged_at: pr.merged_at || pr.closed_at,
        recipient_email: recipientEmail.trim() || undefined,
        pr_body: pr.body || '',
      });

      setResult(res);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch AI reflection');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result?.reflection) return;
    const { issue_details, execution_summary, key_learnings } = result.reflection;
    const text = [
      `PR Reflection: ${repoName} #${pr.number} - ${pr.title}`,
      `\n## What Problem Was Solved:\n${issue_details || ''}`,
      `\n## Execution Summary:\n${execution_summary || ''}`,
      `\n## Key Learnings:\n${(key_learnings || []).map((k: string) => `• ${k}`).join('\n')}`
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                <Mail className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Send AI Reflection Email
                </h3>
                <p className="text-xs text-slate-500">
                  Analyze PR diff &amp; dispatch an educational reflection email.
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* PR Target Card */}
        <div className="mt-4 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/70">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span className="font-semibold text-slate-700">{repoName}</span>
            <span className="font-mono text-purple-700 font-bold">#{pr.number}</span>
          </div>
          <div className="text-xs font-semibold text-slate-900 mt-1 line-clamp-2">
            {pr.title}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/50">
            <span>Author: <strong>@{pr.author}</strong></span>
            <a
              href={pr.html_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1 text-purple-700 hover:underline"
            >
              <span>View GitHub PR</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Results or Form */}
        {result ? (
          <div className="mt-4 space-y-4 animate-in fade-in duration-200">
            {/* Delivery Alert Banner */}
            {result.email_sent ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Success!</strong> Educational reflection email was successfully dispatched to <strong>{result.recipient || 'configured email'}</strong>.
                </span>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Reflection Generated!</strong> Note: {result.email_error || 'SMTP is not configured in environment. Configure SMTP in Setup Guide to receive actual emails.'}
                </span>
              </div>
            )}

            {/* Reflection Content Card */}
            {result.reflection && (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {/* 1. Problem Solved */}
                <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/60">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5 mb-1">
                    <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                    <span>Problem Solved &amp; Rationale</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {result.reflection.issue_details}
                  </p>
                </div>

                {/* 2. Execution Summary */}
                <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/60">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5 mb-1">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                    <span>Technical Execution Summary</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {result.reflection.execution_summary}
                  </p>
                </div>

                {/* 3. Key Learnings */}
                {result.reflection.key_learnings && result.reflection.key_learnings.length > 0 && (
                  <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200/60">
                    <div className="text-[11px] font-bold text-purple-800 uppercase tracking-wider mb-1.5">
                      Key Engineering Takeaways
                    </div>
                    <ul className="space-y-1">
                      {result.reflection.key_learnings.map((item: string, idx: number) => (
                        <li key={idx} className="text-xs text-purple-900 flex items-start space-x-2">
                          <span className="text-purple-600 font-bold">&bull;</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions when completed */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Summary'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleDispatch} className="mt-4 space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Recipient Email (Optional)
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="e.g. your-email@gmail.com (defaults to configured SMTP recipient)"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 focus:bg-white text-slate-800"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Leave blank to automatically use the default recipient configured in your Setup Guide.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing &amp; Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Generate &amp; Send Reflection</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
