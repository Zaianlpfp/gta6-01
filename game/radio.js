// Solmar Bay — gta6-01 rebuild r13. Radio stations (fresh).
// Three stations, switched with Q (cycle forward). Each station has its own
// bassline in SB.audio; switching a station switches the music with it.
// The HUD radio widget reads SB.radio.current() for its label.
(function () {
  'use strict';

  var SB = window.SB || (window.SB = {});

  var STATIONS = [
    { name: 'WAVE 88.1', genre: 'Synthwave', freq: '88.1' },
    { name: 'SOL 101.9', genre: 'Latin Drive', freq: '101.9' },
    { name: 'BAY 96.5', genre: 'Chill Bay', freq: '96.5' },
  ];

  var radio = {
    stations: STATIONS,
    index: 0,

    current: function () {
      return STATIONS[this.index];
    },

    label: function () {
      return STATIONS[this.index].name;
    },

    setStation: function (i) {
      var n = STATIONS.length;
      this.index = ((i % n) + n) % n;
      if (SB.audio) SB.audio.startStation(this.index);
      if (SB.hud && typeof SB.hud.update === 'function') SB.hud.update();
      return this.current();
    },

    next: function () {
      return this.setStation(this.index + 1);
    },

    prev: function () {
      return this.setStation(this.index - 1);
    },
  };

  SB.radio = radio;
})();
