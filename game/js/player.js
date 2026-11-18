// Solmar Bay — player.js
// One job: the player on foot — walk/run, enter and steal cars, talk to
// shops, collect sun coins, and the busted / wasted consequences.
'use strict';

const Player = {
  mesh: null, legs: null, body: null, armR: null, walkPhase: 0,

  makeMesh(scene) {
    const g = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0xe0ac69 });
    const shirt = new THREE.MeshLambertMaterial({ color: 0xff2e63 });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2f3542 });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), pants);
    legs.position.y = 0.55; g.add(legs);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.65), shirt);
    body.position.y = 1.8; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.75), skin);
    head.position.y = 2.9; head.castShadow = true; g.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.8), new THREE.MeshLambertMaterial({ color: 0xffc300 }));
    cap.position.y = 3.3; g.add(cap);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 0.35), shirt);
    armR.position.set(0.8, 1.9, 0.2); g.add(armR);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 0.35), shirt);
    armL.position.set(-0.8, 1.9, 0.2); g.add(armL);
    // Pistol in hand (visible when armed).
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.7), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.8, 1.35, 0.5); g.add(gun);
    this.armR = armR;
    g.position.set(G.player.x, 0, G.player.z);
    scene.add(g);
    this.mesh = g;
    return g;
  },

  spawn() {
    G.player.x = -1350; G.player.z = -420;
    G.player.heading = Math.PI / 2;
    G.player.health = 100; G.player.armor = 0;
    if (this.mesh) { this.mesh.position.set(G.player.x, 0, G.player.z); this.mesh.rotation.y = G.player.heading; }
  },

  // On-foot movement, relative to the camera yaw. Mouse steers the camera.
  update(dt, input) {
    if (Vehicles.playerCar) return;
    const run = input.run;
    const speed = run ? TUNE.playerRun : TUNE.playerWalk;
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let mz = (input.up ? 1 : 0) - (input.down ? 1 : 0);
    if (mx || mz) {
      const len = Math.hypot(mx, mz); mx /= len; mz /= len;
      // Camera-relative: forward is where the camera looks.
      const cy = G.cameraYaw;
      const wx = mx * Math.cos(cy) + mz * Math.sin(cy);
      const wz = -mx * Math.sin(cy) + mz * Math.cos(cy);
      const want = Math.atan2(wx, wz);
      G.player.heading = angleLerp(G.player.heading, want, dt * 10);
      const nx = G.player.x + wx * speed * dt;
      const nz = G.player.z + wz * speed * dt;
      const hit = City.collideCircle(nx, nz, 1.1);
      G.player.x = hit.x; G.player.z = hit.z;
      this.walkPhase += dt * speed * 1.4;
      // Skid/step dust when running.
      if (run && Math.random() < dt * 4) Particles.puff(G.player.x, 0.4, G.player.z);
    }
    // Face the aim point while firing.
    if (Combat.firing && Combat.aimPoint) {
      G.player.heading = angleLerp(G.player.heading,
        Math.atan2(Combat.aimPoint.x - G.player.x, Combat.aimPoint.z - G.player.z), dt * 14);
    }
    const bob = (mx || mz) ? Math.abs(Math.sin(this.walkPhase)) * 0.14 : 0;
    this.mesh.position.set(G.player.x, bob, G.player.z);
    this.mesh.rotation.y = G.player.heading;
    this.mesh.rotation.x = Math.sin(this.walkPhase) * 0.05;
    // Aiming pose: right arm raises.
    const aiming = Combat.firing || Combat.aimPoint;
    this.armR.rotation.x = aiming ? -1.3 : Math.sin(this.walkPhase) * 0.4;
    // Health regen when the heat is off.
    if (G.heat === 0 && G.player.health > 0 && G.player.health < 100) G.player.health = Math.min(100, G.player.health + 2 * dt);
  },

  // E near a car: get in (stealing a parked/traffic car raises heat).
  tryEnterCar() {
    if (Vehicles.playerCar) return false;
    const car = Vehicles.nearestCar(G.player.x, G.player.z, 9);
    if (!car) return false;
    const stolen = car.parked || car.traffic;
    Vehicles.enterCar(car);
    G.player.x = car.x; G.player.z = car.z;
    if (stolen) Police.addHeat(12, 'GRAND THEFT AUTO');
    if (car.def.id === 'taxi') Missions.startTaxiFare();
    AudioSys.blip(300, 0.1, 'square', 0.15);
    return true;
  },

  exitToFoot() {
    const car = Vehicles.exitCar();
    if (!car) return;
    const a = car.heading + Math.PI / 2;
    G.player.x = car.x + Math.sin(a) * 4;
    G.player.z = car.z + Math.cos(a) * 4;
    const hit = City.collideCircle(G.player.x, G.player.z, 1.1);
    G.player.x = hit.x; G.player.z = hit.z;
    G.player.heading = car.heading;
  },

  // E near a shop / service point.
  tryInteract() {
    const px = G.player.x, pz = G.player.z;
    for (const lm of LANDMARKS) {
      if (dist2d(px, pz, lm.x, lm.z) > 26) continue;
      if (lm.kind === 'gunshop') { HUD.openShop('guns'); return true; }
      if (lm.kind === 'respray') { this.respray(); return true; }
      if (lm.kind === 'safehouse') { SaveGame.manualSave(); showToast('SAFEHOUSE — game saved'); return true; }
      if (lm.kind === 'hospital' && G.player.health < 100) {
        const cost = Math.round((100 - G.player.health) * 2);
        if (G.cash >= cost) { G.cash -= cost; G.player.health = 100; showToast('TREATED — ' + fmtCash(cost)); AudioSys.pickup(); }
        else showToast('Treatment costs ' + fmtCash(cost));
        return true;
      }
      if (lm.kind === 'chopshop') { showToast("Dante's Chop Shop — bring him cars, he pays cash"); return true; }
    }
    return false;
  },

  respray() {
    const car = Vehicles.playerCar;
    if (!car) { showToast('Respray needs a car — drive one in'); return; }
    if (G.cash < SHOP.respray.price) { showToast('Respray costs ' + fmtCash(SHOP.respray.price)); return; }
    G.cash -= SHOP.respray.price;
    const newColor = pick([0xff2e63, 0x08d9d6, 0xffc300, 0x7b2ff7, 0x2e86ff], Math.random);
    car.color = newColor;
    car.mesh.children.forEach(ch => {
      if (ch.geometry && ch.geometry.type === 'BoxGeometry' && ch.position.y === 1.15) ch.material = new THREE.MeshLambertMaterial({ color: newColor });
    });
    car.condition = 100;
    G.heat = Math.max(0, G.heat - 20); // respray drops one wanted star
    showToast('RESPRAY — new paint, one star gone');
    AudioSys.pickup();
  },

  // Sun coins: walk over one to collect $50 + REP.
  checkCoins() {
    for (const c of City.coinMeshes) {
      if (c.taken) continue;
      if (dist2d(G.player.x, G.player.z, c.x, c.z) < 6) {
        c.taken = true;
        if (c.mesh.parent) c.mesh.parent.remove(c.mesh);
        G.cash += 50; G.rep += 15; G.stats.coins++;
        AudioSys.coin();
        showToast('SUN COIN  +' + fmtCash(50) + '  (' + G.stats.coins + '/' + SUN_COINS + ')');
        HUD.refreshAll();
      }
    }
  },

  busted() {
    AudioSys.busted();
    const fine = Math.min(G.cash, SHOP && TUNE.bustedFine);
    G.cash -= fine;
    G.heat = 0;
    Police.removeHeli();
    for (const c of Police.cruisers.splice(0)) Vehicles.removeCar(c);
    for (const f of Police.footCops.splice(0)) Police.removeFootCop(f);
    if (Vehicles.playerCar) Vehicles.exitCar();
    const h = landmark('hospital');
    G.player.x = h.x + 40; G.player.z = h.z + 40;
    G.player.health = 100;
    Missions.fail('Busted by the SBPD');
    HUD.showBusted('BUSTED', 'The SBPD caught you. Fine: ' + fmtCash(fine) + '. You wake up at St. Coral Hospital.');
  },

  wasted() {
    AudioSys.busted();
    const loss = Math.round(G.cash * TUNE.wastedLoss);
    G.cash -= loss;
    G.heat = 0;
    Police.removeHeli();
    for (const c of Police.cruisers.splice(0)) Vehicles.removeCar(c);
    for (const f of Police.footCops.splice(0)) Police.removeFootCop(f);
    if (Vehicles.playerCar) Vehicles.exitCar();
    const h = landmark('hospital');
    G.player.x = h.x + 40; G.player.z = h.z + 40;
    G.player.health = 100;
    Missions.fail('Wasted');
    HUD.showBusted('WASTED', 'You wake up at St. Coral Hospital. The city took ' + fmtCash(loss) + '.');
  },
};
