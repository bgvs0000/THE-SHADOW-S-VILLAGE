/* =========================================================
   STORY — cinematic engine (letterbox, camera pans, slow-mo,
   subtitles, title cards, actors) and every scripted event
   for Missions 01–04. Cinematics are async scripts; holding
   ESC / tapping SKIP fast-forwards them safely.
   ========================================================= */
SV.Cine = (function () {
  const U = SV.U;
  let waits = [];
  const st = { active: false, skip: false, cam: null, skipHold: 0 };
  const $ = (id) => document.getElementById(id);

  function tick(dt) {
    if (st.active && SV.Input.down.menu) { st.skipHold += dt; if (st.skipHold > 0.5) st.skip = true; } else st.skipHold = 0;
    for (let i = waits.length - 1; i >= 0; i--) { const w = waits[i]; w.t -= dt; if (w.t <= 0 || st.skip) { waits.splice(i, 1); w.res(); } }
    // camera tween
    const c = st.cam; if (c && c.tween) { c.tween.t += dt; const k = U.easeInOut(Math.min(1, c.tween.t / c.tween.d)); c.x = U.lerp(c.tween.x0, c.tween.x1, k); c.y = U.lerp(c.tween.y0, c.tween.y1, k); if (c.tween.z1 != null) SV.Camera.targetZoom = U.lerp(c.tween.z0, c.tween.z1, k); if (st.skip) { c.x = c.tween.x1; c.y = c.tween.y1; } }
  }
  const wait = (t) => new Promise((res) => { if (st.skip) return res(); waits.push({ t, res }); });

  async function begin() {
    st.active = true; st.skip = false;
    $('cine').classList.remove('hidden'); requestAnimationFrame(() => { if (st.active) $('cine').classList.add('on'); });
    document.getElementById('hud').classList.add('cine');
    SV.Input.clearAll();
    const P = SV.Player.e; st.cam = { x: SV.Camera.x, y: SV.Camera.y };
    if (P && (P.state === 'attack' || P.state === 'block' || P.state === 'charge')) { P.state = 'idle'; P.atk = null; }
  }
  async function end() {
    $('cine').classList.remove('on'); $('cineSub').classList.remove('show'); $('cineCaption').classList.remove('show');
    document.getElementById('hud').classList.remove('cine');
    setTimeout(() => { if (!st.active) $('cine').classList.add('hidden'); }, 800);
    st.active = false; st.skip = false; st.cam = null; SV.Camera.targetZoom = SV.Camera.baseZoom();
    SV.Story.extraDark = 0; SV.Story.windBoost = 0; SV.Story.vignette = 0;
    if (SV.Story.flashback) setFlashback(false);
    $('fade').style.opacity = 0;
    SV.Input.clearAll();
  }
  function fade(to, d = 0.6) { const f = $('fade'); f.style.transition = `opacity ${st.skip ? 0.05 : d}s ease`; f.style.opacity = to; return wait(d); }
  async function caption(big, small, d = 3) {
    const el = $('cineCaption'); el.querySelector('.cc-big').textContent = big; el.querySelector('.cc-small').textContent = small || '';
    el.classList.add('show'); await wait(d); el.classList.remove('show'); await wait(0.9);
  }
  /** Subtitle line; auto-advances, click/E skips ahead */
  async function say(who, text, extra = 0) {
    const el = $('cineSub'); el.querySelector('.cs-who').textContent = who || ''; const tx = el.querySelector('.cs-text');
    el.classList.add('show'); tx.textContent = '';
    if (st.skip) return;
    let shown = 0; const dur = 1.6 + text.length * 0.045 + extra;
    let t = 0; let done = false;
    await new Promise((res) => {
      const step = (dt) => {
        t += dt; shown = Math.min(text.length, Math.floor(t / 0.022)); tx.textContent = text.slice(0, shown);
        const I = SV.Input.pressed;
        if ((I.interact || I.dodge || I.attack || I.confirm || clicked) && t > 0.15) { clicked = false; if (shown < text.length) t = text.length * 0.022; else done = true; }
        if (t > dur || st.skip) done = true;
        if (done) { tx.textContent = text; SV.Cine.stepper = null; res(); }
      };
      SV.Cine.stepper = step;
    });
    SV.Audio.play('ui');
  }
  let clicked = false;
  document.addEventListener('DOMContentLoaded', () => {
    $('cine').addEventListener('pointerdown', () => (clicked = true));
    $('cineSkip').addEventListener('click', (e) => { e.stopPropagation(); st.skip = true; });
  });
  function hideSub() { $('cineSub').classList.remove('show'); }
  function pan(x, y, d = 1.5, z) { st.cam = st.cam || { x: SV.Camera.x, y: SV.Camera.y }; st.cam.tween = { t: 0, d, x0: st.cam.x, y0: st.cam.y, x1: x, y1: y, z0: SV.Camera.targetZoom, z1: z }; return wait(d); }
  function cut(x, y) { st.cam = { x, y }; SV.Camera.x = x; SV.Camera.y = y; }
  async function title(num, jp, name, sub) {
    const el = $('cineTitle'); el.querySelector('.ct-num').textContent = num; el.querySelector('.ct-jp').textContent = jp; el.querySelector('.ct-name').textContent = name;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); SV.Audio.play('gong');
    if (sub) setTimeout(() => SV.UI.toast(sub, 'big'), 2500);
    await wait(4.4);
  }
  function tween(obj, key, to, d) { const from = obj[key]; let t = 0; return new Promise((res) => { const f = (dt) => { t += dt; obj[key] = U.lerp(from, to, Math.min(1, t / d)); if (t >= d || st.skip) { obj[key] = to; res(); return true; } }; SV.Cine.tweens.push(f); }); }
  function setFlashback(on) { SV.Story.flashback = on; document.getElementById('game').style.filter = on ? 'sepia(.55) saturate(.7) contrast(1.15) brightness(.9)' : ''; }
  return { st, tick, wait, begin, end, fade, caption, say, hideSub, pan, cut, title, tween, tweens: [], stepper: null, setFlashback, get active() { return st.active; } };
})();

