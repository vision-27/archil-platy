// Development-only bridge harness. This is not the product frontend.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('./preview-check.html', import.meta.url));
createServer(async (req, res) => {
  try {
    if (!['127.0.0.1:4311','localhost:4311'].includes(req.headers.host)) { res.writeHead(403); return res.end(); }
    if (req.url === '/' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(html); }
    if (!req.url.startsWith('/api/')) { res.writeHead(404); return res.end(); }
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 16384) throw new Error('Body too large'); chunks.push(chunk); }
    const response = await fetch(`http://127.0.0.1:4310${req.url}`, { method: req.method, headers: { 'Content-Type': 'application/json', 'X-Platy-Demo': req.headers['x-platy-demo'] || '', ...(req.headers.origin ? { Origin: req.headers.origin } : {}) }, ...(req.method === 'POST' ? { body: Buffer.concat(chunks) } : {}) });
    res.writeHead(response.status, Object.fromEntries(['content-type','content-security-policy','cache-control','x-content-type-options','referrer-policy'].map(name => [name, response.headers.get(name)]).filter(([,value]) => value)));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(502); res.end('Preview harness proxy failed.'); }
}).listen(4311, '127.0.0.1', () => console.log('Development preview bridge: http://127.0.0.1:4311'));
