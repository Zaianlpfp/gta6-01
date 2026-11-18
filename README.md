# Solmar Bay — Open-World Crime in 3D

[![make.fun bounty](https://img.shields.io/badge/make.fun-bounty-gta6--01-ff2a7a)](https://make.fun/bounty/gta6-01)
[![Solmar Bay](https://img.shields.io/badge/game-Solmar%20Bay%203D-ff8c42)](https://github.com/Zaianlpfp/gta6-01)
[![Three.js](https://img.shields.io/badge/engine-Three.js%20r149-2ad4ff)](https://github.com/Zaianlpfp/gta6-01)

**Solmar Bay** is a 3D open-world crime game for make.fun's
[gta6-01 "Make GTA 6" bounty](https://make.fun/bounty/gta6-01) — a sun-soaked
coastal city you explore on foot and by car, with traffic and pedestrians,
a wanted level the Solmar PD actually answers, and an 8-job story.

You are a newcomer in Solmar Bay. Mara Solis, the fixer, has work for you:
taxi fares, a package run, a stolen VENTO STRADA, a midnight race down Neon
Mile, a chop-shop delivery, a harbor meet, a four-star heat run, and finally
**THE BIG SCORE** — Solmar National Bank. Earn cash and REP, climb from
STREET KID to SOLMAR KING, and don't get caught.

## How to play

Open `game/index.html` in desktop Chrome (or run `node serve.ts` and open
http://localhost:8080). No build step, no network request — everything is
local, Three.js included.

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive (Shift = run / nitro) |
| E | Enter or steal a car / exit a car |
| Mouse + click / F | Aim and shoot |
| 1–5 | Switch weapon (fists, pistol, SMG, shotgun, rifle) |
| R | Reload |
| Space | Handbrake |
| Q / R | Switch radio station (Q next, R previous) |
| M | Full-city map (jobs, legend, GPS) |
| P / Esc | Pause |

## Features

- **A city to explore** — 9 named districts (Downtown, Coral Strand,
  Pelican Marina, Old Mercado, Neon Mile, Palmetto Heights, Deco Row,
  Bayline Docks, Keystone Field), beach, marina, park, and named landmarks
  (Solmar National Bank, St. Coral Hospital, Solmar PD HQ, Hotel Palmera,
  Jax's Garage, Mara's Safehouse, CLUB VOLTAGE).
- **8 story jobs with payouts** ($500–$5,000) plus side work: taxi fares,
  street races, the MERCADO STANDOFF, 20 Sun Coins and 20 Sunset Tapes.
- **Wanted 0–5 stars** — cruisers that chase and ram, foot cops, roadblocks,
  and the GULL-1 police helicopter with a spotlight and search zone.
  Busted or wasted? You wake up at St. Coral Hospital, 10% lighter.
- **6 original cars to steal and drive** (VENTO STRADA, SOLMAR GT, PALMERA
  LX, SOLMAR CAB, BAYLINE HAULER, MERCADO VAN), each with a name,
  condition %, and gears G1–G5.
- **Combat** — 5 weapons with ammo and a weapon wheel, muzzle flash,
  and a standoff side job to clear out.
- **Characters with portraits and dialog** — Mara Solis, Jax, and Lucía
  Ortega open every job with a line.
- **3 named radio stations** — WAVE 88.1 (sunset synth), RADIO SOL 101.9
  (latin pop), FLAMINGO FM 88.1 (funk/disco), each with its own tracks and
  procedural WebAudio music, plus engine hum and sirens.
- **HUD with circular minimap** — cash, health, armor, wanted stars,
  REP bar and rank, clock (FRI 17:24 → days pass as you play), mission
  panel, Solmar PD response list, speedometer, weapon wheel, radio widget.
- **Shops, respray, safehouse** — buy ammo and armor, eat to heal, respray
  your car to lose a star, save at Mara's Safehouse.
- **Save system** — autosave after every completed job, manual save at the
  safehouse (localStorage).
- **Day / sunset / night lighting** with neon, shadows, and a drifting sky.

## Screenshots

`1-cover-chase.jpg` is the cover: a sunset chase with the helicopter,
wanted 4, the response list, a mission, the radio, and a dialog in one
frame. Then on-foot, the Big Score, and the full-city map.

## Tech

- Three.js r149 (vendored as `game/vendor/three.min.js`), classic
  `<script>` tags, no modules, no bundler, no CDN.
- Deterministic world (seeded RNG, default seed 1337; `?seed=N` overrides).
- Staging presets for screenshots: `game/index.html?scene=cover`,
  `?scene=onfoot`, `?scene=mission`, `?scene=map`, `?scene=night`,
  `?scene=title`.
- Source split by job: `engine` (loop/camera/RNG), `city` (world/traffic/
  peds), `player` + `vehicles` (on-foot/driving/combat), `police`
  (wanted/heli), `missions` + `dialog` (story), `hud` + `radio` + `map` +
  `shops` + `audio` + `save` (presentation), `main` (bootstrap).

## License

MIT — see [LICENSE](LICENSE).
