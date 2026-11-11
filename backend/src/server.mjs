import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { HttpError, requireValue } from './errors.mjs';
import { LabService } from './service.mjs';
import { loadConfig } from './config.mjs';
import { CompanyService } from './company-service.mjs';

const isLoopback = host => host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
function checkRequest(req) {
  let host;
  try { host = new URL(`http://${req.headers.host}`).hostname; } catch { throw new HttpError(403, 'invalid_host', 'Loopback host required.'); }
  requireValue(isLoopback(host), 403, 'invalid_host', 'Loopback host required.');
  // Allows a local frontend dev server proxy while rejecting remote origins and DNS rebinding.
  if (req.headers.origin) {
    let origin;
    try { origin = new URL(req.headers.origin); } catch { throw new HttpError(403, 'invalid_origin', 'Local browser origin required.'); }
    requireValue(origin.protocol === 'http:' && isLoopback(origin.hostname), 403, 'invalid_origin', 'Local browser origin required.');
  }
  requireValue(req.headers['sec-fetch-site'] !== 'cross-site', 403, 'cross_site', 'Cross-site requests are not allowed.');
  if (req.method === 'POST') {
    requireValue(req.headers['x-platy-demo'] === '1', 403, 'missing_demo_header', 'Send X-Platy-Demo: 1.');
    requireValue((req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase() === 'application/json', 415, 'json_required', 'Use application/json.');
  }
}
async function readJSON(req) {
  let length = 0; const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    requireValue(length <= 16_384, 413, 'body_too_large', 'Request body limit is 16 KiB.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, 'invalid_json', 'Malformed JSON.'); }
}
export function createApp(service, company) {
  return createServer(async (req, res) => {
    const send = (status, payload) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" });
      res.end(JSON.stringify(payload));
    };
    try {
      checkRequest(req);
      const url = new URL(req.url, 'http://127.0.0.1');
      const path = url.pathname;
      if (req.method === 'GET' && path === '/health') return send(200, { status: 'ok', service: 'platypus-workflow-lab', localOnly: true });
      if (company && path === '/api/company' && req.method === 'GET') return send(200, company.workspace());
      const operation = /^\/api\/company\/(discover|build-all|build|evolve|run)$/.exec(path);
      if (company && operation && req.method === 'POST') return send(202, company.start(operation[1], await readJSON(req)));
      const jobMatch = /^\/api\/company\/jobs\/([a-f0-9-]{36})$/.exec(path);
      if (company && jobMatch && req.method === 'GET') return send(200, { job: company.job(jobMatch[1]) });
      const versionMatch = /^\/api\/company\/versions\/([a-f0-9-]{36})(?:\/(preview|approve))?$/.exec(path);
      if (company && versionMatch) {
        const [, id, action] = versionMatch;
        if (req.method === 'GET' && !action) return send(200, { version: company.version(id) });
        if (req.method === 'POST' && action === 'approve') return send(200, { version: await company.approve(id, await readJSON(req)) });
        if (req.method === 'GET' && action === 'preview') {
          const html = await company.preview(id);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'; sandbox allow-scripts" });
          return res.end(html);
        }
      }
      if (req.method === 'GET' && path === '/api/catalog') return send(200, await service.catalog());
      if (req.method === 'GET' && path === '/api/runs') return send(200, { runs: service.list() });
      if (req.method === 'POST' && path === '/api/runs') {
        const result = await service.start(await readJSON(req));
        return send(result.reused ? 200 : 202, result);
      }
      const match = /^\/api\/runs\/([a-f0-9-]{36})(?:\/(approval|artifacts)(?:\/([a-z0-9.-]+))?)?$/.exec(path);
      if (match && req.method === 'GET' && !match[2]) return send(200, { run: service.get(match[1]) });
      if (match && req.method === 'POST' && match[2] === 'approval' && !match[3]) return send(200, { run: await service.approve(match[1], await readJSON(req)) });
      if (match && req.method === 'GET' && match[2] === 'artifacts' && match[3]) {
        const content = await service.artifact(match[1], match[3]);
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `inline; filename="${match[3]}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" });
        return res.end(content);
      }
      throw new HttpError(404, 'not_found', 'Route not found.');
    } catch (error) {
      if (!res.headersSent) send(error instanceof HttpError ? error.status : 500, { error: { code: error instanceof HttpError ? error.code : 'internal_error', message: error instanceof HttpError ? error.message : 'Backend could not complete this request.' } });
      else res.end();
    }
  });
}

export async function main() {
  const config = await loadConfig();
  const service = new LabService(config);
  let company;
  try { company = await CompanyService.create({ store: service.store, config }); }
  catch (error) { await service.close(); throw error; }
  const server = createApp(service, company);
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(config.port, '127.0.0.1', resolve); }); }
  catch (error) { await company.close(); await service.close(); throw error; }
  console.log(`Platypus backend: http://127.0.0.1:${config.port} (synthetic data; simulated approval)`);
  let closing = false;
  const stop = async () => {
    if (closing) return; closing = true;
    server.close();
    await company.close();
    await service.close();
  };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  return { server, service, company };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error('Backend startup failed. Check port, environment settings, and data-directory ownership.'); process.exitCode = 1; });
