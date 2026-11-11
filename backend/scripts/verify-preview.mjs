import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Independent, disposable browser profile. No existing browser session is read.
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
const directory = new URL('../.data/company/', import.meta.url); await mkdir(directory, { recursive: true });
const cases = [
  { name: 'high-value-unapproved', value: '18000', finance: false, status: 'needs_finance_approval' },
  { name: 'low-value', value: '8000', finance: false, status: 'completed' },
  { name: 'exact-threshold', value: '10000', finance: false, status: 'completed' },
  { name: 'high-value-approved', value: '18000', finance: true, status: 'completed' }
];
const baseline = process.argv.includes('--baseline');
if (baseline) for (const row of cases) row.status = 'completed';
const results = [];
try {
  for (const row of cases) {
    await page.goto('http://127.0.0.1:4311');
    await page.locator('#version option').first().waitFor({ state: 'attached' });
    if (process.argv[2]) await page.locator('#version').selectOption(process.argv[2]);
    const versionId = await page.locator('#version').inputValue();
    await page.getByRole('button', { name: 'Enable interactive preview' }).click();
    const app = page.frameLocator('#preview');
    await app.getByLabel(/(?:Deal|Contract) value/).fill(row.value);
    const finance = app.getByLabel(/Finance approv/i);
    if (!baseline || await finance.count()) await finance.setChecked(row.finance);
    await app.getByRole('button', { name: 'Run onboarding' }).click();
    await page.waitForFunction(() => {
      const text = document.querySelector('#result').textContent;
      try { return Boolean(JSON.parse(text).output); } catch { return text.includes('ERROR:'); }
    }, null, { timeout: 180_000 });
    const text = await page.locator('#result').textContent();
    if (text.includes('ERROR:')) throw new Error(text);
    const result = JSON.parse(text);
    assert.equal(result.output.status, row.status);
    await app.getByText(new RegExp(`^${row.status.replaceAll('_','[_ ]')}$`, 'i')).waitFor();
    results.push({ name: row.name, versionId, ...result });
    console.log(`${row.name}: ${row.status} (real browser bridge and Archil execution)`);
    if (row.name === 'high-value-unapproved') {
      await app.getByText(new RegExp(`^${row.status.replaceAll('_','[_ ]')}$`, 'i')).scrollIntoViewIfNeeded();
      await page.screenshot({ path: new URL(`preview-${versionId}.png`, directory).pathname.replace(/^\/([A-Za-z]:)/,'$1'), fullPage: true });
    }
    if (!baseline && row.name === 'high-value-approved') {
      await app.getByRole('button', { name: 'Run onboarding' }).click();
      await page.waitForFunction(previousId => {
        const text = document.querySelector('#result').textContent;
        try { const result=JSON.parse(text); return result.output && result.jobId !== previousId; } catch { return text.includes('ERROR:'); }
      }, result.jobId, { timeout: 180_000 });
      const repeatedText = await page.locator('#result').textContent();
      if (repeatedText.includes('ERROR:')) throw new Error(repeatedText);
      const repeated = JSON.parse(repeatedText);
      assert.equal(repeated.output.status, 'completed'); assert.deepEqual(repeated.output.executedActions, []);
      results.push({ name: 'duplicate-browser-request', versionId, ...repeated });
      console.log('duplicate-browser-request: completed with no repeated actions');
    }
  }
  const evidence = JSON.stringify({ at: new Date().toISOString(), baseline, mode: 'isolated headless browser; generated HTML; real Archil compute', results }, null, 2);
  await writeFile(new URL('browser-verification.json', directory), evidence);
  await writeFile(new URL(`browser-${results[0].versionId}.json`, directory), evidence);
} catch (error) {
  await page.screenshot({ path: new URL('preview-failure.png', directory).pathname.replace(/^\/([A-Za-z]:)/,'$1'), fullPage: true }).catch(() => {});
  console.error(await page.locator('body').innerText().catch(() => 'Page unavailable'));
  throw error;
} finally { await browser.close(); }
