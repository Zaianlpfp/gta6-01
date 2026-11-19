// Solmar Bay — save/load (B4, v4-rebuild r4). localStorage slots + metadata.
// Metadata uses in-game clock + engine frame (no wall clock). Job statuses are
// recorded for display; load() restores player/world state (cash, rep, hp, armor,
// weapons, heat, time, hero pose, radio).
(function () {
  var SB = window.SB = window.SB || {};
  var PREFIX = 'solmarbay.save.';
  var SLOTS = 3;

  function meta() {
    var t = (SB.state && SB.state.time) || { day: 1, dow: 'FRI', hour: 17, min: 24 };
    return {
      day: t.day, dow: t.dow, hour: t.hour, min: t.min,
      frame: (SB.engine && typeof SB.engine.frame === 'number') ? SB.engine.frame : 0,
      preset: (SB.state && SB.state.preset) || 'cover'
    };
  }
  function cashNow() {
    var c = 0;
    try { c = Math.max(SB.cash || 0, (SB.player && SB.player.cash) || 0, (SB.missions && SB.missions.cash) || 0); } catch (e) {}
    return c;
  }
  function repNow() {
    try { return Math.max((SB.player && SB.player.rep) || 0, (SB.missions && SB.missions.rep) || 0); } catch (e) { return 0; }
  }
  function heroPose() {
    var p = { x: 0, y: 0, z: 100, heading: 0, speedKmh: 0, mode: 'car' };
    try {
      var h = SB.engine && SB.engine.hero;
      if (h && h.pos) { p.x = h.pos.x; p.y = h.pos.y; p.z = h.pos.z; }
      if (h) { p.heading = h.heading || 0; p.speedKmh = h.speedKmh || 0; p.mode = h.mode || 'car'; }
    } catch (e) {}
    try { if (SB.state) p.speedKmh = SB.state.speedKmh || p.speedKmh; } catch (e) {}
    return p;
  }

  SB.save = {
    version: '4.0.0-r4',
    slots: SLOTS,
    key: function (slot) { return PREFIX + slot; },
    collect: function () {
      var weapons = [];
      try {
        var ws = (SB.player && SB.player.weapons) || [];
        for (var i = 0; i < ws.length; i++) {
          weapons.push({ name: ws[i].name, ammo: ws[i].ammo || 0, reserve: ws[i].reserve || 0, locked: !!ws[i].locked });
        }
      } catch (e) {}
      var jobs = [];
      try { jobs = (SB.missions && SB.missions.jobs) ? SB.missions.jobs() : []; } catch (e) {}
      var stars = 0;
      try { stars = (SB.police && typeof SB.police.stars === 'function') ? SB.police.stars() : ((SB.state && SB.state.heat) || 0); } catch (e) {}
      return {
        v: 1, meta: meta(),
        cash: cashNow(), rep: repNow(),
        hp: (SB.player && (SB.player.hp != null ? SB.player.hp : SB.player.health)) || 0,
        armor: (SB.player && SB.player.armor) || 0,
        weapon: (SB.player && SB.player.weapon) || 1,
        weapons: weapons,
        heat: stars,
        time: (SB.state && SB.state.time) ? { day: SB.state.time.day, dow: SB.state.time.dow, hour: SB.state.time.hour, min: SB.state.time.min } : null,
        hero: heroPose(),
        radio: (SB.radio) ? { station: SB.radio.stationIndex(), track: SB.radio.trackIndex() } : { station: 0, track: 0 },
        jobs: jobs.map(function (j) { return { i: j.i, name: j.name, st: j.st }; })
      };
    },
    save: function (slot) {
      slot = slot || 1;
      try {
        var data = this.collect();
        localStorage.setItem(PREFIX + slot, JSON.stringify(data));
        return { ok: true, slot: slot, meta: data.meta, cash: data.cash, rep: data.rep };
      } catch (e) { return { ok: false, slot: slot, reason: String(e && e.message || e) }; }
    },
    load: function (slot) {
      slot = slot || 1;
      var raw = null;
      try { raw = localStorage.getItem(PREFIX + slot); } catch (e) { return { ok: false, slot: slot, reason: String(e && e.message || e) }; }
      if (!raw) return { ok: false, slot: slot, reason: 'empty slot' };
      var data;
      try { data = JSON.parse(raw); } catch (e) { return { ok: false, slot: slot, reason: 'corrupt save' }; }
      if (!data || data.v !== 1) return { ok: false, slot: slot, reason: 'bad version' };
      try {
        if (SB.player) {
          SB.player.cash = data.cash; SB.player.rep = data.rep;
          SB.player.hp = data.hp; SB.player.armor = data.armor;
          if (data.weapons) for (var i = 0; i < data.weapons.length && i < SB.player.weapons.length; i++) {
            SB.player.weapons[i].ammo = data.weapons[i].ammo;
            SB.player.weapons[i].reserve = data.weapons[i].reserve;
            if (data.weapons[i].locked != null) SB.player.weapons[i].locked = !!data.weapons[i].locked;
          }
          try { if (typeof SB.player.setWeapon === 'function') SB.player.setWeapon(data.weapon); } catch (e) { SB.player.weapon = data.weapon; }
        }
        if (SB.state) {
          if (data.time) SB.state.time = { day: data.time.day, dow: data.time.dow, hour: data.time.hour, min: data.time.min };
          SB.state.heat = data.heat || 0;
          SB.state.speedKmh = (data.hero && data.hero.speedKmh) || 0;
          if (data.hero) SB.state.mode = data.hero.mode || SB.state.mode;
        }
        try { if (SB.police && typeof SB.police.setHeat === 'function') SB.police.setHeat(data.heat || 0); } catch (e) {}
        try {
          var h = SB.engine && SB.engine.hero;
          if (h && data.hero) {
            if (h.pos) { h.pos.x = data.hero.x; h.pos.y = data.hero.y; h.pos.z = data.hero.z; }
            h.heading = data.hero.heading; h.speedKmh = data.hero.speedKmh; h.mode = data.hero.mode;
          }
          if (SB.engine && typeof SB.engine.setSpeedKmh === 'function') SB.engine.setSpeedKmh((data.hero && data.hero.speedKmh) || 0);
        } catch (e) {}
        try { if (SB.radio && data.radio) SB.radio.setStation(data.radio.station); } catch (e) {}
        try { if (SB.hud) SB.hud.update(); } catch (e) {}
        return { ok: true, slot: slot, meta: data.meta, cash: data.cash, rep: data.rep, jobsRecorded: data.jobs || [] };
      } catch (e) { return { ok: false, slot: slot, reason: String(e && e.message || e) }; }
    },
    list: function () {
      var out = [];
      for (var s = 1; s <= SLOTS; s++) {
        var m = null;
        try {
          var raw = localStorage.getItem(PREFIX + s);
          if (raw) { var d = JSON.parse(raw); m = { cash: d.cash, rep: d.rep, meta: d.meta, jobs: d.jobs }; }
        } catch (e) {}
        out.push({ slot: s, save: m });
      }
      return out;
    },
    remove: function (slot) {
      try { localStorage.removeItem(PREFIX + (slot || 1)); return { ok: true }; }
      catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
    },
    exists: function (slot) {
      try { return !!localStorage.getItem(PREFIX + (slot || 1)); } catch (e) { return false; }
    }
  };
})();
