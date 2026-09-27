// Gate 0 baseline and visual contract (FIRST_BASE_DELIVERY_PLAN.md).
//
//   node tools/capture-gate0.cjs [outDir]      (default: captures/gate0/)
//
// Starts its own static server and headless Edge/Chrome and writes:
//   gate0-fresh-960x576.png     a new game at the default camera
//   gate0-target-960x576.png    the target scene through normal game rules:
//                               gate, brook bridge, Entrance Hall, range,
//                               Barracks, four people (two at range slots,
//                               one crossing the bridge, a visitor waiting)
//   gate0-contract-960x576.png  the same frame with the contract overlay:
//                               zones, art boxes, entrances, slots, bridge
//                               deck and ends, checkpoint anchors, props and
//                               a 44 px person ruler, all labelled in world px
//   gate0-phone-portrait.png    the target scene on a 390 x 844 phone
//   gate0-contract.json         every measurement in the overlay, for art
// Scene setup reaches into the page's globals; it is a review tool.
const fs = require('node:fs');
const path = require('node:path');
const { sleep, startStaticServer, launchBrowser } = require('./lib/browser.cjs');

const root = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'captures', 'gate0'));

// Export density the art contract asks for: max zoom 1.6 x a 2x phone screen.
const EXPORT_PX_PER_WORLD = 3;

const SCENE = `(() => {
  localStorage.clear();
  gameState = new GameState(); gameState.cash = 2000; gameState.food = 400;
  gameState.gameClockMs = 9.2 * 3600000;
  gameState.barracks.level = 1; gameState.shootingRange.level = 1;
  const gate = worldNodePosition('gate_inside');
  ['Grace Okafor', 'Kenji Rossi', 'Omar Chen'].forEach((name, i) => {
    const u = new Unit({ x: gate.x + i * 8, y: gate.y, isCivilian: false });
    u.name = name; u.soldierVariant = i + 2; u.energy = 100; gameState.units.push(u);
    if (i < 2) gameState.assignToBuilding(u.id, 'shooting_range');
  });
  gameState.lastCivilianSpawn = 0; gameState.spawnCivilianIfRoom();
  selectedUnitId = null; camera.home(); return true; })()`;

// Omar walks back over the bridge toward the gate once the others are placed.
const CROSSING = `(() => { const u = gameState.units.find(x => x.name === 'Omar Chen');
  u.x = 214; u.y = 615; u.status = UNIT_STATUS.IDLE; gameState.releaseSlot(u, 'review');
  u.setPath([{ x: 150, y: 613, phase: 'travel' }, { x: 120, y: 612, phase: 'travel' }]); return true; })()`;

