// Serves game/ on http://localhost:8080 so Solmar Bay can be played in
// desktop Chrome. Node 22 standard library only; no dependencies.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const ROOT = join(import.meta.dirname, 'game');
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
};

const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const path = normalize(join(ROOT, url === '/' ? 'index.html' : url));
  if (!path.startsWith(ROOT) || !existsSync(path)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});

server.listen(8080, () => console.log('Solmar Bay at http://localhost:8080'));
