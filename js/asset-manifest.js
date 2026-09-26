// asset-manifest.js — what each piece of art is, where it came from, and how
// it sits in the world. Read by the game (render.js/state.js/animation.js),
// by tools/prepare-art.cjs (which builds the files under assets/ from the
// untouched sources in art/) and by tools/validate-assets.cjs.
//
// Coordinates for processed art are in SOURCE pixels (the file in art/), so
// anchors survive re-exporting at a different resolution. The exported file
// is the `crop` rectangle resampled to `output.width`.
//
// Placement: an asset's `pivot` (ground contact) is put on the zone's art
// anchor — footprint centre x, footprint bottom − 6 — and the crop is
// scaled to `widthRatio` × the zone's width. See facilityArtTransform().
//
// Status:
//   production         — approved for release
//   provisional        — cleaned, anchored and reviewed at game scale; in
//                        use, but still one bitmap (no split roof/front
//                        files) or mixed style — replace when the kit lands
//   interim            — older art kept until a replacement exists
//   candidate          — processed for review only; shown in game only with
//                        ?art=candidates (fails a consistency check)
//   needs-regeneration — can't be cleaned into usable layers; see
//                        art/CHATGPT_FEEDBACK.md for what to redraw
//   missing            — required, not drawn yet
//
// Conventions (checked by review, see art/review/): fixed three-quarter
// camera from the south, warm upper-left key light, contact shadows drawn
// by the renderer (never baked into character frames), transparent
// background, no text, dark outline.

