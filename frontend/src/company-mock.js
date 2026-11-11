/* UI MOCK ADAPTER for the Platyform hackathon app.
   Hand-written stand-in data, shown as "UI mock data" in the interface.
   It never calls a model or Archil. Used only with ?mock=1 or "Use UI mock data". */
(function () {
window.createPlatyMock = function (policy) {
  const POLICY = policy;
  const F = {};
  F['hubspot_deals.csv'] = [
    'deal_id,company,stage,value_usd,owner,close_date',
    'D-1001,Atlas Freight,Closed won,9500,Maya Chen,2026-09-02',
    'D-1002,Copperleaf Studio,Closed won,12500,Leo Park,2026-10-28',
    'D-1003,Northgate Clinics,Proposal,31000,Maya Chen,',
    'D-1004,Halcyon Foods,Closed won,18000,Priya Shah,2026-11-03',
    'D-1005,Bluebird Books,Lost,7200,Leo Park,2026-09-19',
    'D-1006,Summit Legal,Negotiation,26500,Maya Chen,',
    'D-1007,Brightline Dental,Closed won,8000,Priya Shah,2026-11-05',
    'D-1008,Kestrel Energy,Proposal,40000,Leo Park,',
    'D-1009,Fernway Outdoors,Closed won,6400,Maya Chen,2026-10-30',
    'D-1010,Quarry Hotels,Discovery,15000,Priya Shah,',
    'D-1011,Juniper Labs,Closed won,10000,Leo Park,2026-11-06',
    'D-1012,Redwood Realty,Lost,11800,Maya Chen,2026-10-02',
    'D-1013,Marlow & Pike,Closed won,22000,Priya Shah,2026-11-04',
    'D-1014,Vista Optics,Negotiation,13300,Leo Park,',
    'D-1015,Oakridge Pilates,Closed won,4800,Maya Chen,2026-11-07',
    'D-1016,Harbor Fitness,Discovery,9000,Priya Shah,',
    'D-1017,Ember Coffee Co,Proposal,7600,Leo Park,',
    'D-1018,Tidewater Coffee,Closed won,15500,Maya Chen,2026-11-08',
    'D-1019,Pinecrest Schools,Discovery,28000,Priya Shah,',
    'D-1020,Lumen Analytics,Negotiation,19500,Leo Park,',
  ].join('\n');
  F['slack_export.md'] = [
    '# #client-ops export (synthetic)',
    '',
    '**Maya Chen** 09:12: Copperleaf kicked off on Monday but we still do not have a signed SOW. Is that allowed?',
    '**Sam Ortiz** 09:15: Not per the SOP. I chased them twice by email. Third onboarding this month stuck on paperwork.',
    '**Leo Park** 09:20: I keep a spreadsheet of who sent what. It takes me about an hour every Monday to update it.',
    '**Sam Ortiz** 09:22: Same. I copy the checklist into a new doc for every client and tick it by hand.',
    '',
    '**Priya Shah** 11:40: Monthly reports are due Friday. Pulling numbers from four dashboards again.',
    '**Dana Lee** 11:44: I spent most of Thursday formatting the Halcyon report. The template breaks every time.',
    '',
    '**Ravi Kumar** 14:05: Reminder: invoices over $5k need a second pair of eyes before they go out.',
    '**Ravi Kumar** 14:06: Two went out last month without approval. Nobody noticed until the client queried them.',
    '',
    '**Sam Ortiz** 16:30: Fernway still has no billing contact. Kickoff is Friday. Do we start anyway?',
    '**Maya Chen** 16:33: Last time we started without one, the first invoice bounced for six weeks.',
  ].join('\n');
  F['onboarding_sop.md'] = [
    '# Client onboarding SOP (synthetic)',
    '',
    'Owner: Client Operations. Last reviewed: 2026-08-14.',
    '',
    '## Before kickoff',
    '1. Confirm the deal is Closed won in HubSpot.',
    '2. Collect the signed SOW.',
    '3. Collect brand assets (logo files, brand guide, tone of voice).',
    '4. Confirm a billing contact with an email address.',
    '5. Do not schedule kickoff until steps 2 to 4 are complete.',
    '',
    '## Kickoff',
    '6. Create the client folder from the template.',
    '7. Book the kickoff call with the account lead.',
    '8. Send the welcome pack and first-month timeline.',
    '',
    '## Notes',
    '- Missing documents are chased by email every two working days.',
    '- The client tracker is the source of truth for document status.',
  ].join('\n');
  F['client_tracker.csv'] = [
    'client_id,client,deal_id,contract_value,signed_sow,brand_assets,billing_contact,kickoff_target,status,notes',
    'C-101,Halcyon Foods,D-1004,18000,yes,yes,yes,2026-11-18,ready,',
    'C-102,Brightline Dental,D-1007,8000,yes,yes,yes,2026-11-20,ready,',
    'C-103,Juniper Labs,D-1011,10000,yes,yes,yes,2026-11-24,ready,',
    'C-104,Copperleaf Studio,D-1002,12500,no,yes,yes,2026-11-12,delayed,SOW sent Oct 30 and not signed',
    'C-105,Fernway Outdoors,D-1009,6400,yes,yes,no,2026-11-14,delayed,No billing contact after two chasers',
    'C-106,Marlow & Pike,D-1013,22000,yes,no,yes,2026-11-28,delayed,Brand assets promised next week',
    'C-107,Oakridge Pilates,D-1015,4800,yes,yes,yes,2026-12-02,ready,',
    'C-108,Tidewater Coffee,D-1018,15500,no,no,yes,2026-12-05,delayed,Waiting on legal review of SOW',
  ].join('\n');
  F['timesheets.csv'] = [
    'person,week,task,category,minutes',
    'Sam Ortiz,2026-W44,Chasing missing onboarding documents,onboarding,190',
    'Sam Ortiz,2026-W44,Copying onboarding checklist per client,onboarding,85',
    'Leo Park,2026-W44,Updating document tracker spreadsheet,onboarding,60',
    'Maya Chen,2026-W44,Kickoff rescheduling after missing documents,onboarding,75',
    'Priya Shah,2026-W44,Monthly client report assembly,reporting,240',
    'Dana Lee,2026-W44,Formatting monthly report template,reporting,210',
    'Ravi Kumar,2026-W44,Invoice approval checks,finance,95',
    'Sam Ortiz,2026-W45,Chasing missing onboarding documents,onboarding,170',
    'Leo Park,2026-W45,Updating document tracker spreadsheet,onboarding,55',
    'Priya Shah,2026-W45,Monthly client report assembly,reporting,60',
    'Ravi Kumar,2026-W45,Invoice approval checks,finance,80',
  ].join('\n');

  const hash = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return ('0000000' + h.toString(16)).slice(-8) + ('0000000' + (s.length * 2654435761 >>> 0).toString(16)).slice(-8); };
  const now = () => new Date().toISOString();
  const files0 = () => Object.keys(F).map(name => ({ name, content: F[name], sha256: 'mock-' + hash(F[name]) }));
  const cite = (file, snip) => { const src = (st.files.find(f => f.name === file) || {}).content || ''; const ls = src.split('\n'); const i = ls.findIndex(l => l.indexOf(snip) >= 0); return { file, line: i + 1, quote: i >= 0 ? ls[i].replace(/^\*\*[^*]+\*\* \d\d:\d\d: /, '').slice(0, 140) : snip }; };
  const clients = () => { const ls = F['client_tracker.csv'].split('\n'), H = ls[0].split(','); return ls.slice(1).map(l => { const v = l.split(','); const o = {}; H.forEach((h, i) => { o[h] = v[i] || ''; }); return { id: o.client_id, name: o.client, contract_value: Number(o.contract_value), signed_sow: o.signed_sow === 'yes', brand_assets: o.brand_assets === 'yes', billing_contact: o.billing_contact === 'yes' }; }); };
  const DOCS = [['signed_sow', 'signed SOW'], ['brand_assets', 'brand assets'], ['billing_contact', 'billing contact']];
  const CHECK = ['Create the client folder from the template', 'Book the kickoff call with the account lead', 'Send the welcome pack and first-month timeline'];
  const logic = (n, input) => {
    const c = clients().find(x => x.id === input.clientId); if (!c) { const e = new Error('Unknown client ' + String(input.clientId)); e.code = 'unknown_client'; e.status = 422; throw e; }
    const reasons = DOCS.filter(d => !c[d[0]]).map(d => 'Missing ' + d[1]);
    const needs = n >= 2 && c.contract_value > 10000;
    if (needs && !input.financeApproved) reasons.push('Finance approval required: contract is over $10,000');
    return { client: c.name, contractValue: c.contract_value, route: reasons.length ? 'blocked' : 'standard_onboarding', reasons, checklist: reasons.length ? [] : CHECK, financeApproval: n >= 2 ? (needs ? (input.financeApproved ? 'recorded' : 'required') : 'not required') : undefined };
  };
  const CASES1 = [['missing-sow', 'Missing signed SOW blocks onboarding', { clientId: 'C-104' }, 'blocked'], ['missing-billing', 'Missing billing contact blocks onboarding', { clientId: 'C-105' }, 'blocked'], ['complete-18k', 'Complete documents proceed ($18,000)', { clientId: 'C-101' }, 'standard_onboarding'], ['small-8k', '$8,000 client proceeds', { clientId: 'C-102' }, 'standard_onboarding']];
  const CASES2 = [['missing-sow', 'Missing signed SOW still blocks onboarding', { clientId: 'C-104', financeApproved: true }, 'blocked'], ['missing-billing', 'Missing billing contact still blocks onboarding', { clientId: 'C-105' }, 'blocked'],
    ['small-8k', '$8,000: original route remains available', { clientId: 'C-102' }, 'standard_onboarding'], ['exact-10k', 'Exactly $10,000: no Finance approval needed', { clientId: 'C-103' }, 'standard_onboarding'],
    ['big-no-approval', '$18,000 without Finance approval is blocked', { clientId: 'C-101' }, 'blocked'], ['big-approved', '$18,000 with Finance approval proceeds', { clientId: 'C-101', financeApproved: true }, 'standard_onboarding']];
  const runCases = (n, cases) => { const cs = cases.map(([id, name, input, exp]) => { const out = logic(n, input); return { id, name, passed: out.route === exp, expected: exp, actual: out.route }; }); const p = cs.filter(c => c.passed).length; return { summary: { total: cs.length, passed: p, failed: cs.length - p }, cases: cs }; };

  const py = n => [
    '"""Client onboarding check for Northstar Agency.',
    '',
    'UI MOCK DATA: written by hand for the frontend mock, not generated by a model.',
    '"""',
    '',
    'REQUIRED_DOCUMENTS = {',
    '    "signed_sow": "signed SOW",',
    '    "brand_assets": "brand assets",',
    '    "billing_contact": "billing contact",',
    '}',
  ].concat(n >= 2 ? ['', '# finance_policy.md: contracts over $10,000 need Finance approval.', 'FINANCE_APPROVAL_THRESHOLD = 10_000'] : []).concat([
    '',
    'CHECKLIST = [',
    '    "Create the client folder from the template",',
    '    "Book the kickoff call with the account lead",',
    '    "Send the welcome pack and first-month timeline",',
    ']',
    '',
    '',
    'def run(client: dict, finance_approved: bool = False) -> dict:',
    '    reasons = [f"Missing {label}" for key, label in REQUIRED_DOCUMENTS.items() if not client.get(key)]',
  ]).concat(n >= 2 ? [
    '    needs_finance = client["contract_value"] > FINANCE_APPROVAL_THRESHOLD',
    '    if needs_finance and not finance_approved:',
    '        reasons.append("Finance approval required: contract is over $10,000")',
  ] : []).concat([
    '    return {',
    '        "client": client["name"],',
    '        "route": "blocked" if reasons else "standard_onboarding",',
    '        "reasons": reasons,',
    '        "checklist": [] if reasons else CHECKLIST,',
  ]).concat(n >= 2 ? ['        "finance_approval": ("recorded" if finance_approved else "required") if needs_finance else "not required",'] : []).concat(['    }', '']).join('\n');
  const pytest = n => ['"""Tests for workflow.py. UI MOCK DATA, not generated."""', 'from workflow import run', '', 'CLIENTS = load_tracker("client_tracker.csv")', '']
    .concat((n >= 2 ? CASES2 : CASES1).map(([id, name, input, exp]) => '\ndef test_' + id.replace(/-/g, '_') + '():\n    """' + name + '"""\n    out = run(CLIENTS["' + input.clientId + '"]' + (input.financeApproved ? ', finance_approved=True' : '') + ')\n    assert out["route"] == "' + exp + '"')).join('\n') + '\n';
  const readme = n => ['# Client onboarding check (version ' + n + ')', '', '> UI mock data. Hand-written for the frontend mock, not generated.', '', 'Checks each new Northstar client against the onboarding SOP before kickoff:', '', '- signed SOW, brand assets and billing contact must be in the tracker', '- if anything is missing, onboarding is blocked with the reasons']
    .concat(n >= 2 ? ['- contracts over $10,000 need Finance approval (finance_policy.md); exactly $10,000 does not'] : []).concat(['', 'Sources: onboarding_sop.md, client_tracker.csv, slack_export.md, timesheets.csv', '']).join('\n');
  const app = n => {
    const data = JSON.stringify(clients().map(c => ({ id: c.id, name: c.name, value: c.contract_value })));
    return ['<!doctype html><html><head><meta charset="utf-8"><title>Client onboarding</title><style>',
      'body{margin:0;font:15px/1.5 system-ui,sans-serif;color:#262924;background:#fffefa;padding:20px}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 14px;color:#62665e;font-size:13.5px}',
      '.mock{display:inline-block;margin-bottom:12px;padding:2px 9px;border-radius:999px;background:#c94f1a;color:#fff;font-size:12px;font-weight:600}',
      'label{display:block;font-size:13px;font-weight:600;margin:10px 0 4px}select{width:100%;max-width:360px;height:38px;border:1px solid #8f8a80;border-radius:10px;padding:0 8px;font-size:14px;background:#fff}',
      '.chk{display:flex;gap:8px;align-items:center;font-weight:400}button{margin-top:14px;height:40px;padding:0 16px;border:none;border-radius:10px;background:#c94f1a;color:#fff;font-size:14px;font-weight:600;cursor:pointer}',
      '#out{margin-top:16px;padding:14px;border:1px solid #e9e5de;border-radius:12px;background:#f7f5f0;font-size:14px}.bad{color:#a8321f;font-weight:600}.ok{color:#3f5a2c;font-weight:600}ul{margin:6px 0 0;padding-left:18px}',
      '</style></head><body><span class="mock">UI mock data</span><h1>Client onboarding check</h1><p>Version ' + n + '. Pick a client to check them against the onboarding SOP' + (n >= 2 ? ' and the Finance policy' : '') + '.</p>',
      '<label for="c">Client</label><select id="c"></select>',
      n >= 2 ? '<label class="chk"><input type="checkbox" id="fa"> Finance approval recorded</label>' : '',
      '<button id="go">Run onboarding</button><div id="out" role="status">No run yet.</div>',
      '<\x73cript>',
      'var C=' + data + ';var s=document.getElementById("c");C.forEach(function(c){var o=document.createElement("option");o.value=c.id;o.textContent=c.name+" ($"+c.value.toLocaleString("en-US")+")";s.appendChild(o);});',
      'var out=document.getElementById("out"),pend=null;',
      'document.getElementById("go").onclick=function(){var id="r"+Date.now();pend=id;var fa=document.getElementById("fa");out.textContent="Running...";parent.postMessage({type:"platy:run",requestId:id,input:{clientId:s.value,financeApproved:fa?fa.checked:false}},"*");};',
      'window.addEventListener("message",function(e){if(e.source!==parent)return;var d=e.data||{};if(d.type!=="platy:result"||d.requestId!==pend)return;pend=null;out.textContent="";',
      'if(!d.ok){var b=document.createElement("div");b.className="bad";b.textContent="Could not run: "+d.error;out.appendChild(b);return;}',
      'var r=d.output,h=document.createElement("div");h.className=r.route==="blocked"?"bad":"ok";h.textContent=r.client+": "+(r.route==="blocked"?"blocked":"ready for onboarding");out.appendChild(h);',
      'var items=r.route==="blocked"?r.reasons:r.checklist;var ul=document.createElement("ul");items.forEach(function(t){var li=document.createElement("li");li.textContent=t;ul.appendChild(li);});out.appendChild(ul);',
      'if(r.financeApproval){var f=document.createElement("div");f.style.marginTop="8px";f.style.fontSize="13px";f.textContent="Finance approval: "+r.financeApproval;out.appendChild(f);}});',
      '<\/script></body></html>'].join('\n');
  };
  const mkVersion = (n, parentId) => {
    const files = { 'app.html': app(n), 'workflow.py': py(n), 'test_workflow.py': pytest(n), 'README.md': readme(n) };
    const tests = runCases(n, n >= 2 ? CASES2 : CASES1);
    const src = hash(JSON.stringify(files));
    return { id: 'mock-v' + n, number: n, parentVersionId: parentId || null, status: tests.summary.failed ? 'failed' : 'passed', generation: 'mock', sourceHash: 'mock-' + src, resultHash: 'mock-' + hash(JSON.stringify(tests)),
      files, tests, previousVersionTests: n >= 2 ? runCases(n - 1, CASES2) : null,
      attempts: n >= 2 ? [{ attempt: 1, summary: 'Fork A: added the Finance approval check. 6 of 6 tests passed, including the original document checks.', passed: true }]
        : [{ attempt: 1, summary: 'Fork B, first draft: 4 of 4 tests passed.', passed: true }],
      approval: null, diskId: 'ui-mock-disk-v' + n };
  };
  const PLANS = {
    discover: [[0, 'reading', 'Reading 5 source documents'], [900, 'reading', 'Read hubspot_deals.csv: 20 deals, 9 closed won'], [1800, 'reading', 'Read slack_export.md, onboarding_sop.md, client_tracker.csv and timesheets.csv'], [2900, 'mapping', 'Mapped 3 recurring workflows'], [3900, 'ranking', 'Ranked 3 opportunities'], [4800, 'specifying', 'Wrote a specification for the top opportunity']],
    build: [[0, 'forking', 'Forked the company disk into 3 sandboxes (UI mock)'], [900, 'generating', 'Each fork is writing workflow.py, app.html, test_workflow.py and README.md'], [3300, 'testing', 'Fork A: 3 of 4 tests passed. A missing billing contact was not blocked'], [4300, 'testing', 'Fork B: 4 of 4 tests passed'], [4900, 'testing', 'Fork C: 4 of 4 tests passed'], [5300, 'selecting', 'Picked Fork B: passing, smallest change set'], [5700, 'saving', 'Saved version 1 from Fork B']],
    evolve: [[0, 'reading', 'Added finance_policy.md to the company documents'], [900, 'detecting', 'New rule found: Finance approval for contracts over $10,000'], [1800, 'locating', 'Affected software: Client onboarding check, version 1'], [2800, 'testing', 'Ran version 1 against the new policy: 5 of 6 passed, 1 failed'], [3300, 'forking', 'Forked version 1 into 2 sandboxes (UI mock)'], [4600, 'testing', 'Fork A: 6 of 6 passed, including the original checks'], [5300, 'testing', 'Fork B: 5 of 6 passed. Dropped the brand assets check'], [5800, 'saving', 'Saved version 2 from Fork A. Version 1 is kept as it was']],
    run: [[0, 'executing', 'Running in this browser (UI mock, not Archil)'], [600, 'done', 'Finished']],
  };
  // Archil fork swarm (UI mock): candidate builds tried in parallel forks; [label, strategy, ms done, outcome, tests]
  const FORKS = {
    build: [['Fork A', 'Rule table over the tracker columns', 3300, 'failed', [3, 4], 'Missed the billing contact check'], ['Fork B', 'Checklist engine driven by the SOP', 4300, 'selected', [4, 4], 'All tests passed, smallest change set'], ['Fork C', 'Single function with inline checks', 4900, 'passed', [4, 4], 'Passed, but duplicates the SOP text']],
    evolve: [['Fork A', 'Patch version 1 with a Finance gate', 4600, 'selected', [6, 6], 'Kept every original check'], ['Fork B', 'Regenerate from the updated specification', 5300, 'failed', [5, 6], 'Dropped the brand assets check']],
  };
  const forksAt = (kind, id, el) => (FORKS[kind] || []).map((f, i) => ({ id: id + '-fork-' + (i + 1), label: f[0], strategy: f[1], diskId: 'ui-mock-fork-' + (i + 1), status: el < f[2] ? 'running' : f[3], tests: el < f[2] ? null : { passed: f[4][0], total: f[4][1] }, summary: el < f[2] ? '' : f[5] }));
  const st = { files: files0(), discovery: null, versions: [], jobs: [], keys: {}, active: null, candidate: null };
  const effects = {
    discover: () => {
      const t = now();
      const opps = [
        { id: 'opp-onboarding', workflowId: 'wf-onboarding', name: 'Client onboarding check', description: 'Account staff chase missing SOWs, brand assets and billing contacts by hand, and kickoffs start before the SOP allows.', difficulty: 2, risk: 2, monthlyHours: 34, score: 0.81,
          assumptions: ['UI mock data: hours, risk and score were typed in for the mock, not estimated.'], citations: [cite('onboarding_sop.md', 'Do not schedule kickoff'), cite('client_tracker.csv', 'C-104'), cite('slack_export.md', 'Third onboarding this month'), cite('timesheets.csv', 'Chasing missing onboarding documents')] },
        { id: 'opp-reporting', workflowId: 'wf-reporting', name: 'Monthly client reports', description: 'Reports are assembled from four dashboards and reformatted by hand each month.', difficulty: 3, risk: 1, monthlyHours: 29, score: 0.66,
          assumptions: ['UI mock data: figures are placeholders.'], citations: [cite('slack_export.md', 'Pulling numbers from four dashboards'), cite('timesheets.csv', 'Monthly client report assembly')] },
        { id: 'opp-invoices', workflowId: 'wf-invoices', name: 'Invoice approvals', description: 'Invoices over $5k need a second reviewer, and two went out last month without one.', difficulty: 2, risk: 3, monthlyHours: 7, score: 0.48,
          assumptions: ['UI mock data: figures are placeholders.'], citations: [cite('slack_export.md', 'invoices over $5k'), cite('timesheets.csv', 'Invoice approval checks')] },
      ];
      st.discovery = {
        context: { company: 'Northstar Agency', summary: 'UI mock data. A 30-person marketing agency: deals close in HubSpot, then Client Operations collects documents before kickoff.', citations: [cite('onboarding_sop.md', 'Owner: Client Operations'), cite('hubspot_deals.csv', 'D-1004')] },
        workflows: [
          { id: 'wf-onboarding', name: 'Client onboarding', trigger: 'Deal marked Closed won', steps: ['Collect signed SOW', 'Collect brand assets', 'Confirm billing contact', 'Book kickoff'], citations: [cite('onboarding_sop.md', 'Collect the signed SOW'), cite('onboarding_sop.md', 'Confirm a billing contact')] },
          { id: 'wf-reporting', name: 'Monthly reporting', trigger: 'Last Friday of the month', steps: ['Pull dashboard numbers', 'Fill the template', 'Format and send'], citations: [cite('slack_export.md', 'Monthly reports are due Friday')] },
          { id: 'wf-invoices', name: 'Invoice approval', trigger: 'Invoice drafted', steps: ['Draft invoice', 'Second review over $5k', 'Send'], citations: [cite('slack_export.md', 'second pair of eyes')] },
        ],
        opportunities: opps, selectedOpportunity: { id: opps[0].id, name: opps[0].name },
        specification: { workflow: 'wf-onboarding', name: 'Client onboarding check', trigger: 'A client is ready for kickoff', inputs: ['Client from client_tracker.csv', 'Finance approval, if recorded'],
          actions: ['Check the signed SOW, brand assets and billing contact', 'Block onboarding and list what is missing', 'Otherwise return the kickoff checklist from the SOP'],
          successCriteria: ['Clients missing any document are blocked', 'Complete clients get the SOP kickoff checklist'], approvalRequired: false,
          sourceFiles: ['onboarding_sop.md', 'client_tracker.csv'], citations: [cite('onboarding_sop.md', 'Do not schedule kickoff')] },
        receipts: [{ provider: 'ui-mock', model: 'none', live: false, startedAt: t, completedAt: t }] };
      return { opportunities: opps.length };
    },
    build: () => { const v = mkVersion(1); st.versions = [v]; st.active = v.id; st.candidate = v.id; return { versionId: v.id }; },
    evolve: () => {
      st.files = st.files.concat([{ name: 'finance_policy.md', content: '# Finance policy (synthetic)\n\nAdded by you in Platyform.\n\n' + POLICY + '\n', sha256: 'mock-' + hash(POLICY) }]);
      const prev = st.versions[st.versions.length - 1]; const v = mkVersion(prev.number + 1, prev.id); st.versions = st.versions.concat([v]); st.candidate = v.id; return { versionId: v.id };
    },
  };
  const view = j => {
    const plan = PLANS[j.kind], el = Date.now() - j.t0, total = plan[plan.length - 1][0] + 400;
    const evs = plan.filter(p => p[0] <= el).map((p, i) => ({ sequence: i + 1, at: new Date(j.t0 + p[0]).toISOString(), message: p[2] }));
    if (el >= total && j.status !== 'completed' && j.status !== 'failed') {
      try { j.result = j.kind === 'run' ? j.result : effects[j.kind](); j.status = 'completed'; } catch (e) { j.status = 'failed'; j.error = { code: e.code || 'mock_error', message: e.message }; }
      j.completedAt = new Date(j.t0 + total).toISOString();
    } else if (el < total) j.status = el < 150 ? 'queued' : 'running';
    const cur = plan.filter(p => p[0] <= el); return { forks: forksAt(j.kind, j.id, el), id: j.id, kind: j.kind, status: j.status, stage: j.status === 'completed' ? 'done' : (j.status === 'failed' ? 'failed' : (cur[cur.length - 1] || plan[0])[1]), events: evs, createdAt: j.createdAt, completedAt: j.completedAt || null, result: j.status === 'completed' ? j.result : null, error: j.error || null };
  };
  const ws = () => ({ company: { id: 'northstar', name: 'Northstar Agency', synthetic: true }, files: st.files, disk: { id: 'ui-mock-disk', region: 'UI mock (no Archil)' }, discovery: st.discovery, versions: st.versions, jobs: st.jobs.map(view),
    activeVersionId: st.active, latestCandidateId: st.candidate, capabilities: { model: 'UI mock data', modelAvailable: false, archilAvailable: false } });
  const fail = (status, code, message) => { const e = new Error(message); e.status = status; e.code = code; throw e; };
  const route = (method, path, body) => {
    if (method === 'GET' && path === '/api/company') return ws();
    let m = /^\/api\/company\/jobs\/([^/]+)$/.exec(path);
    if (method === 'GET' && m) { const j = st.jobs.find(x => x.id === decodeURIComponent(m[1])); if (!j) fail(404, 'job_not_found', 'No such job.'); return { job: view(j) }; }
    m = /^\/api\/company\/versions\/([^/]+)(\/approve)?$/.exec(path);
    if (m) { const v = st.versions.find(x => x.id === decodeURIComponent(m[1])); if (!v) fail(404, 'version_not_found', 'No such version.');
      if (method === 'GET' && !m[2]) return { version: v };
      if (method === 'POST' && m[2]) { if (v.status !== 'passed') fail(409, 'not_passing', 'Only a passing version can be approved.'); if (!body || body.sourceHash !== v.sourceHash || body.resultHash !== v.resultHash) fail(409, 'hash_mismatch', 'The hashes do not match the tested version.');
        v.approval = { simulated: true, deployed: false, at: now() }; v.status = 'approved'; st.active = v.id; return { version: v }; } }
    m = /^\/api\/company\/(discover|build|evolve|run)$/.exec(path);
    if (method === 'POST' && m) {
      const kind = m[1]; if (!body || typeof body.requestKey !== 'string') fail(400, 'missing_request_key', 'requestKey is required.');
      if (st.keys[body.requestKey]) return { job: view(st.jobs.find(x => x.id === st.keys[body.requestKey])) };
      if (kind !== 'run' && st.jobs.some(x => x.kind === kind && (view(x).status === 'running' || view(x).status === 'queued'))) fail(409, 'job_running', 'That job is already running.');
      if (kind === 'build' && !st.discovery) fail(409, 'no_discovery', 'Run discovery first.');
      if (kind === 'evolve' && !st.versions.length) fail(409, 'no_version', 'Build a version first.');
      if (kind === 'evolve' && (!body.policyText || !body.policyText.trim())) fail(400, 'missing_policy', 'policyText is required.');
      const j = { id: 'mock-job-' + (st.jobs.length + 1), kind, status: 'queued', t0: Date.now(), createdAt: now(), completedAt: null, result: null, error: null };
      if (kind === 'run') { const v = st.versions.find(x => x.id === body.versionId); if (!v) fail(404, 'version_not_found', 'No such version.'); const t = performance.now(); const output = logic(v.number, body.input || {}); j.result = { output, execution: { runner: 'UI mock, in this browser', archil: false, durationMs: Math.round((performance.now() - t) * 1000) / 1000 } }; }
      st.jobs.push(j); st.keys[body.requestKey] = j.id; return { job: view(j) };
    }
    fail(404, 'not_found', method + ' ' + path + ' is not part of the mock.');
  };
  return { handle: (method, path, body) => new Promise((res, rej) => setTimeout(() => { try { res(JSON.parse(JSON.stringify(route(method, path, body)))); } catch (e) { rej(e); } }, 120)) };
  };
})();
