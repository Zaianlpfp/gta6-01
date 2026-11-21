// engine.js — Solmar Bay (gta6-01 v4 r14)
// Three.js boot / render / loop / kamera / efek + inti global SB.
// Ditulis FRESH dari game/API.md. Tanpa acak/jam bawaan JS di file ini:
// semua acak lewat SB.rng() (mulberry32, seed tetap), SB.state.simTime satu-satunya jam sim.
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// RNG deterministik (mulberry32)
// ---------------------------------------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Global SB (dibuat di sini; modul lain menempel namespace-nya sendiri)
// ---------------------------------------------------------------------------
const SB = window.SB || (window.SB = {});
SB.SEED = 1337;
SB.rng = mulberry32(SB.SEED);
SB.rand = (a, b) => a + SB.rng() * (b - a);
SB.randInt = (a, b) => Math.floor(SB.rand(a, b + 1));
SB.pick = (arr) => arr[Math.floor(SB.rng() * arr.length)];
SB.resetRng = (seed) => { SB.rng = mulberry32(seed === undefined ? SB.SEED : seed); };
SB.now = () => SB.state.simTime;

// Envelope kota Solmar Bay (API.md §6): x [-140,215], z [-90,185].
SB.CITY = { x0: -140, x1: 215, z0: -90, z1: 185 };
SB._inCity = (x, z) => x >= SB.CITY.x0 && x <= SB.CITY.x1 && z >= SB.CITY.z0 && z <= SB.CITY.z1;
// Clamp ke envelope dengan margin 2. Mengubah o.x/o.z di tempat; true bila kena clamp.
SB._clampToCity = (o) => {
  let hit = false;
  const x0 = SB.CITY.x0 + 2, x1 = SB.CITY.x1 - 2, z0 = SB.CITY.z0 + 2, z1 = SB.CITY.z1 - 2;
  if (o.x < x0) { o.x = x0; hit = true; }
  if (o.x > x1) { o.x = x1; hit = true; }
  if (o.z < z0) { o.z = z0; hit = true; }
  if (o.z > z1) { o.z = z1; hit = true; }
  return hit;
};

// Daftar update fn(dt); dipanggil tiap step(). Polisi TIDAK boleh daftar di sini.
SB._updates = [];
SB.registerUpdate = (fn) => { SB._updates.push(fn); return fn; };

// ---------------------------------------------------------------------------
// SB.state — single source of truth (API.md §3)
// ---------------------------------------------------------------------------
SB.state = {
  simTime: 0,
  clockMinutes: 1044, // 17:24
  preset: 'cover',
  cash: 500,
  health: 100,
  armor: 0,
  heat: 0,
  rep: 0,
  rank: 'ROOKIE',
  radio: 0,
  hero: { x: 0, y: 0, z: 40, heading: Math.PI, speed: 0, inVehicle: false, vehicleId: null },
  vehicle: null,
  mission: null,
  crew: [
    { name: 'Mara', role: 'Driver', ready: true },
    { name: 'Jax', role: 'Muscle', ready: true },
    { name: 'Lucia', role: 'Hacker', ready: false },
  ],
  flags: { busted: false, paused: false },
};

// Jam HUD "HH:MM" dari simTime: 1 detik sim = 1 menit jam (1044 + simTime).
SB.clockText = () => {
  const m = Math.floor(SB.state.clockMinutes);
  const hh = String(Math.floor(m / 60) % 24).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return hh + ':' + mm;
};

// ---------------------------------------------------------------------------
// SB.engine
// ---------------------------------------------------------------------------
const SUN_POS = [-8, 150, -420]; // TETAP di semua preset sunset — JANGAN digeser.
const CLOCK_BASE = 1044; // 17:24

