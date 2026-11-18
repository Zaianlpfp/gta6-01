// Solmar Bay — input.js
// One job: keyboard + mouse state. WASD/arrows drive, Space is the handbrake,
// Shift runs, E interacts, 1–4 swap weapons, Q cycles the radio, R reloads,
// M opens the map, P/Esc pauses. Mouse aims; click fires.
'use strict';

const Input = {
  mouseX: 0, mouseY: 0, mouseDown: false,

  init() {
    // Movement keys held down.
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      G.keys[k] = true;
      if (k === 'e') G.pressed.e = true;
      if (k === 'q') AudioSys.cycleStation(1);
      if (k === 'r') Combat.reload();
      if (k === 'm') HUD.toggleMap();
      if (k === 'p' || k === 'escape') HUD.togglePause();
      if (k >= '1' && k <= '4') Combat.select(Number(k) - 1);
      if (k === ' ') e.preventDefault();
    });
    addEventListener('keyup', (e) => { G.keys[e.key.toLowerCase()] = false; });
    addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX; this.mouseY = e.clientY;
      if (G.state === 'play' && !Vehicles.playerCar) {
        // Mouse steers the third-person camera (no pointer lock needed).
        G.cameraYaw -= (e.movementX || 0) * 0.0035;
        G.cameraPitch = clamp(G.cameraPitch + (e.movementY || 0) * 0.002, -0.15, 0.5);
      }
    });
    addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; Combat.firing = true; Combat.edge = true; }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) { this.mouseDown = false; Combat.firing = false; }
    });
    addEventListener('blur', () => { Combat.firing = false; this.mouseDown = false; });
    addEventListener('contextmenu', (e) => e.preventDefault());
  },

  // Snapshot the held keys into the shape the game loop reads.
  read() {
    const k = G.keys;
    return {
      up: !!(k['w'] || k['arrowup']),
      down: !!(k['s'] || k['arrowdown']),
      left: !!(k['a'] || k['arrowleft']),
      right: !!(k['d'] || k['arrowright']),
      run: !!k['shift'],
      handbrake: !!k[' '],
    };
  },
};
