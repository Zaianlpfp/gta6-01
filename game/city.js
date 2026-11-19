// Solmar Bay — city.js (B1, v4-rebuild r4)
// Kota Solmar Bay: 66 bangunan, 9 distrik, jalan, traffic, pejalan kaki, neon,
// heli + spotlight cone, palm, pantai/laut, matahari, bank. Semua acak dari rng seed.
// Pool burst PERSISTEN (perbaikan muzzle flash): 96 box + flash sprite + point
// light dibuat sekali di attach() dan tinggal di scene sejak awal; burst() hanya
// toggle visible/posisi — engine me-render seluruh live scene tiap frame.
(function () {
  var SB = window.SB = window.SB || {};
  var T = window.THREE;
  var city = SB.city = SB.city || {};
  var ROADS = [-144, -96, -48, 0, 48, 96, 144];
  var BLOCKS = [-120, -72, -24, 24, 72, 120];
  var DIST = [
    { name: 'Pelican Marina', cx: -96, cz: -96, color: 0x4fa8c9 },
    { name: 'Palmetto Heights', cx: 0, cz: -96, color: 0x7ad06a },
    { name: 'Bayline Docks', cx: 96, cz: -96, color: 0x8a8a84 },
    { name: 'Coral Strand', cx: -96, cz: 0, color: 0xe88a5f },
    { name: 'Downtown', cx: 0, cz: 0, color: 0xd8b13c },
    { name: 'Deco Row', cx: 96, cz: 0, color: 0xd84f9f },
    { name: 'Old Mercado', cx: -96, cz: 96, color: 0xc96a3a },
    { name: 'Neon Mile', cx: 0, cz: 96, color: 0xff4fa3 },
    { name: 'Keystone Field', cx: 96, cz: 96, color: 0x9a6ad0 }
  ];
  city.districts = DIST;
  city.buildings = [];
  city.traffic = [];
  city.peds = [];
  city.parked = [];

  function districtAt(x, z) {
    var bx = x < -48 ? 0 : x < 48 ? 1 : 2, bz = z < -48 ? 0 : z < 48 ? 1 : 2;
    return DIST[bz * 3 + bx];
  }
  function textTex(txt, fg, bg, w, h, font) {
    var c = document.createElement('canvas'); c.width = w || 256; c.height = h || 64;
    var g = c.getContext('2d');
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
    g.font = font || 'bold 44px Arial';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = fg; g.shadowBlur = 16;
    g.fillStyle = fg; g.fillText(txt, c.width / 2, c.height / 2 + 2);
    g.shadowBlur = 0; g.fillText(txt, c.width / 2, c.height / 2 + 2);
    return new T.CanvasTexture(c);
  }
  function winTex(base, rng) {
    var c = document.createElement('canvas'); c.width = 128; c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 128, 256);
    for (var r = 0; r < 12; r++) for (var col = 0; col < 6; col++) {
      var lit = rng() < 0.35;
      g.fillStyle = lit ? '#ffd27a' : '#232833';
      g.fillRect(8 + col * 20, 10 + r * 20, 12, 12);
    }
    return new T.CanvasTexture(c);
  }
  function stripeTex(c1, c2) {
    var c = document.createElement('canvas'); c.width = 64; c.height = 64;
    var g = c.getContext('2d');
    for (var i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c1 : c2; g.fillRect(i * 8, 0, 8, 64); }
    return new T.CanvasTexture(c);
  }

  // --- kendaraan & orang (mesh kecil, material bersama sebisa mungkin) ---
  var carBodyGeo = new T.BoxGeometry(1.9, 0.55, 4.2);
  var carCabGeo = new T.BoxGeometry(1.6, 0.5, 2.0);
  var axleGeo = new T.BoxGeometry(2.0, 0.35, 0.6);
  var lampGeo = new T.BoxGeometry(1.5, 0.14, 0.1);
  var axleMat = new T.MeshLambertMaterial({ color: 0x14141a });
  var headMat = new T.MeshBasicMaterial({ color: 0xfff6c8 });
  var tailMat = new T.MeshBasicMaterial({ color: 0xd81f2a });
  city.makeCar = function (color, o) {
    o = o || {};
    var g = new T.Group();
    var bodyMat = new T.MeshLambertMaterial({ color: color });
    var body = new T.Mesh(carBodyGeo, bodyMat); body.position.y = 0.55; g.add(body);
    var cab = new T.Mesh(carCabGeo, new T.MeshLambertMaterial({ color: 0x1c2733 }));
    cab.position.set(0, 1.05, 0.25); g.add(cab);
    var a1 = new T.Mesh(axleGeo, axleMat); a1.position.set(0, 0.3, 1.35); g.add(a1);
    var a2 = new T.Mesh(axleGeo, axleMat); a2.position.set(0, 0.3, -1.35); g.add(a2);
    var hl = new T.Mesh(lampGeo, headMat); hl.position.set(0, 0.62, -2.12); g.add(hl);
    var tl = new T.Mesh(lampGeo, tailMat); tl.position.set(0, 0.62, 2.12); g.add(tl);
    if (o.cruiser) {
      var bar = new T.Mesh(new T.BoxGeometry(1.1, 0.16, 0.4),
        new T.MeshBasicMaterial({ color: 0x2244ff }));
      bar.position.set(0, 1.38, 0.25); g.add(bar);
      var bar2 = new T.Mesh(new T.BoxGeometry(0.5, 0.16, 0.42),
        new T.MeshBasicMaterial({ color: 0xff2233 }));
      bar2.position.set(0.55, 1.38, 0.25); g.add(bar2);
    }
    if (o.taxi) {
      var sign = new T.Mesh(new T.BoxGeometry(0.7, 0.18, 0.4),
        new T.MeshBasicMaterial({ color: 0xffe94f }));
      sign.position.set(0, 1.4, 0.25); g.add(sign);
    }
    g.userData.kind = o.cruiser ? 'cruiser' : o.taxi ? 'taxi' : o.truck ? 'truck' : 'car';
    return g;
  };
  var legGeo = new T.BoxGeometry(0.5, 0.7, 0.3);
  var torsoGeo = new T.BoxGeometry(0.62, 0.75, 0.34);
  var headGeo = new T.BoxGeometry(0.34, 0.34, 0.34);
  var skinMat = new T.MeshLambertMaterial({ color: 0xc98a5f });
  var pantsMat = new T.MeshLambertMaterial({ color: 0x2a2a3a });
  city.makePerson = function (shirt, cop) {
    var g = new T.Group();
    var legs = new T.Mesh(legGeo, pantsMat); legs.position.y = 0.35; g.add(legs);
    var torso = new T.Mesh(torsoGeo, new T.MeshLambertMaterial({ color: shirt }));
    torso.position.y = 1.1; g.add(torso);
    var head = new T.Mesh(headGeo, skinMat); head.position.y = 1.65; g.add(head);
    if (cop) {
      var cap = new T.Mesh(new T.BoxGeometry(0.4, 0.12, 0.4),
        new T.MeshLambertMaterial({ color: 0x1e2f5e }));
      cap.position.y = 1.86; g.add(cap);
    }
    return g;
  };

  // --- bangun kota ---
  city.attach = function (scene) {
    city.scene = scene;
    var rng = SB.engine.rng(20261120);
    var i, j;
    // tanah dasar + blok + jalan + pantai/laut
    var ground = new T.Mesh(new T.PlaneGeometry(340, 340),
      new T.MeshLambertMaterial({ color: 0x8f8578 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);
    var blockMats = [
      new T.MeshLambertMaterial({ color: 0x9a8f7a }),
      new T.MeshLambertMaterial({ color: 0x8a8a84 }),
      new T.MeshLambertMaterial({ color: 0x6a8a52 }),
      new T.MeshLambertMaterial({ color: 0xa89a72 })
    ];
    var blockGeo = new T.PlaneGeometry(34, 34);
    var parks = [[0, 0], [5, 5], [0, 5]];
    var groundMats = [blockMats[0], blockMats[1], blockMats[3]]; // blok biasa: tanpa hijau
    for (i = 0; i < 6; i++) for (j = 0; j < 6; j++) {
      var isPark = false;
      for (var k = 0; k < parks.length; k++) if (parks[k][0] === i && parks[k][1] === j) isPark = true;
      var b = new T.Mesh(blockGeo, isPark ? blockMats[2] : groundMats[Math.floor(rng() * 3)]);
      b.rotation.x = -Math.PI / 2; b.position.set(BLOCKS[i], 0, BLOCKS[j]); scene.add(b);
    }
    var roadTexC = document.createElement('canvas'); roadTexC.width = 64; roadTexC.height = 128;
    var rg = roadTexC.getContext('2d');
    rg.fillStyle = '#3a3542'; rg.fillRect(0, 0, 64, 128);
    rg.fillStyle = '#d8b13c'; rg.fillRect(30, 8, 4, 40); rg.fillRect(30, 72, 4, 40);
    var roadTex = new T.CanvasTexture(roadTexC);
    roadTex.wrapS = roadTex.wrapT = T.RepeatWrapping; roadTex.repeat.set(1, 24);
    var roadMat = new T.MeshLambertMaterial({ map: roadTex });
    var roadTexH = roadTex.clone(); roadTexH.rotation = Math.PI / 2;
    roadTexH.center.set(0.5, 0.5); roadTexH.needsUpdate = true;
    var roadMatH = new T.MeshLambertMaterial({ map: roadTexH });
    var roadGeoV = new T.PlaneGeometry(12, 312), roadGeoH = new T.PlaneGeometry(312, 12);
    for (i = 0; i < 7; i++) {
      var rv = new T.Mesh(roadGeoV, roadMat);
      rv.rotation.x = -Math.PI / 2; rv.position.set(ROADS[i], 0.06, 0); scene.add(rv);
      var rh = new T.Mesh(roadGeoH, roadMatH);
      rh.rotation.x = -Math.PI / 2; rh.position.set(0, 0.06, ROADS[i]); scene.add(rh);
    }
    // pasir + laut (barat) + payung pantai
    var sand = new T.Mesh(new T.PlaneGeometry(35, 340),
      new T.MeshLambertMaterial({ color: 0xd9c08a }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(-187.5, 0, 0); scene.add(sand);
    var seaC = document.createElement('canvas'); seaC.width = 128; seaC.height = 128;
    var sg = seaC.getContext('2d');
    sg.fillStyle = '#1e6f9e'; sg.fillRect(0, 0, 128, 128);
    sg.strokeStyle = 'rgba(255,255,255,0.35)'; sg.lineWidth = 3;
    for (i = 0; i < 6; i++) {
      sg.beginPath(); sg.moveTo(0, 14 + i * 20);
      sg.bezierCurveTo(40, 8 + i * 20, 80, 20 + i * 20, 128, 14 + i * 20); sg.stroke();
    }
    city.seaTex = new T.CanvasTexture(seaC);
    city.seaTex.wrapS = city.seaTex.wrapT = T.RepeatWrapping;
    city.seaTex.repeat.set(6, 8);
    var sea = new T.Mesh(new T.PlaneGeometry(265, 340),
      new T.MeshLambertMaterial({ map: city.seaTex }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(-337.5, -0.15, 0); scene.add(sea);
    var umbMat = new T.MeshLambertMaterial({ color: 0xe85f7a });
    for (i = 0; i < 5; i++) {
      var um = new T.Mesh(new T.ConeGeometry(2.2, 1.1, 8), umbMat);
      um.position.set(-178, 1.6, -120 + i * 60); scene.add(um);
      var pole = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 1.6, 5),
        new T.MeshLambertMaterial({ color: 0x8a6a3a }));
      pole.position.set(-178, 0.8, -120 + i * 60); scene.add(pole);
    }
    // --- 66 bangunan ---
    var winMats = [
      new T.MeshLambertMaterial({ map: winTex('#c9b18c', rng) }),
      new T.MeshLambertMaterial({ map: winTex('#9aa0a8', rng) }),
      new T.MeshLambertMaterial({ map: winTex('#b0704f', rng) }),
      new T.MeshLambertMaterial({ map: winTex('#5f8a8a', rng) }),
      new T.MeshLambertMaterial({ map: winTex('#d8d2c4', rng) })
    ];
    var boxGeo = new T.BoxGeometry(1, 1, 1);
    var acGeo = new T.BoxGeometry(2, 1, 2);
    var acMat = new T.MeshLambertMaterial({ color: 0x6a6a72 });
    var palette = [0xc9b18c, 0x9aa0a8, 0xb0704f, 0x5f8a8a, 0xd8d2c4, 0xe88a5f, 0x7a9ab0];
    var n = 0;
    for (i = 0; i < 6 && n < 65; i++) for (j = 0; j < 6 && n < 65; j++) {
      if (i === 3 && j === 3) continue; // blok bank: hanya bank, sightline bersih
      var cnt = 1 + Math.floor(rng() * 3);
      var downtown = (i === 2 || i === 3) && (j === 2 || j === 3);
      for (var m = 0; m < cnt && n < 65; m++) {
        var w = 10 + rng() * 12, d = 10 + rng() * 12;
        var h = downtown ? 18 + rng() * 26 : 6 + rng() * 16;
        if (i === 0) h = 4 + rng() * 6; // tepi pantai rendah
        var bx = BLOCKS[i] + (rng() - 0.5) * (34 - w);
        var bz = BLOCKS[j] + (rng() - 0.5) * (34 - d);
        var mesh = new T.Mesh(boxGeo, winMats[Math.floor(rng() * winMats.length)]);
        mesh.scale.set(w, h, d); mesh.position.set(bx, h / 2, bz); scene.add(mesh);
        if (rng() < 0.4) {
          var ac = new T.Mesh(acGeo, acMat);
          ac.position.set(bx + (rng() - 0.5) * w * 0.4, h + 0.5, bz + (rng() - 0.5) * d * 0.4);
          scene.add(ac);
        }
        city.buildings.push({ x: bx, z: bz, w: w, d: d, h: h,
          district: districtAt(bx, bz).name, mesh: mesh });
        n++;
      }
    }
    // --- bank "SOLMAR NATIONAL BANK" (wajah barat ke avenue x=0) ---
    var removed = 0;
    for (i = city.buildings.length - 1; i >= 0; i--) {
      var bd = city.buildings[i];
      if (Math.abs(bd.x - 26) < 14 && Math.abs(bd.z - 8) < 14) {
        scene.remove(bd.mesh); city.buildings.splice(i, 1); removed++;
      }
    }
    var bank = new T.Mesh(boxGeo, new T.MeshLambertMaterial({ color: 0x2a3f66 }));
    bank.scale.set(20, 16, 18); bank.position.set(26, 8, 8); scene.add(bank);
    var colGeo = new T.BoxGeometry(1.2, 12, 1.2);
    var colMat = new T.MeshLambertMaterial({ color: 0xd8d2c4 });
    for (i = 0; i < 4; i++) {
      var col = new T.Mesh(colGeo, colMat);
      col.position.set(15.2, 6, 1 + i * 4.6); scene.add(col);
    }
    var bankSign = new T.Mesh(new T.PlaneGeometry(16, 3.2),
      new T.MeshBasicMaterial({ map: textTex('SOLMAR NATIONAL BANK', '#f5d76a', '#12264d', 1024, 128, 'bold 64px Arial') }));
    bankSign.position.set(15.8, 13.5, 8); bankSign.rotation.y = -Math.PI / 2; scene.add(bankSign);
    city.bank = { x: 26, z: 8, mesh: bank, sign: bankSign };
    city.buildings.push({ x: 26, z: 8, w: 20, d: 18, h: 16, district: 'Downtown', mesh: bank });
    // top-up ke 66 bangunan persis (ganti yang digusur bank)
    while (city.buildings.length < 66) {
      var bi = Math.floor(rng() * 6), bj = Math.floor(rng() * 6);
      if (bi === 3 && bj === 3) continue; // blok bank tetap kosong
      var uw = 8 + rng() * 8, ud = 8 + rng() * 8, uh = 5 + rng() * 9;
      var ux = BLOCKS[bi] + (rng() - 0.5) * (34 - uw);
      var uz = BLOCKS[bj] + (rng() - 0.5) * (34 - ud);
      if (Math.abs(ux - 26) < 14 && Math.abs(uz - 8) < 14) continue;
      var um = new T.Mesh(boxGeo, winMats[Math.floor(rng() * winMats.length)]);
      um.scale.set(uw, uh, ud); um.position.set(ux, uh / 2, uz); scene.add(um);
      city.buildings.push({ x: ux, z: uz, w: uw, d: ud, h: uh,
        district: districtAt(ux, uz).name, mesh: um });
    }
    // jaga-jaga: pangkas ke 66 persis (jangan pernah potong bank)
    while (city.buildings.length > 66) {
      var idx = city.buildings[0].mesh === city.bank.mesh ? 1 : 0;
      var gone = city.buildings.splice(idx, 1)[0];
      scene.remove(gone.mesh);
    }
    // landmark: PD HQ, hospital, hotel
    var marks = [
      { txt: 'SOLMAR PD HQ', near: [72, -24], fg: '#8fd0ff', bg: '#10233d' },
      { txt: 'GENERAL HOSPITAL', near: [-72, -72], fg: '#ff8a8a', bg: '#3d1020' },
      { txt: 'HOTEL MIRAMAR', near: [72, 72], fg: '#ffe94f', bg: '#1a2a10' }
    ];
    for (i = 0; i < marks.length; i++) {
      var best = null, bd2 = 1e9;
      for (j = 0; j < city.buildings.length; j++) {
        var bb = city.buildings[j];
        var dd = (bb.x - marks[i].near[0]) * (bb.x - marks[i].near[0]) + (bb.z - marks[i].near[1]) * (bb.z - marks[i].near[1]);
        if (dd < bd2) { bd2 = dd; best = bb; }
      }
      if (best) {
        var sgn = new T.Mesh(new T.PlaneGeometry(12, 2.2),
          new T.MeshBasicMaterial({ map: textTex(marks[i].txt, marks[i].fg, marks[i].bg, 512, 96, 'bold 52px Arial') }));
        sgn.position.set(best.x, best.h + 1.4, best.z);
        sgn.rotation.y = best.x >= 0 ? -Math.PI / 2 : Math.PI / 2;
        scene.add(sgn);
      }
    }
    // --- 32 neon (BAR + PIZZA dipaksa di avenue x=0 dekat cover) ---
    var neons = ['BAR', 'PIZZA', '24H', 'HOTEL', 'CLUB', 'TACOS', 'BEER', 'NEON', 'GYM',
      'CAFE', 'DISCO', 'MOTEL', 'RAMEN', 'KTV', 'DANCE', 'SLOTS', 'WINE', 'BBQ', 'SPA',
      'INK', 'PHO', 'DIVE', 'LIVE', 'OPEN', 'COOL', 'VAPE', 'POOL', 'JAZZ', 'ROCK',
      'SUSHI', 'DINER', 'NITE'];
    var neonCols = [0xff4fa3, 0x4fd8ff, 0xffe94f, 0x7dff6a, 0xff8a3d, 0xc96aff];
    function neonSign(txt, b, y, faceX) {
      var col = neonCols[Math.floor(rng() * neonCols.length)];
      var fg = '#' + ('000000' + col.toString(16)).slice(-6);
      var p = new T.Mesh(new T.PlaneGeometry(6.5, 1.7),
        new T.MeshBasicMaterial({ map: textTex(txt, fg, 'rgba(10,8,18,0.85)'), transparent: true, side: T.DoubleSide }));
      if (faceX) { p.position.set(b.x + (b.x >= 0 ? -b.w / 2 - 0.2 : b.w / 2 + 0.2), y, b.z); p.rotation.y = b.x >= 0 ? -Math.PI / 2 : Math.PI / 2; }
      else { p.position.set(b.x, y, b.z + (b.z >= 0 ? -b.d / 2 - 0.2 : b.d / 2 + 0.2)); p.rotation.y = b.z >= 0 ? Math.PI : 0; }
      scene.add(p);
      return p;
    }
    function nearestB(x, z) {
      var best = null, bd = 1e9;
      for (var q = 0; q < city.buildings.length; q++) {
        var bb = city.buildings[q];
        var dd = (bb.x - x) * (bb.x - x) + (bb.z - z) * (bb.z - z);
        if (dd < bd) { bd = dd; best = bb; }
      }
      return best;
    }
    neonSign('BAR', nearestB(24, 40), 5, true);
    neonSign('PIZZA', nearestB(-24, 28), 4.5, true);
    var placed = 2;
    while (placed < 32) {
      var b = city.buildings[Math.floor(rng() * city.buildings.length)];
      if (b.mesh === city.bank.mesh) continue;
      neonSign(neons[placed], b, 3 + rng() * 6, rng() < 0.7);
      placed++;
    }
    // --- billboard ---
    var boards = [
      { txt: 'FLAMINGO FM', x: -30, z: -100, fg: '#ff4fa3', bg: '#1a1030' },
      { txt: 'VENTO STRADA', x: 30, z: -60, fg: '#ffe94f', bg: '#10233d' },
      { txt: 'SOLMAR BAY', x: -30, z: -40, fg: '#4fd8ff', bg: '#0a1a2a' },
      { txt: 'CLUB VOLTAGE', x: -30, z: -80, fg: '#c96aff', bg: '#1a0a2a' }
    ];
    for (i = 0; i < boards.length; i++) {
      var bp = new T.Mesh(new T.PlaneGeometry(15, 5),
        new T.MeshBasicMaterial({ map: textTex(boards[i].txt, boards[i].fg, boards[i].bg, 512, 160, 'bold 72px Arial'), side: T.DoubleSide }));
      bp.position.set(boards[i].x, 10, boards[i].z);
      bp.rotation.y = boards[i].x >= 0 ? -0.35 : 0.35;
      scene.add(bp);
      var post = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 7.5, 6),
        new T.MeshLambertMaterial({ color: 0x3a3a44 }));
      post.position.set(boards[i].x, 3.75, boards[i].z); scene.add(post);
    }
    // --- palm (40) ---
    var trunkGeo = new T.CylinderGeometry(0.18, 0.3, 6, 6);
    var trunkMat = new T.MeshLambertMaterial({ color: 0x7a5a34 });
    var frondGeo = new T.ConeGeometry(2.0, 1.6, 7);
    var frondMat = new T.MeshLambertMaterial({ color: 0x3f8a3a });
    function palm(x, z) {
      var tr = new T.Mesh(trunkGeo, trunkMat); tr.position.set(x, 3, z); scene.add(tr);
      var fr = new T.Mesh(frondGeo, frondMat);
      fr.scale.y = 0.55; fr.position.set(x, 6.0, z); scene.add(fr);
    }
    // avenue x=0: palm HANYA sisi barat (timur = sisi kamera, menutupi frame)
    for (i = 0; i < 12; i++) palm(-11, -126 + i * 24);
    for (i = 0; i < 4; i++) { palm(59, -120 + i * 72); palm(-59, -84 + i * 72); }
    for (i = 0; i < 8; i++) palm(-178, -140 + i * 40);
    // --- lampu jalan (12) ---
    var poleGeo = new T.CylinderGeometry(0.12, 0.12, 6, 5);
    var poleMat = new T.MeshLambertMaterial({ color: 0x2a2a33 });
    var lampGeo2 = new T.SphereGeometry(0.35, 8, 6);
    var lampMat2 = new T.MeshBasicMaterial({ color: 0xffe9a8 });
    var lampSpots = [[-54, -54], [54, -54], [-54, 54], [54, 54], [-102, -6], [102, -6], [-6, -102], [6, 102], [-102, 102], [102, -102], [-10, 54], [10, -54]];
    for (i = 0; i < lampSpots.length; i++) {
      var pl = new T.Mesh(poleGeo, poleMat);
      pl.position.set(lampSpots[i][0], 3, lampSpots[i][1]); scene.add(pl);
      var lm = new T.Mesh(lampGeo2, lampMat2);
      lm.position.set(lampSpots[i][0], 6.2, lampSpots[i][1]); scene.add(lm);
    }
    // --- market stalls Old Mercado + crates ---
    var awnMat = new T.MeshLambertMaterial({ map: stripeTex('#d84f4f', '#f5f0e0') });
    var crateMat = new T.MeshLambertMaterial({ color: 0x8a6a3a });
    var stallSpots = [[-58, 80], [-56, 92], [-60, 100], [-57, 108]];
    for (i = 0; i < stallSpots.length; i++) {
      var st = new T.Mesh(new T.BoxGeometry(3, 2, 2),
        new T.MeshLambertMaterial({ color: 0x6a4a2a }));
      st.position.set(stallSpots[i][0], 1, stallSpots[i][1]); scene.add(st);
      var aw = new T.Mesh(new T.PlaneGeometry(3.4, 2.4), awnMat);
      aw.rotation.x = -Math.PI / 2; aw.rotation.z = 0.4;
      aw.position.set(stallSpots[i][0], 2.3, stallSpots[i][1]); scene.add(aw);
    }
    for (i = 0; i < 8; i++) {
      var cr = new T.Mesh(new T.BoxGeometry(1.2, 1.2, 1.2), crateMat);
      cr.position.set(-58 + rng() * 10, 0.6, 76 + rng() * 30); scene.add(cr);
    }
    // --- mobil parkir (6, dekat bank) ---
    var parkSpots = [[8, 30, 0], [8, 18, 0], [-8, 26, 0], [8, -14, 0], [-8, -22, 0], [56, 30, 1.57]];
    var parkCols = [0xe8e8e8, 0x3a6ad8, 0xd8b13c, 0x7a7a80, 0x4fae6a, 0xc94f4f];
    for (i = 0; i < parkSpots.length; i++) {
      var pk = city.makeCar(parkCols[i]);
      pk.position.set(parkSpots[i][0], 0, parkSpots[i][1]);
      pk.rotation.y = parkSpots[i][2]; scene.add(pk);
      city.parked.push(pk);
    }
    // --- traffic (29: 2 cruiser pengapit + 1 taxi + 2 truck + 24 mobil) ---
    var carCols = [0xd84f6a, 0x4f9fd8, 0xe8c84f, 0x7ad06a, 0x9a6ad0, 0xe8e8e8, 0x333a44, 0xe88a5f, 0x4fae8a, 0xc94f4f];
    for (i = 0; i < 29; i++) {
      var axis = rng() < 0.5 ? 'x' : 'z';
      var road = ROADS[Math.floor(rng() * 7)];
      var dir = rng() < 0.5 ? 1 : -1;
      var mesh, kind = 'car';
      if (i === 0 || i === 1) { mesh = city.makeCar(0xf0f0f0, { cruiser: true }); kind = 'cruiser'; }
      else if (i === 2) { mesh = city.makeCar(0xffc93c, { taxi: true }); kind = 'taxi'; }
      else if (i === 3 || i === 4) { mesh = city.makeCar(0x8a8a84, { truck: true }); kind = 'truck'; }
      else mesh = city.makeCar(carCols[Math.floor(rng() * carCols.length)]);
      scene.add(mesh);
      city.traffic.push({
        mesh: mesh, axis: axis, fixed: road, along: -150 + rng() * 300, dir: dir,
        lane: axis === 'x' ? (dir > 0 ? -3 : 3) : (dir > 0 ? 3 : -3),
        speed: 28 + rng() * 27, kind: kind,
        follow: kind === 'cruiser', off: i === 0 ? [-5, -6] : [5.5, -4], active: true
      });
    }
    // --- pejalan kaki (28: 2 foot cop + 26 warga) ---
    var shirts = [0xd84f6a, 0x4f9fd8, 0xe8c84f, 0x7ad06a, 0x9a6ad0, 0xe8e8e8, 0x333a44, 0xff8a3d];
    for (i = 0; i < 28; i++) {
      var pAxis = rng() < 0.5 ? 'x' : 'z';
      var pRoad = ROADS[Math.floor(rng() * 7)];
      var pDir = rng() < 0.5 ? 1 : -1;
      var pm = city.makePerson(i < 2 ? 0x1e2f5e : shirts[Math.floor(rng() * shirts.length)], i < 2);
      pm.userData.cop = i < 2;
      pm.userData.boss = false;
      scene.add(pm);
      city.peds.push({
        mesh: pm, axis: pAxis, fixed: pRoad + (rng() < 0.5 ? -8.5 : 8.5),
        along: -148 + rng() * 296, dir: pDir,
        speed: i >= 24 ? 3.5 + rng() : 1 + rng() * 1.2,
        run: i >= 24, active: true, ph: rng() * 6.28
      });
    }
    city.cops = [city.peds[0], city.peds[1]];
    // --- heli GULL-1 + cone spotlight + lingkaran cahaya ---
    var heli = new T.Group();
    var hBody = new T.Mesh(new T.BoxGeometry(2.0, 1.3, 3.4),
      new T.MeshLambertMaterial({ color: 0x2c3440 })); heli.add(hBody);
    var hGlass = new T.Mesh(new T.BoxGeometry(1.7, 0.7, 0.8),
      new T.MeshLambertMaterial({ color: 0x9fd8ef }));
    hGlass.position.set(0, 0.2, -1.6); heli.add(hGlass);
    var hTail = new T.Mesh(new T.BoxGeometry(0.5, 0.5, 3.2),
      new T.MeshLambertMaterial({ color: 0x2c3440 }));
    hTail.position.set(0, 0.2, 2.8); heli.add(hTail);
    var hFin = new T.Mesh(new T.BoxGeometry(0.12, 1.2, 0.8),
      new T.MeshLambertMaterial({ color: 0xd81f2a }));
    hFin.position.set(0, 0.6, 4.2); heli.add(hFin);
    var rotor = new T.Mesh(new T.BoxGeometry(7.5, 0.08, 0.5),
      new T.MeshLambertMaterial({ color: 0x14141a }));
    rotor.position.y = 0.85; heli.add(rotor);
    city.heliRotor = rotor;
    var hLabel = new T.Mesh(new T.PlaneGeometry(2.2, 0.55),
      new T.MeshBasicMaterial({ map: textTex('GULL-1', '#ffffff', 'rgba(0,0,0,0.0)', 256, 64, 'bold 44px Arial'), transparent: true }));
    hLabel.position.set(-1.02, 0.1, 0); hLabel.rotation.y = -Math.PI / 2; heli.add(hLabel);
    var skidGeo = new T.BoxGeometry(0.12, 0.12, 2.6);
    var skidMat = new T.MeshLambertMaterial({ color: 0x14141a });
    var s1 = new T.Mesh(skidGeo, skidMat); s1.position.set(-0.8, -0.85, 0); heli.add(s1);
    var s2 = new T.Mesh(skidGeo, skidMat); s2.position.set(0.8, -0.85, 0); heli.add(s2);
    scene.add(heli);
    city.heli = heli;
    var coneGrp = new T.Group(); scene.add(coneGrp);
    var cone = new T.Mesh(new T.ConeGeometry(9, 40, 20, 1, true),
      new T.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.12, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
    cone.rotation.x = Math.PI / 2; cone.position.z = -20; coneGrp.add(cone);
    city.coneGrp = coneGrp;
    var spot = new T.Mesh(new T.CircleGeometry(7, 24),
      new T.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.10, depthWrite: false, blending: T.AdditiveBlending }));
    spot.rotation.x = -Math.PI / 2; spot.position.y = 0.12; scene.add(spot);
    city.spot = spot;
    // --- pool burst PERSISTEN (muzzle flash): 96 box + flash sprite + point light ---
    city.burstPool = [];
    var bGeo = new T.BoxGeometry(0.16, 0.16, 0.16);
    for (i = 0; i < 96; i++) {
      var bm = new T.Mesh(bGeo, new T.MeshBasicMaterial({ color: 0xffc860 }));
      bm.visible = false; scene.add(bm);
      city.burstPool.push({ mesh: bm, vx: 0, vy: 0, vz: 0, life: 0, on: false });
    }
    var flashC = document.createElement('canvas'); flashC.width = 64; flashC.height = 64;
    var fg2 = flashC.getContext('2d');
    var fgr = fg2.createRadialGradient(32, 32, 2, 32, 32, 30);
    fgr.addColorStop(0, 'rgba(255,240,180,1)'); fgr.addColorStop(0.5, 'rgba(255,180,60,0.7)');
    fgr.addColorStop(1, 'rgba(255,140,20,0)');
    fg2.fillStyle = fgr; fg2.fillRect(0, 0, 64, 64);
    city.flash = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(flashC), color: 0xffe9a8, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
    city.flash.visible = false; scene.add(city.flash);
    city.flashLight = new T.PointLight(0xffc860, 0, 22, 1.5);
    scene.add(city.flashLight);
    city._burstCount = 0; city._burstLife = 0;
    // --- hero: mobil pink + karakter on-foot ---
    city.heroCar = city.makeCar(0xff4fa3);
    var shadow = new T.Mesh(new T.CircleGeometry(2.2, 20),
      new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.04;
    city.heroCar.add(shadow);
    scene.add(city.heroCar);
    city.heroChar = city.makePerson(0xff4fa3, false);
    var gun = new T.Mesh(new T.BoxGeometry(0.12, 0.12, 0.5),
      new T.MeshLambertMaterial({ color: 0x14141a }));
    gun.position.set(0.4, 1.15, -0.3); city.heroChar.add(gun);
    scene.add(city.heroChar);
    city.setDensity(24, 20);
  };

  // --- burst: hanya toggle visible/posisi (pool sudah di scene sejak attach) ---
  city.burst = function (x, y, z, o) {
    o = o || {};
    var n = o.n || 24, col = o.color || 0xffc860;
    var br = SB.engine.rng(9000 + city._burstCount * 7919);
    city._burstCount++;
    var placed = 0;
    for (var i = 0; i < city.burstPool.length && placed < n; i++) {
      var p = city.burstPool[i];
      if (p.on) continue;
      p.on = true; p.life = 0.32;
      p.mesh.visible = true;
      p.mesh.material.color.setHex(col);
      p.mesh.position.set(x, y, z);
      var a = br() * 6.283, e = (br() - 0.3) * 1.2, sp = 3 + br() * 7;
      p.vx = Math.cos(a) * Math.cos(e) * sp;
      p.vy = Math.sin(e) * sp + 2;
      p.vz = Math.sin(a) * Math.cos(e) * sp;
      placed++;
    }
    city.flash.position.set(x, y, z);
    city.flash.scale.set(o.flash || 4.5, o.flash || 4.5, 1);
    city.flash.visible = true;
    city.flashLight.position.set(x, y, z);
    city.flashLight.intensity = 2.4;
    city._burstLife = 0.32;
  };

  city.setDensity = function (cars, peds) {
    for (var i = 0; i < city.traffic.length; i++) {
      var c = city.traffic[i];
      c.active = i < cars;
      c.mesh.visible = c.active;
      if (c.follow && SB.state.mode === 'foot') { // on-foot: cruiser parkir dekat plaza
        c.mesh.visible = true; c.active = true;
        c.mesh.position.set(i === 0 ? -58 : -70, 0, i === 0 ? 78 : 92);
        c.mesh.rotation.y = i === 0 ? 0.7 : -0.5;
      }
    }
    for (var j = 0; j < city.peds.length; j++) {
      var p = city.peds[j];
      p.active = j < peds;
      p.mesh.visible = p.active;
    }
    // on-foot: 2 foot cop dekat hero, sebagian peds lari
    if (SB.state.mode === 'foot' && SB.engine.hero) {
      var hr = SB.engine.hero;
      var o0 = SB.engine.rotXZ(hr.heading, 3, -4), o1 = SB.engine.rotXZ(hr.heading, -4, -6);
      city.cops[0].mesh.position.set(hr.pos.x + o0[0], 0, hr.pos.z + o0[1]);
      city.cops[0].along = hr.pos.z + o0[1]; city.cops[0].fixed = hr.pos.x + o0[0];
      city.cops[1].mesh.position.set(hr.pos.x + o1[0], 0, hr.pos.z + o1[1]);
      city.cops[1].along = hr.pos.z + o1[1]; city.cops[1].fixed = hr.pos.x + o1[0];
      for (var k = 2; k < city.peds.length; k++) city.peds[k].run = k % 3 === 0;
    }
    // mode mobil: 3 traffic + 6 peds di-staging di depan hero, di avenue x=0.
    // Traffic melaju secepat hero (offset konstan selama advanceSim berapa pun).
    if (SB.state.mode === 'car' && SB.engine.hero) {
      var hr2 = SB.engine.hero, kmh = SB.state.speedKmh || 40;
      var offs = [-28, -38, -48];
      for (var s = 0; s < 3; s++) {
        var tc = city.traffic[5 + s];
        if (!tc) continue;
        tc.axis = 'x'; tc.fixed = 0; tc.dir = -1;
        tc.lane = (s % 2 ? 3 : -3); tc.along = hr2.pos.z + offs[s];
        tc.speed = kmh; tc.follow = false; tc.active = true; tc.mesh.visible = true;
      }
      var poffs = [-12, -18, -24, -30, -36, -42];
      for (var q2 = 0; q2 < 6; q2++) {
        var pp = city.peds[2 + q2];
        if (!pp) continue;
        pp.axis = 'x'; pp.fixed = (q2 % 2 ? 8.5 : -8.5);
        pp.along = hr2.pos.z + poffs[q2]; pp.dir = -1;
        pp.active = true; pp.mesh.visible = true;
      }
    }
  };

  city.setHeli = function (on, hero) {
    city.heli.visible = !!on;
    city.coneGrp.visible = !!on;
    city.spot.visible = !!on;
    city._heliOn = !!on;
  };

  city.placeHero = function (hero) {
    if (!city.heroCar) return;
    city.heroCar.visible = hero.mode === 'car';
    city.heroChar.visible = hero.mode === 'foot';
    var m = hero.mode === 'car' ? city.heroCar : city.heroChar;
    m.position.set(hero.pos.x, 0, hero.pos.z);
    m.rotation.y = hero.heading;
  };

  // titik di jalan? (dipakai B2: spawn / validasi posisi)
  city.roadAt = function (x, z) {
    for (var i = 0; i < ROADS.length; i++)
      if (Math.abs(x - ROADS[i]) < 7 || Math.abs(z - ROADS[i]) < 7) return true;
    return false;
  };
  city.groundY = function () { return 0; };

  // --- update per frame ---
  city.update = function (dt, t) {
    var i, hr = SB.engine.hero;
    for (i = 0; i < city.traffic.length; i++) {
      var c = city.traffic[i];
      if (!c.active || !c.mesh.visible) continue;
      if (c.follow && hr && hr.mode === 'car') {
        var o = SB.engine.rotXZ(hr.heading, c.off[0], c.off[1]);
        c.mesh.position.set(hr.pos.x + o[0], 0, hr.pos.z + o[1]);
        c.mesh.rotation.y = hr.heading;
        continue;
      }
      if (c.follow) continue; // parkir (mode foot) — diam
      c.along += c.dir * c.speed / 3.6 * dt;
      if (c.along > 152) c.along = -152;
      if (c.along < -152) c.along = 152;
      if (c.axis === 'x') {
        c.mesh.position.set(c.fixed + c.lane, 0, c.along);
        c.mesh.rotation.y = c.dir > 0 ? Math.PI : 0;
      } else {
        c.mesh.position.set(c.along, 0, c.fixed + c.lane);
        c.mesh.rotation.y = c.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
    }
    for (i = 0; i < city.peds.length; i++) {
      var p = city.peds[i];
      if (!p.active || !p.mesh.visible) continue;
      var sp = p.run ? p.speed * 2.2 : p.speed;
      p.along += p.dir * sp * dt;
      if (p.along > 148) p.along = -148;
      if (p.along < -148) p.along = 148;
      if (p.axis === 'x') {
        p.mesh.position.set(p.fixed, Math.abs(Math.sin(t * 6 + p.ph)) * 0.06, p.along);
        p.mesh.rotation.y = p.dir > 0 ? Math.PI : 0;
      } else {
        p.mesh.position.set(p.along, Math.abs(Math.sin(t * 6 + p.ph)) * 0.06, p.fixed);
        p.mesh.rotation.y = p.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
    }
    if (city._heliOn && hr) {
      var ho = SB.engine.rotXZ(hr.heading, 6, -38);
      var hx = hr.pos.x + ho[0], hz = hr.pos.z + ho[1], hy = 16 + Math.sin(t * 0.8) * 0.8;
      city.heli.position.set(hx, hy, hz);
      city.heliRotor.rotation.y = t * 22;
      var to = SB.engine.rotXZ(hr.heading, 4, -4);
      var tx = hr.pos.x + to[0], tz = hr.pos.z + to[1];
      city.coneGrp.position.set(hx, hy, hz);
      city.coneGrp.lookAt(tx, 0, tz);
      city.spot.position.set(tx, 0.12, tz);
    }
    if (city.seaTex) {
      city.seaTex.offset.x = (t * 0.008) % 1;
      city.seaTex.offset.y = (t * 0.005) % 1;
    }
    // decay burst
    if (city._burstLife > 0) {
      city._burstLife -= dt;
      var f = Math.max(0, city._burstLife / 0.32);
      city.flash.material.opacity = f;
      city.flashLight.intensity = 2.4 * f;
      if (city._burstLife <= 0) { city.flash.visible = false; city.flashLight.intensity = 0; }
    }
    for (i = 0; i < city.burstPool.length; i++) {
      var b = city.burstPool[i];
      if (!b.on) continue;
      b.life -= dt;
      if (b.life <= 0) { b.on = false; b.mesh.visible = false; continue; }
      b.vy -= 14 * dt;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.z += b.vz * dt;
      var s = Math.max(0.05, b.life / 0.32);
      b.mesh.scale.set(s, s, s);
    }
  };
})();
