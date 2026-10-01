// Brief 09 review captures: the daily routine at screen scale.
//
//   node tools/capture-daily-base.cjs [outDir] [--phone]
//   (default outDir: docs/screenshots/2026-10-01-daily-base)
//
// Starts its own static server and headless Edge/Chrome. Each scene builds
// a base through the normal game rules (starter facilities + range, weights
// and rec room, n soldiers), runs the simulation from 21:30 to the scene's
// game time with the same catch-up the game uses, pauses, frames the camera
// and captures the canvas. Nothing is hand-placed: everyone stands where
// the routine put them. Placeholder station art is marked in the frames.
const fs = require('node:fs');
const path = require('node:path');
const { sleep, startStaticServer, launchBrowser } = require('./lib/browser.cjs');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const phone = args.includes('--phone');
const outDir = path.resolve(args.find(a => !a.startsWith('--')) || path.join(root, 'docs', 'screenshots', '2026-10-01-daily-base'));

// hour: game time to stop at (day 1). reveal: indoor facility shown cut away.
const SCENES = [
  { name: 'gate-applicants', hour: 6.2, n: 4, centre: [-40, 600], zoom: 2.2, applicants: true, debug: false },
  { name: 'bathroom-queue', hour: 6.42, n: 4, centre: [1006, 470], zoom: 2.4, reveal: 'showers' },
  { name: 'breakfast-counter', hour: 7.25, n: 4, centre: [710, 470], zoom: 2.6 },
  { name: 'morning-training-range', hour: 9.1, n: 4, centre: [385, 320], zoom: 2.0 },
  { name: 'morning-training-weights', hour: 9.1, n: 4, centre: [740, 210], zoom: 2.0 },
  { name: 'shower-stalls', hour: 20.35, n: 4, centre: [1006, 470], zoom: 2.4, reveal: 'showers' },
  { name: 'bedtime-barracks', hour: 23.2, n: 4, centre: [1150, 230], zoom: 2.4, reveal: 'barracks' },
  { name: 'six-lunch-shortage', hour: 12.55, n: 6, centre: [740, 500], zoom: 1.8 },
  { name: 'overview-debug', hour: 7.3, n: 6, centre: [700, 470], zoom: 0.9, debug: true },
];

const SETUP = scene => `(() => {
  localStorage.clear(); gameState = new GameState(); gameState.cash = 5000; gameState.food = 300;
  gameState.shootingRange.level = 1; gameState.weightRoom.level = 1; gameState.recRoom.level = 1;
  gameState.chapter.done = true; gameState.chapter.introDispatched = true; gameState.chapter.dismissed = true;
  gameState.gameClockMs = 21.5 * 3600000;
  const names = ['Grace Okafor', 'Kenji Rossi', 'Omar Chen', 'Aisha Novak', 'Lena Park', 'Tomas Reyes'];
  for (let i = 0; i < ${scene.n}; i++) { const p = worldNodePosition('t4'); const u = new Unit({ x: p.x + i * 4, y: p.y, isCivilian: false });
    u.name = names[i]; u.outfit = 'uniform'; u.soldierVariant = i + 1; gameState.units.push(u); }
  gameState.assignBeds(); for (const u of gameState.units) gameState.rejoinRoutine(u);
  const target = ${scene.hour} >= 21.5 ? ${scene.hour} - 21.5 : 24 - 21.5 + ${scene.hour};
  gameState.catchUp(target * 3600 / GAME_MS_PER_REAL_MS, Date.now());
  if (${!!scene.applicants}) { for (let i = 0; i < 4; i++) { gameState.spawnCivilianIfRoom(); gameState.catchUp(3, Date.now()); } gameState.catchUp(8, Date.now()); }
  gameState.lastCivilianSpawn = Infinity; gameState.simSpeed = 0; selectedUnitId = null;
  revealedBuildingId = ${scene.reveal ? `'${scene.reveal}'` : 'null'}; debugScene = ${!!scene.debug};
  return true; })()`;

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startStaticServer(root);
  const page = await launchBrowser();
  const traces = {};
  try {
    await page.send('Emulation.setDeviceMetricsOverride', phone
      ? { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }
      : { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await page.navigate(`${server.url}/index.html`, `document.readyState === 'complete' && typeof gameState !== 'undefined'`);
    await page.evaluate(`document.getElementById('gameArea').scrollIntoView({ block: 'center' }); true`);
    for (const scene of SCENES) {
      await page.evaluate(SETUP(scene));
      for (let i = 0; i < 3; i++) {
        await sleep(400);
        await page.evaluate(`camera.zoom = ${phone ? scene.zoom * 0.75 : scene.zoom}; camera.centreOn(${scene.centre[0]}, ${scene.centre[1]}); true`);
      }
      await sleep(500);
      const clip = await page.evaluate(`(() => { const r = document.getElementById('gameCanvas').getBoundingClientRect();
        return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height, scale: 1 }; })()`);
      const { data } = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 85, clip });
      const file = path.join(outDir, `${scene.name}${phone ? '-phone' : ''}.jpg`);
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
      traces[scene.name] = await page.evaluate(`gameState.units.filter(u => !u.isCivilian).map(u => ({ name: u.name, text: gameState.routineText(u),
        stage: u.routine.stage, station: u.slot && u.slot.id, x: Math.round(u.x), y: Math.round(u.y) }))`);
      console.log(`saved ${file}`);
    }
    fs.writeFileSync(path.join(outDir, `scenes${phone ? '-phone' : ''}.json`), JSON.stringify(traces, null, 2));
    if (page.problems.length) throw new Error(page.problems.join('\n'));
  } finally {
    await page.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
