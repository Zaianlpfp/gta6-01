// Solmar Bay itself: a sun-soaked coastal city on a fixed 3200 x 2400 grid.
// Avenues run north-south, streets east-west; every block between them holds
// buildings, a park, or a landmark. The layout is generated once from a
// fixed seed, so every player (and every screenshot) sees the same city.
import { makeRng, pick, randInt, randRange, clamp } from './util.js';

export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 64;

// Avenues (x) and streets (y): the road centrelines.
export const AVENUES = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const STREETS = [200, 600, 1000, 1400, 1800, 2200];

const PALETTES = [
  ['#e8b48a', '#d99a6c', '#c98a5e'], // warm stucco
  ['#9db8c9', '#7fa3b8', '#b7ccd8'], // glass blue
  ['#d9c9a3', '#c9b183', '#e3d5b0'], // sandstone
  ['#b08a9e', '#96707f', '#c09aad'], // rose
  ['#8fa98a', '#74916f', '#a7bfa2'], // sage
];

export class City {
  constructor() {
    const rng = makeRng(1337);
    this.buildings = [];   // {x,y,w,h,hgt,color,roof,windows,landmark}
    this.plazas = [];      // paved block bases, so blocks read as city, not lawn
    this.parked = [];      // decorative parked cars along the roads
    this.trees = [];       // {x,y,r}
    this.boats = [];       // {x,y,angle,len,color}
    this.umbrellas = [];   // {x,y,color}
    this.landmarks = {};   // name -> {x,y,w,h,label}
    this.buildCity(rng);
  }

