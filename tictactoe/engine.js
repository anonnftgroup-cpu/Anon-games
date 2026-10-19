/* ANON Tic-Tac-Toe engine: board = array of 9 (0 empty, 1 / -1 players). Exact minimax with memo.
   Hard: plays the minimax move (preferring moves that set traps), but in quiet drawn positions it sometimes
   picks a "natural-looking" weaker move that can only be punished with a fork, so a sharp player can win now and then. */
(function (root) {
  'use strict';
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const LEVELS = {
    easy:   { winChance: 0.7, blockChance: 0.45, slip: 1 },
    medium: { winChance: 1, blockChance: 0.9, slip: 0.4 },
    hard:   { winChance: 1, blockChance: 1, slip: 0.06 }
  };
  function result(b) {
    for (const l of LINES) { const v = b[l[0]]; if (v && v === b[l[1]] && v === b[l[2]]) return { winner: v, line: l.slice() }; }
    return b.every(x => x) ? { winner: 0, line: null } : null;
  }
  const memo = new Map();
  // value for the player p about to move: > 0 win (faster = bigger), 0 draw, < 0 loss
  function negamax(b, p) {
    const k = b.join('') + p; if (memo.has(k)) return memo.get(k);
    const r = result(b); let v;
    if (r) v = r.winner === 0 ? 0 : (r.winner === p ? 1 : -1) * (10 + b.filter(x => !x).length);
    else { v = -Infinity; for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = p; v = Math.max(v, -negamax(b, -p)); b[i] = 0; } }
    memo.set(k, v); return v;
  }
  const empties = b => [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(i => !b[i]);
  const winsAt = (b, i, p) => { b[i] = p; const r = result(b); b[i] = 0; return !!(r && r.winner === p); };
  const moveValue = (b, i, p) => { b[i] = p; const v = result(b) ? -negamax(b, -p) : -negamax(b, -p); b[i] = 0; return v; };
  // how many of the opponent's replies would lose for them (traps we set)
  function traps(b, i, p) { b[i] = p; let n = 0; if (!result(b)) for (const j of empties(b)) { b[j] = -p; if (negamax(b, p) > 0) n++; b[j] = 0; } b[i] = 0; return n; }
  const oppCanWinNext = (b, i, p) => { b[i] = p; const x = empties(b).some(j => winsAt(b, j, -p)); b[i] = 0; return x; };
  const pickRand = (a, rand) => a[Math.floor(rand() * a.length)];
  function bestByTraps(b, list, p, rand) { let m = -1, out = []; for (const i of list) { const t = traps(b, i, p); if (t > m) { m = t; out = [i]; } else if (t === m) out.push(i); } return pickRand(out, rand); }

  function chooseMove(board, p, opts) {
    opts = opts || {}; const L = LEVELS[opts.level || 'hard'], rand = opts.rand || Math.random, b = board.slice(), E = empties(b);
    if (!E.length || result(b)) return { cell: -1 };
    const win = E.filter(i => winsAt(b, i, p)), block = E.filter(i => winsAt(b, i, -p));
    if (win.length && rand() < L.winChance) return { cell: pickRand(win, rand), reason: 'win' };
    if (block.length && rand() < L.blockChance) return { cell: pickRand(block, rand), reason: 'block' };
    if (opts.level === 'easy') return { cell: pickRand(E, rand), reason: 'random' };
    const sc = E.map(i => ({ i, v: moveValue(b, i, p) })), best = Math.max(...sc.map(x => x.v));
    const bestMoves = sc.filter(x => x.v === best).map(x => x.i);
    // a slip: only in a level (drawn) position, never a move that hands over an instant win
    if (best === 0 && !block.length && rand() < L.slip) {
      const weaker = sc.filter(x => x.v < best && !oppCanWinNext(b, x.i, p)).map(x => x.i);
      if (weaker.length) return { cell: opts.level === 'hard' ? bestByTraps(b, weaker, p, rand) : pickRand(weaker, rand), reason: 'slip' };
    }
    return { cell: opts.level === 'hard' ? bestByTraps(b, bestMoves, p, rand) : pickRand(bestMoves, rand), reason: 'best' };
  }
  // perfect play (used by tests as the "strong player"): any minimax-best move
  function perfectMove(board, p, rand) { const b = board.slice(), E = empties(b), sc = E.map(i => ({ i, v: moveValue(b, i, p) })), best = Math.max(...sc.map(x => x.v));
    return pickRand(sc.filter(x => x.v === best).map(x => x.i), rand || Math.random); }
  const api = { LINES, LEVELS, result, chooseMove, perfectMove, negamax };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ANON_TTT_ENGINE = api;
})(typeof self !== 'undefined' ? self : this);
