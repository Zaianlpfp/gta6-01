# Solmar Bay 3D — API.md (kontrak antar modul, v3)

> Dokumen ini adalah KONTRAK. Builder B2–B5 wajib mengikuti nama, field, dan
> perilaku di bawah ini persis — jangan ubah nama field `SB.state` / `SB.world`
> atau signature fungsi tanpa persetujuan B1. Game ini 3D low-poly (Three.js
> r149, chase cam), kota "Solmar Bay", orisinal (bukan aset/nama Rockstar).

## 0. Model loading & namespace

- **Classic `<script>` tags, TANPA ES modules / bundler / import map.**
  Urutan load di `game/index.html` (B5 yang menulisnya):
  1. `vendor/three.min.js` (Three.js r149, global `THREE`)
  2. `engine.js` — namespace `SB`, state, loop, kamera, input, event bus
  3. `city.js` — kota 3D, traffic, pejalan kaki, spawn, distrik (`SB.city.*`)
  4. `player.js`, `vehicles.js` (B2) — jalan kaki, nyetir, combat
  5. `police.js`, `missions.js`, `dialog.js` (B3) — wanted, heli, misi, dialog
  6. `hud.js`, `radio.js`, `map.js`, `shops.js`, `audio.js`, `save.js` (B4)
  7. `main.js` (B5) — bootstrap: `SB.init()` → `SB.city.buildCity(seed)` →
     `SB.player.create(...)` → `SB.start()`
- Semua modul menulis ke SATU namespace global: `window.SB`.
  Jangan buat global lain (kecuali `THREE`). Jangan pakai `Math.random` di
  kode gameplay/dunia — pakai `SB.rng` (lihat §8 Determinisme).
- Satuan dunia: **1 unit = 1 meter**. Tanah y=0. Utara = `-z`.
  Heading = `rotation.y` objek; `0` = menghadap utara (`-z`),
  `Math.PI/2` = barat (`-x`), `Math.PI` = selatan (`+z`),
  `-Math.PI/2` = timur (`+x`). Forward = `(-sin h, 0, -cos h)`
  (`SB.forwardOf(h)`, `SB.headingForDir(dx,dz)`).

## 1. `SB.state` — semua field (primitif saja, JSON-safe untuk save)

| Field | Tipe / default | Arti |
|---|---|---|
| `seed` | int, `1337` | Seed RNG dunia (override `?seed=N`) |
| `cash` | int, `250` | Uang pemain ($) |
| `health` | 0–100, `100` | Nyawa |
| `armor` | 0–100, `0` | Armor |
| `wanted` | 0–5, `0` | Bintang wanted (DITURUNKAN dari `heat`, lihat §2) |
| `heat` | 0–100, `0` | Heat; `wanted = heat<=0?0 : heat<20?1 : heat<40?2 : heat<60?3 : heat<80?4 : 5` |
| `rep` | int, `0` | XP reputasi total |
| `repLevel` | 1–5, `1` | Level REP (lihat `SB.repTitleFor`) |
| `repTitle` | string, `'STREET KID'` | Judul rank REP |
| `day` | int ≥1, `1` | Hari ke- (hari 1 = FRI) |
| `hour`, `minute` | int, `17`, `24` | Jam game (HUD: `SB.formatClock()` → `'FRI 17:24'`) |
| `clockRate` | float, `1` | Game-menit per detik nyata (jam maju seiring main) |
| `timeOfDay` | `'day'`\|`'sunset'`\|`'night'`, `'sunset'` | Mode lighting (lihat `SB.setTimeOfDay`) |
| `weather` | string, `'clear'` | Selalu `'clear'` di v3 (jangan tambah cuaca tanpa B1) |
| `mission` | `null` \| `{id, title, contact, stage, stageTotal, objective, payout}` | Misi aktif |
| `missionsDone` | int, `0` | Misi cerita selesai |
| `missionsTotal` | int, `8` | Total misi cerita (HUD: `STORY x/8`) |
| `coins` | int, `0` | Sun Coins terkumpul |
| `coinsTotal` | int, `20` | Total Sun Coins |
| `tapes` | int, `0` | Sunset Tapes terkumpul |
| `tapesTotal` | int, `20` | Total Sunset Tapes |
| `vehicle` | `null` \| `{id, name, kind, condition}` | Kendaraan yang sedang dikendarai |
| `speedKmh` | float, `0` | Kecepatan kendaraan saat ini |
| `gear` | string, `'N'` | Gigi: `'N'`, `'R'`, `'G1'`–`'G5'` |
| `location` | string, `'Downtown'` | Nama distrik posisi pemain |
| `street` | string, `'Solmar Ave'` | Nama jalan terdekat |
| `radio` | `{station:0, name:'WAVE 88.1', track:'Neon Drive — Pink Horizon', playing:true}` | Radio aktif (B4) |
| `weapons` | `{fists:{ammo:Infinity}, pistol:{ammo:12,reserve:48}, smg:{ammo:32,reserve:128}, shotgun:{ammo:6,reserve:18}, rifle:{ammo:0,reserve:0,locked:true}}` | Senjata + amunisi |
| `weapon` | string, `'pistol'` | Senjata aktif (`'fists'`\|`'pistol'`\|`'smg'`\|`'shotgun'`\|`'rifle'`) |
| `started` | bool, `false` | Game sudah mulai (lewat start screen) |
| `paused` | bool, `false` | Pause |
| `scenePreset` | `null` \| string | Preset staging aktif (`?scene=`, lihat §7) |
| `simTime` | float, `0` | Detik simulasi sejak `SB.start()` (deterministik) |
| `elapsed` | float, `0` | Sama dengan `simTime` (alias, jangan pakai keduanya) |

