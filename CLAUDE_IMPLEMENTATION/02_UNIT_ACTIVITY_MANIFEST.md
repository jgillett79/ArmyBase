# Brief 02 handoff — visible facility use (for brief 03)

Brief 02 adds world-state and anchor data for people using facilities. It deliberately draws almost nothing new. Brief 03 should consume the contract below. Source: `js/state.js` (the "VISIBLE FACILITY USE" section) and `js/unit.js`.

## Gameplay status vs route phase

`unit.status` is unchanged and remains the only simulation state. Presentation lives beside it on `Unit`. These fields are never saved:

| Field | Meaning |
| --- | --- |
| `slot` | Reserved slot: `{ buildingId, slotId, x, y, facing, activity }`, or `null` |
| `queuedFor` | Building id while waiting for a full facility |
| `legPhase` | Tag of the current route leg: `travel`, `approach`, `enter`, `leave`, `queue`, `depart` or `leave_base` |
| `departing` | Walking out of the gate after mission dispatch. Such a unit is `ON_MISSION` but still drawn |
| `checkpointUntil` | A visitor pausing at the gate (real ms) |
| `routePhase` (getter) | `checkpoint`, `using`, `queued`, else `legPhase` |
| `isAtSlot()` | Path finished and within 2 px of the reserved slot |

A soldier using a building goes through these phases:

1. `approach`: walking the path graph to the entrance.
2. `enter`: entrance to slot.
3. `using`: at the slot. On arrival, `facing` is set to `slot.facing`.
4. `leave`: slot back to the entrance. Any new route from inside a zone starts this way.

A visitor goes through: `approach` to the gate, then `checkpoint` (2.5 s real), then `approach` and `enter` to a reception chair, then `using` (seated), then either recruitment or `leave_base`.

## Slots and occupancy

- `FACILITY_ACTIVITIES` gives the activity key per building type: `wait`, `rest`, `fire`, `lift`, `traverse`, `drill`, `eat`, `wash` or `relax`. Each slot carries it as `slot.activity`, which is the animation key for brief 04.
- `GameState.facilitySlots(building, minCount)` depends on the building:
  - **Training buildings:** the first `capacity` of the zone's six anchors (2, 4 or 6 by level). The level-1 range has two distinct firing slots.
  - **Entrance Hall:** its four chairs.
  - **Barracks and needs buildings:** unlimited capacity by design. Extra standing spots are generated inside the footprint, so they never queue.
- Reservation state:
  - `slotOccupants` is a `Map` from `"buildingId:slotId"` to unit id.
  - `queues` is a `Map` from building id to unit ids, first come first served.
  - `queuePosition(building, i)` steps back along the spur from the entrance.
- Reservation methods:
  - `reserveSlot(unit, building)` picks the free slot nearest the unit.
  - `releaseSlot(unit, reason)` frees a slot or queue place, then runs `admitFromQueue()`.
- Release happens on every `routeForStatus()` (any status change or re-route), and also on:
  - `dispatchMission()`
  - `hospitalize()`, which is now the only path into hospital
  - `removeUnit()`
  - visitor timeout, recruitment, and despawn
  - upgrades, which call `admitFromQueue()`

  There is no demolish feature to hook into.
- Reload is deterministic. Reservations aren't saved. `fromSaveData()` re-routes units in roster order, and each re-reserves the slot nearest where it was saved, which is normally the slot it stood on. Double-booking is impossible because the map starts empty.

## Simulation alignment

`isUsingFacility(unit, building)` is the single condition for both effects and drawing. It requires a built building, a slot held there, and `isAtSlot()`. Food, hygiene, morale and training gains now use it instead of "near the door". Sleep's lower energy drain was never location-gated and still isn't. Changing that would be a balance change, so it's left alone.

Unchanged: mission odds, costs, XP, hospital duration, day compression and schedule.

## Rendering hooks already in place

- `activeFacilityFor()` uses `isUsingFacility()`, so the old floating cues only show at a slot.
- Departing squads are drawn until they pass the gate.
- Labels read `queuing` and `deploying`.
- `GameState.activitySnapshot()` returns per-unit `{ status, phase, buildingId, slotId, activity, queuedFor }` plus the non-empty queues.
- `GameState.activityLog` is a bounded event trace. Events are `reserve`, `release`, `queue`, `leave_queue`, `admitted_from_queue`, `phase`, `checkpoint`, `admitted`, `recruited`, `uniform`, `depart` and `hospital`. See `docs/brief02-activity-trace.txt`.
- Recovering soldiers walk to the `aid_station` node and wait there.

## For brief 03

Draw the station activity at `unit.slot` while `routePhase === 'using'`, and sort people by ground-contact y inside the correct layer. The current interim cues are floating icons, and the brief says not to count those as interaction. The brief 04 poses should key on `slot.activity` plus `routePhase`.
