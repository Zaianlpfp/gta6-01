# API.md — Kontrak antar modul "Solmar Bay" (gta6-01, rebuild r8)

Ditulis B1 di dalam recording r8, SEBELUM engine/city. B2–B5 membaca file ini
(bukan source lama) sebagai satu-satunya kontrak. B5 memindahkan file ini ke repo
root sebelum main.ts dijalankan (jangan masuk dossier).

## 0. Global & aturan dasar

- `window.SB` = satu-satunya namespace global. Semua modul menempel di `SB.*`.
- **Determinisme:** TIDAK ADA `Math.random` / `Date.now` di kode game. Semua acak
  lewat `SB.rng()` (mulberry32, seed tetap, lihat §1). `SB.state.simTime` adalah
  satu-satunya jam simulasi; naik `dt` tiap `step()`.
- **Heat = bintang 0–5** (integer). `SB.police.stars()` otoritatif; `SB.state.heat`
  mirror yang sama. JANGAN pakai skala 0–100.
- **Uang 3 ledger:** `SB.cash` (0), `SB.player.cash` (500), `SB.missions.cash` (0).
  HUD tampil `max()` ketiganya. `SB.shops` memotong `SB.player.cash`. REP:
  `SB.state.rep` (0) + `SB.missions.rep` (0); HUD tampil `max()`; 0 = STREET KID.
- **Pause:** `SB.state.paused` (bool). `SB.engine.step()` TIDAK menghormati pause —
  main loop WAJIB gate `step()` + `SB.missions.update(dt)` pada `!SB.state.paused`.
  Dialog pause (`dialog.show`) set `SB.state.paused = true`.
- **Urutan init (main.js):** `SB.hud.init()` DULU, lalu `SB.engine.bootFromQuery()`.
  `main.js` WAJIB `SB.engine.stop()` dulu, lalu menjalankan loop rAF SENDIRI
  (jangan biarkan 2 loop jalan; engine.boot() menyalakan loop internal).
- **Keys:** M = peta, Q/R = ganti stasiun radio, Digit1–4 = senjata, F = toko,
  Esc = tutup panel, **KeyR = reload SAJA** (bukan radio). Pause gate live-only.

## 1. `SB.rng` — RNG deterministik

- `SB.rng(seed)` → fungsi `() => [0,1)` (mulberry32). Seed default `1337`.
- `SB.rand` = instance default `SB.rng(1337)`; dipakai SEMUA penempatan kota /
  traffic / peds. `SB.randRange(a,b)`, `SB.randPick(arr)`, `SB.randInt(a,b)`.
- Reset: panggil `SB.rngReset()` sebelum build kota agar build 2× identik.

## 2. `SB.state` — state global

```
SB.state = {
  paused:false, heat:0, rep:0, cash:0,
  day:1, hour:17, min:24,            // jam HUD "FRI 17:24 · DAY 1 · SUNSET"
  timeLabel:'SUNSET',               // SUNSET | NIGHT | DAY
  simTime:0,                        // detik simulasi, naik di step()
  preset:'cover',                   // cover | onfoot | mission | map | free
  speedKmh:0,                       // kecepatan kendaraan aktif (HUD)
  vehicleName:'—', vehicleCond:100, vehicleStatus:'OK', // OK | DENTED
  inSight:false,                    // heli / polisi melihat pemain
  objective:'',                     // teks objektif aktif (HUD + minimap)
  staging:false,                    // true saat ambil screenshot staging
}
```

## 3. `SB.engine` — Three.js, loop, kamera, efek (engine.js, milik B1)

- `SB.engine.boot(opts)` — buat renderer + canvas SENDIRI (canvas dibuat engine,
  `preserveDrawingBuffer:true`, append ke `#game` bila ada, else `document.body`),
  scene, fog, lampu (hemi + directional = matahari), langit (gradasi + sun disc +
  awan), kamera chase. Menyalakan loop rAF internal. `opts = {w,h,preset}`.
- `SB.engine.bootFromQuery()` — baca `location.search`: `?scene=cover|onfoot|
  mission|map` (+ `heat`, `hour`), lalu `boot()` + `setPreset()`.
