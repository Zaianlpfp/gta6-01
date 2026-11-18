(function () {
  'use strict';
  var SB = window.SB = window.SB || {};
  var KEY = 'solmarbay3d';
  function slotKey(slot) { return KEY + ':' + (slot === undefined ? 0 : slot); }
  function playerPos() {
    var p = SB.world.player;
    if (!p || !p.pos) return null;
    return { x: p.pos.x, z: p.pos.z, heading: p.heading || 0, onFoot: !!p.onFoot,
      vehicle: SB.state.vehicle ? { id: SB.state.vehicle.id, name: SB.state.vehicle.name, kind: SB.state.vehicle.kind, condition: SB.state.vehicle.condition } : null };
  }
  SB.save = {
    KEY: KEY,
    save: function (slot) {
      try {
        var data = { v: 1, savedAt: Date.now(), state: SB.serializeState(), player: playerPos() };
        localStorage.setItem(slotKey(slot), JSON.stringify(data));
        return true;
      } catch (e) { return false; }
    },
    load: function (slot) {
      var raw;
      try { raw = localStorage.getItem(slotKey(slot)); } catch (e) { return false; }
      if (!raw) return false;
      var data;
      try { data = JSON.parse(raw); } catch (e) { return false; }
      if (!data || !data.state) return false;
      var keepSeed = SB.state.seed;
      var st = data.state;

      if (st.weapons && st.weapons.fists) st.weapons.fists.ammo = Infinity;

      for (var k in SB.state) if (!(k in st)) delete SB.state[k];
      for (var k2 in st) SB.state[k2] = st[k2];
      SB.state.seed = keepSeed;
      if (SB.reseed) SB.reseed(SB.state.seed);
      if (data.player) {
        if (SB.player && SB.player.setPosition) SB.player.setPosition(data.player.x, data.player.z, data.player.heading);
        else if (SB.world.player) {
          SB.world.player.pos.set(data.player.x, 0, data.player.z);
          SB.world.player.heading = data.player.heading;
          if (SB.world.player.mesh) SB.world.player.mesh.rotation.y = data.player.heading;
        }
      }
      if (SB.setTimeOfDay) SB.setTimeOfDay(SB.state.timeOfDay);
      if (SB.setClock) SB.setClock(SB.state.hour, SB.state.minute);
      SB.emit('save-loaded', data);
      return true;
    },
    autosave: function () { return SB.save.save('auto'); },
    clear: function (slot) {
      try {
        if (slot === undefined) {
          var keys = [];
          for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
          for (var j = 0; j < keys.length; j++) if (keys[j] && keys[j].indexOf(KEY) === 0) localStorage.removeItem(keys[j]);
        } else localStorage.removeItem(slotKey(slot));
        return true;
      } catch (e) { return false; }
    },
    has: function (slot) {
      try { return !!localStorage.getItem(slotKey(slot)); } catch (e) { return false; }
    }
  };
  SB.on('mission-complete', function () { SB.save.autosave(); });
})();
