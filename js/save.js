/* =========================================================
   SAVE — localStorage persistence behind a small adapter.
   Swap SV.Store for a REST/DB adapter later with the same
   get/set/remove interface (make them async if needed).
   ========================================================= */
SV.Store = {
  prefix: 'sotv_',
  get(key) { try { const v = localStorage.getItem(this.prefix + key); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(key, val) { try { localStorage.setItem(this.prefix + key, JSON.stringify(val)); return true; } catch (e) { return false; } },
  remove(key) { try { localStorage.removeItem(this.prefix + key); } catch (e) {} },
};

SV.Settings = {
  defaults: { master: 0.8, sfx: 0.8, amb: 0.6, music: 0.5, shake: true, textSpeed: 'normal', particles: 'high', hints: true, timeFlow: 'cycle', weather: 'dynamic', touch: 'auto' },
  cur: null,
  get() { if (!this.cur) this.cur = Object.assign({}, this.defaults, SV.Store.get('settings') || {}); return this.cur; },
  set(k, v) { this.get()[k] = v; SV.Store.set('settings', this.cur); SV.Audio.applyVolumes(); SV.Bus.emit('settings', this.cur); },
};

SV.Save = {
  SLOTS: ['auto', '1', '2', '3'],
  lastAuto: 0,
  /** Serialize the live state (player position is pulled from the entity). */
  snapshot() {
    const s = SV.state; const p = SV.Player && SV.Player.e;
    if (p) { s.x = Math.round(p.x); s.y = Math.round(p.y); s.hp = Math.round(p.hp); }
    if (SV.Puzzles) SV.Puzzles.serialize();
    s.savedAt = Date.now();
    return JSON.parse(JSON.stringify(s));
  },
  save(slot = 'auto') {
    const ok = SV.Store.set('slot_' + slot, this.snapshot());
    SV.Store.set('last', slot);
    return ok;
  },
  load(slot) {
    const data = SV.Store.get('slot_' + slot);
    if (!data) return null;
    // merge onto a fresh state so newer fields always exist (forward compatible)
    const base = SV.newState();
    const merged = Object.assign(base, data);
    ['upgrades', 'abilities', 'equipped'].forEach((k) => (merged[k] = Object.assign(base[k] || {}, SV.newState()[k], data[k] || {})));
    return merged;
  },
  info(slot) {
    const d = SV.Store.get('slot_' + slot); if (!d) return null;
    const m = SV.MISSIONS && SV.MISSIONS[d.mission];
    return { mission: m ? `Mission ${m.num} · ${m.title}` : 'Journey complete', area: (SV.AREAS[d.area] || {}).name || d.area, ryo: d.ryo, time: d.savedAt, playtime: d.playtime || 0 };
  },
  latest() {
    let best = null;
    this.SLOTS.forEach((s) => { const d = SV.Store.get('slot_' + s); if (d && (!best || d.savedAt > best.t)) best = { slot: s, t: d.savedAt }; });
    return best && best.slot;
  },
  remove(slot) { SV.Store.remove('slot_' + slot); },
  /** Called by gameplay systems; throttled and shows the corner indicator. */
  autosave(reason) {
    if (!SV.Game || SV.Game.mode !== 'play' || SV.state.dead) return;
    const t = performance.now();
    if (t - this.lastAuto < 1200) { clearTimeout(this._pend); this._pend = setTimeout(() => this.autosave(reason), 1300); return; }
    this.lastAuto = t;
    this.save('auto');
    const el = document.getElementById('autosave');
    el.classList.add('show'); clearTimeout(this._t); this._t = setTimeout(() => el.classList.remove('show'), 1600);
  },
};