**REP — level & judul** (`SB.repTitleFor(level)`):
threshold XP `[0, 300, 900, 1600, 2400, 4200]`,
judul `['STREET KID','CORNER HUSTLER','NEON RUNNER','BAY HUSTLER','SOLMAR KING']`.
`SB.repProgress()` → `{level, title, xpInto, xpNext}`.
Contoh: rep 1960 → level 4 `BAY HUSTLER`, progres 1960/2400.
Hari: `['FRI','SAT','SUN','MON','TUE','WED','THU']`, hari 1 = FRI.

## 2. `SB.world` — objek runtime (berisi objek THREE, JANGAN disave mentah)

| Field | Isi |
|---|---|
| `renderer`, `scene`, `camera`, `canvas` | Dibuat `SB.init()` |
| `sun` | `THREE.DirectionalLight` (matahari/bulan, castShadow) |
| `hemi` | `THREE.HemisphereLight` |
| `neonLights` | Array `THREE.PointLight` di Neon Mile (intensitas diatur `setTimeOfDay`) |
| `player` | `null` \| `{mesh:THREE.Group, pos:THREE.Vector3, heading:number, speed:number, onFoot:bool, vehicle:object\|null}` (B2) |
| `vehicles` | Array kendaraan yang bisa dikendarai (B2): `{id, name, kind, condition, group, pos, heading, speed}` |
| `traffic` | Array mobil traffic (city.js): `{group, road, lane, dir, speed, kind, color}` |
| `peds` | Array pejalan kaki (city.js): `{group, pos, heading, speed, road, side, rng}` |
| `police` | Array cruiser polisi (B3): `{group, unit, status, pos, speed}` |
| `heli` | `null` \| `{group, unit:'GULL-1', pos, spotlight}` (B3) |
| `colliders` | Array AABB `{x0,z0,x1,z1}` (bangunan + landmark) |
| `roads` | Array jalan (lihat §9): `{id, axis:'x'\|'z', at, from, to, width, name}` |
| `districts` | Array distrik (lihat §9): `{id, name, x0,z0,x1,z1, tint}` |
| `landmarks` | Array `{id, name, kind, x, z}` |
| `spawns` | Objek spawn (lihat §9) |
| `groups` | `{city, buildings, roads, props, traffic, peds, sky}` — grup THREE |
| `bounds` | `{minX:-560, maxX:470, minZ:-470, maxZ:530}` — batas jalan kaki/nyetir |

## 3. Engine — disediakan `engine.js` (B1, SUDAH ADA)

- `SB.init(opts)` — `opts:{canvas?, seed?, timeOfDay?}`. Buat renderer
  (antialias, shadows PCFSoft, ACES tone mapping), scene, kamera (FOV 62),
  lampu, fog, listener resize + keyboard/mouse. Panggil SEKALI.
- `SB.start()` / `SB.stop()` / `SB.setPaused(b)` — mulai/hentikan loop
  `requestAnimationFrame`. Loop: `dt` clamp `[0, 0.05]`, `simTime += dt`,
  jam maju (`minute += dt*clockRate`), emit `'tick'`, jalankan updater
  terdaftar, update chase cam, render.
