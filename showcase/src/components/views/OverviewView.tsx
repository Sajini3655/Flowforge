import React, { useState } from 'react';
import { 
  Layers, 
  GitBranch, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  Play, 
  Plus
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  BarChart,
  Bar
} from 'recharts';
import { useShowcase } from '../../context/ShowcaseContext';
import { StatCard } from '../common/StatCard';
import { Badge } from '../common/Badge';

// Sample hourly throughput based on standard banking day cycle
const THROUGHPUT_DATA = [
  { time: '09:00', completed: 18, retried: 2, failed: 0 },
  { time: '10:00', completed: 32, retried: 3, failed: 1 },
  { time: '11:00', completed: 48, retried: 4, failed: 0 },
  { time: '12:00', completed: 42, retried: 2, failed: 1 },
  { time: '13:00', completed: 35, retried: 1, failed: 0 },
  { time: '14:00', completed: 64, retried: 5, failed: 2 },
  { time: '15:00', completed: 78, retried: 6, failed: 1 },
  { time: '16:00', completed: 58, retried: 3, failed: 0 },
  { time: '17:00', completed: 44, retried: 2, failed: 1 },
];

export const OverviewView: React.FC = () => {
  const { stats, jobs, apis, setActiveView, selectJob, submitJob } = useShowcase();
  const [triggeringDemo, setTriggeringDemo] = useState(false);

  const handleQuickDemoJob = () => {
    setTriggeringDemo(true);
    submitJob({
      type: 'ECHO',
      payload: JSON.stringify({
        source: 'OVERVIEW_QUICK_DISPATCH',
        amount: (Math.random() * 10000).toFixed(2),
        currency: 'GBP',
        timestamp: new Date().toISOString()
      }, null, 2),
      idempotencyKey: `idemp-quick-${Date.now()}`
    });
    setTimeout(() => setTriggeringDemo(false), 800);
  };

  const handleSimulateFailure = () => {
    setTriggeringDemo(true);
    submitJob({
      type: 'TRANSIENT_FAILURE',
      payload: JSON.stringify({
        simulation: 'DOWNSTREAM_GATEWAY_TIMEOUT',
        initiatedBy: 'OVERVIEW_BUTTON'
      }, null, 2),
      idempotencyKey: `idemp-fail-${Date.now()}`
    });
    setTimeout(() => setTriggeringDemo(false), 800);
  };

  const statusDistributionData = [
    { name: 'Completed', count: stats.completedJobs, fill: '#10B981' },
    { name: 'In-Flight', count: stats.inFlightJobs, fill: '#0284C7' },
    { name: 'Retrying', count: stats.retryingJobs, fill: '#F59E0B' },
    { name: 'Failed / DLQ', count: stats.deadLetterJobs, fill: '#EF4444' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Action & Status Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>Orchestrator Simulation Controls</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Trigger simulated workflow execution paths through outbox dispatch, delayed retry queue, or direct API registration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleQuickDemoJob}
            disabled={triggeringDemo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Submit Sample Job</span>
          </button>

          <button
            onClick={handleSimulateFailure}
            disabled={triggeringDemo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Simulate Failure (DLQ)</span>
          </button>

          <button
            onClick={() => setActiveView('apis')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register API</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards Grid (5 focused metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          title="Registered APIs"
          value={stats.totalApis}
          subtitle={`${apis.filter(a => a.status === 'PUBLISHED').length} Published`}
          icon={Layers}
          iconColor="text-teal-600"
          onClick={() => setActiveView('apis')}
        />
        <StatCard
          title="Active Workflows"
          value={stats.activeWorkflows}
          subtitle="Configured workflows"
          icon={GitBranch}
          iconColor="text-indigo-600"
          onClick={() => setActiveView('workflows')}
        />
        <StatCard
          title="Total Jobs"
          value={stats.totalJobs}
          subtitle="Processed in demo"
          icon={Cpu}
          iconColor="text-sky-600"
          onClick={() => setActiveView('jobs')}
        />
        <StatCard
          title="Completed"
          value={stats.completedJobs}
          subtitle={`${stats.successRate}% completion`}
          icon={CheckCircle2}
          iconColor="text-emerald-600"
        />
        <StatCard
          title="Dead-Lettered"
          value={stats.deadLetterJobs}
          subtitle="Quarantined in DLQ"
          icon={AlertTriangle}
          iconColor="text-rose-600"
        />
      </div>

      {/* Telemetry Charts (Two column) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Throughput */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                Simulated Processing Volume
              </h3>
              <p className="text-[11px] text-slate-500">Representative hourly throughput curve</p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              Avg: 48 msg/hr
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={THROUGHPUT_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D9488" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#0D9488" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0B132B', borderColor: '#1E293B', borderRadius: '8px', color: '#F8FAFC', fontSize: '11px' }} 
                />
                <Area type="monotone" dataKey="completed" name="Completed" stroke="#0D9488" strokeWidth={2} fillOpacity={1} fill="url(#completedGrad)" />
                <Area type="monotone" dataKey="retried" name="Retried" stroke="#F59E0B" strokeWidth={1.5} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* State Machine Distribution */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                Job State Distribution
              </h3>
              <p className="text-[11px] text-slate-500">Authoritative count from shared state machine</p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              {stats.totalJobs} Total
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0B132B', borderColor: '#1E293B', borderRadius: '8px', color: '#F8FAFC', fontSize: '11px' }} 
                />
                <Bar dataKey="count" name="Jobs" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Workflow Executions */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
              Recent Executions
            </h3>
            <p className="text-[11px] text-slate-500">Latest jobs processed through the simulation engine</p>
          </div>
          <button
            onClick={() => setActiveView('jobs')}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            View All ({jobs.length}) →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 tracking-wider border-b border-slate-100 font-mono">
              <tr>
                <th className="px-4 py-2.5">Job ID</th>
                <th className="px-4 py-2.5">Workflow</th>
                <th className="px-4 py-2.5">Attempts</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Time</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {jobs.slice(0, 5).map((job) => (
                <tr key={job.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-2.5 font-semibold text-slate-900">
                    {job.id.substring(0, 8)}...
                  </td>
                  <td className="px-4 py-2.5 font-sans text-slate-800">
                    {job.workflowName}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {job.attemptCount} / {job.maxAttempts}
                  </td>
                  <td className="px-4 py-2.5 font-sans">
                    <Badge status={job.status} />
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-[11px]">
                    {new Date(job.createdAt).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-sans">
                    <button
                      onClick={() => {
                        selectJob(job.id);
                        setActiveView('jobs');
                      }}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
