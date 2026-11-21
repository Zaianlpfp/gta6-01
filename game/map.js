// map.js — Solmar Bay (gta6-01 v4 r14): peta penuh kota (B4)
// Ditulis FRESH dari game/API.md §13. Tanpa acak/jam bawaan JS di file ini.
// Tombol M (didengar main.js -> SB.map.toggle()) / klik minimap -> overlay
// peta penuh (canvas 2D): jalan, pantai, marina, 71 gedung (kotak kecil),
// polisi. Utara = atas. Label distrik HANYA di sini (bukan di minimap).
import { SB } from './engine.js';

// ---------------------------------------------------------------------------
// Konstanta peta penuh
// ---------------------------------------------------------------------------
const MAP_W = 720;
const MAP_H = 560;
const MARGIN = 20;
// Kota x [-140,215] (355) x z [-90,185] (275): skala pas muat 720x560.
const MAP_SCALE = 1.8;

// Fallback 9 distrik (API.md §6) bila SB.city.districts belum ada.
const FALLBACK_DISTRICTS = [
  { name: 'Old Harbor', x0: -140, x1: -20, z0: -90, z1: 0 },
  { name: 'Civic Center', x0: -20, x1: 100, z0: -90, z1: 0 },
  { name: 'Villa Verde', x0: 100, x1: 215, z0: -90, z1: 0 },
  { name: 'Deco Row', x0: -140, x1: -20, z0: 0, z1: 95 },
  { name: 'Downtown', x0: -20, x1: 100, z0: 0, z1: 95 },
  { name: 'Coral Court', x0: 100, x1: 215, z0: 0, z1: 95 },
  { name: 'Palma Beach', x0: -140, x1: -20, z0: 95, z1: 185 },
  { name: 'Marina Bay', x0: -20, x1: 100, z0: 95, z1: 185 },
  { name: 'Solmar Heights', x0: 100, x1: 215, z0: 95, z1: 185 },
];

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
// SB.map
// ---------------------------------------------------------------------------
SB.map = {
  open: false,
  _canvas: null,
  _ctx: null,
  _inited: false,
  _bootWrapped: false,
  _keyWired: false,

  _updateFn: function (dt) { SB.map._tick(dt); },

  init: function () {
    if (typeof document === 'undefined') return SB.map;
    SB.map._grabOrBuild();
    SB.map._wireKeys();
    SB.map.ensureRegistered();
    SB.map._wrapBootOnce();
    SB.map._inited = true;
    return SB.map;
  },

  ensureRegistered: function () {
    if (typeof SB.registerUpdate !== 'function') return;
    if (!SB._updates) SB._updates = [];
    if (SB._updates.indexOf(SB.map._updateFn) === -1) {
      SB.registerUpdate(SB.map._updateFn);
    }
  },

  // Sama seperti hud.js: boot() me-reset SB._updates, jadi daftarkan ulang
  // tick peta sesudah boot selesai (idempotent, guard _bootWrapped).
  _wrapBootOnce: function () {
    if (SB.map._bootWrapped) return;
    if (!SB.engine || typeof SB.engine.boot !== 'function') return;
    SB.map._bootWrapped = true;
    var origBoot = SB.engine.boot;
    SB.engine.boot = function (canvas, opts) {
      var r = origBoot.call(SB.engine, canvas, opts);
      SB.map.ensureRegistered();
      return r;
    };
  },

  _grabOrBuild: function () {
    var doc = document;
    var overlay = doc.getElementById('map-overlay');
    if (!overlay) {
      overlay = doc.createElement('div');
      overlay.id = 'map-overlay';
      overlay.className = 'map-overlay';
      overlay.style.display = 'none';
      overlay.innerHTML = '' +
        '<div class="map-box">' +
        '<div class="map-title">SOLMAR BAY <span class="map-hint">M / klik untuk menutup</span></div>' +
        '<canvas id="map-canvas" width="720" height="560"></canvas>' +
        '<div class="map-legend">● HERO &nbsp; ◆ OBJECTIVE &nbsp; ● POLISI &nbsp; ● TRAFFIC &nbsp; ★ BANK</div>' +
        '</div>';
      doc.body.appendChild(overlay);
      overlay.addEventListener('click', function () { SB.map.hide(); });
    }
    SB.map._overlay = overlay;
    var canvas = doc.getElementById('map-canvas');
    if (canvas) {
      SB.map._canvas = canvas;
      SB.map._ctx = canvas.getContext('2d');
    }
  },

  // Tombol M dimiliki main.js (ia memanggil SB.map.toggle()); di sini
  // hanya Escape untuk menutup. (Dulu M juga didengar di sini — itu
  // toggle ganda: sekali tekan buka-tutup sekaligus. Jangan dikembalikan.)
  _wireKeys: function () {
    if (SB.map._keyWired) return;
    SB.map._keyWired = true;
    if (typeof document === 'undefined') return;
    document.addEventListener('keydown', function (e) {
      if (!e || e.repeat) return;
      if (e.key === 'Escape' && SB.map.open) SB.map.hide();
    });
  },

  // Tick ringan: gambar ulang hanya bila overlay terbuka (dot bergerak).
  _tick: function (dt) {
    if (SB.map.open) SB.map.draw();
  },

  toggle: function () {
    if (SB.map.open) SB.map.hide();
    else SB.map.show();
  },

  show: function () {
    if (typeof document === 'undefined') return;
    if (!SB.map._inited) SB.map.init();
    SB.map.open = true;
    if (SB.map._overlay) SB.map._overlay.style.display = 'flex';
    SB.map.draw();
  },

  hide: function () {
    SB.map.open = false;
    if (SB.map._overlay) SB.map._overlay.style.display = 'none';
  },

  // -- gambar ---------------------------------------------------------------
  draw: function () {
    var ctx = SB.map._ctx;
    if (!ctx) return;
    var st = SB.state;
    function sx(x) { return MARGIN + (x + 140) * MAP_SCALE; }
    function sy(z) { return MARGIN + (z + 90) * MAP_SCALE; }

    ctx.clearRect(0, 0, MAP_W, MAP_H);
    // Latar darat.
    ctx.fillStyle = '#22303f';
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    // Pantai (z 150..185) + air (z > 185).
    ctx.fillStyle = '#e6d3a3';
    ctx.fillRect(0, sy(150), MAP_W, sy(185) - sy(150));
    ctx.fillStyle = '#2e6f8e';
    ctx.fillRect(0, sy(185), MAP_W, MAP_H - sy(185));
    // Marina: dermaga (garis kayu) di x -40..60, z 155..180.
    ctx.strokeStyle = '#8a6d4b';
    ctx.lineWidth = 4;
    for (var p = 0; p < 3; p++) {
      var dx = -30 + p * 30;
      ctx.beginPath();
      ctx.moveTo(sx(dx), sy(155));
      ctx.lineTo(sx(dx), sy(178));
      ctx.stroke();
    }
    // Jalan.
    var roads = (SB.city && SB.city.roads) || [];
    ctx.lineCap = 'round';
    for (var i = 0; i < roads.length; i++) {
      var r = roads[i];
      ctx.strokeStyle = '#3d4658';
      ctx.lineWidth = Math.max(4, (r.width || 12) * MAP_SCALE * 0.6);
      ctx.beginPath();
      if (r.axis === 'x') { ctx.moveTo(sx(r.from), sy(r.at)); ctx.lineTo(sx(r.to), sy(r.at)); }
      else { ctx.moveTo(sx(r.at), sy(r.from)); ctx.lineTo(sx(r.at), sy(r.to)); }
      ctx.stroke();
      // Garis tengah kuning putus-putus.
      ctx.strokeStyle = '#c9a227';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      if (r.axis === 'x') { ctx.moveTo(sx(r.from), sy(r.at)); ctx.lineTo(sx(r.to), sy(r.at)); }
      else { ctx.moveTo(sx(r.at), sy(r.from)); ctx.lineTo(sx(r.at), sy(r.to)); }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Gedung: kotak kecil warna distrik.
    var blds = (SB.city && SB.city.buildings) || [];
    for (var j = 0; j < blds.length; j++) {
      var b = blds[j];
      var w = Math.max(3, (b.w || 10) * MAP_SCALE);
      var d = Math.max(3, (b.d || 10) * MAP_SCALE);
      ctx.fillStyle = DISTRICT_COLORS[b.district] || '#54687a';
      ctx.fillRect(sx(b.x) - w / 2, sy(b.z) - d / 2, w, d);
    }
    // Bank: bintang emas + label.
    if (SB.city && SB.city.bank) {
      var bx = sx(SB.city.bank.pos.x), bz = sy(SB.city.bank.pos.z);
      ctx.fillStyle = '#ffd76a';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', bx, bz);
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('BANK', bx, bz + 13);
    }
    // Label 9 distrik (tengah tiap distrik, huruf kapital).
    var districts = (SB.city && SB.city.districts && SB.city.districts.length === 9)
      ? SB.city.districts : FALLBACK_DISTRICTS;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var k = 0; k < districts.length; k++) {
      var d = districts[k];
      var cx = sx((d.x0 + d.x1) / 2);
      var cz = sy((d.z0 + d.z1) / 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(10,14,22,0.85)';
      ctx.strokeText(d.name.toUpperCase(), cx, cz);
      ctx.fillStyle = '#f2f0e8';
      ctx.fillText(d.name.toUpperCase(), cx, cz);
    }
    // Traffic: dot putih kecil.
    var traffic = (SB.vehicles && SB.vehicles.traffic) || [];
    ctx.fillStyle = '#ffffff';
    for (var m = 0; m < traffic.length; m++) {
      var t = traffic[m];
      var tp = (t.mesh && t.mesh.position) ? t.mesh.position : t;
      if (tp && typeof tp.x === 'number') {
        ctx.fillRect(sx(tp.x) - 1.5, sy(tp.z) - 1.5, 3, 3);
      }
    }
    // Polisi: dot biru (cruiser + heli).
    ctx.fillStyle = '#4da3ff';
    var cruisers = (SB.police && SB.police.cruisers) || [];
    for (var n = 0; n < cruisers.length; n++) {
      var cp = (cruisers[n].mesh && cruisers[n].mesh.position) ? cruisers[n].mesh.position : cruisers[n];
      if (cp && typeof cp.x === 'number') {
        ctx.beginPath();
        ctx.arc(sx(cp.x), sy(cp.z), 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (SB.police && SB.police.heli && SB.police.heli.mesh && SB.police.heli.mesh.position) {
      var hp = SB.police.heli.mesh.position;
      ctx.beginPath();
      ctx.arc(sx(hp.x), sy(hp.z), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Objective: berlian merah.
    var obj = null;
    if (SB.missions && SB.missions.active) {
      var mm = SB.missions.active;
      if (mm.stages && mm.stages[mm.stage]) obj = mm.stages[mm.stage];
    }
    if (obj) {
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.moveTo(sx(obj.x), sy(obj.z) - 8);
      ctx.lineTo(sx(obj.x) + 7, sy(obj.z));
      ctx.lineTo(sx(obj.x), sy(obj.z) + 8);
      ctx.lineTo(sx(obj.x) - 7, sy(obj.z));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Hero: dot kuning + ring.
    var hx = st.hero ? st.hero.x : 0;
    var hz = st.hero ? st.hero.z : 0;
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.arc(sx(hx), sy(hz), 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#20293a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx(hx), sy(hz), 9, 0, Math.PI * 2);
    ctx.stroke();
  },
};

export { SB };
