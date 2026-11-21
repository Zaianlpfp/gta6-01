// game/dialog.js — SB.dialog: dialog + potret (r13, ditulis fresh dari API.md §9).
// Tampil INSTAN (tanpa typewriter): teks ditulis ke DOM dalam satu operasi.
// #dlg di KIRI-BAWAH; wheel kanan-bawah — jangan menimpa.
(function () {
  'use strict';

  var SB = window.SB || (window.SB = {});

  var PORTRAITS = {
    mara: 'game/assets/mara.jpg',
    'mara solis': 'game/assets/mara.jpg',
    jax: 'game/assets/jax.jpg',
    lucia: 'game/assets/lucia.jpg',
    'lucia ortega': 'game/assets/lucia.jpg'
  };

  var dlgEl = null;
  var showing = false;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pickPortrait(who, img) {
    if (img) return img;
    var key = String(who || '').toLowerCase();
    if (PORTRAITS[key]) return PORTRAITS[key];
    if (key.indexOf('mara') !== -1) return PORTRAITS.mara;
    if (key.indexOf('jax') !== -1) return PORTRAITS.jax;
    if (key.indexOf('lucia') !== -1) return PORTRAITS.lucia;
    return '';
  }

  // Pakai #dlg yang sudah ada (dibuat hud/index) bila ada; kalau belum ada,
  // buat sendiri dengan gaya inline kiri-bawah.
  function ensureDlg() {
    if (typeof document === 'undefined') return null;
    var el = document.getElementById('dlg');
    if (el) { dlgEl = el; return el; }
    if (dlgEl) return dlgEl;
    dlgEl = document.createElement('div');
    dlgEl.id = 'dlg';
    dlgEl.style.position = 'fixed';
    dlgEl.style.left = '12px';
    dlgEl.style.bottom = '12px';
    dlgEl.style.zIndex = '60';
    dlgEl.style.display = 'none';
    dlgEl.style.maxWidth = '420px';
    dlgEl.style.background = 'rgba(10,12,20,0.88)';
    dlgEl.style.border = '1px solid rgba(255,255,255,0.25)';
    dlgEl.style.borderRadius = '10px';
    dlgEl.style.padding = '10px 12px';
    dlgEl.style.color = '#ffffff';
    dlgEl.style.fontFamily = 'system-ui, sans-serif';
    dlgEl.style.fontSize = '14px';
    dlgEl.style.lineHeight = '1.45';
    if (document.body) document.body.appendChild(dlgEl);
    return dlgEl;
  }

  var D = SB.dialog || (SB.dialog = {});

  // Tampil INSTAN di #dlg kiri-bawah. Dipakai staging.
  // Satu penugasan innerHTML: seluruh teks langsung ada, tanpa typewriter.
  D.say = function (who, role, text, img) {
    var el = ensureDlg();
    if (!el) return false;
    var src = pickPortrait(who, img);
    var html = '';
    if (src) {
      html += '<img src="' + esc(src) + '" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:8px;float:left;margin-right:10px;">';
    }
    html += '<div><strong>' + esc(who) + '</strong>';
    if (role) html += ' <span style="opacity:0.7">· ' + esc(role) + '</span>';
    html += '<div>' + esc(text) + '</div></div>';
    el.innerHTML = html;
    el.style.display = 'block';
    showing = true;
    return true;
  };

  // Tampil + set SB.state.paused = true.
  // JANGAN tumpuk 2 show() berurutan: say() menimpa isi, bukan menumpuk.
  D.show = function (who, role, text, img) {
    D.say(who, role, text, img);
    if (SB.state) SB.state.paused = true;
    return true;
  };

  // Sembunyikan dialog + lanjutkan game.
  D.hide = function () {
    var el = ensureDlg();
    if (el) el.style.display = 'none';
    showing = false;
    if (SB.state) SB.state.paused = false;
    return true;
  };

  D.isShowing = function () { return showing; };

})();
