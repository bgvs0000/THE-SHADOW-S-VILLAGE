/* =========================================================
   MAIN — boot + cinematic main menu (night village, fog,
   lanterns, drifting clouds, falling leaves, samurai silhouette).
   ========================================================= */
SV.Main = (function () {
  const U = SV.U;
  let cv, c, t = 0, mx = 0, my = 0;
  const leaves = Array.from({ length: 40 }, () => newLeaf(true));
  const clouds = Array.from({ length: 6 }, (_, i) => ({ x: Math.random(), y: 0.08 + Math.random() * 0.25, w: 0.25 + Math.random() * 0.3, s: 0.004 + Math.random() * 0.006 }));
  const rr = U.rng(7);
  const houses = Array.from({ length: 14 }, (_, i) => ({ x: i / 13, w: 0.05 + rr() * 0.05, h: 0.05 + rr() * 0.04, lit: rr() > 0.35, k: rr() }));
  const lanterns = Array.from({ length: 9 }, (_, i) => ({ x: 0.08 + i * 0.1 + rr() * 0.03, y: 0.74 + rr() * 0.03 }));
  function newLeaf(init) { return { x: Math.random() * 1.2 - 0.1, y: init ? Math.random() : -0.05, vx: U.rand(0.01, 0.05), vy: U.rand(0.03, 0.07), r: Math.random() * 6, vr: U.rand(-3, 3), s: U.rand(2, 4), col: U.choice(['#8f2e1f', '#b5462a', '#C9A227', '#6e2018']) }; }

  function init() {
    cv = document.getElementById('menuCanvas'); c = cv.getContext('2d');
    const rs = () => { const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; };
    rs(); addEventListener('resize', rs);
    addEventListener('mousemove', (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; });
    document.getElementById('menu').addEventListener('pointerdown', () => SV.Audio.init());
    document.querySelectorAll('#menuNav button').forEach((b) => b.addEventListener('click', () => { SV.Audio.init(); SV.Audio.play('ui'); act(b.dataset.m); }));
    window.addEventListener('keydown', (e) => { if (SV.Game.mode === 'menu' && e.code === 'Escape' && SV.UI.panelOpen()) SV.UI.closePanel(); });
    refresh();
  }
  function refresh() {
    const has = !!SV.Save.latest();
    document.getElementById('btnContinue').disabled = !has;
  }
  function act(m) {
    if (m === 'new') {
      if (SV.Save.latest()) {
        const p = SV.UI.panel({ id: 'newconf', title: 'NEW JOURNEY', jp: '新たな旅', cls: 'sm', menu: true });
        p.body.innerHTML = '<p style="color:#bbb;font-size:13px;line-height:1.7">A journey is already underway. Starting anew will overwrite the autosave (manual save slots are kept).</p>';
        const row = U.el('div', 'btn-row'); const a = U.el('button', 'btn red', 'Begin anew'); a.onclick = () => { SV.UI.closePanel(true); newGame(); };
        const b = U.el('button', 'btn', 'Cancel'); b.onclick = () => SV.UI.closePanel(); row.append(a, b); p.body.appendChild(row);
      } else newGame();
    }
    if (m === 'continue') { const s = SV.Save.latest(); if (s) SV.Game.loadSlot(s); }
    if (m === 'load') SV.UI.saves('load', true);
    if (m === 'settings') SV.UI.settings(true);
    if (m === 'credits') SV.UI.credits(true);
  }
  function newGame() {
    const s = SV.newState();
    SV.Player.e = null;
    SV.Game.start(s, { intro: true });
  }

  /* ---------------- menu scene ---------------- */
  function frame(dt) {
    t += dt; const W = cv.width, H = cv.height; const px = mx * 30 + Math.sin(t * 0.15) * 14, py = my * 14;
    const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#05070d'); sky.addColorStop(0.55, '#0e1320'); sky.addColorStop(1, '#07080b');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    // moon
    const mxp = W * 0.74 - px * 0.2, myp = H * 0.2 - py * 0.2;
    const halo = c.createRadialGradient(mxp, myp, 0, mxp, myp, H * 0.35); halo.addColorStop(0, 'rgba(200,210,230,.25)'); halo.addColorStop(1, 'rgba(200,210,230,0)');
    c.fillStyle = halo; c.fillRect(0, 0, W, H);
    c.fillStyle = '#e6e2d6'; c.beginPath(); c.arc(mxp, myp, H * 0.055, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(14,19,32,.5)'; c.beginPath(); c.arc(mxp + H * 0.018, myp - H * 0.01, H * 0.05, 0, Math.PI * 2); c.fill();
    // clouds
    clouds.forEach((cl) => {
      cl.x += cl.s * dt; if (cl.x > 1.3) cl.x = -0.4;
      const g = c.createRadialGradient(cl.x * W, cl.y * H, 0, cl.x * W, cl.y * H, cl.w * W * 0.5); g.addColorStop(0, 'rgba(60,66,84,.35)'); g.addColorStop(1, 'rgba(60,66,84,0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(cl.x * W, cl.y * H, cl.w * W * 0.5, cl.w * H * 0.12, 0, 0, Math.PI * 2); c.fill();
    });
    // mountains
    mountain(W, H, 0.55, '#121726', 0.12, px * 0.3, 3);
    mountain(W, H, 0.62, '#0d111b', 0.1, px * 0.5, 11);
    // pagoda
    const pgx = W * 0.2 - px * 0.6, base = H * 0.68;
    c.fillStyle = '#0a0c12';
    for (let i = 0; i < 4; i++) { const y = base - i * H * 0.05, w = W * (0.05 - i * 0.008); c.fillRect(pgx - w * 0.35, y - H * 0.04, w * 0.7, H * 0.04); c.beginPath(); c.moveTo(pgx - w, y - H * 0.035); c.quadraticCurveTo(pgx, y - H * 0.06, pgx + w, y - H * 0.035); c.lineTo(pgx + w * 0.6, y - H * 0.045); c.lineTo(pgx - w * 0.6, y - H * 0.045); c.fill(); }
    c.fillRect(pgx - 2, base - H * 0.26, 4, H * 0.06);
    // houses
    houses.forEach((h) => {
      const x = h.x * W * 1.1 - W * 0.05 - px * 0.8, w = h.w * W, hh = h.h * H, y = H * 0.74;
      c.fillStyle = '#08090d'; c.fillRect(x, y - hh, w, hh);
      c.beginPath(); c.moveTo(x - w * 0.15, y - hh); c.lineTo(x + w * 0.2, y - hh - hh * 0.7); c.lineTo(x + w * 0.8, y - hh - hh * 0.7); c.lineTo(x + w * 1.15, y - hh); c.fill();
      if (h.lit) { const fl = 0.85 + Math.sin(t * 3 + h.k * 10) * 0.08; c.fillStyle = `rgba(232,170,90,${fl})`; c.fillRect(x + w * 0.2, y - hh * 0.7, w * 0.22, hh * 0.38); c.fillRect(x + w * 0.55, y - hh * 0.7, w * 0.22, hh * 0.38);
        const g = c.createRadialGradient(x + w / 2, y - hh * 0.5, 0, x + w / 2, y - hh * 0.5, w * 1.2); g.addColorStop(0, 'rgba(232,160,80,.18)'); g.addColorStop(1, 'rgba(232,160,80,0)'); c.fillStyle = g; c.fillRect(x - w, y - hh * 2, w * 3, hh * 3); }
    });
    // ground
    c.fillStyle = '#060608'; c.fillRect(0, H * 0.74, W, H * 0.26);
    // lanterns along the path
    lanterns.forEach((l, i) => {
      const x = l.x * W - px, y = l.y * H; const fl = 0.8 + Math.sin(t * 7 + i) * 0.1 + Math.random() * 0.05;
      const g = c.createRadialGradient(x, y, 0, x, y, H * 0.08); g.addColorStop(0, `rgba(240,90,60,${0.35 * fl})`); g.addColorStop(1, 'rgba(240,90,60,0)'); c.fillStyle = g; c.fillRect(x - H * 0.1, y - H * 0.1, H * 0.2, H * 0.2);
      c.fillStyle = `rgba(226,72,52,${fl})`; c.beginPath(); c.ellipse(x, y, H * 0.008, H * 0.012, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#050505'; c.fillRect(x - 1, y - H * 0.04, 2, H * 0.028);
    });
    // fog bands
    for (let i = 0; i < 3; i++) {
      const fx = ((t * (0.01 + i * 0.006)) % 1) * W * 2 - W; const fy = H * (0.7 + i * 0.06);
      const g = c.createRadialGradient(fx + W * 0.5, fy, 0, fx + W * 0.5, fy, W * 0.6); g.addColorStop(0, 'rgba(120,130,150,.12)'); g.addColorStop(1, 'rgba(120,130,150,0)');
      c.fillStyle = g; c.fillRect(0, fy - H * 0.2, W, H * 0.4);
    }
    // samurai silhouette on a rise
    const sx = W * 0.7 - px * 1.4, sy = H * 0.9;
    c.fillStyle = '#020203'; c.beginPath(); c.ellipse(sx, sy + H * 0.08, W * 0.3, H * 0.1, 0, Math.PI, Math.PI * 2); c.fill();
    samurai(sx, sy, H * 0.0044);
    // leaves
    leaves.forEach((l, i) => {
      l.x += l.vx * dt + Math.sin(t + i) * 0.0006; l.y += l.vy * dt; l.r += l.vr * dt;
      if (l.y > 1.05) leaves[i] = newLeaf(false);
      c.save(); c.translate(l.x * W, l.y * H); c.rotate(l.r); c.fillStyle = l.col; c.fillRect(-l.s * 1.5, -l.s * 0.6, l.s * 3, l.s * 1.2); c.restore();
    });
    // vignette
    const vg = c.createRadialGradient(W * 0.4, H / 2, H * 0.2, W / 2, H / 2, W * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.75)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
    const lg = c.createLinearGradient(0, 0, W * 0.6, 0); lg.addColorStop(0, 'rgba(0,0,0,.55)'); lg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = lg; c.fillRect(0, 0, W, H);
  }
  function mountain(W, H, base, col, amp, off, seed) {
    const r = U.rng(seed); c.fillStyle = col; c.beginPath(); c.moveTo(-50, H);
    let y = H * base; for (let x = -50; x <= W + 60; x += W / 14) { y = H * base - r() * H * amp - (x === -50 ? 0 : 0); c.lineTo(x - off, y); }
    c.lineTo(W + 60, H); c.fill();
  }
  function samurai(x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = '#010102';
    const flap = Math.sin(t * 2.2) * 4;
    // legs + hakama
    c.beginPath(); c.moveTo(-14, -50); c.lineTo(14, -50); c.lineTo(24, 0); c.lineTo(-24, 0); c.fill();
    // haori flapping
    c.beginPath(); c.moveTo(-16, -92); c.lineTo(16, -92); c.lineTo(20 + flap, -46); c.lineTo(34 + flap * 2, -40); c.lineTo(-20, -44); c.fill();
    // torso, arms
    c.fillRect(-15, -96, 30, 50);
    c.fillRect(-21, -92, 8, 34); c.fillRect(13, -92, 8, 34);
    // head + topknot
    c.beginPath(); c.arc(0, -108, 11, 0, Math.PI * 2); c.fill(); c.fillRect(-3, -124, 6, 8);
    // headband tail
    c.strokeStyle = '#4a0e0e'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-9, -110); c.quadraticCurveTo(-26, -106 + flap, -40, -98 + flap * 1.5); c.stroke();
    // katana
    c.strokeStyle = '#010102'; c.lineWidth = 5; c.beginPath(); c.moveTo(8, -62); c.lineTo(-40, -36); c.stroke();
    c.strokeStyle = '#3a0c0c'; c.lineWidth = 4; c.beginPath(); c.moveTo(8, -62); c.lineTo(22, -70); c.stroke();
    // rim light from the moon
    c.strokeStyle = 'rgba(190,200,220,.35)'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, -108, 11, -1.4, 0.4); c.moveTo(15, -96); c.lineTo(15, -50); c.lineTo(24, 0); c.stroke();
    c.restore();
  }
  return { init, frame, refresh };
})();

window.addEventListener('DOMContentLoaded', () => {
  SV.Game.init();
  SV.Main.init();
});
