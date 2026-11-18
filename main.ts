// Solmar Bay — main.ts (Node 22, standard library only)
// The entry program for gta6-01: it hands the game in. It copies this
// repository's game/ and screenshots/ into the output directory and writes
// /output/dossier.json with the vendored make.fun library, exactly as the
// kit's starter does. No network, no build step, no surprises.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fresh output directory, then the game and its screenshots, verbatim.
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The sealed gate's own caps (reference/gate.json): text_max_bytes shapes the
// dossier text; the rest refuse an entry the scorer would refuse — more than
// 4 screenshots or one over 256 KiB, more than 993 files in game/ or 48 MiB
// of game files in all, or a path under game/ over 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Read the dossier back and say what shipped, so a broken build is loud:
// zero screenshots means the judge would see no game at all.
const dossier = JSON.parse(readFileSync(join(out, 'dossier.json'), 'utf8'));
const shots = dossier.images?.length ?? 0;
console.log(
  `Solmar Bay handed in: ${shots} screenshot(s), ` +
    `${dossier.text ? dossier.text.length : 0} dossier text bytes -> ${join(out, 'dossier.json')}`,
);
if (shots === 0) throw new Error('no screenshots in dossier — refusing to hand in a blind entry');
