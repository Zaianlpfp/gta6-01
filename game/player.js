// player.js — B2 v4-rebuild r4. On-foot movement, combat, cash/REP, respawn.
// Forward = (-sin h, -cos h); engine.step moves the hero by speedKmh each step,
// so on-foot movement sets speed + heading and lets the engine carry the hero.
(function () {
  var SB = window.SB;
  // HUD wheel reads weapon.ammo (mag count) + reserve — verified by probe
  // p11 (ammo=33 rendered as "33/48"); keep ammo in sync with mag.
  var WEAPONS = [
    { name: 'FISTS', mag: 0, ammo: 0, magSize: 0, reserve: 0, dmg: 15, cd: 0.5, range: 2.6 },
    { name: 'PISTOL', mag: 12, ammo: 12, magSize: 12, reserve: 48, dmg: 34, cd: 0.28, range: 42 },
    { name: 'SMG', mag: 32, ammo: 32, magSize: 32, reserve: 128, dmg: 20, cd: 0.09, range: 36 },
    { name: 'SHOTGUN', mag: 6, ammo: 6, magSize: 6, reserve: 18, dmg: 90, cd: 1.66, range: 24 },
    { name: 'RIFLE', mag: 30, ammo: 30, magSize: 30, reserve: 120, dmg: 45, cd: 0.12, range: 60, locked: true }
  ];
  SB._b2keys = SB._b2keys || {};
  var K = SB._b2keys;

  function hero() { return SB.engine.hero; }

  function damagePed(rec, dmg) {
    var ud = rec.mesh.userData;
    if (ud.hp === undefined) ud.hp = ud.cop ? 100 : 50;
    ud.hp -= dmg;
    if (ud.hp > 0) return;
    ud.hp = 0;
    if (ud.boss === true) {
      var bs = SB.police ? SB.police.bosses : [];
      for (var i = 0; i < bs.length; i++) {
        if (bs[i].mesh === rec.mesh && !bs[i]._counted) {
          bs[i]._counted = true; bs[i].alive = false;
          bs[i].mesh.visible = false;
          if (bs[i].marker) bs[i].marker.visible = false;
          if (SB.missions && SB.missions.standoffDown) SB.missions.standoffDown();
        }
      }
      return;
    }
    if (ud.cop === true) {
      var cs = SB.police ? SB.police.cops : [];
      for (var j = 0; j < cs.length; j++) {
        if (cs[j].mesh === rec.mesh) { cs[j].alive = false; cs[j].bustT = 0; }
      }
      rec.active = false; rec.mesh.visible = false;
      if (SB.police) SB.police.addHeat(12);
      return;
    }
    rec.active = false; rec.mesh.visible = false;
    if (SB.police) SB.police.addHeat(4);
  }

  var P = SB.player = {
    cash: 500, rep: 0, hp: 100, armor: 0, onFoot: false,
    weapon: 1, weapons: WEAPONS, keys: K,
    mesh: SB.city.heroChar, flashT: 0, _cd: 0, _dead: false, bossPeds: [],
    addCash: function (n) { P.cash += n; return P.cash; },
    addRep: function (n) { P.rep += n; return P.rep; },
    heal: function (n) { P.hp = Math.min(100, P.hp + n); return P.hp; },
    addArmor: function (n) { P.armor = Math.min(100, P.armor + n); return P.armor; },
    damage: function (n) {
      if (P._dead) return P.hp;
      var ab = Math.min(P.armor, n * 0.6);
      P.armor -= ab; P.hp -= (n - ab);
      if (P.hp <= 0) { P.hp = 0; P._dead = true; if (SB.police) SB.police.wasted(); }
      return P.hp;
    },
    respawn: function () {
      var h = hero();
      h.pos.set(-48, 0, 48); h.heading = 0; h.mode = 'foot'; h.speedKmh = 0;
      SB.state.mode = 'foot'; SB.state.speedKmh = 0;
      P.hp = 100; P.onFoot = true; P._dead = false; P._cd = 0;
      SB.city.placeHero(h);
      return true;
    },
    setWeapon: function (n) {
      var w = WEAPONS[n - 1];
      if (!w || w.locked) return false;
      P.weapon = n; return true;
    },
    reload: function () {
      var w = WEAPONS[P.weapon - 1];
      if (!w || !w.magSize) return false;
      var need = w.magSize - w.mag;
      if (need <= 0 || w.reserve <= 0) return false;
      var take = Math.min(need, w.reserve);
      w.mag += take; w.ammo = w.mag; w.reserve -= take; return true;
    },
    showPed: function (ped) { var m = ped && (ped.mesh || ped); if (m) m.visible = true; return !!m; },
    hidePed: function (ped) { var m = ped && (ped.mesh || ped); if (m) m.visible = false; return !!m; },
    fire: function () {
      if (P._dead || SB.state.paused) return false;
      var w = WEAPONS[P.weapon - 1];
      if (!w || w.locked) return false;
      var now = SB.engine.simTime;
      if (now < P._cd) return false;
      if (w.magSize > 0) { if (w.mag <= 0) return false; w.mag--; w.ammo = w.mag; }
      P._cd = now + w.cd;
      var h = hero();
      if (w.name !== 'FISTS') {
        var mp = SB.engine.muzzlePos();
        SB.city.burst(mp.x, mp.y, mp.z, { n: 10, color: 0xffcc66, flash: true });
        P.flashT = 0.32;
      }
      var fx = -Math.sin(h.heading), fz = -Math.cos(h.heading);
      var best = null, bd = 1e9;
      function consider(px, pz, rec) {
        var dx = px - h.pos.x, dz = pz - h.pos.z, d = Math.sqrt(dx * dx + dz * dz);
        if (d > w.range || d < 0.01) return;
        if ((dx * fx + dz * fz) / d < 0.8) return;
        if (d < bd) { bd = d; best = rec; }
      }
      var peds = SB.city.peds;
      for (var i = 0; i < peds.length; i++) {
        var r = peds[i];
        if (!r.active || !r.mesh.visible) continue;
        var hp = r.mesh.userData.hp;
        if (hp !== undefined && hp <= 0) continue;
        consider(r.mesh.position.x, r.mesh.position.z, r);
      }
      var bs = SB.police ? SB.police.bosses : [];
      for (var j = 0; j < bs.length; j++) {
        if (bs[j].alive && bs[j].mesh.visible) consider(bs[j].mesh.position.x, bs[j].mesh.position.z, bs[j]);
      }
      if (best) damagePed(best, w.dmg);
      return true;
    },
    enterCar: function () {
      if (!P.onFoot || P._dead) return false;
      var h = hero();
      var rec = SB.vehicles ? SB.vehicles.nearest(h.pos.x, h.pos.z, 4.5) : null;
      if (!rec) return false;
      if (rec !== SB.vehicles.hero) SB.vehicles.steal(rec);
      h.mode = 'car'; SB.state.mode = 'car'; P.onFoot = false;
      SB.engine.setSpeedKmh(0);
      SB.city.placeHero(h);
      return true;
    },
    exitCar: function () {
      if (P.onFoot) return false;
      var h = hero();
      h.mode = 'foot'; SB.state.mode = 'foot'; P.onFoot = true;
      SB.engine.setSpeedKmh(0);
      h.pos.x += Math.cos(h.heading) * 2.2;
      h.pos.z += -Math.sin(h.heading) * 2.2;
      SB.city.placeHero(h);
      return true;
    },
    simTick: function (dt) {
      if (P.flashT > 0) P.flashT -= dt;
      if (P._dead) return;
      P.mesh = P.onFoot ? SB.city.heroChar : SB.city.heroCar;
      if (!P.onFoot) return;
      var h = hero();
      if (K.KeyA || K.ArrowLeft) h.heading += 2.4 * dt;
      if (K.KeyD || K.ArrowRight) h.heading -= 2.4 * dt;
      var mv = 0;
      if (K.KeyW || K.ArrowUp) mv += 1;
      if (K.KeyS || K.ArrowDown) mv -= 0.6;
      var run = K.ShiftLeft || K.ShiftRight;
      // Engine only carries the hero in car mode: translate on foot directly.
      var sp = mv * (run ? 6.5 : 3.2);
      if (sp !== 0) {
        h.pos.x += -Math.sin(h.heading) * sp * dt;
        h.pos.z += -Math.cos(h.heading) * sp * dt;
      }
      var kmh = mv === 0 ? 0 : mv * (run ? 23.4 : 11.5);
      if (kmh !== h.speedKmh) SB.engine.setSpeedKmh(kmh);
      h.pos.x = Math.max(-168, Math.min(168, h.pos.x));
      h.pos.z = Math.max(-168, Math.min(168, h.pos.z));
    }
  };
  Object.defineProperty(P, 'health', {
    get: function () { return P.hp; },
    set: function (v) { P.hp = v; }
  });
  Object.defineProperty(P, 'pos', { get: function () { return hero().pos; } });
  Object.defineProperty(P, 'heading', {
    get: function () { return hero().heading; },
    set: function (v) { hero().heading = v; }
  });

  if (!SB._b2keysBound) {
    SB._b2keysBound = true;
    window.addEventListener('keydown', function (e) {
      K[e.code] = true;
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') e.preventDefault();
      if (e.repeat || SB.state.paused) return;
      if (e.code === 'KeyR') P.reload();
      else if (e.code === 'Digit1') P.setWeapon(1);
      else if (e.code === 'Digit2') P.setWeapon(2);
      else if (e.code === 'Digit3') P.setWeapon(3);
      else if (e.code === 'Digit4') P.setWeapon(4);
      else if (e.code === 'Digit5') P.setWeapon(5);
      else if (e.code === 'KeyE' || e.code === 'Enter') {
        if (P.onFoot) P.enterCar(); else P.exitCar();
      }
    });
    window.addEventListener('keyup', function (e) { K[e.code] = false; });
  }

  // Wrap engine.step once: run B2 tick after a simulated step.
  function b2Tick(dt) {
    P.simTick(dt);
    if (SB.vehicles && SB.vehicles.update) SB.vehicles.update(dt);
    if (SB.police && SB.police.update) SB.police.update(dt);
  }
  if (!SB._b2step) {
    SB._b2step = true;
    var _step = SB.engine.step;
    SB.engine.step = function (dt, noRender) {
      var f0 = SB.engine.frame;
      var r = _step.call(SB.engine, dt, noRender);
      if (SB.engine.frame !== f0) b2Tick(dt);
      return r;
    };
  }

  // Wrap advanceSim once: missions.update once per newly simulated step.
  if (!SB._b2adv) {
    SB._b2adv = true;
    SB._b2advN = SB._b2advN || 0;
    var _adv = SB.engine.advanceSim;
    SB.engine.advanceSim = function (n, dt) {
      dt = dt || 1 / 60;
      var f0 = SB.engine.frame;
      var r = _adv.call(SB.engine, n, dt);
      var f1 = SB.engine.frame;
      if (SB.missions && SB.missions.update) {
        for (var f = f0 + 1; f <= f1; f++) {
          if (SB._b2advN < f) { SB._b2advN = f; SB.missions.update(dt); }
        }
      }
      return r;
    };
  }

  // Chain setPreset: sync on-foot state + reset ped HP for a fresh preset.
  var _sp = SB.engine.setPreset;
  SB.engine.setPreset = function (name) {
    var r = _sp.call(SB.engine, name);
    P.onFoot = (hero().mode === 'foot');
    P._dead = false; P._cd = 0; P.flashT = 0;
    P.mesh = P.onFoot ? SB.city.heroChar : SB.city.heroCar;
    var peds = SB.city.peds;
    for (var i = 0; i < peds.length; i++) {
      peds[i].mesh.userData.hp = peds[i].mesh.userData.cop ? 100 : 50;
    }
    return r;
  };
})();
