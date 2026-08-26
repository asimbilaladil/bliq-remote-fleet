# Remote Fleet Control

A service and interface for monitoring a fleet of driverless vehicles and handing control of them to remote operators.

**Stack:** NestJS · MongoDB (Mongoose) · Next.js (App Router) · TypeScript · Jest

---

## The Problem

A vehicle has two **independent** states: whether it is *online* and whether an operator is *holding* it. Four rules govern all transitions, and all four must hold under simultaneous requests:

| # | Rule |
|---|------|
| R1 | A vehicle can only be taken when it is **online and unassigned** |
| R2 | An operator holds **at most one** vehicle |
| R3 | A vehicle is held by **at most one** operator |
| R4 | A vehicle **cannot go offline while assigned** — it must be released first |

---

## Quick Start

```bash
# 1. Database
docker compose up -d              # MongoDB on :27017

# 2. Backend  →  http://localhost:4000/api
cd backend
cp .env.example .env
npm install
npm run seed                      # seeds 3 operators + 6 vehicles
npm run start:dev

# 3. Frontend →  http://localhost:3000
cd ../frontend
cp .env.local.example .env.local
npm install
npm run dev
```

No Docker? Any MongoDB works — point `MONGODB_URI` at it.

```bash
cd backend && npm test            # 37 tests: unit, concurrency, e2e
```

### Environment Variables

| Variable | Default | Where |
|---|---|---|
| `PORT` | `4000` | backend |
| `MONGODB_URI` | `mongodb://localhost:27017/bliq-fleet` | backend |
| `CORS_ORIGIN` | `http://localhost:3000` | backend |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api` | frontend |

---

## Project Structure

```
backend/src
├── common/          typed domain errors + global exception filter
├── vehicles/
│   ├── vehicle.domain.ts          the four rules as pure functions
│   ├── vehicles.service.ts        CRUD + connectivity operations
│   ├── vehicles.controller.ts     HTTP routing only
│   ├── vehicle.presenter.ts       maps DB documents to API responses
│   └── repositories/              abstract interface + MongoDB adapter (atomic ops)
├── control/         takeover / release use-cases
├── operators/       seeded, read-only operator registry
├── history/         append-only assignment event log
└── database/        seed script

frontend/
├── app/             Next.js App Router pages
├── components/      VehicleCard, OperatorPicker, ActionButton, StatusBadge, Toaster
├── hooks/           useFleet (state + optimistic updates), useToasts
└── lib/             api client, business rule helpers, shared types

specs/               one spec doc per feature PR (requirements + acceptance criteria)
```

---

## Concurrency Design

**Every state transition is a single atomic `findOneAndUpdate`.** The business rule lives in the filter, so MongoDB itself is the arbiter — no read-then-write, ever.

| Operation | Filter | Update |
|---|---|---|
| takeover | `{ status:'online', assignedOperatorId:null }` | set operator + `assignedAt` |
| release | `{ assignedOperatorId: operatorId }` | clear both |
| go offline | `{ assignedOperatorId:null }` | `status:'offline'` |
| go online | `{ _id }` | `status:'online'` |

When 20 operators race for the same vehicle, exactly one document matches the filter. The other 19 get `null` back — an authoritative miss — which becomes `409 VEHICLE_ALREADY_ASSIGNED`.

**R2** (one vehicle per operator) spans two documents, so it is enforced by a **unique partial index**:

```ts
VehicleSchema.index(
  { assignedOperatorId: 1 },
  { unique: true, partialFilterExpression: { assignedOperatorId: { $type: 'objectId' } } },
);
```

A second concurrent claim by the same operator fails with duplicate-key error 11000, translated to `409 OPERATOR_ALREADY_HOLDS_VEHICLE`.

---

## API

Base URL `http://localhost:4000/api`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/vehicles` | List fleet (`?status=online\|offline`) |
| `GET` | `/vehicles/:id` | Single vehicle |
| `GET` | `/vehicles/:id/history` | Assignment event log (newest first) |
| `POST` | `/vehicles` | Create — `{ name, status? }` |
| `PATCH` | `/vehicles/:id` | Rename — `{ name }` |
| `DELETE` | `/vehicles/:id` | Delete — `409` if assigned |
| `PATCH` | `/vehicles/:id/status` | `{ status: 'online' \| 'offline' }` |
| `POST` | `/vehicles/:id/takeover` | `{ operatorId }` |
| `POST` | `/vehicles/:id/release` | `{ operatorId }` |
| `GET` | `/operators` | List seeded operators |
| `GET` | `/health` | Liveness probe |

