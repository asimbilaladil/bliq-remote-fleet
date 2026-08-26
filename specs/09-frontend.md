# Spec 09 — Next.js Frontend

## Goal
A single-screen fleet control interface that makes every business rule demonstrable and legible without reading code.

## Requirements

### Operator Picker
- Dropdown listing all seeded operators — stands in for signing in
- Shows which vehicle the selected operator currently holds (if any)
- Selecting an operator updates all button states on the fleet grid

### Fleet Grid
- Displays all vehicles in a responsive grid (1 col mobile → 2 col tablet → 3 col desktop)
- Each vehicle card shows:
  - Vehicle name and current status (`online` / `offline`)
  - Who is holding it and since when (if assigned)
  - Four action buttons: **Set online**, **Set offline**, **Take over**, **Release**

### Action Buttons — Disabled States
Every button that cannot be clicked must show **why** via `title` attribute (hover tooltip) and `aria-label`:

| Button | Disabled when | Reason shown |
|--------|--------------|-------------|
| Set online | Already online | "Already online." |
| Set offline | Already offline | "Already offline." |
| Set offline | Vehicle assigned | "Assigned — operator must release first." |
| Take over | No operator selected | "Select who you are operating as first." |
| Take over | Vehicle offline | "Vehicle is offline — bring it online first." |
| Take over | Held by another | "Held by [name]." |
| Take over | Already yours | "You are already operating this vehicle." |
| Release | No operator selected | "Select who you are operating as first." |
| Release | Not assigned | "Nobody is operating this vehicle." |
| Release | Held by another | "Only the current operator can release it." |

### Optimistic Updates
- On action: immediately reflect the change in the UI (don't wait for server)
- On server success: confirm with the server's response
- On server rejection: **roll back** to the previous state, resync fleet, show a toast with the server's exact error message
- The server is always the authority — the frontend never assumes its optimistic state is final

### State Management
- Fleet state polled every **5 seconds** (no WebSocket needed for demo)
- A failed background poll must **never** blank a working screen
- `pending[vehicleId]` flag disables buttons while an action is in-flight for that vehicle

### States
- **Loading** — skeleton grid while initial fetch is in progress
- **Error** — retryable error panel if initial fetch fails
- **Empty** — prompt to seed the database if no vehicles exist

### Toast Notifications
- Success: green toast with action confirmation
- Error: red toast with the server's error message
- Toasts auto-dismiss after a few seconds

### Responsiveness
- Single column on mobile
- 2 columns at `sm` breakpoint
- 3 columns at `xl` breakpoint
- Minimum 44px touch targets on all interactive elements

## Acceptance Criteria

- [ ] Selecting Ada → taking BLQ-011 → shows BLQ-011 as "Yours" immediately (optimistic)
- [ ] Switching to Bruno → "Take over" on BLQ-011 is disabled with reason "Held by Ada Kessler"
- [ ] Bruno tries to take BLQ-011 anyway (via API) → toast shows `VEHICLE_ALREADY_ASSIGNED` message, card reverts
- [ ] Ada tries to take a second vehicle → disabled "You already hold BLQ-011"
- [ ] Trying to set BLQ-011 offline while Ada holds it → disabled "Assigned — operator must release first"
- [ ] Fleet grid updates within 5 seconds of a change made by another operator
- [ ] Failed initial fetch shows error panel with "Try again" button
- [ ] Empty database shows seed prompt

## Environment Variable

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api` | Backend base URL |
