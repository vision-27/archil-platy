import test from 'node:test';
import assert from 'node:assert/strict';
import { CompanyService } from '../src/company-service.mjs';
import { ACTIONS, CONTRACT, POLICY, acceptanceCases, checkOutput, validateInput } from '../src/company-checks.mjs';
import { loadCompanyFiles } from '../src/discovery.mjs';
import { createApp } from '../src/server.mjs';
import { Store } from '../src/store.mjs';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('SQLite rehearsal reset archives atomically and rejects conflicting archive IDs without data loss', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'platy-rehearsal-'));
  const store = new Store(directory);
  try {
    const previous = { versions: [{ id: 'retained-code' }], jobs: [] }, fresh = { versions: [], jobs: [] };
    store.saveCompany(previous);
    const id = crypto.randomUUID(); store.resetCompany(id, fresh);
    assert.deepEqual(store.getCompany(), fresh);
    assert.deepEqual(JSON.parse(store.db.prepare('SELECT record FROM company_history WHERE id=?').get(id).record), previous);
    assert.throws(() => store.resetCompany(id, { overwritten: true }));
    assert.deepEqual(store.getCompany(), fresh);
  } finally { store.close(); }
});

// Fake transport only: no generated code or provider call occurs in these tests.
function outputFor(input, policy) {
  const missing = Object.entries(input.documents).filter(([,has]) => !has).map(([name]) => name);
  const eligible = input.deal.stage === 'closed_won' && input.deal.value_usd !== null && input.deal.value_usd >= 0;
  const status = !eligible ? 'skipped' : missing.length ? 'needs_documents' : policy && input.deal.value_usd > 10000 && !input.financeApproved ? 'needs_finance_approval' : 'completed';
  const executedActions = status === 'completed' ? ACTIONS.filter(x => !input.completedActions.includes(x)) : [];
  return { client: input.deal.client, dealId: input.deal.id, status, missingDocuments: eligible ? missing : [], executedActions, blockingReasons: status === 'completed' ? [] : ['Blocked by business rule'],
    checklist: [...ACTIONS.map(id => ({ id, label: id, done: executedActions.includes(id) || input.completedActions.includes(id), required: true })), ...(policy && input.deal.value_usd > 10000 ? [{ id: 'finance_approval', label: 'Finance approval', done: input.financeApproved, required: true }] : [])] };
}
async function fixture() {
  const files = await loadCompanyFiles(); let saved = null;
  const archives = new Map();
  const store = { getCompany: () => structuredClone(saved), saveCompany: state => { saved = structuredClone(state); }, resetCompany: (id, state) => { archives.set(id, structuredClone(saved)); saved = structuredClone(state); } };
  const objects = new Map(); const evidence = new Map(); let writes = 0;
  const disk = {
    ensure: async () => ({ id: 'test-disk', region: 'test' }),
    writeCompanyFiles: async entries => { writes++; for (const [name, content] of Object.entries(entries)) objects.set(`company/${name}`, content); },
    readCompanyFiles: async names => Object.fromEntries(names.map(name => [name, objects.get(`company/${name}`)])),
    removePolicy: async () => { objects.delete('company/policy_update.md'); },
    saveMemory: async () => {}, saveEvidence: async (id, value) => evidence.set(id, structuredClone(value)),
    putFiles: async (prefix, entries) => { for (const [name, content] of Object.entries(entries)) objects.set(`${prefix}/${name}`, content); },
    getFile: async path => objects.get(path), testVersion: async () => ({ exitCode: 0, stdout: 'fake transport', execution: { diskId: 'test-disk' } }),
    executeCases: async ({ prefix, inputs }) => ({ outputs: inputs.map(input => outputFor(input, objects.get(`${prefix}/workflow.py`).includes('FINANCE'))), execution: { diskId: 'test-disk', prefix } }),
    executeVersion: async ({ prefix, input }) => ({ output: outputFor(input, objects.get(`${prefix}/workflow.py`).includes('FINANCE')), execution: { diskId: 'test-disk', prefix } })
  };
  let generations = 0;
  const cite = { file: 'onboarding_sop.md', line: 2, quote: files['onboarding_sop.md'].split(/\r?\n/)[1] };
  const model = { model: 'fake', async generate({ stage, prompt }) {
    generations++;
    let value;
    if (stage === 'workflow-mapping') value = { context: { company: 'Northstar', summary: 'Agency', citations: [cite] }, workflows: [{ id: 'onboarding', name: 'Client onboarding', trigger: 'Deal closes', steps: ['Check documents'], citations: [cite] }] };
    else if (stage === 'opportunity-specification') value = { opportunities: [{ id: 'opp', workflowId: 'onboarding', name: 'Client onboarding', description: 'Manual onboarding', difficulty: 1, risk: 1, timesheetCitation: { file: 'timesheets.csv', line: 2, quote: files['timesheets.csv'].split(/\r?\n/)[1] }, citations: [cite] }], specifications: [{ workflow: 'onboarding', name: 'Client onboarding', trigger: 'Deal closes', inputs: ['deals'], actions: ['Create workspace'], successCriteria: ['No duplicates'], approvalRequired: true, sourceFiles: ['onboarding_sop.md'], citations: [cite] }] };
    else value = { 'workflow.py': prompt.sources['policy_update.md'] ? '# FINANCE' : '# BASELINE', 'app.html': '<html><script>/* platy:run platy:result */</script></html>', 'test_workflow.py': '# fake test source', 'README.md': 'Synthetic fake transport' };
    return { value, receipt: { live: true, provider: 'test-double', model: 'fake', stage } };
  } };
  let closed = 0;
  const forks = { prepare: async ({ records, notify }) => {
    for (const record of records) { Object.assign(record, { sandboxId: `fake-${record.id}`, contextVerified: true }); notify(record); }
    return { base: { sandboxId: 'fake-base', checkpoint: 'fake-checkpoint' }, runners: records.map(() => new Proxy({}, { get: (_, name) => disk[name] })), close: async () => { closed++; } };
  } };
  const service = new CompanyService({ store, model, disk, forks, sourceFiles: files });
  const run = async (kind, extra = {}) => { const { job } = service.start(kind, { requestKey: `test-${crypto.randomUUID()}`, ...extra }); await service.idle(); return service.job(job.id); };
  return { service, store, disk, forks, model, objects, evidence, files, run, archives, generations: () => generations, writes: () => writes, closed: () => closed };
}

