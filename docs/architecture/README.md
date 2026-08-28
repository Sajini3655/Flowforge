# Architecture Documentation

FlowForge is an API Management + Distributed Workflow Platform built with Java 21, Spring Boot 3.5, PostgreSQL 16, RabbitMQ 3.13, Redis 7.4, WSO2 API Manager 4.7.0, and Kubernetes.

Detailed architectural specifications and sequence diagrams are documented in:
- **[System Architecture Specification](system-architecture.md)**: Deep dive into all system tiers, sequence diagrams for transactional outbox, retry queues, dead-letter queues, Redis locking, and cloud-native orchestration.
- **[Architecture Decision Records](../decisions/)**: Foundational architectural decisions.
- **[Deployment & Operations](../deployment/README.md)**: Containerization, Kubernetes manifests, and observability setup.
