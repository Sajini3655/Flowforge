import React, { useState } from 'react';
import { 
  Activity, 
  Terminal, 
  CheckCircle2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend
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
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-700" />
            <span>Observability & Telemetry Center</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Micrometer instrumentation schema, simulated Prometheus metrics, and Kubernetes health probes.
          </p>
        </div>

        <button
          onClick={() => setShowPrometheusRaw(!showPrometheusRaw)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>{showPrometheusRaw ? 'Hide Raw Output' : 'Inspect /actuator/prometheus'}</span>
        </button>
      </div>

      {/* Raw Prometheus Scrape Output Drawer */}
      {showPrometheusRaw && (
        <div className="bg-navy-950 p-4 rounded-xl border border-navy-800 text-xs font-mono space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between text-slate-400 text-[11px] pb-2 border-b border-navy-800">
            <span className="text-teal-400">Endpoint: GET http://localhost:8080/actuator/prometheus</span>
            <span>Content-Type: text/plain; version=0.0.4</span>
          </div>
          <pre className="text-emerald-400 overflow-x-auto leading-relaxed max-h-72 p-2">
            <code>{rawPrometheusMetrics}</code>
          </pre>
        </div>
      )}

      {/* 5 Micrometer Metric StatCards */}
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
          subtitle="Counter total"
          icon={CheckCircle2}
          iconColor="text-emerald-600"
        />
        <StatCard
          title="jobs_retried_total"
          value={stats.retryingJobs + (stats.deadLetterJobs * 3)}
          subtitle="5s TTL queue"
          icon={Activity}
          iconColor="text-amber-600"
        />
        <StatCard
          title="jobs_dlq_total"
          value={stats.deadLetterJobs}
          subtitle="Poison pills in DLQ"
          icon={Activity}
          iconColor="text-rose-600"
        />
        <StatCard
          title="redis_lock_acquired"
          value={stats.completedJobs + stats.deadLetterJobs}
          subtitle="SET NX PX locks"
          icon={Activity}
          iconColor="text-teal-600"
        />
      </div>

      {/* Telemetry Stream Chart */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
              Illustrative Telemetry Stream
            </h3>
            <p className="text-[11px] text-slate-500">Modeled time-series view representing Prometheus metric scraping</p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
            5s Scrape Interval
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={REALTIME_TELEMETRY} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0B132B', borderColor: '#1E293B', borderRadius: '8px', color: '#F8FAFC', fontSize: '11px' }} 
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Line type="monotone" dataKey="submitted" name="Submitted" stroke="#6366F1" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="completed" name="Completed" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="retries" name="Retries" stroke="#F59E0B" strokeWidth={1.5} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="dlq" name="DLQ Quarantined" stroke="#EF4444" strokeWidth={1.5} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Health Probes & Prometheus Config */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-3">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
              Kubernetes Readiness Probe JSON
            </h3>
            <p className="text-[11px] text-slate-500">Response payload from GET /api/health/ready</p>
          </div>
          <JsonViewer data={healthReadinessPayload} />
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-3">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
              Prometheus Scrape Configuration
            </h3>
            <p className="text-[11px] text-slate-500">From infra/prometheus/prometheus.yml</p>
          </div>
          <pre className="p-3.5 rounded-lg bg-navy-950 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed border border-navy-800">
            <code>{`scrape_configs:
  - job_name: 'flowforge-backend'
    metrics_path: '/actuator/prometheus'
    scrape_interval: 5s
    scrape_timeout: 4s
    static_configs:
      - targets: ['backend:8080']
        labels:
          application: 'flowforge-backend'
          environment: 'production'`}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
