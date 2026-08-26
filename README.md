# Remote Fleet Control

A small service and interface for monitoring a fleet of driverless vehicles and handing
control of them to remote operators — built for the Bliq coding challenge.

**Stack:** NestJS · MongoDB (Mongoose) · Next.js (App Router) · TypeScript · Jest

---

## The problem in one paragraph

A vehicle has two **independent** states: whether it is *online* and whether an operator
is *holding* it. Four rules govern the transitions, and all four have to survive
simultaneous requests:

| # | Rule |
|---|------|
| R1 | A vehicle can only be taken when it is **online and unassigned** |
| R2 | An operator holds **at most one** vehicle |
| R3 | A vehicle is held by **at most one** operator |
| R4 | A vehicle **cannot go offline while assigned** — it must be released first |

Everything below is in service of making those four true under concurrency, and legible
to whoever reads the code next.

---

## Quick start

```bash
# 1. database
docker compose up -d              # MongoDB on :27017

# 2. backend  →  http://localhost:4000/api
cd backend
cp .env.example .env
npm install
npm run seed                      # 3 remote operators + 6 vehicles
npm run start:dev

# 3. frontend →  http://localhost:3000
cd ../frontend
cp .env.local.example .env.local
npm install
npm run dev
```

No Docker? Any MongoDB works — point `MONGODB_URI` at it. The tests need no database at
all; they spin up an in-memory MongoDB themselves.

```bash
cd backend && npm test            # 37 tests: unit, concurrency, e2e
```

### Environment

