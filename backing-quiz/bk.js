/* ANON Arcade · backing-games helper (bk.js): browser-made sound after the first tap, auto-pause, risk line, fact cards.
   Copied into each backing game folder. Facts follow anonnfts.com/check-backing-on-chain-1 (at the time of writing). */
(function () {
  'use strict';
  const RISK = "NFTs and cryptoassets are high-risk. Backing doesn't guarantee any resale price. Not financial advice.";
  const LINK = 'https://anonnfts.com/check-backing-on-chain-1';
  const riskHTML = () => '<p class="bk-risk">' + RISK + ' <a href="' + LINK + '" target="_top" rel="noopener">How to check backing on-chain →</a></p>';
  // short, checkable facts used on level-end and game-over cards
  const FACTS = [
    'ANON collections are backed by at least 50% of mint price in FUSD at mint. Check it on-chain.',
    'ANON backing pools are held in the Liquid NFT Marketplace contracts. You can look them up yourself.',
    'Floor price is a listing price set by sellers. It is not the same thing as the liquidity held against an NFT.',
    'On a block explorer, a mint usually shows as a transfer from the zero address to the buyer.',
    'You do not need to connect a wallet just to look at on-chain records. Looking is read-only.',
    'Screenshots can be edited. The live block explorer record cannot.',
    'Most ANON collections are on Polygon. ANON Apes were minted on the BESC blockchain.',
    'The ANON Proof of Work page logs liquidity boosts so you can cross-check them on-chain.',
    'Check the chain first: a Polygon contract address will not show up on the BESC explorer.',
    'A redemption often shows on-chain as a burn: a transfer to the zero address or a burn address.',
    'Type explorer and marketplace addresses yourself or use bookmarks. Fake look-alike sites exist.',
    'Backing figures change over time. Check the live record rather than trusting an old number.'
  ];
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
               set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  /* ---- sound: nothing is created until the first tap / key ---- */
  let ac = null, master = null, muted = ls.get('anonBK.muted', false);
  function unlock() { if (ac) { if (ac.state === 'suspended') ac.resume().catch(() => {}); return; }
    try { const A = window.AudioContext || window.webkitAudioContext; if (!A) return; ac = new A(); master = ac.createGain(); master.gain.value = muted ? 0 : .5; master.connect(ac.destination); } catch (e) { ac = null; } }
  ['pointerdown', 'keydown', 'touchstart'].forEach(t => window.addEventListener(t, unlock, { capture: true, passive: true }));
  function tone(f, d, o) { o = o || {}; if (!ac || muted || ac.state !== 'running') return; const t0 = ac.currentTime + (o.at || 0);
    const osc = ac.createOscillator(), g = ac.createGain(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + d); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(o.vol || .25, t0 + .01);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + d); osc.connect(g); g.connect(master); osc.start(t0); osc.stop(t0 + d + .05); }
  function noise(d, vol) { if (!ac || muted || ac.state !== 'running') return; const n = Math.floor(ac.sampleRate * d), b = ac.createBuffer(1, n, ac.sampleRate), c = b.getChannelData(0);
    for (let i = 0; i < n; i++) c[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = ac.createBufferSource(), g = ac.createGain(); g.gain.value = vol || .2; s.buffer = b; s.connect(g); g.connect(master); s.start(); }
  const SFX = {
    good: () => { tone(660, .09, { type: 'triangle' }); tone(990, .14, { type: 'triangle', at: .07 }); },
    bad: () => { tone(220, .22, { type: 'sawtooth', to: 110, vol: .16 }); },
    pop: () => { noise(.08, .25); tone(880, .06, { type: 'square', vol: .08, to: 1400 }); },
    tick: () => tone(1200, .03, { type: 'square', vol: .06 }),
    turn: () => tone(520, .04, { type: 'triangle', vol: .12 }),
    drop: () => { tone(180, .12, { type: 'triangle', to: 90, vol: .3 }); },
    perfect: () => { tone(784, .08, { type: 'triangle' }); tone(1175, .12, { type: 'triangle', at: .06 }); tone(1568, .16, { type: 'triangle', at: .12 }); },
    jump: () => tone(400, .12, { type: 'square', vol: .07, to: 800 }),
    win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, .18, { type: 'triangle', at: i * .1 })); },
    lose: () => { [392, 330, 262].forEach((f, i) => tone(f, .22, { type: 'sawtooth', vol: .12, at: i * .14 })); }
  };
  const play = k => { try { SFX[k] && SFX[k](); } catch (e) {} };
  function muteBtn(btn) { if (!btn) return; const paint = () => { btn.textContent = muted ? '🔇' : '🔊'; btn.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on'); };
    paint(); btn.onclick = () => { muted = !muted; ls.set('anonBK.muted', muted); if (master) master.gain.value = muted ? 0 : .5; paint(); }; }
  /* ---- auto-pause: tab hidden or window loses focus ---- */
  function autoPause(o) { // {running:()=>bool, pause:()=>void, resume:()=>void, host:Element}
    let ov = null, paused = false;
    const show = () => { if (paused || !o.running()) return; paused = true; o.pause();
      if (!ov) { ov = document.createElement('div'); ov.className = 'bk-pause'; ov.innerHTML = '<div><b>Paused</b><br>Tap to carry on</div>'; ov.onclick = () => hide(); }
      (o.host || document.body).appendChild(ov); };
    const hide = () => { if (!paused) return; paused = false; ov && ov.remove(); o.resume(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) show(); });
    window.addEventListener('blur', () => show());
    return { show, hide, get paused() { return paused; } };
  }
  function factHTML(i) { const f = typeof i === 'string' ? i : FACTS[(i == null ? Math.floor(Math.random() * FACTS.length) : i) % FACTS.length];
    return '<div class="bk-fact"><b>Fact check ✔</b>' + f + '</div>'; }
  // end screen = kit modal + fact card + risk line (always)
  function end(o) { const AK = window.AK; return AK.modal(Object.assign({}, o, { text: (o.text || '') + (o.fact === false ? '' : factHTML(o.fact)) + riskHTML() })); }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  window.BK = { RISK, LINK, riskHTML, FACTS, factHTML, end, play, tone, muteBtn, autoPause, esc, ls, audioState: () => ac ? ac.state : 'none' };
})();
