// animation.js — picks what to draw for a person each frame from the frame
// sets described in js/asset-manifest.js, by identity (tint), direction,
// locomotion and activity:
//   - activity frames while standing on a slot whose activity has frames
//   - walk frames while moving, advanced by distance walked (one cycle per
//     `strideWorld` world px), so feet stay planted instead of skating
//   - idle frames when standing
// Any set that isn't drawn yet (`missing`) falls back to the directional
// still with a small bounce, so the game always renders. Candidate sets are
// only used with ?art=candidates, for review.

const ALLOW_CANDIDATE_ART = typeof location !== 'undefined' && /[?&]art=candidates\b/.test(location.search || '');

// Loaded strips for frame sets that are in use, keyed by manifest path.
const frameStripCache = new Map();
function frameStrip(entry) {
  if (!entry || !entry.file || !assetInUse(entry, ALLOW_CANDIDATE_ART)) return null;
  if (!frameStripCache.has(entry.file)) frameStripCache.set(entry.file, loadSprite(entry.file));
  const img = frameStripCache.get(entry.file);
  return spriteReady(img) ? img : null;
}

// Frame index for a looping set with per-frame durations (ms), offset per
// person so a squad doesn't move in lockstep.
function loopFrame(durations, now, offset) {
  const total = durations.reduce((a, b) => a + b, 0);
  let t = (now + offset) % total;
  for (let i = 0; i < durations.length; i++) {
    if (t < durations[i]) return i;
    t -= durations[i];
  }
  return 0;
}

// What to draw for this person now: an activity/walk frame from a strip,
// or null to use the directional still (render.js drawUnit).
function unitFramePose(unit, now) {
  if (unit.outfit !== 'uniform') return null;
  const sets = ASSET_MANIFEST.units.soldier;
  if (unit.slot && unit.routePhase === 'using' && unit.slot.activity) {
    const entry = sets.activities[unit.slot.activity];
    const strip = frameStrip(entry);
    if (strip) {
      const count = entry.frames.length;
      const index = loopFrame(entry.frameMs, now, unit.colorSeed * 37);
      return { strip, entry, index, count, tinted: false };
    }
  }
  // Walk: one cycle per strideWorld px travelled, from the direction's drawn
  // strip ('left' mirrors 'right' only when a right strip exists). Idle:
  // looping frames while standing. Directions not drawn yet keep the still.
  const moving = unit.path.length > 0 || Math.hypot(unit.targetX - unit.x, unit.targetY - unit.y) > 1;
  const direction = unit.facing === 'left' ? 'right' : unit.facing;
  const set = moving ? sets.walk : sets.idle;
  const entry = set && set.drawn && set.drawn[direction];
  const strip = frameStrip(entry);
  if (strip) {
    const count = entry.frames.length;
    const index = moving
      ? Math.floor((unit.walkDistance / set.strideWorld) * count) % count
      : loopFrame(entry.frameMs, now, unit.colorSeed * 53);
    return { strip, entry, index, count, tinted: entry.tint === 'hue', mirror: unit.facing === 'left' };
  }
  return null;
}

// The accent mask strip filled with one colour, cached per strip + colour.
const accentStripCache = new Map();
function accentStrip(entry, hex) {
  if (!entry.accentFile) return null;
  const mask = frameStrip({ ...entry, file: entry.accentFile });
  if (!mask) return null;
  const key = `${entry.accentFile}|${hex}`;
  if (!accentStripCache.has(key)) {
    const c = document.createElement('canvas');
    c.width = mask.naturalWidth; c.height = mask.naturalHeight;
    const g = c.getContext('2d');
    if (!g) return null;
    g.drawImage(mask, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = hex;
    g.fillRect(0, 0, c.width, c.height);
    accentStripCache.set(key, c);
  }
  return accentStripCache.get(key);
}

// Draws a strip frame with its pivot on the person's feet, scaled so the
// figure matches the standing height, then the soldier's chosen accent
// through the set's mask (helmet band and shoulder patch only). Returns
// false if nothing was drawn.
function drawFramePose(ctx, unit, pose) {
  const { entry, index, count } = pose;
  // Identity tint only for sets drawn in the neutral base palette.
  const strip = pose.tinted ? tintedSprite(pose.strip, unit.colorSeed, 1.5) : pose.strip;
  const frameW = strip.width / count, frameH = strip.height;
  // Pivot and figure height are in source px; `frames` sets were resampled.
  const sourceFrameH = entry.frames ? entry.frames[0][3] : frameH;
  const scale = frameH / sourceFrameH; // strip px per source px
  const worldPerStrip = (UNIT_H / (entry.pivot[1] - (entry.headroom || 20))) / scale;
  const w = frameW * worldPerStrip, h = frameH * worldPerStrip;
  const pivotX = entry.pivot[0] * scale * worldPerStrip, pivotY = entry.pivot[1] * scale * worldPerStrip;
  const accent = accentById(unit.accent);
  const layers = [strip, accent && accentStrip(entry, accent.hex)].filter(Boolean);
  for (const layer of layers) {
    const lw = layer.width / count; // same frame grid as the body strip
    if (pose.mirror) {
      ctx.save();
      ctx.translate(unit.x, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(layer, index * lw, 0, lw, layer.height, -pivotX, unit.y - pivotY, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(layer, index * lw, 0, lw, layer.height, unit.x - pivotX, unit.y - pivotY, w, h);
    }
  }
  // Effects are a separate layer, never baked into the frames.
  const flash = entry.effects && entry.effects.muzzleFlash;
  if (flash && flash.frame === index) {
    const fx = unit.x + (flash.at[0] - entry.pivot[0]) * scale * worldPerStrip;
    const fy = unit.y + (flash.at[1] - entry.pivot[1]) * scale * worldPerStrip;
    ctx.fillStyle = 'rgba(255, 214, 110, 0.95)';
    ctx.beginPath(); ctx.arc(fx, fy, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 244, 200, 0.9)';
    ctx.beginPath(); ctx.arc(fx, fy, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  return true;
}
