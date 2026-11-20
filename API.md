# API.md — Kontrak antar modul "Solmar Bay" (gta6-01, rebuild r5)

Ditulis B1 di dalam recording r5. B2–B5 BOLEH membaca file ini. File ini DIPINDAH
B5 ke repo root (di luar game/) sebelum main.ts dijalankan, agar tidak masuk dossier.

Namespace global: `SB` (dibuat engine.js; modul lain menambah properti, TIDAK
mendefinisikan ulang `SB`). **TIDAK ADA `SB.world`** — modul lama yang membacanya
harus ditulis ulang tanpa shim. Determinisme: tanpa RNG global / jam dinding di
semua kode; satu-satunya RNG adalah `SB.engine.rng(seed)` (mulberry32).

## 0. Ledger & state global

- `SB.cash = 0` — ledger kas engine (awal 0).
- `SB.player.cash = 500` (B2), `SB.missions.cash = 0` (B3). HUD tampilkan `max()` ketiganya.
- `SB.player.rep = 0` (B2), `SB.missions.rep = 0` (B3). HUD tampilkan `max()` keduanya.
  REP 0 → rank `STREET KID` (fresh game, jujur).
- `SB.state = { heat, paused, speedKmh, gear, timeMin, day, tod, season, district, rep, rank }`
  - `heat` = bintang wanted **0–5** (BUKAN 0–100). `SB.police.stars()` otoritatif (B2).
  - `paused` boolean. Dialog `show()` men-set `paused=true`; selesai → `false`.
    `SB.engine.step()` TIDAK majukan sim saat `paused` (hanya render).
  - `speedKmh` number (mirror `SB.engine.hero.speedKmh`), `gear` string `G1..G5/N/R`.
  - `timeMin` menit sejak 00:00 (cover = 17*60+24 → `FRI 17:24`), `day` int (mulai 1).
  - `tod` = `'SUNSET' | 'NIGHT' | 'DAY'`, `season` = `'SUMMER'`.
  - `district` string nama distrik posisi hero saat ini.
- `SB.on / SB.emit / SB.off`, `SB.parseQuery()` — didefinisikan **main.js (B5)**,
  BUKAN engine. Jangan panggil sebelum main.js load.

## 1. SB.engine (engine.js — B1)

- `SB.engine.rng(seed)` → fungsi `() => [0,1)` mulberry32. Seed int.
- `SB.engine.attach(canvas)` — buat renderer/scene/camera, bangun kota
  (`SB.city.build()`), pool muzzle flash, langit + lampu. Idempotent; panggil sekali.
  Renderer: `preserveDrawingBuffer:true` (wajib — `shot()` butuh ini).
  **JANGAN buat canvas lain sebelum `attach()`** (canvas minimap HUD dibuat lazy
  setelah `#game-canvas` ada — pelajaran r3).
- `SB.engine.setPreset(name)` — staging + reset sim. Preset: `cover`, `onfoot`,
  `mission`, `night`, `big-score`, `map`. Efek per preset (lihat §4).
  Modul lain me-wrap `setPreset` BERANTAI (simpan ref lama, panggil, lalu tambah
  staging-nya sendiri). Urutan wrap: engine → city → player → vehicles → police
  → missions → dialog → hud (masing-masing guard sekali-wrap).
- `SB.engine.bootFromQuery()` — baca `?scene=` via `SB.parseQuery()` (fallback
  `'cover'` bila tidak ada), `attach()` bila belum, `setPreset(scene)`, mulai loop
  RAF. Dipanggil SEKALI oleh main.js.
- `SB.engine.step(dt)` — SATU langkah sim `dt` detik (default `1/60`). Bila
  `SB.state.paused` → hanya `render()`, sim diam. Player me-wrap `step` SEKALI
  (guard `SB._b2step`) untuk logika gerak/input per langkah.
- `SB.engine.advanceSim(n)` — jalankan `n` langkah `step(1/60)`; tiap langkah,
  bila `SB.missions.update` ada, panggil `SB.missions.update(1/60)` TEPAT 1×.
  (B2 menjamin ini; B3 mengandalkan tick-per-call — JANGAN dedupe by frame di
  `missions.update`.) Dipakai staging + harness, BUKAN main loop.
