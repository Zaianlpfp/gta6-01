# Solmar Bay — API (B1, v4-rebuild r4)

Kontrak antar modul. `engine.js` + `city.js` dimuat setelah `vendor/three.min.js`
(r149). Semua modul hidup di namespace global `SB` (`window.SB`).
Determinisme: tanpa pengacak bawaan dan tanpa jam dinding di engine/city — semua
acak dari `SB.engine.rng(seed)` (mulberry32). Sim maju dengan `dt` tetap 1/60.

## Konvensi dunia

- Satuan meter, tanah `y=0`, kota `x,z` dalam ±170. Pantai/laut di barat (`x<-170`).
- Forward = `(-sin h, -cos h)` dengan `h` = heading. Model dibuat menghadap `-z`
  pada `h=0`. Kamera chase = hero + `rot(h)*(0, 3.5, +8.6)`.
- Jalan grid di `x,z ∈ {-144,-96,-48,0,48,96,144}`, lebar 12 m.
- `SB.city.roadAt(x,z)` → true bila titik di jalan.

## SB.state

```js
SB.state = { paused:false, heat:0, speedKmh:0, mode:'car'|'foot', preset:'cover',
             time:{ day:1, dow:'FRI', hour:17, min:24 } }
SB.cash = 0   // ledger engine (HUD tampil max(SB.cash, SB.player.cash, SB.missions.cash))
```

- **`heat` = BINTANG 0–5, bukan 0–100.** Poin 0–100 internal di `SB.police.pts`;
  otoritatif: `SB.police.stars()`. HUD baca bintang.
- **`paused=true` menghentikan sim** (`engine.step` hanya render + kamera).
  Dialog B3 set `paused=true`; jangan andalkan `step` untuk animasi saat pause.

## SB.engine

| Fungsi | Keterangan |
|---|---|
| `boot(w,h)` | Buat renderer/canvas/scene/kamera/lampu/langit, `city.attach()`, preset `cover`. |
| `bootFromQuery()` | `boot` + baca `?preset=&adv=&speed=&pause=&loop=`; dipanggil `main.js` (B5). |
| `start()` / `stop()` | Loop rAF: `step(1/60)` tiap frame. |
| `step(dt, noRender?)` | 1 langkah sim (skip bila `paused`) + kamera + render. **B2 wrap sekali** (guard `SB._b2step`). |
| `advanceSim(n, dt=1/60)` | Majukan sim `n` langkah abaikan pause; render hanya langkah terakhir. Alat staging. |
| `setPreset(name)` | Terapkan preset (lihat bawah). **Boleh di-wrap berantai** B2/B3/B4. |
| `setSpeedKmh(kmh)` | Set laju hero + `SB.state.speedKmh`. `SB.vehicles.setSpeedKmh` (B2) delegasi ke sini. |
| `muzzlePos()` | `THREE.Vector3` posisi moncong senjata hero (dipakai `SB.player.fire` → `SB.city.burst`). |
| `heroPos()` | Clone `Vector3` posisi hero. |
| `rng(seed)` | Fungsi acak deterministik (mulberry32). |
| `render()` / `shot()` | Render; `shot()` → dataURL PNG 1280×720. |
| `rotXZ(h,x,z)` | Putar vektor lokal → dunia. |
| `hero` | `{ pos:Vector3, heading, speedKmh, mode:'car'|'foot' }` |
| `presetNames` | `['cover','mission','night','onfoot','big-score','map']` |
| `simTime`, `frame` | Waktu sim (detik) + hitungan frame. |

### Preset (6)

| Preset | Waktu | Mode | Isi frame |
|---|---|---|---|
| `cover` | sunset | car | Mobil pink tengah, 2 cruiser mengapit, traffic, peds, heli+cone, sun disc, sign bank, palm, neon BAR/PIZZA. Laju awal 151; hero mulai `z=100` (setelah `advanceSim(90)` di `z≈37`, bank 29 m di depan). |
| `mission` | sunset | car | Mobil menuju bank, sign bank utuh, traffic di depan, heli+cone. |
| `night` | night | car | Neon + headlight, heli cone jelas, kota malam. Hero mulai `z=70`. |
| `onfoot` | night | foot | Hero jalan kaki di avenue `-48` (Old Mercado): market stalls, 2 foot cop dekat, peds lari, neon. Titik uji muzzle flash. |
| `big-score` | sunset | car | Depan bank: jalan+trotoar+parkir+palm+props terisi, sign bank utuh, heli+cone. |
| `map` | day | car | Kamera atas kota penuh (dipakai layar peta B4). Heli mati. |

`setDensity()` men-staging 3 traffic + 6 peds di depan hero (avenue `x=0`);
traffic melaju secepat hero supaya offset konstan selama `advanceSim` berapa pun.

**Staging cover (WAJIB, pelajaran r3):** `setPreset('cover')` →
`advanceSim(90)` → `SB.vehicles.setSpeedKmh(151)` (atau `SB.engine.setSpeedKmh(151)`)
→ `SB.state.paused=true`. Tanpa pause, hero melaju ±62 m selama 90 langkah dan
kamera ikut lari; tanpa `setSpeedKmh` sesudah `advanceSim`, laju turun (roadblock).

## SB.city

