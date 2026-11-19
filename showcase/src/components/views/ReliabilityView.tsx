import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Send, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Play, 
  Check, 
  X 
} from 'lucide-react';
import { useShowcase } from '../../context/ShowcaseContext';

export const ReliabilityView: React.FC = () => {
  const { outbox, jobs, submitJob, retryJob } = useShowcase();

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
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-forge-teal" />
            Reliability & Fault-Tolerance Engineering Sandbox
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Core distributed systems patterns implemented in FlowForge to eliminate message loss, race conditions, and duplicates.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-medium">
          <button
            onClick={() => setActiveTab('idempotency')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${activeTab === 'idempotency' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            1. Idempotency
          </button>
          <button
            onClick={() => setActiveTab('outbox')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${activeTab === 'outbox' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            2. Transactional Outbox
          </button>
          <button
            onClick={() => setActiveTab('retries')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${activeTab === 'retries' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            3. Retries & DLQ
          </button>
          <button
            onClick={() => setActiveTab('locking')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${activeTab === 'locking' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
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
              <span className="text-[10px] font-mono font-semibold uppercase text-teal-600 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                Pattern: Request Deduplication
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-1">SHA-256 Idempotency Key Gate</h3>
              <p className="text-xs text-slate-500">
                Prevents accidental duplicate financial transactions caused by client network timeouts or retries.
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:ring-1 focus:ring-forge-teal"
                  />
                  <button
                    onClick={() => setIdempKey(`idemp-${Date.now().toString().slice(-6)}`)}
                    className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium shrink-0 cursor-pointer"
                  >
                    Randomize
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">JSON Payload</label>
                <textarea
                  rows={5}
                  value={idempPayload}
                  onChange={(e) => setIdempPayload(e.target.value)}
                  className="w-full p-3 font-mono text-xs bg-navy-950 text-emerald-400 rounded-lg border border-navy-800"
                />
              </div>

              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => handleTestIdempotency(false)}
                  className="px-4 py-2 bg-forge-teal hover:bg-teal-700 text-white font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>1. Submit Request (Initial or Replay)</span>
                </button>

                <button
                  onClick={() => handleTestIdempotency(true)}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-medium rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>2. Submit Same Key with Tampered Payload</span>
                </button>
              </div>
            </div>

            {idempResult && (
              <div className={`p-4 rounded-lg border text-xs space-y-1.5 ${idempResult.status === 201 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : idempResult.status === 200 ? 'bg-sky-50 border-sky-200 text-sky-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                <div className="font-bold flex items-center gap-2 text-sm font-mono">
                  {idempResult.status === 201 && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  {idempResult.status === 200 && <RotateCcw className="w-4 h-4 text-sky-600" />}
                  {idempResult.status === 409 && <X className="w-4 h-4 text-rose-600" />}
                  HTTP {idempResult.status} {idempResult.status === 201 ? 'CREATED' : idempResult.status === 200 ? 'OK (CACHED REPLAY)' : 'CONFLICT'}
                </div>
                <p className="leading-relaxed font-sans">{idempResult.message}</p>
                <div className="text-[11px] font-mono text-slate-500 truncate pt-1">
                  SHA-256 Fingerprint: {idempResult.fingerprint}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900">How FlowForge Implements Idempotency</h3>
            
            <div className="space-y-3 text-slate-600 leading-relaxed">
              <p>
                In distributed financial platforms like LSEG, network partitions can cause clients to timeout and resend an order request even though the backend already received and processed it.
              </p>
              
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="font-semibold text-slate-800">Deterministic FlowForge Behavior:</div>
                <ul className="space-y-1.5 list-disc list-inside">
                  <li><strong>First Submission:</strong> Backend hashes the payload with SHA-256 and persists <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">idempotency_key</code> and <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">request_fingerprint</code> inside PostgreSQL. Returns <strong>HTTP 201 Created</strong>.</li>
                  <li><strong>Identical Replay:</strong> If a subsequent request matches both key and fingerprint, FlowForge immediately returns the cached execution result with <strong>HTTP 200 OK</strong>. No second job is submitted.</li>
                  <li><strong>Payload Mismatch Conflict:</strong> If the key matches but the payload hash differs, FlowForge returns <strong>HTTP 409 Conflict</strong> to reject payload tampering.</li>
                </ul>
              </div>

              <div className="p-3 bg-navy-950 rounded-lg text-emerald-400 font-mono text-[11px] space-y-1 border border-navy-800">
                <div className="text-slate-400">// PostgreSQL Schema Constraint:</div>
                <div>CREATE UNIQUE INDEX idx_jobs_idempotency_key</div>
                <div>ON jobs (idempotency_key) WHERE idempotency_key IS NOT NULL;</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Transactional Outbox */}
      {activeTab === 'outbox' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-4">
            <div>
              <span className="text-[10px] font-mono font-semibold uppercase text-teal-600 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                Pattern: Dual-Write Consistency
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-1">Transactional Outbox Pattern</h3>
              <p className="text-xs text-slate-500">
                Guarantees at-least-once message delivery between PostgreSQL and RabbitMQ without 2-phase commit overhead.
              </p>
            </div>

            {/* Visual 5-Stage Stepper */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs font-mono">
              <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 space-y-1">
                <div className="font-bold text-[10px] uppercase text-teal-700">Stage 1: API Request</div>
                <div className="text-xs font-sans">POST /api/jobs received by Spring Boot controller.</div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
                <div className="font-bold text-[10px] uppercase text-emerald-700">Stage 2: Atomic TX</div>
                <div className="text-xs font-sans">Job & OutboxEvent committed in single DB transaction.</div>
              </div>

              <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 space-y-1">
                <div className="font-bold text-[10px] uppercase text-indigo-700">Stage 3: Poller Sweep</div>
                <div className="text-xs font-sans">Scheduled poller runs SELECT ... FOR UPDATE SKIP LOCKED.</div>
              </div>

              <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 space-y-1">
                <div className="font-bold text-[10px] uppercase text-sky-700">Stage 4: Broker Ack</div>
                <div className="text-xs font-sans">RabbitMQ receives message to flowforge.job.exchange.</div>
              </div>

              <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 space-y-1">
                <div className="font-bold text-[10px] uppercase text-purple-700">Stage 5: State Marked</div>
                <div className="text-xs font-sans">Outbox event marked published=true in PostgreSQL.</div>
              </div>
            </div>
          </div>

          {/* Outbox Records Table */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 font-mono">TABLE outbox_events (Live PostgreSQL Records)</h4>
                <p className="text-[11px] text-slate-500">Polled every 1,000ms by OutboxPublisher background thread</p>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                Total Events: {outbox.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2.5">Outbox ID</th>
                    <th className="px-4 py-2.5">Associated Job ID</th>
                    <th className="px-4 py-2.5">Event Type</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Created At</th>
                    <th className="px-4 py-2.5">Published At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {outbox.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-900">{rec.id}</td>
                      <td className="px-4 py-3 text-slate-700">{rec.jobId.substring(0, 16)}...</td>
                      <td className="px-4 py-3 text-indigo-700">{rec.eventType}</td>
                      <td className="px-4 py-3">
                        {rec.published ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
                            <Check className="w-3 h-3 text-emerald-600" /> PUBLISHED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px]">
                            PENDING SWEEP
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{new Date(rec.createdAt).toLocaleTimeString()}</td>
                      <td className="px-4 py-3 text-slate-500">{rec.publishedAt ? new Date(rec.publishedAt).toLocaleTimeString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Retries & DLQ */}
      {activeTab === 'retries' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-4">
            <div>
              <span className="text-[10px] font-mono font-semibold uppercase text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                Pattern: Dead-Letter Queue & Non-Blocking Exponential Delay
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-1">RabbitMQ Delayed Retries (5s TTL) & Manual Recovery</h3>
              <p className="text-xs text-slate-500">
                Isolates poison messages and downstream transient timeouts without blocking the primary worker queue.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="text-slate-500 uppercase text-[10px] font-bold">1. Primary Queue</div>
                <div className="text-slate-900 font-bold">flowforge.job.queue</div>
                <p className="text-[11px] text-slate-500 font-sans">
                  Immediate consumer processing. If transient failure occurs on Attempt 1 or 2, worker publishes to retry queue.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-1.5">
                <div className="text-amber-700 uppercase text-[10px] font-bold">2. Delayed Queue (5s TTL)</div>
                <div className="text-amber-900 font-bold">flowforge.job.retry.queue</div>
                <p className="text-[11px] text-amber-700 font-sans">
                  Holds message for 5000ms. Upon expiration, RabbitMQ DLX routes it back to the primary worker queue.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 space-y-1.5">
                <div className="text-rose-700 uppercase text-[10px] font-bold">3. Dead-Letter Queue</div>
                <div className="text-rose-900 font-bold">flowforge.job.dlq</div>
                <p className="text-[11px] text-rose-700 font-sans">
                  Poison pills or jobs exceeding 3 attempts are permanently quarantined for operator review and manual recovery.
                </p>
              </div>
            </div>
          </div>

          {/* Dead-Lettered Jobs Recovery Table */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 font-mono">Quarantined DLQ Jobs (Pending Operator Recovery)</h4>
                <p className="text-[11px] text-slate-500">Jobs routed to flowforge.job.dlq after exhausting 3 attempts</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2.5">Job ID</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">Attempts</th>
                    <th className="px-4 py-2.5">Diagnostic Reason</th>
                    <th className="px-4 py-2.5 text-right">Recovery Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobs.filter(j => j.status === 'FAILED' || j.status === 'DEAD_LETTERED').length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-400 font-sans">
                        No quarantined jobs in DLQ. All workflows healthy!
                      </td>
                    </tr>
                  ) : (
                    jobs.filter(j => j.status === 'FAILED' || j.status === 'DEAD_LETTERED').map((j) => (
                      <tr key={j.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-rose-900">{j.id}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{j.type}</td>
                        <td className="px-4 py-3 font-bold text-rose-700">{j.attemptCount} / 3</td>
                        <td className="px-4 py-3 text-slate-600 font-sans text-xs max-w-sm truncate">
                          {j.failureReason || 'Exhausted retry threshold'}
                        </td>
                        <td className="px-4 py-3 text-right font-sans">
                          <button
                            onClick={() => retryJob(j.id)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-forge-teal hover:bg-teal-700 text-white font-semibold text-xs rounded shadow-sm transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Retry (POST /api/jobs/{j.id.substring(0, 8)}/retry)</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Redis Distributed Locking */}
      {activeTab === 'locking' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-4">
            <div>
              <span className="text-[10px] font-mono font-semibold uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                Pattern: Distributed Mutual Exclusion
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-1">Redis SET NX PX + Atomic Lua Release</h3>
              <p className="text-xs text-slate-500">
                Prevents multiple worker replicas from executing the same job concurrently across horizontal pods.
              </p>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                In high-volume trading and financial architectures, horizontally autoscaled workers (e.g. 2–10 Kubernetes replicas) 
                can receive duplicate delivery of a message under network reconnection. Redis acts as a fast, cluster-safe mutex.
              </p>

              <button
                onClick={runRedisLockSimulation}
                disabled={simulatingLock}
                className="w-full py-2.5 px-4 rounded-lg bg-navy-950 text-teal-400 font-mono font-semibold text-xs hover:bg-navy-900 border border-navy-800 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{simulatingLock ? 'Simulating Lock Contention...' : 'Simulate 2 Workers Competing for Lock'}</span>
              </button>

              {lockLog.length > 0 && (
                <div className="p-3 bg-navy-950 rounded-lg border border-navy-800 space-y-1 font-mono text-[11px] text-slate-300 max-h-60 overflow-y-auto">
                  {lockLog.map((line, idx) => (
                    <div key={idx} className={line.includes('acquired') ? 'text-emerald-400 font-bold' : line.includes('failed') ? 'text-rose-400 font-bold' : ''}>
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900">Atomic Lock Specifications</h3>
            
            <div className="space-y-2 font-mono text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-500 text-[10px] uppercase font-bold">1. Lock Acquisition (RedisJobLockService.java)</div>
                <div className="text-slate-900 font-bold mt-1">redisTemplate.opsForValue().setIfAbsent(key, token, Duration.ofMillis(60000))</div>
                <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                  Generates unique UUID token per worker. Returns empty Optional if lock is already held.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-500 text-[10px] uppercase font-bold">2. Atomic Compare-and-Delete (Lua Release Script)</div>
                <div className="text-slate-900 font-bold mt-1">
                  if redis.call(&apos;get&apos;, KEYS[1]) == ARGV[1] then return redis.call(&apos;del&apos;, KEYS[1]) else return 0 end
                </div>
                <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                  Safe against clock skew. Ensures a slow worker whose TTL expired never accidentally deletes a lock acquired by a newer worker.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-500 text-[10px] uppercase font-bold">3. Fail-Closed Semantics</div>
                <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                  If Redis is unavailable or times out, workers refuse execution and nack rather than risk inconsistent dual execution.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
