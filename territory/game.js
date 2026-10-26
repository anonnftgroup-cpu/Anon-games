/* ANON Territory: Paper.io-style land grab. Whole map visible, territory fills with each player's ANON art. */
'use strict';
const { $, ls, modal, post, openLB, gameOver, art, ART } = AK;
const LVN = Object.fromEntries(Array.from({ length: 60 }, (_, i) => ['l' + (i + 1), 'Level ' + (i + 1)]));
const GAME = 'territory', TITLE = 'ANON Territory', N = 56, NN = N * N;
const pref = ls.get('anonTerritory.pref', { art: 'anon', best: 0, bestLv: 1 });
const show = id => document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === id));
const setHero = () => $('#hero').src = art(pref.art).cover;
AK.picker($('#artPick'), pref.art, id => { pref.art = id; ls.set('anonTerritory.pref', pref); setHero(); });
setHero(); AK.nickLine($('#nick'));
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }, DK = Object.keys(DIRS);
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const COLS = ['#ff3d9a', '#3dd6ff', '#7dff6a', '#ffb23d', '#b07dff', '#ff5a5a', '#3dffc8', '#ffe83d', '#ff8ad8', '#8aa8ff', '#c8ff3d'];
const IMG = {}; ART.forEach(a => AP.img(a.cover).then(i => IMG[a.id] = i));
// level tuning: more rivals, faster, greedier, and they hunt your trail from level 2
const LV = L => ({ bots: Math.min(2 + L, 10), spd: Math.min(1.04, .7 + .045 * L), leg: Math.min(15, 4 + L), hunt: L < 2 ? 0 : Math.min(22, 2 + 2 * L), care: 1 + Math.min(6, L * .6), target: 30 + Math.min(15, Math.round((L - 1) * 1.5)) });
let C = null, S = null, layer = null, lx = null, dirty = true;
// ---------- audio ----------
let AC = null; const snd = (f, d, type, v, f2) => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); g.gain.setValueAtTime(v || .08, t); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(g).connect(AC.destination); o.start(t); o.stop(t + d); } catch (e) {} };
const sfx = { cap: n => { [523, 659, 784, 1047].slice(0, 2 + Math.min(2, n / 60 | 0)).forEach((f, i) => setTimeout(() => snd(f, .14, 'triangle', .07), i * 60)); },
  kill: () => { snd(180, .25, 'square', .06, 60); setTimeout(() => snd(880, .12, 'triangle', .06), 90); }, die: () => snd(400, .6, 'sawtooth', .07, 50), lv: () => [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => snd(f, .18, 'triangle', .07), i * 90)) };
