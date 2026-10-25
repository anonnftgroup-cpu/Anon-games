/* ANON Arcade retro kit (batch C1: shadow-maze, crossing, space-rocks, paddle-duel, moon-lander, light-trails).
   Page shell, fixed-step loop, touch/keyboard input, auto-pause, game-over + leaderboard, and original WebAudio sounds.
   Art: assets/nft (AnonNfts.com collections). Needs shared/leaderboard.js, shared/newsletter.js, assets/nft/kit.js first. */
(function () {
  'use strict';
  const { $, el, ls, toast, modal, post, openLB, gameOver, art, ART } = AK;
  /* ---------------- sound (silent until the first tap / key) ---------------- */
  const SND = (function () {
    const K = 'anonRK.mute'; let ctx = null, out = null, nb = null, muted = ls.get(K, false); const last = {};
    function unlock() { if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; } const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctx = new AC(); const c = ctx.createDynamicsCompressor(); out = ctx.createGain(); out.gain.value = muted ? 0 : 0.5; out.connect(c); c.connect(ctx.destination);
      nb = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const ok = () => ctx && !muted && ctx.state === 'running';
    function tone(type, f0, f1, dur, vol, delay) { if (!ok()) return; const t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02); }
    function noise(dur, vol, ft, f0, f1, delay) { if (!ok()) return; const t = ctx.currentTime + (delay || 0), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = nb; f.type = ft || 'bandpass'; f.frequency.setValueAtTime(f0 || 1200, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + dur + 0.02); }
    const arp = (ns, st, type, vol, dur) => ns.forEach((n, i) => tone(type || 'triangle', n, n, dur || 0.16, vol || 0.14, i * st));
    const FX = {
      coin: () => tone('square', 990, 1320, 0.05, 0.05), gem: () => arp([660, 880, 1175], 0.05, 'triangle', 0.14), eat: () => arp([392, 523, 784, 1046], 0.04, 'square', 0.08, 0.1),
      bonus: () => arp([784, 988, 1175, 1568], 0.06, 'sine', 0.16, 0.2), die: () => { tone('sawtooth', 500, 60, 0.9, 0.12); noise(0.6, 0.15, 'lowpass', 900, 100); },
      level: () => arp([523, 659, 784, 1046, 784, 1046], 0.09, 'triangle', 0.15, 0.2), hop: () => tone('square', 330, 520, 0.05, 0.05),
      splash: () => noise(0.4, 0.25, 'lowpass', 1500, 200), honk: () => tone('square', 260, 250, 0.12, 0.06), home: () => arp([523, 784, 1046], 0.07, 'triangle', 0.16),
      shoot: () => tone('square', 1200, 300, 0.08, 0.05), boom: () => noise(0.35, 0.35, 'lowpass', 1600, 120), boomS: () => noise(0.18, 0.25, 'bandpass', 1800, 400),
      thrust: () => noise(0.09, 0.07, 'lowpass', 500), alien: () => tone('sine', 700, 900, 0.12, 0.05), hit: () => tone('square', 440, 440, 0.05, 0.08),
      wall: () => tone('square', 220, 220, 0.04, 0.06), point: () => arp([392, 523], 0.08, 'triangle', 0.14), lose: () => arp([392, 311, 262], 0.12, 'triangle', 0.14, 0.25),
      land: () => arp([523, 659, 784, 1046, 1318], 0.07, 'triangle', 0.15, 0.22), turn: () => tone('sine', 520, 600, 0.04, 0.05), crash: () => { noise(0.5, 0.3, 'lowpass', 2000, 150); tone('sawtooth', 200, 50, 0.5, 0.08); },
      start: () => arp([262, 392, 523], 0.08, 'triangle', 0.12, 0.18), over: () => arp([523, 466, 392, 330, 262], 0.15, 'triangle', 0.15, 0.3), tick: () => tone('sine', 1500, 1500, 0.02, 0.03)
    };
    return { unlock, tone, noise, arp, play(n) { const now = performance.now(); if (last[n] && now - last[n] < 35) return; last[n] = now; const f = FX[n]; if (f) try { f(); } catch (e) {} },
      hasAudio: () => !!ctx, state: () => ctx ? ctx.state : 'none', isMuted: () => muted,
      setMuted(m) { muted = !!m; ls.set(K, muted); if (out) out.gain.value = muted ? 0 : 0.5; return muted; } };
  })();
  /* ---------------- images ---------------- */
  const IMC = {}; const img = src => { if (IMC[src]) return IMC[src]; const i = new Image(); i.src = src; IMC[src] = i; return i; };
  const ready = i => i && i.complete && i.naturalWidth > 0;
  const P = {}, C = {}; ART.forEach(a => { P[a.id] = img(a.img); C[a.id] = img(a.cover); });
  function portrait(x, im, cx, cy, r, ring, glow) {
    x.save(); if (glow) { x.shadowColor = glow; x.shadowBlur = r * 0.8; } x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fillStyle = '#120e02'; x.fill(); x.shadowBlur = 0; x.clip();
    if (ready(im)) x.drawImage(im, cx - r, cy - r, r * 2, r * 2); x.restore();
    if (ring) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.strokeStyle = ring; x.lineWidth = Math.max(1, r * 0.16); x.stroke(); }
  }
  function cover(x, im, X, Y, W, H, alpha) { if (!ready(im)) return; const s = Math.max(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * s, h = im.naturalHeight * s;
    x.save(); if (alpha != null) x.globalAlpha = alpha; x.drawImage(im, X + (W - w) / 2, Y + (H - h) / 2, w, h); x.restore(); }
  function rr(x, X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }
  function stars(x, W, H, seed, n) { let a = seed >>> 0; const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; for (let i = 0; i < (n || 90); i++) { x.fillStyle = r() < 0.2 ? 'rgba(255,170,215,.85)' : 'rgba(255,255,255,.7)'; const s = r() < 0.1 ? 1.8 : 0.9; x.fillRect(r() * W, r() * H, s, s); } }
  function text(x, s, X, Y, size, col, align) { x.font = `800 ${size}px system-ui,-apple-system,Segoe UI,sans-serif`; x.textAlign = align || 'center'; x.lineWidth = Math.max(2, size / 5); x.strokeStyle = 'rgba(0,0,0,.85)'; x.strokeText(s, X, Y); x.fillStyle = col || '#f3d77a'; x.fillText(s, X, Y); }
  /* ---------------- page shell ---------------- */
  function shell(o) {
    const pref = ls.get('anonRK.' + o.game, { art: o.defaultArt || 'anon', mode: o.modes ? (o.defaultMode || Object.keys(o.modes)[0]) : null });
    if (o.modes && !o.modes[pref.mode]) pref.mode = Object.keys(o.modes)[0];
    document.body.innerHTML = `<header><div class="top"><div class="brand"><a class="back-btn" href="../" aria-label="Back to ANON Arcade">&larr; Arcade</a><img src="../assets/logo.webp" alt=""><h1>${o.h1}</h1></div>
      <div class="top-r"><button class="icon-btn" id="sndBtn" aria-label="Sound on or off"></button><button class="icon-btn" id="lbBtn" aria-label="Leaderboard">🏆</button></div></div></header>
      <section class="view on" id="setup"><img class="hero" id="hero" alt="ANON NFTs artwork">
      ${o.modes ? `<div class="lbl">${o.modeLabel || 'Difficulty'}</div><div class="seg" id="modeSeg">${Object.keys(o.modes).map(k => `<button data-v="${k}">${o.modes[k]}</button>`).join('')}</div>` : ''}
      <div class="lbl">${o.pickLabel || 'Pick your ANON'}</div><div class="chars" id="artPick"></div>
      <button class="go" id="goBtn">PLAY</button><p class="howto">${o.how}</p><div class="nick" id="nick"></div></section>
      <section class="view" id="play"><div class="hud" id="hud"></div><div class="stage" id="stage"><canvas id="cv"></canvas><div class="msg" id="msg"></div>
      <div class="pz" id="pz"><div class="mcard"><h2>Paused</h2><p>Take a breather, ANON.</p><button class="go" id="resBtn">RESUME</button><button class="go alt" id="newBtn">New game</button><button class="go alt" id="lbBtn2">Leaderboard</button></div></div></div>
      <div class="ctl" id="ctl"></div></section>`;
    const cv = $('#cv'), x = cv.getContext('2d'), stage = $('#stage');
    const show = id => document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === id));
    const savePref = () => ls.set('anonRK.' + o.game, pref);
    const setHero = () => { $('#hero').src = art(pref.art).cover; };
    if (o.modes) AK.seg($('#modeSeg'), pref.mode, v => { pref.mode = v; savePref(); });
    AK.picker($('#artPick'), pref.art, id => { pref.art = id; savePref(); setHero(); }); setHero(); AK.nickLine($('#nick'));
    const paintSnd = () => { $('#sndBtn').textContent = SND.isMuted() ? '🔇' : '🔊'; }; paintSnd();
    $('#sndBtn').onclick = () => { SND.unlock(); SND.setMuted(!SND.isMuted()); paintSnd(); toast(SND.isMuted() ? 'Sound off' : 'Sound on'); };
    addEventListener('pointerdown', () => SND.unlock(), true); addEventListener('keydown', () => SND.unlock(), true);
    const lb = () => openLB(o.game, o.title, o.modes, o.movesLabel || 'moves');
    $('#lbBtn').onclick = $('#lbBtn2').onclick = lb;
    /* input */
    const I = { held: {}, presses: [], take(k) { const i = this.presses.indexOf(k); if (i < 0) return false; this.presses.splice(i, 1); return true; }, pointer: null };
    const press = k => { I.presses.push(k); if (I.presses.length > 8) I.presses.shift(); };
    const ctl = $('#ctl');
    (o.controls || []).forEach(c => {
      if (c === 'pad') { const p = el('div', 'pad'); [['', ''], ['up', '▲'], ['', ''], ['left', '◀'], ['down', '▼'], ['right', '▶']].forEach(([k, l]) => { if (!k) return p.appendChild(el('span')); const b = el('button', '', l); b.dataset.k = k; b.setAttribute('aria-label', k); p.appendChild(b); }); ctl.appendChild(p); return; }
      const b = el('button', c.sm ? 'sm' : '', c.label); b.dataset.k = c.k; b.setAttribute('aria-label', c.aria || c.k); ctl.appendChild(b);
    });
    const pb = el('button', 'sm', '⏸'); pb.id = 'pauseBtn'; pb.setAttribute('aria-label', 'Pause'); ctl.appendChild(pb);
    const ptrKey = new Map();
    ctl.addEventListener('pointerdown', e => { const b = e.target.closest('button[data-k]'); if (!b) return; e.preventDefault(); const k = b.dataset.k; ptrKey.set(e.pointerId, b); I.held[k] = (I.held[k] || 0) + 1; b.classList.add('on'); press(k); try { b.setPointerCapture(e.pointerId); } catch (x) {} });
    const upB = e => { const b = ptrKey.get(e.pointerId); if (!b) return; ptrKey.delete(e.pointerId); const k = b.dataset.k; I.held[k] = Math.max(0, (I.held[k] || 1) - 1); if (!I.held[k]) b.classList.remove('on'); };
    ctl.addEventListener('pointerup', upB); ctl.addEventListener('pointercancel', upB); ctl.addEventListener('lostpointercapture', upB);
    ctl.addEventListener('contextmenu', e => e.preventDefault());
    // stage: swipe -> press(dir), tap -> press('tap'), drag -> I.pointer (world coords)
    let sw = null; const toWorld = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - 2) / (r.width - 4) * o.W, y: (e.clientY - r.top - 2) / (r.height - 4) * o.H }; };
    stage.addEventListener('pointerdown', e => { if (e.target.closest('.pz, .gs-ov')) return; e.preventDefault(); sw = { id: e.pointerId, x: e.clientX, y: e.clientY, done: false }; I.pointer = toWorld(e); I.pointer.down = true; });
    stage.addEventListener('pointermove', e => { if (I.pointer && I.pointer.down) Object.assign(I.pointer, toWorld(e));
      if (!sw || sw.id !== e.pointerId || sw.done || !o.swipe) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y; if (Math.hypot(dx, dy) > 24) { sw.done = true; press(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); } });
    const upS = e => { if (sw && sw.id === e.pointerId && !sw.done) press('tap'); sw = null; if (I.pointer) I.pointer.down = false; };
    stage.addEventListener('pointerup', upS); stage.addEventListener('pointercancel', () => { sw = null; });
    const KM = Object.assign({ ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'fire', Enter: 'fire' }, o.keys || {});
    addEventListener('keydown', e => { if (!$('#play').classList.contains('on') || document.querySelector('.modal.show, .alb-ov, .anw-ov')) return;
      if (e.code === 'KeyP' || e.code === 'Escape') { if (KS) return; e.preventDefault(); if (!e.repeat) setPause(!paused); return; } // with save: gamesave.js handles P / Esc
      const k = KM[e.code]; if (!k) return; e.preventDefault(); if (e.repeat) return; I.held[k] = (I.held[k] || 0) + 1; press(k); });
    addEventListener('keyup', e => { const k = KM[e.code]; if (k) I.held[k] = 0; });
    addEventListener('blur', () => { I.held = {}; });
    /* layout */
    let scale = 1, dpr = 1;
    function fit() { const w = stage.clientWidth - 10, h = stage.clientHeight - 10; if (w <= 0 || h <= 0) return; scale = Math.min(w / o.W, h / o.H); dpr = Math.min(2, devicePixelRatio || 1);
      cv.style.width = Math.floor(o.W * scale) + 'px'; cv.style.height = Math.floor(o.H * scale) + 'px'; cv.width = Math.floor(o.W * scale * dpr); cv.height = Math.floor(o.H * scale * dpr); }
    addEventListener('resize', () => { if (S) fit(); });
    /* loop */
    let S = null, paused = false, last = 0, acc = 0, msgT = 0, overShown = false; const perf = { work: [], gaps: [] }; let frames = 0;
    const H = 1 / 120;
    function setPause(p) { if (!S || S.over) p = false; paused = p; I.presses.length = 0; $('#pz').classList.toggle('show', p && !KS); if (!KS) pb.textContent = p ? '▶' : '⏸'; last = 0; I.held = {}; ctl.querySelectorAll('.on').forEach(b => b.classList.remove('on')); }
    document.addEventListener('visibilitychange', () => { if (document.hidden && S && !S.over && !KS) setPause(true); });
    pb.onclick = () => setPause(!paused); $('#resBtn').onclick = () => setPause(false); $('#newBtn').onclick = () => { setPause(false); start(); };
    const say = (s, sec) => { $('#msg').textContent = s || ''; msgT = s ? performance.now() + (sec || 1.6) * 1000 : 0; };
    function start(seed, saved) {
      AK.closeModal(); show('play'); fit(); overShown = false; I.presses.length = 0; I.held = {}; acc = 0; last = 0;
      if (saved) seed = (saved.seed + 7919) & 0x7fffffff;
      const sd = seed != null ? seed : (new URLSearchParams(location.search).get('seed') ? +new URLSearchParams(location.search).get('seed') : (Date.now() & 0x7fffffff));
      S = o.create({ seed: sd, mode: saved ? saved.mode : pref.mode, art: saved ? saved.art : pref.art, sfx: n => SND.play(n), say });
      if (saved) { const d = unpack(saved.d); for (const k in d) if (typeof S[k] !== 'function') S[k] = d[k]; }
      S.__seed = sd; S.__mode = saved ? saved.mode : pref.mode;
      setPause(false); if (!saved) { SND.play('start'); if (o.startMsg) say(o.startMsg, 2.2); if (KS) KS.begin(); } hud();
    }
    $('#goBtn').onclick = () => start();
    /* pause + save (shared/gamesave.js, when the page loads it): Pause button, P / Esc, auto-pause when hidden, autosave, resume later */
    const pack = st => JSON.parse(JSON.stringify(st, (k, v) => typeof v === 'function' ? undefined : ArrayBuffer.isView(v) ? { __ta: v.constructor.name, a: Array.from(v) } : v instanceof Set ? { __set: [...v] } : v instanceof Map ? { __map: [...v] } : v));
    const unpack = d => JSON.parse(JSON.stringify(d), (k, v) => !v || typeof v !== 'object' ? v : v.__ta && window[v.__ta] ? new window[v.__ta](v.a) : Array.isArray(v.__set) ? new Set(v.__set) : Array.isArray(v.__map) ? new Map(v.__map) : v);
    const inPlay = () => !!S && !S.over && $('#play').classList.contains('on');
    const KS = window.ANONSAVE && window.ANONSAVE.kit && o.save !== false ? window.ANONSAVE.kit({ game: o.game, kind: 'action', newLabel: 'New game', stage, pauseBtn: pb, setupAnchor: $('#goBtn'), art: art(pref.art).cover,
      inProgress: inPlay, paused: () => paused, pause: () => setPause(true), resume: () => setPause(false),
      snapshot: () => ({ seed: S.__seed, mode: S.__mode, art: S.art, d: pack(S) }),
      restore: st => start(null, st),
      final: () => { if (!S) return null; const r = o.result(S); return { score: r.score, time: Math.max(1, Math.round(r.time)), moves: r.moves, mode: r.mode || null }; },
      endNow: () => { setPause(false); if (S) S.over = true; },
      newGame: () => start(), toMenu: () => { setPause(false); show('setup'); },
      describe: (st, f) => { const d = st ? st.d : S; const bits = []; if (f) bits.push('⭐ ' + f.score); else if (d && d.score != null) bits.push('⭐ ' + d.score);
        if (d && d.level) bits.push('Level ' + d.level); else if (d && d.wave) bits.push('Wave ' + d.wave); else if (d && d.round) bits.push('Round ' + d.round);
        if (d && d.lives != null) bits.push('❤ ' + d.lives); return bits.join(' · '); },
      valid: st => !!st && typeof st.seed === 'number' && !!st.d && typeof st.d.t === 'number' && isFinite(st.d.t) && !st.d.over }) : null;
    if (KS) { $('#goBtn').onclick = KS.guard(() => start()); $('#lbBtn').onclick = () => { if (inPlay()) KS.pause('button'); lb(); }; }
    function hud() { if (S) $('#hud').innerHTML = o.hud(S); }
    function frame(now) {
      requestAnimationFrame(frame);
      if (!S || !$('#play').classList.contains('on')) { last = 0; return; }
      const t0 = performance.now(); if (last) perf.gaps.push(now - last);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
      if (!paused && !S.over) { if (window.RK_BOT) window.RK_BOT(S, I); acc += dt; let n = 0; while (acc >= H && n < 12) { S.step(H, I); acc -= H; n++; if (S.over) break; } if (n >= 12) acc = 0; I.presses.length = 0; }
      if (msgT && now > msgT) say('');
      x.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0); o.draw(x, S, now / 1000);
      if (frames++ % 6 === 0) hud();
      perf.work.push(performance.now() - t0); if (perf.work.length > 3000) { perf.work.shift(); perf.gaps.shift(); }
      if (S.over && !overShown) { overShown = true; hud(); setTimeout(over, 650); }
    }
    function over() {
      const r = o.result(S); r.time = Math.max(1, Math.round(r.time)); window.RK_LAST = r; SND.play('over'); if (KS) KS.ended();
      const bk = 'anonRK.best.' + o.game + (r.mode ? '.' + r.mode : ''), best = ls.get(bk, 0), isBest = r.score > best; if (isBest) ls.set(bk, r.score);
      modal({ art: art(pref.art).cover, title: r.title || 'GAME OVER', lb: true,
        text: '<b style="font-size:22px;color:#fff3c4">' + r.score.toLocaleString() + '</b>' + (isBest && r.score > 0 ? ' 👑 new best!' : '') + '<br>' + (r.text || ''),
        buttons: [['PLAY AGAIN', () => start()], ['Leaderboard', lb, 1]].concat(KS ? [['Menu', () => { show('setup'); KS.paint(); }, 1]] : []) });
      if (r.score > 0) post(o.game, r.score, r.time, r.moves, r.mode || null).then(p => { window.RK_POST = p; }); else { const m = $('#lbMsg'); if (m) m.textContent = 'Score some points to make the leaderboard.'; }
      gameOver();
    }
    requestAnimationFrame(frame);
    window.RK_APP = { kit: KS, get state() { return S; }, start, setPause, get paused() { return paused; }, input: I, perf, sound: SND, fit, pref };
    if (new URLSearchParams(location.search).get('autostart') === '1') start();
    return window.RK_APP;
  }
  window.RK = { shell, SND, img, ready, P, C, portrait, cover, rr, stars, text, ART, art };
})();
