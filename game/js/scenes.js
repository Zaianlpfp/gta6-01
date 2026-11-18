// Solmar Bay — scenes.js
// One job: ?scene= presets that stage the game for screenshots — a dense
// chase, a night firefight, the full city map, and a beach taxi fare.
// Each preset puts the world in a fixed, readable state and raises
// window.__sceneReady when the frame is ready to capture.
'use strict';

const Scenes = {
  name: null,

  apply(name) {
    this.name = name;
    const go = (fn) => { try { fn(); } catch (e) { console.error('scene error', e); } };
    if (name === 'cover') go(() => this.cover());
    else if (name === 'street') go(() => this.street());
    else if (name === 'map') go(() => this.map());
    else if (name === 'beach') go(() => this.beach());
    else go(() => this.cover());
    // Let two frames render, then flag readiness for the screenshot tool.
    setTimeout(() => { window.__sceneReady = true; }, 1200);
  },

  // The cover: sunset downtown chase — Solstice GT, 4 stars, AIR-1 above,
  // three cruisers closing in, mission 7 running, Mara on the dialog box.
  cover() {
    G.state = 'play';
    DayCycle.setTime(18 * 60 + 52);
    G.cash = 38420; G.rep = 458; G.missionsDone = 4;
    Missions.done = { 1: true, 2: true, 3: true, 4: true };
    const car = Vehicles.stealSolstice || Vehicles.list[0];
    Vehicles.enterCar(car);
    car.x = -10; car.z = 200; car.heading = Math.PI; car.speed = 34; car.condition = 100;
    G.player.x = car.x; G.player.z = car.z;
    G.heat = 82;
    Police.spawnHeli();
    for (let i = 0; i < 3; i++) Police.spawnCruiser();
    // Two cruisers close in — one ramming from behind, one ahead on the road.
    if (Police.cruisers[0]) { Police.cruisers[0].x = -14; Police.cruisers[0].z = 258; Police.cruisers[0].heading = Math.PI; }
    if (Police.cruisers[1]) { Police.cruisers[1].x = 6; Police.cruisers[1].z = 120; Police.cruisers[1].heading = 0; }
    // Pack the avenue with traffic for density.
    for (let i = 0; i < 6; i++) {
      const def = pick(VEHICLES.filter(v => v.id !== 'cop'), Math.random);
      const c = Vehicles.spawn(G.scene, def, (Math.random() < 0.5 ? -8 : 8), 120 - i * 55, Math.PI, { traffic: true, targetSpeed: 12 });
      c.speed = 12;
    }
    Missions.active = MISSIONS[6];
    Missions.stageIdx = 2; Missions.timerLeft = 126;
    Missions.setBeaconForStage();
    HUD.showDialog('Mara Solis', 'mara.jpg', 'Alarms are back! You\u2019ve got the whole department coming — lose them!');
    Missions.dialogT = 999;
    Combat.select(2);
    AudioSys.station = 0;
    HUD.refreshAll(); HUD.refreshRadio();
    G.cameraYaw = Math.PI;
  },

  // Night firefight on foot in Old Mercado — shotgun out, cruiser + foot
  // cops closing in, Dante on the dialog box, neon everywhere.
  street() {
    G.state = 'play';
    DayCycle.setTime(22 * 60 + 30);
    G.cash = 18450; G.rep = 1960; G.missionsDone = 6;
    Missions.done = { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true };
    G.player.x = 760; G.player.z = -520; G.player.heading = 2.19;
    G.heat = 62;
    Combat.mag.smg = 32; Combat.reserve.smg = 128;
    Combat.mag.shotgun = 6; Combat.reserve.shotgun = 18;
    Combat.select(3);
    Police.spawnCruiser();
    const fc1 = Police.spawnFootCop(); fc1.x = 790; fc1.z = -545;
    const fc2 = Police.spawnFootCop(); fc2.x = 775; fc2.z = -555;
    Missions.active = MISSIONS[6];
    Missions.stageIdx = 2; Missions.timerLeft = 187;
    Missions.setBeaconForStage();
    HUD.showDialog('Dante Voss', 'dante.jpg', 'Lose that helicopter before you come near my garage! Switch cars, change clothes, anything!');
    Missions.dialogT = 999;
    Combat.firing = true;
    // Aim at the gun store's neon sign, north-east of the player.
    Combat.aimPoint = new THREE.Vector3(900, 8, -620);
    Particles.sceneFlash = true; // keep the muzzle glow visible for the shot
    // Fire once right now (game time crawls in a software renderer, so the
    // rate limiter would never let the staged shot go off on its own).
    const mx = G.player.x + Math.sin(2.19) * 1.2, mz = G.player.z + Math.cos(2.19) * 1.2;
    Particles.muzzle(mx, 2.6, mz);
    const pos = Combat.tracer.geometry.attributes.position;
    pos.setXYZ(0, mx, 2.6, mz);
    pos.setXYZ(1, 900, 8, -620);
    pos.needsUpdate = true;
    Combat.tracer.material.opacity = 0.9;
    AudioSys.station = 2;
    HUD.refreshAll(); HUD.refreshRadio();
    G.cameraYaw = 2.19; // look north-east, toward the gun store's neon sign
  },

  // The full city map: every job, payout, legend and district in one frame.
  map() {
    G.state = 'play';
    DayCycle.setTime(17 * 60 + 24);
    G.cash = 12480; G.rep = 1120; G.missionsDone = 3;
    Missions.done = { 1: true, 2: true, 3: true };
    G.player.x = 0; G.player.z = 0;
    Missions.active = MISSIONS[3]; // Heat — GPS points at the safehouse
    Missions.stageIdx = 0; Missions.timerLeft = 75;
    HUD.refreshAll();
    HUD.toggleMap();
  },

  // Beach taxi fare at golden hour — palms, umbrella row, marina boats.
  beach() {
    G.state = 'play';
    DayCycle.setTime(17 * 60 + 24);
    G.cash = 2450; G.rep = 320; G.missionsDone = 1;
    Missions.done = { 1: true };
    const taxi = Vehicles.starterTaxi;
    Vehicles.enterCar(taxi);
    taxi.x = -1200; taxi.z = -600; taxi.heading = 0; taxi.speed = 18;
    G.player.x = taxi.x; G.player.z = taxi.z;
    Missions.active = MISSIONS[0]; // First Fare — a taxi job, no timer
    Missions.stageIdx = 2; Missions.timerLeft = 0;
    Missions.setBeaconForStage();
    Peds.spawnFare(G.scene, -1230, -480); // a waiting fare by the beach road
    HUD.showDialog('Mara Solis', 'mara.jpg', 'Two stops. Easy money. Don\u2019t scratch the paint.');
    Missions.dialogT = 999;
    AudioSys.station = 1;
    HUD.refreshAll(); HUD.refreshRadio();
    G.cameraYaw = 0; // look south, down the beach road toward the marina
  },
};
