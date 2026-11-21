// audio.js — Solmar Bay (gta6-01 v4 r14)
// Suara WebAudio yang disintesis penuh (oscillator + noise buffer); TANPA file
// audio eksternal, TANPA network. Ditulis FRESH dari game/API.md §14.
// Determinisme: noise buffer dibuat dengan mulberry32 lokal (seed tetap 4242),
// BUKAN SB.rng() — supaya urutan acak game tidak terganggu. Jam yang dipakai
// hanya AudioContext.currentTime (jam audio), bukan Date/wall-clock game.
import { SB } from './engine.js';

// RNG lokal khusus audio (seed tetap; tidak menyentuh SB.rng()).
function mulberry32Local(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

SB.audio = {
  ctx: null,
  master: null,
  enabled: true,
  _noiseBuf: null,
  _hum: null,       // { osc, gain } mesin mobil hero
  _siren: null,     // { osc, lfo, lfoGain, gain } sirene polisi

  // Buat (atau kembalikan) AudioContext. Harus dipanggil dari gesture pengguna
  // (klik/tombol) karena kebijakan autoplay browser; aman dipanggil berulang.
  ensure() {
    if (SB.audio.ctx) {
      if (SB.audio.ctx.state === 'suspended') SB.audio.ctx.resume();
      return SB.audio.ctx;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      const master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      SB.audio.ctx = ctx;
      SB.audio.master = master;
      // Noise buffer 1 detik (putih), dibuat sekali dari RNG lokal.
      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      const rnd = mulberry32Local(4242);
      for (let i = 0; i < len; i++) data[i] = rnd() * 2 - 1;
      SB.audio._noiseBuf = buf;
    } catch (e) { /* audio tidak tersedia: game tetap jalan tanpa suara */ }
    return SB.audio.ctx;
  },

  // Satu nada pendek (oscillator). Dipakai beep/cash/dll.
  _tone(freq, dur, type, vol, when) {
    const ctx = SB.audio.ctx;
    if (!ctx || !SB.audio.enabled) return;
    const t0 = (when === undefined ? ctx.currentTime : when);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(vol || 0.25, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(SB.audio.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  },

  // Bip UI pendek (880 Hz, 0,08 dtk).
  beep() {
    SB.audio.ensure();
    SB.audio._tone(880, 0.08, 'square', 0.12);
  },

  // Deru mesin mobil hero. speed = km/h (0..180). Dipanggil tiap frame dari
  // loop game; oscillator dibuat sekali, frekuensi + volume mengikuti speed.
  engineHum(speed) {
    const ctx = SB.audio.ensure();
    if (!ctx || !SB.audio.enabled) return;
    const v = Math.max(0, Math.min(180, speed || 0));
    if (!SB.audio._hum) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(SB.audio.master);
      osc.start();
      SB.audio._hum = { osc, filter, gain };
    }
    const h = SB.audio._hum;
    const t = ctx.currentTime;
    h.osc.frequency.setTargetAtTime(52 + v * 1.15, t, 0.08);
    h.filter.frequency.setTargetAtTime(320 + v * 5, t, 0.08);
    h.gain.gain.setTargetAtTime(v > 2 ? 0.05 + v * 0.00045 : 0, t, 0.1);
  },

  // Sirene polisi dua nada (LFO 0,55 Hz mengayun frekuensi carrier 620↔920 Hz).
  siren(on) {
    const ctx = SB.audio.ensure();
    if (!ctx) return;
    if (on && !SB.audio._siren) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 770;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 150;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      const gain = ctx.createGain();
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(SB.audio.master);
      osc.start();
      lfo.start();
      SB.audio._siren = { osc, lfo, gain };
    } else if (!on && SB.audio._siren) {
      try { SB.audio._siren.osc.stop(); SB.audio._siren.lfo.stop(); } catch (e) { /* abaikan */ }
      SB.audio._siren = null;
    }
  },

  // Tembakan: burst noise 0,12 dtk lewat lowpass + klik nada rendah.
  gunshot() {
    const ctx = SB.audio.ensure();
    if (!ctx || !SB.audio.enabled || !SB.audio._noiseBuf) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = SB.audio._noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(SB.audio.master);
    src.start(t, 0, 0.15);
    SB.audio._tone(140, 0.09, 'sine', 0.3, t);
  },

  // Bunyi uang masuk: dua blip naik (E6 lalu B6).
  cash() {
    SB.audio.ensure();
    const ctx = SB.audio.ctx;
    if (!ctx) return;
    SB.audio._tone(1318.5, 0.1, 'sine', 0.22);
    SB.audio._tone(1975.5, 0.16, 'sine', 0.22, ctx.currentTime + 0.09);
  },

  // Matikan semua suara berkelanjutan (mesin + sirene).
  stopAll() {
    if (SB.audio._hum) {
      try { SB.audio._hum.osc.stop(); } catch (e) { /* abaikan */ }
      SB.audio._hum = null;
    }
    SB.audio.siren(false);
  },
};

export { SB };