- `SB.registerUpdate(fn)` / `SB.unregisterUpdate(fn)` — `fn(dt)` dipanggil
  tiap frame SEBELUM render, urutan pendaftaran. Untuk sim (traffic, peds,
  polisi, misi, player). JANGAN daftarkan update kamera di sini.
- `SB.on(evt, fn)` / `SB.off(evt, fn)` / `SB.emit(evt, data)` — event bus
  (lihat §6).
- `SB.mulberry32(seed)` → fungsi RNG. `SB.rng` = RNG aktif dunia.
  `SB.rand(a,b)`, `SB.randInt(a,b)`, `SB.pick(arr)`, `SB.chance(p)` —
  semua via `SB.rng`. `SB.reseed(seed)`.
- `SB.setTimeOfDay(mode)` — `'day'`|`'sunset'`|`'night'`: ganti warna/intensitas
  `sun`+`hemi`, `scene.background`, `scene.fog`, intensitas `neonLights`.
  Emit `'time-of-day'`.
- `SB.setClock(hour, minute)` — set jam (tidak mengubah `day`).
- `SB.setCameraMode(mode)` — `'chase'` (di belakang kendaraan),
  `'onfoot'` (dekat, third-person), `'free'` (orbit lambat, untuk title),
  `'top'` (tegak lurus dari atas, untuk peta). `SB.cameraRig` =
  `{mode, distance, height, lookHeight, smooth}`.
- `SB.setChaseTarget(t)` — `t = {pos:THREE.Vector3, heading:number}` atau
  objek dengan `.pos`/`.heading` (mis. `SB.world.player` / kendaraan).
  `SB.updateChaseCam(dt)` — dipanggil loop; smoothing `1-exp(-smooth*dt)`.
- `SB.applyScenePreset(name)` — lihat §7. Emit `'scene'`.
- `SB.parseQuery()` → `URLSearchParams` dari `location.search`.
  `SB.advanceSim(seconds)` — majukan sim (traffic/peds/dll) dengan langkah
  tetap 1/60 dtk TANPA render (untuk staging deterministik).
- `SB.bootFromQuery()` — baca `?seed=`, `?scene=`, `?t=` (detik sim untuk
  fast-forward) dari URL; dipanggil `main.js` (B5) setelah `buildCity`.
- `SB.ensureStagingPlayer(mode)` — buat kendaraan/ped stand-in untuk staging
  bila `SB.world.player` belum ada (dipakai preset `?scene=`; B2 TIDAK boleh
  mengandalkan ini untuk gameplay — `SB.player.create` yang asli).
- `SB.makeTextTexture(text, opts)` — `opts:{w:512,h:128,font,fg,bg,border}` →
  `THREE.CanvasTexture` (prosedural, lokal, tanpa network). Untuk billboard,
  papan nama toko, tanda jalan. B4 boleh pakai untuk potret? TIDAK — potret
  karakter digambar model gambar (aset), bukan canvas.
- `SB.addCollider(x0,z0,x1,z1)`, `SB.isBlocked(x,z,r)` → bool,
  `SB.clampToBounds(x,z)` → `{x,z}`.
- `SB.districtAt(x,z)` → distrik (atau `{id:'outskirts',name:'Solmar Bay'}`).
  `SB.streetAt(x,z)` → nama jalan terdekat atau `''`.
- `SB.setWanted(n)` — clamp 0–5, set `heat = n*20 - 1` (`0`→`0`), emit `'wanted'`.
  `SB.addHeat(n)` — `heat` clamp 0–100, `wanted` diturunkan dari `heat`,
  emit `'wanted'` bila bintang berubah.
- `SB.addCash(n)` / `SB.addRep(n)` / `SB.setHealth(n)` / `SB.setArmor(n)` —
  clamp + emit `'cash'` / `'rep'` (bila level naik) / `'health'` / `'armor'`.
- `SB.setMission(m)` / `SB.clearMission()` — set `state.mission`,
  emit `'mission-start'` / `'mission-clear'`.
- `SB.formatClock()` → `'FRI 17:24'`. `SB.dayName()` → `'FRI'` dst.
- `SB.serializeState()` → salinan JSON-safe `SB.state` (untuk `SB.save`).
- `SB.input` — `{keys:{}, mouse:{x,y,dx,dy,down}}`;
  `SB.input.isDown(code)` (`'KeyW'`, `'ArrowUp'`, `'Space'`, `'KeyE'`, …);
  `SB.input.axis()` → `{x:-1..1, y:-1..1}` (A/D, W/S).
  Tombol yang dipakai game: WASD/arrows gerak, `Shift` lari/nitro,
  `Space` handbrake, `E` masuk/keluar mobil, `F` / klik tembak,
  `1–5` ganti senjata, `Q`/`R` ganti radio, `M` peta, `P`/`Esc` pause.
  Engine menahan default browser untuk `Space`/arrows saat `started`.
