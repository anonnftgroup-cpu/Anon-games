/* ANON Galaxy Pinball · physics + rules engine (no DOM). Original table "ANON Galaxy" by ANON NFTs.
   Own fixed-step physics: ball vs capsule walls / circles / tapered rotating flippers, 720 substeps a second,
   so a ball at the speed cap moves under 4 units a step against walls that are 12+ units thick (no tunnelling). */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.PBEngine = factory(); })(this, function () {
  'use strict';
  const W = 400, H = 720, BR = 9, GRAV = 1150, MAXV = 2600, STEP = 1 / 720, DRAIN_Y = 735;
  const LANE_X = 374, LANE_REST_Y = 700;
  const RANKS = ['Rookie', 'Hooded Scout', 'Forest Explorer', 'Gem Hunter', 'Night Ranger', 'Gold Knight', 'Crown Guard', 'ANON Prince', 'ANON King'];
  const MISSIONS = [
    { id: 'gems', name: 'Collect 5 pink gems', stat: 'gem', n: 5 },
    { id: 'crown', name: 'Hit the crown targets', stat: 'target', n: 3 },
    { id: 'spell', name: 'Spell A-N-O-N in the top lanes', stat: 'spell', n: 1 },
    { id: 'forest', name: 'Escape the enchanted forest', stat: 'orbit', n: 1 },
    { id: 'sling', name: 'Slingshot storm: 8 slings', stat: 'sling', n: 8 },
    { id: 'gems2', name: 'Collect 12 pink gems', stat: 'gem', n: 12 },
    { id: 'crown2', name: 'Crown targets x2', stat: 'target', n: 6 },
    { id: 'forest2', name: 'Escape the enchanted forest twice', stat: 'orbit', n: 2 },
    { id: 'gems3', name: 'Gem galaxy: 20 pink gems', stat: 'gem', n: 20 }
  ];
  const PTS = { bumper: 50, sling: 10, lane: 100, laneAgain: 20, spell: 1000, target: 100, bank: 1000, orbit: 1000, jackpot: 5000, skill: 2000, mission: 2500 };
  const SAVE_S = 8, MB_SAVE_S = 12;

  function rngOf(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ---------------- table geometry ---------------- */
  function buildTable() {
    const segs = [], circs = [], sensors = [];
    const seg = (ax, ay, bx, by, o) => { const s = Object.assign({ ax, ay, bx, by, r: 3, e: 0.35, kind: 'wall' }, o || {});
      s.dx = bx - ax; s.dy = by - ay; s.len2 = s.dx * s.dx + s.dy * s.dy; const l = Math.sqrt(s.len2); s.tx = s.dx / l; s.ty = s.dy / l;
      s.minx = Math.min(ax, bx) - s.r - BR - 8; s.maxx = Math.max(ax, bx) + s.r + BR + 8; s.miny = Math.min(ay, by) - s.r - BR - 8; s.maxy = Math.max(ay, by) + s.r + BR + 8;
      s.id = segs.length; segs.push(s); return s; };
    const poly = (pts, o) => { for (let i = 0; i < pts.length - 1; i++) seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], o); };
    const arcPts = (cx, cy, R, a0, a1, n) => { const p = []; for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; p.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); } return p; };
    // outer shell: left wall, top dome, right wall of the shooter lane
    poly([[12, 745], [12, 200]].concat(arcPts(200, 200, 188, 180, 360, 36)).concat([[388, 745]]), { group: 'rail' });
    seg(360, 745, 360, 250, { group: 'rail' });                                   // shooter-lane inner wall / right playfield wall
    seg(360, 712, 388, 712, { e: 0.1, kind: 'plunger', group: 'plunger' });      // plunger tip (ball rests on it)
    // one-way gate at the top of the shooter lane: ball leaves, never falls back in
    const g1 = seg(360, 250, 388, 214, { kind: 'gate', e: 0.3, group: 'gate' }); g1.oneway = true; g1.nx = -g1.ty; g1.ny = g1.tx; if (g1.nx > 0) { g1.nx = -g1.nx; g1.ny = -g1.ny; }
    // inlane guides into the flipper pivots
    seg(40, 480, 116, 628, { group: 'rail' }); seg(332, 480, 256, 628, { group: 'rail' });
    // enchanted forest orbit: channel up the left side, around the dome, one-way at its top
    poly([[48, 275], [48, 200]].concat(arcPts(200, 200, 152, 180, 232, 10)), { group: 'rail', kind: 'wall' });
    const ga = 232 * Math.PI / 180; const gi = [200 + 152 * Math.cos(ga), 200 + 152 * Math.sin(ga)], go = [200 + 188 * Math.cos(ga), 200 + 188 * Math.sin(ga)];
    const g2 = seg(gi[0], gi[1], go[0], go[1], { kind: 'gate', e: 0.3, group: 'gate' }); g2.oneway = true; g2.nx = -Math.sin(ga); g2.ny = Math.cos(ga);
    // top rollover lanes A N O N (posts)
    [106, 146, 186, 226, 266].forEach(x => seg(x, 88, x, 118, { r: 4, e: 0.5, group: 'post' }));
    ['A', 'N', 'O', 'N'].forEach((ch, i) => sensors.push({ kind: 'lane', i, ch, x: 126 + 40 * i, y: 104, r: 11 }));
    // orbit sensor (inside the channel, below the gate)
    const oa = 218 * Math.PI / 180; sensors.push({ kind: 'orbit', x: 200 + 171 * Math.cos(oa), y: 200 + 171 * Math.sin(oa), r: 16, tx: -Math.sin(oa), ty: Math.cos(oa) });
    sensors.push({ kind: 'orbitIn', x: 30, y: 262, r: 15 });
    // pink gem bumpers
    [[140, 196], [232, 196], [186, 262]].forEach(([x, y], i) => circs.push({ kind: 'bumper', i, x, y, r: 22, e: 0.5 }));
    // crown drop targets (right bank)
    [324, 354, 384].forEach((y, i) => seg(344, y - 12, 344, y + 12, { kind: 'target', i, r: 4, e: 0.4, group: 'target' }));
    // slingshots (kick face = A-C)
    const sling = (A, B, C, side) => { seg(A[0], A[1], B[0], B[1], { group: 'rail' }); seg(B[0], B[1], C[0], C[1], { group: 'rail' });
      const s = seg(A[0], A[1], C[0], C[1], { kind: 'sling', side, e: 0.4, r: 4, group: 'sling' }); let nx = -s.ty, ny = s.tx; if ((nx > 0) !== (side === 'L')) { nx = -nx; ny = -ny; } s.kx = nx; s.ky = ny; };
    sling([88, 455], [88, 512], [120, 574], 'L'); sling([284, 455], [284, 512], [252, 574], 'R');
    sensors.push({ kind: 'laneExit', x: 374, y: 236, r: 14 });
    const flippers = [
      { side: 'L', px: 118, py: 636, len: 58, rp: 9, rt: 5, rest: 28 * Math.PI / 180, up: -24 * Math.PI / 180 },
      { side: 'R', px: 254, py: 636, len: 58, rp: 9, rt: 5, rest: Math.PI - 28 * Math.PI / 180, up: Math.PI + 24 * Math.PI / 180 }
    ].map(f => Object.assign(f, { a: f.rest, w: 0, held: false }));
    return { segs, circs, sensors, flippers, W, H };
  }

  /* ---------------- game ---------------- */
  function createGame(opt) {
    opt = opt || {};
    const rnd = rngOf(opt.seed != null ? opt.seed : (Date.now() & 0x7fffffff));
    const T = buildTable();
    const g = {
      T, W, H, BR, RANKS, MISSIONS, t: 0, score: 0, ballNo: 1, balls: [], events: [], over: false, started: false,
      lanes: [0, 0, 0, 0], targets: [1, 1, 1], mult: 1, missionsDone: 0, mission: null, prog: 0, rank: 0,
      saveUntil: 0, multiball: false, tilt: 0, tilted: false, tiltWarn: 0, nudges: 0, queue: 0, skillLane: -1, skillUntil: 0,
      stats: { gem: 0, target: 0, spell: 0, orbit: 0, sling: 0, bumper: 0, saves: 0, drains: 0, escapes: 0, launches: 0, multiballs: 0 },
      ballStats: null, cool: {}, bankResetAt: 0, ballEndAt: 0, nextId: 1, pausedFor: 0
    };
    const ev = (type, o) => { g.events.push(Object.assign({ type, t: g.t }, o || {})); if (opt.onEvent) opt.onEvent(g.events[g.events.length - 1]); };
    const add = (p, label) => { if (g.tilted) return; g.score += p; if (label) ev('score', { pts: p, label }); };
    const newBallStats = () => { g.ballStats = { gem: 0, target: 0, orbit: 0, mission: 0 }; };
    function setMission() {
      const k = g.missionsDone, m = MISSIONS[k % MISSIONS.length], cyc = Math.floor(k / MISSIONS.length);
      g.mission = Object.assign({}, m, { n: Math.ceil(m.n * (1 + cyc * 0.5)), reward: PTS.mission + 1000 * Math.min(k, 20) }); g.prog = 0;
    }
    function bump(stat, n) {
      g.stats[stat] = (g.stats[stat] || 0) + (n || 1);
      if (g.tilted || !g.mission || g.mission.stat !== stat) return;
      g.prog += n || 1;
      if (g.prog >= g.mission.n) completeMission();
    }
    function completeMission() {
      const m = g.mission; add(m.reward); g.missionsDone++; g.ballStats.mission++;
      const old = g.rank; g.rank = Math.min(RANKS.length - 1, g.missionsDone);
      ev('mission', { name: m.name, pts: m.reward, rank: g.rank, promoted: g.rank > old });
      if (g.missionsDone % 3 === 0) startMultiball();
      setMission();
    }
    function startMultiball() {
      if (g.over) return; g.multiball = true; g.stats.multiballs++; g.queue += 2; g.saveUntil = Math.max(g.saveUntil, g.t + MB_SAVE_S); ev('multiball');
    }
    function makeBall(auto) { const b = { id: g.nextId++, x: LANE_X, y: LANE_REST_Y, vx: 0, vy: 0, live: false, auto: auto ? g.t + 0.7 : 0, still: 0, orbitAt: -9, inAt: -9, cool: {} }; g.balls.push(b); return b; }
    const laneBusy = () => g.balls.some(b => b.x > 360 && b.y > 400);
    function serve(auto) { makeBall(auto); if (!auto) { g.skillLane = Math.floor(rnd() * 4); } ev('serve', { auto: !!auto }); }
    g.start = function () { g.started = true; setMission(); newBallStats(); serve(false); ev('start'); };
    g.ballInLane = () => g.balls.find(b => !b.live && b.x > 360 && b.y > 640 && Math.abs(b.vy) < 40);
    g.canLaunch = () => !g.over && !!g.ballInLane();
    g.launch = function (power) {
      const b = g.ballInLane(); if (!b) return false; power = Math.max(0, Math.min(1, power == null ? 0.8 : power));
      b.vy = -(1180 + 1250 * power); b.vx = 0; b.auto = 0; g.stats.launches++; ev('launch', { power }); if (!b.wasAuto) g.skillUntil = g.t + 4; return true;
    };
    g.flip = function (side, down) {
      const f = T.flippers[side === 'L' ? 0 : 1]; if (down && !f.held && !g.tilted) { ev('flip', { side });
        const s = g.lanes.slice(); g.lanes = side === 'L' ? s.slice(1).concat(s[0]) : [s[3]].concat(s.slice(0, 3)); }
      f.held = !!down;
    };
    g.nudge = function (dir) {
      if (g.over || g.tilted) return; dir = dir || (rnd() < 0.5 ? -1 : 1); g.nudges++;
      g.balls.forEach(b => { if (b.live) { b.vx += dir * 110; b.vy -= 140; } });
      g.tilt += 1; ev('nudge', { dir, tilt: g.tilt });
      if (g.tilt >= 2.6) { g.tilted = true; T.flippers.forEach(f => { f.held = false; }); ev('tilt'); }
      else if (g.tilt >= 1.6) { g.tiltWarn++; ev('tiltWarn'); }
    };
    g.status = () => ({ score: g.score, ball: g.ballNo, balls: 3, rank: RANKS[g.rank], rankIdx: g.rank, mission: g.mission && g.mission.name, prog: g.prog,
      need: g.mission && g.mission.n, mult: g.mult, save: Math.max(0, g.saveUntil - g.t), multiball: g.multiball, tilted: g.tilted, over: g.over, missions: g.missionsDone, time: g.t });

    /* ---- collisions ---- */
    function hitSeg(b, s) {
      if (b.x < s.minx || b.x > s.maxx || b.y < s.miny || b.y > s.maxy) return;
      if (s.kind === 'target' && !g.targets[s.i]) return;
      let u = ((b.x - s.ax) * s.dx + (b.y - s.ay) * s.dy) / s.len2; u = u < 0 ? 0 : u > 1 ? 1 : u;
      const cx = s.ax + s.dx * u, cy = s.ay + s.dy * u; let nx = b.x - cx, ny = b.y - cy; const d2 = nx * nx + ny * ny, rr = BR + s.r;
      if (d2 >= rr * rr) return;
      if (s.oneway && (b.x - s.ax) * s.nx + (b.y - s.ay) * s.ny < 0) return;
      const d = Math.sqrt(d2); if (d < 1e-6) { nx = -s.ty; ny = s.tx; } else { nx /= d; ny /= d; }
      b.x += nx * (rr - d); b.y += ny * (rr - d);
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { b.vx -= (1 + s.e) * vn * nx; b.vy -= (1 + s.e) * vn * ny; }
      if (s.kind === 'sling' && vn < -60 && !g.tilted && cool(b, 's' + s.id, 0.12)) {
        b.vx += s.kx * 620; b.vy += s.ky * 620; add(PTS.sling); bump('sling'); ev('sling', { side: s.side });
      } else if (s.kind === 'target' && vn < -40) {
        g.targets[s.i] = 0; add(PTS.target); g.ballStats.target++; ev('target', { i: s.i }); bump('target');
        if (!g.targets.some(Boolean)) { add(PTS.bank, 'CROWN BANK'); ev('bank'); g.bankResetAt = g.t + 1.2; }
      } else if (vn < -250 && s.kind === 'wall') ev('wallHit', { v: -vn });
    }
    function cool(b, k, dt) { if ((b.cool[k] || -9) > g.t) return false; b.cool[k] = g.t + dt; return true; }
    function hitCirc(b, c) {
      const dx = b.x - c.x, dy = b.y - c.y, rr = BR + c.r, d2 = dx * dx + dy * dy; if (d2 >= rr * rr) return;
      const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d; b.x = c.x + nx * rr; b.y = c.y + ny * rr;
      const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= (1 + c.e) * vn * nx; b.vy -= (1 + c.e) * vn * ny; }
      if (c.kind === 'bumper' && !g.tilted && cool(b, 'b' + c.i, 0.07)) {
        const out = b.vx * nx + b.vy * ny, want = 780; if (out < want) { b.vx += nx * (want - out); b.vy += ny * (want - out); }
        add(PTS.bumper); g.ballStats.gem++; c.flash = g.t; ev('bumper', { i: c.i }); bump('gem');
      }
    }
    function hitFlipper(b, f) {
      const ca = Math.cos(f.a), sa = Math.sin(f.a), tx = f.px + ca * f.len, ty = f.py + sa * f.len;
      const ex = b.x - f.px, ey = b.y - f.py; if (ex * ex + ey * ey > (f.len + 30) * (f.len + 30)) return;
      let u = (ex * ca + ey * sa) / f.len; u = u < 0 ? 0 : u > 1 ? 1 : u;
      const cx = f.px + ca * f.len * u, cy = f.py + sa * f.len * u, rf = f.rp + (f.rt - f.rp) * u, rr = BR + rf;
      let nx = b.x - cx, ny = b.y - cy; const d2 = nx * nx + ny * ny; if (d2 >= rr * rr) return;
      const d = Math.sqrt(d2) || 1e-6; nx /= d; ny /= d; b.x = cx + nx * rr; b.y = cy + ny * rr;
      const qx = cx + nx * rf - f.px, qy = cy + ny * rf - f.py, svx = -f.w * qy, svy = f.w * qx; // surface velocity
      const rvx = b.vx - svx, rvy = b.vy - svy, vn = rvx * nx + rvy * ny;
      if (vn < 0) { const e = 0.28; b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; if (Math.abs(f.w) > 3 && -vn > 200) ev('flipHit', { side: f.side, v: -vn }); }
      void tx; void ty;
    }
    function ballBall(a, b) {
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, rr = 2 * BR; if (d2 >= rr * rr || d2 < 1e-9) return;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, p = (rr - d) / 2; a.x -= nx * p; a.y -= ny * p; b.x += nx * p; b.y += ny * p;
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (vn < 0) { const j = -(1 + 0.9) * vn / 2; a.vx -= j * nx; a.vy -= j * ny; b.vx += j * nx; b.vy += j * ny; }
    }
    function sensors(b) {
      for (const s of T.sensors) {
        const dx = b.x - s.x, dy = b.y - s.y; if (dx * dx + dy * dy > s.r * s.r) continue;
        if (s.kind === 'lane' && cool(b, 'l' + s.i, 0.5)) {
          if (g.skillUntil > g.t && s.i === g.skillLane) { add(PTS.skill, 'SKILL SHOT'); ev('skill'); }
          g.skillUntil = 0;
          if (!g.lanes[s.i]) { g.lanes[s.i] = 1; add(PTS.lane); ev('lane', { i: s.i }); } else add(PTS.laneAgain);
          if (g.lanes.every(Boolean)) { g.lanes = [0, 0, 0, 0]; add(PTS.spell, 'A-N-O-N!'); if (g.mult < 5) g.mult++; ev('spell', { mult: g.mult }); bump('spell'); }
        } else if (s.kind === 'orbitIn') { b.inAt = g.t; }
        else if (s.kind === 'orbit' && b.vx * s.tx + b.vy * s.ty > 80 && cool(b, 'o', 1.2)) {
          const n = g.ballStats.orbit++; add(Math.min(5000, PTS.orbit + 500 * n), 'FOREST ESCAPE'); ev('orbit');
          if (g.multiball) { add(PTS.jackpot, 'JACKPOT'); ev('jackpot'); }
          bump('orbit');
        } else if (s.kind === 'laneExit' && !b.live && b.vy < 0) {
          b.live = true; if (!b.savedOnce) { b.savedOnce = true; if (!g.multiball || g.saveUntil < g.t) g.saveUntil = Math.max(g.saveUntil, g.t + (b.autoSave || SAVE_S)); }
        }
      }
    }
    function drain(b) {
      g.balls.splice(g.balls.indexOf(b), 1); g.stats.drains++;
      const live = g.balls.length + g.queue;
      if (!g.tilted && g.saveUntil > g.t) { g.stats.saves++; ev('saved'); const nb = makeBall(true); nb.wasAuto = true; nb.autoSave = 2; return; }
      if (live > 0) { if (g.multiball && live <= 1) { g.multiball = false; ev('multiballEnd'); } ev('drain', { more: true }); return; }
      g.multiball = false; ev('drain', { more: false });
      const B = g.ballStats, bonus = g.tilted ? 0 : (B.gem * 20 + B.target * 50 + B.orbit * 250 + B.mission * 500) * g.mult;
      if (bonus) add(bonus); ev('bonus', { bonus, mult: g.mult });
      g.ballEndAt = g.t + 1.6;
    }
    function nextBall() {
      g.ballEndAt = 0; g.mult = 1; g.tilted = false; g.tilt = 0; g.lanes = [0, 0, 0, 0];
      if (g.ballNo >= 3) { g.over = true; ev('gameover', { score: g.score }); return; }
      g.ballNo++; newBallStats(); serve(false); ev('ball', { n: g.ballNo });
    }
    function substep(h) {
      for (const f of T.flippers) {
        const target = f.held && !g.tilted ? f.up : f.rest, sp = (f.held && !g.tilted ? 30 : 16) * h, prev = f.a;
        if (Math.abs(target - f.a) <= sp) f.a = target; else f.a += Math.sign(target - f.a) * sp;
        f.w = (f.a - prev) / h;
      }
      for (let i = 0; i < g.balls.length; i++) {
        const b = g.balls[i]; b.px = b.x; b.py = b.y;
        b.vy += GRAV * h; b.x += b.vx * h; b.y += b.vy * h;
        for (const s of T.segs) hitSeg(b, s);
        for (const c of T.circs) hitCirc(b, c);
        for (const f of T.flippers) hitFlipper(b, f);
        for (let j = i + 1; j < g.balls.length; j++) ballBall(b, g.balls[j]);
        sensors(b);
        const v2 = b.vx * b.vx + b.vy * b.vy; if (v2 > MAXV * MAXV) { const k = MAXV / Math.sqrt(v2); b.vx *= k; b.vy *= k; }
        if (opt.onSub) opt.onSub(b, g);
      }
    }
    g.step = function (dt) {
      if (!g.started || g.over) return;
      const n = Math.max(1, Math.round(dt / STEP)), h = dt / n;
      for (let k = 0; k < n; k++) { substep(h); g.t += h; }
      g.tilt = Math.max(0, g.tilt - 0.45 * dt);
      for (const b of g.balls.slice()) {
        if (b.y > DRAIN_Y) { drain(b); continue; }
        if (!(b.x > -5 && b.x < W + 5 && b.y > -5) || !isFinite(b.x + b.y + b.vx + b.vy)) { g.stats.escapes++; ev('escape', { x: b.x, y: b.y }); b.x = LANE_X; b.y = LANE_REST_Y; b.vx = b.vy = 0; b.live = false; continue; }
        if (b.auto && b.auto < g.t && b === g.ballInLane()) { b.wasAuto = true; g.launch(0.62 + rnd() * 0.36); }
        const sp = Math.hypot(b.vx, b.vy), cradled = T.flippers.some(f => f.held && Math.hypot(b.x - f.px, b.y - f.py) < f.len + 16);
        if (sp < 14 && b.live && !cradled) { b.still += dt; if (b.still > 2.5) { b.still = 0; b.vx = (rnd() - 0.5) * 500; b.vy = -500 - rnd() * 300; ev('search'); } } else b.still = 0;
        if (!b.live && b.x > 360 && b.y > 640 && !b.auto && b.idleAt == null) b.idleAt = g.t;
      }
      if (g.queue > 0 && !laneBusy()) { g.queue--; const nb = makeBall(true); nb.autoSave = 1; }
      if (g.bankResetAt && g.t > g.bankResetAt) { // pop the crown targets back up, but never into a ball
        if (g.balls.some(b => b.x > 344 - BR - 10 && b.y > 300 && b.y < 408)) g.bankResetAt = g.t + 0.25; else { g.targets = [1, 1, 1]; g.bankResetAt = 0; ev('bankReset'); } }
      if (g.ballEndAt && g.t > g.ballEndAt) nextBall();
    };
    g.pos = () => g.balls.map(b => ({ x: b.x, y: b.y }));
    g._add = add; g._bump = bump; g._multiball = startMultiball; g._makeBall = makeBall; g.rnd = rnd;
    return g;
  }
  return { createGame, buildTable, W, H, BR, MAXV, STEP, RANKS, MISSIONS, PTS, SAVE_S };
});
