import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = process.env.PLATY_API_URL || 'http://127.0.0.1:4310';
const runner = process.argv[2] || 'local';
async function call(path, body) {
  const response = await fetch(base + path, { ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Platy-Demo': '1' }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15_000) });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${payload.error?.message}`);
  return payload;
}
async function experiment(workflowId) {
  let { run } = await call('/api/runs', { workflowId, runner, requestKey: randomUUID() });
  const deadline = Date.now() + 240_000;
  while (['queued', 'preparing', 'running'].includes(run.status)) {
    if (Date.now() > deadline) throw new Error(`Run ${run.id} still pending; inspect it instead of blindly rerunning.`);
    await new Promise(resolve => setTimeout(resolve, 500));
    ({ run } = await call(`/api/runs/${run.id}`));
  }
  if (run.status !== 'completed') throw new Error(`${run.id}: ${run.error?.message}`);
  console.log(JSON.stringify({ workflowId, runId: run.id, runner: run.runner, sandboxId: run.sandboxId, summary: run.result.summary, artifacts: run.artifacts.map(item => item.name) }));
  return run;
}
const first = await experiment('access-v1');
assert.deepEqual(first.result.scenarios.filter(row => !row.passed).map(row => row.id), ['customer-on-hold']);
const corrected = await experiment('access-v2');
assert.equal(corrected.result.summary.failed, 0);
const { run } = await call(`/api/runs/${corrected.id}/approval`, { decision: 'approve', workflowHash: corrected.workflowHash, resultHash: corrected.resultHash });
assert.equal(run.approval.simulated, true);
assert.equal(run.approval.deployed, false);
console.log('Rehearsal passed: failing hold case, corrected passing suite, exact-version simulated approval.');
