import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { request } from 'node:http';
import { bundleFor } from '../src/catalog.mjs';
import { evaluate } from '../execution/harness.mjs';
import { LabService, validateResult } from '../src/service.mjs';
import { ArchilRunner, LocalRunner } from '../src/runners.mjs';
import { createApp } from '../src/server.mjs';
import * as initial from '../workflows/access-v1.mjs';
import * as corrected from '../workflows/access-v2.mjs';

async function setup(t, runners) {
  const directory = await mkdtemp(join(tmpdir(), 'platy-lab-'));
  const service = new LabService({ directory, runners });
  t.after(async () => { await service.close(); await rm(directory, { recursive: true, force: true }); });
  return service;
}
const start = (service, workflowId = 'access-v2', requestKey = randomUUID(), runner = 'local') => service.start({ workflowId, requestKey, runner });

test('independent assertions catch hold violation; corrected version handles duplicates and uncertain writes', async () => {
  const { fixture } = await bundleFor('access-v1');
  const first = await evaluate(initial, fixture);
  assert.deepEqual(first.scenarios.filter(row => !row.passed).map(row => row.id), ['customer-on-hold']);
  const result = await evaluate(corrected, fixture);
  assert.deepEqual(result.summary, { total: 5, passed: 5, failed: 0 });
  const uncertain = result.scenarios.find(row => row.id === 'uncertain-write');
  assert.equal(uncertain.actions.filter(action => action.operation === 'grantAccess').length, 1);
  assert.equal(uncertain.after.events['evt-timeout'], 'outcome_unknown');
  assert.equal(result.scenarios.find(row => row.id === 'customer-on-hold').after.onboarding[0].access, false, 'scenario state resets');
  assert.ok(fixture.context.onboarding.every(row => !row.access), 'source fixture remains unchanged');
});

test('result validation rejects incomplete scenarios, weakened assertions and fabricated summaries', async () => {
  const { fixture } = await bundleFor('access-v2');
  const result = await evaluate(corrected, fixture);
  for (const mutate of [r => r.scenarios.pop(), r => { r.summary.failed = 1; }, r => { r.scenarios[1].assertions[0].expected = 1; }, r => { r.scenarios[0].assertions = []; }]) {
    const malformed = structuredClone(result); mutate(malformed);
    assert.throws(() => validateResult(malformed, fixture), /inconsistent/);
  }
});

test('real local child-process run persists artifacts and exact simulated approval', async t => {
  const service = await setup(t);
  const { run: queued } = await start(service);
  await service.idle();
  const run = service.get(queued.id);
  assert.equal(run.status, 'completed');
  assert.equal(run.result.summary.failed, 0);
  assert.equal(run.safety.networkPolicyVerified, false);
  assert.equal(run.sandboxId, null);
  assert.ok(run.artifacts.some(item => item.name === 'manifest.json'));
  assert.deepEqual(JSON.parse(await service.artifact(run.id, 'result.json')), run.result);
  await assert.rejects(service.approve(run.id, { decision: 'approve', workflowHash: '0'.repeat(64), resultHash: run.resultHash }), /exact/);
  const approved = await service.approve(run.id, { decision: 'approve', workflowHash: run.workflowHash, resultHash: run.resultHash });
  assert.equal(approved.approval.simulated, true); assert.equal(approved.approval.deployed, false);
  const repeated = await service.approve(run.id, { decision: 'approve', workflowHash: run.workflowHash, resultHash: run.resultHash });
  assert.deepEqual(repeated.approval, approved.approval);
});

test('failed assertions are completed experiments but cannot be approved', async t => {
  const service = await setup(t);
  const { run } = await start(service, 'access-v1'); await service.idle();
  const finished = service.get(run.id);
  assert.equal(finished.status, 'completed'); assert.equal(finished.result.summary.failed, 1);
  await assert.rejects(service.approve(run.id, { decision: 'approve', workflowHash: finished.workflowHash, resultHash: finished.resultHash }), /every scenario/);
});

test('idempotent requests reuse the same run and reject key reuse for other inputs', async t => {
  const service = await setup(t);
  const key = randomUUID();
  const first = await start(service, 'access-v2', key);
  const repeat = await start(service, 'access-v2', key);
  assert.equal(first.run.id, repeat.run.id); assert.equal(repeat.reused, true);
  await assert.rejects(start(service, 'access-v1', key), /different run/);
  await assert.rejects(start(service), /current experiment/);
  await service.idle();
  assert.equal((await start(service, 'access-v2', key)).run.id, first.run.id);
});

test('changed or missing artifacts block approval; arbitrary paths are not readable', async t => {
  const service = await setup(t);
  const { run } = await start(service); await service.idle();
  const finished = service.get(run.id);
  await assert.rejects(service.artifact(run.id, '../../.env'), /not found/);
  await writeFile(join(service.runDirectory(run.id), 'workflow.mjs'), 'changed');
  await assert.rejects(service.approve(run.id, { decision: 'approve', workflowHash: finished.workflowHash, resultHash: finished.resultHash }), /recorded hash/);
});

