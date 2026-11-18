(function () {
  'use strict';

  var SB = window.SB = window.SB || {};
  var V = SB.vehicles = SB.vehicles || {};
  var _spawned = false;

  var NAMES = {
    sport: 'VENTO STRADA', muscle: 'SOLMAR GT', sedan: 'PALMERA LX',
    taxi: 'SOLMAR CAB', truck: 'BAYLINE HAULER', van: 'MERCADO VAN'
  };
  var SPECS = {
    sport: { topSpeed: 55, accel: 14 },
    muscle: { topSpeed: 48, accel: 12 },
    sedan: { topSpeed: 42, accel: 10 },
    taxi: { topSpeed: 42, accel: 10 },
    truck: { topSpeed: 34, accel: 7 },
    van: { topSpeed: 38, accel: 9 }
  };
  var PALETTE = [0xd83a3a, 0x3a6ad8, 0xd8d83a, 0x3ad83a, 0xff5a8a, 0xff8c42, 0xffffff, 0x2a2a2a, 0x7a3ad8];
  V.SPECS = SPECS;

  V.create = function (kind, x, z, heading, opts) {
    opts = opts || {};
    if (!NAMES[kind]) kind = 'sedan';
    var spec = SPECS[kind];
    var color = (opts.color !== undefined) ? opts.color
      : PALETTE[Math.floor(SB.rng() * PALETTE.length)];
    var group = SB.city.makeCarMesh(kind, color);
    group.position.set(x, 0, z);
    group.rotation.y = heading || 0;
    SB.world.scene.add(group);
    var v = {
      id: 'veh-' + (SB.world.vehicles.length + 1),
      name: opts.name || NAMES[kind], kind: kind,
      condition: (opts.condition !== undefined ? opts.condition : 100),
      group: group, pos: group.position, heading: heading || 0, speed: 0,
      topSpeed: spec.topSpeed, accel: spec.accel, color: color,
      taken: false, stalled: false
    };
    SB.world.vehicles.push(v);
    return v;
  };

  V.spawnParked = function () {
    if (_spawned) return SB.world.vehicles;
    _spawned = true;
    var list = (SB.world.spawns && SB.world.spawns.vehicles) || [];
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      V.create(s.kind, s.x, s.z, s.heading, { name: s.name });
    }
    return SB.world.vehicles;
  };

  V.nearest = function (x, z, maxD) {
    var best = null, bestD = maxD * maxD;
    var list = SB.world.vehicles;
    for (var i = 0; i < list.length; i++) {
      var dx = list[i].pos.x - x, dz = list[i].pos.z - z;
      var d2 = dx * dx + dz * dz;
      if (d2 < bestD) { bestD = d2; best = list[i]; }
    }
    return best;
  };

  V.steal = function (v) {
    if (!v) return null;
    v.taken = true;
    SB.addHeat(15);
    SB.emit('vehicle-stolen', {
      vehicle: { id: v.id, name: v.name, kind: v.kind }, heat: SB.state.heat
    });
    return v;
  };

  function gearFor(v) {
    if (v.speed < -0.5) return 'R';
    if (v.speed < 0.5) return 'N';
    var f = Math.abs(v.speed) / v.topSpeed;
    return 'G' + (f < 0.2 ? 1 : f < 0.4 ? 2 : f < 0.6 ? 3 : f < 0.8 ? 4 : 5);
  }

  V.update = function (dt) {
    var p = SB.world.player;
    if (!p || p.onFoot || !p.vehicle) return;
    var v = p.vehicle;
    if (v.condition <= 0) {
      v.speed = 0;
      if (!v.stalled) {
        v.stalled = true;
        SB.emit('vehicle-stalled', { vehicle: { id: v.id, name: v.name, kind: v.kind } });
      }
    } else {
      var ax = SB.input.axis();
      var brake = SB.input.isDown('Space');
      if (ax.y > 0) v.speed += v.accel * dt;
      else if (ax.y < 0) v.speed -= (v.speed > 0.5 ? 30 : 8) * dt;
      v.speed -= v.speed * 0.12 * dt;
      if (brake) v.speed -= v.speed * 2.5 * dt;
      if (Math.abs(v.speed) < 0.05 && ax.y === 0) v.speed = 0;
      if (v.speed > v.topSpeed) v.speed = v.topSpeed;
      if (v.speed < -12) v.speed = -12;

      var spdF = Math.max(-1, Math.min(1, v.speed / 10));
      v.heading -= ax.x * 1.9 * spdF * (brake ? 1.5 : 1) * dt;
      var f = SB.forwardOf(v.heading);
      var nx = v.pos.x + f.x * v.speed * dt;
      var nz = v.pos.z + f.z * v.speed * dt;
      var hit = SB.isBlocked(nx, nz, 1.3);
      if (!hit) {
        var list = SB.world.vehicles;
        for (var i = 0; i < list.length; i++) {
          var o = list[i];
          if (o === v) continue;
          var ox = nx - o.pos.x, oz = nz - o.pos.z;
          if (ox * ox + oz * oz < 3.1 * 3.1) { hit = true; break; }
        }
      }
      if (hit) {
        var impact = Math.abs(v.speed);
        if (impact > 4) {
          v.condition = Math.max(0, v.condition - Math.round(impact * 0.5));
          SB.emit('vehicle-crash', {
            vehicle: { id: v.id, name: v.name, kind: v.kind },
            impact: Math.round(impact * 10) / 10
          });
        }
        v.speed *= -0.25;
      } else {
        v.pos.x = nx;
        v.pos.z = nz;

        if (v._bumpCd === undefined) v._bumpCd = 0;
        v._bumpCd -= dt;
        var tr = SB.world.traffic;
        for (var j = 0; j < tr.length; j++) {
          var t = tr[j];
          var tx = v.pos.x - t.group.position.x, tz = v.pos.z - t.group.position.z;
          if (tx * tx + tz * tz < 3.2 * 3.2 && v._bumpCd <= 0) {
            t.s += (t.dir > 0 ? 1 : -1) * 2.5;
            v.speed *= 0.7;
            if (v.condition > 0) v.condition = Math.max(0, v.condition - 1);
            v._bumpCd = 0.5;
          }
        }
      }
    }
    v.group.position.set(v.pos.x, 0, v.pos.z);
    v.group.rotation.y = v.heading;
    p.pos.set(v.pos.x, 0, v.pos.z);
    p.heading = v.heading;
    SB.state.speedKmh = Math.round(Math.abs(v.speed) * 3.6 * 10) / 10;
    SB.state.gear = gearFor(v);
    SB.state.vehicle = { id: v.id, name: v.name, kind: v.kind, condition: Math.round(v.condition) };
  };

})();
