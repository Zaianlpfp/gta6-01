// Solmar Bay — HUD (B4, v4-rebuild r4). update()/render() rewrite EVERY element from
// live state each call. snapshot() never throws: speed from SB.state.speedKmh with
// fallbacks to SB.engine.hero — never the legacy world object.
(function () {
  var SB = window.SB = window.SB || {};
  var inited = false, root = null, E = {}, mmCv = null, mmCtx = null;
  var RANKS = [[0, 'STREET KID'], [50, 'SMALL-TIME'], [150, 'HUSTLER'], [300, 'WHEELMAN'], [600, 'HITMAN'], [1000, 'KINGPIN']];
  var CSS = '#hud{position:fixed;inset:0;z-index:50;pointer-events:none;color:#f2ede1;font:14px/1.45 system-ui,sans-serif;text-shadow:0 1px 2px rgba(0,0,0,.8)}' +
    '#hud *{box-sizing:border-box}' +
    '#hud .card{background:rgba(8,10,18,.78);border:1px solid rgba(245,197,66,.35);border-radius:10px;padding:8px 12px}' +
    '#hud .lbl{font-size:11px;letter-spacing:2px;color:#f5c542;font-weight:700}' +
    '#hud-mission{position:absolute;left:16px;top:16px;width:300px}' +
    '#hud-response{position:absolute;left:16px;top:132px;width:300px}' +
    '#hud-crew{position:absolute;left:16px;top:308px;width:300px}' +
    '#hud-right{position:absolute;right:16px;top:16px;width:216px;text-align:right}' +
    '#hud-mmwrap{width:180px;height:180px;margin-left:auto;border-radius:50%;overflow:hidden;border:2px solid rgba(245,197,66,.6);background:#0d1b22}' +
    '#hud-mmwrap canvas{display:block;width:180px;height:180px}' +
    '#hud-wanted{font-size:22px;letter-spacing:3px;color:#ffd23f;margin-top:6px}' +
    '#hud-stats{margin-top:6px}' +
    '#hud-bottom{position:absolute;left:590px;bottom:14px;width:274px;text-align:center}' +
    '#hud-toast{min-height:18px;color:#ffd23f;font-weight:700;font-size:13px;letter-spacing:1px}' +
    '#hud-radio{margin-top:2px;color:#cfe3ea}' +
    '#hud-bars .bar{height:10px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.25);border-radius:5px;overflow:hidden;margin:3px 0}' +
    '#hud-bars .fill{height:100%}' +
    '#hud-wheel{position:absolute;right:16px;bottom:16px;display:flex;gap:6px}' +
    '#hud-wheel .slot{width:74px;padding:6px 4px;text-align:center;background:rgba(8,10,18,.82);border:1px solid rgba(255,255,255,.25);border-radius:8px}' +
    '#hud-wheel .slot.cur{border-color:#f5c542;box-shadow:0 0 10px rgba(245,197,66,.5)}' +
    '#hud-wheel .nm{font-size:12px;font-weight:700;letter-spacing:1px}' +
    '#hud-wheel .am{font-size:11px;color:#9fb4c0}' +
    '#hud-wheel .locked{opacity:.45}' +
    '#hud-car{position:absolute;right:16px;bottom:96px;text-align:right}' +
    '#hud-speed{font-size:34px;font-weight:800;line-height:1;color:#fff}' +
    '#hud-gear{font-size:13px;color:#f5c542;font-weight:700;letter-spacing:1px}';

  function safe(fn, fb) { try { var v = fn(); return (v === undefined || v === null) ? fb : v; } catch (e) { return fb; } }
  function p2(n) { n = Math.floor(n || 0); return (n < 10 ? '0' : '') + n; }
  function clock(t) { return (t.dow || 'FRI') + ' ' + p2(t.hour) + ':' + p2(t.min) + ' · DAY ' + (t.day || 1); }
  function timer(sec) { sec = Math.max(0, Math.ceil(sec || 0)); return p2(Math.floor(sec / 60)) + ':' + p2(sec % 60); }
  function rankFor(rep) { var r = RANKS[0][1]; for (var i = 0; i < RANKS.length; i++) if (rep >= RANKS[i][0]) r = RANKS[i][1]; return r; }
  function gearFor(kmh) {
    try { if (SB.vehicles && typeof SB.vehicles.gear === 'function') return SB.vehicles.gear(kmh); } catch (e) {}
    if (kmh < 0) return 'R'; if (kmh < 1) return 'N'; if (kmh < 35) return 'G1';
    if (kmh < 70) return 'G2'; if (kmh < 105) return 'G3'; if (kmh < 135) return 'G4'; return 'G5';
  }
  function districtAt(x, z) {
    var best = 'SOLMAR BAY', bd = 1e12;
    try { var ds = (SB.city && SB.city.districts) || []; for (var i = 0; i < ds.length; i++) { var dd = (ds[i].cx - x) * (ds[i].cx - x) + (ds[i].cz - z) * (ds[i].cz - z); if (dd < bd) { bd = dd; best = ds[i].name; } } } catch (e) {}
    return best;
  }
  function season() {
    try { var p = SB.engine && SB.engine.PRESETS && SB.state ? SB.engine.PRESETS[SB.state.preset] : null; if (p && p.tod) return 'SUMMER · ' + p.tod.toUpperCase(); } catch (e) {}
    var h = safe(function () { return SB.state.time.hour; }, 17);
    return 'SUMMER · ' + (h >= 17 && h < 20 ? 'SUNSET' : h >= 20 || h < 6 ? 'NIGHT' : 'DAY');
  }
  function hex(n) { return '#' + ('000000' + (n >>> 0).toString(16)).slice(-6); }

  function snapshot() {
    var s = {};
    try {
      var st = SB.state || {};
      var t = st.time || { day: 1, dow: 'FRI', hour: 17, min: 24 };
      s.time = { day: t.day || 1, dow: t.dow || 'FRI', hour: t.hour || 0, min: t.min || 0 };
      s.clock = clock(s.time); s.preset = st.preset || 'cover'; s.paused = !!st.paused; s.mode = st.mode || 'car';
      s.speedKmh = (typeof st.speedKmh === 'number') ? st.speedKmh : 0;
      if (!s.speedKmh) { try { if (SB.engine && SB.engine.hero && typeof SB.engine.hero.speedKmh === 'number') s.speedKmh = SB.engine.hero.speedKmh; } catch (e) {} }
      s.speedKmh = Math.round(s.speedKmh || 0); s.gear = gearFor(s.speedKmh);
      s.stars = safe(function () { return (SB.police && typeof SB.police.stars === 'function') ? SB.police.stars() : (st.heat || 0); }, 0);
      s.stars = Math.max(0, Math.min(5, s.stars | 0)); s.heat = s.stars;
      s.cash = safe(function () { return Math.max(SB.cash || 0, (SB.player && SB.player.cash) || 0, (SB.missions && SB.missions.cash) || 0); }, 0);
      s.rep = safe(function () { return Math.max((SB.player && SB.player.rep) || 0, (SB.missions && SB.missions.rep) || 0); }, 0);
      s.rank = rankFor(s.rep);
      s.hp = safe(function () { var p = SB.player; return (p.hp != null ? p.hp : (p.health != null ? p.health : 100)); }, 100);
      s.armor = safe(function () { return SB.player.armor || 0; }, 0);
      s.weapon = safe(function () { return SB.player.weapon || 1; }, 1);
      s.weapons = [];
      try { var ws = (SB.player && SB.player.weapons) || []; for (var i = 0; i < ws.length; i++) s.weapons.push({ name: ws[i].name || ('W' + (i + 1)), ammo: ws[i].ammo || 0, reserve: ws[i].reserve || 0, locked: !!ws[i].locked }); } catch (e) {}
      s.response = safe(function () { return SB.police.response || []; }, []);
      s.inSight = safe(function () { return SB.police.inSight; }, undefined);
      s.car = safe(function () { var v = SB.vehicles && SB.vehicles.hero; return v ? { name: v.name || 'VENTO STRADA', cond: v.cond != null ? v.cond : 100 } : { name: 'VENTO STRADA', cond: 100 }; }, { name: 'VENTO STRADA', cond: 100 });
      s.hero = { x: 0, z: 0, heading: 0 };
      try { var hp = SB.engine && SB.engine.heroPos ? SB.engine.heroPos() : null; if (hp) { s.hero.x = hp.x; s.hero.z = hp.z; } var eh = SB.engine && SB.engine.hero; if (eh) s.hero.heading = eh.heading || 0; } catch (e) {}
      s.loc = districtAt(s.hero.x, s.hero.z); s.season = season();
      s.jobs = safe(function () { return SB.missions.jobs(); }, []);
      s.active = safe(function () { return SB.missions.active || null; }, null);
      s.timeLeft = safe(function () { return (SB.missions.active && SB.missions.active.timeLeft) || 0; }, 0);
      s.radio = safe(function () { return SB.radio ? SB.radio.nowPlaying() : null; }, null);
      s.standoff = safe(function () { return SB.missions.standoff || 0; }, 0);
      s.marker = safe(function () { return (SB.missions && SB.missions.marker) || null; }, null);
    } catch (e) {}
    return s;
  }

  function txt(id, v) { var e = E[id]; if (e) e.textContent = v; }
  function buildEl() {
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    root = document.createElement('div'); root.id = 'hud';
    root.innerHTML =
      '<div id="hud-mission" class="card"><div class="lbl">MISSION</div><div id="hud-mission-name" style="font-weight:800;font-size:16px;"></div><div id="hud-mission-stage" style="color:#cfe3ea;"></div><div id="hud-mission-timer" style="color:#ffd23f;font-weight:700;"></div></div>' +
      '<div id="hud-response" class="card"><div class="lbl">SOLMAR PD</div><div id="hud-response-list"></div></div>' +
      '<div id="hud-crew" class="card"><div class="lbl">CREW</div><div id="hud-crew-list"></div></div>' +
      '<div id="hud-right"><div id="hud-mmwrap"></div><div id="hud-wanted"></div><div id="hud-sight" style="font-size:12px;letter-spacing:1px;color:#ff8b8b;font-weight:700;"></div>' +
      '<div id="hud-stats"><div id="hud-cash" style="font-size:19px;font-weight:800;color:#7ee2a0;"></div><div id="hud-rep" style="color:#cfe3ea;"></div><div id="hud-clock" style="color:#cfe3ea;"></div><div id="hud-loc" style="color:#cfe3ea;"></div><div id="hud-season" style="color:#f5c542;font-size:12px;letter-spacing:1px;"></div></div></div>' +
      '<div id="hud-car"><div id="hud-carname" style="color:#cfe3ea;font-size:13px;"></div><div id="hud-speed">0 km/h</div><div id="hud-gear">GEAR N</div></div>' +
      '<div id="hud-wheel"></div>' +
      '<div id="hud-bottom"><div id="hud-toast"></div><div id="hud-radio" class="card" style="padding:4px 10px;"></div>' +
      '<div id="hud-bars"><div style="display:flex;justify-content:space-between;font-size:11px;"><span>HEALTH <b id="hud-hp"></b></span><span>ARMOR <b id="hud-armor"></b></span></div>' +
      '<div class="bar"><div id="hud-hpbar" class="fill" style="background:#e5484d;"></div></div>' +
      '<div class="bar"><div id="hud-armorbar" class="fill" style="background:#3a86ff;"></div></div></div></div>';
    (document.getElementById('game') || document.body).appendChild(root);
    var ids = ['hud-mission-name', 'hud-mission-stage', 'hud-mission-timer', 'hud-response-list', 'hud-crew-list', 'hud-wanted', 'hud-sight', 'hud-cash', 'hud-rep', 'hud-clock', 'hud-loc', 'hud-season', 'hud-carname', 'hud-speed', 'hud-gear', 'hud-toast', 'hud-radio', 'hud-hp', 'hud-armor', 'hud-hpbar', 'hud-armorbar', 'hud-wheel', 'hud-mmwrap'];
    for (var i = 0; i < ids.length; i++) E[ids[i]] = document.getElementById(ids[i]);
  }

  function ensureMinimap() {
    if (mmCv) return;
    try {
      if (!document.getElementById('game') || !document.getElementById('game-canvas')) return; // lazy: never first canvas
      mmCv = document.createElement('canvas'); mmCv.width = 180; mmCv.height = 180;
      E['hud-mmwrap'].appendChild(mmCv); mmCtx = mmCv.getContext('2d');
    } catch (e) { mmCv = null; }
  }
  function drawMinimap(s) {
    try {
      ensureMinimap(); if (!mmCv || !mmCtx) return;
      var c = mmCtx, W = 180, H = 180, sc = W / 340, i;
      var X = function (x) { return W / 2 + x * sc; }, Z = function (z) { return H / 2 + z * sc; };
      c.clearRect(0, 0, W, H); c.fillStyle = '#0d1b22'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#0e3a4d'; c.fillRect(0, 0, Math.max(0, X(-144)), H);
      try {
        var ds = (SB.city && SB.city.districts) || [];
        for (i = 0; i < ds.length; i++) { c.fillStyle = hex(ds[i].color); c.globalAlpha = 0.3; c.fillRect(X(ds[i].cx - 48), Z(ds[i].cz - 48), 96 * sc, 96 * sc); }
        c.globalAlpha = 1;
      } catch (e) {}
      c.strokeStyle = '#2e3d46'; c.lineWidth = 2;
      var roads = [-144, -96, -48, 0, 48, 96, 144];
      for (i = 0; i < roads.length; i++) { c.beginPath(); c.moveTo(X(roads[i]), 0); c.lineTo(X(roads[i]), H); c.stroke(); c.beginPath(); c.moveTo(0, Z(roads[i])); c.lineTo(W, Z(roads[i])); c.stroke(); }
      if (s.stars > 0) { c.strokeStyle = 'rgba(255,46,77,.85)'; c.setLineDash([4, 3]); c.lineWidth = 1.5; c.beginPath(); c.arc(X(s.hero.x), Z(s.hero.z), (34 + s.stars * 12) * sc, 0, 6.2832); c.stroke(); c.setLineDash([]); }
      if (s.marker && s.marker.on) { c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(X(s.marker.x), Z(s.marker.z) - 6); c.lineTo(X(s.marker.x) + 6, Z(s.marker.z)); c.lineTo(X(s.marker.x), Z(s.marker.z) + 6); c.lineTo(X(s.marker.x) - 6, Z(s.marker.z)); c.closePath(); c.fill(); }
      if (s.standoff > 0) { c.fillStyle = '#ff2e4d'; c.beginPath(); c.arc(X(s.hero.x + 14), Z(s.hero.z - 10), 3.5, 0, 6.2832); c.fill(); }
      try { var heli = SB.city && SB.city.heli; if (heli) { c.fillStyle = '#37e0ff'; c.beginPath(); c.arc(X(heli.position.x), Z(heli.position.z), 3, 0, 6.2832); c.fill(); } } catch (e) {}
      c.save(); c.translate(X(s.hero.x), Z(s.hero.z)); c.rotate(-s.hero.heading);
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 5); c.lineTo(0, 2); c.lineTo(-5, 5); c.closePath(); c.fill(); c.restore();
      c.fillStyle = '#f2ede1'; c.font = 'bold 10px system-ui,sans-serif'; c.textAlign = 'left'; c.fillText('N', 6, 12);
    } catch (e) {}
  }

  function update() {
    if (!inited) return;
    var s = snapshot(), i, j;
    try { if (SB.audio && SB.audio.engine) SB.audio.engine(s.mode === 'car' ? s.speedKmh : 0); } catch (e) {}
    var name = 'NO ACTIVE JOB', stage = '', tm = '';
    if (s.active) {
      var job = null;
      for (i = 0; i < s.jobs.length; i++) if (('m' + (s.jobs[i].i + 1)) === s.active.id) job = s.jobs[i];
      name = job ? job.name : s.active.id.toUpperCase();
      stage = 'STAGE ' + ((s.active.obj || 0) + 1) + (job ? ' · PAY $' + job.pay + ' · ' + job.giver.toUpperCase() : '');
      if (s.standoff > 0) stage += ' · STANDOFF ' + s.standoff + ' LEFT';
      tm = 'TIME ' + timer(s.timeLeft);
    } else {
      var next = null, done = 0;
      for (j = 0; j < s.jobs.length; j++) { if (s.jobs[j].st === 'DONE') done++; if (!next && s.jobs[j].st === 'OPEN') next = s.jobs[j]; }
      stage = 'JOBS ' + done + '/' + s.jobs.length + ' DONE';
      if (next) { name = 'NEXT: ' + next.name; tm = 'PAY $' + next.pay + ' · ' + next.giver.toUpperCase(); }
    }
    txt('hud-mission-name', name); txt('hud-mission-stage', stage); txt('hud-mission-timer', tm);
    var resp = s.response || [], html = '';
    if (!resp.length) html = '<div style="color:#9fb4c0;">NO UNITS</div>';
    for (i = 0; i < Math.min(7, resp.length); i++) html += '<div>' + resp[i].name + ' · ' + resp[i].dist + 'm · ' + resp[i].status + '</div>';
    if (E['hud-response-list']) E['hud-response-list'].innerHTML = html;
    var crew = {}, order = [];
    for (i = 0; i < s.jobs.length; i++) { var g = (s.jobs[i].giver || '').toUpperCase(); if (!crew[g]) { crew[g] = { n: 0, d: 0 }; order.push(g); } crew[g].n++; if (s.jobs[i].st === 'DONE') crew[g].d++; }
    var ch = '';
    for (i = 0; i < order.length; i++) ch += '<div>' + order[i] + ' · ' + crew[order[i]].d + '/' + crew[order[i]].n + ' JOBS</div>';
    if (!ch) ch = '<div style="color:#9fb4c0;">JAX · MARA · LUCIA</div>';
    if (E['hud-crew-list']) E['hud-crew-list'].innerHTML = ch;
    var stars = '';
    for (i = 0; i < 5; i++) stars += (i < s.stars) ? '★' : '☆';
    txt('hud-wanted', stars + (s.stars > 0 ? ' WANTED' : ' CLEAN'));
    txt('hud-sight', s.inSight === true ? 'IN SIGHT · GULL-1' : s.inSight === false ? 'HIDDEN' : '');
    txt('hud-cash', '$' + s.cash); txt('hud-rep', 'REP ' + s.rep + ' · ' + s.rank);
    txt('hud-clock', s.clock); txt('hud-loc', s.loc.toUpperCase()); txt('hud-season', s.season);
    txt('hud-carname', s.car.name + ' · COND ' + s.car.cond + '%' + (s.car.cond >= 100 ? ' CLEAN' : s.car.cond >= 70 ? ' SCRATCHED' : ' DENTED'));
    txt('hud-speed', s.speedKmh + ' km/h'); txt('hud-gear', 'GEAR ' + s.gear);
    txt('hud-hp', Math.round(s.hp) + '%'); txt('hud-armor', Math.round(s.armor) + '%');
    if (E['hud-hpbar']) E['hud-hpbar'].style.width = Math.max(0, Math.min(100, s.hp)) + '%';
    if (E['hud-armorbar']) E['hud-armorbar'].style.width = Math.max(0, Math.min(100, s.armor)) + '%';
    txt('hud-radio', s.radio ? ('RADIO ' + s.radio.station + ' · ' + s.radio.track + ' [Q]') : 'RADIO OFF [Q]');
    txt('hud-toast', s.paused ? 'PAUSED — [P] RESUME' : '');
    if (E['hud-wheel']) {
      var wh = '';
      for (i = 0; i < 5; i++) {
        var wp = s.weapons[i] || { name: '—', ammo: 0, reserve: 0, locked: true };
        var am = wp.locked ? 'LOCKED' : wp.name === 'FISTS' ? '—' : (wp.ammo + ' / ' + wp.reserve);
        wh += '<div class="slot' + (s.weapon === i + 1 ? ' cur' : '') + (wp.locked ? ' locked' : '') + '"><div class="nm">' + (i + 1) + ' ' + wp.name + '</div><div class="am">' + am + '</div></div>';
      }
      E['hud-wheel'].innerHTML = wh;
    }
    drawMinimap(s);
  }

  function onKey(e) {
    if (!e || e.repeat) return;
    var code = e.code;
    try {
      if (code === 'Escape') {
        if (SB.map && SB.map.isOpen && SB.map.isOpen()) SB.map.close();
        else if (SB.shops && SB.shops.isOpen && SB.shops.isOpen()) SB.shops.close();
        update(); return;
      }
      if (SB.map && SB.map.isOpen && SB.map.isOpen()) {
        if (code === 'Equal' || code === 'NumpadAdd') { SB.map.zoomIn(); update(); return; }
        if (code === 'Minus' || code === 'NumpadSubtract') { SB.map.zoomOut(); update(); return; }
        if (code === 'KeyM') { SB.map.close(); update(); return; }
      }
      if (code >= 'Digit1' && code <= 'Digit5') {
        var n = code.charCodeAt(5) - 48;
        if (SB.player && typeof SB.player.setWeapon === 'function') SB.player.setWeapon(n);
        update(); return;
      }
      if (code === 'KeyR') { try { if (SB.player && SB.player.reload) SB.player.reload(); if (SB.audio) SB.audio.reload(); } catch (e2) {} update(); return; }
      if (code === 'KeyQ') { try { if (SB.radio) SB.radio.nextStation(); } catch (e2) {} update(); return; }
      if (code === 'KeyM') { try { if (SB.map) SB.map.toggle(); } catch (e2) {} update(); return; }
      if (code === 'KeyF') { try { if (SB.shops) SB.shops.toggle(); } catch (e2) {} update(); return; }
      if (code === 'KeyP') { try { SB.state.paused = !SB.state.paused; } catch (e2) {} update(); return; }
    } catch (e) {}
  }

  SB.hud = {
    version: '4.0.0-r4',
    init: function () {
      if (inited) return true;
      buildEl(); inited = true;
      try { if (!SB._hudKeysBound) { window.addEventListener('keydown', onKey); SB._hudKeysBound = true; } } catch (e) {}
      update(); return true;
    },
    update: update, render: update, snapshot: snapshot,
    toast: function (msg) { if (inited) update(); },
    setWeapon: function (n) {
      try { if (SB.player && typeof SB.player.setWeapon === 'function') SB.player.setWeapon(n); } catch (e) {}
      update();
      return safe(function () { return SB.player.weapon; }, 1);
    }
  };
})();
