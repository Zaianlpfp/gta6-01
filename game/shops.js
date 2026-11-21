// Solmar Bay — gta6-01 rebuild r13. Shops (fresh).
// Buy gear, respray away a wanted star, or save at the safehouse. Every
// purchase cuts SB.player.cash (API.md §0) and refuses when the player is
// broke. The shop panel is built here, self-contained, so it works even
// before the HUD module finishes its own panels.
(function () {
  'use strict';

  var SB = window.SB || (window.SB = {});

  var ITEMS = [
    { kind: 'health', name: 'First Aid Kit', price: 100, desc: 'Restore health to full' },
    { kind: 'armor', name: 'Body Armor', price: 200, desc: 'Add 50 armor' },
    { kind: 'ammo', name: 'Ammo Box', price: 150, desc: 'Refill ammo for all guns' },
    { kind: 'smg', name: 'SMG', price: 800, desc: 'Unlock weapon 3 (SMG)' },
    { kind: 'shotgun', name: 'Shotgun', price: 1200, desc: 'Unlock weapon 4 (Shotgun)' },
  ];

  var RESPRAY_PRICE = 300;
  var panel = null;
  var openFlag = false;

  function cash() {
    return SB.player ? SB.player.cash : 0;
  }

  function spend(amount) {
    if (!SB.player || SB.player.cash < amount) return false;
    SB.player.cash -= amount;
    if (SB.hud && typeof SB.hud.update === 'function') SB.hud.update();
    return true;
  }

  function buildPanel() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'shop-panel';
    panel.style.cssText = [
      'position:fixed', 'left:50%', 'top:50%', 'transform:translate(-50%,-50%)',
      'width:340px', 'background:rgba(10,14,24,0.96)', 'color:#f5f0e6',
      'border:2px solid #ffb347', 'border-radius:12px', 'padding:16px',
      'font-family:system-ui,sans-serif', 'z-index:60', 'display:none',
      'box-shadow:0 12px 40px rgba(0,0,0,0.6)',
    ].join(';');
    var title = document.createElement('div');
    title.textContent = 'SOLMAR PAWN & GUN';
    title.style.cssText = 'font-size:18px;font-weight:800;letter-spacing:1px;margin-bottom:4px';
    panel.appendChild(title);
    var sub = document.createElement('div');
    sub.id = 'shop-cash';
    sub.style.cssText = 'font-size:13px;opacity:0.85;margin-bottom:10px';
    panel.appendChild(sub);
    var list = document.createElement('div');
    list.id = 'shop-list';
    panel.appendChild(list);
    var close = document.createElement('button');
    close.textContent = 'Close (Esc)';
    close.style.cssText = [
      'margin-top:12px', 'width:100%', 'padding:8px', 'background:#ffb347',
      'border:0', 'border-radius:8px', 'font-weight:700', 'cursor:pointer',
    ].join(';');
    close.addEventListener('click', function () {
      shops.close();
    });
    panel.appendChild(close);
    document.body.appendChild(panel);
    return panel;
  }

  function refreshPanel() {
    var el = buildPanel();
    var cashEl = el.querySelector('#shop-cash');
    if (cashEl) cashEl.textContent = 'Cash: $' + cash();
    var list = el.querySelector('#shop-list');
    if (!list) return;
    list.innerHTML = '';
    for (var i = 0; i < ITEMS.length; i++) {
      (function (item) {
        var row = document.createElement('button');
        row.textContent = item.name + ' — $' + item.price + ' · ' + item.desc;
        row.style.cssText = [
          'display:block', 'width:100%', 'text-align:left', 'margin:4px 0',
          'padding:8px', 'background:rgba(255,255,255,0.08)', 'color:#f5f0e6',
          'border:1px solid rgba(255,255,255,0.2)', 'border-radius:8px',
          'cursor:pointer', 'font-size:13px',
        ].join(';');
        row.addEventListener('click', function () {
          shops.buy(item.kind);
          refreshPanel();
        });
        list.appendChild(row);
      })(ITEMS[i]);
    }
    var spray = document.createElement('button');
    spray.textContent = 'Respray Car — $' + RESPRAY_PRICE + ' · remove 1 wanted star';
    spray.style.cssText = [
      'display:block', 'width:100%', 'text-align:left', 'margin:4px 0',
      'padding:8px', 'background:rgba(120,200,255,0.12)', 'color:#f5f0e6',
      'border:1px solid rgba(120,200,255,0.35)', 'border-radius:8px',
      'cursor:pointer', 'font-size:13px',
    ].join(';');
    spray.addEventListener('click', function () {
      shops.respray();
      refreshPanel();
    });
    list.appendChild(spray);
  }

  var shops = {
    items: ITEMS,
    resprayPrice: RESPRAY_PRICE,

    buy: function (kind) {
      var item = null;
      for (var i = 0; i < ITEMS.length; i++) {
        if (ITEMS[i].kind === kind) item = ITEMS[i];
      }
      if (!item) return { ok: false, reason: 'unknown item' };
      if (!spend(item.price)) return { ok: false, reason: 'not enough cash' };
      if (kind === 'health' && SB.player) SB.player.health = 100;
      if (kind === 'armor' && SB.player) SB.player.armor = Math.min(100, (SB.player.armor || 0) + 50);
      if (kind === 'smg' && SB.player) SB.player.unlockedSmg = true;
      if (kind === 'shotgun' && SB.player) SB.player.unlockedShotgun = true;
      if (kind === 'ammo' && SB.player) SB.player.ammo = 999;
      if (SB.audio) SB.audio.blip(880);
      return { ok: true, item: kind };
    },

    respray: function () {
      if (!SB.police) return { ok: false, reason: 'no police' };
      var stars = SB.police.stars();
      if (stars <= 0) return { ok: false, reason: 'no wanted stars' };
      if (!spend(RESPRAY_PRICE)) return { ok: false, reason: 'not enough cash' };
      SB.police.setStars(stars - 1);
      if (SB.audio) SB.audio.blip(520);
      return { ok: true, stars: stars - 1 };
    },

    // Safehouse: saving the game is the safehouse action.
    safehouse: function () {
      if (SB.save) return SB.save.save();
      return false;
    },

    open: function () {
      openFlag = true;
      refreshPanel();
      panel.style.display = 'block';
      if (SB.audio) SB.audio.blip(660);
    },

    close: function () {
      openFlag = false;
      if (panel) panel.style.display = 'none';
    },

    isOpen: function () {
      return openFlag;
    },
  };

  SB.shops = shops;
})();
