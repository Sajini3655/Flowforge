# Deployment and Operations

FlowForge provides a reproducible local container delivery path (Docker Compose) as
well as production-grade Kubernetes orchestration manifests (`k8s/`).

## Local Compose stack

From the repository root:

```bash
docker compose up --build -d
docker compose ps
```

The stack contains PostgreSQL, RabbitMQ, Redis, FlowForge backend, Prometheus, and
Grafana. The backend waits for healthy infrastructure services and exposes port 8080.
Named volumes are persistent; do not remove them during normal restarts.

Useful local endpoints:

- `http://localhost:8080/api/health/live`
- `http://localhost:8080/api/health/ready`
- `http://localhost:8080/actuator/prometheus`
- Prometheus Server: `http://localhost:9090`
- Grafana Dashboards: `http://localhost:3000` (default credentials: admin/admin)
- RabbitMQ management: `http://localhost:15673`

Stop containers without deleting volumes:

```bash
docker compose down
```

## Kubernetes Orchestration

Production and staging deployments are managed declaratively using Kustomize under [`k8s/`](../../k8s):

- **Namespace**: Dedicated `flowforge` namespace isolate all components.
- **ConfigMap & Secrets**: Non-sensitive settings (`k8s/configmap.yaml`) and base64-encoded credentials / RSA JWT keys (`k8s/secret.yaml`).
- **PostgreSQL**: StatefulSet (`k8s/postgres.yaml`) with persistent storage (`1Gi`), ClusterIP service, and `pg_isready` probes.
- **RabbitMQ**: Message broker Deployment (`k8s/rabbitmq.yaml`) with PVC, ports 5672/15672, and `rabbitmq-diagnostics ping` probes.
- **Redis**: Distributed lock / cache Deployment (`k8s/redis.yaml`) with PVC and `redis-cli ping` probes.
- **FlowForge Backend**: Multi-replica Deployment (`k8s/backend.yaml`) featuring:
  - 2 replicas to validate distributed asynchronous execution and Redis distributed locking.
  - RollingUpdate zero-downtime deployment strategy (`maxSurge: 1, maxUnavailable: 0`).
  - Strict resource requests (`250m` CPU, `512Mi` RAM) and limits (`1000m` CPU, `1024Mi` RAM).
  - Three-tier probes: `startupProbe` (initialDelay 15s, period 5s, failureThreshold 30), `livenessProbe` (`/api/health/live`), and `readinessProbe` (`/api/health/ready`).
  - Secret volume mounts for RS256 JWT keys at `/run/secrets/`.
- **Horizontal Pod Autoscaler (HPA)**: Automatic horizontal scaling (`k8s/hpa.yaml`) between 2 and 10 replicas based on CPU (70%) and Memory (80%) thresholds.
- **Ingress**: Ingress routing (`k8s/ingress.yaml`) for ingress-nginx with proxy timeouts and buffer configurations.

Deploy the complete cluster:

```bash
kubectl apply -k k8s/
```

Verify deployment status:

```bash
kubectl get all -n flowforge
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
FLOWFORGE_JWT_PRIVATE_KEY_PATH
FLOWFORGE_JWT_PUBLIC_KEY_PATH
FLOWFORGE_RABBITMQ_HOST
FLOWFORGE_RABBITMQ_USERNAME
FLOWFORGE_RABBITMQ_PASSWORD
FLOWFORGE_REDIS_HOST
```

JWT signing uses asymmetric RS256 with 2048-bit RSA key pairs (`FLOWFORGE_JWT_PRIVATE_KEY_PATH`
and `FLOWFORGE_JWT_PUBLIC_KEY_PATH`). Ports and operational settings have documented defaults
and can be overridden with the existing `FLOWFORGE_*` variables. Secrets must come from the
deployment environment, Kubernetes Secrets, or a secret manager, never source control.

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
