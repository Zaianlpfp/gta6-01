// vehicles.js — Kendaraan Solmar Bay (gta6-01 v4 r14)
// Traffic 24 mobil + mobil hero pink "Flamingo GT" + mengemudi.
// Ditulis FRESH dari game/API.md §8. Semua acak lewat SB.rng(); jam sim
// hanya SB.state.simTime. Tidak ada acak bawaan / jam wall-clock di file ini.
import * as THREE from 'three';
import { SB } from './engine.js';

// Fisika mobil hero (km/h): akselerasi, rem, mundur, handbrake, drag.
const MAX_SPEED_KMH = 180;
const MAX_REVERSE_KMH = 30;
const ACCEL_KMH_S = 40;
const BRAKE_KMH_S = 90;
const HANDBRAKE_KMH_S = 140;
const DRAG_KMH_S = 15;
const STEER_RATE = 1.6; // rad/detik pada kecepatan penuh

// Palet warna traffic (nama + hex).
const TRAFFIC_COLORS = [
  { name: 'Sunset Red', color: 0xc0392b },
  { name: 'Ocean Blue', color: 0x2471a3 },
  { name: 'Taxi Yellow', color: 0xf2c500 },
  { name: 'Pearl White', color: 0xe8e8e8 },
  { name: 'Midnight Black', color: 0x1a1a1a },
  { name: 'Forest Green', color: 0x1e8449 },
  { name: 'Coral Orange', color: 0xe67e22 },
  { name: 'Sky Silver', color: 0x95a5a6 },
  { name: 'Plum Purple', color: 0x7d3c98 },
  { name: 'Sand Beige', color: 0xd8c49a },
];

const HERO_PINK = 0xff5da2;
const HERO_NAME = 'Flamingo GT';

// Margin dalam untuk belok otomatis tepi kota (sebelum clamp engine).
const EDGE_MARGIN = { x0: -128, x1: 203, z0: -78, z1: 173 };

