import React from 'react';
import { 
  LayoutDashboard, 
  Layers, 
  GitBranch, 
  Cpu, 
  ShieldAlert, 
  Activity, 
  Network, 
  Award,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { useShowcase } from '../../context/ShowcaseContext';
import { ActiveView } from '../../types';

interface NavItem {
  id: ActiveView;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
  highlight?: boolean;
}

export const Sidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { activeView, setActiveView, stats, currentSimulatingJobId } = useShowcase();

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'apis', label: 'API Management', icon: Layers, badge: stats.totalApis },
    { id: 'workflows', label: 'Workflows', icon: GitBranch, badge: stats.activeWorkflows },
    { id: 'jobs', label: 'Job Executions', icon: Cpu, badge: stats.totalJobs, highlight: Boolean(currentSimulatingJobId) },
    { id: 'reliability', label: 'Reliability & Recovery', icon: ShieldAlert, badge: 'Sandbox' },
    { id: 'observability', label: 'Observability & Metrics', icon: Activity, badge: 'Live' },
    { id: 'architecture', label: 'System Architecture', icon: Network },
    { id: 'evidence', label: 'Engineering Evidence', icon: Award, badge: '141 Tests' },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed top-0 bottom-0 left-0 z-40 w-64 bg-navy-950 text-slate-300 border-r border-navy-800/80 flex flex-col transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-navy-800/80 bg-navy-950">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-forge-teal to-teal-400 flex items-center justify-center text-white font-bold shadow-md shadow-teal-500/20">
              FF
            </div>
            <div>
              <div className="text-white font-semibold text-sm tracking-wide flex items-center gap-1.5">
                FLOWFORGE
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-navy-800 text-teal-400 font-normal">v1.0</span>
              </div>
              <div className="text-[10.5px] text-slate-400 font-mono">API & Distributed Engine</div>
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
            Platform Modules
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveView(item.id);
                  onClose();
                }}
                className={`
                  w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group cursor-pointer
                  ${isActive 
                    ? 'bg-forge-teal text-white shadow-sm shadow-teal-900/30 font-semibold' 
                    : 'text-slate-300 hover:bg-navy-900 hover:text-white'}
                `}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-teal-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className={`
                    text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium
                    ${isActive 
                      ? 'bg-navy-950/40 text-white' 
                      : item.highlight
                        ? 'bg-teal-500/20 text-teal-300 animate-pulse'
                        : 'bg-navy-800 text-slate-400'}
                  `}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Infrastructure health block */}
        <div className="p-3 mx-3 mb-3 rounded-xl bg-navy-900/90 border border-navy-800 text-xs space-y-2">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono flex items-center justify-between">
            <span>Stack Verification</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              ALL UP
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono text-slate-300">
            <div className="flex items-center gap-1.5 py-1 px-1.5 rounded bg-navy-950/60 border border-navy-800">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate">Postgres 16</span>
            </div>
            <div className="flex items-center gap-1.5 py-1 px-1.5 rounded bg-navy-950/60 border border-navy-800">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate">RabbitMQ 3.13</span>
            </div>
            <div className="flex items-center gap-1.5 py-1 px-1.5 rounded bg-navy-950/60 border border-navy-800">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate">Redis 7.4</span>
            </div>
            <div className="flex items-center gap-1.5 py-1 px-1.5 rounded bg-navy-950/60 border border-navy-800">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate">WSO2 4.7.0</span>
            </div>
          </div>
        </div>

        {/* Footer Credit & Links */}
        <div className="p-3 border-t border-navy-800/80 bg-navy-950 text-slate-400 text-[11px] flex items-center justify-between">
          <div>
            <div className="text-slate-200 font-medium truncate">Sajini S.</div>
            <div className="text-[10px] text-slate-400">Univ. of Moratuwa (IT)</div>
          </div>
          <a
            href="https://github.com/Sajini3655/Flowforge"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-slate-300 hover:text-white transition-colors"
            title="GitHub Repository"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </aside>
    </>
  );
};
