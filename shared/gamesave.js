/* ANON Arcade: pause + save helper (ANONSAVE). Opt-in per game; only Block Drop uses it for now.
   - save/load/clear: one saved run per game in localStorage ("anonSave.<game>"), with a checksum so a
     hand-edited save is ignored. The leaderboard's server checks are unchanged and still apply to every post.
   - safe(fn): wraps a game tick so one error is logged and the loop keeps running.
   - wire({...}): P / Esc toggle pause, auto-pause + save when the tab is hidden or the page closes,
     and an autosave every few seconds while a run is in progress. */
(function () {
  'use strict';
  const KEY = g => 'anonSave.' + g, V = 1;
  const sum = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };
  function save(game, data) {
    try { const body = JSON.stringify(data); localStorage.setItem(KEY(game), JSON.stringify({ v: V, at: Date.now(), body, c: sum(game + '|' + V + '|' + body) })); return true; } catch (e) { return false; }
  }
  function load(game, maxAgeMs) {
    try {
      const raw = localStorage.getItem(KEY(game)); if (!raw) return null;
      const o = JSON.parse(raw);
      if (!o || o.v !== V || typeof o.body !== 'string' || o.c !== sum(game + '|' + V + '|' + o.body)) { clear(game); return null; }
      if (maxAgeMs && Date.now() - o.at > maxAgeMs) { clear(game); return null; }
      const d = JSON.parse(o.body); if (!d || typeof d !== 'object') return null; d.savedAt = o.at; return d;
    } catch (e) { return null; }
  }
  function clear(game) { try { localStorage.removeItem(KEY(game)); } catch (e) {} }
  function safe(fn, label) {
    let n = 0;
    return function () { try { return fn.apply(this, arguments); } catch (e) { if (n++ < 5) console.warn('[' + (label || 'game') + '] recovered from an error', e); } };
  }
  const busy = () => !!document.querySelector('.modal.show, .alb-ov, .anw-ov');
  /* o: { game, inProgress()->bool (a run that can be resumed), running()->bool (not paused), pause(why), resume(), snapshot()->data, every (ms) } */
  function wire(o) {
    const every = o.every || 3000;
    const saveNow = () => { try { if (o.inProgress()) return save(o.game, o.snapshot()); } catch (e) { console.warn('[save] skipped', e); } return false; };
    const hide = () => { if (!o.inProgress()) return; if (o.running()) o.pause('hidden'); saveNow(); };
    const timer = setInterval(() => { if (o.inProgress() && o.running()) saveNow(); }, every);
    document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
    window.addEventListener('pagehide', hide);
    window.addEventListener('keydown', e => {
      if (!(e.key === 'p' || e.key === 'P' || e.key === 'Escape') || e.repeat) return;
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || busy() || !o.inProgress()) return;
      e.preventDefault(); if (o.running()) { o.pause('key'); saveNow(); } else o.resume();
    });
    return { saveNow, stop: () => clearInterval(timer) };
  }
  window.ANONSAVE = { version: '1.0.0', save, load, clear, safe, wire };
})();
/* ANONSAVE.kit: the full pause + save set for one game (paused card, Pause button, start-screen resume box,
   "Submit your last score" recovery). The game supplies small hooks; see the games that call it. */
