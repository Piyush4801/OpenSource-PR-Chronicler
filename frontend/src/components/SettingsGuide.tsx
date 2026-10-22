import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Send, Key, Webhook, Mail } from '../icons';
import { SettingsStatus } from '../types';
import { sendTestEmail } from '../api';

interface SettingsGuideProps {
  settings: SettingsStatus | null;
  onRefresh: () => void;
}

export const SettingsGuide: React.FC<SettingsGuideProps> = ({ settings, onRefresh }) => {
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestEmail = async () => {
    setTestEmailLoading(true);
    setTestResult(null);
    try {
      const res = await sendTestEmail();
      setTestResult({ success: true, message: res.message });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Email delivery failed' });
    } finally {
      setTestEmailLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Overview Banner */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              System Configuration &amp; Deployment Guide
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Inspect environment health, verify credentials, and review step-by-step setup instructions
              for GitHub webhooks, Gemini Flash, and SMTP delivery.
            </p>
          </div>
          <button
            onClick={onRefresh}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200/60 transition-colors"
          >
            Refresh Status
          </button>
        </div>

        {/* Configuration Health Grid */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          {/* Gemini AI */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start gap-3">
            <div className={`p-2 rounded-lg shrink-0 ${settings?.gemini_configured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              <Key className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-900">Google Gemini</span>
                {settings?.gemini_configured ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Model: <span className="font-mono text-slate-700">{settings?.gemini_model || 'gemini-1.5-flash'}</span>
              </p>
              <span className={`inline-block mt-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${settings?.gemini_configured ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                {settings?.gemini_configured ? 'API Key Active' : 'Fallback Generator Mode'}
              </span>
            </div>
          </div>

          {/* GitHub Webhook & Token */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start gap-3">
            <div className={`p-2 rounded-lg shrink-0 ${settings?.github_webhook_secret_configured ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
              <Webhook className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-900">GitHub Integration</span>
                {settings?.github_webhook_secret_configured ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                HMAC SHA-256: {settings?.github_webhook_secret_configured ? 'Enforced' : 'Unrestricted'}
              </p>
              <span className={`inline-block mt-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${settings?.github_token_configured ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                {settings?.github_token_configured ? 'PAT Configured' : 'Public API Mode'}
              </span>
            </div>
          </div>

          {/* SMTP Email */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start gap-3">
            <div className={`p-2 rounded-lg shrink-0 ${settings?.smtp_configured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-900">SMTP Dispatcher</span>
                {settings?.smtp_configured ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Host: {settings?.smtp_host}:{settings?.smtp_port}
              </p>
              <span className={`inline-block mt-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${settings?.smtp_configured ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                {settings?.smtp_configured ? 'SMTP Ready' : 'Credentials Missing'}
              </span>
            </div>
          </div>

        </div>

        {/* Email Test Trigger */}
        <div className="mt-6 pt-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-semibold text-slate-800">Verify Outbound Email Delivery</h4>
            <p className="text-xs text-slate-500">
              Target recipient: <span className="font-mono text-slate-700">{settings?.recipient_email || 'Not configured in RECIPIENT_EMAIL'}</span>
            </p>
          </div>
          <button
            onClick={handleTestEmail}
            disabled={testEmailLoading || !settings?.smtp_configured}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
            {testEmailLoading ? 'Sending Test...' : 'Send Test Reflection Email'}
          </button>
        </div>

        {testResult && (
          <div className={`mt-4 p-3 rounded-lg text-xs ${testResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            {testResult.message}
          </div>
        )}
      </div>

      {/* Detailed Setup Guide */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Step 1: GitHub Webhook Setup */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">1</span>
            <h3 className="text-sm font-semibold text-slate-900">GitHub Webhook Configuration</h3>
          </div>
          <ol className="space-y-3 text-xs text-slate-600 list-decimal list-inside leading-relaxed">
            <li>
              Navigate to your GitHub repository <span className="font-mono text-slate-800">Settings &rarr; Webhooks &rarr; Add webhook</span>.
            </li>
            <li>
              Set <strong>Payload URL</strong> to:
              <div className="mt-1 bg-slate-100 font-mono p-2 rounded text-[11px] text-slate-800 break-all select-all">
                https://&lt;your-ngrok-or-domain&gt;/webhook/github
              </div>
            </li>
            <li>
              Set <strong>Content type</strong> to <span className="font-mono text-blue-600 font-semibold">application/json</span>.
            </li>
            <li>
              Enter your <span className="font-mono text-slate-800">GITHUB_WEBHOOK_SECRET</span> in the Secret field.
            </li>
            <li>
              Under <em>Which events would you like to trigger this webhook?</em>, select:
              <div className="mt-1 pl-4 text-slate-700">
                &bull; <strong>Let me select individual events &rarr; Pull requests</strong>
              </div>
            </li>
            <li>
              Click <strong>Add webhook</strong> to activate the listener.
            </li>
          </ol>
        </div>

        {/* Step 2: Live Ngrok Tunneling */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">2</span>
            <h3 className="text-sm font-semibold text-slate-900">Local Testing via Ngrok Tunnel</h3>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Forward live GitHub webhooks to your local FastAPI server running on port 8000:
          </p>
          <div className="bg-slate-950 text-slate-100 p-3.5 rounded-lg font-mono text-[11px] space-y-1">
            <div className="text-slate-400"># 1. Start the FastAPI backend server</div>
            <div>./venv/bin/uvicorn backend.app.main:app --port 8000</div>
            <div className="text-slate-400 pt-2"># 2. In another terminal, launch ngrok</div>
            <div>ngrok http 8000</div>
            <div className="text-slate-400 pt-2"># 3. Copy forwarding HTTPS URL into GitHub webhook</div>
            <div className="text-emerald-400">https://xyz.ngrok-free.app/webhook/github</div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            Target processing time: under 15 seconds end-to-end from PR merge to email inbox!
          </p>
        </div>

      </div>

    </div>
  );
};
