// map.js — peta kota penuh Solmar Bay (M). B4 r7, tulis segar dari API.md r7.
// Distrik {name,cx,cz,w,d}; jalan segmen {x0,z0,x1,z1}; judul di header DOM;
// legenda 9 item; label distrik di-clamp (Bayline Docks utuh); jobs
// DONE/ACTIVE/LOCKED; GPS jarak ke objektif.
(function () {
  'use strict';
  var SB = window.SB;
  var ov = null, cv = null, ctx = null, openFlag = false;
  var LEGEND = [
    ['Story contact', '#ffd23f', '◆'], ['Job objective', '#ff5f5f', '◆'],
    ['Safehouse', '#39d95e', '■'], ['Weapons', '#c07bff', '■'],
    ['Respray', '#39d0ff', '●'], ['Street race', '#ff9f1c', '▲'],
    ['Property', '#e8e8e8', '■'], ['Hospital', '#ffffff', '+'],
    ['Police', '#4f8cff', '●']
  ];
  function build() {
    if (ov) return;
    ov = document.createElement('div');
    ov.id = 'mapov'; ov.style.display = 'none';
    var head = document.createElement('div');
    head.id = 'map-head'; head.className = 'map-head';
    var t = document.createElement('div');
    t.id = 'map-title'; t.textContent = 'SOLMAR BAY';
    var s = document.createElement('div');
    s.id = 'map-sub'; s.textContent = 'M — close · GPS live';
    head.appendChild(t); head.appendChild(s); ov.appendChild(head);
    var body = document.createElement('div');
    body.id = 'map-body'; body.className = 'map-body';
    cv = document.createElement('canvas');
    cv.id = 'map-canvas'; cv.width = 760; cv.height = 620;
    body.appendChild(cv);
    var side = document.createElement('div');
    side.id = 'map-side'; side.className = 'map-side';
    var jh = document.createElement('div');
    jh.className = 'map-sidehead'; jh.textContent = 'JOBS — 8';
    side.appendChild(jh);
    var jl = document.createElement('div');
    jl.id = 'map-jobs'; side.appendChild(jl);
    var gps = document.createElement('div');
    gps.id = 'map-gps'; side.appendChild(gps);
    var lh = document.createElement('div');
    lh.className = 'map-sidehead'; lh.textContent = 'LEGEND';
    side.appendChild(lh);
    var lg = document.createElement('div');
    lg.id = 'map-legend'; side.appendChild(lg);
    body.appendChild(side); ov.appendChild(body);
    document.body.appendChild(ov);
    ctx = cv.getContext('2d');
  }
  function jobs() {
    if (SB.missions && SB.missions.list) return SB.missions.list;
    if (SB.missions && SB.missions.JOBS) return SB.missions.JOBS;
    return [];
  }
  function activeJob() {
    if (SB.missions) {
      var a = SB.missions.active;
      if (typeof a === 'function') { try { return a() || null; } catch (e) { return null; } }
      if (a && typeof a === 'object') return a;
    }
    return SB.state.mission || null;
  }
  function heroPos() {
    if (SB.engine && typeof SB.engine.heroPos === 'function') {
      try { var p = SB.engine.heroPos(); if (p) return { x: p[0], z: p[1] }; } catch (e) {}
    }
    if (SB.player && typeof SB.player.pos === 'function') {
      try { var q = SB.player.pos(); if (q) return { x: q[0], z: q[1] }; } catch (e) {}
    }
    if (SB.world && SB.world.player && SB.world.player.pos) return { x: SB.world.player.pos.x, z: SB.world.player.pos.z };
    return null;
  }
  function render() {
    build();
    if (!ctx) return;
    var W = 760, H = 620, pad = 14;
    var b = { minX: -560, maxX: 470, minZ: -470, maxZ: 530 };
    if (SB.world && SB.world.bounds) b = SB.world.bounds;
    var sc = Math.min((W - pad * 2) / (b.maxX - b.minX), (H - pad * 2) / (b.maxZ - b.minZ));
    var ox = pad + ((W - pad * 2) - (b.maxX - b.minX) * sc) / 2;
    var oy = pad + ((H - pad * 2) - (b.maxZ - b.minZ) * sc) / 2;
    function px(x) { return ox + (x - b.minX) * sc; }
    function py(z) { return oy + (z - b.minZ) * sc; }
    ctx.fillStyle = '#0a121c'; ctx.fillRect(0, 0, W, H);
    var i, d;
    var dists = (SB.city && SB.city.districts) || (SB.world && SB.world.districts) || [];
    // Dua pass: dulu semua kotak distrik, BARU semua label (B5 r7) — kalau label
    // digambar selang-seling dengan kotak, kotak distrik belakangan menutupi label
    // distrik sebelumnya ('Coral Strand' jadi 'l Strand'). Label digeser +-9 px
    // menurut sisi (cx<0 naik, cx>=0 turun) supaya label distrik sebaris yang
    // berdekatan ('Neon Mile'/'Deco Row', 'Keystone Field'/'Bayline Docks')
    // tidak bertumpuk; bayangan hitam supaya terbaca di atas grid.
    for (i = 0; i < dists.length; i++) {
      d = dists[i];
      var x0 = (d.x0 != null ? d.x0 : d.cx - d.w / 2), z0 = (d.z0 != null ? d.z0 : d.cz - d.d / 2);
      var w = (d.x1 != null ? d.x1 - d.x0 : d.w), h = (d.z1 != null ? d.z1 - d.z0 : d.d);
      ctx.fillStyle = d.tint || '#16283a';
      ctx.fillRect(px(x0), py(z0), w * sc, h * sc);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.strokeRect(px(x0), py(z0), w * sc, h * sc);
    }
    for (i = 0; i < dists.length; i++) {
      d = dists[i];
      var x0b = (d.x0 != null ? d.x0 : d.cx - d.w / 2), z0b = (d.z0 != null ? d.z0 : d.cz - d.d / 2);
      var wb = (d.x1 != null ? d.x1 - d.x0 : d.w), hb = (d.z1 != null ? d.z1 - d.z0 : d.d);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 4;
      var tw = ctx.measureText(d.name).width;
      var lx = Math.max(tw / 2 + 4, Math.min(W - tw / 2 - 4, px(x0b + wb / 2)));
      var ly = Math.max(16, Math.min(H - 6, py(z0b + hb / 2) + ((x0b + wb / 2) < 0 ? -9 : 9)));
      ctx.fillText(d.name, lx, ly);
      ctx.shadowBlur = 0;
    }
    var roads = (SB.city && SB.city.roads) || (SB.world && SB.world.roads) || [];
    ctx.strokeStyle = '#46586a'; ctx.lineWidth = 3;
    for (i = 0; i < roads.length; i++) {
      var r = roads[i];
      ctx.beginPath();
      if (r.axis) {
        if (r.axis === 'z') { ctx.moveTo(px(r.at), py(r.from)); ctx.lineTo(px(r.at), py(r.to)); }
        else { ctx.moveTo(px(r.from), py(r.at)); ctx.lineTo(px(r.to), py(r.at)); }
      } else { ctx.moveTo(px(r.x0), py(r.z0)); ctx.lineTo(px(r.x1), py(r.z1)); }
      ctx.stroke();
    }
    function dot(x, z, c, rad) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(px(x), py(z), rad, 0, 6.2832); ctx.fill(); }
    if (SB.city && SB.city.bank && SB.city.bank.pos) {
      var bp = SB.city.bank.pos;
      ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('$', px(bp[0]), py(bp[2]) + 5);
    }
    var sp = (SB.city && SB.city.spawnPoints) || (SB.world && SB.world.spawns) || {};
    if (sp.safehouse) dot(sp.safehouse.x != null ? sp.safehouse.x : sp.safehouse[0], sp.safehouse.z != null ? sp.safehouse.z : sp.safehouse[1], '#39d95e', 6);
    var tgt = null, act = activeJob();
    if (act && act.target) tgt = act.target;
    if (tgt) {
      var tx = tgt.x != null ? tgt.x : tgt[0], tz = tgt.z != null ? tgt.z : tgt[1];
      ctx.save(); ctx.translate(px(tx), py(tz)); ctx.rotate(0.7854);
      ctx.fillStyle = '#ff5f5f'; ctx.fillRect(-5, -5, 10, 10); ctx.restore();
    }
    var cops = (SB.police && SB.police.cops) || (SB.world && SB.world.police) || [];
    for (i = 0; i < cops.length; i++) {
      var p = cops[i];
      if (p.pos) dot(p.pos.x, p.pos.z, '#4f8cff', 4);
      else if (typeof p.x === 'number') dot(p.x, p.z, '#4f8cff', 4);
    }
    var hp = heroPos();
    if (hp) {
      var hd = (SB.world && SB.world.player && SB.world.player.heading) || (SB.vehicles && SB.vehicles.active && SB.vehicles.active.heading) || 0;
      ctx.save(); ctx.translate(px(hp.x), py(hp.z)); ctx.rotate(-hd);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    var list = jobs(), doneCount = 0;
    list.forEach(function (j) { if (j.done) doneCount++; });
    var jl = document.getElementById('map-jobs');
    if (jl) {
      var html = '';
      list.forEach(function (job, k) {
        var stt = job.done ? 'DONE' : (act && act.id === job.id) ? 'ACTIVE' : k === doneCount ? 'ACTIVE' : k < doneCount ? 'DONE' : 'LOCKED';
        html += '<div class="map-job ' + stt.toLowerCase() + '"><span class="map-jobnum">' + (k + 1) + '</span> ' +
          '<span class="map-jobtitle">' + (job.name || job.title || job.id || '').toUpperCase() + '</span> ' +
          '<span class="map-jobpay">$' + (job.payout || 0).toLocaleString('en-US') + '</span> ' +
          '<span class="map-jobst">' + stt + '</span></div>';
      });
      jl.innerHTML = html;
    }
    var lg = document.getElementById('map-legend');
    if (lg) {
      var lh = '';
      LEGEND.forEach(function (g) {
        lh += '<div class="map-leg"><span style="color:' + g[1] + '">' + g[2] + '</span> ' + g[0] + '</div>';
      });
      lg.innerHTML = lh;
    }
    var gps = document.getElementById('map-gps');
    if (gps) {
      var gtxt = 'GPS: no active objective';
      if (tgt && hp) {
        var tx2 = tgt.x != null ? tgt.x : tgt[0], tz2 = tgt.z != null ? tgt.z : tgt[1];
        var dx = tx2 - hp.x, dz = tz2 - hp.z;
        gtxt = 'GPS: objective ' + Math.round(Math.sqrt(dx * dx + dz * dz)) + ' m away';
      } else if (act && act.objective) gtxt = 'GPS: ' + act.objective;
      gps.textContent = gtxt;
    }
  }
  function show() {
    build(); openFlag = true; ov.style.display = '';
    SB.state.paused = true;
    if (typeof SB.setPaused === 'function') { try { SB.setPaused(true); } catch (e) {} }
    render();
  }
  function hide() {
    openFlag = false;
    if (ov) ov.style.display = 'none';
    SB.state.paused = false;
    if (typeof SB.setPaused === 'function') { try { SB.setPaused(false); } catch (e) {} }
  }
  function toggle() { if (openFlag) hide(); else show(); }
  SB.map = { show: show, hide: hide, toggle: toggle, render: render, open: show, close: hide, isOpen: function () { return openFlag; }, LEGEND: LEGEND };
})();
