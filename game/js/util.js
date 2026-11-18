// Solmar Bay — util.js
// One job: tiny shared helpers (random, math, formatting, seeded RNG).
'use strict';

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist2d(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
function fmtCash(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
function fmtTime(mins) {
  const h = Math.floor(mins / 60) % 24, m = Math.floor(mins % 60);
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}
function fmtClock(day, mins) { return TUNE.days[(day - 1) % 7] + ' ' + fmtTime(mins); }
function pick(arr, rnd) { return arr[Math.floor(rnd() * arr.length)]; }

// Mulberry32 — deterministic RNG so the city layout is identical every load.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Small canvas-texture factory: building facades, neon signs, road markings.
function makeCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}
function hexCss(hex) { return '#' + hex.toString(16).padStart(6, '0'); }
