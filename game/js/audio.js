// Procedural sound for Solmar Bay: everything is synthesized with WebAudio,
// so the game ships no audio files and makes no network request.
// Engine hum, police siren, gunshots, pickups, phone buzz and a light
// sunset bassline are all oscillators and filtered noise, built here.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.musicTimer = null;
    this.musicStep = 0;
  }
  // Must be called from a user gesture (the start button) — browsers block
  // audio before the first click.
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // Engine: a sawtooth through a low-pass, pitch follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
    // Siren: a square wave that wails between two tones.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'square';
    this.sirenOsc.frequency.value = 720;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.ctx.destination);
    this.sirenOsc.start();
  }
  setMuted(m) {
    this.muted = m;
    if (this.engineGain) this.engineGain.gain.value = 0;
    if (this.sirenGain) this.sirenGain.gain.value = 0;
  }
  setEngine(speed01, on) {
    if (!this.ctx || this.muted) { if (this.engineGain) this.engineGain.gain.value = 0; return; }
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.05 : 0, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, t, 0.06);
    this.engineFilter.frequency.setTargetAtTime(380 + speed01 * 900, t, 0.1);
  }
  setSiren(on, dt) {
    if (!this.ctx) return;
    if (!on || this.muted) { if (this.sirenGain) this.sirenGain.gain.value = 0; return; }
    this.sirenTimer += dt;
    const hi = Math.floor(this.sirenTimer * 1.6) % 2 === 0;
    const t = this.ctx.currentTime;
    this.sirenOsc.frequency.setTargetAtTime(hi ? 920 : 660, t, 0.05);
    this.sirenGain.gain.setTargetAtTime(0.028, t, 0.1);
  }
  blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noiseBurst(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq || 1800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.ctx.destination);
    src.start(t);
  }
  gunshot() { this.noiseBurst(0.14, 0.28, 2400); this.blip(160, 0.08, 'square', 0.1, 60); }
  crash() { this.noiseBurst(0.3, 0.3, 700); }
  pickup() { this.blip(660, 0.09, 'sine', 0.14); setTimeout(() => this.blip(990, 0.14, 'sine', 0.14), 70); }
  coin() { this.blip(1180, 0.07, 'triangle', 0.12); setTimeout(() => this.blip(1560, 0.12, 'triangle', 0.12), 60); }
  phoneBuzz() { this.blip(220, 0.09, 'square', 0.07); setTimeout(() => this.blip(220, 0.09, 'square', 0.07), 130); }
  missionDone() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.16), i * 110));
  }
  busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'sawtooth', 0.1), i * 160)); }
  // A slow sunset bassline: A minor walk, one note per beat, scheduled ahead.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const f = bass[this.musicStep % bass.length];
      this.musicStep++;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = 'triangle'; o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 0.6);
      if (this.musicStep % 4 === 2) this.blip(f * 4, 0.12, 'sine', 0.03);
    }, 340);
  }
  stopMusic() { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } }
}
