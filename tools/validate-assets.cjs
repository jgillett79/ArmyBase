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
  for (const [name, set] of Object.entries({ walk: sets.walk, idle: sets.idle, ...(sets.activities || {}) })) {
    if (!set) continue;
    const label = `${archetype} ${name}`;
    checkStatus(label, set);
    if (set.status === 'missing') { ok(`${label}: missing (requested in art/CHATGPT_FEEDBACK.md)`); continue; }
    if (!exists(set.file)) { fail(`${label}: missing file ${set.file}`); continue; }
    if (set.frames) {
      const [, , w, h] = set.frames[0];
      if (!set.frames.every(f => f[2] === w && f[3] === h)) fail(`${label}: frames are not equal boxes`);
      insideCrop(`${label} pivot`, [0, 0, w, h], set.pivot);
      const outH = set.output.frameHeight, outW = Math.round(w * outH / h);
      pixelJobs.push({ label, kind: 'strip', file: set.file, width: outW * set.frames.length, height: outH,
        frames: set.frames.length, pivotRow: Math.round(set.pivot[1] * outH / h) });
    }
  }
}
for (const entry of Object.values(manifest.terrain)) if (entry.file && !exists(entry.file)) fail(`terrain missing: ${entry.file}`);

// Every asset the offline cache lists must exist (and processed art must be cached).
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const cached = [...worker.matchAll(/^\s*"([^"\n]+)"[,]?$/gm)].map(m => m[1]);
for (const file of cached) if (file !== './' && !exists(file)) fail(`service worker caches missing file ${file}`);
for (const job of pixelJobs) if (!cached.includes(job.file)) fail(`${job.file} is not in the service worker cache list`);

// --- pixels --------------------------------------------------------------------------
async function checkPixels() {
  const { startStaticServer, launchBrowser } = require('./lib/browser.cjs');
  const server = await startStaticServer(root);
  const page = await launchBrowser();
  try {
    await page.navigate(`${server.url}/tools/world-diagnostic.html`);
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
          resolve({ w: c.width, h: c.height, clear: clear / total, opaque: opaque / total, soft: soft / total, edge, edges, corner, feet }); };
        img.src = '/${job.file}'; })`);
      const where = `${job.label} (${job.file})`;
      if (Math.abs(r.w - job.width) > 1 || Math.abs(r.h - job.height) > 1) fail(`${where}: ${r.w}x${r.h}, manifest implies ${job.width}x${job.height}`);
      if (r.corner.some(a => a !== 0)) fail(`${where}: corners are not transparent`);
      if (r.clear < 0.1 || r.opaque < 0.1) fail(`${where}: no genuine alpha (clear ${(r.clear * 100).toFixed(1)}%, opaque ${(r.opaque * 100).toFixed(1)}%)`);
      if (r.soft > 0.06) fail(`${where}: ${(r.soft * 100).toFixed(1)}% semi-transparent pixels (run tools/prepare-art.cjs)`);
      if (r.edge > 0) fail(`${where}: content touches the frame edge (${Object.entries(r.edges).map(([k, v]) => `${k}: ${v}px`).join(', ')})`);
      if (job.kind === 'strip') {
        const spread = Math.max(...r.feet) - Math.min(...r.feet);
        if (spread > 3) fail(`${where}: feet rows vary by ${spread}px across frames (${r.feet})`);
        if (r.feet.some(row => Math.abs(row - job.pivotRow) > 4)) fail(`${where}: feet rows ${r.feet} are off the pivot row ${job.pivotRow}`);
      }
      ok(`${where}: ${r.w}x${r.h}, ${(r.opaque * 100).toFixed(0)}% opaque / ${(r.soft * 100).toFixed(1)}% soft, corners clear${job.kind === 'strip' ? `, feet rows ${r.feet}` : ''}`);
    }
    if (page.problems.length) fail(`browser errors: ${page.problems.join('; ')}`);
  } finally {
    await page.close();
    server.close();
  }
}

(async () => {
  if (!process.env.SKIP_PIXELS) await checkPixels();
  console.log(passes.map(p => `ok   ${p}`).join('\n'));
  if (failures.length) {
    console.log(`\n${failures.length} problem(s):\n${failures.map(f => `FAIL ${f}`).join('\n')}`);
    process.exit(1);
  }
  console.log('\nAssets valid');
})().catch(error => { console.error(error); process.exit(1); });