- `SB.version = '3.0.0-b1'`.

## 4. City — disediakan `city.js` (B1, SUDAH ADA)

- `SB.city.buildCity(seed)` — master: reseed, bangun semua di bawah,
  isi `SB.world.{colliders,roads,districts,landmarks,spawns,bounds}`,
  daftarkan `updateTraffic` + `updatePeds` sebagai updater.
  Panggil SEKALI setelah `SB.init()`, sebelum `SB.player.create()`.
- `SB.city.buildGround()`, `SB.city.buildOcean()`, `SB.city.buildRoads()`,
  `SB.city.buildSidewalks()`, `SB.city.buildBuildings()`,
  `SB.city.buildBeach()`, `SB.city.buildMarina()`, `SB.city.buildPark()`,
  `SB.city.buildLandmarks()`, `SB.city.buildPalms()`,
  `SB.city.buildNeon()`, `SB.city.buildStreetProps()`, `SB.city.buildSky()`
  — sub-builder (dipanggil `buildCity`; B2–B4 JANGAN panggil langsung).
- `SB.city.buildTraffic(count=30)`, `SB.city.buildPeds(count=48)` —
  isi `SB.world.traffic` / `SB.world.peds`.
- `SB.city.updateTraffic(dt)`, `SB.city.updatePeds(dt)` — updater terdaftar.
- `SB.city.makeCarMesh(kind, colorHex)` → `THREE.Group` (body + kabin +
  4 roda, menghadap `-z` saat `heading=0`). **B2 WAJIB pakai ini** untuk
  kendaraan (konsistensi visual + hemat kode).
- `SB.city.makePedMesh(shirtHex, skinHex)` → `THREE.Group` (badan + kepala).
  B2 boleh pakai untuk mesh pemain on-foot.
- `SB.city.makeFacadeTexture(base, win, cols, rows, litRatio)` →
  `THREE.CanvasTexture` jendela gedung (prosedural).
- `SB.city.districts`, `SB.city.roads`, `SB.city.colliders` — mirror dari
  `SB.world` (sama objeknya). `SB.city.districtAt(x,z)`,
  `SB.city.roadNameAt(x,z)` — sama seperti `SB.*`.
- Material bersama: `SB.city.materials` (asphalt, sidewalk, sand, water,
  grass, concrete, glass, neonPink, neonCyan, neonYellow, …). B2–B4
  BOLEH pakai ulang; jangan buat material baru per frame.

## 5. Yang diharapkan dari B2 — `player.js`, `vehicles.js` (+ combat)

- `SB.player.create(spawn)` — `spawn = SB.world.spawns.player`.
  Buat mesh pemain (pakai `SB.city.makePedMesh`), isi `SB.world.player =
  {mesh, pos, heading, speed, onFoot:true, vehicle:null}`. Daftarkan
  `SB.player.update` sebagai updater.
- `SB.player.update(dt)` — on-foot: WASD gerak (jalan 4 m/s, lari 7 m/s
  dengan `Shift`), hadap arah gerak, cek `SB.isBlocked`; di kendaraan:
  serahkan ke `SB.vehicles.update`. `E` masuk/keluar kendaraan terdekat
  (jarak < 4 m). Mouse: arah aim = `SB.input.mouse`; klik/`F` = tembak
  (`SB.combat.shoot()`). Update `state.location`/`state.street` tiap frame.
- `SB.player.enterVehicle(v)`, `SB.player.exitVehicle()`,
  `SB.player.isOnFoot()` → bool, `SB.player.setPosition(x,z,heading)`.
- `SB.vehicles.create(kind, x, z, heading, opts)` → kendaraan
  `{id, name, kind, condition:100, group, pos, heading, speed}`.
  `kind`: `'sport'`|`'muscle'`|`'sedan'`|`'taxi'`|`'truck'`|`'van'`.
  Nama ORISINAL (jangan pakai nama mobil nyata/Rockstar):
  sport `'VENTO STRADA'`, muscle `'SOLMAR GT'`, sedan `'PALMERA LX'`,
  taxi `'SOLMAR CAB'`, truck `'BAYLINE HAULER'`, van `'MERCADO VAN'`.
