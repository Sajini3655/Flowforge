# FlowForge

> API Management & Distributed Workflow Platform built with Java 21, Spring Boot 3.5, PostgreSQL, RabbitMQ, Redis, WSO2 API Manager, and Kubernetes.

[![CI/CD Pipeline](https://github.com/Sajini3655/Flowforge/actions/workflows/ci.yml/badge.svg)](https://github.com/Sajini3655/Flowforge/actions/workflows/ci.yml)
![Java](https://img.shields.io/badge/Java-21-orange.svg)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5.5-brightgreen.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3.13-orange.svg)
![Redis](https://img.shields.io/badge/Redis-7.4-red.svg)
![Kubernetes](https://img.shields.io/badge/Kubernetes-Kustomize-326ce5.svg)
![Prometheus](https://img.shields.io/badge/Prometheus-v2.51-e6522c.svg)
![Grafana](https://img.shields.io/badge/Grafana-v10.4-F46800.svg)

---

## Overview

FlowForge is an asynchronous workflow execution and API management platform designed to solve core reliability and concurrency challenges in distributed backend systems:
- **Dual-Write Consistency**: Eliminates message-loss race conditions between relational databases and message brokers via the **Transactional Outbox Pattern**.
- **Idempotency & Deduplication**: Prevents duplicate executions from network retries using database-backed request fingerprinting.
- **Poison-Pill Isolation**: Non-blocking delayed retry queues and Dead-Letter Queues (DLQ) protect worker threads from infinite failure loops.
- **Distributed Race Conditions**: Redis distributed locking (`SET NX PX` + atomic Lua unlock) prevents concurrent execution of identical jobs across horizontally scaled workers.
- **Zero-Trust Security**: WSO2 API Manager TLS termination paired with asymmetric RS256 JWT validation and a public JWKS endpoint.

> **Implementation Scope & Engineering Honesty**:
> - **Fully Implemented & Automated Locally**: Core REST API, Transactional Outbox, RabbitMQ worker queues, Redis locking, RS256 authentication, 93 unit tests, and 31 Testcontainers integration tests.
> - **Configured & Locally Verified**: WSO2 API Manager gateway pass-through, Prometheus metric scraping, alert rules, and auto-provisioned Grafana dashboards running under Docker Compose.
> - **Syntactically Validated Kubernetes Architecture**: Declarative Kustomize manifests (`k8s/`) validated via `kubectl kustomize`, but intentionally not deployed to a live cloud provider (AWS/GCP/Azure) to avoid hosting costs.

---

## Architecture

```mermaid
graph TB
    subgraph ClientLayer [Client & Consumer Layer]
        SPA[React + TypeScript Dashboard]
        API_CLIENT[External API Consumers]
    end

    subgraph GatewayLayer [API Gateway]
        WSO2[WSO2 API Manager 4.7.0\nTLS Termination & Pass-Through]
    end

    subgraph AppLayer [Application Service - Spring Boot 3.5 / Java 21]
        API[REST Controllers & Security Filters]
        OUTBOX[Transactional Outbox Poller]
        WORKER[Asynchronous RabbitMQ Consumer]
    end

    subgraph DataLayer [Persistence & Coordination]
        PG[(PostgreSQL 16\nAuthoritative Storage & Outbox)]
        RMQ[RabbitMQ 3.13 Broker\nWork, Retry & DLQ Queues]
        REDIS[(Redis 7.4\nDistributed Mutual Exclusion)]
    end

    subgraph MonitoringLayer [Observability Stack]
        PROM[Prometheus v2.51\nScrapes /actuator/prometheus]
        GRAFANA[Grafana v10.4\nProvisioned Dashboards]
    end

    SPA -->|HTTPS / Port 8243| WSO2
    API_CLIENT -->|HTTPS / Port 8243| WSO2
    WSO2 -->|HTTP Proxy / Port 8080| API

    API -->|Read / Write| PG
    OUTBOX -->|Polls Unsent Events| PG
    OUTBOX -->|Publishes Messages| RMQ
    RMQ -->|Delivers Messages| WORKER
    WORKER <-->|Acquire / Release Lock| REDIS
    WORKER -->|Update Job Status| PG

    PROM -->|Scrapes 5s| API
    GRAFANA -->|PromQL| PROM
```

> Detailed architectural specifications and sequence diagrams are available in [docs/architecture/system-architecture.md](docs/architecture/system-architecture.md).

---

## Engineering Highlights

- **Transactional Outbox Pattern**: Workflow jobs and outbox events are committed atomically inside a single PostgreSQL database transaction. A dedicated background poller reads unpublished events and reliably publishes them to RabbitMQ, guaranteeing at-least-once message delivery.
- **Strict Idempotency**: API endpoints accept an optional `Idempotency-Key` header with SHA-256 request fingerprinting. Cached responses are returned for duplicate submissions, preventing redundant asynchronous jobs.
- **Asynchronous Reliability Pipeline**: RabbitMQ topology with message TTL and dead-letter exchanges (DLX) provides non-blocking exponential backoff (`flowforge.job.retry.queue`). Poison pills exceeding 3 attempts are isolated into `flowforge.job.dlq`.
- **Distributed Mutual Exclusion**: Redis cluster-safe locking using atomic `SET NX PX` and an atomic Lua release script prevents multiple worker replicas from processing the same job concurrently, with fail-closed semantics.
- **Asymmetric RS256 Authentication**: User credentials hashed with BCrypt. JWTs are signed with a 2048-bit RSA private key; public keys are exposed via standard JWKS (`/.well-known/jwks.json`) for verification by downstream services and WSO2 APIM.
- **Production Observability**: 14 Micrometer custom metrics exposed at `/actuator/prometheus`, 5 Prometheus alert rules (`FlowForgeBackendDown`, `FlowForgeDlqPublicationDetected`, etc.), and an automated Grafana dashboard with real-time throughput and contention tracking.
- **Cloud-Native Kubernetes Manifests**: 15 declarative manifests assembled with Kustomize (`k8s/`), implementing non-root Pod Security Standards, HPA autoscaling (2–10 replicas), 3-tier health probes, and persistent volumes.

---

## Tech Stack

| Domain | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Backend Runtime** | Java / Eclipse Temurin | 21 (LTS) | Modern Java runtime with virtual-thread capability |
| **Application Framework** | Spring Boot | 3.5.5 | REST controllers, Spring Security, Spring Data JPA |
| **Database** | PostgreSQL | 16 | Relational persistence, Flyway migrations V1–V6 |
| **Message Broker** | RabbitMQ | 3.13 | Asynchronous queueing, delayed retries, DLQ |
| **Distributed Cache** | Redis | 7.4 | Distributed locking (`SET NX PX` + Lua) |
| **API Gateway** | WSO2 API Manager | 4.7.0 | TLS termination, proxy routing, token pass-through |
| **Metrics & Monitoring** | Prometheus & Grafana | v2.51 / v10.4 | Metrics scraping, alert rules, visualization |
| **Containerization** | Docker | Multi-stage | Non-root runtime image (`eclipse-temurin:21-jre`) |
| **Orchestration** | Kubernetes & Kustomize | v1.30+ | Declarative cloud-native deployment topology |
| **Testing** | JUnit 5 & Testcontainers | 1.20 | Integration testing with live PostgreSQL & RabbitMQ |
| **CI/CD** | GitHub Actions | v4 | Automated unit/integration tests, SBOM, Trivy scan |
| **Frontend** | React + TypeScript | Vite 7 / Node 20 | Administrative dashboard |

---

## Key Design Decisions & Workflows

### 1. Transactional Outbox Flow
```mermaid
sequenceDiagram
    autonumber
    actor Client as API Consumer
    participant API as Spring Boot Backend
    participant DB as PostgreSQL
    participant Outbox as Outbox Publisher (1s)
    participant Broker as RabbitMQ

    Client->>API: POST /api/jobs (Payload, Idempotency-Key)
    rect rgb(240, 248, 255)
        Note over API,DB: Single Atomic Database Transaction
        API->>DB: INSERT INTO jobs (status=SUBMITTED)
        API->>DB: INSERT INTO outbox_events (published=false)
    end
    API-->>Client: 201 Created (jobId)

    loop Scheduled Polling
        Outbox->>DB: SELECT unpublished events FOR UPDATE SKIP LOCKED
        Outbox->>Broker: Publish message to flowforge.job.exchange
        Outbox->>DB: UPDATE outbox_events SET published=true
    end
```

### 2. Worker Processing, Retries & Dead Letter Queue (DLQ)
```mermaid
sequenceDiagram
    autonumber
    participant Broker as RabbitMQ
    participant Worker as JobConsumer
    participant Lock as Redis
    participant DB as PostgreSQL
    participant DLQ as flowforge.job.dlq

    Broker->>Worker: Deliver job message
    Worker->>Lock: SET lock:job:{id} {token} NX PX 60000
    alt Lock Acquired
        Worker->>DB: UPDATE jobs SET status=RUNNING
        alt Job Execution Success
            Worker->>DB: UPDATE jobs SET status=COMPLETED
            Worker->>Broker: BasicAck
            Worker->>Lock: Release lock via Lua script
        else Transient Error (Attempt < 3)
            Worker->>Broker: Publish to retry queue (5s TTL)
            Worker->>Broker: BasicAck
            Worker->>Lock: Release lock
        else Fatal Error OR Attempt >= 3
            Worker->>DB: UPDATE jobs SET status=FAILED
            Worker->>DLQ: Publish to dead-letter queue
            Worker->>Broker: BasicAck
            Worker->>Lock: Release lock
        end
    else Lock Held by Another Worker (Contention)
        Worker->>Broker: BasicNack (requeue=true)
    end
```

---

## Testing

FlowForge maintains a strict test pyramid with **124 total automated tests (100% passing)**:

- **93 Unit Tests**: Unit verification of security filters, JWT signing/parsing, API controllers, outbox publisher, idempotency logic, and metric counters.
- **31 Integration Tests (Testcontainers)**: Live multi-container integration testing using ephemeral PostgreSQL and RabbitMQ instances:
  - `SecurityIT` (10 tests): RS256 token verification, claims validation, RBAC enforcement, expired token rejection.
  - `JobApiIT` (10 tests): Idempotency caching, SHA-256 fingerprint collision prevention, job state transitions.
  - `RedisLockIT` (5 tests): Mutual exclusion, fail-closed handling, token-safe Lua release.
  - `MessagingIT` (2 tests): Outbox publication, non-blocking delayed retries, and DLQ routing.
  - `ObservabilityIT` (4 tests): Prometheus metric registration and health probe endpoints.

```bash
# Run unit tests
mvn clean test -f backend/pom.xml

# Run integration tests (requires Docker)
mvn -Pintegration verify -f backend/pom.xml
```

---

## Security

- **Asymmetric RS256 Cryptography**: Passwords hashed with BCrypt. JWTs are signed with a 2048-bit RSA private key; public keys are served at `/api/.well-known/jwks.json`.
- **Role-Based Access Control**:
  - `ROLE_USER` or `ROLE_ADMIN`: Submit and query asynchronous jobs (`/api/jobs/**`).
  - `ROLE_ADMIN`: Manage API definitions (`/api/apis/**`).
  - Anonymous: Permitted only on health probes, JWKS, and login/registration endpoints.
- **Traceability & Correlation**: `CorrelationIdFilter` inspects `X-Correlation-ID` (or generates a UUID) and injects it into the SLF4J Mapped Diagnostic Context (MDC) for end-to-end distributed log tracing.
- **Secret Protection**: Private RSA keys and sensitive Kubernetes manifests are excluded via `.gitignore`. A safe public template is provided at `k8s/secret.example.yaml`.
- **Container Hardening**: Backend runs as non-root user `flowforge` (UID 1000) on a minimal JRE base image. Kubernetes manifests enforce dropped Linux capabilities (`drop: ["ALL"]`) and disabled privilege escalation.

---

## Running Locally

### Prerequisites
- Java 21 & Maven 3.9+
- Node.js 20+ & npm
- Docker Desktop

### 1. Quick Start via Docker Compose (Recommended)
Starts PostgreSQL, RabbitMQ, Redis, Prometheus, Grafana, and the FlowForge backend:

```bash
docker compose up --build -d
```
- Backend API: `http://localhost:8080`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000` (pre-configured dashboards)
- RabbitMQ Management: `http://localhost:15672` (guest/guest)

### 2. Optional: WSO2 API Gateway Profile
```powershell
docker compose --profile wso2 up -d --build
.\infra\wso2\publish-api.ps1
```
Gateway proxy endpoint: `https://localhost:8243/flowforge/v1/jobs`

### 3. API Usage Walkthrough

```bash
# 1. Register a user
curl -s -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"engineer@flowforge.local","password":"Password123!","role":"USER"}'

# 2. Authenticate to obtain RS256 JWT
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"engineer@flowforge.local","password":"Password123!"}' | jq -r .token)

# 3. Submit an asynchronous workflow job with Idempotency Key
curl -s -X POST http://localhost:8080/api/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "X-Correlation-ID: flowforge-demo-001" \
  -H "Content-Type: application/json" \
  -d '{"type":"DATA_AGGREGATION","payload":"{\"datasetId\": 101}"}'

# 4. Query job execution status
curl -s http://localhost:8080/api/jobs/{jobId} \
  -H "Authorization: Bearer $TOKEN"
```

---

## CI/CD Pipeline

Automated via GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)):

```mermaid
flowchart LR
    A[Code Push / PR] --> B[Unit Tests\n93 tests]
    B --> C[Integration Tests\nTestcontainers\n31 tests]
    C --> D[Package & SBOM\nFat JAR + CycloneDX]
    A --> E[Frontend Build\nNode 20 + npm audit]
    D & E --> F[Docker Build\nTagged with Git SHA]
    F --> G[Trivy Scan\nCRITICAL, HIGH CVE Gate]
    F --> H[K8s Kustomize Validation\nkubectl kustomize k8s/]
```

---

## Project Structure

```text
flowforge/
├── .github/workflows/         # GitHub Actions CI/CD pipeline
├── backend/                   # Spring Boot 3.5 / Java 21 REST backend
│   ├── src/main/java/         # Application code (API, Jobs, Outbox, Messaging, Security)
│   ├── src/main/resources/    # Flyway migrations V1-V6 & application properties
│   ├── src/test/java/         # Unit tests and Testcontainers integration suites
│   └── Dockerfile             # Multi-stage non-root container build
├── frontend/                  # React + TypeScript administrative dashboard (Vite)
├── infra/                     # Local infrastructure configurations
│   ├── grafana/               # Automated provisioning & dashboards
│   ├── prometheus/            # Scrape config & alerting rules
│   └── wso2/                  # WSO2 API Manager deployment config & publish scripts
├── k8s/                       # Cloud-native Kubernetes manifests (Kustomize)
└── docs/                      # Technical documentation
    ├── architecture/          # System architecture specification & sequence diagrams
    ├── decisions/             # Architecture Decision Records (ADRs)
    └── deployment/            # Deployment & operations guide
```

---

## Documentation

- **[System Architecture Specification](docs/architecture/system-architecture.md)**: Deep dive into all architectural tiers, outbox patterns, retry queues, DLQ routing, and Redis locking.
- **[Deployment & Operations Guide](docs/deployment/README.md)**: Docker Compose orchestration, Kubernetes manifest validation, and Prometheus/Grafana operations.
- **[Architecture Decision Records](docs/decisions/)**: Foundational decisions and design trade-offs.
