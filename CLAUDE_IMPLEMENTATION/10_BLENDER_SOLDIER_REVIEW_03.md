# Blender soldier study, revision 3 — plain vs outlined, local run and review

Claude, 1 October 2026, on `main` after 3dba3bc. Answers [10_BLENDER_SOLDIER_REVISION_03.md](10_BLENDER_SOLDIER_REVISION_03.md); earlier reviews: [01](10_BLENDER_SOLDIER_REVIEW.md), [02](10_BLENDER_SOLDIER_REVIEW_02.md). **Not approved, not rigged, not in the game**: no asset-manifest or cache entries; walk release gate untouched. `.blend` files stay in the gitignored `art/local-blender/`.

## Run

- Blender **5.2.2 LTS**, Cycles CPU, 32 samples, contrast lighting, identical geometry; only `--outline` differs.
- Plain: `--output art/local-blender/soldier-study-04` → exit 0, about 2 min (about 25 s per view).
- Outlined: `--output art/local-blender/soldier-study-04-outline --outline` → **first attempt failed** (exit 1):
  `AttributeError: 'NoneType' object has no attribute 'color'` at `line_set.linestyle.color`. In Blender 5.2 a line set created in a factory-startup scene has no line style (`linestyle` is `None`). **Fixed** in `tools/blender/build_soldier_study.py`: if the line set has no line style, create one (`bpy.data.linestyles.new('Soldier contour style')`) before setting colour and thickness. The empty output folder left by the failed run was removed. Re-run: exit 0, about 3 min (about 45 s per view; Freestyle nearly doubles render time).
- Only the two known `use_nodes` deprecation warnings (Blender 6).
- **Transparency checked** on all eight PNGs: corners alpha 0; 81–90% of pixels fully clear; partial alpha only on the silhouette edge (0.3–0.55%). The outline adds 6 px on each side of the figure (bounding box +12 px) and does not create an opaque background.

## Evidence

| Folder | Contents |
|---|---|
| `art/review/blender-soldier-03/` (plain) | 4 renders + `study-report.json`; `turnaround.png` (caption "outline off"), `three-quarter.png`, `face-closeup.png`, `silhouettes.png`; **`game-size-44px.png`: live soldier, painted master, plain front/3-4 and outlined front/3-4 side by side at 44 px**; `detail-crops-plain-vs-outline.png` |
| `art/review/blender-soldier-03-outline/` | The same set for the outlined run (caption "OUTLINE ON"); its 44 px sheet puts the outlined columns first |

Sheets: `node tools/blender/compose-soldier-review.cjs <study> <out> [otherStudy …]`. The tool now labels each 44 px column plain/outlined from the study report and accepts extra studies as extra columns. The detail-crop image was cut from the renders with a one-off local script (not committed: it uses a canvas library the repo doesn't depend on).

## Measured (plain `.blend`, metres)

| Item | Revision 2 | Revision 3 |
|---|---|---|
| Harness | hollow tubes ending in front of the collar | flat ribbons x ±0.108–0.132, from the belt (z 1.095) over the shoulders (z 1.505) and down the back (y to +0.112) |
| Belt | 0.196/0.138, constant | 0.189/0.130, z 1.085–1.108 |
| Sole | 0.054 thick slab, 0.32 long | **0.026 thick** (z 0.003–0.029), same outline as the upper (front y −0.212 on both) |
| Laces / chin strap | buried laces; strap creasing the cheek | removed |
| Nose | 0.032 × 0.048, 0.036 proud | 0.026 × 0.032 |
| Height | 1.889 | 1.886 (7.5 heads) |

## Geometry: what's fixed and what isn't

Fixed: no hollow tube ends; the harness reads as webbing over the shoulders and down the back; no stray lace marks; the chin-strap crease is gone; the nose is restrained; soles follow the boot shape, no more boards. Arms, helmet and silhouette stay as good as revision 2.

Remaining (see `detail-crops-plain-vs-outline.png`):

1. **Harness ribbons float off the flanks.** In the side view each ribbon stands off the tunic with a thin dark gap along both sides of the chest. The ribbon points are sampled from the tunic before the voxel remesh and relax smoothing, which pull the surface inward by a few mm. Sample after the remesh/smooth (or shrinkwrap the ribbon onto the final surface).
2. **Boot upper floats above the sole.** The sole top is at z 0.029, but the upper's lowest point is z 0.045 (the ankle loft starts at 0.055): a **16 mm gap**. It shows as a dark seam in the plain render and as an extra internal contour line in the outlined one. Lower the upper to sit on the sole (or raise the sole to 0.045).
3. **Belt still a raised band** at the back and sides: smaller than revision 2 but with a visible shadow gap where it bridges the waist. Fine at 44 px; noticeable in close-ups.

## Outline experiment

- **Close up, the outline hurts more than it helps.** At 12 render px the Freestyle contour turns the eyes into dark goggle shapes, outlines the nose and gives the mouth a heavy black moustache shape; the face loses its restraint. It doubles and fragments along the harness ribbons (each ribbon edge and the gap behind it get strokes), outlines every pocket and pouch, and leaves small stray marks on the chest where tiny contours appear. Limbs do not merge; the body silhouette outline itself is clean.
- **At 44 px it barely changes anything.** The 12 px stroke becomes about 0.5 px: a slightly darker edge, a little more separation from the grass. The faces become darker smudges. Next to the painted master both versions still read **pale and low-contrast**: the master's strength comes from saturated, darker local colours, strong light/dark shapes and a crisp pixel outline at game resolution, not from a thin contour on a high-resolution render.

## Verdict and recommendation

**Not ready to approve.** Geometry is close: fix the floating ribbons and the sole gap (points 1–2), then this is a reasonable base body. **Don't adopt the Freestyle outline as tested.** If an outline is wanted, apply it at game resolution after downsampling (a 1 px dark silhouette edge, as the painted art has) and silhouette-only, never on the face or kit. Value and colour are the bigger lever: darker, warmer, more saturated olive and boot browns, plus stronger key/shadow separation, to compete with the painted master on the grass. Let Jason judge `game-size-44px.png` and the detail crops; no rigging or integration until he accepts the look.
