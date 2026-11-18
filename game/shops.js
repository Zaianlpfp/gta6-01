(function () {
  'use strict';
  var SB = window.SB = window.SB || {};
  var S = SB.state;
  var ITEMS = {
    weapons: [
      { id: 'ammo-pistol', name: 'Pistol Ammo ×12', price: 100, desc: '12 rounds · 9mm' },
      { id: 'ammo-smg', name: 'SMG Ammo ×32', price: 200, desc: '32 rounds · 9mm' },
      { id: 'ammo-shotgun', name: 'Shotgun Shells ×6', price: 150, desc: '6 shells · 12ga' },
      { id: 'rifle-unlock', name: 'RIFLE — unlock', price: 1500, desc: 'Unlocks the rifle + 30 rounds' }
    ],
    armor: [
      { id: 'armor-vest', name: 'Kevlar Vest +50', price: 250, desc: 'Light body armor' },
      { id: 'armor-full', name: 'Full Armor +100', price: 400, desc: 'Heavy plating, max protection' }
    ],
    food: [
      { id: 'food-snack', name: 'Street Snack +10 HP', price: 10, desc: 'Arepa from the market stall' },
      { id: 'food-meal', name: 'Marina Meal +25 HP', price: 25, desc: 'Full plate at Tideline Cafe' }
    ]
  };
  var panel = null, curKind = 'weapons';
  var RESPRAY_COLORS = [0xff2a7a, 0x00e5ff, 0xffd23f, 0x39d353, 0xff5a1f, 0x8a5cff];
  function toast(m) { if (SB.hud && SB.hud.toast) SB.hud.toast(m); }
  function money(n) { return '$' + n.toLocaleString('en-US'); }
  function apply(item) {
    if (item.id === 'rifle-unlock') {
      if (!S.weapons.rifle.locked) return 'Rifle already owned';
      S.weapons.rifle.locked = false; S.weapons.rifle.ammo = 30; S.weapons.rifle.reserve = 90;
      return 'RIFLE unlocked — 30/90 rounds';
    }
    if (item.id === 'ammo-pistol') { S.weapons.pistol.reserve += 12; return 'Pistol ammo +12'; }
    if (item.id === 'ammo-smg') { S.weapons.smg.reserve += 32; return 'SMG ammo +32'; }
    if (item.id === 'ammo-shotgun') { S.weapons.shotgun.reserve += 6; return 'Shotgun shells +6'; }
    if (item.id === 'armor-vest') { SB.setArmor(Math.min(100, S.armor + 50)); return 'Armor +50'; }
    if (item.id === 'armor-full') { SB.setArmor(100); return 'Armor full'; }
    if (item.id === 'food-snack') { SB.setHealth(Math.min(100, S.health + 10)); return 'Health +10'; }
    if (item.id === 'food-meal') { SB.setHealth(Math.min(100, S.health + 25)); return 'Health +25'; }
    return 'Bought ' + item.name;
  }
  function shopName() {
    var shops = (SB.world.spawns && SB.world.spawns.shops) || [];
    var p = SB.world.player;
    if (!p || !p.pos || !shops.length) return 'SOLMAR SHOP';
    var best = shops[0], bd = 1e18;
    for (var i = 0; i < shops.length; i++) {
      var d = (shops[i].x - p.pos.x) * (shops[i].x - p.pos.x) + (shops[i].z - p.pos.z) * (shops[i].z - p.pos.z);
      if (d < bd) { bd = d; best = shops[i]; }
    }
    return best.name;
  }
  function buildPanel() {
    panel = document.createElement('div');
    panel.id = 'sb-shop';
    panel.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:380px;max-width:92vw;background:rgba(8,10,18,.94);border:2px solid #ff2a7a;border-radius:10px;color:#fff;font-family:Arial,sans-serif;padding:16px;z-index:60;pointer-events:auto;display:none;box-shadow:0 8px 40px rgba(0,0,0,.6)';
    document.body.appendChild(panel);
  }
  function renderPanel() {
    var cats = curKind === 'all' ? ['weapons', 'armor', 'food'] : [curKind];
    var h = '<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:17px;letter-spacing:1px">' + shopName() + '</b><button id="sb-shop-x" style="background:#ff2a7a;color:#fff;border:0;border-radius:4px;padding:4px 10px;cursor:pointer">✕</button></div>';
    h += '<div style="color:#ffd23f;font-size:13px;margin:4px 0 10px">CASH ' + money(S.cash) + ' &nbsp;·&nbsp; <span style="color:#8affc1;cursor:pointer" data-cat="weapons">WEAPONS</span> · <span style="color:#8affc1;cursor:pointer" data-cat="armor">ARMOR</span> · <span style="color:#8affc1;cursor:pointer" data-cat="food">FOOD</span></div>';
    for (var c = 0; c < cats.length; c++) {
      var list = ITEMS[cats[c]];
      h += '<div style="color:#9fb4d8;font-size:11px;letter-spacing:2px;margin:8px 0 4px">' + cats[c].toUpperCase() + '</div>';
      for (var i = 0; i < list.length; i++) {
        var it = list[i];
        var owned = it.id === 'rifle-unlock' && !S.weapons.rifle.locked;
        h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-top:1px solid #223"><span><b>' + it.name + '</b><br><span style="color:#9fb4d8;font-size:12px">' + it.desc + '</span></span><button data-buy="' + it.id + '" ' + (owned || S.cash < it.price ? 'disabled' : '') + ' style="background:' + (owned ? '#334' : '#ff2a7a') + ';color:#fff;border:0;border-radius:5px;padding:6px 10px;cursor:pointer;white-space:nowrap">' + (owned ? 'OWNED' : money(it.price)) + '</button></div>';
      }
    }
    h += '<div style="color:#9fb4d8;font-size:12px;margin-top:10px">Respray $200 — new paint + lose 1 ★ · Safehouse saves your game.</div>';
    panel.innerHTML = h;
    panel.querySelector('#sb-shop-x').onclick = function () { SB.shops.close(); };
    var tabs = panel.querySelectorAll('[data-cat]');
    for (var t = 0; t < tabs.length; t++) tabs[t].onclick = function () { SB.shops.open(this.getAttribute('data-cat')); };
    var btns = panel.querySelectorAll('[data-buy]');
    for (var b = 0; b < btns.length; b++) btns[b].onclick = function () { SB.shops.buy(this.getAttribute('data-buy')); };
  }
  SB.shops = {
    ITEMS: ITEMS,
    open: function (kind) {
      curKind = ITEMS[kind] ? kind : 'all';
      if (!panel) buildPanel();
      renderPanel();
      panel.style.display = 'block';
      if (SB.setPaused) SB.setPaused(true);
    },
    close: function () {
      if (panel) panel.style.display = 'none';
      if (SB.setPaused) SB.setPaused(false);
    },
    isOpen: function () { return !!panel && panel.style.display !== 'none'; },
    buy: function (itemId) {
      var item = null;
      var keys = Object.keys(ITEMS);
      for (var k = 0; k < keys.length && !item; k++) for (var i = 0; i < ITEMS[keys[k]].length; i++) if (ITEMS[keys[k]][i].id === itemId) item = ITEMS[keys[k]][i];
      if (!item) return false;
      if (item.id === 'rifle-unlock' && !S.weapons.rifle.locked) { toast('Rifle already owned'); return false; }
      if (S.cash < item.price) { toast('Not enough cash — need ' + money(item.price)); return false; }
      SB.addCash(-item.price);
      var msg = apply(item);
      toast('✓ ' + msg + ' · −' + money(item.price));
      if (SB.audio && SB.audio.pickup) SB.audio.pickup();
      if (panel && panel.style.display !== 'none') renderPanel();
      return true;
    },
    respray: function (color) {
      if (!S.vehicle) { toast('No vehicle to respray'); return false; }
      if (S.cash < 200) { toast('Respray costs $200'); return false; }
      SB.addCash(-200);
      var hex = color !== undefined ? color : RESPRAY_COLORS[SB.randInt(0, RESPRAY_COLORS.length - 1)];
      var p = SB.world.player;
      if (p && p.vehicle && p.vehicle.group) p.vehicle.group.traverse(function (o) { if (o.material && o.material.color && o.geometry && o.geometry.type === 'BoxGeometry') o.material.color.setHex(hex); });
      if (S.wanted > 0) SB.setWanted(S.wanted - 1);
      if (S.vehicle) S.vehicle.condition = 100;
      toast('Respray done — fresh paint, −1 ★ wanted, condition 100%');
      return true;
    },
    safehouse: function () {
      SB.setHealth(100);
      var ok = SB.save ? SB.save.save(0) : false;
      if (SB.addRep) SB.addRep(5);
      toast(ok ? 'Saved at Mara\'s Safehouse — health restored, outfit changed' : 'Safehouse rest — health restored (save failed)');
      return ok;
    }
  };
})();
