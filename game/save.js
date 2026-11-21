// Solmar Bay — gta6-01 rebuild r13. Save / load (fresh).
// Persists progress to localStorage under one key. Every call is guarded:
// storage may be unavailable (headless, file://, private mode) and the game
// must keep running either way. Save data is plain JSON, versioned so an
// old save can be ignored instead of crashing a newer build.
(function () {
  'use strict';

  var SB = window.SB || (window.SB = {});

  var KEY = 'solmar-bay-save-v1';
  var VERSION = 1;

  function readStorage() {
    try {
      return window.localStorage.getItem(KEY);
    } catch (err) {
      return null;
    }
  }

  function writeStorage(text) {
    try {
      window.localStorage.setItem(KEY, text);
      return true;
    } catch (err) {
      return false;
    }
  }

  var save = {
    key: KEY,

    snapshot: function () {
      var hero = SB.player ? SB.player.pos() : [0, 40];
      var done = [];
      if (SB.missions && SB.missions.list) {
        for (var i = 0; i < SB.missions.list.length; i++) {
          if (SB.missions.list[i].done) done.push(SB.missions.list[i].id);
        }
      }
      return {
        version: VERSION,
        cash: SB.player ? SB.player.cash : 500,
        rep: SB.state ? SB.state.rep : 0,
        heat: SB.police ? SB.police.stars() : 0,
        day: SB.state ? SB.state.day : 1,
        hour: SB.state ? SB.state.hour : 17,
        min: SB.state ? SB.state.min : 24,
        missionsDone: done,
        weapon: SB.player ? SB.player.weapon : 1,
        heroX: hero[0],
        heroZ: hero[1],
      };
    },

    save: function () {
      var ok = writeStorage(JSON.stringify(this.snapshot()));
      if (SB.hud && typeof SB.hud.update === 'function') SB.hud.update();
      return ok;
    },

    load: function () {
      var raw = readStorage();
      if (!raw) return null;
      var data;
      try {
        data = JSON.parse(raw);
      } catch (err) {
        return null;
      }
      if (!data || data.version !== VERSION) return null;
      if (SB.player) {
        SB.player.cash = data.cash;
        SB.player.weapon = data.weapon;
      }
      if (SB.state) {
        SB.state.rep = data.rep;
        SB.state.day = data.day;
        SB.state.hour = data.hour;
        SB.state.min = data.min;
      }
      if (SB.police) SB.police.setStars(data.heat);
      if (SB.missions && SB.missions.list) {
        for (var i = 0; i < SB.missions.list.length; i++) {
          if (data.missionsDone.indexOf(SB.missions.list[i].id) !== -1) {
            SB.missions.list[i].done = true;
          }
        }
      }
      return data;
    },

    hasSave: function () {
      return readStorage() !== null;
    },

    clear: function () {
      try {
        window.localStorage.removeItem(KEY);
        return true;
      } catch (err) {
        return false;
      }
    },
  };

  SB.save = save;
})();
