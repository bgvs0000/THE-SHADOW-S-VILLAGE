/* =========================================================
   SHOP — Tetsuo's forge (upgrades, armor, materials) and
   Okiku's general store (consumables). Buy & sell in Ryo.
   ========================================================= */
SV.Shop = (function () {
  const U = SV.U;
  const SHOPS = {
    smith: { name: 'TETSUO\'S FORGE', jp: '鍛冶屋', npc: 'tetsuo', tabs: [['up', 'UPGRADES'], ['armor', 'ARMOR'], ['mats', 'MATERIALS'], ['sell', 'SELL']],
      quotes: ['Iron sand from the river, leather from the tanner. Coin from you.', 'A blade is only as honest as the hand that tempers it.', 'You break it, I fix it. You break it twice, I charge double.'] },
    store: { name: 'OKIKU\'S GENERAL STORE', jp: '万屋', npc: 'okiku', tabs: [['buy', 'BUY'], ['sell', 'SELL']],
      quotes: ['Tonics are fresh, I promise. Mostly fresh.', 'Rice balls! Salted this morning.', 'Bandits stole my good sake. Everything else is still here.'] },
  };
  let cur = null, tab = null, panel = null;

  function open(id) {
    cur = SHOPS[id]; tab = cur.tabs[0][0];
    panel = SV.UI.panel({ id: 'shop', title: cur.name, jp: cur.jp });
    const tabs = U.el('div', 'inv-tabs');
    cur.tabs.forEach(([k, l]) => { const b = U.el('button', '', l); b.dataset.k = k; b.onclick = () => { tab = k; SV.Audio.play('ui'); render(); }; tabs.appendChild(b); });
    panel.panel.insertBefore(tabs, panel.body);
    render(U.choice(cur.quotes));
    SV.Audio.play('ui_open');
  }
  const canRepair = () => SV.Missions.done('m2', 'repair');

  function render(quote) {
    panel.panel.querySelectorAll('.inv-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.k === tab));
    const body = panel.body; body.innerHTML = '';
    const wrap = U.el('div', 'shop'); const list = U.el('div', 'shop-list');
    if (tab === 'up') renderUpgrades(list);
    else if (tab === 'armor') ['ronin_haori', 'shrine_lamellar'].forEach((id) => buyRow(list, id, id === 'shrine_lamellar' && !SV.Missions.missionDone('m3') ? 'Tetsuo is still finishing this (after Mission 03)' : null, true));
    else if (tab === 'mats') ['iron_ore', 'leather', 'tamahagane'].forEach((id) => buyRow(list, id, id === 'tamahagane' && !SV.Missions.missionDone('m2') ? 'Available after Mission 02' : null));
    else if (tab === 'buy') {
      const m3 = SV.Missions.missionDone('m3');
      [['health_potion'], ['stamina_potion'], ['rice_ball'], ['herbal_remedy', !m3 && 'Okiku needs a recipe first (Mission 03)'], ['smoke_bomb', !SV.state.abilities.smoke && '"Only for people who know how to use them." (Mission 03)'], ['medicinal_herb', !m3 && 'Not in stock'], ['leather'], ['iron_ore']].forEach(([id, lock]) => buyRow(list, id, lock || null));
    } else if (tab === 'sell') renderSell(list);
    wrap.appendChild(list);
    // side
    const side = U.el('div', 'shop-side');
    const sk = U.el('div', 'shopkeeper'); const cv = document.createElement('canvas'); cv.width = cv.height = 128; SV.Sprites.portrait(cv, SV.NPC.LOOK[cur.npc]); sk.appendChild(cv);
    sk.appendChild(U.el('div', '', `<b style="font-family:var(--f-display);font-size:16px">${SV.NPC.DEF[cur.npc].name}</b><br><small style="color:#C9A227;letter-spacing:.2em">${SV.NPC.DEF[cur.npc].role.toUpperCase()}</small>`));
    side.appendChild(sk);
    side.appendChild(U.el('div', 'shop-quote', '“' + (quote || panel.lastQuote || cur.quotes[0]) + '”')); if (quote) panel.lastQuote = quote;
    side.appendChild(U.el('div', 'wallet', `${SV.state.ryo} <small>RYO</small>`));
    side.appendChild(U.el('div', 'mats', ['iron_ore', 'leather', 'tamahagane'].map((m) => `<span>${SV.ITEMS[m].name}</span><b>${SV.Inv.count(m)}</b>`).join('')));
    wrap.appendChild(side);
    body.appendChild(wrap);
  }
  function row(list, iconId, title, sub, price, btnLabel, fn, disabled, extra) {
    const r = U.el('div', 'si-row'); r.appendChild(SV.Sprites.iconCanvas(iconId, 36));
    const nm = U.el('div', 'nm', `<b>${title}</b><span>${sub}</span>`); if (extra) nm.appendChild(extra); r.appendChild(nm);
    r.appendChild(U.el('div', 'pr', price));
    const b = U.el('button', 'btn gold', btnLabel); b.disabled = !!disabled; b.onclick = fn; r.appendChild(b);
    list.appendChild(r);
  }
  function buyRow(list, id, lock, single) {
    const it = SV.ITEMS[id]; const owned = SV.Inv.count(id);
    const ownedTxt = single && owned ? 'Owned' : `Owned ${owned}`;
    row(list, id, it.name, lock || it.desc, `${it.price}<small>RYO</small>`, single && owned ? 'Owned' : 'Buy', () => buy(id), lock || SV.state.ryo < it.price || (single && owned), U.el('span', '', `<span style="font-size:10px;color:#666">${ownedTxt}</span>`));
  }
  function buy(id) {
    const it = SV.ITEMS[id];
    if (!SV.Inv.spend(it.price)) { SV.Audio.play('error'); return; }
    SV.Inv.add(id, 1); SV.Audio.play('buy'); SV.UI.toast(`Bought ${it.name}`);
    if (it.cat === 'armor') SV.Inv.equip(id);
    SV.Save.autosave('purchase'); render(U.choice(['A fine choice.', 'Come back soon.', 'Pleasure doing business.']));
  }
  function renderUpgrades(list) {
    if (!canRepair()) { list.appendChild(U.el('p', '', '<span style="color:#999;font-size:13px;line-height:1.7">"Upgrade that road-bought stick? I\'d be wasting good iron. Bring me a blade with a history, and I\'ll give it a future."<br><small style="color:#C9A227">Upgrades unlock once your father\'s katana is reforged (Mission 02).</small></span>')); return; }
    ['sword', 'armor'].forEach((g) => {
      list.appendChild(U.el('div', 'sq-title', g === 'sword' ? 'BLADE · ' + SV.ITEMS[SV.state.equipped.weapon].name.toUpperCase() : 'ARMOR · ' + SV.ITEMS[SV.state.equipped.armor].name.toUpperCase()));
      Object.entries(SV.UPGRADES).filter(([, u]) => u.group === g).forEach(([k, u]) => {
        const t = SV.state.upgrades[k]; const maxed = t >= u.max;
        const tiers = U.el('div', 'tiers', Array.from({ length: u.max }, (_, i) => `<i class="${i < t ? 'on' : ''}"></i>`).join(''));
        let price = 'MAX', ok = false, matsTxt = '';
        if (!maxed) {
          const ryo = u.ryo[t]; const mats = u.mats(t);
          ok = SV.state.ryo >= ryo && Object.entries(mats).every(([m, q]) => SV.Inv.count(m) >= q);
          matsTxt = Object.entries(mats).map(([m, q]) => `<span class="${SV.Inv.count(m) >= q ? '' : 'miss'}">${q} ${SV.ITEMS[m].name}</span>`).join(' · ');
          price = `${ryo}<small>RYO</small>`;
        }
        const ex = U.el('div', '', ''); ex.appendChild(tiers); if (matsTxt) ex.appendChild(U.el('div', '', `<span style="font-size:10.5px;color:#888">${matsTxt}</span>`));
        row(list, g === 'sword' ? SV.state.equipped.weapon : SV.state.equipped.armor, u.name, u.desc, price, maxed ? 'Maxed' : 'Upgrade', () => upgrade(k), maxed || !ok, ex);
      });
    });
  }
  function upgrade(k) {
    const u = SV.UPGRADES[k], t = SV.state.upgrades[k]; const ryo = u.ryo[t], mats = u.mats(t);
    if (!SV.Inv.spend(ryo)) return;
    Object.entries(mats).forEach(([m, q]) => SV.Inv.remove(m, q));
    SV.state.upgrades[k]++;
    SV.Audio.play('anvil'); SV.Audio.play('buy'); SV.UI.flash(0.15);
    SV.UI.toast(`${u.name} → Tier ${SV.state.upgrades[k]}`, 'big');
    if (k === 'armorHp') SV.Player.e.hp += 15;
    SV.Save.autosave('upgrade'); render('The steel took it well. So did my wallet.');
  }
  function renderSell(list) {
    const items = SV.state.inventory.filter((s) => { const it = SV.ITEMS[s.id]; return it && it.sell && !it.noDiscard && s.id !== SV.state.equipped.weapon && s.id !== SV.state.equipped.armor; });
    if (!items.length) { list.appendChild(U.el('div', 'empty-note', 'Nothing to sell.')); return; }
    items.forEach((s) => { const it = SV.ITEMS[s.id]; row(list, s.id, `${it.name} ×${s.qty}`, it.desc, `${it.sell}<small>RYO</small>`, 'Sell', () => { SV.Inv.remove(s.id, 1); SV.Inv.addRyo(it.sell); SV.Audio.play('coin'); SV.Save.autosave('sell'); render(); }); });
  }
  return { open };
})();
