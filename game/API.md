# API.md — Solmar Bay (gta6-01 v4 r14) — DESIGN CONTRACT

> **Satu-satunya spek.** Semua builder (B1–B5) menulis FRESH dari file ini.
> Jangan salin kode dari branch/commit r12/r13 mana pun. Laporan juri r13
> (34 vs v3 11, PASS) adalah referensi perilaku, bukan sumber kode.
> Game: open-world crime 3D (Three.js), kota pantai fiktif **"Solmar Bay"**,
> 9 distrik, 71 gedung, 24 traffic, 20 pejalan kaki, pantai + marina,
> 8 misi, heat 0–5 bintang, polisi darat + heli, 3 stasiun radio,
> toko + safehouse, save localStorage. Semua nama, karakter, dan tempat
> ORIGINAL — bukan dari GTA atau game komersial lain.

## 1. Peta file + urutan load

```
game/
  index.html            # B4: import map "three" -> ./vendor/three.min.js, HUD DOM, loop rAF
  style.css             # B4: panel HUD melayang (TANPA elemen selebar layar)
  vendor/three.min.js   # Three.js minified (vendored, BUKAN source; integrator yang menaruh)
  API.md                # file ini (B1)
  engine.js             # B1: boot/render/loop/kamera/efek, SB inti, step(), preset, shot()
  city.js               # B1: kota Solmar Bay, spawnPoints, bank, groundAt, nearBank, peds
  player.js             # B2: hero onfoot/kendaraan, enterVehicle/exitVehicle, fire()
  vehicles.js           # B2: traffic 24, mobil hero pink, setSpeedKmh()
  police.js             # B2: stars, response, heli + cone, update(dt), busted()
  missions.js           # B3: 8 misi, start/update/complete, getHUD()/getGPS()/notifyHUD()
  dialog.js             # B3: dialog instan + portrait (Mara/Jax/Lucia)
  hud.js                # B4: panel melayang, health/armor, crew, timer, minimap, radio widget
  map.js                # B4: peta penuh 9 label distrik
  main.js               # B5: entrypoint game (SB.hud.init() DULU, bootFromQuery, loop rAF)
  audio.js              # B5: WebAudio (efek + mesin)
  radio.js              # B5: 3 stasiun radio
  save.js               # B5: save/load localStorage
  shops.js              # B5: beli/respray/safehouse
  assets/jax.jpg        # B5: portrait Jax (REGENERATE image model di sesi terekam)
  assets/lucia.jpg      # B5: portrait Lucia (REGENERATE image model di sesi terekam)
```

**Urutan `<script type="module">` di index.html (B4, JANGAN diubah):**
`engine.js → city.js → player.js → vehicles.js → police.js → missions.js →
dialog.js → hud.js → map.js → audio.js → radio.js → save.js → shops.js → main.js`.
`main.js` mengimpor semuanya (static import, supaya gate `references` lolos).
`engine.js` dibuat PERTAMA karena ia menciptakan global `SB`.

## 2. Global `SB` — inti (dibuat `engine.js`, dipakai semua modul)

```js
window.SB = {
  SEED: 1337,                 // seed tetap; ?seed=N boleh override SEBELUM boot
  rng: <mulberry32>,          // SB.rng() -> [0,1); SATU-SATUNYA sumber acak
  state: { ... },             // §3
  _updates: [],               // daftar fn(dt) dari SB.registerUpdate
  registerUpdate(fn),         // daftarkan fn(dt); dipanggil tiap engine.step()
  resetRng(seed),             // rng = mulberry32(seed); dipakai tes determinisme
  now(),                      // -> SB.state.simTime (SATU-SATUNYA jam sim)
  _inCity(x, z),              // -> boolean; envelope x [-140,215], z [-90,185]
  _clampToCity(o),            // clamp o.x/o.z ke envelope (margin 2); -> true bila kena clamp
  engine: {}, city: {}, player: {}, vehicles: {}, police: {},
  missions: {}, dialog: {}, hud: {}, map: {}, audio: {}, radio: {},
  save: {}, shops: {},
};
```

**RNG (mulberry32, seed tetap):**
```js
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
```
Helper: `SB.rand(a,b)` → a + rng()*(b-a); `SB.randInt(a,b)` → floor; `SB.pick(arr)`.
**ATURAN KERAS: TIDAK ADA `Math.random` / `Date.now` di file game mana pun.**
Semua acak lewat `SB.rng()`. `SB.state.simTime` satu-satunya jam sim.
Waktu wall-clock HANYA boleh dipakai untuk menghitung `dt` frame di loop
rAF (main.js/index.html), tidak pernah untuk logika game.

## 3. `SB.state` — single source of truth

