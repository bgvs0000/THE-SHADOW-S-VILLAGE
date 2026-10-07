/* =========================================================
   DIALOGUE — branching conversations with typewriter text,
   portraits, conditional choices and side effects.
   Node: { who:'npc'|'ren'|name, text, choices:[{t, go, if, do}], go, do }
   ========================================================= */
SV.Dialogue = (function () {
  const U = SV.U;
  let tree = null, node = null, meta = null, shown = 0, full = '', typing = false, onEnd = null;
  const box = () => document.getElementById('dialogue');
  const elText = () => document.getElementById('dlgText');
  const SPEED = { slow: 0.04, normal: 0.022, fast: 0.008 };
  let acc = 0;

  function open(t, start = 'start', m = {}, done) {
    tree = t; meta = m; onEnd = done || null;
    box().classList.remove('hidden');
    SV.Input.clearAll();
    SV.Audio.play('ui_open');
    go(start);
  }
  function go(id) {
    if (!id || id === 'end') return close();
    const n = typeof tree[id] === 'function' ? tree[id]() : tree[id];
    if (!n) return close();
    node = n;
    if (n.do) n.do();
    if (!box() || box().classList.contains('hidden')) return; // closed by side effect
    const who = n.who || 'npc';
    const isRen = who === 'ren';
    document.getElementById('dlgName').textContent = isRen ? 'Ren' : who === 'npc' ? meta.name : who;
    document.getElementById('dlgRole').textContent = isRen ? 'Wandering Swordsman' : who === 'npc' ? meta.role || '' : n.role || '';
    const pc = document.getElementById('dlgPortrait');
    SV.Sprites.portrait(pc, isRen ? Object.assign(SV.Player.look(), { facing: Math.PI / 2, attack: null, block: false, charge: false, flash: 0, moving: false }) : who === 'npc' ? meta.look : n.look || meta.look);
    pc.classList.remove('talk'); void pc.offsetWidth; pc.classList.add('talk');
    full = typeof n.text === 'function' ? n.text() : n.text; shown = 0; acc = 0; typing = true;
    elText().textContent = '';
    document.getElementById('dlgChoices').innerHTML = '';
    document.getElementById('dlgNext').style.visibility = 'hidden';
  }
  function finishTyping() {
    typing = false; shown = full.length; elText().textContent = full;
    const ch = (node.choices || []).filter((c) => !c.if || c.if());
    const wrap = document.getElementById('dlgChoices');
    if (ch.length) {
      ch.forEach((c, i) => {
        const b = U.el('button', /leave|farewell|goodbye/i.test(c.t) ? 'leave' : '', `<span class="k">${i + 1}</span>${U.esc(c.t)}`);
        b.style.animationDelay = i * 0.05 + 's';
        b.onclick = (ev) => { ev.stopPropagation(); choose(c); };
        wrap.appendChild(b);
      });
    } else document.getElementById('dlgNext').style.visibility = 'visible';
  }
  function choose(c) {
    SV.Audio.play('ui');
    if (c.do) c.do();
    if (!active()) return;
    go(c.go || 'end');
  }
  function advance() {
    if (!node) return;
    if (typing) { finishTyping(); return; }
    const ch = (node.choices || []).filter((c) => !c.if || c.if());
    if (ch.length) return;
    go(node.go || 'end');
  }
  function close() {
    box().classList.add('hidden'); node = null; tree = null;
    SV.Input.clearAll(); SV.Audio.play('ui_close');
    const cb = onEnd; onEnd = null; if (cb) cb();
  }
  function active() { return !!node; }

  function update(dt) {
    if (!node) return;
    if (typing) {
      acc += dt; const sp = SPEED[SV.Settings.get().textSpeed] || 0.022;
      while (acc > sp && shown < full.length) { acc -= sp; shown++; if (shown % 3 === 0) SV.Audio.play('step'); }
      elText().textContent = full.slice(0, shown);
      if (shown >= full.length) finishTyping();
    }
    const I = SV.Input.pressed;
    if (I.interact || I.dodge || I.confirm) advance();
    const ch = !typing && node && (node.choices || []).filter((c) => !c.if || c.if());
    if (ch && ch.length) ['item1', 'item2', 'item3', 'item4'].forEach((k, i) => { if (I[k] && ch[i]) choose(ch[i]); });
  }
  function bind() { box().addEventListener('click', advance); }

  /** Shortcut: a few lines from one speaker */
  function lines(arr, m, done) {
    const t = {}; arr.forEach((l, i) => { const [who, text] = Array.isArray(l) ? l : ['npc', l]; t['n' + i] = { who, text, go: i < arr.length - 1 ? 'n' + (i + 1) : 'end' }; });
    open(t, 'n0', m || { name: '', role: '' }, done);
  }
  return { open, close, update, active, advance, bind, lines };
})();