- `SB.engine.render()` — render satu frame (tanpa majukan sim).
- `SB.engine.shot()` → `dataURL` PNG 1280×720 dari canvas WebGL SAJA (tanpa HUD
  DOM). Screenshot submit pakai `pg.screenshot` atas halaman live (canvas + HUD).
- `SB.engine.stop()` — hentikan loop RAF.
- `SB.engine.hero` — `{ mode:'car'|'foot', x, z, heading, speedKmh, name, cond }`.
  `heading` radian; vektor maju = `(sin h, 0, cos h)`. Hero menghadap `-z` ⇒ `h=π`.
  `name` = `'VENTO STRADA'` (mobil pemain, pink), `cond` 0–100.
- `SB.engine.speedKmh` — getter → `SB.engine.hero.speedKmh` (mirror ke
  `SB.state.speedKmh` tiap step). `SB.engine.camMode` — getter-only string
  (`'chase' | 'foot' | 'map' | 'orbit'`).
- `SB.engine.setSpeedKmh(v)` — set laju hero (dipakai staging cover: panggil
  SETELAH `advanceSim`, karena roadblock/advance bisa menurunkannya; cover = 151).
- `SB.engine.setTimeOfDay(tod)` — `'SUNSET' | 'NIGHT'`; ganti lampu + langit.
- `SB.engine.setDensity(nTraffic, nPeds)` — jumlah traffic/peds aktif (staging).
- `SB.engine.muzzlePos()` → `{x, y, z}` posisi moncong senjata hero (dipakai
  `SB.player.fire()`). Saat di mobil: ujung jendela kiri hero.
- `SB.engine.frame` (int, langkah sim), `SB.engine.simTime` (detik),
  `SB.engine.preset` (string preset aktif), `SB.engine.renderer`,
  `SB.engine.scene`, `SB.engine.camera` (baca saja).
- `SB.engine.burst(pos)` — kilat muzzle flash di `pos` `{x,y,z}`: toggle visible
  pool burst (box + flash sprite + point light) yang SUDAH dibuat di `attach()`.
  Pool persisten — `burst()` TIDAK membuat objek baru. Auto-hide ~90 ms
  (di-step oleh engine tiap frame).
- `SB.engine.setPaused(v)` — set `SB.state.paused` + render ulang. Pause gate
  hanya untuk live; staging screenshot BOLEH pause tapi banner pause WAJIB
  disembunyikan HUD (urusan B4/B5 — r4: banner `PAUSED — [P] RESUME` merusak shot).

## 2. SB.city (city.js — B1)

Kota "Solmar Bay": grid jalan, 9 distrik, 66 bangunan, 32 neon, pantai/laut barat.
Semua posisi dari `rng(seed)` — deterministik per preset (seed tetap per preset).

- `SB.city.districts` — array 9 `{ name, x0, z0, x1, z1, style }`:
  `Coral Strand, Neon Mile, Palmetto Heights, Deco Row, Downtown, Old Mercado,
  Keystone Field, Pelican Marina, Bayline Docks`.
- `SB.city.buildings` — array 66 `{ x, z, w, d, h, district, mesh }`.
- `SB.city.neon` — array 32 `{ text, x, y, z, color, mesh }`. `BAR` + `PIZZA`
  DIJAMIN di avenue `x=0` (koridor pandang cover).
- `SB.city.bank` — `{ x, z, mesh, signMesh }` — "Solmar National Bank", di sisi
  timur avenue `x=0` (z ≈ -10), blok di depannya DIKOSONGKAN supaya sightline
  bersih; sign lebar ~16 m, utuh dalam frame cover.
- `SB.city.build()` — bangun SEMUA mesh kota ke `SB.engine.scene` (dipanggil
  `attach()`; idempotent via guard `SB.city._built`).
