# Command Base implementation briefs for Claude

Read `DESIGN.md` (especially **Target: a terrain-shaped, inhabited base**), `GOLDEN_SLICE.md`, `js/state.js`, `js/render.js`, `js/unit.js`, `js/main.js`, and the current smoke tests before coding. Look at `art/concepts/` for visual intent. The concept images are not finished game sprites.

Work **in order**, one PR per brief against `command-base-beta-import` (or a successor integration branch). The briefs depend on the previous one. Do not run them as competing whole-project rewrites. Make focused commits, list files changed and commands run, and include a screenshot/short screen recording when the change affects the canvas. Do not push directly to `main`.

1. [`01_WORLD_AND_SAVE.md`](01_WORLD_AND_SAVE.md): authored irregular zones, path graph, migration.
2. [`02_UNIT_ACTIVITY.md`](02_UNIT_ACTIVITY.md): routing to interaction slots and simulation alignment.
3. [`03_RENDER_AND_BUILD.md`](03_RENDER_AND_BUILD.md): camera, layered renderer, construction controls and visual capture.
4. [`04_ASSET_INTEGRATION.md`](04_ASSET_INTEGRATION.md): clean and integrate art, sprite metadata and animation playback.

The work is complete only when a fresh save and a migrated v1 save both run, the recruit-to-range loop works, and the rendered scene looks convincing at 960 × 576 and on a portrait phone. If a brief exposes a conflict with existing code, explain it in the PR and keep the save format backwards compatible instead of silently dropping progress.
