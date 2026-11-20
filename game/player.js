'use strict';
/* player.js — hero jalan kaki + kendaraan, cash/REP, kontrol, combat (B2, r5).
   Kontrak: game/API.md §3. Tulis segar dari spesifikasi; tanpa RNG/jam dinding. */
(function () {
  var SB = window.SB;
  if (!SB || !SB.engine || !SB.engine.hero) return;
  var hero = function () { return SB.engine.hero; };
  var now = function () { return SB.engine.simTime || 0; };
  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  var normAng = function (a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };

  var DEFS = [
    { name: 'FISTS',   mag: 0,  cap: 0,  reserve: 0,   dmg: 12, cd: 0.45, range: 2.5, locked: false },
    { name: 'PISTOL',  mag: 12, cap: 12, reserve: 48,  dmg: 32, cd: 0.25, range: 45,  locked: false },
    { name: 'SMG',     mag: 32, cap: 32, reserve: 128, dmg: 18, cd: 0.09, range: 40,  locked: false },
    { name: 'SHOTGUN', mag: 6,  cap: 6,  reserve: 18,  dmg: 55, cd: 1.66, range: 25,  locked: false },
    { name: 'RIFLE',   mag: 30, cap: 30, reserve: 90,  dmg: 45, cd: 0.12, range: 60,  locked: true }
  ];
  function freshWeapons() {
    var out = [], i, d;
    for (i = 0; i < DEFS.length; i++) {
      d = DEFS[i];
      out.push({ name: d.name, mag: d.mag, cap: d.cap, reserve: d.reserve,
        ammo: d.mag, dmg: d.dmg, cd: d.cd, range: d.range, locked: d.locked, _last: -99 });
    }
    return out;
  }

  var P = {
    x: hero().x, z: hero().z, heading: hero().heading,
    hp: 100, armor: 0, cash: 500, rep: 0, onFoot: hero().mode === 'foot',
    weapon: 2, weaponIdx: 1, weapons: freshWeapons(),
    keys: new Set(), _fired: false, lastFired: -99
  };
  SB.player = P;

  function cur() { return P.weapons[P.weaponIdx]; }
  function syncFromHero() {
    var h = hero();
    P.x = h.x; P.z = h.z; P.heading = h.heading;
    P.onFoot = h.mode === 'foot';
    SB.state.speedKmh = h.speedKmh || 0;
    SB.state.gear = h.mode === 'car'
      ? (SB.vehicles ? SB.vehicles.gear(h.speedKmh || 0) : 'N') : 'N';
    if (SB.city && SB.city.districtAt) SB.state.district = SB.city.districtAt(h.x, h.z);
  }

  P.setWeapon = function (i) {
    i = i | 0;
    if (i < 1 || i > P.weapons.length) return false;
    if (P.weapons[i - 1].locked) return false;
    P.weapon = i; P.weaponIdx = i - 1;
    return true;
  };
  P.reload = function () {
    var w = cur();
    if (w.name === 'FISTS') return false;
    var need = w.cap - w.mag;
    if (need <= 0 || w.reserve <= 0) return false;
    var take = need < w.reserve ? need : w.reserve;
    w.mag += take; w.reserve -= take; w.ammo = w.mag;
    return true;
  };
  P.addCash = function (n) { P.cash += n; return P.cash; };
  P.addRep = function (n) { P.rep += n; return P.rep; };
  P.aimAt = function (x, z) {
    var h = hero();
    h.heading = Math.atan2(x - h.x, z - h.z);
    P.heading = h.heading;
  };
  P.hurt = function (dmg) {
    if (dmg <= 0 || P.hp <= 0) return;
    var absorbed = 0;
    if (P.armor > 0) {
      absorbed = dmg * 0.6;
      if (absorbed > P.armor) absorbed = P.armor;
      P.armor -= absorbed;
    }
    P.hp -= (dmg - absorbed);
    if (P.hp < 0) P.hp = 0;
  };

  function candidates() {
    var out = [], i, p;
    if (SB.city && SB.city.peds) {
      for (i = 0; i < SB.city.peds.length; i++) {
        p = SB.city.peds[i];
        if (p && p.hp != null && p.hp > 0 && p.alive !== false) out.push(p);
      }
    }
    if (SB.police && SB.police.footCops) {
      for (i = 0; i < SB.police.footCops.length; i++) {
        p = SB.police.footCops[i];
        if (p && p.hp != null && p.hp > 0 && p.alive !== false && out.indexOf(p) < 0) out.push(p);
      }
    }
    if (SB.police && SB.police.boss) {
      var b = SB.police.boss;
      if (b.hp > 0 && b.alive !== false && out.indexOf(b) < 0) out.push(b);
    }
    return out;
  }

  P.fire = function () {
    var h = hero(), w = cur(), t = now();
    if (t - w._last < w.cd) return false;
    w._last = t;
    if (h.mode === 'foot') {
      if (w.name !== 'FISTS') {
        if (w.mag <= 0) return false;
        w.mag--; w.ammo = w.mag;
      }
    }
    var pos = { x: h.x, y: 1.4, z: h.z };
    if (SB.engine.muzzlePos) pos = SB.engine.muzzlePos();
    if (SB.engine.burst) SB.engine.burst(pos);
    P._fired = true; P.lastFired = t;
    var list = candidates(), best = null, bestScore = 1e9, i, p, dx, dz, d, ang, diff, score;
    for (i = 0; i < list.length; i++) {
      p = list[i];
      if (!p.userData || !(p.userData.boss || p.userData.enforcer || p.userData.cop)) continue;
      dx = p.x - h.x; dz = p.z - h.z;
      d = Math.sqrt(dx * dx + dz * dz);
      if (d > w.range) continue;
      ang = Math.atan2(dx, dz);
      diff = Math.abs(normAng(ang - h.heading));
      if (d > 3 && diff > 0.6) continue;
      score = diff * 10 + d * 0.01;
      if (score < bestScore) { bestScore = score; best = p; }
    }
    if (best) {
      best.hp -= w.dmg;
      if (best.hp <= 0) {
        best.hp = 0; best.alive = false;
        if (best.group) best.group.visible = false;
        if (best.userData.boss) {
          if (SB.missions && SB.missions.standoffDown) SB.missions.standoffDown();
        } else if (best.userData.cop) {
          if (SB.police && SB.police.addHeat) SB.police.addHeat(12);
          if (SB.police && SB.police.replaceCop) SB.police.replaceCop(best);
        }
      }
    }
    return true;
  };

  P.enterCar = function () {
    var h = hero();
    if (h.mode === 'car') { P.exitCar(); return true; }
    var v = null;
    if (SB.vehicles && SB.vehicles.nearest) v = SB.vehicles.nearest(h.x, h.z);
    if (!v) return false;
    if (!v.isHero && SB.police && SB.police.addHeat) SB.police.addHeat(10);
    h.mode = 'car';
    h.speedKmh = 0;
    P.onFoot = false;
    syncFromHero();
    return true;
  };
  P.exitCar = function () {
    var h = hero();
    if (h.mode !== 'car') return false;
    /* mobil hero tertinggal di posisi turun */
    if (SB.vehicles && SB.vehicles.list && SB.vehicles.list[0]) {
      SB.vehicles.list[0].x = h.x;
      SB.vehicles.list[0].z = h.z;
      SB.vehicles.list[0].heading = h.heading;
    }
    h.mode = 'foot';
    h.speedKmh = 0;
    var rx = Math.cos(h.heading), rz = -Math.sin(h.heading);
    h.x += rx * 2.2; h.z += rz * 2.2;
    P.onFoot = true;
    syncFromHero();
    return true;
  };

  /* ---- kontrol keyboard (sekali ikat) ---- */
  function onKeyDown(e) {
    P.keys.add(e.code);
    if (SB.state.paused) return;
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'KeyE') P.enterCar();
    else if (e.code === 'KeyR') P.reload();
    else if (e.code >= 'Digit1' && e.code <= 'Digit5') P.setWeapon(e.code.charCodeAt(5) - 48);
  }
  function onKeyUp(e) { P.keys.delete(e.code); }
  if (!SB._b2keys) {
    SB._b2keys = true;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  /* ---- gerak per langkah (dipanggil dari wrap step) ---- */
  function playerTick(dt) {
    var h = hero(), k = P.keys;
    if (h.mode === 'car') {
      var sp = (h.speedKmh || 0) / 3.6; /* m/s */
      var acc = 0;
      if (k.has('KeyW')) acc = 16;
      else if (k.has('KeyS')) acc = sp > 0.5 ? -30 : -10;
      else acc = sp > 0.2 ? -6 : (sp < -0.2 ? 6 : -sp / Math.max(dt, 0.001));
      if (k.has('Space')) acc = sp > 0.2 ? -40 : (sp < -0.2 ? 40 : -sp / Math.max(dt, 0.001));
      sp += acc * dt;
      sp = clamp(sp, -8, 55);
      if (Math.abs(sp) < 0.05 && !k.has('KeyW') && !k.has('KeyS')) sp = 0;
      var steer = (k.has('KeyA') ? 1 : 0) - (k.has('KeyD') ? 1 : 0);
      if (steer !== 0 && Math.abs(sp) > 0.3) {
        h.heading += steer * 1.6 * Math.min(1, Math.abs(sp) / 8) * dt * (sp < 0 ? -1 : 1);
      }
      h.speedKmh = sp * 3.6;
    } else {
      var turn = (k.has('KeyA') ? 1 : 0) - (k.has('KeyD') ? 1 : 0);
      if (turn !== 0) h.heading += turn * 2.4 * dt;
      var v = 0;
      if (k.has('KeyW')) v = k.has('ShiftLeft') || k.has('ShiftRight') ? 9.0 : 4.2;
      else if (k.has('KeyS')) v = -2.0;
      if (v !== 0) {
        h.x += Math.sin(h.heading) * v * dt;
        h.z += Math.cos(h.heading) * v * dt;
        h.x = clamp(h.x, -160, 160);
        h.z = clamp(h.z, -160, 160);
      }
      h.speedKmh = Math.abs(v) * 3.6;
    }
    syncFromHero();
  }

  /* ---- wrap SB.engine.step SEKALI ---- */
  if (!SB._b2step && SB.engine.step) {
    SB._b2step = true;
    var origStep = SB.engine.step;
    SB.engine.step = function (dt) {
      dt = dt || 1 / 60;
      if (!SB.state.paused) {
        playerTick(dt);
        if (SB.vehicles && SB.vehicles.tick) SB.vehicles.tick(dt);
        if (SB.police && SB.police.tick) SB.police.tick(dt);
      }
      return origStep.call(SB.engine, dt);
    };
  }

  /* ---- wrap SB.engine.advanceSim SEKALI: missions.update tepat 1x/langkah ---- */
  if (!SB._b2adv && SB.engine.advanceSim) {
    SB._b2adv = true;
    SB._b2advN = 0;
    SB.engine.advanceSim = function (n) {
      n = n | 0;
      for (var i = 0; i < n; i++) {
        SB.engine.step(1 / 60);
        SB._b2advN++;
        if (SB.missions && typeof SB.missions.update === 'function') SB.missions.update(1 / 60);
      }
      return SB.engine.frame;
    };
  }

  /* ---- wrap setPreset berantai (player) ---- */
  if (!SB._b2playerPreset && SB.engine.setPreset) {
    SB._b2playerPreset = true;
    var origPreset = SB.engine.setPreset;
    SB.engine.setPreset = function (name) {
      var r = origPreset.call(SB.engine, name);
      var h = hero();
      P.hp = 100; P.armor = 0;
      P.weapons = freshWeapons();
      P.weapon = 2; P.weaponIdx = 1;
      P._fired = false;
      syncFromHero();
      return r;
    };
  }
  syncFromHero();
})();
