/* =========================================================
   AUDIO — WebAudio synthesized placeholders (no copyrighted files).
   To use real audio later, drop files in /assets/audio and map them:
     SV.Audio.files.sword = 'assets/audio/sword.ogg';
   play() prefers a mapped file and falls back to the synth.
   ========================================================= */
SV.Audio = (function () {
  let ctx = null, master, sfxBus, ambBus, musBus, noiseBuf;
  const amb = {}; // running ambience nodes
  const files = {};
  const fileCache = {};
  let musicTimer = 0;
  // Miyako-bushi (In) scale — E F A B C — gives a traditional Japanese colour
  const SCALE = [164.81, 174.61, 220.0, 246.94, 261.63, 329.63, 349.23, 440.0, 493.88, 523.25];

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.connect(master);
    musBus = ctx.createGain(); musBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    startAmbience();
  }
  function applyVolumes() {
    if (!ctx) return;
    const s = SV.Settings ? SV.Settings.get() : { master: 0.8, sfx: 0.8, amb: 0.6, music: 0.5 };
    master.gain.value = s.master; sfxBus.gain.value = s.sfx; ambBus.gain.value = s.amb * 0.6; musBus.gain.value = s.music * 0.5;
  }
  const now = () => ctx.currentTime;
  function noise(dur, filterType, f0, f1, gain, q = 1, bus = sfxBus, delay = 0) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.Q.value = q;
    const g = ctx.createGain(); const t = now() + delay;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  function tone(freq, dur, type = 'sine', gain = 0.2, f1 = null, bus = sfxBus, delay = 0, attack = 0.005) {
    const o = ctx.createOscillator(); o.type = type; const g = ctx.createGain(); const t = now() + delay;
    o.frequency.setValueAtTime(freq, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }
  /* koto-like pluck: bright triangle through a closing lowpass */
  function pluck(freq, gain = 0.12, delay = 0, bus = musBus) {
    const o = ctx.createOscillator(); o.type = 'triangle'; const o2 = ctx.createOscillator(); o2.type = 'sawtooth';
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; const g = ctx.createGain(); const t = now() + delay;
    o.frequency.value = freq; o2.frequency.value = freq * 2.001;
    f.frequency.setValueAtTime(freq * 8, t); f.frequency.exponentialRampToValueAtTime(freq * 1.2, t + 1.2);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    const g2 = ctx.createGain(); g2.gain.value = 0.18; o2.connect(g2); g2.connect(f);
    o.connect(f); f.connect(g); g.connect(bus); o.start(t); o2.start(t); o.stop(t + 2.5); o2.stop(t + 2.5);
  }

  /* Synth library — each key is a sound category placeholder */
  const SYN = {
    swing: () => noise(0.16, 'bandpass', 700, 3200, 0.22, 2.5),
    heavy: () => { noise(0.3, 'bandpass', 300, 2000, 0.3, 2); tone(90, 0.25, 'sine', 0.2, 50); },
    hit: () => { tone(140, 0.12, 'sine', 0.35, 60); noise(0.08, 'lowpass', 2500, 400, 0.3); },
    crit: () => { tone(160, 0.18, 'sine', 0.4, 50); noise(0.12, 'highpass', 3000, 6000, 0.25); tone(1320, 0.3, 'triangle', 0.06); },
    block: () => { tone(1250, 0.22, 'triangle', 0.12); tone(1870, 0.18, 'sine', 0.08); noise(0.06, 'highpass', 4000, 6000, 0.2); },
    parry: () => { tone(1500, 0.6, 'triangle', 0.16); tone(2250, 0.5, 'sine', 0.1); tone(3000, 0.4, 'sine', 0.05); },
    dodge: () => noise(0.22, 'lowpass', 1200, 300, 0.18),
    dash: () => { noise(0.25, 'bandpass', 3000, 400, 0.25, 3); tone(400, 0.25, 'sine', 0.06, 1400); },
    step: () => noise(0.05, 'lowpass', 600, 200, 0.05),
    hurt: () => { tone(220, 0.25, 'sawtooth', 0.12, 90); noise(0.1, 'lowpass', 1500, 300, 0.25); },
    enemy_hurt: () => tone(180, 0.12, 'square', 0.05, 120),
    enemy_die: () => { tone(200, 0.6, 'sawtooth', 0.08, 50); noise(0.4, 'lowpass', 800, 100, 0.2); },
    alert: () => { tone(880, 0.12, 'triangle', 0.08); tone(1320, 0.2, 'triangle', 0.06, null, sfxBus, 0.08); },
    pickup: () => { tone(880, 0.25, 'sine', 0.1); tone(1320, 0.35, 'sine', 0.08, null, sfxBus, 0.07); },
    coin: () => { tone(1980, 0.12, 'square', 0.03); tone(2640, 0.2, 'sine', 0.06, null, sfxBus, 0.05); },
    ui: () => tone(660, 0.06, 'sine', 0.06),
    ui_open: () => { tone(440, 0.12, 'sine', 0.06); tone(660, 0.14, 'sine', 0.05, null, sfxBus, 0.04); },
    ui_close: () => { tone(660, 0.1, 'sine', 0.05); tone(440, 0.12, 'sine', 0.05, null, sfxBus, 0.04); },
    buy: () => { tone(1320, 0.1, 'square', 0.03); tone(1760, 0.25, 'sine', 0.08, null, sfxBus, 0.06); },
    error: () => tone(160, 0.2, 'square', 0.06, 120),
    puzzle_ok: () => [0, 2, 4, 7].forEach((n, i) => pluck(SCALE[n + 2], 0.16, i * 0.11, sfxBus)),
    puzzle_fail: () => { tone(110, 0.5, 'sawtooth', 0.08, 100); tone(116, 0.5, 'sawtooth', 0.08, 105); },
    puzzle_tick: () => { tone(320, 0.08, 'square', 0.04); noise(0.05, 'bandpass', 900, 600, 0.1, 5); },
    door: () => { tone(70, 0.9, 'sawtooth', 0.06, 50); noise(0.9, 'lowpass', 400, 120, 0.15); },
    drum: () => { tone(70, 0.7, 'sine', 0.55, 40); noise(0.15, 'lowpass', 600, 100, 0.3); },
    gong: () => { [1, 2.4, 3.9, 5.3].forEach((m, i) => tone(110 * m, 3 - i * 0.5, 'sine', 0.12 / (i + 1))); },
    anvil: () => { tone(1700, 0.5, 'triangle', 0.1); tone(2550, 0.4, 'sine', 0.06); noise(0.05, 'highpass', 3000, 5000, 0.3); },
    whoosh: () => noise(1.2, 'bandpass', 200, 1400, 0.25, 1.2),
    sting: () => { tone(220, 1.6, 'sawtooth', 0.05, 110); tone(233, 1.6, 'sawtooth', 0.05, 116); SYN.drum(); },
    chime: () => [7, 9, 5].forEach((n, i) => pluck(SCALE[n], 0.12, i * 0.18, sfxBus)),
  };

  function play(name) {
    if (!ctx) return;
    if (files[name]) {
      try {
        let a = fileCache[name]; if (!a) a = fileCache[name] = new Audio(files[name]);
        const c = a.cloneNode(); c.volume = (SV.Settings ? SV.Settings.get().sfx * SV.Settings.get().master : 0.6); c.play().catch(() => {}); return;
      } catch (e) { /* fall back to synth */ }
    }
    const fn = SYN[name]; if (fn) try { fn(); } catch (e) {}
  }

  /* ---------- Ambience (wind / rain / crickets) ---------- */
  function loopNoise(type, freq, q, gain) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(ambBus); src.start();
    return { src, f, g };
  }
  function startAmbience() {
    amb.wind = loopNoise('lowpass', 380, 0.7, 0);
    amb.rain = loopNoise('highpass', 1400, 0.3, 0);
    amb.fire = loopNoise('bandpass', 900, 0.6, 0);
  }
  let windT = 0, critT = 0, birdT = 0;
  function update(dt, env) {
    if (!ctx || !amb.wind) return;
    windT += dt;
    const wind = (env.wind || 0.3) * (0.7 + 0.3 * Math.sin(windT * 0.4) + 0.15 * Math.sin(windT * 1.7));
    const tc = ctx.currentTime;
    amb.wind.g.gain.setTargetAtTime(env.indoor ? 0.04 : 0.12 + wind * 0.25, tc, 0.5);
    amb.wind.f.frequency.setTargetAtTime(260 + wind * 500, tc, 0.5);
    amb.rain.g.gain.setTargetAtTime(env.rain && !env.indoor ? 0.22 : env.rain ? 0.06 : 0, tc, 0.8);
    amb.fire.g.gain.setTargetAtTime(env.fire ? Math.min(0.2, env.fire) : 0, tc, 0.4);
    // crickets at night, birds in the day
    critT -= dt; birdT -= dt;
    if (env.night && !env.indoor && critT <= 0) { critT = SV.U.rand(0.4, 1.4); for (let i = 0; i < 3; i++) tone(4200 + Math.random() * 300, 0.04, 'sine', 0.012, null, ambBus, i * 0.07); }
    if (!env.night && !env.rain && !env.indoor && birdT <= 0) { birdT = SV.U.rand(3, 8); const b = 2200 + Math.random() * 900; tone(b, 0.09, 'sine', 0.02, b * 1.3, ambBus); tone(b * 1.1, 0.12, 'sine', 0.016, b * 0.9, ambBus, 0.12); }
    // generative koto music
    musicTimer -= dt;
    if (musicTimer <= 0) {
      musicTimer = SV.U.rand(env.combat ? 1.8 : 4, env.combat ? 3 : 9);
      const base = SV.U.randi(0, 4); const n = SV.U.randi(2, 4);
      for (let i = 0; i < n; i++) pluck(SCALE[SV.U.clamp(base + SV.U.randi(-1, 3), 0, SCALE.length - 1)] * (env.combat ? 0.5 : 1), 0.07, i * SV.U.rand(0.25, 0.5));
      if (env.combat && Math.random() < 0.6) SYN.drum();
    }
  }
  return { init, play, update, applyVolumes, files, get ready() { return !!ctx; } };
})();
