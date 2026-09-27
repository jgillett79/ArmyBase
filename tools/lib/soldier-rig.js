// soldier-rig.js — runs inside a browser page (see tools/rig-soldier.cjs).
// A jointed soldier drawn in the game's house style (dark outline, olive
// jacket, khaki trousers, upper-left light), posed from gait maths so every
// walk frame is a distinct phase and stance feet stay planted in the world.
//
// Coordinates: one 256 x 384 cell. Ground point under the body (the sprite
// pivot) is PIVOT; world depth toward the camera maps 1:1 to screen +y and
// height to screen -y, matching the game's projection (a unit walking 1
// world px down moves 1 px down on screen).
(() => {
  const CELL_W = 256, CELL_H = 384;
  const PX_PER_WORLD = 300 / 44;          // figure is 300 px tall = 44 world px (unitWorldHeight)
  const STRIDE_WORLD = 22;                // world px per full cycle (two steps)
  const HALF_STEP = (STRIDE_WORLD / 4) * PX_PER_WORLD; // stance foot travels +A .. -A
  const PIVOT = { x: 128, y: 368 - Math.ceil(HALF_STEP) };
  const THIGH = 52, SHIN = 50, ANKLE = 14;
  const HIP_HALF = 19, SHOULDER_HALF = 44;
  const INK = '#1d2217';
  const C = {
    jacket: '#6e7a3c', jacketShade: '#57622f', trousers: '#b39a66', trousersShade: '#94804f',
    boot: '#4a3423', bootShade: '#35251a', helmet: '#62703a', helmetShade: '#4c5a2c', skin: '#d9a57a',
    skinShade: '#b9855e', webbing: '#7d6a3d', pouch: '#6d6a38', rifle: '#3a2d22', metal: '#3b3d3a',
  };

  const smooth = t => t * t * (3 - 2 * t);

  // Two-bone IK in the (depth, height) plane; knee bends toward the camera.
  function leg(hip, foot) {
    const dz = foot.depth - hip.depth, dh = foot.height - hip.height;
    const dist = Math.min(Math.hypot(dz, dh), THIGH + SHIN - 0.01);
    const a = Math.acos((THIGH * THIGH + dist * dist - SHIN * SHIN) / (2 * THIGH * dist));
    const base = Math.atan2(dh, dz);
    const kneeAngle = base + a; // positive rotation bends knee forward (toward camera)
    return { depth: hip.depth + Math.cos(kneeAngle) * THIGH, height: hip.height + Math.sin(kneeAngle) * THIGH };
  }

  const project = (x, depth, height) => ({ x, y: PIVOT.y + depth - height });

  // Pose for cycle phase p in [0, 1): right foot contacts at p = 0, left at 0.5.
  function walkPose(p) {
    const body = (p * 2) % 1; // 0 contact, 1/3 down, 2/3 passing
    // Hip height keyframes: contact 107, down 103 (weight lands), passing 113.
    const keys = [[0, 107], [1 / 3, 103], [2 / 3, 113], [1, 107]];
    const k = keys.findIndex(([t]) => t > body) - 1;
    const hipHeight = keys[k][1] + (keys[k + 1][1] - keys[k][1]) * (body - keys[k][0]) / (keys[k + 1][0] - keys[k][0]);
    const foot = (phase) => {
      const q = ((phase % 1) + 1) % 1;
      if (q < 0.5) return { depth: HALF_STEP - (q / 0.5) * 2 * HALF_STEP, height: ANKLE, planted: true, q };
      // Swing: the foot stays back and rises through "down", passes under the
      // body at its highest on "passing" (s = 2/3), then reaches forward to land.
      const s = (q - 0.5) / 0.5;
      const reach = s < 2 / 3 ? 0.5 * Math.pow(s / (2 / 3), 1.8) : 0.5 + 0.5 * smooth((s - 2 / 3) / (1 / 3));
      const lift = Math.sin(Math.PI * Math.min(1, s / 0.95)) * 30;
      return { depth: -HALF_STEP + reach * 2 * HALF_STEP, height: ANKLE + lift, planted: false, q };
    };
    const right = foot(p), left = foot(p + 0.5);
    const sway = (right.planted ? -1 : 1) * 2 * Math.sin(Math.PI * body);
    return {
      hipHeight, sway, lean: 3,
      right, left,
      // Arms swing opposite to the legs: right arm forward when left foot is forward.
      armSwing: { right: left.depth * 0.85, left: right.depth * 0.85 },
      breath: 0,
    };
  }

  function idlePose(frame) {
    return {
      hipHeight: 116 - frame * 0.8, sway: 0, lean: 0,
      right: { depth: 3, height: ANKLE, planted: true }, left: { depth: -3, height: ANKLE, planted: true },
      armSwing: { right: 0, left: 0 }, breath: frame * 2,
    };
  }

  // A limb segment: ink outline, fill, then a shade strip on the side away
  // from the upper-left key light. Round caps join segments without seams.
  function capsule(g, a, b, width, fill, shade) {
    g.lineCap = 'round';
    g.strokeStyle = INK; g.lineWidth = width + 9;
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    g.strokeStyle = fill; g.lineWidth = width;
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    if (shade) {
      const off = width * 0.28;
      g.strokeStyle = shade; g.lineWidth = width * 0.38;
      g.beginPath(); g.moveTo(a.x + off, a.y + 2); g.lineTo(b.x + off, b.y - 2); g.stroke();
    }
  }

  function drawBoot(g, ankle, side) {
    const x = ankle.x, y = ankle.y;
    g.beginPath();
    g.moveTo(x - 15, y - 10); g.lineTo(x + 15, y - 10); g.lineTo(x + 17, y + 8);
    g.quadraticCurveTo(x, y + 20, x - 17, y + 8); g.closePath();
    g.fillStyle = C.boot; g.fill();
    g.save(); g.clip(); g.fillStyle = C.bootShade; g.fillRect(x + 3, y - 12, 20, 34); g.restore();
    g.strokeStyle = INK; g.lineWidth = 5; g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x - 11, y - 2); g.lineTo(x + 11, y - 2); g.stroke(); // laces line
  }

  function drawLeg(g, pose, sideSign, foot) {
    const hipX = PIVOT.x + pose.sway + sideSign * HIP_HALF;
    const hip = { depth: 0, height: pose.hipHeight };
    const knee = leg(hip, foot);
    const footX = PIVOT.x + sideSign * (HIP_HALF + 1);
    const H = project(hipX, hip.depth, hip.height), K = project((hipX + footX) / 2, knee.depth, knee.height), A = project(footX, foot.depth, foot.height);
    capsule(g, H, K, 34, C.trousers, C.trousersShade);
    capsule(g, K, A, 29, C.trousers, C.trousersShade);
    // trouser cuff bloused over the boot
    g.fillStyle = C.trousersShade; g.beginPath(); g.ellipse(A.x, A.y - 12, 16, 6, 0, 0, Math.PI * 2); g.fill();
    drawBoot(g, { x: A.x, y: A.y + 2 }, sideSign);
    return A;
  }

  function drawArm(g, pose, sideSign, swing, hipY, shoulderY) {
    const sx = PIVOT.x + pose.sway + sideSign * SHOULDER_HALF;
    const S = { x: sx, y: shoulderY + 10 };
    const E = { x: sx + sideSign * 5, y: shoulderY + 52 + swing * 0.35 };
    const Hd = { x: sx + sideSign * 3, y: shoulderY + 96 + swing * 0.8 };
    capsule(g, S, E, 26, C.jacket, C.jacketShade);
    capsule(g, E, Hd, 23, C.jacket, C.jacketShade);
    g.beginPath(); g.arc(Hd.x, Hd.y + 6, 10, 0, Math.PI * 2); g.fillStyle = C.skin; g.fill(); g.strokeStyle = INK; g.lineWidth = 4; g.stroke();
  }

  function drawTorso(g, pose, hipY, shoulderY) {
    const cx = PIVOT.x + pose.sway;
    // Rifle slung across the back: barrel and butt show past the shoulders.
    g.strokeStyle = INK; g.lineWidth = 11; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx + 30, shoulderY - 30); g.lineTo(cx - 40, hipY - 6); g.stroke();
    g.strokeStyle = C.rifle; g.lineWidth = 6; g.beginPath(); g.moveTo(cx + 30, shoulderY - 30); g.lineTo(cx - 40, hipY - 6); g.stroke();
    g.strokeStyle = C.metal; g.lineWidth = 4; g.beginPath(); g.moveTo(cx + 30, shoulderY - 30); g.lineTo(cx + 22, shoulderY - 12); g.stroke();
    // Jacket.
    g.beginPath();
    g.moveTo(cx - SHOULDER_HALF - 4, shoulderY + 6);
    g.quadraticCurveTo(cx, shoulderY - 12, cx + SHOULDER_HALF + 4, shoulderY + 6);
    g.lineTo(cx + 36, hipY + 4); g.lineTo(cx - 36, hipY + 4); g.closePath();
    g.fillStyle = C.jacket; g.fill();
    g.save(); g.clip(); g.fillStyle = C.jacketShade; g.fillRect(cx + 10, shoulderY - 20, 60, hipY - shoulderY + 40); g.restore();
    g.strokeStyle = INK; g.lineWidth = 5; g.lineJoin = 'round'; g.stroke();
    // Collar, placket, webbing Y-straps, belt and pouches.
    g.strokeStyle = INK; g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx - 12, shoulderY - 3); g.lineTo(cx, shoulderY + 12); g.lineTo(cx + 12, shoulderY - 3); g.stroke();
    g.beginPath(); g.moveTo(cx, shoulderY + 12); g.lineTo(cx, hipY - 4); g.stroke();
    g.strokeStyle = C.webbing; g.lineWidth = 7;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 26, shoulderY + 2); g.lineTo(cx + s * 22, hipY - 8); g.stroke(); }
    g.fillStyle = C.webbing; g.fillRect(cx - 38, hipY - 10, 76, 12); g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(cx - 38, hipY - 10, 76, 12);
    for (const px of [-30, -10, 10]) {
      g.fillStyle = C.pouch; g.fillRect(cx + px, hipY - 14, 18, 18); g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(cx + px, hipY - 14, 18, 18);
    }
  }

  function drawHead(g, pose, shoulderY) {
    const cx = PIVOT.x + pose.sway, top = shoulderY - 78;
    // Neck, face, ears.
    g.fillStyle = C.skinShade; g.fillRect(cx - 10, shoulderY - 18, 20, 18);
    g.beginPath(); g.ellipse(cx, top + 50, 24, 27, 0, 0, Math.PI * 2); g.fillStyle = C.skin; g.fill();
    g.save(); g.clip(); g.fillStyle = C.skinShade; g.fillRect(cx + 8, top + 20, 30, 60); g.restore();
    g.strokeStyle = INK; g.lineWidth = 4; g.stroke();
    g.fillStyle = INK;
    g.beginPath(); g.arc(cx - 8, top + 52, 2.6, 0, Math.PI * 2); g.arc(cx + 8, top + 52, 2.6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = C.skinShade; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, top + 55); g.lineTo(cx + 2, top + 63); g.stroke();
    g.strokeStyle = INK; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx - 6, top + 68); g.lineTo(cx + 6, top + 68); g.stroke();
    // Helmet with rim and chin strap.
    g.beginPath(); g.ellipse(cx, top + 30, 40, 32, 0, Math.PI, 0); g.lineTo(cx + 40, top + 34); g.lineTo(cx - 40, top + 34); g.closePath();
    g.fillStyle = C.helmet; g.fill();
    g.save(); g.clip(); g.fillStyle = C.helmetShade; g.fillRect(cx + 8, top - 10, 50, 50); g.fillStyle = 'rgba(230,236,190,0.35)'; g.beginPath(); g.ellipse(cx - 16, top + 10, 12, 6, -0.4, 0, Math.PI * 2); g.fill(); g.restore();
    g.strokeStyle = INK; g.lineWidth = 5; g.stroke();
    g.beginPath(); g.ellipse(cx, top + 34, 45, 8, 0, 0, Math.PI * 2); g.fillStyle = C.helmetShade; g.fill(); g.stroke();
    g.strokeStyle = C.webbing; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 24, top + 38); g.quadraticCurveTo(cx, top + 84, cx + 24, top + 38); g.stroke();
  }

  // Identity accent (helmet band + shoulder patch) for the mask sheets.
  function drawAccent(g, pose, shoulderY) {
    const cx = PIVOT.x + pose.sway, top = shoulderY - 78;
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(cx, top + 26, 40, 7, 0, Math.PI, 0); g.lineTo(cx + 40, top + 30); g.lineTo(cx - 40, top + 30); g.fill();
    g.fillRect(cx - SHOULDER_HALF - 2, shoulderY + 12, 14, 12);
  }

  function drawFigure(g, pose, accentOnly) {
    const hipY = PIVOT.y - pose.hipHeight;
    const shoulderY = hipY - 92 + pose.breath * 0;
    const sY = shoulderY - pose.breath;
    if (accentOnly) { drawAccent(g, pose, sY); return; }
    g.lineCap = 'round'; g.lineJoin = 'round';
    // Depth order: farther leg, back-swung arm, torso, nearer leg, front arm, head.
    const legs = [[1, pose.left], [-1, pose.right]].sort((a, b) => a[1].depth - b[1].depth);
    const arms = [[1, pose.armSwing.left], [-1, pose.armSwing.right]].sort((a, b) => a[1] - b[1]);
    drawLeg(g, pose, legs[0][0], legs[0][1]);
    drawArm(g, pose, arms[0][0], arms[0][1], hipY, sY);
    drawLeg(g, pose, legs[1][0], legs[1][1]);
    drawTorso(g, pose, hipY, sY);
    drawArm(g, pose, arms[1][0], arms[1][1], hipY, sY);
    drawHead(g, pose, sY);
  }

  function sheet(poses, accentOnly) {
    const c = document.createElement('canvas'); c.width = CELL_W * poses.length; c.height = CELL_H;
    const g = c.getContext('2d');
    poses.forEach((pose, i) => { g.save(); g.translate(i * CELL_W, 0); drawFigure(g, pose, accentOnly); g.restore(); });
    return c;
  }

  // Foot ground positions (cell px) for the planted-foot check.
  function footTrack(poses) {
    return poses.map(p => ({
      right: { x: PIVOT.x - HIP_HALF - 1, y: PIVOT.y + p.right.depth, planted: p.right.planted },
      left: { x: PIVOT.x + HIP_HALF + 1, y: PIVOT.y + p.left.depth, planted: p.left.planted },
    }));
  }

  window.SoldierRig = {
    CELL_W, CELL_H, PIVOT, PX_PER_WORLD, STRIDE_WORLD,
    walk: () => { const poses = [0, 1, 2, 3, 4, 5].map(k => walkPose(k / 6)); return { poses, sheet: sheet(poses), accent: sheet(poses, true), track: footTrack(poses) }; },
    idle: () => { const poses = [0, 1].map(idlePose); return { poses, sheet: sheet(poses), accent: sheet(poses, true), track: footTrack(poses) }; },
  };
})();
