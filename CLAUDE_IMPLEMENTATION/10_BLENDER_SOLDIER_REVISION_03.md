# Soldier study 03 — geometry repairs and outline comparison

Codex inspected revision 2's turnaround and detail crops. Retain the natural upright body and improved arms. Revision 2 is not approved. This pass targets remaining kit defects and tests a contour treatment; it does not add animation or game art.

## Changes in build_soldier_study.py

- Harness becomes a thin, closed flat ribbon following sampled tunic surfaces, running over each shoulder and down the back. No hollow front tube ends. Other remaining curve pieces now have filled end caps.
- Belt follows the tunic's taper, about 6 mm beyond the sampled waist radii instead of a broad constant hoop. Inspect actual remeshed fit locally.
- Sole becomes a shaped, approximately 26 mm-thick elliptical surface following the upper, replacing the thick rectangular slab. Inspect the toe/heel silhouette; this remains a simplified boot, not a finished boot sculpt.
- Buried lace curves removed; no stray marks at the trouser hem.
- Nose reduced. Cheek-cutting chin strap omitted at this scale.
- Optional `--outline` enables dark olive Freestyle silhouette/contour strokes; crease/material-edge lines are disabled to avoid wireframe clutter. Thickness is 12 source-render pixels, approximately 0.4 pixels after downsampling the standing figure to 44 px. This is an experiment, not an approved final style.

No camera-direction, game-layout, game-speed or asset-manifest changes. Standard study projection remains uncalibrated for production. Python syntax checks pass; Codex cannot execute Blender here. Verify Freestyle API/render support on the local installation, and report any corrected incompatibility without silently dropping the experiment.

## Claude: run and return evidence

Pull main preserving local changes. Use new output folders; keep old reviews and hand-edited .blend files intact.

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python tools/blender/build_soldier_study.py -- --output art/local-blender/soldier-study-04 --samples 32
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python tools/blender/build_soldier_study.py -- --output art/local-blender/soldier-study-04-outline --samples 32 --outline
```

Compose review sheets using the existing compose tool, with outputs in separate directories such as `art/review/blender-soldier-03` and `art/review/blender-soldier-03-outline`. Captions must state whether outlines were enabled. Compare identical lighting/geometry; only the outline flag should differ. Check actual transparent PNGs: alpha should remain clear outside the silhouette including the outline, not become an opaque black background.

Push turnaround, detail crops and paired 44-pixel comparisons, plus `CLAUDE_IMPLEMENTATION/10_BLENDER_SOLDIER_REVIEW_03.md` with Blender version, execution status, measurements and visible shortcomings. Inspect shoulders for floating ribbon segments, belt from the back, sole thickness/toe outline and whether contour lines merge limbs or overwhelm the face at game size.

If Freestyle is too slow or unavailable, return the plain geometry review and the precise failure first; do not add a different shading system without documenting it. No further soft-lighting comparison is needed.

We judge this at actual game size and close-up. A dark contour may improve readability, but does not automatically create a painted finish. Once Jason accepts the look, move to animation topology, rigging and a convincing first walk. Do not promote any study to the game yet.
