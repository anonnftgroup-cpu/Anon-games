/* ANON NFT Tycoon · game logic. A fast trading game with MADE-UP NFT projects and in-game coins (not real money).
   Every balance value lives in CONFIG below: change one line to retune. Keep CONFIG.scoreCap ≤ the SQL cap (5,000) and roundSec ≤ 600. */
'use strict';
const VERSION = 'v1.0.0';
const CONFIG = {
  startCash: 100,            // in-game coins at the start (not real money)
  roundSec: 180,             // session length in game seconds (3 minutes)
  hyperAt: 30,               // last N game seconds = HYPER: clock and market speed up
  hyperClock: 1.5,           // clock speed in hyper (1.5 = the last 30 game seconds take 20 real seconds)
  tickSec: 1,                // market tick (real seconds); halved in hyper
  sellTax: 0.20,             // tax on every market sale (instant or listing fill)
  backingPct: 0.50,          // backed collections: backing per NFT at mint = 50% of mint price
  poolFeeShare: 0.50,        // share of each backed sale's tax that flows into its pool (pool never decreases)
  startCollections: 14,      // collections at the start (12-20)
  maxCollections: 20,        // cap including surprise mints
  backedShare: 0.45,         // share of collections that are backed
  priceMin: 2, priceMax: 30, // starting mint price range (coins)
  supplyBacked: [30, 150],   // NFTs per backed collection (smaller = fees grow the pool faster)
  fairPremium: 1.7,          // backed price is pulled toward this many times its backing per NFT
  volBacked: 0.035,          // per-tick volatility, backed
  volUnbacked: 0.09,         // per-tick volatility, unbacked
  backedPremium: [1.2, 1.8], // backed market price sits this many times above backing per NFT
  unbackedDecay: 0.985,      // unbacked demand multiplier per tick (demand dries up)
  backedMinDemand: 0.35,     // backed demand never drops below this
  hypeBoost: [1.25, 1.9],    // hype event price multiplier
  whaleBoost: [1.08, 1.25],  // whale buy price multiplier
  fudDrop: [0.72, 0.9],      // FUD price multiplier (backed is clamped at its backing)
  rugChance: 0.0015,          // per tick per unbacked collection (x3 for fresh unbacked mints, x2 when hyped)
  newsEvery: [2.5, 5],       // seconds between news events
  mintEvery: [18, 32],       // seconds between surprise new mints
  mintWindow: 15,            // seconds you can mint a new drop at its mint price
  bidDemandMin: 0.22,        // below this demand there are no bids: "Sell now" is off, you must list
  listFill: 0.55,            // listing fill chance per tick at full demand and at/below floor
  listPricePenalty: 6,       // how fast fill chance falls as the listing sits above the floor
  staleSec: 8,               // listing unfilled this long = "Listing stale, drop price?"
  maxBuy: 10,                // most NFTs per buy tap
  maxHoldShare: 0.4,         // you can hold at most this share of a collection's supply (market buys)
  impact: 0.015,             // your own buy/sell moves the price by this much
  comboWindow: 20,           // seconds between profitable sells to keep a streak
  comboBonus: 1,             // bonus coins per streak step (x streak, max 5)
  simSales: 2.2,             // simulated market sales per tick at full demand (drives volume and pool fees)
  scoreCap: 2500             // final net worth is capped here (best bot ≈ 430; the SQL check allows up to 5,000)
};
const NAMES = ['Pixel Possums', 'Neon Newts', 'Cosmic Crabs', 'Turbo Turtles', 'Laser Lemurs', 'Disco Dodos', 'Bubble Bats', 'Jelly Jackals', 'Quartz Quokkas', 'Mango Moths',
  'Glitch Gophers', 'Saffron Sloths', 'Ember Elks', 'Comet Corgis', 'Tidal Tapirs', 'Paper Pelicans', 'Frost Ferrets', 'Opal Otters', 'Rusty Robots', 'Waffle Wolves',
  'Static Starlings', 'Velvet Voles', 'Hype Hamsters', 'Fomo Frogs', 'Moon Rug Club', 'Pump Pals', 'Lucky Lizards', 'Shiny Snails', 'Plasma Pandas', 'Crystal Cobras'];
