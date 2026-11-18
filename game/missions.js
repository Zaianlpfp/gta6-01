(function () {
  'use strict';
  var SB = window.SB = window.SB || {};
  var M = SB.missions = SB.missions || {};

  M.JOBS = [
    { id: 'first-fare', title: 'FIRST FARE', contact: 'MARA SOLIS', speaker: 'MARA', payout: 500, stages: [
      { objective: 'Pick up the fare at Hotel Palmera', target: { x: -407, z: 0 }, r: 12 },
      { objective: 'Drop the fare at Pelican Marina', target: { x: -250, z: 407 }, r: 12 } ] },
    { id: 'the-package', title: 'THE PACKAGE', contact: 'MARA SOLIS', speaker: 'MARA', payout: 1200, stages: [
      { objective: 'Pick up the package in Old Mercado', target: { x: 350, z: 7 }, r: 12 },
      { objective: 'Deliver it to the Marina docks', target: { x: -250, z: 407 }, r: 12 },
      { objective: 'Lay low at Mara\u2019s Safehouse', target: { x: 307, z: -250 }, r: 12 } ] },
    { id: 'hot-wheels', title: 'HOT WHEELS', contact: 'MARA SOLIS', speaker: 'JAX', payout: 1800, stages: [
      { objective: 'Steal the VENTO STRADA on Solmar Ave', target: { x: 8, z: 60 }, r: 7 },
      { objective: 'Bring it to Jax\u2019s Garage', target: { x: 350, z: 407 }, r: 12 } ] },
    { id: 'night-run', title: 'NIGHT RUN', contact: 'MARA SOLIS', speaker: 'LUCIA', payout: 2500, stages: [
      { objective: 'Reach the Neon Mile start line', target: { x: -50, z: -307 }, r: 12 },
      { objective: 'Race through Palmetto Heights', target: { x: 350, z: -207 }, r: 12 },
      { objective: 'Finish at CLUB VOLTAGE', target: { x: -50, z: -307 }, r: 12 } ] },
    { id: 'chop-shop', title: 'CHOP SHOP', contact: 'MARA SOLIS', speaker: 'JAX', payout: 3200, stages: [
      { objective: 'Steal the SOLMAR GT in Deco Row', target: { x: -92, z: -150 }, r: 7 },
      { objective: 'Deliver it to Jax\u2019s Garage', target: { x: 350, z: 407 }, r: 12 } ] },
    { id: 'harbor-lights', title: 'HARBOR LIGHTS', contact: 'MARA SOLIS', speaker: 'LUCIA', payout: 3200, stages: [
      { objective: 'Meet Luc\u00eda at Pelican Marina', target: { x: -250, z: 407 }, r: 12 },
      { objective: 'Escort the crew to Bayline Docks', target: { x: 150, z: 407 }, r: 12 },
      { objective: 'Lay low at Mara\u2019s Safehouse', target: { x: 307, z: -250 }, r: 12 } ] },
    { id: 'heat', title: 'HEAT', contact: 'MARA SOLIS', speaker: 'MARA', payout: 4200, stages: [
      { objective: 'Raise your wanted level to 4 stars', type: 'wanted', need: 4 },
      { objective: 'Lose the cops \u2014 get back to 0 stars', type: 'escape' },
      { objective: 'Reach Mara\u2019s Safehouse', target: { x: 307, z: -250 }, r: 12 } ] },
    { id: 'big-score', title: 'THE BIG SCORE', contact: 'MARA SOLIS', speaker: 'LUCIA', payout: 5000, stages: [
      { objective: 'Reach Solmar National Bank', target: { x: 7, z: -50 }, r: 12 },
      { objective: 'Grab the cash \u2014 hold the bank', type: 'wait', secs: 6, target: { x: 7, z: -50 }, r: 12 },
      { objective: 'Escape with the cash! Lose the cops', type: 'escape' },
      { objective: 'Bring the money home to Luc\u00eda', target: { x: 307, z: -250 }, r: 12 } ] }
  ];

  M.SIDE_JOBS = {
    taxi: { name: 'TAXI FARE', desc: 'Pick up a passenger and drop them off', fareMin: 50, fareMax: 150, rep: 10 },
    race: { name: 'STREET RACE', desc: 'Beat the clock through 3 checkpoints', payout: 300, rep: 50 },
    standoff: { name: 'MERCADO STANDOFF', desc: 'Drive the Saltjacks out of the market (4 left)', enemies: 4, payout: 400, rep: 80 },
    tapes: { name: 'SUNSET TAPES', desc: 'Find 20 tapes hidden around the city', total: 20, rep: 15 },
    coins: { name: 'SUN COINS', desc: 'Collect 20 sun coins, $50 each', total: 20, payout: 50, rep: 5 }
  };

  var cur = null, idx = 0, waitT = 0, marker = null, markerRing = null;
  var taxi = null, race = null, standoff = null, collectibles = null;

  M.active = function () { return cur; };
  M.jobById = function (id) {
    for (var i = 0; i < M.JOBS.length; i++) if (M.JOBS[i].id === id) return M.JOBS[i];
    return null;
  };

  function playerPos() {
    var p = SB.world.player;
    return p ? p.pos : null;
  }
  function distTo(t) {
    var pp = playerPos(); if (!pp || !t) return 1e9;
    var dx = pp.x - t.x, dz = pp.z - t.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function ensureMarker() {
    if (marker || !SB.world.scene) return;
    marker = new THREE.Mesh(
      new THREE.CylinderGeometry(2.5, 2.5, 30, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd42a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
    marker.position.y = 15;
    markerRing = new THREE.Mesh(new THREE.RingGeometry(3, 4.2, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd42a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    markerRing.rotation.x = -Math.PI / 2;
    markerRing.position.y = 0.15;
    SB.world.scene.add(marker);
    SB.world.scene.add(markerRing);
    marker.visible = false; markerRing.visible = false;
    M.marker = marker;
  }
  function showMarkerAt(t) {
    ensureMarker();
    if (!marker) return;
    marker.position.x = t.x; marker.position.z = t.z;
    markerRing.position.x = t.x; markerRing.position.z = t.z;
    marker.visible = true; markerRing.visible = true;
  }
  function hideMarker() {
    if (marker) { marker.visible = false; markerRing.visible = false; }
  }
  function syncStateMission() {
    if (!cur) return;
    var st = cur.stages[idx];
    SB.setMission({
      id: cur.id, title: cur.title, contact: cur.contact,
      stage: idx + 1, stageTotal: cur.stages.length,
      objective: st.objective, payout: cur.payout
    });
  }

  M.start = function (id) {
    var job = M.jobById(id);
    if (!job || cur) return false;
    cur = job; idx = 0; waitT = 0;
    for (var i = 0; i < job.stages.length; i++) job.stages[i].done = false;
    syncStateMission();
    var st = job.stages[0];
    if (st.target) showMarkerAt(st.target);
    if (SB.dialog && SB.dialog.showJob) SB.dialog.showJob(job);
    SB.emit('mission-start', { id: job.id, title: job.title });
    return true;
  };

  M.advance = function () {
    if (!cur) return;
    cur.stages[idx].done = true;
    idx++;
    waitT = 0;
    if (idx >= cur.stages.length) { M.complete(); return; }
    syncStateMission();
    var st = cur.stages[idx];
    if (st.target) showMarkerAt(st.target); else hideMarker();
    SB.emit('mission-stage', { id: cur.id, stage: idx + 1, objective: st.objective });
  };

  M.complete = function () {
    if (!cur) return;
    var job = cur;
    SB.addCash(job.payout);
    SB.addRep(Math.floor(job.payout / 10));
    SB.state.missionsDone++;
    cur = null; idx = 0;
    hideMarker();
    SB.clearMission();
    SB.emit('mission-complete', { id: job.id, title: job.title, payout: job.payout });
    if (SB.dialog && SB.dialog.show) {
      SB.dialog.show({ name: 'MARA SOLIS', role: 'FIXER \u2014 SOLMAR BAY', portrait: 'assets/mara.jpg',
        lines: ['Job done, ' + job.title + '. $' + job.payout + ' is yours. Clean work, kid.',
          'Come back when you want the next one. Solmar always pays.'] });
    }
  };

  function adoptPresetMission() {
    var sm = SB.state.mission;
    if (!sm || !sm.id) return;
    var job = M.jobById(sm.id);
    if (!job) return;
    cur = job;
    idx = Math.max(0, Math.min(job.stages.length - 1, (sm.stage || 1) - 1));
    for (var i = 0; i < job.stages.length; i++) job.stages[i].done = i < idx;
    waitT = 0;
    var st = job.stages[idx];
    if (st.target) showMarkerAt(st.target);
  }

  M.update = function (dt) {
    if (!SB.world.scene) return;
    if (!collectibles) spawnCollectibles();
    var sm = SB.state.mission;
    if (sm && (!cur || cur.id !== sm.id || (sm.stage || 1) !== idx + 1)) adoptPresetMission();
    if (!sm && cur) { cur = null; idx = 0; hideMarker(); }
    if (cur) updateStory(dt);
    if (taxi) updateTaxi(dt);
    if (race) updateRace(dt);
    if (collectibles) checkCollectibles(dt);
    if (marker && marker.visible) marker.rotation.y += dt * 0.8;
  };

  function updateStory(dt) {
    var st = cur.stages[idx];
    if (!st) return;
    var type = st.type || 'goto';
    if (type === 'goto') {
      if (distTo(st.target) < (st.r || 12)) M.advance();
    } else if (type === 'wanted') {
      if (SB.state.wanted >= (st.need || 4)) M.advance();
    } else if (type === 'escape') {
      if (SB.state.wanted === 0) M.advance();
    } else if (type === 'wait') {
      waitT += dt;
      if (waitT >= (st.secs || 5)) M.advance();
    }
  }

  function roadPointNear(px, pz, minD, maxD) {
    var roads = SB.world.roads || [];
    for (var i = 0; i < 10 && roads.length; i++) {
      var r = SB.pick(roads);
      var s = SB.rand(r.from + 30, r.to - 30);
      var x = r.axis === 'x' ? s : r.at;
      var z = r.axis === 'x' ? r.at : s;
      var d = distTo({ x: x, z: z });
      if (d >= minD && d <= maxD && !SB.isBlocked(x, z, 1)) return { x: x, z: z };
    }
    return { x: px + 60, z: pz };
  }

  M.startTaxi = function () {
    if (cur || taxi) return false;
    var pp = playerPos(); if (!pp) return false;
    taxi = { pickup: roadPointNear(pp.x, pp.z, 40, 200), drop: null, state: 'pickup' };
    taxi.drop = roadPointNear(taxi.pickup.x, taxi.pickup.z, 80, 300);
    showMarkerAt(taxi.pickup);
    SB.emit('taxi-start', { pickup: taxi.pickup });
    return true;
  };
  function updateTaxi(dt) {
    if (taxi.state === 'pickup' && distTo(taxi.pickup) < 10) {
      taxi.state = 'drop';
      showMarkerAt(taxi.drop);
      SB.emit('taxi-pickup');
    } else if (taxi.state === 'drop' && distTo(taxi.drop) < 10) {
      var fare = SB.randInt(M.SIDE_JOBS.taxi.fareMin, M.SIDE_JOBS.taxi.fareMax);
      SB.addCash(fare);
      SB.addRep(M.SIDE_JOBS.taxi.rep);
      taxi = null;
      hideMarker();
      SB.emit('taxi-complete', { fare: fare });
    }
  }

  M.startRace = function () {
    if (cur || race) return false;
    race = { cp: 0, timeLeft: 100, points: [
      { x: -50, z: -307 }, { x: 350, z: -207 }, { x: -50, z: -307 } ] };
    showMarkerAt(race.points[0]);
    SB.emit('race-start');
    return true;
  };
  function updateRace(dt) {
    race.timeLeft -= dt;
    if (race.timeLeft <= 0) {
      race = null; hideMarker();
      SB.emit('race-failed');
      return;
    }
    if (distTo(race.points[race.cp]) < 12) {
      race.cp++;
      if (race.cp >= race.points.length) {
        SB.addCash(M.SIDE_JOBS.race.payout);
        SB.addRep(M.SIDE_JOBS.race.rep);
        race = null; hideMarker();
        SB.emit('race-complete', { payout: M.SIDE_JOBS.race.payout });
      } else showMarkerAt(race.points[race.cp]);
    }
  }

  M.startStandoff = function () {
    if (cur || standoff) return false;
    var spots = [{ x: 320, z: 100 }, { x: 340, z: 100 }, { x: 360, z: 100 }, { x: 380, z: 100 }];
    var peds = [];
    for (var i = 0; i < spots.length; i++) {
      var g = SB.city.makePedMesh(0xd84a4a, 0x8a5a3a);
      g.position.set(spots[i].x, 0, spots[i].z);
      SB.world.scene.add(g);
      peds.push(g);
    }
    standoff = { left: 4, peds: peds };
    showMarkerAt({ x: 350, z: 100 });
    SB.emit('standoff-start', { left: 4 });
    return true;
  };
  M.standoffDown = function () {
    if (!standoff) return 0;
    var g = standoff.peds.pop();
    if (g) SB.world.scene.remove(g);
    standoff.left--;
    SB.emit('standoff-down', { left: standoff.left });
    if (standoff.left <= 0) {
      SB.addCash(M.SIDE_JOBS.standoff.payout);
      SB.addRep(M.SIDE_JOBS.standoff.rep);
      standoff = null;
      hideMarker();
      SB.emit('standoff-complete', { payout: M.SIDE_JOBS.standoff.payout });
    }
    return standoff ? standoff.left : 0;
  };
  M.standoffLeft = function () { return standoff ? standoff.left : 0; };
  M.standoffPeds = function () {
    if (!standoff) return [];
    return standoff.peds.map(function (g) { return { x: g.position.x, z: g.position.z }; });
  };
  M.standoffHit = function (from, dir, maxDist) {
    if (!standoff || !from || !dir) return false;
    maxDist = maxDist || 80;
    var dl = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z) || 1;
    var dx = dir.x / dl, dy = dir.y / dl, dz = dir.z / dl;
    var best = -1, bestT = maxDist;
    for (var i = 0; i < standoff.peds.length; i++) {
      var g = standoff.peds[i];
      if (!g || !g.position) continue;
      var rx = g.position.x - from.x, ry = 1.0 - from.y, rz = g.position.z - from.z;
      var t = rx * dx + ry * dy + rz * dz;
      if (t < 0 || t > bestT) continue;
      var px = rx - dx * t, py = ry - dy * t, pz = rz - dz * t;
      if (Math.sqrt(px * px + py * py + pz * pz) < 1.6) { best = i; bestT = t; }
    }
    if (best < 0) return false;
    var hit = standoff.peds.splice(best, 1)[0];
    if (hit) SB.world.scene.remove(hit);
    standoff.left--;
    SB.emit('standoff-down', { left: standoff.left });
    if (standoff.left <= 0) {
      SB.addCash(M.SIDE_JOBS.standoff.payout);
      SB.addRep(M.SIDE_JOBS.standoff.rep);
      standoff = null;
      hideMarker();
      SB.emit('standoff-complete', { payout: M.SIDE_JOBS.standoff.payout });
    }
    return true;
  };

  function spawnCollectibles() {
    collectibles = { coins: [], tapes: [] };
    var roads = SB.world.roads || [];
    if (!roads.length) return;
    for (var i = 0; i < 20; i++) {
      collectibles.coins.push(makeCollectible('coin', roads));
      collectibles.tapes.push(makeCollectible('tape', roads));
    }
  }
  function makeCollectible(kind, roads) {
    var r = SB.pick(roads);
    var s = SB.rand(r.from + 20, r.to - 20);
    var x = r.axis === 'x' ? s : r.at + SB.rand(-4, 4);
    var z = r.axis === 'x' ? r.at + SB.rand(-4, 4) : s;
    var mesh;
    if (kind === 'coin') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.2, 12),
        new THREE.MeshBasicMaterial({ color: 0xffd42a }));
      mesh.position.set(x, 1.0, z);
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.15),
        new THREE.MeshBasicMaterial({ color: 0xff2a7a }));
      mesh.position.set(x, 1.0, z);
      mesh.rotation.y = SB.rand(0, Math.PI);
    }
    SB.world.scene.add(mesh);
    return { kind: kind, x: x, z: z, mesh: mesh, taken: false };
  }
  function checkCollectibles(dt) {
    var pp = playerPos(); if (!pp) return;
    var all = collectibles.coins.concat(collectibles.tapes);
    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 2;
      c.mesh.position.y = 1.0 + Math.sin(SB.state.simTime * 2 + i) * 0.25;
      var dx = pp.x - c.x, dz = pp.z - c.z;
      if (dx * dx + dz * dz < 9) {
        c.taken = true;
        SB.world.scene.remove(c.mesh);
        if (c.kind === 'coin') M.collectCoin();
        else M.collectTape();
      }
    }
  }
  M.collectCoin = function () {
    SB.state.coins++;
    SB.addCash(M.SIDE_JOBS.coins.payout);
    SB.addRep(M.SIDE_JOBS.coins.rep);
    SB.emit('coin', { coins: SB.state.coins });
  };
  M.collectTape = function () {
    SB.state.tapes++;
    SB.addRep(M.SIDE_JOBS.tapes.rep);
    SB.emit('tape', { tapes: SB.state.tapes });
  };

  SB.on('scene', function (d) {
    if (d.name === 'mission') {
      var bank = { x: 7, z: -50 };
      showMarkerAt(bank);
    }
  });

  SB.registerUpdate(M.update);
})();
