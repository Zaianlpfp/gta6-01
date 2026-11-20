// radio.js — 3 stasiun radio Solmar Bay (B4, r5). Q ganti stasiun.
// R HANYA reload (kontrak API §5/§7) — radio tidak pernah pakai KeyR.
(function () {
  var SB = window.SB = window.SB || {};
  var R = SB.radio = SB.radio || {};
  R.stations = [
    { name: 'WAVE 88.1', track: 'Neon Skyline', artist: 'Pink Horizon', tempo: 112 },
    { name: 'SOLMAR FM 101.5', track: 'Calle Ocho', artist: 'Marisol Vega', tempo: 96 },
    { name: 'REBEL 99.9', track: 'Midnight Run', artist: 'The Saltjacks', tempo: 128 }
  ];
  R.idx = 0;
  R.current = function () { return R.stations[R.idx]; };
  R.label = function () {
    var s = R.current();
    return s.name + ' · ' + s.track + ' — ' + s.artist;
  };
  R.trackLabel = function () { var s = R.current(); return s.track + ' — ' + s.artist; };
  R.set = function (i) {
    var n = R.stations.length;
    R.idx = ((i % n) + n) % n;
    try { if (SB.audio) SB.audio.station(R.idx); } catch (e) {}
    try { if (SB.audio) SB.audio.ui(); } catch (e) {}
    try { if (SB.hud && SB.hud.render) SB.hud.render(); } catch (e) {}
    return R.current();
  };
  R.next = function () { return R.set(R.idx + 1); };
  R.prev = function () { return R.set(R.idx - 1); };
  if (!R._bound) {
    R._bound = true;
    try {
      document.addEventListener('keydown', function (e) {
        if (e.repeat || !e.code) return;
        if (e.code === 'KeyQ') { R.next(); }
      });
    } catch (e) {}
  }
})();
