/* ANON Hearts rules + AI. Cards 0-51: suit = floor(c/13) (0 clubs, 1 diamonds, 2 spades, 3 hearts), rank = c%13 + 2 (11 J, 12 Q, 13 K, 14 A). */
(function (root) {
  'use strict';
  const suit = c => Math.floor(c / 13), rank = c => c % 13 + 2;
  const QS = 2 * 13 + 10, TWO_C = 0;
  const pts = c => suit(c) === 3 ? 1 : c === QS ? 13 : 0;
  function shuffle(rnd) { const d = [...Array(52).keys()]; for (let i = 51; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d; }
  function deal(rnd) { const d = shuffle(rnd || Math.random); return [0, 1, 2, 3].map(p => d.slice(p * 13, p * 13 + 13).sort((a, b) => a - b)); }
  const passDir = hand => [1, 3, 2, 0][hand % 4]; // offset to receiver: left (+1), right (+3), across (+2), hold
  // st: { hands, trick: [{p, c}], leader, broken, first (bool: first trick), taken: [[]x4] }
  function legal(st, p) {
    const h = st.hands[p]; if (!h.length) return [];
    if (st.first && !st.trick.length) return h.includes(TWO_C) ? [TWO_C] : h;
    if (!st.trick.length) { const nonH = h.filter(c => suit(c) !== 3); return st.broken || !nonH.length ? h : nonH; }
    const led = suit(st.trick[0].c), f = h.filter(c => suit(c) === led);
    if (f.length) return f;
    if (st.first) { const clean = h.filter(c => !pts(c)); if (clean.length) return clean; }
    return h;
  }
  function winner(trick) { const led = suit(trick[0].c); let w = trick[0]; for (const t of trick) if (suit(t.c) === led && rank(t.c) > rank(w.c)) w = t; return w.p; }
  function score(taken) { const r = taken.map(t => t.reduce((a, c) => a + pts(c), 0)); const moon = r.indexOf(26); if (moon >= 0) return { pts: r.map((_, i) => i === moon ? 0 : 26), moon }; return { pts: r, moon: -1 }; }
  // ---- AI ----
  function choosePass(hand) {
    const h = hand.slice(), out = [];
    const sp = h.filter(c => suit(c) === 2), lowSp = sp.filter(c => rank(c) < 12).length;
    const val = c => { const s = suit(c), r = rank(c), n = h.filter(x => suit(x) === s).length; let v = r;
      if (c === QS) v += lowSp >= 4 ? -5 : 40; if (s === 2 && r > 12) v += lowSp >= 4 ? -4 : 30; if (s === 2 && r < 12) v -= 6;
      if (s === 3) v += 4 + (r > 10 ? 6 : 0); v += (6 - n) * 1.5; if (c === TWO_C) v -= 4; return v; };
    while (out.length < 3) { h.sort((a, b) => val(b) - val(a)); out.push(h.shift()); }
    return out;
  }
  function choosePlay(st, p, seen) {
    const L = legal(st, p); if (L.length === 1) return L[0];
    const h = st.hands[p], tr = st.trick, qsOut = !(seen && seen.has(QS)) && !h.includes(QS);
    const hi = a => a.reduce((x, y) => rank(y) > rank(x) ? y : x), lo = a => a.reduce((x, y) => rank(y) < rank(x) ? y : x);
    if (!tr.length) { // leading
      const bySuit = s => L.filter(c => suit(c) === s);
      // flush the queen: lead low spades when we don't hold Q/K/A of spades
      const sp = bySuit(2); if (qsOut && sp.length && !h.some(c => suit(c) === 2 && rank(c) >= 12)) return lo(sp);
      // otherwise lead the lowest card from a non-spade suit, preferring suits where we hold low cards
      const cand = L.filter(c => c !== QS && !(suit(c) === 2 && rank(c) > 12 && qsOut));
      const pool = cand.length ? cand : L;
      return pool.reduce((x, y) => (rank(y) - (suit(y) === 3 ? 1 : 0)) < (rank(x) - (suit(x) === 3 ? 1 : 0)) ? y : x);
    }
    const led = suit(tr[0].c), win = tr.filter(t => suit(t.c) === led).reduce((x, y) => rank(y.c) > rank(x.c) ? y : x).c;
    const trickPts = tr.reduce((a, t) => a + pts(t.c), 0), last = tr.length === 3;
    if (suit(L[0]) === led) { // following suit
      if (L.includes(QS) && rank(win) > 12) return QS;
      const under = L.filter(c => rank(c) < rank(win) && c !== QS);
      if (under.length) return hi(under);
      if (last && !trickPts) { const noQ = L.filter(c => c !== QS); return noQ.length ? hi(noQ) : L[0]; }
      if (led === 2 && qsOut) { const safe = L.filter(c => rank(c) < 12); if (safe.length) return hi(safe); }
      const noQ = L.filter(c => c !== QS); return noQ.length ? (last ? hi(noQ) : lo(noQ)) : L[0];
    }
    // void: dump
    if (L.includes(QS)) return QS;
    const bigSp = L.filter(c => suit(c) === 2 && rank(c) > 12); if (bigSp.length && qsOut) return hi(bigSp);
    const hearts = L.filter(c => suit(c) === 3); if (hearts.length) return hi(hearts);
    // dump the highest card from the shortest suit
    return L.reduce((x, y) => { const nx = h.filter(c => suit(c) === suit(x)).length, ny = h.filter(c => suit(c) === suit(y)).length; return (rank(y) * 2 - ny) > (rank(x) * 2 - nx) ? y : x; });
  }
  const API = { suit, rank, pts, QS, TWO_C, deal, passDir, legal, winner, score, choosePass, choosePlay };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.HE = API;
})(typeof window !== 'undefined' ? window : globalThis);
