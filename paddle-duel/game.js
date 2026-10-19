// ANON Paddle Duel: game logic (no DOM). Original ANON NFTs game. Browser: window.PDGame, node: require().
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.PDGame = f(); })(this, function () {
  'use strict';
  const W = 360, H = 520, PY = H - 30, AY = 30, BR = 7, PH = 12, WIN = 7;
  const MODES = {
    easy:   { aiSpeed: 175, react: 0.36, err: 60, aiW: 76, pw: 80, v0: 240, vMax: 540, acc: 1.06, mult: 1, base: 100, aim: 0.15, home: 0.4 },
    medium: { aiSpeed: 265, react: 0.24, err: 36, aiW: 70, pw: 74, v0: 270, vMax: 720, acc: 1.08, mult: 2, base: 300, aim: 0.45, home: 0.7 },
    hard:   { aiSpeed: 380, react: 0.15, err: 18, aiW: 66, pw: 70, v0: 300, vMax: 880, acc: 1.1, mult: 4, base: 800, aim: 0.85, home: 0.95 }
  };
  const rngOf = s => { let a = (s >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  // x where a ball (x, y, vx, vy) reaches line yT, with side-wall reflections
  function landX(x, y, vx, vy, yT) { if (vy === 0 || (yT - y) / vy < 0) return x; const t = (yT - y) / vy; let px = x + vx * t; const lo = BR, hi = W - BR, span = hi - lo; let u = (px - lo) % (2 * span); if (u < 0) u += 2 * span; return lo + (u > span ? 2 * span - u : u); }
  function create(o) {
    o = o || {}; const rnd = rngOf(o.seed || 1), sfx = o.sfx || (() => {}), say = o.say || (() => {}); const mode = MODES[o.mode] ? o.mode : 'medium', M = MODES[mode];
    const S = { W, H, PY, AY, BR, PH, WIN, M, mode, t: 0, score: 0, over: false, won: false, art: o.art || 'anon', rival: o.rival || null, me: 0, ai: 0, points: 0, rally: 0, hits: 0, longest: 0,
      px: W / 2, ax: W / 2, aTarget: W / 2, aSeenT: 0, ball: null, serveT: 1.4, server: 1, events: [], speed: M.v0, trail: [] };
    const ev = (type, d) => { S.events.push(Object.assign({ type, t: S.t }, d || {})); if (S.events.length > 200) S.events.shift(); };
    S.landX = landX;
    function serve() { const dir = S.server; const ang = (rnd() - 0.5) * 0.7; S.speed = M.v0; S.ball = { x: W / 2, y: H / 2, vx: Math.sin(ang) * M.v0, vy: Math.cos(ang) * M.v0 * dir }; S.rally = 0; S.aSeenT = 0; sfx('tick'); }
    function point(mine) { S.points++; if (mine) S.me++; else S.ai++; S.longest = Math.max(S.longest, S.rally); S.ball = null; S.serveT = 1.1; S.server = mine ? -1 : 1;
      sfx(mine ? 'point' : 'lose'); ev('point', { mine }); say(mine ? 'POINT!' : 'RIVAL POINT', 0.9);
      if (S.me >= WIN || S.ai >= WIN) { S.over = true; S.won = S.me >= WIN; S.score = 10 * M.mult * S.me + (S.won ? M.base : 0); sfx(S.won ? 'bonus' : 'over'); say(S.won ? 'YOU WIN!' : 'RIVAL WINS', 2); }
      else S.score = 10 * M.mult * S.me; }
    function bounce(b, cx, w, up) { const off = Math.max(-1, Math.min(1, (b.x - cx) / (w / 2 + BR))); const ang = off * 1.05; S.speed = Math.min(M.vMax, S.speed * M.acc);
      b.vx = Math.sin(ang) * S.speed; b.vy = Math.cos(ang) * S.speed * (up ? -1 : 1); S.rally++; sfx('hit'); }
    S.aiPlan = function () { const b = S.ball; if (!b) return W / 2;
      if (b.vy < 0) { let x = landX(b.x, b.y, b.vx, b.vy, AY + PH / 2 + BR); const bn = Math.abs(b.vx * (AY - b.y) / b.vy) / W; x += (rnd() - 0.5) * 2 * M.err * (0.4 + S.speed / 550) * (1 + 0.35 * bn);
        // aim: strike off-centre to send the ball away from the player
        if (rnd() < M.aim) { const want = S.px < W / 2 ? 1 : -1; x -= want * M.aiW * 0.32; } return x; }
      return W / 2 + (landX(b.x, b.y, b.vx, b.vy, PY) - W / 2) * 0.25 * M.home + (W / 2 - W / 2); };
    S.step = function (h, I) {
      if (S.over) return; S.t += h;
      // player paddle: drag (fast follow) or held keys
      const half = M.pw / 2; let tx = null; if (I.pointer && I.pointer.down) tx = I.pointer.x; const kv = 430;
      if (tx != null) { const d = tx - S.px, mx = 1100 * h; S.px += Math.max(-mx, Math.min(mx, d)); }
      else { if (I.held.left > 0) S.px -= kv * h; if (I.held.right > 0) S.px += kv * h; }
      S.px = Math.max(half, Math.min(W - half, S.px));
      // rival: re-plans after a reaction delay
      S.aSeenT -= h; if (S.aSeenT <= 0) { S.aTarget = S.aiPlan(); S.aSeenT = M.react * (0.8 + rnd() * 0.4); }
      const ah = M.aiW / 2, d = S.aTarget - S.ax, mx = M.aiSpeed * h; S.ax += Math.max(-mx, Math.min(mx, d)); S.ax = Math.max(ah, Math.min(W - ah, S.ax));
      if (!S.ball) { S.serveT -= h; if (S.serveT <= 0) serve(); return; }
      const b = S.ball, oy = b.y; b.x += b.vx * h; b.y += b.vy * h;
      if (b.x < BR) { b.x = 2 * BR - b.x; b.vx = Math.abs(b.vx); sfx('wall'); } if (b.x > W - BR) { b.x = 2 * (W - BR) - b.x; b.vx = -Math.abs(b.vx); sfx('wall'); }
      const pTop = PY - PH / 2 - BR; if (b.vy > 0 && oy <= pTop && b.y >= pTop) { if (Math.abs(b.x - S.px) <= half + BR * 0.8) { b.y = pTop; bounce(b, S.px, M.pw, true); S.hits++; ev('hit'); S.aSeenT = Math.min(S.aSeenT, M.react); } }
      const aBot = AY + PH / 2 + BR; if (b.vy < 0 && oy >= aBot && b.y <= aBot) { if (Math.abs(b.x - S.ax) <= ah + BR * 0.8) { b.y = aBot; bounce(b, S.ax, M.aiW, false); ev('aiHit'); S.aSeenT = M.react; } }
      if (b.y > H + 20) point(false); else if (b.y < -20) point(true);
    };
    S.result = () => ({ score: S.score, time: S.t, moves: S.points, mode });
    return S;
  }
  return { create, MODES, W, H, landX };
});
