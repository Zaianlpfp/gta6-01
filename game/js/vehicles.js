// Solmar Bay — vehicles.js
// One job: build low-poly cars, drive the player's car, and run traffic:
// cars that cruise the road grid, turn at intersections, and queue behind each other.
'use strict';

const Vehicles = {
  list: [],        // every car in the world (traffic + parked + player)
  playerCar: null,
  headlight: null,

  // Build one low-poly car mesh from a vehicle definition.
  makeCar(def, color, isCop) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2027 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.3, 9.2), bodyMat);
    body.position.y = 1.15; body.castShadow = true; g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.1, 4.6),
      new THREE.MeshLambertMaterial({ color: 0x223344 }));
    cabin.position.set(0, 2.3, -0.4); cabin.castShadow = true; g.add(cabin);
    // Hood + trunk lip for a sportier silhouette.
    const nose = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.5, 1.4), bodyMat);
    nose.position.set(0, 1.5, 4.6); g.add(nose);
    if (def.sport) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.25, 1.1), darkMat);
      wing.position.set(0, 2.15, -4.5); g.add(wing);
    }
    // Wheels.
    const wheelGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.7, 10);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const wheels = [];
    for (const [wx, wz] of [[-2.1, 3], [2.1, 3], [-2.1, -3], [2.1, -3]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2; w.position.set(wx, 0.85, wz);
      g.add(w); wheels.push(w);
    }
    // Headlights + taillights.
    const hl = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    for (const sx of [-1.5, 1.5]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.2), hl);
      h.position.set(sx, 1.3, 4.65); g.add(h);
    }
    const tl = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    for (const sx of [-1.5, 1.5]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.2), tl);
      t.position.set(sx, 1.3, -4.65); g.add(t);
    }
    if (isCop) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 1.2),
        new THREE.MeshLambertMaterial({ color: 0xdddddd }));
      bar.position.set(0, 3.1, -0.4); g.add(bar);
      const red = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.25), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      red.position.set(-0.85, 3.15, -0.4); g.add(red);
      const blue = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.25), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
      blue.position.set(0.85, 3.15, -0.4); g.add(blue);
      g.userData.lightBar = { red, blue };
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.0),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      decal.rotation.x = -Math.PI / 2; decal.position.set(0, 1.82, 0.5);
      g.add(decal);
    }
    if (def.id === 'taxi') {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 1.0),
        new THREE.MeshBasicMaterial({ color: 0xffc300 }));
      sign.position.set(0, 3.1, -0.4); g.add(sign);
    }
    g.userData.wheels = wheels;
    return g;
  },

  spawn(scene, def, x, z, heading, opts) {
    const o = opts || {};
    const color = o.color !== undefined ? o.color : pick(def.colors, Math.random);
    const mesh = this.makeCar(def, color, def.id === 'cop');
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    const car = {
      def, mesh, color, x, z, heading, speed: 0,
      condition: o.condition !== undefined ? o.condition : 70 + Math.random() * 30,
      traffic: !!o.traffic, parked: !!o.parked, cop: def.id === 'cop',
      lane: o.lane || 0, targetSpeed: o.targetSpeed || 0, stuck: 0,
      name: def.name, isPlayer: false, damageFlash: 0,
    };
    this.list.push(car);
    return car;
  },

  spawnTraffic(scene) {
    const rnd = mulberry32(4242);
    for (let i = 0; i < TUNE.trafficCount; i++) {
      const def = pick(VEHICLES.filter(v => v.id !== 'cop'), rnd);
      const alongAvenue = rnd() < 0.5;
      let x, z, heading;
      if (alongAvenue) {
        x = pick(AVENUES, rnd) + (rnd() < 0.5 ? -8 : 8);
        z = -1150 + rnd() * 2300;
        heading = rnd() < 0.5 ? 0 : Math.PI;
      } else {
        x = -1550 + rnd() * 3100;
        z = pick(STREETS, rnd) + (rnd() < 0.5 ? -8 : 8);
        heading = rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      }
      const car = this.spawn(scene, def, x, z, heading, { traffic: true, targetSpeed: 11 + rnd() * 7 });
      car.speed = car.targetSpeed;
    }
    // Parked cars along the curbs.
    for (let i = 0; i < TUNE.parkedCount; i++) {
      const def = pick(VEHICLES.filter(v => v.id !== 'cop'), rnd);
      const a = pick(AVENUES, rnd), s = pick(STREETS, rnd);
      const onAve = rnd() < 0.5;
      const x = onAve ? a + 24 : -1500 + rnd() * 3000;
      const z = onAve ? -1100 + rnd() * 2200 : s + 24;
      const heading = onAve ? (rnd() < 0.5 ? 0 : Math.PI) : (rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      if (City.insideCollider(x, z)) continue;
      this.spawn(scene, def, x, z, heading, { parked: true });
    }
  },

  // Place the two mission-steal cars + the player's starter taxi.
  spawnMissionCars(scene) {
    const solstice = VEHICLES.find(v => v.id === 'solstice');
    const marlin = VEHICLES.find(v => v.id === 'marlin');
    const runner = VEHICLES.find(v => v.id === 'runner');
    const taxi = VEHICLES.find(v => v.id === 'taxi');
    this.stealSolstice = this.spawn(scene, solstice, 200, -60, Math.PI / 2, { parked: true, color: 0xff2e63, condition: 100 });
    this.stealMarlin = this.spawn(scene, marlin, -260, 120, 0, { parked: true, color: 0x2e86ff, condition: 88 });
    this.stealRunner = this.spawn(scene, runner, 700, 60, Math.PI, { parked: true, color: 0xff6b35, condition: 74 });
    this.starterTaxi = this.spawn(scene, taxi, -1350, -460, Math.PI / 2, { parked: true, color: 0xffc300, condition: 92 });
  },

  nearestCar(x, z, maxD) {
    let best = null, bd = maxD;
    for (const c of this.list) {
      if (c.cop) continue;
      const d = dist2d(x, z, c.x, c.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  },

  enterCar(car) {
    if (this.playerCar) this.playerCar.isPlayer = false;
    this.playerCar = car;
    car.isPlayer = true; car.parked = false; car.traffic = false;
    if (car.def.id !== 'cop') G.stats.carsStolen++;
    return car;
  },

  exitCar() {
    if (!this.playerCar) return null;
    const car = this.playerCar;
    car.isPlayer = false; car.speed = 0;
    this.playerCar = null;
    return car;
  },

  // Arcade driving: throttle, brake/reverse, steering that scales with speed,
  // handbrake for a drift feel, building + car collision.
  updatePlayer(dt, input) {
    const car = this.playerCar;
    if (!car) return;
    const def = car.def;
    const fwd = input.up ? 1 : input.down ? -0.55 : 0;
    car.speed += fwd * def.accel * dt;
    // Drag + rolling resistance; handbrake kills grip and speed fast.
    car.speed -= car.speed * (input.handbrake ? 1.6 : 0.55) * dt;
    if (!input.up && !input.down) car.speed -= Math.sign(car.speed) * 6 * dt;
    if (Math.abs(car.speed) < 0.15 && !input.up && !input.down) car.speed = 0;
    car.speed = clamp(car.speed, -def.top * 0.45, def.top);
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const spdF = clamp(Math.abs(car.speed) / def.top, 0, 1);
    const turn = steer * 1.9 * spdF * (input.handbrake ? 1.5 : 1) * Math.sign(car.speed || 1);
    car.heading += turn * dt;
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const hit = City.collideCircle(nx, nz, 4.6);
    if (hit.x !== nx || hit.z !== nz) {
      car.speed *= 0.55;
      car.condition = Math.max(5, car.condition - Math.abs(car.speed) * 0.02);
      if (Math.abs(car.speed) > 14 && Math.random() < 0.3) Particles.burst(car.x, 2, car.z, 0xffcc66, 6);
    }
    car.x = hit.x; car.z = hit.z;
    // Wheel spin + body roll for feel.
    const spin = car.speed * dt * 1.4;
    for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    car.mesh.rotation.z = -steer * 0.04 * spdF;
    // Exhaust puffs when accelerating hard.
    if (input.up && Math.random() < dt * 8) {
      const bx = car.x - Math.sin(car.heading) * 4.6, bz = car.z - Math.cos(car.heading) * 4.6;
      Particles.puff(bx, 1, bz);
    }
  },

  updateTraffic(dt) {
    for (const car of this.list) {
      if (!car.traffic) continue;
      // Car ahead? Slow down instead of rear-ending it.
      let ahead = null, ad = 26;
      for (const o of this.list) {
        if (o === car) continue;
        const dx = o.x - car.x, dz = o.z - car.z;
        const fwd = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
        const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
        if (fwd > 0 && fwd < ad && side < 6) { ad = fwd; ahead = o; }
      }
      const want = ahead ? Math.max(0, car.targetSpeed * (ad / 26)) : car.targetSpeed;
      car.speed = lerp(car.speed, want, dt * 1.5);
      let nx = car.x + Math.sin(car.heading) * car.speed * dt;
      let nz = car.z + Math.cos(car.heading) * car.speed * dt;
      // At an intersection, sometimes turn onto the cross street.
      const nearX = AVENUES.some(a => Math.abs(nx - a) < 6);
      const nearZ = STREETS.some(s => Math.abs(nz - s) < 6);
      if (nearX && nearZ && Math.random() < dt * 0.25) {
        const turns = [0, Math.PI / 2, -Math.PI / 2, Math.PI];
        car.heading = (Math.round(car.heading / (Math.PI / 2)) + pick([-1, 1], Math.random)) * (Math.PI / 2);
        void turns;
      }
      const hit = City.collideCircle(nx, nz, 4.6);
      if (hit.x !== nx || hit.z !== nz) {
        // Bumped a building: turn around-ish (reverse heading 90°) and carry on.
        car.heading += Math.PI / 2;
        car.speed *= 0.4;
        nx = car.x; nz = car.z;
      }
      car.x = hit.x; car.z = hit.z;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      const spin = car.speed * dt * 1.4;
      for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
    }
  },

  // Flash the cop light bar red/blue, alternating.
  updateCopLights(t) {
    for (const c of this.list) {
      if (!c.cop || !c.mesh.userData.lightBar) continue;
      const on = Math.floor(t * 6) % 2 === 0;
      c.mesh.userData.lightBar.red.material.color.setHex(on ? 0xff2222 : 0x550000);
      c.mesh.userData.lightBar.blue.material.color.setHex(on ? 0x111144 : 0x2244ff);
    }
  },

  removeCar(car) {
    const i = this.list.indexOf(car);
    if (i >= 0) this.list.splice(i, 1);
    if (car.mesh.parent) car.mesh.parent.remove(car.mesh);
    if (this.playerCar === car) this.playerCar = null;
  },

  gearOf(car) {
    if (!car) return 'N';
    const s = Math.abs(car.speed);
    if (s < 0.5) return 'N';
    if (car.speed < 0) return 'R';
    const f = s / car.def.top;
    return 'G' + (f < 0.25 ? 1 : f < 0.5 ? 2 : f < 0.75 ? 3 : f < 0.92 ? 4 : 5);
  },
  kmh(car) { return car ? Math.abs(Math.round(car.speed * 3.2)) : 0; },
};
