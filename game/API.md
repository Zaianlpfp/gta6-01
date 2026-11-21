# API.md — Kontrak antar modul "Solmar Bay" (gta6-01, rebuild r12)

Ditulis B1 di dalam recording r12, SEBELUM engine/city. B2–B5 membaca file ini
(bukan source lama) sebagai satu-satunya kontrak. B5 memindahkan file ini ke repo
root sebelum main.ts dijalankan (jangan masuk dossier).

Perubahan r12 vs r11 (alasan: juri buta r11 30 vs 27 — hero onfoot kecil/jauh,
fasad kiri ~30% frame; r12 mengejar margin, bukan sekadar perbaiki defect):
- Spawn onfoot PINDAH (40,62) -> (0,40): persimpangan jalan x=0 dan z=40
  (zebra cross di (0,47.5); jalan silang z=40 membuka frame kiri-kanan; papan
  bank (2,7,-2) terbaca di kejauhan — kota tampil, bukan satu fasad).
- Kamera preset onfoot lebih dekat: pos (0,5.0,50), look (0,1.3,38)
  (r11: (40,6.0,78)/(40,1.2,56), jarak 16 — hero kecil). Jarak kini 10.
- Foreground pasar pindah mengikuti spawn: stall/palm/mobil parkir dari tepi
  jalan x=40 ke tepi jalan x=0 (translasi x -40, z -28 dari layout relatif
  kamera lama). Koridor showcase TETAP lebar (fasad ≥7,5 dari sumbu jalan).
- Semua fix r10/r11 dipertahankan: SB.registerUpdate terdefinisi + dipanggil
  step(); DT_CAP 1,0 (clamp 0,05 JANGAN dikembalikan); advanceClock di step();
  step() satu-satunya pemanggil SB.police.update; cone heli 0,10; peds drift
  murni simTime; preset kamera di jalan.

Perubahan r10 vs r9 (alasan: r9 seal mati restart VM 01:34 WIB; B2 r9 menemukan
clamp dt 0,05 bikin sim live 10-20x lebih lambat dari wall time; B3 r9 menemukan
SB.registerUpdate tidak pernah didefinisikan; B4 r9 menemukan kamera onfoot
masih memfilm tembok ~40% frame):
- `SB.registerUpdate(fn)` DIDEFINISIKAN engine.js (lihat §3) — dipanggil
  `step()` tiap frame. Di r9 tidak ada yang mendefinisikannya (hanya hud.js
  yang memanggil, dengan guard) — itu akar HUD beku.
- dt LIVE LOOP = wall-clock, CAP 1,0 detik (BUKAN 0,05). Berlaku untuk loop
  internal engine (boot/start) DAN loop main.js. ⚠️ main.js:19 r9 masih
  `if (dt > 0.05) dt = 0.05;` — file itu milik B5, B5 r10 / integrator WAJIB
  ubah ke 1,0, kalau tidak sim live tetap jalan 10-20x lambat di headless.
  Staging / stepping manual tetap pakai dt tetap 1/60 (deterministik).
- Koridor jalan showcase (x=0, x=40) DILEBARKAN: bangunan yang menghadap
  jalan dipaksa lebar ≤11 (fasad ≥7,5 dari sumbu jalan; r9 fasad 4,5 → tembok
  makan ~40% frame onfoot). Kamera onfoot: pos (40,6.0,78), look (40,1.2,56).

Perubahan r9 vs r8 (juri buta r8 21 vs 32 — dunia beku, jam mentok,
kamera tembok, sorot heli memutihkan papan bank):
- Jam HUD kini hidup: `SB._clockMin` dimajukan `engine.step()` (1 detik sim =
  1 menit game, sama seperti v3); hour/min/timeLabel diturunkan tiap step.
- `engine.step()` juga memanggil `SB.police.update(dt)` bila ada — SATU-SATUNYA
  pemanggil (main.js JANGAN panggil police.update; double-step). Di r8 tidak
  ada yang memanggil police.update sehingga heli/cruiser diam di live loop.
- Ped ambient digerakkan `engine.step()` dari simTime (pure function, tetap
  deterministik); traffic V.traffic sudah bergerak via wrap B2.
- Kamera preset onfoot/mission DIPINDAH ke koridor jalan (sightline bebas
  gedung): onfoot (40,62), mission (0,10). Di r8 kamera onfoot (69,76) dan
  mission (11,26) berada di dalam/di balik footprint gedung → tembok.
- Cone sorot heli: opacity 0.25 → 0.10, radius 7 → 5, tinggi 42 → 36 —
  papan "SOLMAR NATIONAL BANK" harus tetap terbaca di frame cover.

