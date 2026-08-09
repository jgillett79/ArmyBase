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

## Buildings (7 files)

Each building renders as a single static image at every level — the level
number (`Lv.1`/`Lv.2`/`Lv.3`) is drawn as a text overlay by existing code,
not baked into the art. Only the "built" appearance needs art here — the
"not-built" state has its own single shared asset (`vacant_lot.png`,
below), reused across all 6 upgradeable building plots rather than one per
building, since an empty plot doesn't need to look different depending on
what will eventually go there. (`entrance_hall.png`, the 7th building
below, is the one exception — it's a free structure present from the
start, never shown as an empty plot — see its own entry for why.)

**Shared specs for all 7 buildings:**
- **Save format:** PNG-24, transparent background
- **In-game display size:** 144 × 96 px (3×2 grid cells @ 48px/cell)
- **Generate at:** 576 × 384 px exactly (4× display size — also a clean
  multiple of 64px, which most AI image generators prefer as a native
  output size, so this shouldn't need awkward resizing)
- **Aspect ratio:** 3:2 (landscape)
- **Camera:** top-down with a slight isometric tilt — roughly a 30-40°
  angle down from directly overhead, as if looking down at a base layout
  map. Consistent across all 7 buildings so they sit together visually.
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

### `showers.png`
**Path:** `assets/buildings/showers.png`

**Prompt:** A military shower/washroom block, viewed from a 30-40°
top-down isometric angle, flat vector game-art illustration style with a
consistent 2-3px dark outline (#1a1d14) on every edge. Rectangular
footprint, flat roof, walls in steel-blue (#4a7a8a). A row of 3-4 simple
shower-head/spigot shapes visible along the camera-facing wall (either
through an open front or small window openings), a low drain/gutter line
along the base of the wall. Flat ambient lighting from upper-left, no
hard shadows, optional soft 10% contact shadow directly under the
building only. Fully transparent background, no ground/grass texture, no
text, no people, no other structures in frame. Building fills about 80%
of canvas width, centered with even padding.
**Generate at 576×384px, PNG with alpha transparency.**

### `rec_room.png`
**Path:** `assets/buildings/rec_room.png`

**Prompt:** A military recreation room / lounge building, viewed from a
30-40° top-down isometric angle, flat vector game-art illustration style
with a consistent 2-3px dark outline (#1a1d14) on every edge. Rectangular
footprint, flat roof, walls in warm amber-brown (#8a6a4a). A large window
or open front revealing simple interior shapes — a table with a couple of
chairs, maybe a simple TV/board-game shape — rendered flatly (clear
silhouettes, no fine detail). Flat ambient lighting from upper-left, no
hard shadows, optional soft 10% contact shadow directly under the
building only. Fully transparent background, no ground/grass texture, no
text, no people, no other structures in frame. Building fills about 80%
of canvas width, centered with even padding.
**Generate at 576×384px, PNG with alpha transparency.**

### `entrance_hall.png`
**Path:** `assets/buildings/entrance_hall.png`

Where civilians wait after walking through the gate, instead of the old
"wander to a random point and stand there" behavior — the user's feedback
was that this read as aimless. Now up to 4 civilians walk here and each
takes a distinct waiting chair (`ENTRANCE_HALL_CHAIRS` in `state.js`) until
either recruited or they time out and leave. Unlike the other 6 buildings,
this one is a free structure present from the start (no cost, no upgrade
levels, always shown built) — same idea as the gatehouse — so there's no
"not built" state to worry about for this one.

**The art needs to visually support 4 civilians standing in a row inside
it** — see the chair layout below — so the generated room should read as
open/spacious with visible floor space across the middle-front of the
image, not filled edge-to-edge with furniture silhouettes the characters
would appear to stand on top of.

- Chairs are 4 simple bench/chair shapes in a horizontal row, evenly
  spaced across roughly the middle 2/3 of the image width, positioned
  in the lower-middle third of the image (near the "front" of the room
  as the camera sees it, not up against the back wall)
- Characters render as flat 32×48px sprites standing at each chair's
  position — the art doesn't need to render people, just the empty
  chairs/benches they'll appear to be sitting at

**Prompt:** A military base reception/entrance hall building, viewed from a
30-40° top-down isometric angle, flat vector game-art illustration style
with a consistent 2-3px dark outline (#1a1d14) on every edge. Rectangular
footprint, wider than deep, roof and walls in warm tan-brown (#6a5a4a). An
open front wall or large window revealing a simple waiting room interior:
a row of 4 plain bench-style chairs evenly spaced across the middle-front
of the interior floor, facing the camera, with a small reception
desk/counter shape toward the back of the room (behind the chairs, not
blocking them). Floor rendered as a flat, slightly lighter interior tone
so the chairs and open standing space between them read clearly. Flat
ambient lighting from upper-left, no hard shadows, optional soft 10%
contact shadow directly under the building only. Fully transparent
background, no ground/grass texture, no text, no people, no other
structures in frame. Building fills about 80% of canvas width, centered
with even padding.
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

## Terrain (5 tileable texture files)

Right now the ground, the wall, and the roads are all flat procedural
canvas shapes (a solid fill color + a thin grid-line overlay for ground,
a solid gray rectangle for the wall, a solid tan stroke for roads) — none
of it is real art. Even with real buildings and real characters, the
surfaces underneath them would still look like placeholder blocks by
comparison. This section covers those five surfaces.

### Terrain variety — 3 ground zones, not 1 flat texture

The base used to be a single `ground.png` tiled across the whole play
area, which read as "just a big brown area" (user feedback). Every grid
cell is now classified into one of 3 zones (`terrainZoneGrid()` in
`render.js`, computed once from building positions, not hand-authored per
tile):
- **`apron`** — a maintained-looking pad around every building, tapering
  off with distance + a deterministic noise function instead of a hard
  rectangle — a first pass drew this as an exact 1-cell margin and it
  read as too artificially square (user feedback: a base like this
  wouldn't line up so perfectly, especially one sited in rough/mountain
  terrain), so the edge is now ragged/organic. Uses the new
  `ground_apron.png`.
- **`ground`** — the existing dirt texture (`ground.png`, already
  generated), kept for the road corridor (the spine row + each spoke
  column) so the road still reads as "the path," not grass poking through
  it.
- **`grass`** — open, undeveloped yard — everywhere else. Uses the new
  `ground_grass.png`.

This means **`ground.png` is still used** (for the road corridor), not
replaced — only `ground_apron.png` and `ground_grass.png` are new.

### Setting: a base dug into rough/mountain terrain, not a manicured lot

User feedback on the first terrain pass: the base should read as sited in
rugged, mountainous terrain, not laid out on a flat manicured lot — so
none of the 5 terrain textures below should look too clean/uniform. Keep
the "quiet, low-detail, won't distract from buildings/characters"
constraint from each individual prompt (busy textures repeated 200+ times
would look noisy), but lean toward slightly uneven, weathered, and
irregular over polished and flat wherever the two are in tension.

### These are tileable pattern swatches, NOT one-off images

Unlike every other asset in this doc, these five are small repeating
textures, applied via canvas's `ctx.createPattern(img, 'repeat')` (the 3
ground zones, wall) or as a pattern `strokeStyle` (road — roads are drawn
as a stroked line, not a filled rectangle). **Each one must tile
seamlessly** — its left edge must match its right edge, and its top edge
must match its bottom edge, so that repeating it side-by-side and
stacking it top-to-bottom shows no visible seam.

**This is a genuinely harder ask of an image generator than the other
assets in this doc** — not every model/tool handles seamless tiling well
by default. If your generator has a dedicated "seamless/tileable texture"
mode, use it. If not, generate normally and then check the result by
tiling it 2×2 yourself (most image editors can preview this, or just
duplicate the image into a 2×2 grid and look for a visible seam) before
finalizing. Because the overall art style here is flat/vector with a
consistent dark outline (not photorealistic), minor imperfect seams are
far less noticeable than they'd be in a photoreal texture — low-contrast,
subtle variation (see each prompt below) matters more than perfection.

**Shared specs for all 5 terrain textures:**
- **Save format:** PNG-24. No transparency needed (these are opaque
  background/ground-level surfaces, drawn first, before anything else).
- **Seamless tiling:** required on all 4 edges, both axes.
- **Palette:** matches the building palette (these ARE part of the
  environment, not tinted in-engine) — muted, low-contrast, low-detail so
  200+ repeats across the base don't create a busy/noisy floor. Avoid any
  single distinctive feature (a rock, a crack, a stain) that would look
  obviously repeated when tiled dozens of times.
- **No baked-in lighting/shadow direction** — a directional shadow would
  create a visible seam every time the tile repeats. Keep it flat/ambient.

### `ground.png`
**Path:** `assets/terrain/ground.png`

**In-game tile size:** 48 × 48 px (exactly 1 grid cell — tiles align
perfectly to the existing grid). **Generate at:** 192 × 192 px (4×, clean
multiple of 64px).

**Prompt:** A seamlessly tileable packed-dirt military base yard ground
texture, flat digital illustration style matching a mobile strategy game
(not photorealistic), viewed from directly above. Muted tan/olive dirt
tone (base color close to `#6a5a30` / `#5a6450`), very subtle low-contrast
tonal variation and a faint sparse texture (a few scattered small pebbles
or thin cracks, kept subtle and evenly distributed, not clustered) — the
goal is a quiet, low-detail floor that won't distract from buildings and
characters on top of it, not a detailed ground painting. No grass tufts,
no large rocks, no footprints, no distinct features that would repeat
obviously when tiled. Flat, even lighting with no directional shadow. The
image's left edge must match its right edge and its top edge must match
its bottom edge exactly, for seamless repeat tiling.
**Generate at 192×192px, PNG, no transparency needed.**

### `ground_apron.png`
**Path:** `assets/terrain/ground_apron.png`

The maintained-looking pad directly around every building — see "Terrain
variety" above for which cells use this.

**In-game tile size:** 48 × 48 px (exactly 1 grid cell). **Generate at:**
192 × 192 px (4×, clean multiple of 64px).

**Prompt:** A seamlessly tileable packed-gravel/hardstanding military
base texture, flat digital illustration style matching a mobile strategy
game (not photorealistic), viewed from directly above. Lighter,
more "maintained" tone than plain dirt — a khaki-gray gravel/compacted
surface (base color close to `#8a9478`, matching the building wall
palette), very subtle low-contrast tonal variation and a faint sparse
gravel-fleck texture, evenly distributed, not clustered. Slightly uneven/
weathered rather than a perfectly smooth manicured surface — this is a
working military hardstanding cut into rough terrain, not a paved
parking lot. Should read as clearly more "developed/prepared ground"
than `ground.png`'s bare dirt, while staying in the same low-contrast,
low-detail family — the goal is still a quiet floor that won't distract
from buildings and characters on top of it. No grass, no large rocks, no
distinct features that would repeat obviously when tiled. Flat, even
lighting with no directional shadow. The image's left edge must match its
right edge and its top edge must match its bottom edge exactly, for
seamless repeat tiling.
**Generate at 192×192px, PNG, no transparency needed.**

### `ground_grass.png`
**Path:** `assets/terrain/ground_grass.png`

The open, undeveloped yard — see "Terrain variety" above for which cells
use this.

**In-game tile size:** 48 × 48 px (exactly 1 grid cell). **Generate at:**
192 × 192 px (4×, clean multiple of 64px).

**Prompt:** A seamlessly tileable rough scrub-grass military base yard
texture, flat digital illustration style matching a mobile strategy game
(not photorealistic), viewed from directly above. Muted olive-green tone
(base color close to `#5a6a3a`), very subtle low-contrast tonal variation
suggesting uneven, slightly wild grass/scrub rather than a mowed lawn —
this is undeveloped ground at a base sited in rough/mountain terrain, not
manicured parkland — a faint fine texture with occasional slightly darker
patches, not individual blades, kept subtle and evenly distributed.
Should read as clearly distinct from both `ground.png` (dirt) and
`ground_apron.png` (gravel) at a glance — this is the "natural/unpaved"
zone, those two are the "worked" zones. No flowers, no bare-dirt patches,
no large features that would repeat obviously when tiled. Flat, even
lighting with no directional shadow. The image's left edge must match its
right edge and its top edge must match its bottom edge exactly, for
seamless repeat tiling.
**Generate at 192×192px, PNG, no transparency needed.**

### `wall.png`
**Path:** `assets/terrain/wall.png`

**In-game tile size:** 96 × 96 px (2×2 grid cells). **Generate at:**
384 × 384 px (4×, clean multiple of 64px).

**Prompt:** A seamlessly tileable military perimeter wall surface
texture, flat digital illustration style matching a mobile strategy game
(not photorealistic), viewed straight-on (this tiles across a wall
rendered as a thick stroked band, not as a 3D object). Weathered
concrete/reinforced-barrier look in dark gray tones (base color close to
`#4a4a42`, seams/joints in a lighter gray close to `#6a6a5c`), with
evenly-spaced vertical support-post lines or panel-seam lines subtle
enough to repeat cleanly. Flat, even lighting, no directional shadow. The
image's left edge must match its right edge and its top edge must match
its bottom edge exactly, for seamless repeat tiling in any direction
(this same texture tiles along the top/bottom walls horizontally AND the
left/right walls vertically, so it must look correct rotated 90° too —
avoid any text, arrow, or asymmetric detail that would reveal a "correct"
orientation).
**Generate at 384×384px, PNG, no transparency needed.**

### `road.png`
**Path:** `assets/terrain/road.png`

**In-game tile size:** 48 × 48 px (1 grid cell). **Generate at:**
192 × 192 px (4×, clean multiple of 64px).

**Prompt:** A seamlessly tileable worn dirt/gravel path texture, flat
digital illustration style matching a mobile strategy game (not
photorealistic), viewed from directly above. Lighter tan tone than the
ground texture so it visually reads as "the path" (base color close to
`#5a5548`), subtle low-contrast wear/compaction texture, very faint
scattered small gravel flecks, evenly distributed. No ruts, no distinct
tire tracks, no large stones — keep it quiet enough that the existing
dashed centerline (drawn separately, in code, on top of this) stays
legible. Flat, even lighting, no directional shadow. The image's left
edge must match its right edge and its top edge must match its bottom
edge exactly, for seamless repeat tiling in any direction (the same
texture tiles along the horizontal spine road AND the vertical spoke
roads, so it must look correct rotated 90° too).
**Generate at 192×192px, PNG, no transparency needed.**

### Note on how this is wired in

All 5 textures are implemented in `render.js`: `drawGrid()` fills each
grid cell with whichever of the 3 ground-zone patterns
(`ground`/`ground_apron`/`ground_grass`) `terrainZoneGrid()` assigns it,
`drawPerimeterWall()` uses a `ground.png`-style pattern fillStyle for the
wall, and `drawRoads()` uses a pattern strokeStyle for the road stroke.
Each falls back to a flat placeholder color (not a blank canvas) if its
source image hasn't loaded/been generated yet — see `spriteReady()`. The
existing grid lines and dashed road centerline stay as procedural
overlays drawn on top, same as always.

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

## Civilian sitting pose (3 files — Entrance Hall waiting chairs)

Civilians waiting in the Entrance Hall (see `entrance_hall.png` above)
currently stand at their chair using the normal `down`/`up`/`right`
walking sprite, whichever direction they happened to be facing when they
arrived — it works, but looks stiff next to an actual seated pose. This
adds a dedicated `sitting` variant, **civilians only** — soldiers never
sit in these chairs, so unlike the 27-file walking set above, this is
just 3 files, one per civilian identity, not per identity-times-direction.

A seated figure doesn't turn to face a direction of travel, so there's
only **one** sitting image per identity — no `down`/`up`/`right`/`left`
variants. `render.js` swaps to this pose the moment a civilian has fully
arrived at their assigned chair (mid-walk-in, they still use the normal
directional sprites) and ignores `unit.facing` entirely while seated.

**Shared specs for all 3 files (same as the 27-file walking set):**
- **Save format:** PNG-24, transparent background
- **In-game display size:** 32 × 48 px
- **Generate at:** 128 × 192 px exactly (4× display size)
- **Aspect ratio:** 2:3 (portrait)
- **Palette:** character base palette ONLY (`#8a897d` `#6e6d63` `#b8b6a8`
  `#4a4942`) — see "why characters must be desaturated" above
- **Camera/pose:** same 30-40° top-down isometric angle as the walking
  set, but seated — facing forward/toward the camera (matching the chairs
  in `entrance_hall.png`, which face the viewer), hands resting in lap or
  on knees, both feet on the ground, upright relaxed posture, not
  slouched. Chair/bench itself is NOT part of this image — the Entrance
  Hall art already draws the chairs; this is the character alone, same as
  every other character sprite in this doc.

| Identity | Filename | Path |
|---|---|---|
| `civilian` | `civilian_sitting.png` | `assets/units/civilians/civilian_sitting.png` |
| `bus_rider` | `bus_rider_sitting.png` | `assets/units/civilians/bus_rider_sitting.png` |
| `taxi` | `taxi_sitting.png` | `assets/units/civilians/taxi_sitting.png` |

**Prompt (combine with the identity description from "Character
identities" above — e.g. for `bus_rider_sitting.png`, add "duffel bag
resting beside them or on their lap"):** A civilian pedestrian seated on
a chair, viewed from a 30-40° top-down isometric angle, flat vector
game-art illustration style with a consistent 2-3px dark outline
(#1a1d14) on the figure's edges. Upright relaxed seated posture, facing
forward toward the camera, both feet flat on the ground, hands resting in
lap or on knees. Character base palette only (`#8a897d` `#6e6d63`
`#b8b6a8` `#4a4942`), no other colors. Flat ambient lighting from
upper-left, no hard shadows, optional soft 10% contact shadow directly
under the figure only. Do not render a chair, bench, or any furniture —
figure only. Fully transparent background, no text, no props, no other
characters in frame. Figure fills about 80% of canvas height, centered
with even padding.
**Generate at 128×192px, PNG with alpha transparency.**

If this isn't generated, civilians just keep using their normal standing
directional sprite while seated — same graceful-fallback pattern as every
other not-yet-generated asset in this doc, so there's no urgency.

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
- **A soldier sitting pose** — soldiers never use the Entrance Hall
  waiting chairs (only civilians pass through there), so there's no
  equivalent need for one.

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
| 9 | `showers.png` | `assets/buildings/showers.png` | 576×384px | PNG-24 + alpha |
| 10 | `rec_room.png` | `assets/buildings/rec_room.png` | 576×384px | PNG-24 + alpha |
| 11 | `entrance_hall.png` | `assets/buildings/entrance_hall.png` | 576×384px | PNG-24 + alpha |
| 12 | `ground.png` | `assets/terrain/ground.png` | 192×192px | PNG-24 (tileable) |
| 13 | `ground_apron.png` | `assets/terrain/ground_apron.png` | 192×192px | PNG-24 (tileable) |
| 14 | `ground_grass.png` | `assets/terrain/ground_grass.png` | 192×192px | PNG-24 (tileable) |
| 15 | `wall.png` | `assets/terrain/wall.png` | 384×384px | PNG-24 (tileable) |
| 16 | `road.png` | `assets/terrain/road.png` | 192×192px | PNG-24 (tileable) |
| 17-43 | `{character}_{down\|up\|right}.png` | see the 27-file table above | 128×192px | PNG-24 + alpha |
| 44 | `civilian_sitting.png` | `assets/units/civilians/civilian_sitting.png` | 128×192px | PNG-24 + alpha |
| 45 | `bus_rider_sitting.png` | `assets/units/civilians/bus_rider_sitting.png` | 128×192px | PNG-24 + alpha |
| 46 | `taxi_sitting.png` | `assets/units/civilians/taxi_sitting.png` | 128×192px | PNG-24 + alpha |

**#1-8, #12, #15-43 (35 files) are already generated and in the repo — no
action needed.** **#9 `showers.png`, #10 `rec_room.png`, #11
`entrance_hall.png`, #13-14 (`ground_apron.png`/`ground_grass.png`), and
#44-46 (the 3 sitting-pose files) are new** — `render.js` already has a
sprite/pattern slot for all of them and falls back to a procedural
colored box (buildings), a flat tint color (terrain), or the normal
standing sprite (sitting poses) until they land, so there's no urgency.

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
    gatehouse.png              (done)
    vacant_lot.png             (done)
    showers.png                (needed)
    rec_room.png                (needed)
    entrance_hall.png           (needed)
  terrain/
    ground.png                 (done, tileable)
    ground_apron.png            (needed, tileable)
    ground_grass.png            (needed, tileable)
    wall.png                   (done, tileable)
    road.png                   (done, tileable)
  units/
    civilians/
      civilian.png             (old front-facing — superseded, kept as fallback)
      bus_rider.png            (old front-facing — superseded, kept as fallback)
      taxi.png                 (old front-facing — superseded, kept as fallback)
      civilian_down.png         (done)
      civilian_up.png           (done)
      civilian_right.png        (done)
      bus_rider_down.png        (done)
      bus_rider_up.png          (done)
      bus_rider_right.png       (done)
      taxi_down.png              (done)
      taxi_up.png                (done)
      taxi_right.png             (done)
      civilian_sitting.png       (needed)
      bus_rider_sitting.png      (needed)
      taxi_sitting.png           (needed)
    soldiers/
      soldier_01.png ... soldier_06.png   (old front-facing — superseded, kept as fallback)
      soldier_01_down.png       (done)
      soldier_01_up.png         (done)
      soldier_01_right.png      (done)
      soldier_02_down.png       (done)
      soldier_02_up.png         (done)
      soldier_02_right.png      (done)
      soldier_03_down.png       (done)
      soldier_03_up.png         (done)
      soldier_03_right.png      (done)
      soldier_04_down.png       (done)
      soldier_04_up.png         (done)
      soldier_04_right.png      (done)
      soldier_05_down.png       (done)
      soldier_05_up.png         (done)
      soldier_05_right.png      (done)
      soldier_06_down.png       (done)
      soldier_06_up.png         (done)
      soldier_06_right.png      (done)
```

38 of 46 files are already in the repo and wired into
`render.js`/`state.js`. The 8 still needed: `showers.png`, `rec_room.png`,
`entrance_hall.png`, `ground_apron.png`, `ground_grass.png`, and the 3
civilian sitting-pose files. Drop each at its path above when generated —
the game already renders a graceful fallback for every one of them (a
procedural colored box for buildings, a flat tint for terrain, the normal
standing sprite for the sitting poses) until then, so none of this is
urgent. The old front-facing sprites (`civilian.png`, `bus_rider.png`,
`taxi.png`, `soldier_01.png`...`soldier_06.png`) are superseded by the
directional set but kept on disk as a fallback chain in `render.js` —
safe to delete later once confirmed unused.
