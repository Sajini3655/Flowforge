import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ShowcaseProvider, useShowcase } from '../context/ShowcaseContext';
import { DisclaimerBanner } from '../components/layout/DisclaimerBanner';
import { Sidebar } from '../components/layout/Sidebar';

// Test consumer component to expose context methods directly
let exposedContext: ReturnType<typeof useShowcase>;

const ContextConsumer: React.FC = () => {
  exposedContext = useShowcase();
  return <div data-testid="ready">Ready</div>;
};

const renderWithProvider = (ui?: React.ReactNode) => {
  return render(
    <ShowcaseProvider>
      {ui}
      <ContextConsumer />
    </ShowcaseProvider>
  );
};

describe('FlowForge Showcase — Core State & Reliability Testing', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('1. Initializes with correct seed data and unified statistics', () => {
    renderWithProvider();
    expect(exposedContext).toBeDefined();
    expect(exposedContext.apis.length).toBeGreaterThanOrEqual(4);
    expect(exposedContext.workflows.length).toBeGreaterThanOrEqual(4);
    expect(exposedContext.jobs.length).toBeGreaterThanOrEqual(5);
    expect(exposedContext.outbox.length).toBeGreaterThanOrEqual(3);
    
    // Stats consistency
    const { stats, jobs, apis } = exposedContext;
    expect(stats.totalApis).toBe(apis.length);
    expect(stats.totalJobs).toBe(jobs.length);
    expect(stats.completedJobs).toBe(jobs.filter(j => j.status === 'COMPLETED').length);
  });

  it('2. Registers new API and enforces dynamic WSO2 gateway routing attributes', () => {
    renderWithProvider();

    let newApi: any;
    act(() => {
      newApi = exposedContext.registerApi({
        name: 'Algorithmic FX Gateway',
        version: 'v1',
        basePath: '/api/v1/fx-algo',
        backendUrl: 'http://fx-service:8080',
        description: 'Ultra-low latency FX pricing endpoint',
        status: 'PUBLISHED'
      });
    });

    expect(newApi).toBeDefined();
    expect(newApi.basePath).toBe('/api/v1/fx-algo');
    expect(newApi.wso2ApiId).toBeDefined();
    expect(newApi.gatewayUrl).toContain('https://gateway.flowforge.local:8243');
    expect(exposedContext.apis.find(a => a.id === newApi.id)).toBeDefined();
    expect(exposedContext.stats.totalApis).toBe(exposedContext.apis.length);
  });

  it('3. Manages API lifecycle transitions: DRAFT -> PUBLISHED -> DEPRECATED -> RETIRED -> DELETE', () => {
    renderWithProvider();

    let created: any;
    act(() => {
      created = exposedContext.registerApi({
        name: 'Draft Service',
        version: 'v1',
        basePath: '/api/v1/draft',
        backendUrl: 'http://draft:8080',
        description: 'Service under test',
        status: 'DRAFT'
      });
    });

    expect(created.status).toBe('DRAFT');

    // Publish
    act(() => {
      exposedContext.updateApiStatus(created.id, 'PUBLISHED');
    });
    let current = exposedContext.apis.find(a => a.id === created.id);
    expect(current?.status).toBe('PUBLISHED');
    expect(current?.gatewayUrl).toBeDefined();

    // Deprecate
    act(() => {
      exposedContext.updateApiStatus(created.id, 'DEPRECATED');
    });
    current = exposedContext.apis.find(a => a.id === created.id);
    expect(current?.status).toBe('DEPRECATED');

    // Retire
    act(() => {
      exposedContext.updateApiStatus(created.id, 'RETIRED');
    });
    current = exposedContext.apis.find(a => a.id === created.id);
    expect(current?.status).toBe('RETIRED');

    // Delete
    act(() => {
      exposedContext.deleteApi(created.id);
    });
    expect(exposedContext.apis.find(a => a.id === created.id)).toBeUndefined();
  });

  it('4. Enforces strict SHA-256 Idempotency: Replays on identical payload (HTTP 200)', () => {
    renderWithProvider();

    const idempotencyKey = 'test-idemp-key-unique-01';
    const payload = JSON.stringify({ action: 'TRADE_SETTLEMENT', amount: 50000 });

    let firstResult: any;
    act(() => {
      firstResult = exposedContext.submitJob({
        type: 'SETTLEMENT_CLEARING',
        payload,
        idempotencyKey
      });
    });

    expect(firstResult.success).toBe(true);
    expect(firstResult.status).toBe(201);
    expect(firstResult.isReplay).toBe(false);
    expect(firstResult.job).toBeDefined();

    // Re-submit identical payload with same key
    let replayResult: any;
    act(() => {
      replayResult = exposedContext.submitJob({
        type: 'SETTLEMENT_CLEARING',
        payload,
        idempotencyKey
      });
    });

    expect(replayResult.success).toBe(true);
    expect(replayResult.status).toBe(200);
    expect(replayResult.isReplay).toBe(true);
    expect(replayResult.job.id).toBe(firstResult.job.id);
  });

  it('5. Enforces strict SHA-256 Idempotency: Rejects tampered payload with HTTP 409 Conflict', () => {
    renderWithProvider();

    const idempotencyKey = 'test-idemp-conflict-01';
    const originalPayload = JSON.stringify({ account: 'ACC-100', transfer: 1000 });
    const tamperedPayload = JSON.stringify({ account: 'ACC-100', transfer: 99999999 });

    act(() => {
      exposedContext.submitJob({
        type: 'PAYMENTS_ISO20022',
        payload: originalPayload,
        idempotencyKey
      });
    });

    // Submit altered payload with the same idempotency key
    let conflictResult: any;
    act(() => {
      conflictResult = exposedContext.submitJob({
        type: 'PAYMENTS_ISO20022',
        payload: tamperedPayload,
        idempotencyKey
      });
    });

    expect(conflictResult.success).toBe(false);
    expect(conflictResult.status).toBe(409);
    expect(conflictResult.message).toContain('HTTP 409 Conflict');
  });

  it('6. Records Outbox Event atomically upon Job creation', () => {
    renderWithProvider();

    const beforeOutboxCount = exposedContext.outbox.length;
    let submitResult: any;

    act(() => {
      submitResult = exposedContext.submitJob({
        type: 'ORDER_MATCHING',
        payload: JSON.stringify({ orderId: 'ORD-991', symbol: 'AZN.L' })
      });
    });

    expect(exposedContext.outbox.length).toBe(beforeOutboxCount + 1);
    const recordedEvent = exposedContext.outbox.find(o => o.jobId === submitResult.job.id);
    expect(recordedEvent).toBeDefined();
    expect(recordedEvent?.eventType).toBe('JOB_SUBMITTED');
  });

  it('7. Handles manual recovery of dead-lettered job', () => {
    renderWithProvider();

    // Find a failed or dead-lettered job in seed data
    const failedJob = exposedContext.jobs.find(j => j.status === 'FAILED' || j.status === 'DEAD_LETTERED');
    expect(failedJob).toBeDefined();

    act(() => {
      exposedContext.retryJob(failedJob!.id);
    });

    const updatedJob = exposedContext.jobs.find(j => j.id === failedJob!.id);
    expect(updatedJob?.status).toBe('QUEUED');
    expect(updatedJob?.attemptCount).toBe(0);
    expect(updatedJob?.failureReason).toBeUndefined();
    expect(updatedJob?.executionSteps.some(s => s.step === 'MANUAL_RETRY_TRIGGERED')).toBe(true);
  });

  it('8. Resets demo data and purges storage cleanly', () => {
    renderWithProvider();

    // Mutate state
    act(() => {
      exposedContext.registerApi({
        name: 'Temporary API',
        version: 'v1',
        basePath: '/api/v1/temp',
        backendUrl: 'http://temp:8080',
        description: 'To be wiped',
        status: 'DRAFT'
      });
    });

    const countWithTemp = exposedContext.apis.length;

    act(() => {
      exposedContext.resetDemoData();
    });

    expect(exposedContext.apis.length).toBeLessThan(countWithTemp);
    expect(exposedContext.selectedJobId).toBeNull();
    expect(exposedContext.selectedApiId).toBeNull();
  });

  it('9. Renders DisclaimerBanner with prominent simulation indicator', () => {
    renderWithProvider(<DisclaimerBanner />);
    expect(screen.getByText(/Demo Mode/i)).toBeDefined();
    expect(screen.getByText(/Architecture Note/i)).toBeDefined();
  });

  it('10. Renders Sidebar and allows module view switching', () => {
    renderWithProvider(<Sidebar isOpen={true} onClose={() => {}} />);
    expect(screen.getByText(/API Management/i)).toBeDefined();
    expect(screen.getByText(/Reliability & Recovery/i)).toBeDefined();
    expect(screen.getByText(/Engineering Evidence/i)).toBeDefined();

    act(() => {
      exposedContext.setActiveView('evidence');
    });

    expect(exposedContext.activeView).toBe('evidence');
  });
});
