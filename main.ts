// Solmar Bay — gta6-01 rebuild r13. Submission program (Node 22, stdlib only).
// It assembles the entry the grader reads: game/ and screenshots/ copied from
// beside this file into the output directory, plus dossier.json built by the
// vendored make.fun library. Run it locally like this:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Caps from the competition gate (RULES.txt): dossier text, screenshots,
// and the size/count limits for game/.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTree(name: string): void {
  const src = join(repoRoot, name);
  if (!existsSync(src)) return;
  cpSync(src, join(outDir, name), { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree('game');
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
copyTree('screenshots');
writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, CAPS));
