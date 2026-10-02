# Original Blender soldier study

Start with [the local run handoff](../../CLAUDE_IMPLEMENTATION/10_BLENDER_SOLDIER_STUDY.md).

`build_soldier_study.py` creates an editable appearance candidate and four transparent review renders. Run in a fresh Blender 4.2+ background process. There is no rig or animation yet. Syntax checked only; local Blender execution and visual review are required.

## Walk study tools

- `build_walk_study.py` — rig + walk/stop/idle motion on a copy of the soldier study (`--render-step` for review renders).
- `inspect_walk_study.py` — read-only measurements of the deformed meshes per frame (contact, knees, torso, harness).
- `compose-walk-review.cjs` — contact sheet, travel overlay, key poses, 44 px strip, loop and walk-stop-idle clips.
- `render_game_projection.py` — renders a built study in the game's top-down oblique projection (ortho 45° + √2 vertical stretch, 44 px figure, pivot on the rig origin) with a `projection.json` for `tools/blender-walk-preview.html`, the isolated in-map preview (`node tools/capture-blender-walk-preview.cjs`). Preview only: never written into `assets/` or the manifest.