## 0. Global & aturan dasar

- `window.SB` = satu-satunya namespace global. Semua modul menempel di `SB.*`.
- **Determinisme:** TIDAK ADA `Math.random` / `Date.now` di kode game. Semua acak
  lewat `SB.rng()` (mulberry32, seed tetap, lihat §1). `SB.state.simTime` adalah
  satu-satunya jam simulasi; naik `dt` tiap `step()`.
- **Jam HUD:** `SB._clockMin` = menit sejak 00:00 (basis per preset, mis. cover
  17*60+24). `engine.step()` memajukan `_clockMin += dt * SB.state.clockRate`
  (`clockRate = 1`, 1 detik sim = 1 menit game — sama seperti v3), lalu
  `hour = floor(_clockMin/60)`, `min = floor(_clockMin%60)`, `timeLabel` dari
  hour (NIGHT 20–05, SUNSET 17–19, DAY 06–16). `setPreset()` mengatur basis jam.
  HUD membaca `SB.state.hour/min` — JANGAN set jam langsung di luar engine.
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
  traffic / peds. `SB.randRange(a,b)`, `SB.randInt(a,b)`, `SB.randPick(arr)`.
- Reset: panggil `SB.rngReset()` sebelum build kota agar build 2× identik.

## 2. `SB.state` — state global

