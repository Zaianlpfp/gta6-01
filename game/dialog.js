/* dialog.js — dialog + potret karakter "Solmar Bay" (gta6-01, rebuild r10).
   Kontrak: game/API.md §9. say() INSTAN (tanpa typewriter) di #dlg
   KIRI-BAWAH (wheel kanan-bawah — jangan menimpa). show() = say + pause.
   Jangan tumpuk 2 show() berurutan: show() mengganti isi yang sama. */
(function () {
  var SB = window.SB;
  var S = SB.state || (SB.state = {});

  var D = SB.dialog = SB.dialog || {};

  D.contacts = {
    mara:   { name: 'Mara Solis',    role: 'Fixer',          img: 'assets/mara.jpg' },
    jax:    { name: 'Jax',           role: 'Mechanic',       img: 'assets/jax.jpg' },
    lucia:  { name: 'Lucia Ortega',  role: 'Getaway Driver', img: 'assets/lucia.jpg' }
  };

  /* Satu kalimat per misi, dipakai staging / briefing. */
  D.lines = {
    1: { who: 'mara', text: 'Penumpang sudah menunggu di Deco Row. Antar dia sampai tujuan, jangan bikin ribut.' },
    2: { who: 'mara', text: 'Paket ini harus sampai Marina sebelum malam. Saltjack mengincarnya — hati-hati.' },
    3: { who: 'jax',  text: 'Comet GT itu parkir di Downtown. Bawa ke bengkelku, jangan sampai penyok.' },
    4: { who: 'lucia', text: 'Tiga checkpoint, satu malam. Ikuti jalanku dan jangan sentuh rem di tikungan.' },
    5: { who: 'jax',  text: 'Dua mobil, satu chop shop. Mesin dingin, tangan cepat, mulut diam.' },
    6: { who: 'lucia', text: 'Pelabuhan sudah panas. Kita lewat Marina, lampu mati, gas penuh.' },
    7: { who: 'mara', text: 'Polisi sudah di ekormu. Lepas mereka, lalu sembunyi di safehouse.' },
    8: { who: 'mara', text: 'Solmar National Bank. Ini pekerjaan besar — sekali jalan, tidak ada jalan pulang.' }
  };

  D.last = null;
  D._pausedByDialog = false;

  function el() {
    if (typeof document === 'undefined') return null;
    var d = document.getElementById('dlg');
    if (d) return d;
    d = document.createElement('div');
    d.id = 'dlg';
    d.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:40;' +
      'max-width:420px;display:none;background:rgba(10,12,20,0.82);' +
      'border:1px solid rgba(255,255,255,0.18);border-radius:10px;' +
      'color:#fff;font-family:system-ui,sans-serif;padding:10px 12px;';
    if (document.body) document.body.appendChild(d);
    return d;
  }

  function resolve(who, role, img) {
    var c = D.contacts[who];
    if (c) return { name: c.name, role: role || c.role, img: img || c.img };
    return { name: who || '???', role: role || '', img: img || '' };
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* Tampil INSTAN (tanpa typewriter). Tidak mengubah pause. */
  D.say = function (who, role, text, img) {
    var c = resolve(who, role, img);
    D.last = { who: c.name, role: c.role, text: text };
    var box = el();
    if (box) {
      var pic = c.img ? '<img src="' + esc(c.img) + '" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:8px;float:left;margin-right:10px;">' : '';
      box.innerHTML = pic +
        '<div><b>' + esc(c.name) + '</b>' +
        (c.role ? ' <span style="opacity:0.7;font-size:12px;">· ' + esc(c.role) + '</span>' : '') +
        '<div style="margin-top:4px;font-size:14px;line-height:1.45;">' + esc(text) + '</div></div>' +
        '<div style="clear:both;"></div>';
      box.style.display = 'block';
    }
    return true;
  };

  /* Tampil + pause game. Mengganti dialog yang sedang tampil (tidak menumpuk). */
  D.show = function (who, role, text, img) {
    D.say(who, role, text, img);
    S.paused = true;
    D._pausedByDialog = true;
    return true;
  };

  D.hide = function () {
    var box = el();
    if (box) box.style.display = 'none';
    D.last = null;
    if (D._pausedByDialog) {
      S.paused = false;
      D._pausedByDialog = false;
    }
    return true;
  };

  /* Baris briefing misi (tanpa pause) — dipakai staging / start misi. */
  D.brief = function (id) {
    var line = D.lines[id];
    if (!line) return false;
    return D.say(line.who, null, line.text);
  };

  D.sayMission = D.brief;
})();
