// Solmar Bay — full map screen (B4, v4-rebuild r4). Canvas fills the overlay
// edge-to-edge (no black bars): non-uniform world fit at zoom 1, hero-centred zoom.
// District labels drawn LAST with a black outline so they never clip.
(function () {
  var SB = window.SB = window.SB || {};
  var open = false, el = null, cv = null, ctx2d = null, zoom = 1, pausedBefore = false;
  var ZOOMS = [1, 1.6, 2.5, 4];
  var WORLD = 170; // city x,z in +/-170
  var ROAD_COLOR = '#2e3d46', SEA = '#0e3a4d', LAND = '#12242c', GRID = '#1b2f38';

  function heroXY() {
    var x = 0, z = 0, h = 0;
    try {
      var hp = SB.engine && SB.engine.heroPos ? SB.engine.heroPos() : null;
      if (hp) { x = hp.x; z = hp.z; }
      var eh = SB.engine && SB.engine.hero;
      if (eh) h = eh.heading || 0;
    } catch (e) {}
    return { x: x, z: z, heading: h };
  }
  function bossXY() {
    try {
      var b = SB.missions && SB.missions.boss;
      if (b && b.position) return { x: b.position.x, z: b.position.z, on: true };
      var bs = (SB.police && SB.police.bosses) || [];
      if (bs.length && bs[0] && bs[0].position) return { x: bs[0].position.x, z: bs[0].position.z, on: true };
      var m = SB.missions && SB.missions.marker;
      if (m && m.on && m.label === 'SALTJACK') return { x: m.x, z: m.z, on: true };
    } catch (e) {}
    return { x: 0, z: 0, on: false };
  }
  function objMarker() {
    try { var m = SB.missions && SB.missions.marker; if (m && m.on) return m; } catch (e) {}
    return null;
  }
  function draw() {
    if (!cv || !ctx2d) return;
    var W = cv.width, H = cv.height, c = ctx2d;
    c.fillStyle = LAND; c.fillRect(0, 0, W, H); // full-bleed base, never black
    var sx = W / (WORLD * 2) * zoom, sy = H / (WORLD * 2) * zoom;
    var cx = W / 2, cy = H / 2;
    var hx = heroXY().x, hz = heroXY().z;
    var X = function (x) { return zoom > 1 ? cx + (x - hx) * sx : cx + x * sx; };
    var Z = function (z) { return zoom > 1 ? cy + (z - hz) * sy : cy + z * sy; };
    // sea west of x=-144, beach strip
    c.fillStyle = SEA; c.fillRect(0, 0, Math.max(0, X(-144)), H);
    c.fillStyle = '#c9a86a'; c.fillRect(Math.max(0, X(-158)), 0, Math.max(0, X(-144) - X(-158)), H);
    // districts
    var ds = [];
    try { ds = (SB.city && SB.city.districts) || []; } catch (e) {}
    for (var i = 0; i < ds.length; i++) {
      var d = ds[i];
      c.fillStyle = '#' + ('000000' + (d.color >>> 0).toString(16)).slice(-6);
      c.globalAlpha = 0.28;
      c.fillRect(X(d.cx - 48), Z(d.cz - 48), 96 * sx, 96 * sy);
      c.globalAlpha = 1; c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1;
      c.strokeRect(X(d.cx - 48), Z(d.cz - 48), 96 * sx, 96 * sy);
    }
    // roads grid
    c.strokeStyle = ROAD_COLOR; c.lineWidth = Math.max(2, 12 * sx * 0.6);
    var roads = [-144, -96, -48, 0, 48, 96, 144];
    for (var r = 0; r < roads.length; r++) {
      c.beginPath(); c.moveTo(X(roads[r]), Z(-WORLD)); c.lineTo(X(roads[r]), Z(WORLD)); c.stroke();
      c.beginPath(); c.moveTo(X(-WORLD), Z(roads[r])); c.lineTo(X(WORLD), Z(roads[r])); c.stroke();
    }
    c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 1;
    for (var g = -160; g <= 160; g += 16) {
      c.beginPath(); c.moveTo(X(g), Z(-WORLD)); c.lineTo(X(g), Z(WORLD)); c.stroke();
      c.beginPath(); c.moveTo(X(-WORLD), Z(g)); c.lineTo(X(WORLD), Z(g)); c.stroke();
    }
    // buildings
    var bs = [];
    try { bs = (SB.city && SB.city.buildings) || []; } catch (e) {}
    c.fillStyle = '#22383f';
    for (var b = 0; b < bs.length; b++) {
      c.fillRect(X(bs[b].x - bs[b].w / 2), Z(bs[b].z - bs[b].d / 2), Math.max(1.5, bs[b].w * sx), Math.max(1.5, bs[b].d * sy));
    }
    // bank
    try {
      var bk = SB.city && SB.city.bank;
      if (bk) { c.fillStyle = '#f5c542'; c.fillRect(X(bk.x) - 5, Z(bk.z) - 5, 10, 10); }
    } catch (e) {}
    // traffic cruisers + heli
    try {
      var tr = (SB.city && SB.city.traffic) || [];
      for (var t = 0; t < tr.length; t++) {
        if (!tr[t].active || !tr[t].mesh) continue;
        var px = tr[t].mesh.position.x, pz = tr[t].mesh.position.z;
        c.fillStyle = tr[t].kind === 'cruiser' ? '#3a86ff' : '#c8c8c8';
        c.beginPath(); c.arc(X(px), Z(pz), tr[t].kind === 'cruiser' ? 4 : 2.5, 0, 6.2832); c.fill();
      }
      var heli = SB.city && SB.city.heli;
      if (heli) { c.fillStyle = '#37e0ff'; c.beginPath(); c.arc(X(heli.position.x), Z(heli.position.z), 4, 0, 6.2832); c.fill(); }
    } catch (e) {}
    // objective marker (diamond)
    var om = objMarker();
    if (om) {
      var ox = X(om.x), oz = Z(om.z);
      c.fillStyle = '#ffd23f'; c.strokeStyle = '#000'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(ox, oz - 9); c.lineTo(ox + 9, oz); c.lineTo(ox, oz + 9); c.lineTo(ox - 9, oz); c.closePath(); c.fill(); c.stroke();
      label(om.label || 'OBJECTIVE', ox, oz - 14, '#ffd23f');
    }
    // boss marker (offset from the objective diamond so the two never stack)
    var bo = bossXY();
    if (bo.on) {
      var bx = X(bo.x) + 14, bz = Z(bo.z);
      c.fillStyle = '#ff2e4d'; c.strokeStyle = '#000'; c.lineWidth = 2;
      c.beginPath(); c.arc(bx, bz, 8, 0, 6.2832); c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.font = 'bold 10px system-ui,sans-serif'; c.textAlign = 'center';
      c.fillText('!', bx, bz + 3.5);
      label('BOSS', bx, bz + 20, '#ff5b73');
    }
    // hero arrow
    var hp2 = heroXY();
    var hx2 = X(hp2.x), hz2 = Z(hp2.z);
    c.save(); c.translate(hx2, hz2); c.rotate(-hp2.heading);
    c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -11); c.lineTo(8, 8); c.lineTo(0, 4); c.lineTo(-8, 8); c.closePath(); c.fill(); c.stroke();
    c.restore();
    label('YOU', hx2, hz2 + 20, '#fff');
    // district labels LAST, black outline, never clipped (clamp inside canvas,
    // clear of the jobs panel on the right, nudged up when a marker sits on them)
    c.font = 'bold 13px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    var hxS = X(heroXY().x), hzS = Z(heroXY().z);
    var omS = objMarker() ? { x: X(objMarker().x), y: Z(objMarker().z) } : null;
    for (var di = 0; di < ds.length; di++) {
      var lx = Math.max(46, Math.min(W - 360, X(ds[di].cx))), ly = Math.max(10, Math.min(H - 10, Z(ds[di].cz)));
      var nearMark = (Math.abs(lx - hxS) < 40 && Math.abs(ly - hzS) < 40) || (omS && Math.abs(lx - omS.x) < 40 && Math.abs(ly - omS.y) < 40);
      if (nearMark) ly = Math.max(10, ly - 46);
      c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.9)';
      c.strokeText(ds[di].name.toUpperCase(), lx, ly);
      c.fillStyle = '#f2ede1'; c.fillText(ds[di].name.toUpperCase(), lx, ly);
    }
    // header
    c.textAlign = 'left'; c.font = 'bold 15px system-ui,sans-serif';    c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.9)';
    c.strokeText('SOLMAR BAY', 16, 24); c.fillStyle = '#f5c542'; c.fillText('SOLMAR BAY', 16, 24);
    c.font = '12px system-ui,sans-serif'; c.fillStyle = '#cfe3ea';
    c.fillText('ZOOM x' + zoom + '  [+/-]  [M] close', 16, 44);
    function label(txt, x, y, col) {
      c.font = 'bold 11px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.9)';
      c.strokeText(txt, x, y); c.fillStyle = col; c.fillText(txt, x, y);
    }
  }

  function buildEl() {
    el = document.createElement('div');
    el.id = 'mapov';
    el.style.cssText = 'position:fixed;inset:0;z-index:65;display:none;background:#0a1418;color:#f2ede1;font:15px/1.5 system-ui,sans-serif;';
    cv = document.createElement('canvas');
    cv.id = 'map-canvas';
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    el.appendChild(cv);
    var side = document.createElement('div');
    side.id = 'map-jobs';
    side.style.cssText = 'position:absolute;right:16px;top:16px;width:264px;background:rgba(8,12,18,.92);border:1px solid rgba(245,197,66,.55);border-radius:10px;padding:12px 14px;';
    el.appendChild(side);
    var bar = document.createElement('div');
    bar.style.cssText = 'position:absolute;left:16px;bottom:16px;display:flex;gap:8px;';
    [['ZOOM -', 'map-zoom-out'], ['ZOOM +', 'map-zoom-in'], ['CLOSE [M]', 'map-close']].forEach(function (p) {
      var b = document.createElement('button');
      b.id = p[1]; b.textContent = p[0];
      b.style.cssText = 'background:#182430;color:#f2ede1;border:1px solid #f5c542;border-radius:6px;padding:8px 14px;cursor:pointer;font:13px system-ui,sans-serif;';
      bar.appendChild(b);
    });
    el.appendChild(bar);
    document.body.appendChild(el);
    ctx2d = cv.getContext('2d');
    el.querySelector('#map-zoom-in').addEventListener('click', function () { SB.map.zoomIn(); });
    el.querySelector('#map-zoom-out').addEventListener('click', function () { SB.map.zoomOut(); });
    el.querySelector('#map-close').addEventListener('click', function () { SB.map.close(); });
  }
  function paintJobs() {
    var side = el && el.querySelector('#map-jobs');
    if (!side) return;
    var html = '<b style="letter-spacing:2px;color:#f5c542;">JOBS</b>';
    var jobs = [];
    try { jobs = (SB.missions && SB.missions.jobs) ? SB.missions.jobs() : []; } catch (e) {}
    var activeId = null;
    try { activeId = SB.missions && SB.missions.active ? SB.missions.active.id : null; } catch (e) {}
    for (var i = 0; i < jobs.length; i++) {
      var j = jobs[i];
      var col = j.st === 'DONE' ? '#7ee2a0' : j.st === 'ACTIVE' ? '#ffd23f' : '#8a97a3';
      var mark = ('m' + (j.i + 1)) === activeId ? ' &gt;&gt;' : '';
      html += '<div style="margin:6px 0;color:' + col + ';">' + j.name + ' - $' + j.pay + ' - ' + j.st + mark + '<br><span style="color:#9fb4c0;font-size:12px;">' + j.giver.toUpperCase() + '</span></div>';
    }
    var om = objMarker();
    var gps = om ? ('GPS: ' + (om.label || 'OBJECTIVE') + ' (' + Math.round(om.x) + ', ' + Math.round(om.z) + ')') : 'GPS: NO ACTIVE OBJECTIVE';
    html += '<div style="margin-top:10px;border-top:1px solid #33475a;padding-top:8px;color:#cfe3ea;font-size:13px;">' + gps + '</div>';
    var bo = bossXY();
    if (bo.on) html += '<div style="color:#ff5b73;font-size:13px;">BOSS: SALTJACK (' + Math.round(bo.x) + ', ' + Math.round(bo.z) + ')</div>';
    side.innerHTML = html;
  }

  SB.map = {
    version: '4.0.0-r4',
    isOpen: function () { return open; },
    zoomLevel: function () { return zoom; },
    setZoom: function (z) { zoom = z; if (open) { draw(); paintJobs(); } return zoom; },
    zoomIn: function () { var i = ZOOMS.indexOf(zoom); zoom = ZOOMS[Math.min(ZOOMS.length - 1, i + 1)]; if (open) { draw(); paintJobs(); } return zoom; },
    zoomOut: function () { var i = ZOOMS.indexOf(zoom); zoom = ZOOMS[Math.max(0, i - 1)]; if (open) { draw(); paintJobs(); } return zoom; },
    markers: function () { return { objective: objMarker(), boss: bossXY(), hero: heroXY() }; },
    open: function () {
      if (!el) buildEl();
      open = true;
      try { pausedBefore = !!SB.state.paused; SB.state.paused = true; } catch (e) {}
      el.style.display = 'block';
      cv.width = window.innerWidth || 1280; cv.height = window.innerHeight || 720;
      draw(); paintJobs();
      return true;
    },
    close: function () {
      open = false;
      if (el) el.style.display = 'none';
      try { SB.state.paused = pausedBefore; } catch (e) {}
      return true;
    },
    toggle: function () { return open ? this.close() : this.open(); },
    render: function () { if (open) { draw(); paintJobs(); } return open; }
  };
})();
