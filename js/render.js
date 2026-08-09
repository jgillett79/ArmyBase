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
  gatehouse: loadSprite('assets/buildings/gatehouse.png'),
  vacant_lot: loadSprite('assets/buildings/vacant_lot.png'),
};

// Tileable ground/wall/road textures — see ASSETS.md's "Terrain" section.
// Generated at 4x display size (same convention as every other sprite), so
// each pattern needs a 0.25 scale to tile at its actual in-game size.
const TERRAIN_SPRITES = {
  ground: loadSprite('assets/terrain/ground.png'),
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
function civilianSpriteSet(outfit) {
  const base = `assets/units/civilians/${outfit}`;
  return {
    down: loadSprite(`${base}_down.png`),
    up: loadSprite(`${base}_up.png`),
    right: loadSprite(`${base}_right.png`),
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

// Picks the directional image for unit.facing ('left' reuses 'right' — see
// drawUnit(), which mirrors it) and falls back to the older single-pose
// sprite if that specific direction hasn't loaded yet.
function unitSprite(unit) {
  const set = unitSpriteSet(unit);
  const dirKey = unit.facing === 'left' ? 'right' : unit.facing;
  const img = set[dirKey];
  return spriteReady(img) ? img : set.fallback;
}

// --- drawers --------------------------------------------------------------

function drawGrid(ctx) {
  const groundPattern = getTerrainPattern(ctx, 'ground');
  if (groundPattern) {
    ctx.fillStyle = groundPattern;
    ctx.fillRect(0, 0, GRID_COLS * CELL_SIZE, GRID_ROWS * CELL_SIZE);
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

  const row1Buildings = [gameState.barracks, gameState.shootingRange, gameState.messHall];
  for (const b of row1Buildings) {
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

  for (const b of row1Buildings) {
    const door = buildingDoor(b);
    ctx.beginPath();
    ctx.moveTo(door.x, ROAD_Y_SPINE);
    ctx.lineTo(door.x, door.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawBuildingBox(ctx, gridX, gridY, isBuilt, label, subLabel, color, spriteKey) {
  const x = gridX * CELL_SIZE;
  const y = gridY * CELL_SIZE;
  const w = CELL_SIZE * BUILDING_FOOTPRINT_CELLS.w;
  const h = CELL_SIZE * BUILDING_FOOTPRINT_CELLS.h;

  if (!isBuilt) {
    const lotImg = BUILDING_SPRITES.vacant_lot;
    if (spriteReady(lotImg)) {
      ctx.drawImage(lotImg, x, y, w, h);
    } else {
      // fallback: a cleared/foundation-dirt lot, not just an empty outline —
      // reads as "buyable plot" rather than "nothing here yet"
      ctx.fillStyle = 'rgba(106, 82, 58, 0.35)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(216, 216, 200, 0.4)';
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
    ctx.fillStyle = 'rgba(216, 216, 200, 0.85)';
    ctx.font = '12px monospace';
    ctx.fillText(`${label} (not built)`, x + 8, y + h / 2);
    return;
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

function drawBarracks(ctx, barracks) {
  drawBuildingBox(ctx, barracks.gridX, barracks.gridY, barracks.isBuilt,
    `Barracks Lv.${barracks.level}`, `+${barracks.capContribution()} cap`, '#5a6450', 'barracks');
}

// Shared drawer for the 4 TrainingBuilding instances (building.js) — they're
// all boxes with a level + occupancy label, just different labels/colors/art.
function drawTrainingBuilding(ctx, building, occupancy, label, color, spriteKey) {
  drawBuildingBox(ctx, building.gridX, building.gridY, building.isBuilt,
    `${label} Lv.${building.level}`, `${occupancy}/${building.capacity} slots`, color, spriteKey);
}

function drawMessHall(ctx, hall, food) {
  drawBuildingBox(ctx, hall.gridX, hall.gridY, hall.isBuilt,
    'Mess Hall', `Food: ${Math.floor(food)}`, '#40605a', 'mess_hall');
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

function drawUnit(ctx, unit, isSelected) {
  const hue = unit.colorSeed;
  const inHospital = unit.status === UNIT_STATUS.HOSPITAL;
  const img = unitSprite(unit);
  const halfW = UNIT_W / 2;
  const top = unit.y - UNIT_H / 2;      // sprite top edge
  const bottom = unit.y + UNIT_H / 2;   // sprite bottom edge (feet)

  ctx.save();
  ctx.globalAlpha = unit.status === UNIT_STATUS.CIVILIAN_LEAVING ? 0.5 : 1;

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
    if (unit.facing === 'left') {
      // No dedicated 'left' art (see ASSETS.md) — mirror the 'right'
      // sprite around the unit's own draw position instead.
      ctx.translate(unit.x + halfW, top);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, UNIT_W, UNIT_H);
    } else {
      ctx.drawImage(img, unit.x - halfW, top, UNIT_W, UNIT_H);
    }
    ctx.restore();
  } else {
    // fallback: original colored dot until the sprite loads
    const radius = unit.isCivilian ? 6 : 8;
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = unit.isCivilian
      ? `hsl(${hue}, 25%, 55%)`
      : `hsl(${hue}, 55%, 50%)`;
    ctx.fill();
  }

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
    case UNIT_STATUS.HOSPITAL: return 'hospital';
    default: return `Lv${unit.level}`;
  }
}

function renderFrame(ctx, gameState, selectedUnitId) {
  ctx.clearRect(0, 0, GRID_COLS * CELL_SIZE, GRID_ROWS * CELL_SIZE);
  drawGrid(ctx);
  drawPerimeterWall(ctx);
  drawRoads(ctx, gameState);
  drawBarracks(ctx, gameState.barracks);
  drawTrainingBuilding(ctx, gameState.shootingRange, gameState.occupancyOf(gameState.shootingRange), 'Shooting Range', '#6a5240', 'shooting_range');
  drawTrainingBuilding(ctx, gameState.weightRoom, gameState.occupancyOf(gameState.weightRoom), 'Weight Room', '#5a4a6a', 'weight_room');
  drawTrainingBuilding(ctx, gameState.obstacleCourse, gameState.occupancyOf(gameState.obstacleCourse), 'Obstacle Course', '#6a5a30', 'obstacle_course');
  drawTrainingBuilding(ctx, gameState.drillYard, gameState.occupancyOf(gameState.drillYard), 'Combat Drill Yard', '#4a5a6a', 'drill_yard');
  drawMessHall(ctx, gameState.messHall, gameState.food);
  drawClock(ctx, gameState.hourOfDay, gameState.isDaytime);

  for (const unit of gameState.units) {
    drawUnit(ctx, unit, unit.id === selectedUnitId);
  }
}
