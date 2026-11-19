// Dev-only static server for app/ (Node 22, stdlib only):
//   node serve.ts [--port 8080]
// Serves app/index.html and its files on localhost so the cover maker can
// be tried in desktop Chrome with no build step. Not part of the entry.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./app', import.meta.url)));
const portArg = process.argv.indexOf('--port');
const port = portArg === -1 ? 8080 : Number(process.argv[portArg + 1]) || 8080;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  const file = resolve(join(root, path === '/' ? 'index.html' : `.${path}`));
  if (!file.startsWith(root)) return res.writeHead(403).end('forbidden');
  let size;
  try {
    const st = statSync(file);
    if (!st.isFile()) throw new Error('not a file');
    size = st.size;
  } catch {
    return res.writeHead(404).end('not found');
  }
  res.writeHead(200, {
    'content-type': types[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': size,
  });
  createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`Vice Cover Studio on http://localhost:${port}`));