// ---------- world ----------
const idx = (x, y) => y * N + x;
function newWorld(lv) {
  const P = LV(lv); S.lv = lv; S.P = P; S.own = new Int8Array(NN); S.trail = new Int8Array(NN); S.ents = []; S.parts = []; S.flash = [];
  S.count = 2; S.clear = 0; S.dpct = null; S.tpct = P.target; S.cnt = new Int32Array(16);
  addEnt(true, pref.art); for (let i = 0; i < P.bots; i++) addEnt(false); dirty = true; counts(); hud();
}
function freeSpot(r) { // centre of a free (2r+1)^2 block far from heads
  let best = null, bd = -1; for (let k = 0; k < 60; k++) { const x = AP.ri(r + 2, N - r - 3), y = AP.ri(r + 2, N - r - 3); let ok = true;
    for (let dy = -r - 1; dy <= r + 1 && ok; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) { const c = idx(x + dx, y + dy); if (S.own[c] || S.trail[c]) { ok = false; break; } }
    if (!ok) continue; let d = 99; for (const e of S.ents) if (e.alive) d = Math.min(d, Math.abs(e.x - x) + Math.abs(e.y - y)); if (d > bd) { bd = d; best = [x, y]; } if (d > 18) break; }
  return best;
}
function addEnt(me, artId, slot) {
  const id = slot != null ? slot : S.ents.length + 1;
  if (!me) { const used = new Set(S.ents.filter(e => e.alive).map(e => e.art)); const pool = ART.filter(a => !used.has(a.id)); artId = (pool.length ? AP.pick(pool) : AP.pick(ART)).id; }
  const sp = me ? [N >> 1, N >> 1] : freeSpot(2); if (!sp) return null;
  const e = { id, me, art: artId, col: me ? '#f3d77a' : COLS[(id - 2) % COLS.length], x: sp[0], y: sp[1], px: sp[0], py: sp[1], t: 0, dir: AP.pick(DK), nd: null, tr: [], alive: true,
    spd: (me ? 7.2 : 7.2 * S.P.spd * (.92 + AP.rnd() * .1)), st: 'home', leg: 0, legs: [], ex: null, kills: 0, born: S.time || 0 };
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) S.own[idx(e.x + dx, e.y + dy)] = id;
  if (slot != null) S.ents[slot - 1] = e; else S.ents.push(e); dirty = true; return e;
}
function counts() { S.cnt.fill(0); for (let i = 0; i < NN; i++) S.cnt[S.own[i]]++; }
const pct = id => S.cnt[id] / NN * 100;
function capture(e) {
  const id = e.id, own = S.own; for (const c of e.tr) { own[c] = id; if (S.trail[c] === id) S.trail[c] = 0; } const n0 = S.cnt[id]; e.tr = [];
  const seen = new Uint8Array(NN), st = []; for (let i = 0; i < N; i++) for (const c of [i, idx(i, N - 1), idx(0, i), idx(N - 1, i)]) if (own[c] !== id && !seen[c]) { seen[c] = 1; st.push(c); }
  while (st.length) { const c = st.pop(), x = c % N, y = (c / N) | 0;
    if (x > 0 && !seen[c - 1] && own[c - 1] !== id) { seen[c - 1] = 1; st.push(c - 1); } if (x < N - 1 && !seen[c + 1] && own[c + 1] !== id) { seen[c + 1] = 1; st.push(c + 1); }
    if (y > 0 && !seen[c - N] && own[c - N] !== id) { seen[c - N] = 1; st.push(c - N); } if (y < N - 1 && !seen[c + N] && own[c + N] !== id) { seen[c + N] = 1; st.push(c + N); } }
  const fresh = []; for (let i = 0; i < NN; i++) if (!seen[i] && own[i] !== id) { own[i] = id; fresh.push(i); }
  counts(); dirty = true; const gained = S.cnt[id] - n0;
  for (const o of S.ents) if (o.alive && o !== e && S.cnt[o.id] === 0) die(o, e);
  if (e.me) { sfx.cap(gained); S.flash.push({ cells: fresh, t: 0 }); for (let k = 0; k < Math.min(40, 6 + gained / 8); k++) { const c = fresh.length ? AP.pick(fresh) : idx(e.x, e.y); S.parts.push({ x: c % N + .5, y: (c / N | 0) + .5, vx: (AP.rnd() - .5) * 8, vy: (AP.rnd() - .5) * 8, l: .7, c: '#f3d77a' }); }
    S.pop = { txt: '+' + (gained / NN * 100).toFixed(1) + '%', x: e.x, y: e.y, t: 1.1 }; }
}
function die(e, by, why) {
  if (!e.alive) return; e.alive = false; if (e.me) S.dpct = Math.floor(pct(1)); for (const c of e.tr) if (S.trail[c] === e.id) S.trail[c] = 0; e.tr = [];
  for (let i = 0; i < NN; i++) if (S.own[i] === e.id) S.own[i] = 0; counts(); dirty = true;
  for (let k = 0; k < 26; k++) S.parts.push({ x: e.px + .5, y: e.py + .5, vx: (AP.rnd() - .5) * 14, vy: (AP.rnd() - .5) * 14, l: .9, c: e.col });
  S.shake = e.me ? .5 : .18;
  if (by && by.me && !e.me) { by.kills++; S.kills++; S.kpts += 100 * S.lv; sfx.kill(); S.pop = { txt: 'KO! +' + 100 * S.lv, x: e.x, y: e.y, t: 1.2 }; }
  if (e.me) { S.why = why || (by ? (by === e ? 'You crossed your own trail.' : 'A rival cut your trail.') : 'Out of bounds.'); S.dead = .9; sfx.die(); if (navigator.vibrate) navigator.vibrate([60, 40, 90]); }
  else e.respawn = 2.5 + AP.rnd() * 2;
}
// ---------- bot brain ----------
const md = (a, b, x, y) => Math.abs(a - x) + Math.abs(b - y);
function safe(e, d) { const [dx, dy] = DIRS[d], x = e.x + dx, y = e.y + dy; if (x < 0 || y < 0 || x >= N || y >= N) return false; return S.trail[idx(x, y)] !== e.id; }
function toward(e, tx, ty) {
  let best = null, bv = 1e9; for (const d of DK) { if (d === OPP[e.dir] && e.tr.length) continue; if (!safe(e, d)) continue; const [dx, dy] = DIRS[d]; const v = md(e.x + dx, e.y + dy, tx, ty) + AP.rnd() * .5 + (d === e.dir ? 0 : .2); if (v < bv) { bv = v; best = d; } }
  return best || e.dir;
}
const PREV = new Int16Array(NN), Q = new Int16Array(NN);
function homeDir(e) { // BFS (avoiding my own trail) to my nearest land; returns the first step
  PREV.fill(-1); let h = 0, t = 0; const s0 = idx(e.x, e.y); PREV[s0] = s0;
  for (const d of DK) { if (d === OPP[e.dir] && e.tr.length) continue; if (!safe(e, d)) continue; const c = idx(e.x + DIRS[d][0], e.y + DIRS[d][1]); PREV[c] = DK.indexOf(d) + 10000; Q[t++] = c; }
  while (h < t) { const c = Q[h++]; if (S.own[c] === e.id) { let k = c; while (PREV[k] < 10000) k = PREV[k]; return DK[PREV[k] - 10000]; }
    const x = c % N, y = c / N | 0; for (const n of [x > 0 ? c - 1 : -1, x < N - 1 ? c + 1 : -1, y > 0 ? c - N : -1, y < N - 1 ? c + N : -1]) if (n >= 0 && PREV[n] === -1 && S.trail[n] !== e.id) { PREV[n] = c; Q[t++] = n; } }
  return null;
}
function threat(e) { // fewest steps any other head needs to reach my trail
  let m = 1e9; for (const o of S.ents) { if (!o.alive || o === e) continue; for (let i = 0; i < e.tr.length; i += 2) { const c = e.tr[i]; m = Math.min(m, md(o.x, o.y, c % N, c / N | 0)); } } return m;
}
function think(e) {
  const P = S.P, home = S.own[idx(e.x, e.y)] === e.id;
  if (home) { e.ex = [e.x, e.y]; if (e.st !== 'home') e.st = 'home'; }
  // hunt the player's trail
  const me = S.ents[0]; if (P.hunt && me !== e && me.alive && me.tr.length && e.tr.length < P.leg * 2) { let bc = -1, bd = P.hunt; for (const c of me.tr) { const d = md(e.x, e.y, c % N, c / N | 0); if (d < bd) { bd = d; bc = c; } }
    if (bc >= 0) { e.dir = toward(e, bc % N, bc / N | 0); return; } }
  if (e.st === 'home') { // leave in a good direction, plan a rectangle
    if (!home || AP.rnd() < .25) { const outs = DK.filter(d => d !== OPP[e.dir] && safe(e, d)); const d = outs.length ? AP.pick(outs) : e.dir; const turn = AP.rnd() < .5 ? 1 : -1;
      const lg = e.lg || P.leg, a = AP.ri(2, lg), b = AP.ri(2, lg); const seq = turn > 0 ? { up: 'right', right: 'down', down: 'left', left: 'up' } : { up: 'left', left: 'down', down: 'right', right: 'up' };
      e.legs = [[d, a], [seq[d], b], [seq[seq[d]], a + 1]]; e.st = 'out'; e.dir = d; }
    else if (!safe(e, e.dir)) e.dir = toward(e, N / 2, N / 2);
    return;
  }
  if (e.st === 'out') { const back = e.ex ? md(e.x, e.y, e.ex[0], e.ex[1]) : 0; if (threat(e) <= back + P.care || !e.legs.length) e.st = 'ret';
    else { const L = e.legs[0]; e.dir = L[0]; if (--L[1] <= 0) e.legs.shift(); if (!safe(e, e.dir)) e.st = 'ret'; } }
  if (e.st === 'ret') { const d = homeDir(e); if (d) e.dir = d; else e.dir = toward(e, e.ex ? e.ex[0] : N / 2, e.ex ? e.ex[1] : N / 2); }
}
// ---------- movement ----------
function advance(e) {
  if (e.me && !e.auto) { if (e.nd && (e.nd !== OPP[e.dir] || !e.tr.length)) e.dir = e.nd; e.nd = null; } else think(e);
  const [dx, dy] = DIRS[e.dir]; const x = e.x + dx, y = e.y + dy; e.px = e.x; e.py = e.y;
  if (x < 0 || y < 0 || x >= N || y >= N) return die(e, null, 'You left the map.');
  e.x = x; e.y = y; const c = idx(x, y), t = S.trail[c];
  if (t === e.id) return die(e, e);
  if (t) { const o = S.ents[t - 1]; if (o && o.alive) die(o, e); }
  if (S.own[c] === e.id) { if (e.tr.length) capture(e); } else { S.trail[c] = e.id; e.tr.push(c); }
}
function heads() { const al = S.ents.filter(e => e.alive);
  for (let i = 0; i < al.length; i++) for (let j = i + 1; j < al.length; j++) { const a = al[i], b = al[j]; if (a.x !== b.x || a.y !== b.y || !a.alive || !b.alive) continue;
    const ah = S.own[idx(a.x, a.y)] === a.id, bh = S.own[idx(b.x, b.y)] === b.id; if (!ah) die(a, b, 'Head-on crash.'); if (!bh) die(b, a, 'Head-on crash.'); } }
