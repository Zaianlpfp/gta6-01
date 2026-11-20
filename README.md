# Solmar Bay — GTA-style Open World

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Zaianlpfp/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Zaianlpfp/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar Bay** is a complete open-world crime game in the spirit of GTA 6,
built for the [gta6-01 bounty](https://make.fun/bounty/gta6-01) ($1,666 prize
pool). A sun-soaked fictional city on the bay: nine districts, neon avenues,
a beachfront, a marina and a downtown skyline — all playable offline in a
desktop browser, no network requests, no build step.

## Play

Open `game/index.html` directly, or serve it locally:

```sh
node serve.ts   # then open http://localhost:8080
```

Keyboard and mouse. The game saves to localStorage; progress survives a
reload. Screenshots in `screenshots/` are rendered live from the game itself.

## What is in the game

- **A living city** — 9 named districts (Coral Strand, Neon Mile, Palmetto
  Heights, Deco Row, Downtown, Old Mercado, Keystone Field, Pelican Marina,
  Bayline Docks), 66 buildings, neon signs, palms, billboards, traffic and
  pedestrians, sunset and night lighting with sun disc, moon and clouds.
- **Drive and steal cars** — chase camera, gears, damage states, handbrake;
  your pink VENTO STRADA is the hero car. Press E near any car to take it.
- **Wanted system 0–5 stars** — police cruisers, foot cops and the AIR-1
  helicopter (GULL-1) with a visible spotlight cone and a search zone.
- **8 story missions** with named givers and payouts, from First Fare ($500)
  to The Big Score ($5,000), plus a 4-man standoff against boss SALTJACK.
- **Combat** — fists, pistol, SMG, shotgun and a locked rifle, weapon wheel,
  muzzle flash, tracers and damage, on foot and from the car.
- **HUD** — health and armor bars, minimap with mission marker and search
  zone, crew panel, mission timer, radio widget, cash, REP and rank.
- **Radio** — 3 stations (WAVE 88.1, SOLMAR FM 101.5, REBEL 99.9), each with
  its own bassline and tempo, synthesized live with WebAudio.
- **Full map (M)** — all 9 districts, job list with payouts, 9-item legend,
  GPS objective and district labels.
- **Shops and systems** — buy armor and ammo, repair, respray to drop one
  wanted star, safehouse as a save point, REP ranks from STREET KID up.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| E | Enter or steal car |
| Space | Handbrake |
| 1–5 | Weapons (5 = rifle, locked) |
| R | Reload |
| Q | Next radio station |
| F | Shop |
| M | Full map |
| P | Pause |
| Esc | Close |
| Shift | Run |

## Tech

Three.js r149 vendored locally under `game/vendor/` — no CDN, no external
requests. The world is deterministic: one seeded RNG drives every spawn, so
the same staging always renders the same frame. Entry point is
`game/index.html`; `main.ts` builds the submission dossier for make.fun.

## License

MIT. All city, character, vehicle, story, art, sound and music in this repo
is original work made for this bounty.
