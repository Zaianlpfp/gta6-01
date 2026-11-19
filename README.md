# Solmar Bay — GTA-style 3D Open World

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/rank.svg)
![reward](https://make.fun/badge/gta6-01/reward.svg)

A complete open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). It runs offline
in a desktop browser from static files — open `game/index.html`, no build
step, no network request.

## The game

Solmar Bay is a sun-soaked fictional city on the coast: nine named
districts (Coral Strand, Neon Mile, Palmetto Heights, Deco Row, Downtown,
Old Mercado, Keystone Field, Pelican Marina, Bayline Docks), a beach and
marina, downtown towers, neon streets, palms and billboards, at sunset and
at night.

- **Drive and steal cars** — chase camera, traffic, pedestrians, car
  condition and gears, damage and dents.
- **8 story missions** with payouts ($500–$5,000), a timer on the timed
  ones, and a side job (Mercado Standoff) — plus a full city map (M) with
  every job, payout and legend.
- **Wanted 0–5 stars** — foot cops, cruiser pursuits and roadblocks, and
  the GULL-1 helicopter with a spotlight cone and search zone.
- **Combat on foot and from the car** — 4 weapons (fists, pistol, SMG,
  shotgun; rifle locked) with a weapon wheel (1–4), muzzle flash, tracers
  and reload (R).
- **Radio** — 3 stations (WAVE 88.1, SOL 101.9, BAY 96.5), Q to switch.
- **REP and ranks** from STREET KID to LEGEND OF SOLMAR, a 3-person crew
  (driver, mechanic, lookout) with portraits, and dialog with the fixer
  Mara Solis, mechanic Jax and getaway driver Lucia Ortega.
- **Shops and systems** — gun store, respray (lose 1 wanted star),
  safehouse save point, hospital healing, and localStorage saves.
- **HUD** — health and armor bars, minimap with search zone and mission
  marker, mission timer, SBPD response list, clock and day, speed and car
  condition.

## Controls

- **WASD** move / drive, **Shift** run, **E** enter or exit a car,
  **mouse** aim and shoot, **R** reload, **1–4** weapons, **Q** radio,
  **M** map, **F** shop, **Esc** close.

## Play it

```sh
node serve.ts   # then open http://localhost:8080
```

or open `game/index.html` directly. Screenshots: `screenshots/`
(cover first). Entry built with the make.fun kit — see `main.ts`.
