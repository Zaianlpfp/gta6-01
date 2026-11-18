# Solmar Bay — Make GTA 6 (gta6-01)

A complete, original, open-world crime game that runs offline in a desktop
browser from static files. Built with Three.js (vendored locally) and plain
JavaScript — no build step, no network requests, no assets from any
commercial game.

## The city

Solmar Bay is a sun-soaked coastal city, 3200 × 2400 m: a downtown of neon
towers, Coral Strand beach with palms and a ferris wheel, Pelican Marina with
moored boats, Old Mercado market streets, Palmetto Heights, Deco Row and the
Bayline Docks. Traffic cruises the road grid, pedestrians stroll the
sidewalks, and the sun sets into a pink-orange dusk before the neon takes
over the night.

## What is in the game

- **On foot and by car** — walk, run, steal any car (E), arcade driving with
  handbrake drifts, named vehicles with condition % and gears.
- **Wanted system 0–5 stars** — SBPD cruisers chase and ram, foot cops arrest
  or shoot at 3+ stars, and the AIR-1 helicopter with a spotlight and search
  zone hunts you at 4–5 stars. Hide to cool the heat; get busted or wasted
  and you wake up at St. Coral Hospital, lighter in the wallet.
- **8 story jobs** from Mara Solis and Dante Voss — First Fare, The Package,
  Hot Wheels, Heat, Night Run, Chop Shop, Harbor Lights, The Big Score — each
  with dialog (portraits drawn for this game), a GPS beacon, timers and a
  payout. Pick jobs from the full city map (M).
- **Combat** — fists, P9 pistol, Wasp SMG and Boomstick shotgun, with a weapon
  wheel, per-weapon ammo, tracers, muzzle flash and hit markers. Shoot from
  foot or from the driver's seat.
- **Side work** — taxi fares, 20 hidden sun coins ($50 each), a gun store
  (armor + ammo), a respray shop (new paint drops a wanted star), and a
  safehouse that saves the game.
- **Progression** — REP with rank titles (Street Kid → Solmar Legend), cash,
  and a save system (autosave after every job, manual save, safehouse save).
- **HUD** — mission panel, SBPD response list with named units, wanted stars,
  cash, day + clock, round minimap with a search-zone ring, health/armor/REP
  bars, weapon wheel, speedometer with gear, and a radio widget.
- **Radio** — three named stations (WAVE 88.1 Neon Drive, SOL 101.9 Sunset
  FM, BAY 96.5 Turbo), each with its own track, tempo and live-sequenced
  bassline. Q switches station. Engine hum, sirens, gunshots and pickups are
  all synthesized live with WebAudio.
- **Day cycle** — the clock runs (FRI 17:24 onward), the light shifts from
  golden afternoon through sunset to night, and the neon comes alive.

## Play

Open `game/index.html` in desktop Chrome (or `node serve.ts` and visit
http://localhost:8080). **WASD** move/drive, **SHIFT** run, **SPACE**
handbrake, **E** enter car / interact, **mouse** aim, **click** shoot,
**1–4** weapons, **R** reload, **Q** radio, **M** city map, **P** pause.

Screenshot presets for the makers: `?scene=cover` (sunset chase),
`?scene=street` (night firefight), `?scene=map` (city map),
`?scene=beach` (beach taxi fare).

## Structure

| File | Job |
|---|---|
| `game/index.html` | Page + HUD DOM + script order |
| `game/css/style.css` | All HUD styling |
| `game/js/config.js` | World, districts, vehicles, weapons, radio, missions, REP |
| `game/js/util.js` | Math, formatting, seeded RNG, canvas textures |
| `game/js/audio.js` | Procedural WebAudio: engine, siren, shots, 3 radio stations |
| `game/js/city.js` | The 3D city: roads, towers, beach, marina, palms, neon |
| `game/js/vehicles.js` | Car factory, player driving, traffic AI |
| `game/js/peds.js` | Pedestrians + taxi fares |
| `game/js/police.js` | Wanted system, cruisers, foot cops, AIR-1 helicopter |
| `game/js/particles.js` | Muzzle flash, exhaust, sparks, skid marks |
| `game/js/combat.js` | Four weapons, aiming, tracers, damage |
| `game/js/missions.js` | 8-job story engine, dialog, GPS, taxi side work |
| `game/js/player.js` | On-foot control, stealing, shops, busted/wasted |
| `game/js/input.js` | Keyboard + mouse |
| `game/js/save.js` | localStorage save / load |
| `game/js/hud.js` | HUD, minimap, full map, shop, menus |
| `game/js/scenes.js` | `?scene=` screenshot staging |
| `game/js/main.js` | Boot, frame loop, chase camera, day/night cycle |
| `game/vendor/three.min.js` | Three.js r149, vendored (not our source) |
| `game/assets/mara.jpg`, `game/assets/dante.jpg` | Character portraits, generated for this game |

## Hand in

`main.ts` (Node 22) copies `game/` and `screenshots/` to the output
directory and writes `dossier.json` with the kit's `vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see `LICENSE`.