- `SB.vehicles.spawnParked()` — parkir kendaraan di `spawns.vehicles`.
- `SB.vehicles.update(dt)` — fisika arcade: akselerasi W/S, belok A/D
  (skala dengan kecepatan), `Space` handbrake, tabrakan sederhana via
  `SB.isBlocked` + dorong traffic. Isi `state.speedKmh`, `state.gear`
  (`R` mundur, `G1`–`G5` maju), `state.vehicle={id,name,kind,condition}`.
  `condition` turun saat tabrakan (min 0; 0 = mogok).
- `SB.vehicles.steal(v)` — curi: `SB.addHeat(15)`, emit `'vehicle-stolen'`,
  HUD toast via event (B4 yang menampilkan).
- `SB.combat.weapons` — lihat tabel `state.weapons` (§1).
  `SB.combat.selectWeapon(id)` — ganti `state.weapon`, emit
  `'weapon-change'`. `SB.combat.shoot()` — tembak dari posisi pemain
  ke arah mouse/kamera; kurangi ammo; efek muzzle (B4 boleh dengar event
  `'shot'`); `SB.combat.reload()`.

## 6. Yang diharapkan dari B3 — `police.js`, `missions.js`, `dialog.js`

- `SB.police.update(dt)` — spawn/despawn cruiser sesuai `wanted`:
  1★ = 1 cruiser, 2★ = 2, 3★ = 3 + foot cop, 4★ = 4 + roadblock,
  5★ = 5 + roadblock + heli. Kejar pemain (arah + ram), hilang bila
  `heat` 0. Daftarkan sebagai updater. Isi `SB.world.police`.
- `SB.police.spawnHeli()` / `SB.police.updateHeli(dt)` — heli `GULL-1`:
  hover di atas pemain, spotlight cone (mesh cone transparan) + lingkaran
  search-zone (untuk minimap B4). `SB.world.heli`.
- `SB.police.responseList()` → `[{unit:'GULL-1', dist:35, status:'SPOTLIGHT'},
  {unit:'MARLIN-11', dist:9, status:'RAMMING'}, …]` — untuk HUD (B4).
  Status: `'PURSUIT'` | `'RAMMING'` | `'ROADBLOCK'` | `'SEARCHING'` | `'SPOTLIGHT'`.
  Nama unit: `GULL-1` (heli), cruiser `MARLIN-11`, `SNAPPER-25`, `TARPON-18`,
  `IBIS-43`, `HERON-17`, `KESTREL-31` (pilih berurutan, jangan acak).
- `SB.police.busted()` / `SB.police.wasted()` — pemain tertangkap/mati:
  respawn di `spawns.hospital`, `cash -= 10%`, `heat = 0`, `wanted = 0`,
  emit `'busted'` / `'wasted'`. B4 menampilkan layarnya.
- `SB.missions.JOBS` — array 8 misi cerita (WAJIB urutan ini, B3 yang isi
  detail stage-nya):
  1. `first-fare` — FIRST FARE (MARA SOLIS) — antar penumpang taksi — $500
  2. `the-package` — THE PACKAGE — antar paket ke Marina — $1.200
  3. `hot-wheels` — HOT WHEELS — curi VENTO STRADA — $1.800
  4. `night-run` — NIGHT RUN — balapan Neon Mile — $2.500
  5. `chop-shop` — CHOP SHOP — antar mobil ke Jax's Garage — $3.200
  6. `harbor-lights` — HARBOR LIGHTS — temu kru di Pelican Marina — $3.200
  7. `heat` — HEAT — lolos dari wanted 4 — $4.200
  8. `big-score` — THE BIG SCORE — rampok Solmar National Bank — $5.000
  Tiap job: `{id, title, contact:'MARA SOLIS', payout, stages:[{objective, target:{x,z}, done}], }`.
  `state.mission` selalu menunjuk job aktif (lihat §1).
- `SB.missions.start(id)` / `SB.missions.update(dt)` / `SB.missions.advance()` /
  `SB.missions.complete()` / `SB.missions.active()` → job aktif atau `null`.
  `complete()`: `cash += payout`, `rep += payout/10`, `missionsDone++`,
  emit `'mission-complete'`. Daftarkan `update` sebagai updater.
- `SB.missions.SIDE_JOBS` — taxi fares (antar penumpang, $50–$150),
  street race, MERCADO STANDOFF (usir 4 Saltjacks), Sunset Tapes (20),
  Sun Coins (20, $50 tiap satu). Semua memberi REP.
