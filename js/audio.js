// ===== 効果音とBGM（WebAudioで合成）=====
'use strict';
window.Sfx = (function () {
  let ctx = null, master, sfxBus, bgmBus, muted = false, bgmOn = false, bgmTimer = null, step = 0;
  let deaf = false, vol = { m: 0.7, b: 0.28, s: 0.9 };
  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = vol.m; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = vol.s; sfxBus.connect(master);
    bgmBus = ctx.createGain(); bgmBus.gain.value = vol.b; bgmBus.connect(master);
  }
  function noiseBuf(dur) {
    const b = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  let NB = null;
  function noise(dur, f0, f1, vol, type = 'bandpass', bus = sfxBus) {
    if (!NB) NB = noiseBuf(1.5);
    const s = ctx.createBufferSource(); s.buffer = NB;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = 1.2;
    const g = ctx.createGain(); const t = ctx.currentTime;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function tone(f0, f1, dur, vol, type = 'sine', delay = 0, bus = sfxBus) {
    const o = ctx.createOscillator(), g = ctx.createGain(); const t = ctx.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }
  const S = {
    hit: () => { tone(180, 60, 0.12, 0.6, 'sine'); noise(0.08, 3000, 800, 0.35); },
    hit2: () => { tone(140, 40, 0.22, 0.8, 'sine'); noise(0.15, 2500, 300, 0.5); tone(90, 40, 0.25, 0.4, 'square'); },
    swing: () => noise(0.12, 600, 2400, 0.18),
    swing2: () => noise(0.2, 400, 3000, 0.28),
    jump: () => tone(300, 620, 0.12, 0.18, 'triangle'),
    dash: () => noise(0.18, 1200, 300, 0.25, 'lowpass'),
    grab: () => tone(500, 300, 0.08, 0.25, 'square'),
    throw: () => { noise(0.3, 300, 2000, 0.35); tone(400, 120, 0.3, 0.2, 'sawtooth'); },
    ledge: () => tone(700, 500, 0.06, 0.15, 'square'),
    climb: () => tone(400, 800, 0.12, 0.18, 'triangle'),
    ko: () => { tone(120, 30, 0.8, 0.9, 'sine'); noise(0.9, 2000, 80, 0.6, 'lowpass'); tone(900, 1800, 0.4, 0.15, 'triangle', 0.1); },
    stun: () => { for (let i = 0; i < 4; i++) tone(1200 + i * 200, 1000 + i * 200, 0.08, 0.12, 'triangle', i * 0.07); },
    status: () => { tone(800, 200, 0.2, 0.18, 'sawtooth'); tone(1200, 400, 0.2, 0.1, 'square', 0.03); },
    skill: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.18, 0.18, 'triangle', i * 0.05)); },
    pickup: () => { tone(880, 880, 0.07, 0.2, 'square'); tone(1320, 1320, 0.1, 0.2, 'square', 0.07); },
    ar: () => { noise(0.06, 4000, 1500, 0.35, 'highpass'); tone(200, 80, 0.06, 0.3, 'square'); },
    sr: () => { noise(0.4, 3000, 200, 0.7); tone(120, 30, 0.4, 0.8, 'sine'); },
    sg: () => { noise(0.35, 1800, 100, 0.9, 'lowpass'); tone(90, 30, 0.3, 0.8, 'sine'); },
    mars: () => { tone(55, 50, 2.5, 0.8, 'sawtooth'); tone(82, 80, 2.5, 0.5, 'sawtooth'); noise(2.5, 200, 60, 0.4, 'lowpass'); },
    slam: () => { tone(70, 25, 0.5, 0.9, 'sine'); noise(0.5, 600, 60, 0.6, 'lowpass'); },
    start: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, f, 0.25, 0.25, 'square', i * 0.12)); },
    end: () => { [784, 659, 523, 784, 1046].forEach((f, i) => tone(f, f, 0.3, 0.25, 'triangle', i * 0.15)); },
    phase: () => { tone(220, 110, 0.6, 0.4, 'sawtooth'); tone(330, 165, 0.6, 0.3, 'sawtooth', 0.15); },
    blackout: () => { tone(400, 40, 0.8, 0.4, 'sawtooth'); },
    bike: () => { tone(80, 160, 0.8, 0.4, 'sawtooth'); },
    beat: () => tone(1500, 1500, 0.04, 0.15, 'square'),
    deny: () => tone(200, 150, 0.12, 0.2, 'square'),
    click: () => tone(900, 900, 0.04, 0.15, 'square'),
  };
  function play(n) {
    if (!ctx || muted || deaf) return;
    if (S[n]) try { S[n](); } catch (e) { /* noop */ }
  }
  // BGM：120BPMのループ（音楽ボットのビートと同期）
  const bass = [55, 55, 65.4, 55, 73.4, 73.4, 65.4, 49];
  const lead = [440, 0, 523, 587, 659, 0, 587, 523, 440, 0, 392, 440, 523, 0, 0, 0];
  function bgmTick() {
    if (!ctx || muted || !bgmOn) return;
    const s = step++;
    const b = s % 4 === 0;
    if (b) tone(60, 40, 0.18, 0.9, 'sine', 0, bgmBus);
    if (s % 4 === 2) noise(0.12, 4000, 2000, 0.25, 'bandpass', bgmBus);
    if (s % 2 === 1) noise(0.03, 9000, 7000, 0.12, 'highpass', bgmBus);
    if (s % 2 === 0) tone(bass[(s >> 2) % 8] * 2, bass[(s >> 2) % 8] * 2, 0.22, 0.35, 'sawtooth', 0, bgmBus);
    const l = lead[s % 16]; if (l && (s >> 4) % 2 === 1) tone(l, l, 0.14, 0.08, 'square', 0, bgmBus);
  }
  function bgm(on) {
    bgmOn = on;
    if (on && !bgmTimer) bgmTimer = setInterval(bgmTick, 125);
    if (!on && bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  }
  function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : vol.m; return muted; }
  function setVolumes(m, b, sv) { vol = { m: m / 100, b: (b / 100) * 0.7, s: sv / 100 }; if (master) { master.gain.value = muted ? 0 : vol.m; bgmBus.gain.value = deaf ? vol.b * 0.15 : vol.b; sfxBus.gain.value = vol.s; } }
  function setDeaf(d) { if (d === deaf) return; deaf = d; if (bgmBus) bgmBus.gain.value = d ? vol.b * 0.15 : vol.b; }
  return { init, play, bgm, toggleMute, setDeaf, setVolumes };
})();