  buildCity(rng) {
    // Landmark blocks, named by their block (avenue index, street index).
    const lm = {
      bank: { ax: 2, ay: 1, label: 'SOLMAR NATIONAL BANK', color: '#cfc4a8' },
      hospital: { ax: 4, ay: 4, label: 'ST. MARIA HOSPITAL', color: '#e8e8e8' },
      police: { ax: 5, ay: 1, label: 'SOLMAR PD', color: '#7f9db8' },
      chopshop: { ax: 6, ay: 3, label: 'RUSTY ANCHOR GARAGE', color: '#a89a80' },
      safehouse: { ax: 1, ay: 4, label: "JAX'S PLACE", color: '#e8b48a' },
      hotel: { ax: 3, ay: 5, label: 'PALMS BEACH HOTEL', color: '#f2d8a0' },
      marina: { ax: 0, ay: 3, label: 'MARINA', color: '#9db8c9' },
      mall: { ax: 4, ay: 2, label: 'BAYFRONT MALL', color: '#c9b183' },
    };
    for (const [name, d] of Object.entries(lm)) {
      const bx = AVENUES[d.ax] + ROAD_W / 2;
      const by = STREETS[d.ay] + ROAD_W / 2;
      const bw = 400 - ROAD_W - 24;
      const bh = 400 - ROAD_W - 24;
      const b = { x: bx + 12, y: by + 12, w: bw, h: bh, hgt: name === 'hotel' ? 26 : 14, color: d.color, roof: '#5d5348', windows: [], landmark: name };
      this.landmarks[name] = { x: b.x + b.w / 2, y: b.y + b.h / 2, w: b.w, h: b.h, label: d.label };
      this.buildings.push(b);
    }
    // Ordinary blocks: 1-3 buildings each, with a seeded palette and height.
    // Downtown (near avenue 3-4, street 1-3) gets towers.
    for (let ai = 0; ai < AVENUES.length - 1; ai++) {
      for (let si = 0; si < STREETS.length - 1; si++) {
        const bx = AVENUES[ai] + ROAD_W / 2;
        const by = STREETS[si] + ROAD_W / 2;
        const bw = 400 - ROAD_W;
        const bh = 400 - ROAD_W;
        const isLm = Object.values(lm).some((d) => d.ax === ai && d.ay === si);
        if (isLm) continue;
        const downtown = ai >= 2 && ai <= 4 && si >= 1 && si <= 2;
        const park = rng() < 0.16;
        if (park) {
          for (let t = 0; t < 9; t++) {
            this.trees.push({ x: bx + randRange(rng, 30, bw - 30), y: by + randRange(rng, 30, bh - 30), r: randRange(rng, 10, 18) });
          }
          continue;
        }
        const n = randInt(rng, 2, 4);
        const pal = pick(rng, PALETTES);
        this.plazas.push({ x: bx, y: by, w: bw, h: bh });
        for (let k = 0; k < n; k++) {
          const w = randRange(rng, 110, 190);
          const h = randRange(rng, 110, 190);
          const x = bx + randRange(rng, 10, bw - w - 10);
          const y = by + randRange(rng, 10, bh - h - 10);
          const hgt = downtown ? randRange(rng, 30, 64) : randRange(rng, 8, 22);
          const wins = [];
          const cols = Math.floor(w / 26), rows = Math.floor(h / 26);
          for (let cx = 0; cx < cols; cx++) for (let cy = 0; cy < rows; cy++) {
            if (rng() < 0.42) wins.push({ dx: 12 + cx * 26, dy: 12 + cy * 26, lit: rng() < 0.25 });
          }
          this.buildings.push({ x, y, w, h, hgt, color: pick(rng, pal), roof: '#5d5348', windows: wins, landmark: null });
        }
        if (rng() < 0.6) {
          this.trees.push({ x: bx + randRange(rng, 20, bw - 20), y: by + randRange(rng, 20, bh - 20), r: randRange(rng, 9, 14) });
        }
      }
    }
    // Beach strip along the south edge: sand, umbrellas, palms.
    for (let i = 0; i < 26; i++) {
      const x = randRange(rng, 60, WORLD_W - 60);
      const y = randRange(rng, 2290, 2370);
      this.umbrellas.push({ x, y, color: pick(rng, ['#e85d5d', '#4d9de0', '#f2c14e', '#7bc96f']) });
      if (i % 2 === 0) this.trees.push({ x: x + randRange(rng, -30, 30), y: y - 18, r: 12 });
    }
    // Marina boats in the water west of the docks.
    for (let i = 0; i < 8; i++) {
      this.boats.push({ x: randRange(rng, 40, 150), y: randRange(rng, 1250, 1750), angle: randRange(rng, -0.4, 0.4), len: randRange(rng, 34, 58), color: pick(rng, ['#ffffff', '#e8e8e8', '#cfe8f2']) });
    }
    // Parked cars along the avenues and streets, for a lived-in look.
    const carColors = ['#c94f4f', '#4f7ec9', '#e8c84d', '#7bc96f', '#9b6fc9', '#e8e8e8', '#3a3a3a', '#e07b39'];
    for (let i = 0; i < 46; i++) {
      if (rng() < 0.5) {
        const ax = pick(rng, AVENUES);
        this.parked.push({ x: ax + (rng() < 0.5 ? -26 : 26), y: randRange(rng, 120, WORLD_H - 120), angle: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2, color: pick(rng, carColors) });
      } else {
        const sy = pick(rng, STREETS);
        this.parked.push({ x: randRange(rng, 120, WORLD_W - 120), y: sy + (rng() < 0.5 ? -26 : 26), angle: rng() < 0.5 ? 0 : Math.PI, color: pick(rng, carColors) });
      }
    }
    // Landmark blocks get paved bases too.
    for (const d of Object.values(this.landmarks)) {
      this.plazas.push({ x: d.x - d.w / 2, y: d.y - d.h / 2, w: d.w, h: d.h });
    }
  }

