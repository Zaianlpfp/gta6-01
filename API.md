# API.md — Kontrak antar modul "Solmar Bay" v4 (B1 Engine)

Ditulis B1 di dalam recording v4. B2–B5 WAJIB patuh. B5 pindahkan file ini ke
repo root sebelum main.ts dijalankan (jangan masuk dossier).

## 0. Muat & urutan init (B5 — index.html, classic scripts, urutan ini)

```
vendor/three.min.js → engine.js → city.js → player.js → vehicles.js
→ police.js → missions.js → dialog.js → hud.js → radio.js → map.js
→ shops.js → save.js → audio.js → main.js
```

`main.js` memanggil SATU-SATUNYA entry: `SB.engine.bootFromQuery()`.
Jangan panggil `init()` sendiri. Semua modul mengisi `window.SB` saja.

## 1. Global `SB` (dibuat engine.js, diisi modul lain)

```
SB = {
  THREE, renderer, scene, camera,            // three.js r149
  rng, rand(a,b), ri(a,b), pick(arr),        // RNG seed (mulberry32), SB.rng(seed)
  state: { scene:'cover', heat:0, tod:'sunset', t:0, day:1, clock:17*60+24,
           paused:false, speed:0 },          // tod: 'sunset'|'night'|'day'
  world: { size:560, half:280, beachX:-190, seaX:-260 },
  city:  { group, districts:[], roads:[], buildings:[], traffic:[], peds:[],
           palms, neons, signs:{}, lm:{bank,hospital,police,hotel,garage,marina} },
  player:{ pos:V3, heading:0, speed:0, inCar:false, car:null, mesh:null, onFoot:null },
  cam:   { mode:'chase', update(dt) },
  fx:    { flash(x,y,z,c), puff(x,y,z,c), update(dt) },
  sky:   { set(tod), sun:V3, clouds:[] },
  engine:{ init(o), bootFromQuery(), setPreset(n,o), step(dt), render(), resize() },
  util:  { clamp, lerp, mulberry32 }
}
```

Aturan determinisme: SEMUA acak lewat `SB.rand/ri/pick` (seed tetap, default
1337, diubah `?seed=`). JANGAN `Math.random`, JANGAN `Date.now()` di jalur
render. `SB.state.t` hanya maju lewat `SB.engine.step(dt)` (dt tetap 1/60
di preset). Update real-time (input pemain) boleh pakai clock, tapi preset
staging HARUS deterministik: render N step tetap lalu screenshot.

## 2. engine.js — `SB.engine`

- `init(o)` — renderer (antialias, shadowMap 1024, sRGB), scene, fog,
  kamera PerspectiveCamera(62), lampu (hemi + directional sun + ambient
  malam), langit (lihat §5), `city.build()` lalu `setPreset(o.scene)`.
  Dipanggil sekali oleh `bootFromQuery()`.
- `bootFromQuery()` — baca `location.search`: `?scene=` (cover|onfoot|
  mission|map|night|title, default `cover`), `?heat=0..5`, `?tod=`,
  `?seed=`. Lalu `init()` + loop `requestAnimationFrame` (step 1/60 +
  render). Untuk screenshot B5: `?shot=1` → render 90 step tetap lalu
  `window.__ready=1` (JANGAN loop animasi setelah itu).
- `setPreset(n,o)` — atur `state.scene/heat/tod`, posisi kamera + pemain +
  kendaraan staging, panggil `sky.set(tod)`, spawn traffic/peds sesuai
  preset (lihat §4). Idempotent: boleh dipanggil ulang.
- `step(dt)` — `state.t+=dt`; `city.update(dt)`; `fx.update(dt)`;
  `cam.update(dt)`; awan hanyut (deterministik dari `state.t`).
- `render()` — `renderer.render(scene,camera)` saja.
- `resize()` — ikut ukuran window (dipanggil main.js + listener resize).
- `cam.mode`: `chase` (di belakang mobil pemain), `foot` (di belakang
  pejalan kaki), `aerial` (map, dari atas), `fixed` (title/cover statis,
  posisi dari preset). `cam.update` TIDAK PERNAH mengubah posisi bila
  mode `fixed`. B2 (player/vehicles) boleh set `cam.mode` + `player.car`.

## 3. city.js — `SB.city`

- `build()` — bangun SEMUA geometri kota sekali (dipanggil `engine.init`).
  Isi `SB.city.*`. Kota 560×560, grid jalan tiap 40 unit, pantai barat
  (x<-190 pasir + laut x<-260), marina tenggara, downtown menara di timur.
- `districts[]` — 9 distrik `{name,x,z,w,d}`: Coral Strand, Neon Mile,
  Palmetto Heights, Deco Row, Downtown, Old Mercado, Keystone Field,
  Pelican Marina, Bayline Docks. Label peta B4 pakai `x,z,w,d` ini —
  JANGAN hardcode posisi lain.
- `roads[]` — `{x0,z0,x1,z1,axis:'x'|'z'}`. Traffic + pathing B2 pakai ini.
- `lm` (landmark) — `{bank:{x,z},hospital,police,hotel,garage,marina}` +
  `signs` berisi mesh papan nama (canvas texture). Bank = "Solmar National
  Bank", police = "Solmar PD HQ". Sign TIDAK BOLEH terpotong di preset
  mission — kamera preset sudah di-frame untuk itu.
