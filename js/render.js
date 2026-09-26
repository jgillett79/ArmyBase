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
  barracks: loadSprite('assets/buildings/barracks-organic.webp'),
  shooting_range: loadSprite('assets/buildings/shooting-range-organic.webp'),
  weight_room: loadSprite('assets/buildings/weight_room.png'),
  obstacle_course: loadSprite('assets/buildings/obstacle_course.png'),
  drill_yard: loadSprite('assets/buildings/drill_yard.png'),
  mess_hall: loadSprite('assets/buildings/mess-hall-organic.webp'),
  showers: loadSprite('assets/buildings/showers.png'),
  rec_room: loadSprite('assets/buildings/rec_room.png'),
  entrance_hall: loadSprite('assets/buildings/entrance-hall-organic.webp'),
  gatehouse: loadSprite('assets/buildings/gatehouse.png'),
  vacant_lot: loadSprite('assets/buildings/vacant_lot.png'),
};

// Tileable ground/wall/road textures — see ASSETS.md's "Terrain" section.
// Generated at 4x display size (same convention as every other sprite), so
// each pattern needs a 0.25 scale to tile at its actual in-game size.
// Apron and grass patterns are layered into continuous, uneven clearings.
const TERRAIN_SPRITES = {
  ground: loadSprite('assets/terrain/ground.png'),
  ground_apron: loadSprite('assets/terrain/ground_apron-v2.webp'),
  ground_grass: loadSprite('assets/terrain/ground_grass-v2.webp'),
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
    const scale = key === 'ground_apron' || key === 'ground_grass' ? 0.48 : TERRAIN_SCALE;
    pattern.setTransform(new DOMMatrix([scale, 0, 0, scale, 0, 0]));
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
function civilianSpriteSet(outfit) {
  const base = `assets/units/civilians/${outfit}`;
  return {
    down: loadSprite(`${base}_down.png`),
    up: loadSprite(`${base}_up.png`),
    right: loadSprite(`${base}_right.png`),
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
function unitSprite(unit) {
  const set = unitSpriteSet(unit);
  if (isSeatedCivilian(unit) && spriteReady(set.sitting)) {
    return set.sitting;
  }
  const dirKey = unit.facing === 'left' ? 'right' : unit.facing;
  const img = set[dirKey];
  return spriteReady(img) ? img : set.fallback;
}

// --- drawers --------------------------------------------------------------

// Continuous meadow and organic clearings replace the old square terrain zones.
function drawGrid(ctx, gameState) {
  const width = GRID_COLS * CELL_SIZE, height = GRID_ROWS * CELL_SIZE;
  ctx.fillStyle = getTerrainPattern(ctx, 'ground_grass') || '#78804e';
  ctx.fillRect(0, 0, width, height);
  // Uneven clearings belong to each plot. They exist before construction,
  // making a new building feel placed in a lived-in landscape rather than
  // revealing a square tile when it is purchased.
  const buildings = [gameState.barracks, gameState.shootingRange, gameState.messHall,
    gameState.weightRoom, gameState.obstacleCourse, gameState.drillYard,
    gameState.entranceHall, gameState.recRoom, gameState.showers];
  buildings.forEach((building, index) => {
    if (!building.isBuilt && !['barracks', 'shooting_range', 'mess_hall', 'entrance_hall'].includes(building.id)) return;
    const x = building.gridX * CELL_SIZE + 72;
    const y = building.gridY * CELL_SIZE + 48;
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= 32; i++) {
      const angle = i * Math.PI / 16;
      const irregularity = 1 + 0.06 * Math.sin(i * 2.4 + index * 4);
      const px = x + Math.cos(angle) * 93 * irregularity;
      const py = y + Math.sin(angle) * 65 * irregularity;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = getTerrainPattern(ctx, 'ground_apron') || '#9b906c';
    ctx.fillRect(x - 100, y - 72, 200, 144);
    ctx.restore();
  });
  ctx.fillStyle = 'rgba(20, 30, 19, 0.08)';
  ctx.fillRect(0, 0, width, height);
}

// The 1-cell perimeter wall around the whole grid, with a gap on the left
// side for the gate — see the WALL_THICKNESS/GATE_* constants in state.js,
// which this draws from directly so the two can't drift out of sync.
function drawPerimeterWall(ctx) {
  const w = GRID_COLS * CELL_SIZE;
  const h = GRID_ROWS * CELL_SIZE;
  // An irregular fence line encloses the base without outlining the canvas
  // as a rectangle. The walk bounds remain inset from every fence segment.
  const fence = [
    [[28, GATE_Y_TOP], [31, 172], [24, 72], [58, 34], [254, 27], [475, 30], [720, 21], [w - 31, 43]],
    [[w - 31, 43], [w - 26, 210], [w - 36, 409], [w - 34, h - 39], [710, h - 29], [450, h - 34], [219, h - 30], [32, h - 39], [28, GATE_Y_BOTTOM]],
  ];
  for (const points of fence) {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = 'rgba(42, 48, 31, 0.6)'; ctx.lineWidth = 7; ctx.stroke();
    ctx.strokeStyle = '#a89469'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#c3af80';
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1], [x1, y1] = points[i];
      const count = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 52));
      for (let j = 0; j <= count; j++) {
        const x = x0 + (x1 - x0) * j / count, y = y0 + (y1 - y0) * j / count;
        ctx.fillRect(x - 3, y - 5, 6, 10);
      }
    }
  }

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

