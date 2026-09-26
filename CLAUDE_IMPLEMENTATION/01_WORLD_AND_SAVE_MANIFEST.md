# Brief 01 handoff — world data, routing and save v2

This is the exact contract that brief 01 delivered. Briefs 02–04 build on it. Source of truth: `js/world.js` and `js/save.js`.

## Script order

`utils → world → unit → building → mission → state → save → render → main` (index.html, tests and service worker all list `world.js` and `save.js`).

## World (`js/world.js`)

- `WORLD_ID = 'first_base_v1'` and `WORLD_W × WORLD_H = 1600 × 960` world px. The world is independent of the 960 × 576 canvas.
- `WORLD.terrain[]` has the shape `{ id, kind: 'water'|'cliff'|'rock', polygon: [[x,y]...] }`. These are exclusions. Nothing is built on or walks through them.
- `WORLD.nodes` has the shape `{ id: {x, y} }`:
  - `gate_outside` is off-map at x −40. Visitors spawn and despawn there.
  - `gate` is the checkpoint in the west fence gap.
  - `gate_inside`
  - `aid_station` is the hospital fallback.
  - Trunk nodes are `t1–t7`, `w1` and `n1–n5`.
- `WORLD.edges[]` has the shape `{ from, to, via?: [[x,y]] }` and describes the trunk trail. The `via` points bend the walked line and the drawn line identically.
- `WORLD.safeNodes` is `{ gate: 'gate_inside', waiting: 'door:zone_reception', hospital: 'aid_station' }`.
- `WORLD.zones[]` fields:
  - `id` is stable. The ten ids are `zone_reception`, `zone_west_rise`, `zone_north_terrace`, `zone_centre_knoll`, `zone_river_bend`, `zone_east_meadow`, `zone_south_green`, `zone_southwest_flats`, `zone_riverside` and `zone_ford` (spare).
  - `label`.
  - `types`: the allowed building types.
  - `doorSide`: `'south'` or `'north'`. Only open-air stations may use `north`, because enclosed three-quarter art can't show a north door.
  - `orientations`: currently `['three_quarter_south']` everywhere.
  - `surveyed`: shown faintly on a fresh base.
  - `accessNode`: the trunk node its spur joins.
  - `footprint`: a polygon.
  - `entrance`: `{x, y}`, just outside the footprint.
  - `slots[]`: `{ id, x, y, facing }`, generic anchors inside the footprint.
- The reception zone's four slots are the Entrance Hall waiting chairs. Brief 02 should give the slots types per building (range firing slots and so on) and add occupancy.
- `WORLD.defaultPlacements` maps building type to zone id. It is used for fresh bases and v1 migration.
- `WORLD.fences` is decorative polylines. Rendering only.
- Implicit nodes named `door:<zoneId>` sit at each zone entrance. Each zone adds a spur edge `accessNode → door:<zoneId>`.
- API:
  - Lookups: `zoneById`, `doorNodeId`, `zoneAllowsType`, `worldNodePosition`.
  - Graph and routing: `worldEdgeList(zoneIds|null)`, `findWorldRoute(x, y, goalNodeId, zoneIds|null)`, `pointAlongEdge`, `edgePrefix`, `nearestTrunkNode`.
  - Validation: `validateWorld()`.
  - Geometry: `pointInPolygon`, `polygonDistance`, `segmentPolygonDistance`, `pointPolygonDistance`, `polygonBounds`, `polygonCentroid`.
- `findWorldRoute` works as follows:
  - It projects `(x, y)` onto the nearest edge of the allowed graph.
  - It runs Dijkstra from both ends of that edge, with the partial distances as start costs.
  - It returns a polyline of `{x, y}` points, or `null`.
  - The `zoneIds` argument limits which spurs exist.
- Validation clearances are `ZONE_CLEARANCE = 16`, `TERRAIN_CLEARANCE = 16` and `PATH_CLEARANCE = 8`.

## Simulation changes (`js/state.js`, `js/building.js`, `js/unit.js`)

- Buildings keep their fixed ids, types, costs, capacities and levels. `gridX`/`gridY` and `BUILDING_FOOTPRINT_CELLS` are gone. Each building has `zoneId`.
- `GameState` additions:
  - Building access: `allBuildings`, `buildingByAnyId`, `placedZoneIds` (the routable spurs), `placeBuilding(building, zoneId)` (unbuilt buildings only, into a legal free zone).
  - Waiting chairs: `waitingSlots`, `chairPosition(i)`.
  - Routing: `routeToNode(unit, nodeId, finish?)`, `routeToBuilding(unit, building)` (door node, then 8 px inward with ±10 px spread), `routeToRandomRoadPoint(unit)` (a point on a trunk edge).
