// Task 3: measurements of the idle-to-walk start study (preview only).
//   node tools/blender/measure-start.cjs <start motion-report> <start-inspection> <48 motion-report> <48 rig-inspection> <out.json>
// Root curve (same formulas as tools/blender-walk-readability.html): a weight
// shift, then root travel D px with smoothstep speed 0 -> 38 px/s; handover at
// loop phase 0.5; thereafter frames by distance (48 phases, nearest).
// Contacts use the DEFORMED geometry from inspect_walk_study.py: the right
// support's sole centroid while flat and its front edge in heel-off; the left
// sole while planted in the shift.
const fs = require('node:fs');
const [smr, sin, lmr, lin, out] = process.argv.slice(2);
if (!out) { console.error('usage: measure-start.cjs <start-report> <start-inspection> <48-report> <48-inspection> <out.json>'); process.exit(2); }
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const S = read(smr), SI = read(sin), L = read(lmr), LI = read(lin);
const WPM = 23.3165, SPEED = 38, STRIDE = 22, N = 48;
const info = S.start, D_PX = S.cycleMetres / 4 * WPM, SHIFT = info.shiftSeconds, TRAVEL = 2 * D_PX / SPEED, END = SHIFT + TRAVEL;
const startPx = t => t <= SHIFT ? 0 : D_PX * (2 * Math.min(1, (t - SHIFT) / TRAVEL) ** 3 - Math.min(1, (t - SHIFT) / TRAVEL) ** 4);
const speed = t => t <= SHIFT ? 0 : SPEED * (3 * Math.min(1, (t - SHIFT) / TRAVEL) ** 2 - 2 * Math.min(1, (t - SHIFT) / TRAVEL) ** 3);
const startFrameAt = t => info.firstFrame + Math.max(0, Math.min(info.rows.length - 1, Math.round((t <= SHIFT ? t : SHIFT + (t - SHIFT) / TRAVEL * info.travelSeconds) * info.fps)));
const sRow = f => info.rows[f - info.firstFrame], sIns = f => SI.frames.find(r => r.frame === f);
const lRow = f => L.frames[f - 1], lIns = f => LI.frames[f - 1];
// Deformed local contact depth (forward +, metres): -(worldY + travel of that frame).
const depth = (ins, row, side, kind) => -((kind === 'toe' ? ins[side].toeEdgeWorldY : ins[side].soleWorldY) + row.virtualTravelMetres);

// Simulate: start, then 0.5 s of walking.
const dt = 1 / 960, samples = [];
let rFlat = [], rToe = [], lShift = [];
for (let t = 0; t < END + 0.5; t += dt) {
  let root, frame, row, ins, kind;
  if (t < END) { root = startPx(t); frame = startFrameAt(t); row = sRow(frame); ins = sIns(frame); kind = 'start'; }
  else { root = D_PX + (t - END) * SPEED; const dist = STRIDE / 2 + (root - D_PX), phi = (dist % STRIDE) / STRIDE; frame = 1 + Math.round(phi * N) % N; row = lRow(frame); ins = lIns(frame); kind = 'loop'; }
  const c = row.R.contact;
  // Only the start's support stance (it ends at handover; the next right stance is a stride ahead).
  if (kind === 'start' && c === 'flat') rFlat.push(root + depth(ins, row, 'R', 'flat') * WPM);
  else if (kind === 'start' && c === 'toe') rToe.push({ x: root + depth(ins, row, 'R', 'toe') * WPM, kind });
  if (kind === 'start' && row.L.contact === 'flat') lShift.push(root + depth(ins, row, 'L', 'flat') * WPM);
  if (Math.abs((t / (1 / 48)) - Math.round(t / (1 / 48))) < 0.5 * dt * 48) samples.push({ t: +t.toFixed(4), rootPx: +root.toFixed(4), speedPxPerS: +(t < END ? speed(t) : SPEED).toFixed(3), frame, kind });
}
const span = a => a.length ? +(Math.max(...a) - Math.min(...a)).toFixed(4) : null;
// Toe edge must be measured against its own planted spot: the edge's world x when heel-off begins.
const toeSpot = rToe.length ? rToe[0].x : null;

