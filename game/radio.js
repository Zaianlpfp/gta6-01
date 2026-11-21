// radio.js — Solmar Bay (gta6-01 v4 r14)
// 3 stasiun radio. Musik disintesis ringan lewat WebAudio (pola nada tetap per
// stasiun); JANGAN stream radio sungguhan, JANGAN file audio eksternal.
// Ditulis FRESH dari game/API.md §14. Pola nada deterministik (array tetap +
// penghitung langkah); tanpa acak atau jam bawaan JS di file ini.
import { SB } from './engine.js';

// Pola 16 langkah (semitone relatif terhadap root). -1 = diam.
const PATTERNS = {
  pop:   { root: 261.63, bpm: 112, notes: [0, -1, 4, -1, 7, -1, 4, -1, 9, -1, 7, -1, 4, 2, -1, -1] },
  synth: { root: 220.0,  bpm: 96,  notes: [0, 0, -1, 3, -1, 5, -1, 3, 7, -1, 5, -1, 3, -1, 2, -1] },
  talk:  { root: 0,      bpm: 0,   notes: [] },
};

SB.radio = {
  // Daftar stasiun TETAP (API.md §14).
  stations: [
    { name: 'SOLMAR FM', genre: 'pop' },
    { name: 'NEON 88', genre: 'synth' },
    { name: 'PALMA TALK', genre: 'talk' },
  ],
  _timer: null,     // interval scheduler (jam audio saja)
  _step: 0,         // langkah pola saat ini
  _nextTime: 0,     // waktu audio langkah berikutnya

  // Stasiun aktif saat ini.
  current() {
    return SB.radio.stations[SB.state.radio] || SB.radio.stations[0];
  },

  // Ganti ke stasiun berikutnya (tombol R). Update HUD widget bila ada.
  next() {
    SB.state.radio = (SB.state.radio + 1) % SB.radio.stations.length;
    SB.radio._restart();
    if (SB.hud && SB.hud.refreshRadio) SB.hud.refreshRadio();
    if (SB.audio) SB.audio.beep();
    return SB.radio.current();
  },

  // Pilih stasiun berdasarkan indeks (0..2).
  set(i) {
    const n = ((i % 3) + 3) % 3;
    if (n !== SB.state.radio) {
      SB.state.radio = n;
      SB.radio._restart();
      if (SB.hud && SB.hud.refreshRadio) SB.hud.refreshRadio();
    }
    return SB.radio.current();
  },

  // Hentikan musik (mis. saat pause).
  stop() {
    if (SB.radio._timer) { clearInterval(SB.radio._timer); SB.radio._timer = null; }
  },

  // Mulai/ulang scheduler untuk stasiun aktif.
  _restart() {
    SB.radio.stop();
    const st = SB.radio.current();
    const pat = PATTERNS[st.genre];
    if (!pat || !pat.notes.length) return; // PALMA TALK: tanpa musik
    SB.radio._step = 0;
    const ctx = SB.audio && SB.audio.ensure ? SB.audio.ensure() : null;
    if (!ctx) return;
    SB.radio._nextTime = ctx.currentTime + 0.05;
    const stepDur = 60 / pat.bpm / 2; // 8th notes
    SB.radio._timer = setInterval(() => {
      const c = SB.audio.ctx;
      if (!c) return;
      while (SB.radio._nextTime < c.currentTime + 0.25) {
        const note = pat.notes[SB.radio._step % pat.notes.length];
        if (note >= 0) {
          const freq = pat.root * Math.pow(2, note / 12);
          SB.radio._playNote(freq, SB.radio._nextTime, stepDur * 0.9, st.genre);
        }
        SB.radio._step++;
        SB.radio._nextTime += stepDur;
      }
    }, 120);
  },

  // Satu nada synth: segitiga + lowpass, decay pendek.
  _playNote(freq, when, dur, genre) {
    const ctx = SB.audio.ctx;
    if (!ctx || !SB.audio.master) return;
    const osc = ctx.createOscillator();
    osc.type = genre === 'synth' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq, when);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = genre === 'synth' ? 900 : 2400;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(0.09, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(SB.audio.master);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  },
};

export { SB };
