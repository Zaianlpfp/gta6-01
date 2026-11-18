// Solmar Bay — main.js
// One job: boot the game — renderer, lights, day/night cycle, the frame loop,
// the chase camera, and the glue that runs every system each tick.
'use strict';

// ---- Global state ---------------------------------------------------------
const G = {
  state: 'title', time: 0, day: 1, minutes: TUNE.startHour * 60 + TUNE.startMinute,
  cash: 250, rep: 0, heat: 0, missionsDone: 0,
  keys: {}, pressed: {}, cameraYaw: Math.PI, cameraPitch: 0.22,
  player: { x: -1350, z: -420, heading: Math.PI / 2, health: 100, armor: 0 },
  stats: { coins: 0, carsStolen: 0, copsDown: 0 },
  missionEscape: false, scene: null, renderer: null, camera: null, sun: null, hemi: null,
};
window.G = G;

// ---- Day / night cycle -----------------------------------------------------
const DayCycle = {
  // [hour, sky, fog, sun color, sun intensity, hemi intensity]
  keys: [
    [0, 0x0d0d24, 0x14142b, 0x8fa3ff, 0.3, 0.45],
    [5, 0x1a1a2e, 0x232344, 0x8fa3ff, 0.3, 0.45],
    [7, 0xffb37a, 0xf7a072, 0xffc27a, 1.0, 0.6],
    [10, 0x87ceeb, 0xa8c8d8, 0xfff2cc, 1.35, 0.85],
    [16, 0x87ceeb, 0xa8c8d8, 0xfff2cc, 1.35, 0.85],
    [18, 0xff8c5a, 0xf78f6a, 0xffb347, 1.25, 0.7],
    [19.5, 0x6b4a8f, 0x7a5570, 0xff7a5c, 0.7, 0.5],
    [21, 0x14142b, 0x1c1c38, 0x8fa3ff, 0.32, 0.45],
    [24, 0x0d0d24, 0x14142b, 0x8fa3ff, 0.3, 0.45],
  ],
  setTime(mins) { G.minutes = mins % 1440; this.apply(); },
  apply() {
    const h = G.minutes / 60;
    let a = this.keys[0], b = this.keys[this.keys.length - 1];
    for (let i = 0; i < this.keys.length - 1; i++) {
      if (h >= this.keys[i][0] && h <= this.keys[i + 1][0]) { a = this.keys[i]; b = this.keys[i + 1]; break; }
    }
    const t = clamp((h - a[0]) / Math.max(0.01, b[0] - a[0]), 0, 1);
    const sky = new THREE.Color(a[1]).lerp(new THREE.Color(b[1]), t);
    const fog = new THREE.Color(a[2]).lerp(new THREE.Color(b[2]), t);
    const sunC = new THREE.Color(a[3]).lerp(new THREE.Color(b[3]), t);
    if (!G.scene) return;
    G.scene.background = sky;
    G.scene.fog.color.copy(fog);
    if (G.sun) {
      G.sun.color.copy(sunC);
      G.sun.intensity = lerp(a[4], b[4], t);
      const ang = (h / 24) * Math.PI * 2 - Math.PI / 2;
      G.sun.position.set(G.player.x + Math.cos(ang) * 500, Math.sin(ang) * 420 + 80, G.player.z - 320);
      G.sun.target.position.set(G.player.x, 0, G.player.z);
      G.sun.target.updateMatrixWorld();
    }
    if (G.hemi) G.hemi.intensity = lerp(a[5], b[5], t);
    const night = G.sun && G.sun.intensity < 0.4 ? 1 : 0;
    if (City.sunMesh) City.sunMesh.material.color.setHex(night ? 0xdde4ff : 0xffd27a);
  },
  update(dt) {
    G.minutes += dt * TUNE.clockMinutesPerSecond;
    if (G.minutes >= 1440) { G.minutes -= 1440; G.day++; }
    this.apply();
  },
};

