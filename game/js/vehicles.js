// Cars: player driving physics, traffic that follows the road grid, and
// police cruisers. A car is a circle of radius 16 for collisions; the
// drawing is a top-down body with windshield, roof and wheels.
import { clamp, lerp, angleDiff, turnToward, dist, makeRng, pick, randRange } from './util.js';
import { AVENUES, STREETS, WORLD_W, WORLD_H } from './city.js';

export const CAR_COLORS = ['#c94f4f', '#4f7ec9', '#e8c84d', '#7bc96f', '#9b6fc9', '#e8e8e8', '#3a3a3a', '#e07b39'];
export const TAXI_COLOR = '#f2c14e';
export const POLICE_COLOR = '#20242e';

let nextCarId = 1;

export class Car {
  constructor(x, y, angle, kind, color) {
    this.id = nextCarId++;
    this.x = x; this.y = y;
    this.angle = angle;
    this.speed = 0;
    this.kind = kind || 'sedan'; // sedan | taxi | sport | truck | police
    this.color = color || '#c94f4f';
    this.len = this.kind === 'truck' ? 52 : this.kind === 'sport' ? 42 : 44;
    this.wid = this.kind === 'truck' ? 24 : 20;
    this.maxSpeed = this.kind === 'sport' ? 540 : this.kind === 'truck' ? 320 : this.kind === 'police' ? 500 : 400;
    this.accel = this.kind === 'sport' ? 340 : 260;
    this.driver = null;   // a Ped, or 'player'
    this.health = 100;
    this.sirenOn = false;
    this.lightPhase = 0;
    this.stopped = false;
    this.hitCd = 0;       // seconds until the next crash may hurt this car
    this.crashCd = 0;
    // Traffic AI state.
    this.target = null;   // {x, y} intersection to drive to
    this.lane = 12;       // right-hand offset from the centreline
    this.wait = 0;
  }

  // Drive with throttle -1..1 and steer -1..1 (player input).
  drive(dt, throttle, steer, handbrake) {
    const grip = handbrake ? 0.94 : 0.995;
    this.speed *= Math.pow(grip, dt * 60);
    if (throttle > 0) this.speed += this.accel * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 20) this.speed -= this.accel * 1.4 * dt; // brake
      else this.speed -= this.accel * 0.55 * dt; // reverse
    }
    this.speed = clamp(this.speed, -this.maxSpeed * 0.45, this.maxSpeed);
    if (Math.abs(this.speed) > 8) {
      const steerRate = 2.6 * clamp(Math.abs(this.speed) / 220, 0.35, 1) * (this.speed < 0 ? -1 : 1);
      this.angle += steer * steerRate * dt * (handbrake ? 1.5 : 1);
    }
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this.x = clamp(this.x, 24, WORLD_W - 24);
    this.y = clamp(this.y, 24, WORLD_H - 24);
  }

  // Keep the car out of buildings and the sea. Crash damage has a
  // cooldown, so scraping along one wall does not shred the car.
  collideCity(city, dt) {
    this.hitCd = Math.max(0, this.hitCd - (dt || 0));
    const b = city.collidesBuilding(this.x, this.y, 16);
    if (b) {
      // Push out along the smallest overlap axis.
      const dxl = this.x + 16 - b.x, dxr = b.x + b.w - (this.x - 16);
      const dyt = this.y + 16 - b.y, dyb = b.y + b.h - (this.y - 16);
      const m = Math.min(dxl, dxr, dyt, dyb);
      if (m === dxl) this.x = b.x - 16;
      else if (m === dxr) this.x = b.x + b.w + 16;
      else if (m === dyt) this.y = b.y - 16;
      else this.y = b.y + b.h + 16;
      if (Math.abs(this.speed) > 120 && this.hitCd <= 0) { this.health -= 6; this.hitCd = 0.5; this.speed *= 0.4; }
      else this.speed *= 0.6;
      return true;
    }
    if (this.y > WORLD_H - 20) { this.y = WORLD_H - 20; this.speed *= 0.5; }
    if (this.x < 20) { this.x = 20; this.speed *= 0.5; }
    return false;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-this.len / 2 + 3, -this.wid / 2 + 4, this.len, this.wid);
    // Wheels.
    ctx.fillStyle = '#141414';
    const wl = this.len * 0.28, ww = 5;
    ctx.fillRect(-wl, -this.wid / 2 - 2, 12, ww);
    ctx.fillRect(wl - 8, -this.wid / 2 - 2, 12, ww);
    ctx.fillRect(-wl, this.wid / 2 - 3, 12, ww);
    ctx.fillRect(wl - 8, this.wid / 2 - 3, 12, ww);
    // Body.
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.roundRect(-this.len / 2, -this.wid / 2, this.len, this.wid, 6);
    ctx.fill();
    // Police livery.
    if (this.kind === 'police') {
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(-this.len / 2 + 4, -this.wid / 2, this.len * 0.45, this.wid);
      ctx.fillStyle = '#20242e';
      ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 3);
      const ph = Math.floor(performance.now() / 180) % 2 === 0;
      ctx.fillStyle = ph ? '#ff2e2e' : '#2e6bff';
      ctx.fillRect(-6, -this.wid / 2 - 3, 6, 5);
      ctx.fillStyle = ph ? '#2e6bff' : '#ff2e2e';
      ctx.fillRect(0, -this.wid / 2 - 3, 6, 5);
    }
    if (this.kind === 'taxi') {
      ctx.fillStyle = '#20242e';
      ctx.fillRect(-this.len / 2 + 2, -this.wid / 2 + 2, 10, 4);
      ctx.fillRect(-this.len / 2 + 2, this.wid / 2 - 6, 10, 4);
      ctx.fillStyle = '#20242e';
      ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center';
      ctx.fillText('TAXI', 2, 3);
    }
    // Windshield + roof + rear window.
    ctx.fillStyle = 'rgba(30,40,55,0.85)';
    ctx.fillRect(this.len * 0.18, -this.wid / 2 + 3, 8, this.wid - 6);
    ctx.fillRect(-this.len * 0.32, -this.wid / 2 + 3, 6, this.wid - 6);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(-this.len * 0.14, -this.wid / 2 + 3, this.len * 0.28, this.wid - 6);
    // Headlights.
    ctx.fillStyle = '#fff8c9';
    ctx.fillRect(this.len / 2 - 2, -this.wid / 2 + 2, 3, 5);
    ctx.fillRect(this.len / 2 - 2, this.wid / 2 - 7, 3, 5);
    ctx.restore();
  }
}

