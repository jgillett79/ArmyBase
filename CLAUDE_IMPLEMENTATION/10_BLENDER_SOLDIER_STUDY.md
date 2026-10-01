# Blender soldier: appearance study handoff

Jason rejected the primitive Canvas cartoon and its crouching gait. He wants a polished stylised soldier, natural posture and convincing animation, with no purchased assets. This is the first original Blender modelling pass, not release art.

## Files and current verification

Run `tools/blender/build_soldier_study.py` in Blender 4.2 or newer. Python syntax has been checked by Codex. **Blender is unavailable in Codex's current workspace: no model or render has been executed or visually approved.** Claude must run and inspect the outputs locally, fix execution issues and report the actual Blender version. Do not describe this script as a finished character or animation.

The script builds continuous voxel-remeshed garment surfaces, a shaped head and helmet, restrained facial features, boots, webbing and separately editable accent materials. Arms hang naturally; knees are not deliberately crouched. Everything is original scripted geometry. No downloads, paid assets, add-ons or account setup are required. A rifle is intentionally deferred until silhouette approval; later it belongs on the anatomical left shoulder.

## Run locally

Work from the ArmyBase checkout. Preserve unrelated edits, then pull main. Locate Blender's executable; use its actual installed version rather than guessing a Windows version folder. Use a NEW output directory for every run. The script refuses non-empty directories, preserving hand-edited models.

Windows PowerShell (substitute the installed executable path):

```powershell
$blenderExe = 'C:\Program Files\Blender Foundation\Blender <installed-version>\blender.exe'
& $blenderExe --background --factory-startup --python-exit-code 1 --python tools/blender/build_soldier_study.py -- --output art/local-blender/soldier-study-01 --samples 32
```

macOS:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/blender/build_soldier_study.py -- --output art/local-blender/soldier-study-01 --samples 32
```

Linux / Blender on PATH:

```sh
blender --background --factory-startup --python-exit-code 1 --python tools/blender/build_soldier_study.py -- --output art/local-blender/soldier-study-01 --samples 32
```

CPU rendering is selected for portability. Allow rendering to finish. For a quick scene-build check use a different directory and append `--no-render`. If rendering is slow, use `--samples 16` in another directory. Do not run the script inside an existing artist-edited .blend: it intentionally creates a fresh scene.

Outputs:

- `soldier_study.blend`: editable model, materials, camera and lights; opens at the three-quarter view.
- `front.png`, `right.png`, `back.png`, `three_quarter.png`: transparent 1024 × 1536 appearance renders.
- `study-report.json`: settings, Blender version and candid status.

Keep local .blend files and their backups out of the public repository. Commit the four review PNGs and report to `art/review/blender-soldier-01/` after checking them; no runtime manifest or offline cache entries. Write the review to `CLAUDE_IMPLEMENTATION/10_BLENDER_SOLDIER_REVIEW.md` and push it so Codex can read the actual evidence.

## What to inspect and show Jason

1. Whole figure, face close-up and silhouette in each view. Check intersecting surfaces, helmet fit, fingers/hand silhouette and collar. Fix render/API failures before reporting success.
2. Natural upright stance: pelvis over feet, relaxed arms, no permanent squat, no huge toy head, no visible detached ball joints.
3. Show a three-quarter render over a neutral backdrop, plus a 44-pixel-high comparison to the current game. The 44-pixel view is an appearance comparison only, not a calibrated runtime sprite.
4. Ask Jason to judge the silhouette, uniform detail, face and overall style. Do not proceed to a complete action set until that direction is accepted.

## Important projection and topology limits

The appearance study uses a conventional orthographic camera at 35 degrees elevation. **It does not yet match the game's equal ground-axis oblique projection.** A standard 3D camera foreshortens ground depth. Before production export, Codex and Claude must agree a calibrated projection using the game contract and station contact tests. Do not quietly change the game camera, positions or walking speed to accommodate these study renders.

Garments are voxel-remeshed for continuous appearance; their topology is **not yet animation-ready**. Inspect/retopologise as needed before skinning. There is no skeleton, gait or weight painting in this pass. The script is an editable modelling starting point; it does not guarantee polished art without visual refinement.

## Next gate after appearance approval

Codex prepares the skeleton and first walk; Claude executes Blender locally and returns rendered evidence. Start with one direction, natural upright gait, straight support leg, flexed passing knee, pelvis weight shift and opposite arm swing. Then render all directions from one character and make idle/start/stop/turn transitions. Use sufficient frames for smooth playback, measured stride and metadata; do not lock the new workflow to the former six-frame limit.

Existing source contract remains 256 × 384 cells, pivot (128,330), standing helmet near row 30, density 300/44 source pixels per world pixel. Treat these as integration constraints to validate, not automatic properties of the appearance renders. Renderer supplies contact shadows. No baked water, effects, text or ground shadows in sprite exports. Keep opaque interiors, alpha antialiasing only on silhouette edges, and a separate accent mask.

Claude owns integration with path travel, schedules, occupancy, queues and station contacts. All old painted candidates and the walk release gate remain unapproved. Test one real soldier walking, turning, stopping and using one station before expanding.
