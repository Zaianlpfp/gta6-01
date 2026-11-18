(function () {
  'use strict';
  var SB = window.SB = window.SB || {};
  var ctx = null, master = null, musicGain = null, engOsc = null, engGain = null,
    sirOsc = null, sirGain = null, sirLfo = null, schedTimer = 0, step = 0, nextT = 0,
    station = 0, playing = true;

  var BASS = [
    [0, 0, 12, 0, 3, 0, 10, 7],
    [0, 0, 7, 0, 5, 7, 10, 12],
    [0, 12, 0, 7, 0, 10, 12, 15]
  ];
  var LEAD = [0, -1, 12, -1, 7, -1, 10, -1, 12, -1, 7, -1, 15, -1, 12, -1];
  function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = playing ? 0.32 : 0; musicGain.connect(master);
    return true;
  }
  function note(midiN, t, dur, wave, gain, dest) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave; o.frequency.value = midi(midiN);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function scheduler() {
    if (!ctx || !playing) return;
    var st = SB.radio ? SB.radio.stationDef(station) : null;
    if (!st) return;
    var spb = 60 / st.bpm / 2;
    while (nextT < ctx.currentTime + 0.3) {
      var bar = Math.floor(step / 8) % 2;
      var b = BASS[station][step % 8];
      note(st.root + b, nextT, spb * 0.9, st.wave, 0.5);
      var l = LEAD[step % 16];
      if (l >= 0 && step % 4 === 0) note(st.root + 24 + l, nextT, spb * 1.8, 'sine', 0.12);
      if (step % 8 === 4) note(st.root + 36, nextT, 0.05, 'square', 0.05);
      step++; nextT += spb;
      if (bar === 1 && step % 8 === 0) step += 0;
    }
  }
  SB.audio = {
    init: function () {
      if (SB.audio._inited) return;
      SB.audio._inited = true;
      var go = function () { if (ensure() && ctx.state === 'suspended') ctx.resume(); };
      window.addEventListener('pointerdown', go);
      window.addEventListener('keydown', go);
      go();
    },
    ready: function () { return !!ctx; },
    engine: function (speedKmh) {
      if (!ensure()) return;
      if (!engOsc) {
        engOsc = ctx.createOscillator(); engGain = ctx.createGain();
        engOsc.type = 'sawtooth'; engOsc.frequency.value = 55;
        engGain.gain.value = 0; engOsc.connect(engGain); engGain.connect(master); engOsc.start();
      }
      var sp = speedKmh || 0;
      engOsc.frequency.setTargetAtTime(45 + sp * 1.1, ctx.currentTime, 0.1);
      engGain.gain.setTargetAtTime(sp > 1 ? 0.035 : 0.012, ctx.currentTime, 0.1);
    },
    siren: function (on) {
      if (!ensure()) return;
      if (on && !sirOsc) {
        sirOsc = ctx.createOscillator(); sirGain = ctx.createGain(); sirLfo = ctx.createOscillator();
        var lg = ctx.createGain(); lg.gain.value = 180;
        sirOsc.type = 'sine'; sirOsc.frequency.value = 750;
        sirLfo.type = 'sine'; sirLfo.frequency.value = 0.9;
        sirLfo.connect(lg); lg.connect(sirOsc.frequency);
        sirGain.gain.value = 0.05;
        sirOsc.connect(sirGain); sirGain.connect(master);
        sirOsc.start(); sirLfo.start();
      } else if (!on && sirOsc) {
        try { sirOsc.stop(); sirLfo.stop(); } catch (e) {}
        sirOsc = null; sirLfo = null; sirGain = null;
      }
    },
    shot: function () {
      if (!ensure()) return;
      var len = Math.floor(ctx.sampleRate * 0.12), buf = ctx.createBuffer(1, len, ctx.sampleRate),
        d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (SB.rng() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource(); src.buffer = buf;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
      var g = ctx.createGain(); g.gain.value = 0.4;
      src.connect(f); f.connect(g); g.connect(master); src.start();
    },
    pickup: function () {
      if (!ensure()) return;
      var t = ctx.currentTime;
      note(81, t, 0.12, 'sine', 0.3, master);
      note(88, t + 0.09, 0.18, 'sine', 0.3, master);
    },
    setStation: function (i) {
      station = ((i || 0) % 3 + 3) % 3;
      step = 0;
      if (!ensure()) return;
      if (!schedTimer) {
        nextT = ctx.currentTime + 0.05;
        schedTimer = setInterval(scheduler, 120);
      }
      if (musicGain) musicGain.gain.value = playing ? 0.32 : 0;
    },
    setPlaying: function (b) {
      playing = !!b;
      if (musicGain) musicGain.gain.value = playing ? 0.32 : 0;
      if (playing && ctx && !schedTimer) SB.audio.setStation(station);
    }
  };
})();
