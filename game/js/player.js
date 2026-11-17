// The player on foot: Jax Marlowe. WASD to walk, mouse to aim, click to
// shoot the pistol, E to get in a car (or pull a driver out), Shift to run.
// Bullets are simple tracers with a short life; hitting a ped or a cop
// raises the wanted level through the game's crime callback.
import { clamp, dist, angleTo } from './util.js';

export class Bullet {
  constructor(x, y, angle, friendly) {
    this.x = x; this.y = y;
    this.angle = angle;
    this.speed = 900;
    this.life = 0.55;
    this.friendly = friendly;
  }
  update(dt) {
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this.life -= dt;
  }
  draw(ctx) {
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(this.x - Math.cos(this.angle) * 12, this.y - Math.sin(this.angle) * 12);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
  }
}

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.angle = -Math.PI / 2;
    this.aimAngle = -Math.PI / 2;
    this.speed = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.armor = 0;
    this.cash = 120;
    this.inCar = null;      // the Car being driven
    this.ammo = 48;
    this.shootCooldown = 0;
    this.walkPhase = 0;
    this.hurtFlash = 0;
    this.dead = false;
  }
  get pos() { return { x: this.x, y: this.y }; }
  get driving() { return !!this.inCar; }

  update(dt, input, city, cam, onCrime) {
    if (this.dead) return;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if (this.inCar) {
      // The car drives; the player rides along.
      this.x = this.inCar.x;
      this.y = this.inCar.y;
      this.angle = this.inCar.angle;
      return;
    }
    const ax = input.axes();
    const run = input.down('ShiftLeft', 'ShiftRight') ? 1.55 : 1;
    const sp = 185 * run;
    let mx = ax.x, my = ax.y;
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }
    this.walkPhase += dt * (len > 0 ? 10 * run : 0);
    const nx = this.x + mx * sp * dt;
    const ny = this.y + my * sp * dt;
    if (!city.collidesBuilding(nx, this.y, 11) && !city.inWater(nx, this.y)) this.x = nx;
    if (!city.collidesBuilding(this.x, ny, 11) && !city.inWater(this.x, ny)) this.y = ny;
    // Aim at the mouse (world coordinates).
    const wx = cam.x - cam.w / 2 + input.mouseX;
    const wy = cam.y - cam.h / 2 + input.mouseY;
    this.aimAngle = angleTo(this.x, this.y, wx, wy);
    if (len > 0) this.angle = Math.atan2(my, mx);
    else this.angle = this.aimAngle;
  }
  tryShoot(input, bullets) {
    if (this.dead || this.inCar || this.shootCooldown > 0 || this.ammo <= 0) return false;
    // mouseDown is hold-to-fire; clicked catches a single quick tap, which
    // can otherwise fall between two frames and never fire.
    if (!input.mouseDown && !input.clicked) return false;
    this.shootCooldown = 0.22;
    this.ammo--;
    const bx = this.x + Math.cos(this.aimAngle) * 16;
    const by = this.y + Math.sin(this.aimAngle) * 16;
    bullets.push(new Bullet(bx, by, this.aimAngle + (Math.random() - 0.5) * 0.05, true));
    return true;
  }
  // E near a car: get in (steal it if it has a driver). Returns the car or null.
  tryEnterCar(cars, onCrime) {
    if (this.dead || this.inCar) return null;
    let best = null, bd = 70;
    for (const c of cars) {
      const d = dist(this.x, this.y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    if (!best) return null;
    if (best.driver) {
      // Pull the driver out and take the car — a crime if anyone sees.
      const driver = best.driver;
      driver.inCar = null;
      driver.x = best.x + 34; driver.y = best.y + 24;
      driver.fleeing = 2;
      best.driver = 'player';
      onCrime('steal', best);
    } else {
      best.driver = 'player';
    }
    this.inCar = best;
    return best;
  }
  exitCar() {
    if (!this.inCar) return;
    const car = this.inCar;
    car.driver = null;
    car.speed *= 0.3;
    this.x = car.x - Math.sin(car.angle) * 30;
    this.y = car.y + Math.cos(car.angle) * 30;
    this.inCar = null;
  }
  takeDamage(amount, fromCop) {
    if (this.dead) return;
    let left = amount;
    if (this.armor > 0) { const absorbed = Math.min(this.armor, left); this.armor -= absorbed; left -= absorbed; }
    this.health -= left;
    this.hurtFlash = 0.35;
    if (this.health <= 0) { this.health = 0; this.dead = true; }
  }
  heal(amount) { this.health = clamp(this.health + amount, 0, this.maxHealth); }
  draw(ctx) {
    if (this.dead || this.inCar) return;
    const bob = Math.sin(this.walkPhase) * 1.6;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(2, 3, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(this.angle);
    ctx.fillStyle = '#2e3a4d';
    ctx.beginPath(); ctx.arc(-4 + bob, -4.5, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-4 - bob, 4.5, 3.6, 0, Math.PI * 2); ctx.fill();
    // Jax: teal jacket, the one constant in the story.
    ctx.fillStyle = '#1f8a70';
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath(); ctx.arc(5, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#20242e';
    ctx.beginPath(); ctx.arc(5, 0, 5, Math.PI * 0.6, Math.PI * 1.5); ctx.fill();
    // Pistol in hand, pointing at the aim.
    ctx.rotate(this.aimAngle - this.angle);
    ctx.fillStyle = '#222';
    ctx.fillRect(6, -1.5, 12, 3);
    ctx.restore();
    // Aim reticle at the mouse is drawn by the HUD.
  }
}
