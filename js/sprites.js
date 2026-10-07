/* =========================================================
   SPRITES — procedural character + icon art.
   Replace with image sprites by registering SV.Assets keys:
   drawHuman checks SV.Assets.img(o.sprite) first.
   ========================================================= */
SV.Sprites = (function () {
  const TAU = Math.PI * 2;
  function ell(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); }
  function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }

  /** Humanoid: feet at (x,y). o = appearance + animation state */
  function drawHuman(c, x, y, o) {
    const img = o.sprite && SV.Assets.img(o.sprite);
    c.save(); c.translate(x, y);
    const s = o.scale || 1; c.scale(s, s);
    if (o.alpha != null) c.globalAlpha *= o.alpha;
    if (img) { c.drawImage(img, -img.width / 2, -img.height); c.restore(); return; }
    const f = o.facing || 0, fx = Math.cos(f), fy = Math.sin(f);
    const side = fx >= 0 ? 1 : -1;
    const up = fy < -0.35;
    const walk = o.walk || 0;
    const bob = o.moving ? Math.abs(Math.sin(walk)) * 1.6 : Math.sin((o.t || 0) * 2) * 0.4;
    const kneel = o.kneel ? 9 : 0;
    const bow = o.bow || 0;
    // shadow
    if (!o.noShadow) { c.fillStyle = 'rgba(0,0,0,.35)'; ell(c, 0, 0, 13, 4.5); }
    c.translate(0, kneel);
    // legs
    const lp = o.moving ? Math.sin(walk) * 4 : 0;
    c.fillStyle = o.legs || '#141416';
    if (!o.kneel) { c.fillRect(-6 + lp * 0.4, -9, 4.5, 9 + (lp > 0 ? 0 : -1)); c.fillRect(1.5 - lp * 0.4, -9, 4.5, 9 + (lp < 0 ? 0 : -1)); }
    c.translate(0, -bob);
    const hit = o.flash > 0;
    // weapon behind body when facing up
    const drawWeapon = () => weapon(c, o, fx, fy, side);
    if (up) drawWeapon();
    // hakama / lower robe
    c.fillStyle = hit ? '#fff' : o.robe || '#1e1e22';
    c.beginPath(); c.moveTo(-8, -22); c.lineTo(8, -22); c.lineTo(11, -6); c.lineTo(-11, -6); c.closePath(); c.fill();
    // pleat lines
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-2, -20); c.lineTo(-3, -7); c.moveTo(3, -20); c.lineTo(4, -7); c.stroke();
    if (o.apron) { c.fillStyle = o.apron; c.fillRect(-7, -24, 14, 16); }
    // torso (leaning when bowing)
    c.save(); c.translate(0, -22); c.rotate(bow * 0.5 * side);
    c.fillStyle = hit ? '#fff' : o.top || '#2a2a2f';
    c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); c.lineTo(7, -12); c.lineTo(-7, -12); c.closePath(); c.fill();
    // collar V
    if (!up) { c.strokeStyle = o.collar || '#d8d2c4'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-4, -12); c.lineTo(0, -6); c.lineTo(4, -12); c.stroke(); }
    // sash
    c.fillStyle = o.sash || '#8B1E1E'; c.fillRect(-8, -3, 16, 3.2);
    // arms
    c.fillStyle = hit ? '#fff' : o.top || '#2a2a2f';
    c.fillRect(-10.5, -11, 3.5, 9); c.fillRect(7, -11, 3.5, 9);
    // head
    const hy = -18;
    c.fillStyle = o.skin || '#d4ae86'; circ(c, 0, hy, 6.6);
    // hair
    c.fillStyle = o.hair || '#121212';
    if (o.hat !== 'bald') {
      c.beginPath();
      if (up) c.arc(0, hy, 6.9, 0, TAU);
      else c.arc(0, hy - 0.5, 6.9, Math.PI * 1.02, Math.PI * 1.98);
      c.fill();
      if (o.hat === 'bun') circ(c, 0, hy - 7, 3.4);
      else if (o.hat === 'long') { c.fillRect(-7, hy - 2, 3, 10); c.fillRect(4, hy - 2, 3, 10); }
      else if (o.hat !== 'kasa' && o.hat !== 'hood') { c.fillRect(-1.4 - side * 2, hy - 10, 3, 4); circ(c, -side * 2, hy - 10, 2.2); }
    }
    if (!up && !o.mask) {
      c.fillStyle = '#1a1310';
      const ex = fx * 2.5; c.fillRect(-2.6 + ex, hy - 0.5, 1.4, 1.4); c.fillRect(1.4 + ex, hy - 0.5, 1.4, 1.4);
      if (o.beard) { c.fillStyle = o.beard; c.beginPath(); c.moveTo(-4, hy + 3); c.lineTo(4, hy + 3); c.lineTo(0, hy + 10); c.closePath(); c.fill(); }
    }
    if (o.headband && !up) { c.fillStyle = o.headband; c.fillRect(-6.8, hy - 3.5, 13.6, 2); }
    if (o.headband) {
      const tail = Math.sin((o.t || 0) * 8) * 2;
      c.strokeStyle = o.headband; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-side * 6, hy - 3); c.quadraticCurveTo(-side * 11, hy - 1 + tail, -side * 15, hy + 2 + tail); c.stroke();
    }
    if (o.mask === 'crane' && !up) {
      c.fillStyle = '#ece9e2'; c.beginPath(); c.ellipse(fx * 1.5, hy + 0.5, 5.6, 6.3, 0, 0, TAU); c.fill();
      c.fillStyle = '#8B1E1E'; c.fillRect(-4 + fx * 1.5, hy - 3, 8, 1.4);
      c.fillStyle = '#111'; c.fillRect(-3 + fx * 2, hy - 0.5, 2, 1); c.fillRect(1 + fx * 2, hy - 0.5, 2, 1);
      c.fillStyle = '#c9a227'; c.beginPath(); c.moveTo(fx * 2 - 1, hy + 1.5); c.lineTo(fx * 2 + 1, hy + 1.5); c.lineTo(fx * 2, hy + 6); c.fill();
    }
    if (o.hat === 'kasa') {
      c.fillStyle = o.hatCol || '#9c8455';
      c.beginPath(); c.moveTo(-15, hy - 1); c.lineTo(0, hy - 11); c.lineTo(15, hy - 1); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.moveTo(-8, hy - 4.5); c.lineTo(8, hy - 4.5); c.stroke();
    }
    if (o.hat === 'hood') { c.fillStyle = o.hatCol || '#1a1a1a'; c.beginPath(); c.arc(0, hy - 1, 7.6, Math.PI, TAU); c.fill(); c.fillRect(-7.6, hy - 1, 2.5, 7); c.fillRect(5.1, hy - 1, 2.5, 7); }
    c.restore();
    if (!up) drawWeapon();
    c.restore();
  }

  /** Weapons: sheathed, swinging, blocking, charging */
  function weapon(c, o, fx, fy, side) {
    if (!o.weapon || o.weapon === 'none') return;
    if (o.weapon === 'staff') { c.strokeStyle = '#6b5236'; c.lineWidth = 2; c.beginPath(); c.moveTo(side * 11, -34); c.lineTo(side * 11, 0); c.stroke(); return; }
    if (o.weapon === 'hammer') { c.strokeStyle = '#5a4630'; c.lineWidth = 2; c.beginPath(); c.moveTo(side * 10, -24); c.lineTo(side * 14, -8); c.stroke(); c.fillStyle = '#333'; c.fillRect(side * 14 - 4, -12, 8, 5); return; }
    const hx = fx * 7, hy = -26 + fy * 3;
    const blade = o.bladeCol || '#d9dde2';
    const len = o.weapon === 'broken' ? 13 : 30;
    let a = null;
    if (o.attack) {
      const at = o.attack; const p = SV.U.easeOut(SV.U.clamp(at.p, 0, 1));
      a = at.from + (at.to - at.from) * p;
      // slash trail
      if (at.p > 0.1 && at.p < 0.95) {
        c.save(); c.globalCompositeOperation = 'lighter';
        const r = len + 10; const trailStart = at.from + (at.to - at.from) * Math.max(0, p - 0.45);
        const grd = c.createRadialGradient(hx, hy, r * 0.4, hx, hy, r + 6);
        grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.8, at.heavy ? 'rgba(255,210,150,.55)' : 'rgba(235,240,255,.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = grd; c.beginPath();
        const ccw = at.to < at.from;
        c.arc(hx, hy, r + 6, trailStart, a, ccw); c.arc(hx, hy, r * 0.5, a, trailStart, !ccw); c.closePath(); c.fill();
        c.restore();
      }
    } else if (o.block) a = (o.facing || 0) - side * 1.25;
    else if (o.charge) a = (o.facing || 0) + Math.PI + side * 0.6;
    if (a == null) {
      // sheathed at hip
      c.strokeStyle = '#151515'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(side * 2, -17); c.lineTo(-side * 15, -6); c.stroke();
      c.strokeStyle = o.handle || '#8B1E1E'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(side * 2, -17); c.lineTo(side * 8, -21); c.stroke();
      return;
    }
    const tx = hx + Math.cos(a) * len, ty = hy + Math.sin(a) * len * 0.85;
    c.strokeStyle = o.charge ? '#ffe2a8' : blade; c.lineWidth = 2; c.beginPath(); c.moveTo(hx, hy); c.lineTo(tx, ty); c.stroke();
    if (o.charge) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(255,200,120,.4)'; c.lineWidth = 5; c.stroke(); c.restore(); }
    c.strokeStyle = o.handle || '#8B1E1E'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx - Math.cos(a) * 7, hy - Math.sin(a) * 6); c.stroke();
    c.fillStyle = '#c9a227'; circ(c, hx, hy, 1.8);
  }

  function drawWolf(c, x, y, o) {
    c.save(); c.translate(x, y);
    const side = Math.cos(o.facing || 0) >= 0 ? 1 : -1;
    c.fillStyle = 'rgba(0,0,0,.35)'; ell(c, 0, 0, 18, 5);
    c.scale(side, 1);
    const w = o.moving ? Math.sin(o.walk) * 3 : 0;
    const col = o.flash > 0 ? '#fff' : o.col || '#5b5e63';
    c.fillStyle = '#2a2b2e';
    c.fillRect(-11 + w, -9, 3, 9); c.fillRect(8 - w, -9, 3, 9); c.fillRect(-7 - w, -9, 3, 9); c.fillRect(4 + w, -9, 3, 9);
    c.fillStyle = col; ell(c, 0, -13, 15, 7);
    c.beginPath(); c.moveTo(-14, -15); c.quadraticCurveTo(-24, -20 + w, -26, -12); c.lineTo(-14, -11); c.fill();
    ell(c, 14, -18, 6.5, 5.5);
    c.beginPath(); c.moveTo(17, -18); c.lineTo(26, -15); c.lineTo(17, -13); c.fill();
    c.beginPath(); c.moveTo(11, -22); c.lineTo(12, -28); c.lineTo(15, -22); c.fill();
    c.fillStyle = o.alert ? '#e04040' : '#d9c37a'; c.fillRect(16, -20, 2, 1.6);
    c.restore();
  }

  /* ---------- Item icons (inventory / shop / quick slots) ---------- */
  function drawIcon(c, icon, col, size) {
    c.save(); c.clearRect(0, 0, size, size); c.translate(size / 2, size / 2); c.scale(size / 48, size / 48);
    c.lineCap = 'round'; c.lineJoin = 'round';
    switch (icon) {
      case 'katana': case 'broken':
        c.rotate(-Math.PI / 4);
        c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.moveTo(-6, 0); c.lineTo(icon === 'broken' ? 4 : 20, 0); c.stroke();
        if (icon === 'broken') { c.beginPath(); c.moveTo(4, -2); c.lineTo(7, 1); c.lineTo(4, 2); c.fillStyle = col; c.fill(); }
        c.fillStyle = '#c9a227'; c.fillRect(-8, -4, 2.5, 8);
        c.strokeStyle = '#8B1E1E'; c.lineWidth = 4; c.beginPath(); c.moveTo(-9, 0); c.lineTo(-19, 0); c.stroke(); break;
      case 'garb': case 'armor':
        c.fillStyle = col; c.beginPath(); c.moveTo(-14, -14); c.lineTo(14, -14); c.lineTo(18, -4); c.lineTo(11, -2); c.lineTo(11, 16); c.lineTo(-11, 16); c.lineTo(-11, -2); c.lineTo(-18, -4); c.closePath(); c.fill();
        c.strokeStyle = '#ddd'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-5, -14); c.lineTo(0, -4); c.lineTo(5, -14); c.stroke();
        c.fillStyle = '#8B1E1E'; c.fillRect(-11, 2, 22, 4);
        if (icon === 'armor') { c.strokeStyle = 'rgba(0,0,0,.4)'; for (let i = -8; i < 16; i += 5) { c.beginPath(); c.moveTo(-11, i + 6); c.lineTo(11, i + 6); c.stroke(); } } break;
      case 'potion':
        c.fillStyle = '#6b5236'; c.fillRect(-3, -18, 6, 5);
        c.fillStyle = col; c.beginPath(); c.arc(0, -6, 7, 0, TAU); c.fill(); c.beginPath(); c.arc(0, 8, 11, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(-4, 4, 3, 0, TAU); c.fill();
        c.strokeStyle = '#c9a227'; c.lineWidth = 2; c.beginPath(); c.moveTo(-6, 0); c.lineTo(6, 0); c.stroke(); break;
      case 'rice':
        c.fillStyle = '#eee'; c.beginPath(); c.moveTo(0, -15); c.quadraticCurveTo(16, 10, 12, 13); c.lineTo(-12, 13); c.quadraticCurveTo(-16, 10, 0, -15); c.fill();
        c.fillStyle = '#1d2b1d'; c.fillRect(-8, 3, 16, 11); break;
      case 'bomb':
        c.fillStyle = '#333'; c.beginPath(); c.arc(0, 4, 13, 0, TAU); c.fill(); c.fillStyle = '#555'; c.beginPath(); c.arc(-4, 0, 4, 0, TAU); c.fill();
        c.strokeStyle = '#a08a5a'; c.lineWidth = 2; c.beginPath(); c.moveTo(4, -8); c.quadraticCurveTo(8, -16, 14, -14); c.stroke();
        c.fillStyle = '#e8a33a'; c.beginPath(); c.arc(14, -14, 3, 0, TAU); c.fill(); break;
      case 'crest':
        c.fillStyle = col; c.beginPath(); c.arc(0, 0, 16, 0, TAU); c.fill(); c.fillStyle = '#3a2e08'; c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.fill();
        c.fillStyle = col; for (let i = 0; i < 3; i++) { c.save(); c.rotate(i * TAU / 3); c.beginPath(); c.ellipse(0, -7, 3, 6, 0.4, 0, TAU); c.fill(); c.restore(); }
        c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(-1, 6); c.lineTo(1, -3); c.stroke(); break;
      case 'scroll':
        c.fillStyle = col; c.fillRect(-12, -14, 24, 28); c.fillStyle = '#6b5236'; c.fillRect(-15, -16, 30, 4); c.fillRect(-15, 12, 30, 4);
        c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1.2; for (let i = -8; i < 10; i += 4) { c.beginPath(); c.moveTo(-8, i); c.lineTo(8, i); c.stroke(); } break;
      case 'mask':
        c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, 13, 16, 0, 0, TAU); c.fill();
        c.fillStyle = '#8B1E1E'; c.fillRect(-10, -8, 20, 3); c.fillStyle = '#111'; c.fillRect(-8, -2, 5, 2); c.fillRect(3, -2, 5, 2);
        c.strokeStyle = '#333'; c.lineWidth = 1; c.beginPath(); c.moveTo(4, -15); c.lineTo(-2, 0); c.lineTo(3, 12); c.stroke(); break;
      case 'key':
        c.strokeStyle = col; c.lineWidth = 3.5; c.beginPath(); c.arc(-8, -8, 7, 0, TAU); c.stroke();
        c.beginPath(); c.moveTo(-3, -3); c.lineTo(14, 14); c.moveTo(9, 9); c.lineTo(5, 13); c.moveTo(13, 13); c.lineTo(9, 17); c.stroke(); break;
      case 'shard':
        c.fillStyle = col; c.beginPath(); c.moveTo(-3, -16); c.lineTo(6, -6); c.lineTo(2, 16); c.lineTo(-5, 4); c.closePath(); c.fill();
        c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.moveTo(-2, -12); c.lineTo(2, -6); c.lineTo(-2, 2); c.fill(); break;
      case 'herb':
        c.strokeStyle = '#3c5a28'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 16); c.lineTo(0, -10); c.stroke();
        c.fillStyle = col; [[-1, -10, -0.6], [1, -4, 0.6], [-1, 2, -0.6], [1, 8, 0.6]].forEach(([s, y, r]) => { c.save(); c.translate(0, y); c.rotate(r); c.beginPath(); c.ellipse(s * 7, 0, 7, 3, 0, 0, TAU); c.fill(); c.restore(); }); break;
      case 'sandal':
        c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, 8, 15, 0, 0, TAU); c.fill(); c.strokeStyle = '#8B1E1E'; c.lineWidth = 2; c.beginPath(); c.moveTo(-7, -2); c.lineTo(0, -10); c.lineTo(7, -2); c.stroke(); break;
      case 'comb':
        c.fillStyle = col; c.beginPath(); c.moveTo(-15, -2); c.quadraticCurveTo(0, -16, 15, -2); c.closePath(); c.fill();
        c.fillStyle = '#c9a227'; for (let i = -12; i <= 12; i += 3) c.fillRect(i, -2, 1.5, 10); break;
      case 'ore':
        c.fillStyle = col; c.beginPath(); c.moveTo(-14, 8); c.lineTo(-8, -10); c.lineTo(6, -13); c.lineTo(15, 2); c.lineTo(6, 13); c.lineTo(-8, 12); c.fill();
        c.fillStyle = '#9aa0a6'; c.fillRect(-3, -4, 3, 3); c.fillRect(5, 2, 2, 2); break;
      case 'leather':
        c.fillStyle = col; c.beginPath(); c.moveTo(-14, -12); c.lineTo(12, -14); c.lineTo(15, 10); c.lineTo(-10, 14); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(0,0,0,.35)'; c.setLineDash([2, 2]); c.strokeRect(-9, -8, 18, 17); c.setLineDash([]); break;
      case 'ingot':
        c.fillStyle = col; c.beginPath(); c.moveTo(-16, 6); c.lineTo(-10, -6); c.lineTo(10, -6); c.lineTo(16, 6); c.closePath(); c.fill();
        c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(-8, -4, 16, 3); break;
      case 'coinitem':
        c.fillStyle = col; c.fillRect(-8, -14, 16, 28); c.fillStyle = '#3a2e18'; c.fillRect(-5, -9, 10, 2); c.fillRect(-5, -3, 10, 2); c.fillRect(-5, 3, 10, 2); break;
      default:
        c.fillStyle = col || '#888'; c.beginPath(); c.arc(0, 0, 12, 0, TAU); c.fill();
    }
    c.restore();
  }
  function iconCanvas(id, size = 48) {
    const it = SV.ITEMS[id]; const cv = document.createElement('canvas'); cv.width = cv.height = size;
    drawIcon(cv.getContext('2d'), it ? it.icon : '', it ? it.col : '#888', size); return cv;
  }
  /** Close-up portrait for dialogue/shop */
  function portrait(cv, look) {
    const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
    const s = cv.width / 120;
    c.save(); c.scale(s, s);
    const g = c.createRadialGradient(60, 40, 10, 60, 60, 80); g.addColorStop(0, '#2b2520'); g.addColorStop(1, '#0a0a0a'); c.fillStyle = g; c.fillRect(0, 0, 120, 120);
    if (look && look.wolf) drawWolf(c, 60, 108, Object.assign({ facing: 0 }, look));
    else drawHuman(c, 60, 168, Object.assign({ facing: Math.PI / 2, scale: 3.3, noShadow: true, t: performance.now() / 1000 }, look || {}));
    c.restore();
  }
  return { drawHuman, drawWolf, drawIcon, iconCanvas, portrait };
})();
