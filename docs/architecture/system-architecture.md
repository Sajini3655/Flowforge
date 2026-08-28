# FlowForge — Production System Architecture & Design Specification

FlowForge is an enterprise-grade API Management and Distributed Workflow Platform engineered in Java 21 and Spring Boot 3.5. It provides secure API gateway proxying, guaranteed at-least-once asynchronous job execution, distributed locking, and cloud-native observability.

---

## 1. Overall System Architecture

```mermaid
graph TB
    subgraph ClientLayer [Client & Consumer Layer]
        SPA[React + TypeScript Dashboard]
        API_CLIENT[External API Consumers]
    end

    subgraph GatewayLayer [API Gateway Layer]
        WSO2[WSO2 API Manager 4.7.0 Gateway`nTLS Termination & Pass-through]
    end

    subgraph ServiceLayer [Application Services - Kubernetes Pods]
        BACKEND1[FlowForge Backend Pod 1`nSpring Boot 3.5 / Java 21]
        BACKEND2[FlowForge Backend Pod 2`nSpring Boot 3.5 / Java 21]
    end

    subgraph DataLayer [Storage & Coordination Layer]
        PG[(PostgreSQL 16`nAuthoritative Persistence`nFlyway Migrations V1-V6)]
        RABBIT[RabbitMQ 3.13 Broker`nDirect, Retry & Dead-Letter Queues]
        REDIS[(Redis 7.4`nDistributed Lock Manager`nSET NX PX + Lua Unlock)]
    end

    subgraph ObservabilityLayer [Monitoring & Alerting Layer]
        PROM[Prometheus v2.51`nScrapes /actuator/prometheus]
        GRAFANA[Grafana v10.4`nAuto-Provisioned Dashboards]
    end

    SPA -->|HTTPS / Port 8243| WSO2
    API_CLIENT -->|HTTPS / Port 8243| WSO2
    WSO2 -->|HTTP Proxy / Port 8080| BACKEND1
    WSO2 -->|HTTP Proxy / Port 8080| BACKEND2

    BACKEND1 <-->|JDBC / Port 5432| PG
    BACKEND2 <-->|JDBC / Port 5432| PG

    BACKEND1 <-->|AMQP / Port 5672| RABBIT
    BACKEND2 <-->|AMQP / Port 5672| RABBIT

    BACKEND1 <-->|Lettuce / Port 6379| REDIS
    BACKEND2 <-->|Lettuce / Port 6379| REDIS

    PROM -->|HTTP Scrape / 5s| BACKEND1
    PROM -->|HTTP Scrape / 5s| BACKEND2
    GRAFANA -->|PromQL| PROM
```

---

## 2. Component Specifications

### 2.1 API Gateway: WSO2 API Manager 4.7.0
* **Role**: Reverse proxy, TLS termination, API routing, and gateway pass-through.
* **Security Model**: Pass-through architecture (`authType: "None"`). WSO2 terminates client TLS and relays client Bearer tokens directly in the `Authorization` header to the backend.
* **Native JWKS**: WSO2 is configured with `[[apim.jwt.issuer]]` referencing the FlowForge public JWKS endpoint (`/api/.well-known/jwks.json`) for optional API-level token introspection.
* **Traffic Routing**: Relays `/flowforge/v1/*` requests to the backend service `http://backend:8080/api/*`.

### 2.2 Application Backend: Spring Boot 3.5 / Java 21
* **Role**: REST API hosting, business logic validation, transactional outbox publishing, worker job processing, and metrics exposure.
* **Security**: RS256 asymmetric JWT authentication with RSA public/private key pairs. Stateless session management with Role-Based Access Control (`ROLE_USER`, `ROLE_ADMIN`).
* **Correlation Tracking**: `CorrelationIdFilter` inspects or generates `X-Correlation-ID` and injects it into the SLF4J / Logback Mapped Diagnostic Context (MDC) for distributed log correlation across threads.

### 2.3 Relational Persistence: PostgreSQL 16
* **Role**: Authoritative single source of truth for all domain entities.
* **Schema Evolution**: Flyway migrations `V1` through `V6` execute deterministically on startup:
  - `V1__init.sql`: Core schema (users, roles, API definitions).
  - `V2__jobs.sql`: Workflow jobs table with statuses (`SUBMITTED`, `RUNNING`, `COMPLETED`, `FAILED`).
  - `V3__idempotency.sql`: Unique idempotency keys and request payload fingerprinting (`SHA-256`).
  - `V4__outbox.sql`: Transactional outbox events table for atomic state transitions.
  - `V5__dlq_support.sql`: Error tracking, attempt counters, and failure causes.
  - `V6__indices.sql`: Optimized indexes for outbox polling, status lookups, and owner queries.

### 2.4 Asynchronous Messaging: RabbitMQ 3.13
* **Topology**:
  - **Work Exchange & Queue**: `flowforge.job.exchange` (direct) routing to `flowforge.job.queue`.
  - **Retry Queue**: `flowforge.job.retry.queue` configured with message TTL (`x-message-ttl: 5000ms`) and dead-letter exchange (`x-dead-letter-exchange: flowforge.job.exchange`) for non-blocking exponential backoff.
  - **Dead Letter Queue (DLQ)**: `flowforge.job.dlq` configured with routing key `flowforge.job.dlq` to isolate poisoned messages and fatal errors after maximum retry attempts (default: 3).

### 2.5 Distributed Coordination: Redis 7.4
* **Role**: Cluster-wide distributed mutual exclusion locks preventing concurrent execution of identical jobs across multiple backend replicas.
* **Lock Algorithm**:
  - Acquisition: Single atomic Redis command `SET lock:job:{id} {token} NX PX {ttl}` (default: 60,000ms).
  - Release: Atomic Lua script ensuring that only the worker holding the exact UUID token can release the lock.
  - **Fail-Closed Semantics**: If Redis becomes unavailable, workers fail closed and reject job execution to guarantee data consistency.

---

## 3. End-to-End Workflow & Reliability Flows

### 3.1 Asynchronous Job Submission & Transactional Outbox Flow

```mermaid
sequenceDiagram
    autonumber
    actor Client as API Consumer
    participant Gateway as WSO2 Gateway
    participant API as JobController / JobService
    participant DB as PostgreSQL
    participant OutboxPoller as OutboxPublisher (1s poll)
    participant Broker as RabbitMQ

    Client->>Gateway: POST /flowforge/v1/jobs (Bearer JWT, Idempotency-Key)
    Gateway->>API: Proxy POST /api/jobs
    API->>API: Validate JWT & Idempotency Key
    rect rgb(240, 248, 255)
        Note over API,DB: Single Atomic Database Transaction
        API->>DB: INSERT INTO jobs (status=SUBMITTED, attempts=0)
        API->>DB: INSERT INTO outbox_events (published=false, payload)
    end
    API-->>Client: 201 Created (jobId, status=SUBMITTED)

    loop Every 1000ms
        OutboxPoller->>DB: SELECT * FROM outbox_events WHERE published=false ORDER BY created_at LIMIT 10
        OutboxPoller->>Broker: BasicPublish(flowforge.job.exchange, payload)
        OutboxPoller->>DB: UPDATE outbox_events SET published=true, published_at=NOW()
    end
```

### 3.2 Distributed Worker Processing, Retries & Dead Letter Queue (DLQ) Flow

```mermaid
sequenceDiagram
    autonumber
    participant Broker as RabbitMQ
    participant Consumer as JobMessageConsumer
    participant LockMgr as RedisLockManager
    participant DB as PostgreSQL
    participant DLQ as flowforge.job.dlq

    Broker->>Consumer: Deliver Message(jobId, attempt)
    Consumer->>LockMgr: acquireLock(lock:job:{id}, uuidToken, ttl=60s)
    alt Lock Acquisition Failed (Contention)
        LockMgr-->>Consumer: Lock Not Acquired
        Consumer->>Broker: Nack(requeue=true)
    else Lock Acquired
        LockMgr-->>Consumer: Lock Acquired
        Consumer->>DB: UPDATE jobs SET status=RUNNING
        alt Job Execution Succeeds
            Consumer->>DB: UPDATE jobs SET status=COMPLETED, result=...
            Consumer->>Broker: BasicAck()
            Consumer->>LockMgr: releaseLock(lock:job:{id}, uuidToken)
        else Transient Failure & attempt < maxAttempts (3)
            Consumer->>DB: UPDATE jobs SET attempt_count = attempt + 1
            Consumer->>Broker: BasicPublish(flowforge.job.retry.queue) [5s TTL]
            Note over Broker: TTL expires -> routes back to work queue
            Consumer->>Broker: BasicAck()
            Consumer->>LockMgr: releaseLock()
        else Fatal Error OR attempt >= maxAttempts
            Consumer->>DB: UPDATE jobs SET status=FAILED
            Consumer->>DLQ: BasicPublish(flowforge.job.dlq)
            Consumer->>Broker: BasicAck()
            Consumer->>LockMgr: releaseLock()
        end
    end
```

---

## 4. Cloud-Native Kubernetes Architecture

The platform provides a declarative Kubernetes topology under `k8s/` assembled via Kustomize:

```mermaid
graph TB
    subgraph IngressRouting [Ingress Controller]
        ING[Ingress / flowforge.local]
    end

    subgraph AppWorkload [FlowForge Backend Deployment - 2 to 10 Replicas]
        HPA[Horizontal Pod Autoscaler`nTarget: 70% CPU / 80% RAM]
        POD1[Backend Pod 1]
        POD2[Backend Pod 2]
        HPA -.->|Controls Replicas| POD1
        HPA -.->|Controls Replicas| POD2
    end

    subgraph StatefulWorkloads [Stateful Backends]
        SS_PG[PostgreSQL StatefulSet`n1Gi Persistent Volume]
        DEP_RMQ[RabbitMQ Deployment`n1Gi Persistent Volume]
        DEP_REDIS[Redis Deployment`n500Mi Persistent Volume]
    end

    subgraph ConfigAndSecrets [Decoupled Configuration]
        CM[ConfigMap: flowforge-config]
        SEC[Secret: flowforge-secrets`nRSA PEM Keys + Passwords]
    end

    ING -->|Port 8080| POD1
    ING -->|Port 8080| POD2

    CM --> POD1
    CM --> POD2
    SEC --> POD1
    SEC --> POD2

    POD1 --> SS_PG
    POD2 --> SS_PG
    POD1 --> DEP_RMQ
    POD2 --> DEP_RMQ
    POD1 --> DEP_REDIS
    POD2 --> DEP_REDIS
