# Deployment and Operations

Phase 9 provides a reproducible local container delivery path. It does not provide
Kubernetes or production deployment automation.

## Local Compose stack

From the repository root:

```bash
docker compose up --build -d
docker compose ps
```

The stack contains PostgreSQL, RabbitMQ, Redis, and the FlowForge backend. The
backend waits for healthy infrastructure services and exposes port 8080. Named
volumes are persistent; do not remove them during normal restarts.

Useful local endpoints:

- `http://localhost:8080/api/health/live`
- `http://localhost:8080/api/health/ready`
- `http://localhost:8080/actuator/prometheus`
- RabbitMQ management: `http://localhost:15673`

Stop containers without deleting volumes:

```bash
docker compose down
```

## Backend image

The [backend Dockerfile](../../backend/Dockerfile) uses Maven and Java 21 in a
build stage, then copies only the executable jar into a Java 21 JRE image. The
runtime runs as the non-root `flowforge` user and uses container-aware JVM memory
settings. The image healthcheck calls `/api/health/live`.

Build it directly with:

```bash
docker build -t flowforge-backend:local ./backend
docker run --rm -p 8080:8080 --env-file .env flowforge-backend:local
```

Do not commit `.env` files.

## Configuration

Host development uses defaults in `application.properties`. The `prod` profile
requires deployment-provided values and disables SQL logging:

```text
SPRING_PROFILES_ACTIVE=prod
FLOWFORGE_DB_URL
FLOWFORGE_DB_USERNAME
FLOWFORGE_DB_PASSWORD
FLOWFORGE_JWT_SECRET
FLOWFORGE_RABBITMQ_HOST
FLOWFORGE_RABBITMQ_USERNAME
FLOWFORGE_RABBITMQ_PASSWORD
FLOWFORGE_REDIS_HOST
```

`FLOWFORGE_JWT_SECRET` must be at least 32 characters. Ports and operational
settings have documented defaults and can be overridden with the existing
`FLOWFORGE_*` variables. Secrets must come from the deployment environment or a
secret manager, never source control or image layers.

Flyway applies migrations V1-V6 during backend startup. Hibernate is configured
for schema validation rather than schema creation.

## CI

[GitHub Actions](../../.github/workflows/ci.yml) runs:

- `mvn clean test`
- Maven packaging
- Maven CycloneDX SBOM generation
- `npm ci`, `npm audit --audit-level=high`, and `npm run build`
- Docker image build and Trivy scan for HIGH and CRITICAL unfixed vulnerabilities
- `docker compose config`

The workflow does not deploy or push images.

## Troubleshooting

- Check `docker compose ps` and inspect service logs with `docker compose logs <service>`.
- Backend readiness must be `UP` for PostgreSQL, RabbitMQ, and Redis.
- If migrations fail, inspect the Flyway error and database connectivity; do not
  manually edit migration history or application tables.
- If RabbitMQ is unavailable, the backend may start but readiness remains down and
  message publication cannot proceed.
- If Redis is unavailable, job execution remains fail-closed by design.
- Restart the backend with `docker compose restart backend`; persistent dependency
  volumes are not removed.
- Existing retry and DLQ semantics remain application behavior. Do not purge queues
  as a troubleshooting shortcut.
