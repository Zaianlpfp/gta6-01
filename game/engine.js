// engine.js — B1 r8. Three.js setup, loop, kamera chase, langit, efek.
// Kontrak: game/API.md. Deterministik: tanpa Math.random / Date.now.
(function () {
  var SB = window.SB = window.SB || {};

  // ---- RNG deterministik (mulberry32) ----
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  SB.rng = mulberry32;
  SB._seed = 1337;
  SB.rand = mulberry32(SB._seed);
  SB.rngReset = function (seed) {
    SB._seed = (seed === undefined) ? 1337 : seed;
    SB.rand = mulberry32(SB._seed);
  };
  SB.randRange = function (a, b) { return a + SB.rand() * (b - a); };
  SB.randInt = function (a, b) { return Math.floor(SB.randRange(a, b + 1)); };
  SB.randPick = function (arr) { return arr[Math.floor(SB.rand() * arr.length)]; };

  // ---- State global ----
  SB.cash = 0;
  SB.state = {
    paused: false, heat: 0, rep: 0, cash: 0,
    day: 1, hour: 17, min: 24, timeLabel: 'SUNSET',
    simTime: 0, preset: 'cover', speedKmh: 0,
    vehicleName: '—', vehicleCond: 100, vehicleStatus: 'OK',
    inSight: false, objective: '', staging: false
  };

  // ---- Engine ----
  var E = SB.engine = {};
  var rafId = 0, lastT = 0;
  var flashes = [], flashLight = null;
  var clouds = [], sunDisc = null;
  var skyMat = null;

  function skyGradient(top, mid, bot) {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { cTop: { value: new THREE.Color(top) }, cMid: { value: new THREE.Color(mid) }, cBot: { value: new THREE.Color(bot) } },
      vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vP; uniform vec3 cTop; uniform vec3 cMid; uniform vec3 cBot;' +
        'void main(){ float h=normalize(vP).y; vec3 c = h>0.12 ? mix(cMid,cTop,smoothstep(0.12,0.65,h)) : mix(cBot,cMid,smoothstep(-0.08,0.12,h));' +
        ' gl_FragColor=vec4(c,1.0); }'
    });
  }

  function buildSky(scene) {
    var sky = new THREE.Mesh(new THREE.SphereGeometry(760, 24, 16), skyMat);
    sky.name = 'sky'; scene.add(sky);
    // Sun disc: cakram oranye di arah matahari (-8,150,-420) dinormalisasi
    var dir = new THREE.Vector3(-8, 150, -420).normalize();
    sunDisc = new THREE.Mesh(new THREE.CircleGeometry(34, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }));
    sunDisc.position.copy(dir).multiplyScalar(700);
    sunDisc.lookAt(0, 0, 0); scene.add(sunDisc);
    var glow = new THREE.Mesh(new THREE.CircleGeometry(62, 32),
      new THREE.MeshBasicMaterial({ color: 0xff9a4d, transparent: true, opacity: 0.35, fog: false }));
    glow.position.copy(dir).multiplyScalar(695); glow.lookAt(0, 0, 0); scene.add(glow);
    // Awan: gumpalan pipih putih/ungu, drift deterministik dari simTime
    SB.rngReset(77);
    var cm = new THREE.MeshBasicMaterial({ color: 0xffe3d0, transparent: true, opacity: 0.85, fog: false });
    var cm2 = new THREE.MeshBasicMaterial({ color: 0xc9a8e8, transparent: true, opacity: 0.7, fog: false });
    for (var i = 0; i < 14; i++) {
      var g = new THREE.Group();
      var n = 3 + Math.floor(SB.rand() * 3);
      for (var j = 0; j < n; j++) {
        var s = new THREE.Mesh(new THREE.SphereGeometry(SB.randRange(9, 22), 8, 6), (j % 2) ? cm2 : cm);
        s.scale.y = 0.32; s.position.set(SB.randRange(-26, 26), SB.randRange(-2, 3), SB.randRange(-8, 8));
        g.add(s);
      }
      g.position.set(SB.randRange(-420, 420), SB.randRange(120, 210), SB.randRange(-520, 120));
      g.userData.bx = g.position.x; g.userData.sp = SB.randRange(0.4, 1.1);
      clouds.push(g); scene.add(g);
    }
  }

  E.boot = function (opts) {
    opts = opts || {};
    if (E.renderer) return E;
    var w = opts.w || 1280, h = opts.h || 720;
    var canvas = document.createElement('canvas');
    canvas.id = 'gl';
    var host = document.getElementById('game') || document.body;
    host.appendChild(canvas);
    E.canvas = canvas;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(w, h);
    E.renderer = renderer;
    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x3a2350, 180, 700);
    E.scene = scene;
    var camera = new THREE.PerspectiveCamera(62, w / h, 0.1, 2000);
    camera.position.set(10, 6, 20);
    E.camera = camera;
    // Lampu: matahari (-8,150,-420) tetap; hemi langit senja
    var sun = new THREE.DirectionalLight(0xffb36b, 1.15);
    sun.position.set(-8, 150, -420);
    scene.add(sun); E.sun = sun;
    var hemi = new THREE.HemisphereLight(0x8a6fd0, 0x3d2b1e, 0.85);
    scene.add(hemi); E.hemi = hemi;
    var amb = new THREE.AmbientLight(0x604a7a, 0.5);
    scene.add(amb);
    // Langit + awan
    skyMat = skyGradient(0x2b1e5e, 0xff7e47, 0xffb347);
    buildSky(scene);
    // Muzzle-flash pool persisten (24 sprite + 1 point light)
    var ftex = makeDotTexture();
    for (var i = 0; i < 24; i++) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ftex, color: 0xffc23d, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.scale.set(2.4, 2.4, 1); sp.userData.life = 0;
      flashes.push(sp); scene.add(sp);
    }
    flashLight = new THREE.PointLight(0xffb03d, 0, 26);
    scene.add(flashLight);
    E.muzzlePos = new THREE.Vector3(0, 1.2, 0);
    E.heading = 0; E._camMode = 'follow';
    E._camPos = new THREE.Vector3(10, 6, 20);
    E._camLook = new THREE.Vector3(0, 1.2, 0);
    E._focus = new THREE.Vector3(0, 1, 0);
    // Kota (city.js milik B1; boot dipanggil main.js setelah semua script load)
    if (SB.city && SB.city.build) { SB.rngReset(1337); SB.city.build(scene); }
    if (opts.preset) E.setPreset(opts.preset, opts);
    // Loop internal (main.js WAJIB stop() dulu lalu loop sendiri)
    lastT = 0;
    var loop = function (t) {
      rafId = requestAnimationFrame(loop);
      var dt = lastT ? Math.min((t - lastT) / 1000, 0.05) : 1 / 60;
      lastT = t;
      if (!SB.state.paused) E.step(dt);
      else E.renderer.render(E.scene, E.camera);
    };
    rafId = requestAnimationFrame(loop);
    return E;
  };

  function makeDotTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d');
    var gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(255,255,220,1)'); gr.addColorStop(0.4, 'rgba(255,180,60,0.9)');
    gr.addColorStop(1, 'rgba(255,120,20,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    var tx = new THREE.CanvasTexture(c); return tx;
  }

  E.stop = function () { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } return E; };
  E.start = function () {
    if (rafId) return E; lastT = 0;
    var loop = function (t) {
      rafId = requestAnimationFrame(loop);
      var dt = lastT ? Math.min((t - lastT) / 1000, 0.05) : 1 / 60;
      lastT = t;
      if (!SB.state.paused) E.step(dt); else E.renderer.render(E.scene, E.camera);
    };
    rafId = requestAnimationFrame(loop); return E;
  };

  E.heroPos = function () {
    if (SB.vehicles && SB.vehicles.active && SB.vehicles.active.mesh) {
      var p = SB.vehicles.active.mesh.position; return [p.x, p.z];
    }
    if (SB.player && SB.player.hero) {
      var q = SB.player.hero.position; return [q.x, q.z];
    }
    return [E._focus.x, E._focus.z];
  };

  E.step = function (dt) {
    if (!E.renderer) return E;
    SB.state.simTime += dt;
    // Awan drift deterministik
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      c.position.x = c.userData.bx + SB.state.simTime * c.userData.sp;
      if (c.position.x > 460) c.position.x = -460;
    }
    // Flash decay
    var anyFlash = false;
    for (var j = 0; j < flashes.length; j++) {
      var f = flashes[j];
      if (f.userData.life > 0) {
        f.userData.life -= dt;
        f.material.opacity = Math.max(0, f.userData.life / 0.09);
        if (f.userData.life > 0) anyFlash = true;
      } else if (f.material.opacity !== 0) f.material.opacity = 0;
    }
    flashLight.intensity = anyFlash ? 2.4 : 0;
    if (anyFlash) flashLight.position.copy(E.muzzlePos);
    // Kamera
    var cam = E.camera;
    if (E._camMode === 'fixed') {
      cam.position.copy(E._camPos);
      cam.lookAt(E._camLook);
    } else {
      var hp = E.heroPos();
      var fx = hp[0], fz = hp[1];
      var h = E.heading || 0;
      var bx = Math.sin(h), bz = Math.cos(h); // forward
      var dist = 13, height = 5.2;
      cam.position.set(fx - bx * dist, height, fz - bz * dist);
      cam.lookAt(fx + bx * 6, 1.4, fz + bz * 6);
      E._focus.set(fx, 1.2, fz);
    }
    E.renderer.render(E.scene, cam);
    return E;
  };

  // Cone spotlight heli: opacity 0.25 TETAP (kontrak API §3)
  E.spotCone = function () {
    var geo = new THREE.ConeGeometry(7, 42, 20, 1, true);
    var mat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    var m = new THREE.Mesh(geo, mat);
    return m;
  };

  E.burst = function (x, y, z, n) {
    n = n || 6;
    var lit = 0;
    for (var i = 0; i < flashes.length && lit < n; i++) {
      var f = flashes[i];
      if (f.userData.life <= 0) {
        f.position.set(x + SB.randRange(-0.5, 0.5), y + SB.randRange(-0.3, 0.3), z + SB.randRange(-0.5, 0.5));
        var s = SB.randRange(1.6, 3.2);
        f.scale.set(s, s, 1); f.userData.life = 0.09; f.material.opacity = 1;
        lit++;
      }
    }
    E.muzzlePos.set(x, y, z);
    return E;
  };

  E.setPreset = function (name, opts) {
    opts = opts || {};
    SB.state.preset = name;
    var heat = (opts.heat !== undefined) ? opts.heat : SB.state.heat;
    SB.state.heat = heat;
    if (opts.hour !== undefined) { SB.state.hour = opts.hour; }
    if (opts.min !== undefined) { SB.state.min = opts.min; }
    if (name === 'cover') {
      SB.state.heat = (opts.heat !== undefined) ? opts.heat : 4;
      SB.state.hour = 17; SB.state.min = 24; SB.state.timeLabel = 'SUNSET';
      E._camMode = 'fixed';
      // Kamera belakang-kanan rendah: mobil pink (0,0,0) UTUH, cruiser di kiri/kanan frame
      E._camPos.set(10.5, 5.4, 19.5); E._camLook.set(-0.5, 1.6, -4);
      E._focus.set(0, 1.2, 0); E.heading = 0;
      SB.state.objective = 'Lose the heat — reach the safehouse';
      SB.state.inSight = true;
    } else if (name === 'onfoot') {
      SB.state.heat = (opts.heat !== undefined) ? opts.heat : 2;
      SB.state.hour = 18; SB.state.min = 5; SB.state.timeLabel = 'SUNSET';
      E._camMode = 'fixed';
      var sp = (SB.city && SB.city.spawnPoints) ? SB.city.spawnPoints.onfoot : [24, 30];
      E._camPos.set(sp[0] + 9, 5.2, sp[1] + 14); E._camLook.set(sp[0], 1.3, sp[1] - 4);
      E._focus.set(sp[0], 1.2, sp[1]); E.heading = Math.PI;
      SB.state.objective = 'Meet Mara at the market';
      SB.state.inSight = false;
    } else if (name === 'mission') {
      SB.state.heat = (opts.heat !== undefined) ? opts.heat : 5;
      SB.state.hour = 17; SB.state.min = 48; SB.state.timeLabel = 'SUNSET';
      E._camMode = 'fixed';
      var bp = (SB.city && SB.city.spawnPoints) ? SB.city.spawnPoints.mission : [2, -14];
      E._camPos.set(bp[0] + 9, 6.2, bp[1] + 16); E._camLook.set(bp[0], 2.2, bp[1] - 6);
      E._focus.set(bp[0], 1.5, bp[1]); E.heading = 0;
      SB.state.objective = 'The Big Score — hit Solmar National Bank';
      SB.state.inSight = true;
    } else if (name === 'map') {
      SB.state.heat = (opts.heat !== undefined) ? opts.heat : 0;
      E._camMode = 'fixed';
      E._camPos.set(0, 260, 60); E._camLook.set(0, 0, 0);
      SB.state.timeLabel = 'SUNSET';
    } else { // free
      SB.state.heat = (opts.heat !== undefined) ? opts.heat : 0;
      E._camMode = 'follow'; E.heading = 0;
      SB.state.objective = '';
      SB.state.inSight = false;
    }
    if (SB.police && SB.police.setStars) SB.police.setStars(SB.state.heat);
    return E;
  };

  E.bootFromQuery = function () {
    var q = new URLSearchParams(location.search);
    var scene = q.get('scene') || 'cover';
    var opts = { preset: scene };
    if (q.get('heat') !== null) opts.heat = parseInt(q.get('heat'), 10);
    if (q.get('hour') !== null) opts.hour = parseInt(q.get('hour'), 10);
    E.boot(opts);
    return E;
  };

  E.shot = function () {
    if (!E.renderer) return '';
    E.renderer.render(E.scene, E.camera);
    return E.canvas.toDataURL('image/jpeg', 0.92);
  };
})();
