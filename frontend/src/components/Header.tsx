import React from 'react';
import { 
  GitPullRequest, 
  Settings, 
  Terminal, 
  PlayCircle, 
  BarChart3, 
  Clock, 
  User, 
  LogOut, 
  Eye
} from '../icons';
import { GitHubUserProfile } from '../types';

interface HeaderProps {
  activeTab: 'dashboard' | 'history' | 'settings' | 'developer';
  setActiveTab: (tab: 'dashboard' | 'history' | 'settings' | 'developer') => void;
  onOpenLogs: () => void;
  onOpenSimulate: () => void;
  onOpenDeveloperPreviewModal: () => void;
  previewUser?: GitHubUserProfile | null;
  onExitPreview?: () => void;
  lastProcessingTime: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenLogs,
  onOpenSimulate,
  onOpenDeveloperPreviewModal,
  previewUser,
  onExitPreview,
  lastProcessingTime,
}) => {
  return (
    <header className="border-b border-slate-200/90 bg-white/90 backdrop-blur-md sticky top-0 z-30 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Product Title (Dynamic based on Preview Mode) */}
          <div className="flex items-center space-x-3">
            {previewUser ? (
              // Preview Mode Avatar & Name
              <div className="flex items-center space-x-3">
                {previewUser.avatar_url ? (
                  <img 
                    src={previewUser.avatar_url} 
                    alt={previewUser.login} 
                    className="h-10 w-10 rounded-xl border border-slate-200 shadow-sm object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                    {previewUser.login.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-900 tracking-tight text-sm sm:text-base">
                      {previewUser.name || previewUser.login}
                    </span>
                    <span className="text-[10px] font-semibold tracking-wider font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      Previewing
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono leading-none mt-0.5">
                    @{previewUser.login}
                  </p>
                </div>
              </div>
            ) : (
              // Default PR Chronicler Branding
              <div className="flex items-center space-x-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-sm shadow-blue-500/25 border border-blue-400/30">
                  <GitPullRequest className="h-4.5 w-4.5 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-900 tracking-tight text-sm sm:text-base">
                      PR Chronicler
                    </span>
                    <span className="text-[10px] font-semibold tracking-wider font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80">
                      v1.0.0
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-normal leading-none mt-0.5 hidden sm:block">
                    Automated Open-Source Learning Dispatcher
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/70 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
              <span>Dashboard</span>
            </button>

            {previewUser && (
              <button
                type="button"
                onClick={() => setActiveTab('developer')}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  activeTab === 'developer'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                <Eye className="h-3.5 w-3.5 text-purple-600" />
                <span>Dev Analytics</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              <Clock className="h-3.5 w-3.5 text-indigo-600" />
              <span>PR History</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              <Settings className="h-3.5 w-3.5 text-slate-600" />
              <span>Setup Guide</span>
            </button>
          </nav>

          {/* Right Action Buttons & Telemetry */}
          <div className="flex items-center space-x-2 sm:space-x-2.5">
            {/* Developer Preview Button / Exit Preview */}
            {previewUser ? (
              <button
                type="button"
                onClick={onExitPreview}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 transition-all cursor-pointer shadow-2xs"
                title="Exit preview and restore dashboard view"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Exit Preview</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenDeveloperPreviewModal}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 transition-all cursor-pointer shadow-2xs"
                title="Preview GitHub Developer Profile & PR Analytics"
              >
                <User className="h-3.5 w-3.5 text-slate-600" />
                <span className="hidden sm:inline">Preview Developer</span>
                <span className="sm:hidden">Preview</span>
              </button>
            )}

            {/* Simulate Webhook Trigger */}
            <button
              type="button"
              onClick={onOpenSimulate}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm hover:shadow transition-all cursor-pointer"
              title="Test PR merge webhook processing"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Simulate Webhook</span>
            </button>

            {/* Live Logs Console */}
            <button
              type="button"
              onClick={onOpenLogs}
              className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200/90 shadow-2xs transition-all cursor-pointer"
              title="Inspect pr_chronicler.log output"
            >
              <Terminal className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden md:inline">Logs</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