- `SB.engine.stop()` — hentikan loop internal (wajib dipanggil main.js sebelum
  loop sendiri). `SB.engine.start()` — nyalakan lagi (opsional).
- `SB.engine.step(dt)` — SATU tick simulasi + render. Dipanggil main loop
  (atau staging) dengan `dt = 1/60`. Isi: `simTime += dt`; gerak awan (deterministik
  dari `simTime`); update kamera chase (ikut `SB.player.hero` atau kendaraan aktif
  `SB.vehicles.active` bila ada); decay muzzle-flash pool; `renderer.render()`.
  TIDAK ADA `advanceSim` — staging mengulang `step(1/60)` ~90× lalu
  `SB.missions.update(1/60)` tiap langkah.
- `SB.engine.setPreset(name, opts)` — staging preset. Modul lain BOLEH me-wrap
  fungsi ini berantai (panggil versi sebelumnya dulu). Preset:
  - `cover`: hero di mobil pink `(0,0,0)`, kamera chase belakang-kanan rendah
    supaya mobil pink UTUH (tidak tertutup cruiser), `heat=4`, jam 17:24 SUNSET,
    heli + cone dalam frame, traffic + peds padat.
  - `onfoot`: hero jalan kaki di Old Mercado, `heat=2`, kamera bahu; tanah diisi
    props/palm/mobil parkir/marka (bukan tanah kosong).
  - `mission` ("big-score"): di depan bank, `heat=5`, heli cone terlihat,
    foreground terisi props/palm/mobil parkir/marka, sign bank utuh.
  - `map`: kamera top-down; peta 2D digambar `SB.map` (bukan engine).
  - `free`: bebas, `heat=0`.
- `SB.engine.shot()` → `string` data-URL JPEG (`canvas.toDataURL('image/jpeg',
  0.92)`) SETELAH `renderer.render()`. **Inilah cara screenshot** — jangan
  `page.screenshot` Playwright (TIMEOUT di swiftshader). B5 boleh pakai
  `pg.screenshot` atas halaman live HANYA bila `shot()` sudah terbukti jalan.
- `SB.engine.burst(x, y, z, n)` — muzzle-flash pool PERSISTEN: nyalakan `n`
  flash di titik itu (sprite + point light singkat). Pool dibuat sekali di boot.
- `SB.engine.muzzlePos` — `THREE.Vector3` posisi moncong senjata aktif; B2
  update tiap tembakan, lalu panggil `SB.engine.burst(...)` di titik itu.
- `SB.engine.spotCone()` → `THREE.Mesh` cone spotlight siap pakai: material
  transparan **opacity 0.25**, warna kuning pucat, `side: DoubleSide`,
  `depthWrite:false`. Dipakai heli polisi (B2) — JANGAN ubah opacity.
- `SB.engine.sun` — directional light matahari. Posisi TETAP
  `(-8, 150, -420)` di semua preset sunset (jangan digeser).
- `SB.engine.camera`, `SB.engine.scene`, `SB.engine.renderer`,
  `SB.engine.canvas` — akses langsung (read-only kecuali B5).
- `SB.engine.heroPos()` → `[x, z]` posisi hero saat ini (player atau kendaraan).

## 4. `SB.city` — kota 3D (city.js, milik B1)

- `SB.city.build(scene)` — bangun SEKALI di `boot()` (setelah `rngReset()`).
  Isi: tanah + jalan grid + trotoar + marka, 71 gedung (downtown menara +
  ruko + landmark), palm, neon/billboard, lampu jalan + glow, props (mobil
  parkir, stall pasar, bench, roadblock), pantai + marina + air, taman.
  Mengisi `SB.city.counts` dan array di bawah. JANGAN panggil 2×.
- `SB.city.counts = { buildings:71, palms, neons, props, traffic:24, peds:20 }`
  (traffic/peds = ambient dasar milik city; B2 boleh menggerakkan / mengganti
  mesh-nya, tapi JANGAN ubah jumlah di preset cover).
