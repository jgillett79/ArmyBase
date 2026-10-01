# Command Base implementation briefs for Claude

**Current handoff, 1 October 2026:** start [09_DAILY_BASE_SIMULATION.md](09_DAILY_BASE_SIMULATION.md), follow [09_DAILY_BASE_BUILD_PLAN.md](09_DAILY_BASE_BUILD_PLAN.md), and publish the station visual contract before new interaction exports. The daily-routine target supersedes conflicting historical first-session/schedule rules below. Main contains brief 08; this next work happens on `brief-09-daily-base`, with user-authorised merge after review. Artwork inventory: [DAILY_BASE_ACTION_ASSETS.md](../art/DAILY_BASE_ACTION_ASSETS.md).

**Current handoff, 27 September 2026:** briefs 01–04 are already implemented on `main`. Their original branch/PR instructions below are historical. Start new work from [`FIRST_BASE_DELIVERY_PLAN.md`](../FIRST_BASE_DELIVERY_PLAN.md) and [`art/FIRST_BASE_ASSET_LIST.md`](../art/FIRST_BASE_ASSET_LIST.md), then read [`05_VISIBLE_FACILITY_ACTIONS.md`](05_VISIBLE_FACILITY_ACTIONS.md) for real facility use. Gate 0 is done: [`06_GATE0_VISUAL_CONTRACT.md`](06_GATE0_VISUAL_CONTRACT.md) holds the measured camera, scale, bridge, checkpoint and station numbers every new export must match (regenerate with `node tools/capture-gate0.cjs`). The first art round against it is reviewed in [`07_GATE_ART_REVIEW.md`](07_GATE_ART_REVIEW.md). Pull latest `main` before integrating new art. Codex is preparing art while Claude owns runtime code and `js/asset-manifest.js`.

Read `DESIGN.md` (especially **Target: a terrain-shaped, inhabited base**), `GOLDEN_SLICE.md`, `js/state.js`, `js/render.js`, `js/unit.js`, `js/main.js`, and the current smoke tests before coding. Look at `art/concepts/` for visual intent. The concept images are not finished game sprites.

Work **in order**, one PR per brief against `command-base-beta-import` (or a successor integration branch). The briefs depend on the previous one. Do not run them as competing whole-project rewrites. Make focused commits, list files changed and commands run, and include a screenshot/short screen recording when the change affects the canvas. Do not push directly to `main`.

1. [`01_WORLD_AND_SAVE.md`](01_WORLD_AND_SAVE.md): authored irregular zones, path graph, migration.
2. [`02_UNIT_ACTIVITY.md`](02_UNIT_ACTIVITY.md): routing to interaction slots and simulation alignment.
3. [`03_RENDER_AND_BUILD.md`](03_RENDER_AND_BUILD.md): camera, layered renderer, construction controls and visual capture.
4. [`04_ASSET_INTEGRATION.md`](04_ASSET_INTEGRATION.md): clean and integrate art, sprite metadata and animation playback.

The work is complete only when a fresh save and a migrated v1 save both run, the recruit-to-range loop works, and the rendered scene looks convincing at 960 × 576 and on a portrait phone. If a brief exposes a conflict with existing code, explain it in the PR and keep the save format backwards compatible instead of silently dropping progress.
