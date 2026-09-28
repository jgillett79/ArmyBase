// Customization accent close-up (brief 08): four soldiers, one per accent
// colour, walking down and standing idle with ?art=candidates (the only
// sets that have an accent mask), at 2.5x. Checks that the colour sits on
// the helmet band and shoulder patch and nowhere else.
//
//   node tools/capture-accent-closeup.cjs [outDir]   (default: captures/accent/)
const fs = require('node:fs');
const path = require('node:path');
const { sleep, startStaticServer, launchBrowser } = require('./lib/browser.cjs');

const root = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'captures', 'accent'));

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startStaticServer(root);
  const page = await launchBrowser();
  try {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await page.navigate(`${server.url}/index.html?art=candidates`, `document.readyState === 'complete' && typeof gameState !== 'undefined'`);
    await page.evaluate(`document.getElementById('gameArea').scrollIntoView({ block: 'center' }); true`);
    const scene = moving => `(() => { localStorage.clear(); gameState = new GameState(); gameState.chapter.done = true; gameState.lastCivilianSpawn = Infinity; gameState.gameClockMs = 9.5 * 3600000; /* unassigned soldiers are off duty then: no re-routing */
      const top = worldNodePosition('w1');
      ACCENT_COLOURS.forEach((accent, i) => { const u = new Unit({ x: top.x - 60 + i * 40, y: top.y, isCivilian: false });
        u.soldierVariant = 1; u.accent = accent.id; u.callsign = accent.label.split(' ')[0]; u.energy = 100; gameState.units.push(u);
        u.facing = 'down'; if (${moving}) u.setPath([{ x: u.x, y: u.y + 400 }]); u.lastPhase = u.routePhase; });
      window.__probe = () => { const u = gameState.units[0]; camera.zoom = 2.5; camera.centreOn(u.x + 60, u.y - 20); };
      __probe(); return true; })()`;
    for (const [name, moving] of [['walk', true], ['idle', false]]) {
      await page.evaluate(scene(moving));
      await sleep(1200);
      await page.evaluate('__probe(); true');
      await sleep(150);
      const r = await page.evaluate(`(() => { const r = document.getElementById('gameCanvas').getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; })()`);
      const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: r.x + r.w / 2 - 330, y: r.y + r.h / 2 - 170, width: 660, height: 300, scale: 1 } });
      fs.writeFileSync(path.join(outDir, `accent-${name}-2.5x.png`), Buffer.from(data, 'base64'));
      console.log(`saved accent-${name}-2.5x.png`);
    }
    const loaded = await page.evaluate(`!!accentStrip(ASSET_MANIFEST.units.soldier.walk.drawn.down, '#c9483c')`);
    console.log(`accent strip loaded: ${loaded}`);
    if (!loaded) throw new Error('accent strip did not load');
    if (page.problems.length) throw new Error(page.problems.join('\n'));
  } finally {
    await page.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
