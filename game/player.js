// game/player.js — SB.player: hero on foot, entering/exiting cars, weapons & combat.
// Fresh write for rebuild r13, from API.md section 5. No code copied from earlier rounds.
(function () {
  'use strict';
  var SB = window.SB = window.SB || {};

  // ---- deterministic RNG fallback (engine.js normally defines SB.rand* first) ----
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  if (typeof SB.rng !== 'function') {
    SB.rng = mulberry32;
    SB.rand = mulberry32(1337);
    SB.rngReset = function () { SB.rand = mulberry32(1337); };
    SB.randRange = function (a, b) { return a + SB.rand() * (b - a); };
    SB.randInt = function (a, b) { return Math.floor(SB.randRange(a, b + 1)); };
    SB.randPick = function (arr) { return arr[Math.floor(SB.rand() * arr.length)]; };
  }

  var P = SB.player = SB.player || {};

  // ---- public state (API.md section 0 + 5) ----
  P.cash = 500;            // ledger: player cash (HUD shows max of the 3 ledgers)
  P.health = 100;          // health bar (HUD)
  P.armor = 0;             // armor bar (HUD)
  P.weapon = 1;            // 1=fists, 2=pistol, 3=SMG, 4=shotgun, 5=rifle (locked)
  P.hero = null;           // THREE.Group mesh of the on-foot hero

  // ---- private state ----
  P._heading = Math.PI;    // facing angle; forward = (sin h, 0, cos h). PI = facing -z.
  P._keys = {};            // currently held keys, by e.code
  P._mouseFire = false;    // mouse button held on the game canvas
  P._nextShotAt = 0;       // simTime when the next shot is allowed
  P._reloadingUntil = 0;   // simTime until reload finishes (0 = not reloading)
  P._magSize = { 2: 12, 3: 30, 4: 6 };
  P._ammo = { 2: 12, 3: 30, 4: 6 };
  P._lastCrime = -1000;    // simTime of the last crime (drives heat decay)
  P._limbs = null;         // { legL, legR, armL, armR } pivot groups for walk anim
  P._hitCooldownUntil = 0; // simTime until traffic can hurt the hero again

  var WEAPONS = {
    1: { name: 'FISTS',   range: 2.2, damage: 30, rate: 0.40, pellets: 1 },
    2: { name: 'PISTOL',  range: 70,  damage: 34, rate: 0.35, pellets: 1 },
    3: { name: 'SMG',     range: 55,  damage: 18, rate: 0.12, pellets: 1 },
    4: { name: 'SHOTGUN', range: 28,  damage: 22, rate: 0.80, pellets: 5 }
  };

  function simNow() {
    return (SB.state && typeof SB.state.simTime === 'number') ? SB.state.simTime : 0;
  }
  function groundY(x, z) {
    return (SB.city && typeof SB.city.groundAt === 'function') ? SB.city.groundAt(x, z) : 0;
  }
  function scene() {
    return (SB.engine && SB.engine.scene) || null;
  }
  function lambert(color) {
    return new THREE.MeshLambertMaterial({ color: color });
  }

  // ---- hero mesh (stylised pedestrian: jacket, dark trousers, cap) ----
  function makeHeroMesh() {
    var g = new THREE.Group();
    var skin = lambert(0xd9a066);
    var jacket = lambert(0x2e7f6f);   // teal jacket
    var pants = lambert(0x232c3d);    // dark navy trousers
    var cap = lambert(0x8a2f2f);      // rust-red cap
    var shoe = lambert(0x1a1a1a);

    var legL = new THREE.Group(); legL.position.set(-0.11, 0.52, 0);
    var legR = new THREE.Group(); legR.position.set(0.11, 0.52, 0);
    var shinL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.18), pants);
    shinL.position.y = -0.25; legL.add(shinL);
    var shinR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.18), pants);
    shinR.position.y = -0.25; legR.add(shinR);
    var shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.09, 0.3), shoe);
    shoeL.position.set(0, -0.48, 0.05); legL.add(shoeL);
    var shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.09, 0.3), shoe);
    shoeR.position.set(0, -0.48, 0.05); legR.add(shoeR);

    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 0.3), jacket);
    torso.position.y = 0.85;
    var armL = new THREE.Group(); armL.position.set(-0.34, 1.12, 0);
    var armR = new THREE.Group(); armR.position.set(0.34, 1.12, 0);
    var armLm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.56, 0.16), jacket);
    armLm.position.y = -0.26; armL.add(armLm);
    var armRm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.56, 0.16), jacket);
    armRm.position.y = -0.26; armR.add(armRm);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), skin);
    head.position.y = 1.34;
    var hat = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.34), cap);
    hat.position.y = 1.52;
    var brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.16), cap);
    brim.position.set(0, 1.48, 0.22);

    g.add(legL); g.add(legR); g.add(torso);
    g.add(armL); g.add(armR); g.add(head); g.add(hat); g.add(brim);
    g.userData.isHero = true;
    P._limbs = { legL: legL, legR: legR, armL: armL, armR: armR };
    return g;
  }

  P._ensureHero = function () {
    if (P.hero) return P.hero;
    var sc = scene();
    if (!sc) return null;
    P.hero = makeHeroMesh();
    P.hero.position.set(0, groundY(0, 40), 40);
    P.hero.rotation.y = P._heading;
    sc.add(P.hero);
    return P.hero;
  };

  // Place the hero (on foot) at x,z facing heading (radians).
  P._placeAt = function (x, z, heading) {
    var h = P._ensureHero();
    if (!h) return;
    if (typeof heading === 'number') P._heading = heading;
    h.position.set(x, groundY(x, z), z);
    h.rotation.y = P._heading;
    h.visible = true;
  };

  // Current controlled position: vehicle if driving, hero if on foot.
  P.pos = function () {
    var V = SB.vehicles;
    if (V && V.active && V.active.mesh) {
      return [V.active.mesh.position.x, V.active.mesh.position.z];
    }
    if (P.hero) return [P.hero.position.x, P.hero.position.z];
    return [0, 40];
  };

  P.onFoot = function () {
    return !SB.vehicles || !SB.vehicles.active;
  };

  P.enterVehicle = function (v) {
    if (!v || !v.mesh) return false;
    var V = SB.vehicles;
    if (!V) return false;
    V.active = v;
    if (v.mesh.userData) v.mesh.userData.speed = v.mesh.userData.speed || 0;
    if (P.hero) P.hero.visible = false;
    if (SB.state) {
      SB.state.vehicleName = v.name || 'Car';
      SB.state.vehicleCond = (typeof v.cond === 'number') ? v.cond : 100;
      SB.state.vehicleStatus = (SB.state.vehicleCond >= 70) ? 'OK' : 'DENTED';
      SB.state.speedKmh = 0;
    }
    return true;
  };

  P.exitVehicle = function () {
    var V = SB.vehicles;
    if (!V || !V.active || !V.active.mesh) return false;
    var m = V.active.mesh;
    var hx = m.position.x + Math.cos(m.rotation.y) * 2.0;
    var hz = m.position.z - Math.sin(m.rotation.y) * 2.0;
    V.active = null;
    P._placeAt(hx, hz, P._heading);
    if (SB.state) {
      SB.state.vehicleName = '—';
      SB.state.vehicleCond = 100;
      SB.state.vehicleStatus = 'OK';
      SB.state.speedKmh = 0;
    }
    return true;
  };

  // Damage the player; at 0 health the police bust the player (see police.js).
  P.damage = function (n) {
    if (typeof n !== 'number' || n <= 0) return P.health;
    var rest = n;
    if (P.armor > 0) {
      var absorbed = Math.min(P.armor, rest);
      P.armor -= absorbed; rest -= absorbed;
    }
    P.health -= rest;
    if (P.health <= 0) {
      P.health = 0;
      if (SB.police && typeof SB.police.busted === 'function') SB.police.busted();
    }
    return P.health;
  };
  // Probe helper: the blind-judge probe calls damage(n) to force a BUSTED test.
  window.damage = function (n) { return P.damage(n); };

  // ---- combat ----
  function damageableTargets() {
    var out = [];
    var i, t;
    if (SB.police && SB.police.cops) {
      for (i = 0; i < SB.police.cops.length; i++) {
        t = SB.police.cops[i];
        if (t && t.userData && !t.userData.dead) out.push(t);
      }
    }
    if (SB.missions && SB.missions.targets) {
      for (i = 0; i < SB.missions.targets.length; i++) {
        t = SB.missions.targets[i];
        if (t && t.userData && !t.userData.dead) out.push(t);
      }
    }
    if (SB.city && SB.city.peds) {
      for (i = 0; i < SB.city.peds.length; i++) {
        t = SB.city.peds[i];
        // Ambient peds are not damageable; only flagged boss/enforcer peds are.
        if (t && t.userData && !t.userData.dead &&
            (t.userData.boss || t.userData.enforcer)) out.push(t);
      }
    }
    return out;
  }

  function killTarget(t) {
    if (!t || !t.userData) return;
    t.userData.dead = true;
    t.userData.hp = 0;
    // Fall over flat.
    t.rotation.x = -Math.PI / 2;
    t.position.y = Math.max(0.15, t.position.y);
    P._lastCrime = simNow();
    if (t.userData.boss && SB.missions && typeof SB.missions.standoffDown === 'function') {
      try { SB.missions.standoffDown(); } catch (e) {}
    }
    if (SB.police && typeof SB.police.setStars === 'function') {
      var s = SB.police.stars();
      if (s < 5) SB.police.setStars(s + 1);
    }
  }

  P.fire = function () {
    if (!P.onFoot()) return false; // no drive-by shooting
    var now = simNow();
    if (now < P._nextShotAt || now < P._reloadingUntil) return false;
    var w = WEAPONS[P.weapon] || WEAPONS[1];
    if (P.weapon !== 1) {
      if ((P._ammo[P.weapon] || 0) <= 0) {
        P._reloadingUntil = now + 1.1; // empty mag: auto reload
        return false;
      }
      P._ammo[P.weapon] -= 1;
    }
    P._nextShotAt = now + w.rate;
    var pos = P.pos();
    var fx = Math.sin(P._heading), fz = Math.cos(P._heading);
    var mx = pos[0] + fx * 0.7, mz = pos[1] + fz * 0.7, my = 1.45;
    if (SB.engine && SB.engine.muzzlePos && typeof SB.engine.muzzlePos.set === 'function') {
      SB.engine.muzzlePos.set(mx, my, mz);
    }
    if (SB.engine && typeof SB.engine.burst === 'function') {
      try { SB.engine.burst(mx, my, mz, w.pellets); } catch (e) {}
    }
    // Nearest damageable target inside the firing cone.
    var best = null, bestD = 1e9;
    var targets = damageableTargets();
    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      var dx = t.position.x - pos[0], dz = t.position.z - pos[1];
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d > w.range || d < 0.01) continue;
      var dot = (dx * fx + dz * fz) / d;
      if (dot < 0.85) continue; // must be roughly in front
      if (d < bestD) { bestD = d; best = t; }
    }
    if (best) {
      var hp = (typeof best.userData.hp === 'number') ? best.userData.hp : 100;
      hp -= w.damage * w.pellets;
      best.userData.hp = hp;
      if (hp <= 0) killTarget(best);
    }
    return true;
  };

  P.reload = function () {
    if (P.weapon === 1) return;
    var now = simNow();
    if (now < P._reloadingUntil) return;
    P._reloadingUntil = now + 1.1;
    P._ammo[P.weapon] = P._magSize[P.weapon];
  };

  // ---- per-tick movement (called from the step wrap) ----
  P._tick = function (dt) {
    if (!dt || dt <= 0) return;
    var h = P._ensureHero();
    var k = P._keys;
    var now = simNow();

    if (P.onFoot() && h) {
      var fwd = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
      var turn = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
      P._heading -= turn * 3.5 * dt;
      var speed = fwd * 6; // on-foot top speed 6 m/s
      var nx = h.position.x + Math.sin(P._heading) * speed * dt;
      var nz = h.position.z + Math.cos(P._heading) * speed * dt;
      h.position.set(nx, groundY(nx, nz), nz);
      h.rotation.y = P._heading;
      // Walk-cycle swing, driven purely by simTime (deterministic).
      var swing = (fwd !== 0) ? Math.sin(now * 9) * 0.55 : 0;
      if (P._limbs) {
        P._limbs.legL.rotation.x = swing;
        P._limbs.legR.rotation.x = -swing;
        P._limbs.armL.rotation.x = -swing * 0.8;
        P._limbs.armR.rotation.x = swing * 0.8;
      }
      // Traffic can knock the hero down: small damage with a 1s cooldown.
      if (SB.vehicles && SB.vehicles.list && now >= P._hitCooldownUntil) {
        var pos = [h.position.x, h.position.z];
        for (var i = 0; i < SB.vehicles.list.length; i++) {
          var cm = SB.vehicles.list[i].mesh;
          if (!cm) continue;
          var dx = cm.position.x - pos[0], dz = cm.position.z - pos[1];
          if (dx * dx + dz * dz < 1.44) {
            P._hitCooldownUntil = now + 1.0;
            P.damage(5);
            break;
          }
        }
      }
    }
    // Fire while held (Space or mouse button on the canvas).
    if ((k.Space || P._mouseFire) && P.onFoot()) P.fire();
  };

  // ---- input ----
  function keyCode(e) {
    if (e.code) return e.code;
    var m = { w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', e: 'KeyE', r: 'KeyR', ' ': 'Space' };
    if (typeof e.key === 'string') {
      var kl = e.key.toLowerCase();
      if (m[kl]) return m[kl];
      if (/^[1-4]$/.test(e.key)) return 'Digit' + e.key;
      if (e.key === 'ArrowUp') return 'ArrowUp';
      if (e.key === 'ArrowDown') return 'ArrowDown';
      if (e.key === 'ArrowLeft') return 'ArrowLeft';
      if (e.key === 'ArrowRight') return 'ArrowRight';
    }
    return '';
  }
  window.addEventListener('keydown', function (e) {
    var c = keyCode(e);
    if (!c) return;
    if (c === 'Space' || c.indexOf('Arrow') === 0) {
      if (e.preventDefault) e.preventDefault();
    }
    if (e.repeat) { P._keys[c] = true; return; }
    P._keys[c] = true;
    if (c === 'KeyE') {
      if (P.onFoot()) {
        // Enter the nearest vehicle within 4 m.
        var V = SB.vehicles, best = null, bestD = 16;
        if (V && V.list) {
          var pos = P.pos();
          for (var i = 0; i < V.list.length; i++) {
            var m = V.list[i].mesh;
            if (!m) continue;
            var dx = m.position.x - pos[0], dz = m.position.z - pos[1];
            var d2 = dx * dx + dz * dz;
            if (d2 < bestD) { bestD = d2; best = V.list[i]; }
          }
        }
        if (best) { P.enterVehicle(best); P._lastCrime = simNow(); }
      } else {
        P.exitVehicle();
      }
    } else if (c === 'Digit1' || c === 'Digit2' || c === 'Digit3' || c === 'Digit4') {
      P.weapon = parseInt(c.slice(5), 10);
    } else if (c === 'KeyR') {
      P.reload();
    }
  });
  window.addEventListener('keyup', function (e) {
    var c = keyCode(e);
    if (c) P._keys[c] = false;
  });
  window.addEventListener('mousedown', function (e) {
    if (SB.engine && SB.engine.canvas && e.target === SB.engine.canvas) P._mouseFire = true;
  });
  window.addEventListener('mouseup', function () { P._mouseFire = false; });
  window.addEventListener('blur', function () { P._keys = {}; P._mouseFire = false; });

  // ---- wrap SB.engine.step ONCE: add input + combat tick (guard SB._b2step) ----
  P._installStepWrap = function () {
    if (SB._b2step) return true;
    if (!SB.engine || typeof SB.engine.step !== 'function') return false;
    SB._b2step = true;
    var origStep = SB.engine.step;
    SB.engine.step = function (dt) {
      var d = (typeof dt === 'number' && dt > 0) ? dt : 0;
      try { P._tick(d); } catch (e) {}
      try {
        if (SB.vehicles && typeof SB.vehicles._tick === 'function') SB.vehicles._tick(d);
      } catch (e) {}
      return origStep.call(SB.engine, dt);
    };
    return true;
  };

  // ---- wrap SB.engine.setPreset ONCE: per-preset placement (guard SB._b2preset) ----
  P._installPresetWrap = function () {
    if (SB._b2preset) return true;
    if (!SB.engine || typeof SB.engine.setPreset !== 'function') return false;
    SB._b2preset = true;
    var origPreset = SB.engine.setPreset;
    SB.engine.setPreset = function (name, opts) {
      var out = origPreset.call(SB.engine, name, opts);
      try {
        var V = SB.vehicles, PL = SB.police;
        if (V && typeof V._onPreset === 'function') V._onPreset(name);
        if (PL && typeof PL._onPreset === 'function') PL._onPreset(name);
        P._onPreset(name);
      } catch (e) {}
      return out;
    };
    return true;
  };

  // Hero placement per preset (runs after vehicles + police hooks).
  P._onPreset = function (name) {
    P._ensureHero();
    if (name === 'cover' || name === 'drive') {
      var V = SB.vehicles;
      if (V && V.pinkCar) {
        P.enterVehicle(V.pinkCar);
      } else {
        P._placeAt(0, 0, Math.PI);
      }
    } else if (name === 'onfoot') {
      if (!P.onFoot()) P.exitVehicle();
      P._placeAt(0, 40, Math.PI);
    } else if (name === 'mission') {
      if (!P.onFoot()) P.exitVehicle();
      P._placeAt(2, 10, Math.PI);
    } else if (name === 'free') {
      if (!P.onFoot()) P.exitVehicle();
      P._placeAt(0, 40, Math.PI);
    }
    // 'map': leave the hero where it is.
  };

  // Install wraps now; retry briefly if engine.js has not loaded yet.
  P._installStepWrap();
  P._installPresetWrap();
  if (!SB._b2step || !SB._b2preset) {
    var _tries = 0;
    var _iv = setInterval(function () {
      P._installStepWrap();
      P._installPresetWrap();
      _tries += 1;
      if ((SB._b2step && SB._b2preset) || _tries > 50) clearInterval(_iv);
    }, 100);
  }
})();
