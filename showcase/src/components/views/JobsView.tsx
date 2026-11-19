import React, { useState } from 'react';
import { 
  Cpu, 
  Search, 
  RotateCcw, 
  Lock, 
  Database, 
  Send, 
  Terminal
} from 'lucide-react';
import { useShowcase } from '../../context/ShowcaseContext';
import { Badge } from '../common/Badge';
import { JsonViewer } from '../common/JsonViewer';

export const JobsView: React.FC = () => {
  const { jobs, selectedJobId, selectJob, retryJob } = useShowcase();
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
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-slate-700" />
            <span>Distributed Job Executions</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Finite-state machine records tracking PostgreSQL state, Redis mutual exclusion, and RabbitMQ retry progression.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
            Total Jobs: <strong>{jobs.length}</strong>
          </span>
          <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
            Completed: <strong>{jobs.filter(j => j.status === 'COMPLETED').length}</strong>
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-sm text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Job ID, type, or idempotency key..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-slate-400 text-[11px] font-medium mr-1 font-mono uppercase">Filter:</span>
          {['ALL', 'COMPLETED', 'QUEUED', 'PROCESSING', 'RETRYING', 'FAILED', 'DEAD_LETTERED'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`
                px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer shrink-0
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
                <th className="px-4 py-2.5">Job ID</th>
                <th className="px-4 py-2.5">Workflow Type</th>
                <th className="px-4 py-2.5">Attempts</th>
                <th className="px-4 py-2.5">Idempotency Key</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Created Time</th>
                <th className="px-4 py-2.5 text-right font-sans">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-sans">
                    No jobs match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredJobs.map(job => (
                  <tr 
                    key={job.id} 
                    className={`hover:bg-slate-50/80 transition-colors ${selectedJob?.id === job.id ? 'bg-slate-50' : ''}`}
                  >
                    <td className="px-4 py-2.5 font-semibold text-slate-900">
                      {job.id}
                    </td>
                    <td className="px-4 py-2.5 font-sans text-slate-800">
                      {job.workflowName}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`font-semibold ${job.attemptCount > 1 ? 'text-amber-700' : 'text-slate-700'}`}>
                        {job.attemptCount} / {job.maxAttempts}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-[11px]">
                      {job.idempotencyKey || 'None'}
                    </td>
                    <td className="px-4 py-2.5 font-sans">
                      <Badge status={job.status} />
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-[11px]">
                      {new Date(job.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2.5 text-right font-sans">
                      <button
                        onClick={() => selectJob(job.id)}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Execution Inspector Panel */}
      {selectedJob && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 space-y-5 animate-fadeIn">
          {/* Header of Inspector */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">
                  Execution Inspector
                </span>
                <span className="font-mono text-xs font-semibold text-slate-800">{selectedJob.id}</span>
                <Badge status={selectedJob.status} />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Workflow: <strong>{selectedJob.workflowName}</strong> ({selectedJob.type})
              </p>
            </div>

            {(selectedJob.status === 'FAILED' || selectedJob.status === 'DEAD_LETTERED') && (
              <button
                onClick={() => retryJob(selectedJob.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 shadow-sm transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Manual Retry (Re-enqueue)</span>
              </button>
            )}
          </div>

          {/* Execution Architecture Trace */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
              Execution Architecture Trace
            </span>
            <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium flex items-center gap-1 border border-slate-200">
                ✓ POST
              </span>
              <span className="text-slate-400">→</span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium flex items-center gap-1 border border-slate-200">
                <Database className="w-3 h-3 text-slate-500" /> ✓ POSTGRES
              </span>
              <span className="text-slate-400">→</span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium flex items-center gap-1 border border-slate-200">
                <Send className="w-3 h-3 text-slate-500" /> ✓ OUTBOX
              </span>
              <span className="text-slate-400">→</span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium flex items-center gap-1 border border-slate-200">
                <Cpu className="w-3 h-3 text-slate-500" /> ✓ RABBITMQ
              </span>
              <span className="text-slate-400">→</span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium flex items-center gap-1 border border-slate-200">
                <Terminal className="w-3 h-3 text-slate-500" /> ✓ WORKER
              </span>
              <span className="text-slate-400">→</span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium flex items-center gap-1 border border-slate-200">
                <Lock className="w-3 h-3 text-slate-500" /> ✓ REDIS LOCK
              </span>
              <span className="text-slate-400">→</span>
              <span className={`px-2 py-0.5 rounded font-medium border ${selectedJob.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : selectedJob.status === 'FAILED' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                ✓ {selectedJob.status}
              </span>
            </div>
          </div>

          {/* 4 Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
            {/* Identity */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <div className="text-slate-400 uppercase text-[10px] font-bold font-sans">Identity</div>
              <div><span className="text-slate-500">ID:</span> <span className="font-semibold text-slate-800">{selectedJob.id}</span></div>
              <div><span className="text-slate-500">TYPE:</span> <span className="text-slate-800">{selectedJob.type}</span></div>
              <div><span className="text-slate-500">WORKER:</span> <span className="text-slate-800">{selectedJob.workerId || 'worker-node-1'}</span></div>
            </div>

            {/* Execution */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <div className="text-slate-400 uppercase text-[10px] font-bold font-sans">Execution & Retries</div>
              <div><span className="text-slate-500">ATTEMPT:</span> <span className="font-bold text-slate-900">{selectedJob.attemptCount} / {selectedJob.maxAttempts}</span></div>
              <div><span className="text-slate-500">CREATED:</span> <span className="text-slate-800">{new Date(selectedJob.createdAt).toLocaleTimeString()}</span></div>
              <div><span className="text-slate-500">LOCK:</span> <span className="text-slate-800">{selectedJob.lockToken ? 'Acquired' : 'Released'}</span></div>
            </div>

            {/* Reliability */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <div className="text-slate-400 uppercase text-[10px] font-bold font-sans">Reliability Settings</div>
              <div><span className="text-slate-500">IDEMP KEY:</span> <span className="text-slate-800 truncate block">{selectedJob.idempotencyKey || 'None'}</span></div>
              <div><span className="text-slate-500">RETRY POLICY:</span> <span className="text-slate-800">3 attempts, 5s TTL</span></div>
              <div><span className="text-slate-500">LOCK LEASE:</span> <span className="text-slate-800">60s Mutex</span></div>
            </div>

            {/* Messaging */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <div className="text-slate-400 uppercase text-[10px] font-bold font-sans">Broker Topology</div>
              <div><span className="text-slate-500">QUEUE:</span> <span className="text-slate-800">flowforge.job.queue</span></div>
              <div><span className="text-slate-500">EXCHANGE:</span> <span className="text-slate-800">flowforge.job.exchange</span></div>
              <div><span className="text-slate-500">DLQ:</span> <span className="text-slate-800">flowforge.job.dlq</span></div>
            </div>
          </div>

          {/* Execution Steps Trace Log */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
              Recorded Step Log
            </span>
            <div className="space-y-1 font-mono text-xs">
              {selectedJob.executionSteps.map((s, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 text-[10px] shrink-0 mt-0.5">{s.timestamp}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${s.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {s.step}
                  </span>
                  <span className="text-slate-600 font-sans text-xs">{s.detail}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payloads Inspection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
                Request Payload
              </span>
              <JsonViewer data={JSON.parse(selectedJob.requestPayload)} />
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
                {selectedJob.failureReason ? 'Failure Reason' : 'Execution Output'}
              </span>
              {selectedJob.failureReason ? (
                <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-rose-800 text-xs">
                  {selectedJob.failureReason}
                </div>
              ) : selectedJob.result ? (
                <JsonViewer data={JSON.parse(selectedJob.result)} />
              ) : (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-500 text-xs italic">
                  Awaiting worker consumer execution completion...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
