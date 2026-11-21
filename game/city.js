// city.js — Kota "Solmar Bay" (gta6-01 v4 r14)
// 71 gedung, 9 distrik, jalan, palm, neon, props, pantai + marina, 20 peds.
// Ditulis FRESH dari game/API.md. Tanpa acak/jam bawaan JS di file ini.
import * as THREE from 'three';
import { SB } from './engine.js';

const ROAD_X = [-110, -60, -10, 40, 90, 140, 190]; // street (sumbu-z)
const ROAD_Z = [-60, -20, 20, 60, 100, 140];       // avenue (sumbu-x)
const ROAD_W = 12;

// Interval blok di antara garis jalan, di dalam [lo,hi].
function intervals(roads, lo, hi) {
  const pts = [lo].concat(roads.filter((r) => r > lo && r < hi)).concat([hi]);
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) out.push([pts[i], pts[i + 1]]);
  return out;
}

SB.city = {
  group: null,
  buildings: [],
  roads: [],
  palms: [],
  neonSigns: [],
  props: [],
  peds: [],
  districts: [
    { name: 'Old Harbor', x0: -140, x1: -20, z0: -90, z1: 0, count: 8, hMin: 6, hMax: 16, palette: [0x9a6b4f, 0x7d5a44, 0x8a6f5c, 0x6e4a3a] },
    { name: 'Civic Center', x0: -20, x1: 100, z0: -90, z1: 0, count: 10, hMin: 10, hMax: 28, palette: [0xe8dcc0, 0xd8cba8, 0xc9b896, 0xbfae8e] },
    { name: 'Villa Verde', x0: 100, x1: 215, z0: -90, z1: 0, count: 8, hMin: 6, hMax: 14, palette: [0xf2c9a0, 0xf7d774, 0x9fd8c9, 0xf2a0a0] },
    { name: 'Deco Row', x0: -140, x1: -20, z0: 0, z1: 95, count: 8, hMin: 8, hMax: 20, palette: [0x7fb3d5, 0xf2a65a, 0xe86a92, 0x9b59b6] },
    { name: 'Downtown', x0: -20, x1: 100, z0: 0, z1: 95, count: 8, hMin: 18, hMax: 55, palette: [0x5a6b7d, 0x3f5a70, 0x6b7d8a, 0x4a5a6b] },
    { name: 'Coral Court', x0: 100, x1: 215, z0: 0, z1: 95, count: 8, hMin: 6, hMax: 16, palette: [0xe8a87c, 0xd8b36a, 0xc98a7a, 0xa8c686] },
    { name: 'Palma Beach', x0: -140, x1: -20, z0: 95, z1: 185, count: 7, hMin: 4, hMax: 10, palette: [0xf7e8c8, 0xe8c9a0, 0xd8b48a, 0xf2d8a0] },
    { name: 'Marina Bay', x0: -20, x1: 100, z0: 95, z1: 185, count: 7, hMin: 4, hMax: 12, palette: [0xa8c8d8, 0x8fb8c8, 0xc8d8e0, 0x7fa8b8] },
    { name: 'Solmar Heights', x0: 100, x1: 215, z0: 95, z1: 185, count: 7, hMin: 6, hMax: 14, palette: [0xe8d8b8, 0xd8c8a8, 0xf2e8d0, 0xc8b898] },
  ],
  bank: { pos: { x: 2, z: -16 }, signPos: { x: 2, y: 7, z: -2 }, signSize: [14, 3.5] },
  spawnPoints: {
    onfoot: { x: 0, z: 40, heading: Math.PI },
    drive: { x: 0, z: 20, heading: 0 },
    cover: { x: 2, z: 12, heading: 2.6 },
    mission: { x: 2, z: 10, heading: Math.PI },
    map: { x: 37, z: 47 },
  },

  groundAt(x, z) { return 0; },
  nearBank(x, z) { return Math.hypot(x - 2, z - (-2)) < 12; },

  // Texture papan bank 2048x512 — teks SATU BARIS utuh, jangan dipotong.
  makeBankSignTexture() {
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#1a2233'; g.fillRect(0, 0, 2048, 512);
    g.strokeStyle = '#ffd76a'; g.lineWidth = 10;
    g.strokeRect(14, 14, 2020, 484);
    g.strokeStyle = '#8a6d2f'; g.lineWidth = 4;
    g.strokeRect(30, 30, 1988, 452);
    g.fillStyle = '#ffd76a';
    g.font = 'bold 92px Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('SOLMAR NATIONAL BANK ★ EST. 1962 ★', 1024, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  },

  // 3 varian texture jendela (canvas), dibuat sekali per build dengan SB.rng().
  _makeWindowTextures() {
    const variants = [];
    for (let v = 0; v < 3; v++) {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#20242c'; g.fillRect(0, 0, 128, 256);
      for (let y = 8; y < 248; y += 22) {
        for (let x = 8; x < 120; x += 18) {
          const lit = SB.rng() < 0.45;
          g.fillStyle = lit ? (SB.rng() < 0.7 ? '#ffd98a' : '#9fd8ff') : '#12151c';
          g.fillRect(x, y, 12, 14);
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      variants.push(tex);
    }
    return variants;
  },

  // Texture jalan: aspal + garis tengah kuning putus + tepi putih.
  _makeRoadTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#2b2b33'; g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#3a3a44'; g.fillRect(0, 0, 256, 6); g.fillRect(0, 58, 256, 6);
    g.fillStyle = '#e8c84a';
    for (let x = 0; x < 256; x += 64) g.fillRect(x, 29, 34, 6);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  },

  // Kandidat lot gedung di distrik (pusat blok antar jalan, urutan tetap).
  _districtLots(d) {
    const xs = intervals(ROAD_X, d.x0, d.x1);
    const zs = intervals(ROAD_Z, d.z0, d.z1);
    const lots = [];
    for (let i = 0; i < xs.length; i++) {
      const wdt = xs[i][1] - xs[i][0];
      if (wdt < 18) continue;
      const subs = wdt >= 44 ? [[xs[i][0], (xs[i][0] + xs[i][1]) / 2], [(xs[i][0] + xs[i][1]) / 2, xs[i][1]]] : [xs[i]];
      for (let s = 0; s < subs.length; s++) {
        for (let j = 0; j < zs.length; j++) {
          const dep = zs[j][1] - zs[j][0];
          if (dep < 16) continue;
          let cz = (zs[j][0] + zs[j][1]) / 2;
          if (cz > 146) cz = 146; // blok pantai: tempel ke promenade
          lots.push({ cx: (subs[s][0] + subs[s][1]) / 2, cz, wdt: subs[s][1] - subs[s][0], dep });
        }
      }
    }
    return lots;
  },

  _addBuilding(x, z, w, d, h, district, winTex, roofColor) {
    const group = SB.city.group;
    const side = new THREE.MeshLambertMaterial({ map: winTex, color: 0xffffff });
    const roof = new THREE.MeshLambertMaterial({ color: roofColor || 0x3a3f46 });
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, [side, side, roof, roof, side, side]);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    // Atap: box tipis di atas.
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6), roof);
    cap.position.set(x, h + 0.25, z);
    group.add(cap);
    const rec = { x, z, w, d, h, district, mesh };
    SB.city.buildings.push(rec);
    return rec;
  },

  build() {
    const scene = SB.engine.scene;
    if (!scene) return;
    if (SB.city.group) scene.remove(SB.city.group);
    SB.city.buildings = []; SB.city.roads = []; SB.city.palms = [];
    SB.city.neonSigns = []; SB.city.props = []; SB.city.peds = [];
    const group = new THREE.Group();
    SB.city.group = group;
    scene.add(group);

    // --- Tanah dasar ---
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(480, 380),
      new THREE.MeshLambertMaterial({ color: 0x7a7264 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(37, 0, 47);
    ground.receiveShadow = true;
    group.add(ground);

    // --- Jalan + trotoar ---
    const roadTex = SB.city._makeRoadTexture();
    const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
    const walkMat = new THREE.MeshLambertMaterial({ color: 0x8a8578 });
    const addRoad = (axis, at, from, to) => {
      const len = to - from;
      const tex = roadTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(Math.max(1, Math.round(len / 16)), 1);
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      let mesh;
      if (axis === 'x') {
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, ROAD_W), mat);
        mesh.position.set((from + to) / 2, 0.02, at);
        // trotoar
        for (const s of [-1, 1]) {
          const w = new THREE.Mesh(new THREE.PlaneGeometry(len, 3), walkMat);
          w.rotation.x = -Math.PI / 2; w.position.set((from + to) / 2, 0.03, at + s * (ROAD_W / 2 + 1.5));
          w.receiveShadow = true; group.add(w);
        }
      } else {
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, len), mat);
        mesh.position.set(at, 0.02, (from + to) / 2);
        for (const s of [-1, 1]) {
          const w = new THREE.Mesh(new THREE.PlaneGeometry(3, len), walkMat);
          w.rotation.x = -Math.PI / 2; w.position.set(at + s * (ROAD_W / 2 + 1.5), 0.03, (from + to) / 2);
          w.receiveShadow = true; group.add(w);
        }
      }
      mesh.rotation.x = -Math.PI / 2;
      mesh.receiveShadow = true;
      group.add(mesh);
      SB.city.roads.push({ axis, at, from, to, width: ROAD_W });
    };
    for (const z of ROAD_Z) addRoad('x', z, -140, 215);
    for (const x of ROAD_X) addRoad('z', x, -90, 185);
    addRoad('x', 148, -140, 215); // promenade pantai

    // --- Plaza + tembok selatan (defect #1 lapis c: mobil tak bisa lolos ke selatan) ---
    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(355, 14), new THREE.MeshLambertMaterial({ color: 0x8a8578 }));
    plaza.rotation.x = -Math.PI / 2; plaza.position.set(37, 0.015, -77);
    plaza.receiveShadow = true; group.add(plaza);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x9a8f7a });
    for (let x = -140; x < 215; x += 10) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(10, 2.2, 1), wallMat);
      wall.position.set(x + 5, 1.1, -84);
      wall.castShadow = true;
      group.add(wall);
    }

    // --- Gedung (71) ---
    const winTexs = SB.city._makeWindowTextures();
    const districts = SB.city.districts;
    for (let di = 0; di < districts.length; di++) {
      const d = districts[di];
      let need = d.count;
      if (d.name === 'Civic Center') {
        // Bank + balai kota (2 gedung khusus), lalu 8 lot grid.
        SB.city._addBuilding(2, -16, 24, 18, 14, d.name, winTexs[0], 0x8a7a5a);
        SB.city._addBuilding(60, -40, 20, 16, 22, d.name, winTexs[1], 0x4a4f55);
        need -= 2;
      }
      const lots = SB.city._districtLots(d);
      let placed = 0;
      for (let li = 0; li < lots.length && placed < need; li++) {
        const lot = lots[li];
        // Jangan timpa bank / balai kota.
        if (Math.abs(lot.cx - 2) < 22 && Math.abs(lot.cz - (-16)) < 17) continue;
        if (Math.abs(lot.cx - 60) < 20 && Math.abs(lot.cz - (-40)) < 15) continue;
        // Jangan timpa titik spawn (defect r14, perbaikan integrator): dua
        // tower Downtown menelan spawn — cover (2,12) + mission (2,10) di
        // dalam tower (1.4,8.8) w15,6 d14, onfoot (0,40) di dalam tower
        // (0.7,39.2) w14,6 d10 — sehingga screenshot jadi dinding gelap.
        // Margin 14 > setengah lebar gedung maks (9,5) + jitter (2,5).
        if (Math.abs(lot.cx - 2) < 14 && Math.abs(lot.cz - 12) < 14) continue;
        if (Math.abs(lot.cx - 0) < 14 && Math.abs(lot.cz - 40) < 14) continue;
        if (Math.abs(lot.cx - 0) < 14 && Math.abs(lot.cz - 20) < 14) continue;
        const w = Math.min(lot.wdt - 6, SB.rand(12, 20));
        const dep = Math.min(lot.dep - 6, SB.rand(10, 18));
        const h = SB.rand(d.hMin, d.hMax);
        const jx = SB.rand(-2.5, 2.5), jz = SB.rand(-2.5, 2.5);
        const color = SB.pick(d.palette);
        const tex = winTexs[Math.floor(SB.rng() * 3)];
        // Warna distrik via tint material sisi (clone agar warna beda per gedung).
        const side = new THREE.MeshLambertMaterial({ map: tex, color });
        const roof = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
        const geo = new THREE.BoxGeometry(w, h, dep);
        const mesh = new THREE.Mesh(geo, [side, side, roof, roof, side, side]);
        mesh.position.set(lot.cx + jx, h / 2, lot.cz + jz);
        mesh.castShadow = true; mesh.receiveShadow = true;
        group.add(mesh);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, dep + 0.6), roof);
        cap.position.set(lot.cx + jx, h + 0.25, lot.cz + jz);
        group.add(cap);
        SB.city.buildings.push({ x: lot.cx + jx, z: lot.cz + jz, w, d: dep, h, district: d.name, mesh });
        placed++;
      }
    }

    // --- Bank: kolom + papan nama (texture 2048x512) ---
    const bank = SB.city.bank;
    const colMat = new THREE.MeshLambertMaterial({ color: 0xf2ead8 });
    for (const dx of [-9, -3, 3, 9]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 12, 12), colMat);
      col.position.set(bank.pos.x + dx, 6, bank.pos.z + 9.5);
      col.castShadow = true;
      group.add(col);
    }
    const signTex = SB.city.makeBankSignTexture();
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(bank.signSize[0], bank.signSize[1]),
      new THREE.MeshBasicMaterial({ map: signTex })
    );
    sign.position.set(bank.signPos.x, bank.signPos.y, bank.signPos.z);
    group.add(sign);

    // --- Pantai + air + marina ---
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(355, 35), new THREE.MeshLambertMaterial({ color: 0xe6d3a3 }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(37, 0.015, 167.5);
    sand.receiveShadow = true; group.add(sand);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(480, 60), new THREE.MeshLambertMaterial({ color: 0x2e6f8e }));
    water.rotation.x = -Math.PI / 2; water.position.set(37, -0.05, 215);
    group.add(water);
    // Dermaga + kapal (Marina Bay).
    const dockMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
    for (const dx of [-40, 0, 40]) {
      const dock = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.5, 30), dockMat);
      dock.position.set(dx, 0.25, 165);
      group.add(dock);
    }
    for (let i = 0; i < 5; i++) {
      const bx = SB.rand(-55, 55), bz = SB.rand(155, 178);
      const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 8), new THREE.MeshLambertMaterial({ color: SB.pick([0xf2f2f2, 0xd8e8f2, 0xf2d8a0]) }));
      hull.position.set(bx, 0.5, bz);
      group.add(hull);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7, 6), new THREE.MeshLambertMaterial({ color: 0x5a4632 }));
      mast.position.set(bx, 4, bz);
      group.add(mast);
      SB.city.props.push(hull);
    }
    // Payung + kursi pantai.
    for (let i = 0; i < 6; i++) {
      const ux = SB.rand(-120, 200), uz = SB.rand(152, 175);
      const umb = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.2, 8), new THREE.MeshLambertMaterial({ color: SB.pick([0xe86a92, 0xf2a65a, 0x7fb3d5]) }));
      umb.position.set(ux, 2.2, uz);
      group.add(umb);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2, 6), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
      pole.position.set(ux, 1, uz);
      group.add(pole);
      SB.city.props.push(umb);
    }

    // --- Palm (~60): batang + kanopi cone ---
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7d32 });
    const palmSpots = [];
    for (let x = -130; x <= 205; x += 11) { palmSpots.push([x + SB.rand(-2, 2), 20 + 9]); palmSpots.push([x + SB.rand(-2, 2), 100 - 9]); }
    for (let x = -130; x <= 205; x += 12) { palmSpots.push([x + SB.rand(-2, 2), 152]); }
    for (let i = 0; i < palmSpots.length; i++) {
      const px = palmSpots[i][0], pz = palmSpots[i][1];
      if (!SB._inCity(px, pz)) continue;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 4, 6), trunkMat);
      trunk.position.set(px, 2, pz);
      trunk.rotation.z = SB.rand(-0.06, 0.06);
      trunk.castShadow = true;
      group.add(trunk);
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.4, 6), leafMat);
      canopy.position.set(px, 4.5, pz);
      group.add(canopy);
      SB.city.palms.push(trunk);
    }

    // --- Neon (8 papan, di fasad Deco Row / Downtown) ---
    const neonNames = ['TACOS', 'HOTEL PALMA', 'BAR NEON', 'PIZZA', 'CASINO', 'MOTEL', 'SURF SHOP', 'CINEMA'];
    const neonColors = [0xff5da2, 0x5ad8ff, 0xffd75a, 0x7dff8a, 0xff7a5a, 0xc95aff, 0x5affd8, 0xff9a5a];
    const neonHosts = SB.city.buildings.filter((b) => (b.district === 'Deco Row' || b.district === 'Downtown') && b.h >= 8);
    for (let i = 0; i < 8 && i < neonHosts.length; i++) {
      const b = neonHosts[Math.floor(SB.rng() * neonHosts.length)];
      const c = document.createElement('canvas');
      c.width = 512; c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#14101c'; g.fillRect(0, 0, 512, 128);
      g.fillStyle = '#' + neonColors[i].toString(16).padStart(6, '0');
      g.font = 'bold 64px Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(neonNames[i], 256, 66);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const signMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 1.5),
        new THREE.MeshBasicMaterial({ map: tex })
      );
      signMesh.position.set(b.x, b.h * 0.7, b.z + b.d / 2 + 0.15);
      group.add(signMesh);
      SB.city.neonSigns.push(signMesh);
    }

    // --- Props: hydrant, lampu jalan, stall, bangku, tong ---
    const hydMat = new THREE.MeshLambertMaterial({ color: 0xc0392b });
    for (let i = 0; i < 12; i++) {
      const hx = SB.rand(-130, 205), hz = SB.rand(-80, 140);
      const hyd = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.8, 8), hydMat);
      hyd.position.set(hx, 0.4, hz);
      group.add(hyd);
      SB.city.props.push(hyd);
    }
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (let i = 0; i < 20; i++) {
      const lx = SB.rand(-130, 205), lz = SB.pick(ROAD_Z) + SB.pick([-8.5, 8.5]);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5, 6), poleMat);
      pole.position.set(lx, 2.5, lz);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), lampMat);
      lamp.position.set(lx, 5.1, lz);
      group.add(lamp);
      SB.city.props.push(pole);
    }
    const stallColors = [0xe86a92, 0x7fb3d5, 0xf2a65a];
    const stallSpots = [[-6, 44], [6, 44], [-8, 34], [10, 30], [-40, 24], [30, 150]];
    for (let i = 0; i < stallSpots.length; i++) {
      const sx = stallSpots[i][0], sz = stallSpots[i][1];
      const stall = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.2, 2), new THREE.MeshLambertMaterial({ color: stallColors[i % 3] }));
      stall.position.set(sx, 1.1, sz);
      stall.castShadow = true;
      group.add(stall);
      const awn = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.15, 2.4), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
      awn.position.set(sx, 2.3, sz);
      group.add(awn);
      SB.city.props.push(stall);
    }
    for (let i = 0; i < 10; i++) {
      const bx = SB.rand(-130, 205), bz = SB.pick(ROAD_Z) + SB.pick([-8, 8]);
      const bench = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.6), new THREE.MeshLambertMaterial({ color: 0x6b4f2a }));
      bench.position.set(bx, 0.45, bz);
      group.add(bench);
      SB.city.props.push(bench);
    }

    // --- Peds (20 pejalan kaki) ---
    const shirtColors = [0xe86a92, 0x7fb3d5, 0xf2a65a, 0x9fd8a0, 0xc95aff, 0x5ad8ff, 0xf2f2f2, 0x3a3f46];
    const skinColors = [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf2c9a0];
    for (let i = 0; i < 20; i++) {
      const road = SB.city.roads[Math.floor(SB.rng() * SB.city.roads.length)];
      const side = SB.pick([-1, 1]);
      const offset = ROAD_W / 2 + 1.5;
      const t = SB.rand(0, 1);
      const dir = SB.pick([-1, 1]);
      const speed = SB.rand(0.8, 1.6);
      const ped = new THREE.Group();
      const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.25), new THREE.MeshLambertMaterial({ color: SB.pick(shirtColors) }));
      shirt.position.y = 1.05;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), new THREE.MeshLambertMaterial({ color: SB.pick(skinColors) }));
      head.position.y = 1.55;
      const legMat = new THREE.MeshLambertMaterial({ color: 0x2b2b33 });
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), legMat);
      legL.position.set(-0.12, 0.35, 0);
      const legR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), legMat);
      legR.position.set(0.12, 0.35, 0);
      ped.add(shirt); ped.add(head); ped.add(legL); ped.add(legR);
      ped.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      group.add(ped);
      SB.city.peds.push({ mesh: ped, legL, legR, road, side, offset, t, dir, speed });
    }
    SB.city._placePeds();
    SB.registerUpdate(SB.city.updatePeds);
  },

  // Posisi ped dari road + t (dipakai build + update).
  _placePeds() {
    for (const p of SB.city.peds) {
      const r = p.road;
      const along = r.from + p.t * (r.to - r.from);
      if (r.axis === 'x') {
        p.mesh.position.set(along, 0, r.at + p.side * p.offset);
        p.mesh.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        p.mesh.position.set(r.at + p.side * p.offset, 0, along);
        p.mesh.rotation.y = p.dir > 0 ? 0 : Math.PI;
      }
    }
  },

  // Gerak 20 peds di trotoar; balik arah di ujung jalan (bukan keluar kota).
  updatePeds(dt) {
    for (const p of SB.city.peds) {
      const len = p.road.to - p.road.from;
      p.t += (p.dir * p.speed * dt) / len;
      if (p.t > 1) { p.t = 1; p.dir = -1; }
      if (p.t < 0) { p.t = 0; p.dir = 1; }
      const swing = Math.sin(SB.state.simTime * 6 * p.speed) * 0.4;
      p.legL.rotation.x = swing;
      p.legR.rotation.x = -swing;
    }
    SB.city._placePeds();
  },
};

export { SB };
