/* =====================================================================
   ANON Arcade · shared end-of-game newsletter pop-up (newsletter.js)
   Every game calls ANONNews.gameOver() when a game ends (win or loss).
   - shows a beat after the game's own result screen (default 2.6 s)
   - waits while a nickname prompt / leaderboard (.alb-ov) is open
   - at most once per day per device (UK date); never again after Subscribe
   ===================================================================== */
(function () {
  'use strict';
  if (window.ANONNews) return;
  const URL_SUB = 'https://anon-nfts.kit.com/ba58d6d746';
  const K = 'anonNews.v1';
  const st = () => { try { return JSON.parse(localStorage.getItem(K)) || {}; } catch (e) { return {}; } };
  const put = v => { try { localStorage.setItem(K, JSON.stringify(Object.assign(st(), v))); } catch (e) {} };
  const ukDate = () => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } };
  const allowed = () => { const s = st(); return !s.subscribed && s.last !== ukDate(); };
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
      '<h2 id="anw-t">Stay in the loop 🥷</h2>' +
      '<p id="anw-d">Keep up to date with all the latest ANON news. Subscribe to the ANON NFTs newsletter.</p>' +
      '<a class="anw-sub" href="' + URL_SUB + '" target="_blank" rel="noopener">SUBSCRIBE</a>' +
      '<button class="anw-later" type="button">Maybe later</button></div>';
    const close = () => { if (!open) return; ov.remove(); document.removeEventListener('keydown', key, true); open = null; try { prev && prev.focus && prev.focus({ preventScroll: true }); } catch (e) {} };
    const key = e => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); return; }
      if (e.key === 'Tab') { const f = [...ov.querySelectorAll('a,button')]; const i = f.indexOf(document.activeElement);
        if (i < 0) { e.preventDefault(); f[0].focus(); } else if (e.shiftKey && i === 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
      else e.stopPropagation();             // keep game keyboard shortcuts out while the pop-up is open
    };
    ov.querySelector('.anw-x').onclick = close;
    ov.querySelector('.anw-later').onclick = close;
    ov.querySelector('.anw-sub').addEventListener('click', () => { put({ subscribed: true }); setTimeout(close, 50); });
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    document.addEventListener('keydown', key, true);
    document.body.appendChild(ov); open = ov;
    setTimeout(() => { try { ov.querySelector('.anw-sub').focus({ preventScroll: true }); } catch (e) {} }, 60);
    return true;
  }
  // call when a game ends. opts.delay = ms after the end (default 2600)
  function gameOver(opts) {
    opts = opts || {};
    if (window.ANON_NEWS_OFF || !allowed()) return;          // ANON_NEWS_OFF: test hook
    clearTimeout(timer);
    const deadline = Date.now() + 180000;
    const tryShow = () => {
      if (!allowed() || open) return;
      if (document.querySelector('.alb-ov') && Date.now() < deadline) { timer = setTimeout(tryShow, 700); return; } // nickname prompt / leaderboard open
      if (Date.now() < deadline) show();
    };
    timer = setTimeout(tryShow, window.ANON_NEWS_DELAY != null ? window.ANON_NEWS_DELAY : opts.delay == null ? 2600 : opts.delay);
  }
  window.ANONNews = { gameOver, show, allowed, close: () => open && open.querySelector('.anw-later').click(), isOpen: () => !!open, url: URL_SUB, _key: K };
})();
