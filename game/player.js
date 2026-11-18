(function () {
  'use strict';

  var SB = window.SB = window.SB || {};
  var P = SB.player = SB.player || {};
  var WALK_SPEED = 4, RUN_SPEED = 7;
  var _prev = {};
  var _registered = false;
  var _sceneHooked = false;
  var _lastShot = -10;
  var _flash = null, _flashT = 0;

  function edge(code) {
    var down = SB.input.isDown(code);
    var was = !!_prev[code];
    _prev[code] = down;
    return down && !was;
  }
  window.addEventListener('blur', function () { _prev = {}; });

  function angLerp(a, b, t) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * Math.min(1, t);
  }

  var C = SB.combat = SB.combat || {};
  C.ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'];
  C.MAG = { pistol: 12, smg: 32, shotgun: 6, rifle: 30 };
  C.RATE = { fists: 0.4, pistol: 0.25, smg: 0.09, shotgun: 0.8, rifle: 0.12 };
  Object.defineProperty(C, 'weapons', { get: function () { return SB.state.weapons; } });

  function aimDir() {
    var p = SB.world.player;
    var from = { x: p.pos.x, y: p.pos.y + 1.3, z: p.pos.z };
    var cam = SB.world.camera;
    if (!cam) return { x: -Math.sin(p.heading), y: 0, z: -Math.cos(p.heading) };
    var mx = SB.input.mouse.x, my = SB.input.mouse.y;
    var nx = 0, ny = 0;
    if (mx !== 0 || my !== 0) {
      nx = (mx / window.innerWidth) * 2 - 1;
      ny = -((my / window.innerHeight) * 2 - 1);
    }
    var rc = new THREE.Raycaster();
    rc.setFromCamera({ x: nx, y: ny }, cam);
    var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1);
    var pt = new THREE.Vector3();
    if (rc.ray.intersectPlane(plane, pt)) {
      var dx = pt.x - from.x, dy = 1 - from.y, dz = pt.z - from.z;
      var l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      return { x: dx / l, y: dy / l, z: dz / l };
    }
    var d = new THREE.Vector3();
    cam.getWorldDirection(d);
    return { x: d.x, y: 0, z: d.z };
  }

  function showFlash(from, dir) {
    if (!_flash) {
      _flash = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.7),
        new THREE.MeshBasicMaterial({ color: 0xffe08a }));
      SB.world.scene.add(_flash);
    }
    _flash.position.set(from.x + dir.x * 0.9, from.y + dir.y * 0.9, from.z + dir.z * 0.9);
    _flash.visible = true;
    _flashT = 0.06;
  }

  C.selectWeapon = function (id) {
    if (C.ORDER.indexOf(id) < 0) return false;
    if (id === 'rifle' && SB.state.weapons.rifle.locked) {
      SB.emit('weapon-locked', { weapon: 'rifle' });
      return false;
    }
    SB.state.weapon = id;
    SB.emit('weapon-change', { weapon: id });
    return true;
  };

  C.shoot = function () {
    var p = SB.world.player;
    if (!p || !SB.state.started) return false;
    var id = SB.state.weapon;
    if (SB.state.simTime - _lastShot < C.RATE[id]) return false;
    var w = SB.state.weapons[id];
    if (!w) return false;
    if (id !== 'fists') {
      if (w.ammo <= 0) {
        if (w.reserve > 0) C.reload();
        else SB.emit('dry-fire', { weapon: id });
        return false;
      }
      w.ammo -= 1;
    }
    _lastShot = SB.state.simTime;
    var from = { x: p.pos.x, y: p.pos.y + 1.3, z: p.pos.z };
    var dir = aimDir();
    if (id !== 'fists') showFlash(from, dir);
    SB.emit('shot', { weapon: id, from: from, dir: dir, ammo: w.ammo, reserve: w.reserve });
    return true;
  };

  C.reload = function () {
    var id = SB.state.weapon;
    var w = SB.state.weapons[id];
    if (!w || w.ammo === Infinity) return false;
    var mag = C.MAG[id] || 0;
    var need = mag - w.ammo;
    if (need <= 0 || w.reserve <= 0) return false;
    var take = Math.min(need, w.reserve);
    w.ammo += take;
    w.reserve -= take;
    SB.emit('reload', { weapon: id, ammo: w.ammo, reserve: w.reserve });
    return true;
  };

  function adoptStaged(p) {
    var v = p.vehicle;
    var spec = (SB.vehicles && SB.vehicles.SPECS && SB.vehicles.SPECS[v.kind]) ||
      { topSpeed: 55, accel: 14 };
    var rec = {
      id: v.id || 'stage-vento', name: v.name || 'VENTO STRADA', kind: v.kind || 'sport',
      condition: (v.condition !== undefined ? v.condition : 100),
      group: p.mesh, pos: p.mesh.position, heading: p.heading, speed: 0,
      topSpeed: spec.topSpeed, accel: spec.accel, taken: true, stalled: false
    };
    SB.world.vehicles.push(rec);
    p.vehicle = rec;
    p.onFoot = false;
    SB.state.vehicle = { id: rec.id, name: rec.name, kind: rec.kind, condition: rec.condition };
    SB.state.speedKmh = 0;
    SB.state.gear = 'N';
  }

  function hookScenePreset() {
    if (_sceneHooked) return;
    _sceneHooked = true;
    SB.on('scene', function (e) {
      if (!e || (e.name !== 'cover' && e.name !== 'mission' && e.name !== 'night')) return;
      var p = SB.world.player;
      if (!p || !p.onFoot) return;
      if (!SB.vehicles || !SB.vehicles.nearest) return;
      var v = SB.vehicles.nearest(p.pos.x, p.pos.z, 30);
      if (v) P.enterVehicle(v, { steal: false });
    });
  }

  P.create = function (spawn) {
    spawn = spawn || (SB.world.spawns && SB.world.spawns.player) || { x: 0, z: 60, heading: 0 };
    var existing = SB.world.player;
    if (existing) {
      if (!existing.onFoot && existing.vehicle) adoptStaged(existing);
      else { existing.onFoot = true; existing.vehicle = null; }
    } else {
      var mesh = SB.city.makePedMesh(0xff5a8a, 0xc98a5a);
      mesh.position.set(spawn.x, 0, spawn.z);
      mesh.rotation.y = spawn.heading || 0;
      SB.world.scene.add(mesh);
      SB.world.player = {
        mesh: mesh, pos: mesh.position, heading: spawn.heading || 0,
        speed: 0, onFoot: true, vehicle: null
      };
    }
    SB.setChaseTarget(SB.world.player);
    SB.setCameraMode(SB.world.player.onFoot ? 'onfoot' : 'chase');
    if (!_registered) { _registered = true; SB.registerUpdate(P.update); }
    hookScenePreset();
    return SB.world.player;
  };

  P.isOnFoot = function () {
    return !!SB.world.player && !!SB.world.player.onFoot;
  };

  P.setPosition = function (x, z, heading) {
    var p = SB.world.player;
    if (!p) return false;
    if (p.vehicle) {
      var v = p.vehicle;

      if (v.pos) v.pos.set(x, 0, z);
      if (v.group) v.group.rotation.y = heading;
      if (v.heading !== undefined) v.heading = heading;
    }
    p.pos.set(x, 0, z);
    p.heading = heading;
    if (p.mesh) p.mesh.rotation.y = heading;
    return true;
  };

  P.enterVehicle = function (v, opts) {
    var p = SB.world.player;
    if (!p || !v || !p.onFoot) return false;
    opts = opts || {};
    p.vehicle = v;
    p.onFoot = false;
    p.pos.set(v.pos.x, 0, v.pos.z);
    p.heading = v.heading;
    if (p.mesh) p.mesh.visible = false;
    SB.state.vehicle = { id: v.id, name: v.name, kind: v.kind, condition: Math.round(v.condition) };
    SB.setCameraMode('chase');
    SB.setChaseTarget(p);
    SB.emit('enter-vehicle', { vehicle: SB.state.vehicle });
    return true;
  };

  P.exitVehicle = function () {
    var p = SB.world.player;
    if (!p || p.onFoot || !p.vehicle) return false;
    var v = p.vehicle;
    var rx = Math.cos(v.heading), rz = -Math.sin(v.heading);
    var px = v.pos.x + rx * 2.6, pz = v.pos.z + rz * 2.6;
    if (SB.isBlocked(px, pz, 0.5)) { px = v.pos.x - rx * 2.6; pz = v.pos.z - rz * 2.6; }
    if (SB.isBlocked(px, pz, 0.5)) {
      var f = SB.forwardOf(v.heading);
      px = v.pos.x - f.x * 3.5; pz = v.pos.z - f.z * 3.5;
    }
    var c = SB.clampToBounds(px, pz);
    p.pos.set(c.x, 0, c.z);
    p.heading = v.heading;
    p.vehicle = null;
    p.onFoot = true;
    if (p.mesh) { p.mesh.visible = true; p.mesh.rotation.y = p.heading; }
    SB.state.vehicle = null;
    SB.state.speedKmh = 0;
    SB.state.gear = 'N';
    SB.setCameraMode('onfoot');
    SB.setChaseTarget(p);
    SB.emit('exit-vehicle', { vehicle: { id: v.id, name: v.name, kind: v.kind } });
    return true;
  };

  function nearestVehicle(x, z, maxD) {
    if (SB.vehicles && SB.vehicles.nearest) return SB.vehicles.nearest(x, z, maxD);
    var best = null, bestD = maxD * maxD;
    var list = SB.world.vehicles;
    for (var i = 0; i < list.length; i++) {
      var dx = list[i].pos.x - x, dz = list[i].pos.z - z;
      var d2 = dx * dx + dz * dz;
      if (d2 < bestD) { bestD = d2; best = list[i]; }
    }
    return best;
  }

  function updateOnFoot(dt) {
    var p = SB.world.player;
    var ax = SB.input.axis();
    var cam = SB.world.camera;
    var cx = p.pos.x - cam.position.x, cz = p.pos.z - cam.position.z;
    var cl = Math.sqrt(cx * cx + cz * cz) || 1;
    cx /= cl; cz /= cl;
    var mx = cx * ax.y + (-cz) * ax.x;
    var mz = cz * ax.y + (cx) * ax.x;
    var ml = Math.sqrt(mx * mx + mz * mz);
    var moving = ml > 0.01;
    var speed = (SB.input.isDown('ShiftLeft') || SB.input.isDown('ShiftRight')) ? RUN_SPEED : WALK_SPEED;
    if (moving) {
      mx /= ml; mz /= ml;
      var nx = p.pos.x + mx * speed * dt;
      var nz = p.pos.z + mz * speed * dt;
      if (!SB.isBlocked(nx, p.pos.z, 0.5)) p.pos.x = nx;
      if (!SB.isBlocked(p.pos.x, nz, 0.5)) p.pos.z = nz;
      p.heading = angLerp(p.heading, SB.headingForDir(mx, mz), dt * 10);
      p.speed = speed;
    } else {
      p.speed = 0;
    }
    if (p.mesh) {
      p.mesh.rotation.y = p.heading;
      p.mesh.position.y = moving ? Math.abs(Math.sin(SB.state.simTime * 10)) * 0.06 : 0;
    }
  }

  P.update = function (dt) {
    var p = SB.world.player;
    if (!p) return;
    if (_flashT > 0) {
      _flashT -= dt;
      if (_flashT <= 0 && _flash) _flash.visible = false;
    }

    if (edge('KeyE')) {
      if (p.onFoot) {
        var v = nearestVehicle(p.pos.x, p.pos.z, 4);
        if (v) {
          if (!v.taken && SB.vehicles && SB.vehicles.steal) SB.vehicles.steal(v);
          P.enterVehicle(v);
        }
      } else {
        P.exitVehicle();
      }
    }

    var keys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
    for (var i = 0; i < keys.length; i++) {
      if (edge(keys[i])) C.selectWeapon(C.ORDER[i]);
    }
    if (edge('KeyR')) C.reload();
    if (SB.input.isDown('KeyF') || SB.input.mouse.down) C.shoot();

    if (p.onFoot) updateOnFoot(dt);
    else if (SB.vehicles && SB.vehicles.update) SB.vehicles.update(dt);

    var d = SB.districtAt(p.pos.x, p.pos.z);
    if (d) SB.state.location = d.name;
    var s = SB.streetAt(p.pos.x, p.pos.z);
    if (s) SB.state.street = s;
  };

})();
