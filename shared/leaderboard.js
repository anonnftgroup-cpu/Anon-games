/* =====================================================================
   ANON Arcade · shared leaderboard (leaderboard.js)
   Used by every game and by the Arcade hub. No SDK, no cookies. Only an anonymous per-game play counter (see bottom).

   ----------------------- CONFIG: EDIT THESE TWO -----------------------
   From your Supabase project: Project Settings → API (or the "Connect" button)
     SUPABASE_URL      = the Project URL, e.g. https://abcdefghij.supabase.co
     SUPABASE_ANON_KEY = the PUBLISHABLE key (sb_publishable_...) or the
                         legacy "anon public" key (eyJ...). NEVER the secret /
                         service_role key.
   Leave them as they are and the games fall back to on-device scores.
   --------------------------------------------------------------------- */
const SUPABASE_URL = 'https://dcbgxhpwrfqbwldpclbq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-f0lT5SuVJ-TbFzlfMd7kA_hH6ZXp-N';
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
  const K_GAMES = 'anonLB.scoredGames', K_NICK = 'anonLB.nick', K_OPTOUT = 'anonLB.optout', K_LOCAL = g => 'anonLB.local.' + g, K_LAST = g => 'anonLB.last.' + g;

  /* ---------- per-game sanity rules (mirror these in supabase-setup.sql) ---------- */
  const RULES = {
    _default: { minScore: 0, maxScore: () => 1000000, minTime: 1, maxTime: 86400, minMoves: 0, maxMoves: 100000 },
    // Solitaire: base points can't exceed ~745 (52x10 foundation + 24x5 waste + 21x5 flips),
    // plus the time bonus round(700000 / seconds). Every card needs a foundation move (52).
    solitaire: { minScore: 0, maxScore: t => 760 + Math.floor(700000 / Math.max(1, t)), minTime: 60, maxTime: 86400, minMoves: 52, maxMoves: 100000 },
    // Daily ANON Word: moves = guesses used (1-6). score = (7 - guesses) * 100 + max(0, 99 - floor(seconds / 6)).
    'daily-word': { minScore: 100, maxScore: (t, m) => (7 - m) * 100 + Math.max(0, 99 - Math.floor(t / 6)), minTime: 3, maxTime: 86400, minMoves: 1, maxMoves: 6 },
    // ANON Four in a Row, game id connect4 (wins vs computer only): moves = the player's own moves (4-21), mode = easy | medium | hard.
    // score = base (easy 100, medium 300, hard 600) + (22 - moves) * 10, and at least 1 second per move.
    connect4: { minScore: 110, maxScore: (t, m) => 600 + (22 - m) * 10, minTime: 4, maxTime: 86400, minMoves: 4, maxMoves: 21,
      check: (score, t, m, mode) => { const b = { easy: 100, medium: 300, hard: 600 }[mode];
        if (!b) return 'bad mode'; if (score !== b + (22 - m) * 10) return 'score out of range'; if (t < m) return 'time out of range'; return ''; } },
    // ANON Tic-Tac-Toe (best-of-5 series vs computer): mode = difficulty-wins-draws (e.g. hard-3-1), moves = your moves in the series.
    // score = (easy 10, medium 30, hard 100) x (3 x wins + draws). Moves: at least 3 per win, 4 per draw, 2 per loss; 25 at most.
    tictactoe: { minScore: 10, maxScore: () => 1500, minTime: 10, maxTime: 86400, minMoves: 2, maxMoves: 25,
      check: (score, t, m, mode) => { const x = /^(easy|medium|hard)-([0-5])-([0-5])$/.exec(mode || ''); if (!x) return 'bad mode';
        const w = +x[2], d = +x[3], l = 5 - w - d; if (l < 0) return 'bad mode';
        if (score <= 0 || score !== { easy: 10, medium: 30, hard: 100 }[x[1]] * (3 * w + d)) return 'score out of range';
        if (m < 3 * w + 4 * d + 2 * l || m > 25) return 'moves out of range'; if (t < Math.max(10, m)) return 'time out of range'; return ''; } }
  };
  function sane(game, score, time, moves, mode) {
    const r = Object.assign({}, RULES._default, RULES[game] || {});
    const isInt = n => Number.isInteger(n);
    if (!/^[a-z0-9-]{2,32}$/.test(game)) return 'bad game id';
    if (!isInt(score) || score < r.minScore || score > r.maxScore(time, moves)) return 'score out of range';
    if (!isInt(time) || time < r.minTime || time > r.maxTime) return 'time out of range';
    if (!isInt(moves) || moves < r.minMoves || moves > r.maxMoves) return 'moves out of range';
    if (r.check) return r.check(score, time, moves, mode);
    return '';
  }

  /* ---------- nicknames ---------- */
  const ADJ = ['Golden', 'Neon', 'Lucky', 'Cosmic', 'Pixel', 'Turbo', 'Sunny', 'Brave', 'Jolly', 'Royal', 'Swift', 'Bright', 'Mega', 'Happy', 'Epic', 'Retro'];
  const NOUN = ['Comet', 'Rocket', 'Lantern', 'Arcade', 'Star', 'Nova', 'Fox', 'Tiger', 'Panda', 'Falcon', 'Gem', 'Champ', 'Hero', 'Ape', 'Anon'];
  function randomNickname() {
    for (let i = 0; i < 50; i++) {
      const n = ADJ[Math.random() * ADJ.length | 0] + '-' + NOUN[Math.random() * NOUN.length | 0] + '-' + (10 + (Math.random() * 90 | 0));
      if (n.length <= 16) return n;
    }
    return 'Lucky-Comet-42';
  }
  /* NF-START: name filter (generated from name-filter/words.json by name-filter/gen.js; mirror of public.nickname_is_clean) */
  const NF = {'substring':'fuck,fck,fcuk,fvck,phuck,phuk,motherf,shit,cunt,kunt,bitch,biatch,biotch,bastard,asshole,arsehole,asswipe,assclown,dumbass,jackass,bigass,fatass,kissmyass,bollock,bellend,wank,twat,douche,tosser,jerkoff,jizz,cumshot,cumslut,cocksuck,dickhead,dicksuck,blowjob,handjob,rimjob,footjob,dildo,porn,penis,vagina,pussy,clitoris,orgasm,masturbat,ejaculat,erection,horny,hentai,milf,boob,titties,tittie,nipple,scrotum,testicle,ballsack,nutsack,buttplug,creampie,gangbang,deepthroat,bukkake,queef,smegma,felch,fellat,cunnilin,prostitut,sex,rape,rapist,incest,pedophil,paedophil,paedo,zoophil,bestiality,necrophil,slut,whore,skank,nigg,niqq,jigaboo,porchmonkey,junglebunny,darkie,golliwog,gollywog,wetback,beaner,kike,raghead,towelhead,cameljockey,zipperhead,slanteye,chinky,faggot,tranny,shemale,poofter,retard,spastic,pikey,nazi,hitler,siegheil,kkk,kluxklan,klansm,whitepower,whitepride,aryannation,aryanbrother,jihad,taliban,alqaeda,alqaida,goebbels,himmler,swastika,holohoax,rahowa,binladen,1488,14words,hh88,88hh,admin,moderator,official,anonnft,anonteam,anonstaff,anonsupport', 'token':'ass,arse,anal,anus,cum,tit,titty,cock,dick,dik,prick,knob,clit,boner,spunk,cuck,fag,homo,dyke,lesbo,poof,spic,spick,chink,gook,jap,coon,wog,negro,sambo,kaffir,kafir,paki,gypo,gyppo,yid,heeb,hymie,mong,spaz,tard,nonce,pedo,thot,slag,minge,turd,piss,nude,orgy,loli,heil,klan,adolf,zog,isis,stfu,gtfo,wtf,fuk,kys,puta,puto', 'exact':'anon,mod,mods,staff,owner,dev,team,root,system,support,null,undefined', 'allow':'scunthorpe,shiitake,shitake,sussex,essex,wessex,middlesex,sextant,sexton,unisex,grape,drape,scrape,trapez,parapet,rapeseed,therapist,ashkenazi,nazir,badminton,penistone,thorny,swank,booboo'};
  const NFW = {}; Object.keys(NF).forEach(k => { NFW[k] = NF[k].split(','); });
  const nfC1 = s => s.replace(/(.)\1+/g, '$1'), nfC2 = s => s.replace(/(.)\1\1+/g, '$1$1'), nfId = s => s;
  const NF_LEET = { 0: 'o', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g', '@': 'a', $: 's', '!': 'i' };
  // three spellings of a piece: 1 read as i, 1 read as l, digits dropped
  const nfBases = s => { const l = s.toLowerCase();
    return ['i', 'l', ''].map(one => (one ? l.replace(/[0-9@$!]/g, c => c === '1' ? one : NF_LEET[c] || '') : l).replace(/[^a-z]/g, '')); };
  function nfHit(piece, words, whole) {
    for (const b of nfBases(piece)) for (const [f, k] of [[b, nfId], [nfC2(b), nfId], [nfC1(b), nfC1]]) {
      let g = f; NFW.allow.forEach(a => { g = g.split(k(a)).join('#'); });
      for (const [w, m] of words) {
        if (/\d/.test(w)) continue;
        const kw = k(w); if (k === nfC1 && kw !== w && kw.length < 4) continue;
        if (whole && m === 'substring' ? g.includes(kw) : (g === kw || g === kw + 's')) return true;
      }
    }
    return false;
  }
  function isCleanName(raw) {
    const s = String(raw == null ? '' : raw), d = s.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (NFW.substring.some(w => /\d/.test(w) && d.includes(w)) || NFW.exact.some(w => /\d/.test(w) && d === w)) return false;
    const whole = [...NFW.substring.map(w => [w, 'substring']), ...NFW.exact.map(w => [w, 'exact'])], tok = NFW.token.map(w => [w, 'token']);
    if (nfHit(s, whole, true)) return false;
    return !s.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s_-]+/).some(t => t && nfHit(t, tok, false));
  }
  /* NF-END */
  const NAME_ERR = 'That name isn\'t allowed. Try another 🎮';
  function validateNickname(raw) {
    const v = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    if (v.length < 3 || v.length > 16) return { ok: false, value: v, error: 'Use 3 to 16 characters.' };
    if (!/^[A-Za-z0-9][A-Za-z0-9 _-]*[A-Za-z0-9]$/.test(v)) return { ok: false, value: v, error: 'Letters, numbers, spaces, - and _ only.' };
    if (!isCleanName(v)) return { ok: false, value: v, error: NAME_ERR };
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
.alb-btn.alb-play{flex:none;width:100%;min-height:48px;margin-top:10px;font-size:15px;font-weight:900;box-shadow:0 0 16px rgba(43,255,136,.2)}
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
      p.appendChild(el('h2', '', opts.title || '🏆 Join the leaderboard'));
      p.appendChild(el('p', '', opts.text || 'Pick a name for the global ANON leaderboard. No sign-up, no email. Only your name and score are shown.'));
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
    const ps = periodStart(opts.period), since = ps ? ps.getTime() : 0, asc = opts.order === 'asc';
    return ls.get(K_LOCAL(game), [])
      .filter(r => r && isCleanName(r.nickname))
      .filter(r => !since || (r.created_at && Date.parse(r.created_at) >= since))
      .sort((a, b) => asc ? a.score - b.score : b.score - a.score || (a.time_seconds || 1e9) - (b.time_seconds || 1e9))
      .slice(0, opts.limit || 50);
  }
  function seedLocal(game, rows) {
    if (ls.get(K_LOCAL(game), []).length) return;
    rows.filter(r => r && Number.isFinite(r.score) && r.score > 0).forEach(r => localAdd(game, Object.assign({ nickname: getNickname() || 'You', created_at: null }, r)));
  }
  // Midnight UK time (Europe/London, handles BST) for the current day, as a Date
  function ukDayStart(now) {
    const t = now == null ? Date.now() : +now;
    const wall = ms => { const o = {}; new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
      .formatToParts(new Date(ms)).forEach(p => { o[p.type] = +p.value; }); return o; };
    const w = wall(t), mid = Date.UTC(w.year, w.month - 1, w.day), w2 = wall(mid);
    const off = Date.UTC(w2.year, w2.month - 1, w2.day, w2.hour, w2.minute, w2.second) - mid;
    return new Date(mid - off);
  }
  const periodStart = p => p === 'week' ? weekStart() : p === 'day' ? ukDayStart() : null;
  function weekStart() { // Monday 00:00 local time
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d;
  }

  /* ---------- submit ----------
     Every game over gets a small post box (not a modal) with the name already filled in: the saved nickname, or a
     guest name like Pixel-4821 or Comet-4821 ("ANON-…" is reserved by the name filter) that is kept for next time. The player can edit it and tap Post. If they don't, it posts
     by itself, exactly once, when they tap anything else (Play again, ← Arcade, Back…), press a key, leave the page,
     or after 20 seconds. Scores go through an on-device outbox, so the server's 30-second-per-game rate limit queues a
     score instead of losing it. A server rejection (anti-cheat, bad name) is never shown to the player as an error. */
  const K_GUEST = 'anonLB.guest', K_OUT = 'anonLB.outbox', COOLDOWN = 31000, IDLE_MS = 20000;
  const GUEST_WORDS = ['Pixel', 'Comet', 'Arcade', 'Lantern', 'Neon', 'Rocket', 'Nova', 'Star', 'Lucky', 'Turbo'];
  function guestName() {
    let g = ls.get(K_GUEST, '');
    if (validateNickname(g).ok && !/^Ninja-\d{4}$/.test(g)) return g;
    // Old guest names were Ninja-1234. Keep the same digits as Arcade-1234 (matches supabase-rename-defaults.sql) so a returning player stays one row.
    const old = /^Ninja-(\d{4})$/.exec(String(g || ''));
    if (old && validateNickname('Arcade-' + old[1]).ok) { g = 'Arcade-' + old[1]; ls.set(K_GUEST, g); return g; }
    for (let i = 0; i < 20; i++) { g = GUEST_WORDS[Math.random() * GUEST_WORDS.length | 0] + '-' + (1000 + (Math.random() * 9000 | 0)); if (validateNickname(g).ok) break; }
    ls.set(K_GUEST, g); return g;
  }
  const postName = () => getNickname() || guestName();

  /* outbox */
  const outGet = () => { const o = ls.get(K_OUT, []); return Array.isArray(o) ? o : []; };
  const outSet = o => ls.set(K_OUT, o.slice(-40));
  const inflight = new Set(); let drainT = 0;
  function queue(row) { const o = outGet(); o.push(row); outSet(o); }
  async function sendOne(it, keepalive) {
    inflight.add(it.id);
    outSet(outGet().filter(x => x.id !== it.id)); // taken out before sending: a page closing mid-request can't post it twice
    const putBack = (later) => { it.tries = (it.tries || 0) + 1; it.nb = Date.now() + later; if (it.tries <= 8) queue(it); };
    try {
      const r = await req('/' + CFG.table, { method: 'POST', keepalive: !!keepalive, headers: headers({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ game: it.game, nickname: it.nick, score: it.score, time_seconds: it.time, moves: it.moves, mode: it.mode }) });
      if (r.ok) { ls.set(K_LAST(it.game), Date.now()); return 'online'; }
      const msg = (r.body && r.body.message) || '';
      if (/rate/i.test(msg)) { ls.set(K_LAST(it.game), Date.now()); putBack(COOLDOWN); return 'queued'; }
      if (/nickname not allowed/i.test(msg)) { if (getNickname().toLowerCase() === String(it.nick).toLowerCase()) ls.set(K_NICK, ''); ls.set(K_GUEST, '');
        it.nick = guestName(); putBack(0); return 'queued'; }
      if (r.status >= 500) { putBack(COOLDOWN); return 'queued'; }
      return 'rejected'; // 400 / 409 / check constraint: anti-cheat said no. Stays on this device, no error shown.
    } catch (e) { putBack(COOLDOWN); return 'queued'; }
    finally { inflight.delete(it.id); }
  }
  async function drain(keepalive) {
    clearTimeout(drainT);
    if (!configured()) return;
    const now = Date.now(), seen = new Set(); let next = Infinity;
    for (const it of outGet()) {
      if (inflight.has(it.id)) continue;
      const ready = Math.max(it.nb || 0, ls.get(K_LAST(it.game), 0) + COOLDOWN);
      if (ready > now || seen.has(it.game)) { next = Math.min(next, ready > now ? ready : now + COOLDOWN); continue; }
      seen.add(it.game); sendOne(it, keepalive).then(() => scheduleDrain());
    }
    if (next < Infinity && !keepalive) drainT = setTimeout(drain, Math.max(1000, next - Date.now() + 200));
  }
  const scheduleDrain = () => { clearTimeout(drainT); drainT = setTimeout(drain, 400); };

  /* the pre-filled post box */
  let PB = null; // the one open post box: { commit }
  function boxCSS() {
    if (document.getElementById('alb-pb-css')) return;
    const s = el('style'); s.id = 'alb-pb-css';
    s.textContent = `.alb-pb{box-sizing:border-box;margin:10px auto 2px;width:100%;max-width:420px;padding:9px 10px;border:1px solid rgba(212,175,55,.6);border-radius:13px;background:linear-gradient(180deg,#121417,#07080a);color:#e9e3cf;font:14px system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;text-align:left;box-shadow:0 0 14px rgba(43,255,136,.14)}
.alb-pb.alb-float{position:fixed;left:50%;top:calc(8px + env(safe-area-inset-top));transform:translateX(-50%);z-index:4900;width:min(420px,calc(100% - 16px));margin:0}
.alb-pb-h{font-size:12.5px;font-weight:800;color:#f3d77a;letter-spacing:.03em;margin:0 0 6px}
.alb-pb-r{display:flex;gap:7px}
.alb-pb input{flex:1;min-width:0;min-height:40px;padding:6px 10px;border-radius:10px;border:1px solid rgba(212,175,55,.55);background:#0b0d10;color:#f3d77a;font-size:16px;outline:none}
.alb-pb button{flex:none;min-height:40px;padding:0 16px;border-radius:10px;border:1px solid #f3d77a;background:linear-gradient(180deg,#e9c858,#a47c1f);color:#120e02;font-weight:900;font-size:14px;cursor:pointer}
.alb-pb-n{font-size:11.5px;color:#9d9580;margin-top:5px;min-height:14px}
.alb-pb-n.err{color:#ff8a7a}.alb-pb.done .alb-pb-n{color:#2bff88;font-size:12.5px;font-weight:700}`;
    document.head.appendChild(s);
  }
  function showPostBox(row) {
    injectCSS(); boxCSS();
    const prefill = postName();
    const box = el('div', 'alb-pb'); box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Post your score');
    box.appendChild(el('div', 'alb-pb-h', '🏆 Score ' + row.score + ' · your leaderboard name'));
    const r = el('div', 'alb-pb-r'), inp = el('input'); inp.maxLength = 16; inp.autocomplete = 'off'; inp.spellcheck = false; inp.value = prefill;
    inp.setAttribute('aria-label', 'Leaderboard name'); inp.setAttribute('enterkeyhint', 'send');
    const btn = el('button', '', 'Post'); btn.type = 'button';
    r.appendChild(inp); r.appendChild(btn); box.appendChild(r);
    const note = el('div', 'alb-pb-n', 'Posts automatically in 20s, or tap Post.'); box.appendChild(note);
    // inside the game-over card when there is one (under the score message), otherwise a small card at the top
    const host = document.getElementById('lbMsg') || document.getElementById('wLB');
    if (host && host.offsetParent !== null && host.parentNode) host.parentNode.insertBefore(box, host.nextSibling);
    else { box.classList.add('alb-float'); document.body.appendChild(box); }
    const shownAt = Date.now(); let done = false, idle = 0;
    const arm = () => { clearTimeout(idle); idle = setTimeout(() => commit(false, 'idle'), IDLE_MS); };
    const off = () => { clearTimeout(idle); document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pagehide', onHide); document.removeEventListener('visibilitychange', onVis); };
    function commit(explicit, why) {
      if (done) return true;
      const v = validateNickname(inp.value);
      if (explicit && !v.ok) { note.textContent = v.error; note.className = 'alb-pb-n err'; inp.focus(); return false; }
      done = true; off(); if (PB && PB.box === box) PB = null;
      const name = v.ok ? v.value : prefill;
      setNickname(name); row.nick = name;
      queue(row); drain(why === 'hide');
      box.classList.add('done'); inp.disabled = true; btn.disabled = true; btn.textContent = '✓';
      note.className = 'alb-pb-n'; note.textContent = '✓ Posted as ' + name + ' · change it any time in Leaderboards';
      box.dataset.state = 'posted'; box.dataset.via = why || 'post';
      if (box.classList.contains('alb-float')) setTimeout(() => box.remove(), 4000);
      return true;
    }
    const inBox = t => t && box.contains(t);
    const onDown = e => { if (inBox(e.target) || Date.now() - shownAt < 350) return; commit(false, 'tap'); };
    const onKey = e => { if (inBox(e.target)) return; if (/^(Shift|Control|Alt|Meta|Tab)$/.test(e.key)) return; commit(false, 'key'); };
    const onHide = () => commit(false, 'hide');
    const onVis = () => { if (document.visibilityState === 'hidden') commit(false, 'hide'); };
    btn.onclick = () => commit(true, 'post');
    inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); commit(true, 'post'); } };
    inp.oninput = () => { note.className = 'alb-pb-n'; note.textContent = 'Posts automatically in 20s, or tap Post.'; arm(); };
    inp.onfocus = arm;
    document.addEventListener('pointerdown', onDown, true); document.addEventListener('keydown', onKey, true);
    window.addEventListener('pagehide', onHide); document.addEventListener('visibilitychange', onVis);
    arm();
    PB = { box, commit };
    return PB;
  }
  const flush = () => { if (PB) PB.commit(false, 'next'); };

  async function submit(s) {
    const game = String(s.game || ''), score = Math.round(Number(s.score)), time = Math.round(Number(s.time)), moves = Math.round(Number(s.moves));
    const mode = s.mode ? String(s.mode).slice(0, 16) : null;
    const now = new Date().toISOString();
    const why = sane(game, score, time, moves, mode);
    if (why) return { status: 'rejected', message: 'Score not posted (' + why + ').' };
    flush(); // a box still open from the last game posts now, never twice
    localAdd(game, { nickname: getNickname() || guestName(), score, time_seconds: time, moves, mode, created_at: now });
    if (!configured()) return { status: 'local', message: 'Saved on this device. Global leaderboard coming soon.' };
    const row = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), game, score, time, moves, mode, at: Date.now() };
    let where = 'below';
    try { const pb = showPostBox(row); if (pb.box.classList.contains('alb-float')) where = 'at the top'; }
    catch (e) { row.nick = postName(); queue(row); drain(); return { status: 'pending', message: 'Posting to the leaderboard…' }; }
    return { status: 'pending', message: '🏆 Leaderboard name ' + where + ' (posts by itself).' };
  }
  // anything left in the outbox (rate limit, offline, page closed) goes out on the next page load
  setTimeout(() => { try { drain(); } catch (e) {} }, 2000);

  /* ---------- fetch top ---------- */
  function dedupe(rows, asc) {
    const best = new Map();
    rows.forEach(r => { const k = String(r.nickname).toLowerCase(), b = best.get(k);
      if (!b || (asc ? r.score < b.score : r.score > b.score) || (r.score === b.score && (r.time_seconds || 1e9) < (b.time_seconds || 1e9))) best.set(k, r); });
    return [...best.values()].sort((a, b) => (asc ? a.score - b.score : b.score - a.score) || (a.time_seconds || 1e9) - (b.time_seconds || 1e9));
  }
  async function fetchTop(game, opts) {
    opts = Object.assign({ period: 'all', limit: 50, order: 'desc' }, opts);
    const asc = opts.order === 'asc', ps = periodStart(opts.period), since = ps ? ps.toISOString() : null;
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
      if (r.ok && Array.isArray(r.body)) return { online: true, rows: r.body.filter(x => x && isCleanName(x.nickname)).slice(0, opts.limit) };
      throw new Error('bad response ' + r.status);
    } catch (e) {
      return { online: false, error: true, rows: localTop(game, opts), note: 'Could not reach the global leaderboard. Showing scores on this device.' };
    }
  }

  /* ---------- board UI ---------- */
  function renderBoard(container, opts) {
    injectCSS();
    opts = Object.assign({}, opts); Object.keys(opts).forEach(k => { if (opts[k] == null) delete opts[k]; });
    opts = Object.assign({ order: 'desc', scoreLabel: 'Score', movesLabel: 'moves', periods: ['all', 'week'] }, opts);
    const PL = { day: 'Today', week: 'This week', all: 'All-time' };
    opts.periods = opts.periods.filter(p => PL[p]); if (!opts.periods.length) opts.periods = ['all', 'week'];
    if (!opts.periods.includes(opts.period)) opts.period = opts.periods.includes('all') ? 'all' : opts.periods[0];
    container.innerHTML = ''; container.classList.add('alb-board');
    const seg = el('div', 'alb-seg'), pb = {};
    opts.periods.forEach(p => { const b = el('button', '', PL[p]); b.type = 'button'; b.dataset.period = p; b.onclick = () => { opts.period = p; load(); }; pb[p] = b; seg.appendChild(b); });
    const list = el('ol', 'alb-list'), note = el('div', 'alb-note'), you = el('div', 'alb-you');
    container.appendChild(seg); container.appendChild(list); container.appendChild(note); container.appendChild(you);
    let token = 0;
    const paintYou = () => {
      you.innerHTML = ''; const n = getNickname();
      const lab = el('span'); if (n) { lab.appendChild(document.createTextNode('Playing as ')); lab.appendChild(el('b', '', n)); } else lab.textContent = 'No nickname yet';
      const ch = el('button', 'alb-link', n ? 'Change name' : 'Set nickname');
      ch.onclick = async () => { const r = await promptNickname({ title: '🏆 Your leaderboard name', text: 'Shown next to your scores. 3 to 16 characters.', skipLabel: 'Cancel', markOptOut: false }); if (r) { paintYou(); load(); } };
      you.appendChild(lab); you.appendChild(ch);
    };
    async function load() {
      const my = ++token;
      Object.keys(pb).forEach(p => pb[p].classList.toggle('on', opts.period === p));
      list.innerHTML = ''; list.appendChild(el('div', 'alb-spin')); note.textContent = '';
      const res = await fetchTop(opts.game, { period: opts.period, order: opts.order, limit: 50 });
      if (my !== token) return;
      list.innerHTML = '';
      const me = (getNickname() || 'You').toLowerCase(); let meDone = false;
      if (!res.rows.length) list.appendChild(el('div', 'alb-empty', opts.period === 'week' ? 'No scores yet this week. Be the first on the board!' : opts.period === 'day' ? 'No scores yet today. Be the first on the board!' : 'No scores yet. Win a game to claim #1!'));
      const rows = res.rows.filter(r => r && isCleanName(r.nickname)); // safety net: never show a blocked name
      if (!rows.length && res.rows.length) list.appendChild(el('div', 'alb-empty', 'No scores yet. Win a game to claim #1!'));
      rows.forEach((r, i) => {
        const li = el('li', 'alb-li'); li.dataset.rank = i + 1;
        if (!meDone && String(r.nickname).toLowerCase() === me && (res.online ? !!getNickname() : true)) { li.classList.add('alb-me'); meDone = true; }
        li.appendChild(el('span', 'alb-rk', i < 3 ? ['🥇', '🥈', '🥉'][i] : String(i + 1)));
        const nm = el('span', 'alb-nm', r.nickname);
        const bits = []; if (r.time_seconds != null) bits.push(fmtTime(r.time_seconds)); if (r.moves != null) bits.push(r.moves + ' ' + (r.moves === 1 ? opts.movesLabel.replace(/e?s$/, '') : opts.movesLabel)); if (r.mode && !opts.hideMode) bits.push(opts.modeLabels && opts.modeLabels[r.mode] || String(r.mode).replace('draw', 'Draw '));
        const sub = el('span', 'alb-sub', bits.join(' · '));
        const box = el('span'); box.style.minWidth = '0'; box.appendChild(nm); box.appendChild(sub);
        li.appendChild(box);
        li.appendChild(el('span', 'alb-sc', String(r.score)));
        list.appendChild(li);
      });
      note.textContent = res.online ? (opts.period === 'week' ? 'Best score per player since Monday.' : opts.period === 'day' ? 'Today\'s best score per player (resets at midnight UK time).' : 'Top 50 · best score per player.') : res.note;
      container.dataset.state = res.online ? 'online' : 'local';
    }
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
    // In-game board: the player is already in the game, so the play button just closes the panel
    // (or runs opts.onPlay, e.g. a restart). Pass play: false to hide it.
    let pb = null;
    if (opts.play !== false) { pb = el('button', 'alb-btn alb-pri alb-play', opts.playLabel || '▶ Back to the game'); pb.type = 'button'; p.appendChild(pb); }
    ov.appendChild(p); document.body.appendChild(ov);
    const close = () => { ov.remove(); document.removeEventListener('keydown', esc, true); };
    if (pb) pb.onclick = () => { close(); if (typeof opts.onPlay === 'function') { try { opts.onPlay(); } catch (e) {} } };
    const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    x.onclick = close; ov.onclick = e => { if (e.target === ov) close(); };
    document.addEventListener('keydown', esc, true);
    renderBoard(b, opts);
    return { close };
  }

  window.ANONLB = {
    version: '1.8.0', isConfigured: configured, submit, guestName, postName, flushPost: flush, _drain: drain, _outbox: outGet, fetchTop, renderBoard, openBoard, promptNickname,
    getNickname, setNickname, validateNickname, isCleanName, randomNickname, seedLocal, sane, weekStart, ukDayStart, _cfg: CFG
  };
})();

