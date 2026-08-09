# Art asset spec — Phase 2 art pass

This is the manifest for replacing the placeholder canvas shapes
(`js/render.js`) with real images. Buildings/gatehouse/vacant-lot each
have their own complete, self-contained prompt — copy one entry's
"Prompt" block directly into your generator. Character sprites (27 files)
are template-based instead, to avoid 27 near-duplicate paragraphs — see
"Character direction system" for how to combine a character identity + a
direction modifier into one complete prompt.

**Nothing in this file changes the game yet.** Dropping images into the
paths below won't make them appear on screen — `render.js` still draws
rectangles/circles until a follow-up coding pass swaps those calls for
`drawImage()`. Generate the art first, confirm the look, then ask for the
wiring pass.

## Master style guide — applies to every image in this spec (buildings, gatehouse, vacant lot, all 27 character sprites)

Consistency across the set matters more than any single image looking
good in isolation — these all render together on one screen. Every prompt
below repeats these rules so each one still works standalone, but read this
once first:

- **Rendering style:** flat digital illustration / vector-style game art.
  Clean, closed shapes. Minimal-to-no gradient shading — think mobile
  strategy game asset, not concept art or painterly rendering.
- **Outline:** every shape gets a consistent dark outline (`#1a1d14`,
  matching the game's page background), roughly 2-3px at final resolution.
  No outline-free / "glow edge" style.
- **Lighting:** single soft, ambient light source from the upper-left, low
  contrast. No hard directional shadows, no rim lighting, no specular
  highlights. A soft, small contact shadow directly beneath the subject is
  optional but must be subtle (≤15% opacity) and NOT a hard drop shadow.
- **Background:** fully transparent (alpha channel), no background color,
  no ground texture, no vignette, no gradient backdrop. The subject only.
- **Composition:** subject centered, filling roughly 75-85% of the canvas
  on its longest axis, with even transparent padding on all sides. Camera
  is the same 30-40° top-down isometric angle for EVERYTHING now,
  buildings and characters alike — no dramatic angle, no fisheye, no
  forced perspective. (Earlier versions of this doc had characters
  front-on; that's been superseded — see "Character direction system"
  below for why and what changed.)
- **Absolutely avoid:** text, numbers, logos, watermarks, signatures, UI
  chrome, other buildings/characters/props in frame, motion blur, lens
  flare, photorealism, film grain.
- **Format:** PNG-24 (8-bit per channel + alpha), sRGB color space.

Two sub-palettes are used, and it matters which one applies to which asset
— see the tinting note below.

**Building palette (use exact hex, full saturation, this IS the final
color):**
`#5a6450` (olive) · `#8a9478` (khaki-sage) · `#6a5240` (brown) ·
`#40605a` (teal-green) · `#5a4a6a` (muted purple) · `#6a5a30` (olive-brown)
· `#4a5a6a` (steel-blue) · `#d8d8c8` (light khaki, trim/highlight only)

**Character base palette (desaturated — see "why characters must be
desaturated" below):**
`#8a897d` (neutral warm gray, main uniform/clothing) · `#6e6d63` (darker
gray, shading/creases) · `#b8b6a8` (light gray-khaki, skin/highlight) ·
`#4a4942` (near-black gray, boots/straps/small details)

---

## Why characters must be desaturated (read before generating soldiers/civilians)

In `js/render.js`, `drawUnit()` hue-shifts every unit's body color at
render time based on a random per-unit `colorSeed` (0-359°) — that's the
entire mechanism that makes up to 20 recruited soldiers visually
distinguishable from each other today, and it will keep doing that job
after real art replaces the placeholder circles (generating 20 fully
unique character sprites is out of scope for this pass — see "Not
included" below).

A hue-shift filter recolors an image by rotating its existing hue values —
it does **not** replace color like a tint overlay would. If the source art
is already saturated (e.g. olive-drab uniform green), the hue-shift will
produce muddy, unpredictable results because it's rotating a color that's
already "used." If the source art is **desaturated/grayscale-leaning**
(the character base palette above), the hue-shift cleanly produces a wide,
predictable range of clean colors. **This is a hard technical requirement,
not a style preference** — soldiers and civilians must use ONLY the
character base palette (neutral grays/khakis), never the saturated
building palette. Buildings are never hue-shifted in code, so they use the
full building palette as their real, final color.

---

## Buildings (6 files)

Each building renders as a single static image at every level — the level
number (`Lv.1`/`Lv.2`/`Lv.3`) is drawn as a text overlay by existing code,
not baked into the art. Only the "built" appearance needs art here — the
"not-built" state has its own single shared asset (`vacant_lot.png`,
below), reused across all 6 building plots rather than one per building,
since an empty plot doesn't need to look different depending on what will
eventually go there.

**Shared specs for all 6 buildings:**
- **Save format:** PNG-24, transparent background
- **In-game display size:** 144 × 96 px (3×2 grid cells @ 48px/cell)
- **Generate at:** 576 × 384 px exactly (4× display size — also a clean
  multiple of 64px, which most AI image generators prefer as a native
  output size, so this shouldn't need awkward resizing)
- **Aspect ratio:** 3:2 (landscape)
- **Camera:** top-down with a slight isometric tilt — roughly a 30-40°
  angle down from directly overhead, as if looking down at a base layout
  map. Consistent across all 6 buildings so they sit together visually.
- **Palette:** use the building palette above; each building's dominant
  color is called out individually below

### `barracks.png`
**Path:** `assets/buildings/barracks.png`

**Prompt:** A low, single-story military barracks building, viewed from a
30-40° top-down isometric angle, flat vector game-art illustration style
with a consistent 2-3px dark outline (#1a1d14) on every edge. Rectangular
footprint, slightly wider than deep. Walls in muted khaki-sage (#8a9478),
a shallow-pitched corrugated roof in dark olive (#5a6450). One visible
door centered on the long wall facing the camera, two small square
windows flanking it, a short set of steps or a low concrete stoop at the
entrance. Optional: a stack of sandbags or a folded flag pole beside the
door for military flavor, but keep it minimal. Flat ambient lighting from
upper-left, no hard shadows, an optional soft 10% contact shadow directly
under the building only. Fully transparent background, no ground/grass
underneath, no text, no people, no other structures in frame. Building
fills about 80% of canvas width, centered with even padding.
**Generate at 576×384px, PNG with alpha transparency.**

### `shooting_range.png`
**Path:** `assets/buildings/shooting_range.png`

**Prompt:** An open-air military shooting range, viewed from a 30-40°
top-down isometric angle, flat vector game-art illustration style with a
consistent 2-3px dark outline (#1a1d14) on every edge. Long rectangular
footprint: a low firing-line barrier/counter at the camera-facing end in
brown (#6a5240), 3-4 parallel narrow shooting lanes marked by low wooden
divider walls running away from the camera, simple humanoid target
silhouettes standing at the far end of the lanes, backed by a low earth
berm or sandbag wall in khaki-sage (#8a9478). No roof — this structure is
outdoors. Flat ambient lighting from upper-left, no hard shadows, optional
soft 10% contact shadow directly under the structure only. Fully
transparent background, no ground/grass texture, no text, no people, no
other structures in frame. Structure fills about 80% of canvas width,
centered with even padding.
**Generate at 576×384px, PNG with alpha transparency.**

### `weight_room.png`
**Path:** `assets/buildings/weight_room.png`

**Prompt:** A small enclosed military gym/weight room building, viewed
from a 30-40° top-down isometric angle, flat vector game-art illustration
style with a consistent 2-3px dark outline (#1a1d14) on every edge.
Rectangular footprint, flat roof in muted purple-gray (#5a4a6a), walls in
khaki-sage (#8a9478). One open garage-style front wall or large window
facing the camera revealing the interior: a barbell rack, a couple of
weight plates, and a bench, rendered simply and flatly (no fine detail,
just clear readable silhouettes). Flat ambient lighting from upper-left,
no hard shadows, optional soft 10% contact shadow directly under the
building only. Fully transparent background, no ground/grass texture, no
text, no people, no other structures in frame. Building fills about 80% of
canvas width, centered with even padding.
**Generate at 576×384px, PNG with alpha transparency.**

### `obstacle_course.png`
**Path:** `assets/buildings/obstacle_course.png`

**Prompt:** An outdoor military obstacle course, viewed from a 30-40°
top-down isometric angle, flat vector game-art illustration style with a
consistent 2-3px dark outline (#1a1d14) on every edge. No enclosing
building — a compact training-yard footprint containing 3 simple obstacle
elements arranged left-to-right: a low wooden wall to climb over, a stack
of 3-4 truck tires laid flat for foot-stepping, and a cargo-net frame
(simple crosshatch net between two posts). Ground plane implied only by
where the obstacles sit — do not render grass/dirt texture, keep the
background transparent around and between the obstacles. Colors in
olive-brown (#6a5a30) for the wood/dirt elements, dark gray (#4a4942) for
the tires/net rope. Flat ambient lighting from upper-left, no hard
shadows, optional soft 10% contact shadow directly under each obstacle
element only. No text, no people, no other structures in frame. The three
obstacles together fill about 80% of canvas width, centered with even
padding.
**Generate at 576×384px, PNG with alpha transparency.**

### `drill_yard.png`
**Path:** `assets/buildings/drill_yard.png`

**Prompt:** An open military combat drill yard, viewed from a 30-40%
top-down isometric angle, flat vector game-art illustration style with a
consistent 2-3px dark outline (#1a1d14) on every edge. A paved/packed-dirt
open rectangular area in steel-blue (#4a5a6a) as the dominant tone, marked
with 4-5 small painted formation-marker circles or cones arranged in a
grid pattern (like drill-position markers), and 1-2 simple padded training
dummies (a vertical post with a rounded punching-bag-like top) standing at
one edge. This should read as visually distinct from the Weight Room
(indoor gym) and Obstacle Course (climbing obstacles) — it's about
open-area formation/combat drilling, not equipment. Flat ambient lighting
from upper-left, no hard shadows, optional soft 10% contact shadow
directly under the dummies/markers only. Fully transparent background, no
grass/ground texture beyond the paved area shape itself, no text, no
people, no other structures in frame. Fills about 80% of canvas width,
centered with even padding.
**Generate at 576×384px, PNG with alpha transparency.**

### `mess_hall.png`
**Path:** `assets/buildings/mess_hall.png`

**Prompt:** A military mess hall / dining building, viewed from a 30-40°
top-down isometric angle, flat vector game-art illustration style with a
consistent 2-3px dark outline (#1a1d14) on every edge. Rectangular
footprint, wider than deep, roof and walls in teal-green (#40605a). A
serving window or open hatch on the camera-facing wall with a simple
awning above it, one or two picnic-style tables visible just outside the
building along the same wall. Flat ambient lighting from upper-left, no
hard shadows, optional soft 10% contact shadow directly under the
building only. Fully transparent background, no ground/grass texture, no
text, no people, no other structures in frame. Building fills about 80% of
canvas width, centered with even padding.
**Generate at 576×384px, PNG with alpha transparency.**

### `gatehouse.png`
**Path:** `assets/buildings/gatehouse.png`

The base is enclosed by a perimeter wall; this is the single opening in
it — a gatehouse archway units walk through to enter or leave. Unlike the
other 6 buildings, it's tall/narrow (it fills a gap in the wall line, not
an open plot), so it gets its own resolution.

- **In-game display size:** 48 × 96 px (1 grid cell wide × 2 cells tall —
  it sits directly in the wall line, narrower than a normal building plot)
- **Generate at:** 192 × 384 px exactly (4× display size, clean multiple
  of 64px)
- **Aspect ratio:** 1:2 (tall portrait)

**Prompt:** A military base gatehouse/checkpoint archway, viewed from a
30-40° top-down isometric angle, flat vector game-art illustration style
with a consistent 2-3px dark outline (#1a1d14) on every edge. A narrow
tower/arch structure spanning the full height of the image, tall and
narrow rather than wide — a raised guard-post box at the top with a small
window, supporting a simple lowered or raised boom-gate / archway opening
below it that the rest of the image's width passes through. Tones in
weathered khaki-tan (#8a9478) for the structure with dark steel-blue
(#4a5a6a) accents on the gate/boom-arm. Flat ambient lighting from
upper-left, no hard shadows, optional soft 10% contact shadow at the base
only. Fully transparent background, no ground/grass texture, no text, no
people, no other structures in frame. Structure fills about 85% of canvas
height, centered with even padding on left/right.
**Generate at 192×384px, PNG with alpha transparency.**

### `vacant_lot.png`
**Path:** `assets/buildings/vacant_lot.png`

The "not yet built" state for all 6 building plots (Weight Room,
Obstacle Course, Combat Drill Yard, etc. before you've spent cash on
them) — one shared asset reused at every empty plot, not a
per-building variant, since an empty plot is an empty plot regardless of
what eventually gets built there. The existing "Lv.1 (not built)"-style
text label still renders on top of this in-code — don't bake any text
into the art itself.

- **In-game display size:** 144 × 96 px (same 3×2-cell footprint as a
  built building)
- **Generate at:** 576 × 384 px exactly (4× display size, clean multiple
  of 64px)
- **Aspect ratio:** 3:2 (landscape), same camera angle as the 6 buildings

**Prompt:** A cleared, empty construction plot, viewed from a 30-40°
top-down isometric angle, flat vector game-art illustration style with a
consistent 2-3px dark outline (#1a1d14) on the plot's edge only (not
individual clutter). Bare packed dirt in muted brown (#6a5240) filling
the rectangular plot, a few small details reading as "about to be built
on" — a couple of wooden stakes with string marking out a foundation
corner, maybe one small stack of lumber or cinder blocks in a corner.
Deliberately sparse and low-detail — this is a placeholder plot, not a
finished scene. Flat ambient lighting from upper-left, no hard shadows.
Fully transparent background outside the plot rectangle itself, no text,
no people, no other structures in frame. Fills the full 3:2 canvas edge
to edge (unlike the built buildings, this should read as ground filling
the whole plot, not an object floating with padding).
**Generate at 576×384px, PNG with alpha transparency.**

---

## Character direction system (read before generating any character sprite)

**This supersedes the original front-facing character spec.** Characters
now use the same 30-40 degree top-down isometric camera as the buildings,
and walk with proper directional sprites instead of one static front-on
icon.

The road network (see `CLAUDE.md`) only ever produces axis-aligned
movement -- units walk along a fixed spine + spokes, never diagonally. So
rather than a full 8-direction set (most of which would never render),
each character gets **3 unique directional sprites -- down, up, right**
-- and **left is that same right-facing image mirrored horizontally in
code** (a free `ctx.scale(-1, 1)` flip, zero extra art). That's all 4
cardinal directions actually used in-game, for 25% less generation work
than 4 unique sprites and a fraction of a full 8-direction set, with no
visual quality loss (a walking figure's left and right profile are
genuinely mirror images of each other).

This applies to all 9 characters (3 civilians + 6 soldiers). **Soldiers
also switch from their original standing-at-ease pose to the same
mid-stride walking pose as civilians** -- they spend most of their time
walking the roads now (recruit walk-in, road wandering, commuting to
jobs), so a static at-ease pose would look stiff while gliding across the
screen.

Every character sprite is fully specified by combining:
1. one of the 9 **character identities** below (what makes this character
   this character -- clothing, build, headgear)
2. one of the 3 **direction modifiers** below (camera framing + stride for
   that direction)

Both parts always include the shared technical requirements (palette,
outline, lighting, background, format) from the master style guide above
-- they're not repeated in every prompt below to keep this section
readable, but they apply to all 27 files exactly as they did to the
original 9.

**Shared specs for all 27 files:**
- **Save format:** PNG-24, transparent background
- **In-game display size:** 32 x 48 px
- **Generate at:** 128 x 192 px exactly (4x display size, clean multiple
  of 64px)
- **Aspect ratio:** 2:3 (portrait)
- **Palette:** character base palette ONLY (`#8a897d` `#6e6d63` `#b8b6a8`
  `#4a4942`) -- see "why characters must be desaturated" above.

### Direction modifiers (append one to whichever character identity below)

**`down`** -- walking toward the camera (this is what a unit walking
"south," i.e. down the screen, looks like). Viewed from the 30-40 degree
top-down isometric angle, front of the body facing the viewer, leading
leg stepping toward camera, face/front mostly visible, head angled
slightly down as if seen from just above. Mid-stride walking pose.

**`up`** -- walking away from the camera ("north," up the screen). Same
isometric angle, but the character's back is toward the viewer -- back of
the head/hair, shoulders, and the back of the walking stride visible, no
face visible. Mid-stride walking pose, same leg-forward energy as `down`
but shown from behind.

**`right`** -- walking toward the right of the screen ("east"). Shown in
right-facing side profile at the same isometric tilt -- one side of the
body and face profile visible, legs scissored fore-and-aft along the
direction of travel, mid-stride. **Do not generate a separate `left`
sprite** -- it's this image flipped horizontally in code.

### Character identities

**`civilian`** -- Generic pedestrian in plain casual clothing: a simple
t-shirt/jacket shape and pants, no distinguishing accessories, no bag.

**`bus_rider`** -- Same build as `civilian`, but carrying a small duffel
bag/backpack over one shoulder -- this bag is the one visual difference
from `civilian`; everything else (clothing style, build) stays identical
for set consistency.

**`taxi`** -- Same build as `civilian`, but a simple collared jacket
instead of a plain t-shirt (slightly neater/sharper silhouette), no bag.

**`soldier_01`** -- Basic uniform (jacket + trousers silhouette, no extra
gear), no headgear, bare head with a simple short-hair silhouette.

**`soldier_02`** -- Same uniform as `soldier_01`, plus a rounded combat
helmet -- the one visual difference from `soldier_01`.

**`soldier_03`** -- Same as `soldier_01`, but noticeably
bulkier/broader-shouldered -- wider torso silhouette, same overall
height -- the one visual difference from `soldier_01`.

**`soldier_04`** -- Same as `soldier_01`, but noticeably
slighter/narrower -- narrower torso silhouette, same overall height --
the one visual difference from `soldier_01`.

**`soldier_05`** -- Same uniform as `soldier_01`, plus a soft beret
angled slightly to one side -- must read as clearly distinct in
silhouette from `soldier_02`'s rounded helmet.

**`soldier_06`** -- Same uniform as `soldier_01`, no headgear, plus
visible gear webbing straps across the chest and a small pack on the
back -- the one visual difference from `soldier_01`.

### Full file list (27 files: 9 characters x 3 directions)

Every filename below is `{character}_{direction}.png`. All share the
"Generate at 128x192px, PNG with alpha transparency" spec from above.

| Character | `down` | `up` | `right` | Folder |
|---|---|---|---|---|
| `civilian` | `civilian_down.png` | `civilian_up.png` | `civilian_right.png` | `assets/units/civilians/` |
| `bus_rider` | `bus_rider_down.png` | `bus_rider_up.png` | `bus_rider_right.png` | `assets/units/civilians/` |
| `taxi` | `taxi_down.png` | `taxi_up.png` | `taxi_right.png` | `assets/units/civilians/` |
| `soldier_01` | `soldier_01_down.png` | `soldier_01_up.png` | `soldier_01_right.png` | `assets/units/soldiers/` |
| `soldier_02` | `soldier_02_down.png` | `soldier_02_up.png` | `soldier_02_right.png` | `assets/units/soldiers/` |
| `soldier_03` | `soldier_03_down.png` | `soldier_03_up.png` | `soldier_03_right.png` | `assets/units/soldiers/` |
| `soldier_04` | `soldier_04_down.png` | `soldier_04_up.png` | `soldier_04_right.png` | `assets/units/soldiers/` |
| `soldier_05` | `soldier_05_down.png` | `soldier_05_up.png` | `soldier_05_right.png` | `assets/units/soldiers/` |
| `soldier_06` | `soldier_06_down.png` | `soldier_06_up.png` | `soldier_06_right.png` | `assets/units/soldiers/` |

Example -- to generate `soldier_02_right.png`, combine: the `soldier_02`
identity (basic uniform + rounded combat helmet) + the `right` direction
modifier (isometric side profile, mid-stride, facing screen-right) + the
shared technical requirements (character base palette, 2-3px dark
outline, flat ambient lighting from upper-left, transparent background,
figure filling ~80% of canvas height, no text/props/other characters,
128x192px PNG with alpha).

### Note for whoever wires this in later

The old single-sprite-per-character files (`civilian.png`, `soldier_01.png`,
etc. with no direction suffix) stay in place and the game keeps working
exactly as it does now until this new set is both generated AND wired in
-- don't delete the old files preemptively. The wiring pass will need:
`UNIT_SPRITES` restructured to a nested lookup (e.g.
`UNIT_SPRITES.civilian.down`), a way to derive "which direction is this
unit currently moving" from the dx/dy of its current path leg (always
axis-aligned per the road network, so this is just a sign check, not real
vector math), and a horizontal-flip `ctx.scale(-1, 1)` branch for `left`.
Not implemented yet -- flagged here so it isn't guessed at differently
later.

---
## Not included in this pass (intentionally)

- **"Not built" building ghost state** — stays the existing dashed-outline
  procedural render. No asset.
- **Status overlays** — the hospital ring, energy bar, name/status text
  labels above units. These are small, dynamic (change every frame), and
  drawn procedurally on top of whatever sprite ends up there — baking them
  into static art would mean regenerating art every time a number changes.
  No asset needed.
- **Per-unit unique portraits** — the profile panel currently shows text
  stats only, no image slot exists in `index.html` yet. Fully unique art
  per one of up to 20 individually-named soldiers would need either 20x the
  generation work or a runtime generation pipeline wired into the recruit
  flow — that's a bigger, separate decision (ties into the "art pipeline"
  open question in `CLAUDE.md`), not something to fold into this batch.
- **Walk-cycle animation frames** — the 3 directional poses (down/up/right)
  are each a single static frame, not an animated stride cycle. Units
  glide between waypoints without a leg-swinging animation. A later
  upgrade, not this pass.
- **A separate `left` sprite** — deliberately not generated; it's the
  `right` sprite flipped horizontally in code. See "Character direction
  system" above.
- **Diagonal (NE/SE/SW/NW) directional sprites** — the road network only
  ever produces axis-aligned movement, so these would never render. Only
  add them if free-roam diagonal movement gets built later.

## Quick-reference table

| # | Filename | Path | Resolution | Format |
|---|---|---|---|---|
| 1 | `barracks.png` | `assets/buildings/barracks.png` | 576×384px | PNG-24 + alpha |
| 2 | `shooting_range.png` | `assets/buildings/shooting_range.png` | 576×384px | PNG-24 + alpha |
| 3 | `weight_room.png` | `assets/buildings/weight_room.png` | 576×384px | PNG-24 + alpha |
| 4 | `obstacle_course.png` | `assets/buildings/obstacle_course.png` | 576×384px | PNG-24 + alpha |
| 5 | `drill_yard.png` | `assets/buildings/drill_yard.png` | 576×384px | PNG-24 + alpha |
| 6 | `mess_hall.png` | `assets/buildings/mess_hall.png` | 576×384px | PNG-24 + alpha |
| 7 | `gatehouse.png` | `assets/buildings/gatehouse.png` | 192×384px | PNG-24 + alpha |
| 8 | `vacant_lot.png` | `assets/buildings/vacant_lot.png` | 576×384px | PNG-24 + alpha |
| 9-35 | `{character}_{down\|up\|right}.png` | see the 27-file table above | 128×192px | PNG-24 + alpha |

**#1-6 (6 files) are already generated and in the repo — no action
needed.** **#7 `gatehouse.png` and #8 `vacant_lot.png`** are needed;
`render.js` already has a sprite slot for both and falls back to a
procedural placeholder until they land. **#9-35, the 27 directional
character files**, are the new work this update adds — they **replace**
the original 9 front-facing character sprites (which still exist in the
repo and keep the game working exactly as-is until the new set is
generated AND wired in — see the wiring note above).

## Folder structure

```
assets/
  buildings/
    barracks.png              (done)
    shooting_range.png        (done)
    weight_room.png           (done)
    obstacle_course.png       (done)
    drill_yard.png            (done)
    mess_hall.png             (done)
    gatehouse.png              (needed)
    vacant_lot.png             (needed)
  units/
    civilians/
      civilian.png             (old front-facing — superseded, do not delete yet)
      bus_rider.png            (old front-facing — superseded, do not delete yet)
      taxi.png                 (old front-facing — superseded, do not delete yet)
      civilian_down.png         (needed)
      civilian_up.png           (needed)
      civilian_right.png        (needed)
      bus_rider_down.png        (needed)
      bus_rider_up.png          (needed)
      bus_rider_right.png       (needed)
      taxi_down.png              (needed)
      taxi_up.png                (needed)
      taxi_right.png             (needed)
    soldiers/
      soldier_01.png ... soldier_06.png   (old front-facing — superseded, do not delete yet)
      soldier_01_down.png       (needed)
      soldier_01_up.png         (needed)
      soldier_01_right.png      (needed)
      soldier_02_down.png       (needed)
      soldier_02_up.png         (needed)
      soldier_02_right.png      (needed)
      soldier_03_down.png       (needed)
      soldier_03_up.png         (needed)
      soldier_03_right.png      (needed)
      soldier_04_down.png       (needed)
      soldier_04_up.png         (needed)
      soldier_04_right.png      (needed)
      soldier_05_down.png       (needed)
      soldier_05_up.png         (needed)
      soldier_05_right.png      (needed)
      soldier_06_down.png       (needed)
      soldier_06_up.png         (needed)
      soldier_06_right.png      (needed)
```

Drop each generated file at the exact path above. The game keeps working
throughout — the old front-facing sprites keep rendering until the new
directional set is both fully generated and wired into `render.js` (a
follow-up coding pass, not automatic), at which point the old 9 files can
be deleted.