function step(dt) {
  if (!S || S.over || S.paused) return; S.time += dt;
  for (const p of S.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .92; p.vy *= .92; p.l -= dt; } S.parts = S.parts.filter(p => p.l > 0);
  for (const f of S.flash) f.t += dt; S.flash = S.flash.filter(f => f.t < .5); if (S.pop) S.pop.t -= dt; if (S.shake) S.shake = Math.max(0, S.shake - dt);
  if (S.dead) { S.dead -= dt; if (S.dead <= 0) end(); return; }
  if (S.count > 0) { S.count -= dt; $('#msg').textContent = S.count > .3 ? 'Level ' + S.lv + ' · claim ' + S.tpct + '%' : 'GO!'; if (S.count <= 0) $('#msg').textContent = ''; return; }
  if (S.clear) { S.clear -= dt; if (S.clear <= 0) { newWorld(S.lv + 1); } return; }
  S.played += dt;
  for (const e of S.ents) { if (!e.alive) { if (e.respawn != null && (e.respawn -= dt) <= 0) { e.respawn = null; const n = addEnt(false, null, e.id); if (!n) e.respawn = 1; } continue; }
    e.t += e.spd * dt; while (e.t >= 1 && e.alive) { e.t -= 1; advance(e); } }
  heads();
  const me = S.ents[0]; if (!me.alive) { hud(); return; }
  if (pct(1) >= S.tpct) { S.bank += Math.floor(pct(1)) * 10 * S.lv + 500 * S.lv; S.done = S.lv; S.clear = 2.2; sfx.lv(); $('#msg').textContent = 'LEVEL ' + S.lv + ' CLEAR! +' + (500 * S.lv) + ' bonus'; }
  hud();
}
const score = () => S.bank + (S.clear ? 0 : (S.dpct != null ? S.dpct : Math.floor(pct(1))) * 10 * S.lv) + S.kpts;
const hud = () => { $('#lv').textContent = 'Lv ' + S.lv + ' ×' + S.lv; $('#pc').textContent = pct(1).toFixed(1) + '% / ' + S.tpct + '%'; $('#ki').textContent = '⚔ ' + S.kills; $('#sc').textContent = score(); };
// ---------- drawing ----------
function buildLayer(cs) {
  const d = C.dpr, W = Math.round(N * cs * d); if (!layer || layer.width !== W) { layer = document.createElement('canvas'); layer.width = layer.height = W; lx = layer.getContext('2d'); }
  const x = lx; x.setTransform(d, 0, 0, d, 0, 0); x.fillStyle = '#0a0d14'; x.fillRect(0, 0, N * cs, N * cs);
  x.strokeStyle = 'rgba(212,175,55,.07)'; x.lineWidth = 1; x.beginPath(); for (let i = 0; i <= N; i += 4) { x.moveTo(i * cs, 0); x.lineTo(i * cs, N * cs); x.moveTo(0, i * cs); x.lineTo(N * cs, i * cs); } x.stroke();
  for (const e of S.ents) { if (!e.alive) continue; const id = e.id, P = new Path2D(), B = new Path2D();
    for (let y = 0; y < N; y++) { let s = -1; for (let X = 0; X <= N; X++) { const on = X < N && S.own[y * N + X] === id; if (on && s < 0) s = X; if (!on && s >= 0) { P.rect(s * cs, y * cs, (X - s) * cs + .5, cs + .5); s = -1; } } }
    for (let y = 0; y < N; y++) for (let X = 0; X < N; X++) { if (S.own[y * N + X] !== id) continue;
      if (y === 0 || S.own[(y - 1) * N + X] !== id) { B.moveTo(X * cs, y * cs); B.lineTo(X * cs + cs, y * cs); } if (y === N - 1 || S.own[(y + 1) * N + X] !== id) { B.moveTo(X * cs, y * cs + cs); B.lineTo(X * cs + cs, y * cs + cs); }
      if (X === 0 || S.own[y * N + X - 1] !== id) { B.moveTo(X * cs, y * cs); B.lineTo(X * cs, y * cs + cs); } if (X === N - 1 || S.own[y * N + X + 1] !== id) { B.moveTo(X * cs + cs, y * cs); B.lineTo(X * cs + cs, y * cs + cs); } }
    x.save(); x.clip(P); const im = IMG[e.art];
    if (im) { x.globalAlpha = e.me ? 1 : .8; AP.cover(x, im, 0, 0, N * cs, N * cs); } else { x.fillStyle = e.col; x.fillRect(0, 0, N * cs, N * cs); }
    if (!e.me) { x.globalAlpha = .38; x.fillStyle = e.col; x.fillRect(0, 0, N * cs, N * cs); } x.restore(); x.globalAlpha = 1;
    x.lineJoin = 'round'; x.strokeStyle = 'rgba(0,0,0,.7)'; x.lineWidth = Math.max(3, cs * .55); x.stroke(B); x.strokeStyle = e.col; x.lineWidth = Math.max(1.5, cs * .28); x.stroke(B); }
  dirty = false;
}
const SPR = {}; function head(a, col) { const k = a + col; if (SPR[k]) return SPR[k]; const im = IMG[a]; if (!im) return null; const R = 40, c = document.createElement('canvas'); c.width = c.height = R * 2; const x = c.getContext('2d');
  x.save(); x.beginPath(); x.arc(R, R, R - 5, 0, 7); x.clip(); AP.cover(x, im, 5, 5, R * 2 - 10, R * 2 - 10); x.restore(); x.lineWidth = 6; x.strokeStyle = col; x.beginPath(); x.arc(R, R, R - 4, 0, 7); x.stroke(); return SPR[k] = c; }
