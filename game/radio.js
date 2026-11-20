// radio.js — 3 stasiun Solmar Bay (API.md r7 §10). B4 r7.
(function () {
  'use strict';
  var SB = window.SB;
  var STATIONS = [
    { name: 'WAVE 88.1', genre: 'sunset synth', bpm: 88, tracks: ['Neon Drive — Pink Horizon', 'Palm Static — Coral Ghosts', 'Sunset Run — Vega Bay'] },
    { name: 'SOL 101.9', genre: 'latin pop', bpm: 100, tracks: ['Sol de Medianoche — Marisol', 'Calle Ocho — Los Palmeros', 'Brisa del Mar — Solmar'] },
    { name: 'BAY 96.5', genre: 'funk/disco', bpm: 116, tracks: ['Disco Bay — The Flamingos', 'Night Swim — Velvet Tide', 'Pink Flamingo — DJ Palma'] }
  ];
  var idx = 0, track = 0, playing = true;
  function apply() {
    var s = STATIONS[idx];
    SB.state.radio = { station: idx, name: s.name, track: s.tracks[track], playing: playing };
    if (SB.audio && typeof SB.audio.setStation === 'function') { try { SB.audio.setStation(playing ? idx : -1); } catch (e) {} }
    if (typeof SB.emit === 'function') SB.emit('radio', SB.state.radio);
  }
  function play(i) { idx = ((i % 3) + 3) % 3; track = 0; playing = true; apply(); return current(); }
  function next() { return play(idx + 1); }
  function prev() { return play(idx - 1); }
  function nextTrack() { track = (track + 1) % STATIONS[idx].tracks.length; apply(); return current(); }
  function toggle() { playing = !playing; apply(); return current(); }
  function current() {
    var s = STATIONS[idx];
    return { station: idx, name: s.name, track: s.tracks[track], playing: playing, bpm: s.bpm, genre: s.genre };
  }
  SB.radio = { STATIONS: STATIONS, stations: STATIONS, play: play, next: next, prev: prev, nextTrack: nextTrack, toggle: toggle, current: current };
})();
