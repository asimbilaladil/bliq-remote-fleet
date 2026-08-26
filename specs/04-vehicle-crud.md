# Spec 04 — Vehicle CRUD Service & API

## Goal
Expose the full vehicle management surface over HTTP. The controller validates and delegates — no business logic lives there. The service orchestrates repository calls and records connectivity events.

## Requirements

### Endpoints

| Method | Path | Body | Response |
|--------|------|------|----------|
| `GET` | `/api/vehicles` | — | `Vehicle[]` |
| `GET` | `/api/vehicles?status=online` | — | `Vehicle[]` filtered |
| `GET` | `/api/vehicles/:id` | — | `Vehicle` |
| `POST` | `/api/vehicles` | `{ name, status? }` | `201 Vehicle` |
| `PATCH` | `/api/vehicles/:id` | `{ name }` | `Vehicle` |
| `DELETE` | `/api/vehicles/:id` | — | `204` |
| `PATCH` | `/api/vehicles/:id/status` | `{ status }` | `Vehicle` |

### Vehicle Response Shape
```json
{
  "id": "...",
  "name": "BLQ-014",
  "status": "online",
  "assignedOperatorId": null,
  "assignedOperatorName": null,
  "assignedAt": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Business Rules
- `GET /vehicles` batch-loads operator names so the response includes `assignedOperatorName`
- `DELETE` returns `409 VEHICLE_ASSIGNED_CANNOT_DELETE` if vehicle is currently held
- `PATCH /status` returns `409 VEHICLE_ASSIGNED_CANNOT_GO_OFFLINE` if going offline while held (R4)
- Duplicate name on `POST` returns `409 VEHICLE_NAME_TAKEN`
- Unknown `:id` returns `404 VEHICLE_NOT_FOUND`

### Write-First-Read-Later
For `setStatus`, attempt the atomic write first. Only re-read if it returned null — to explain why, never to grant.

### Controller Rules
- No `if` about vehicle state in the controller
- Validation via `class-validator` DTOs only
- Delegation to service only

## Acceptance Criteria

- [ ] `POST /api/vehicles` with duplicate name → `409 VEHICLE_NAME_TAKEN`
- [ ] `DELETE /api/vehicles/:id` while assigned → `409 VEHICLE_ASSIGNED_CANNOT_DELETE`
- [ ] `PATCH /api/vehicles/:id/status` body `{ status: "offline" }` while assigned → `409 VEHICLE_ASSIGNED_CANNOT_GO_OFFLINE`
- [ ] `GET /api/vehicles` includes `assignedOperatorName` when vehicle is held
- [ ] `GET /api/vehicles/:id` unknown id → `404 VEHICLE_NOT_FOUND`
- [ ] `POST /api/vehicles` missing `name` → `400 VALIDATION_FAILED`
- [ ] New vehicles default to `status: offline` and `assignedOperatorId: null`
