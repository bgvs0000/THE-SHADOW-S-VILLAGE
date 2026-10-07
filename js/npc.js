/* =========================================================
   NPC — villagers with schedules (waypoint wandering),
   conditional appearance, quest markers, and dialogue trees
   that change with story progress.
   ========================================================= */
SV.NPC = (function () {
  const U = SV.U;
  const M = () => SV.Missions, F = (k) => !!SV.state.flags[k], S = () => SV.Story;
  let list = [];

  /* ---------- appearances ---------- */
  const LOOK = {
    elder: { top: '#4a4440', robe: '#36302c', sash: '#6b5a32', hair: '#d6d6d6', beard: '#cfcfcf', hat: 'bun', weapon: 'staff', collar: '#bdb6a8', skin: '#cfa682' },
    tetsuo: { top: '#5a4636', robe: '#2e241c', apron: '#2a1e14', sash: '#2a2a2a', hair: '#1a1a1a', skin: '#b98a62', weapon: 'hammer', headband: '#d8d0c0', collar: '#8a7a68' },
    okiku: { top: '#6b2a34', robe: '#3a1e24', sash: '#C9A227', hair: '#121212', hat: 'bun', collar: '#e8dcc8', skin: '#e0b994' },
    genji: { top: '#5d5a44', robe: '#3e3c2e', sash: '#4a3a28', hair: '#9a9a9a', hat: 'kasa', hatCol: '#a08a55', weapon: 'staff', skin: '#c49a70' },
    hayato: { top: '#2a3240', robe: '#1a1e26', sash: '#d8d0c0', hair: '#2a2a2a', beard: '#2a2a2a', weapon: 'katana', bladeCol: '#cfd4da', handle: '#d8d0c0', collar: '#cfc6b2' },
    monk: { top: '#7a5a2a', robe: '#5a3e1c', sash: '#3a2a14', hat: 'bald', skin: '#d0a67c', collar: '#d8cbb0', weapon: 'staff' },
    hana: { top: '#4a5a6b', robe: '#2e3844', sash: '#a8667a', hair: '#141414', hat: 'bun', collar: '#ece4d4', skin: '#e2bc98' },
    kenji: { top: '#6b5a3a', robe: '#4a3c26', sash: '#8B1E1E', hair: '#141414', scale: 0.78, collar: '#d8d0c0', skin: '#e2bc98' },
    aiko: { top: '#5a3a5a', robe: '#3a2440', sash: '#d8b060', hair: '#121212', hat: 'long', collar: '#ece4d4', skin: '#e4c09c' },
    taro: { top: '#4a4a3a', robe: '#2e2e24', sash: '#6b5a32', hair: '#121212', hat: 'kasa', hatCol: '#8a7448', skin: '#c49a70' },
    mitsu: { top: '#4a3e3a', robe: '#302826', sash: '#5a2a2a', hair: '#bdbdbd', hat: 'bun', skin: '#c9a07a' },
  };

  /* ---------- definitions ---------- */
  const DEF = {
    elder: { name: 'Elder Sato', role: 'Village Elder', area: 'village', x: 1850, y: 760, wp: [[1850, 760], [1760, 780], [1960, 790], [1900, 600]], look: LOOK.elder,
      hot: () => M().at('m1', 'elder') || M().at('m4', 'travel') && !F('elderM4'), tree: () => treeElder() },
    tetsuo: { name: 'Tetsuo', role: 'Blacksmith', area: 'village', x: 1830, y: 1275, wp: [[1830, 1275], [1790, 1265]], look: LOOK.tetsuo,
      hot: () => M().at('m2', 'smith') || M().at('m2', 'repair'), tree: () => treeSmith() },
    okiku: { name: 'Okiku', role: 'General Store', area: 'village', x: 970, y: 1265, wp: [[970, 1265], [930, 1275], [1030, 1270]], look: LOOK.okiku, tree: () => treeStore() },
    genji: { name: 'Old Farmer Genji', role: 'Rice Farmer', area: 'village', x: 660, y: 1590, wp: [[660, 1590], [650, 1650], [680, 1440], [700, 1560]], look: LOOK.genji,
      hot: () => SV.state.side.comb === 'active' && F('combFound'), tree: () => treeGenji() },
    hayato: { name: 'Master Hayato', role: 'Sword Instructor', area: 'village', x: 770, y: 1460, wp: [[770, 1460], [720, 1450], [830, 1455]], look: LOOK.hayato,
      when: () => !F('sparring'), hot: () => M().at('m2', 'training'), tree: () => treeHayato() },
    monk: { name: 'Brother Jōen', role: 'Shrine Keeper', area: 'village', x: 1610, y: 1760, wp: [[1610, 1760], [1440, 1770], [1600, 1820]], look: LOOK.monk,
      hot: () => SV.state.side.petals === 'active' && SV.Collect.count('petal') >= 5, tree: () => treeMonk() },
    hana: { name: 'Hana', role: 'Villager', area: 'village', x: 1240, y: 1070, wp: [[1240, 1070], [1200, 1040], [1280, 1090]], look: LOOK.hana,
      when: () => M().missionDone('m2'), hot: () => M().at('m3', 'hana'), tree: () => treeHana() },
    kenji: { name: 'Kenji', role: "Hana's son", area: 'village', x: 1350, y: 1080, wp: [[1350, 1080], [1420, 990], [1250, 940], [1180, 1050]], look: LOOK.kenji, speed: 70,
      when: () => M().missionDone('m3'), tree: () => treeKenji() },
    kenji_tied: { name: 'Kenji', role: "Hana's son", area: 'deep_bamboo', x: 1200, y: 272, wp: [[1200, 272]], look: Object.assign({}, LOOK.kenji, { kneel: true }), still: true,
      when: () => M().at('m3', 'fight') || M().at('m3', 'rescue'), hot: () => M().at('m3', 'rescue'), tree: null, act: () => (M().at('m3', 'rescue') ? S().rescueKenji() : SV.UI.toast('Kenji is bound to the pine. Deal with the beasts first!', 'red')) },
    aiko: { name: 'Aiko', role: 'Weaver', area: 'village', x: 1100, y: 980, wp: [[1100, 980], [970, 1180], [1200, 1100], [1060, 860]], look: LOOK.aiko, tree: () => treeAmbient('aiko') },
    taro: { name: 'Taro', role: 'Porter', area: 'village', x: 400, y: 1000, wp: [[400, 1000], [1000, 1000], [1700, 1000], [2050, 1000]], look: LOOK.taro, speed: 55, tree: () => treeAmbient('taro') },
    mitsu: { name: 'Grandmother Mitsu', role: 'Villager', area: 'village', x: 1440, y: 960, wp: [[1440, 960], [1460, 900]], look: LOOK.mitsu, speed: 25, tree: () => treeAmbient('mitsu') },
  };

  function spawnArea(areaId) {
    list = Object.entries(DEF).filter(([, d]) => d.area === areaId).map(([id, d]) => ({
      id, d, x: d.x, y: d.y, r: 11, facing: Math.PI / 2, walk: 0, moving: false, wp: 0, wait: U.rand(0, 3), talking: false, bow: 0, t: 0,
      draw(c) { drawNpc(this, c); },
    }));
  }
  const visible = (n) => !n.d.when || n.d.when();

  function update(dt) {
    for (const n of list) {
      if (!visible(n)) continue;
      n.t += dt; n.bow = Math.max(0, n.bow - dt * 1.5);
      if (n.talking || n.d.still) { n.moving = false; continue; }
      if (n.wait > 0) { n.wait -= dt; n.moving = false; continue; }
      const [tx, ty] = n.d.wp[n.wp];
      const d = U.dist(n.x, n.y, tx, ty);
      if (d < 6) { n.wp = Math.floor(Math.random() * n.d.wp.length); n.wait = U.rand(2, 6); continue; }
      const a = U.ang(n.x, n.y, tx, ty); const sp = n.d.speed || 42;
      const ox = n.x, oy = n.y;
      n.x += Math.cos(a) * sp * dt; n.y += Math.sin(a) * sp * dt; n.facing = a; n.moving = true; n.walk += dt * 8;
      SV.World.collide(n);
      if (U.dist(ox, oy, n.x, n.y) < sp * dt * 0.3) { n.wp = Math.floor(Math.random() * n.d.wp.length); n.wait = 1; } // stuck
    }
  }
  function drawNpc(n, c) {
    SV.Sprites.drawHuman(c, n.x, n.y, Object.assign({}, n.d.look, { facing: n.facing, walk: n.walk, moving: n.moving, t: n.t, bow: n.bow }));
    if (n.d.id === 'kenji_tied' || n.id === 'kenji_tied') { c.strokeStyle = '#a08a55'; c.lineWidth = 2; c.beginPath(); c.moveTo(n.x - 10, n.y - 14); c.lineTo(n.x + 10, n.y - 18); c.moveTo(n.x - 10, n.y - 20); c.lineTo(n.x + 10, n.y - 12); c.stroke(); }
    if (n.d.hot && n.d.hot()) {
      const y = n.y - 64 + Math.sin(n.t * 3) * 3;
      c.fillStyle = '#C9A227'; c.beginPath(); c.moveTo(n.x, y - 8); c.lineTo(n.x + 6, y); c.lineTo(n.x, y + 8); c.lineTo(n.x - 6, y); c.closePath(); c.fill();
      c.fillStyle = '#111'; c.font = '800 10px "Shippori Mincho",serif'; c.textAlign = 'center'; c.fillText('!', n.x, y + 4);
    }
  }
  function interactables() {
    return list.filter(visible).map((n) => ({ id: 'npc_' + n.id, x: n.x, y: n.y, r: 52, label: 'Talk to ' + n.d.name, hot: n.d.hot, npc: n, act: () => talk(n) }));
  }
  function talk(n) {
    if (n.d.act) return n.d.act();
    const P = SV.Player.e;
    n.talking = true; n.facing = U.ang(n.x, n.y, P.x, P.y); n.bow = 1;
    P.facing = U.ang(P.x, P.y, n.x, n.y);
    SV.state.npc[n.id] = (SV.state.npc[n.id] || 0) + 1;
    SV.Bus.emit('talk', n.id);
    const t = n.d.tree();
    SV.Dialogue.open(t, 'start', { name: n.d.name, role: n.d.role, look: Object.assign({}, n.d.look, { kneel: false }) }, () => { n.talking = false; });
  }
  function find(id) { return list.find((n) => n.id === id); }
  const leave = { t: 'Leave', go: 'end' };
  const hintNode = () => ({ who: 'npc', text: () => { const h = M().currentHint(); return h || 'Walk your own road for now, Ren. The village will still be here.'; }, go: 'start' });

  /* ================= DIALOGUE TREES ================= */
  function treeElder() {
    if (M().at('m1', 'elder')) return {
      start: { text: 'Ren...? Gods. You stand the way he did, as though the ground owed you an apology. Twelve winters, child.', choices: [{ t: 'Ask about that night', go: 'night' }, { t: 'I found burnt papers in the house', go: 'letter', if: () => SV.Inv.has('burnt_letter') }] },
      letter: { text: '"The Crane"... Daisuke spoke that word only once, when he was drunk, and then he broke the cup in his own hand. I never asked again.', go: 'night' },
      night: { text: 'Masked men. No banners, no names. They walked past every door in Kurohana and stopped only at yours. When I reached him, it was nearly over.', go: 'promise' },
      promise: { text: 'He made me promise something. "If my son ever returns," he said, "tell him to look where the fire slept." I never understood it. Perhaps you will.', do: () => M().complete('m1', 'elder'), go: 'promise2' },
      promise2: { who: 'ren', text: 'Where the fire slept... the hearth.', go: 'end' },
    };
    const t = {
      start: { text: () => greetElder(), choices: [
        { t: 'Ask about my father', go: 'father' }, { t: 'Ask about the village', go: 'village' },
        { t: 'Ask about the masked men', go: 'masks', if: () => SV.Inv.has('crane_mask') },
        { t: 'Ask about the old shrine', go: 'shrine', if: () => M().reached('m4', 'travel') },
        { t: 'Ask for advice', go: 'hint' }, leave] },
      father: { text: () => (M().missionDone('m2') ? 'He held a sword as if it were heavy with names. Now you hold it too. Be careful whose names you add.' : 'Daisuke came to us half-starved, with a sword he refused to draw. He planted rice, fixed roofs, raised you. For twelve years he was simply a neighbour. That is how I choose to remember him.'), go: 'start' },
      village: { text: () => (M().missionDone('m3') ? 'Kenji is home, thanks to you. People whisper your name with less fear now.' : 'We were founded by deserters, Ren. Men who walked away from a war. Every family here has something it does not speak about.'), go: 'start' },
      masks: { text: 'A crane... I have seen that mark once, on a letter that came for your father the winter before he died. He burned it unopened.', go: 'start' },
      shrine: { text: 'I sealed the south road twenty years ago, on your father\'s request. He said some doors should stay shut. If you must open it, open it as his son, not as his avenger.', do: () => (SV.state.flags.elderM4 = true), go: 'start' },
      hint: hintNode(),
    };
    return t;
  }
  function greetElder() {
    if (M().at('m4', 'travel')) return 'Kenji told me what he saw. White masks at the old shrine. The road south is open to you now. I have cut the rope myself.';
    if (M().missionDone('m2')) return 'The blade suits you. That frightens me a little.';
    if (M().missionDone('m1')) return 'You fought one of them at the bamboo shrine? Then they know you are here. Sleep lightly.';
    return 'Your father\'s house still stands. No one would buy it. No one would burn it.';
  }

  function treeSmith() {
    return {
      start: { text: () => (M().at('m2', 'smith') ? 'Hm. You\'re Daisuke\'s boy. Same scowl. What\'s that you\'re carrying wrapped in cloth?' : M().missionDone('m2') ? 'Blade holding up? Bring me iron and coin and I\'ll make it sing.' : 'Kurohana steel. Nothing fancy, nothing that breaks. What do you need?'),
        do: () => { if (M().at('m2', 'smith')) M().complete('m2', 'smith'); },
        choices: [
          { t: 'Repair the broken blade', go: 'repair', if: () => M().at('m2', 'repair') },
          { t: 'Browse wares & upgrades', do: () => SV.Shop.open('smith'), go: 'end' },
          { t: 'Ask about my father\'s sword', go: 'sword' }, { t: 'Ask for advice', go: 'hint' }, leave] },
      repair: { text: () => (SV.Inv.count('sword_fragment') >= 3 ? 'All three fragments. Folded steel, thirteen layers... this was never a farmer\'s sword. Give me the night.' : `I need every piece. You've got ${SV.Inv.count('sword_fragment')} of 3 fragments. Find the rest.`),
        choices: [{ t: 'Reforge it', if: () => SV.Inv.count('sword_fragment') >= 3, do: () => S().reforge(), go: 'end' }, { t: 'I\'ll keep looking', go: 'end' }] },
      sword: { text: () => (SV.Inv.has('kurohana_blade') ? 'That hamon isn\'t Kurohana work. It\'s northern. Old northern. The kind of school that doesn\'t take students — it takes debts.' : 'Your father never once let me sharpen it. Said a blade that\'s retired should stay dull. Strange thing for a farmer to own.'), go: 'start' },
      hint: hintNode(),
    };
  }
  function treeStore() {
    return {
      start: { text: () => (M().missionDone('m2') ? 'Ren! Bandits stopped raiding the north road since you dealt with Goro. Business is better. Take a look.' : 'Welcome, welcome. Tonics, rice, a few things the bandits didn\'t steal.'),
        choices: [{ t: 'Browse wares', do: () => SV.Shop.open('store'), go: 'end' }, { t: 'Ask about rumors', go: 'rumor' }, leave] },
      rumor: { text: () => U.choice(['Travellers say the mountain road is blocked by a rockslide. Convenient, some say. Too convenient.', 'A peddler swore he saw a white mask in the bamboo at dusk. I told him to drink less.', 'Old Genji lost something in the bamboo. Won\'t say what. He\'s been sour for weeks.', 'Smoke bombs? I only stock those for people who know how to use them.']), go: 'start' },
    };
  }
  function treeGenji() {
    return {
      start: { text: 'Your father used to come here every winter... helped me rebuild the paddy walls after the snows. Never asked for rice. Just worked till his hands bled.', choices: [
        { t: 'Ask about father', go: 'father' }, { t: 'Ask about bandits', go: 'bandits' }, { t: 'Ask about the village', go: 'village' },
        { t: 'Is something troubling you?', go: 'comb', if: () => !SV.state.side.comb },
        { t: 'Return the comb', go: 'combDone', if: () => SV.state.side.comb === 'active' && SV.Inv.has('farmer_comb') }, leave] },
      father: { text: 'One winter he stared at the herons in the paddy for an hour. I asked what he saw. He said, "Birds that can\'t go home." Odd man. Good man.', go: 'start' },
      bandits: { text: () => (M().missionDone('m2') ? 'Goro\'s lot are scattered. But someone paid them, boy. Bandits don\'t sit watching a village for months for free.' : 'Goro the Ox and his dogs camp in the bamboo clearing. They don\'t raid much. They watch. Like they\'re waiting for someone.'), go: 'start' },
      village: { text: 'Kurohana means "black flower." The first settlers burned their fields so their lords couldn\'t follow. Rice grows well in ash.', go: 'start' },
      comb: { text: 'My wife\'s comb. Red lacquer. I dropped it near the bamboo when the wolves chased me off the west path. I\'m too old to go back.', choices: [{ t: 'I\'ll find it', do: () => SV.Missions.startSide('comb'), go: 'end' }, leave] },
      combDone: { text: 'That\'s... that\'s it. Forty years she wore it. Here — it isn\'t much, but take it, and don\'t argue with an old man.', do: () => SV.Missions.finishSide('comb'), go: 'end' },
    };
  }
  function treeHayato() {
    const stage = SV.state.flags.trainStage || 0;
    if (M().at('m2', 'training')) {
      if (!stage) return {
        start: { text: 'Daisuke\'s son, with Daisuke\'s sword. You swing it like a man chopping firewood. Shall we fix that?', choices: [{ t: 'Begin training', go: 'begin' }, leave] },
        begin: { text: 'First: three clean cuts on the dummy. Then I\'ll teach you to put your weight behind a blow, to roll, and to catch a blade on your own.', do: () => S().training(1), go: 'end' },
      };
      if (stage === 4) return { start: { text: 'Good. Now face me. Hold your guard and catch my strike the instant it lands. Too early and you\'re just a wall. On time, and you\'re a door that opens onto my throat.', choices: [{ t: 'Spar with Hayato', do: () => S().spar(), go: 'end' }, leave] } };
      return { start: { text: () => ['', 'Three cuts on the dummy. Light strikes — left click.', 'Hold the strike. Feel the weight gather, then release into the dummy.', 'Roll. Space. Twice. A dead swordsman never learned to move his feet.'][stage] || 'Continue.', go: 'end' } };
    }
    return {
      start: { text: () => (M().missionDone('m2') ? 'Remember: the counter is not a block. It is an answer.' : 'Come back when you have a blade worth teaching with.'), choices: [{ t: 'Ask about technique', go: 'tech' }, leave] },
      tech: { text: 'Heavy strikes break a guard. Light strikes find gaps. Watch for the red glint before they swing — that is your moment to roll, or to answer.', go: 'start' },
    };
  }
  function treeMonk() {
    return {
      start: { text: () => (SV.state.abilities.healing ? 'Sit, if you need to. The shrine asks nothing of you.' : 'The kami of Kurohana are quiet tonight. They are listening.'), choices: [
        { t: 'Ask about the shrine', go: 'shrine' },
        { t: 'Ask about the lost petals', go: 'petals', if: () => !SV.state.side.petals },
        { t: 'Return the petals', go: 'petalsDone', if: () => SV.state.side.petals === 'active' && SV.Collect.count('petal') >= 5 },
        { t: 'Ask about meditation', go: 'med' }, leave] },
      shrine: { text: 'This shrine is younger than the one in the south. That one was abandoned when its keeper vanished. Your father used to sweep its steps, before the elder sealed the road.', go: 'start' },
      petals: { text: 'When the old sakura bloomed the night of the attack, five petals were carried off by the wind. Superstition says they hold the village\'s grief. Find them, and bring them home?', choices: [{ t: 'I will look for them', do: () => SV.Missions.startSide('petals'), go: 'end' }, leave] },
      petalsDone: { text: 'All five. The wind gives back what it takes, if someone is patient. Take this charm — it will steady your breathing.', do: () => SV.Missions.finishSide('petals'), go: 'end' },
      med: { text: () => (SV.state.abilities.healing ? 'Kneel at any shrine and breathe. The body remembers how to mend.' : 'Meditation needs a quiet mind. Yours is a storm. Perhaps one day.'), go: 'start' },
    };
  }
  function treeHana() {
    if (M().at('m3', 'hana')) return {
      start: { text: 'Please — you\'re the swordsman. My son, Kenji. He went into the deep grove to gather shade herbs for my fever. He\'s eight. He\'s been gone since dawn.', go: 'two' },
      two: { text: 'The elder says the wolves have grown bold. No one will go. Please...', choices: [{ t: 'I\'ll bring him home', do: () => M().complete('m3', 'hana'), go: 'yes' }] },
      yes: { who: 'ren', text: 'Stay by the fire. I\'ll find him.', go: 'end' },
    };
    if (M().missionDone('m3')) return { start: { text: 'You brought him back to me. Whatever you\'re chasing, Ren... I hope it lets you rest someday.', go: 'end' } };
    return { start: { text: 'Kenji... please hurry.', go: 'end' } };
  }
  function treeKenji() {
    return { start: { text: () => (SV.state.flags.kenjiTalked ? U.choice(['I\'m going to be a swordsman too! ...Mother says no.', 'The white masks had a bird on them. A crane. Like on your coin.', 'The wolves were scary. You weren\'t scared at all!']) : 'Mister Ren!'), go: 'end' } };
  }
  function treeAmbient(id) {
    const lines = {
      aiko: [() => (M().missionDone('m1') ? 'They say you fought a ghost at the bamboo shrine. Was it a ghost?' : 'You\'re Daisuke\'s son, aren\'t you? I was small when... I\'m sorry.'), () => 'The sakura bloom too late this year. Everything is late since the masks came back.'],
      taro: [() => 'Mountain road\'s blocked. Rocks don\'t fall like that by themselves, mark me.', () => (M().missionDone('m2') ? 'Carried a crate past Goro\'s old camp today. Empty. Good riddance.' : 'Careful on the north path. Bandits.')],
      mitsu: [() => 'Your mother would have been proud. You don\'t remember her, do you? She sang to the well every morning.', () => 'Hmph. Young people, always running somewhere.'],
    }[id];
    return { start: { text: U.choice(lines), go: 'end' } };
  }

  return { spawnArea, update, interactables, find, DEF, LOOK, get list() { return list; }, visibleList: () => list.filter(visible), talk };
})();