- `SB.city.traffic` — array mobil traffic `{ group, x, z, heading, speed, color,
  kind }`. `SB.city.peds` — array pejalan kaki `{ group, x, z, heading, speed,
  shirt }`. Gerak dasar di-step engine (laju konstan di jalurnya); B2
  (vehicles/police) BOLEH mengambil alih posisi/heading tiap langkah.
- `SB.city.spawnTraffic(n, rng)`, `SB.city.spawnPeds(n, rng)` — isi ulang array
  di atas (dipakai `setPreset` + `setDensity`).
- `SB.city.setDensity(nTraffic, nPeds)` — alias staging (teruskan ke spawn).
- `SB.city.heli` — `{ group, cone, ring, x, y, z, heading }` — helikopter
  GULL-1 BERDETAIL (badan + kaca kokpit + boom ekor + rotor utama/ekor +
  skid + stripe + lampu), BUKAN siluet hitam blok. `cone` = spotlight cone
  (additive, opacity ~0,25, terlihat di siang/sunset) + `ring` = lingkaran
  cahaya di tanah. `SB.city.setHeli(x, y, z, heading)` — pindah heli; offset
  default dihitung dari heading hero: `rot(heading) * (6, 16, -38)` supaya
  tetap di frame saat hero belok. **B2 (police.js) yang menggerakkan heli
  saat live** (kejar/orbit); city hanya sediakan mesh + posisi awal.
- `SB.city.groundY(x, z)` → `0` (kota datar; jaga API untuk B2/B3).
- `SB.city.districtAt(x, z)` → nama distrik (dipakai HUD lokasi + `SB.state`).
- `SB.city.roadAt(x, z)` → `true` bila titik di koridor jalan (dipakai B2/B3
  untuk spawn yang tidak menabrak gedung).
- `SB.city.sun`, `SB.city.moon`, `SB.city.clouds[]` — mesh langit (baca saja).
- `SB.city.stalls` — array market stall Old Mercado (dipakai preset onfoot).
- `SB.city.heroCar` / `SB.city.heroPed` — mesh hero (mobil pink VENTO STRADA /
  pejalan kaki baju pink); `tick()` memposisikannya dari `SB.engine.hero` tiap
  langkah dan toggle visible per `mode`. B2 BOLEH pakai ulang (jangan buat duplikat).
- `SB.city.escorts` — 2 cruiser staging (offset hero-lokal `[-5,4]` / `[5.5,6]` —
  di SISI hero, sedikit di depan; offset negatif menempel kamera dan menutupi frame);
  `tick()` mengikuti hero selama `SB.city.followHero !== false`. **B2 police set
  `SB.city.followHero=false` saat mengambil alih heli/cruiser live.**
- `SB.city.parked` — 6 mobil parkir statis (satu di foreground kanan cover).
  `SB.city._fgCar` / `SB.city._fgPalm` — mobil + palm foreground yang mengikuti
  hero (mode mobil saja) supaya sudut kanan-bawah frame tidak kosong.

## 3. SB.player / SB.vehicles / SB.police (B2)

- `SB.player` — `{ x, z, heading, hp, armor, cash:500, rep:0, onFoot, weapon,
  weapons:[{name, mag, reserve, locked}], fire(), reload(), setWeapon(i),
  enterCar(), exitCar(), addCash(n), addRep(n) }`.
  Senjata 1-based `setWeapon(1..5)` (5 = rifle, locked awal). `fire()` TIDAK
  kurangi ammo saat di mobil (perilaku B2 — jangan diubah diam-diam).
  `fire()` panggil `SB.engine.muzzlePos()` + `SB.engine.burst(pos)`.
  Bunuh ped `userData.boss=true` → panggil `SB.missions.standoffDown()`.
- `SB.vehicles` — `{ list, hero, nearest(x,z), setSpeedKmh(v), gear(kmh) }`.
  `gear(kmh)` FUNGSI → `'G1'..'G5'/'N'/'R'`. `setSpeedKmh(151)` staging cover.
  Mobil pemain: `VENTO STRADA`, pink, cond 100.
