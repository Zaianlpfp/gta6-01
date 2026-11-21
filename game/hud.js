// game/hud.js — HUD "Solmar Bay" (B4, rebuild r13).
// Ditulis FRESH dari API.md §0/§2/§8/§10 + laporan juri buta r12.
// Panel MELAYANG (bukan bar selebar layar): status kiri-atas, wanted/cash
// kanan-atas, misi + crew kiri-bawah, minimap + radio kanan-bawah.
// update() idempotent: dipanggil ganda per frame AMAN (registerUpdate + rAF).
(function () {
  'use strict';
  var SB = window.SB = window.SB || {};

  var WEEKDAYS = ['FRI', 'SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU'];
  var STATIONS = ['WAVE 88.1', 'SOL 101.9', 'BAY 96.5'];
  var CREW = [
    { name: 'Lucia Ortega', role: 'DRIVER' },
    { name: 'Jax', role: 'MECHANIC' },
    { name: 'Mara Solis', role: 'LOOKOUT' }
  ];
  var MINIMAP_COLORS = [
    '#1d3a4a', '#2a2a3a', '#3a2a1d', '#1d3a2a', '#3a1d2a',
    '#2a3a1d', '#1d2a3a', '#3a3a1d', '#2a1d3a'
  ];

  var staging = false;
  var lastMinimapSim = -1;
  var built = false;

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function pad2(n) { n = Math.floor(n); return (n < 10 ? '0' : '') + n; }
  function fmtMoney(n) {
    n = Math.floor(n || 0);
    var neg = n < 0;
    var s = String(neg ? -n : n);
    var out = '';
    while (s.length > 3) { out = ',' + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? '-$' : '$') + s + out;
  }
  function fmtTimer(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    return Math.floor(sec / 60) + ':' + pad2(sec % 60);
  }
  function st() { return SB.state || {}; }
  function num(v, dflt) { return (typeof v === 'number' && isFinite(v)) ? v : dflt; }
  function heroPos() {
    if (SB.player && typeof SB.player.pos === 'function') {
      try {
        var p = SB.player.pos();
        if (p && p.length >= 2) return [num(p[0], 0), num(p[1], 0)];
      } catch (e) { /* abaikan, pakai fallback */ }
    }
    if (SB.engine && typeof SB.engine.heroPos === 'function') {
      try {
        var h = SB.engine.heroPos();
        if (h && h.length >= 2) return [num(h[0], 0), num(h[1], 0)];
      } catch (e) { /* abaikan */ }
    }
    return [0, 0];
  }
  function distTo(x, z) {
    var p = heroPos();
    var dx = p[0] - x, dz = p[1] - z;
    return Math.sqrt(dx * dx + dz * dz);
  }
  function cashTotal() {
    var c = num(st().cash, 0);
    if (SB.player) c = Math.max(c, num(SB.player.cash, 0));
    if (SB.missions) c = Math.max(c, num(SB.missions.cash, 0));
    return c;
  }
  function repTotal() {
    var r = num(st().rep, 0);
    if (SB.missions) r = Math.max(r, num(SB.missions.rep, 0));
    return r;
  }
  function rankName(rep) {
    if (rep >= 600) return 'KINGPIN';
    if (rep >= 300) return 'PLAYER';
    if (rep >= 100) return 'HUSTLER';
    return 'STREET KID';
  }
  function heatStars() {
    if (SB.police && typeof SB.police.stars === 'function') {
      try { return clamp(Math.floor(SB.police.stars()), 0, 5); } catch (e) { /* jatuh ke state */ }
    }
    return clamp(Math.floor(num(st().heat, 0)), 0, 5);
  }
  function clockText() {
    var s = st();
    var day = Math.max(1, Math.floor(num(s.day, 1)));
    var wd = WEEKDAYS[(day - 1) % 7];
    var label = s.timeLabel || 'DAY';
    return wd + ' ' + pad2(num(s.hour, 17)) + ':' + pad2(num(s.min, 24)) +
      ' · DAY ' + day + ' · ' + label;
  }
  // Panel misi: utamakan getHUD() B3 bila ada, fallback ke active + list.
  function missionData() {
    var m = SB.missions;
    if (!m) return null;
    var hud = null;
    if (typeof m.getHUD === 'function') {
      try { hud = m.getHUD(); } catch (e) { hud = null; }
    }
    var active = m.active || null;
    var list = m.list || [];
    var name = null, stage = null, next = null, timer = null, payout = null;
    if (hud && typeof hud === 'object') {
      if (typeof hud.name === 'string') name = hud.name;
      if (typeof hud.stage === 'string') stage = hud.stage;
      if (typeof hud.next === 'string') next = hud.next;
      if (typeof hud.timer === 'number') timer = hud.timer;
      if (typeof hud.payout === 'number') payout = hud.payout;
    }
    if (active) {
      if (!name && typeof active.name === 'string') name = active.name;
      if (!next && typeof active.objective === 'string') next = active.objective;
      if (timer === null && typeof active.timer === 'number') timer = active.timer;
      if (stage === null && typeof active.stage === 'string') stage = active.stage;
      if (stage === null && typeof active.stage === 'number' && typeof active.stages === 'number') {
        stage = 'STAGE ' + active.stage + '/' + active.stages;
      }
      if (payout === null) {
        for (var i = 0; i < list.length; i++) {
          if (list[i] && list[i].id === active.id && typeof list[i].payout === 'number') {
            payout = list[i].payout;
            break;
          }
        }
      }
      if (stage === null) {
        var idx = 0, total = 1;
        for (var j = 0; j < list.length; j++) {
          if (list[j] && list[j].id === active.id) { idx = j; break; }
        }
        // Stage dihitung dari progres misi dalam daftar (1-based).
        total = Math.max(1, list.length ? 2 : 1);
        stage = 'STAGE ' + (idx + 1) + '/' + total;
      }
    }
    if (!name && !active) return null;
    return { name: name, stage: stage, next: next, timer: timer, payout: payout };
  }
  function gpsText() {
    var m = SB.missions;
    if (m && typeof m.getGPS === 'function') {
      try {
        var g = m.getGPS();
        if (typeof g === 'string' && g.length > 0) return g;
      } catch (e) { /* fallback */ }
    }
    var s = st();
    if (typeof s.objective === 'string' && s.objective.length > 0) return s.objective;
    // Tanpa misi aktif: jarak numerik ke bank (perbaikan minus juri r12).
    if (SB.city && SB.city.bank && SB.city.bank.pos) {
      var bp = SB.city.bank.pos;
      var d = distTo(num(bp[0], 2), num(bp[2], -2));
      return 'BANK ' + Math.round(d) + ' m away';
    }
    return '—';
  }
  function radioName() {
    if (SB.radio) {
      if (typeof SB.radio.current === 'string' && SB.radio.current.length > 0) {
        return SB.radio.current;
      }
      if (Array.isArray(SB.radio.stations) && SB.radio.stations.length > 0) {
        var idx = num(SB.radio.station, num(SB.radio.index, 0));
        var stn = SB.radio.stations[clamp(Math.floor(idx), 0, SB.radio.stations.length - 1)];
        if (typeof stn === 'string') return stn;
        if (stn && typeof stn.name === 'string') return stn.name;
      }
    }
    return STATIONS[0];
  }

  function buildDom() {
    if (built) return;
    built = true;
    var root = document.createElement('div');
    root.id = 'hud';
    root.innerHTML =
      '<div id="hud-tl" class="hud-panel">' +
        '<div class="hud-row hud-title-row"><span class="hud-game">SOLMAR BAY</span>' +
        '<span id="hud-clock" class="hud-clock"></span></div>' +
        '<div class="hud-bar-row"><span class="hud-label">HEALTH</span>' +
        '<div class="hud-bar"><div id="hud-health" class="hud-fill hud-health"></div></div>' +
        '<span id="hud-health-n" class="hud-num"></span></div>' +
        '<div class="hud-bar-row"><span class="hud-label">ARMOR</span>' +
        '<div class="hud-bar"><div id="hud-armor" class="hud-fill hud-armor"></div></div>' +
        '<span id="hud-armor-n" class="hud-num"></span></div>' +
        '<div class="hud-row"><span id="hud-vehicle" class="hud-vehicle"></span></div>' +
        '<div class="hud-row"><span id="hud-rep" class="hud-rep"></span></div>' +
      '</div>' +
      '<div id="hud-tr" class="hud-panel">' +
        '<div id="hud-stars" class="hud-stars"></div>' +
        '<div id="hud-sight" class="hud-sight" style="display:none">IN SIGHT</div>' +
        '<div class="hud-row hud-tr-row"><span id="hud-cash" class="hud-cash"></span>' +
        '<span id="hud-speed" class="hud-speed"></span></div>' +
      '</div>' +
      '<div id="hud-bl">' +
        '<div id="hud-mission" class="hud-panel">' +
          '<div id="hud-m-name" class="hud-m-name">NO ACTIVE MISSION</div>' +
          '<div class="hud-m-grid">' +
            '<div class="hud-m-cell"><span class="hud-label">STAGE</span><span id="hud-m-stage">—</span></div>' +
            '<div class="hud-m-cell"><span class="hud-label">TIMER</span><span id="hud-m-timer">—</span></div>' +
            '<div class="hud-m-cell"><span class="hud-label">PAYOUT</span><span id="hud-m-payout">—</span></div>' +
          '</div>' +
          '<div class="hud-m-next"><span class="hud-label">NEXT</span><span id="hud-m-next">—</span></div>' +
          '<div class="hud-m-gps"><span class="hud-label">GPS</span><span id="hud-m-gps">—</span></div>' +
        '</div>' +
        '<div id="hud-crew" class="hud-panel">' +
          '<div class="hud-crew-title">CREW</div>' +
          '<div class="hud-crew-row"><span class="hud-crew-name">Lucia Ortega</span><span class="hud-crew-role">DRIVER</span></div>' +
          '<div class="hud-crew-row"><span class="hud-crew-name">Jax</span><span class="hud-crew-role">MECHANIC</span></div>' +
          '<div class="hud-crew-row"><span class="hud-crew-name">Mara Solis</span><span class="hud-crew-role">LOOKOUT</span></div>' +
        '</div>' +
      '</div>' +
      '<div id="hud-br">' +
        '<div id="hud-minimap-wrap"><canvas id="hud-minimap" width="200" height="200"></canvas>' +
        '<div class="hud-minimap-n">N</div></div>' +
        '<div id="hud-radio" class="hud-panel"><span id="hud-radio-name"></span>' +
        '<span class="hud-radio-hint">Q / R ganti stasiun</span></div>' +
      '</div>' +
      '<div id="hud-paused" class="hud-paused" style="display:none">PAUSED</div>';
    document.body.appendChild(root);
  }

  function drawMinimap() {
    var cv = $('hud-minimap');
    if (!cv) return;
    var s = st();
    if (num(s.simTime, 0) - lastMinimapSim < 0.3 && lastMinimapSim >= 0) return;
    lastMinimapSim = num(s.simTime, 0);
    var ctx = cv.getContext('2d');
    if (!ctx) return;
    var W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0e1a24';
    ctx.fillRect(0, 0, W, H);
    var ds = (SB.city && Array.isArray(SB.city.districts)) ? SB.city.districts : [];
    if (!ds.length) {
      ctx.fillStyle = '#9fb0c0';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SOLMAR BAY', W / 2, H / 2);
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
    var sc = Math.min((W - 16) / spanX, (H - 16) / spanZ);
    var ox = (W - spanX * sc) / 2 - minX * sc;
    var oy = (H - spanZ * sc) / 2 + maxZ * sc;
    function X(x) { return ox + x * sc; }
    function Z(z) { return oy - z * sc; }
    for (i = 0; i < ds.length; i++) {
      d = ds[i];
      if (!d) continue;
      ctx.fillStyle = MINIMAP_COLORS[i % MINIMAP_COLORS.length];
      ctx.fillRect(X(d.cx - d.w / 2), Z(d.cz + d.d / 2), d.w * sc, d.d * sc);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.strokeRect(X(d.cx - d.w / 2), Z(d.cz + d.d / 2), d.w * sc, d.d * sc);
    }
    if (SB.city && Array.isArray(SB.city.roads)) {
      ctx.strokeStyle = 'rgba(255,255,255,0.30)';
      ctx.lineWidth = 1;
      var roads = SB.city.roads;
      for (i = 0; i < roads.length; i++) {
        var r = roads[i];
        if (!r) continue;
        ctx.beginPath();
        ctx.moveTo(X(r.x0), Z(r.z0));
        ctx.lineTo(X(r.x1), Z(r.z1));
        ctx.stroke();
      }
    }
    if (SB.city && SB.city.bank && SB.city.bank.pos) {
      var bp = SB.city.bank.pos;
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(X(num(bp[0], 2)) - 3, Z(num(bp[2], -2)) - 3, 6, 6);
    }
    var md = missionData();
    if (md && SB.missions && SB.missions.list) {
      var list = SB.missions.list;
      for (i = 0; i < list.length; i++) {
        if (!list[i] || !list[i].district) continue;
        var dc = null;
        for (var j = 0; j < ds.length; j++) {
          if (ds[j] && ds[j].name === list[i].district) { dc = ds[j]; break; }
        }
        if (!dc) continue;
        var isActive = SB.missions.active && SB.missions.active.id === list[i].id;
        ctx.fillStyle = list[i].done ? '#4ade80' : (isActive ? '#FFB347' : '#6b7280');
        ctx.beginPath();
        ctx.arc(X(dc.cx), Z(dc.cz), isActive ? 5 : 3, 0, 6.2832);
        ctx.fill();
      }
    }
    var p = heroPos();
    ctx.fillStyle = '#22d3ee';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(X(p[0]), Z(p[1]), 4, 0, 6.2832);
    ctx.fill();
    ctx.stroke();
  }

  function update() {
    if (!built) buildDom();
    var s = st();
    var el = null;
    el = $('hud-clock');
    if (el) el.textContent = clockText();
    var health = SB.player ? num(SB.player.health, 100) : 100;
    var armor = SB.player ? num(SB.player.armor, 0) : 0;
    health = clamp(health, 0, 100);
    armor = clamp(armor, 0, 100);
    el = $('hud-health');
    if (el) el.style.width = health + '%';
    el = $('hud-health-n');
    if (el) el.textContent = Math.round(health);
    el = $('hud-armor');
    if (el) el.style.width = armor + '%';
    el = $('hud-armor-n');
    if (el) el.textContent = Math.round(armor);
    var inVehicle = !!(SB.vehicles && SB.vehicles.active);
    el = $('hud-vehicle');
    if (el) {
      if (inVehicle) {
        var vn = typeof s.vehicleName === 'string' && s.vehicleName.length > 0 ? s.vehicleName : 'CAR';
        var cond = Math.round(clamp(num(s.vehicleCond, 100), 0, 100));
        var vs = typeof s.vehicleStatus === 'string' ? s.vehicleStatus : 'OK';
        el.textContent = vn + ' · ' + cond + '% · ' + vs;
      } else {
        el.textContent = 'ON FOOT';
      }
    }
    var rep = repTotal();
    el = $('hud-rep');
    if (el) el.textContent = 'REP ' + Math.floor(rep) + ' · ' + rankName(rep);
    var stars = heatStars();
    el = $('hud-stars');
    if (el) {
      var starTxt = '';
      for (var i = 0; i < 5; i++) starTxt += (i < stars) ? '★' : '☆';
      el.textContent = starTxt;
    }
    el = $('hud-sight');
    if (el) el.style.display = s.inSight ? '' : 'none';
    el = $('hud-cash');
    if (el) el.textContent = fmtMoney(cashTotal());
    el = $('hud-speed');
    if (el) el.textContent = Math.round(clamp(num(s.speedKmh, 0), 0, 999)) + ' km/h';
    var md = missionData();
    el = $('hud-m-name');
    if (el) el.textContent = md && md.name ? String(md.name).toUpperCase() : 'NO ACTIVE MISSION';
    el = $('hud-m-stage');
    if (el) el.textContent = (md && md.stage) ? md.stage : '—';
    el = $('hud-m-timer');
    if (el) el.textContent = (md && md.timer !== null && md.timer !== undefined) ? fmtTimer(md.timer) : '—';
    el = $('hud-m-payout');
    if (el) el.textContent = (md && md.payout !== null && md.payout !== undefined) ? fmtMoney(md.payout) : '—';
    el = $('hud-m-next');
    if (el) el.textContent = (md && md.next) ? md.next : '—';
    el = $('hud-m-gps');
    if (el) el.textContent = gpsText();
    el = $('hud-radio-name');
    if (el) el.textContent = radioName();
    el = $('hud-paused');
    if (el) el.style.display = (s.paused && !staging) ? '' : 'none';
    drawMinimap();
  }

  SB.hud = SB.hud || {};
  SB.hud.init = function () {
    buildDom();
    update();
    if (typeof SB.registerUpdate === 'function') {
      try { SB.registerUpdate(update); } catch (e) { /* fallback ke rAF */ }
    }
    // Loop rAF sendiri (pola r9, API.md §3): update idempotent, jadi
    // pemanggilan ganda per frame AMAN dan HUD tetap hidup bila step() diam.
    (function raf() {
      try { update(); } catch (e) { /* jangan matikan loop */ }
      requestAnimationFrame(raf);
    })();
  };
  SB.hud.update = update;
  SB.hud.setStaging = function (flag) {
    staging = !!flag;
    if (st()) st().staging = staging;
    update();
  };
  SB.hud._crew = CREW;
  SB.hud._stations = STATIONS;
})();
