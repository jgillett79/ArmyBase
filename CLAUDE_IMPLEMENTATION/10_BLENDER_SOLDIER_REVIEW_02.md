# Blender soldier study, revision 2 — local run and review

Claude, 1 October 2026, on `main` after aa48c03. Answers [10_BLENDER_SOLDIER_REVISION_02.md](10_BLENDER_SOLDIER_REVISION_02.md); the first review is [10_BLENDER_SOLDIER_REVIEW.md](10_BLENDER_SOLDIER_REVIEW.md). **Not approved, not rigged, not in the game**: no asset-manifest or cache entries, walk release gate untouched. `.blend` files stay local in `art/local-blender/` (gitignored).

## Run

- Blender **5.2.2 LTS**, Cycles CPU, 32 samples: `--output art/local-blender/soldier-study-03` (contrast lighting, the new default) and `--output art/local-blender/soldier-study-03-soft --soft-lighting` (identical geometry, study-01 light). Both exit 0, about 1.5 min each; only the same two `use_nodes` deprecation warnings (Blender 6).
- No execution fixes were needed. The −90° right camera is in place: `right.png` faces screen-right with the right side to the camera.

## Evidence (`art/review/blender-soldier-02/`)

Same set as round 1, from `node tools/blender/compose-soldier-review.cjs art/local-blender/soldier-study-03 art/review/blender-soldier-02` (the tool's caption now reads the revision and lighting from `study-report.json`):

| File | What |
|---|---|
| `front.png`, `right.png`, `back.png`, `three_quarter.png`, `study-report.json` | The four renders (revision 2, contrast lighting) |
| `turnaround.png`, `three-quarter.png`, `face-closeup.png`, `silhouettes.png` | Review sheets |
| `game-size-44px.png` (+ `-1x`) | Front and three-quarter at a 44 px figure next to the live soldier and the painted down master, 4× without smoothing. Appearance comparison only (standard 35° ortho camera, not the game projection) |
| `game-size-44px-soft-lighting.png` | The same comparison from the `--soft-lighting` run |
| `detail-crops.png` | Close crops: right-side shoulder/harness, belt from the back, boots from the side, and the three-quarter view under contrast vs soft lighting |

## Measured against round 1 (metres, from the `.blend`)

| | Study 01 | Revision 2 |
|---|---|---|
| Fingertips | z 0.87 (crotch) | **z 0.74** (mid-thigh) |
| Outer width at the arms | 0.79 | **0.64** |
| Cuffs | 0.12 × 0.135 box flanges | rounded rings (0.10 × 0.11 wide), no flange in the silhouette |
| Belt vs tunic | inside (0.179/0.127 < 0.19/0.13) | **outside** (0.196/0.138) |
| Eye front vs face | 13 mm proud | **flush** (−0.085 vs −0.086) |
| Boot toe vs sole front | toe 22 mm past the sole | **sole 12 mm past the toe** |
| Thigh pockets | 0.03 proud, box | inside the trouser outline (x 0.175–0.193 vs leg 0.196): a faint panel |

Height 1.889, 7.6 heads, pelvis over feet, straight knees — unchanged.

## What is now good

- **Silhouette:** natural and upright. The arms are slim, close to the body and reach mid-thigh; no padded shoulders, no box flanges, no holsters. The front and back silhouettes read as a person, not a mannequin.
- **Helmet:** the continuous lip reads as a steel helmet, not a cap.
- **Face:** small dark eyes set into the face, restrained mouth; it no longer looks googly.
- **Hands:** mitten with a thumb reads correctly at this scale.
- **Belt:** visible all round, including the back.

## Remaining problems (exact)

1. **Harness straps float and are hollow.** The two straps are open-ended curve tubes. Their top ends stand off the chest in front of the collar (side view: a hollow tube end about 0.03 m in front of the chest at shoulder height), and in the three-quarter view the open circular ends are visible at the top. Suggest running the straps over the shoulders into the back, or capping the ends and pressing them onto the chest surface.
2. **The belt is a hoop.** From the back it stands about 2 cm proud of the tunic/trousers with a dark shadow gap under it (radii 0.196/0.138 against a waist of about 0.17–0.19/0.115–0.13). Bring it to 5–10 mm proud and let it follow the waist shape.
3. **Boots are still clogs.** A smooth rounded upper sits on a separate flat sole slab 0.054 m thick and 0.32 m long that steps out all round; in the three-quarter view the soles read as boards or flip-flops. Suggest a sole about 0.025–0.03 m thick that follows the upper's outline, with a slight heel step.
4. **Boot laces are buried.** The lace curves are at y −0.054 to −0.060 inside the boot's ankle front (−0.062), so only a stray speck shows at the trouser hem. Move them onto the boot surface or remove them.
5. **The chin strap cuts across the cheek.** It reads as a dark crease from the helmet to the chin in the side and three-quarter views. Route it just outside the cheek or drop it at this scale.
6. **The nose is large** (0.032 × 0.048 m, standing 0.036 m proud) for an otherwise restrained face.
7. **Thigh pockets are nearly invisible** now (inside the trouser outline). That's fine at 44 px; if they should read, set them 5 mm proud.

## Lighting and style at game size

- Contrast vs soft lighting: the contrast version is slightly darker with more modelling; at 44 px the two are hard to tell apart (`game-size-44px.png` vs `-soft-lighting.png`).
- Next to the painted master the study is still **paler and lower-contrast**, with no outline, so it reads less strongly on the grass. Proportions are now in the same family; the remaining gap is **shading/value and outline**, not shape. As the revision note says, an outline/painted shading treatment is a separate experiment.

## Verdict

**Better, not ready to approve.** Silhouette, arms, helmet, eyes and hands are fixed. Before Jason judges style, fix points 1–4 (floating hollow straps, hoop belt, clog boots, buried laces); 5–7 are small. Then try one outline/warmer-shading experiment against the 44 px comparison. No rigging or integration until Jason accepts the appearance.
