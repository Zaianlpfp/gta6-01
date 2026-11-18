// Solmar Bay — police.js
// One job: the wanted system — heat 0–100, stars, SBPD cruisers that chase
// and ram, foot cops that arrest or shoot, and the AIR-1 helicopter with its
// spotlight and search zone at 4–5 stars.
'use strict';

const Police = {
  cruisers: [], footCops: [], heli: null, heliLight: null, heliCone: null,
  searchZone: null, inSight: false, catchTimer: 0, spawnTimer: 0,

  stars() { return Math.ceil(G.heat / 20); },

  addHeat(n, why) {
    if (G.state !== 'play') return;
    const before = this.stars();
    G.heat = clamp(G.heat + n, 0, 100);
    const after = this.stars();
    if (after > before && after >= 1) {
      showToast('WANTED LEVEL ' + after + ' — ' + why);
      AudioSys.setSiren(true);
    }
    if (G.heat >= 80 && !this.heli) this.spawnHeli();
  },

  update(dt) {
    const stars = this.stars();
    // Heat cools when hidden; slower while a cop can see the player.
    const seen = this.canAnyCopSee();
    this.inSight = seen;
    const decay = seen ? TUNE.heatDecaySeen : (Vehicles.playerCar ? TUNE.heatDecayInCar : TUNE.heatDecayHidden);
    if (G.heat > 0 && !G.missionEscape) G.heat = Math.max(0, G.heat - decay * dt);
    if (G.heat === 0 && this.heli) this.removeHeli();
    // Keep the cruiser count matched to the wanted level.
    this.spawnTimer -= dt;
    if (stars > 0 && this.cruisers.length < Math.min(stars, TUNE.maxCruisers) && this.spawnTimer <= 0) {
      this.spawnCruiser();
      this.spawnTimer = 2.5;
    }
    if (stars === 0) {
      for (const c of this.cruisers.splice(0)) Vehicles.removeCar(c);
      for (const f of this.footCops.splice(0)) this.removeFootCop(f);
    }
    // Foot cops join at 3+ stars.
    if (stars >= 3 && this.footCops.length < stars - 1 && this.spawnTimer <= 0) {
      this.spawnFootCop();
      this.spawnTimer = 3;
    }
    this.updateCruisers(dt);
    this.updateFootCops(dt);
    this.updateHeli(dt);
    // Cop light bars flash.
    Vehicles.updateCopLights(G.time);
  },

  canAnyCopSee() {
    const px = G.player.x, pz = G.player.z;
    for (const c of this.cruisers) if (dist2d(px, pz, c.x, c.z) < 90) return true;
    for (const f of this.footCops) if (dist2d(px, pz, f.x, f.z) < 40) return true;
    if (this.heli && G.heat >= 80) return true;
    return false;
  },

  spawnCruiser() {
    const copDef = VEHICLES.find(v => v.id === 'cop');
    const a = Math.random() * Math.PI * 2;
    const x = clamp(G.player.x + Math.cos(a) * 160, -1500, 1500);
    const z = clamp(G.player.z + Math.sin(a) * 160, -1100, 1100);
    const near = nearestRoadPoint(x, z);
    const car = Vehicles.spawn(G.scene, copDef, near.x, near.z, Math.atan2(G.player.x - near.x, G.player.z - near.z), { traffic: false });
    car.cop = true;
    this.cruisers.push(car);
    return car;
  },

  updateCruisers(dt) {
    const px = G.player.x, pz = G.player.z;
    for (const c of this.cruisers) {
      // Steer toward the player along the road grid, with a little wobble.
      const want = Math.atan2(px - c.x, pz - c.z);
      c.heading = angleLerp(c.heading, want + Math.sin(G.time * 1.3 + c.x) * 0.12, dt * 2.2);
      const target = Math.min(c.def.top, 30 + this.stars() * 5);
      const d = dist2d(px, pz, c.x, c.z);
      c.speed = lerp(c.speed, d < 12 ? target * 0.5 : target, dt * 1.2);
      let nx = c.x + Math.sin(c.heading) * c.speed * dt;
      let nz = c.z + Math.cos(c.heading) * c.speed * dt;
      const hit = City.collideCircle(nx, nz, 4.6);
      if (hit.x !== nx || hit.z !== nz) { c.heading += Math.PI / 2; c.speed *= 0.5; }
      c.x = hit.x; c.z = hit.z;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      // Ram the player's car: shove it and damage it.
      const pc = Vehicles.playerCar;
      if (pc && dist2d(c.x, c.z, pc.x, pc.z) < 8.5) {
        pc.condition = Math.max(5, pc.condition - 6 * dt);
        pc.x += Math.sin(c.heading) * 14 * dt;
        pc.z += Math.cos(c.heading) * 14 * dt;
        if (Math.random() < dt * 2) Particles.burst(pc.x, 2, pc.z, 0xffaa33, 5);
      }
      // Ram the player on foot: knock health down.
      if (!pc && d < 4) {
        G.player.health = Math.max(0, G.player.health - 22 * dt);
        if (G.player.health <= 0) Player.wasted();
      }
    }
  },

  spawnFootCop() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.7), new THREE.MeshLambertMaterial({ color: 0x1d3557 }));
    body.position.y = 1.8; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshLambertMaterial({ color: 0xe0ac69 }));
    head.position.y = 2.85; g.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 0.8), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    cap.position.y = 3.25; g.add(cap);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), new THREE.MeshLambertMaterial({ color: 0x1d3557 }));
    legs.position.y = 0.55; g.add(legs);
    const a = Math.random() * Math.PI * 2;
    const x = clamp(G.player.x + Math.cos(a) * 60, -1500, 1500);
    const z = clamp(G.player.z + Math.sin(a) * 60, -1100, 1100);
    g.position.set(x, 0, z);
    G.scene.add(g);
    const cop = { mesh: g, x, z, heading: 0, shootT: 0, phase: Math.random() * 6 };
    this.footCops.push(cop);
    return cop;
  },
  removeFootCop(cop) {
    const i = this.footCops.indexOf(cop);
    if (i >= 0) this.footCops.splice(i, 1);
    if (cop.mesh.parent) cop.mesh.parent.remove(cop.mesh);
  },

  updateFootCops(dt) {
    const px = G.player.x, pz = G.player.z;
    for (const f of [...this.footCops]) {
      const d = dist2d(px, pz, f.x, f.z);
      const want = Math.atan2(px - f.x, pz - f.z);
      f.heading = angleLerp(f.heading, want, dt * 4);
      if (d > TUNE.copCatchDist) {
        f.phase += dt * 6;
        const nx = f.x + Math.sin(f.heading) * TUNE.copChaseSpeed * dt;
        const nz = f.z + Math.cos(f.heading) * TUNE.copChaseSpeed * dt;
        const hit = City.collideCircle(nx, nz, 1);
        f.x = hit.x; f.z = hit.z;
        this.catchTimer = 0;
      } else {
        // On top of the player: arrest countdown.
        this.catchTimer += dt;
        if (this.catchTimer > TUNE.copCatchTime) { Player.busted(); return; }
      }
      f.mesh.position.set(f.x, Math.abs(Math.sin(f.phase)) * 0.1, f.z);
      f.mesh.rotation.y = f.heading;
      // Cops shoot at 3+ stars when the player is on foot and in range.
      if (this.stars() >= 3 && !Vehicles.playerCar && d < 55 && d > 6) {
        f.shootT -= dt;
        if (f.shootT <= 0) {
          f.shootT = 1.1 + Math.random() * 0.8;
          Combat.copShot(f);
        }
      }
    }
  },

  spawnHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(7, 3.4, 11), new THREE.MeshLambertMaterial({ color: 0x1d3557 }));
    body.castShadow = true; g.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(6, 1.8, 3.4), new THREE.MeshLambertMaterial({ color: 0x223344 }));
    glass.position.set(0, 0.4, 4.4); g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 12), new THREE.MeshLambertMaterial({ color: 0x1d3557 }));
    tail.position.set(0, 0.6, -10); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(22, 0.3, 1.6), new THREE.MeshLambertMaterial({ color: 0x222831 }));
    rotor.position.y = 2.6; g.add(rotor);
    const skid = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 8), new THREE.MeshLambertMaterial({ color: 0x222831 }));
    skid.position.y = -2.2; g.add(skid);
    g.position.set(G.player.x + 40, 95, G.player.z - 60);
    G.scene.add(g);
    const light = new THREE.SpotLight(0xfff2b0, 2.2, 160, 0.32, 0.5, 1);
    light.position.copy(g.position);
    G.scene.add(light); G.scene.add(light.target);
    // Visible light cone — scaled to the heli's altitude each frame.
    const cone = new THREE.Mesh(new THREE.ConeGeometry(16, 95, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    cone.position.y = -47;
    g.add(cone);
    // The search zone itself lives on the minimap (drawMap); a world ring
    // around the player reads as a red stripe across the chase cam, so none.
    this.heli = g; this.heliLight = light; this.heliCone = cone; this.searchZone = null;
    showToast('AIR-1 ON STATION — spotlight on you');
  },

  updateHeli(dt) {
    if (!this.heli) return;
    const h = this.heli;
    // Orbit ahead of the player so the heli stays inside the chase-cam frame,
    // low enough (y ~45) to read against the sky.
    const hd = Vehicles.playerCar ? Vehicles.playerCar.heading : G.player.heading;
    const fx = Math.sin(hd), fz = Math.cos(hd);
    const rx = Math.cos(hd), rz = -Math.sin(hd);
    const sway = Math.sin(G.time * 0.7) * 22;
    const tx = G.player.x + fx * 105 + rx * (18 + sway);
    const tz = G.player.z + fz * 105 + rz * (18 + sway);
    // In a staged screenshot scene the heli snaps to its orbit at once.
    const lk = G.sceneName ? 1 : dt * 0.8;
    h.position.x = lerp(h.position.x, tx, lk);
    h.position.z = lerp(h.position.z, tz, lk);
    h.position.y = 45 + Math.sin(G.time * 1.1) * 4;
    h.rotation.y = Math.atan2(G.player.x - h.position.x, G.player.z - h.position.z);
    h.children[3].rotation.y += dt * 22; // rotor spin (rotor is child index 3)
    // Stretch the light cone from the heli down to the player.
    this.heliCone.scale.y = h.position.y / 95;
    this.heliCone.position.y = -h.position.y / 2;
    this.heliLight.position.copy(h.position);
    this.heliLight.target.position.set(G.player.x, 0, G.player.z);
    if (this.searchZone) {
      this.searchZone.position.set(G.player.x, 0.3, G.player.z);
      this.searchZone.material.opacity = 0.45 + Math.sin(G.time * 4) * 0.2;
    }
  },

  removeHeli() {
    if (this.heli && this.heli.parent) this.heli.parent.remove(this.heli);
    if (this.heliLight) { G.scene.remove(this.heliLight); G.scene.remove(this.heliLight.target); }
    if (this.searchZone && this.searchZone.parent) this.searchZone.parent.remove(this.searchZone);
    this.heli = null; this.heliLight = null; this.heliCone = null; this.searchZone = null;
  },

  responseList() {
    // Named units for the HUD response panel, like the top entries show.
    const units = [];
    const names = ['IBIS-43', 'TARPON-10', 'HERON-17', 'KESTREL-31', 'MARLIN-24', 'SNAPPER-25'];
    if (this.heli) units.push({ name: 'AIR-1', dist: 0, status: 'SPOTLIGHT' });
    this.cruisers.forEach((c, i) => {
      const d = Math.round(dist2d(G.player.x, G.player.z, c.x, c.z));
      units.push({ name: names[i % names.length], dist: d, status: d < 25 ? 'RAMMING' : d < 60 ? 'PURSUIT' : 'ROADBLOCK' });
    });
    this.footCops.forEach((f, i) => {
      units.push({ name: 'UNIT-' + (70 + i), dist: Math.round(dist2d(G.player.x, G.player.z, f.x, f.z)), status: 'ON FOOT' });
    });
    return units;
  },
};
