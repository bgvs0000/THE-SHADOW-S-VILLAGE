/* =========================================================
   AREAS — world layout data. Each area: size, ground, paths,
   props, exits (edge transitions), doors, interactables,
   pickups (persistent collectibles), enemy spawns.
   Story gating uses SV.Missions helpers lazily (functions).
   ========================================================= */
(function () {
  const U = SV.U;
  const M = () => SV.Missions;
  const F = (k) => !!SV.state.flags[k];
  const S = () => SV.Story;

  /* ---------- builder helpers ---------- */
  const house = (x, y, w, h, o = {}) => Object.assign({ t: 'house', x, y, w, h }, o);
  const tree = (x, y, r, kind = 'oak', o = {}) => Object.assign({ t: 'tree', x, y, r, kind }, o);
  const bam = (x, y, n = 5, h = 150, o = {}) => Object.assign({ t: 'bamboo', x, y, n, h }, o);
  const lan = (x, y, o = {}) => Object.assign({ t: 'lantern', x, y }, o);
  const rock = (x, y, r, o = {}) => Object.assign({ t: 'rock', x, y, r }, o);

  /** Fill free space with props, avoiding paths, plazas, water, rects and keep-clear circles */
  function scatter(a, n, seed, make, opts = {}) {
    const r = U.rng(seed); const out = []; const pad = opts.pad || 40;
    const b = opts.bounds || { x: 0, y: 0, w: a.w, h: a.h };
    let tries = 0;
    while (out.length < n && tries < n * 12) {
      tries++;
      const x = b.x + r() * b.w, y = b.y + r() * b.h;
      if (!free(a, x, y, pad, out, opts.spacing || 34)) continue;
      out.push(make(x, y, r));
    }
    a.props.push(...out);
  }
  function free(a, x, y, pad, extra, spacing) {
    for (const p of a.paths || []) for (let i = 1; i < p.pts.length; i++) if (SV.World.segDist(x, y, p.pts[i - 1], p.pts[i]) < p.w / 2 + pad) return false;
    for (const pl of a.plazas || []) if (U.dist(x, y, pl.x, pl.y) < pl.r + pad) return false;
    for (const w of a.water || []) if (x > w.x - pad && x < w.x + w.w + pad && y > w.y - pad && y < w.y + w.h + pad * 1.6) return false;
    for (const k of a.keep || []) if (k.r ? U.dist(x, y, k.x, k.y) < k.r : (x > k.x - pad && x < k.x + k.w + pad && y > k.y - pad && y < k.y + k.h + pad * 2.5)) return false;
    for (const p of a.props) if ((p.t === 'house' || p.t === 'shrineHall') && x > p.x - pad - 20 && x < p.x + p.w + pad + 20 && y > p.y - 60 && y < p.y + p.h + pad + 30) return false;
    for (const p of extra) if (Math.abs(p.x - x) < spacing && Math.abs(p.y - y) < spacing) return false;
    return true;
  }
  function borderTrees(a, seed, kinds, gaps, depth = 90, step = 70) {
    const r = U.rng(seed);
    const inGap = (x, y) => gaps.some((g) => x > g.x && x < g.x + g.w && y > g.y && y < g.y + g.h);
    for (let x = 20; x < a.w; x += step) {
      [[x + r() * 30, 30 + r() * depth * 0.6], [x + r() * 30, a.h - 10 - r() * depth * 0.4]].forEach(([tx, ty]) => { if (!inGap(tx, ty)) a.props.push(tree(tx, ty, 34 + r() * 22, U.choice(kinds))); });
    }
    for (let y = 60; y < a.h; y += step) {
      [[20 + r() * depth * 0.5, y + r() * 30], [a.w - 20 - r() * depth * 0.5, y + r() * 30]].forEach(([tx, ty]) => { if (!inGap(tx, ty)) a.props.push(tree(tx, ty, 34 + r() * 22, U.choice(kinds))); });
    }
  }
  function borderBamboo(a, seed, gaps) {
    const r = U.rng(seed);
    const inGap = (x, y) => gaps.some((g) => x > g.x && x < g.x + g.w && y > g.y && y < g.y + g.h);
    for (let x = 10; x < a.w; x += 34) { if (!inGap(x, 20)) a.props.push(bam(x, 24 + r() * 20, 5, 150 + r() * 60)); if (!inGap(x, a.h - 12)) a.props.push(bam(x, a.h - 8 - r() * 14, 5, 150 + r() * 60)); }
    for (let y = 40; y < a.h; y += 34) { if (!inGap(14, y)) a.props.push(bam(16 + r() * 16, y, 5, 160)); if (!inGap(a.w - 14, y)) a.props.push(bam(a.w - 16 - r() * 16, y, 5, 160)); }
  }
  const ex = (x, y, w, h, to, sx, sy, label, locked) => ({ x, y, w, h, to, sx, sy, label, locked });

  SV.AREAS = {};

  /* =====================================================
     KUROHANA VILLAGE — the hub
     ===================================================== */
  SV.AREAS.village = {
    name: 'Kurohana Village', jp: '黒花村', region: 'village', sub: 'Home, once',
    build() {
      const burned = F('villageBurned');
      const a = {
        w: 2600, h: 2000, wind: 0.35, ambience: 'village', fireflies: true,
        ground: { base: '#3f4a32', vars: ['rgba(0,0,0,.05)', 'rgba(120,110,60,.045)', 'rgba(255,255,255,.02)'], outside: '#1a2016' },
        paths: [
          { pts: [[1300, 0], [1300, 2000]], w: 92 },
          { pts: [[0, 1000], [2600, 1000]], w: 80 },
          { pts: [[1300, 820], [600, 820], [600, 770]], w: 56 },
          { pts: [[1300, 720], [1850, 720], [1850, 700]], w: 56 },
          { pts: [[1000, 1000], [970, 1230]], w: 50 },
          { pts: [[1300, 1000], [1940, 1100], [1940, 1240]], w: 50 },
          { pts: [[1000, 1000], [770, 1300], [770, 1450]], w: 50 },
          { pts: [[1300, 1700], [1525, 1760]], w: 50 },
          { pts: [[600, 1000], [520, 1240]], w: 40 },
          { pts: [[1300, 1300], [1550, 1390]], w: 40 },
          { pts: [[1300, 450], [1010, 500]], w: 40 },
        ],
        plazas: [{ x: 1300, y: 1000, r: 170 }],
        water: [
          { x: 2150, y: 0, w: 80, h: 958, flow: true }, { x: 2150, y: 1042, w: 80, h: 958, flow: true },
          { x: 1900, y: 380, w: 170, h: 100, koi: true },
        ],
        fields: [{ x: 160, y: 1460, w: 220, h: 160 }, { x: 400, y: 1460, w: 220, h: 160 }, { x: 160, y: 1650, w: 220, h: 160 }, { x: 400, y: 1650, w: 220, h: 160 }],
        keep: [{ x: 620, y: 1300, w: 300, h: 200 }, { x: 1300, y: 1000, r: 260 }, { x: 150, y: 1450, w: 480, h: 380 }],
        props: [], fires: [],
        exits: [
          ex(1220, 0, 160, 26, 'bamboo_edge', 1200, 1820, 'Bamboo Forest', () => (M().reached('m1', 'shrine') ? null : 'The northern path. You have no reason to leave yet. (Continue Mission 01)')),
          ex(1220, 1974, 160, 26, 'shrine', 300, 90, 'Abandoned Shrine', () => (M().reached('m4', 'travel') ? null : 'The southern road to the old shrine is roped off by the elder. (Requires Mission 04)')),
          ex(2574, 940, 26, 120, null, 0, 0, 'Mountain Path', () => 'Mountain Path — a rockslide blocks the road. (Requires Mission 06)'),
          ex(0, 940, 26, 120, null, 0, 0, 'Bandit Camp', () => 'Bandit Camp road — the river ford is flooded. (Requires Mission 05)'),
        ],
        doors: [{ x: 600, y: 772, to: 'ren_house', sx: 400, sy: 500, label: "Enter Father's House" }],
      };
      const P = a.props;
      // ---- key buildings ----
      P.push(house(480, 620, 240, 150, { burnt: true, dark: true, roof: '#24272b', name: "Father's House" }));
      P.push(house(1700, 530, 300, 170, { roof: '#2a2420', hangSign: ['長', '老'] }));
      P.push(house(1820, 1090, 240, 150, { roof: '#2a2c30', noren: '#2a2a2a', sign: '鍛冶', hangSign: ['鍛', '冶'] }));
      P.push(house(850, 1090, 240, 140, { roof: '#3a2a20', noren: '#8B1E1E', sign: '店', hangSign: ['万', '屋'] }));
      // ---- village homes ----
      P.push(house(380, 1110, 210, 130, { thatch: true, roof: '#6b5a3c', ridge: '#4a3c26' }));
      P.push(house(1450, 1260, 200, 130, { roof: '#2c3036' }));
      P.push(house(1470, 300, 210, 130, { thatch: true, roof: '#5e5034', ridge: '#40351f' }));
      P.push(house(900, 360, 220, 140, { roof: '#2c3036' }));
      P.push(house(1580, 1540, 200, 130, { thatch: true, roof: '#6b5a3c', ridge: '#4a3c26' }));
      P.push(house(2300, 1180, 200, 130, { roof: '#2c3036' }));
      P.push(house(2320, 560, 190, 130, { thatch: true, roof: '#5e5034' }));
      // ---- village shrine ----
      P.push({ t: 'hokora', x: 1525, y: 1700 }, { t: 'torii', x: 1525, y: 1790, w: 90, h: 100 });
      P.push(lan(1470, 1730), lan(1580, 1730));
      // ---- plaza ----
      P.push({ t: 'well', x: 1400, y: 925 }, { t: 'board', x: 1180, y: 905 });
      P.push(tree(1450, 1080, 52, 'sakura'), tree(1150, 1110, 44, 'sakura'));
      [[1150, 860], [1450, 860], [1150, 1150], [1450, 1150]].forEach(([x, y]) => P.push(lan(x, y)));
      // ---- lantern rows ----
      [[1240, 300], [1360, 300], [1240, 600], [1360, 600], [1240, 1400], [1360, 1400], [1700, 955], [2050, 955], [450, 955], [850, 955]].forEach(([x, y]) => P.push(lan(x, y)));
      P.push({ t: 'chochin', x: 1095, y: 1240 }, { t: 'chochin', x: 2070, y: 1250 }, { t: 'chochin', x: 1690, y: 715 });
      // ---- blacksmith yard ----
      P.push({ t: 'forge', x: 1760, y: 1220 }, { t: 'barrel', x: 2090, y: 1150 }, { t: 'crate', x: 2095, y: 1200 }, { t: 'barrel', x: 1720, y: 1290 });
      // ---- store yard ----
      P.push({ t: 'crate', x: 830, y: 1250 }, { t: 'crate', x: 860, y: 1268 }, { t: 'barrel', x: 1110, y: 1150 });
      // ---- training ground ----
      P.push({ t: 'fence', x: 620, y: 1300, w: 120 }, { t: 'fence', x: 800, y: 1300, w: 120 }, { t: 'fence', x: 620, y: 1300, v: true, h: 200 }, { t: 'fence', x: 920, y: 1300, v: true, h: 200 }, { t: 'fence', x: 620, y: 1500, w: 110 }, { t: 'fence', x: 810, y: 1500, w: 110 });
      // ---- elder garden ----
      P.push(rock(1880, 500, 14, { moss: true }), rock(2085, 470, 18, { moss: true }), tree(2060, 360, 40, 'maple'), lan(1885, 395));
      // ---- gate & bridge ----
      P.push({ t: 'torii', x: 1300, y: 130, w: 150, h: 120, col: '#3a2a1e' });
      P.push({ t: 'decal', kind: 'bridge', x: 2140, y: 962, w: 100, h: 76 });
      P.push({ t: 'fence', x: 2140, y: 962, w: 100 }, { t: 'fence', x: 2140, y: 1042, w: 100 });
      // ---- farmland ----
      P.push({ t: 'fence', x: 140, y: 1440, w: 500 }, tree(700, 1720, 40, 'oak'), { t: 'crate', x: 660, y: 1460 });
      // ---- scorch near father's house ----
      P.push({ t: 'decal', kind: 'scorch', x: 560, y: 790, r: 60 }, { t: 'decal', kind: 'scorch', x: 700, y: 760, r: 40 });
      // ---- M1 footprints ----
      const tracks = [[720, 690, -0.7], [1040, 470, -0.55], [1270, 190, -1.4]];
      tracks.forEach(([x, y, aa], i) => P.push({ t: 'footprint', x, y, a: aa, when: () => M().at('m1', 'tracks') && !F('track' + i) }));
      // ---- nature ----
      borderTrees(a, 11, ['pine', 'oak', 'pine', 'maple'], [{ x: 1180, y: 0, w: 240, h: 200 }, { x: 1180, y: 1880, w: 240, h: 120 }, { x: 0, y: 880, w: 120, h: 240 }, { x: 2480, y: 880, w: 120, h: 240 }, { x: 2100, y: 0, w: 180, h: 2000 }]);
      for (let i = 0; i < 9; i++) P.push(bam(80 + (i % 3) * 36, 200 + Math.floor(i / 3) * 40, 5, 150));
      scatter(a, 46, 77, (x, y, r) => (r() < 0.22 ? tree(x, y, 22, 'bush') : r() < 0.5 ? rock(x, y, 8 + r() * 10) : tree(x, y, 32 + r() * 18, U.choice(['oak', 'pine', 'maple']))), { pad: 46, spacing: 70 });
      // ---- burning village variant (Mission 07 hook) ----
      if (burned) a.fires.push({ x: 1560, y: 1300, r: 30 }, { x: 990, y: 1100, r: 20 });

      a.interact = [
        { id: 'well', x: 1400, y: 945, r: 55, label: () => (M().at('m2', 'fragments') && !F('frag_well') ? 'Search the well' : 'Look into the well'), hot: () => M().at('m2', 'fragments') && !F('frag_well'), act: () => S().well() },
        { id: 'board', x: 1180, y: 925, r: 55, label: 'Read the quest board', act: () => SV.UI.questBoard() },
        { id: 'vshrine', x: 1525, y: 1725, r: 60, label: () => (SV.state.abilities.healing ? 'Meditate' : 'Pray'), act: () => S().meditate('Village Shrine') },
        ...tracks.map(([x, y], i) => ({ id: 'track' + i, x: x + 20, y, r: 55, label: 'Examine footprints', when: () => M().at('m1', 'tracks') && !F('track' + i), hot: () => true, act: () => S().track(i) })),
      ];
      a.pickups = [
        { id: 'pet_1', kind: 'lore', lore: 'pet_1', x: 1100, y: 1150 }, { id: 'pet_2', kind: 'lore', lore: 'pet_2', x: 2380, y: 1450 },
        { id: 'scr_elder', kind: 'lore', lore: 'scr_elder', x: 2030, y: 540 },
        { id: 'mem_post', kind: 'lore', lore: 'mem_post', x: 660, y: 1335 },
        { id: 'v_ryo1', kind: 'ryo', amount: 25, x: 260, y: 360 }, { id: 'v_ryo2', kind: 'ryo', amount: 30, x: 2450, y: 1820 }, { id: 'v_ryo3', kind: 'ryo', amount: 20, x: 1720, y: 1860 },
        { id: 'v_chest1', kind: 'chest', x: 2420, y: 330, loot: { ryo: 40, items: { iron_ore: 2 } } },
        { id: 'v_chest2', kind: 'chest', x: 230, y: 1300, loot: { ryo: 25, items: { leather: 1, rice_ball: 1 } } },
      ];
      a.spawns = () => [{ type: 'dummy', x: 700, y: 1385 }, { type: 'dummy', x: 780, y: 1385 }, { type: 'dummy', x: 860, y: 1385 }];
      return a;
    },
  };

  /* =====================================================
     FATHER'S HOUSE — interior
     ===================================================== */
  SV.AREAS.ren_house = {
    name: "Father's House", jp: '父の家', region: 'village', sub: 'Twelve winters of dust', indoor: true,
    build() {
      const a = {
        w: 800, h: 600, indoor: true, wind: 0.05, ground: { style: 'interior', outside: '#050505' },
        props: [
          { t: 'iwall', x: 0, y: 0, w: 800, h: 70, shoji: true, moon: true },
          { t: 'iwall', x: 0, y: 0, w: 24, h: 600 }, { t: 'iwall', x: 776, y: 0, w: 24, h: 600 },
          { t: 'iwall', x: 0, y: 576, w: 350, h: 24 }, { t: 'iwall', x: 450, y: 576, w: 350, h: 24 },
          { t: 'hearth', x: 400, y: 300, board: () => SV.state.flags.crestFound },
          { t: 'desk', x: 620, y: 170 }, { t: 'armorstand', x: 170, y: 150 }, { t: 'shelf', x: 330, y: 120 },
          { t: 'futon', x: 150, y: 450 },
          { t: 'decal', kind: 'scorch', x: 620, y: 200, r: 70 }, { t: 'decal', kind: 'scorch', x: 700, y: 420, r: 50 },
          { t: 'decal', kind: 'moonbeam', x: 470, y: 70 },
          { t: 'crate', x: 720, y: 520 }, { t: 'barrel', x: 60, y: 540 },
        ],
        exits: [ex(350, 584, 100, 16, 'village', 600, 800, 'Kurohana Village')],
        doors: [],
        lights: [{ x: 540, y: 140, r: 160, c: 'moon', i: 0.5 }],
      };
      a.interact = [
        { id: 'desk', x: 620, y: 195, r: 60, label: 'Investigate the scorched desk', hot: () => M().at('m1', 'house'), act: () => S().desk() },
        { id: 'hearth', x: 400, y: 300, r: 75, label: () => (M().at('m1', 'crest') ? 'Search beneath the hearth' : 'Examine the hearth'), hot: () => M().at('m1', 'crest'), act: () => S().hearth() },
        { id: 'armor', x: 170, y: 165, r: 55, label: "Touch father's armor", hot: () => !SV.state.collected.mem_armor, act: () => SV.Collect.lore('mem_armor', true) },
        { id: 'shelf', x: 330, y: 140, r: 55, label: 'Browse the shelf', act: () => S().shelf() },
      ];
      a.pickups = [{ id: 'h_ryo', kind: 'ryo', amount: 15, x: 720, y: 470 }];
      a.spawns = () => [];
      return a;
    },
  };

  /* =====================================================
     BAMBOO FOREST — outskirts
     ===================================================== */
  SV.AREAS.bamboo_edge = {
    name: 'Bamboo Forest', jp: '竹林', region: 'bamboo', sub: 'The northern grove',
    build() {
      const a = {
        w: 2400, h: 1900, wind: 0.45, darkMod: 0.08, fog: 0.12, fireflies: true, leafCols: ['#7a8a3a', '#a0a04a', '#c9a227', '#5a6a2a'],
        ground: { base: '#34402b', vars: ['rgba(0,0,0,.12)', 'rgba(140,130,60,.06)'], tuft: '#4e5e34', tuftDensity: 5000, outside: '#141a10' },
        paths: [
          { pts: [[1200, 1900], [1150, 1500], [900, 1150], [700, 800], [520, 470]], w: 70, col: '#6b5c42' },
          { pts: [[900, 1150], [1500, 1000], [1900, 950]], w: 60, col: '#6b5c42' },
          { pts: [[900, 1150], [1150, 700], [1200, 0]], w: 62, col: '#6b5c42' },
          { pts: [[1500, 1000], [1700, 600], [1880, 420]], w: 44, col: '#6b5c42' },
          { pts: [[1150, 1500], [1500, 1520]], w: 40, col: '#6b5c42' },
          { pts: [[900, 1150], [400, 1300]], w: 40, col: '#6b5c42' },
        ],
        plazas: [{ x: 1900, y: 960, r: 170, col: '#5a4e3a' }, { x: 470, y: 420, r: 110, col: '#5d5a50' }],
        water: [{ x: 1780, y: 230, w: 220, h: 120 }, { x: 2000, y: 270, w: 400, h: 70, flow: true }],
        keep: [{ x: 1200, y: 1820, r: 120 }, { x: 1200, y: 60, r: 120 }],
        props: [],
        exits: [
          ex(1120, 1874, 160, 26, 'village', 1300, 70, 'Kurohana Village'),
          ex(1120, 0, 160, 26, 'deep_bamboo', 1200, 1900, 'Deep Bamboo Grove', () => (M().reached('m3', 'enter') ? null : 'Wolves haunt the deep grove. Elder Sato forbids anyone to enter. (Requires Mission 03)')),
        ],
      };
      const P = a.props;
      P.push({ t: 'hokora', x: 470, y: 380, crane: true }, { t: 'torii', x: 470, y: 520, w: 70, h: 86 }, lan(400, 460, { r: 100 }), lan(540, 460, { r: 100 }));
      P.push({ t: 'altar', x: 560, y: 410, item: null, when: () => true });
      P.push({ t: 'cliff', x: 1760, y: 90, w: 260, h: 110 }, { t: 'waterfall', x: 1860, y: 240, w: 60, h: 150 });
      P.push(rock(1770, 380, 16, { moss: true }), rock(2010, 380, 22, { moss: true }));
      P.push({ t: 'log', x: 1520, y: 1560, w: 110 });
      // bandit camp clearing (Mission 02)
      P.push({ t: 'campfire', x: 1900, y: 960 }, { t: 'tent', x: 1820, y: 860 }, { t: 'tent', x: 2010, y: 880, col: '#4a3d2c' }, { t: 'crate', x: 2050, y: 1040 }, { t: 'barrel', x: 1770, y: 1060 }, { t: 'crate', x: 1790, y: 1040 });
      P.push({ t: 'decal', kind: 'leaves', x: 1300, y: 1300 }, { t: 'decal', kind: 'leaves', x: 800, y: 900 });
      borderBamboo(a, 21, [{ x: 1100, y: 1800, w: 200, h: 100 }, { x: 1100, y: 0, w: 200, h: 100 }]);
      scatter(a, 230, 33, (x, y, r) => (r() < 0.86 ? bam(x, y, 4 + Math.floor(r() * 4), 140 + r() * 80) : r() < 0.5 ? rock(x, y, 8 + r() * 12, { moss: true }) : tree(x, y, 30 + r() * 10, 'pine')), { pad: 34, spacing: 46 });
      a.interact = [
        { id: 'hshrine', x: 470, y: 405, r: 70, label: () => (M().at('m1', 'shrine') ? 'Examine the hidden shrine' : SV.state.abilities.healing ? 'Meditate' : 'Pray at the shrine'), hot: () => M().at('m1', 'shrine'), act: () => (M().at('m1', 'shrine') ? S().m1Shrine() : S().meditate('Crane Shrine')) },
        { id: 'frag_shrine', x: 560, y: 425, r: 50, label: 'Search the altar', when: () => M().at('m2', 'fragments') && !F('frag_shrine'), hot: () => true, act: () => S().fragment('frag_shrine', 'Beneath a fallen offering bowl: a sliver of steel.') },
        { id: 'pool', x: 1890, y: 380, r: 70, label: () => (M().at('m2', 'katana') ? 'Search the waterfall pool' : 'Watch the waterfall'), hot: () => M().at('m2', 'katana'), act: () => S().pool() },
        { id: 'frag_log', x: 1520, y: 1580, r: 60, label: 'Search the fallen tree', when: () => M().at('m2', 'fragments') && !F('frag_log'), hot: () => true, act: () => S().fragment('frag_log', 'Wedged in the bark, as if a blade had shattered against it long ago.') },
        { id: 'comb', x: 330, y: 1320, r: 55, label: 'Pick up something red', when: () => SV.state.side.comb === 'active' && !F('combFound'), hot: () => true, act: () => S().comb() },
      ];
      a.pickups = [
        { id: 'pet_3', kind: 'lore', lore: 'pet_3', x: 1000, y: 700 }, { id: 'pet_4', kind: 'lore', lore: 'pet_4', x: 2150, y: 1500 },
        { id: 'mem_shrine', kind: 'lore', lore: 'mem_shrine', x: 380, y: 330, when: () => M().reached('m1', 'enemy') },
        { id: 'b_ryo1', kind: 'ryo', amount: 30, x: 700, y: 1620 }, { id: 'b_ryo2', kind: 'ryo', amount: 25, x: 2200, y: 700 },
        { id: 'b_chest1', kind: 'chest', x: 2200, y: 1200, loot: { ryo: 30, items: { leather: 2 } } },
      ];
      a.spawns = () => {
        const s = [];
        if (M().at('m2', 'bandits')) s.push({ type: 'bandit', x: 1820, y: 960, wave: 'm2' }, { type: 'bandit', x: 1980, y: 1000, wave: 'm2' }, { type: 'bandit', x: 1900, y: 860, wave: 'm2' }, { type: 'leader', x: 1900, y: 1050, id: 'goro', wave: 'm2' });
        if (M().at('m1', 'enemy')) s.push({ type: 'masked', x: 470, y: 650, id: 'masked_scout' });
        if (M().missionDone('m2')) s.push({ type: 'wolf', x: 800, y: 1000 }, { type: 'wolf', x: 1600, y: 650 });
        return s;
      };
      return a;
    },
  };

  /* =====================================================
     DEEP BAMBOO GROVE — Mission 03
     ===================================================== */
  SV.AREAS.deep_bamboo = {
    name: 'Deep Bamboo Grove', jp: '深き竹林', region: 'bamboo', sub: 'Where the light forgets to fall',
    build() {
      const a = {
        w: 2400, h: 2000, wind: 0.5, darkMod: 0.16, fog: 0.35, fireflies: true, leafCols: ['#7a8a3a', '#a0a04a', '#5a6a2a'],
        ground: { base: '#2c3624', vars: ['rgba(0,0,0,.14)', 'rgba(140,130,60,.05)'], tuft: '#45552e', tuftDensity: 4500, outside: '#0e130b' },
        paths: [
          { pts: [[1200, 2000], [1200, 1600], [1200, 1150]], w: 64, col: '#5e523c' },
          { pts: [[1200, 1050], [1200, 800], [1200, 300]], w: 64, col: '#5e523c' },
          { pts: [[1200, 1600], [700, 1520], [480, 1300]], w: 44, col: '#5e523c' },
          { pts: [[1200, 1420], [1700, 1320], [1900, 1460]], w: 44, col: '#5e523c' },
          { pts: [[1200, 1700], [800, 1760]], w: 36, col: '#5e523c' },
          { pts: [[1200, 1650], [1550, 1680]], w: 36, col: '#5e523c' },
        ],
        plazas: [{ x: 1200, y: 450, r: 260, col: '#4a4434' }, { x: 1200, y: 900, r: 150, col: '#4f4b40' }],
        keep: [{ x: 1200, y: 1920, r: 110 }, { x: 1080, y: 1040, w: 240, h: 120 }],
        props: [],
        exits: [
          ex(1120, 1974, 160, 26, 'bamboo_edge', 1200, 70, 'Bamboo Forest'),
          ex(1120, 0, 160, 26, null, 0, 0, 'Mountain Path', () => 'Mountain Path — the trail beyond is lost in landslides. (Requires Mission 06)'),
        ],
        blocks: [{ x: 1080, y: 1060, w: 240, h: 80, when: () => !F('bambooCut') }],
      };
      const P = a.props;
      // suspicious bamboo wall (hidden path)
      for (let i = 0; i < 7; i++) P.push(bam(1095 + i * 35, 1100 + (i % 2) * 18, 6, 200, { when: () => !F('bambooCut'), nocol: true, seed: 900 + i }));
      // forest gate + lantern puzzle
      P.push({ t: 'gate', x: 1200, y: 780, w: 110, open: () => SV.state.puzzles.forestGate === 'solved', glyph: '門' });
      P.push({ t: 'wall', x: 760, y: 770, w: 360, h: 20, col: '#3b3a33' }, { t: 'wall', x: 1280, y: 770, w: 380, h: 20, col: '#3b3a33' });
      SV.Puzzles.forestLanterns.forEach((L) => P.push({ t: 'plantern', x: L.x, y: L.y, glyph: L.g, lit: () => SV.Puzzles.lanternLit(L.g) }));
      P.push({ t: 'tablet', x: 990, y: 960, glyph: '詩' });
      // clearing beyond the gate
      P.push(tree(1200, 230, 52, 'pine'), { t: 'campfire', x: 1080, y: 470, lit: false }, rock(1380, 380, 20, { moss: true }), rock(1000, 360, 14, { moss: true }));
      borderBamboo(a, 41, [{ x: 1100, y: 1900, w: 200, h: 100 }, { x: 1100, y: 0, w: 200, h: 100 }]);
      scatter(a, 300, 55, (x, y, r) => (r() < 0.92 ? bam(x, y, 5 + Math.floor(r() * 4), 170 + r() * 90) : rock(x, y, 8 + r() * 14, { moss: true })), { pad: 30, spacing: 42 });
      a.interact = [
        { id: 'sandal', x: 1170, y: 1720, r: 55, label: 'Examine something in the mud', when: () => M().at('m3', 'search'), hot: () => true, act: () => S().sandal() },
        { id: 'bwall', x: 1200, y: 1160, r: 80, label: () => (M().at('m3', 'hidden') ? 'Cut through the whistling bamboo' : 'Listen to the bamboo'), when: () => !F('bambooCut'), hot: () => M().at('m3', 'hidden'), act: () => S().cutBamboo() },
        { id: 'tablet', x: 990, y: 980, r: 55, label: 'Read the stone tablet', act: () => S().tablet() },
        ...SV.Puzzles.forestLanterns.map((L) => ({ id: 'pl_' + L.g, x: L.x, y: L.y + 10, r: 48, label: () => (SV.Puzzles.lanternLit(L.g) ? 'Lantern burns' : 'Light the ' + L.name + ' lantern'), when: () => SV.state.puzzles.forestGate !== 'solved' && F('bambooCut'), hot: () => M().at('m3', 'gate'), act: () => SV.Puzzles.lightLantern(L.g) })),
      ];
      const herbs = [[600, 1500], [500, 1340], [1780, 1310], [1900, 1450], [1520, 1660], [820, 1745]];
      a.pickups = [
        ...herbs.map(([x, y], i) => ({ id: 'herb' + i, kind: 'herb', x, y, when: () => M().reached('m3', 'herbs') })),
        { id: 'scr_bamboo', kind: 'lore', lore: 'scr_bamboo', x: 440, y: 1240 }, { id: 'rel_3', kind: 'lore', lore: 'rel_3', x: 1960, y: 1500 },
        { id: 'd_ryo1', kind: 'ryo', amount: 35, x: 1600, y: 1700 }, { id: 'd_chest', kind: 'chest', x: 760, y: 1790, loot: { ryo: 45, items: { iron_ore: 2, health_potion: 1 } } },
      ];
      a.spawns = () => {
        const s = [];
        if (!M().reached('m3', 'fight') || M().missionDone('m3')) s.push({ type: 'wolf', x: 900, y: 1500 }, { type: 'wolf', x: 1700, y: 1400 });
        if (M().at('m3', 'fight')) s.push({ type: 'wolf', x: 1050, y: 450, wave: 'm3' }, { type: 'wolf', x: 1350, y: 480, wave: 'm3' }, { type: 'wolf', x: 1200, y: 380, wave: 'm3' }, { type: 'bandit', x: 1200, y: 560, wave: 'm3' });
        return s;
      };
      return a;
    },
  };

  /* =====================================================
     ABANDONED SHRINE — Mission 04 (puzzles)
     ===================================================== */
  SV.AREAS.shrine = {
    name: 'Abandoned Shrine', jp: '廃神社', region: 'shrine', sub: 'Silence has a sound here',
    build() {
      const a = {
        w: 2200, h: 1800, wind: 0.3, darkMod: 0.06, fog: 0.28, leafCols: ['#8f2e1f', '#b5462a', '#6e2018', '#c9a227'],
        ground: { base: '#3a3d33', vars: ['rgba(0,0,0,.12)', 'rgba(90,110,60,.08)'], tuft: '#4a5638', outside: '#121410' },
        paths: [
          { pts: [[300, 0], [300, 760], [1100, 760]], w: 66, col: '#6a675e' },
          { pts: [[1100, 450], [1100, 1100]], w: 60, col: '#6a675e' },
          { pts: [[1100, 1000], [1700, 1300]], w: 44, col: '#6a675e' },
          { pts: [[1100, 1000], [600, 1300], [520, 1420]], w: 40, col: '#6a675e' },
          { pts: [[1100, 760], [1750, 640]], w: 40, col: '#6a675e' },
          { pts: [[1100, 1100], [900, 1240]], w: 34, col: '#6a675e' },
          { pts: [[1700, 1300], [1620, 1010]], w: 30, col: '#6a675e' },
        ],
        plazas: [{ x: 1100, y: 760, r: 210, col: '#605d55' }],
        water: [{ x: 280, y: 900, w: 320, h: 200, koi: true }],
        keep: [{ x: 300, y: 70, r: 100 }],
        props: [],
        exits: [ex(220, 0, 160, 26, 'village', 1300, 1930, 'Kurohana Village')],
      };
      const P = a.props;
      P.push({ t: 'shrineHall', x: 950, y: 250, w: 300, h: 180, open: () => F('sealOpen') });
      P.push({ t: 'torii', x: 1100, y: 1140, w: 110, h: 120 }, { t: 'torii', x: 300, y: 300, w: 90, h: 110 });
      P.push({ t: 'altar', x: 1100, y: 770, glow: () => SV.state.puzzles.statues === 'solved' });
      SV.Puzzles.statueDefs.forEach((d) => P.push({ t: 'statue', x: d.x, y: d.y, puzzle: true, dirFn: () => SV.Puzzles.statueDir(d.id), glow: () => SV.state.puzzles.statues === 'solved' }));
      P.push({ t: 'statue', x: 1780, y: 620, toppled: true, dir: 1 });
      [[500, 1400, '一 鶴'], [1620, 990, '二 風'], [900, 1240, '三 月']].forEach(([x, y, g]) => P.push({ t: 'tablet', x, y, glyph: g }));
      [[940, 520], [1260, 520], [940, 1000], [1260, 1000], [250, 600], [350, 600], [1700, 1250], [600, 1250]].forEach(([x, y]) => P.push(lan(x, y, { r: 110 })));
      P.push({ t: 'wall', x: 760, y: 200, w: 160, h: 18 }, { t: 'wall', x: 1280, y: 200, w: 160, h: 18 });
      [[1550, 1550], [1600, 1580], [1650, 1540], [1700, 1590], [1750, 1550]].forEach(([x, y]) => P.push({ t: 'grave', x, y }));
      P.push(tree(700, 560, 44, 'maple'), tree(1500, 520, 48, 'maple'), tree(1900, 1100, 40, 'dead'), tree(640, 1100, 40, 'maple'), tree(200, 1300, 44, 'dead'));
      P.push({ t: 'decal', kind: 'leaves', x: 1100, y: 900 }, { t: 'decal', kind: 'leaves', x: 700, y: 760 }, { t: 'decal', kind: 'leaves', x: 1500, y: 700 });
      borderTrees(a, 61, ['maple', 'pine', 'dead', 'maple'], [{ x: 200, y: 0, w: 200, h: 150 }]);
      scatter(a, 70, 66, (x, y, r) => (r() < 0.4 ? rock(x, y, 8 + r() * 14, { moss: true }) : r() < 0.6 ? tree(x, y, 22, 'bush') : tree(x, y, 34 + r() * 14, U.choice(['maple', 'pine', 'dead']))), { pad: 50, spacing: 70 });
      a.interact = [
        { id: 'pond', x: 460, y: 1110, r: 60, label: 'Reach into the pond', when: () => !F('key_pond'), hot: () => M().at('m4', 'keys'), act: () => S().keyPond() },
        { id: 'toppled', x: 1790, y: 640, r: 60, label: 'Heave the toppled statue', when: () => !F('key_statue'), hot: () => M().at('m4', 'keys'), act: () => S().keyStatue() },
        ...[['sym1', 500, 1400, 0], ['sym2', 1620, 990, 1], ['sym3', 900, 1240, 2]].map(([id, x, y, i]) => ({ id, x, y: y + 16, r: 55, label: 'Read the inscription', hot: () => M().at('m4', 'symbols') && !F(id), act: () => S().symbolStone(i) })),
        ...SV.Puzzles.statueDefs.map((d) => ({ id: 'st_' + d.id, x: d.x, y: d.y + 14, r: 46, label: 'Turn the fox statue', when: () => SV.state.puzzles.statues !== 'solved', hot: () => M().at('m4', 'statues'), act: () => SV.Puzzles.rotateStatue(d.id) })),
        { id: 'seal', x: 1100, y: 455, r: 70, label: () => (F('sealOpen') ? 'Enter the sanctum' : 'Examine the sealed door'), hot: () => M().at('m4', 'seal') || M().at('m4', 'keys'), act: () => S().sealDoor() },
        { id: 'saltar', x: 1100, y: 790, r: 50, label: () => (SV.state.abilities.healing ? 'Meditate at the altar' : 'Rest at the altar'), when: () => SV.state.puzzles.statues === 'solved', act: () => S().meditate('Shrine Altar') },
      ];
      a.pickups = [
        { id: 'mem_pond', kind: 'lore', lore: 'mem_pond', x: 240, y: 1140 }, { id: 'scr_shrine', kind: 'lore', lore: 'scr_shrine', x: 1930, y: 1480 },
        { id: 'rel_1', kind: 'lore', lore: 'rel_1', x: 2000, y: 320 }, { id: 'rel_2', kind: 'lore', lore: 'rel_2', x: 320, y: 1600 },
        { id: 'pet_5', kind: 'lore', lore: 'pet_5', x: 1480, y: 1660 },
        { id: 's_ryo1', kind: 'ryo', amount: 40, x: 720, y: 700 }, { id: 's_chest', kind: 'chest', x: 1960, y: 880, loot: { ryo: 60, items: { tamahagane: 1, leather: 2 } } },
      ];
      a.spawns = () => {
        const s = [{ type: 'footsoldier', x: 700, y: 1050 }, { type: 'footsoldier', x: 1450, y: 1150 }];
        if (!F('key_ronin')) s.push({ type: 'ronin', x: 1720, y: 1360, id: 'ronin' });
        return s;
      };
      return a;
    },
  };

  /* ---------- world regions (10) for the map ---------- */
  SV.REGIONS = [
    { id: 'mountain', name: 'Mountain Path', jp: '山道', x: 50, y: 9, lock: 'Requires Mission 06 — Blood on the Mountain' },
    { id: 'castle', name: 'Old Castle', jp: '古城', x: 80, y: 18, lock: 'Requires Mission 06' },
    { id: 'temple', name: 'Forgotten Temple', jp: '忘れ寺', x: 19, y: 20, lock: 'Requires Mission 08 — The Forgotten Temple' },
    { id: 'bamboo', name: 'Bamboo Forest', jp: '竹林', x: 50, y: 29, areas: ['bamboo_edge', 'deep_bamboo'], lock: 'Continue Mission 01 to follow the footprints north', open: () => SV.Missions.reached('m1', 'shrine') },
    { id: 'village', name: 'Kurohana Village', jp: '黒花村', x: 50, y: 50, areas: ['village', 'ren_house'], open: () => true, shops: true },
    { id: 'burning', name: 'Burning Village', jp: '燃ゆる村', x: 22, y: 50, lock: 'Requires Mission 07 — The Burning Village' },
    { id: 'shrine', name: 'Abandoned Shrine', jp: '廃神社', x: 50, y: 69, areas: ['shrine'], lock: 'Requires Mission 04 — The Silent Shrine', open: () => SV.Missions.reached('m4', 'travel') },
    { id: 'bandit', name: 'Bandit Camp', jp: '山賊砦', x: 24, y: 83, lock: 'Requires Mission 05 — The Bandit Camp (next chapter)' },
    { id: 'fortress', name: 'Samurai Fortress', jp: '武家砦', x: 79, y: 64, lock: 'Requires Mission 09 — The Samurai Fortress' },
    { id: 'final', name: 'Final Fortress', jp: '終の城', x: 79, y: 88, lock: 'Requires Mission 10 — The Last Path' },
  ];
  SV.REGION_LINKS = [['mountain', 'bamboo'], ['mountain', 'castle'], ['temple', 'bamboo'], ['bamboo', 'village'], ['village', 'burning'], ['village', 'shrine'], ['shrine', 'bandit'], ['village', 'fortress'], ['fortress', 'final'], ['castle', 'fortress']];
})();
