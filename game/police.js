(function () {
  'use strict';
  var SB = window.SB = window.SB || {};
  var P = SB.police = SB.police || {};
  var UNITS = ['MARLIN-11', 'SNAPPER-25', 'TARPON-18', 'IBIS-43', 'HERON-17', 'KESTREL-31'];
  var CRUISE_SPEED = 30, RAM_DIST = 7, CATCH_DIST = 2.2, FOOT_SPEED = 6.5;
  var cruisers = [], footCops = [], roadblocks = [], heli = null;
  var spawnT = 0, ramT = 0, stageHeli = false, stageBlock = false;

  function playerPos() {
    var p = SB.world.player;
    return p ? p.pos : null;
  }
  function dist2(ax, az, bx, bz) {
    var dx = ax - bx, dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
  }
  function angDiff(a, b) {
    var d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
  function freeSpotNear(px, pz, minD, maxD) {
    for (var i = 0; i < 8; i++) {
      var a = SB.rand(0, Math.PI * 2), d = SB.rand(minD, maxD);
      var c = SB.clampToBounds(px + Math.cos(a) * d, pz + Math.sin(a) * d);
      if (!SB.isBlocked(c.x, c.z, 1.5)) return c;
    }
    return SB.clampToBounds(px + minD, pz);
  }

  function makeLightBar(group) {
    var bar = new THREE.Group();
    var r = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    r.position.set(-0.35, 1.18, 0);
    var b = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x2a6aff }));
    b.position.set(0.35, 1.18, 0);
    bar.add(r); bar.add(b);
    group.add(bar);
    return { red: r, blue: b };
  }

  function spawnCruiser(unit, x, z, heading) {
    var group = SB.city.makeCarMesh('sedan', 0x14264a);
    var bar = makeLightBar(group);
    group.position.set(x, 0, z);
    group.rotation.y = heading;
    SB.world.scene.add(group);
    var c = {
      group: group, unit: unit, status: 'PURSUIT', pos: group.position,
      speed: 0, heading: heading, lightR: bar.red, lightB: bar.blue
    };
    SB.world.police.push(c);
    cruisers.push(c);
    return c;
  }

  function removeCruiser(c) {
    SB.world.scene.remove(c.group);
    var i = cruisers.indexOf(c); if (i >= 0) cruisers.splice(i, 1);
    i = SB.world.police.indexOf(c); if (i >= 0) SB.world.police.splice(i, 1);
  }

  function spawnFootCop() {
    var pp = playerPos(); if (!pp) return;
    var s = freeSpotNear(pp.x, pp.z, 22, 30);
    var group = SB.city.makePedMesh(0x1a2a4a, 0xc98a5a);
    group.position.set(s.x, 0, s.z);
    SB.world.scene.add(group);
    footCops.push({ group: group, unit: 'FOOT-07', pos: group.position, heading: 0 });
  }
  function removeFootCops() {
    for (var i = 0; i < footCops.length; i++) SB.world.scene.remove(footCops[i].group);
    footCops = [];
  }

  function makeRoadblock(px, pz, heading) {
    var fwd = SB.forwardOf(heading);
    var cx = px + fwd.x * 45, cz = pz + fwd.z * 45;
    var group = new THREE.Group();
    var perp = heading + Math.PI / 2;
    for (var k = -1; k <= 1; k += 2) {
      var car = SB.city.makeCarMesh('sedan', 0x14264a);
      var ox = Math.cos(perp) * k * 4, oz = Math.sin(perp) * k * 4;
      car.position.set(cx + ox, 0, cz + oz);
      car.rotation.y = heading + (k > 0 ? 0.6 : -0.6);
      group.add(car);
      var barrier = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 0.5),
        new THREE.MeshLambertMaterial({ color: 0xff8c42 }));
      barrier.position.set(cx + ox * 1.8, 0.45, cz + oz * 1.8);
      barrier.rotation.y = perp;
      group.add(barrier);
    }
    group.position.set(0, 0, 0);
    SB.world.scene.add(group);
    var rb = { group: group, x: cx, z: cz, unit: 'ROADBLOCK' };
    roadblocks.push(rb);
    return rb;
  }
  function removeRoadblocks() {
    for (var i = 0; i < roadblocks.length; i++) SB.world.scene.remove(roadblocks[i].group);
    roadblocks = [];
  }

  function buildHeliMesh() {
    var g = new THREE.Group();
    var navy = new THREE.MeshLambertMaterial({ color: 0x14264a });
    var white = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 3.4), navy);
    body.position.y = 0; body.castShadow = true; g.add(body);
    var nose = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 1.0),
      new THREE.MeshLambertMaterial({ color: 0x2a3a4a }));
    nose.position.set(0, -0.1, -2.0); g.add(nose);
    var tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 3.6), white);
    tail.position.set(0, 0.2, 3.2); g.add(tail);
    var fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 0.8), navy);
    fin.position.set(0, 0.7, 4.8); g.add(fin);
    var rotor = new THREE.Group();
    var blade = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.08, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x222222 }));
    rotor.add(blade);
    var blade2 = blade.clone(); blade2.rotation.y = Math.PI / 2; rotor.add(blade2);
    rotor.position.y = 0.95; g.add(rotor);
    var skidMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    for (var k = -1; k <= 1; k += 2) {
      var skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.0), skidMat);
      skid.position.set(k * 1.0, -0.85, 0); g.add(skid);
    }
    return { group: g, rotor: rotor };
  }

  P.spawnHeli = function () {
    if (heli || !SB.world.scene) return heli;
    var pp = playerPos() || { x: 0, z: 0 };
    var built = buildHeliMesh();
    var group = built.group;
    group.position.set(pp.x, 22, pp.z);
    SB.world.scene.add(group);
    var cone = new THREE.Mesh(
      new THREE.ConeGeometry(12, 42, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    SB.world.scene.add(cone);
    var light = new THREE.SpotLight(0xfff2c0, 1.4, 110, 0.38, 0.45, 1);
    light.position.set(0, -1, 0);
    light.target.position.set(pp.x, 0, pp.z);
    group.add(light);
    SB.world.scene.add(light.target);
    var zone = new THREE.Mesh(new THREE.RingGeometry(18, 20.5, 40),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
    zone.rotation.x = -Math.PI / 2;
    zone.position.set(pp.x, 0.15, pp.z);
    SB.world.scene.add(zone);
    heli = { group: group, unit: 'GULL-1', pos: group.position, spotlight: cone, light: light, zone: zone, rotor: built.rotor, orbit: 0 };
    SB.world.heli = heli;
    return heli;
  };

  var _down = new THREE.Vector3(0, -1, 0), _dir = new THREE.Vector3();
  P.updateHeli = function (dt) {
    if (!heli) return;
    var pp = playerPos();
    if (!pp) return;
    heli.orbit += dt * 0.25;

    var ph = (SB.world.player && SB.world.player.heading) || 0;
    var fwd = SB.forwardOf(ph);
    var sway = Math.sin(heli.orbit) * 10;
    var tx = pp.x + fwd.x * 24 - fwd.z * sway, tz = pp.z + fwd.z * 24 + fwd.x * sway;
    var k = 1 - Math.exp(-1.6 * dt);
    heli.pos.x += (tx - heli.pos.x) * k;
    heli.pos.z += (tz - heli.pos.z) * k;
    heli.pos.y += (22 - heli.pos.y) * k;
    heli.group.rotation.y = SB.headingForDir(pp.x - heli.pos.x, pp.z - heli.pos.z);
    heli.rotor.rotation.y += dt * 22;
    heli.light.target.position.set(pp.x, 0, pp.z);
    heli.light.target.updateMatrixWorld();
    heli.zone.position.set(pp.x, 0.15, pp.z);

    var dx = pp.x - heli.pos.x, dy = -heli.pos.y, dz = pp.z - heli.pos.z;
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    var cone = heli.spotlight;
    cone.position.set(heli.pos.x + dx * 0.5, heli.pos.y + dy * 0.5, heli.pos.z + dz * 0.5);
    _dir.set(dx / len, dy / len, dz / len);
    cone.quaternion.setFromUnitVectors(_down, _dir);
    cone.scale.set(1, len / 42, 1);
  };

  function removeHeli() {
    if (!heli) return;
    SB.world.scene.remove(heli.group);
    SB.world.scene.remove(heli.zone);
    SB.world.scene.remove(heli.spotlight);
    SB.world.scene.remove(heli.light.target);
    heli = null;
    SB.world.heli = null;
  }

  function clearAll() {
    while (cruisers.length) removeCruiser(cruisers[0]);
    removeFootCops();
    removeRoadblocks();
    removeHeli();
  }
  P.clearAll = clearAll;

  P.update = function (dt) {
    if (!SB.world.scene) return;
    var pp = playerPos();
    if (!pp) return;
    var wanted = SB.state.wanted;
    spawnT -= dt; ramT -= dt;

    if (cruisers.length < wanted && spawnT <= 0) {
      var s = freeSpotNear(pp.x, pp.z, 55, 95);
      spawnCruiser(UNITS[cruisers.length % UNITS.length], s.x, s.z,
        SB.headingForDir(pp.x - s.x, pp.z - s.z));
      spawnT = 1.1;
    }
    while (cruisers.length > wanted) removeCruiser(cruisers[cruisers.length - 1]);

    if (wanted >= 3 && footCops.length === 0) spawnFootCop();
    if (wanted < 3) removeFootCops();

    if ((wanted >= 4 || stageBlock) && roadblocks.length === 0) {
      makeRoadblock(pp.x, pp.z, SB.world.player.heading || 0);
    }
    if (wanted < 4 && !stageBlock) removeRoadblocks();
    if (roadblocks.length && dist2(pp.x, pp.z, roadblocks[0].x, roadblocks[0].z) > 95) {
      removeRoadblocks();
      makeRoadblock(pp.x, pp.z, SB.world.player.heading || 0);
    }

    if ((wanted >= 5 || stageHeli) && !heli) P.spawnHeli();
    if (wanted < 5 && !stageHeli) removeHeli();
    P.updateHeli(dt);

    for (var i = 0; i < cruisers.length; i++) {
      var c = cruisers[i];
      var dx = pp.x - c.pos.x, dz = pp.z - c.pos.z;
      var d = Math.sqrt(dx * dx + dz * dz) || 0.01;
      var wantH = SB.headingForDir(dx, dz);
      c.heading += angDiff(wantH, c.heading) * Math.min(1, dt * 2.5);
      var target = d < RAM_DIST ? CRUISE_SPEED * 1.15 : CRUISE_SPEED;
      c.speed += (target - c.speed) * Math.min(1, dt * 1.5);
      c.status = d < RAM_DIST ? 'RAMMING' : 'PURSUIT';
      var f = SB.forwardOf(c.heading);
      var nx = c.pos.x + f.x * c.speed * dt, nz = c.pos.z + f.z * c.speed * dt;
      if (SB.isBlocked(nx, nz, 1.4)) {

        if (!SB.isBlocked(nx, c.pos.z, 1.4)) { c.pos.x = nx; }
        else if (!SB.isBlocked(c.pos.x, nz, 1.4)) { c.pos.z = nz; }
        else { c.heading += dt * 2.2; }
      } else { c.pos.x = nx; c.pos.z = nz; }
      c.group.rotation.y = c.heading;

      var on = Math.floor(SB.state.simTime * 4) % 2 === 0;
      c.lightR.visible = on; c.lightB.visible = !on;

      if (d < 3.4 && ramT <= 0) {
        ramT = 0.6;
        SB.emit('police-ram', { unit: c.unit });
        if (SB.world.player.onFoot && d < CATCH_DIST) P.busted();
      }
    }

    for (var j = 0; j < footCops.length; j++) {
      var cop = footCops[j];
      var fx = pp.x - cop.pos.x, fz = pp.z - cop.pos.z;
      var fd = Math.sqrt(fx * fx + fz * fz) || 0.01;
      cop.heading = SB.headingForDir(fx, fz);
      cop.pos.x += (fx / fd) * FOOT_SPEED * dt;
      cop.pos.z += (fz / fd) * FOOT_SPEED * dt;
      cop.group.rotation.y = cop.heading;
      if (fd < 1.6) P.busted();
    }
  };

  P.responseList = function () {
    var pp = playerPos();
    var out = [];
    if (heli && pp) {
      out.push({
        unit: 'GULL-1',
        dist: Math.round(dist2(pp.x, pp.z, heli.pos.x, heli.pos.z)),
        status: SB.state.wanted >= 4 ? 'SPOTLIGHT' : 'SEARCHING'
      });
    }
    for (var i = 0; i < cruisers.length; i++) {
      var c = cruisers[i];
      out.push({
        unit: c.unit,
        dist: pp ? Math.round(dist2(pp.x, pp.z, c.pos.x, c.pos.z)) : 0,
        status: c.status
      });
    }
    if (roadblocks.length && pp) {
      out.push({
        unit: 'ROADBLOCK',
        dist: Math.round(dist2(pp.x, pp.z, roadblocks[0].x, roadblocks[0].z)),
        status: 'ROADBLOCK'
      });
    }
    for (var j = 0; j < footCops.length; j++) {
      var cop = footCops[j];
      out.push({
        unit: cop.unit,
        dist: pp ? Math.round(dist2(pp.x, pp.z, cop.pos.x, cop.pos.z)) : 0,
        status: 'PURSUIT'
      });
    }
    return out;
  };

  function resetAfterArrest() {
    var lost = Math.floor(SB.state.cash * 0.1);
    SB.addCash(-lost);
    SB.setWanted(0);
    SB.setHealth(100);
    SB.state.vehicle = null;
    SB.state.speedKmh = 0;
    SB.state.gear = 'N';
    clearAll();
    stageHeli = false; stageBlock = false;
    var h = (SB.world.spawns && SB.world.spawns.hospital) || { x: -150, z: 250 };
    var p = SB.world.player;
    if (p) {
      if (SB.player && SB.player.setPosition) SB.player.setPosition(h.x, h.z, 0);
      else { p.pos.set(h.x, 0, h.z); p.heading = 0; if (p.mesh) p.mesh.rotation.y = 0; }
      p.onFoot = true; p.vehicle = null;
    }
  }
  P.busted = function () {
    resetAfterArrest();
    SB.emit('busted', { cash: SB.state.cash });
  };
  P.wasted = function () {
    resetAfterArrest();
    SB.emit('wasted', { cash: SB.state.cash });
  };

  function stageCruisers(n, pp) {
    var offs = [[-7, -18], [8, -28], [-5, 16], [6, 24], [-8, -38]];
    var heading = SB.world.player ? SB.world.player.heading || 0 : 0;
    var fwd = SB.forwardOf(heading);
    var right = { x: -fwd.z, z: fwd.x };
    for (var i = 0; i < n && i < offs.length; i++) {
      if (cruisers.length >= n) break;
      var ox = offs[i][0], oz = offs[i][1];
      var x = pp.x + right.x * ox + fwd.x * oz;
      var z = pp.z + right.z * ox + fwd.z * oz;
      var c = spawnCruiser(UNITS[i % UNITS.length], x, z, heading);
      if (i === 0) c.status = 'RAMMING';
    }
  }

  SB.on('scene', function (d) {
    var pp = playerPos();
    if (!pp) return;
    if (d.name === 'cover') {
      stageHeli = true; stageBlock = true;
      stageCruisers(3, pp);
      if (!roadblocks.length) makeRoadblock(pp.x, pp.z, SB.world.player.heading || 0);
      if (!heli) P.spawnHeli();
    } else if (d.name === 'night') {
      stageHeli = true; stageBlock = true;
      stageCruisers(2, pp);
      if (!roadblocks.length) makeRoadblock(pp.x, pp.z, SB.world.player.heading || 0);
      if (!heli) P.spawnHeli();
    } else {
      stageHeli = false; stageBlock = false;
    }
  });

  SB.registerUpdate(P.update);
})();