test('fresh rehearsal archives evidence, resets real state, and does not start inference', async () => {
  const f = await fixture();
  await f.run('discover'); await f.run('build'); await f.run('evolve', { policyText: POLICY });
  const previous = f.service.workspace(), count = f.generations(), requestKey = crypto.randomUUID();
  const fresh = f.service.reset({ requestKey });
  assert.equal(f.archives.get(requestKey).versions.length, previous.versions.length);
  assert.deepEqual(fresh.versions, []); assert.deepEqual(fresh.jobs, []); assert.equal(fresh.discovery, null);
  assert.deepEqual(fresh.activeVersions, {}); assert.equal(fresh.files.length, 5);
  assert.equal(f.generations(), count);
  assert.deepEqual(f.service.reset({ requestKey }), fresh); assert.equal(f.archives.size, 1);
  assert.ok([...f.objects.keys()].some(k => k.endsWith('/workflow.py')), 'immutable code retained');
  await f.run('discover'); assert.equal(f.objects.has('company/policy_update.md'), false);
});

test('refresh never resets a running job and failed archive leaves current state intact', async () => {
  const f = await fixture(); const { job } = f.service.start('discover', { requestKey: crypto.randomUUID() });
  assert.throws(() => f.service.reset({ requestKey: crypto.randomUUID() }), e => e.code === 'company_busy');
  await f.service.idle(); assert.equal(f.service.job(job.id).status, 'completed');
  const before = f.service.workspace();
  f.store.resetCompany = () => { throw new Error('archive failed'); };
  assert.throws(() => f.service.reset({ requestKey: crypto.randomUUID() }), /archive failed/);
  assert.deepEqual(f.service.workspace(), before);
});

