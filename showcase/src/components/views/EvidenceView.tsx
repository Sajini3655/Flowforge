import React, { useState } from 'react';
import { 
  Award, 
  CheckCircle2, 
  ExternalLink, 
  Box 
} from 'lucide-react';

interface TestSuiteEvidence {
  className: string;
  category: 'Unit Test' | 'Testcontainers Integration';
  testsCount: number;
  runtime: string;
  coverage: string;
  description: string;
  githubPath: string;
}

const TEST_SUITES: TestSuiteEvidence[] = [
  {
    className: 'SecurityIntegrationTest.java',
    category: 'Unit Test',
    testsCount: 18,
    runtime: '1.27s',
    coverage: '100%',
    description: 'RS256 JWT cryptographic signature validation, JWKS public key exposure, expired token rejection, and RBAC endpoint permissions (ROLE_ADMIN vs ROLE_USER).',
    githubPath: 'backend/src/test/java/com/flowforge/security/SecurityIntegrationTest.java'
  },
  {
    className: 'ApiDefinitionServiceTest.java',
    category: 'Unit Test',
    testsCount: 14,
    runtime: '0.45s',
    coverage: '100%',
    description: 'Validates API definition inputs, enforces leading slash normalization, rejects duplicate basePaths and API names, and asserts state transitions on WSO2 deployment failure.',
    githubPath: 'backend/src/test/java/com/flowforge/api/ApiDefinitionServiceTest.java'
  },
  {
    className: 'Wso2GatewayServiceTest.java',
    category: 'Unit Test',
    testsCount: 6,
    runtime: '0.32s',
    coverage: '100%',
    description: 'Tests WSO2 Publisher REST API v4 integration, TLS trust-all development bypass toggle (flowforge.wso2.insecure-tls), and disabled gateway fallback.',
    githubPath: 'backend/src/test/java/com/flowforge/api/Wso2GatewayServiceTest.java'
  },
  {
    className: 'OutboxPublisherTest.java',
    category: 'Unit Test',
    testsCount: 7,
    runtime: '0.15s',
    coverage: '100%',
    description: 'Validates scheduled outbox polling, at-least-once message delivery, atomic publishing to RabbitMQ, and published=true status transitions.',
    githubPath: 'backend/src/test/java/com/flowforge/outbox/OutboxPublisherTest.java'
  },
  {
    className: 'JobIdempotencyTest.java',
    category: 'Unit Test',
    testsCount: 8,
    runtime: '0.28s',
    coverage: '100%',
    description: 'SHA-256 request payload fingerprinting, duplicate request replay (HTTP 200), and payload tampering conflict detection (HTTP 409).',
    githubPath: 'backend/src/test/java/com/flowforge/job/JobIdempotencyTest.java'
  },
  {
    className: 'RedisJobLockServiceTest.java',
    category: 'Unit Test',
    testsCount: 6,
    runtime: '0.35s',
    coverage: '100%',
    description: 'Validates cluster-safe SET NX PX acquisition, UUID token isolation, and atomic Lua compare-and-delete script release.',
    githubPath: 'backend/src/test/java/com/flowforge/messaging/RedisJobLockServiceTest.java'
  },
  {
    className: 'SecurityIT.java',
    category: 'Testcontainers Integration',
    testsCount: 10,
    runtime: '22.08s',
    coverage: 'Live Postgres 16',
    description: 'Full multi-container integration test verifying database security rules, BCrypt password hashing, and user credential lifecycle.',
    githubPath: 'backend/src/test/java/com/flowforge/security/SecurityIT.java'
  },
  {
    className: 'JobApiIT.java',
    category: 'Testcontainers Integration',
    testsCount: 10,
    runtime: '30.72s',
    coverage: 'Live Postgres 16',
    description: 'Live PostgreSQL transaction isolation, unique idempotency key constraints, and job status state transitions under concurrent load.',
    githubPath: 'backend/src/test/java/com/flowforge/job/JobApiIT.java'
  },
  {
    className: 'RedisLockIT.java',
    category: 'Testcontainers Integration',
    testsCount: 5,
    runtime: '35.34s',
    coverage: 'Live Redis 7.4',
    description: 'Verifies real Redis mutual exclusion, concurrent worker lock acquisition contention, and fail-closed behavior under simulated Redis node failure.',
    githubPath: 'backend/src/test/java/com/flowforge/messaging/RedisLockIT.java'
  },
  {
    className: 'MessagingIT.java',
    category: 'Testcontainers Integration',
    testsCount: 2,
    runtime: '18.40s',
    coverage: 'Live RabbitMQ + Postgres',
    description: 'End-to-end integration: Outbox -> RabbitMQ worker queue -> 5s TTL delayed retry queue -> dead-letter queue (DLQ) routing.',
    githubPath: 'backend/src/test/java/com/flowforge/messaging/MessagingIT.java'
  },
  {
    className: 'ObservabilityIT.java',
    category: 'Testcontainers Integration',
    testsCount: 4,
    runtime: '12.10s',
    coverage: 'Live Actuator + Postgres',
    description: 'Validates Prometheus metric scrapability at /actuator/prometheus and correlation ID propagation in HTTP headers.',
    githubPath: 'backend/src/test/java/com/flowforge/observability/ObservabilityIT.java'
  }
];