// ---- Game boot -------------------------------------------------------------
const Game = {
  clock: null, hudT: 0, frames: 0,

  init() {
    const params = new URLSearchParams(location.search);
    const sceneName = params.get('scene');
    G.sceneName = sceneName;
    // Renderer.
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game-canvas').appendChild(renderer.domElement);
    G.renderer = renderer;
    // Scene + camera + fog.
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xff9a5c);
    scene.fog = new THREE.Fog(0xf7a072, 320, 2400);
    G.scene = scene;
    const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 5000);
    camera.position.set(-1350, 30, -480);
    G.camera = camera;
    // Lights.
    const sun = new THREE.DirectionalLight(0xffb347, 1.05);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
    sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
    sun.shadow.camera.far = 1200;
    scene.add(sun); scene.add(sun.target);
    G.sun = sun;
    const hemi = new THREE.HemisphereLight(0xffd9b0, 0x3a4a3a, 0.6);
    scene.add(hemi);
    G.hemi = hemi;
    // World.
    City.build(scene);
    Vehicles.spawnTraffic(scene);
    Vehicles.spawnMissionCars(scene);
    Peds.spawnAll(scene);
    Player.makeMesh(scene);
    Combat.init(scene);
    Particles.init(scene);
    HUD.init();
    Input.init();
    HUD.refreshRadio();
    DayCycle.setTime(G.minutes);
    addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });
    // Start screen or a screenshot scene.
    if (sceneName) {
      document.getElementById('start-screen').classList.add('hidden');
      document.getElementById('hud').classList.remove('hidden');
      G.state = 'play';
      Scenes.apply(sceneName);
    } else {
      G.state = 'title';
    }
    this.clock = new THREE.Clock();
    renderer.setAnimationLoop(() => this.tick());
  },

  startNew() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    G.state = 'play';
    G.pressed = {};
    Player.spawn();
    showToast('Welcome to Solmar Bay — Mara has work for you. Open the map (M) to pick a job.');
    setTimeout(() => { if (!Missions.active && G.missionsDone === 0) Missions.start(1); }, 2500);
  },

  startContinue() {
    const d = SaveGame.load();
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    G.state = 'play';
    G.pressed = {};
    Player.spawn();
    if (d) { SaveGame.apply(d); Player.spawn(); if (d.player) { G.player.x = d.player.x; G.player.z = d.player.z; } }
    HUD.refreshAll();
    showToast('Welcome back to Solmar Bay');
  },

  tick() {
    const dt = Math.min(0.05, this.clock.getDelta() || 0.016);
    G.time += dt;
    const playing = G.state === 'play';
    if (playing) {
      const input = Input.read();
      // Screenshot scenes hold the hero car at speed so the speedometer reads a chase.
      if (G.sceneName === 'cover' && Vehicles.playerCar) {
        Vehicles.playerCar.speed = 34;
        Vehicles.playerCar.heading = Math.PI;
        Vehicles.playerCar.x = clamp(Vehicles.playerCar.x, -30, 30);
      }
      if (G.sceneName === 'beach' && Vehicles.playerCar) Vehicles.playerCar.speed = 18;
      // Interact edge.
      if (G.pressed.e) {
        G.pressed.e = false;
        if (HUD.shopOpen) HUD.closeShop();
        else if (Vehicles.playerCar) Player.exitToFoot();
        else if (!Player.tryEnterCar()) Player.tryInteract();
      }
      // Driving / walking.
      if (Vehicles.playerCar) Vehicles.updatePlayer(dt, input);
      else Player.update(dt, input);
      // Firing (auto weapons hold, semi-auto fires on the click edge).
      // In the staged night scene the trigger is held down for the shot.
      if (G.sceneName === 'street') Combat.edge = true;
      const w = Combat.weapon();
      if (Combat.firing && (w.auto || Combat.edge)) Combat.tryFire(G.time);
      Combat.edge = false;
      // Aim point: ray from the camera through the screen centre.
      this.updateAim();
      Vehicles.updateTraffic(dt);
      Peds.update(dt, G.player.x, G.player.z, Vehicles.playerCar);
      Police.update(dt);
      Missions.update(dt);
      Missions.updateTaxi(dt);
      Player.checkCoins();
      // Coins spin.
      for (const c of City.coinMeshes) if (!c.taken) c.mesh.rotation.y += dt * 2;
      Particles.update(dt);
      DayCycle.update(dt);
      // Audio follows the world.
      const car = Vehicles.playerCar;
      AudioSys.setEngine(car ? Math.abs(car.speed) / car.def.top : 0, !!car);
      AudioSys.setSiren(Police.stars() > 0);
      // HUD, throttled.
      this.hudT -= dt;
      if (this.hudT <= 0) {
        this.hudT = 0.25;
        HUD.refreshClock(); HUD.refreshStars(); HUD.refreshMission();
        HUD.refreshResponse(); HUD.refreshBars(); HUD.refreshVehicle();
        HUD.refreshCash(); HUD.refreshRep();
        const loc = districtAt(G.player.x, G.player.z) + ' · ' + streetAt(G.player.x, G.player.z);
        HUD.el.location.textContent = loc.toUpperCase();
      }
      HUD.drawMap(HUD.el.minimap, false);
      // Prompt hints.
      if (!Vehicles.playerCar) {
        const car = Vehicles.nearestCar(G.player.x, G.player.z, 9);
        if (car) HUD.showPrompt('Press E to enter the ' + car.name);
        else if (Missions.active && Missions.currentStage() && Missions.currentStage().type === 'pickup' &&
          dist2d(G.player.x, G.player.z, Missions.currentStage().x, Missions.currentStage().z) < 16) HUD.showPrompt('Press E to pick it up');
        else HUD.hidePrompt();
      } else HUD.hidePrompt();
      // Skid marks while handbraking at speed.
      if (Vehicles.playerCar && input.handbrake && Math.abs(Vehicles.playerCar.speed) > 12 && Math.random() < dt * 10) {
        Particles.skid(Vehicles.playerCar.x, Vehicles.playerCar.z, Vehicles.playerCar.heading);
      }
    }
    this.updateCamera(dt);
    G.renderer.render(G.scene, G.camera);
    this.frames++;
    if (this.frames === 3) window.__gameReady = true;
  },

  updateAim() {
    // Centre-screen ray, 120 m out — the crosshair's world point.
    const cam = G.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const origin = cam.position.clone();
    Combat.aimPoint = origin.clone().add(dir.multiplyScalar(60));
    // If the ray hits the ground sooner, use that point.
    if (dir.y < -0.08) {
      const t = -origin.y / dir.y;
      if (t > 0 && t < 120) Combat.aimPoint = origin.clone().add(dir.multiplyScalar(t));
    }
  },

  updateCamera(dt) {
    const cam = G.camera;
    let tx, ty, tz, lx, ly, lz;
    const car = Vehicles.playerCar;
    if (car) {
      const back = 17 + Math.abs(car.speed) * 0.16;
      tx = car.x - Math.sin(car.heading) * back;
      tz = car.z - Math.cos(car.heading) * back;
      ty = 8.5 + Math.abs(car.speed) * 0.05;
      lx = car.x + Math.sin(car.heading) * 14;
      ly = 3;
      lz = car.z + Math.cos(car.heading) * 14;
    } else {
      const d = 11, h = 4.6 + G.cameraPitch * 6;
      tx = G.player.x - Math.sin(G.cameraYaw) * d;
      tz = G.player.z - Math.cos(G.cameraYaw) * d;
      ty = h;
      lx = G.player.x + Math.sin(G.cameraYaw) * 8;
      ly = 2.2;
      lz = G.player.z + Math.cos(G.cameraYaw) * 8;
    }
    // Keep the camera out of buildings.
    const hit = City.collideCircle(tx, tz, 2);
    tx = hit.x; tz = hit.z;
    ty = Math.max(ty, 2.5);
    // In a staged screenshot scene the camera snaps at once (swiftshader
    // renders ~1 frame a second, so a smooth lerp would never settle).
    const k = G.sceneName ? 1 : 1 - Math.pow(0.001, dt); // frame-rate independent smoothing
    cam.position.x = lerp(cam.position.x, tx, k);
    cam.position.y = lerp(cam.position.y, ty, k);
    cam.position.z = lerp(cam.position.z, tz, k);
    cam.lookAt(lx, ly, lz);
  },
};

addEventListener('DOMContentLoaded', () => Game.init());
