// Solmar Bay — engine.js (B1, v4-rebuild r4)
// Renderer + loop + RNG deterministik + preset staging. Three.js r149 (vendor).
// Aturan: tanpa pengacak bawaan dan tanpa jam dinding di file ini.
// Semua acak dari SB.engine.rng(seed).
(function () {
  var SB = window.SB = window.SB || {};
  var T = window.THREE;
  var eng = SB.engine = SB.engine || {};

  // --- RNG deterministik (mulberry32) ---
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  eng.rng = function (seed) { return mulberry32(seed >>> 0); };

  // --- State global (dibaca HUD B4, polisi B2, misi B3) ---
  // heat = BINTANG 0-5 (bukan 0-100; poin 0-100 internal di SB.police.pts).
  SB.state = SB.state || {
    paused: false, heat: 0, speedKmh: 0, mode: 'car', preset: 'cover',
    time: { day: 1, dow: 'FRI', hour: 17, min: 24 }
  };
  SB.cash = SB.cash || 0;

  // --- Preset staging (6) ---
  // hero:[x,z] awal, h: heading, kmh: laju awal, cam/look: offset lokal hero.
  // Forward = (-sin h, -cos h); kamera chase di hero + rot(h)*(0,3.5,+8.6); model hadap -z.
  var PRESETS = {
    'cover':     { tod: 'sunset', mode: 'car',  hero: [0, 100],  h: 0,   kmh: 151, cam: [1.2, 2.3, 7.2],  look: [0, 2.2, -3], cars: 24, peds: 20, heli: true,  heat: 4 },
    'mission':   { tod: 'sunset', mode: 'car',  hero: [0, 86],   h: 0,   kmh: 96,  cam: [1.6, 3.4, 9.5],  look: [0, 2.2, -4], cars: 18, peds: 14, heli: true,  heat: 3 },
    'night':     { tod: 'night',  mode: 'car',  hero: [0, 70],   h: 0,   kmh: 88,  cam: [1.6, 2.6, 8.0],  look: [0, 2.2, -3], cars: 16, peds: 18, heli: true,  heat: 3 },
    'onfoot':    { tod: 'night',  mode: 'foot', hero: [-48, 96], h: 0.35, kmh: 0,  cam: [1.2, 2.3, 5.4],  look: [0, 1.3, -3], cars: 10, peds: 24, heli: true,  heat: 3 },
    'big-score': { tod: 'sunset', mode: 'car',  hero: [0, 52],   h: 0,   kmh: 64,  cam: [2.5, 3.8, 11.5], look: [0, 2.2, -4], cars: 20, peds: 16, heli: true,  heat: 4 },
    'map':       { tod: 'day',    mode: 'car',  hero: [0, 0],    h: 0,   kmh: 0,   cam: [0, 320, 150],   look: [0, 0, -10],  cars: 12, peds: 8,  heli: false, heat: 0, top: true }
  };
  eng.presetNames = ['cover', 'mission', 'night', 'onfoot', 'big-score', 'map'];
  eng.PRESETS = PRESETS;
  eng.simTime = 0; eng.frame = 0;

  // --- Langit per waktu (tekstur gradasi canvas, dibuat sekali) ---
  function skyTex(top, mid, bot) {
    var c = document.createElement('canvas'); c.width = 16; c.height = 256;
    var g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, top); gr.addColorStop(0.55, mid); gr.addColorStop(1, bot);
    g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
    return new T.CanvasTexture(c);
  }
  function blobTex() { // awan / glow lembut
    var c = document.createElement('canvas'); c.width = 128; c.height = 128;
    var g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.35)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(c);
  }
  var TOD = {
    sunset: { sky: ['#241040', '#c94b7c', '#ffb36b'], fog: 0x8a5570, hemiSky: 0xffd9b0, hemiGnd: 0x4a3550, hemi: 1.0, sun: 0xffb36b, sunI: 1.3, sunPos: [-40, 140, -420], sunCol: 0xffd27a, sunR: 26, glow: 0xff8a4d, glowScale: 190, clouds: 0.65 },
    night:  { sky: ['#04060f', '#0d1b3a', '#233a5e'], fog: 0x0d1b3a, hemiSky: 0x8fa8d8, hemiGnd: 0x1a2233, hemi: 0.5,  sun: 0x9fb8ff, sunI: 0.5,  sunPos: [180, 230, -350], sunCol: 0xdfe8ff, sunR: 13, glow: 0x8fa8d8, glowScale: 90, clouds: 0.3 },
    day:    { sky: ['#2f7fc9', '#8ec8ee', '#d8eefc'], fog: 0xa8c8e0, hemiSky: 0xcfe8ff, hemiGnd: 0x8a7a5f, hemi: 1.0,  sun: 0xfff2cf, sunI: 1.3,  sunPos: [80, 330, -260],  sunCol: 0xfff6d8, sunR: 16, glow: 0xfff2b0, glowScale: 150, clouds: 0.7 }
  };

  function rotXZ(h, x, z) { // putar vektor lokal (x,z) dgn heading h -> dunia
    var c = Math.cos(h), s = Math.sin(h);
    return [x * c + z * s, -x * s + z * c];
  }
  eng.rotXZ = rotXZ;

  function applyTod(name) {
    var d = TOD[name] || TOD.sunset;
    eng.tod = name;
    eng.skyMat.map = eng.skyTex[name];
    eng.scene.fog = new T.Fog(d.fog, 150, 850);
    eng.hemi.color.setHex(d.hemiSky); eng.hemi.groundColor.setHex(d.hemiGnd);
    eng.hemi.intensity = d.hemi;
    eng.sun.color.setHex(d.sun); eng.sun.intensity = d.sunI;
    eng.sun.position.set(d.sunPos[0], d.sunPos[1], d.sunPos[2]);
    eng.sunDisc.position.set(d.sunPos[0], d.sunPos[1], d.sunPos[2]);
    eng.sunDisc.material.color.setHex(d.sunCol);
    eng.sunDisc.scale.setScalar(d.sunR / 16);
    eng.sunGlow.position.copy(eng.sunDisc.position);
    eng.sunGlow.material.color.setHex(d.glow);
    eng.sunGlow.scale.set(d.glowScale || 150, d.glowScale || 150, 1);
    eng.sunGlow.material.opacity = name === 'night' ? 0.35 : 0.75;
    for (var i = 0; i < eng.clouds.length; i++) eng.clouds[i].material.opacity = d.clouds;
  }

  // --- Boot ---
  eng.boot = function (w, h) {
    w = w || 1280; h = h || 720;
    var cv = document.createElement('canvas');
    cv.id = 'game-canvas'; cv.width = w; cv.height = h;
    document.body.appendChild(cv);
    eng.renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
    eng.renderer.setPixelRatio(1);
    eng.renderer.setSize(w, h);
    eng.scene = new T.Scene();
    eng.camera = new T.PerspectiveCamera(58, w / h, 0.1, 1600);
    eng.hemi = new T.HemisphereLight(0xffd9b0, 0x4a3550, 0.85);
    eng.scene.add(eng.hemi);
    eng.sun = new T.DirectionalLight(0xffb36b, 1.15);
    eng.sun.position.set(-140, 200, -80);
    eng.scene.add(eng.sun);
    // kubah langit
    eng.skyTex = { sunset: skyTex.apply(null, TOD.sunset.sky), night: skyTex.apply(null, TOD.night.sky), day: skyTex.apply(null, TOD.day.sky) };
    eng.skyMat = new T.MeshBasicMaterial({ map: eng.skyTex.sunset, side: T.BackSide, fog: false });
    var dome = new T.Mesh(new T.SphereGeometry(700, 24, 12), eng.skyMat);
    eng.scene.add(dome);
    // matahari / bulan + glow
    eng.sunDisc = new T.Mesh(new T.CircleGeometry(16, 32),
      new T.MeshBasicMaterial({ color: 0xffd27a, fog: false, transparent: true, opacity: 0.96 }));
    eng.scene.add(eng.sunDisc);
    eng.sunGlow = new T.Sprite(new T.SpriteMaterial({ map: blobTex(), color: 0xff8a4d, transparent: true, opacity: 0.75, fog: false, depthWrite: false }));
    eng.sunGlow.scale.set(190, 190, 1);
    eng.scene.add(eng.sunGlow);
    // awan (posisi tetap, seed 77)
    eng.clouds = [];
    var cr = eng.rng(77);
    for (var i = 0; i < 9; i++) {
      var cl = new T.Sprite(new T.SpriteMaterial({ map: blobTex(), color: 0xffffff, transparent: true, opacity: 0.65, fog: false, depthWrite: false }));
      cl.position.set(-380 + cr() * 760, 90 + cr() * 80, -420 + cr() * 500);
      var s = 120 + cr() * 140; cl.scale.set(s, s * 0.32, 1);
      eng.clouds.push(cl); eng.scene.add(cl);
    }
    // hero (posisi/mode diatur setPreset; mesh dibuat city.placeHero)
    eng.hero = { pos: new T.Vector3(0, 0, 62), heading: 0, speedKmh: 0, mode: 'car' };
    eng.camOff = [2.4, 2.3, 7.2]; eng.lookOff = [0, 1.2, -3]; eng.top = false;
    if (SB.city && SB.city.attach) SB.city.attach(eng.scene);
    eng.setPreset('cover');
    return eng;
  };

  // --- Kamera ---
  eng.updateCamera = function () {
    var hr = eng.hero, cam = eng.camera;
    if (eng.sunDisc) eng.sunDisc.lookAt(cam.position);
    if (eng.top) {
      cam.position.set(eng.camOff[0], eng.camOff[1], eng.camOff[2]);
      cam.lookAt(eng.lookOff[0], eng.lookOff[1], eng.lookOff[2]);
      return;
    }
    var o = rotXZ(hr.heading, eng.camOff[0], eng.camOff[2]);
    cam.position.set(hr.pos.x + o[0], eng.camOff[1], hr.pos.z + o[1]);
    var l = rotXZ(hr.heading, eng.lookOff[0], eng.lookOff[2]);
    cam.lookAt(hr.pos.x + l[0], eng.lookOff[1], hr.pos.z + l[1]);
  };

  // --- Preset (boleh di-wrap berantai oleh B2/B3/B4) ---
  eng.setPreset = function (name) {
    var p = PRESETS[name] || PRESETS.cover;
    SB.state.preset = name; eng.preset = name;
    applyTod(p.tod);
    var hr = eng.hero;
    hr.pos.set(p.hero[0], 0, p.hero[1]);
    hr.heading = p.h; hr.speedKmh = p.kmh; hr.mode = p.mode;
    SB.state.heat = p.heat; SB.state.speedKmh = p.kmh; SB.state.mode = p.mode;
    SB.state.time = p.tod === 'night' ? { day: 1, dow: 'FRI', hour: 21, min: 48 }
      : p.tod === 'day' ? { day: 1, dow: 'FRI', hour: 12, min: 5 }
      : { day: 1, dow: 'FRI', hour: 17, min: 24 };
    eng.camOff = p.cam; eng.lookOff = p.look; eng.top = !!p.top;
    if (SB.city) {
      if (SB.city.setDensity) SB.city.setDensity(p.cars, p.peds);
      if (SB.city.setHeli) SB.city.setHeli(p.heli, hr);
      if (SB.city.placeHero) SB.city.placeHero(hr);
    }
    eng.updateCamera();
    eng.render();
  };

  // --- Kecepatan hero (dipakai staging B5 + didelegasi SB.vehicles.setSpeedKmh B2) ---
  eng.setSpeedKmh = function (kmh) {
    eng.hero.speedKmh = kmh;
    SB.state.speedKmh = kmh;
  };

  // --- Posisi moncong senjata (dipakai SB.player.fire B2 -> SB.city.burst) ---
  eng.muzzlePos = function () {
    var hr = eng.hero;
    var off = hr.mode === 'foot' ? [0.35, 1.35, -1.3] : [0.8, 1.05, -2.4];
    var o = rotXZ(hr.heading, off[0], off[2]);
    return new T.Vector3(hr.pos.x + o[0], off[1], hr.pos.z + o[1]);
  };
  eng.heroPos = function () { return eng.hero.pos.clone(); };

  // --- Satu langkah sim + render (boleh di-wrap sekali oleh B2, guard SB._b2step) ---
  eng.step = function (dt, noRender) {
    dt = dt || 1 / 60;
    if (!SB.state.paused) {
      eng.simTime += dt; eng.frame++;
      var hr = eng.hero;
      if (hr.mode === 'car' && hr.speedKmh > 0) {
        var d = hr.speedKmh / 3.6 * dt;
        hr.pos.x += -Math.sin(hr.heading) * d;
        hr.pos.z += -Math.cos(hr.heading) * d;
        if (hr.pos.z < -145) hr.pos.z += 290;
        if (hr.pos.z > 145) hr.pos.z -= 290;
        if (hr.pos.x < -145) hr.pos.x += 290;
        if (hr.pos.x > 145) hr.pos.x -= 290;
      }
      if (SB.city && SB.city.update) SB.city.update(dt, eng.simTime);
      if (SB.city && SB.city.placeHero) SB.city.placeHero(hr);
      SB.state.speedKmh = hr.speedKmh;
    }
    eng.updateCamera();
    if (!noRender) eng.render();
  };

  // Majukan sim n langkah dt tetap, abaikan pause (alat staging).
  // Render hanya di langkah terakhir supaya staging cepat.
  eng.advanceSim = function (n, dt) {
    dt = dt || 1 / 60;
    var p = SB.state.paused; SB.state.paused = false;
    for (var i = 0; i < n; i++) eng.step(dt, i < n - 1);
    SB.state.paused = p;
  };

  eng.render = function () { eng.renderer.render(eng.scene, eng.camera); };
  eng.shot = function () { eng.render(); return eng.renderer.domElement.toDataURL('image/png'); };

  // --- Loop utama (dipanggil main.js B5; loop juga panggil SB.missions.update bila ada) ---
  eng._raf = 0;
  eng.start = function () {
    if (eng._raf) return;
    var tick = function () {
      eng._raf = requestAnimationFrame(tick);
      eng.step(1 / 60);
      if (SB.missions && SB.missions.update) SB.missions.update(1 / 60);
    };
    tick();
  };
  eng.stop = function () { if (eng._raf) cancelAnimationFrame(eng._raf); eng._raf = 0; };

  // Boot dari query (?preset=cover&adv=90&speed=151&pause=1). Dipanggil main.js.
  eng.bootFromQuery = function () {
    var q = new URLSearchParams(location.search);
    eng.boot(1280, 720);
    eng.setPreset(q.get('preset') || q.get('scene') || 'cover');
    var adv = parseInt(q.get('adv') || '0', 10);
    if (adv > 0) eng.advanceSim(adv);
    var sp = parseInt(q.get('speed') || '', 10);
    if (!isNaN(sp)) eng.setSpeedKmh(sp);
    if (q.get('pause') === '1') SB.state.paused = true;
    if (q.get('loop') !== '0') eng.start();
  };
})();
