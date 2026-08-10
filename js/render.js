// render.js — draws the base using the Phase 2 art (assets/). Sprites are
// preloaded below; until an image finishes loading (or if one fails to load)
// each drawer falls back to the original placeholder shape, so the game is
// always visible and never blocks on the art.

// --- sprite loading -------------------------------------------------------

function loadSprite(path) {
  const img = new Image();
  img.src = path;
  return img; // img.complete && naturalWidth>0 tells us when it's usable
}

function spriteReady(img) {
  return img && img.complete && img.naturalWidth > 0;
}

const BUILDING_SPRITES = {
  barracks: loadSprite('assets/buildings/barracks.png'),
  shooting_range: loadSprite('assets/buildings/shooting_range.png'),
  weight_room: loadSprite('assets/buildings/weight_room.png'),
  obstacle_course: loadSprite('assets/buildings/obstacle_course.png'),
  drill_yard: loadSprite('assets/buildings/drill_yard.png'),
  mess_hall: loadSprite('assets/buildings/mess_hall.png'),
  showers: loadSprite('assets/buildings/showers.png'),
  rec_room: loadSprite('assets/buildings/rec_room.png'),
  entrance_hall: loadSprite('assets/buildings/entrance_hall.png'),
  gatehouse: loadSprite('assets/buildings/gatehouse.png'),
  vacant_lot: loadSprite('assets/buildings/vacant_lot.png'),
};

// Tileable ground/wall/road textures — see ASSETS.md's "Terrain" section.
// Generated at 4x display size (same convention as every other sprite), so
// each pattern needs a 0.25 scale to tile at its actual in-game size.
// ground_apron/ground_grass are the "terrain variety" pass — see
// terrainZoneGrid() below for which cells use which texture.
const TERRAIN_SPRITES = {
  ground: loadSprite('assets/terrain/ground.png'),
  ground_apron: loadSprite('assets/terrain/ground_apron.png'),
  ground_grass: loadSprite('assets/terrain/ground_grass.png'),
  wall: loadSprite('assets/terrain/wall.png'),
  road: loadSprite('assets/terrain/road.png'),
};
const TERRAIN_SCALE = 0.25;
const terrainPatternCache = {};

// Canvas patterns need a live 2D context to create, but this game only
// ever has one canvas — so once a pattern's created it's cached and reused
// every frame instead of rebuilding it, until the source image finishes
// loading (returns null until then, same graceful-fallback idea as
// spriteReady() elsewhere in this file).
function getTerrainPattern(ctx, key) {
  if (terrainPatternCache[key]) return terrainPatternCache[key];
  const img = TERRAIN_SPRITES[key];
  if (!spriteReady(img)) return null;
  const pattern = ctx.createPattern(img, 'repeat');
  if (pattern && pattern.setTransform) {
    pattern.setTransform(new DOMMatrix([TERRAIN_SCALE, 0, 0, TERRAIN_SCALE, 0, 0]));
  }
  terrainPatternCache[key] = pattern;
  return pattern;
}

// Each identity has 3 directional sprites (down/up/right — see ASSETS.md's
// "Character direction system") plus the original single-pose sprite as a
// fallback for whichever directional file hasn't loaded yet. There's no
// 'left' file — see unitSprite() below, it's the 'right' image mirrored.
// Civilians also get a 'sitting' pose (soldiers never sit — see
// isSeatedCivilian() below) for the Entrance Hall waiting chairs; a single
// fixed orientation, no down/up/right variants, since a seated figure
// doesn't turn to face a direction of travel.
//
// down2/up2/right2 are the walk-cycle's second frame (ASSETS.md's
// "Walk-cycle animation" spec) — not generated yet, so these all resolve
// to a broken Image until they land, which is fine: unitSprite() only
// ever reaches for them via spriteReady(), falling back to the existing
// single-pose frame otherwise (same graceful-degrade pattern as every
// other not-yet-generated asset in this file).
function civilianSpriteSet(outfit) {
  const base = `assets/units/civilians/${outfit}`;
  return {
    down: loadSprite(`${base}_down.png`),
    up: loadSprite(`${base}_up.png`),
    right: loadSprite(`${base}_right.png`),
    down2: loadSprite(`${base}_down_2.png`),
    up2: loadSprite(`${base}_up_2.png`),
    right2: loadSprite(`${base}_right_2.png`),
    sitting: loadSprite(`${base}_sitting.png`),
    fallback: loadSprite(`${base}.png`),
  };
}

function soldierSpriteSet(variant) {
  const padded = String(variant).padStart(2, '0');
  const base = `assets/units/soldiers/soldier_${padded}`;
  return {
    down: loadSprite(`${base}_down.png`),
    up: loadSprite(`${base}_up.png`),
    right: loadSprite(`${base}_right.png`),
    down2: loadSprite(`${base}_down_2.png`),
    up2: loadSprite(`${base}_up_2.png`),
    right2: loadSprite(`${base}_right_2.png`),
    fallback: loadSprite(`assets/units/soldiers/soldier_${padded}.png`),
  };
}