// Draws the road network units actually walk on — see the ROADS comment in
// state.js. Spoke endpoints come straight from buildingDoor() on the row-1
// buildings, not hardcoded numbers, so this can't drift out of sync with
// the routing logic.
function drawRoads(ctx, gameState) {
  // The painted path follows the same spine and entrances as unit routing;
  // draw a dusty earth edge and center instead of a bright narrow pipe.
  const spokeBuildings = [gameState.barracks, gameState.shootingRange, gameState.messHall,
    gameState.weightRoom, gameState.obstacleCourse, gameState.drillYard,
    gameState.showers, gameState.recRoom, gameState.entranceHall]
    .filter(b => b.isBuilt || ['barracks', 'shooting_range', 'mess_hall'].includes(b.id));
  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(gameState.bounds.minX, roadYAt(gameState.bounds.minX));
    for (let x = gameState.bounds.minX + 12; x < gameState.bounds.maxX; x += 12) {
      ctx.lineTo(x, roadYAt(x));
    }
    ctx.lineTo(gameState.bounds.maxX, roadYAt(gameState.bounds.maxX));
    ctx.moveTo(GATE_INSIDE_X, GATE_Y_CENTER);
    ctx.lineTo(GATE_INSIDE_X, roadYAt(GATE_INSIDE_X));
    for (const b of spokeBuildings) {
      const door = buildingDoor(b);
      const pathY = roadYAt(door.x);
      ctx.moveTo(door.x, pathY);
      ctx.quadraticCurveTo(door.x + 4, (door.y + pathY) / 2, door.x, door.y);
    }
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  trace(); ctx.strokeStyle = 'rgba(77, 66, 45, 0.48)'; ctx.lineWidth = 29; ctx.stroke();
  trace(); ctx.strokeStyle = 'rgba(154, 119, 75, 0.92)'; ctx.lineWidth = 22; ctx.stroke();
  trace(); ctx.strokeStyle = 'rgba(194, 159, 103, 0.30)'; ctx.lineWidth = 10; ctx.stroke();
}

