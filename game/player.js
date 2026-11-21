// player.js — Hero Solmar Bay (gta6-01 v4 r14)
// Hero onfoot + masuk/keluar kendaraan + tembak + damage.
// Ditulis FRESH dari game/API.md §7. Semua acak lewat SB.rng(); jam sim
// hanya SB.state.simTime. Tidak ada acak bawaan / jam wall-clock di file ini.
import * as THREE from 'three';
import { SB } from './engine.js';

// Kecepatan onfoot (m/s): jalan 4, lari 7. Kecepatan putar 2,4 rad/detik.
const WALK_SPEED = 4;
const RUN_SPEED = 7;
const TURN_RATE = 2.4;
const JUMP_VELOCITY = 6;
const GRAVITY = 20;

// Warna hero: jaket amber, celana gelap, kulit, topi gelap.
const JACKET = 0xffb347;
const JACKET_DARK = 0xe89b3c;
const PANTS = 0x2b2b33;
const SKIN = 0xe8b88a;
const CAP = 0x1a1a1a;

SB.player = {
  hero: null,            // THREE.Group hero (dibuat createHero)
  legL: null,
  legR: null,
  armL: null,
  armR: null,
  keys: {},              // state tombol: e.code -> true/false
  _jumpV: 0,             // kecepatan vertikal lompat (m/s)
  _onGround: true,
  _scene: null,          // scene tempat mesh hero berada (deteksi re-boot)
  _listenersAttached: false,

  // Bangun mesh hero (~1,8 tinggi): jaket amber, celana gelap.
  // Dipanggil malas: bila scene belum ada, tunda sampai update() pertama.
  createHero() {
    if (SB.player.hero && SB.player._scene === SB.engine.scene && SB.engine.scene) {
      return SB.player.hero;
    }
    if (!SB.engine.scene) return null;
    // Scene berganti (re-boot): buang mesh lama dari scene lama.
    if (SB.player.hero && SB.player._scene && SB.player._scene !== SB.engine.scene) {
      SB.player._scene.remove(SB.player.hero);
    }
    const g = new THREE.Group();
    g.name = 'hero';

    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.65, 0.28),
      new THREE.MeshLambertMaterial({ color: JACKET })
    );
    torso.position.y = 1.05;
    g.add(torso);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 12, 12),
      new THREE.MeshLambertMaterial({ color: SKIN })
    );
    head.position.y = 1.55;
    g.add(head);

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.1, 0.36),
      new THREE.MeshLambertMaterial({ color: CAP })
    );
    cap.position.y = 1.68;
    g.add(cap);

    const legMat = new THREE.MeshLambertMaterial({ color: PANTS });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), legMat);
    legL.position.set(-0.12, 0.35, 0);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), legMat);
    legR.position.set(0.12, 0.35, 0);
    g.add(legL);
    g.add(legR);

    const armMat = new THREE.MeshLambertMaterial({ color: JACKET_DARK });
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.6, 0.13), armMat);
    armL.position.set(-0.33, 1.05, 0);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.6, 0.13), armMat);
    armR.position.set(0.33, 1.05, 0);
    g.add(armL);
    g.add(armR);

    g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    SB.engine.scene.add(g);
    SB.player.hero = g;
    SB.player.legL = legL;
    SB.player.legR = legR;
    SB.player.armL = armL;
    SB.player.armR = armR;
    SB.player._scene = SB.engine.scene;

    SB.player._attachListeners();
    // Daftarkan update ke loop engine (tahan re-boot: cek keanggotaan tiap kali).
    if (SB.registerUpdate && SB._updates.indexOf(SB.player.update) === -1) {
      SB.registerUpdate(SB.player.update);
    }
    SB.player.updateHeroMesh();
    return g;
  },

  // Listener keyboard sekali saja (aman di headless: guard window/document).
  _attachListeners() {
    if (SB.player._listenersAttached) return;
    if (typeof window === 'undefined' || !window.addEventListener) return;
    SB.player._listenersAttached = true;
    window.addEventListener('keydown', (e) => {
      SB.player.keys[e.code] = true;
      if (e.code === 'KeyE' && !e.repeat) {
        if (SB.state.hero.inVehicle) SB.player.exitVehicle();
        else SB.player.enterVehicle();
      }
      if (e.code === 'KeyF' && !e.repeat) SB.player.fire();
      if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) {
        if (e.target === document.body) e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      SB.player.keys[e.code] = false;
    });
    window.addEventListener('blur', () => {
      SB.player.keys = {};
    });
  },

  // Untuk tes/probe: set tombol secara programatik (tanpa DOM).
  setKey(code, down) {
    SB.player.keys[code] = !!down;
  },

  // Gerak onfoot WASD + Shift lari + Space lompat. Tulis SB.state.hero tiap step.
  update(dt) {
    if (!SB.engine.scene) return;
    SB.player.createHero();
    const h = SB.state.hero;
    // Di dalam kendaraan: mobil yang menggerakkan hero (vehicles.update).
    if (h.inVehicle) {
      SB.player.updateHeroMesh();
      return;
    }
    const k = SB.player.keys;
    const fwd = (k.KeyW || k.ArrowUp) ? 1 : 0;
    const back = (k.KeyS || k.ArrowDown) ? 1 : 0;
    const left = (k.KeyA || k.ArrowLeft) ? 1 : 0;
    const right = (k.KeyD || k.ArrowRight) ? 1 : 0;
    const run = !!(k.ShiftLeft || k.ShiftRight);
    const moving = (fwd || back || left || right) ? true : false;

    if (left) h.heading += TURN_RATE * dt;
    if (right) h.heading -= TURN_RATE * dt;

    const speedMs = run ? RUN_SPEED : WALK_SPEED;
    let mx = 0;
    let mz = 0;
    if (fwd || back) {
      const dir = fwd ? 1 : -1;
      const s = speedMs * dir;
      mx = Math.sin(h.heading) * s;
      mz = Math.cos(h.heading) * s;
    }
    if (mx !== 0 || mz !== 0) {
      h.x += mx * dt;
      h.z += mz * dt;
      h.speed = speedMs * 3.6;
      // Input gerak pertama: kamera fixed (cover/mission) jadi chase.
      if (SB.engine.camMode === 'fixed') SB.engine.camMode = 'chase';
    } else {
      h.speed = 0;
    }

    // Lompat kecil (Space): gravitasi sim, mendarat di groundAt (0).
    if (k.Space && SB.player._onGround) {
      SB.player._jumpV = JUMP_VELOCITY;
      SB.player._onGround = false;
    }
    if (!SB.player._onGround) {
      h.y += SB.player._jumpV * dt;
      SB.player._jumpV -= GRAVITY * dt;
      const gy = SB.city && SB.city.groundAt ? SB.city.groundAt(h.x, h.z) : 0;
      if (h.y <= gy) {
        h.y = gy;
        SB.player._jumpV = 0;
        SB.player._onGround = true;
      }
    }

    // Hero TIDAK boleh keluar envelope (lapis pengaman di samping engine clamp).
    SB._clampToCity(h);
    SB.player.updateHeroMesh();
  },

  // Sinkron mesh hero <-> SB.state.hero. Dipanggil tiap step (juga oleh engine).
  updateHeroMesh() {
    const g = SB.player.hero;
    if (!g) return;
    const h = SB.state.hero;
    if (h.inVehicle) {
      g.visible = false;
      return;
    }
    g.visible = true;
    g.position.set(h.x, h.y || 0, h.z);
    g.rotation.y = h.heading;
    // Ayun kaki/tangan saat jalan/lari (simTime, bukan jam wall).
    const moving = h.speed > 0.1;
    const swing = moving ? Math.sin(SB.state.simTime * 10) * 0.5 : 0;
    if (SB.player.legL) SB.player.legL.rotation.x = swing;
    if (SB.player.legR) SB.player.legR.rotation.x = -swing;
    if (SB.player.armL) SB.player.armL.rotation.x = -swing * 0.8;
    if (SB.player.armR) SB.player.armR.rotation.x = swing * 0.8;
  },

  // Cari kendaraan terdekat (mobil hero pink atau traffic) dalam 4,5 m.
  _nearestCar(maxDist) {
    const h = SB.state.hero;
    const d = maxDist || 4.5;
    let best = null;
    let bestDist = d;
    const consider = (car) => {
      if (!car || !car.mesh) return;
      const dx = car.mesh.position.x - h.x;
      const dz = car.mesh.position.z - h.z;
      const dist = Math.hypot(dx, dz);
      if (dist < bestDist) { bestDist = dist; best = car; }
    };
    if (SB.vehicles) {
      if (SB.vehicles.heroCar) {
        consider({
          id: 'flamingo',
          name: 'Flamingo GT',
          mesh: SB.vehicles.heroCar,
          fromTraffic: false,
        });
      }
      const t = SB.vehicles.traffic || [];
      for (let i = 0; i < t.length; i++) consider(t[i]);
    }
    return best;
  },

  // Naik kendaraan terdekat (tombol E). Bila argumen diberikan, pakai itu.
  enterVehicle(vehicle) {
    const h = SB.state.hero;
    if (h.inVehicle) return false;
    const car = vehicle || SB.player._nearestCar(4.5);
    if (!car || !car.mesh) return false;
    // Mobil traffic yang dicuri jadi mobil hero (keluar dari daftar traffic).
    if (car.fromTraffic && SB.vehicles && SB.vehicles.traffic) {
      const idx = SB.vehicles.traffic.indexOf(car);
      if (idx !== -1) SB.vehicles.traffic.splice(idx, 1);
      SB.vehicles.heroCar = car.mesh;
    }
    const info = (car.mesh.userData && car.mesh.userData.info) || {
      id: car.id || 'car',
      name: car.name || 'Car',
      condition: 100,
      dented: false,
    };
    h.inVehicle = true;
    h.vehicleId = info.id;
    h.speed = 0;
    // Snap hero ke posisi + heading mobil (mobil tidak teleport ke hero).
    h.x = car.mesh.position.x;
    h.z = car.mesh.position.z;
    h.heading = car.mesh.rotation.y;
    if (SB.vehicles) SB.vehicles._heroSpeedKmh = 0;
    SB.state.vehicle = {
      id: info.id,
      name: info.name,
      condition: info.condition,
      dented: info.dented,
    };
    SB.player.updateHeroMesh();
    return true;
  },

  // Turun (tombol E): spawn di samping kendaraan (sisi kanan), tetap di kota.
  exitVehicle() {
    const h = SB.state.hero;
    if (!h.inVehicle) return false;
    let cx = h.x;
    let cz = h.z;
    if (SB.vehicles && SB.vehicles.heroCar) {
      cx = SB.vehicles.heroCar.position.x;
      cz = SB.vehicles.heroCar.position.z;
    }
    // Sisi kanan mobil: right = (cos h, -sin h).
    const rx = Math.cos(h.heading);
    const rz = -Math.sin(h.heading);
    h.x = cx + rx * 2.5;
    h.z = cz + rz * 2.5;
    h.y = SB.city && SB.city.groundAt ? SB.city.groundAt(h.x, h.z) : 0;
    h.inVehicle = false;
    h.vehicleId = null;
    h.speed = 0;
    SB.state.vehicle = null;
    if (SB.vehicles) SB.vehicles._heroSpeedKmh = 0;
    SB._clampToCity(h);
    SB.player.updateHeroMesh();
    return true;
  },

  // Tembak (tombol F): muzzle flash + suara + heat naik bila polisi dekat.
  fire() {
    const h = SB.state.hero;
    const fx = Math.sin(h.heading);
    const fz = Math.cos(h.heading);
    const mx = h.x + fx * 1.2;
    const my = (h.y || 0) + 1.4;
    const mz = h.z + fz * 1.2;
    if (SB.engine && SB.engine.burst) SB.engine.burst(mx, my, mz, 0xffc861, 16);
    if (SB.audio && SB.audio.gunshot) SB.audio.gunshot();
    // Menembak di dekat polisi menaikkan heat 1 bintang (maks 5).
    if (SB.police && SB.police.cruisers) {
      let near = false;
      for (let i = 0; i < SB.police.cruisers.length; i++) {
        const c = SB.police.cruisers[i];
        if (Math.hypot(c.x - h.x, c.z - h.z) < 40) { near = true; break; }
      }
      if (near && SB.police.setHeat) {
        SB.police.setHeat(Math.min(5, SB.state.heat + 1));
      }
    }
    return true;
  },

  // Kurangi health/armor; armor menyerap dulu. health <= 0 -> BUSTED.
  damage(amount) {
    let rest = amount;
    if (SB.state.armor > 0) {
      const absorbed = Math.min(SB.state.armor, rest);
      SB.state.armor -= absorbed;
      rest -= absorbed;
    }
    if (rest > 0) SB.state.health -= rest;
    if (SB.state.health <= 0) {
      SB.state.health = 0;
      if (SB.police && SB.police.busted) SB.police.busted();
    }
    return SB.state.health;
  },
};

export { SB };
