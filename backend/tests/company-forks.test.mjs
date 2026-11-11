import test from 'node:test';
import assert from 'node:assert/strict';
import { CompanyForks } from '../src/company-forks.mjs';

function fixture({ corrupt = false, unsafe = false, missingCheckpoint = false } = {}) {
  const sandboxes = []; let options;
  function sandbox(parent) {
    const data = new Map(parent?.data); const id = `sandbox-${sandboxes.length}`;
    const item = { id, status: 'running', data, commands: [],
      files: { uploadFile: async (bytes, path) => data.set(path, Buffer.from(bytes)), downloadFile: async (path, consume) => consume(data.get(path)) },
      refresh: async () => item,
      stop: async () => { item.status = 'stopped'; if (!missingCheckpoint) item.checkpoint = 'checkpoint-1'; },
      getNetwork: async () => ({ egress: { default: unsafe && parent ? 'allow' : 'deny', allow: [] } }),
      fork: async () => { assert.equal(item.status, 'stopped'); const child = sandbox(item); if (corrupt) child.data.set('/company/specification.json', Buffer.from('{}')); return child; },
      exec: async command => {
        item.commands.push(command);
        if (command.includes('ln -sfn')) {
          item.code = command.match(/ln -sfn '([^']+)'/)[1];
          const original = item.files.downloadFile;
          item.files.downloadFile = async (path, consume) => original(path.replace('/mnt/archil/code', item.code), consume);
        }
        return { exitCode: 0, stdout: JSON.stringify({ exitCode: 0, stdout: '', stderr: '' }), stderr: '' };
      }
    };
    sandboxes.push(item); return item;
  }
  const client = { sandboxes: { create: async value => { options = value; return sandbox(); } } };
  const records = ['a','b','c'].map(id => ({ id }));
  const prepare = () => new CompanyForks({ client }).prepare({ versionId: 'version-1', files: { 'onboarding_sop.md': 'SOP' }, specification: { name: 'Onboarding' }, records, notify: () => {} });
  return { prepare, records, sandboxes, options: () => options };
}

test('three real fork calls inherit verified root context, with no mounted company disk; cleanup retains stopped sandboxes', async () => {
  const f = fixture(); const pool = await f.prepare();
  assert.equal(f.sandboxes.length, 4); assert.equal(pool.runners.length, 3);
  assert.deepEqual(f.options().mounts, []); assert.equal(f.options().network.egress.default, 'deny');
  assert.ok(f.records.every(row => row.contextVerified && row.baseCheckpoint === 'checkpoint-1'));
  assert.equal(new Set(f.records.map(row => row.sandboxId)).size, 3);
  await pool.close(); assert.ok(f.sandboxes.every(row => row.status === 'stopped'));
});

test('missing checkpoint, unexpected egress, and corrupted inherited context fail closed and stop all sandboxes', async () => {
  for (const option of [{ missingCheckpoint: true }, { unsafe: true }, { corrupt: true }]) {
    const f = fixture(option); await assert.rejects(f.prepare());
    assert.ok(f.sandboxes.every(row => row.status === 'stopped'));
    assert.ok(f.sandboxes.every(row => !row.commands.some(command => command.includes('company-entry.py'))));
  }
});

test('fork execution rejects source mutation and records bounded remote execution', async () => {
  const f = fixture(); const pool = await f.prepare(); const runner = pool.runners[0];
  const files = { 'workflow.py': '# code', 'app.html': '<html></html>', 'test_workflow.py': '# tests', 'README.md': 'demo' };
  await runner.putFiles('versions/v1/attempt-1', files);
  const result = await runner.testVersion({ prefix: 'versions/v1/attempt-1' });
  assert.equal(result.execution.sandboxId, f.records[0].sandboxId);
  assert.match(f.sandboxes[1].commands.at(-1), /timeout -k 5s 45s python3 -I/);
  f.sandboxes[1].data.set('/work/versions/v1/attempt-1/workflow.py', Buffer.from('# changed'));
  await assert.rejects(runner.testVersion({ prefix: 'versions/v1/attempt-1' }), error => error.code === 'fork_source_changed');
  await pool.close();
});
