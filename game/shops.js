// shops.js — toko / safehouse / respray Solmar Bay. B4 r10, tulis segar dari tree r9.
// Potong SB.player.cash; respray $200 hapus 1 bintang; safehouse = save.
(function () {
  'use strict';
  var SB = window.SB;
  var ov = null, listEl = null, curKind = 'weapons', openFlag = false;
  function weapons() {
    if (!SB.state.weapons) SB.state.weapons = {
      fists: { ammo: Infinity }, pistol: { ammo: 12, reserve: 48 },
      smg: { ammo: 32, reserve: 128 }, shotgun: { ammo: 6, reserve: 18 },
      rifle: { ammo: 0, reserve: 0, locked: true }
    };
    return SB.state.weapons;
  }
  function setHealth(v) { if (typeof SB.setHealth === 'function') SB.setHealth(v); else SB.state.health = v; }
  function setArmor(v) { if (typeof SB.setArmor === 'function') SB.setArmor(v); else SB.state.armor = v; }
  var CATALOG = {
    weapons: [
      { id: 'pistol-ammo', name: 'Pistol ammo ×24', price: 80, apply: function () { weapons().pistol.reserve += 24; } },
      { id: 'smg-ammo', name: 'SMG ammo ×64', price: 120, apply: function () { weapons().smg.reserve += 64; } },
      { id: 'shotgun-ammo', name: 'Shotgun shells ×12', price: 100, apply: function () { weapons().shotgun.reserve += 12; } },
      { id: 'rifle', name: 'Unlock RIFLE', price: 1500, apply: function () { var w = weapons().rifle; w.locked = false; w.ammo = 30; w.reserve = 90; } }
    ],
    armor: [
      { id: 'armor-50', name: 'Armor vest +50', price: 150, apply: function () { setArmor(Math.min(100, (SB.state.armor || 0) + 50)); } },
      { id: 'armor-full', name: 'Full armor 100', price: 250, apply: function () { setArmor(100); } }
    ],
    food: [
      { id: 'snack', name: 'Mercado snack +25 HP', price: 25, apply: function () { setHealth(Math.min(100, (SB.state.health == null ? 100 : SB.state.health) + 25)); } },
      { id: 'meal', name: 'Cafe meal — full HP', price: 60, apply: function () { setHealth(100); } }
    ]
  };
  function cash() { if (SB.player && typeof SB.player.cash === 'number') return SB.player.cash; return SB.state.cash || 0; }
  function pay(n) {
    if (SB.player && typeof SB.player.cash === 'number') SB.player.cash -= n;
    if (typeof SB.state.cash === 'number') SB.state.cash = Math.max(0, SB.state.cash - n);
  }
  function build() {
    if (ov) return;
    ov = document.createElement('div');
    ov.id = 'shopov'; ov.style.display = 'none';
    var h = document.createElement('div'); h.id = 'shop-head'; h.textContent = 'SHOP';
    ov.appendChild(h);
    var tabs = document.createElement('div'); tabs.id = 'shop-tabs';
    ['weapons', 'armor', 'food'].forEach(function (k) {
      var b = document.createElement('button');
      b.textContent = k.toUpperCase(); b.dataset.kind = k;
      b.addEventListener('click', function () { open(k); });
      tabs.appendChild(b);
    });
    var rp = document.createElement('button'); rp.textContent = 'RESPRAY $200 (−1★)';
    rp.addEventListener('click', function () { respray(); }); tabs.appendChild(rp);
    var sh = document.createElement('button'); sh.textContent = 'SAFEHOUSE (SAVE)';
    sh.addEventListener('click', function () { safehouse(); }); tabs.appendChild(sh);
    ov.appendChild(tabs);
    listEl = document.createElement('div'); listEl.id = 'shop-list';
    ov.appendChild(listEl);
    var cl = document.createElement('button'); cl.id = 'shop-close'; cl.textContent = 'CLOSE [Esc]';
    cl.addEventListener('click', close); ov.appendChild(cl);
    document.body.appendChild(ov);
  }
  function open(kind) {
    build();
    curKind = CATALOG[kind] ? kind : 'weapons';
    openFlag = true; ov.style.display = '';
    var items = CATALOG[curKind], html = '';
    items.forEach(function (it) {
      var owned = it.id === 'rifle' && SB.state.weapons && SB.state.weapons.rifle && !SB.state.weapons.rifle.locked;
      html += '<div class="shop-item"><span>' + it.name + '</span> <span>$' + it.price + '</span> ' +
        '<button data-item="' + it.id + '"' + (owned ? ' disabled' : '') + '>' + (owned ? 'OWNED' : 'BUY') + '</button></div>';
    });
    html += '<div class="shop-cash">Cash: $' + cash().toLocaleString('en-US') + '</div>';
    listEl.innerHTML = html;
    var btns = listEl.querySelectorAll ? listEl.querySelectorAll('[data-item]') : [];
    for (var i = 0; i < btns.length; i++) btns[i].addEventListener('click', function (ev) { buy(ev.target.dataset.item); });
    if (SB.hud) SB.hud.toast('SHOP — ' + curKind.toUpperCase());
  }
  function buy(itemId) {
    var items = CATALOG[curKind] || [], it = null;
    for (var i = 0; i < items.length; i++) if (items[i].id === itemId) it = items[i];
    if (!it) return false;
    if (cash() < it.price) { if (SB.hud) SB.hud.toast('Not enough cash — need $' + it.price); return false; }
    pay(it.price);
    try { it.apply(); } catch (e) {}
    if (SB.audio) SB.audio.pickup();
    if (SB.hud) SB.hud.toast('Bought: ' + it.name + ' (−$' + it.price + ')');
    open(curKind);
    return true;
  }
  function starsNow() {
    if (SB.police && typeof SB.police.stars === 'function') { try { return SB.police.stars(); } catch (e) {} }
    return SB.state.heat || 0;
  }
  function respray(color) {
    if (cash() < 200) { if (SB.hud) SB.hud.toast('Respray needs $200'); return false; }
    pay(200);
    var n = Math.max(0, starsNow() - 1);
    if (SB.police && typeof SB.police.setStars === 'function') SB.police.setStars(n);
    else if (typeof SB.setWanted === 'function') SB.setWanted(n);
    else SB.state.heat = n;
    if (SB.hud) SB.hud.toast('Respray done — wanted −1★ (' + (color || 'neon pink') + ')');
    return true;
  }
  function safehouse() {
    if (SB.save) SB.save.save(0);
    setHealth(100);
    if (SB.hud) SB.hud.toast('Safehouse — game saved, HP restored');
    return true;
  }
  function close() { openFlag = false; if (ov) ov.style.display = 'none'; }
  SB.shops = { open: open, buy: buy, respray: respray, safehouse: safehouse, close: close, isOpen: function () { return openFlag; }, CATALOG: CATALOG };
})();
