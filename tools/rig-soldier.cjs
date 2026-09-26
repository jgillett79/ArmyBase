// Builds the rigged soldier's frame sheets and review material.
//
//   node tools/rig-soldier.cjs
//
// Writes (sources for tools/prepare-art.cjs, which makes the game copies):
//   art/rig/soldier_walk_down.png (+ _accent.png)   6 x 256x384 cells
//   art/rig/soldier_idle_down.png (+ _accent.png)   2 cells
//   art/rig/soldier_walk_down.json                  pivot, stride, foot track
// and review material:
//   art/review/soldier-walk-down-rig-review.jpg  frames on checkerboard with foot
//     markers, onion skin, game-scale strip, and the rejected study for contrast
//   captures/soldier-walk-down-loop.webm     game-scale loop over scrolling
//     ground ticks: a planted foot stays on its tick, a sliding one doesn't
// The rig lives in tools/lib/soldier-rig.js (runs in the browser canvas).
const fs = require('node:fs');
const path = require('node:path');
const { startStaticServer, launchBrowser } = require('./lib/browser.cjs');

const root = path.resolve(__dirname, '..');
const write = (relative, base64) => {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(base64, 'base64'));
  console.log(`wrote ${relative} (${Math.round(fs.statSync(file).size / 1024)} KB)`);
};

