export interface Job {
  id: string;
  type: string;
  requestPayload: string;
  result: string | null;
  status: string;
  attemptCount?: number;
  idempotencyKey?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiDefinition {
  id: number;
  name: string;
  description: string;
  version: string;
  basePath: string;
  backendUrl: string;
  status: string;
  wso2ApiId?: string | null;
  gatewayUrl?: string | null;
  createdAt?: string;
}

const STORAGE_PREFIX = 'flowforge_mock_';

export const SEED_APIS: ApiDefinition[] = [
  {
    id: 1,
    name: 'Inventory Service',
    description: 'Internal product inventory catalog & stock levels',
    version: 'v1',
    basePath: '/api/v1/inventory',
    backendUrl: 'http://localhost:8081',
    status: 'DRAFT',
    createdAt: '2026-08-27T10:15:00Z',
  },
  {
    id: 2,
    name: 'ffd',
    description: 'Fast feed dispatch service',
    version: 'v1',
    basePath: '/api/v1/',
    backendUrl: 'http://localhost:8081',
    status: 'DRAFT',
    createdAt: '2026-08-29T21:59:17Z',
  },
  {
    id: 3,
    name: 'Customer Billing API',
    description: 'Account balances and invoices',
    version: 'v1',
    basePath: '/billing',
    backendUrl: 'http://localhost:8081',
    status: 'DRAFT',
    createdAt: '2026-08-27T12:00:00Z',
  },
  {
    id: 4,
    name: 'Orders Service API',
    description: 'Legacy orders ingestion',
    version: 'v1',
    basePath: '/orders',
    backendUrl: 'http://localhost:8081',
    status: 'DEPRECATED',
    createdAt: '2026-08-26T14:30:00Z',
  },
  {
    id: 5,
    name: 'Customer Billing API',
    description: 'Billing gateway legacy v1',
    version: 'v1',
    basePath: '/billing',
    backendUrl: 'http://localhost:8081',
    status: 'DEPRECATED',
    createdAt: '2026-08-26T09:12:00Z',
  },
  {
    id: 6,
    name: 'Payments Gateway API',
    description: 'Real-time card and bank settlement',
    version: 'v1',
    basePath: '/payments',
    backendUrl: 'http://localhost:8081',
    status: 'PUBLISHED',
    wso2ApiId: '24800b1e-67d7-405c-a5b0-0dc45c7a9473',
    gatewayUrl: 'https://localhost:8243/payments/v1',
    createdAt: '2026-08-25T11:20:00Z',
  },
  {
    id: 7,
    name: 'Analytics Service API',
    description: 'Daily aggregation metrics',
    version: 'v1',
    basePath: '/analytics-860',
    backendUrl: 'http://localhost:8081',
    status: 'DEPRECATED',
    createdAt: '2026-08-24T16:45:00Z',
  },
];

// Seed jobs accurately reflecting the 63 total, 36 completed, 1 in-flight, 26 failed/DLQ metrics
function generateSeedJobs(): Job[] {
  const initial: Job[] = [
    {
      id: 'deb442c7-0e24-4ae7-a280-11fc25744067',
      type: 'ECHO',
      requestPayload: JSON.stringify({ message: 'phase7-final' }),
      result: JSON.stringify({ message: 'phase7-final' }),
      status: 'COMPLETED',
      attemptCount: 1,
      idempotencyKey: null,
      createdAt: '2026-08-27T16:44:16Z',
      updatedAt: '2026-08-27T16:44:17Z',
    },
    {
      id: '6b62bd17-91ac-469b-980b-29a3e6185cf3',
      type: 'ECHO',
      requestPayload: JSON.stringify({ message: 'batch-queued' }),
      result: null,
      status: 'QUEUED',
      attemptCount: 0,
      idempotencyKey: 'idemp-6b62bd17',
      createdAt: '2026-08-27T12:44:09Z',
      updatedAt: '2026-08-27T12:44:09Z',
    },
    {
      id: '6a7bc6b1-424a-463e-a1ec-d748c9092b6f',
      type: 'ECHO',
      requestPayload: JSON.stringify({ message: 'health-check' }),
      result: JSON.stringify({ status: 'OK' }),
      status: 'COMPLETED',
      attemptCount: 0,
      idempotencyKey: null,
      createdAt: '2026-08-27T12:47:34Z',
      updatedAt: '2026-08-27T12:47:35Z',
    },
    {
      id: 'd2a46e04-1234-4567-89ab-cdef01234a3d',
      type: 'ECHO',
      requestPayload: JSON.stringify({ message: 'order-submit' }),
      result: JSON.stringify({ orderId: 'ORD-101' }),
      status: 'COMPLETED',
      attemptCount: 1,
      idempotencyKey: null,
      createdAt: '2026-08-27T05:17:11Z',
      updatedAt: '2026-08-27T05:17:12Z',
    },
    {
      id: 'e1db7cd5-5555-4444-3333-222211113136',
      type: 'ECHO',
      requestPayload: JSON.stringify({ message: 'user-sync' }),
      result: JSON.stringify({ synced: true }),
      status: 'COMPLETED',
      attemptCount: 1,
      idempotencyKey: null,
      createdAt: '2026-08-27T01:48:25Z',
      updatedAt: '2026-08-27T01:48:26Z',
    },
    {
      id: 'c0dbc5e1-8888-7777-6666-55554444a298',
      type: 'ECHO',
      requestPayload: JSON.stringify({ message: 'reconciliation' }),
      result: JSON.stringify({ balanced: true }),
      status: 'COMPLETED',
      attemptCount: 1,
      idempotencyKey: null,
      createdAt: '2026-08-27T05:10:54Z',
      updatedAt: '2026-08-27T05:10:55Z',
    },
    {
      id: 'be60a0bc-9999-8888-7777-666655557eff',
      type: 'ECHO',
      requestPayload: JSON.stringify({ message: 'audit-log' }),
      result: JSON.stringify({ logged: true }),
      status: 'COMPLETED',
      attemptCount: 1,
      idempotencyKey: null,
      createdAt: '2026-08-27T05:11:40Z',
      updatedAt: '2026-08-27T05:11:41Z',
    },
    {
      id: 'a2aabd22-aaaa-bbbb-cccc-dddd2222297f',
      type: 'UNSUPPORTED_PHASES',
      requestPayload: JSON.stringify({ errorSimulation: 'dlq-poison-pill' }),
      result: 'Downstream timeout during processing: exceeded 3 retry attempts. Quarantined in flowforge.job.dlq.',
      status: 'FAILED',
      attemptCount: 1,
      idempotencyKey: null,
      createdAt: '2026-08-27T01:50:54Z',
      updatedAt: '2026-08-27T01:50:55Z',
    },
    {
      id: '987abbae-1111-2222-3333-444455552a4e',
      type: 'ECHO',
      requestPayload: JSON.stringify({ message: 'ping-5' }),
      result: JSON.stringify({ pong: true }),
      status: 'COMPLETED',
      attemptCount: 1,
      idempotencyKey: null,
      createdAt: '2026-08-27T05:12:01Z',
      updatedAt: '2026-08-27T05:12:02Z',
    },
    {
      id: 'e5b0eb67-6666-7777-8888-999900000184',
      type: 'ECHO',
      requestPayload: JSON.stringify({ message: 'init' }),
      result: JSON.stringify({ initialized: true }),
      status: 'COMPLETED',
      attemptCount: 1,
      idempotencyKey: null,
      createdAt: '2026-08-27T03:03:09Z',
      updatedAt: '2026-08-27T03:03:10Z',
    },
  ];

  // Fill up remaining to match exact counts: 36 completed, 1 in-flight (6b62bd17 is QUEUED), 26 failed/DLQ (total 63)
  const remainingCompleted = 36 - initial.filter(j => j.status === 'COMPLETED').length; // 36 - 8 = 28
  for (let i = 0; i < remainingCompleted; i++) {
    const hex = (i + 10).toString(16).padStart(4, '0');
    initial.push({
      id: `c${hex}9a12-3456-4789-abcd-${hex}ef012345`,
      type: 'ECHO',
      requestPayload: JSON.stringify({ batch: i + 1, task: 'settlement-check' }),
      result: JSON.stringify({ status: 'SUCCESS', recordCount: 15 }),
      status: 'COMPLETED',
      attemptCount: 1,
      idempotencyKey: null,
      createdAt: `2026-08-27T0${(i % 8) + 1}:20:00Z`,
      updatedAt: `2026-08-27T0${(i % 8) + 1}:20:01Z`,
    });
  }

  const remainingFailed = 26 - initial.filter(j => j.status === 'FAILED').length; // 26 - 1 = 25
  for (let i = 0; i < remainingFailed; i++) {
    const hex = (i + 50).toString(16).padStart(4, '0');
    initial.push({
      id: `f${hex}8b34-9876-4321-fedc-${hex}ab987654`,
      type: i % 2 === 0 ? 'TRANSIENT_FAILURE' : 'UNSUPPORTED_PHASES',
      requestPayload: JSON.stringify({ errorSimulation: `failure-${i + 1}` }),
      result: 'Downstream timeout during processing: exceeded 3 retry attempts. Quarantined in flowforge.job.dlq.',
      status: 'FAILED',
      attemptCount: 3,
      idempotencyKey: null,
      createdAt: `2026-08-27T0${(i % 7) + 1}:10:00Z`,
      updatedAt: `2026-08-27T0${(i % 7) + 1}:10:15Z`,
    });
  }

  return initial;
}

export const SEED_JOBS = generateSeedJobs();

export class MockServiceAdapter {
  private apis: ApiDefinition[];
  private jobs: Job[];

