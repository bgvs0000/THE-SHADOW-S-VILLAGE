/* =========================================================
   COLLECTIBLES — persistent world pickups (ryo, lore, herbs,
   chests) and transient enemy drops. Lore unlocks journal
   entries; full sets grant rewards / secret-ending flags.
   ========================================================= */
SV.Collect = (function () {
  const U = SV.U;
  let drops = [];
  const KIND_COL = { ryo: '#C9A227', lore: '#e8e2d0', herb: '#7fbf4a', chest: '#8a6a40', item: '#C9A227' };

  function live() {
    const a = SV.World.area; if (!a || !a.pickups) return [];
    return a.pickups.filter((p) => !SV.state.collected[p.id] && (!p.when || p.when()));
  }
  function reset() { drops = []; }
  function drop(x, y, d) { drops.push(Object.assign({ x: x + U.rand(-14, 14), y: y + U.rand(-10, 10), t: 0, vy: -120 }, d)); }

  function update(dt) {
    const P = SV.Player.e; if (!P) return;
    for (const p of live()) {
      if (p.kind === 'chest') continue;
      const d = U.dist(P.x, P.y, p.x, p.y);
      if (d < 30) take(p);
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]; d.t += dt;
      const dist = U.dist(P.x, P.y, d.x, d.y);
      if (d.t > 0.5 && dist < 110) { const k = Math.min(1, dt * 8); d.x += (P.x - d.x) * k; d.y += (P.y - 10 - d.y) * k; }
      if (d.t > 0.5 && dist < 18) {
        if (d.ryo) { SV.Inv.addRyo(d.ryo); SV.Audio.play('coin'); }
        if (d.item) { SV.Inv.add(d.item, d.qty || 1); SV.UI.toast(`+ ${SV.ITEMS[d.item].name}${d.qty > 1 ? ' ×' + d.qty : ''}`); SV.Audio.play('pickup'); if (d.onTake) d.onTake(); SV.Save.autosave('drop'); }
        drops.splice(i, 1);
      }
      if (d.t > 60) drops.splice(i, 1);
    }
  }

  function take(p) {
    SV.state.collected[p.id] = true;
    if (p.kind === 'ryo') { SV.Inv.addRyo(p.amount); SV.UI.toast(`+ ${p.amount} Ryo`); SV.Audio.play('coin'); }
    if (p.kind === 'herb') { SV.Inv.add('medicinal_herb', 1); SV.Audio.play('pickup'); SV.Bus.emit('herb'); SV.UI.toast('+ Shade Herb'); }
    if (p.kind === 'lore') { lore(p.lore); return; }
    SV.World.burst(p.x, p.y - 10, 10, { type: 'spark', col: KIND_COL[p.kind] || '#fff', smin: 20, smax: 80, life: 0.6 });
    SV.Save.autosave('pickup');
  }

  /** Lore collectible: journal entry + presentation by set */
  function lore(id, fromInteract) {
    const L = SV.LORE[id]; if (!L) return;
    if (SV.state.collected[id] && fromInteract) { SV.UI.toast('A memory already yours.'); return; }
    SV.state.collected[id] = true;
    const set = SV.COLLECTIBLE_SETS[L.set];
    const n = count(L.set);
    SV.Audio.play(L.set === 'memory' ? 'chime' : 'pickup');
    const P = SV.Player.e; SV.World.burst(P.x, P.y - 20, 16, { type: 'spark', col: L.set === 'petal' ? '#e8b4c4' : '#C9A227', smin: 20, smax: 90, life: 0.8 });
    SV.UI.toast(`${set.name} · ${n}/${set.total}`, 'big');
    if (L.set === 'memory') SV.Story.memory(L);
    else if (L.set === 'scroll' || L.set === 'relic') SV.UI.loreCard(L);
    SV.Bus.emit('lore', { id, set: L.set, n });
    if (n === set.total) setComplete(L.set);
    SV.Save.autosave('lore');
  }
  function count(set) { return Object.keys(SV.LORE).filter((k) => SV.LORE[k].set === set && SV.state.collected[k]).length; }
  function setComplete(set) {
    const R = {
      relic: () => { SV.Inv.addRyo(150); SV.state.upgrades.swordCrit = Math.min(4, SV.state.upgrades.swordCrit + 1); return 'All Shrine Relics found — the blade feels keener. (+1 Critical tier, +150 Ryo)'; },
      scroll: () => { SV.Inv.add('tamahagane', 2); return 'All Ancient Scrolls read — Tetsuo will want to hear of this. (+2 Tamahagane)'; },
      memory: () => { SV.state.flags.allMemories = true; return "All Father's Memories recovered. Something in you has changed. (Secret ending path unlocked)"; },
      petal: () => 'All Lost Petals gathered. Return them to the monk at the village shrine.',
    }[set];
    if (R) setTimeout(() => SV.UI.toast(R(), 'big'), 1200);
  }

  function interactables() {
    return live().filter((p) => p.kind === 'chest').map((p) => ({ id: p.id, x: p.x, y: p.y, r: 50, label: 'Open chest', act: () => openChest(p) }));
  }
  function openChest(p) {
    SV.state.collected[p.id] = true;
    SV.Audio.play('door');
    const l = p.loot || {};
    if (l.ryo) drop(p.x, p.y, { ryo: l.ryo });
    Object.entries(l.items || {}).forEach(([id, q]) => drop(p.x, p.y, { item: id, qty: q }));
    SV.World.burst(p.x, p.y - 14, 18, { type: 'spark', col: '#C9A227', smin: 30, smax: 120, life: 0.7 });
    SV.Save.autosave('chest');
  }

  /** Drawable entities (y-sorted with everything else) */
  function entities() {
    const t = SV.World.time; const out = [];
    for (const p of live()) out.push({ y: p.y, draw: (c) => drawPickup(c, p, t) });
    for (const d of drops) out.push({ y: d.y, draw: (c) => drawDrop(c, d, t) });
    return out;
  }
  function drawPickup(c, p, t) {
    const bob = Math.sin(t * 3 + p.x) * 2.5;
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(p.x, p.y, 8, 3, 0, 0, Math.PI * 2); c.fill();
    if (p.kind === 'chest') {
      c.fillStyle = '#4a3220'; c.fillRect(p.x - 16, p.y - 20, 32, 20); c.fillStyle = '#5d4128'; c.fillRect(p.x - 17, p.y - 26, 34, 8);
      c.fillStyle = '#C9A227'; c.fillRect(p.x - 3, p.y - 20, 6, 6); c.fillStyle = '#2a2a2a'; c.fillRect(p.x - 16, p.y - 12, 32, 2);
      glint(c, p.x + 10, p.y - 24, t); return;
    }
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(p.x, p.y - 12 + bob, 0, p.x, p.y - 12 + bob, 18); const col = p.kind === 'lore' && SV.LORE[p.lore].set === 'petal' ? '232,150,180' : p.kind === 'herb' ? '120,200,90' : '201,162,39';
    g.addColorStop(0, `rgba(${col},.55)`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y - 12 + bob, 18, 0, Math.PI * 2); c.fill();
    c.restore();
    if (p.kind === 'ryo') { c.fillStyle = '#C9A227'; c.beginPath(); c.ellipse(p.x, p.y - 12 + bob, 6, 4, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#5a4a12'; c.fillRect(p.x - 1.5, p.y - 13.5 + bob, 3, 3); }
    else if (p.kind === 'herb') { c.save(); c.translate(p.x - 10, p.y - 24 + bob); SV.Sprites.drawIcon(c, 'herb', '#7fbf4a', 20); c.restore(); }
    else if (p.kind === 'lore') {
      const set = SV.LORE[p.lore].set;
      if (set === 'petal') { c.fillStyle = '#eab0c4'; for (let i = 0; i < 5; i++) { const a = i * 1.256 + t; c.beginPath(); c.ellipse(p.x + Math.cos(a) * 4, p.y - 12 + bob + Math.sin(a) * 4, 3.5, 2, a, 0, Math.PI * 2); c.fill(); } }
      else { c.save(); c.translate(p.x - 10, p.y - 24 + bob); SV.Sprites.drawIcon(c, set === 'memory' ? 'crest' : set === 'scroll' ? 'scroll' : 'key', set === 'memory' ? '#e8e2d0' : '#C9A227', 20); c.restore(); }
    }
    glint(c, p.x + 6, p.y - 20 + bob, t);
  }
  function drawDrop(c, d, t) {
    const lift = d.t < 0.5 ? Math.sin((d.t / 0.5) * Math.PI) * 18 : Math.sin(t * 4 + d.x) * 2;
    if (d.ryo) { c.fillStyle = '#C9A227'; c.beginPath(); c.ellipse(d.x, d.y - 8 - lift, 5, 3.5, 0, 0, Math.PI * 2); c.fill(); }
    else if (d.item) { c.save(); c.translate(d.x - 9, d.y - 22 - lift); const it = SV.ITEMS[d.item]; SV.Sprites.drawIcon(c, it.icon, it.col, 18); c.restore(); glint(c, d.x + 6, d.y - 22 - lift, t); }
  }
  function glint(c, x, y, t) {
    const k = (Math.sin(t * 2.5 + x) + 1) / 2; if (k < 0.7) return;
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(255,240,200,${(k - 0.7) * 3})`; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(x - 5, y); c.lineTo(x + 5, y); c.moveTo(x, y - 5); c.lineTo(x, y + 5); c.stroke(); c.restore();
  }
  return { update, entities, drop, lore, count, interactables, reset, live };
})();
