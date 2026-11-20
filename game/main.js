/* Solmar Bay — bootstrap (B5).
   Wiring r7: SB.hud.init() DULU, lalu SB.engine.bootFromQuery();
   SB.engine.stop() lalu loop rAF SENDIRI (jangan double-loop dengan engine);
   gate SB.engine.step(dt) + SB.missions.update(dt) pada !SB.state.paused. */
(function () {
  'use strict';
  var SB = window.SB;
  var last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.05) dt = 0.05;
    if (SB.state.paused) return;
    SB.engine.step(dt);
    if (SB.missions && SB.missions.update) SB.missions.update(dt);
    // Integrasi: SB.registerUpdate TIDAK ADA di engine r7 (hud.js mendaftarkan
    // update lewat situ tapi tidak pernah dipanggil) — main loop yang memanggil
    // SB.hud.update tiap frame, pola sama seperti missions.update.
    if (SB.hud && SB.hud.update) SB.hud.update(dt);
  }
  function initInput() {
    // Integrasi: TIDAK ADA modul yang membuat/mengisi SB.input (engine r7 tidak
    // punya keyboard listener; player/vehicles hanya MEMBACA SB.input.keys) —
    // tanpa ini WASD/E/mouse mati total. main.js yang menyediakannya.
    if (SB.input && SB.input.keys) return;
    var keys = {};
    var mouse = { x: 0, y: 0, dx: 0, dy: 0, down: false };
    SB.input = {
      keys: keys, mouse: mouse,
      isDown: function (c) { return !!keys[c]; },
      axis: function () {
        var x = 0, y = 0;
        if (keys.KeyD || keys.ArrowRight) x += 1;
        if (keys.KeyA || keys.ArrowLeft) x -= 1;
        if (keys.KeyW || keys.ArrowUp) y += 1;
        if (keys.KeyS || keys.ArrowDown) y -= 1;
        return { x: x, y: y };
      }
    };
    window.addEventListener('keydown', function (e) {
      keys[e.code] = true;
      if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { keys[e.code] = false; });
    window.addEventListener('blur', function () { for (var k in keys) keys[k] = false; });
    window.addEventListener('mousemove', function (e) {
      var nx = (e.clientX / window.innerWidth) * 2 - 1;
      var ny = -((e.clientY / window.innerHeight) * 2 - 1);
      mouse.dx = nx - mouse.x; mouse.dy = ny - mouse.y; mouse.x = nx; mouse.y = ny;
    });
    window.addEventListener('mousedown', function (e) { if (e.button === 0) mouse.down = true; });
    window.addEventListener('mouseup', function (e) { if (e.button === 0) mouse.down = false; });
  }
  function boot() {
    initInput();
    SB.hud.init();
    SB.engine.bootFromQuery();
    // Integrasi: tidak ada modul yang spawn hero/mobil saat boot (probe live:
    // playerHero false, vehicles.list kosong) — main.js yang melakukannya,
    // sekali saja, lalu hero ditaruh di titik spawn preset aktif.
    if (SB.vehicles && SB.vehicles.spawnParked && SB.vehicles.list && !SB.vehicles.list.length) SB.vehicles.spawnParked();
    if (SB.player && SB.player.create && !SB.player.hero) SB.player.create();
    var sp = (SB.city && SB.city.spawnPoints && SB.city.spawnPoints[SB.state.preset]) || [0, 0];
    if (SB.player && SB.player.setPosition && sp) SB.player.setPosition(sp[0], sp[1], 0);
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
