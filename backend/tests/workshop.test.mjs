import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const html = await readFile(new URL('../../frontend/index.html', import.meta.url), 'utf8');
const script = html.match(/<script>(\/\* Platy's Workshop:[\s\S]*?)<\/script>/)[1];
const window = {};
runInNewContext(script, { window });
const derive = window.PlatyWorkshop.derive;
const snapshot = fork => ({ conn: 'live', ready: true, job: { id: 'batch', kind: 'build-all', status: 'running', stage: 'parallel-build', forks: [fork], events: [] } });

test('tester moves as soon as a fork starts testing, before any results arrive', () => {
  const view = derive(snapshot({ id: 'fork', status: 'running', stage: 'testing', tests: null }));
  assert.equal(view.testing, true);
  assert.ok(view.ev.some(e => e.type === 'test.started'));
  assert.equal(view.rest.test.pose, 'checklist');
});

test('failed-attempt handoff and repair follow actual fork state instead of old test results', () => {
  const view = derive(snapshot({ id: 'fork', status: 'running', stage: 'repairing', tests: { passed: 1, total: 2, failed: 1 }, attempts: [{ attempt: 1, passed: false }] }));
  assert.equal(view.testing, false);
  assert.equal(view.rest.build.pose, 'fixing');
  assert.ok(view.ev.some(e => e.type === 'test.failed'));
  assert.ok(view.ev.some(e => e.type === 'build.repairing'));
});
