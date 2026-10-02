# First Blender walk: local execution and visual review

Use the plain revision-3 local .blend as input. No further appearance approval is implied. This study fixes strap contact and boot/sole contact, creates a deforming skeleton with provisional distance-based vertex weights, and keys two walking cycles, a short settle and idle. It is not a production rig. Do not integrate into the game or promote the walk gate.

Run on a COPY through a fresh background Blender process, with a new output directory:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background art/local-blender/soldier-study-04/soldier_study.blend --python-exit-code 1 --python tools/blender/build_walk_study.py -- --output art/local-blender/walk-study-01
```

Check the input path against your actual plain revision-3 folder. Source .blend is not overwritten. Script Python syntax is checked; Codex has not executed Blender. Fix actual API/pose errors locally and record them. The scene-only first run is fast; inspect timeline 1–72 in Blender before spending time rendering.

Outputs: editable soldier_walk_study.blend and motion-report.json. 24 fps; frames 1–48 are two walk cycles, 49–60 settle, 61–72 idle. Animated in place; virtual forward travel is 0.4 m/s. Straight stance contacts analytically cancel virtual travel during full walking only. Verify the ACTUAL deformed sole pixels, not merely the metadata.

If scene playback works, run into another new folder with `--render-step 3` for eight poses plus idle in each of right and three-quarter views. For smooth video use `--render-step 1` (24 poses per view) and repeat the loop. Compose videos at the real 24 fps: sparse every-third-frame exports must play at 8 fps, not 24. Render times may be substantial; avoid rendering a broken rig.

## Review before returning

- Boots meet soles and straps hug the actual smoothed chest. Inspect the repair rather than assuming it succeeded.
- Opposite anatomical legs lead half a cycle apart, with knee bend toward the soldier's front. No squat, inverted knee or locked hips.
- Check rest-to-pose deformation for stretching, collapsing crotch, sleeve pinching or detached accessories. Automatic weights are a starting point; correct them locally before claiming a usable walk.
- Foot sole remains horizontal during planted phases; no hovering or sliding in a virtual travelling comparison. No ground shadow baked into sprite frames.
- Compare side view, elevated three-quarter, close-up and 44-pixel height. Inspect the settle separately: provisional blend is not a guaranteed planted-foot stop.
- Return a loop clip, still contact sheet and report in art/review/blender-walk-01 and CLAUDE_IMPLEMENTATION/11_FIRST_BLENDER_WALK_REVIEW.md. Keep .blend files local. Report limitations candidly, and push source fixes if needed.

This is a movement test only. Production control hierarchy, manual weight refinement, contact-aware starts/stops, all directions, projection calibration and game playback integration remain later gates. Do not change game speed or manifests to accommodate this candidate.
