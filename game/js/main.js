// Solmar Bay — main loop and wiring.
// States: title → howto → playing ⇄ paused → busted/wasted → title.
// The camera follows Jax; the world, traffic, peds, police, missions and
// the HUD all update from here, and every crime flows through onCrime so
// the wanted level only rises when the city actually sees it.
import { City, WORLD_W, WORLD_H } from './city.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { Traffic, Car } from './vehicles.js';
import { PedCrowd } from './peds.js';
import { Player, Bullet } from './player.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { saveGameData, loadGameData, hasSave, clearSave } from './save.js';
import { applyScene } from './scenes.js';
import { clamp, dist, makeRng } from './util.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

class Game {
  constructor() {
    this.city = new City();
    this.input = new Input(canvas);
    this.sound = new SoundBank();
    this.hud = new Hud();
    this.traffic = new Traffic(this.city);
    this.crowd = new PedCrowd(this.city);
    this.police = new Police(this.city);
    this.missions = new Missions(this.city);
    this.player = new Player(600, 1800);
    this.bullets = [];
    this.allCars = [...this.traffic.cars];
    this.cam = { x: 600, y: 1800, w: canvas.width, h: canvas.height };
    this.state = 'title';
    this.started = false;
    this.clockMinutes = 17 * 60 + 20; // golden hour
    this.time = 0;
    this.bustedKind = 'busted';
    this.completeShown = false;
    this.rng = makeRng(99);
    const params = new URLSearchParams(location.search);
    this.scene = params.get('scene');
    this.lastTime = performance.now();
    // Spawn the player's starter car near the safehouse.
    const starter = new Car(660, 1860, -Math.PI / 2, 'sedan', '#4f7ec9');
    this.allCars.push(starter);
    this.starterCar = starter;
  }
  clockText() {
    const h = Math.floor(this.clockMinutes / 60) % 24;
    const m = Math.floor(this.clockMinutes % 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  // ---- crimes: heat rises only when witnessed ----
  onCrime(kind) {
    const p = this.player;
    let witnessed = this.police.anyCopNear(p.x, p.y, 460);
    if (!witnessed) {
      for (const ped of this.crowd.peds) {
        if (!ped.dead && dist(ped.x, ped.y, p.x, p.y) < 240) { witnessed = true; break; }
      }
    }
    this.police.crime(kind, witnessed);
  }
  toast(text, seconds) { this.hud.toast(text, seconds); }
  saveGame() {
    const p = this.player;
    saveGameData({
      cash: p.cash,
      missionIndex: this.missions.index,
      coinsTaken: this.missions.coins.map((c) => c.taken),
      coinsCollected: this.missions.coinsCollected,
      x: p.x, y: p.y,
      health: p.health,
      clockMinutes: this.clockMinutes,
      storyDone: this.missions.storyDone,
    });
  }
  loadSave() {
    const d = loadGameData();
    if (!d) return false;
    const p = this.player;
    p.cash = d.cash || 0;
    p.health = d.health || 100;
    p.x = d.x || 600; p.y = d.y || 1800;
    this.clockMinutes = d.clockMinutes || 1020;
    this.missions.coins.forEach((c, i) => { c.taken = !!(d.coinsTaken && d.coinsTaken[i]); });
    this.missions.coinsCollected = d.coinsCollected || 0;
    this.missions.storyDone = !!d.storyDone;
    const idx = Math.min(d.missionIndex || 0, 4);
    this.missions.startMission(this.missions.storyDone ? 4 : idx);
    if (this.missions.storyDone) this.missions.index = 5;
    return true;
  }
  startNewGame() {
    clearSave();
    this.player = new Player(600, 1800);
    this.missions = new Missions(this.city);
    this.police = new Police(this.city);
    this.bullets = [];
    this.clockMinutes = 17 * 60 + 20;
    this.completeShown = false;
    this.state = 'playing';
    this.started = true;
    this.sound.ensure();
    this.sound.startMusic();
    this.missions.showMessage('First Fare — Mara Solis', 'Jax, you need wheels and a rep. A fare is waiting downtown — pick them up and drop them at the Palms.', 7);
  }
  respawn() {
    const p = this.player;
    const hospital = this.city.landmarks.hospital;
    if (p.inCar) p.exitCar();
    p.x = hospital.x; p.y = hospital.y + 120;
    p.health = 100; p.armor = 0; p.dead = false;
    p.cash = Math.max(0, p.cash - Math.min(200, Math.floor(p.cash * 0.2)));
    this.police.resetAfterBust();
    this.bullets = [];
    this.state = 'playing';
    this.saveGame();
  }
  update(dt) {
    this.time += dt;
    this.clockMinutes += dt / 1.5; // 1 game minute per 1.5 real seconds
    this.hud.update(dt);
    if (this.state !== 'playing') return;
    const p = this.player;
    const input = this.input;
    // Pause / mute.
    if (input.pressed('Escape')) { this.state = 'paused'; return; }
    if (input.pressed('KeyM')) { this.sound.setMuted(!this.sound.muted); this.toast(this.sound.muted ? 'Sound muted' : 'Sound on'); }
    // Enter / exit cars and fares on E.
    if (input.pressed('KeyE') && !p.dead) {
      if (p.driving) {
        const ped = this.crowd.nearestTaxiPed(p.x, p.y, 60);
        if (ped && !this.missions.fare) {
          ped.taxi = false;
          ped.inCar = p.inCar;
          const dest = this.city.randomRoadPoint(this.missions.rng);
          this.missions.fare = { ped, dest: { x: dest.x, y: dest.y } };
          this.sound.phoneBuzz();
          this.toast('Fare picked up — drive to the marker');
        } else {
          p.exitCar();
        }
      } else {
        const car = p.tryEnterCar(this.allCars, (kind) => this.onCrime(kind));
        if (car) this.sound.blip(300, 0.08, 'square', 0.08, 180);
      }
    }
    // Driving.
    if (p.driving && p.inCar) {
      const ax = input.axes();
      const throttle = ax.y < 0 ? 1 : ax.y > 0 ? -1 : 0;
      const steer = ax.x;
      p.inCar.drive(dt, throttle, steer, input.down('Space'));
      p.inCar.collideCity(this.city, dt);
      // The player rides in the car: keep the player's position and angle
      // in sync with it, so the camera, the police chase, the peds, the
      // mission markers and the minimap all track the car — not the spot
      // where the player got in. (Without this the camera stayed behind
      // while the car drove off-screen.)
      p.x = p.inCar.x;
      p.y = p.inCar.y;
      p.angle = p.inCar.angle;
      p.hurtFlash = Math.max(0, p.hurtFlash - dt);
      p.shootCooldown = Math.max(0, p.shootCooldown - dt);
      if (p.inCar.health <= 0) {
        p.exitCar();
        this.toast('Your car is wrecked!');
        this.sound.crash();
      }
      this.sound.setEngine(Math.abs(p.inCar.speed) / p.inCar.maxSpeed, true);
    } else {
      p.update(dt, input, this.city, this.cam, (kind) => this.onCrime(kind));
      if (p.tryShoot(input, this.bullets)) {
        this.sound.gunshot();
        this.onCrime('shoot');
      }
      this.sound.setEngine(0, false);
    }
    // Siren when cruisers are near.
    this.sound.setSiren(this.police.cars.length > 0 && this.police.wanted > 0, dt);
    // Traffic + collisions.
    this.traffic.update(dt, p.pos, this.allCars);
    // Keep allCars in sync with traffic spawns/removals.
    for (const c of this.traffic.cars) if (!this.allCars.includes(c)) this.allCars.push(c);
    this.allCars = this.allCars.filter((c) => this.traffic.cars.includes(c) || this.police.cars.includes(c) || c === this.starterCar || c.special === 'comet');
    this.traffic.resolveCollisions(this.allCars, (a, b, rel) => {
      const involvesPlayer = (a === p.inCar || b === p.inCar);
      if (involvesPlayer && rel > 200) {
        this.sound.crash();
        const other = a === p.inCar ? b : a;
        if (other.kind === 'police') this.onCrime('hitCop');
        if (p.inCar) p.inCar.health -= 4;
      }
    }, dt);
    // Peds hit by the player's car.
    if (p.driving && p.inCar && Math.abs(p.inCar.speed) > 140) {
      for (const ped of this.crowd.peds) {
        if (ped.dead || ped.inCar) continue;
        if (dist(ped.x, ped.y, p.x, p.y) < 26) {
          ped.dead = true;
          this.onCrime('hitPed');
          this.sound.crash();
        }
      }
    }
    // Bullets.
    let shotDanger = null;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dt);
      let dead = b.life <= 0;
      if (!dead && this.city.collidesBuilding(b.x, b.y, 2)) dead = true;
      if (!dead && b.friendly) {
        for (const ped of this.crowd.peds) {
          if (!ped.dead && !ped.inCar && dist(b.x, b.y, ped.x, ped.y) < 13) {
            ped.dead = true;
            this.onCrime('kill');
            shotDanger = { x: b.x, y: b.y };
            dead = true;
            break;
          }
        }
        if (!dead) for (const cop of this.police.cops) {
          if (dist(b.x, b.y, cop.x, cop.y) < 13) {
            cop.health -= 34;
            this.onCrime('hitCop');
            shotDanger = { x: b.x, y: b.y };
            dead = true;
            break;
          }
        }
      }
      if (!dead && !b.friendly && dist(b.x, b.y, p.x, p.y) < 13) {
        p.takeDamage(9, true);
        dead = true;
      }
      if (dead) this.bullets.splice(i, 1);
    }
    this.crowd.update(dt, p.pos, shotDanger || (p.shootCooldown > 0.1 ? { x: p.x, y: p.y } : null));
    this.police.update(dt, p, this.city, this.allCars, this.bullets, (ev) => {
      if (ev === 'busted') { this.bustedKind = 'busted'; this.state = 'busted'; this.sound.busted(); }
      if (ev === 'wasted') { this.bustedKind = 'wasted'; this.state = 'wasted'; this.sound.busted(); }
      if (ev === 'carWrecked') this.toast('Your car is wrecked!');
    });
    if (p.dead && this.state === 'playing') { this.bustedKind = 'wasted'; this.state = 'wasted'; this.sound.busted(); }
    this.missions.update(dt, this);
    // Story complete overlay (once).
    if (this.missions.storyDone && !this.completeShown) {
      this.completeShown = true;
      this.state = 'complete';
    }
    // Camera follows the player, clamped to the world.
    const tx = clamp(p.x, canvas.width / 2 - 40, WORLD_W - canvas.width / 2 + 40);
    const ty = clamp(p.y, canvas.height / 2 - 40, WORLD_H - canvas.height / 2 + 40);
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 5);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 5);
  }
  draw() {
    const W = canvas.width, H = canvas.height;
    if (this.state === 'title') {
      const action = this.hud.drawStart(ctx, this, this.input, hasSave());
      if (action === 'continue') { if (this.loadSave()) { this.state = 'playing'; this.started = true; this.sound.ensure(); this.sound.startMusic(); } }
      else if (action === 'new') this.startNewGame();
      else if (action === 'howto') this.state = 'howto';
      return;
    }
    if (this.state === 'howto') {
      if (this.hud.drawHowTo(ctx, this.input) === 'back') this.state = 'title';
      return;
    }
    if (this.state === 'busted' || this.state === 'wasted') {
      // Keep the city visible behind the overlay.
      this.drawWorld();
      if (this.hud.drawBusted(ctx, this.input, this.bustedKind) === 'respawn') this.respawn();
      return;
    }
    if (this.state === 'complete') {
      this.drawWorld();
      if (this.hud.drawStoryComplete(ctx, this.input) === 'roam') this.state = 'playing';
      return;
    }
    if (this.state === 'paused') {
      this.drawWorld();
      const action = this.hud.drawPause(ctx, this, this.input);
      if (action === 'resume') this.state = 'playing';
      else if (action === 'save') { this.saveGame(); this.toast('Game saved'); }
      else if (action === 'restart-mission') {
        this.missions.startMission(this.missions.index);
        if (this.missions.current() && this.missions.current().id === 'hot-wheels') this.missions.spawnComet(this.allCars);
        this.state = 'playing';
      } else if (action === 'quit') { this.saveGame(); this.state = 'title'; }
      return;
    }
    // Playing.
    this.drawWorld();
  }
  drawWorld() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    // World space: translate so the camera centre is the screen centre.
    ctx.save();
    ctx.translate(-(this.cam.x - W / 2), -(this.cam.y - H / 2));
    this.city.draw(ctx, this.cam, this.time);
    this.missions.draw(ctx, this.cam, this.time);
    // Cars (police first so the player car draws on top).
    for (const c of this.allCars) c.draw(ctx);
    this.crowd.draw(ctx);
    this.police.draw(ctx);
    for (const b of this.bullets) b.draw(ctx);
    this.player.draw(ctx);
    ctx.restore();
    // Screen space from here on: off-screen objective arrow, sun tint, HUD.
    const mk = this.missions.currentMarker();
    if (mk) {
      const p = this.player;
      const dx = mk.x - p.x, dy = mk.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 700) {
        const a = Math.atan2(dy, dx);
        const ex = W / 2 + Math.cos(a) * (W / 2 - 60);
        const ey = H / 2 + Math.sin(a) * (H / 2 - 60);
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(a);
        ctx.fillStyle = '#ff5d5d';
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, -10); ctx.lineTo(-10, 10); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(d) + 'm', ex, ey + 26);
      }
    }
    // Sun tint: golden hour warms the frame, night cools it.
    const mins = this.clockMinutes % (24 * 60);
    let tint = null;
    if (mins >= 17 * 60 && mins < 19 * 60) tint = 'rgba(255,150,60,0.10)';
    else if (mins >= 19 * 60 || mins < 6 * 60) tint = 'rgba(20,40,110,0.22)';
    else if (mins >= 6 * 60 && mins < 8 * 60) tint = 'rgba(255,190,110,0.07)';
    if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H); }
    this.hud.drawGame(ctx, this, this.cam);
  }
  frame(now) {
    const dt = clamp((now - this.lastTime) / 1000, 0, 0.05);
    this.lastTime = now;
    this.update(dt);
    this.draw();
    this.input.endFrame();
    window.__solmarReady = true;
    requestAnimationFrame((t) => this.frame(t));
  }
  start() {
    if (this.scene) applyScene(this, this.scene);
    requestAnimationFrame((t) => this.frame(t));
  }
}

const game = new Game();
window.__solmarGame = game;
game.start();