test('independent checks catch unsafe approval, threshold, duplicates and fabricated checklist', () => {
  const high = structuredClone(CONTRACT.input);
  assert.equal(checkOutput(outputFor(high, false), high, true).passed, false);
  for (const row of acceptanceCases(true)) assert.equal(checkOutput(outputFor(row.input, true), row.input, true).passed, true, row.id);
  const low = { ...high, deal: { ...high.deal, value_usd: 10000 } };
  assert.equal(outputFor(low, true).status, 'completed');
  const fabricated = outputFor(high, true); fabricated.executedActions = ['create_workspace'];
  assert.equal(checkOutput(fabricated, high, true).passed, false);
  const duplicate = { ...high, completedActions: [...ACTIONS], financeApproved: true };
  const result = outputFor(duplicate, true); result.executedActions = [...ACTIONS];
  assert.equal(checkOutput(result, duplicate, true).passed, false);
  assert.throws(() => validateInput({ ...high, deal: { ...high.deal, value_usd: '18000' } }));
  assert.throws(() => validateInput({ ...high, completedActions: ['arbitrary command'] }));
  assert.throws(() => validateInput(null));
});

test('complete fake-transport loop retains v1, catches new policy, approves exact v2 and executes selected version', async () => {
  const f = await fixture();
  assert.equal((await f.run('discover')).status, 'completed');
  assert.equal(f.service.workspace().discovery.selectedOpportunity.name, 'Client onboarding');
  const first = await f.run('build'); assert.equal(first.status, 'completed');
  const v1 = f.service.version(first.result.versionId);
  assert.equal(v1.tests.summary.failed, 0);
  await f.service.approve(v1.id, { sourceHash: v1.sourceHash, resultHash: v1.resultHash });
  const second = await f.run('evolve', { policyText: POLICY }); assert.equal(second.status, 'completed');
  const v2 = f.service.version(second.result.versionId);
  assert.equal(v2.parentVersionId, v1.id); assert.ok(v2.previousVersionTests.summary.failed > 0);
  assert.equal(v2.tests.summary.failed, 0); assert.equal(f.service.workspace().activeVersionId, v1.id);
  await assert.rejects(f.service.approve(v1.id, { sourceHash: v1.sourceHash, resultHash: v1.resultHash }), /latest passing/);
  await assert.rejects(f.service.approve(v2.id, { sourceHash: v1.sourceHash, resultHash: v2.resultHash }), /latest passing/);
  const approved = await f.service.approve(v2.id, { sourceHash: v2.sourceHash, resultHash: v2.resultHash });
  assert.equal(approved.approval.simulated, true); assert.equal(approved.approval.deployed, false);
  const execution = await f.run('run', { versionId: v2.id, input: CONTRACT.input });
  assert.equal(execution.result.output.status, 'needs_finance_approval');
  assert.equal(f.evidence.get(v2.id).status, 'approved');
  assert.equal(f.writes(), 2); // initial sources and explicit new policy, not resets between jobs
});

test('request keys deduplicate model work, concurrency is rejected, and restart never replays', async () => {
  const f = await fixture();
  const a = f.service.start('discover', { requestKey: 'same-request' });
  const b = f.service.start('discover', { requestKey: 'same-request' });
  assert.equal(a.job.id, b.job.id);
  assert.throws(() => f.service.start('build', { requestKey: 'same-request' }), e => e.code === 'request_key_conflict');
  assert.throws(() => f.service.start('discover', { requestKey: 'other-request' }), e => e.code === 'company_busy');
  await f.service.idle(); assert.equal(f.generations(), 2);
  const state = f.store.getCompany(); state.jobs[0].status = 'running'; f.store.saveCompany(state);
  const restarted = new CompanyService({ store: f.store, model: f.model, disk: f.disk, sourceFiles: f.files });
  assert.equal(restarted.job(a.job.id).status, 'interrupted'); assert.equal(f.generations(), 2);
});

test('repair limit stops after three attempts; changed remote code and sources block approval', async () => {
  const f = await fixture(); await f.run('discover');
  const original = f.disk.executeCases;
  f.disk.executeCases = async args => { const result = await original(args); result.outputs[0].executedActions = []; return result; };
  const failed = await f.run('build'); assert.equal(failed.status, 'failed'); assert.equal(failed.error.code, 'repair_limit');
  assert.ok(f.service.version(failed.versionId).forks.every(row => row.attempts.length === 3));
  assert.equal(f.evidence.get(failed.versionId).status, 'failed');
  assert.equal(f.closed(), 1);
  f.disk.executeCases = original;
  const job = await f.run('build'); const version = f.service.version(job.result.versionId);
  const approval = { sourceHash: version.sourceHash, resultHash: version.resultHash };
  f.objects.set(`${version.prefix}/workflow.py`, '# changed');
  await assert.rejects(f.service.approve(version.id, approval), e => e.code === 'remote_source_changed');
  f.objects.set(`${version.prefix}/workflow.py`, version.files['workflow.py']);
  f.objects.set('company/onboarding_sop.md', 'changed SOP');
  await assert.rejects(f.service.approve(version.id, approval), e => e.code === 'company_changed');
  assert.equal(version.approval, null);
});

