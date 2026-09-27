// One-command asset check: node tools/validate-assets.cjs
//
// Structure (Node): every manifest entry has a known status; every file the
// game or manifest references exists; anchors (pivot, entrance, slots,
// targets, occluders) lie inside the source crop; and anchored art, mapped
// onto every zone it can stand on, keeps each slot inside the footprint.
// Pixels (headless Edge/Chrome): exported sizes match the manifest's
// crop/output, alpha is genuine (clear corners, opaque body, few soft
// pixels), content doesn't touch the frame edge, and frame strips have
// equal frames whose feet sit on the pivot row.
// Exits non-zero on any failure. Set SKIP_PIXELS=1 to run only the Node half.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console, Math });
for (const file of ['world', 'asset-manifest']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', `${file}.js`), 'utf8'), context);
}
const run = source => vm.runInContext(source, context);
const manifest = run('ASSET_MANIFEST');
const STATUSES = ['production', 'provisional', 'interim', 'candidate', 'needs-regeneration', 'missing'];
const failures = [];
const passes = [];
const fail = message => failures.push(message);
const ok = message => passes.push(message);
// Candidates are by definition not approved: their measured shortfalls are
// reported, not fatal. Provisional/production art must pass outright.
const warnings = [];
const failOrWarn = (entry, message) => (entry.status === 'candidate' ? warnings.push(message) : fail(message));
const exists = file => fs.existsSync(path.join(root, file));

function checkStatus(label, entry) {
  if (!STATUSES.includes(entry.status)) fail(`${label}: unknown status "${entry.status}"`);
}

function insideCrop(label, crop, [x, y]) {
  if (x < crop[0] || y < crop[1] || x > crop[0] + crop[2] || y > crop[1] + crop[3]) fail(`${label} (${x}, ${y}) is outside the crop`);
}

// --- structure ---------------------------------------------------------------------
const pixelJobs = [];
for (const [type, art] of Object.entries(manifest.facilities)) {
  const label = `facility ${type}`;
  checkStatus(label, art);
  if (!['open', 'indoor'].includes(art.kind)) fail(`${label}: kind must be open or indoor`);
  if (!exists(art.file)) { fail(`${label}: missing file ${art.file}`); continue; }
  if (!art.crop) { ok(`${label}: ${art.status} ${art.file}`); continue; }

  if (!exists(art.source)) fail(`${label}: missing source ${art.source}`);
  const fallback = manifest.fallbackFacilityFiles[type];
  if (!fallback || !exists(fallback)) fail(`${label}: needs an existing fallback sprite for zones it can't use`);
  insideCrop(`${label} pivot`, art.crop, art.pivot);
  insideCrop(`${label} entrance`, art.crop, art.entrance);
  for (const slot of art.slots) insideCrop(`${label} slot ${slot.id}`, art.crop, [slot.x, slot.y]);
  for (const target of art.targets || []) insideCrop(`${label} target`, art.crop, target);
  for (const polygon of art.front || []) for (const point of polygon) insideCrop(`${label} occluder point`, art.crop, point);
  if (new Set(art.slots.map(s => s.id)).size !== art.slots.length) fail(`${label}: duplicate slot ids`);

  // Every zone this art may stand on keeps its slots inside the footprint.
  context.__type = type;
  const zones = run(`WORLD.zones.filter(z => zoneAllowsType(z, __type) && ASSET_MANIFEST.facilities[__type].doorSides.includes(z.doorSide)).map(z => z.id)`);
  if (!zones.length) fail(`${label}: no zone supports its door sides ${art.doorSides}`);
  for (const zoneId of zones) {
    const outside = run(`facilityArtSlots(__type, zoneById('${zoneId}')).filter(s => !pointInPolygon(s.x, s.y, zoneById('${zoneId}').footprint)).map(s => s.id)`);
    if (outside.length) fail(`${label} on ${zoneId}: slots ${outside.join(', ')} fall outside the footprint`);
  }
  const defaultZone = manifest && run(`WORLD.defaultPlacements['${type}']`);
  if (defaultZone && !zones.includes(defaultZone)) fail(`${label}: its art can't be used on its default zone ${defaultZone}`);
  ok(`${label}: anchors inside crop, slots inside ${zones.length} compatible zone(s)`);
  pixelJobs.push({ label, kind: 'image', file: art.file, width: art.output.width, height: Math.round(art.crop[3] * art.output.width / art.crop[2]) });
}

