// save.js — save/load localStorage slot 1 (B4, r5). Round-trip bersih, no-throw.
// Menyimpan state pemain + dunia + progres misi (id misi DONE). Load mengembalikan
// semuanya; status job hanya bisa di-restore bila SB.missions.list mengizinkan
// (didokumentasikan: misi aktif tidak di-restore, hanya daftar DONE).
(function () {
  var SB = window.SB = window.SB || {};
  var S = SB.save = SB.save || {};
  S.KEY = 'solmar-save-1';
  function w0(p, k, d) { try { var v = p ? p[k] : undefined; return v === undefined ? d : v; } catch (e) { return d; } }
  function wmag(p) {
    try {
      var w = p && p.weapons ? p.weapons[(p.weapon || 1) - 1] : null;
      return w ? { mag: w0(w, 'mag', w0(w, 'ammo', 0)), reserve: w0(w, 'reserve', 0) } : { mag: 0, reserve: 0 };
    } catch (e) { return { mag: 0, reserve: 0 }; }
  }
  S.data = function () {
    var done = [];
    try {
      var jobs = SB.missions && SB.missions.jobs ? SB.missions.jobs() : [];
      for (var i = 0; i < jobs.length; i++) if (jobs[i].st === 'DONE') done.push(jobs[i].i);
    } catch (e) {}
    var h = (SB.engine && SB.engine.hero) || {};
    return {
      v: 1,
      cash: Math.max(w0(SB, 'cash', 0), w0(SB.player, 'cash', 0), w0(SB.missions, 'cash', 0)),
      rep: Math.max(w0(SB.player, 'rep', 0), w0(SB.missions, 'rep', 0)),
      hp: w0(SB.player, 'hp', 100), armor: w0(SB.player, 'armor', 0),
      weapon: w0(SB.player, 'weapon', 1), ammo: wmag(SB.player),
      timeMin: w0(SB.state, 'timeMin', 1044), day: w0(SB.state, 'day', 1),
      heat: w0(SB.state, 'heat', 0),
      hx: w0(h, 'x', 0), hz: w0(h, 'z', 60), heading: w0(h, 'heading', Math.PI),
      mode: w0(h, 'mode', 'car'), done: done,
      radio: (SB.radio && SB.radio.idx) || 0
    };
  };
  S.save = function (slot) {
    try {
      var d = S.data();
      window.localStorage.setItem(S.KEY + ':' + (slot || 1), JSON.stringify(d));
      try { if (SB.audio) SB.audio.cash(); } catch (e) {}
      return true;
    } catch (e) { return false; }
  };
  S.load = function (slot) {
    var raw = null;
    try { raw = window.localStorage.getItem(S.KEY + ':' + (slot || 1)); } catch (e) { return false; }
    if (!raw) return false;
    var d = null;
    try { d = JSON.parse(raw); } catch (e) { return false; }
    if (!d || d.v !== 1) return false;
    try {
      if (SB.player) {
        SB.player.cash = d.cash; SB.player.rep = d.rep;
        SB.player.hp = d.hp; SB.player.armor = d.armor;
        if (SB.player.setWeapon) SB.player.setWeapon(d.weapon);
        else SB.player.weapon = d.weapon;
        var w = SB.player.weapons && SB.player.weapons[(d.weapon || 1) - 1];
        if (w) { w.mag = d.ammo.mag; if ('ammo' in w) w.ammo = d.ammo.mag; w.reserve = d.ammo.reserve; }
      }
      if (SB.missions) { SB.missions.cash = d.cash; SB.missions.rep = d.rep; }
      if (SB.state) {
        SB.state.timeMin = d.timeMin; SB.state.day = d.day; SB.state.heat = d.heat;
      }
      if (SB.engine && SB.engine.hero) {
        SB.engine.hero.x = d.hx; SB.engine.hero.z = d.hz;
        SB.engine.hero.heading = d.heading; SB.engine.hero.mode = d.mode;
      }
      if (SB.police && SB.police.setHeat) SB.police.setHeat(d.heat);
      if (SB.radio) SB.radio.set(d.radio || 0);
      if (SB.missions && SB.missions.list) {
        for (var i = 0; i < SB.missions.list.length; i++) {
          var m = SB.missions.list[i];
          if (d.done.indexOf(m.i) !== -1 || d.done.indexOf(i) !== -1) m.st = 'DONE';
        }
      }
      try { if (SB.audio) SB.audio.select(); } catch (e) {}
      return true;
    } catch (e) { return false; }
  };
  S.has = function (slot) {
    try { return !!window.localStorage.getItem(S.KEY + ':' + (slot || 1)); }
    catch (e) { return false; }
  };
  S.list = function () {
    var out = [];
    try {
      var raw = window.localStorage.getItem(S.KEY + ':1');
      if (raw) { var d = JSON.parse(raw); out.push({ slot: 1, cash: d.cash, day: d.day, timeMin: d.timeMin }); }
    } catch (e) {}
    return out;
  };
  S.clear = function (slot) {
    try { window.localStorage.removeItem(S.KEY + ':' + (slot || 1)); return true; }
    catch (e) { return false; }
  };
})();
