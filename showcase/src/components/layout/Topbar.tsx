import React, { useState } from 'react';
import { 
  Menu, 
  RotateCcw, 
  Github, 
  Check, 
  Layers, 
  GitBranch, 
  Cpu, 
  ShieldAlert, 
  Activity, 
  Network, 
  Award,
  LayoutDashboard
} from 'lucide-react';
import { useShowcase } from '../../context/ShowcaseContext';
import { ActiveView } from '../../types';

const VIEW_TITLES: Record<ActiveView, { title: string; subtitle: string; icon: React.ElementType }> = {
  overview: {
    title: 'Platform Overview & Telemetry',
    subtitle: 'System health, real-time throughput, and asynchronous workflow execution metrics',
    icon: LayoutDashboard
  },
  apis: {
    title: 'API Management & WSO2 Gateway',
    subtitle: 'Catalog registration, lifecycle state machine, and WSO2 APIM Gateway proxy endpoints',
    icon: Layers
  },
  workflows: {
    title: 'Workflow Orchestration Definitions',
    subtitle: 'Configured distributed workflows, execution triggers, and payload dispatchers',
    icon: GitBranch
  },
  jobs: {
    title: 'Distributed Job Execution Engine',
    subtitle: 'Finite-state machine tracking, attempt diagnostics, and execution audit history',
    icon: Cpu
  },
  reliability: {
    title: 'Reliability & Fault-Tolerance Sandbox',
    subtitle: 'Interactive demonstrations: Idempotency, Transactional Outbox, Delayed Retries, DLQ & Redis Locking',
    icon: ShieldAlert
  },
  observability: {
    title: 'Observability & Metrics Dashboard',
    subtitle: 'Prometheus metric counters, Grafana telemetry graphs, and queue depth monitors',
    icon: Activity
  },
  architecture: {
    title: 'Full-Stack System Architecture',
    subtitle: 'Component topology, network routing, storage boundaries, and protocol specifications',
    icon: Network
  },
  evidence: {
    title: 'Engineering Evidence & Verification Matrix',
    subtitle: '141 automated tests, Testcontainers suites, K8s manifests, and direct source code links',
    icon: Award
  }
};

export const Topbar: React.FC<{ onToggleSidebar: () => void }> = ({ onToggleSidebar }) => {
  const { activeView, resetDemoData, currentSimulatingJobId } = useShowcase();
  const [resetDone, setResetDone] = useState(false);

  const viewMeta = VIEW_TITLES[activeView] || VIEW_TITLES.overview;
  const ViewIcon = viewMeta.icon;

  const handleReset = () => {
    resetDemoData();
    setResetDone(true);
    setTimeout(() => setResetDone(false), 2000);
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 lg:hidden cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-700 hidden sm:flex items-center justify-center">
            <ViewIcon className="w-4 h-4 text-forge-teal" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              {viewMeta.title}
              {currentSimulatingJobId && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1.5 font-normal">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping"></span>
                  Processing {currentSimulatingJobId.substring(0, 8)}...
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500 hidden sm:block truncate max-w-md lg:max-w-xl">
              {viewMeta.subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Reset Demo Button */}
        <button
          onClick={handleReset}
          className={`
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer
            ${resetDone 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 shadow-sm'}
          `}
          title="Reset demo data to initial realistic seed state"
        >
          {resetDone ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <RotateCcw className="w-3.5 h-3.5 text-slate-500" />}
          <span className="hidden sm:inline">{resetDone ? 'Demo Reset' : 'Reset Demo'}</span>
        </button>

        {/* GitHub link */}
        <a
          href="https://github.com/Sajini3655/Flowforge"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm"
        >
          <Github className="w-3.5 h-3.5" />
          <span className="hidden md:inline">View Source</span>
        </a>
      </div>
    </header>
  );
};
