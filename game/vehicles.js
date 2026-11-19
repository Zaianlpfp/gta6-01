// vehicles.js — B2 v4-rebuild r4. Hero + parked cars, driving physics, collisions.
// Hero record starts as the pink VENTO STRADA; stealing swaps it (donor hidden,
// heroCar body recoloured — materials are per-car, so no other car changes).
(function () {
  var SB = window.SB;
  var NAMES = ['STRADA', 'COMET', 'FELON', 'DUKES', 'SULTAN', 'SABRE', 'VOODOO', 'MANANA', 'PEYOTE', 'BUCCANEER'];
  var COLORS = [0xe8e8e8, 0x2244cc, 0xcc2222, 0xffc93c, 0x22aa66, 0x888888, 0x111111, 0xff8800, 0x8844aa, 0x44ccdd];

  function gear(kmh) {
    if (kmh === undefined) kmh = SB.engine.hero.speedKmh;
    if (kmh < 0) return 'R';
    if (kmh < 1) return 'N';
    if (kmh < 35) return 'G1';
    if (kmh < 70) return 'G2';
    if (kmh < 110) return 'G3';
    if (kmh < 135) return 'G4';
    return 'G5';
  }
  // gear is callable (gear(120) -> 'G4') AND reads as the current gear in
  // string position ('GEAR ' + SB.vehicles.gear -> 'GEAR G5').
  var gearFn = function (kmh) { return gear(kmh); };
  gearFn.toString = function () { return gear(); };
  gearFn.valueOf = gearFn.toString;

  var V = SB.vehicles = {
    list: [], hero: null, parked: [], _prev: null, _rbHit: 0, _hitT: 0, _stolen: false,
    gear: gearFn,
    setSpeedKmh: function (kmh) { SB.engine.setSpeedKmh(kmh); return kmh; },
    ensureHero: function () {
      if (V.hero && V._stolen) return V.hero;
      V.hero = { name: 'VENTO STRADA', color: 0xff5fa2, cond: 100, kind: 'car', mesh: SB.city.heroCar, hero: true };
      V._stolen = false;
      return V.hero;
    },
    spawnParked: function () {
      var rnd = SB.engine.rng(77031);
      V.parked = SB.city.parked.map(function (g) {
        if (!(V._stolen && V.hero && V.hero.mesh === g)) g.visible = true;
        var nm = NAMES[Math.floor(rnd() * NAMES.length)];
        var col = COLORS[Math.floor(rnd() * COLORS.length)];
        var cond = 55 + Math.floor(rnd() * 41);
        var body = g.children[0];
        if (body && body.material && body.material.color) body.material.color.setHex(col);
        return { name: nm, color: col, cond: cond, kind: 'car', mesh: g, parked: true, x: g.position.x, z: g.position.z };
      });
      return V.parked;
    },
    rebuildList: function () {
      V.list = [];
      if (V.hero) V.list.push(V.hero);
      for (var i = 0; i < V.parked.length; i++) {
        if (!V.parked[i].stolen) V.list.push(V.parked[i]);
      }
      var tr = SB.city.traffic;
      for (var j = 0; j < tr.length; j++) {
        var t = tr[j];
        if (!t.mesh.visible) continue;
        var col = 0xcccccc;
        var b0 = t.mesh.children[0];
        if (b0 && b0.material && b0.material.color) col = b0.material.color.getHex();
        V.list.push({
          name: (t.kind === 'cruiser' ? 'CRUISER' : NAMES[(j * 7) % NAMES.length]),
          color: col, cond: 60 + ((j * 13) % 35), kind: t.kind || 'car',
          mesh: t.mesh, traffic: t
        });
      }
      return V.list;
    },
    nearest: function (x, z, maxD) {
      var list = V.rebuildList(), best = null, bd = (maxD === undefined ? 1e9 : maxD);
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (r === V.hero) continue;
        var m = r.mesh;
        if (!m || !m.visible) continue;
        var dx = m.position.x - x, dz = m.position.z - z, d = Math.sqrt(dx * dx + dz * dz);
        if (d < bd) { bd = d; best = r; }
      }
      return best;
    },
    steal: function (rec) {
      if (!rec || rec === V.hero) return false;
      if (rec.traffic) {
        var arr = SB.city.traffic, ix = arr.indexOf(rec.traffic);
        if (ix < 0) return false;
        arr.splice(ix, 1);
        rec.traffic.active = false;
        rec.mesh.visible = false;
      } else if (rec.parked) {
        rec.stolen = true;
        rec.mesh.visible = false;
        var pi = V.parked.indexOf(rec);
        if (pi >= 0) V.parked.splice(pi, 1);
      } else { return false; }
      V.hero = rec; V._stolen = true; V.hero.hero = true;
      var m = SB.city.heroCar.children[0];
      if (m && m.material && m.material.color) m.material.color.setHex(rec.color);
      if (SB.police) SB.police.addHeat(12);
      V.rebuildList();
      return true;
    },
    update: function (dt) {
      var hero = SB.engine.hero;
      if (!SB.player || SB.player.onFoot || hero.mode !== 'car') return;
      var K = SB._b2keys || {};
      var kmh = hero.speedKmh;
      var fwd = K.KeyW || K.ArrowUp, back = K.KeyS || K.ArrowDown;
      if (fwd) kmh += 55 * dt;
      else if (back) { if (kmh > 0.5) kmh -= 90 * dt; else kmh -= 30 * dt; }
      else if (kmh > 0) kmh = Math.max(0, kmh - 18 * dt);
      else if (kmh < 0) kmh = Math.min(0, kmh + 18 * dt);
      var top = 151;
      if (V.hero && V.hero.cond < 30) top = 90;
      if (kmh > top) kmh = top;
      if (kmh < -32) kmh = -32;
      var steer = 0;
      if (K.KeyA || K.ArrowLeft) steer += 1;
      if (K.KeyD || K.ArrowRight) steer -= 1;
      if (steer && kmh !== 0) {
        var rate = 1.9 * Math.min(1, Math.abs(kmh) / 45);
        hero.heading += steer * rate * dt * (kmh < 0 ? -1 : 1);
      }
      SB.engine.setSpeedKmh(kmh);
      var now = SB.engine.simTime;
      var rb = SB.police && SB.police.roadblock;
      if (rb && rb.active && rb.cars) {
        for (var i = 0; i < rb.cars.length; i++) {
          var c = rb.cars[i];
          if (!c.g || !c.g.visible) continue;
          var dx = c.g.position.x - hero.pos.x, dz = c.g.position.z - hero.pos.z;
          if (dx * dx + dz * dz < 20.25 && now - V._rbHit > 3) {
            V._rbHit = now;
            SB.engine.setSpeedKmh(SB.engine.hero.speedKmh * 0.45);
            if (V.hero) V.hero.cond = Math.max(0, V.hero.cond - 10);
            if (SB.police) SB.police.addHeat(5);
            break;
          }
        }
      }
      if (now - V._hitT > 0.6) {
        var tr = SB.city.traffic;
        for (var j = 0; j < tr.length; j++) {
          var t = tr[j];
          if (!t.mesh.visible) continue;
          var ex = t.mesh.position.x - hero.pos.x, ez = t.mesh.position.z - hero.pos.z;
          if (ex * ex + ez * ez < 16) {
            V._hitT = now;
            SB.engine.setSpeedKmh(SB.engine.hero.speedKmh * 0.72);
            if (V.hero) V.hero.cond = Math.max(0, V.hero.cond - 3);
            break;
          }
        }
      }
      V._prev = { x: hero.pos.x, z: hero.pos.z };
    }
  };
  // Chain setPreset: (re)build hero + parked + list after the engine staged.
  var _sp = SB.engine.setPreset;
  SB.engine.setPreset = function (name) {
    var r = _sp.call(SB.engine, name);
    V.ensureHero(); V.spawnParked(); V.rebuildList();
    V._rbHit = 0; V._hitT = 0;
    return r;
  };
})();
