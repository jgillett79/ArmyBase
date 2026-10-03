// Quantisation of planted feet for walk sets of different phase density, with
// nearest-frame selection, from the DEFORMED contacts measured by
// inspect_walk_study.py (sole centroid while flat, sole front edge during
// heel-off) — not from interpolated report rows. Preview analysis only.
//
//   node tools/blender/measure-phase-density.cjs <out.json> <label>=<motion-report.json>,<rig-inspection.json> ...
//
// Model: the soldier travels d world px along the route (1D: foot planting is
// along the direction of travel). True phase = (d mod stride) / stride; the
// drawn frame is the nearest of N uniform phases. A planted contact's drawn
// world position is d + (deformed contact depth of the drawn frame) * px/m;
// its true position is fixed, so its peak-to-peak spread within one true
// contact interval is the visible creep. Intervals are defined by TRUE phase
// (like for like across densities): flat [0, heelOff), toe [heelOff, 0.5) for
// R; +0.5 for L. Samples whose drawn frame has a different contact class are
// excluded and counted.
const fs = require('node:fs');
const [out, ...specs] = process.argv.slice(2);
if (!out || specs.length < 1) { console.error('usage: measure-phase-density.cjs <out.json> <label>=<motion-report>,<rig-inspection> ...'); process.exit(2); }
const STRIDE = 22, WPM = 44 / 1.8871, STEP = 0.01, CYCLES = 20, START = 3.3; // world px; WPM as projection.json (23.3165)

function load(spec) {
  const [label, files] = spec.split('='); const [mr, ri] = files.split(',');
  const motion = JSON.parse(fs.readFileSync(mr, 'utf8')), insp = JSON.parse(fs.readFileSync(ri, 'utf8'));
  const N = motion.walkSamplesPerCycle || 24, travel = f => motion.frames[f - 1].virtualTravelMetres;
  const frames = [];
  for (let f = 1; f <= N; f++) {
    const row = motion.frames[f - 1], m = insp.frames[f - 1], o = {};
    for (const s of ['R', 'L']) {
      const contact = row[s].contact || (row[s].planted ? 'flat' : null);
      // inspect: soleWorldY = centroid.y - travel; forward is -Y, so local depth = -(soleWorldY + travel).
      o[s] = { contact, flatDepth: -(m[s].soleWorldY + travel(f)), toeDepth: -(m[s].toeEdgeWorldY + travel(f)), toeZ: m[s].toeEdgeZ, soleZ: m[s].soleBottomZ };
    }
    frames.push(o);
  }
  // Heel-off phase from the report's own contact labels (first 'toe' frame of R).
  const firstToe = frames.findIndex(fr => fr.R.contact === 'toe');
  return { label, N, frames, heelOff: firstToe < 0 ? 0.5 : firstToe / N, bytes: null };
}

function measure(set) {
  const { N, frames, heelOff } = set, phaseErr = [], intervals = {};
  let excluded = 0, counted = 0;
  const classAt = (phi, s) => { const p = s === 'R' ? phi : (phi + 0.5) % 1; return p < heelOff ? 'flat' : p < 0.5 ? 'toe' : null; };
  const occ = {};
  for (let d = START; d < START + CYCLES * STRIDE; d += STEP) {
    const phi = (d % STRIDE) / STRIDE, i = Math.round(phi * N) % N, fr = frames[i];
    let e = i / N - phi; if (e > 0.5) e -= 1; if (e < -0.5) e += 1; phaseErr.push(e * STRIDE);
    const cycle = Math.floor(d / STRIDE);
    for (const s of ['R', 'L']) {
      const cls = classAt(phi, s); if (!cls) continue;
      const key = `${s}-${cls}`, p = s === 'R' ? phi : (phi + 0.5) % 1, occId = `${key}-${s === 'L' && phi < 0.5 ? cycle - 1 : cycle}`;
      if (fr[s].contact !== cls) { excluded++; (intervals[key] ||= { excludedSamples: 0, samples: 0 }).excludedSamples++; continue; }
      counted++; (intervals[key] ||= { excludedSamples: 0, samples: 0 }).samples++;
      const x = d + (cls === 'flat' ? fr[s].flatDepth : fr[s].toeDepth) * WPM;
      const o = (occ[occId] ||= { key, min: x, max: x }); o.min = Math.min(o.min, x); o.max = Math.max(o.max, x);
    }
  }
  for (const o of Object.values(occ)) (intervals[o.key].p2p ||= []).push(o.max - o.min);
  const stats = a => ({ mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3), max: +Math.max(...a).toFixed(3), min: +Math.min(...a).toFixed(3) });
  const rms = Math.sqrt(phaseErr.reduce((a, e) => a + e * e, 0) / phaseErr.length);
  const res = {};
  for (const [k, v] of Object.entries(intervals)) res[k] = { occurrences: v.p2p ? v.p2p.length : 0, peakToPeakPx: v.p2p ? stats(v.p2p) : null, samples: v.samples, excludedSamples: v.excludedSamples, excludedFraction: +(v.excludedSamples / (v.samples + v.excludedSamples)).toFixed(4) };
  return { phases: N, heelOffPhase: heelOff, phaseErrorPx: { mean: +(phaseErr.reduce((a, e) => a + e, 0) / phaseErr.length).toFixed(4), rms: +rms.toFixed(4), maxAbs: +Math.max(...phaseErr.map(Math.abs)).toFixed(4) },
    contactIntervals: res, samplesPerSet: phaseErr.length, plantedSamplesCounted: counted, plantedSamplesExcluded: excluded,
    deformedContactHeightsM: { soleZ: [Math.min(...frames.flatMap(f => ['R', 'L'].filter(s => f[s].contact === 'flat').map(s => f[s].soleZ))), Math.max(...frames.flatMap(f => ['R', 'L'].filter(s => f[s].contact === 'flat').map(s => f[s].soleZ)))],
      toeEdgeZ: [Math.min(...frames.flatMap(f => ['R', 'L'].filter(s => f[s].contact === 'toe').map(s => f[s].toeZ))), Math.max(...frames.flatMap(f => ['R', 'L'].filter(s => f[s].contact === 'toe').map(s => f[s].toeZ)))] } };
}

const result = { method: 'nearest-frame selection; 1D travel; deformed contacts (inspect_walk_study.py); step ' + STEP + ' px over ' + CYCLES + ' cycles from ' + START + ' px; stride ' + STRIDE + ' px; ' + WPM.toFixed(4) + ' world px/m', sets: {} };
for (const spec of specs) { const set = load(spec); result.sets[set.label] = measure(set); }
fs.writeFileSync(out, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 1));
