# Solmar Bay — a GTA-style 3D open world

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Zaianlpfp/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Zaianlpfp/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar Bay** is a sun-soaked 3D open-world crime game built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01): steal cars, outrun
the Solmar PD, climb from STREET KID to SOLMAR KING, and pull off The Big Score.

## Play it

Open `game/index.html` in a desktop browser — no build step, no network, no
install. Everything, Three.js r149 included, is vendored locally under `game/`.
Or serve it: `node serve.ts`, then open http://127.0.0.1:8080.

## The city

Nine districts — Downtown, Neon Mile, Old Mercado, Coral Strand, Deco Row,
Palmetto Heights, Keystone Field, Pelican Marina, Bayline Docks — on a grid of
avenues and streets, with a beach and marina, sunset lighting, neon signs,
palms, traffic and pedestrians. Landmarks: Solmar National Bank, Solmar PD HQ,
the hospital, Jax's Garage, Neon Respray and Mara's Safehouse.

## What you do

- **8 story missions** with payouts from $500 (First Fare) to $5,000 (The Big
  Score), plus side jobs: taxi fares, street races, the Mercado Standoff,
  Sunset Tapes and Sun Coins.
- **Drive anything**: steal a VENTO STRADA, a SOLMAR GT or a cab, with a chase
  camera, gears, damage and DENTED status.
- **Wanted 0–5 stars**: foot cops, cruisers, roadblocks and the AIR-1 heli
  GULL-1 with its spotlight cone and search zone.
- **Combat**: fists, pistol, SMG, shotgun (rifle locked) with a weapon wheel,
  muzzle flash and tracers, on foot or from a car.
- **Systems**: REP ranks, cash, health + armor, radio (WAVE 88.1, SOL 101.9,
  BAY 96.5), a full-screen map with jobs and legend, weapon and armor shops,
  respray that drops a wanted star, safehouse saves and localStorage saves.

## Controls

Your crew: Mara Solis the fixer, Jax the mechanic and Lucia Ortega the
getaway driver — each with a portrait and dialogue that briefs every job.

WASD drive / walk · Shift run or nitro · Space handbrake · E enter / exit car ·
F or click shoot · 1–4 weapons · Q / R radio · M map · P pause · Esc close.

## Screenshots

Staged shots: `?scene=cover` chase · `?scene=onfoot` street fight ·
`?scene=mission` the bank job · `?scene=map` full city map. The four shots
live in `screenshots/`, the first by name is the cover.

## Tech

Three.js r149 (vendored, `game/vendor/three.min.js`), plain classic scripts,
a deterministic seeded world (seed 1337, override with `?seed=N`), zero
network requests, zero console errors. Build the judge dossier with
`node main.ts` — it copies `game/` and `screenshots/` to `/output` and writes
`/output/dossier.json` (source text capped at 160 KiB).
