// Missions and side work for Solmar Bay.
// Five story jobs from Mara Solis, the fixer who runs the bay's night
// economy, plus taxi fares and 20 hidden sun coins for free-roam money.
// A mission is a list of steps; each step is a place to reach, a thing to
// hold, or a timer to survive. The HUD reads currentObjective() and
// currentMarker() every frame.
import { dist, makeRng, pick, randRange, randInt } from './util.js';
import { Car } from './vehicles.js';

function lm(city, name) { return city.landmarks[name]; }

export class Missions {
  constructor(city) {
    this.city = city;
    this.rng = makeRng(20261117);
    this.index = 0;            // story mission 0..4, 5 = story done
    this.step = 0;
    this.stepTimer = 0;
    this.holdProgress = 0;
    this.fare = null;          // active taxi fare {ped, dest}
    this.fareCooldown = 0;
    this.coins = [];           // {x,y,taken}
    this.coinsCollected = 0;
    this.message = null;       // {title, body, until}
    this.storyDone = false;
    this.buildCoins();
    this.startMission(0);
  }
  buildCoins() {
    const rng = makeRng(555);
    for (let i = 0; i < 20; i++) {
      const p = this.city.randomRoadPoint(rng);
      const s = this.city.sidewalkPoint(p.x, p.y);
      this.coins.push({ x: s.x, y: s.y, taken: false });
    }
  }
  story() {
    const L = (n) => lm(this.city, n);
    return [
      {
        id: 'first-fare', title: 'First Fare', giver: 'Mara Solis',
        brief: 'Jax, you need wheels and a rep. A fare is waiting downtown — pick them up and drop them at the Palms. Drive like you mean it.',
        steps: [
          { kind: 'goto', text: 'Pick up the fare downtown', x: L('mall').x, y: L('mall').y, r: 90 },
          { kind: 'goto', text: 'Drop the fare at the Palms Beach Hotel', x: L('hotel').x, y: L('hotel').y, r: 90 },
        ],
        reward: 150,
      },
      {
        id: 'the-package', title: 'The Package', giver: 'Mara Solis',
        brief: 'A package is sitting at the marina. No questions, no cops. Bring it to the Rusty Anchor garage.',
        steps: [
          { kind: 'goto', text: 'Pick up the package at the marina', x: L('marina').x, y: L('marina').y, r: 90 },
          { kind: 'goto', text: 'Deliver the package to the Rusty Anchor', x: L('chopshop').x, y: L('chopshop').y, r: 90 },
        ],
        reward: 300,
      },
      {
        id: 'hot-wheels', title: 'Hot Wheels', giver: 'Mara Solis',
        brief: 'A red Comet GT is parked at the marina, keys in the sun visor. Take it. Bring it to the Rusty Anchor — and try not to scratch it.',
        steps: [
          { kind: 'steal', text: 'Steal the red Comet GT at the marina', x: L('marina').x, y: L('marina').y, r: 120 },
          { kind: 'deliver-car', text: 'Deliver the Comet GT to the Rusty Anchor', x: L('chopshop').x, y: L('chopshop').y, r: 90 },
        ],
        reward: 450,
      },
      {
        id: 'heat', title: 'Heat', giver: 'Mara Solis',
        brief: 'The PD is all over you, Jax. Lose them. Stay out of sight until the heat dies — then get home to your place.',
        steps: [
          { kind: 'survive', text: 'Survive the heat — stay alive 60 seconds', seconds: 60 },
          { kind: 'goto', text: 'Lay low at your place', x: L('safehouse').x, y: L('safehouse').y, r: 90 },
        ],
        reward: 600,
      },
      {
        id: 'big-score', title: 'The Big Score', giver: 'Mara Solis',
        brief: 'Tonight we hit the Solmar National Bank. Walk in, grab the cash, and run. Every cop in the city will be on you — make it home.',
        steps: [
          { kind: 'goto', text: 'Get to the Solmar National Bank', x: L('bank').x, y: L('bank').y, r: 90 },
          { kind: 'hold', text: 'Hold E to crack the vault', x: L('bank').x, y: L('bank').y, r: 80, seconds: 3 },
          { kind: 'goto', text: 'Escape to your place — lose the heat', x: L('safehouse').x, y: L('safehouse').y, r: 90 },
        ],
        reward: 1500,
      },
    ];
  }
  current() { return this.index < 5 ? this.story()[this.index] : null; }
  currentStep() { const m = this.current(); return m ? m.steps[this.step] : null; }
  currentObjective() {
    const s = this.currentStep();
    if (this.fare) return 'Fare: drop the passenger at the marker';
    if (!s) return this.storyDone ? 'Story complete — free roam Solmar Bay' : '';
    return s.text;
  }
  currentMarker() {
    const s = this.currentStep();
    if (this.fare) return { x: this.fare.dest.x, y: this.fare.dest.y, color: '#f2c14e' };
    if (!s || s.kind === 'survive') return null;
    return { x: s.x, y: s.y, color: '#ff5d5d' };
  }
  startMission(i) {
    this.index = i;
    this.step = 0;
    this.stepTimer = 0;
    this.holdProgress = 0;
    const m = this.current();
    if (m) this.showMessage(m.title + ' — ' + m.giver, m.brief, 7);
  }
  showMessage(title, body, seconds) {
    this.message = { title, body, until: seconds };
  }
  // Called every frame by the game. Returns events for the game to act on.
  update(dt, game) {
    const p = game.player, pol = game.police;
    if (this.message) { this.message.until -= dt; if (this.message.until <= 0) this.message = null; }
    this.fareCooldown = Math.max(0, this.fareCooldown - dt);
    // Sun coins.
    for (const c of this.coins) {
      if (!c.taken && dist(p.x, p.y, c.x, c.y) < 34) {
        c.taken = true;
        this.coinsCollected++;
        p.cash += 50;
        game.sound.coin();
        game.toast('Sun coin! +$50  (' + this.coinsCollected + '/20)');
      }
    }
    // Taxi fares are picked up by the main loop on E (see main.js);
    // this update only completes an active fare.
    if (this.fare) {
      const d = this.fare.dest;
      if (dist(p.x, p.y, d.x, d.y) < 70) {
        const pay = randInt(this.rng, 40, 85);
        p.cash += pay;
        this.fare.ped.inCar = null;
        this.fare.ped.x = p.x + 40; this.fare.ped.y = p.y + 30;
        this.fare = null;
        this.fareCooldown = 8;
        game.sound.missionDone();
        game.toast('Fare complete! +$' + pay);
      } else if (!p.driving) {
        // Passenger walks off if you ditch the car.
        this.fare.ped.inCar = null;
        this.fare.ped.x = p.x + 40; this.fare.ped.y = p.y + 30;
        this.fare = null;
        this.fareCooldown = 8;
      }
    }
    const m = this.current();
    if (!m) return;
    const s = m.steps[this.step];
    if (!s) return;
    // Mission 4 sets the heat when it starts.
    if (m.id === 'heat' && this.step === 0 && this.stepTimer === 0) {
      this.stepTimer = 0.0001;
      pol.addHeat(55, 'heat');
      game.sound.phoneBuzz();
    }
    // Mission 5 raises the heat after the vault.
    if (m.id === 'big-score' && this.step === 2 && this.stepTimer === 0) {
      this.stepTimer = 0.0001;
      pol.addHeat(70, 'big-score');
    }
    if (s.kind === 'goto' || s.kind === 'steal' || s.kind === 'deliver-car') {
      const d = dist(p.x, p.y, s.x, s.y);
      if (s.kind === 'steal') {
        if (p.driving && p.inCar.kind === 'sport' && p.inCar.special === 'comet') this.advance(game);
      } else if (s.kind === 'deliver-car') {
        if (p.driving && p.inCar.special === 'comet' && d < s.r) {
          p.exitCar();
          this.advance(game);
        }
      } else if (d < s.r) {
        this.advance(game);
      }
    } else if (s.kind === 'hold') {
      if (dist(p.x, p.y, s.x, s.y) < s.r && !p.driving && game.input.down('KeyE')) {
        this.holdProgress += dt;
        if (this.holdProgress >= s.seconds) { this.holdProgress = 0; this.advance(game); }
      } else {
        this.holdProgress = Math.max(0, this.holdProgress - dt * 2);
      }
    } else if (s.kind === 'survive') {
      this.stepTimer += dt;
      if (this.stepTimer >= s.seconds) this.advance(game);
    }
  }
  advance(game) {
    const m = this.current();
    game.sound.pickup();
    this.step++;
    if (this.step >= m.steps.length) {
      game.player.cash += m.reward;
      game.sound.missionDone();
      game.toast('Mission complete: ' + m.title + '  +$' + m.reward);
      game.saveGame();
      this.index++;
      if (this.index >= 5) {
        this.storyDone = true;
        this.showMessage('SOLMAR BAY — STORY COMPLETE', 'You did it, Jax. The bay is yours now. Keep driving, keep earning — the city never sleeps.', 9);
      } else {
        this.startMission(this.index);
      }
    }
  }
  // The red Comet GT for mission 3, parked at the marina.
  spawnComet(allCars) {
    const L = lm(this.city, 'marina');
    const car = new Car(L.x + 60, L.y + 40, Math.PI / 2, 'sport', '#d21f3c');
    car.special = 'comet';
    allCars.push(car);
    return car;
  }
  draw(ctx, cam, time) {
    // Sun coins.
    for (const c of this.coins) {
      if (c.taken) continue;
      if (c.x < cam.x - cam.w / 2 - 30 || c.x > cam.x + cam.w / 2 + 30 || c.y < cam.y - cam.h / 2 - 30 || c.y > cam.y + cam.h / 2 + 30) continue;
      const bob = Math.sin(time * 3 + c.x) * 3;
      ctx.save();
      ctx.translate(c.x, c.y + bob);
      ctx.fillStyle = '#f2c14e';
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff3c9';
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c98a1e';
      ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
      ctx.fillText('$', 0, 4);
      ctx.restore();
    }
    // Objective marker: a pulsing beacon + a floating arrow at the screen edge.
    const mk = this.currentMarker();
    if (mk) {
      const pulse = 1 + Math.sin(time * 4) * 0.15;
      ctx.save();
      ctx.translate(mk.x, mk.y);
      ctx.strokeStyle = mk.color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fillStyle = mk.color; ctx.fill();
      ctx.fillStyle = mk.color;
      ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(-9, -18); ctx.lineTo(9, -18); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
}
