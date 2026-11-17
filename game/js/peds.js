// Pedestrians: they walk the sidewalks, wait at corners, flee gunfire, and
// one of them is always looking for a taxi. Each ped is a coloured dot with
// a head, drawn top-down, with a little walk bob.
import { makeRng, pick, randRange, randInt, dist, angleTo, turnToward, clamp } from './util.js';

const SHIRTS = ['#e85d5d', '#4d9de0', '#f2c14e', '#7bc96f', '#c96fb0', '#e8e8e8', '#e07b39', '#6f9dc9'];
const SKINS = ['#f2c9a0', '#d9a06c', '#a06a3b', '#8a5a2e', '#e8b48a'];

export class Ped {
  constructor(x, y, rng) {
    this.x = x; this.y = y;
    this.angle = rng() * Math.PI * 2;
    this.speed = randRange(rng, 45, 80);
    this.shirt = pick(rng, SHIRTS);
    this.skin = pick(rng, SKINS);
    this.pants = pick(rng, ['#2e3a4d', '#4d3a2e', '#3a4d2e', '#5a2e3a']);
    this.target = null;
    this.wait = randRange(rng, 0, 3);
    this.fleeing = 0;
    this.dead = false;
    this.taxi = false;      // wants a cab
    this.taxiTimer = 0;
    this.walkPhase = rng() * 10;
    this.inCar = null;      // the Car this ped drives, if any
  }
  update(dt, city, danger) {
    if (this.dead || this.inCar) return;
    this.walkPhase += dt * 8;
    if (danger) {
      // Flee from gunfire or a speeding car.
      this.fleeing = 1.5;
      this.target = { x: this.x + (this.x - danger.x) * 2, y: this.y + (this.y - danger.y) * 2 };
    }
    if (this.fleeing > 0) {
      this.fleeing -= dt;
      const a = angleTo(this.x, this.y, this.target.x, this.target.y);
      this.angle = turnToward(this.angle, a, 6 * dt);
      const sp = 190;
      const nx = this.x + Math.cos(this.angle) * sp * dt;
      const ny = this.y + Math.sin(this.angle) * sp * dt;
      if (!city.collidesBuilding(nx, ny, 10) && !city.inWater(nx, ny)) { this.x = nx; this.y = ny; }
      return;
    }
    if (this.wait > 0) { this.wait -= dt; return; }
    if (!this.target) {
      const sp = city.sidewalkPoint(this.x + (Math.random() - 0.5) * 300, this.y + (Math.random() - 0.5) * 300);
      this.target = sp;
    }
    const d = dist(this.x, this.y, this.target.x, this.target.y);
    if (d < 12) { this.target = null; this.wait = randRange(Math.random, 0.5, 4); return; }
    const a = angleTo(this.x, this.y, this.target.x, this.target.y);
    this.angle = turnToward(this.angle, a, 4 * dt);
    const nx = this.x + Math.cos(this.angle) * this.speed * dt;
    const ny = this.y + Math.sin(this.angle) * this.speed * dt;
    if (!city.collidesBuilding(nx, ny, 10) && !city.inWater(nx, ny)) { this.x = nx; this.y = ny; }
    else { this.target = null; }
  }
  draw(ctx) {
    if (this.dead || this.inCar) return;
    const bob = Math.sin(this.walkPhase) * 1.5;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(2, 3, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(this.angle);
    // Legs (two dots that swing while walking).
    ctx.fillStyle = this.pants;
    ctx.beginPath(); ctx.arc(-4 + bob, -4, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-4 - bob, 4, 3.4, 0, Math.PI * 2); ctx.fill();
    // Body + head.
    ctx.fillStyle = this.shirt;
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = this.skin;
    ctx.beginPath(); ctx.arc(4, 0, 4.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (this.taxi) {
      ctx.fillStyle = '#f2c14e';
      ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
      ctx.fillText('$', this.x, this.y - 16);
    }
  }
}

export class PedCrowd {
  constructor(city) {
    this.city = city;
    this.peds = [];
    this.rng = makeRng(777);
    for (let i = 0; i < 42; i++) this.spawnFar(0, 0, 0);
  }
  spawnFar(px, py, minDist) {
    const rng = this.rng;
    for (let tries = 0; tries < 10; tries++) {
      const p = this.city.randomRoadPoint(rng);
      const s = this.city.sidewalkPoint(p.x, p.y);
      if (dist(s.x, s.y, px, py) < minDist) continue;
      const ped = new Ped(s.x, s.y, rng);
      if (rng() < 0.08) { ped.taxi = true; ped.taxiTimer = 60; }
      this.peds.push(ped);
      return ped;
    }
    return null;
  }
  update(dt, playerPos, danger) {
    const rng = this.rng;
    if (this.peds.filter((p) => !p.dead && !p.inCar).length < 46 && rng() < dt * 0.8) {
      this.spawnFar(playerPos.x, playerPos.y, 650);
    }
    for (let i = this.peds.length - 1; i >= 0; i--) {
      const p = this.peds[i];
      if (p.dead) { p.deadTimer = (p.deadTimer || 0) + dt; if (p.deadTimer > 25) this.peds.splice(i, 1); continue; }
      if (dist(p.x, p.y, playerPos.x, playerPos.y) > 1600) { this.peds.splice(i, 1); continue; }
      if (p.taxi) { p.taxiTimer -= dt; if (p.taxiTimer <= 0) { p.taxi = false; } }
      p.update(dt, this.city, danger);
    }
  }
  nearestTaxiPed(x, y, maxD) {
    let best = null, bd = maxD;
    for (const p of this.peds) {
      if (!p.taxi || p.dead || p.inCar) continue;
      const d = dist(x, y, p.x, p.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  draw(ctx) { for (const p of this.peds) p.draw(ctx); }
}
