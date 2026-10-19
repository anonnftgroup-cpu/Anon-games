// ANON Light Trails: game logic (no DOM). Original ANON NFTs game. Browser: window.LTGame, node: require().
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.LTGame = f(); })(this, function () {
  'use strict';
  const GW = 38, GH = 46, D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }, OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const LEFT = { up: 'left', left: 'down', down: 'right', right: 'up' }, RIGHT = { up: 'right', right: 'down', down: 'left', left: 'up' };
  const rngOf = s => { let a = (s >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  function create(o) {
    o = o || {}; const rnd = rngOf(o.seed || 1), sfx = o.sfx || (() => {}), say = o.say || (() => {});
    const S = { GW, GH, D, OPP, LEFT, RIGHT, t: 0, score: 0, lives: 3, round: 1, wins: 0, over: false, art: o.art || 'anon', grid: new Int8Array(GW * GH), bikes: [], acc: 0, state: 'ready', wait: 1.2, events: [], kills: 0, alive: 0, sec: 0, flash: [] };
    const ev = (type, d) => { S.events.push(Object.assign({ type, t: S.t }, d || {})); if (S.events.length > 200) S.events.shift(); };
    S.rate = () => Math.min(19, 10 + 1.1 * (S.round - 1)); // cells per second
    S.free = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH && !S.grid[y * GW + x];
    // reachable free cells from (x, y), capped
    S.room = function (x, y, cap) { if (!S.free(x, y)) return 0; const seen = new Uint8Array(GW * GH), q = [y * GW + x]; seen[q[0]] = 1; let n = 0;
      while (q.length && n < cap) { const c = q.pop(); n++; const cx = c % GW, cy = (c / GW) | 0; for (const k in D) { const nx = cx + D[k][0], ny = cy + D[k][1]; if (S.free(nx, ny)) { const j = ny * GW + nx; if (!seen[j]) { seen[j] = 1; q.push(j); } } } } return n; };
    function setup() { S.grid.fill(0); S.flash.length = 0; const n = Math.min(3, 1 + Math.ceil(S.round / 2)) ; // 2 rivals in round 1-2, 3 from round 3
      const spots = [[GW >> 1, GH - 5, 'up'], [GW >> 1, 4, 'down'], [4, GH >> 1, 'right'], [GW - 5, GH >> 1, 'left']];
      S.bikes = spots.slice(0, 1 + Math.min(3, Math.max(2, n))).map(([x, y, dir], i) => ({ i, x, y, dir, next: dir, alive: true, me: i === 0, smart: i === 0 ? 0 : Math.min(0.95, 0.55 + 0.08 * (S.round - 1) + 0.1 * (i - 1)), aggro: i === 0 ? 0 : Math.min(0.8, 0.2 + 0.1 * S.round + (i === 2 ? 0.2 : 0)) }));
      S.bikes.forEach(b => { S.grid[b.y * GW + b.x] = b.i + 1; }); S.state = 'ready'; S.wait = 1.2; S.acc = 0; S.sec = 0; }
    setup();
    S.me = () => S.bikes[0];
    function aiTurn(b) { const me = S.bikes[0]; const opts = [b.dir, LEFT[b.dir], RIGHT[b.dir]]; let best = b.dir, bv = -1e9;
      for (const d of opts) { const nx = b.x + D[d][0], ny = b.y + D[d][1]; if (!S.free(nx, ny)) { if (-1e6 > bv) { bv = -1e6; best = d; } continue; }
        let v = rnd() < b.smart ? S.room(nx, ny, 260) : (rnd() * 40 + 30); // dumb moves look only a few cells ahead
        let ahead = 0; for (let k = 1; k <= 6; k++) { if (S.free(b.x + D[d][0] * k, b.y + D[d][1] * k)) ahead++; else break; } v += ahead * 2 + (d === b.dir ? 9 : 0);
        if (me.alive && b.aggro > 0) { const tx = me.x + D[me.dir][0] * 5, ty = me.y + D[me.dir][1] * 5; v -= b.aggro * 1.2 * (Math.abs(tx - nx) + Math.abs(ty - ny)); }
        v += rnd() * 4; if (v > bv) { bv = v; best = d; } }
      b.next = best; }
    S.turn = d => { const b = S.bikes[0]; if (!b.alive || !D[d]) return; if (d === OPP[b.dir]) return; b.next = d; };
    function tick() {
      for (const b of S.bikes) if (b.alive && !b.me) aiTurn(b);
      const moves = []; for (const b of S.bikes) if (b.alive) { b.dir = b.next; moves.push([b, b.x + D[b.dir][0], b.y + D[b.dir][1]]); }
      const dead = new Set(); for (const [b, nx, ny] of moves) { if (!S.free(nx, ny)) dead.add(b); for (const [c, cx, cy] of moves) if (c !== b && cx === nx && cy === ny) dead.add(b); }
      for (const [b, nx, ny] of moves) { if (dead.has(b)) continue; b.x = nx; b.y = ny; S.grid[ny * GW + nx] = b.i + 1; }
      for (const b of dead) { b.alive = false; S.flash.push({ x: b.x, y: b.y, t: 0.8, i: b.i }); ev('crash', { me: b.me, i: b.i });
        if (!b.me && S.bikes[0].alive) { S.kills++; S.score += 250; say('RIVAL OUT +250', 0.8); } sfx(b.me ? 'crash' : 'boomS'); }
      // free a crashed rival's trail after a moment? keep it: it is part of the arena
      const me = S.bikes[0], rivals = S.bikes.filter(b => !b.me && b.alive).length;
      if (!me.alive) { S.lives--; S.state = 'lost'; S.wait = 1.6; say(S.lives > 0 ? 'CRASHED!' : 'GAME OVER', 1.4); }
      else if (!rivals) { const bonus = 500 * S.round; S.score += bonus; S.wins++; S.state = 'won'; S.wait = 1.8; sfx('level'); say(`ROUND ${S.round} WON  +${bonus}`, 1.6); ev('round', { round: S.round }); }
    }
    S.step = function (h, I) {
      if (S.over) return; S.t += h; for (const f of S.flash) f.t -= h;
      for (const k of ['up', 'down', 'left', 'right']) if (I.take(k)) S.turn(k);
      if (I.take('tap')) {}
      if (S.state !== 'run') { S.wait -= h; if (S.wait > 0) return;
        if (S.state === 'ready') { S.state = 'run'; sfx('start'); return; }
        if (S.state === 'lost' && S.lives <= 0) { S.over = true; sfx('over'); return; }
        if (S.state === 'won') S.round++; setup(); return; }
      S.sec += h; if (S.sec >= 1) { S.sec -= 1; S.score += 10; }
      S.acc += h * S.rate(); while (S.acc >= 1 && S.state === 'run') { S.acc -= 1; tick(); }
    };
    S.result = () => ({ score: S.score, time: S.t, moves: S.wins });
    return S;
  }
  return { create, GW, GH };
});