const gate = manifest.gate;
checkStatus('gate', gate);
if (!exists(gate.file)) fail(`gate: missing ${gate.file}`);
if (gate.candidateSource && !exists(gate.candidateSource)) fail(`gate: missing ${gate.candidateSource}`);

// Layered pieces pinned by pivots: bridges and the gate checkpoint.
const layerInGame = entry => ['production', 'provisional', 'interim'].includes(entry.status);
// A front layer on a shared canvas (a rail, a counter) is legitimately sparse.
const checkLayer = (label, layer, entry, pivots, sparse = false) => {
  if (!exists(layer.file)) { fail(`${label}: missing ${layer.file}`); return; }
  for (const [name, p] of Object.entries(pivots)) insideCrop(`${label} ${name}`, [0, 0, layer.size[0], layer.size[1]], p);
  pixelJobs.push({ label, kind: 'image', file: layer.file, width: layer.size[0], height: layer.size[1], uncached: !layerInGame(entry), minOpaque: sparse ? 0.02 : 0.1 });
};
for (const [id, bridge] of Object.entries(manifest.bridges || {})) {
  checkStatus(`bridge ${id}`, bridge);
  if (!bridge.back) continue;
  for (const side of ['back', 'front']) checkLayer(`bridge ${id} ${side}`, bridge[side], bridge, { 'west pivot': bridge.westPivot, 'east pivot': bridge.eastPivot }, side === 'front');
  if (bridge.back.size.join() !== bridge.front.size.join()) fail(`bridge ${id}: back and front canvases differ`);
}
const checkpoint = manifest.checkpoint;
if (checkpoint) {
  checkStatus('checkpoint', checkpoint);
  checkLayer('checkpoint kiosk back', checkpoint.kioskBack, checkpoint, { pivot: checkpoint.kioskBack.pivot });
  checkLayer('checkpoint kiosk front', checkpoint.kioskFront, checkpoint, { pivot: checkpoint.kioskFront.pivot });
  checkLayer('checkpoint boom', checkpoint.boom, checkpoint, { pin: checkpoint.boom.pin });
  checkLayer('checkpoint post', checkpoint.post, checkpoint, { pin: checkpoint.post.pin, ground: checkpoint.post.ground });
  if (Math.abs(checkpoint.boom.reachPx / 3 - run('WORLD.checkpoint.boomLength')) > 1) fail('checkpoint boom: reach does not match WORLD.checkpoint.boomLength');
}

