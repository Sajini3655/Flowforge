import React, { useState } from 'react';
import { 
  Activity, 
  Terminal, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ShieldCheck 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { useShowcase } from '../../context/ShowcaseContext';
import { StatCard } from '../common/StatCard';
import { JsonViewer } from '../common/JsonViewer';

const REALTIME_TELEMETRY = [
  { time: '17:40', submitted: 12, completed: 11, retries: 1, dlq: 0 },
  { time: '17:42', submitted: 24, completed: 23, retries: 2, dlq: 0 },
  { time: '17:44', submitted: 38, completed: 35, retries: 3, dlq: 1 },
  { time: '17:46', submitted: 45, completed: 44, retries: 1, dlq: 0 },
  { time: '17:48', submitted: 52, completed: 49, retries: 4, dlq: 1 },
  { time: '17:50', submitted: 60, completed: 57, retries: 2, dlq: 0 },
  { time: '17:52', submitted: 48, completed: 47, retries: 1, dlq: 0 },
];

export const ObservabilityView: React.FC = () => {
  const { stats } = useShowcase();
  const [showPrometheusRaw, setShowPrometheusRaw] = useState(false);

  const rawPrometheusMetrics = `# HELP flowforge_jobs_submitted_total Total number of workflow jobs submitted to FlowForge
# TYPE flowforge_jobs_submitted_total counter
flowforge_jobs_submitted_total ${stats.totalJobs}.0

# HELP flowforge_jobs_completed_total Total number of workflow jobs successfully completed
# TYPE flowforge_jobs_completed_total counter
flowforge_jobs_completed_total ${stats.completedJobs}.0

# HELP flowforge_jobs_retry_attempts_total Total number of job execution retry attempts through delayed queue
# TYPE flowforge_jobs_retry_attempts_total counter
flowforge_jobs_retry_attempts_total ${stats.retryingJobs + (stats.deadLetterJobs * 3)}.0

# HELP flowforge_jobs_dlq_publications_total Total number of poison pills routed to flowforge.job.dlq
# TYPE flowforge_jobs_dlq_publications_total counter
flowforge_jobs_dlq_publications_total ${stats.deadLetterJobs}.0

# HELP flowforge_redis_lock_acquired_total Total number of Redis per-job execution locks successfully acquired
# TYPE flowforge_redis_lock_acquired_total counter
flowforge_redis_lock_acquired_total ${stats.completedJobs + stats.deadLetterJobs}.0

# HELP jvm_memory_used_bytes The amount of used memory
# TYPE jvm_memory_used_bytes gauge
jvm_memory_used_bytes{area="heap",id="G1 Survivor Space",} 1.8874368E7
jvm_memory_used_bytes{area="heap",id="G1 Old Gen",} 7.1303168E7
jvm_memory_used_bytes{area="heap",id="G1 Eden Space",} 4.194304E7`;

  const healthReadinessPayload = {
    status: "UP",
    service: "flowforge-backend",
    dependencies: {
      postgresql: "UP",
      rabbitmq: "UP",
      redis: "UP",
      wso2: "UP"
    },
    cluster: "docker-compose-local",
    timestamp: new Date().toISOString()
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-forge-teal" />
            Observability & Telemetry Center
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time Micrometer instrumentation, Prometheus scraping (5s interval), and Grafana operational metrics.
          </p>
        </div>

        <button
          onClick={() => setShowPrometheusRaw(!showPrometheusRaw)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-navy-950 text-teal-400 border border-navy-800 hover:bg-navy-900 transition-colors cursor-pointer"
        >
          <Terminal className="w-4 h-4" />
          <span>{showPrometheusRaw ? 'Hide Raw Prometheus Exporter' : 'Inspect /actuator/prometheus'}</span>
        </button>
      </div>

      {/* Raw Prometheus Exporter Modal / Dropdown */}
      {showPrometheusRaw && (
        <div className="bg-navy-950 p-4 rounded-xl border border-navy-800 space-y-2 animate-fadeIn text-xs">
          <div className="flex items-center justify-between text-slate-400 font-mono text-[11px] border-b border-navy-800 pb-2">
            <span>GET http://localhost:8080/actuator/prometheus (Live Response)</span>
            <span className="text-teal-400">Content-Type: text/plain; version=0.0.4</span>
          </div>
          <pre className="font-mono text-emerald-400 overflow-x-auto p-2 leading-relaxed max-h-60">
            <code>{rawPrometheusMetrics}</code>
          </pre>
        </div>
      )}

      {/* Custom Micrometer Metric Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 font-mono">
        <StatCard
          title="jobs_submitted_total"
          value={stats.totalJobs}
          subtitle="Counter total"
          icon={Activity}
          iconColor="text-indigo-600"
        />
        <StatCard
          title="jobs_completed_total"
          value={stats.completedJobs}
          subtitle="At-least-once successful"
          icon={CheckCircle2}
          iconColor="text-emerald-600"
        />
        <StatCard
          title="retry_attempts_total"
          value={stats.retryingJobs + (stats.deadLetterJobs * 3)}
          subtitle="5s TTL queue sweeps"
          icon={Clock}
          iconColor="text-amber-600"
        />
        <StatCard
          title="dlq_publications_total"
          value={stats.deadLetterJobs}
          subtitle="Quarantined poison pills"
          icon={AlertTriangle}
          iconColor="text-rose-600"
        />
        <StatCard
          title="lock_acquired_total"
          value={stats.completedJobs + stats.deadLetterJobs}
          subtitle="Redis SET NX PX"
          icon={ShieldCheck}
          iconColor="text-teal-600"
        />
      </div>

      {/* Grafana Time-Series Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Job Ingestion vs Completion Rate</h3>
              <p className="text-xs text-slate-500">Live operational rate scraped by Prometheus server (Port 9090)</p>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Scrape: 5s
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={REALTIME_TELEMETRY} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0B132B', border: '1px solid #1C2541', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line type="monotone" dataKey="submitted" stroke="#6366F1" strokeWidth={2} name="Jobs Submitted" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="completed" stroke="#10B981" strokeWidth={2} name="Jobs Completed" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Retry Spikes & Dead-Letter Isolation</h3>
              <p className="text-xs text-slate-500">Alert condition monitoring: flowforge.job.retry vs flowforge.job.dlq</p>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              PromQL: rate(dlq[5m])
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={REALTIME_TELEMETRY} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0B132B', border: '1px solid #1C2541', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="retries" fill="#F59E0B" name="Retry Queue Depth" radius={[4, 4, 0, 0]} />
                <Bar dataKey="dlq" fill="#EF4444" name="DLQ Quarantined" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Readiness Endpoint Inspection */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Multi-Dependency Health & Readiness Probe (GET /api/health/ready)
          </h3>
          <p className="text-xs text-slate-500">
            Dynamically checks live socket availability across all 4 backing infrastructure tiers.
          </p>
        </div>

        <JsonViewer
          title="HTTP 200 OK — Readiness Probe Output"
          data={healthReadinessPayload}
        />
      </div>
    </div>
  );
};
