# Claude brief 02 — people using facilities

Start from merged brief 01. Read the new world/zone API, `js/state.js`, `js/unit.js`, `js/mission.js` and `DESIGN.md`. Keep simulation outcomes and clocks unchanged while making building use observable.

## Deliverable

Model a unit's presentation/route phase separately from its gameplay status: approaching entrance, entering, walking to a reserved activity slot, using it, leaving. Each building exposes typed slots with stable IDs and occupancy limits. For the golden slice implement gate greeting/admission, reception wait, barracks rest and range training. Range has at least two distinct firing slots. Other buildings may use a generic but visibly appropriate slot contract until their art pass.

Use the world path graph for travel between sites, plus short collision-safe local movement from entrance to slot. Reserve before committing to a slot; release on mission dispatch, hospital transfer, reassignment, unload, build removal or status change. Resolve full facilities with an explicit queue/fallback. Keep selection and unit identity throughout. Training/needs effects begin only when the soldier reaches the correct slot and the relevant facility is built and staffed; never show activity while still walking or at an unbuilt plot. Do not alter mission success chances, costs, XP, hospital duration or day compression.

Make civilian admission readable: walk from outside to gate, pause at the checkpoint, then proceed to a reception waiting slot; on recruitment move to barracks and transition into uniform at the appropriate point. Define deterministic transitions for save/reload and offline catch-up so slots cannot be double-booked.

## Proof

- A scripted recruit-to-range simulation demonstrates gate entry, reception, recruitment, pathfinding, one occupied range slot, training gain and mission departure.
- Two soldiers occupy separate slots; a third queues. Reassignment and hospital transfer release the old slot. Reload mid-activity and after an overdue mission preserves identities and doesn't duplicate reservations.
- Existing smoke tests still pass. Supply an activity event trace or small visual debug overlay that the rendering brief can consume.

Do not draw an activity as a floating icon over a roof and call that an interaction. This brief supplies precise world-state and anchor data; the next brief draws it.
