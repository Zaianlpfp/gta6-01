// main.ts — Solmar Bay (gta6-01 v4 r14), program penyerah entry (Node 22,
// standard library saja). Menyalin game/ + screenshots/ dari repo ini ke
// /output (atau MAKEFUN_OUTPUT_DIR di luar grader), lalu menulis
// /output/dossier.json dengan buildDossier dari vendor/makefun-game.ts —
// ringkasan yang dibaca juri. Dijalankan dua kali oleh grader; kedua run
// harus menulis byte yang sama. Ditulis FRESH di sesi terekam r14.
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//   node serve.ts   (mainkan game di http://localhost:8080)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Batas gate (reference/gate.json): game/ <= 993 file & 48 MiB, tiap path
// <= 1000 byte; screenshots <= 4 file @ 256 KiB; dossier <= 1,5 MiB dengan
// teks sumber <= 163.840 byte. buildDossier menegakkan batas teksnya sendiri;
// sisanya dicek di sini supaya run yang gagal tidak menulis dossier basi.
const SCREENSHOT_MAX = 4;
const SCREENSHOT_MAX_BYTES = 262144;
const GAME_MAX_FILES = 993;
const GAME_MAX_BYTES = 50331648;

mkdirSync(outDir, { recursive: true });
cpSync(join(here, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: SCREENSHOT_MAX, max_bytes: SCREENSHOT_MAX_BYTES },
    game_max_files: GAME_MAX_FILES,
    game_max_bytes: GAME_MAX_BYTES,
    game_path_max_bytes: 1000,
  }),
);