const UNIT_SPRITES = {
  civilian: civilianSpriteSet('civilian'),
  bus_rider: civilianSpriteSet('bus_rider'),
  taxi: civilianSpriteSet('taxi'),
  soldier_1: soldierSpriteSet(1),
  soldier_2: soldierSpriteSet(2),
  soldier_3: soldierSpriteSet(3),
  soldier_4: soldierSpriteSet(4),
  soldier_5: soldierSpriteSet(5),
  soldier_6: soldierSpriteSet(6),
};

// On-screen unit sprite size (matches the 32x48 spec in ASSETS.md).
const UNIT_W = 32;
const UNIT_H = 48;

// Dispatches on outfit, not isCivilian — a RECRUITING unit (walking to the
// Barracks after being recruited) has isCivilian=false already but still
// wears its civilian outfit visually until it arrives and outfit flips to
// 'uniform' (see state.js's RECRUITING handling in tick()).
function unitSpriteSet(unit) {
  if (unit.outfit !== 'uniform') return UNIT_SPRITES[unit.outfit] || UNIT_SPRITES.civilian;
  return UNIT_SPRITES['soldier_' + (unit.soldierVariant || 1)];
}

// True once a waiting civilian has actually reached their assigned chair
// (not just been assigned one — see state.js's assignChair(), which sets
// chairIndex the moment they cross the gate, well before they arrive).
// isAtTarget() requires the walk to be fully done, so this only flips on
// once they're really standing at the seat.
function isSeatedCivilian(unit) {
  return unit.isCivilian && unit.status === UNIT_STATUS.CIVILIAN_APPROACHING
    && unit.chairIndex !== null && unit.isAtTarget();
}

// Picks the directional image for unit.facing ('left' reuses 'right' — see
// drawUnit(), which mirrors it) and falls back to the older single-pose
// sprite if that specific direction hasn't loaded yet. Seated civilians use
// their fixed sitting pose instead, when it's loaded — falls back to the
// normal standing/directional chain otherwise, same graceful-degrade idea
// as every other sprite lookup in this file.
//
// While actually walking (not isAtTarget()) and on the second half of its
// stride (unit.walkFrame === 1 — see Unit.advanceWalkAnim()), reaches for
// the "_2" walk-cycle frame instead, if it's loaded. A stationary unit, or
// one whose "_2" art hasn't been generated yet, always shows the original
// single frame — so this is a pure visual bonus, never a requirement.
function unitSprite(unit) {
  const set = unitSpriteSet(unit);
  if (isSeatedCivilian(unit) && spriteReady(set.sitting)) {
    return set.sitting;
  }
  const dirKey = unit.facing === 'left' ? 'right' : unit.facing;
  if (unit.walkFrame === 1 && !unit.isAtTarget()) {
    const frame2 = set[dirKey + '2'];
    if (spriteReady(frame2)) return frame2;
  }
  const img = set[dirKey];
  return spriteReady(img) ? img : set.fallback;
}

// --- drawers --------------------------------------------------------------

