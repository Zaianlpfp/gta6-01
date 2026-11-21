// game/vehicles.js — SB.vehicles: cars, traffic, the player's pink car, driving.
// Fresh write for rebuild r13, from API.md section 6. No code copied from earlier rounds.
(function () {
  'use strict';
  var SB = window.SB = window.SB || {};

  var V = SB.vehicles = SB.vehicles || {};
  V.list = V.list || [];       // every car: { mesh, name, cond, color, parked }
  V.active = V.active || null; // car being driven (null = on foot)
  V.pinkCar = V.pinkCar || null;
  V._traffic = V._traffic || []; // traffic cars (subset of list, with road data)

  var MAX_SPEED = 55;    // m/s = 198 km/h (drive probe target ~150+ km/h after a 10 s W-hold)
  var ACCEL = 9;         // m/s^2
  var BRAKE = 14;        // m/s^2
  var REVERSE_MAX = 12;  // m/s
  var TURN_RATE = 1.7;   // rad/s at low speed

  var CAR_COLORS = [0xc0c8d0, 0x2b3a4a, 0x7a1f1f, 0xd8b13a, 0x3a6b3a, 0xe8e8e8, 0x1a1a1a, 0x4a6b8a];
  var CAR_NAMES = ['Comet', 'Bison', 'Prairie', 'Dukes', 'Sentinel', 'Premier',
                   'Buffalo', 'Manana', 'Esperanto', 'Voodoo', 'Stallion', 'Futo'];

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
  function pickColor() {
    if (typeof SB.randPick === 'function') return SB.randPick(CAR_COLORS);
    return CAR_COLORS[0];
  }
  function pickName() {
    if (typeof SB.randPick === 'function') return SB.randPick(CAR_NAMES);
    return CAR_NAMES[0];
  }
  function randRange(a, b) {
    if (typeof SB.randRange === 'function') return SB.randRange(a, b);
    return a;
  }

  // ---- car mesh: body + cabin + 4 wheels + lights (faces +z locally) ----
  function makeCarMesh(color, opts) {
    opts = opts || {};
    var g = new THREE.Group();
    var bodyMat = lambert(color);
    var glassMat = lambert(0x101820);
    var tyreMat = lambert(0x111111);
    var hubMat = lambert(0x9aa2ab);

    var body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 4.2), bodyMat);
    body.position.y = 0.55;
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.1), bodyMat);
    cabin.position.set(0, 1.05, -0.25);
    var windshield = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.42, 0.08), glassMat);
    windshield.position.set(0, 1.02, 0.82);
    windshield.rotation.x = -0.35;
    var rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.42, 0.08), glassMat);
    rearGlass.position.set(0, 1.02, -1.32);
    rearGlass.rotation.x = 0.35;

    g.add(body); g.add(cabin); g.add(windshield); g.add(rearGlass);

    // Wheels: cylinders rotated so the axis is along x.
    var wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12);
    var hubGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.26, 10);
    var wheelPos = [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]];
    for (var i = 0; i < 4; i++) {
      var w = new THREE.Mesh(wheelGeo, tyreMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wheelPos[i][0], 0.34, wheelPos[i][1]);
      var hub = new THREE.Mesh(hubGeo, hubMat);
      hub.rotation.z = Math.PI / 2;
      hub.position.copy(w.position);
      g.add(w); g.add(hub);
    }

    // Headlights (front, +z) and taillights (rear, -z).
    var lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
    var tailMat = new THREE.MeshBasicMaterial({ color: 0xd21f1f });
    var hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), lightMat);
    hl.position.set(-0.62, 0.62, 2.11); g.add(hl);
    var hr = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), lightMat);
    hr.position.set(0.62, 0.62, 2.11); g.add(hr);
    var tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), tailMat);
    tl.position.set(-0.62, 0.62, -2.11); g.add(tl);
    var tr = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), tailMat);
    tr.position.set(0.62, 0.62, -2.11); g.add(tr);

    if (opts.roofSign) {
      var sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.3),
        new THREE.MeshBasicMaterial({ color: 0xffd23e }));
      sign.position.set(0, 1.4, -0.25);
      g.add(sign);
    }
    g.userData.speed = 0;
    g.userData.heading = Math.PI;
    return g;
  }

  function registerCar(mesh, name, cond, color, parked) {
    var entry = { mesh: mesh, name: name, cond: cond, color: color, parked: !!parked };
    V.list.push(entry);
    return entry;
  }

  function removeFromScene(mesh) {
    var sc = scene();
    if (sc && mesh) sc.remove(mesh);
  }

  // ---- the player's pink car ----
  V._ensurePinkCar = function () {
    if (V.pinkCar) return V.pinkCar;
    var sc = scene();
    if (!sc) return null;
    var mesh = makeCarMesh(0xff4fa3); // hot pink
    mesh.position.set(0, groundY(0, 0), 0);
    mesh.rotation.y = Math.PI; // faces -z, away from the cover camera
    mesh.userData.heading = Math.PI;
    mesh.userData.isPink = true;
    sc.add(mesh);
    V.pinkCar = registerCar(mesh, 'Pink Comet', 100, '#ff4fa3', false);
    if (SB.state) SB.state.vehicleName = 'Pink Comet';
    return V.pinkCar;
  };

  // ---- ambient traffic ----
  // Roads come from SB.city.roads ({x0,z0,x1,z1}); fall back to straight lanes.
  function roadList() {
    if (SB.city && SB.city.roads && SB.city.roads.length) return SB.city.roads;
    var lanes = [];
    var xs = [-40, 0, 40, 80];
    for (var i = 0; i < xs.length; i++) {
      lanes.push({ x0: xs[i], z0: -120, x1: xs[i], z1: 160 });
    }
    return lanes;
  }

  V.spawnTraffic = function (n) {
    var sc = scene();
    if (!sc) return V._traffic;
    if (typeof n !== 'number' || n <= 0) n = 24;
    // Clear previous traffic cars first (never duplicate on re-preset).
    for (var i = 0; i < V._traffic.length; i++) {
      var old = V._traffic[i];
      removeFromScene(old.mesh);
      var li = V.list.indexOf(old);
      if (li >= 0) V.list.splice(li, 1);
    }
    V._traffic = [];
    var roads = roadList();
    for (var j = 0; j < n; j++) {
      var road = roads[j % roads.length];
      var t = (typeof SB.rand === 'function') ? SB.rand() : ((j * 0.37) % 1);
      var x = road.x0 + (road.x1 - road.x0) * t;
      var z = road.z0 + (road.z1 - road.z0) * t;
      var dx = road.x1 - road.x0, dz = road.z1 - road.z0;
      var len = Math.sqrt(dx * dx + dz * dz) || 1;
      var dir = ((j % 2) === 0) ? 1 : -1; // alternate directions per lane
      var color = pickColor();
      var mesh = makeCarMesh(color);
      mesh.position.set(x, groundY(x, z), z);
      var heading = Math.atan2(dx * dir, dz * dir);
      mesh.rotation.y = heading;
      mesh.userData.heading = heading;
      mesh.userData.speed = randRange(8, 14);
      mesh.userData.road = road;
      mesh.userData.t = t;
      mesh.userData.dir = dir;
      mesh.userData.isTraffic = true;
      sc.add(mesh);
      var entry = registerCar(mesh, pickName(), 60 + Math.floor(randRange(0, 41)),
        '#' + color.toString(16).padStart(6, '0'), false);
      entry.road = road;
      V._traffic.push(entry);
    }
    return V._traffic;
  };

  // ---- speed ----
  // Set the HUD speed and the active car's mesh speed. The step tick recomputes
  // the display from physics afterwards, so a staging call (151) sticks only
  // until the next tick — exactly what the cover staging wants.
  V.setSpeedKmh = function (v) {
    if (SB.state) SB.state.speedKmh = v;
    var a = V.active;
    if (a && a.mesh && a.mesh.userData) {
      var s = v / 3.6;
      var cur = a.mesh.userData.speed || 0;
      a.mesh.userData.speed = (cur < 0 ? -1 : 1) * s;
      if (cur === 0) a.mesh.userData.speed = s;
    }
    if (SB.hud && typeof SB.hud.update === 'function') {
      try { SB.hud.update(); } catch (e) {}
    }
  };

  // ---- per-tick driving + traffic (called from the player step wrap) ----
  V._tick = function (dt) {
    if (!dt || dt <= 0) return;
    var k = (SB.player && SB.player._keys) || {};
    var i, m, ud;

    // Active vehicle: arcade driving from W/S/A/D.
    var a = V.active;
    if (a && a.mesh) {
      m = a.mesh; ud = m.userData;
      var fwd = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
      var steer = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
      var v = ud.speed || 0;
      if (fwd > 0) v += ACCEL * dt;
      else if (fwd < 0) {
        if (v > 0.5) v -= BRAKE * dt;       // brake while moving forward
        else v -= ACCEL * 0.6 * dt;          // then reverse
      } else {
        // Coast down with no input.
        if (v > 0) v = Math.max(0, v - 6 * dt);
        else if (v < 0) v = Math.min(0, v + 6 * dt);
      }
      if (v > MAX_SPEED) v = MAX_SPEED;
      if (v < -REVERSE_MAX) v = -REVERSE_MAX;
      var grip = Math.min(1, Math.abs(v) / 8);
      ud.heading = (typeof ud.heading === 'number') ? ud.heading : Math.PI;
      ud.heading -= steer * TURN_RATE * grip * dt;
      m.position.x += Math.sin(ud.heading) * v * dt;
      m.position.z += Math.cos(ud.heading) * v * dt;
      m.position.y = groundY(m.position.x, m.position.z);
      m.rotation.y = ud.heading;
      // World bound (r13 integration): the ground slab ends at
      // x [-190, 230], z [-150, 230]; beyond it is sky void. A 10 s W-hold
      // used to end at z=-470 with no ground under the car. Stop at the
      // edge instead of driving off the world (pure function of position).
      if (m.position.x < -188) { m.position.x = -188; v = 0; }
      if (m.position.x > 228) { m.position.x = 228; v = 0; }
      if (m.position.z < -148) { m.position.z = -148; v = 0; }
      if (m.position.z > 228) { m.position.z = 228; v = 0; }
      ud.speed = v;
      if (SB.state) SB.state.speedKmh = Math.abs(v) * 3.6;
    } else if (SB.state) {
      SB.state.speedKmh = 0;
    }

    // Traffic: advance along its road, wrap around at the end.
    for (i = 0; i < V._traffic.length; i++) {
      var entry = V._traffic[i];
      m = entry.mesh; ud = m.userData;
      var road = ud.road;
      var rdx = road.x1 - road.x0, rdz = road.z1 - road.z0;
      var rlen = Math.sqrt(rdx * rdx + rdz * rdz) || 1;
      ud.t += (ud.speed * ud.dir * dt) / rlen;
      if (ud.t > 1) ud.t -= 1;
      if (ud.t < 0) ud.t += 1;
      var nx = road.x0 + rdx * ud.t;
      var nz = road.z0 + rdz * ud.t;
      m.position.set(nx, groundY(nx, nz), nz);
      m.rotation.y = ud.heading;
    }
  };

  // ---- per-preset setup (called by the player preset wrap) ----
  V._onPreset = function (name) {
    V._ensurePinkCar();
    var pink = V.pinkCar;
    if (name === 'cover' || name === 'drive') {
      if (pink) {
        pink.mesh.position.set(0, groundY(0, 0), 0);
        pink.mesh.rotation.y = Math.PI;
        pink.mesh.userData.heading = Math.PI;
        pink.mesh.userData.speed = 0;
      }
      V.spawnTraffic(24);
    } else if (name === 'onfoot') {
      if (pink) {
        pink.mesh.position.set(3, groundY(3, 30), 30);
        pink.mesh.rotation.y = Math.PI;
        pink.mesh.userData.heading = Math.PI;
        pink.mesh.userData.speed = 0;
      }
      V.spawnTraffic(24);
    } else if (name === 'mission') {
      if (pink) {
        pink.mesh.position.set(-3, groundY(-3, 16), 16);
        pink.mesh.rotation.y = Math.PI;
        pink.mesh.userData.heading = Math.PI;
        pink.mesh.userData.speed = 0;
      }
      V.spawnTraffic(24);
    } else if (name === 'free') {
      if (pink) {
        pink.mesh.position.set(4, groundY(4, 4), 4);
        pink.mesh.rotation.y = Math.PI;
        pink.mesh.userData.heading = Math.PI;
        pink.mesh.userData.speed = 0;
      }
      V.spawnTraffic(12);
    }
    // 'map': leave cars where they are.
    if (SB.state && V.active) {
      // Keep the HUD vehicle fields in sync with the driven car.
      SB.state.vehicleName = V.active.name || 'Car';
      SB.state.vehicleCond = (typeof V.active.cond === 'number') ? V.active.cond : 100;
      SB.state.vehicleStatus = (SB.state.vehicleCond >= 70) ? 'OK' : 'DENTED';
    }
  };
})();
