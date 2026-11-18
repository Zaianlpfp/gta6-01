// Solmar Bay — particles.js
// One job: short-lived visual effects — muzzle flashes, exhaust puffs,
// impact sparks, smoke, and skid marks left on the asphalt.
'use strict';

const Particles = {
  pool: [], marks: [], flashLight: null, sceneFlash: false,

  init(scene) {
    this.flashLight = new THREE.PointLight(0xffcc66, 0, 30);
    scene.add(this.flashLight);
  },

  burst(x, y, z, color, n) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshBasicMaterial({ color }));
      m.position.set(x, y, z);
      G.scene.add(m);
      this.pool.push({
        mesh: m, life: 0.4 + Math.random() * 0.3, max: 0.7,
        vx: (Math.random() - 0.5) * 14, vy: Math.random() * 8, vz: (Math.random() - 0.5) * 14,
      });
    }
  },

  puff(x, y, z) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.8, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.5 }));
    m.position.set(x, y, z);
    G.scene.add(m);
    this.pool.push({ mesh: m, life: 0.9, max: 0.9, vx: (Math.random() - 0.5) * 2, vy: 1.5, vz: (Math.random() - 0.5) * 2, grow: true });
  },

  muzzle(x, y, z) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffdd66 }));
    m.position.set(x, y, z);
    G.scene.add(m);
    // In a staged screenshot scene the flash stays lit so the shot reads.
    this.pool.push({ mesh: m, life: this.sceneFlash ? 999 : 0.06, max: 0.06, vx: 0, vy: 0, vz: 0 });
    this.flashLight.position.set(x, y, z);
    this.flashLight.intensity = 2.2;
  },

  skid(x, z, heading) {
    if (this.marks.length > 40) {
      const old = this.marks.shift();
      if (old.parent) old.parent.remove(old);
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 3.4),
      new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = heading;
    m.position.set(x, 0.12, z);
    G.scene.add(m);
    this.marks.push(m);
  },

  update(dt) {
    if (this.flashLight && !this.sceneFlash) this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 30);
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const p = this.pool[i];
      p.life -= dt;
      if (p.life <= 0) {
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        p.mesh.material.dispose();
        this.pool.splice(i, 1);
        continue;
      }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.grow) { p.mesh.scale.multiplyScalar(1 + dt * 2); p.mesh.material.opacity = p.life / p.max * 0.5; }
      else p.mesh.material.opacity = 1;
      if (p.mesh.material.transparent !== true && p.life < 0.15) p.mesh.scale.setScalar(Math.max(0.1, p.life / p.max));
    }
  },
};
