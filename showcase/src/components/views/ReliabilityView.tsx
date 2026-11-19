import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  Check, 
  X 
} from 'lucide-react';
import { useShowcase } from '../../context/ShowcaseContext';

export const ReliabilityView: React.FC = () => {
  const { outbox, jobs, submitJob } = useShowcase();

  // Tab state
  const [activeTab, setActiveTab] = useState<'idempotency' | 'outbox' | 'retries' | 'locking'>('idempotency');

  // Idempotency Demo State
  const [idempKey, setIdempKey] = useState('idemp-demo-lseg-01');
  const [idempPayload, setIdempPayload] = useState(JSON.stringify({ tradeId: "TRD-88210", security: "VOD.L", qty: 1000, price: 74.50 }, null, 2));
  const [idempResult, setIdempResult] = useState<{ status: number; message: string; isReplay: boolean; fingerprint: string } | null>(null);

  // Redis Locking Simulation State
  const [simulatingLock, setSimulatingLock] = useState(false);
  const [lockLog, setLockLog] = useState<string[]>([]);

  // Handle Idempotency submit
  const handleTestIdempotency = (modifyPayload: boolean) => {
    const payloadToSend = modifyPayload 
      ? JSON.stringify({ ...JSON.parse(idempPayload), modifiedTamperedField: true, timestamp: Date.now() }, null, 2)
      : idempPayload;

    const res = submitJob({
      type: 'ECHO',
      payload: payloadToSend,
      idempotencyKey: idempKey
    });

    setIdempResult({
      status: res.status,
      message: res.message,
      isReplay: res.isReplay,
      fingerprint: res.job?.requestFingerprint || 'calculated-sha256-hash'
    });
  };

  // Run Redis Lock Contention Simulation
  const runRedisLockSimulation = () => {
    setSimulatingLock(true);
    setLockLog([]);
    const jId = `job-${Date.now().toString().slice(-4)}`;
    const token1 = `token-w1-${Math.random().toString(36).substring(2, 6)}`;
    const token2 = `token-w2-${Math.random().toString(36).substring(2, 6)}`;

    const addStep = (msg: string) => setLockLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    addStep(`Worker-1 and Worker-2 concurrently dequeue job message: ${jId}`);
    
    setTimeout(() => {
      addStep(`Worker-1 sends: SET lock:job:${jId} "${token1}" NX PX 60000`);
      addStep(`>> Redis returns OK (1) — Lock successfully acquired by Worker-1`);
    }, 600);

    setTimeout(() => {
      addStep(`Worker-2 sends: SET lock:job:${jId} "${token2}" NX PX 60000`);
      addStep(`>> Redis returns nil (0) — Key already exists. Worker-2 lock acquisition failed!`);
      addStep(`Worker-2 initiates fail-closed BasicNack(requeue=true) to prevent duplicate processing`);
    }, 1200);

    setTimeout(() => {
      addStep(`Worker-1 finishes job execution. Executing atomic Lua script:`);
      addStep(`EVAL "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end" 1 lock:job:${jId} "${token1}"`);
      addStep(`>> Redis verifies token matches; deletes lock:job:${jId}. Lock cleared safely without race conditions.`);
      setSimulatingLock(false);
    }, 2200);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-700" />
            <span>Reliability & Fault-Tolerance Engineering Sandbox</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Distributed systems mechanisms implemented in FlowForge to eliminate message loss, race conditions, and duplicates.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-medium">
          <button
            onClick={() => setActiveTab('idempotency')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${activeTab === 'idempotency' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            1. Idempotency
          </button>
          <button
            onClick={() => setActiveTab('outbox')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${activeTab === 'outbox' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            2. Transactional Outbox
          </button>
          <button
            onClick={() => setActiveTab('retries')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${activeTab === 'retries' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            3. Retries & DLQ
          </button>
          <button
            onClick={() => setActiveTab('locking')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${activeTab === 'locking' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            4. Redis Locking
          </button>
        </div>
      </div>

      {/* Tab 1: Idempotency */}
      {activeTab === 'idempotency' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-4">
            <div>
              <span className="text-[10px] font-mono font-semibold uppercase text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                Pattern: Request Deduplication
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-1">SHA-256 Idempotency Key Gate</h3>
              <p className="text-xs text-slate-500">
                Prevents duplicate workflow executions caused by client network retries or timeouts.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Idempotency-Key Header</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={idempKey}
                    onChange={(e) => setIdempKey(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono text-xs focus:ring-1 focus:ring-slate-400"
                  />
                  <button
                    onClick={() => setIdempKey(`idemp-${Date.now().toString().slice(-6)}`)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium shrink-0 cursor-pointer"
                  >
                    Randomize
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Request Payload (JSON)</label>
                <textarea
                  rows={4}
                  value={idempPayload}
                  onChange={(e) => setIdempPayload(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono text-xs focus:ring-1 focus:ring-slate-400"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => handleTestIdempotency(false)}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Request (Idempotent)</span>
                </button>

                <button
                  onClick={() => handleTestIdempotency(true)}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Sends altered payload with the same key to verify HTTP 409 Conflict rejection"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Test Conflict (Altered Payload)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Idempotency Output */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Gateway Response Inspector</h3>
            {idempResult ? (
              <div className="space-y-3 animate-fadeIn text-xs font-mono">
                <div className={`p-3 rounded-lg border flex items-center gap-2 ${idempResult.status === 201 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : idempResult.status === 200 ? 'bg-sky-50 border-sky-200 text-sky-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                  {idempResult.status === 201 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : idempResult.status === 200 ? (
                    <Check className="w-4 h-4 text-sky-600 shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span className="font-bold">HTTP {idempResult.status} {idempResult.status === 201 ? 'Created' : idempResult.status === 200 ? 'OK (Replayed)' : 'Conflict'}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <div>
                    <span className="text-slate-500">Fingerprint:</span>
                    <div className="text-[11px] text-slate-800 truncate">{idempResult.fingerprint}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Message:</span>
                    <div className="text-slate-800 font-sans text-xs mt-0.5">{idempResult.message}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs italic border border-dashed border-slate-200 rounded-lg">
                Click one of the buttons on the left to simulate an idempotent request.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Outbox */}
      {activeTab === 'outbox' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-4">
          <div>
            <span className="text-[10px] font-mono font-semibold uppercase text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Pattern: Dual-Write Prevention
            </span>
            <h3 className="text-sm font-bold text-slate-900 mt-1">Transactional Outbox Table Records</h3>
            <p className="text-xs text-slate-500">
              Database events written atomically with business entities in PostgreSQL and published asynchronously to RabbitMQ.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2.5">Outbox ID</th>
                  <th className="px-4 py-2.5">Job UUID</th>
                  <th className="px-4 py-2.5">Event Type</th>
                  <th className="px-4 py-2.5">Published Status</th>
                  <th className="px-4 py-2.5">Created Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {outbox.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-bold text-slate-800">{rec.id}</td>
                    <td className="px-4 py-2.5 text-slate-700">{rec.jobId}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900">{rec.eventType}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${rec.published ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                        {rec.published ? 'PUBLISHED' : 'PENDING'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{new Date(rec.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Retries & DLQ */}
      {activeTab === 'retries' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-4">
          <div>
            <span className="text-[10px] font-mono font-semibold uppercase text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Pattern: Fault Isolation
            </span>
            <h3 className="text-sm font-bold text-slate-900 mt-1">Dead-Letter Queue Isolation (flowforge.job.dlq)</h3>
            <p className="text-xs text-slate-500">
              Failed messages exceeding the 3-attempt retry policy are isolated to prevent head-of-line blocking.
            </p>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {jobs.filter(j => j.status === 'FAILED' || j.status === 'DEAD_LETTERED').map((failedJob) => (
              <div key={failedJob.id} className="p-3 bg-rose-50/50 rounded-lg border border-rose-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-900">{failedJob.id}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                    Attempts: {failedJob.attemptCount} / {failedJob.maxAttempts}
                  </span>
                </div>
                <div className="text-slate-600 font-sans text-xs">
                  Reason: {failedJob.failureReason || 'Transient failure exhausted 3 retries'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Redis Locking */}
      {activeTab === 'locking' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-mono font-semibold uppercase text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                Pattern: Distributed Coordination
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-1">Redis Mutual Exclusion (SET NX PX + Lua Release)</h3>
              <p className="text-xs text-slate-500">
                Prevents duplicate concurrent execution across multiple worker nodes dequeuing the same job.
              </p>
            </div>

            <button
              onClick={runRedisLockSimulation}
              disabled={simulatingLock}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 cursor-pointer shrink-0"
            >
              {simulatingLock ? 'Simulating...' : 'Simulate Redis Mutex Contention'}
            </button>
          </div>

          {/* Console Output */}
          <div className="bg-navy-950 p-4 rounded-xl border border-navy-800 text-xs font-mono space-y-1 min-h-[160px]">
            <div className="text-slate-400 text-[11px] pb-2 border-b border-navy-800">
              Redis Cluster Simulation Console (Port 6379)
            </div>
            {lockLog.length === 0 ? (
              <div className="text-slate-500 py-6 text-center italic">
                Click &quot;Simulate Redis Mutex Contention&quot; to test 2 workers competing for the same lock.
              </div>
            ) : (
              lockLog.map((log, idx) => (
                <div key={idx} className={`leading-relaxed ${log.includes('OK') ? 'text-emerald-400' : log.includes('nil') || log.includes('failed') ? 'text-amber-400' : 'text-slate-300'}`}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