function draw() {
  if (!C || !S) return; const x = C.x, W = C.w, H = C.h, s = Math.min(W, H), cs = s / N, ox = (W - s) / 2, oy = (H - s) / 2;
  if (dirty || !layer || layer.width !== Math.round(N * cs * C.dpr)) buildLayer(cs);
  x.fillStyle = '#05070a'; x.fillRect(0, 0, W, H); x.save(); if (S.shake) x.translate((AP.rnd() - .5) * S.shake * 14, (AP.rnd() - .5) * S.shake * 14);
  x.translate(ox, oy); x.drawImage(layer, 0, 0, N * cs, N * cs);
  for (const f of S.flash) { x.fillStyle = `rgba(255,240,180,${.55 * (1 - f.t / .5)})`; for (const c of f.cells) x.fillRect(c % N * cs, (c / N | 0) * cs, cs, cs); }
  const pulse = .6 + .4 * Math.sin(S.time * 10);
  for (const e of S.ents) { if (!e.alive || !e.tr.length) continue; const hx = (e.px + (e.x - e.px) * Math.min(1, e.t) + .5) * cs, hy = (e.py + (e.y - e.py) * Math.min(1, e.t) + .5) * cs;
    x.beginPath(); const f0 = e.tr[0]; const [bx, by] = DIRS[e.dir]; let sx = f0 % N, sy = f0 / N | 0; // start at the land edge we left from
    x.moveTo((e.ex && md(e.ex[0], e.ex[1], sx, sy) === 1 ? e.ex[0] + .5 : sx + .5) * cs, (e.ex && md(e.ex[0], e.ex[1], sx, sy) === 1 ? e.ex[1] + .5 : sy + .5) * cs);
    for (const c of e.tr) x.lineTo((c % N + .5) * cs, ((c / N | 0) + .5) * cs); x.lineTo(hx, hy); x.lineCap = x.lineJoin = 'round';
    x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = cs * .95; x.stroke(); x.strokeStyle = e.col; x.globalAlpha = e.me ? .55 + .35 * pulse : .75; x.lineWidth = cs * .62; x.stroke(); x.globalAlpha = 1;
    x.setLineDash([cs * .7, cs * .5]); x.strokeStyle = e.me ? '#fff' : 'rgba(255,255,255,.65)'; x.lineWidth = Math.max(1, cs * .18); x.stroke(); x.setLineDash([]); void bx; void by; }
  for (const e of S.ents) { if (!e.alive) continue; const t = Math.min(1, e.t), hx = (e.px + (e.x - e.px) * t + .5) * cs, hy = (e.py + (e.y - e.py) * t + .5) * cs, r = cs * (e.me ? 1.9 : 1.55), sp = head(e.art, e.col);
    if (e.me) { x.save(); x.shadowColor = '#ff3d9a'; x.shadowBlur = 14; } if (sp) x.drawImage(sp, hx - r, hy - r, r * 2, r * 2); else { x.fillStyle = e.col; x.beginPath(); x.arc(hx, hy, r, 0, 7); x.fill(); } if (e.me) x.restore();
    if (S.time - e.born < 1.2 && !e.me) { x.strokeStyle = e.col; x.globalAlpha = 1 - (S.time - e.born) / 1.2; x.lineWidth = 2; x.beginPath(); x.arc(hx, hy, r + (S.time - e.born) * cs * 4, 0, 7); x.stroke(); x.globalAlpha = 1; } }
  for (const p of S.parts) { x.globalAlpha = Math.max(0, p.l); x.fillStyle = p.c; x.fillRect(p.x * cs - 2, p.y * cs - 2, 4, 4); } x.globalAlpha = 1;
  if (S.pop && S.pop.t > 0) { x.globalAlpha = Math.min(1, S.pop.t * 2); x.font = `900 ${Math.round(cs * 3)}px system-ui,sans-serif`; x.textAlign = 'center'; x.lineWidth = 4; x.strokeStyle = '#000';
    const py = (S.pop.y - (1.1 - S.pop.t) * 3) * cs; x.strokeText(S.pop.txt, S.pop.x * cs, py); x.fillStyle = '#f3d77a'; x.fillText(S.pop.txt, S.pop.x * cs, py); x.globalAlpha = 1; }
  x.strokeStyle = '#d4af37'; x.lineWidth = 2; x.strokeRect(1, 1, N * cs - 2, N * cs - 2); x.restore();
}
const L = AP.loop(ANONSAVE.safe(step, 'territory'), ANONSAVE.safe(draw, 'territory'));
// ---------- run ----------
async function newRun() {
  await Promise.all(ART.map(a => AP.img(a.cover).then(i => IMG[a.id] = i))); show('play'); if (!C) C = AP.canvas($('#cv'), 1, () => { dirty = true; draw(); }); else C.fit();
  S = { time: 0, played: 0, bank: 0, kpts: 0, kills: 0, done: 0, over: false, art: pref.art }; newWorld(1); L.start();
}
function end() {
  S.over = true; S.paused = false; K.ended(); L.stop(); draw(); const a = art(S.art), sc = score(), secs = Math.max(1, Math.ceil(S.played)), lv = S.lv, pb = sc > (pref.best || 0);
  if (pb) { pref.best = sc; pref.bestLv = lv; ls.set('anonTerritory.pref', pref); }
  ((S) => setTimeout(() => { modal({ art: a.img, title: pb ? 'New best! 🏆' : 'Knocked out! 💥', text: `${S.why}<br><b>${a.name}</b> reached <b>level ${lv}</b> (×${lv}), claimed ${S.dpct || 0}% and knocked out ${S.kills} rival${S.kills === 1 ? '' : 's'}.<br>Score <b>${sc}</b>`, lb: sc >= 10,
    buttons: [['PLAY AGAIN', () => newRun()], ['Leaderboard', () => openLB(GAME, TITLE, LVN, 'KOs'), 1], ['Change ANON', () => { show('setup'); K.paint(); }, 1]] });
    if (sc >= 10) post(GAME, sc, secs, S.kills, 'l' + lv); }, 500))(S);
  gameOver();
}
// ---------- controls: swipe/drag steers (fires mid-drag, no lift needed), arrows/WASD ----------
const turn = d => { if (S && !S.over && !S.paused) { const me = S.ents[0]; if (me && me.alive) me.nd = d; } };
const cv = $('#cv'); let an = null;
cv.addEventListener('pointerdown', e => { an = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => { if (!an) return; const dx = e.clientX - an.x, dy = e.clientY - an.y; if (Math.max(Math.abs(dx), Math.abs(dy)) < 16) return;
  turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); an = { x: e.clientX, y: e.clientY }; });
