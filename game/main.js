// Solmar Bay — boot + wiring (finisher). Loads last: defines the event bus
// and query parser the modules expect, boots the engine, then owns the one
// frame loop. Game keys already belong to the player/police/hud/map modules
// (Digit1-5, R/Q/M/F/P/Esc) and are NOT rebound here.
(function () {
  var SB = window.SB || (window.SB = {});
  var doc = window.document;

  // --- tiny event bus: SB.on(ev, fn) / SB.off(ev, fn) / SB.emit(ev, data) ---
  var bus = {};
  SB.on = function (ev, fn) { (bus[ev] = bus[ev] || []).push(fn); return fn; };
  SB.off = function (ev, fn) {
    var a = bus[ev];
    if (!a) return;
    var i = a.indexOf(fn);
    if (i >= 0) a.splice(i, 1);
  };
  SB.emit = function (ev, data) {
    var a = bus[ev] || [];
    for (var i = 0; i < a.length; i++) { try { a[i](data); } catch (e) {} }
  };

  // --- query parser: SB.parseQuery('?preset=cover') -> { preset: 'cover' } ---
  SB.parseQuery = function (src) {
    var out = {};
    var s = typeof src === 'string' ? src : window.location.search;
    if (s.charAt(0) === '?') s = s.slice(1);
    var parts = s ? s.split('&') : [];
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i].split('=');
      if (!kv[0]) continue;
      out[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    }
    return out;
  };

  function unlockAudio() {
    try { if (SB.audio && SB.audio.unlock) SB.audio.unlock(); } catch (e) {}
  }

  // --- boot: HUD first (its minimap is built lazily once the game canvas
  // exists), then the engine from the URL query (?preset=&adv=&speed=&pause=).
  // bootFromQuery may start the engine's own rAF loop; stop it so this file
  // owns the one true frame loop below (no double stepping).
  SB.hud.init();
  SB.engine.bootFromQuery();
  try { if (SB.engine.stop) SB.engine.stop(); } catch (e) {}

  // --- input routing: click unlocks audio; Space/arrows must not scroll. ---
  var game = doc.getElementById('game');
  if (game) game.addEventListener('click', unlockAudio, false);
  doc.addEventListener('keydown', function (ev) {
    unlockAudio();
    if (ev.code === 'Space' || ev.code === 'ArrowUp' || ev.code === 'ArrowDown' ||
        ev.code === 'ArrowLeft' || ev.code === 'ArrowRight') ev.preventDefault();
  }, false);
  window.addEventListener('resize', function () {
    try { SB.engine.render(); } catch (e) {}
  }, false);

  // --- the one frame loop: step + mission tick (live only), HUD every frame.
  // engine.step() still renders while paused, so the scene stays visible
  // behind dialogs and the map; the HUD is rewritten from live state each
  // frame so speed / wanted / clock never freeze.
  var DT = 1 / 60;
  function frame() {
    var paused = !!(SB.state && SB.state.paused);
    try { SB.engine.step(DT); } catch (e) {}
    if (!paused) { try { SB.missions.update(DT); } catch (e) {} }
    try { SB.hud.update(); } catch (e) {}
    try { SB.hud.render(); } catch (e) {}
    window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);
})();
