// Solmar Bay — shops + garage (B4, v4-rebuild r4). Buy/sell weapons, ammo, armor;
// garage: repair + respray. Money moves through SB.player.cash.
(function () {
  var SB = window.SB = window.SB || {};
  var COLORS = [
    { name: 'PINK', hex: 0xFF2E88 }, { name: 'BLACK', hex: 0x14141C },
    { name: 'WHITE', hex: 0xE8E8E8 }, { name: 'GOLD', hex: 0xF5C542 },
    { name: 'TEAL', hex: 0x14B8A6 }, { name: 'CRIMSON', hex: 0xC81E1E }
  ];
  var colorIdx = 0, open = false, el = null, msg = '';
  var PACK = { PISTOL: 12, SMG: 32, SHOTGUN: 6, RIFLE: 30 };
  var PRICE = { PISTOL: 60, SMG: 120, SHOTGUN: 90, RIFLE: 150 };
  var CSS = '#shopov{position:fixed;inset:0;z-index:70;display:none;background:rgba(4,8,12,.82);color:#f2ede1;font:15px/1.5 system-ui,sans-serif}' +
    '#shopov .box{position:absolute;right:24px;top:24px;width:460px;max-width:calc(100vw - 48px);max-height:calc(100vh - 48px);overflow:auto;background:rgba(10,14,22,.97);border:1px solid rgba(245,197,66,.6);border-radius:12px;padding:16px 18px}' +
    '#shopov button.it{display:block;width:100%;text-align:left;margin:3px 0;padding:7px 10px;background:#182430;color:#f2ede1;border:1px solid #33475a;border-radius:6px;cursor:pointer;font:14px system-ui,sans-serif}' +
    '#shopov button.sl{display:block;width:100%;text-align:left;margin:3px 0;padding:7px 10px;background:#241a12;color:#f2ede1;border:1px solid #5a3d33;border-radius:6px;cursor:pointer;font:14px system-ui,sans-serif}' +
    '#shopov button:disabled{opacity:.45}';

  function cash() { try { return Math.max(SB.cash || 0, (SB.player && SB.player.cash) || 0, (SB.missions && SB.missions.cash) || 0); } catch (e) { return 0; } }
  function pay(n) {
    if (!SB.player || (SB.player.cash || 0) < n) return false;
    try { if (typeof SB.player.addCash === 'function') SB.player.addCash(-n); else SB.player.cash -= n; } catch (e) { SB.player.cash -= n; }
    return true;
  }
  function earn(n) { try { if (SB.player && typeof SB.player.addCash === 'function') SB.player.addCash(n); else if (SB.player) SB.player.cash += n; } catch (e) {} }
  function sfx(ok) { try { if (SB.audio) { if (ok) SB.audio.cash(); else SB.audio.error(); } } catch (e) {} }
  function refreshHud() { try { if (SB.hud) SB.hud.update(); } catch (e) {} }
  function weaponByName(name) {
    try { var ws = SB.player.weapons || []; for (var i = 0; i < ws.length; i++) if (ws[i].name === name) return ws[i]; } catch (e) {}
    return null;
  }
  function cond() { try { return (SB.vehicles && SB.vehicles.hero && SB.vehicles.hero.cond) || 100; } catch (e) { return 100; } }
  function repairPrice() { return Math.round((100 - cond()) * 3); }

  function catalog() {
    var items = [], names = ['PISTOL', 'SMG', 'SHOTGUN', 'RIFLE'], w, i;
    for (i = 0; i < names.length; i++) {
      w = weaponByName(names[i]); if (!w) continue;
      items.push({ id: 'ammo_' + names[i].toLowerCase(), kind: 'ammo', name: names[i] + ' AMMO x' + PACK[names[i]], price: PRICE[names[i]], desc: '+' + PACK[names[i]] + ' reserve', disabled: names[i] === 'RIFLE' && !!w.locked });
    }
    items.push({ id: 'armor50', kind: 'armor', name: 'ARMOR +50', price: 200, desc: 'Body armor 50' });
    items.push({ id: 'armor100', kind: 'armor', name: 'ARMOR +100', price: 350, desc: 'Body armor full' });
    var rifle = weaponByName('RIFLE');
    if (rifle && rifle.locked) items.push({ id: 'rifle', kind: 'weapon', name: 'RIFLE - UNLOCK', price: 1500, desc: 'Unlocks weapon slot 5' });
    items.push({ id: 'repair', kind: 'garage', name: 'REPAIR CAR', price: repairPrice(), desc: 'COND ' + cond() + '% -> 100%' });
    items.push({ id: 'respray', kind: 'garage', name: 'RESPRAY - ' + COLORS[(colorIdx + 1) % COLORS.length].name, price: 100, desc: 'New paint: ' + COLORS[(colorIdx + 1) % COLORS.length].name });
    return items;
  }
  function sellCatalog() {
    var out = [], names = ['PISTOL', 'SMG', 'SHOTGUN', 'RIFLE'], w, i;
    for (i = 0; i < names.length; i++) {
      w = weaponByName(names[i]); if (!w || w.locked) continue;
      if ((w.reserve || 0) >= PACK[names[i]]) out.push({ id: 'sell_ammo_' + names[i].toLowerCase(), kind: 'sellAmmo', name: 'SELL ' + names[i] + ' AMMO x' + PACK[names[i]], price: Math.floor(PRICE[names[i]] / 2), desc: 'Sell ' + PACK[names[i]] + ' reserve rounds' });
    }
    var rifle = weaponByName('RIFLE');
    if (rifle && !rifle.locked && SB.player.weapon !== 5) out.push({ id: 'sell_rifle', kind: 'sellWeapon', name: 'SELL RIFLE', price: 750, desc: 'Sell rifle, locks slot 5 again' });
    return out;
  }

  function applyBuy(it) {
    if (it.kind === 'ammo') {
      var w = weaponByName(it.name.split(' ')[0]); if (!w) return { ok: false, reason: 'no weapon' };
      w.reserve = (w.reserve || 0) + PACK[w.name]; return { ok: true, text: 'BOUGHT ' + it.name };
    }
    if (it.kind === 'armor') {
      var amt = it.id === 'armor100' ? 100 : 50;
      try { if (typeof SB.player.addArmor === 'function') SB.player.addArmor(amt); else SB.player.armor = Math.min(100, (SB.player.armor || 0) + amt); } catch (e) { SB.player.armor = Math.min(100, (SB.player.armor || 0) + amt); }
      return { ok: true, text: 'ARMOR +' + amt };
    }
    if (it.kind === 'weapon') {
      var r = weaponByName('RIFLE'); if (!r) return { ok: false, reason: 'no rifle' };
      r.locked = false; return { ok: true, text: 'RIFLE UNLOCKED - SLOT 5' };
    }
    if (it.id === 'repair') {
      try { if (SB.vehicles && SB.vehicles.hero) SB.vehicles.hero.cond = 100; } catch (e) {}
      return { ok: true, text: 'CAR REPAIRED - COND 100%' };
    }
    if (it.id === 'respray') {
      colorIdx = (colorIdx + 1) % COLORS.length; var c = COLORS[colorIdx];
      try {
        if (SB.vehicles && SB.vehicles.hero) {
          SB.vehicles.hero.color = c.hex;
          var mesh = SB.vehicles.hero.mesh;
          if (mesh) mesh.traverse(function (o) { try { if (o.material && o.material.color && o.material.color.getHex() === 0xFF2E88) o.material.color.setHex(c.hex); } catch (e) {} });
        }
      } catch (e) {}
      return { ok: true, text: 'RESPRAYED ' + c.name };
    }
    return { ok: false, reason: 'unknown item' };
  }
  function applySell(it) {
    if (it.kind === 'sellAmmo') {
      var w = weaponByName(it.name.split(' ')[1]);
      if (!w || (w.reserve || 0) < PACK[w.name]) return { ok: false, reason: 'not enough ammo' };
      w.reserve -= PACK[w.name]; return { ok: true, text: 'SOLD ' + it.name };
    }
    if (it.kind === 'sellWeapon') {
      var r = weaponByName('RIFLE'); if (!r || r.locked) return { ok: false, reason: 'not owned' };
      r.locked = true; return { ok: true, text: 'SOLD RIFLE' };
    }
    return { ok: false, reason: 'unknown item' };
  }

  function buildEl() {
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    el = document.createElement('div'); el.id = 'shopov';
    el.innerHTML = '<div class="box"><div style="display:flex;justify-content:space-between;align-items:baseline;"><b style="letter-spacing:2px;color:#f5c542;">AMMU-NATION &amp; GARAGE</b><button id="shop-close" style="background:none;border:1px solid #888;color:#f2ede1;border-radius:6px;padding:2px 10px;cursor:pointer;">ESC</button></div>' +
      '<div id="shop-cash" style="margin:8px 0 4px;color:#7ee2a0;font-weight:700;"></div><div id="shop-msg" style="min-height:20px;color:#f5c542;font-size:13px;"></div>' +
      '<div style="color:#9fb4c0;font-size:12px;letter-spacing:1px;margin:6px 0 4px;">BUY</div><div id="shop-buy"></div>' +
      '<div style="color:#9fb4c0;font-size:12px;letter-spacing:1px;margin:10px 0 4px;">SELL</div><div id="shop-sell"></div>' +
      '<div style="color:#888;font-size:12px;margin-top:10px;">[F] close &middot; garage: repair + respray</div></div>';
    document.body.appendChild(el);
    el.querySelector('#shop-close').addEventListener('click', function () { SB.shops.close(); });
  }
  function paint() {
    if (!el) return;
    var cashEl = el.querySelector('#shop-cash');
    if (cashEl) cashEl.textContent = 'CASH $' + cash() + '  |  CAR ' + ((SB.vehicles && SB.vehicles.hero && SB.vehicles.hero.name) || 'VENTO STRADA') + ' COND ' + cond() + '%';
    var msgEl = el.querySelector('#shop-msg'); if (msgEl) msgEl.textContent = msg;
    var buyEl = el.querySelector('#shop-buy');
    if (buyEl) {
      buyEl.innerHTML = '';
      catalog().forEach(function (it) {
        var b = document.createElement('button'); b.className = 'it'; b.disabled = !!it.disabled;
        b.textContent = it.name + '  $' + it.price + '  - ' + it.desc;
        if (!it.disabled) b.addEventListener('click', function () { SB.shops.buy(it.id); });
        buyEl.appendChild(b);
      });
    }
    var sellEl = el.querySelector('#shop-sell');
    if (sellEl) {
      sellEl.innerHTML = '';
      var sells = sellCatalog();
      if (!sells.length) sellEl.textContent = 'Nothing to sell.';
      sells.forEach(function (it) {
        var b = document.createElement('button'); b.className = 'sl';
        b.textContent = it.name + '  +$' + it.price + '  - ' + it.desc;
        b.addEventListener('click', function () { SB.shops.sell(it.id); });
        sellEl.appendChild(b);
      });
    }
  }

  SB.shops = {
    version: '4.0.0-r4',
    isOpen: function () { return open; },
    catalog: catalog, sellCatalog: sellCatalog,
    open: function () { if (!el) buildEl(); open = true; el.style.display = 'block'; msg = ''; try { SB.state.paused = true; } catch (e) {} paint(); refreshHud(); return true; },
    close: function () { open = false; if (el) el.style.display = 'none'; try { SB.state.paused = false; } catch (e) {} refreshHud(); return true; },
    toggle: function () { return open ? this.close() : this.open(); },
    buy: function (id) {
      var items = catalog(), it = null, i;
      for (i = 0; i < items.length; i++) if (items[i].id === id) it = items[i];
      if (!it) { msg = 'UNKNOWN ITEM'; sfx(false); paint(); return { ok: false, reason: 'unknown item' }; }
      if (it.disabled) { msg = 'LOCKED - NOT FOR SALE'; sfx(false); paint(); return { ok: false, reason: 'locked' }; }
      if (it.id === 'repair' && cond() >= 100) { msg = 'CAR ALREADY PRISTINE'; sfx(false); paint(); return { ok: false, reason: 'no repair needed' }; }
      if (!pay(it.price)) { msg = 'NOT ENOUGH CASH - NEED $' + it.price; sfx(false); paint(); return { ok: false, reason: 'not enough cash' }; }
      var r = applyBuy(it);
      if (!r.ok) { earn(it.price); msg = r.reason || 'FAILED'; sfx(false); paint(); return r; }
      msg = r.text; sfx(true); paint(); refreshHud(); return { ok: true, item: id, text: r.text };
    },
    sell: function (id) {
      var items = sellCatalog(), it = null, i;
      for (i = 0; i < items.length; i++) if (items[i].id === id) it = items[i];
      if (!it) { msg = 'NOTHING TO SELL'; sfx(false); paint(); return { ok: false, reason: 'unknown item' }; }
      var r = applySell(it);
      if (!r.ok) { msg = r.reason || 'FAILED'; sfx(false); paint(); return r; }
      earn(it.price); msg = r.text + ' +$' + it.price; sfx(true); paint(); refreshHud(); return { ok: true, item: id, text: r.text };
    },
    repair: function () { return this.buy('repair'); },
    respray: function () { return this.buy('respray'); }
  };
})();