const FACE = ['🐹', '🐸', '🦀', '🐢', '🦇', '🦤', '🦦', '🦊', '🐙', '🦉', '🐌', '🦎', '🐼', '🤖', '👾', '🐺', '🦥', '🦩', '🐳', '🦄'];
const TABS = { trending: 'Trending', hot: 'Hot 🔥', volume: 'Top Volume', new: 'New Mints', rising: 'Rising', dead: 'Dead 💀' };
const TY = (function () {
  const R = () => Math.random(), U = (a, b) => a + (b - a) * R(), pickA = a => a[Math.floor(R() * a.length)];
  let S = null, uid = 0;
  const per = c => c.backed && c.supply > 0 ? c.pool / c.supply : 0;
  const hasBids = c => !c.dead && c.demand >= CONFIG.bidDemandMin;
  function make(born, opts) {
    const used = new Set(S.cols.map(c => c.name)); let name; do name = pickA(NAMES); while (used.has(name) && used.size < NAMES.length);
    const backed = opts && opts.backed != null ? opts.backed : R() < CONFIG.backedShare, mint = Math.round(U(CONFIG.priceMin, CONFIG.priceMax) * 2) / 2;
    const supply = backed ? Math.round(U(CONFIG.supplyBacked[0], CONFIG.supplyBacked[1])) : Math.round(U(60, 400)), c = { id: ++uid, name, face: pickA(FACE), hue: Math.floor(R() * 360), hue2: Math.floor(R() * 360), backed, mint, supply,
      pool: backed ? mint * CONFIG.backingPct * supply : 0, demand: backed ? U(.45, .8) : U(.4, .95), hype: 0, dead: false, born, checked: false, owners: Math.round(supply * U(.3, .7)), vol: 0, hist: [], flash: 0, fresh: !!(opts && opts.fresh) };
    c.price = backed ? per(c) * U(CONFIG.backedPremium[0], CONFIG.backedPremium[1]) : mint * U(.5, 2.2);
    if (opts && opts.window) { c.window = born + CONFIG.mintWindow; c.price = mint; }
    c.open = c.price; let w = c.price; const back = []; for (let i = 0; i < 30; i++) { back.push(w); w *= Math.exp((backed ? CONFIG.volBacked : CONFIG.volUnbacked) * (R() * 2 - 1)); if (backed) w = Math.max(w, per(c) * 1.02); } c.hist = back.reverse(); c.hist.push(c.price); c.vol = c.price * supply * U(.05, .3); return c;
  }
  function start() {
    uid = 0; S = { t: 0, left: CONFIG.roundSec, real: 0, cash: CONFIG.startCash, h: {}, L: [], cols: [], news: [], nextNews: 2, nextMint: U(CONFIG.mintEvery[0] * .5, CONFIG.mintEvery[1] * .6), tickAcc: 0,
      trades: 0, combo: 0, lastWin: -99, bonus: 0, over: false, shakes: 0, tipSeen: false, events: [], log: [] };
    for (let i = 0; i < CONFIG.startCollections; i++) S.cols.push(make(-1, { backed: i < Math.round(CONFIG.startCollections * CONFIG.backedShare) }));
    S.cols.sort(() => R() - .5); return S;
  }
  const say = (kind, text, c) => { S.news.unshift({ kind, text, t: S.t, cid: c && c.id }); if (S.news.length > 30) S.news.pop(); S.events.push({ kind, text, cid: c && c.id }); };
  const live = () => S.cols.filter(c => !c.dead);
  function clampBacked(c) { if (c.backed) c.price = Math.max(c.price, per(c) * 1.02); }
  function rug(c) { c.dead = true; c.price = 0; c.demand = 0; c.hist.push(0); S.L = S.L.filter(l => l.cid !== c.id); S.shakes++; say('rug', '💀 RUG PULL! ' + c.name + ' devs vanished. Price → 0', c); }
  function news() {
    const L = live(), un = L.filter(c => !c.backed), r = R();
    if (r < .3 && L.length) { const c = pickA(L); const k = U(...CONFIG.hypeBoost); c.price *= c.backed ? Math.sqrt(k) : k; c.hype = 1; c.demand = Math.min(1, c.demand + .35); clampBacked(c);
      say('hype', AP_HYPE(c), c); }
    else if (r < .52 && L.length) { const c = pickA(L); c.price *= U(...CONFIG.whaleBoost); c.demand = Math.min(1, c.demand + .15); say('whale', '🐋 Whale sweeps the ' + c.name + ' floor!', c); }
    else if (r < .78 && L.length) { const c = pickA(L); c.price *= U(...CONFIG.fudDrop); c.demand = Math.max(0, c.demand - .2); clampBacked(c); say('fud', '😱 FUD: rumours swirl around ' + c.name + (c.backed ? '. Price can\'t go under its pool in this game.' : '.'), c); }
    else if (r < .85 && un.length) { rug(pickA(un)); }
    else { const c = pickA(L.length ? L : S.cols); if (c) say('info', '📊 ' + c.name + ' owners now ' + c.owners.toLocaleString('en-GB'), c); }
  }
  function AP_HYPE(c) { return pickA(['🚀 Influencer shouts "' + c.name + ' 100x!"', '📢 ' + c.name + ' trending: "trust me bro"', '🔥 ' + c.name + ' hype train leaves the station', '✨ ' + c.name + ' "secret alpha" leak']); }
  function mintDrop() { if (S.cols.length >= CONFIG.maxCollections) return; const c = make(S.t, { window: true, fresh: true }); S.cols.push(c);
    say('mint', '🆕 NEW MINT: ' + c.name + ' at ' + c.mint + ' coins. ' + CONFIG.mintWindow + 's to mint!', c); }
  function tick() { // one market tick
    for (const c of S.cols) { if (c.dead) continue; c.flash = 0; const before = c.price;
      if (c.window && S.t < c.window) { c.price = c.mint; }
      else { if (c.window) { c.window = 0; c.price = c.mint * (c.backed ? U(1.05, 1.5) : U(.5, 2.4)); clampBacked(c); say('info', '🏁 ' + c.name + ' mint closed. Now trading at ' + c.price.toFixed(2), c); }
        const vol = c.backed ? CONFIG.volBacked : CONFIG.volUnbacked; let drift = 0;
        if (c.backed) { const fair = per(c) * (CONFIG.fairPremium + c.hype * .6); drift = (fair - c.price) / c.price * .05; c.demand = Math.max(CONFIG.backedMinDemand, Math.min(1, c.demand * .995 + U(-.03, .035))); }
        else { c.demand = Math.max(0, Math.min(1, c.demand * CONFIG.unbackedDecay + U(-.03, .02))); drift = (c.demand - .55) * .03; }
        c.price *= Math.exp(drift + vol * (R() * 2 - 1)); c.hype *= .9; clampBacked(c); if (!c.backed) c.price = Math.max(.01, c.price);
        // simulated trading: volume, and for backed collections fees flow into the pool
        const n = Math.floor(c.demand * CONFIG.simSales * U(0, 2)); if (n) { c.vol += n * c.price; if (c.backed) c.pool += n * c.price * CONFIG.sellTax * CONFIG.poolFeeShare; }
        c.owners = Math.max(5, c.owners + Math.round((c.demand - .5) * 6 + U(-2, 2)));
        if (!c.backed) { const odds = CONFIG.rugChance * (c.fresh ? 3 : 1) * (c.hype > .3 ? 2 : 1); if (R() < odds) { rug(c); continue; } } }
      c.flash = c.price > before + 1e-9 ? 1 : c.price < before - 1e-9 ? -1 : 0; c.hist.push(c.price); if (c.hist.length > 60) c.hist.shift(); }
    // your listings: buyers fill based on demand and how far you sit above the floor
    for (const l of S.L.slice()) { const c = col(l.cid); if (!c || c.dead) continue; const ratio = l.price / Math.max(.01, c.price);
      const f = ratio <= .9 ? 1 : Math.exp(-(ratio - .9) * CONFIG.listPricePenalty); l.interest = Math.max(0, Math.min(1, c.demand * f));
      if (R() < c.demand * f * CONFIG.listFill) fill(l, c); else if (S.t - l.t0 > CONFIG.staleSec) l.stale = true; }
  }
  function fill(l, c) { S.L = S.L.filter(x => x !== l); const tax = l.price * CONFIG.sellTax; S.cash += l.price - tax; if (c.backed) c.pool += tax * CONFIG.poolFeeShare;
    const h = S.h[c.id]; const basis = l.basis; S.trades++; c.vol += l.price; streak(l.price - tax - basis); say('sold', '🏷️ Your ' + c.name + ' listing sold for ' + l.price.toFixed(2) + ' (−20% tax)', c); S.lastFill = { cid: c.id, net: l.price - tax }; }
  function streak(gain) { if (gain > 0) { S.combo = S.t - S.lastWin <= CONFIG.comboWindow ? S.combo + 1 : 1; S.lastWin = S.t; if (S.combo >= 2) { const b = CONFIG.comboBonus * Math.min(5, S.combo); S.cash += b; S.bonus += b; S.lastCombo = { n: S.combo, b }; } } else S.combo = 0; }
  const col = id => S.cols.find(c => c.id === id);
  function hold(c) { return S.h[c.id] || (S.h[c.id] = { qty: 0, cost: 0 }); }
  function buy(id, n) { const c = col(id); if (!c || c.dead || S.over) return 0; let k = 0; const minting = c.window && S.t < c.window;
    const cap = Math.min(CONFIG.maxBuy, n || 1); for (; k < cap; k++) { const p = minting ? c.mint : c.price; const held = (S.h[c.id] ? S.h[c.id].qty : 0) + S.L.filter(l => l.cid === c.id).length;
      if (S.cash < p - 1e-9 || (!minting && held >= Math.floor(c.supply * CONFIG.maxHoldShare))) break; S.cash -= p; const h = hold(c); h.qty++; h.cost += p; S.trades++;
      if (minting) { c.supply++; if (c.backed) c.pool += p * CONFIG.backingPct; } else { c.price *= 1 + CONFIG.impact; c.vol += p; c.demand = Math.min(1, c.demand + .01); } }
    return k; }
  function take(c) { const h = S.h[c.id]; const avg = h.cost / h.qty; h.qty--; h.cost -= avg; if (h.qty <= 0) delete S.h[c.id]; return avg; }
  function sellNow(id) { const c = col(id); const h = c && S.h[c.id]; if (!h || !h.qty || !hasBids(c) || S.over) return 0; const p = c.price, tax = p * CONFIG.sellTax, basis = take(c);
    S.cash += p - tax; if (c.backed) c.pool += tax * CONFIG.poolFeeShare; c.price *= 1 - CONFIG.impact; clampBacked(c); c.vol += p; S.trades++; streak(p - tax - basis); return p - tax; }
  function redeem(id) { const c = col(id); const h = c && S.h[c.id]; if (!h || !h.qty || !c.backed || c.dead || S.over || c.supply < 2) return 0; const v = per(c), basis = take(c);
    S.cash += v; c.pool -= v; c.supply--; S.trades++; streak(v - basis); return v; } // pool pays exactly the backing per NFT, so backing per NFT is unchanged
  function list(id, price) { const c = col(id); const h = c && S.h[c.id]; if (!h || !h.qty || c.dead || S.over || !(price > 0)) return null; const basis = take(c);
    const l = { id: ++uid, cid: c.id, price: Math.round(price * 100) / 100, t0: S.t, basis, stale: false, interest: 0 }; S.L.push(l); return l; }
  function cancel(lid) { const l = S.L.find(x => x.id === lid); if (!l) return; S.L = S.L.filter(x => x !== l); const c = col(l.cid); if (c && !c.dead) { const h = hold(c); h.qty++; h.cost += l.basis; } }
  function relist(lid, k) { const l = S.L.find(x => x.id === lid); if (!l) return; l.price = Math.max(.01, Math.round(l.price * k * 100) / 100); l.t0 = S.t; l.stale = false; }
  function value(c, qty) { if (c.dead) return 0; const m = hasBids(c) ? c.price * (1 - CONFIG.sellTax) : 0; return qty * Math.max(m, per(c)); }
  function netWorth() { let v = S.cash; for (const id in S.h) { const c = col(+id); if (c) v += value(c, S.h[id].qty); } for (const l of S.L) { const c = col(l.cid); if (c) v += value(c, 1); } return v; }
  function step(dt) { if (!S || S.over) return; const hyper = S.left <= CONFIG.hyperAt; const clock = dt * (hyper ? CONFIG.hyperClock : 1);
    S.real += dt; S.t += clock; S.left = Math.max(0, S.left - clock); S.tickAcc += dt; const tk = CONFIG.tickSec * (hyper ? .5 : 1); let ticked = false;
    while (S.tickAcc >= tk) { S.tickAcc -= tk; tick(); ticked = true; }
    S.nextNews -= clock; if (S.nextNews <= 0) { news(); S.nextNews = U(...CONFIG.newsEvery) * (hyper ? .6 : 1); }
    S.nextMint -= clock; if (S.nextMint <= 0) { mintDrop(); S.nextMint = U(...CONFIG.mintEvery); }
    if (S.left <= 0) S.over = true; return ticked; }
  function score() { return Math.max(0, Math.min(CONFIG.scoreCap, Math.floor(netWorth()))); }
  return { start, step, tick, buy, sellNow, redeem, list, cancel, relist, netWorth, value, score, per, hasBids, col, news, mintDrop, rug, state: () => S };
})();
