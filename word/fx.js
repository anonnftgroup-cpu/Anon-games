/* ANON word games: crown + gold sparkle win effect, themed messages. Shared by Daily ANON Word and ANON Word Unlimited. */
window.ANONWordFX = (function () {
  'use strict';
  const WIN = ['Crowned! 👑', 'Royal genius! 👑', 'Masterful, ANON! ✨', 'A gem of a guess! 💎', 'Nice one, ANON! ✨', 'Phew! Crowned at the last! 👑'];
  const LOSE = ['The forest wins this time', 'Lost in the forest… for now', 'The hood stays on today'];
  function crown(target) {
    const r = (target || document.body).getBoundingClientRect(), fx = document.createElement('div'); fx.className = 'fx';
    const cx = r.left + r.width / 2, cy = r.top + r.height * 0.42;
    const c = document.createElement('div'); c.className = 'crown'; c.textContent = '👑'; c.style.left = cx + 'px'; c.style.top = cy + 'px'; fx.appendChild(c);
    for (let i = 0; i < 26; i++) { const s = document.createElement('i'); s.textContent = i % 3 ? '✦' : '✧'; if (i % 4 === 0) s.className = 'p';
      const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * Math.min(200, r.width * 0.8);
      s.style.left = cx + 'px'; s.style.top = cy + 'px'; s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d + 'px');
      s.style.animationDelay = (0.25 + Math.random() * 0.45) + 's'; s.style.fontSize = (11 + Math.random() * 12) + 'px'; fx.appendChild(s); }
    document.body.appendChild(fx); setTimeout(() => fx.remove(), 2300);
  }
  function shadows() { const fx = document.createElement('div'); fx.className = 'fx lose'; document.body.appendChild(fx); setTimeout(() => fx.remove(), 2100); }
  return { crown, shadows, winMsg: n => WIN[Math.max(0, Math.min(5, n - 1))], loseMsg: () => LOSE[Math.floor(Math.random() * LOSE.length)], LOSE, WIN };
})();
