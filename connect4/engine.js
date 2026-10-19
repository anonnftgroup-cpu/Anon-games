/* ANON Four in a Row engine: board, win detection and the computer player (negamax + alpha-beta,
   transposition table, iterative deepening with a time budget). No DOM. Works in browsers and Node. */
(function (root) {
  'use strict';
  const W = 7, H = 6, N = W * H, WIN = 100000;
  const idx = (c, r) => c * H + r;               // r = 0 is the bottom row
  // every line of four on the board (69 of them)
  const LINES = [];
  for (let c = 0; c < W; c++) for (let r = 0; r < H; r++)
    for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const ce = c + 3 * dc, re = r + 3 * dr;
      if (ce < 0 || ce >= W || re < 0 || re >= H) continue;
      LINES.push([0, 1, 2, 3].map(k => idx(c + k * dc, r + k * dr)));
    }
  const CELL_LINES = Array.from({ length: N }, () => []);
  LINES.forEach((l, i) => l.forEach(x => CELL_LINES[x].push(i)));
  const ORDER = [3, 2, 4, 1, 5, 0, 6];
  // Zobrist keys from a fixed seed (two 26-bit halves -> one safe integer key)
  let seed = 0x2f6b9d1;
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) & 0x3ffffff; };
  const ZA = [[], []], ZB = [[], []];
  for (let p = 0; p < 2; p++) for (let i = 0; i < N; i++) { ZA[p][i] = rnd(); ZB[p][i] = rnd(); }

  function Game() { this.b = new Int8Array(N); this.h = new Int8Array(W); this.n = 0; this.ka = 0; this.kb = 0; this.hist = []; }
  Game.prototype.canPlay = function (c) { return c >= 0 && c < W && this.h[c] < H; };
  Game.prototype.play = function (c, p) {        // p = 1 or -1
    const r = this.h[c], i = idx(c, r), z = p === 1 ? 0 : 1;
    this.b[i] = p; this.h[c]++; this.n++; this.ka ^= ZA[z][i]; this.kb ^= ZB[z][i]; this.hist.push(c); return r;
  };
  Game.prototype.undo = function () {
    const c = this.hist.pop(); this.h[c]--; const i = idx(c, this.h[c]), z = this.b[i] === 1 ? 0 : 1;
    this.ka ^= ZA[z][i]; this.kb ^= ZB[z][i]; this.b[i] = 0; this.n--; return c;
  };
  // would player p win by having a counter at cell i (all other three cells of a line already p)?
  Game.prototype.winsAt = function (i, p) {
    const b = this.b, ls = CELL_LINES[i];
    for (let k = 0; k < ls.length; k++) { const l = LINES[ls[k]]; let ok = true;
      for (let j = 0; j < 4; j++) { const x = l[j]; if (x !== i && b[x] !== p) { ok = false; break; } }
      if (ok) return true; }
    return false;
  };
  Game.prototype.winLine = function () {        // the first complete line of four, or null
    for (const l of LINES) { const v = this.b[l[0]]; if (v && v === this.b[l[1]] && v === this.b[l[2]] && v === this.b[l[3]]) return { player: v, cells: l.slice() }; }
    return null;
  };
  Game.prototype.full = function () { return this.n >= N; };
  Game.prototype.key = function () { return this.ka * 67108864 + this.kb; };
  Game.prototype.clone = function () { const g = new Game(); g.b.set(this.b); g.h.set(this.h); g.n = this.n; g.ka = this.ka; g.kb = this.kb; g.hist = this.hist.slice(); return g; };
  Game.fromMoves = function (moves) { const g = new Game(); let p = 1; for (const c of moves) { g.play(c, p); p = -p; } return g; };

  // static evaluation from player 1's point of view
  function evaluate(g) {
    const b = g.b; let s = 0;
    for (let k = 0; k < LINES.length; k++) { const l = LINES[k]; let a = 0, o = 0;
      for (let j = 0; j < 4; j++) { const v = b[l[j]]; if (v === 1) a++; else if (v === -1) o++; }
      if (a && o) continue;
      if (a === 3) s += 6; else if (a === 2) s += 2; else if (o === 3) s -= 6; else if (o === 2) s -= 2; }
    for (let r = 0; r < H; r++) { const v = b[idx(3, r)]; s += v * 3; }
    return s;
  }

  const ABORT = { abort: true };
  function Searcher(deadline) { this.tt = new Map(); this.nodes = 0; this.deadline = deadline; }
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  Searcher.prototype.search = function (g, depth, alpha, beta, color, ply) {
    if ((++this.nodes & 2047) === 0 && now() > this.deadline) throw ABORT;
    const h = g.h;
    for (let k = 0; k < W; k++) { const c = ORDER[k]; if (h[c] < H && g.winsAt(idx(c, h[c]), color)) return WIN - ply; }
    if (g.n >= N - 1) return 0;                    // our move can't win and the board fills: draw
    // opponent threats we must block right now
    let forced = -1, threats = 0;
    for (let k = 0; k < W; k++) { const c = ORDER[k]; if (h[c] < H && g.winsAt(idx(c, h[c]), -color)) { threats++; forced = c; } }
    if (threats > 1) return -(WIN - ply - 1);
    if (depth <= 0) return color * evaluate(g);
    const key = g.key(), e = this.tt.get(key); let first = -1;
    if (e) { if (e.d >= depth) { if (e.f === 0) return e.v; if (e.f === 1 && e.v >= beta) return e.v; if (e.f === -1 && e.v <= alpha) return e.v; } first = e.m; }
    const a0 = alpha; let best = -Infinity, bestM = -1;
    const moves = forced >= 0 ? [forced] : (first >= 0 ? [first, ...ORDER.filter(c => c !== first)] : ORDER);
    for (let k = 0; k < moves.length; k++) { const c = moves[k]; if (h[c] >= H) continue;
      // never play directly under an opponent's winning cell (unless forced)
      g.play(c, color);
      let v;
      if (forced < 0 && h[c] < H && g.winsAt(idx(c, h[c]), -color)) v = -(WIN - ply - 2);
      else v = -this.search(g, depth - 1, -beta, -alpha, -color, ply + 1);
      g.undo();
      if (v > best) { best = v; bestM = c; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) break; }
    if (bestM < 0) return 0;
    this.tt.set(key, { d: depth, v: best, f: best <= a0 ? -1 : best >= beta ? 1 : 0, m: bestM });
    return best;
  };
  // score every legal root move at a fixed depth
  Searcher.prototype.root = function (g, depth, color) {
    const out = [];
    for (const c of ORDER) { if (!g.canPlay(c)) continue;
      const r = g.h[c]; let v;
      if (g.winsAt(idx(c, r), color)) v = WIN;
      else { g.play(c, color); v = -this.search(g, depth - 1, -WIN - 1, WIN + 1, -color, 1); g.undo(); }
      out.push({ c, v }); }
    return out;
  };

  const LEVELS = {
    easy:   { depth: 1, blockChance: 0.55, noise: true },
    medium: { depth: 4, slack: 3 },
    hard:   { timeMs: 650, maxDepth: 42, slip: 0.12, slipMargin: 12 }   // strong, but ~1 in 8 quiet moves takes the 2nd-best option
  };
  // choose a move for `color` (1 or -1). opts: { level, rand, timeMs }
  function chooseMove(g, color, opts) {
    opts = opts || {}; const L = Object.assign({}, LEVELS[opts.level || 'hard'], opts.timeMs ? { timeMs: opts.timeMs } : {});
    const rand = opts.rand || Math.random, t0 = now(), legal = ORDER.filter(c => g.canPlay(c));
    if (!legal.length) return { col: -1, ms: 0, depth: 0 };
    const win = legal.find(c => g.winsAt(idx(c, g.h[c]), color));
    if (win !== undefined) return { col: win, ms: now() - t0, depth: 1, reason: 'win' };
    const block = legal.find(c => g.winsAt(idx(c, g.h[c]), -color));
    if (opts.level === 'easy') {
      if (block !== undefined && rand() < L.blockChance) return { col: block, ms: now() - t0, depth: 1, reason: 'block' };
      const w = legal.map(c => 4 - Math.abs(3 - c) + 1), tot = w.reduce((a, b) => a + b, 0); let x = rand() * tot;
      for (let i = 0; i < legal.length; i++) { x -= w[i]; if (x <= 0) return { col: legal[i], ms: now() - t0, depth: 0, reason: 'random' }; }
      return { col: legal[legal.length - 1], ms: now() - t0, depth: 0 };
    }
    if (block !== undefined) return { col: block, ms: now() - t0, depth: 1, reason: 'block' };
    const s = new Searcher(L.timeMs ? t0 + L.timeMs : Infinity);
    if (L.depth) {                                   // medium: fixed depth, a little variety among near-best moves
      const sc = s.root(g, L.depth, color), best = Math.max(...sc.map(x => x.v));
      const ok = sc.filter(x => x.v >= best - L.slack && (best < WIN - 100 || x.v === best));
      return { col: ok[Math.floor(rand() * ok.length)].c, ms: now() - t0, depth: L.depth, nodes: s.nodes };
    }
    let bestCol = legal[0], done = 0, lastSc = null; const h0 = g.hist.length;     // hard: iterative deepening until the time budget runs out
    for (let d = 1; d <= Math.min(L.maxDepth, N - g.n); d++) {
      try { const sc = s.root(g, d, color); let b = sc[0]; for (const x of sc) if (x.v > b.v) b = x; bestCol = b.c; done = d; lastSc = sc;
        if (b.v >= WIN - 100 || sc.every(x => x.v <= -(WIN - 100))) break;   // forced result found
      } catch (e) { while (g.hist.length > h0) g.undo(); if (e !== ABORT) throw e; break; }
    }
    // Beatable Hard: in a quiet position (no forced win/loss in sight, close scores) it sometimes plays the 2nd-best move
    if (L.slip && lastSc && g.n >= 4 && rand() < L.slip) {
      const srt = lastSc.slice().sort((a, b) => b.v - a.v);
      if (srt.length > 1 && srt[0].v < WIN - 100 && srt[1].v > -(WIN - 100) && srt[0].v - srt[1].v <= L.slipMargin)
        return { col: srt[1].c, ms: now() - t0, depth: done, nodes: s.nodes, reason: 'slip' };
    }
    return { col: bestCol, ms: now() - t0, depth: done, nodes: s.nodes };
  }

  const api = { W, H, N, LINES, Game, chooseMove, evaluate, idx, LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ANON_C4_ENGINE = api;
})(typeof self !== 'undefined' ? self : this);
/* Web Worker mode: the page sends { id, moves, color, level } and gets the chosen move back. */
if (typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = e => {
    const d = e.data || {}, E = self.ANON_C4_ENGINE;
    const r = E.chooseMove(E.Game.fromMoves(d.moves || []), d.color, { level: d.level });
    self.postMessage(Object.assign({ id: d.id }, r));
  };
}
