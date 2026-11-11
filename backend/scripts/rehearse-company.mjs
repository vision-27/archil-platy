import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { POLICY, CONTRACT } from '../src/company-checks.mjs';

const base = process.env.PLATY_BACKEND_URL || 'http://127.0.0.1:4310';
const withBrowser = process.argv.includes('--browser');
async function verifyBrowser(version, baseline = false) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL('./verify-preview.mjs', import.meta.url)), version.id, ...(baseline ? ['--baseline'] : [])], { stdio: 'inherit', windowsHide: true });
    child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error('Generated preview browser verification failed.')));
  });
  return JSON.parse(await readFile(new URL(`../.data/company/browser-${version.id}.json`, import.meta.url), 'utf8'));
}
async function api(path, body) {
  const response = await fetch(`${base}${path}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Platy-Demo': '1' }, body: JSON.stringify(body) });
  const value = await response.json();
  if (!response.ok) throw new Error(`${value.error?.code}: ${value.error?.message}`);
  return value;
}
async function operation(kind, data = {}) {
  const { job: queued } = await api(`/api/company/${kind}`, { requestKey: randomUUID(), ...data });
  let previous = '';
  for (let count = 0; count < 900; count++) {
    const { job } = await api(`/api/company/jobs/${queued.id}`);
    const progress = `${job.kind}: ${job.stage} (${job.status})`;
    if (progress !== previous) { console.log(progress); previous = progress; }
    if (job.status === 'completed') return job;
    if (['failed','interrupted'].includes(job.status)) throw new Error(`${job.error?.code}: ${job.error?.message}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for job ${queued.id}; poll that job before submitting again.`);
}

let workspace = await api('/api/company');
if (!workspace.discovery) { await operation('discover'); workspace = await api('/api/company'); }
else console.log('Reusing saved live discovery; this is not a new discovery run.');
assert.ok(workspace.discovery.receipts.every(receipt => receipt.live));
console.log(`Selected: ${workspace.discovery.selectedOpportunity.name}`);
let baseline = workspace.versions.find(v => !v.policyApplied && ['passed','approved'].includes(v.status));
if (!baseline) {
  const built = await operation('build'); baseline = (await api(`/api/company/versions/${built.result.versionId}`)).version;
} else console.log(`Reusing saved baseline v${baseline.number}.`);
assert.equal(baseline.tests.summary.failed, 0);
if (withBrowser) await verifyBrowser(baseline, true);
workspace = await api('/api/company');
let evolved = [...workspace.versions].reverse().find(v => v.policyApplied && ['passed','approved'].includes(v.status));
if (!evolved) {
  const built = await operation('evolve', { policyText: POLICY }); evolved = (await api(`/api/company/versions/${built.result.versionId}`)).version;
} else console.log(`Reusing saved evolved v${evolved.number}.`);
assert.ok(evolved.previousVersionTests.summary.failed > 0, 'Old software must fail the new policy');
assert.equal(evolved.tests.summary.failed, 0);
const cases = [
  { name: 'high-value-unapproved', value: 18000, approved: false, status: 'needs_finance_approval' },
  { name: 'low-value', value: 8000, approved: false, status: 'completed' },
  { name: 'exact-threshold', value: 10000, approved: false, status: 'completed' },
  { name: 'high-value-approved', value: 18000, approved: true, status: 'completed' }
];
const executions = [];
if (withBrowser) executions.push(...(await verifyBrowser(evolved)).results);
else for (const row of cases) {
  const input = structuredClone(CONTRACT.input); input.deal.value_usd = row.value; input.financeApproved = row.approved;
  const job = await operation('run', { versionId: evolved.id, input });
  assert.equal(job.result.output.status, row.status);
  executions.push({ name: row.name, jobId: job.id, ...job.result });
}
const preview = await fetch(`${base}/api/company/versions/${evolved.id}/preview`);
assert.equal(preview.status, 200); assert.match(preview.headers.get('content-security-policy'), /sandbox allow-scripts/);
assert.equal(await preview.text(), evolved.files['app.html']);
const { version: approved } = await api(`/api/company/versions/${evolved.id}/approve`, { sourceHash: evolved.sourceHash, resultHash: evolved.resultHash });
assert.equal(approved.approval.simulated, true); assert.equal(approved.approval.deployed, false);
const evidence = { at: new Date().toISOString(), mode: 'live Archil execution; saved live-model versions may be reused', baseline: { id: baseline.id, summary: baseline.tests.summary }, evolved: { id: evolved.id, summary: evolved.tests.summary, previousVersionSummary: evolved.previousVersionTests.summary, sourceHash: evolved.sourceHash, resultHash: evolved.resultHash }, executions, approval: approved.approval, previewHttpVerified: true, browserInteractionVerified: withBrowser };
const directory = new URL('../.data/company/', import.meta.url); await mkdir(directory, { recursive: true });
await writeFile(new URL('rehearsal.json', directory), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ baseline: evidence.baseline, evolved: evidence.evolved, executedCases: executions.length, simulatedApproval: true }, null, 2));
