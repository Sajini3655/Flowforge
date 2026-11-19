import React, { useState } from 'react';
import { 
  Network, 
  Server, 
  Database, 
  Cpu, 
  Lock, 
  ShieldCheck, 
  Terminal, 
  ExternalLink, 
  Layers 
} from 'lucide-react';

interface ComponentSpec {
  id: string;
  name: string;
  tier: string;
  tech: string;
  role: string;
  ports: string;
  guarantees: string;
  sourceFiles: string[];
}

const COMPONENTS: ComponentSpec[] = [
  {
    id: 'wso2',
    name: 'WSO2 API Manager 4.7.0 Gateway',
    tier: 'API Gateway Layer',
    tech: 'WSO2 APIM 4.7.0 / Synapse Runtime',
    role: 'Central enterprise gateway terminating client HTTPS traffic, verifying RS256 JWT tokens against FlowForge JWKS, and dynamically proxying requests to upstream Spring Boot pods.',
    ports: '8243 (HTTPS Gateway), 9443 (Management & Publisher REST API v4)',
    guarantees: 'Zero-trust perimeter security, token pass-through, dynamic revision deployment, and zero-downtime deprecation.',
    sourceFiles: [
      'backend/src/main/java/com/flowforge/api/Wso2GatewayService.java',
      'infra/wso2/Dockerfile',
      'infra/wso2/publish-api.ps1'
    ]
  },
  {
    id: 'backend',
    name: 'FlowForge Core Application Engine',
    tier: 'Application Service Layer',
    tech: 'Java 21 (LTS) / Spring Boot 3.5.16',
    role: 'Hosts secure REST APIs, enforces RS256 authentication & RBAC, executes the Transactional Outbox pattern, orchestrates RabbitMQ consumers, and coordinates Redis locks.',
    ports: '8080 (HTTP REST, Actuator, JWKS)',
    guarantees: 'Non-root container execution (UID 1000), 3-tier Kubernetes health probes, virtual-thread capability, and zero dual-write message loss.',
    sourceFiles: [
      'backend/src/main/java/com/flowforge/job/JobService.java',
      'backend/src/main/java/com/flowforge/outbox/OutboxPublisher.java',
      'backend/src/main/java/com/flowforge/messaging/JobWorker.java'
    ]
  },
  {
    id: 'postgres',
    name: 'PostgreSQL 16 Authoritative Datastore',
    tier: 'Persistence & Authoritative Storage Layer',
    tech: 'PostgreSQL 16 / Flyway Migrations V1-V8',
    role: 'Authoritative source of truth for API catalog, workflow definitions, job state history, and outbox_events table.',
    ports: '5432 / 5433 (PostgreSQL Wire Protocol)',
    guarantees: 'Strict ACID compliance, atomic single-transaction dual writes (Job + OutboxEvent), and unique constraints for request idempotency.',
    sourceFiles: [
      'backend/src/main/resources/db/migration/V1__baseline.sql',
      'backend/src/main/resources/db/migration/V3__add_outbox_events_table.sql',
      'backend/src/main/resources/db/migration/V5__add_job_idempotency.sql'
    ]
  },
  {
    id: 'rabbitmq',
    name: 'RabbitMQ 3.13 Asynchronous Broker',
    tier: 'Message Broker & Queue Topology Layer',
    tech: 'RabbitMQ 3.13 / AMQP 0-9-1',
    role: 'Decouples workflow ingestion from worker processing. Provides non-blocking delayed retries via message TTL and isolates poison pills into dead-letter queues.',
    ports: '5672 / 5673 (AMQP), 15672 / 15673 (Management Console)',
    guarantees: 'At-least-once message delivery, 5-second TTL delayed retry queue (flowforge.job.retry.queue), and DLQ isolation (flowforge.job.dlq).',
    sourceFiles: [
      'backend/src/main/java/com/flowforge/messaging/RabbitMqConfig.java',
      'backend/src/main/java/com/flowforge/messaging/JobConsumer.java'
    ]
  },
  {
    id: 'redis',
    name: 'Redis 7.4 Distributed Lock Manager',
    tier: 'Distributed Coordination Layer',
    tech: 'Redis 7.4-alpine / Lettuce Client',
    role: 'Provides transient distributed mutual exclusion per job across horizontally scaled worker replicas.',
    ports: '6379 (RESP Protocol)',
    guarantees: 'Fail-closed semantics (worker nacks if Redis unavailable), atomic SET NX PX acquisition, and token-safe Lua compare-and-delete release.',
    sourceFiles: [
      'backend/src/main/java/com/flowforge/messaging/RedisJobLockService.java',
      'backend/src/test/java/com/flowforge/messaging/RedisLockIT.java'
    ]
  },
  {
    id: 'observability',
    name: 'Prometheus & Grafana Observability Stack',
    tier: 'Observability & Monitoring Layer',
    tech: 'Prometheus v2.51 & Grafana v10.4',
    role: 'Continuous time-series metrics collection from Spring Boot Micrometer (/actuator/prometheus) and provisioned operational dashboards.',
    ports: '9090 (Prometheus), 3000 (Grafana)',
    guarantees: 'Automated 5s scraping interval, custom business counter tracking, and alerts for backend downtime & DLQ publications.',
    sourceFiles: [
      'infra/prometheus/prometheus.yml',
      'infra/grafana/dashboards/flowforge-overview.json'
    ]
  }
];

