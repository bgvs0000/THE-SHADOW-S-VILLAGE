/* =========================================================
   CORE — global namespace, math utils, seeded RNG, event bus,
   asset registry (drop real sprites/images in later).
   ========================================================= */
window.SV = window.SV || {};

SV.U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
  rand: (a = 0, b = 1) => a + Math.random() * (b - a),
  randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  choice: (arr) => arr[Math.floor(Math.random() * arr.length)],
  ang: (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax),
  angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; },
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  /** Deterministic RNG so decoration (grass, bamboo) is stable between visits */
  rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; },
  el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; },
  $(sel) { return document.querySelector(sel); },
  esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },
};

/* Tiny pub/sub so systems stay decoupled (missions listen to kills, pickups, etc.) */
SV.Bus = {
  map: {},
  on(evt, fn) { (this.map[evt] = this.map[evt] || []).push(fn); },
  emit(evt, data) { (this.map[evt] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(evt, e); } }); },
};

/* Asset registry: register real images later, e.g.
   SV.Assets.register('player', 'assets/sprites/ren.png');
   Drawing code checks SV.Assets.img(key) first and falls back to procedural art. */
SV.Assets = {
  imgs: {},
  register(key, src) { const im = new Image(); im.src = src; im.onerror = () => delete this.imgs[key]; this.imgs[key] = im; },
  img(key) { const im = this.imgs[key]; return im && im.complete && im.naturalWidth ? im : null; },
};

/* Global mutable game state — the single object persisted by the save system. */
SV.newState = function () {
  return {
    version: 1,
    area: 'village', x: 1300, y: 260,
    hp: 100, st: 100, resolve: 0,
    ryo: 50,
    inventory: [
      { id: 'wanderer_katana', qty: 1 }, { id: 'traveler_garb', qty: 1 },
      { id: 'health_potion', qty: 2 }, { id: 'rice_ball', qty: 1 },
    ],
    equipped: { weapon: 'wanderer_katana', armor: 'traveler_garb' },
    upgrades: { swordDmg: 0, swordCrit: 0, swordSpeed: 0, swordHeavy: 0, armorDef: 0, armorHp: 0, armorStam: 0, armorDodge: 0 },
    abilities: { heavy: false, quick: false, counter: false, shadowStrike: false, smoke: false, shadowDash: false, healing: false },
    mission: 0,              // index into SV.MISSIONS
    obj: {},                 // "m1.house": true | number (progress)
    side: {},                // side quest state: {id: 'active'|'done', progress}
    flags: {},               // story flags
    collected: {},           // world pickups / collectibles by id
    killed: {},              // unique enemies defeated
    puzzles: {},             // puzzle state
    npc: {},                 // npc talk counters
    discovered: { village: true },
    decisions: {},
    ending: null,
    kills: 0,
    time: 0.58,              // 0..1 day cycle (0.58 = sunset)
    weather: 'clear',
    playtime: 0,
    savedAt: 0,
  };
};
SV.state = SV.newState();
