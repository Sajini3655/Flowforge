# FlowForge API Documentation

## Overview

The [FlowForge OpenAPI 3.0.3 specification](flowforge-openapi.yaml) documents the business REST API with contracts for asynchronous job processing and API definition management. This document describes authentication, gateway integration, and WSO2 API Manager configuration.

## Gateway-managed surface

The following business endpoints are managed through WSO2 API Manager (when deployed):

### Jobs endpoints
- **GET /jobs** - List jobs visible to authenticated user
- **POST /jobs** - Submit a new asynchronous job
- **GET /jobs/{id}** - Get job details and status

### API Definitions endpoints
- **GET /apis** - List managed API definitions
- **POST /apis** - Create a new API definition
- **GET /apis/{id}** - Get API definition details

When published through WSO2, the default URL-mapping strategy includes the API version:
- Gateway: `https://localhost:8243/flowforge/v1/jobs`
- Backend: `http://backend:8080/api/jobs` (Docker service)

## Authentication and authorization

### Bearer Token (JWT)

All endpoints require Bearer token authentication via the `Authorization` header:

```bash
curl -k -H "Authorization: Bearer ${JWT_TOKEN}" https://localhost:8243/flowforge/jobs
```

**Role-based access control** (enforced by Spring Security on backend):
- `USER` role: Can access job endpoints
- `ADMIN` role: Can access job and API definition endpoints

### Optional request headers

#### X-Correlation-ID
Unique request identifier for distributed tracing. Backend generates one if not provided.

```bash
curl -k -H "X-Correlation-ID: req-12345" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  https://localhost:8243/flowforge/v1/jobs
```

#### Idempotency-Key
For POST requests, ensures safe retry behavior. Identical replays return `200`; conflicting requests return `409 Conflict`.

```bash
curl -k -X POST \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Idempotency-Key: unique-submission-id" \
  -H "Content-Type: application/json" \
  -d '{"type":"DATA_SYNC"}' \
  https://localhost:8243/flowforge/jobs
```

## Optional WSO2 local integration

### Starting WSO2 API Manager

WSO2 is configured as an optional Docker Compose profile:

```bash
# Start the complete stack including WSO2
docker compose --profile wso2 up -d

# Verify WSO2 is healthy
docker compose --profile wso2 ps

# Stop without deleting volumes
docker compose --profile wso2 down
```

WSO2 listens on:
- **Gateway port 8243** (HTTPS): `https://localhost:8243`
- **Publisher port 9443** (internal): `https://localhost:9443/publisher/`

### Publishing the API to WSO2

Use the publication script to automatically register the FlowForge API:

```bash
# From repository root
.\infra\wso2\publish-api.ps1
```

**Script behavior:**
1. Waits for WSO2 to become healthy
2. Checks if FlowForge API already exists (idempotent)
3. Creates API definition if needed (name: "FlowForge API", version: "v1")
4. Configures backend endpoint: `http://backend:8080/api`
5. Publishes the API and deploys a revision to the Default gateway environment

**Success output example:**
```
✓ WSO2 is healthy (attempt 1, 0s elapsed)
Checking for existing APIs...
Creating new API in WSO2...
✓ API created successfully with ID: 917dec11-fb9b-4ce3-a5d2-dcbf859d7a7c
  Name: FlowForge API
  Version: v1
  Context: /flowforge

✓ API lifecycle transitioned to PUBLISHED
✓ API revision deployed to the Default gateway environment

Gateway Access:
  URL: https://localhost:8243/flowforge/jobs
  Note: Requires Bearer JWT token for authentication
```

**Idempotency:** Safe to run multiple times. Existing APIs are detected and reused.

### Testing the published API

```bash
# Test without WSO2 credentials (WSO2 returns 900902)
curl -k https://localhost:8243/flowforge/v1/jobs

# The gateway currently expects a WSO2 OAuth2/API credential. A FlowForge JWT
# is not a WSO2 token and is rejected by WSO2 before reaching the backend.
curl -k -H "Authorization: Bearer ${FLOWFORGE_JWT}" \
  https://localhost:8243/flowforge/v1/jobs

# Direct backend validation remains available for FlowForge JWT behavior
curl -k -H "Authorization: Bearer ${JWT_TOKEN}" \
  http://localhost:8080/api/jobs

# Submit a job with idempotency
curl -k -X POST \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Idempotency-Key: job-001" \
  -H "Content-Type: application/json" \
  -d '{"type":"DATA_SYNC","priority":"HIGH"}' \
  https://localhost:8243/flowforge/v1/jobs
```

