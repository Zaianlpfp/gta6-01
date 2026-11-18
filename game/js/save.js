// Solmar Bay — save.js
// One job: save + load through localStorage — cash, REP, mission progress,
// sun coins, clock, health, armor and ammo. Autosaves after every job.
'use strict';

const SaveGame = {
  KEY: 'solmarbay-save-v2',

  snapshot() {
    return {
      v: 2, cash: G.cash, rep: G.rep, day: G.day, minutes: G.minutes,
      health: G.player.health, armor: G.player.armor,
      missionsDone: G.missionsDone, coins: G.stats.coins,
      coinsTaken: City.coinMeshes.map(c => c.taken),
      reserve: Combat.reserve, mag: Combat.mag,
      player: { x: G.player.x, z: G.player.z },
    };
  },

  autosave() { this.write(this.snapshot()); },
  manualSave() { this.write(this.snapshot()); showToast('GAME SAVED'); AudioSys.pickup(); },

  write(data) {
    try { localStorage.setItem(this.KEY, JSON.stringify(data)); } catch (e) { /* storage full/blocked: play on */ }
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || d.v !== 2) return null;
      return d;
    } catch (e) { return null; }
  },

  apply(d) {
    G.cash = d.cash; G.rep = d.rep; G.day = d.day; G.minutes = d.minutes;
    G.player.health = d.health; G.player.armor = d.armor || 0;
    G.missionsDone = d.missionsDone || 0;
    G.stats.coins = d.coins || 0;
    Missions.done = {};
    for (let i = 1; i <= (d.missionsDone || 0); i++) Missions.done[i] = true;
    if (Array.isArray(d.coinsTaken)) d.coinsTaken.forEach((t, i) => {
      if (t && City.coinMeshes[i]) {
        City.coinMeshes[i].taken = true;
        if (City.coinMeshes[i].mesh.parent) City.coinMeshes[i].mesh.parent.remove(City.coinMeshes[i].mesh);
      }
    });
    if (d.reserve) Combat.reserve = Object.assign(Combat.reserve, d.reserve);
    if (d.mag) Combat.mag = Object.assign(Combat.mag, d.mag);
    if (d.player) { G.player.x = d.player.x; G.player.z = d.player.z; }
  },

  hasSave() { return !!this.load(); },
  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* ignore */ } },
};