| Anggota | Keterangan |
|---|---|
| `attach(scene)` | Bangun seluruh kota (dipanggil `engine.boot`). |
| `update(dt, t)` | Traffic, peds, heli/rotor/cone, laut, decay burst. Dipanggil `engine.step`. |
| `buildings` | Array 66 `{x,z,w,d,h,district,mesh}`. |
| `districts` | 9 `{name,cx,cz,color}`: Pelican Marina, Palmetto Heights, Bayline Docks, Coral Strand, Downtown, Deco Row, Old Mercado, Neon Mile, Keystone Field. |
| `traffic` | Array 29 `{mesh,axis,fixed,along,dir,lane,speed,kind,follow,off,active}`. `kind`: `car|cruiser|taxi|truck`. Index 0–1 = cruiser pengapit hero (`follow=true`, offset `[-5,-6]` / `[5.5,-4]`). |
| `peds` | Array 28 `{mesh,axis,fixed,along,dir,speed,run,active,ph}`. Index 0–1 = foot cop (`mesh.userData.cop=true`). |
| `cops` | `[peds[0], peds[1]]`. |
| `bank` | `{x:26, z:8, mesh, sign}` — sign "SOLMAR NATIONAL BANK" di wajah barat. |
| `parked` | 6 mobil parkir dekat bank. |
| `heli`, `coneGrp`, `spot` | Heli GULL-1, cone spotlight (opacity **0.12** — 0.07 terlalu samar), lingkaran cahaya tanah. Heli hover di hero + `rot(heading)*(6, 16, -38)` (offset diputar heading supaya tetap di frame saat hero belok), cone mengarah hero + `rot(heading)*(4,0,-4)`. |
| `setDensity(cars, peds)` | Aktifkan N traffic / M peds pertama (preset staging). Mode foot: cruiser parkir dekat plaza, 2 cop dekat hero, 1/3 peds lari. |
| `setHeli(on, hero)` | Tampilkan/sembunyikan heli + cone + spot. |
| `placeHero(hero)` | Posisikan `heroCar`/`heroChar` + toggle visibilitas per `mode`. |
| `makeCar(color, {cruiser,taxi,truck})` | Grup mobil (hadap `-z`). |
| `makePerson(shirt, cop?)` | Grup pejalan kaki. |
| `burst(x,y,z, {n,color,flash})` | Picu burst muzzle flash (lihat bawah). |
| `roadAt(x,z)` / `groundY()` | Helper posisi. |

### Muzzle flash — pool PERSISTEN (perbaikan r2, terbukti r3)

`attach()` membuat **sekali**: 96 box partikel (`city.burstPool`, `visible=false`),
1 flash sprite, 1 `PointLight` (intensitas 0). Semua tinggal di scene sejak awal;
engine me-render seluruh live scene tiap frame. `burst()` HANYA toggle
visible/posisi/kecepatan partikel + nyalakan flash/light; `update()` menganimasikan
dan mematikannya (±0,32 detik). **Jangan** buat mesh baru di `burst()` — objek yang
ditambahkan setelah `setPreset` tidak pernah ter-render.

Verifikasi: render frame on-foot sebelum vs sesudah `fire()` → PNG harus berbeda
(sha256 beda + flash terlihat).

## Kontrak modul lain (B2/B3/B4)

**B2 — player/vehicles/police** (wajib sediakan):
- `SB.vehicles.setSpeedKmh(kmh)` → delegasi `SB.engine.setSpeedKmh`.
- `SB.player.fire()` → `SB.city.burst(SB.engine.muzzlePos().x, …)` + damage.
- `SB.police.stars()` (0–5), `SB.police.pts` (0–100), `SB.police.response`
  `[{name, dist, status}]` (mis. `{name:'GULL-1', dist:35, status:'SPOTLIGHT'}`).
- Wrap `SB.engine.step` sekali (guard `SB._b2step`); wrap `setPreset` bila perlu.
- Saat ped `userData.boss=true` tumbang → panggil `SB.missions.standoffDown()`.
- `SB.player.cash` (mulai 500), `SB.player.onFoot`, `SB.player.health/armor`.

**B3 — missions/dialog** (wajib sediakan):
- `SB.missions.update(dt)` — **dipanggil tiap frame oleh loop utama** (B5 `main.js`).
- `SB.missions.demo()` — setup staging (jobs campuran DONE/ACTIVE/LOCKED); throw bila misi aktif.
- `SB.missions.standoffDown()` — counter standoff turun.
- `SB.missions.jobs()` → `[{i,name,pay,giver,st}]` (`st` = status, `pay` = payout).
- `SB.missions.cash`, `SB.missions.timeLeft` (number, detik).
- Dialog: `dialog.say()` instan (staging); `#dlg` di KIRI-BAWAH (wheel kanan-bawah).
  `dialog.show()` set `SB.state.paused=true`.

**B4 — hud/radio/map/shops/save/audio**:
- `SB.hud.init()` **SEBELUM** `bootFromQuery()`.
- Peta: marker objek `{x,z,on,label}`; 9 label distrik dari `SB.city.districts`.
- Keys: `M` peta, `Q/R` radio, `Digit1–4` senjata, `F` toko, `Esc` tutup.
  `KeyR` HANYA reload (jangan radio).
- HUD tampil `max(SB.cash, SB.player.cash, SB.missions.cash)` dan REP `max(...)`.
