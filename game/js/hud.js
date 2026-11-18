// Solmar Bay — hud.js
// One job: every pixel of DOM interface — mission panel, SBPD response list,
// wanted stars, cash, clock, round minimap, health/armor/REP bars, dialog box
// with portraits, weapon wheel, vehicle + radio widgets, the full city map,
// the shop, toasts, and the start / pause / busted screens.
'use strict';

const HUD = {
  el: {},
  toastTimer: null, promptText: '', mapOpen: false, pauseOpen: false, shopOpen: false,

  init() {
    const ids = ['mission-panel', 'm-chapter', 'm-title', 'm-objective', 'm-stage-fill', 'm-next', 'm-timer',
      'response-panel', 'response-list', 'response-count', 'cash', 'clock', 'day', 'stars', 'wanted-status',
      'minimap', 'location', 'health-fill', 'armor-fill', 'rep-fill', 'rep-title', 'rep-xp', 'coins-label',
      'dialog', 'dlg-img', 'dlg-name', 'dlg-text', 'weapons', 'vehicle-panel', 'veh-name', 'veh-cond-fill',
      'veh-cond-pct', 'speed', 'gear', 'radio-name', 'radio-track', 'toast', 'prompt', 'hitmarker',
      'crosshair', 'damage-flash', 'map-screen', 'bigmap', 'job-list', 'map-gps', 'shop-screen',
      'shop-title', 'shop-items', 'start-screen', 'btn-new', 'btn-continue', 'btn-how', 'howto',
      'pause-menu', 'btn-resume', 'btn-save', 'btn-map', 'btn-quit', 'busted-screen', 'busted-title',
      'busted-text', 'btn-busted-ok', 'hud'];
    for (const id of ids) this.el[id] = document.getElementById(id);
    // Weapon wheel slots.
    this.el.weapons.innerHTML = WEAPONS.map((w, i) =>
      '<div class="wslot" id="wslot-' + i + '"><span class="wkey">' + (i + 1) + '</span>' +
      '<span class="wname">' + w.short + '</span><span class="wammo" id="wammo-' + i + '"></span>' +
      '<span class="wlock" id="wlock-' + i + '">LOCKED</span></div>').join('');
    // Buttons.
    this.el['btn-new'].onclick = () => { AudioSys.init(); AudioSys.resume(); SaveGame.clear(); Game.startNew(); };
    this.el['btn-continue'].onclick = () => { AudioSys.init(); AudioSys.resume(); Game.startContinue(); };
    this.el['btn-how'].onclick = () => { this.el.howto.classList.toggle('hidden'); };
    this.el['btn-resume'].onclick = () => this.togglePause();
    this.el['btn-save'].onclick = () => { SaveGame.manualSave(); };
    this.el['btn-map'].onclick = () => { this.togglePause(); this.toggleMap(); };
    this.el['btn-quit'].onclick = () => location.reload();
    this.el['btn-busted-ok'].onclick = () => { this.el['busted-screen'].classList.add('hidden'); G.state = 'play'; };
    this.el.dialog.onclick = () => {
      if (Missions.dialogQueue.length) Missions.nextDialogLine(Missions.active ? Missions.active.contact : 'Mara Solis', Missions.active ? Missions.active.portrait : 'mara.jpg');
      else this.hideDialog();
    };
    if (!SaveGame.hasSave()) this.el['btn-continue'].classList.add('disabled');
    this.refreshAll();
  },

  refreshAll() {
    this.refreshCash(); this.refreshClock(); this.refreshStars();
    this.refreshMission(); this.refreshRep(); this.refreshWeapons(); this.refreshVehicle();
    this.el['coins-label'].textContent = 'SUN COINS ' + G.stats.coins + '/' + SUN_COINS;
  },
  refreshCash() { this.el.cash.textContent = fmtCash(G.cash); },
  refreshClock() {
    this.el.day.textContent = 'DAY ' + G.day;
    this.el.clock.textContent = fmtClock(G.day, G.minutes);
  },
  refreshStars() {
    const s = Police.stars();
    let html = '';
    for (let i = 0; i < 5; i++) html += '<span class="star' + (i < s ? ' on' : '') + '">★</span>';
    this.el.stars.innerHTML = html;
    const st = s === 0 ? '' : (Police.inSight ? 'IN SIGHT' : 'SEARCHING') + (Police.heli ? ' · AIR-1' : '');
    this.el['wanted-status'].textContent = st;
    this.el['wanted-status'].className = s > 0 ? 'hot' : '';
  },
  refreshMission() {
    const m = Missions.active;
    if (!m) {
      const next = MISSIONS.find(x => !Missions.done[x.id]);
      this.el['m-chapter'].textContent = next ? 'NEXT JOB' : 'STORY COMPLETE';
      this.el['m-title'].textContent = next ? next.title : 'Solmar Bay is yours';
      this.el['m-objective'].textContent = next ? 'Drive to Mara Solis — press E near the marker, or start from the map (M).' : 'All 8 jobs done. Free roam, collect coins, run fares.';
      this.el['m-next'].textContent = next ? 'PAYOUT ' + fmtCash(next.payout) : '';
      this.el['m-stage-fill'].style.width = (G.missionsDone / 8 * 100) + '%';
      this.el['m-timer'].textContent = '';
      return;
    }
    const st = Missions.currentStage();
    this.el['m-chapter'].textContent = m.chapter + ' · STORY ' + G.missionsDone + '/8';
    this.el['m-title'].textContent = m.title;
    this.el['m-objective'].textContent = st ? st.text : '';
    this.el['m-next'].textContent = 'PAYOUT ' + fmtCash(m.payout);
    this.el['m-stage-fill'].style.width = ((Missions.stageIdx) / m.stages.length * 100) + '%';
    this.el['m-timer'].textContent = m.timer ? '⏱ ' + Math.max(0, Math.ceil(Missions.timerLeft)) + 's' : '';
  },
  refreshRep() {
    const r = repRank(G.rep);
    const next = REP_RANKS.find(k => k.xp > G.rep);
    this.el['rep-title'].textContent = r.title;
    this.el['rep-xp'].textContent = 'REP ' + (REP_RANKS.indexOf(r) + 1) + ' · ' + G.rep + (next ? ' / ' + next.xp : ' MAX');
    const base = r.xp, top = next ? next.xp : r.xp + 1000;
    this.el['rep-fill'].style.width = clamp((G.rep - base) / (top - base) * 100, 0, 100) + '%';
  },
  refreshWeapons() {
    WEAPONS.forEach((w, i) => {
      const slot = document.getElementById('wslot-' + i);
      const ammo = document.getElementById('wammo-' + i);
      const lock = document.getElementById('wlock-' + i);
      const un = Combat.unlocked(w);
      slot.classList.toggle('active', i === Combat.slot);
      slot.classList.toggle('locked', !un);
      lock.style.display = un ? 'none' : 'block';
      ammo.textContent = w.id === 'fists' ? '∞' : Combat.mag[w.id] + '/' + Combat.reserve[w.id];
    });
  },
  refreshVehicle() {
    const car = Vehicles.playerCar;
    this.el['vehicle-panel'].style.display = car ? 'block' : 'none';
    if (!car) return;
    this.el['veh-name'].textContent = car.name.toUpperCase();
    this.el['veh-cond-fill'].style.width = car.condition + '%';
    this.el['veh-cond-fill'].style.background = car.condition > 50 ? '#37d67a' : car.condition > 25 ? '#ffc300' : '#ff4444';
    this.el['veh-cond-pct'].textContent = Math.round(car.condition) + '%';
    this.el.speed.textContent = Vehicles.kmh(car);
    this.el.gear.textContent = Vehicles.gearOf(car);
  },
  refreshResponse() {
    const units = Police.responseList();
    this.el['response-panel'].style.display = units.length ? 'block' : 'none';
    this.el['response-count'].textContent = units.length + ' UNITS · CODE ' + Police.stars();
    this.el['response-list'].innerHTML = units.slice(0, 6).map(u =>
      '<div class="unit"><span class="u-dot"></span><span class="u-name">' + u.name + '</span>' +
      '<span class="u-dist">' + (u.dist ? u.dist + ' m' : '—') + '</span>' +
      '<span class="u-status ' + (u.status === 'RAMMING' || u.status === 'SPOTLIGHT' ? 'hot' : '') + '">' + u.status + '</span></div>'
    ).join('') + (units.length > 6 ? '<div class="unit more">+' + (units.length - 6) + ' more units in the search zone</div>' : '');
  },
  refreshRadio() {
    const st = RADIO[AudioSys.station];
    this.el['radio-name'].textContent = '♪ ' + st.name + ' · ' + st.genre;
    this.el['radio-track'].textContent = '“' + st.track + '” — ' + st.artist;
  },
  refreshBars() {
    this.el['health-fill'].style.width = G.player.health + '%';
    this.el['armor-fill'].style.width = (G.player.armor || 0) + '%';
  },

  // ---- Minimap + full map ----------------------------------------------
  drawMap(canvas, full) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const sx = W / WORLD.w, sy = H / WORLD.h;
    const X = x => (x + WORLD.hx) * sx, Z = z => (z + WORLD.hz) * sy;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#20261f'; ctx.fillRect(0, 0, W, H);
    // Ocean + beach.
    ctx.fillStyle = '#1f7fa8'; ctx.fillRect(0, 0, X(-1600), H);
    ctx.fillStyle = '#e8d29a'; ctx.fillRect(X(-1600), 0, X(-1210) - X(-1600), H);
    // Blocks.
    ctx.fillStyle = '#3a4438';
    for (let i = 0; i < AVENUES.length - 1; i++) for (let j = 0; j < STREETS.length - 1; j++) {
      ctx.fillRect(X(AVENUES[i]) + 2, Z(STREETS[j]) + 2, X(AVENUES[i + 1]) - X(AVENUES[i]) - 4, Z(STREETS[j + 1]) - Z(STREETS[j]) - 4);
    }
    // Roads.
    ctx.strokeStyle = '#555c66'; ctx.lineWidth = full ? 7 : 3;
    for (const a of AVENUES) { ctx.beginPath(); ctx.moveTo(X(a), 0); ctx.lineTo(X(a), H); ctx.stroke(); }
    for (const s of STREETS) { ctx.beginPath(); ctx.moveTo(0, Z(s)); ctx.lineTo(W, Z(s)); ctx.stroke(); }
    if (full) {
      ctx.fillStyle = '#cfd6c2'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
      for (const d of DISTRICTS) {
        const lx = clamp(X((d.x0 + d.x1) / 2), 70, W - 70);
        ctx.fillText(d.name.toUpperCase(), lx, Z((d.z0 + d.z1) / 2));
      }
      // Landmark icons.
      ctx.font = 'bold 13px Arial';
      for (const lm of LANDMARKS) {
        ctx.fillStyle = lm.kind === 'safehouse' ? '#7CFC00' : lm.kind === 'hospital' ? '#ff6666' : lm.kind === 'police' ? '#7fb3ff' : '#ffd27a';
        ctx.fillText(this.iconFor(lm.kind), X(lm.x), Z(lm.z) + 4);
      }
    }
    // Sun coins.
    ctx.fillStyle = '#ffd700';
    for (const c of City.coinMeshes) if (!c.taken) { ctx.beginPath(); ctx.arc(X(c.x), Z(c.z), full ? 3 : 1.6, 0, 7); ctx.fill(); }
    // Heli search zone.
    if (Police.heli) {
      ctx.strokeStyle = 'rgba(255,60,60,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X(G.player.x), Z(G.player.z), 30 * sx, 0, 7); ctx.stroke();
    }
    // Mission beacon.
    const gps = Missions.gps();
    if (gps) {
      const pulse = 4 + Math.sin(G.time * 5) * 1.5;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath(); ctx.arc(X(gps.x), Z(gps.z), (full ? 6 : 4) + pulse * 0.4, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(X(gps.x), Z(gps.z), (full ? 10 : 7) + pulse * 0.4, 0, 7); ctx.stroke();
    }
    // Traffic (yellow), cops (red/blue flash), peds (faint).
    ctx.fillStyle = '#ffe66d';
    for (const c of Vehicles.list) if (c.traffic) { ctx.fillRect(X(c.x) - 1.5, Z(c.z) - 1.5, 3, 3); }
    const copOn = Math.floor(G.time * 4) % 2 === 0;
    ctx.fillStyle = copOn ? '#ff3333' : '#3366ff';
    for (const c of Police.cruisers) { ctx.beginPath(); ctx.arc(X(c.x), Z(c.z), full ? 4 : 2.5, 0, 7); ctx.fill(); }
    if (Police.heli) {
      ctx.fillStyle = '#ff3333'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
      ctx.fillText('H', X(Police.heli.position.x), Z(Police.heli.position.z));
    }
    // Player arrow.
    const px = X(G.player.x), pz = Z(G.player.z);
    const hd = Vehicles.playerCar ? Vehicles.playerCar.heading : G.player.heading;
    ctx.save(); ctx.translate(px, pz); ctx.rotate(-hd + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    // North marker.
    if (!full) { ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.fillText('N', W / 2, 12); }
    return { gps };
  },
  iconFor(kind) {
    return { bank: '$', hospital: '+', police: '★', hotel: 'H', chopshop: '⚙', safehouse: '⌂', gunshop: '✛', respray: '◐', docks: '⚓', marina: '⚓' }[kind] || '•';
  },

  // ---- Dialog / toast / prompt ------------------------------------------
  showDialog(name, portrait, text) {
    this.el['dlg-img'].src = 'assets/' + portrait;
    this.el['dlg-name'].textContent = name.toUpperCase();
    this.el['dlg-text'].textContent = text;
    this.el.dialog.classList.remove('hidden');
  },
  hideDialog() { this.el.dialog.classList.add('hidden'); },
  toast(text) {
    this.el.toast.textContent = text;
    this.el.toast.classList.remove('hidden');
    this.el.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.remove('show'), 3600);
  },
  showPrompt(text) {
    if (this.promptText === text) return;
    this.promptText = text;
    this.el.prompt.textContent = text;
    this.el.prompt.classList.remove('hidden');
  },
  hidePrompt() { this.promptText = ''; this.el.prompt.classList.add('hidden'); },
  hitMarker() {
    this.el.hitmarker.classList.remove('hidden');
    setTimeout(() => this.el.hitmarker.classList.add('hidden'), 120);
  },
  flashDamage() {
    this.el['damage-flash'].classList.remove('hidden');
    setTimeout(() => this.el['damage-flash'].classList.add('hidden'), 180);
  },

  // ---- Map screen --------------------------------------------------------
  toggleMap() {
    this.mapOpen = !this.mapOpen;
    this.el['map-screen'].classList.toggle('hidden', !this.mapOpen);
    if (this.mapOpen) {
      G.state = 'map';
      this.buildJobList();
      this.drawMap(this.el.bigmap, true);
      const gps = Missions.gps();
      this.el['map-gps'].textContent = gps ? 'GPS: ' + gps.label + ' — ' + Math.round(dist2d(G.player.x, G.player.z, gps.x, gps.z)) + ' m' : 'GPS: no active objective';
    } else if (G.state === 'map') G.state = 'play';
  },
  buildJobList() {
    this.el['job-list'].innerHTML = MISSIONS.map(m => {
      const st = Missions.done[m.id] ? 'DONE ✓' : (Missions.active && Missions.active.id === m.id) ? 'ACTIVE' : (m.id === 1 || Missions.done[m.id - 1]) ? 'AVAILABLE' : 'LOCKED';
      return '<div class="job ' + st.split(' ')[0].toLowerCase() + '"><span class="j-ch">' + m.chapter + '</span>' +
        '<span class="j-title">' + m.title + '</span><span class="j-pay">' + fmtCash(m.payout) + '</span>' +
        '<span class="j-st">' + st + '</span></div>';
    }).join('') +
    '<div class="job-note">Click a job to start it · Sun coins ' + G.stats.coins + '/' + SUN_COINS + ' · Taxi fares pay ' + fmtCash(FARE_PAY) + '</div>';
    this.el['job-list'].querySelectorAll('.job').forEach((row, i) => {
      row.onclick = () => {
        if (Missions.start(MISSIONS[i].id)) { this.toggleMap(); }
        else showToast('Finish the previous job first');
      };
    });
  },

  // ---- Shop ---------------------------------------------------------------
  openShop(kind) {
    this.shopOpen = true;
    G.state = 'shop';
    this.el['shop-title'].textContent = kind === 'guns' ? 'MERCADO GUN STORE' : 'SHOP';
    const items = [
      { name: 'Body Armor', desc: 'Absorbs damage — fills your armor bar', price: SHOP.armor.price, buy: () => { if (G.cash < SHOP.armor.price) return false; G.cash -= SHOP.armor.price; G.player.armor = 100; return true; } },
      { name: 'Pistol Ammo', desc: 'P9 Pistol — 24 rounds', price: AMMO_PRICE.pistol, buy: () => Combat.buyAmmo('pistol') },
      { name: 'SMG Ammo', desc: 'Wasp SMG — 64 rounds' + (Combat.unlocked(WEAPONS[2]) ? '' : ' (unlock: finish Hot Wheels)'), price: AMMO_PRICE.smg, buy: () => Combat.unlocked(WEAPONS[2]) ? Combat.buyAmmo('smg') : false },
      { name: 'Shotgun Shells', desc: 'Boomstick — 12 shells' + (Combat.unlocked(WEAPONS[3]) ? '' : ' (unlock: finish Night Run)'), price: AMMO_PRICE.shotgun, buy: () => Combat.unlocked(WEAPONS[3]) ? Combat.buyAmmo('shotgun') : false },
    ];
    this.el['shop-items'].innerHTML = items.map((it, i) =>
      '<div class="shop-item"><span class="s-name">' + it.name + '</span><span class="s-desc">' + it.desc + '</span>' +
      '<button class="s-buy" data-i="' + i + '">' + fmtCash(it.price) + '</button></div>').join('') +
      '<button class="s-close" id="shop-close">Close [E]</button>';
    this.el['shop-items'].querySelectorAll('.s-buy').forEach(btn => {
      btn.onclick = () => { if (items[Number(btn.dataset.i)].buy()) { this.refreshAll(); showToast('Purchased'); } else showToast('Cannot buy that'); };
    });
    document.getElementById('shop-close').onclick = () => this.closeShop();
    this.el['shop-screen'].classList.remove('hidden');
  },
  closeShop() {
    this.shopOpen = false;
    this.el['shop-screen'].classList.add('hidden');
    if (G.state === 'shop') G.state = 'play';
  },

  // ---- Pause / busted ------------------------------------------------------
  togglePause() {
    if (G.state === 'title') return;
    this.pauseOpen = !this.pauseOpen;
    this.el['pause-menu'].classList.toggle('hidden', !this.pauseOpen);
    if (this.pauseOpen) G.state = 'pause';
    else if (G.state === 'pause') G.state = 'play';
  },
  showBusted(title, text) {
    this.el['busted-title'].textContent = title;
    this.el['busted-text'].textContent = text;
    this.el['busted-screen'].classList.remove('hidden');
    G.state = 'busted';
  },
};

function showToast(text) { HUD.toast(text); }