### Verifying publication status

After running the publication script, check the API and deployment status:

```bash
# List all APIs (shows name, version, lifeCycleStatus)
docker compose --profile wso2 exec wso2-apim bash -c \
  'curl -k -s -u admin:admin https://localhost:9443/api/am/publisher/v4/apis' \
  | ConvertFrom-Json | Select-Object -ExpandProperty list | \
  Where-Object { $_.name -eq 'FlowForge API' } | \
  Select-Object name, version, lifeCycleStatus
```

The verified API ID is `0e4128a9-1e32-466e-92cc-25c3e6830604`; deployments are checked with:

```bash
docker compose --profile wso2 exec wso2-apim bash -c \
  'curl -k -s -u admin:admin https://localhost:9443/api/am/publisher/v4/apis/0e4128a9-1e32-466e-92cc-25c3e6830604/deployments'
```

**Expected output before manual publication:**
```
name              version lifeCycleStatus
----              ------- ---------------
FlowForge API     v1      CREATED
```

**Expected output after manual publication:**
```
name              version lifeCycleStatus
----              ------- ---------------
FlowForge API     v1      PUBLISHED
```

### Testing gateway routing

**Before publishing** (API in CREATED state):
```bash
# The unversioned path is not mapped by WSO2's default URL strategy
$ curl -k https://localhost:8243/flowforge/jobs
404 Not Found
```

**After publishing** (API in PUBLISHED state):
```bash
# Versioned route is deployed and WSO2 enforces its own credential boundary
$ curl -k https://localhost:8243/flowforge/v1/jobs
{"code":"900902","message":"Missing Credentials",...}
```

### Removing or unpublishing the API

**Via Publisher console:**
1. Open https://localhost:9443/publisher/
2. Find "FlowForge API" in your APIs list
3. Click the API menu and select "Retire" (to deprecate) or "Delete" (to remove)

**Via REST API (if needed):**
```bash
# List APIs to find the API ID
docker compose --profile wso2 exec wso2-apim bash -c \
  'curl -k -s -u admin:admin https://localhost:9443/api/am/publisher/v4/apis'

# Delete specific API
docker compose --profile wso2 exec wso2-apim bash -c \
  'curl -k -u admin:admin -X DELETE \
   https://localhost:9443/api/am/publisher/v4/apis/{API_ID}'
```

## Technical Architecture

### Request flow through WSO2 gateway

```
HTTP Client
  ↓ (request with Bearer JWT)
WSO2 API Gateway :8243
  ├─ TLS termination
  ├─ Route to backend context /flowforge → /api
  ├─ Pass-through headers (Authorization, X-Correlation-ID, etc.)
  ↓
Spring Boot Backend (Docker service, :8080)
  ├─ Receive at /api/{path}
  ├─ Spring Security validates JWT
  ├─ Enforce role-based access (USER, ADMIN)
  ├─ Execute business logic
  ├─ Generate response
  ↓
Response back through gateway
  ↓
HTTP Client receives response
```

### Responsibility boundary

- **WSO2 Gateway**: API lifecycle management, routing, rate limiting (future), subscriptions (future)
- **Spring Security**: JWT validation, role-based access control, resource ownership enforcement

JWT tokens are validated by Spring Security on the backend, not by the gateway in this configuration.

## Development considerations

⚠️ **WARNING**: This local WSO2 configuration uses:
- Hardcoded credentials (`admin:admin`)
- Self-signed TLS certificates
- No subscriptions, throttling, or rate limiting
- No advanced API policies

**For production:**
- Use external secret management (Vault, KeyVault)
- Obtain valid SSL certificates (CA-signed)
- Enable API policies and security controls
- Implement comprehensive monitoring and logging
- Configure rate limiting and quota enforcement
- Use managed identities for application credentials
- Review and harden all security settings
