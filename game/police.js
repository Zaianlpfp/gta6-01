// police.js — Polisi Solmar Bay (gta6-01 v4 r14)
// Wanted stars 0-5, cruiser pursuit + roadblock, heli + cone spotlight,
// BUSTED respawn DI DALAM kota (guard SB._inCity).
// Ditulis FRESH dari game/API.md §9. Semua acak lewat SB.rng(); jam sim
// hanya SB.state.simTime. Tidak ada acak bawaan / jam wall-clock di file ini.
// PENTING: update(dt) HANYA dipanggil engine.step() — modul ini TIDAK
// mendaftarkan dirinya via SB.registerUpdate.
import * as THREE from 'three';
import { SB } from './engine.js';

// Response per bintang: jumlah cruiser + peran.
function rolesForHeat(n) {
  if (n <= 0) return [];
  if (n === 1) return ['pursuit'];
  if (n === 2) return ['pursuit', 'pursuit'];
  if (n === 3) return ['pursuit', 'pursuit'];
  if (n === 4) return ['pursuit', 'pursuit', 'roadblock', 'roadblock'];
  return ['pursuit', 'pursuit', 'roadblock', 'roadblock', 'enforcer'];
}

const CRUISER_MAX_KMH = 170;
const TOUCH_DIST = 2;      // meter: cruiser menyentuh hero onfoot
const TOUCH_SECONDS = 1;   // detik sentuhan -> BUSTED
const HELI_HEIGHT = 40;    // heli melayang 40 di atas hero
const CONE_HEIGHT = 36;    // tinggi cone spotlight (API.md §4)

