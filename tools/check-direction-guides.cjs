// Checks the Brief 09 up/right anatomical guides (art/rig/brief09/) against
// the RUNTIME walk: the frame selection in js/animation.js, the drawing scale
// in drawFramePose, the facing rules in js/unit.js and the accepted down
// master (art/rig/soldier_walk_down_painted_v3.json). Geometry only — it
// reads the guides' recorded contact points, not painted pixels.
//
//   node tools/check-direction-guides.cjs [out.json]
//
// A soldier is walked in a straight line in each direction; for every
// 0.05 world px of travel it computes which frame the runtime shows and
// where each recorded sole lands in the WORLD. It reports:
//   - frame-start error: planted sole movement between successive frame
//     starts of one stance (must be 0 — the guides' signed cancellation)
//   - within-frame drift: how far a planted sole moves while one frame is
//     held (the runtime draws the body at its continuous position, so this
//     is stride / frames for any 6-frame cycle; reported, not a guide fault)
//   - footprint spacing, lead-leg alternation, pivot/cell/density agreement
//     with the runtime and the down master.
// Guides stay out of the game: nothing here touches ASSET_MANIFEST.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const ctx = vm.createContext({ console });
for (const f of ['utils', 'world', 'asset-manifest']) vm.runInContext(fs.readFileSync(path.join(root, 'js', `${f}.js`), 'utf8'), ctx);
const manifest = vm.runInContext('ASSET_MANIFEST', ctx);
const walkSet = manifest.units.soldier.walk;
const downEntry = walkSet.drawn.down;

const UNIT_H = manifest.unitWorldHeight;                   // 44 world px
const RUNTIME_SOURCE_PX_PER_WORLD = (downEntry.pivot[1] - downEntry.headroom) / UNIT_H; // drawFramePose's rule
const FRAMES = walkSet.framesPerDirection, STRIDE = walkSet.strideWorld;

const guides = {
  right: read('art/rig/brief09/soldier_walk_right_anatomical_guide.json'),
  up: read('art/rig/brief09/soldier_walk_up_anatomical_guide.json'),
};
const idles = {
  right: read('art/rig/brief09/soldier_idle_right_anatomical_guide.json'),
  up: read('art/rig/brief09/soldier_idle_up_anatomical_guide.json'),
};
const down = read('art/rig/soldier_walk_down_painted_v3.json');

// World direction of travel and the screen axis it moves along.
const MOTION = { right: { axis: 'x', sign: 1 }, up: { axis: 'y', sign: -1 }, down: { axis: 'y', sign: 1 } };

// Runtime frame index for a walked distance (js/animation.js unitFramePose).
const frameAt = d => Math.floor((d / STRIDE) * FRAMES) % FRAMES;

