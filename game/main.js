(function () {
  'use strict';
  var SB = window.SB;
  var q = SB.parseQuery();
  var seed = parseInt(q.get('seed') || '1337', 10) || 1337;
  SB.init({ canvas: 'game', seed: seed });
  SB.city.buildCity(seed);
  SB.vehicles.spawnParked();
  SB.player.create();
  if (SB.audio) SB.audio.init();
  SB.hud.init();
  SB.bootFromQuery();
  var presetSpots = { cover: [0, 40, 0], mission: [0, 40, -0.35], night: [0, -380, Math.PI] };
  var spot = presetSpots[SB.state.scenePreset];
  if (spot && SB.world.player && !SB.world.player.onFoot) {
    SB.player.setPosition(spot[0], spot[1], spot[2]);
  }
  if (SB.state.scenePreset) SB.updateChaseCam(5);
  SB.on('shot', function (e) {
    if (!SB.missions || !SB.missions.standoffHit || !e) return;
    if (SB.missions.standoffLeft() <= 0) return;
    SB.missions.standoffHit(e.from, e.dir, e.weapon === 'fists' ? 3 : 80);
  });
  if (SB.state.scenePreset === 'cover') {
    SB.state.speedKmh = 151;
    SB.state.gear = 'G4';
    SB.registerUpdate(function () {
      if (SB.state.scenePreset !== 'cover') return;
      if (SB.input.axis().y !== 0) return;
      SB.state.speedKmh = 151;
      SB.state.gear = 'G4';
    });
  }
  window.addEventListener('keydown', function (e) {
    if (!SB.state.started || (e.code !== 'KeyP' && e.code !== 'Escape')) return;
    if (SB.map && SB.map.isOpen()) { SB.map.hide(); return; }
    if (SB.dialog && SB.dialog.active()) return;
    SB.setPaused(!SB.state.paused);
  });
  SB.start();
})();
