# Spec 07 — Fleet Control (Takeover & Release)

## Goal
Implement the two core use-cases — **takeover** and **release** — and prove they are correct under simultaneous concurrent load. This is the central engineering challenge of the project.

## Requirements

### Endpoints

| Method | Path | Body | Success |
|--------|------|------|---------|
| `POST` | `/api/vehicles/:id/takeover` | `{ operatorId }` | `200 Vehicle` |
| `POST` | `/api/vehicles/:id/release` | `{ operatorId }` | `200 Vehicle` |

### Takeover Rules (must all survive concurrency)

| Condition | Response |
|-----------|----------|
| Operator does not exist | `404 OPERATOR_NOT_FOUND` |
| Vehicle does not exist | `404 VEHICLE_NOT_FOUND` |
| Vehicle is offline | `409 VEHICLE_OFFLINE` |
| Vehicle held by another operator | `409 VEHICLE_ALREADY_ASSIGNED` |
| Operator already holds a **different** vehicle | `409 OPERATOR_ALREADY_HOLDS_VEHICLE` |
| Operator already holds **this** vehicle | `200` (idempotent — same end state) |
| Vehicle is online and unassigned | `200 Vehicle` with operator set |

### Release Rules

| Condition | Response |
|-----------|----------|
| Operator does not exist | `404 OPERATOR_NOT_FOUND` |
| Vehicle does not exist | `404 VEHICLE_NOT_FOUND` |
| Vehicle is not held by this operator | `409 NOT_HOLDER` |
| Vehicle is held by this operator | `200 Vehicle` with operator cleared |

### Write-First-Read-Later Pattern (mandatory)
```
Step 1: attempt atomic write   ← MongoDB is the arbiter
Step 2: if null returned, re-read to explain WHY  ← never to grant
```
Step 2 must never grant the operation. A unit test (`control.service.spec.ts`) explicitly asserts this ordering.

### Event Recording
On success: append `taken_over` or `released` to the assignment history (fire-and-forget).

## Acceptance Criteria

### Functional
- [ ] Takeover on an offline vehicle → `409 VEHICLE_OFFLINE`
- [ ] Takeover on a held vehicle → `409 VEHICLE_ALREADY_ASSIGNED`
- [ ] Operator taking a second vehicle → `409 OPERATOR_ALREADY_HOLDS_VEHICLE`
- [ ] Re-taking the same vehicle → `200` (idempotent)
- [ ] Release by non-holder → `409 NOT_HOLDER`
- [ ] Successful takeover appends `taken_over` event
- [ ] Successful release appends `released` event

### Concurrency (proven by `concurrency.spec.ts` against real in-memory MongoDB)
- [ ] 20 simultaneous takeovers on 1 vehicle → exactly **1 winner**, 19 × `VEHICLE_ALREADY_ASSIGNED`
- [ ] Same operator races to claim 2 vehicles simultaneously → exactly **1 succeeds** (R2 via unique partial index)
- [ ] Takeover racing go-offline → the `assigned + offline` state is **never reached** (R4)
- [ ] Release then re-takeover → correct sequential handoff works
- [ ] History log after takeover + release → events in `taken_over → released` order

### Unit (`control.service.spec.ts`)
- [ ] Write is attempted **before** any read
- [ ] Each `Rejection` code maps to the correct `DomainError` subclass and HTTP status

## Error Codes Introduced

| Code | Status | Meaning |
|------|--------|---------|
| `OPERATOR_ALREADY_HOLDS_VEHICLE` | 409 | R2 — release yours first |

## Why Not a Transaction?
The unique partial index expresses R2 *declaratively* next to the schema. A transaction would also be correct but requires a replica set, costs extra round trips, and buries the guarantee in imperative code. If a future invariant spans multiple collections, a transaction becomes appropriate — the repository is the only layer that changes.
