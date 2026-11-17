# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Zaianlpfp/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Zaianlpfp/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar Bay — A Sun Coast Story.** An original open-world crime game in the spirit of GTA 6, built for make.fun's "Make GTA 6" bounty ($1,666 in USDC). You are Jax Marlowe, a driver-for-hire in Solmar Bay, a sun-soaked coastal city that is entirely invented — its streets, characters, cars, story, art and sounds are all original.

## The game

- **A city to explore** on foot and by car: avenues, streets, a beach, a marina, a downtown of towers, parks and landmarks (bank, hospital, police station, hotel, garage).
- **Traffic and pedestrians** that drive the road grid and walk the sidewalks; pull a driver out of any car and steal it.
- **A wanted system**: 0–5 stars. Stealing, shooting and hitting people raises the heat; police cruisers chase and ram you, foot cops arrest or shoot. Stay out of sight and the heat cools off. Get busted or wasted and you wake up at St. Maria Hospital, poorer.
- **Missions and a story**: five jobs from Mara Solis — a first fare, a package run, stealing a red Comet GT, surviving the heat, and the big score at the Solmar National Bank.
- **Combat**: pistol with mouse aim, on foot or from a car.
- **HUD with a live minimap**, health/armor/cash, wanted stars, speedometer, mission objective and phone messages.
- **Start screen, pause menu, and saving** (autosave on every mission, plus manual save; your cash, progress and sun coins persist).
- **Side work**: pick up $ taxi fares in any car, and find all 20 hidden sun coins ($50 each).
- **Procedural sound**: engine hum, police sirens, gunshots, pickups and a sunset bassline — all synthesized in WebAudio, no audio files.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. Or serve `game/` with any static file server and open `index.html` — the game is plain static files under `game/`, no build step, no network requests.

## Controls

WASD / arrows — walk or drive (Shift to run) · Mouse — aim · Click — shoot · E — enter/steal a car, pick up a fare, crack the vault · Space — handbrake · Esc — pause · M — mute

## Layout

- `game/index.html` + `game/css/style.css` — the page
- `game/js/main.js` — game loop, camera, states, save/load
- `game/js/city.js` — Solmar Bay: roads, blocks, buildings, beach, marina
- `game/js/vehicles.js` — car physics and traffic AI
- `game/js/peds.js` — pedestrians and taxi fares
- `game/js/player.js` — Jax on foot: movement, pistol, stealing cars
- `game/js/police.js` — wanted stars, cruisers, foot cops, busted/wasted
- `game/js/missions.js` — the five story jobs, fares, sun coins
- `game/js/hud.js` — HUD, minimap, menus
- `game/js/audio.js` — procedural WebAudio sound
- `game/js/scenes.js` — `?scene=` presets used to stage the screenshots
- `main.ts` — the make.fun entry program (copies `game/` + `screenshots/`, writes `dossier.json`)

---

<sub>Entered on [make.fun](https://make.fun/?ref=daglog-ai&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
