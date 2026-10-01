# Brief 09 — up/right direction guides checked against the runtime

Claude, 1 October 2026, on `brief-09-daily-base` after merging `main` 49ce6f3 (the art-preparation handoff). Answers [09_ART_PREPARATION_HANDOFF.md](09_ART_PREPARATION_HANDOFF.md): guides validated against the runtime, one correction made, character density clarified. **The guides stay review templates**: they are not in `js/asset-manifest.js`, the service worker or any runtime path (a test asserts this), and `walkReleaseGate()` is still blocked. No action set is marked complete.

## Method

- `node tools/check-direction-guides.cjs` replays each guide through the runtime's own rules: frame index `floor(walkDistance / 22 × 6) % 6` (js/animation.js), drawing density `(pivot row − headroom) / 44` (drawFramePose), straight travel along the facing axis (unit.js), and the accepted down master's measured track. It reports each planted sole's world position at every frame start, the drift while a frame is held, footprint spacing, which foot plants at frames 1 and 4, and anatomical identity across directions. Output: [guide-check.json](../docs/screenshots/2026-10-01-direction-guides/guide-check.json).
- `node tools/capture-direction-guides.cjs` draws the **foot overlays** and plays the guides in a running game page through the real `drawFramePose`. The guides are injected into that page's in-memory manifest only, and every frame is watermarked "DIRECTION GUIDES — review only".

| File (`docs/screenshots/2026-10-01-direction-guides/`) | What it shows |
|---|---|
| `foot-overlay-right.png`, `foot-overlay-up.png` | Six source cells with each recorded sole (filled = planted, ring = swinging) and the pivot; below, the frames laid out at their world offsets over two cycles: planted soles stack into evenly spaced footprints |
| `foot-overlay-down.png` | The accepted painted down master through the same overlay, for comparison |
| `guide-loop-contact.jpg` (+ `guide-loop-30s.webm`, local only) | 30 s at zoom 1: walk right, idle, up, idle, left (mirrored right), idle, down (painted master), idle |
| `guide-steps-1.6x-right.png`, `guide-steps-1.6x-up.png` | 12 consecutive frames at zoom 1.6, frame number and distance walked under each |

## Results

| Check | Right | Up | Down master |
|---|---|---|---|
| Planted sole between frame starts in one stance | 0.000 world px | 0.000 | 0.000 |
| Footprint spacing | 11, 11, 11 world px | 11, 11, 11 (northward) | 11, 11, 11 |
| Frames 1 / 4 plant | right / left | right / left | soldier's right / left |
| Cell, pivot, density, stride, frames | 256×384, (128,330), 6.818, 22, 6 — identical to the runtime | same | same |
| Drift while one frame is held (runtime) | 3.67 world px | 3.67 | 3.67 |

**The geometry matches the runtime.** The signed cancellation is exact in both new directions, as it is for the painted down master.

### Corrected: the up guide was mirrored

Turning keeps the frame index (walkDistance carries on), so frames 1–3 must plant the **same anatomical foot** in every direction. In the down master (a front view) frames 1–3 plant the soldier's right foot, which is on screen-left, and the rifle is slung on the soldier's **left** shoulder (screen-right). The right guide agrees: right leg near and planted in frames 1–3, rifle on the far (left) shoulder. The first up guide (a back view) planted screen-left (x 108), which is the soldier's **left** foot, and slung the rifle on screen-right, the **right** shoulder. Any turn into or out of "up" would have swapped the planted leg mid-stance and moved the rifle.

Fixed in `tools/render-direction-contact-guides.cjs`: in the up view the soldier's right leg is at screen x 148 and plants in frames 1–3, the left leg at x 108, and the rifle on screen-left. The up walk and up idle PNG/JSON were regenerated with the same generator; the right guides are byte-identical to before. The geometry checks are unchanged (still exact), and `check-direction-guides.cjs` now fails on the original version.

### Runtime property, not a guide fault: within-frame drift

The runtime draws the body at its continuous position while a frame is held. A planted sole therefore drifts forward 3.67 world px (25 source px, about 6 screen px at zoom 1.6), then snaps back at the next frame. This happens with any 6-frame cycle at this stride, including the accepted down master; it is visible in the 1.6× strips. Options for Jason, to decide when painted sets are being judged:

1. Accept it, as the current down candidate does.
2. **Lock the planted foot in rendering**: draw the sprite at the position where the current frame began. Feet stay exactly still and the body advances in 3.67 px steps. Presentation only; the simulation is unchanged.
3. Paint 12-frame cycles (halves the drift, doubles the painting).

I have not changed the runtime for this; it changes the feel of all walking.

### Notes for painting (consistency between views; not blockers)

- **Stance width.** The camera's ground axes are equal, so feet that are 40 source px apart side to side in the up view (x 108/148, 5.9 world px) should also be about 40 px apart in depth in the right view. The right guide has them 16 px apart (near sole row 338, far 322). Paint the right view's near/far soles about 20 px either side of row 330, or narrow the up view; just keep them equal.
- **Lift at passing.** Swing-foot height above the planted sole at the passing frame: down master 82 source px, up guide 91, right guide 60. Use one height (about 80) in every view.
- **Toe-off.** At the frame where a foot stops being planted, the right guide keeps it moving backward (still cancelling body travel); the up guide leaves it where it was (it travels with the body). Either reads fine; pick one.
- **Left = mirrored right** moves the rifle to the right shoulder when facing left. The manifest already says left may mirror right only after a kit review. If Jason wants the rifle on the same shoulder in every direction, a left set must be painted.

## Character density (answer to "clarify source vs export")

The station contract's sentence "export at 3 art px per world px; character cells stay 256 × 384 with the pivot at (128, 330)" mixed two different densities. It now reads:

- **Paint (source) density for characters: 6.818 source px per world px.** Cells are 256 × 384, ground pivot (128, 330), helmet top near row 30, so the standing figure is 300 source px = 44 world px. Every walk, idle and standing-activity frame stays at this density; never rescale individual frames. This is what Codex delivers, with accent masks on identical canvases.
- **Non-standing cells** (lying in bed, sitting, climbing) use the **same 6.818 density** on a wider canvas with an explicit body pivot shared by all frames, and must declare `sourcePxPerWorld: 300/44`. The runtime now reads that field (`frameSourcePxPerWorld` in js/animation.js; tested): without it, density is derived from the standing figure (pivot row − headroom), which would mis-scale a lying body. A world offset converts to source px as `source = pivot + world × 300/44`; for example the 46 × 18 world bed is 314 × 123 source px.
- **Runtime export is Claude's job.** `tools/prepare-art.cjs` resamples the source strip to `output.frameHeight`, and the runtime draws any export at the density it declares, so a soldier is always 44 world px tall. The down candidate is exported at 144 px frames = **2.56 px per world px**. The fixed-density equivalent of 3 px/world is **169 px frames** (scale 0.44: figure 132 px, pivot (56.3, 145.2)), which is what promoted sets will use. Codex should **not** send pre-shrunk 3× character sheets, repacked cells or a 100-world-px soldier.
- **Facilities, props and station layers** are painted directly at 3 px per world px, as before; their offsets are unchanged.

## What Codex paints next

Paint the corrected up guide and the right guide over the approved down-v3 identity, one cell at a time, at 6.818 px/world, keeping the soles on the recorded points. Use the consistency notes above. Then Claude runs `tools/measure-foot-track.cjs`, `validate-assets --gait`, `check-direction-guides.cjs`-style signed checks on the measured tracks, and the 30-second direction/idle clip before anything is registered. The walking release gate stays blocked until then.
