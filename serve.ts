// Solmar Bay — gta6-01 rebuild r13. Tiny static server for local playtesting.
// Serves game/ on http://127.0.0.1:8080 (or --port <n>). Node 22, stdlib only.
// It only ever serves files inside game/ and sends the MIME types a browser
// game needs. Development convenience, not a production web server.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameRoot = resolve(fileURLToPath(new URL('./game', import.meta.url)));

function pickPort(): number {
  const at = process.argv.indexOf('--port');
  const want = at === -1 ? 8080 : Number(process.argv[at + 1]);
  return Number.isInteger(want) && want > 0 && want < 65536 ? want : 8080;
}

function mimeFor(file: string): string {
  const table: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.bin': 'application/octet-stream',
    '.wasm': 'application/wasm',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.txt': 'text/plain; charset=utf-8',
  };
  return table[extname(file).toLowerCase()] ?? 'application/octet-stream';
}

function safePath(pathname: string): string | null {
  let clean = pathname;
  if (clean.endsWith('/')) clean += 'index.html';
  const file = resolve(join(gameRoot, normalize(clean)));
  if (file !== gameRoot && !file.startsWith(gameRoot + sep)) return null;
  return file;
}

const port = pickPort();
createServer((request, response) => {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
  } catch {
    response.writeHead(400).end('bad request');
    return;
  }
  const file = safePath(pathname);
  if (file === null) {
    response.writeHead(403).end('forbidden');
    return;
  }
  let size: number;
  try {
    const stats = statSync(file);
    if (!stats.isFile()) throw new Error('not a file');
    size = stats.size;
  } catch {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, {
    'content-type': mimeFor(file),
    'content-length': size,
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`Solmar Bay game/ is on http://127.0.0.1:${port}`);
});
