// hud.js — Solmar Bay (gta6-01 v4 r14): HUD panel MELAYANG + minimap (B4)
// Ditulis FRESH dari game/API.md §12. Tanpa acak/jam bawaan JS di file ini:
// semua acak lewat SB.rng(), SB.state.simTime satu-satunya jam sim.
// Panel MELAYANG (bukan bar horizontal): tiap panel position:fixed dengan
// koordinat TETAP (viewport 1280x720, API.md §12). TIDAK ADA elemen selebar
// layar — panel-panel adalah anak langsung <body>, tanpa wrapper 100%.
//
// CATATAN INTEGRASI (penting, dibaca integrator): API.md §14 memerintahkan
// main.js memanggil SB.hud.init() PALING DULU, sebelum bootFromQuery().
// Sementara itu engine.js boot() me-reset SB._updates = [] — jadi registrasi
// SB.hud.update via SB.registerUpdate yang dilakukan di init() akan HILANG
// saat boot jalan, dan HUD membeku (jam tidak maju). Karena itu init()
// membungkus SB.engine.boot SEKALI (guard _bootWrapped): sesudah boot asli
// selesai, update HUD didaftarkan ulang bila belum ada di SB._updates.
// Bungkus ini hanya menyentuh runtime (bukan file engine.js) dan idempotent.
import { SB } from './engine.js';

// ---------------------------------------------------------------------------
// Konstanta layout (API.md §12, viewport acuan 1280x720)
// ---------------------------------------------------------------------------
const MM_SIZE = 204;      // minimap 204x204, bundar
const MM_SCALE = 1.4;     // px per unit dunia, pusat = hero, utara = atas
const WORLD = { x0: -140, x1: 215, z0: -90, z1: 185 };

// Warna distrik untuk minimap (nama -> warna; fallback abu-abu).
const DISTRICT_COLORS = {
  'Old Harbor': '#9a6b4f',
  'Civic Center': '#c9b896',
  'Villa Verde': '#f2c9a0',
  'Deco Row': '#7fb3d5',
  'Downtown': '#5a6b7d',
  'Coral Court': '#e8a87c',
  'Palma Beach': '#f7e8c8',
  'Marina Bay': '#a8c8d8',
  'Solmar Heights': '#e8d8b8',
};

// ---------------------------------------------------------------------------
// Helper kecil
// ---------------------------------------------------------------------------
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

function fmtMoney(n) {
  // $500 / $1.200 / $5.000 — pemisah ribuan titik, gaya Indonesia (sama
  // seperti missions.js supaya angka HUD konsisten di semua panel).
  var s = String(Math.round(n || 0));
  var out = '';
  while (s.length > 3) { out = '.' + s.slice(-3) + out; s = s.slice(0, -3); }
  return '$' + s + out;
}

function fmtClock() {
  if (SB.clockText) return SB.clockText();
  var m = Math.floor(SB.state.clockMinutes || 1044);
  var hh = String(Math.floor(m / 60) % 24).padStart(2, '0');
  var mm = String(m % 60).padStart(2, '0');
  return hh + ':' + mm;
}

function starsText(heat) {
  var h = clamp(Math.round(heat || 0), 0, 5);
  var s = '';
  for (var i = 0; i < 5; i++) s += (i < h) ? '★' : '☆';
  return s;
}

// Set teks elemen hanya bila berubah (hemat DOM + hindari flicker).
function setText(el, txt, cache, key) {
  if (!el) return;
  if (cache[key] !== txt) { cache[key] = txt; el.textContent = txt; }
}

