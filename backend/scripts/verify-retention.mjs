import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Archil } from 'disk';
import { loadConfig } from '../src/config.mjs';

const id = process.argv[2];
assert.match(id ?? '', /^[a-f0-9-]{36}$/, 'Pass a completed Archil run ID.');
const config = await loadConfig();
const response = await fetch(`http://127.0.0.1:${config.port}/api/runs/${id}`, { signal: AbortSignal.timeout(10_000) });
assert.equal(response.status, 200);
const { run } = await response.json();
assert.equal(run.runner, 'archil'); assert.equal(run.status, 'completed'); assert.ok(run.sandboxId);
const client = new Archil({ apiKey: config.archil.apiKey, region: config.archil.region });
const sandbox = await client.sandboxes.get(run.sandboxId);
assert.equal(sandbox.status, 'stopped', 'Retention verification only starts an already-stopped demo sandbox.');
const checked = [];
try {
  await sandbox.start();
  for (const artifact of run.artifacts.filter(item => item.name !== 'output.json')) {
    const digest = createHash('sha256'); let size = 0;
    await sandbox.files.downloadFile(`/workspace/${artifact.name}`, chunk => { size += chunk.length; assert.ok(size <= 2 * 1024 * 1024); digest.update(chunk); });
    assert.equal(digest.digest('hex'), artifact.sha256, `${artifact.name} must survive stop/start unchanged`);
    checked.push(artifact.name);
  }
} finally { await sandbox.stop(); }
console.log(JSON.stringify({ runId: run.id, sandboxId: run.sandboxId, retainedAfterRestart: checked, workflowReexecuted: false, sandboxStatus: 'stopped' }));
