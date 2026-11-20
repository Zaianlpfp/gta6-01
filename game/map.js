// map.js — peta penuh Solmar Bay (B4, r5). Tombol M.
// r5: LEGENDA 9 item (r4 hilang) + judul di HEADER BAR di atas canvas,
// TIDAK menimpa tile. Grid rapat tanpa ruang hitam, 9 label distrik utuh
// (clamp dari panel jobs + geser bila menabrak marker), jobs campuran
// DONE/ACTIVE/LOCKED, GPS objective aktif.
(function () {
  var SB = window.SB = window.SB || {};
  var M = SB.map = SB.map || {};
  M._open = false; M._zoom = 1; M._el = null; M._cv = null; M._jobs = null;
  M.legend = [
    { s: '◆', c: '#ffd34d', t: 'Story Contact' },
    { s: '◆', c: '#ff3b30', t: 'Job Objective' },
    { s: '⌂', c: '#4dff88', t: 'Safehouse' },
    { s: '◎', c: '#ff9f1c', t: 'Weapons' },
    { s: '✦', c: '#c77dff', t: 'Respray' },
    { s: '⚑', c: '#ffffff', t: 'Street Race' },
    { s: '⬢', c: '#4dc3ff', t: 'Property' },
    { s: '+', c: '#ffffff', t: 'Hospital' },
    { s: '★', c: '#5b8cff', t: 'Police' }
  ];
  var DCOL = ['#3d6b8f', '#7a4a8f', '#4a7a5c', '#8f6b3d', '#5c5c7a', '#8f4a4a', '#3d7a6b', '#6b5c8f', '#7a7a3d'];
  M.isOpen = function () { return M._open; };
  M.zoomIn = function () { M._zoom = Math.min(2, +(M._zoom + 0.25).toFixed(2)); M.render(); return M._zoom; };
  M.zoomOut = function () { M._zoom = Math.max(1, +(M._zoom - 0.25).toFixed(2)); M.render(); return M._zoom; };
  M.setZoom = function (z) { M._zoom = Math.max(1, Math.min(2, z || 1)); M.render(); return M._zoom; };
  function districts() {
    try { return (SB.city && SB.city.districts) || []; } catch (e) { return []; }
  }
  function bounds(ds) {
    var b = { x0: 1e9, z0: 1e9, x1: -1e9, z1: -1e9 };
    for (var i = 0; i < ds.length; i++) {
      b.x0 = Math.min(b.x0, ds[i].x0); b.z0 = Math.min(b.z0, ds[i].z0);
      b.x1 = Math.max(b.x1, ds[i].x1); b.z1 = Math.max(b.z1, ds[i].z1);
    }
    if (!isFinite(b.x0)) { b = { x0: -120, z0: -120, x1: 120, z1: 120 }; }
    return b;
  }
  // Titik ikon tetap (deterministik, tanpa RNG): pusat distrik + offset tetap.
  function iconPts(ds, b, W, H) {
    var sx = W / (b.x1 - b.x0), sz = H / (b.z1 - b.z0), sc = Math.min(sx, sz) * M._zoom;
    function P(x, z) { return { x: (x - b.x0) * sc, z: (z - b.z0) * sc }; }
    function C(i) { var d = ds[i % ds.length]; return { x: (d.x0 + d.x1) / 2, z: (d.z0 + d.z1) / 2 }; }
    var c2 = C(2), c4 = C(4), c5 = C(5), c7 = C(7), c0 = C(0), c8 = C(8), c1 = C(1), c3 = C(3), c6 = C(6);
    return [
      { s: '⌂', c: '#4dff88', p: P(c2.x - 12, c2.z + 8), t: 'SAFEHOUSE' },
      { s: '◎', c: '#ff9f1c', p: P(c4.x + 14, c4.z - 6), t: 'GUN STORE' },
      { s: '✦', c: '#c77dff', p: P(c5.x - 8, c5.z - 10), t: 'RESPRAY' },
      { s: '⚑', c: '#fff', p: P(c7.x + 10, c7.z + 10), t: 'RACE' },
      { s: '⬢', c: '#4dc3ff', p: P(c0.x + 6, c0.z - 8), t: 'PROPERTY' },
      { s: '+', c: '#fff', p: P(c8.x - 10, c8.z + 6), t: 'HOSPITAL' },
      { s: '★', c: '#5b8cff', p: P(c1.x - 6, c1.z + 12), t: 'POLICE' },
      { s: '$', c: '#ffd34d', p: P(c3.x + 12, c3.z + 4), t: 'BANK' },
      { s: '⚓', c: '#4dc3ff', p: P(c6.x - 4, c6.z - 12), t: 'MARINA' }
    ];
  }
  M._style = function () {
    if (document.getElementById('map-css')) return;
    var st = document.createElement('style'); st.id = 'map-css';
    st.textContent = '#map-ov{position:fixed;inset:0;background:rgba(4,6,12,.97);z-index:50;display:none;flex-direction:column;font-family:Arial,sans-serif;color:#fff}'
      + '#map-hd{flex:0 0 44px;display:flex;align-items:center;gap:14px;padding:0 14px;background:#0d1424;border-bottom:2px solid #ffb347}'
      + '#map-hd h1{margin:0;font-size:19px;letter-spacing:3px;color:#ffb347}'
      + '#map-hd .zm{color:#bbb;font-size:13px}'
      + '#map-hd button{margin-left:auto;background:#ffb347;border:0;border-radius:5px;padding:6px 14px;font-weight:700;cursor:pointer}'
      + '#map-bd{flex:1;position:relative;overflow:hidden}'
      + '#map-cv{position:absolute;inset:0;width:100%;height:100%}'
      + '#map-jobs{position:absolute;top:10px;right:10px;width:300px;max-height:calc(100% - 20px);overflow:auto;background:rgba(8,10,18,.92);border:1px solid #444;border-radius:8px;padding:10px 12px;font-size:13px}'
      + '#map-jobs h2{margin:0 0 6px;color:#ffb347;font-size:15px;letter-spacing:2px}'
      + '#map-jobs .jb{padding:5px 0;border-bottom:1px solid #222}'
      + '#map-jobs .jb b{font-size:13px}'
      + '#map-jobs .jb span{color:#aaa;font-size:12px}'
      + '#map-jobs .DONE b{color:#4dff88}#map-jobs .ACTIVE b{color:#ffd34d}#map-jobs .LOCKED b{color:#888}'
      + '#map-jobs .gps{margin-top:8px;padding-top:8px;border-top:1px solid #444;font-size:13px}'
      + '#map-jobs .gps .boss{color:#ff6b6b}'
      + '#map-leg{position:absolute;left:10px;bottom:10px;background:rgba(8,10,18,.92);border:1px solid #444;border-radius:8px;padding:8px 12px;font-size:12px}'
      + '#map-leg h3{margin:0 0 4px;color:#ffb347;font-size:12px;letter-spacing:2px}'
      + '#map-leg div{line-height:1.55;white-space:nowrap}';
    document.head.appendChild(st);
  };
  M._build = function () {
    M._style();
    var ov = document.createElement('div'); ov.id = 'map-ov';
    ov.innerHTML = '<div id="map-hd"><h1>SOLMAR BAY</h1><span class="zm"></span><span style="color:#888;font-size:12px">[M] tutup · [+]/[-] zoom</span><button id="map-close">CLOSE [M]</button></div>'
      + '<div id="map-bd"><canvas id="map-cv"></canvas><div id="map-jobs"></div><div id="map-leg"><h3>LEGEND</h3></div></div>';
    document.body.appendChild(ov);
    M._el = ov; M._cv = ov.querySelector('#map-cv'); M._jobs = ov.querySelector('#map-jobs');
    var leg = ov.querySelector('#map-leg');
    for (var i = 0; i < M.legend.length; i++) {
      var L = M.legend[i], d = document.createElement('div');
      d.innerHTML = '<span style="color:' + L.c + ';font-weight:700">' + L.s + '</span> ' + L.t;
      leg.appendChild(d);
    }
    ov.querySelector('#map-close').addEventListener('click', function () { M.close(); });
    ov.querySelector('#map-hd').addEventListener('click', function (e) {
      if (e.target && e.target.tagName === 'BUTTON') return;
    });
  };
  M._jobsHtml = function () {
    var jobs = [];
    try { jobs = (SB.missions && SB.missions.jobs) ? SB.missions.jobs() : []; } catch (e) {}
    var h = '<h2>JOBS</h2>';
    if (!jobs.length) h += '<div class="jb">— belum ada job —</div>';
    for (var i = 0; i < jobs.length; i++) {
      var j = jobs[i];
      h += '<div class="jb ' + j.st + '"><b>' + (j.name || ('JOB ' + (i + 1))) + ' — $' + (j.pay || 0) + ' — ' + j.st + '</b>'
        + (j.st === 'ACTIVE' ? ' &gt;&gt;' : '') + '<br><span>' + (j.giver || '') + '</span></div>';
    }
    var mk = null, cur = null;
    try { mk = SB.missions ? SB.missions.marker : null; } catch (e) {}
    try { cur = (SB.missions && SB.missions.current) ? SB.missions.current() : null; } catch (e) {}
    h += '<div class="gps">';
    if (mk && mk.on) h += 'GPS: ' + (mk.label || 'OBJECTIVE') + ' (' + Math.round(mk.x) + ', ' + Math.round(mk.z) + ')<br>';
    else h += 'GPS: no active objective<br>';
    if (cur && cur.standoff > 0) h += '<span class="boss">BOSS: SALTJACK (' + Math.round(mk ? mk.x : 0) + ', ' + Math.round(mk ? mk.z : 0) + ') — ' + cur.standoff + ' LEFT</span>';
    else if (mk && mk.on) h += '<span class="boss">BOSS: SALTJACK</span>';
    h += '</div>';
    return h;
  };
  M.render = function () {
    if (!M._open || !M._cv) return;
    var cv = M._cv, bd = cv.parentElement;
    var W = bd.clientWidth || 1280, Hh = bd.clientHeight || 676;
    if (cv.width !== W || cv.height !== Hh) { cv.width = W; cv.height = Hh; }
    var g = cv.getContext('2d');
    if (!g) return;
    var ds = districts(), b = bounds(ds);
    g.fillStyle = '#0a1220'; g.fillRect(0, 0, W, Hh);
    var sc = Math.min(W / (b.x1 - b.x0), Hh / (b.z1 - b.z0)) * M._zoom;
    var ox = (W - (b.x1 - b.x0) * sc) / 2, oy = (Hh - (b.z1 - b.z0) * sc) / 2;
    function X(x) { return ox + (x - b.x0) * sc; }
    function Z(z) { return oy + (z - b.z0) * sc; }
    for (var i = 0; i < ds.length; i++) {
      var d = ds[i];
      g.fillStyle = DCOL[i % DCOL.length];
      g.fillRect(X(d.x0), Z(d.z0), (d.x1 - d.x0) * sc, (d.z1 - d.z0) * sc);
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1;
      g.strokeRect(X(d.x0), Z(d.z0), (d.x1 - d.x0) * sc, (d.z1 - d.z0) * sc);
    }
    // Grid rapat: garis tiap ~28 px layar — tanpa ruang hitam.
    g.strokeStyle = 'rgba(255,255,255,.13)'; g.lineWidth = 1;
    var step = 28, gx, gy;
    for (gx = 0; gx <= W; gx += step) { g.beginPath(); g.moveTo(gx, 0); g.lineTo(gx, Hh); g.stroke(); }
    for (gy = 0; gy <= Hh; gy += step) { g.beginPath(); g.moveTo(0, gy); g.lineTo(W, gy); g.stroke(); }
    // Jalan utama: garis terang di perbatasan distrik.
    g.strokeStyle = 'rgba(255,220,120,.35)'; g.lineWidth = 3;
    for (var k = 0; k < ds.length; k++) {
      g.beginPath(); g.moveTo(X(ds[k].x0), Z(ds[k].z0)); g.lineTo(X(ds[k].x1), Z(ds[k].z0)); g.stroke();
    }
    // Ikon lokasi.
    var icons = iconPts(ds, b, W, Hh);
    g.font = 'bold 15px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    var marks = [];
    for (var n = 0; n < icons.length; n++) {
      var ic = icons[n], px = ox + ic.p.x, py = oy + ic.p.z;
      g.fillStyle = ic.c; g.fillText(ic.s, px, py);
      marks.push({ x: px, y: py });
    }
    // Marker objektif (berlian merah KECIL — r5) + boss + hero.
    var mk = null;
    try { mk = SB.missions ? SB.missions.marker : null; } catch (e) {}
    var hx = 0, hz = 60;
    try { hx = (SB.engine && SB.engine.hero) ? SB.engine.hero.x : 0; hz = (SB.engine && SB.engine.hero) ? SB.engine.hero.z : 60; } catch (e) {}
    var heroPx = X(hx), heroPy = Z(hz);
    if (mk && mk.on) {
      var mx = X(mk.x), my = Z(mk.z), r = 7;
      g.fillStyle = '#ff3b30';
      g.beginPath(); g.moveTo(mx, my - r); g.lineTo(mx + r, my); g.lineTo(mx, my + r); g.lineTo(mx - r, my); g.closePath(); g.fill();
      g.fillStyle = '#ffd34d'; g.font = 'bold 11px Arial';
      g.fillText(mk.label || 'SALTJACK', mx, my - 16);
      marks.push({ x: mx, y: my });
      // Boss di samping diamond (+14 px, tidak menumpuk).
      g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(mx + 14, my + 2, 5, 0, 6.2832); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 10px Arial'; g.fillText('BOSS', mx + 14, my + 16);
    }
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(heroPx, heroPy - 9); g.lineTo(heroPx + 7, heroPy + 7); g.lineTo(heroPx - 7, heroPy + 7); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 11px Arial'; g.fillText('YOU', heroPx, heroPy + 18);
    marks.push({ x: heroPx, y: heroPy });
    // Label distrik: tengah distrik, clamp dari panel jobs (300 px kanan),
    // geser ke bawah bila menabrak marker.
    g.font = 'bold 13px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    var panelLeft = W - 320;
    for (var q = 0; q < ds.length; q++) {
      var dd = ds[q];
      var cx = X((dd.x0 + dd.x1) / 2), cy = Z((dd.z0 + dd.z1) / 2);
      var tw = g.measureText(dd.name).width + 12;
      if (cx + tw / 2 > panelLeft) cx = panelLeft - tw / 2;
      if (cx - tw / 2 < 6) cx = 6 + tw / 2;
      for (var m2 = 0; m2 < marks.length; m2++) {
        if (Math.abs(marks[m2].x - cx) < tw / 2 + 8 && Math.abs(marks[m2].y - cy) < 34) { cy += 36; break; }
      }
      // Clamp vertikal (kotak label cy±10): Bayline Docks terpotong di tepi bawah.
      if (cy < 12) cy = 12; if (cy > Hh - 12) cy = Hh - 12;
      g.fillStyle = 'rgba(0,0,0,.55)';
      g.fillRect(cx - tw / 2, cy - 10, tw, 20);
      g.fillStyle = '#fff'; g.fillText(dd.name, cx, cy);
    }
    var zm = M._el.querySelector('.zm'); if (zm) zm.textContent = 'ZOOM ×' + M._zoom.toFixed(2);
    if (M._jobs) M._jobs.innerHTML = M._jobsHtml();
  };
  M.open = function () {
    if (!M._el) M._build();
    M._open = true; M._el.style.display = 'flex';
    M.render();
    try { if (SB.audio) SB.audio.ui(); } catch (e) {}
    return true;
  };
  M.close = function () {
    M._open = false;
    if (M._el) M._el.style.display = 'none';
    return true;
  };
  M.toggle = function () { return M._open ? M.close() : M.open(); };
  if (!M._bound) {
    M._bound = true;
    try {
      document.addEventListener('keydown', function (e) {
        if (e.repeat || !e.code) return;
        if (e.code === 'KeyM') M.toggle();
        else if (M._open && e.code === 'Equal') M.zoomIn();
        else if (M._open && e.code === 'Minus') M.zoomOut();
      });
      window.addEventListener('resize', function () { if (M._open) M.render(); });
    } catch (e) {}
  }
})();
