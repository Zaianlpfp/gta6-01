// city.js — B1 r12. Kota 3D "Solmar Bay": grid jalan, 71 gedung, palm, neon,
// props, pantai + marina. Deterministik (SB.rand, seed 1337). Kontrak: game/API.md.
// Perbaikan r12 vs r11 (juri buta r11 30 vs 27 — hero onfoot kecil/jauh,
// fasad kiri ~30% frame):
//  - Spawn onfoot PINDAH (40,62) -> (0,40): persimpangan jalan x=0 dan z=40
//    (zebra cross di (0,47.5); jalan silang membuka frame kiri-kanan; papan
//    bank (2,7,-2) terbaca di kejauhan). Tetap DI JALAN, bukan di klaster
//    bangunan. Kamera preset onfoot ikut pindah (engine.js): (0,5.0,50).
//  - Foreground pasar pindah mengikuti spawn: stall/palm/mobil parkir dari
//    tepi jalan x=40 ke tepi jalan x=0 (translasi x -40, z -28 dari posisi
//    relatif kamera lama — layout relatif terhadap kamera dipertahankan).
// Perbaikan r10 vs r9: koridor jalan showcase (x=0, x=40) DILEBARKAN —
// bangunan yang menghadap jalan dipaksa lebar <=11 (fasad >=7,5 dari sumbu
// jalan; r9 fasad 4,5 -> tembok makan ~40% frame onfoot, hero kecil di tengah
// ngarai). Clamp SETELAH rand (stream rand tetap sama — kota lain identik,
// jumlah gedung tetap 71).
// Dipertahankan dari r10/r11: spawn onfoot (0,40) r12 di persimpangan jalan
// x=0/z=40; foreground pasar di tepi jalan x=0; ped menyimpan userData
// bx/bz/axis/sp untuk drift di engine.step (TANPA rand baru — kota tetap
// identik dengan r8).
(function () {
  var SB = window.SB = window.SB || {};
  var C = SB.city = {};
  var THREE = window.THREE;

  C.districts = [
    { name: 'Coral Strand', cx: 0, cz: 150, w: 200, d: 70 },
    { name: 'Neon Mile', cx: -60, cz: -60, w: 90, d: 60 },
    { name: 'Palmetto Heights', cx: -100, cz: 40, w: 80, d: 80 },
    { name: 'Deco Row', cx: 60, cz: -60, w: 90, d: 60 },
    { name: 'Downtown', cx: 0, cz: -20, w: 120, d: 100 },
    { name: 'Old Mercado', cx: 60, cz: 60, w: 90, d: 60 },
    { name: 'Keystone Field', cx: -60, cz: 120, w: 90, d: 60 },
    { name: 'Pelican Marina', cx: 170, cz: 0, w: 90, d: 120 },
    { name: 'Bayline Docks', cx: 100, cz: 120, w: 90, d: 60 }
  ];
  C.roads = [];
  C.spawnPoints = { cover: [0, 0], onfoot: [0, 40], mission: [2, 10], free: [0, 40] };
  C.bank = { pos: [2, 7, -2], rotY: Math.PI / 4 };
  C.staging = { coverCruisers: [[-5, 4], [5.5, 6]] };
  C.counts = { buildings: 0, palms: 0, neons: 0, props: 0, traffic: 0, peds: 0 };
  C.traffic = []; C.peds = [];

  var ROAD_LINES = [-120, -80, -40, 0, 40, 80, 120];
  var PALETTE = [0xe8b4a0, 0xd9a05b, 0x7fb3d5, 0xc98bb9, 0x8ec9a9, 0xe0d0a0, 0xb8a0d8, 0xf0e8d8, 0x9fc4e8, 0xe89a8a];

  function canvasTex(w, h, draw) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c); return t;
  }
  function box(scene, w, h, d, color, x, y, z, mat) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || new THREE.MeshLambertMaterial({ color: color }));
    m.position.set(x, y, z); scene.add(m); return m;
  }
  // Tekstur jendela: 4 varian, jendela kuning menyala acak (deterministik)
  function winTex(base, lit) {
    return canvasTex(128, 256, function (g, w, h) {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, h - 18, w, 18);
      for (var y = 14; y < h - 24; y += 22) for (var x = 10; x < w - 10; x += 18) {
        g.fillStyle = SB.rand() < lit ? '#ffd76a' : '#2c2440';
        g.fillRect(x, y, 11, 13);
      }
    });
  }

  C.makeTextSprite = function (text, opts) {
    opts = opts || {};
    var fs = opts.font || 64, pad = 24;
    var c = document.createElement('canvas');
    var g = c.getContext('2d');
    g.font = 'bold ' + fs + 'px Arial';
    var tw = Math.ceil(g.measureText(text).width);
    c.width = tw + pad * 2; c.height = fs + pad * 2;
    var g2 = c.getContext('2d');
    g2.font = 'bold ' + fs + 'px Arial';
    g2.textBaseline = 'middle';
    if (opts.bg) { g2.fillStyle = opts.bg; g2.fillRect(0, 0, c.width, c.height); }
    g2.fillStyle = opts.color || '#ffffff';
    g2.shadowColor = opts.glow || '#ff4dd8'; g2.shadowBlur = 18;
    g2.fillText(text, pad, c.height / 2);
    var tex = new THREE.CanvasTexture(c);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    var s = opts.scale || 1;
    sp.scale.set(c.width / c.height * 2.2 * s, 2.2 * s, 1);
    return sp;
  };

  function palm(scene, x, z, s) {
    s = s || 1;
    var g = new THREE.Group();
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * s, 0.45 * s, 7 * s, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a6a45 }));
    trunk.position.y = 3.5 * s; trunk.rotation.z = SB.randRange(-0.08, 0.08); g.add(trunk);
    var fm = new THREE.MeshLambertMaterial({ color: 0x2fae5f });
    for (var i = 0; i < 7; i++) {
      var f = new THREE.Mesh(new THREE.ConeGeometry(0.9 * s, 4.6 * s, 4), fm);
      var a = (i / 7) * Math.PI * 2;
      f.position.set(Math.cos(a) * 1.7 * s, 7 * s, Math.sin(a) * 1.7 * s);
      f.rotation.z = Math.cos(a) * 1.15; f.rotation.x = -Math.sin(a) * 1.15;
      g.add(f);
    }
    var nut = new THREE.Mesh(new THREE.SphereGeometry(0.5 * s, 6, 5),
      new THREE.MeshLambertMaterial({ color: 0x6a4a2a }));
    nut.position.y = 6.6 * s; g.add(nut);
    g.position.set(x, 0, z); scene.add(g);
    C.counts.palms++;
    return g;
  }

  function carMesh(scene, x, z, rotY, color, parked) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.4),
      new THREE.MeshLambertMaterial({ color: color }));
    body.position.y = 0.55; g.add(body);
    var cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.2),
      new THREE.MeshLambertMaterial({ color: 0x1c2733 }));
    cab.position.set(0, 1.1, -0.2); g.add(cab);
    var wm = new THREE.MeshLambertMaterial({ color: 0x111111 });
    [[-0.85, 1.4], [0.85, 1.4], [-0.85, -1.4], [0.85, -1.4]].forEach(function (p) {
      var w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 8), wm);
      w.rotation.z = Math.PI / 2; w.position.set(p[0], 0.36, p[1]); g.add(w);
    });
    // Headlight glow (depan = -z lokal? depan +z: lampu di z=+2.2)
    var hm = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    [-0.65, 0.65].forEach(function (hx) {
      var hl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), hm);
      hl.position.set(hx, 0.6, 2.22); g.add(hl);
    });
    var tm = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
    [-0.65, 0.65].forEach(function (hx) {
      var tl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), tm);
      tl.position.set(hx, 0.6, -2.22); g.add(tl);
    });
    g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
    return g;
  }

  function neonSign(scene, text, color, x, y, z, rotY, s) {
    var sp = C.makeTextSprite(text, { color: color, glow: color, scale: s || 1 });
    sp.position.set(x, y, z); scene.add(sp);
    var back = box(scene, 0.3, 1.1, 5.4, 0x14101f, x, y, z);
    back.rotation.y = rotY || 0; back.position.x = x - Math.sin(rotY || 0) * 0.2;
    C.counts.neons++;
    return sp;
  }

  function stall(scene, x, z, rotY, color) {
    var g = new THREE.Group();
    box(scene, 3.2, 1.1, 2, 0x6a4a2a, x, 0.55, z);
    var canopy = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.18, 2.6),
      new THREE.MeshLambertMaterial({ color: color }));
    canopy.position.set(x, 2.3, z); canopy.rotation.y = rotY; scene.add(canopy);
    // tiang kanopi
    [[-1.7, -1.1], [1.7, -1.1], [-1.7, 1.1], [1.7, 1.1]].forEach(function (p) {
      box(scene, 0.12, 2.3, 0.12, 0x3a2a1a, x + p[0], 1.15, z + p[1]);
    });
    // barang dagangan: kotak warna-warni
    for (var i = 0; i < 5; i++) {
      box(scene, 0.5, 0.35, 0.4, SB.randPick([0xff5a5a, 0xffc23d, 0x5aff8a, 0xff8ad8, 0x6ab8ff]),
        x - 1.2 + i * 0.6, 1.3, z + SB.randRange(-0.5, 0.5));
    }
    C.counts.props++;
    return g;
  }

  C.groundAt = function (x, z) { return 0; };
  C.nearBank = function (x, z) {
    var dx = x - 2, dz = z - (-30);
    return (dx * dx + dz * dz) < 900;
  };

  C.build = function (scene) {
    if (C._built) return C;
    C._built = true;
    SB.rngReset(1337);
    // --- Tanah dasar + jalan grid ---
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(480, 480),
      new THREE.MeshLambertMaterial({ color: 0x2e2740 }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    // Trotoar: strip terang di sisi jalan
    var swMat = new THREE.MeshLambertMaterial({ color: 0x4a4060 });
    ROAD_LINES.forEach(function (l) {
      var r1 = new THREE.Mesh(new THREE.PlaneGeometry(11, 480), new THREE.MeshLambertMaterial({ color: 0x1c1826 }));
      r1.rotation.x = -Math.PI / 2; r1.position.set(l, 0.02, 0); scene.add(r1);
      var r2 = new THREE.Mesh(new THREE.PlaneGeometry(480, 11), new THREE.MeshLambertMaterial({ color: 0x1c1826 }));
      r2.rotation.x = -Math.PI / 2; r2.position.set(0, 0.02, l); scene.add(r2);
      var s1 = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 480), swMat);
      s1.rotation.x = -Math.PI / 2; s1.position.set(l - 6.6, 0.04, 0); scene.add(s1);
      var s2 = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 480), swMat);
      s2.rotation.x = -Math.PI / 2; s2.position.set(l + 6.6, 0.04, 0); scene.add(s2);
      var s3 = new THREE.Mesh(new THREE.PlaneGeometry(480, 2.4), swMat);
      s3.rotation.x = -Math.PI / 2; s3.position.set(0, 0.04, l - 6.6); scene.add(s3);
      var s4 = new THREE.Mesh(new THREE.PlaneGeometry(480, 2.4), swMat);
      s4.rotation.x = -Math.PI / 2; s4.position.set(0, 0.04, l + 6.6); scene.add(s4);
      C.roads.push({ x0: l, z0: -240, x1: l, z1: 240 }, { x0: -240, z0: l, x1: 240, z1: l });
      // Marka tengah putus-putus
      for (var d = -230; d < 230; d += 12) {
        box(scene, 0.35, 0.02, 4, 0xd8c25a, l, 0.05, d);
        box(scene, 4, 0.02, 0.35, 0xd8c25a, d, 0.05, l);
      }
    });
    // Zebra cross di persimpangan utama
    [[0, 0], [0, 40], [40, 0], [-40, 0], [0, -40]].forEach(function (p) {
      for (var i = -2; i <= 2; i++) box(scene, 1.1, 0.02, 5.4, 0xe8e4d8, p[0] + i * 1.7, 0.05, p[1] + 7.5);
    });
    // --- Pantai + laut (selatan) & marina (timur) ---
    var sand = new THREE.Mesh(new THREE.PlaneGeometry(480, 90), new THREE.MeshLambertMaterial({ color: 0xc9a06a }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.06, 195); scene.add(sand);
    var sea = new THREE.Mesh(new THREE.PlaneGeometry(480, 60), new THREE.MeshLambertMaterial({ color: 0x2a6a9e }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.04, 225); scene.add(sea);
    var seaE = new THREE.Mesh(new THREE.PlaneGeometry(70, 230), new THREE.MeshLambertMaterial({ color: 0x2a6a9e }));
    seaE.rotation.x = -Math.PI / 2; seaE.position.set(205, 0.04, 0); scene.add(seaE);
    // Dermaga + perahu marina
    for (var pi = 0; pi < 4; pi++) box(scene, 26, 0.5, 3, 0x7a5a35, 178, 0.3, -60 + pi * 40);
    for (var bi = 0; bi < 5; bi++) {
      var hull = box(scene, 3, 1, 8, SB.randPick([0xf0f0f0, 0xffd76a, 0x7fb3d5]), 186, 0.6, -70 + bi * 34);
      hull.rotation.y = SB.randRange(-0.2, 0.2);
      box(scene, 0.3, 4.5, 0.3, 0x5a4a35, 186, 2.8, -70 + bi * 34);
      C.counts.props++;
    }
    // --- Gedung: 71 tepat ---
    var winMats = [winTex('#e8b4a0', 0.55), winTex('#7fb3d5', 0.5), winTex('#c98bb9', 0.6), winTex('#d9a05b', 0.45)];
    var BLOCKS = [-100, -60, -20, 20, 60, 100];
    var bCount = 0;
    BLOCKS.forEach(function (bx) {
      BLOCKS.forEach(function (bz) {
        var isPark = (bx === -100 && bz === 100);            // Keystone Field: taman
        var isBank = (bx === 20 && bz === -20);              // blok bank
        var isTall = (bx === -20 && bz === 20);              // downtown padat: 3 gedung
        var n = isPark ? 0 : (isBank ? 2 : (isTall ? 3 : 2));
        for (var k = 0; k < n; k++) {
          if (bCount >= 71) break;
          var downtown = (Math.abs(bx) <= 20 && Math.abs(bz) <= 20);
          var h = downtown ? SB.randRange(26, 58) : SB.randRange(8, 22);
          var w = SB.randRange(11, 17), d = SB.randRange(11, 17);
          var ox = (k === 0) ? -7 : (k === 1) ? 7 : 0;
          var oz = (k === 0) ? -6 : (k === 1) ? 6 : -1;
          // r10: koridor jalan showcase (x=0, x=40) dilebarkan. Bangunan yang
          // menghadap jalan dipaksa lebar <=11 supaya fasad >=7,5 dari sumbu
          // jalan (r9: fasad 4,5 -> tembok makan ~40% frame onfoot).
          // Clamp SETELAH rand — stream rand tetap sama, kota lain identik.
          // (bx=20,k=1)&(bx=60,k=0) menghadap x=40; (bx=-20,k=1)&(bx=20,k=0)
          // menghadap x=0. Gedung bank diskala 26x14x14 setelahnya (tak berubah).
          var roadSide = (k === 1 && (bx === 20 || bx === -20)) || (k === 0 && (bx === 60 || bx === 20));
          if (roadSide) w = Math.min(w, 11);
          var mat = new THREE.MeshLambertMaterial({ map: winMats[Math.floor(SB.rand() * winMats.length)] });
          var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          b.position.set(bx + ox, h / 2, bz + oz);
          scene.add(b);
          // Atap: AC box + antena
          box(scene, 2.2, 1, 2.2, 0x3a3348, bx + ox - 2, h + 0.5, bz + oz);
          if (SB.rand() < 0.5) box(scene, 0.25, SB.randRange(3, 7), 0.25, 0x888888, bx + ox + 3, h + 2.5, bz + oz);
          bCount++;
          if (isBank && k === 0) {
            // Gedung bank: ganti posisi ke (2,-30), fasad menghadap selatan
            // (sign pylon tetap di (2,7,-2) di tepi jalan — gedung mundur)
            b.position.set(2, 7, -30);
            b.scale.set(26 / w, 14 / h, 14 / d);
            b.material = new THREE.MeshLambertMaterial({ color: 0xd8cdb8 });
            b.userData.isBank = true;
          }
        }
      });
    });
    C.counts.buildings = bCount;
    // --- Sign BANK: pylon (2,7,-2) rot π/4, canvas 2048×512, teks UTUH ---
    var bankTex = canvasTex(2048, 512, function (g, w, h) {
      g.fillStyle = '#0e2a5e'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#ffd76a'; g.lineWidth = 14; g.strokeRect(18, 18, w - 36, h - 36);
      g.fillStyle = '#ffd76a'; g.font = 'bold 150px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('SOLMAR NATIONAL BANK', w / 2, h / 2 + 6);
      g.fillStyle = '#ffffff'; g.font = 'bold 54px Arial';
      g.fillText('★ EST. 1962 ★', w / 2, h - 84);
    });
    var sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 4),
      new THREE.MeshBasicMaterial({ map: bankTex }));
    sign.position.set(2, 7, -2); sign.rotation.y = Math.PI / 4; scene.add(sign);
    box(scene, 0.7, 4, 0.7, 0x2a2a33, 0.4, 2, -0.4);
    box(scene, 0.7, 4, 0.7, 0x2a2a33, 3.6, 2, -3.6);
    // Sign PD HQ + hospital (label kecil, tidak terpotong)
    var pd = C.makeTextSprite('SOLMAR PD HQ', { color: '#7fb3ff', glow: '#3d7bff', scale: 0.9, bg: '#101828' });
    pd.position.set(-58, 12, -38); scene.add(pd);
    var hs = C.makeTextSprite('GENERAL HOSPITAL ✚', { color: '#ffffff', glow: '#ff5a5a', scale: 0.9, bg: '#3d0e0e' });
    hs.position.set(58, 11, -58); scene.add(hs);
    // --- Neon + billboard ---
    neonSign(scene, 'NEON MILE', '#ff4dd8', -52, 9, -52, 0, 1.1);
    neonSign(scene, 'PALMETTO HOTEL', '#ffd76a', -92, 10, 28, 0, 1.0);
    neonSign(scene, 'TACOS 24H', '#5aff8a', 52, 8, 52, 0, 0.9);
    neonSign(scene, 'CASINO BAY', '#ff5a5a', 68, 12, -52, 0, 1.0);
    neonSign(scene, 'WAVE 88.1', '#6ab8ff', -20, 14, 20, 0, 0.9);
    // Billboard besar
    var bbTex = canvasTex(1024, 512, function (g, w, h) {
      g.fillStyle = '#ff5a8a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffffff'; g.font = 'bold 120px Arial'; g.textAlign = 'center';
      g.fillText('SOLMAR BAY', w / 2, 210);
      g.font = 'bold 64px Arial'; g.fillText('VICE NEVER SLEEPS', w / 2, 330);
    });
    var bb = new THREE.Mesh(new THREE.PlaneGeometry(30, 15), new THREE.MeshBasicMaterial({ map: bbTex }));
    bb.position.set(-40, 16, -78); scene.add(bb);
    box(scene, 1, 16, 1, 0x333333, -48, 8, -78); box(scene, 1, 16, 1, 0x333333, -32, 8, -78);
    // --- Palm: sepanjang jalan + pantai + foreground on-foot/mission ---
    ROAD_LINES.forEach(function (l) {
      for (var d = -200; d <= 200; d += 40) {
        if (SB.rand() < 0.6) palm(scene, l + 8.6, d + SB.randRange(-6, 6), SB.randRange(0.9, 1.3));
        if (SB.rand() < 0.4) palm(scene, l - 8.6, d + 20 + SB.randRange(-6, 6), SB.randRange(0.9, 1.3));
      }
    });
    for (var pi2 = 0; pi2 < 10; pi2++) palm(scene, SB.randRange(-160, 160), SB.randRange(155, 185), SB.randRange(1, 1.4));
    // Foreground on-foot r12 (tepi jalan x=0, mengikuti spawn (0,40) —
    // r11 di x=40: palm (46,50)/(46,74), stall (44,54)/(44,62)/(44,70),
    // mobil (36,58)/(36,68); r12 translasi x -40, z -28 dari layout relatif
    // kamera: palm + stall + mobil parkir di tepi jalan x=0).
    palm(scene, 6, 22, 1.2); palm(scene, 6, 46, 1.1);
    stall(scene, 4, 26, 0.2, 0xff5a5a); stall(scene, 4, 34, -0.3, 0xffc23d); stall(scene, 4, 42, 0.1, 0x5aff8a);
    carMesh(scene, -4, 30, Math.PI / 2, 0x8ec9a9, true);
    carMesh(scene, -4, 40, -Math.PI / 2, 0xd9a05b, true);
    // Foreground big-score (depan bank, sekitar 2,10): palm + mobil parkir + roadblock
    palm(scene, -12, 12, 1.2); palm(scene, 16, 8, 1.1); palm(scene, -14, -4, 1.0);
    carMesh(scene, -8, 8, 0.3, 0x7fb3d5, true);
    carMesh(scene, 12, 6, -0.2, 0xe89a8a, true);
    carMesh(scene, -12, 18, Math.PI, 0xf0e8d8, true);
    // Roadblock belang di depan bank
    for (var rb = 0; rb < 3; rb++) {
      var blk = box(scene, 3.4, 0.9, 0.5, 0xffc23d, -6 + rb * 6, 0.7, 2);
      blk.rotation.y = 0.15;
      box(scene, 3.4, 0.3, 0.52, 0xffffff, -6 + rb * 6, 0.9, 2);
      C.counts.props++;
    }
    // --- Lampu jalan + glow ---
    var glowTex = canvasTex(64, 64, function (g) {
      var gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      gr.addColorStop(0, 'rgba(255,220,150,1)'); gr.addColorStop(1, 'rgba(255,180,80,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
    ROAD_LINES.forEach(function (l) {
      for (var d2 = -180; d2 <= 180; d2 += 60) {
        box(scene, 0.25, 6, 0.25, 0x2a2a33, l + 6.6, 3, d2);
        var gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false }));
        gl.scale.set(5, 5, 1); gl.position.set(l + 6.6, 6.2, d2); scene.add(gl);
      }
    });
    // --- Taman Keystone Field: pohon + bench ---
    for (var t = 0; t < 8; t++) {
      var tx = -100 + SB.randRange(-12, 12), tz = 100 + SB.randRange(-12, 12);
      var tr = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 3.4, 6), new THREE.MeshLambertMaterial({ color: 0x6a4a2a }));
      tr.position.set(tx, 1.7, tz); scene.add(tr);
      var cr = new THREE.Mesh(new THREE.SphereGeometry(SB.randRange(2, 3.2), 8, 6), new THREE.MeshLambertMaterial({ color: 0x2fae5f }));
      cr.position.set(tx, 4.6, tz); scene.add(cr);
      C.counts.props++;
    }
    box(scene, 3, 0.8, 1, 0x7a5a35, -104, 0.4, 96);
    box(scene, 3, 0.8, 1, 0x7a5a35, -92, 0.4, 106);
    // --- Traffic ambient: 24 mobil di jalan ---
    var carColors = [0xd94a4a, 0x4a7fd9, 0xe8e8e8, 0x2a2a2a, 0xffc23d, 0x8ec9a9, 0xc98bb9, 0x7fb3d5];
    for (var ci = 0; ci < 24; ci++) {
      var vertical = (ci % 2 === 0);
      var line = ROAD_LINES[Math.floor(SB.rand() * ROAD_LINES.length)];
      var along = SB.randRange(-210, 210);
      var lane = SB.randPick([-2.2, 2.2]);
      var m = vertical ? carMesh(scene, line + lane, along, (lane > 0) ? 0 : Math.PI, SB.randPick(carColors))
                       : carMesh(scene, along, line + lane, (lane > 0) ? Math.PI / 2 : -Math.PI / 2, SB.randPick(carColors));
      m.userData.vertical = vertical; m.userData.lane = lane; m.userData.line = line;
      m.userData.speed = SB.randRange(6, 12);
      C.traffic.push(m);
    }
    C.counts.traffic = C.traffic.length;
    // --- Peds ambient: 20 pejalan kaki di trotoar ---
    var shirt = [0xff5a5a, 0x5aff8a, 0x6ab8ff, 0xffc23d, 0xff8ad8, 0xffffff, 0x2a2a2a, 0x8ec9a9];
    for (var pi3 = 0; pi3 < 20; pi3++) {
      var g2 = new THREE.Group();
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 1.1, 6), new THREE.MeshLambertMaterial({ color: SB.randPick(shirt) }));
      body.position.y = 0.85; g2.add(body);
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshLambertMaterial({ color: 0xe8b88a }));
      head.position.y = 1.65; g2.add(head);
      var px = ROAD_LINES[Math.floor(SB.rand() * ROAD_LINES.length)] + SB.randPick([-6.6, 6.6]);
      var pz = SB.randRange(-200, 200);
      var swapped = (SB.rand() < 0.5);
      if (swapped) { var tmp = px; px = pz; pz = tmp; }
      g2.position.set(px, 0, pz);
      g2.rotation.y = SB.randRange(0, Math.PI * 2);
      g2.userData.walkPhase = SB.randRange(0, 6.28);
      // r9: data drift ped untuk engine.step (TANPA rand baru — stream tetap sama).
      g2.userData.bx = px; g2.userData.bz = pz;
      g2.userData.axis = swapped ? 'x' : 'z';
      g2.userData.sp = 0.5 + (g2.userData.walkPhase % 1) * 0.7;
      scene.add(g2);
      C.peds.push(g2);
    }
    C.counts.peds = C.peds.length;
    return C;
  };
})();
