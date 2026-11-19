import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ApiDefinition, 
  WorkflowDefinition, 
  JobExecution, 
  OutboxRecord, 
  AuditLogEntry, 
  FlowForgeStats, 
  ActiveView, 
  ApiLifecycleStatus 
} from '../types';
import { 
  INITIAL_APIS, 
  INITIAL_WORKFLOWS, 
  INITIAL_JOBS, 
  INITIAL_OUTBOX, 
  INITIAL_LOGS 
} from '../data/seedData';

// Simple deterministic hash for synchronous fingerprinting fallback
function computeSha256Fallback(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return hex.repeat(8).substring(0, 64);
}

interface SubmitJobResult {
  success: boolean;
  job?: JobExecution;
  isReplay: boolean;
  status: number;
  message: string;
}

interface ShowcaseContextType {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  apis: ApiDefinition[];
  workflows: WorkflowDefinition[];
  jobs: JobExecution[];
  outbox: OutboxRecord[];
  logs: AuditLogEntry[];
  stats: FlowForgeStats;
  selectedJobId: string | null;
  selectedApiId: string | null;
  selectJob: (id: string | null) => void;
  selectApi: (id: string | null) => void;
  registerApi: (api: Omit<ApiDefinition, 'id' | 'createdAt' | 'updatedAt' | 'ownerEmail'>) => ApiDefinition;
  updateApiStatus: (id: string, status: ApiLifecycleStatus) => void;
  deleteApi: (id: string) => void;
  submitJob: (params: { type: string; payload: string; idempotencyKey?: string; workflowId?: string }) => SubmitJobResult;
  retryJob: (jobId: string) => void;
  resetDemoData: () => void;
  isWorkerActive: boolean;
  currentSimulatingJobId: string | null;
}

const STORAGE_KEY_PREFIX = 'flowforge_showcase_v1_';

const ShowcaseContext = createContext<ShowcaseContextType | undefined>(undefined);

