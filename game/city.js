// city.js — Solmar Bay city: ground, road grid, 71 buildings, palms, neons,
// props, beach + marina, 9 districts, 20 peds, 24 traffic cars.
// Fresh write for gta6-01 v4 rebuild r13 (from game/API.md §4).
// Deterministic: no built-in nondeterministic sources in game code.
// All randomness goes through SB.rng() (mulberry32, seed 1337).
(function () {
  'use strict';
  var SB = window.SB = window.SB || {};
  var C = SB.city = {};

  // ---------- districts (API.md §4) ----------
  C.districts = [
    { name: 'Coral Strand', cx: -130, cz: 60, w: 70, d: 160 },
    { name: 'Neon Mile', cx: 0, cz: -60, w: 120, d: 60 },
    { name: 'Palmetto Heights', cx: 120, cz: -80, w: 90, d: 70 },
    { name: 'Deco Row', cx: 20, cz: 20, w: 90, d: 60 },
    { name: 'Downtown', cx: 60, cz: -40, w: 120, d: 80 },
    { name: 'Old Mercado', cx: -40, cz: 60, w: 80, d: 70 },
    { name: 'Keystone Field', cx: 140, cz: 80, w: 80, d: 90 },
    { name: 'Pelican Marina', cx: -120, cz: -80, w: 80, d: 70 },
    { name: 'Bayline Docks', cx: 120, cz: 160, w: 100, d: 70 }
  ];

  // ---------- road grid ----------
  var ROAD_X = [-120, -80, -40, 0, 40, 80, 120, 160];
  var ROAD_Z = [-100, -60, -20, 20, 60, 100, 140, 180];
  C.roads = [];
  for (var i = 0; i < ROAD_X.length; i++) {
    C.roads.push({ x0: ROAD_X[i], z0: -120, x1: ROAD_X[i], z1: 200 });
  }
  for (var j = 0; j < ROAD_Z.length; j++) {
    C.roads.push({ x0: -160, z0: ROAD_Z[j], x1: 200, z1: ROAD_Z[j] });
  }

  C.spawnPoints = { cover: [0, 0], onfoot: [0, 40], mission: [2, 10], map: [0, 0], free: [0, 40] };
  C.bank = { pos: [2, 7, -2], rotY: Math.PI / 4 };
  C.staging = { coverCruisers: [[-5, 4], [5.5, 6]] };
  C.counts = { buildings: 0, palms: 0, neons: 0, props: 0, traffic: 24, peds: 20 };
  C.peds = [];
  C.traffic = [];

  C.groundAt = function (x, z) { return 0; };
  C.nearBank = function (x, z) {
    var dx = x - 2, dz = z + 2;
    return (dx * dx + dz * dz) < 18 * 18;
  };

  // ---------- helpers ----------
  var _scene = null, _built = false;
  var _winTex = null, _bankTex = null, _roadTex = null;

  function lambert(color, extra) {
    var params = { color: color };
    if (extra) for (var k in extra) params[k] = extra[k];
    return new THREE.MeshLambertMaterial(params);
  }

  function box(w, h, d, mat, x, y, z, ry) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    _scene.add(m);
    return m;
  }

  function flat(w, d, mat, x, y, z, ry) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    if (ry) m.rotation.z = ry;
    m.position.set(x, y, z);
    _scene.add(m);
    return m;
  }

  // shared window texture for tall buildings (some windows lit warm)
  function windowTexture() {
    if (_winTex) return _winTex;
    var c = document.createElement('canvas'); c.width = 128; c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = '#3a3f4a'; g.fillRect(0, 0, 128, 256);
    for (var y = 8; y < 248; y += 16) {
      for (var x = 8; x < 120; x += 16) {
        g.fillStyle = SB.rand() < 0.45 ? '#ffd27a' : '#20242e';
        g.fillRect(x, y, 10, 10);
      }
    }
    _winTex = new THREE.CanvasTexture(c);
    return _winTex;
  }

  // bank sign texture 2048x512, full text (API.md §4)
  function bankTexture() {
    if (_bankTex) return _bankTex;
    var c = document.createElement('canvas'); c.width = 2048; c.height = 512;
    var g = c.getContext('2d');
    g.fillStyle = '#0b1e3a'; g.fillRect(0, 0, 2048, 512);
    g.strokeStyle = '#d9a441'; g.lineWidth = 10; g.strokeRect(18, 18, 2012, 476);
    g.fillStyle = '#f5c542';
    g.font = 'bold 150px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('SOLMAR NATIONAL BANK', 1024, 200);
    g.fillStyle = '#e8e4d8'; g.font = 'bold 84px Georgia, serif';
    g.fillText('★ EST. 1962 ★', 1024, 360);
    _bankTex = new THREE.CanvasTexture(c);
    _bankTex.colorSpace = THREE.SRGBColorSpace;
    return _bankTex;
  }

  // asphalt with dashed centre line + edge lines, repeated along the road
  function roadTexture() {
    if (_roadTex) return _roadTex;
    var c = document.createElement('canvas'); c.width = 128; c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = '#33333a'; g.fillRect(0, 0, 128, 256);
    g.fillStyle = '#f5f5f0';
    for (var y = 0; y < 256; y += 64) g.fillRect(60, y + 8, 8, 32);
    g.fillStyle = '#d9a441';
    g.fillRect(4, 0, 4, 256); g.fillRect(120, 0, 4, 256);
    _roadTex = new THREE.CanvasTexture(c);
    _roadTex.wrapS = THREE.RepeatWrapping;
    _roadTex.wrapT = THREE.RepeatWrapping;
    return _roadTex;
  }

  function neonTexture(text, bg, fg) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, 496, 112);
    g.fillStyle = fg; g.font = 'bold 64px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 66);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ---------- buildings ----------
  // Corridor rule (API.md §4): a facade facing road x=0 or x=40 stays >= 7.5
  // from the road axis. Corridor buildings are placed at |x| >= 13 (x=0) and
  // |x-40| >= 13 (x=40) with width <= 11; the clamp below is a safety net.
  // The bank (20,-20) keeps its specified 26x14x14 size.
  function building(x, z, w, h, d, color, opts) {
    opts = opts || {};
    if (opts.bank !== true) {
      var nearX0 = Math.abs(x) < 15, nearX40 = Math.abs(x - 40) < 15;
      if ((nearX0 || nearX40) && w > 11) w = 11;
    }
    var mat = h >= 24
      ? new THREE.MeshLambertMaterial({ color: color, map: windowTexture() })
      : lambert(color);
    var m = box(w, h, d, mat, x, h / 2, z, opts.ry || 0);
    box(w + 0.4, 0.5, d + 0.4, lambert(0x2a2a30), x, h + 0.25, z, opts.ry || 0);
    m.userData.w = w; m.userData.d = d;
    C.counts.buildings++;
    return m;
  }

  // [x, z, w, h, d, color] — 70 entries here + 1 bank = 71 buildings total
  // (8 towers + 16 mid-rise + 12 corridor x=0 + 10 corridor x=40 +
  // 8 Old Mercado + 6 warehouses + 10 houses). Counted by building().
  var BUILDINGS = [
    // Downtown towers (8)
    [60, -60, 18, 55, 18, 0x6a7a9a], [84, -44, 16, 42, 16, 0x7a6a8a],
    [40, -76, 20, 48, 18, 0x5a6a7a], [100, -70, 14, 60, 14, 0x8a7a6a],
    [64, -24, 16, 36, 16, 0x6a8a7a], [92, -16, 14, 30, 14, 0x9a8a6a],
    [28, -56, 18, 38, 16, 0x7a8a9a], [108, -40, 16, 44, 16, 0x6a6a8a],
    // Mid-rise Deco Row / Downtown / Palmetto (16)
    [64, 8, 14, 18, 12, 0xff9a6a], [88, 4, 12, 15, 12, 0xffb36b],
    [112, 12, 14, 20, 12, 0x6affb3], [136, 0, 12, 16, 12, 0xff6a9a],
    [60, 28, 14, 14, 12, 0x9a6aff], [84, 32, 12, 18, 12, 0x6ac8ff],
    [108, 28, 14, 15, 12, 0xffd27a], [132, 36, 12, 17, 12, 0x7aff9a],
    [-72, -8, 14, 16, 12, 0xff8a7a], [-96, -4, 12, 14, 12, 0x8a7aff],
    [-72, -44, 14, 18, 12, 0x6aff8a], [-96, -48, 12, 15, 12, 0xffc86a],
    [-72, 76, 14, 16, 12, 0x7a9aff], [-96, 72, 12, 14, 12, 0xff7a9a],
    [64, 68, 14, 15, 12, 0x9aff6a], [88, 72, 12, 17, 12, 0x6a9aff],
    // Corridor x=0, facades at |x| = 13 - w/2 >= 7.5 (12)
    [-13, -76, 10, 12, 12, 0xd98a5a], [13, -76, 10, 14, 12, 0x5a8ad9],
    [-13, -44, 10, 10, 12, 0x8ad95a], [13, -44, 10, 13, 12, 0xd95a8a],
    [-13, 8, 10, 12, 12, 0x5ad9a8], [13, 8, 10, 11, 12, 0xd9a85a],
    [-13, 68, 10, 12, 12, 0x8a5ad9], [13, 68, 10, 14, 12, 0x5ad98a],
    [-13, 96, 10, 10, 12, 0xd95a5a], [13, 96, 10, 12, 12, 0x5a9ad9],
    [-13, -108, 10, 13, 12, 0xa8d95a], [13, -108, 10, 11, 12, 0xd95a8a],
    // Corridor x=40, facades at |x-40| = 13 - w/2 >= 7.5 (10)
    [27, -76, 10, 12, 12, 0xc9a85a], [53, -76, 10, 14, 12, 0x5a8ac9],
    [27, -44, 10, 11, 12, 0xa85ac9], [53, -44, 10, 13, 12, 0xc95a8a],
    [27, 8, 10, 12, 12, 0x8ac9a8], [53, 8, 10, 10, 12, 0xc9a85a],
    [27, 68, 10, 14, 12, 0x5a8ad9], [53, 68, 10, 12, 12, 0x8ad95a],
    [27, 116, 10, 11, 12, 0xd9c95a], [53, 116, 10, 13, 12, 0x9a5ad9],
    // Old Mercado (8)
    [-56, 44, 12, 9, 10, 0xd9a05a], [-72, 56, 10, 8, 10, 0x5ad9a0],
    [-48, 72, 12, 10, 10, 0xa05ad9], [-64, 88, 10, 8, 10, 0xd95aa0],
    [-100, 40, 12, 9, 10, 0x5a9ad9], [-112, 64, 10, 10, 10, 0xd9a05a],
    [-40, 96, 12, 8, 10, 0x9ad95a], [-56, 112, 10, 9, 10, 0x5ad9d9],
    // Marina / Bayline warehouses (6)
    [-132, -64, 16, 8, 12, 0x8a9aa0], [-148, -84, 14, 7, 12, 0xa08a9a],
    [-132, -104, 16, 8, 12, 0x9aa08a], [132, 152, 16, 9, 12, 0x8a9aa0],
    [156, 148, 14, 8, 12, 0xa08a9a], [144, 172, 16, 7, 12, 0x9aa08a],
    // Keystone Field / Palmetto houses (10)
    [128, 84, 10, 7, 10, 0xe8b48a], [148, 76, 10, 8, 10, 0x8ae8b4],
    [168, 88, 10, 7, 10, 0xb48ae8], [140, 108, 10, 8, 10, 0xe8d48a],
    [160, 112, 10, 7, 10, 0x8ad4e8], [120, 120, 10, 8, 10, 0xd48ae8],
    [176, 64, 10, 7, 10, 0xe8a08a], [-32, 132, 10, 8, 10, 0x8ae8a0],
    [-56, 148, 10, 7, 10, 0xa0e88a], [-24, 164, 10, 8, 10, 0xe8b48a]
  ];

  // ---------- palms / neons / lamps / props ----------
  function palm(x, z) {
    var grp = new THREE.Group();
    var trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.32, 5.5, 6), lambert(0x7a5a3a));
    trunk.position.y = 2.75;
    grp.add(trunk);
    var top = new THREE.Mesh(
      new THREE.SphereGeometry(2.1, 8, 6), lambert(0x2a7a3a));
    top.scale.y = 0.45;
    top.position.y = 5.9;
    grp.add(top);
    grp.position.set(x, 0, z);
    _scene.add(grp);
    C.counts.palms++;
    return grp;
  }

  function neon(text, x, y, z, ry, bg, fg) {
    var m = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 3),
      new THREE.MeshBasicMaterial({ map: neonTexture(text, bg, fg) })
    );
    m.position.set(x, y, z);
    m.rotation.y = ry;
    _scene.add(m);
    C.counts.neons++;
    return m;
  }

  function lamp(x, z) {
    var pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 6, 6), lambert(0x222226));
    pole.position.set(x, 3, z);
    _scene.add(pole);
    var head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    head.position.set(x, 6.1, z);
    _scene.add(head);
    C.counts.props++;
  }

  // parked car (faces +x, like traffic cars). Returns the group.
  function parkedCar(x, z, color, ry) {
    var grp = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.85, 1.9), lambert(color));
    body.position.y = 0.55;
    grp.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1.7), lambert(0x1c2430));
    cabin.position.set(-0.2, 1.25, 0);
    grp.add(cabin);
    grp.position.set(x, 0, z);
    if (ry) grp.rotation.y = ry;
    _scene.add(grp);
    C.counts.props++;
    return grp;
  }

  // market stall: counter + striped awning + goods (foreground onfoot)
  function stall(x, z, ry) {
    var grp = new THREE.Group();
    var counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 1.3), lambert(0x8a5a2a));
    counter.position.y = 0.5;
    grp.add(counter);
    var awn = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, 1.8),
      new THREE.MeshLambertMaterial({ color: 0xe84a5a, side: THREE.DoubleSide }));
    awn.position.set(0, 2.1, 0);
    awn.rotation.x = -0.5;
    grp.add(awn);
    var pole1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.1, 6), lambert(0x444444));
    pole1.position.set(-1.3, 1.05, 0.6);
    grp.add(pole1);
    var pole2 = pole1.clone();
    pole2.position.x = 1.3;
    grp.add(pole2);
    var goods = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.35, 0.9),
      lambert(SB.randPick([0xff6a3a, 0x6aff3a, 0xffd23a, 0x3aff6a])));
    goods.position.y = 1.2;
    grp.add(goods);
    grp.position.set(x, 0, z);
    if (ry) grp.rotation.y = ry;
    _scene.add(grp);
    C.counts.props++;
    return grp;
  }

  function bench(x, z, ry) {
    var grp = new THREE.Group();
    var seat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.55), lambert(0x6a4a2a));
    seat.position.y = 0.5;
    grp.add(seat);
    var back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 0.1), lambert(0x6a4a2a));
    back.position.set(0, 0.85, -0.25);
    grp.add(back);
    grp.position.set(x, 0, z);
    if (ry) grp.rotation.y = ry;
    _scene.add(grp);
    C.counts.props++;
    return grp;
  }

  function roadblock(x, z, ry) {
    var m = box(3.2, 1.0, 0.25,
      new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }), x, 0.5, z, ry);
    var stripe = box(3.2, 0.3, 0.26,
      new THREE.MeshLambertMaterial({ color: 0xe83a2a }), x, 0.7, z, ry);
    C.counts.props += 1;
    return m;
  }

  function umbrella(x, z) {
    var pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), lambert(0xe8e8e8));
    pole.position.set(x, 1.2, z);
    _scene.add(pole);
    var top = new THREE.Mesh(
      new THREE.ConeGeometry(1.8, 0.8, 8),
      lambert(SB.randPick([0xff5a7a, 0x3a9aff, 0xffd23a])));
    top.position.set(x, 2.7, z);
    _scene.add(top);
    C.counts.props++;
  }

  // ---------- peds + traffic ----------
  var SHIRTS = [0xe84a5a, 0x3a9aff, 0xffd23a, 0x6aff3a, 0x9a5aff, 0xffffff, 0x3aff6a, 0xff8a3a];
  var SKINS = [0xd9a066, 0xb87a4a, 0x8a5a3a, 0xe8b88a];

  function ped(bx, bz, axis) {
    var grp = new THREE.Group();
    var shirt = SB.randPick(SHIRTS);
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 1.15, 8), lambert(shirt));
    body.position.y = 0.85;
    grp.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), lambert(SB.randPick(SKINS)));
    head.position.y = 1.65;
    grp.add(head);
    var phase = SB.randRange(0, 6.28);
    grp.userData.bx = bx; grp.userData.bz = bz; grp.userData.axis = axis;
    // walk speed derived from walkPhase (no fresh random) — API.md §4
    grp.userData.sp = 0.5 + ((phase * 7) % 1) * 1.0;
    grp.userData.walkPhase = phase;
    grp.position.set(bx, 0, bz);
    _scene.add(grp);
    C.peds.push(grp);
    return grp;
  }

  var CAR_COLORS = [0xd93a3a, 0x3a7ad9, 0xd9d23a, 0x3ad97a, 0xe8e8e8, 0x2a2a2e, 0xd97a3a, 0x7a3ad9];
  function trafficCar(axis, lane, dir, speed, base, min, span) {
    var grp = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.85, 1.9), lambert(SB.randPick(CAR_COLORS)));
    body.position.y = 0.55;
    grp.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1.7), lambert(0x1c2430));
    cabin.position.set(-0.2, 1.25, 0);
    grp.add(cabin);
    grp.userData.axis = axis; grp.userData.lane = lane; grp.userData.dir = dir;
    grp.userData.speed = speed; grp.userData.base = base;
    grp.userData.min = min; grp.userData.span = span;
    _scene.add(grp);
    C.traffic.push(grp);
    return grp;
  }

  // ---------- build ----------
  C.build = function (scene) {
    if (_built) return;
    _built = true;
    _scene = scene;

    // ground (city slab + beach sand + sea)
    flat(420, 380, lambert(0x9a8f66), 20, 0, 40);
    flat(50, 380, lambert(0xd9c08a), -165, 0.03, 40);   // beach
    flat(130, 380, lambert(0x2a7fa8, { transparent: true, opacity: 0.85 }), -215, 0.05, 40); // sea

    // roads + sidewalks + dashed centre lines (texture, repeated)
    var rt = roadTexture();
    for (var i = 0; i < ROAD_X.length; i++) {
      var rx = ROAD_X[i];
      var road = flat(8, 320, new THREE.MeshLambertMaterial({ map: rt }), rx, 0.02, 40);
      road.material.map = rt.clone();
      road.material.map.needsUpdate = true;
      road.material.map.repeat.set(1, 10);
      flat(3, 320, lambert(0x8f8a80), rx - 5.5, 0.04, 40);
      flat(3, 320, lambert(0x8f8a80), rx + 5.5, 0.04, 40);
    }
    for (var j = 0; j < ROAD_Z.length; j++) {
      var rz = ROAD_Z[j];
      var road2 = flat(360, 8, new THREE.MeshLambertMaterial({ map: rt }), 20, 0.02, rz);
      road2.material.map = rt.clone();
      road2.material.map.needsUpdate = true;
      road2.material.map.repeat.set(1, 11);
      road2.rotation.z = Math.PI / 2;
      flat(360, 3, lambert(0x8f8a80), 20, 0.04, rz - 5.5);
      flat(360, 3, lambert(0x8f8a80), 20, 0.04, rz + 5.5);
    }

    // zebra crossing on road x=0 at z=47.5 (onfoot spawn intersection)
    for (var zb = 0; zb < 5; zb++) {
      box(7.6, 0.05, 0.9, lambert(0xf5f5f0), 0, 0.06, 46.3 + zb * 0.6);
    }

    // 71 buildings
    for (var b = 0; b < BUILDINGS.length; b++) {
      var bd = BUILDINGS[b];
      building(bd[0], bd[1], bd[2], bd[3], bd[4], bd[5]);
    }
    // bank (26x14x14 at (20,-20), exempt from the corridor clamp — API.md §4)
    building(20, -20, 26, 14, 14, 0x2a4a6a, { bank: true });

    // bank sign: freestanding, 24x6 plane, texture 2048x512, full text
    var sign = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 6),
      new THREE.MeshBasicMaterial({ map: bankTexture(), side: THREE.DoubleSide })
    );
    sign.position.set(C.bank.pos[0], C.bank.pos[1], C.bank.pos[2]);
    sign.rotation.y = C.bank.rotY;
    _scene.add(sign);
    // sign posts
    var postMat = lambert(0x3a3a3a);
    var p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 7, 8), postMat);
    p1.position.set(-4, 3.5, 2.5); _scene.add(p1);
    var p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 7, 8), postMat);
    p2.position.set(8, 3.5, -6.5); _scene.add(p2);

    // palms (42): foreground onfoot + beach + Deco Row + park
    palm(9, 22); palm(6, 46);                       // onfoot foreground
    // (9,22) sits OUTSIDE the bank-sign sightline wedge from the onfoot
    // camera and outside the mission camera frame (was 6,22: foliage
    // clipped the sign's last letter and blobbed the mission right edge)
    palm(-6, 24); palm(-6, 48);
    palm(46, 22); palm(46, 46); palm(34, 30);
    palm(-146, 20); palm(-146, 60); palm(-146, 100); palm(-146, -20); palm(-146, -60);
    palm(66, -8); palm(90, 12); palm(114, 20); palm(138, 8);
    palm(-66, 16); palm(-90, 12); palm(-66, 84); palm(-90, 88);
    palm(66, 52); palm(90, 56); palm(114, 60); palm(138, 52);
    palm(-6, -52); palm(6, -68); palm(-6, 84); palm(6, 108);
    palm(46, -52); palm(34, -68); palm(46, 84); palm(34, 108);
    palm(126, 100); palm(150, 96); palm(166, 116); palm(130, 124);
    palm(-146, 140); palm(-146, 180); palm(-146, -100); palm(-146, 160);
    palm(66, 116); palm(90, 120);

    // neons (14)
    neon('NEON MILE', -13, 8, -52, Math.PI / 2, '#1a0a2a', '#ff3aff');
    neon('PALMS', 13, 7, -60, -Math.PI / 2, '#0a2a1a', '#3aff8a');
    neon('SOLMAR', 27, 8, -52, Math.PI / 2, '#2a1a0a', '#ffd23a');
    neon('TACOS', -13, 6, 20, Math.PI / 2, '#3a0a0a', '#ff6a3a');
    neon('HOTEL', 53, 9, 20, -Math.PI / 2, '#0a1a3a', '#3a9aff');
    neon('CASINO', 64, 10, -8, 0, '#2a0a2a', '#ff3a9a');
    neon('BAY 96.5', 88, 8, 16, 0, '#0a2a2a', '#3affd9');
    neon('WAVE 88.1', -72, 8, -20, 0, '#1a2a0a', '#d9ff3a');
    neon('DRIVE-IN', 112, 8, 0, 0, '#2a0a1a', '#ff5a5a');
    neon('MOTEL', -96, 7, 8, 0, '#0a1a2a', '#5ad9ff');
    neon('PIER 9', -132, 6, -52, Math.PI / 2, '#0a2a3a', '#3ad9ff');
    neon('CORAL', -13, 7, 80, Math.PI / 2, '#3a1a0a', '#ff9a3a');
    neon('SUNSET', 27, 7, 80, Math.PI / 2, '#2a0a3a', '#ff8a5a');
    neon('KEYS', 53, 7, 80, -Math.PI / 2, '#0a3a1a', '#5aff8a');

    // street lamps along the showcase roads
    var lampZ = [-100, -60, -20, 20, 60, 100, 140, 180];
    for (var lz = 0; lz < lampZ.length; lz++) {
      lamp(-6, lampZ[lz]); lamp(6, lampZ[lz] + 10);
      lamp(34, lampZ[lz]); lamp(46, lampZ[lz] + 10);
    }
    lamp(-126, -20); lamp(-126, 60); lamp(-86, 100); lamp(86, -60);

    // foreground props, onfoot (road x=0, spawn (0,40))
    stall(4, 26, Math.PI / 2); stall(4, 34, Math.PI / 2); stall(4, 42, Math.PI / 2);
    parkedCar(-4, 30, 0xd93a3a, Math.PI / 2);
    parkedCar(-4, 40, 0x3a7ad9, Math.PI / 2);
    // more parked cars around the city
    parkedCar(46, 30, 0xd9d23a, -Math.PI / 2);
    parkedCar(-6, -30, 0x3ad97a, 0);
    parkedCar(34, -30, 0xe8e8e8, Math.PI);
    parkedCar(-46, 52, 0x2a2a2e, Math.PI / 2);
    parkedCar(66, 44, 0xd97a3a, 0);
    parkedCar(126, 92, 0x7a3ad9, -Math.PI / 2);
    parkedCar(-66, 68, 0xd93a6a, Math.PI);
    // benches + roadblocks near the bank / mission area
    bench(6, 14, Math.PI / 2); bench(-6, 18, -Math.PI / 2);
    bench(6, 52, Math.PI / 2); bench(46, 38, -Math.PI / 2);
    roadblock(2, 16, 0); roadblock(-2, 18, 0);
    roadblock(6, 2, Math.PI / 2); roadblock(-4, -6, 0);
    // beach umbrellas
    umbrella(-155, 20); umbrella(-158, 60); umbrella(-155, 100);
    umbrella(-158, -40); umbrella(-155, 140); umbrella(-158, 180);

    // marina docks + boats (west water)
    var dockMat = lambert(0x6a4a2a);
    for (var dk = 0; dk < 3; dk++) {
      box(2.5, 0.4, 30, dockMat, -152, 0.25, -60 + dk * 20);
    }
    var boatCols = [0xe8e8e8, 0x3a7ad9, 0xd93a3a];
    for (var bt = 0; bt < 3; bt++) {
      var boat = new THREE.Group();
      var hull = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 2.4), lambert(boatCols[bt]));
      hull.position.y = 0.6;
      boat.add(hull);
      var cab = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.0, 2.0), lambert(0x1c2430));
      cab.position.set(-0.5, 1.6, 0);
      boat.add(cab);
      boat.position.set(-168, 0.1, -55 + bt * 20);
      _scene.add(boat);
      C.counts.props++;
    }

    // peds (20) on sidewalks
    ped(-5.5, 24, 'z'); ped(5.5, 30, 'z'); ped(-5.5, 44, 'z'); ped(5.5, 52, 'z');
    ped(-5.5, -12, 'z'); ped(5.5, -28, 'z'); ped(-5.5, 72, 'z'); ped(5.5, 88, 'z');
    ped(34.5, 24, 'z'); ped(45.5, 36, 'z'); ped(34.5, -16, 'z'); ped(45.5, 56, 'z');
    ped(-20, 65.5, 'x'); ped(24, 65.5, 'x'); ped(-60, -14.5, 'x'); ped(70, -14.5, 'x');
    ped(-20, 105.5, 'x'); ped(30, 25.5, 'x'); ped(-90, 45.5, 'x'); ped(100, 105.5, 'x');

    // traffic (24): 12 along N-S roads (axis x? no — cars travel ALONG z on
    // N-S roads, so axis 'z', lane = road x +/- 2), 12 along E-W roads.
    var nsRoads = [0, 40, -40, 80, -80, 120];
    for (var n1 = 0; n1 < 12; n1++) {
      var rx2 = nsRoads[n1 % nsRoads.length];
      var dir1 = n1 % 2 === 0 ? 1 : -1;
      trafficCar('z', rx2 + (dir1 > 0 ? 2 : -2), dir1,
        SB.randRange(8, 18), SB.randRange(0, 320), -120, 320);
    }
    var ewRoads = [20, 60, -20, 100, -60, 140];
    for (var n2 = 0; n2 < 12; n2++) {
      var rz2 = ewRoads[n2 % ewRoads.length];
      var dir2 = n2 % 2 === 0 ? 1 : -1;
      trafficCar('x', rz2 + (dir2 > 0 ? 2 : -2), dir2,
        SB.randRange(8, 18), SB.randRange(0, 360), -160, 360);
    }

    C.counts.traffic = C.traffic.length;
    C.counts.peds = C.peds.length;

    // settle traffic + peds at their simTime=0 positions, so the very first
    // rendered frame is already correct (before step() ever runs)
    for (var ti = 0; ti < C.traffic.length; ti++) {
      var tcar = C.traffic[ti], tu = tcar.userData;
      var tm = ((tu.base % tu.span) + tu.span) % tu.span;
      if (tu.axis === 'x') {
        tcar.position.x = tu.min + tm; tcar.position.z = tu.lane;
        tcar.rotation.y = tu.dir > 0 ? 0 : Math.PI;
      } else {
        tcar.position.z = tu.min + tm; tcar.position.x = tu.lane;
        tcar.rotation.y = tu.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
    }
    for (var pi = 0; pi < C.peds.length; pi++) {
      var tped = C.peds[pi], pu = tped.userData;
      var off0 = Math.sin(pu.walkPhase) * 6;
      if (pu.axis === 'x') { tped.position.x = pu.bx + off0; tped.position.z = pu.bz; }
      else { tped.position.z = pu.bz + off0; tped.position.x = pu.bx; }
    }
  };
})();