SB.vehicles = {
  traffic: [],             // 24 mobil { mesh, road, t, dir, speedKmh, color, id, name }
  heroCar: null,           // THREE.Group mobil hero (pink) | null
  _heroSpeedKmh: 0,        // kecepatan mobil hero saat ini
  _wasSliding: false,      // sedang meluncur di tepi dinding (potong speed 1x saja)
  _scene: null,            // scene tempat traffic/mobil hero berada
  _registered: false,

  // Bangun satu mobil: body + kabin + 4 roda + lampu depan. Depan = +z lokal.
  _makeCar(color) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), bodyMat);
    body.position.y = 0.55;
    g.add(body);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.6, 2.2),
      new THREE.MeshLambertMaterial({ color: 0x1c2833 })
    );
    cabin.position.set(0, 1.2, -0.2);
    g.add(cabin);
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
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    for (const lx of [-0.6, 0.6]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), lampMat);
      lamp.position.set(lx, 0.6, 2.21);
      g.add(lamp);
    }
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    for (const lx of [-0.6, 0.6]) {
      const tail = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), tailMat);
      tail.position.set(lx, 0.6, -2.21);
      g.add(tail);
    }
    g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    return g;
  },

  // Mobil hero pink "Flamingo GT" di spawnPoints.cover (2, 0, 12), heading 2,6.
  createHeroCar() {
    if (!SB.engine.scene) return null;
    if (SB.vehicles.heroCar && SB.vehicles._scene === SB.engine.scene) {
      return SB.vehicles.heroCar;
    }
    // Scene berganti (re-boot): buang mobil lama dari scene lama.
    if (SB.vehicles.heroCar && SB.vehicles._scene && SB.vehicles._scene !== SB.engine.scene) {
      SB.vehicles._scene.remove(SB.vehicles.heroCar);
    }
    const g = SB.vehicles._makeCar(HERO_PINK);
    g.name = 'hero-car-flamingo';
    const sp = (SB.city && SB.city.spawnPoints && SB.city.spawnPoints.cover) || { x: 2, z: 12, heading: 2.6 };
    g.position.set(sp.x, 0, sp.z);
    g.rotation.y = sp.heading;
    g.userData.info = { id: 'flamingo', name: HERO_NAME, condition: 100, dented: false };
    SB.engine.scene.add(g);
    SB.vehicles.heroCar = g;
    SB.vehicles._scene = SB.engine.scene;
    return g;
  },

  // Set kecepatan mobil hero (dipakai preset cover/drive + staging/tes).
  // Juga memastikan traffic + update terdaftar (dipanggil applyPreset tiap preset).
  setSpeedKmh(v) {
    SB.vehicles._heroSpeedKmh = v;
    if (SB.state.hero.inVehicle) SB.state.hero.speed = v;
    SB.vehicles._ensureInit();
    return SB.vehicles._heroSpeedKmh;
  },

  // Berhenti total (dipanggil engine clamp saat hero kena tepi kota).
  stopHeroCar() {
    SB.vehicles._heroSpeedKmh = 0;
    if (SB.state.hero.inVehicle) SB.state.hero.speed = 0;
    return 0;
  },

  // Spawn 24 mobil traffic di jalan (avenue/street), warna + kecepatan seeded.
  spawnTraffic() {
    if (!SB.engine.scene || !SB.city || !SB.city.roads || SB.city.roads.length === 0) return [];
    // Bersihkan traffic lama (re-boot).
    for (let i = 0; i < SB.vehicles.traffic.length; i++) {
      const old = SB.vehicles.traffic[i];
      if (old.mesh && old.mesh.parent) old.mesh.parent.remove(old.mesh);
    }
    SB.vehicles.traffic = [];
    const roads = SB.city.roads;
    for (let i = 0; i < 24; i++) {
      const road = roads[i % roads.length];
      const pick = SB.pick(TRAFFIC_COLORS);
      const mesh = SB.vehicles._makeCar(pick.color);
      mesh.name = 'traffic-' + i;
      mesh.userData.info = {
        id: 'traffic-' + i,
        name: pick.name + ' Sedan',
        condition: 100,
        dented: false,
      };
      SB.engine.scene.add(mesh);
      SB.vehicles.traffic.push({
        id: 'traffic-' + i,
        name: pick.name + ' Sedan',
        mesh,
        road,
        t: SB.rand(0, 1),
        dir: SB.pick([-1, 1]),
        speedKmh: SB.rand(30, 60),
        color: pick.color,
        fromTraffic: true,
      });
    }
    SB.vehicles._scene = SB.engine.scene;
    return SB.vehicles.traffic;
  },

  // Pastikan traffic + mobil hero + update loop ada (tahan re-boot).
  // Dipanggil dari setSpeedKmh (yang dipanggil applyPreset tiap preset) dan
  // dari update() tiap step (penjaga bila scene berganti).
  _ensureInit() {
    if (!SB.engine.scene) return;
    if (SB.vehicles._scene !== SB.engine.scene) {
      SB.vehicles.heroCar = null;
      SB.vehicles.traffic = [];
      SB.vehicles.spawnTraffic();
      SB.vehicles.createHeroCar();
    } else if (SB.vehicles.traffic.length === 0) {
      SB.vehicles.spawnTraffic();
    }
    if (!SB.vehicles.heroCar) SB.vehicles.createHeroCar();
    if (SB.registerUpdate && SB._updates.indexOf(SB.vehicles.update) === -1) {
      SB.registerUpdate(SB.vehicles.update);
    }
    // Hero onfoot juga harus ada + terdaftar (player.js dimuat sebelum ini).
    if (SB.player && SB.player.createHero) SB.player.createHero();
  },

  // Cek tabrakan gedung: posisi (x,z) di dalam footprint gedung (+margin)?
  // margin default 1 (API.md §8). Margin 0 = footprint gedung sebenarnya.
  _hitBuilding(x, z, margin) {
    if (!SB.city || !SB.city.buildings) return false;
    const m = margin === undefined ? 1 : margin;
    const bs = SB.city.buildings;
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (Math.abs(x - b.x) < b.w / 2 + m && Math.abs(z - b.z) < b.d / 2 + m) return true;
    }
    return false;
  },

  // Cari titik terdekat di jaringan jalan (avenue/street) dari (x,z).
  // Dipakai belok otomatis: mobil yang terhalang gedung mencari jalan.
  _nearestRoadPoint(x, z) {
    if (!SB.city || !SB.city.roads || SB.city.roads.length === 0) return null;
    let best = null;
    let bestD = Infinity;
    const roads = SB.city.roads;
    for (let i = 0; i < roads.length; i++) {
      const r = roads[i];
      let px;
      let pz;
      let d;
      if (r.axis === 'x') {
        px = Math.max(r.from, Math.min(r.to, x));
        pz = r.at;
        d = Math.abs(z - r.at);
      } else {
        px = r.at;
        pz = Math.max(r.from, Math.min(r.to, z));
        d = Math.abs(x - r.at);
      }
      if (d < bestD) { bestD = d; best = { x: px, z: pz, axis: r.axis, dist: d }; }
    }
    return best;
  },
  _turnToward(heading, target, maxStep) {
    let d = target - heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (d > maxStep) d = maxStep;
    if (d < -maxStep) d = -maxStep;
    return heading + d;
  },

  // Gerak traffic + mobil hero. Terdaftar via SB.registerUpdate (BUKAN step).
  update(dt) {
    SB.vehicles._ensureInit();
    if (!SB.engine.scene) return;

    // --- Traffic: lurus di jalannya, balik arah di ujung (bukan keluar kota).
    const list = SB.vehicles.traffic;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const road = c.road;
      const len = road.to - road.from;
      c.t += (c.dir * (c.speedKmh / 3.6) * dt) / len;
      if (c.t > 1) { c.t = 1; c.dir = -1; }
      if (c.t < 0) { c.t = 0; c.dir = 1; }
      const along = road.from + c.t * len;
      if (road.axis === 'x') {
        c.mesh.position.set(along, 0, road.at + (c.dir > 0 ? 2 : -2));
        c.mesh.rotation.y = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        c.mesh.position.set(road.at + (c.dir > 0 ? -2 : 2), 0, along);
        c.mesh.rotation.y = c.dir > 0 ? 0 : Math.PI;
      }
    }

    // --- Mobil hero: hanya bergerak bila hero di dalamnya.
    const h = SB.state.hero;
    const car = SB.vehicles.heroCar;
    if (!h.inVehicle || !car) {
      if (car) {
        // Mobil parkir: sinkron mesh ke posisi terakhir yang diketahui.
        car.position.set(h.inVehicle ? h.x : car.position.x, 0, h.inVehicle ? h.z : car.position.z);
      }
      return;
    }
    const k = (SB.player && SB.player.keys) || {};
    const fwdKey = !!(k.KeyW || k.ArrowUp);
    const backKey = !!(k.KeyS || k.ArrowDown);
    const leftKey = !!(k.KeyA || k.ArrowLeft);
    const rightKey = !!(k.KeyD || k.ArrowRight);
    const brakeKey = !!k.Space;

    let v = SB.vehicles._heroSpeedKmh;
    if (fwdKey) v += ACCEL_KMH_S * dt;
    if (backKey) {
      if (v > 0.5) v -= BRAKE_KMH_S * dt;
      else v -= ACCEL_KMH_S * 0.5 * dt;
    }
    if (brakeKey) {
      if (v > 0) v -= HANDBRAKE_KMH_S * dt;
      else if (v < 0) v += HANDBRAKE_KMH_S * dt;
    }
    if (!fwdKey && !backKey && !brakeKey) {
      if (v > 0) v = Math.max(0, v - DRAG_KMH_S * dt);
      else if (v < 0) v = Math.min(0, v + DRAG_KMH_S * dt);
    }
    if (v > MAX_SPEED_KMH) v = MAX_SPEED_KMH;
    if (v < -MAX_REVERSE_KMH) v = -MAX_REVERSE_KMH;
    if (Math.abs(v) < 0.5 && !fwdKey && !backKey) v = 0;

    // Belok: laju putar sebanding kecepatan (tak bisa belok saat diam).
    const steerScale = Math.min(1, Math.abs(v) / 60);
    if (leftKey) h.heading += STEER_RATE * steerScale * dt * (v < 0 ? -1 : 1);
    if (rightKey) h.heading -= STEER_RATE * steerScale * dt * (v < 0 ? -1 : 1);

    // Belok otomatis di tepi kota (defect r13 #1, lapis tambahan selain clamp):
    // bila langkah berikut keluar margin DAN heading menghadap ke luar, putar
    // perlahan menuju pusat kota (37, 47) supaya mobil tetap di dalam kota.
    const vms = v / 3.6;
    const nx0 = h.x + Math.sin(h.heading) * vms * dt;
    const nz0 = h.z + Math.cos(h.heading) * vms * dt;
    // Guard pakai tombol juga (bukan hanya |v|>5): mobil yang terjepit clamp
    // engine (speed di-nol-kan tiap step) harus tetap bisa membelok.
    if ((fwdKey || backKey || Math.abs(v) > 5) && (nx0 < EDGE_MARGIN.x0 || nx0 > EDGE_MARGIN.x1 ||
        nz0 < EDGE_MARGIN.z0 || nz0 > EDGE_MARGIN.z1)) {
      const toCenter = Math.atan2(37 - h.x, 47 - h.z);
      h.heading = SB.vehicles._turnToward(h.heading, toCenter, 2.5 * dt);
    }

    // Gerak maju + tabrakan gedung (berhenti, tidak tembus).
    // ATURAN TABRAKAN: posisi baru di dalam footprint gedung (+1 margin)
    // dibatalkan — KECUALI mobil sudah berada di dalam footprint itu
    // (spawn di tengah blok): dari dalam, mobil BOLEH keluar (escape).
    // Sambil terhalang, mobil membelok otomatis ke jalan terdekat
    // (defect r13 #1: drive lurus harus tetap mengemudi di dalam kota).
    const insideBuilding = SB.vehicles._hitBuilding(h.x, h.z);
    const probeX = h.x + Math.sin(h.heading) * 6;
    const probeZ = h.z + Math.cos(h.heading) * 6;
    const blockedAhead = SB.vehicles._hitBuilding(probeX, probeZ);
    let nx = h.x + Math.sin(h.heading) * vms * dt;
    let nz = h.z + Math.cos(h.heading) * vms * dt;
    const blockedFull = SB.vehicles._hitBuilding(nx, nz) && !insideBuilding;
    if ((fwdKey || backKey || Math.abs(v) > 5) &&
        (blockedAhead || insideBuilding || blockedFull)) {
      const rp = SB.vehicles._nearestRoadPoint(h.x, h.z);
      if (rp) {
        if (rp.dist < 2.5) {
          // Sudah di atas jalan: luruskan heading sepanjang jalan, arah ke pusat kota.
          let target;
          if (rp.axis === 'x') target = (37 - h.x) >= 0 ? Math.PI / 2 : -Math.PI / 2;
          else target = (47 - h.z) >= 0 ? 0 : Math.PI;
          h.heading = SB.vehicles._turnToward(h.heading, target, 2.5 * dt);
        } else {
          const want = Math.atan2(rp.x - h.x, rp.z - h.z);
          h.heading = SB.vehicles._turnToward(h.heading, want, 2.5 * dt);
        }
        // Heading berubah -> hitung ulang langkah berikut.
        nx = h.x + Math.sin(h.heading) * vms * dt;
        nz = h.z + Math.cos(h.heading) * vms * dt;
      }
    }
    if (SB.vehicles._hitBuilding(nx, nz) && !insideBuilding) {
      // Terhalang: coba geser sepanjang dinding (gerak per-sumbu, diuji
      // terhadap footprint gedung SEBENARNYA / margin 0) — mobil meluncur
      // di tepi dinding, bukan menempel selamanya. Baru bila dua-duanya
      // buntu, berhenti + kondisi berkurang.
      // Potong kecepatan HANYA saat mulai meluncur (bukan tiap step),
      // supaya mobil tidak merangkak 2 km/h di sepanjang dinding.
      const slideX = !SB.vehicles._hitBuilding(nx, h.z, 0);
      const slideZ = !SB.vehicles._hitBuilding(h.x, nz, 0);
      const cutOnce = () => {
        if (!SB.vehicles._wasSliding) v *= 0.7;
        SB.vehicles._wasSliding = true;
      };
      if (slideX && Math.abs(nx - h.x) >= Math.abs(nz - h.z)) {
        h.x = nx;
        cutOnce();
      } else if (slideZ) {
        h.z = nz;
        cutOnce();
      } else if (slideX) {
        h.x = nx;
        cutOnce();
      } else {
        if (Math.abs(v) > 20) {
          if (SB.engine && SB.engine.burst) SB.engine.burst(nx, 0.8, nz, 0xffaa33, 8);
        }
        v *= 0.2;
        SB.vehicles._wasSliding = false;
        const info = car.userData.info;
        if (info) {
          info.condition = Math.max(0, info.condition - 2);
          if (info.condition < 70) info.dented = true;
          if (SB.state.vehicle) {
            SB.state.vehicle.condition = info.condition;
            SB.state.vehicle.dented = info.dented;
          }
        }
      }
    } else {
      h.x = nx;
      h.z = nz;
      SB.vehicles._wasSliding = false;
    }
    SB.vehicles._heroSpeedKmh = v;
    h.speed = v;
    h.y = SB.city && SB.city.groundAt ? SB.city.groundAt(h.x, h.z) : 0;
    car.position.set(h.x, 0, h.z);
    car.rotation.y = h.heading;
  },
};

export { SB };
