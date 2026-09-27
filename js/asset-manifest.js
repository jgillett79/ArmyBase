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
      pivot: [790, 955], widthRatio: 1.1,
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
      pivot: [770, 896], widthRatio: 1.12,
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
      pivot: [770, 962], widthRatio: 1.1,
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

  // Visible content of the fitted (non-anchored) sprites: [imageW, imageH,
  // x0, y0, x1, y1] in image px (alpha > 40). Fitting the content rather
  // than the padded canvas draws these buildings 15-60% larger.
  contentBounds: {
    'assets/buildings/entrance-hall-organic.webp': [384, 256, 51, 16, 348, 243],
    'assets/buildings/shooting-range-organic.webp': [384, 256, 18, 10, 367, 246],
    'assets/buildings/barracks-organic.webp': [384, 256, 61, 14, 336, 234],
    'assets/buildings/mess-hall-organic.webp': [384, 256, 50, 18, 334, 219],
    'assets/buildings/weight_room.png': [576, 384, 103, 14, 474, 369],
    'assets/buildings/obstacle_course.png': [576, 384, 48, 14, 529, 370],
    'assets/buildings/drill_yard.png': [576, 384, 95, 14, 479, 368],
    'assets/buildings/showers.png': [576, 384, 92, 14, 484, 370],
    'assets/buildings/rec_room.png': [576, 384, 128, 13, 448, 369],
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
      // Walk/idle: one 6-frame cycle per direction on a 256x384 grid. `down` is
      // the rigged soldier (tools/lib/soldier-rig.js): six distinct phases,
      // planted feet proven by its foot track. It is a CANDIDATE: a different
      // figure from the tinted stills used for the other directions, so it
      // only shows with ?art=candidates until the full set exists.
      walk: {
        status: 'candidate', framesPerDirection: 6, directions: ['down', 'up', 'right'], strideWorld: 22,
        drawn: {
          down: {
            // v2: Codex's paint-over of the rig template (art/production/
            // TERRAIN_AND_WALK_HANDOFF.md). Its foot track is MEASURED from the
            // pixels (tools/measure-foot-track.cjs), not rendered: planted feet
            // move 24, 22 | 25, 18 source px per frame against 25 needed (up to
            // ~1 world px of skate at frame 5->6); helmet fixed at row 30 (no
            // bob); accent 100% on the body, identical in every frame.
            // The rig's own v1 strip regenerates with tools/rig-soldier.cjs.
            status: 'candidate', file: 'assets/units/candidates/soldier-walk-down-v2.webp', version: 2,
            source: 'art/rig/soldier_walk_down_painted_candidate.png', accent: 'art/rig/soldier_walk_down_painted_candidate_accent.png',
            gaitTrack: 'art/rig/soldier_walk_down_painted_candidate.json', alphaCleanup: true, tint: 'none',
            frames: [[0, 0, 256, 384], [256, 0, 256, 384], [512, 0, 256, 384], [768, 0, 256, 384], [1024, 0, 256, 384], [1280, 0, 256, 384]],
            pivot: [128, 330], headroom: 30, output: { frameHeight: 144 },
            names: ['R contact', 'R down', 'passing', 'L contact', 'L down', 'passing'],
          },
        },
      },
      idle: {
        status: 'candidate', framesPerDirection: 2, directions: ['down', 'up', 'right'],
        drawn: {
          down: {
            status: 'candidate', file: 'assets/units/candidates/soldier-idle-down-v1.webp', version: 1,
            source: 'art/rig/soldier_idle_down.png', accent: 'art/rig/soldier_idle_down_accent.png', alphaCleanup: true, tint: 'none',
            frames: [[0, 0, 256, 384], [256, 0, 256, 384]], pivot: [128, 330], headroom: 30, output: { frameHeight: 144 },
            frameMs: [900, 900],
          },
        },
      },
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
    // Scene props (upstream art/production/scene-props-3x.json): 3 image px per
    // world px (`density`), alpha already clean. Placed by SCENE_PROP_PLACEMENTS
    // in js/scenery.js; pivot = ground contact in image px.
    scene_fence: { status: 'provisional', inGame: true, file: 'assets/props/scene_fence_3x.png', density: 3, size: [240, 213], pivot: [120, 201] },
    scene_fence_post: { status: 'provisional', inGame: true, file: 'assets/props/scene_fence_post_3x.png', density: 3, size: [84, 231], pivot: [42, 219] },
    scene_lamp: { status: 'provisional', inGame: true, file: 'assets/props/scene_lamp_3x.png', density: 3, size: [132, 189], pivot: [66, 177] },
    scene_noticeboard: { status: 'provisional', inGame: true, file: 'assets/props/scene_noticeboard_3x.png', density: 3, size: [180, 163], pivot: [90, 151] },
    scene_signpost: { status: 'provisional', inGame: true, file: 'assets/props/scene_signpost_3x.png', density: 3, size: [150, 189], pivot: [75, 177] },
    scene_grass_flower: { status: 'provisional', inGame: true, file: 'assets/props/scene_grass_flower_3x.png', density: 3, size: [156, 104], pivot: [78, 92] },
    scene_rocks_granite: { status: 'provisional', inGame: true, file: 'assets/props/scene_rocks_granite_3x.png', density: 3, size: [222, 175], pivot: [111, 163] },
    scene_rock_moss: { status: 'provisional', inGame: true, file: 'assets/props/scene_rock_moss_3x.png', density: 3, size: [186, 139], pivot: [93, 127] },
    scene_utility_vehicle: { status: 'provisional', inGame: true, file: 'assets/props/scene_utility_vehicle_3x.png', density: 3, size: [312, 318], pivot: [156, 306] },
  },

  // Walkable bridges (WORLD.bridges). Two same-size transparent layers: `back`
  // (abutments, trestles, shadow-free deck, far rail) under people, `front`
  // (near rail only) over them. westPivot/eastPivot are the deck
  // centreline's end points in the layer's pixels; the renderer pins them to
  // the bridge's world west/east points, so the art needs no other
  // placement data. Until delivered, js/scenery.js draws an interim bridge
  // with the same geometry. Spec: CLAUDE_IMPLEMENTATION/06_GATE0_VISUAL_CONTRACT.md.
  bridges: {
    bridge_gate: {
      status: 'provisional', version: 1, source: 'art/production/source/ (see art/production/gate-contract-art-v1.json)',
      // 3 art px per world px; the canvas covers world x 122..242, y 578..650.
      back: { file: 'assets/bridges/bridge_gate_back.png', size: [360, 216] },
      front: { file: 'assets/bridges/bridge_gate_front.png', size: [360, 216] },
      westPivot: [36, 105], eastPivot: [300, 111],
    },
  },

  // Gate checkpoint (WORLD.checkpoint). 3 art px per world px. The kiosk's
  // ground pivot sits on WORLD.checkpoint.kioskPivot; the back layer draws
  // behind anyone south of the kiosk's north edge, the front (counter and
  // lower posts) at its ground line. The boom is one rigid piece rotated
  // about its hinge pin, which is pinned with the fixed post's pin to
  // WORLD.checkpoint.boomHinge. `axisDeg` is the measured angle of the
  // drawn pole (it rises slightly to the right); the renderer turns that
  // axis to exactly east (open) or north (closed). Spec and pivots:
  // art/production/GATE_CONTRACT_HANDOFF.md.
  checkpoint: {
    status: 'provisional', version: 1,
    kioskBack: { file: 'assets/props/gate_kiosk_back.png', size: [180, 318], pivot: [90, 300] },
    kioskFront: { file: 'assets/props/gate_kiosk_front.png', size: [180, 318], pivot: [90, 300] },
    boom: { file: 'assets/props/gate_boom_swing.png', size: [142, 46], pin: [9, 30], reachPx: 126, axisDeg: -8 },
    post: { file: 'assets/props/gate_boom_post.png', size: [51, 84], pin: [21, 21], ground: [25, 78] },
  },

  terrain: {
    ground_grass: { status: 'interim', file: 'assets/terrain/ground_grass-v2.webp', tile: true },
    ground_apron: { status: 'interim', file: 'assets/terrain/ground_apron-v2.webp', tile: true },
    // Edge strips (art/production/terrain-strips-v1.json): 3 px per world px,
    // horizontally seamless every 128 world px, `edgeRow` = the image row that
    // sits on the contour. A TRIAL: candidates, shown only with
    // ?art=candidates, draped column by column along camera-facing cliff feet
    // and the north banks of water (js/scenery.js). The corner pieces aren't
    // used: draping follows the curves continuously.
    cliff_face: { status: 'candidate', file: 'assets/terrain/cliff_face_3x.png', density: 3, size: [384, 184], edgeRow: 12, role: 'cliff lip at the plateau edge, face hangs to the foot' },
    shore_edge: { status: 'candidate', file: 'assets/terrain/shore_edge_3x.png', density: 3, size: [384, 142], edgeRow: 114, role: 'land lip above water; edge row on the waterline' },
    foam_rock_drop: { status: 'candidate', file: 'assets/terrain/foam_rock_drop_3x.png', density: 3, size: [384, 82], edgeRow: 41, role: 'foam at the waterline' },
    shore_corner_west_to_south: { status: 'candidate', file: 'assets/terrain/shore_corner_west_to_south_3x.png', density: 3, size: [256, 256], corner: [128, 128], unused: true },
    shore_corner_east_to_south: { status: 'candidate', file: 'assets/terrain/shore_corner_east_to_south_3x.png', density: 3, size: [256, 256], corner: [128, 128], unused: true },
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
