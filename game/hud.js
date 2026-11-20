// hud.js — HUD Solmar Bay + kamera follow. B4 r10, tulis segar dari tree r9.
// CSS panel di-inject di sini (style.css tak punya kelas .hud-*);
// loop rAF sendiri (main.js tak panggil update); panel misi baca S.mission
// + markerPos; jam maju dari simTime; kamera follow collision-aware via
// wrap SB.engine.step (engine.js milik B1, tak disentuh).
(function () {
  'use strict';
  var SB = window.SB;
  var el = {}, staging = false, mmCv = null, mm = null, seen = {};
  var DAYS = ['FRI', 'SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU'];
  var CREW = [['LUCIA ORTEGA', 'DRIVER', '#ff5fa2'], ['JAX', 'MECHANIC', '#ffb347'], ['MARA SOLIS', 'LOOKOUT', '#39d0ff']];
  var ARMS = [['fists', '1', 'FISTS'], ['pistol', '2', 'PISTOL'], ['smg', '3', 'SMG'], ['shotgun', '4', 'SHOTGUN'], ['rifle', '5', 'RIFLE']];
  var CSS = '#hud{position:fixed;inset:0;pointer-events:none;z-index:5;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.8);font:13px/1.45 Arial,sans-serif}'
    + '.hud-box{background:rgba(8,10,20,.62);border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:7px 10px}'
    + '.hud-tl{position:absolute;top:10px;left:12px;min-width:210px}'
    + '.hud-cash{font-size:20px;font-weight:800;color:#ffd34d}'
    + '.hud-bar{height:8px;background:rgba(255,255,255,.16);border-radius:4px;overflow:hidden;margin-top:3px}'
    + '.hud-fill{height:100%}.rep{background:#ffb347}.hp{background:#39d95e}.ar{background:#39a0ff}'
    + '.hud-story{margin-top:4px;font-size:12px;color:#cfe0ff}'
    + '.hud-clock{position:absolute;top:10px;left:50%;transform:translateX(-50%);text-align:center}'
    + '.hud-clocktime{font-size:16px;font-weight:800}.hud-season{font-size:11px;color:#ffd34d;letter-spacing:2px}'
    + '.hud-tr{position:absolute;top:10px;right:12px;text-align:center}'
    + '#hud-minimap{width:150px;height:150px;border-radius:50%;border:2px solid rgba(255,255,255,.35)}'
    + '.hud-wanted{font-size:18px;letter-spacing:3px;margin-top:4px}'
    + '.hud-mcol{position:absolute;left:12px;top:150px;width:300px}.hud-mission{margin-bottom:8px}'
    + '.hud-mtitle{font-weight:800;color:#ffd34d}.hud-mstage{font-size:12px;color:#9fb0c3}.hud-mtimer{font-size:12px;color:#8fd0ff}.hud-mpayout{font-size:12px;color:#39d95e}'
    + '.hud-response{font-size:12px;line-height:1.5;white-space:pre-line}'
    + '.hud-crew{position:absolute;left:12px;bottom:212px;width:300px}'
    + '.hud-crewhead{font-weight:800;letter-spacing:2px;color:#ffd34d;font-size:12px}'
    + '.hud-crewrow{font-size:12px;margin-top:3px}.hud-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}'
    + '.hud-loc{position:absolute;left:12px;bottom:118px;font-size:12px;color:#cfe0ff}'
    + '.hud-bars{position:absolute;left:12px;bottom:150px;width:220px}'
    + '.hud-barow{display:flex;align-items:center;gap:6px;margin-top:3px}'
    + '.hud-barlabel{width:44px;font-size:11px;font-weight:700}.hud-bar{flex:1}.hud-barval{width:30px;text-align:right;font-size:12px;font-weight:700}'
    + '.hud-br{position:absolute;right:12px;bottom:12px;text-align:right}'
    + '.hud-speed{font-size:20px;font-weight:800}.hud-veh{font-size:12px;color:#cfe0ff}'
    + '.hud-wheel{display:flex;gap:4px;justify-content:flex-end;margin-top:4px}'
    + '.hud-wslot{padding:3px 7px;background:rgba(8,10,20,.62);border:1px solid rgba(255,255,255,.2);border-radius:5px;font-size:11px}'
    + '.hud-wslot.active{border-color:#ffd34d;color:#ffd34d}.hud-wslot.locked{opacity:.45}'
    + '.hud-radio{margin-top:6px;font-size:12px}'
    + '.hud-toast{position:absolute;top:64px;left:50%;transform:translateX(-50%);background:rgba(8,10,20,.8);padding:6px 14px;border-radius:6px;opacity:0;transition:opacity .3s}'
    + '.hud-paused{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:28px;font-weight:800;letter-spacing:4px;background:rgba(8,10,20,.7);padding:14px 26px;border-radius:10px}'
    + '.hud-big{position:absolute;top:38%;left:50%;transform:translate(-50%,-50%);font-size:56px;font-weight:800;letter-spacing:8px;color:#ff4040}'
    + '@media(max-height:420px){.hud-crew,.hud-loc{display:none}.hud-mcol{top:110px;width:240px}#hud-minimap{width:96px;height:96px}.hud-bars{bottom:96px;width:180px}}';
  function $(id) { return document.getElementById(id); }
  function mk(tag, id, cls, parent) { var d = document.createElement(tag); if (id) d.id = id; if (cls) d.className = cls; if (parent) parent.appendChild(d); return d; }
  function st() { return SB.state; }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : (d || 0); }
  function injectCss() {
    if ($('hud-css')) return;
    var s = document.createElement('style'); s.id = 'hud-css'; s.textContent = CSS;
    var h = document.head || document.body; if (h) h.appendChild(s);
  }
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
    var th = [0, 300, 900, 1600, 2400, 4200], ti = ['STREET KID', 'CORNER HUSTLER', 'NEON RUNNER', 'BAY HUSTLER', 'SOLMAR KING'];
    var r = rep(), lv = 1, i;
    for (i = 0; i < th.length; i++) if (r >= th[i]) lv = i + 1;
    if (lv > 5) lv = 5;
    return { level: lv, title: ti[lv - 1], xpInto: r, xpNext: th[lv] || th[5] };
  }
  function stars() {
    if (SB.police && typeof SB.police.stars === 'function') { try { return Math.max(0, Math.min(5, num(SB.police.stars(), 0) | 0)); } catch (e) {} }
    if (typeof st().wanted === 'number') return Math.max(0, Math.min(5, st().wanted | 0));
    var h = num(st().heat, 0);
    if (h <= 5) return h | 0;
    return h <= 0 ? 0 : h < 20 ? 1 : h < 40 ? 2 : h < 60 ? 3 : h < 80 ? 4 : 5;
  }
  // Jam: engine r8 tak gerakkan hour/min — turunkan dari simTime (1 menit
  // game per detik sim). Bila B1 r9 menggerakkan jam state, ikuti state.
  var clockBase = null;
  function clockText() {
    if (typeof SB.formatClock === 'function') { try { return SB.formatClock(); } catch (e) {} }
    var s = st();
    if (!clockBase || clockBase.preset !== s.preset) clockBase = { preset: s.preset, hour: num(s.hour, 17), min: num(s.min, 24), sim: num(s.simTime, 0) };
    if (s.hour !== clockBase.hour || s.min !== clockBase.min) { clockBase.hour = num(s.hour, 17); clockBase.min = num(s.min, 24); clockBase.sim = num(s.simTime, 0); }
    var total = clockBase.hour * 60 + clockBase.min + Math.floor(num(s.simTime, 0) - clockBase.sim);
    var h = Math.floor(total / 60) % 24, m = ((total % 60) + 60) % 60, d = DAYS[(num(s.day, 1) - 1) % 7] || 'FRI';
    return d + ' ' + (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  // Satu tampilan misi: M.active (id/name/step/timer) + S.mission
  // (stage/stageTotal/objective/payout) + markerPos (target GPS).
  function missionView() {
    var sm = st().mission || null, act = null;
    if (SB.missions) {
      var a = SB.missions.active;
      if (typeof a === 'function') { try { act = a() || null; } catch (e) { act = null; } }
      else if (a && typeof a === 'object') act = a;
      if (!act && SB.missions.list) for (var i = 0; i < SB.missions.list.length; i++) if (SB.missions.list[i].active) act = SB.missions.list[i];
    }
    if (!act && !sm) return null;
    var tgt = null;
    if (SB.missions && typeof SB.missions.markerPos === 'function') { try { tgt = SB.missions.markerPos() || null; } catch (e) {} }
    if (!tgt && act && act.target) tgt = act.target;
    if (!tgt && sm && sm.target) tgt = sm.target;
    var payout = (sm && sm.payout != null) ? sm.payout : (act && act.payout);
    if (payout == null && SB.missions && SB.missions.list) {
      var id = (act && act.id) || (sm && sm.id);
      for (var k = 0; k < SB.missions.list.length; k++) if (SB.missions.list[k].id === id) payout = SB.missions.list[k].payout;
    }
    return { id: (act && act.id) || (sm && sm.id), name: (act && act.name) || (sm && sm.title) || 'MISSION',
      objective: (act && act.objective) || (sm && sm.objective) || st().objective || '',
      stage: (sm && sm.stage) || (act && act.stage) || ((act && act.step != null) ? act.step + 1 : 1),
      stageTotal: (sm && sm.stageTotal) || (act && act.stageTotal) || 1,
      timer: act && act.timer, payout: payout || 0, target: tgt };
  }
  function fmt$(n) { return '$' + num(n, 0).toLocaleString('en-US'); }
  function setTxt(node, v) { if (node && seen[node.id] !== v) { seen[node.id] = v; node.textContent = v; } }
  function heroPos() {
    if (SB.engine && typeof SB.engine.heroPos === 'function') { try { var p = SB.engine.heroPos(); if (p) return { x: p[0], z: p[1] }; } catch (e) {} }
    if (SB.player && typeof SB.player.pos === 'function') { try { var q = SB.player.pos(); if (q) return { x: q[0], z: q[1] }; } catch (e) {} }
    return null;
  }
  function rectOf(d) { return { x: (d.x0 != null ? d.x0 : d.cx - d.w / 2), z: (d.z0 != null ? d.z0 : d.cz - d.d / 2), w: (d.x1 != null ? d.x1 - d.x0 : d.w), h: (d.z1 != null ? d.z1 - d.z0 : d.d) }; }
  function mapBounds() {
    var d = (SB.city && SB.city.districts) || [];
    if (!d.length) return { minX: -560, maxX: 470, minZ: -470, maxZ: 530 };
    var x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, i, r;
    for (i = 0; i < d.length; i++) { r = rectOf(d[i]); if (r.x < x0) x0 = r.x; if (r.x + r.w > x1) x1 = r.x + r.w; if (r.z < z0) z0 = r.z; if (r.z + r.h > z1) z1 = r.z + r.h; }
    return { minX: x0 - 30, maxX: x1 + 30, minZ: z0 - 30, maxZ: z1 + 30 };
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
      var dot = mk('span', '', 'hud-dot', row); dot.style.background = c[2];
      mk('span', '', '', row).textContent = c[0] + ' — ' + c[1];
    });
    el.loc = mk('div', 'hud-loc', 'hud-box', root);
    var br = mk('div', 'hud-br', '', root);
    el.speed = mk('div', 'hud-speed', 'hud-box', br);
    el.veh = mk('div', 'hud-veh', '', br);
    el.wheel = mk('div', 'hud-wheel', '', br);
    el.wheelSlots = [];
    ARMS.forEach(function (w) { var s = mk('div', 'hud-wslot-' + w[0], 'hud-wslot', el.wheel); s.textContent = w[1] + ' ' + w[2]; el.wheelSlots.push(s); });
    el.radio = mk('div', 'hud-radio', 'hud-box', br);
    var hb = mk('div', 'hud-bars', '', root);
    var hrow = mk('div', '', 'hud-barow', hb);
    mk('span', '', 'hud-barlabel', hrow).textContent = 'HP';
    var hb2 = mk('div', '', 'hud-bar', hrow);
    el.hpFill = mk('div', 'hud-hpfill', 'hud-fill hp', hb2);
    el.hpVal = mk('span', 'hud-hpval', 'hud-barval', hrow);
    var arow = mk('div', '', 'hud-barow', hb);
    mk('span', '', 'hud-barlabel', arow).textContent = 'ARMOR';
    var ab2 = mk('div', '', 'hud-bar', arow);
    el.arFill = mk('div', 'hud-arfill', 'hud-fill ar', ab2);
    el.arVal = mk('span', 'hud-arval', 'hud-barval', arow);
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
    el.paused.textContent = 'PAUSED — [P] RESUME'; el.paused.style.display = 'none';
    el.busted = mk('div', 'hud-busted', 'hud-big', root);
    el.busted.textContent = 'BUSTED'; el.busted.style.display = 'none';
    el.wasted = mk('div', 'hud-wasted', 'hud-big', root);
    el.wasted.textContent = 'WASTED'; el.wasted.style.display = 'none';
  }
  function drawMinimap() {
    if (!mmCv) {
      mmCv = document.createElement('canvas');
      mmCv.id = 'hud-minimap'; mmCv.width = 150; mmCv.height = 150;
      el.mmWrap.appendChild(mmCv); mm = mmCv.getContext('2d');
    }
    if (!mm) return;
    var c = mm, W = 150, H = 150, cx = W / 2, cy = H / 2, b = mapBounds();
    var sc = Math.min(W / (b.maxX - b.minX), H / (b.maxZ - b.minZ));
    function px(x) { return cx + (x - (b.minX + b.maxX) / 2) * sc; }
    function py(z) { return cy + (z - (b.minZ + b.maxZ) / 2) * sc; }
    c.save(); c.beginPath(); c.arc(cx, cy, 73, 0, 6.2832); c.clip();
    c.fillStyle = '#0c1420'; c.fillRect(0, 0, W, H);
    var i, d;
    var dists = (SB.city && SB.city.districts) || [];
    for (i = 0; i < dists.length; i++) { d = dists[i]; var r = rectOf(d); c.fillStyle = d.tint || '#1a2b3d'; c.fillRect(px(r.x), py(r.z), r.w * sc, r.h * sc); }
    var roads = (SB.city && SB.city.roads) || [];
    c.strokeStyle = '#3a4a5a'; c.lineWidth = 2;
    for (i = 0; i < roads.length; i++) {
      var rd = roads[i]; c.beginPath();
      if (rd.axis) { if (rd.axis === 'z') { c.moveTo(px(rd.at), py(rd.from)); c.lineTo(px(rd.at), py(rd.to)); } else { c.moveTo(px(rd.from), py(rd.at)); c.lineTo(px(rd.to), py(rd.at)); } }
      else { c.moveTo(px(rd.x0), py(rd.z0)); c.lineTo(px(rd.x1), py(rd.z1)); }
      c.stroke();
    }
    function dot(x, z, color, rad) { c.fillStyle = color; c.beginPath(); c.arc(px(x), py(z), rad || 3, 0, 6.2832); c.fill(); }
    var hp = heroPos();
    if (SB.police && SB.police.heli && hp) { c.strokeStyle = 'rgba(255,80,80,0.9)'; c.lineWidth = 1.5; c.beginPath(); c.arc(px(hp.x), py(hp.z), 26, 0, 6.2832); c.stroke(); }
    var sp = (SB.city && SB.city.spawnPoints) || {};
    if (sp.safehouse) dot(sp.safehouse.x != null ? sp.safehouse.x : sp.safehouse[0], sp.safehouse.z != null ? sp.safehouse.z : sp.safehouse[1], '#39d95e', 3);
    var cops = (SB.police && SB.police.cops) || [];
    for (i = 0; i < cops.length; i++) { var p = cops[i]; if (p.pos) dot(p.pos.x, p.pos.z, '#ff4040', 3); else if (typeof p.x === 'number') dot(p.x, p.z, '#ff4040', 3); }
    var m = missionView();
    if (m && m.target) { var tx = m.target.x != null ? m.target.x : m.target[0], tz = m.target.z != null ? m.target.z : m.target[1]; dot(tx, tz, '#ffd23f', 4); }
    if (hp) {
      var hd = (SB.vehicles && SB.vehicles.active && SB.vehicles.active.heading) || 0;
      c.save(); c.translate(px(hp.x), py(hp.z)); c.rotate(-hd);
      c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(0, -6); c.lineTo(4, 5); c.lineTo(-4, 5); c.closePath(); c.fill(); c.restore();
    }
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, 73, 0, 6.2832); c.stroke();
  }
  function weaponId() {
    if (SB.player && typeof SB.player.weapon === 'number') { var w = ARMS[SB.player.weapon - 1]; return w ? w[0] : 'fists'; }
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
    if (SB.missions && SB.missions.list) { var dc = 0; for (k = 0; k < SB.missions.list.length; k++) if (SB.missions.list[k].done) dc++; if (dc > done) done = dc; }
    setTxt(el.story, 'STORY ' + done + '/' + num(s.missionsTotal, 8) + ' · COINS ' + num(s.coins, 0) + '/' + num(s.coinsTotal, 20));
    setTxt(el.clock, clockText() + ' · DAY ' + num(s.day, 1));
    setTxt(el.season, (s.timeLabel || s.timeOfDay || 'SUNSET').toUpperCase() + (s.weather && s.weather !== 'clear' ? ' · ' + s.weather.toUpperCase() : ''));
    var n = stars(), starTxt = '';
    for (k = 0; k < 5; k++) starTxt += k < n ? '★' : '☆';
    setTxt(el.wanted, starTxt);
    el.wanted.style.color = n >= 4 ? '#ff4040' : n >= 2 ? '#ffb347' : '#ffffff';
    var hpv = num(s.health, 100), arv = num(s.armor, 0);
    if (el.hpFill) el.hpFill.style.width = Math.max(0, Math.min(100, hpv)) + '%';
    if (el.arFill) el.arFill.style.width = Math.max(0, Math.min(100, arv)) + '%';
    setTxt(el.hpVal, '' + Math.round(hpv));
    setTxt(el.arVal, '' + Math.round(arv));
    var m = missionView();
    if (m) {
      setTxt(el.mTitle, (m.name || 'MISSION').toUpperCase());
      setTxt(el.mStage, 'STAGE ' + num(m.stage, 1) + '/' + num(m.stageTotal, 1));
      setTxt(el.mObj, 'NEXT: ' + (m.objective || ''));
      setTxt(el.mTimer, m.timer ? '⏱ ' + Math.floor(m.timer / 60) + ':' + String(Math.floor(m.timer % 60)).padStart(2, '0') : '');
      setTxt(el.mPayout, 'PAYOUT ' + fmt$(m.payout || 0));
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
      else if (typeof SB.police.responseList === 'function') { try { resp = SB.police.responseList() || []; } catch (e) { resp = []; } }
    }
    var rTxt = '', sight = s.inSight === true || (n > 0 && resp.length > 0);
    if (n > 0 && resp.length) {
      rTxt = 'RESPONSE' + (sight ? ' — IN SIGHT' : '') + '\n';
      resp.slice(0, 4).forEach(function (u) { rTxt += (u.name || u.unit || 'UNIT') + ' · ' + num(u.dist, 0) + 'm · ' + (u.status || 'PURSUIT') + '\n'; });
    } else if (n > 0) rTxt = 'RESPONSE' + (sight ? ' — IN SIGHT' : '') + '\n' + n + '★ — units inbound';
    if (el.response) {
      if (seen.respHtml !== rTxt) { seen.respHtml = rTxt; el.response.innerHTML = rTxt.split('\n').join('<br>'); }
      el.response.style.display = rTxt ? '' : 'none';
    }
    var vName = s.vehicleName && s.vehicleName !== '—' ? s.vehicleName : null;
    var veh = s.vehicle || (SB.vehicles && SB.vehicles.active) || null;
    if (vName || veh) {
      setTxt(el.speed, Math.round(num(s.speedKmh, 0)) + ' km/h · ' + (s.gear || 'N'));
      var cond = s.vehicleCond != null ? s.vehicleCond : (veh && veh.condition != null ? veh.condition : 100);
      var vstat = s.vehicleStatus || (cond < 60 ? 'DENTED' : 'OK');
      setTxt(el.veh, (vName || veh.name || 'CAR') + ' · ' + Math.round(cond) + '%' + (vstat === 'DENTED' ? ' · DENTED' : cond < 90 ? ' · SCRATCHED' : ''));
    } else { setTxt(el.speed, 'ON FOOT'); setTxt(el.veh, s.location || ''); }
    var wps = s.weapons || {}, cur = weaponId();
    el.wheelSlots.forEach(function (slot, i) {
      var w = ARMS[i], wp = wps[w[0]] || {};
      var locked = !!wp.locked || (w[0] === 'rifle' && !wps.rifle);
      var ammo = wp.ammo === Infinity ? '∞' : (wp.ammo != null ? num(wp.ammo, 0) : '');
      var txt = w[2] + (locked ? ' 🔒' : (ammo === '' ? '' : ' ' + ammo));
      if (seen[slot.id] !== txt) { seen[slot.id] = txt; slot.textContent = txt; }
      slot.className = 'hud-wslot' + (cur === w[0] ? ' active' : '') + (locked ? ' locked' : '');
    });
    if (SB.radio && typeof SB.radio.current === 'function') {
      try { var curR = SB.radio.current(); setTxt(el.radio, '♪ ' + (curR.name || '') + ' — ' + (curR.track || '') + (curR.playing === false ? ' (PAUSED)' : '')); }
      catch (e) { setTxt(el.radio, '♪ RADIO'); }
    } else if (s.radio) setTxt(el.radio, '♪ ' + (s.radio.name || '') + ' — ' + (s.radio.track || ''));
    setTxt(el.loc, (s.location || '') + (s.street ? ' · ' + s.street : ''));
    if (el.paused) el.paused.style.display = (s.paused && !staging) ? '' : 'none';
    drawMinimap();
  }
  var rafOn = false;
  function hudLoop() {
    if (!rafOn) return;
    try { update(); } catch (e) {}
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(hudLoop); else rafOn = false;
  }
  function startLoop() {
    if (rafOn || typeof requestAnimationFrame !== 'function') return;
    rafOn = true; requestAnimationFrame(hudLoop);
  }
  // Kamera follow collision-aware (SB.cam): wrap SB.engine.step, koreksi
  // kamera setelah render engine, lalu render ulang. Preset cover/map dibiarkan.
  var camWrap = false, camInfo = { mode: '-', pulled: 0, lifted: false, heroInside: false }, bCache = null, bCacheN = -1;
  function blds() {
    var E = SB.engine;
    if (!E || !E.scene || typeof THREE === 'undefined') return [];
    var ch = E.scene.children || [];
    if (bCache && ch.length === bCacheN) return bCache;
    var o = [];
    for (var i = 0; i < ch.length; i++) {
      var m = ch[i];
      if (!m.isMesh || !m.geometry || !m.geometry.parameters || m.geometry.type !== 'BoxGeometry') continue;
      var p = m.geometry.parameters;
      if (p.height >= 6 && p.width >= 6 && p.depth >= 6) o.push({ m: m, b: new THREE.Box3().setFromObject(m) });
    }
    bCache = o; bCacheN = ch.length; return o;
  }
  function boxAt(x, y, z, bs) {
    for (var i = 0; i < bs.length; i++) { var b = bs[i].b; if (x >= b.min.x && x <= b.max.x && y >= b.min.y && y <= b.max.y && z >= b.min.z && z <= b.max.z) return b; }
    return null;
  }
  function camCorrect() {
    var E = SB.engine;
    if (!E || !E.camera || !E.scene || typeof THREE === 'undefined') return;
    var pr = SB.state.preset;
    // r10: 'mission' ikut di-skip — follow-cam menaruh papan bank 35° di atas
    // pusat pandang (di luar half-FOV 31°) sehingga tak terlihat; staging
    // mission pakai kamera preset (bank + mobil pink terbaca). Drive scene
    // yang menguji follow-cam saat mengemudi.
    if (pr === 'map' || pr === 'cover' || pr === 'mission') return;
    var hp = null;
    try { hp = E.heroPos ? E.heroPos() : null; } catch (e) {}
    if (!hp) return;
    var h = E.heading || 0, fx = Math.sin(h), fz = Math.cos(h), bs = blds();
    var eye = new THREE.Vector3(hp[0], 1.2, hp[1]), dist = 13, ht = 5.2;
    if (boxAt(hp[0], 1.2, hp[1], bs)) { dist = 4.5; ht = 2.8; camInfo.heroInside = true; } else camInfo.heroInside = false;
    var dx = hp[0] - fx * dist, dz = hp[1] - fz * dist;
    var dir = new THREE.Vector3(dx - eye.x, ht - eye.y, dz - eye.z), len = dir.length(), pulled = 0;
    if (len > 0.01) {
      dir.normalize();
      var ms = []; for (var i = 0; i < bs.length; i++) ms.push(bs[i].m);
      var hits = new THREE.Raycaster(eye, dir, 0, len).intersectObjects(ms, false);
      if (hits.length && hits[0].distance < len - 0.5) {
        var nd = Math.max(3.5, hits[0].distance - 1.2);
        dx = eye.x + dir.x * nd; ht = eye.y + dir.y * nd; dz = eye.z + dir.z * nd; pulled = len - nd;
      }
    }
    var lifted = false, bx = boxAt(dx, ht, dz, bs);
    if (bx && !camInfo.heroInside) { ht = bx.max.y + 2.5; lifted = true; }
    camInfo.pulled = pulled; camInfo.lifted = lifted;
    camInfo.mode = camInfo.heroInside ? 'close' : (pulled > 0 ? 'pulled' : (lifted ? 'lifted' : 'follow'));
    E.camera.position.set(dx, ht, dz);
    E.camera.lookAt(hp[0] + fx * 6, 1.4, hp[1] + fz * 6);
  }
  function installCamWrap() {
    if (camWrap) return;
    var E = SB.engine;
    if (!E || typeof E.step !== 'function') return;
    camWrap = true; SB._b4cam = true;
    var orig = E.step;
    E.step = function (dt) {
      var r = orig.call(E, dt);
      try { camCorrect(); if (E.renderer && E.scene && E.camera) E.renderer.render(E.scene, E.camera); } catch (e) {}
      return r;
    };
  }
  var toastTimer = 0;
  function toast(msg) {
    if (!el.toast) return;
    el.toast.textContent = msg; el.toast.style.opacity = '1'; toastTimer++;
    var t = toastTimer;
    setTimeout(function () { if (t === toastTimer && el.toast) el.toast.style.opacity = '0'; }, 2600);
  }
  function setStaging(b) {
    staging = !!b; SB.state.staging = staging;
    if (el.paused) el.paused.style.display = 'none';
    if (el.root) el.root.classList.toggle('staging', staging);
  }
  function showBusted() { if (el.busted) el.busted.style.display = ''; }
  function showWasted() { if (el.wasted) el.wasted.style.display = ''; }
  function showMissionBrief(m) { if (m) toast('NEW JOB: ' + (m.name || m.title || 'MISSION') + ' — ' + fmt$(m.payout || 0)); }
  function setObjective(t) { if (el.mObj) el.mObj.textContent = 'NEXT: ' + t; }
  function setPaused(b) {
    SB.state.paused = !!b;
    if (typeof SB.setPaused === 'function') { try { SB.setPaused(!!b); } catch (e) {} }
  }
  function onKey(e) {
    var s = st();
    if (s.started === false) return;
    if (e.code === 'KeyM') { if (SB.map) SB.map.toggle(); return; }
    if (e.code === 'Escape') { if (SB.map) SB.map.hide(); if (SB.shops) SB.shops.close(); if (SB.dialog) SB.dialog.hide(); return; }
    if (s.paused) { if (e.code === 'KeyP') setPaused(false); return; }
    if (e.code === 'KeyP') { setPaused(true); return; }
    if (e.code === 'KeyQ') { if (SB.radio) SB.radio.next(); return; }
    if (e.code === 'KeyR') { if (SB.combat && typeof SB.combat.reload === 'function') SB.combat.reload(); return; }
    if (e.code === 'KeyF') { if (SB.shops) SB.shops.open('weapons'); return; }
    var di = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4 }[e.code];
    if (di != null) {
      if (SB.combat && typeof SB.combat.selectWeapon === 'function') SB.combat.selectWeapon(ARMS[di][0]);
      else if (SB.player) { SB.player.weapon = di + 1; SB.state.weapon = ARMS[di][0]; }
    }
  }
  function init() {
    if (el.root) return;
    injectCss();
    buildDom();
    installCamWrap();
    if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('keydown', onKey);
    if (typeof SB.registerUpdate === 'function') { try { SB.registerUpdate(update); } catch (e) {} }
    if (typeof SB.on === 'function') {
      SB.on('mission-complete', function () { if (SB.save) SB.save.autosave(); });
      SB.on('busted', showBusted);
      SB.on('wasted', showWasted);
      SB.on('mission-start', function (m) { showMissionBrief(m); });
      SB.on('scene', function (ev) { if (ev && ev.name === 'map' && SB.map) SB.map.show(); if (ev && ev.name !== 'map' && SB.map) SB.map.hide(); });
    }
    update();
    startLoop();
  }
  SB.cam = { correct: camCorrect, info: function () { return camInfo; }, wrapInstalled: function () { return camWrap; }, buildings: function () { return blds().length; } };
  SB.hud = { init: init, update: update, toast: toast, setStaging: setStaging, setObjective: setObjective, showBusted: showBusted, showWasted: showWasted, showMissionBrief: showMissionBrief, drawMinimap: drawMinimap, cash: cash, rep: rep, stars: stars, setPaused: setPaused, missionView: missionView, isStaging: function () { return staging; } };
})();
