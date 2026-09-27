// Terrain strip trial: the same views with the procedural edges (default)
// and with the candidate strips (?art=candidates), side by side.
//
//   node tools/capture-terrain-trial.cjs [outDir]   (default: captures/terrain-trial/)
//
// Writes one PNG per view: left procedural, right strips, 960 x 576 each.
const fs = require('node:fs');
const path = require('node:path');
const { sleep, startStaticServer, launchBrowser } = require('./lib/browser.cjs');

const root = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'captures', 'terrain-trial'));
const VIEWS = [
  { name: 'north-cliff-1x', x: 700, y: 300, zoom: 1 },
  { name: 'gate-spur-1.6x', x: 140, y: 480, zoom: 1.6 },
  { name: 'creek-pond-1x', x: 560, y: 700, zoom: 1 },
  { name: 'creek-1.6x', x: 420, y: 820, zoom: 1.6 },
  { name: 'river-east-1x', x: 1300, y: 600, zoom: 1 },
];

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startStaticServer(root);
  const page = await launchBrowser();
  const shots = {};
  try {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const mode of ['procedural', 'strips']) {
      await page.navigate(`${server.url}/index.html${mode === 'strips' ? '?art=candidates' : ''}`, `document.readyState === 'complete' && typeof gameState !== 'undefined'`);
      await page.evaluate(`localStorage.clear(); gameState = new GameState(); gameState.lastCivilianSpawn = Date.now() + 1e9;
        for (const b of gameState.allBuildings) { if (b.buildCost) b.build(); else b.level = Math.max(b.level, 1); }
        document.getElementById('gameArea').scrollIntoView({ block: 'center' }); true`);
      if (mode === 'strips') {
        for (let i = 0; i < 50 && await page.evaluate('terrainStripsReady()') < 3; i++) await sleep(100);
        if (await page.evaluate('terrainStripsReady()') < 3) throw new Error('terrain strips did not load');
      }
      await sleep(800);
      for (const view of VIEWS) {
        await page.evaluate(`camera.zoom = ${view.zoom}; camera.centreOn(${view.x}, ${view.y}); true`);
        await sleep(250);
        const clip = await page.evaluate(`(() => { const r = document.getElementById('gameCanvas').getBoundingClientRect();
          return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height, scale: 1 }; })()`);
        (shots[view.name] ||= {})[mode] = (await page.send('Page.captureScreenshot', { format: 'png', clip })).data;
      }
    }
    for (const view of VIEWS) {
      const pair = await page.evaluate(`new Promise(async resolve => {
        const load = b => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + b; });
        const a = await load('${shots[view.name].procedural}'), b = await load('${shots[view.name].strips}');
        const c = document.createElement('canvas'); c.width = 1930; c.height = 606; const g = c.getContext('2d');
        g.fillStyle = '#16211d'; g.fillRect(0, 0, c.width, c.height); g.drawImage(a, 0, 30); g.drawImage(b, 970, 30);
        g.fillStyle = '#eee'; g.font = 'bold 16px sans-serif';
        g.fillText('${view.name}: procedural (current default)', 8, 20); g.fillText('${view.name}: candidate strips (?art=candidates)', 978, 20);
        resolve(c.toDataURL('image/png').split(',')[1]); })`);
      fs.writeFileSync(path.join(outDir, `${view.name}.png`), Buffer.from(pair, 'base64'));
      console.log(`saved ${view.name}.png`);
    }
    if (page.problems.length) throw new Error(page.problems.join('\n'));
  } finally {
    await page.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