const ASSET_MANIFEST = {
  version: 1,

  // Height of a standing person in world px. Buildings are placed relative
  // to their zones, so this is what sets people-to-building proportion.
  // 60 made people twice the height of the studies' doors (reviewed at game
  // scale in art/review/); 44 keeps poses readable at 1:1 zoom.
  unitWorldHeight: 44,

  facilities: {
    shooting_range: {
      status: 'provisional', kind: 'open', file: 'assets/buildings/range-study-v1.webp', version: 1,
      source: 'art/concepts/range-interaction-study.webp',
      crop: [56, 24, 1466, 945], output: { width: 768 }, alphaCleanup: true,
      alphaBounds: [60, 28, 1518, 965],
      pivot: [790, 955], widthRatio: 0.94,
      doorSides: ['south'], orientation: 'three_quarter_south', light: 'upper-left',
      entrance: [790, 900],
      // Two covered stations with mats (level 1), then open lane positions.
      // Everyone faces the targets (up and to the right: a back view).
      slots: [
        { id: 'mat_1', x: 548, y: 592, facing: 'up', activity: 'fire' },
        { id: 'mat_2', x: 842, y: 708, facing: 'up', activity: 'fire' },
        { id: 'lane_1', x: 800, y: 470, facing: 'up', activity: 'fire' },
        { id: 'lane_2', x: 960, y: 540, facing: 'up', activity: 'fire' },
        { id: 'lane_3', x: 900, y: 420, facing: 'up', activity: 'fire' },
        { id: 'lane_4', x: 1040, y: 470, facing: 'up', activity: 'fire' },
      ],
      targets: [[960, 300], [1120, 350]],
      // Low walls in front of the stations, redrawn over people standing behind them.
      front: [
        [[340, 552], [470, 556], [502, 598], [502, 668], [470, 684], [338, 642]],
        [[600, 645], [760, 650], [860, 700], [990, 732], [990, 792], [880, 814], [830, 802], [700, 762], [605, 722]],
      ],
    },
    barracks: {
      status: 'provisional', kind: 'indoor', file: 'assets/buildings/barracks-study-v1.webp', version: 1,
      source: 'art/concepts/barracks-study.webp',
      crop: [31, 140, 1473, 772], output: { width: 768 }, alphaCleanup: true,
      alphaBounds: [35, 144, 1500, 908],
      pivot: [770, 896], widthRatio: 0.98,
      doorSides: ['south'], orientation: 'three_quarter_south', light: 'upper-left',
      entrance: [640, 720],
      slots: [
        { id: 'bunk_1', x: 1030, y: 600, facing: 'down', activity: 'rest' },
        { id: 'bunk_2', x: 1100, y: 625, facing: 'down', activity: 'rest' },
        { id: 'bunk_3', x: 1170, y: 600, facing: 'down', activity: 'rest' },
        { id: 'bunk_4', x: 1060, y: 570, facing: 'down', activity: 'rest' },
        { id: 'bunk_5', x: 1140, y: 575, facing: 'down', activity: 'rest' },
        { id: 'bunk_6', x: 1005, y: 630, facing: 'down', activity: 'rest' },
      ],
      front: [],
    },
    mess_hall: {
      status: 'provisional', kind: 'open', file: 'assets/buildings/mess-hall-study-v1.webp', version: 1,
      source: 'art/concepts/mess-hall-study.webp',
      crop: [35, 46, 1474, 934], output: { width: 768 }, alphaCleanup: true,
      alphaBounds: [39, 50, 1505, 976],
      pivot: [770, 962], widthRatio: 0.96,
      doorSides: ['south'], orientation: 'three_quarter_south', light: 'upper-left',
      entrance: [1230, 760],
      // Bench places on the camera side of the two tables under the open side.
      slots: [
        { id: 'bench_1a', x: 350, y: 706, facing: 'up', activity: 'eat' },
        { id: 'bench_1b', x: 440, y: 704, facing: 'up', activity: 'eat' },
        { id: 'bench_1c', x: 525, y: 712, facing: 'up', activity: 'eat' },
        { id: 'bench_2a', x: 590, y: 790, facing: 'up', activity: 'eat' },
        { id: 'bench_2b', x: 665, y: 815, facing: 'up', activity: 'eat' },
        { id: 'bench_2c', x: 740, y: 808, facing: 'up', activity: 'eat' },
      ],
      front: [],
    },
    entrance_hall: { status: 'interim', kind: 'open', file: 'assets/buildings/entrance-hall-organic.webp', doorSides: ['south'] },
    weight_room: { status: 'interim', kind: 'indoor', file: 'assets/buildings/weight_room.png', doorSides: ['south', 'north'] },
    obstacle_course: { status: 'interim', kind: 'open', file: 'assets/buildings/obstacle_course.png', doorSides: ['south', 'north'] },
    drill_yard: { status: 'interim', kind: 'open', file: 'assets/buildings/drill_yard.png', doorSides: ['south', 'north'] },
    showers: { status: 'interim', kind: 'indoor', file: 'assets/buildings/showers.png', doorSides: ['south', 'north'] },
    rec_room: { status: 'interim', kind: 'indoor', file: 'assets/buildings/rec_room.png', doorSides: ['south', 'north'] },
  },

  // Older art kept as the fallback when provisional art can't be used on a
  // zone (e.g. a range saved on a north-door site).
  fallbackFacilityFiles: {
    shooting_range: 'assets/buildings/shooting-range-organic.webp',
    barracks: 'assets/buildings/barracks-organic.webp',
    mess_hall: 'assets/buildings/mess-hall-organic.webp',
  },

  gate: {
    status: 'needs-regeneration', file: 'assets/buildings/gatehouse.png',
    candidateSource: 'art/concepts/gate-intake-study.webp',
    reason: 'The barrier arm is painted into the kiosk and the painted road; it cannot be lifted or split without faking it. Needs separate kiosk-back, kiosk-front and arm (with hinge pivot) layers.',
  },

  // People. Frame sets are per archetype; identity colour comes from the
  // per-person tint in render.js. Walk cycles are distance-driven (one
  // cycle per `strideWorld` world px travelled) so feet don't skate.
  units: {
    soldier: {
      stills: { status: 'interim', pattern: 'assets/units/soldiers/soldier_{variant}_{direction}.png', directions: ['down', 'up', 'right'], mirrorLeft: true },
      walk: { status: 'missing', framesPerDirection: 6, directions: ['down', 'up', 'right'], strideWorld: 36 },
      idle: { status: 'missing', framesPerDirection: 2, directions: ['down', 'up', 'right'], frameMs: 700 },
      activities: {
        fire: {
          status: 'candidate', file: 'assets/units/candidates/soldier-fire-candidate-v1.webp', version: 1,
          source: 'art/concepts/soldier-firing-poses-study.webp', alphaCleanup: true,
          // Equal boxes, each with the feet at the same pivot. Frame 3's
          // painted muzzle flash is erased (the renderer draws the effect).
          frames: [[20, 80, 460, 640], [505, 80, 460, 640], [995, 80, 460, 640], [1535, 80, 460, 640]],
          // Frame 3's painted flash also reaches into frame 4's box in the source.
          eraseBright: [[2, 330, 0, 130, 200], [3, 0, 0, 40, 200]], // [frameIndex, x, y, w, h] in frame px
          eraseAll: [[2, 447, 20, 13, 140]], // the painted flash streak past the muzzle
          pivot: [175, 625], output: { frameHeight: 200 },
          effects: { muzzleFlash: { frame: 2, at: [442, 72] } }, // frame px
          facing: 'up', frameMs: [260, 160, 90, 320], names: ['ready', 'aim', 'recoil', 'recover'],
          reason: 'Consistent across its four frames, but a different character (olive WWII kit, full colour) from the six tinted soldier bodies used for idle/walk — switching to it would change a soldier\'s look mid-activity.',
        },
      },
    },
    civilian: {
      stills: { status: 'interim', pattern: 'assets/units/civilians/{outfit}_{direction}.png', directions: ['down', 'up', 'right', 'sitting'], mirrorLeft: true },
      walk: { status: 'missing', framesPerDirection: 6, directions: ['down', 'up', 'right'], strideWorld: 34 },
    },
  },

  // Stand-alone props (upstream art/production/range-berms.json). The delivered
  // PNGs had ~90%-alpha bodies, so prepare-art writes cleaned copies. Pivot = ground
  // contact in image px. Listed, not placed: the provisional range art already
  // carries its own front walls; place these when the range kit is split.
  props: {
    range_berm_left: { status: 'production', file: 'assets/props/range_berm_left-clean.png', source: 'assets/props/range_berm_left.png', alphaCleanup: true, size: [228, 132], pivot: [114, 128], role: 'front occluder, left firing lane' },
    range_berm_right: { status: 'production', file: 'assets/props/range_berm_right-clean.png', source: 'assets/props/range_berm_right.png', alphaCleanup: true, size: [228, 116], pivot: [114, 112], role: 'front occluder, right firing lane' },
  },

  terrain: {
    ground_grass: { status: 'interim', file: 'assets/terrain/ground_grass-v2.webp', tile: true },
    ground_apron: { status: 'interim', file: 'assets/terrain/ground_apron-v2.webp', tile: true },
    procedural: { status: 'interim', note: 'Cliffs, water, trees, rocks and fences are drawn in js/scenery.js until the terrain kit exists.' },
  },
};