  constructor() {
    this.apis = this.loadFromStorage('apis', SEED_APIS);
    this.jobs = this.loadFromStorage('jobs', SEED_JOBS);
  }

  private loadFromStorage<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  }

  private saveToStorage(key: string, data: unknown): void {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(data));
    } catch {
      // ignore
    }
  }

  public getApis(): ApiDefinition[] {
    return [...this.apis];
  }

  public getJobs(): Job[] {
    return [...this.jobs];
  }

  public reset(): void {
    this.apis = [...SEED_APIS];
    this.jobs = [...SEED_JOBS];
    this.saveToStorage('apis', this.apis);
    this.saveToStorage('jobs', this.jobs);
  }

  public createDemoJob(type: 'ECHO' | 'TRANSIENT_FAILURE' = 'ECHO'): Promise<Job> {
    const newId = crypto.randomUUID ? crypto.randomUUID() : `job-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const isEcho = type === 'ECHO';
    const payload = isEcho
      ? JSON.stringify({
          action: 'DISPATCH_WORKFLOW',
          targetCatalog: this.apis.length > 0 ? this.apis[0].name : 'Default API',
          batchId: Math.floor(Math.random() * 9000) + 1000,
          timestamp: now,
        })
      : JSON.stringify({
          action: 'CIRCUIT_BREAKER_TEST',
          simulation: 'TRANSIENT_SERVICE_TIMEOUT',
          maxAllowedAttempts: 3,
          timestamp: now,
        });

    const newJob: Job = {
      id: newId,
      type,
      requestPayload: payload,
      result: null,
      status: 'PROCESSING',
      attemptCount: isEcho ? 1 : 1,
      idempotencyKey: `demo-${type.toLowerCase()}-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };

    this.jobs = [newJob, ...this.jobs];
    this.saveToStorage('jobs', this.jobs);

    // Simulate async processing
    setTimeout(() => {
      this.jobs = this.jobs.map(j => {
        if (j.id !== newId) return j;
        if (isEcho) {
          return {
            ...j,
            status: 'COMPLETED',
            result: JSON.stringify({
              status: 'SUCCESS',
              jobId: newId,
              processedAt: new Date().toISOString(),
              message: 'phase7-final'
            }),
            updatedAt: new Date().toISOString(),
          };
        } else {
          return {
            ...j,
            status: 'FAILED',
            attemptCount: 3,
            result: 'Downstream timeout during processing: exceeded 3 retry attempts. Quarantined in flowforge.job.dlq.',
            updatedAt: new Date().toISOString(),
          };
        }
      });
      this.saveToStorage('jobs', this.jobs);
    }, 1200);

    return Promise.resolve(newJob);
  }

  public retryJob(jobId: string): Promise<Job> {
    const target = this.jobs.find(j => j.id === jobId);
    if (!target) return Promise.reject(new Error('Job not found'));

    const now = new Date().toISOString();
    const updated: Job = {
      ...target,
      status: 'PROCESSING',
      attemptCount: 1,
      result: null,
      updatedAt: now,
    };

    this.jobs = this.jobs.map(j => j.id === jobId ? updated : j);
    this.saveToStorage('jobs', this.jobs);

    setTimeout(() => {
      this.jobs = this.jobs.map(j => {
        if (j.id !== jobId) return j;
        return {
          ...j,
          status: 'COMPLETED',
          result: JSON.stringify({
            status: 'SUCCESS_RECOVERED',
            jobId,
            recoveredAt: new Date().toISOString(),
            message: 'Manual retry executed successfully'
          }),
          updatedAt: new Date().toISOString(),
        };
      });
      this.saveToStorage('jobs', this.jobs);
    }, 1200);

    return Promise.resolve(updated);
  }

  public registerApi(params: {
    name: string;
    version: string;
    basePath: string;
    backendUrl: string;
    description?: string;
  }): Promise<ApiDefinition> {
    const nextId = this.apis.length > 0 ? Math.max(...this.apis.map(a => a.id)) + 1 : 1;
    const now = new Date().toISOString();
    const wso2Id = crypto.randomUUID ? crypto.randomUUID() : `${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;

    const newApi: ApiDefinition = {
      id: nextId,
      name: params.name,
      version: params.version,
      basePath: params.basePath,
      backendUrl: params.backendUrl,
      description: params.description || 'Custom registered enterprise service endpoint',
      status: 'PUBLISHED',
      wso2ApiId: wso2Id,
      gatewayUrl: `https://localhost:8243${params.basePath}/${params.version}`,
      createdAt: now,
    };

    this.apis = [newApi, ...this.apis];
    this.saveToStorage('apis', this.apis);
    return Promise.resolve(newApi);
  }

  public deprecateApi(apiId: number): Promise<ApiDefinition> {
    const target = this.apis.find(a => a.id === apiId);
    if (!target) return Promise.reject(new Error('API not found'));

    const updated: ApiDefinition = {
      ...target,
      status: 'DEPRECATED',
    };

    this.apis = this.apis.map(a => a.id === apiId ? updated : a);
    this.saveToStorage('apis', this.apis);
    return Promise.resolve(updated);
  }
}

export const mockService = new MockServiceAdapter();