(function () {
  'use strict';
  const S = window.ANONSAVE; if (!S) return;
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
  function css() {
    if (document.getElementById('gs-css')) return; const s = el('style'); s.id = 'gs-css';
    s.textContent = `.gs-ov{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:20px;background:rgba(5,7,10,.8);z-index:30;text-align:center}
.gs-ov.on{display:flex}.gs-ov h2{margin:0 0 4px;color:var(--gold2,#f3d77a);font-size:26px;letter-spacing:.08em}.gs-ov p{margin:0 0 6px;color:#ddd;font-size:14px;max-width:300px;line-height:1.35}
.gs-ov .go{width:100%;max-width:300px;min-height:52px}.gs-ov .go.alt{min-height:46px}
.gs-pause{min-width:64px;min-height:44px!important;font-size:15px!important;border-color:#ff8cc4!important}
.gs-save{display:none;margin:14px 0 0;padding:12px;border:1px solid rgba(212,175,55,.5);border-radius:14px;background:rgba(0,0,0,.45);text-align:center}
.gs-save.on{display:block}.gs-save p{margin:0;color:var(--gold2,#f3d77a);font-weight:700}.gs-save .go{margin-top:10px}`;
    document.head.appendChild(s);
  }
  /* o = { game, kind: 'action' | 'puzzle', stage, bar, setupAnchor, art,
           inProgress(), paused(), pause(), resume(), snapshot(), restore(state), final() -> {score,time,moves,mode} or null,
           endNow() (end the run the game's normal way), toMenu(), describe(state, fin) -> text, valid(state) } */
  function kit(o) {
    css(); const AK = window.AK, game = o.game, action = o.kind !== 'puzzle'; let runId = null;
    const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    // paused card
    const ov = el('div', 'gs-ov'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Paused');
    const h = el('h2', '', 'PAUSED'), info = el('p'), bRes = el('button', 'go', 'RESUME'), bEnd = el('button', 'go alt', 'End game and post score'), bMenu = el('button', 'go alt', 'Menu (keeps your save)'), bNew = el('button', 'go alt', o.newLabel || 'New game');
    [bRes, bEnd, bNew, bMenu].forEach(b => b.type = 'button'); ov.append(h, info, bRes, bEnd, bNew, bMenu); bNew.style.display = o.newLabel && o.newGame ? '' : 'none';
    if (getComputedStyle(o.stage).position === 'static') o.stage.style.position = 'relative'; o.stage.appendChild(ov);
    // pause button
    let pb = o.pauseBtn || null;
    if (!pb && o.bar) { pb = el('button', 'gs-pause', '⏸ Pause'); pb.type = 'button'; pb.setAttribute('aria-label', 'Pause'); o.bar.appendChild(pb); }
    else if (pb) pb.classList.add('gs-pause');
    // start-screen box
    const box = el('div', 'gs-save'), bInfo = el('p'), bResume = el('button', 'go', 'RESUME SAVED GAME'), bLast = el('button', 'go alt', '');
    [bResume, bLast].forEach(b => b.type = 'button'); box.append(bInfo, bResume, bLast);
    if (o.setupAnchor) o.setupAnchor.parentNode.insertBefore(box, o.setupAnchor);
    const fin = () => { try { const f = o.final && o.final(); return f && f.score > 0 ? f : null; } catch (e) { return null; } };
    const rec = () => ({ id: runId || (runId = newId()), state: o.snapshot(), fin: fin() });
    const load = () => { const d = S.load(game, 30 * 864e5); if (!d || !d.id || (!d.over && !d.state) || (d.state && o.valid && !o.valid(d.state))) { if (d) S.clear(game); return null; } return d; };
    const busy = () => !!document.querySelector('.modal.show, .alb-ov, .anw-ov');
    const isPaused = () => ov.classList.contains('on');
    function show(why) {
      const f = fin(); info.textContent = (why === 'resume' ? 'Saved game loaded. ' : '') + (o.describe ? o.describe(null, f) + '.' : (f ? 'Score ' + f.score + '.' : '')) + ' Your game is saved on this device.';
      bRes.textContent = why === 'resume' ? 'CARRY ON' : 'RESUME'; bEnd.style.display = action && f && o.endNow ? '' : 'none';
      ov.classList.add('on'); if (pb) pb.textContent = '▶ Play';
    }
    const K = {
      pause(why) { if (!o.inProgress() || isPaused()) return; if (!o.paused()) o.pause(why); show(why); saver.saveNow(); },
      resume() { if (!isPaused()) return; ov.classList.remove('on'); if (pb) pb.textContent = '⏸ Pause'; if (o.inProgress()) o.resume(); },
      hide() { ov.classList.remove('on'); if (pb) pb.textContent = '⏸ Pause'; },
      get paused() { return isPaused(); },
      begin(id) { runId = id || newId(); K.hide(); },
      saveNow() { return saver.saveNow(); },
      ended() { // the run is over: keep a small record until the game's own post has gone out, then remove it
        K.hide(); const f = fin(), id = runId; runId = null;
        if (f && action) S.save(game, { id, over: true, fin: f }); else clearIf(id);
        setTimeout(() => { clearIf(id); paint(); }, 1500);
      },
      clear() { S.clear(game); runId = null; paint(); },
      load, paint, guard, submitLast
    };
    function clearIf(id) { const d = S.load(game); if (!d || d.id === id) S.clear(game); }
    const saver = S.wire({ game, every: o.every || 3000, inProgress: () => { try { return !!o.inProgress(); } catch (e) { return false; } }, running: () => !isPaused() && !o.paused(),
      pause: why => K.pause(why), resume: () => K.resume(), snapshot: rec });
    // P / Esc from wire() call pause()/resume(); keep the card in step when the game resumes itself
    function paint() {
      const d = load(); if (!d || (d.over && !d.fin)) { box.classList.remove('on'); if (o.onPaint) o.onPaint(false); return; }
      box.classList.add('on'); const f = d.fin;
      bInfo.textContent = d.over ? 'Your last game ended before its score was posted' + (f ? ': ⭐ ' + f.score : '') + '.' : 'Saved game: ' + (o.describe ? o.describe(d.state, f) : (f ? '⭐ ' + f.score : 'in progress'));
      bResume.style.display = d.over ? 'none' : ''; bLast.style.display = action && f ? '' : 'none'; if (f) bLast.textContent = 'Submit your last score (' + f.score + ')';
      if (o.onPaint) o.onPaint(true, d);
    }
    function submitLast(d) {
      const f = d && d.fin; S.clear(game); paint(); if (!f) return;
      AK.modal({ art: o.art || '../assets/logo.webp', title: 'Last score: ' + f.score, text: 'Your unfinished run has gone to the leaderboard.', lb: true,
        buttons: [['PLAY', () => { if (o.newGame) o.newGame(); }], ['Menu', () => { if (o.toMenu) o.toMenu(); paint(); }, 1]] });
      AK.post(game, f.score, Math.max(1, Math.round(f.time)), f.moves, f.mode == null ? null : f.mode);
    }
    function guard(start) { // wraps the game's own "new game" action
      return function () {
        const args = arguments, d = load(); if (!d) return start.apply(this, args);
        const f = action && d.fin;
        AK.modal({ art: o.art || '../assets/logo.webp', title: 'Start a new game?', text: f ? `Your ${d.over ? 'last game' : 'saved game'} has a score of <b>${f.score}</b> that isn't posted yet. A new game replaces it.` : 'You have a saved game. A new game replaces it.',
          buttons: [f ? ['Submit ' + f.score + ' first', () => submitLast(d)] : ['Resume saved game', () => doResume()], ['New game anyway', () => { S.clear(game); paint(); start.apply(this, args); }, 1], ['Cancel', () => {}, 1]] });
      };
    }
    function doResume() { const d = load(); if (!d || d.over) return paint(); runId = d.id; o.restore(d.state); if (o.inProgress()) { if (!o.paused()) o.pause('resume'); show('resume'); } }
    bRes.onclick = () => K.resume();
    bEnd.onclick = () => { if (o.inProgress() && o.endNow) { K.hide(); o.endNow(); } };
    bMenu.onclick = () => { saver.saveNow(); K.hide(); if (o.toMenu) o.toMenu(); paint(); };
    bNew.onclick = () => { saver.saveNow(); guard(() => { K.hide(); o.newGame(); })(); };
    bResume.onclick = doResume;
    bLast.onclick = () => { const d = load(); if (d && d.fin) submitLast(d); else paint(); };
    if (pb) pb.onclick = () => { if (!o.inProgress()) return; isPaused() ? K.resume() : K.pause('button'); };
    paint();
    return K;
  }
  S.kit = kit;
})();
