(function () {
  'use strict';
  var SB = window.SB = window.SB || {};
  var S = SB.state, W = SB.world;
  var JOBS_FALLBACK = [
    { id: 'first-fare', title: 'FIRST FARE', contact: 'MARA SOLIS', payout: 500, spot: 'hotel' },
    { id: 'the-package', title: 'THE PACKAGE', contact: 'MARA SOLIS', payout: 1200, spot: 'marina' },
    { id: 'hot-wheels', title: 'HOT WHEELS', contact: 'MARA SOLIS', payout: 1800, spot: 'garage' },
    { id: 'night-run', title: 'NIGHT RUN', contact: 'MARA SOLIS', payout: 2500, spot: 'neon' },
    { id: 'chop-shop', title: 'CHOP SHOP', contact: 'MARA SOLIS', payout: 3200, spot: 'garage' },
    { id: 'harbor-lights', title: 'HARBOR LIGHTS', contact: 'MARA SOLIS', payout: 3200, spot: 'marina' },
    { id: 'heat', title: 'HEAT', contact: 'MARA SOLIS', payout: 4200, spot: 'police' },
    { id: 'big-score', title: 'THE BIG SCORE', contact: 'MARA SOLIS', payout: 5000, spot: 'bank' }
  ];
  var LEGEND = [
    ['★', '#ffd23f', 'Story contact'], ['◆', '#ffe14d', 'Job objective'], ['⌂', '#39d353', 'Safehouse'],
    ['✚', '#ff5a5a', 'Hospital'], ['⚑', '#4d9fff', 'Police'], ['$', '#b57edc', 'Weapons shop'],
    ['✦', '#ff2a7a', 'Respray'], ['🏁', '#ffffff', 'Street race'], ['♦', '#ffd23f', 'Property'],
    ['◉', '#ff9f1c', 'Sunset tape']
  ];
  var ICONS = { bank: '＄', hospital: '✚', police: '⚑', hotel: 'H', garage: '⚙', safehouse: '⌂', respray: '✦', shop: '$', club: '♪' };
  var root = null, cv = null, ctx = null, visible = false;
  var MX0 = -560, MZ0 = -470, MX1 = 470, MZ1 = 530;
  function px(x) { return (x - MX0) / (MX1 - MX0) * cv.width; }
  function py(z) { return (z - MZ0) / (MZ1 - MZ0) * cv.height; }
  function jobs() {
    if (SB.missions && SB.missions.JOBS && SB.missions.JOBS.length) return SB.missions.JOBS;
    return JOBS_FALLBACK;
  }
  var JOB_SPOT = { 'first-fare': 'hotel', 'the-package': 'marina', 'hot-wheels': 'garage', 'night-run': 'neon', 'chop-shop': 'garage', 'harbor-lights': 'marina', 'heat': 'police', 'big-score': 'bank' };
  function missionTarget() {
    if (SB.missions && SB.missions.active) {
      var a = SB.missions.active();
      var sm = SB.state.mission;
      if (a && sm && sm.id === a.id && a.stages[sm.stage - 1] && a.stages[sm.stage - 1].target) return a.stages[sm.stage - 1].target;
      if (a) { var j = jobs(); for (var i = 0; i < j.length; i++) { var sp = j[i].spot || JOB_SPOT[j[i].id]; if (j[i].id === a.id && sp && W.spawns.missions[sp]) return W.spawns.missions[sp]; } }
    }
    if (S.mission) { var js = jobs(); for (var k = 0; k < js.length; k++) { var sp2 = js[k].spot || JOB_SPOT[js[k].id]; if (js[k].id === S.mission.id && sp2 && W.spawns.missions[sp2]) return W.spawns.missions[sp2]; } }
    return null;
  }
  function distTo(t) {
    var p = W.player && W.player.pos;
    if (!p || !t) return null;
    return Math.round(Math.sqrt((t.x - p.x) * (t.x - p.x) + (t.z - p.z) * (t.z - p.z)));
  }
  function drawMap() {
    if (!ctx) return;
    var w = cv.width, h = cv.height;
    ctx.fillStyle = '#0d1a2e'; ctx.fillRect(0, 0, w, h);
    var ds = W.districts || [];
    for (var i = 0; i < ds.length; i++) {
      var d = ds[i];
      ctx.fillStyle = '#' + ('000000' + (d.tint || 0x223344).toString(16)).slice(-6);
      ctx.globalAlpha = 0.55;
      ctx.fillRect(px(d.x0), py(d.z0), px(d.x1) - px(d.x0), py(d.z1) - py(d.z0));
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'left';
      ctx.fillText(d.name.toUpperCase(), px(d.x0) + 6, py(d.z0) + 18);
    }
    var rs = W.roads || [];
    ctx.strokeStyle = '#5a6a80'; ctx.lineWidth = 5;
    for (var r = 0; r < rs.length; r++) {
      ctx.beginPath();
      if (rs[r].axis === 'z') { ctx.moveTo(px(rs[r].at), py(rs[r].from)); ctx.lineTo(px(rs[r].at), py(rs[r].to)); }
      else { ctx.moveTo(px(rs[r].from), py(rs[r].at)); ctx.lineTo(px(rs[r].to), py(rs[r].at)); }
      ctx.stroke();
    }

    ctx.fillStyle = '#1a5a8a'; ctx.fillRect(0, 0, px(-560) + 8, h);
    var lms = W.landmarks || [];
    ctx.textAlign = 'center';
    for (var m = 0; m < lms.length; m++) {
      var lm = lms[m], ic = ICONS[lm.kind] || '•';
      ctx.fillStyle = lm.kind === 'safehouse' ? '#39d353' : lm.kind === 'shop' ? '#b57edc' : lm.kind === 'hospital' ? '#ff5a5a' : lm.kind === 'police' ? '#4d9fff' : '#ffd23f';
      ctx.beginPath(); ctx.arc(px(lm.x), py(lm.z), 11, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#0a0f18'; ctx.font = 'bold 12px Arial';
      ctx.fillText(ic, px(lm.x), py(lm.z) + 4);
    }
    var t = missionTarget();
    if (t) {
      ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(px(t.x), py(t.z), 14, 0, 6.2832); ctx.stroke();
      ctx.fillStyle = '#ffe14d'; ctx.font = 'bold 16px Arial';
      ctx.fillText('◆', px(t.x), py(t.z) - 18);
    }
    var p = W.player && W.player.pos;
    if (p) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px(p.x), py(p.z), 7, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#ff2a7a'; ctx.beginPath(); ctx.arc(px(p.x), py(p.z), 4, 0, 6.2832); ctx.fill();
    }
  }
  function build() {
    root = document.createElement('div');
    root.id = 'sb-map';
    root.style.cssText = 'position:fixed;inset:0;background:#040810;z-index:55;display:none;color:#fff;font-family:Arial,sans-serif';
    root.innerHTML = '<div style="display:flex;height:100%;padding:18px;gap:16px;box-sizing:border-box">' +
      '<div style="flex:1;display:flex;flex-direction:column"><div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:22px;letter-spacing:3px">SOLMAR BAY</b><button id="sb-map-x" style="background:#ff2a7a;color:#fff;border:0;border-radius:5px;padding:6px 12px;cursor:pointer">CLOSE [M]</button></div>' +
      '<div id="sb-map-gps" style="color:#ffd23f;font-size:14px;margin:6px 0"></div>' +
      '<canvas id="sb-map-cv" width="640" height="620" style="align-self:center;height:100%;aspect-ratio:640/620;max-width:100%;border:2px solid #2a4a6a;border-radius:8px"></canvas></div>' +
      '<div style="width:300px;overflow-y:auto"><div style="font-size:13px;letter-spacing:2px;color:#9fb4d8">STORY JOBS — <span id="sb-map-done"></span></div><div id="sb-map-jobs"></div>' +
      '<div style="font-size:13px;letter-spacing:2px;color:#9fb4d8;margin-top:14px">LEGEND</div><div id="sb-map-legend" style="font-size:13px;line-height:1.9"></div>' +
      '<div style="font-size:13px;letter-spacing:2px;color:#9fb4d8;margin-top:14px">DISTRICTS</div><div id="sb-map-districts" style="font-size:13px;line-height:1.7"></div>' +
      '<div style="font-size:13px;letter-spacing:2px;color:#9fb4d8;margin-top:14px">COLLECTIBLES</div><div id="sb-map-coll" style="font-size:13px;line-height:1.7"></div></div></div>';
    document.body.appendChild(root);
    cv = root.querySelector('#sb-map-cv');
    ctx = cv.getContext('2d');
    root.querySelector('#sb-map-x').onclick = function () { SB.map.hide(); };
    var lh = '';
    for (var i = 0; i < LEGEND.length; i++) lh += '<span style="color:' + LEGEND[i][1] + '">' + LEGEND[i][0] + '</span> ' + LEGEND[i][2] + '<br>';
    root.querySelector('#sb-map-legend').innerHTML = lh;
  }
  SB.map = {
    JOBS: JOBS_FALLBACK,
    show: function () {
      if (!root) build();
      visible = true; root.style.display = 'block';
      SB.map.render();
      if (SB.setPaused) SB.setPaused(true);
    },
    hide: function () {
      visible = false;
      if (root) root.style.display = 'none';
      if (SB.setPaused && !(SB.dialog && SB.dialog.active())) SB.setPaused(false);
    },
    toggle: function () { if (SB.map.isOpen()) SB.map.hide(); else SB.map.show(); },
    isOpen: function () { return visible; },
    render: function () {
      if (!root || !visible) return;
      drawMap();
      var js = jobs();
      var h = '';
      for (var i = 0; i < js.length; i++) {
        var j = js[i];
        var done = i < S.missionsDone;
        var active = S.mission && S.mission.id === j.id;
        h += '<div style="padding:8px 0;border-top:1px solid #223">' +
          '<b style="color:' + (active ? '#ffd23f' : done ? '#39d353' : '#fff') + '">' + (i + 1) + '. ' + j.title + '</b>' +
          '<span style="float:right;color:#39d353">$' + (j.payout || 0).toLocaleString('en-US') + '</span><br>' +
          '<span style="color:#9fb4d8;font-size:12px">' + (j.contact || 'MARA SOLIS') + ' · ' + (done ? 'DONE ✓' : active ? 'IN PROGRESS' : 'LOCKED') + '</span></div>';
      }
      root.querySelector('#sb-map-jobs').innerHTML = h;
      root.querySelector('#sb-map-done').textContent = S.missionsDone + '/' + S.missionsTotal + ' DONE';
      var ds = W.districts || [], dh = '';
      for (var d = 0; d < ds.length; d++) dh += '· ' + ds[d].name + '<br>';
      root.querySelector('#sb-map-districts').innerHTML = dh;
      root.querySelector('#sb-map-coll').innerHTML = '☀ Sun Coins ' + S.coins + '/' + S.coinsTotal + '<br>◉ Sunset Tapes ' + S.tapes + '/' + S.tapesTotal + '<br>♦ Properties 0/2';
      var t = missionTarget(), g = distTo(t);
      root.querySelector('#sb-map-gps').textContent = t ? ('GPS → ' + (S.mission ? S.mission.title : 'OBJECTIVE') + ': ' + g + ' m') : 'GPS — no active objective';
    }
  };
  window.addEventListener('keydown', function (e) {
    if (e.code === 'KeyM' && S.started) { e.preventDefault(); SB.map.toggle(); }
  });
})();