- `SB.dialog.show({name, role, portrait, lines:[...]})` — kotak dialog
  dengan potret karakter (aset gambar, B3/B4 yang sediakan);
  `SB.dialog.next()` / `SB.dialog.hide()` / `SB.dialog.active()` → bool.
  Karakter: MARA SOLIS (kontak misi), JAX (garage), LUCÍA ORTEGA.
  Dialog mem-pause sim (`SB.setPaused(true)`) sampai ditutup.

## 7. Yang diharapkan dari B4 — `hud.js`, `radio.js`, `map.js`, `shops.js`, `audio.js`, `save.js`

- `SB.hud.init()` / `SB.hud.update(dt)` — gambar HUD tiap frame (DOM overlay,
  BUKAN canvas WebGL): cash, health bar, armor bar, bintang wanted (0–5),
  `STORY x/8`, `Coins x/20`, jam (`SB.formatClock()`), REP bar + judul,
  speedometer (km/h + gear + nama kendaraan + condition%),
  panel misi (judul + `STAGE x/y` + `NEXT objective` + timer bila ada),
  daftar `SB.police.responseList()`, weapon wheel (5 slot, ammo, locked),
  widget radio, lokasi (`state.location` + `state.street`), kotak dialog.
  `SB.hud.toast(msg)` — pesan singkat. `SB.hud.setObjective(text)`.
  `SB.hud.showBusted()` / `SB.hud.showWasted()` / `SB.hud.showMissionBrief(m)`.
  HUD SEMBUNYI bila `state.scenePreset === 'title'`.
- `SB.hud.drawMinimap()` — minimap bundar (canvas 2D overlay): jalan,
  posisi pemain (panah), marker misi (kuning), polisi (biru/merah),
  search-zone circle bila heli aktif, safehouse (hijau), toko (ungu).
- `SB.radio.STATIONS` — 3 stasiun (nama + frekuensi + daftar track):
  0 `WAVE 88.1` — sunset synth (`Neon Drive — Pink Horizon`, `Palm Static — Coral Ghosts`),
  1 `RADIO SOL 101.9` — latin pop (`Sol de Medianoche — Marisol`, `Calle Ocho — Los Palmeros`),
  2 `FLAMINGO FM 88.1` — funk/disco (`Disco Bay — The Flamingos`, `Night Swim — Velvet Tide`).
  `SB.radio.play(i)` / `SB.radio.next()` / `SB.radio.prev()` / `SB.radio.toggle()` /
  `SB.radio.current()` → `{station, track}`. Update `state.radio`.
  Tiap stasiun: bassline/tempo beda (WebAudio prosedural, `audio.js`).
- `SB.map.show()` / `SB.map.hide()` / `SB.map.toggle()` / `SB.map.render()` —
  layar peta kota penuh (tombol `M`): peta + daftar 8 job + payout +
  legenda (story contact, job objective, safehouse, weapons, respray,
  street race, property, hospital, police, sunset tape) + 9 distrik +
  ikon (gunakan `SB.world.districts` + `SB.world.landmarks` + `SB.world.spawns`) +
  GPS (`jarak ke objektif misi, meter`).
- `SB.shops.open(kind)` / `SB.shops.buy(item)` — toko (`kind:'weapons'|'armor'|'food'`):
  beli armor/ammo (uang dari `state.cash`). `SB.shops.respray(color?)` —
  ganti warna mobil + hapus 1 bintang wanted (biaya $200).
  `SB.shops.safehouse()` — save point + ganti baju (di safehouse).
  Daftar toko: `SB.world.spawns.shops`.
- `SB.audio.init()` (WAJIB lazy, setelah gestur user pertama — autoplay policy),
  `SB.audio.engine(speedKmh)`, `SB.audio.siren(on)`, `SB.audio.shot()`,
  `SB.audio.pickup()`, `SB.audio.setStation(i)` — semua WebAudio prosedural,
  tanpa file suara.
- `SB.save.save(slot)` / `SB.save.load(slot)` / `SB.save.autosave()` /
  `SB.save.clear()` — localStorage key `'solmarbay3d'`.
  Simpan `SB.serializeState()` + posisi pemain + progres misi.
  Autosave tiap misi selesai. JANGAN simpan objek THREE.

## 8. Staging — preset `?scene=` (untuk screenshot)

