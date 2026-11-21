// engine.js — Solmar Bay engine: Three.js boot, sim loop, chase camera, effects.
// Fresh write for gta6-01 v4 rebuild r13 (from game/API.md §0-§3).
// Deterministic: no built-in nondeterministic sources in game code.
// All randomness goes through SB.rng() (mulberry32, seed 1337).
(function () {
  'use strict';
  var SB = window.SB = window.SB || {};

  // ---------- deterministic RNG (mulberry32, API.md §1) ----------
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  SB.rng = function (seed) { return mulberry32(seed == null ? 1337 : seed); };
  SB.rand = SB.rng(1337);
  SB.rngReset = function () { SB.rand = SB.rng(1337); };
  SB.randRange = function (a, b) { return a + SB.rand() * (b - a); };
  SB.randInt = function (a, b) { return Math.floor(SB.randRange(a, b + 1)); };
  SB.randPick = function (arr) { return arr[SB.randInt(0, arr.length - 1)]; };

  // ---------- global state (API.md §2) ----------
  SB.state = {
    paused: false, heat: 0, rep: 0, cash: 0,
    day: 1, hour: 17, min: 24, timeLabel: 'SUNSET',
    clockRate: 1, simTime: 0, preset: 'cover',
    speedKmh: 0, vehicleName: '—', vehicleCond: 100, vehicleStatus: 'OK',
    inSight: false, objective: '', staging: false
  };
  SB._clockMin = 17 * 60 + 24;
  SB.cash = 0;

  // ---------- update callbacks (API.md §3) ----------
  // SB.registerUpdate(fn): called by E.step(dt) EVERY tick, after simTime/clock/
  // police/peds/flash and BEFORE render, so HUD and other modules always read
  // the freshest state. Registered once (duplicates ignored); one callback's
  // error never stops the others (try/catch per callback).
  var _updates = [];
  SB.registerUpdate = function (fn) {
    if (typeof fn !== 'function') return;
    if (_updates.indexOf(fn) === -1) _updates.push(fn);
  };
  SB.unregisterUpdate = function (fn) {
    var i = _updates.indexOf(fn);
    if (i !== -1) _updates.splice(i, 1);
  };

  // ---------- engine ----------
  var E = SB.engine = {};
  E.scene = null; E.camera = null; E.renderer = null; E.canvas = null; E.sun = null;
  E.muzzlePos = null;

  var _running = false, _rafId = 0, _lastPerf = 0;
  var _clouds = [];
  var _flashes = [], _flashLight = null;
  var _camPos = null, _camLook = null;
  var _follow = { pos: [10.5, 5.4, 19.5], look: [-0.5, 1.6, -4] };

  // Preset table (API.md §3). cam/look = absolute snapshot on setPreset;
  // follow = offset relative to the hero, used by the chase camera in step().
  var PRESETS = {
    cover: {
      heat: 4, clockMin: 17 * 60 + 24,
      // r13 integration: probe c7-close — camera SE of the car, low and
      // close, so the bank sign reads FULL ("SOLMAR NATIONAL BANK") and
      // the pink car + cruisers fill the frame. The old offset
      // (10.5,5.4,19.5) put a brown Deco Row facade across half the frame
      // and clipped the sign to "SOLMAR NA".
      cam: [8, 5, 12], look: [2, 5, -2],
      follow: { pos: [8, 5, 12], look: [2, 5, -2] }
    },
    onfoot: {
      heat: 2, clockMin: 18 * 60 + 5,
      cam: [0, 5.0, 50], look: [0, 1.3, 38],
      follow: { pos: [0, 5.0, 10], look: [0, 1.3, -2] }
    },
    mission: {
      heat: 5, clockMin: 17 * 60 + 48,
      cam: [0, 6.2, 26], look: [2, 2.2, 4],
      follow: { pos: [-2, 6.2, 16], look: [0, 2.2, -6] }
    },
    drive: {
      heat: 4, clockMin: 17 * 60 + 24,
      // r13 integration: centred chase camera for the drive shot. The cover
      // offset (8,5,12) puts a maroon facade across ~35% of the frame while
      // driving north; centred, the road runs straight ahead, car centred.
      cam: [0, 5, 12], look: [2, 5, -2],
      follow: { pos: [0, 5, 12], look: [2, 5, -2] }
    },
    map: {
      heat: 0, clockMin: 12 * 60,
      cam: [0, 220, 0.1], look: [0, 0, 0],
      follow: { pos: [0, 220, 0.1], look: [0, 0, 0] }
    },
    free: {
      heat: 0, clockMin: 12 * 60,
      cam: [0, 6, 12], look: [0, 1.5, 0],
      follow: { pos: [0, 6, 12], look: [0, 1.5, 0] }
    }
  };

  function _syncClock() {
    var hm = Math.floor(SB._clockMin);
    SB.state.hour = Math.floor(hm / 60) % 24;
    SB.state.min = hm % 60;
    // NIGHT 20-05, SUNSET 17-19, DAY 06-16 (API.md §0)
    SB.state.timeLabel = (SB.state.hour >= 20 || SB.state.hour < 5)
      ? 'NIGHT' : (SB.state.hour >= 17 ? 'SUNSET' : 'DAY');
  }

  // ---------- sky: gradient dome + sun disc + drifting clouds ----------
  function _skyTexture() {
    var c = document.createElement('canvas'); c.width = 4; c.height = 256;
    var g = c.getContext('2d');
    var grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#241a4d');
    grad.addColorStop(0.45, '#7a3d7e');
    grad.addColorStop(0.72, '#ff7e5f');
    grad.addColorStop(0.88, '#ffd27a');
    grad.addColorStop(1.0, '#ffb36b');
    g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function _buildSky() {
    var sky = new THREE.Mesh(
      new THREE.SphereGeometry(700, 24, 16),
      new THREE.MeshBasicMaterial({ map: _skyTexture(), side: THREE.BackSide, fog: false })
    );
    E.scene.add(sky);
    // sun disc toward the directional light
    var dir = new THREE.Vector3(-8, 150, -420).normalize();
    var disc = new THREE.Mesh(
      new THREE.CircleGeometry(26, 32),
      new THREE.MeshBasicMaterial({ color: 0xffdf9e, fog: false })
    );
    disc.position.copy(dir).multiplyScalar(640);
    disc.lookAt(0, 0, 0);
    E.scene.add(disc);
    // clouds: flattened sphere clusters, drift = pure function of simTime
    _clouds = [];
    var mat = new THREE.MeshLambertMaterial({
      color: 0xfff2e0, transparent: true, opacity: 0.85, fog: false
    });
    for (var i = 0; i < 10; i++) {
      var grp = new THREE.Group();
      var n = 3 + SB.randInt(0, 2);
      for (var j = 0; j < n; j++) {
        var s = new THREE.Mesh(new THREE.SphereGeometry(SB.randRange(6, 12), 8, 6), mat);
        s.scale.y = 0.35;
        s.position.set(j * SB.randRange(6, 10) - n * 4, SB.randRange(-1, 1), SB.randRange(-3, 3));
        grp.add(s);
      }
      var bx = SB.randRange(-220, 220), bz = SB.randRange(-180, 200);
      grp.position.set(bx, SB.randRange(60, 95), bz);
      grp.userData.bx = bx;
      grp.userData.ph = SB.randRange(0, 6.28);
      E.scene.add(grp);
      _clouds.push(grp);
    }
  }

  // ---------- muzzle-flash pool (persistent, built once) ----------
  function _flashTexture() {
    var c = document.createElement('canvas'); c.width = 64; c.height = 64;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,220,1)');
    grad.addColorStop(0.4, 'rgba(255,200,90,0.85)');
    grad.addColorStop(1, 'rgba(255,160,40,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  function _buildFlashes() {
    var tex = _flashTexture();
    _flashes = [];
    for (var i = 0; i < 8; i++) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false
      }));
      sp.scale.set(3, 3, 1);
      sp.visible = false;
      E.scene.add(sp);
      _flashes.push({ sprite: sp, life: 0 });
    }
    _flashLight = new THREE.PointLight(0xffc860, 0, 18, 2);
    _flashLight.visible = false;
    E.scene.add(_flashLight);
  }

  E.burst = function (x, y, z, n) {
    var lit = 0, want = n || 1;
    for (var i = 0; i < _flashes.length && lit < want; i++) {
      var fl = _flashes[i];
      if (fl.life <= 0) {
        fl.sprite.position.set(x, y, z);
        fl.sprite.visible = true;
        fl.life = 0.12;
        lit++;
      }
    }
    if (lit > 0 && _flashLight) {
      _flashLight.position.set(x, y, z);
      _flashLight.intensity = 60;
      _flashLight.visible = true;
    }
  };

  // Heli spotlight cone (API.md §3): opacity 0.10, radius 5, height 36.
  // DO NOT raise the opacity — r8's 0.25 whited out the bank sign.
  E.spotCone = function () {
    var geo = new THREE.ConeGeometry(5, 36, 24, 1, true);
    var mat = new THREE.MeshBasicMaterial({
      color: 0xfff2b0, transparent: true, opacity: 0.10,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
    });
    return new THREE.Mesh(geo, mat);
  };

  E.heroPos = function () {
    // Controlled position: the vehicle when driving, the hero on foot.
    // P.pos() already implements this. The raw hero mesh stays at its
    // on-foot spawn (0,40) while driving (enterVehicle only hides it),
    // so reading the mesh directly strands the chase camera, police
    // pursuit, mission GPS and minimap at the spawn point (r13 find:
    // cover + drive shots showed the same static view, car absent).
    if (SB.player && typeof SB.player.pos === 'function') {
      try {
        var pp = SB.player.pos();
        if (pp && typeof pp[0] === 'number' && typeof pp[1] === 'number') return [pp[0], pp[1]];
      } catch (e) { /* fall through to the mesh */ }
    }
    if (SB.player && SB.player.hero && SB.player.hero.position) {
      return [SB.player.hero.position.x, SB.player.hero.position.z];
    }
    if (SB.city && SB.city.spawnPoints && SB.city.spawnPoints[SB.state.preset]) {
      return SB.city.spawnPoints[SB.state.preset].slice();
    }
    return [0, 0];
  };

  // ---------- chase camera ----------
  E._chaseCamera = function (dt) {
    if (!E.camera) return;
    var hp = E.heroPos();
    var dx, dy, dz, lx, ly, lz;
    if (SB.state.preset === 'map') {
      dx = hp[0]; dy = 220; dz = hp[1] + 0.1;
      lx = hp[0]; ly = 0; lz = hp[1];
    } else {
      dx = hp[0] + _follow.pos[0]; dy = _follow.pos[1]; dz = hp[1] + _follow.pos[2];
      lx = hp[0] + _follow.look[0]; ly = _follow.look[1]; lz = hp[1] + _follow.look[2];
    }
    // smooth follow; deterministic (depends only on dt and state)
    var k = 1 - Math.exp(-6 * dt);
    _camPos.x += (dx - _camPos.x) * k;
    _camPos.y += (dy - _camPos.y) * k;
    _camPos.z += (dz - _camPos.z) * k;
    _camLook.x += (lx - _camLook.x) * k;
    _camLook.y += (ly - _camLook.y) * k;
    _camLook.z += (lz - _camLook.z) * k;
    E.camera.position.copy(_camPos);
    E.camera.lookAt(_camLook);
  };

  // ---------- the sim tick (API.md §3) ----------
  // Order: simTime -> clock -> clouds -> peds -> police (ONLY caller here) ->
  // muzzle-flash decay -> registerUpdate callbacks -> chase camera -> render.
  // dt LIVE = wall-clock, CAP 1.0 second. NEVER 0.05 in any loop.
  E.step = function (dt) {
    if (dt == null || dt <= 0) dt = 1 / 60;
    if (dt > 1) dt = 1;
    var S = SB.state;
    S.simTime += dt;
    SB._clockMin += dt * S.clockRate;
    _syncClock();

    // clouds drift (pure function of simTime)
    for (var i = 0; i < _clouds.length; i++) {
      var cl = _clouds[i];
      cl.position.x = cl.userData.bx + Math.sin(S.simTime * 0.01 + cl.userData.ph) * 12;
    }

    // ambient peds (pure function of simTime, API.md §4)
    if (SB.city && SB.city.peds) {
      var peds = SB.city.peds;
      for (var p = 0; p < peds.length; p++) {
        var ped = peds[p], pu = ped.userData;
        var off = Math.sin(S.simTime * 0.22 * pu.sp + pu.walkPhase) * 6;
        if (pu.axis === 'x') { ped.position.x = pu.bx + off; ped.position.z = pu.bz; }
        else { ped.position.z = pu.bz + off; ped.position.x = pu.bx; }
        ped.position.y = Math.abs(Math.sin(S.simTime * 2.2 * pu.sp + pu.walkPhase)) * 0.06;
      }
    }

    // ambient traffic (pure function of simTime; wraps along its road)
    if (SB.city && SB.city.traffic) {
      var tr = SB.city.traffic;
      for (var t = 0; t < tr.length; t++) {
        var car = tr[t], u = car.userData;
        var along = u.base + S.simTime * u.speed * u.dir;
        var m = ((along % u.span) + u.span) % u.span;
        if (u.axis === 'x') {
          car.position.x = u.min + m; car.position.z = u.lane;
          car.rotation.y = u.dir > 0 ? 0 : Math.PI;
        } else {
          car.position.z = u.min + m; car.position.x = u.lane;
          car.rotation.y = u.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
        }
      }
    }

    // police: step() is the ONLY caller (API.md §3, §7)
    if (SB.police && typeof SB.police.update === 'function') {
      try { SB.police.update(dt); } catch (err) { /* one module must not kill the tick */ }
    }

    // muzzle-flash decay
    for (var f = 0; f < _flashes.length; f++) {
      var fl = _flashes[f];
      if (fl.life > 0) {
        fl.life -= dt;
        if (fl.life <= 0) fl.sprite.visible = false;
      }
    }
    if (_flashLight && _flashLight.visible) {
      _flashLight.intensity *= Math.max(0, 1 - dt * 12);
      if (_flashLight.intensity < 1) _flashLight.visible = false;
    }

    // registerUpdate callbacks (HUD etc. read the freshest state here)
    for (var u2 = 0; u2 < _updates.length; u2++) {
      try { _updates[u2](dt); } catch (err2) { /* keep going */ }
    }

    E._chaseCamera(dt);
    if (E.renderer && E.scene && E.camera) E.renderer.render(E.scene, E.camera);
  };

  // ---------- boot / presets / loop ----------
  E.boot = function (opts) {
    opts = opts || {};
    var w = opts.w || 1280, h = opts.h || 720;
    if (typeof THREE === 'undefined') throw new Error('three.js not loaded');
    SB.rngReset();
    var host = document.getElementById('game') || document.body;
    E.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    E.renderer.setSize(w, h);
    E.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    E.renderer.shadowMap.enabled = false;
    E.canvas = E.renderer.domElement;
    host.appendChild(E.canvas);
    E.scene = new THREE.Scene();
    E.scene.background = new THREE.Color(0x1c1440);
    E.scene.fog = new THREE.Fog(0xe8a56b, 80, 520);
    var hemi = new THREE.HemisphereLight(0xffe0b3, 0x3a2a4a, 0.85);
    E.scene.add(hemi);
    // sun: FIXED position (-8, 150, -420) in every sunset preset (API.md §3)
    E.sun = new THREE.DirectionalLight(0xffb36b, 1.5);
    E.sun.position.set(-8, 150, -420);
    E.scene.add(E.sun);
    E.scene.add(E.sun.target);
    _buildSky();
    E.camera = new THREE.PerspectiveCamera(62, w / h, 0.1, 1200);
    _camPos = new THREE.Vector3(10.5, 5.4, 19.5);
    _camLook = new THREE.Vector3(-0.5, 1.6, -4);
    E.muzzlePos = new THREE.Vector3(0, 1.5, 0);
    _buildFlashes();
    if (SB.city && typeof SB.city.build === 'function') {
      SB.rngReset();
      SB.city.build(E.scene);
    }
    E.start();
    return E;
  };

  E.setPreset = function (name, opts) {
    var p = PRESETS[name] || PRESETS.cover;
    opts = opts || {};
    SB.state.preset = name;
    SB.state.heat = (opts.heat != null) ? opts.heat : p.heat;
    if (opts.hour != null) SB._clockMin = opts.hour * 60 + (opts.min || 0);
    else SB._clockMin = p.clockMin;
    _syncClock();
    _follow = p.follow;
    // snap camera to the preset (no lerp on the first frame)
    if (_camPos) _camPos.set(p.cam[0], p.cam[1], p.cam[2]);
    if (_camLook) _camLook.set(p.look[0], p.look[1], p.look[2]);
    if (E.camera) { E.camera.position.copy(_camPos); E.camera.lookAt(_camLook); }
    // optional placement hooks (B2 defines these; engine works without them)
    if (SB.player && typeof SB.player.placeHero === 'function') {
      try { SB.player.placeHero(name); } catch (err) { /* keep going */ }
    }
    if (SB.vehicles && typeof SB.vehicles.placeForPreset === 'function') {
      try { SB.vehicles.placeForPreset(name); } catch (err2) { /* keep going */ }
    }
    return p;
  };

  E.bootFromQuery = function () {
    var q = {};
    var s = (window.location.search || '').replace(/^\?/, '');
    if (s) {
      s.split('&').forEach(function (kv) {
        var parts = kv.split('=');
        if (parts[0]) q[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || '');
      });
    }
    var scene = q.scene || 'cover';
    E.boot({ preset: scene });
    var opts = {};
    if (q.heat != null && q.heat !== '') opts.heat = parseInt(q.heat, 10);
    if (q.hour != null && q.hour !== '') opts.hour = parseInt(q.hour, 10);
    E.setPreset(scene, opts);
    return E;
  };

  E.start = function () {
    if (_running) return;
    _running = true;
    _lastPerf = performance.now();
    var loop = function () {
      if (!_running) return;
      _rafId = requestAnimationFrame(loop);
      var now = performance.now();
      var dt = (now - _lastPerf) / 1000;
      _lastPerf = now;
      if (dt > 1) dt = 1;      // CAP 1.0 — never 0.05
      if (dt <= 0) dt = 1 / 60;
      if (!SB.state.paused) E.step(dt);
      else if (E.renderer && E.scene && E.camera) E.renderer.render(E.scene, E.camera);
    };
    _rafId = requestAnimationFrame(loop);
  };

  E.stop = function () {
    _running = false;
    if (_rafId) cancelAnimationFrame(_rafId);
    _rafId = 0;
  };

  // Screenshot: render, then JPEG data-URL (API.md §3). This is THE way to
  // screenshot — never Playwright page.screenshot (TIMEOUT in swiftshader).
  E.shot = function () {
    if (!E.renderer || !E.canvas) return '';
    E.renderer.render(E.scene, E.camera);
    return E.canvas.toDataURL('image/jpeg', 0.92);
  };
})();
