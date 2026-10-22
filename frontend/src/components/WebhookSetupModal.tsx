import React, { useState, useEffect } from 'react';
import { X, Copy, Check, ExternalLink, Webhook, CheckCircle2, AlertTriangle, ShieldCheck } from '../icons';
import { fetchRepoWebhookInfo } from '../api';
import { TrackedRepository, WebhookGuideInfo } from '../types';

interface WebhookSetupModalProps {
  isOpen: boolean;
  repo: TrackedRepository | null;
  onClose: () => void;
  onOpenSimulator?: (repoName: string) => void;
}

export const WebhookSetupModal: React.FC<WebhookSetupModalProps> = ({
  isOpen,
  repo,
  onClose,
  onOpenSimulator
}) => {
  const [guide, setGuide] = useState<WebhookGuideInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    if (isOpen && repo) {
      setLoading(true);
      fetchRepoWebhookInfo(repo.id)
        .then(setGuide)
        .catch(() => {
          // Fallback guide if endpoint times out
          setGuide({
            repo_name: repo.repo_name,
            webhook_url: `${window.location.origin}/webhook/github`,
            content_type: 'application/json',
            secret_configured: false,
            events_required: ['Pull requests'],
            status: repo.webhook_status,
            instructions: `1. Open https://github.com/${repo.repo_name}/settings/hooks/new\n2. Set Payload URL to ${window.location.origin}/webhook/github\n3. Select Content type: application/json\n4. Select 'Pull requests' under individual events.\n5. Click 'Add webhook'.`,
            user_has_admin_note: 'Admin permissions on the GitHub repository are required to configure webhooks.'
          });
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, repo]);

  if (!isOpen || !repo) return null;

  const webhookUrl = guide?.webhook_url || `${window.location.origin}/webhook/github`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const isWebhookActive = repo.webhook_status === 'active';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm ${
              isWebhookActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
            }`}>
              <Webhook className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-semibold text-slate-900 tracking-tight">GitHub Webhook Setup</h2>
                <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${
                  isWebhookActive 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {isWebhookActive ? 'Active' : 'Setup Required'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{repo.repo_name}</p>
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

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Status Explanation */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-800">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>Repository Connected Successfully</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This repository is persistently tracked. However, GitHub needs a webhook to deliver merge notifications to your chronicler endpoint.
            </p>
          </div>

          {/* Webhook Payload URL Box */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">
              1. Webhook Payload URL
            </label>
            <div className="flex items-center space-x-2">
              <div className="flex-1 px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 select-all overflow-x-auto truncate">
                {webhookUrl}
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(webhookUrl)}
                className="px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-medium flex items-center space-x-1.5 shadow-sm transition-all"
                title="Copy webhook payload URL"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              If deploying locally behind a firewall, use an ngrok tunnel (e.g. <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">https://xxxx.ngrok-free.app/webhook/github</code>).
            </p>
          </div>

          {/* Configuration Parameters Grid */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">
              2. Webhook Settings on GitHub
            </label>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Content type</span>
                <span className="font-mono text-slate-800 font-medium">application/json</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Trigger Events</span>
                <span className="font-medium text-slate-800">Pull requests (Closed/Merged)</span>
              </div>
            </div>
          </div>

          {/* Step-by-Step Instructions */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">
              3. Quick Configuration Steps
            </label>
            <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside bg-slate-50/50 p-3.5 rounded-xl border border-slate-200/80 leading-relaxed">
              <li>Open GitHub Webhook Settings for this repository.</li>
              <li>Paste the <span className="font-mono font-medium text-slate-800">Payload URL</span> shown above.</li>
              <li>Change <span className="font-medium text-slate-800">Content type</span> to <code className="bg-slate-200/60 px-1 rounded">application/json</code>.</li>
              <li>Under event triggers, choose <span className="font-medium text-slate-800">Let me select individual events</span> and check <span className="font-semibold text-blue-600">Pull requests</span>.</li>
              <li>Click <span className="font-semibold text-slate-900">Add webhook</span>. Status will turn to <span className="text-emerald-600 font-semibold">Active</span> upon the first delivered event.</li>
            </ol>
          </div>

          {/* Admin Rights Advisory */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-start space-x-3 text-xs text-amber-900 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-950">Don't own this repository? </span>
              Installing webhooks on GitHub requires Admin or Maintainer privileges. If you are contributing to an external open-source project without admin permissions, you can dispatch and verify reflections using our built-in simulator!
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
          <a
            href={`https://github.com/${repo.repo_name}/settings/hooks/new`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            <span>Open GitHub Settings</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <div className="flex items-center space-x-2">
            {onOpenSimulator && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSimulator(repo.repo_name);
                }}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-sm"
              >
                Test via Simulator
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