| Variable | Default | Where |
|---|---|---|
| `PORT` | `4000` | backend |
| `MONGODB_URI` | `mongodb://localhost:27017/bliq-fleet` | backend |
| `CORS_ORIGIN` | `http://localhost:3000` | backend |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api` | frontend |

---

## Concurrency: the central design decision

**Every state transition is a single atomic conditional update. Nothing is ever
read-then-written.** The rule lives in the *filter* of a `findOneAndUpdate`, so MongoDB
itself is the arbiter:

| Operation | Filter (the rule) | Update |
|---|---|---|
| takeover | `{_id, status:'online', assignedOperatorId:null}` | set operator + `assignedAt` |
| release | `{_id, assignedOperatorId: operatorId}` | clear both |
| go offline | `{_id, assignedOperatorId:null}` | `status:'offline'` |
| go online | `{_id}` | `status:'online'` |

When twenty operators reach for the same vehicle at once, exactly one document matches
the filter. The other nineteen get `null` back — not a stale read, an authoritative miss —
which the service turns into `409 VEHICLE_ALREADY_ASSIGNED`.

**R2 is the interesting one**, because "one vehicle per operator" spans *two* vehicle
documents and no single-document filter can express it. It is enforced by a **unique
partial index**:

```ts
VehicleSchema.index(
  { assignedOperatorId: 1 },
  { unique: true, partialFilterExpression: { assignedOperatorId: { $type: 'objectId' } } },
);
```

A second concurrent claim by the same operator fails with duplicate-key (11000), which the
repository translates to `409 OPERATOR_ALREADY_HOLDS_VEHICLE`. The race is not *handled*,
it is made impossible.

> **Why not a multi-document transaction?** It would also be correct, but it requires a
> replica set, costs a round trip per command, and puts the guarantee somewhere a reader
> has to reconstruct. The index states the invariant declaratively, right next to the
> schema. If a future invariant genuinely spans several collections — say, assignment plus
> a session ledger — a transaction becomes the right tool and the repository is the only
> layer that changes.

### The order of operations inside a use-case

```ts
const claimed = await this.vehicles.claim(vehicleId, operatorId);   // 1. write first
if (claimed) return present(claimed);
const current = await this.vehicles.findById(vehicleId);            // 2. read only to explain
```

The read happens **after** a failed write and never grants anything — it exists purely to
answer *why* the request was refused, so the operator sees "this vehicle is offline"
instead of a generic conflict. A unit test asserts this ordering explicitly, because
inverting it is the exact bug this design exists to prevent.

---

## Architecture

```
backend/src
├── common/          errors (typed domain errors) + the global exception filter
├── vehicles/
│   ├── vehicle.domain.ts          the four rules, as pure functions
│   ├── vehicles.service.ts        CRUD + connectivity use-cases
│   ├── vehicles.controller.ts     HTTP only
│   ├── vehicle.presenter.ts       persistence shape never leaks past here
│   └── repositories/              abstract port + Mongo adapter (atomic ops)
├── control/         takeover / release — the core use-cases
├── operators/       seeded, read-only
├── history/         append-only assignment event log
└── database/        seed
```

**Where the business rules live.** In the service layer, once. Controllers validate and
delegate — there is not a single `if` about vehicle state in a controller. Services depend
on the abstract `VehicleRepository`, never on Mongoose, which is what makes the unit tests
pure mocks and the storage swappable.

**On SOLID and DDD.** Applied where they earn their place: single responsibility per
layer, and dependency inversion at the repository boundary (this is what the tests lean
on). Deliberately *not* applied: aggregates, value objects, and a separate persistence
mapping. For two entities and four rules that machinery is cost without benefit — and
worse, the textbook DDD move of loading an aggregate, mutating it, and saving it is
precisely the read-then-write pattern that loses every race here.

**The rules appear twice, on purpose.** `vehicle.domain.ts` states them as readable pure
functions; the repository re-states them as atomic filters. The database is the authority;
the domain functions are the documentation, the source of precise error messages, and what
lets the UI disable an action *with a reason* before it is attempted. That duplication is a
considered trade, not an oversight.

### Events

Assignment changes are appended to an `assignment_events` collection (`taken_over`,
`released`, `went_online`, `went_offline`) so "who was operating BLQ-014 at 14:32?" has an
answer. The write is deliberately fire-and-forget: the command has already committed, and
a failed audit write must never turn a successful takeover into an error — it is logged
loudly instead.

This is **not** an event-driven architecture, and shouldn't be. The invariant is enforced
synchronously and atomically, because the caller needs a yes/no answer before it can
enable a button; only the *fact that it happened* is recorded asynchronously. Commands
stay consistent, facts get broadcast.

---

## API

Base URL `http://localhost:4000/api`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/vehicles` | List the fleet (`?status=online\|offline`) |
| `GET` | `/vehicles/:id` | One vehicle |
| `GET` | `/vehicles/:id/history` | Assignment event log (newest first) |
| `POST` | `/vehicles` | Create — `{ name, status? }` |
| `PATCH` | `/vehicles/:id` | Rename — `{ name }` |
| `DELETE` | `/vehicles/:id` | Delete (`409` if assigned) → `204` |
| `PATCH` | `/vehicles/:id/status` | `{ status: 'online' \| 'offline' }` |
| `POST` | `/vehicles/:id/takeover` | `{ operatorId }` |
| `POST` | `/vehicles/:id/release` | `{ operatorId }` |
| `GET` | `/operators` | Seeded operators |
| `GET` | `/health` | Liveness |

### Vehicle

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

### Errors

Every failure — validation, domain, or unexpected — comes back in one shape, from one
filter:

```json
{
  "statusCode": 409,
  "error": "VEHICLE_ALREADY_ASSIGNED",
  "message": "This vehicle is already being operated by another remote operator.",
  "path": "/api/vehicles/6650.../takeover",
  "timestamp": "2026-08-25T09:14:22.481Z"
}
```

`error` is a stable machine-readable code; the frontend switches on it and never parses
messages.

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
| `INTERNAL_ERROR` | 500 | Unexpected — logged with a stack |

---

## Frontend

One screen (`/`), fetched on load and polled every 5s so another operator's takeover shows
up without a manual refresh.

- **Operator picker** at the top stands in for signing in, and makes every rule
  demonstrable in a single screen — take a vehicle as Ada, try to take a second, try to
  take Ada's vehicle as Bruno, try to put it offline while held.
- **Optimistic updates with rollback.** A rejected action reverts the card, resyncs, and
  raises a toast carrying *the server's* message — "This vehicle is assigned to a remote
  operator. It must be released before going offline." Rejections should feel explained,
  not broken.
