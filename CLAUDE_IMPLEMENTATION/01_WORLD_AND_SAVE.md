# Claude brief 01 — terrain-shaped world, placement and save migration

You are implementing the Command Base world foundation in `jgillett79/ArmyBase`. Start from the current integration branch and read `DESIGN.md`, `GOLDEN_SLICE.md`, `js/state.js`, `js/building.js`, `js/unit.js`, `js/render.js`, and tests. The current 20 × 12 grid and `roadYAt()` are a temporary rendering layout, not the target world model. Keep the game playable while introducing the new model.

## Deliverable

Implement one authored first-base map larger than the current viewport. Define terrain exclusion polygons (water, cliff, dense rock), walkable paths as a small graph, the gate and safe fallback nodes, and irregular build zones with stable IDs, polygon footprints, legal building types, entrances, activity slots and supported art orientations. Set placements by explicit coordinates from a reviewed layout, not random generation or uniform rows. Create a clear data/validation API that rendering and simulation can share. Fit the scene to the spirit of `art/concepts/terrain-shaped-base.webp`, but do not use that flat concept painting as the game background.

Retain existing building IDs/types, costs, capacity, missions, unit stats and timers. Replace direct dependence on shared `BUILDING_FOOTPRINT_CELLS` and `gridX/gridY` with per-zone placement metadata. Provide one working shortest-path route between graph nodes, and validate reachability from the gate to every legal zone. It is acceptable to constrain construction to authored zones for this release; arbitrary freeform building placement is out of scope. Existing paths should expose a connector for a constructed facility and leave future plots unobtrusive.

Add a versioned save schema and a one-time migration from `armybase_save_v1`. Preserve cash, food, materials, soldier IDs/names/stats/equipment, building levels, mission data and real-time timestamps. Map each old building singleton to an authored zone. Reproject saved unit coordinates to a safe node/entrance; discard stale route coordinates only. Keep backup export/import compatible with migrated data, with a useful error for a malformed backup. Never erase the original localStorage value before the new save succeeds; maintain a recovery copy.

## Proof

- Test all zones for non-overlap, no terrain exclusion collision, entrance reachability and route continuity.
- Load a representative v1 save with active mission, hospitalized unit and partially built base. Compare resources, identities, assignments and deadlines before/after migration; reload twice to show idempotence.
- Run current game/UI smoke tests, then render a diagnostic map with zone polygons, entrances, path graph and no unreachable node. Include a before/after screenshot.

Do not change game balance or commission new art in this brief. End with a PR and an exact manifest of data structures and migration behavior for the next brief.
