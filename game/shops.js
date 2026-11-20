// shops.js — toko / safehouse / respray Solmar Bay (B4, r5). Key F buka/tutup.
// Potong SB.player.cash. Respray hapus 1 bintang wanted. Safehouse = save point.
(function () {
  var SB = window.SB = window.SB || {};
  var H = SB.shops = SB.shops || {};
  H.items = [
    { id: 'armor', name: 'ARMOR VEST', desc: '+50 armor', price: 200 },
    { id: 'ammo', name: 'SMG AMMO', desc: '+32 reserve SMG', price: 150 },
    { id: 'repair', name: 'REPAIR CAR', desc: 'Kondisi ke 100%', price: 300 },
    { id: 'respray', name: 'RESPRAY', desc: 'Hapus 1 bintang wanted', price: 400 },
    { id: 'rifle', name: 'RIFLE', desc: 'Buka kunci senjata 5', price: 1500 },
    { id: 'sellammo', name: 'SELL SMG AMMO', desc: 'Jual 16 reserve (+$60)', price: -60 },
    { id: 'save', name: 'SAFEHOUSE — SAVE', desc: 'Simpan progres (gratis)', price: 0 }
  ];
  H._open = false; H._el = null; H._msg = '';
  H.isOpen = function () { return H._open; };
  H.balance = function () {
    try { return Math.max(SB.cash || 0, (SB.player && SB.player.cash) || 0, (SB.missions && SB.missions.cash) || 0); }
    catch (e) { return 0; }
  };
  H.canBuy = function (id) {
    for (var i = 0; i < H.items.length; i++) {
      if (H.items[i].id !== id) continue;
      var it = H.items[i];
      if (it.id === 'rifle') {
        var w = SB.player && SB.player.weapons ? SB.player.weapons[4] : null;
        if (w && !w.locked) return false;
      }
      if (it.id === 'sellammo') {
        var s = SB.player && SB.player.weapons ? SB.player.weapons[2] : null;
        if (!s || (s.reserve || 0) < 16) return false;
      }
      if (it.id === 'respray' && (SB.state ? SB.state.heat : 0) <= 0) return false;
      if (it.id === 'repair') {
        var c = (SB.engine && SB.engine.hero && SB.engine.hero.cond);
        if (c === undefined || c >= 100) return false;
      }
      return (SB.player ? SB.player.cash : 0) >= it.price;
    }
    return false;
  };
  H.buy = function (id) {
    var it = null;
    for (var i = 0; i < H.items.length; i++) if (H.items[i].id === id) it = H.items[i];
    if (!it || !SB.player) return false;
    if (!H.canBuy(id)) { H._msg = 'GAGAL — cash kurang / tidak perlu'; H._paint(); try { if (SB.audio) SB.audio.error(); } catch (e) {} return false; }
    try {
      if (id === 'armor') SB.player.armor = Math.min(100, (SB.player.armor || 0) + 50);
      else if (id === 'ammo') { var s = SB.player.weapons[2]; s.reserve = (s.reserve || 0) + 32; }
      else if (id === 'repair') { if (SB.engine && SB.engine.hero) SB.engine.hero.cond = 100; }
      else if (id === 'respray') {
        var h = Math.max(0, (SB.state ? SB.state.heat : 0) - 1);
        if (SB.police && SB.police.setHeat) SB.police.setHeat(h); else if (SB.state) SB.state.heat = h;
      }
      else if (id === 'rifle') { var r = SB.player.weapons[4]; r.locked = false; }
      else if (id === 'sellammo') { SB.player.weapons[2].reserve -= 16; }
      else if (id === 'save') { if (SB.save) SB.save.save(1); }
      if (it.price > 0) SB.player.cash -= it.price;
      if (it.price < 0) SB.player.cash -= it.price;
      H._msg = 'OK — ' + it.name;
      H._paint();
      try { if (SB.audio) SB.audio.cash(); } catch (e) {}
      return true;
    } catch (e) { H._msg = 'GAGAL'; H._paint(); return false; }
  };
  H._style = function () {
    if (document.getElementById('shop-css')) return;
    var st = document.createElement('style'); st.id = 'shop-css';
    st.textContent = '#shop{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:460px;max-width:92vw;background:rgba(8,10,18,.94);border:2px solid #ffb347;border-radius:10px;color:#fff;font:13px/1.45 Arial,sans-serif;padding:14px 16px;z-index:60;display:none;box-shadow:0 8px 40px #000}#shop h2{margin:0 0 2px;color:#ffb347;font-size:17px;letter-spacing:2px}#shop .bal{color:#7dff9a;font-weight:700;margin-bottom:8px}#shop .it{display:flex;justify-content:space-between;align-items:center;padding:7px 8px;border:1px solid #333;border-radius:6px;margin:5px 0;background:rgba(255,255,255,.05)}#shop .it b{color:#fff}#shop .it span{color:#bbb;font-size:12px}#shop button{background:#ffb347;border:0;border-radius:5px;padding:6px 12px;font-weight:700;cursor:pointer}#shop button:disabled{opacity:.35;cursor:default}#shop .msg{color:#7dff9a;min-height:16px;margin-top:6px}#shop .hint{color:#888;font-size:11px}';
    document.head.appendChild(st);
  };
  H._paint = function () {
    if (!H._el) return;
    var bal = H._el.querySelector('.bal'); if (bal) bal.textContent = 'CASH $' + H.balance() + '  ·  [F] tutup  ·  [Esc] tutup';
    var rows = H._el.querySelectorAll('.it');
    for (var i = 0; i < rows.length; i++) {
      var b = rows[i].querySelector('button');
      if (b) b.disabled = !H.canBuy(H.items[i].id);
    }
    var m = H._el.querySelector('.msg'); if (m) m.textContent = H._msg || '';
  };
  H.open = function () {
    H._style();
    if (!H._el) {
      var d = document.createElement('div'); d.id = 'shop';
      var h = '<h2>SOLMAR AUTO &amp; GUN</h2><div class="bal"></div>';
      for (var i = 0; i < H.items.length; i++) {
        var it = H.items[i];
        h += '<div class="it"><div><b>' + it.name + '</b><br><span>' + it.desc + '</span></div><button data-id="' + it.id + '">' + (it.price > 0 ? '$' + it.price : it.price < 0 ? '+$' + (-it.price) : 'FREE') + '</button></div>';
      }
      h += '<div class="msg"></div><div class="hint">Safehouse = save point. Respray hapus 1 bintang wanted.</div>';
      d.innerHTML = h;
      var btns = d.querySelectorAll('button[data-id]');
      for (var j = 0; j < btns.length; j++) {
        btns[j].addEventListener('click', function (ev) { H.buy(ev.target.getAttribute('data-id')); });
      }
      document.body.appendChild(d); H._el = d;
    }
    H._open = true; H._msg = '';
    H._el.style.display = 'block'; H._paint();
    try { if (SB.audio) SB.audio.ui(); } catch (e) {}
    return true;
  };
  H.close = function () {
    H._open = false;
    if (H._el) H._el.style.display = 'none';
    return true;
  };
  H.toggle = function () { return H._open ? H.close() : H.open(); };
  if (!H._bound) {
    H._bound = true;
    try {
      document.addEventListener('keydown', function (e) {
        if (e.repeat || !e.code) return;
        if (e.code === 'KeyF') H.toggle();
      });
    } catch (e) {}
  }
})();
