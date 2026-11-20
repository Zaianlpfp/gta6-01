// missions.js — 8 story missions "Solmar Bay" (B3, r5, fresh from API.md r5).
// Ledger: SB.missions.cash / rep mirror into SB.player via addCash/addRep.
// Deterministic: no RNG, no wall clock. update(dt) is tick-per-call.
(function () {
  'use strict';
  var SB = window.SB;
  var MISS = [
    { id: 'm1', name: 'First Fare', pay: 500, rep: 130, giver: 'jax', time: 240, objs: [
      { label: 'Drive to Faro Market', x: -58, z: 44, kind: 'reach', r: 6 },
      { label: 'Pick up the package', x: -72, z: 20, kind: 'dwell', r: 5, dwell: 2 },
      { label: 'Drop at Saltjack Row', x: 110, z: 110, kind: 'reach', r: 6 } ] },
    { id: 'm2', name: 'The Package', pay: 1200, rep: 160, giver: 'mara', time: 300, objs: [
      { label: 'Clear the Saltjacks out of the market', x: 3, z: -8, kind: 'standoff' } ] },
    { id: 'm3', name: 'Hot Wheels', pay: 1800, rep: 170, giver: 'jax', time: 300, objs: [
      { label: 'Steal the Comet GT', x: 24, z: 60, kind: 'reach', r: 6 } ] },
    { id: 'm4', name: 'Night Run', pay: 2500, rep: 200, giver: 'lucia', time: 300, objs: [
      { label: 'Reach the Neon Mile drop', x: 0, z: -70, kind: 'reach', r: 6 } ] },
    { id: 'm5', name: 'Chop Shop', pay: 3200, rep: 230, giver: 'jax', time: 300, objs: [
      { label: 'Deliver the car to the chop shop', x: -90, z: 90, kind: 'reach', r: 6 } ] },
    { id: 'm6', name: 'Harbor Lights', pay: 3200, rep: 230, giver: 'mara', time: 300, objs: [
      { label: 'Meet the contact at Bayline Docks', x: 80, z: -110, kind: 'reach', r: 6 } ] },
    { id: 'm7', name: 'Heat', pay: 4200, rep: 280, giver: 'mara', time: 300, objs: [
      { label: 'Lose the heat at the safehouse', x: -40, z: -90, kind: 'reach', r: 6 } ] },
    { id: 'm8', name: 'The Big Score', pay: 5000, rep: 350, giver: 'lucia', time: 420, objs: [
      { label: 'Hit Solmar National Bank', x: 8, z: -10, kind: 'reach', r: 6 } ] }
  ];
  var BOSS = { x: 3, z: -8, hp: 220 };
  var ENF = [ { dx: 2, dz: 0 }, { dx: -2, dz: 1 }, { dx: 0, dz: -3 } ];

  function byId(id) { for (var i = 0; i < MISS.length; i++) if (MISS[i].id === id) return MISS[i]; return null; }
  function heroPos() {
    if (SB.engine && SB.engine.hero) return { x: SB.engine.hero.x, z: SB.engine.hero.z };
    if (SB.player) return { x: SB.player.x || 0, z: SB.player.z || 0 };
    return { x: 0, z: 0 };
  }
  function dist(ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }

  var M = {
    list: MISS, cash: 0, rep: 0, standoff: 0, standoffKills: 0,
    marker: { x: 0, z: 0, on: false, label: '' },
    _done: {}, _active: null, _objIdx: 0, _timeLeft: 0, _dwell: 0,
    _counted: {}, _boss: null, _enf: [], _mesh: null, _spin: 0
  };

  function sayScene(id) {
    try { if (SB.dialog && SB.dialog.sayScene) SB.dialog.sayScene(id); } catch (e) { /* dialog optional */ }
  }
  function award(cash, rep) {
    M.cash += cash; M.rep += rep;
    if (SB.player) {
      if (SB.player.addCash) SB.player.addCash(cash); else SB.player.cash = (SB.player.cash || 0) + cash;
      if (SB.player.addRep) SB.player.addRep(rep); else SB.player.rep = (SB.player.rep || 0) + rep;
    }
  }
  function setMarker(x, z, label) {
    M.marker.x = x; M.marker.z = z; M.marker.on = true; M.marker.label = label || '';
    placeMesh();
  }
  function clearMarker() { M.marker.on = false; if (M._mesh) M._mesh.visible = false; }

  // Small objective diamond (r5 fix: tiny, tidy — radius 0.35, never dominates frame).
  function placeMesh() {
    if (!M.marker.on) return;
    try {
      if (!window.THREE || !SB.engine || !SB.engine.scene) return;
      if (!M._mesh) {
        var g = new THREE.OctahedronGeometry(0.35, 0);
        var m = new THREE.MeshBasicMaterial({ color: 0xff2a33 });
        M._mesh = new THREE.Mesh(g, m);
        M._mesh.scale.y = 1.6;
        SB.engine.scene.add(M._mesh);
      }
      M._mesh.position.set(M.marker.x, 1.9, M.marker.z);
      M._mesh.visible = true;
    } catch (e) { /* scene not ready yet */ }
  }
  function spinMesh(dt) {
    if (!M._mesh || !M.marker.on) return;
    M._spin += dt;
    M._mesh.rotation.y = M._spin * 2.2;
    M._mesh.position.y = 1.9 + Math.sin(M._spin * 3) * 0.12;
  }

  function makePedMesh(x, z, color, boss) {
    if (!window.THREE || !SB.engine || !SB.engine.scene) return null;
    var grp = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.4),
      new THREE.MeshLambertMaterial({ color: color }));
    body.position.y = 0.95;
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
    head.position.y = 1.75;
    grp.add(body); grp.add(head);
    grp.position.set(x, 0, z);
    grp.userData.boss = !!boss;
    SB.engine.scene.add(grp);
    return grp;
  }
  function spawnBoss() {
    var rec = null;
    try {
      if (SB.police && SB.police.spawnBoss) rec = SB.police.spawnBoss(BOSS.x, BOSS.z);
    } catch (e) { rec = null; }
    if (!rec || typeof rec.hp !== 'number') {
      var grp = makePedMesh(BOSS.x, BOSS.z, 0x8a1010, true);
      rec = { name: 'SALTJACK', x: BOSS.x, z: BOSS.z, hp: BOSS.hp, alive: true,
        visible: true, group: grp, userData: { boss: true }, _mine: true };
    }
    rec.hp = BOSS.hp; rec.alive = true;
    // Ped stepper does math on heading/speed — they MUST be numbers (else NaN).
    if (typeof rec.heading !== 'number') rec.heading = 0;
    if (typeof rec.speed !== 'number') rec.speed = 0;
    // Ped stepper reads axis/dir/ph (normal peds carry them) — missing = NaN.
    if (typeof rec.axis === 'undefined') rec.axis = 'z';
    if (typeof rec.dir !== 'number') rec.dir = 1;
    if (typeof rec.ph !== 'number') rec.ph = 0;
    if (rec.group) rec.group.visible = true;
    if (rec.userData) rec.userData.boss = true;
    M._boss = rec;
    return rec;
  }
  function spawnEnforcers() {
    M._enf = [];
    for (var i = 0; i < ENF.length; i++) {
      var x = BOSS.x + ENF[i].dx, z = BOSS.z + ENF[i].dz;
      var id = 'enf:' + (i + 1);
      var grp = makePedMesh(x, z, 0xc22a2a, false);
      var rec = { name: 'SALTJACK', x: x, z: z, hp: 60, alive: true, visible: true,
        group: grp, id: id, heading: 0, speed: 0, shirt: 'red',
        axis: 'z', dir: 1, ph: 0,
        userData: { boss: false, enforcer: true }, _mine: true };
      if (SB.city && SB.city.peds) SB.city.peds.push(rec);
      // Also a police footCop: B2 fire() targets hostiles (boss + footCops),
      // neutral city peds are not shootable — without this, enforcers can't die.
      if (SB.police && SB.police.footCops) SB.police.footCops.push(rec);
      M._enf.push(rec);
    }
  }
  function clearFighters() {
    var i, r;
    for (i = 0; i < M._enf.length; i++) {
      r = M._enf[i];
      if (r.group && SB.engine && SB.engine.scene) { try { SB.engine.scene.remove(r.group); } catch (e) {} }
      if (SB.city && SB.city.peds) {
        var k = SB.city.peds.indexOf(r);
        if (k >= 0) SB.city.peds.splice(k, 1);
      }
      if (SB.police && SB.police.footCops) {
        var j = SB.police.footCops.indexOf(r);
        if (j >= 0) SB.police.footCops.splice(j, 1);
      }
    }
    M._enf = [];
    if (M._boss) {
      var b = M._boss;
      if (b._mine && b.group && SB.engine && SB.engine.scene) { try { SB.engine.scene.remove(b.group); } catch (e) {} }
      else if (b.group) b.group.visible = false;
      b.alive = false;
      M._boss = null;
    }
  }

  function firstOpen() {
    for (var i = 0; i < MISS.length; i++) if (!M._done[MISS[i].id]) return MISS[i];
    return null;
  }
  function stateOf(m) {
    if (M._done[m.id]) return 'DONE';
    if (M._active && M._active.id === m.id) return 'ACTIVE';
    var fo = firstOpen();
    if (fo && fo.id === m.id) return 'OPEN';
    return 'LOCKED';
  }

  M.jobs = function () {
    var out = [];
    for (var i = 0; i < MISS.length; i++) {
      out.push({ i: i, name: MISS[i].name, pay: MISS[i].pay, giver: MISS[i].giver, st: stateOf(MISS[i]) });
    }
    return out;
  };
  M.current = function () {
    if (!M._active) return null;
    var o = M._active.objs[M._objIdx] || M._active.objs[0];
    return { id: M._active.id, name: M._active.name, giver: M._active.giver,
      obj: o.label, objIdx: M._objIdx, objTotal: M._active.objs.length,
      timeLeft: Math.max(0, Math.ceil(M._timeLeft)), standoff: M.standoff };
  };

  M.startStandoff = function () {
    if (M.standoff > 0) return;
    M.standoff = 4; M._counted = {};
    spawnBoss();
    spawnEnforcers();
    setMarker(BOSS.x, BOSS.z, 'SALTJACK');
  };

  M.start = function (id) {
    var m = byId(id);
    if (!m) throw new Error('unknown mission ' + id);
    if (M._active) throw new Error('mission already active');
    var fo = firstOpen();
    if (!M._done[id] && (!fo || fo.id !== id)) throw new Error('mission locked ' + id);
    M._active = m; M._objIdx = 0; M._timeLeft = m.time; M._dwell = 0;
    var o = m.objs[0];
    if (m.id === 'm2') { M.startStandoff(); }
    else setMarker(o.x, o.z, m.name.toUpperCase());
    sayScene(id + '-start');
    return M.current();
  };

  M.standoffDown = function (id) {
    if (id) { if (M._counted[id]) return; M._counted[id] = true; }
    if (M.standoff <= 0) return;
    M.standoff--;
    M.standoffKills++;
    if (M.standoff === 0 && M._active && M._active.id === 'm2') M._complete(M._active, 800, 160);
  };

  M._complete = function (m, cash, rep) {
    M._done[m.id] = true;
    award(cash == null ? m.pay : cash, rep == null ? m.rep : rep);
    var done = m;
    M._active = null; M._objIdx = 0; M._dwell = 0;
    clearMarker();
    sayScene(done.id + '-end');
  };
  M._fail = function () {
    var m = M._active;
    M._active = null; M._objIdx = 0; M._dwell = 0;
    clearMarker();
    if (m) sayScene(m.id + '-fail');
  };
  M._advance = function () {
    M._objIdx++; M._dwell = 0;
    var m = M._active;
    if (!m) return;
    if (M._objIdx >= m.objs.length) { M._complete(m); return; }
    var o = m.objs[M._objIdx];
    setMarker(o.x, o.z, m.name.toUpperCase());
    if (m.id === 'm1' && M._objIdx === 1) sayScene('m1-mid');
  };

  // Tick-per-call: advanceSim / main loop guarantee exactly 1 call per step.
  M.update = function (dt) {
    dt = dt || 0;
    spinMesh(dt);
    if (!M._active) return;
    M._timeLeft -= dt;
    if (M._timeLeft <= 0) { M._fail(); return; }
    var m = M._active, o = m.objs[M._objIdx];
    if (!o) return;
    if (o.kind === 'standoff') {
      for (var i = 0; i < M._enf.length; i++) {
        var e = M._enf[i];
        if ((e.hp <= 0 || e.alive === false) && !M._counted[e.id]) M.standoffDown(e.id);
      }
      return;
    }
    var p = heroPos();
    var d = dist(p.x, p.z, o.x, o.z);
    if (o.kind === 'dwell') {
      if (d <= o.r) { M._dwell += dt; if (M._dwell >= (o.dwell || 2)) M._advance(); }
      else M._dwell = 0;
    } else if (d <= o.r) M._advance();
  };

  M.demo = function () {
    if (M._active) throw new Error('mission active');
    M.reset();
    M._done.m1 = true;
    award(500, 130);
    M._active = byId('m2');
    M._objIdx = 0; M._timeLeft = 300; M._dwell = 0;
    M.startStandoff();
    if (SB.state) SB.state.paused = false;
    return M.current();
  };

  M.reset = function () {
    clearFighters();
    M._active = null; M._objIdx = 0; M._timeLeft = 0; M._dwell = 0;
    M._done = {}; M.cash = 0; M.rep = 0; M.standoff = 0; M.standoffKills = 0;
    M._counted = {};
    clearMarker();
    if (SB.player) { SB.player.cash = 500; SB.player.rep = 0; }
  };

  // Wrap setPreset once: fresh preset = fresh mission state.
  if (SB.engine && SB.engine.setPreset && !SB._b3preset) {
    SB._b3preset = true;
    var _sp = SB.engine.setPreset;
    SB.engine.setPreset = function (name) {
      var r = _sp(name);
      try { M.reset(); } catch (e) { /* keep preset working */ }
      return r;
    };
  }

  SB.missions = M;
})();