const MEASURE = `(() => {
  const r = v => Math.round(v * 10) / 10;
  const pts = list => list.map(([x, y]) => [r(x), r(y)]);
  const bounds = poly => { const b = polygonBounds(poly); return { minX: r(b.minX), minY: r(b.minY), maxX: r(b.maxX), maxY: r(b.maxY) }; };
  const view = cam => ({ viewW: cam.viewW, viewH: cam.viewH, zoom: r(cam.zoom * 1000) / 1000,
    world: { x: r(cam.x), y: r(cam.y), w: r(cam.viewW / cam.zoom), h: r(cam.viewH / cam.zoom) } });
  const zones = WORLD.zones.map(zone => {
    const b = polygonBounds(zone.footprint), c = polygonCentroid(zone.footprint);
    const building = gameState.allBuildings.find(x => x.zoneId === zone.id);
    const artWidth = (b.maxX - b.minX) * 1.1;
    return { id: zone.id, label: zone.label, doorSide: zone.doorSide, types: zone.types,
      defaultBuilding: Object.keys(WORLD.defaultPlacements).find(t => WORLD.defaultPlacements[t] === zone.id) || null,
      footprint: pts(zone.footprint), bounds: bounds(zone.footprint),
      entrance: { x: zone.entrance.x, y: zone.entrance.y },
      artAnchor: { x: r(c.x), y: r(b.maxY - 6), note: 'ground pivot of facility art (footprint centre x, bottom - 6)' },
      artWidthWorld: r(artWidth), artWidthExportPx: Math.round(artWidth * ${EXPORT_PX_PER_WORLD}),
      slots: zone.slots.map(s => ({ id: s.id, x: s.x, y: s.y, facing: s.facing })),
      building: building ? { type: building.type, built: building.isBuilt, art: (ASSET_MANIFEST.facilities[building.type] || {}).status,
        rect: building.isBuilt ? (s => ({ x: r(s.x), y: r(s.y), w: r(s.w), h: r(s.h) }))(facilitySpriteRect(building)) : null,
        slots: building.isBuilt ? gameState.facilitySlots(building).map(s => ({ id: s.slotId, x: r(s.x), y: r(s.y), facing: s.facing, activity: s.activity })) : [] } : null };
  });
  const bridges = WORLD.bridges.map(b => {
    const length = Math.hypot(b.east[0] - b.west[0], b.east[1] - b.west[1]);
    return { ...b, deck: pts(bridgeDeckPolygon(b)), lengthWorld: r(length), railHeightWorld: BRIDGE_RAIL_H, frontDepthY: bridgeFrontDepth(b),
      waterSpan: WORLD.terrain.filter(a => b.crosses.includes(a.id)).map(a => a.id) };
  });
  const narrow = new Camera(390, 552); // the phone canvas at 390 x 844 (see gate0-phone-portrait.png)
  return {
    generated: new Date().toISOString().slice(0, 10), worldId: WORLD.id, world: { width: WORLD_W, height: WORLD_H },
    camera: { desktop: view(camera), phoneHome: view(narrow), minZoomDesktop: r(Math.max(960 / WORLD_W, 576 / WORLD_H) * 1000) / 1000,
      maxZoom: CAMERA_MAX_ZOOM, homeCentre: CAMERA_HOME, homeCentreNarrow: CAMERA_HOME_NARROW,
      projection: 'top-down oblique: 1 world px = 1 screen px at zoom 1 on both axes; heights drawn straight up the screen; no isometric skew' },
    scale: { unitWorldHeight: UNIT_H, exportPxPerWorld: ${EXPORT_PX_PER_WORLD},
      character: { sourceBox: [256, 384], groundRow: 330, helmetRow: 30, sourcePxPerWorld: r(300 / UNIT_H * 100) / 100 },
      door: 'about 1.3 x a person: 57 world px' },
    gate: { nodes: { gate_outside: WORLD.nodes.gate_outside, gate: WORLD.nodes.gate, gate_inside: WORLD.nodes.gate_inside },
      checkpoint: { ...WORLD.checkpoint, kiosk: pts(WORLD.checkpoint.kiosk) }, interimSprite: 'assets/buildings/gatehouse.png' },
    bridges, zones,
    props: SCENE_PROP_PLACEMENTS.map(p => ({ ...p, file: ASSET_MANIFEST.props[p.prop].file })),
    aidStation: WORLD.nodes.aid_station,
  };
})()`;

