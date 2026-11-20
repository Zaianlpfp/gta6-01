// engine.js — B1 (r5). Three.js setup, loop sim, kamera, preset staging.
// Kontrak lengkap: game/API.md. Tanpa RNG global — hanya SB.engine.rng.
(function () {
  var SB = window.SB = window.SB || {};
  SB.cash = SB.cash || 0;
  SB.state = SB.state || { heat: 0, paused: false, speedKmh: 0, gear: 'N',
    timeMin: 17 * 60 + 24, day: 1, tod: 'SUNSET', season: 'SUMMER',
    district: 'NEON MILE', rep: 0, rank: 'STREET KID' };
  var E = SB.engine = {};
  E.frame = 0; E.simTime = 0; E.preset = 'cover';
  E.hero = { mode: 'car', x: 0, z: 60, heading: Math.PI, speedKmh: 151,
    name: 'VENTO STRADA', cond: 100 };

  // mulberry32 — satu-satunya RNG yang diizinkan.
  E.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  function rotXZ(h, x, z) { // rotasi Y: (x,z) -> (x cos h + z sin h, -x sin h + z cos h)
    var c = Math.cos(h), s = Math.sin(h);
    return [x * c + z * s, -x * s + z * c];
  }
  E._fwd = function (h) { return [Math.sin(h), Math.cos(h)]; }; // [fx, fz]
  E._right = function (h) { return [Math.cos(h), -Math.sin(h)]; };

  // ---------- attach ----------
  E.attach = function (canvas) {
    if (E._attached) return E;
    canvas = canvas || document.getElementById('game-canvas') ||
      document.querySelector('canvas');
    E.canvas = canvas;
    var w = canvas.clientWidth || 1280, h = canvas.clientHeight || 720;
    var R = E.renderer = new THREE.WebGLRenderer({ canvas: canvas,
      antialias: true, preserveDrawingBuffer: true });
    R.setPixelRatio(1); R.setSize(w, h, false);
    R.outputEncoding = THREE.sRGBEncoding;
    var S = E.scene = new THREE.Scene();
    S.fog = new THREE.Fog(0x8a4a6a, 150, 480);
    E.camera = new THREE.PerspectiveCamera(62, w / h, 0.1, 1200);
    E.hemi = new THREE.HemisphereLight(0xffb37a, 0x5a4632, 0.55);
    E.sunL = new THREE.DirectionalLight(0xffb36b, 0.9);
    E.sunL.position.set(-80, 150, 60);
    S.add(E.hemi); S.add(E.sunL); S.add(E.sunL.target);
    E._burstPool();
    SB.city.build();
    E._attached = true;
    E.setTimeOfDay(SB.state.tod);
    return E;
  };

  // ---------- waktu / langit ----------
  E.setTimeOfDay = function (tod) {
    SB.state.tod = tod;
    if (!E.scene) return;
    if (tod === 'NIGHT') {
      E.scene.fog.color.setHex(0x0d1526);
      E.hemi.color.setHex(0x33456e); E.hemi.groundColor.setHex(0x1a1410);
      E.hemi.intensity = 0.4;
      E.sunL.color.setHex(0x8fa8ff); E.sunL.intensity = 0.4;
      E.sunL.position.set(80, 160, -40);
    } else {
      E.scene.fog.color.setHex(0x8a4a6a);
      E.hemi.color.setHex(0xffb37a); E.hemi.groundColor.setHex(0x5a4632);
      E.hemi.intensity = 0.55;
      E.sunL.color.setHex(0xffb36b); E.sunL.intensity = 0.9;
      E.sunL.position.set(-80, 150, 60);
    }
    if (SB.city.setSky) SB.city.setSky(tod);
  };

  // ---------- preset staging ----------
  var P = {
    'cover':     { tod: 'SUNSET', mode: 'car',  x: 0,   z: 60, h: Math.PI, kmh: 151, heat: 4, time: 17 * 60 + 24, t: 24, p: 20, cam: 'chase' },
    'mission':   { tod: 'SUNSET', mode: 'car',  x: 0,   z: 45, h: Math.PI, kmh: 96,  heat: 3, time: 17 * 60 + 24, t: 18, p: 14, cam: 'chase' },
    'night':     { tod: 'NIGHT',  mode: 'car',  x: 0,   z: 45, h: Math.PI, kmh: 88,  heat: 3, time: 21 * 60 + 40, t: 16, p: 18, cam: 'chase' },
    'onfoot':    { tod: 'NIGHT',  mode: 'foot', x: -44, z: 52, h: Math.PI + 0.35, kmh: 0,   heat: 3, time: 21 * 60 + 40, t: 10, p: 26, cam: 'foot' },
    'big-score': { tod: 'SUNSET', mode: 'car',  x: 0,   z: 30, h: Math.PI, kmh: 80,  heat: 4, time: 17 * 60 + 24, t: 20, p: 16, cam: 'chase' },
    'map':       { tod: 'SUNSET', mode: 'car',  x: 0,   z: 60, h: Math.PI, kmh: 0,   heat: 0, time: 17 * 60 + 24, t: 12, p: 10, cam: 'orbit' }
  };
  E.presets = Object.keys(P);
  E.setPreset = function (name) {
    var p = P[name] || P.cover;
    E.preset = name in P ? name : 'cover';
    var H = E.hero;
    H.mode = p.mode; H.x = p.x; H.z = p.z; H.heading = p.h;
    H.speedKmh = p.kmh; H.name = 'VENTO STRADA'; H.cond = 100;
    SB.state.heat = p.heat; SB.state.paused = false;
    SB.state.timeMin = p.time; SB.state.speedKmh = p.kmh;
    SB.state.gear = p.kmh > 120 ? 'G5' : p.kmh > 80 ? 'G4' : p.kmh > 40 ? 'G3' : p.kmh > 0 ? 'G2' : 'N';
    E.frame = 0; E.simTime = 0;
    E.setTimeOfDay(p.tod);
    SB.city.setDensity(p.t, p.p);
    SB.city.placeHeroProps(H); // escorts + parked + heli ikut hero
    SB.state.district = SB.city.districtAt(H.x, H.z);
    E._updateCamera();
    E.render();
    return E;
  };

  E.bootFromQuery = function () {
    var q = {};
    if (typeof SB.parseQuery === 'function') { try { q = SB.parseQuery(); } catch (e) { q = {}; } }
    else {
      var s = (location.search || '').replace(/^\?/, '').split('&');
      for (var i = 0; i < s.length; i++) { var kv = s[i].split('='); if (kv[0]) q[kv[0]] = decodeURIComponent(kv[1] || ''); }
    }
    E.attach();
    E.setPreset(q.scene || 'cover');
    E._startLoop();
    return E;
  };
  E._startLoop = function () {
    if (E._raf) return;
    var tick = function () {
      E._raf = requestAnimationFrame(tick);
      E.step(1 / 60);
      if (SB.missions && SB.missions.update) SB.missions.update(1 / 60);
      if (SB.hud && SB.hud.update) SB.hud.update();
      if (SB.hud && SB.hud.render) SB.hud.render();
    };
    E._raf = requestAnimationFrame(tick);
  };
  E.stop = function () { if (E._raf) cancelAnimationFrame(E._raf); E._raf = 0; };

  // ---------- step ----------
  E.step = function (dt) {
    dt = dt || 1 / 60;
    if (SB.state.paused) { E.render(); return E; }
    E.frame++; E.simTime += dt;
    var H = E.hero;
    if (H.mode === 'car' && H.speedKmh > 0) {
      var f = E._fwd(H.heading);
      H.x += f[0] * H.speedKmh / 3.6 * dt;
      H.z += f[1] * H.speedKmh / 3.6 * dt;
      // loop koridor avenue x=0 supaya hero selalu di koridor pandang
      if (H.z < -90) { H.z = 100; H.x = 0; }
      if (H.z > 110) { H.z = -80; H.x = 0; }
    }
    SB.state.speedKmh = H.speedKmh;
    SB.state.district = SB.city.districtAt(H.x, H.z);
    SB.city.tick(dt, E.simTime, H);
    E._burstTick(dt);
    E._updateCamera();
    E.render();
    return E;
  };
  E.advanceSim = function (n) {
    for (var i = 0; i < n; i++) {
      E.step(1 / 60);
      if (SB.missions && SB.missions.update) SB.missions.update(1 / 60);
    }
    return E;
  };
  E.render = function () {
    if (E.renderer && E.scene && E.camera) E.renderer.render(E.scene, E.camera);
    return E;
  };
  E.shot = function () { E.render(); return E.canvas.toDataURL('image/png'); };

  E.setSpeedKmh = function (v) {
    E.hero.speedKmh = v; SB.state.speedKmh = v;
    SB.state.gear = v > 120 ? 'G5' : v > 80 ? 'G4' : v > 40 ? 'G3' : v > 0 ? 'G2' : 'N';
    return E;
  };
  E.setDensity = function (t, p) { SB.city.setDensity(t, p); return E; };
  Object.defineProperty(E, 'speedKmh', { get: function () { return E.hero.speedKmh; } });
  Object.defineProperty(E, 'camMode', { get: function () {
    return E.preset === 'map' ? 'map' : E.hero.mode === 'foot' ? 'foot' : 'chase';
  } });

  E.muzzlePos = function () {
    var H = E.hero, f = E._fwd(H.heading), r = E._right(H.heading);
    if (H.mode === 'car') return { x: H.x + r[0] * -1.1 + f[0] * 0.6, y: 1.3, z: H.z + r[1] * -1.1 + f[1] * 0.6 };
    return { x: H.x + r[0] * 0.5 + f[0] * 0.7, y: 1.4, z: H.z + r[1] * 0.5 + f[1] * 0.7 };
  };

  // ---------- kamera ----------
  E._updateCamera = function () {
    var C = E.camera, H = E.hero;
    if (!C) return;
    var f = E._fwd(H.heading), r = E._right(H.heading);
    if (E.preset === 'map') {
      C.position.set(0, 155, 85); C.lookAt(0, 0, 10); return;
    }
    if (H.mode === 'foot') {
      C.position.set(H.x - f[0] * 5.2, 2.6, H.z - f[1] * 5.2);
      C.lookAt(H.x + f[0] * 6, 1.6, H.z + f[1] * 6);
      return;
    }
    C.position.set(H.x - f[0] * 7.5, 2.3, H.z - f[1] * 7.5);
    C.lookAt(H.x + f[0] * 10, 2.0, H.z + f[1] * 10);
  };

  // ---------- muzzle flash: pool persisten ----------
  E._burstPool = function () {
    var g = new THREE.Group(); g.visible = false;
    var geo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    var cols = [0xffe27a, 0xffb13d, 0xfff6c8];
    E._burstBoxes = [];
    for (var i = 0; i < 96; i++) {
      var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: cols[i % 3] }));
      m.visible = false; g.add(m); E._burstBoxes.push(m);
    }
    var cv = document.createElement('canvas'); cv.width = cv.height = 64;
    var cx = cv.getContext('2d');
    var gr = cx.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(255,244,180,1)'); gr.addColorStop(0.4, 'rgba(255,180,60,0.85)');
    gr.addColorStop(1, 'rgba(255,120,20,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
    E._burstSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv), blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true }));
    E._burstSprite.scale.set(2.2, 2.2, 1); g.add(E._burstSprite);
    E._burstLight = new THREE.PointLight(0xffc860, 0, 14, 2);
    g.add(E._burstLight);
    E._burstGroup = g; E._burstT = 99;
    E.scene.add(g);
  };
  E.burst = function (pos) {
    var g = E._burstGroup; if (!g) return E;
    var rng = E.rng(E.frame * 7 + 13);
    g.position.set(pos.x, pos.y, pos.z);
    for (var i = 0; i < E._burstBoxes.length; i++) {
      var b = E._burstBoxes[i];
      b.visible = true;
      b.position.set((rng() - 0.5) * 0.5, (rng() - 0.5) * 0.5, (rng() - 0.5) * 0.5);
      b.userData.vx = (rng() - 0.5) * 9; b.userData.vy = (rng() - 0.5) * 9;
      b.userData.vz = (rng() - 0.5) * 9;
    }
    E._burstSprite.visible = true;
    E._burstLight.intensity = 2.4;
    g.visible = true; E._burstT = 0;
    E.render();
    return E;
  };
  E._burstTick = function (dt) {
    var g = E._burstGroup; if (!g || !g.visible) return;
    E._burstT += dt;
    for (var i = 0; i < E._burstBoxes.length; i++) {
      var b = E._burstBoxes[i];
      b.position.x += b.userData.vx * dt; b.position.y += b.userData.vy * dt;
      b.position.z += b.userData.vz * dt;
      b.visible = E._burstT < 0.09;
    }
    E._burstSprite.material.opacity = Math.max(0, 1 - E._burstT / 0.09);
    E._burstLight.intensity = Math.max(0, 2.4 * (1 - E._burstT / 0.09));
    if (E._burstT >= 0.09) g.visible = false;
  };
})();
