/* =========================================================
   UI — HUD, toasts, generic panels, pause / settings / saves /
   missions / credits, quest board, result + death screens.
   ========================================================= */
SV.UI = (function () {
  const U = SV.U;
  const $ = (id) => document.getElementById(id);
  let current = null; // open panel
  let idleT = 0, lastHp = 100, lagHp = 100;

  /* ---------------- generic panel ---------------- */
  function panel(o) {
    closePanel(true);
    const wrap = U.el('div', 'pw' + (o.menu ? ' menu-layer' : ''));
    const p = U.el('div', 'panel ' + (o.cls || ''));
    const head = U.el('div', 'ph', `<h2>${o.title}</h2><span class="jp">${o.jp || ''}</span>`);
    const x = U.el('button', 'x', '✕'); x.setAttribute('aria-label', 'Close'); x.onclick = () => closePanel(); head.appendChild(x);
    const body = U.el('div', 'pb');
    p.append(head, body); wrap.appendChild(p);
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) closePanel(); });
    (o.menu ? document.body : $('panels')).appendChild(wrap);
    current = { id: o.id, wrap, panel: p, body, onClose: o.onClose, back: o.back };
    SV.Input.clearAll();
    return current;
  }
  function closePanel(silent) {
    if (!current) return;
    const c = current; current = null; c.wrap.remove();
    if (!silent) { SV.Audio.play('ui_close'); if (c.onClose) c.onClose(); if (c.back) c.back(); }
    SV.Input.clearAll();
  }
  const panelOpen = () => !!current || !!document.querySelector('#panels .result');
  const panelId = () => current && current.id;

  /* ---------------- HUD ---------------- */
  function refreshHud(bumpRyo) {
    const r = $('ryoNum'); if (!r) return;
    if (r.textContent !== String(SV.state.ryo)) { r.textContent = SV.state.ryo; if (bumpRyo) { const el = r.parentElement; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } }
    // quick slots
    const qs = $('quickSlots'); qs.innerHTML = '';
    [1, 2, 3].forEach((n) => {
      const id = SV.Inv.slotItem(n); const q = SV.Inv.count(id);
      const s = U.el('div', 'slot' + (q ? '' : ' empty')); s.appendChild(SV.Sprites.iconCanvas(id, 30));
      s.appendChild(U.el('span', 'k', n)); s.appendChild(U.el('span', 'q', q)); qs.appendChild(s);
    });
  }
  function updateHud(dt) {
    const P = SV.Player.e; if (!P) return;
    const st = SV.Stats.get();
    const hp = Math.max(0, P.hp / st.maxHp);
    $('hpFill').style.transform = `scaleX(${hp})`;
    if (hp < lagHp) setTimeout(() => (lagHp = hp), 0); else lagHp = hp;
    $('hpLag').style.transform = `scaleX(${lagHp})`;
    $('hpNum').textContent = Math.ceil(P.hp);
    $('stFill').style.transform = `scaleX(${Math.max(0, P.st / st.maxSt)})`;
    $('rsFill').style.transform = `scaleX(${P.resolve / 100})`;
    const rs = $('rsFill').parentElement; rs.classList.toggle('full', P.resolve >= 99.5 && SV.state.abilities.shadowStrike);
    const e = SV.World.env();
    $('hudTime').textContent = e.indoor ? 'Indoors' : e.phase + (e.weather !== 'clear' ? ' · ' + (e.weather === 'rain' ? 'Rain' : 'Fog') : '');
    $('hudArea').textContent = SV.AREAS[SV.World.area.id].name;
    // idle fade: full HUD when fighting, hurt, or low stamina
    const busy = SV.Enemies.anyAggro() || P.hp < st.maxHp * 0.6 || P.st < st.maxSt * 0.9 || P.resolve > 0.5;
    idleT = busy ? 0 : idleT + dt;
    $('hud').classList.toggle('idle', idleT > 4);
    $('controlsHud').style.display = SV.Settings.get().hints ? '' : 'none';
  }
  function refreshMission(justId) {
    const c = SV.Missions.cur(); if (!c) return;
    const m = c.m;
    $('mhNum').textContent = m.num; $('mhTitle').textContent = m.title;
    const ul = $('mhObj'); ul.innerHTML = '';
    if (m.future) { ul.appendChild(U.el('li', 'cur', m.obj[0].text)); return; }
    const curIdx = m.obj.indexOf(c.o);
    m.obj.forEach((o, i) => {
      const done = SV.state.obj[m.id + '.' + o.id];
      if (!done && i > curIdx + 1) return; // keep HUD light: show done, current, next
      const li = U.el('li', done ? 'done' : i === curIdx ? 'cur' : 'future', U.esc(o.text) + (o.count && !done ? `<span class="ct">${Math.min(o.count, o.prog ? o.prog() : 0)}/${o.count}</span>` : ''));
      if (justId === o.id) li.classList.add('just');
      ul.appendChild(li);
    });
    const doneN = m.obj.filter((o) => SV.state.obj[m.id + '.' + o.id]).length;
    if (doneN > 3) { [...ul.querySelectorAll('li.done')].slice(0, doneN - 2).forEach((li) => li.remove()); }
  }

  /* ---------------- feedback ---------------- */
  function toast(text, kind) {
    const t = U.el('div', 'toast ' + (kind || ''), U.esc(text)); $('toasts').appendChild(t);
    setTimeout(() => t.remove(), 3800);
    while ($('toasts').children.length > 5) $('toasts').firstChild.remove();
  }
  function flash(a = 0.6, col = '#fff') { const f = $('flash'); f.style.background = col; f.style.transition = 'none'; f.style.opacity = a; requestAnimationFrame(() => { f.style.transition = 'opacity .5s ease'; f.style.opacity = 0; }); }
  function flashDamage() { flash(0.25, '#8B1E1E'); }
  function banner(area) {
    const b = $('areaBanner'); $('abJp').textContent = area.jp || ''; $('abName').textContent = area.name.toUpperCase(); $('abSub').textContent = area.sub || '';
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }
  function itemReveal(id) {
    const it = SV.ITEMS[id];
    toast(`Obtained · ${it.name}`, 'big');
  }
  function loreCard(L) {
    const p = panel({ id: 'lore', title: L.title.toUpperCase(), jp: { scroll: '巻物', relic: '遺物' }[L.set] || '', cls: 'md' });
    p.body.innerHTML = `<div class="lore-card">${U.esc(L.text)}</div><p style="color:#777;font-size:11px;margin-top:10px">Added to your Journal (Inventory → Journal).</p>`;
  }

  /* ---------------- results ---------------- */
  function missionComplete(m, lines, cb) {
    const r = U.el('div', 'result', `<div class="r-k">MISSION ${m.num} COMPLETE</div><div class="r-t">${U.esc(m.title.toUpperCase())}</div><div class="r-line"></div><div class="r-list">${lines.map((l, i) => `<div style="animation-delay:${0.6 + i * 0.15}s">${U.esc(l)}</div>`).join('')}</div>`);
    const b = U.el('button', 'btn gold', 'Continue'); b.style.marginTop = '14px';
    b.onclick = () => { r.remove(); SV.Audio.play('ui'); SV.Input.clearAll(); cb && cb(); };
    r.appendChild(b); $('panels').appendChild(r); SV.Audio.play('gong');
    setTimeout(() => b.focus(), 50);
  }
  function death() {
    const r = U.el('div', 'result', `<div class="r-k">死</div><div class="r-t red">YOU HAVE FALLEN</div><div class="r-line"></div><div class="r-list"><div>The masks will not wait for you to rise. But you will.</div></div>`);
    const row = U.el('div', 'btn-row'); row.style.marginTop = '14px';
    const a = U.el('button', 'btn gold', 'Rise again'); a.onclick = () => {
      r.remove(); const slot = SV.Save.latest();
      if (slot) SV.Game.loadSlot(slot);
      else { const P = SV.Player.e; P.dead = false; P.state = 'idle'; P.hp = SV.Stats.get().maxHp; SV.state.dead = false; SV.Enemies.loseAggro(); P.invuln = 2; SV.UI.refreshHud(); }
    };
    const b = U.el('button', 'btn', 'Main menu'); b.onclick = () => { r.remove(); SV.Game.toMenu(); };
    row.append(a, b); r.appendChild(row); $('panels').appendChild(r);
  }

  /* ---------------- pause & menus ---------------- */
  function pause() {
    const p = panel({ id: 'pause', title: 'PAUSED', jp: '休止', cls: 'sm' });
    const list = U.el('div', 'pause-list');
    const back = () => pause();
    [['RESUME', () => closePanel()], ['INVENTORY', () => SV.Inv.open()], ['MAP', () => SV.Map.open()], ['MISSIONS', () => missions(back)], ['SETTINGS', () => settings(false, back)], ['SAVE', () => saves('save', false, back)], ['MAIN MENU', () => confirmMenu()]].forEach(([l, fn]) => {
      const b = U.el('button', '', l); b.onclick = () => { SV.Audio.play('ui'); fn(); }; list.appendChild(b);
    });
    p.body.style.padding = '0'; p.body.appendChild(list);
    const s = SV.state; const pt = Math.floor(s.playtime / 60);
    p.body.appendChild(U.el('div', 'pause-meta', `Playtime ${Math.floor(pt / 60)}h ${pt % 60}m · Enemies defeated ${s.kills} · Collectibles ${Object.keys(SV.LORE).filter((k) => s.collected[k]).length}/${Object.keys(SV.LORE).length}`));
  }
  function confirmMenu() {
    const p = panel({ id: 'confirm', title: 'RETURN TO MENU', jp: '', cls: 'sm', back: null });
    p.body.innerHTML = '<p style="color:#bbb;font-size:13px;line-height:1.7">Your progress is autosaved at every objective, purchase and pickup. Return to the main menu?</p>';
    const row = U.el('div', 'btn-row'); const a = U.el('button', 'btn red', 'Return to menu'); a.onclick = () => { SV.Save.autosave('menu'); closePanel(true); SV.Game.toMenu(); };
    const b = U.el('button', 'btn', 'Cancel'); b.onclick = () => { closePanel(true); pause(); }; row.append(a, b); p.body.appendChild(row);
  }
  function settings(fromMenu, back) {
    const p = panel({ id: 'settings', title: 'SETTINGS', jp: '設定', cls: 'md', menu: fromMenu, back });
    const s = SV.Settings.get();
    const slider = (k, label) => { const r = U.el('div', 'set-row', `<label for="set_${k}">${label}</label>`); const i = U.el('input'); i.type = 'range'; i.id = 'set_' + k; i.min = 0; i.max = 1; i.step = 0.05; i.value = s[k]; i.oninput = () => SV.Settings.set(k, +i.value); r.appendChild(i); p.body.appendChild(r); };
    const seg = (k, label, opts) => { const r = U.el('div', 'set-row', `<label>${label}</label>`); const g = U.el('div', 'seg'); opts.forEach(([v, l]) => { const b = U.el('button', s[k] === v ? 'on' : '', l); b.onclick = () => { SV.Settings.set(k, v); g.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); SV.Audio.play('ui'); if (k === 'touch') SV.Input.setTouch(SV.Input.touch || v === 'on'); }; g.appendChild(b); }); r.appendChild(g); p.body.appendChild(r); };
    slider('master', 'Master volume'); slider('sfx', 'Effects'); slider('amb', 'Ambience'); slider('music', 'Music');
    seg('textSpeed', 'Text speed', [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']]);
    seg('shake', 'Screen shake', [[true, 'On'], [false, 'Off']]);
    seg('particles', 'Particles', [['high', 'High'], ['low', 'Low']]);
    seg('timeFlow', 'Time of day', [['cycle', 'Cycle'], ['day', 'Day'], ['night', 'Night']]);
    seg('weather', 'Weather', [['dynamic', 'Dynamic'], ['clear', 'Clear']]);
    seg('hints', 'Control hints', [[true, 'Show'], [false, 'Hide']]);
    seg('touch', 'Touch controls', [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']]);
  }
  function saves(mode, fromMenu, back) {
    const p = panel({ id: 'saves', title: mode === 'save' ? 'SAVE GAME' : 'LOAD GAME', jp: mode === 'save' ? '保存' : '読込', cls: 'md', menu: fromMenu, back });
    const wrap = U.el('div', 'slots');
    SV.Save.SLOTS.forEach((slot) => {
      if (mode === 'save' && slot === 'auto') return;
      const inf = SV.Save.info(slot);
      const row = U.el('div', 'slotc', `<div class="sn">${slot === 'auto' ? '自' : slot}</div><div class="si"><b>${slot === 'auto' ? 'Autosave' : 'Slot ' + slot}${inf ? ' · ' + U.esc(inf.mission) : ''}</b><span>${inf ? `${U.esc(inf.area)} · ${inf.ryo} Ryo · ${new Date(inf.time).toLocaleString()}` : 'Empty'}</span></div>`);
      const btns = U.el('div', 'btn-row');
      if (mode === 'save') { const b = U.el('button', 'btn gold', inf ? 'Overwrite' : 'Save'); b.onclick = () => { SV.Save.save(slot); SV.Audio.play('buy'); toast('Saved to slot ' + slot); saves('save', fromMenu, back); }; btns.appendChild(b); }
      else { const b = U.el('button', 'btn gold', 'Load'); b.disabled = !inf; b.onclick = () => { closePanel(true); SV.Game.loadSlot(slot); }; btns.appendChild(b); }
      if (inf && slot !== 'auto') { const d = U.el('button', 'btn', 'Delete'); let armed = false; d.onclick = () => { if (!armed) { armed = true; d.textContent = 'Confirm'; d.classList.add('red'); return; } SV.Save.remove(slot); saves(mode, fromMenu, back); if (fromMenu) SV.Main.refresh(); }; btns.appendChild(d); }
      row.appendChild(btns); wrap.appendChild(row);
    });
    p.body.appendChild(wrap);
    p.body.appendChild(U.el('p', '', '<small style="color:#777">Saves live in this browser (localStorage). The game also autosaves after objectives, pickups, purchases, puzzles, story events and new areas.</small>'));
  }
  function missions(back) {
    const p = panel({ id: 'missions', title: 'MISSIONS', jp: '任務', back });
    let selI = Math.min(SV.state.mission, SV.Missions.LIST.length - 1);
    const grid = U.el('div', 'mis-grid'); const list = U.el('div', 'mis-list'); const det = U.el('div', 'mis-detail');
    const draw = () => {
      list.innerHTML = '';
      SV.Missions.LIST.forEach((m, i) => {
        const st = i < SV.state.mission ? 'done' : i === SV.state.mission ? 'cur' : 'locked';
        const b = U.el('button', `mis-item ${st} ${i === selI ? 'sel' : ''}`, `<span class="n">${m.num}</span><span>${m.title}${st === 'locked' ? ' 🔒' : ''}</span>`);
        b.onclick = () => { selI = i; SV.Audio.play('ui'); draw(); }; list.appendChild(b);
      });
      const m = SV.Missions.LIST[selI]; const st = selI < SV.state.mission ? 'done' : selI === SV.state.mission ? 'cur' : 'locked';
      det.innerHTML = `<div class="jp">${m.jp}</div><h3>${m.title}</h3><p>${st === 'locked' ? 'Complete earlier missions to learn more.' : m.desc}</p>`;
      if (st !== 'locked' && !m.future) {
        const ul = U.el('ul');
        m.obj.forEach((o) => { const d = st === 'done' || SV.state.obj[m.id + '.' + o.id]; ul.appendChild(U.el('li', d ? 'done' : '', `<i>${d ? '☑' : '☐'}</i>${U.esc(o.text)}${!d && o.count ? ' ' + SV.Missions.progressText(o) : ''}`)); });
        det.appendChild(ul);
        if (st === 'cur') { const h = SV.Missions.currentHint(); if (h) det.appendChild(U.el('p', '', `<span style="color:#C9A227">Hint ·</span> ${U.esc(h)}`)); }
      }
      if (m.future && st === 'cur') det.appendChild(U.el('p', '', `<span style="color:#C9A227">${m.obj[0].text}</span>`));
      det.appendChild(U.el('div', 'sq-title', 'SIDE QUESTS'));
      const sq = Object.entries(SV.Missions.SIDE).filter(([k]) => SV.state.side[k]);
      if (!sq.length) det.appendChild(U.el('div', 'sq', '<span>No side quests yet. Talk to villagers and check the quest board in the square.</span>'));
      sq.forEach(([k, q]) => det.appendChild(U.el('div', 'sq ' + (SV.state.side[k] === 'done' ? 'done' : ''), `<b>${q.title}${SV.state.side[k] === 'done' ? ' · Complete' : ''}</b><span>${q.giver} · ${q.desc()} · Reward: ${q.reward}</span>`)));
    };
    grid.append(list, det); p.body.appendChild(grid); draw();
  }
  function credits(fromMenu) {
    const p = panel({ id: 'credits', title: 'CREDITS', jp: '謝辞', cls: 'md', menu: fromMenu });
    p.body.innerHTML = `<div class="credits"><h4>SHADOW OF THE VILLAGE</h4>A Japanese Revenge Adventure<h4>DESIGN · CODE · ART</h4>Built in vanilla HTML, CSS and JavaScript<br>Every sprite, sound and melody is generated in code<h4>MUSIC</h4>Generative koto phrases in the miyako-bushi scale<h4>TOOLS</h4>Canvas 2D · Web Audio · localStorage<h4>THANK YOU</h4>For walking the road with Ren</div>`;
  }
  function questBoard() {
    const p = panel({ id: 'board', title: 'QUEST BOARD', jp: '高札', cls: 'md' });
    const b = SV.state.side.bounty;
    const card = U.el('div', 'sq', `<b>Bounty: Clear the Roads</b><span>Posted by the village council. "Bandits and beasts make the roads unsafe. Defeat eight of them and the council will pay." Reward: 90 Ryo, Iron Sand ×2</span>`);
    const row = U.el('div', 'btn-row'); row.style.marginTop = '8px';
    if (!b) { const a = U.el('button', 'btn gold', 'Accept'); a.onclick = () => { SV.Missions.startSide('bounty'); questBoard(); }; row.appendChild(a); }
    else if (b === 'active') { const done = SV.state.flags.bountyReady; const a = U.el('button', 'btn gold', done ? 'Claim reward' : `In progress · ${Math.min(8, SV.state.kills - (SV.state.side.bountyStart || 0))}/8`); a.disabled = !done; a.onclick = () => { SV.Missions.finishSide('bounty'); questBoard(); }; row.appendChild(a); }
    else row.appendChild(U.el('span', '', '<span style="color:#888">Completed. The council thanks you.</span>'));
    card.appendChild(row); p.body.appendChild(card);
    p.body.appendChild(U.el('div', 'sq', '<b>Notice</b><span>"The south road to the old shrine remains closed by order of Elder Sato." — The council</span>'));
    p.body.appendChild(U.el('div', 'sq', `<b>Notice</b><span>"Missing: the comb of Genji's late wife. Red lacquer. Reward offered." ${SV.state.side.comb ? '' : '(Speak with Old Farmer Genji in the rice fields.)'}</span>`));
    p.body.appendChild(U.el('div', 'sq', `<b>Notice</b><span>"Brother Jōen asks travellers to watch for five sakura petals carried off by the wind." ${SV.state.side.petals ? '' : '(Speak with Brother Jōen at the village shrine.)'}</span>`));
  }
  return { panel, closePanel, panelOpen, panelId, refreshHud, updateHud, refreshMission, toast, flash, flashDamage, banner, itemReveal, loreCard, missionComplete, death, pause, settings, saves, missions, credits, questBoard };
})();
