(function () {
  'use strict';
  var SB = window.SB = window.SB || {};
  var S = SB.state;
  var STATIONS = [
    { name: 'WAVE 88.1', genre: 'SUNSET SYNTH', bpm: 96, wave: 'sawtooth', root: 45,
      tracks: ['Neon Drive — Pink Horizon', 'Palm Static — Coral Ghosts', 'Midnight Causeway — Lumen Kids'] },
    { name: 'RADIO SOL 101.9', genre: 'LATIN POP', bpm: 104, wave: 'triangle', root: 50,
      tracks: ['Sol de Medianoche — Marisol', 'Calle Ocho — Los Palmeros', 'Baila Solmar — Luna Rey'] },
    { name: 'FLAMINGO FM 88.1', genre: 'FUNK / DISCO', bpm: 116, wave: 'square', root: 41,
      tracks: ['Disco Bay — The Flamingos', 'Night Swim — Velvet Tide', 'Pink Cadillac — The Flamingos'] }
  ];
  var trackIdx = 0;
  function apply() {
    var st = STATIONS[S.radio.station];
    S.radio.name = st.name;
    S.radio.track = st.tracks[trackIdx % st.tracks.length];
    if (SB.audio && SB.audio.setStation) SB.audio.setStation(S.radio.station);
    if (SB.hud && SB.hud.toast) SB.hud.toast('♪ ' + st.name + ' · ' + S.radio.track);
  }
  SB.radio = {
    STATIONS: STATIONS,
    play: function (i) {
      i = ((Math.round(i) || 0) % STATIONS.length + STATIONS.length) % STATIONS.length;
      S.radio.station = i; trackIdx = 0; S.radio.playing = true; apply();
    },
    next: function () { SB.radio.play(S.radio.station + 1); },
    prev: function () { SB.radio.play(S.radio.station - 1); },
    nextTrack: function () { trackIdx++; apply(); },
    prevTrack: function () { trackIdx = Math.max(0, trackIdx - 1); apply(); },
    toggle: function () {
      S.radio.playing = !S.radio.playing;
      if (SB.audio && SB.audio.setPlaying) SB.audio.setPlaying(S.radio.playing);
      else if (S.radio.playing) SB.radio.play(S.radio.station);
    },
    current: function () { return { station: S.radio.station, name: S.radio.name, track: S.radio.track, playing: S.radio.playing }; },
    stationDef: function (i) { return STATIONS[i || 0]; }
  };
  window.addEventListener('keydown', function (e) {
    if (!S.started || S.paused) return;
    if (e.code === 'KeyQ') SB.radio.next();
    else if (e.code === 'KeyR') SB.radio.prev();
  });
})();
