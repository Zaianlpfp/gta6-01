// Solmar Bay — audio (B4, v4-rebuild r4). Synthesized WebAudio, no external files.
// Every public call is guarded: safe before the AudioContext is unlocked.
(function () {
  var SB = window.SB = window.SB || {};
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, master = null, engOsc = null, engGain = null, engFilter = null;
  var noiseBuf = null, muted = false, engOn = false;

  function lfsr(seed) { // deterministic xorshift32
    var x = seed >>> 0 || 1;
    return function () {
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
      return x / 4294967296 - 0.5;
    };
  }

  function ensure() {
    try {
      if (!AC) return false;
      if (!ctx) {
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 0.45; master.connect(ctx.destination);
        var len = Math.floor(ctx.sampleRate);
        noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        var d = noiseBuf.getChannelData(0), rnd = lfsr(123456789);
        for (var i = 0; i < len; i++) d[i] = rnd();
      }
      if (ctx.state === 'suspended' && ctx.resume) { try { ctx.resume(); } catch (e) {} }
      return true;
    } catch (e) { return false; }
  }

  function tone(freq, dur, type, vol, delay, slideTo) {
    if (!ensure() || muted) return false;
    try {
      var t0 = ctx.currentTime + (delay || 0);
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol || 0.15), t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
      return true;
    } catch (e) { return false; }
  }

  function noise(dur, vol, freq) {
    if (!ensure() || muted || !noiseBuf) return false;
    try {
      var t0 = ctx.currentTime;
      var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 900;
      var g = ctx.createGain();
      g.gain.setValueAtTime(Math.max(0.0002, vol || 0.3), t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(master); src.start(t0); src.stop(t0 + dur + 0.05);
      return true;
    } catch (e) { return false; }
  }

  SB.audio = {
    version: '4.0.0-r4',
    unlocked: function () { try { return !!ctx && ctx.state === 'running'; } catch (e) { return false; } },
    ensure: ensure,
    setMuted: function (m) { muted = !!m; try { if (master) master.gain.value = muted ? 0 : 0.45; } catch (e) {} return muted; },
    isMuted: function () { return muted; },
    ui: function () { return tone(880, 0.07, 'square', 0.08); },
    select: function () { tone(660, 0.06, 'square', 0.1); return tone(990, 0.09, 'square', 0.1, 0.06); },
    station: function () { tone(520, 0.08, 'triangle', 0.14); return tone(780, 0.12, 'triangle', 0.14, 0.08); },
    cash: function () { tone(988, 0.09, 'sine', 0.16); return tone(1319, 0.16, 'sine', 0.16, 0.09); },
    error: function () { return tone(160, 0.16, 'sawtooth', 0.12, 0, 110); },
    reload: function () { tone(300, 0.05, 'square', 0.09); return tone(420, 0.05, 'square', 0.09, 0.07); },
    shot: function () { noise(0.14, 0.4, 1400); return tone(110, 0.12, 'sine', 0.3, 0, 55); },
    engineStart: function () {
      if (!ensure() || muted || engOn) return false;
      try {
        engOsc = ctx.createOscillator(); engOsc.type = 'sawtooth'; engOsc.frequency.value = 55;
        engFilter = ctx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 320;
        engGain = ctx.createGain(); engGain.gain.value = 0.0;
        engOsc.connect(engFilter); engFilter.connect(engGain); engGain.connect(master);
        engOsc.start(); engOn = true; return true;
      } catch (e) { return false; }
    },
    engine: function (kmh) {
      if (!engOn) { if (!this.engineStart()) return false; }
      try {
        var s = Math.max(0, kmh || 0);
        engOsc.frequency.setTargetAtTime(42 + s * 1.05, ctx.currentTime, 0.08);
        engFilter.frequency.setTargetAtTime(280 + s * 4, ctx.currentTime, 0.1);
        engGain.gain.setTargetAtTime(muted ? 0 : 0.015 + Math.min(0.05, s / 3000), ctx.currentTime, 0.1);
        return true;
      } catch (e) { return false; }
    },
    engineStop: function () {
      if (!engOn) return false;
      try { engGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05); engOsc.stop(ctx.currentTime + 0.2); } catch (e) {}
      engOn = false; engOsc = null; engGain = null; engFilter = null; return true;
    }
  };
})();
