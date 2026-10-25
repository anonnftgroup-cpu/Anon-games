/* =====================================================================
   ANON Arcade · "Challenge a friend" (challenge.js)  ·  see shared/CHALLENGE.md
   - Game over: shows a "Challenge a friend" button that shares the game's
     direct link with ?ch=<nickname>&s=<score> (navigator.share on phones,
     otherwise Copy link / X / WhatsApp / Facebook).
   - Opening a challenge link: banner "<name> scored <score>. Can you beat it?"
     and, after the next game, "You beat <name>!" or "<n> short of <name>".
   - Auto mode: any game that posts through ANONLB.submit() gets it for free
     (leaderboard.js loads this file). Games with their own result screen can
     call ANONChallenge.onGameOver({ game, score, lowerIsBetter, mount, text }).
   No tracking, no network calls except reading ../games.json for names.
   ===================================================================== */
(function () {
  'use strict';
  if (window.ANONChallenge) return;
  const SRC = (document.currentScript && document.currentScript.src) || '';
  const ROOT = SRC ? SRC.replace(/shared\/challenge\.js.*$/, '') : new URL('../', location.href).href;
  const LIVE = 'https://anonnftgroup-cpu.github.io/Anon-games/';
  const TAG = '#ANONArcade';
  const EMOJI = { 'anon-snake': '🐍', solitaire: '🃏', hearts: '♥️', 'daily-word': '🟨', 'word-unlimited': '🔥', connect4: '🔴', tictactoe: '❌', minesweeper: '💣',
    checkers: '⛀', chess: '♞', jigsaw: '🧩', 'slide-puzzle': '🧩', 'whack-an-anon': '🔨', 'shadow-dodge': '⭐', 'ninja-memory': '🧠', 'shadow-runner': '🏃',
    'anon-flutter': '🪽', 'brick-breaker': '🧱', pinball: '🪐', 'anon-2048': '🔢', 'block-drop': '🟦', 'gem-match': '💎', 'bomb-maze': '💣', 'barrel-climb': '🛢️',
    'sky-defence': '🛡️', 'shadow-echo': '🎵', 'pyramid-hop': '🔺', 'bug-blaster': '🐛', 'shadow-maze': '👻', 'paper-toss': '🗑️', 'flag-swipe': '🚩', crossing: '🚸',
    'backing-quiz': '❓', 'space-rocks': '☄️', 'rug-runner': '🏃', 'hype-pop': '🎈', 'paddle-duel': '🏓', 'pool-plumber': '🔧', 'chain-detective': '🔍',
    sudoku: '🔢', 'crazy-8s': '🎴', mahjong: '🀄', hangman: '🪢', 'word-search': '🔎', reversi: '⚫', 'sea-battle': '🚢', freecell: '🃏', spider: '🕷️',
    'galaxy-shooter': '🚀', 'moon-lander': '🌙', 'light-trails': '💡' };

  /* ---------- helpers ---------- */
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const fmt = n => Number(n).toLocaleString('en-GB');
  const FRAMED = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();
  const ss = { get(k) { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
               set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  // page folder relative to the arcade root, e.g. "anon-snake/" ('' on the hub)
  const FOLDER = (function () { const h = location.href.split(/[?#]/)[0].replace(/index\.html?$/, '');
    return h.indexOf(ROOT) === 0 ? h.slice(ROOT.length) : (h.match(/([^/]+\/)$/) || [, ''])[1]; })();
  const PAGE_URL = LIVE + FOLDER; // always share the public GitHub Pages address
  const K_CH = 'anonCh.' + (FOLDER || 'hub');

  function cleanName(raw) {
    let s = String(raw == null ? '' : raw); try { s = s.normalize('NFKC'); } catch (e) {}
    s = s.replace(/[^A-Za-z0-9 _.\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20).trim();
    if (s.length < 2) return '';
    try { if (window.ANONLB && window.ANONLB.isCleanName && !window.ANONLB.isCleanName(s)) return ''; } catch (e) {}
    return s;
  }
  function cleanScore(raw) { const s = String(raw == null ? '' : raw).trim(); if (!/^\d{1,9}$/.test(s)) return null; const n = Number(s); return Number.isSafeInteger(n) ? n : null; }

  /* ---------- game info from games.json (name, scoreLabel, order) ---------- */
  let META = null;
  const metaP = (window.ANON_GAMES_P || (window.ANON_GAMES_P = fetch(ROOT + 'games.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null))).then(j => { META = (j && j.games) || []; return META; }).catch(() => (META = []));
  function info(game) {
    const list = META || [];
    const g = list.find(x => x.id === game) || list.find(x => x.path === FOLDER) || {};
    const title = (document.title || '').split(/\s[·|–-]\s/)[0].trim();
    return { id: g.id || game, name: g.name || title || 'ANON Arcade', label: g.scoreLabel || 'Score', lower: g.order === 'asc' };
  }

  /* ---------- CSS ---------- */
  function css() {
    if (document.getElementById('ach-css')) return;
    const l = el('link'); l.id = 'ach-css'; l.rel = 'stylesheet'; l.href = ROOT + 'shared/challenge.css?v=1'; document.head.appendChild(l);
  }

  /* ---------- incoming challenge (?ch=&s=) ---------- */
  function readIncoming() {
    let q; try { q = new URLSearchParams(location.search); } catch (e) { return null; }
    if (!q.has('ch') && !q.has('s')) return null;
    const name = cleanName(q.get('ch')) || 'A friend', score = cleanScore(q.get('s'));
    if (score == null) return null;
    const c = { name, score, at: Date.now() }; ss.set(K_CH, c); return c;
  }
  let CH = readIncoming() || ss.get(K_CH);
  if (CH && (typeof CH.score !== 'number' || !cleanName(CH.name) && CH.name !== 'A friend')) CH = null;

  function banner() {
    if (!CH || !FOLDER || document.getElementById('achBanner')) return;
    css();
    const b = el('div', 'ach-banner'); b.id = 'achBanner'; b.setAttribute('role', 'status');
    const t = el('div', 'ach-bt');
    t.appendChild(el('span', 'ach-ico', '⚔️'));
    const msg = el('span'); msg.appendChild(el('b', '', CH.name)); msg.appendChild(document.createTextNode(' scored ')); msg.appendChild(el('b', '', fmt(CH.score)));
    msg.appendChild(document.createTextNode('. Can you beat it?')); t.appendChild(msg);
    const x = el('button', 'ach-bx', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Hide challenge');
    const hide = () => { b.classList.add('ach-out'); setTimeout(() => b.remove(), 350); };
    x.onclick = hide; b.appendChild(t); b.appendChild(x);
    document.body.appendChild(b);
    setTimeout(hide, 10000); // fades out so it never covers the game; the result shows again at game over
  }

  /* ---------- share ---------- */
  function link(nick, score) {
    const u = new URL(PAGE_URL); if (nick) u.searchParams.set('ch', nick); u.searchParams.set('s', String(score)); return u.toString();
  }
  function defaultText(o) {
    const L = (o.label || 'Score').toLowerCase();
    const what = /streak/.test(L) ? 'I hit a ' + fmt(o.score) + ' win streak on ' : /series/.test(L) ? 'I scored ' + fmt(o.score) + ' in a series on ' : 'I scored ' + fmt(o.score) + ' on ';
    return what + o.name + (o.emoji ? ' ' + o.emoji : '') + ' Think you can beat me? ' + TAG;
  }
  async function copy(t, inp) {
    try { if (navigator.clipboard && window.isSecureContext && !FRAMED) { await navigator.clipboard.writeText(t); return true; } } catch (e) {}
    try { const ta = el('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, t.length); const ok = document.execCommand('copy'); ta.remove(); if (ok) return true; } catch (e) {}
    if (inp) { try { inp.focus(); inp.select(); inp.setSelectionRange(0, inp.value.length); } catch (e) {} }
    return false;
  }
  function options(box, text, url) {
    let p = box.querySelector('.ach-opts'); if (p) { p.remove(); return; }
    p = el('div', 'ach-opts');
    const inp = el('input', 'ach-in'); inp.readOnly = true; inp.value = url; inp.setAttribute('aria-label', 'Challenge link'); inp.onclick = () => inp.select();
    const row = el('div', 'ach-grid');
    const cp = el('button', 'ach-o', '🔗 Copy link'); cp.type = 'button';
    cp.onclick = async () => { const ok = await copy(text + '\n' + url, inp); cp.textContent = ok ? '✅ Copied' : 'Press and hold the link to copy'; setTimeout(() => { cp.textContent = '🔗 Copy link'; }, 2200); };
    const a = (lab, href, cls) => { const e = el('a', 'ach-o ' + cls, lab); e.href = href; e.target = '_blank'; e.rel = 'noopener noreferrer'; return e; };
    row.appendChild(cp);
    row.appendChild(a('𝕏 Post on X', 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url), 'ach-x'));
    row.appendChild(a('💬 WhatsApp', 'https://wa.me/?text=' + encodeURIComponent(text + ' ' + url), 'ach-wa'));
    row.appendChild(a('📘 Facebook', 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url), 'ach-fb'));
    p.appendChild(row); p.appendChild(inp); box.appendChild(p);
  }
  async function share(box, o) {
    const nick = (window.ANONLB && window.ANONLB.getNickname && window.ANONLB.getNickname()) || '';
    const url = link(cleanName(nick) || 'A friend', o.score), text = o.text || defaultText(o);
    window.__lastChallenge = { text, url };
    const touch = window.matchMedia && matchMedia('(pointer:coarse)').matches;
    if (touch && navigator.share && !box.querySelector('.ach-opts')) {
      try { await navigator.share({ title: o.name, text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    options(box, text, url);
  }

  /* ---------- result block ---------- */
  const MOUNTS = ['#lbMsg', '#wLB', '.lbmsg', '.wlb'];
  function findMount() {
    for (const s of MOUNTS) { const n = document.querySelector(s); if (n && n.isConnected) return { after: n }; }
    const m = document.querySelector('#kmodal.show .mcard, .modal.show .mcard, .modal.show .panel, .overlay.show .panel');
    return m ? { inside: m } : null;
  }
  function build(o) {
    const box = el('div', 'ach'); box.dataset.game = o.game;
    if (CH) { const bn = document.getElementById('achBanner'); if (bn) bn.remove();
      const diff = o.lower ? CH.score - o.score : o.score - CH.score;
      const r = el('div', 'ach-res ' + (diff > 0 ? 'win' : diff === 0 ? 'tie' : 'lose'));
      if (diff > 0) { r.appendChild(document.createTextNode('🏆 You beat ')); r.appendChild(el('b', '', CH.name)); r.appendChild(document.createTextNode('! (' + fmt(o.score) + ' vs ' + fmt(CH.score) + ')')); }
      else if (diff === 0) { r.appendChild(document.createTextNode('🤝 Dead level with ')); r.appendChild(el('b', '', CH.name)); r.appendChild(document.createTextNode(' on ' + fmt(o.score))); }
      else { r.appendChild(document.createTextNode('⚔️ ' + fmt(-diff) + ' short of ')); r.appendChild(el('b', '', CH.name)); r.appendChild(document.createTextNode('. Have another go!')); }
      box.appendChild(r);
    }
    const b = el('button', 'ach-btn', CH ? '⚔️ Challenge back' : '⚔️ Challenge a friend'); b.type = 'button';
    b.onclick = e => { e.stopPropagation(); share(box, o); };
    box.appendChild(b);
    return box;
  }
  function floating(box) {
    const f = el('div', 'ach-float'); const x = el('button', 'ach-bx', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.onclick = () => f.remove();
    f.appendChild(x); f.appendChild(box); document.body.appendChild(f);
    setTimeout(() => { if (f.isConnected && !f.querySelector('.ach-opts')) f.remove(); }, 30000);
    return f;
  }
  function place(box, mount, tries) {
    document.querySelectorAll('.ach').forEach(n => { if (n !== box) { const f = n.closest('.ach-float'); (f || n).remove(); } });
    let m = mount ? { inside: mount } : findMount();
    if (!m && tries < 12) return setTimeout(() => place(box, mount, tries + 1), 250);
    if (m && m.after) m.after.insertAdjacentElement('afterend', box);
    else if (m && m.inside) {
      const btn = m.inside.querySelector(':scope > button.go, :scope > .row, :scope > .btnrow');
      if (btn && !mount) m.inside.insertBefore(box, btn); else m.inside.appendChild(box);
    } else floating(box);
  }

  /* ---------- public API ---------- */
  const manual = {}; let lastAuto = '';
  function onGameOver(opts, _auto) {
    try {
      opts = opts || {};
      const game = String(opts.game || '').slice(0, 40);
      const score = Number(opts.score);
      if (!_auto) manual[game] = 1;
      if (!Number.isFinite(score) || score < 0) return null;
      css();
      const go = () => {
        const I = info(game);
        const o = { game, score: Math.round(score), lower: opts.lowerIsBetter != null ? !!opts.lowerIsBetter : I.lower,
          name: opts.name || I.name, label: opts.label || I.label, emoji: opts.emoji != null ? opts.emoji : (EMOJI[I.id] || '🎮'), text: opts.text || '' };
        const box = build(o); place(box, opts.mount || null, 0); return box;
      };
      if (META) return go();
      metaP.then(go); return true;
    } catch (e) { return null; }
  }
  // auto mode: wrap ANONLB.submit so every leaderboard game gets the button
  function hook() {
    const LB = window.ANONLB; if (!LB || LB.__ach) return; const orig = LB.submit;
    LB.submit = function (s) {
      try {
        const g = s && String(s.game || ''), sc = s && Math.round(Number(s.score)), key = g + ':' + sc;
        if (g && !manual[g] && Number.isFinite(sc) && sc > 0 && key !== lastAuto) { lastAuto = key; setTimeout(() => { if (!manual[g]) onGameOver({ game: g, score: sc }, true); }, 0); }
      } catch (e) {}
      return orig.apply(this, arguments);
    };
    LB.__ach = true;
  }
  hook();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { hook(); banner(); }); else banner();

  window.ANONChallenge = { version: '1.0.0', onGameOver, manual: g => { manual[g] = 1; }, challenge: () => CH ? { name: CH.name, score: CH.score } : null,
    link: (nick, score) => link(cleanName(nick), score), cleanName, cleanScore, url: PAGE_URL };
})();
