import React, { useState } from 'react';
import { ShowcaseProvider, useShowcase } from './context/ShowcaseContext';
import { DisclaimerBanner } from './components/layout/DisclaimerBanner';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';

import { OverviewView } from './components/views/OverviewView';
import { ApiManagementView } from './components/views/ApiManagementView';
import { WorkflowsView } from './components/views/WorkflowsView';
import { JobsView } from './components/views/JobsView';
import { ReliabilityView } from './components/views/ReliabilityView';
import { ObservabilityView } from './components/views/ObservabilityView';
import { ArchitectureView } from './components/views/ArchitectureView';
import { EvidenceView } from './components/views/EvidenceView';

const MainContent: React.FC = () => {
  const { activeView } = useShowcase();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Disclaimer & Transparency Banner */}
      <DisclaimerBanner />

      <div className="flex-1 flex">
        {/* Navigation Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main Content Area */}
        <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
          <Topbar onToggleSidebar={() => setSidebarOpen(prev => !prev)} />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-fadeIn">
            {activeView === 'overview' && <OverviewView />}
            {activeView === 'apis' && <ApiManagementView />}
            {activeView === 'workflows' && <WorkflowsView />}
            {activeView === 'jobs' && <JobsView />}
            {activeView === 'reliability' && <ReliabilityView />}
            {activeView === 'observability' && <ObservabilityView />}
            {activeView === 'architecture' && <ArchitectureView />}
            {activeView === 'evidence' && <EvidenceView />}
          </main>

          {/* Footer */}
          <footer className="px-6 py-4 border-t border-slate-200/80 bg-white text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              <span>FlowForge — API Management & Distributed Workflow Platform</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400 text-[11px]">
              <span>Spring Boot 3.5.16 • Java 21 • WSO2 APIM 4.7.0 • RabbitMQ 3.13 • Redis 7.4</span>
              <span>•</span>
              <a
                href="https://github.com/Sajini3655/Flowforge"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                GitHub Source
              </a>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ShowcaseProvider>
      <MainContent />
    </ShowcaseProvider>
  );
};

export default App;
