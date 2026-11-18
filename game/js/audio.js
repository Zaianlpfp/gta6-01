// Solmar Bay — audio.js
// One job: every sound is procedural WebAudio — engine, siren, gunshots, pickups,
// and three named radio stations, each with its own bassline, tempo and key.
// No audio files: the whole soundtrack is synthesized live.
'use strict';

const AudioSys = {
  ctx: null, master: null, musicGain: null, engineOsc: null, engineGain: null,
  sirenOsc: null, sirenGain: null, sirenLfo: null,
  station: 0, radioOn: true, nextNoteTime: 0, step: 0, radioTimer: null,
  started: false,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.32;
    this.musicGain.connect(this.master);
    // Engine hum: two detuned saws through a lowpass, pitch follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const eng2 = this.ctx.createOscillator();
    eng2.type = 'sawtooth'; eng2.frequency.value = 55.7;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 320;
    this.engineOsc.connect(lp); eng2.connect(lp);
    lp.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start(); eng2.start();
    this.engineOsc2 = eng2;
    // Siren: a triangle that slides between two notes on an LFO.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle'; this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0;
    this.sirenLfo = this.ctx.createOscillator();
    this.sirenLfo.type = 'square'; this.sirenLfo.frequency.value = 0.55;
    const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 180;
    this.sirenLfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
    this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
    this.sirenOsc.start(); this.sirenLfo.start();
    this.started = true;
    this.startRadio();
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  setEngine(speedFrac, inCar) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 48 + speedFrac * 130;
    this.engineOsc.frequency.setTargetAtTime(f, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(f * 1.008, t, 0.08);
    this.engineGain.gain.setTargetAtTime(inCar ? 0.05 + speedFrac * 0.075 : 0, t, 0.1);
  },

  setSiren(on) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, this.ctx.currentTime, 0.2);
  },

  blip(freq, dur, type, vol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },

  pickup() { this.blip(880, 0.12, 'sine', 0.25); setTimeout(() => this.blip(1318, 0.18, 'sine', 0.25), 90); },
  coin() { this.blip(1046, 0.1, 'triangle', 0.22); setTimeout(() => this.blip(1568, 0.22, 'triangle', 0.22), 80); },
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.25), i * 110)); },
  busted() { [330, 262, 196].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'sawtooth', 0.2), i * 160)); },
  click() { this.blip(1200, 0.05, 'square', 0.12); },

  gunshot(kind) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = kind === 'shotgun' ? 0.28 : kind === 'smg' ? 0.09 : 0.14;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.value = kind === 'shotgun' ? 900 : 2400;
    const g = this.ctx.createGain(); g.gain.value = kind === 'shotgun' ? 0.5 : 0.32;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
    this.blip(kind === 'shotgun' ? 70 : 120, 0.12, 'sine', 0.3);
  },

  emptyClick() { this.blip(2000, 0.04, 'square', 0.1); },

  // ---- Radio: three stations, each a live-sequenced bassline + hats. ------
  startRadio() {
    if (this.radioTimer || !this.ctx) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.radioTimer = setInterval(() => this.radioTick(), 40);
  },
  midi(m) { return 440 * Math.pow(2, (m - 69) / 12); },
  radioTick() {
    if (!this.ctx || !this.radioOn || !G || G.state !== 'play') return;
    const st = RADIO[this.station];
    const spb = 60 / st.bpm / 2; // eighth notes
    while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
      const s16 = this.step % 16;
      const scale = st.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
      // Bassline: root pulses on 0/3/6/8/11/14, walk on 4/12.
      if (s16 === 0 || s16 === 3 || s16 === 6 || s16 === 8 || s16 === 11 || s16 === 14) {
        this.note(this.midi(st.root - 12), spb * 0.9, st.wave, 0.20);
      } else if (s16 === 4 || s16 === 12) {
        this.note(this.midi(st.root - 12 + scale[(this.step >> 4) % scale.length]), spb * 0.9, st.wave, 0.14);
      }
      // Sparkle lead every bar on the neon station.
      if (st.name === 'WAVE 88.1' && s16 === 0) this.note(this.midi(st.root + 12 + scale[this.step % 5]), spb * 1.8, 'sine', 0.07);
      if (st.name === 'BAY 96.5' && s16 % 4 === 2) this.hat(this.nextNoteTime, 0.05);
      if (s16 % 2 === 0) this.hat(this.nextNoteTime, 0.025);
      this.nextNoteTime += spb;
      this.step++;
    }
  },
  note(freq, dur, type, vol) {
    const t = this.nextNoteTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.02);
  },
  hat(t, vol) {
    const len = 0.04;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.musicGain);
    src.start(t);
  },
  cycleStation(dir) {
    this.station = (this.station + (dir || 1) + RADIO.length) % RADIO.length;
    this.step = 0;
    this.blip(660, 0.08, 'sine', 0.15);
    if (typeof showToast === 'function') showToast(RADIO[this.station].name + ' · ' + RADIO[this.station].genre);
  },
};
