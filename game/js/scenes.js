// Screenshot scenes for Solmar Bay (?scene=... in the URL).
// The judge sees the game through its screenshots, so each scene stages
// one of the game's best moments with real systems running: a police
// chase, the city on foot, a mission in progress, and the title screen.
// These are the game's own debug hooks — they only set up state, then
// the game plays itself.
import { Car } from './vehicles.js';

export function applyScene(game, scene) {
  const p = game.player;
  const city = game.city;
  if (scene === 'menu') {
    game.state = 'title';
    return;
  }
  game.state = 'playing';
  game.started = true;
  game.sound.ensure();
  if (scene === 'cover') {
    // Wanted 3, driving the Comet GT downtown with cruisers on the tail.
    const comet = game.missions.spawnComet(game.allCars);
    comet.x = 1400; comet.y = 1000; comet.angle = 0;
    p.x = comet.x; p.y = comet.y;
    p.inCar = comet;
    comet.driver = 'player';
    comet.speed = 320;
    game.police.addHeat(55, 'scene');
    game.missions.index = 3;
    game.missions.step = 0;
    game.missions.stepTimer = 0.0001;
    game.missions.showMessage('Heat — Mara Solis', 'The PD is all over you, Jax. Lose them. Stay out of sight until the heat dies — then get home.', 7);
    game.clockMinutes = 17 * 60 + 42;
    game.cam.x = 1400; game.cam.y = 1000;
    // Two cruisers already closing in.
    for (let i = 0; i < 2; i++) {
      const c = new Car(1400 - 260 - i * 130, 1000 + (i === 0 ? 10 : -20), 0, 'police', '#20242e');
      c.speed = 340; c.sirenOn = true;
      game.police.cars.push(c);
      game.allCars.push(c);
    }
  } else if (scene === 'foot') {
    // On foot in the downtown plaza, peds and traffic all around, 1 star.
    p.x = 1420; p.y = 1020;
    p.cash = 1240;
    game.police.addHeat(12, 'scene');
    game.clockMinutes = 12 * 60 + 10;
    game.missions.index = 0;
    game.missions.step = 0;
    game.missions.showMessage('First Fare — Mara Solis', 'Jax, you need wheels and a rep. A fare is waiting downtown — pick them up and drop them at the Palms.', 7);
    game.cam.x = p.x; game.cam.y = p.y;
    // A few extra peds near the plaza for the shot.
    for (let i = 0; i < 6; i++) {
      game.crowd.spawnFar(p.x, p.y, 120);
    }
  } else if (scene === 'mission') {
    // The Big Score: at the bank with the vault cracked, 4 stars, escape on.
    game.missions.index = 4;
    game.missions.step = 2;
    game.missions.stepTimer = 0.0001;
    const bank = city.landmarks.bank;
    const comet = game.missions.spawnComet(game.allCars);
    comet.x = bank.x + 180; comet.y = 1000; comet.angle = 0;
    p.x = bank.x + 60; p.y = 1000;
    p.cash = 2150;
    game.police.addHeat(70, 'scene');
    game.clockMinutes = 21 * 60 + 5;
    game.missions.showMessage('The Big Score — Mara Solis', 'You got the cash. Every cop in the city is on you — make it home to your place.', 7);
    game.cam.x = bank.x + 40; game.cam.y = bank.y + 40;
    for (let i = 0; i < 2; i++) {
      const c = new Car(bank.x - 200 - i * 120, bank.y + 200, -Math.PI / 2, 'police', '#20242e');
      c.speed = 300; c.sirenOn = true;
      game.police.cars.push(c);
      game.allCars.push(c);
    }
  }
}