/* Challenge a friend: load shared/challenge.js next to this file (see shared/CHALLENGE.md). */
(function () {
  try {
    if (window.ANONChallenge || document.querySelector('script[src*="shared/challenge.js"]')) return;
    const me = document.currentScript && document.currentScript.src; if (!me) return;
    const s = document.createElement('script'); s.src = me.replace(/leaderboard\.js(\?.*)?$/, 'challenge.js?v=1'); s.defer = true; document.head.appendChild(s);
  } catch (e) {}
})();

/* Outside the Arcade (challenge links, direct visits): a "← ANON Arcade" button to anonnfts.com/anon-games in the top window. */
(function () {
  try {
    const me = document.currentScript && document.currentScript.src; if (!me) return;
    const root = me.replace(/shared\/leaderboard\.js(\?.*)?$/, ''), here = location.href.split(/[?#]/)[0];
    if (here.indexOf(root) !== 0 || !here.slice(root.length).replace(/index\.html?$/, '')) return; // games only, not the hub
    const framed = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();
    if (framed && /[?&]hub=1\b/.test(location.search)) return; // inside the anonnfts.com Arcade already
    const add = () => {
      if (document.getElementById('anonHome')) return;
      const st = document.createElement('style'); st.textContent = '#anonHome{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(6px + env(safe-area-inset-bottom));z-index:4700;display:inline-flex;align-items:center;gap:4px;height:30px;padding:0 13px;border-radius:15px;border:1px solid #d4af37;background:rgba(5,7,10,.92);color:#f3d77a;font:700 12.5px system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;letter-spacing:.04em;text-decoration:none;box-shadow:0 0 12px rgba(43,255,136,.25)}#anonHome:focus-visible{outline:3px solid #2bff88;outline-offset:2px}html.anon-home-on body{padding-bottom:calc(40px + env(safe-area-inset-bottom))}html.anon-home-on .ach-banner,html.anon-home-on .ach-float{bottom:calc(44px + env(safe-area-inset-bottom))}';
      document.head.appendChild(st);
      const a = document.createElement('a'); a.id = 'anonHome'; a.href = 'https://anonnfts.com/anon-games'; a.target = '_top'; a.rel = 'noopener'; a.textContent = '← ANON Arcade';
      a.setAttribute('aria-label', 'Go to the ANON Arcade on anonnfts.com');
      document.body.appendChild(a); document.documentElement.classList.add('anon-home-on');
    };
    if (document.body) add(); document.addEventListener('DOMContentLoaded', add);
    new MutationObserver(() => { if (document.body && !document.getElementById('anonHome')) add(); }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
})();

/* Play counter: one anonymous "play started" ping per game per browser session, used only to sort the Arcade
   by "Most played". Sends just the game folder name (no nickname, no score, no ID, no cookies). Fails silently,
   e.g. before supabase-plays.sql has been run. Skipped on the hub itself and when ?noplay=1. */
(function () {
  try {
    const me = document.currentScript && document.currentScript.src; if (!me) return;
    const root = me.replace(/shared\/leaderboard\.js(\?.*)?$/, '');
    const here = location.href.split(/[?#]/)[0];
    if (here.indexOf(root) !== 0) return;
    const slug = here.slice(root.length).split('/')[0];
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(slug) || /noplay=1/.test(location.search)) return;
    const cfg = (window.ANONLB && window.ANONLB._cfg) || {};
    if (!/^https:\/\//.test(cfg.url || '') || !cfg.key || /PASTE_/.test(cfg.key)) return;
    const k = 'anonPlay.' + slug;
    try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch (e) { return; }
    const send = () => {
      try {
        const h = { apikey: cfg.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
        if (/^eyJ/.test(cfg.key)) h.Authorization = 'Bearer ' + cfg.key;
        fetch(String(cfg.url).replace(/\/+$/, '') + '/rest/v1/plays', { method: 'POST', mode: 'cors', credentials: 'omit', keepalive: true,
          headers: h, body: JSON.stringify({ game: slug }) }).catch(() => {});
      } catch (e) {}
    };
    setTimeout(send, 1500);
  } catch (e) {}
})();