for (const [archetype, sets] of Object.entries(manifest.units)) {
  const { stills } = sets;
  checkStatus(`${archetype} stills`, stills);
  const variants = archetype === 'soldier' ? ['01', '02', '03', '04', '05', '06'] : ['civilian', 'bus_rider', 'taxi'];
  for (const variant of variants) {
    for (const direction of stills.directions) {
      const file = stills.pattern.replace('{variant}', variant).replace('{outfit}', variant).replace('{direction}', direction);
      if (!exists(file)) fail(`${archetype} still missing: ${file}`);
    }
  }
  ok(`${archetype}: ${variants.length * stills.directions.length} directional stills present`);
  const frameSets = [];
  for (const [name, set] of Object.entries({ walk: sets.walk, idle: sets.idle, ...(sets.activities || {}) })) {
    if (!set) continue;
    if (set.drawn) {
      checkStatus(`${archetype} ${name}`, set);
      for (const [direction, drawn] of Object.entries(set.drawn)) frameSets.push([`${archetype} ${name} ${direction}`, drawn, name === 'walk' ? set : null]);
      const undrawn = set.directions.filter(d => !set.drawn[d]);
      if (undrawn.length) ok(`${archetype} ${name}: ${undrawn.join('/')} still to draw (art/CHATGPT_FEEDBACK.md)`);
    } else frameSets.push([`${archetype} ${name}`, set, null]);
  }
  for (const [label, set, walkSet] of frameSets) {
    checkStatus(label, set);
    if (set.status === 'missing') { ok(`${label}: missing (requested in art/CHATGPT_FEEDBACK.md)`); continue; }
    if (!exists(set.file)) { fail(`${label}: missing file ${set.file}`); continue; }
    if (set.source && !exists(set.source)) fail(`${label}: missing source ${set.source}`);
    if (set.accent && !exists(set.accent)) fail(`${label}: missing accent mask ${set.accent}`);
    if (!set.frames) continue;
    const [, , w, h] = set.frames[0];
    if (!set.frames.every(f => f[2] === w && f[3] === h)) fail(`${label}: frames are not equal boxes`);
    insideCrop(`${label} pivot`, [0, 0, w, h], set.pivot);
    const outH = set.output.frameHeight, outW = Math.round(w * outH / h);
    const job = { label, kind: 'strip', file: set.file, width: outW * set.frames.length, height: outH,
      frames: set.frames.length, pivotRow: Math.round(set.pivot[1] * outH / h) };
    if (walkSet) {
      // Walk cycles: feet legitimately sit on different rows (the forward
      // foot is nearer the camera), so they get gait checks instead of the
      // shared-baseline check.
      job.gait = { source: set.source, frames: set.frames.length };
      if (set.frames.length !== walkSet.framesPerDirection) fail(`${label}: ${set.frames.length} frames, walk cycles need ${walkSet.framesPerDirection}`);
      if (set.gaitTrack) {
        const track = JSON.parse(fs.readFileSync(path.join(root, set.gaitTrack), 'utf8'));
        const expected = (walkSet.strideWorld / set.frames.length) * track.pxPerWorld;
        if (track.strideWorld !== walkSet.strideWorld) fail(`${label}: foot track stride ${track.strideWorld} != manifest ${walkSet.strideWorld}`);
        let stanceSteps = 0, slides = 0;
        for (let i = 0; i < track.track.length; i++) {
          const a = track.track[i], b = track.track[(i + 1) % track.track.length];
          for (const foot of ['left', 'right']) {
            if (!a[foot].planted || !b[foot].planted) continue;
            stanceSteps++;
            const moved = a[foot].y - b[foot].y; // up the screen as the soldier walks toward the camera
            if (Math.abs(moved - expected) > 0.6) { slides++; failOrWarn(set, `${label}: ${foot} foot slides ${((moved - expected) / track.pxPerWorld).toFixed(2)} world px in frame ${i + 1}->${(i + 1) % track.track.length + 1} (${moved.toFixed(2)}px per frame, planted needs ${expected.toFixed(2)}${track.measured ? '; measured from pixels' : ''})`); }
          }
        }
        if (stanceSteps < set.frames.length - 2) fail(`${label}: too few planted frames in the foot track`);
        if (!slides) ok(`${label}: planted feet move ${expected.toFixed(2)} px/frame = walked distance (${stanceSteps} stance steps checked)`);
      } else fail(`${label}: walk cycle has no foot track to prove planted feet`);
    }
    pixelJobs.push(job);
  }
}
for (const [id, prop] of Object.entries(manifest.props || {})) {
  checkStatus(`prop ${id}`, prop);
  if (!exists(prop.file)) { fail(`prop ${id}: missing ${prop.file}`); continue; }
  insideCrop(`prop ${id} pivot`, [0, 0, prop.size[0], prop.size[1]], prop.pivot);
  pixelJobs.push({ label: `prop ${id}`, kind: 'image', file: prop.file, width: prop.size[0], height: prop.size[1], uncached: !prop.inGame });
}
for (const entry of Object.values(manifest.terrain)) if (entry.file && !exists(entry.file)) fail(`terrain missing: ${entry.file}`);

// Every asset the offline cache lists must exist (and processed art must be cached).
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const cached = [...worker.matchAll(/^\s*"([^"\n]+)"[,]?$/gm)].map(m => m[1]);
for (const file of cached) if (file !== './' && !exists(file)) fail(`service worker caches missing file ${file}`);
for (const job of pixelJobs) if (!job.uncached && !cached.includes(job.file)) fail(`${job.file} is not in the service worker cache list`);

