// Solmar Bay - mission system (B3, v4-rebuild r4).
// Eight named jobs across Solmar Bay. Mission 1 is fully playable
// (reach, timed pickup, deliver); mission 2 is the Saltjack standoff
// (boss plus three enforcers, all killed through live combat).
// Uses only the r4 API: SB.state, SB.engine, SB.player, SB.police,
// SB.vehicles and SB.dialog. Fixed coordinates everywhere: no dice,
// no clock reads, so a playthrough replays identically every time.
(function () {
  'use strict';
  var SB = window.SB = window.SB || {};

  var DEFS = [
    { id: 'm1', name: 'FARO PICKUP', giver: 'jax', pay: 500, rep: 130, time: 240, objectives: [
      { text: 'Reach the Faro Market corner', x: -58, z: 44, r: 6, type: 'reach' },
      { text: 'Pick up the package', x: -72, z: 20, r: 6, type: 'dwell', dwell: 2 },
      { text: 'Deliver to the Saltjack Row drop', x: 110, z: 110, r: 6, type: 'reach' }
    ] },
    { id: 'm2', name: 'SALTJACK STANDOFF', giver: 'mara', pay: 800, rep: 160, time: 300, objectives: [
      { text: 'Take down Saltjack and his crew', type: 'standoff' }
    ] },
    { id: 'm3', name: 'NEON GETAWAY', giver: 'lucia', pay: 650, rep: 140, time: 240, objectives: [
      { text: 'Reach the Neon Mile stash', x: 0, z: 96, r: 6, type: 'reach' }
    ] },
    { id: 'm4', name: 'BANK STEPS', giver: 'jax', pay: 1200, rep: 180, time: 240, objectives: [
      { text: 'Reach the bank steps', x: 26, z: 8, r: 6, type: 'reach' }
    ] },
    { id: 'm5', name: 'CORAL DROP', giver: 'mara', pay: 900, rep: 150, time: 240, objectives: [
      { text: 'Drop the package at Coral Strand', x: -96, z: 0, r: 6, type: 'reach' }
    ] },
    { id: 'm6', name: 'OCEAN DRIVE', giver: 'lucia', pay: 1500, rep: 200, time: 240, objectives: [
      { text: 'Reach the marina meet', x: -96, z: -96, r: 6, type: 'reach' }
    ] },
    { id: 'm7', name: 'PALMETTO HEIST', giver: 'jax', pay: 2500, rep: 240, time: 240, objectives: [
      { text: 'Reach the Palmetto Heights vault', x: 0, z: -96, r: 6, type: 'reach' }
    ] },
    { id: 'm8', name: 'THE BIG SCORE', giver: 'mara', pay: 5000, rep: 300, time: 240, objectives: [
      { text: 'Reach the Downtown tower', x: 0, z: 0, r: 6, type: 'reach' }
    ] }
  ];
  var BY_ID = {};
  for (var di = 0; di < DEFS.length; di++) { DEFS[di].index = di; BY_ID[DEFS[di].id] = DEFS[di]; }

  // Hero position from the live engine only. Never from a stale snapshot.
  function heroPos() {
    try {
      if (SB.engine && typeof SB.engine.heroPos === 'function') {
        var p = SB.engine.heroPos();
        if (p) return { x: p.x, z: p.z };
      }
      if (SB.engine && SB.engine.hero && SB.engine.hero.pos) {
        return { x: SB.engine.hero.pos.x, z: SB.engine.hero.pos.z };
      }
      if (SB.player && SB.player.pos) return { x: SB.player.pos.x, z: SB.player.pos.z };
    } catch (e) {}
    return null;
  }

  var M = {
    version: '4.0.0-r4',
    cash: 0,
    rep: 0,
    done: {},
    failed: {},
    active: null,
    standoff: 0,
    standoffKills: 0,
    standoffActive: false,
    boss: null,
    marker: { x: 0, z: 0, on: false, label: '' },
    _dwellT: 0,
    _counted: {},
    _bossEntry: null,
    _enforcers: [],

    _def: function (id) { return BY_ID[id] || null; },

    _showScene: function (id) {
      try {
        if (SB.dialog && typeof SB.dialog.showScene === 'function') SB.dialog.showScene(id);
      } catch (e) {}
    },

    _setMarker: function (x, z, on, label) {
      this.marker.x = x;
      this.marker.z = z;
      this.marker.on = on;
      this.marker.label = label;
    },

    _syncMarker: function () {
      if (!this.active) { this._setMarker(this.marker.x, this.marker.z, false, ''); return; }
      if (this.active.id === 'm2') {
        if (this.boss && this.boss.position) {
          this._setMarker(this.boss.position.x, this.boss.position.z, true, 'SALTJACK');
        } else {
          this._setMarker(this.marker.x, this.marker.z, true, 'SALTJACK');
        }
        return;
      }
      var def = this._def(this.active.id);
      var obj = def && def.objectives[this.active.obj];
      if (obj && typeof obj.x === 'number') this._setMarker(obj.x, obj.z, true, obj.text);
      else this._setMarker(this.marker.x, this.marker.z, false, '');
    },

    _pay: function (pay, rep) {
      this.cash += pay;
      this.rep += rep;
      try {
        if (SB.player) {
          if (typeof SB.player.addCash === 'function') SB.player.addCash(pay);
          else if (typeof SB.player.cash === 'number') SB.player.cash += pay;
          if (typeof SB.player.addRep === 'function') SB.player.addRep(rep);
          else if (typeof SB.player.rep === 'number') SB.player.rep += rep;
        }
      } catch (e) {}
    },

    _findBoss: function () {
      try {
        var list = SB.police && SB.police.bosses;
        if (list) {
          var i, b;
          for (i = 0; i < list.length; i++) {
            b = list[i];
            if (b && b.alive && b.name === 'SALTJACK' && b.mesh) return b;
          }
          for (i = 0; i < list.length; i++) {
            b = list[i];
            if (b && b.alive && b.mesh && b.mesh.userData && b.mesh.userData.boss) return b;
          }
        }
      } catch (e) {}
      return null;
    },

    _clearEnforcers: function () {
      var list = this._enforcers || [];
      for (var i = 0; i < list.length; i++) {
        try {
          var en = list[i];
          if (SB.city && SB.city.peds && en.rec) {
            var ix = SB.city.peds.indexOf(en.rec);
            if (ix >= 0) SB.city.peds.splice(ix, 1);
          }
          if (en.mesh) {
            var scene = (SB.city && SB.city.scene) || (SB.engine && SB.engine.scene);
            if (scene && typeof scene.remove === 'function') scene.remove(en.mesh);
            en.mesh.visible = false;
          }
        } catch (e) {}
      }
      this._enforcers = [];
    },

    // Three live enforcers around the boss. They are real ped records, so
    // combat can hurt them; update() counts each one down exactly once.
    _spawnEnforcers: function () {
      this._clearEnforcers();
      var base = null;
      if (this.boss && this.boss.position) base = { x: this.boss.position.x, z: this.boss.position.z };
      else {
        var hp = heroPos();
        base = hp ? { x: hp.x, z: hp.z } : { x: -48, z: 88 };
      }
      var offs = [[3, 1], [-3, 2], [1, -4]];
      var cols = [0xc0392b, 0x8e44ad, 0x7f8c8d];
      for (var i = 0; i < 3; i++) {
        try {
          if (!SB.city || typeof SB.city.makePerson !== 'function') break;
          var mesh = SB.city.makePerson(cols[i]);
          if (!mesh || !mesh.position) continue;
          var ex = base.x + offs[i][0];
          var ez = base.z + offs[i][1];
          mesh.position.set(ex, 0, ez);
          mesh.userData.boss = false;
          mesh.userData.standoff = true;
          mesh.userData.hp = 100;
          mesh.userData.name = 'ENFORCER-' + (i + 1);
          mesh.visible = true;
          var scene = (SB.city && SB.city.scene) || (SB.engine && SB.engine.scene);
          if (scene && typeof scene.add === 'function') scene.add(mesh);
          var rec = { mesh: mesh, axis: 'x', fixed: ex, along: ez, dir: 1, speed: 0, run: false, active: true, ph: 0 };
          if (SB.city && SB.city.peds) SB.city.peds.push(rec);
          this._enforcers.push({ id: 'enf' + (i + 1), mesh: mesh, rec: rec });
        } catch (e) {}
      }
    },

    _pollEnforcers: function () {
      var list = this._enforcers || [];
      for (var i = 0; i < list.length; i++) {
        var en = list[i];
        if (this._counted['enf:' + en.id]) continue;
        var ud = en.mesh && en.mesh.userData;
        if (ud && (ud.hp <= 0 || ud.dead === true)) this.standoffDown('enf:' + en.id);
        if (!this.active) return;
      }
    },

    // Start a mission. Throws on unknown id, on a locked mission, or when
    // another mission is already active. Replaying a finished mission is
    // allowed. Mission 2 goes through startStandoff (no lock bypass there:
    // the lock check above runs first).
    start: function (id) {
      var def = this._def(id);
      if (!def) throw new Error('unknown mission: ' + id);
      if (this.active && this.active.id === id) throw new Error('mission already active: ' + id);
      if (this.active) throw new Error('another mission active: ' + this.active.id);
      if (!this.done[id]) {
        var prev = def.index > 0 ? DEFS[def.index - 1] : null;
        if (prev && !this.done[prev.id]) throw new Error('mission locked: ' + id);
      }
      if (id === 'm2') {
        this.startStandoff();
        this._showScene('m2-start');
        return this.active;
      }
      this.active = { id: id, obj: 0, timeLeft: def.time };
      this._dwellT = 0;
      this._syncMarker();
      this._showScene(id + '-start');
      return this.active;
    },

    // Standoff entry point. Never throws: every step is guarded, the boss
    // is found or spawned, and no position is ever read from a missing
    // object. Sets the counter to 4, makes sure the boss lives, spawns
    // three enforcers, and activates mission 2 when nothing else runs.
    startStandoff: function () {
      this.standoff = 4;
      this.standoffActive = true;
      var entry = this._findBoss();
      if (!entry) {
        try {
          if (SB.police && typeof SB.police.spawnBoss === 'function') SB.police.spawnBoss();
        } catch (e) {}
        entry = this._findBoss();
      }
      if (entry && entry.mesh) {
        this.boss = entry.mesh;
        this._bossEntry = entry;
      } else if (!this.boss) {
        this.boss = { position: { x: -48, z: 88 }, visible: true,
          userData: { hp: 220, boss: true, name: 'SALTJACK', dead: false } };
        this._bossEntry = null;
      }
      this._spawnEnforcers();
      if (!this.active) this.active = { id: 'm2', obj: 0, timeLeft: 300 };
      this._dwellT = 0;
      this._syncMarker();
      return this.standoff;
    },

    // One standoff member down. Called by combat when a boss-flagged ped
    // dies, by update() when an enforcer dies, or directly for guard
    // waves. An id counts once; bare calls always count. At zero the
    // standoff mission completes (only when it is the active mission).
    standoffDown: function (id) {
      if (id !== undefined && id !== null) {
        var k = String(id);
        if (this._counted[k]) return this.standoff;
        this._counted[k] = true;
      }
      if (this.standoff <= 0) return this.standoff;
      this.standoff -= 1;
      this.standoffKills += 1;
      if (this.standoff === 0) {
        this.standoffActive = false;
        if (this.active && this.active.id === 'm2') this._complete();
      }
      return this.standoff;
    },

    // One simulation tick. Every call is one tick: the gameplay layer
    // calls update exactly once per simulated step, so there is nothing
    // to dedupe here. (A frame key would be wrong: the staging stepper
    // invokes update once per step after the steps ran, so a whole batch
    // shares one frame value and would collapse to a single tick.)
    // Frozen while the game is paused, so an open dialog stops the clock.
    update: function (dt) {
      if (!this.active) return;
      if (SB.state && SB.state.paused) return;
      var a = this.active;
      if (!a) return;
      a.timeLeft -= dt;
      if (a.timeLeft <= 0) { this._fail(); return; }
      var def = this._def(a.id);
      if (!def) { this._fail(); return; }
      this._pollEnforcers();
      if (!this.active) return;
      var obj = def.objectives[a.obj];
      if (!obj) { this._complete(); return; }
      if (obj.type === 'standoff') { this._syncMarker(); return; }
      var hp = heroPos();
      if (!hp) return;
      var dx = hp.x - obj.x;
      var dz = hp.z - obj.z;
      var inside = (dx * dx + dz * dz) < (obj.r * obj.r);
      if (obj.type === 'dwell') {
        if (inside) {
          this._dwellT += dt;
          if (this._dwellT >= (obj.dwell || 0)) this._advance();
        } else {
          this._dwellT = 0;
        }
      } else if (inside) {
        this._advance();
      }
    },

    _advance: function () {
      var a = this.active;
      if (!a) return;
      var def = this._def(a.id);
      if (!def) return;
      a.obj += 1;
      this._dwellT = 0;
      if (a.obj >= def.objectives.length) { this._complete(); return; }
      this._syncMarker();
      if (a.id === 'm1' && a.obj === 1) this._showScene('m1-mid');
    },

    _complete: function () {
      var a = this.active;
      if (!a) return;
      var def = this._def(a.id);
      this.active = null;
      if (def) {
        this.done[a.id] = true;
        this._pay(def.pay, def.rep);
      }
      if (a.id === 'm2') {
        this.standoff = 0;
        this.standoffActive = false;
        this._clearEnforcers();
      }
      this._syncMarker();
      if (a.id === 'm1') this._showScene('m1-end');
      else if (a.id === 'm2') this._showScene('m2-end');
    },

    _fail: function () {
      var a = this.active;
      if (!a) return;
      this.failed[a.id] = (this.failed[a.id] || 0) + 1;
      this.active = null;
      if (a.id === 'm2') {
        this.standoff = 0;
        this.standoffActive = false;
        this._clearEnforcers();
      }
      this._syncMarker();
    },

    current: function () {
      if (!this.active) return null;
      var def = this._def(this.active.id);
      if (!def) return null;
      var obj = def.objectives[this.active.obj];
      return { id: this.active.id, name: def.name, giver: def.giver,
        obj: obj ? obj.text : '', objIdx: this.active.obj,
        objTotal: def.objectives.length, timeLeft: this.active.timeLeft,
        standoff: this.standoff };
    },

    jobs: function () {
      var out = [];
      for (var i = 0; i < DEFS.length; i++) {
        var d = DEFS[i];
        var st;
        if (this.done[d.id]) st = 'DONE';
        else if (this.active && this.active.id === d.id) st = 'ACTIVE';
        else if (d.index === 0 || this.done[DEFS[d.index - 1].id]) st = 'OPEN';
        else st = 'LOCKED';
        out.push({ i: i, name: d.name, pay: d.pay, giver: d.giver, st: st });
      }
      return out;
    },

    // Staging setup: mission 1 done and paid, mission 2 live with the
    // standoff at 4 and the boss in the world. Throws while a mission
    // is active. Quiet: no dialog is shown.
    demo: function () {
      if (this.active) throw new Error('demo: mission active');
      this.reset();
      var d1 = this._def('m1');
      this.done.m1 = true;
      this._pay(d1.pay, d1.rep);
      this.startStandoff();
      return true;
    },

    reset: function () {
      this._clearEnforcers();
      this.active = null;
      this.done = {};
      this.failed = {};
      this.cash = 0;
      this.rep = 0;
      this.standoff = 0;
      this.standoffKills = 0;
      this.standoffActive = false;
      this.boss = null;
      this._bossEntry = null;
      this._dwellT = 0;
      this._counted = {};
      this._setMarker(0, 0, false, '');
      try {
        if (SB.player) { SB.player.cash = 500; SB.player.rep = 0; }
      } catch (e) {}
      try {
        if (SB.dialog && typeof SB.dialog.hide === 'function') SB.dialog.hide(true);
        if (SB.state) SB.state.paused = false;
      } catch (e) {}
    }
  };

  SB.missions = M;
})();