- `makeCar(color,type)` → `THREE.Group` + `userData:{type,speed:0,heading:0,
  kind:'traffic'|'player'|'police'}`. Bodi + kabin + 4 roda + 2 lampu
  depan (emissive) + lampu rem. B2 vehicles.js PAKAI factory ini untuk
  mobil pemain & traffic baru; JANGAN bikin builder mobil kedua.
- `makeHeli()` → Group heli + cone spotlight (additive, transparan).
  Mesh + cone saja; PERILAKU heli (gerak, kejar, search zone) milik
  police.js (B2). Preset cover memakai `makeHeli()` statis bila police.js
  belum wire heli-nya.
- `makePed(shirt)` → Group pejalan kaki (badan + kepala + topi opsional).
- `spawnTraffic(n)` / `spawnPeds(n)` — isi `traffic[]`/`peds[]` dari RNG,
  di jalan/trotoar acak. `clearCrowd()` hapus keduanya (preset ganti).
- `update(dt)` — traffic jalan di grid (belok di persimpangan, hindari
  ujung dunia), peds jalan di trotoar (arah acak, lari bila `state.heat>=3`
  dan dekat pemain), lampu depan menyala bila `tod=='night'`.
- `addNeon(x,y,z,w,h,color,text)` — papan neon emissive + glow sprite.
  Dipakai city sendiri; B2/B4 boleh tambah (budget mesh: total scene
  <1200 mesh — cek `renderer.info.render.calls`).

## 4. Preset staging `?scene=` (yang dilihat judge)

| preset | tod | heat | isi frame (WAJIB) |
|---|---|---|---|
| cover | sunset | 4 | mobil pemain jalan (speed>0) di Neon Mile, heli + cone BESAR, 2–3 cruiser + traffic + peds, palm + neon foreground, sun disc kiri |
| onfoot | night | 3 | pemain jalan kaki di Old Mercado, foot cops dekat, peds lari, stalls + neon, muzzle flash via `fx.flash` |
| mission | sunset | 3 | mobil jalan ke bank, traffic di depan, heli cone terlihat, sign bank UTUH |
| map | sunset | 0 | kamera aerial tegak lurus, SELURUH kota + pantai dalam frame (untuk overlay peta B4) |
| night | night | 2 | street-level Downtown, neon + billboard + headlight glow |
| title | sunset | 0 | wide skyline + beach + sun disc, kamera fixed rendah |

Preset HANYA staging (posisi + spawn + tod). HUD/dialog/misi milik B3/B4,
JANGAN diotak-atik engine/city untuk HUD. B5 screenshot: `?scene=X&shot=1`.

## 5. Langit & lighting (pembeda v4 — JANGAN disederhanakan)

- Langit = sphere besar + ShaderMaterial gradasi 3 warna (zenit–tengah–
  horizon) + sun disc (circle emissive, posisi `sky.sun`) + ~14 awan
  (plane, canvas texture lembut, drift `state.t`). `sky.set(tod)` ganti
  palet + intensitas lampu + fog color: sunset (ungu–oranye, sun rendah
  barat), night (biru gelap, bulan + bintang Points, neon dominan),
  day (biru cerah, sun tinggi).
- Fog `THREE.Fog` warna = horizon, near 180 far 520 (kota tetap terbaca).
- Sun directional: sunset `#ffb36b` 1.6 dari barat-rendah; night: bulan
  `#7a8fd0` 0.5; shadow map 1024, kamera ortho ±160 di sekitar fokus.
- Headlight glow: sprite additive di tiap lampu depan (nyala malam /
  selalu di preset cover). Muzzle flash: `fx.flash` = sprite + PointLight
  0,12 dtk lalu mati (B2 panggil tiap tembakan). Preset onfoot memakai
  sprite khusus `SB._mz` (denyut tiap 45 step, posisi = pemain + forward*8)
  — B2 boleh pindah/atur ulang mengikuti pemain.

## 6. Yang dimiliki modul lain (B2–B4 baca ini, JANGAN tulis ulang)

- player.js — gerak jalan kaki, masuk/curi mobil (`SB.player.car`,
  `inCar`), pakai `city.roads` untuk batas jalan. Set `SB.player.mesh`.
- vehicles.js — handling mobil pemain + tabrakan ringan + kondisi mobil
  (`car.userData.cond`, `dented`), pakai `city.makeCar`.
- police.js — cruiser AI + foot cop + heli AIR-1 (`makeHeli` + cone),
  wanted `SB.state.heat`, response list. Heli WAJIB terlihat di cover.
- missions.js — 8 misi + objektif + payout, pakai `city.lm` + `districts`.
- dialog.js — dialog + potret (assets), posisi dialog JANGAN menimpa
  weapon wheel (wheel di kanan-bawah, dialog kiri-bawah).
- hud.js — HUD + minimap bundar + health/armor + crew + timer + REP.
- radio.js / audio.js — WebAudio, 3 stasiun. map.js — peta penuh (pakai
  `city.districts` + `city.lm`, kamera `aerial` untuk backdrop).
- shops.js / save.js — toko/safehouse/respray/save (localStorage).

## 7. Jebakan (dibayar mahal di v3)

- `three.min.js` lokal di `vendor/` — JANGAN CDN, JANGAN import bare
  `three`. Classic script, `window.THREE`.
- `file://` + WebGL: renderer butuh swiftshader di headless; JANGAN
  `localhost` untuk screenshot (proxy memblokir).
- CanvasTexture teks: gambar teks SEKALI di build, jangan per frame.
- Jangan tambah mesh per frame; `fx` pakai pool sprite (max 24).
- Total engine+city+API ≤62.000 B. B5 ukur ulang sebelum commit.
