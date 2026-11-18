(function () {
  'use strict';

  var SB = window.SB = window.SB || {};
  SB.version = '3.0.0-b1';

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  SB.mulberry32 = mulberry32;
  SB.rng = mulberry32(1337);

  function rand(a, b) { return a + SB.rng() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function pick(arr) { return arr[Math.floor(SB.rng() * arr.length)]; }
  function chance(p) { return SB.rng() < p; }
  SB.rand = rand; SB.randInt = randInt; SB.pick = pick; SB.chance = chance;

  function reseed(seed) {
    SB.state.seed = seed >>> 0;
    SB.rng = mulberry32(SB.state.seed);
  }
  SB.reseed = reseed;

  var DAY_NAMES = ['FRI', 'SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU'];
  var REP_THRESHOLDS = [0, 300, 900, 1600, 2400, 4200];
  var REP_TITLES = ['STREET KID', 'CORNER HUSTLER', 'NEON RUNNER', 'BAY HUSTLER', 'SOLMAR KING'];

  function defaultState() {
    return {
      seed: 1337, cash: 250, health: 100, armor: 0,
      wanted: 0, heat: 0,
      rep: 0, repLevel: 1, repTitle: 'STREET KID',
      day: 1, hour: 17, minute: 24, clockRate: 1,
      timeOfDay: 'sunset', weather: 'clear',
      mission: null, missionsDone: 0, missionsTotal: 8,
      coins: 0, coinsTotal: 20, tapes: 0, tapesTotal: 20,
      vehicle: null, speedKmh: 0, gear: 'N',
      location: 'Downtown', street: 'Solmar Ave',
      radio: { station: 0, name: 'WAVE 88.1', track: 'Neon Drive — Pink Horizon', playing: true },
      weapons: {
        fists: { ammo: Infinity },
        pistol: { ammo: 12, reserve: 48 },
        smg: { ammo: 32, reserve: 128 },
        shotgun: { ammo: 6, reserve: 18 },
        rifle: { ammo: 0, reserve: 0, locked: true }
      },
      weapon: 'pistol',
      started: false, paused: false, scenePreset: null,
      simTime: 0, elapsed: 0
    };
  }
  SB.state = defaultState();
  SB.resetState = function () {
    var keepSeed = SB.state.seed;
    SB.state = defaultState();
    SB.state.seed = keepSeed;
    SB._clockMin = 17 * 60 + 24;
  };
  SB._clockMin = 17 * 60 + 24;

  function repLevelFor(xp) {
    var level = 1;
    for (var i = 0; i < REP_THRESHOLDS.length; i++) {
      if (xp >= REP_THRESHOLDS[i]) level = i + 1;
    }
    return level;
  }
  SB.repTitleFor = function (level) { return REP_TITLES[Math.max(0, Math.min(REP_TITLES.length - 1, level - 1))]; };
  SB.repProgress = function () {
    var level = SB.state.repLevel;
    var into = SB.state.rep - REP_THRESHOLDS[level - 1];
    var next = level >= REP_THRESHOLDS.length ? 0 : REP_THRESHOLDS[level] - REP_THRESHOLDS[level - 1];
    return { level: level, title: SB.state.repTitle, xpInto: into, xpNext: next };
  };
  SB.dayName = function () { return DAY_NAMES[(SB.state.day - 1) % 7]; };
  SB.formatClock = function () {
    var h = String(SB.state.hour); if (h.length < 2) h = '0' + h;
    var m = String(SB.state.minute); if (m.length < 2) m = '0' + m;
    return SB.dayName() + ' ' + h + ':' + m;
  };

  var listeners = {};
  SB.on = function (evt, fn) {
    if (!listeners[evt]) listeners[evt] = [];
    listeners[evt].push(fn);
  };
  SB.off = function (evt, fn) {
    var arr = listeners[evt]; if (!arr) return;
    var i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1);
  };
  SB.emit = function (evt, data) {
    var arr = listeners[evt]; if (!arr) return;
    for (var i = 0; i < arr.length; i++) {
      try { arr[i](data); } catch (e) { console.error('SB event error', evt, e); }
    }
  };

  SB.world = {
    renderer: null, scene: null, camera: null, canvas: null,
    sun: null, hemi: null, neonLights: [],
    player: null, vehicles: [], traffic: [], peds: [],
    police: [], heli: null,
    colliders: [], roads: [], districts: [], landmarks: [], spawns: {},
    groups: {}, bounds: { minX: -555, maxX: 465, minZ: -465, maxZ: 525 }
  };

  SB.input = {
    keys: {},
    mouse: { x: 0, y: 0, dx: 0, dy: 0, down: false },
    isDown: function (code) { return !!SB.input.keys[code]; },
    axis: function () {
      var k = SB.input.keys;
      var x = ((k.KeyD || k.ArrowRight) ? 1 : 0) - ((k.KeyA || k.ArrowLeft) ? 1 : 0);
      var y = ((k.KeyW || k.ArrowUp) ? 1 : 0) - ((k.KeyS || k.ArrowDown) ? 1 : 0);
      return { x: x, y: y };
    }
  };

  function bindInput() {
    window.addEventListener('keydown', function (e) {
      SB.input.keys[e.code] = true;
      if (SB.state.started && (e.code === 'Space' || e.code.indexOf('Arrow') === 0)) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { SB.input.keys[e.code] = false; });
    window.addEventListener('blur', function () { SB.input.keys = {}; SB.input.mouse.down = false; });
    window.addEventListener('mousemove', function (e) {
      SB.input.mouse.dx = e.clientX - SB.input.mouse.x;
      SB.input.mouse.dy = e.clientY - SB.input.mouse.y;
      SB.input.mouse.x = e.clientX; SB.input.mouse.y = e.clientY;
    });
    window.addEventListener('mousedown', function (e) { if (e.button === 0) SB.input.mouse.down = true; });
    window.addEventListener('mouseup', function (e) { if (e.button === 0) SB.input.mouse.down = false; });
  }

  SB.headingForDir = function (dx, dz) { return Math.atan2(-dx, -dz); };
  SB.forwardOf = function (heading) {
    return { x: -Math.sin(heading), z: -Math.cos(heading) };
  };

  var LIGHT_PRESETS = {
    day: {
      sunPos: [350, 520, 180], sunColor: 0xfff3da, sunInt: 1.25,
      hemiSky: 0x9fd4ff, hemiGround: 0x8a7a5a, hemiInt: 0.75,
      bg: 0x8fc3e8, fog: 0x9fc8e8, fogNear: 500, fogFar: 1600,
      neon: 0.15, exposure: 1.05
    },
    sunset: {
      sunPos: [-520, 130, 180], sunColor: 0xff8c42, sunInt: 1.5,
      hemiSky: 0xff9a7a, hemiGround: 0x5a3a4a, hemiInt: 0.6,
      bg: 0xf78d4e, fog: 0xe88a5a, fogNear: 350, fogFar: 1300,
      neon: 0.8, exposure: 1.15
    },
    night: {
      sunPos: [220, 420, -160], sunColor: 0x8fa8ff, sunInt: 0.4,
      hemiSky: 0x1a2440, hemiGround: 0x0c0a14, hemiInt: 0.4,
      bg: 0x0a0f24, fog: 0x0d1330, fogNear: 250, fogFar: 1100,
      neon: 1.3, exposure: 1.0
    }
  };
  SB._sunDir = { x: -0.7, y: 0.35, z: 0.25 };

  SB.init = function (opts) {
    opts = opts || {};
    if (SB.world.renderer) return SB.world.renderer;
    if (typeof THREE === 'undefined') throw new Error('SB.init: THREE not loaded (vendor/three.min.js first)');

    var canvas = opts.canvas || null;
    if (typeof canvas === 'string') canvas = document.getElementById(canvas);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'sb-canvas';
      canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;';
      document.body.appendChild(canvas);
    }
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf78d4e);
    scene.fog = new THREE.Fog(0xe88a5a, 350, 1300);

    var camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3000);
    camera.position.set(0, 6, 70);

    var sun = new THREE.DirectionalLight(0xff8c42, 1.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -380; sun.shadow.camera.right = 380;
    sun.shadow.camera.top = 380; sun.shadow.camera.bottom = -380;
    sun.shadow.camera.near = 50; sun.shadow.camera.far = 1800;
    sun.shadow.bias = -0.0005;
    scene.add(sun); scene.add(sun.target);

    var hemi = new THREE.HemisphereLight(0xff9a7a, 0x5a3a4a, 0.6);
    scene.add(hemi);

    SB.world.renderer = renderer; SB.world.scene = scene;
    SB.world.camera = camera; SB.world.canvas = canvas;
    SB.world.sun = sun; SB.world.hemi = hemi;

    if (opts.seed !== undefined) reseed(opts.seed);
    if (opts.timeOfDay) SB.setTimeOfDay(opts.timeOfDay);

    bindInput();
    window.addEventListener('resize', function () { SB.resize(window.innerWidth, window.innerHeight); });
    SB.emit('init');
    return renderer;
  };

  SB.resize = function (w, h) {
    var r = SB.world.renderer, c = SB.world.camera;
    if (!r || !c) return;
    r.setSize(w, h);
    c.aspect = w / h;
    c.updateProjectionMatrix();
  };

  SB.setTimeOfDay = function (mode) {
    var p = LIGHT_PRESETS[mode]; if (!p) return;
    SB.state.timeOfDay = mode;
    var w = SB.world;
    if (!w.sun) return;
    w.sun.color.setHex(p.sunColor); w.sun.intensity = p.sunInt;
    w.hemi.color.setHex(p.hemiSky); w.hemi.groundColor.setHex(p.hemiGround); w.hemi.intensity = p.hemiInt;
    w.scene.background.setHex(p.bg);
    w.scene.fog.color.setHex(p.fog);
    w.scene.fog.near = p.fogNear; w.scene.fog.far = p.fogFar;
    w.renderer.toneMappingExposure = p.exposure;
    SB._sunDir = { x: p.sunPos[0], y: p.sunPos[1], z: p.sunPos[2] };
    for (var i = 0; i < w.neonLights.length; i++) w.neonLights[i].intensity = p.neon;
    SB.emit('time-of-day', mode);
  };

  SB.setClock = function (hour, minute) {
    SB._clockMin = ((hour % 24) * 60 + (minute % 60) + 1440) % 1440;
    SB.state.hour = Math.floor(SB._clockMin / 60);
    SB.state.minute = Math.floor(SB._clockMin % 60);
  };

  SB.cameraRig = {
    mode: 'chase',
    distance: 9.5, height: 3.8, lookHeight: 1.5, smooth: 5,
    freeRadius: 380, freeHeight: 130, freeSpeed: 0.045, freeAngle: 0.6,
    topHeight: 720
  };
  SB._chaseTarget = null;

  SB.setCameraMode = function (mode) {
    SB.cameraRig.mode = mode;
    if (mode === 'onfoot') { SB.cameraRig.distance = 4; SB.cameraRig.height = 2.2; SB.cameraRig.lookHeight = 1.3; SB.cameraRig.smooth = 8; }
    if (mode === 'chase') { SB.cameraRig.distance = 9.5; SB.cameraRig.height = 3.8; SB.cameraRig.lookHeight = 1.5; SB.cameraRig.smooth = 5; }
  };
  SB.setChaseTarget = function (t) { SB._chaseTarget = t || null; };

  function chaseTargetPos() {
    if (SB._chaseTarget) return SB._chaseTarget;
    if (SB.world.player) return SB.world.player;
    return { pos: new THREE.Vector3(0, 0, 60), heading: 0 };
  }

  SB.updateChaseCam = function (dt) {
    var cam = SB.world.camera; if (!cam) return;
    var rig = SB.cameraRig;
    var t = chaseTargetPos();
    var px = t.pos.x, pz = t.pos.z;
    var heading = t.heading || 0;

    if (rig.mode === 'free') {
      rig.freeAngle += dt * rig.freeSpeed;
      var fx = Math.cos(rig.freeAngle) * rig.freeRadius;
      var fz = Math.sin(rig.freeAngle) * rig.freeRadius;
      cam.position.set(fx, rig.freeHeight, fz);
      cam.lookAt(0, 40, 0);
      return;
    }
    if (rig.mode === 'top') {
      cam.position.set(px, rig.topHeight, pz + 0.01);
      cam.lookAt(px, 0, pz);
      return;
    }
    var fwd = SB.forwardOf(heading);
    var dx = px - fwd.x * rig.distance;
    var dz = pz - fwd.z * rig.distance;
    var dy = rig.height;
    var k = 1 - Math.exp(-rig.smooth * Math.max(dt, 0.0001));
    cam.position.x += (dx - cam.position.x) * k;
    cam.position.y += (dy - cam.position.y) * k;
    cam.position.z += (dz - cam.position.z) * k;
    cam.lookAt(px + fwd.x * 3, rig.lookHeight, pz + fwd.z * 3);
  };

  function followSunWithTarget() {
    var w = SB.world; if (!w.sun) return;
    var t = chaseTargetPos();
    var d = SB._sunDir;
    var len = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z) || 1;
    w.sun.position.set(t.pos.x + (d.x / len) * 700, (d.y / len) * 700, t.pos.z + (d.z / len) * 700);
    w.sun.target.position.set(t.pos.x, 0, t.pos.z);
    w.sun.target.updateMatrixWorld();
  }

  var updaters = [];
  SB.registerUpdate = function (fn) { if (updaters.indexOf(fn) < 0) updaters.push(fn); };
  SB.unregisterUpdate = function (fn) {
    var i = updaters.indexOf(fn); if (i >= 0) updaters.splice(i, 1);
  };

  var rafId = 0, lastT = 0, running = false;

  function advanceClock(dt) {
    SB._clockMin += dt * SB.state.clockRate;
    SB._clockMin = Math.round(SB._clockMin * 1e6) / 1e6;
    while (SB._clockMin >= 1440) { SB._clockMin -= 1440; SB.state.day += 1; }
    SB.state.hour = Math.floor(SB._clockMin / 60);
    SB.state.minute = Math.floor(SB._clockMin % 60);
  }

  function stepSim(dt) {
    SB.state.simTime += dt;
    SB.state.elapsed = SB.state.simTime;
    advanceClock(dt);
    for (var i = 0; i < updaters.length; i++) updaters[i](dt);
  }

  function loop(t) {
    if (!running) return;
    rafId = requestAnimationFrame(loop);

    var raw = (t - lastT) / 1000;
    var dt = Math.min(Math.max(raw || 0.016, 0), 0.05);
    lastT = t;
    if (!SB.state.paused) {
      stepSim(dt);
      SB.emit('tick', dt);
    }
    updateLocationFromTarget();
    SB.updateChaseCam(SB.state.paused ? 0.0001 : dt);
    followSunWithTarget();
    if (SB.world.renderer && SB.world.scene && SB.world.camera) {
      SB.world.renderer.render(SB.world.scene, SB.world.camera);
    }
    SB.input.mouse.dx = 0; SB.input.mouse.dy = 0;
  }

  var lastDistrict = '';
  function updateLocationFromTarget() {
    var t = chaseTargetPos();
    var d = SB.districtAt(t.pos.x, t.pos.z);
    if (d && d.name !== SB.state.location) {
      SB.state.location = d.name;
      if (d.name !== lastDistrict) { lastDistrict = d.name; SB.emit('district', d.name); }
    }
    var s = SB.streetAt(t.pos.x, t.pos.z);
    if (s) SB.state.street = s;
  }

  SB.start = function () {
    if (running) return;
    running = true; lastT = performance.now();
    SB.state.started = true;
    rafId = requestAnimationFrame(loop);
    SB.emit('start');
  };
  SB.stop = function () {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    SB.emit('stop');
  };
  SB.setPaused = function (b) {
    SB.state.paused = !!b;
    SB.emit('pause', SB.state.paused);
  };

  SB.advanceSim = function (seconds) {
    var steps = Math.max(0, Math.ceil(seconds * 60));
    for (var i = 0; i < steps; i++) stepSim(1 / 60);
    updateLocationFromTarget();
  };

  SB.now = function () { return SB.state.simTime; };

  SB.makeTextTexture = function (text, opts) {
    opts = opts || {};
    var w = opts.w || 512, h = opts.h || 128;
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d');
    if (opts.bg) { ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, w, h); }
    if (opts.border) { ctx.strokeStyle = opts.border; ctx.lineWidth = opts.borderWidth || 6; ctx.strokeRect(4, 4, w - 8, h - 8); }
    ctx.fillStyle = opts.fg || '#ffffff';
    ctx.font = opts.font || ('bold ' + Math.floor(h * 0.5) + 'px Arial, sans-serif');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var lines = String(text).split('\n');
    var lh = h / (lines.length + 0.4);
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], w / 2, lh * (i + 0.7));
    }
    var tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    return tex;
  };

  SB.addCollider = function (x0, z0, x1, z1) {
    SB.world.colliders.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  };
  SB.isBlocked = function (x, z, r) {
    r = r || 0.5;
    var b = SB.world.bounds;
    if (x < b.minX + r || x > b.maxX - r || z < b.minZ + r || z > b.maxZ - r) return true;
    var cs = SB.world.colliders;
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i];
      if (x + r > c.x0 && x - r < c.x1 && z + r > c.z0 && z - r < c.z1) return true;
    }
    return false;
  };
  SB.clampToBounds = function (x, z) {
    var b = SB.world.bounds;
    return {
      x: Math.max(b.minX, Math.min(b.maxX, x)),
      z: Math.max(b.minZ, Math.min(b.maxZ, z))
    };
  };
  SB.districtAt = function (x, z) {
    var ds = SB.world.districts;
    for (var i = 0; i < ds.length; i++) {
      var d = ds[i];
      if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d;
    }
    return { id: 'outskirts', name: 'Solmar Bay', x0: 0, z0: 0, x1: 0, z1: 0, tint: 0x888888 };
  };
  SB.streetAt = function (x, z) {
    var best = null, bestD = 1e9;
    var rs = SB.world.roads;
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i];
      var d = r.axis === 'x' ? Math.abs(z - r.at) : Math.abs(x - r.at);
      if (d < bestD) { bestD = d; best = r; }
    }
    return best && bestD <= best.width / 2 + 6 ? best.name : '';
  };

  function wantedFromHeat(heat) {
    if (heat <= 0) return 0;
    if (heat < 20) return 1;
    if (heat < 40) return 2;
    if (heat < 60) return 3;
    if (heat < 80) return 4;
    return 5;
  }
  SB.setWanted = function (n) {
    n = Math.max(0, Math.min(5, Math.round(n)));
    SB.state.heat = n === 0 ? 0 : n * 20 - 1;
    if (SB.state.wanted !== n) { SB.state.wanted = n; SB.emit('wanted', n); }
  };
  SB.addHeat = function (n) {
    var old = SB.state.wanted;
    SB.state.heat = Math.max(0, Math.min(100, SB.state.heat + n));
    SB.state.wanted = wantedFromHeat(SB.state.heat);
    if (SB.state.wanted !== old) SB.emit('wanted', SB.state.wanted);
    SB.emit('heat', SB.state.heat);
  };
  SB.addCash = function (n) {
    SB.state.cash = Math.max(0, SB.state.cash + Math.round(n));
    SB.emit('cash', SB.state.cash);
  };
  SB.addRep = function (n) {
    var oldLevel = SB.state.repLevel;
    SB.state.rep = Math.max(0, SB.state.rep + Math.round(n));
    SB.state.repLevel = repLevelFor(SB.state.rep);
    SB.state.repTitle = SB.repTitleFor(SB.state.repLevel);
    SB.emit('rep', { rep: SB.state.rep, level: SB.state.repLevel, levelUp: SB.state.repLevel > oldLevel });
  };
  SB.setHealth = function (n) {
    SB.state.health = Math.max(0, Math.min(100, Math.round(n)));
    SB.emit('health', SB.state.health);
    if (SB.state.health <= 0) SB.emit('wasted');
  };
  SB.setArmor = function (n) {
    SB.state.armor = Math.max(0, Math.min(100, Math.round(n)));
    SB.emit('armor', SB.state.armor);
  };
  SB.setMission = function (m) {
    SB.state.mission = m || null;
    if (m) SB.emit('mission-start', m);
  };
  SB.clearMission = function () {
    SB.state.mission = null;
    SB.emit('mission-clear');
  };
  SB.serializeState = function () {
    return JSON.parse(JSON.stringify(SB.state));
  };

  function ensureStagingPlayer(mode) {
    if (SB.world.player) return SB.world.player;
    var scene = SB.world.scene;
    if (!scene) return null;
    var spawn = (SB.world.spawns && SB.world.spawns.player) || { x: 0, z: 60, heading: 0 };
    var group, onFoot = (mode === 'onfoot');
    if (!onFoot && SB.city && SB.city.makeCarMesh) {
      group = SB.city.makeCarMesh('sport', 0xff5a8a);
    } else if (onFoot && SB.city && SB.city.makePedMesh) {
      group = SB.city.makePedMesh(0xff5a8a, 0xc98a5a);
    } else {
      group = new THREE.Group();
      var body = new THREE.Mesh(
        new THREE.BoxGeometry(2, onFoot ? 1.8 : 0.8, onFoot ? 0.6 : 4.2),
        new THREE.MeshLambertMaterial({ color: 0xff5a8a }));
      body.position.y = onFoot ? 0.9 : 0.5;
      body.castShadow = true;
      group.add(body);
    }
    group.position.set(spawn.x, 0, spawn.z);
    group.rotation.y = spawn.heading || 0;
    scene.add(group);
    SB.world.player = {
      mesh: group,
      pos: group.position,
      heading: spawn.heading || 0,
      speed: 0, onFoot: onFoot,
      vehicle: onFoot ? null : { id: 'stage-vento', name: 'VENTO STRADA', kind: 'sport', condition: 100 }
    };
    if (!onFoot) {
      SB.state.vehicle = { id: 'stage-vento', name: 'VENTO STRADA', kind: 'sport', condition: 100 };
      SB.state.speedKmh = 0; SB.state.gear = 'N';
    }
    SB.setChaseTarget(SB.world.player);
    return SB.world.player;
  }
  SB.ensureStagingPlayer = ensureStagingPlayer;

  function placePlayer(x, z, heading) {
    var p = SB.world.player;
    if (!p) return;
    if (SB.player && SB.player.setPosition) { SB.player.setPosition(x, z, heading); return; }
    p.pos.set(x, 0, z);
    p.heading = heading;
    if (p.mesh) p.mesh.rotation.y = heading;
  }

  var SCENE_PRESETS = {

    cover: function () {
      SB.setTimeOfDay('sunset'); SB.setClock(17, 24);
      SB.setCameraMode('chase');
      ensureStagingPlayer('chase');
      placePlayer(0, 40, 0);
      SB.setWanted(4); SB.state.cash = 18450; SB.state.rep = 1960;
      SB.state.repLevel = repLevelFor(1960); SB.state.repTitle = SB.repTitleFor(SB.state.repLevel);
      SB.setMission({ id: 'big-score', title: 'THE BIG SCORE', contact: 'MARA SOLIS', stage: 3, stageTotal: 4, objective: 'Escape with the cash! Lose the cops', payout: 5000 });
      SB.state.speedKmh = 151; SB.state.gear = 'G4';
      SB.state.radio = { station: 0, name: 'WAVE 88.1', track: 'Neon Drive — Pink Horizon', playing: true };
    },

    onfoot: function () {
      SB.setTimeOfDay('sunset'); SB.setClock(17, 40);
      SB.setCameraMode('onfoot');
      ensureStagingPlayer('onfoot');
      placePlayer(250, 88, 0);
      SB.setWanted(1); SB.state.cash = 12400;
      SB.clearMission();
    },

    mission: function () {
      SB.setTimeOfDay('sunset'); SB.setClock(18, 5);
      SB.setCameraMode('chase');
      ensureStagingPlayer('chase');
      placePlayer(0, 40, -0.35);
      SB.setWanted(2); SB.state.cash = 12400;
      SB.setMission({ id: 'big-score', title: 'THE BIG SCORE', contact: 'MARA SOLIS', stage: 1, stageTotal: 4, objective: 'Reach Solmar National Bank', payout: 5000 });
    },

    map: function () {
      SB.setTimeOfDay('day'); SB.setClock(12, 0);
      SB.setCameraMode('top');
      ensureStagingPlayer('chase');
      placePlayer(0, 0, 0);
      SB.setWanted(0);
      SB.clearMission();
    },

    night: function () {
      SB.setTimeOfDay('night'); SB.setClock(21, 30);
      SB.setCameraMode('chase');
      ensureStagingPlayer('chase');
      placePlayer(0, -380, Math.PI);
      SB.setWanted(3); SB.state.cash = 15200; SB.state.rep = 1960;
      SB.state.repLevel = repLevelFor(1960); SB.state.repTitle = SB.repTitleFor(SB.state.repLevel);
      SB.setMission({ id: 'harbor-lights', title: 'HARBOR LIGHTS', contact: 'MARA SOLIS', stage: 2, stageTotal: 3, objective: 'Meet the crew at Pelican Marina', payout: 3200 });
    },

    title: function () {
      SB.setTimeOfDay('sunset'); SB.setClock(18, 30);
      SB.setCameraMode('free');
      SB.setWanted(0);
      SB.clearMission();
    }
  };

  SB.applyScenePreset = function (name) {
    var fn = SCENE_PRESETS[name];
    if (!fn) return false;
    SB.state.scenePreset = name;
    fn();

    if (SB.world.camera) SB.updateChaseCam(5);
    SB.emit('scene', { name: name });
    return true;
  };

  SB.parseQuery = function () {
    return new URLSearchParams(window.location.search || '');
  };

  SB.bootFromQuery = function () {
    var q = SB.parseQuery();
    if (q.get('seed')) reseed(parseInt(q.get('seed'), 10) || 1337);
    var scene = q.get('scene');
    if (scene) SB.applyScenePreset(scene);
    if (q.get('t')) SB.advanceSim(parseFloat(q.get('t')) || 0);
    return q;
  };

})();
