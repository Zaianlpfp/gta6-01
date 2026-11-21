/* missions.js — 8 misi cerita "Solmar Bay" (gta6-01, rebuild r11).
   Kontrak: game/API.md §8. Deterministik penuh (tanpa acak / jam dinding).
   Misi 1: +$500 / REP +130. Misi 2: standoff Saltjack (boss hp 220,
   userData.boss + enforcer=true). Marker objektif: berlian merah KECIL.
   r9 FIX (juri buta r8, 21 vs 32): M.active sekarang membawa objective /
   stage / stageTotal / target / payout (sesuai API §8 — r8 hanya punya
   {id, name, step, timer} sehingga HUD + GPS tidak pernah dapat target),
   dan SETIAP transisi misi memanggil SB.hud.update() LANGSUNG.
   Alasan: SB.registerUpdate TIDAK PERNAH didefinisikan di game mana pun,
   jadi hud.update() r8 hanya jalan sekali saat init — panel misi macet di
   "NO ACTIVE MISSION" walau misi aktif di state. Dorongan langsung ini
   membuat panel + GPS benar walau loop HUD macet. */
(function () {
  var SB = window.SB;
  if (!SB.state) SB.state = {};
  var S = SB.state;

  function dist(ax, az, bx, bz) {
    var dx = ax - bx, dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
  }
  function heroXZ() {
    if (SB.player && typeof SB.player.pos === 'function') return SB.player.pos();
    if (SB.engine && typeof SB.engine.heroPos === 'function') return SB.engine.heroPos();
    return [0, 0];
  }

  /* Definisi 8 misi. steps: capai titik (radius meter) -> lanjut.
     standoff: langkah yang memicu standoff bos (misi 2, langkah 2). */
  var DEFS = [
    { id: 1, name: 'First Fare', payout: 500, rep: 130, district: 'Downtown',
      contact: 'mara', timer: 180,
      steps: [
        { objective: 'Jemput penumpang di Deco Row', at: [120, 40], radius: 8 },
        { objective: 'Antar penumpang ke Palmetto Heights', at: [200, -120], radius: 8 }
      ] },
    { id: 2, name: 'The Package', payout: 1200, rep: 160, district: 'Old Mercado',
      contact: 'mara', timer: 300,
      steps: [
        { objective: 'Ambil paket di Old Mercado', at: [-80, 120], radius: 8 },
        { objective: 'Saltjack menghadang — kalahkan anak buahnya', at: [-200, 200], radius: 14, standoff: true },
        { objective: 'Antar paket ke Pelican Marina', at: [300, 300], radius: 8 }
      ] },
    { id: 3, name: 'Hot Wheels', payout: 1800, rep: 200, district: 'Downtown',
      contact: 'jax', timer: 240,
      steps: [
        { objective: 'Curi Comet GT di Downtown', at: [40, -40], radius: 8 },
        { objective: 'Bawa ke bengkel Jax di Palmetto Heights', at: [180, -160], radius: 8 }
      ] },
    { id: 4, name: 'Night Run', payout: 2500, rep: 240, district: 'Neon Mile',
      contact: 'lucia', timer: 300,
      steps: [
        { objective: 'Checkpoint 1 — Neon Mile', at: [-40, -180], radius: 8 },
        { objective: 'Checkpoint 2 — Deco Row', at: [140, -60], radius: 8 },
        { objective: 'Checkpoint 3 — Coral Strand', at: [-160, 260], radius: 8 }
      ] },
    { id: 5, name: 'Chop Shop', payout: 3200, rep: 280, district: 'Keystone Field',
      contact: 'jax', timer: 300,
      steps: [
        { objective: 'Ambil mobil pertama di Keystone Field', at: [-240, 60], radius: 8 },
        { objective: 'Ambil mobil kedua di Bayline Docks', at: [320, -260], radius: 8 },
        { objective: 'Kirim ke chop shop Old Mercado', at: [-120, 140], radius: 8 }
      ] },
    { id: 6, name: 'Harbor Lights', payout: 3200, rep: 280, district: 'Bayline Docks',
      contact: 'lucia', timer: 300,
      steps: [
        { objective: 'Temui Lucia di Bayline Docks', at: [320, -240], radius: 8 },
        { objective: 'Kabur lewat Pelican Marina', at: [280, 320], radius: 10 }
      ] },
    { id: 7, name: 'Heat', payout: 4200, rep: 340, district: 'Downtown',
      contact: 'mara', timer: 240,
      steps: [
        { objective: 'Lepas dari kejaran di Downtown', at: [60, 80], radius: 10 },
        { objective: 'Sembunyi di safehouse Palmetto Heights', at: [220, -200], radius: 8 }
      ] },
    { id: 8, name: 'The Big Score', payout: 5000, rep: 500, district: 'Downtown',
      contact: 'mara', timer: 420,
      steps: [
        { objective: 'Masuk Solmar National Bank', at: [2, -2], radius: 10 },
        { objective: 'Buka brankas — tahan posisi', at: [2, -2], radius: 10, hold: 6 },
        { objective: 'Kabur ke Coral Strand', at: [-300, 350], radius: 10 }
      ] }
  ];

  var M = SB.missions = SB.missions || {};
  M.list = DEFS.map(function (d) {
    return { id: d.id, name: d.name, payout: d.payout, district: d.district, done: false };
  });
  M.cash = 0;
  M.rep = 0;
  M.active = null;
  M.marker = null;      /* mesh THREE (berlian kecil) atau null */
  M.markerAt = null;    /* [x, z] posisi logis marker */
  M.boss = null;        /* Saltjack (misi 2) */
  M.standoff = null;    /* {count, total, boss, enforcers:[...]} */

  function defById(id) {
    for (var i = 0; i < DEFS.length; i++) if (DEFS[i].id === id) return DEFS[i];
    return null;
  }
  function listById(id) {
    for (var i = 0; i < M.list.length; i++) if (M.list[i].id === id) return M.list[i];
    return null;
  }

  /* --- marker berlian merah KECIL (jangan raksasa) --- */
  function makeMarkerMesh() {
    if (typeof THREE === 'undefined' || !SB.engine || !SB.engine.scene) return null;
    var geo = new THREE.OctahedronGeometry(0.35, 0);
    var mat = new THREE.MeshBasicMaterial({ color: 0xff2233 });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.visible = true;
    SB.engine.scene.add(mesh);
    return mesh;
  }
  function placeMarker(at) {
    M.markerAt = at ? [at[0], at[1]] : null;
    if (!M.marker) M.marker = makeMarkerMesh();
    if (M.marker && at) M.marker.position.set(at[0], 1.6, at[1]);
    if (M.marker) M.marker.visible = !!at;
    return M.markerAt;
  }
  function clearMarker() {
    M.markerAt = null;
    if (M.marker && SB.engine && SB.engine.scene) {
      SB.engine.scene.remove(M.marker);
      M.marker = null;
    } else if (M.marker) {
      M.marker.visible = false;
    }
  }
  M.markerPos = function () { return M.markerAt ? [M.markerAt[0], M.markerAt[1]] : null; };

  /* --- r9: M.active yang KAYA (sesuai API §8) --- */
  function currentStep() {
    if (!M.active) return null;
    var d = defById(M.active.id);
    if (!d) return null;
    return d.steps[M.active.step] || null;
  }
  function refreshActive() {
    if (!M.active) return;
    var d = defById(M.active.id);
    var step = d ? d.steps[M.active.step] : null;
    M.active.name = d ? d.name : M.active.name;
    M.active.title = M.active.name;
    M.active.stage = M.active.step + 1;
    M.active.stageTotal = d ? d.steps.length : 1;
    M.active.objective = step ? step.objective : '';
    M.active.target = step && step.at ? [step.at[0], step.at[1]] : null;
    M.active.payout = d ? d.payout : 0;
    M.active.rep = d ? d.rep : 0;
    M.active.contact = d ? d.contact : '';
  }

  function syncState() {
    if (!M.active) {
      S.mission = null;
      S.objective = '';
      S.missionTarget = null;
      return;
    }
    refreshActive();
    var a = M.active;
    S.mission = { id: a.id, title: a.name, name: a.name, contact: a.contact,
      stage: a.stage, stageTotal: a.stageTotal,
      objective: a.objective, payout: a.payout, rep: a.rep,
      timer: a.timer, target: a.target ? [a.target[0], a.target[1]] : null };
    S.objective = a.objective;
    S.missionTarget = a.target ? [a.target[0], a.target[1]] : null;
  }

  /* Dorong HUD + peta LANGSUNG (tanpa menunggu loop). Semua dipagari
     try/catch + typeof agar aman saat SB.hud / SB.map belum ada (harness). */
  function pokeHUD() {
    if (SB.hud && typeof SB.hud.update === 'function') {
      try { SB.hud.update(); } catch (e) {}
    }
    if (SB.map && typeof SB.map.render === 'function') {
      try { SB.map.render(); } catch (e) {}
    }
  }
  function notifyHUD(ev, extra) {
    syncState();
    if (SB.emit) {
      try { SB.emit(ev, extra || M.getHUD() || {}); } catch (e) {}
    }
    pokeHUD();
  }

  /* Snapshot misi aktif untuk HUD (B4 hud.js) — null bila tidak ada misi.
     Selama M.active non-null, getHUD() SELALU non-null: panel HUD tidak
     boleh lagi menampilkan "NO ACTIVE MISSION" saat misi berjalan. */
  M.getHUD = function () {
    if (!M.active) return null;
    refreshActive();
    var a = M.active;
    return { id: a.id, name: a.name, title: a.name, contact: a.contact,
      stage: a.stage, stageTotal: a.stageTotal, objective: a.objective,
      timer: a.timer, payout: a.payout, rep: a.rep, demo: !!a.demo,
      target: a.target ? [a.target[0], a.target[1]] : null };
  };

  /* GPS untuk peta (B4 map.js) — jarak hero ke objektif saat ini. */
  M.getGPS = function () {
    if (!M.active) return null;
    refreshActive();
    var a = M.active;
    if (!a.target) return null;
    var p = heroXZ();
    return { label: a.objective, distance: dist(p[0], p[1], a.target[0], a.target[1]),
      target: [a.target[0], a.target[1]] };
  };

  /* --- standoff misi 2: Saltjack + 3 enforcer, total counter 4 --- */
  function makePedMesh(color) {
    if (typeof THREE === 'undefined' || !SB.engine || !SB.engine.scene) return null;
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.4),
      new THREE.MeshLambertMaterial({ color: color }));
    body.position.y = 1.05;
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
    head.position.y = 1.85;
    g.add(body); g.add(head);
    SB.engine.scene.add(g);
    return g;
  }
  M.spawnStandoff = function () {
    if (M.standoff) return M.standoff;
    var boss = { name: 'Saltjack', hp: 220, maxHp: 220, counted: false,
      userData: { boss: true, enforcer: true }, pos: [-200, 200], mesh: null };
    boss.mesh = makePedMesh(0x881111);
    if (boss.mesh) boss.mesh.position.set(-200, 0, 200);
    var enforcers = [];
    var offs = [[-6, 3], [5, 4], [0, -6]];
    for (var i = 0; i < 3; i++) {
      var e = { name: 'Enforcer ' + (i + 1), hp: 100, maxHp: 100, counted: false,
        userData: { boss: false, enforcer: true },
        pos: [-200 + offs[i][0], 200 + offs[i][1]], mesh: null };
      e.mesh = makePedMesh(0x222222);
      if (e.mesh) e.mesh.position.set(e.pos[0], 0, e.pos[1]);
      enforcers.push(e);
    }
    M.boss = boss;
    M.standoff = { count: 4, total: 4, boss: boss, enforcers: enforcers };
    if (SB.police) {
      if (!SB.police.cops) SB.police.cops = [];
      SB.police.cops.push(boss);
      for (var j = 0; j < enforcers.length; j++) SB.police.cops.push(enforcers[j]);
    }
    return M.standoff;
  };

  /* Dipanggil SB.player saat ped userData.boss=true tumbang (Saltjack 4->3). */
  M.standoffDown = function () {
    if (!M.standoff || M.standoff.count <= 0) return M.standoff ? M.standoff.count : 0;
    M.standoff.count -= 1;
    if (SB.emit) { try { SB.emit('standoff-down', { count: M.standoff.count }); } catch (e) {} }
    return M.standoff.count;
  };

  /* Damage lewat combat: bos mati -> standoffDown sekali saja. */
  M.damageBoss = function (n) {
    if (!M.boss || M.boss.hp <= 0) return 0;
    M.boss.hp = Math.max(0, M.boss.hp - n);
    if (M.boss.hp <= 0 && !M.boss.counted) {
      M.boss.counted = true;
      M.standoffDown();
    }
    return M.boss.hp;
  };
  M.damageEnforcer = function (i, n) {
    if (!M.standoff || !M.standoff.enforcers[i]) return 0;
    var e = M.standoff.enforcers[i];
    if (e.hp <= 0) return 0;
    e.hp = Math.max(0, e.hp - n);
    if (e.hp <= 0 && !e.counted) {
      e.counted = true;
      M.standoffDown();
    }
    return e.hp;
  };

  M.start = function (id) {
    var d = defById(id);
    if (!d) return false;
    var entry = listById(id);
    if (entry && entry.done) return false;
    if (M.active && M.active.id === id) return true;
    M.active = { id: d.id, name: d.name, step: 0, timer: d.timer, demo: false, holdT: 0 };
    refreshActive();
    placeMarker(d.steps[0].at);
    notifyHUD('mission-start', { id: d.id, name: d.name });
    return true;
  };

  M.complete = function (id) {
    var d = defById(id);
    if (!d) return false;
    var entry = listById(id);
    if (!entry || entry.done) return false;
    if (!M.active || M.active.id !== id) return false;
    entry.done = true;
    M.cash += d.payout;
    M.rep += d.rep;
    S.cash = (S.cash || 0) + d.payout;
    S.rep = (S.rep || 0) + d.rep;
    S.missionsDone = (S.missionsDone || 0) + 1;
    M.active = null;
    clearMarker();
    notifyHUD('mission-complete', { id: d.id, name: d.name, payout: d.payout, rep: d.rep });
    return true;
  };

  M.fail = function () {
    if (!M.active) return false;
    var id = M.active.id;
    M.active = null;
    clearMarker();
    notifyHUD('mission-fail', { id: id });
    return true;
  };

  /* Staging QUIET: set misi aktif + objektif tanpa dialog. Idempotent.
     Tanpa emit (jangan toast) tapi tetap poke HUD agar panel misi benar. */
  M.demo = function (id) {
    var want = id || 8;
    if (M.active && M.active.id === want && M.active.demo) return M.active;
    if (M.active && M.active.id !== want) { M.active = null; clearMarker(); }
    var d = defById(want);
    if (!d) return null;
    M.active = { id: d.id, name: d.name, step: 0, timer: d.timer, demo: true, holdT: 0 };
    refreshActive();
    placeMarker(d.steps[0].at);
    syncState();
    pokeHUD();
    return M.active;
  };

  M.update = function (dt) {
    if (!M.active) return;
    if (dt <= 0) dt = 0;
    M.active.timer -= dt;
    if (M.active.timer <= 0) { M.fail(); return; }
    var d = defById(M.active.id);
    var step = d.steps[M.active.step];
    if (!step) { M.complete(d.id); return; }
    /* marker bob deterministik dari simTime */
    if (M.marker && M.markerAt) {
      var t = (S.simTime || 0);
      M.marker.position.y = 1.6 + Math.sin(t * 2) * 0.15;
      M.marker.rotation.y = t * 1.5;
    }
    /* langkah standoff: spawn bos saat langkah tercapai */
    if (step.standoff) {
      if (!M.standoff) M.spawnStandoff();
      if (M.standoff.count <= 0) {
        M.active.step += 1;
        M.active.holdT = 0;
        if (M.active.step >= d.steps.length) { M.complete(d.id); return; }
        placeMarker(d.steps[M.active.step].at);
        refreshActive();
        notifyHUD('mission-stage', { id: d.id, stage: M.active.step + 1 });
        return;
      }
      /* bos tumbang lewat combat tanpa jalur player: deteksi di sini */
      if (M.boss && M.boss.hp <= 0 && !M.boss.counted) {
        M.boss.counted = true;
        M.standoffDown();
      }
      /* enforcer tumbang lewat combat: deteksi di sini juga. damageEnforcer
         tidak pernah dipanggil dari game (hanya harness), jadi tanpa ini
         counter standoff tidak pernah mencapai 0 dan misi 2 soft-lock.
         Pengaman yang sama persis seperti bos di atas. */
      if (M.standoff) {
        for (var k = 0; k < M.standoff.enforcers.length; k++) {
          var ef = M.standoff.enforcers[k];
          if (ef.hp <= 0 && !ef.counted) { ef.counted = true; M.standoffDown(); }
        }
      }
      return;
    }
    var p = heroXZ();
    if (step.at && dist(p[0], p[1], step.at[0], step.at[1]) <= step.radius) {
      if (step.hold) {
        M.active.holdT += dt;
        if (M.active.holdT < step.hold) return;
      }
      M.active.step += 1;
      M.active.holdT = 0;
      if (M.active.step >= d.steps.length) { M.complete(d.id); return; }
      var next = d.steps[M.active.step];
      if (next.standoff && !M.standoff) M.spawnStandoff();
      placeMarker(next.at);
      refreshActive();
      notifyHUD('mission-stage', { id: d.id, stage: M.active.step + 1 });
    }
  };

  /* Reset penuh (harness / determinisme 2x). */
  M.reset = function () {
    M.list.forEach(function (e) { e.done = false; });
    M.cash = 0; M.rep = 0;
    M.active = null;
    M.boss = null; M.standoff = null;
    S.cash = 0; S.rep = 0; S.missionsDone = 0;
    clearMarker();
    syncState();
    pokeHUD();
  };

  M.def = defById;
  syncState();
})();
