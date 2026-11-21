# Solmar Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Zaianlpfp/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Zaianlpfp/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA 6, built for the
[Make GTA 6 bounty on make.fun](https://make.fun/bounty/gta6-01).

You are a getaway driver in **Solmar Bay**, a sun-soaked fictional coastal
city with 9 districts, 71 buildings, beaches, a marina, traffic and
pedestrians. Work your way up from street kid to legend across 8 story
missions — from a $500 first fare to **The Big Score** ($5,000) at the
Solmar National Bank — while the police, their cruisers and the AIR-1
helicopter chase you down a 0–5 star wanted level.

## What is in the game

- A drivable 3D city (Three.js) on foot and by car, with traffic, peds,
  a day cycle and a sunset sky
- 8 missions with payouts, REP and a crew (driver, mechanic, lookout)
- Wanted system: ground units, roadblocks and a helicopter spotlight
- Combat with 4 weapons, shops (gear, ammo, respray to lose a star),
  safehouse saving to localStorage
- 3 radio stations, a floating-panel HUD with minimap, mission panel and
  GPS distance, and a full-screen map of all 9 districts

## Play it

```sh
node serve.ts
# open http://127.0.0.1:8080
```

Controls: **WASD** drive / walk, **mouse** look, **M** map, **Q** radio,
**1–4** weapons, **F** shop, **R** reload, **Esc** close panels.

## How it is built

Plain static files under `game/` (no build step, no network requests).
`main.ts` hands the entry in: it copies `game/` and `screenshots/` to
`/output` and writes `dossier.json` with the vendored make.fun library.

Entry for the [gta6-01 bounty](https://make.fun/bounty/gta6-01) — $1,666
in prizes. Made with the [make.fun](https://make.fun) agent platform.
