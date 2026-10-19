/* ANON Arcade board-game kit: helpers shared by chess, checkers, minesweeper and hearts. Art: assets/nft (AnonNfts.com collections). */
(function () {
  'use strict';
  const B = (document.currentScript && document.currentScript.src || '').replace(/kit\.js.*$/, '');
  const ART = [
    { id: 'anon', name: 'ANON Originals' }, { id: 'apes', name: 'ANON Apes' }, { id: 'royals', name: 'ANON Apes King & Queen' },
    { id: 'aces', name: 'Aces by BESC' }, { id: 'ghost', name: 'Ghost Dead Hand Aces' }, { id: 'skulls', name: 'ANON Skulls' },
    { id: 'eyes', name: 'ANON Eyes' }, { id: 'lake', name: 'Lake District NFTs' }, { id: 'venge', name: 'Vengeance' }, { id: 'grumpy', name: 'Grumpy Cat' }
  ].map(a => Object.assign(a, { img: B + 'p-' + a.id + '.webp', cover: B + 'c-' + a.id + '.webp' }));
  const $ = s => document.querySelector(s);
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
               set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const IN_HUB = /[?&]hub=1\b/.test(location.search) || (function () { try { return window.self !== window.top; } catch (e) { return true; } })();
  if (IN_HUB) document.documentElement.classList.add('in-hub');
  let tt; const toast = (m, ms) => { let e = $('#toast'); if (!e) { e = el('div', 'toast'); e.id = 'toast'; document.body.appendChild(e); }
    e.textContent = m; e.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => e.classList.remove('show'), ms || 1700); };
  function modal(o) { // {art, title, text, lb:true, buttons:[[label, fn, alt]]}
    let m = $('#kmodal'); if (!m) { m = el('div', 'modal'); m.id = 'kmodal'; m.innerHTML = '<div class="mcard"></div>'; document.body.appendChild(m); }
    const c = m.firstChild; c.innerHTML = '';
    if (o.art) { const i = el('img', 'art'); i.src = o.art; i.alt = ''; c.appendChild(i); }
    c.appendChild(el('h2', '', o.title || ''));
    if (o.text) { const p = el('p'); p.innerHTML = o.text; c.appendChild(p); }
    if (o.lb) { const d = el('div', 'lbmsg'); d.id = 'lbMsg'; c.appendChild(d); }
    (o.buttons || []).forEach(([l, f, alt]) => { const b = el('button', 'go' + (alt ? ' alt' : ''), l); b.onclick = () => { if (!o.keep) close(); f && f(); }; c.appendChild(b); });
    m.classList.add('show'); const close = () => m.classList.remove('show'); return { close };
  }
  const closeModal = () => { const m = $('#kmodal'); if (m) m.classList.remove('show'); };
  async function post(game, score, time, moves, mode) {
    const box = $('#lbMsg'); const say = (t, ok, retry) => { if (!box) return; box.className = 'lbmsg' + (ok ? ' ok' : ''); box.textContent = t;
      if (retry) { const b = el('button', '', 'Post score'); b.onclick = () => post(game, score, time, moves, mode); box.appendChild(b); } };
    say('Score ' + score + '. Posting…');
    let r; try { r = window.ANONLB ? await window.ANONLB.submit({ game, score, time, moves, mode }) : { status: 'local', message: 'Leaderboard unavailable.' }; }
    catch (e) { r = { status: 'error', message: 'Could not reach the leaderboard.' }; }
    const retry = r.status === 'error' || r.status === 'skipped' || (r.status === 'local' && window.ANONLB && window.ANONLB.isConfigured() && !window.ANONLB.getNickname());
    say('Score ' + score + '. ' + (r.message || ''), r.status === 'online', retry); return r;
  }
  const openLB = (game, title, modeLabels, movesLabel) => window.ANONLB ? window.ANONLB.openBoard(game, { title, periods: ['day', 'all'], movesLabel: movesLabel || 'moves', modeLabels }) : toast('Leaderboard unavailable');
  const gameOver = () => { if (window.ANONNews) window.ANONNews.gameOver({ delay: 3800 }); };
  function nickLine(box) {
    if (!box || !window.ANONLB) return; const paint = () => { const n = window.ANONLB.getNickname(); box.innerHTML = ''; box.appendChild(document.createTextNode(n ? 'Playing as ' + n + ' ' : 'No leaderboard name yet ')); const b = el('button', '', n ? 'Change name' : 'Set name'); b.onclick = async () => { await window.ANONLB.promptNickname({ saveLabel: 'Save name' }); paint(); }; box.appendChild(b); };
    paint();
  }
  function seg(node, val, onPick) { node.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.v === val); b.onclick = () => { node.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); onPick(b.dataset.v); }; }); }
  function picker(node, sel, onPick, list) { node.innerHTML = ''; (list || ART).forEach(a => { const b = el('button', 'ch' + (a.id === sel ? ' on' : '')); b.type = 'button'; b.dataset.id = a.id; const i = el('img'); i.src = a.img; i.alt = a.name; b.appendChild(i); b.appendChild(el('span', '', a.name.replace(/^ANON /, ''))); b.onclick = () => { node.querySelectorAll('.ch').forEach(x => x.classList.toggle('on', x === b)); onPick(a.id); }; node.appendChild(b); }); }
  const art = id => ART.find(a => a.id === id) || ART[0];
  window.AK = { ART, art, B, $, el, ls, IN_HUB, toast, modal, closeModal, post, openLB, gameOver, nickLine, seg, picker };
})();
