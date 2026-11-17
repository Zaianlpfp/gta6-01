// Keyboard + mouse state for Solmar Bay. Keys are tracked by code
// (KeyW, ArrowUp, ...) so layouts never matter; the mouse is tracked in
// canvas pixels and converted to world coordinates by the camera.
export class Input {
  constructor(canvas) {
    this.keys = {};
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.clicked = false; // set true for one frame when the button goes down
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.mouseDown = false; });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.clicked = true; }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  down(...codes) { return codes.some((c) => !!this.keys[c]); }
  pressed(code) {
    if (this.keys[code]) { this.keys[code] = false; return true; }
    return false;
  }
  // WASD / arrows as a -1..1 pair.
  axes() {
    let x = 0, y = 0;
    if (this.down('KeyA', 'ArrowLeft')) x -= 1;
    if (this.down('KeyD', 'ArrowRight')) x += 1;
    if (this.down('KeyW', 'ArrowUp')) y -= 1;
    if (this.down('KeyS', 'ArrowDown')) y += 1;
    return { x, y };
  }
  endFrame() { this.clicked = false; }
}
