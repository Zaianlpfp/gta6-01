// Solmar Bay — config.js
// One job: every tunable number and every named thing in the game lives here.
// The city, its people, its cars, its guns, its radio and its story are all original.
'use strict';

// ---- World ---------------------------------------------------------------
const WORLD = { w: 3200, h: 2400, hx: 1600, hz: 1200 };
const AVENUES = [-1200, -800, -400, 0, 400, 800, 1200];   // north-south roads (x)
const STREETS = [-900, -600, -300, 0, 300, 600, 900];     // east-west roads (z)
const ROAD_W = 34, WALK_W = 12;

// Named districts. districtAt(x, z) returns the one the player stands in.
const DISTRICTS = [
  { name: 'Downtown',        x0: -420, x1: 420,  z0: -320, z1: 320 },
  { name: 'Coral Strand',    x0: -1600, x1: -1210, z0: -1200, z1: 1200 },
  { name: 'Pelican Marina',  x0: -1210, x1: -420, z0: 620,  z1: 1200 },
  { name: 'Old Mercado',     x0: 420,  x1: 1220, z0: -920, z1: -320 },
  { name: 'Palmetto Heights',x0: -420, x1: 420,  z0: -1200, z1: -320 },
  { name: 'Deco Row',        x0: 420,  x1: 1600, z0: -320, z1: 320 },
  { name: 'Bayline Docks',   x0: 420,  x1: 1600, z0: 620,  z1: 1200 },
  { name: 'Grieve Isle',     x0: -1210, x1: -420, z0: -920, z1: 620 },
];
function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d.name;
  return 'Solmar Bay';
}

// Named streets for the location line under the minimap.
const STREET_NAMES = [
  'Ocean Boulevard', 'Palm Avenue', 'Coral Way', 'Sunset Drive', 'Marina Road',
  'Mercado Street', 'Bayline Avenue', 'Palmetto Lane', 'Deco Boulevard', 'Harbor Street',
];
function streetAt(x, z) {
  const ax = nearestRoad(x, AVENUES), az = nearestRoad(z, STREETS);
  if (Math.abs(x - ax) < Math.abs(z - az)) return STREET_NAMES[(AVENUES.indexOf(ax) + 3) % STREET_NAMES.length] + ' · N–S';
  return STREET_NAMES[(STREETS.indexOf(az) + 6) % STREET_NAMES.length] + ' · E–W';
}
function nearestRoad(v, list) {
  let best = list[0], bd = 1e9;
  for (const r of list) { const d = Math.abs(v - r); if (d < bd) { bd = d; best = r; } }
  return best;
}
function onRoad(x, z) {
  return AVENUES.some(a => Math.abs(x - a) < ROAD_W / 2 + 2) ||
         STREETS.some(s => Math.abs(z - s) < ROAD_W / 2 + 2);
}
function nearestRoadPoint(x, z) {
  // Snap a point to the closest road centre line.
  const ax = nearestRoad(x, AVENUES), az = nearestRoad(z, STREETS);
  if (Math.abs(x - ax) < Math.abs(z - az)) return { x: ax, z };
  return { x, z: az };
}

// ---- Landmarks (x, z, label, kind) ---------------------------------------
const LANDMARKS = [
  { x: 120,  z: -120, label: 'Solmar National Bank', kind: 'bank' },
  { x: 1000, z: 180,  label: 'St. Coral Hospital',   kind: 'hospital' },
  { x: -120, z: -520, label: 'SBPD Headquarters',    kind: 'police' },
  { x: -1380, z: -300, label: 'The Palms Hotel',     kind: 'hotel' },
  { x: -700, z: 1020, label: "Dante's Chop Shop",    kind: 'chopshop' },
  { x: 0,    z: -1020, label: 'Safehouse · Palmetto', kind: 'safehouse' },
  { x: 900,  z: -620, label: 'Mercado Gun Store',    kind: 'gunshop' },
  { x: 260,  z: 480,  label: 'Sunset Respray',       kind: 'respray' },
  { x: 900,  z: 1020, label: 'Bayline Docks',        kind: 'docks' },
  { x: -1380, z: 800, label: 'Pelican Marina',       kind: 'marina' },
];
function landmark(kind) { return LANDMARKS.find(l => l.kind === kind); }

