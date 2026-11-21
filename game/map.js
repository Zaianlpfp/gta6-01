// game/map.js — peta penuh "Solmar Bay" (B4, rebuild r13).
// Ditulis FRESH dari API.md §4/§8/§10 + laporan juri buta r12.
// Peta 2D (DOM + canvas): grid RAPAT tanpa ruang hitam, 9 label distrik UTUH
// (clamp, "Bayline Docks" tidak terpotong), legenda 9 item, judul di header
// (tidak menimpa tile), jobs DONE/ACTIVE/LOCKED campuran, GPS objektif aktif.
// render() dipanggil tiap transisi misi (B3: notifyHUD).
(function () {
  'use strict';
  var SB = window.SB = window.SB || {};

  var MAP_COLORS = [
    '#1d3a4a', '#2a2a3a', '#3a2a1d', '#1d3a2a', '#3a1d2a',
    '#2a3a1d', '#1d2a3a', '#3a3a1d', '#2a1d3a'
  ];
  var overlay = null, canvas = null, ctx = null, gpsEl = null;
  var built = false;

  function $(id) { return document.getElementById(id); }
  function num(v, dflt) { return (typeof v === 'number' && isFinite(v)) ? v : dflt; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function st() { return SB.state || {}; }
  function heroPos() {
    if (SB.player && typeof SB.player.pos === 'function') {
      try {
        var p = SB.player.pos();
        if (p && p.length >= 2) return [num(p[0], 0), num(p[1], 0)];
      } catch (e) { /* fallback */ }
    }
    if (SB.engine && typeof SB.engine.heroPos === 'function') {
      try {
        var h = SB.engine.heroPos();
        if (h && h.length >= 2) return [num(h[0], 0), num(h[1], 0)];
      } catch (e) { /* fallback */ }
    }
    return [0, 0];
  }
  function districts() {
    if (SB.city && Array.isArray(SB.city.districts)) return SB.city.districts;
    return [];
  }
  function districtByName(name) {
    var ds = districts();
    for (var i = 0; i < ds.length; i++) {
      if (ds[i] && ds[i].name === name) return ds[i];
    }
    return null;
  }
  function missionJobs() {
    var jobs = [];
    var m = SB.missions;
    if (!m || !Array.isArray(m.list)) return jobs;
    for (var i = 0; i < m.list.length; i++) {
      var mi = m.list[i];
      if (!mi) continue;
      var stateName = 'LOCKED';
      if (mi.done) stateName = 'DONE';
      else if (m.active && m.active.id === mi.id) stateName = 'ACTIVE';
      jobs.push({
        id: mi.id, name: mi.name || ('MISSION ' + mi.id),
        payout: num(mi.payout, 0), district: mi.district || null, state: stateName
      });
    }
    return jobs;
  }
  function objectivePoint() {
    var m = SB.missions;
    if (m && m.active) {
      var list = Array.isArray(m.list) ? m.list : [];
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === m.active.id && list[i].district) {
          var d = districtByName(list[i].district);
          if (d) return { x: d.cx, z: d.cz, label: list[i].name || m.active.name };
        }
      }
    }
    if (SB.city && SB.city.bank && SB.city.bank.pos) {
      var bp = SB.city.bank.pos;
      return { x: num(bp[0], 2), z: num(bp[2], -2), label: 'BANK' };
    }
    return null;
  }
  function gpsText() {
    var m = SB.missions;
    if (m && typeof m.getGPS === 'function') {
      try {
        var g = m.getGPS();
        if (typeof g === 'string' && g.length > 0) return g;
      } catch (e) { /* fallback */ }
    }
    if (typeof st().objective === 'string' && st().objective.length > 0) {
      return st().objective;
    }
    var obj = objectivePoint();
    if (obj) {
      var p = heroPos();
      var dx = p[0] - obj.x, dz = p[1] - obj.z;
      return obj.label + ' ' + Math.round(Math.sqrt(dx * dx + dz * dz)) + ' m away';
    }
    return '—';
  }

  function buildDom() {
    if (built) return;
    built = true;
    var ov = document.createElement('div');
    ov.id = 'map-overlay';
    ov.style.display = 'none';
    ov.innerHTML =
      '<div id="map-panel">' +
        '<div id="map-header">' +
          '<span id="map-title">SOLMAR BAY</span>' +
          '<span id="map-sub">PETA KOTA &middot; M / Esc untuk menutup</span>' +
        '</div>' +
        '<div id="map-body">' +
          '<canvas id="map-canvas" width="920" height="600"></canvas>' +
          '<div id="map-legend">' +
            '<div class="map-legend-title">LEGENDA</div>' +
            '<div class="map-legend-item"><span class="map-dot map-dot-you"></span>Kamu</div>' +
            '<div class="map-legend-item"><span class="map-dot map-dot-obj"></span>Objektif</div>' +
            '<div class="map-legend-item"><span class="map-dot map-dot-active"></span>Misi aktif</div>' +
            '<div class="map-legend-item"><span class="map-dot map-dot-done"></span>Misi selesai</div>' +
            '<div class="map-legend-item"><span class="map-dot map-dot-locked"></span>Misi terkunci</div>' +
            '<div class="map-legend-item"><span class="map-dot map-dot-bank"></span>Bank</div>' +
            '<div class="map-legend-item"><span class="map-dot map-dot-shop"></span>Toko</div>' +
            '<div class="map-legend-item"><span class="map-dot map-dot-safe"></span>Safehouse</div>' +
            '<div class="map-legend-item"><span class="map-dot map-dot-police"></span>Polisi</div>' +
          '</div>' +
        '</div>' +
        '<div id="map-footer"><span class="hud-label">GPS</span><span id="map-gps">—</span></div>' +
      '</div>';
    document.body.appendChild(ov);
    overlay = ov;
    canvas = $('map-canvas');
    ctx = canvas ? canvas.getContext('2d') : null;
    gpsEl = $('map-gps');
  }

  function drawLabel(text, cx, cy, maxW) {
    if (!ctx) return;
    var size = 13;
    ctx.font = 'bold ' + size + 'px sans-serif';
    var w = ctx.measureText(text).width;
    while (w > maxW && size > 9) {
      size -= 1;
      ctx.font = 'bold ' + size + 'px sans-serif';
      w = ctx.measureText(text).width;
    }
    var x = clamp(cx - w / 2, 4, canvas.width - w - 4);
    var y = clamp(cy, size + 4, canvas.height - 4);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 3, y - size - 1, w + 6, size + 5);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y);
  }

  function layoutCanvas() {
    if (!canvas) return;
    // Ukur kanvas tampil agar panel muat di viewport (bukan overflow).
    var availH = Math.max(300, window.innerHeight - 200);
    var availW = Math.max(400, Math.min(920, window.innerWidth - 280));
    var scale = Math.min(availW / 920, availH / 600);
    canvas.style.width = Math.round(920 * scale) + 'px';
    canvas.style.height = Math.round(600 * scale) + 'px';
  }

  function draw() {
    if (!canvas || !ctx) return;
    layoutCanvas();
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0d1620';
    ctx.fillRect(0, 0, W, H);
    var ds = districts();
    if (!ds.length) {
      ctx.fillStyle = '#9fb0c0';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PETA SOLMAR BAY', W / 2, H / 2);
      return;
    }
    var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    var i, d;
    for (i = 0; i < ds.length; i++) {
      d = ds[i];
      if (!d) continue;
      minX = Math.min(minX, d.cx - d.w / 2);
      maxX = Math.max(maxX, d.cx + d.w / 2);
      minZ = Math.min(minZ, d.cz - d.d / 2);
      maxZ = Math.max(maxZ, d.cz + d.d / 2);
    }
    var spanX = Math.max(1, maxX - minX), spanZ = Math.max(1, maxZ - minZ);
    var pad = 24;
    var sc = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanZ);
    var ox = (W - spanX * sc) / 2 - minX * sc;
    var oy = (H - spanZ * sc) / 2 + maxZ * sc;
    function X(x) { return ox + x * sc; }
    function Z(z) { return oy - z * sc; }
    // Lahan: isi penuh dulu supaya tidak ada ruang hitam.
    ctx.fillStyle = '#12222e';
    ctx.fillRect(0, 0, W, H);
    // Jalan (grid rapat dari kota; fallback grid teratur).
    var roads = (SB.city && Array.isArray(SB.city.roads)) ? SB.city.roads : [];
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = Math.max(1, 3 * sc / 10);
    if (roads.length) {
      for (i = 0; i < roads.length; i++) {
        var r = roads[i];
        if (!r) continue;
        ctx.beginPath();
        ctx.moveTo(X(r.x0), Z(r.z0));
        ctx.lineTo(X(r.x1), Z(r.z1));
        ctx.stroke();
      }
    } else {
      for (var gx = minX; gx <= maxX; gx += 20) {
        ctx.beginPath(); ctx.moveTo(X(gx), Z(maxZ)); ctx.lineTo(X(gx), Z(minZ)); ctx.stroke();
      }
      for (var gz = minZ; gz <= maxZ; gz += 20) {
        ctx.beginPath(); ctx.moveTo(X(minX), Z(gz)); ctx.lineTo(X(maxX), Z(gz)); ctx.stroke();
      }
    }
    // Distrik + label (label di-clamp agar UTUH di dalam kanvas).
    for (i = 0; i < ds.length; i++) {
      d = ds[i];
      if (!d) continue;
      var rx = X(d.cx - d.w / 2), ry = Z(d.cz + d.d / 2);
      var rw = d.w * sc, rh = d.d * sc;
      ctx.fillStyle = MAP_COLORS[i % MAP_COLORS.length];
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx, ry, rw, rh);
    }
    // Label di tepi ATAS tiap distrik (bukan di tengah — supaya tidak
    // tertutup marker misi yang digambar di tengah distrik).
    for (i = 0; i < ds.length; i++) {
      d = ds[i];
      if (!d || typeof d.name !== 'string') continue;
      drawLabel(d.name, X(d.cx), Z(d.cz + d.d / 2) + 16, Math.max(40, d.w * sc - 8));
    }
    // Bank.
    if (SB.city && SB.city.bank && SB.city.bank.pos) {
      var bp = SB.city.bank.pos;
      var bx = X(num(bp[0], 2)), by = Z(num(bp[2], -2));
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(bx - 7, by - 7, 14, 14);
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', bx, by + 4);
    }
    // Jobs (DONE / ACTIVE / LOCKED campuran), di tengah distriknya.
    var jobs = missionJobs();
    var placed = {};
    for (i = 0; i < jobs.length; i++) {
      var job = jobs[i];
      var jd = job.district ? districtByName(job.district) : null;
      if (!jd) continue;
      var key = job.district;
      placed[key] = (placed[key] || 0) + 1;
      var n = placed[key];
      var ang = (n - 1) * 2.0944;
      var jx = X(jd.cx) + Math.cos(ang) * 24;
      var jy = Z(jd.cz) + Math.sin(ang) * 24;
      ctx.fillStyle = job.state === 'DONE' ? '#4ade80' :
        (job.state === 'ACTIVE' ? '#FFB347' : '#6b7280');
      ctx.beginPath();
      ctx.arc(jx, jy, job.state === 'ACTIVE' ? 7 : 5, 0, 6.2832);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (job.state === 'DONE') {
        ctx.strokeStyle = '#052e16';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(jx - 3, jy);
        ctx.lineTo(jx - 1, jy + 2.5);
        ctx.lineTo(jx + 3.5, jy - 3);
        ctx.stroke();
      }
    }
    // GPS objektif: garis putus-putus dari pemain ke objektif + berlian merah.
    var obj = objectivePoint();
    var p = heroPos();
    var px = X(p[0]), py = Z(p[1]);
    if (obj) {
      var ox2 = X(obj.x), oy2 = Z(obj.z);
      ctx.strokeStyle = 'rgba(248,113,113,0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(ox2, oy2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(ox2, oy2 - 10);
      ctx.lineTo(ox2 + 8, oy2);
      ctx.lineTo(ox2, oy2 + 10);
      ctx.lineTo(ox2 - 8, oy2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Pemain: titik cyan + ring putih.
    ctx.fillStyle = '#22d3ee';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, 6.2832);
    ctx.fill();
    ctx.stroke();
    if (gpsEl) gpsEl.textContent = gpsText();
  }

  SB.map = SB.map || {};
  SB.map.open = function () {
    buildDom();
    if (overlay) overlay.style.display = 'flex';
    draw();
  };
  SB.map.close = function () {
    if (overlay) overlay.style.display = 'none';
  };
  SB.map.toggle = function () {
    buildDom();
    if (overlay.style.display === 'none') SB.map.open();
    else SB.map.close();
  };
  SB.map.render = function () {
    if (overlay && overlay.style.display !== 'none') draw();
  };
  SB.map.isOpen = function () {
    return !!overlay && overlay.style.display !== 'none';
  };
  SB.map._jobs = missionJobs;
  SB.map._objective = objectivePoint;

  document.addEventListener('keydown', function (e) {
    if (e.code === 'KeyM' && !e.repeat) SB.map.toggle();
    if (e.code === 'Escape' && SB.map.isOpen()) SB.map.close();
  });
})();