- `SB.police` — `{ stars(), response:[{name, dist, status}], cruisers[],
  footCops[], heli, spawnBoss(x,z), ensureCops(refresh), setHeat(n) }`.
  `stars()` otoritatif (0–5). `response` contoh: GULL-1 SPOTLIGHT, MARLIN-11
  RAMMING. Heli live digerakkan di sini via `SB.city.setHeli`.
  `ensureCops(true)` = revive/reset (hanya dari `setPreset`); cop yang dibunuh
  mid-game TIDAK revive otomatis (diganti cop baru oleh police).
  `SB.police.standoff` — TIDAK ADA; standoff milik missions.

## 4. SB.missions / SB.dialog (B3)

- `SB.missions` — `{ list, jobs(), current(), start(id), demo(), reset(),
  update(dt), standoff, standoffDown(), marker, cash:0, rep:0 }`.
  8 misi: m1 First Fare $500, m2 The Package $1.200, m3 Hot Wheels $1.800,
  m4 Night Run $2.500, m5 Chop Shop $3.200, m6 Harbor Lights $3.200,
  m7 Heat $4.200, m8 The Big Score $5.000.
  `jobs()` → `[{i, name, pay, giver, st}]`, `st ∈ DONE/ACTIVE/OPEN/LOCKED`.
  `current()` → `{id, name, giver, obj, objIdx, objTotal, timeLeft, standoff}`
  atau `null` saat idle. `marker = {x, z, on, label}` — marker berlian
  objektif KECIL (r5: kecil dan rapi, jangan dominasi frame).
  `demo()` — quiet staging: reset lalu m1 DONE + m2 ACTIVE + standoff 4 +
  boss + enforcer ASLI ter-spawn; idempotent; **me-reset `SB.state.paused`
  ke `false`** — staging WAJIB set `paused=true` SETELAH `demo()`.
  `demo()` throw bila misi aktif. `update(dt)` tick-per-call (tanpa dedupe
  frame — `advanceSim`/main loop menjamin 1×/langkah).
  `standoffDown()` — kurangi standoff 1 (dedupe by id untuk enforcer; boss
  lewat hook B2 tanpa id). Standoff 0 → m2 DONE (+$800/REP 160).
  `start('m2')` / `startStandoff()` TIDAK BOLEH throw (quirk r3 diperbaiki r4).
- `SB.dialog` — `{ say(text, who), show(who, text), sayScene(id), base }`.
  `#dlg` KIRI-BAWAH (wheel kanan-bawah — JANGAN menimpa). `say()` INSTAN tanpa
  pause (staging); `show()` typewriter + pause. `base='assets/'` (portrait di
  `game/assets/*.jpg`: mara/jax/lucia). Potret: Mara Solis (fixer), Jax
  (mechanic), Lucia Ortega (driver).

## 5. SB.hud / SB.radio / SB.map / SB.shops / SB.save / SB.audio (B4)

- `SB.hud.init()` — WAJIB dipanggil SEBELUM `bootFromQuery()` (idempotent).
  `SB.hud.update()` + `SB.hud.render()` — tulis SEMUA elemen DOM dari live
  state TIAP panggilan (speed/jam/wanted/gear/response/wheel/cash/REP/health/
  armor/misi/radio/lokasi) — JANGAN andalkan event/snapshot saja (cacat r3:
  speed/jam/wanted tidak pernah update). `SB.hud.snapshot()` TIDAK BOLEH throw
  (pre-boot maupun post-boot); baca laju dari `SB.state.speedKmh` → fallback
  `SB.engine.hero.speedKmh`. Main loop (B5) panggil `update()/render()` tiap frame.
  Minimap bundar + search-zone + marker misi; canvas minimap LAZY (hanya
  setelah `#game-canvas` ada). Dialog `#dlg` kiri-bawah; wheel kanan-bawah;
  `#hud-bottom` tidak menimpa keduanya. Banner pause DISEMBUNYIKAN saat staging
  screenshot (B5 yang atur — jangan tampil di shot submit).
