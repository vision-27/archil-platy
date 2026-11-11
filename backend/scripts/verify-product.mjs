import { chromium } from 'playwright';
import { writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = new URL('../.data/company/', import.meta.url);
const api='http://127.0.0.1:4310';
const workspace=await (await fetch(`${api}/api/company`)).json();
const batch=[...workspace.jobs].reverse().find(j=>j.kind==='build-all');
assert.equal(batch?.status,'completed','Finish a real build-all before product verification.');
assert.equal(batch.result.successes.length,3,'All three workflows must have passed.');
const versions=batch.result.versionIds.map(id=>workspace.versions.find(v=>v.id===id));
assert.equal(new Set(versions.map(v=>v.workflowId)).size,3);
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[],runs=new Map();
page.on('pageerror',e=>errors.push(e.message));
page.on('response',async response=>{if(!response.url().includes('/api/company/jobs/'))return;try{const {job}=await response.json();if(job.kind==='run'&&['completed','failed'].includes(job.status))runs.set(job.id,job);}catch{}});
const shot=name=>page.screenshot({path:new URL(name,out).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
const navigate=id=>page.locator(`[data-act="stage"][data-arg="${id}"]`).click();
async function openWorkflow(version){await navigate('build');const back=page.locator('[data-act="backWorkflows"]');if(await back.count())await back.click();await page.locator(`[data-workflow="${version.workflowId}"] [data-act="workflow"]`).click();}
async function clickAndRead(button){const count=runs.size;await button.click();await page.locator('#app-status').filter({hasText:/Running version/}).waitFor();await page.locator('#app-status').filter({hasText:/ran in/}).waitFor({timeout:180000});assert.equal(runs.size,count+1);const job=[...runs.values()].at(-1);assert.equal(job.status,'completed',JSON.stringify(job.error));return job;}
try{
 await page.goto('http://127.0.0.1:5173');await page.getByText('Backend connected',{exact:true}).waitFor();await shot('platform-connections.png');
 await navigate('discover');assert.equal(await page.locator('.opportunity').count(),3);await shot('platform-discoveries.png');
 await navigate('build');assert.equal(await page.locator('.fork-card').count(),3);await shot('platform-workflows.png');
 for(const version of versions){
  await openWorkflow(version);
  assert.equal(await page.locator('h1').innerText(),{onboarding:'Client onboarding',reporting:'Monthly reporting',invoices:'Invoice approvals'}[version.workflowId]);
  if(version.workflowId==='onboarding'){
   await page.getByRole('button',{name:'$18,000 · no approval',exact:true}).click();
   assert.match(await page.locator('.compare-card.after').innerText(),/Waiting for Finance/);
   await shot('platform-review.png');
  }
  const release=page.locator('[data-act="approve"]');
  if(await release.count()){await release.click();await page.getByRole('heading',{name:'See what your workflows are doing.'}).waitFor();await page.locator(`[data-act="runActive"][data-arg="${version.id}"]`).first().waitFor();}
  await openWorkflow(version);
  await page.locator('[data-act="openRun"]').click();
  await page.getByRole('button',{name:'Enable interactive preview',exact:true}).click();
  const frame=page.frameLocator('#preview-host iframe');
  assert.equal(await page.locator('#preview-host iframe').getAttribute('sandbox'),'allow-scripts');
  const runButton=frame.getByRole('button',{name:/run|evaluate routing/i}).first();
  await runButton.waitFor({timeout:45000});
  const first=await clickAndRead(runButton);
  assert.equal(first.result.versionId,version.id);
  const expected=version.workflowId==='onboarding'?'needs_finance_approval':version.workflowId==='reporting'?'needs_account_lead_approval':'needs_budget_owner_approval';
  assert.equal(first.result.output.status,expected);
  console.log(`${version.workflowId}: approval gate works through actual generated UI + Archil`);
  await shot(`platform-${version.workflowId}-app.png`);
  const approvalLabel=version.workflowId==='onboarding'?/Finance approv/i:version.workflowId==='reporting'?/Account.*approv/i:/Budget.*approv/i;
  const checkbox=frame.getByLabel(approvalLabel);
  if(await checkbox.count()) await checkbox.setChecked(true);
  else await frame.getByRole('button',{name:/^Account.lead approval/i}).click();
  const second=await clickAndRead(runButton);assert.equal(second.result.output.status,'completed');
  console.log(`${version.workflowId}: approved sample completes through product UI + Archil`);
 }
 await navigate('impact');await page.reload();await page.getByText('Backend connected',{exact:true}).waitFor();
 await page.getByRole('heading',{name:'3 workflows are ready to work.'}).waitFor();
 assert.equal(await page.locator('[data-act="runActive"]').count(),4);await shot('platform-impact.png');
 await page.setViewportSize({width:390,height:844});await navigate('company');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await shot('platform-mobile.png');
 await navigate('build');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await shot('platform-mobile-workflows.png');
 assert.deepEqual(errors,[]);
 const latest=await (await fetch(`${api}/api/company`)).json();for(const v of versions)assert.equal(latest.activeVersions[v.workflowId],v.id);
 await writeFile(new URL('platform-verification.json',out),JSON.stringify({at:new Date().toISOString(),batchId:batch.id,versionIds:versions.map(v=>v.id),activeVersions:latest.activeVersions,runs:[...runs.values()],pageErrors:errors,mobileOverflow:false},null,2));
 console.log('Three independent releases persist; Impact reflects actual synthetic runs; desktop/mobile passed.');
}catch(error){await shot('platform-failure.png').catch(()=>{});console.error((await page.locator('body').innerText()).slice(-1600));console.error('Page errors:',errors);throw error;}finally{await browser.close();}
