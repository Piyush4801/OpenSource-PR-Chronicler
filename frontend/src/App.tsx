import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { StatsOverview } from './components/StatsOverview';
import { PRHistory } from './components/PRHistory';
import { ReflectionModal } from './components/ReflectionModal';
import { SettingsGuide } from './components/SettingsGuide';
import { SimulationPanel } from './components/SimulationPanel';
import { LiveLogsModal } from './components/LiveLogsModal';
import { AddRepoModal } from './components/AddRepoModal';
import { WebhookSetupModal } from './components/WebhookSetupModal';
import { RemoveRepoModal } from './components/RemoveRepoModal';
import { DeveloperPreviewModal } from './components/DeveloperPreviewModal';
import { DeveloperPortfolioView } from './components/DeveloperPortfolioView';
import { Toast, ToastMessage } from './components/Toast';
import { DashboardStats, PRReflectionRecord, SettingsStatus, TrackedRepository, DeveloperPreviewResponse } from './types';
import { fetchStats, fetchReflections, fetchSettingsStatus, fetchTrackedRepositories } from './api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'settings' | 'developer'>('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reflections, setReflections] = useState<PRReflectionRecord[]>([]);
  const [repositories, setRepositories] = useState<TrackedRepository[]>([]);
  const [settingsStatus, setSettingsStatus] = useState<SettingsStatus | null>(null);
  const [selectedReflection, setSelectedReflection] = useState<PRReflectionRecord | null>(null);
  
  // Developer Preview state
  const [developerPreviewModalOpen, setDeveloperPreviewModalOpen] = useState(false);
  const [previewDeveloper, setPreviewDeveloper] = useState<DeveloperPreviewResponse | null>(null);
  
  // Modals
  const [logsOpen, setLogsOpen] = useState(false);
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [simulateTargetRepo, setSimulateTargetRepo] = useState<string | undefined>(undefined);
  const [addRepoOpen, setAddRepoOpen] = useState(false);
  const [webhookSetupRepo, setWebhookSetupRepo] = useState<TrackedRepository | null>(null);
  const [removeRepoTarget, setRemoveRepoTarget] = useState<TrackedRepository | null>(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [repoFilter, setRepoFilter] = useState('');

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', title: string, description?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const loadData = async () => {
    try {
      const [statsData, refData, reposData, settingsData] = await Promise.all([
        fetchStats(),
        fetchReflections(searchTerm, statusFilter),
        fetchTrackedRepositories(),
        fetchSettingsStatus(),
      ]);
      setStats(statsData);
      setReflections(refData);
      setRepositories(reposData);
      setSettingsStatus(settingsData);
    } catch (err) {
      console.error('Error loading chronicler data:', err);
    }
  };

  useEffect(() => {
    loadData();
    // Poll every 5 seconds for incoming webhook events
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [searchTerm, statusFilter]);

  // Handle successful repo addition
  const handleAddRepoSuccess = (newRepo: TrackedRepository) => {
    setRepositories((prev) => [newRepo, ...prev.filter((r) => r.id !== newRepo.id)]);
    setAddRepoOpen(false);
    addToast(
      'success',
      'Repository Added Successfully',
      `Connected ${newRepo.repo_name}. Open webhook settings to install the GitHub hook.`
    );
    // Immediately open the webhook instructions modal for the newly added repo
    setWebhookSetupRepo(newRepo);
    loadData();
  };

  // Handle successful batch repo addition from user profile
  const handleBatchAddSuccess = (newRepos: TrackedRepository[]) => {
    if (newRepos.length === 0) return;
    setAddRepoOpen(false);
    if (newRepos.length === 1) {
      handleAddRepoSuccess(newRepos[0]);
      return;
    }
    const ids = new Set(newRepos.map((r) => r.id));
    setRepositories((prev) => [...newRepos, ...prev.filter((r) => !ids.has(r.id))]);
    addToast(
      'success',
      'Repositories Added Successfully',
      `Connected ${newRepos.length} repositories from profile. Webhook setup required to receive live events.`
    );
    // Open webhook instructions for the first added repo
    setWebhookSetupRepo(newRepos[0]);
    loadData();
  };

  // Handle repository removal
  const handleRemoveRepoSuccess = (repoId: number) => {
    setRepositories((prev) => prev.filter((r) => r.id !== repoId));
    addToast(
      'info',
      'Repository Removed',
      'Repository untracked. All historical PR reflections are safely preserved.'
    );
    loadData();
  };

  // Handle developer preview selection
  const handleSelectDeveloper = (data: DeveloperPreviewResponse) => {
    setPreviewDeveloper(data);
    setActiveTab('developer');
    addToast(
      'success',
      'Developer Preview Loaded',
      `Analyzed public PR contribution history for @${data.user.login}.`
    );
  };

  // Handle exiting developer preview mode
  const handleExitPreview = () => {
    setPreviewDeveloper(null);
    if (activeTab === 'developer') {
      setActiveTab('dashboard');
    }
    addToast(
      'info',
      'Exited Preview',
      'Restored dashboard view and application branding.'
    );
  };

  // Handle filtering PR reflections by repository
  const handleFilterContributionsByRepo = (repoName: string) => {
    setRepoFilter(repoName);
    setActiveTab('history');
  };


  // Extract distinct repo names for filter dropdown
  const allRepoNames = Array.from(
    new Set([
      ...repositories.map((r) => r.repo_name),
      ...reflections.map((r) => r.repo_name),
    ])
  ).filter(Boolean);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A] font-sans antialiased selection:bg-blue-500 selection:text-white">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenLogs={() => setLogsOpen(true)}
        onOpenSimulate={() => {
          setSimulateTargetRepo(undefined);
          setSimulateOpen(true);
        }}
        onOpenDeveloperPreviewModal={() => setDeveloperPreviewModalOpen(true)}
        previewUser={previewDeveloper?.user || null}
        onExitPreview={handleExitPreview}
        lastProcessingTime={stats?.last_processing_time || null}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Developer Portfolio Preview Tab */}
        {activeTab === 'developer' && previewDeveloper && (
          <DeveloperPortfolioView
            data={previewDeveloper}
            onExitPreview={handleExitPreview}
            onSwitchDeveloper={() => setDeveloperPreviewModalOpen(true)}
          />
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <StatsOverview
            stats={stats}
            repositories={repositories}
            onSelectReflection={(r) => setSelectedReflection(r)}
            onViewAllHistory={() => setActiveTab('history')}
            onOpenAddRepoModal={() => setAddRepoOpen(true)}
            onOpenDeveloperPreview={() => setDeveloperPreviewModalOpen(true)}
            onOpenWebhookSetup={(r) => setWebhookSetupRepo(r)}
            onOpenRemoveConfirm={(r) => setRemoveRepoTarget(r)}
            onFilterContributionsByRepo={handleFilterContributionsByRepo}
          />
        )}

        {/* PR History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <PRHistory
              reflections={reflections}
              repositories={allRepoNames}
              onSelectReflection={(r) => setSelectedReflection(r)}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              repoFilter={repoFilter}
              setRepoFilter={setRepoFilter}
            />
          </div>
        )}

        {/* Setup Guide / Settings Tab */}
        {activeTab === 'settings' && (
          <SettingsGuide
            settings={settingsStatus}
            onRefresh={loadData}
          />
        )}
      </main>

      {/* Modals & Dialogs */}
      <ReflectionModal
        reflection={selectedReflection}
        onClose={() => setSelectedReflection(null)}
      />

      <DeveloperPreviewModal
        isOpen={developerPreviewModalOpen}
        onClose={() => setDeveloperPreviewModalOpen(false)}
        onSelectDeveloper={handleSelectDeveloper}
      />

      <AddRepoModal
        isOpen={addRepoOpen}
        onClose={() => setAddRepoOpen(false)}
        onSuccess={handleAddRepoSuccess}
        onBatchSuccess={handleBatchAddSuccess}
      />

      <WebhookSetupModal
        isOpen={webhookSetupRepo !== null}
        repo={webhookSetupRepo}
        onClose={() => setWebhookSetupRepo(null)}
        onOpenSimulator={(repoName) => {
          setSimulateTargetRepo(repoName);
          setSimulateOpen(true);
        }}
      />

      <RemoveRepoModal
        isOpen={removeRepoTarget !== null}
        repo={removeRepoTarget}
        onClose={() => setRemoveRepoTarget(null)}
        onSuccess={handleRemoveRepoSuccess}
      />

      <SimulationPanel
        isOpen={simulateOpen}
        onClose={() => {
          setSimulateOpen(false);
          setSimulateTargetRepo(undefined);
        }}
        onSuccess={() => {
          loadData();
          setSimulateOpen(false);
          setSimulateTargetRepo(undefined);
          addToast('success', 'Simulation Dispatched', 'Webhook payload sent and processed by chronicler.');
        }}
      />

      <LiveLogsModal
        isOpen={logsOpen}
        onClose={() => setLogsOpen(false)}
      />

      {/* Floating Toast Notifications */}
      <Toast toasts={toasts} onDismiss={removeToast} />

      {/* Footer */}
      <footer className="border-t border-slate-200/80 py-6 text-center text-xs text-slate-400 bg-white/60">
        OpenSource PR Chronicler &bull; Designed with Apple, Linear, and GitHub aesthetic &bull; Built with FastAPI, LangChain, and Gemini Flash.
      </footer>
    </div>
  );
};

export default App;
