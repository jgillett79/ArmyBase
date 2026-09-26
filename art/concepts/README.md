# New art direction studies — 26 September 2026

These are original generated studies informed by the player's three supplied examples: bold three-quarter graphics, terrain-shaped base layout, and visible facility activity. They are **not** finished, integrated game assets. The source examples are not copied into the repo. The current game continues using its existing `assets/` art until the world and layer contracts in `DESIGN.md` are implemented.

| File | Role | Production work still required |
| --- | --- | --- |
| `terrain-shaped-base.webp` | Composition/art bible reference for alpine map, irregular build sites and activity visibility. | Rebuild as modular terrain, path graph, buildings, props and units; never paste the painting under the existing canvas. |
| `gate-intake-study.webp` | Transparent gate kiosk reference. | Separate arm, kiosk, rear/foreground pieces and collision/entrance anchors; remove the long painted path from the sprite if it conflicts with dynamic road geometry. |
| `barracks-study.webp` | Transparent two-wing barracks with a visible porch and bunk space. | Split structure and foreground occluders; place bunk/porch activity anchors and confirm the building fits its irregular build site at game scale. |
| `mess-hall-study.webp` | Transparent open mess hall with tables and a service counter. | Separate rear wall, tables, counter and roof/foreground layers; author seated meal slots and a serving queue without blocking paths. |
| `range-interaction-study.webp` | Transparent range/backdrop reference with empty stations. | Split ground, rear/foreground and target parts; confirm two usable interaction slots and footprint clearance at game scale. |
| `soldier-firing-poses-study.webp` | Four full-body poses for one range activity. | Frame cleanup, exact equal boxes, registered ground-contact pivots, firing effect as separate layer, in-game-size quality check; additional idle and travel directions needed. |

Generated using the built-in image tool. Primary composite prompt: an original illustrated alpine foothill idle-game base with chunky readable three-quarter buildings, creek and rocky meadow shaping irregular build sites, winding traversable paths, gate admission, visible open-air range use and a meal activity; warm upper-left light, olive/teal/ochre palette, no UI/text/logos. The three player images were **reference images** for visual properties and layout principles, not edit targets.

Gate prompt: isolated original three-quarter security kiosk with open arch, separate-looking barrier and irregular rocky edge, transparent background. Barracks prompt: isolated original two-wing alpine military barracks with visible covered porch and bunks, transparent background. Mess hall prompt: isolated original open-sided mess hall with serving counter and empty tables, transparent background. Range prompt: isolated rocky shooting lane with two empty firing stations and target berm, transparent background. Activity prompt: one consistent soldier in four consecutive ready, aim, recoil and recover full-body poses, transparent background. See the acceptance and asset contracts in `DESIGN.md` and `CLAUDE_IMPLEMENTATION/04_ASSET_INTEGRATION.md` before promoting a study into `assets/`.

## Integration result (brief 04, 27 September 2026)

Processed through `tools/prepare-art.cjs` (sources here are never modified); review sheets in `art/review/`, statuses in `js/asset-manifest.js`, and what to redraw in `art/CHATGPT_FEEDBACK.md`.

| File | Status |
| --- | --- |
| `range-interaction-study.webp` | provisional — `assets/buildings/range-study-v1.webp`, 6 firing slots, targets and front occluders registered |
| `barracks-study.webp` | provisional — `assets/buildings/barracks-study-v1.webp`, bunk-wing slots |
| `mess-hall-study.webp` | provisional — `assets/buildings/mess-hall-study-v1.webp`, bench places |
| `soldier-firing-poses-study.webp` | candidate — clean 4-frame strip, but a different character from the in-game soldiers (`?art=candidates` to preview) |
| `gate-intake-study.webp` | needs regeneration — the barrier arm is painted in |
| `terrain-shaped-base.webp` | composition reference only |
