// ANON Space Rocks: game logic (no DOM). Original ANON NFTs game. Browser: window.SRGame, node: require().
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.SRGame = f(); })(this, function () {
  'use strict';
  const W = 380, H = 520, R = { 3: 38, 2: 21, 1: 11 }, PTS = { 3: 20, 2: 50, 1: 100 }, DRONE_PTS = 500;
  const rngOf = s => { let a = (s >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const wrap = (v, m) => ((v % m) + m) % m;
  const wd = (a, b, m) => { let d = b - a; if (d > m / 2) d -= m; if (d < -m / 2) d += m; return d; };
  function create(o) {
    o = o || {}; const rnd = rngOf(o.seed || 1), sfx = o.sfx || (() => {}), say = o.say || (() => {});
    const S = { W, H, R, t: 0, score: 0, lives: 3, wave: 0, over: false, art: o.art || 'anon', rocks: [], shots: [], eshots: [], bits: [], drone: null, droneT: 14,
      ship: null, respawn: 0, cool: 0, nextLife: 10000, waveT: 1.2, events: [], rocksHit: 0, dronesHit: 0, shotsFired: 0, thrusting: false, queued: 0 };
    const ev = (type, d) => { S.events.push(Object.assign({ type, t: S.t }, d || {})); if (S.events.length > 200) S.events.shift(); };
    S.dx = (a, b) => wd(a, b, W); S.dy = (a, b) => wd(a, b, H);
    const dist = (a, b) => Math.hypot(wd(a.x, b.x, W), wd(a.y, b.y, H));
    S.dist = dist;
    function newShip() { S.ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, inv: 2.5 }; }
    function rock(size, x, y, sp) {
      const ang = rnd() * Math.PI * 2, v = (sp || 1) * (28 + rnd() * 52) * (1 + 0.07 * Math.min(10, S.wave - 1)) * (size === 1 ? 1.35 : size === 2 ? 1.15 : 1);
      const n = 9 + (rnd() * 3 | 0), sh = []; for (let i = 0; i < n; i++) sh.push(0.74 + rnd() * 0.3);
      return { size, r: R[size], x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, rot: 0, spin: (rnd() - 0.5) * 1.6, sh, art: rnd() * 10 | 0 };
    }
    function startWave() {
      S.wave++; const n = Math.min(11, 3 + S.wave);
      for (let i = 0; i < n; i++) { let x, y, k = 0; do { x = rnd() * W; y = rnd() * H; k++; } while (S.ship && Math.hypot(wd(x, S.ship.x, W), wd(y, S.ship.y, H)) < 150 && k < 50); S.rocks.push(rock(3, x, y)); }
      if (S.wave > 1) { if (S.ship) S.ship.inv = Math.max(S.ship.inv, 1.5); say('WAVE ' + S.wave, 1.2); sfx('level'); } ev('wave', { wave: S.wave });
    }
    function add(p) { S.score += p; if (S.score >= S.nextLife) { S.lives++; S.nextLife += 10000; sfx('bonus'); say('EXTRA LIFE!', 1); } }
    function burst(x, y, n, col) { for (let i = 0; i < n; i++) { const a = rnd() * 7, v = 30 + rnd() * 120; S.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + rnd() * 0.5, col }); } }
    function breakRock(i) {
      const r = S.rocks[i]; S.rocks.splice(i, 1); add(PTS[r.size]); S.rocksHit++; burst(r.x, r.y, 6 + r.size * 3, '#f3d77a'); sfx(r.size === 3 ? 'boom' : 'boomS'); ev('rock', { size: r.size });
      if (r.size > 1) for (let k = 0; k < 2; k++) { const c = rock(r.size - 1, r.x, r.y, 1.1); c.vx += r.vx * 0.4; c.vy += r.vy * 0.4; S.rocks.push(c); }
    }
    function die(why) { const s = S.ship; burst(s.x, s.y, 26, '#ff3d9a'); S.ship = null; S.lives--; S.respawn = 2; sfx('die'); ev('die', { why }); say(S.lives > 0 ? 'SHIP LOST' : 'GAME OVER', 1); if (S.lives <= 0) { S.over = true; sfx('over'); } }
    S.spawnClear = () => S.rocks.every(r => Math.hypot(wd(r.x, W / 2, W), wd(r.y, H / 2, H)) > r.r + 60) && (!S.drone || Math.hypot(S.drone.x - W / 2, S.drone.y - H / 2) > 90);
    newShip(); S.ship.inv = 0;
    S.step = function (h, I) {
      if (S.over) return; S.t += h; const s = S.ship;
      if (S.waveT > 0) { S.waveT -= h; if (S.waveT <= 0) startWave(); }
      else if (!S.rocks.length && !S.drone) { add(100 * S.wave); S.waveT = 1.6; say('WAVE CLEAR +' + 100 * S.wave, 1.2); }
      if (s) {
        const L = I.held.left > 0, Rt = I.held.right > 0; if (L) s.a -= 4.4 * h; if (Rt) s.a += 4.4 * h;
        S.thrusting = I.held.up > 0; if (S.thrusting) { s.vx += Math.cos(s.a) * 250 * h; s.vy += Math.sin(s.a) * 250 * h; }
        const sp = Math.hypot(s.vx, s.vy), mx = 320; if (sp > mx) { s.vx *= mx / sp; s.vy *= mx / sp; }
        const dr = Math.pow(0.55, h); s.vx *= dr; s.vy *= dr; s.x = wrap(s.x + s.vx * h, W); s.y = wrap(s.y + s.vy * h, H); if (s.inv > 0) s.inv -= h;
        S.cool -= h; if (I.take('fire') || I.take('tap')) S.queued = 0.25; else if (S.queued > 0) S.queued -= h; const fire = S.queued > 0 || (I.held.fire > 0 && S.cool <= -0.06);
        if (fire && S.cool <= 0 && S.shots.length < 5) { S.cool = 0.17; S.queued = 0; S.shotsFired++; S.shots.push({ x: s.x + Math.cos(s.a) * 12, y: s.y + Math.sin(s.a) * 12, vx: Math.cos(s.a) * 430 + s.vx * 0.5, vy: Math.sin(s.a) * 430 + s.vy * 0.5, life: 0.95 }); sfx('shoot'); }
      } else { I.take('fire'); I.take('tap'); S.thrusting = false; if (S.respawn > 0) S.respawn -= h; else if (!S.over && (S.spawnClear() || S.respawn < -3)) { newShip(); } }
      for (const r of S.rocks) { r.x = wrap(r.x + r.vx * h, W); r.y = wrap(r.y + r.vy * h, H); r.rot += r.spin * h; }
      for (const b of S.shots) { b.x = wrap(b.x + b.vx * h, W); b.y = wrap(b.y + b.vy * h, H); b.life -= h; }
      for (const b of S.eshots) { b.x = wrap(b.x + b.vx * h, W); b.y = wrap(b.y + b.vy * h, H); b.life -= h; }
      for (const b of S.bits) { b.x += b.vx * h; b.y += b.vy * h; b.life -= h; }
      S.shots = S.shots.filter(b => b.life > 0); S.eshots = S.eshots.filter(b => b.life > 0); S.bits = S.bits.filter(b => b.life > 0);
      // rogue drone
      if (S.wave >= 2 && !S.drone && S.waveT <= 0) { S.droneT -= h; if (S.droneT <= 0) { const left = rnd() < 0.5; S.drone = { x: left ? -16 : W + 16, y: 60 + rnd() * (H - 120), y0: 0, d: left ? 1 : -1, v: 70 + 6 * Math.min(8, S.wave), fireT: 1.2, ph: rnd() * 6, art: rnd() * 10 | 0 }; S.drone.y0 = S.drone.y; sfx('alien'); ev('drone'); } }
      const D = S.drone;
      if (D) { D.x += D.d * D.v * h; D.ph += h; D.y = wrap(D.y0 + Math.sin(D.ph * 1.6) * 50, H);
        D.fireT -= h; if (D.fireT <= 0 && S.ship) { D.fireT = Math.max(1.0, 1.9 - 0.1 * S.wave); const err = (rnd() - 0.5) * Math.max(0.2, 0.9 - 0.08 * S.wave), a = Math.atan2(wd(D.y, S.ship.y, H), wd(D.x, S.ship.x, W)) + err; S.eshots.push({ x: D.x, y: D.y, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, life: 1.6 }); sfx('tick'); }
        if (D.x < -30 || D.x > W + 30) { S.drone = null; S.droneT = 12 + rnd() * 10; } }
      // collisions: shots vs rocks / drone
      for (let i = S.shots.length - 1; i >= 0; i--) { const b = S.shots[i]; let hit = false;
        for (let j = S.rocks.length - 1; j >= 0; j--) if (dist(b, S.rocks[j]) < S.rocks[j].r * 0.95) { breakRock(j); hit = true; break; }
        if (!hit && S.drone && Math.hypot(b.x - S.drone.x, b.y - S.drone.y) < 15) { add(DRONE_PTS); S.dronesHit++; burst(S.drone.x, S.drone.y, 20, '#2bff88'); sfx('bonus'); say('+500 DRONE', 0.8); ev('droneHit'); S.drone = null; S.droneT = 12 + rnd() * 10; hit = true; }
        if (hit) S.shots.splice(i, 1); }
      // drone shots vs rocks (they shatter rocks but score nothing)
      const sh = S.ship;
      if (sh) {
        if (sh.inv <= 0) {
          for (const r of S.rocks) if (dist(sh, r) < r.r * 0.86 + 8) { die('rock'); break; }
          if (S.ship && S.drone && Math.hypot(sh.x - S.drone.x, sh.y - S.drone.y) < 22) { die('drone'); S.drone = null; S.droneT = 14; }
          if (S.ship) for (const b of S.eshots) if (dist(sh, b) < 10) { b.life = 0; die('shot'); break; }
        }
      }
    };
    S.result = () => ({ score: S.score, time: S.t, moves: Math.max(1, S.wave) });
    return S;
  }
  return { create, W, H, R, PTS };
});