// ---- Vehicles ------------------------------------------------------------
const VEHICLES = [
  { id: 'solstice', name: 'Solstice GT',   top: 62, accel: 26, grip: 1.0,  sport: true,  colors: [0xff2e63, 0xffc300, 0x08d9d6] },
  { id: 'marlin',   name: 'Marlin Coupe',  top: 54, accel: 22, grip: 0.95, sport: false, colors: [0x2e86ff, 0xe8e8e8, 0x222831] },
  { id: 'coral',    name: 'Coral Cruiser', top: 48, accel: 18, grip: 0.9,  sport: false, colors: [0xff8fa3, 0x7ec8e3, 0xf4f4f4] },
  { id: 'runner',   name: 'Bay Runner',    top: 52, accel: 24, grip: 0.85, sport: true,  colors: [0xff6b35, 0x1b1b2f, 0x3ec1d3] },
  { id: 'taxi',     name: 'Pelican Taxi',  top: 46, accel: 17, grip: 0.9,  sport: false, colors: [0xffc300, 0xffc300, 0xffc300] },
  { id: 'hauler',   name: 'Harbor Hauler', top: 40, accel: 14, grip: 0.8,  sport: false, colors: [0x8d99ae, 0x5c6b73, 0x9c6644] },
  { id: 'cop',      name: 'SBPD Interceptor', top: 58, accel: 25, grip: 1.0, sport: false, colors: [0x1d3557, 0x1d3557, 0x1d3557] },
];

// ---- Weapons -------------------------------------------------------------
const WEAPONS = [
  { id: 'fists',   name: 'FISTS',    short: 'Fists',    dmg: 25, rate: 2.4, mag: Infinity, reserve: Infinity, range: 3,   spread: 0,    auto: false, locked: false },
  { id: 'pistol',  name: 'P9 PISTOL', short: 'Pistol',  dmg: 34, rate: 3.2, mag: 12, reserve: 48,  range: 90,  spread: 0.012, auto: false, locked: false },
  { id: 'smg',     name: 'WASP SMG', short: 'SMG',      dmg: 22, rate: 9.0, mag: 32, reserve: 128, range: 70,  spread: 0.045, auto: true,  locked: true,  unlockMission: 3 },
  { id: 'shotgun', name: 'BOOMSTICK', short: 'Shotgun', dmg: 18, rate: 1.1, mag: 6,  reserve: 18,  range: 40,  spread: 0.09,  auto: false, locked: true,  unlockMission: 5, pellets: 7 },
];
const AMMO_PRICE = { pistol: 40, smg: 90, shotgun: 120 };

// ---- Radio ---------------------------------------------------------------
const RADIO = [
  { name: 'WAVE 88.1', genre: 'Neon Drive',   track: 'Pink Horizon',  artist: 'Lumen Kids',  bpm: 104, root: 57, minor: true,  wave: 'sawtooth' },
  { name: 'SOL 101.9', genre: 'Sunset FM',    track: 'Coral Static',  artist: 'Palm Ghosts', bpm: 82,  root: 53, minor: false, wave: 'triangle' },
  { name: 'BAY 96.5',  genre: 'Turbo',        track: 'Harbor Lights', artist: 'Night Ferry', bpm: 128, root: 45, minor: true,  wave: 'square' },
];

// ---- Respect / REP -------------------------------------------------------
const REP_RANKS = [
  { xp: 0,    title: 'STREET KID' },
  { xp: 400,  title: 'CORNER BOY' },
  { xp: 1000, title: 'BAY HUSTLER' },
  { xp: 2000, title: 'SUNSET KING' },
  { xp: 3600, title: 'SOLMAR LEGEND' },
];
function repRank(xp) {
  let r = REP_RANKS[0];
  for (const k of REP_RANKS) if (xp >= k.xp) r = k;
  return r;
}

