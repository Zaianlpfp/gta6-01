// audio.js — WebAudio prosedural Solmar Bay (B4, r5). Tanpa file eksternal,
// tanpa request network. Semua method no-throw + return boolean sebelum unlock.
// Unlock via click/keydown pertama (autoplay policy).
(function () {
  var SB = window.SB = window.SB || {};
  var A = SB.audio = SB.audio || {};
  var ctx = null, master = null, eng = null, engGain = null, sirenOsc = null,
    sirenGain = null, muted = false, unlocked = false, beatTimer = 0;

  function ac() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }
  function tone(f0, f1, dur, type, vol, when) {
    if (!ctx) return false;
    try {
      var t = ctx.currentTime + (when || 0), o = ctx.createOscillator(),
        g = ctx.createGain();
      o.type = type || 'square'; o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
      return true;
    } catch (e) { return false; }
  }
  function noise(dur, vol, fc) {
    if (!ctx) return false;
    try {
      var n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate),
        d = buf.getChannelData(0), i;
      for (i = 0; i < n; i++) d[i] = (i % 2 ? 1 : -1) * (1 - i / n) * 0.9;
      var s = ctx.createBufferSource(); s.buffer = buf;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = fc || 1200;
      var g = ctx.createGain(); g.gain.value = vol || 0.3;
      s.connect(f); f.connect(g); g.connect(master); s.start();
      return true;
    } catch (e) { return false; }
  }
  function ok() { return !!unlocked; }

  A.isUnlocked = function () { return unlocked; };
  A.unlock = function () {
    if (unlocked) return true;
    try {
      if (!ac()) return false;
      if (ctx.state === 'suspended') ctx.resume();
      unlocked = ctx.state === 'running' || !!ctx;
      if (unlocked) tone(660, 660, 0.06, 'sine', 0.08);
      return unlocked;
    } catch (e) { return false; }
  };
  A.setMuted = function (m) {
    muted = !!m;
    try { if (master) master.gain.value = muted ? 0 : 0.5; } catch (e) {}
    return true;
  };
  A.ui = function () { return ok() ? tone(880, 880, 0.05, 'sine', 0.12) : false; };
  A.select = function () { return ok() ? tone(520, 780, 0.07, 'sine', 0.14) : false; };
  A.error = function () { return ok() ? tone(160, 110, 0.18, 'sawtooth', 0.16) : false; };
  A.cash = function () {
    if (!ok()) return false;
    tone(990, 990, 0.09, 'sine', 0.16); tone(1320, 1320, 0.14, 'sine', 0.16, 0.09);
    return true;
  };
  A.reload = function () {
    if (!ok()) return false;
    tone(300, 300, 0.03, 'square', 0.12); tone(420, 420, 0.03, 'square', 0.12, 0.09);
    return true;
  };
  A.shot = function () {
    if (!ok()) return false;
    noise(0.12, 0.4, 2500); tone(180, 60, 0.1, 'square', 0.2);
    return true;
  };
  A.engineStart = function () {
    if (!ok() || eng) return !!eng;
    try {
      eng = ctx.createOscillator(); eng.type = 'sawtooth'; eng.frequency.value = 55;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
      engGain = ctx.createGain(); engGain.gain.value = 0.06;
      eng.connect(f); f.connect(engGain); engGain.connect(master); eng.start();
      return true;
    } catch (e) { eng = null; return false; }
  };
  A.setEngine = function (kmh) {
    try {
      if (eng) eng.frequency.value = 45 + Math.min(160, Math.max(0, kmh || 0)) * 0.9;
      if (engGain) engGain.gain.value = 0.04 + Math.min(0.08, (kmh || 0) / 2000);
      return !!eng;
    } catch (e) { return false; }
  };
  A.engineStop = function () {
    try { if (eng) { eng.stop(); eng = null; engGain = null; } return true; }
    catch (e) { eng = null; return false; }
  };
  // Stasiun radio: bassline beda tempo/nada tiap stasiun (dipanggil SB.radio).
  var BEAT = [112, 96, 128], BASS = [55, 49, 65];
  A.station = function (i) {
    if (!ok()) return false;
    try {
      var b = BASS[((i || 0) % 3 + 3) % 3];
      tone(b, b, 0.22, 'triangle', 0.22); tone(b * 1.5, b * 1.5, 0.18, 'triangle', 0.14, 0.22);
      tone(b * 2, b * 2, 0.12, 'sine', 0.1, 0.44);
      beatTimer = BEAT[((i || 0) % 3 + 3) % 3];
      return true;
    } catch (e) { return false; }
  };
  A.tempo = function () { return beatTimer || 0; };
  A.siren = function (on) {
    if (!ok()) return false;
    try {
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine';
        sirenOsc.frequency.value = 700;
        sirenGain = ctx.createGain(); sirenGain.gain.value = 0.05;
        var lfo = ctx.createOscillator(); lfo.frequency.value = 1.4;
        var lg = ctx.createGain(); lg.gain.value = 220;
        lfo.connect(lg); lg.connect(sirenOsc.frequency);
        sirenOsc.connect(sirenGain); sirenGain.connect(master);
        sirenOsc.start(); lfo.start();
      } else if (!on && sirenOsc) {
        try { sirenOsc.stop(); } catch (e) {}
        sirenOsc = null; sirenGain = null;
      }
      return true;
    } catch (e) { return false; }
  };
  function arm() { A.unlock(); }
  try {
    document.addEventListener('click', arm, { once: false });
    document.addEventListener('keydown', arm, { once: false });
  } catch (e) {}
})();
