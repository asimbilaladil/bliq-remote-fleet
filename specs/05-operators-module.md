# Spec 05 — Operators Module

## Goal
Provide a read-only registry of remote operators. Operators are seeded — not user-created — and exposed so the frontend can populate the operator picker and the control layer can validate `operatorId` values.

## Requirements

### Operator Shape
```json
{ "id": "...", "name": "Ada Kessler", "email": "ada@bliq.test" }
```

### Endpoints

| Method | Path | Response |
|--------|------|----------|
| `GET` | `/api/operators` | `Operator[]` |

### Internal API (used by other modules)
- `assertExists(operatorId)` — throws `404 OPERATOR_NOT_FOUND` if the id is unknown. Called by `ControlService` before every takeover/release.
- `findAll()` — returns all operators; used by `VehiclesService` to resolve operator names on `GET /vehicles`

### Module Exports
`OperatorsService` is exported so `VehiclesModule` and `ControlService` can inject it without importing the full module independently.

## Acceptance Criteria

- [ ] `GET /api/operators` returns all seeded operators
- [ ] `assertExists` with an unknown id throws `OperatorNotFoundError` (404)
- [ ] `assertExists` with a valid id resolves without error
- [ ] `VehiclesService` can resolve operator names using `OperatorsService`

## Error Codes Introduced

| Code | Status | Meaning |
|------|--------|---------|
| `OPERATOR_NOT_FOUND` | 404 | Unknown operator id passed to takeover/release |

## Note on Auth
`operatorId` arrives in the request body (as the brief permits). In production it comes from a verified JWT; the `assertExists(operatorId)` signature does not change.

## Out of Scope
Operator CRUD (create, update, delete) — adding it would not exercise any of the four concurrency rules and is not required by the brief.
