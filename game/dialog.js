// dialog.js — Solmar Bay: dialog instan + portrait (B3, r14, fresh dari API.md §11)
// Aturan keras: TIDAK ADA acak bawaan / jam wall-clock. Semua acak lewat SB.rng().
// Dialog MUNCUL INSTAN (seluruh teks sekaligus) — JANGAN efek ketik-per-huruf.
// Portrait: assets/jax.jpg + assets/lucia.jpg (diregenerasi di sesi terekam);
// Mara pakai inisial (tidak ada file Mara — JANGAN referensi file yang tak ada).

(function () {
  var SB = window.SB;

  // Portrait per karakter (ketiganya diregenerasi image model di sesi r14 ini).
  var PORTRAITS = {
    mara: 'assets/mara.jpg',
    jax: 'assets/jax.jpg',
    lucia: 'assets/lucia.jpg',
  };

  var NAMES = {
    mara: 'Mara',
    jax: 'Jax',
    lucia: 'Lucia',
  };

  // Kalimat per karakter (ORIGINAL, Bahasa Indonesia, gaya kru Solmar Bay).
  var LINES = {
    mara: [
      'Dengar. Di Solmar Bay, yang cepat bukan yang menang — yang rapi yang pulang bawa uang.',
      'Aku yang nyetir, kamu yang eksekusi. Jangan bikin keributan yang nggak perlu.',
      'Satu aturan: jangan pernah ninggalin kru. Sekali ninggalin, kamu jalan sendiri selamanya.',
      'Kota ini milik yang berani. Kita bukan penjahat — kita pengusaha yang nggak sabaran.',
      'Kalau polisi nempel, jangan panik. Belok, hilang, lalu ketemu lagi di titik kumpul.',
    ],
    jax: [
      'Pintu, brankas, pagar — semua bisa dibuka. Yang penting timing.',
      'Aku nggak suka rencana panjang. Kasih aku target, sisanya urusanku.',
      'Otot boleh besar, tapi otak tetap yang nyetir. Ingat itu.',
      'Kalau ada yang halangin jalan, pindahin. Kalau nggak bisa dipindahin, lewatin dari atas.',
      'Tenang. Selama aku di sampingmu, nggak ada yang berani nyentuh kru kita.',
    ],
    lucia: [
      'Kamera, alarm, kunci elektronik — semua itu cuma teka-teki yang belum dijawab.',
      'Aku sudah di dalam sistem mereka sebelum mereka sadar pintunya kebuka.',
      'Dua puluh detik. Itu jendela kita. Lebih dari itu, kita jadi berita.',
      'Jangan khawatir soal jejak digital. Aku yang bersihin — kamu yang jalan.',
      'Sinyal polisi sudah kupantau. Kalau aku bilang kabur, kabur. Tanpa debat.',
    ],
  };

  // Briefing 1 baris saat misi mulai (pembicara per misi).
  var BRIEFING = {
    1: { speaker: 'mara', text: 'Penumpang pertama nunggu di Deco Row. Antar dia ke Marina Bay, jangan telat.' },
    2: { speaker: 'mara', text: 'Flamingo GT itu parkir di Downtown. Ambil, bawa ke safehouse. Pelan-pelan.' },
    3: { speaker: 'lucia', text: 'Paketnya di Bar Neon. Antar ke Coral Court, lalu hilang dari radar polisi.' },
    4: { speaker: 'lucia', text: 'Jemput aku di Palma Beach, terus kabur ke Old Harbor. Jangan berhenti.' },
    5: { speaker: 'mara', text: 'Foto kapalnya di marina, ambil dokumen di Civic Center, serahin ke aku.' },
    6: { speaker: 'jax', text: 'Ketemu aku di Villa Verde. Uangnya di Solmar Heights — ambil, jangan dilihat-lihat.' },
    7: { speaker: 'jax', text: 'Toko emas Coral Court. Rampok, kabur ke Deco Row, lalu bikin polisi kehilangan jejak.' },
    8: { speaker: 'mara', text: 'Ini dia. Kumpul di bank, bobol brankasnya, kabur ke marina, serahin tasnya ke aku.' },
  };

  var STAGE_DONE = {
    mara: 'Bagus. Lanjut ke langkah berikut — jangan kasih mereka waktu napas.',
    jax: 'Satu langkah beres. Terus jalan, jangan nengok belakang.',
    lucia: 'Langkah selesai. Jalur aman untuk sekarang — lanjut.',
  };

  var MISSION_DONE = {
    1: { speaker: 'mara', text: 'Penumpang sampai, bayaran masuk. Kerja bagus untuk pemula.' },
    2: { speaker: 'mara', text: 'Mobil aman di safehouse. Kamu mulai bisa diandalkan.' },
    3: { speaker: 'lucia', text: 'Paket sampai, jejak bersih. Polisi bahkan nggak tahu kita ada.' },
    4: { speaker: 'lucia', text: 'Kita lolos. Old Harbor aman — untuk malam ini.' },
    5: { speaker: 'mara', text: 'Dokumen di tangan. Kru ini makin berharga.' },
    6: { speaker: 'jax', text: 'Uang sudah di tangan. Jangan dihitung di jalan — hitung di safehouse.' },
    7: { speaker: 'jax', text: 'Emasnya berat, jejaknya hilang. Kerja bersih.' },
    8: { speaker: 'mara', text: 'The Big Score selesai. Solmar Bay sekarang tahu nama kita.' },
  };

  function pickLine(speaker) {
    var arr = LINES[speaker] || LINES.mara;
    // Acak DETERMINISTIK lewat SB.rng() (seed tetap).
    var idx = Math.floor(SB.rng() * arr.length);
    return arr[idx];
  }

  function render() {
    var cur = SB.dialog.current;
    var el = null;
    if (typeof document !== 'undefined') {
      el = document.getElementById('hud-dialog');
    }
    if (!el || !cur) return;
    var name = NAMES[cur.speaker] || cur.speaker;
    var html = '';
    if (cur.portrait) {
      html += '<img class="dlg-portrait" src="' + cur.portrait + '" alt="' + name + '">';
    } else {
      html += '<div class="dlg-portrait dlg-initial">' + name.charAt(0) + '</div>';
    }
    html += '<div class="dlg-body"><div class="dlg-name">' + name + '</div>' +
      '<div class="dlg-text">' + cur.text + '</div></div>';
    el.innerHTML = html;
    el.style.display = 'block';
  }

  SB.dialog = {
    lines: LINES,
    briefingLines: BRIEFING,
    current: null,          // { speaker, text, portrait } | null
    _portraits: PORTRAITS,

    // Tampilkan panel dialog INSTAN (tanpa ketik-per-huruf).
    show: function (speaker, text, portrait) {
      var key = String(speaker || 'mara').toLowerCase();
      if (!NAMES[key]) key = 'mara';
      var p = portrait;
      if (typeof p === 'undefined' || p === null) p = PORTRAITS[key];
      SB.dialog.current = { speaker: key, text: text || '', portrait: p || null };
      render();
      return SB.dialog.current;
    },

    hide: function () {
      SB.dialog.current = null;
      if (typeof document !== 'undefined') {
        var el = document.getElementById('hud-dialog');
        if (el) { el.innerHTML = ''; el.style.display = 'none'; }
      }
    },

    // Ucapkan 1 baris acak (deterministik) dari karakter.
    say: function (speaker) {
      var key = String(speaker || 'mara').toLowerCase();
      if (!NAMES[key]) key = 'mara';
      return SB.dialog.show(key, pickLine(key));
    },

    // Dipanggil missions.start(id): 1 baris briefing.
    briefing: function (missionId) {
      var b = BRIEFING[missionId];
      if (!b) return null;
      return SB.dialog.show(b.speaker, b.text);
    },

    // Dipanggil saat stage selesai / stage baru dimulai.
    stageDone: function (missionId, stageIndex) {
      var m = SB.missions && SB.missions.active;
      var speaker = 'mara';
      if (m) {
        if (m.id === 4 || m.id === 3 || m.id === 5) speaker = 'lucia';
        else if (m.id === 6 || m.id === 7) speaker = 'jax';
      }
      return SB.dialog.show(speaker, STAGE_DONE[speaker]);
    },

    // Dipanggil missions.complete(id).
    missionDone: function (missionId, payout) {
      var d = MISSION_DONE[missionId];
      if (!d) return SB.dialog.show('mara', 'Misi selesai. Bayaran masuk.');
      return SB.dialog.show(d.speaker, d.text);
    },

    // Dipanggil missions.fail(id, reason).
    missionFailed: function (missionId, reason) {
      return SB.dialog.show('mara', 'Gagal: ' + (reason || 'misi gagal') + '. Kita coba lagi — kali ini lebih rapi.');
    },
  };
})();
