// Solmar Bay — the entry program for make.fun's gta6-01 bounty.
// It copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with buildDossier from the
// kit's vendor/makefun-game.ts (unchanged). Outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output. Node 22 standard library only.
// (Continuation, r2: the driving-position sync in game/js/main.js was
// verified in headless Chrome and the four screenshots below were
// re-taken from the fixed game; this program itself is unchanged.)
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// main.ts sits at the repository root, so its own directory IS the repo
// root. (An earlier draft went one level too high with a double dirname
// and failed with ENOENT on game/ — fixed in the r2 continuation, 18 Nov.)
const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log('Solmar Bay handed in: game/ + screenshots/ + dossier.json in ' + outDir);
