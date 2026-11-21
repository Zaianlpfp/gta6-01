// Solmar Bay — gta6-01 rebuild r13. WebAudio (fresh).
// One bassline pattern per radio station, stepped by a counter — fully
// deterministic, no nondeterministic calls anywhere. Everything is guarded:
// in headless or muted contexts the audio context may not exist, and every
// call must then be a silent no-op instead of a crash.
(function () {
  'use strict';

  var SB = window.SB || (window.SB = {});

  // Basslines: [midi note, steps held] pairs, one pattern per station.
  // WAVE 88.1 = smooth synthwave, SOL 101.9 = driving latin, BAY 96.5 = chill.
  var PATTERNS = [
    // WAVE 88.1 — A minor, slow pulse
    [45, 2, 45, 2, 48, 2, 43, 2, 45, 2, 52, 2, 48, 2, 43, 2],
    // SOL 101.9 — E minor, faster drive
    [40, 1, 40, 1, 47, 1, 40, 1, 43, 1, 47, 1, 45, 1, 43, 1],
    // BAY 96.5 — C major, laid back
    [36, 4, 43, 4, 41, 4, 43, 4, 36, 4, 48, 4, 43, 4, 41, 4],
  ];

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  var audio = {
    ctx: null,
    master: null,
    muted: false,
    station: 0,
    step: 0,
    timer: 0,
    started: false,

    init: function () {
      if (this.started) return;
      this.started = true;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return; // headless / no audio: stay silent
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.25;
        this.master.connect(this.ctx.destination);
      } catch (err) {
        this.ctx = null; // any failure: silent, never crash the game
      }
    },

    setMuted: function (on) {
      this.muted = !!on;
      if (this.master && this.ctx) {
        this.master.gain.value = this.muted ? 0 : 0.25;
      }
    },

    isMuted: function () {
      return this.muted;
    },

    // Switch the bassline to a station (0..2). Safe before init.
    startStation: function (index) {
      this.station = ((index % PATTERNS.length) + PATTERNS.length) % PATTERNS.length;
      this.step = 0;
      this._schedule();
    },

    stop: function () {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = 0;
      }
    },

    // One soft blip (UI feedback). Silent when audio is unavailable.
    blip: function (freq) {
      if (!this.ctx || this.muted) return;
      try {
        var osc = this.ctx.createOscillator();
        var gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq || 660;
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.13);
      } catch (err) {
        // ignore: audio must never break gameplay
      }
    },

    _schedule: function () {
      var self = this;
      if (this.timer) clearTimeout(this.timer);
      if (!this.ctx || this.muted) return;
      var pattern = PATTERNS[this.station];
      var pair = this.step % (pattern.length / 2);
      var midi = pattern[pair * 2];
      var held = pattern[pair * 2 + 1];
      this.step += 1;
      try {
        var osc = this.ctx.createOscillator();
        var gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = midiToFreq(midi);
        var t = this.ctx.currentTime;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22 * held);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t);
        osc.stop(t + 0.22 * held + 0.05);
      } catch (err) {
        // ignore
      }
      this.timer = setTimeout(function () {
        self._schedule();
      }, 220 * held);
    },
  };

  SB.audio = audio;
})();