export const ShowcaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedApiId, setSelectedApiId] = useState<string | null>(null);
  const [isWorkerActive] = useState<boolean>(true);
  const [currentSimulatingJobId, setCurrentSimulatingJobId] = useState<string | null>(null);

  // Initialize state from localStorage with fallback to seeds
  const [apis, setApis] = useState<ApiDefinition[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}apis`);
      return saved ? JSON.parse(saved) : INITIAL_APIS;
    } catch {
      return INITIAL_APIS;
    }
  });

  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}workflows`);
      return saved ? JSON.parse(saved) : INITIAL_WORKFLOWS;
    } catch {
      return INITIAL_WORKFLOWS;
    }
  });

  const [jobs, setJobs] = useState<JobExecution[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}jobs`);
      return saved ? JSON.parse(saved) : INITIAL_JOBS;
    } catch {
      return INITIAL_JOBS;
    }
  });

  const [outbox, setOutbox] = useState<OutboxRecord[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}outbox`);
      return saved ? JSON.parse(saved) : INITIAL_OUTBOX;
    } catch {
      return INITIAL_OUTBOX;
    }
  });

  const [logs, setLogs] = useState<AuditLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}logs`);
      return saved ? JSON.parse(saved) : INITIAL_LOGS;
    } catch {
      return INITIAL_LOGS;
    }
  });

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}apis`, JSON.stringify(apis));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}workflows`, JSON.stringify(workflows));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}jobs`, JSON.stringify(jobs));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}outbox`, JSON.stringify(outbox));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}logs`, JSON.stringify(logs));
    } catch {
      // Ignore quota/private browsing issues
    }
  }, [apis, workflows, jobs, outbox, logs]);

  // Derived unified statistics (100% consistent across all cards and views)
  const stats: FlowForgeStats = useMemo(() => {
    const totalJobs = jobs.length;
    const completedJobs = jobs.filter(j => j.status === 'COMPLETED').length;
    const inFlightJobs = jobs.filter(j => j.status === 'QUEUED' || j.status === 'PROCESSING').length;
    const retryingJobs = jobs.filter(j => j.status === 'RETRYING').length;
    const deadLetterJobs = jobs.filter(j => j.status === 'FAILED' || j.status === 'DEAD_LETTERED').length;
    const activeWorkflows = workflows.filter(w => w.status === 'ACTIVE').length;
    
    const rate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 100;

    return {
      totalApis: apis.length,
      activeWorkflows,
      totalJobs,
      completedJobs,
      inFlightJobs,
      retryingJobs,
      deadLetterJobs,
      successRate: rate,
      averageLatencyMs: 42,
    };
  }, [apis, workflows, jobs]);

  // Add audit log helper
  const addLog = useCallback((entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
    const now = new Date();
    const timeStr = `${now.toTimeString().split(' ')[0]}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    const newLog: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: timeStr,
      ...entry,
    };
    setLogs(prev => [newLog, ...prev.slice(0, 99)]);
  }, []);

  // Reset Demo to initial state
  const resetDemoData = useCallback(() => {
    setApis(INITIAL_APIS);
    setWorkflows(INITIAL_WORKFLOWS);
    setJobs(INITIAL_JOBS);
    setOutbox(INITIAL_OUTBOX);
    setLogs(INITIAL_LOGS);
    setSelectedJobId(null);
    setSelectedApiId(null);
    setCurrentSimulatingJobId(null);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}apis`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}workflows`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}jobs`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}outbox`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}logs`);
  }, []);

  // Register API Definition
  const registerApi = useCallback((apiData: Omit<ApiDefinition, 'id' | 'createdAt' | 'updatedAt' | 'ownerEmail'>): ApiDefinition => {
    const id = `api-${Date.now()}`;
    const wso2Id = `${Math.random().toString(36).substring(2, 10)}-${Math.random().toString(36).substring(2, 6)}-4000-8000-${Math.random().toString(36).substring(2, 14)}`;
    const gatewayUrl = `https://gateway.flowforge.local:8243${apiData.basePath}/${apiData.version}`;
    
    const newApi: ApiDefinition = {
      ...apiData,
      id,
      wso2ApiId: apiData.status === 'PUBLISHED' ? wso2Id : undefined,
      gatewayUrl: apiData.status === 'PUBLISHED' ? gatewayUrl : undefined,
      ownerEmail: 'admin@flowforge.local',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setApis(prev => [newApi, ...prev]);

    addLog({
      level: 'INFO',
      component: 'API_CONTROLLER',
      message: `Registered new API definition: ${newApi.name} [basePath=${newApi.basePath}, status=${newApi.status}]`,
      correlationId: `corr-api-${Date.now()}`
    });

    if (newApi.status === 'PUBLISHED') {
      addLog({
        level: 'SUCCESS',
        component: 'GATEWAY',
        message: `Dynamic WSO2 APIM Publisher deployment verified: API ID ${wso2Id} live on ${gatewayUrl}`,
        correlationId: `corr-wso2-${Date.now()}`
      });
    }

    return newApi;
  }, [addLog]);

  // Update API status
  const updateApiStatus = useCallback((id: string, status: ApiLifecycleStatus) => {
    setApis(prev => prev.map(api => {
      if (api.id !== id) return api;
      const wso2Id = api.wso2ApiId || `${Math.random().toString(36).substring(2, 10)}-${Math.random().toString(36).substring(2, 6)}-4000-8000-${Math.random().toString(36).substring(2, 14)}`;
      const gatewayUrl = api.gatewayUrl || `https://gateway.flowforge.local:8243${api.basePath}/${api.version}`;
      
      return {
        ...api,
        status,
        wso2ApiId: status === 'PUBLISHED' ? wso2Id : api.wso2ApiId,
        gatewayUrl: status === 'PUBLISHED' ? gatewayUrl : api.gatewayUrl,
        updatedAt: new Date().toISOString()
      };
    }));

    addLog({
      level: 'INFO',
      component: 'GATEWAY',
      message: `API ${id} status updated to ${status}`,
      correlationId: `corr-lifecycle-${Date.now()}`
    });
  }, [addLog]);

  // Delete API
  const deleteApi = useCallback((id: string) => {
    setApis(prev => prev.filter(a => a.id !== id));
    addLog({
      level: 'WARN',
      component: 'API_CONTROLLER',
      message: `API definition ${id} removed from catalog`,
      correlationId: `corr-del-${Date.now()}`
    });
  }, [addLog]);

  // Asynchronous Worker Simulation Engine
  const executeJobLifecycle = useCallback((jobId: string, type: string) => {
    setCurrentSimulatingJobId(jobId);
    const corrId = `corr-${jobId.substring(0, 8)}`;
    const lockToken = `token-${Math.random().toString(36).substring(2, 10)}`;

    // Stage 1: OUTBOX SWEEP (500ms)
    setTimeout(() => {
      setOutbox(prev => prev.map(o => o.jobId === jobId ? { ...o, published: true, publishedAt: new Date().toISOString() } : o));
      addLog({
        level: 'INFO',
        component: 'OUTBOX',
        message: `OutboxPublisher swept pending event for job ${jobId.substring(0, 8)}; published to RabbitMQ exchange flowforge.job.exchange`,
        correlationId: corrId,
        jobId
      });

      setJobs(prev => prev.map(j => {
        if (j.id !== jobId) return j;
        return {
          ...j,
          status: 'PROCESSING',
          workerId: 'worker-node-1',
          lockToken,
          startedAt: new Date().toISOString(),
          executionSteps: [
            ...j.executionSteps,
            { step: 'OUTBOX_PUBLISHED', timestamp: new Date().toLocaleTimeString(), status: 'SUCCESS', detail: 'Event published to RabbitMQ queue flowforge.job.queue' },
            { step: 'REDIS_LOCK_ACQUIRED', timestamp: new Date().toLocaleTimeString(), status: 'SUCCESS', detail: `Acquired SET lock:job:${jobId.substring(0, 8)} ${lockToken} NX PX 60000` }
          ]
        };
      }));

      // Stage 2: EXECUTION & WORKER DISPATCH (1200ms)
      setTimeout(() => {
        if (type === 'TRANSIENT_FAILURE') {
          // Failure scenario demonstrating 3-attempt delayed retry pipeline
          setJobs(prev => prev.map(j => {
            if (j.id !== jobId) return j;
            return {
              ...j,
              status: 'FAILED',
              attemptCount: 3,
              failureReason: 'Transient job execution failed on attempt 3. Exhausted 3 retries over 5-second TTL queue; routed to flowforge.job.dlq.',
              completedAt: new Date().toISOString(),
              executionSteps: [
                ...j.executionSteps,
                { step: 'ATTEMPT_1_FAILED', timestamp: new Date().toLocaleTimeString(), status: 'FAILED', detail: 'Downstream timeout. Routed to flowforge.job.retry.queue (TTL 5000ms).' },
                { step: 'ATTEMPT_2_FAILED', timestamp: new Date().toLocaleTimeString(), status: 'FAILED', detail: 'Retry attempt 2 timed out. Re-routed to retry queue.' },
                { step: 'ATTEMPT_3_FAILED', timestamp: new Date().toLocaleTimeString(), status: 'FAILED', detail: 'Attempt 3 failed. Threshold reached.' },
                { step: 'DLQ_ISOLATION', timestamp: new Date().toLocaleTimeString(), status: 'FAILED', detail: 'Quarantined in flowforge.job.dlq. State FAILED.' }
              ]
            };
          }));

          addLog({
            level: 'ERROR',
            component: 'RABBITMQ',
            message: `Job ${jobId.substring(0, 8)} failed 3 attempts. Routed to Dead-Letter Queue (flowforge.job.dlq)`,
            correlationId: corrId,
            jobId
          });
          setCurrentSimulatingJobId(null);
        } else if (type === 'POISON_PILL_DLQ' || type === 'UNSUPPORTED_TYPE') {
          // Direct DLQ routing
          setJobs(prev => prev.map(j => {
            if (j.id !== jobId) return j;
            return {
              ...j,
              status: 'DEAD_LETTERED',
              attemptCount: 1,
              failureReason: 'Fatal schema validation error or unsupported execution type. Immediate DLQ dispatch.',
              completedAt: new Date().toISOString(),
              executionSteps: [
                ...j.executionSteps,
                { step: 'FATAL_ERROR', timestamp: new Date().toLocaleTimeString(), status: 'FAILED', detail: 'Schema parser exception detected.' },
                { step: 'DLQ_DISPATCH', timestamp: new Date().toLocaleTimeString(), status: 'FAILED', detail: 'Delivered directly to flowforge.job.dlq' }
              ]
            };
          }));

          addLog({
            level: 'ERROR',
            component: 'RABBITMQ',
            message: `Poison message ${jobId.substring(0, 8)} isolated into DLQ`,
            correlationId: corrId,
            jobId
          });
          setCurrentSimulatingJobId(null);
        } else {
          // Standard successful execution
          const resultPayload = JSON.stringify({
            status: "SUCCESS",
            jobId,
            type,
            processedAt: new Date().toISOString(),
            throughputMs: 18,
            worker: "worker-node-1"
          }, null, 2);

          setJobs(prev => prev.map(j => {
            if (j.id !== jobId) return j;
            return {
              ...j,
              status: 'COMPLETED',
              attemptCount: 1,
              result: resultPayload,
              completedAt: new Date().toISOString(),
              executionSteps: [
                ...j.executionSteps,
                { step: 'EXECUTION_SUCCESS', timestamp: new Date().toLocaleTimeString(), status: 'SUCCESS', detail: 'Payload processed successfully by worker consumer.' },
                { step: 'LUA_LOCK_RELEASE', timestamp: new Date().toLocaleTimeString(), status: 'SUCCESS', detail: 'Atomic Lua release verified token; lock cleared.' },
                { step: 'POSTGRES_STATE_FINAL', timestamp: new Date().toLocaleTimeString(), status: 'SUCCESS', detail: 'Status updated to COMPLETED in database.' }
              ]
            };
          }));

          addLog({
            level: 'SUCCESS',
            component: 'WORKER',
            message: `Job ${jobId.substring(0, 8)} successfully completed [type=${type}]`,
            correlationId: corrId,
            jobId
          });

          addLog({
            level: 'INFO',
            component: 'REDIS_LOCK',
            message: `Released distributed lock for job ${jobId.substring(0, 8)} via atomic Lua script`,
            correlationId: corrId,
            jobId
          });
          setCurrentSimulatingJobId(null);
        }
      }, 1200);
    }, 600);
  }, [addLog]);

  // Submit Job with Idempotency Verification
  const submitJob = useCallback((params: {
    type: string;
    payload: string;
    idempotencyKey?: string;
    workflowId?: string;
  }): SubmitJobResult => {
    const { type, payload, idempotencyKey, workflowId } = params;
    const key = idempotencyKey?.trim() || `idemp-auto-${Date.now()}`;
    const fingerprint = computeSha256Fallback(payload);

    // Check existing jobs with this Idempotency-Key
    const existingJob = jobs.find(j => j.idempotencyKey === key);

    if (existingJob) {
      if (existingJob.requestFingerprint === fingerprint) {
        // IDENTICAL PAYLOAD => Replay existing job result (HTTP 200)
        addLog({
          level: 'INFO',
          component: 'API_CONTROLLER',
          message: `Idempotency match: key=${key}. Replaying cached execution for job ${existingJob.id.substring(0, 8)} (HTTP 200 OK)`,
          correlationId: `corr-idemp-${Date.now()}`,
          jobId: existingJob.id
        });

        return {
          success: true,
          job: existingJob,
          isReplay: true,
          status: 200,
          message: `Idempotent request replayed. Returning existing job ${existingJob.id.substring(0, 8)}.`
        };
      } else {
        // CONFLICTING PAYLOAD => Reject with HTTP 409 Conflict
        addLog({
          level: 'ERROR',
          component: 'API_CONTROLLER',
          message: `Idempotency conflict: key=${key} submitted with differing payload fingerprint. (HTTP 409 Conflict)`,
          correlationId: `corr-idemp-${Date.now()}`
        });

        return {
          success: false,
          isReplay: false,
          status: 409,
          message: `HTTP 409 Conflict: Idempotency-Key "${key}" already used with different request payload.`
        };
      }
    }

    // NEW UNIQUE JOB
    const newJobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const matchedWf = workflows.find(w => w.id === workflowId || w.code === type);
    const wfName = matchedWf ? matchedWf.name : `${type} Handler`;

    const newJob: JobExecution = {
      id: newJobId,
      workflowId: matchedWf?.id,
      workflowName: wfName,
      type,
      idempotencyKey: key,
      requestFingerprint: fingerprint,
      requestPayload: payload,
      status: 'QUEUED',
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionSteps: [
        { step: 'POST /api/jobs', timestamp: new Date().toLocaleTimeString(), status: 'SUCCESS', detail: `Accepted with Idempotency-Key: ${key}` },
        { step: 'POSTGRES_ATOMIC_WRITE', timestamp: new Date().toLocaleTimeString(), status: 'SUCCESS', detail: 'Committed to jobs & outbox_events tables atomically.' }
      ]
    };

    // New Outbox event created atomically
    const newOutbox: OutboxRecord = {
      id: `outbox-${Date.now()}`,
      jobId: newJobId,
      eventType: 'JOB_SUBMITTED',
      messagePayload: JSON.stringify({ jobId: newJobId, type, payload }),
      published: false,
      createdAt: new Date().toISOString()
    };

    setJobs(prev => [newJob, ...prev]);
    setOutbox(prev => [newOutbox, ...prev]);

    // Update workflow executions count
    if (matchedWf) {
      setWorkflows(prev => prev.map(w => w.id === matchedWf.id ? { ...w, totalExecutions: w.totalExecutions + 1, lastExecutedAt: new Date().toISOString() } : w));
    }

    addLog({
      level: 'SUCCESS',
      component: 'POSTGRES',
      message: `Atomic commit: Job ${newJobId.substring(0, 8)} [type=${type}] and OutboxEvent recorded`,
      correlationId: `corr-${newJobId.substring(0, 8)}`,
      jobId: newJobId
    });

    // Trigger asynchronous execution sequence
    executeJobLifecycle(newJobId, type);

    return {
      success: true,
      job: newJob,
      isReplay: false,
      status: 201,
      message: `Job ${newJobId.substring(0, 8)} created successfully.`
    };
  }, [jobs, workflows, addLog, executeJobLifecycle]);

  // Retry Failed or Dead-Lettered Job
  const retryJob = useCallback((jobId: string) => {
    const target = jobs.find(j => j.id === jobId);
    if (!target) return;

    const corrId = `corr-retry-${Date.now()}`;

    addLog({
      level: 'INFO',
      component: 'API_CONTROLLER',
      message: `Manual recovery initiated for job ${jobId.substring(0, 8)} (POST /api/jobs/${jobId.substring(0, 8)}/retry). Resetting attempt count to 0.`,
      correlationId: corrId,
      jobId
    });

    setJobs(prev => prev.map(j => {
      if (j.id !== jobId) return j;
      return {
        ...j,
        status: 'QUEUED',
        attemptCount: 0,
        failureReason: undefined,
        updatedAt: new Date().toISOString(),
        executionSteps: [
          ...j.executionSteps,
          { step: 'MANUAL_RETRY_TRIGGERED', timestamp: new Date().toLocaleTimeString(), status: 'SUCCESS', detail: 'Operator triggered POST /api/jobs/{id}/retry. Re-enqueued.' }
        ]
      };
    }));

    // Trigger re-execution
    executeJobLifecycle(jobId, target.type);
  }, [jobs, addLog, executeJobLifecycle]);

  return (
    <ShowcaseContext.Provider value={{
      activeView,
      setActiveView,
      apis,
      workflows,
      jobs,
      outbox,
      logs,
      stats,
      selectedJobId,
      selectedApiId,
      selectJob: setSelectedJobId,
      selectApi: setSelectedApiId,
      registerApi,
      updateApiStatus,
      deleteApi,
      submitJob,
      retryJob,
      resetDemoData,
      isWorkerActive,
      currentSimulatingJobId
    }}>
      {children}
    </ShowcaseContext.Provider>
  );
};

export const useShowcase = (): ShowcaseContextType => {
  const context = useContext(ShowcaseContext);
  if (!context) {
    throw new Error('useShowcase must be used within a ShowcaseProvider');
  }
  return context;
};