`SB.applyScenePreset(name)` mengatur state + kamera + jam, lalu emit
`'scene'` `{name}` — B3/B4 yang mendengar event ini WAJIB menambahkan
bagiannya (heli, cruiser, HUD misi, radio) agar tiap preset lengkap.
Preset juga bisa dipanggil dari URL: `game/index.html?scene=cover`
(`SB.bootFromQuery()`). Preset TIDAK boleh mengubah `seed`.

| Preset | Yang diatur engine (SUDAH ADA) | Yang ditambah B3/B4 |
|---|---|---|
| `cover` | chase di Solmar Ave (0,40) hadap utara, mode `sunset` 17:24, wanted 4 (heat 79), cash $18.450, misi `THE BIG SCORE` stage 3/4 (`Escape with the cash! Lose the cops`), REP 4 BAY HUSTLER 1.960/2.400, speed 151 km/h G4, radio WAVE 88.1. | B3: heli GULL-1 + spotlight + 3 cruiser (1 RAMMING) + roadblock. B4: HUD lengkap (misi + response list + weapon wheel + minimap + radio). |
| `onfoot` | jalan kaki di depan FARO BOOKS, Old Mercado (250,88) hadap utara, kamera `onfoot`, `sunset` 17:40, wanted 1, cash $12.400, tanpa misi. | B4: HUD on-foot (senjata + health + minimap). |
| `mission` | chase di Solmar Ave (0,40) hadap utara-timur laut (-0,35 rad) ke arah bank, `sunset` 18:05, wanted 2, cash $12.400, misi `THE BIG SCORE` stage 1/4 (`Reach Solmar National Bank`). | B3: marker misi di bank. B4: panel misi + dialog Mara. |
| `map` | kamera `top` di atas pusat kota, mode `day` 12:00, wanted 0, tanpa misi. | B4: overlay peta penuh (daftar 8 job + legenda + GPS). |
| `night` | chase di Neon Mile (0,-380) hadap selatan, mode `night` 21:30, wanted 3, cash $15.200, misi `HARBOR LIGHTS` stage 2/3, REP 4 BAY HUSTLER 1.960/2.400, radio WAVE 88.1. | B3: heli + 2 cruiser + roadblock. B4: HUD malam + neon. |
| `title` | kamera `free` (orbit lambat atas downtown), `sunset` 18:30, wanted 0, tanpa misi. | B4: HUD SEMBUNYI; tampilkan judul `SOLMAR BAY` + menu (start screen). |

Aturan staging: tiap preset HARUS menunjukkan ≥8 sistem sekaligus di satu
frame (misi + wanted + response list + senjata + radio + dialog/minimap +
speed + cash + jam + REP). Cover = shot paling ramai (lihat ANALYSIS.md §4).
**Posisi staging HARUS di jalan/trotoar** (pusat jalan ±7, trotoar ±11 dari
sumbu jalan) — blok downtown tertutup podium penuh (collider), jadi posisi
di dalam blok (mis. x=50, z=80) menaruh kamera DI DALAM bangunan.

## 9. Determinisme

1. Semua keacakan dunia dari `SB.rng` (mulberry32, seed `SB.state.seed`,
   default `1337`, override `?seed=N`). **JANGAN pakai `Math.random`** di
   kode gameplay/dunia — termasuk B2–B4.
2. Keputusan acak saat runtime (mis. pejalan kaki berhenti) memakai stream
   RNG per objek yang dibuat saat build (`SB.mulberry32(seed*1000+i)`).
3. Sim memakai `dt` ter-clamp `[0, 0.05]`; staging memakai `SB.advanceSim(t)`
   dengan langkah tetap 1/60 dtk — frame staged harus reproduksibel.
4. Jam game maju `clockRate` (1 game-menit/detik); preset mengatur jam
   eksplisit (`SB.setClock`).
5. Save/load mengembalikan `SB.state` persis (JSON) — jangan simpan objek THREE.

## 10. Format data kota

- Jalan — `SB.world.roads`: `{id, axis:'x'|'z', at, from, to, width:14, name}`.
  `axis:'z'` = avenue (jalan utara–selatan, `at` = koordinat x);
  `axis:'x'` = street (jalan timur–barat, `at` = koordinat z).
  Avenue (x): -400 Coral Ave, -300 Flamingo Blvd, -200 Palmetto Ave,
  -100 Bayline Ave, 0 Solmar Ave, 100 Deco Row, 200 Mercado Ave,
  300 Keystone Ave, 400 Pelican Way.
  Street (z): -400 Sunset St, -300 Neon Mile, -200 Palmetto St,
  -100 Flamingo St, 0 Solmar St, 100 Mercado St, 200 Bayline St,
  300 Keystone St, 400 Pelican St.