```
SB.state = {
  paused:false, heat:0, rep:0, cash:0,
  day:1, hour:17, min:24,            // jam HUD "FRI 17:24 · DAY 1 · SUNSET"
  timeLabel:'SUNSET',               // SUNSET | NIGHT | DAY
  clockRate:1,                      // 1 detik sim = 1 menit game (v3)
  simTime:0,                        // detik simulasi, naik di step()
  preset:'cover',                   // cover | onfoot | mission | map | free
  speedKmh:0,                       // kecepatan kendaraan aktif (HUD)
  vehicleName:'—', vehicleCond:100, vehicleStatus:'OK', // OK | DENTED
  inSight:false,                    // heli / polisi melihat pemain
  objective:'',                     // teks objektif aktif (HUD + minimap)
  staging:false,                    // true saat ambil screenshot staging
}
// SB._clockMin — menit sejak 00:00 (bukan bagian state; dimajukan step()).
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
- **`SB.registerUpdate(fn)` — DIDEFINISIKAN engine.js (r10, BARU).** Daftar
  callback yang dipanggil `E.step(dt)` SETIAP tick, SETELAH simTime/jam/police/
  ped/flash dimajukan dan SEBELUM render — supaya HUD dan modul lain selalu
  membaca state terbaru. Daftarkan sekali saja (duplikat diabaikan); panggil
  balik dengan `dt`; error di satu callback tidak boleh menghentikan yang lain
  (try/catch per callback). `SB.unregisterUpdate(fn)` melepasnya.
  `SB.hud.init()` mendaftarkan `update()` lewat sini (hud.js r9 sudah memanggil
  dengan guard — di r9 tidak terdefinisi sehingga no-op). HUD r9 JUGA punya loop
  rAF sendiri yang memanggil `update()` — pemanggilan ganda per frame AMAN
  (update idempotent, tulis DOM yang sama) dan bukan bug.
- `SB.engine.step(dt)` — SATU tick simulasi + render. Dipanggil main loop
  (atau staging) dengan `dt` wall-clock (live) atau `1/60` (staging manual).
  **dt LIVE = wall-clock, CAP 1,0 detik** (r10 — r9 clamp 0,05 bikin sim live
  10-20x lebih lambat dari wall di headless ~1fps: 10 detik W-hold cuma majukan
  simTime 0,47 detik). Modul B2 sudah menangani dt sampai 1,0 detik. JANGAN
  kembalikan clamp 0,05 di loop mana pun (engine boot/start DAN main.js).
  Isi, BERURUTAN: `simTime += dt`; majukan jam (`_clockMin += dt*clockRate`,
  turunkan hour/min/timeLabel); gerak awan (deterministik dari `simTime`);
  gerak ped ambient (pure function dari `simTime`, lihat §4); panggil
  `SB.police.update(dt)` bila ada (SATU-SATUNYA pemanggil — main.js dan wrap B2
  JANGAN panggil police.update); decay muzzle-flash pool; panggil SEMUA
  callback `SB.registerUpdate` (lihat di atas); update kamera chase
  (ikut `SB.player.hero` atau kendaraan aktif `SB.vehicles.active` bila ada);
  `renderer.render()`. TIDAK ADA `advanceSim` — staging mengulang `step(1/60)`
  ~90× lalu `SB.missions.update(1/60)` tiap langkah.
- `SB.engine.setPreset(name, opts)` — staging preset. Modul lain BOLEH me-wrap
  fungsi ini berantai (panggil versi sebelumnya dulu). Preset:
  - `cover`: hero di mobil pink `(0,0,0)`, kamera chase belakang-kanan rendah
    supaya mobil pink UTUH (tidak tertutup cruiser), `heat=4`, jam 17:24 SUNSET,
    heli + cone dalam frame, traffic + peds padat. Kamera TETAP r8:
    pos (10.5,5.4,19.5), look (-0.5,1.6,-4) — sightline ini bersih dari gedung.
  - `onfoot`: hero jalan kaki di persimpangan Old Mercado / Downtown, `heat=2`,
    jam 18:05 SUNSET. Spawn (0,40) DI PERSIMPANGAN jalan x=0 dan z=40
    (zebra cross di (0,47.5); r11 (40,62) — juri: hero kecil/jauh, fasad kiri
    ~30% frame). Kamera DI JALAN yang sama, lebih dekat: pos (0,5.0,50),
    look (0,1.3,38) — jarak 10 (r11: 16) — sightline lurus menyusuri jalan
    x=0 ke arah papan bank (2,7,-2); hero + stall pasar + mobil parkir +
    palm terlihat, BUKAN tembok. Koridor x=0 sudah lebar (fasad ≥7,5).
  - `mission` ("big-score"): di depan bank, `heat=5`, jam 17:48 SUNSET, heli
    cone terlihat, foreground terisi props/palm/mobil parkir/marka, sign bank
    utuh. Spawn (2,10) di tepi jalan x=0. Kamera DI JALAN x=0: pos (0,6.2,26),
    look (2,2.2,4) — sightline lurus menyusuri jalan x=0 ke arah papan bank
    (2,7,-2); BUKAN (11,6.2,26) r8 yang menembus gedung blok (20,20).
  - `map`: kamera top-down; peta 2D digambar `SB.map` (bukan engine).
  - `free`: bebas, `heat=0`.
- `SB.engine.shot()` → `string` data-URL JPEG (`canvas.toDataURL('image/jpeg',
  0.92)`) SETELAH `renderer.render()`. **Inilah cara screenshot** — jangan
  `page.screenshot` Playwright (TIMEOUT di swiftshader). B5 boleh pakai
  `pg.screenshot` atas halaman live HANYA bila `shot()` sudah terbukti jalan.
- `SB.engine.burst(x, y, z, n)` — muzzle-flash pool PERSISTEN: nyalakan `n`
  flash di titik itu (sprite + point light singkat). Pool dibuat sekali di boot.
- `SB.engine.muzzlePos` — `THREE.Vector3` posisi moncong senjata aktif; B2
  update tiap tembakan, lalu panggil `SB.engine.burst()` di titik itu.
- `SB.engine.spotCone()` → `THREE.Mesh` cone spotlight siap pakai: material
  transparan **opacity 0.10 (r9; r8 0.25 memutihkan papan bank)**, warna kuning
  pucat, `side: DoubleSide`, `depthWrite:false`. Cone r9: radius 5, tinggi 36
  (r8: 7/42). Dipakai heli polisi (B2) — JANGAN ubah opacity.
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
- `SB.city.spawnPoints = { cover:[0,0], onfoot:[0,40], mission:[2,10], ... }`
  titik spawn tiap preset (dipakai `setPreset` + B2). onfoot r12 = (0,40) di
  persimpangan jalan x=0/z=40 (r11 (40,62) di jalan x=40 — JANGAN kembalikan;
  r8 (60,62) di dalam gedung).
- `SB.city.bank = { pos:[2,7,-2], rotY:Math.PI/4 }` — sign
  "SOLMAR NATIONAL BANK" (canvas texture **2048×512**, teks UTUH tidak terpotong)
  di gedung bank. Posisi + rotasi TETAP ini (deviasi r5 yang terbukti benar).
- `SB.city.staging = { coverCruisers:[[-5,4],[5.5,6]] }` — offset XZ cruiser
  escort relatif hero di preset cover. B2 spawn cruiser DI SINI (bukan
  [-5,-6]/[5.5,-4] — itu menempel kamera). Mobil pink harus tetap utuh.
- `SB.city.groundAt(x, z)` → `y` tanah (0 di jalan/trotoar; dipakai player/peds).
- `SB.city.nearBank(x, z)` → bool (dalam radius bank; dipakai staging mission).
- `SB.city.peds` — 20 pejalan kaki; tiap ped menyimpan `userData.bx/bz`
  (posisi dasar), `userData.axis` ('x'|'z', sumbu trotoar), `userData.sp`
  (kecepatan jalan, dari walkPhase — TANPA rand baru), `userData.walkPhase`.
  `engine.step()` menggerakkan mereka: posisi sepanjang sumbu =
  `base + sin(simTime*0.22*sp + walkPhase) * 6` (+ bob kecil) — pure function
  dari simTime, deterministik. JANGAN gerakkan ped di luar step().
- **Koridor showcase dilebarkan (r10):** bangunan yang menghadap jalan x=0
  atau x=40 dipaksa lebar ≤11 (clamp SETELAH rand — stream rand tetap sama,
  kota lain identik; jumlah gedung tetap 71). Fasad kini ≥7,5 dari sumbu jalan
  (r9: 4,5) — jalan terbaca sebagai jalan, bukan ngarai tembok. Yang di-clamp:
  blok (bx=20,k=1) & (bx=60,k=0) menghadap x=40; blok (bx=-20,k=1) &
  (bx=20,k=0) menghadap x=0. Gedung bank (bx=20,bz=-20,k=0) TIDAK berubah
  ukuran akhir (diskala 26×14×14 setelah clamp).
- Foreground on-foot r12 (di tepi jalan x=0, mengikuti spawn (0,40)):
  stall di (4,26)/(4,34)/(4,42), mobil parkir (-4,30)/(-4,40),
  palm (6,22)/(6,46). Foreground big-score tetap di sekitar (2,10).

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
  BUKAN siluet blok hitam; cone dari `SB.engine.spotCone()` (opacity 0.10)
  mengarah ke hero dan TERLIHAT di frame cover/mission.
- `SB.police.update(dt)` — kejar hero, naikkan/turunkan heat, gerak heli + cone.
  DIPANGGIL `SB.engine.step()` tiap tick (SATU-SATUNYA pemanggil — main.js dan
  wrap B2 JANGAN memanggilnya; di r8 tidak ada yang memanggil sehingga heli
  dan cruiser diam di live loop).
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
- r9: `M.getHUD()` / `M.getGPS()` / `notifyHUD()` — panel misi + GPS hidup
  (panggil `SB.hud.update()` + `SB.map.render()` langsung tiap transisi).

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
  speed, heat, counts bangunan/traffic/peds, jam (`_clockMin`), posisi kamera
  HARUS identik.
- **registerUpdate (r10, BARU):** `typeof SB.registerUpdate === 'function'`;
  callback terdaftar dipanggil tiap `step()` (hitung panggilan 2× step = 2×
  dipanggil); duplikat diabaikan; error di callback tidak menghentikan step.
- **dt live (r10, BARU):** loop rAF engine (E.start) maju ~1 detik sim per
  1 detik wall (ukur simTime t0 vs t+10 detik wall — HARUS naik ~10 detik sim,
  BUKAN ~0,5 seperti clamp 0,05). Jam HUD maju ≥1 menit per ~1 detik wall
  (clockRate 1). ⚠️ Halaman index.html (loop main.js) MASIH clamp 0,05 sampai
  B5 r10 / integrator ubah main.js:19 → 1,0 — ukur dan laporkan angkanya
  sebagai bukti, jangan disembunyikan.
- Pixel-diff (bukti loop hidup — WAJIB, bukan state saja): load live
  `?scene=cover` headless, TANPA stepping manual: baca simTime + jam + posisi
  traffic V.traffic[0] di t0, tunggu 10 detik wall, baca lagi → simTime HARUS
  naik, traffic HARUS berpindah; pixel-diff shot() t0 vs t10 HARUS > threshold
  (diukur in-page, downsample 160×90, mean abs diff + % piksel berubah).
  Jam HUD maju ≥1 menit per ~30 detik wall headless (clockRate 1, headless
  ~1–2 fps — sama seperti v3). Screenshot onfoot + mission HARUS menampilkan
  hero + jalan (varians piksel region tengah, bukan warna tembok seragam).
- **onfoot r12 (BARU):** spawn (0,40) di persimpangan (zebra + jalan silang);
  kamera preset (0,5.0,50) look (0,1.3,38) — jarak kamera-hero 10 (r11: 16);
  koridor x[-7,7] z[20,60] bebas gedung tinggi; fasad terdekat ≥7,5 dari sumbu
  x=0; screenshot onfoot HARUS menampilkan jalan + zebra + stall/palm/mobil
  + papan bank di kejauhan (bukan tembok, bukan void).
- SATU render kecil ≤640×360 (headless shell + swiftshader, file:// saja;
  127.0.0.1 diblokir proxy). 0 console/page error. `SB.engine.shot()` jalan.