```js
SB.state = {
  simTime: 0,                 // detik sim sejak boot preset; NAIK 1/detik wall (dt live)
  clockMinutes: 1044,         // 17*60+24 = 17:24 saat preset cover; jam HUD = 1044 + simTime
  preset: 'cover',            // 'cover' | 'onfoot' | 'mission' | 'map' | 'free'
  cash: 500,                  // dolar; HUD kanan-atas; BUSTED: -50 (biaya rumah sakit)
  health: 100, armor: 0,      // 0..100; BUSTED bila health <= 0
  heat: 0,                    // wanted 0..5 bintang; cover = 4
  rep: 0, rank: 'ROOKIE',     // REP naik per misi; rank dari REP (lihat §10)
  radio: 0,                   // indeks stasiun aktif 0..2
  hero: {                     // SATU-SATUNYA posisi hero; player/vehicles read-modify-write
    x: 0, y: 0, z: 40,        // tiap step; engine BOLEH clamp (posisi + speed=0)
    heading: Math.PI,         // radian; forward = (sin h, 0, cos h); 0 = +z (ke utara/kota)
    speed: 0,                 // km/h saat ini (tampilan HUD + tes drive)
    inVehicle: false, vehicleId: null,
  },
  vehicle: null,              // { id, name, condition: 0..100, dented: bool } | null
  mission: null,              // ringkasan misi aktif (lihat §10) | null
  crew: [                     // 3 crew, tampil di panel crew (kiri-bawah)
    { name: 'Mara', role: 'Driver',  ready: true  },
    { name: 'Jax',  role: 'Muscle',  ready: true  },
    { name: 'Lucia',role: 'Hacker',  ready: false },
  ],
  flags: { busted: false, paused: false },
};
```

**Jam HUD:** `clockMinutes = 1044 + simTime` (1 detik sim = 1 menit jam).
Tampil `HH:MM` 24 jam, `String(floor(m/60)%24).padStart(2,'0') + ':' +
String(floor(m%60)).padStart(2,'0')`. Jam HARUS terlihat di tiap scene.
**Aturan jam:** JANGAN pakai `Date`; jam hanya dari `simTime`.

## 4. `SB.engine` — boot / loop / kamera / efek (B1, `engine.js`)

```js
SB.engine = {
  renderer, scene, camera, sun, hemi, moon,
  running: false,
  boot(canvas, opts),         // buat renderer+scene+kamera+lights; panggil SB.city.build()
  applyPreset(name),          // 'cover'|'onfoot'|'mission'|'map'|'free' (tabel §16)
  step(dt),                   // SATU-SATUNYA pemanggil SB.police.update + semua update
  render(),                   // renderer.render(scene, camera)
  shot(name),                 // staging screenshot: preset + 30x step(1/60) + render x2
  burst(x,y,z,color,n),       // ledakan partikel (muzzle flash / tabrakan)
  spotCone(),                 // -> Mesh cone heli (opacity 0.10, radius 5, tinggi 36)
  setSunset(),                // langit + cahaya sunset; posisi matahari TETAP
  stop(),                     // running=false (loop rAF berhenti)
  dispose(),                  // buang scene lama (untuk tes determinisme 2x in-page)
  clampHeroToCity(),          // clamp SB.state.hero ke envelope; speed=0 bila kena clamp
};
```

**`boot(canvas, opts)`:**
- Renderer: `antialias:true`, `shadowMap.enabled=true` (map 1024), `setPixelRatio(min(devicePixelRatio,2))`,
  `outputColorSpace = THREE.SRGBColorSpace`, ukuran = canvas client.
- Scene: `fog = new THREE.Fog(0x2a1e3f, 120, 420)` (kabut sunset ungu).
- Kamera: `PerspectiveCamera(60, aspect, 0.1, 900)`.
- **Matahari: `DirectionalLight(0xffb36b, 1.15)`, posisi TETAP `(-8, 150, -420)`
  di SEMUA preset sunset. JANGAN PERNAH digeser per preset.**
  `castShadow=true`, shadow camera menutupi kota (left -220 right 220 top 220 bottom -220).
- Hemi: `HemisphereLight(0xffd9b0, 0x3a2b52, 0.55)`.
- Bulan: mesh lingkaran pucat di langit `(-120, 140, -300)` (hiasan sunset).
- `SB._updates = []` (reset), `SB.resetRng(SB.SEED)`, lalu `SB.city.build()`.
- `boot` boleh dipanggil ulang (tes determinisme): buat `Scene` baru, buang yang lama.
- `opts = { shadows: true }`; tes boleh `shadows:false` untuk kecepatan.

**`step(dt)` — URUTAN TETAP (jangan diubah):**
1. `SB.state.simTime += dt; SB.state.clockMinutes = 1044 + SB.state.simTime;`
2. Semua `SB._updates` dipanggil `fn(dt)` (peds, traffic, misi, radio, partikel…).
3. `if (SB.police && SB.police.update) SB.police.update(dt);`
   **step() SATU-SATUNYA pemanggil `SB.police.update`. Polisi JANGAN
   mendaftarkan dirinya via `SB.registerUpdate`.**
4. `SB.engine.clampHeroToCity();` (lihat §5 — perbaikan defect drive).
5. Update kamera (chase / preset, §16).
6. Update partikel burst + flash (decay).
7. `SB.engine.render();`
- `dt` LIVE = wall-clock, **CAP 1,0** (dihitung di loop rAF main.js/index.html,
  `dt = Math.min((now-last)/1000, 1.0)`). **JANGAN 0,05 di loop mana pun.**
  `step(dt)` sendiri percaya `dt` yang diberikan (tes memanggil `step(1/60)`).

**`SB.registerUpdate(fn)`:** HARUS terdefinisi di `engine.js` sebelum modul lain
load; push ke `SB._updates`; return `fn`. Dipanggil tiap `step()`.

**`shot(name)`:** `applyPreset(name)` → `for (i<30) step(1/60)` → `render()` 2x →
`window.__shotReady = true`. Dipakai `main.js` untuk `?shot=` (screenshot).

**`burst(x,y,z,color,n=24)`:** `THREE.Points` 24 titik, kecepatan awal acak
(via `SB.rng()`), hidup 0,6 detik sim, update via `SB.registerUpdate` internal
engine (didaftarkan sekali di `boot`). Dipakai `player.fire()` (muzzle) dan
tabrakan keras.