- Distrik — `SB.world.districts`: `{id, name, x0,z0,x1,z1, tint}`:
  Downtown (-150..150, -150..150), Coral Strand (-560..-450, -450..450),
  Pelican Marina (-450..-50, 350..520), Old Mercado (150..450, -150..150),
  Neon Mile (-350..350, -450..-340), Palmetto Heights (150..450, -450..-150),
  Deco Row (-450..-150, -350..-150), Bayline Docks (-50..450, 350..520),
  Keystone Field (-150..150, 150..350).
- Landmark — `SB.world.landmarks`: `{id, name, kind, x, z}`:
  bank (50,-50), hospital (-150,250), police (150,150), hotel (-480,0),
  garage (350,450), safehouse (350,-250), respray (50,-350),
  toko: books (250,50), gym (250,150), cafe (-480,150), shoes (350,-50),
  pharmacy (-250,-250), club (-50,-350).
- Spawn — `SB.world.spawns`:
  - `player`: `{x:0, z:60, heading:0}` (Solmar Ave, hadap utara).
  - `vehicles`: 10 titik parkir `{kind, name, x, z, heading}`:
    sport VENTO STRADA (8,60,0), sedan PALMERA LX (-8,-40,π),
    taxi SOLMAR CAB (108,150,π/2), muscle SOLMAR GT (-92,-150,0),
    van MERCADO VAN (250,60,-π/2), truck BAYLINE HAULER (350,450,π),
    sport VENTO STRADA (-450,100,π/2), sedan PALMERA LX (50,-350,π),
    muscle SOLMAR GT (-250,-250,0), taxi SOLMAR CAB (150,250,-π/2).
  - `missions`: `{bank:(50,-50), marina:(-250,450), mercado:(350,50),
    hotel:(-480,0), garage:(350,450), hospital:(-150,250),
    police:(150,150), neon:(-50,-350)}`.
  - `shops`: 6 toko (lihat landmark toko di atas).
  - `safehouse`: (350,-250) `Mara's Safehouse`; `respray`: (50,-350)
    `Neon Respray`; `hospital`: (-150,250); `police`: (150,150);
    `heliPad`: (150,150, y=42).
- Tabrakan — `SB.world.colliders`: AABB `{x0,z0,x1,z1}` per bangunan.
  `SB.isBlocked(x,z,r)` cek collider + bounds.
  Batas dunia (bounds): `x [-560, 470]`, `z [-470, 530]` — pantai barat,
  docks selatan.
- Traffic — `SB.world.traffic`: `{group, road, lane, dir, speed, kind, color, s}`.
  Pejalan kaki — `SB.world.peds`: `{group, road, side, dir, speed, s, phase, pause, rng}`.

## 11. Anggaran ukuran & penamaan (untuk judge outline)

- `engine.js` ~25 KiB, `city.js` ~41 KiB (aktual, diukur 19 Nov 2026).
  Sisa anggaran untuk B2–B4 + `index.html` + `style.css`: **~95 KiB**
  (163.840 − 66.647 byte engine+city).
  Total source SEMUA file (`.html`/`.js`/`.css`/`.json`, di luar `vendor/`
  dan `*.min.js`) ≤ **160 KiB** — dossier terpotong di atas itu.
  `game/` total ≤ 48 MiB, ≤ 993 file; `index.html` ≤ 1 MiB.
- **TIDAK ADA referensi network**: semua file lokal di bawah `game/` atau
  `data:` URI. Jangan pakai CDN, font eksternal, atau `fetch()` ke luar.
- Nama file/fungsi HARUS deskriptif (judge hanya melihat outline):
  `buildCity`, `buildTraffic`, `updateChaseCam`, `spawnHeli`,
  `responseList`, `drawMinimap`, `setWanted`, `advanceSim`, …
- Jangan tambah file `.js` baru tanpa kabar B1 (anggaran source ketat);
  gabung ke modul yang sudah ada bila memungkinkan.
- Orisinalitas: TIDAK ADA nama/aset Rockstar/GTA. Kota, karakter,
  kendaraan, stasiun radio, dan cerita di atas adalah milik Solmar Bay.

---
*API.md v3 — ditulis B1 (engine) 19 Nov 2026, sesi recording
01a1f072-cbfd-7517-b2f3-badc6ce34a56. Perubahan kontrak → koordinasi B1.*
...[truncated 10445 chars]