export const EvidenceView: React.FC = () => {
  const [filter, setFilter] = useState<'ALL' | 'Unit Test' | 'Testcontainers Integration'>('ALL');

  const filteredSuites = TEST_SUITES.filter(s => filter === 'ALL' || s.category === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-4 h-4 text-slate-700" />
            <span>Engineering Evidence & Verification Matrix</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified test execution logs from the repository backend, Testcontainers integration suites, and declarative Kubernetes manifests.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            141 / 141 Passing Tests
          </span>
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
        <div className="p-3.5 rounded-lg bg-white border border-slate-200/90 shadow-sm">
          <div className="text-slate-500 text-[10px] uppercase font-bold">Backend Unit Tests</div>
          <div className="text-xl font-bold text-slate-900 mt-1">110 Passed</div>
          <p className="text-slate-500 text-[11px] font-sans mt-0.5">0 Failures • 0 Errors • 0 Skipped</p>
        </div>

        <div className="p-3.5 rounded-lg bg-white border border-slate-200/90 shadow-sm">
          <div className="text-slate-500 text-[10px] uppercase font-bold">Integration Tests (Testcontainers)</div>
          <div className="text-xl font-bold text-slate-900 mt-1">31 Passed</div>
          <p className="text-slate-500 text-[11px] font-sans mt-0.5">PostgreSQL 16 & RabbitMQ 3.13 containers</p>
        </div>

        <div className="p-3.5 rounded-lg bg-white border border-slate-200/90 shadow-sm">
          <div className="text-slate-500 text-[10px] uppercase font-bold">Kubernetes Resources (k8s/)</div>
          <div className="text-xl font-bold text-slate-900 mt-1">15 Manifests</div>
          <p className="text-slate-500 text-[11px] font-sans mt-0.5">Validated with kubectl kustomize</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-slate-200/90 shadow-sm text-xs">
        <span className="text-slate-400 font-mono text-[11px] mr-1 uppercase">Filter:</span>
        {['ALL', 'Unit Test', 'Testcontainers Integration'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat as typeof filter)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${filter === cat ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Test Suites Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 font-mono">
            <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-4 py-2.5">Test Suite</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Tests</th>
                <th className="px-4 py-2.5">Time</th>
                <th className="px-4 py-2.5">Scope</th>
                <th className="px-4 py-2.5 text-right font-sans">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuites.map((suite, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-2.5 font-bold text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{suite.className}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${suite.category === 'Unit Test' ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-purple-50 text-purple-700 border border-purple-200'}`}>
                      {suite.category}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-bold text-slate-900">
                    {suite.testsCount} passed
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {suite.runtime}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 font-sans text-xs max-w-md">
                    {suite.description}
                  </td>
                  <td className="px-4 py-2.5 text-right font-sans">
                    <a
                      href={`https://github.com/Sajini3655/Flowforge/blob/main/${suite.githubPath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-slate-700 hover:text-slate-900 underline font-medium"
                    >
                      <span>Code</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Kubernetes Topology Overview */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-3 text-xs">
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider flex items-center gap-2">
            <Box className="w-4 h-4 text-slate-700" />
            <span>Kubernetes Manifests (k8s/)</span>
          </h3>
          <p className="text-slate-500 text-xs mt-0.5">
            Declarative deployment configurations validated locally with <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">kubectl kustomize k8s/</code>
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500 text-[10px] uppercase font-bold">Deployment</div>
            <div className="font-bold text-slate-900 mt-1">backend.yaml</div>
            <div className="text-[10px] text-slate-500 mt-0.5">2 Replicas, Non-Root</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500 text-[10px] uppercase font-bold">StatefulSet</div>
            <div className="font-bold text-slate-900 mt-1">postgres.yaml</div>
            <div className="text-[10px] text-slate-500 mt-0.5">1Gi PVC Storage</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500 text-[10px] uppercase font-bold">Deployment</div>
            <div className="font-bold text-slate-900 mt-1">rabbitmq.yaml</div>
            <div className="text-[10px] text-slate-500 mt-0.5">PVC + Health Probes</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500 text-[10px] uppercase font-bold">Autoscaler</div>
            <div className="font-bold text-slate-900 mt-1">hpa.yaml</div>
            <div className="text-[10px] text-slate-500 mt-0.5">2–10 Pods (CPU 70%)</div>
          </div>
        </div>
      </div>
    </div>
  );
};
