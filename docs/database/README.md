# Database

PostgreSQL is authoritative. Flyway owns schema changes and Hibernate runs in
validation mode.

Initial MVP tables:

- `apis`
- `jobs`
- `outbox_events`

Users and subscriptions will be added with the authentication/API-management milestone.

Job lifecycle:

```text
QUEUED -> PROCESSING -> COMPLETED
                    \
                     -> FAILED
```

Migrations:

- V1: baseline users, APIs, and jobs schema
- V2: job attempt count
- V3: transactional outbox table
- V4: outbox payload conversion to `TEXT`
- V5: user-scoped idempotency key and request fingerprint
- V6: legacy job payload conversion to `TEXT`