// ---- Missions ------------------------------------------------------------
// Stage types: car (be in any car) | goto (reach marker) | pickup (reach + press E)
//   wait (stay inside the marker radius for T seconds) | escape (survive until heat is 0
//   or the timer runs out) | steal (enter the marked car). A mission is a list of stages.
const MISSIONS = [
  {
    id: 1, chapter: 'CH 1', title: 'First Fare', contact: 'Mara Solis', portrait: 'mara.jpg',
    payout: 300, xp: 150,
    brief: 'Drive the taxi. Two fares are waiting around Coral Strand.',
    dialog: [
      "You want work? I run the fares in this town, cariño. Take the taxi, pick up my people, don't keep them waiting.",
      'Two stops. Easy money. Don\u2019t scratch the paint.',
    ],
    stages: [
      { type: 'car',   text: 'Get in a car' },
      { type: 'goto',  x: -1330, z: -520, r: 16, text: 'Pick up the fare at The Palms Hotel' },
      { type: 'goto',  x: -900,  z: 240,  r: 16, text: 'Drop the fare at Grieve Isle' },
      { type: 'goto',  x: -1380, z: 620,  r: 16, text: 'Pick up the second fare at Pelican Marina' },
      { type: 'goto',  x: -420,  z: -60,  r: 16, text: 'Drop the fare at Downtown' },
    ],
  },
  {
    id: 2, chapter: 'CH 2', title: 'The Package', contact: 'Mara Solis', portrait: 'mara.jpg',
    payout: 600, xp: 200, timer: 150,
    brief: 'A sealed package waits at Old Mercado. Deliver it to The Palms Hotel before the clock dies.',
    dialog: [
      'A package. Sealed. You don\u2019t open it, you don\u2019t ask about it, you deliver it. Mercado to the hotel.',
      'One hundred and fifty seconds. The clock is already running, cariño.',
    ],
    stages: [
      { type: 'car',   text: 'Get in a car' },
      { type: 'pickup', x: 760, z: -620, r: 14, text: 'Pick up the package at Old Mercado  (E)' },
      { type: 'goto',  x: -1380, z: -300, r: 16, text: 'Deliver the package to The Palms Hotel' },
    ],
  },
  {
    id: 3, chapter: 'CH 3', title: 'Hot Wheels', contact: 'Mara Solis', portrait: 'mara.jpg',
    payout: 900, xp: 300,
    brief: 'A cherry Solstice GT is parked outside the bank. Lift it and bring it to Dante.',
    dialog: [
      'There is a Solstice GT parked outside the bank, keys in it, owner inside counting his money. Bring it to Dante.',
      'The cops will notice. Drive like you mean it.',
    ],
    stages: [
      { type: 'goto',  x: 200, z: -60, r: 18, text: 'Find the Solstice GT outside the bank' },
      { type: 'steal', x: 200, z: -60, r: 20, text: 'Steal the Solstice GT  (E)' },
      { type: 'goto',  x: -700, z: 1020, r: 18, text: 'Deliver it to Dante\u2019s Chop Shop' },
    ],
  },
  {
    id: 4, chapter: 'CH 4', title: 'Heat', contact: 'Mara Solis', portrait: 'mara.jpg',
    payout: 1200, xp: 350, timer: 75,
    brief: 'The whole department is on you. Break line of sight and stay hidden until the heat dies.',
    dialog: [
      'You made the news, cariño. Three stars, every cruiser in Solmar Bay is hunting you.',
      'Break their line of sight. Hide. When the heat is gone, you are a ghost again.',
    ],
    stages: [
      { type: 'escape', t: 75, text: 'Lose the cops — break line of sight until the heat cools' },
    ],
  },
  {
    id: 5, chapter: 'CH 5', title: 'Night Run', contact: 'Dante Voss', portrait: 'dante.jpg',
    payout: 1500, xp: 400, timer: 180, night: true,
    brief: 'After dark, two drops: the docks, then the marina. No headlights off, no stopping.',
    dialog: [
      'Night work pays double, kid. Two drops — Bayline Docks, then Pelican Marina. Cops change shifts at midnight.',
      'One-eighty seconds. My van better come back in one piece.',
    ],
    stages: [
      { type: 'car',   text: 'Get in a car' },
      { type: 'goto',  x: 900, z: 1020, r: 16, text: 'First drop: Bayline Docks' },
      { type: 'goto',  x: -1380, z: 800, r: 16, text: 'Second drop: Pelican Marina' },
    ],
  },
  {
    id: 6, chapter: 'CH 6', title: 'Chop Shop', contact: 'Dante Voss', portrait: 'dante.jpg',
    payout: 1800, xp: 450,
    brief: 'Two cars on my list tonight. A Marlin Coupe downtown, a Bay Runner on Deco Row.',
    dialog: [
      'I need two cars tonight. Marlin Coupe downtown, Bay Runner on Deco Row. No questions, no receipts.',
      'Bring them here and I pay cash. Scratch one and I pay less. You know how it is.',
    ],
    stages: [
      { type: 'steal', x: -260, z: 120, r: 20, text: 'Steal the Marlin Coupe downtown  (E)' },
      { type: 'goto',  x: -700, z: 1020, r: 18, text: 'Deliver it to the Chop Shop' },
      { type: 'steal', x: 700, z: 60, r: 20, text: 'Steal the Bay Runner on Deco Row  (E)' },
      { type: 'goto',  x: -700, z: 1020, r: 18, text: 'Deliver it to the Chop Shop' },
    ],
  },
  {
    id: 7, chapter: 'CH 7', title: 'Harbor Lights', contact: 'Mara Solis', portrait: 'mara.jpg',
    payout: 2500, xp: 600, timer: 200,
    brief: 'Cargo at the marina, four stars on your tail, one safehouse on the hill. Run.',
    dialog: [
      'The cargo is at the marina. The moment you touch it, every unit in the city wakes up. Four stars, cariño.',
      'Don\u2019t stop. Don\u2019t look back. The safehouse on Palmetto Hill is the only place they won\u2019t follow.',
    ],
    stages: [
      { type: 'car',   text: 'Get in a car' },
      { type: 'pickup', x: -1380, z: 800, r: 14, text: 'Grab the cargo at Pelican Marina  (E)' },
      { type: 'escape', t: 200, text: 'Escape to the Safehouse on Palmetto Hill' },
    ],
  },
  {
    id: 8, chapter: 'CH 8', title: 'The Big Score', contact: 'Mara Solis', portrait: 'mara.jpg',
    payout: 5000, xp: 1000, timer: 240,
    brief: 'Solmar National Bank. Twenty seconds inside, then the whole city comes for you.',
    dialog: [
      'The bank. Twenty seconds inside while the vault opens, then we run. This is the one, cariño. The big score.',
      'When the alarm screams, drive to the safehouse and do not stop for anyone. Not even me.',
    ],
    stages: [
      { type: 'goto',  x: 120, z: -120, r: 18, text: 'Reach Solmar National Bank' },
      { type: 'wait',  x: 120, z: -120, r: 22, t: 20, text: 'Hold the bank while the vault opens' },
      { type: 'escape', t: 240, text: 'Escape to the Safehouse on Palmetto Hill' },
    ],
  },
];

// ---- Collectibles / side work -------------------------------------------
const SUN_COINS = 20;          // hidden sun coins, $50 each
const FARE_PAY = 120;          // taxi fare payout
const SHOP = {
  armor: { name: 'Body Armor', price: 150 },
  ammo:  { name: 'Ammo Box', price: 80 },
  respray: { name: 'Respray', price: 200 },
};

// ---- Tuning ---------------------------------------------------------------
const TUNE = {
  playerWalk: 6.5, playerRun: 11.5, playerAccel: 40,
  trafficCount: 22, pedCount: 38, parkedCount: 14,
  heatDecayHidden: 2.2, heatDecaySeen: 0.35, heatDecayInCar: 1.4,
  copChaseSpeed: 9.5, copCatchDist: 3.2, copCatchTime: 2.0,
  heliMinStars: 4, maxCruisers: 5,
  bustedFine: 500, wastedLoss: 0.10,
  clockMinutesPerSecond: 1,        // 1 real second = 1 game minute
  startHour: 17, startMinute: 24, startDay: 1,
  days: ['FRI', 'SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU'],
};
