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
  ExternalLink
} from 'lucide-react';
import { useShowcase } from '../../context/ShowcaseContext';
import { ActiveView } from '../../types';

interface NavItem {
  id: ActiveView;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
}

export const Sidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { activeView, setActiveView, stats } = useShowcase();

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'apis', label: 'API Management', icon: Layers, badge: stats.totalApis },
    { id: 'workflows', label: 'Workflows', icon: GitBranch, badge: stats.activeWorkflows },
    { id: 'jobs', label: 'Job Executions', icon: Cpu, badge: stats.totalJobs },
    { id: 'reliability', label: 'Reliability & Recovery', icon: ShieldAlert },
    { id: 'observability', label: 'Observability & Metrics', icon: Activity },
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
        <div className="h-14 flex items-center justify-between px-5 border-b border-navy-800/80 bg-navy-950">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-slate-800 border border-slate-700/80 flex items-center justify-center text-teal-400 font-bold font-mono text-xs">
              FF
            </div>
            <div>
              <div className="text-white font-semibold text-xs tracking-wider flex items-center gap-1.5 font-mono">
                FLOWFORGE
                <span className="text-[9px] px-1 py-0.2 rounded bg-navy-800 text-slate-400 font-normal">v1.0</span>
              </div>
              <div className="text-[10px] text-slate-400 font-sans">API & Workflow Engine</div>
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
            Navigation
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
                  w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors group cursor-pointer
                  ${isActive 
                    ? 'bg-slate-800 text-white font-semibold' 
                    : 'text-slate-300 hover:bg-navy-900 hover:text-white'}
                `}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-teal-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className={`
                    text-[10px] px-1.5 py-0.2 rounded font-mono font-medium
                    ${isActive 
                      ? 'bg-slate-700 text-white' 
                      : 'bg-navy-900 text-slate-400'}
                  `}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Target Stack Architecture block */}
        <div className="p-3 mx-3 mb-3 rounded-lg bg-navy-900/70 border border-navy-800 text-xs space-y-2">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono flex items-center justify-between">
            <span>Target Architecture</span>
            <span className="text-[9px] text-slate-400 uppercase font-sans">Simulated</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono text-slate-300">
            <div className="py-0.5 px-2 rounded bg-navy-950/70 border border-navy-800/80 truncate">
              PostgreSQL 16
            </div>
            <div className="py-0.5 px-2 rounded bg-navy-950/70 border border-navy-800/80 truncate">
              RabbitMQ 3.13
            </div>
            <div className="py-0.5 px-2 rounded bg-navy-950/70 border border-navy-800/80 truncate">
              Redis 7.4
            </div>
            <div className="py-0.5 px-2 rounded bg-navy-950/70 border border-navy-800/80 truncate">
              WSO2 4.7.0
            </div>
          </div>
        </div>

        {/* Footer Credit & Links */}
        <div className="p-3 border-t border-navy-800/80 bg-navy-950 text-slate-400 text-[11px] flex items-center justify-between">
          <div>
            <div className="text-slate-300 font-medium truncate">Sajini S.</div>
            <div className="text-[10px] text-slate-400">Univ. of Moratuwa (IT)</div>
          </div>
          <a
            href="https://github.com/Sajini3655/Flowforge"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded bg-navy-900 hover:bg-navy-800 text-slate-300 hover:text-white transition-colors"
            title="GitHub Repository"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </aside>
    </>
  );
};
