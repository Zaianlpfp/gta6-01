// game/police.js — SB.police: wanted stars, pursuit units, helicopter + spotlight, BUSTED.
// Fresh write for rebuild r13, from API.md section 7. No code copied from earlier rounds.
(function () {
  'use strict';
  var SB = window.SB = window.SB || {};

  // ---- in-city guard (r12 lesson: NEVER respawn to the (-150,250) void) ----
  // City envelope: x [-140, 215], z [-90, 185].
  SB._inCity = function (x, z) {
    return x >= -140 && x <= 215 && z >= -90 && z <= 185;
  };

  var PL = SB.police = SB.police || {};
  PL._stars = 0;                 // authoritative wanted level 0-5 (SB.state.heat mirrors it)
  PL.response = [];              // [{ name, dist, status }] units responding (HUD reads this)
  PL.heli = null;                // helicopter THREE.Group (AIR-1 / GULL-1)
  PL._cone = null;               // spotlight cone mesh from SB.engine.spotCone()
  PL.cops = [];                  // foot cops (THREE.Group meshes with userData.hp/isCop)
  PL.cruisers = [];              // pursuit cars (entries in SB.vehicles.list)
  PL._heatTimer = 0;             // simTime when the next heat decay may happen
  PL._copSpawnAt = 0;            // simTime when cops may next be (re)spawned

  var CRUISER_NAMES = ['MARLIN-11', 'SNAPPER-25', 'TARPON-18'];
  var HELI_HEIGHT = 36;          // cone height from the engine (radius 5, height 36)
  var HELI_ORBIT_R = 24;         // heli orbit radius around the hero
  var CHASE_SPEED = 18;          // cruiser pursuit speed (m/s)

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
  function heroPos() {
    if (SB.player && typeof SB.player.pos === 'function') return SB.player.pos();
    if (SB.engine && typeof SB.engine.heroPos === 'function') return SB.engine.heroPos();
    return [0, 40];
  }

  // ---- wanted level (authoritative; SB.state.heat is the mirror) ----
  PL.stars = function () {
    return PL._stars;
  };
  PL.setStars = function (n) {
    var v = Math.max(0, Math.min(5, Math.floor(n) || 0));
    PL._stars = v;
    if (SB.state) SB.state.heat = v;
    PL._heatTimer = simNow() + 30; // no decay for the next 30 s of sim time
    return v;
  };

  // ---- helicopter mesh: white body + red stripe, tail, spinning rotor, lights ----
  // Built as a real helicopter, NOT a black block silhouette.
  function makeHeliMesh() {
    var g = new THREE.Group();
    var white = lambert(0xf2f4f6);
    var red = lambert(0xc22a2a);
    var dark = lambert(0x1c2733);
    var glass = lambert(0x9fc4d8);

    var body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 3.6), white);
    body.position.y = 0;
    var nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.1, 1.0), glass);
    nose.position.set(0, -0.1, 2.1);
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.28, 3.62), red);
    stripe.position.y = -0.35;
    var tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.2), white);
    tail.position.set(0, 0.25, -3.6);
    var fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.9), red);
    fin.position.set(0, 0.8, -5.4);
    var tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.3), dark);
    tailRotor.position.set(0.32, 0.5, -5.5);

    // Main rotor: long thin blades on a mast; spun from simTime in update().
    var rotor = new THREE.Group();
    rotor.position.y = 1.0;
    var blade = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.07, 0.45), dark);
    rotor.add(blade);
    var blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.07, 9.0), dark);
    rotor.add(blade2);
    var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.5, 8), dark);
    mast.position.y = 0.8;

    // Skids.
    var skidL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.4), dark);
    skidL.position.set(-0.85, -1.0, 0.3);
    var skidR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.4), dark);
    skidR.position.set(0.85, -1.0, 0.3);

    // Navigation lights: red (port), green (starboard), white strobe (tail).
    var navR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    navR.position.set(-1.15, 0, 0.5);
    var navG = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x22ff66 }));
    navG.position.set(1.15, 0, 0.5);
    var strobe = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    strobe.position.set(0, 0.2, -5.8);

    g.add(body); g.add(nose); g.add(stripe); g.add(tail); g.add(fin);
    g.add(tailRotor); g.add(rotor); g.add(mast);
    g.add(skidL); g.add(skidR); g.add(navR); g.add(navG); g.add(strobe);
    g.userData.rotor = rotor;
    g.userData.tailRotor = tailRotor;
    g.userData.isHeli = true;
    return g;
  }

  PL._ensureHeli = function () {
    if (PL.heli) return PL.heli;
    var sc = scene();
    if (!sc) return null;
    PL.heli = makeHeliMesh();
    PL.heli.visible = false;
    sc.add(PL.heli);
    // Spotlight cone from the engine (opacity 0.10 — never change it).
    if (SB.engine && typeof SB.engine.spotCone === 'function') {
      try {
        PL._cone = SB.engine.spotCone();
        PL._cone.visible = false;
        sc.add(PL._cone);
      } catch (e) { PL._cone = null; }
    }
    return PL.heli;
  };

  // ---- police cruiser (white body, black hood, roof light bar) ----
  function makeCruiserMesh() {
    var g = new THREE.Group();
    var white = lambert(0xf2f4f6);
    var black = lambert(0x14181d);
    var glass = lambert(0x101820);
    var tyre = lambert(0x111111);

    var body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 4.2), white);
    body.position.y = 0.55;
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.1), white);
    cabin.position.set(0, 1.05, -0.25);
    var hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 1.2), black);
    hood.position.set(0, 0.86, 1.4);
    var windshield = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.42, 0.08), glass);
    windshield.position.set(0, 1.02, 0.82);
    windshield.rotation.x = -0.35;

    // Roof light bar: red left, blue right.
    var barBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.3), black);
    barBase.position.set(0, 1.36, -0.25);
    var barR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.32),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    barR.position.set(-0.28, 1.38, -0.25);
    var barB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.32),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    barB.position.set(0.28, 1.38, -0.25);

    g.add(body); g.add(cabin); g.add(hood); g.add(windshield);
    g.add(barBase); g.add(barR); g.add(barB);

    var wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12);
    var wpos = [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]];
    for (var i = 0; i < 4; i++) {
      var w = new THREE.Mesh(wheelGeo, tyre);
      w.rotation.z = Math.PI / 2;
      w.position.set(wpos[i][0], 0.34, wpos[i][1]);
      g.add(w);
    }
    g.userData.speed = 0;
    g.userData.heading = Math.PI;
    g.userData.isCruiser = true;
    return g;
  }

  PL._spawnCruiser = function (name, x, z) {
    var sc = scene();
    if (!sc) return null;
    var mesh = makeCruiserMesh();
    mesh.position.set(x, groundY(x, z), z);
    mesh.rotation.y = Math.PI;
    mesh.userData.heading = Math.PI;
    mesh.userData.speed = 0;
    mesh.userData.unitName = name;
    sc.add(mesh);
    var entry = { mesh: mesh, name: name, cond: 100, color: '#f2f4f6', parked: false };
    if (SB.vehicles && SB.vehicles.list) SB.vehicles.list.push(entry);
    PL.cruisers.push(entry);
    return entry;
  };

  // ---- foot cop mesh (navy uniform + cap). userData flags make it killable. ----
  function makeCopMesh() {
    var g = new THREE.Group();
    var navy = lambert(0x1d2f4a);
    var dark = lambert(0x14181d);
    var skin = lambert(0xd9a066);

    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.52, 0.18), navy);
    legL.position.set(-0.11, 0.26, 0);
    var legR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.52, 0.18), navy);
    legR.position.set(0.11, 0.26, 0);
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 0.3), navy);
    torso.position.y = 0.85;
    var vest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.3, 0.32), dark);
    vest.position.y = 0.9;
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.56, 0.16), navy);
    armL.position.set(-0.34, 0.86, 0);
    var armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.56, 0.16), navy);
    armR.position.set(0.34, 0.86, 0);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), skin);
    head.position.y = 1.34;
    var cap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.34), dark);
    cap.position.y = 1.52;

    g.add(legL); g.add(legR); g.add(torso); g.add(vest);
    g.add(armL); g.add(armR); g.add(head); g.add(cap);
    g.userData.hp = 100;
    g.userData.isCop = true;
    g.userData.dead = false;
    return g;
  }

  PL._spawnCops = function (count) {
    var sc = scene();
    if (!sc) return;
    var hp = heroPos();
    var now = simNow();
    if (now < PL._copSpawnAt) return;
    PL._copSpawnAt = now + 5; // at most one spawn wave per 5 s of sim time
    for (var i = 0; i < count; i++) {
      if (PL.cops.length >= 6) return;
      var ang = i * 2.4 + 0.7; // deterministic spread around the hero
      var x = hp[0] + Math.cos(ang) * 18;
      var z = hp[1] + Math.sin(ang) * 18;
      var cop = makeCopMesh();
      cop.position.set(x, groundY(x, z), z);
      cop.userData.spawnAngle = ang;
      sc.add(cop);
      PL.cops.push(cop);
    }
  };

  PL._clearCops = function () {
    var sc = scene();
    for (var i = 0; i < PL.cops.length; i++) {
      if (sc) sc.remove(PL.cops[i]);
    }
    PL.cops = [];
  };

  // ---- per-tick police AI (called ONLY by SB.engine.step) ----
  PL.update = function (dt) {
    if (!dt || dt <= 0) return;
    var now = simNow();
    var hp = heroPos();
    var stars = PL._stars;

    // Heat decay: one star per 30 s of quiet sim time.
    if (stars > 0 && now >= PL._heatTimer) {
      PL.setStars(stars - 1);
      stars = PL._stars;
    }

    // Helicopter: visible at 3+ stars; orbits the hero, rotor spins with simTime.
    var heli = PL._ensureHeli();
    var showHeli = stars >= 3;
    if (heli) {
      heli.visible = showHeli;
      if (showHeli) {
        var ang = now * 0.15 + 0.8; // deterministic orbit from simTime
        var hx = hp[0] + Math.cos(ang) * HELI_ORBIT_R;
        var hz = hp[1] + Math.sin(ang) * HELI_ORBIT_R;
        heli.position.set(hx, HELI_HEIGHT, hz);
        heli.rotation.y = Math.atan2(hp[0] - hx, hp[1] - hz);
        if (heli.userData.rotor) heli.userData.rotor.rotation.y = now * 25;
        if (heli.userData.tailRotor) heli.userData.tailRotor.rotation.z = now * 30;
      }
    }
    // Spotlight cone: vertical beam centred on the hero (apex up at heli height).
    if (PL._cone) {
      PL._cone.visible = showHeli;
      if (showHeli) {
        PL._cone.position.set(hp[0], HELI_HEIGHT / 2, hp[1]);
        PL._cone.rotation.set(0, 0, 0);
      }
    }
    if (SB.state) SB.state.inSight = showHeli && stars >= 4;

    // Cruisers: chase the hero while wanted.
    var i, c, m, ud;
    if (stars > 0) {
      var want = Math.min(stars, 3);
      while (PL.cruisers.length < want) {
        var idx = PL.cruisers.length % CRUISER_NAMES.length;
        var sx = hp[0] + 30 + PL.cruisers.length * 12;
        var sz = hp[1] + 20;
        PL._spawnCruiser(CRUISER_NAMES[idx], sx, sz);
      }
    }
    for (i = 0; i < PL.cruisers.length; i++) {
      c = PL.cruisers[i]; m = c.mesh; ud = m.userData;
      if (stars === 0) { ud.speed = 0; continue; }
      var dx = hp[0] - m.position.x, dz = hp[1] - m.position.z;
      var dist = Math.sqrt(dx * dx + dz * dz) || 0.01;
      var wantHeading = Math.atan2(dx, dz);
      var dh = wantHeading - ud.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      ud.heading += Math.max(-2.5 * dt, Math.min(2.5 * dt, dh));
      var target = (dist > 10) ? CHASE_SPEED : 6;
      ud.speed += (target - ud.speed) * Math.min(1, dt * 1.5);
      m.position.x += Math.sin(ud.heading) * ud.speed * dt;
      m.position.z += Math.cos(ud.heading) * ud.speed * dt;
      m.position.y = groundY(m.position.x, m.position.z);
      m.rotation.y = ud.heading;
    }

    // Foot cops: spawn at 2+ stars, walk toward the hero, stop at 2 m.
    if (stars >= 2) {
      var alive = 0;
      for (i = 0; i < PL.cops.length; i++) {
        if (!PL.cops[i].userData.dead) alive += 1;
      }
      if (alive < Math.min(stars, 4)) PL._spawnCops(1);
      for (i = 0; i < PL.cops.length; i++) {
        var cop = PL.cops[i];
        if (cop.userData.dead) continue;
        var cx = hp[0] - cop.position.x, cz = hp[1] - cop.position.z;
        var cd = Math.sqrt(cx * cx + cz * cz) || 0.01;
        if (cd > 2) {
          var step = Math.min(cd - 2, 3.2 * dt);
          cop.position.x += (cx / cd) * step;
          cop.position.z += (cz / cd) * step;
          cop.position.y = groundY(cop.position.x, cop.position.z);
          cop.rotation.y = Math.atan2(cx, cz);
        }
      }
    } else if (PL.cops.length) {
      PL._clearCops();
    }

    // Response list for the HUD (rebuilt in place each tick).
    PL.response.length = 0;
    if (stars > 0) {
      if (showHeli && heli) {
        var hdx = hp[0] - heli.position.x, hdz = hp[1] - heli.position.z;
        PL.response.push({
          name: 'GULL-1',
          dist: Math.round(Math.sqrt(hdx * hdx + hdz * hdz)),
          status: 'SPOTLIGHT'
        });
      }
      for (i = 0; i < PL.cruisers.length; i++) {
        c = PL.cruisers[i]; m = c.mesh;
        var cdx = hp[0] - m.position.x, cdz = hp[1] - m.position.z;
        var cdist = Math.sqrt(cdx * cdx + cdz * cdz);
        PL.response.push({
          name: c.name,
          dist: Math.round(cdist),
          status: (cdist < 10) ? 'RAMMING' : 'PURSUIT'
        });
      }
    }
  };

  // ---- BUSTED: hospital fee, heat reset, respawn INSIDE the city ----
  PL.busted = function () {
    // Leave the car first so the hero is on foot at the respawn point.
    if (SB.player && typeof SB.player.exitVehicle === 'function') {
      try { SB.player.exitVehicle(); } catch (e) {}
    }
    // Hospital fee: $50 off the player ledger.
    if (SB.player && typeof SB.player.cash === 'number') {
      SB.player.cash = Math.max(0, SB.player.cash - 50);
    }
    if (SB.player) SB.player.health = 100;
    PL.setStars(0);
    // Hospital only if it is inside the city envelope; otherwise the on-foot
    // spawn (0,40). NEVER fall back to (-150,250) — that is void (r12 lesson).
    var hosp = [0, 40];
    if (SB.city && SB.city.spawnPoints && SB.city.spawnPoints.hospital) {
      var h = SB.city.spawnPoints.hospital;
      if (SB._inCity(h[0], h[1])) hosp = [h[0], h[1]];
    }
    if (SB.player && typeof SB.player._placeAt === 'function') {
      SB.player._placeAt(hosp[0], hosp[1], Math.PI);
    }
    return hosp;
  };

  // ---- per-preset setup (called by the player preset wrap) ----
  PL._onPreset = function (name) {
    PL._ensureHeli();
    // Fresh cruisers per preset: drop the old pursuit, keep the list clean.
    var sc = scene();
    for (var i = 0; i < PL.cruisers.length; i++) {
      if (sc) sc.remove(PL.cruisers[i].mesh);
      if (SB.vehicles && SB.vehicles.list) {
        var li = SB.vehicles.list.indexOf(PL.cruisers[i]);
        if (li >= 0) SB.vehicles.list.splice(li, 1);
      }
    }
    PL.cruisers = [];
    PL._clearCops();
    PL.response.length = 0;

    if (name === 'cover' || name === 'drive') {
      PL.setStars(4);
      // Escort cruisers at the staging offsets (API.md section 4).
      if (SB.city && SB.city.staging && SB.city.staging.coverCruisers) {
        var offs = SB.city.staging.coverCruisers;
        PL._spawnCruiser('MARLIN-11', offs[0][0], offs[0][1]);
        PL._spawnCruiser('SNAPPER-25', offs[1][0], offs[1][1]);
      } else {
        PL._spawnCruiser('MARLIN-11', -5, 4);
        PL._spawnCruiser('SNAPPER-25', 5.5, 6);
      }
    } else if (name === 'onfoot') {
      PL.setStars(2);
    } else if (name === 'mission') {
      PL.setStars(5);
    } else if (name === 'free' || name === 'map') {
      PL.setStars(0);
    }
  };
})();
