# Spec 08 — Database Seed & Developer Experience

## Goal
Make the system runnable end-to-end with a single sequence of commands and document every design decision so the next developer (or reviewer) can understand the project without asking questions.

## Requirements

### Seed Data
`npm run seed` must insert (idempotently):

**Operators**
| Name | Email |
|------|-------|
| Ada Kessler | ada@bliq.test |
| Bruno Marsh | bruno@bliq.test |
| Chiara Vogt | chiara@bliq.test |

**Vehicles**
| Name | Initial Status |
|------|---------------|
| BLQ-011 | online |
| BLQ-014 | online |
| BLQ-023 | offline |
| BLQ-031 | online |
| BLQ-042 | offline |
| BLQ-057 | online |

### Idempotency
The seed uses `$setOnInsert` with `upsert: true`. Running `npm run seed` multiple times must never:
- Reset `assignedOperatorId` on a vehicle that has been taken over
- Duplicate any operator or vehicle record

### Quick-Start Sequence
```bash
docker compose up -d              # MongoDB on :27017
cd backend && cp .env.example .env
npm install && npm run seed && npm run start:dev
cd ../frontend && cp .env.local.example .env.local
npm install && npm run dev
```

### README
Must include:
- [ ] Quick-start commands
- [ ] Concurrency design rationale (why atomic filters, why unique partial index)
- [ ] Full API reference table (all endpoints, methods, bodies, responses)
- [ ] Full error code table
- [ ] Documented assumptions (no auth, polling not WebSocket, etc.)
- [ ] Evolution notes (what would change as fleet grows)

## Acceptance Criteria

- [ ] `npm run seed` completes without error on a fresh database
- [ ] `npm run seed` run twice does not duplicate records
- [ ] `npm run seed` on a database with existing assignments does not reset `assignedOperatorId`
- [ ] `npm test` in `backend/` passes all 37 tests (no database required)
- [ ] README answers: how to run, why atomic filters, what each error code means
