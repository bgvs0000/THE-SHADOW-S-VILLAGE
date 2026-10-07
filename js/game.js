/* =========================================================
   GAME — main loop, camera, area transitions, interaction,
   exits, objective marker, boss bar, time & weather cycles.
   ========================================================= */
SV.Camera = {
  x: 0, y: 0, zoom: 1, targetZoom: 1, shakeT: 0, shakeMag: 0, ox: 0, oy: 0,
  baseZoom() { const g = SV.Game; return SV.U.clamp(Math.min(g.W, g.H * 1.5) / 900, 0.72, 1.3); },
  shake(m, d) { if (!SV.Settings.get().shake) return; this.shakeMag = Math.max(this.shakeMag, m); this.shakeT = Math.max(this.shakeT, d); },
  update(dt, P, snap) {
    const U = SV.U, cine = SV.Cine.st.cam;
    let tx, ty;
    if (cine) { tx = cine.x; ty = cine.y; }
    else { tx = P.x + Math.cos(P.facing) * 30; ty = P.y - 24 + Math.sin(P.facing) * 20; }
    const k = snap ? 1 : 1 - Math.exp(-dt * (cine ? 9 : 5));
    this.x += (tx - this.x) * k; this.y += (ty - this.y) * k;
    this.zoom += (this.targetZoom - this.zoom) * (snap ? 1 : 1 - Math.exp(-dt * 3));
    // clamp to area
    const a = SV.World.area, vw = SV.Game.W / this.zoom, vh = SV.Game.H / this.zoom;
    if (a && !cine) {
      this.x = a.w > vw ? U.clamp(this.x, vw / 2, a.w - vw / 2) : a.w / 2;
      this.y = a.h > vh ? U.clamp(this.y, vh / 2 - 40, a.h - vh / 2 + 20) : a.h / 2;
    }
    this.shakeT -= dt;
    if (this.shakeT > 0) { this.ox = (Math.random() - 0.5) * this.shakeMag * 2; this.oy = (Math.random() - 0.5) * this.shakeMag * 2; } else { this.ox = this.oy = 0; this.shakeMag = 0; }
  },
};

