// main.js — Solmar Bay (gta6-01 v4 r14) — ENTRYPOINT game.
// Urutan load TETAP (API.md §1): engine -> city -> player -> vehicles -> police
// -> missions -> dialog -> hud -> map -> audio -> radio -> save -> shops.
// Ditulis FRESH dari game/API.md §14. Loop rAF milik file ini; dt LIVE cap 1,0.
import { SB } from './engine.js';
import './city.js';
import './player.js';
import './vehicles.js';
import './police.js';
import './missions.js';
import './dialog.js';
import './hud.js';
import './map.js';
import './audio.js';
import './radio.js';
import './save.js';
import './shops.js';

// Baca ?preset=&seed=&shot=&mission= lalu boot + applyPreset (API.md §14).
// Didefinisikan di sini (entrypoint) supaya engine.js tetap milik B1.
SB.engine.bootFromQuery = function (canvas) {
  const q = new URLSearchParams(window.location.search);
  const seed = q.get('seed');
  if (seed !== null && seed !== '') SB.SEED = Number(seed) || 1337;
  SB.engine.boot(canvas);
  SB.engine.applyPreset(q.get('preset') || 'cover');
  const m = q.get('mission');
  if (m && SB.missions && SB.missions.start) SB.missions.start(Number(m));
  return q;
};

SB.hud.init(); // PALING DULU, sebelum boot (API.md §12/§14).

const canvas = document.getElementById('game');
const query = SB.engine.bootFromQuery(canvas);
const shotName = query.get('shot');
const startScreen = document.getElementById('start-screen');

// Start screen hanya bila load polos (tanpa ?preset / ?shot): screenshot
// preset harus langsung menampilkan game tanpa overlay menu.
if (startScreen && !query.get('preset') && !shotName) {
  startScreen.classList.remove('hidden');
  if (SB.save && SB.save.hasSave()) {
    const cont = document.getElementById('btn-continue');
    if (cont) cont.classList.remove('hidden');
  }
} else if (startScreen) {
  startScreen.classList.add('hidden');
}

if (shotName) {
  // Mode screenshot: preset + 30 step + render, tanpa loop rAF.
  SB.engine.shot(shotName);
} else {
  SB.engine.stop(); // loop rAF milik main.js, bukan engine.
  if (SB.save) SB.save.startAutosaveWatch();
  let last = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 1.0); // CAP 1,0 — JANGAN 0,05
    last = now;
    if (SB.state.flags.paused) { SB.engine.render(); return; }
    SB.engine.step(dt);
    if (SB.audio && SB.state.hero.inVehicle) SB.audio.engineHum(SB.state.hero.speed);
  };
  requestAnimationFrame(frame);

  // Tombol global (API.md §15): ENTER mulai, R radio, M peta, P pause, 1-8 misi.
  window.addEventListener('keydown', (e) => {
    if (SB.audio) SB.audio.ensure(); // gesture pertama membuka AudioContext
    if (e.key === 'Enter' && startScreen && !startScreen.classList.contains('hidden')) {
      startScreen.classList.add('hidden');
      SB.engine.applyPreset('free');
    } else if (e.key === 'r' || e.key === 'R') {
      if (SB.radio) SB.radio.next();
    } else if (e.key === 'm' || e.key === 'M') {
      if (SB.map) SB.map.toggle();
    } else if (e.key === 'p' || e.key === 'P') {
      SB.state.flags.paused = !SB.state.flags.paused;
    } else if (e.key >= '1' && e.key <= '8') {
      if (SB.missions && !SB.missions.active) SB.missions.start(Number(e.key));
    }
  });
  window.addEventListener('pointerdown', () => { if (SB.audio) SB.audio.ensure(); }, { once: true });
}

export { SB };