// ---------------------------------------------------------------------------
// SB.hud
// ---------------------------------------------------------------------------
SB.hud = {
  els: {},
  _cache: {},
  _inited: false,
  _bootWrapped: false,
  _mmCtx: null,

  // Fungsi update stabil (satu referensi) supaya ensureRegistered() bisa
  // memeriksa keanggotaan di SB._updates tanpa duplikat.
  _updateFn: function (dt) { SB.hud.update(dt); },

  // -- init ---------------------------------------------------------------
  // Dipanggil PALING DULU di main.js (sebelum bootFromQuery). Mengambil
  // elemen HUD dari index.html; bila ada yang belum ada, dibuat di sini
  // supaya hud tetap jalan saat diuji tanpa index.html lengkap.
  init: function () {
    if (typeof document === 'undefined') return SB.hud;
    SB.hud._grabOrBuild();
    SB.hud._wireEvents();
    SB.hud.ensureRegistered();
    SB.hud._wrapBootOnce();
    SB.hud._inited = true;
    SB.hud.refreshMission();
    SB.hud.update(0);
    return SB.hud;
  },

  // Daftarkan update HUD ke loop engine bila belum terdaftar.
  ensureRegistered: function () {
    if (typeof SB.registerUpdate !== 'function') return;
    if (!SB._updates) SB._updates = [];
    if (SB._updates.indexOf(SB.hud._updateFn) === -1) {
      SB.registerUpdate(SB.hud._updateFn);
    }
  },

  // Bungkus SB.engine.boot sekali: boot() me-reset SB._updates, jadi
  // sesudah boot selesai, daftarkan ulang update HUD.
  _wrapBootOnce: function () {
    if (SB.hud._bootWrapped) return;
    if (!SB.engine || typeof SB.engine.boot !== 'function') return;
    SB.hud._bootWrapped = true;
    var origBoot = SB.engine.boot;
    SB.engine.boot = function (canvas, opts) {
      var r = origBoot.call(SB.engine, canvas, opts);
      SB.hud.ensureRegistered();
      return r;
    };
  },

  // -- DOM ------------------------------------------------------------------
  _grabOrBuild: function () {
    var E = SB.hud.els;
    var doc = document;
    function grab(id) { return doc.getElementById(id); }
    function build(id, cls, html) {
      var el = doc.getElementById(id);
      if (!el) {
        el = doc.createElement('div');
        el.id = id;
        el.className = cls;
        el.innerHTML = html;
        doc.body.appendChild(el);
      }
      return el;
    }
    // Status kiri-atas: health + armor + jam + tanggal.
    E.status = build('hud-status', 'hud-panel', '' +
      '<div class="hud-title">SOLMAR BAY</div>' +
      '<div class="hud-row"><span class="hud-label">HEALTH</span>' +
      '<div class="bar bar-health"><div class="fill" id="hud-health-fill"></div></div>' +
      '<span class="hud-num" id="hud-health-num">100</span></div>' +
      '<div class="hud-row"><span class="hud-label">ARMOR</span>' +
      '<div class="bar bar-armor"><div class="fill" id="hud-armor-fill"></div></div>' +
      '<span class="hud-num" id="hud-armor-num">0</span></div>' +
      '<div class="hud-row hud-clock-row"><span class="hud-clock" id="hud-clock">17:24</span>' +
      '<span class="hud-date" id="hud-date">21 NOV 2026</span></div>');
    // Wanted + cash kanan-atas.
    E.wanted = build('hud-wanted', 'hud-panel', '' +
      '<div class="hud-stars" id="hud-stars">☆☆☆☆☆</div>' +
      '<div class="hud-cash" id="hud-cash">$500</div>' +
      '<div class="hud-sub" id="hud-heat-label">CLEAN</div>');
    // Misi kiri-bawah.
    E.mission = build('hud-mission', 'hud-panel', '' +
      '<div class="hud-mission-name" id="hud-mission-name">NO ACTIVE MISSION</div>' +
      '<div class="hm-row" id="hud-mission-stage-row"><span class="hm-label">STAGE</span> <span id="hud-mission-stage"></span></div>' +
      '<div class="hm-row" id="hud-mission-next-row"><span class="hm-label">NEXT</span> <span id="hud-mission-next"></span></div>' +
      '<div class="hm-row" id="hud-mission-timer-row"><span class="hm-label">TIMER</span> <span id="hud-mission-timer"></span></div>' +
      '<div class="hm-row" id="hud-mission-payout-row"><span class="hm-label">PAYOUT</span> <span id="hud-mission-payout"></span></div>' +
      '<div class="hm-row" id="hud-mission-gps-row"><span class="hm-label">GPS</span> <span id="hud-mission-gps"></span></div>');
    // Crew kiri-bawah (di bawah misi) + REP/rank.
    E.crew = build('hud-crew', 'hud-panel', '' +
      '<div class="hud-title">CREW</div>' +
      '<div id="hud-crew-list"></div>' +
      '<div class="hud-rep"><span id="hud-rep">REP 0</span> <span class="hud-sep">•</span> <span id="hud-rank">ROOKIE</span></div>');
    // Minimap bundar kanan-bawah.
    E.minimap = build('hud-minimap', 'hud-panel hud-minimap', '' +
      '<canvas id="hud-minimap-canvas" width="204" height="204"></canvas>');
    // Radio widget kanan-bawah di atas minimap.
    E.radio = build('hud-radio', 'hud-panel', '' +
      '<button class="hud-radio-btn" id="hud-radio-next" title="Ganti stasiun (R)">♪ <span id="hud-radio-name">SOLMAR FM</span></button>' +
      '<div class="hud-sub" id="hud-radio-genre">pop</div>');
    // Kendaraan kiri-bawah (di atas misi bila inVehicle) — sembunyi bila jalan kaki.
    E.vehicle = build('hud-vehicle', 'hud-panel', '' +
      '<div class="hud-title">VEHICLE <span id="hud-vehicle-name">Flamingo GT</span></div>' +
      '<div class="hud-row"><span class="hud-label">COND</span>' +
      '<div class="bar bar-cond"><div class="fill" id="hud-vehicle-cond-fill"></div></div>' +
      '<span class="hud-num" id="hud-vehicle-cond-num">100</span></div>' +
      '<div class="hud-row"><span class="hud-label">STATUS</span> <span id="hud-vehicle-dented">OK</span></div>');
    E.vehicle.style.display = 'none';
    // Dialog tengah-bawah — isinya diisi SB.dialog (dialog.js); di sini
    // hanya pastikan wadahnya ada.
    E.dialog = grab('hud-dialog');
    if (!E.dialog) {
      E.dialog = doc.createElement('div');
      E.dialog.id = 'hud-dialog';
      E.dialog.className = 'hud-panel hud-dialog';
      E.dialog.style.display = 'none';
      doc.body.appendChild(E.dialog);
    }
    // Referensi elemen dalam.
    E.healthFill = grab('hud-health-fill');
    E.armorFill = grab('hud-armor-fill');
    E.healthNum = grab('hud-health-num');
    E.armorNum = grab('hud-armor-num');
    E.clock = grab('hud-clock');
    E.date = grab('hud-date');
    E.stars = grab('hud-stars');
    E.cash = grab('hud-cash');
    E.heatLabel = grab('hud-heat-label');
    E.missionName = grab('hud-mission-name');
    E.missionStage = grab('hud-mission-stage');
    E.missionNext = grab('hud-mission-next');
    E.missionTimer = grab('hud-mission-timer');
    E.missionPayout = grab('hud-mission-payout');
    E.missionGps = grab('hud-mission-gps');
    E.missionStageRow = grab('hud-mission-stage-row');
    E.missionNextRow = grab('hud-mission-next-row');
    E.missionTimerRow = grab('hud-mission-timer-row');
    E.missionPayoutRow = grab('hud-mission-payout-row');
    E.missionGpsRow = grab('hud-mission-gps-row');
    E.crewList = grab('hud-crew-list');
    E.rep = grab('hud-rep');
    E.rank = grab('hud-rank');
    E.radioName = grab('hud-radio-name');
    E.radioGenre = grab('hud-radio-genre');
    E.radioNext = grab('hud-radio-next');
    E.vehicleName = grab('hud-vehicle-name');
    E.vehicleCondFill = grab('hud-vehicle-cond-fill');
    E.vehicleCondNum = grab('hud-vehicle-cond-num');
    E.vehicleDented = grab('hud-vehicle-dented');
    var mmc = grab('hud-minimap-canvas');
    SB.hud._mmCtx = mmc ? mmc.getContext('2d') : null;
  },

  _wireEvents: function () {
    var E = SB.hud.els;
    // Klik radio: ganti stasiun (SB.radio.next bila ada).
    if (E.radioNext && !E.radioNext._wired) {
      E.radioNext._wired = true;
      E.radioNext.addEventListener('click', function () {
        if (SB.radio && SB.radio.next) SB.radio.next();
        SB.hud.update(0);
      });
    }
    // Klik minimap: buka/tutup peta penuh (SB.map.toggle bila ada).
    if (E.minimap && !E.minimap._wired) {
      E.minimap._wired = true;
      E.minimap.addEventListener('click', function () {
        if (SB.map && SB.map.toggle) SB.map.toggle();
      });
    }
  },

  // -- update (dipanggil tiap engine.step via SB.registerUpdate) -------------
  update: function (dt) {
    if (typeof document === 'undefined') return;
    if (!SB.hud._inited) SB.hud._grabOrBuild();
    var st = SB.state;
    var E = SB.hud.els;
    var C = SB.hud._cache;

    // Jam + tanggal (jam HARUS terlihat di tiap scene).
    setText(E.clock, fmtClock(), C, 'clock');
    setText(E.date, '21 NOV 2026', C, 'date');

    // Health + armor bar.
    var hp = clamp(Math.round(st.health || 0), 0, 100);
    var ar = clamp(Math.round(st.armor || 0), 0, 100);
    if (E.healthFill) E.healthFill.style.width = hp + '%';
    if (E.armorFill) E.armorFill.style.width = ar + '%';
    if (E.healthFill) E.healthFill.style.background = hp > 50 ? '#58d68d' : (hp > 25 ? '#f5b041' : '#e74c3c');
    setText(E.healthNum, String(hp), C, 'hp');
    setText(E.armorNum, String(ar), C, 'ar');

    // Wanted + cash.
    var heat = 0;
    if (SB.police && typeof SB.police.stars === 'number') heat = SB.police.stars;
    else heat = st.heat || 0;
    var stars = '';
    if (SB.police && SB.police.wantedStars) { try { stars = SB.police.wantedStars(); } catch (e) { stars = starsText(heat); } }
    else stars = starsText(heat);
    setText(E.stars, stars, C, 'stars');
    setText(E.cash, fmtMoney(st.cash), C, 'cash');
    setText(E.heatLabel, heat === 0 ? 'CLEAN' : (heat >= 3 ? 'HELI IN SIGHT' : 'WANTED'), C, 'heatLabel');

    // Crew (3) + REP/rank.
    SB.hud._refreshCrew();

    // Radio widget.
    SB.hud._refreshRadio();

    // Kendaraan (hanya bila inVehicle).
    SB.hud._refreshVehicle();

    // Misi: baca dari SB.missions bila ada (teks berubah saja yang ditulis).
    SB.hud.refreshMission();

    // Minimap tiap frame.
    SB.hud.drawMinimap();
  },

  // -- misi -------------------------------------------------------------------
  // Membaca SB.missions.getHUD() (format TETAP API.md §12, tanpa titik-dua
  // setelah label). Dipanggil tiap update + oleh missions.notifyHUD().
  refreshMission: function () {
    if (typeof document === 'undefined') return;
    if (!SB.hud._inited) SB.hud._grabOrBuild();
    var E = SB.hud.els;
    var C = SB.hud._cache;
    var hud = null;
    if (SB.missions && SB.missions.getHUD) {
      try { hud = SB.missions.getHUD(); } catch (e) { hud = null; }
    }
    if (!hud) {
      // Fallback bila modul misi belum ada: tampilkan ringkasan state.
      var m = SB.state.mission;
      hud = m ? {
        name: (m.name || 'MISSION').toUpperCase(),
        stageText: '', next: '', timer: '', payout: '', gps: '',
      } : {
        name: 'NO ACTIVE MISSION', stageText: '', next: '',
        timer: '', payout: '', gps: '',
      };
    }
    setText(E.missionName, hud.name || 'NO ACTIVE MISSION', C, 'mName');
    SB.hud._setMissionRow(E.missionStageRow, E.missionStage, hud.stageText, C, 'mStage');
    SB.hud._setMissionRow(E.missionNextRow, E.missionNext, hud.next, C, 'mNext');
    SB.hud._setMissionRow(E.missionTimerRow, E.missionTimer, hud.timer, C, 'mTimer');
    SB.hud._setMissionRow(E.missionPayoutRow, E.missionPayout, hud.payout, C, 'mPayout');
    SB.hud._setMissionRow(E.missionGpsRow, E.missionGps, hud.gps, C, 'mGps');
  },

  _setMissionRow: function (rowEl, valEl, val, cache, key) {
    if (!rowEl || !valEl) return;
    var v = val || '';
    if (v === '') { rowEl.style.display = 'none'; }
    else {
      rowEl.style.display = '';
      setText(valEl, v, cache, key);
    }
  },

  _refreshCrew: function () {
    var E = SB.hud.els;
    var C = SB.hud._cache;
    var crew = SB.state.crew || [];
    var html = '';
    for (var i = 0; i < crew.length; i++) {
      var c = crew[i];
      html += '<div class="crew-row"><span class="crew-dot ' + (c.ready ? 'ready' : 'busy') + '">●</span> ' +
        '<span class="crew-name">' + c.name + '</span>' +
        '<span class="crew-role">' + c.role + '</span>' +
        '<span class="crew-state">' + (c.ready ? 'READY' : 'BUSY') + '</span></div>';
    }
    if (E.crewList && C.crew !== html) { E.crewList.innerHTML = html; C.crew = html; }
    setText(E.rep, 'REP ' + (SB.state.rep || 0), C, 'rep');
    setText(E.rank, SB.state.rank || 'ROOKIE', C, 'rank');
  },

  _refreshRadio: function () {
    var E = SB.hud.els;
    var C = SB.hud._cache;
    var name = 'SOLMAR FM';
    var genre = 'pop';
    if (SB.radio && SB.radio.current) {
      try {
        var cur = SB.radio.current();
        if (cur) { name = cur.name || name; genre = cur.genre || genre; }
      } catch (e) { /* pakai default */ }
    } else if (SB.radio && SB.radio.stations && SB.radio.stations.length) {
      var s = SB.radio.stations[SB.state.radio || 0] || SB.radio.stations[0];
      if (s) { name = s.name || name; genre = s.genre || genre; }
    }
    setText(E.radioName, name, C, 'radioName');
    setText(E.radioGenre, genre, C, 'radioGenre');
  },

  _refreshVehicle: function () {
    var E = SB.hud.els;
    var C = SB.hud._cache;
    var st = SB.state;
    var show = !!(st.hero && st.hero.inVehicle && st.vehicle);
    if (!E.vehicle) return;
    E.vehicle.style.display = show ? '' : 'none';
    if (!show) return;
    var v = st.vehicle;
    var cond = clamp(Math.round(v.condition == null ? 100 : v.condition), 0, 100);
    setText(E.vehicleName, v.name || 'Vehicle', C, 'vName');
    if (E.vehicleCondFill) E.vehicleCondFill.style.width = cond + '%';
    if (E.vehicleCondFill) E.vehicleCondFill.style.background = cond > 50 ? '#58d68d' : (cond > 25 ? '#f5b041' : '#e74c3c');
    setText(E.vehicleCondNum, String(cond), C, 'vCond');
    var dented = !!v.dented;
    setText(E.vehicleDented, dented ? 'DENTED' : 'OK', C, 'vDented');
    if (E.vehicleDented) E.vehicleDented.style.color = dented ? '#ff6b5e' : '#58d68d';
  },

  // -- minimap ---------------------------------------------------------------
  // Canvas 2D 204x204, utara = atas, pusat = hero, skala 1,4 px/unit.
  // Jalan + gedung + dot hero (kuning) + objective (merah) + polisi (biru)
  // + traffic (putih). Label distrik HANYA di peta penuh (map.js).
  drawMinimap: function () {
    var ctx = SB.hud._mmCtx;
    if (!ctx) return;
    var st = SB.state;
    var hx = st.hero ? st.hero.x : 0;
    var hz = st.hero ? st.hero.z : 0;
    function sx(x) { return MM_SIZE / 2 + (x - hx) * MM_SCALE; }
    function sy(z) { return MM_SIZE / 2 + (z - hz) * MM_SCALE; }

    ctx.save();
    ctx.clearRect(0, 0, MM_SIZE, MM_SIZE);
    // Potong ke lingkaran (panel CSS juga border-radius 50%).
    ctx.beginPath();
    ctx.arc(MM_SIZE / 2, MM_SIZE / 2, MM_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    // Latar darat.
    ctx.fillStyle = '#20293a';
    ctx.fillRect(0, 0, MM_SIZE, MM_SIZE);
    // Pantai (z 150..185) + air (z > 185).
    ctx.fillStyle = '#e6d3a3';
    ctx.fillRect(0, sy(150), MM_SIZE, Math.max(0, sy(185) - sy(150)));
    ctx.fillStyle = '#2e6f8e';
    ctx.fillRect(0, sy(185), MM_SIZE, MM_SIZE - sy(185));
    // Jalan.
    var roads = (SB.city && SB.city.roads) || [];
    ctx.lineCap = 'round';
    for (var i = 0; i < roads.length; i++) {
      var r = roads[i];
      ctx.strokeStyle = '#3d4658';
      ctx.lineWidth = Math.max(3, (r.width || 12) * MM_SCALE * 0.55);
      ctx.beginPath();
      if (r.axis === 'x') { ctx.moveTo(sx(r.from), sy(r.at)); ctx.lineTo(sx(r.to), sy(r.at)); }
      else { ctx.moveTo(sx(r.at), sy(r.from)); ctx.lineTo(sx(r.at), sy(r.to)); }
      ctx.stroke();
    }
    // Gedung (kotak kecil, warna per distrik).
    var blds = (SB.city && SB.city.buildings) || [];
    for (var j = 0; j < blds.length; j++) {
      var b = blds[j];
      var w = Math.max(2, (b.w || 10) * MM_SCALE);
      var d = Math.max(2, (b.d || 10) * MM_SCALE);
      ctx.fillStyle = DISTRICT_COLORS[b.district] || '#54687a';
      ctx.fillRect(sx(b.x) - w / 2, sy(b.z) - d / 2, w, d);
    }
    // Bank: penanda emas.
    if (SB.city && SB.city.bank) {
      ctx.fillStyle = '#ffd76a';
      ctx.fillRect(sx(SB.city.bank.pos.x) - 3, sy(SB.city.bank.pos.z) - 3, 6, 6);
    }
    // Objective misi aktif: berlian merah.
    var obj = SB.hud._objectivePos();
    if (obj) {
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.moveTo(sx(obj.x), sy(obj.z) - 6);
      ctx.lineTo(sx(obj.x) + 5, sy(obj.z));
      ctx.lineTo(sx(obj.x), sy(obj.z) + 6);
      ctx.lineTo(sx(obj.x) - 5, sy(obj.z));
      ctx.closePath();
      ctx.fill();
    }
    // Traffic: dot putih.
    var traffic = (SB.vehicles && SB.vehicles.traffic) || [];
    ctx.fillStyle = '#ffffff';
    for (var k = 0; k < traffic.length; k++) {
      var t = traffic[k];
      var tp = (t.mesh && t.mesh.position) ? t.mesh.position : t;
      if (tp && typeof tp.x === 'number') {
        ctx.fillRect(sx(tp.x) - 1.5, sy(tp.z) - 1.5, 3, 3);
      }
    }
    // Polisi: dot biru (cruiser + heli).
    ctx.fillStyle = '#4da3ff';
    var cruisers = (SB.police && SB.police.cruisers) || [];
    for (var m = 0; m < cruisers.length; m++) {
      var cp = (cruisers[m].mesh && cruisers[m].mesh.position) ? cruisers[m].mesh.position : cruisers[m];
      if (cp && typeof cp.x === 'number') {
        ctx.beginPath();
        ctx.arc(sx(cp.x), sy(cp.z), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (SB.police && SB.police.heli && SB.police.heli.mesh && SB.police.heli.mesh.position) {
      var hp2 = SB.police.heli.mesh.position;
      ctx.beginPath();
      ctx.arc(sx(hp2.x), sy(hp2.z), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Hero: dot kuning + arah heading.
    var heading = (st.hero && typeof st.hero.heading === 'number') ? st.hero.heading : 0;
    var hxs = sx(hx), hzs = sy(hz);
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hxs, hzs);
    ctx.lineTo(hxs + Math.sin(heading) * 9, hzs + Math.cos(heading) * 9);
    ctx.stroke();
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.arc(hxs, hzs, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#20293a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    // Ring luar.
    ctx.strokeStyle = 'rgba(255,215,106,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(MM_SIZE / 2, MM_SIZE / 2, MM_SIZE / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  },

  // Posisi objective misi aktif (dipakai minimap + peta penuh).
  _objectivePos: function () {
    if (SB.missions && SB.missions.active) {
      var m = SB.missions.active;
      if (m.stages && m.stages[m.stage]) {
        var s = m.stages[m.stage];
        return { x: s.x, z: s.z };
      }
    }
    return null;
  },
};

export { SB };
