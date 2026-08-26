# Spec 02 — Vehicle Domain Model

## Goal
Define what a vehicle *is* and what state transitions are *legal* — as pure TypeScript with no framework or database dependency. This becomes the single source of truth for error messages and UI disabled-reason text.

## Requirements

### Vehicle State
A vehicle has two independent states:
- `status`: `online` | `offline`
- `assignedOperatorId`: `ObjectId | null` (null = unassigned)

### The Four Rules (pure functions)

| Rule | Function | Returns |
|------|----------|---------|
| R1 | `canBeTakenBy(vehicle, operatorId)` | `null` (allowed) or `Rejection` code |
| R2 | Enforced by unique partial index (see schema) | — |
| R3 | `canBeTakenBy` also covers R3 | — |
| R4 | `canChangeStatusTo(vehicle, status)` | `null` or `Rejection` code |

#### R1 — `canBeTakenBy`
- Vehicle offline → `VEHICLE_OFFLINE`
- Vehicle assigned to a different operator → `VEHICLE_ALREADY_ASSIGNED`
- Vehicle assigned to the **same** operator → `null` (idempotent re-take is success)
- Vehicle online and unassigned → `null`

#### R4 — `canChangeStatusTo`
- Going offline while assigned → `VEHICLE_ASSIGNED_CANNOT_GO_OFFLINE`
- Any other transition → `null`

#### Release — `canBeReleasedBy`
- Caller is not the holder → `NOT_HOLDER`
- Caller is the holder → `null`

### Schema
- `name`: string, unique, required
- `status`: enum `online | offline`, default `offline`
- `assignedOperatorId`: ObjectId | null, default null
- `assignedAt`: Date | null
- **Unique partial index** on `assignedOperatorId` where `$type: 'objectId'` — enforces R2 at the database level

### DTOs
- `CreateVehicleDto` — `name` (required), `status` (optional, default offline)
- `UpdateVehicleDto` — `name` (required)
- `UpdateStatusDto` — `status` enum
- `OperatorActionDto` — `operatorId` (required MongoId)
- `ListVehiclesQuery` — optional `status` filter

## Acceptance Criteria

- [ ] All four rule functions return the correct rejection code for every invalid input
- [ ] Idempotent re-take (same operator) returns `null` not a rejection
- [ ] All DTOs reject invalid input with `VALIDATION_FAILED`
- [ ] Schema includes the unique partial index on `assignedOperatorId`

## Test File
`backend/src/vehicles/vehicle.domain.spec.ts` — 16 tests, no mocks, reads as a living specification.

## Error Codes Introduced

| Code | Status | Meaning |
|------|--------|---------|
| `VEHICLE_NOT_FOUND` | 404 | Unknown vehicle id |
| `VEHICLE_NAME_TAKEN` | 409 | Duplicate vehicle name |
| `VEHICLE_OFFLINE` | 409 | R1 — cannot take an offline vehicle |
| `VEHICLE_ALREADY_ASSIGNED` | 409 | R1/R3 — someone else holds it |
| `VEHICLE_ASSIGNED_CANNOT_GO_OFFLINE` | 409 | R4 |
| `VEHICLE_ASSIGNED_CANNOT_DELETE` | 409 | Cannot delete a held vehicle |
| `NOT_HOLDER` | 409 | Only the holder may release |
