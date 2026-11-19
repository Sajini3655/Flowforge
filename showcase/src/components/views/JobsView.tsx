import React, { useState } from 'react';
import { 
  Cpu, 
  Search, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  Database, 
  Send, 
  Terminal
} from 'lucide-react';
import { useShowcase } from '../../context/ShowcaseContext';
import { Badge } from '../common/Badge';
import { JsonViewer } from '../common/JsonViewer';

export const JobsView: React.FC = () => {
  const { jobs, selectedJobId, selectJob, retryJob, currentSimulatingJobId } = useShowcase();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const selectedJob = jobs.find(j => j.id === selectedJobId) || jobs[0] || null;

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          job.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (job.idempotencyKey && job.idempotencyKey.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-forge-teal" />
            Distributed Job Executions
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative PostgreSQL state, Redis per-job mutex, and RabbitMQ delayed retry progression.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
            Total Jobs: <strong>{jobs.length}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
            Completed: <strong>{jobs.filter(j => j.status === 'COMPLETED').length}</strong>
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Job ID, type, or idempotency key..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-forge-teal"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-slate-400 text-[11px] font-medium mr-1 font-mono uppercase">Filter:</span>
          {['ALL', 'COMPLETED', 'QUEUED', 'PROCESSING', 'RETRYING', 'FAILED', 'DEAD_LETTERED'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`
                px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer shrink-0
                ${statusFilter === status 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}
              `}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 tracking-wider border-b border-slate-100 font-mono">
              <tr>
                <th className="px-5 py-3">Job ID</th>
                <th className="px-5 py-3">Workflow Type</th>
                <th className="px-5 py-3">Attempts</th>
                <th className="px-5 py-3">Idempotency Key</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Created Time</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400 font-sans">
                    No job executions match the current criteria.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => {
                  const isSelected = selectedJob?.id === job.id;
                  const isSimulating = currentSimulatingJobId === job.id;
                  return (
                    <tr 
                      key={job.id}
                      onClick={() => selectJob(job.id)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${isSelected ? 'bg-teal-50/60' : ''}`}
                    >
                      <td className="px-5 py-3.5 font-bold text-slate-900 flex items-center gap-1.5">
                        {isSimulating && <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping"></span>}
                        <span className="truncate max-w-[160px]">{job.id}</span>
                      </td>
                      <td className="px-5 py-3.5 font-sans font-medium text-slate-800">
                        {job.type}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded font-medium text-[11px] ${job.attemptCount > 1 ? 'bg-amber-100 text-amber-800 font-bold' : 'bg-slate-100 text-slate-700'}`}>
                          {job.attemptCount} / {job.maxAttempts}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-[11px] truncate max-w-[160px]">
                        {job.idempotencyKey || 'none'}
                      </td>
                      <td className="px-5 py-3.5 font-sans">
                        <Badge status={job.status} pulse={job.status === 'PROCESSING'} />
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-[11px]">
                        {new Date(job.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="px-5 py-3.5 text-right font-sans">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            selectJob(job.id);
                          }}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${isSelected ? 'bg-forge-teal text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full-Width Execution Inspector Panel (Exact representation of FlowForge Architecture) */}
      {selectedJob && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-6 space-y-6 animate-fadeIn">
          {/* Header of Inspector */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-navy-950 text-teal-400 border border-navy-800 uppercase tracking-wider">
                  Execution Inspector
                </span>
                <span className="font-mono text-xs font-semibold text-slate-800">{selectedJob.id}</span>
                <Badge status={selectedJob.status} pulse={selectedJob.status === 'PROCESSING'} />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Workflow: <strong>{selectedJob.workflowName}</strong> ({selectedJob.type})
              </p>
            </div>

            {(selectedJob.status === 'FAILED' || selectedJob.status === 'DEAD_LETTERED') && (
              <button
                onClick={() => retryJob(selectedJob.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-forge-teal text-white hover:bg-teal-700 shadow-sm transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Manual Retry (POST /api/jobs/{selectedJob.id.substring(0, 8)}/retry)</span>
              </button>
            )}
          </div>

          {/* Distributed Architecture Stepper */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
              System Execution Path (Zero-Data-Loss Guarantees)
            </span>
            <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] font-mono">
              <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ✓ POST
              </span>
              <span className="text-slate-400">→</span>
              <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1">
                <Database className="w-3 h-3 text-emerald-600" /> ✓ POSTGRES
              </span>
              <span className="text-slate-400">→</span>
              <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1">
                <Send className="w-3 h-3 text-emerald-600" /> ✓ OUTBOX
              </span>
              <span className="text-slate-400">→</span>
              <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1">
                <Cpu className="w-3 h-3 text-emerald-600" /> ✓ RABBITMQ
              </span>
              <span className="text-slate-400">→</span>
              <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1">
                <Terminal className="w-3 h-3 text-emerald-600" /> ✓ WORKER
              </span>
              <span className="text-slate-400">→</span>
              <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-600" /> ✓ REDIS LOCK
              </span>
              <span className="text-slate-400">→</span>
              <span className={`px-2 py-1 rounded font-semibold ${selectedJob.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : selectedJob.status === 'FAILED' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-800'}`}>
                ✓ {selectedJob.status}
              </span>
            </div>
          </div>

          {/* 4 Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            {/* Identity */}
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
              <div className="text-slate-400 uppercase text-[10px] font-bold font-sans">Identity</div>
              <div><span className="text-slate-500">ID:</span> <span className="font-semibold text-slate-800">{selectedJob.id}</span></div>
              <div><span className="text-slate-500">TYPE:</span> <span className="text-slate-800">{selectedJob.type}</span></div>
              <div><span className="text-slate-500">WORKER:</span> <span className="text-slate-800">{selectedJob.workerId || 'pool-worker-01'}</span></div>
            </div>

            {/* Execution */}
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
              <div className="text-slate-400 uppercase text-[10px] font-bold font-sans">Execution & Retries</div>
              <div><span className="text-slate-500">ATTEMPT:</span> <span className="font-bold text-slate-900">{selectedJob.attemptCount} / {selectedJob.maxAttempts}</span></div>
              <div><span className="text-slate-500">CREATED:</span> <span className="text-slate-800">{new Date(selectedJob.createdAt).toLocaleTimeString()}</span></div>
              <div><span className="text-slate-500">UPDATED:</span> <span className="text-slate-800">{new Date(selectedJob.updatedAt).toLocaleTimeString()}</span></div>
            </div>

            {/* Reliability */}
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
              <div className="text-slate-400 uppercase text-[10px] font-bold font-sans">Reliability</div>
              <div className="truncate"><span className="text-slate-500">IDEMP KEY:</span> <span className="text-slate-800">{selectedJob.idempotencyKey || 'none'}</span></div>
              <div className="truncate"><span className="text-slate-500">REDIS MUTEX:</span> <span className="text-slate-800">lock:job:{selectedJob.id.substring(0, 8)}</span></div>
              <div><span className="text-slate-500">POLICY:</span> <span className="text-slate-800">3 attempts, 5s delay</span></div>
            </div>

            {/* Messaging */}
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
              <div className="text-slate-400 uppercase text-[10px] font-bold font-sans">Messaging Topology</div>
              <div><span className="text-slate-500">OUTBOX:</span> <span className="text-emerald-700 font-semibold">outbox_events</span></div>
              <div><span className="text-slate-500">EXCHANGE:</span> <span className="text-slate-800">flowforge.job.exchange</span></div>
              <div><span className="text-slate-500">DLQ:</span> <span className="text-slate-800">{selectedJob.status === 'FAILED' || selectedJob.status === 'DEAD_LETTERED' ? 'ROUTED (Active)' : 'flowforge.job.dlq (Standby)'}</span></div>
            </div>
          </div>

          {/* Payloads & Results */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <JsonViewer
              title="Request Payload (PostgreSQL jobs.request_payload)"
              data={selectedJob.requestPayload}
            />
            {selectedJob.result ? (
              <JsonViewer
                title="Execution Output (PostgreSQL jobs.result)"
                data={selectedJob.result}
              />
            ) : selectedJob.failureReason ? (
              <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Failure Diagnostics & DLQ Routing
                </div>
                <p className="leading-relaxed">{selectedJob.failureReason}</p>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 text-xs font-mono flex items-center justify-center">
                Processing in flight...
              </div>
            )}
          </div>

          {/* Step-by-Step Execution Audit Trail */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
              Step Execution Timeline (Diagnostic Trace)
            </span>
            <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 text-xs font-mono">
              {selectedJob.executionSteps.map((step, idx) => (
                <div key={idx} className="p-2.5 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${step.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                    <strong className="text-slate-800">{step.step}</strong>
                    <span className="text-slate-500 text-[11px]">{step.detail}</span>
                  </div>
                  <span className="text-slate-400 text-[11px]">{step.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