- `SB.city.districts` — 9 distrik `{name, cx, cz, w, d}`:
  Coral Strand, Neon Mile, Palmetto Heights, Deco Row, Downtown, Old Mercado,
  Keystone Field, Pelican Marina, Bayline Docks. Dipakai `SB.map` (label peta)
  dan `SB.missions` (lokasi misi).
- `SB.city.roads` — daftar ruas jalan `{x0,z0,x1,z1}` (sumbu grid). Dipakai
  traffic (B2) + spawn.
- `SB.city.spawnPoints = { cover:[0,0], onfoot:[x,z], mission:[x,z], ... }`
  titik spawn tiap preset (dipakai `setPreset` + B2).
- `SB.city.bank = { pos:[2,7,-2], rotY:Math.PI/4 }` — sign
  "SOLMAR NATIONAL BANK" (canvas texture **2048×512**, teks UTUH tidak terpotong)
  di gedung bank. Posisi + rotasi TETAP ini (deviasi r5 yang terbukti benar).
- `SB.city.staging = { coverCruisers:[[-5,4],[5.5,6]] }` — offset XZ cruiser
  escort relatif hero di preset cover. B2 spawn cruiser DI SINI (bukan
  [-5,-6]/[5.5,-4] — itu menempel kamera). Mobil pink harus tetap utuh.
- `SB.city.groundAt(x, z)` → `y` tanah (0 di jalan/trotoar; dipakai player/peds).
- `SB.city.nearBank(x, z)` → bool (dalam radius bank; dipakai staging mission).
- `SB.city.makeTextSprite(text, opts)` → `THREE.Sprite` label neon (dipakai
  city untuk sign; B2/B4 boleh pakai untuk label lain).

## 5. `SB.player` — jalan kaki + kendaraan (player.js, milik B2)

- `SB.player.hero` — mesh hero (pejalan kaki). `SB.player.pos()` → `[x,z]`.
- `SB.player.cash = 500` (ledger, lihat §0). `SB.player.weapon = 1`
  (default FISTS; 1=fists, 2=pistol, 3=SMG, 4=shotgun; 5=rifle locked).
- `SB.player.enterVehicle(v)`, `SB.player.exitVehicle()`,
  `SB.player.onFoot()` → bool.
- `SB.player` me-wrap `SB.engine.step` SEKALI (guard `SB._b2step`): gerak hero /
  kendaraan + kamera sudah di engine; wrap hanya tambah input + combat tick.
  main.js cukup panggil `SB.engine.step(dt)` — JANGAN panggil step ganda.
- `SB.player.fire()` — tembak: update `SB.engine.muzzlePos`, panggil
  `SB.engine.burst()`, beri damage ke target (lihat §7).

## 6. `SB.vehicles` — mobil + traffic (vehicles.js, milik B2)

- `SB.vehicles.list` — semua mobil `{mesh, name, cond, color, parked}`.
- `SB.vehicles.active` — kendaraan yang dikendarai (null = on-foot).
- `SB.vehicles.setSpeedKmh(v)` — set `SB.state.speedKmh` + kecepatan mesh.
  **Cover staging WAJIB panggil `setSpeedKmh(151)` SETELAH advanceSim/step loop.**
- `SB.vehicles.spawnTraffic(n)` — isi traffic ambient (default 24 di cover).
- `SB.vehicles.pinkCar` — mobil pemain (pink, `SB.state.vehicleName`).

## 7. `SB.police` — polisi darat + heli (police.js, milik B2)

- `SB.police.stars()` → int 0–5 (otoritatif). `SB.police.setStars(n)`.
- `SB.police.response` — `[{name, dist, status}]` unit merespons (HUD).
- `SB.police.heli` — mesh heli AIR-1 / GULL-1: badan + rotor + tail + lampu,
  BUKAN siluet blok hitam; cone dari `SB.engine.spotCone()` (opacity 0.25)
  mengarah ke hero dan TERLIHAT di frame cover/mission.
