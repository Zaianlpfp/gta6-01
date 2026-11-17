// The wanted system: 0-5 stars, police cruisers that chase and ram, and
// foot cops who arrest or shoot. Heat rises on witnessed crimes and cools
// when no cop can see the player. Busted or wasted sends Jax to St. Maria
// Hospital, lighter by some cash.
import { clamp, dist, angleTo, turnToward, makeRng, pick } from './util.js';
import { Car } from './vehicles.js';

export class Police {
  constructor(city) {
    this.city = city;
    this.wanted = 0;          // 0..5 stars
    this.heat = 0;            // 0..100, drives the star count
    this.cars = [];           // police cruisers in play
    this.cops = [];           // on-foot cops {x,y,angle,health}
    this.rng = makeRng(31337);
    this.spawnTimer = 0;
    this.coolTimer = 0;
    this.lastSeenTimer = 0;   // seconds since a cop saw the player
    this.busted = false;
  }
  get stars() { return this.wanted; }

  addHeat(amount, reason) {
    this.heat = clamp(this.heat + amount, 0, 100);
    const stars = this.heat <= 0 ? 0 : this.heat < 18 ? 1 : this.heat < 38 ? 2 : this.heat < 58 ? 3 : this.heat < 80 ? 4 : 5;
    if (stars > this.wanted) this.lastSeenTimer = 0;
    this.wanted = stars;
  }
  // A crime: amount of heat by kind. Witnessed crimes count double.
  crime(kind, witnessed) {
    const base = { steal: 22, shoot: 16, kill: 30, hitCop: 34, hitPed: 20, ram: 8 }[kind] || 10;
    this.addHeat(witnessed ? base : base * 0.5, kind);
  }
  // Is any cop or cruiser close enough to see the player?
  anyCopNear(x, y, range) {
    for (const c of this.cars) if (dist(c.x, c.y, x, y) < range) return true;
    for (const c of this.cops) if (dist(c.x, c.y, x, y) < range) return true;
    return false;
  }
  update(dt, player, city, allCars, bullets, onEvent) {
    // Heat cools when nobody sees the player.
    if (this.wanted > 0) {
      if (this.anyCopNear(player.x, player.y, 420)) this.lastSeenTimer = 0;
      else {
        this.lastSeenTimer += dt;
        if (this.lastSeenTimer > 7) {
          this.coolTimer += dt;
          if (this.coolTimer > 6) { this.coolTimer = 0; this.heat = Math.max(0, this.heat - 18); this.wanted = this.heat <= 0 ? 0 : this.heat < 18 ? 1 : this.heat < 38 ? 2 : this.heat < 58 ? 3 : this.heat < 80 ? 4 : 5; }
        }
      }
    }
    // Spawn cruisers up to the wanted level's count.
    const wantCars = this.wanted === 0 ? 0 : this.wanted <= 2 ? this.wanted : this.wanted === 3 ? 3 : 4;
    this.spawnTimer -= dt;
    if (this.cars.length < wantCars && this.spawnTimer <= 0) {
      this.spawnTimer = 1.2;
      const a = this.rng() * Math.PI * 2;
      const d = 620 + this.rng() * 200;
      const p = city.nearestRoad(player.x + Math.cos(a) * d, player.y + Math.sin(a) * d);
      const car = new Car(p.point.x, p.point.y, angleTo(p.point.x, p.point.y, player.x, player.y), 'police', '#20242e');
      car.sirenOn = true;
      this.cars.push(car);
      allCars.push(car);
    }
    // Spawn a foot cop when the player is on foot and wanted.
    if (this.wanted >= 1 && !player.driving && this.cops.length < Math.min(2, this.wanted) && this.rng() < dt * 0.4) {
      const a = this.rng() * Math.PI * 2;
      this.cops.push({ x: player.x + Math.cos(a) * 300, y: player.y + Math.sin(a) * 300, angle: 0, health: 40, shootCd: 0 });
    }
    // Chase: cruisers ram the player's car (or the player on foot).
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      if (this.wanted === 0) {
        // Stand down: drive off and despawn.
        car.speed = Math.max(0, car.speed - 200 * dt);
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;
        if (dist(car.x, car.y, player.x, player.y) > 900 || car.speed <= 0.5) {
          this.cars.splice(i, 1);
          const idx = allCars.indexOf(car);
          if (idx >= 0) allCars.splice(idx, 1);
        }
        continue;
      }
      const want = angleTo(car.x, car.y, player.x, player.y);
      car.angle = turnToward(car.angle, want, 3.2 * dt);
      const targetSpeed = Math.min(car.maxSpeed, 380 + this.wanted * 30);
      car.speed += (targetSpeed - car.speed) * dt * 0.9;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.collideCity(city, dt);
      // Ram the player (damage at most twice a second per cruiser).
      const d = dist(car.x, car.y, player.x, player.y);
      if (d < 34 && car.crashCd <= 0) {
        car.crashCd = 0.5;
        if (player.driving && player.inCar) {
          player.inCar.health -= 2;
          player.inCar.speed *= 0.7;
          if (player.inCar.health <= 0) { player.exitCar(); onEvent('carWrecked'); }
        } else {
          player.takeDamage(9, true);
        }
        if (player.health <= 0) onEvent('wasted');
      }
    }
    // Foot cops: chase, punch up close, shoot at 3+ stars.
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const cop = this.cops[i];
      if (this.wanted === 0 || cop.health <= 0) { this.cops.splice(i, 1); continue; }
      if (player.driving) { this.cops.splice(i, 1); continue; }
      const d = dist(cop.x, cop.y, player.x, player.y);
      cop.angle = turnToward(cop.angle, angleTo(cop.x, cop.y, player.x, player.y), 5 * dt);
      if (d > 26) {
        const sp = this.wanted >= 3 ? 175 : 150;
        const nx = cop.x + Math.cos(cop.angle) * sp * dt;
        const ny = cop.y + Math.sin(cop.angle) * sp * dt;
        if (!city.collidesBuilding(nx, ny, 10)) { cop.x = nx; cop.y = ny; }
      } else if (this.wanted <= 2) {
        // Arrest attempt: drains health fast up close.
        player.takeDamage(14 * dt, true);
        if (player.health <= 24 && !this.busted) { this.busted = true; onEvent('busted'); }
      }
      cop.shootCd -= dt;
      if (this.wanted >= 3 && d < 420 && d > 60 && cop.shootCd <= 0) {
        cop.shootCd = 1.1;
        const a = angleTo(cop.x, cop.y, player.x, player.y) + (this.rng() - 0.5) * 0.16;
        bullets.push({ x: cop.x, y: cop.y, angle: a, speed: 800, life: 0.6, friendly: false, update(dt) { this.x += Math.cos(this.angle) * this.speed * dt; this.y += Math.sin(this.angle) * this.speed * dt; this.life -= dt; }, draw(ctx) { ctx.strokeStyle = '#ffb08a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(this.x - Math.cos(this.angle) * 10, this.y - Math.sin(this.angle) * 10); ctx.lineTo(this.x, this.y); ctx.stroke(); } });
      }
    }
  }
  draw(ctx) {
    for (const cop of this.cops) {
      ctx.save();
      ctx.translate(cop.x, cop.y);
      ctx.rotate(cop.angle);
      ctx.fillStyle = '#1c2f57';
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8b48a';
      ctx.beginPath(); ctx.arc(5, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1c2f57';
      ctx.beginPath(); ctx.arc(5, 0, 5, Math.PI * 0.6, Math.PI * 1.5); ctx.fill();
      ctx.restore();
    }
  }
  resetAfterBust() {
    this.heat = 0; this.wanted = 0; this.busted = false;
    this.cops = [];
  }
}