function drawBuildingBox(ctx, gridX, gridY, isBuilt, label, subLabel, color, spriteKey) {
  const x = gridX * CELL_SIZE;
  const y = gridY * CELL_SIZE;
  const w = CELL_SIZE * BUILDING_FOOTPRINT_CELLS.w;
  const h = CELL_SIZE * BUILDING_FOOTPRINT_CELLS.h;

  if (!isBuilt) {
    if (!['barracks', 'shooting_range', 'mess_hall'].includes(spriteKey)) return;
    // An empty plot is a clearing with a survey stake, not a repeated
    // rectangular slab. The build menu still carries the full name/cost.
    ctx.save();
    ctx.fillStyle = 'rgba(42, 44, 31, 0.28)';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * 0.72, 34, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#927c53';
    ctx.fillRect(x + w / 2 - 2, y + h * 0.47, 4, 30);
    ctx.fillStyle = '#d5c69e';
    ctx.fillRect(x + w / 2 - 21, y + h * 0.43, 42, 18);
    ctx.fillStyle = '#3a3b2d';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('+', x + w / 2, y + h * 0.57);
    ctx.restore();
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

  // Keep names off the roofs; a small plaque leaves the building silhouette
  // visible at game zoom. Upgrade/occupancy details live in the build panel.
  ctx.save();
  ctx.fillStyle = 'rgba(33, 43, 34, 0.83)';
  ctx.fillRect(x + 15, y + h - 16, w - 30, 16);
  ctx.fillStyle = '#f1e9d4';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label.replace(/ Lv\.\d+$/, ''), x + w / 2, y + h - 4);
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

function drawShowers(ctx, showers) {
  drawBuildingBox(ctx, showers.gridX, showers.gridY, showers.isBuilt,
    'Showers', 'Hygiene', '#4a7a8a', 'showers');
}

function drawRecRoom(ctx, recRoom) {
  drawBuildingBox(ctx, recRoom.gridX, recRoom.gridY, recRoom.isBuilt,
    'Rec Room', 'Morale', '#8a6a4a', 'rec_room');
}

// Always isBuilt (see EntranceHall's class comment) — the "not built" branch
// of drawBuildingBox never actually triggers for this one, kept anyway for
// consistency with every other building's draw call.
function drawEntranceHall(ctx, hall) {
  drawBuildingBox(ctx, hall.gridX, hall.gridY, hall.isBuilt,
    'Entrance Hall', 'Waiting area', '#6a5a4a', 'entrance_hall');
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
  const moving = !inHospital && !isSeatedCivilian(unit) &&
    (unit.path.length > 0 || Math.hypot(unit.targetX - unit.x, unit.targetY - unit.y) > 1);
  const stride = moving ? Math.sin(performance.now() * 0.014 + unit.colorSeed) : 0;

  ctx.save();
  ctx.globalAlpha = unit.status === UNIT_STATUS.CIVILIAN_LEAVING ? 0.5 : 1;
  ctx.fillStyle = moving ? 'rgba(8, 20, 17, 0.22)' : 'rgba(8, 20, 17, 0.32)';
  ctx.beginPath();
  ctx.ellipse(unit.x, bottom - 1, moving ? 11 : 9, 3, 0, 0, Math.PI * 2);
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
    // The sitting pose is a single fixed orientation (facing forward, out
    // of the chair) — it doesn't turn to face unit.facing like the
    // walking sprites do, so skip the left-mirror for a seated civilian.
    if (unit.facing === 'left' && !isSeatedCivilian(unit)) {
      // No dedicated 'left' art (see ASSETS.md) — mirror the 'right'
      // sprite around the unit's own draw position instead.
      ctx.translate(unit.x + halfW, top + (moving ? -Math.abs(stride) * 1.5 : 0));
      ctx.scale(-1, 1);
      drawWalkingSprite(ctx, img);
    } else {
      ctx.translate(unit.x - halfW, top + (moving ? -Math.abs(stride) * 1.5 : 0));
      drawWalkingSprite(ctx, img);
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

// Keep the figure intact while moving. Cutting two "legs" out of still art
// distorted uniforms and looked like skating; authored frame sets will
// replace this complete-pose fallback in the character production pass.
function drawWalkingSprite(ctx, img) {
  ctx.drawImage(img, 0, 0, UNIT_W, UNIT_H);
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

// A facility only shows activity after a soldier reaches its door. This uses
// the same status/arrival conditions as the simulation, so a soldier walking
// towards training never appears to be training already.
function activeFacilityFor(unit, gameState) {
  if (unit.isCivilian || !unit.isAtTarget()) return null;
  switch (unit.status) {
    case UNIT_STATUS.TRAINING: {
      const building = gameState.buildingById(unit.assignedBuildingId);
      return building && building.isBuilt ? building : null;
    }
    case UNIT_STATUS.EATING: return gameState.messHall.isBuilt ? gameState.messHall : null;
    case UNIT_STATUS.HYGIENE: return gameState.showers.isBuilt ? gameState.showers : null;
    case UNIT_STATUS.RECREATION: return gameState.recRoom.isBuilt ? gameState.recRoom : null;
    case UNIT_STATUS.SLEEPING: return gameState.barracks.isBuilt ? gameState.barracks : null;
    default: return null;
  }
}

function drawFacilityActivity(ctx, unit, gameState, now) {
  const building = activeFacilityFor(unit, gameState);
  if (!building) return;
  const door = buildingDoor(building);
  // Some older saves may contain a stationary unit elsewhere; do not show
  // activity until the unit is actually at this building.
  if (Math.hypot(unit.x - door.x, unit.y - door.y) > 25) return;

  const phase = now * 0.005 + unit.colorSeed;
  const pulse = (Math.sin(phase) + 1) / 2;
  const x = unit.x, y = unit.y - UNIT_H / 2;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 2;

  if (unit.status === UNIT_STATUS.TRAINING) {
    if (building.id === 'shooting_range') {
      // Small target above the working soldier; the center pulses on a hit.
      ctx.strokeStyle = '#e9d5aa';
      ctx.beginPath(); ctx.arc(x + 17, y - 8, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ad6050';
      ctx.beginPath(); ctx.arc(x + 17, y - 8, 2 + pulse, 0, Math.PI * 2); ctx.stroke();
    } else if (building.id === 'weight_room' || building.id === 'drill_yard') {
      const lift = pulse * 4;
      ctx.strokeStyle = '#d1c7a9';
      ctx.beginPath(); ctx.moveTo(x - 12, y - 7 - lift); ctx.lineTo(x + 12, y - 7 - lift); ctx.stroke();
      ctx.fillStyle = '#465b58';
      ctx.fillRect(x - 13, y - 11 - lift, 3, 8);
      ctx.fillRect(x + 10, y - 11 - lift, 3, 8);
    } else {
      ctx.strokeStyle = '#e5d6b0';
      ctx.beginPath();
      ctx.moveTo(x - 10, y - 4); ctx.lineTo(x + 9, y - 4);
      ctx.moveTo(x + 9, y - 4); ctx.lineTo(x + 5, y - 8);
      ctx.stroke();
      ctx.fillStyle = '#d9a35c';
      ctx.beginPath(); ctx.arc(x - 7 + pulse * 13, y - 9, 2, 0, Math.PI * 2); ctx.fill();
    }
  } else if (unit.status === UNIT_STATUS.EATING) {
    ctx.fillStyle = '#ead7ad';
    ctx.beginPath(); ctx.ellipse(x + 12, y - 3, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#f0e9d8';
    for (let i = 0; i < 2; i++) {
      ctx.beginPath(); ctx.moveTo(x + 9 + i * 5, y - 8);
      ctx.quadraticCurveTo(x + 5 + i * 5 + pulse * 3, y - 15, x + 11 + i * 5, y - 19); ctx.stroke();
    }
  } else if (unit.status === UNIT_STATUS.HYGIENE) {
    ctx.fillStyle = '#8ec9c9';
    for (let i = 0; i < 3; i++) {
      const fall = (pulse * 9 + i * 4) % 12;
      ctx.beginPath(); ctx.arc(x - 9 + i * 9, y - 17 + fall, 2, 0, Math.PI * 2); ctx.fill();
    }
  } else if (unit.status === UNIT_STATUS.RECREATION) {
    ctx.fillStyle = '#e9ce91';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('♪', x + 10, y - 9 - pulse * 5);
  } else if (unit.status === UNIT_STATUS.SLEEPING) {
    ctx.fillStyle = '#c5d5d0';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('z', x + 10, y - 8 - pulse * 5);
  }
  ctx.restore();
}

function renderFrame(ctx, gameState, selectedUnitId) {
  ctx.clearRect(0, 0, GRID_COLS * CELL_SIZE, GRID_ROWS * CELL_SIZE);
  drawGrid(ctx, gameState);
  drawPerimeterWall(ctx);
  drawRoads(ctx, gameState);
  drawBarracks(ctx, gameState.barracks);
  drawTrainingBuilding(ctx, gameState.shootingRange, gameState.occupancyOf(gameState.shootingRange), 'Shooting Range', '#6a5240', 'shooting_range');
  drawTrainingBuilding(ctx, gameState.weightRoom, gameState.occupancyOf(gameState.weightRoom), 'Weight Room', '#5a4a6a', 'weight_room');
  drawTrainingBuilding(ctx, gameState.obstacleCourse, gameState.occupancyOf(gameState.obstacleCourse), 'Obstacle Course', '#6a5a30', 'obstacle_course');
  drawTrainingBuilding(ctx, gameState.drillYard, gameState.occupancyOf(gameState.drillYard), 'Combat Drill Yard', '#4a5a6a', 'drill_yard');
  drawMessHall(ctx, gameState.messHall, gameState.food);
  drawShowers(ctx, gameState.showers);
  drawRecRoom(ctx, gameState.recRoom);
  drawEntranceHall(ctx, gameState.entranceHall);
  drawClock(ctx, gameState.hourOfDay, gameState.isDaytime);

  for (const unit of gameState.units) {
    // Away on a mission — async/black-box by design (see mission.js), so
    // there's nothing to draw until they return.
    if (unit.status === UNIT_STATUS.ON_MISSION) continue;
    drawUnit(ctx, unit, unit.id === selectedUnitId);
    drawFacilityActivity(ctx, unit, gameState, performance.now());
  }
}
