// game/missions.js — SB.missions: 8 misi "Solmar Bay" (r13, ditulis fresh dari API.md §8).
// Kontrak: API.md §8. Semua angka deterministik (tanpa acak, tanpa jam dinding).
// Main loop memanggil SB.missions.update(dt) tiap frame saat !SB.state.paused.
(function () {
  'use strict';

  var SB = window.SB || (window.SB = {});

  // ---------------------------------------------------------------------------
  // Definisi misi. Tiap stage menunjuk satu distrik; posisi objektif diambil
  // dari SB.city.districts saat misi dimulai (API §4: distrik dipakai misi).
  // ---------------------------------------------------------------------------
  var MISSION_DEFS = [
    { id: 1, name: 'First Fare', payout: 500, district: 'Deco Row', rep: 130, time: 180,
      stages: [
        { objective: 'Jemput penumpang di Deco Row', district: 'Deco Row' },
        { objective: 'Antar penumpang ke Coral Strand', district: 'Coral Strand' }
      ] },
    { id: 2, name: 'The Package', payout: 1200, district: 'Old Mercado', rep: 150, time: 240,
      stages: [
        { objective: 'Ambil paket di Old Mercado', district: 'Old Mercado' },
        { objective: 'Antar paket ke Bayline Docks', district: 'Bayline Docks' }
      ] },
    { id: 3, name: 'Hot Wheels', payout: 1800, district: 'Neon Mile', rep: 180, time: 240,
      stages: [
        { objective: 'Curi mobil sport di Neon Mile', district: 'Neon Mile' },
        { objective: 'Bawa mobil ke Chop Shop', district: 'Keystone Field' }
      ] },
    { id: 4, name: 'Night Run', payout: 2500, district: 'Palmetto Heights', rep: 200, time: 300,
      stages: [
        { objective: 'Jemput klien di Palmetto Heights', district: 'Palmetto Heights' },
        { objective: 'Antar klien ke Pelican Marina', district: 'Pelican Marina' }
      ] },
    { id: 5, name: 'Chop Shop', payout: 3200, district: 'Keystone Field', rep: 220, time: 300,
      stages: [
        { objective: 'Ambil mobil curian di Keystone Field', district: 'Keystone Field' },
        { objective: 'Serahkan ke bengkel Jax', district: 'Downtown' }
      ] },
    { id: 6, name: 'Harbor Lights', payout: 3200, district: 'Pelican Marina', rep: 220, time: 300,
      stages: [
        { objective: 'Temui kontak di Pelican Marina', district: 'Pelican Marina' },
        { objective: 'Ambil kiriman di Bayline Docks', district: 'Bayline Docks' }
      ] },
    { id: 7, name: 'Heat', payout: 4200, district: 'Downtown', rep: 280, time: 360,
      stages: [
        { objective: 'Hadapi kru Saltjack di Downtown', district: 'Downtown', standoff: true },
        { objective: 'Kabur dari kejaran polisi', district: 'Coral Strand' }
      ] },
    { id: 8, name: 'The Big Score', payout: 5000, district: 'Downtown', rep: 350, time: 420,
      stages: [
        { objective: 'Masuk ke Solmar National Bank', district: 'Downtown' },
        { objective: 'Bawa hasil rampokan ke safehouse', district: 'Palmetto Heights' }
      ] }
  ];

  var STAGE_RADIUS = 12;    // meter: hero dianggap sampai di objektif
  var MARKER_SIZE = 1.2;    // berlian merah KECIL (jangan raksasa)
  var MARKER_HEIGHT = 3;    // tinggi melayang marker di atas tanah

  var M = SB.missions || (SB.missions = {});

  // Daftar publik (API §8): {id, name, payout, district, done}
  M.list = MISSION_DEFS.map(function (d) {
    return { id: d.id, name: d.name, payout: d.payout, district: d.district, done: false };
  });

  M.cash = 0;               // ledger misi (API §0)
  M.rep = 0;                // ledger REP misi (API §0)
  M.active = null;          // misi aktif {id, name, objective, timer, stage, stages, stageIndex}
  M.marker = null;          // mesh berlian merah (dibuat malas saat misi aktif)
  M.markerTarget = null;    // {x, z, district} objektif saat ini
  M.standoff = 4;           // kru Saltjack tersisa (misi 7); 4 -> 0

  // ---------------------------------------------------------------------------
  // Helper internal
  // ---------------------------------------------------------------------------
  function findDef(id) {
    for (var i = 0; i < MISSION_DEFS.length; i++) {
      if (MISSION_DEFS[i].id === id) return MISSION_DEFS[i];
    }
    return null;
  }

  function districtCenter(name) {
    var ds = SB.city && SB.city.districts;
    if (Array.isArray(ds)) {
      for (var i = 0; i < ds.length; i++) {
        if (ds[i] && ds[i].name === name) return { x: ds[i].cx, z: ds[i].cz };
      }
    }
    return null;
  }

  function heroPos() {
    if (SB.engine && typeof SB.engine.heroPos === 'function') {
      var p = SB.engine.heroPos();
      if (p && p.length >= 2 && typeof p[0] === 'number') return { x: p[0], z: p[1] };
    }
    if (SB.player && typeof SB.player.pos === 'function') {
      var q = SB.player.pos();
      if (q && q.length >= 2 && typeof q[0] === 'number') return { x: q[0], z: q[1] };
    }
    return null;
  }

  function fmtTime(sec) {
    var s = Math.max(0, Math.ceil(sec));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function currentStage() {
    if (!M.active) return null;
    var def = findDef(M.active.id);
    if (!def) return null;
    return def.stages[M.active.stageIndex] || null;
  }

  function resolveTarget() {
    var st = currentStage();
    if (!st) { M.markerTarget = null; return; }
    var c = districtCenter(st.district);
    M.markerTarget = c ? { x: c.x, z: c.z, district: st.district } : null;
  }

  function setObjective(text) {
    if (SB.state) SB.state.objective = text || '';
  }

  // Panel misi + GPS hidup: panggil hud.update + map.render langsung tiap
  // transisi (API §8, catatan r9). Aman bila hud/map belum ada.
  function notifyHUD() {
    try {
      if (SB.hud && typeof SB.hud.update === 'function') SB.hud.update();
    } catch (e) {}
    try {
      if (SB.map && typeof SB.map.render === 'function') SB.map.render();
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // Marker objektif: berlian merah KECIL (oktahedron), melayang + berputar.
  // Dibuat malas — tanpa THREE/scene, misi tetap jalan sebagai data.
  // ---------------------------------------------------------------------------
  function ensureMarker() {
    if (M.marker) return M.marker;
    if (typeof THREE === 'undefined') return null;
    if (!SB.engine || !SB.engine.scene) return null;
    try {
      var geo = new THREE.OctahedronGeometry(MARKER_SIZE, 0);
      var mat = new THREE.MeshBasicMaterial({ color: 0xff2233 });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, MARKER_HEIGHT, 0);
      SB.engine.scene.add(mesh);
      M.marker = mesh;
    } catch (e) {
      M.marker = null;
    }
    return M.marker;
  }

  function placeMarker() {
    var mesh = ensureMarker();
    if (mesh && M.markerTarget) {
      mesh.position.set(M.markerTarget.x, MARKER_HEIGHT, M.markerTarget.z);
      mesh.visible = true;
    } else if (mesh) {
      mesh.visible = false;
    }
  }

  function hideMarker() {
    if (M.marker && SB.engine && SB.engine.scene) {
      try { SB.engine.scene.remove(M.marker); } catch (e) {}
    }
    M.marker = null;
  }

  // ---------------------------------------------------------------------------
  // API publik (API §8)
  // ---------------------------------------------------------------------------

  // Mulai misi: set aktif + objektif stage 1 + marker + panel hidup.
  M.start = function (id) {
    var def = findDef(id);
    if (!def) return false;
    if (M.active && M.active.id === id) return true;
    M.active = {
      id: def.id,
      name: def.name,
      objective: def.stages[0].objective,
      timer: def.time,
      stage: 1,
      stages: def.stages.length,
      stageIndex: 0
    };
    resolveTarget();
    setObjective(M.active.objective);
    placeMarker();
    notifyHUD();
    return true;
  };

  // Selesaikan misi: +payout, +REP, tandai done, bersihkan aktif + marker.
  // Misi 1 = +$500 / REP +130 (API §8).
  M.complete = function (id) {
    var def = findDef(id);
    if (!def) return false;
    M.cash += def.payout;
    M.rep += def.rep;
    if (typeof SB.cash === 'number') SB.cash += def.payout;
    if (SB.state && typeof SB.state.rep === 'number') SB.state.rep += def.rep;
    for (var i = 0; i < M.list.length; i++) {
      if (M.list[i].id === id) M.list[i].done = true;
    }
    if (M.active && M.active.id === id) {
      M.active = null;
      setObjective('');
      hideMarker();
    }
    notifyHUD();
    return true;
  };

  // Gagal karena waktu habis: aktif dibersihkan, tanpa payout/REP.
  function failActive() {
    if (!M.active) return;
    M.active = null;
    setObjective('');
    hideMarker();
    notifyHUD();
  }

  // Pindah ke stage berikut; habis stage -> complete().
  function advanceStage() {
    if (!M.active) return;
    var def = findDef(M.active.id);
    if (!def) return;
    M.active.stageIndex += 1;
    if (M.active.stageIndex >= def.stages.length) {
      M.complete(M.active.id);
      return;
    }
    var st = def.stages[M.active.stageIndex];
    M.active.stage = M.active.stageIndex + 1;
    M.active.objective = st.objective;
    resolveTarget();
    setObjective(st.objective);
    placeMarker();
    notifyHUD();
  }

  // Dipanggil main loop TIAP frame (wajib; tanpa ini misi tidak jalan).
  // Main loop men-gate pada !SB.state.paused; guard di sini juga aman.
  M.update = function (dt) {
    if (!M.active) return;
    if (SB.state && SB.state.paused) return;
    if (typeof dt !== 'number' || dt <= 0) return;
    if (dt > 1) dt = 1;
    M.active.timer -= dt;
    if (M.active.timer <= 0) {
      M.active.timer = 0;
      failActive();
      return;
    }
    // Marker mengambang + berputar — murni fungsi simTime (deterministik).
    if (M.marker) {
      var t = (SB.state && typeof SB.state.simTime === 'number') ? SB.state.simTime : 0;
      M.marker.position.y = MARKER_HEIGHT + Math.sin(t * 2) * 0.5;
      M.marker.rotation.y += dt;
      if (M.markerTarget) {
        M.marker.position.x = M.markerTarget.x;
        M.marker.position.z = M.markerTarget.z;
      }
    }
    // Resolve target malas (kota mungkin baru selesai dibangun).
    if (!M.markerTarget) {
      resolveTarget();
      placeMarker();
    }
    if (!M.markerTarget) return;
    var hp = heroPos();
    if (!hp) return;
    var dx = hp.x - M.markerTarget.x;
    var dz = hp.z - M.markerTarget.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    var st = currentStage();
    // Stage standoff (misi 7) selesai via standoffDown(), bukan jarak.
    if (st && st.standoff) return;
    if (dist <= STAGE_RADIUS) advanceStage();
  };

  // Staging QUIET: set misi aktif + objektif tanpa dialog (API §8).
  // Dipakai preset mission/big-score: The Big Score aktif di depan bank.
  M.demo = function () {
    M.start(8);
  };

  // Dipanggil SB.player saat ped userData.boss=true tumbang (API §8).
  // Counter standoff turun; Saltjack 4 -> 3 -> ... -> 0 lalu stage lanjut.
  M.standoffDown = function () {
    if (M.standoff > 0) M.standoff -= 1;
    var st = currentStage();
    if (M.active && M.active.id === 7 && st && st.standoff && M.standoff <= 0) {
      advanceStage();
    } else {
      notifyHUD();
    }
  };

  // GPS numerik untuk panel misi, mis. "objective 122 m away".
  // Kosong bila tidak ada misi aktif / target belum ter-resolve.
  M.getGPS = function () {
    if (!M.active || !M.markerTarget) return '';
    var hp = heroPos();
    if (!hp) return '';
    var dx = hp.x - M.markerTarget.x;
    var dz = hp.z - M.markerTarget.z;
    var dist = Math.round(Math.sqrt(dx * dx + dz * dz));
    return 'objective ' + dist + ' m away';
  };

  // Data panel misi untuk HUD (API §8 + juri r12): nama / STAGE x/y / NEXT /
  // timer / PAYOUT / GPS numerik. Tanpa misi aktif -> {active:false}.
  M.getHUD = function () {
    if (!M.active) return { active: false };
    var def = findDef(M.active.id);
    return {
      active: true,
      id: M.active.id,
      name: M.active.name.toUpperCase(),
      stage: M.active.stage,
      stages: M.active.stages,
      objective: M.active.objective,
      timer: M.active.timer,
      timerText: fmtTime(M.active.timer),
      payout: def ? def.payout : 0,
      gps: M.getGPS()
    };
  };

})();
