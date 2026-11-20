'use strict';
/* police.js — wanted 0-5, pursuit, roadblock, foot cops, heli GULL-1 (B2, r5).
   Kontrak: game/API.md §3. Tanpa RNG/jam dinding.
   KRITIS: SB.city.followHero default true — police set false saat ambil alih live. */
(function () {
  var SB = window.SB;
  if (!SB || !SB.engine || !SB.engine.hero) return;
  var hero = function () { return SB.engine.hero; };
  var now = function () { return SB.engine.simTime || 0; };
  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  var rot = function (h, lx, lz) {
    var c = Math.cos(h), s = Math.sin(h);
    return { x: lx * c + lz * s, z: -lx * s + lz * c };
  };
  var T = (typeof THREE !== 'undefined') ? THREE : null;

  var NAMES = ['MARLIN-11', 'SNAPPER-25', 'TARPON-18', 'KESTREL-31', 'IBIS-43', 'HERON-17', 'GULL-1'];

  function box(w, h, d, color, x, y, z) {
    var m = new T.Mesh(new T.BoxGeometry(w, h, d),
      new T.MeshLambertMaterial({ color: color }));
    m.position.set(x, y, z);
    return m;
  }

  function makeCruiser() {
    var g = new T.Group();
    g.add(box(2.0, 0.55, 4.4, 0x1a2a44, 0, 0.55, 0));       /* body navy */
    g.add(box(1.8, 0.5, 2.2, 0xf2f2f2, 0, 1.05, -0.2));     /* cabin putih */
    g.add(box(1.7, 0.28, 0.9, 0x222831, 0, 1.02, 0.9));     /* kap */
    var barR = box(0.55, 0.18, 0.3, 0xff2222, -0.45, 1.38, -0.2);
    var barB = box(0.55, 0.18, 0.3, 0x2244ff, 0.45, 1.38, -0.2);
    g.add(barR); g.add(barB);
    g.add(box(0.35, 0.18, 0.1, 0xfff6c0, -0.6, 0.55, 2.21)); /* headlight */
    g.add(box(0.35, 0.18, 0.1, 0xfff6c0, 0.6, 0.55, 2.21));
    g.add(box(0.3, 0.15, 0.1, 0xff3333, -0.6, 0.55, -2.21)); /* tail */
    g.add(box(0.3, 0.15, 0.1, 0xff3333, 0.6, 0.55, -2.21));
    g.userData.barR = barR; g.userData.barB = barB;
    return g;
  }
  function makeCop() {
    var g = new T.Group();
    g.add(box(0.42, 0.8, 0.3, 0x1a2a44, 0, 0.4, 0));    /* kaki */
    g.add(box(0.55, 0.7, 0.32, 0x24365e, 0, 1.15, 0));  /* torso navy */
    g.add(box(0.34, 0.34, 0.34, 0xc98d64, 0, 1.68, 0)); /* kepala */
    g.add(box(0.4, 0.12, 0.4, 0x101c30, 0, 1.9, 0));    /* topi */
    return g;
  }
  function makeBoss() {
    var g = new T.Group();
    g.scale.set(1.15, 1.15, 1.15);
    g.add(box(0.5, 0.85, 0.34, 0x222222, 0, 0.43, 0));
    g.add(box(0.62, 0.75, 0.36, 0xcc2222, 0, 1.2, 0));  /* kemeja merah */
    g.add(box(0.36, 0.36, 0.36, 0xc98d64, 0, 1.78, 0));
    g.add(box(0.42, 0.14, 0.42, 0x111111, 0, 2.0, 0));  /* bandana */
    return g;
  }
  function addMesh(g) {
    if (g && SB.engine.scene) SB.engine.scene.add(g);
  }
  function dropMesh(g) {
    if (g && SB.engine.scene) SB.engine.scene.remove(g);
  }

  var PL = {
    heatPts: 0, lastCrime: 0,
    response: [], cruisers: [], footCops: [], roadblocks: [],
    heli: null, boss: null
  };
  SB.police = PL;

  PL.stars = function () {
    if (PL.heatPts <= 0) return 0;
    var s = Math.ceil(PL.heatPts / 20);
    return s > 5 ? 5 : s;
  };
  function sync() { SB.state.heat = PL.stars(); }
  PL.setHeat = function (n) {
    n = clamp(n | 0, 0, 5);
    PL.heatPts = n * 20;
    PL.lastCrime = now();
    sync();
    return PL.stars();
  };
  PL.addHeat = function (n) {
    PL.heatPts = clamp(PL.heatPts + n, 0, 100);
    PL.lastCrime = now();
    sync();
    return PL.stars();
  };

  function spawnCop(x, z) {
    var g = T ? makeCop() : null;
    if (g) { g.position.set(x, 0, z); addMesh(g); }
    var c = { x: x, z: z, heading: 0, speed: 0, hp: 100, alive: true,
      name: 'FOOT', userData: { cop: true }, group: g, _near: 0,
      axis: 'x', dir: 1, ph: 0 };
    PL.footCops.push(c);
    if (SB.city && SB.city.peds && SB.city.peds.indexOf(c) < 0) SB.city.peds.push(c);
    return c;
  }
  PL.replaceCop = function (dead) {
    var h = hero();
    var a = 0.9 + PL.footCops.length * 1.1;
    spawnCop(h.x + Math.sin(a) * 40, h.z + Math.cos(a) * 40);
    while (PL.footCops.length > 8) {
      var old = PL.footCops.shift();
      if (old !== dead) dropMesh(old.group);
    }
  };

  PL.spawnBoss = function (x, z) {
    if (PL.boss && PL.boss.alive) {
      PL.boss.alive = false; PL.boss.hp = 0;
      if (PL.boss.group) PL.boss.group.visible = false;
    }
    var g = T ? makeBoss() : null;
    if (g) { g.position.set(x, 0, z); addMesh(g); }
    var b = { x: x, z: z, heading: Math.PI, speed: 0, hp: 220, maxHp: 220,
      alive: true, name: 'SALTJACK', userData: { boss: true }, group: g,
      axis: 'x', dir: 1, ph: 0 };
    PL.boss = b;
    if (SB.city && SB.city.peds) SB.city.peds.push(b);
    return b;
  };

  PL.ensureCops = function (refresh) {
    var h = hero(), i;
    if (refresh) {
      for (i = 0; i < PL.footCops.length; i++) {
        PL.footCops[i].alive = false;
        dropMesh(PL.footCops[i].group);
      }
      PL.footCops = [];
      for (i = 0; i < PL.roadblocks.length; i++) dropMesh(PL.roadblocks[i].group);
      PL.roadblocks = [];
      for (i = 0; i < PL.cruisers.length; i++) {
        if (PL.cruisers[i].extra) dropMesh(PL.cruisers[i].group);
      }
      PL.cruisers = [];
    }
    var heat = PL.stars();
    var nCop = heat >= 4 ? 4 : 2;
    while (PL.footCops.filter(function (c) { return c.alive; }).length < nCop) {
      var idx = PL.footCops.length;
      var a = 0.7 + idx * 2.4, r = 14 + idx * 3;
      spawnCop(h.x + Math.sin(a) * r, h.z + Math.cos(a) * r);
    }
    if (heat >= 4) {
      for (i = 0; i < 2; i++) {
        var fwd = rot(h.heading, (i === 0 ? 2 : -2), 55 + i * 25);
        var g = T ? makeCruiser() : null;
        var rb = { x: h.x + fwd.x, z: h.z + fwd.z, heading: h.heading + Math.PI,
          speed: 0, visible: true, kind: 'roadblock', group: g, extra: true };
        if (g) { g.position.set(rb.x, 0, rb.z); g.rotation.y = rb.heading; addMesh(g); }
        PL.roadblocks.push(rb);
        PL.cruisers.push(rb);
      }
    } else {
      for (i = 0; i < PL.roadblocks.length; i++) {
        PL.roadblocks[i].visible = false;
        if (PL.roadblocks[i].group) PL.roadblocks[i].group.visible = false;
      }
    }
    if (SB.city) PL.heli = SB.city.heli || null;
  };

  function busted() {
    var h = hero();
    if (SB.player) {
      SB.player.cash = Math.max(0, SB.player.cash - 200);
      SB.player.hp = 100; SB.player.armor = 0;
    }
    PL.heatPts = 0; PL.lastCrime = now(); sync();
    h.x = 0; h.z = 120; h.speedKmh = 0;
    if (SB.city) SB.city.followHero = true;
    PL.ensureCops(true);
  }
  function wasted() {
    var h = hero();
    if (SB.player) {
      SB.player.cash = Math.max(0, SB.player.cash - 100);
      SB.player.hp = 100; SB.player.armor = 0;
    }
    PL.heatPts = 0; PL.lastCrime = now(); sync();
    h.x = 0; h.z = 120; h.speedKmh = 0;
    if (SB.city) SB.city.followHero = true;
  }

  PL.tick = function (dt) {
    var h = hero(), t = now(), heat = PL.stars(), i, c, dx, dz, d;
    /* cooldown: -3.5 pts/dtk hanya setelah 12 dtk tanpa kejahatan */
    if (PL.heatPts > 0 && t - PL.lastCrime > 12) {
      PL.heatPts = Math.max(0, PL.heatPts - 3.5 * dt);
      sync();
      heat = PL.stars();
    }
    /* ---- heli GULL-1: police ambil alih, city JANGAN timpa ---- */
    if (SB.city && SB.city.heli) {
      PL.heli = SB.city.heli;
      if (heat >= 2) {
        SB.city.followHero = false;
        /* EMPIRIS (probe B1): heli 38 m di DEPAN hero — offset lokal (6,16,+38)
           dengan rot() ini; (6,16,-38) malah menaruhnya di belakang kamera. */
        var off = rot(h.heading, 6, 38);
        var hx = h.x + off.x, hz = h.z + off.z;
        var hy = 16 + Math.sin(t * 1.3) * 0.6;
        if (SB.city.setHeli) SB.city.setHeli(hx, hy, hz, h.heading);
        else { PL.heli.x = hx; PL.heli.y = hy; PL.heli.z = hz; PL.heli.heading = h.heading; }
        if (PL.heli.cone) PL.heli.cone.visible = true;
        if (PL.heli.ring) PL.heli.ring.visible = true;
      } else {
        SB.city.followHero = true;
        if (PL.heli.cone) PL.heli.cone.visible = heat > 0;
        if (PL.heli.ring) PL.heli.ring.visible = heat > 0;
      }
    }
    /* ---- escorts: Group THREE langsung; police gerakkan posisinya ---- */
    if (SB.city && SB.city.escorts) {
      var offs = [[-5, 4], [5.5, 6]];
      for (i = 0; i < SB.city.escorts.length && i < 2; i++) {
        var e = SB.city.escorts[i];
        if (heat > 0 && e.position) {
          var tp = rot(h.heading, offs[i][0], offs[i][1]);
          var tx = h.x + tp.x, tz = h.z + tp.z;
          var edx = tx - e.position.x, edz = tz - e.position.z;
          var ed = Math.sqrt(edx * edx + edz * edz);
          /* kejar target sampai 45 m/dtk — lerp murni kalah dari laju hero */
          var mv = ed < 0.01 ? 0 : Math.min(ed, 45 * dt);
          e.position.x += (edx / (ed || 1)) * mv;
          e.position.z += (edz / (ed || 1)) * mv;
          e.rotation.y = h.heading;
        }
      }
    }
    /* ---- cruiser kejar ekstra saat heat >= 3 ---- */
    if (heat >= 3) {
      var extras = PL.cruisers.filter(function (x) { return x.extra && x.kind !== 'roadblock'; });
      while (extras.length < 3) {
        var g2 = T ? makeCruiser() : null;
        var ex = { x: h.x - Math.sin(h.heading) * 30, z: h.z - Math.cos(h.heading) * 30,
          heading: h.heading, speed: 0, visible: true, kind: 'chase',
          group: g2, extra: true };
        if (g2) { g2.position.set(ex.x, 0, ex.z); addMesh(g2); }
        PL.cruisers.push(ex);
        extras.push(ex);
      }
      var hSpd = (h.speedKmh || 0) / 3.6;
      for (i = 0; i < extras.length; i++) {
        var ch = extras[i];
        dx = h.x - ch.x; dz = h.z - ch.z;
        d = Math.sqrt(dx * dx + dz * dz);
        ch.heading = Math.atan2(dx, dz);
        if (d > 12) {
          var cs = Math.min(55, hSpd + 8);
          ch.x += Math.sin(ch.heading) * cs * dt;
          ch.z += Math.cos(ch.heading) * cs * dt;
        }
        if (ch.group) {
          ch.group.position.set(ch.x, 0, ch.z);
          ch.group.rotation.y = ch.heading;
          var ph = Math.floor(t * 4) % 2;
          if (ch.group.userData.barR) ch.group.userData.barR.visible = ph === 0;
          if (ch.group.userData.barB) ch.group.userData.barB.visible = ph === 1;
        }
      }
    } else {
      for (i = 0; i < PL.cruisers.length; i++) {
        var cr = PL.cruisers[i];
        if (cr.extra && cr.kind !== 'roadblock' && cr.group) cr.group.visible = false;
      }
    }
    /* ---- foot cops: kejar + tembak; boss ikut tembak.
       Cop digerakkan SENDIRI di sini (speed record 0 supaya engine tak
       menggesernya lewat axis/dir); mesh ikut dari x/z. ---- */
    for (i = 0; i < PL.footCops.length; i++) {
      c = PL.footCops[i];
      if (!c.alive) continue;
      dx = h.x - c.x; dz = h.z - c.z;
      d = Math.sqrt(dx * dx + dz * dz);
      c.heading = Math.atan2(dx, dz);
      var chase = h.mode === 'car' ? 8 : 5.5;
      c.x += Math.sin(c.heading) * chase * dt;
      c.z += Math.cos(c.heading) * chase * dt;
      c.speed = 0;
      if (c.group) {
        c.group.position.set(c.x, 0, c.z);
        c.group.rotation.y = c.heading;
      }
      if (heat >= 2 && d < 30 && SB.player && SB.player.hp > 0) SB.player.hurt(10 * dt);
      if (SB.player && SB.player.onFoot && d < 3 && heat > 0) {
        c._near += dt;
        if (c._near > 2) { busted(); return; }
      } else c._near = 0;
    }
    if (PL.boss && PL.boss.alive && PL.boss.hp > 0) {
      dx = h.x - PL.boss.x; dz = h.z - PL.boss.z;
      d = Math.sqrt(dx * dx + dz * dz);
      if (heat >= 2 && d < 30 && SB.player && SB.player.hp > 0) SB.player.hurt(8 * dt);
    }
    if (SB.player && SB.player.hp <= 0) { wasted(); return; }
    /* ---- response list (diurut jarak) ---- */
    var resp = [];
    if (heat >= 1 && PL.heli) {
      var hd = Math.sqrt(Math.pow((PL.heli.x || 0) - h.x, 2) + Math.pow((PL.heli.z || 0) - h.z, 2));
      resp.push({ name: 'GULL-1', dist: Math.round(hd), status: heat >= 3 ? 'SPOTLIGHT' : 'PURSUIT' });
    }
    function posOf(u) {
      return { x: (u.x != null ? u.x : (u.position ? u.position.x : 0)),
        z: (u.z != null ? u.z : (u.position ? u.position.z : 0)) };
    }
    var allC = [];
    if (SB.city && SB.city.escorts) {
      for (i = 0; i < SB.city.escorts.length; i++) allC.push(SB.city.escorts[i]);
    }
    for (i = 0; i < PL.cruisers.length; i++) {
      if (PL.cruisers[i].visible !== false) allC.push(PL.cruisers[i]);
    }
    for (i = 0; i < allC.length && i < 6; i++) {
      var u = allC[i];
      var up = posOf(u);
      dx = up.x - h.x; dz = up.z - h.z;
      d = Math.sqrt(dx * dx + dz * dz);
      resp.push({ name: NAMES[(i + 1) % (NAMES.length - 1)],
        dist: Math.round(d),
        status: u.kind === 'roadblock' ? 'ROADBLOCK' : (d < 12 ? 'RAMMING' : 'PURSUIT') });
    }
    if (heat >= 1) {
      for (i = 0; i < PL.footCops.length && i < 2; i++) {
        if (!PL.footCops[i].alive) continue;
        dx = PL.footCops[i].x - h.x; dz = PL.footCops[i].z - h.z;
        resp.push({ name: 'FOOT-' + (i + 1), dist: Math.round(Math.sqrt(dx * dx + dz * dz)), status: 'PURSUIT' });
      }
    }
    resp.sort(function (a, b) { return a.dist - b.dist; });
    PL.response = resp.slice(0, 7);
  };

  /* ---- wrap setPreset berantai (police) ---- */
  if (!SB._b2polPreset && SB.engine.setPreset) {
    SB._b2polPreset = true;
    var origPreset = SB.engine.setPreset;
    SB.engine.setPreset = function (name) {
      var r = origPreset.call(SB.engine, name);
      PL.heatPts = (SB.state.heat || 0) * 20;
      PL.lastCrime = now();
      sync();
      PL.ensureCops(true);
      return r;
    };
  }
  PL.heatPts = (SB.state.heat || 0) * 20;
  sync();
})();