// --- pixels --------------------------------------------------------------------------
// Gait analysis, run in the page. Frames are aligned on the figure's head and
// torso (top row + centre of the upper 40%), so uneven spacing in a study
// can't fake a difference; then the LEG region (lower 45%) is compared
// between every pair of frames, and the lowest foot's side is found.
const GAIT_JS = String.raw`
window.gaitStats = async (src, frames) => {
  const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('cannot load ' + src)); i.src = src; });
  const W = img.naturalWidth, H = img.naturalHeight, fw = Math.floor(W / frames);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, W, H).data, on = (x, y) => d[(y * W + x) * 4 + 3] > 128;
  const step = Math.max(1, Math.round(fw / 128));
  const legs = [], lowest = [];
  for (let f = 0; f < frames; f++) {
    let top = -1, bottom = -1, minX = 1e9, maxX = -1;
    for (let y = 0; y < H; y++) for (let x = f * fw; x < (f + 1) * fw; x++) if (on(x, y)) { if (top < 0) top = y; bottom = y; minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    const height = bottom - top;
    let sum = 0, n = 0;
    for (let y = top; y < top + height * 0.4; y++) for (let x = f * fw; x < (f + 1) * fw; x++) if (on(x, y)) { sum += x; n++; }
    const cx = sum / n, legTop = top + height * 0.55;
    const set = new Set(); let lowL = -1, lowR = -1;
    for (let y = Math.floor(legTop); y <= bottom; y += step) for (let x = f * fw; x < (f + 1) * fw; x += step) if (on(x, y)) {
      set.add(Math.round((x - cx) / step) + ',' + Math.round((y - top) / step));
      if (x < cx - fw * 0.03) lowL = Math.max(lowL, y - top); else if (x > cx + fw * 0.03) lowR = Math.max(lowR, y - top);
    }
    legs.push(set); lowest.push({ left: lowL, right: lowR, height });
  }
  const pairs = [];
  for (let a = 0; a < frames; a++) for (let b = a + 1; b < frames; b++) {
    let inter = 0; for (const k of legs[a]) if (legs[b].has(k)) inter++;
    const union = legs[a].size + legs[b].size - inter;
    pairs.push({ a, b, difference: 1 - inter / union });
  }
  return { pairs, minDifference: Math.min(...pairs.map(p => p.difference)), lowest };
};`;
const GAIT_MIN_DIFFERENCE = 0.12;   // every pair of frames must differ this much in the legs
// Evaluate gait stats: returns problems (empty when the cycle passes).
function gaitProblems(stats, frames) {
  const problems = [];
  const same = stats.pairs.filter(p => p.difference < GAIT_MIN_DIFFERENCE);
  if (same.length) problems.push(`repeated phases: frames ${same.map(p => `${p.a + 1}&${p.b + 1} (${(p.difference * 100).toFixed(0)}% different)`).join(', ')} — each pair must differ by ${GAIT_MIN_DIFFERENCE * 100}%+ in the legs`);
  const half = frames / 2, side = l => (l.left - l.right) / l.height;
  const first = side(stats.lowest[0]), second = side(stats.lowest[half]);
  if (!(Math.sign(first) !== Math.sign(second) && Math.abs(first) > 0.02 && Math.abs(second) > 0.02)) {
    problems.push(`front foot does not alternate between frame 1 and frame ${half + 1} (left-right foot offsets ${first.toFixed(3)}, ${second.toFixed(3)} of body height)`);
  }
  return problems;
}