SB.police = {
  stars: 0,                // cerminan SB.state.heat
  cruisers: [],            // { mesh, lightL, lightR, state, x, z, heading, speedKmh,
                           //   boss, enforcer, touchTime }
  heli: null,              // { mesh, rotor, cone } | null
  _scene: null,            // scene tempat unit polisi berada (deteksi re-boot)

  // Mobil polisi putih-hitam + lightbar merah-biru. Depan = +z lokal.
  _makeCruiserMesh(enforcer) {
    const g = new THREE.Group();
    const bodyColor = enforcer ? 0x111418 : 0xf2f2f2;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.7, 4.4),
      new THREE.MeshLambertMaterial({ color: bodyColor })
    );
    body.position.y = 0.55;
    g.add(body);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.6, 2.2),
      new THREE.MeshLambertMaterial({ color: 0x1c2833 })
    );
    cabin.position.set(0, 1.2, -0.2);
    g.add(cabin);
    // Kap mesin hitam untuk cruiser biasa (putih-hitam khas patroli).
    if (!enforcer) {
      const hood = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.08, 1.4),
        new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
      );
      hood.position.set(0, 0.92, 1.3);
      g.add(hood);
    }
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    for (const wx of [-0.95, 0.95]) {
      for (const wz of [-1.45, 1.45]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, 0.35, wz);
        g.add(w);
      }
    }
    // Lightbar: dua lampu emissive (merah kiri, biru kanan) berkedip via simTime.
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.18, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    bar.position.set(0, 1.58, -0.2);
    g.add(bar);
    const lightL = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.2, 0.42),
      new THREE.MeshBasicMaterial({ color: 0xff2222 })
    );
    lightL.position.set(-0.32, 1.58, -0.2);
    g.add(lightL);
    const lightR = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.2, 0.42),
      new THREE.MeshBasicMaterial({ color: 0x2255ff })
    );
    lightR.position.set(0.32, 1.58, -0.2);
    g.add(lightR);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    for (const lx of [-0.6, 0.6]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), lampMat);
      lamp.position.set(lx, 0.6, 2.21);
      g.add(lamp);
    }
    g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    return { group: g, lightL, lightR };
  },

  // Heli patroli: body + ekor + rotor berputar + cone spotlight.
  _makeHeli() {
    const g = new THREE.Group();
    g.name = 'police-heli';
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.1, 3.6),
      new THREE.MeshLambertMaterial({ color: 0x2c3e50 })
    );
    g.add(body);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 3),
      new THREE.MeshLambertMaterial({ color: 0x2c3e50 })
    );
    tail.position.set(0, 0.2, -3);
    g.add(tail);
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(7, 0.08, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x111111 })
    );
    rotor.position.y = 0.75;
    g.add(rotor);
    const skidMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    for (const sx of [-0.7, 0.7]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.6), skidMat);
      skid.position.set(sx, -0.7, 0);
      g.add(skid);
    }
    g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    const cone = SB.engine && SB.engine.spotCone ? SB.engine.spotCone() : null;
    if (cone) {
      cone.name = 'heli-spot-cone';
      SB.engine.scene.add(cone);
    }
    SB.engine.scene.add(g);
    return { mesh: g, rotor, cone };
  },

  // Spawn satu cruiser. Posisi TETAP relatif hero (deterministik, tanpa acak).
  spawnCruiser(role) {
    if (!SB.engine.scene) return null;
    const h = SB.state.hero;
    const idx = SB.police.cruisers.length;
    const enforcer = role === 'enforcer';
    const built = SB.police._makeCruiserMesh(enforcer);
    let x;
    let z;
    let heading = h.heading;
    if (role === 'roadblock') {
      // Melintang di jalan DEPAN hero (+28 m), lateral +/-5, tegak lurus.
      const fx = Math.sin(h.heading);
      const fz = Math.cos(h.heading);
      const side = idx % 2 === 0 ? 5 : -5;
      const rx = Math.cos(h.heading);
      const rz = -Math.sin(h.heading);
      x = h.x + fx * 28 + rx * side;
      z = h.z + fz * 28 + rz * side;
      heading = h.heading + Math.PI / 2;
    } else {
      // Pursuit: di belakang hero (-25 m), lateral +/-6 selang-seling.
      const fx = Math.sin(h.heading);
      const fz = Math.cos(h.heading);
      const side = idx % 2 === 0 ? 6 : -6;
      const rx = Math.cos(h.heading);
      const rz = -Math.sin(h.heading);
      x = h.x - fx * 25 + rx * side;
      z = h.z - fz * 25 + rz * side;
    }
    const clamped = { x, z };
    SB._clampToCity(clamped);
    built.group.position.set(clamped.x, 0, clamped.z);
    built.group.rotation.y = heading;
    SB.engine.scene.add(built.group);
    const rec = {
      mesh: built.group,
      lightL: built.lightL,
      lightR: built.lightR,
      state: role === 'roadblock' ? 'roadblock' : 'pursuit',
      x: clamped.x,
      z: clamped.z,
      heading,
      speedKmh: 0,
      boss: false,
      enforcer,
      touchTime: 0,
    };
    SB.police.cruisers.push(rec);
    return rec;
  },

  despawnCruisers() {
    for (let i = 0; i < SB.police.cruisers.length; i++) {
      const c = SB.police.cruisers[i];
      if (c.mesh && c.mesh.parent) c.mesh.parent.remove(c.mesh);
    }
    SB.police.cruisers = [];
  },

  spawnHeli() {
    if (!SB.engine.scene) return null;
    if (SB.police.heli) return SB.police.heli;
    const h = SB.state.hero;
    const heli = SB.police._makeHeli();
    heli.mesh.position.set(h.x, HELI_HEIGHT, h.z - 10);
    SB.police.heli = heli;
    return heli;
  },

  despawnHeli() {
    const heli = SB.police.heli;
    if (!heli) return;
    if (heli.cone && heli.cone.parent) heli.cone.parent.remove(heli.cone);
    if (heli.mesh && heli.mesh.parent) heli.mesh.parent.remove(heli.mesh);
    SB.police.heli = null;
  },

  // Set wanted 0..5; spawn/despawn unit sesuai response. Cermin ke SB.state.heat.
  setHeat(n) {
    const heat = Math.max(0, Math.min(5, Math.floor(n)));
    SB.state.heat = heat;
    SB.police.stars = heat;
    if (!SB.engine.scene) return heat;
    // Scene berganti (re-boot): unit lama milik scene lama — bangun ulang.
    if (SB.police._scene !== SB.engine.scene) {
      SB.police.cruisers = [];
      SB.police.heli = null;
      SB.police._scene = SB.engine.scene;
    }
    const roles = rolesForHeat(heat);
    while (SB.police.cruisers.length > roles.length) {
      const c = SB.police.cruisers.pop();
      if (c.mesh && c.mesh.parent) c.mesh.parent.remove(c.mesh);
    }
    while (SB.police.cruisers.length < roles.length) {
      SB.police.spawnCruiser(roles[SB.police.cruisers.length]);
    }
    // Tandai peran: cruiser pertama = boss (pimpinan kejar) bila heat >= 4.
    for (let i = 0; i < SB.police.cruisers.length; i++) {
      const c = SB.police.cruisers[i];
      c.boss = heat >= 4 && i === 0;
      c.enforcer = roles[i] === 'enforcer';
      c.state = roles[i] === 'roadblock' ? 'roadblock' : 'pursuit';
    }
    if (heat >= 3) SB.police.spawnHeli();
    else SB.police.despawnHeli();
    return heat;
  },

  // BUSTED: respawn DI DALAM kota. Guard: di luar envelope -> (0,40) onfoot.
  // JANGAN PERNAH respawn ke (-150,250) void.
  busted() {
    SB.state.cash = Math.max(0, SB.state.cash - 50);
    SB.state.health = 90;
    SB.state.heat = 0;
    SB.police.stars = 0;
    SB.state.flags.busted = true;
    let x = SB.state.hero.x;
    let z = SB.state.hero.z;
    if (!SB._inCity(x, z)) { x = 0; z = 40; } // <-- GUARD in-city
    SB.state.hero.x = x;
    SB.state.hero.z = z;
    SB.state.hero.heading = Math.PI;
    SB.state.hero.inVehicle = false;
    SB.state.hero.vehicleId = null;
    SB.state.hero.speed = 0;
    SB.state.vehicle = null;
    SB.state.hero.y = SB.city && SB.city.groundAt ? SB.city.groundAt(x, z) : 0;
    if (SB.vehicles) SB.vehicles._heroSpeedKmh = 0;
    // Bersihkan unit polisi (heat 0) + sinkron mesh hero.
    SB.police.setHeat(0);
    if (SB.player && SB.player.updateHeroMesh) SB.player.updateHeroMesh();
    return { x, z, inCity: SB._inCity(x, z) };
  },

  // -> '★★★★☆' untuk HUD.
  wantedStars() {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < SB.police.stars ? '★' : '☆';
    return s;
  },

  // SATU-SATUNYA pemanggil: engine.step(). JANGAN daftarkan via registerUpdate.
  update(dt) {
    if (!SB.engine.scene) return;
    // Scene berganti (re-boot): unit lama orphan — bangun ulang sesuai heat.
    if (SB.police._scene !== SB.engine.scene) {
      SB.police.cruisers = [];
      SB.police.heli = null;
      SB.police._scene = SB.engine.scene;
      const heat = SB.state.heat;
      if (heat > 0) SB.police.setHeat(heat);
    }
    // Pastikan jumlah unit sesuai heat (bila setHeat dipanggil sebelum scene ada).
    const roles = rolesForHeat(SB.state.heat);
    while (SB.police.cruisers.length < roles.length) {
      SB.police.spawnCruiser(roles[SB.police.cruisers.length]);
    }
    if (SB.state.heat >= 3 && !SB.police.heli) SB.police.spawnHeli();

    const h = SB.state.hero;
    const heroSpeed = h.speed || 0; // km/h
    const blink = Math.floor(SB.state.simTime * 4) % 2 === 0;

    // Cruiser pursuit: kejar hero (0,9x kecepatan hero + 5 km/h, maks 170).
    for (let i = 0; i < SB.police.cruisers.length; i++) {
      const c = SB.police.cruisers[i];
      if (c.state === 'roadblock') {
        // Roadblock diam di tempat (melintang), lampu tetap berkedip.
      } else {
        const target = Math.min(CRUISER_MAX_KMH, 0.9 * heroSpeed + 5);
        c.speedKmh = target;
        const dx = h.x - c.x;
        const dz = h.z - c.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.01) {
          const vms = (c.speedKmh / 3.6) * dt;
          const stepLen = Math.min(vms, dist);
          c.x += (dx / dist) * stepLen;
          c.z += (dz / dist) * stepLen;
          c.heading = Math.atan2(dx, dz);
        }
        // Sentuh hero onfoot (< 2 m) selama 1 detik -> BUSTED.
        if (!h.inVehicle && Math.hypot(h.x - c.x, h.z - c.z) < TOUCH_DIST) {
          c.touchTime += dt;
          if (c.touchTime >= TOUCH_SECONDS) {
            SB.police.busted();
            return;
          }
        } else {
          c.touchTime = 0;
        }
      }
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      // Lightbar merah-biru berkedip via simTime.
      if (c.lightL && c.lightL.material) c.lightL.material.color.set(blink ? 0xff2222 : 0x551111);
      if (c.lightR && c.lightR.material) c.lightR.material.color.set(blink ? 0x112255 : 0x2255ff);
    }

    // Heli: ikuti hero 40 m di atas; rotor berputar; cone menyorot hero.
    const heli = SB.police.heli;
    if (heli) {
      heli.mesh.position.set(h.x, HELI_HEIGHT, h.z - 10);
      if (heli.rotor) heli.rotor.rotation.y += dt * 20;
      if (heli.cone) {
        // Cone tinggi 36, pusat di y=22: ujung atas di heli (40), alas di tanah.
        heli.cone.position.set(h.x, HELI_HEIGHT - CONE_HEIGHT / 2, h.z);
      }
    }
  },
};

export { SB };