test('sandbox-incompatible generated forms trigger model repair before any code execution', async () => {
  const f = await fixture(); await f.run('discover');
  const generate = f.model.generate; let calls = 0;
  f.model.generate = async args => { const result = await generate(args); if (++calls === 1) result.value['app.html'] = '<html><form>platy:run platy:result</form></html>'; return result; };
  const job = await f.run('build'); assert.equal(job.status, 'completed');
  const version = f.service.version(job.result.versionId);
  const repaired = version.forks.find(row => row.attempts.length === 2);
  assert.equal(repaired.attempts[0].error.code, 'sandbox_form_unsupported');
  assert.ok(!f.objects.has(`versions/${version.id}/${repaired.id}/attempt-1/workflow.py`));
  assert.equal(repaired.attempts[1].passed, true);
  assert.equal(version.attempts.length, 1); // choose an equally passing candidate needing fewer repairs
});

test('shutdown waits for an in-flight exact-version approval to finish saving', async () => {
  const f = await fixture(); await f.run('discover'); const built = await f.run('build');
  const version = f.service.version(built.result.versionId);
  let release; const gate = new Promise(resolve => { release = resolve; });
  f.disk.saveEvidence = async () => gate;
  const approval = f.service.approve(version.id, { sourceHash: version.sourceHash, resultHash: version.resultHash });
  let closed = false; const closing = f.service.close().then(() => { closed = true; });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(closed, false);
  release(); await approval; await closing; assert.equal(closed, true);
  assert.equal(f.store.getCompany().activeVersionId, version.id);
});

test('three model calls overlap; one failed candidate does not block deterministic winner promotion', async () => {
  const f = await fixture(); await f.run('discover');
  const generate = f.model.generate; let entered = 0; let release;
  const gate = new Promise(resolve => { release = resolve; });
  f.model.generate = async args => {
    const index = entered++;
    if (entered === 3) release();
    await gate;
    if (index === 0) throw new Error('one model failed');
    const result = await generate(args);
    result.value['workflow.py'] += index === 1 ? '\n# longer candidate' : '';
    return result;
  };
  const job = await f.run('build'); assert.equal(job.status, 'completed'); assert.equal(entered, 3);
  const version = f.service.version(job.result.versionId);
  assert.equal(version.forks[0].status, 'failed'); assert.equal(version.forks[2].status, 'selected');
  assert.equal(version.selection.passedCandidates, 2); assert.equal(f.closed(), 1);
  assert.equal(f.objects.get(`${version.prefix}/workflow.py`), version.files['workflow.py']);
  assert.equal(version.tests.summary.failed, 0);
});

test('promotion re-tests winner and cannot approve a failing company-disk execution', async () => {
  const f = await fixture(); await f.run('discover');
  const execute = f.disk.executeCases;
  f.disk.executeCases = async args => { const result = await execute(args); if (args.prefix.endsWith('/selected')) result.outputs[0].executedActions = []; return result; };
  const job = await f.run('build'); assert.equal(job.status, 'failed'); assert.equal(job.error.code, 'promotion_failed');
  const version = f.service.version(job.versionId);
  assert.equal(version.status, 'failed'); assert.equal(f.closed(), 1);
  assert.equal(f.evidence.get(version.id).status, 'failed'); assert.equal(f.service.workspace().activeVersionId, null);
});

