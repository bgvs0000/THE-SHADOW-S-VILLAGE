/* =========================================================
   INVENTORY — items, equipment, derived stats, and the
   inventory panel (categories, abilities, journal).
   ========================================================= */
SV.Stats = {
  get() {
    const s = SV.state, u = s.upgrades;
    const w = SV.ITEMS[s.equipped.weapon] || { dmg: 8 }, a = SV.ITEMS[s.equipped.armor] || {};
    return {
      dmg: (w.dmg || 8) * (1 + 0.15 * u.swordDmg),
      crit: 0.05 + (w.crit || 0) + 0.04 * u.swordCrit,
      speed: 1 + 0.08 * u.swordSpeed,
      heavyMul: 2.2 + 0.3 * u.swordHeavy,
      def: (a.def || 0) + 2 * u.armorDef,
      maxHp: 100 + (a.hp || 0) + 15 * u.armorHp,
      maxSt: 100 + 15 * u.armorStam,
      dodgeCost: Math.round(24 * (1 - 0.12 * u.armorDodge)),
    };
  },
};

SV.Inv = (function () {
  const U = SV.U;
  const inv = () => SV.state.inventory;
  function find(id) { return inv().find((s) => s.id === id); }
  function count(id) { const s = find(id); return s ? s.qty : 0; }
  function has(id, n = 1) { return count(id) >= n; }
  function add(id, qty = 1) {
    if (!SV.ITEMS[id]) return;
    const s = find(id); if (s) s.qty += qty; else inv().push({ id, qty });
    SV.Bus.emit('item', { id, qty }); SV.UI.refreshHud();
  }
  function remove(id, qty = 1) {
    const s = find(id); if (!s) return false;
    s.qty -= qty; if (s.qty <= 0) inv().splice(inv().indexOf(s), 1);
    SV.UI.refreshHud(); return true;
  }
  function addRyo(n) { SV.state.ryo += n; SV.UI.refreshHud(true); }
  function spend(n) { if (SV.state.ryo < n) return false; SV.state.ryo -= n; SV.UI.refreshHud(true); return true; }
  function equip(id) {
    const it = SV.ITEMS[id]; if (!it) return;
    if (it.cat === 'weapons') SV.state.equipped.weapon = id;
    if (it.cat === 'armor') { SV.state.equipped.armor = id; const st = SV.Stats.get(); SV.Player.e.hp = Math.min(SV.Player.e.hp, st.maxHp); }
    SV.Audio.play('anvil'); SV.UI.toast(`Equipped ${it.name}`); SV.Save.autosave('equip');
  }
  /** Use from inventory or quick slot */
  function use(id) {
    const it = SV.ITEMS[id]; if (!it || !has(id)) return false;
    if (id === 'medicinal_herb') return craftRemedy();
    if (it.cat === 'weapons' || it.cat === 'armor') { equip(id); return true; }
    if (it.cat !== 'consumables') { inspect(id); return false; }
    return SV.Player.useItem(id);
  }
  function craftRemedy() {
    if (!SV.state.abilities.healing) { SV.UI.toast('You do not yet know how to prepare herbs.', 'red'); SV.Audio.play('error'); return false; }
    if (count('medicinal_herb') < 3) { SV.UI.toast('Grinding a remedy takes 3 Shade Herbs.', 'red'); SV.Audio.play('error'); return false; }
    remove('medicinal_herb', 3); add('herbal_remedy', 1); SV.Audio.play('pickup'); SV.UI.toast('Crafted Herbal Remedy'); SV.Save.autosave('craft'); return true;
  }
  function inspect(id) { const it = SV.ITEMS[id]; SV.UI.toast(it.name + ' — ' + it.desc); }
  /** Best consumable for quick slot n (1 heal, 2 stamina, 3 utility) */
  function slotItem(n) {
    const order = { 1: ['health_potion', 'herbal_remedy', 'rice_ball'], 2: ['stamina_potion'], 3: ['smoke_bomb'] }[n];
    if (n === 1) { // pick best heal for missing HP
      const miss = SV.Stats.get().maxHp - (SV.Player.e ? SV.Player.e.hp : 0);
      const owned = order.filter((id) => has(id)); if (!owned.length) return order[0];
      owned.sort((a, b) => Math.abs(SV.ITEMS[a].heal - miss) - Math.abs(SV.ITEMS[b].heal - miss)); return owned[0];
    }
    return order.find((id) => has(id)) || order[0];
  }

  /* ---------------- panel ---------------- */
  let tab = 'weapons', sel = null, confirmDiscard = false;
  function open(startTab) {
    if (startTab) tab = startTab;
    const p = SV.UI.panel({ id: 'inv', title: 'INVENTORY', jp: '持ち物', cls: '', onClose: () => {} });
    const tabs = U.el('div', 'inv-tabs');
    [...SV.CATS, ['abilities', 'ABILITIES'], ['journal', 'JOURNAL']].forEach(([k, l]) => {
      const b = U.el('button', tab === k ? 'on' : '', l); b.onclick = () => { tab = k; sel = null; SV.Audio.play('ui'); render(p); }; tabs.appendChild(b);
    });
    p.panel.insertBefore(tabs, p.body);
    render(p);
  }
  function render(p) {
    p.panel.querySelectorAll('.inv-tabs button').forEach((b, i) => b.classList.toggle('on', [...SV.CATS.map((c) => c[0]), 'abilities', 'journal'][i] === tab));
    const body = p.body; body.innerHTML = '';
    if (tab === 'abilities') return renderAbilities(body);
    if (tab === 'journal') return renderJournal(body);
    const st = SV.Stats.get(); const s = SV.state;
    const wrap = U.el('div', 'inv');
    // left: equipment + stats
    const left = U.el('div', 'equip');
    [['WEAPON', s.equipped.weapon], ['ARMOR', s.equipped.armor]].forEach(([k, id]) => {
      const row = U.el('div', 'eq-slot'); row.appendChild(SV.Sprites.iconCanvas(id, 40));
      row.appendChild(U.el('div', '', `<small>${k}</small><b>${SV.ITEMS[id].name}</b>`)); left.appendChild(row);
    });
    const P = SV.Player.e;
    left.appendChild(U.el('div', 'stats', `<span>Health</span><span>${Math.round(P.hp)} / ${st.maxHp}</span><span>Stamina</span><span>${st.maxSt}</span><span>Blade damage</span><span>${st.dmg.toFixed(1)}</span><span>Critical</span><span>${Math.round(st.crit * 100)}%</span><span>Attack speed</span><span>×${st.speed.toFixed(2)}</span><span>Heavy multiplier</span><span>×${st.heavyMul.toFixed(1)}</span><span>Defense</span><span>${st.def}</span><span>Dodge cost</span><span>${st.dodgeCost}</span><span>Ryo</span><span>${s.ryo}</span>`));
    wrap.appendChild(left);
    // middle grid
    const grid = U.el('div', 'grid');
    const items = inv().filter((x) => SV.ITEMS[x.id] && SV.ITEMS[x.id].cat === tab);
    if (!items.length) grid.appendChild(U.el('div', 'empty-note', 'Nothing here yet.'));
    if (!sel || !items.find((x) => x.id === sel)) sel = items[0] ? items[0].id : null;
    items.forEach((x) => {
      const cell = U.el('button', 'cell' + (x.id === sel ? ' sel' : ''));
      cell.appendChild(SV.Sprites.iconCanvas(x.id, 44));
      if (x.qty > 1) cell.appendChild(U.el('span', 'q', x.qty));
      if (s.equipped.weapon === x.id || s.equipped.armor === x.id) cell.appendChild(U.el('span', 'eqd', 'EQ'));
      cell.onclick = () => { sel = x.id; confirmDiscard = false; SV.Audio.play('ui'); render(p); };
      cell.ondblclick = () => { use(x.id); render(p); };
      grid.appendChild(cell);
    });
    wrap.appendChild(grid);
    // right detail
    const det = U.el('div', 'detail');
    if (sel) {
      const it = SV.ITEMS[sel];
      det.innerHTML = `<div class="cat">${SV.CATS.find((c) => c[0] === it.cat)[1]}</div><h3>${it.name}</h3><p>${it.desc}</p>`;
      const kv = [];
      if (it.dmg) kv.push(['Damage', it.dmg]); if (it.crit) kv.push(['Critical', '+' + Math.round(it.crit * 100) + '%']);
      if (it.def != null && it.cat === 'armor') kv.push(['Defense', it.def]); if (it.hp) kv.push(['Max HP', '+' + it.hp]);
      if (it.heal) kv.push(['Restores', it.heal + ' HP']); if (it.slot) kv.push(['Quick slot', it.slot]);
      kv.push(['Owned', count(sel)]); if (it.sell) kv.push(['Sell value', it.sell + ' Ryo']);
      det.appendChild(U.el('div', 'kv', kv.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('')));
      const row = U.el('div', 'btn-row');
      const mk = (label, cls, fn, dis) => { const b = U.el('button', 'btn ' + (cls || ''), label); b.disabled = !!dis; b.onclick = fn; row.appendChild(b); };
      if (it.cat === 'weapons' || it.cat === 'armor') mk(s.equipped.weapon === sel || s.equipped.armor === sel ? 'Equipped' : 'Equip', 'gold', () => { equip(sel); render(p); }, s.equipped.weapon === sel || s.equipped.armor === sel);
      if (it.cat === 'consumables') mk('Use', 'gold', () => { use(sel); render(p); });
      if (sel === 'medicinal_herb') mk('Grind remedy (3)', 'gold', () => { craftRemedy(); render(p); }, !s.abilities.healing || count(sel) < 3);
      mk('Inspect', '', () => inspect(sel));
      const equipped = s.equipped.weapon === sel || s.equipped.armor === sel;
      mk(confirmDiscard ? 'Confirm discard' : 'Discard', 'red', () => {
        if (!confirmDiscard) { confirmDiscard = true; render(p); return; }
        remove(sel, 1); confirmDiscard = false; SV.Audio.play('ui_close'); SV.Save.autosave('discard'); render(p);
      }, it.noDiscard || equipped);
      det.appendChild(row);
      if (it.noDiscard) det.appendChild(U.el('p', '', '<small style="color:#777">Important item — cannot be discarded.</small>'));
    } else det.innerHTML = '<p style="color:#666">Select an item.</p>';
    wrap.appendChild(det);
    body.appendChild(wrap);
  }
  function renderAbilities(body) {
    const g = U.el('div', 'abil');
    SV.ABILITIES.forEach((a) => {
      const on = SV.state.abilities[a.id];
      g.appendChild(U.el('div', 'ab' + (on ? '' : ' locked'), `<b>${a.name}<em>${on ? a.key : 'LOCKED'}</em></b><p>${a.desc}</p><p style="color:#C9A227;font-size:11px">${on ? 'Unlocked' : 'Unlocks · ' + a.how}</p>`));
    });
    body.appendChild(U.el('p', '', '<span style="color:#888;font-size:12px">There are no levels on this road. Ren grows stronger through the blade he carries, the armor he wears, and what the story teaches him.</span>'));
    body.appendChild(g);
  }
  function renderJournal(body) {
    const g = U.el('div', 'journal');
    Object.entries(SV.COLLECTIBLE_SETS).forEach(([k, set]) => {
      const n = SV.Collect.count(k);
      const card = U.el('div', 'jr', `<b>${set.name}</b><div class="pips">${Array.from({ length: set.total }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>${n}/${set.total} found`);
      Object.entries(SV.LORE).filter(([id, L]) => L.set === k && SV.state.collected[id] && L.text).forEach(([id, L]) => card.appendChild(U.el('div', 'entry', `<b style="letter-spacing:.04em">${L.title}</b>${L.text}`)));
      g.appendChild(card);
    });
    const story = U.el('div', 'jr', '<b>CLUES</b>');
    const clues = [];
    if (has('burnt_letter')) clues.push('A burnt letter: "...the Crane must never find the—"');
    if (has('family_crest')) clues.push('Family crest: three feathers around a broken blade. "Where the blade sleeps, water falls."');
    if (has('crane_mask')) clues.push('The masked stranger wore a crane mask, and called you "his son."');
    if (SV.state.flags.goroTalked) clues.push('Bandits were paid by masked men to watch the village — and wait for Ren.');
    if (SV.state.flags.kenjiTalked) clues.push('White masks were seen digging at the old shrine, unable to open its deepest door.');
    if (has('crane_ledger')) clues.push('A ledger page names the Akagawa bandit camp as holder of "the second half."');
    story.appendChild(U.el('div', 'entry', clues.length ? clues.map((c) => '· ' + c).join('<br>') : 'Nothing yet.'));
    g.appendChild(story);
    body.appendChild(g);
  }
  return { add, remove, count, has, addRyo, spend, equip, use, slotItem, open, craftRemedy };
})();