const PRESETS = {
  cover: {
    hero: { x: 2, z: 12, heading: 2.6, inVehicle: true, vehicleId: 'flamingo', speed: 0 },
    cam: { pos: [-4, 4.2, 22], look: [2, 1.6, 4] },
    camMode: 'fixed', heat: 4,
  },
  onfoot: {
    hero: { x: 0, z: 40, heading: Math.PI, inVehicle: false, vehicleId: null, speed: 0 },
    cam: { pos: [0, 3.2, 48.5], look: [0, 1.6, 40] },
    camMode: 'chase', heat: 0,
  },
  mission: {
    hero: { x: 2, z: 10, heading: Math.PI, inVehicle: false, vehicleId: null, speed: 0 },
    cam: { pos: [0, 6.2, 26], look: [2, 2.2, 4] },
    camMode: 'fixed', heat: 2,
  },
  map: {
    hero: null, // hero tetap di tempatnya
    cam: { pos: [37, 220, 47], look: [37, 0, 47] },
    camMode: 'fixed', heat: 0,
  },
  free: {
    hero: { x: 0, z: 40, heading: Math.PI, inVehicle: false, vehicleId: null, speed: 0 },
    cam: { pos: [0, 3.2, 48.5], look: [0, 1.6, 40] },
    camMode: 'chase', heat: 0,
  },
};

