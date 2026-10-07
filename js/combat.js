/* =========================================================
   COMBAT — damage resolution between player and enemies:
   blocking, perfect-block counters, crits, poise/stagger,
   hit-stop, screen shake, resolve gain, damage numbers.
   ========================================================= */
SV.Combat = (function () {
  const U = SV.U;
  const facingToward = (fromAng, ax, ay, bx, by) => Math.abs(U.angDiff(fromAng, U.ang(ax, ay, bx, by)));

  /** Player → enemy */
  function hitEnemy(en, o) {
    if (en.dead || en.state === 'cine') return false;
    const P = SV.Player.e, st = SV.Stats.get();
    let dmg = o.dmg;
    let crit = o.crit || Math.random() < st.crit;
    // enemy guard (front arc, not vs heavy/strike)
    if (en.state === 'block' && facingToward(en.facing, en.x, en.y, P.x, P.y) < 1.3 && o.kind !== 'strike' && o.kind !== 'counter') {
      if (o.kind === 'heavy') { en.stagger(1.0); SV.World.text(en.x, en.y - 50, 'GUARD BREAK', '#C9A227'); SV.Audio.play('crit'); dmg *= 0.6; crit = false; }
      else {
        SV.Audio.play('block'); spark(en.x, en.y - 26, '#fff'); SV.World.text(en.x, en.y - 50, 'BLOCKED', '#BDBDBD');
        en.poise -= 6; P.resolve = Math.min(100, P.resolve + 2); en.guardHits = (en.guardHits || 0) + 1;
        if (en.guardHits >= 3) { en.guardHits = 0; en.stagger(0.8); }
        return false;
      }
    }
    if (crit) dmg *= 1.8;
    dmg = Math.round(dmg * (0.9 + Math.random() * 0.2));
    en.hp -= dmg; en.flash = 0.12; en.aggro = true; en.lastHit = SV.Game.time;
    en.poise -= o.poise || (o.kind === 'heavy' ? 40 : 14);
    const ka = U.ang(P.x, P.y, en.x, en.y); const kb = o.knock || (o.kind === 'heavy' ? 260 : 120);
    en.kx += Math.cos(ka) * kb * (en.heavyBody ? 0.4 : 1); en.ky += Math.sin(ka) * kb * (en.heavyBody ? 0.4 : 1);
    SV.World.text(en.x + U.rand(-8, 8), en.y - 52, crit ? dmg + '!' : '' + dmg, crit ? '#C9A227' : '#F5F5F5', crit);
    spark(en.x, en.y - 24, crit ? '#ffd27a' : '#ffffff');
    SV.World.spawn({ type: 'slash', x: en.x, y: en.y - 24, a: ka + Math.PI / 2 + U.rand(-0.4, 0.4), len: 22, col: crit ? 'rgba(255,210,120,.9)' : 'rgba(255,255,255,.9)', life: 0.18 });
    SV.Audio.play(crit ? 'crit' : 'hit'); SV.Audio.play('enemy_hurt');
    SV.Game.hitstop = o.kind === 'heavy' || crit ? 0.07 : 0.035;
    if (o.kind === 'heavy') SV.Camera.shake(7, 0.2);
    P.resolve = Math.min(100, P.resolve + (o.kind === 'strike' ? 0 : crit ? 9 : 6));
    if (en.poise <= 0 && !en.dead) en.stagger(o.kind === 'heavy' ? 1.0 : 0.6);
    if (en.type === 'dummy') { SV.Bus.emit('dummyHit', o.kind); en.hp = en.maxHp; }
    if (en.T.immortal) en.hp = en.maxHp;
    if (en.hp <= 0) en.die();
    return true;
  }

  /** Enemy → player. Returns 'hit' | 'block' | 'parry' | 'miss' */
  function hitPlayer(en, dmg, o = {}) {
    const P = SV.Player.e; if (!P || P.dead || SV.Game.god || SV.Cine.active) return 'miss';
    if (P.invuln > 0) return 'miss';
    const st = SV.Stats.get();
    const front = facingToward(P.facing, P.x, P.y, en.x, en.y) < 1.5;
    if (P.state === 'block' && front && !o.unblockable) {
      const since = SV.Game.time - P.blockStart;
      if (since < 0.22) { // PERFECT BLOCK
        SV.Audio.play('parry'); spark(P.x + Math.cos(P.facing) * 14, P.y - 26, '#ffe2a8', 18);
        SV.World.spawn({ type: 'ring', x: P.x, y: P.y - 20, r0: 10, r1: 50, col: 'rgba(255,220,140,.8)', life: 0.35 });
        SV.World.text(P.x, P.y - 60, SV.state.abilities.counter ? 'COUNTER' : 'PARRY', '#C9A227', true);
        P.resolve = Math.min(100, P.resolve + 20);
        en.stagger(1.1);
        SV.Game.slow(0.3, 0.35);
        if (SV.state.abilities.counter) SV.Player.counter(en);
        SV.Bus.emit('parry');
        return 'parry';
      }
      const cost = dmg * 1.1; P.st -= cost; P.stUse = 0;
      SV.Audio.play('block'); spark(P.x + Math.cos(P.facing) * 14, P.y - 26, '#fff', 8);
      P.kx -= Math.cos(U.ang(P.x, P.y, en.x, en.y)) * 90; P.ky -= Math.sin(U.ang(P.x, P.y, en.x, en.y)) * 90;
      P.resolve = Math.min(100, P.resolve + 4);
      SV.Bus.emit('blocked');
      if (P.st <= 0) { P.st = 0; SV.Player.guardBreak(); damage(P, dmg * 0.5, en, st); }
      else damage(P, dmg * 0.12, en, st, true);
      return 'block';
    }
    damage(P, dmg, en, st);
    return 'hit';
  }
  function damage(P, dmg, en, st, chip) {
    const red = st.def / (st.def + 25);
    const d = Math.max(1, Math.round(dmg * (1 - red)));
    P.hp -= d; P.lastHurt = SV.Game.time;
    SV.World.text(P.x, P.y - 56, '-' + d, '#e05050');
    if (!chip) {
      P.flash = 0.15; P.invuln = 0.45; SV.Audio.play('hurt'); SV.Camera.shake(en.boss ? 9 : 5, 0.22);
      const ka = U.ang(en.x, en.y, P.x, P.y); P.kx += Math.cos(ka) * 220; P.ky += Math.sin(ka) * 220;
      if (P.state !== 'dodge') { P.state = 'hurt'; P.t = 0; }
      SV.UI.flashDamage();
    }
    if (P.hp <= 0) { P.hp = 0; SV.Player.die(); }
    SV.UI.refreshHud();
  }
  function spark(x, y, col, n = 10) { SV.World.burst(x, y, n, { type: 'spark', col, smin: 60, smax: 240, life: 0.35, drag: 4, size: 1.6 }); }

  return { hitEnemy, hitPlayer, spark };
})();
