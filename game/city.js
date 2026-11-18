(function () {
  'use strict';

  var SB = window.SB = window.SB || {};
  var city = SB.city = SB.city || {};

  var WORLD = { minX: -560, maxX: 470, minZ: -470, maxZ: 530 };

  var DISTRICTS = [
    { id: 'downtown', name: 'Downtown', x0: -150, z0: -150, x1: 150, z1: 150, tint: 0x8a9ab0 },
    { id: 'coral-strand', name: 'Coral Strand', x0: -560, z0: -450, x1: -450, z1: 450, tint: 0xe8d5a8 },
    { id: 'marina', name: 'Pelican Marina', x0: -450, z0: 350, x1: -50, z1: 520, tint: 0x2a7fa8 },
    { id: 'mercado', name: 'Old Mercado', x0: 150, z0: -150, x1: 450, z1: 150, tint: 0xd08050 },
    { id: 'neon-mile', name: 'Neon Mile', x0: -350, z0: -450, x1: 350, z1: -340, tint: 0xff2a7a },
    { id: 'palmetto', name: 'Palmetto Heights', x0: 150, z0: -450, x1: 450, z1: -150, tint: 0x7aa85a },
    { id: 'deco-row', name: 'Deco Row', x0: -450, z0: -350, x1: -150, z1: -150, tint: 0xd8a0b8 },
    { id: 'bayline', name: 'Bayline Docks', x0: -50, z0: 350, x1: 450, z1: 520, tint: 0x7a7a7a },
    { id: 'keystone', name: 'Keystone Field', x0: -150, z0: 150, x1: 150, z1: 350, tint: 0x5a8a4a }
  ];

  var ROADS = [
    { id: 'ave-coral', axis: 'z', at: -400, from: -450, to: 450, width: 14, name: 'Coral Ave' },
    { id: 'ave-flamingo', axis: 'z', at: -300, from: -450, to: 450, width: 14, name: 'Flamingo Blvd' },
    { id: 'ave-palmetto', axis: 'z', at: -200, from: -450, to: 450, width: 14, name: 'Palmetto Ave' },
    { id: 'ave-bayline', axis: 'z', at: -100, from: -450, to: 450, width: 14, name: 'Bayline Ave' },
    { id: 'ave-solmar', axis: 'z', at: 0, from: -450, to: 450, width: 14, name: 'Solmar Ave' },
    { id: 'ave-deco', axis: 'z', at: 100, from: -450, to: 450, width: 14, name: 'Deco Row' },
    { id: 'ave-mercado', axis: 'z', at: 200, from: -450, to: 450, width: 14, name: 'Mercado Ave' },
    { id: 'ave-keystone', axis: 'z', at: 300, from: -450, to: 450, width: 14, name: 'Keystone Ave' },
    { id: 'ave-pelican', axis: 'z', at: 400, from: -450, to: 450, width: 14, name: 'Pelican Way' },
    { id: 'st-sunset', axis: 'x', at: -400, from: -450, to: 450, width: 14, name: 'Sunset St' },
    { id: 'st-neon', axis: 'x', at: -300, from: -450, to: 450, width: 14, name: 'Neon Mile' },
    { id: 'st-palmetto', axis: 'x', at: -200, from: -450, to: 450, width: 14, name: 'Palmetto St' },
    { id: 'st-flamingo', axis: 'x', at: -100, from: -450, to: 450, width: 14, name: 'Flamingo St' },
    { id: 'st-solmar', axis: 'x', at: 0, from: -450, to: 450, width: 14, name: 'Solmar St' },
    { id: 'st-mercado', axis: 'x', at: 100, from: -450, to: 450, width: 14, name: 'Mercado St' },
    { id: 'st-bayline', axis: 'x', at: 200, from: -450, to: 450, width: 14, name: 'Bayline St' },
    { id: 'st-keystone', axis: 'x', at: 300, from: -450, to: 450, width: 14, name: 'Keystone St' },
    { id: 'st-pelican', axis: 'x', at: 400, from: -450, to: 450, width: 14, name: 'Pelican St' }
  ];

  var LANDMARKS = [
    { id: 'bank', name: 'Solmar National Bank', kind: 'bank', x: 50, z: -50 },
    { id: 'hospital', name: 'St. Coral Hospital', kind: 'hospital', x: -150, z: 250 },
    { id: 'police', name: 'Solmar PD HQ', kind: 'police', x: 150, z: 150 },
    { id: 'hotel', name: 'Hotel Palmera', kind: 'hotel', x: -480, z: 0 },
    { id: 'garage', name: "Jax's Garage", kind: 'garage', x: 350, z: 450 },
    { id: 'safehouse', name: "Mara's Safehouse", kind: 'safehouse', x: 350, z: -250 },
    { id: 'respray', name: 'Neon Respray', kind: 'respray', x: 50, z: -350 },
    { id: 'books', name: 'FARO BOOKS', kind: 'shop', x: 250, z: 50 },
    { id: 'gym', name: 'MANGO GYM', kind: 'shop', x: 250, z: 150 },
    { id: 'cafe', name: 'TIDELINE CAFE', kind: 'shop', x: -480, z: 150 },
    { id: 'shoes', name: 'ZAPATOS ALBA', kind: 'shop', x: 350, z: -50 },
    { id: 'pharmacy', name: 'FARMACIA SOL', kind: 'shop', x: -250, z: -250 },
    { id: 'club', name: 'CLUB VOLTAGE', kind: 'club', x: -50, z: -350 }
  ];

  var SPAWNS = {
    player: { x: 0, z: 60, heading: 0 },
    vehicles: [
      { kind: 'sport', name: 'VENTO STRADA', x: 8, z: 60, heading: 0 },
      { kind: 'sedan', name: 'PALMERA LX', x: -8, z: -40, heading: Math.PI },
      { kind: 'taxi', name: 'SOLMAR CAB', x: 108, z: 150, heading: Math.PI / 2 },
      { kind: 'muscle', name: 'SOLMAR GT', x: -92, z: -150, heading: 0 },
      { kind: 'van', name: 'MERCADO VAN', x: 250, z: 60, heading: -Math.PI / 2 },
      { kind: 'truck', name: 'BAYLINE HAULER', x: 350, z: 450, heading: Math.PI },
      { kind: 'sport', name: 'VENTO STRADA', x: -450, z: 100, heading: Math.PI / 2 },
      { kind: 'sedan', name: 'PALMERA LX', x: 50, z: -350, heading: Math.PI },
      { kind: 'muscle', name: 'SOLMAR GT', x: -250, z: -250, heading: 0 },
      { kind: 'taxi', name: 'SOLMAR CAB', x: 150, z: 250, heading: -Math.PI / 2 }
    ],
    missions: {
      bank: { x: 50, z: -50, name: 'Solmar National Bank' },
      marina: { x: -250, z: 450, name: 'Pelican Marina' },
      mercado: { x: 350, z: 50, name: 'Old Mercado' },
      hotel: { x: -480, z: 0, name: 'Hotel Palmera' },
      garage: { x: 350, z: 450, name: "Jax's Garage" },
      hospital: { x: -150, z: 250, name: 'St. Coral Hospital' },
      police: { x: 150, z: 150, name: 'Solmar PD HQ' },
      neon: { x: -50, z: -350, name: 'Neon Mile' }
    },
    shops: [
      { id: 'books', kind: 'shop', name: 'FARO BOOKS', x: 250, z: 50 },
      { id: 'gym', kind: 'shop', name: 'MANGO GYM', x: 250, z: 150 },
      { id: 'cafe', kind: 'shop', name: 'TIDELINE CAFE', x: -480, z: 150 },
      { id: 'shoes', kind: 'shop', name: 'ZAPATOS ALBA', x: 350, z: -50 },
      { id: 'pharmacy', kind: 'shop', name: 'FARMACIA SOL', x: -250, z: -250 },
      { id: 'club', kind: 'club', name: 'CLUB VOLTAGE', x: -50, z: -350 }
    ],
    safehouse: { x: 350, z: -250, name: "Mara's Safehouse" },
    respray: { x: 50, z: -350, name: 'Neon Respray' },
    hospital: { x: -150, z: 250, name: 'St. Coral Hospital' },
    police: { x: 150, z: 150, name: 'Solmar PD HQ' },
    heliPad: { x: 150, z: 150, y: 42 }
  };

  city.districts = DISTRICTS;
  city.roads = ROADS;
  city.landmarks = LANDMARKS;
  city.spawnPoints = function () { return SPAWNS; };
  city.districtAt = function (x, z) { return SB.districtAt(x, z); };
  city.roadNameAt = function (x, z) { return SB.streetAt(x, z); };

  var M = null;
  var GEO = null;

  function buildMaterials() {
    if (M) return M;
    var L = THREE.MeshLambertMaterial;
    var B = THREE.MeshBasicMaterial;
    M = {
      asphalt: new L({ color: 0x2e3236 }),
      sidewalk: new L({ color: 0x8f8a80 }),
      sand: new L({ color: 0xe8d5a8 }),
      water: new L({ color: 0x2a7fa8 }),
      grass: new L({ color: 0x5a8a4a }),
      concrete: new L({ color: 0x9a938a }),
      groundBase: new L({ color: 0x5a6355 }),
      roof: new L({ color: 0x54503f }),
      glass: new L({ color: 0x2a3a4a }),
      trunk: new L({ color: 0x8a6a42 }),
      palmLeaf: new L({ color: 0x3a8a3a }),
      treeLeaf: new L({ color: 0x4a7a3a }),
      lampPole: new L({ color: 0x3a3a3a }),
      lampHead: new B({ color: 0xffe8a0 }),
      white: new L({ color: 0xf0ead8 }),
      hospitalWhite: new L({ color: 0xe8e8e8 }),
      policeBlue: new L({ color: 0x4a6a9a }),
      bankStone: new L({ color: 0xd8c8b0 }),
      hotelPink: new L({ color: 0xe8a8b8 }),
      garageGray: new L({ color: 0x7a7a7a }),
      neonPink: new B({ color: 0xff2a7a }),
      neonCyan: new B({ color: 0x2ad4ff }),
      neonYellow: new B({ color: 0xffd42a }),
      neonPurple: new B({ color: 0xa42aff }),
      headlight: new B({ color: 0xfff2c0 }),
      taillight: new B({ color: 0xff2a2a }),
      tire: new L({ color: 0x1a1a1a }),
      skinTones: [0xc98a5a, 0x8a5a3a, 0xe8b88a, 0x6a4a2a].map(function (c) { return new L({ color: c }); }),
      shirtColors: [0xd84a4a, 0x4a7ad8, 0x4ad84a, 0xd8d84a, 0xd84ad8, 0xffffff, 0x2a2a2a, 0xff8c42].map(function (c) { return new L({ color: c }); }),
      carColors: [0xd83a3a, 0x3a6ad8, 0xd8d83a, 0x3ad83a, 0xff5a8a, 0xff8c42, 0xffffff, 0x2a2a2a, 0x7a3ad8].map(function (c) { return new L({ color: c }); }),
      buildingPalette: [0xd8c8b0, 0xc8b8a0, 0xb8a888, 0xa89a90, 0x8a9ab0, 0xd0a080, 0xe0d0c0, 0x6a7a8a, 0xc8a0a0, 0xa0b8a0].map(function (c) { return new L({ color: c }); })
    };
    GEO = {
      box: new THREE.BoxGeometry(1, 1, 1),
      wheel: new THREE.CylinderGeometry(0.35, 0.35, 0.3, 10),
      pedHead: new THREE.SphereGeometry(0.21, 10, 8),
      trunk: new THREE.CylinderGeometry(0.16, 0.28, 5, 5),
      palmCrown: new THREE.IcosahedronGeometry(1.7, 0),
      treeCrown: new THREE.SphereGeometry(2.2, 8, 6),
      lampPole: new THREE.CylinderGeometry(0.08, 0.1, 5.5, 6),
      roofPyramid: new THREE.ConeGeometry(1, 1, 4),
      sunDisc: new THREE.CircleGeometry(42, 24),
      cloudPuff: new THREE.SphereGeometry(1, 8, 6)
    };
    return M;
  }

  function box(mat, w, h, d, x, y, z, parent) {
    var m = new THREE.Mesh(GEO.box, mat);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    (parent || SB.world.groups.buildings).add(m);
    return m;
  }

  var facadeCache = {};
  city.makeFacadeTexture = function (base, win, cols, rows, litRatio) {
    var key = base + '|' + win + '|' + cols + '|' + rows + '|' + litRatio;
    if (facadeCache[key]) return facadeCache[key];
    var cv = document.createElement('canvas');
    cv.width = 128; cv.height = 256;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#' + ('000000' + base.toString(16)).slice(-6);
    ctx.fillRect(0, 0, 128, 256);
    var cw = 128 / cols, ch = 256 / rows;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var lit = SB.rng() < litRatio;
        ctx.fillStyle = lit ? '#ffd88a' : '#' + ('000000' + win.toString(16)).slice(-6);
        ctx.fillRect(c * cw + 3, r * ch + 4, cw - 6, ch - 8);
      }
    }
    var tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    facadeCache[key] = tex;
    return tex;
  };

  function facadeMaterial(base, win, cols, rows, lit) {
    var tex = city.makeFacadeTexture(base, win, cols, rows, lit);
    return new THREE.MeshLambertMaterial({ map: tex });
  }

  function signPlane(text, w, h, opts) {
    opts = opts || {};
    var tex = SB.makeTextTexture(text, {
      w: opts.tw || 512, h: opts.th || 128,
      fg: opts.fg || '#ffffff', bg: opts.bg || null,
      font: opts.font || ('bold ' + Math.floor((opts.th || 128) * 0.42) + 'px Arial, sans-serif')
    });
    var mat = opts.neon
      ? new THREE.MeshBasicMaterial({ map: tex, transparent: true })
      : new THREE.MeshLambertMaterial({ map: tex, transparent: true, emissive: 0x222222 });
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(opts.x || 0, opts.y || 0, opts.z || 0);
    if (opts.ry !== undefined) m.rotation.y = opts.ry;
    if (opts.rx !== undefined) m.rotation.x = opts.rx;
    return m;
  }

  function addSignToGroup(group, text, w, h, opts) {
    var s = signPlane(text, w, h, opts);
    group.add(s);
    return s;
  }

  city.buildGround = function () {
    var g = SB.world.groups.city;
    var base = new THREE.Mesh(new THREE.PlaneGeometry(1120, 1120), M.groundBase);
    base.rotation.x = -Math.PI / 2;
    base.position.set(-40, 0, 0);
    base.receiveShadow = true;
    g.add(base);
  };

  city.buildOcean = function () {
    var g = SB.world.groups.city;
    var ocean = new THREE.Mesh(new THREE.PlaneGeometry(420, 1060), M.water);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(-770, 0.01, 0);
    ocean.receiveShadow = true;
    g.add(ocean);
  };

  city.buildRoads = function () {
    var g = SB.world.groups.roads;
    var i, r, mesh;
    for (i = 0; i < ROADS.length; i++) {
      r = ROADS[i];
      var len = r.to - r.from;
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(r.axis === 'x' ? len : r.width, r.axis === 'x' ? r.width : len), M.asphalt);
      mesh.rotation.x = -Math.PI / 2;
      if (r.axis === 'x') mesh.position.set((r.from + r.to) / 2, 0.02, r.at);
      else mesh.position.set(r.at, 0.02, (r.from + r.to) / 2);
      mesh.receiveShadow = true;
      g.add(mesh);
    }

    var dashGeo = new THREE.BoxGeometry(0.3, 0.04, 3);
    var dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c84a });
    var count = 0;
    for (i = 0; i < ROADS.length; i++) { count += Math.floor((ROADS[i].to - ROADS[i].from) / 16); }
    var inst = new THREE.InstancedMesh(dashGeo, dashMat, count);
    var m4 = new THREE.Matrix4();
    var idx = 0;
    for (i = 0; i < ROADS.length; i++) {
      r = ROADS[i];
      for (var s = r.from + 8; s < r.to - 4; s += 16) {
        if (r.axis === 'x') m4.makeRotationY(Math.PI / 2);
        else m4.makeRotationY(0);
        m4.setPosition(r.axis === 'x' ? s : r.at, 0.05, r.axis === 'x' ? r.at : s);
        inst.setMatrixAt(idx++, m4);
      }
    }
    inst.count = idx;
    inst.receiveShadow = true;
    g.add(inst);
  };

  city.buildSidewalks = function () {
    var g = SB.world.groups.roads;
    for (var i = 0; i < ROADS.length; i++) {
      var r = ROADS[i];
      var len = r.to - r.from;
      for (var side = -1; side <= 1; side += 2) {
        var off = side * (r.width / 2 + 2);
        var mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(r.axis === 'x' ? len : 4, r.axis === 'x' ? 4 : len), M.sidewalk);
        mesh.rotation.x = -Math.PI / 2;
        if (r.axis === 'x') mesh.position.set((r.from + r.to) / 2, 0.04, r.at + off);
        else mesh.position.set(r.at + off, 0.04, (r.from + r.to) / 2);
        mesh.receiveShadow = true;
        g.add(mesh);
      }
    }
  };

  city.buildBeach = function () {
    var g = SB.world.groups.city;
    var sand = new THREE.Mesh(new THREE.PlaneGeometry(112, 920), M.sand);
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(-505, 0.03, 0);
    sand.receiveShadow = true;
    g.add(sand);

    var walk = new THREE.Mesh(new THREE.PlaneGeometry(8, 900), M.concrete);
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(-447, 0.04, 0);
    walk.receiveShadow = true;
    g.add(walk);

    var colors = [0xff5a5a, 0x2ad4ff, 0xffd42a, 0xff8c42];
    for (var i = 0; i < 14; i++) {
      var z = -420 + i * 62 + SB.rand(-8, 8);
      var x = -490 + SB.rand(-14, 14);
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), M.lampPole);
      pole.position.set(x, 1.2, z);
      g.add(pole);
      var umb = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1, 8),
        new THREE.MeshLambertMaterial({ color: colors[i % colors.length] }));
      umb.position.set(x, 2.6, z);
      umb.castShadow = true;
      g.add(umb);
    }
  };

  city.buildMarina = function () {
    var g = SB.world.groups.city;

    var water = new THREE.Mesh(new THREE.PlaneGeometry(400, 170), M.water);
    water.rotation.x = -Math.PI / 2;
    water.position.set(-250, 0.02, 435);
    water.receiveShadow = true;
    g.add(water);

    var docks = new THREE.Mesh(new THREE.PlaneGeometry(500, 170), M.concrete);
    docks.rotation.x = -Math.PI / 2;
    docks.position.set(200, 0.02, 435);
    docks.receiveShadow = true;
    g.add(docks);

    for (var p = 0; p < 4; p++) {
      var px = -420 + p * 90;
      box(M.concrete, 10, 1, 90, px, 0.5, 460, g).receiveShadow = true;
      for (var b = 0; b < 3; b++) {
        var bz = 425 + b * 28;
        var hull = box(SB.pick(M.carColors), 6, 2, 16, px + 12, 1, bz, g);
        hull.castShadow = true;
        box(M.white, 4, 1.6, 8, px + 12, 2.8, bz, g);
      }
    }

    var contColors = [0xd83a3a, 0x3a6ad8, 0xd8d83a, 0x3ad83a, 0xff8c42];
    for (var w = 0; w < 5; w++) {
      var wx = 20 + w * 80;
      box(M.garageGray, 44, 12, 30, wx, 6, 420, g);
      for (var c = 0; c < 4; c++) {
        box(new THREE.MeshLambertMaterial({ color: contColors[(w + c) % contColors.length] }),
          12, 3, 3, wx - 16 + c * 11, 1.5, 452 + (c % 2) * 5, g);
      }
    }
  };

  city.buildPark = function () {
    var g = SB.world.groups.city;
    var grass = new THREE.Mesh(new THREE.PlaneGeometry(300, 200), M.grass);
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, 0.03, 250);
    grass.receiveShadow = true;
    g.add(grass);

    var pond = new THREE.Mesh(new THREE.CircleGeometry(30, 20), M.water);
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(50, 0.05, 300);
    pond.receiveShadow = true;
    g.add(pond);

    var path1 = new THREE.Mesh(new THREE.PlaneGeometry(300, 6), M.sidewalk);
    path1.rotation.x = -Math.PI / 2; path1.position.set(0, 0.04, 250); path1.receiveShadow = true;
    g.add(path1);
    var path2 = new THREE.Mesh(new THREE.PlaneGeometry(6, 200), M.sidewalk);
    path2.rotation.x = -Math.PI / 2; path2.position.set(0, 0.04, 250); path2.receiveShadow = true;
    g.add(path2);

    for (var i = 0; i < 22; i++) {
      var x = -140 + SB.rand(0, 280);
      var z = 160 + SB.rand(0, 180);
      if (Math.abs(x - 50) < 38 && Math.abs(z - 300) < 38) continue;
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 3, 6), M.trunk);
      trunk.position.set(x, 1.5, z); trunk.castShadow = true;
      g.add(trunk);
      var crown = new THREE.Mesh(GEO.treeCrown, M.treeLeaf);
      crown.position.set(x, 4.2, z); crown.castShadow = true;
      g.add(crown);
    }
  };

  function blockCenter(v) { return Math.floor(v / 100) * 100 + 50; }

  function districtOfBlock(cx, cz) {
    for (var i = 0; i < DISTRICTS.length; i++) {
      var d = DISTRICTS[i];
      if (cx >= d.x0 && cx <= d.x1 && cz >= d.z0 && cz <= d.z1) return d;
    }
    return null;
  }

  function addBuilding(cx, cz, w, h, d, mat, opts) {
    opts = opts || {};
    var g = SB.world.groups.buildings;
    var body = new THREE.Mesh(GEO.box, mat);
    body.scale.set(w, h, d);
    body.position.set(cx, h / 2, cz);
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    if (opts.roof !== false) box(M.roof, w + 1, 1, d + 1, cx, h + 0.5, cz, g);
    SB.addCollider(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2);
    return body;
  }

  city.buildBuildings = function () {
    var reserved = {};
    for (var li = 0; li < LANDMARKS.length; li++) {
      var lm = LANDMARKS[li];
      if (lm.x < -450 || lm.z > 400) continue;
      reserved[blockCenter(lm.x) + ',' + blockCenter(lm.z)] = true;
    }
    for (var cx = -350; cx <= 350; cx += 100) {
      for (var cz = -350; cz <= 350; cz += 100) {
        if (reserved[cx + ',' + cz]) continue;
        var d = districtOfBlock(cx, cz);
        if (!d) continue;
        if (d.id === 'keystone') continue;
        if (d.id === 'downtown') {
          var dist = Math.max(Math.abs(cx), Math.abs(cz));
          var h = dist <= 50 ? SB.rand(90, 140) : dist <= 150 ? SB.rand(55, 95) : SB.rand(35, 60);
          var w = SB.rand(42, 58);

          addBuilding(cx, cz, 74, 10, 74, SB.pick(M.buildingPalette), { roof: false });
          var mat = facadeMaterial(0x3a4a5a, 0x7fb2d9, 8, 16, 0.45);
          addBuilding(cx, cz, w, h, w, mat);
          if (h > 100) {
            var ant = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 14, 6), M.lampPole);
            ant.position.set(cx, h + 7, cz);
            SB.world.groups.buildings.add(ant);
          }
          if (SB.chance(0.4)) addBuilding(cx + 26, cz + 26, 18, SB.rand(12, 22), 18, SB.pick(M.buildingPalette));
        } else if (d.id === 'neon-mile') {
          var h1 = SB.rand(12, 30);
          addBuilding(cx - 16, cz, 30, h1, 40, facadeMaterial(0x5a3a5a, 0xff9ad4, 6, 4, 0.6));
          addBuilding(cx + 18, cz, 26, SB.rand(10, 22), 36, SB.pick(M.buildingPalette));

          addBuilding(cx, cz + 28, 62, 8, 12, SB.pick(M.buildingPalette), { roof: false });
        } else if (d.id === 'palmetto') {
          for (var k = 0; k < 3; k++) {
            var hx = cx - 22 + (k % 2) * 40 + SB.rand(-4, 4);
            var hz = cz - 20 + Math.floor(k / 2) * 42 + SB.rand(-4, 4);
            var hh = SB.rand(8, 13);
            var hw = SB.rand(16, 22);
            addBuilding(hx, hz, hw, hh, hw, SB.pick(M.buildingPalette), { roof: false });
            var roof = new THREE.Mesh(GEO.roofPyramid, M.roof);
            roof.scale.set(hw + 2, 5, hw + 2);
            roof.position.set(hx, hh + 2.5, hz);
            roof.rotation.y = Math.PI / 4;
            roof.castShadow = true;
            SB.world.groups.buildings.add(roof);
          }
        } else if (d.id === 'mercado') {
          addBuilding(cx - 14, cz, 34, SB.rand(8, 14), 44, SB.pick(M.buildingPalette));
          addBuilding(cx + 20, cz, 28, SB.rand(8, 16), 40, SB.pick(M.buildingPalette));

          var stallColors = [0xff5a5a, 0xffd42a, 0x2ad4ff, 0x4ad84a];
          for (var s = 0; s < 3; s++) {
            var sx = cx - 24 + s * 26;
            box(new THREE.MeshLambertMaterial({ color: stallColors[s % stallColors.length] }),
              12, 1, 10, sx, 3.4, cz + 28, SB.world.groups.buildings);
            box(M.concrete, 10, 2.4, 8, sx, 1.2, cz + 28, SB.world.groups.buildings);
          }
        } else {
          addBuilding(cx - 14, cz, 34, SB.rand(14, 26), 42, facadeMaterial(0xc8a0a8, 0xffe8c8, 6, 5, 0.35));
          addBuilding(cx + 20, cz, 28, SB.rand(12, 24), 38, SB.pick(M.buildingPalette));
          addBuilding(cx, cz + 26, 56, 9, 14, SB.pick(M.buildingPalette), { roof: false });
        }
      }
    }

    for (var t = 0; t < 3; t++) {
      var hz2 = -200 + t * 200;
      if (t === 1) continue;
      addBuilding(-490, hz2, 34, SB.rand(38, 60), 30, facadeMaterial(0x2a5a7a, 0x9fd4ff, 6, 10, 0.5));
    }
  };

  function landmarkBuilding(lm, w, h, d, mat, signText, signOpts) {
    var body = addBuilding(lm.x, lm.z, w, h, d, mat);
    var g = SB.world.groups.buildings;
    var sign = signPlane(signText, signOpts.w || 26, signOpts.h || 5, {
      x: lm.x, y: h + (signOpts.dy || 4), z: lm.z + d / 2 + 0.6,
      fg: signOpts.fg || '#ffffff', bg: signOpts.bg || null, neon: !!signOpts.neon
    });
    g.add(sign);
    return body;
  }

  city.buildLandmarks = function () {
    var g = SB.world.groups.buildings;

    landmarkBuilding(LANDMARKS[0], 56, 30, 44, facadeMaterial(0xd8c8b0, 0xffe8a0, 12, 5, 0.2),
      'SOLMAR NATIONAL BANK', { w: 34, h: 5 });
    for (var c = 0; c < 4; c++) {
      var col = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 14, 8), M.white);
      col.position.set(50 - 18 + c * 12, 7, -50 + 24);
      col.castShadow = true;
      g.add(col);
    }

    var hosp = LANDMARKS[1];
    addBuilding(hosp.x, hosp.z, 48, 24, 40, M.hospitalWhite);
    var crossCv = document.createElement('canvas');
    crossCv.width = 128; crossCv.height = 128;
    var cctx = crossCv.getContext('2d');
    cctx.fillStyle = '#ffffff'; cctx.fillRect(0, 0, 128, 128);
    cctx.fillStyle = '#d82a2a'; cctx.fillRect(54, 14, 20, 100); cctx.fillRect(14, 54, 100, 20);
    var crossTex = new THREE.CanvasTexture(crossCv);
    crossTex.encoding = THREE.sRGBEncoding;
    var cross = new THREE.Mesh(new THREE.PlaneGeometry(10, 10),
      new THREE.MeshBasicMaterial({ map: crossTex }));
    cross.position.set(hosp.x, 26, hosp.z + 21);
    g.add(cross);
    addSignToGroup(g, 'ST. CORAL HOSPITAL', 30, 5, { x: hosp.x, y: 20, z: hosp.z + 21, fg: '#d82a2a' });

    var pd = LANDMARKS[2];
    addBuilding(pd.x, pd.z, 44, 20, 40, M.policeBlue);
    var pad = new THREE.Mesh(new THREE.CircleGeometry(10, 20), new THREE.MeshBasicMaterial({ color: 0x2a2a2a }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(pd.x, 21.1, pd.z);
    g.add(pad);
    addSignToGroup(g, 'SOLMAR PD HQ', 24, 4, { x: pd.x, y: 18, z: pd.z + 21, fg: '#9fd4ff' });

    landmarkBuilding(LANDMARKS[3], 36, 55, 30, facadeMaterial(0xe8a8b8, 0xffe8a0, 6, 12, 0.5),
      'HOTEL PALMERA', { w: 28, h: 5, fg: '#ff2a7a' });

    landmarkBuilding(LANDMARKS[4], 40, 10, 30, M.garageGray, "JAX'S GARAGE", { w: 24, h: 4, dy: 2 });
    landmarkBuilding(LANDMARKS[5], 22, 11, 20, new THREE.MeshLambertMaterial({ color: 0xd8a0a0 }),
      "MARA'S SAFEHOUSE", { w: 22, h: 4, dy: 2 });
    landmarkBuilding(LANDMARKS[6], 26, 9, 22, M.concrete, 'NEON RESPRAY', { w: 22, h: 4, dy: 2, neon: true, fg: '#2ad4ff' });
    landmarkBuilding(LANDMARKS[7], 30, 10, 26, facadeMaterial(0xc8b060, 0xffe8a0, 6, 2, 0.3), 'FARO BOOKS', { w: 20, h: 4, dy: 2 });
    landmarkBuilding(LANDMARKS[8], 28, 12, 24, facadeMaterial(0x60a860, 0xffe8a0, 6, 2, 0.3), 'MANGO GYM', { w: 20, h: 4, dy: 2 });
    landmarkBuilding(LANDMARKS[9], 30, 12, 26, facadeMaterial(0x60a8c8, 0xffe8a0, 6, 2, 0.3), 'TIDELINE CAFE', { w: 24, h: 4, dy: 2 });
    landmarkBuilding(LANDMARKS[10], 28, 10, 24, facadeMaterial(0xc860a0, 0xffe8a0, 6, 2, 0.3), 'ZAPATOS ALBA', { w: 22, h: 4, dy: 2 });
    landmarkBuilding(LANDMARKS[11], 26, 10, 22, facadeMaterial(0x60c860, 0xffe8a0, 6, 2, 0.3), 'FARMACIA SOL', { w: 22, h: 4, dy: 2 });
    landmarkBuilding(LANDMARKS[12], 34, 16, 28, new THREE.MeshLambertMaterial({ color: 0x2a2a3a }), 'CLUB VOLTAGE',
      { w: 26, h: 5, dy: 2, neon: true, fg: '#ff2a7a' });
  };

  city.buildPalms = function () {
    var positions = [];
    var z;
    for (z = -440; z <= 440; z += 28) positions.push([-462, z]);
    for (var x = -400; x <= 400; x += 100) {
      for (z = -420; z <= 420; z += 60) {
        if (SB.chance(0.5)) positions.push([x + 11, z]);
        if (SB.chance(0.5)) positions.push([x - 11, z]);
      }
    }
    for (var i = 0; i < 10; i++) positions.push([-140 + SB.rand(0, 280), 160 + SB.rand(0, 180)]);
    var n = positions.length;
    var trunks = new THREE.InstancedMesh(GEO.trunk, M.trunk, n);
    var crowns = new THREE.InstancedMesh(GEO.palmCrown, M.palmLeaf, n);
    var m4 = new THREE.Matrix4();
    var q = new THREE.Quaternion();
    var e = new THREE.Euler();
    var s = new THREE.Vector3();
    for (var j = 0; j < n; j++) {
      var px = positions[j][0], pz = positions[j][1];
      var sc = SB.rand(0.85, 1.25);
      e.set(0, SB.rand(0, Math.PI * 2), SB.rand(-0.06, 0.06)); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(px, 2.5 * sc, pz), q, new THREE.Vector3(sc, sc, sc));
      trunks.setMatrixAt(j, m4);
      m4.compose(new THREE.Vector3(px, 5.4 * sc, pz), q, new THREE.Vector3(sc, sc * 0.55, sc));
      crowns.setMatrixAt(j, m4);
    }
    trunks.castShadow = true; crowns.castShadow = true;
    SB.world.groups.props.add(trunks);
    SB.world.groups.props.add(crowns);
  };

  city.buildNeon = function () {
    var g = SB.world.groups.props;

    var neonTexts = ['NEON MILE', 'FLAMINGO FM 88.1', 'TACOS SOL', 'PIZZA LUNA', 'ARCADE', 'MOTEL SOL', 'DONUTS 24H', 'LIQUOR'];
    var neonColors = ['#ff2a7a', '#2ad4ff', '#ffd42a', '#a42aff'];
    for (var i = 0; i < neonTexts.length; i++) {
      var x = -280 + i * 80;
      var s = signPlane(neonTexts[i], 22, 4, {
        x: x, y: SB.rand(8, 16), z: -340 + 0.6, ry: Math.PI,
        fg: neonColors[i % neonColors.length], neon: true
      });
      g.add(s);
    }

    var boards = [
      { text: 'FLAMINGO FM\n88.1', x: -50, z: -150, y: 96, ry: 0, fg: '#ff2a7a' },
      { text: 'SOLMAR BAY', x: -480, z: 0, y: 62, ry: -Math.PI / 2, fg: '#2ad4ff' },
      { text: 'WAVE 104', x: 50, z: 50, y: 70, ry: Math.PI, fg: '#ffd42a' },
      { text: 'CLUB VOLTAGE', x: -50, z: -350, y: 22, ry: 0, fg: '#ff2a7a' },
      { text: 'NEON MILE', x: 0, z: -400, y: 30, ry: 0, fg: '#a42aff' }
    ];
    for (var b = 0; b < boards.length; b++) {
      var bd = boards[b];
      var bs = signPlane(bd.text, 34, 12, { x: bd.x, y: bd.y, z: bd.z, ry: bd.ry, fg: bd.fg, neon: true, th: 256 });
      g.add(bs);
    }

    var lightSpots = [
      { x: -200, z: -395, c: 0xff2a7a }, { x: 0, z: -395, c: 0x2ad4ff },
      { x: 200, z: -395, c: 0xffd42a }, { x: -50, z: -350, c: 0xff2a7a },
      { x: -480, z: 0, c: 0x2ad4ff }, { x: 50, z: -50, c: 0xffd42a }
    ];
    for (var l = 0; l < lightSpots.length; l++) {
      var pl = new THREE.PointLight(lightSpots[l].c, 0.8, 70, 1.5);
      pl.position.set(lightSpots[l].x, 10, lightSpots[l].z);
      SB.world.scene.add(pl);
      SB.world.neonLights.push(pl);
    }
  };

  city.buildStreetProps = function () {

    var spots = [];
    for (var x = -400; x <= 400; x += 100) {
      for (var z = -400; z <= 400; z += 50) spots.push([x + 11, z]);
    }
    var poles = new THREE.InstancedMesh(GEO.lampPole, M.lampPole, spots.length);
    var headGeo = new THREE.BoxGeometry(0.5, 0.18, 0.18);
    var heads = new THREE.InstancedMesh(headGeo, M.lampHead, spots.length);
    var m4 = new THREE.Matrix4();
    for (var i = 0; i < spots.length; i++) {
      m4.makeTranslation(spots[i][0], 2.75, spots[i][1]);
      poles.setMatrixAt(i, m4);
      m4.makeTranslation(spots[i][0], 5.6, spots[i][1]);
      heads.setMatrixAt(i, m4);
    }
    SB.world.groups.props.add(poles);
    SB.world.groups.props.add(heads);
  };

  var skyItems = null;
  city.buildSky = function () {
    var g = SB.world.groups.sky;
    var sunDisc = new THREE.Mesh(GEO.sunDisc, new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }));
    sunDisc.position.set(-750, 170, 250);
    sunDisc.lookAt(0, 60, 0);
    g.add(sunDisc);
    var moon = new THREE.Mesh(new THREE.CircleGeometry(26, 24), new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false }));
    moon.position.set(500, 320, -250);
    moon.lookAt(0, 60, 0);
    moon.visible = false;
    g.add(moon);

    skyItems = { sunDisc: sunDisc, moon: moon, clouds: [] };
    for (var i = 0; i < 8; i++) {
      var cloud = new THREE.Group();
      for (var p = 0; p < 3; p++) {
        var puff = new THREE.Mesh(GEO.cloudPuff,
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false }));
        puff.scale.set(SB.rand(18, 34), SB.rand(5, 8), SB.rand(10, 16));
        puff.position.set(p * SB.rand(14, 22) - 20, SB.rand(-2, 2), SB.rand(-6, 6));
        cloud.add(puff);
      }
      var cx = SB.rand(-500, 500), cz = SB.rand(-500, 500), cy = SB.rand(180, 260);
      cloud.position.set(cx, cy, cz);
      cloud.userData = { baseX: cx, speed: SB.rand(1.5, 3.5) };
      g.add(cloud);
      skyItems.clouds.push(cloud);
    }
    SB.on('time-of-day', function (mode) {
      if (!skyItems) return;
      skyItems.sunDisc.visible = (mode !== 'night');
      skyItems.moon.visible = (mode === 'night');
    });
  };

  function updateSky(dt) {
    if (!skyItems) return;
    var t = SB.state.simTime;
    for (var i = 0; i < skyItems.clouds.length; i++) {
      var c = skyItems.clouds[i];
      var nx = c.userData.baseX + ((t * c.userData.speed) % 1100) - 550;
      c.position.x = nx;
    }
  }

  var CAR_KINDS = {
    sport: { w: 1.9, h: 0.65, l: 4.4, cabinH: 0.5 },
    muscle: { w: 2.0, h: 0.75, l: 4.6, cabinH: 0.55 },
    sedan: { w: 1.9, h: 0.7, l: 4.4, cabinH: 0.55 },
    taxi: { w: 1.9, h: 0.7, l: 4.4, cabinH: 0.55 },
    truck: { w: 2.2, h: 1.2, l: 5.5, cabinH: 0.9 },
    van: { w: 2.0, h: 1.6, l: 4.8, cabinH: 0.7 }
  };

  city.makeCarMesh = function (kind, colorHex) {
    buildMaterials();
    var spec = CAR_KINDS[kind] || CAR_KINDS.sedan;
    var group = new THREE.Group();
    var bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
    var body = new THREE.Mesh(GEO.box, bodyMat);
    body.scale.set(spec.w, spec.h, spec.l);
    body.position.y = 0.55;
    body.castShadow = true;
    group.add(body);
    var cabin = new THREE.Mesh(GEO.box, M.glass);
    cabin.scale.set(spec.w - 0.25, spec.cabinH, spec.l * 0.5);
    cabin.position.set(0, 0.55 + spec.h / 2 + spec.cabinH / 2 - 0.05, -spec.l * 0.06);
    cabin.castShadow = true;
    group.add(cabin);
    var wheelPos = [
      [-spec.w / 2, 0.35, spec.l * 0.32], [spec.w / 2, 0.35, spec.l * 0.32],
      [-spec.w / 2, 0.35, -spec.l * 0.32], [spec.w / 2, 0.35, -spec.l * 0.32]
    ];
    for (var i = 0; i < 4; i++) {
      var wheel = new THREE.Mesh(GEO.wheel, M.tire);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wheelPos[i][0], wheelPos[i][1], wheelPos[i][2]);
      wheel.castShadow = true;
      group.add(wheel);
    }
    var hl = new THREE.Mesh(GEO.box, M.headlight);
    hl.scale.set(0.4, 0.15, 0.1);
    hl.position.set(-spec.w / 2 + 0.35, 0.6, -spec.l / 2 - 0.03);
    group.add(hl);
    var hr = hl.clone(); hr.position.x = spec.w / 2 - 0.35; group.add(hr);
    var tl = new THREE.Mesh(GEO.box, M.taillight);
    tl.scale.set(0.4, 0.15, 0.1);
    tl.position.set(-spec.w / 2 + 0.35, 0.6, spec.l / 2 + 0.03);
    group.add(tl);
    var tr = tl.clone(); tr.position.x = spec.w / 2 - 0.35; group.add(tr);
    if (kind === 'taxi') {
      var sign = new THREE.Mesh(GEO.box, M.neonYellow);
      sign.scale.set(0.8, 0.25, 0.4);
      sign.position.set(0, 1.45, 0);
      group.add(sign);
    }
    return group;
  };

  city.makePedMesh = function (shirtHex, skinHex) {
    buildMaterials();
    var group = new THREE.Group();
    var shirt = new THREE.MeshLambertMaterial({ color: shirtHex });
    var skin = new THREE.MeshLambertMaterial({ color: skinHex });
    var legs = new THREE.Mesh(GEO.box, new THREE.MeshLambertMaterial({ color: 0x2a2a3a }));
    legs.scale.set(0.4, 0.5, 0.28); legs.position.y = 0.25;
    legs.castShadow = true;
    group.add(legs);
    var torso = new THREE.Mesh(GEO.box, shirt);
    torso.scale.set(0.46, 0.6, 0.3); torso.position.y = 0.8;
    torso.castShadow = true;
    group.add(torso);
    var head = new THREE.Mesh(GEO.pedHead, skin);
    head.position.y = 1.35;
    head.castShadow = true;
    group.add(head);
    return group;
  };

  city.buildTraffic = function (count) {
    count = count || 22;
    var kinds = ['sport', 'muscle', 'sedan', 'taxi', 'truck', 'van'];
    SB.world.traffic = [];
    for (var i = 0; i < count; i++) {
      var road = SB.pick(ROADS);
      var dir = SB.chance(0.5) ? 1 : -1;
      var lane = road.axis === 'x' ? (dir > 0 ? 3.5 : -3.5) : (dir > 0 ? -3.5 : 3.5);
      var kind = SB.pick(kinds);
      var color = SB.pick(M.carColors).color.getHex();
      var mesh = city.makeCarMesh(kind, color);
      var s = SB.rand(road.from + 20, road.to - 20);
      mesh.position.set(road.axis === 'x' ? s : road.at + lane, 0, road.axis === 'x' ? road.at + lane : s);
      mesh.rotation.y = road.axis === 'x' ? (dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (dir > 0 ? Math.PI : 0);
      SB.world.groups.traffic.add(mesh);
      SB.world.traffic.push({
        group: mesh, road: road, lane: lane, dir: dir,
        speed: SB.rand(8, 14), kind: kind, color: color, s: s
      });
    }
  };

  function updateTraffic(dt) {
    var list = SB.world.traffic;
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      c.s += c.dir * c.speed * dt;
      if (c.s > c.road.to + 20) c.s = c.road.from - 20;
      if (c.s < c.road.from - 20) c.s = c.road.to + 20;
      if (c.road.axis === 'x') c.group.position.set(c.s, 0, c.road.at + c.lane);
      else c.group.position.set(c.road.at + c.lane, 0, c.s);
    }
  }
  city.updateTraffic = updateTraffic;

  city.buildPeds = function (count) {
    count = count || 36;
    SB.world.peds = [];
    for (var i = 0; i < count; i++) {
      var road = SB.pick(ROADS);
      var dir = SB.chance(0.5) ? 1 : -1;
      var side = SB.chance(0.5) ? 9 : -9;
      var s = SB.rand(road.from + 20, road.to - 20);
      var shirt = SB.pick(M.shirtColors).color.getHex();
      var skin = SB.pick(M.skinTones).color.getHex();
      var mesh = city.makePedMesh(shirt, skin);
      mesh.position.set(road.axis === 'x' ? s : road.at + side, 0, road.axis === 'x' ? road.at + side : s);
      mesh.rotation.y = road.axis === 'x' ? (dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (dir > 0 ? Math.PI : 0);
      SB.world.groups.peds.add(mesh);
      SB.world.peds.push({
        group: mesh, road: road, side: side, dir: dir,
        speed: SB.rand(1.0, 1.6), s: s, phase: SB.rand(0, Math.PI * 2),
        pause: 0, rng: SB.mulberry32(SB.state.seed * 1000 + i + 7)
      });
    }
  };

  function updatePeds(dt) {
    var list = SB.world.peds;
    var t = SB.state.simTime;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (p.pause > 0) { p.pause -= dt; continue; }
      if (p.rng() < 0.0015) { p.pause = p.rng() * 3; continue; }
      p.s += p.dir * p.speed * dt;
      if (p.s > p.road.to - 10) { p.s = p.road.to - 10; p.dir = -1; }
      if (p.s < p.road.from + 10) { p.s = p.road.from + 10; p.dir = 1; }
      if (p.road.axis === 'x') {
        p.group.position.set(p.s, Math.abs(Math.sin(t * 8 + p.phase)) * 0.06, p.road.at + p.side);
        p.group.rotation.y = p.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      } else {
        p.group.position.set(p.road.at + p.side, Math.abs(Math.sin(t * 8 + p.phase)) * 0.06, p.s);
        p.group.rotation.y = p.dir > 0 ? Math.PI : 0;
      }
    }
  }
  city.updatePeds = updatePeds;

  city.buildCity = function (seed) {
    if (typeof THREE === 'undefined') throw new Error('SB.city.buildCity: THREE not loaded');
    if (!SB.world.scene) throw new Error('SB.city.buildCity: call SB.init() first');
    if (seed !== undefined) SB.reseed(seed);
    buildMaterials();

    var old = SB.world.groups.city;
    if (old) SB.world.scene.remove(old);
    var groups = {
      city: new THREE.Group(),
      buildings: new THREE.Group(),
      roads: new THREE.Group(),
      props: new THREE.Group(),
      traffic: new THREE.Group(),
      peds: new THREE.Group(),
      sky: new THREE.Group()
    };
    groups.city.add(groups.buildings);
    groups.city.add(groups.roads);
    groups.city.add(groups.props);
    groups.city.add(groups.traffic);
    groups.city.add(groups.peds);
    groups.city.add(groups.sky);
    SB.world.groups = groups;
    SB.world.scene.add(groups.city);

    SB.world.colliders = [];
    SB.world.roads = ROADS;
    SB.world.districts = DISTRICTS;
    SB.world.landmarks = LANDMARKS;
    SB.world.spawns = SPAWNS;
    SB.world.bounds = { minX: WORLD.minX, maxX: WORLD.maxX, minZ: WORLD.minZ, maxZ: WORLD.maxZ };
    SB.world.neonLights = [];

    city.buildGround();
    city.buildOcean();
    city.buildRoads();
    city.buildSidewalks();
    city.buildBeach();
    city.buildMarina();
    city.buildPark();
    city.buildBuildings();
    city.buildLandmarks();
    city.buildPalms();
    city.buildNeon();
    city.buildStreetProps();
    city.buildSky();
    city.buildTraffic(30);
    city.buildPeds(48);

    SB.registerUpdate(updateTraffic);
    SB.registerUpdate(updatePeds);
    SB.registerUpdate(updateSky);
    SB.emit('city-built');
    return SB.world;
  };

  city.colliders = SB.world.colliders;

})();