function analyse(direction, guide, pxPerWorld) {
  const { axis, sign } = MOTION[direction];
  const pivot = guide.pivot;
  const problems = [];
  const sole = (frame, foot) => guide.track[frame][foot];
  const feet = Object.keys(guide.track[0]);
  // World position of a sole: body + (local - pivot) / density, on the travel axis.
  const world = (d, frame, foot) => sign * d + (sole(frame, foot)[axis] - pivot[axis === 'x' ? 0 : 1]) / pxPerWorld;

  // Signed cancellation between frame starts within each stance.
  const step = STRIDE / FRAMES;
  const stanceErrors = [];
  for (let k = 0; k < FRAMES; k++) {
    const next = (k + 1) % FRAMES;
    for (const foot of feet) {
      if (!sole(k, foot).planted || !sole(next, foot).planted) continue;
      const err = world((k + 1) * step, next, foot) - world(k * step, k, foot);
      stanceErrors.push({ from: k + 1, to: next + 1, foot, errorWorld: +err.toFixed(3), errorSourcePx: +(err * pxPerWorld).toFixed(2) });
      if (Math.abs(err) > 0.05) problems.push(`${direction}: ${foot} sole slips ${err.toFixed(2)} world px from frame ${k + 1} to ${next + 1} (sign or magnitude wrong)`);
    }
  }
  // Continuous playback: drift of a planted sole while a frame is held.
  let maxDrift = 0;
  for (let k = 0; k < FRAMES; k++) for (const foot of feet) {
    if (!sole(k, foot).planted) continue;
    const a = world(k * step, k, foot), b = world((k + 1) * step - 1e-6, k, foot);
    maxDrift = Math.max(maxDrift, Math.abs(b - a));
  }
  // Footprints: world position of each new plant over two cycles.
  const plants = [];
  for (let k = 0; k < FRAMES * 2; k++) {
    const f = k % FRAMES, prev = (k + FRAMES - 1) % FRAMES;
    for (const foot of feet) if (sole(f, foot).planted && !sole(prev, foot).planted) plants.push({ frame: f + 1, foot, at: +world(k * step, f, foot).toFixed(2) });
  }
  const spacing = plants.slice(1).map((p, i) => +(p.at - plants[i].at).toFixed(2));
  if (spacing.some(s => Math.abs(Math.abs(s) - STRIDE / 2) > 0.2)) problems.push(`${direction}: footprints ${spacing.join(', ')} world px apart, expected ${STRIDE / 2}`);
  if (plants.length >= 2 && plants[0].foot === plants[1].foot) problems.push(`${direction}: the same foot plants twice in a row`);
  // Exactly one planted foot at the two contact frames, and they differ.
  const plantedAt = k => feet.filter(f => sole(k, f).planted);
  const contact1 = plantedAt(0), contact4 = plantedAt(3);
  if (contact1.length !== 1 || contact4.length !== 1 || contact1[0] === contact4[0]) problems.push(`${direction}: frames 1 and 4 must plant opposite feet (got ${contact1} / ${contact4})`);
  // Lead leg at the contact frames: the foot furthest forward along travel.
  const lead = k => feet.slice().sort((a, b) => sign * (sole(k, b)[axis] - sole(k, a)[axis]))[0];
  const leads = [lead(0), lead(3)];
  if (direction !== 'down' && leads[0] === leads[1]) problems.push(`${direction}: the same leg leads in frames 1 and 4`);
  return { stanceErrors, maxWithinFrameDriftWorld: +maxDrift.toFixed(3), maxWithinFrameDriftSourcePx: +(maxDrift * pxPerWorld).toFixed(1),
    plants, spacing, contact1: contact1[0], contact4: contact4[0], leads, problems };
}

const report = { runtime: {
  unitWorldHeight: UNIT_H, framesPerDirection: FRAMES, strideWorld: STRIDE, worldPxPerFrame: +(STRIDE / FRAMES).toFixed(4),
  sourcePxPerWorldFromPivotAndHeadroom: RUNTIME_SOURCE_PX_PER_WORLD, downPivot: downEntry.pivot, downHeadroom: downEntry.headroom,
  downExportFrameHeight: downEntry.output.frameHeight,
  downExportPxPerWorld: +(downEntry.output.frameHeight / downEntry.frames[0][3] * RUNTIME_SOURCE_PX_PER_WORLD).toFixed(3),
  fixed3xFrameHeight: +(3 / RUNTIME_SOURCE_PX_PER_WORLD * 384).toFixed(2),
  facing: 'dominant axis of each movement step (unit.js updateFacing); left mirrors the right strip (animation.js)',
}, directions: {}, idle: {}, problems: [] };

