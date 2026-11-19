// Solmar Bay — radio (B4, v4-rebuild r4). 3 stations, deterministic track lists.
// Switching station always changes the playing track (track resets to that station's first).
(function () {
  var SB = window.SB = window.SB || {};
  var STATIONS = [
    { name: 'WAVE 88.1', genre: 'SYNTHWAVE', tracks: ['Midnight Drive - Neon Palms', 'Sunset Strip - Vector Hold', 'Chrome Hearts - Laserhawk Nights', 'Palm Static - FM-84'] },
    { name: 'SOLMAR FM 101.5', genre: 'LATIN FUNK', tracks: ['Calle Ocho - Marisol Vega', 'Bayside Groove - Los Corales', 'Salsa Neon - DJ Palma', 'Marina Lights - Tito Bravo'] },
    { name: 'REBEL 99.9', genre: 'ROCK', tracks: ['Gasoline Heart - The Vultures', 'Highway Static - Iron Mercy', 'Night Run - Blacktop Saints', 'Full Throttle - Redline Choir'] }
  ];
  var station = 0, trackIdx = 0;

  function blip() { try { if (SB.audio && SB.audio.station) SB.audio.station(); } catch (e) {} }
  function toast(msg) { try { if (SB.hud && SB.hud.toast) SB.hud.toast(msg); } catch (e) {} }

  SB.radio = {
    version: '4.0.0-r4',
    stations: STATIONS,
    stationIndex: function () { return station; },
    trackIndex: function () { return trackIdx; },
    stationName: function () { return STATIONS[station].name; },
    genre: function () { return STATIONS[station].genre; },
    track: function () { return STATIONS[station].tracks[trackIdx]; },
    nowPlaying: function () {
      return { station: STATIONS[station].name, genre: STATIONS[station].genre, track: STATIONS[station].tracks[trackIdx] };
    },
    line: function () {
      var np = this.nowPlaying();
      return np.station + ' - ' + np.track;
    },
    setStation: function (i) {
      var n = STATIONS.length;
      var idx = ((i % n) + n) % n;
      if (idx === station && trackIdx === 0) return this.nowPlaying();
      station = idx; trackIdx = 0; // new station => new track, always
      blip(); toast('RADIO: ' + STATIONS[station].name);
      return this.nowPlaying();
    },
    nextStation: function () { return this.setStation(station + 1); },
    prevStation: function () { return this.setStation(station - 1); },
    nextTrack: function () {
      trackIdx = (trackIdx + 1) % STATIONS[station].tracks.length;
      blip(); return this.nowPlaying();
    }
  };
})();