async function checkPixels() {
  const { startStaticServer, launchBrowser } = require('./lib/browser.cjs');
  const server = await startStaticServer(root);
  const page = await launchBrowser();
  try {
    await page.navigate(`${server.url}/tools/world-diagnostic.html`);
    await page.evaluate(GAIT_JS + '; true');
    for (const job of pixelJobs) {
      const r = await page.evaluate(`new Promise((resolve, reject) => { const img = new Image(); img.onerror = () => reject(new Error('decode failed'));
        img.onload = () => { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
          const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data;
          let clear = 0, opaque = 0, soft = 0, edge = 0; const edges = {}; const frames = ${job.frames || 1}, fw = c.width / frames; const feet = new Array(frames).fill(-1);
          for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const a = d[(y * c.width + x) * 4 + 3];
            if (a === 0) clear++; else if (a === 255) opaque++; else soft++;
            if (a > 128) { const f = Math.floor(x / fw); feet[f] = Math.max(feet[f], y);
              const side = x % fw < 1 ? 'left' : x % fw >= fw - 1 ? 'right' : y === 0 ? 'top' : y === c.height - 1 ? 'bottom' : null;
              if (side) { edge++; const key = (frames > 1 ? 'frame ' + (f + 1) + ' ' : '') + side; edges[key] = (edges[key] || 0) + 1; } } }
          const corner = [[0, 0], [c.width - 1, 0], [0, c.height - 1], [c.width - 1, c.height - 1]].map(([x, y]) => d[(y * c.width + x) * 4 + 3]);
          const total = c.width * c.height;
          // Soft pixels more than 2 px from any clear pixel: see-through body, not the anti-aliased rim.
          const A = (x, y) => x < 0 || y < 0 || x >= c.width || y >= c.height ? 0 : d[(y * c.width + x) * 4 + 3];
          let interior = 0;
          for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const a = A(x, y); if (a === 0 || a === 255) continue;
            let rim = false; for (let dy = -2; dy <= 2 && !rim; dy++) for (let dx = -2; dx <= 2; dx++) if (A(x + dx, y + dy) === 0) { rim = true; break; }
            if (!rim) interior++; }
          resolve({ w: c.width, h: c.height, clear: clear / total, opaque: opaque / total, soft: soft / total, softInterior: interior / Math.max(1, total - clear), edge, edges, corner, feet }); };
        img.src = '/${job.file}'; })`);
      const where = `${job.label} (${job.file})`;
      if (Math.abs(r.w - job.width) > 1 || Math.abs(r.h - job.height) > 1) fail(`${where}: ${r.w}x${r.h}, manifest implies ${job.width}x${job.height}`);
      if (r.corner.some(a => a !== 0)) fail(`${where}: corners are not transparent`);
      if (r.clear < 0.1 || r.opaque < (job.minOpaque ?? 0.1)) fail(`${where}: no genuine alpha (clear ${(r.clear * 100).toFixed(1)}%, opaque ${(r.opaque * 100).toFixed(1)}%)`);
      // The 1-2 px anti-aliased rim is allowed (and is a large share of small 1x props); a see-through body is not.
      if (r.softInterior > 0.025) fail(`${where}: ${(r.softInterior * 100).toFixed(1)}% of the body is semi-transparent away from the edge (run tools/prepare-art.cjs)`);
      if (r.edge > 0) fail(`${where}: content touches the frame edge (${Object.entries(r.edges).map(([k, v]) => `${k}: ${v}px`).join(', ')})`);
      if (job.gait) {
        const stats = await page.evaluate(`gaitStats('/${job.gait.source}', ${job.gait.frames})`);
        const problems = gaitProblems(stats, job.gait.frames);
        problems.forEach(p => fail(`${job.label}: ${p}`));
        if (!problems.length) ok(`${job.label}: ${job.gait.frames} distinct phases (legs differ by >= ${(stats.minDifference * 100).toFixed(0)}% between any two frames), front foot alternates`);
      } else if (job.kind === 'strip') {
        const spread = Math.max(...r.feet) - Math.min(...r.feet);
        if (spread > 3) fail(`${where}: feet rows vary by ${spread}px across frames (${r.feet})`);
        if (r.feet.some(row => Math.abs(row - job.pivotRow) > 4)) fail(`${where}: feet rows ${r.feet} are off the pivot row ${job.pivotRow}`);
      }
      ok(`${where}: ${r.w}x${r.h}, ${(r.opaque * 100).toFixed(0)}% opaque / ${(r.soft * 100).toFixed(1)}% soft (${(r.softInterior * 100).toFixed(1)}% inside the body), corners clear${job.kind === 'strip' ? `, feet rows ${r.feet}` : ''}`);
    }
    if (page.problems.length) fail(`browser errors: ${page.problems.join('; ')}`);
  } finally {
    await page.close();
    server.close();
  }
}

// node tools/validate-assets.cjs --gait <image> <frames>
// Scores any walk strip (e.g. a new study) with the same gait checks.
async function gaitOnly(file, frames) {
  const { startStaticServer, launchBrowser } = require('./lib/browser.cjs');
  const server = await startStaticServer(root);
  const page = await launchBrowser();
  try {
    await page.navigate(`${server.url}/tools/world-diagnostic.html`);
    await page.evaluate(GAIT_JS + '; true');
    const stats = await page.evaluate(`gaitStats('/${file}', ${frames})`);
    console.log(`leg-region difference between frame pairs:\n${stats.pairs.map(p => `  ${p.a + 1}-${p.b + 1}: ${(p.difference * 100).toFixed(1)}%`).join('\n')}`);
    const problems = gaitProblems(stats, frames);
    console.log(problems.length ? `\nGAIT FAIL\n${problems.map(p => `- ${p}`).join('\n')}` : '\nGait passes: distinct phases, alternating front foot');
    process.exitCode = problems.length ? 1 : 0;
  } finally {
    await page.close();
    server.close();
  }
}

(async () => {
  const gaitIndex = process.argv.indexOf('--gait');
  if (gaitIndex > 0) return gaitOnly(process.argv[gaitIndex + 1], Number(process.argv[gaitIndex + 2] || 6));
  if (!process.env.SKIP_PIXELS) await checkPixels();
  console.log(passes.map(p => `ok   ${p}`).join('\n'));
  if (warnings.length) console.log(warnings.map(w => `WARN ${w} (candidate, not blocking)`).join('\n'));
  if (failures.length) {
    console.log(`\n${failures.length} problem(s):\n${failures.map(f => `FAIL ${f}`).join('\n')}`);
    process.exit(1);
  }
  console.log('\nAssets valid');
})().catch(error => { console.error(error); process.exit(1); });