- `SB.radio` — 3 stasiun: WAVE 88.1, SOLMAR FM 101.5, REBEL 99.9 (nama + judul
  lagu di HUD). Keys: `Q` ganti stasiun, `R` reload senjata SAJA (KeyR HANYA
  reload — jangan radio). `SB.audio` — WebAudio guard: semua method no-throw
  + return boolean sebelum unlock; unlock via click/keydown.
- `SB.map` — peta penuh (tombol `M`): 9 distrik + label UTUH (clamp dari panel
  jobs + geser bila menabrak marker), grid RAPAT tanpa ruang hitam, jobs
  campuran DONE/ACTIVE/LOCKED, GPS objective aktif, LEGENDA 9 item (r5 wajib —
  r4 hilang), judul TIDAK menimpa tile.
- `SB.shops` — beli armor/ammo, repair, respray (hapus 1 bintang wanted),
  safehouse = save point. Potong `SB.player.cash`. Key `F` buka/tutup toko.
- `SB.save` — save/load localStorage (slot 1), round-trip bersih.

## 6. Preset staging (engine.setPreset — detail B1)

| Preset | tod | Hero | speed | heat | Kamera | Isi frame |
|---|---|---|---|---|---|---|
| cover | SUNSET | mobil (0, 60), h=π | 151 | 4 | chase [0,2.3,7.5] | pink UTUH tengah, 2 cruiser [-5,4]/[5.5,6], heli+cone, sun disc, bank sign UTUH, neon BAR+PIZZA, palm, traffic 24/peds 20, roadblock jauh |
| mission | SUNSET | mobil (0, 45), h=π | 96 | 3 | chase | traffic depan, heli, bank |
| night | NIGHT | mobil (0, 45), h=π | 88 | 3 | chase | bulan, neon, cruiser |
| onfoot | NIGHT | jalan kaki, Old Mercado (-44, 52) | 0 | 3 | foot cam belakang | stalls, 2 foot cop, peds, neon, heli |
| big-score | SUNSET | mobil (0, 30), h=π | 80 | 4 | chase | bank UTUH, jalan+trotoar+props/palm/mobil parkir/marka (tanah JANGAN kosong), traffic, heli+cone |
| map | SUNSET | mobil (0, 60) | 0 | 0 | orbit tinggi | backdrop kota penuh (label distrik urusan map.js B4) |

- `setPreset` me-reset: `SB.state.paused=false`, `frame=0`, `simTime=0`,
  traffic/peds sesuai tabel (via `setDensity`), heli ke offset heading,
  `SB.state.timeMin` (cover/mission/big-score = 17:24, night/onfoot = 21:40),
  `SB.state.heat` sesuai tabel.
- Kamera chase: posisi = hero + `rot(heading) * (0, 2.3, 7.5)` (lateral 0 — hero
  TEPAT di tengah frame), lookAt = hero + maju*10, y=2.0. On-foot: kamera di
  belakang hero `(0, 2.6, 5.2)` relatif heading, lookAt hero + maju*6.
- JANGAN panggil `SB.missions.demo()` di dalam `setPreset` (urusan staging B5);
  `setPreset` hanya dunia + hero + kamera.

## 7. Keys (kontrak global — JANGAN bentrok)

`WASD` gerak · `E` masuk/curi mobil · `Space` handbrake · `M` peta · `Q` radio ·
`R` reload (SATU tugas) · `Digit1–5` senjata · `F` toko · `P` pause ·
`Esc` tutup · `Shift` lari. Main loop: `SB.missions.update(dt)` tiap frame
saat live; `SB.hud.update()/render()` tiap frame.

## 8. Anggaran & larangan

- B1: engine.js + city.js ≤ 62.000 B. B2 ≤ 32.000 B. B3 ≤ 28.000 B.
  B4 ≤ 42.000 B. B5 index+main+css+main.ts ≤ 12.000 B.
  Dossier total ≤ 160.000 B (server hard cap 4 MB, tapi target verifikasi 160k).
- `three.min.js` vendor lokal (three@0.149.0, unduh segar) — BUKAN CDN, 0 request
  eksternal, tidak dihitung source.
- `game/index.html` entrypoint; `game/` ≤ 48 MiB, ≤ 993 file.
