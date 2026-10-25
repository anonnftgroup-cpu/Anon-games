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
