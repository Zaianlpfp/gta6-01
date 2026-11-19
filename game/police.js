// police.js — B2 v4-rebuild r4. Wanted heat/stars, GULL-1 heli, cruisers,
// foot cops, roadblock, bust/wasted, boss SALTJACK.
// SB.state.heat is STARS 0-5; points 0-100 live here (thresholds TH).
// City repositions the heli + in-window peds every step, so the police drives
// cop RECORDS (axis/fixed/along/dir) and re-aims the heli after each step;
// makeCar meshes (cruisers, roadblock, boss) are police-owned and persist.
(function () {
  var SB = window.SB;
  var TH = [0, 12, 32, 52, 72, 92];
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function dist2(ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }

  var P = SB.police = {
    pts: 0, response: [], heli: null, cruisers: [], cops: [], bosses: [],
    roadblock: { active: false, cars: [], ax: 0, az: 0, ah: 0 },
    inSight: false, lastCrime: 0, _bustT: 0, _busted: false, _wasted: false, marker: null,
    stars: function () { var s = 0; for (var i = 1; i < 6; i++) if (P.pts >= TH[i]) s = i; return s; },
    sync: function () { SB.state.heat = P.stars(); },
    addHeat: function (n) {
      P.pts = clamp(P.pts + n, 0, 100);
      P.lastCrime = SB.engine.simTime; P.sync();
    },
    setHeat: function (n) {
      n = clamp(n | 0, 0, 5);
      P.pts = TH[n]; P.lastCrime = SB.engine.simTime; P.sync();
    },
    refresh: function () { buildResponse(); },
    heroPos: function () { return SB.engine.heroPos(); },
    ensureHeli: function () {
      if (!P.heli) {
        var ring = new THREE.Mesh(
          new THREE.RingGeometry(6, 7.5, 40),
          new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2; ring.visible = false;
        SB.city.scene.add(ring);
        P.heli = { g: SB.city.heli, cone: SB.city.coneGrp, pool: SB.city.spot, ring: ring, rotor: SB.city.heliRotor };
      }
      var h = P.heli;
      h.g.scale.set(1.7, 1.7, 1.7);
      var cm = h.cone.children[0];
      if (cm && cm.material) cm.material.opacity = 0.22;
      return h;
    },
    ensureCruisers: function () {
      if (P.cruisers.length === 0) {
        for (var i = 0; i < 2; i++) {
          var g = SB.city.makeCar(0xffffff, { cruiser: true });
          g.visible = false; SB.city.scene.add(g);
          P.cruisers.push({ g: g, name: 'CRUISER-' + (i + 1), side: i === 0 ? -1 : 1 });
        }
      }
      return P.cruisers;
    },
    ensureCops: function (force) {
      if (P.cops.length === 0) {
        for (var i = 0; i < SB.city.cops.length; i++) {
          var rec = SB.city.cops[i];
          rec.mesh.userData.hp = 100;
          P.cops.push({ rec: rec, mesh: rec.mesh, alive: true, hp: 100, bustT: 0, _shotT: 0, name: 'OFFICER-' + (i + 1) });
        }
      }
      if (force) {
        for (var j = 0; j < P.cops.length; j++) {
          var c = P.cops[j];
          c.alive = true; c.hp = 100; c.bustT = 0;
          c.rec.active = true; c.mesh.visible = true; c.mesh.userData.hp = 100;
          // No teleport: in foot mode setDensity already staged them near the
          // hero; in car mode they stay on the sidewalk and chase on foot.
        }
      }
      return P.cops;
    },
    ensureRoadblock: function () {
      var rb = P.roadblock;
      if (rb.cars.length === 0) {
        for (var i = 0; i < 2; i++) {
          var g = SB.city.makeCar(0xffffff, { cruiser: true });
          g.visible = false; SB.city.scene.add(g);
          rb.cars.push({ g: g, name: 'CRUISER-' + (i + 3), side: i === 0 ? -1 : 1 });
        }
      }
      return rb;
    },
    clearRoadblock: function () {
      P.roadblock.active = false;
      for (var i = 0; i < P.roadblock.cars.length; i++) P.roadblock.cars[i].g.visible = false;
    },
    spawnBoss: function () {
      for (var i = 0; i < P.bosses.length; i++) {
        var live = P.bosses[i];
        if (live.alive) {
          // Fresh staging: full HP, back in front of the hero, visible.
          var lh = SB.engine.hero;
          var lfx = -Math.sin(lh.heading), lfz = -Math.cos(lh.heading);
          var lrx = Math.cos(lh.heading), lrz = -Math.sin(lh.heading);
          var lpx = lh.pos.x + lfx * 8 + lrx * 3, lpz = lh.pos.z + lfz * 8 + lrz * 3;
          live.hp = 220; live._counted = false;
          live.mesh.userData.hp = 220;
          live.mesh.visible = true;
          live.mesh.position.set(lpx, 0, lpz);
          live.mesh.rotation.y = lh.heading + Math.PI;
          if (live.marker) { live.marker.visible = true; live.marker.position.set(lpx, 2.6, lpz); }
          return live;
        }
      }
      var dead = null;
      for (var k = 0; k < P.bosses.length; k++) if (!P.bosses[k].alive) { dead = P.bosses[k]; break; }
      var hero = SB.engine.hero;
      var fx = -Math.sin(hero.heading), fz = -Math.cos(hero.heading);
      var rx = Math.cos(hero.heading), rz = -Math.sin(hero.heading);
      var px = hero.pos.x + fx * 8 + rx * 3, pz = hero.pos.z + fz * 8 + rz * 3;
      if (dead) {
        dead.alive = true; dead.hp = 220; dead._counted = false;
        dead.mesh.visible = true; dead.mesh.userData.hp = 220; dead.mesh.userData.boss = true;
        dead.mesh.position.set(px, 0, pz);
        dead.marker.visible = true;
        dead.marker.position.set(px, 2.6, pz);
        if (SB.player && SB.player.bossPeds.indexOf(dead) < 0) SB.player.bossPeds.push(dead);
        return dead;
      }
      var mesh = SB.city.makePerson(0x8a1a1a, false);
      mesh.userData.boss = true; mesh.userData.cop = false; mesh.userData.hp = 220;
      mesh.position.set(px, 0, pz);
      mesh.rotation.y = hero.heading + Math.PI;
      SB.city.scene.add(mesh);
      var marker = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32),
        new THREE.MeshBasicMaterial({ color: 0xff2233 })
      );
      marker.position.set(px, 2.6, pz);
      SB.city.scene.add(marker);
      var b = { mesh: mesh, marker: marker, alive: true, hp: 220, name: 'SALTJACK', _counted: false, _shotT: 0 };
      P.bosses.push(b);
      P.marker = marker;
      if (SB.player) SB.player.bossPeds.push(b);
      return b;
    },
    bust: function () {
      var Pl = SB.player;
      if (Pl) {
        Pl.cash = Math.max(0, Pl.cash - 200);
        Pl.hp = 100; Pl._dead = false;
        Pl.respawn();
      }
      P.setHeat(0);
      despawnCops();
    },
    wasted: function () {
      var Pl = SB.player;
      if (Pl) {
        Pl.cash = Math.max(0, Pl.cash - 200);
        Pl.hp = 100; Pl._dead = false;
        Pl.respawn();
      }
      P.setHeat(0);
      despawnCops();
    },
    _arrest: function () { P.bust(); },
    update: function (dt) { tick(dt); }
  };

  function despawnCops() {
    for (var i = 0; i < P.cops.length; i++) {
      var c = P.cops[i];
      c.alive = false; c.bustT = 0;
      c.mesh.visible = false; c.rec.active = false;
    }
  }

  function buildResponse() {
    var r = [], hero = SB.engine.hero;
    function d(p) { return Math.round(dist2(p.x, p.z, hero.pos.x, hero.pos.z)); }
    if (P.heli && P.heli.g.visible) r.push({ name: 'GULL-1', dist: d(P.heli.g.position), status: 'SPOTLIGHT' });
    for (var i = 0; i < P.cruisers.length; i++) {
      var c = P.cruisers[i];
      if (c.g.visible) r.push({ name: c.name, dist: d(c.g.position), status: 'PURSIT' });
    }
    if (P.roadblock.active) {
      for (var j = 0; j < P.roadblock.cars.length; j++) {
        var rc = P.roadblock.cars[j];
        if (rc.g.visible) r.push({ name: rc.name, dist: d(rc.g.position), status: 'BLOCK' });
      }
    }
    for (var k = 0; k < P.cops.length; k++) {
      var cp = P.cops[k];
      if (cp.alive) r.push({ name: cp.name, dist: d(cp.mesh.position), status: P.stars() >= 3 ? 'SHOOT' : 'FOOT' });
    }
    P.response = r;
  }

  function tick(dt) {
    P.ensureCops(false);
    var now = SB.engine.simTime, s = P.stars();
    if (P.pts > 0 && now - P.lastCrime > 12) P.pts = Math.max(0, P.pts - 3.5 * dt);
    P.sync();
    var hero = SB.engine.hero;
    var fx = -Math.sin(hero.heading), fz = -Math.cos(hero.heading);
    var rx = Math.cos(hero.heading), rz = -Math.sin(hero.heading);
    // --- heli GULL-1: 30 m ahead, y 14, scale 1.7, cone 0.22 ---
    if (P.heli) {
      var h = P.heli;
      var on = !!SB.city._heliOn && s > 0;
      h.g.visible = on; h.cone.visible = on; h.pool.visible = on; h.ring.visible = on;
      if (on) {
        var tx = hero.pos.x + fx * 30, tz = hero.pos.z + fz * 30;
        h.g.position.set(tx, 14, tz);
        h.cone.position.set(tx, 14, tz);
        h.pool.position.set(hero.pos.x, 0.12, hero.pos.z);
        h.ring.position.set(hero.pos.x, 0.15, hero.pos.z);
      }
    }
    // --- chase cruisers: flank +-5.5 lateral, never blocking the camera ---
    var near = false;
    for (var i = 0; i < P.cruisers.length; i++) {
      var c = P.cruisers[i];
      if (s < 1) { c.g.visible = false; continue; }
      c.g.visible = true;
      var gx = hero.pos.x + rx * c.side * 5.5 + fx * -2;
      var gz = hero.pos.z + rz * c.side * 5.5 + fz * -2;
      var dx = gx - c.g.position.x, dz = gz - c.g.position.z;
      var dd = Math.sqrt(dx * dx + dz * dz);
      if (dd > 70) c.g.position.set(hero.pos.x + rx * c.side * 5.5 + fx * 10, 0, hero.pos.z + rz * c.side * 5.5 + fz * 10);
      else if (dd > 0.05) {
        var sp = Math.min(55, 6 + dd * 1.2), mv = Math.min(dd, sp * dt);
        c.g.position.x += dx / dd * mv; c.g.position.z += dz / dd * mv;
      }
      c.g.rotation.y = hero.heading;
      if (dist2(c.g.position.x, c.g.position.z, hero.pos.x, hero.pos.z) < 45) near = true;
    }
    // --- roadblock: 2 extra cruisers, 46 m ahead, car mode, 3+ stars ---
    var rb = P.roadblock;
    var wantRb = s >= 3 && SB.state.preset !== 'map' && hero.mode === 'car';
    if (!wantRb) { rb.active = false; for (var q = 0; q < rb.cars.length; q++) rb.cars[q].g.visible = false; }
    else {
      if (!rb.active) {
        rb.active = true;
        rb.ax = hero.pos.x + fx * 46; rb.az = hero.pos.z + fz * 46; rb.ah = hero.heading;
      } else {
        var bx = rb.ax - hero.pos.x, bz = rb.az - hero.pos.z;
        if (bx * fx + bz * fz < -20) {
          rb.ax = hero.pos.x + fx * 46; rb.az = hero.pos.z + fz * 46; rb.ah = hero.heading;
        }
      }
      for (var m = 0; m < rb.cars.length; m++) {
        var rc = rb.cars[m];
        rc.g.visible = true;
        rc.g.position.set(rb.ax + rx * rc.side * 3, 0, rb.az + rz * rc.side * 3);
        rc.g.rotation.y = rb.ah + Math.PI / 2;
      }
    }
    // --- foot cops: chase (2+ stars), shoot (3+, 6 dmg/s <= 26 m), bust ---
    for (var n = 0; n < P.cops.length; n++) {
      var cp = P.cops[n];
      if (!cp.alive) { cp.mesh.visible = false; continue; }
      var mx = cp.mesh.position.x, mz = cp.mesh.position.z;
      var ex = hero.pos.x - mx, ez = hero.pos.z - mz;
      var ed = Math.sqrt(ex * ex + ez * ez);
      if (ed < 40) near = true;
      if (s < 2) { cp.rec.speed = 0; continue; }
      if (ed > 2.4) {
        cp.bustT = 0;
        var csp = 4.5, cstep = csp * dt;
        var nx = mx + ex / ed * cstep, nz = mz + ez / ed * cstep;
        if (Math.abs(ex) > Math.abs(ez)) {
          cp.rec.axis = 'z'; cp.rec.fixed = nz; cp.rec.along = nx; cp.rec.dir = ex > 0 ? 1 : -1;
        } else {
          cp.rec.axis = 'x'; cp.rec.fixed = nx; cp.rec.along = nz; cp.rec.dir = ez > 0 ? 1 : -1;
        }
        cp.rec.speed = csp;
        cp.mesh.position.x = nx; cp.mesh.position.z = nz;
      } else {
        cp.rec.speed = 0;
        cp.bustT += dt;
        if (cp.bustT >= 1.2) { P.bust(); return; }
      }
      if (s >= 3 && ed <= 26) {
        SB.player.damage(6 * dt);
        if (now - cp._shotT > 0.4) {
          cp._shotT = now;
          SB.city.burst(mx, 1.3, mz, { n: 4, flash: false });
        }
      }
    }
    // --- boss SALTJACK: hold ground, shoot 8 dmg/s <= 30 m ---
    for (var b = 0; b < P.bosses.length; b++) {
      var bo = P.bosses[b];
      if (!bo.alive) continue;
      var bdx = hero.pos.x - bo.mesh.position.x, bdz = hero.pos.z - bo.mesh.position.z;
      var bd = Math.sqrt(bdx * bdx + bdz * bdz);
      bo.mesh.rotation.y = Math.atan2(-bdx, -bdz);
      if (bo.marker) {
        bo.marker.visible = true;
        bo.marker.position.set(bo.mesh.position.x, 2.6 + Math.sin(now * 3) * 0.15, bo.mesh.position.z);
        bo.marker.rotation.y += dt * 2;
      }
      if (bd <= 30) {
        SB.player.damage(8 * dt);
        if (now - bo._shotT > 0.5) {
          bo._shotT = now;
          SB.city.burst(bo.mesh.position.x, 1.3, bo.mesh.position.z, { n: 4, flash: false });
        }
      }
    }
    P.inSight = s > 0 && near;
    buildResponse();
  }

  // Chain setPreset: heat from preset, (re)arm heli/cruisers/cops/roadblock.
  var _sp = SB.engine.setPreset;
  SB.engine.setPreset = function (name) {
    var r = _sp.call(SB.engine, name);
    P.setHeat(SB.state.heat);
    P.ensureHeli(); P.ensureCruisers(); P.ensureCops(true); P.ensureRoadblock();
    if (name === 'onfoot') P.spawnBoss();
    buildResponse();
    return r;
  };
})();
