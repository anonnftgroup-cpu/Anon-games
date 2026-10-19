/* ANON Arcade action-game helper (batch A): canvas, image loading, loop, swipes, seeded RNG. Art: assets/nft (AnonNfts.com). */
(function () {
  'use strict';
  let seed = (Date.now() ^ 0x9e3779b9) >>> 0;
  const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = a => a[Math.floor(rnd() * a.length)];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const cache = {};
  const img = src => cache[src] || (cache[src] = new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; }));
  const load = list => Promise.all(list.map(img));
  // fit a canvas into its parent, keep CSS-pixel coords, return ctx
  function canvas(cv, aspect, onResize) {
    const x = cv.getContext('2d'); const o = { cv, x, w: 0, h: 0, dpr: 1 }; let ready = false;
    o.fit = () => { const p = cv.parentElement, cs = getComputedStyle(p), pw = p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 4, ph = p.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 4; let w = pw, h = ph;
      if (aspect) { if (w / h > aspect) w = h * aspect; else h = w / aspect; }
      w = Math.max(100, Math.floor(w)); h = Math.max(100, Math.floor(h)); const d = Math.min(2, window.devicePixelRatio || 1);
      if (w === o.w && h === o.h && d === o.dpr) return; o.w = w; o.h = h; o.dpr = d;
      cv.width = Math.round(w * d); cv.height = Math.round(h * d); cv.style.width = (w + 4) + 'px'; cv.style.height = (h + 4) + 'px'; x.setTransform(d, 0, 0, d, 0, 0); ready && onResize && onResize(o); };
    window.addEventListener('resize', o.fit); o.fit(); ready = true; return o;
  }
  // rAF loop with frame-time log (for tests); dt in seconds, clamped
  const FT = [];
  function loop(update, draw) {
    let raf = 0, last = 0, on = false;
    const f = t => { if (!on) return; const dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60; const t0 = performance.now(); last = t;
      update(dt); draw(); FT.push(performance.now() - t0); if (FT.length > 600) FT.shift(); raf = requestAnimationFrame(f); };
    const L = { start() { if (on) return; on = true; last = 0; raf = requestAnimationFrame(f); }, stop() { on = false; cancelAnimationFrame(raf); }, get running() { return on; } };
    document.addEventListener('visibilitychange', () => { if (document.hidden && on && L.onHide) L.onHide(); });
    return L;
  }
  function swipe(node, cb, min) {
    let sx = 0, sy = 0, on = false; min = min || 22;
    node.addEventListener('pointerdown', e => { on = true; sx = e.clientX; sy = e.clientY; });
    node.addEventListener('pointerup', e => { if (!on) return; on = false; const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return cb('tap', e); cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'), e); });
    node.addEventListener('pointercancel', () => on = false);
  }
  const keys = map => window.addEventListener('keydown', e => { const k = map[e.key] || map[e.code]; if (k && !/INPUT|TEXTAREA/.test(e.target.tagName) && !document.querySelector('.modal.show, .alb-ov, .anw-ov')) { e.preventDefault(); k(e); } });
  function cover(x, im, dx, dy, dw, dh, sx, sy, sw, sh) { if (!im) return; if (sw == null) { const s = Math.min(im.width, im.height); sx = (im.width - s) / 2; sy = (im.height - s) / 2; sw = sh = s; } x.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh); }
  function rr(x, X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }
  function gem(x, cx, cy, r, c1, c2) { // faceted pink gem
    x.save(); x.translate(cx, cy); x.beginPath(); x.moveTo(-r, -r * .3); x.lineTo(-r * .55, -r * .85); x.lineTo(r * .55, -r * .85); x.lineTo(r, -r * .3); x.lineTo(0, r); x.closePath();
    const g = x.createLinearGradient(0, -r, 0, r); g.addColorStop(0, c1 || '#ffb3da'); g.addColorStop(.5, c2 || '#ff3d9a'); g.addColorStop(1, '#8a0f4d'); x.fillStyle = g; x.fill();
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = Math.max(1, r * .08); x.beginPath(); x.moveTo(-r, -r * .3); x.lineTo(r, -r * .3); x.moveTo(-r * .55, -r * .85); x.lineTo(-r * .25, -r * .3); x.lineTo(0, r); x.lineTo(r * .25, -r * .3); x.lineTo(r * .55, -r * .85); x.stroke(); x.restore();
  }
  function crown(x, cx, cy, r, col) {
    x.save(); x.translate(cx, cy); x.beginPath(); x.moveTo(-r, r * .55); x.lineTo(-r, -r * .35); x.lineTo(-r * .5, r * .05); x.lineTo(0, -r * .7); x.lineTo(r * .5, r * .05); x.lineTo(r, -r * .35); x.lineTo(r, r * .55); x.closePath();
    const g = x.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#fff3c4'); g.addColorStop(.5, col || '#e9c858'); g.addColorStop(1, '#8a6414'); x.fillStyle = g; x.fill(); x.strokeStyle = '#5a400a'; x.lineWidth = Math.max(1, r * .08); x.stroke();
    x.fillStyle = '#ff3d9a'; [-.5, 0, .5].forEach(k => { x.beginPath(); x.arc(r * k, r * .3, r * .12, 0, 7); x.fill(); }); x.restore();
  }
  function skull(x, cx, cy, r) {
    x.save(); x.translate(cx, cy); x.fillStyle = '#efe6d0'; x.beginPath(); x.arc(0, -r * .15, r * .78, 0, 7); x.fill(); rr(x, -r * .45, r * .3, r * .9, r * .55, r * .12); x.fill();
    x.fillStyle = '#ff3d9a'; x.beginPath(); x.arc(-r * .3, -r * .1, r * .2, 0, 7); x.arc(r * .3, -r * .1, r * .2, 0, 7); x.fill();
    x.fillStyle = '#222'; x.fillRect(-r * .2, r * .45, r * .08, r * .35); x.fillRect(r * .12, r * .45, r * .08, r * .35); x.restore();
  }
  function forest(x, w, h, off, bgImg) { // dark forest backdrop with optional parallax offset
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#071016'); g.addColorStop(.6, '#0b1a14'); g.addColorStop(1, '#040607'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    if (bgImg) { x.globalAlpha = .35; const s = Math.max(w / bgImg.width, h / bgImg.height); const bw = bgImg.width * s; let o = -((off || 0) * .2 % bw); for (let k = 0; k < 2; k++) x.drawImage(bgImg, o + k * bw, 0, bw, bgImg.height * s); x.globalAlpha = 1; }
    x.fillStyle = 'rgba(5,10,8,.85)'; const tw = 46; let o2 = -((off || 0) * .5 % (tw * 2));
    for (let X = o2 - tw; X < w + tw; X += tw * 2) { x.beginPath(); x.moveTo(X, h * .78); x.lineTo(X + tw, h * .78); x.lineTo(X + tw / 2, h * .42); x.fill(); }
  }
  window.AP = { rnd, ri, pick, shuffle, seed: n => { seed = n >>> 0; }, img, load, canvas, loop, swipe, keys, cover, rr, gem, crown, skull, forest, FT,
    frameStats: () => { const a = FT.slice().sort((p, q) => p - q); return { n: a.length, p50: a[a.length >> 1] || 0, p95: a[Math.floor(a.length * .95)] || 0, max: a[a.length - 1] || 0 }; } };
})();
