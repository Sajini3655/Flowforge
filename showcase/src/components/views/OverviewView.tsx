import React, { useState } from 'react';
import { 
  Layers, 
  GitBranch, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ArrowRight, 
  Play, 
  Plus, 
  Activity,
  Flame,
  ShieldCheck,
  Zap
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
    { name: 'Queued / Processing', count: stats.inFlightJobs, fill: '#0284C7' },
    { name: 'Retrying', count: stats.retryingJobs, fill: '#F59E0B' },
    { name: 'Dead-Lettered / Failed', count: stats.deadLetterJobs, fill: '#EF4444' },
  ];

  return (
    <div className="space-y-6">
      {/* Top operational banner & Quick Actions */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h2 className="text-base font-bold text-slate-900">Distributed Orchestrator Operational</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            WSO2 API Gateway active on <span className="font-mono text-slate-700">port 8243</span> with RS256 token verification. RabbitMQ & Redis locking enabled.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleQuickDemoJob}
            disabled={triggeringDemo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-forge-teal text-white hover:bg-teal-700 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Create Demo Job</span>
          </button>

          <button
            onClick={handleSimulateFailure}
            disabled={triggeringDemo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            <Flame className="w-3.5 h-3.5 text-rose-600" />
            <span>Simulate DLQ Failure</span>
          </button>

          <button
            onClick={() => setActiveView('apis')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register API</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          title="Registered APIs"
          value={stats.totalApis}
          subtitle={`${apis.filter(a => a.status === 'PUBLISHED').length} Published in WSO2`}
          icon={Layers}
          iconColor="text-teal-600"
          onClick={() => setActiveView('apis')}
        />
        <StatCard
          title="Total Workflows"
          value={stats.activeWorkflows}
          subtitle="Active orchestration pipes"
          icon={GitBranch}
          iconColor="text-sky-600"
          onClick={() => setActiveView('workflows')}
        />
        <StatCard
          title="Processed Jobs"
          value={stats.totalJobs}
          subtitle="Recorded in PostgreSQL"
          icon={Cpu}
          iconColor="text-indigo-600"
          onClick={() => setActiveView('jobs')}
        />
        <StatCard
          title="Completed"
          value={stats.completedJobs}
          subtitle="At-least-once verified"
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          badge={`${stats.successRate}%`}
          badgeColor="bg-emerald-100 text-emerald-800"
          onClick={() => setActiveView('jobs')}
        />
        <StatCard
          title="In-Flight / Retry"
          value={stats.inFlightJobs + stats.retryingJobs}
          subtitle="RabbitMQ 5s delayed queue"
          icon={Clock}
          iconColor="text-amber-600"
          badge={`${stats.retryingJobs} retry`}
          badgeColor="bg-amber-100 text-amber-800"
          onClick={() => setActiveView('jobs')}
        />
        <StatCard
          title="Dead-Lettered"
          value={stats.deadLetterJobs}
          subtitle="Quarantined in DLQ"
          icon={AlertTriangle}
          iconColor="text-rose-600"
          badge="DLQ"
          badgeColor="bg-rose-100 text-rose-800"
          onClick={() => setActiveView('reliability')}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Throughput Curve */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-forge-teal" />
                Workflow Processing Throughput
              </h3>
              <p className="text-xs text-slate-500">Hourly volume processed through RabbitMQ worker consumers</p>
            </div>
            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              Avg: {stats.averageLatencyMs}ms / job
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={THROUGHPUT_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00A896" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#00A896" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorRetried" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0B132B', border: '1px solid #1C2541', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="completed" stroke="#00A896" strokeWidth={2} fillOpacity={1} fill="url(#colorCompleted)" name="Completed Jobs" />
                <Area type="monotone" dataKey="retried" stroke="#F59E0B" strokeWidth={2} fillOpacity={1} fill="url(#colorRetried)" name="Delayed Retries" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* State Distribution Bar Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-sky-600" />
              State Machine Breakdown
            </h3>
            <p className="text-xs text-slate-500">Current PostgreSQL authoritative job statuses</p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusDistributionData} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} tickLine={false} width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0B132B', border: '1px solid #1C2541', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Jobs in State" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Workflow Jobs Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recent Workflow Executions</h3>
            <p className="text-xs text-slate-500">Live feed from PostgreSQL and RabbitMQ consumer</p>
          </div>
          <button
            onClick={() => setActiveView('jobs')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-forge-teal hover:text-teal-700 cursor-pointer"
          >
            <span>View All ({jobs.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 tracking-wider border-b border-slate-100 font-mono">
              <tr>
                <th className="px-4 py-3">Job ID</th>
                <th className="px-4 py-3">Workflow Type</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Idempotency Key</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {jobs.slice(0, 5).map((job) => (
                <tr key={job.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-900 truncate max-w-[140px]">
                    {job.id}
                  </td>
                  <td className="px-4 py-3 font-sans font-medium text-slate-800">
                    {job.type}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded font-medium text-[11px] ${job.attemptCount > 1 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                      {job.attemptCount} / {job.maxAttempts}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 truncate max-w-[150px]">
                    {job.idempotencyKey || 'none'}
                  </td>
                  <td className="px-4 py-3 font-sans">
                    <Badge status={job.status} pulse={job.status === 'PROCESSING'} />
                  </td>
                  <td className="px-4 py-3 text-right font-sans">
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

      {/* Engineering Highlights Quick Access */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div 
          onClick={() => setActiveView('reliability')}
          className="p-4 rounded-xl bg-gradient-to-br from-white to-slate-50 border border-slate-200 hover:border-teal-300 shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-teal-700 font-bold mb-1">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-forge-teal" />
              Reliability Sandbox
            </span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-slate-600">
            Interactive demonstrations of Idempotency deduplication, Transactional Outbox, and RabbitMQ 3-attempt delayed retries.
          </p>
        </div>

        <div 
          onClick={() => setActiveView('observability')}
          className="p-4 rounded-xl bg-gradient-to-br from-white to-slate-50 border border-slate-200 hover:border-sky-300 shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-sky-700 font-bold mb-1">
            <span className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-sky-600" />
              Prometheus & Grafana
            </span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-slate-600">
            Live simulated Prometheus metrics: <code className="text-slate-700">jobs_submitted</code>, <code className="text-slate-700">retry_attempts</code>, and <code className="text-slate-700">dlq_publications</code>.
          </p>
        </div>

        <div 
          onClick={() => setActiveView('evidence')}
          className="p-4 rounded-xl bg-gradient-to-br from-white to-slate-50 border border-slate-200 hover:border-indigo-300 shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-indigo-700 font-bold mb-1">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              141 Automated Tests
            </span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-slate-600">
            110 unit tests + 31 Testcontainers integration suites with live PostgreSQL and RabbitMQ assertions.
          </p>
        </div>
      </div>
    </div>
  );
};
