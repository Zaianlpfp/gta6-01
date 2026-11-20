// hud.js — HUD Solmar Bay (DOM overlay). B4 r7, API.md r7.
(function () {
  'use strict';
  var SB = window.SB;
  var el = {}, staging = false, mmCanvas = null, mmCtx = null, last = {};
  var DAYS = ['FRI', 'SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU'];
  var CREW = [['LUCIA ORTEGA', 'DRIVER', '#ff5fa2'], ['JAX', 'MECHANIC', '#ffb347'], ['MARA SOLIS', 'LOOKOUT', '#39d0ff']];
  var WEAPONS = [['fists', '1', 'FISTS'], ['pistol', '2', 'PISTOL'], ['smg', '3', 'SMG'], ['shotgun', '4', 'SHOTGUN'], ['rifle', '5', 'RIFLE']];
  function $(id) { return document.getElementById(id); }
  function mk(tag, id, cls, parent) {
    var d = document.createElement(tag);
    if (id) d.id = id;
    if (cls) d.className = cls;
    if (parent) parent.appendChild(d);
    return d;
  }
  function st() { return SB.state; }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : (d || 0); }
  function cash() {
    var c = num(st().cash, 0);
    if (typeof SB.cash === 'number') c = Math.max(c, SB.cash);
    if (SB.player && typeof SB.player.cash === 'number') c = Math.max(c, SB.player.cash);
    if (SB.missions && typeof SB.missions.cash === 'number') c = Math.max(c, SB.missions.cash);
    return c;
  }
  function rep() {
    var r = num(st().rep, 0);
    if (SB.missions && typeof SB.missions.rep === 'number') r = Math.max(r, SB.missions.rep);
    if (SB.player && typeof SB.player.rep === 'number') r = Math.max(r, SB.player.rep);
    return r;
  }
  function repInfo() {
    var th = [0, 300, 900, 1600, 2400, 4200];
    var ti = ['STREET KID', 'CORNER HUSTLER', 'NEON RUNNER', 'BAY HUSTLER', 'SOLMAR KING'];
    var r = rep(), lv = 1, i;
    for (i = 0; i < th.length; i++) if (r >= th[i]) lv = i + 1;
    if (lv > 5) lv = 5;
    return { level: lv, title: ti[lv - 1], xpInto: r, xpNext: th[lv] || th[5] };
  }
  function stars() {
    if (SB.police && typeof SB.police.stars === 'function') {
      try { return Math.max(0, Math.min(5, num(SB.police.stars(), 0) | 0)); } catch (e) {}
    }
    if (typeof st().wanted === 'number') return Math.max(0, Math.min(5, st().wanted | 0));
    var h = num(st().heat, 0);
    if (h <= 5) return h | 0;
    return h <= 0 ? 0 : h < 20 ? 1 : h < 40 ? 2 : h < 60 ? 3 : h < 80 ? 4 : 5;
  }
  function clock() {
    if (typeof SB.formatClock === 'function') { try { return SB.formatClock(); } catch (e) {} }
    var s = st(), d = DAYS[(num(s.day, 1) - 1) % 7] || 'FRI';
    var h = num(s.hour, 17), m = num(s.min != null ? s.min : s.minute, 24);
    return d + ' ' + (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  function activeMission() {
    if (SB.missions) {
      var a = SB.missions.active;
      if (typeof a === 'function') { try { return a() || null; } catch (e) { return null; } }
      if (a && typeof a === 'object') return a;
      if (SB.missions.list) for (var i = 0; i < SB.missions.list.length; i++)
        if (SB.missions.list[i].active) return SB.missions.list[i];
    }
    return st().mission || null;
  }
  function fmt$(n) { return '$' + num(n, 0).toLocaleString('en-US'); }
  function setTxt(node, v) { if (node && last[node.id] !== v) { last[node.id] = v; node.textContent = v; } }
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
  function buildDom() {
    var root = $('hud');
    if (!root) root = mk('div', 'hud', '', document.body);
    el.root = root;
    var tl = mk('div', 'hud-tl', 'hud-box', root);
    el.cash = mk('div', 'hud-cash', 'hud-cash', tl);
    var repRow = mk('div', 'hud-rep', '', tl);
    el.repTitle = mk('span', 'hud-reptitle', '', repRow);
    var bar = mk('div', 'hud-repbar', 'hud-bar', repRow);
    el.repFill = mk('div', 'hud-repfill', 'hud-fill rep', bar);
    el.story = mk('div', 'hud-story', '', tl);
    var tc = mk('div', 'hud-clock', 'hud-box', root);
    el.clock = mk('div', 'hud-clocktime', '', tc);
    el.season = mk('div', 'hud-season', '', tc);
    var tr = mk('div', 'hud-tr', '', root);
    el.mmWrap = mk('div', 'hud-mmwrap', '', tr);
    el.wanted = mk('div', 'hud-wanted', '', tr);
    // Kolom kiri: panel misi + response list dalam SATU flow (tidak bisa menimpa).
    var mc = mk('div', 'hud-mcol', '', root);
    var mp = mk('div', 'hud-mission', 'hud-box', mc);
    el.mTitle = mk('div', 'hud-mtitle', '', mp);
    el.mStage = mk('div', 'hud-mstage', '', mp);
    el.mObj = mk('div', 'hud-mobj', '', mp);
    el.mTimer = mk('div', 'hud-mtimer', '', mp);
    el.mPayout = mk('div', 'hud-mpayout', '', mp);
    el.response = mk('div', 'hud-response', 'hud-box', mc);
    var cp = mk('div', 'hud-crew', 'hud-box', root);
    mk('div', '', 'hud-crewhead', cp).textContent = 'CREW';
    CREW.forEach(function (c, i) {
      var row = mk('div', 'hud-crew' + i, 'hud-crewrow', cp);
      var dot = mk('span', '', 'hud-dot', row);
      dot.style.background = c[2];
      mk('span', '', '', row).textContent = c[0] + ' — ' + c[1];
    });
    el.loc = mk('div', 'hud-loc', 'hud-box', root);
    // Kanan-bawah SATU klaster flow: speed, kendaraan, wheel, radio.
    var br = mk('div', 'hud-br', '', root);
    el.speed = mk('div', 'hud-speed', 'hud-box', br);
    el.veh = mk('div', 'hud-veh', '', br);
    el.wheel = mk('div', 'hud-wheel', '', br);
    el.wheelSlots = [];
    WEAPONS.forEach(function (w) {
      var s = mk('div', 'hud-wslot-' + w[0], 'hud-wslot', el.wheel);
      s.textContent = w[1] + ' ' + w[2];
      el.wheelSlots.push(s);
    });
    el.radio = mk('div', 'hud-radio', 'hud-box', br);
    var hb = mk('div', 'hud-bars', '', root);
    var hrow = mk('div', '', 'hud-barow', hb);
    mk('span', '', 'hud-barlabel', hrow).textContent = 'HP';
    var hb2 = mk('div', '', 'hud-bar', hrow);
    el.hpFill = mk('div', 'hud-hpfill', 'hud-fill hp', hb2);
    var arow = mk('div', '', 'hud-barow', hb);
    mk('span', '', 'hud-barlabel', arow).textContent = 'ARMOR';
    var ab2 = mk('div', '', 'hud-bar', arow);
    el.arFill = mk('div', 'hud-arfill', 'hud-fill ar', ab2);
    el.toast = mk('div', 'hud-toast', '', root);
    var dlg = $('dlg');
    if (!dlg) {
      dlg = mk('div', 'dlg', 'hud-dlg', root);
      var dp = mk('div', 'dlg-portrait', '', dlg);
      el.dlgImg = mk('img', 'dlg-img', '', dp);
      var db = mk('div', 'dlg-body', '', dlg);
      el.dlgName = mk('div', 'dlg-name', '', db);
      el.dlgRole = mk('div', 'dlg-role', '', db);
      el.dlgLines = mk('div', 'dlg-lines', '', db);
    }
    el.dlg = dlg;
    el.paused = mk('div', 'hud-paused', '', root);
    el.paused.textContent = 'PAUSED — [P] RESUME';
    el.paused.style.display = 'none';
    el.busted = mk('div', 'hud-busted', 'hud-big', root);
    el.busted.textContent = 'BUSTED';
    el.busted.style.display = 'none';
    el.wasted = mk('div', 'hud-wasted', 'hud-big', root);
    el.wasted.textContent = 'WASTED';
    el.wasted.style.display = 'none';
  }
  function drawMinimap() {
    if (!mmCanvas) {
      mmCanvas = document.createElement('canvas');
      mmCanvas.id = 'hud-minimap';
      mmCanvas.width = 150; mmCanvas.height = 150;
      el.mmWrap.appendChild(mmCanvas);
      mmCtx = mmCanvas.getContext('2d');
    }
    if (!mmCtx) return;
    var c = mmCtx, W = 150, H = 150, cx = W / 2, cy = H / 2;
    var b = { minX: -560, maxX: 470, minZ: -470, maxZ: 530 };
    if (SB.world && SB.world.bounds) b = SB.world.bounds;
    var sc = Math.min(W / (b.maxX - b.minX), H / (b.maxZ - b.minZ));
    function px(x) { return cx + (x - (b.minX + b.maxX) / 2) * sc; }
    function py(z) { return cy + (z - (b.minZ + b.maxZ) / 2) * sc; }
    c.save();
    c.beginPath(); c.arc(cx, cy, 73, 0, 6.2832); c.clip();
    c.fillStyle = '#0c1420'; c.fillRect(0, 0, W, H);
    var i, d;
    var dists = (SB.city && SB.city.districts) || (SB.world && SB.world.districts) || [];
    for (i = 0; i < dists.length; i++) {
      d = dists[i];
      var x0 = (d.x0 != null ? d.x0 : d.cx - d.w / 2), z0 = (d.z0 != null ? d.z0 : d.cz - d.d / 2);
      var w = (d.x1 != null ? d.x1 - d.x0 : d.w), h = (d.z1 != null ? d.z1 - d.z0 : d.d);
      c.fillStyle = d.tint || '#1a2b3d';
      c.fillRect(px(x0), py(z0), w * sc, h * sc);
    }
    var roads = (SB.city && SB.city.roads) || (SB.world && SB.world.roads) || [];
    c.strokeStyle = '#3a4a5a'; c.lineWidth = 2;
    for (i = 0; i < roads.length; i++) {
      var r = roads[i];
      c.beginPath();
      if (r.axis) {
        if (r.axis === 'z') { c.moveTo(px(r.at), py(r.from)); c.lineTo(px(r.at), py(r.to)); }
        else { c.moveTo(px(r.from), py(r.at)); c.lineTo(px(r.to), py(r.at)); }
      } else { c.moveTo(px(r.x0), py(r.z0)); c.lineTo(px(r.x1), py(r.z1)); }
      c.stroke();
    }
    function dot(x, z, color, rad) {
      c.fillStyle = color; c.beginPath(); c.arc(px(x), py(z), rad || 3, 0, 6.2832); c.fill();
    }
    var hp = heroPos();
    if ((SB.police && SB.police.heli) || (SB.world && SB.world.heli)) {
      if (hp) {
        c.strokeStyle = 'rgba(255,80,80,0.9)'; c.lineWidth = 1.5;
        c.beginPath(); c.arc(px(hp.x), py(hp.z), 26, 0, 6.2832); c.stroke();
      }
    }
    var sp = (SB.world && SB.world.spawns) || {};
    if (sp.safehouse) dot(sp.safehouse.x, sp.safehouse.z, '#39d95e', 3);
    if (sp.shops) for (i = 0; i < sp.shops.length; i++) dot(sp.shops[i].x, sp.shops[i].z, '#c07bff', 2);
    var cops = (SB.police && SB.police.cops) || (SB.world && SB.world.police) || [];
    for (i = 0; i < cops.length; i++) {
      var p = cops[i];
      if (p.pos) dot(p.pos.x, p.pos.z, '#ff4040', 3);
      else if (typeof p.x === 'number') dot(p.x, p.z, '#ff4040', 3);
    }
    var m = activeMission();
    if (m && m.target) dot(m.target.x, m.target.z, '#ffd23f', 4);
    if (hp) {
      var hd = (SB.world && SB.world.player && SB.world.player.heading) || (SB.vehicles && SB.vehicles.active && SB.vehicles.active.heading) || 0;
      c.save(); c.translate(px(hp.x), py(hp.z)); c.rotate(-hd);
      c.fillStyle = '#ffffff';
      c.beginPath(); c.moveTo(0, -6); c.lineTo(4, 5); c.lineTo(-4, 5); c.closePath(); c.fill();
      c.restore();
    }
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2;
    c.beginPath(); c.arc(cx, cy, 73, 0, 6.2832); c.stroke();
  }
  function weaponId() {
    if (SB.player && typeof SB.player.weapon === 'number') {
      var w = WEAPONS[SB.player.weapon - 1];
      return w ? w[0] : 'fists';
    }
    return st().weapon || 'fists';
  }
  function update() {
    if (!el.root) return;
    var s = st(), k;
    var hidden = s.started === false || s.preset === 'title' || s.scenePreset === 'title';
    el.root.style.display = hidden ? 'none' : '';
    if (hidden) return;
    setTxt(el.cash, fmt$(cash()));
    var ri = repInfo();
    setTxt(el.repTitle, ri.title + ' · REP ' + rep() + ' · LV ' + ri.level);
    if (el.repFill) el.repFill.style.width = Math.max(0, Math.min(100, (ri.xpInto / Math.max(1, ri.xpNext)) * 100)) + '%';
    var done = num(s.missionsDone, 0);
    if (SB.missions && SB.missions.list) {
      var dc = 0;
      for (k = 0; k < SB.missions.list.length; k++) if (SB.missions.list[k].done) dc++;
      if (dc > done) done = dc;
    }
    setTxt(el.story, 'STORY ' + done + '/' + num(s.missionsTotal, 8) + ' · COINS ' + num(s.coins, 0) + '/' + num(s.coinsTotal, 20));
    setTxt(el.clock, clock() + ' · DAY ' + num(s.day, 1));
    setTxt(el.season, (s.timeLabel || s.timeOfDay || 'SUNSET').toUpperCase() + (s.weather && s.weather !== 'clear' ? ' · ' + s.weather.toUpperCase() : ''));
    var n = stars(), starTxt = '';
    for (k = 0; k < 5; k++) starTxt += k < n ? '★' : '☆';
    setTxt(el.wanted, starTxt);
    el.wanted.style.color = n >= 4 ? '#ff4040' : n >= 2 ? '#ffb347' : '#ffffff';
    if (el.hpFill) el.hpFill.style.width = Math.max(0, Math.min(100, num(s.health, 100))) + '%';
    if (el.arFill) el.arFill.style.width = Math.max(0, Math.min(100, num(s.armor, 0))) + '%';
    var m = activeMission();
    if (m) {
      var payout = m.payout;
      if (payout == null && SB.missions && SB.missions.list)
        for (k = 0; k < SB.missions.list.length; k++)
          if (SB.missions.list[k].id === m.id) payout = SB.missions.list[k].payout;
      setTxt(el.mTitle, (m.name || m.title || 'MISSION').toUpperCase());
      setTxt(el.mStage, 'STAGE ' + num(m.stage, 1) + '/' + num(m.stageTotal, 1));
      setTxt(el.mObj, 'NEXT: ' + (m.objective || s.objective || ''));
      setTxt(el.mTimer, m.timer ? '⏱ ' + Math.floor(m.timer / 60) + ':' + String(Math.floor(m.timer % 60)).padStart(2, '0') : '');
      setTxt(el.mPayout, 'PAYOUT ' + fmt$(payout || 0));
    } else {
      setTxt(el.mTitle, 'NO ACTIVE MISSION');
      setTxt(el.mStage, '');
      setTxt(el.mObj, s.objective ? 'NEXT: ' + s.objective : 'Start a job: press M for map');
      setTxt(el.mTimer, '');
      setTxt(el.mPayout, '');
    }
    var resp = [];
    if (SB.police) {
      if (SB.police.response && SB.police.response.length != null) resp = SB.police.response;
      else if (typeof SB.police.responseList === 'function') {
        try { resp = SB.police.responseList() || []; } catch (e) { resp = []; }
      }
    }
    var rTxt = '', sight = s.inSight === true || (n > 0 && resp.length > 0);
    if (n > 0 && resp.length) {
      rTxt = 'RESPONSE' + (sight ? ' — IN SIGHT' : '') + '\n';
      resp.slice(0, 4).forEach(function (u) {
        rTxt += (u.name || u.unit || 'UNIT') + ' · ' + num(u.dist, 0) + 'm · ' + (u.status || 'PURSUIT') + '\n';
      });
    } else if (n > 0) rTxt = 'RESPONSE' + (sight ? ' — IN SIGHT' : '') + '\n' + n + '★ — units inbound';
    if (el.response) {
      if (last.respHtml !== rTxt) { last.respHtml = rTxt; el.response.innerHTML = rTxt.split('\n').join('<br>'); }
      el.response.style.display = rTxt ? '' : 'none';
    }
    var vName = s.vehicleName && s.vehicleName !== '—' ? s.vehicleName : null;
    var veh = s.vehicle || (SB.vehicles && SB.vehicles.active) || (SB.world && SB.world.player && SB.world.player.vehicle);
    if (vName || veh) {
      setTxt(el.speed, Math.round(num(s.speedKmh, 0)) + ' km/h · ' + (s.gear || 'N'));
      var cond = s.vehicleCond != null ? s.vehicleCond : (veh && veh.condition != null ? veh.condition : 100);
      var vstat = s.vehicleStatus || (cond < 60 ? 'DENTED' : 'OK');
      setTxt(el.veh, (vName || veh.name || 'CAR') + ' · ' + Math.round(cond) + '%' + (vstat === 'DENTED' ? ' · DENTED' : cond < 90 ? ' · SCRATCHED' : ''));
    } else {
      setTxt(el.speed, 'ON FOOT');
      setTxt(el.veh, s.location || '');
    }
    var wps = s.weapons || {}, cur = weaponId();
    el.wheelSlots.forEach(function (slot, i) {
      var w = WEAPONS[i], wp = wps[w[0]] || {};
      var locked = !!wp.locked || (w[0] === 'rifle' && !wps.rifle);
      var ammo = wp.ammo === Infinity ? '∞' : (wp.ammo != null ? num(wp.ammo, 0) : '');
      var txt = w[2] + (locked ? ' 🔒' : (ammo === '' ? '' : ' ' + ammo));
      if (last[slot.id] !== txt) { last[slot.id] = txt; slot.textContent = txt; }
      slot.className = 'hud-wslot' + (cur === w[0] ? ' active' : '') + (locked ? ' locked' : '');
    });
    if (SB.radio && typeof SB.radio.current === 'function') {
      try {
        var curR = SB.radio.current();
        setTxt(el.radio, '♪ ' + (curR.name || '') + ' — ' + (curR.track || '') + (curR.playing === false ? ' (PAUSED)' : ''));
      } catch (e) { setTxt(el.radio, '♪ RADIO'); }
    } else if (s.radio) setTxt(el.radio, '♪ ' + (s.radio.name || '') + ' — ' + (s.radio.track || ''));
    setTxt(el.loc, (s.location || '') + (s.street ? ' · ' + s.street : ''));
    if (el.paused) el.paused.style.display = (s.paused && !staging) ? '' : 'none';
    drawMinimap();
  }
  var toastTimer = 0;
  function toast(msg) {
    if (!el.toast) return;
    el.toast.textContent = msg;
    el.toast.style.opacity = '1';
    toastTimer++;
    var t = toastTimer;
    setTimeout(function () { if (t === toastTimer && el.toast) el.toast.style.opacity = '0'; }, 2600);
  }
  function setStaging(b) {
    staging = !!b;
    SB.state.staging = staging;
    if (el.paused) el.paused.style.display = 'none';
    if (el.root) el.root.classList.toggle('staging', staging);
  }
  function showBusted() { if (el.busted) el.busted.style.display = ''; }
  function showWasted() { if (el.wasted) el.wasted.style.display = ''; }
  function showMissionBrief(m) {
    if (m) toast('NEW JOB: ' + (m.name || m.title || 'MISSION') + ' — ' + fmt$(m.payout || 0));
  }
  function setObjective(t) { if (el.mObj) el.mObj.textContent = 'NEXT: ' + t; }
  function setPaused(b) {
    SB.state.paused = !!b;
    if (typeof SB.setPaused === 'function') { try { SB.setPaused(!!b); } catch (e) {} }
  }
  function onKey(e) {
    var s = st();
    if (s.started === false) return;
    if (e.code === 'KeyM') { if (SB.map) SB.map.toggle(); return; }
    if (e.code === 'Escape') {
      if (SB.map) SB.map.hide();
      if (SB.shops) SB.shops.close();
      if (SB.dialog) SB.dialog.hide();
      return;
    }
    if (s.paused) { if (e.code === 'KeyP') setPaused(false); return; }
    if (e.code === 'KeyP') { setPaused(true); return; }
    if (e.code === 'KeyQ') { if (SB.radio) SB.radio.next(); return; }
    if (e.code === 'KeyR') {
      if (SB.combat && typeof SB.combat.reload === 'function') SB.combat.reload();
      return;
    }
    if (e.code === 'KeyF') { if (SB.shops) SB.shops.open('weapons'); return; }
    var di = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4 }[e.code];
    if (di != null) {
      if (SB.combat && typeof SB.combat.selectWeapon === 'function') SB.combat.selectWeapon(WEAPONS[di][0]);
      else if (SB.player) { SB.player.weapon = di + 1; SB.state.weapon = WEAPONS[di][0]; }
    }
  }
  function init() {
    if (el.root) return;
    buildDom();
    if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('keydown', onKey);
    if (typeof SB.registerUpdate === 'function') { try { SB.registerUpdate(update); } catch (e) {} }
    if (typeof SB.on === 'function') {
      SB.on('mission-complete', function () { if (SB.save) SB.save.autosave(); });
      SB.on('busted', showBusted);
      SB.on('wasted', showWasted);
      SB.on('mission-start', function (m) { showMissionBrief(m); });
      SB.on('scene', function (ev) {
        if (ev && ev.name === 'map' && SB.map) SB.map.show();
        if (ev && ev.name !== 'map' && SB.map) SB.map.hide();
      });
    }
    update();
  }
  SB.hud = {
    init: init, update: update, toast: toast, setStaging: setStaging,
    setObjective: setObjective, showBusted: showBusted, showWasted: showWasted,
    showMissionBrief: showMissionBrief, drawMinimap: drawMinimap,
    cash: cash, rep: rep, stars: stars, setPaused: setPaused,
    isStaging: function () { return staging; }
  };
})();
