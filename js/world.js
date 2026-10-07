/* =========================================================
   WORLD — area loading, pre-rendered ground, props, collision,
   particles, lighting (day/sunset/night), weather (rain/fog).
   ========================================================= */
SV.World = (function () {
  const U = SV.U, TAU = Math.PI * 2;
  let area = null, ground = null, tufts = [], cols = [], time = 0;
  const particles = [];
  let lightCanvas = null, lctx = null;
  const fogBlobs = Array.from({ length: 7 }, () => ({ x: Math.random(), y: Math.random(), r: U.rand(0.25, 0.5), vx: U.rand(0.004, 0.012), a: U.rand(0.5, 1) }));
  const rain = [];

  /* ---------------- environment (time of day + weather) ---------------- */
  function env() {
    const s = SV.state, t = s.time;
    let phase, dark, tint = null, night = 0;
    if (t < 0.5) { phase = 'Day'; dark = 0.04; }
    else if (t < 0.62) { phase = 'Sunset'; const k = (t - 0.5) / 0.12; dark = U.lerp(0.06, 0.48, k); tint = [196, 96, 40, 0.18 * Math.sin(k * Math.PI) + 0.06]; night = k * 0.6; }
    else if (t < 0.92) { phase = 'Night'; dark = 0.68; night = 1; }
    else { phase = 'Dawn'; const k = (t - 0.92) / 0.08; dark = U.lerp(0.66, 0.06, k); tint = [150, 120, 160, 0.12 * (1 - k)]; night = 1 - k; }
    const a = area || {};
    if (a.indoor) { dark = Math.max(0.5, dark * 0.9); }
    if (a.darkMod) dark = Math.min(0.85, dark + a.darkMod);
    if (a.forceNight) { dark = 0.7; night = 1; phase = 'Night'; }
    const weather = a.indoor ? 'clear' : (a.weather || s.weather);
    if (weather === 'rain') dark = Math.min(0.85, dark + 0.12);
    const wind = (a.wind || 0.35) + (weather === 'rain' ? 0.35 : 0) + (SV.Story && SV.Story.windBoost || 0);
    return { phase, dark: Math.min(0.78, dark) + (SV.Story ? SV.Story.extraDark : 0), tint, night, weather, wind, indoor: !!a.indoor };
  }

  /* ---------------- area loading ---------------- */
  function load(id) {
    const def = SV.AREAS[id];
    area = typeof def.build === 'function' ? def.build() : def;
    area.id = id;
    buildGround();
    particles.length = 0;
    SV.Bus.emit('areaLoaded', area);
    return area;
  }

  function buildGround() {
    const a = area; const g = a.ground || {};
    ground = document.createElement('canvas'); ground.width = a.w; ground.height = a.h;
    const c = ground.getContext('2d');
    const r = U.rng(U.hash(a.id));
    c.fillStyle = g.base || '#3e4a33'; c.fillRect(0, 0, a.w, a.h);
    // mottled variation
    const vars = g.vars || ['rgba(0,0,0,.08)', 'rgba(255,255,255,.03)'];
    for (let i = 0; i < (a.w * a.h) / 9000; i++) {
      c.fillStyle = vars[i % vars.length];
      c.beginPath(); c.ellipse(r() * a.w, r() * a.h, 30 + r() * 90, 18 + r() * 50, r() * 3, 0, TAU); c.fill();
    }
    if (g.style === 'interior') {
      // tatami mats
      c.fillStyle = '#6d6646'; c.fillRect(0, 0, a.w, a.h);
      for (let y = 80; y < a.h; y += 90) for (let x = 0; x < a.w; x += 180) {
        const off = (Math.floor(y / 90) % 2) * 90;
        c.fillStyle = r() > 0.5 ? '#7b7350' : '#746c4a'; c.fillRect(x + off - 90, y, 178, 88);
        c.strokeStyle = '#2a2418'; c.lineWidth = 3; c.strokeRect(x + off - 90, y, 178, 88);
        c.strokeStyle = 'rgba(0,0,0,.08)'; c.lineWidth = 1; for (let k = 4; k < 88; k += 4) { c.beginPath(); c.moveTo(x + off - 90, y + k); c.lineTo(x + off + 88, y + k); c.stroke(); }
      }
    }
    // fields / paddies
    (a.fields || []).forEach((f) => {
      c.fillStyle = '#3a4a44'; c.fillRect(f.x, f.y, f.w, f.h);
      c.strokeStyle = '#4d4a33'; c.lineWidth = 6; c.strokeRect(f.x, f.y, f.w, f.h);
      c.fillStyle = '#6f8f45';
      for (let y = f.y + 10; y < f.y + f.h - 6; y += 14) for (let x = f.x + 8; x < f.x + f.w - 6; x += 12) c.fillRect(x + (r() * 2), y, 2, 5);
    });
    // plazas
    (a.plazas || []).forEach((p) => {
      c.fillStyle = p.col || '#6f675a'; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1;
      for (let i = 0; i < p.r * 1.2; i++) { const a2 = r() * TAU, d = r() * p.r; c.strokeRect(p.x + Math.cos(a2) * d, p.y + Math.sin(a2) * d, 10 + r() * 10, 7 + r() * 6); }
    });
    // paths
    (a.paths || []).forEach((p) => {
      c.lineCap = 'round'; c.lineJoin = 'round';
      const trace = () => { c.beginPath(); p.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); };
      trace(); c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = p.w + 10; c.stroke();
      trace(); c.strokeStyle = p.col || '#7a6a4f'; c.lineWidth = p.w; c.stroke();
      trace(); c.strokeStyle = 'rgba(255,255,255,.04)'; c.lineWidth = p.w * 0.5; c.stroke();
      // pebbles along path
      for (let i = 1; i < p.pts.length; i++) {
        const [x0, y0] = p.pts[i - 1], [x1, y1] = p.pts[i]; const L = Math.hypot(x1 - x0, y1 - y0);
        for (let d = 0; d < L; d += 9) {
          const t = d / L; c.fillStyle = r() > 0.5 ? 'rgba(0,0,0,.15)' : 'rgba(255,255,255,.06)';
          c.fillRect(U.lerp(x0, x1, t) + (r() - 0.5) * p.w * 0.9, U.lerp(y0, y1, t) + (r() - 0.5) * p.w * 0.9, 2 + r() * 3, 2 + r() * 2);
        }
      }
    });
    // water base
    (a.water || []).forEach((w) => {
      c.fillStyle = '#2c3a44'; c.fillRect(w.x - 6, w.y - 6, w.w + 12, w.h + 12);
      const gr = c.createLinearGradient(w.x, w.y, w.x, w.y + w.h); gr.addColorStop(0, '#1d3340'); gr.addColorStop(1, '#152630');
      c.fillStyle = gr; c.fillRect(w.x, w.y, w.w, w.h);
      c.strokeStyle = '#5c5a4c'; c.lineWidth = 4; c.strokeRect(w.x - 2, w.y - 2, w.w + 4, w.h + 4);
    });
    // grass tufts (animated)
    tufts = [];
    if (g.tufts !== false && g.style !== 'interior' && g.style !== 'stone') {
      const n = (a.w * a.h) / (g.tuftDensity || 7000);
      for (let i = 0; i < n; i++) {
        const x = r() * a.w, y = r() * a.h;
        if (onPath(x, y)) continue;
        tufts.push({ x, y, h: 5 + r() * 7, s: r() * 10, c: g.tuft || (r() > 0.5 ? '#5d6e42' : '#4c5c36') });
      }
    }
  }
  function onPath(x, y) {
    for (const p of area.paths || []) for (let i = 1; i < p.pts.length; i++) {
      if (segDist(x, y, p.pts[i - 1], p.pts[i]) < p.w * 0.6) return true;
    }
    for (const pl of area.plazas || []) if (U.dist(x, y, pl.x, pl.y) < pl.r) return true;
    for (const w of area.water || []) if (x > w.x - 8 && x < w.x + w.w + 8 && y > w.y - 8 && y < w.y + w.h + 8) return true;
    return false;
  }
  function segDist(px, py, [ax, ay], [bx, by]) {
    const dx = bx - ax, dy = by - ay; const L = dx * dx + dy * dy || 1;
    const t = U.clamp(((px - ax) * dx + (py - ay) * dy) / L, 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  /* ---------------- props ---------------- */
  const live = (p) => !p.when || p.when();
  function lit(e) { return e.night > 0.25 || (area && area.indoor); }
  const P = {}; // prop type registry: {draw, col, light, flat}

  P.house = {
    col: (p) => ({ x: p.x, y: p.y, w: p.w, h: p.h }),
    sortY: (p) => p.y + p.h,
    light: (p, e) => (lit(e) && !p.dark ? { x: p.x + p.w / 2, y: p.y + p.h + 14, r: 90, c: 'warm', i: 0.75 } : null),
    draw(c, p, e) {
      const by = p.y + p.h, wallH = p.wallH || 44, roofTop = p.y - (p.roofH || 30);
      const eave = 14;
      c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(p.x - 6, by - 4, p.w + 18, 14);
      // walls
      c.fillStyle = '#2f2318'; c.fillRect(p.x, by - wallH, p.w, wallH);
      const seg = Math.max(2, Math.round(p.w / 38)); const sw = p.w / seg; const doorI = p.doorAt != null ? p.doorAt : Math.floor(seg / 2);
      for (let i = 0; i < seg; i++) {
        const x = p.x + i * sw + 3, y = by - wallH + 6, w = sw - 6, h = wallH - 9;
        if (i === doorI) {
          c.fillStyle = p.burnt ? '#120d0a' : '#1d1610'; c.fillRect(x, y, w, h);
          if (p.noren) { c.fillStyle = p.noren; c.fillRect(x - 2, y, w + 4, h * 0.45); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x + w / 2 - 1, y + 2, 2, h * 0.43); if (p.sign) { c.fillStyle = '#f0e6d0'; c.font = '700 11px "Shippori Mincho",serif'; c.textAlign = 'center'; c.fillText(p.sign, x + w / 2, y + h * 0.3); } }
          continue;
        }
        const glow = lit(e) && !p.dark ? 1 : 0;
        c.fillStyle = glow ? `rgba(236,${180 + Math.sin(time * 3 + i) * 6},100,1)` : p.burnt ? '#5d5446' : '#cdc2a6';
        c.fillRect(x, y, w, h);
        c.strokeStyle = 'rgba(40,28,18,.85)'; c.lineWidth = 1.2;
        for (let k = 1; k < 3; k++) { c.beginPath(); c.moveTo(x + (w * k) / 3, y); c.lineTo(x + (w * k) / 3, y + h); c.stroke(); }
        for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(x, y + (h * k) / 4); c.lineTo(x + w, y + (h * k) / 4); c.stroke(); }
      }
      c.fillStyle = '#3b2b1f'; c.fillRect(p.x, by - 5, p.w, 5);
      if (p.burnt) { c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.ellipse(p.x + p.w * 0.25, by - wallH * 0.5, 30, 20, 0, 0, TAU); c.fill(); }
      // roof (3/4 projection)
      const ry = by - wallH + 4;
      const roofCol = p.roof || '#2c3036';
      c.fillStyle = roofCol;
      c.beginPath(); c.moveTo(p.x - eave, ry); c.lineTo(p.x + p.w + eave, ry); c.lineTo(p.x + p.w - 14, roofTop); c.lineTo(p.x + 14, roofTop); c.closePath(); c.fill();
      // tile rows
      c.strokeStyle = p.thatch ? 'rgba(60,45,20,.5)' : 'rgba(0,0,0,.35)'; c.lineWidth = 1;
      for (let y = roofTop + 6; y < ry; y += p.thatch ? 4 : 7) { const k = (y - roofTop) / (ry - roofTop); c.beginPath(); c.moveTo(p.x + 14 - k * (14 + eave), y); c.lineTo(p.x + p.w - 14 + k * (14 + eave), y); c.stroke(); }
      if (!p.thatch) { c.strokeStyle = 'rgba(255,255,255,.05)'; for (let x = p.x; x < p.x + p.w; x += 9) { c.beginPath(); c.moveTo(x, roofTop + 2); c.lineTo(x + (x - p.x - p.w / 2) * 0.12, ry); c.stroke(); } }
      // eave edge + ridge
      c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(p.x - eave, ry - 3, p.w + eave * 2, 4);
      c.fillStyle = p.ridge || '#1a1c20'; c.fillRect(p.x + 10, roofTop - 4, p.w - 20, 6);
      c.beginPath(); c.moveTo(p.x + 10, roofTop - 4); c.lineTo(p.x + 2, roofTop - 10); c.lineTo(p.x + 14, roofTop + 2); c.fill();
      c.beginPath(); c.moveTo(p.x + p.w - 10, roofTop - 4); c.lineTo(p.x + p.w - 2, roofTop - 10); c.lineTo(p.x + p.w - 14, roofTop + 2); c.fill();
      if (p.burnt) { c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.moveTo(p.x + 20, ry); c.lineTo(p.x + p.w * 0.45, roofTop + 4); c.lineTo(p.x + p.w * 0.5, ry); c.fill(); }
      if (p.hangSign) { c.fillStyle = '#2a1f14'; c.fillRect(p.x + p.w - 30, by - wallH - 4, 22, 30); c.fillStyle = '#e8dcc0'; c.font = '700 12px "Shippori Mincho",serif'; c.textAlign = 'center'; c.fillText(p.hangSign[0], p.x + p.w - 19, by - wallH + 10); if (p.hangSign[1]) c.fillText(p.hangSign[1], p.x + p.w - 19, by - wallH + 23); }
      if (p.snow) {}
    },
  };
  P.shrineHall = {
    col: (p) => ({ x: p.x, y: p.y, w: p.w, h: p.h }), sortY: (p) => p.y + p.h,
    light: (p) => (p.open && p.open() ? { x: p.x + p.w / 2, y: p.y + p.h + 10, r: 160, c: 'gold', i: 0.9 } : null),
    draw(c, p, e) {
      const by = p.y + p.h, wallH = 60, roofTop = p.y - 50, ry = by - wallH + 4;
      c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(p.x - 10, by - 4, p.w + 24, 16);
      c.fillStyle = '#6d6a62'; c.fillRect(p.x - 16, by - 8, p.w + 32, 12); // stone base
      c.fillStyle = '#1a1210'; c.fillRect(p.x, by - wallH, p.w, wallH - 6);
      // red pillars
      c.fillStyle = '#7a1c18'; for (let i = 0; i <= 4; i++) c.fillRect(p.x + (i * (p.w - 10)) / 4, by - wallH, 10, wallH - 6);
      // sealed door
      const dx = p.x + p.w / 2 - 34, dw = 68, dy = by - wallH + 8;
      const open = p.open && p.open();
      if (open) { const g = c.createLinearGradient(0, dy, 0, by); g.addColorStop(0, 'rgba(255,215,120,.9)'); g.addColorStop(1, 'rgba(255,190,90,.3)'); c.fillStyle = g; c.fillRect(dx, dy, dw, wallH - 14); }
      else {
        c.fillStyle = '#3a2a1c'; c.fillRect(dx, dy, dw, wallH - 14);
        c.strokeStyle = '#1a120c'; c.lineWidth = 2; c.strokeRect(dx, dy, dw, wallH - 14); c.beginPath(); c.moveTo(dx + dw / 2, dy); c.lineTo(dx + dw / 2, dy + wallH - 14); c.stroke();
        // shimenawa rope + seal
        c.strokeStyle = '#c8b27a'; c.lineWidth = 4; c.beginPath(); c.moveTo(dx - 10, dy + 6); c.quadraticCurveTo(dx + dw / 2, dy + 18, dx + dw + 10, dy + 6); c.stroke();
        c.fillStyle = '#ece6d6'; for (let i = 0; i < 4; i++) { c.fillRect(dx + 8 + i * 16, dy + 12 + (i % 2) * 2, 4, 12); }
        // three keyholes
        for (let i = 0; i < 3; i++) { const have = SV.Puzzles && SV.Puzzles.keysPlaced() > i; c.fillStyle = have ? '#c9a227' : '#0a0a0a'; c.beginPath(); c.arc(dx + 16 + i * 18, dy + 34, 3.5, 0, TAU); c.fill(); }
      }
      c.fillStyle = '#23262b';
      c.beginPath(); c.moveTo(p.x - 34, ry + 6); c.quadraticCurveTo(p.x - 10, ry - 4, p.x + 20, roofTop); c.lineTo(p.x + p.w - 20, roofTop); c.quadraticCurveTo(p.x + p.w + 10, ry - 4, p.x + p.w + 34, ry + 6); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.4)'; for (let y = roofTop + 6; y < ry; y += 7) { c.beginPath(); c.moveTo(p.x - 10, y); c.lineTo(p.x + p.w + 10, y); c.stroke(); }
      c.fillStyle = '#c9a227'; c.fillRect(p.x + 20, roofTop - 5, p.w - 40, 5);
      c.fillStyle = '#7a1c18'; c.fillRect(p.x - 34, ry + 2, p.w + 68, 5);
    },
  };
  P.tree = {
    col: (p) => (p.kind === 'bush' ? { x: p.x - p.r * 0.6, y: p.y - 8, w: p.r * 1.2, h: 12 } : { x: p.x - 7, y: p.y - 7, w: 14, h: 9 }), sortY: (p) => p.y,
    draw(c, p, e) {
      const r = p.r || 40, sw = Math.sin(time * 1.3 + p.x * 0.01) * e.wind * 3;
      c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(p.x + 10, p.y, r * 0.8, r * 0.28, 0, 0, TAU); c.fill();
      if (p.kind === 'bush') {
        c.fillStyle = '#2d3b25'; c.beginPath(); c.ellipse(p.x, p.y - r * 0.4, r * 0.7, r * 0.5, 0, 0, TAU); c.fill();
        c.fillStyle = '#3c4d2f'; c.beginPath(); c.ellipse(p.x - r * 0.15 + sw * 0.3, p.y - r * 0.55, r * 0.45, r * 0.32, 0, 0, TAU); c.fill(); return;
      }
      c.fillStyle = p.kind === 'dead' ? '#2a2420' : '#3a2a1e'; c.fillRect(p.x - 4, p.y - r * 1.1, 8, r * 1.1);
      if (p.kind === 'dead') { c.strokeStyle = '#2a2420'; c.lineWidth = 3; c.beginPath(); c.moveTo(p.x, p.y - r); c.lineTo(p.x - r * 0.5, p.y - r * 1.6); c.moveTo(p.x, p.y - r * 0.8); c.lineTo(p.x + r * 0.6, p.y - r * 1.4); c.moveTo(p.x - r * 0.2, p.y - r * 1.3); c.lineTo(p.x - r * 0.1, p.y - r * 1.9); c.stroke(); return; }
      const pal = { pine: ['#1d2b22', '#26382c', '#304634'], sakura: ['#a8667a', '#c9849a', '#e2aabb'], maple: ['#6e2018', '#8f2e1f', '#b5462a'], oak: ['#2a3a22', '#34492a', '#41592f'] }[p.kind || 'oak'];
      const cy = p.y - r * 1.35;
      const blobs = [[0, 0, 0.75], [-0.45, 0.15, 0.55], [0.45, 0.12, 0.58], [-0.2, -0.35, 0.5], [0.25, -0.3, 0.5]];
      pal.forEach((col, li) => {
        c.fillStyle = col;
        blobs.forEach(([bx, by, br]) => { c.beginPath(); c.arc(p.x + bx * r + sw * (li + 1) * 0.5 - li * 3, cy + by * r - li * 4, br * r * (1 - li * 0.18), 0, TAU); c.fill(); });
      });
      if (p.kind === 'pine') { c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.arc(p.x + r * 0.2, cy + r * 0.2, r * 0.5, 0, TAU); c.fill(); }
    },
  };
  P.bamboo = {
    col: (p) => ({ x: p.x - 12, y: p.y - 7, w: 24, h: 10 }), sortY: (p) => p.y,
    draw(c, p, e) {
      const n = p.n || 5, h = p.h || 150, rr = U.rng(p.seed || (p.x * 13 + p.y));
      c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(p.x, p.y, 18, 6, 0, 0, TAU); c.fill();
      for (let i = 0; i < n; i++) {
        const bx = p.x + (rr() - 0.5) * 26, by = p.y + (rr() - 0.5) * 8, bh = h * (0.7 + rr() * 0.5);
        const sway = Math.sin(time * 1.1 + bx * 0.02 + i) * e.wind * 10;
        const g = rr() > 0.5 ? '#6b8a43' : '#58753a';
        c.strokeStyle = g; c.lineWidth = 3.6; c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx, by - bh * 0.6, bx + sway, by - bh); c.stroke();
        c.strokeStyle = 'rgba(220,235,180,.35)'; c.lineWidth = 1;
        for (let k = 22; k < bh; k += 22) { const t = k / bh; const x = bx + sway * t * t; c.beginPath(); c.moveTo(x - 2, by - k); c.lineTo(x + 2, by - k); c.stroke(); }
        c.fillStyle = rr() > 0.5 ? '#2f4a24' : '#3e5c2c';
        for (let k = 0; k < 4; k++) { const t = 0.75 + rr() * 0.25; const x = bx + sway * t * t, y = by - bh * t; c.save(); c.translate(x, y); c.rotate((rr() - 0.5) * 2.4 + sway * 0.02); c.beginPath(); c.ellipse(9, 0, 10, 2.3, 0, 0, TAU); c.fill(); c.restore(); }
      }
    },
  };
  P.lantern = {
    col: (p) => ({ x: p.x - 8, y: p.y - 6, w: 16, h: 8 }), sortY: (p) => p.y,
    light: (p, e) => (lit(e) || p.always ? { x: p.x, y: p.y - 20, r: p.r || 130, c: 'warm', i: 1, f: true } : null),
    draw(c, p, e) {
      const on = lit(e) || p.always;
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(p.x, p.y, 12, 4, 0, 0, TAU); c.fill();
      c.fillStyle = '#5f5d56'; c.fillRect(p.x - 9, p.y - 6, 18, 6); c.fillRect(p.x - 3.5, p.y - 22, 7, 16);
      c.fillStyle = '#6d6b63'; c.fillRect(p.x - 8, p.y - 34, 16, 12);
      c.fillStyle = on ? `rgba(255,${190 + Math.sin(time * 9 + p.x) * 20},100,1)` : '#2b2a27'; c.fillRect(p.x - 4.5, p.y - 31, 9, 7);
      c.fillStyle = '#545249'; c.beginPath(); c.moveTo(p.x - 13, p.y - 33); c.lineTo(p.x + 13, p.y - 33); c.lineTo(p.x + 4, p.y - 41); c.lineTo(p.x - 4, p.y - 41); c.fill();
      c.fillRect(p.x - 2, p.y - 45, 4, 4);
    },
  };
  P.chochin = {
    col: (p) => ({ x: p.x - 3, y: p.y - 4, w: 6, h: 6 }), sortY: (p) => p.y,
    light: (p, e) => (lit(e) ? { x: p.x, y: p.y - 44, r: 110, c: 'red', i: 0.9, f: true } : null),
    draw(c, p, e) {
      c.fillStyle = '#2b2018'; c.fillRect(p.x - 2, p.y - 60, 4, 60); c.fillRect(p.x - 2, p.y - 60, 14, 3);
      const sw = Math.sin(time * 2 + p.x) * 2 * e.wind;
      c.strokeStyle = '#111'; c.beginPath(); c.moveTo(p.x + 10, p.y - 58); c.lineTo(p.x + 10 + sw, p.y - 52); c.stroke();
      c.fillStyle = lit(e) ? '#e0483a' : '#8B1E1E'; c.beginPath(); c.ellipse(p.x + 10 + sw, p.y - 42, 7, 10, 0, 0, TAU); c.fill();
      c.fillStyle = '#111'; c.fillRect(p.x + 5 + sw, p.y - 53, 10, 2); c.fillRect(p.x + 5 + sw, p.y - 33, 10, 2);
    },
  };
  P.rock = {
    col: (p) => ({ x: p.x - p.r, y: p.y - p.r * 0.5, w: p.r * 2, h: p.r * 0.7 }), sortY: (p) => p.y,
    draw(c, p) {
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(p.x + 3, p.y + 2, p.r * 1.1, p.r * 0.4, 0, 0, TAU); c.fill();
      c.fillStyle = p.col || '#55554f'; c.beginPath(); c.ellipse(p.x, p.y - p.r * 0.35, p.r, p.r * 0.7, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.ellipse(p.x - p.r * 0.3, p.y - p.r * 0.6, p.r * 0.45, p.r * 0.25, 0, 0, TAU); c.fill();
      if (p.moss) { c.fillStyle = 'rgba(80,110,50,.55)'; c.beginPath(); c.ellipse(p.x + p.r * 0.2, p.y - p.r * 0.8, p.r * 0.5, p.r * 0.2, 0, 0, TAU); c.fill(); }
    },
  };
  P.fence = {
    col: (p) => (p.v ? { x: p.x - 3, y: p.y, w: 6, h: p.h } : { x: p.x, y: p.y - 4, w: p.w, h: 6 }), sortY: (p) => (p.v ? p.y + p.h : p.y),
    draw(c, p) {
      c.fillStyle = '#4a3a28';
      if (p.v) { for (let y = p.y; y <= p.y + p.h; y += 24) c.fillRect(p.x - 2, y - 22, 4, 22); c.fillStyle = '#5d4a33'; c.fillRect(p.x - 1.5, p.y - 16, 3, p.h); return; }
      for (let x = p.x; x <= p.x + p.w; x += 24) c.fillRect(x - 2, p.y - 22, 4, 22);
      c.fillStyle = '#5d4a33'; c.fillRect(p.x, p.y - 18, p.w, 3); c.fillRect(p.x, p.y - 10, p.w, 3);
    },
  };
  P.wall = {
    col: (p) => ({ x: p.x, y: p.y, w: p.w, h: p.h }), sortY: (p) => p.y + p.h,
    draw(c, p) {
      const H = p.tall || 34;
      c.fillStyle = p.col || '#4b4943'; c.fillRect(p.x, p.y - H + p.h, p.w, H);
      c.fillStyle = 'rgba(0,0,0,.25)'; for (let y = p.y - H + p.h + 8; y < p.y + p.h; y += 10) for (let x = p.x + ((y / 10) % 2) * 12; x < p.x + p.w; x += 24) c.fillRect(x, y, 1.5, 8);
      c.fillStyle = p.cap || '#2e2f33'; c.fillRect(p.x - 3, p.y - H + p.h - 6, p.w + 6, 7);
    },
  };
  P.iwall = { // interior wall with shoji
    col: (p) => ({ x: p.x, y: p.y, w: p.w, h: p.h }), sortY: (p) => p.y + p.h,
    draw(c, p, e) {
      c.fillStyle = '#2a1f16'; c.fillRect(p.x, p.y - 60 + p.h, p.w, 60);
      if (p.shoji) for (let x = p.x + 10; x < p.x + p.w - 40; x += 60) {
        const moon = p.moon && x > p.x + p.w * 0.55 && x < p.x + p.w * 0.8;
        c.fillStyle = moon ? '#c9d2df' : '#b7ab8f'; c.fillRect(x, p.y - 52 + p.h, 50, 44);
        c.strokeStyle = '#2a1f16'; c.lineWidth = 1.5; for (let k = 1; k < 3; k++) { c.beginPath(); c.moveTo(x + k * 16.6, p.y - 52 + p.h); c.lineTo(x + k * 16.6, p.y - 8 + p.h); c.stroke(); } for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(x, p.y - 52 + p.h + k * 11); c.lineTo(x + 50, p.y - 52 + p.h + k * 11); c.stroke(); }
      }
      c.fillStyle = '#1a130d'; c.fillRect(p.x, p.y - 64 + p.h, p.w, 6);
    },
  };
  P.torii = {
    col: (p) => [{ x: p.x - p.w / 2 - 6, y: p.y - 6, w: 12, h: 8 }, { x: p.x + p.w / 2 - 6, y: p.y - 6, w: 12, h: 8 }], sortY: (p) => p.y,
    draw(c, p) {
      const w = p.w, h = p.h || 110, col = p.col || '#8f2a1f';
      c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(p.x - w / 2 - 6, p.y - 2, w + 12, 6);
      c.fillStyle = col; c.fillRect(p.x - w / 2 - 5, p.y - h, 10, h); c.fillRect(p.x + w / 2 - 5, p.y - h, 10, h);
      c.fillStyle = '#111'; c.fillRect(p.x - w / 2 - 6, p.y - 8, 12, 8); c.fillRect(p.x + w / 2 - 6, p.y - 8, 12, 8);
      c.fillStyle = col; c.fillRect(p.x - w / 2 - 14, p.y - h + 18, w + 28, 8);
      c.fillStyle = '#151515'; c.beginPath(); c.moveTo(p.x - w / 2 - 26, p.y - h - 4); c.quadraticCurveTo(p.x, p.y - h + 6, p.x + w / 2 + 26, p.y - h - 4); c.lineTo(p.x + w / 2 + 22, p.y - h + 6); c.quadraticCurveTo(p.x, p.y - h + 14, p.x - w / 2 - 22, p.y - h + 6); c.closePath(); c.fill();
      c.fillStyle = col; c.fillRect(p.x - 6, p.y - h + 4, 12, 16);
    },
  };
  P.well = {
    col: (p) => ({ x: p.x - 20, y: p.y - 14, w: 40, h: 18 }), sortY: (p) => p.y,
    draw(c, p) {
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(p.x + 3, p.y + 2, 26, 9, 0, 0, TAU); c.fill();
      c.fillStyle = '#5a5850'; c.beginPath(); c.ellipse(p.x, p.y - 8, 22, 10, 0, 0, TAU); c.fill(); c.fillRect(p.x - 22, p.y - 8, 44, 8); c.beginPath(); c.ellipse(p.x, p.y, 22, 8, 0, 0, Math.PI); c.fill();
      c.fillStyle = '#0d1418'; c.beginPath(); c.ellipse(p.x, p.y - 9, 15, 6, 0, 0, TAU); c.fill();
      c.fillStyle = '#3b2b1f'; c.fillRect(p.x - 20, p.y - 46, 4, 38); c.fillRect(p.x + 16, p.y - 46, 4, 38);
      c.fillStyle = '#2b2f36'; c.beginPath(); c.moveTo(p.x - 28, p.y - 40); c.lineTo(p.x, p.y - 56); c.lineTo(p.x + 28, p.y - 40); c.fill();
      c.strokeStyle = '#8a7556'; c.beginPath(); c.moveTo(p.x, p.y - 44); c.lineTo(p.x, p.y - 22); c.stroke(); c.fillStyle = '#4a3a28'; c.fillRect(p.x - 4, p.y - 24, 8, 7);
    },
  };
  P.statue = {
    col: (p) => ({ x: p.x - 14, y: p.y - 10, w: 28, h: 12 }), sortY: (p) => p.y,
    draw(c, p) {
      const dir = p.dirFn ? p.dirFn() : p.dir || 1; const ang = [0, Math.PI / 2, Math.PI, -Math.PI / 2][dir];
      const fx = Math.cos(ang), fy = Math.sin(ang);
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(p.x, p.y, 18, 6, 0, 0, TAU); c.fill();
      c.fillStyle = '#5c5a52'; c.fillRect(p.x - 14, p.y - 14, 28, 14); c.fillStyle = '#4a4842'; c.fillRect(p.x - 16, p.y - 18, 32, 5);
      if (p.toppled) { c.fillStyle = '#77756c'; c.beginPath(); c.ellipse(p.x + 26, p.y - 4, 18, 8, 0.2, 0, TAU); c.fill(); return; }
      c.fillStyle = p.glow && p.glow() ? '#b3a37a' : '#7b796f';
      c.beginPath(); c.ellipse(p.x, p.y - 30, 10, 13, 0, 0, TAU); c.fill();
      c.beginPath(); c.arc(p.x + fx * 6, p.y - 44 + fy * 3, 7.5, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(p.x + fx * 6 - 6, p.y - 48 + fy * 3); c.lineTo(p.x + fx * 6 - 4, p.y - 58 + fy * 3); c.lineTo(p.x + fx * 6, p.y - 50); c.moveTo(p.x + fx * 6 + 6, p.y - 48 + fy * 3); c.lineTo(p.x + fx * 6 + 4, p.y - 58 + fy * 3); c.lineTo(p.x + fx * 6, p.y - 50); c.fill();
      c.beginPath(); c.moveTo(p.x + fx * 10, p.y - 44 + fy * 6); c.lineTo(p.x + fx * 18, p.y - 42 + fy * 10); c.lineTo(p.x + fx * 9 + fy * 3, p.y - 40 + fy * 6); c.fill();
      c.fillStyle = '#8B1E1E'; c.fillRect(p.x - 7, p.y - 36, 14, 3);
      c.strokeStyle = '#7b796f'; c.lineWidth = 5; c.beginPath(); c.moveTo(p.x - fx * 8, p.y - 22); c.quadraticCurveTo(p.x - fx * 20, p.y - 30, p.x - fx * 14, p.y - 44); c.stroke();
      if (p.puzzle) { c.strokeStyle = 'rgba(201,162,39,.6)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(p.x, p.y - 8); c.lineTo(p.x + fx * 26, p.y - 8 + fy * 14); c.stroke(); }
    },
  };
  P.altar = {
    col: (p) => ({ x: p.x - 26, y: p.y - 14, w: 52, h: 16 }), sortY: (p) => p.y,
    light: (p) => (p.glow && p.glow() ? { x: p.x, y: p.y - 20, r: 150, c: 'gold', i: 1, f: true } : null),
    draw(c, p) {
      c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(p.x - 30, p.y - 2, 60, 8);
      c.fillStyle = '#5e5b53'; c.fillRect(p.x - 26, p.y - 20, 52, 20); c.fillStyle = '#6e6b62'; c.fillRect(p.x - 30, p.y - 26, 60, 7);
      if (p.glow && p.glow()) { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(p.x, p.y - 30, 2, p.x, p.y - 30, 30); g.addColorStop(0, 'rgba(255,220,130,.9)'); g.addColorStop(1, 'rgba(255,200,100,0)'); c.fillStyle = g; c.fillRect(p.x - 30, p.y - 60, 60, 60); c.restore(); }
      if (p.item) { c.save(); c.translate(p.x - 12, p.y - 40); SV.Sprites.drawIcon(c, SV.ITEMS[p.item].icon, SV.ITEMS[p.item].col, 24); c.restore(); }
    },
  };
  P.hokora = {
    col: (p) => ({ x: p.x - 28, y: p.y - 18, w: 56, h: 20 }), sortY: (p) => p.y,
    light: (p, e) => (lit(e) ? { x: p.x, y: p.y - 10, r: 90, c: 'warm', i: 0.6 } : null),
    draw(c, p) {
      c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(p.x - 34, p.y - 2, 68, 8);
      c.fillStyle = '#5f5d56'; c.fillRect(p.x - 32, p.y - 16, 64, 16);
      c.fillStyle = '#3b2b1f'; c.fillRect(p.x - 22, p.y - 52, 44, 36);
      c.fillStyle = '#161210'; c.fillRect(p.x - 12, p.y - 46, 24, 28);
      if (p.crane) { c.strokeStyle = '#c9a227'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(p.x - 7, p.y - 30); c.quadraticCurveTo(p.x, p.y - 42, p.x + 7, p.y - 30); c.moveTo(p.x, p.y - 36); c.lineTo(p.x, p.y - 24); c.stroke(); }
      c.fillStyle = '#26292e'; c.beginPath(); c.moveTo(p.x - 32, p.y - 50); c.lineTo(p.x, p.y - 70); c.lineTo(p.x + 32, p.y - 50); c.fill();
      c.fillStyle = '#ece6d6'; c.fillRect(p.x - 3, p.y - 50, 6, 10);
    },
  };
  P.crate = { col: (p) => ({ x: p.x - 14, y: p.y - 12, w: 28, h: 14 }), sortY: (p) => p.y,
    draw(c, p) { c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(p.x - 14, p.y - 2, 32, 6); c.fillStyle = '#6b5236'; c.fillRect(p.x - 14, p.y - 26, 28, 26); c.strokeStyle = '#3e2f1e'; c.lineWidth = 2; c.strokeRect(p.x - 14, p.y - 26, 28, 26); c.beginPath(); c.moveTo(p.x - 14, p.y - 26); c.lineTo(p.x + 14, p.y); c.stroke(); } };
  P.barrel = { col: (p) => ({ x: p.x - 11, y: p.y - 8, w: 22, h: 10 }), sortY: (p) => p.y,
    draw(c, p) { c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(p.x + 2, p.y, 14, 5, 0, 0, TAU); c.fill(); c.fillStyle = '#5a4128'; c.fillRect(p.x - 11, p.y - 28, 22, 28); c.fillStyle = '#2a2a2a'; c.fillRect(p.x - 11, p.y - 24, 22, 3); c.fillRect(p.x - 11, p.y - 8, 22, 3); c.fillStyle = '#6b5236'; c.beginPath(); c.ellipse(p.x, p.y - 28, 11, 4, 0, 0, TAU); c.fill(); } };
  P.board = { col: (p) => ({ x: p.x - 30, y: p.y - 6, w: 60, h: 8 }), sortY: (p) => p.y,
    draw(c, p) { c.fillStyle = '#3b2b1f'; c.fillRect(p.x - 30, p.y - 52, 5, 52); c.fillRect(p.x + 25, p.y - 52, 5, 52); c.fillStyle = '#5d4a33'; c.fillRect(p.x - 32, p.y - 58, 64, 36); c.fillStyle = '#2b2f36'; c.fillRect(p.x - 36, p.y - 64, 72, 7);
      c.fillStyle = '#e4dbc4'; c.fillRect(p.x - 26, p.y - 52, 14, 20); c.fillRect(p.x - 8, p.y - 54, 14, 24); c.fillRect(p.x + 10, p.y - 50, 14, 18); c.fillStyle = '#8B1E1E'; c.fillRect(p.x - 5, p.y - 52, 8, 3); } };
  P.forge = { col: (p) => ({ x: p.x - 26, y: p.y - 16, w: 52, h: 18 }), sortY: (p) => p.y,
    light: () => ({ x: 0, y: 0, r: 0 }), // replaced in lights() so it's always on
    draw(c, p) { c.fillStyle = '#3a3833'; c.fillRect(p.x - 26, p.y - 40, 52, 40); c.fillStyle = '#2a2826'; c.fillRect(p.x - 18, p.y - 70, 22, 32);
      const fl = 0.75 + Math.sin(time * 12) * 0.1 + Math.random() * 0.1; c.fillStyle = `rgba(255,${120 + fl * 60},40,${fl})`; c.fillRect(p.x - 14, p.y - 30, 28, 14);
      c.fillStyle = '#1b1a18'; c.fillRect(p.x + 30, p.y - 18, 20, 6); c.fillRect(p.x + 36, p.y - 12, 8, 12); } };
  P.campfire = { col: (p) => ({ x: p.x - 12, y: p.y - 6, w: 24, h: 8 }), sortY: (p) => p.y,
    draw(c, p) { c.fillStyle = '#2a2420'; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; c.beginPath(); c.arc(p.x + Math.cos(a) * 13, p.y + Math.sin(a) * 5, 4, 0, TAU); c.fill(); }
      if (p.lit === false) return;
      c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 3; i++) { const h = 16 + Math.random() * 10; c.fillStyle = ['rgba(255,90,20,.7)', 'rgba(255,160,40,.6)', 'rgba(255,230,120,.5)'][i]; c.beginPath(); c.moveTo(p.x - 8 + i * 3, p.y); c.quadraticCurveTo(p.x - 4 + Math.random() * 8, p.y - h, p.x + 8 - i * 3, p.y); c.fill(); } c.restore(); } };
  P.tent = { col: (p) => ({ x: p.x - 34, y: p.y - 20, w: 68, h: 22 }), sortY: (p) => p.y,
    draw(c, p) { c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(p.x - 38, p.y - 4, 80, 10); c.fillStyle = p.col || '#5a4a35'; c.beginPath(); c.moveTo(p.x - 38, p.y); c.lineTo(p.x, p.y - 50); c.lineTo(p.x + 38, p.y); c.fill(); c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.moveTo(p.x - 10, p.y); c.lineTo(p.x, p.y - 30); c.lineTo(p.x + 10, p.y); c.fill(); } };
  P.log = { col: (p) => ({ x: p.x - p.w / 2, y: p.y - 10, w: p.w, h: 12 }), sortY: (p) => p.y,
    draw(c, p) { c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(p.x - p.w / 2, p.y - 2, p.w, 6); c.fillStyle = '#4a3828'; c.fillRect(p.x - p.w / 2, p.y - 18, p.w, 16); c.fillStyle = '#6b5236'; c.beginPath(); c.ellipse(p.x + p.w / 2, p.y - 10, 5, 8, 0, 0, TAU); c.fill(); c.strokeStyle = '#3a2a1e'; c.beginPath(); c.arc(p.x + p.w / 2, p.y - 10, 3, 0, TAU); c.stroke(); c.fillStyle = 'rgba(80,110,50,.5)'; c.fillRect(p.x - p.w / 3, p.y - 19, p.w / 3, 4); } };
  P.gate = { col: (p) => (p.open && p.open() ? [{ x: p.x - p.w / 2 - 20, y: p.y - 10, w: 20, h: 12 }, { x: p.x + p.w / 2, y: p.y - 10, w: 20, h: 12 }] : { x: p.x - p.w / 2 - 20, y: p.y - 10, w: p.w + 40, h: 12 }), sortY: (p) => p.y,
    draw(c, p) {
      const open = p.open && p.open();
      c.fillStyle = '#2e241a'; c.fillRect(p.x - p.w / 2 - 14, p.y - 96, 14, 96); c.fillRect(p.x + p.w / 2, p.y - 96, 14, 96);
      c.fillStyle = '#1e1a16'; c.fillRect(p.x - p.w / 2 - 24, p.y - 104, p.w + 48, 10);
      if (!open) { c.fillStyle = '#4a3a28'; c.fillRect(p.x - p.w / 2, p.y - 80, p.w, 80); c.strokeStyle = '#2a2018'; c.lineWidth = 2; for (let x = p.x - p.w / 2 + 10; x < p.x + p.w / 2; x += 12) { c.beginPath(); c.moveTo(x, p.y - 80); c.lineTo(x, p.y); c.stroke(); }
        c.fillStyle = '#5a5850'; c.beginPath(); c.arc(p.x, p.y - 44, 12, 0, TAU); c.fill(); c.fillStyle = '#c9a227'; c.font = '700 13px "Shippori Mincho",serif'; c.textAlign = 'center'; c.fillText(p.glyph || '封', p.x, p.y - 39); }
      else { c.fillStyle = '#4a3a28'; c.fillRect(p.x - p.w / 2 - 6, p.y - 80, 10, 80); c.fillRect(p.x + p.w / 2 - 4, p.y - 80, 10, 80); }
    } };
  P.plantern = { // puzzle stone lantern
    col: (p) => ({ x: p.x - 9, y: p.y - 6, w: 18, h: 8 }), sortY: (p) => p.y,
    light: (p) => (p.lit && p.lit() ? { x: p.x, y: p.y - 24, r: 120, c: p.col === 'blue' ? 'blue' : 'warm', i: 1, f: true } : null),
    draw(c, p) {
      P.lantern.draw(c, p, { night: 0 });
      const on = p.lit && p.lit(); c.fillStyle = on ? '#ffd27a' : '#1d1c19'; c.fillRect(p.x - 4.5, p.y - 31, 9, 7);
      c.fillStyle = '#c9a227'; c.font = '700 12px "Shippori Mincho",serif'; c.textAlign = 'center'; c.fillText(p.glyph, p.x, p.y + 14);
    } };
  P.tablet = { col: (p) => ({ x: p.x - 16, y: p.y - 8, w: 32, h: 10 }), sortY: (p) => p.y,
    draw(c, p) { c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(p.x - 18, p.y - 2, 40, 6); c.fillStyle = '#4e4c46'; c.beginPath(); c.moveTo(p.x - 16, p.y); c.lineTo(p.x - 16, p.y - 40); c.quadraticCurveTo(p.x, p.y - 52, p.x + 16, p.y - 40); c.lineTo(p.x + 16, p.y); c.fill();
      c.fillStyle = p.glyphCol || 'rgba(201,162,39,.8)'; c.font = '700 14px "Shippori Mincho",serif'; c.textAlign = 'center'; c.fillText(p.glyph || '碑', p.x, p.y - 20); } };
  P.grave = { col: (p) => ({ x: p.x - 8, y: p.y - 6, w: 16, h: 8 }), sortY: (p) => p.y,
    draw(c, p) { c.fillStyle = '#4a4842'; c.fillRect(p.x - 7, p.y - 30, 14, 30); c.fillStyle = '#5a5850'; c.fillRect(p.x - 10, p.y - 4, 20, 4); c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(p.x - 1, p.y - 26, 2, 18); } };
  P.cliff = { col: (p) => ({ x: p.x, y: p.y, w: p.w, h: p.h }), sortY: (p) => p.y + p.h,
    draw(c, p) { c.fillStyle = '#3d3c38'; c.fillRect(p.x, p.y - 30, p.w, p.h + 30); c.fillStyle = '#4c4a44'; for (let i = 0; i < p.w / 30; i++) c.fillRect(p.x + i * 30 + 4, p.y - 26 + (i % 3) * 8, 22, 16); c.fillStyle = '#2b3a24'; c.fillRect(p.x, p.y - 34, p.w, 8); } };
  P.waterfall = { col: () => null, sortY: (p) => p.y + 1,
    draw(c, p) { for (let i = 0; i < p.w; i += 4) { const a = 0.35 + Math.sin(time * 6 + i) * 0.15; c.fillStyle = `rgba(200,220,235,${a})`; c.fillRect(p.x + i, p.y - p.h + ((time * 120 + i * 7) % 20) - 20, 3, p.h); } c.fillStyle = 'rgba(230,240,250,.5)'; c.beginPath(); c.ellipse(p.x + p.w / 2, p.y, p.w * 0.7, 10, 0, 0, TAU); c.fill(); } };
  /* interior furniture */
  P.desk = { col: (p) => ({ x: p.x - 40, y: p.y - 14, w: 80, h: 16 }), sortY: (p) => p.y,
    draw(c, p) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(p.x - 42, p.y - 2, 86, 8); c.fillStyle = '#3a2618'; c.fillRect(p.x - 40, p.y - 26, 80, 26); c.fillStyle = '#4a3220'; c.fillRect(p.x - 42, p.y - 30, 84, 6); c.fillStyle = 'rgba(0,0,0,.6)'; c.beginPath(); c.ellipse(p.x + 10, p.y - 28, 24, 6, 0, 0, TAU); c.fill(); c.fillStyle = '#c8bfa8'; c.save(); c.translate(p.x - 20, p.y - 32); c.rotate(-0.2); c.fillRect(0, 0, 14, 9); c.restore(); } };
  P.hearth = { col: (p) => ({ x: p.x - 45, y: p.y - 45, w: 90, h: 90 }), sortY: (p) => p.y - 45, flat: true,
    light: () => ({ x: 0, y: 0, r: 0 }),
    draw(c, p) { c.fillStyle = '#2a1f16'; c.fillRect(p.x - 48, p.y - 48, 96, 96); c.fillStyle = '#4b4842'; c.fillRect(p.x - 40, p.y - 40, 80, 80); c.fillStyle = '#6d6a62'; c.fillRect(p.x - 32, p.y - 32, 64, 64);
      const g = c.createRadialGradient(p.x, p.y, 2, p.x, p.y, 24); g.addColorStop(0, `rgba(255,${120 + Math.sin(time * 4) * 30},40,.9)`); g.addColorStop(1, 'rgba(60,40,30,1)'); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, 22, 0, TAU); c.fill();
      if (p.board && p.board()) { c.fillStyle = '#4a3220'; c.fillRect(p.x + 50, p.y - 10, 26, 34); c.strokeStyle = '#c9a227'; c.lineWidth = 1; c.strokeRect(p.x + 50, p.y - 10, 26, 34); } } };
  P.armorstand = { col: (p) => ({ x: p.x - 16, y: p.y - 8, w: 32, h: 10 }), sortY: (p) => p.y,
    draw(c, p) { c.fillStyle = '#2a1f16'; c.fillRect(p.x - 2, p.y - 56, 4, 56); c.fillRect(p.x - 14, p.y - 4, 28, 4);
      c.fillStyle = '#5a2a2a'; c.fillRect(p.x - 14, p.y - 48, 28, 26); c.fillStyle = '#2a2a2a'; for (let y = p.y - 46; y < p.y - 24; y += 5) c.fillRect(p.x - 14, y, 28, 1.5);
      c.fillStyle = '#1e1e22'; c.beginPath(); c.arc(p.x, p.y - 56, 10, Math.PI, TAU); c.fill(); c.fillStyle = '#c9a227'; c.fillRect(p.x - 2, p.y - 70, 4, 8); } };
  P.shelf = { col: (p) => ({ x: p.x - 40, y: p.y - 10, w: 80, h: 12 }), sortY: (p) => p.y,
    draw(c, p) { c.fillStyle = '#3a2618'; c.fillRect(p.x - 40, p.y - 60, 80, 60); c.fillStyle = '#1e140c'; c.fillRect(p.x - 36, p.y - 56, 72, 24); c.fillRect(p.x - 36, p.y - 28, 72, 24);
      c.fillStyle = '#c8bfa8'; for (let i = 0; i < 5; i++) c.fillRect(p.x - 32 + i * 13, p.y - 50, 8, 16); c.fillStyle = '#6b5236'; c.fillRect(p.x - 30, p.y - 24, 20, 18); } };
  P.futon = { col: () => null, sortY: (p) => p.y - 40, flat: true,
    draw(c, p) { c.fillStyle = '#d8d0bc'; c.fillRect(p.x - 40, p.y - 70, 80, 120); c.fillStyle = '#4a5468'; c.fillRect(p.x - 40, p.y - 30, 80, 80); c.fillStyle = '#efe8d8'; c.fillRect(p.x - 18, p.y - 64, 36, 18); } };
  /* flat decals */
  P.decal = { col: () => null, flat: true, sortY: (p) => p.y,
    draw(c, p) {
      if (p.kind === 'scorch') { const g = c.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.r || 40); g.addColorStop(0, 'rgba(10,8,6,.7)'); g.addColorStop(1, 'rgba(10,8,6,0)'); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r || 40, 0, TAU); c.fill(); }
      if (p.kind === 'prints') { c.fillStyle = 'rgba(25,18,12,.55)'; for (let i = 0; i < 4; i++) { const a = p.a || 0; const ox = Math.cos(a) * i * 16 + (i % 2 ? 1 : -1) * Math.sin(a) * 5, oy = Math.sin(a) * i * 16 - (i % 2 ? 1 : -1) * Math.cos(a) * 5; c.save(); c.translate(p.x + ox, p.y + oy); c.rotate(a + Math.PI / 2); c.beginPath(); c.ellipse(0, 0, 3, 6, 0, 0, TAU); c.fill(); c.fillRect(-3, -9, 2, 3); c.restore(); } }
      if (p.kind === 'bridge') { c.fillStyle = '#5a4128'; c.fillRect(p.x, p.y, p.w, p.h); c.strokeStyle = '#3a2a1a'; c.lineWidth = 2; for (let x = p.x; x < p.x + p.w; x += 10) { c.beginPath(); c.moveTo(x, p.y); c.lineTo(x, p.y + p.h); c.stroke(); } c.fillStyle = '#8f2a1f'; c.fillRect(p.x, p.y - 4, p.w, 5); c.fillRect(p.x, p.y + p.h - 1, p.w, 5); }
      if (p.kind === 'moonbeam') { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(140,160,200,.08)'; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + 60, p.y); c.lineTo(p.x + 140, p.y + 260); c.lineTo(p.x + 30, p.y + 260); c.fill(); c.restore(); }
      if (p.kind === 'blood') { c.fillStyle = 'rgba(90,20,20,.45)'; c.beginPath(); c.ellipse(p.x, p.y, 18, 7, 0.3, 0, TAU); c.fill(); }
      if (p.kind === 'leaves') { const r = U.rng(p.x * 7 + p.y); for (let i = 0; i < 18; i++) { c.fillStyle = ['#8f2e1f', '#b5462a', '#6e2018', '#a8667a'][i % 4]; c.fillRect(p.x + (r() - 0.5) * 80, p.y + (r() - 0.5) * 40, 3, 2); } }
    } };
  P.footprint = { col: () => null, flat: true, sortY: (p) => p.y, draw: (c, p) => P.decal.draw(c, Object.assign({ kind: 'prints' }, p)) };

  /** Colliders for live props (+ water + bounds walls) */
  function rebuildColliders() {
    cols = [];
    for (const p of area.props) {
      if (!live(p)) continue;
      const def = P[p.t]; if (!def || !def.col || p.nocol) continue;
      const r = def.col(p); if (!r) continue;
      if (Array.isArray(r)) cols.push(...r); else cols.push(r);
    }
    for (const w of area.water || []) if (w.solid !== false) cols.push(w);
    for (const b of area.blocks || []) if (!b.when || b.when()) cols.push(b);
  }
  /** Circle vs rect pushout */
  function collide(e) {
    const r = e.r || 10;
    for (const b of cols) {
      const nx = U.clamp(e.x, b.x, b.x + b.w), ny = U.clamp(e.y, b.y, b.y + b.h);
      let dx = e.x - nx, dy = e.y - ny; const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 === 0) { // center inside rect: push out the shortest way
          const l = e.x - b.x, rr = b.x + b.w - e.x, t = e.y - b.y, bb = b.y + b.h - e.y; const m = Math.min(l, rr, t, bb);
          if (m === l) e.x = b.x - r; else if (m === rr) e.x = b.x + b.w + r; else if (m === t) e.y = b.y - r; else e.y = b.y + b.h + r;
        } else { const d = Math.sqrt(d2); e.x = nx + (dx / d) * r; e.y = ny + (dy / d) * r; }
      }
    }
    e.x = U.clamp(e.x, r, area.w - r); e.y = U.clamp(e.y, r, area.h - r);
  }
  function blocked(x, y, r = 6) { for (const b of cols) if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) return true; return false; }

  /* ---------------- particles ---------------- */
  function spawn(p) { if (particles.length > (SV.Settings.get().particles === 'low' ? 200 : 600)) particles.shift(); const o = Object.assign({ life: 1, vx: 0, vy: 0, g: 0, size: 2, col: '#fff', rot: 0, vr: 0 }, p); o._m = o.life; particles.push(o); }
  function burst(x, y, n, opts) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = U.rand(opts.smin || 40, opts.smax || 160); spawn(Object.assign({}, opts, { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts.up || 0), life: U.rand(0.3, opts.life || 0.7) })); } }
  function text(x, y, str, col = '#fff', big = false) { spawn({ type: 'text', x, y, vy: -40, str, col, big, life: 1, max: 1 }); }

  function updateParticles(dt, e) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life -= dt; if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.type === 'leaf' || p.type === 'petal') { p.vx += Math.sin(time * 2 + p.seed) * 20 * dt + e.wind * 30 * dt; }
      if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
    }
    // ambient emitters
    const cam = SV.Camera, view = viewRect();
    const q = SV.Settings.get().particles === 'low' ? 0.4 : 1;
    if (!area.indoor && Math.random() < dt * 5 * e.wind * q * (area.leafRate || 1)) spawn({ type: 'leaf', x: view.x + Math.random() * view.w, y: view.y - 20, vx: U.rand(10, 50), vy: U.rand(20, 45), life: 8, seed: Math.random() * 9, size: U.rand(2, 4), col: U.choice(area.leafCols || ['#8f2e1f', '#b5462a', '#c9a227', '#6e5a2a']), vr: U.rand(-3, 3) });
    for (const p of area.props) {
      if (p.x < view.x - 100 || p.x > view.x + view.w + 100 || p.y < view.y - 100 || p.y > view.y + view.h + 200) continue;
      if (p.t === 'tree' && p.kind === 'sakura' && Math.random() < dt * 1.2 * q) spawn({ type: 'petal', x: p.x + U.rand(-30, 30), y: p.y - p.r * 1.6, vx: U.rand(5, 25), vy: U.rand(12, 30), life: 5, seed: Math.random() * 9, size: 2.5, col: '#e8b4c4', vr: 3 });
      if ((p.t === 'campfire' && p.lit !== false) || p.t === 'forge' || p.t === 'fire') { if (Math.random() < dt * 8 * q) spawn({ type: 'ember', x: p.x + U.rand(-8, 8), y: p.y - (p.t === 'forge' ? 30 : 10), vx: U.rand(-15, 15), vy: U.rand(-70, -30), life: U.rand(0.6, 1.4), size: U.rand(1, 2.2), col: '#ffb050' }); if (Math.random() < dt * 3 * q) spawn({ type: 'smoke', x: p.x + U.rand(-5, 5), y: p.y - (p.t === 'forge' ? 70 : 20), vx: U.rand(-5, 15) + e.wind * 20, vy: U.rand(-30, -15), life: 3, size: U.rand(6, 10), col: 'rgba(80,80,80,' }); }
      if (p.t === 'waterfall' && Math.random() < dt * 10 * q) spawn({ type: 'mist', x: p.x + Math.random() * p.w, y: p.y, vx: U.rand(-20, 20), vy: U.rand(-30, -10), life: 1, size: 5, col: 'rgba(220,230,240,' });
    }
    if (e.night > 0.5 && (area.fireflies) && Math.random() < dt * 3 * q) spawn({ type: 'firefly', x: view.x + Math.random() * view.w, y: view.y + Math.random() * view.h, vx: U.rand(-10, 10), vy: U.rand(-10, 10), life: U.rand(3, 6), size: 1.6, col: '#d8f07a', seed: Math.random() * 9 });
    // fire on burning props
    (area.fires || []).forEach((f) => { if (Math.random() < dt * 14 * q) spawn({ type: 'flame', x: f.x + U.rand(-f.r, f.r), y: f.y, vx: U.rand(-10, 10), vy: U.rand(-90, -40), life: U.rand(0.4, 0.9), size: U.rand(4, 9), col: '' }); });
  }

  function drawParticles(c, layer) {
    for (const p of particles) {
      const k = p._m ? p.life / p._m : 1;
      if (p.type === 'text') continue;
      if (layer === 'top' && p.type !== 'slash' && p.type !== 'spark' && p.type !== 'leaf' && p.type !== 'petal' && p.type !== 'ring' && p.type !== 'after') continue;
      if (layer === 'mid' && (p.type === 'slash' || p.type === 'spark' || p.type === 'leaf' || p.type === 'petal' || p.type === 'ring' || p.type === 'after')) continue;
      c.globalAlpha = Math.min(1, k * 1.5);
      switch (p.type) {
        case 'leaf': case 'petal': c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.col; c.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size); c.restore(); break;
        case 'ember': case 'spark': case 'firefly':
          c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = p.col; const fs = p.type === 'firefly' ? p.size * (0.6 + 0.4 * Math.sin(time * 5 + p.seed)) : p.size; c.beginPath(); c.arc(p.x, p.y, fs, 0, TAU); c.fill(); c.restore(); break;
        case 'smoke': case 'mist': case 'dust': c.fillStyle = p.col + (0.25 * k) + ')'; c.beginPath(); c.arc(p.x, p.y, p.size * (2 - k), 0, TAU); c.fill(); break;
        case 'flame': c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,${Math.floor(80 + 150 * k)},${Math.floor(30 * k)},${0.6 * k})`; c.beginPath(); c.arc(p.x, p.y, p.size * k, 0, TAU); c.fill(); c.restore(); break;
        case 'ring': c.strokeStyle = p.col; c.lineWidth = 2 * k; c.beginPath(); c.arc(p.x, p.y, p.r0 + (1 - k) * p.r1, 0, TAU); c.stroke(); break;
        case 'slash': c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = p.col; c.lineWidth = 3 * k; c.beginPath(); c.moveTo(p.x - Math.cos(p.a) * p.len, p.y - Math.sin(p.a) * p.len); c.lineTo(p.x + Math.cos(p.a) * p.len, p.y + Math.sin(p.a) * p.len); c.stroke(); c.restore(); break;
        case 'after': c.globalAlpha = 0.35 * k; SV.Sprites.drawHuman(c, p.x, p.y, Object.assign({}, p.look, { flash: 0, noShadow: true })); break;
        default: c.fillStyle = p.col; c.fillRect(p.x, p.y, p.size, p.size);
      }
    }
    c.globalAlpha = 1;
  }
  function drawTexts(c) {
    for (const p of particles) if (p.type === 'text') {
      const k = p.life; c.globalAlpha = Math.min(1, k * 2);
      c.font = `${p.big ? 800 : 700} ${p.big ? 20 : 14}px "Shippori Mincho",serif`; c.textAlign = 'center';
      c.fillStyle = 'rgba(0,0,0,.7)'; c.fillText(p.str, p.x + 1, p.y + 1); c.fillStyle = p.col; c.fillText(p.str, p.x, p.y);
    }
    c.globalAlpha = 1;
  }

  /* ---------------- rendering ---------------- */
  function viewRect() { const cam = SV.Camera; const w = SV.Game.W / cam.zoom, h = SV.Game.H / cam.zoom; return { x: cam.x - w / 2, y: cam.y - h / 2, w, h }; }

  function drawGround(c, e) {
    const v = viewRect();
    const sx = Math.max(0, Math.floor(v.x)), sy = Math.max(0, Math.floor(v.y));
    const sw = Math.min(area.w - sx, Math.ceil(v.w) + 2), sh = Math.min(area.h - sy, Math.ceil(v.h) + 2);
    c.fillStyle = (area.ground && area.ground.outside) || '#0b0d0a'; c.fillRect(v.x - 2, v.y - 2, v.w + 4, v.h + 4);
    if (sw > 0 && sh > 0) c.drawImage(ground, sx, sy, sw, sh, sx, sy, sw, sh);
    // animated water
    for (const w of area.water || []) {
      if (w.x > v.x + v.w || w.x + w.w < v.x || w.y > v.y + v.h || w.y + w.h < v.y) continue;
      c.save(); c.beginPath(); c.rect(w.x, w.y, w.w, w.h); c.clip();
      c.strokeStyle = 'rgba(160,190,210,.12)'; c.lineWidth = 1.5;
      for (let y = w.y + 8; y < w.y + w.h; y += 14) { c.beginPath(); for (let x = w.x; x <= w.x + w.w; x += 10) { const yy = y + Math.sin(x * 0.05 + time * (w.flow ? 4 : 1.5) + y) * 2; x === w.x ? c.moveTo(x, yy) : c.lineTo(x, yy); } c.stroke(); }
      if (w.flow) { c.fillStyle = 'rgba(200,220,235,.1)'; for (let i = 0; i < w.w * w.h / 1500; i++) { const yy = (w.y + ((i * 53 + time * 60) % w.h)); c.fillRect(w.x + ((i * 37) % w.w), yy, 2, 8); } }
      if (e.night > 0.5) { c.fillStyle = 'rgba(200,210,230,.12)'; c.beginPath(); c.ellipse(w.x + w.w * 0.6, w.y + w.h * 0.4, 14, 5, 0, 0, TAU); c.fill(); }
      if (w.koi) for (let i = 0; i < 4; i++) { const a = time * 0.4 + i * 1.7; const kx = w.x + w.w / 2 + Math.cos(a) * w.w * 0.32, ky = w.y + w.h / 2 + Math.sin(a * 1.3) * w.h * 0.3; c.fillStyle = i % 2 ? '#d86a2a' : '#eee'; c.save(); c.translate(kx, ky); c.rotate(a + Math.PI / 2); c.beginPath(); c.ellipse(0, 0, 3, 8, 0, 0, TAU); c.fill(); c.restore(); }
      c.restore();
    }
    // grass tufts
    c.lineWidth = 1.4;
    for (const t of tufts) {
      if (t.x < v.x - 10 || t.x > v.x + v.w + 10 || t.y < v.y - 10 || t.y > v.y + v.h + 10) continue;
      const sw = Math.sin(time * 2 + t.s + t.x * 0.02) * e.wind * 3;
      c.strokeStyle = t.c; c.beginPath();
      c.moveTo(t.x - 2, t.y); c.quadraticCurveTo(t.x - 2, t.y - t.h * 0.6, t.x - 3 + sw, t.y - t.h);
      c.moveTo(t.x, t.y); c.quadraticCurveTo(t.x, t.y - t.h * 0.6, t.x + sw, t.y - t.h - 2);
      c.moveTo(t.x + 2, t.y); c.quadraticCurveTo(t.x + 2, t.y - t.h * 0.6, t.x + 3 + sw, t.y - t.h * 0.8);
      c.stroke();
    }
  }

  /** Collect lights for the darkness pass */
  function lights(e) {
    const L = [];
    for (const p of area.props) {
      if (!live(p)) continue;
      const def = P[p.t];
      if (p.t === 'forge') { L.push({ x: p.x, y: p.y - 24, r: 170, c: 'fire', i: 1, f: true }); continue; }
      if (p.t === 'hearth') { L.push({ x: p.x, y: p.y, r: 230, c: 'fire', i: 1, f: true }); continue; }
      if (p.t === 'campfire' && p.lit !== false) { L.push({ x: p.x, y: p.y - 10, r: 190, c: 'fire', i: 1, f: true }); continue; }
      if (def && def.light) { const l = def.light(p, e); if (l && l.r) L.push(l); }
    }
    (area.fires || []).forEach((f) => L.push({ x: f.x, y: f.y - 20, r: f.r * 4 + 120, c: 'fire', i: 1, f: true }));
    (area.lights || []).forEach((l) => L.push(l));
    return L;
  }
  const LCOL = { warm: [255, 190, 110], fire: [255, 140, 60], red: [230, 80, 60], gold: [255, 215, 120], blue: [140, 170, 255], moon: [150, 170, 220] };

  function drawLighting(c, e, W, H) {
    if (e.dark < 0.03 && !e.tint) return;
    if (!lightCanvas || lightCanvas.width !== W || lightCanvas.height !== H) { lightCanvas = document.createElement('canvas'); lightCanvas.width = W; lightCanvas.height = H; lctx = lightCanvas.getContext('2d'); }
    const cam = SV.Camera, z = cam.zoom * SV.Game.dpr;
    const toS = (x, y) => [(x - cam.x) * z + W / 2, (y - cam.y) * z + H / 2];
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, W, H);
    const night = e.night;
    lctx.fillStyle = `rgba(${Math.round(8 + 6 * (1 - night))},${Math.round(10 + 4 * (1 - night))},${Math.round(22 + 10 * night)},${e.dark})`;
    lctx.fillRect(0, 0, W, H);
    lctx.globalCompositeOperation = 'destination-out';
    const ls = lights(e);
    const P0 = SV.Player.e;
    if (e.dark > 0.3) ls.push({ x: P0.x, y: P0.y - 20, r: 190, c: 'warm', i: 0.72 });
    for (const l of ls) {
      const [sx, sy] = toS(l.x, l.y); const fl = l.f ? 1 + Math.sin(time * 10 + l.x) * 0.04 + Math.random() * 0.03 : 1; const r = l.r * z * fl;
      if (sx < -r || sx > W + r || sy < -r || sy > H + r) continue;
      const g = lctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, `rgba(0,0,0,${l.i})`); g.addColorStop(0.5, `rgba(0,0,0,${l.i * 0.55})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g; lctx.beginPath(); lctx.arc(sx, sy, r, 0, TAU); lctx.fill();
    }
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(lightCanvas, 0, 0);
    // additive colour glow for lights
    if (e.dark > 0.2) {
      c.globalCompositeOperation = 'lighter';
      for (const l of ls) {
        const col = LCOL[l.c] || LCOL.warm; const [sx, sy] = toS(l.x, l.y); const r = l.r * z * 0.7;
        if (sx < -r || sx > W + r || sy < -r || sy > H + r) continue;
        const a = 0.16 * e.dark * (l.i || 1) * (l.f ? 0.9 + Math.random() * 0.15 : 1);
        const g = c.createRadialGradient(sx, sy, 0, sx, sy, r); g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.beginPath(); c.arc(sx, sy, r, 0, TAU); c.fill();
      }
    }
    if (e.tint) { c.globalCompositeOperation = 'soft-light'; c.fillStyle = `rgba(${e.tint[0]},${e.tint[1]},${e.tint[2]},${e.tint[3] * 1.1})`; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over'; c.fillStyle = `rgba(${e.tint[0]},${e.tint[1]},${e.tint[2]},${e.tint[3] * 0.22})`; c.fillRect(0, 0, W, H); }
    c.restore();
  }

  function drawWeather(c, e, W, H, dt) {
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    const q = SV.Settings.get().particles === 'low' ? 0.4 : 1;
    // fog: always a little in forest/shrine, more in fog weather
    const fogA = (e.weather === 'fog' ? 0.55 : 0) + (area.fog || 0);
    if (fogA > 0.01) {
      for (const b of fogBlobs) {
        b.x += b.vx * dt * (0.5 + e.wind); if (b.x - b.r > 1.2) b.x = -b.r;
        const r = b.r * Math.max(W, H);
        const g = c.createRadialGradient(b.x * W, b.y * H, 0, b.x * W, b.y * H, r);
        const fc = e.night > 0.5 ? '150,160,180' : '210,210,205';
        g.addColorStop(0, `rgba(${fc},${0.22 * fogA * b.a})`); g.addColorStop(1, `rgba(${fc},0)`);
        c.fillStyle = g; c.fillRect(0, 0, W, H);
      }
      c.fillStyle = `rgba(${e.night > 0.5 ? '90,100,120' : '190,190,185'},${0.1 * fogA})`; c.fillRect(0, 0, W, H);
    }
    if (e.weather === 'rain' && !e.indoor) {
      const target = Math.floor(260 * q);
      while (rain.length < target) rain.push({ x: Math.random() * W, y: Math.random() * H, l: U.rand(10, 22), s: U.rand(700, 1100) });
      c.strokeStyle = 'rgba(180,195,215,.32)'; c.lineWidth = 1; c.beginPath();
      const slant = 0.18 + e.wind * 0.15;
      for (const d of rain) {
        d.y += d.s * dt; d.x += d.s * slant * dt;
        if (d.y > H) { d.y = -20; d.x = Math.random() * W * 1.2 - W * 0.1; if (Math.random() < 0.3) spawn({ type: 'ring', x: SV.Camera.x + (d.x - W / 2) / (SV.Camera.zoom * SV.Game.dpr), y: SV.Camera.y + (Math.random() * H - H / 2) / (SV.Camera.zoom * SV.Game.dpr), r0: 1, r1: 6, col: 'rgba(200,215,230,.4)', life: 0.4 }); }
        c.moveTo(d.x, d.y); c.lineTo(d.x - d.l * slant, d.y - d.l);
      }
      c.stroke();
      c.fillStyle = 'rgba(40,50,65,.12)'; c.fillRect(0, 0, W, H);
    } else rain.length = 0;
    // vignette
    const vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${0.55 + (SV.Story ? SV.Story.vignette : 0)})`);
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
    c.restore();
  }

  /** Main world draw: ground, flat props, y-sorted props+entities, particles */
  function draw(c, entities, e) {
    drawGround(c, e);
    const v = viewRect();
    const visible = (p) => { const m = (p.w || 200) + 220; return p.x > v.x - m && p.x < v.x + v.w + m && p.y > v.y - 80 && p.y < v.y + v.h + 380; };
    const sorted = [];
    for (const p of area.props) {
      if (!live(p) || !visible(p)) continue;
      const def = P[p.t]; if (!def) continue;
      if (def.flat) { def.draw(c, p, e); continue; }
      sorted.push({ y: def.sortY ? def.sortY(p) : p.y, p, def });
    }
    for (const en of entities) sorted.push({ y: en.y, en });
    sorted.sort((a, b) => a.y - b.y);
    drawParticles(c, 'mid');
    for (const s of sorted) { if (s.en) s.en.draw(c, e); else s.def.draw(c, s.p, e); }
    drawParticles(c, 'top');
  }

  function update(dt) {
    time += dt;
    rebuildColliders();
    updateParticles(dt, env());
  }

  return {
    load, update, draw, drawLighting, drawWeather, drawTexts, collide, blocked, env, spawn, burst, text, viewRect, segDist,
    get area() { return area; }, get time() { return time; }, P, particles, rebuildColliders, lights,
  };
})();
