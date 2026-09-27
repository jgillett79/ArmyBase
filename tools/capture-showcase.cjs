// One composed 960 x 576 gameplay screen for visual review, plus a
// side-by-side with the concept painting at the same size.
//
//   node tools/capture-showcase.cjs [outDir]      (default: captures/)
//
// Starts its own static server and headless Edge/Chrome, builds a small
// running base through the normal game rules (gate, Entrance Hall, Barracks,
// range, mess; soldiers walking to and training at range slots; a visitor at
// reception), lets it run so everyone is where the simulation put them, and
// captures the canvas with the camera framing gate, facilities and the
// terrain edges. Nothing is staged by hand-placing sprites.
const fs = require('node:fs');
const path = require('node:path');
const { sleep, startStaticServer, launchBrowser } = require('./lib/browser.cjs');

const root = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'captures'));

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startStaticServer(root);
  const page = await launchBrowser();
  try {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await page.navigate(`${server.url}/index.html`, `document.readyState === 'complete' && typeof gameState !== 'undefined'`);
    await page.evaluate(`localStorage.clear(); document.getElementById('gameArea').scrollIntoView({ block: 'center' });
      gameState = new GameState(); gameState.cash = 2000; gameState.food = 400;
      gameState.gameClockMs = 9.2 * 3600000;
      gameState.barracks.level = 1; gameState.shootingRange.level = 1; gameState.messHall.level = 1;
      const gate = worldNodePosition('gate_inside');
      const names = ['Grace Okafor', 'Kenji Rossi', 'Omar Chen', 'Aisha Novak'];
      names.forEach((name, i) => { const u = new Unit({ x: gate.x + i * 6, y: gate.y, isCivilian: false });
        u.name = name; u.soldierVariant = i + 2; u.energy = 100; gameState.units.push(u);
        if (i < 2) gameState.assignToBuilding(u.id, 'shooting_range'); });
      gameState.lastCivilianSpawn = 0; selectedUnitId = null;
      camera.zoom = 1; camera.centreOn(470, 500); true`);
    // Let the simulation walk everyone to their places; keep the camera framed.
    for (let i = 0; i < 26; i++) {
      await sleep(1000);
      await page.evaluate('camera.zoom = 1; camera.centreOn(470, 500); true');
    }
    const clip = await page.evaluate(`(() => { const r = document.getElementById('gameCanvas').getBoundingClientRect();
      return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height, scale: 1 }; })()`);
    const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip });
    fs.writeFileSync(path.join(outDir, 'showcase-960x576.png'), Buffer.from(data, 'base64'));
    // Side by side with the concept, both at 960 x 576.
    const pair = await page.evaluate(`new Promise(async resolve => {
      const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
      const game = await load('data:image/png;base64,${data}');
      const concept = await load('/art/concepts/terrain-shaped-base.webp');
      const c = document.createElement('canvas'); c.width = 1940; c.height = 616; const g = c.getContext('2d');
      g.fillStyle = '#16211d'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(game, 0, 40, 960, 576); g.drawImage(concept, 980, 40, 960, 576);
      g.fillStyle = '#eee'; g.font = 'bold 18px sans-serif';
      g.fillText('Game, live render at 960 x 576 (zoom 1)', 8, 26); g.fillText('Concept reference (art/concepts/terrain-shaped-base.webp) at 960 x 576', 988, 26);
      resolve(c.toDataURL('image/png').split(',')[1]); })`);
    fs.writeFileSync(path.join(outDir, 'showcase-vs-concept.png'), Buffer.from(pair, 'base64'));
    if (page.problems.length) throw new Error(page.problems.join('\n'));
    console.log(`saved ${path.join(outDir, 'showcase-960x576.png')} and showcase-vs-concept.png`);
  } finally {
    await page.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
