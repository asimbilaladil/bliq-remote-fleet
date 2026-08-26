# Spec 01 — Project Bootstrap

## Goal
Stand up the foundational infrastructure that every subsequent feature builds on. After this PR, the server starts, connects to MongoDB, and responds to a liveness probe.

## Requirements

- NestJS application bootstrapped and listening on a configurable port (default `4000`)
- MongoDB connected via `MONGODB_URI` environment variable with a sensible local default
- All domain errors represented as typed classes with:
  - a stable machine-readable `code` string
  - a human-readable `message`
  - the correct HTTP status code
- Every error response — validation, domain, or unexpected — returns the same JSON envelope:
  ```json
  { "statusCode": 409, "error": "VEHICLE_ALREADY_ASSIGNED", "message": "...", "path": "...", "timestamp": "..." }
  ```
- `GET /api/health` returns `200 { "status": "ok" }` for liveness probes
- `docker-compose.yml` starts MongoDB 7 with a healthcheck on port `27017`
- `.env.example` documents all required environment variables

## Acceptance Criteria

- [ ] `docker compose up -d` starts MongoDB and reports healthy
- [ ] `npm run start:dev` starts without errors
- [ ] `GET /api/health` → `200 { "status": "ok" }`
- [ ] An unhandled exception returns `500` with the standard error envelope, not a raw stack trace
- [ ] A validation error (bad request body) returns `400 VALIDATION_FAILED` with the envelope

## Error Codes Introduced

| Code | Status | Meaning |
|------|--------|---------|
| `VALIDATION_FAILED` | 400 | Malformed body, query or id |
| `INTERNAL_ERROR` | 500 | Unexpected — logged with stack |

## Out of Scope

Feature modules (vehicles, operators, history, control) — added in subsequent PRs.