// Contract overlay painted over a captured frame (both in screen px).
const OVERLAY = (png, contract) => `new Promise(async resolve => {
  const load = src => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
  const shot = await load('data:image/png;base64,${png}');
  const c = document.createElement('canvas'); c.width = 960; c.height = 576; const g = c.getContext('2d');
  g.drawImage(shot, 0, 0);
  g.fillStyle = 'rgba(10, 16, 14, 0.35)'; g.fillRect(0, 0, 960, 576);
  const K = ${JSON.stringify(contract)};
  const S = (x, y) => camera.worldToScreen(x, y);
  const poly = (list, stroke, fill, dash = []) => { g.beginPath(); list.forEach(([x, y], i) => { const p = S(x, y); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); });
    g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } g.setLineDash(dash); g.strokeStyle = stroke; g.lineWidth = 2; g.stroke(); g.setLineDash([]); };
  const dot = (x, y, colour, rad = 4) => { const p = S(x, y); g.beginPath(); g.arc(p.x, p.y, rad, 0, Math.PI * 2); g.fillStyle = colour; g.fill(); g.strokeStyle = '#111'; g.lineWidth = 1; g.stroke(); };
  const text = (s, x, y, colour = '#fff', size = 11, align = 'left') => { const p = S(x, y); g.font = 'bold ' + size + 'px monospace'; g.textAlign = align;
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(s, p.x, p.y); g.fillStyle = colour; g.fillText(s, p.x, p.y); };
  for (const z of K.zones) {
    poly(z.footprint, '#9fe8ff', null, z.building && z.building.built ? [] : [6, 5]);
    if (z.building && z.building.rect) { const q = z.building.rect; poly([[q.x, q.y], [q.x + q.w, q.y], [q.x + q.w, q.y + q.h], [q.x, q.y + q.h]], 'rgba(255, 214, 90, 0.9)', null, [3, 4]); }
    dot(z.entrance.x, z.entrance.y, '#ff5a4a', 5);
    text('door ' + z.entrance.x + ',' + z.entrance.y, z.entrance.x + 7, z.entrance.y + 4, '#ffb0a8', 10);
    dot(z.artAnchor.x, z.artAnchor.y, '#ffd65a', 3);
    const slots = z.building && z.building.slots.length ? z.building.slots : z.slots;
    for (const s of slots) { dot(s.x, s.y, '#7dff9a', 3); text(s.id, s.x + 4, s.y - 4, '#c9ffd4', 9); }
    text(z.id + (z.building ? ' [' + z.building.type + ']' : ''), z.bounds.minX, z.bounds.minY - 4, '#e6fbff', 11);
    text('art w ' + z.artWidthWorld + ' world = ' + z.artWidthExportPx + ' px', z.bounds.minX, z.bounds.minY + 10, '#ffe7a0', 9);
  }
  for (const b of K.bridges) {
    poly(b.deck, '#ffcf6b', 'rgba(255, 207, 107, 0.25)');
    for (const [label, e] of [['W', b.west], ['E', b.east]]) { dot(e[0], e[1], '#ffcf6b', 5); text(label + ' ' + e[0] + ',' + e[1], e[0] - 6, e[1] + (label === 'W' ? 30 : -22), '#ffe2a0', 10); }
    text(b.id + ': deck ' + b.lengthWorld + ' x ' + b.halfWidth * 2 + ' world, rail ' + b.railHeightWorld, b.west[0] - 20, b.west[1] + 44, '#ffe2a0', 10);
  }
  const cp = K.gate.checkpoint;
  poly(cp.kiosk, '#f28bff', 'rgba(242, 139, 255, 0.2)');
  text('kiosk', cp.kiosk[0][0] + 2, cp.kiosk[0][1] + 12, '#f9c8ff', 10);
  dot(cp.pause.x, cp.pause.y, '#f28bff'); text('pause', cp.pause.x - 16, cp.pause.y + 16, '#f9c8ff', 9);
  dot(cp.guard.x, cp.guard.y, '#f28bff'); text('guard', cp.guard.x + 5, cp.guard.y - 3, '#f9c8ff', 9);
  { const h = S(cp.boomHinge.x, cp.boomHinge.y), shut = S(cp.boomHinge.x, cp.boomHinge.y - cp.boomLength), open = S(cp.boomHinge.x + cp.boomLength, cp.boomHinge.y);
    g.lineWidth = 3; g.strokeStyle = '#ff6b6b'; g.beginPath(); g.moveTo(h.x, h.y); g.lineTo(shut.x, shut.y); g.stroke();
    g.setLineDash([4, 3]); g.strokeStyle = '#ffd0d0'; g.beginPath(); g.moveTo(h.x, h.y); g.lineTo(open.x, open.y); g.stroke(); g.setLineDash([]);
    dot(cp.boomHinge.x, cp.boomHinge.y, '#ff6b6b'); text('boom hinge ' + cp.boomHinge.x + ',' + cp.boomHinge.y + ' (swings)', cp.boomHinge.x + 4, cp.boomHinge.y + 14, '#ffd0d0', 9); }
  for (const p of K.props) { dot(p.x, p.y, '#c0a0ff', 3); text(p.prop.replace('scene_', ''), p.x + 4, p.y + 10, '#ddd0ff', 8); }
  { const x = 900, y = 520, top = S(0, 0); const h = ${`UNIT_H`} * camera.zoom;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - 60, y - h - 16, 110, h + 30);
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h); g.moveTo(x - 6, y); g.lineTo(x + 6, y); g.moveTo(x - 6, y - h); g.lineTo(x + 6, y - h); g.stroke();
    g.font = 'bold 10px monospace'; g.textAlign = 'right'; g.fillStyle = '#fff'; g.fillText('person', x - 8, y - h / 2); g.fillText('44 world', x - 8, y - h / 2 + 12); }
  g.textAlign = 'left'; g.font = 'bold 12px monospace'; g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(60, 548, 640, 24);
  g.fillStyle = '#fff'; g.fillText('Gate 0 contract - world px; camera zoom ' + camera.zoom + ', view x ' + Math.round(camera.x) + '..' + Math.round(camera.x + 960 / camera.zoom) + ', y ' + Math.round(camera.y) + '..' + Math.round(camera.y + 576 / camera.zoom), 68, 565);
  resolve(c.toDataURL('image/png').split(',')[1]); })`;

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startStaticServer(root);
  const page = await launchBrowser();
  const canvasShot = async () => {
    const clip = await page.evaluate(`(() => { const r = document.getElementById('gameCanvas').getBoundingClientRect();
      return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height, scale: 1 }; })()`);
    return (await page.send('Page.captureScreenshot', { format: 'png', clip })).data;
  };
  const save = (name, base64) => { fs.writeFileSync(path.join(outDir, name), Buffer.from(base64, 'base64')); console.log(`saved ${name}`); };
  const holdHome = async seconds => { for (let i = 0; i < seconds; i++) { await sleep(1000); await page.evaluate('camera.home(); true'); } };
  try {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await page.navigate(`${server.url}/index.html`, `document.readyState === 'complete' && typeof gameState !== 'undefined'`);
    await page.evaluate(`localStorage.clear(); gameState = new GameState(); gameState.gameClockMs = 8 * 3600000; gameState.lastCivilianSpawn = 0;
      selectedUnitId = null; camera.home(); document.getElementById('gameArea').scrollIntoView({ block: 'center' }); true`);
    await holdHome(8);
    save('gate0-fresh-960x576.png', await canvasShot());

    await page.evaluate(SCENE);
    const ready = `gameState.units.filter(u => u.routePhase === 'using' && u.slot && u.slot.buildingId === 'shooting_range').length === 2
      && gameState.units.some(u => u.isCivilian && u.slot)`;
    for (let i = 0; i < 40 && !(await page.evaluate(ready)); i++) { await sleep(1000); await page.evaluate('camera.home(); true'); }
    await page.evaluate(CROSSING);
    await sleep(700);
    const target = await canvasShot();
    save('gate0-target-960x576.png', target);
    const contract = await page.evaluate(MEASURE);
    contract.targetSceneReady = await page.evaluate(ready);
    save('gate0-contract-960x576.png', await page.evaluate(OVERLAY(target, contract)));
    fs.writeFileSync(path.join(outDir, 'gate0-contract.json'), JSON.stringify(contract, null, 1) + '\n');
    console.log('saved gate0-contract.json');

    await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await page.evaluate(`camera.setViewport(document.getElementById('gameCanvas').getBoundingClientRect().width, document.getElementById('gameCanvas').getBoundingClientRect().height); true`);
    await sleep(500);
    await page.evaluate(`camera.home(); document.getElementById('gameArea').scrollIntoView({ block: 'start' }); true`);
    await sleep(600);
    save('gate0-phone-portrait.png', (await page.send('Page.captureScreenshot', { format: 'png' })).data);
    if (page.problems.length) throw new Error(page.problems.join('\n'));
    if (!contract.targetSceneReady) throw new Error('target scene did not settle: range slots or waiting visitor missing');
  } finally {
    await page.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