// Boundary pose deltas (report rows), compared with one loop step.
const pose = r => ({ hip: r.hip * WPM, R: [r.R.depth * WPM, r.R.lift * WPM, r.R.kneeAngle, r.R.pitchDeg], L: [r.L.depth * WPM, r.L.lift * WPM, r.L.kneeAngle, r.L.pitchDeg] });
const delta = (a, b, travelPx) => { const A = pose(a), B = pose(b);
  // Depth deltas are local; add the root travel between the two poses so a planted foot shows ~0.
  return { hipPx: +(B.hip - A.hip).toFixed(3), R: { depthWorldPx: +(B.R[0] - A.R[0] + travelPx).toFixed(3), liftPx: +(B.R[1] - A.R[1]).toFixed(3), kneeDeg: +(B.R[2] - A.R[2]).toFixed(1), pitchDeg: +(B.R[3] - A.R[3]).toFixed(2) },
    L: { depthWorldPx: +(B.L[0] - A.L[0] + travelPx).toFixed(3), liftPx: +(B.L[1] - A.L[1]).toFixed(3), kneeDeg: +(B.L[2] - A.L[2]).toFixed(1), pitchDeg: +(B.L[3] - A.L[3]).toFixed(2) } }; };
const last = info.rows[info.rows.length - 1], lastT = last.startTime, lastPx = startPx(SHIFT + (lastT - SHIFT) / info.travelSeconds * TRAVEL);
const result = {
  method: 'deterministic, dt 1/960 s; root curve as in the preview; deformed contacts from inspect_walk_study.py; world px (23.3165/m)',
  timing: { shiftSeconds: SHIFT, travelSeconds: +TRAVEL.toFixed(5), startSeconds: +END.toFixed(5), startDistancePx: +D_PX.toFixed(4), renderedStartFrames: info.rows.length, renderedFps: info.fps },
  handover: { loopPhase: 0.5, loopFrame: 25, speedBefore: +speed(END - 1e-6).toFixed(4), speedAfter: SPEED, accelerationPxPerS2AtEnd: 0, rootPxAtHandover: +startPx(END).toFixed(4) },
  rootTimeline48fps: samples,
  contacts: {
    rightFlatSpreadPx: span(rFlat), rightFlatSamples: rFlat.length,
    rightToeEdgeSpreadPx: rToe.length ? +(Math.max(...rToe.map(r => Math.abs(r.x - toeSpot)))).toFixed(4) : null, rightToeSamples: rToe.length,
    rightToeEdgeSpreadStartOnlyPx: span(rToe.filter(r => r.kind === 'start').map(r => r.x)),
    leftPlantedInShiftSpreadPx: span(lShift),
    note: 'Spreads include nearest-frame time quantisation of the 48 fps start frames (up to half a frame of travel: 0.4 px at 38 px/s) and the 48-phase loop after handover.',
  },
  inspection: SI.summary,
  boundaries: {
    idle72_to_start101: delta(L.frames[71], sRow(101), 0),
    start120_to_loop25: delta(last, lRow(25), D_PX - lastPx),
    reference_loop25_to_26: delta(lRow(25), lRow(26), STRIDE / N),
    reference_loop24_to_25: delta(lRow(24), lRow(25), STRIDE / N),
    note: 'Pose differences in world px/degrees between the boundary frames, with root travel between them added to foot depths; compare with the reference loop steps. start120 is the last rendered start frame (t ' + lastT + ' s); the handover is ' + (END - (SHIFT + (lastT - SHIFT) / info.travelSeconds * TRAVEL)).toFixed(4) + ' s later.',
  },
};
fs.writeFileSync(out, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, rootTimeline48fps: `${samples.length} samples` }, null, 1));