- Removed: `routeTo`, `roadSpokeXs`, `buildingCenter`, `bounds`, and the constants `GRID_*`, `CELL_SIZE`, `GATE_*`, `WALL_THICKNESS`, `ROAD_Y_SPINE`, `ENTRANCE_HALL_CHAIRS`, `roadYAt()`.
- Global helpers: `buildingZone(b)`, `buildingDoor(b)` (the zone entrance) and `gatePosition(nodeId)`.
- Civilians follow this sequence:
  1. Spawn at `gate_outside` and walk to `gate`.
  2. Claim a chair and route to it via `door:zone_reception`.
  3. After the timeout, route to `gate_outside` and despawn on arrival.
- Mission success returns the unit at `gate_inside`.
- `Unit.speed` is now 30–46 world px/s, the old 18–28 scaled to the larger world, so walk times stay comparable. No balance numbers changed.

## Rendering (interim)

- `render.js` fits the whole world into the canvas: `VIEW_SCALE = 0.6`.
- `screenToWorld()` is used by `main.js` click hit testing, and `worldToScreen()` is its inverse. Brief 03 replaces the fixed fit with a pan/zoom camera behind the same two functions.
- Units are drawn at 40 × 60 world px.
- Buildings use the existing 3:2 sprites, fitted to the zone width and grounded on the footprint's lower edge. This is a placeholder until the layered art arrives.
- Spurs are drawn only for built or surveyed zones. They are routable for every placed zone, because recruits still walk to an unbuilt Barracks site, as before.

## Save v2 (`js/save.js`)

```text
{ schema: 2, worldId: 'first_base_v1', migratedFrom?: 'armybase_save_v1',
  cash, food, lumber, steel, gems, gameClockMs, lastTick, missionLog[],
  buildings: { <buildingId>: { level, zoneId } },   // all 9 singletons
  units: [ { id, name, x, y, colorSeed, soldierVariant, civilianVariant, outfit, level, xp, xpToNext,
             maxHp, hp, strength, accuracy, endurance, maxEnergy, energy, hygiene, morale,
             assignedBuildingId, equipment, status, hospitalUntil, missionReturnAt, missionTierId } ] }
```

Storage keys:

- `armybase_save_v2` is the current save.
- `armybase_save_recovery` holds the last text that loaded successfully.
- `armybase_save_v1` is legacy. It is read-only and never written or removed.
- `armybase_save_unreadable` parks corrupt text so an autosave can't overwrite it.

Load order is v2, then recovery, then v1. A migrated load writes v2 immediately. Any v2 save found wins over v1, so the migration runs once.

v1 → v2 migration:

- Resources, clock, `lastTick`, the mission log and every unit field are copied unchanged. That includes ids, names, stats, equipment, assignment, status and real-time deadlines.
- Levels come from the old `*Level` fields. Entrance Hall is always 1. Zones come from `defaultPlacements`.
- Unit x/y are reprojected in this order:
  1. `hospital` goes to `aid_station`.
  2. `on_mission` and `recruiting` go to `gate_inside`.
  3. A unit within 45 px of an old building door goes to that building's new zone entrance.
  4. Anything else is scaled from 960 × 576 to world size, then snapped to the nearest trunk node.
- Route targets were never saved, so there is nothing stale to discard. Routes are rebuilt by `routeForStatus` on load.

Validation and import:

- `validateSaveData()` returns player-readable problems: bad numbers, unknown building, illegal or shared zone, bad unit ids, bad status, a mission with no return time, or hospital with no recovery time.
- `parseSaveText()` accepts v1 or v2 backups and migrates v1. On failure it throws `SaveFormatError` with the message shown to the player.
- Import writes through `writeRestoredSave()`, which keeps the previous v2 save as the recovery copy.
- Saved names are allowed up to 40 characters. The old import check (18) rejected real generated names such as "Elizabeth Andersson" (19).

## Not done here (by design)

- Construction is instant. There is no construction timer, so there is no mid-construction state to save yet.
- There is no build-zone selection UI (brief 03). Slot occupancy and typed activities come in brief 02.
- No balance changes and no new art.