```

### 4.1 Pod Hardening & Security Context
* Pod-level `securityContext`: `runAsNonRoot: true`, `runAsUser: 1000`, `fsGroup: 1000`.
* Container-level `securityContext`: `allowPrivilegeEscalation: false`, `capabilities: drop: ["ALL"]`.
* Three-tier Kubernetes health probes:
  - `startupProbe`: `/api/health/live` (initialDelay: 15s, period: 5s, failureThreshold: 30) for JVM warmup.
  - `livenessProbe`: `/api/health/live` (period: 15s, timeout: 5s) for dead-lock recovery.
  - `readinessProbe`: `/api/health/ready` (period: 10s, timeout: 5s) verifying PostgreSQL, RabbitMQ, and Redis connectivity before receiving ingress traffic.

---

## 5. Production Observability Architecture

* **Prometheus Scraping**: Scrapes `/actuator/prometheus` at a 5-second interval across all backend instances.
* **Custom Metric Instrumentation (`FlowForgeMetrics`)**:
  - `flowforge_jobs_submitted_total`: Counter tracking total submissions by type.
  - `flowforge_jobs_completed_total`: Counter tracking successful job executions.
  - `flowforge_jobs_failed_total`: Counter tracking failed executions.
  - `flowforge_jobs_dlq_publications_total`: Counter tracking messages sent to DLQ.
  - `flowforge_outbox_events_created_total`: Counter tracking outbox events created.
  - `flowforge_outbox_events_published_total`: Counter tracking successful publications.
  - `flowforge_outbox_events_publish_failures_total`: Counter tracking publish errors.
  - `flowforge_redis_lock_acquired_total`: Counter tracking lock acquisitions.
  - `flowforge_redis_lock_acquisition_failures_total`: Counter tracking lock failures.
  - `flowforge_redis_lock_contention_total`: Counter tracking lock contention events.
  - `flowforge_job_execution_duration_seconds`: Histogram measuring execution duration percentiles.
* **Active Prometheus Alerting Rules**:
  1. `FlowForgeBackendDown`: Triggers on backend instance outage > 15s (`severity: critical`).
  2. `FlowForgeDlqPublicationDetected`: Triggers on any message routed to DLQ (`severity: warning`).
  3. `FlowForgeOutboxPublishFailure`: Triggers when outbox publisher encounters errors (`severity: warning`).
  4. `FlowForgeHighLockContention`: Triggers on > 5 lock contention events/min (`severity: info`).
  5. `FlowForgeJobFailuresDetected`: Triggers on terminal job failure (`severity: warning`).
* **Grafana Dashboards**: Automatically provisioned dashboard (`infra/grafana/dashboards/flowforge-overview.json`) providing real-time stat cards, throughput timeseries, outbox dynamics, and Redis contention rates.
