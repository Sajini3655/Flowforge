# Architecture

## Current architecture

```text
React + TypeScript -> Spring Boot REST API
       |       |       |
       v       v       v
        PostgreSQL RabbitMQ Redis
        authoritative  locks only
```

The MVP deliberately does not introduce RabbitMQ, Redis, WSO2, or Kubernetes yet.

The backend contains API controllers, transactional job and outbox services, the
scheduled outbox publisher, RabbitMQ consumer, and worker. PostgreSQL remains the
source of truth; RabbitMQ transports work and Redis coordinates concurrent workers.

## Delivery architecture

```text
Source -> GitHub Actions tests/builds -> backend Docker image -> Docker Compose

The repository does not claim Kubernetes or production deployment support.
```