(async () => {
  const server = await startStaticServer(root);
  const page = await launchBrowser();
  try {
    await page.navigate(`${server.url}/tools/world-diagnostic.html`);
    await page.evaluate(fs.readFileSync(path.join(__dirname, 'lib', 'soldier-rig.js'), 'utf8') + '; true');
    const out = await page.evaluate(`(async () => {
      const R = SoldierRig, walk = R.walk(), idle = R.idle();
      const png = c => c.toDataURL('image/png').split(',')[1];
      const checker = (g, x, y, w, h) => { for (let yy = 0; yy < h; yy += 16) for (let xx = 0; xx < w; xx += 16) { g.fillStyle = ((xx + yy) / 16) % 2 ? '#cfcfcf' : '#f2f2f2'; g.fillRect(x + xx, y + yy, 16, 16); } };

      // Review sheet.
      const review = document.createElement('canvas'); review.width = 6 * 256 + 20; review.height = 384 + 440; const g = review.getContext('2d');
      g.fillStyle = '#1d2621'; g.fillRect(0, 0, review.width, review.height);
      checker(g, 0, 0, 6 * 256, 384); g.drawImage(walk.sheet, 0, 0);
      g.font = 'bold 15px sans-serif';
      const names = ['R contact', 'R down', 'passing (L swing)', 'L contact', 'L down', 'passing (R swing)'];
      walk.track.forEach((t, i) => {
        for (const [foot, colour] of [[t.right, '#e0463a'], [t.left, '#2f7de0']]) {
          g.fillStyle = colour; g.globalAlpha = foot.planted ? 1 : 0.35;
          g.beginPath(); g.arc(i * 256 + foot.x, foot.y, 6, 0, 7); g.fill(); g.globalAlpha = 1;
        }
        g.strokeStyle = '#e22'; g.beginPath(); g.moveTo(i * 256, R.PIVOT.y); g.lineTo(i * 256 + 256, R.PIVOT.y); g.stroke();
        g.strokeStyle = '#555'; g.strokeRect(i * 256, 0, 256, 384);
        g.fillStyle = '#111'; g.fillText((i + 1) + ' ' + names[i], i * 256 + 6, 18);
      });
      // Onion skin: all six frames overlaid, so repeated phases would show as one figure.
      const oy = 400; g.fillStyle = '#eee'; g.fillText('onion skin (all 6 frames)', 8, oy + 16);
      checker(g, 0, oy + 24, 256, 384 * 0.9);
      g.globalAlpha = 0.28; for (let i = 0; i < 6; i++) g.drawImage(walk.sheet, i * 256, 0, 256, 384, 0, oy + 24, 256 * 0.9, 384 * 0.9); g.globalAlpha = 1;
      // Game scale: 44 world px at zoom 1 and 1.6.
      g.fillStyle = '#eee'; g.fillText('game scale: zoom 1 and 1.6', 290, oy + 16);
      g.fillStyle = '#6f7c4b'; g.fillRect(290, oy + 24, 560, 170);
      for (let i = 0; i < 6; i++) {
        g.drawImage(walk.sheet, i * 256, 0, 256, 384, 300 + i * 40, oy + 40, 256 / 6.82, 384 / 6.82);
        g.drawImage(walk.sheet, i * 256, 0, 256, 384, 300 + i * 90, oy + 100, 256 / 6.82 * 1.6, 384 / 6.82 * 1.6);
      }
      // The rejected study for contrast.
      const rejected = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = '/art/explorations/soldier-down-walk-rejected.webp'; });
      g.fillStyle = '#eee'; g.fillText('rejected study: onion skin of 6 figures', 880, oy + 16);
      checker(g, 880, oy + 24, 256, 384 * 0.9);
      g.globalAlpha = 0.28; const cw = rejected.naturalWidth / 6;
      for (let i = 0; i < 6; i++) g.drawImage(rejected, i * cw, 0, cw, rejected.naturalHeight, 880, oy + 24, 256 * 0.9, 256 * 0.9 * rejected.naturalHeight / cw);
      g.globalAlpha = 1;
      g.fillStyle = '#eee'; g.fillText('idle (2 frames)', 1180, oy + 16); checker(g, 1160, oy + 24, 256 * 0.9 * 2, 384 * 0.9);
      g.drawImage(idle.sheet, 1160, oy + 24, 512 * 0.9, 384 * 0.9);

      // Loop recording at game scale: ground ticks scroll at walking speed;
      // the frame is chosen from distance walked, exactly as animation.js does.
      const loop = document.createElement('canvas'); loop.width = 480; loop.height = 270; const lg = loop.getContext('2d');
      const zoom = 2.5, speed = 38; // world px/s (mid of 30-46)
      const recorder = new MediaRecorder(loop.captureStream(30), { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 2e6 });
      const chunks = []; recorder.ondataavailable = e => chunks.push(e.data);
      recorder.start(500);
      const start = performance.now();
      await new Promise(done => {
        const frame = () => {
          const t = (performance.now() - start) / 1000;
          const distance = t * speed;
          lg.fillStyle = '#6f7c4b'; lg.fillRect(0, 0, loop.width, loop.height);
          // Ground ticks every 5.5 world px move UP the screen as the soldier walks down (toward us).
          lg.fillStyle = 'rgba(40, 50, 25, 0.8)';
          const pivotY = 150;
          for (let k = -12; k < 12; k++) { const y = pivotY + (k * 5.5 - (distance % 5.5)) * zoom; lg.fillRect(180, y, 120, 2); }
          const index = Math.floor((distance / R.STRIDE_WORLD) * 6) % 6;
          const scale = zoom / R.PX_PER_WORLD;
          lg.drawImage(walk.sheet, index * 256, 0, 256, 384, 240 - R.PIVOT.x * scale, pivotY - R.PIVOT.y * scale, 256 * scale, 384 * scale);
          lg.fillStyle = '#fff'; lg.font = '12px sans-serif'; lg.fillText('rig walk (down), ' + speed + ' world px/s, zoom ' + zoom + ', frame ' + (index + 1), 8, 16);
          if (t < 8) requestAnimationFrame(frame); else done();
        };
        requestAnimationFrame(frame);
      });
      await new Promise(r => { recorder.onstop = r; recorder.stop(); });
      const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer()); let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));

      return { walk: png(walk.sheet), walkAccent: png(walk.accent), idle: png(idle.sheet), idleAccent: png(idle.accent),
        review: review.toDataURL('image/jpeg', 0.88).split(',')[1], loop: btoa(s),
        meta: { cell: [256, 384], pivot: [R.PIVOT.x, R.PIVOT.y], strideWorld: R.STRIDE_WORLD, pxPerWorld: R.PX_PER_WORLD, frames: 6, track: walk.track } };
    })()`);
    write('art/rig/soldier_walk_down.png', out.walk);
    write('art/rig/soldier_walk_down_accent.png', out.walkAccent);
    write('art/rig/soldier_idle_down.png', out.idle);
    write('art/rig/soldier_idle_down_accent.png', out.idleAccent);
    fs.writeFileSync(path.join(root, 'art/rig/soldier_walk_down.json'), JSON.stringify(out.meta, null, 2) + '\n');
    console.log('wrote art/rig/soldier_walk_down.json');
    write('art/review/soldier-walk-down-rig-review.jpg', out.review);
    write('captures/soldier-walk-down-loop.webm', out.loop);
    if (page.problems.length) throw new Error(page.problems.join('\n'));
  } finally {
    await page.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
