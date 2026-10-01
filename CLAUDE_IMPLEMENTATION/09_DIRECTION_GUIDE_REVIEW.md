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

---

# Second pass — Tenth round guides (main 16f153f), 1 October 2026

Merged 16f153f into `brief-09-daily-base` (two text conflicts: the generator and README took main's versions, which keep the rear-view correction). Regenerating with `tools/render-direction-contact-guides.cjs` reproduces the committed PNGs byte for byte. Overlays, zoom-1.6 strips and the 30-second direction-change/idle loop were re-captured from these guides (`docs/screenshots/2026-10-01-direction-guides/`; the `.webm` stays local). The guides are still absent from `js/asset-manifest.js` and `service-worker.js`, and `walkReleaseGate()` is still blocked (tests assert both). No walking speed, stride or foot-lock change.

## What passes

- **Runtime geometry**: planted soles cancel body travel exactly at every frame start (0.000 world px) in right and up; footprints 11 world px apart; frames 1 and 4 plant opposite feet.
- **Turns keep the planted leg**: at every frame index the same anatomical foot is planted in down, right and up (frames 1–3 the soldier's right foot, 4–6 the left), so a turn at any frame keeps the same leg on the ground. The rifle stays on the left shoulder.
- The planted boot still jumps on screen at a turn, because each view draws the foot in a different place relative to the body: 4.5–9.5 world px for 90° turns (down↔right, right↔up), 7–14 for reversals (up↔down). That is inherent to snapping between views without in-between frames; judge it in painted footage.

## Correction to my first review

I wrote that the down master's swing foot is 82 source px above the planted sole at passing. **That was wrong**: 82 is frame 4, where the trailing foot is a whole step *behind* the body. In this camera, depth and height both move a foot up the screen, so 82 = a 74 px step + about 7 px of lift. Measured from the master's track (and confirmed on its raster):

| Down master, measured | Source px | How |
|---|---|---|
| Passing lift (frames 3, 6) | **8** | planted sole row 320.5 vs swinging 312.5; at passing both soles are at the same depth |
| Stance width | **51.3** (48–56) | planted-sole centres: f1/f4 103.5 vs 159.5, f2/f5 108.5 vs 156.5, f3/f6 106.5 vs 156.5 |
| Toe-off lift (frame 4) | **7** | trailing sole drawn at 288.5; its ground position is 320.5 − 25 = 295.5 |
| Contact step (frame 4) | **74** | 82 row gap − 8 lift |

The master's frame-1 trailing-foot point (x 128–130, 3 px wide) is the planted boot crossing the cell midline, so frame 1 is not used. Codex matched 80 px to my wrong number.

## Remaining corrections (not ready to paint yet)

`node tools/check-direction-guides.cjs` now compares the guides with these master values and exits 2 when they differ. On the committed Tenth round guides:

| Measure (source px) | Down master | Right guide | Up guide | Tolerance |
|---|---|---|---|---|
| Stance width | 51.3 | **40** | **40** | ±6 |
| Passing lift | 8 | **80** | **80** | ±6 |
| Toe-off lift | 7 | 0 | **25** | ±8 |
| Idle stance width | 51.3 | **40** | **40** | ±6 |

At game size the 80 px lift reads as a high march (knee near the hip) in the right and up strips, next to a down walk whose feet barely leave the ground. The up guide's toe-off: its trailing foot stops moving at the first unplanted frame (row 343 where its ground position is 368), so it reads as lifted 25 px or dragged.

### Exact proposed tracks (pass every check)

Also in [`proposed-tracks-tenth-round-followup.json`](../docs/screenshots/2026-10-01-direction-guides/proposed-tracks-tenth-round-followup.json). Rules: stance width 52, centred on the pivot; planted soles unchanged (25 px/frame, same cancellation); toe-off frame keeps cancelling and lifts 8; the mid-swing frame sits halfway between toe-off and passing, lifted 12; the passing foot is beside the planted foot (same depth), lifted 8; contact unchanged. `P` = planted.

| Frame | Right view: right (near) sole | left (far) sole | Up view: right sole | left sole |
|---|---|---|---|---|
| 1 | (165, 356) P | (91, 296) | (154, 293) P | (102, 359) |
| 2 | (140, 356) P | (103, 292) | (154, 318) P | (102, 343) |
| 3 | (115, 356) P | (115, 296) | (154, 343) P | (102, 335) |
| 4 | (91, 348) | (165, 304) P | (154, 359) | (102, 293) P |
| 5 | (103, 344) | (140, 304) P | (154, 343) | (102, 318) P |
| 6 | (115, 348) | (115, 304) P | (154, 335) | (102, 343) P |
| Idle | (132, 356) | (124, 304) | (154, 330) | (102, 330) |

Ground rows: right view near 356, far 304 (±26 about 330); up view x 154/102 (±26 about 128). With these values the checker reports: runtime geometry pass; stance width 52/52; passing lift 8/8; toe-off lift 8/9; identity kept at every frame — **"ready to paint one cell at a time"**. Hip positions in the generator should follow the new foot columns (up: hips at x 154/102), and the generator's own assertion (`width 40, lift 80`) needs updating to 52/8.

Once the generator produces these and the checker exits 0, the templates are ready for Codex to paint one cell at a time. The walk release gate stays blocked until painted cells pass the measured-raster track, `validate-assets --gait` and the 30-second clip.
