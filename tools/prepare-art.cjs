// Builds game-ready art from the untouched sources in art/, as described in
// js/asset-manifest.js, and writes review sheets to art/review/.
//
//   node tools/prepare-art.cjs            # every processed asset
//   node tools/prepare-art.cjs shooting_range
//
// Non-destructive: sources are only read. For each facility with a `crop`
// it crops, cleans alpha (>= 224 -> opaque, <= 16 -> clear: the generator's
// "opaque" pixels are ~90% alpha, which reads as see-through on terrain),
// resamples to `output.width` and exports WebP. Activity frame sets are cut
// into equal boxes around a shared pivot, painted effects are erased, and
// the frames are packed into one strip. Each asset gets a review sheet:
// transparency checkerboard + anchors, and a game-scale preview beside a
// person at the manifest's unitWorldHeight (and at 60 for comparison).
// Image work runs in a headless browser canvas (Node has no WebP codec).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { startStaticServer, launchBrowser } = require('./lib/browser.cjs');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console, Math });
for (const file of ['world', 'asset-manifest']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', `${file}.js`), 'utf8'), context);
}
const manifest = vm.runInContext('ASSET_MANIFEST', context);
const only = process.argv[2];

// In-page helpers, installed once per page load.
const PAGE_HELPERS = String.raw`
window.loadImage = src => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('cannot load ' + src)); img.src = src; });
window.canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h); return c; };
window.cleanAlpha = canvas => { const g = canvas.getContext('2d'); const img = g.getImageData(0, 0, canvas.width, canvas.height); const d = img.data;
  for (let i = 3; i < d.length; i += 4) { if (d[i] >= 224) d[i] = 255; else if (d[i] <= 16) d[i] = 0; } g.putImageData(img, 0, 0); };
window.eraseBright = (canvas, x, y, w, h) => { const g = canvas.getContext('2d'); const img = g.getImageData(x, y, w, h); const d = img.data;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 190 && d[i + 1] > 120 && d[i + 2] < 190 && d[i] - d[i + 2] > 60) d[i + 3] = 0; g.putImageData(img, x, y); };
window.resample = (src, w, h) => { const out = canvasOf(w, h); const g = out.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, out.width, out.height); return out; };
window.checker = (g, w, h, size = 16) => { for (let y = 0; y < h; y += size) for (let x = 0; x < w; x += size) { g.fillStyle = ((x + y) / size) % 2 ? '#cfcfcf' : '#f4f4f4'; g.fillRect(x, y, size, size); } };
window.b64 = (canvas, type = 'image/png', quality) => canvas.toDataURL(type, quality).split(',')[1];
`;

function write(relative, base64) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(base64, 'base64'));
  console.log(`wrote ${relative} (${Math.round(fs.statSync(file).size / 1024)} KB)`);
}

