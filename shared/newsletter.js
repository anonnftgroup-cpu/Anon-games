/* =====================================================================
   ANON Arcade · shared end-of-game newsletter pop-up (newsletter.js)
   Every game calls ANONNews.gameOver() when a game ends (win or loss).
   - shows a beat after the game's own result screen (default 2.6 s)
   - waits while a nickname prompt / leaderboard (.alb-ov) is open
   - not before the device's 3rd game over, at most once per day (UK date)
   - never in the same game over as a leaderboard name prompt
   - email box posts straight to Kit (form 10062464) with fetch; on success it never shows again on this device
     (a sign-up from the Arcade hub's box counts too). "Open sign-up page" link is the fallback (snoozes 30 days)
   - also adds a small "Meet the ANONs" link (anonnfts.com/collections) to every game-over screen
   ===================================================================== */
(function () {
  'use strict';
  if (window.ANONNews) return;
  const URL_SUB = 'https://anon-nfts.kit.com/ba58d6d746', URL_POST = 'https://app.kit.com/forms/10062464/subscriptions';
  const K = 'anonNews.v1';
  const st = () => { try { return JSON.parse(localStorage.getItem(K)) || {}; } catch (e) { return {}; } };
  const put = v => { try { localStorage.setItem(K, JSON.stringify(Object.assign(st(), v))); } catch (e) {} };
  const ukDate = () => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } };
  const DAY = 864e5, MIN_GAMES = 3;
  (function migrate() { const s = st(); if (s.subscribed && !s.snooze) put({ subscribed: false, snooze: Date.now() + 30 * DAY }); })();
  const allowed = () => { const s = st(); return !(s.snooze > Date.now()) && s.last !== ukDate(); };
  let timer = 0, open = null;

  function css() {
    if (document.getElementById('anw-css')) return;
    const s = document.createElement('style'); s.id = 'anw-css';
    s.textContent = `
.anw-ov{position:fixed;inset:0;z-index:4800;display:flex;align-items:flex-end;justify-content:center;padding:12px 12px calc(14px + env(safe-area-inset-bottom));background:rgba(0,0,0,.45);font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;animation:anw-fade .25s ease}
@keyframes anw-fade{from{opacity:0}to{opacity:1}}
.anw-card{position:relative;width:100%;max-width:380px;background:linear-gradient(180deg,rgba(14,12,6,.98),rgba(5,6,9,.98));border:1px solid #d4af37;border-radius:18px;padding:18px 16px 14px;text-align:center;color:#e9e3cf;
  box-shadow:0 0 0 4px rgba(212,175,55,.08),0 0 34px rgba(255,61,154,.22);animation:anw-up .35s cubic-bezier(.2,.8,.3,1)}
@keyframes anw-up{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
.anw-card img{width:62px;height:62px;border-radius:50%;box-shadow:0 0 0 2px #d4af37,0 0 16px rgba(255,61,154,.4);margin-top:-46px;background:#05070a}
.anw-card h2{margin:8px 0 4px;font-family:Georgia,"Times New Roman",serif;color:#f3d77a;font-size:19px;letter-spacing:.05em}
.anw-card p{margin:4px 4px 0;font-size:14.5px;line-height:1.45;color:#d9d2bc}
.anw-sub{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;margin-top:14px;border-radius:13px;border:1px solid #f3d77a;background:linear-gradient(180deg,#f0cf5f,#a47c1f);color:#120e02;font-weight:900;font-size:16px;letter-spacing:.08em;text-decoration:none;box-shadow:0 0 16px rgba(243,215,122,.35)}
.anw-sub:focus-visible,.anw-later:focus-visible,.anw-x:focus-visible{outline:3px solid #ff8cc4;outline-offset:2px}
.anw-later{margin-top:8px;background:none;border:0;color:#b9a35c;font:inherit;font-size:13.5px;text-decoration:underline;padding:8px 14px;cursor:pointer}
.anw-f{display:flex;flex-direction:column;gap:8px;margin-top:12px}
.anw-f input{width:100%;box-sizing:border-box;min-height:46px;padding:10px 14px;border-radius:13px;border:1px solid rgba(212,175,55,.55);background:#0b0d10;color:#f3d77a;font-size:16px;outline:none}
.anw-f input:focus{box-shadow:0 0 0 3px rgba(212,175,55,.22)}
.anw-f .anw-sub{margin-top:0;cursor:pointer;font-family:inherit}
.anw-f .anw-sub:disabled{opacity:.7}
.anw-msg{font-size:13.5px;margin-top:8px;line-height:1.4}.anw-msg:empty{display:none}.anw-msg.ok{color:#f3d77a;font-weight:700}.anw-msg.err{color:#ff8a7a}
.anw-alt{display:inline-block;margin-top:6px;font-size:12px;color:#8f8566}
.anw-x{position:absolute;right:8px;top:8px;width:34px;height:34px;border-radius:50%;border:1px solid rgba(212,175,55,.5);background:rgba(0,0,0,.4);color:#f3d77a;font-size:15px;cursor:pointer}`;
    document.head.appendChild(s);
  }
  function base() { const s = document.currentScript || [...document.scripts].find(x => /shared\/newsletter\.js/.test(x.src)); return s ? s.src.replace(/newsletter\.js.*$/, '') : '../shared/'; }
  const BASE = base();

  function show() {
    if (open || !allowed()) return false;
    css(); put({ last: ukDate() });
    const prev = document.activeElement;
    const ov = document.createElement('div'); ov.className = 'anw-ov'; ov.id = 'anonNews';
    ov.innerHTML = '<div class="anw-card" role="dialog" aria-modal="true" aria-labelledby="anw-t" aria-describedby="anw-d">' +
      '<button class="anw-x" type="button" aria-label="Close">✕</button>' +
      '<img src="' + BASE + '../assets/logo.webp" alt="">' +
      '<h2 id="anw-t">New games by email</h2>' +
      '<p id="anw-d">Get new games and the weekly top scores by email, plus ANON news. Free, unsubscribe any time.</p>' +
      '<form class="anw-f" novalidate><input type="email" name="email_address" placeholder="Your email address" aria-label="Your email address" autocomplete="email" required>' +
      '<button class="anw-sub" type="submit">SUBSCRIBE</button></form>' +
      '<div class="anw-msg" aria-live="polite"></div>' +
      '<button class="anw-later" type="button">Maybe later</button><br><a class="anw-alt" href="' + URL_SUB + '" target="_blank" rel="noopener">or open the sign-up page</a></div>';
    const close = () => { if (!open) return; ov.remove(); document.removeEventListener('keydown', key, true); open = null; try { prev && prev.focus && prev.focus({ preventScroll: true }); } catch (e) {} };
    const key = e => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); return; }
      if (e.key === 'Tab') { const f = [...ov.querySelectorAll('a,button,input')]; const i = f.indexOf(document.activeElement);
        if (i < 0) { e.preventDefault(); f[0].focus(); } else if (e.shiftKey && i === 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
      else e.stopPropagation();             // keep game keyboard shortcuts out while the pop-up is open
    };
    ov.querySelector('.anw-x').onclick = close;
    ov.querySelector('.anw-later').onclick = close;
    ov.querySelector('.anw-alt').addEventListener('click', () => { put({ snooze: Date.now() + 30 * DAY }); setTimeout(close, 50); });
    const form = ov.querySelector('.anw-f'), inp = form.querySelector('input'), btn = form.querySelector('button'), msg = ov.querySelector('.anw-msg');
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(inp.value.trim())) { msg.className = 'anw-msg err'; msg.textContent = 'Please enter a valid email address.'; inp.focus(); return; }
      btn.disabled = true; btn.textContent = 'SENDING…'; msg.className = 'anw-msg'; msg.textContent = '';
      const fd = new FormData(); fd.append('email_address', inp.value.trim());
      fetch(URL_POST, { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
        .then(r => r.json().catch(() => ({})).then(d => ({ ok: r.ok, d })))
        .then(x => { if (!(x.ok && (!x.d.status || x.d.status === 'success'))) throw 0;
          put({ subscribed: true, snooze: Date.now() + 365 * DAY }); form.style.display = 'none';
          msg.className = 'anw-msg ok'; msg.textContent = 'Nearly there! Check your inbox to confirm your subscription.';
          ov.querySelector('.anw-later').textContent = 'Close'; })
        .catch(() => { msg.className = 'anw-msg err'; msg.textContent = 'Something went wrong. Please check your email address and try again.'; btn.disabled = false; btn.textContent = 'SUBSCRIBE'; });
    });
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    document.addEventListener('keydown', key, true);
    document.body.appendChild(ov); open = ov;
    setTimeout(() => { try { ov.querySelector('.anw-later').focus({ preventScroll: true }); } catch (e) {} }, 60);   // no auto-focus on the email box: the phone keyboard would pop up
    return true;
  }

  /* ---------- "Meet the ANONs": a small link to the ANON NFT collections on every game-over screen ----------
     Goes inside the game's own result card (kit modal #kmodal, or next to #lbMsg / #wLB). If a game has no
     such card, a small pill shows in the bottom-right corner for 12 s (at most once every 5 minutes) and
     goes away on the next tap or key. Opens anonnfts.com/collections in a new tab. ANON_MEET_OFF: test hook. */
  const URL_MEET = 'https://anonnfts.com/collections';
  let meetTimer = 0, meetPill = null, meetPillAt = 0;
  function meetCSS() {
    if (document.getElementById('anm-css')) return;
    const s = document.createElement('style'); s.id = 'anm-css';
    s.textContent = `
.anm-row{display:block;width:100%;text-align:center;margin:10px 0 0;clear:both}
.anm-a{display:inline-block;padding:6px 12px;border-radius:999px;border:1px solid rgba(212,175,55,.55);background:rgba(5,7,10,.55);color:#f3d77a;font:700 12.5px system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;letter-spacing:.04em;text-decoration:none;line-height:1.3}
.anm-a:hover{border-color:#f3d77a}.anm-a:focus-visible{outline:3px solid #ff8cc4;outline-offset:2px}
.anm-pill{position:fixed;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:4700;box-shadow:0 0 12px rgba(212,175,55,.25);background:rgba(5,7,10,.92);animation:anw-fade .25s ease}
html.anon-home-on .anm-pill{bottom:calc(44px + env(safe-area-inset-bottom))}
@keyframes anw-fade{from{opacity:0}to{opacity:1}}`;
    document.head.appendChild(s);
  }
  function meetLink(extra) {
    const a = document.createElement('a'); a.className = 'anm-a' + (extra ? ' ' + extra : '');
    a.href = URL_MEET; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Meet the ANONs \u2192';
    a.setAttribute('aria-label', 'Meet the ANONs: see the ANON NFT collections on anonnfts.com (opens in a new tab)');
    return a;
  }
  const shown = n => !!(n && n.isConnected && (n.offsetParent !== null || getComputedStyle(n).position === 'fixed') && getComputedStyle(n).visibility !== 'hidden');
  function meetHost() {
    const km = document.querySelector('#kmodal.show .mcard');
    if (km && shown(km)) return { card: km };
    const lb = document.getElementById('lbMsg') || document.getElementById('wLB');
    if (lb && shown(lb) && lb.parentNode) return { after: lb };
    return null;
  }
  function meetInCard(h) {
    const box = h.card || h.after.parentNode;
    if (box.querySelector('.anm-row')) return true;
    meetCSS();
    const row = document.createElement('div'); row.className = 'anm-row'; row.appendChild(meetLink());
    if (h.card) h.card.appendChild(row); else box.appendChild(row);
    return true;
  }
  function meetFloat() {
    if (meetPill || Date.now() - meetPillAt < 300000) return;
    meetCSS(); meetPillAt = Date.now();
    const a = meetLink('anm-pill'); document.body.appendChild(a); meetPill = a;
    const t0 = Date.now();
    const gone = () => { if (!meetPill) return; meetPill.remove(); meetPill = null; clearTimeout(tm);
      document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('keydown', onDown, true); };
    const onDown = e => { if (e.target === a || Date.now() - t0 < 1200) return; gone(); };
    const tm = setTimeout(gone, 12000);
    document.addEventListener('pointerdown', onDown, true); document.addEventListener('keydown', onDown, true);
  }
  function meet() {
    try {
      if (window.ANON_MEET_OFF) return;
      clearTimeout(meetTimer);
      const until = Date.now() + 6000;
      const tick = () => {
        try { const h = meetHost(); if (h) { meetInCard(h); return; } } catch (e) {}
        if (Date.now() < until) meetTimer = setTimeout(tick, 400); else { try { meetFloat(); } catch (e) {} }
      };
      meetTimer = setTimeout(tick, 250);
    } catch (e) {}
  }
  // call when a game ends. opts.delay = ms after the end (default 2600)
  function gameOver(opts) {
    opts = opts || {};
    meet();                                                    // "Meet the ANONs" link on the result screen
    if (window.ANON_NEWS_OFF) return;                          // ANON_NEWS_OFF: test hook
    const now = Date.now(), last = st().lastOver || 0, n = (st().overs || 0) + (now - last > 5000 ? 1 : 0);
    put({ overs: n, lastOver: now });                          // count game overs per device (double calls within 5 s count once)
    if (n < MIN_GAMES || !allowed()) return;
    const promptedAt = () => window.__anonNickPromptAt || 0;
    if (now - promptedAt() < 60000) return;                    // a name prompt already showed for this game over
    clearTimeout(timer);
    const deadline = Date.now() + 180000;
    const tryShow = () => {
      if (!allowed() || open) return;
      if (Date.now() - promptedAt() < 60000) return;      // name prompt appeared after this game ended: skip this time
      if (document.querySelector('.alb-ov') && Date.now() < deadline) { timer = setTimeout(tryShow, 700); return; } // leaderboard open
      if (Date.now() < deadline) show();
    };
    timer = setTimeout(tryShow, window.ANON_NEWS_DELAY != null ? window.ANON_NEWS_DELAY : opts.delay == null ? 2600 : opts.delay);
  }
  window.ANONNews = { gameOver, meet, show, allowed, close: () => open && open.querySelector('.anw-later').click(), isOpen: () => !!open, url: URL_SUB, _key: K };
})();