SV.Game = (function () {
  const U = SV.U, I = SV.Input;
  let canvas, ctx, last = 0;
  const timers = [];
  let focus = null, exitMsgT = 0, transitioning = false, weatherT = 120;
  const ADJ = { village: ['bamboo_edge', 'ren_house', 'shrine'], ren_house: ['village'], bamboo_edge: ['village', 'deep_bamboo'], deep_bamboo: ['bamboo_edge'], shrine: ['village'] };

  const G = {
    W: 0, H: 0, dpr: 1, mode: 'menu', time: 0, timeScale: 1, slowT: 0, slowScale: 1, hitstop: 0, god: false,
    init() {
      canvas = document.getElementById('game'); ctx = canvas.getContext('2d');
      resize(); window.addEventListener('resize', resize);
      I.bindCanvas(canvas); I.bindTouch();
      SV.Dialogue.bind();
      document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play' && !G.inputLocked() && !SV.Player.e.dead) SV.UI.pause(); });
      requestAnimationFrame(loop);
    },
    inputLocked() { return SV.Dialogue.active() || SV.UI.panelOpen() || SV.Cine.active || transitioning || (SV.Player.e && SV.Player.e.dead); },
    inputLockedHard() { return SV.Cine.active || transitioning; },
    after(t, fn) { timers.push({ t, fn }); },
    slow(scale, dur) { G.slowScale = scale; G.slowT = dur; },

    /** Start playing with a state object */
    start(state, opts = {}) {
      SV.state = state; state.dead = false;
      document.getElementById('menu').classList.add('hidden');
      document.getElementById('hud').classList.remove('hidden');
      G.mode = 'play';
      I.setTouch(I.touch);
      SV.Story.clearActors(); SV.Story.extraDark = 0;
      SV.Player.e = null;
      G.enterArea(state.area, state.x, state.y, { silent: true });
      if (state.hp) SV.Player.e.hp = state.hp;
      SV.Camera.zoom = SV.Camera.targetZoom = SV.Camera.baseZoom();
      SV.Camera.update(0, SV.Player.e, true);
      SV.UI.refreshHud(); SV.UI.refreshMission();
      if (opts.intro) SV.Story.intro();
      else {
        SV.UI.banner(SV.AREAS[state.area]);
        const m = SV.Missions.LIST[state.mission];
        if (m && !state.flags['started_' + m.id]) setTimeout(() => SV.Story.missionIntro(m), 1200);
      }
      document.getElementById('fade').style.opacity = 0;
    },
    enterArea(id, x, y, o = {}) {
      SV.World.load(id);
      SV.state.area = id;
      const P = SV.Player.e && G.mode === 'play' && SV.Player.e.dead === false ? SV.Player.e : SV.Player.create(x, y);
      P.x = x; P.y = y; P.kx = P.ky = 0; P.state = 'idle'; P.atk = null; P.alpha = 1;
      SV.Enemies.spawnArea(SV.World.area);
      SV.NPC.spawnArea(id);
      SV.Collect.reset();
      SV.World.rebuildColliders(); SV.World.collide(P);
      SV.Camera.update(0, P, true);
      const first = !SV.state.discovered[id];
      SV.state.discovered[id] = true;
      if (!o.silent) { SV.UI.banner(SV.AREAS[id]); }
      SV.Missions.onEnterArea(id);
      SV.Story.onEnterArea(id);
      if (!o.silent || first) SV.Save.autosave('area');
    },
    /** Fade transition between areas */
    travel(id, x, y) {
      if (transitioning) return;
      transitioning = true; SV.Audio.play('whoosh');
      const f = document.getElementById('fade'); f.style.transition = 'opacity .35s ease'; f.style.opacity = 1;
      setTimeout(() => { G.enterArea(id, x, y); f.style.opacity = 0; setTimeout(() => (transitioning = false), 250); }, 380);
    },
    loadSlot(slot) {
      const s = SV.Save.load(slot);
      if (!s) { SV.UI.toast('No save found', 'red'); return; }
      SV.Player.e = null; SV.Player.create(s.x, s.y);
      G.start(s);
      SV.UI.toast('Loaded ' + (slot === 'auto' ? 'autosave' : 'slot ' + slot));
    },
    toMenu() {
      G.mode = 'menu'; SV.UI.closePanel(true);
      document.querySelectorAll('#panels .result').forEach((r) => r.remove());
      if (SV.Dialogue.active()) SV.Dialogue.close();
      if (SV.Cine.active) SV.Cine.end();
      document.getElementById('hud').classList.add('hidden');
      document.getElementById('touch').classList.add('hidden');
      document.getElementById('menu').classList.remove('hidden');
      SV.Main.refresh();
    },
  };

  function resize() {
    G.dpr = Math.min(2, window.devicePixelRatio || 1);
    G.W = window.innerWidth; G.H = window.innerHeight;
    canvas.width = Math.floor(G.W * G.dpr); canvas.height = Math.floor(G.H * G.dpr);
    if (G.mode === 'play' && !SV.Cine.active) SV.Camera.targetZoom = SV.Camera.baseZoom();
  }

  function loop(ts) {
    const raw = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
    try {
      if (G.mode === 'play') { update(raw); render(); }
      else if (SV.Main) SV.Main.frame(raw);
    } catch (e) { console.error(e); }
    I.endFrame();
    requestAnimationFrame(loop);
  }

  function update(raw) {
    // global keys
    if (I.pressed.menu && !SV.Cine.active) {
      if (SV.UI.panelOpen()) { if (document.querySelector('#panels .result')) {} else SV.UI.closePanel(); }
      else if (!SV.Dialogue.active() && !SV.Player.e.dead) SV.UI.pause();
    }
    if (!SV.Cine.active && !SV.Dialogue.active() && !SV.Player.e.dead) {
      if (I.pressed.inv) { if (SV.UI.panelId() === 'inv') SV.UI.closePanel(); else if (!SV.UI.panelOpen()) SV.Inv.open(); }
      if (I.pressed.map) { if (SV.UI.panelId() === 'map') SV.UI.closePanel(); else if (!SV.UI.panelOpen()) SV.Map.open(); }
    }
    SV.Dialogue.update(raw);
    const paused = SV.UI.panelOpen();
    if (paused) { SV.UI.updateHud(0); return; }

    // timers & cinematic (real time)
    for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= raw; if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); } }
    SV.Cine.tick(raw);
    if (SV.Cine.stepper) SV.Cine.stepper(raw);
    for (let i = SV.Cine.tweens.length - 1; i >= 0; i--) if (SV.Cine.tweens[i](raw)) SV.Cine.tweens.splice(i, 1);

    // time scale (slow-mo, hit-stop)
    if (G.slowT > 0) { G.slowT -= raw; G.timeScale = G.slowScale; } else G.timeScale = 1;
    let dt = raw * G.timeScale;
    if (G.hitstop > 0) { G.hitstop -= raw; dt = 0; }
    G.time += dt;
    SV.state.playtime += raw;

    // day cycle + weather
    const s = SV.Settings.get();
    if (s.timeFlow === 'cycle') SV.state.time = (SV.state.time + dt / 480) % 1; else SV.state.time = s.timeFlow === 'day' ? 0.3 : 0.75;
    weatherT -= raw;
    if (s.weather === 'clear') SV.state.weather = 'clear';
    else if (weatherT <= 0) { weatherT = U.rand(90, 180); const r = Math.random(); SV.state.weather = r < 0.6 ? 'clear' : r < 0.8 ? 'rain' : 'fog'; }

    // mouse world position
    const cam = SV.Camera;
    I.mouse.wx = cam.x + (I.mouse.x - G.W / 2) / cam.zoom; I.mouse.wy = cam.y + (I.mouse.y - G.H / 2) / cam.zoom;

    const P = SV.Player.e;
    const px = P.x, py = P.y;
    SV.World.update(dt);
    SV.Player.update(dt);
    SV.Enemies.update(dt);
    SV.NPC.update(dt);
    SV.Collect.update(dt);
    if (!SV.Cine.active && !SV.Dialogue.active()) SV.Missions.update(raw);
    SV.Story.actors.forEach((a) => (a.t += dt));
    checkExits(px, py);
    updateFocus();
    if (focus && I.pressed.interact && !G.inputLocked()) { const f = focus; focus = null; SV.Audio.play('ui'); f.act(); }
    cam.update(raw, P);
    SV.UI.updateHud(raw);
    const e = SV.World.env();
    SV.Audio.update(raw, { wind: e.wind, rain: e.weather === 'rain', night: e.night > 0.5, indoor: e.indoor, combat: SV.Enemies.anyAggro(), fire: nearFire(P) });
    exitMsgT -= raw;
  }
  function nearFire(P) {
    let f = 0; for (const p of SV.World.area.props) if (p.t === 'forge' || p.t === 'hearth' || (p.t === 'campfire' && p.lit !== false)) { const d = U.dist(P.x, P.y, p.x, p.y); if (d < 300) f = Math.max(f, (1 - d / 300) * 0.2); }
    (SV.World.area.fires || []).forEach((fi) => { const d = U.dist(P.x, P.y, fi.x, fi.y); if (d < 500) f = Math.max(f, (1 - d / 500) * 0.25); });
    return f;
  }

  function checkExits(px, py) {
    if (transitioning || G.inputLocked()) return;
    const P = SV.Player.e; const a = SV.World.area;
    for (const ex of a.exits || []) {
      if (P.x > ex.x && P.x < ex.x + ex.w && P.y > ex.y && P.y < ex.y + ex.h) {
        const reason = ex.locked && ex.locked();
        if (reason || !ex.to) {
          // push back the way we came
          const cx = ex.x + ex.w / 2, cy = ex.y + ex.h / 2;
          P.x = px; P.y = py;
          const ang = U.ang(cx, cy, P.x, P.y); P.x += Math.cos(ang) * 6; P.y += Math.sin(ang) * 6;
          if (ex.y <= 0) P.y = Math.max(P.y, ex.y + ex.h + 2); if (ex.y + ex.h >= a.h) P.y = Math.min(P.y, ex.y - 2);
          if (ex.x <= 0) P.x = Math.max(P.x, ex.x + ex.w + 2); if (ex.x + ex.w >= a.w) P.x = Math.min(P.x, ex.x - 2);
          if (exitMsgT <= 0) { exitMsgT = 2.5; SV.UI.toast('LOCKED · ' + (reason || ex.label), 'red'); SV.Audio.play('error'); }
          return;
        }
        G.travel(ex.to, ex.sx, ex.sy); return;
      }
    }
  }
  function interactables() {
    const a = SV.World.area; const out = [];
    (a.interact || []).forEach((i) => { if (!i.when || i.when()) out.push(i); });
    (a.doors || []).forEach((d) => out.push({ id: 'door', x: d.x, y: d.y, r: 50, label: d.label, act: () => G.travel(d.to, d.sx, d.sy) }));
    out.push(...SV.NPC.interactables(), ...SV.Collect.interactables());
    return out;
  }
  function updateFocus() {
    focus = null; if (G.inputLocked()) return;
    const P = SV.Player.e; let best = 1e9;
    for (const it of interactables()) { const d = U.dist(P.x, P.y, it.x, it.y); if (d < (it.r || 50) && d < best) { best = d; focus = it; } }
  }

  /* ---------------- rendering ---------------- */
  function render() {
    const cam = SV.Camera, dpr = G.dpr, W = canvas.width, H = canvas.height;
    const z = cam.zoom * dpr;
    const worldT = () => ctx.setTransform(z, 0, 0, z, W / 2 - (cam.x + cam.ox) * z, H / 2 - (cam.y + cam.oy) * z);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, W, H);
    worldT();
    const env = SV.World.env();
    const ents = [SV.Player.e, ...SV.Enemies.list, ...SV.NPC.visibleList(), ...SV.Collect.entities(), ...SV.Story.actors];
    SV.World.draw(ctx, ents, env);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    SV.World.drawLighting(ctx, env, W, H);
    SV.World.drawWeather(ctx, env, W, H, 1 / 60 * G.timeScale);
    worldT();
    SV.World.drawTexts(ctx);
    drawHotspots(ctx);
    if (focus && !G.inputLocked()) drawPrompt(ctx, focus);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!SV.Cine.active) { drawMarker(ctx); drawBoss(ctx); }
  }
  function drawHotspots(c) {
    const t = SV.World.time;
    for (const it of SV.World.area.interact || []) {
      if (it.when && !it.when()) continue; if (!it.hot || !it.hot()) continue;
      const k = (Math.sin(t * 3 + it.x) + 1) / 2;
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(it.x, it.y - 8, 0, it.x, it.y - 8, 26 + k * 6); g.addColorStop(0, `rgba(201,162,39,${0.25 + k * 0.15})`); g.addColorStop(1, 'rgba(201,162,39,0)');
      c.fillStyle = g; c.beginPath(); c.arc(it.x, it.y - 8, 32, 0, Math.PI * 2); c.fill(); c.restore();
    }
  }
  function drawPrompt(c, f) {
    const label = typeof f.label === 'function' ? f.label() : f.label;
    const key = I.touch ? 'E' : 'E';
    c.font = '600 12px "Zen Kaku Gothic New",sans-serif'; const w = c.measureText(label).width + 34;
    const x = f.npc ? f.npc.x : f.x, y = (f.npc ? f.npc.y - 70 : f.y - 56) + Math.sin(SV.World.time * 4) * 1.5;
    c.fillStyle = 'rgba(10,10,10,.82)'; c.fillRect(x - w / 2, y - 13, w, 24);
    c.strokeStyle = 'rgba(201,162,39,.7)'; c.lineWidth = 1; c.strokeRect(x - w / 2 + 0.5, y - 12.5, w - 1, 23);
    c.fillStyle = '#C9A227'; c.fillRect(x - w / 2 + 5, y - 8, 16, 14); c.fillStyle = '#0a0a0a'; c.textAlign = 'center'; c.font = '800 10px sans-serif'; c.fillText(key, x - w / 2 + 13, y + 3);
    c.fillStyle = '#F5F5F5'; c.font = '600 12px "Zen Kaku Gothic New",sans-serif'; c.textAlign = 'left'; c.fillText(label, x - w / 2 + 27, y + 4);
  }
  function routeTarget(tgt) {
    const cur = SV.World.area.id; if (tgt.area === cur) return tgt;
    // BFS for next hop
    const prev = { [cur]: null }; const q = [cur];
    while (q.length) { const n = q.shift(); if (n === tgt.area) break; (ADJ[n] || []).forEach((m) => { if (!(m in prev)) { prev[m] = n; q.push(m); } }); }
    if (!(tgt.area in prev)) return null;
    let hop = tgt.area; while (prev[hop] !== cur && prev[hop] != null) hop = prev[hop];
    const a = SV.World.area;
    const ex = (a.exits || []).find((e) => e.to === hop); if (ex) return { x: ex.x + ex.w / 2, y: ex.y + ex.h / 2, via: true };
    const d = (a.doors || []).find((e) => e.to === hop); if (d) return { x: d.x, y: d.y, via: true };
    return null;
  }
  function drawMarker(c) {
    const raw = SV.Missions.target(); if (!raw) return;
    const t = routeTarget(raw); if (!t) return;
    const cam = SV.Camera, P = SV.Player.e;
    const sx = (t.x - cam.x) * cam.zoom + G.W / 2, sy = (t.y - 40 - cam.y) * cam.zoom + G.H / 2;
    const m = 50; const on = sx > m && sx < G.W - m && sy > m && sy < G.H - m;
    const dist = Math.round(U.dist(P.x, P.y, t.x, t.y) / 40);
    const pulse = (Math.sin(SV.World.time * 4) + 1) / 2;
    if (on) {
      if (dist < 2) return;
      const y = sy - pulse * 4;
      c.save(); c.translate(sx, y); c.rotate(Math.PI / 4); c.fillStyle = 'rgba(139,30,30,.9)'; c.fillRect(-6, -6, 12, 12); c.strokeStyle = '#C9A227'; c.lineWidth = 1.5; c.strokeRect(-6, -6, 12, 12); c.restore();
      c.font = '600 11px "Zen Kaku Gothic New",sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(0,0,0,.6)'; c.fillText(dist + 'm', sx + 1, y + 22); c.fillStyle = '#C9A227'; c.fillText(dist + 'm', sx, y + 21);
    } else {
      const ang = Math.atan2(sy - G.H / 2, sx - G.W / 2);
      const ex = U.clamp(G.W / 2 + Math.cos(ang) * G.W, m, G.W - m), ey = U.clamp(G.H / 2 + Math.sin(ang) * G.H, m + 40, G.H - m - 60);
      c.save(); c.translate(ex, ey); c.rotate(ang); c.fillStyle = `rgba(201,162,39,${0.6 + pulse * 0.4})`; c.beginPath(); c.moveTo(14, 0); c.lineTo(-6, -9); c.lineTo(-2, 0); c.lineTo(-6, 9); c.closePath(); c.fill(); c.restore();
      c.font = '600 11px "Zen Kaku Gothic New",sans-serif'; c.textAlign = 'center'; c.fillStyle = '#C9A227'; c.fillText(dist + 'm', ex - Math.cos(ang) * 24, ey - Math.sin(ang) * 24 + 4);
    }
  }
  function drawBoss(c) {
    const b = SV.Enemies.boss(); if (!b) return;
    const w = Math.min(460, G.W * 0.6), x = G.W / 2 - w / 2, y = G.H - (I.touch ? 250 : 64);
    c.font = '700 14px "Shippori Mincho",serif'; c.textAlign = 'center'; c.fillStyle = '#F5F5F5'; c.fillText(b.name.toUpperCase(), G.W / 2, y - 10);
    c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(x - 2, y - 2, w + 4, 10);
    c.fillStyle = '#8B1E1E'; c.fillRect(x, y, w * Math.max(0, b.hp / b.maxHp), 6);
    c.fillStyle = 'rgba(201,162,39,.85)'; c.fillRect(x, y + 7, w * Math.max(0, b.poise / b.T.poise), 1.5);
  }

  return G;
})();