  // ---- geometry helpers used by traffic, peds, police and missions ----
  isRoad(x, y) {
    if (x < 0 || y < 0 || x > WORLD_W || y > WORLD_H) return false;
    for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_W / 2) return true;
    for (const sy of STREETS) if (Math.abs(y - sy) <= ROAD_W / 2) return true;
    return false;
  }
  // Nearest point on a road centreline + the road's direction (0 = E-W, 1 = N-S).
  nearestRoad(x, y) {
    let best = null, bd = Infinity, dir = 0;
    for (const ax of AVENUES) { const d = Math.abs(x - ax); if (d < bd) { bd = d; best = { x: ax, y: clamp(y, 0, WORLD_H) }; dir = 1; } }
    for (const sy of STREETS) { const d = Math.abs(y - sy); if (d < bd) { bd = d; best = { x: clamp(x, 0, WORLD_W), y: sy }; dir = 0; } }
    return { point: best, dir, dist: bd };
  }
  // A point on the sidewalk beside a road (peds walk here).
  sidewalkPoint(x, y) {
    const n = this.nearestRoad(x, y);
    const off = ROAD_W / 2 + 14;
    if (n.dir === 1) return { x: n.point.x + off, y: n.point.y };
    return { x: n.point.x, y: n.point.y + off };
  }
  collidesBuilding(x, y, r) {
    for (const b of this.buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
    }
    return null;
  }
  inWater(x, y) { return y > WORLD_H - 4 || x < 8; }
  randomRoadPoint(rng) {
    if (rng() < 0.5) return { x: pick(rng, AVENUES), y: randRange(rng, 100, WORLD_H - 100), dir: 1 };
    return { x: randRange(rng, 100, WORLD_W - 100), y: pick(rng, STREETS), dir: 0 };
  }

  // ---- drawing ----
  draw(ctx, cam, time) {
    const vx = cam.x - cam.w / 2, vy = cam.y - cam.h / 2;
    const vw = cam.w, vh = cam.h;
    // Ground: grass, then the beach strip and the sea.
    ctx.fillStyle = '#7fae62';
    ctx.fillRect(vx, vy, vw, vh);
    ctx.fillStyle = '#ecd9a0';
    ctx.fillRect(Math.max(vx, 0), 2260, Math.min(vw, WORLD_W), vh);
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(Math.max(vx, 0), WORLD_H - 2, Math.min(vw, WORLD_W), 4);
    ctx.fillStyle = '#2a6ea3';
    ctx.fillRect(Math.max(vx, 0), WORLD_H + 2, Math.min(vw, WORLD_W), Math.max(0, vy + vh - WORLD_H));
    // West water (the bay) beyond the marina.
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(vx, vy, Math.max(0, 8 - vx), vh);
    // Wave lines on the water.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const wy = WORLD_H + 14 + i * 16;
      if (wy < vy || wy > vy + vh) continue;
      ctx.beginPath();
      for (let x = Math.max(vx, 0); x < Math.min(vx + vw, WORLD_W); x += 40) {
        const yy = wy + Math.sin(x * 0.02 + time * 1.4 + i) * 3;
        if (x === Math.max(vx, 0)) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    this.drawRoads(ctx, vx, vy, vw, vh);
    // Paved block bases.
    for (const pl of this.plazas) {
      if (pl.x + pl.w < vx || pl.x > vx + vw || pl.y + pl.h < vy || pl.y > vy + vh) continue;
      ctx.fillStyle = '#a9a294';
      ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
    }
    // Parks: soft green circles under trees.
    for (const t of this.trees) {
      if (t.x < vx - 40 || t.x > vx + vw + 40 || t.y < vy - 40 || t.y > vy + vh + 40) continue;
      ctx.fillStyle = '#5d8f4a';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r + 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3f7a34';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5da24a';
      ctx.beginPath(); ctx.arc(t.x - 4, t.y - 4, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
    }
    // Buildings, with a sun shadow to the north-east and lit windows.
    for (const b of this.buildings) {
      if (b.x + b.w < vx || b.x > vx + vw || b.y + b.h < vy || b.y > vy + vh) continue;
      const sh = b.hgt * 0.5;
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x + sh * 0.5, b.y + sh * 0.5, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      for (const w of b.windows) {
        ctx.fillStyle = w.lit ? '#ffe9a8' : '#3a4a5a';
        ctx.fillRect(b.x + w.dx, b.y + w.dy, 12, 12);
      }
      if (b.landmark) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(b.x + 6, b.y + b.h / 2 - 11, b.w - 12, 22);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.landmarks[b.landmark].label, b.x + b.w / 2, b.y + b.h / 2 + 4);
      }
    }
    // Parked cars.
    for (const pc of this.parked) {
      if (pc.x < vx - 50 || pc.x > vx + vw + 50 || pc.y < vy - 50 || pc.y > vy + vh + 50) continue;
      ctx.save();
      ctx.translate(pc.x, pc.y);
      ctx.rotate(pc.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-19, -7, 44, 20);
      ctx.fillStyle = pc.color;
      ctx.beginPath();
      ctx.roundRect(-22, -10, 44, 20, 6);
      ctx.fill();
      ctx.fillStyle = 'rgba(30,40,55,0.85)';
      ctx.fillRect(4, -7, 8, 14);
      ctx.fillRect(-14, -7, 6, 14);
      ctx.restore();
    }
    // Beach umbrellas.
    for (const u of this.umbrellas) {
      if (u.x < vx - 40 || u.x > vx + vw + 40 || u.y < vy - 40 || u.y > vy + vh + 40) continue;
      ctx.strokeStyle = '#8a6f4d'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.x, u.y - 14); ctx.stroke();
      ctx.fillStyle = u.color;
      ctx.beginPath(); ctx.arc(u.x, u.y - 14, 13, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(u.x, u.y - 14, 13, Math.PI, 0); ctx.fill();
      ctx.fillStyle = u.color;
      ctx.beginPath(); ctx.moveTo(u.x, u.y - 14); ctx.arc(u.x, u.y - 14, 13, Math.PI * 1.15, Math.PI * 1.85); ctx.closePath(); ctx.fill();
    }
    // Marina boats.
    for (const bo of this.boats) {
      if (bo.x < vx - 80 || bo.x > vx + vw + 80 || bo.y < vy - 80 || bo.y > vy + vh + 80) continue;
      ctx.save();
      ctx.translate(bo.x, bo.y);
      ctx.rotate(bo.angle);
      ctx.fillStyle = bo.color;
      ctx.beginPath(); ctx.moveTo(-bo.len / 2, -8); ctx.lineTo(bo.len / 2, -8); ctx.lineTo(bo.len / 2 - 8, 8); ctx.lineTo(-bo.len / 2 + 8, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8a5a3b';
      ctx.fillRect(-6, -22, 3, 16);
      ctx.restore();
    }
  }

  drawRoads(ctx, vx, vy, vw, vh) {
    // Asphalt.
    ctx.fillStyle = '#3c3f45';
    for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2, Math.max(vy, 0), ROAD_W, Math.min(vh, WORLD_H - Math.max(vy, 0)));
    for (const sy of STREETS) ctx.fillRect(Math.max(vx, 0), sy - ROAD_W / 2, Math.min(vw, WORLD_W - Math.max(vx, 0)), ROAD_W);
    // Sidewalks: light border around each road.
    ctx.fillStyle = '#b9b3a4';
    for (const ax of AVENUES) {
      ctx.fillRect(ax - ROAD_W / 2 - 10, Math.max(vy, 0), 10, Math.min(vh, WORLD_H - Math.max(vy, 0)));
      ctx.fillRect(ax + ROAD_W / 2, Math.max(vy, 0), 10, Math.min(vh, WORLD_H - Math.max(vy, 0)));
    }
    for (const sy of STREETS) {
      ctx.fillRect(Math.max(vx, 0), sy - ROAD_W / 2 - 10, Math.min(vw, WORLD_W - Math.max(vx, 0)), 10);
      ctx.fillRect(Math.max(vx, 0), sy + ROAD_W / 2, Math.min(vw, WORLD_W - Math.max(vx, 0)), 10);
    }
    // Centre dashes.
    ctx.fillStyle = '#e8d44d';
    for (const ax of AVENUES) {
      for (let y = Math.max(0, Math.floor(vy / 36) * 36); y < vy + vh && y < WORLD_H; y += 36) {
        ctx.fillRect(ax - 2, y, 4, 18);
      }
    }
    for (const sy of STREETS) {
      for (let x = Math.max(0, Math.floor(vx / 36) * 36); x < vx + vw && x < WORLD_W; x += 36) {
        ctx.fillRect(x, sy - 2, 18, 4);
      }
    }
    // Crosswalks at every intersection.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const ax of AVENUES) for (const sy of STREETS) {
      if (ax < vx - 60 || ax > vx + vw + 60 || sy < vy - 60 || sy > vy + vh + 60) continue;
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(ax + i * 9 - 3, sy - ROAD_W / 2 + 4, 6, 12);
        ctx.fillRect(ax + i * 9 - 3, sy + ROAD_W / 2 - 16, 6, 12);
      }
    }
  }
}
