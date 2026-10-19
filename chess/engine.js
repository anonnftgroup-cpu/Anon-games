/* ANON Chess engine: alpha-beta + quiescence on top of chess.js (rules). Levels easy / medium / hard. */
(function (root) {
  'use strict';
  const V = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 };
  // piece-square tables, white's view, index 0 = a8
  const T = {
    p: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    n: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    b: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    r: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    k: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20]
  };
  const idx = (sq, c) => { const r = sq >> 4, f = sq & 7; return (c === 'w' ? r : 7 - r) * 8 + f; };
  const pv = (p, sq, c) => V[p] + T[p][idx(sq, c)];
  function evalBoard(ch) { let s = 0; const b = ch._board; for (let sq = 0; sq < 128; sq++) { if (sq & 0x88) continue; const x = b[sq]; if (!x) continue; const v = pv(x.type, sq, x.color); s += x.color === 'w' ? v : -v; } return s; }
  function delta(m) { // change in evaluation from the mover's point of view
    const them = m.color === 'w' ? 'b' : 'w'; let d = -pv(m.piece, m.from, m.color) + pv(m.promotion || m.piece, m.to, m.color);
    if (m.captured) { let csq = m.to; if (m.flags & 8) csq = m.color === 'w' ? m.to + 16 : m.to - 16; d += pv(m.captured, csq, them); }
    if (m.flags & 32) { const rf = m.color === 'w' ? 0x77 : 0x07; d += -pv('r', rf, m.color) + pv('r', rf - 2, m.color); }
    if (m.flags & 64) { const rf = m.color === 'w' ? 0x70 : 0x00; d += -pv('r', rf, m.color) + pv('r', rf + 3, m.color); }
    return d;
  }
  const order = ms => ms.map(m => ({ m, o: (m.captured ? 10 * V[m.captured] - V[m.piece] + 1000 : 0) + (m.promotion ? 800 : 0) })).sort((a, b) => b.o - a.o).map(x => x.m);
  const MATE = 100000;
  function qs(ch, ev, alpha, beta, ctx, qd) {
    if ((++ctx.nodes & 511) === 0 && Date.now() > ctx.deadline) ctx.stop = true;
    if (ev >= beta) return ev; if (ev > alpha) alpha = ev; if (qd <= 0) return ev;
    const ms = order(ch._moves({ legal: true }).filter(m => m.captured || m.promotion));
    for (const m of ms) { ch._makeMove(m); const v = -qs(ch, -(ev + delta(m)), -beta, -alpha, ctx, qd - 1); ch._undoMove(); if (ctx.stop) return 0; if (v >= beta) return v; if (v > alpha) alpha = v; }
    return alpha;
  }
  function ab(ch, depth, ev, alpha, beta, ctx, ply) {
    if ((++ctx.nodes & 511) === 0 && Date.now() > ctx.deadline) ctx.stop = true;
    const ms = ch._moves({ legal: true });
    if (!ms.length) return ch._isKingAttacked(ch._turn) ? -MATE + ply : 0;
    if (depth <= 0) return qs(ch, ev, alpha, beta, ctx, ctx.qd);
    let best = -Infinity;
    for (const m of order(ms)) { ch._makeMove(m); const v = -ab(ch, depth - 1, -(ev + delta(m)), -beta, -alpha, ctx, ply + 1); ch._undoMove(); if (ctx.stop) return 0;
      if (v > best) best = v; if (v > alpha) alpha = v; if (alpha >= beta) break; }
    return best;
  }
  const LEVELS = { easy: { depth: 1, ms: 300, noise: 140, qd: 1, rand: 0.25 }, medium: { depth: 3, ms: 700, noise: 25, qd: 4 }, hard: { depth: 6, ms: 1600, noise: 0, qd: 8, slip: 0.06 } };
  function best(fen, level, rnd) {
    rnd = rnd || Math.random; const L = LEVELS[level] || LEVELS.medium; const ch = new root.Chess(fen);
    const all = ch._moves({ legal: true }); if (!all.length) return null;
    const ev0 = (ch._turn === 'w' ? 1 : -1) * evalBoard(ch);
    if (L.rand && rnd() < L.rand) { const m = all[Math.floor(rnd() * all.length)]; return toObj(m); }
    const ctx = { nodes: 0, deadline: Date.now() + L.ms, stop: false, qd: L.qd };
    let scored = order(all).map(m => ({ m, v: 0 }));
    for (let d = 1; d <= L.depth; d++) {
      const cur = []; let alpha = -Infinity;
      for (const s of scored) { ch._makeMove(s.m); const v = -ab(ch, d - 1, -(ev0 + delta(s.m)), -Infinity, -alpha + 1, ctx, 1); ch._undoMove(); if (ctx.stop) break; cur.push({ m: s.m, v }); if (v > alpha) alpha = v; }
      if (ctx.stop && d > 1) break;
      const done = new Set(cur.map(c => c.m)); scored = cur.concat(scored.filter(s => !done.has(s.m)).map(s => ({ m: s.m, v: -Infinity }))).sort((a, b) => b.v - a.v);
      if (scored[0].v > MATE - 100) break;
    }
    let pick = scored.filter(s => s.v > -Infinity).map(s => ({ m: s.m, v: s.v + (L.noise ? (rnd() - 0.5) * 2 * L.noise : 0) })).sort((a, b) => b.v - a.v);
    if (!pick.length) pick = scored;
    if (L.slip && pick.length > 1 && rnd() < L.slip && pick[1].v > pick[0].v - 70 && Math.abs(pick[0].v) < MATE - 100) return toObj(pick[1].m);
    return toObj(pick[0].m);
  }
  const SQ = sq => 'abcdefgh'[sq & 7] + (8 - (sq >> 4));
  const toObj = m => ({ from: SQ(m.from), to: SQ(m.to), promotion: m.promotion || undefined });
  const API = { best, evalBoard, LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.CHE = API;
})(typeof window !== 'undefined' ? window : globalThis);
