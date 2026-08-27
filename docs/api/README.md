# API Documentation

Protected endpoints require a bearer JWT unless noted otherwise. Requests may
include `X-Correlation-ID`; the backend returns the same value or generates one.

Initial endpoints:

## Health

`GET /api/health`

`GET /api/health/live`

`GET /api/health/ready`

## APIs

`GET /api/apis`

`POST /api/apis`

Example:

```json
{
  "name": "Report API",
  "description": "Generates project reports",
  "version": "v1",
  "basePath": "/reports",
  "backendUrl": "http://example-service/reports"
}
```

## Jobs

`GET /api/jobs`

`GET /api/jobs/{id}`

`POST /api/jobs`

`POST /api/jobs` accepts an optional `Idempotency-Key` header with a maximum of
128 characters. The key is scoped to the authenticated user. An identical replay
returns the original job with `200`; a different request returns `409 Conflict`.

Example:

```json
{
  "type": "REPORT",
  "requestPayload": "{\"projectId\":123,\"format\":\"PDF\"}"
}
```