SV.Story = (function () {
  const U = SV.U, C = SV.Cine;
  const M = () => SV.Missions;
  const F = SV.state && (() => SV.state.flags);
  const flags = () => SV.state.flags;
  const actors = [];
  const api = { extraDark: 0, windBoost: 0, vignette: 0, flashback: false, actors };

  const FATHER = { top: '#33302c', robe: '#22201d', sash: '#5a4a2a', hair: '#3a3a3a', beard: '#3a3a3a', collar: '#cfc6b2', weapon: 'katana', bladeCol: '#e8e2d0', handle: '#2a1a12' };
  function actor(look, x, y, o = {}) {
    const a = Object.assign({ look, x, y, alpha: 1, facing: Math.PI / 2, walk: 0, moving: false, t: 0 }, o);
    a.draw = (c) => { c.save(); c.globalAlpha = a.alpha; if (a.ghost) { c.globalCompositeOperation = 'lighter'; } SV.Sprites.drawHuman(c, a.x, a.y, Object.assign({}, a.look, { facing: a.facing, walk: a.walk, moving: a.moving, t: a.t })); c.restore(); };
    actors.push(a); return a;
  }
  function clearActors() { actors.length = 0; }
  function moveActor(a, x, y, d) { const x0 = a.x, y0 = a.y; let t = 0; a.moving = true; a.facing = U.ang(x0, y0, x, y); return new Promise((res) => { C.tweens.push((dt) => { t += dt; const k = Math.min(1, t / d); a.x = U.lerp(x0, x, k); a.y = U.lerp(y0, y, k); a.walk += dt * 9; if (k >= 1 || C.st.skip) { a.x = x; a.y = y; a.moving = false; res(); return true; } }); }); }
  /** Non-blocking line of thought at the bottom of the screen */
  let barkT = null;
  function bark(text, who = 'Ren') {
    if (C.active) return;
    const el = document.getElementById('cineSub'); const cine = document.getElementById('cine');
    cine.classList.remove('hidden'); el.querySelector('.cs-who').textContent = who; el.querySelector('.cs-text').textContent = text; el.classList.add('show');
    clearTimeout(barkT); barkT = setTimeout(() => { el.classList.remove('show'); setTimeout(() => { if (!C.active) cine.classList.add('hidden'); }, 400); }, 2600 + text.length * 40);
  }
  function itemReveal(id) { SV.Inv.add(id, 1); SV.UI.itemReveal(id); SV.Audio.play('pickup'); }

  /* ======================= INTRO ======================= */
  api.intro = async function () {
    await C.begin();
    const f = document.getElementById('fade'); f.style.transition = 'none'; f.style.opacity = 1;
    // flashback: Kurohana burning, twelve years ago
    SV.Game.enterArea('village', 600, 900, { silent: true });
    SV.World.area.forceNight = true; SV.World.area.weather = 'rain';
    SV.World.area.fires = [{ x: 520, y: 740, r: 34 }, { x: 690, y: 700, r: 26 }, { x: 980, y: 480, r: 22 }, { x: 1500, y: 360, r: 22 }];
    C.setFlashback(true);
    SV.Player.e.alpha = 0; SV.Player.e.x = 300; SV.Player.e.y = 300; SV.Player.e.hidden = 999;
    const father = actor(Object.assign({}, FATHER, { kneel: true }), 600, 850, { facing: Math.PI / 2 });
    const m1 = actor(SV.Enemies.TYPES.masked.look, 520, 930, { facing: -1 });
    const m2 = actor(SV.Enemies.TYPES.masked.look, 700, 920, { facing: -2.2 });
    const boy = actor(Object.assign({}, SV.NPC.LOOK.kenji, { top: '#2a2a2f', robe: '#1a1a1e', sash: '#8B1E1E' }), 600, 790, { facing: Math.PI / 2 });
    C.cut(600, 860); SV.Camera.targetZoom = SV.Camera.baseZoom() * 1.25; SV.Camera.zoom = SV.Camera.targetZoom;
    api.windBoost = 0.6;
    await C.caption('KUROHANA VILLAGE', 'Twelve years ago', 2.6);
    await C.fade(0, 2);
    SV.Audio.play('drum');
    await C.say('Father', 'Ren... listen to me. Don\'t look at them. Look at me.');
    await C.pan(600, 840, 1.2, SV.Camera.baseZoom() * 1.5);
    await C.say('Father', 'Do not seek the man who killed me.', 0.6);
    await C.say('Father', 'Seek the reason they wanted me dead.', 1);
    SV.Audio.play('sting'); api.vignette = 0.3;
    await moveActor(m1, 570, 885, 1.2);
    SV.UI.flash(0.9); SV.Audio.play('heavy'); SV.Camera.shake(8, 0.4);
    await C.fade(1, 0.15);
    clearActors(); C.setFlashback(false); api.vignette = 0;
    await C.caption('TWELVE YEARS LATER', '', 2.4);
    // present day
    SV.state.time = 0.56; SV.state.weather = 'clear';
    SV.Game.enterArea('village', 1300, 230, { silent: true });
    SV.Player.e.alpha = 1; SV.Player.e.hidden = 0; SV.Player.e.facing = Math.PI / 2;
    C.cut(1300, 120); SV.Camera.targetZoom = SV.Camera.baseZoom();
    await C.fade(0, 1.8);
    await C.pan(1300, 240, 2.2);
    await C.say('Ren', 'Kurohana. It still smells of ash and rice.');
    await C.say('Ren', 'Father\'s house should be on the west side. If anything of him is left, it\'s there.');
    await C.end();
    api.missionIntro(M().LIST[0]);
    SV.Save.autosave('start');
  };

  api.missionIntro = async function (m) {
    if (!m) return;
    flags()['started_' + m.id] = true;
    await C.title('MISSION ' + m.num, m.jp, m.title.toUpperCase(), m.future ? 'This chapter is still being written — keep exploring, upgrading and finishing side quests.' : null);
    if (m.id === 'm2') bark('"Where the blade sleeps, water falls." The waterfall in the bamboo forest.');
    if (m.id === 'm3') bark('Someone is weeping in the village square.');
    if (m.id === 'm4') bark('White masks at the old shrine. The elder should know more.');
    SV.UI.refreshMission();
  };

  /* ======================= MISSION 01 ======================= */
  api.desk = function () {
    if (M().at('m1', 'house')) {
      SV.Dialogue.lines([
        ['ren', 'Scorch marks. Someone burned papers here, and not twelve years ago. The ash is fresh.'],
        ['ren', 'Whoever it was missed one. Half a page, wedged behind the drawer.'],
        ['ren', '"...the Crane must never find the—" The rest is gone.'],
      ], null, () => { itemReveal('burnt_letter'); M().complete('m1', 'house'); });
    } else bark('The desk where Father wrote his letters. Ash still clings to the grain.');
  };
  api.shelf = function () { bark(SV.state.flags.crestFound ? 'Northern poetry. A pressed heron feather marks a page about birds that cannot go home.' : 'Farming almanacs, a book of northern poetry... nothing a farmer would hide.'); };
  api.hearth = async function () {
    if (!M().at('m1', 'crest')) { bark(SV.state.flags.crestFound ? 'The loose board, the empty hollow beneath. He kept it here for twelve years.' : 'Cold ash. The fire has been asleep a long time.'); return; }
    await C.begin();
    await C.pan(400, 300, 1, SV.Camera.baseZoom() * 1.4);
    await C.say('Ren', '"Look where the fire slept"...');
    SV.Audio.play('door'); SV.Camera.shake(3, 0.3); SV.World.burst(450, 300, 20, { type: 'dust', col: 'rgba(140,130,110,', smin: 10, smax: 60, life: 1.2, size: 5 });
    flags().crestFound = true;
    await C.wait(0.6);
    itemReveal('family_crest');
    await C.say('Ren', 'Three feathers around a broken blade. Father\'s crest... I never knew he had one.');
    await C.say('Ren', 'Scratched into the back: "Where the blade sleeps, water falls."');
    await C.say('Ren', 'And someone else was searching for this. Their footprints are still fresh outside.');
    await C.end();
    M().complete('m1', 'crest');
  };
  api.track = function (i) {
    flags()['track' + i] = true; SV.Audio.play('step'); SV.Audio.play('ui');
    bark(['Split-toed tabi. Light, even steps. Trained feet.', 'They stopped here to listen, then moved on toward the north gate.', 'North, into the bamboo. Whoever it was isn\'t afraid of the woods.'][i]);
    SV.UI.refreshMission(); SV.Save.autosave('clue');
  };
  api.m1Shrine = async function () {
    await C.begin();
    await C.pan(470, 400, 1.2, SV.Camera.baseZoom() * 1.3);
    await C.say('Ren', 'A shrine, hidden in the bamboo. The incense is still burning.');
    await C.say('Ren', 'A crane, carved above the door. "The Crane must never find..."');
    M().complete('m1', 'shrine');
    // ---- ambush ----
    SV.Audio.play('whoosh');
    C.tween(api, 'extraDark', 0.3, 1.5); C.tween(api, 'windBoost', 1.4, 1.2); api.vignette = 0.25;
    for (let i = 0; i < 50; i++) SV.World.spawn({ type: 'leaf', x: 300 + Math.random() * 400, y: 300 + Math.random() * 300, vx: U.rand(80, 200), vy: U.rand(-40, 40), life: 3, seed: Math.random() * 9, size: 3, col: U.choice(['#7a8a3a', '#a0a04a', '#c9a227']), vr: 6 });
    await C.wait(1.2);
    let en = SV.Enemies.list.find((e) => e.uid === 'masked_scout');
    if (!en) en = SV.Enemies.spawn('masked', 470, 650, { uid: 'masked_scout' });
    en.state = 'cine'; en.facing = -Math.PI / 2; en.alpha = 0;
    await C.pan(470, 580, 1.4);
    C.tween(en, 'alpha', 1, 1.2);
    SV.Game.slow(0.5, 2);
    SV.Audio.play('sting');
    await C.say('???', 'You are his son.', 0.5);
    await C.say('Ren', 'And you are one of the masks that killed him.');
    await C.say('???', 'We are the ones who finish what he left unfinished. Draw, boy.');
    await C.end();
    en.state = 'chase'; en.aggro = true;
    bark('Watch for the red glint. Block with right click, roll with Space.', 'Instinct');
  };
  SV.Bus.on('kill', (en) => {
    if (en.uid === 'masked_scout') api.m1End(en);
    if (en.uid === 'goro') api.m2Goro(en);
    if (en.uid === 'ronin') { flags().key_ronin = true; setTimeout(() => { itemReveal('shrine_key'); bark('A bronze key hung from the ronin\'s belt, a fox engraved on its bow.'); SV.Save.autosave('key'); }, 900); }
  });
  api.m1End = async function (en) {
    await C.wait(0.8);
    await C.begin();
    const dying = actor(Object.assign({}, SV.Enemies.TYPES.masked.look, { kneel: true }), en.x, en.y, { facing: U.ang(en.x, en.y, SV.Player.e.x, SV.Player.e.y) });
    en.alpha = 0;
    await C.pan((en.x + SV.Player.e.x) / 2, (en.y + SV.Player.e.y) / 2 - 20, 1, SV.Camera.baseZoom() * 1.4);
    await C.say('Masked Stranger', 'The Crane... remembers... every debt.');
    SV.Audio.play('enemy_die'); C.tween(dying, 'alpha', 0, 1.2);
    await C.wait(1);
    itemReveal('crane_mask');
    await C.say('Ren', 'A crane mask.');
    SV.UI.flash(0.4); SV.Audio.play('chime');
    const P = SV.Player.e;
    for (let i = 0; i < 30; i++) SV.World.spawn({ type: 'spark', x: P.x + U.rand(-30, 30), y: P.y - U.rand(0, 50), vy: -U.rand(20, 60), life: U.rand(0.8, 1.6), col: '#C9A227', size: 1.6 });
    await C.say('Ren', 'The crest... it\'s warm. Like something inside me just woke up.');
    await C.say('Ren', 'Father. What did you do, that they still hunt your name?');
    clearActors();
    await C.end();
    M().complete('m1', 'enemy');
  };

  /* ======================= MISSION 02 ======================= */
  api.pool = async function () {
    if (!M().at('m2', 'katana')) { bark(SV.Inv.has('kurohana_blade') || SV.Inv.has('broken_katana') ? 'The waterfall keeps its own counsel now.' : 'The water falls endlessly, white as a crane\'s wing.'); return; }
    await C.begin();
    await C.pan(1890, 330, 1.2, SV.Camera.baseZoom() * 1.3);
    await C.say('Ren', '"Where the blade sleeps, water falls."');
    SV.Audio.play('whoosh'); SV.World.burst(1890, 330, 30, { type: 'mist', col: 'rgba(220,230,240,', smin: 20, smax: 90, life: 1.5, size: 8 });
    await C.wait(0.8);
    itemReveal('broken_katana');
    await C.say('Ren', 'Wrapped in oilcloth, behind the falls. Father\'s sword... broken.');
    await C.say('Ren', 'Pieces are missing. Steel like this doesn\'t vanish. It scatters.');
    await C.end();
    M().complete('m2', 'katana');
  };
  api.fragment = function (id, text) {
    flags()[id] = true; SV.Inv.add('sword_fragment', 1); SV.Audio.play('pickup');
    SV.UI.toast(`+ Sword Fragment (${SV.Inv.count('sword_fragment')}/3)`, 'big'); bark(text);
    SV.UI.refreshMission(); SV.Save.autosave('fragment');
  };
  api.well = function () {
    if (M().at('m2', 'fragments') && !flags().frag_well) return api.fragment('frag_well', 'Something glinted at the bottom. You haul up the bucket — a sliver of folded steel.');
    bark(U.choice(['Your reflection looks older than you remember.', 'Mitsu says your mother sang to this well every morning.']));
  };
  api.reforge = async function () {
    SV.Inv.remove('sword_fragment', 3); SV.Inv.remove('broken_katana', 1);
    await C.begin();
    await C.pan(1770, 1210, 1.2, SV.Camera.baseZoom() * 1.35);
    await C.say('Tetsuo', 'Steel remembers its master. Let\'s see if it remembers you.');
    for (let i = 0; i < 5; i++) {
      SV.Audio.play('anvil'); if (i % 2 === 0) SV.Audio.play('drum'); SV.Camera.shake(4, 0.15);
      SV.World.burst(1760, 1225, 24, { type: 'spark', col: '#ffb050', smin: 60, smax: 260, life: 0.7, up: 60, drag: 2 });
      await C.wait(0.55);
    }
    await C.fade(1, 0.6); await C.caption('DAWN', '', 1.2); await C.fade(0, 0.8);
    SV.UI.flash(0.5);
    SV.Inv.add('kurohana_blade', 1); SV.state.equipped.weapon = 'kurohana_blade'; SV.UI.itemReveal('kurohana_blade');
    await C.say('Tetsuo', 'Thirteen folds. Northern hamon. This was never a farmer\'s sword, boy. Your father was someone, once.');
    await C.say('Tetsuo', 'Bring me iron sand and leather and I\'ll keep making it better. Hayato on the training ground will teach you to deserve it.');
    await C.end();
    SV.UI.toast('Equipped Kurohana Blade · Damage 10 → 16', 'big');
    M().complete('m2', 'repair');
  };
  // ---- Training with Hayato ----
  SV.Enemies.TYPES.sparring = { name: 'Master Hayato', hp: 9999, dmg: 3, speed: 90, r: 12, range: 50, windup: 0.75, recover: 1.0, poise: 9999, detect: 999, block: 0.35, immortal: true, look: Object.assign({}, SV.NPC.LOOK.hayato), drops: {} };
  api.training = function (stage) {
    flags().trainStage = stage; flags().trainCount = 0;
    if (stage === 1) bark('Three light strikes on the dummy. Left click.', 'Hayato');
    if (stage === 2) { SV.state.abilities.heavy = true; bark('Now hold the strike to gather weight, then release into the dummy.', 'Hayato'); SV.UI.toast('Ability unlocked: HEAVY STRIKE (hold attack)', 'big'); }
    if (stage === 3) bark('Roll! Space bar. Twice.', 'Hayato');
    if (stage === 4) bark('Good. Come and face me.', 'Hayato');
    SV.Save.autosave('training');
  };
  SV.Bus.on('dummyHit', (kind) => {
    const s = flags().trainStage; if (!M().at('m2', 'training')) return;
    if (s === 1 && (kind === 'light' || kind === 'quick')) { flags().trainCount++; SV.World.text(SV.Player.e.x, SV.Player.e.y - 70, flags().trainCount + '/3', '#C9A227'); if (flags().trainCount >= 3) api.training(2); }
    else if (s === 2 && kind === 'heavy') api.training(3);
  });
  SV.Bus.on('dodge', () => { if (flags().trainStage === 3 && M().at('m2', 'training')) { flags().trainCount++; if (flags().trainCount >= 2) api.training(4); } });
  api.spar = function () {
    flags().sparring = true;
    const n = SV.NPC.find('hayato');
    SV.Enemies.spawn('sparring', n ? n.x : 770, n ? n.y : 1460, { hx: 770, hy: 1400, aggro: true, state: 'alert' });
    bark('Hold right click as my blade lands — not before.', 'Hayato');
  };
  SV.Bus.on('parry', async () => {
    if (!flags().sparring) return;
    flags().sparring = false;
    const sp = SV.Enemies.list.find((e) => e.type === 'sparring');
    await C.wait(0.6);
    if (sp) { const i = SV.Enemies.list.indexOf(sp); SV.Enemies.list.splice(i, 1); const n = SV.NPC.find('hayato'); if (n) { n.x = sp.x; n.y = sp.y; } }
    SV.state.abilities.quick = true; SV.state.abilities.counter = true;
    await C.begin();
    await C.pan(SV.Player.e.x, SV.Player.e.y - 20, 0.8, SV.Camera.baseZoom() * 1.3);
    await C.say('Hayato', 'There. That is the counter. Not a wall — an answer.');
    await C.say('Hayato', 'And when your rhythm is true, a third cut will come faster than thought. Your father fought like that. Too well for a farmer.');
    await C.end();
    SV.UI.toast('Abilities unlocked: COUNTER · QUICK SLASH', 'big');
    flags().trainStage = 5;
    M().complete('m2', 'training');
    bark('Goro\'s bandits camp in the eastern bamboo clearing.', 'Ren');
  });
  api.m2Goro = async function (en) {
    flags().goroTalked = true;
    await C.wait(0.5);
    await C.begin();
    const dying = actor(Object.assign({}, SV.Enemies.TYPES.leader.look, { kneel: true, scale: 1.2 }), en.x, en.y, { facing: U.ang(en.x, en.y, SV.Player.e.x, SV.Player.e.y) }); en.alpha = 0;
    await C.pan(en.x, en.y - 20, 1, SV.Camera.baseZoom() * 1.35);
    await C.say('Goro the Ox', 'Hah... Daisuke\'s boy. They said you\'d come home eventually.');
    await C.say('Ren', 'Who said?');
    await C.say('Goro the Ox', 'Men in white masks. Paid good gold. "Watch the village. Wait for the son." Never said why.');
    await C.say('Goro the Ox', 'They pay... in coin stamped with a crane...', 0.5);
    C.tween(dying, 'alpha', 0, 1.2); await C.wait(1);
    clearActors();
    await C.end();
  };

  /* ======================= MISSION 03 ======================= */
  api.sandal = function () { itemReveal('kenji_sandal'); bark('A child\'s sandal. Small footprints beside it — and wolf tracks. Fresh.'); M().complete('m3', 'search'); };
  api.cutBamboo = function () {
    if (!M().at('m3', 'hidden') && !M().reached('m3', 'hidden')) { bark('The wind whistles through these stalks, as if there\'s space behind them.'); return; }
    const P = SV.Player.e; P.state = 'attack'; P.t = 0; P.atk = { t: 0, p: 0, dur: 0.4, hit: [2, 2], ang: -Math.PI / 2, from: -Math.PI / 2 - 1.6, to: -Math.PI / 2 + 1.6, heavy: true };
    SV.Game.after(0.4, () => { P.atk = null; P.state = 'idle'; });
    SV.Audio.play('heavy'); SV.Camera.shake(6, 0.3);
    flags().bambooCut = true;
    for (let i = 0; i < 40; i++) SV.World.spawn({ type: 'leaf', x: 1100 + Math.random() * 200, y: 1000 + Math.random() * 140, vx: U.rand(-100, 100), vy: U.rand(-120, 20), g: 120, life: 2.5, seed: Math.random() * 9, size: 3, col: U.choice(['#6b8a43', '#58753a', '#a0a04a']), vr: 6 });
    bark('A path. Someone cut it before — and let it grow back to hide it.');
    M().complete('m3', 'hidden'); SV.Save.autosave('path');
  };
  api.tablet = function () {
    SV.Dialogue.lines([
      ['Stone Tablet', 'The verse is weathered, but legible:'],
      ['Stone Tablet', '"When the fox stirs, the crane takes wing."'],
      ['Stone Tablet', '"When the crane is gone, the wolf may hunt."'],
      ['Stone Tablet', '"Only when the wolf is fed does the moon rise."'],
    ], { name: 'Stone Tablet', role: 'Forest Gate', look: { hat: 'hood', top: '#4e4c46', robe: '#3e3c36', hatCol: '#4e4c46', mask: 'crane' } });
  };
  api.rescueKenji = async function () {
    flags().kenjiTalked = true;
    await C.begin();
    await C.pan(1200, 290, 1, SV.Camera.baseZoom() * 1.4);
    await C.say('Kenji', 'M-mister? Are the wolves gone?');
    await C.say('Ren', 'Gone. Your mother is waiting. Can you walk?');
    await C.say('Kenji', 'The men in white masks tied me here so I wouldn\'t tell. I saw them at the old shrine south of the village. They were digging.');
    await C.say('Kenji', 'They were angry. They said the deepest door wouldn\'t open. That only "Daisuke\'s blood" could open it.');
    await C.say('Ren', '...Daisuke was my father.');
    await C.fade(1, 1);
    SV.Game.enterArea('village', 1260, 1110, { silent: true });
    const hana = SV.NPC.find('hana'); if (hana) { hana.x = 1230; hana.y = 1060; hana.talking = true; }
    const kid = actor(SV.NPC.LOOK.kenji, 1250, 1095, { facing: -Math.PI / 2 });
    C.cut(1250, 1080);
    await C.fade(0, 1);
    await C.say('Hana', 'Kenji! Oh, gods — Kenji!');
    await C.say('Hana', 'Thank you. Thank you. My husband was a field medic before the fever took him. Take his herb-grinding stone, and these — he called them "smoke prayers."');
    await C.say('Ren', 'Keep him close, Hana. The masks are not done with this village.');
    clearActors(); if (hana) hana.talking = false;
    await C.end();
    M().complete('m3', 'rescue');
  };
  api.comb = function () { flags().combFound = true; itemReveal('farmer_comb'); bark('A red lacquered comb, a heron in gold leaf. Genji\'s.'); SV.Save.autosave('comb'); };

  /* ======================= MISSION 04 ======================= */
  api.keyPond = function () { flags().key_pond = true; itemReveal('shrine_key'); SV.Audio.play('whoosh'); SV.World.burst(460, 1100, 16, { type: 'mist', col: 'rgba(200,220,235,', smin: 10, smax: 50, life: 1, size: 5 }); bark('Cold water, colder bronze. A key with a fox on its bow.'); SV.UI.refreshMission(); SV.Save.autosave('key'); };
  api.keyStatue = function () { flags().key_statue = true; SV.Camera.shake(6, 0.4); SV.Audio.play('door'); SV.World.burst(1790, 620, 24, { type: 'dust', col: 'rgba(130,125,110,', smin: 20, smax: 90, life: 1.2, size: 6 }); itemReveal('shrine_key'); bark('Beneath the statue, sealed in a clay box: another key.'); SV.UI.refreshMission(); SV.Save.autosave('key'); };
  api.symbolStone = function (i) {
    const id = 'sym' + (i + 1); const first = !flags()[id]; flags()[id] = true;
    const T = [['一 · 鶴 · Crane', '"First, the bird that rises."'], ['二 · 風 · Wind', '"Second, the wind that carries it."'], ['三 · 月 · Moon', '"Third, the moon that swallows all."']][i];
    SV.Dialogue.lines([['Inscription', T[0]], ['Inscription', T[1]]], { name: 'Inscription', role: 'Shrine Stone', look: { hat: 'hood', top: '#4e4c46', robe: '#3e3c36', hatCol: '#4e4c46' } });
    if (first) { SV.Audio.play('chime'); SV.UI.refreshMission(); SV.Save.autosave('symbol'); }
  };
  api.sealDoor = function () {
    if (flags().sealOpen) { bark('The sanctum is empty now. Only the smell of old incense remains.'); return; }
    const k = SV.Puzzles.keysPlaced();
    if (k < 3) { bark(`Three keyholes, each shaped like a fox's eye. ${k} of 3 keys fit.`); return; }
    if (SV.state.puzzles.statues !== 'solved') { bark('The keys turn, but the door holds. In the courtyard, the fox statues stare in every direction but home.'); return; }
    SV.Puzzles.openSeal();
  };
  api.m4Seal = async function () {
    await C.begin();
    SV.Audio.play('door'); SV.Camera.shake(5, 1);
    await C.pan(1100, 420, 1.4, SV.Camera.baseZoom() * 1.3);
    SV.UI.flash(0.5); SV.Audio.play('gong');
    C.tween(api, 'extraDark', 0.35, 1);
    await C.wait(1);
    const ghost = actor(FATHER, 1100, 470, { alpha: 0, ghost: true, facing: Math.PI / 2 });
    C.tween(ghost, 'alpha', 0.65, 1.5);
    await C.wait(1.4);
    await C.say('Father', 'Ren. If you stand here, they have found you too. I am sorry.');
    await C.say('Father', 'I served the Crane for eleven years. I cut down men whose names I was never told. Then they gave me an order I could not obey.');
    await C.say('Father', 'Remember this: the shadow does not run from the light. It moves through it.', 0.6);
    SV.UI.flash(0.6); SV.Audio.play('dash');
    await C.say('Father', 'I hid half the ledger here. The other half... I could not protect.');
    C.tween(ghost, 'alpha', 0, 1.5); await C.wait(1.4);
    itemReveal('crane_ledger');
    await C.say('Ren', 'Names. Payments. And circled at the bottom: "Akagawa camp — the second half."');
    await C.say('Ren', 'You didn\'t die for a debt, Father. You died for a book.');
    clearActors();
    await C.end();
    M().complete('m4', 'seal');
  };

  /* ======================= GENERAL ======================= */
  api.meditate = async function (place) {
    if (!SV.state.abilities.healing) { bark('You kneel and pray. Your thoughts are too loud for rest.'); return; }
    if (SV.Enemies.anyAggro()) { bark('Not with enemies nearby.'); return; }
    await C.begin(); await C.fade(1, 0.8);
    const P = SV.Player.e, st = SV.Stats.get(); P.hp = st.maxHp; P.st = st.maxSt;
    const t = SV.state.time; SV.state.time = t > 0.6 && t < 0.92 ? 0.05 : 0.6;
    await C.caption('MEDITATION', place, 1.6);
    await C.fade(0, 0.8); await C.end();
    SV.UI.toast('Fully restored · Time passes', 'big'); SV.UI.refreshHud(); SV.Save.autosave('rest');
  };
  api.memory = async function (L) {
    await C.begin(); C.setFlashback(true); await C.fade(0.75, 0.6);
    await C.caption(L.title.toUpperCase(), "Father's Memory", 1.8);
    await C.say('Memory', L.text, 1.5);
    await C.fade(0, 0.6); await C.end();
  };
  let ambushCd = 0;
  api.onEnterArea = function (id) {
    ambushCd--;
    if (id === 'bamboo_edge' && M().missionDone('m1') && !M().at('m2', 'bandits') && SV.World.env().night > 0.5 && ambushCd <= 0 && Math.random() < 0.35) {
      ambushCd = 3;
      setTimeout(() => api.ambush(), 2500);
    }
  };
  api.ambush = async function () {
    if (C.active || SV.Dialogue.active() || SV.Game.mode !== 'play') return;
    const P = SV.Player.e;
    await C.begin();
    SV.Audio.play('whoosh'); C.tween(api, 'extraDark', 0.25, 1); C.tween(api, 'windBoost', 1.2, 1);
    await C.say('Ren', 'The crickets have stopped. Steel glints between the stalks.');
    const a = SV.Enemies.spawn('footsoldier', P.x + 160, P.y - 60), b = SV.Enemies.spawn('footsoldier', P.x - 150, P.y + 70);
    [a, b].forEach((e) => { SV.World.collide(e); e.aggro = true; e.state = 'alert'; });
    SV.Game.slow(0.5, 1);
    await C.say('Crane Footsoldier', 'For the Council.');
    await C.end();
  };
  return Object.assign(api, { bark, actor, clearActors, itemReveal });
})();
