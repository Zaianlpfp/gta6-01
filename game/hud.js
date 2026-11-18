(function () {
  'use strict';
  var SB = window.SB = window.SB || {};
  var S = SB.state, W = SB.world;
  var root = null, titleEl = null, els = {}, mm = null, mmCtx = null;
  var acc = 0, mmAcc = 0, toastTimer = 0, briefTimer = 0;
  var WPN = [['fists', 'FISTS'], ['pistol', 'PISTOL'], ['smg', 'SMG'], ['shotgun', 'SHOTGUN'], ['rifle', 'RIFLE']];
  var UNITS = ['GULL-1', 'MARLIN-11', 'SNAPPER-25', 'TARPON-18', 'IBIS-43', 'HERON-17', 'KESTREL-31'];
  var MISSION_SPOT = { 'first-fare': 'hotel', 'the-package': 'marina', 'hot-wheels': 'garage', 'night-run': 'neon', 'chop-shop': 'garage', 'harbor-lights': 'marina', 'heat': 'police', 'big-score': 'bank' };
  var MARA_LINES = {
    cover: 'Lose the cops, then bring the money home. No heroics, kid.',
    night: 'Crew is waiting at Pelican Marina. Cops are thick tonight — move.'
  };
  function $(id) { return document.getElementById(id); }
  function el(tag, id, parent, html) {
    var e = document.createElement(tag);
    if (id) e.id = id;
    if (html !== undefined && html !== null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  function css() {
    var st = document.createElement('style');
    st.textContent = '#sb-hud{position:fixed;inset:0;pointer-events:none;z-index:40;color:#fff;font-family:Arial,Helvetica,sans-serif;text-shadow:0 1px 3px rgba(0,0,0,.85);font-size:14px}' +
      '#sb-hud .panel{background:rgba(5,8,16,.62);border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:7px 10px}' +
      '#sb-hud .bar{height:9px;background:rgba(0,0,0,.55);border-radius:5px;overflow:hidden;border:1px solid rgba(255,255,255,.25)}' +
      '#sb-hud .bar>i{display:block;height:100%}' +
      '#sb-radio,#sb-mapbtn{pointer-events:auto;cursor:pointer}' +
      '#sb-toast{position:absolute;left:50%;top:11%;transform:translateX(-50%);font-size:17px;font-weight:bold;color:#ffe14d;opacity:0;transition:opacity .3s;text-align:center}' +
      '#sb-obj{position:absolute;left:50%;top:9%;transform:translateX(-50%);font-size:13px;color:#cfe6ff;opacity:0;transition:opacity .3s}' +
      '#sb-dialog{position:absolute;left:50%;bottom:118px;transform:translateX(-50%);width:520px;max-width:88vw;background:rgba(5,8,16,.85);border:1px solid #ff2a7a;border-radius:10px;padding:10px 12px;display:none;align-items:center;gap:12px}' +
      '#sb-big{position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;background:rgba(0,0,0,.45)}' +
      '#sb-title{position:fixed;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;z-index:45;color:#fff;font-family:Arial,sans-serif;text-align:center;pointer-events:none}' +
      '#sb-mm{border-radius:50%;border:2px solid rgba(255,255,255,.6);box-shadow:0 0 0 4px rgba(0,0,0,.35)}';
    document.head.appendChild(st);
  }
  function build() {
    css();
    root = el('div', 'sb-hud', document.body);

    var tl = el('div', null, root);
    tl.style.cssText = 'position:absolute;left:12px;top:10px;display:flex;flex-direction:column;gap:5px';
    els.cash = el('div', null, tl, ''); els.cash.className = 'panel'; els.cash.style.cssText = 'font-size:21px;font-weight:bold;color:#39d353';
    els.clock = el('div', null, tl, ''); els.clock.className = 'panel'; els.clock.style.fontSize = '13px';
    els.story = el('div', null, tl, ''); els.story.className = 'panel'; els.story.style.fontSize = '13px';
    els.loc = el('div', null, tl, ''); els.loc.className = 'panel'; els.loc.style.fontSize = '12px'; els.loc.style.color = '#cfe6ff';

    var tr = el('div', null, root);
    tr.style.cssText = 'position:absolute;right:12px;top:10px;display:flex;flex-direction:column;gap:5px;align-items:flex-end;width:250px';
    els.stars = el('div', null, tr, ''); els.stars.style.cssText = 'font-size:22px;letter-spacing:3px;color:#ffd23f';
    els.wanted = el('div', null, tr, ''); els.wanted.style.cssText = 'font-size:11px;letter-spacing:2px;color:#ffb3c1';
    var rep = el('div', null, tr, ''); rep.className = 'panel'; rep.style.width = '100%'; rep.style.boxSizing = 'border-box';
    els.rep = el('div', null, rep, ''); els.rep.style.cssText = 'font-size:12px;font-weight:bold';
    els.repbar = el('div', null, rep, ''); els.repbar.className = 'bar'; els.repbar.innerHTML = '<i id="sb-repfill" style="background:#ff2a7a;width:0%"></i>';
    els.radio = el('div', 'sb-radio', tr, ''); els.radio.className = 'panel'; els.radio.style.cssText = 'width:100%;box-sizing:border-box;text-align:right';
    els.radio.onclick = function () { if (SB.radio) SB.radio.next(); };

    var rr = el('div', null, root);
    rr.style.cssText = 'position:absolute;right:12px;top:172px;width:250px';
    els.resp = el('div', null, rr, ''); els.resp.className = 'panel';

    var lm = el('div', null, root);
    lm.style.cssText = 'position:absolute;left:12px;top:172px;width:270px';
    els.mission = el('div', null, lm, ''); els.mission.className = 'panel';

    var bl = el('div', null, root);
    bl.style.cssText = 'position:absolute;left:12px;bottom:12px';
    mm = el('canvas', 'sb-mm', bl); mm.width = 180; mm.height = 180;
    mmCtx = mm.getContext('2d');
    els.mmLabel = el('div', null, bl, 'SOLMAR BAY'); els.mmLabel.style.cssText = 'text-align:center;font-size:11px;letter-spacing:3px;margin-top:4px;color:#cfe6ff';

    var br = el('div', null, root);
    br.style.cssText = 'position:absolute;right:12px;bottom:12px;display:flex;flex-direction:column;gap:5px;align-items:flex-end';
    els.weapons = el('div', null, br, ''); els.weapons.className = 'panel'; els.weapons.style.cssText = 'display:flex;gap:6px';
    var sp = el('div', null, br, ''); sp.className = 'panel'; sp.style.cssText = 'text-align:right;min-width:210px';
    els.speed = el('div', null, sp, ''); els.speed.style.cssText = 'font-size:30px;font-weight:bold;line-height:1';
    els.vehicle = el('div', null, sp, ''); els.vehicle.style.cssText = 'font-size:12px;color:#ffd23f';
    els.cond = el('div', null, sp, ''); els.cond.className = 'bar'; els.cond.innerHTML = '<i id="sb-condfill" style="background:#39d353;width:100%"></i>';
    els.condLabel = el('div', null, sp, ''); els.condLabel.style.cssText = 'font-size:11px;color:#9fb4d8';

    els.toast = el('div', 'sb-toast', root);
    els.obj = el('div', 'sb-obj', root);
    els.dialog = el('div', 'sb-dialog', root);
    els.dialog.innerHTML = '<div id="sb-portrait" style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#ff2a7a,#ff9f1c);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:bold;flex:none">M</div><div style="min-width:0"><div id="sb-dlg-name" style="font-size:13px;font-weight:bold;color:#ffd23f"></div><div id="sb-dlg-line" style="font-size:14px;line-height:1.35"></div></div>';
    els.brief = el('div', null, root, '');
    els.brief.style.cssText = 'position:absolute;left:50%;top:26%;transform:translateX(-50%);width:420px;max-width:88vw;background:rgba(5,8,16,.88);border:2px solid #ffd23f;border-radius:10px;padding:12px 14px;display:none';
    var big = el('div', 'sb-big', root);
    big.innerHTML = '<div id="sb-big-title" style="font-size:64px;font-weight:bold;letter-spacing:8px;color:#ff2a5a"></div><div id="sb-big-sub" style="font-size:16px;color:#fff"></div>';
    els.big = big;

    titleEl = el('div', 'sb-title', document.body);
    titleEl.innerHTML = '<div style="font-size:72px;font-weight:bold;letter-spacing:12px;text-shadow:0 4px 24px rgba(0,0,0,.8)">SOLMAR BAY</div><div style="font-size:18px;letter-spacing:4px;color:#ffd23f;margin-top:6px">SUN · SAND · SIN</div><div style="font-size:15px;margin-top:26px;color:#fff">Press ENTER to start &nbsp;·&nbsp; WASD drive &nbsp;·&nbsp; E steal car &nbsp;·&nbsp; M map &nbsp;·&nbsp; Q/R radio</div><div style="font-size:13px;margin-top:10px;color:#cfe6ff">8 story jobs · Wanted 0–5 ★ · Helicopters · 3 radio stations</div>';
  }
  function money(n) { return '$' + (n || 0).toLocaleString('en-US'); }
  function responseList() {
    if (SB.police && SB.police.responseList) {
      try { var r = SB.police.responseList(); if (r && r.length) return r; } catch (e) {}
    }
    if (!S.wanted) return [];
    var p = W.player && W.player.pos;
    var list = [];
    var n = S.wanted >= 5 ? 6 : S.wanted + (S.wanted >= 4 ? 1 : 0);
    var dists = [35, 9, 17, 22, 28, 41];
    var stats = ['SPOTLIGHT', 'RAMMING', 'PURSUIT', 'PURSUIT', 'ROADBLOCK', 'SEARCHING'];
    for (var i = 0; i < n && i < UNITS.length; i++) {
      var d = dists[i];
      if (p && W.police && W.police[i] && W.police[i].pos) d = Math.round(Math.sqrt((W.police[i].pos.x - p.x) * (W.police[i].pos.x - p.x) + (W.police[i].pos.z - p.z) * (W.police[i].pos.z - p.z)));
      else if (p && W.heli && i === 0) d = 35;
      list.push({ unit: UNITS[i], dist: d, status: stats[i] });
    }
    return list;
  }
  function refresh() {
    if (!root) return;
    var hide = S.scenePreset === 'title' || !S.started;
    root.style.display = hide ? 'none' : 'block';
    if (titleEl) titleEl.style.display = S.scenePreset === 'title' ? 'flex' : 'none';
    if (hide) return;
    els.cash.textContent = money(S.cash);
    els.clock.textContent = SB.formatClock() + '  ·  DAY ' + S.day + '  ·  ' + (S.timeOfDay || 'sunset').toUpperCase();
    els.story.textContent = 'STORY ' + S.missionsDone + '/' + S.missionsTotal + '   ☀ Coins ' + S.coins + '/' + S.coinsTotal + '   ◉ Tapes ' + S.tapes + '/' + S.tapesTotal;
    els.loc.textContent = '📍 ' + (S.location || '').toUpperCase() + (S.street ? ' · ' + S.street : '');
    var stars = '';
    for (var i = 0; i < 5; i++) stars += i < S.wanted ? '★' : '☆';
    els.stars.textContent = stars;
    els.wanted.textContent = S.wanted ? 'WANTED ' + S.wanted + '/5' + (S.wanted >= 4 ? ' · IN SIGHT' : '') : 'CLEAN';
    var rp = SB.repProgress ? SB.repProgress() : { level: S.repLevel, title: S.repTitle, xpInto: 0, xpNext: 1 };
    els.rep.textContent = 'REP ' + rp.level + ' · ' + rp.title + '  ' + (rp.xpInto || 0) + '/' + (rp.xpNext || 0);
    var rf = $('sb-repfill');
    if (rf) rf.style.width = (rp.xpNext ? Math.min(100, Math.round(100 * rp.xpInto / rp.xpNext)) : 100) + '%';
    var r = S.radio || { name: 'WAVE 88.1', track: '', playing: true };
    els.radio.innerHTML = '♪ <b>' + r.name + '</b> · ' + (r.playing ? '▶' : '❚❚') + '<br><span style="font-size:12px;color:#cfe6ff">' + r.track + '</span><br><span style="font-size:11px;color:#9fb4d8">Q / R switch station</span>';
    var list = responseList();
    if (list.length) {
      var h = '<b style="font-size:12px;letter-spacing:2px;color:#9fb4d8">SOLMAR PD RESPONSE</b><br>';
      for (var u = 0; u < list.length; u++) h += '<div style="display:flex;justify-content:space-between;font-size:13px"><span>' + list[u].unit + ' · ' + list[u].dist + ' m</span><b style="color:' + (list[u].status === 'RAMMING' ? '#ff5a5a' : list[u].status === 'SPOTLIGHT' ? '#ffd23f' : '#8affc1') + '">' + list[u].status + '</b></div>';
      els.resp.innerHTML = h; els.resp.style.display = 'block';
    } else els.resp.style.display = 'none';
    var m = S.mission;
    if (m) {
      els.mission.innerHTML = '<b style="color:#ffd23f;font-size:12px;letter-spacing:2px">MISSION — ' + (m.contact || 'MARA SOLIS') + '</b><br><b style="font-size:15px">' + m.title + '</b><br><span style="font-size:12px;color:#cfe6ff">STAGE ' + (m.stage || 1) + '/' + (m.stageTotal || 1) + ' · $' + (m.payout || 0).toLocaleString('en-US') + '</span><br><span style="font-size:13px">NEXT: ' + (m.objective || '') + '</span>' + (m.timer ? '<br><span style="font-size:14px;color:#ff5a5a">⏱ ' + m.timer + '</span>' : '');
      els.mission.style.display = 'block';
    } else els.mission.style.display = 'none';
    els.speed.textContent = Math.round(S.speedKmh || 0) + ' KM/H';
    els.vehicle.textContent = (S.vehicle ? S.vehicle.name + ' · ' + (S.gear || 'N') : 'ON FOOT · ' + (S.gear || 'N'));
    var cond = S.vehicle ? (S.vehicle.condition || 0) : 100;
    var cf = $('sb-condfill');
    if (cf) { cf.style.width = cond + '%'; cf.style.background = cond > 50 ? '#39d353' : cond > 25 ? '#ffd23f' : '#ff5a5a'; }
    els.condLabel.textContent = S.vehicle ? 'CONDITION ' + cond + '% · [Space] handbrake' : 'WASD walk · [E] enter vehicle';
    var wh = '';
    for (var w = 0; w < WPN.length; w++) {
      var id = WPN[w][0], wd = S.weapons[id] || {};
      var locked = !!wd.locked, active = S.weapon === id;
      var ammo = id === 'fists' ? '∞' : (wd.ammo !== undefined ? wd.ammo + '/' + (wd.reserve || 0) : '—');
      wh += '<span style="padding:4px 7px;border-radius:5px;font-size:12px;background:' + (active ? '#ff2a7a' : locked ? '#222' : '#1a2a44') + ';color:' + (locked ? '#777' : '#fff') + ';opacity:' + (locked ? 0.55 : 1) + '">' + (locked ? '🔒 ' : '') + WPN[w][1] + ' ' + ammo + '</span>';
    }
    els.weapons.innerHTML = wh;
    if (SB.audio) {
      if (SB.audio.engine) SB.audio.engine(S.speedKmh || 0);
      if (SB.audio.siren) SB.audio.siren(S.wanted > 0);
    }
  }
  SB.hud = {
    init: function () {
      if (root) return;
      build();
      SB.on('scene', function (d) {
        if (!d) return;
        if (d.name === 'map' && SB.map) SB.map.show();
        else if (SB.map && SB.map.isOpen()) SB.map.hide();
        if (d.name === 'cover' || d.name === 'night') SB.hud.showDialog({ name: 'MARA SOLIS', role: 'FIXER · SOLMAR BAY', portrait: 'assets/mara.jpg', line: MARA_LINES[d.name] });
        else if (d.name !== 'mission') SB.hud.hideDialog();
        refresh();
      });
      SB.on('mission-start', function (m) { if (m) SB.hud.showMissionBrief(m); });
      SB.on('mission-complete', function (m) { SB.hud.toast('✓ MISSION COMPLETE — ' + (m && m.title ? m.title + ' ' : '') + '+$' + (m && m.payout ? m.payout : '')); });
      SB.on('busted', function () { SB.hud.showBusted(); });
      SB.on('wasted', function () { SB.hud.showWasted(); });
      SB.on('vehicle-stolen', function (v) { SB.hud.toast('🚗 VEHICLE STOLEN: ' + (v && v.name ? v.name : 'car') + ' — +heat'); });
      SB.registerUpdate(function (dt) { SB.hud.update(dt); });
      refresh();
    },
    update: function (dt) {
      acc += dt; mmAcc += dt;
      if (acc >= 0.12) { acc = 0; refresh(); }
      if (mmAcc >= 0.2) { mmAcc = 0; SB.hud.drawMinimap(); }
      if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0 && els.toast) els.toast.style.opacity = 0; }
      if (briefTimer > 0) { briefTimer -= dt; if (briefTimer <= 0 && els.brief) els.brief.style.display = 'none'; }
    },
    drawMinimap: function () {
      if (!mmCtx || !root || root.style.display === 'none') return;
      var c = mmCtx, W2 = 180, H2 = 180;
      var X0 = -560, Z0 = -470, SX = W2 / 1030, SZ = H2 / 1000;
      var X = function (x) { return (x - X0) * SX; }, Z = function (z) { return (z - Z0) * SZ; };
      c.save();
      c.clearRect(0, 0, W2, H2);
      c.beginPath(); c.arc(90, 90, 88, 0, 6.2832); c.clip();
      c.fillStyle = '#0d1a2e'; c.fillRect(0, 0, W2, H2);
      var rs = W.roads || [];
      c.strokeStyle = '#5a6a80'; c.lineWidth = 3;
      for (var i = 0; i < rs.length; i++) {
        c.beginPath();
        if (rs[i].axis === 'z') { c.moveTo(X(rs[i].at), Z(rs[i].from)); c.lineTo(X(rs[i].at), Z(rs[i].to)); }
        else { c.moveTo(X(rs[i].from), Z(rs[i].at)); c.lineTo(X(rs[i].to), Z(rs[i].at)); }
        c.stroke();
      }
      var sp = W.spawns || {};
      if (sp.safehouse) { c.fillStyle = '#39d353'; c.fillRect(X(sp.safehouse.x) - 3, Z(sp.safehouse.z) - 3, 6, 6); }
      var shops = sp.shops || [];
      c.fillStyle = '#b57edc';
      for (var s = 0; s < shops.length; s++) { c.beginPath(); c.arc(X(shops[s].x), Z(shops[s].z), 3, 0, 6.2832); c.fill(); }
      if (S.mission) {
        var spot = MISSION_SPOT[S.mission.id];
        var t = spot && sp.missions ? sp.missions[spot] : null;
        if (t) {
          c.fillStyle = '#ffe14d'; c.beginPath(); c.arc(X(t.x), Z(t.z), 5, 0, 6.2832); c.fill();
          c.strokeStyle = '#ffe14d'; c.lineWidth = 2; c.beginPath(); c.arc(X(t.x), Z(t.z), 9, 0, 6.2832); c.stroke();
        }
      }
      var pol = W.police || [];
      for (var p = 0; p < pol.length; p++) {
        if (!pol[p].pos) continue;
        c.fillStyle = '#4d9fff'; c.beginPath(); c.arc(X(pol[p].pos.x), Z(pol[p].pos.z), 4, 0, 6.2832); c.fill();
      }
      if (W.heli && W.heli.pos) {
        c.fillStyle = '#ff5a5a'; c.beginPath(); c.arc(X(W.heli.pos.x), Z(W.heli.pos.z), 5, 0, 6.2832); c.fill();
        c.strokeStyle = 'rgba(255,90,90,.7)'; c.lineWidth = 2;
        c.beginPath(); c.arc(X(W.heli.pos.x), Z(W.heli.pos.z), 22, 0, 6.2832); c.stroke();
      }
      var pl = W.player;
      if (pl && pl.pos) {
        var hx = X(pl.pos.x), hy = Z(pl.pos.z), hd = pl.heading || 0;
        c.fillStyle = '#fff';
        c.beginPath();
        c.moveTo(hx - Math.sin(hd) * 8, hy - Math.cos(hd) * 8);
        c.lineTo(hx + Math.cos(hd) * 5 - Math.sin(hd) * -5, hy - Math.sin(hd) * 5 - Math.cos(hd) * -5);
        c.lineTo(hx - Math.cos(hd) * 5 - Math.sin(hd) * -5, hy + Math.sin(hd) * 5 - Math.cos(hd) * -5);
        c.closePath(); c.fill();
        c.strokeStyle = '#ff2a7a'; c.lineWidth = 2; c.stroke();
      }
      c.restore();
    },
    toast: function (msg) {
      if (!els.toast) return;
      els.toast.textContent = msg; els.toast.style.opacity = 1; toastTimer = 3.5;
    },
    setObjective: function (text) {
      if (!els.obj) return;
      els.obj.textContent = '◆ ' + text; els.obj.style.opacity = 1;
      setTimeout(function () { if (els.obj) els.obj.style.opacity = 0; }, 6000);
    },
    showDialog: function (d) {
      if (!els.dialog) return;
      var name = d.name || 'MARA SOLIS';
      $('sb-dlg-name').textContent = name + (d.role ? ' · ' + d.role : '');
      $('sb-dlg-line').textContent = (d.lines && d.lines[0]) || d.line || '';
      var por = $('sb-portrait');
      if (d.portrait && (d.portrait.indexOf('data:') === 0 || d.portrait.indexOf('/') >= 0)) {
        por.innerHTML = '<img src="' + d.portrait + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover">';
      } else por.textContent = name.charAt(0);
      els.dialog.style.display = 'flex';
    },
    hideDialog: function () { if (els.dialog) els.dialog.style.display = 'none'; },
    showMissionBrief: function (m) {
      if (!els.brief) return;
      els.brief.innerHTML = '<b style="color:#ffd23f;letter-spacing:2px;font-size:12px">NEW MISSION — ' + (m.contact || 'MARA SOLIS') + '</b><br><b style="font-size:18px">' + m.title + '</b><br><span style="font-size:13px;color:#cfe6ff">' + (m.objective || '') + '</span><br><span style="color:#39d353;font-size:14px">PAYOUT $' + (m.payout || 0).toLocaleString('en-US') + '</span>';
      els.brief.style.display = 'block'; briefTimer = 6;
      SB.hud.setObjective(m.objective || m.title);
    },
    showBusted: function () {
      if (!els.big) return;
      $('sb-big-title').textContent = 'BUSTED';
      $('sb-big-sub').textContent = 'Solmar PD caught you — cash −10% · Woke up at St. Coral Hospital';
      els.big.style.display = 'flex';
      setTimeout(function () { if (els.big) els.big.style.display = 'none'; }, 4000);
    },
    showWasted: function () {
      if (!els.big) return;
      $('sb-big-title').textContent = 'WASTED';
      $('sb-big-sub').textContent = 'You didn\'t make it — cash −10% · Woke up at St. Coral Hospital';
      els.big.style.display = 'flex';
      setTimeout(function () { if (els.big) els.big.style.display = 'none'; }, 4000);
    }
  };
})();
