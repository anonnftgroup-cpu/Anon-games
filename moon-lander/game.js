// ANON Moon Lander: game logic (no DOM). Original ANON NFTs game. Browser: window.MLGame, node: require().
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.MLGame = f(); })(this, function () {
  'use strict';
  const W = 380, H = 520, LEG = 9, FOOT = 10, FUEL = 900, SAFE = { vy: 34, vx: 20, ang: 12 * Math.PI / 180 };
  const rngOf = s => { let a = (s >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  function create(o) {
    o = o || {}; const rnd = rngOf(o.seed || 1), sfx = o.sfx || (() => {}), say = o.say || (() => {});
    const S = { W, H, SAFE, FUEL, t: 0, score: 0, lives: 3, round: 1, landings: 0, over: false, art: o.art || 'anon', ground: [], pads: [], ship: null, state: 'fly', wait: 0, events: [], bits: [], thrusting: false, last: null, g: 16, crashes: 0, perfect: 0 };
    const ev = (type, d) => { S.events.push(Object.assign({ type, t: S.t }, d || {})); if (S.events.length > 200) S.events.shift(); };
    function terrain() {
      const N = 38, dx = W / N, pts = []; let y = H * (0.7 + rnd() * 0.12);
      for (let i = 0; i <= N; i++) { y += (rnd() - 0.5) * 46; y = Math.max(H * 0.5, Math.min(H * 0.93, y)); pts.push([i * dx, y]); }
      // three pads: x2 wide, x3 mid, x5 narrow; never overlapping
      const spec = [[2, 7], [3, 5], [5, 4]].sort(() => rnd() - 0.5), pads = [], used = new Set();
      for (const [mult, segs] of spec) { let i0, k = 0; do { i0 = 1 + (rnd() * (N - segs - 2) | 0); k++; } while (k < 200 && [...Array(segs + 3).keys()].some(j => used.has(i0 - 1 + j)));
        for (let j = 0; j <= segs; j++) used.add(i0 + j); let py = pts[i0][1]; if (mult === 5) py = Math.min(py, H * 0.66 + rnd() * 40);
        for (let j = 0; j <= segs; j++) pts[i0 + j][1] = py; pads.push({ x0: pts[i0][0], x1: pts[i0 + segs][0], y: py, mult }); }
      S.ground = pts; S.pads = pads;
    }
    S.groundY = x => { const g = S.ground, dx = W / (g.length - 1); const i = Math.max(0, Math.min(g.length - 2, Math.floor(x / dx))); const f = (x - g[i][0]) / dx; return g[i][1] + (g[i + 1][1] - g[i][1]) * f; };
    S.padAt = x => S.pads.find(p => x >= p.x0 - 2 && x <= p.x1 + 2);
    function newShip() { S.ship = { x: 40 + rnd() * (W - 80), y: 44, vx: (rnd() - 0.5) * 60, vy: 4, a: 0, fuel: FUEL }; S.state = 'fly'; }
    terrain(); newShip(); S.g = 16;
    function burst(x, y, n, col) { for (let i = 0; i < n; i++) { const a = rnd() * 7, v = 30 + rnd() * 110; S.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.5 + rnd() * 0.7, col }); } }
    function crash(why) { const s = S.ship; S.state = 'crash'; S.wait = 2; S.lives--; S.crashes++; burst(s.x, s.y, 30, '#ff3d9a'); sfx('crash'); ev('crash', { why }); S.last = { ok: false, why };
      say(S.lives > 0 ? (why === 'fast' ? 'TOO FAST!' : why === 'tilt' ? 'NOT LEVEL!' : why === 'drift' ? 'SIDEWAYS DRIFT!' : 'CRASHED!') : 'GAME OVER', 1.4); }
    function land(p) { const s = S.ship, soft = s.vy < 12 && Math.abs(s.vx) < 8; const pts = 50 * p.mult * (soft ? 2 : 1) + 10 * Math.floor(s.fuel / 50);
      S.score += pts; S.landings++; if (soft) S.perfect++; S.state = 'landed'; S.wait = 2.2; s.vx = s.vy = 0; s.y = p.y - FOOT; sfx('land'); ev('land', { mult: p.mult, soft, pts }); S.last = { ok: true, pts, mult: p.mult, soft };
      say(`${soft ? 'PERFECT ' : ''}LANDING ×${p.mult}  +${pts}`, 1.6); }
    S.step = function (h, I) {
      if (S.over) return; S.t += h;
      for (const b of S.bits) { b.x += b.vx * h; b.y += b.vy * h; b.vy += 60 * h; b.life -= h; } S.bits = S.bits.filter(b => b.life > 0);
      if (S.state !== 'fly') { S.thrusting = false; S.wait -= h; if (S.wait <= 0) {
        if (S.lives <= 0) { S.over = true; sfx('over'); return; }
        if (S.state === 'landed') { S.round++; S.g = Math.min(30, 16 * (1 + 0.07 * (S.round - 1))); terrain(); sfx('level'); } newShip(); } return; }
      const s = S.ship; if (I.held.left > 0) s.a -= 2.6 * h; if (I.held.right > 0) s.a += 2.6 * h; s.a = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, s.a));
      S.thrusting = I.held.up > 0 && s.fuel > 0; if (S.thrusting) { s.vx += Math.sin(s.a) * 44 * h; s.vy -= Math.cos(s.a) * 44 * h; s.fuel = Math.max(0, s.fuel - 70 * h); }
      s.vy += S.g * h; s.x += s.vx * h; s.y += s.vy * h;
      if (s.x < 8) { s.x = 8; s.vx = Math.abs(s.vx) * 0.3; } if (s.x > W - 8) { s.x = W - 8; s.vx = -Math.abs(s.vx) * 0.3; } if (s.y < 10) { s.y = 10; s.vy = Math.max(0, s.vy); }
      // feet and body vs ground
      const ca = Math.cos(s.a), sa = Math.sin(s.a), feet = [[-LEG, FOOT], [LEG, FOOT]].map(([fx, fy]) => [s.x + fx * ca - fy * sa, s.y + fx * sa + fy * ca]);
      const touch = feet.some(([fx, fy]) => fy >= S.groundY(fx)) || s.y + 6 >= S.groundY(s.x);
      if (touch) { const p = feet.every(([fx]) => S.padAt(fx) && S.padAt(fx) === S.padAt(feet[0][0])) ? S.padAt(feet[0][0]) : null;
        if (!p) return crash('rocks'); if (s.vy > SAFE.vy) return crash('fast'); if (Math.abs(s.a) > SAFE.ang) return crash('tilt'); if (Math.abs(s.vx) > SAFE.vx) return crash('drift'); return land(p); }
    };
    S.result = () => ({ score: S.score, time: S.t, moves: S.landings });
    return S;
  }
  return { create, W, H, SAFE, FUEL };
});
