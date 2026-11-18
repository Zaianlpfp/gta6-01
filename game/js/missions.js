// Solmar Bay — missions.js
// One job: the story — 8 named jobs from Mara Solis and Dante Voss, each a
// small state machine of stages (car / goto / pickup / steal / wait / escape),
// with dialog, timers, payouts, REP and a GPS beacon in the world.
'use strict';

const Missions = {
  active: null,        // mission def currently running
  stageIdx: 0, stageT: 0, timerLeft: 0, beacon: null, beaconRing: null,
  dialogQueue: [], dialogT: 0, done: {}, order: [],

  start(id) {
    const def = MISSIONS.find(m => m.id === id);
    if (!def || this.done[id] || (this.active && this.active.id === id)) return false;
    if (id > 1 && !this.done[id - 1]) return false; // sequential story
    this.active = def;
    this.stageIdx = 0;
    this.stageT = 0;
    this.heatAdded = false;
    this.timerLeft = def.timer || 0;
    if (def.id === 4) { G.heat = 60; AudioSys.setSiren(true); } // "Heat" starts with the whole department on you
    if (def.night) DayCycle.setTime(22 * 60 + 5); // night run starts after dark
    this.showDialog(def.contact, def.portrait, def.dialog);
    this.setBeaconForStage();
    AudioSys.missionDone();
    showToast(def.chapter + ' · ' + def.title.toUpperCase() + ' — ' + fmtCash(def.payout));
    return true;
  },

  currentStage() {
    return this.active ? this.active.stages[this.stageIdx] : null;
  },

  setBeaconForStage() {
    this.clearBeacon();
    const st = this.currentStage();
    if (!st || st.type === 'car' || st.type === 'escape') return;
    if (st.x === undefined) return;
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffc300, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
    cyl.position.y = 30; g.add(cyl);
    const dia = new THREE.Mesh(new THREE.OctahedronGeometry(3.4),
      new THREE.MeshBasicMaterial({ color: 0xffc300 }));
    dia.position.y = 24; g.add(dia);
    g.position.set(st.x, 0, st.z);
    G.scene.add(g);
    const ring = new THREE.Mesh(new THREE.RingGeometry((st.r || 16) - 2, st.r || 16, 40),
      new THREE.MeshBasicMaterial({ color: 0xffc300, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(st.x, 0.25, st.z);
    G.scene.add(ring);
    this.beacon = g; this.beaconRing = ring;
  },
  clearBeacon() {
    if (this.beacon && this.beacon.parent) this.beacon.parent.remove(this.beacon);
    if (this.beaconRing && this.beaconRing.parent) this.beaconRing.parent.remove(this.beaconRing);
    this.beacon = null; this.beaconRing = null;
  },

  advance() {
    this.stageIdx++;
    this.stageT = 0;
    this.heatAdded = false;
    AudioSys.pickup();
    // Mission 7: touching the cargo wakes the whole city — four stars.
    if (this.active && this.active.id === 7 && this.stageIdx === 2) Police.addHeat(80, 'FOUR STARS — HARBOR LIGHTS');
    if (this.stageIdx >= this.active.stages.length) this.complete();
    else this.setBeaconForStage();
  },

  complete() {
    const def = this.active;
    this.done[def.id] = true;
    G.missionsDone++;
    G.cash += def.payout;
    G.rep += def.xp;
    this.clearBeacon();
    this.active = null;
    AudioSys.missionDone();
    showToast('JOB COMPLETE — ' + def.title.toUpperCase() + '  +' + fmtCash(def.payout) + '  +' + def.xp + ' REP');
    this.showDialog(def.contact, def.portrait, [this.completeLine(def)]);
    // Weapon unlocks: toast exactly when the weapon actually unlocks
    // (Combat.unlocked: missionsDone >= unlockMission — after mission N
    // completes, missionsDone is N, so the toast fires on def.id, not def.id+1).
    for (const w of WEAPONS) if (w.unlockMission === def.id) showToast('UNLOCKED: ' + w.name);
    if (def.id === 8) showToast('STORY COMPLETE — you run Solmar Bay now');
    SaveGame.autosave();
    HUD.refreshAll();
  },
  completeLine(def) {
    const lines = {
      1: 'Clean run. The fares love you already. Come back when you want real money.',
      2: 'Delivered, no questions. That is how you stay alive in this town, cariño.',
      3: 'Dante says the GT is sweet. You drive like you were born in the back seat.',
      4: 'Ghost. Not a single unit knows where you went. That is the whole job.',
      5: 'Two drops, no headlights off, no cops. You are my night guy now, kid.',
      6: 'Two cars, cash in hand. The chop shop eats well tonight because of you.',
      7: 'Four stars and you still brought my cargo home. The city is yours, cariño.',
      8: 'Five thousand and the bank will never know what hit it. Solmar Bay is yours now.',
    };
    return lines[def.id] || 'Good work.';
  },

  fail(reason) {
    if (!this.active) return;
    showToast('JOB FAILED — ' + reason);
    this.clearBeacon();
    this.active = null;
    HUD.refreshAll();
  },

  // Mission stage logic, called every frame while a mission runs.
  update(dt) {
    // Dialog auto-advance.
    if (this.dialogT > 0) {
      this.dialogT -= dt;
      if (this.dialogT <= 0) HUD.hideDialog();
    }
    if (!this.active) return;
    const st = this.currentStage();
    if (!st) return;
    // Mission timer.
    if (this.active.timer) {
      this.timerLeft -= dt;
      if (this.timerLeft <= 0) { this.fail('Out of time'); return; }
    }
    const px = G.player.x, pz = G.player.z;
    switch (st.type) {
      case 'car':
        if (Vehicles.playerCar) this.advance();
        break;
      case 'goto':
        if (dist2d(px, pz, st.x, st.z) < st.r) this.advance();
        break;
      case 'pickup':
        if (dist2d(px, pz, st.x, st.z) < st.r && G.keys.e) { G.keys.e = false; this.advance(); }
        break;
      case 'steal': {
        const car = this.stealTargetFor(st);
        if (car && Vehicles.playerCar === car) { Police.addHeat(15, 'GRAND THEFT AUTO'); this.advance(); }
        else if (dist2d(px, pz, st.x, st.z) < st.r) HUD.showPrompt('Press E to steal the car');
        break;
      }
      case 'wait': {
        if (dist2d(px, pz, st.x, st.z) < st.r) {
          if (!this.heatAdded) { this.heatAdded = true; Police.addHeat(40, 'BANK ALARM TRIPPED'); }
          this.stageT += dt;
          if (this.stageT >= st.t) this.advance();
        } else this.stageT = Math.max(0, this.stageT - dt);
        break;
      }
      case 'escape': {
        const safe = landmark('safehouse');
        const atSafe = dist2d(px, pz, safe.x, safe.z) < 30;
        if (atSafe && G.heat < 40) { this.advance(); break; }
        if (this.active.id === 4) {
          // "Heat": survive until the heat cools off.
          if (G.heat <= 0) this.advance();
        } else if (this.stageT === 0 && st.t) {
          this.stageT = 1; // mark started
        }
        if (st.t && this.stageT > 0) {
          this.stageT += dt;
          if (this.stageT > st.t && G.heat <= 0) this.advance();
        }
        break;
      }
    }
    // Beacon spin + bob.
    if (this.beacon) {
      this.beacon.rotation.y += dt * 1.5;
      this.beacon.children[1].position.y = 24 + Math.sin(G.time * 2.4) * 1.6;
    }
  },

  stealTargetFor(st) {
    if (this.active.id === 3) return Vehicles.stealSolstice;
    if (this.active.id === 6) return this.stageIdx === 0 ? Vehicles.stealMarlin : Vehicles.stealRunner;
    return null;
  },

  showDialog(name, portrait, lines) {
    this.dialogQueue = lines.slice();
    this.dialogT = 0;
    this.nextDialogLine(name, portrait);
  },
  nextDialogLine(name, portrait) {
    if (!this.dialogQueue.length) { HUD.hideDialog(); return; }
    const line = this.dialogQueue.shift();
    HUD.showDialog(name, portrait, line);
    this.dialogT = 5.5;
  },

  // GPS: distance + direction to the current objective.
  gps() {
    if (!this.active) return null;
    const st = this.currentStage();
    if (!st) return null;
    if (st.type === 'escape') {
      const safe = landmark('safehouse');
      return { x: safe.x, z: safe.z, label: 'SAFEHOUSE' };
    }
    if (st.x === undefined) return null;
    return { x: st.x, z: st.z, label: st.text };
  },

  // Taxi side work: pick up a fare, drop them off, get paid.
  taxi: { fare: null, drop: null, active: false },
  startTaxiFare() {
    if (this.taxi.active || this.active) return;
    const spots = [
      { x: -1330, z: -520 }, { x: -1380, z: 620 }, { x: 900, z: -620 },
      { x: 1000, z: 180 }, { x: 260, z: 480 }, { x: -700, z: 1020 },
    ];
    const pick = spots[Math.floor(Math.random() * spots.length)];
    const drop = spots[Math.floor(Math.random() * spots.length)];
    this.taxi = { fare: pick, drop, active: true, picked: false };
    Peds.spawnFare(G.scene, pick.x, pick.z);
    showToast('TAXI FARE — pick up the passenger at ' + districtAt(pick.x, pick.z));
  },
  updateTaxi(dt) {
    if (!this.taxi.active) return;
    const t = this.taxi;
    if (!t.picked) {
      if (dist2d(G.player.x, G.player.z, t.fare.x, t.fare.z) < 12 && Vehicles.playerCar) {
        t.picked = true;
        Peds.clearFare();
        showToast('Passenger aboard — take them to ' + districtAt(t.drop.x, t.drop.z));
        AudioSys.pickup();
      }
    } else if (dist2d(G.player.x, G.player.z, t.drop.x, t.drop.z) < 16) {
      G.cash += FARE_PAY; G.rep += 25;
      showToast('FARE COMPLETE  +' + fmtCash(FARE_PAY) + '  +25 REP');
      AudioSys.coin();
      this.taxi.active = false;
      HUD.refreshAll();
    }
  },
};
