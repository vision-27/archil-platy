import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CompanyDisk } from '../src/company-disk.mjs';

async function fixture() {
  const objects = new Map(); const calls = [];
  const disk = { id: 'dsk-test', getObject: async key => { if (!objects.has(key)) throw Object.assign(new Error('missing'), { status: 404 }); return Buffer.from(objects.get(key)); }, putObject: async (key, value) => objects.set(key, value) };
  const client = { disks: { create: async () => ({ disk, token: 'never-persist' }), get: async () => disk }, exec: async opts => { calls.push(opts); return { exitCode: 0, stdout: JSON.stringify({ exitCode: 0, output: { ok: true }, stdout: 'log', stderr: '' }), stderr: '', timing: { totalMs: 1 } }; } };
  const directory = await mkdtemp(join(tmpdir(), 'company-disk-'));
  return { company: new CompanyDisk({ directory, client }), directory, objects, calls, client };
}
test('persistent metadata contains only disk identity and region', async () => {
  const f = await fixture(); await Promise.all([f.company.ensure(), f.company.ensure()]);
  assert.deepEqual(JSON.parse(await readFile(join(f.directory, 'disk.json'))), { id: 'dsk-test', region: 'aws-us-west-2' });
});
test('generated file paths are allowlisted and versions cannot be overwritten', async () => {
  const f = await fixture();
  await assert.rejects(f.company.putFiles('../bad', { 'workflow.py': '' }));
  await assert.rejects(f.company.putFiles('versions/v1', { '../workflow.py': '' }));
  await assert.rejects(f.company.putFiles('versions/v1', { '.env': '' }));
  await f.company.putFiles('versions/v1', { 'workflow.py': 'def run(payload): return payload' });
  await assert.rejects(f.company.putFiles('versions/v1', { 'workflow.py': 'overwrite' }), /immutable/);
  await assert.rejects(f.company.getFile('versions/v1/manifest.json'));
});
test('every execution explicitly denies all egress and scopes persistent mounts', async () => {
  const f = await fixture();
  for (const mode of ['executeVersion', 'testVersion']) await f.company[mode]({ prefix: 'versions/v1', input: { secret: 'fixture' } });
  for (const opts of f.calls) {
    assert.deepEqual(opts.network, { egress: { default: 'deny', allow: [] } });
    assert.deepEqual(opts.disks.code, { disk: 'dsk-test', subdirectory: 'versions/v1', readOnly: true });
    assert.match(opts.disks.io.subdirectory, /^executions\/[0-9a-f-]{36}$/);
    assert.equal(opts.baseImage, 'python:3.12-slim');
    assert.match(opts.command, /timeout -k 5s 45s python3 -I/);
    assert.ok(!opts.command.includes('fixture'));
  }
  assert.notEqual(f.calls[0].disks.io.subdirectory, f.calls[1].disks.io.subdirectory);
});
test('remote failure never falls back and oversize output is rejected', async () => {
  const f = await fixture(); f.client.exec = async () => { throw new Error('private provider details'); };
  await assert.rejects(f.company.executeVersion({ prefix: 'v1', input: {} }), /No local fallback/);
  f.client.exec = async () => ({ exitCode: 0, stdout: 'a'.repeat(2 * 1024 * 1024 + 1), stderr: '' });
  await assert.rejects(f.company.executeVersion({ prefix: 'v1', input: {} }), /2 MB/);
});
test('memory names are fixed and batch uses one scoped execution', async () => {
  const f = await fixture();
  await assert.rejects(f.company.saveMemory('../credentials.json', {}));
  await f.company.saveMemory('state.json', { stage: 'discovered' });
  assert.deepEqual(JSON.parse(f.objects.get('memory/state.json')), { stage: 'discovered' });
  await f.company.writeCompanyFiles({ 'hubspot_deals.csv': 'id\n1', 'policy_update.md': 'Policy' });
  assert.equal(f.objects.get('company/policy_update.md'), 'Policy');
  await assert.rejects(f.company.writeCompanyFiles({ 'workflow.py': 'bad' }));
  const original = f.client.exec;
  f.client.exec = async opts => { const result = await original(opts); return { ...result, stdout: JSON.stringify({ exitCode: 0, outputs: [{ a: 1 }, { a: 2 }] }) }; };
  assert.deepEqual((await f.company.executeCases({ prefix: 'versions/v1', inputs: [{ n: 1 }, { n: 2 }] })).outputs, [{ a: 1 }, { a: 2 }]);
  assert.equal(f.calls.length, 1);
  assert.match(f.calls[0].command, / batch$/);
  await assert.rejects(f.company.executeCases({ prefix: 'v1', inputs: [] }));
});