// Deterministic pseudo-random value in [0,1) from integer cell coords —
// the classic "sine hash" trick. NOT Math.random(): needs to return the
// same value every time for the same cell, so the organic edge below is
// stable across frames/reloads instead of flickering or reshuffling.
function cellNoise(gx, gy) {
  const n = Math.sin(gx * 127.1 + gy * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// Chebyshev (grid-step) distance from a cell to the nearest edge of a set
// of building footprint rectangles — 0 if the cell is inside one.
function distanceToNearestBuilding(gx, gy, footprints) {
  let best = Infinity;
  for (const f of footprints) {
    const dx = gx < f.x0 ? f.x0 - gx : gx >= f.x1 ? gx - f.x1 + 1 : 0;
    const dy = gy < f.y0 ? f.y0 - gy : gy >= f.y1 ? gy - f.y1 + 1 : 0;
    best = Math.min(best, Math.max(dx, dy));
  }
  return best;
}

// "Terrain variety" — the whole base used to be one flat ground.png fill,
// which read as "just a big brown area" (user feedback). Every grid cell
// now gets classified into one of 3 zones instead:
//   'apron' — a maintained-looking pad around each building, so buildings
//             read as sitting on cleared/prepared ground rather than bare
//             dirt. Tapers off with distance + noise (see below) instead
//             of a hard-edged rectangle, which read as too artificially
//             square for a base that's meant to feel dug into rough
//             terrain, not laid out on a manicured grid (user feedback).
//   'ground' — the existing dirt texture, kept for the road corridor (the
//              spine row + each spoke column) so the road still reads as
//              "the path" rather than grass poking through it.
//   'grass' — open, undeveloped yard — everywhere else.
// Building positions are fixed for the life of the app (no in-game
// relocation), so this is computed once and cached rather than every frame.
let terrainZoneCache = null;

function terrainZoneGrid(gameState) {
  if (terrainZoneCache) return terrainZoneCache;

  const aproned = [
    gameState.barracks, gameState.shootingRange, gameState.messHall,
    gameState.weightRoom, gameState.obstacleCourse, gameState.drillYard,
    gameState.showers, gameState.recRoom, gameState.entranceHall,
  ];
  const footprints = aproned.map(b => ({
    x0: b.gridX, y0: b.gridY,
    x1: b.gridX + BUILDING_FOOTPRINT_CELLS.w, y1: b.gridY + BUILDING_FOOTPRINT_CELLS.h,
  }));
  const spineRow = Math.floor(ROAD_Y_SPINE / CELL_SIZE);
  // Spoke columns run through the middle of each row-1 building's
  // footprint (gridX+1) — see the ROADS comment in state.js.
  const spokeCols = [gameState.barracks, gameState.shootingRange, gameState.messHall]
    .map(b => b.gridX + 1);

  // Probability a cell at this Chebyshev distance from a building becomes
  // apron — 100% right at the building, tapering off over 2 more rings so
  // the edge comes out ragged/organic rather than a straight rectangle.
  // Placeholder tuning, like every other hand-picked number in this repo.
  const APRON_TAPER = [1, 0.75, 0.3];

  const grid = [];
  for (let gy = 0; gy < GRID_ROWS; gy++) {
    const row = [];
    for (let gx = 0; gx < GRID_COLS; gx++) {
      const dist = distanceToNearestBuilding(gx, gy, footprints);
      const chance = APRON_TAPER[dist];
      if (chance !== undefined && cellNoise(gx, gy) < chance) {
        row.push('apron');
      } else if (gy === spineRow || spokeCols.includes(gx)) {
        row.push('ground');
      } else {
        row.push('grass');
      }
    }
    grid.push(row);
  }
  terrainZoneCache = grid;
  return grid;
}

const TERRAIN_ZONE_FALLBACK_COLOR = {
  apron: 'rgba(138, 148, 120, 0.35)', // khaki-sage, matches the building palette
  ground: null, // drawGrid's default fillStyle already covers this case
  grass: 'rgba(90, 100, 60, 0.35)', // muted olive
};

function drawGrid(ctx, gameState) {
  const zones = terrainZoneGrid(gameState);
  const patterns = {
    apron: getTerrainPattern(ctx, 'ground_apron'),
    ground: getTerrainPattern(ctx, 'ground'),
    grass: getTerrainPattern(ctx, 'ground_grass'),
  };

  for (let gy = 0; gy < GRID_ROWS; gy++) {
    for (let gx = 0; gx < GRID_COLS; gx++) {
      const zone = zones[gy][gx];
      const style = patterns[zone] || TERRAIN_ZONE_FALLBACK_COLOR[zone];
      if (style) {
        ctx.fillStyle = style;
        ctx.fillRect(gx * CELL_SIZE, gy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  ctx.strokeStyle = 'rgba(216, 216, 200, 0.08)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= GRID_COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL_SIZE, 0);
    ctx.lineTo(c * CELL_SIZE, GRID_ROWS * CELL_SIZE);
    ctx.stroke();
  }
  for (let r = 0; r <= GRID_ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL_SIZE);
    ctx.lineTo(GRID_COLS * CELL_SIZE, r * CELL_SIZE);
    ctx.stroke();
  }
}

const WALL_FILL = '#4a4a42';
const WALL_STROKE = '#6a6a5c';

// The 1-cell perimeter wall around the whole grid, with a gap on the left
// side for the gate — see the WALL_THICKNESS/GATE_* constants in state.js,
// which this draws from directly so the two can't drift out of sync.
function drawPerimeterWall(ctx) {
  const w = GRID_COLS * CELL_SIZE;
  const h = GRID_ROWS * CELL_SIZE;
  const t = WALL_THICKNESS;

  ctx.fillStyle = getTerrainPattern(ctx, 'wall') || WALL_FILL;
  ctx.strokeStyle = WALL_STROKE;
  ctx.lineWidth = 2;

  // top, bottom, right — no openings
  ctx.fillRect(0, 0, w, t);
  ctx.strokeRect(0, 0, w, t);
  ctx.fillRect(0, h - t, w, t);
  ctx.strokeRect(0, h - t, w, t);
  ctx.fillRect(w - t, 0, t, h);
  ctx.strokeRect(w - t, 0, t, h);

  // left wall, split above/below the gate gap
  ctx.fillRect(0, 0, t, GATE_Y_TOP);
  ctx.strokeRect(0, 0, t, GATE_Y_TOP);
  ctx.fillRect(0, GATE_Y_BOTTOM, t, h - GATE_Y_BOTTOM);
  ctx.strokeRect(0, GATE_Y_BOTTOM, t, h - GATE_Y_BOTTOM);

  drawGatehouse(ctx);
}

function drawGatehouse(ctx) {
  const x = 0, y = GATE_Y_TOP, w = WALL_THICKNESS, h = GATE_Y_BOTTOM - GATE_Y_TOP;
  const img = BUILDING_SPRITES.gatehouse;
  if (spriteReady(img)) {
    ctx.drawImage(img, x, y, w, h);
    return;
  }
  // fallback: a plain marked archway until real art exists
  ctx.fillStyle = '#8a7a5a';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#d8d8c8';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#1a1d14';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GATE', 0, 4);
  ctx.restore();
}

const ROAD_FILL = '#5a5548';
const ROAD_LINE = 'rgba(216, 216, 200, 0.25)';

// Draws the road network units actually walk on — see the ROADS comment in
// state.js. Spoke endpoints come straight from buildingDoor() on the row-1
// buildings, not hardcoded numbers, so this can't drift out of sync with
// the routing logic.
function drawRoads(ctx, gameState) {
  ctx.strokeStyle = getTerrainPattern(ctx, 'road') || ROAD_FILL;
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(gameState.bounds.minX, ROAD_Y_SPINE);
  ctx.lineTo(gameState.bounds.maxX, ROAD_Y_SPINE);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(GATE_INSIDE_X, GATE_Y_CENTER);
  ctx.lineTo(GATE_INSIDE_X, ROAD_Y_SPINE);
  ctx.stroke();

  // Every building that sits on a spoke — above the spine (row 1) or below
  // it (Showers/Rec Room, row 3, reusing spokes A/B). buildingDoor()/the
  // moveTo-to-lineTo pair below work identically in either direction, so
  // adding a below-spine building here is all drawing needs.
  const spokeBuildings = [gameState.barracks, gameState.shootingRange, gameState.messHall, gameState.showers, gameState.recRoom, gameState.entranceHall];
  for (const b of spokeBuildings) {
    const door = buildingDoor(b);
    ctx.beginPath();
    ctx.moveTo(door.x, ROAD_Y_SPINE);
    ctx.lineTo(door.x, door.y);
    ctx.stroke();
  }

  // dashed centerline on top, purely decorative (road-marking look)
  ctx.strokeStyle = ROAD_LINE;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);

  ctx.beginPath();
  ctx.moveTo(gameState.bounds.minX, ROAD_Y_SPINE);
  ctx.lineTo(gameState.bounds.maxX, ROAD_Y_SPINE);
  ctx.stroke();

  for (const b of spokeBuildings) {
    const door = buildingDoor(b);
    ctx.beginPath();
    ctx.moveTo(door.x, ROAD_Y_SPINE);
    ctx.lineTo(door.x, door.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

// --- "boxy and rough" polish pass ------------------------------------------
// Three cheap, code-only additions — no new art needed, nothing here touches
// Unit/GameState state, movement, or the road network:
//   1. A ground-contact shadow under every building and unit, so they read
//      as sitting on the ground instead of flat stickers pasted on the grid.
//   2. A small vertical bob while a unit is actually walking (on top of the
//      existing 2-frame walk-cycle swap) — gliding in a perfectly flat line
//      with zero vertical motion is what reads as robotic/stiff.
//   3. A per-status activity icon above a unit once it's truly arrived
//      (isAtTarget(), same gate as isSeatedCivilian()) plus a soft pulsing
//      glow on the building it's using — direct answer to "units don't
//      interact with buildings": previously a unit just stood at the door
//      with no visible link to what it was doing there.

const ACTIVITY_ICONS = {
  [UNIT_STATUS.EATING]: '🍖',
  [UNIT_STATUS.HYGIENE]: '🚿',
  [UNIT_STATUS.RECREATION]: '🎮',
  [UNIT_STATUS.SLEEPING]: '💤',
};

// Which of the 4 TrainingBuilding instances a unit is assigned to, as a
// short key — shared by the activity icon below and by
// trainingActionOffset()'s per-building animation, so both stay in sync off
// one lookup instead of two separately-maintained id comparisons.
function trainingBuildingKind(gameState, buildingId) {
  if (buildingId === gameState.shootingRange.id) return 'shootingRange';
  if (buildingId === gameState.weightRoom.id) return 'weightRoom';
  if (buildingId === gameState.obstacleCourse.id) return 'obstacleCourse';
  if (buildingId === gameState.drillYard.id) return 'drillYard';
  return null;
}

const TRAINING_ICONS = {
  shootingRange: '🎯',
  weightRoom: '🏋',
  obstacleCourse: '🏃',
  drillYard: '⚔️',
};

function trainingActivityIcon(gameState, buildingId) {
  return TRAINING_ICONS[trainingBuildingKind(gameState, buildingId)] || '🏋';
}

// A cheap substitute for dedicated action-pose art (aiming/firing, running,
// lifting, sparring) — reuses the existing static sprite with a small
// per-frame transform instead of new frames. Returns {dx, dy, rot, flash}
// in local sprite-space (px/px/radians/0-1 alpha) applied by drawUnit().
// `t` is performance.now(); phase is offset per-unit (colorSeed) so a full
// squad training together doesn't move in lockstep.
function trainingActionOffset(unit, kind, t) {
  const phase = t + unit.colorSeed * 37;
  switch (kind) {
    case 'shootingRange': {
      // Sharp, snappy recoil kick on a ~260ms cycle — deliberately NOT a
      // smooth sine, so it reads as a "kick" (firing) rather than a sway.
      // flash drives the muzzle-flash sprite below, same cycle.
      const cyclePos = (phase / 260) % 1;
      const kick = cyclePos < 0.15 ? 1 - cyclePos / 0.15 : 0;
      return { dx: -kick * 3, dy: -kick, rot: -kick * 0.06, flash: kick };
    }
    case 'weightRoom': {
      // Slow squat/rise rep cycle.
      const s = (Math.sin(phase / 500) + 1) / 2; // 0..1
      return { dx: 0, dy: -s * 3, rot: 0, flash: 0 };
    }
    case 'obstacleCourse': {
      // Fast running-in-place hop + forward lean.
      const s = Math.abs(Math.sin(phase / 130));
      return { dx: 0, dy: s * 4, rot: -0.08, flash: 0 };
    }
    case 'drillYard': {
      // Quick side-to-side sparring shuffle.
      const s = Math.sin(phase / 170);
      return { dx: s * 3, dy: 0, rot: s * 0.05, flash: 0 };
    }
    default:
      return { dx: 0, dy: 0, rot: 0, flash: 0 };
  }
}

// A small spark + tracer near the unit's hands, timed to the recoil kick
// above — the most literal answer to "men firing guns at the rifle range."
function drawMuzzleFlash(ctx, unit, actionDx, actionDy, alpha) {
  if (alpha <= 0) return;
  const facingLeft = unit.facing === 'left';
  const fx = unit.x + actionDx + (facingLeft ? -14 : 14);
  // Minus actionDy, not plus — matches the sign convention drawUnit()'s
  // sprite draw uses (positive actionDy = sprite moves up), so the flash
  // tracks the same recoil dip instead of moving opposite to it.
  const fy = unit.y - UNIT_H * 0.35 - actionDy;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fff2b0';
  ctx.beginPath();
  ctx.arc(fx, fy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 230, 150, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(fx + (facingLeft ? -18 : 18), fy - 4);
  ctx.stroke();
  ctx.restore();
}

// Mirrors GameState.routeForStatus()'s own status->building mapping, so this
// can't point at the wrong building even if that mapping ever changes.
function buildingForStatus(gameState, unit) {
  switch (unit.status) {
    case UNIT_STATUS.EATING: return gameState.messHall;
    case UNIT_STATUS.HYGIENE: return gameState.showers;
    case UNIT_STATUS.RECREATION: return gameState.recRoom;
    case UNIT_STATUS.SLEEPING: return gameState.barracks;
    case UNIT_STATUS.TRAINING: return gameState.buildingById(unit.assignedBuildingId);
    default: return null;
  }
}

// Only once a unit has actually finished walking there, not just been
// routed/assigned — same "arrived, not just close" gate isSeatedCivilian()
// already uses.
function activityIconForUnit(gameState, unit) {
  if (unit.isCivilian || !unit.isAtTarget()) return null;
  if (unit.status === UNIT_STATUS.TRAINING) return trainingActivityIcon(gameState, unit.assignedBuildingId);
  return ACTIVITY_ICONS[unit.status] || null;
}

function buildingIsActive(gameState, building) {
  return gameState.units.some(u => !u.isCivilian && u.isAtTarget() && buildingForStatus(gameState, u) === building);
}

function drawBuildingBox(ctx, gridX, gridY, isBuilt, label, subLabel, color, spriteKey, active) {
  const x = gridX * CELL_SIZE;
  const y = gridY * CELL_SIZE;
  const w = CELL_SIZE * BUILDING_FOOTPRINT_CELLS.w;
  const h = CELL_SIZE * BUILDING_FOOTPRINT_CELLS.h;

  if (!isBuilt) {
    // vacant_lot.png exists but is intentionally NOT drawn here — it was
    // generated as a rotated isometric diamond tile, which doesn't match
    // the flat 30-40°-top-down rectangular camera every other building
    // uses, so it looked like a mismatched floating shape rather than an
    // empty plot (user feedback: "there should just be empty spaces for
    // buildings not diamonds"). See ASSETS.md's respec for what a
    // corrected version needs to look like — until that's regenerated,
    // this plain dashed-outline "buyable plot" reads better than either
    // the diamond or a totally blank rectangle.
    ctx.fillStyle = 'rgba(106, 82, 58, 0.35)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(216, 216, 200, 0.4)';
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(216, 216, 200, 0.85)';
    ctx.font = '12px monospace';
    ctx.fillText(`${label} (not built)`, x + 8, y + h / 2);
    return;
  }

  // NOTE: a generic drop-shadow ellipse was tried here and reverted — the
  // building art already bakes in its own isometric ground platform/shadow
  // (see e.g. mess_hall.png's paved pad), so drawing a second, disconnected
  // shadow underneath it fought the art instead of complementing it: two
  // competing ground cues that don't line up, which read as the building
  // "balanced on a corner, floating" (user feedback) rather than grounded.
  // Units DON'T have a baked-in base, so their own shadow (drawUnit()) is
  // correct and stays — this is specifically a buildings-only revert.

  // Soft pulsing glow while occupied — the building-side half of the
  // "units don't interact with buildings" fix (activityIconForUnit() above
  // is the unit-side half). Drawn behind the sprite as a halo.
  if (active) {
    const pulse = 0.14 + 0.1 * Math.sin(performance.now() / 450);
    ctx.fillStyle = `rgba(242, 233, 168, ${pulse})`;
    ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  }

  const img = BUILDING_SPRITES[spriteKey];
  if (spriteReady(img)) {
    ctx.drawImage(img, x, y, w, h);
  } else {
    // fallback: original colored box until the sprite is available
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#8a9478';
    ctx.strokeRect(x, y, w, h);
  }

  // level + status text overlay (drawn on top of the art either way, with a
  // subtle shadow so it stays readable against the sprite)
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 3;
  ctx.fillStyle = '#d8d8c8';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(label, x + 8, y + 20);
  ctx.font = '11px monospace';
  ctx.fillText(subLabel, x + 8, y + 38);
  ctx.restore();
}

function drawBarracks(ctx, barracks, active) {
  drawBuildingBox(ctx, barracks.gridX, barracks.gridY, barracks.isBuilt,
    `Barracks Lv.${barracks.level}`, `+${barracks.capContribution()} cap`, '#5a6450', 'barracks', active);
}

// Shared drawer for the 4 TrainingBuilding instances (building.js) — they're
// all boxes with a level + occupancy label, just different labels/colors/art.
function drawTrainingBuilding(ctx, building, occupancy, label, color, spriteKey, active) {
  drawBuildingBox(ctx, building.gridX, building.gridY, building.isBuilt,
    `${label} Lv.${building.level}`, `${occupancy}/${building.capacity} slots`, color, spriteKey, active);
}

function drawMessHall(ctx, hall, food, active) {
  drawBuildingBox(ctx, hall.gridX, hall.gridY, hall.isBuilt,
    'Mess Hall', `Food: ${Math.floor(food)}`, '#40605a', 'mess_hall', active);
}

function drawShowers(ctx, showers, active) {
  drawBuildingBox(ctx, showers.gridX, showers.gridY, showers.isBuilt,
    'Showers', 'Hygiene', '#4a7a8a', 'showers', active);
}

function drawRecRoom(ctx, recRoom, active) {
  drawBuildingBox(ctx, recRoom.gridX, recRoom.gridY, recRoom.isBuilt,
    'Rec Room', 'Morale', '#8a6a4a', 'rec_room', active);
}

// Always isBuilt (see EntranceHall's class comment) — the "not built" branch
// of drawBuildingBox never actually triggers for this one, kept anyway for
// consistency with every other building's draw call. No occupancy concept
// here — civilians waiting for a chair isn't "a unit doing a job" — so it
// never gets the active glow.
function drawEntranceHall(ctx, hall) {
  drawBuildingBox(ctx, hall.gridX, hall.gridY, hall.isBuilt,
    'Entrance Hall', 'Waiting area', '#6a5a4a', 'entrance_hall', false);
}

function drawClock(ctx, hourOfDay, isDaytime) {
  const h = Math.floor(hourOfDay);
  const m = Math.floor((hourOfDay - h) * 60);
  const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${isDaytime ? '☀' : '☽'}`;
  ctx.fillStyle = '#d8d8c8';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(label, GRID_COLS * CELL_SIZE - 10, 18);
  ctx.textAlign = 'left';
}

function outfitMarker(outfit) {
  // small visual tag so civilians read as "bus rider / taxi / walking" at a glance
  switch (outfit) {
    case 'bus_rider': return '🚌';
    case 'taxi': return '🚕';
    case 'civilian': return '🚶';
    default: return null;
  }
}

function drawUnit(ctx, gameState, unit, isSelected) {
  const hue = unit.colorSeed;
  const inHospital = unit.status === UNIT_STATUS.HOSPITAL;
  const img = unitSprite(unit);
  const halfW = UNIT_W / 2;
  const top = unit.y - UNIT_H / 2;      // sprite top edge
  const bottom = unit.y + UNIT_H / 2;   // sprite bottom edge (feet)

  // Small vertical bob while actually walking, layered on top of the
  // existing 2-frame walk-cycle sprite swap — a unit gliding in a perfectly
  // flat line with zero vertical motion is what reads as robotic/stiff
  // ("characters don't walk properly" feedback). Purely cosmetic: derived
  // from performance.now(), never touches unit.x/y or anything persisted,
  // so it can't interact with movement/pathing or an offline-catchup dt jump.
  const walking = !unit.isAtTarget() && !isSeatedCivilian(unit);
  const now = performance.now();

  // Once actually training at a building (not just walking there), swap the
  // walking bob for a per-building action animation — see
  // trainingActionOffset() above. Answers "I want men firing guns at the
  // rifle range, running the obstacle course" without needing dedicated
  // action-pose art: the existing static sprite gets a small transform
  // (recoil kick / rep cycle / running hop / sparring shuffle) instead.
  const trainingKind = (!unit.isCivilian && unit.status === UNIT_STATUS.TRAINING && unit.isAtTarget())
    ? trainingBuildingKind(gameState, unit.assignedBuildingId)
    : null;

  let actionDx = 0, actionDy = 0, actionRot = 0, actionFlash = 0;
  if (walking) {
    actionDy = Math.sin(now / 110 + hue) * 2;
  } else if (trainingKind) {
    const action = trainingActionOffset(unit, trainingKind, now);
    actionDx = action.dx;
    actionDy = action.dy;
    actionRot = action.rot;
    actionFlash = action.flash;
  }

  ctx.save();
  ctx.globalAlpha = unit.status === UNIT_STATUS.CIVILIAN_LEAVING ? 0.5 : 1;

  // Ground-contact shadow, fixed at the feet regardless of bob — the sprite
  // visibly lifts off it as it bobs, same "grounds the sprite instead of a
  // flat sticker" fix as the building shadow in drawBuildingBox().
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(unit.x, bottom - 2, halfW * 0.75, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // selection highlight — soft ellipse under the feet
  if (isSelected) {
    ctx.fillStyle = 'rgba(242, 233, 168, 0.55)';
    ctx.beginPath();
    ctx.ellipse(unit.x, bottom - 2, halfW, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (spriteReady(img)) {
    // per-unit hue-shift is what makes each soldier distinguishable — the
    // sprites are intentionally desaturated so this rotates cleanly. In
    // uniform gets a saturation bump to "pop"; still-civilian-looking
    // (including RECRUITING, mid-walk-in) stays muted — dispatch on outfit,
    // not isCivilian, for the same reason as unitSprite() above.
    ctx.save();
    const sat = unit.outfit === 'uniform' ? 1.5 : 0.85;
    ctx.filter = `hue-rotate(${hue}deg) saturate(${sat})`;
    // Pivot at the feet (unit.x + actionDx, bottom) rather than the sprite's
    // top-left corner — a single transform pipeline (translate, then an
    // optional recoil/lean rotate, then an optional left-mirror) now covers
    // walking bob, training action animation, and facing all at once,
    // instead of three separately-coded branches. The sitting pose is a
    // single fixed orientation (facing forward, out of the chair) — it
    // doesn't turn to face unit.facing like the walking sprites do, so skip
    // the left-mirror for a seated civilian.
    ctx.translate(unit.x + actionDx, bottom);
    if (actionRot) ctx.rotate(actionRot);
    if (unit.facing === 'left' && !isSeatedCivilian(unit)) {
      // No dedicated 'left' art (see ASSETS.md) — mirror the 'right'
      // sprite around the pivot instead. Symmetric around x=0, so this
      // works the same regardless of the recoil/lean rotate above.
      ctx.scale(-1, 1);
    }
    ctx.drawImage(img, -halfW, -UNIT_H - actionDy, UNIT_W, UNIT_H);
    ctx.restore();
  } else {
    // fallback: original colored dot until the sprite loads
    const radius = unit.isCivilian ? 6 : 8;
    ctx.beginPath();
    ctx.arc(unit.x + actionDx, unit.y - actionDy, radius, 0, Math.PI * 2);
    ctx.fillStyle = unit.isCivilian
      ? `hsl(${hue}, 25%, 55%)`
      : `hsl(${hue}, 55%, 50%)`;
    ctx.fill();
  }

  if (actionFlash > 0) drawMuzzleFlash(ctx, unit, actionDx, actionDy, actionFlash);

  // hospital ring — the only status shown as a ring (a "problem" signal);
  // other statuses are shown via the text label so the canvas stays readable.
  if (inHospital) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#b4444a';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.ellipse(unit.x, unit.y, halfW + 3, UNIT_H / 2 + 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // activity icon — the unit-side half of the "units don't interact with
  // buildings" fix (buildingIsActive() above is the building-side glow).
  // Only shows once truly arrived (activityIconForUnit() gates on
  // isAtTarget()); drawn higher than the level-up star so both can show at
  // once without overlapping.
  const activityIcon = activityIconForUnit(gameState, unit);
  if (activityIcon) {
    const iconBob = Math.sin(performance.now() / 300 + hue) * 2;
    ctx.save();
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText(activityIcon, unit.x, top - 24 + iconBob);
    ctx.restore();
  }

  // level-up star — a soldier with unspentStatPoints > 0 has a stat point
  // waiting to be manually assigned (see the profile panel's "Allocate
  // stat points" section in main.js); the star is what makes that visible
  // without opening every soldier's profile to check.
  if (!unit.isCivilian && unit.unspentStatPoints > 0) {
    ctx.save();
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillStyle = '#f2e9a8';
    ctx.fillText('★', unit.x, top - 14);
    ctx.restore();
  }

  // label — soldiers always show name (that's the point); civilians show
  // their outfit marker so you can tell "bus rider" from "taxi" from "walk-in"
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  if (!unit.isCivilian) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillStyle = '#d8d8c8';
    ctx.fillText(unit.name.split(' ')[0], unit.x, top - 4);
    ctx.fillText(statusLabel(unit), unit.x, bottom + 12);
    ctx.restore();

    // tiny energy bar under the unit — low energy should be visible without
    // opening the profile panel, since that's what sends them to hospital.
    const barW = 20, barH = 3;
    const bx = unit.x - barW / 2, by = bottom + 15;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(bx, by, barW, barH);
    const pct = unit.energy / unit.maxEnergy;
    ctx.fillStyle = pct < 0.25 ? '#b4444a' : '#7fae4a';
    ctx.fillRect(bx, by, barW * pct, barH);
  } else {
    const marker = outfitMarker(unit.outfit);
    if (marker) ctx.fillText(marker, unit.x, top - 2);
  }
  ctx.textAlign = 'left';

  ctx.restore();
}

function statusLabel(unit) {
  switch (unit.status) {
    case UNIT_STATUS.RECRUITING: return 'enlisting';
    case UNIT_STATUS.TRAINING: return 'training';
    case UNIT_STATUS.EATING: return 'eating';
    case UNIT_STATUS.SLEEPING: return 'sleeping';
    case UNIT_STATUS.HYGIENE: return 'showering';
    case UNIT_STATUS.RECREATION: return 'recreation';
    case UNIT_STATUS.HOSPITAL: return 'hospital';
    default: return `Lv${unit.level}`;
  }
}

function renderFrame(ctx, gameState, selectedUnitId) {
  ctx.clearRect(0, 0, GRID_COLS * CELL_SIZE, GRID_ROWS * CELL_SIZE);
  drawGrid(ctx, gameState);
  drawPerimeterWall(ctx);
  drawRoads(ctx, gameState);
  drawBarracks(ctx, gameState.barracks, buildingIsActive(gameState, gameState.barracks));
  drawTrainingBuilding(ctx, gameState.shootingRange, gameState.occupancyOf(gameState.shootingRange), 'Shooting Range', '#6a5240', 'shooting_range', buildingIsActive(gameState, gameState.shootingRange));
  drawTrainingBuilding(ctx, gameState.weightRoom, gameState.occupancyOf(gameState.weightRoom), 'Weight Room', '#5a4a6a', 'weight_room', buildingIsActive(gameState, gameState.weightRoom));
  drawTrainingBuilding(ctx, gameState.obstacleCourse, gameState.occupancyOf(gameState.obstacleCourse), 'Obstacle Course', '#6a5a30', 'obstacle_course', buildingIsActive(gameState, gameState.obstacleCourse));
  drawTrainingBuilding(ctx, gameState.drillYard, gameState.occupancyOf(gameState.drillYard), 'Combat Drill Yard', '#4a5a6a', 'drill_yard', buildingIsActive(gameState, gameState.drillYard));
  drawMessHall(ctx, gameState.messHall, gameState.food, buildingIsActive(gameState, gameState.messHall));
  drawShowers(ctx, gameState.showers, buildingIsActive(gameState, gameState.showers));
  drawRecRoom(ctx, gameState.recRoom, buildingIsActive(gameState, gameState.recRoom));
  drawEntranceHall(ctx, gameState.entranceHall);
  drawClock(ctx, gameState.hourOfDay, gameState.isDaytime);

  for (const unit of gameState.units) {
    // Away on a mission — async/black-box by design (see mission.js), so
    // there's nothing to draw until they return.
    if (unit.status === UNIT_STATUS.ON_MISSION) continue;
    drawUnit(ctx, gameState, unit, unit.id === selectedUnitId);
  }
}
