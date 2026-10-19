/* ANON Galaxy Pinball · original sound effects, generated live with WebAudio (no audio files).
   Silent until the first tap or key press (no autoplay); the 🔊 button mutes and the choice is remembered. */
(function () {
  'use strict';
  const K = 'anonPB.mute'; let ctx = null, out = null, noiseBuf = null, muted = false, lastWall = 0;
  try { muted = JSON.parse(localStorage.getItem(K) || 'false'); } catch (e) {}
  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); const comp = ctx.createDynamicsCompressor(); out = ctx.createGain(); out.gain.value = muted ? 0 : 0.55;
    out.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const ready = () => ctx && !muted && ctx.state === 'running';
  function tone(type, f0, f1, dur, vol, delay) {
    if (!ready()) return; const t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, ftype, f0, f1, delay) {
    if (!ready()) return; const t = ctx.currentTime + (delay || 0), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = ftype || 'bandpass'; f.frequency.setValueAtTime(f0 || 1500, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = 1.2;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + dur + 0.02);
  }
  const arp = (notes, step, type, vol, dur) => notes.forEach((n, i) => tone(type || 'triangle', n, n, dur || 0.18, vol || 0.16, i * step));
  const FX = {
    flip: () => { noise(0.05, 0.25, 'bandpass', 2400); tone('sine', 120, 60, 0.07, 0.25); },
    flipHit: () => tone('sine', 200, 90, 0.06, 0.18),
    bumper: e => { const f = [740, 880, 988][(e && e.i) || 0]; tone('sine', f, f / 2, 0.16, 0.22); tone('triangle', f * 2, f, 0.08, 0.08); },
    sling: () => { tone('square', 320, 140, 0.07, 0.09); noise(0.04, 0.15, 'highpass', 3000); },
    target: () => { noise(0.08, 0.3, 'lowpass', 700); tone('sine', 170, 110, 0.1, 0.25); },
    bank: () => arp([523, 659, 784, 1046], 0.07, 'square', 0.07, 0.16),
    lane: e => { const n = [587, 659, 784, 880][(e && e.i) || 0]; tone('triangle', n, n, 0.12, 0.14); tone('triangle', n * 1.5, n * 1.5, 0.14, 0.1, 0.06); },
    spell: () => arp([523, 659, 784, 988, 1175], 0.06, 'triangle', 0.15, 0.2),
    orbit: () => { tone('sawtooth', 180, 1400, 0.45, 0.07); noise(0.4, 0.12, 'bandpass', 400, 4000); },
    jackpot: () => { arp([392, 523, 659, 784, 1046, 1318], 0.08, 'square', 0.08, 0.22); noise(0.6, 0.08, 'highpass', 6000, 9000, 0.3); },
    launch: e => { noise(0.35, 0.25 + 0.2 * ((e && e.power) || 0), 'bandpass', 300, 2600); tone('sine', 90, 50, 0.15, 0.25); },
    drain: () => { tone('triangle', 420, 60, 0.8, 0.2); tone('sine', 210, 40, 0.9, 0.12, 0.05); },
    saved: () => arp([440, 554, 659, 880], 0.07, 'triangle', 0.16, 0.18),
    mission: () => { arp([523, 659, 784, 1046], 0.11, 'triangle', 0.18, 0.3); arp([1046, 1318, 1568], 0.11, 'sine', 0.08, 0.3); },
    multiball: () => arp([262, 330, 392, 523, 392, 523, 659, 784], 0.09, 'square', 0.08, 0.2),
    skill: () => arp([784, 988, 1175, 1568], 0.05, 'sine', 0.16, 0.2),
    tilt: () => { tone('square', 70, 60, 0.7, 0.14); tone('square', 74, 62, 0.7, 0.1); },
    tiltWarn: () => tone('square', 110, 100, 0.25, 0.12),
    nudge: () => { noise(0.12, 0.3, 'lowpass', 220); tone('sine', 70, 40, 0.15, 0.3); },
    wallHit: () => { const n = performance.now(); if (n - lastWall < 60) return; lastWall = n; noise(0.03, 0.08, 'bandpass', 1800); },
    ball: () => arp([392, 523], 0.1, 'triangle', 0.12, 0.2),
    gameover: () => arp([523, 466, 392, 330, 262], 0.16, 'triangle', 0.16, 0.35),
    start: () => arp([262, 392, 523], 0.08, 'triangle', 0.12, 0.2),
    pull: () => tone('sine', 140, 140, 0.05, 0.05)
  };
  window.PBSound = {
    unlock, play(type, e) { const f = FX[type]; if (f) try { f(e); } catch (x) {} },
    isMuted: () => muted, hasAudio: () => !!ctx, state: () => ctx ? ctx.state : 'none',
    setMuted(m) { muted = !!m; try { localStorage.setItem(K, JSON.stringify(muted)); } catch (e) {} if (out) out.gain.value = muted ? 0 : 0.55; return muted; },
    toggle() { return this.setMuted(!muted); }
  };
})();
