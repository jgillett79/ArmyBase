# Claude brief 04 — production art pipeline and animation playback

Start from merged briefs 01–03. Read `DESIGN.md`, all art metadata, and inspect `art/concepts/` at game size. These candidates are generated studies, not automatically approved production sprites. Keep their source files and work non-destructively.

## Deliverable

Define a manifest for each asset: file/version, alpha bounds, pixels per world unit, draw pivot/ground contact, entrance, activity slots, rear/foreground occlusion layers, light/shadow convention and supported camera orientation. Build a validation utility that checks files exist, alpha is genuine, frames have consistent size/baseline and pivots fall within bounds. Export optimized transparent WebP/PNG copies under `assets/` only after inspection at actual gameplay scale. If a candidate cannot be cleanly separated into correct layers (the gate arm in particular), mark it for regeneration; do not fake a moveable barrier by stretching the whole gate picture.

Implement frame-based playback by unit identity, direction, locomotion state and activity. The starter character needs six distinct full-body walk frames for each travel direction, idle frames and four coherent range poses. The `soldier-firing-poses-study.webp` can inform the activity but must be cleaned, split into precise equal frame boxes and reviewed for consistency first. Mirror left only if insignia/equipment are symmetrical. Keep unit appearance stable on transition between animations. Soldier tinting must not turn uniforms into implausible colors.

Coordinate with artwork production on one golden-slice kit: gate layers with a separately animated arm, Entrance Hall, Barracks, range back/foreground layers, terrain transition pieces, 10–15 useful props, civilian and soldier animation sets, and activity feedback. Use the approved scene palette; no rasterized text inside assets. Update the service-worker asset list and cache version (or the existing Pages build versioning) for each production asset change.

## Proof

- Validate manifest and all sprite sheets in CI or a one-command local check. Render contact sheets with transparency checkerboard and in-game scale.
- Record continuous side/up/down walk, gate admission, two simultaneous range activities and transitions to idle. There should be visible foot planting, no body/gear morphing, no clipping through the foreground and no frame-induced jitter.
- Compare a new/expanded base screenshot with `art/concepts/terrain-shaped-base.webp` for coherent camera, value range and silhouette readability, not pixel-for-pixel reproduction.

Do not claim release quality from a single attractive concept image; the goal is a modular, navigable, animated scene.