test('company HTTP routes preserve JSON guards and sandbox generated HTML', async t => {
  const f = await fixture(); await f.run('discover'); const build = await f.run('build');
  const server = createApp({}, f.service); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const state = await fetch(`${base}/api/company`); assert.equal(state.status, 200);
  const preview = await fetch(`${base}/api/company/versions/${build.result.versionId}/preview`);
  assert.equal(preview.status, 200); assert.match(preview.headers.get('content-security-policy'), /sandbox allow-scripts/); assert.match(preview.headers.get('content-security-policy'), /connect-src 'none'/);
  const denied = await fetch(`${base}/api/company/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(denied.status, 403);
  const bad = await fetch(`${base}/api/company/run`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Platy-Demo': '1' }, body: JSON.stringify({ requestKey: 'bad-input', versionId: build.result.versionId, input: {} }) }); assert.equal(bad.status, 400);
  const deniedReset = await fetch(`${base}/api/company/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(deniedReset.status, 403);
  const reset = await fetch(`${base}/api/company/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Platy-Demo': '1' }, body: JSON.stringify({ requestKey: crypto.randomUUID() }) });
  assert.equal(reset.status, 200); assert.deepEqual((await reset.json()).versions, []); assert.equal(f.archives.size, 1);
});
import { WORKFLOWS, expectedWorkflow, workflowActions, workflowCases, checkWorkflowOutput, validateWorkflowInput, inferWorkflow } from '../src/workflow-contracts.mjs';
function businessOutput(id,input) {
 const result=expectedWorkflow(id,input);
 return {...result,blockingReasons:result.status==='completed'?[]:['Human review or missing input required'],checklist:[...workflowActions(id).map(action=>({id:action,label:action,required:true,done:input.completedActions.includes(action)||result.executedActions.includes(action)})),...(id==='reporting'?[{id:'attribution_review',label:'Review discrepancy',required:true,done:!input.attributionDiscrepancy||input.discrepancyReviewed},{id:'account_lead_approval',label:'Account lead',required:true,done:input.accountLeadApproved}]:[{id:'budget_owner_approval',label:'Budget owner',required:true,done:input.budgetOwnerApproved}])]};
}
async function batchFixture(failInvoice=false) {
 const f=await fixture();await f.run('discover');
 const base=f.service.state.discovery.specification;
 f.service.state.discovery.specifications=[base,{...base,workflow:'monthly',name:'Monthly reporting',sourceFiles:['slack_export.md']},{...base,workflow:'vendor',name:'Invoice approvals',sourceFiles:['slack_export.md']}];
 const generate=f.model.generate;let concurrent=0,maxConcurrent=0;
 f.model.generate=async args=>{concurrent++;maxConcurrent=Math.max(maxConcurrent,concurrent);await new Promise(resolve=>setImmediate(resolve));try{const result=await generate(args);const id=inferWorkflow(args.prompt.specification.name);result.value['workflow.py']=id==='onboarding'?result.value['workflow.py']:`# ${id}`;return result;}finally{concurrent--;}};
 const executeCases=f.disk.executeCases,executeVersion=f.disk.executeVersion;
 const output=(prefix,input)=>{const source=f.objects.get(`${prefix}/workflow.py`);const id=source==='# reporting'?'reporting':source==='# invoices'?'invoices':null;return id?businessOutput(id,input):null;};
 f.disk.executeCases=async args=>{const first=output(args.prefix,args.inputs[0]);if(!first)return executeCases(args);return {outputs:args.inputs.map(input=>{const value=output(args.prefix,input);if(failInvoice&&f.objects.get(`${args.prefix}/workflow.py`)==='# invoices')value.executedActions=['pay_invoice'];return value;}),execution:{synthetic:true}};};
 f.disk.executeVersion=async args=>{const value=output(args.prefix,args.input);return value?{output:value,execution:{synthetic:true}}:executeVersion(args);};
 return {...f,maxConcurrent:()=>maxConcurrent};
}
test('new contracts cover human review, missing inputs, idempotency and forbidden actions',()=>{
 for(const id of ['reporting','invoices'])for(const row of workflowCases(id)){
  validateWorkflowInput(id,row.input);const output=businessOutput(id,row.input);assert.equal(checkWorkflowOutput(id,output,row.input).passed,true,row.id);
  output.executedActions.push(id==='reporting'?'publish_deck':'pay_invoice');assert.equal(checkWorkflowOutput(id,output,row.input).passed,false);
 }
 assert.throws(()=>validateWorkflowInput('reporting',{...WORKFLOWS.reporting.input,unexpected:true}));
 assert.throws(()=>validateWorkflowInput('invoices',{...WORKFLOWS.invoices.input,invoice:{...WORKFLOWS.invoices.input.invoice,amount_usd:-1}}));
 assert.throws(()=>inferWorkflow('reporting invoices'));
});
test('build-all concurrently builds different workflows and approves each independently',async()=>{
 const f=await batchFixture();const job=await f.run('build-all');assert.equal(job.status,'completed');assert.equal(job.result.successes.length,3);assert.equal(job.versionIds.length,3);assert.equal(job.forks.length,3);assert.ok(f.maxConcurrent()>=3);assert.equal(f.closed(),1);
 for(const row of job.result.successes){const v=f.service.version(row.versionId);assert.equal(v.workflowId,row.workflowId);assert.deepEqual(v.sampleInput,v.contract.input);await f.service.approve(v.id,{sourceHash:v.sourceHash,resultHash:v.resultHash});assert.equal(f.service.state.activeVersions[v.workflowId],v.id);const run=await f.run('run',{versionId:v.id,input:v.sampleInput});assert.equal(run.status,'completed');}
 const before=JSON.stringify(f.service.workspace());assert.throws(()=>f.service.start('run',{requestKey:'bad-input-request',versionId:job.versionIds[1],input:CONTRACT.input}));assert.equal(JSON.stringify(f.service.workspace()),before);
 assert.equal(f.service.state.activeVersionId,job.versionIds[0]);
});
test('failed workflow preserves passing siblings and exact per-workflow approval',async()=>{
 const f=await batchFixture(true);const job=await f.run('build-all');assert.equal(job.result.successes.length,2);assert.equal(job.result.failures[0].workflowId,'invoices');assert.equal(f.closed(),1);
 for(const row of job.result.successes){const v=f.service.version(row.versionId);await f.service.approve(v.id,{sourceHash:v.sourceHash,resultHash:v.resultHash});assert.equal(v.status,'approved');}
 const failed=f.service.version(job.result.failures[0].versionId);await assert.rejects(f.service.approve(failed.id,{sourceHash:'0'.repeat(64),resultHash:'0'.repeat(64)}));
});
test('saved discovery without all specifications is recovered through live model roles only when build-all runs',async()=>{
 const f=await batchFixture();const wanted=f.service.state.discovery.specifications;delete f.service.state.discovery.specifications;
 const generate=f.model.generate;let calls=[];
 f.model.generate=async args=>{
  if(!['workflow-mapping','opportunity-specification'].includes(args.stage))return generate(args);
  calls.push(args.stage);const base=await fixture();const original=await base.model.generate(args);
  if(args.stage==='workflow-mapping')original.value.workflows.push(...wanted.slice(1).map(s=>({id:s.workflow,name:s.name,trigger:s.trigger,steps:s.actions,citations:s.citations})));
  else {original.value.specifications=wanted;original.value.opportunities.push(...wanted.slice(1).map((s,i)=>({...original.value.opportunities[0],id:`extra-${i}`,workflowId:s.workflow,name:s.name,difficulty:5,risk:5})));}
  return original;
 };
 const job=await f.run('build-all');assert.equal(job.result.successes.length,3);assert.deepEqual(calls,['workflow-mapping','opportunity-specification']);assert.equal(f.service.state.discovery.specifications.length,3);
});
test('restart classifies legacy versions and fork rows as onboarding without replacing approvals',async()=>{
 const f=await fixture();await f.run('discover');const built=await f.run('build');const v=f.service.version(built.result.versionId);await f.service.approve(v.id,{sourceHash:v.sourceHash,resultHash:v.resultHash});
 const saved=f.store.getCompany();delete saved.activeVersions;delete saved.latestCandidates;for(const row of saved.versions){delete row.workflowId;for(const fork of row.forks)delete fork.workflowId;}f.store.saveCompany(saved);
 const service=new CompanyService({store:f.store,model:f.model,disk:f.disk,sourceFiles:f.files});assert.equal(service.state.activeVersions.onboarding,v.id);assert.equal(service.state.versions[0].workflowId,'onboarding');assert.ok(service.state.versions[0].forks.every(row=>row.workflowId==='onboarding'));assert.equal(service.state.versions[0].status,'approved');
});
test('build-all rejects unsupported saved policy before creating versions or preparing forks',async()=>{
 const f=await batchFixture();const before=f.service.state.versions.length;
 await assert.rejects(f.service.buildAll({id:'policy-check'}, {...f.files,'policy_update.md':'Pay all invoices automatically.'}),error=>error.code==='unsupported_policy');
 assert.equal(f.service.state.versions.length,before);assert.equal(f.closed(),0);assert.equal(f.generations(),2);
});