**`spotCone()`:** factory cone heli — `ConeGeometry(5, 36, 24, 1, true)`,
`MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.10,
side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })`.
**Opacity HARUS 0.10.** Posisi diatur `police.js` (di bawah heli, ujung di tanah).
Satu cone dibuat sekali, dipakai ulang.

**Kamera chase (preset `free` / `onfoot` / drive):** kamera mengikuti
`SB.state.hero` dengan smoothing (`lerp` faktor `1 - exp(-6*dt)`):
- onfoot: jarak 8,5, tinggi 3,2, lookAt hero + (0,1,6,0).
- driving (`hero.inVehicle`): jarak 12, tinggi 5, lookAt hero + (0,1,5,0).
- Kamera selalu di belakang heading hero: `camPos = hero - forward*dist + (0,h,0)`.

## 5. Perbaikan defect r13 (WAJIB, 3 item)

1. **Drive keluar kota (defect #1, paling penting).** r13: W 10 detik →
   hero (0,-148), di luar envelope (z ≥ -90), frame akhir langit kosong.
   Tiga lapis pertahanan, SEMUANYA diterapkan:
   a. Spawn drive menghadap ke DALAM kota: heading `0` (forward +z, ke utara).
      (B2: `vehicles.js` — drive spawn `(0, 0, 20)`, heading `0`.)
   b. **Engine clamp tiap step:** `SB.engine.clampHeroToCity()` di `step()`
      langkah 4: bila `hero.z < -88` → `z = -88`, `speed = 0`, dan bila
      `inVehicle` panggil `SB.vehicles.stopHeroCar()` bila ada; sama untuk
      `x < -138 → -138`, `x > 213 → 213`, `z > 183 → 183`. `SB._clampToCity(o)`
      adalah helper generik (margin 2 dari envelope) yang dipakai clamp ini
      dan guard respawn BUSTED.
   c. **Dinding selatan kota (city.js):** pagar/tembok rendah + deretan gedung
      di `z = -84` (avenue paling selatan `z = -60`; jalan buntu di `z = -80`
      dengan putaran balik / plaza). Mobil yang nekat tetap tertahan visual.
2. **Hero onfoot kecil (defect #2).** Kamera onfoot jarak **8–9** (bukan 12+):
   jarak 8,5, tinggi 3,2. Hero harus BESAR di tengah frame.
3. **Dinding kanan ~30% frame di cover/mission (defect #3).** Kamera cover/
   mission berdiri DI ATAS sumbu jalan (x ≈ 0..2), `lookAt` sedikit ke kiri
   dari sumbu (x ≈ 1..2), supaya fasad kanan tidak mendominasi. Mobil hero
   JANGAN terpotong tepi bawah: kamera `y ≥ 4,2` (cover) / `6,2` (mission)
   dengan `lookAt.y 1,6 / 2,2` — mobil utuh di frame.

## 6. `SB.city` — kota Solmar Bay (B1, `city.js`)

```js
SB.city = {
  group, buildings: [], roads: [], palms: [], neonSigns: [], props: [],
  peds: [],                       // 20 pejalan kaki
  districts: [ {name, x0,x1,z0,z1, style} x9 ],
  bank: { pos:{x:2,z:-16}, signPos:{x:2,y:7,z:-2}, signSize:[14,3.5] },
  spawnPoints: { onfoot, drive, cover, mission, map },
  build(),                        // bangun SELURUH kota ke scene (sekali per boot)
  groundAt(x, z),                 // -> 0 (kota datar; pantai juga 0)
  nearBank(x, z),                 // -> dist ke (2,-2) < 12
  makeBankSignTexture(),          // canvas 2048x512, teks utuh (lihat bawah)
  updatePeds(dt),                 // gerak 20 peds (terdaftar via SB.registerUpdate)
};
```

**Envelope kota:** `x [-140, 215]`, `z [-90, 185]` — `SB._inCity(x,z)`.
Pusat kota ≈ `(37, 47)`.

**9 distrik (grid 3×3, nama + gaya):**

| # | Nama | x | z | Gaya |
|---|------|---|---|------|
| 1 | Old Harbor | [-140,-20] | [-90,0] | gudang bata, atap datar, 8 gedung |
| 2 | Civic Center | [-20,100] | [-90,0] | bank + balai kota + kantor, 8 gedung |
| 3 | Villa Verde | [100,215] | [-90,0] | rumah warna pastel, 8 gedung |
| 4 | Deco Row | [-140,-20] | [0,95] | art-deco, neon, 8 gedung |
| 5 | Downtown | [-20,100] | [0,95] | menara kaca tinggi, 8 gedung |
| 6 | Coral Court | [100,215] | [0,95] | apartemen + toko, 8 gedung |
| 7 | Palma Beach | [-140,-20] | [95,185] | pantai + bar pantai, 7 gedung |
| 8 | Marina Bay | [-20,100] | [95,185] | marina + dermaga + kapal, 7 gedung |
| 9 | Solmar Heights | [100,215] | [95,185] | vila bukit (datar), 7 gedung |

Total **71 gedung** (8×6 + 7×3 = 69 + bank + balai kota = 71 — bank dan balai
kota dihitung sebagai 2 gedung Civic Center, jadi Civic Center 8 sudah
termasuk keduanya).

**Jalan (road network, dipakai traffic B2 via `SB.city.roads`):**
- Avenue (sumbu-x): `z = -60, -20, 20, 60, 100, 140`, dari `x=-140` ke `x=215`.
- Street (sumbu-z): `x = -110, -60, -10, 40, 90, 140, 190`, dari `z=-90` ke `z=185`.
- Lebar jalan 12, trotoar 3 tiap sisi. **Fasad gedung ≥ 7,5 dari sumbu jalan**
  (koridor jalan lebar — hero + mobil tidak terjepit tembok).
- `roads[]` berisi `{ axis:'x'|'z', at, from, to, width:12 }`.
- Permukaan: aspal gelap `0x2b2b33` + garis tengah kuning putus-putus
  (plane tipis, bukan garis 3D mahal). Trotoar `0x8a8578`.
- Jalan buntu selatan: avenue `z=-60` adalah yang paling selatan; di
  `z=-80` ada plaza + tembok rendah (defect #1 lapis c).

**Gedung:** `BoxGeometry(w,h,d)` + `MeshLambertMaterial` warna dari palet
distrik (seeded `SB.rng()`, urutan bangun TETAP: distrik 1→9, gedung 1→N).
Tinggi: Downtown 18–55, Civic 10–28, Deco 8–20, lainnya 6–16, pantai 4–10.
Atap: box tipis warna gelap di atas tiap gedung. Jendela: 3 texture canvas
bersama (pola jendela menyala/kosong, dibuat sekali di `build()` dengan
`SB.rng()`), dipakai sebagai `map` pada material sisi gedung.
Setiap gedung masuk `SB.city.buildings` sebagai
`{ x, z, w, d, h, district, mesh }`.

**Bank — Solmar National Bank (Civic Center):**
- Gedung bank di `(2, 0, -16)`, ukuran `24 (w) × 14 (h) × 18 (d)`,
  warna krem `0xe8dcc0`, kolom depan (4 silinder putih).
- **Papan nama:** plane `14 × 3,5` di `(2, 7, -2)`, menghadap +z (ke selatan,
  ke arah kamera mission/cover), texture canvas **2048×512**.
- `makeBankSignTexture()`: latar granit gelap `0x1a2233`, bingkai emas,
  teks SATU BARIS utuh: **`SOLMAR NATIONAL BANK ★ EST. 1962 ★`**
  (font bold ~92px, emas `0xffd76a`, tengah). JANGAN dipotong, JANGAN dua baris.
- `nearBank(x,z)`: `Math.hypot(x-2, z-(-2)) < 12`.
- Bank adalah landmark: GPS misi 8 ("The Big Score") menunjuk ke sini.

**Pantai + marina (z 150–185):**
- Pasir: plane `355 × 35` warna `0xe6d3a3` di `z 150–185` (x -140..215).
- Air: plane biru `0x2e6f8e` di `z > 185` (di luar envelope, hiasan).
- Marina Bay: 3 dermaga kayu (box panjang) + 5 kapal (hull box + tiang),
  di `x -40..60, z 155..180`.
- Palma Beach: bar pantai + payung (cone) + kursi.

**Palm (pohon palem):** 90 pohon: batang silinder miring sedikit + kanopi cone.
serta garis pantai `z=150`. Posisi seeded `SB.rng()`, masuk `SB.city.palms`.

**Neon + props:**
- Neon: 8 papan neon emissive (TACOS, HOTEL PALMA, BAR NEON, PIZZA, CASINO,
  MOTEL, SURF SHOP, CINEMA) — plane + `MeshBasicMaterial` warna terang,
  di fasad Deco Row / Downtown. Nama ORIGINAL semua.
- Props: 12 hydrant (silinder merah kecil), 20 lampu jalan (tiang + bola
  emissive, menyala saat sunset), 6 stall makanan (box + atap garis),
  10 bangku, 8 tong sampah. Masuk `SB.city.props`.

**`spawnPoints` (koordinat TETAP, jangan diubah):**
```js
spawnPoints = {
  onfoot:  { x: 0,  z: 40, heading: Math.PI },  // persimpangan, hadap -z (ke bank)
  drive:   { x: 0,  z: 20, heading: 0 },       // hadap +z, KE DALAM kota (defect #1)
  cover:   { x: 2,  z: 12, heading: 2.6 },     // mobil pink, 3/4 ke kamera
  mission: { x: 2,  z: 10, heading: Math.PI },  // hadap bank (papan di belakang)
  map:     { x: 37, z: 47 },                   // pusat kota (top-down)
};
```

**Peds — 20 pejalan kaki (city.js, update via `SB.registerUpdate`):**
- Figur sederhana: torso box + kepala sphere + kaki 2 box, warna baju dari
  palet seeded `SB.rng()`, tinggi 1,7–1,9.
- Spawn di trotoar sepanjang avenue/street (posisi seeded, di dalam envelope).
- Jalan lurus di satu jalan, kecepatan 0,8–1,6 m/s, arah seeded; di ujung
  jalan balik arah (bukan teleport keluar kota). `updatePeds(dt)` menggerakkan
  `mesh.position` + ayun kaki (rotasi `sin(simTime*speed)`).
- `SB.city.peds` berisi `{ mesh, road, t, dir, speed }` (20 item).

**`groundAt(x,z)`:** return `0` untuk semua titik (kota + pantai datar).
**`build()`:** membersihkan `SB.city.group` lama dari scene (untuk boot ulang /
tes determinisme), lalu membangun: tanah → jalan → trotoar → gedung (71) →
bank + papan → pantai/marina → palm → neon → props → peds; terakhir
`SB.registerUpdate(SB.city.updatePeds)`. Urutan pemanggilan `SB.rng()` di
`build()` HARUS tetap sama tiap boot (determinisme).

## 7. `SB.player` — hero (B2, `player.js`)

```js
SB.player = {
  hero,                    // THREE.Group hero (dibuat di sini, posisi dari SB.state.hero)
  createHero(),            // bangun mesh hero (jaket amber, celana gelap, ~1,8 tinggi)
  update(dt),              // gerak onfoot WASD + mouse; tulis SB.state.hero tiap step
  enterVehicle(vehicle),   // naik kendaraan terdekat (tombol E); hero.inVehicle=true
  exitVehicle(),           // turun (tombol E); spawn di samping kendaraan
  fire(),                  // tembak: burst() + suara + heat+ (bila ada polisi dekat)
  damage(amount),          // kurangi health/armor; health<=0 -> SB.police.busted()
  updateHeroMesh(),        // sinkron mesh hero <-> SB.state.hero (dipanggil engine tiap step)
};
```
- Kontrol: WASD gerak, Shift lari, Space lompat (kecil), E masuk/keluar mobil,
  F tembak, mouse (pointer lock) putar kamera/arah.
- Onfoot speed: jalan 4 m/s, lari 7 m/s. Hero TIDAK boleh keluar envelope —
  `player.update` memanggil `SB._clampToCity(SB.state.hero)` tiap step.
- `damage(999)` dipakai tes BUSTED (juri): harus berujung respawn in-city.

## 8. `SB.vehicles` — kendaraan + traffic (B2, `vehicles.js`)

```js
SB.vehicles = {
  traffic: [],             // 24 mobil traffic { mesh, road, t, dir, speedKmh, color }
  heroCar: null,           // mobil hero (pink) | null
  createHeroCar(),         // "Flamingo GT" pink #ff5da2, di spawnPoints.cover
  setSpeedKmh(v),          // set kecepatan mobil hero (dipakai preset cover/drive)
  stopHeroCar(),           // speed=0 (dipanggil engine clamp)
  update(dt),              // gerak traffic + mobil hero (WASD/arrows saat inVehicle)
  spawnTraffic(),          // 24 mobil di jalan, warna seeded, kecepatan 30-60 km/h
};
```
- Mobil: body box + kabin box + 4 roda silinder + lampu depan (2 bola emissive).
- Traffic: 24 mobil, masing-masing di satu avenue/street, bergerak lurus,
  kecepatan 30–60 km/h, balik arah di ujung jalan (bukan keluar kota).
  `SB.vehicles.traffic` HARUS berupa array (bukan null) — juri r13 tidak bisa
  membaca traffic dari accessor yang null.
- Mobil hero pink: `Flamingo GT`, warna `#ff5da2`, di cover preset terparkir
  di `(2, 0, 12)` heading `2,6`. `setSpeedKmh(151)` = kecepatan preset drive
  v3 — di r14 drive dimulai dari 0 dan W mempercepat; `setSpeedKmh` tetap ada
  untuk staging/tes.
- Drive: W maju, S rem/mundur, A/D belok, Space handbrake. Kecepatan maks
  180 km/h. Tabrakan gedung: berhenti (tidak tembus) — cek sederhana:
  bila posisi baru di dalam footprint gedung (+1 margin) → batalkan gerak.
- `update(dt)` terdaftar via `SB.registerUpdate` (BUKAN step langsung).

## 9. `SB.police` — polisi (B2, `police.js`)

```js
SB.police = {
  stars: 0,                // cerminan SB.state.heat
  cruisers: [],            // mobil polisi { mesh, state:'pursuit'|'roadblock'|'search' }
  heli: null,              // { mesh, cone } | null; aktif bila heat >= 3
  update(dt),              // SATU-SATUNYA pemanggil: engine.step(). JANGAN registerUpdate!
  setHeat(n),              // 0..5; update SB.state.heat + spawn/despawn unit
  spawnCruiser(), despawnCruisers(),
  spawnHeli(), despawnHeli(),
  busted(),                // respawn in-city + cash -50 + health 90
  wantedStars(),           // -> string '★★★★☆' untuk HUD
};
```
- Response per bintang: 1–2: 1–2 cruiser pursuit; 3: + heli + cone;
  4: + roadblock (2 cruiser melintang di jalan depan hero); 5: + enforcer.
- Heli: mesh (body + rotor berputar) melayang 40 di atas hero, cone
  `SB.engine.spotCone()` di bawahnya menyorot hero (opacity 0.10).
- Cruiser: mobil putih-hitam + lightbar merah-biru berkedip (emissive toggle
  via `simTime`), sirene (audio.js, bila ada).
- **BUSTED (respawn guard — juri r13 memverifikasi ini):**
  ```js
  busted() {
    SB.state.cash = Math.max(0, SB.state.cash - 50);
    SB.state.health = 90; SB.state.heat = 0; SB.state.flags.busted = true;
    let x = SB.state.hero.x, z = SB.state.hero.z;
    if (!SB._inCity(x, z)) { x = 0; z = 40; }   // <-- GUARD: di luar -> (0,40)
    SB.state.hero.x = x; SB.state.hero.z = z; SB.state.hero.heading = Math.PI;
    SB.state.hero.inVehicle = false; SB.state.hero.speed = 0;
    SB.state.hero.y = SB.city.groundAt(x, z);
  }
  ```
  JANGAN PERNAH respawn ke `(-150, 250)` (void v3) atau titik di luar envelope.
- `update(dt)` menggerakkan cruiser mengejar hero (kecepatan cruiser =
  0,9× kecepatan hero + 5 km/h, maks 170), heli mengikuti hero, dan bila
  cruiser menyentuh hero onfoot (< 2 m) selama 1 detik → `busted()`.

## 10. `SB.missions` — 8 misi (B3, `missions.js`)

```js
SB.missions = {
  list: [ {id, name, payout, stages:[{text, x, z}]} x8 ],
  active: null,            // { id, name, stage, stages, payout, timer, objective:{x,z} }
  start(id),               // mulai misi; set SB.state.mission; notifyHUD()
  update(dt),              // timer turun; cek sampai objective (< 6 m -> stage berikutnya)
  complete(),              // payout ke cash, REP+, notifyHUD(), misi berikut terbuka
  fail(reason),            // timer habis -> gagal, bisa ulang
  getHUD(),                // -> { name, stageText:'STAGE 1/2', next, timer:'2:56',
                           //      payout:'$500', gps:'objective 21 m away' }
  getGPS(),                // -> 'objective N m away' (N = jarak hero ke objective, meter)
  notifyHUD(),             // -> SB.hud.refreshMission() bila hud ada
};
```

**Daftar misi (nama + payout TETAP):**

| # | Nama | Payout | Stage |
|---|------|--------|-------|
| 1 | First Fare | $500 | 1/2 Jemput penumpang di Deco Row (x -60, z 40) → 2/2 Antar ke Marina Bay (x 20, z 160) |
| 2 | Hot Wheels | $800 | 1/2 Curi Flamingo GT di Downtown (x 40, z 40) → 2/2 Bawa ke safehouse (x -100, z 60) |
| 3 | Neon Nights | $1.200 | 1/3 Ambil paket di Bar Neon (x -80, z 20) → 2/3 Antar ke Coral Court (x 140, z 40) → 3/3 Kabur dari polisi (heat ≥ 2 lalu turun ke 0) |
| 4 | The Getaway | $1.500 | 1/2 Jemput Lucia di Palma Beach (x -100, z 160) → 2/2 Kabur ke Old Harbor (x -110, z -60) |
| 5 | Harbor Lights | $2.000 | 1/3 Foto kapal di marina (x 0, z 170) → 2/3 Ambil dokumen di Civic Center (x 60, z -40) → 3/3 Serahkan ke Mara (x -60, z 60) |
| 6 | Double Cross | $2.500 | 1/2 Temui Jax di Villa Verde (x 160, z -40) → 2/2 Ambil uang di Solmar Heights (x 160, z 140) |
| 7 | Gold Rush | $3.500 | 1/3 Rampok toko emas Coral Court (x 120, z 60) → 2/3 Kabur ke Deco Row (x -100, z 20) → 3/3 Hilangkan polisi (heat 0) |
| 8 | The Big Score | $5.000 | 1/4 Kumpul di bank (x 2, z -2) → 2/4 Bobol brankas (tahan 20 dtk di bank) → 3/4 Kabur ke marina (x 20, z 160) → 4/4 Serahkan tas ke Mara (x -60, z 60) |

- Timer tiap misi: 180 dtk (misi 1–2), 240 dtk (3–5), 300 dtk (6–8).
  `timer` tampil `M:SS`. Habis → `fail('Waktu habis')`.
- Marker objective: **berlian merah KECIL** (octahedron, radius 0,8, emissive
  merah, melayang + berputar di atas titik objective, `y = 3 + sin(simTime*2)*0,3`).
- `getGPS()` format TETAP: `'objective N m away'` (N integer, jarak 3D hero →
  objective dibulatkan). JANGAN ganti label jadi 'BANK' (inkonsistensi r13).
- `SB.state.mission` SELALU cerminan `missions.active` (atau `null`).
- REP: +100 per misi selesai; rank: 0 ROOKIE, 300 STREET, 800 HUSTLER,
  1500 KINGPIN. `SB.state.rep` / `SB.state.rank` diupdate `complete()`.

## 11. `SB.dialog` — dialog + portrait (B3, `dialog.js`)

```js
SB.dialog = {
  show(speaker, text, portrait),  // tampilkan panel dialog instan (tanpa ketik-per-huruf)
  hide(),
  lines: { mara:[...], jax:[...], lucia:[...] },  // kalimat per karakter
};
```
- Dialog MUNCUL INSTAN (seluruh teks sekaligus) — JANGAN efek ketik.
- Portrait: `assets/jax.jpg`, `assets/lucia.jpg` (B5, regenerate); Mara pakai
  inisial/placeholder (tidak ada file Mara — JANGAN referensi file yang tak ada).
- Dialog tampil saat misi mulai (1 baris briefing) + saat stage selesai.
- Karakter: **Mara** (driver, pemimpin kru), **Jax** (otot), **Lucia** (hacker).

## 12. `SB.hud` + HUD DOM (B4, `hud.js` + `style.css` + `index.html`)

**Panel MELAYANG (bukan bar horizontal). Posisi TETAP (viewport 1280×720):**
- `#hud-status` kiri-atas (12,12), ~276×142: health bar + armor bar + jam + tanggal.
- `#hud-wanted` kanan-atas (1074,12), ~194×83: bintang wanted + cash.
- `#hud-mission` kiri-bawah (12,341), ~300×121: panel misi aktif.
- `#hud-crew` kiri-bawah di bawah misi (12,472), ~300×93: 3 crew + REP/rank.
- `#hud-minimap` kanan-bawah (1064,313), 204×204, **bundar** (border-radius 50%).
- `#hud-radio` kanan-bawah di atas minimap: widget stasiun radio.
- `#hud-vehicle` kiri-bawah (di atas misi bila inVehicle): kondisi kendaraan + DENTED.
- `#hud-dialog` tengah-bawah: dialog + portrait.
- **JANGAN ada elemen selebar layar** (container root `width:100%` saja yang
  boleh; panel masing-masing `max-width` tetap).
- Jam HARUS terlihat di tiap scene (di `#hud-status`).

**Panel misi aktif (format TETAP — juri r13 memverifikasi ini):**
```
FIRST FARE
STAGE 1/2
NEXT Jemput penumpang di Deco Row
TIMER 2:56
PAYOUT $500
GPS objective 21 m away
```
Tanpa titik-dua setelah label (format teks r13: `NEXT …`, `GPS …`).
Bila tak ada misi aktif: `NO ACTIVE MISSION` + misi berikutnya + payoutnya.
- `SB.hud.refreshMission()` membaca `SB.missions.getHUD()`.
- `SB.hud.init()` dipanggil **PALING DULU** di `main.js` (sebelum `bootFromQuery`).

**Minimap:** canvas 2D 204×204, gambar jalan + gedung + dot hero (kuning) +
dot objective (merah) + dot polisi (biru) + dot traffic (putih), utara = atas,
pusat = hero, skala ~1,4 px/unit. Label 9 distrik HANYA di peta penuh (`map.js`).

**HUD update:** `SB.hud.update(dt)` terdaftar via `SB.registerUpdate`;
mengupdate DOM secukupnya (teks berubah saja), minimap tiap frame.

## 13. `SB.map` — peta penuh (B4, `map.js`)

- Tombol M / klik minimap → overlay peta penuh kota (canvas 2D).
- Gambar: jalan, pantai, marina, 71 gedung (kotak kecil), **9 label distrik**,
  dot hero + objective + polisi.
- `SB.map.toggle()`, `SB.map.show()`, `SB.map.hide()`.

## 14. `index.html` / `main.js` / audio / radio / save / shops (B4–B5)

**`index.html` (B4):**
- `<canvas id="game">` fullscreen + HUD DOM (§12) + import map:
  ```html
  <script type="importmap">{"imports":{"three":"./vendor/three.min.js"}}</script>
  <script type="module" src="./main.js"></script>
  ```
- SATU import map saja. Semua script/module/image/font HARUS file di bawah
  `game/` atau `data:` URI — TIDAK ADA network request (gate `references`).
- Loop rAF ADA di `main.js` (B5), bukan di index.html.

**`main.js` (B5, ~40 baris, entrypoint):**
```js
SB.hud.init();                 // DULU
SB.engine.bootFromQuery(canvas); // baca ?preset=&seed=&shot= lalu boot + applyPreset
// lalu: SB.engine.stop() + loop rAF SENDIRI:
let last = performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 1.0);  // CAP 1,0 — JANGAN 0,05
  last = now;
  SB.engine.step(dt);
}
requestAnimationFrame(frame);
```
- `bootFromQuery(canvas)`: baca `URLSearchParams`: `preset` (default `cover`),
  `seed` (default 1337 → `SB.SEED`), `shot` (bila ada → `SB.engine.shot(shot)`
  sekali, tanpa loop rAF). `main.ts` (root, B5) HARUS berubah ≥1 baris vs
  induk (di orphan branch: tulis penuh di sesi terekam).
- **Loop rAF milik main.js; `engine.step()` TIDAK membuat loop sendiri.**
  `SB.engine.stop()` menghentikan flag bila main.js butuh (mis. shot mode).

**`audio.js` (B5):** WebAudio, tanpa file eksternal (oscillator/noise):
`SB.audio.beep()`, `.engineHum(speed)`, `.siren(on)`, `.gunshot()`, `.cash()`.
Semua suara disintesis — JANGAN load file audio eksternal.

**`radio.js` (B5):** 3 stasiun, `SB.radio.stations = [
{ name:'SOLMAR FM', genre:'pop' }, { name:'NEON 88', genre:'synth' },
{ name:'PALMA TALK', genre:'talk' } ]`; `next()`, `current()`; musik
disintesis ringan (WebAudio) atau sunyi + label stasiun; widget HUD §12.
JANGAN stream radio sungguhan.

**`save.js` (B5):** `SB.save.save()` / `.load()` / `.clear()` — localStorage
key `solmar-bay-save-v1`: `{ cash, rep, missionsDone:[ids], hero:{x,z} }`.
Tombol save di HUD + autosave tiap misi selesai. Load gagal → default aman.

**`shops.js` (B5):** `SB.shops.buy(item)`, `.respray(color, cost)`,
`.enterSafehouse()` — toko di peta (ikon $ di minimap): beli armor ($200),
respray mobil hero ($150, warna seeded dari palet), safehouse simpan +
heal gratis (sekali per 60 dtk sim). Semua transaksi cek `SB.state.cash`.

**`README.md` (B5):** judul Solmar Bay + cara main (kontrol) + 3 badge live
`make.fun/badge/` + link kompetisi. **`owner.json` (B5):** wallets UNCHANGED:
`0x52B8c8481f7Faa2b8Ec9e893ec83cC7Bad12b114` /
`6WJra66hge1YvPbWLGEghHQbhFoBpU5n8exLNvM479ZD`.

## 15. Start screen + kontrol (ringkas, untuk B4/B5)

- Start screen: judul SOLMAR BAY + "Press ENTER to play" + kontrol + tombol
  Continue (bila save ada). ENTER mulai preset `free` di spawn onfoot.
- Kontrol: WASD gerak/drive, Shift lari, Space lompat/handbrake, E masuk/
  keluar mobil, F tembak, M peta, R ganti radio, P pause, 1–8 mulai misi
  (bila dekat marker? — tidak: misi dipilih dari panel misi, klik atau
  tombol 1–8 kapan saja bila tidak ada misi aktif).

## 16. Preset — tabel TETAP (angka final, jangan diubah tanpa juri ulang)

| Preset | Hero | Kamera (pos → lookAt) | Waktu | Heat | Heli/cone | Catatan |
|--------|------|------------------------|-------|------|-----------|---------|
| `cover` | mobil pink Flamingo GT di (2,0,12), heading 2,6 | (-4, 4,2, 22) → (2, 1,6, 4) | 17:24 SUNSET | 4 | YA (heli + cone opacity 0.10) | Cover/screenshot 1. Papan bank UTUH di belakang mobil. Mobil utuh, tidak terpotong bawah. |
| `onfoot` | hero onfoot (0,40), heading π | belakang hero jarak 8,5: (0, 3,2, 48,5) → (0, 1,6, 40) | 17:24 SUNSET | 0 | TIDAK | Hero BESAR di tengah frame. Jalan + stall + papan bank terlihat. |
| `mission` | hero onfoot (2,10), heading π | (0, 6,2, 26) → (2, 2,2, 4) | 17:24 SUNSET | 2 | TIDAK (heat<3) | Papan bank (2,7,-2) UTUH. Misi 8 aktif (The Big Score) bila `?mission=8`. |
| `map` | — (hero tetap) | top-down (37, 220, 47) → (37, 0, 47) | 17:24 SUNSET | 0 | TIDAK | Peta penuh overlay juga tampil (B4). |
| `free` | hero onfoot (0,40) | chase onfoot (jarak 8,5) | 17:24 SUNSET | 0 | TIDAK | Default main. |

- **Semua preset sunset:** matahari TETAP `(-8,150,-420)`, langit oranye-ungu.
- `applyPreset(name)`: set `SB.state.preset`, `SB.state.clockMinutes = 1044`
  (reset jam ke 17:24), `SB.state.simTime = 0` (reset sim — determinisme),
  posisikan hero/kendaraan, set heat (`cover` 4, `mission` 2, lain 0),
  spawn/despawn heli via `SB.police.setHeat(heat)` bila police ada,
  atur kamera. `applyPreset` TIDAK memanggil `SB.resetRng` (kota sudah
  dibangun di `boot`; rng kota tetap) — TAPI tes determinisme memanggil
  `boot` ulang (yang me-reset rng + membangun ulang kota).
- Preset `cover`/`mission` memakai kamera TETAP (bukan chase): kamera tidak
  mengikuti hero sampai pemain menggerakkan hero (lalu chase aktif).
  Implementasi: `SB.engine.camMode = 'fixed' | 'chase'`; `applyPreset`
  set `'fixed'` untuk cover/mission/map, `'chase'` untuk onfoot/free;
  input gerak pertama (WASD) mengubah `camMode` ke `'chase'`.

## 17. Verifikasi (angka, bukan klaim — tiap builder laporkan ini)

- `node --check` tiap file JS (via `cp x.js /tmp/x.mjs && node --check`
  karena file memakai ESM `import`).
- `grep -c 'Math.random\|Date.now' game/*.js` = **0**.
- Determinisme 2×: preset `cover`, `step(1/60)` ×90, dua boot independen →
  hero (x,y,z,heading,speed), heat, counts (gedung 71, peds 20, palms,
  traffic 24 bila ada), jam HUD, kamera (pos + lookAt) HARUS identik
  (bandingkan JSON snapshot).
- `SB.registerUpdate` terdefinisi + probe `fn(dt)` dipanggil 90× dalam 90 step.
- `SB.police.update` dipanggil HANYA dari `engine.step` (probe counter).
- Drive 10 detik W (dari spawn drive, heading 0): hero HARUS tetap
  `z ≥ -90` (envelope) dan frame akhir BUKAN langit kosong.
- BUSTED paksa (`damage(999)` / `police.busted()`): respawn di dalam kota
  (`SB._inCity` TRUE), cash -50, health 90.
- `SB.engine.shot('cover')` jalan + `window.__shotReady === true`.
- 0 console/page error saat load di headless Chrome.
- `SB.city.buildings.length === 71`, `SB.city.peds.length === 20`,
  `SB.city.districts.length === 9`, `SB.vehicles.traffic.length === 24`.

## 18. Larangan + catatan akhir

- JANGAN baca/salin kode r12/r13. JANGAN checkout branch lain.
- JANGAN commit/push (integrator). JANGAN ubah file builder lain.
- JANGAN pakai nama/karakter/lokasi GTA atau game komersial lain.
- JANGAN `fetch` / `XMLHttpRequest` ke network di runtime game.
- `localStorage` hanya di `save.js`.
- Beban VM: koordinator tiny-chess v13 berjalan paralel — jangan jalankan
  render/tes berat bersamaan; beri jeda bila load > 4.
- Bila ragu antara dua angka, pakai yang di tabel §16 / §6 / §10.