['pointerup', 'pointercancel'].forEach(t => cv.addEventListener(t, () => an = null));
AP.keys({ ArrowUp: () => turn('up'), KeyW: () => turn('up'), w: () => turn('up'), ArrowDown: () => turn('down'), KeyS: () => turn('down'), s: () => turn('down'),
  ArrowLeft: () => turn('left'), KeyA: () => turn('left'), a: () => turn('left'), ArrowRight: () => turn('right'), KeyD: () => turn('right'), d: () => turn('right') });
// ---------- pause + save (shared/gamesave.js): Pause button, P / Esc, auto-pause when hidden, resume later ----------
const TA = { own: Int8Array, trail: Int8Array, cnt: Int32Array };
const inPlay = () => !!S && !S.over && !S.dead && $('#play').classList.contains('on');
const K = ANONSAVE.kit({ game: GAME, kind: 'action', newLabel: 'Restart', stage: $('#cv').parentElement, bar: $('#pzBox'), setupAnchor: $('#goBtn'), art: art(pref.art).img,
  inProgress: inPlay, paused: () => !!S.paused,
  pause: () => { S.paused = true; }, resume: () => { S.paused = false; if (!S.clear && S.count <= 0) S.count = 2; },
  snapshot: () => { const o = {}; for (const k in S) { if (k === 'parts' || k === 'flash' || k === 'pop' || k === 'paused') continue; o[k] = TA[k] ? Array.from(S[k]) : S[k]; } return JSON.parse(JSON.stringify(o)); },
  restore: d => { show('play'); if (!C) C = AP.canvas($('#cv'), 1, () => { dirty = true; draw(); }); else C.fit();
    for (const k in TA) d[k] = TA[k].from(d[k]); d.parts = []; d.flash = []; d.paused = true; S = d; dirty = true; hud(); $('#msg').textContent = ''; L.start(); },
  final: () => { if (!S) return null; const sc = score(); return sc >= 10 ? { score: sc, time: Math.max(1, Math.ceil(S.played)), moves: S.kills, mode: 'l' + S.lv } : null; },
  endNow: () => { S.why = 'Run ended.'; end(); },
  newGame: () => { L.stop(); newRun().then(() => K.begin()); }, toMenu: () => { L.stop(); if (S) S.over = true; show('setup'); },
  describe: (st, f) => { const x = st || S; if (!x) return f ? 'Score ' + f.score : ''; return 'Level ' + x.lv + ' · ' + art(x.art).name; },
  valid: d => !!d && d.lv >= 1 && d.lv <= 60 && Array.isArray(d.own) && d.own.length === NN && Array.isArray(d.trail) && d.trail.length === NN && Array.isArray(d.ents) && d.ents.length >= 1 && d.ents[0].me === true && !d.over && isFinite(d.played) && d.bank >= 0 && d.kpts >= 0 });
$('#goBtn').onclick = K.guard(() => newRun().then(() => K.begin()));
$('#menuBtn').onclick = () => { if (inPlay()) return K.pause('button'); L.stop(); if (S) S.over = true; show('setup'); K.paint(); };
$('#lbBtn').onclick = () => { if (inPlay()) K.pause('button'); openLB(GAME, TITLE, LVN, 'KOs'); };
window.G = { state: () => S, newRun, step, draw, turn, L, C: () => C, capture, newWorld, pct, score };
