import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = new URL('../.data/company/', import.meta.url);
const api = 'http://127.0.0.1:4310';
const base = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
const workspace = await (await fetch(api + '/api/company')).json();
const batch = [...workspace.jobs].reverse().find(j => j.kind === 'build-all');
assert.equal(batch?.status, 'completed', 'Complete a real build-all before verification; this check resumes that rehearsal.');
assert.equal(batch.result.successes.length, 3);
const versions = batch.result.versionIds.map(id => workspace.versions.find(v => v.id === id));
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(20000);
const errors = [], runs = new Map();
page.on('pageerror', e => errors.push(e.message));
page.on('response', async response => {
  if (!response.url().includes('/api/company/jobs/')) return;
  try { const { job } = await response.json(); if (job.kind === 'run' && ['completed', 'failed'].includes(job.status)) runs.set(job.id, job); } catch {}
});
const shot = name => page.screenshot({ path: new URL(name, out).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
const nav = name => page.getByRole('button', { name, exact: true }).click();
async function run(button) {
  const count = runs.size;
  await button.click();
  await page.getByText(/Last run finished in/).waitFor({ timeout: 180000 });
  assert.equal(runs.size, count + 1);
  const job = [...runs.values()].at(-1);
  assert.equal(job.status, 'completed', JSON.stringify(job.error));
  return job;
}
try {
  await page.goto(base + '/?resume=1');
  await page.getByRole('button', { name: /Completed runs\s+[0-9]+/ }).waitFor();
  await shot('platform-connections.png');
  await nav('Discover'); await page.getByText('Discoveries', { exact: true }).waitFor(); await shot('platform-discoveries.png');
  await nav('Build'); await page.getByText('Invoice approvals', { exact: true }).waitFor(); await shot('platform-workflows.png');
  await nav('Test');
  for (const version of versions) {
    const name = { onboarding: 'Client onboarding', reporting: 'Monthly reporting', invoices: 'Invoice approvals' }[version.workflowId];
    await page.getByRole('radio', { name, exact: true }).click();
    const host = page.locator('#co-preview-host iframe');
    assert.equal(await host.getAttribute('sandbox'), 'allow-scripts');
    assert.equal(await host.getAttribute('data-ver'), version.id);
    const frame = page.frameLocator('#co-preview-host iframe');
    await frame.locator('body').waitFor();
    await page.getByRole('button', { name: 'Enable interactive preview', exact: true }).click();
    if (version.workflowId === 'onboarding') {
      await frame.getByLabel(/Contract value/i).fill('18000');
      await frame.getByLabel(/Signed agreement/i).setChecked(true);
      await frame.getByLabel(/Brand assets/i).setChecked(true);
      const finance = frame.getByLabel(/Finance approval/i);
      if (await finance.count()) await finance.setChecked(false);
    }
    const button = frame.getByRole('button', { name: /run|evaluate routing/i }).first();
    const first = await run(button);
    assert.equal(first.result.versionId, version.id);
    assert.equal(first.result.output.status, { onboarding: version.policyApplied ? 'needs_finance_approval' : 'completed', reporting: 'needs_account_lead_approval', invoices: 'needs_budget_owner_approval' }[version.workflowId]);
    const checkbox = frame.getByLabel(version.workflowId === 'onboarding' ? /Finance approval/i : version.workflowId === 'reporting' ? /Account.lead approv/i : /Budget.owner approv/i);
    if (await checkbox.count()) await checkbox.setChecked(true);
    else if (version.workflowId !== 'onboarding' || version.policyApplied) await frame.getByRole('button', { name: /^(Account.lead approval|Simulated approval)/i }).click();
    const second = await run(button);
    assert.equal(second.result.output.status, 'completed');
    await shot('platform-' + version.workflowId + '-app.png');
    console.log(name + ': real Archil business rules and completed execution verified.');
  }
  await nav('Build');
  while (await page.getByRole('button', { name: 'Release to Demo production', exact: true }).count()) {
    const approved = page.waitForResponse(r => r.url().endsWith('/approve') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Release to Demo production', exact: true }).first().click();
    assert.equal((await approved).status(), 200);
    await page.getByText('Released to Demo production. Simulated: no real systems changed.', { exact: true }).waitFor();
    await page.waitForTimeout(300);
  }
  await nav('Company'); await shot('platform-impact.png');
  await page.reload(); await page.getByRole('button', { name: /Completed runs\s+[0-9]+/ }).waitFor();
  const latest = await (await fetch(api + '/api/company')).json();
  for (const v of versions) assert.equal(latest.activeVersions[v.workflowId], v.id);
  assert.deepEqual(errors, []);
  await writeFile(new URL('platform-verification.json', out), JSON.stringify({ at: new Date().toISOString(), batchId: batch.id, versionIds: versions.map(v => v.id), runs: [...runs.values()], pageErrors: errors, desktop: true }, null, 2));
  console.log('Desktop supplied UI: three workflows, real executions, independent releases, resume and impact verified.');
} catch (error) {
  await shot('platform-failure.png').catch(() => {}); console.error((await page.locator('body').innerText()).slice(-1800)); throw error;
} finally { await browser.close(); }
