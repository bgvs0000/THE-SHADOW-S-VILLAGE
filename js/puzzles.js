/* =========================================================
   PUZZLES — forest lantern sequence, rotating fox statues,
   shrine key-holes and the symbol-dial seal. All state lives
   in SV.state.puzzles so it persists through saves.
   ========================================================= */
SV.Puzzles = (function () {
  const U = SV.U;
  const P = () => SV.state.puzzles;

  /* ---------- Forest gate: light lanterns in the poem's order ---------- */
  const forestLanterns = [
    { g: '鶴', name: 'Crane', x: 1050, y: 860 }, { g: '月', name: 'Moon', x: 1135, y: 890 },
    { g: '狐', name: 'Fox', x: 1265, y: 890 }, { g: '狼', name: 'Wolf', x: 1350, y: 860 },
  ];
  const FOREST_ORDER = ['狐', '鶴', '狼', '月'];
  function lanternLit(g) { return P().forestGate === 'solved' || (P().forestSeq || []).includes(g); }
  function lightLantern(g) {
    const seq = P().forestSeq = P().forestSeq || [];
    if (seq.includes(g)) return;
    seq.push(g);
    const L = forestLanterns.find((l) => l.g === g);
    SV.Audio.play('puzzle_tick'); SV.World.burst(L.x, L.y - 28, 10, { type: 'ember', col: '#ffcf80', smin: 10, smax: 60, life: 0.8, up: 40 });
    const ok = seq.every((s, i) => s === FOREST_ORDER[i]);
    if (!ok) {
      setTimeout(() => {
        P().forestSeq = []; SV.Audio.play('puzzle_fail'); SV.Camera.shake(4, 0.3);
        forestLanterns.forEach((l) => SV.World.burst(l.x, l.y - 28, 8, { type: 'smoke', col: 'rgba(90,90,90,', smin: 10, smax: 30, life: 1, size: 6 }));
        SV.UI.toast('The flames gutter and die. That was not the order of the poem.', 'red');
      }, 350);
      return;
    }
    if (seq.length === FOREST_ORDER.length) {
      P().forestGate = 'solved';
      setTimeout(() => {
        SV.Audio.play('puzzle_ok'); SV.Audio.play('door'); SV.Camera.shake(6, 0.6); SV.UI.flash(0.25);
        SV.World.burst(1200, 760, 40, { type: 'dust', col: 'rgba(120,110,90,', smin: 30, smax: 140, life: 1.4, size: 7 });
        SV.UI.toast('The forest gate groans open.', 'big');
        SV.Missions.complete('m3', 'gate');
        SV.Save.autosave('puzzle');
      }, 400);
    }
  }

  /* ---------- Shrine: rotating fox statues ---------- */
  const statueDefs = [{ id: 'w', x: 950, y: 770, want: 0 }, { id: 'e', x: 1250, y: 770, want: 2 }, { id: 'n', x: 1100, y: 640, want: 1 }, { id: 's', x: 1100, y: 905, want: 3 }];
  function dirs() { return (P().statueDirs = P().statueDirs || { w: 2, e: 1, n: 3, s: 0 }); }
  function statueDir(id) { return P().statues === 'solved' ? statueDefs.find((d) => d.id === id).want : dirs()[id]; }
  function rotateStatue(id) {
    if (P().statues === 'solved') return;
    const d = dirs(); d[id] = (d[id] + 1) % 4;
    const def = statueDefs.find((s) => s.id === id);
    SV.Audio.play('puzzle_tick'); SV.Camera.shake(2, 0.12);
    SV.World.burst(def.x, def.y - 6, 8, { type: 'dust', col: 'rgba(120,120,110,', smin: 10, smax: 40, life: 0.8, size: 4 });
    if (d[id] === def.want) SV.World.text(def.x, def.y - 64, '·', '#C9A227');
    if (statueDefs.every((s) => d[s.id] === s.want)) {
      P().statues = 'solved';
      setTimeout(() => {
        SV.Audio.play('puzzle_ok'); SV.UI.flash(0.2); SV.Camera.shake(4, 0.4);
        SV.World.burst(1100, 750, 30, { type: 'spark', col: '#ffd27a', smin: 30, smax: 120, life: 1.1, up: 40 });
        SV.UI.toast('The altar wakes with a pale gold light. Somewhere, a lock turns.', 'big');
        SV.Missions.complete('m4', 'statues');
        SV.Save.autosave('puzzle');
      }, 300);
    }
  }

  /* ---------- Shrine door ---------- */
  function keysPlaced() { return ['key_pond', 'key_statue', 'key_ronin'].filter((k) => SV.state.flags[k]).length; }
  const SYMBOLS = ['月', '鶴', '火', '水', '風', '山'];
  const NAMES = { '月': 'Moon', '鶴': 'Crane', '火': 'Fire', '水': 'Water', '風': 'Wind', '山': 'Mountain' };
  const SEAL = ['鶴', '風', '月'];
  function openSeal() {
    const st = P().dial = P().dial || [0, 0, 0];
    const p = SV.UI.panel({ id: 'seal', title: 'THE SEALED DOOR', jp: '封印', cls: 'md' });
    const found = [['sym1', '一', '鶴'], ['sym2', '二', '風'], ['sym3', '三', '月']].map(([f, n, g]) => (SV.state.flags[f] ? `<em>${n} · ${g} ${NAMES[g]}</em>` : `${n} · ???`)).join('&nbsp;&nbsp;&nbsp;');
    p.body.innerHTML = `<p class="puz-hint">Three stone dials, worn smooth by hands long gone. Beneath them, carved faintly: <em>"The deepest door answers to three words."</em><br>Inscriptions found: ${found}</p>`;
    const dials = U.el('div', 'dials'); p.body.appendChild(dials);
    const faces = [];
    for (let i = 0; i < 3; i++) {
      const d = U.el('div', 'dial');
      const up = U.el('button', 'arr', '▲'), dn = U.el('button', 'arr', '▼'), face = U.el('div', 'face', SYMBOLS[st[i]]), lab = U.el('small', '', NAMES[SYMBOLS[st[i]]].toUpperCase());
      const turn = (k) => { st[i] = (st[i] + k + SYMBOLS.length) % SYMBOLS.length; face.textContent = SYMBOLS[st[i]]; lab.textContent = NAMES[SYMBOLS[st[i]]].toUpperCase(); face.classList.add('spin'); setTimeout(() => face.classList.remove('spin'), 200); SV.Audio.play('puzzle_tick'); };
      up.onclick = () => turn(-1); dn.onclick = () => turn(1);
      d.append(up, face, lab, dn); dials.appendChild(d); faces.push(face);
    }
    const row = U.el('div', 'btn-row'); row.style.justifyContent = 'center';
    const go = U.el('button', 'btn red', 'Press the seal'); row.appendChild(go); p.body.appendChild(row);
    go.onclick = () => {
      const ok = st.every((v, i) => SYMBOLS[v] === SEAL[i]);
      if (!ok) { p.panel.classList.remove('shake'); void p.panel.offsetWidth; p.panel.classList.add('shake'); SV.Audio.play('puzzle_fail'); SV.UI.toast('The dials grind back. Nothing.', 'red'); return; }
      p.panel.classList.add('solved'); SV.Audio.play('puzzle_ok'); go.disabled = true;
      SV.state.flags.sealOpen = true; SV.Save.autosave('puzzle');
      setTimeout(() => { SV.UI.closePanel(); SV.Story.m4Seal(); }, 1300);
    };
  }
  function serialize() {}
  return { forestLanterns, lanternLit, lightLantern, statueDefs, statueDir, rotateStatue, keysPlaced, openSeal, serialize };
})();
