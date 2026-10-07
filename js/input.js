/* =========================================================
   INPUT — keyboard, mouse and touch unified into named actions.
   Systems read SV.Input.down[action] / SV.Input.pressed[action].
   ========================================================= */
SV.Input = (function () {
  const down = {}, pressed = {}, released = {};
  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    Space: 'dodge', KeyE: 'interact', KeyQ: 'ability', Digit1: 'item1', Digit2: 'item2', Digit3: 'item3', Digit4: 'item4',
    KeyM: 'map', KeyI: 'inv', Escape: 'menu', KeyJ: 'attack', KeyK: 'block', Enter: 'confirm', KeyF: 'interact',
  };
  const mouse = { x: 0, y: 0, wx: 0, wy: 0, lastMove: 0, over: false };
  const stick = { x: 0, y: 0, active: false };
  let touchMode = false;

  function press(a) { if (!down[a]) pressed[a] = true; down[a] = true; }
  function release(a) { if (down[a]) released[a] = true; down[a] = false; }

  window.addEventListener('keydown', (e) => {
    const a = KEYMAP[e.code]; if (!a) return;
    if (e.target && (e.target.tagName === 'INPUT')) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!e.repeat) press(a);
    if (touchMode && !e.repeat) setTouch(false);
  });
  window.addEventListener('keyup', (e) => { const a = KEYMAP[e.code]; if (a) release(a); });
  window.addEventListener('blur', () => Object.keys(down).forEach(release));

  function bindCanvas(canvas) {
    canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.lastMove = performance.now(); mouse.over = true; });
    canvas.addEventListener('mousedown', (e) => {
      SV.Audio.init();
      if (e.button === 0) press('attack'); if (e.button === 2) press('block');
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.lastMove = performance.now();
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) release('attack'); if (e.button === 2) release('block'); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mouseleave', () => (mouse.over = false));
  }

  /* ---------- touch: virtual joystick + action buttons ---------- */
  function setTouch(on) {
    const pref = SV.Settings.get().touch;
    if (pref === 'on') on = true; if (pref === 'off') on = false;
    touchMode = on;
    document.body.classList.toggle('touch', on);
    const t = document.getElementById('touch');
    if (t) t.classList.toggle('hidden', !on || !SV.Game || SV.Game.mode !== 'play');
  }
  function bindTouch() {
    window.addEventListener('touchstart', () => { if (!touchMode) setTouch(true); SV.Audio.init(); }, { passive: true });
    const st = document.getElementById('stick'), knob = document.getElementById('stickKnob');
    let id = null, cx = 0, cy = 0;
    const R = 50;
    st.addEventListener('pointerdown', (e) => { id = e.pointerId; st.setPointerCapture(id); const r = st.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(e); stick.active = true; });
    st.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; stick.x = stick.y = 0; stick.active = false; knob.style.transform = ''; };
    st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
    function move(e) {
      let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy);
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      stick.x = dx / R; stick.y = dy / R;
      knob.style.transform = `translate(${dx}px,${dy}px)`;
    }
    document.querySelectorAll('#tbtns .tb').forEach((b) => {
      const a = b.dataset.act;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); press(a); b.classList.add('on'); });
      const up = () => { release(a); b.classList.remove('on'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    });
  }

  /** Movement vector from keys or stick, normalized */
  function moveVec() {
    let x = (down.right ? 1 : 0) - (down.left ? 1 : 0), y = (down.down ? 1 : 0) - (down.up ? 1 : 0);
    if (stick.active && (Math.abs(stick.x) > 0.15 || Math.abs(stick.y) > 0.15)) { x = stick.x; y = stick.y; }
    const d = Math.hypot(x, y); if (d > 1) { x /= d; y /= d; }
    return { x, y, mag: Math.min(1, d) };
  }
  function endFrame() { for (const k in pressed) delete pressed[k]; for (const k in released) delete released[k]; }
  function clearAll() { Object.keys(down).forEach((k) => (down[k] = false)); endFrame(); }
  /** Aim with mouse only on desktop when the cursor has moved recently */
  function aimWithMouse() { return !touchMode && mouse.over; }

  return { down, pressed, released, mouse, stick, bindCanvas, bindTouch, moveVec, endFrame, clearAll, setTouch, aimWithMouse, press, release, get touch() { return touchMode; } };
})();
