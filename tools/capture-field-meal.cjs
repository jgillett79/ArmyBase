// Starter field meal (brief 08) in the real page: the first soldier, still
// without a Mess Hall, drills at the range until they reach the hunger
// point; the meal happens once, the toast and the objective card explain
// it, and a reload serves no second meal. Desktop and portrait phone.
//
//   node tools/capture-field-meal.cjs [outDir]   (default: captures/field-meal/)
const fs = require('node:fs');
const path = require('node:path');
const { sleep, startStaticServer, launchBrowser } = require('./lib/browser.cjs');

const root = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'captures', 'field-meal'));
const ready = `document.readyState === 'complete' && typeof gameState !== 'undefined'`;

// A fresh chapter at the drill step: first soldier admitted, in uniform,
// assigned to the range, energy just above the hunger point.
const SCENE = `(() => { localStorage.clear(); gameState = new GameState(); gameState.lastCivilianSpawn = Infinity; gameState.gameClockMs = 10 * 3600000;
  const gate = worldNodePosition('gate_inside'); const u = new Unit({ x: gate.x, y: gate.y, isCivilian: true });
  u.name = 'Aisha Diallo'; gameState.units.push(u); gameState.recruit(u.id); u.outfit = 'uniform'; u.status = 'idle';
  gameState.setCallsign(u.id, 'Kestrel'); gameState.constructAt('shootingRange', gameState.shootingRange.zoneId);
  gameState.assignToBuilding(u.id, 'shooting_range'); u.energy = ENERGY_CRITICAL + 1.5;
  gameState.save(); fieldMealSaved = false; selectedUnitId = null; return true; })()`;

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startStaticServer(root);
  const lines = [];
  for (const phone of [false, true]) {
    const mode = phone ? 'phone' : 'desktop';
    const page = await launchBrowser();
    try {
      await page.send('Emulation.setDeviceMetricsOverride', phone
        ? { width: 390, height: 844, deviceScaleFactor: 2, mobile: true } : { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      await page.navigate(`${server.url}/index.html`, ready);
      await page.evaluate(SCENE);
      const food0 = await page.evaluate('gameState.food');
      let used = false;
      for (let i = 0; i < 150 && !used; i++) { await sleep(200); used = await page.evaluate('gameState.chapter.fieldMealUsed'); }
      if (!used) throw new Error(`${mode}: no field meal within 30 s`);
      await sleep(600);
      const seen = await page.evaluate(`({ toast: [...document.querySelectorAll('#eventFeed .event-toast')].map(t => t.textContent).find(t => t.includes('field meal')) || null,
        objective: document.getElementById('objectiveDetail').textContent, food: gameState.food, energy: Math.round(gameState.firstSoldier.energy),
        stored: JSON.parse(localStorage.getItem(SAVE_KEY)).chapter.fieldMealUsed })`);
      await page.evaluate(`document.getElementById('objectiveCard').scrollIntoView({ block: 'start' }); true`);
      await sleep(300);
      const { data } = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
      fs.writeFileSync(path.join(outDir, `field-meal-${mode}.jpg`), Buffer.from(data, 'base64'));
      if (!seen.toast || !/only happens once/.test(seen.toast)) throw new Error(`${mode}: meal toast missing or unclear: ${seen.toast}`);
      if (!/one starter field meal/.test(seen.objective) || !/Mess Hall/.test(seen.objective)) throw new Error(`${mode}: objective does not explain the meal: ${seen.objective}`);
      if (!seen.stored) throw new Error(`${mode}: the once-only flag was not saved straight away`);
      // Reload and starve again: no second meal.
      await page.navigate(`${server.url}/index.html?reload=1`, ready);
      await page.evaluate('gameState.firstSoldier.energy = ENERGY_CRITICAL; true');
      const food1 = await page.evaluate('gameState.food');
      await sleep(1500);
      const after = await page.evaluate(`({ food: gameState.food, meals: gameState.activityLog.filter(e => e.event === 'field_meal').length, flag: gameState.chapter.fieldMealUsed })`);
      if (after.meals !== 0 || after.food < food1 - 0.5 || !after.flag) throw new Error(`${mode}: second meal after reload ${JSON.stringify(after)}`);
      lines.push(`${mode}: meal once (food ${Math.round(food0)} → ${Math.round(seen.food)}, energy → ${seen.energy}); toast "${seen.toast}"; objective "${seen.objective}"; saved immediately; after reload at the hunger point: no second meal (food ${Math.round(food1)} → ${Math.round(after.food)})`);
      if (page.problems.length) throw new Error(page.problems.join('\n'));
    } finally {
      await page.close();
    }
  }
  server.close();
  fs.writeFileSync(path.join(outDir, 'field-meal.txt'), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
  console.log('PASS');
})().catch(error => { console.error(error); process.exit(1); });
