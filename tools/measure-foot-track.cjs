// Measures a walk sheet's foot track from its pixels, for sheets that were
// painted rather than rendered from the rig (which writes its own exact
// track). Also measures how well an accent mask stays on the figure.
//
//   node tools/measure-foot-track.cjs <sheet.png> <frames> <out.json> [accent.png]
//
// Per frame and per half of the cell (screen-left foot / screen-right foot):
// the lowest opaque row and its column. The lower of the two feet is taken
// as the planted one. This is a proxy — the lowest pixel of a boot, not a
// drawn contact point — so treat sub-pixel results as noise. Writes the same
// shape as art/rig/soldier_walk_down.json plus `measured: true`, so
// tools/validate-assets.cjs can run its planted-foot check on it.
const fs = require('node:fs');
const path = require('node:path');
const { startStaticServer, launchBrowser } = require('./lib/browser.cjs');

const root = path.resolve(__dirname, '..');
const [sheet, framesArg, out, accent] = process.argv.slice(2);
if (!sheet || !framesArg || !out) { console.error('usage: measure-foot-track.cjs <sheet.png> <frames> <out.json> [accent.png]'); process.exit(2); }
const frames = Number(framesArg);
// Same cell conventions as the rig (art/CHATGPT_FEEDBACK.md): 256 x 384,
// ground point (128, 330), 300 source px = 44 world px, 22 world px stride.
const CELL = [256, 384], PIVOT = [128, 330], STRIDE_WORLD = 22, PX_PER_WORLD = 300 / 44;

(async () => {
  const server = await startStaticServer(root);
  const page = await launchBrowser();
  try {
    await page.navigate(`${server.url}/tools/world-diagnostic.html`);
    const result = await page.evaluate(`(async () => {
      const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('cannot load ' + src)); i.src = src; });
      const pixels = img => { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0); return { w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data }; };
      const body = pixels(await load('/${sheet}'));
      const mask = ${accent ? `pixels(await load('/${accent}'))` : 'null'};
      const fw = body.w / ${frames}, A = (p, x, y) => p.d[(y * p.w + x) * 4 + 3];
      const track = [], accents = [];
      for (let f = 0; f < ${frames}; f++) {
        const feet = {};
        for (const [name, x0, x1] of [['left', 0, fw / 2], ['right', fw / 2, fw]]) {
          let found = null;
          for (let y = body.h - 1; y >= 0 && !found; y--) {
            const xs = []; for (let x = f * fw + x0; x < f * fw + x1; x++) if (A(body, x, y) > 128) xs.push(x - f * fw);
            if (xs.length) found = { x: xs.reduce((a, b) => a + b, 0) / xs.length, y };
          }
          feet[name] = found;
        }
        let top = -1; for (let y = 0; y < body.h && top < 0; y++) for (let x = f * fw; x < (f + 1) * fw; x++) if (A(body, x, y) > 128) { top = y; break; }
        track.push({ feet, top });
        if (mask) {
          let n = 0, on = 0, sx = 0, sy = 0;
          for (let y = 0; y < mask.h; y++) for (let x = f * fw; x < (f + 1) * fw; x++) if (A(mask, x, y) > 128) { n++; sx += x - f * fw; sy += y; if (A(body, x, y) > 128) on++; }
          accents.push({ pixels: n, onBody: n ? on / n : 0, centroid: n ? [sx / n, sy / n] : null });
        }
      }
      return { size: [body.w, body.h], track, accents };
    })()`);
    const track = result.track.map(({ feet }) => {
      const planted = feet.left.y >= feet.right.y ? 'left' : 'right';
      const foot = name => ({ x: Math.round(feet[name].x * 10) / 10, y: feet[name].y + 0.5, planted: name === planted });
      return { left: foot('left'), right: foot('right') };
    });
    const data = { cell: CELL, pivot: PIVOT, strideWorld: STRIDE_WORLD, pxPerWorld: PX_PER_WORLD, frames, measured: true,
      source: sheet, helmetTop: result.track.map(t => t.top), track };
    if (result.accents.length) data.accent = { file: accent, perFrame: result.accents.map(a => ({ pixels: a.pixels, onBody: Math.round(a.onBody * 1000) / 1000,
      centroid: a.centroid && a.centroid.map(v => Math.round(v * 10) / 10) })) };
    fs.writeFileSync(path.join(root, out), JSON.stringify(data, null, 1) + '\n');
    const expected = STRIDE_WORLD / frames * PX_PER_WORLD;
    console.log(`wrote ${out}`);
    track.forEach((t, i) => {
      const next = track[(i + 1) % track.length];
      const foot = t.left.planted ? 'left' : 'right';
      const moved = next[foot].planted ? (t[foot].y - next[foot].y).toFixed(1) : 'lifts';
      console.log(`  frame ${i + 1}: planted ${foot} row ${t[foot].y}, to next frame ${moved} (expected ${expected.toFixed(1)}), helmet row ${data.helmetTop[i]}`
        + (data.accent ? `, accent ${data.accent.perFrame[i].pixels}px ${(data.accent.perFrame[i].onBody * 100).toFixed(0)}% on body at ${data.accent.perFrame[i].centroid}` : ''));
    });
  } finally {
    await page.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