async function prepareFacility(page, type, art) {
  const unitH = manifest.unitWorldHeight;
  const result = await page.evaluate(`(async () => {
    const art = ${JSON.stringify(art)};
    const src = await loadImage('/' + art.source);
    const [cx, cy, cw, ch] = art.crop;
    const crop = canvasOf(cw, ch); crop.getContext('2d').drawImage(src, -cx, -cy);
    if (art.alphaCleanup) cleanAlpha(crop);
    const outW = art.output.width, outH = Math.round(ch * outW / cw);
    const out = resample(crop, outW, outH);
    if (art.alphaCleanup) cleanAlpha(out);

    // Review sheet: left = anchors on checkerboard, right = game scale.
    const sheet = canvasOf(outW + 520, Math.max(outH, 420) + 40); const g = sheet.getContext('2d');
    g.fillStyle = '#1d2621'; g.fillRect(0, 0, sheet.width, sheet.height);
    checker(g, outW, outH); g.drawImage(out, 0, 0);
    const k = outW / cw, P = (x, y) => [(x - cx) * k, (y - cy) * k];
    g.lineWidth = 2;
    for (const poly of art.front || []) { g.beginPath(); poly.forEach(([x, y], i) => { const [px, py] = P(x, y); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath(); g.fillStyle = 'rgba(255,220,0,0.25)'; g.fill(); g.strokeStyle = '#e0b400'; g.stroke(); }
    for (const s of art.slots || []) { const [x, y] = P(s.x, s.y); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#000'; g.font = 'bold 12px sans-serif'; g.fillText(s.id, x + 8, y + 4); }
    for (const t of art.targets || []) { const [x, y] = P(t[0], t[1]); g.strokeStyle = '#d33'; g.beginPath(); g.arc(x, y, 8, 0, 7); g.stroke(); }
    { const [x, y] = P(art.entrance[0], art.entrance[1]); g.fillStyle = '#2a6cff'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); }
    { const [x, y] = P(art.pivot[0], art.pivot[1]); g.strokeStyle = '#e22'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 12, y); g.lineTo(x + 12, y); g.moveTo(x, y - 12); g.lineTo(x, y + 12); g.stroke(); }
    g.fillStyle = '#eee'; g.font = '14px sans-serif';
    g.fillText('${type}: white = slots, yellow = front occluders, blue = entrance, red + = pivot, red o = targets', 6, outH + 26);

    // Game scale on a 240-world-px site at zoom 1, with people at the
    // chosen height (left pair) and at 60 (right pair).
    const ox = outW + 20, worldW = 240, s = worldW / cw;
    g.fillStyle = '#6f7c4b'; g.fillRect(ox, 0, 500, 400);
    g.drawImage(out, ox + 20, 40, cw * s, ch * s);
    const soldier = await loadImage('/assets/units/soldiers/soldier_01_up.png');
    const person = (x, y, h) => { const w = h * 2 / 3; g.drawImage(soldier, x - w / 2, y - h, w, h); };
    const slots = art.slots || [];
    slots.slice(0, 2).forEach(sl => person(ox + 20 + (sl.x - cx) * s, 40 + (sl.y - cy) * s, ${unitH}));
    person(ox + 300, 380, ${unitH}); person(ox + 340, 380, 60);
    g.fillStyle = '#fff'; g.fillText('game scale (zoom 1): people ${unitH} vs 60 world px', ox + 10, 20);
    return { image: b64(out, 'image/webp', 0.9), sheet: b64(sheet, 'image/jpeg', 0.86), outW, outH };
  })()`);
  write(art.file, result.image);
  write(`art/review/${type}-review.jpg`, result.sheet);
  return { outW: result.outW, outH: result.outH };
}

async function prepareFrames(page, name, anim) {
  const result = await page.evaluate(`(async () => {
    const anim = ${JSON.stringify(anim)};
    const src = await loadImage('/' + anim.source);
    const [, , fw, fh] = anim.frames[0];
    const scale = anim.output.frameHeight / fh, outFw = Math.round(fw * scale), outFh = anim.output.frameHeight;
    const strip = canvasOf(outFw * anim.frames.length, outFh);
    const baselines = [];
    anim.frames.forEach(([x, y, w, h], i) => {
      const frame = canvasOf(w, h); frame.getContext('2d').drawImage(src, -x, -y);
      for (const [fi, ex, ey, ew, eh] of anim.eraseBright || []) if (fi === i) eraseBright(frame, ex, ey, ew, eh);
      for (const [fi, ex, ey, ew, eh] of anim.eraseAll || []) if (fi === i) frame.getContext('2d').clearRect(ex, ey, ew, eh);
      if (anim.alphaCleanup) cleanAlpha(frame);
      strip.getContext('2d').drawImage(resample(frame, outFw, outFh), i * outFw, 0);
    });
    if (anim.alphaCleanup) cleanAlpha(strip);
    // Lowest opaque row per frame (the feet), for the baseline check.
    const d = strip.getContext('2d').getImageData(0, 0, strip.width, strip.height).data;
    for (let i = 0; i < anim.frames.length; i++) {
      let bottom = -1;
      for (let y = outFh - 1; y >= 0 && bottom < 0; y--) for (let x = i * outFw; x < (i + 1) * outFw; x++) if (d[(y * strip.width + x) * 4 + 3] > 128) { bottom = y; break; }
      baselines.push(bottom);
    }
    const sheet = canvasOf(strip.width + outFw + 40, outFh + 60); const g = sheet.getContext('2d');
    g.fillStyle = '#1d2621'; g.fillRect(0, 0, sheet.width, sheet.height);
    checker(g, strip.width, outFh); g.drawImage(strip, 0, 0);
    const pivotY = anim.pivot[1] * scale, pivotX = anim.pivot[0] * scale;
    g.strokeStyle = '#e22'; g.beginPath(); g.moveTo(0, pivotY); g.lineTo(strip.width, pivotY); g.stroke();
    for (let i = 0; i < anim.frames.length; i++) { g.beginPath(); g.moveTo(i * outFw + pivotX, 0); g.lineTo(i * outFw + pivotX, outFh); g.stroke(); g.strokeStyle = '#555'; g.strokeRect(i * outFw, 0, outFw, outFh); g.strokeStyle = '#e22'; }
    const still = await loadImage('/assets/units/soldiers/soldier_01_up.png');
    g.drawImage(still, strip.width + 40, outFh - outFh * 0.92, outFh * 0.92 * 2 / 3, outFh * 0.92);
    g.fillStyle = '#eee'; g.font = '13px sans-serif';
    g.fillText('${name}: equal frames, red = pivot (feet line / centre); right = current soldier still at the same height', 6, outFh + 22);
    g.fillText('frame feet rows: ' + baselines.join(', ') + ' (pivot row ' + Math.round(pivotY) + ')', 6, outFh + 42);
    return { image: b64(strip, 'image/webp', 0.92), sheet: b64(sheet, 'image/jpeg', 0.9), baselines, outFw, outFh };
  })()`);
  write(anim.file, result.image);
  write(`art/review/${name}-review.jpg`, result.sheet);
  console.log(`  frame ${result.outFw}x${result.outFh}, feet rows ${result.baselines.join(', ')}`);
  if (anim.accent && anim.accentFile) await prepareAccent(page, name, anim);
}

