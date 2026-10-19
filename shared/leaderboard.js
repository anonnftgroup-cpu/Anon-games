/* =====================================================================
   ANON Arcade · shared leaderboard (leaderboard.js)
   Used by every game and by the Arcade hub. No SDK, no tracking.

   ----------------------- CONFIG: EDIT THESE TWO -----------------------
   From your Supabase project: Project Settings → API (or the "Connect" button)
     SUPABASE_URL      = the Project URL, e.g. https://abcdefghij.supabase.co
     SUPABASE_ANON_KEY = the PUBLISHABLE key (sb_publishable_...) or the
                         legacy "anon public" key (eyJ...). NEVER the secret /
                         service_role key.
   Leave them as they are and the games fall back to on-device scores.
   --------------------------------------------------------------------- */
const SUPABASE_URL = 'PASTE_SUPABASE_URL_HERE';
const SUPABASE_ANON_KEY = 'PASTE_SUPABASE_PUBLISHABLE_KEY_HERE';
/* ------------------------- end of config ----------------------------- */

(function () {
  'use strict';
  if (window.ANONLB) return;

  const CFG = Object.assign({ url: SUPABASE_URL, key: SUPABASE_ANON_KEY, table: 'scores', rpc: 'top_scores', timeoutMs: 8000 },
    window.ANON_LB_CONFIG || {});
  const configured = () => /^https:\/\/[^\s/]+/.test(CFG.url || '') && !!CFG.key && !/PASTE_/.test(CFG.key) && !/PASTE_/.test(CFG.url);
  const base = () => String(CFG.url).replace(/\/+$/, '') + '/rest/v1';
  const headers = extra => {
    const h = Object.assign({ apikey: CFG.key, 'Content-Type': 'application/json', Accept: 'application/json' }, extra || {});
    // Legacy anon keys are JWTs (eyJ...) and go in Authorization too. New sb_publishable_ keys must NOT.
    if (/^eyJ/.test(CFG.key)) h.Authorization = 'Bearer ' + CFG.key;
    return h;
  };

  /* ---------- storage ---------- */
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const K_NICK = 'anonLB.nick', K_OPTOUT = 'anonLB.optout', K_LOCAL = g => 'anonLB.local.' + g, K_LAST = g => 'anonLB.last.' + g;

  /* ---------- per-game sanity rules (mirror these in supabase-setup.sql) ---------- */
  const RULES = {
    _default: { minScore: 0, maxScore: () => 1000000, minTime: 1, maxTime: 86400, minMoves: 0, maxMoves: 100000 },
    // Solitaire: base points can't exceed ~745 (52x10 foundation + 24x5 waste + 21x5 flips),
    // plus the time bonus round(700000 / seconds). Every card needs a foundation move (52).
    solitaire: { minScore: 0, maxScore: t => 760 + Math.floor(700000 / Math.max(1, t)), minTime: 60, maxTime: 86400, minMoves: 52, maxMoves: 100000 }
  };
  function sane(game, score, time, moves) {
    const r = Object.assign({}, RULES._default, RULES[game] || {});
    const isInt = n => Number.isInteger(n);
    if (!/^[a-z0-9-]{2,32}$/.test(game)) return 'bad game id';
    if (!isInt(score) || score < r.minScore || score > r.maxScore(time)) return 'score out of range';
    if (!isInt(time) || time < r.minTime || time > r.maxTime) return 'time out of range';
    if (!isInt(moves) || moves < r.minMoves || moves > r.maxMoves) return 'moves out of range';
    return '';
  }

  /* ---------- nicknames ---------- */
  const ADJ = ['Shadow', 'Silent', 'Golden', 'Hidden', 'Masked', 'Swift', 'Stealth', 'Night', 'Mystic', 'Ghost', 'Crimson', 'Jade', 'Hooded', 'Rogue', 'Royal', 'Iron'];
  const NOUN = ['Ninja', 'Ronin', 'Shogun', 'Blade', 'Shade', 'Fox', 'Crow', 'Wolf', 'Viper', 'Monk', 'Raven', 'Tiger', 'King', 'Queen', 'Anon'];
  function randomNickname() {
    for (let i = 0; i < 50; i++) {
      const n = ADJ[Math.random() * ADJ.length | 0] + '-' + NOUN[Math.random() * NOUN.length | 0] + '-' + (10 + (Math.random() * 90 | 0));
      if (n.length <= 16) return n;
    }
    return 'Shadow-Ninja-42';
  }
  // Simple filter: catches common slurs/swears incl. leetspeak. Not perfect, by design small.
  const BAD = ['fuck', 'fuk', 'shit', 'cunt', 'bitch', 'nigg', 'nigga', 'fag', 'slut', 'whore', 'dick', 'cock', 'pussy', 'wank', 'twat', 'bastard',
    'rape', 'nazi', 'hitler', 'kike', 'spic', 'chink', 'retard', 'porn', 'penis', 'vagina', 'asshole', 'arsehole', 'bollock', 'prick', 'jizz', 'cum',
    'sex', 'tits', 'boob', 'paki', 'coon', 'tranny', 'dyke', 'kkk', 'isis'];
  const RESERVED = ['admin', 'moderator', 'official', 'support', 'anonnft', 'system'];
  function normalise(s) {
    return s.toLowerCase().replace(/[0@4]/g, m => ({ 0: 'o', '@': 'a', 4: 'a' })[m]).replace(/[1!|]/g, 'i').replace(/3/g, 'e')
      .replace(/[5$]/g, 's').replace(/7/g, 't').replace(/8/g, 'b').replace(/[^a-z]/g, '');
  }
  function validateNickname(raw) {
    const v = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    if (v.length < 3 || v.length > 16) return { ok: false, value: v, error: 'Use 3 to 16 characters.' };
    if (!/^[A-Za-z0-9][A-Za-z0-9 _-]*[A-Za-z0-9]$/.test(v)) return { ok: false, value: v, error: 'Letters, numbers, spaces, - and _ only.' };
    const n = normalise(v), plain = v.toLowerCase().replace(/[^a-z]/g, '');
    if (BAD.some(w => n.includes(w) || plain.includes(w))) return { ok: false, value: v, error: 'Keep it clean, ninja. Try another name.' };
    if (RESERVED.some(w => n.includes(w))) return { ok: false, value: v, error: 'That name is reserved. Try another.' };
    return { ok: true, value: v, error: '' };
  }
  const getNickname = () => { const n = ls.get(K_NICK, ''); return validateNickname(n).ok ? n : ''; };
  function setNickname(n) { const r = validateNickname(n); if (r.ok) { ls.set(K_NICK, r.value); ls.set(K_OPTOUT, false); } return r; }

  /* ---------- styles + small UI kit (prefixed .alb-) ---------- */
  function injectCSS() {
    if (document.getElementById('alb-css')) return;
    const s = document.createElement('style'); s.id = 'alb-css';
    s.textContent = `
.alb-ov{position:fixed;inset:0;z-index:5000;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(0,0,0,.66);font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#e9e3cf}
.alb-panel{position:relative;width:100%;max-width:380px;max-height:calc(100% - 8px);display:flex;flex-direction:column;background:rgba(6,8,11,.97);border:1px solid #d4af37;border-radius:16px;padding:16px;box-shadow:0 0 0 4px rgba(212,175,55,.08),0 0 40px rgba(43,255,136,.18);animation:alb-pop .3s ease}
@keyframes alb-pop{from{transform:scale(.9);opacity:0}to{transform:scale(1);opacity:1}}
.alb-panel h2{margin:0 0 6px;font-family:Georgia,"Times New Roman",serif;color:#f3d77a;letter-spacing:.08em;font-size:19px;text-align:center}
.alb-panel p{margin:6px 0;font-size:14px;line-height:1.4;color:#d9d2bc}
.alb-in{width:100%;box-sizing:border-box;font:inherit;font-size:17px;padding:11px 12px;border-radius:10px;border:1px solid rgba(212,175,55,.7);background:#0b0d10;color:#f3d77a;outline:none}
.alb-in:focus{box-shadow:0 0 0 3px rgba(43,255,136,.25)}
.alb-err{min-height:18px;font-size:12.5px;color:#ff7a7a;margin-top:4px}
.alb-row{display:flex;gap:8px;margin-top:12px}
.alb-btn{flex:1;min-height:42px;border-radius:11px;border:1px solid rgba(212,175,55,.75);background:linear-gradient(180deg,#1d1a0d,#0a0905);color:#f3d77a;font:inherit;font-weight:700;font-size:14px;letter-spacing:.04em;cursor:pointer}
.alb-btn.alb-pri{background:linear-gradient(180deg,#e9c858,#a47c1f);color:#120e02;border-color:#f3d77a}
.alb-btn.alb-ghost{background:transparent;border-color:rgba(212,175,55,.35);color:#b9a35c}
.alb-x{position:absolute;right:8px;top:8px;width:34px;height:34px;border-radius:50%;border:1px solid rgba(212,175,55,.5);background:rgba(0,0,0,.4);color:#f3d77a;font-size:16px;cursor:pointer}
.alb-board{display:flex;flex-direction:column;min-height:0}
.alb-seg{display:flex;gap:6px;margin:4px 0 8px}
.alb-seg button{flex:1;min-height:36px;border-radius:18px;border:1px solid rgba(212,175,55,.45);background:rgba(0,0,0,.35);color:#b9a35c;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.alb-seg button.on{background:rgba(212,175,55,.18);color:#f3d77a;border-color:#d4af37;box-shadow:0 0 10px rgba(43,255,136,.15)}
.alb-list{list-style:none;margin:0;padding:0;overflow:auto;-webkit-overflow-scrolling:touch;min-height:60px}
.alb-li{display:grid;grid-template-columns:34px 1fr auto;align-items:center;gap:8px;padding:8px 8px;border-bottom:1px solid rgba(212,175,55,.12);font-size:14px}
.alb-li .alb-rk{font-weight:800;color:#9d9580;text-align:center;font-variant-numeric:tabular-nums}
.alb-li:nth-child(1) .alb-rk{color:#f3d77a}.alb-li:nth-child(2) .alb-rk{color:#d8d8d8}.alb-li:nth-child(3) .alb-rk{color:#d08a4a}
.alb-nm{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e9e3cf}
.alb-sub{display:block;font-size:11px;color:#8c8570}
.alb-sc{font-weight:800;color:#f3d77a;font-variant-numeric:tabular-nums;text-align:right}
.alb-me{background:linear-gradient(90deg,rgba(43,255,136,.16),rgba(43,255,136,.03));border:1px solid rgba(43,255,136,.45);border-radius:10px}
.alb-me .alb-nm::after{content:" (you)";color:#2bff88;font-size:12px}
.alb-note{font-size:12px;color:#9d9580;text-align:center;margin:8px 0 2px;line-height:1.4}
.alb-empty{text-align:center;color:#9d9580;padding:18px 6px;font-size:14px}
.alb-you{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5px;color:#9d9580;margin-top:8px}
.alb-you b{color:#2bff88}
.alb-link{background:none;border:0;color:#d4af37;font:inherit;font-size:12.5px;text-decoration:underline;cursor:pointer;padding:4px}
.alb-spin{width:22px;height:22px;margin:18px auto;border:3px solid rgba(212,175,55,.25);border-top-color:#d4af37;border-radius:50%;animation:alb-sp 1s linear infinite}
@keyframes alb-sp{to{transform:rotate(360deg)}}`;
    document.head.appendChild(s);
  }
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmtTime = t => t == null ? '' : Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');

  /* ---------- nickname prompt ---------- */
  function promptNickname(opts) {
    opts = opts || {};
    injectCSS();
    return new Promise(resolve => {
      const ov = el('div', 'alb-ov'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
      const p = el('div', 'alb-panel');
      p.appendChild(el('h2', '', opts.title || '🥷 Join the leaderboard'));
      p.appendChild(el('p', '', opts.text || 'Pick a ninja name for the global ANON leaderboard. No sign-up, no email. Only your name and score are shown.'));
      const inp = el('input', 'alb-in'); inp.maxLength = 16; inp.autocomplete = 'off'; inp.spellcheck = false; inp.setAttribute('aria-label', 'Nickname');
      inp.value = getNickname() || randomNickname();
      const err = el('div', 'alb-err');
      p.appendChild(inp); p.appendChild(err);
      const row = el('div', 'alb-row');
      const dice = el('button', 'alb-btn alb-ghost', '🎲 Random'); dice.type = 'button';
      const save = el('button', 'alb-btn alb-pri', opts.saveLabel || 'Save'); save.type = 'button';
      row.appendChild(dice); row.appendChild(save); p.appendChild(row);
      const skip = el('button', 'alb-link', opts.skipLabel || 'Not now, keep my scores on this device');
      const sr = el('div', 'alb-note'); sr.appendChild(skip); p.appendChild(sr);
      ov.appendChild(p); document.body.appendChild(ov);
      const done = v => { ov.remove(); resolve(v); };
      dice.onclick = () => { inp.value = randomNickname(); err.textContent = ''; };
      save.onclick = () => { const r = setNickname(inp.value); if (!r.ok) { err.textContent = r.error; inp.focus(); return; } done(r.value); };
      inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') save.click(); };
      skip.onclick = () => { if (opts.markOptOut !== false) ls.set(K_OPTOUT, true); done(null); };
      setTimeout(() => { try { inp.focus({ preventScroll: true }); inp.select(); } catch (e) {} }, 60);
    });
  }

  /* ---------- network ---------- */
  async function req(path, init) {
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ac ? setTimeout(() => ac.abort(), CFG.timeoutMs) : 0;
    try {
      const r = await fetch(base() + path, Object.assign({ mode: 'cors', credentials: 'omit', signal: ac && ac.signal }, init));
      let body = null; const txt = await r.text(); try { body = txt ? JSON.parse(txt) : null; } catch (e) { body = txt; }
      return { ok: r.ok, status: r.status, body };
    } finally { if (t) clearTimeout(t); }
  }

  /* ---------- local (on-device) board ---------- */
  function localAdd(game, row) {
    const list = ls.get(K_LOCAL(game), []);
    list.push(row); ls.set(K_LOCAL(game), list.slice(-200));
  }
  function localTop(game, opts) {
    const since = opts.period === 'week' ? weekStart().getTime() : 0, asc = opts.order === 'asc';
    return ls.get(K_LOCAL(game), [])
      .filter(r => !since || (r.created_at && Date.parse(r.created_at) >= since))
      .sort((a, b) => asc ? a.score - b.score : b.score - a.score || (a.time_seconds || 1e9) - (b.time_seconds || 1e9))
      .slice(0, opts.limit || 50);
  }
  function seedLocal(game, rows) {
    if (ls.get(K_LOCAL(game), []).length) return;
    rows.filter(r => r && Number.isFinite(r.score) && r.score > 0).forEach(r => localAdd(game, Object.assign({ nickname: getNickname() || 'You', created_at: null }, r)));
  }
  function weekStart() { // Monday 00:00 local time
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d;
  }

  /* ---------- submit ---------- */
  let busy = false;
  async function submit(s) {
    const game = String(s.game || ''), score = Math.round(Number(s.score)), time = Math.round(Number(s.time)), moves = Math.round(Number(s.moves));
    const mode = s.mode ? String(s.mode).slice(0, 16) : null;
    const now = new Date().toISOString();
    const why = sane(game, score, time, moves);
    if (why) return { status: 'rejected', message: 'Score not posted (' + why + ').' };
    // local copy always
    localAdd(game, { nickname: getNickname() || 'You', score, time_seconds: time, moves, mode, created_at: now });
    if (!configured()) return { status: 'local', message: 'Saved on this device. Global leaderboard coming soon.' };
    if (busy) return { status: 'skipped', message: 'Already posting a score…' };
    const last = ls.get(K_LAST(game), 0);
    if (Date.now() - last < 20000) return { status: 'skipped', message: 'Saved on this device (too many scores too fast).' };
    let nick = getNickname();
    if (!nick) {
      if (ls.get(K_OPTOUT, false)) return { status: 'local', message: 'Saved on this device. Set a nickname in Leaderboards to go global.' };
      nick = await promptNickname({ saveLabel: 'Save & post score' });
      if (!nick) return { status: 'local', message: 'Saved on this device only.' };
    }
    busy = true;
    try {
      const r = await req('/' + CFG.table, { method: 'POST', headers: headers({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ game, nickname: nick, score, time_seconds: time, moves, mode }) });
      if (r.ok) { ls.set(K_LAST(game), Date.now()); return { status: 'online', nickname: nick, message: 'Posted to the global leaderboard as ' + nick + '.' }; }
      const code = r.body && r.body.code, msg = (r.body && r.body.message) || '';
      if (/rate/i.test(msg)) return { status: 'rejected', message: 'Slow down, ninja. Try again in a minute.' };
      if (code === '23514' || r.status === 400) return { status: 'rejected', message: 'The server did not accept this score.' };
      return { status: 'error', message: 'Could not reach the leaderboard. Saved on this device.' };
    } catch (e) {
      return { status: 'error', message: 'Offline? Saved on this device.' };
    } finally { busy = false; }
  }

  /* ---------- fetch top ---------- */
  function dedupe(rows, asc) {
    const best = new Map();
    rows.forEach(r => { const k = String(r.nickname).toLowerCase(), b = best.get(k);
      if (!b || (asc ? r.score < b.score : r.score > b.score) || (r.score === b.score && (r.time_seconds || 1e9) < (b.time_seconds || 1e9))) best.set(k, r); });
    return [...best.values()].sort((a, b) => (asc ? a.score - b.score : b.score - a.score) || (a.time_seconds || 1e9) - (b.time_seconds || 1e9));
  }
  async function fetchTop(game, opts) {
    opts = Object.assign({ period: 'all', limit: 50, order: 'desc' }, opts);
    const asc = opts.order === 'asc', since = opts.period === 'week' ? weekStart().toISOString() : null;
    if (!configured()) return { online: false, rows: localTop(game, opts), note: 'Showing your best scores on this device. The global leaderboard switches on soon.' };
    try {
      let r = await req('/rpc/' + CFG.rpc, { method: 'POST', headers: headers(),
        body: JSON.stringify({ p_game: game, p_since: since, p_limit: opts.limit, p_asc: asc }) });
      if (!r.ok && (r.status === 404 || r.status === 400)) { // function not installed: plain select + dedupe here
        let q = '/' + CFG.table + '?select=nickname,score,time_seconds,moves,mode,created_at&game=eq.' + encodeURIComponent(game) +
          '&order=score.' + (asc ? 'asc' : 'desc') + ',time_seconds.asc&limit=500';
        if (since) q += '&created_at=gte.' + encodeURIComponent(since);
        r = await req(q, { method: 'GET', headers: headers() });
        if (r.ok && Array.isArray(r.body)) r.body = dedupe(r.body, asc).slice(0, opts.limit);
      }
      if (r.ok && Array.isArray(r.body)) return { online: true, rows: r.body.slice(0, opts.limit) };
      throw new Error('bad response ' + r.status);
    } catch (e) {
      return { online: false, error: true, rows: localTop(game, opts), note: 'Could not reach the global leaderboard. Showing scores on this device.' };
    }
  }

  /* ---------- board UI ---------- */
  function renderBoard(container, opts) {
    injectCSS();
    opts = Object.assign({ period: 'all', order: 'desc', scoreLabel: 'Score' }, opts);
    container.innerHTML = ''; container.classList.add('alb-board');
    const seg = el('div', 'alb-seg');
    const bAll = el('button', '', 'All-time'), bWeek = el('button', '', 'This week');
    bAll.type = bWeek.type = 'button'; seg.appendChild(bAll); seg.appendChild(bWeek);
    const list = el('ol', 'alb-list'), note = el('div', 'alb-note'), you = el('div', 'alb-you');
    container.appendChild(seg); container.appendChild(list); container.appendChild(note); container.appendChild(you);
    let token = 0;
    const paintYou = () => {
      you.innerHTML = ''; const n = getNickname();
      const lab = el('span'); if (n) { lab.appendChild(document.createTextNode('Playing as ')); lab.appendChild(el('b', '', n)); } else lab.textContent = 'No nickname yet';
      const ch = el('button', 'alb-link', n ? 'Change name' : 'Set nickname');
      ch.onclick = async () => { const r = await promptNickname({ title: '🥷 Your ninja name', text: 'Shown next to your scores. 3 to 16 characters.', skipLabel: 'Cancel', markOptOut: false }); if (r) { paintYou(); load(); } };
      you.appendChild(lab); you.appendChild(ch);
    };
    async function load() {
      const my = ++token;
      bAll.classList.toggle('on', opts.period === 'all'); bWeek.classList.toggle('on', opts.period === 'week');
      list.innerHTML = ''; list.appendChild(el('div', 'alb-spin')); note.textContent = '';
      const res = await fetchTop(opts.game, { period: opts.period, order: opts.order, limit: 50 });
      if (my !== token) return;
      list.innerHTML = '';
      const me = (getNickname() || 'You').toLowerCase(); let meDone = false;
      if (!res.rows.length) list.appendChild(el('div', 'alb-empty', opts.period === 'week' ? 'No scores yet this week. Be the first ninja on the board!' : 'No scores yet. Win a game to claim #1!'));
      res.rows.forEach((r, i) => {
        const li = el('li', 'alb-li'); li.dataset.rank = i + 1;
        if (!meDone && String(r.nickname).toLowerCase() === me && (res.online ? !!getNickname() : true)) { li.classList.add('alb-me'); meDone = true; }
        li.appendChild(el('span', 'alb-rk', i < 3 ? ['🥇', '🥈', '🥉'][i] : String(i + 1)));
        const nm = el('span', 'alb-nm', r.nickname);
        const bits = []; if (r.time_seconds != null) bits.push(fmtTime(r.time_seconds)); if (r.moves != null) bits.push(r.moves + ' moves'); if (r.mode) bits.push(String(r.mode).replace('draw', 'Draw '));
        const sub = el('span', 'alb-sub', bits.join(' · '));
        const box = el('span'); box.style.minWidth = '0'; box.appendChild(nm); box.appendChild(sub);
        li.appendChild(box);
        li.appendChild(el('span', 'alb-sc', String(r.score)));
        list.appendChild(li);
      });
      note.textContent = res.online ? (opts.period === 'week' ? 'Best score per player since Monday.' : 'Top 50 · best score per player.') : res.note;
      container.dataset.state = res.online ? 'online' : 'local';
    }
    bAll.onclick = () => { opts.period = 'all'; load(); };
    bWeek.onclick = () => { opts.period = 'week'; load(); };
    paintYou(); load();
    return { reload: load };
  }
  function openBoard(game, opts) {
    injectCSS(); opts = Object.assign({ title: 'Leaderboard' }, opts, { game });
    const ov = el('div', 'alb-ov'); ov.setAttribute('role', 'dialog');
    const p = el('div', 'alb-panel'); p.style.height = 'min(640px, calc(100% - 8px))';
    const x = el('button', 'alb-x', '✕'); x.setAttribute('aria-label', 'Close'); x.type = 'button';
    p.appendChild(x); p.appendChild(el('h2', '', '🏆 ' + opts.title));
    const b = el('div'); b.style.flex = '1'; b.style.minHeight = '0'; p.appendChild(b);
    ov.appendChild(p); document.body.appendChild(ov);
    const close = () => { ov.remove(); document.removeEventListener('keydown', esc, true); };
    const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    x.onclick = close; ov.onclick = e => { if (e.target === ov) close(); };
    document.addEventListener('keydown', esc, true);
    renderBoard(b, opts);
    return { close };
  }

  window.ANONLB = {
    version: '1.0.0', isConfigured: configured, submit, fetchTop, renderBoard, openBoard, promptNickname,
    getNickname, setNickname, validateNickname, randomNickname, seedLocal, sane, weekStart, _cfg: CFG
  };
})();
