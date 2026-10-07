/* =========================================================
   PLAYER — Ren. Movement, light/heavy combo, block & counter,
   dodge roll, Shadow Dash, Shadow Strike, items, death.
   ========================================================= */
SV.Player = (function () {
  const U = SV.U, I = SV.Input;
  const SPEED = 175;
  let e = null;
  let stepT = 0, afterT = 0;

  function create(x, y) {
    const st = SV.Stats.get();
    e = {
      x, y, r: 11, facing: Math.PI / 2, walk: 0, moving: false, state: 'idle', t: 0,
      hp: Math.min(SV.state.hp || st.maxHp, st.maxHp), st: st.maxSt, resolve: SV.state.resolve || 0,
      invuln: 0, flash: 0, kx: 0, ky: 0, stUse: 1, combo: 0, comboT: 0, atk: null, hits: null, queued: false,
      chargeT: 0, blockStart: -9, dashCd: 0, itemCd: 0, hidden: 0, stamBoost: 0, lastHurt: -99, holdT: 0, dead: false,
      draw: drawSelf,
    };
    api.e = e; return e;
  }

  function aimAngle() {
    if (I.aimWithMouse()) return U.ang(e.x, e.y - 20, I.mouse.wx, I.mouse.wy);
    // touch: auto-aim at nearest enemy in front, else facing
    const t = SV.Enemies.nearest(e.x, e.y, 140);
    return t ? U.ang(e.x, e.y, t.x, t.y) : e.facing;
  }

  function update(dt) {
    if (!e) return;
    const st = SV.Stats.get();
    e.t += dt; e.invuln -= dt; e.flash -= dt; e.dashCd -= dt; e.itemCd -= dt; e.hidden -= dt; e.stamBoost -= dt; e.stUse += dt; e.comboT -= dt;
    if (e.hp > st.maxHp) e.hp = st.maxHp;
    // knockback velocity
    e.x += e.kx * dt; e.y += e.ky * dt; e.kx *= Math.pow(0.0015, dt); e.ky *= Math.pow(0.0015, dt);
    if (e.dead) { SV.World.collide(e); return; }

    const locked = SV.Game.inputLocked();
    const mv = locked ? { x: 0, y: 0, mag: 0 } : I.moveVec();
    const want = (a) => !locked && I.pressed[a];
    const held = (a) => !locked && I.down[a];
    if (held('attack')) e.holdT += dt; else e.holdT = 0;

    let speed = 0;
    switch (e.state) {
      case 'idle': case 'move': {
        speed = SPEED;
        if (mv.mag > 0.1) { e.facing = Math.atan2(mv.y, mv.x); e.state = 'move'; } else e.state = 'idle';
        if (want('attack')) startAttack(false);
        else if (want('dodge')) dodge(mv, st);
        else if (held('block') && e.st > 2) { e.state = 'block'; e.blockStart = SV.Game.time; e.t = 0; }
        else if (want('ability')) ability(mv, st);
        break;
      }
      case 'attack': case 'heavy': {
        const a = e.atk; a.t += dt * (e.state === 'heavy' ? 1 : st.speed); a.p = a.t / a.dur;
        speed = a.p < 0.35 ? (e.state === 'heavy' ? 220 : 120) * (1 - a.p / 0.35) : 0;
        if (want('attack') && a.p > 0.3) e.queued = true;
        if (want('dodge')) { e.atk = null; dodge(mv, st); break; }
        if (a.p >= a.hit[0] && a.p <= a.hit[1]) doHits(a, st);
        if (a.p >= 1) {
          const wasHeavy = e.state === 'heavy';
          e.atk = null; setState('idle');
          if (e.queued && !wasHeavy) { e.queued = false; startAttack(false); }
          else if (held('attack') && SV.state.abilities.heavy && !wasHeavy && e.holdT > 0.28) { setState('charge'); e.chargeT = 0; e.queued = false; }
          else e.queued = false;
        }
        break;
      }
      case 'charge': {
        e.chargeT += dt; speed = 55; if (mv.mag > 0.1) e.facing = Math.atan2(mv.y, mv.x);
        if (I.aimWithMouse()) e.facing = aimAngle();
        if (e.chargeT > 0.25 && Math.random() < 0.5) SV.World.spawn({ type: 'spark', x: e.x + U.rand(-14, 14), y: e.y - U.rand(10, 36), vy: -40, life: 0.4, col: '#ffcf80', size: 1.4 });
        if (!held('attack')) { if (e.chargeT >= 0.22) startAttack(true); else e.state = 'idle'; }
        if (want('dodge')) dodge(mv, st);
        break;
      }
      case 'block': {
        speed = 60; e.stUse = 0;
        if (I.aimWithMouse()) e.facing = aimAngle(); else if (mv.mag > 0.1) e.facing = Math.atan2(mv.y, mv.x);
        if (!held('block')) e.state = 'idle';
        if (want('dodge')) dodge(mv, st);
        break;
      }
      case 'dodge': {
        const k = 1 - e.t / 0.38; speed = 0; e.x += Math.cos(e.dodgeDir) * 470 * Math.max(0, k) * dt; e.y += Math.sin(e.dodgeDir) * 470 * Math.max(0, k) * dt;
        if (e.t > 0.38) e.state = 'idle';
        afterT -= dt; if (afterT <= 0) { afterT = 0.05; after(); }
        break;
      }
      case 'dash': {
        speed = 0; e.x += Math.cos(e.dodgeDir) * 980 * dt; e.y += Math.sin(e.dodgeDir) * 980 * dt;
        afterT -= dt; if (afterT <= 0) { afterT = 0.025; after(); }
        if (e.t > 0.19) { e.state = 'idle'; e.kx = Math.cos(e.dodgeDir) * 120; e.ky = Math.sin(e.dodgeDir) * 120; }
        break;
      }
      case 'hurt': speed = 0; if (e.t > 0.28) e.state = 'idle'; break;
      case 'broken': speed = 0; if (e.t > 0.9) e.state = 'idle'; break;
      case 'strike': speed = 0; break;
    }
    e.t += 0; // (state timers use e.t reset on state change)
    if (speed > 0 && (e.state === 'move' || e.state === 'block' || e.state === 'charge')) {
      e.x += mv.x * speed * dt; e.y += mv.y * speed * dt;
    } else if (speed > 0 && e.atk) { e.x += Math.cos(e.atk.ang) * speed * dt; e.y += Math.sin(e.atk.ang) * speed * dt; }
    e.moving = mv.mag > 0.1 && (e.state === 'move' || e.state === 'block' || e.state === 'charge');
    if (e.moving) {
      e.walk += dt * 11 * mv.mag;
      stepT -= dt; if (stepT <= 0) { stepT = 0.32; SV.Audio.play('step'); if (SV.World.env().weather === 'rain' && !SV.World.area.indoor) SV.World.spawn({ type: 'ring', x: e.x, y: e.y, r0: 1, r1: 8, col: 'rgba(200,215,230,.5)', life: 0.4 }); }
    }
    SV.World.collide(e);
    // stamina & resolve
    if (e.stUse > 0.7 && e.state !== 'block') e.st = Math.min(st.maxSt, e.st + (30 + (e.stamBoost > 0 ? 40 : 0)) * dt);
    if (SV.Enemies.anyAggro()) e.lastCombat = SV.Game.time; else if (SV.Game.time - (e.lastCombat || 0) > 8) e.resolve = Math.max(0, e.resolve - 2 * dt);
    // items
    if (want('item1')) useSlot(1); if (want('item2')) useSlot(2); if (want('item3')) useSlot(3);
  }

  function setState(s) { e.state = s; e.t = 0; }
  function startAttack(heavy) {
    const st = SV.Stats.get();
    const ang = aimAngle(); e.facing = ang;
    if (heavy) {
      if (e.st < 10) { SV.UI.toast('Too exhausted for a heavy strike', 'red'); setState('idle'); return; }
      e.st -= 22; e.stUse = 0; if (e.st < 0) e.st = 0;
      setState('heavy');
      e.atk = { t: 0, p: 0, dur: 0.52, hit: [0.32, 0.62], ang, from: ang + 1.7, to: ang - 1.7, heavy: true, range: 78, arc: 3.3, dmg: st.dmg * st.heavyMul * Math.min(1.25, 0.85 + e.chargeT), kind: 'heavy' };
      SV.Audio.play('heavy'); SV.Camera.shake(3, 0.12);
      SV.Bus.emit('playerHeavy');
    } else {
      if (e.comboT <= 0) e.combo = 0;
      const max = SV.state.abilities.quick ? 3 : 2;
      e.combo = (e.combo % max) + 1; e.comboT = 0.75;
      const third = e.combo === 3;
      const dir = e.combo % 2 ? 1 : -1;
      setState('attack');
      e.atk = { t: 0, p: 0, dur: third ? 0.26 : 0.34, hit: [0.3, 0.68], ang, from: ang - dir * 1.25, to: ang + dir * 1.25, range: third ? 66 : 58, arc: 2.3, dmg: st.dmg * (third ? 2 : e.combo === 2 ? 1.1 : 1), kind: third ? 'quick' : 'light' };
      SV.Audio.play('swing');
    }
    e.hits = new Set();
  }
  function doHits(a, st) {
    for (const en of SV.Enemies.list) {
      if (en.dead || e.hits.has(en)) continue;
      const d = U.dist(e.x, e.y, en.x, en.y);
      if (d > a.range + en.r) continue;
      if (d > 18 && Math.abs(U.angDiff(a.ang, U.ang(e.x, e.y, en.x, en.y))) > a.arc / 2) continue;
      e.hits.add(en);
      SV.Combat.hitEnemy(en, { dmg: a.dmg, kind: a.kind });
    }
  }
  function dodge(mv, st) {
    const cost = st.dodgeCost;
    if (e.st < cost * 0.5) { SV.UI.toast('Out of stamina', 'red'); return; }
    e.st = Math.max(0, e.st - cost); e.stUse = 0;
    e.dodgeDir = mv.mag > 0.1 ? Math.atan2(mv.y, mv.x) : e.facing + Math.PI;
    setState('dodge'); e.invuln = 0.3; e.atk = null;
    SV.Audio.play('dodge'); SV.Bus.emit('dodge');
  }
  function ability(mv, st) {
    const A = SV.state.abilities;
    if (A.shadowStrike && e.resolve >= 99.5) {
      const targets = SV.Enemies.list.filter((en) => !en.dead && en.type !== 'dummy' && U.dist(e.x, e.y, en.x, en.y) < 360).sort((a, b) => U.dist(e.x, e.y, a.x, a.y) - U.dist(e.x, e.y, b.x, b.y)).slice(0, 4);
      if (targets.length) return shadowStrike(targets);
      if (!A.shadowDash) { SV.UI.toast('No enemies within reach of Shadow Strike'); return; }
    }
    if (A.shadowDash) {
      if (e.dashCd > 0) return;
      if (e.st < 26) { SV.UI.toast('Out of stamina', 'red'); return; }
      e.st -= 26; e.stUse = 0; e.dashCd = 0.55;
      e.dodgeDir = mv.mag > 0.1 ? Math.atan2(mv.y, mv.x) : e.facing;
      setState('dash'); e.invuln = 0.3; SV.Audio.play('dash');
      SV.World.spawn({ type: 'ring', x: e.x, y: e.y - 18, r0: 4, r1: 30, col: 'rgba(30,30,40,.9)', life: 0.3 });
      return;
    }
    if (A.shadowStrike) SV.UI.toast('Resolve not full — fill it by fighting'); else SV.UI.toast('No ability learned yet');
  }
  function shadowStrike(targets) {
    setState('strike'); e.invuln = 2; e.resolve = 0;
    SV.Game.slow(0.25, 0.9); SV.UI.flash(0.5); SV.Audio.play('whoosh'); SV.Audio.play('drum');
    SV.World.text(e.x, e.y - 70, '影斬', '#C9A227', true);
    const st = SV.Stats.get();
    targets.forEach((en, i) => SV.Game.after(0.1 + i * 0.14, () => {
      if (en.dead) return;
      after();
      const a = U.ang(e.x, e.y, en.x, en.y);
      e.x = en.x + Math.cos(a) * 26; e.y = en.y + Math.sin(a) * 26; e.facing = a + Math.PI;
      e.atk = { t: 0, p: 0.5, dur: 0.2, hit: [2, 2], ang: e.facing, from: e.facing - 1.6, to: e.facing + 1.6, heavy: true };
      SV.Audio.play('heavy');
      SV.Combat.hitEnemy(en, { dmg: st.dmg * 4, kind: 'strike', crit: true, knock: 160 });
      SV.Camera.shake(8, 0.15);
    }));
    SV.Game.after(0.25 + targets.length * 0.14, () => { e.atk = null; setState('idle'); e.invuln = 0.4; SV.World.collide(e); });
  }
  function counter(en) {
    const st = SV.Stats.get();
    SV.Game.after(0.08, () => {
      if (e.dead) return;
      const a = U.ang(e.x, e.y, en.x, en.y); e.facing = a;
      setState('attack'); e.atk = { t: 0.08, p: 0.3, dur: 0.3, hit: [2, 2], ang: a, from: a - 1.5, to: a + 1.5, heavy: true }; e.hits = new Set();
      SV.Audio.play('heavy');
      SV.Combat.hitEnemy(en, { dmg: st.dmg * 2.5, kind: 'counter', crit: true, knock: 200 });
    });
  }
  function guardBreak() { setState('broken'); SV.World.text(e.x, e.y - 60, 'GUARD BROKEN', '#e05050'); SV.Audio.play('crit'); }
  function after() { SV.World.spawn({ type: 'after', x: e.x, y: e.y, look: look(), life: 0.3 }); }

  function useSlot(n) { const id = SV.Inv.slotItem(n); if (!SV.Inv.has(id)) { SV.UI.toast(`No ${SV.ITEMS[id].name}`, 'red'); SV.Audio.play('error'); return; } useItem(id); }
  function useItem(id) {
    const it = SV.ITEMS[id]; const st = SV.Stats.get();
    if (e.itemCd > 0 || e.dead) return false;
    if (it.heal) {
      if (e.hp >= st.maxHp) { SV.UI.toast('Already at full health'); return false; }
      SV.Inv.remove(id, 1); e.hp = Math.min(st.maxHp, e.hp + it.heal); e.itemCd = 0.6;
      SV.World.text(e.x, e.y - 60, '+' + it.heal, '#7fdc7f'); SV.World.burst(e.x, e.y - 20, 14, { type: 'spark', col: '#9fe08a', smin: 20, smax: 70, life: 0.7, up: 40 });
      SV.Audio.play('pickup');
    } else if (it.stam) {
      SV.Inv.remove(id, 1); e.st = st.maxSt; e.stamBoost = 10; e.itemCd = 0.6; SV.Audio.play('pickup');
      SV.World.burst(e.x, e.y - 20, 12, { type: 'spark', col: '#C9A227', smin: 20, smax: 70, life: 0.7, up: 40 });
    } else if (id === 'smoke_bomb') {
      if (!SV.state.abilities.smoke) { SV.UI.toast('You have not learned the art of Smoke Escape.', 'red'); return false; }
      SV.Inv.remove(id, 1); e.itemCd = 1;
      for (let i = 0; i < 40; i++) SV.World.spawn({ type: 'smoke', x: e.x + U.rand(-30, 30), y: e.y - U.rand(0, 40), vx: U.rand(-40, 40), vy: U.rand(-40, 10), life: U.rand(1, 2.2), size: U.rand(8, 16), col: 'rgba(120,120,120,' });
      e.x -= Math.cos(e.facing) * 110; e.y -= Math.sin(e.facing) * 110; SV.World.collide(e);
      e.hidden = 4; e.invuln = 0.6; SV.Enemies.loseAggro(); SV.Audio.play('dash');
    } else return false;
    SV.UI.refreshHud(); SV.Save.autosave('item');
    return true;
  }
  function die() {
    if (e.dead) return; e.dead = true; setState('dead'); SV.state.dead = true;
    SV.Game.slow(0.3, 1.2); SV.Audio.play('sting');
    SV.Game.after(1.4, () => SV.UI.death());
  }

  function look() {
    const w = SV.state.equipped.weapon;
    return {
      facing: e.facing, walk: e.walk, moving: e.moving, t: e.t, flash: e.flash,
      top: '#24242a', robe: '#18181c', legs: '#0f0f12', sash: '#8B1E1E', headband: '#8B1E1E', hair: '#0c0c0c', collar: '#cfc6b2',
      weapon: 'katana', bladeCol: w === 'kurohana_blade' ? '#f2ecdc' : '#c5cad0', handle: w === 'kurohana_blade' ? '#2a1a12' : '#8B1E1E',
      attack: e.atk ? { from: e.atk.from, to: e.atk.to, p: e.atk.p, heavy: e.atk.heavy } : null,
      block: e.state === 'block', charge: e.state === 'charge', kneel: e.kneel,
    };
  }
  function drawSelf(c) {
    if (e.alpha === 0) return;
    const L = look();
    if (e.state === 'dead') { c.save(); c.translate(e.x, e.y); c.rotate(Math.cos(e.facing) > 0 ? 1.4 : -1.4); SV.Sprites.drawHuman(c, 0, 0, Object.assign(L, { noShadow: true })); c.restore(); return; }
    if (e.hidden > 0) L.alpha = 0.35;
    if (e.invuln > 0 && e.state === 'hurt' && Math.floor(e.t * 20) % 2) L.alpha = 0.5;
    if (e.state === 'dodge') { c.save(); c.translate(e.x, e.y); c.scale(1, 0.82); SV.Sprites.drawHuman(c, 0, 0, L); c.restore(); }
    else SV.Sprites.drawHuman(c, e.x, e.y, L);
    if (e.state === 'charge' && e.chargeT > 0.22) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(255,200,120,${0.3 + Math.sin(e.t * 20) * 0.2})`; c.lineWidth = 2; c.beginPath(); c.arc(e.x, e.y - 20, 26, 0, Math.PI * 2); c.stroke(); c.restore(); }
  }

  const api = { e: null, create, update, useItem, counter, guardBreak, die, look, get state() { return e && e.state; } };
  return api;
})();
