// Save and load for Solmar Bay, via localStorage. One slot, autosaved on
// every mission complete and from the pause menu. A save holds the cash,
// the story progress, the coins, the player's spot and the clock — never
// anything the server would need.
const KEY = 'solmar-bay-save-v1';

export function saveGameData(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}
export function loadGameData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d !== 'object' || d === null) return null;
    return d;
  } catch (e) {
    return null;
  }
}
export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
}
export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* storage unavailable */ }
}