test('one data-directory owner; restart retains evidence and marks unfinished runs interrupted', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'platy-restart-'));
  let service = new LabService({ directory });
  try {
    assert.throws(() => new LabService({ directory }), /Another backend/);
    const { run } = await start(service); await service.idle();
    const saved = service.get(run.id); saved.status = 'running'; saved.sandboxId = 'retained-sandbox'; service.store.save(saved);
    await service.close(); service = new LabService({ directory });
    const recovered = service.get(run.id);
    assert.equal(recovered.status, 'interrupted'); assert.equal(recovered.sandboxId, 'retained-sandbox');
    assert.ok(recovered.artifacts.length > 0);
    assert.equal(service.pending.size, 0);
  } finally { await service.close(); await rm(directory, { recursive: true, force: true }); }
});

test('unconfigured Archil cannot silently execute locally', async t => {
  const service = await setup(t);
  await assert.rejects(start(service, 'access-v2', randomUUID(), 'archil'), /not configured/);
  assert.equal(service.list().length, 0);
});

function fakeArchil(policy, resultText, { stopFails = false } = {}) {
  const calls = [], uploaded = new Map();
  const sandbox = { id: 'test-sandbox', status: 'running', baseImage: 'node:22-bookworm-slim', imageDigest: 'sha256:test',
    getNetwork: async () => policy,
    refresh: async () => sandbox,
    exec: async (command, options) => { calls.push({ command, options }); return { exitCode: 0, stdout: 'ok', stderr: '' }; },
    stop: async () => { calls.push({ stop: true }); if (stopFails) throw Error('stop failed'); sandbox.status = 'stopped'; },
    files: { uploadFile: async (bytes, path) => uploaded.set(path, bytes), downloadFile: async (path, receive) => receive(Buffer.from(resultText)) }
  };
  return { calls, uploaded, client: { sandboxes: { create: async (options, wait) => { calls.push({ create: options, wait }); return sandbox; } } } };
}

test('Archil adapter uses SDK sandbox/files contract, verifies policy, and stops without deleting artifacts', async t => {
  const bundle = await bundleFor('access-v2');
  const mock = fakeArchil({ egress: { default: 'deny', allow: [] } }, JSON.stringify(await evaluate(corrected, bundle.fixture)));
  const service = await setup(t, { local: new LocalRunner(), archil: new ArchilRunner({ client: mock.client }) });
  const { run } = await start(service, 'access-v2', randomUUID(), 'archil'); await service.idle();
  const result = service.get(run.id);
  assert.equal(result.status, 'completed'); assert.equal(result.sandboxId, 'test-sandbox');
  assert.equal(result.runtime.imageDigest, 'sha256:test');
  assert.equal(result.safety.networkPolicyVerified, true); assert.equal(result.sandboxStatus, 'stopped');
  assert.deepEqual(mock.calls[0].create.env, {}); assert.deepEqual(mock.calls[0].create.ports, []);
  assert.equal(mock.calls[0].create.network.egress.default, 'deny');
  assert.ok(mock.uploaded.has('/workspace/workflow.mjs')); assert.ok(mock.uploaded.has('/workspace/manifest.json'));
  assert.ok(mock.calls.some(call => call.stop));
});

test('Archil rejects unexpected policy before executing; cleanup failure remains visible', async t => {
  const mock = fakeArchil({ egress: { default: 'allow' } }, '{}', { stopFails: true });
  const service = await setup(t, { archil: new ArchilRunner({ client: mock.client }) });
  const { run } = await start(service, 'access-v2', randomUUID(), 'archil'); await service.idle();
  const failed = service.get(run.id);
  assert.equal(failed.status, 'failed'); assert.equal(failed.error.code, 'network_policy_unverified');
  assert.equal(mock.uploaded.size, 0); assert.ok(!mock.calls.some(call => call.command));
  assert.equal(failed.sandboxStatus, 'stop_unconfirmed'); assert.ok(failed.cleanupWarning);
});

test('HTTP API rejects unsafe origins, arbitrary workflow code and malformed input; exposes polling/artifacts', async t => {
  const service = await setup(t);
  const server = createApp(service); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body, headers = {}) => fetch(base + '/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Platy-Demo': '1', ...headers }, body: JSON.stringify(body) });
  const input = { workflowId: 'access-v2', runner: 'local', requestKey: randomUUID() };
  assert.equal((await post(input, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await post(input, { 'X-Platy-Demo': '0' })).status, 403);
  assert.equal((await post({ ...input, code: 'arbitrary code' })).status, 400);
  assert.equal((await post({ ...input, workflowId: '../../.env' })).status, 400);
  const badHostStatus = await new Promise((resolve, reject) => { const req = request(base + '/health', { headers: { Host: 'evil.example' } }, response => { response.resume(); resolve(response.statusCode); }); req.on('error', reject); req.end(); });
  assert.equal(badHostStatus, 403);
  const response = await post(input); assert.equal(response.status, 202);
  const { run } = await response.json(); await service.idle();
  const fetched = await (await fetch(base + `/api/runs/${run.id}`)).json(); assert.equal(fetched.run.status, 'completed');
  assert.equal((await fetch(base + fetched.run.artifacts[0].url)).status, 200);
  assert.equal((await post(input)).status, 200);
});
