export type ApiLifecycleStatus = 'DRAFT' | 'PUBLISHED' | 'DEPRECATED' | 'RETIRED';

export interface ApiDefinition {
  id: string;
  name: string;
  version: string;
  basePath: string;
  backendUrl: string;
  description: string;
  status: ApiLifecycleStatus;
  wso2ApiId?: string;
  gatewayUrl?: string;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowTriggerType = 'API_INVOCATION' | 'SCHEDULED_BATCH' | 'EVENT_STREAM' | 'MANUAL';
export type WorkflowStatus = 'ACTIVE' | 'PAUSED';

export interface WorkflowDefinition {
  id: string;
  name: string;
  code: string;
  description: string;
  associatedApiId?: string;
  triggerType: WorkflowTriggerType;
  defaultPayload: string;
  status: WorkflowStatus;
  totalExecutions: number;
  lastExecutedAt?: string;
}

export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'RETRYING' | 'FAILED' | 'DEAD_LETTERED';

export interface JobExecution {
  id: string;
  workflowId?: string;
  workflowName: string;
  type: string;
  idempotencyKey?: string;
  requestFingerprint?: string;
  requestPayload: string;
  status: JobStatus;
  attemptCount: number;
  maxAttempts: number;
  result?: string;
  failureReason?: string;
  workerId?: string;
  lockToken?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  executionSteps: Array<{
    step: string;
    timestamp: string;
    status: 'PENDING' | 'SUCCESS' | 'FAILED';
    detail: string;
  }>;
}

export interface OutboxRecord {
  id: string;
  jobId: string;
  eventType: string;
  messagePayload: string;
  published: boolean;
  createdAt: string;
  publishedAt?: string;
}

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  component: 'GATEWAY' | 'API_CONTROLLER' | 'OUTBOX' | 'RABBITMQ' | 'WORKER' | 'REDIS_LOCK' | 'POSTGRES';
  message: string;
  correlationId: string;
  jobId?: string;
}

export interface FlowForgeStats {
  totalApis: number;
  activeWorkflows: number;
  totalJobs: number;
  completedJobs: number;
  inFlightJobs: number;
  retryingJobs: number;
  deadLetterJobs: number;
  successRate: number;
  averageLatencyMs: number;
}

export type ActiveView = 
  | 'overview' 
  | 'apis' 
  | 'workflows' 
  | 'jobs' 
  | 'reliability' 
  | 'observability' 
  | 'architecture' 
  | 'evidence';
