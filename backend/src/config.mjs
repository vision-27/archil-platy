import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export async function loadConfig() {
  let local = {};
  try { local = parseEnv(await readFile(new URL('../../.env', import.meta.url), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('Could not read root .env.'); }
  const env = { ...local, ...process.env };
  const port = Number(env.PORT || 4310);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be between 1024 and 65535.');
  return { port, model: env.CODEX_MODEL || 'gpt-6.1-sol', directory: env.PLATY_DATA_DIR ? resolve(env.PLATY_DATA_DIR) : fileURLToPath(new URL('../.data', import.meta.url)),
    archil: { apiKey: env.ARCHIL_API_KEY || '', diskId: env.ARCHIL_COMPANY_DISK_ID || undefined, region: env.ARCHIL_REGION || 'aws-us-west-2', networkMode: env.ARCHIL_NETWORK_MODE || 'deny-all' } };
}
