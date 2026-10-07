/* =========================================================
   ENEMIES — data-driven types + state machine AI:
   idle/wander → alert → chase/strafe → windup (telegraph)
   → attack → recover, with blocking, stagger, leash, death
   and loot drops.
   ========================================================= */
SV.Enemies = (function () {
  const U = SV.U;
  const list = [];
  const TYPES = {
    bandit: { name: 'Road Bandit', hp: 42, dmg: 10, speed: 100, r: 12, range: 44, windup: 0.5, recover: 0.6, poise: 22, detect: 280, block: 0.12,
      look: { top: '#5a4a35', robe: '#3e3226', legs: '#2a2219', sash: '#2a2a2a', hat: 'kasa', hatCol: '#7a6640', weapon: 'katana', bladeCol: '#9a9a9a', handle: '#3a2a1a', collar: '#8a7a60' },
      drops: { ryo: [6, 14], items: [['bandit_token', 0.5], ['leather', 0.25], ['iron_ore', 0.15]] } },
    leader: { name: 'Goro the Ox', hp: 160, dmg: 16, speed: 94, r: 15, range: 54, windup: 0.62, recover: 0.5, poise: 65, detect: 340, block: 0.3, combo: 0.6, boss: true, scale: 1.22, heavyBody: true,
      look: { top: '#6b3a22', robe: '#3a2418', legs: '#22160e', sash: '#C9A227', headband: '#5a1a1a', hair: '#1a1a1a', beard: '#1a1a1a', weapon: 'katana', bladeCol: '#b0b0b0', handle: '#222', collar: '#a08060' },
      drops: { ryo: [45, 60], items: [['iron_ore', 1], ['iron_ore', 1], ['leather', 1]] } },
    masked: { name: 'Masked Stranger', hp: 95, dmg: 12, speed: 128, r: 12, range: 46, windup: 0.42, recover: 0.45, poise: 40, detect: 400, block: 0.38, combo: 0.35, boss: true, evade: 0.3,
      look: { top: '#141416', robe: '#0e0e10', legs: '#08080a', sash: '#3a3a3a', mask: 'crane', hat: 'hood', hatCol: '#101012', weapon: 'katana', bladeCol: '#dfe4ea', handle: '#111', collar: '#2a2a2a' },
      drops: { ryo: [30, 30], items: [] } },
    footsoldier: { name: 'Crane Footsoldier', hp: 62, dmg: 12, speed: 112, r: 12, range: 46, windup: 0.46, recover: 0.5, poise: 30, detect: 300, block: 0.28,
      look: { top: '#2e2f33', robe: '#1d1e21', legs: '#141416', sash: '#8a8a8a', mask: 'crane', weapon: 'katana', bladeCol: '#cfd4da', handle: '#222', collar: '#555' },
      drops: { ryo: [10, 18], items: [['iron_ore', 0.3], ['leather', 0.2], ['tamahagane', 0.05]] } },
    wolf: { name: 'Grey Wolf', hp: 30, dmg: 8, speed: 168, r: 13, range: 42, windup: 0.38, recover: 0.65, poise: 10, detect: 300, block: 0, lunge: true, wolf: true,
      drops: { ryo: [0, 4], items: [['leather', 0.5]] } },
    ronin: { name: 'Hollow Ronin', hp: 175, dmg: 18, speed: 92, r: 14, range: 56, windup: 0.72, recover: 0.55, poise: 75, detect: 330, block: 0.42, combo: 0.5, boss: true, scale: 1.15, heavyBody: true,
      look: { top: '#3a3d44', robe: '#25272c', legs: '#151618', sash: '#5a1a1a', hat: 'kasa', hatCol: '#3a3426', weapon: 'katana', bladeCol: '#a9b3bd', handle: '#5a1a1a', collar: '#666' },
      drops: { ryo: [50, 70], items: [['tamahagane', 1]] } },
    dummy: { name: 'Training Dummy', hp: 9999, dmg: 0, speed: 0, r: 13, range: 0, poise: 9999, detect: 0, block: 0, dummy: true },
  };

  function spawn(type, x, y, o = {}) {
    const T = TYPES[type];
    const en = Object.assign({
      type, T, name: T.name, x, y, hx: x, hy: y, r: T.r, hp: T.hp, maxHp: T.hp, poise: T.poise, facing: Math.PI / 2,
      state: type === 'dummy' ? 'dummy' : 'idle', t: 0, walk: 0, moving: false, flash: 0, kx: 0, ky: 0, cd: U.rand(0.3, 1), wander: null, wt: U.rand(0, 2),
      aggro: false, dead: false, alpha: 1, boss: !!T.boss, heavyBody: !!T.heavyBody, seenAtk: null, lastHit: -9,
    }, o);
    en.stagger = (d) => stagger(en, d); en.die = () => die(en); en.draw = (c) => draw(en, c);
    list.push(en); return en;
  }
  function clear() { list.length = 0; }
  function spawnArea(a) {
    clear();
    if (!a.spawns) return;
    const all = a.spawns();
    // waves remember partial progress: skip already-defeated regular members
    const skip = {};
    all.forEach((s) => { if (s.wave && skip[s.wave] == null) { const uk = all.filter((x) => x.wave === s.wave && x.id && SV.state.killed[x.id]).length; skip[s.wave] = Math.max(0, (SV.state.flags['wave_' + s.wave] || 0) - uk); } });
    all.forEach((s) => {
      if (s.id && SV.state.killed[s.id]) return;
      if (s.wave && !s.id && skip[s.wave] > 0) { skip[s.wave]--; return; }
      spawn(s.type, s.x, s.y, { uid: s.id, wave: s.wave });
    });
  }
  function setState(en, s) { en.state = s; en.t = 0; }
  function stagger(en, d) { if (en.dead || en.type === 'dummy') return; setState(en, 'stagger'); en.stagT = d; en.poise = en.T.poise; en.atkDone = true; }

  function update(dt) {
    const P = SV.Player.e; if (!P) return;
    for (let i = list.length - 1; i >= 0; i--) {
      const en = list[i];
      en.t += dt; en.flash -= dt; en.cd -= dt;
      en.x += en.kx * dt; en.y += en.ky * dt; en.kx *= Math.pow(0.002, dt); en.ky *= Math.pow(0.002, dt);
      if (en.dead) { en.alpha -= dt * 0.8; if (en.alpha <= 0) list.splice(i, 1); continue; }
      if (en.state === 'dummy' || en.state === 'cine') { SV.World.collide(en); continue; }
      ai(en, dt, P);
      // separation
      for (const o of list) if (o !== en && !o.dead && o.type !== 'dummy') { const d = U.dist(en.x, en.y, o.x, o.y); if (d < en.r + o.r && d > 0) { const k = ((en.r + o.r - d) / d) * 0.5; en.x += (en.x - o.x) * k; en.y += (en.y - o.y) * k; } }
      SV.World.collide(en);
      en.poise = Math.min(en.T.poise, en.poise + dt * en.T.poise * 0.15);
    }
  }

  function ai(en, dt, P) {
    const T = en.T; const d = U.dist(en.x, en.y, P.x, P.y); const toP = U.ang(en.x, en.y, P.x, P.y);
    const canSee = !P.dead && P.hidden <= 0 && !SV.Game.inputLockedHard();
    let mx = 0, my = 0, sp = 0;
    switch (en.state) {
      case 'idle':
        if (!en.wander || en.wt <= 0) { en.wt = U.rand(2, 4.5); const a = Math.random() * Math.PI * 2, r = Math.random() * 110; en.wander = { x: en.hx + Math.cos(a) * r, y: en.hy + Math.sin(a) * r }; }
        en.wt -= dt;
        if (U.dist(en.x, en.y, en.wander.x, en.wander.y) > 10 && en.wt < 3) { const a = U.ang(en.x, en.y, en.wander.x, en.wander.y); mx = Math.cos(a); my = Math.sin(a); sp = T.speed * 0.35; en.facing = a; }
        if (canSee && (d < T.detect || en.aggro)) { setState(en, 'alert'); en.facing = toP; SV.Audio.play('alert'); }
        break;
      case 'alert':
        en.facing = toP; if (en.t > 0.45) { setState(en, 'chase'); en.aggro = true; }
        break;
      case 'chase': {
        if (!canSee) { if (P.hidden > 0 || P.dead) { en.aggro = false; setState(en, 'idle'); } break; }
        en.facing = toP;
        if (U.dist(en.x, en.y, en.hx, en.hy) > 750 && d > 420) { setState(en, 'return'); break; }
        // react to player's swing with a block
        if (T.block && (P.state === 'attack' || P.state === 'heavy') && P.atk && en.seenAtk !== P.atk && d < T.range * 1.9) {
          en.seenAtk = P.atk;
          if (Math.random() < T.block) { setState(en, 'block'); break; }
          if (T.evade && Math.random() < T.evade) { en.kx -= Math.cos(toP) * 380; en.ky -= Math.sin(toP) * 380; break; }
        }
        if (d < T.range + 6 && en.cd <= 0) { setState(en, 'windup'); break; }
        if (d > T.range * 0.85) { mx = Math.cos(toP); my = Math.sin(toP); sp = T.speed; }
        else if (en.cd > 0) { const s = (en.uid || en.x) % 2 ? 1 : -1; mx = Math.cos(toP + s * Math.PI / 2); my = Math.sin(toP + s * Math.PI / 2); sp = T.speed * 0.4; }
        if (d > T.range * 0.85 && d < T.range * 2.2 && en.cd > 0.2) { const s = Math.sin(SV.Game.time + en.hx) > 0 ? 1 : -1; mx = Math.cos(toP + s * 1.1); my = Math.sin(toP + s * 1.1); sp = T.speed * 0.55; }
        break;
      }
      case 'windup':
        en.facing = toP; en.atkDone = false;
        if (en.t > (en.chain ? 0.24 : T.windup)) { setState(en, 'attack'); en.atkDir = en.facing; if (!T.wolf) SV.Audio.play('swing'); if (T.lunge) { en.kx += Math.cos(en.facing) * 520; en.ky += Math.sin(en.facing) * 520; } else { en.kx += Math.cos(en.facing) * 160; en.ky += Math.sin(en.facing) * 160; } }
        break;
      case 'attack':
        if (!en.atkDone && en.t > 0.07) {
          en.atkDone = true;
          const dd = U.dist(en.x, en.y, P.x, P.y);
          if (dd < T.range + P.r + 8 && Math.abs(U.angDiff(en.atkDir, U.ang(en.x, en.y, P.x, P.y))) < 1.3) SV.Combat.hitPlayer(en, T.dmg);
        }
        if (en.t > 0.24 && en.state === 'attack') {
          if (T.combo && !en.chain && Math.random() < T.combo) { en.chain = true; setState(en, 'windup'); }
          else { en.chain = false; setState(en, 'recover'); }
        }
        break;
      case 'recover':
        if (en.t > T.recover) { setState(en, 'chase'); en.cd = U.rand(0.5, 1.4); }
        break;
      case 'block':
        en.facing = toP; if (en.t > 0.65) { setState(en, 'chase'); en.cd = Math.min(en.cd, 0.15); }
        break;
      case 'stagger':
        if (en.t > en.stagT) { setState(en, 'chase'); en.cd = 0.4; }
        break;
      case 'return': {
        const a = U.ang(en.x, en.y, en.hx, en.hy); mx = Math.cos(a); my = Math.sin(a); sp = T.speed; en.facing = a;
        if (U.dist(en.x, en.y, en.hx, en.hy) < 30) { setState(en, 'idle'); en.aggro = false; en.hp = Math.min(en.maxHp, en.hp + en.maxHp * 0.5); }
        break;
      }
    }
    en.moving = sp > 0;
    if (sp) { en.x += mx * sp * dt; en.y += my * sp * dt; en.walk += dt * (T.wolf ? 14 : 10); }
  }

  function die(en) {
    if (en.dead) return;
    en.dead = true; en.state = 'dead'; en.t = 0;
    SV.Audio.play('enemy_die');
    SV.World.burst(en.x, en.y - 20, 18, { type: 'dust', col: 'rgba(30,30,30,', smin: 20, smax: 80, life: 1.2, size: 5 });
    const D = en.T.drops || {};
    if (D.ryo) { const n = U.randi(D.ryo[0], D.ryo[1]); if (n > 0) SV.Collect.drop(en.x, en.y, { ryo: n }); }
    (D.items || []).forEach(([id, ch]) => { if (Math.random() < ch) SV.Collect.drop(en.x, en.y, { item: id, qty: 1 }); });
    if (en.uid) SV.state.killed[en.uid] = true;
    if (en.type !== 'dummy') SV.state.kills++;
    if (en.boss) { SV.Game.slow(0.25, 0.8); SV.Camera.shake(6, 0.3); }
    SV.Bus.emit('kill', en);
  }

  function draw(en, c) {
    const T = en.T;
    if (T.dummy) {
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(en.x, en.y, 12, 4, 0, 0, Math.PI * 2); c.fill();
      const w = en.flash > 0 ? Math.sin(en.t * 60) * 3 : 0;
      c.fillStyle = '#4a3828'; c.fillRect(en.x - 2.5, en.y - 50, 5, 50); c.fillRect(en.x - 16 + w, en.y - 42, 32, 4);
      c.fillStyle = en.flash > 0 ? '#fff' : '#a08a5a'; c.beginPath(); c.ellipse(en.x + w, en.y - 30, 10, 14, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#8a7448'; c.beginPath(); c.arc(en.x + w, en.y - 50, 7, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#5a4a2a'; c.beginPath(); c.moveTo(en.x - 8 + w, en.y - 30); c.lineTo(en.x + 8 + w, en.y - 30); c.stroke();
      return;
    }
    c.save(); c.globalAlpha = Math.max(0, en.alpha);
    const st = en.state;
    if (T.wolf) {
      SV.Sprites.drawWolf(c, en.x, en.y, { facing: en.facing, walk: en.walk, moving: en.moving || st === 'attack', flash: en.flash, alert: st !== 'idle' });
    } else {
      let attack = null;
      if (st === 'attack') attack = { from: en.atkDir - 1.3, to: en.atkDir + 1.3, p: en.t / 0.2 };
      const L = Object.assign({}, T.look, { facing: en.facing, walk: en.walk, moving: en.moving, t: en.t, flash: en.flash, scale: T.scale || 1, attack, block: st === 'block', charge: st === 'windup' });
      if (en.dead) { c.translate(en.x, en.y); c.rotate(Math.cos(en.facing) > 0 ? -1.3 : 1.3); SV.Sprites.drawHuman(c, 0, 0, Object.assign(L, { noShadow: true, attack: null, charge: false })); }
      else SV.Sprites.drawHuman(c, en.x, en.y, L);
    }
    c.restore();
    if (en.dead) return;
    const top = en.y - (T.wolf ? 34 : 54 * (T.scale || 1));
    // telegraph
    if (st === 'windup') {
      const k = en.t / (en.chain ? 0.24 : T.windup);
      c.save(); c.globalCompositeOperation = 'lighter';
      c.fillStyle = `rgba(220,40,30,${0.25 + k * 0.5})`; c.beginPath(); c.arc(en.x + Math.cos(en.facing) * 18, en.y - 26, 4 + k * 6, 0, Math.PI * 2); c.fill();
      c.restore();
      if (T.boss || k > 0.5) { c.fillStyle = '#e04030'; c.font = '800 16px "Shippori Mincho",serif'; c.textAlign = 'center'; c.fillText('!', en.x, top - 6); }
    }
    if (st === 'alert') { c.fillStyle = '#C9A227'; c.font = '800 18px "Shippori Mincho",serif'; c.textAlign = 'center'; c.fillText('!', en.x, top - 6 - Math.sin(en.t * 20) * 2); }
    if (st === 'stagger') { c.strokeStyle = 'rgba(255,230,150,.8)'; c.lineWidth = 1.5; for (let i = 0; i < 3; i++) { const a = en.t * 6 + i * 2.1; c.beginPath(); c.arc(en.x + Math.cos(a) * 10, top - 2 + Math.sin(a) * 3, 2, 0, Math.PI * 2); c.stroke(); } }
    // health bar (non-boss: when hurt; boss bar is on HUD)
    if (!en.boss && (en.hp < en.maxHp || en.aggro)) {
      const w = 36, k = Math.max(0, en.hp / en.maxHp);
      c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(en.x - w / 2 - 1, top - 1, w + 2, 5);
      c.fillStyle = '#b42a2a'; c.fillRect(en.x - w / 2, top, w * k, 3);
      const pk = en.poise / en.T.poise; if (pk < 0.99) { c.fillStyle = 'rgba(201,162,39,.8)'; c.fillRect(en.x - w / 2, top + 4, w * pk, 1.5); }
    }
  }

  const api = {
    list, TYPES, spawn, clear, spawnArea, update,
    nearest(x, y, r) { let b = null, bd = r; for (const en of list) { if (en.dead || en.type === 'dummy') continue; const d = U.dist(x, y, en.x, en.y); if (d < bd) { bd = d; b = en; } } return b; },
    anyAggro() { return list.some((en) => !en.dead && en.aggro && en.state !== 'idle' && en.type !== 'dummy'); },
    loseAggro() { list.forEach((en) => { if (!en.dead && en.state !== 'cine' && en.type !== 'dummy') { en.aggro = false; en.state = 'idle'; en.t = 0; } }); },
    boss() { return list.find((en) => en.boss && !en.dead && en.aggro); },
    alive(pred) { return list.filter((en) => !en.dead && en.type !== 'dummy' && (!pred || pred(en))); },
  };
  return api;
})();
