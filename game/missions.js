// missions.js — Solmar Bay: 8 misi berurutan (B3, r14, fresh dari API.md §10)
// Aturan keras: TIDAK ADA acak bawaan / jam wall-clock. Semua acak lewat SB.rng().
// Satu-satunya jam sim: SB.state.simTime.

(function () {
  var SB = window.SB;

  // ---------------------------------------------------------------------------
  // Daftar misi (nama + payout TETAP, API.md §10). Stage: { text, x, z, kind }
  // kind: 'goto' (sampai < 6 m) | 'heat' (kabur dari polisi) | 'hold' (tahan di titik)
  // ---------------------------------------------------------------------------
  var LIST = [
    {
      id: 1, name: 'First Fare', payout: 500, timer: 180,
      stages: [
        { text: 'Jemput penumpang di Deco Row', x: -60, z: 40, kind: 'goto' },
        { text: 'Antar ke Marina Bay', x: 20, z: 160, kind: 'goto' },
      ],
    },
    {
      id: 2, name: 'Hot Wheels', payout: 800, timer: 180,
      stages: [
        { text: 'Curi Flamingo GT di Downtown', x: 40, z: 40, kind: 'goto' },
        { text: 'Bawa ke safehouse', x: -100, z: 60, kind: 'goto' },
      ],
    },
    {
      id: 3, name: 'Neon Nights', payout: 1200, timer: 240,
      stages: [
        { text: 'Ambil paket di Bar Neon', x: -80, z: 20, kind: 'goto' },
        { text: 'Antar ke Coral Court', x: 140, z: 40, kind: 'goto' },
        { text: 'Kabur dari polisi', x: -100, z: 20, kind: 'heat', heatSeen: 2 },
      ],
    },
    {
      id: 4, name: 'The Getaway', payout: 1500, timer: 240,
      stages: [
        { text: 'Jemput Lucia di Palma Beach', x: -100, z: 160, kind: 'goto' },
        { text: 'Kabur ke Old Harbor', x: -110, z: -60, kind: 'goto' },
      ],
    },
    {
      id: 5, name: 'Harbor Lights', payout: 2000, timer: 240,
      stages: [
        { text: 'Foto kapal di marina', x: 0, z: 170, kind: 'goto' },
        { text: 'Ambil dokumen di Civic Center', x: 60, z: -40, kind: 'goto' },
        { text: 'Serahkan ke Mara', x: -60, z: 60, kind: 'goto' },
      ],
    },
    {
      id: 6, name: 'Double Cross', payout: 2500, timer: 300,
      stages: [
        { text: 'Temui Jax di Villa Verde', x: 160, z: -40, kind: 'goto' },
        { text: 'Ambil uang di Solmar Heights', x: 160, z: 140, kind: 'goto' },
      ],
    },
    {
      id: 7, name: 'Gold Rush', payout: 3500, timer: 300,
      stages: [
        { text: 'Rampok toko emas Coral Court', x: 120, z: 60, kind: 'goto' },
        { text: 'Kabur ke Deco Row', x: -100, z: 20, kind: 'goto' },
        { text: 'Hilangkan polisi', x: -100, z: 20, kind: 'heat', heatSeen: 0 },
      ],
    },
    {
      id: 8, name: 'The Big Score', payout: 5000, timer: 300,
      stages: [
        { text: 'Kumpul di bank', x: 2, z: -2, kind: 'goto' },
        { text: 'Bobol brankas', x: 2, z: -2, kind: 'hold', holdSeconds: 20 },
        { text: 'Kabur ke marina', x: 20, z: 160, kind: 'goto' },
        { text: 'Serahkan tas ke Mara', x: -60, z: 60, kind: 'goto' },
      ],
    },
  ];

  var RANKS = [
    { rep: 1500, rank: 'KINGPIN' },
    { rep: 800, rank: 'HUSTLER' },
    { rep: 300, rank: 'STREET' },
    { rep: 0, rank: 'ROOKIE' },
  ];

  function rankFor(rep) {
    for (var i = 0; i < RANKS.length; i++) {
      if (rep >= RANKS[i].rep) return RANKS[i].rank;
    }
    return 'ROOKIE';
  }

  function fmtMoney(n) {
    // $500 / $1.200 / $5.000 — pemisah ribuan titik, gaya Indonesia.
    var s = String(Math.round(n));
    var out = '';
    while (s.length > 3) { out = '.' + s.slice(-3) + out; s = s.slice(0, -3); }
    return '$' + s + out;
  }

  function fmtTimer(seconds) {
    var s = Math.max(0, Math.ceil(seconds));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' + r : '' + r);
  }

  function distTo(x, z) {
    var h = SB.state.hero;
    var dx = x - h.x;
    var dz = z - h.z;
    var dy = (h.y || 0) - 0;
    return Math.hypot(dx, dy, dz);
  }

  function nearBank(x, z) {
    if (SB.city && SB.city.nearBank) return SB.city.nearBank(x, z);
    return Math.hypot(x - 2, z - (-2)) < 12;
  }

  // ---------------------------------------------------------------------------
  // Marker objective: berlian merah KECIL (octahedron radius 0,8, emissive merah,
  // melayang + berputar di atas titik objective, y = 3 + sin(simTime*2)*0,3).
  // Dibuat malas (lazy): hanya bila THREE + scene sudah ada.
  // ---------------------------------------------------------------------------
  var marker = null;

  function ensureMarker() {
    if (marker) return marker;
    if (typeof THREE === 'undefined') return null;
    if (!SB.engine || !SB.engine.scene) return null;
    var geo = new THREE.OctahedronGeometry(0.8);
    var mat = new THREE.MeshLambertMaterial({
      color: 0xff2233, emissive: 0xcc0011, emissiveIntensity: 1,
    });
    marker = new THREE.Mesh(geo, mat);
    marker.name = 'mission-objective-marker';
    SB.engine.scene.add(marker);
    return marker;
  }

  function removeMarker() {
    if (marker && SB.engine && SB.engine.scene) {
      SB.engine.scene.remove(marker);
    }
    marker = null;
  }

  function placeMarker() {
    var m = SB.missions.active;
    if (!m) { removeMarker(); return; }
    var mk = ensureMarker();
    if (!mk) return;
    var st = m.stages[m.stage];
    mk.position.set(st.x, 3 + Math.sin(SB.state.simTime * 2) * 0.3, st.z);
    mk.rotation.y = SB.state.simTime * 1.2;
    mk.visible = true;
  }

  // ---------------------------------------------------------------------------
  // SB.missions
  // ---------------------------------------------------------------------------
  SB.missions = {
    list: LIST,
    active: null,
    completed: [],          // id misi yang sudah selesai
    _heatSeen: false,       // stage 'heat': pernah mencapai heatSeen?
    _holdTime: 0,           // stage 'hold': detik terkumpul di titik

    start: function (id) {
      var def = null;
      for (var i = 0; i < LIST.length; i++) {
        if (LIST[i].id === id) { def = LIST[i]; break; }
      }
      if (!def) return false;
      if (SB.missions.active) SB.missions.fail('Misi diganti');
      SB.missions.active = {
        id: def.id,
        name: def.name,
        stage: 0,
        stages: def.stages,
        payout: def.payout,
        timer: def.timer,
        timerTotal: def.timer,
        objective: { x: def.stages[0].x, z: def.stages[0].z },
      };
      SB.missions._heatSeen = false;
      SB.missions._holdTime = 0;
      SB.state.mission = SB.missions.active;
      placeMarker();
      // Briefing: 1 baris dialog instan saat misi mulai (API.md §11).
      if (SB.dialog && SB.dialog.briefing) SB.dialog.briefing(def.id);
      SB.missions.notifyHUD();
      return true;
    },

    update: function (dt) {
      var m = SB.missions.active;
      if (!m) return;
      m.timer -= dt;
      if (m.timer <= 0) {
        m.timer = 0;
        SB.missions.fail('Waktu habis');
        return;
      }
      var st = m.stages[m.stage];
      var done = false;
      if (st.kind === 'goto') {
        if (distTo(st.x, st.z) < 6) done = true;
      } else if (st.kind === 'heat') {
        // Kabur dari polisi: harus pernah mencapai heatSeen, lalu heat turun ke 0.
        if (SB.state.heat >= (st.heatSeen || 2)) SB.missions._heatSeen = true;
        if (SB.missions._heatSeen && SB.state.heat === 0) done = true;
        // Bila heatSeen 0 (Gold Rush): cukup heat 0 dari awal stage.
        if ((st.heatSeen || 0) === 0 && SB.state.heat === 0) done = true;
      } else if (st.kind === 'hold') {
        // Bobol brankas: tahan 20 detik di bank.
        if (nearBank(SB.state.hero.x, SB.state.hero.z)) {
          SB.missions._holdTime += dt;
          if (SB.missions._holdTime >= (st.holdSeconds || 20)) done = true;
        } else {
          SB.missions._holdTime = 0;
        }
      }
      if (done) SB.missions._advanceStage();
      placeMarker();
    },

    _advanceStage: function () {
      var m = SB.missions.active;
      if (!m) return;
      SB.missions._heatSeen = false;
      SB.missions._holdTime = 0;
      m.stage += 1;
      if (m.stage >= m.stages.length) {
        SB.missions.complete();
        return;
      }
      var st = m.stages[m.stage];
      m.objective = { x: st.x, z: st.z };
      SB.state.mission = m;
      // Dialog instan saat stage selesai / stage baru dimulai.
      if (SB.dialog && SB.dialog.stageDone) SB.dialog.stageDone(m.id, m.stage);
      SB.missions.notifyHUD();
    },

    complete: function () {
      var m = SB.missions.active;
      if (!m) return false;
      SB.state.cash += m.payout;
      SB.state.rep += 100;
      SB.state.rank = rankFor(SB.state.rep);
      SB.missions.completed.push(m.id);
      removeMarker();
      SB.missions.active = null;
      SB.state.mission = null;
      if (SB.dialog && SB.dialog.missionDone) SB.dialog.missionDone(m.id, m.payout);
      SB.missions.notifyHUD();
      return true;
    },

    fail: function (reason) {
      var m = SB.missions.active;
      if (!m) return false;
      removeMarker();
      SB.missions.active = null;
      SB.state.mission = null;
      if (SB.dialog && SB.dialog.missionFailed) {
        SB.dialog.missionFailed(m.id, reason || 'Gagal');
      }
      SB.missions.notifyHUD();
      return true;
    },

    nextMission: function () {
      for (var i = 0; i < LIST.length; i++) {
        if (SB.missions.completed.indexOf(LIST[i].id) === -1) return LIST[i];
      }
      return null;
    },

    getGPS: function () {
      var m = SB.missions.active;
      if (!m) return '';
      var st = m.stages[m.stage];
      // Format TETAP: 'objective N m away' (N integer, jarak hero -> objective).
      return 'objective ' + Math.round(distTo(st.x, st.z)) + ' m away';
    },

    getHUD: function () {
      var m = SB.missions.active;
      if (m) {
        var st = m.stages[m.stage];
        return {
          name: m.name.toUpperCase(),
          stageText: 'STAGE ' + (m.stage + 1) + '/' + m.stages.length,
          next: st.text,
          timer: fmtTimer(m.timer),
          payout: fmtMoney(m.payout),
          gps: SB.missions.getGPS(),
        };
      }
      // Tak ada misi aktif: tampilkan misi berikutnya + payoutnya.
      var nxt = SB.missions.nextMission();
      if (nxt) {
        return {
          name: 'NO ACTIVE MISSION',
          stageText: '',
          next: 'Next ' + nxt.name + ' ' + fmtMoney(nxt.payout),
          timer: '',
          payout: fmtMoney(nxt.payout),
          gps: '',
        };
      }
      return {
        name: 'NO ACTIVE MISSION',
        stageText: '',
        next: 'Semua misi selesai',
        timer: '',
        payout: '',
        gps: '',
      };
    },

    notifyHUD: function () {
      if (SB.hud && SB.hud.refreshMission) SB.hud.refreshMission();
    },

    // -- Registrasi update (perbaikan integrator, defect r14) ----------------
    // boot() me-reset SB._updates = [], jadi registrasi update() sekali di
    // module-scope HILANG saat boot jalan dan timer misi beku. Pola yang
    // sama seperti boot-wrap B4 di hud.js: daftarkan ulang sesudah boot
    // (bungkus boot sekali, guard _bootWrapped), dengan cek keanggotaan
    // supaya tidak duplikat. update() no-op bila tak ada misi aktif, jadi
    // aman terdaftar sejak import.
    _bootWrapped: false,

    ensureRegistered: function () {
      if (typeof SB.registerUpdate !== 'function') return;
      if (!SB._updates) SB._updates = [];
      if (SB._updates.indexOf(SB.missions.update) === -1) {
        SB.registerUpdate(SB.missions.update);
      }
    },

    _wrapBootOnce: function () {
      if (SB.missions._bootWrapped) return;
      if (!SB.engine || typeof SB.engine.boot !== 'function') return;
      SB.missions._bootWrapped = true;
      var origBoot = SB.engine.boot;
      SB.engine.boot = function (canvas, opts) {
        var r = origBoot.call(SB.engine, canvas, opts);
        SB.missions.ensureRegistered();
        return r;
      };
    },
  };

  // Daftarkan update misi + bungkus boot (lihat komentar di atas).
  SB.missions.ensureRegistered();
  SB.missions._wrapBootOnce();
})();