SB.engine = {
  renderer: null,
  scene: null,
  camera: null,
  sun: null,
  hemi: null,
  moon: null,
  running: false,
  camMode: 'fixed',
  lookTarget: new THREE.Vector3(0, 1.6, 0),
  bursts: [],
  _burstUpdateRegistered: false,

  // Buat renderer + scene + kamera + lights; bangun kota. Boleh dipanggil ulang
  // (tes determinisme): scene lama dibuang, rng di-reset, kota dibangun ulang.
  boot(canvas, opts) {
    const o = opts || {};
    if (SB.engine.renderer) { try { SB.engine.renderer.dispose(); } catch (e) { /* abaikan */ } }
    SB.resetRng(SB.SEED);
    SB._updates = [];
    SB.engine.bursts = [];
    SB.engine._burstUpdateRegistered = false;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(canvas.clientWidth || 1280, canvas.clientHeight || 720, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = o.shadows !== false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    SB.engine.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x53304d); // langit sunset ungu-oranye
    scene.fog = new THREE.Fog(0x53304d, 120, 420);
    SB.engine.scene = scene;

    const camera = new THREE.PerspectiveCamera(60, (canvas.clientWidth || 1280) / (canvas.clientHeight || 720), 0.1, 900);
    SB.engine.camera = camera;
    SB.engine.lookTarget = new THREE.Vector3(0, 1.6, 0);

    // Matahari: posisi TETAP (-8,150,-420) di semua preset sunset.
    const sun = new THREE.DirectionalLight(0xffb36b, 1.15);
    sun.position.set(SUN_POS[0], SUN_POS[1], SUN_POS[2]);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -220; sun.shadow.camera.right = 220;
    sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
    sun.shadow.camera.far = 900;
    scene.add(sun);
    SB.engine.sun = sun;

    const hemi = new THREE.HemisphereLight(0xffd9b0, 0x3a2b52, 0.55);
    scene.add(hemi);
    SB.engine.hemi = hemi;

    // Bulan pucat di langit sunset (hiasan).
    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(9, 32),
      new THREE.MeshBasicMaterial({ color: 0xf5ead0, fog: false })
    );
    moon.position.set(-120, 140, -300);
    moon.lookAt(0, 0, 0);
    scene.add(moon);
    SB.engine.moon = moon;

    // Cakram matahari rendah di barat (hiasan, BUKAN light).
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(16, 32),
      new THREE.MeshBasicMaterial({ color: 0xff8c42, fog: false })
    );
    disc.position.set(-60, 42, -380);
    disc.lookAt(0, 0, 0);
    scene.add(disc);

    SB.engine.setSunset();
    SB.engine._registerBurstUpdate();
    if (SB.city && SB.city.build) SB.city.build();
    SB.engine.running = true;
    return SB.engine;
  },

  // Langit + cahaya sunset. Posisi matahari TIDAK diubah di sini.
  setSunset() {
    if (!SB.engine.scene) return;
    SB.engine.scene.background = new THREE.Color(0x53304d);
    SB.engine.scene.fog = new THREE.Fog(0x53304d, 120, 420);
    if (SB.engine.sun) { SB.engine.sun.color.set(0xffb36b); SB.engine.sun.intensity = 1.15; }
    if (SB.engine.hemi) { SB.engine.hemi.intensity = 0.55; }
  },

  dispose() {
    SB.engine.running = false;
    if (SB.engine.renderer) { try { SB.engine.renderer.dispose(); } catch (e) { /* abaikan */ } }
    SB.engine.renderer = null;
    SB.engine.scene = null;
    SB.engine.camera = null;
    SB.engine.bursts = [];
    SB._updates = [];
  },

  stop() { SB.engine.running = false; },

  // Clamp hero ke dalam kota (perbaikan defect drive r13). Dipanggil tiap step().
  clampHeroToCity() {
    const h = SB.state.hero;
    const hit = SB._clampToCity(h);
    if (hit) {
      h.speed = 0;
      if (h.inVehicle && SB.vehicles && SB.vehicles.stopHeroCar) SB.vehicles.stopHeroCar();
    }
    return hit;
  },

  // Terapkan preset (API.md §16). Reset simTime + jam ke 17:24.
  applyPreset(name) {
    const p = PRESETS[name] || PRESETS.cover;
    SB.state.preset = name;
    SB.state.simTime = 0;
    SB.state.clockMinutes = CLOCK_BASE;
    SB.state.heat = p.heat;
    SB.engine.camMode = p.camMode;
    if (p.hero) {
      const h = SB.state.hero;
      h.x = p.hero.x; h.z = p.hero.z; h.heading = p.hero.heading;
      h.inVehicle = p.hero.inVehicle; h.vehicleId = p.hero.vehicleId; h.speed = p.hero.speed;
      h.y = (SB.city && SB.city.groundAt) ? SB.city.groundAt(h.x, h.z) : 0;
    }
    // Kendaraan hero (bila modul vehicles ada): pastikan mobil pink di tempatnya.
    if (SB.vehicles) {
      if (p.hero && p.hero.inVehicle && SB.vehicles.createHeroCar && !SB.vehicles.heroCar) {
        SB.vehicles.createHeroCar();
      }
      if (SB.vehicles.heroCar && p.hero && p.hero.inVehicle) {
        SB.vehicles.heroCar.position.set(p.hero.x, 0, p.hero.z);
        SB.vehicles.heroCar.rotation.y = p.hero.heading;
      }
      if (SB.vehicles.setSpeedKmh) SB.vehicles.setSpeedKmh(p.hero ? p.hero.speed : 0);
    }
    // Polisi / heli (bila modul police ada).
    if (SB.police && SB.police.setHeat) SB.police.setHeat(p.heat);
    // Kamera: preset fixed langsung snap; chase dihitung di step().
    const cam = SB.engine.camera;
    if (cam) {
      cam.position.set(p.cam.pos[0], p.cam.pos[1], p.cam.pos[2]);
      SB.engine.lookTarget.set(p.cam.look[0], p.cam.look[1], p.cam.look[2]);
      cam.lookAt(SB.engine.lookTarget);
    }
    // Misi 8 aktif untuk preset mission bila modul missions ada dan diminta.
    if (name === 'mission' && SB.missions && SB.missions.start && !SB.missions.active) {
      SB.missions.start(8);
    }
    SB.engine.render();
    return p;
  },

  // SATU-SATUNYA pemanggil SB.police.update. Urutan tetap (API.md §4).
  step(dt) {
    if (!(dt > 0)) dt = 0;
    SB.state.simTime += dt;
    SB.state.clockMinutes = CLOCK_BASE + SB.state.simTime;
    const ups = SB._updates.slice();
    for (let i = 0; i < ups.length; i++) ups[i](dt);
    if (SB.police && SB.police.update) SB.police.update(dt);
    SB.engine.clampHeroToCity();
    SB.engine._updateCamera(dt);
    SB.engine.render();
  },

  _updateCamera(dt) {
    const cam = SB.engine.camera;
    if (!cam) return;
    const h = SB.state.hero;
    if (SB.engine.camMode === 'chase') {
      const dist = h.inVehicle ? 12 : 8.5;
      const height = h.inVehicle ? 5 : 3.2;
      const fx = Math.sin(h.heading), fz = Math.cos(h.heading);
      const tx = h.x - fx * dist, tz = h.z - fz * dist;
      const k = 1 - Math.exp(-6 * dt);
      cam.position.x += (tx - cam.position.x) * k;
      cam.position.y += (height - cam.position.y) * k;
      cam.position.z += (tz - cam.position.z) * k;
      SB.engine.lookTarget.set(h.x, h.inVehicle ? 1.5 : 1.6, h.z);
      cam.lookAt(SB.engine.lookTarget);
    } else {
      cam.lookAt(SB.engine.lookTarget);
    }
  },

  render() {
    if (SB.engine.renderer && SB.engine.scene && SB.engine.camera) {
      SB.engine.renderer.render(SB.engine.scene, SB.engine.camera);
    }
  },

  // Staging screenshot: preset + 30x step(1/60) + render 2x + __shotReady.
  shot(name) {
    SB.engine.applyPreset(name);
    for (let i = 0; i < 30; i++) SB.engine.step(1 / 60);
    SB.engine.render();
    SB.engine.render();
    window.__shotReady = true;
    return true;
  },

  // Cone spotlight heli (API.md §4): opacity HARUS 0.10.
  spotCone() {
    const geo = new THREE.ConeGeometry(5, 36, 24, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfff2b0, transparent: true, opacity: 0.10,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const cone = new THREE.Mesh(geo, mat);
    return cone;
  },

  // Ledakan partikel: 24 titik, hidup 0,6 detik sim, acak via SB.rng().
  burst(x, y, z, color, n) {
    if (!SB.engine.scene) return null;
    const count = n || 24;
    const pos = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      vel.push({
        x: SB.rand(-6, 6), y: SB.rand(1, 8), z: SB.rand(-6, 6),
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: color || 0xffc861, size: 0.35, transparent: true, opacity: 1 });
    const pts = new THREE.Points(geo, mat);
    SB.engine.scene.add(pts);
    SB.engine.bursts.push({ pts, vel, life: 0.6, max: 0.6 });
    return pts;
  },

  _registerBurstUpdate() {
    if (SB.engine._burstUpdateRegistered) return;
    SB.engine._burstUpdateRegistered = true;
    SB.registerUpdate((dt) => {
      const list = SB.engine.bursts;
      for (let i = list.length - 1; i >= 0; i--) {
        const b = list[i];
        b.life -= dt;
        if (b.life <= 0) {
          if (SB.engine.scene) SB.engine.scene.remove(b.pts);
          b.pts.geometry.dispose();
          b.pts.material.dispose();
          list.splice(i, 1);
          continue;
        }
        const attr = b.pts.geometry.getAttribute('position');
        for (let j = 0; j < b.vel.length; j++) {
          attr.array[j * 3] += b.vel[j].x * dt;
          attr.array[j * 3 + 1] += b.vel[j].y * dt;
          attr.array[j * 3 + 2] += b.vel[j].z * dt;
          b.vel[j].y -= 9 * dt;
        }
        attr.needsUpdate = true;
        b.pts.material.opacity = b.life / b.max;
      }
    });
  },
};

export { SB, mulberry32 };
