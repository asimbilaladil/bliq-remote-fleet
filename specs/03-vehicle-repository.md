# Spec 03 — Vehicle Repository (Atomic Storage Layer)

## Goal
Implement the storage adapter so that every state transition is a **single atomic `findOneAndUpdate`** with the business rule baked into the filter. No read-then-write, ever.

## Requirements

### Abstract Interface (`VehicleRepository`)
Services depend on this abstract class — never on Mongoose directly. This makes unit tests mock-only and the storage layer swappable.

Methods required:
- `findAll(filter?)` — list vehicles, optionally by status
- `findById(id)` — single vehicle or null
- `findByOperator(operatorId)` — vehicle currently held by operator or null
- `claim(id, operatorId)` — atomic takeover attempt
- `release(id, operatorId)` — atomic release attempt
- `setStatus(id, status)` — atomic status change
- `create(data)` — insert new vehicle
- `rename(id, name)` — update name
- `deleteIfUnassigned(id)` — conditional delete

### Atomic Operations (the enforcement layer)

| Operation | MongoDB Filter | Rule Enforced |
|-----------|---------------|---------------|
| `claim()` | `{ status:'online', assignedOperatorId:null }` | R1 + R3 |
| `release()` | `{ assignedOperatorId: operatorId }` | R3 |
| `setStatus('offline')` | `{ assignedOperatorId: null }` | R4 |
| `setStatus('online')` | `{ _id }` | — |
| `deleteIfUnassigned()` | `{ assignedOperatorId: null }` | no delete while held |

### Duplicate Key Handling
A `claim()` that fails with MongoDB error `11000` (duplicate `assignedOperatorId`) must be caught and translated to `OperatorAlreadyHoldsVehicleError` (R2).

## Acceptance Criteria

- [ ] `claim()` with a valid online+unassigned vehicle returns the updated document
- [ ] `claim()` on an offline vehicle returns `null`
- [ ] `claim()` on an already-assigned vehicle returns `null`
- [ ] `claim()` by an operator who already holds a vehicle throws `OperatorAlreadyHoldsVehicleError`
- [ ] `release()` by the holder returns the updated document
- [ ] `release()` by a non-holder returns `null`
- [ ] `setStatus('offline')` while assigned returns `null`
- [ ] `setStatus('offline')` while unassigned returns the updated document
- [ ] All operations are single round-trip — no pre-read before write

## Concurrency Guarantee
When N requests race to `claim()` the same vehicle, exactly **one** matches the filter. The others receive `null` — not a stale read, an authoritative miss. This is proven in `concurrency.spec.ts` (PR 07).