### Vehicle Response

```json
{
  "id": "6650c1f2a4b3c2d1e0f00014",
  "name": "BLQ-014",
  "status": "online",
  "assignedOperatorId": "6650c1f2a4b3c2d1e0f00001",
  "assignedOperatorName": "Ada Kessler",
  "assignedAt": "2026-08-25T09:14:22.481Z",
  "createdAt": "2026-08-25T08:00:00.000Z",
  "updatedAt": "2026-08-25T09:14:22.481Z"
}
```

### Error Response

Every error returns the same shape:

```json
{
  "statusCode": 409,
  "error": "VEHICLE_ALREADY_ASSIGNED",
  "message": "This vehicle is already being operated by another remote operator.",
  "path": "/api/vehicles/6650.../takeover",
  "timestamp": "2026-08-25T09:14:22.481Z"
}
```

| Code | Status | Meaning |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Malformed body, query or id |
| `VEHICLE_NOT_FOUND` / `OPERATOR_NOT_FOUND` | 404 | Unknown entity |
| `VEHICLE_NAME_TAKEN` | 409 | Duplicate vehicle name |
| `VEHICLE_OFFLINE` | 409 | R1 — cannot take an offline vehicle |
| `VEHICLE_ALREADY_ASSIGNED` | 409 | R1/R3 — someone else holds it |
| `OPERATOR_ALREADY_HOLDS_VEHICLE` | 409 | R2 — release yours first |
| `VEHICLE_ASSIGNED_CANNOT_GO_OFFLINE` | 409 | R4 |
| `VEHICLE_ASSIGNED_CANNOT_DELETE` | 409 | Cannot delete a vehicle under control |
| `NOT_HOLDER` | 409 | Only the holder may release |
| `INTERNAL_ERROR` | 500 | Unexpected — logged with stack trace |

---

## Frontend

Single screen at `/`, polled every 5s so another operator's takeover appears without a manual refresh.

- **Operator picker** — select who you are operating as; makes all four rules demonstrable in one screen
- **Optimistic updates** — actions reflect immediately; on server rejection the card reverts and a toast shows the server's exact error message
- **Disabled buttons say why** — hover tooltip explains the reason before you click
- **States** — skeleton loading, retryable error panel, empty state with seed prompt
- **Responsive** — 1 column mobile, 2 tablet, 3 desktop; 44px minimum touch targets

---

## Tests

```bash
cd backend && npm test    # 37 tests
```

| Suite | What it covers |
|---|---|
| `vehicle.domain.spec.ts` | The four rules as pure functions — no mocks |
| `control.service.spec.ts` | Takeover/release error mapping; write-before-read ordering |
| `test/concurrency.spec.ts` | 20 simultaneous takeovers → exactly 1 winner; R2, R4 under concurrent load |
| `test/api.e2e.spec.ts` | HTTP status codes and error envelope shape |

Tests use an in-memory MongoDB — no running database needed.

---

## Seed Data

`npm run seed` inserts (idempotent — safe to run multiple times):

**Operators:** Ada Kessler · Bruno Marsh · Chiara Vogt

**Vehicles:** BLQ-011, BLQ-014, BLQ-031, BLQ-057 (online) · BLQ-023, BLQ-042 (offline)
