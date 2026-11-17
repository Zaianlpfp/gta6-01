// Small math + seeded-random helpers shared by every system of Solmar Bay.
// The city and every scene use one fixed seed, so two runs draw the same world.
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function dist(ax, ay, bx, by) { return Math.sqrt(dist2(ax, ay, bx, by)); }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function turnToward(a, b, maxStep) {
  const d = angleDiff(a, b);
  return a + clamp(d, -maxStep, maxStep);
}
// mulberry32: tiny deterministic PRNG, seeded once for the whole city.
export function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function randRange(rng, a, b) { return a + rng() * (b - a); }
export function randInt(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
// Format dollars with commas, e.g. 1540 -> $1,540.
export function money(n) { return '$' + Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
// RGB helper used by the day-cycle tint.
export function rgba(r, g, b, a) { return 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + a + ')'; }
