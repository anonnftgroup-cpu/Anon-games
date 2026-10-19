/* ANON Checkers engine: English draughts (8x8, mandatory captures, multi-jumps, men crown on the far row). Side 1 moves up (row 0 is its crown row). */
(function (root) {
  'use strict';
  function init() { const b = new Int8Array(64); for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) { if (r < 3) b[r * 8 + c] = -1; else if (r > 4) b[r * 8 + c] = 1; } return b; }
  const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  function dirsFor(p) { return Math.abs(p) === 2 ? DIRS : p > 0 ? DIRS.slice(0, 2) : DIRS.slice(2); }
  function jumps(b, sq, p, path, caps, out) {
    const r = sq >> 3, c = sq & 7; let any = false;
    for (const [dr, dc] of dirsFor(p)) {
      const r1 = r + dr, c1 = c + dc, r2 = r + 2 * dr, c2 = c + 2 * dc;
      if (r2 < 0 || r2 > 7 || c2 < 0 || c2 > 7) continue;
      const m = r1 * 8 + c1, t = r2 * 8 + c2;
      if (b[t] !== 0 || b[m] === 0 || Math.sign(b[m]) === Math.sign(p) || caps.includes(m)) continue;
      any = true;
      const crowned = Math.abs(p) === 1 && (p > 0 ? r2 === 0 : r2 === 7);
      const save = b[m]; b[m] = 0; b[t] = p; b[sq] = 0;
      if (crowned) out.push({ path: path.concat(t), caps: caps.concat(m) });
      else jumps(b, t, p, path.concat(t), caps.concat(m), out);
      b[t] = 0; b[sq] = p; b[m] = save;
    }
    if (!any && caps.length) out.push({ path, caps });
  }
  function moves(b, side) {
    const caps = [], quiet = [];
    for (let s = 0; s < 64; s++) { const p = b[s]; if (!p || Math.sign(p) !== side) continue;
      const out = []; jumps(b, s, p, [s], [], out); for (const m of out) caps.push(m);
      if (caps.length) continue;
      const r = s >> 3, c = s & 7;
      for (const [dr, dc] of dirsFor(p)) { const r1 = r + dr, c1 = c + dc; if (r1 < 0 || r1 > 7 || c1 < 0 || c1 > 7) continue; const t = r1 * 8 + c1; if (!b[t]) quiet.push({ path: [s, t], caps: [] }); } }
    return caps.length ? caps : quiet;
  }
  function apply(b, m) {
    const n = Int8Array.from(b), from = m.path[0], to = m.path[m.path.length - 1]; let p = n[from]; n[from] = 0;
    for (const c of m.caps) n[c] = 0;
    if (Math.abs(p) === 1 && (p > 0 ? to < 8 : to >= 56)) p *= 2;
    n[to] = p; return n;
  }
  function evaluate(b, side) {
    let s = 0;
    for (let i = 0; i < 64; i++) { const p = b[i]; if (!p) continue; const r = i >> 3, c = i & 7;
      let v = Math.abs(p) === 2 ? 165 : 100;
      if (Math.abs(p) === 1) { v += (p > 0 ? 7 - r : r) * 4; if ((p > 0 && r === 7) || (p < 0 && r === 0)) v += 8; }
      if (c >= 2 && c <= 5 && r >= 2 && r <= 5) v += 6;
      s += p > 0 ? v : -v; }
    return side * s;
  }
  function search(b, side, depth, alpha, beta, ctx) {
    if ((++ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) ctx.stop = true;
    const ms = moves(b, side);
    if (!ms.length) return -100000 + ctx.ply;
    if (depth <= 0 && !ms[0].caps.length) return evaluate(b, side);
    let best = -Infinity;
    for (const m of ms) { ctx.ply++; const v = -search(apply(b, m), -side, depth - 1, -beta, -alpha, ctx); ctx.ply--;
      if (ctx.stop) return 0; if (v > best) best = v; if (v > alpha) alpha = v; if (alpha >= beta) break; }
    return best;
  }
  const LEVELS = { easy: { depth: 2, ms: 150, noise: 60 }, medium: { depth: 5, ms: 400, noise: 12 }, hard: { depth: 12, ms: 900, noise: 0, slip: 0.07 } };
  function best(b, side, level, rnd) {
    rnd = rnd || Math.random; const L = LEVELS[level] || LEVELS.medium; let ms = moves(b, side); if (!ms.length) return null; if (ms.length === 1) return ms[0];
    const ctx = { nodes: 0, deadline: Date.now() + L.ms, stop: false, ply: 1 }; let scored = ms.map(m => ({ m, v: 0 }));
    for (let d = 1; d <= L.depth; d++) {
      const cur = []; for (const s of scored) { const v = -search(apply(b, s.m), -side, d - 1, -Infinity, Infinity, ctx); if (ctx.stop) break; cur.push({ m: s.m, v }); }
      if (ctx.stop && cur.length < scored.length) break; scored = cur.sort((a, c) => c.v - a.v); if (scored[0].v > 50000) break; }
    let pick = scored.map(s => ({ m: s.m, v: s.v + (L.noise ? (rnd() - 0.5) * 2 * L.noise : 0) })).sort((a, c) => c.v - a.v);
    if (L.slip && rnd() < L.slip && pick.length > 1 && pick[1].v > pick[0].v - 40 && pick[0].v < 50000) return pick[1].m;
    return pick[0].m;
  }
  const API = { init, moves, apply, evaluate, best, LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.CKE = API;
})(this);
