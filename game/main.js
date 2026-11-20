/* Solmar Bay — bootstrap (B5).
   Wiring r9: SB.hud.init() DULU, lalu SB.engine.bootFromQuery();
   SB.engine.stop() lalu loop rAF SENDIRI (jangan double-loop dengan engine);
   gate SB.engine.step(dt) + SB.missions.update(dt) pada !SB.state.paused.
   Perbaikan kritis warisan r8 (jangan hapus): boot() HARUS memanggil
   SB.player.create() setelah bootFromQuery() — hero + mobil pink + mobil
   parkir HANYA dibuat di sana. Tanpa ini hero null -> P._tick early-return
   (tanpa traffic) dan PL.update hanya sync response (tanpa
   cruiser/heli/roadblock). */
(function () {
  'use strict';
  var SB = window.SB;
  var last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 1.0) dt = 1.0; // r10: cap 1,0 — r9 clamp 0,05 bikin sim live 10-20x lebih lambat dari wall-clock
    if (SB.state.paused) return;
    SB.engine.step(dt);
    if (SB.missions && SB.missions.update) SB.missions.update(dt);
  }
  function boot() {
    SB.hud.init();
    SB.engine.bootFromQuery();
    if (SB.player && typeof SB.player.create === 'function') SB.player.create();
    SB.engine.stop();
    last = performance.now();
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
