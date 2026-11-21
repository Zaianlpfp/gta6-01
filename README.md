# Solmar Bay — Make GTA 6 (gta6-01)

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Zaianlpfp/gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Zaianlpfp/gta6-01/reward.svg)](https://make.fun/c/gta6-01)

**Solmar Bay** is an original open-world crime game in the spirit of GTA 6,
built for the [gta6-01 competition on make.fun](https://make.fun/c/gta6-01).
Explore a sun-soaked fictional coastal city — 9 districts, 71 buildings,
a beach and a marina — on foot and by car, outrun the police, run 8 story
missions with Mara, Jax and Lucia, and build your crew's reputation from
ROOKIE to KINGPIN.

Everything here is original: the city, characters, vehicles, names, story,
art, sounds and music. Nothing is taken from Rockstar Games' Grand Theft
Auto series or any other commercial game.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

The game is plain static files under `game/` — no build step, no network
request. Open `game/index.html` in desktop Chrome (served by any static
HTTP server) and play with keyboard and mouse.

## How to play

| Key | Action |
|-----|--------|
| WASD | Move / drive (W forward, S brake/reverse, A/D steer) |
| Shift | Run |
| Space | Jump / handbrake |
| E | Enter / exit vehicle |
| F | Shoot |
| M | Full map |
| R | Next radio station |
| P | Pause |
| 1–8 | Start a mission |
| Enter | Start (from the title screen) |

- **Wanted level:** 0–5 stars. At 3+ stars a police helicopter joins the
  chase. Get busted and you wake up back in the city, $50 lighter.
- **Missions:** 8 missions, from *First Fare* ($500) to *The Big Score*
  ($5,000). Follow the red diamond marker and the GPS readout on the HUD.
- **Radio:** 3 stations — SOLMAR FM (pop), NEON 88 (synth), PALMA TALK.
- **Shops:** buy body armor, respray your Flamingo GT, or rest at a
  safehouse to heal and save. Progress autosaves to your browser.

## Presets (screenshots / testing)

Append a query to the URL: `?preset=cover` (title shot), `?preset=onfoot`,
`?preset=mission` (add `&mission=8` for The Big Score), `?preset=map`,
`?preset=free`. `?shot=cover` renders one staged frame and stops.

## Tech

- Three.js (vendored under `game/vendor/`) — the 3D city, traffic, peds,
  police helicopter and effects.
- Deterministic simulation: one seeded RNG (`mulberry32`, seed 1337),
  `SB.state.simTime` as the only simulation clock. No built-in randomness
  or wall-clock calls anywhere in the game code.
- Synthesized WebAudio sound (engine, siren, gunshots, cash) and radio —
  no external audio files.
- Entry point: `game/main.js`; hand-in program: `main.ts` (Node 22).

## License

MIT — see [LICENSE](LICENSE).
