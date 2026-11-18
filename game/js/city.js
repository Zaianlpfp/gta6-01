// Solmar Bay — city.js
// One job: build the 3D city — ground, roads, towers, shops, beach, marina,
// palms, neon, streetlights — and record every solid building as a collider.
'use strict';

const City = {
  colliders: [], signs: [], coinMeshes: [], lamps: [], neonMats: [],
  towerTex: null, roadTex: null,

  build(scene) {
    const rnd = mulberry32(1337);
    this.makeTextures(rnd);
    this.ground(scene);
    this.roads(scene);
    this.downtown(scene, rnd);
    this.blocks(scene, rnd);
    this.landmarks(scene);
    this.beach(scene, rnd);
    this.marina(scene, rnd);
    this.park(scene, rnd);
    this.palms(scene, rnd);
    this.streetlights(scene);
    this.billboards(scene);
    this.sunCoins(scene, rnd);
    this.skyDressing(scene);
  },

  mat(color, opts) {
    return new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {}));
  },

  makeTextures(rnd) {
    // Tower facade: window grid that glows warm at night via emissive map.
    this.towerTex = makeCanvas(128, 256, (g, w, h) => {
      g.fillStyle = '#565b6b'; g.fillRect(0, 0, w, h);
      for (let y = 8; y < h - 8; y += 18) for (let x = 8; x < w - 8; x += 16) {
        g.fillStyle = rnd() < 0.5 ? '#ffd27a' : '#3d4a63';
        g.fillRect(x, y, 10, 12);
      }
    });
    this.roadTex = makeCanvas(64, 64, (g, w, h) => {
      g.fillStyle = '#464a53'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#c9a227'; g.fillRect(w / 2 - 2, 0, 4, 26);
      g.fillStyle = '#3a3d44'; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
    });
    this.roadTex.wrapS = this.roadTex.wrapT = THREE.RepeatWrapping;
  },

  box(scene, w, h, d, x, y, z, material, collide) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = h > 12; m.receiveShadow = true;
    scene.add(m);
    if (collide) this.colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
    return m;
  },

  ground(scene) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.w + 900, WORLD.h + 900),
      this.mat(0x7fae6e));
    g.rotation.x = -Math.PI / 2; g.position.set(0, -0.1, 0); g.receiveShadow = true;
    scene.add(g);
    // City slab: warm concrete under the street grid.
    const slab = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.w, WORLD.h), this.mat(0x9aa08a));
    slab.rotation.x = -Math.PI / 2; slab.position.set(0, 0, 0); slab.receiveShadow = true;
    scene.add(slab);
    // Beach sand on the west edge.
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(400, WORLD.h), this.mat(0xe8d29a));
    sand.rotation.x = -Math.PI / 2; sand.position.set(-1410, 0.05, 0); sand.receiveShadow = true;
    scene.add(sand);
    // Ocean beyond the beach.
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, WORLD.h + 900),
      new THREE.MeshLambertMaterial({ color: 0x1f7fa8, transparent: true, opacity: 0.92 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(-2050, 0.02, 0);
    scene.add(sea);
  },

  roads(scene) {
    const roadMat = new THREE.MeshLambertMaterial({ map: this.roadTex });
    for (const a of AVENUES) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, WORLD.h), roadMat);
      r.rotation.x = -Math.PI / 2; r.position.set(a, 0.08, 0); r.receiveShadow = true;
      r.material.map = this.roadTex.clone();
      r.material.map.repeat.set(1, WORLD.h / 64); r.material.map.needsUpdate = true;
      scene.add(r);
      this.walk(scene, a - ROAD_W / 2 - WALK_W / 2, 0, WALK_W, WORLD.h);
      this.walk(scene, a + ROAD_W / 2 + WALK_W / 2, 0, WALK_W, WORLD.h);
    }
    for (const s of STREETS) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.w, ROAD_W), roadMat.clone());
      r.rotation.x = -Math.PI / 2; r.position.set(0, 0.09, s); r.receiveShadow = true;
      r.material.map = this.roadTex.clone();
      r.material.map.repeat.set(WORLD.w / 64, 1); r.material.map.needsUpdate = true;
      scene.add(r);
      this.walk(scene, 0, s - ROAD_W / 2 - WALK_W / 2, WORLD.w, WALK_W);
      this.walk(scene, 0, s + ROAD_W / 2 + WALK_W / 2, WORLD.w, WALK_W);
    }
  },
  walk(scene, x, z, w, d) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, d), this.mat(0xb9b3a4));
    s.rotation.x = -Math.PI / 2; s.position.set(x, 0.06, z); s.receiveShadow = true;
    scene.add(s);
  },

  downtown(scene, rnd) {
    const towerMat = new THREE.MeshLambertMaterial({ map: this.towerTex, emissive: 0x443311, emissiveMap: this.towerTex, emissiveIntensity: 0.55 });
    const palette = [0x8a7f8d, 0x6b7f95, 0x9c8a76, 0x5d6b7a, 0xb08d6a];
    const spots = [
      [-260, -180, 60, 150], [-120, 140, 70, 190], [60, -200, 55, 130], [220, 100, 65, 170],
      [-300, 80, 50, 110], [300, -140, 58, 140], [-60, -40, 48, 100], [140, 220, 52, 120],
      [-200, 260, 46, 95], [260, -260, 44, 105], [20, 60, 40, 88], [-340, -260, 42, 92],
    ];
    for (const [x, z, w, h] of spots) {
      const m = this.box(scene, w, h, w, x, h / 2, z, towerMat, true);
      m.material = towerMat;
      // Rooftop box + antenna for silhouette.
      this.box(scene, w * 0.4, 8, w * 0.4, x, h + 4, z, this.mat(0x3a3f4a), false);
      if (rnd() < 0.6) this.box(scene, 2, 22, 2, x + w * 0.2, h + 16, z, this.mat(0xff5566), false);
      void palette; void rnd;
    }
    // Neon strip along the downtown avenues.
    const neonCols = [0xff2e88, 0x08d9d6, 0xffc300, 0x7b2ff7];
    for (let i = 0; i < 10; i++) {
      const x = pick(AVENUES.slice(2, 6), rnd), z = -280 + i * 62;
      const n = this.box(scene, 2, 10 + rnd() * 14, 26, x + 24, 12, z,
        new THREE.MeshBasicMaterial({ color: pick(neonCols, rnd) }), false);
      this.neonMats.push(n.material);
    }
  },

  blocks(scene, rnd) {
    // Every block between roads gets 1–3 low buildings with varied heights/colors.
    const palette = [0xd9a066, 0xc97b63, 0x7fae9c, 0x9db3c8, 0xe0c98f, 0xb08968, 0x8fa98f, 0xd08c60];
    const xs = [], zs = [];
    for (let i = 0; i < AVENUES.length - 1; i++) xs.push((AVENUES[i] + AVENUES[i + 1]) / 2);
    for (let i = 0; i < STREETS.length - 1; i++) zs.push((STREETS[i] + STREETS[i + 1]) / 2);
    for (const cx of xs) for (const cz of zs) {
      if (cx > -420 && cx < 420 && cz > -320 && cz < 320) continue; // downtown already built
      if (cx < -1200 || cz > 900 && cx < -400) continue; // beach / marina handled elsewhere
      const n = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const w = 60 + rnd() * 90, d = 50 + rnd() * 70, h = 14 + rnd() * 34;
        const x = cx + (rnd() - 0.5) * 180, z = cz + (rnd() - 0.5) * 110;
        if (onRoad(x, z)) continue;
        const col = pick(palette, rnd);
        this.box(scene, w, h, d, x, h / 2, z, this.mat(col), true);
        if (rnd() < 0.5) this.box(scene, w * 0.7, 3, d * 0.7, x, h + 1.5, z, this.mat(0x6b5d4f), false);
        // Shop awning on street-facing buildings.
        if (rnd() < 0.4) this.box(scene, w * 0.8, 2, 10, x, 6, z + d / 2 + 4, this.mat(pick([0xff2e63, 0x08d9d6, 0xffc300], rnd)), false);
      }
    }
  },

  landmarks(scene) {
    // Bank: white marble block + columns + gold sign.
    this.box(scene, 110, 34, 70, 120, 17, -120, this.mat(0xe8e4d8), true);
    for (let i = -2; i <= 2; i++) this.box(scene, 6, 26, 6, 120 + i * 20, 13, -120 + 38, this.mat(0xffffff), false);
    this.sign(scene, 'SOLMAR BANK', 120, 44, -120, 0xffd27a, 64);
    // Hospital: pale block + red cross box on the roof.
    this.box(scene, 120, 40, 80, 1000, 20, 180, this.mat(0xeef2f5), true);
    this.box(scene, 26, 8, 26, 1000, 44, 180, this.mat(0xd62828), false);
    this.box(scene, 8, 26, 8, 1000, 44, 180, this.mat(0xd62828), false);
    this.sign(scene, 'HOSPITAL', 1000, 52, 180, 0xff5555, 48);
    // Police HQ: dark blue block + badge sign.
    this.box(scene, 110, 30, 70, -120, 15, -520, this.mat(0x1d3557), true);
    this.sign(scene, 'SBPD', -120, 40, -520, 0x7fb3ff, 56);
    // Hotel: tall pastel block on the beach.
    this.box(scene, 90, 90, 60, -1380, 45, -300, this.mat(0xf4a7b9), true);
    this.sign(scene, 'THE PALMS', -1380, 100, -300, 0xffd27a, 52);
    // Chop shop: low shed + neon.
    this.box(scene, 120, 18, 70, -700, 9, 1020, this.mat(0x4a4e57), true);
    this.sign(scene, 'CHOP SHOP', -700, 26, 1020, 0xff2e88, 52);
    // Gun store.
    this.box(scene, 70, 16, 50, 900, 8, -620, this.mat(0x6b5d4f), true);
    this.sign(scene, 'GUN STORE', 900, 24, -620, 0xffc300, 40);
    // Respray booth.
    this.box(scene, 80, 14, 50, 260, 7, 480, this.mat(0x2e86ff), true);
    this.sign(scene, 'RESPRAY', 260, 22, 480, 0x08d9d6, 40);
    // Safehouse: small house with a porch on Palmetto Hill.
    this.box(scene, 60, 20, 46, 0, 10, -1020, this.mat(0xf4e3c2), true);
    this.box(scene, 64, 4, 50, 0, 22, -1020, this.mat(0xd62828), false);
    this.sign(scene, 'SAFEHOUSE', 0, 30, -1020, 0x7CFC00, 36);
  },

  sign(scene, text, x, y, z, color, size) {
    const tex = makeCanvas(512, 96, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.font = 'bold ' + (size || 48) + 'px Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = hexCss(color); g.shadowBlur = 22;
      g.fillStyle = hexCss(color);
      g.fillText(text, w / 2, h / 2);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(46, 9),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
    m.position.set(x, y, z + 40);
    scene.add(m);
    this.signs.push(m);
  },

  beach(scene, rnd) {
    // Umbrellas + towels along the sand.
    for (let i = 0; i < 14; i++) {
      const x = -1560 + rnd() * 260, z = -1100 + i * 165 + rnd() * 40;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 7, 6), this.mat(0x8d99ae));
      pole.position.set(x, 3.5, z); scene.add(pole);
      const top = new THREE.Mesh(new THREE.ConeGeometry(7, 3, 8),
        this.mat(pick([0xff2e63, 0xffc300, 0x08d9d6, 0xffffff], rnd)));
      top.position.set(x, 8, z); scene.add(top);
    }
    // Lifeguard tower.
    this.box(scene, 14, 16, 14, -1470, 8, -700, this.mat(0xffffff), true);
    this.box(scene, 18, 3, 18, -1470, 18, -700, this.mat(0xff2e63), false);
    // Ferris wheel silhouette on the pier (static, decorative).
    const wheel = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(34, 2, 8, 24), this.mat(0xffc300));
    wheel.add(rim);
    for (let i = 0; i < 8; i++) {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6), this.mat(pick([0xff2e63, 0x08d9d6, 0x7b2ff7], rnd)));
      const a = (i / 8) * Math.PI * 2;
      cab.position.set(Math.cos(a) * 34, Math.sin(a) * 34, 0);
      wheel.add(cab);
    }
    wheel.position.set(-1560, 46, 300);
    scene.add(wheel);
  },

  marina(scene, rnd) {
    // Wooden docks + moored boats.
    for (let i = 0; i < 5; i++) {
      const z = 700 + i * 90;
      this.box(scene, 90, 2, 10, -1330, 1, z, this.mat(0x9c6644), false);
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(22, 5, 8), this.mat(pick([0xffffff, 0xff8fa3, 0x08d9d6], rnd)));
      hull.position.y = 2; boat.add(hull);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 14, 6), this.mat(0x8d99ae));
      mast.position.y = 10; boat.add(mast);
      boat.position.set(-1290, 0, z + 20);
      scene.add(boat);
    }
    // Container stacks at Bayline Docks.
    const cols = [0xff6b35, 0x2e86ff, 0xffc300, 0x7b2ff7];
    for (let i = 0; i < 12; i++) {
      const x = 700 + (i % 4) * 120, z = 900 + Math.floor(i / 4) * 80;
      this.box(scene, 46, 12, 18, x, 6 + (i % 2) * 12, z, this.mat(pick(cols, rnd)), true);
    }
  },

  park(scene, rnd) {
    // Green square at Grieve Isle: lawn, trees, benches, fountain.
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(300, 200), this.mat(0x6fae5e));
    lawn.rotation.x = -Math.PI / 2; lawn.position.set(-800, 0.07, 300); lawn.receiveShadow = true;
    scene.add(lawn);
    for (let i = 0; i < 12; i++) {
      const x = -920 + rnd() * 240, z = 220 + rnd() * 160;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 8, 6), this.mat(0x7a5230));
      trunk.position.set(x, 4, z); scene.add(trunk);
      const top = new THREE.Mesh(new THREE.SphereGeometry(7 + rnd() * 3, 8, 6), this.mat(0x3e8e4f));
      top.position.set(x, 12, z); top.castShadow = true; scene.add(top);
    }
    const f = new THREE.Mesh(new THREE.CylinderGeometry(14, 16, 3, 16), this.mat(0x9db3c8));
    f.position.set(-800, 1.5, 300); scene.add(f);
  },

  palms(scene, rnd) {
    // Palms line the beach avenue and the marina road.
    for (let i = 0; i < 46; i++) {
      const along = i < 26;
      const x = along ? -1180 + rnd() * 20 : -800 + (i - 26) * 60;
      const z = along ? -1150 + i * 92 : 940 + rnd() * 20;
      if (onRoad(x, z)) continue;
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.8, 22, 6), this.mat(0x9c6644));
      trunk.position.y = 11; trunk.rotation.z = (rnd() - 0.5) * 0.16; trunk.castShadow = true;
      g.add(trunk);
      const fronds = new THREE.Mesh(new THREE.ConeGeometry(11, 7, 6), this.mat(0x2f9e44));
      fronds.position.y = 24; fronds.scale.y = 0.55; fronds.castShadow = true;
      g.add(fronds);
      g.position.set(x, 0, z);
      scene.add(g);
    }
  },

  streetlights(scene) {
    for (const a of AVENUES) for (const s of STREETS) {
      if ((AVENUES.indexOf(a) + STREETS.indexOf(s)) % 2 !== 0) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 16, 6), this.mat(0x3a3f4a));
      pole.position.set(a + 22, 8, s + 22); scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
      lamp.position.set(a + 22, 16.4, s + 22); scene.add(lamp);
      this.lamps.push(lamp);
    }
  },

  billboards(scene) {
    const ads = [
      { t: 'SOLMAR BAY', c: 0xff2e88, x: -400, z: -320 },
      { t: 'WAVE 88.1', c: 0x08d9d6, x: 400, z: 320 },
      { t: 'CORAL COLA', c: 0xffc300, x: 0, z: -320 },
      { t: 'NEON PALM', c: 0x7b2ff7, x: -400, z: 320 },
    ];
    for (const a of ads) {
      const tex = makeCanvas(512, 256, (g, w, h) => {
        g.fillStyle = '#14101f'; g.fillRect(0, 0, w, h);
        g.strokeStyle = hexCss(a.c); g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
        g.font = 'bold 64px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.shadowColor = hexCss(a.c); g.shadowBlur = 26; g.fillStyle = hexCss(a.c);
        g.fillText(a.t, w / 2, h / 2);
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(60, 30),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
      m.position.set(a.x, 42, a.z);
      scene.add(m);
      this.box(scene, 3, 42, 3, a.x - 24, 21, a.z, this.mat(0x3a3f4a), false);
      this.box(scene, 3, 42, 3, a.x + 24, 21, a.z, this.mat(0x3a3f4a), false);
    }
  },

  sunCoins(scene, rnd) {
    // 20 golden sun coins hidden around the city — $50 each.
    const geo = new THREE.CylinderGeometry(3, 3, 0.7, 20);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffc300 });
    const spots = [];
    for (let i = 0; i < SUN_COINS; i++) {
      let x, z, tries = 0;
      do { x = -1500 + rnd() * 3000; z = -1100 + rnd() * 2200; tries++; }
      while ((onRoad(x, z) || this.insideCollider(x, z)) && tries < 20);
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = Math.PI / 2; m.position.set(x, 4, z);
      scene.add(m);
      spots.push({ x, z, mesh: m, taken: false });
    }
    this.coinMeshes = spots;
  },

  insideCollider(x, z) {
    return this.colliders.some(c => x > c.x0 - 2 && x < c.x1 + 2 && z > c.z0 - 2 && z < c.z1 + 2);
  },

  // Circle (player/car radius r) vs building AABBs: push out, return corrected pos.
  collideCircle(x, z, r) {
    for (const c of this.colliders) {
      const nx = clamp(x, c.x0, c.x1), nz = clamp(z, c.z0, c.z1);
      const dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r; z = nz + (dz / d) * r;
        } else {
          // Inside the box: push out along the smallest penetration axis.
          const pl = Math.min(x - c.x0, c.x1 - x, z - c.z0, c.z1 - z);
          if (pl === x - c.x0) x = c.x0 - r; else if (pl === c.x1 - x) x = c.x1 + r;
          else if (pl === z - c.z0) z = c.z0 - r; else z = c.z1 + r;
        }
      }
    }
    x = clamp(x, -WORLD.hx + 8, WORLD.hx - 8);
    z = clamp(z, -WORLD.hz + 8, WORLD.hz - 8);
    return { x, z };
  },

  skyDressing(scene) {
    // Low sun sphere + a few clouds (flat warm blobs) for the sunset sky.
    // Basic materials, unfogged, so they stay bright against the sky.
    const sun = new THREE.Mesh(new THREE.SphereGeometry(46, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }));
    sun.position.set(-900, 260, -900);
    scene.add(sun);
    this.sunMesh = sun;
    for (let i = 0; i < 10; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(30 + i * 4, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffd9c2, transparent: true, opacity: 0.85, fog: false }));
      c.scale.y = 0.35;
      c.position.set(-1200 + i * 280, 260 + (i % 3) * 40, -1000 + (i % 2) * 300);
      scene.add(c);
    }
  },

  // Night mode: neon + lamps + lit windows read brighter, sky darkens.
  setNight(f) {
    for (const m of this.neonMats) m.color.setScalar ? null : null;
    for (const l of this.lamps) l.material.color.setHex(f > 0.5 ? 0xffe9a8 : 0x8a8a7a);
  },
};
