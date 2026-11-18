// Solmar Bay — peds.js
// One job: pedestrians — low-poly people who walk the sidewalks, cross at
// corners, wait as taxi fares, and scatter when a car comes at them.
'use strict';

const Peds = {
  list: [], fare: null,

  makePed(scene, x, z) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: pick([0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181, 0xa8e6cf], Math.random) });
    const skin = new THREE.MeshLambertMaterial({ color: pick([0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac], Math.random) });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), new THREE.MeshLambertMaterial({ color: 0x2f3542 }));
    legs.position.y = 0.55; g.add(legs);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.3, 0.6), shirt);
    body.position.y = 1.75; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), skin);
    head.position.y = 2.75; head.castShadow = true; g.add(head);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.3, 0.75),
      new THREE.MeshLambertMaterial({ color: pick([0x1a1a1a, 0x6b4226, 0xd4a017, 0x8d99ae], Math.random) }));
    hair.position.y = 3.15; g.add(hair);
    g.position.set(x, 0, z);
    scene.add(g);
    const p = {
      mesh: g, x, z, heading: Math.random() * Math.PI * 2,
      speed: 1.6 + Math.random() * 1.4, walkPhase: Math.random() * 6,
      fare: false, scared: 0, waitT: 0,
    };
    this.list.push(p);
    return p;
  },

  spawnAll(scene) {
    const rnd = mulberry32(777);
    for (let i = 0; i < TUNE.pedCount; i++) {
      const a = pick(AVENUES, rnd), s = pick(STREETS, rnd);
      const onAve = rnd() < 0.5;
      const x = onAve ? a + (rnd() < 0.5 ? -26 : 26) : -1500 + rnd() * 3000;
      const z = onAve ? -1100 + rnd() * 2200 : s + (rnd() < 0.5 ? -26 : 26);
      if (City.insideCollider(x, z)) continue;
      this.makePed(scene, x, z);
    }
  },

  spawnFare(scene, x, z) {
    if (this.fare) return this.fare;
    const p = this.makePed(scene, x, z);
    p.fare = true; p.speed = 0;
    // A floating "$" marker so the fare reads at a glance.
    const tex = makeCanvas(128, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.font = 'bold 96px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = '#ffd700'; g.shadowBlur = 18; g.fillStyle = '#ffd700';
      g.fillText('$', w / 2, h / 2);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 8),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
    m.position.set(x, 7, z);
    scene.add(m);
    p.fareMarker = m;
    this.fare = p;
    return p;
  },

  clearFare() {
    if (!this.fare) return;
    if (this.fare.fareMarker && this.fare.fareMarker.parent) this.fare.fareMarker.parent.remove(this.fare.fareMarker);
    this.fare.fare = false; this.fare.speed = 2;
    this.fare = null;
  },

  update(dt, playerX, playerZ, playerCar) {
    for (const p of this.list) {
      if (p.fare) { p.walkPhase += dt * 2; continue; }
      // Scatter if a car (player or traffic) is bearing down.
      let threat = null;
      if (playerCar) {
        const d = dist2d(p.x, p.z, playerCar.x, playerCar.z);
        if (d < 14 && Math.abs(playerCar.speed) > 6) threat = playerCar;
      }
      if (threat) {
        p.scared = 1.2;
        const away = Math.atan2(p.x - threat.x, p.z - threat.z);
        p.heading = angleLerp(p.heading, away, dt * 6);
        p.speed = 5.5;
      } else if (p.scared > 0) {
        p.scared -= dt;
        p.speed = 4;
      } else {
        p.speed = lerp(p.speed, 1.6 + (p.baseSpeed || 1.6), dt);
      }
      if (!p.baseSpeed) p.baseSpeed = p.speed;
      // Stroll along the sidewalk; at a corner, pick a new direction.
      p.walkPhase += dt * p.speed * 2.2;
      const nx = p.x + Math.sin(p.heading) * p.speed * dt;
      const nz = p.z + Math.cos(p.heading) * p.speed * dt;
      const nearX = AVENUES.some(a => Math.abs(nx - a) < 30);
      const nearZ = STREETS.some(s => Math.abs(nz - s) < 30);
      if ((nearX && nearZ && Math.random() < dt * 0.5) || Math.random() < dt * 0.02) {
        p.heading = Math.round((p.heading + pick([-Math.PI / 2, Math.PI / 2], Math.random)) / (Math.PI / 2)) * (Math.PI / 2);
      }
      const hit = City.collideCircle(nx, nz, 1);
      p.x = hit.x; p.z = hit.z;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      // Simple walk swing.
      const swing = Math.sin(p.walkPhase) * 0.35;
      p.mesh.rotation.x = swing * 0.12;
      p.mesh.position.y = Math.abs(Math.sin(p.walkPhase)) * 0.12;
    }
    // Fare marker bobs.
    if (this.fare && this.fare.fareMarker) {
      this.fare.fareMarker.position.y = 7 + Math.sin(performance.now() / 300) * 0.8;
      this.fare.fareMarker.rotation.y += dt * 1.5;
    }
  },

  countNear(x, z, r) {
    let n = 0;
    for (const p of this.list) if (dist2d(p.x, p.z, x, z) < r) n++;
    return n;
  },
};
