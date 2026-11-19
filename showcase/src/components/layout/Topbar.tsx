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
    title: 'Platform Overview',
    subtitle: 'Simulated workflow metrics, state distribution, and recent execution events',
    icon: LayoutDashboard
  },
  apis: {
    title: 'API Management',
    subtitle: 'WSO2 Gateway service catalog, lifecycle state transitions, and upstream targets',
    icon: Layers
  },
  workflows: {
    title: 'Workflows',
    subtitle: 'Configured distributed workflows and execution trigger parameters',
    icon: GitBranch
  },
  jobs: {
    title: 'Job Executions',
    subtitle: 'Finite-state machine tracking, attempt diagnostics, and execution audit history',
    icon: Cpu
  },
  reliability: {
    title: 'Reliability & Fault Tolerance',
    subtitle: 'Simulated Idempotency, Transactional Outbox, Delayed Retries, DLQ, and Redis Locks',
    icon: ShieldAlert
  },
  observability: {
    title: 'Observability & Metrics',
    subtitle: 'Simulated Micrometer metric counters and Prometheus /actuator/prometheus output',
    icon: Activity
  },
  architecture: {
    title: 'System Architecture',
    subtitle: 'Component topology, network routing boundaries, and protocol specifications',
    icon: Network
  },
  evidence: {
    title: 'Engineering Evidence',
    subtitle: 'Automated test suite matrix, Testcontainers suites, and Kubernetes manifests',
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
    <header className="h-14 bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 lg:hidden cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded bg-slate-100 text-slate-700 hidden sm:flex items-center justify-center">
            <ViewIcon className="w-4 h-4 text-slate-700" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              {viewMeta.title}
              {currentSimulatingJobId && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-normal">
                  Simulating: {currentSimulatingJobId.substring(0, 8)}...
                </span>
              )}
            </h1>
            <p className="text-[11px] text-slate-500 hidden sm:block truncate max-w-md lg:max-w-xl">
              {viewMeta.subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
          title="Reset all demo data back to initial seed state"
        >
          {resetDone ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700 font-medium">Reset</span>
            </>
          ) : (
            <>
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset State</span>
            </>
          )}
        </button>

        <a
          href="https://github.com/Sajini3655/Flowforge"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <Github className="w-3.5 h-3.5" />
          <span>Source</span>
        </a>
      </div>
    </header>
  );
};
