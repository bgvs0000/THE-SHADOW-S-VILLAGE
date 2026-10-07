/* =========================================================
   MAP — world region map (10 regions, locks, mission and
   shop markers, fast travel) + live local area map.
   ========================================================= */
SV.Map = (function () {
  const U = SV.U;
  const SPAWN = { village: [1300, 1080], bamboo_edge: [1200, 1780], deep_bamboo: [1200, 1880], shrine: [300, 120] };
  let sel = null;
  const regionOf = (areaId) => SV.REGIONS.find((r) => (r.areas || []).includes(areaId));
  const isOpen = (r) => !!(r.open && r.open());
  const discovered = (r) => (r.areas || []).some((a) => SV.state.discovered[a]);

  function open() {
    const p = SV.UI.panel({ id: 'map', title: 'MAP', jp: '地図' });
    const here = regionOf(SV.World.area.id);
    sel = sel || (here && here.id);
    const wrap = U.el('div', 'map-wrap');
    const wm = U.el('div', 'wmap');
    const tgt = SV.Missions.target(); const tReg = tgt && regionOf(tgt.area);
    let svg = '<svg viewBox="0 0 100 100" preserveAspectRatio="none">';
    SV.REGION_LINKS.forEach(([a, b]) => { const A = SV.REGIONS.find((r) => r.id === a), B = SV.REGIONS.find((r) => r.id === b); const lit = isOpen(A) && isOpen(B); svg += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${lit ? '#8a7020' : '#333'}" stroke-width="${lit ? 0.5 : 0.35}" stroke-dasharray="${lit ? '0' : '1.2 1.2'}" vector-effect="non-scaling-stroke"/>`; });
    svg += '</svg>';
    wm.innerHTML = svg;
    SV.REGIONS.forEach((r) => {
      const open = isOpen(r), disc = discovered(r);
      const cls = ['node', open ? '' : 'locked', here === r ? 'here' : '', tReg === r ? 'mission' : '', open && !disc ? 'unexplored' : '', sel === r.id ? 'sel' : ''].join(' ');
      const b = U.el('button', cls, `<span class="dot"></span><span class="nm">${open ? r.name.toUpperCase() : (disc ? r.name.toUpperCase() : r.name.toUpperCase())}</span><span class="tag">${!open ? '🔒 LOCKED' : here === r ? '◆ YOU ARE HERE' : !disc ? 'UNEXPLORED' : r.shops ? 'SHOPS · QUESTS' : ''}</span>`);
      b.style.left = r.x + '%'; b.style.top = r.y + '%';
      b.onclick = () => { sel = r.id; SV.Audio.play('ui'); SV.UI.closePanel(); open_(); };
      wm.appendChild(b);
    });
    wrap.appendChild(wm);
    const side = U.el('div', 'map-side');
    const cv = document.createElement('canvas'); cv.className = 'amap'; cv.width = 520; cv.height = 400; side.appendChild(cv);
    drawArea(cv, tgt);
    const r = SV.REGIONS.find((x) => x.id === sel) || here;
    const info = U.el('div', 'map-info');
    if (r) {
      const open = isOpen(r);
      info.innerHTML = `<b>${r.name} <span style="color:#b42a2a;font-size:12px;letter-spacing:.3em">${r.jp}</span></b>` +
        (open ? (here === r ? `You are in <em style="color:#C9A227;font-style:normal">${SV.World.area.name || SV.AREAS[SV.World.area.id].name}</em>.` : discovered(r) ? 'Discovered. Fast travel is available.' : 'Unexplored — reach it on foot first.') : `<div class="lock">LOCKED</div>${r.lock}`) +
        (tReg === r ? `<div style="color:#b42a2a;margin-top:6px">◆ Current objective: ${SV.Missions.cur().o.text}</div>` : '');
      if (open && discovered(r) && here !== r) {
        const b = U.el('button', 'btn gold', 'Fast travel'); b.style.marginTop = '10px';
        const busy = SV.Enemies.anyAggro();
        b.disabled = busy; if (busy) b.title = 'Not while enemies are hunting you';
        b.onclick = () => { const aid = r.areas.find((a) => SV.state.discovered[a]); const [x, y] = SPAWN[aid]; SV.UI.closePanel(); SV.Game.travel(aid, x, y); };
        info.appendChild(b);
        if (busy) info.appendChild(U.el('div', 'lock', 'Not while enemies are hunting you'));
      }
    }
    side.appendChild(info);
    side.appendChild(U.el('div', 'legend', '<span><i style="background:#C9A227"></i>You</span><span><i style="background:#b42a2a;transform:rotate(45deg)"></i>Objective</span><span><i style="background:#ddd;border-radius:50%"></i>Villager</span><span><i style="border:1px solid #C9A227"></i>Quest</span><span><i style="background:#8a7020"></i>Exit / path</span><span>鍛 店 Shops</span>'));
    wrap.appendChild(side);
    p.body.appendChild(wrap);
  }
  const open_ = () => open();

  function drawArea(cv, tgt) {
    const c = cv.getContext('2d'); const a = SV.World.area; const W = cv.width, H = cv.height;
    c.fillStyle = '#0b0b0b'; c.fillRect(0, 0, W, H);
    const s = Math.min((W - 30) / a.w, (H - 30) / a.h); const ox = (W - a.w * s) / 2, oy = (H - a.h * s) / 2;
    const X = (x) => ox + x * s, Y = (y) => oy + y * s;
    c.fillStyle = a.indoor ? '#2a2418' : '#161a12'; c.fillRect(X(0), Y(0), a.w * s, a.h * s);
    c.strokeStyle = '#333'; c.strokeRect(X(0), Y(0), a.w * s, a.h * s);
    (a.water || []).forEach((w) => { c.fillStyle = '#1b2c38'; c.fillRect(X(w.x), Y(w.y), w.w * s, w.h * s); });
    (a.plazas || []).forEach((p) => { c.fillStyle = '#3a352c'; c.beginPath(); c.arc(X(p.x), Y(p.y), p.r * s, 0, Math.PI * 2); c.fill(); });
    c.lineCap = 'round';
    (a.paths || []).forEach((p) => { c.strokeStyle = '#4a4232'; c.lineWidth = Math.max(2, p.w * s); c.beginPath(); p.pts.forEach(([x, y], i) => (i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)))); c.stroke(); });
    a.props.forEach((p) => {
      if (p.when && !p.when()) return;
      if (p.t === 'house' || p.t === 'shrineHall') { c.fillStyle = p.burnt ? '#3a2a22' : '#5a5245'; c.fillRect(X(p.x), Y(p.y), p.w * s, p.h * s); }
      else if (p.t === 'tree' || p.t === 'bamboo') { c.fillStyle = p.t === 'bamboo' ? '#2b3a20' : '#22301c'; c.fillRect(X(p.x) - 1.5, Y(p.y) - 1.5, 3, 3); }
      else if (p.t === 'iwall' || p.t === 'wall') { c.fillStyle = '#3a3026'; c.fillRect(X(p.x), Y(p.y), p.w * s, Math.max(2, p.h * s)); }
    });
    if (a.id === 'village') { c.font = '700 13px "Shippori Mincho",serif'; c.fillStyle = '#C9A227'; c.textAlign = 'center'; c.fillText('鍛', X(1940), Y(1180)); c.fillText('店', X(970), Y(1170)); c.fillText('長', X(1850), Y(625)); c.fillText('父', X(600), Y(705)); c.fillText('社', X(1525), Y(1680)); c.fillText('道場', X(770), Y(1410)); c.fillText('札', X(1180), Y(890)); }
    (a.exits || []).forEach((e) => { const locked = e.locked && e.locked(); c.fillStyle = locked ? '#5a1a1a' : '#C9A227'; c.fillRect(X(e.x), Y(e.y), Math.max(4, e.w * s), Math.max(4, e.h * s)); if (e.label) { c.font = '10px sans-serif'; c.fillStyle = locked ? '#7a3a3a' : '#a08a40'; c.textAlign = 'center'; const tx = U.clamp(X(e.x + e.w / 2), 40, W - 40), ty = U.clamp(Y(e.y + e.h / 2) + (e.y < 50 ? 14 : -6), 12, H - 6); c.fillText((locked ? '🔒 ' : '') + e.label, tx, ty); } });
    SV.NPC.visibleList().forEach((n) => { const hot = n.d.hot && n.d.hot(); c.fillStyle = hot ? '#C9A227' : '#ddd'; c.beginPath(); c.arc(X(n.x), Y(n.y), hot ? 4 : 2.5, 0, Math.PI * 2); c.fill(); });
    SV.Enemies.alive().forEach((e) => { c.fillStyle = '#b42a2a'; c.fillRect(X(e.x) - 2, Y(e.y) - 2, 4, 4); });
    if (tgt && tgt.area === a.id) { c.save(); c.translate(X(tgt.x), Y(tgt.y)); c.rotate(Math.PI / 4); c.fillStyle = '#b42a2a'; c.fillRect(-5, -5, 10, 10); c.strokeStyle = '#fff'; c.strokeRect(-5, -5, 10, 10); c.restore(); }
    const P = SV.Player.e; c.save(); c.translate(X(P.x), Y(P.y)); c.rotate(P.facing); c.fillStyle = '#C9A227'; c.beginPath(); c.moveTo(8, 0); c.lineTo(-5, -5); c.lineTo(-5, 5); c.closePath(); c.fill(); c.restore();
    c.fillStyle = '#888'; c.font = '11px sans-serif'; c.textAlign = 'left'; c.fillText((SV.AREAS[a.id].name || '').toUpperCase(), 10, 16);
  }
  return { open, SPAWN };
})();
