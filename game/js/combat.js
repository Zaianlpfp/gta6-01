// Solmar Bay — combat.js
// One job: combat — four weapons (fists, pistol, SMG, shotgun), mouse aim,
// tracers, muzzle flash, hit markers, and damage to cars, cops and peds.
'use strict';

const Combat = {
  slot: 1, mag: {}, reserve: {}, lastShot: 0, firing: false, aimPoint: null,
  tracer: null, crosshair: null,

  init(scene) {
    for (const w of WEAPONS) { this.mag[w.id] = w.mag; this.reserve[w.id] = w.reserve; }
    // A thin tracer line reused for every shot.
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }));
    scene.add(this.tracer);
  },

  weapon() { return WEAPONS[this.slot]; },
  unlocked(w) { return !w.locked || G.missionsDone >= (w.unlockMission || 99); },

  select(slot) {
    const w = WEAPONS[slot];
    if (!w || !this.unlocked(w)) { AudioSys.emptyClick(); return false; }
    this.slot = slot;
    AudioSys.click();
    HUD.refreshWeapons();
    return true;
  },

  // Fire from the player's position toward the mouse aim point.
  tryFire(now) {
    const w = this.weapon();
    if (now - this.lastShot < 1 / w.rate) return;
    if (w.id !== 'fists' && this.mag[w.id] <= 0) {
      AudioSys.emptyClick();
      this.lastShot = now;
      return;
    }
    this.lastShot = now;
    if (w.id !== 'fists') this.mag[w.id]--;
    AudioSys.gunshot(w.id);
    const origin = this.muzzleWorld();
    const target = this.aimPoint || new THREE.Vector3(G.player.x, 2, G.player.z - 10);
    // Muzzle flash + tracer.
    Particles.muzzle(origin.x, origin.y, origin.z);
    const pos = this.tracer.geometry.attributes.position;
    pos.setXYZ(0, origin.x, origin.y, origin.z);
    pos.setXYZ(1, target.x, target.y, target.z);
    pos.needsUpdate = true;
    this.tracer.material.opacity = 0.9;
    // In a staged screenshot scene the tracer stays up so the shot reads.
    setTimeout(() => { if (!Particles.sceneFlash) this.tracer.material.opacity = 0; }, 60);
    if (w.id === 'fists') { this.meleeHit(); return; }
    // One ray per pellet; spread widens for the shotgun.
    const pellets = w.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const dir = new THREE.Vector3(target.x - origin.x, target.y - origin.y, target.z - origin.z).normalize();
      dir.x += (Math.random() - 0.5) * w.spread * 2;
      dir.y += (Math.random() - 0.5) * w.spread;
      dir.z += (Math.random() - 0.5) * w.spread * 2;
      this.rayHit(origin, dir, w);
    }
    HUD.refreshWeapons();
    if (this.mag[w.id] === 0 && this.reserve[w.id] > 0) this.reload();
  },

  muzzleWorld() {
    if (Vehicles.playerCar) {
      const c = Vehicles.playerCar;
      return new THREE.Vector3(c.x + Math.sin(c.heading) * 4, 2, c.z + Math.cos(c.heading) * 4);
    }
    const a = G.player.heading;
    return new THREE.Vector3(G.player.x + Math.sin(a) * 1.2, 2.6, G.player.z + Math.cos(a) * 1.2);
  },

  rayHit(origin, dir, w) {
    const end = origin.clone().add(dir.clone().multiplyScalar(w.range));
    // Cars first: nearest car within a thin corridor of the ray.
    let best = null, bd = w.range;
    for (const car of Vehicles.list) {
      const t = this.rayCar(origin, dir, car);
      if (t !== null && t < bd) { bd = t; best = { kind: 'car', car }; }
    }
    for (const f of Police.footCops) {
      const t = this.rayPoint(origin, dir, f.x, 2, f.z, 2.2);
      if (t !== null && t < bd) { bd = t; best = { kind: 'cop', cop: f }; }
    }
    for (const p of Peds.list) {
      if (p.fare) continue;
      const t = this.rayPoint(origin, dir, p.x, 2, p.z, 1.6);
      if (t !== null && t < bd) { bd = t; best = { kind: 'ped', ped: p }; }
    }
    if (!best) {
      // Impact dust where the ray hits the ground.
      if (dir.y < -0.05) {
        const t = -origin.y / dir.y;
        if (t > 0 && t < w.range) Particles.burst(origin.x + dir.x * t, 0.5, origin.z + dir.z * t, 0xcccccc, 4);
      }
      return;
    }
    const hx = origin.x + dir.x * bd, hy = origin.y + dir.y * bd, hz = origin.z + dir.z * bd;
    Particles.burst(hx, hy, hz, 0xffaa33, 6);
    HUD.hitMarker();
    if (best.kind === 'car') {
      best.car.condition = Math.max(0, best.car.condition - w.dmg * 0.6);
      if (best.car.cop) Police.addHeat(6, 'SHOOTING AT POLICE');
      else if (best.car.traffic) Police.addHeat(4, 'SHOOTING UP TRAFFIC');
      if (best.car.condition <= 0) {
        Particles.burst(best.car.x, 2, best.car.z, 0xff6622, 18);
        Vehicles.removeCar(best.car);
      }
    } else if (best.kind === 'cop') {
      Police.removeFootCop(best.cop);
      Particles.burst(hx, hy, hz, 0xff4444, 8);
      Police.addHeat(8, 'OFFICER DOWN');
      G.stats.copsDown++;
    } else if (best.kind === 'ped') {
      Particles.burst(hx, hy, hz, 0xff4444, 8);
      Police.addHeat(10, 'SHOOTING CIVILIANS');
    }
  },

  rayCar(origin, dir, car) {
    // Approximate the car as a sphere at its centre, radius 5.
    return this.rayPoint(origin, dir, car.x, 1.6, car.z, 5);
  },
  rayPoint(origin, dir, px, py, pz, r) {
    const ox = px - origin.x, oy = py - origin.y, oz = pz - origin.z;
    const t = ox * dir.x + oy * dir.y + oz * dir.z;
    if (t < 0) return null;
    const cx = origin.x + dir.x * t, cy = origin.y + dir.y * t, cz = origin.z + dir.z * t;
    const d2 = (cx - px) * (cx - px) + (cy - py) * (cy - py) + (cz - pz) * (cz - pz);
    return d2 < r * r ? t : null;
  },

  meleeHit() {
    const a = G.player.heading;
    const hx = G.player.x + Math.sin(a) * 2.4, hz = G.player.z + Math.cos(a) * 2.4;
    for (const f of [...Police.footCops]) {
      if (dist2d(hx, hz, f.x, f.z) < 3) { Police.removeFootCop(f); Police.addHeat(5, 'ASSAULTING AN OFFICER'); }
    }
    for (const p of Peds.list) {
      if (dist2d(hx, hz, p.x, p.z) < 2.4 && !p.fare) Police.addHeat(6, 'ASSAULT');
    }
  },

  reload() {
    const w = this.weapon();
    if (w.id === 'fists') return;
    const need = w.mag - this.mag[w.id];
    const take = Math.min(need, this.reserve[w.id]);
    if (take <= 0) return;
    this.mag[w.id] += take;
    this.reserve[w.id] -= take;
    AudioSys.click();
    HUD.refreshWeapons();
  },

  // A foot cop's shot at the player: tracer + damage chance by distance.
  copShot(cop) {
    const origin = new THREE.Vector3(cop.x, 2.4, cop.z);
    const target = new THREE.Vector3(G.player.x, 1.6, G.player.z);
    const pos = this.tracer.geometry.attributes.position;
    pos.setXYZ(0, origin.x, origin.y, origin.z);
    pos.setXYZ(1, target.x, target.y, target.z);
    pos.needsUpdate = true;
    this.tracer.material.opacity = 0.9;
    setTimeout(() => { this.tracer.material.opacity = 0; }, 70);
    Particles.muzzle(origin.x, origin.y, origin.z);
    AudioSys.gunshot('pistol');
    const d = dist2d(cop.x, cop.z, G.player.x, G.player.z);
    if (Math.random() < clamp(0.55 - d / 110, 0.1, 0.5)) {
      G.player.health = Math.max(0, G.player.health - 9);
      HUD.flashDamage();
      if (G.player.health <= 0) Player.wasted();
    }
  },

  buyAmmo(id) {
    const w = WEAPONS.find(x => x.id === id);
    if (!w || w.id === 'fists') return false;
    const price = AMMO_PRICE[id];
    if (G.cash < price) { showToast('Not enough cash — ' + fmtCash(price) + ' needed'); return false; }
    G.cash -= price;
    this.reserve[id] += w.mag * 2;
    AudioSys.pickup();
    showToast(w.name + ' ammo restocked');
    HUD.refreshWeapons();
    return true;
  },
};
