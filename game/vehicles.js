'use strict';
/* vehicles.js — VENTO STRADA (mobil pink pemain), mobil parkir, gear, tabrakan
   roadblock (B2, r5). Kontrak: game/API.md §3. Tanpa RNG/jam dinding.
   Pakai ulang SB.city.heroCar/heroPed — JANGAN duplikat mesh hero. */
(function () {
  var SB = window.SB;
  if (!SB || !SB.engine || !SB.engine.hero) return;
  var hero = function () { return SB.engine.hero; };
  var now = function () { return SB.engine.simTime || 0; };
  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };

  var V = {
    list: [],
    hero: null,
    _crashT: -99
  };
  SB.vehicles = V;

  V.gear = function (kmh) {
    if (kmh < 0) return 'R';
    if (kmh < 0.5) return 'N';
    if (kmh < 25) return 'G1';
    if (kmh < 55) return 'G2';
    if (kmh < 90) return 'G3';
    if (kmh < 130) return 'G4';
    return 'G5';
  };
  V.setSpeedKmh = function (v) {
    hero().speedKmh = v;
    SB.state.speedKmh = v;
    return v;
  };

  function rebuildList() {
    var h = hero();
    h.name = 'VENTO STRADA';
    if (h.cond == null) h.cond = 100;
    V.hero = h;
    var list = [{ x: h.x, z: h.z, heading: h.heading, name: 'VENTO STRADA',
      cond: h.cond, isHero: true, group: SB.city ? SB.city.heroCar : null }];
    var parked = (SB.city && SB.city.parked) || [];
    var names = ['OCEANIC GT', 'PALMETTO', 'SANCHEZ', 'TAXI SOL', 'BURRITO', 'COMET'];
    for (var i = 0; i < parked.length; i++) {
      var p = parked[i];
      /* parked = Group THREE langsung: posisi di group.position */
      var px = (p.x != null) ? p.x : (p.position ? p.position.x : 0);
      var pz = (p.z != null) ? p.z : (p.position ? p.position.z : 0);
      var ph = (p.heading != null) ? p.heading : (p.rotation ? p.rotation.y : 0);
      list.push({ x: px, z: pz, heading: ph,
        name: names[i % names.length], cond: 55 + ((i * 7) % 45),
        isHero: false, parked: true, group: (p.isGroup ? p : (p.group || null)) });
    }
    V.list = list;
  }

  V.nearest = function (x, z) {
    var best = null, bestD = 1e9, i, v, dx, dz, d;
    for (i = 0; i < V.list.length; i++) {
      v = V.list[i];
      /* posisi mobil hero hanya ikut hero saat dikendarai; saat jalan kaki
         mobil tetap di tempat turun (jangan jarak 0 terus-menerus). */
      if (v.isHero && hero().mode === 'car') { v.x = hero().x; v.z = hero().z; v.heading = hero().heading; }
      dx = v.x - x; dz = v.z - z;
      d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) { bestD = d; best = v; }
    }
    if (!best || bestD > 6) return null;
    best.dist = bestD;
    return best;
  };

  /* Tabrakan roadblock: laju tinggi + dekat cruiser roadblock -> hantam. */
  V.tick = function (dt) {
    var h = hero();
    if (h.mode !== 'car') return;
    var sp = h.speedKmh || 0;
    if (sp < 40) return;
    if (!SB.police || !SB.police.roadblocks) return;
    if (now() - V._crashT < 2) return;
    var rbs = SB.police.roadblocks, i, rb, dx, dz, d;
    for (i = 0; i < rbs.length; i++) {
      rb = rbs[i];
      if (!rb || rb.visible === false) continue;
      dx = rb.x - h.x; dz = rb.z - h.z;
      d = Math.sqrt(dx * dx + dz * dz);
      if (d < 4) {
        V._crashT = now();
        h.speedKmh = sp * 0.35;
        SB.state.speedKmh = h.speedKmh;
        h.cond = clamp((h.cond == null ? 100 : h.cond) - 10, 0, 100);
        if (SB.police.addHeat) SB.police.addHeat(5);
        break;
      }
    }
  };

  /* ---- wrap setPreset berantai (vehicles) ---- */
  if (!SB._b2vehPreset && SB.engine.setPreset) {
    SB._b2vehPreset = true;
    var origPreset = SB.engine.setPreset;
    SB.engine.setPreset = function (name) {
      var r = origPreset.call(SB.engine, name);
      var h = hero();
      h.name = 'VENTO STRADA';
      h.cond = 100;
      rebuildList();
      return r;
    };
  }
  rebuildList();
})();
