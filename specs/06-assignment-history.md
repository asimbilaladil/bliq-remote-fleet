# Spec 06 — Assignment History

## Goal
Maintain an append-only audit log of every vehicle state change so the question *"who was operating BLQ-014 at 14:32?"* has a reliable answer.

## Requirements

### Event Schema
Each event captures:
- `vehicleId` — ObjectId ref
- `vehicleName` — denormalised string (survives vehicle rename)
- `operatorId` — ObjectId ref or null (null for connectivity events)
- `type` — one of the four event types below
- `occurredAt` — timestamp

### Event Types

| Type | Triggered by |
|------|-------------|
| `taken_over` | Successful `POST /vehicles/:id/takeover` |
| `released` | Successful `POST /vehicles/:id/release` |
| `went_online` | `PATCH /vehicles/:id/status` → `online` |
| `went_offline` | `PATCH /vehicles/:id/status` → `offline` |

### Endpoints

| Method | Path | Response |
|--------|------|----------|
| `GET` | `/api/vehicles/:id/history` | `AssignmentEvent[]` newest-first |

### Fire-and-Forget Write
`record()` must **never** cause a successful takeover/release to fail. If the event write fails it is logged loudly but the command response is already committed. The caller does not `await` the result in a way that propagates the error.

### Ordering Guarantee
Events are returned sorted by `occurredAt` descending (newest first).

## Acceptance Criteria

- [ ] Successful takeover appends a `taken_over` event
- [ ] Successful release appends a `released` event
- [ ] Going online appends `went_online`; going offline appends `went_offline`
- [ ] `GET /api/vehicles/:id/history` returns events newest-first
- [ ] A write failure in `record()` does **not** cause the parent operation to throw
- [ ] `vehicleName` is stored on the event (not just `vehicleId`)

## Design Note
This is **not** event-driven architecture. Invariants are enforced synchronously and atomically; only the fact that a change happened is recorded asynchronously. Commands stay consistent, facts get broadcast.
