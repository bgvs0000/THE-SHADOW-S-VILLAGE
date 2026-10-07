/* =========================================================
   MISSIONS — 10 connected story missions with sequential
   objectives (some counted), hints, map targets, rewards;
   plus side quests. Objectives update automatically.
   ========================================================= */
SV.Missions = (function () {
  const U = SV.U;
  const F = (k) => SV.state.flags[k] || 0;
  const npcPos = (id) => { const n = SV.NPC.find(id); const d = SV.NPC.DEF[id]; return n ? { area: d.area, x: n.x, y: n.y } : { area: d.area, x: d.x, y: d.y }; };
  const nearest = (pts) => { const P = SV.Player.e; const live = pts.filter((p) => !p.done); if (!live.length) return null; if (!P) return live[0]; const same = live.filter((p) => p.area === SV.World.area.id); const pool = same.length ? same : live; return pool.sort((a, b) => U.dist(P.x, P.y, a.x, a.y) - U.dist(P.x, P.y, b.x, b.y))[0]; };

  const LIST = [
    { id: 'm1', num: '01', title: 'Ashes of Kurohana', jp: '黒花の灰',
      desc: 'Twelve years after his father\'s murder, Ren returns to the village where it happened. The house still stands. Someone has been inside.',
      reward: { ryo: 60, items: { health_potion: 2 }, abilities: ['shadowStrike'], text: ['Ability unlocked: SHADOW STRIKE (Q at full Resolve)'] },
      obj: [
        { id: 'explore', text: 'Explore the village', target: () => ({ area: 'village', x: 1300, y: 1000 }), hint: 'Walk to the village square, the heart of Kurohana.' },
        { id: 'house', text: "Investigate your father's house", target: () => (SV.World.area.id === 'ren_house' ? { area: 'ren_house', x: 620, y: 195 } : { area: 'village', x: 600, y: 772 }), hint: "Your father's house is on the west side of the village, scorched but standing. Search inside." },
        { id: 'elder', text: 'Talk to Elder Sato', target: () => npcPos('elder'), hint: "The elder's house lies north-east of the square, beside the koi pond." },
        { id: 'crest', text: 'Find the family crest', target: () => ({ area: 'ren_house', x: 400, y: 300 }), hint: '"Look where the fire slept." The hearth in your father\'s house.' },
        { id: 'tracks', text: 'Follow the mysterious footprints', count: 3, prog: () => [0, 1, 2].filter((i) => F('track' + i)).length,
          target: () => { const T = [[740, 690], [1060, 470], [1290, 190]]; for (let i = 0; i < 3; i++) if (!F('track' + i)) return { area: 'village', x: T[i][0], y: T[i][1] }; return null; }, hint: 'Fresh footprints lead from the house toward the north gate.' },
        { id: 'shrine', text: 'Discover the hidden shrine', target: () => ({ area: 'bamboo_edge', x: 470, y: 420 }), hint: 'The footprints continue into the bamboo. Follow the path north-west to an old shrine.' },
        { id: 'enemy', text: 'Survive the stranger', target: () => null, hint: 'Watch for the red glint before he strikes. Block (right click) or roll (Space).' },
      ] },
    { id: 'm2', num: '02', title: 'The Broken Blade', jp: '折れた刀',
      desc: 'The crest bears a riddle: "Where the blade sleeps, water falls." Ren\'s father never let anyone see his sword. Perhaps it never left the forest.',
      reward: { ryo: 120, items: { iron_ore: 3, leather: 2 }, text: ['Blacksmith upgrades unlocked', 'The north road is safer'] },
      obj: [
        { id: 'katana', text: "Find your father's broken katana", target: () => ({ area: 'bamboo_edge', x: 1890, y: 390 }), hint: 'A waterfall spills from the cliffs in the north-east of the bamboo forest.' },
        { id: 'fragments', text: 'Collect the sword fragments', count: 3, prog: () => ['frag_well', 'frag_shrine', 'frag_log'].filter(F).length,
          target: () => nearest([{ area: 'village', x: 1400, y: 945, done: F('frag_well') }, { area: 'bamboo_edge', x: 560, y: 425, done: F('frag_shrine') }, { area: 'bamboo_edge', x: 1520, y: 1580, done: F('frag_log') }]), hint: 'One lies at the bamboo shrine altar, one in a fallen tree south-east in the bamboo, and something glints in the village well.' },
        { id: 'smith', text: 'Visit Tetsuo the blacksmith', target: () => npcPos('tetsuo'), hint: 'The forge is east of the square, smoke rising from it day and night.' },
        { id: 'repair', text: 'Have the katana reforged', target: () => npcPos('tetsuo'), hint: 'Speak with Tetsuo again and ask him to repair the blade.' },
        { id: 'training', text: 'Learn combat from Master Hayato', target: () => npcPos('hayato'), hint: 'The training ground is south-west of the square. Hayato will teach you heavy strikes, rolling and the counter.' },
        { id: 'bandits', text: "Defeat Goro's bandits", count: 4, prog: () => F('wave_m2'), target: () => ({ area: 'bamboo_edge', x: 1900, y: 960 }), hint: 'The bandits camp in the eastern clearing of the bamboo forest. Heavy strikes break a guard.' },
      ] },
    { id: 'm3', num: '03', title: 'Into the Bamboo', jp: '竹の奥へ',
      desc: 'A child has gone missing in the deep grove where even woodcutters will not walk. Wolves are not the only thing hunting there.',
      reward: { ryo: 80, items: { herbal_remedy: 2, smoke_bomb: 3 }, abilities: ['healing', 'smoke'], text: ['Healing unlocked: grind 3 Shade Herbs into remedies · Meditate at shrines', 'Ability unlocked: SMOKE ESCAPE (3)'] },
      obj: [
        { id: 'hana', text: 'Speak with Hana in the square', target: () => npcPos('hana'), hint: 'A worried woman waits in the village square.' },
        { id: 'enter', text: 'Enter the deep bamboo grove', target: () => ({ area: 'bamboo_edge', x: 1200, y: 30 }), hint: 'The deep grove lies beyond the northern edge of the bamboo forest.' },
        { id: 'search', text: 'Search for Kenji', target: () => ({ area: 'deep_bamboo', x: 1170, y: 1720 }), hint: 'Look along the main path for any sign of the boy.' },
        { id: 'herbs', text: 'Collect shade herbs for Hana', count: 5, prog: () => Math.min(5, F('herbs')),
          target: () => { const a = SV.AREAS.deep_bamboo; const H = [[600, 1500], [500, 1340], [1780, 1310], [1900, 1450], [1520, 1660], [820, 1745]]; return nearest(H.map(([x, y], i) => ({ area: 'deep_bamboo', x, y, done: SV.state.collected['herb' + i] }))); }, hint: 'Herbs grow along the side paths, west and east.' },
        { id: 'hidden', text: 'Find the hidden path', target: () => ({ area: 'deep_bamboo', x: 1200, y: 1160 }), hint: 'The main path ends at a wall of bamboo that whistles in the wind. Wind needs a gap to pass through.' },
        { id: 'gate', text: 'Solve the forest gate puzzle', target: () => ({ area: 'deep_bamboo', x: 990, y: 980 }), hint: 'Read the stone tablet by the gate, then light the lanterns in the order of the poem.' },
        { id: 'fight', text: 'Defeat the forest beasts', count: 4, prog: () => F('wave_m3'), target: () => ({ area: 'deep_bamboo', x: 1200, y: 460 }), hint: 'Wolves lunge after a short crouch. Roll sideways, then punish.' },
        { id: 'rescue', text: 'Rescue Kenji', target: () => ({ area: 'deep_bamboo', x: 1200, y: 290 }), hint: 'Kenji is tied to the great pine at the clearing\'s edge.' },
      ] },
    { id: 'm4', num: '04', title: 'The Silent Shrine', jp: '沈黙の社',
      desc: 'Kenji saw white masks digging at the abandoned shrine south of the village. They could not open its deepest door. Ren\'s father once swept its steps.',
      reward: { ryo: 150, items: { tamahagane: 1 }, abilities: ['shadowDash'], text: ['Ability unlocked: SHADOW DASH (Q)', 'Clue found: Torn Ledger Page'] },
      obj: [
        { id: 'travel', text: 'Travel to the abandoned shrine', target: () => ({ area: 'village', x: 1300, y: 1985 }), hint: 'Take the south road out of the village. The elder has cut the rope.' },
        { id: 'keys', text: 'Find the three hidden keys', count: 3, prog: () => ['key_pond', 'key_statue', 'key_ronin'].filter(F).length,
          target: () => { const r = SV.Enemies.list.find((e) => e.uid === 'ronin' && !e.dead); return nearest([{ area: 'shrine', x: 460, y: 1110, done: F('key_pond') }, { area: 'shrine', x: 1790, y: 640, done: F('key_statue') }, { area: 'shrine', x: r ? r.x : 1720, y: r ? r.y : 1360, done: F('key_ronin') }]); }, hint: 'Something glints in the koi pond. A statue has toppled in the east garden. And the hollow ronin by the graves carries something on his belt.' },
        { id: 'symbols', text: 'Discover the shrine symbols', count: 3, prog: () => ['sym1', 'sym2', 'sym3'].filter(F).length,
          target: () => nearest([{ area: 'shrine', x: 500, y: 1410, done: F('sym1') }, { area: 'shrine', x: 1620, y: 1000, done: F('sym2') }, { area: 'shrine', x: 900, y: 1250, done: F('sym3') }]), hint: 'Three inscribed stones stand around the grounds. Each carries a number and a word.' },
        { id: 'statues', text: 'Turn the fox statues to face the altar', target: () => ({ area: 'shrine', x: 1100, y: 780 }), hint: 'Four foxes guard the courtyard altar. Each should gaze at the altar, not away from it.' },
        { id: 'seal', text: 'Open the sealed shrine', target: () => ({ area: 'shrine', x: 1100, y: 455 }), hint: 'Set the three symbols in the order the stones gave them: first, second, third.' },
      ] },
    { id: 'm5', num: '05', title: 'The Bandit Camp', jp: '山賊砦', future: true, desc: 'The ledger points to Akagawa, a fortified bandit camp across the flooded ford. Infiltrate it, free a prisoner, and find the second half of the ledger.', obj: [{ id: 'soon', text: 'Next chapter in development — explore, upgrade and finish side quests' }] },
    { id: 'm6', num: '06', title: 'Blood on the Mountain', jp: '山の血', future: true, desc: 'A mysterious traveller on the old mountain path knew Ren\'s father by another name.', obj: [{ id: 'soon', text: 'Locked' }] },
    { id: 'm7', num: '07', title: 'The Burning Village', jp: '燃ゆる村', future: true, desc: 'Kurohana burns. Protect those who remain.', obj: [{ id: 'soon', text: 'Locked' }] },
    { id: 'm8', num: '08', title: 'The Forgotten Temple', jp: '忘れ寺', future: true, desc: 'Four sacred seals guard an ancient blade.', obj: [{ id: 'soon', text: 'Locked' }] },
    { id: 'm9', num: '09', title: 'The Samurai Fortress', jp: '武家砦', future: true, desc: 'The name behind the masks waits inside the fortress walls.', obj: [{ id: 'soon', text: 'Locked' }] },
    { id: 'm10', num: '10', title: 'The Last Path', jp: '最後の道', future: true, desc: 'Revenge, forgiveness, or the road away.', obj: [{ id: 'soon', text: 'Locked' }] },
  ];
  const idx = (mid) => LIST.findIndex((m) => m.id === mid);

  function cur() {
    const m = LIST[SV.state.mission]; if (!m) return null;
    const o = m.obj.find((o) => !SV.state.obj[m.id + '.' + o.id]);
    return { m, o };
  }
  function at(mid, oid) { const c = cur(); return !!c && c.m.id === mid && !c.m.future && c.o && c.o.id === oid; }
  function done(mid, oid) { return idx(mid) < SV.state.mission || !!SV.state.obj[mid + '.' + oid]; }
  function missionDone(mid) { return idx(mid) < SV.state.mission; }
  function reached(mid, oid) {
    const i = idx(mid); if (i < SV.state.mission) return true; if (i > SV.state.mission) return false;
    const m = LIST[i]; const c = cur(); if (!c || !c.o) return true;
    return m.obj.findIndex((o) => o.id === oid) <= m.obj.indexOf(c.o);
  }
  function complete(mid, oid) {
    if (!at(mid, oid)) { if (cur() && cur().m.id === mid && !done(mid, oid)) SV.state.obj[mid + '.' + oid] = true; else return; } // out of order: record silently
    else SV.state.obj[mid + '.' + oid] = true;
    const m = LIST[idx(mid)]; const o = m.obj.find((x) => x.id === oid);
    SV.UI.toast('✓ ' + o.text, 'big'); SV.Audio.play('chime');
    SV.UI.refreshMission(oid);
    SV.Bus.emit('objective', { mid, oid });
    if (m.obj.every((x) => SV.state.obj[m.id + '.' + x.id])) finish(m);
    else SV.Save.autosave('objective');
  }
  function finish(m) {
    SV.state.mission = idx(m.id) + 1;
    const R = m.reward || {}; const lines = [];
    if (R.ryo) { SV.Inv.addRyo(R.ryo); lines.push(`+ ${R.ryo} Ryo`); }
    Object.entries(R.items || {}).forEach(([id, q]) => { SV.Inv.add(id, q); lines.push(`+ ${SV.ITEMS[id].name} ×${q}`); });
    (R.abilities || []).forEach((a) => (SV.state.abilities[a] = true));
    (R.text || []).forEach((t) => lines.push(t));
    SV.Save.autosave('mission');
    SV.UI.refreshMission();
    SV.UI.missionComplete(m, lines, () => {
      const next = LIST[SV.state.mission];
      if (next) SV.Story.missionIntro(next);
    });
  }
  /** Counted objectives poll their progress function */
  let pollT = 0;
  function update(dt) {
    pollT -= dt; if (pollT > 0) return; pollT = 0.25;
    const c = cur(); if (!c || !c.o || c.m.future) return;
    if (c.o.count && c.o.prog && c.o.prog() >= c.o.count) complete(c.m.id, c.o.id);
    // explore objective: reach square
    if (c.m.id === 'm1' && c.o.id === 'explore' && SV.World.area.id === 'village') { const P = SV.Player.e; if (U.dist(P.x, P.y, 1300, 1000) < 230) complete('m1', 'explore'); }
    // side quest bounty progress
    const b = SV.state.side.bounty;
    if (b === 'active' && SV.state.kills - (SV.state.side.bountyStart || 0) >= 8 && !SV.state.flags.bountyReady) { SV.state.flags.bountyReady = true; SV.UI.toast('Bounty complete — claim it at the quest board', 'big'); }
  }
  function onEnterArea(id) {
    if (id === 'deep_bamboo') complete('m3', 'enter');
    if (id === 'shrine') complete('m4', 'travel');
  }
  function target() { const c = cur(); if (!c || !c.o || !c.o.target) return null; try { return c.o.target(); } catch (e) { return null; } }
  function currentHint() { const c = cur(); return c && c.o ? c.o.hint : null; }
  function progressText(o) { return o.count && o.prog ? ` (${Math.min(o.count, o.prog())}/${o.count})` : ''; }

  /* wave kill tracking */
  SV.Bus.on('kill', (en) => { if (en.wave) SV.state.flags['wave_' + en.wave] = (SV.state.flags['wave_' + en.wave] || 0) + 1; SV.UI.refreshMission(); });
  SV.Bus.on('herb', () => { SV.state.flags.herbs = (SV.state.flags.herbs || 0) + 1; SV.UI.refreshMission(); });

  /* ---------------- side quests ---------------- */
  const SIDE = {
    comb: { title: "The Farmer's Keepsake", giver: 'Old Farmer Genji', desc: () => (SV.Inv.has('farmer_comb') ? 'Return the lacquered comb to Genji.' : 'Find the red lacquered comb Genji dropped on the west path of the bamboo forest.'), reward: '60 Ryo, Ginger Tonic ×2' },
    bounty: { title: 'Bounty: Clear the Roads', giver: 'Quest Board', desc: () => `Defeat 8 enemies anywhere (${Math.min(8, SV.state.kills - (SV.state.side.bountyStart || 0))}/8), then claim the bounty at the board.`, reward: '90 Ryo, Iron Sand ×2' },
    petals: { title: 'Five Lost Petals', giver: 'Brother Jōen', desc: () => `Find the five lost sakura petals scattered across the land (${SV.Collect.count('petal')}/5).`, reward: '100 Ryo, Stamina charm (+1 Stamina tier)' },
  };
  function startSide(id) { SV.state.side[id] = 'active'; if (id === 'bounty') SV.state.side.bountyStart = SV.state.kills; SV.UI.toast('Side quest: ' + SIDE[id].title, 'big'); SV.Audio.play('ui_open'); SV.Save.autosave('side'); }
  function finishSide(id) {
    SV.state.side[id] = 'done';
    if (id === 'comb') { SV.Inv.remove('farmer_comb'); SV.Inv.addRyo(60); SV.Inv.add('stamina_potion', 2); }
    if (id === 'bounty') { SV.Inv.addRyo(90); SV.Inv.add('iron_ore', 2); SV.state.flags.bountyReady = false; }
    if (id === 'petals') { SV.Inv.addRyo(100); SV.state.upgrades.armorStam = Math.min(4, SV.state.upgrades.armorStam + 1); }
    SV.UI.toast('Side quest complete: ' + SIDE[id].title, 'big'); SV.Audio.play('puzzle_ok'); SV.Save.autosave('side');
  }

  return { LIST, cur, at, done, reached, missionDone, complete, update, onEnterArea, target, currentHint, progressText, SIDE, startSide, finishSide, idx };
})();
