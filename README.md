# FlowForge

FlowForge is an API Management + Distributed Workflow Platform.

The project is being developed incrementally to demonstrate Java backend engineering,
REST APIs, PostgreSQL, API management, asynchronous processing, reliability, and DevOps.

## Current System

Implemented:
- Spring Boot 3.5.5 / Java 21 REST backend
- JWT authentication and authorization
- PostgreSQL persistence with Flyway migrations V1-V6
- Transactional Outbox publishing to RabbitMQ
- RabbitMQ worker processing with retries and a dead-letter queue
- Redis per-job distributed locking with fail-closed behavior
- PostgreSQL-backed `Idempotency-Key` support
- Correlation IDs, MDC logging, Prometheus metrics, and readiness checks
- React + TypeScript dashboard

WSO2 API Manager is available as an optional local Compose profile. It is not
started by the default stack.

## Run locally

### Backend

Requires Java 21 and Maven.

```bash
cd backend
mvn spring-boot:run
```

On Windows:

```powershell
cd backend
mvn spring-boot:run
```

### Frontend

Requires Node.js 20+.

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on the Vite development server.

### Complete local stack

The included `docker-compose.yml` starts PostgreSQL, RabbitMQ, Redis, and the backend image:

```bash
docker compose up --build -d
```

The backend is available at `http://localhost:8080`.

### Optional WSO2 API gateway

Start WSO2 with the backend and supporting services:

```powershell
docker compose --profile wso2 up -d --build
.\infra\wso2\publish-api.ps1
```

The script idempotently creates or reuses `FlowForge API` v1, publishes it, and
deploys a revision to the Default gateway environment. Verify its lifecycle and
deployment through the Publisher API:

```powershell
docker compose --profile wso2 exec wso2-apim bash -c `
	'curl -k -s -u admin:admin https://localhost:9443/api/am/publisher/v4/apis'
docker compose --profile wso2 exec wso2-apim bash -c `
	'curl -k -s -u admin:admin https://localhost:9443/api/am/publisher/v4/apis/{API_ID}/deployments'
```

The deployed default URL is `https://localhost:8243/flowforge/v1/jobs`.

WSO2 APIM handles TLS termination and acts as a pure API Gateway proxy for the FlowForge endpoints, native JWKS validation is configured using `apim.jwt.issuer` but authorization is bypassed at the gateway level (`authType: None`). The `Authorization` header and third-party FlowForge JWT are passed through transparently to the Spring Boot backend, where `JwtAuthenticationFilter` comprehensively validates the JWT claims and enforces Role-Based Access Control.

```bash
# Validating Gateway Routing & Authentication (pass-through)
curl -k -i -H "Authorization: Bearer <FlowForge-JWT>" -H "X-Correlation-ID: testing-001" https://localhost:8243/flowforge/v1/jobs
```

Stop WSO2 with:

```powershell
docker compose --profile wso2 down
```

## Environment variables

The default configuration is convenient for local host development. For deployment,
set `SPRING_PROFILES_ACTIVE=prod`; the production profile requires:

- `FLOWFORGE_DB_URL`, `FLOWFORGE_DB_USERNAME`, `FLOWFORGE_DB_PASSWORD`
- `FLOWFORGE_JWT_SECRET` (at least 32 characters)
- `FLOWFORGE_RABBITMQ_HOST`, `FLOWFORGE_RABBITMQ_USERNAME`, `FLOWFORGE_RABBITMQ_PASSWORD`
- `FLOWFORGE_REDIS_HOST`

Optional ports and tuning values are documented in
[docs/deployment/README.md](docs/deployment/README.md). Do not commit `.env` files
or real credentials.

## Health and metrics

- `GET /api/health/live`: liveness only
- `GET /api/health/ready`: PostgreSQL, RabbitMQ, and Redis readiness
- `GET /actuator/health/liveness`: Actuator liveness
- `GET /actuator/health/readiness`: Actuator readiness
- `GET /actuator/prometheus`: Prometheus metrics

## CI

GitHub Actions runs backend tests and packaging, the frontend install/build, npm
audit, Maven SBOM generation, Docker image building/scanning, and Compose validation.

See [docs/deployment/README.md](docs/deployment/README.md) for build and troubleshooting details.

