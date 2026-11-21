// save.js — Solmar Bay (gta6-01 v4 r14)
// Save/load localStorage. Key TETAP: 'solmar-bay-save-v1'.
// Isi: { cash, rep, missionsDone:[ids], hero:{x,z} }.
// Ditulis FRESH dari game/API.md §14. localStorage HANYA dipakai di file ini.
import { SB } from './engine.js';

SB.save = {
  key: 'solmar-bay-save-v1',
  _lastRep: 0,      // REP terakhir saat autosave-watch berjalan
  _watching: false,

  // Simpan progres saat ini. Return true bila tersimpan.
  save() {
    try {
      const data = {
        cash: SB.state.cash,
        rep: SB.state.rep,
        missionsDone: (SB.missions && SB.missions.completed) ? SB.missions.completed.slice() : [],
        hero: { x: SB.state.hero.x, z: SB.state.hero.z },
      };
      window.localStorage.setItem(SB.save.key, JSON.stringify(data));
      SB.save._lastRep = SB.state.rep;
      return true;
    } catch (e) { return false; }
  },

  // Muat save. Return data bila ada dan valid, null bila tidak ada/rusak.
  // Load gagal -> default aman (null; pemanggil memakai state awal).
  load() {
    try {
      const raw = window.localStorage.getItem(SB.save.key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (typeof data !== 'object' || data === null) return null;
      return {
        cash: typeof data.cash === 'number' ? data.cash : 500,
        rep: typeof data.rep === 'number' ? data.rep : 0,
        missionsDone: Array.isArray(data.missionsDone) ? data.missionsDone : [],
        hero: (data.hero && typeof data.hero.x === 'number' && typeof data.hero.z === 'number')
          ? { x: data.hero.x, z: data.hero.z } : { x: 0, z: 40 },
      };
    } catch (e) { return null; }
  },

  // Terapkan data save ke SB.state (dipanggil tombol Continue di start screen).
  apply(data) {
    if (!data) return false;
    SB.state.cash = data.cash;
    SB.state.rep = data.rep;
    if (SB.missions && SB.missions.completed) {
      SB.missions.completed = data.missionsDone.slice();
    }
    if (SB._inCity(data.hero.x, data.hero.z)) {
      SB.state.hero.x = data.hero.x;
      SB.state.hero.z = data.hero.z;
    }
    SB.save._lastRep = data.rep;
    return true;
  },

  // Hapus save.
  clear() {
    try { window.localStorage.removeItem(SB.save.key); return true; }
    catch (e) { return false; }
  },

  // Ada save tersimpan? (untuk tombol Continue di start screen.)
  hasSave() {
    try { return window.localStorage.getItem(SB.save.key) !== null; }
    catch (e) { return false; }
  },

  // Autosave tiap misi selesai: REP naik +100 per misi (API.md §10), jadi
  // pantau perubahan REP lewat registerUpdate; bila naik -> save().
  startAutosaveWatch() {
    if (SB.save._watching) return;
    SB.save._watching = true;
    SB.save._lastRep = SB.state.rep;
    if (SB.registerUpdate) {
      SB.registerUpdate(() => {
        if (SB.state.rep !== SB.save._lastRep) SB.save.save();
      });
    }
  },
};

export { SB };
