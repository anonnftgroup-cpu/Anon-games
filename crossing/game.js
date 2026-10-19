/* ANON Crossing · rules (no DOM). Hop the shadow road and the gold river to fill the five ANON shrines. Original lanes by ANON NFTs. */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.CRGame = f(); })(this, function () {
  'use strict';
  const W = 11, ROWS = 13, L = W + 5, SLOTS = [1, 3, 5, 7, 9], LIFE_T = 40;
  // lane plans: row -> type, direction, base speed (tiles/s), items [start, length, kind]
  const PLAN = {
    1: { t: 'river', d: -1, v: 1.25, it: [[0, 3, 'log'], [6, 3, 'log'], [11, 2, 'log']] },
    2: { t: 'river', d: 1, v: 0.95, it: [[1, 3, 'lotus'], [6, 3, 'lotus'], [11, 2, 'lotus']], sink: 0 },
    3: { t: 'river', d: -1, v: 1.7, it: [[0, 4, 'log'], [8, 4, 'log']] },
    4: { t: 'river', d: 1, v: 1.05, it: [[0, 2, 'lotus'], [5, 3, 'lotus'], [10, 3, 'lotus']], sink: 3 },
    5: { t: 'river', d: -1, v: 1.4, it: [[2, 3, 'log'], [8, 2, 'log'], [12, 2, 'log']] },
    7: { t: 'road', d: 1, v: 1.9, it: [[0, 1, 'cart'], [6, 1, 'cart'], [11, 1, 'cart']] },
    8: { t: 'road', d: -1, v: 1.1, it: [[1, 3, 'wagon'], [9, 3, 'wagon']] },
    9: { t: 'road', d: 1, v: 2.4, it: [[3, 1, 'cart'], [11, 1, 'cart']] },
    10: { t: 'road', d: -1, v: 1.4, it: [[0, 2, 'coach'], [6, 2, 'coach'], [12, 1, 'cart']] },
    11: { t: 'road', d: 1, v: 1.0, it: [[2, 1, 'cart'], [7, 2, 'coach'], [12, 1, 'cart']] }
  };
  function rngOf(s) { let a = s >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const mod = (a, m) => ((a % m) + m) % m;
  function create(o) {
    o = o || {}; const rnd = rngOf(o.seed || 1), sfx = o.sfx || (() => {}), say = o.say || (() => {});
    const S = { W, ROWS, SLOTS, t: 0, lt: 0, score: 0, lives: 3, level: 1, over: false, filled: [0, 0, 0, 0, 0], p: null, best: 12, timer: LIFE_T, token: null, tokens: 0, homes: 0, deaths: 0,
      dead: 0, hop: 0, art: o.art || 'anon', lanes: {}, events: [], phase: rnd() * 10 };
    const spd = () => 1 + 0.13 * Math.min(10, S.level - 1);
    function build() { S.lanes = {}; for (const r in PLAN) { const P = PLAN[r]; S.lanes[r] = { row: +r, t: P.t, d: P.d, v: P.v * spd(), sink: P.sink, items: P.it.map(([x, len, kind], i) => ({ x0: x + rnd() * 0.6, len, kind, art: (i + +r) % 10 })) }; } }
    // item left edge at lane time lt (tiles), wrapping over L
    const itemX = (ln, it, lt) => mod(it.x0 + ln.d * ln.v * lt, L) - 2.5;
    const sunk = (ln, lt) => ln.sink != null && mod(lt + ln.sink * 1.7 + S.phase, 7) > 5.2; // lotus rafts dive for ~1.8 s
    S.itemX = (ln, it) => itemX(ln, it, S.lt); S.sunk = ln => sunk(ln, S.lt); S.sinkWarn = ln => ln.sink != null && mod(S.lt + ln.sink * 1.7 + S.phase, 7) > 4.5;
    function platformAt(row, x, lt) { const ln = S.lanes[row]; if (!ln || ln.t !== 'river') return null; if (sunk(ln, lt)) return null;
      for (const it of ln.items) { const a = itemX(ln, it, lt); if (x >= a - 0.1 && x <= a + it.len + 0.1 - 1e-9 && x - a > -0.1) { if (x > a - 0.15 && x < a + it.len - 0.85 + 0.15 + 0.7) return { ln, it }; } } return null; }
    function hitCar(row, x, lt) { const ln = S.lanes[row]; if (!ln || ln.t !== 'road') return false;
      for (const it of ln.items) { const a = itemX(ln, it, lt); if (x + 0.32 > a + 0.08 && x - 0.32 < a + it.len - 0.08) return true; } return false; }
    // is a ninja centred at column-space x (0..W-1, centre = x + 0.5) safe on row at lane time + ahead?
    S.safe = function (row, x, ahead) { const lt = S.lt + (ahead || 0); const c = x + 0.5;
      if (row === 6 || row === 12) return x >= -0.01 && x <= W - 0.99;
      if (row === 0) return true;
      const ln = S.lanes[row]; if (ln.t === 'road') return !hitCar(row, c, lt);
      if (sunk(ln, lt)) return false; for (const it of ln.items) { const a = itemX(ln, it, lt); if (c > a + 0.15 && c < a + it.len - 0.15) return true; } return false; };
    S.drift = row => { const ln = S.lanes[row]; return ln && ln.t === 'river' ? ln.d * ln.v : 0; };
    function reset() { S.p = { x: 5, row: 12, face: 'up' }; S.best = 12; S.timer = Math.max(25, LIFE_T - 2 * (S.level - 1)); S.dead = 0; }
    build(); reset();
    const ev = (type, d) => { S.events.push(Object.assign({ type, t: S.t }, d || {})); if (S.events.length > 40) S.events.shift(); };
    function die(why) { if (S.dead) return; S.dead = 1.1; S.deathWhy = why; S.deaths++; S.lives--; sfx(why === 'water' ? 'splash' : 'die'); ev('die', { why }); say(why === 'water' ? 'SPLASH!' : why === 'time' ? 'OUT OF TIME' : 'SQUASHED!', 1); }
    function home(slot) {
      S.filled[slot] = 1; S.homes++; let pts = 50 + Math.floor(S.timer) * 10; if (S.token && S.token.slot === slot) { pts += 200; S.tokens++; S.token = null; say('+NFT TOKEN', 1); sfx('bonus'); }
      S.score += pts; sfx('home'); ev('home', { slot, pts });
      if (S.filled.every(Boolean)) { S.score += 1000; S.level++; S.filled = [0, 0, 0, 0, 0]; build(); sfx('level'); say('LEVEL ' + S.level, 1.6); ev('level'); }
      reset();
    }
    function hop(dir) {
      const p = S.p; p.face = dir; S.hop = 0.12;
      if (dir === 'left') p.x = Math.max(0, p.x - 1); else if (dir === 'right') p.x = Math.min(W - 1, p.x + 1);
      else if (dir === 'down') { if (p.row < 12) p.row++; }
      else if (dir === 'up') {
        if (p.row === 1) { const c = p.x + 0.5, s = SLOTS.findIndex(sx => Math.abs(sx + 0.5 - c) < 0.62); if (s < 0 || S.filled[s]) { S.hop = 0; sfx('wall'); return; } p.row = 0; p.x = SLOTS[s]; home(s); return; }
        p.row--; }
      if (S.lanes[p.row] && S.lanes[p.row].t === 'river') {} else p.x = Math.round(p.x); // snap to the grid off the water
      if (p.row < S.best) { S.score += 10 * (S.best - p.row); S.best = p.row; }
      sfx('hop');
    }
    S.step = function (h, I) {
      if (S.over) return; S.t += h; S.lt += h;
      if (S.token) { if (S.t > S.token.until || S.filled[S.token.slot]) S.token = null; } else if (rnd() < h / 9) { const free = [0, 1, 2, 3, 4].filter(i => !S.filled[i]); if (free.length) S.token = { slot: free[Math.floor(rnd() * free.length)], until: S.t + 5 }; }
      if (S.dead) { S.dead -= h; if (S.dead <= 0) { if (S.lives <= 0) { S.over = true; ev('over'); } else reset(); } return; }
      if (S.hop > 0) S.hop -= h;
      if (I) for (const d of ['up', 'down', 'left', 'right', 'tap']) if (I.take(d)) { hop(d === 'tap' ? 'up' : d); break; }
      const p = S.p; S.timer -= h; if (S.timer <= 0) return die('time');
      if (p.row === 0) return;
      const ln = S.lanes[p.row];
      if (ln && ln.t === 'river') { p.x += ln.d * ln.v * h; if (p.x < -0.45 || p.x > W - 0.55) return die('water'); if (!S.safe(p.row, p.x, 0)) return die('water'); }
      else if (ln && ln.t === 'road') { if (!S.safe(p.row, p.x, 0)) return die('road'); }
    };
    S.LIFE_T = LIFE_T; void platformAt;
    return S;
  }
  return { create, W, ROWS, SLOTS, PLAN };
});
