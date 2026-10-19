/* ANON Shadow Maze · rules + movement (no DOM). Original maze "Shadow Shrine" by ANON NFTs. */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.SMGame = f(); })(this, function () {
  'use strict';
  const MAZE = ['###################', '#........#........#', '#o##.###.#.###.##o#', '#.................#', '#.##.#.#####.#.##.#', '#....#...#...#....#',
    '####.###.#.###.####', 'T......#...#......T', '####.#.##-##.#.####', '#....#.#GGG#.#....#', '#.##...#GGG#...##.#', '#..#.#.#####.#.#..#',
    '##.#.#.......#.#.##', '#....###.#.###....#', '#.##.....#.....##.#', '#.#..##.###.##..#.#', '#o#.#.........#.#o#', '#...#.###.###.#...#',
    '#.###...#.#...###.#', '#.................#', '###################'];
  const W = 19, H = 21, START = { x: 9, y: 12 }, DOOR = { x: 9, y: 8 }, HOME = [{ x: 9, y: 9 }, { x: 8, y: 10 }, { x: 10, y: 10 }, { x: 9, y: 10 }], TOKEN = { x: 9, y: 14 };
  const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }, OPP = { left: 'right', right: 'left', up: 'down', down: 'up' };
  const PTS = { coin: 10, gem: 50, ghost: 200, level: 500 };
  function rngOf(s) { let a = s >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const ch = (x, y) => (y < 0 || y >= H) ? '#' : MAZE[y][((x % W) + W) % W];
  const walkP = (x, y) => '.oT '.includes(ch(x, y));
  const walkG = (x, y, inHouse) => walkP(x, y) || ch(x, y) === 'G' || (ch(x, y) === '-' );
  function create(o) {
    o = o || {}; const rnd = rngOf(o.seed || 1), sfx = o.sfx || (() => {}), say = o.say || (() => {});
    const S = { W, H, MAZE, t: 0, score: 0, lives: 3, level: 1, over: false, coins: null, left: 0, eatenThisLevel: 0, fright: 0, chain: 0, ready: 1.6,
      token: null, tokensTaken: 0, ghostsEaten: 0, extra: false, pl: null, gh: [], events: [], deaths: 0, art: o.art || 'anon' };
    const ev = (type, d) => { S.events.push(Object.assign({ type, t: S.t }, d || {})); if (S.events.length > 50) S.events.shift(); };
    function fill() { S.coins = MAZE.map(r => r.split('').map(c => c === '.' ? 1 : c === 'o' ? 2 : 0)); S.left = 0; S.coins.forEach(r => r.forEach(v => { if (v) S.left++; })); S.eatenThisLevel = 0; S.token = null; }
    const speedP = () => Math.min(8.2, 5.6 + 0.3 * (S.level - 1)), speedG = () => Math.min(8.4, 4.9 + 0.38 * (S.level - 1));
    const frightTime = () => Math.max(1.5, 7 - 0.6 * (S.level - 1));
    function place() {
      S.pl = { x: START.x, y: START.y, dir: 'left', next: 'left', prog: 0, moving: true };
      S.gh = [0, 1, 2, 3].map(i => ({ i, x: i === 0 ? DOOR.x : HOME[i].x, y: i === 0 ? DOOR.y - 1 : HOME[i].y, dir: 'left', prog: 0, state: i === 0 ? 'out' : 'home',
        release: [0, 2.5, 5, 7.5][i] * Math.max(0.35, 1 - 0.15 * (S.level - 1)), fr: false, roam: 0 }));
      S.fright = 0; S.ready = 1.6; S.wave = 0; say('READY!', 1.5);
    }
    fill(); place();
    // BFS distance field from a target (wraps through the side tunnel)
    function field(tx, ty, ghost) { const d = new Int16Array(W * H).fill(-1), q = [tx + ty * W]; d[q[0]] = 0;
      for (let h = 0; h < q.length; h++) { const c = q[h], x = c % W, y = (c / W) | 0; for (const k in DIRS) { const nx = (x + DIRS[k][0] + W) % W, ny = y + DIRS[k][1];
        if (ny < 0 || ny >= H) continue; const n = nx + ny * W; if (d[n] >= 0) continue; if (!(ghost ? walkG(nx, ny) : walkP(nx, ny))) continue; d[n] = d[c] + 1; q.push(n); } }
      return d; }
    const doorField = field(DOOR.x, DOOR.y, true);
    S.field = field;
    function canGo(e, d, ghost) { const [dx, dy] = DIRS[d], nx = e.x + dx, ny = e.y + dy;
      if (!ghost) return walkP(nx, ny);
      if (ch(nx, ny) === '-' || ch(nx, ny) === 'G') return e.state === 'eyes' || e.state === 'leaving';
      return walkG(nx, ny); }
    function ghostChoice(g) {
      const opts = Object.keys(DIRS).filter(d => canGo(g, d, true)); let c = opts.filter(d => d !== OPP[g.dir]); if (!c.length) c = opts; if (!c.length) return g.dir;
      if (g.state === 'eyes' || g.state === 'leaving') { const tgt = g.state === 'eyes' ? field(HOME[0].x, HOME[0].y + 1, true) : doorField;
        if (g.state === 'leaving') { // head up through the door
          let best = c[0], bv = 1e9; c.forEach(d => { const v = doorField[((g.x + DIRS[d][0] + W) % W) + (g.y + DIRS[d][1]) * W]; if (v >= 0 && v < bv) { bv = v; best = d; } }); return best; }
        let best = c[0], bv = 1e9; c.forEach(d => { const v = tgt[((g.x + DIRS[d][0] + W) % W) + (g.y + DIRS[d][1]) * W]; if (v >= 0 && v < bv) { bv = v; best = d; } }); return best; }
      if (g.fr) return c[Math.floor(rnd() * c.length)];
      const smart = g.roam > 0 ? 0.2 : Math.min(0.9, [0.62, 0.52, 0.42, 0.36][g.i] + 0.06 * (S.level - 1));
      if (rnd() > smart) return c[Math.floor(rnd() * c.length)];
      // pack hunting: two hunters go for the ninja, two try to cut off the tile the ninja is heading to
      const p = S.pl, [dx, dy] = DIRS[p.dir], ahead = g.i % 2 ? 3 : 0; let tx = p.x, ty = p.y;
      for (let k = 0; k < ahead && walkP(tx + dx, ty + dy); k++) { tx += dx; ty += dy; } tx = (tx + W) % W;
      const f = field(tx, ty, false); let best = c[0], bv = 1e9;
      c.forEach(d => { const v = f[((g.x + DIRS[d][0] + W) % W) + (g.y + DIRS[d][1]) * W]; const vv = v < 0 ? 999 : v; if (vv < bv) { bv = vv; best = d; } }); return best;
    }
    function moveEnt(e, dist, ghost, I) {
      let guard = 0;
      while (dist > 1e-9 && guard++ < 8) {
        if (!ghost && I) { const want = e.next; if (want === OPP[e.dir] && e.prog > 0) { const [dx, dy] = DIRS[e.dir]; e.x = (e.x + dx + W) % W; e.y += dy; e.prog = 1 - e.prog; e.dir = want; } }
        if (e.prog === 0) { // at a tile centre: choose
          if (ghost) { e.dir = ghostChoice(e); if (!canGo(e, e.dir, true)) return; }
          else { if (canGo(e, e.next, false)) e.dir = e.next; if (!canGo(e, e.dir, false)) { e.moving = false; return; } e.moving = true; }
        }
        const step = Math.min(dist, 1 - e.prog); e.prog += step; dist -= step;
        if (e.prog >= 1 - 1e-9) { const [dx, dy] = DIRS[e.dir]; e.x = (e.x + dx + W) % W; e.y += dy; e.prog = 0; if (ghost) arrive(e); else eat(); }
      }
    }
    function arrive(g) {
      if (g.state === 'eyes' && g.x === HOME[0].x && g.y === HOME[0].y + 1) { g.state = 'leaving'; g.fr = false; }
      else if (g.state === 'leaving' && g.y <= DOOR.y - 1) { g.state = 'out'; }
    }
    function eat() {
      const p = S.pl, v = S.coins[p.y] && S.coins[p.y][p.x];
      if (v) { S.coins[p.y][p.x] = 0; S.left--; S.eatenThisLevel++;
        if (v === 1) { S.score += PTS.coin; sfx('coin'); } else { S.score += PTS.gem; S.fright = frightTime(); S.chain = 0; S.gh.forEach(g => { if (g.state === 'out' || g.state === 'home') { g.fr = true; if (g.prog > 0 && g.state === 'out') { const [dx, dy] = DIRS[g.dir]; g.x = (g.x + dx + W) % W; g.y += dy; g.prog = 1 - g.prog; g.dir = OPP[g.dir]; } } }); sfx('gem'); ev('gem'); }
        if (S.eatenThisLevel === 60 || S.eatenThisLevel === 140) { S.token = { x: TOKEN.x, y: TOKEN.y, until: S.t + 9, art: S.tokensTaken }; ev('token'); }
        if (S.left === 0) levelUp();
      }
      if (S.token && p.x === S.token.x && p.y === S.token.y) { const pts = Math.min(2000, 200 * S.level + 100); S.score += pts; S.tokensTaken++; S.token = null; sfx('bonus'); ev('tokenTaken', { pts }); say('+' + pts + ' NFT TOKEN', 1.2); }
      if (!S.extra && S.score >= 10000) { S.extra = true; S.lives++; sfx('level'); say('EXTRA LIFE!', 1.4); }
    }
    function levelUp() { S.score += PTS.level * S.level; S.level++; sfx('level'); ev('level', { level: S.level }); fill(); place(); say('LEVEL ' + S.level, 1.6); }
    const pos = e => { const [dx, dy] = DIRS[e.dir]; return { x: e.x + dx * e.prog, y: e.y + dy * e.prog }; };
    S.pos = pos;
    function collide() {
      const p = pos(S.pl);
      for (const g of S.gh) { if (g.state === 'eyes' || g.state === 'home' || g.state === 'leaving' && !g.fr && g.y > DOOR.y) continue; const q = pos(g); let dx = Math.abs(p.x - q.x); dx = Math.min(dx, W - dx);
        if (dx + Math.abs(p.y - q.y) > 0.7) continue;
        if (g.fr) { S.chain++; const pts = PTS.ghost * Math.pow(2, Math.min(3, S.chain - 1)); S.score += pts; S.ghostsEaten++; g.fr = false; g.state = 'eyes'; sfx('eat'); ev('ghost', { pts }); say('+' + pts, 0.8); }
        else { die(); return; } }
    }
    function die() { S.lives--; S.deaths++; sfx('die'); ev('die'); if (S.lives <= 0) { S.over = true; ev('over'); return; } place(); say('OUCH!  ' + S.lives + (S.lives === 1 ? ' life' : ' lives') + ' left', 1.5); }
    S.step = function (h, I) {
      if (S.over) return;
      if (I) for (const d of ['left', 'right', 'up', 'down']) if (I.take(d)) S.pl.next = d;
      if (I && I.held) for (const d of ['left', 'right', 'up', 'down']) if (I.held[d]) S.pl.next = d;
      S.t += h; if (S.ready > 0) { S.ready -= h; return; }
      S.wave += h; const cyc = S.wave % 26, roamLen = Math.max(2, 7 - S.level); S.gh.forEach(g => { g.roam = cyc < roamLen ? 1 : 0; });
      if (S.fright > 0) { S.fright -= h; if (S.fright <= 0) S.gh.forEach(g => { g.fr = false; }); }
      if (S.token && S.t > S.token.until) S.token = null;
      const tun = e => ch(e.x, e.y) === 'T' || e.x <= 0 || e.x >= W - 1;
      moveEnt(S.pl, speedP() * h * (tun(S.pl) ? 0.8 : 1), false, I);
      for (const g of S.gh) {
        if (g.state === 'home') { g.release -= h; if (g.release <= 0) { g.state = 'leaving'; } else continue; }
        const sp = g.state === 'eyes' ? 11 : g.fr ? speedG() * 0.55 : speedG() * (tun(g) ? 0.6 : 1);
        moveEnt(g, sp * h, true);
      }
      collide();
    };
    S.walkP = walkP; S.ch = ch; S.DIRS = DIRS;
    return S;
  }
  return { create, MAZE, W, H, PTS };
});
