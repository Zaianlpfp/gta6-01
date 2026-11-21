// audio.js — suara prosedural WebAudio, tanpa file. B4 r11, tulis segar dari tree r10.
(function () {
  'use strict';
  var SB = window.SB;
  var ctx = null, master = null, engOsc = null, engGain = null, sirOsc = null, sirLfo = null, sirGain = null;
  var seqTimer = 0, seqStep = 0, station = -1, muted = false;
  var BASS = [[0, 0, 7, 0, 10, 0, 7, 5], [0, 3, 5, 7, 5, 3, 0, -2], [0, 0, 12, 0, 10, 7, 5, 7]];
  var BPM = [88, 100, 116];
  function rng99() {
    if (typeof SB.rng === 'function') { try { return SB.rng(99); } catch (e) {} }
    var s = 99;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function init() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.35;
      master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }
  function ensure() {
    if (!ctx) init();
    if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return !!ctx;
  }
  function tone(freq, dur, type, vol, when) {
    if (!ensure()) return;
    var t = ctx.currentTime + (when || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noiseBuf() {
    var len = 2205, buf = ctx.createBuffer(1, len, 44100), d = buf.getChannelData(0);
    var rng = rng99();
    for (var i = 0; i < len; i++) d[i] = (rng() * 2 - 1) * (1 - i / len);
    return buf;
  }
  function shot() {
    if (!ensure()) return;
    var src = ctx.createBufferSource(); src.buffer = noiseBuf();
    var g = ctx.createGain(); g.gain.value = 0.5;
    var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900;
    src.connect(f); f.connect(g); g.connect(master); src.start();
    tone(160, 0.08, 'square', 0.15);
  }
  function pickup() { tone(660, 0.09, 'sine', 0.2); tone(990, 0.12, 'sine', 0.2, 0.09); }
  function engine(sp) {
    if (!ensure()) return;
    sp = Math.max(0, sp || 0);
    if (!engOsc) {
      engOsc = ctx.createOscillator(); engOsc.type = 'sawtooth';
      engGain = ctx.createGain(); engGain.gain.value = 0;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
      engOsc.connect(f); f.connect(engGain); engGain.connect(master);
      engOsc.start();
    }
    engOsc.frequency.value = 42 + sp * 1.1;
    engGain.gain.value = sp > 1 ? 0.05 + Math.min(0.08, sp / 2000) : 0;
  }
  function siren(on) {
    if (!ensure()) return;
    if (on && !sirOsc) {
      sirOsc = ctx.createOscillator(); sirOsc.type = 'sine'; sirOsc.frequency.value = 800;
      sirLfo = ctx.createOscillator(); sirLfo.type = 'square'; sirLfo.frequency.value = 0.8;
      var lg = ctx.createGain(); lg.gain.value = 220;
      sirLfo.connect(lg); lg.connect(sirOsc.frequency);
      sirGain = ctx.createGain(); sirGain.gain.value = 0.06;
      sirOsc.connect(sirGain); sirGain.connect(master);
      sirOsc.start(); sirLfo.start();
    } else if (!on && sirOsc) {
      try { sirOsc.stop(); sirLfo.stop(); } catch (e) {}
      sirOsc = null; sirLfo = null; sirGain = null;
    }
  }
  function seqTick() {
    if (station < 0 || !ctx) return;
    var pat = BASS[station], n = pat[seqStep % pat.length];
    tone(110 * Math.pow(2, n / 12), 0.22, station === 2 ? 'square' : 'triangle', 0.16);
    if (seqStep % 2 === 0) tone(220 * Math.pow(2, n / 12), 0.1, 'sine', 0.05);
    seqStep++;
  }
  function setStation(i) {
    station = i;
    if (seqTimer) { clearInterval(seqTimer); seqTimer = 0; }
    seqStep = 0;
    if (i >= 0 && ensure()) setTimeout(function () { seqTimer = setInterval(seqTick, Math.round(60000 / BPM[i] / 2)); }, 0);
  }
  function setMuted(m) { muted = !!m; if (master) master.gain.value = muted ? 0 : 0.35; }
  SB.audio = { init: init, engine: engine, siren: siren, shot: shot, pickup: pickup, setStation: setStation, setMuted: setMuted, isMuted: function () { return muted; } };
})();
