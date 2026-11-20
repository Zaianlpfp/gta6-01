// save.js — save/load Solmar Bay (localStorage). B4 r7.
(function () {
  'use strict';
  var SB = window.SB;
  var KEY = 'solmarbay3d';
  function key(slot) { return KEY + ':' + (slot == null ? 0 : slot); }
  function save(slot) {
    var s = SB.state;
    var data = {
      v: 1, savedSim: s.simTime || 0, missionsDone: s.missionsDone || 0, pos: null,
      state: (typeof SB.serializeState === 'function') ? SB.serializeState() : JSON.parse(JSON.stringify(s))
    };
    if (SB.world && SB.world.player && SB.world.player.pos)
      data.pos = { x: SB.world.player.pos.x, z: SB.world.player.pos.z, heading: SB.world.player.heading || 0, onFoot: !!SB.world.player.onFoot };
    try {
      localStorage.setItem(key(slot), JSON.stringify(data));
      if (typeof SB.emit === 'function') SB.emit('saved', { slot: slot == null ? 0 : slot });
      return true;
    } catch (e) { return false; }
  }
  function load(slot) {
    var raw;
    try { raw = localStorage.getItem(key(slot)); } catch (e) { return false; }
    if (!raw) return false;
    var data;
    try { data = JSON.parse(raw); } catch (e) { return false; }
    if (!data || !data.state) return false;
    var k;
    for (k in data.state) if (Object.prototype.hasOwnProperty.call(data.state, k)) SB.state[k] = data.state[k];
    if (data.pos && SB.player && typeof SB.player.setPosition === 'function') {
      try { SB.player.setPosition(data.pos.x, data.pos.z, data.pos.heading); } catch (e) {}
    }
    if (typeof SB.setWanted === 'function') SB.setWanted(SB.state.wanted || 0);
    if (typeof SB.emit === 'function') SB.emit('loaded', { slot: slot == null ? 0 : slot });
    return true;
  }
  function autosave() { return save('auto'); }
  function clear(slot) { try { localStorage.removeItem(key(slot)); return true; } catch (e) { return false; } }
  function has(slot) { try { return !!localStorage.getItem(key(slot)); } catch (e) { return false; } }
  SB.save = { save: save, load: load, autosave: autosave, clear: clear, has: has, KEY: KEY };
})();