// Traffic: cars that drive the road grid, stop for the car ahead, and pick
// a new direction at each intersection.
export class Traffic {
  constructor(city) {
    this.city = city;
    this.cars = [];
    this.rng = makeRng(4242);
    for (let i = 0; i < 26; i++) this.spawnFar(0, 0, 0);
  }
  spawnFar(px, py, minDist) {
    const rng = this.rng;
    for (let tries = 0; tries < 12; tries++) {
      const p = this.city.randomRoadPoint(rng);
      if (dist(p.x, p.y, px, py) < minDist) continue;
      const kind = rng() < 0.12 ? 'taxi' : rng() < 0.1 ? 'truck' : rng() < 0.12 ? 'sport' : 'sedan';
      const angle = p.dir === 1 ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
      const car = new Car(p.x, p.y, angle, kind, kind === 'taxi' ? TAXI_COLOR : pick(rng, CAR_COLORS));
      car.target = this.nextIntersection(car);
      this.cars.push(car);
      return car;
    }
    return null;
  }
  nextIntersection(car) {
    // Drive to the next intersection along the current heading.
    const x = car.x, y = car.y;
    const horiz = Math.abs(Math.cos(car.angle)) > 0.7;
    if (horiz) {
      const dir = Math.cos(car.angle) > 0 ? 1 : -1;
      const cands = AVENUES.filter((ax) => (dir > 0 ? ax > x + 30 : ax < x - 30));
      const nx = dir > 0 ? Math.min(...cands) : Math.max(...cands);
      return { x: nx, y: Math.round(y / 400) * 400 < 0 ? y : this.snapStreet(y) };
    }
    const dir = Math.sin(car.angle) > 0 ? 1 : -1;
    const cands = STREETS.filter((sy) => (dir > 0 ? sy > y + 30 : sy < y - 30));
    const ny = dir > 0 ? Math.min(...cands) : Math.max(...cands);
    return { x: this.snapAvenue(x), y: ny };
  }
  snapStreet(y) {
    let best = STREETS[0], bd = Infinity;
    for (const s of STREETS) { const d = Math.abs(s - y); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  snapAvenue(x) {
    let best = AVENUES[0], bd = Infinity;
    for (const a of AVENUES) { const d = Math.abs(a - x); if (d < bd) { bd = d; best = a; } }
    return best;
  }
  update(dt, playerPos, allCars) {
    const rng = this.rng;
    // Keep the streets busy near the player, thin out far away.
    if (this.cars.length < 30 && rng() < dt * 0.5) this.spawnFar(playerPos.x, playerPos.y, 700);
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      if (dist(car.x, car.y, playerPos.x, playerPos.y) > 1500 && this.cars.length > 22) {
        this.cars.splice(i, 1);
        continue;
      }
      this.driveTraffic(car, dt, allCars);
    }
  }
  driveTraffic(car, dt, allCars) {
    if (car.wait > 0) { car.wait -= dt; car.speed = lerp(car.speed, 0, dt * 6); car.x += Math.cos(car.angle) * car.speed * dt; car.y += Math.sin(car.angle) * car.speed * dt; return; }
    if (!car.target) car.target = this.nextIntersection(car);
    const t = car.target;
    const d = dist(car.x, car.y, t.x, t.y);
    if (d < 26) {
      // At the intersection: turn onto a new road (or go straight).
      const horiz = Math.abs(Math.cos(car.angle)) > 0.7;
      const options = [];
      if (horiz) {
        options.push({ a: car.angle, x: t.x, y: t.y });
        if (t.y > 300) options.push({ a: -Math.PI / 2, x: t.x, y: t.y });
        if (t.y < WORLD_H - 300) options.push({ a: Math.PI / 2, x: t.x, y: t.y });
      } else {
        options.push({ a: car.angle, x: t.x, y: t.y });
        if (t.x > 300) options.push({ a: Math.PI, x: t.x, y: t.y });
        if (t.x < WORLD_W - 300) options.push({ a: 0, x: t.x, y: t.y });
      }
      const o = pick(this.rng, options);
      car.angle = o.a;
      car.target = this.nextIntersection(car);
      if (this.rng() < 0.12) car.wait = randRange(this.rng, 0.5, 1.4);
      return;
    }
    // Lane offset: keep right.
    const want = Math.atan2(t.y - car.y, t.x - car.x);
    const laneX = t.x + Math.cos(want + Math.PI / 2) * car.lane;
    const laneY = t.y + Math.sin(want + Math.PI / 2) * car.lane;
    const ta = Math.atan2(laneY - car.y, laneX - car.x);
    car.angle = turnToward(car.angle, ta, 2.4 * dt);
    // Slow for the car ahead.
    let ahead = Infinity;
    for (const o of allCars) {
      if (o === car) continue;
      const dd = dist(car.x, car.y, o.x, o.y);
      if (dd < 90) {
        const ang = Math.atan2(o.y - car.y, o.x - car.x);
        if (Math.abs(angleDiff(car.angle, ang)) < 0.7) ahead = Math.min(ahead, dd);
      }
    }
    const targetSpeed = ahead < 70 ? 0 : (car.kind === 'truck' ? 130 : 165);
    car.speed = lerp(car.speed, targetSpeed, dt * 1.2);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.collideCity(this.city, dt);
  }
  // Simple circle push-apart between every pair of cars. Crash damage
  // goes through the callback at most once per 0.6 s per car, so a long
  // shove does not shred a car frame by frame.
  resolveCollisions(allCars, onCrash, dt) {
    for (const c of allCars) c.crashCd = Math.max(0, c.crashCd - (dt || 0));
    for (let i = 0; i < allCars.length; i++) {
      for (let j = i + 1; j < allCars.length; j++) {
        const a = allCars[i], b = allCars[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 30 && d > 0.01) {
          const push = (30 - d) / 2;
          const nx = dx / d, ny = dy / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
          const rel = Math.abs(a.speed - b.speed);
          if (rel > 160 && onCrash && (a.crashCd <= 0 || b.crashCd <= 0)) {
            onCrash(a, b, rel);
            a.crashCd = 0.6; b.crashCd = 0.6;
          }
          a.speed *= 0.985; b.speed *= 0.985;
        }
      }
    }
  }
}