export const ArchitectureView: React.FC = () => {
  const [selectedComponentId, setSelectedComponentId] = useState<string>('wso2');

  const selectedComp = COMPONENTS.find(c => c.id === selectedComponentId) || COMPONENTS[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Network className="w-5 h-5 text-forge-teal" />
            System Architecture & Distributed Boundaries
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Complete multi-tier topology: API Gateway, Microservice Engine, Outbox Pattern, Message Queues & Mutual Exclusion.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
          <span>Zero-Trust Architecture</span>
        </div>
      </div>

      {/* Interactive Visual Architecture Map */}
      <div className="bg-navy-950 p-6 rounded-xl border border-navy-800 shadow-xl space-y-6">
        <div className="text-[11px] font-mono text-teal-400 uppercase tracking-wider font-semibold flex items-center justify-between">
          <span>Interactive Architectural Map (Click any tier to inspect specifications)</span>
          <span className="text-slate-400 hidden sm:inline">Spring Boot 3.5 • Java 21 • WSO2 4.7.0</span>
        </div>

        <div className="space-y-4">
          {/* Tier 1: Client & Ingestion */}
          <div className="p-4 rounded-xl bg-navy-900/80 border border-navy-800 space-y-2">
            <div className="text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider">
              Tier 1: Client & Ingestion Layer
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-navy-950 border border-navy-800 text-slate-200 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-teal-400"></div>
                <div>
                  <div className="font-bold">React + TypeScript Dashboard</div>
                  <div className="text-[10px] text-slate-400">Vite / Modern Web SPA</div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-navy-950 border border-navy-800 text-slate-200 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-sky-400"></div>
                <div>
                  <div className="font-bold">Financial & Trading Systems</div>
                  <div className="text-[10px] text-slate-400">External HTTPS / REST Consumers</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center text-slate-500 font-mono text-xs">
            ↓ HTTPS Port 8243 (RS256 Bearer JWT)
          </div>

          {/* Tier 2: WSO2 Gateway */}
          <div 
            onClick={() => setSelectedComponentId('wso2')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedComponentId === 'wso2' ? 'bg-teal-950/40 border-teal-500 shadow-lg shadow-teal-950/50' : 'bg-navy-900/80 border-navy-800 hover:border-slate-600'}`}
          >
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="text-[10px] uppercase font-bold text-teal-400">Tier 2: Enterprise API Gateway</span>
              <span className="text-slate-400">Click to inspect</span>
            </div>
            <div className="flex items-center gap-3 text-white">
              <div className="p-2.5 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/40">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm">WSO2 API Manager 4.7.0 Gateway</h4>
                <p className="text-xs text-slate-300">
                  TLS Termination • RS256 JWT Signature Verification via JWKS • Dynamic API Routing • Deprecation Lifecycle
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center text-slate-500 font-mono text-xs">
            ↓ HTTP Port 8080 (Reverse Proxy Target)
          </div>

          {/* Tier 3: Spring Boot Core */}
          <div 
            onClick={() => setSelectedComponentId('backend')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedComponentId === 'backend' ? 'bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-950/50' : 'bg-navy-900/80 border-navy-800 hover:border-slate-600'}`}
          >
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="text-[10px] uppercase font-bold text-indigo-400">Tier 3: Core Distributed Engine</span>
              <span className="text-slate-400">Click to inspect</span>
            </div>
            <div className="flex items-center gap-3 text-white">
              <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/40">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Spring Boot 3.5.16 Application Pods (Java 21 LTS)</h4>
                <p className="text-xs text-slate-300">
                  REST Controllers • Idempotency Engine • Transactional Outbox Poller • RabbitMQ Consumer • Redis Mutex Coordinator
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center text-slate-500 font-mono text-xs">
            ↓ Dual-Write Atomic Storage & Distributed Coordination
          </div>

          {/* Tier 4: Data & Broker Tier */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div 
              onClick={() => setSelectedComponentId('postgres')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedComponentId === 'postgres' ? 'bg-sky-950/50 border-sky-400' : 'bg-navy-900/80 border-navy-800 hover:border-slate-600'}`}
            >
              <div className="flex items-center gap-2 text-sky-400 font-bold text-xs mb-1">
                <Database className="w-4 h-4" />
                <span>PostgreSQL 16</span>
              </div>
              <p className="text-xs text-slate-300">
                Authoritative persistence for jobs and outbox_events. Flyway V1-V8 migrations.
              </p>
            </div>

            <div 
              onClick={() => setSelectedComponentId('rabbitmq')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedComponentId === 'rabbitmq' ? 'bg-amber-950/50 border-amber-400' : 'bg-navy-900/80 border-navy-800 hover:border-slate-600'}`}
            >
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-1">
                <Cpu className="w-4 h-4" />
                <span>RabbitMQ 3.13</span>
              </div>
              <p className="text-xs text-slate-300">
                Work queues, 5s TTL delayed retries, and poison pill Dead-Letter Queue (DLQ).
              </p>
            </div>

            <div 
              onClick={() => setSelectedComponentId('redis')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedComponentId === 'redis' ? 'bg-rose-950/50 border-rose-400' : 'bg-navy-900/80 border-navy-800 hover:border-slate-600'}`}
            >
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs mb-1">
                <Lock className="w-4 h-4" />
                <span>Redis 7.4</span>
              </div>
              <p className="text-xs text-slate-300">
                Per-job distributed mutual exclusion via SET NX PX and atomic Lua token release.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Component Detailed Specification */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-600 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              {selectedComp.tier}
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-1">{selectedComp.name}</h3>
            <p className="text-xs text-slate-500 font-mono">Stack: {selectedComp.tech}</p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-100 text-slate-700">
            Ports: {selectedComp.ports}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
            <h4 className="font-bold text-slate-900">Role & Architectural Responsibilities</h4>
            <p className="text-slate-600 leading-relaxed font-sans">{selectedComp.role}</p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
            <h4 className="font-bold text-slate-900">High-Availability & Fault Tolerance Guarantees</h4>
            <p className="text-slate-600 leading-relaxed font-sans">{selectedComp.guarantees}</p>
          </div>
        </div>

        {/* Source File Deep Links */}
        <div className="p-4 rounded-lg bg-navy-950 border border-navy-800 space-y-2 text-xs font-mono">
          <div className="text-teal-400 font-bold text-[11px] flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5" />
            Verified Source Code Files in Repository
          </div>
          <div className="space-y-1">
            {selectedComp.sourceFiles.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between text-slate-300 hover:text-white py-1 border-b border-navy-900 last:border-0">
                <span className="text-emerald-400">{file}</span>
                <a
                  href={`https://github.com/Sajini3655/Flowforge/blob/main/${file}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-teal-400 hover:underline cursor-pointer"
                >
                  <span>View on GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
