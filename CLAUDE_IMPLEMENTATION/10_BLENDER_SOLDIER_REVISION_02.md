# Soldier study 02 — response to Claude's review

Codex inspected study 01's turnaround, face close-up and 44-pixel comparison on 1 October. Study 01 is not approved. Keep the upright, natural body proportions; correct the model before rigging.

## Recommended answers to the four design questions

1. Keep the natural upright proportions. Avoid toy heads and padded shoulders. Slim and lengthen the arms rather than enlarging the head.
2. Keep a simple helmet, harness, belt and small belt pouches. Thin cloth pockets should follow the legs. Remove details that form dark slits or destroy the silhouette at 44 px.
3. Use restrained, human facial features suitable for a later painted portrait. No projecting white eyeballs. Portrait likeness is not approved by this geometry pass.
4. Aim for a warmer, more contrasted, illustrated appearance consistent with the painted master. First compare revised geometry under stronger light. A final outline/painted shading treatment remains a later visual experiment, not something this revision claims to deliver.

These are Codex's recommendations based on Jason's rejection of cheap cartoon shapes. Jason should judge the next rendered result, rather than approve abstract technical choices.

## Script changes

`tools/blender/build_soldier_study.py` now generates revision 2:

- Narrower shoulders; sleeves closer to the torso, slimmer and longer. Hands reach approximately z 0.74 instead of 0.87.
- Rounded cloth cuffs, shaped mitten-like palms and small thumbs.
- Thin thigh pockets instead of projecting holsters.
- A continuous helmet lip instead of a front box visor.
- Belt expanded outside the tunic, smaller belt pouches and better surface-following harness positions.
- Shaped boot uppers and longer soles to contain the toes.
- Restrained dark eyes with smaller projection; no detached white eyeballs.
- Broken centre seam removed.
- Less ambient/fill light and a smaller warm key for stronger form contrast. `--soft-lighting` retains study-01 light settings for a controlled comparison.

Claude's corrected -90-degree right camera is retained. Existing character source files, game asset list, cache and walking gate are untouched. The script is Python syntax-checked here; revision 2 has NOT been executed in Blender by Codex.

## Claude's next run

Pull main, preserve all local edits, then run the same Blender executable/command from the first handoff with a NEW directory:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python tools/blender/build_soldier_study.py -- --output art/local-blender/soldier-study-03 --samples 32
```

Compose the review using your existing tool:

```sh
node tools/blender/compose-soldier-review.cjs art/local-blender/soldier-study-03 art/review/blender-soldier-02
```

Optional comparison: run into another new directory with `--soft-lighting`, keeping all geometry identical. Do not overwrite hand-edited .blend files or the first review.

Inspect the silhouette and close-ups for remaining intersections, floating kit, eye placement and strange boot forms. Check belt visibility from the back, natural fingertip height and both side silhouettes. Capture the same 44-pixel comparison. Push the review images and a report with actual observations; fix execution errors first, but do not quietly claim this pass is approved.

Do not start rigging or put these renders in the game yet. Once Jason accepts the appearance, we address animation topology and the first convincing walk, then projection calibration and actual in-game contacts.
