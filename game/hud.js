// hud.js — HUD Solmar Bay (B4, r5). SB.hud.init() SEBELUM bootFromQuery().
// update()/render() menulis SEMUA elemen DOM dari live state TIAP panggilan
// (cacat r3: speed/jam/wanted tidak pernah update). snapshot() tidak boleh throw:
// laju dari SB.state.speedKmh -> fallback SB.engine.hero.speedKmh.
// Minimap canvas LAZY: hanya dibuat SETELAH #game-canvas ada (engine mengambil
// canvas PERTAMA di DOM). #dlg kiri-bawah (wheel kanan-bawah, tidak menimpa).
// Banner pause DISEMBUNYIKAN saat staging (SB.hud.setStaging(true) oleh B5).
(function () {
  var SB = window.SB = window.SB || {};
  var H = SB.hud = SB.hud || {};
  H._inited = false; H._mm = null; H._els = {}; H.staging = false;
  H._RANKS = [[0, 'STREET KID'], [100, 'SMALL-TIME'], [400, 'HUSTLER'], [1000, 'BAY HUSTLER'], [2000, 'SOLMAR LEGEND']];
  H._CREW = [{ n: 'JAX', role: 'MECHANIC' }, { n: 'LUCIA', role: 'DRIVER' }, { n: 'MARA', role: 'FIXER' }];
  H._WNAMES = ['FISTS', 'PISTOL', 'SMG', 'SHOTGUN', 'RIFLE'];
  H._DAYS = ['FRI', 'SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU'];
  H.setStaging = function (v) { H.staging = !!v; try { H.render(); } catch (e) {} return H.staging; };
  function gv(o, k, d) { try { var v = o ? o[k] : undefined; return v === undefined || v === null ? d : v; } catch (e) { return d; } }
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : d; }
  H.rankFor = function (rep) {
    var r = H._RANKS[0][1], next = null;
    for (var i = 0; i < H._RANKS.length; i++) {
      if (rep >= H._RANKS[i][0]) r = H._RANKS[i][1];
      else { next = H._RANKS[i]; break; }
    }
    var prev = 0;
    for (var j = 0; j < H._RANKS.length; j++) if (rep >= H._RANKS[j][0]) prev = H._RANKS[j][0];
    var pct = next ? Math.min(100, Math.max(0, (rep - prev) / (next[0] - prev) * 100)) : 100;
    return { rank: r, pct: pct, next: next ? next[1] : null };
  };
  H.fmtClock = function (timeMin, day) {
    var t = num(timeMin, 1044), d = num(day, 1);
    var hh = Math.floor(t / 60) % 24, mm = Math.floor(t % 60);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return H._DAYS[((d - 1) % 7 + 7) % 7] + ' ' + p(hh) + ':' + p(mm) + ' · DAY ' + d;
  };
  H.fmtTimer = function (s) {
    s = Math.max(0, Math.ceil(num(s, 0)));
    var m = Math.floor(s / 60), r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  };
  H.speed = function () {
    var v = gv(SB.state, 'speedKmh', undefined);
    if (v === undefined) { try { v = SB.engine && SB.engine.hero ? SB.engine.hero.speedKmh : 0; } catch (e) { v = 0; } }
    return num(v, 0);
  };
  H.cash = function () {
    return Math.max(num(gv(SB, 'cash', 0), 0), num(SB.player ? SB.player.cash : 0, 0), num(SB.missions ? SB.missions.cash : 0, 0));
  };
  H.rep = function () {
    return Math.max(num(SB.player ? SB.player.rep : 0, 0), num(SB.missions ? SB.missions.rep : 0, 0));
  };
  H.stars = function () {
    try { if (SB.police && SB.police.stars) return Math.max(0, Math.min(5, num(SB.police.stars(), 0))); } catch (e) {}
    return Math.max(0, Math.min(5, num(gv(SB.state, 'heat', 0), 0)));
  };
  H.gear = function (kmh) {
    try { if (SB.vehicles && SB.vehicles.gear) return SB.vehicles.gear(kmh); } catch (e) {}
    if (kmh <= 0) return 'N';
    if (kmh < 30) return 'G1'; if (kmh < 60) return 'G2';
    if (kmh < 95) return 'G3'; if (kmh < 130) return 'G4';
    return 'G5';
  };
  H.snapshot = function () {
    try {
      var kmh = H.speed(), rep = H.rep(), rk = H.rankFor(rep);
      return {
        speedKmh: kmh, stars: H.stars(), cash: H.cash(), rep: rep, rank: rk.rank,
        gear: H.gear(kmh), time: H.fmtClock(gv(SB.state, 'timeMin', 1044), gv(SB.state, 'day', 1)),
        day: num(gv(SB.state, 'day', 1), 1),
        district: H.district(), hp: num(SB.player ? SB.player.hp : 100, 100),
        armor: num(SB.player ? SB.player.armor : 0, 0),
        weapon: num(SB.player ? SB.player.weapon : 1, 1),
        paused: !!gv(SB.state, 'paused', false),
        mission: H._curMission(), heat: num(gv(SB.state, 'heat', 0), 0)
      };
    } catch (e) {
      return { speedKmh: 0, stars: 0, cash: 0, rep: 0, rank: 'STREET KID', gear: 'N', time: 'FRI 00:00 · DAY 1', day: 1, district: 'DOWNTOWN', hp: 100, armor: 0, weapon: 1, paused: false, mission: null, heat: 0 };
    }
  };
  H.district = function () {
    var d = gv(SB.state, 'district', '');
    if (d) return d;
    try {
      var h = SB.engine && SB.engine.hero;
      if (h && SB.city && SB.city.districtAt) return SB.city.districtAt(h.x, h.z) || 'DOWNTOWN';
    } catch (e) {}
    return 'DOWNTOWN';
  };
  H._curMission = function () {
    try { return (SB.missions && SB.missions.current) ? SB.missions.current() : null; } catch (e) { return null; }
  };
  H._style = function () {
    if (document.getElementById('hud-css')) return;
    var st = document.createElement('style'); st.id = 'hud-css';
    st.textContent = '#hud{position:fixed;inset:0;pointer-events:none;font-family:Arial,sans-serif;color:#fff;z-index:40}'
      + '#hud *{box-sizing:border-box}'
      + '.hpn{position:absolute;background:rgba(8,10,18,.82);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:8px 10px;font-size:13px;line-height:1.4}'
      + '.hpn h3{margin:0;color:#ffb347;font-size:12px;letter-spacing:2px}'
      + '#hud-mission{top:10px;left:10px;width:250px}#hud-mission .mn{font-size:17px;font-weight:700}'
      + '#hud-mission .tm{color:#ffd34d;font-weight:700}'
      + '#hud-response{top:150px;left:10px;width:250px;font-size:12px}'
      + '#hud-crew{top:330px;left:10px;width:250px;font-size:12px}'
      + '#hud-right{top:10px;right:10px;width:210px;text-align:right;background:none;border:0;padding:0;text-shadow:0 1px 3px #000,0 0 6px rgba(0,0,0,.8)}'
      + '#mm-wrap{width:190px;height:190px;margin-left:auto;border-radius:50%;overflow:hidden;border:3px solid rgba(255,179,71,.85);background:#0a1220;box-shadow:0 0 18px rgba(0,0,0,.6)}'
      + '#mm-wrap canvas{display:block;width:190px;height:190px}'
      + '#hud-wanted{font-size:22px;letter-spacing:3px;color:#ffd34d;margin-top:6px}'
      + '#hud-wanted .off{color:#555}'
      + '#hud-sight{color:#ff6b6b;font-weight:700;font-size:12px;letter-spacing:1px}'
      + '#hud-cash{color:#7dff9a;font-size:21px;font-weight:700}'
      + '#hud-rep{font-size:12px;color:#ddd}#hud-rep b{color:#fff}'
      + '#hud-xp{height:5px;background:#333;border-radius:3px;margin:3px 0 2px;overflow:hidden}'
      + '#hud-xp i{display:block;height:100%;background:#ffb347}'
      + '#hud-clock{font-size:13px}#hud-dist{font-size:12px;color:#ccc}#hud-seas{font-size:12px;color:#ffb347}'
      + '#dlg{position:absolute;left:10px;bottom:10px;width:560px;max-width:62vw;display:none;background:rgba(8,10,18,.9);border:1px solid #ffb347;border-radius:8px;padding:10px 12px;pointer-events:auto}'
      + '#dlg img{float:left;width:64px;height:96px;object-fit:cover;border-radius:5px;margin-right:10px;background:#222}'
      + '#dlg .who{color:#ffb347;font-weight:700;font-size:13px;letter-spacing:1px}'
      + '#dlg .txt{font-size:14px;line-height:1.45}'
      + '#dlg .hint{text-align:right;color:#888;font-size:11px;clear:both}'
      + '#hud-bottom{position:absolute;left:590px;bottom:10px;width:274px;text-align:center}'
      + '#hud-radio{background:rgba(8,10,18,.82);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px 8px;font-size:12px;margin-bottom:6px}'
      + '#hud-radio b{color:#ffb347}'
      + '.bar{height:10px;background:#333;border-radius:5px;overflow:hidden;margin:3px 0;text-align:left}'
      + '.bar i{display:block;height:100%}'
      + '#hud-hp i{background:#ff4d4d}#hud-ar i{background:#4dc3ff}'
      + '#hud-barlab{display:flex;justify-content:space-between;font-size:11px;color:#ddd}'
      + '#hud-veh{position:absolute;right:10px;bottom:118px;text-align:right;font-size:12px;color:#ddd;text-shadow:0 1px 3px #000}'
      + '#hud-speed{font-size:34px;font-weight:700;line-height:1;color:#fff}'
      + '#hud-gear{color:#ffd34d;font-weight:700}'
      + '#hud-wheel{position:absolute;right:10px;bottom:10px;display:flex;gap:6px}'
      + '#hud-wheel .sl{width:76px;background:rgba(8,10,18,.85);border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:6px 4px;text-align:center;font-size:11px}'
      + '#hud-wheel .sl.cur{border-color:#ffb347;box-shadow:0 0 8px rgba(255,179,71,.7)}'
      + '#hud-wheel .sl .n{font-size:12px;font-weight:700}#hud-wheel .sl .a{color:#bbb;font-size:11px}#hud-wheel .sl.lk{opacity:.45}'
      + '#hud-pause{position:absolute;left:50%;top:62%;transform:translate(-50%,-50%);background:rgba(0,0,0,.65);padding:10px 22px;border-radius:8px;font-size:19px;font-weight:700;letter-spacing:2px;display:none}';
    document.head.appendChild(st);
  };
  H.init = function () {
    if (H._inited) return true;
    H._inited = true;
    try {
      H._style();
      var root = document.createElement('div'); root.id = 'hud';
      root.innerHTML = '<div class="hpn" id="hud-mission"></div>'
        + '<div class="hpn" id="hud-response"></div>'
        + '<div class="hpn" id="hud-crew"></div>'
        + '<div class="hpn" id="hud-right"><div id="mm-wrap"></div><div id="hud-wanted"></div><div id="hud-sight"></div><div id="hud-cash"></div><div id="hud-rep"></div><div id="hud-xp"><i></i></div><div id="hud-clock"></div><div id="hud-dist"></div><div id="hud-seas"></div></div>'
        + '<div id="dlg"><img alt=""><div class="who"></div><div class="txt"></div><div class="hint">CLICK TO CONTINUE</div></div>'
        + '<div id="hud-bottom"><div id="hud-radio"></div><div id="hud-barlab"><span id="hud-hplab"></span><span id="hud-arlab"></span></div><div class="bar" id="hud-hp"><i></i></div><div class="bar" id="hud-ar"><i></i></div></div>'
        + '<div id="hud-veh"><div id="hud-vehname"></div><div id="hud-speed"></div><div id="hud-gear"></div></div>'
        + '<div id="hud-wheel"></div>'
        + '<div id="hud-pause">PAUSED — [P] RESUME</div>';
      document.body.appendChild(root);
      var ids = ['hud-mission', 'hud-response', 'hud-crew', 'hud-right', 'dlg', 'hud-bottom', 'hud-wheel', 'hud-pause',
        'hud-wanted', 'hud-sight', 'hud-cash', 'hud-rep', 'hud-xp', 'hud-clock', 'hud-dist', 'hud-seas',
        'hud-radio', 'hud-hp', 'hud-ar', 'hud-hplab', 'hud-arlab', 'hud-vehname', 'hud-speed', 'hud-gear'];
      for (var i = 0; i < ids.length; i++) H._els[ids[i]] = document.getElementById(ids[i]);
      H._els['mm-wrap'] = document.querySelector('#mm-wrap');
      H._els['dlg-img'] = document.querySelector('#dlg img');
      H._els['dlg-who'] = document.querySelector('#dlg .who');
      H._els['dlg-txt'] = document.querySelector('#dlg .txt');
      if (!H._bound) {
        H._bound = true;
        document.addEventListener('keydown', function (e) {
          if (e.repeat || !e.code) return;
          try {
            if (e.code.indexOf('Digit') === 0) {
              var n = parseInt(e.code.slice(5), 10);
              if (n >= 1 && n <= 5 && SB.player && SB.player.setWeapon) SB.player.setWeapon(n);
            } else if (e.code === 'KeyR') {
              if (SB.player && SB.player.reload) SB.player.reload();
              if (SB.audio) SB.audio.reload();
            } else if (e.code === 'KeyP') {
              H.togglePause();
            } else if (e.code === 'Escape') {
              if (SB.map && SB.map.isOpen && SB.map.isOpen()) SB.map.close();
              else if (SB.shops && SB.shops.isOpen && SB.shops.isOpen()) SB.shops.close();
              else if (gv(SB.state, 'paused', false)) H.setPaused(false);
            }
          } catch (err) {}
          try { H.update(); H.render(); } catch (err2) {}
        });
      }
      H.update(); H.render();
      return true;
    } catch (e) { return false; }
  };
  H.setPaused = function (v) {
    try {
      if (SB.engine && SB.engine.setPaused) SB.engine.setPaused(!!v);
      else if (SB.state) SB.state.paused = !!v;
    } catch (e) { if (SB.state) SB.state.paused = !!v; }
    try { H.render(); } catch (e) {}
    return !!gv(SB.state, 'paused', false);
  };
  H.togglePause = function () { return H.setPaused(!gv(SB.state, 'paused', false)); };
  H._jobsByGiver = function () {
    var jobs = [];
    try { jobs = (SB.missions && SB.missions.jobs) ? SB.missions.jobs() : []; } catch (e) {}
    var out = {};
    for (var i = 0; i < jobs.length; i++) {
      var g = String(jobs[i].giver || '').toUpperCase();
      if (!out[g]) out[g] = { done: 0, total: 0 };
      out[g].total++;
      if (jobs[i].st === 'DONE') out[g].done++;
    }
    return out;
  };
  H.update = function () {
    try { H._s = H.snapshot(); } catch (e) { H._s = null; }
    return H._s;
  };
  H.render = function () {
    if (!H._inited) return false;
    var s;
    try { s = H.snapshot(); } catch (e) { return false; }
    H._s = s;
    var E = H._els;
    try {
      // Misi + timer + standoff.
      var m = s.mission, mh = '';
      if (m) {
        mh = '<h3>MISSION</h3><div class="mn">' + (m.name || '—') + '</div>'
          + '<div>STAGE ' + num(m.objIdx, 1) + '/' + num(m.objTotal, 1) + ' · PAY $' + num(m.pay, m.pay || 0) + ' · ' + (m.giver || '') + '</div>'
          + '<div>' + (m.obj || '') + '</div>'
          + (num(m.standoff, 0) > 0 ? '<div>STANDOFF ' + num(m.standoff, 0) + ' LEFT</div>' : '')
          + '<div class="tm">TIME ' + H.fmtTimer(m.timeLeft) + '</div>';
      } else {
        mh = '<h3>MISSION</h3><div class="mn">FREE ROAM</div><div>Tekan M — peta &amp; jobs</div>';
      }
      if (E['hud-mission']) E['hud-mission'].innerHTML = mh;
      // Response polisi.
      var resp = [];
      try { resp = (SB.police && SB.police.response) ? SB.police.response : []; } catch (e) {}
      var rh = '<h3>SOLMAR PD</h3>';
      if (!resp.length) rh += '<div>— no units —</div>';
      for (var i = 0; i < Math.min(7, resp.length); i++) {
        var r = resp[i];
        rh += '<div>' + (r.name || 'UNIT') + ' · ' + num(r.dist, r.d) + 'm · ' + (r.status || '') + '</div>';
      }
      if (E['hud-response']) E['hud-response'].innerHTML = rh;
      // Crew.
      var jb = H._jobsByGiver(), ch = '<h3>CREW</h3>';
      for (var c = 0; c < H._CREW.length; c++) {
        var cr = H._CREW[c], g = jb[cr.n] || { done: 0, total: 0 };
        ch += '<div>' + cr.n + ' · ' + g.done + '/' + g.total + ' JOBS · ' + cr.role + '</div>';
      }
      if (E['hud-crew']) E['hud-crew'].innerHTML = ch;
      // Kanan: wanted, sight, cash, REP, jam, distrik, musim.
      var stars = '';
      for (var k = 0; k < 5; k++) stars += k < s.stars ? '★' : '<span class="off">☆</span>';
      if (E['hud-wanted']) E['hud-wanted'].innerHTML = stars + (s.stars ? '<div style="font-size:12px;letter-spacing:2px">WANTED</div>' : '');
      if (E['hud-sight']) E['hud-sight'].textContent = s.stars >= 3 ? 'IN SIGHT · GULL-1' : s.stars > 0 ? 'PURSUIT — BREAK LINE OF SIGHT' : 'CLEAN';
      if (E['hud-cash']) E['hud-cash'].textContent = '$' + s.cash;
      var rk = H.rankFor(s.rep);
      if (E['hud-rep']) E['hud-rep'].innerHTML = 'REP <b>' + s.rep + '</b> · ' + rk.rank;
      var xp = E['hud-xp'] ? E['hud-xp'].querySelector('i') : null;
      if (xp) xp.style.width = rk.pct + '%';
      if (E['hud-clock']) E['hud-clock'].textContent = s.time;
      if (E['hud-dist']) E['hud-dist'].textContent = s.district;
      if (E['hud-seas']) E['hud-seas'].textContent = (gv(SB.state, 'season', 'SUMMER')) + ' · ' + (gv(SB.state, 'tod', 'SUNSET'));
      // Bawah-tengah: radio + health/armor.
      var rl = 'RADIO ';
      try { rl += SB.radio ? SB.radio.label() : 'WAVE 88.1'; } catch (e) { rl += 'WAVE 88.1'; }
      rl += ' [Q]';
      if (E['hud-radio']) E['hud-radio'].innerHTML = '<b>' + rl + '</b>';
      if (E['hud-hplab']) E['hud-hplab'].textContent = 'HEALTH ' + Math.round(s.hp) + '%';
      if (E['hud-arlab']) E['hud-arlab'].textContent = 'ARMOR ' + Math.round(s.armor) + '%';
      var hpi = E['hud-hp'] ? E['hud-hp'].querySelector('i') : null;
      if (hpi) hpi.style.width = Math.max(0, Math.min(100, s.hp)) + '%';
      var ari = E['hud-ar'] ? E['hud-ar'].querySelector('i') : null;
      if (ari) ari.style.width = Math.max(0, Math.min(100, s.armor)) + '%';
      // Kendaraan + speed + gear.
      var hero = {};
      try { hero = (SB.engine && SB.engine.hero) || {}; } catch (e) {}
      var cond = num(hero.cond, 100);
      var vst = cond >= 85 ? 'CLEAN' : cond >= 40 ? 'DENTED' : 'WRECKED';
      var vn = hero.name || (SB.vehicles && SB.vehicles.hero && SB.vehicles.hero.name) || 'VENTO STRADA';
      if (E['hud-vehname']) E['hud-vehname'].textContent = vn + ' · COND ' + Math.round(cond) + '% ' + vst;
      if (E['hud-speed']) E['hud-speed'].textContent = Math.round(s.speedKmh) + ' km/h';
      if (E['hud-gear']) E['hud-gear'].textContent = 'GEAR ' + s.gear;
      // Weapon wheel.
      var ws = [];
      try { ws = (SB.player && SB.player.weapons) ? SB.player.weapons : []; } catch (e) {}
      var wh = '';
      for (var w = 0; w < 5; w++) {
        var we = ws[w] || {}, nm = we.name || H._WNAMES[w];
        var lk = !!we.locked;
        var ammo = w === 0 ? '—' : (num(we.mag, we.ammo) + '/' + num(we.reserve, 0));
        wh += '<div class="sl' + (s.weapon === w + 1 ? ' cur' : '') + (lk ? ' lk' : '') + '"><div class="n">' + (w + 1) + ' ' + nm + '</div><div class="a">' + (lk ? 'LOCKED' : ammo) + '</div></div>';
      }
      if (E['hud-wheel']) E['hud-wheel'].innerHTML = wh;
      // Banner pause: sembunyi saat staging.
      if (E['hud-pause']) E['hud-pause'].style.display = (s.paused && !H.staging) ? 'block' : 'none';
      // Minimap lazy + gambar.
      H._minimap();
      return true;
    } catch (e) { return false; }
  };
  H._minimap = function () {
    try {
      if (!H._mm) {
        var gc = document.getElementById('game-canvas');
        if (!gc) return;
        var cv = document.createElement('canvas');
        cv.width = 190; cv.height = 190;
        var wrap = H._els['mm-wrap'];
        if (!wrap) return;
        wrap.appendChild(cv);
        H._mm = cv;
      }
      var g = H._mm.getContext('2d');
      if (!g) return;
      var W = 190, Cx = 95, Cy = 95;
      g.clearRect(0, 0, W, W);
      g.save();
      g.beginPath(); g.arc(Cx, Cy, 94, 0, 6.2832); g.clip();
      g.fillStyle = '#0a1220'; g.fillRect(0, 0, W, W);
      var ds = [];
      try { ds = (SB.city && SB.city.districts) || []; } catch (e) {}
      var b = { x0: -120, z0: -120, x1: 120, z1: 120 };
      if (ds.length) {
        b = { x0: 1e9, z0: 1e9, x1: -1e9, z1: -1e9 };
        for (var i = 0; i < ds.length; i++) {
          b.x0 = Math.min(b.x0, ds[i].x0); b.z0 = Math.min(b.z0, ds[i].z0);
          b.x1 = Math.max(b.x1, ds[i].x1); b.z1 = Math.max(b.z1, ds[i].z1);
        }
      }
      var range = Math.max(b.x1 - b.x0, b.z1 - b.z0) || 240;
      var sc = W / range;
      function MX(x) { return (x - b.x0) * sc; }
      function MZ(z) { return (z - b.z0) * sc; }
      var DC = ['#3d6b8f', '#7a4a8f', '#4a7a5c', '#8f6b3d', '#5c5c7a', '#8f4a4a', '#3d7a6b', '#6b5c8f', '#7a7a3d'];
      for (var d = 0; d < ds.length; d++) {
        g.fillStyle = DC[d % DC.length];
        g.fillRect(MX(ds[d].x0), MZ(ds[d].z0), (ds[d].x1 - ds[d].x0) * sc, (ds[d].z1 - ds[d].z0) * sc);
      }
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1;
      for (var gx = 0; gx <= W; gx += 14) { g.beginPath(); g.moveTo(gx, 0); g.lineTo(gx, W); g.stroke(); }
      for (var gy = 0; gy <= W; gy += 14) { g.beginPath(); g.moveTo(0, gy); g.lineTo(W, gy); g.stroke(); }
      var mk = null;
      try { mk = SB.missions ? SB.missions.marker : null; } catch (e) {}
      var hero = {};
      try { hero = (SB.engine && SB.engine.hero) || {}; } catch (e) {}
      var hx = num(hero.x, 0), hz = num(hero.z, 60);
      // Search-zone (heat >= 3): lingkaran putus-putus merah di hero.
      var heat = H.stars();
      if (heat >= 3) {
        g.strokeStyle = 'rgba(255,60,60,.9)'; g.setLineDash([5, 4]); g.lineWidth = 2;
        g.beginPath(); g.arc(MX(hx), MZ(hz), 26 + heat * 4, 0, 6.2832); g.stroke();
        g.setLineDash([]);
      }
      if (mk && mk.on) {
        g.fillStyle = '#ff3b30';
        g.beginPath(); g.moveTo(MX(mk.x), MZ(mk.z) - 6); g.lineTo(MX(mk.x) + 6, MZ(mk.z)); g.lineTo(MX(mk.x), MZ(mk.z) + 6); g.lineTo(MX(mk.x) - 6, MZ(mk.z)); g.closePath(); g.fill();
      }
      g.fillStyle = '#fff';
      g.beginPath(); g.moveTo(MX(hx), MZ(hz) - 7); g.lineTo(MX(hx) + 5, MZ(hz) + 6); g.lineTo(MX(hx) - 5, MZ(hz) + 6); g.closePath(); g.fill();
      g.restore();
      g.strokeStyle = 'rgba(255,179,71,.9)'; g.lineWidth = 2;
      g.beginPath(); g.arc(Cx, Cy, 93, 0, 6.2832); g.stroke();
    } catch (e) {}
  };
})();
