// city.js — B1 (r5). Kota 3D "Solmar Bay": 9 distrik, 66 bangunan, 32 neon,
// pantai/laut barat, langit sunset/malam, traffic + peds, heli GULL-1 detail,
// palm, billboard, lampu jalan, market stalls, mobil parkir, roadblock.
// Semua posisi dari SB.engine.rng(seed tetap) — deterministik. Kontrak: API.md.
(function () {
  var SB = window.SB = window.SB || {};
  var E = SB.engine;
  var C = SB.city = {};
  C.followHero = true; // B2 police set false saat mengambil alih heli/cruiser
  C.buildings = []; C.neon = []; C.traffic = []; C.peds = []; C.stalls = [];
  C.parked = []; C.escorts = [];

  C.districts = [
    { name: 'Bayline Docks', x0: -68, z0: 90, x1: 80, z1: 120 },
    { name: 'Coral Strand', x0: -110, z0: -110, x1: -68, z1: 110 },
    { name: 'Palmetto Heights', x0: -68, z0: -110, x1: -30, z1: -40 },
    { name: 'Downtown', x0: -30, z0: -110, x1: 30, z1: -40 },
    { name: 'Pelican Marina', x0: 30, z0: -110, x1: 80, z1: -40 },
    { name: 'Neon Mile', x0: -30, z0: -40, x1: 30, z1: 40 },
    { name: 'Deco Row', x0: 30, z0: -40, x1: 80, z1: 20 },
    { name: 'Old Mercado', x0: -68, z0: 20, x1: -30, z1: 90 },
    { name: 'Keystone Field', x0: 30, z0: 40, x1: 80, z1: 90 }
  ];
  C.districtAt = function (x, z) {
    for (var i = 0; i < C.districts.length; i++) { var d = C.districts[i];
      if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d.name; }
    return x < -68 ? 'Coral Strand' : 'Neon Mile';
  };
  var AV = [-60, -30, 0, 30, 60], ST = [-90, -60, -30, 0, 30, 60, 90];
  C.roadAt = function (x, z) {
    for (var i = 0; i < AV.length; i++) if (Math.abs(x - AV[i]) < 6) return true;
    for (var j = 0; j < ST.length; j++) if (Math.abs(z - ST[j]) < 6) return true;
    return false;
  };
  C.groundY = function () { return 0; };

  // ---------- helpers ----------
  function tex(w, h, fn) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c); return t;
  }
  function mat(color, o) {
    var m = new THREE.MeshLambertMaterial({ color: color });
    if (o) for (var k in o) m[k] = o[k];
    return m;
  }
  function box(w, h, d, m, x, y, z, ry) {
    var q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    q.position.set(x, y, z); if (ry) q.rotation.y = ry;
    return q;
  }
  function plane(w, h, m, x, y, z, rx, ry) {
    var q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    q.position.set(x, y, z);
    if (rx) q.rotation.x = rx; if (ry) q.rotation.y = ry;
    return q;
  }

  // ---------- tekstur ----------
  function winTex(base, lit) {
    var t = tex(128, 256, function (g, w, h) {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      var r = E.rng(7);
      for (var y = 8; y < h - 8; y += 16) for (var x = 8; x < w - 8; x += 14) {
        g.fillStyle = r() < 0.62 ? lit : '#20242e';
        g.fillRect(x, y, 9, 11);
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  var BMAT = [];
  function bmat(i) { return BMAT[i % BMAT.length]; }

  // ---------- mobil ----------
  function makeCar(color, cruiser) {
    var g = new THREE.Group();
    var body = cruiser ? 0xf2f2f2 : color;
    g.add(box(1.9, 0.55, 4.2, mat(body), 0, 0.45, 0));
    g.add(box(1.7, 0.5, 2.2, mat(cruiser ? 0x20242a : 0x1a2430), 0, 0.95, -0.2));
    g.add(box(1.95, 0.25, 4.25, mat(0x111111), 0, 0.2, 0));
    if (cruiser) {
      g.add(box(0.5, 0.16, 0.3, new THREE.MeshBasicMaterial({ color: 0xff2a2a }), -0.45, 1.28, -0.2));
      g.add(box(0.5, 0.16, 0.3, new THREE.MeshBasicMaterial({ color: 0x2a6bff }), 0.45, 1.28, -0.2));
      g.add(box(1.92, 0.12, 0.1, new THREE.MeshBasicMaterial({ color: 0xff2a2a }), 0, 0.55, 2.11));
    } else {
      g.add(box(1.7, 0.1, 0.08, new THREE.MeshBasicMaterial({ color: 0xff2a2a }), 0, 0.55, 2.11));
      g.add(box(0.35, 0.1, 0.06, new THREE.MeshBasicMaterial({ color: 0xfff2b0 }), -0.6, 0.5, -2.11));
      g.add(box(0.35, 0.1, 0.06, new THREE.MeshBasicMaterial({ color: 0xfff2b0 }), 0.6, 0.5, -2.11));
    }
    return g;
  }
  function makePed(shirt) {
    var g = new THREE.Group();
    g.add(box(0.55, 0.7, 0.3, mat(shirt), 0, 1.05, 0));
    g.add(box(0.34, 0.34, 0.34, mat(0xc98d64), 0, 1.58, 0));
    g.add(box(0.5, 0.65, 0.28, mat(0x2a2f3a), 0, 0.35, 0));
    return g;
  }

  // ---------- build ----------
  C.build = function () {
    if (C._built) return C;
    C._built = true;
    var S = E.scene, rng = E.rng(20261120);

    // langit: kubah gradasi + matahari/bulan + awan
    var skySun = tex(4, 256, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#2a1a4a'); gr.addColorStop(0.45, '#b34a7a');
      gr.addColorStop(0.75, '#ff8a52'); gr.addColorStop(1, '#ffc46b');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    var skyNight = tex(4, 256, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#04060f'); gr.addColorStop(0.55, '#0d1b3a');
      gr.addColorStop(1, '#27355e');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    C._sky = new THREE.Mesh(new THREE.SphereGeometry(520, 20, 12),
      new THREE.MeshBasicMaterial({ map: skySun, side: THREE.BackSide, fog: false }));
    S.add(C._sky); C._skySun = skySun; C._skyNight = skyNight;
    C.sun = new THREE.Mesh(new THREE.CircleGeometry(30, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd76a, fog: false }));
    C.sun.position.set(-8, 150, -420); S.add(C.sun); // di atas koridor avenue x=0 — lolos dari menara
    var glowTex = tex(128, 128, function (g) {
      var gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
      gr.addColorStop(0, 'rgba(255,190,90,0.85)'); gr.addColorStop(1, 'rgba(255,150,60,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
    C.sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
    C.sunGlow.scale.set(170, 170, 1); C.sunGlow.position.copy(C.sun.position); S.add(C.sunGlow);
    C.moon = new THREE.Mesh(new THREE.CircleGeometry(18, 32),
      new THREE.MeshBasicMaterial({ color: 0xe8ecf5, fog: false }));
    C.moon.position.set(10, 180, -420); C.moon.visible = false; S.add(C.moon);
    C.clouds = [];
    var cm = new THREE.MeshBasicMaterial({ color: 0xffd9e8, transparent: true, opacity: 0.8, fog: false });
    for (var ci = 0; ci < 10; ci++) {
      var cl = new THREE.Group();
      cl.add(box(18 + rng() * 22, 2.2, 7, cm, 0, 0, 0));
      cl.add(box(12 + rng() * 10, 2.0, 6, cm, 6, 1.2, 1));
      cl.position.set(-180 + rng() * 360, 95 + rng() * 45, -320 + rng() * 380);
      S.add(cl); C.clouds.push(cl);
    }

    // tanah, pantai, laut
    S.add(plane(420, 420, mat(0xb99b6b), -20, 0, 0, -Math.PI / 2));
    S.add(plane(42, 240, mat(0xe3c58f), -89, 0.01, 0, -Math.PI / 2)); // pasir
    S.add(plane(80, 260, mat(0x2b6f9e), -150, 0.02, 0, -Math.PI / 2)); // laut
    S.add(plane(190, 260, mat(0x8f8578), 5, 0.005, 5, -Math.PI / 2)); // slab kota

    // jalan + trotoar (tekstur aspal bergaris)
    var roadTex = tex(128, 256, function (g, w, h) {
      g.fillStyle = '#2c2c33'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e8c33a';
      for (var y = 0; y < h; y += 32) g.fillRect(w / 2 - 2, y, 4, 18);
      g.fillStyle = '#d8d8d8'; g.fillRect(4, 0, 3, h); g.fillRect(w - 7, 0, 3, h);
    });
    roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
    var i, j;
    for (i = 0; i < AV.length; i++) {
      var rt = roadTex.clone(); rt.needsUpdate = true; rt.repeat.set(1, 10);
      S.add(plane(10, 240, new THREE.MeshLambertMaterial({ map: rt }), AV[i], 0.02, 0, -Math.PI / 2));
      S.add(plane(3, 240, mat(0xa89a80), AV[i] - 6.5, 0.015, 0, -Math.PI / 2));
      S.add(plane(3, 240, mat(0xa89a80), AV[i] + 6.5, 0.015, 0, -Math.PI / 2));
    }
    for (j = 0; j < ST.length; j++) {
      var rt2 = roadTex.clone(); rt2.needsUpdate = true;
      rt2.center.set(0.5, 0.5); rt2.rotation = Math.PI / 2; rt2.repeat.set(1, 10);
      S.add(plane(240, 10, new THREE.MeshLambertMaterial({ map: rt2 }), 0, 0.025, ST[j], -Math.PI / 2));
      S.add(plane(240, 3, mat(0xa89a80), 0, 0.015, ST[j] - 6.5, -Math.PI / 2));
      S.add(plane(240, 3, mat(0xa89a80), 0, 0.015, ST[j] + 6.5, -Math.PI / 2));
    }

    // bangunan: 66 (bank dulu, lalu isi blok)
    BMAT = [
      new THREE.MeshLambertMaterial({ map: winTex('#7a5a44', '#ffd28a') }),
      new THREE.MeshLambertMaterial({ map: winTex('#5a6a7a', '#ffe9b0') }),
      new THREE.MeshLambertMaterial({ map: winTex('#8a7a68', '#ffb36b') }),
      new THREE.MeshLambertMaterial({ map: winTex('#4a4a58', '#cfe4ff') })
    ];
    C._bmat = BMAT;
    var BX = [-45, -15, 15, 45], BZ = [-75, -45, -15, 15, 45, 75];
    function addB(x, z, w, d, h, m) {
      var b = box(w, h, d, m || bmat(C.buildings.length), x, h / 2, z);
      if (!m) { // skala UV supaya jendela ~sama besar di semua gedung
        var uv = b.geometry.attributes.uv, su = Math.max(w, d) / 7, sv = h / 7;
        for (var u = 0; u < uv.count; u++) uv.setXY(u, uv.getX(u) * su, uv.getY(u) * sv);
      }
      S.add(b);
      C.buildings.push({ x: x, z: z, w: w, d: d, h: h, district: C.districtAt(x, z), mesh: b });
      return b;
    }
    // bank "Solmar National Bank" — sisi timur avenue x=0, blok depan dikosongkan
    addB(14, -14, 12, 12, 14, mat(0x1e3a5f));
    for (var c = 0; c < 4; c++) S.add(box(0.9, 12, 0.9, mat(0xe8e0cc), 8.6, 6, -18 + c * 2.6));
    for (var ws = 0; ws < 3; ws++) // strip jendela di fasad selatan bank
      S.add(plane(1, 8, new THREE.MeshBasicMaterial({ color: 0xffd28a }), 11 + ws * 3, 6, -7.9));
    var bankTex = tex(512, 64, function (g, w, h) {
      g.fillStyle = '#12294a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffd76a'; g.font = 'bold 34px sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('SOLMAR NATIONAL BANK', w / 2, h / 2 + 1);
    });
    C.bankSign = plane(16, 2.2, new THREE.MeshBasicMaterial({ map: bankTex, side: THREE.DoubleSide }),
      2, 7, -2, 0, Math.PI / 4); // ujung timur (x 7,7) bersih dari fasad bank (x>=8)
    S.add(C.bankSign);
    C.bank = { x: 14, z: -14, mesh: C.buildings[0].mesh, signMesh: C.bankSign };
    // blok lain (hindari blok bank (15,-15) & koridor pandang bank)
    var downtown = function (x, z) { return x >= -30 && x <= 30 && z <= -40; };
    for (i = 0; i < BX.length; i++) for (j = 0; j < BZ.length; j++) {
      if (BX[i] === 15 && BZ[j] === -15) continue;
      if (BX[i] === -45 && BZ[j] === 45) continue; // blok pasar — plaza terbuka, jangan tutupi stall
      var n = downtown(BX[i], BZ[j]) ? 1 + Math.floor(rng() * 2) : 2 + Math.floor(rng() * 2);
      for (var k = 0; k < n && C.buildings.length < 66; k++) {
        var w = 9 + rng() * 5, d = 9 + rng() * 5;
        var h = downtown(BX[i], BZ[j]) ? 34 + rng() * 36 : 8 + rng() * 17;
        if (BX[i] === 15 && BZ[j] === 15) h = Math.min(h, 12); // jangan menutupi sign bank
        addB(BX[i] + (rng() - 0.5) * 4, BZ[j] + (rng() - 0.5) * 4, w, d, h);
      }
    }
    while (C.buildings.length < 66) { // pad ke 66 di Keystone Field
      addB(45 + (rng() - 0.5) * 8, 60 + (rng() - 0.5) * 8, 9 + rng() * 4, 9 + rng() * 4, 8 + rng() * 10);
    }

    // neon: 32 — BAR + PIZZA dijamin di avenue x=0
    function neonTex(text, color) {
      return tex(256, 64, function (g, w, h) {
        g.fillStyle = '#120a18'; g.fillRect(0, 0, w, h);
        g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.shadowColor = color; g.shadowBlur = 18; g.fillStyle = color;
        g.fillText(text, w / 2, h / 2 + 1);
        g.shadowBlur = 0; g.fillStyle = '#ffffff'; g.fillText(text, w / 2, h / 2 + 1);
      });
    }
    function addNeon(text, color, x, y, z, ry, w) {
      var m = plane(w || 7, 1.8, new THREE.MeshBasicMaterial({ map: neonTex(text, color),
        transparent: true, side: THREE.DoubleSide }), x, y, z, 0, ry);
      S.add(m);
      C.neon.push({ text: text, x: x, y: y, z: z, color: color, mesh: m });
      return m;
    }
    addNeon('BAR', '#ff4fd8', -8.5, 5.5, -5, Math.PI / 4, 7); // trotoar barat avenue 0, di depan hero
    S.add(box(0.3, 5.5, 0.3, mat(0x222222), -8.5, 2.75, -5));
    addNeon('PIZZA', '#ffb13d', -8.5, 5.0, -30, Math.PI / 4, 8);
    S.add(box(0.3, 5.0, 0.3, mat(0x222222), -8.5, 2.5, -30));
    var NPOOL = [['NITE', '#4fd8ff'], ['HOTEL', '#ffd76a'], ['TACOS', '#ff7a3d'], ['CLUB', '#ff4fd8'],
      ['24H', '#7dff8a'], ['MOTEL', '#4fd8ff'], ['BEER', '#ffb13d'], ['DANCE', '#ff4fd8'],
      ['CASINO', '#ffd76a'], ['GYM', '#7dff8a'], ['CAFE', '#ff9a52'], ['SOLMAR PD HQ', '#6bb8ff'],
      ['HOSPITAL', '#ff6b6b'], ['HOTEL MARINA', '#ffd76a'], ['VOLTAGE', '#ff4fd8'], ['MANGO', '#ffb13d'],
      ['FARO BOOKS', '#cfe4ff'], ['ZAPATOS', '#ff7a3d'], ['FARMACIA', '#7dff8a'], ['NEON', '#4fd8ff'],
      ['PALM', '#7dff8a'], ['SUNSET', '#ff9a52'], ['TIDE', '#4fd8ff'], ['CORAL', '#ff4fd8'],
      ['BAY 96.5', '#ffd76a'], ['WAVE 88.1', '#ff4fd8'], ['SOL 101.9', '#ffb13d'], ['MERCADO', '#7dff8a'],
      ['DOCK 9', '#4fd8ff'], ['PIER', '#ffd76a']];
    for (var ni = 0; ni < NPOOL.length && C.neon.length < 32; ni++) {
      var av = AV[Math.floor(rng() * AV.length)];
      var st = ST[Math.floor(rng() * ST.length)];
      var side = rng() < 0.5 ? -1 : 1;
      addNeon(NPOOL[ni][0], NPOOL[ni][1], av + side * 8.5, 4 + rng() * 6,
        st + (rng() - 0.5) * 12, side > 0 ? -Math.PI / 2 : Math.PI / 2, 6 + rng() * 3);
    }

    // palm — avenue x=0 HANYA sisi barat (jangan tutupi frame)
    var trunkM = mat(0x7a5230), frondM = mat(0x2f8a4a);
    function palm(x, z) {
      var g = new THREE.Group();
      var tr = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 6, 5), trunkM);
      tr.position.y = 3; tr.rotation.z = 0.08; g.add(tr);
      var cr = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.2, 6), frondM);
      cr.position.y = 6.4; cr.scale.y = 0.5; g.add(cr);
      g.position.set(x, 0, z); S.add(g); return g;
    }
    C.palms = [];
    for (var pz = -80; pz <= 100; pz += 20) { C.palms.push(palm(-8.5, pz)); }
    var px, pz2;
    for (px = 0; px < 16; px++) {
      var av2 = AV[Math.floor(rng() * AV.length)];
      C.palms.push(palm(av2 + (rng() < 0.5 ? -8.5 : 8.5), -100 + rng() * 200));
    }
    for (pz2 = -90; pz2 <= 90; pz2 += 45) C.palms.push(palm(-72, pz2)); // deret pantai

    // lampu jalan
    C.lamps = [];
    for (var li = 0; li < 20; li++) {
      var lx = AV[Math.floor(rng() * AV.length)] + (rng() < 0.5 ? -6.8 : 6.8);
      var lz = -100 + rng() * 200;
      var lg = new THREE.Group();
      lg.add(box(0.18, 5.5, 0.18, mat(0x2a2a2e), 0, 2.75, 0));
      lg.add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffe9a8 })));
      lg.children[1].position.y = 5.6;
      lg.position.set(lx, 0, lz); S.add(lg); C.lamps.push(lg);
    }

    // billboard 4
    function billboard(text, color, x, y, z, ry) {
      var t = tex(256, 128, function (g, w, h) {
        g.fillStyle = '#181022'; g.fillRect(0, 0, w, h);
        g.fillStyle = color; g.font = 'bold 34px sans-serif'; g.textAlign = 'center';
        g.fillText(text, w / 2, h / 2);
        g.fillStyle = '#ffffff'; g.font = '20px sans-serif';
        g.fillText('SOLMAR BAY', w / 2, h / 2 + 30);
      });
      S.add(box(0.4, 7, 0.4, mat(0x333333), x, 3.5, z));
      S.add(plane(11, 5.5, new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }),
        x, y, z, 0, ry));
    }
    billboard('FLAMINGO FM', '#ff4fd8', -8.5, 9, -70, Math.PI / 4);
    billboard('VENTO STRADA', '#4fd8ff', 8.5, 9, 55, -Math.PI / 4);
    billboard('NEON DRIVE', '#ffb13d', -38.5, 10, -15, Math.PI / 2);
    billboard('SOLMAR BAY', '#7dff8a', 38.5, 10, 75, -Math.PI / 2);

    // market stalls — Old Mercado (on-foot)
    function stall(x, z, color) {
      var g = new THREE.Group();
      g.add(box(3, 1, 2, mat(0x8a6a44), 0, 0.5, 0));
      var aw = tex(64, 64, function (g2, w, h) {
        for (var s = 0; s < 8; s++) { g2.fillStyle = s % 2 ? '#ffffff' : color; g2.fillRect(s * 8, 0, 8, h); }
      });
      var awm = plane(3.4, 2.4, new THREE.MeshBasicMaterial({ map: aw, side: THREE.DoubleSide }),
        0, 2.2, 0, -Math.PI / 2 + 0.5);
      g.add(awm);
      g.add(box(0.5, 0.4, 0.5, mat(0xd97b2f), -0.8, 1.2, 0));
      g.add(box(0.5, 0.4, 0.5, mat(0x3fae6a), 0.8, 1.2, 0));
      g.position.set(x, 0, z); S.add(g);
      C.stalls.push({ x: x, z: z, group: g });
      return g;
    }
    S.add(plane(42, 42, mat(0xcbb58a), -45, 0.015, 45, -Math.PI / 2)); // plaza pasar
    var STC = ['#ff4f6b', '#ffb13d', '#4fd8ff', '#7dff8a', '#ff4fd8', '#ffd76a'];
    for (var si = 0; si < 6; si++) stall(-58 + (si % 3) * 9, 34 + Math.floor(si / 3) * 10, STC[si]);
    for (var cr = 0; cr < 8; cr++) // peti + tong di pasar
      S.add(box(0.9, 0.9, 0.9, mat(0x9a7a4a), -62 + rng() * 20, 0.45, 30 + rng() * 20));

    // mobil parkir (6) — satu di foreground kanan cover
    var PK = [[8, 66, 0], [-7.5, 20, 0], [7.5, -30, 0], [-7.5, -55, 0], [33, 10, Math.PI / 2], [-33, -20, Math.PI / 2]];
    var PCOL = [0x4f7dd9, 0xe8c33a, 0x3fae6a, 0xd94f4f, 0x7a7a7a, 0xd97b2f];
    for (var pi = 0; pi < PK.length; pi++) {
      var pc = makeCar(PCOL[pi], false);
      pc.position.set(PK[pi][0], 0, PK[pi][1]); pc.rotation.y = PK[pi][2];
      S.add(pc); C.parked.push(pc);
    }
    // props pinggir jalan avenue 0 (isi foreground big-score)
    for (var pr = 0; pr < 10; pr++) {
      var side2 = pr % 2 ? -8.2 : 8.2;
      S.add(box(0.5, 0.9, 0.5, mat(0x2f6a8a), side2, 0.45, 10 + pr * 9));
      var cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 8), mat(0xff6a2a));
      cone.position.set(side2, 0.4, 14 + pr * 9); S.add(cone);
    }
    // roadblock di kejauhan avenue 0
    var rbTex = tex(128, 32, function (g, w, h) {
      for (var s = 0; s < 8; s++) { g.fillStyle = s % 2 ? '#ff6a2a' : '#ffffff'; g.fillRect(s * 16, 0, 16, h); }
    });
    S.add(box(4.5, 1, 0.3, new THREE.MeshBasicMaterial({ map: rbTex }), -2.5, 1, -35));
    S.add(box(4.5, 1, 0.3, new THREE.MeshBasicMaterial({ map: rbTex }), 2.5, 1, -38));

    // hero: mobil pink VENTO STRADA + pejalan kaki
    C.heroCar = makeCar(0xff5da2, false);
    C.heroCar.add(box(1.7, 0.1, 0.08, new THREE.MeshBasicMaterial({ color: 0xff2a2a }), 0, 0.55, 2.11));
    S.add(C.heroCar);
    C.heroPed = makePed(0xff5da2);
    S.add(C.heroPed);
    // 2 cruiser pengapit (staging) — B2 police ambil alih saat live
    for (var ei = 0; ei < 2; ei++) {
      var ec = makeCar(0, true); S.add(ec); C.escorts.push(ec);
    }
    // foreground ikut-hero (posisi di placeHeroProps): mobil + palm kanan
    C._fgCar = makeCar(0x4f7dd9, false); S.add(C._fgCar);
    C._fgPalm = palm(0, 0);
    // heli GULL-1 BERDETAIL
    var hg = new THREE.Group();
    var navy = mat(0x1c2f4a), white = mat(0xe8e8e8);
    hg.add(box(3.2, 1.6, 1.9, white, 0, 0, 0)); // badan putih (bukan siluet hitam)
    hg.add(box(3.24, 0.35, 1.94, navy, 0, -0.2, 0)); // stripe navy
    hg.add(box(1.3, 1.0, 1.7, mat(0x7fd4ff), 0, 0.25, 1.1)); // kaca kokpit
    hg.add(box(3.6, 0.5, 0.5, navy, 0, 0.3, -2.4)); // boom ekor
    hg.add(box(0.25, 1.3, 0.9, navy, 0, 0.9, -4.0)); // sirip ekor
    hg.add(box(0.5, 0.14, 0.28, new THREE.MeshBasicMaterial({ color: 0xff2a2a }), -0.5, 0.85, -1.0));
    hg.add(box(0.5, 0.14, 0.28, new THREE.MeshBasicMaterial({ color: 0x2a6bff }), 0.5, 0.85, -1.0));
    var rotor = box(7.2, 0.08, 0.55, mat(0x222222), 0, 1.05, 0); hg.add(rotor);
    hg.add(box(0.5, 0.3, 0.5, mat(0x333333), 0, 0.9, 0));
    var tailR = box(0.08, 1.6, 0.3, mat(0x222222), 0.35, 0.9, -4.0); hg.add(tailR);
    hg.add(box(0.25, 0.25, 2.6, mat(0x333333), -0.7, -1.0, 0.4)); // skid kiri
    hg.add(box(0.25, 0.25, 2.6, mat(0x333333), 0.7, -1.0, 0.4)); // skid kanan
    hg.add(box(0.15, 0.5, 0.15, mat(0x333333), -0.7, -0.75, 1.2));
    hg.add(box(0.15, 0.5, 0.15, mat(0x333333), 0.7, -0.75, 1.2));
    hg.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 }))); // lampu sorot
    hg.children[hg.children.length - 1].position.set(0, -0.9, 1.2);
    var coneG = new THREE.ConeGeometry(4.5, 1, 20, 1, true);
    var cone = new THREE.Mesh(coneG, new THREE.MeshBasicMaterial({
      color: 0xfff2b0, transparent: true, opacity: 0.25,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.scale.y = 16; cone.position.y = -8.5; hg.add(cone);
    var ring = new THREE.Mesh(new THREE.CircleGeometry(5, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.16,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = -15.9; hg.add(ring);
    S.add(hg);
    C.heli = { group: hg, cone: cone, ring: ring, rotor: rotor, tailRotor: tailR,
      x: 0, y: 16, z: 0, heading: 0 };
    C._skyDome = C._sky;
  };

  C.setSky = function (tod) {
    if (!C._sky) return;
    if (tod === 'NIGHT') {
      C._sky.material.map = C._skyNight; C.sun.visible = false; C.sunGlow.visible = false;
      C.moon.visible = true;
      for (var i = 0; i < C._bmat.length; i++) { C._bmat[i].emissive.setHex(0x664411); }
    } else {
      C._sky.material.map = C._skySun; C.sun.visible = true; C.sunGlow.visible = true;
      C.moon.visible = false;
      for (var j = 0; j < C._bmat.length; j++) { C._bmat[j].emissive.setHex(0x000000); }
    }
    C._sky.material.needsUpdate = true;
  };

  // ---------- traffic / peds ----------
  function clearList(list) {
    for (var i = 0; i < list.length; i++) E.scene.remove(list[i].group);
    list.length = 0;
  }
  var TCOLORS = [0xd94f4f, 0x4f7dd9, 0xe8c33a, 0x7a7a7a, 0x3fae6a, 0xe8e8e8, 0x2b2b2b, 0xd97b2f];
  var SHIRTS = [0xff5da2, 0x4fd8ff, 0xffb13d, 0x7dff8a, 0xe8e8e8, 0xff4fd8, 0xcfe4ff];
  C.spawnTraffic = function (n, rng) {
    rng = rng || E.rng(31 + n * 7);
    clearList(C.traffic);
    var H = E.hero, i;
    for (i = 0; i < Math.min(3, n); i++) { // 3 di depan hero, laju = laju hero
      var g = makeCar(TCOLORS[i % TCOLORS.length], false);
      var x = H.x + (i % 2 ? -3 : 3), z = H.z - 18 - i * 14;
      g.position.set(x, 0, z); g.rotation.y = 0; // heading PI, model forward -z
      E.scene.add(g);
      C.traffic.push({ group: g, x: x, z: z, heading: Math.PI, speed: H.speedKmh, axis: 'z', dir: -1 });
    }
    for (i = 3; i < n; i++) {
      var av = AV[Math.floor(rng() * AV.length)], dir = rng() < 0.5 ? -1 : 1;
      var g2 = makeCar(TCOLORS[Math.floor(rng() * TCOLORS.length)], false);
      var x2 = av + (dir < 0 ? 3 : -3), z2 = -100 + rng() * 200;
      if (Math.abs(z2 - H.z) < 14 && Math.abs(x2 - H.x) < 8) continue; // jangan menutupi kamera
      g2.position.set(x2, 0, z2); g2.rotation.y = dir < 0 ? 0 : Math.PI;
      E.scene.add(g2);
      C.traffic.push({ group: g2, x: x2, z: z2, heading: dir < 0 ? Math.PI : 0,
        speed: 28 + rng() * 30, axis: 'z', dir: dir });
    }
  };
  C.spawnPeds = function (n, rng) {
    rng = rng || E.rng(47 + n * 11);
    clearList(C.peds);
    var H = E.hero, i;
    for (i = 0; i < Math.min(6, n); i++) { // 6 di depan hero di trotoar
      var g = makePed(SHIRTS[i % SHIRTS.length]);
      var x = H.x + (i % 2 ? -7 : 7), z = H.z - 10 - i * 6;
      g.position.set(x, 0, z);
      E.scene.add(g);
      C.peds.push({ group: g, x: x, z: z, heading: Math.PI, speed: 1.4 + (i % 3) * 0.4,
        axis: 'z', dir: -1, ph: i * 1.3 });
    }
    for (i = 6; i < n; i++) {
      var av = AV[Math.floor(rng() * AV.length)];
      var g2 = makePed(SHIRTS[Math.floor(rng() * SHIRTS.length)]);
      var x2 = av + (rng() < 0.5 ? -7 : 7), z2 = -100 + rng() * 200;
      g2.position.set(x2, 0, z2);
      E.scene.add(g2);
      C.peds.push({ group: g2, x: x2, z: z2, heading: 0, speed: 1.2 + rng() * 1.2,
        axis: 'z', dir: rng() < 0.5 ? -1 : 1, ph: rng() * 6 });
    }
  };
  C.setDensity = function (t, p) { C.spawnTraffic(t); C.spawnPeds(p); };

  // ---------- posisi hero: escorts + heli + foreground ----------
  C.placeHeroProps = function (H) {
    var f = E._fwd(H.heading), r = E._right(H.heading);
    var off = [[-5, 4], [5.5, 6]]; // mengapit di SISI hero (fwd>0 = di depan hero, bukan di kamera)
    for (var i = 0; i < C.escorts.length; i++) {
      var e = C.escorts[i];
      e.position.set(H.x + r[0] * off[i][0] + f[0] * off[i][1], 0,
        H.z + r[1] * off[i][0] + f[1] * off[i][1]);
      e.rotation.y = H.heading + Math.PI; // model forward = local -z
    }
    // foreground kanan: mobil + palm ikut hero (isi sudut kanan-bawah frame)
    var carMode = H.mode === 'car';
    if (C._fgCar) {
      C._fgCar.visible = carMode;
      C._fgCar.position.set(H.x + r[0] * -4.5 + f[0] * 7, 0, H.z + r[1] * -4.5 + f[1] * 7);
      C._fgCar.rotation.y = H.heading + Math.PI;
    }
    if (C._fgPalm) {
      C._fgPalm.visible = carMode;
      C._fgPalm.position.set(H.x + r[0] * -10.5 + f[0] * -4, 0, H.z + r[1] * -10.5 + f[1] * -4);
    }
    C.setHeliFromHero(H);
  };
  C.setHeli = function (x, y, z, heading) {
    var h = C.heli; if (!h) return;
    h.x = x; h.y = y; h.z = z; h.heading = heading || 0;
    h.group.position.set(x, y, z); h.group.rotation.y = heading || 0;
  };
  C.setHeliFromHero = function (H) {
    var f = E._fwd(H.heading), r = E._right(H.heading);
    C.setHeli(H.x + r[0] * 6 + f[0] * 38, 16, H.z + r[1] * 6 + f[1] * 38, H.heading);
  };

  // ---------- tick ----------
  C.tick = function (dt, t, H) {
    var i, e;
    for (i = 0; i < C.traffic.length; i++) {
      e = C.traffic[i];
      e.z += e.dir * e.speed / 3.6 * dt;
      if (e.z < -105) e.z = 105; if (e.z > 105) e.z = -105;
      e.group.position.set(e.x, 0, e.z);
    }
    for (i = 0; i < C.peds.length; i++) {
      e = C.peds[i];
      e.z += e.dir * e.speed * dt;
      if (e.z < -105) e.z = 105; if (e.z > 105) e.z = -105;
      e.group.position.set(e.x, Math.abs(Math.sin(t * 6 + e.ph)) * 0.06, e.z);
      e.group.rotation.y = e.dir < 0 ? Math.PI : 0;
    }
    // hero visual
    if (C.heroCar) {
      C.heroCar.visible = H.mode === 'car';
      C.heroCar.position.set(H.x, 0, H.z);
      C.heroCar.rotation.y = H.heading + Math.PI; // model forward = local -z
    }
    if (C.heroPed) {
      C.heroPed.visible = H.mode === 'foot';
      C.heroPed.position.set(H.x, 0, H.z);
      C.heroPed.rotation.y = H.heading;
    }
    // escorts + heli ikut hero (sampai B2 police ambil alih)
    if (C.followHero) {
      C.placeHeroProps(H);
      if (C.heli) {
        C.heli.group.position.y = 16 + Math.sin(t * 1.3) * 0.4;
        C.heli.rotor.rotation.y += dt * 28;
        C.heli.tailRotor.rotation.x += dt * 28;
      }
    }
    for (i = 0; i < C.clouds.length; i++) {
      var cl = C.clouds[i];
      cl.position.x += dt * 0.5; if (cl.position.x > 200) cl.position.x = -200;
    }
  };
})();