// The customization accent mask (white on transparent, same cells as the
// source) cut and resampled exactly like the frames, then made hard-edged
// (alpha >= 96 -> opaque white, else clear) so a tint fills it cleanly.
async function prepareAccent(page, name, anim) {
  const result = await page.evaluate(`(async () => {
    const anim = ${JSON.stringify(anim)};
    const src = await loadImage('/' + anim.accent);
    const [, , fw, fh] = anim.frames[0];
    const scale = anim.output.frameHeight / fh, outFw = Math.round(fw * scale), outFh = anim.output.frameHeight;
    const strip = canvasOf(outFw * anim.frames.length, outFh);
    anim.frames.forEach(([x, y, w, h], i) => {
      const frame = canvasOf(w, h); frame.getContext('2d').drawImage(src, -x, -y);
      strip.getContext('2d').drawImage(resample(frame, outFw, outFh), i * outFw, 0);
    });
    const g = strip.getContext('2d'), img = g.getImageData(0, 0, strip.width, strip.height), d = img.data;
    let on = 0;
    for (let i = 0; i < d.length; i += 4) { const keep = d[i + 3] >= 96; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = keep ? 255 : 0; on += keep; }
    g.putImageData(img, 0, 0);
    return { image: b64(strip), on, w: strip.width, h: strip.height };
  })()`);
  write(anim.accentFile, result.image);
  console.log(`  accent ${result.w}x${result.h}, ${result.on} px`);
}

(async () => {
  const server = await startStaticServer(root);
  const page = await launchBrowser();
  try {
    await page.navigate(`${server.url}/tools/world-diagnostic.html`);
    await page.evaluate(`${PAGE_HELPERS}; true`);
    for (const [type, art] of Object.entries(manifest.facilities)) {
      if (!art.crop || (only && only !== type)) continue;
      await prepareFacility(page, type, art);
    }
    for (const [id, prop] of Object.entries(manifest.props || {})) {
      if (!prop.source || (only && only !== id)) continue;
      const image = await page.evaluate(`(async () => { const src = await loadImage('/${prop.source}');
        const c = canvasOf(src.naturalWidth, src.naturalHeight); c.getContext('2d').drawImage(src, 0, 0);
        ${prop.alphaCleanup ? 'cleanAlpha(c);' : ''} return b64(c); })()`);
      write(prop.file, image);
    }
    for (const [variant, portrait] of Object.entries(manifest.portraits || {})) {
      if (!portrait.delivered || (only && only !== `portrait-${variant}`)) continue;
      const image = await page.evaluate(`(async () => { const src = await loadImage('/${portrait.delivered}');
        const c = canvasOf(src.naturalWidth, src.naturalHeight); c.getContext('2d').drawImage(src, 0, 0);
        ${portrait.alphaCleanup ? 'cleanAlpha(c);' : ''} return b64(c); })()`);
      write(portrait.file, image);
    }
    const soldier = manifest.units.soldier;
    const frameSets = [
      ...Object.entries(soldier.activities).map(([name, anim]) => [`soldier-${name}`, anim]),
      ...Object.entries((soldier.walk && soldier.walk.drawn) || {}).map(([direction, anim]) => [`soldier-walk-${direction}`, anim]),
      ...Object.entries((soldier.idle && soldier.idle.drawn) || {}).map(([direction, anim]) => [`soldier-idle-${direction}`, anim]),
    ];
    for (const [name, anim] of frameSets) {
      if (!anim.frames || (only && only !== name)) continue;
      await prepareFrames(page, name, anim);
    }
    if (page.problems.length) throw new Error(page.problems.join('\n'));
  } finally {
    await page.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