- `SB.police.update(dt)` — kejar hero, naikkan/turunkan heat, gerak heli + cone.
- `SB.police.cops` — foot cops; `userData.boss=true` + `userData.enforcer=true`
  WAJIB ada pada ped boss/enforcer misi (tanpa flag ini mereka TIDAK BISA
  dibunuh via combat — bug r5, jangan diulang).

## 8. `SB.missions` — 8 misi (missions.js, milik B3)

- `SB.missions.list` — 8 misi `{id, name, payout, district, done}`:
  1 First Fare $500 · 2 The Package $1.200 · 3 Hot Wheels $1.800 ·
  4 Night Run $2.500 · 5 Chop Shop $3.200 · 6 Harbor Lights $3.200 ·
  7 Heat $4.200 · 8 The Big Score $5.000.
- `SB.missions.cash = 0`, `SB.missions.rep = 0` (ledger, lihat §0).
- `SB.missions.update(dt)` — DIPANGGIL main loop TIAP frame (wajib; tanpa ini
  misi tidak jalan). `SB.missions.demo()` — staging QUIET (set misi aktif +
  objektif tanpa dialog). `SB.missions.start(id)`, `SB.missions.complete(id)`
  (+payout, +REP; misi 1 = +$500 / REP +130).
- `SB.missions.standoffDown()` — dipanggil `SB.player` saat ped
  `userData.boss=true` tumbang (counter standoff turun; Saltjack 4→3).
- `SB.missions.marker` — marker objektif: BERLIAN MERAH **KECIL** (jangan raksasa).
- `SB.missions.active` — misi aktif `{id, name, objective, timer}`.

## 9. `SB.dialog` — dialog + potret (dialog.js, milik B3)

- `SB.dialog.say(who, role, text, img)` — tampil INSTAN (tanpa typewriter) di
  `#dlg` KIRI-BAWAH (wheel kanan-bawah — jangan menimpa). Dipakai staging.
- `SB.dialog.show(...)` — tampil + set `SB.state.paused = true`. JANGAN tumpuk
  2 `show()` berurutan.
- Potret: `game/assets/mara.jpg`, `jax.jpg`, `lucia.jpg` (Mara Solis fixer,
  Jax mechanic, Lucia Ortega getaway driver).

## 10. `SB.hud` / `SB.radio` / `SB.map` / `SB.shops` / `SB.save` / `SB.audio` (B4)

- `SB.hud.init()` — WAJIB SEBELUM `bootFromQuery()`. `SB.hud.setStaging(true)`
  — sembunyikan banner "PAUSED" saat staging screenshot (game boleh pause,
  bannernya tidak boleh terlihat). HUD: health + armor bar di SEMUA frame
  gameplay, panel crew (3 crew + peran Driver/Mechanic/Lookout), timer misi,
  status "IN SIGHT", kondisi kendaraan + DENTED, jam/hari, REP + rank, minimap
  bundar (lazy, kanan-atas — hindari `#dlg` kiri-bawah), radio widget.
- `SB.radio.stations` — 3 stasiun: WAVE 88.1, SOL 101.9, BAY 96.5. Q/R ganti.
- `SB.map.open()` / `close()` — peta penuh: grid RAPAT tanpa ruang hitam,
  9 label distrik UTUH (clamp, "Bayline Docks" tidak terpotong), legenda 9 item,
  judul tidak menimpa tile, jobs DONE/ACTIVE/LOCKED campuran, GPS objektif aktif.
- `SB.shops.buy(kind)`, `SB.shops.respray()` (hapus 1 bintang), safehouse = save.
- `SB.save.save()` / `load()` — localStorage. `SB.audio` — WebAudio (bassline
  beda per stasiun; mute aman headless).

## 11. Verifikasi B1 (yang dilaporkan B1)

- `node --check` engine.js + city.js. 0× `Math.random` / `Date.now` (grep).
- Determinisme STATE 2×: jalankan preset cover 2× (step 1/60 ×90) → hero,
  speed, heat, counts bangunan/traffic/peds HARUS identik.
- SATU render kecil ≤640×360 (headless shell + swiftshader, file:// saja;
  127.0.0.1 diblokir proxy). 0 console/page error. `SB.engine.shot()` jalan.
