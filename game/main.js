// Solmar Bay — gta6-01 rebuild r13. Main loop (fresh).
// Init order (API.md §0): SB.hud.init() FIRST, then SB.engine.bootFromQuery().
// The engine boots with its own internal rAF loop, so we stop it and run our
// OWN rAF loop instead — never two loops at once. dt is wall-clock, capped
// at 1.0s (the 0.05 clamp froze the live sim in r9; never bring it back).
// The loop gates on !SB.state.paused: step() + missions.update(dt) each frame.
(function () {
  'use strict';

  var SB = window.SB;
  if (!SB) {
    console.error('Solmar Bay: window.SB missing — modules did not load');
    return;
  }

  function start() {
    SB.hud.init();
    SB.engine.bootFromQuery();
    SB.engine.stop();

    var last = performance.now();
    function frame(now) {
      // Schedule the next frame FIRST: if a module throws inside step(),
      // the exception still surfaces in the console, but the loop survives
      // instead of freezing the whole game on one bad tick.
      requestAnimationFrame(frame);
      var dt = (now - last) / 1000;
      if (dt > 1.0) dt = 1.0; // wall-clock, CAP 1.0
      if (dt < 0) dt = 0;
      last = now;
      if (!SB.state.paused) {
        SB.engine.step(dt);
        if (SB.missions) SB.missions.update(dt);
      }
    }
    requestAnimationFrame(frame);

    var mapOpen = false;
    window.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      switch (e.code) {
        case 'KeyM': // map toggle
          mapOpen = !mapOpen;
          if (SB.map) {
            if (mapOpen) SB.map.open();
            else SB.map.close();
          }
          break;
        case 'KeyQ': // cycle radio station (R is reload, never radio)
          if (SB.radio) SB.radio.next();
          break;
        case 'KeyR':
          // KeyR is reload ONLY (never radio).
          if (SB.player && typeof SB.player.reload === 'function') SB.player.reload();
          break;
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
        case 'Digit4': // weapons 1-4 (fists, pistol, SMG, shotgun)
          if (SB.player) SB.player.weapon = Number(e.code.slice(5));
          break;
        case 'KeyF': // shop
          if (SB.shops) SB.shops.open();
          break;
        case 'Escape': // close any open panel
          mapOpen = false;
          if (SB.map) SB.map.close();
          if (SB.shops) SB.shops.close();
          break;
        default:
          break;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