for (const [dir, guide] of Object.entries(guides)) {
  const checks = [];
  if (guide.cell[0] !== 256 || guide.cell[1] !== 384) checks.push(`${dir}: cell ${guide.cell} is not 256 x 384`);
  if (guide.pivot[0] !== downEntry.pivot[0] || guide.pivot[1] !== downEntry.pivot[1]) checks.push(`${dir}: pivot ${guide.pivot} differs from the runtime down pivot ${downEntry.pivot}`);
  if (Math.abs(guide.sourcePxPerWorld - RUNTIME_SOURCE_PX_PER_WORLD) > 1e-9) checks.push(`${dir}: ${guide.sourcePxPerWorld} source px/world differs from the runtime's ${RUNTIME_SOURCE_PX_PER_WORLD}`);
  if (guide.strideWorld !== STRIDE || guide.frames !== FRAMES) checks.push(`${dir}: stride/frames ${guide.strideWorld}/${guide.frames} differ from the runtime ${STRIDE}/${FRAMES}`);
  const result = analyse(dir, guide, RUNTIME_SOURCE_PX_PER_WORLD);
  result.problems.unshift(...checks);
  report.directions[dir] = result;
  report.problems.push(...result.problems);
}
// The accepted down master through the same maths (screen-half labels).
report.directions.down_master = analyse('down', { ...down, track: down.track }, down.pxPerWorld);
report.problems.push(...report.directions.down_master.problems.filter(p => !/lead/.test(p)));

// Anatomical identity across turns. The runtime keeps the frame index
// (walkDistance) when a soldier turns, so frames 1-3 must plant the SAME
// anatomical foot in every direction, or a turn swaps legs mid-stance.
// down master: front view, the soldier's right foot is on screen-left;
// up: back view, the soldier's right is on screen-right; right view: the
// guide's labels are anatomical (near leg = right).
const plantedF1 = track => Object.entries(track[0]).find(([, p]) => p.planted);
const downF1 = plantedF1(down.track)[1].x < down.pivot[0] ? 'right' : 'left';
const upRightOnScreenRight = guides.up.track.every(t => t.right.x > guides.up.pivot[0] && t.left.x < guides.up.pivot[0]);
report.identity = { downFrames1to3: downF1, rightFrames1to3: plantedF1(guides.right.track)[0], upFrames1to3: plantedF1(guides.up.track)[0],
  upRightLegOnScreenRight: upRightOnScreenRight };
if (!upRightOnScreenRight) report.problems.push('up (back view): the soldier\'s right leg must be on screen-right (x > 128)');
if (new Set([report.identity.downFrames1to3, report.identity.rightFrames1to3, report.identity.upFrames1to3]).size !== 1) {
  report.problems.push(`frames 1-3 plant different anatomical feet (down ${downF1}, right ${report.identity.rightFrames1to3}, up ${report.identity.upFrames1to3}): a turn would swap legs mid-stance`);
}

for (const [dir, idle] of Object.entries(idles)) {
  const grounded = idle.feet.every(([, , planted]) => planted);
  const rows = idle.feet.map(([, y]) => y);
  report.idle[dir] = { feet: idle.feet, bothGrounded: grounded, soleRows: rows };
  if (!grounded) report.problems.push(`${dir} idle: a foot is not grounded`);
}

const out = process.argv[2];
if (out) fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
const fmt = r => `stance error max ${Math.max(...r.stanceErrors.map(s => Math.abs(s.errorWorld)))} world px; footprints ${r.spacing.join(', ')}; contact feet ${r.contact1}/${r.contact4}; within-frame drift ${r.maxWithinFrameDriftWorld} world px (${r.maxWithinFrameDriftSourcePx} source px)`;
for (const [dir, r] of Object.entries(report.directions)) console.log(`${dir.padEnd(12)} ${fmt(r)}`);
console.log(`runtime density ${RUNTIME_SOURCE_PX_PER_WORLD.toFixed(3)} source px/world; down export ${report.runtime.downExportFrameHeight} px frames = ${report.runtime.downExportPxPerWorld} px/world; 3 px/world = ${report.runtime.fixed3xFrameHeight} px frames`);
if (report.problems.length) { console.log('PROBLEMS:\n- ' + report.problems.join('\n- ')); process.exit(1); }
console.log('Direction guides agree with the runtime walk geometry (guides only; no painted art checked)');