// Should this asset appear in game? Candidates only with ?art=candidates.
function assetInUse(entry, allowCandidates = false) {
  if (!entry) return false;
  if (entry.status === 'production' || entry.status === 'provisional' || entry.status === 'interim') return true;
  return entry.status === 'candidate' && allowCandidates;
}

// Processed facility art usable on this zone (anchored art needs a matching door side).
function facilityArtFor(type, zone) {
  const art = ASSET_MANIFEST.facilities[type];
  if (!art || !art.crop || !assetInUse(art)) return null;
  return art.doorSides.includes(zone.doorSide) ? art : null;
}

// Source-pixel -> world mapping for processed art placed on a zone.
function facilityArtTransform(art, zone) {
  const bounds = polygonBounds(zone.footprint);
  const centre = polygonCentroid(zone.footprint);
  const scale = (bounds.maxX - bounds.minX) * art.widthRatio / art.crop[2];
  const anchor = { x: centre.x, y: bounds.maxY - 6 };
  const toWorld = (sx, sy) => ({ x: anchor.x + (sx - art.pivot[0]) * scale, y: anchor.y + (sy - art.pivot[1]) * scale });
  const topLeft = toWorld(art.crop[0], art.crop[1]);
  return { scale, anchor, toWorld, rect: { x: topLeft.x, y: topLeft.y, w: art.crop[2] * scale, h: art.crop[3] * scale } };
}

// World-space slots from a facility's art on its zone, or null to use the
// zone's generic anchors.
function facilityArtSlots(type, zone) {
  const art = facilityArtFor(type, zone);
  if (!art || !art.slots) return null;
  const { toWorld } = facilityArtTransform(art, zone);
  return art.slots.map(slot => ({ ...slot, ...toWorld(slot.x, slot.y) }));
}