- **Disabled buttons say why** via `title`/`aria-label`, so the rules are legible before
  the click. The mirrored rules in `lib/rules.ts` are for affordance only — the server is
  still the sole authority and every action is really sent.
- **States:** skeleton grid while loading, retryable error panel, empty state pointing at
  the seed command. A failed background poll never blanks a working screen.
- **Responsive:** single column on mobile, 2–3 columns up, 44px minimum touch targets.

---

## Tests

`npm test` in `backend/` — 37 tests, depth over coverage.

| Suite | What it proves |
|---|---|
| `vehicle.domain.spec.ts` | The four rules as pure functions — no mocks, reads as a spec |
| `control.service.spec.ts` | Takeover/release decisions: which error explains a failed write, and that **the write is attempted before any read** |
| `test/concurrency.spec.ts` | The races, against a real MongoDB: **20 simultaneous takeovers → exactly 1 winner, 19 × 409**; one operator claiming two vehicles at once → 1 winner; takeover racing go-offline → never assigned-and-offline |
| `test/api.e2e.spec.ts` | HTTP status codes and the error-envelope contract the UI depends on |

The concurrency suite is the one that justifies the design. If the implementation ever
regressed to read-then-write, it would fail — and the unit tests would not.

---

## Assumptions

Where the brief left something open, this is the choice made and why.

1. **Remote operators are seeded, not CRUD-managed** (`npm run seed`), exposed read-only
   at `GET /operators`. The brief allows either; a full CRUD surface would add code
   without exercising any of the rules under evaluation.
2. **No authentication** — `operatorId` in the request body identifies the caller, as the
   brief permits. In production this comes from a token and the body field disappears; the
   service signature (`takeover(vehicleId, operatorId)`) does not change.
3. **Online/offline is operator-driven.** There is no telemetry feed, so connectivity is
   set through the API — which is also what the frontend requirement asks for.
4. **Re-taking a vehicle you already hold is idempotent success**, not a conflict. It is
   the same end state, and a retried request after a dropped response should not fail.
5. **A vehicle under control cannot be deleted** (`409`). The brief only forbids going
   offline while assigned, but deleting is strictly more destructive.
6. **Polling, not realtime.** 5s polling keeps the demo dependency-free; see below for the
   real answer.
7. **Vehicles are created offline** by default — a vehicle is not reachable until it says
   so.

---

## How I'd evolve this as the fleet grows

- **Realtime first.** Replace polling with a WebSocket/SSE gateway driven by the
  assignment events already being written. Operators need to see a vehicle go dark
  immediately, not up to five seconds later.
- **Heartbeats and stale-session reclaim.** Today a crashed operator holds a vehicle
  forever. Add a heartbeat with a TTL, and a reaper that auto-releases a hold whose
  operator has gone quiet — the single most important gap for real operations.
- **Vehicle-initiated connectivity.** Telemetry ingest sets `online`/`offline` from the
  vehicle side; a vehicle dropping while assigned becomes an *incident* (notify the
  operator, force-release after a grace period) rather than an illegal transition.
- **Auth and authorization.** JWT sessions, operator roles, and an admin scope for the
  vehicle CRUD — which should not be reachable by every operator.
- **Read-side scaling.** Pagination, filtering and projections on `GET /vehicles`; the
  current unbounded list is fine for six vehicles and wrong for six thousand.
- **Command safety.** Idempotency keys on takeover/release so a retried request is
  provably safe, and a per-vehicle command queue once actual driving commands (not just
  assignment) flow through.
- **Splitting the service.** When telemetry, dispatch and control separate, publish
  assignment events through an outbox so other services stay consistent without
  distributed transactions.
- **Observability.** Structured logs already carry the correlation, but the numbers worth
  alerting on are takeover conflict rate, hold duration, and time-to-release.

---

## A note on AI assistance

AI tooling was used while building this, as the brief permits. Every architectural
decision here — atomic filters over transactions, the unique partial index, write-then-
explain ordering, where the rules live, what was left out — is one I made deliberately and
can defend in detail.
