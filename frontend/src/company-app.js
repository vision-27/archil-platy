import './platform.css';
import './company-mock.js';
/* Platyform: Platy Builds Platy (Archil hackathon).
   The backend owns discovery, generation, Archil execution, tests, versions and approval.
   This page triggers those operations and shows what the backend returns. */
(function () {
  'use strict';
  const POLICY = 'All clients with contracts over $10,000 must receive Finance approval before onboarding can proceed.';
  const RUN_CAP = 10;
  const STORE = 'platy-platform-v2';
  const STAGES = [['company','Connections'],['discover','Discoveries'],['build','Workflows'],['impact','Impact']];
  const IMG = n => 'img/' + n + '.png';

  /* ---------- state ---------- */
  const q = {}; try { new URLSearchParams(location.search).forEach((v, k) => { q[k] = v; }); } catch (e) {}
  let sv = {}; try { sv = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) {}
  const api0 = String(q.api != null ? q.api : (sv.api || '')).trim().replace(/\/+$/, '');
  const mode0 = q.mock === '1' ? 'mock' : 'live';
  const keep = sv.mode === mode0;
  const S = { mode: mode0, api: api0, conn: 'idle', connErr: '', connOpen: false, ws: null,
    jobs: keep ? (sv.jobs || {}) : {}, pend: keep ? (sv.pend || {}) : {}, forks: keep ? (sv.forks || {}) : {}, lost: {}, errs: {}, starting: {}, vers: {},
    viewVer: keep ? (sv.viewVer || null) : null, stage: (keep && sv.stage) || 'company', workflowOpen: keep ? !!sv.workflowOpen : false, doc: null, file: 'workflow.py', diffFile: null, oppId: null,
    connected: keep ? !!sv.connected : false, autoBuild: keep ? !!sv.autoBuild : false, evidence: null, compareCase: 'high-value', showPolicy: false, interactive: false, runs: 0, runBusy: false, runNote: '', lastExec: null, approving: false, pollErr: '', toast: '' };
  let mock = null;

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ api: S.api, mode: S.mode, viewVer: S.viewVer, stage: S.stage, workflowOpen: S.workflowOpen, connected: S.connected, autoBuild: S.autoBuild, pend: S.pend, forks: S.forks,
      jobs: Object.keys(S.jobs).reduce((o, k) => { const j = S.jobs[k]; if (j && k !== 'run') o[k] = { id: j.id, kind: j.kind, status: j.status, createdAt: j.createdAt }; return o; }, {}) })); } catch (e) {}
  }
  function set(p) { Object.assign(S, typeof p === 'function' ? p(S) : p); save(); render(); }
  const upd = (k, kind, v) => Object.assign({}, S[k], { [kind]: v });
  let toastT; function toast(m) { clearTimeout(toastT); set({ toast: m }); toastT = setTimeout(() => set({ toast: '' }), 2800); }
  function uuid() { try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) {} return 'rk-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12); }

  /* ---------- requests ---------- */
  async function req(method, path, body) {
    if (S.mode === 'mock') { mock = mock || window.createPlatyMock(POLICY); return mock.handle(method, path, body); }
    const opt = { method, headers: {} };
    if (method !== 'GET') { opt.headers['Content-Type'] = 'application/json'; opt.headers['X-Platy-Demo'] = '1'; opt.body = JSON.stringify(body || {}); }
    let res;
    try { res = await fetch((S.api || '') + path, opt); } catch (e) { const er = new Error('Could not reach the backend at ' + (S.api || 'this site') + '.'); er.lost = true; throw er; }
    const txt = await res.text(); let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) {}
    if (!res.ok) { const x = (data && data.error) || {}; const er = new Error(x.message || ('The backend returned ' + res.status + '.')); er.code = x.code || ('http_' + res.status); er.status = res.status; throw er; }
    if (data == null) { const er = new Error('The backend did not send JSON for ' + path + '.'); er.code = 'bad_response'; throw er; }
    return data;
  }
  async function load(quiet) {
    if (!quiet) set({ conn: 'checking', connErr: '' });
    try {
      const r = await req('GET', '/api/company'); const ws = r.workspace || r;
      if (!ws || !ws.company || !Array.isArray(ws.files)) throw new Error('GET /api/company did not return a workspace.');
      set({ ws, conn: 'ok', connErr: '' }); afterWs(ws);
    } catch (e) { if (!quiet) set({ conn: 'error', connErr: e.message, connOpen: true }); }
  }
  function afterWs(ws) {
    const jobs = Object.assign({}, S.jobs), t = j => Date.parse((j && j.createdAt) || 0) || 0;
    (ws.jobs || []).forEach(j => { if (j.kind === 'run') return; const c = jobs[j.kind]; if (!c || c.id === j.id || t(j) > t(c)) jobs[j.kind] = j; });
    Object.keys(jobs).forEach(k => { const j = jobs[k]; if (k !== 'run' && j && (j.status === 'queued' || j.status === 'running' || !j.events)) poll(j.id); });
    const vs = ws.versions || [];
    const vid = S.viewVer && vs.some(v => v.id === S.viewVer) ? S.viewVer : (ws.latestCandidateId || ws.activeVersionId || (vs.length ? vs[vs.length - 1].id : null));
    set({ jobs, viewVer: vid });
    if (S.autoBuild && ws.discovery && !vs.some(v => v.workflowId === 'reporting') && !running(jobs.discover) && !running(jobs['build-all'])) { set({ autoBuild: false, stage: 'build' }); start('build-all'); }
    if (vid) fetchVer(vid);
    vs.forEach(v => { if (v.parentVersionId && !(S.vers[v.parentVersionId] || {}).files) fetchVer(v.parentVersionId); });
  }
  async function fetchVer(id) {
    try { const r = await req('GET', '/api/company/versions/' + encodeURIComponent(id)); set({ vers: Object.assign({}, S.vers, { [id]: r.version || r }) }); }
    catch (e) { set({ errs: upd('errs', 'ver', e.message) }); }
  }
  function ver(id) { if (!id) return null; const a = ((S.ws && S.ws.versions) || []).find(v => v.id === id), b = S.vers[id]; return a || b ? Object.assign({}, b || {}, a || {}) : null; }
  async function start(kind, extra, onDone) {
    const cur = S.jobs[kind];
    if (kind !== 'run' && running(cur)) return null;
    if (S.starting[kind]) return null;
    if (S.mode !== 'mock' && S.conn !== 'ok') { toast('Connect the backend first, or use UI mock data.'); set({ connOpen: true }); return null; }
    const key = S.pend[kind] || uuid();
    set({ pend: upd('pend', kind, key), lost: upd('lost', kind, false), errs: upd('errs', kind, null), starting: upd('starting', kind, true) });
    try {
      const r = await req('POST', '/api/company/' + kind, Object.assign({ requestKey: key }, extra || {}));
      const job = r.job || r; if (!job || !job.id) throw new Error('The backend accepted the request but sent no job.');
      const p = Object.assign({}, S.pend); delete p[kind];
      set({ pend: p, starting: upd('starting', kind, false), jobs: upd('jobs', kind, job) });
      poll(job.id, onDone); return job;
    } catch (e) {
      const p = Object.assign({}, S.pend); if (!e.lost) delete p[kind];
      set({ pend: p, starting: upd('starting', kind, false), lost: upd('lost', kind, !!e.lost), errs: upd('errs', kind, e.message) });
      if (onDone) onDone(null, e); return null;
    }
  }
  const polls = {};
  function poll(id, onDone) {
    if (polls[id]) return;
    const tick = async () => {
      let job;
      try { const r = await req('GET', '/api/company/jobs/' + encodeURIComponent(id)); job = r.job || r; }
      catch (e) {
        if (e.status === 404) { delete polls[id]; set({ pollErr: 'The backend no longer has job ' + id + '.' }); if (onDone) onDone(null, e); return; }
        set({ pollErr: e.message }); polls[id] = setTimeout(tick, 2000); return;
      }
      set({ pollErr: '', jobs: upd('jobs', job.kind, job) });
      if ([...(job.versionIds || []), ...(job.versionId ? [job.versionId] : [])].some(id => !S.ws?.versions?.some(v => v.id === id))) load(true);
      if (running(job)) { polls[id] = setTimeout(tick, 1000); return; }
      delete polls[id];
      if (onDone) onDone(job); else done(job);
    };
    polls[id] = setTimeout(tick, 0);
  }
  function done(job) {
    const ok = job.status === 'completed', vid = job.result && (job.result.versionId || job.result.versionIds?.[0]);
    const name = { discover: 'Discovery', build: 'Build', 'build-all': 'Workflow builds', evolve: 'Update' }[job.kind] || 'Job';
    if (vid && Array.isArray(job.forks) && job.forks.length) set({ forks: Object.assign({}, S.forks, { [vid]: job.forks }) });
    if (vid) set({ viewVer: vid, stage: 'build', interactive: false, runs: 0, runNote: '', diffFile: null });
    if (!ok && job.kind === 'discover') set({ autoBuild: false });
    toast(ok ? name + ' finished.' : name + ' ' + job.status + '. ' + ((job.error && job.error.message) || ''));
    load(true); if (vid) fetchVer(vid);
  }
  const running = j => !!j && (j.status === 'queued' || j.status === 'running');
  function approve(V) {
    if (!V || V.status !== 'passed' || !V.tests || V.tests.summary.failed || V.approval) return;
    set({ approving: true, errs: upd('errs', 'approve', null) });
    req('POST', '/api/company/versions/' + encodeURIComponent(V.id) + '/approve', { sourceHash: V.sourceHash, resultHash: V.resultHash })
      .then(r => { set({ approving: false, stage: 'impact', vers: Object.assign({}, S.vers, { [V.id]: r.version || r }) }); toast('Released to demo production. Business actions remain simulated.'); load(true); })
      .catch(e => { set({ approving: false, errs: upd('errs', 'approve', e.message) }); });
  }
  function switchMode(mode, api) {
    Object.keys(polls).forEach(k => { clearTimeout(polls[k]); delete polls[k]; });
    mock = null; frame = null;
    set({ mode, api: api != null ? api : S.api, conn: 'idle', connErr: '', ws: null, jobs: {}, pend: {}, forks: {}, lost: {}, errs: {}, starting: {}, vers: {}, viewVer: null, stage: 'company', doc: null, oppId: null, interactive: false, runs: 0, runNote: '', lastExec: null, connOpen: false });
    load();
  }

  /* ---------- preview bridge ---------- */
  let frame = null;
  function syncPreview() {
    const host = document.getElementById('preview-host'); if (!host) return;
    const V = ver(S.viewVer), html = V && V.files && V.files['app.html'];
    const key = S.mode + ':' + (V ? V.id : '') + ':' + (S.mode === 'mock' ? (html ? html.length : 0) : (V ? 1 : 0));
    if (host.getAttribute('data-key') === key) return;
    host.setAttribute('data-key', key); host.innerHTML = ''; frame = null;
    if (!V || (S.mode === 'mock' && !html)) { host.innerHTML = '<div class="preview-empty">' + (V ? 'Loading the app…' : 'No software yet. Build it first.') + '</div>'; return; }
    const fr = document.createElement('iframe');
    fr.setAttribute('sandbox', 'allow-scripts'); fr.setAttribute('referrerpolicy', 'no-referrer');
    fr.setAttribute('title', 'Generated app, version ' + V.number); fr.setAttribute('data-ver', V.id);
    if (S.mode === 'mock') fr.srcdoc = html; else fr.src = (S.api || '') + '/api/company/versions/' + encodeURIComponent(V.id) + '/preview';
    host.appendChild(fr); frame = fr;
  }
  window.addEventListener('message', ev => {
    const fr = frame; if (!fr || !fr.contentWindow || ev.source !== fr.contentWindow) return;
    const d = ev.data; if (!d || typeof d !== 'object' || d.type !== 'platy:run') return;
    const rid = d.requestId; if (typeof rid !== 'string' || !rid || rid.length > 100) return;
    const reply = m => { try { fr.contentWindow.postMessage(Object.assign({ type: 'platy:result', requestId: rid }, m), '*'); } catch (e) {} };
    let input = d.input, size = Infinity; try { size = JSON.stringify(input).length; } catch (e) {}
    if (!input || typeof input !== 'object' || Array.isArray(input) || size > 4000) return reply({ ok: false, error: 'Platyform only forwards a small JSON object as input.' });
    if (!S.interactive) { set({ runNote: 'The app asked to run. Turn on the interactive preview to allow it.' }); return reply({ ok: false, error: 'Interactive preview is off. Turn it on in Platyform first.' }); }
    if (S.runBusy) return reply({ ok: false, error: 'Another run is still going.' });
    if (S.runs >= RUN_CAP) return reply({ ok: false, error: 'Run limit reached for this version (' + RUN_CAP + '). Switch versions to reset it.' });
    const vid = fr.getAttribute('data-ver'); if (!vid || vid !== S.viewVer) return reply({ ok: false, error: 'This preview is out of date.' });
    input = JSON.parse(JSON.stringify(input));
    const t0 = Date.now(), n = (ver(vid) || {}).number;
    set({ runBusy: true, runs: S.runs + 1, runNote: 'Running version ' + n + ' on the backend…' });
    start('run', { versionId: vid, input }, (job, err) => {
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      if (!job) { set({ runBusy: false, runNote: 'Run failed: ' + (err ? err.message : 'no job') }); return reply({ ok: false, error: err ? err.message : 'The run could not start.' }); }
      if (job.status === 'completed' && job.result) { load(true); set({ runBusy: false, lastExec: { at: job.completedAt, versionId: vid, output: job.result.output, execution: job.result.execution || null }, runNote: 'Version ' + n + ' ran in ' + secs + ' s. ' + (RUN_CAP - S.runs) + ' runs left.' }); return reply({ ok: true, output: job.result.output }); }
      const msg = (job.error && job.error.message) || ('Run ' + job.status + '.'); set({ runBusy: false, runNote: 'Run failed: ' + msg }); reply({ ok: false, error: msg });
    });
  });

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const glyphs = {
    company:'M7 7h10v10H7z M9 3v4m6-4v4M9 17v4m6-4v4M3 9h4m-4 6h4m10-6h4m-4 6h4',
    discover:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',
    build:'M4 5h5v5H4z M15 14h5v5h-5z M15 4h5v5h-5z M9 7h6M7 10v6h8',
    impact:'M4 20V10m7 10V4m7 16v-7M3 20h18',
    check:'m5 12 4 4L19 6', arrow:'M4 12h16m-6-6 6 6-6 6', lock:'M6 10h12v10H6z M8 10V7a4 4 0 0 1 8 0v3',
    clock:'M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    file:'M6 3h8l4 4v14H6z M14 3v5h4M9 12h6m-6 4h6', close:'m6 6 12 12M6 18 18 6',
    report:'M5 3h14v18H5z M8 7h8m-8 4h8m-8 4h5', invoice:'M6 3h12v18l-3-2-3 2-3-2-3 2z M9 7h6m-6 4h6',
    play:'m8 4 12 8-12 8z', cloud:'M7 18h11a4 4 0 0 0 0-8 6 6 0 0 0-12-1 4.5 4.5 0 0 0 1 9',
    users:'M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21v-3a5 5 0 0 1 10 0v3m4-17a4 4 0 0 1 0 8m0 3a5 5 0 0 1 5 5',
    pause:'M8 5v14M16 5v14'
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${glyphs[name] || glyphs.build}"/></svg>`;
  const button = (act, label, style = '', arg = '', disabled = false) => `<button type="button" class="btn ${style}" data-act="${act}"${arg ? ` data-arg="${esc(arg)}"` : ''}${disabled ? ' disabled' : ''}>${label}</button>`;
  const badge = (text, tone = '') => `<span class="status ${tone}"><i></i>${esc(text)}</span>`;
  const statusText = status => ({completed:'Ready to proceed',needs_finance_approval:'Waiting for Finance',needs_documents:'Waiting for documents',skipped:'Not eligible',needs_review:'Needs human review',needs_approval:'Waiting for approval',ready_for_finance:'Ready for Finance',draft_ready:'Draft ready for review',needs_exports:'Waiting for exports',needs_po:'Purchase order missing',mismatch:'Purchase order mismatch',ready:'Ready',approved:'Released (simulated)',passed:'Ready to review',candidate:'Building',failed:'Needs attention',running:'Building',queued:'Queued',interrupted:'Interrupted',selected:'Ready to review',needs_discrepancy_review:'Attribution review needed',needs_account_lead_approval:'Waiting for account lead',needs_purchase_order:'Waiting for purchase order',needs_match_review:'Purchase order mismatch',needs_budget_owner:'Budget owner needed',needs_budget_owner_approval:'Waiting for budget owner'}[status] || String(status || 'Not tested').replaceAll('_',' '));
  const family = version => version?.workflowId || 'onboarding';
  const workflowNames = {onboarding:'Client onboarding',reporting:'Monthly reporting',invoices:'Invoice approvals'};
  const workflowIcons = {onboarding:'users',reporting:'report',invoices:'invoice'};
  const clock = at => at ? new Date(at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
  const completed = v => v && ['passed','approved'].includes(v.status);
  const passing = v => completed(v) && v.tests?.summary?.failed === 0;
  function model() {
    const W = S.ws, D = W?.discovery, vs = (W?.versions || []).map(v => ver(v.id)).sort((a,b) => a.number-b.number);
    const latest = Object.fromEntries(['onboarding','reporting','invoices'].map(id => [id, vs.filter(v => family(v) === id).at(-1)]));
    const active = {...(W?.activeVersions || {})}; if (!active.onboarding && W?.activeVersionId) active.onboarding = W.activeVersionId;
    const jobs = S.jobs, busy = Object.values(jobs).some(running) || Object.values(S.starting).some(Boolean);
    const batch = jobs['build-all'];
    const chosen = vs.find(v => v.id === S.viewVer) || latest.onboarding || vs.at(-1);
    return {W,D,vs,latest,active,jobs,busy,batch,chosen,opps:D?.opportunities || [],live:S.mode!=='mock'};
  }
  function errors() {
    const messages = [...new Set([...Object.values(S.errs), S.pollErr, S.conn === 'error' ? S.connErr : ''].filter(Boolean))];
    return messages.map(message => `<div class="error" role="alert">${esc(message)} ${button('refresh','Refresh','text')}</div>`).join('');
  }
  function sidebar(M) {
    return `<div class="brand"><img src="/img/logo.png" alt="">Platyform</div><div class="workspace-switch"><span class="avatar">${esc((M.W?.company.name || 'Workspace')[0])}</span><div><b>${esc(M.W?.company.name || 'Your workspace')}</b><p>Company workspace</p></div></div><p class="nav-label">Workspace</p><nav>${STAGES.map(([id,label]) => `<button class="nav-item ${S.stage === id || (id === 'build' && S.stage === 'run') ? 'active' : ''}" data-act="stage" data-arg="${id}"${S.stage === id ? ' aria-current="page"' : ''}>${icon(id)}<span>${label}</span>${id === 'discover' && M.opps.length ? `<span class="count">${M.opps.length}</span>`:''}</button>`).join('')}</nav><div class="sidebar-foot"><p><span class="agent-dot"></span>${M.busy ? 'Platy is working' : 'Platy is ready'}</p><div class="sample"><img src="/img/reading.png" alt="Platy"><div><b class="small">${M.live ? 'Sample company' : 'UI mock mode'}</b><p>Explore with synthetic data</p></div></div></div>`;
  }
  function header(M) {
    const title = S.stage === 'run' ? 'Generated app' : STAGES.find(([id]) => id === S.stage)?.[1] || 'Workspace';
    return `<div class="crumb"><span>Workspace</span><span>/</span><b>${title}</b></div><div class="topmeta">${M.busy ? badge('Agents working') : M.D ? badge('Saved results','neutral') : ''}<span>${S.conn === 'ok' ? 'Backend connected' : S.conn === 'error' ? 'Connection unavailable' : 'Connecting…'}</span><span class="avatar">N</span></div>`;
  }
  const head = (label,title,subtitle,action='') => `<div class="page-head"><div><div class="eyebrow">${label}</div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`;
  const section = (title,meta='') => `<div class="section-label"><h2>${title}</h2><span>${meta}</span></div>`;
  function connections(M) {
    const sources = M.W?.files || [], loaded = S.connected;
    const groups = [
      {name:'HubSpot',kind:'hubspot',mark:'H',detail:'Deals, clients and sales handoffs',files:sources.filter(f=>f.name.includes('hubspot'))},
      {name:'Slack',kind:'slack',mark:'#',detail:'How your team actually works',files:sources.filter(f=>f.name.includes('slack'))},
      {name:'Company documents',kind:'docs',mark:'D',detail:'Procedures, policies and business rules',files:sources.filter(f=>f.name.endsWith('.md')&&!f.name.includes('slack'))},
      {name:'Operations tracker',kind:'sheets',mark:'▦',detail:'Client progress and missing information',files:sources.filter(f=>f.name.includes('tracker'))},
      {name:'Team timesheets',kind:'sheets',mark:'◷',detail:'Where your team spends its time',files:sources.filter(f=>f.name.includes('timesheet'))}
    ];
    return head('Your company, connected','Give Platy the bigger picture.','Bring your systems together. Platy finds the work between them.') +
      `<div class="intro"><div class="copy"><h2>${loaded ? 'Your company context is ready.' : 'Connect once. Let Platy do the finding.'}</h2><p>${loaded ? 'Platy can trace processes across your company and turn the right opportunities into working software.' : 'Start with Northstar’s sample exports. Discovery and builds use real agents and Archil; no live accounts are connected.'}</p>${button(loaded?'stage':'connect',loaded?'See discoveries '+icon('arrow'):M.D?'Connect sample systems '+icon('arrow'):'Connect & start agents '+icon('arrow'),'primary',loaded?'discover':'',M.busy || S.conn!=='ok')}</div><img src="/img/reading.png" alt="Platy reading company context"></div>` +
      section('Your systems',`${groups.filter(g=>g.files.length).length} sample sources`) + `<div class="connector-grid">${groups.map(g=>`<article class="panel connector"><div class="connector-top"><div class="system-mark ${g.kind}">${g.mark}</div>${badge(loaded?'Sample connected':'Sample export',loaded?'':'neutral')}</div><div><h3>${g.name}</h3><p>${g.detail}</p></div><div class="connector-foot"><span>${g.files.length} ${g.files.length===1?'document':'documents'}</span>${button('source',icon('arrow'),'text',g.files[0]?.name || '',!g.files.length)}</div></article>`).join('')}</div><p class="subtle-note">These connections load the supplied company snapshots. No OAuth or access to real business accounts.</p>`;
  }
  function discoveries(M) {
    const discoveryJob = M.jobs.discover;
    if (!M.D) return head('Discovery','Finding the work worth doing.','Platy reads across your sources, maps recurring processes and checks the evidence.') + `<div class="panel">${[['Company mapper','Reading systems and reconstructing workflows'],['Opportunity analyst','Identifying repetitive work and ranking the opportunity']].map(([name,text],i)=>`<div class="agent-line"><span class="agent-orb">${icon('discover')}</span><div><b>${name}</b><p>${text}</p></div>${badge(running(discoveryJob)?(i?'Queued / analyzing':'Working'):'Ready',running(discoveryJob)?'':'neutral')}</div>`).join('')}</div>${running(discoveryJob)?`<p class="pending"><i class="pulse"></i>${esc(discoveryJob.events?.at(-1)?.message || 'Reading company context…')}</p>`:`<div class="intro"><div class="copy"><h2>Start with your connected sources.</h2><p>Agents will discover opportunities, then build three workflows automatically.</p>${button('connect','Start discovery & builds','primary','',M.busy || S.conn!=='ok')}</div><img src="/img/working.png" alt=""></div>`}`;
    const hasPortfolio = M.latest.reporting && M.latest.invoices;
    return head('Company intelligence','Good work is hiding in the gaps.',`Platy found ${M.opps.length} opportunities across your connected sources.`,button('buildAll',hasPortfolio?'Rebuild workflows':'Build all workflows '+icon('arrow'),'primary','',M.busy)) +
      `<div class="panel">${M.opps.map((o,i)=>`<article class="opportunity ${i===0?'selected':''}"><div class="symbol">${icon(['users','report','invoice'][i]||'build')}</div><div><div class="row"><h3>${esc(o.name)}</h3>${i===0?badge('Highest priority'):''}</div><p>${esc(o.description)}</p><button class="source-link" data-act="opportunity" data-arg="${esc(o.id)}">${o.citations?.length || 0} supporting sources</button></div><div class="metric"><b>${Number(o.monthlyHours || 0)}<span class="small"> h/mo</span></b><small>Current manual effort</small></div>${button('opportunity','Explore '+icon('arrow'),'text',o.id)}</article>`).join('')}</div>`+
      `<div class="agent-message"><img src="/img/clipboard.png" alt=""><div><b>PLATY · OPPORTUNITY ANALYST</b><p>These processes have clear rules and repeated handoffs. I can build them in parallel, test each separately, and leave the release decisions to you.</p></div></div><p class="subtle-note">Effort is calculated from the sample timesheets, adjusted for complexity and risk when ranking. It is not measured time saved.</p>`;
  }
  function forkCard(row, version, index) {
    const id = version ? family(version) : row?.workflowId;
    const status = version?.status === 'candidate' && ['passed','selected'].includes(row?.status) ? 'running' : row?.status || version?.status || 'queued';
    const tests = version?.tests?.summary || row?.tests;
    const good = tests && tests.failed === 0;
    const name = workflowNames[id] || row?.workflowName || row?.label || 'Workflow';
    const descriptions = {onboarding:'Turn a closed deal into a prepared client workspace.',reporting:'Prepare reports and route discrepancies for review.',invoices:'Match purchase orders and route approved invoices to Finance.'};
    return `<article class="fork-card ${passing(version)?'selected':''}" data-workflow="${esc(id || '')}"><div class="fork-head"><h3><span class="fork-number">${index+1}</span>${esc(name)}</h3>${badge(version?.approval?'Released':running({status})?'Building':statusText(status),version?.approval?'dark':status==='failed'?'bad':good?'':'neutral')}</div><p>${esc(descriptions[id] || 'Building an independently tested workflow.')}</p><div class="progress"><div style="width:${tests?Math.round(tests.passed/Math.max(tests.total,1)*100):0}%"></div></div><div class="fork-foot"><span>${tests?`${tests.passed}/${tests.total} checks passed`:row?.stage?esc(row.stage.replaceAll('-',' ')):'Waiting to build'}</span>${version?button('workflow','Review '+icon('arrow'),'text',version.id):''}</div></article>`;
  }
  function workflowList(M) {
    const rows = M.batch?.forks || [];
    return head('Your workflow studio','From opportunity to working software.','Three workflows. Three Archil forks. Each built, tested and reviewed independently.',button('buildAll',M.latest.reporting?'Rebuild workflows':'Build three workflows '+icon('arrow'),'primary','',M.busy||!M.D)) +
      `${!M.D?`<div class="panel empty"><img src="/img/clipboard.png" alt=""><h2>First, let Platy get to know your company.</h2><p>Connect the sample systems to discover the workflows worth building.</p>${button('stage','Connect systems','primary','company')}</div>`:`<div class="row between" style="margin-bottom:18px"><span class="small muted">${M.busy?'Agents are building in parallel':'Your latest workflow builds'}</span>${badge('Powered by Archil','neutral')}</div><div class="forks-grid">${['onboarding','reporting','invoices'].map((id,i)=>forkCard((M.batch?.versionIds?.includes(M.latest[id]?.id)?rows.find(r=>r.workflowId===id):null)||{workflowId:id},running(M.batch)&&!M.batch.versionIds?.includes(M.latest[id]?.id)?null:M.latest[id],i)).join('')}</div>${running(M.batch)?`<p class="pending"><i class="pulse"></i>${esc(M.batch.events?.at(-1)?.message || 'Preparing isolated workspaces…')}</p>`:''}<p class="subtle-note">Each fork shares the starting company context. Code, tests and release decisions stay separate.</p>${M.batch?.status==='failed'?`<div class="error">${esc(M.batch.error?.message || 'Build failed. Previous releases are retained.')}</div>`:''}`}`;
  }
  function nodes(v) {
    if (family(v)==='reporting') return [['file','Campaign exports','Collect'],['report','Reconcile metrics','Check discrepancies'],['file','Draft report','Prepare'],['users','Account lead review','Human approval']];
    if (family(v)==='invoices') return [['invoice','Vendor invoice','Receive'],['file','Match purchase order','Verify'],['users','Budget owner','Approve'],['arrow','Finance handoff','No payment access']];
    return [['users','Closed-won client','Trigger'],['file','Required documents','Validate'],...(v.policyApplied?[['lock','Finance approval','Over $10,000',true]]:[]),['build','Workspace & checklist','Create'],['clock','Kickoff ready','Schedule']];
  }
  function behavior(v) {
    if (family(v)==='reporting') return 'Drafts reports. Humans review discrepancies and approve release.';
    if (family(v)==='invoices') return 'Matches invoices and routes approved items to Finance. Never pays.';
    return v.policyApplied?'Finance approval is required above $10,000.':'Eligible clients proceed when their documents are complete.';
  }
  function comparison(M,V) {
    if(family(V)!=='onboarding') return '';
    const baseline = M.vs.find(v=>family(v)==='onboarding'&&!v.policyApplied&&completed(v));
    if(!baseline||!V.policyApplied) return '';
    const choices = [['high-value','$18,000 · no approval'],['low-value','$8,000 client'],['finance-approved','$18,000 · approved']];
    const prior = V.previousVersionTests || baseline.tests;
    const before = prior?.cases.find(c=>c.id===S.compareCase), after = V.tests?.cases.find(c=>c.id===S.compareCase);
    const card = (test, label, cls) => `<div class="compare-card ${cls}"><div class="label">${label}</div><h3>${esc(choices.find(([id])=>id===S.compareCase)?.[1] || '')}</h3><p>${cls?'Finance policy applied':'Original onboarding rules'}</p><div class="decision ${test?.actual?.status==='needs_finance_approval'?'hold':''}">${icon(test?.actual?.status==='needs_finance_approval'?'lock':'check')}${esc(statusText(test?.actual?.status))}</div></div>`;
    return section('What changes for your business','Actual saved execution results')+`<div class="case-tabs">${choices.map(([id,label])=>`<button class="tab ${S.compareCase===id?'selected':''}" data-act="compare" data-arg="${id}">${label}</button>`).join('')}</div><div class="compare-grid">${card(before,'Before · original workflow','')}<div class="compare-arrow">${icon('arrow')}</div>${card(after,'After · policy-aware workflow','after')}</div>`;
  }
  function workflow(M) {
    const V = M.chosen;
    if(!V || !S.workflowOpen) return workflowList(M);
    const id=family(V), active=ver(M.active[id]), latest=M.latest[id], canApprove=passing(V)&&V.id===latest?.id&&!V.approval&&!M.busy;
    const plan = nodes(V);
    return `<div class="row between" style="margin-bottom:22px">${button('backWorkflows','← All workflows','text')}${badge(V.approval?(active?.id===V.id?'Demo production':'Previously approved'):statusText(V.status),V.approval?'dark':passing(V)?'':'neutral')}</div>`+
      head('Workflow',esc(workflowNames[id]||V.workflowName),esc(behavior(V)),completed(V)?button('openRun','Open generated app '+icon('arrow'),'primary',V.id):'')+
      `<div class="panel plan"><div class="plan-head"><h2>${V.policyApplied&&id==='onboarding'?'Onboarding with a Finance guardrail':'How it works'}</h2>${badge(V.policyApplied&&id==='onboarding'?'Policy applied':'Generated workflow','neutral')}</div><div class="pipeline">${plan.map(([symbol,title,detail,isNew],i)=>`${i?'<span class="edge">→</span>':''}<div class="node ${isNew?'new':''}">${isNew?'<span class="new-tag">POLICY CHANGE</span>':''}${icon(symbol)}<b>${title}</b><small>${detail}</small></div>`).join('')}</div><div class="plan-foot"><span class="validation">${icon('check')}${V.tests?`${V.tests.summary.passed}/${V.tests.summary.total} independent checks passed`:'Tests pending'}</span><span>${completed(V)?'Generated and executed in Archil':'Build in progress'}</span></div></div>`+
      comparison(M,V)+
      `<div class="review-strip"><img src="/img/${V.approval?'celebrating':'checklist'}.png" alt=""><div><h3>${V.approval?(active?.id===V.id?'Released to demo production':'Previously approved release'):passing(V)?'Tested. Ready for your decision.':V.status==='failed'?'This build needs attention.':'Platy is building this workflow.'}</h3><p>${V.approval?'This exact version is approved. Business actions remain simulated.':passing(V)?'Approve this version to make it the active demo workflow.':V.error?.message || 'Your previous approved release stays available.'}</p></div>${canApprove?button('approve',S.approving?'Releasing…':'Approve & release '+icon('arrow'),'primary',V.id,S.approving):V.approval?button('stage','See impact '+icon('arrow'),'primary','impact'):''}</div>`+
      (id==='onboarding'&&completed(V)?`<div class="policy-row"><img src="/img/notifications.png" alt=""><div><h3>Your company changes. Your workflow keeps up.</h3><p>Add a Finance approval rule for contracts over $10,000.</p></div>${button('policy',V.policyApplied?'Review policy update':'Introduce a policy change','small','',M.busy)}</div>`:'')+
      `<div class="technical-link">${button('versionEvidence','Tests, versions & source evidence','text',V.id)}</div>`;
  }
  function impact(M) {
    const released = Object.values(M.active).map(id=>ver(id)).filter(v=>v?.approval);
    const ids = new Set(released.map(v=>v.id));
    const runs=(M.W?.jobs || []).filter(j=>j.kind==='run'&&j.status==='completed'&&ids.has(j.result?.versionId));
    const acted=runs.filter(j=>j.result?.output?.executedActions?.length>0), blocked=runs.filter(j=>j.result?.output?.blockingReasons?.length>0);
    const hours=M.opps.reduce((n,o)=>n+Number(o.monthlyHours||0),0);
    return head('Results, with context','See what your workflows are doing.','Release status and actual sample executions. Real business impact is not measured yet.')+
      (released.length?`<div class="release-banner"><img src="/img/celebrating.png" alt=""><div>${badge('Demo production · simulated')}<h2>${released.length} ${released.length===1?'workflow is':'workflows are'} ready to work.</h2><p>Approved software, connected to synthetic systems.</p></div>${button('runActive','Run a sample client '+icon('play'),'primary',released.find(v=>family(v)==='onboarding')?.id||released[0].id,M.busy||S.runBusy)}</div>`:`<div class="panel empty"><img src="/img/checklist.png" alt=""><h2>Your first release starts here.</h2><p>Review a tested workflow and approve it to see sample execution results here.</p>${button('stage','Review workflows','primary','build')}</div>`)+
      `<div class="impact-grid"><article class="panel impact-card"><h3>Sample runs with actions</h3><div class="impact-number">${acted.length}</div><p>Actual synthetic executions</p></article><article class="panel impact-card"><h3>Runs paused by a business rule</h3><div class="impact-number">${blocked.length}</div><p>Actual synthetic executions</p></article><article class="panel impact-card"><h3>Manual effort identified</h3><div class="impact-number">${hours}<span style="font-size:16px;letter-spacing:0"> h/mo</span></div><p>Sample timesheets · not savings</p></article></div>`+
      (released.length?section('Released workflows','Demo production')+`<div class="panel">${released.map(v=>`<div class="activity-row"><span class="activity-dot">${icon(workflowIcons[family(v)])}</span><div><b>${esc(workflowNames[family(v)])}</b><p>Approved ${clock(v.approval.at)} ? simulated release</p></div><span class="grow"></span>${button('runActive','Run sample','small',v.id,M.busy||S.runBusy)}</div>`).join('')}</div>`:'')+section('Recent activity',`${runs.length} runs on currently approved versions`)+`<div class="panel">${[...runs].reverse().slice(0,6).map(j=>`<div class="activity-row"><span class="activity-dot">${icon(j.result.output.blockingReasons?.length?'pause':'check')}</span><div><b>${esc(workflowNames[family(ver(j.result.versionId))])}</b><p>${esc(statusText(j.result.output.status))} · ${j.result.output.executedActions?.length||0} simulated actions</p></div><span class="time">${clock(j.completedAt)}</span></div>`).join('')||'<div class="impact-placeholder">No sample executions yet. Run an approved workflow to see its results.</div>'}</div><p class="subtle-note">No real accounts, messages or payments are changed. Sample runs demonstrate behavior; they do not establish realized ROI.</p>`;
  }
  function previewTop(M) {
    const V=M.chosen;
    return head('Workflow application',esc(workflowNames[family(V)]||'Generated software'),'Use the actual application Platy generated. Executions run in Archil against synthetic data.',button('workflow','Back to workflow','text',V?.id||''));
  }
  const cache={};
  function region(id,html){const el=document.getElementById(id);if(el&&cache[id]!==html){cache[id]=html;el.innerHTML=html;}}
  function render() {
    const M=model();
    region('sidebar',sidebar(M));region('topbar',header(M));
    const views={company:connections,discover:discoveries,build:workflow,impact,run:previewTop};
    region('content',errors()+(views[S.stage]||connections)(M));
    const panel=document.getElementById('app-panel');panel.hidden=S.stage!=='run';
    if(S.stage==='run'){
      const v=M.chosen;
      region('app-toolbar',`<div class="app-tools"><select aria-label="Software version" id="version-select">${M.vs.filter(completed).map(row=>`<option value="${row.id}"${v?.id===row.id?' selected':''}>${esc(workflowNames[family(row)])} · ${row.policyApplied?'Finance policy':'Original rules'} · v${row.number}</option>`).join('')}</select>${button('toggleInter',S.interactive?'Interactive preview on':'Enable interactive preview',S.interactive?'':'primary','',!completed(v))}</div>`);
      region('app-status',esc(S.runNote||(S.interactive?`${RUN_CAP-S.runs} runs available. Business actions are simulated.`:'Enable interaction to let this app request a synthetic execution.')));
      syncPreview();
    }
    region('toast',S.toast?esc(S.toast):'');
    document.title=`Platyform · ${STAGES.find(([id])=>id===S.stage)?.[1]||'Workflow'}`;
  }
  function modal(title,body){region('evidence-content',`<div class="dialog-head"><h2>${esc(title)}</h2>${button('closeModal',icon('close'),'text')}</div><div class="dialog-body">${body}</div>`);const dialog=document.getElementById('evidence-dialog');if(!dialog.open)dialog.showModal();}
  function source(name){const file=S.ws?.files.find(f=>f.name===name);if(file)modal(name,`<p class="small muted">Source snapshot used by discovery.</p><pre>${esc(file.content)}</pre>`);}
  function showOpportunity(id){const o=S.ws?.discovery?.opportunities.find(o=>o.id===id);if(!o)return;modal(o.name,`<p>${esc(o.description)}</p><p class="subtle-note">${o.monthlyHours} hours/month of recorded manual work. Difficulty ${o.difficulty}/5 · risk ${o.risk}/5.</p><ul class="evidence-list">${(o.citations||[]).map(c=>`<li><b>${esc(c.file)}:${c.line}</b><p>“${esc(c.quote)}”</p></li>`).join('')}</ul>`);}
  function versionEvidence(id){const V=ver(id);if(!V)return;modal('Build evidence',`<p class="small muted">${esc(workflowNames[family(V)])} · version ${V.number} · ${esc(statusText(V.status))}</p><ul class="evidence-list">${(V.tests?.cases||[]).map(c=>`<li><div class="row between"><b>${esc(c.name||c.id)}</b>${badge(c.passed?'Passed':'Failed',c.passed?'':'bad')}</div>${c.failures?.length?`<p>${esc(c.failures.join('; '))}</p>`:''}</li>`).join('')}</ul><details style="margin-top:20px"><summary>Archil artifacts and exact approval</summary><pre>${esc(JSON.stringify({diskId:V.diskId,prefix:V.prefix,sourceHash:V.sourceHash,resultHash:V.resultHash,forks:V.forks?.map(f=>({workflow:f.workflowName,sandboxId:f.sandboxId,status:f.status,sandboxStatus:f.sandboxStatus})),approval:V.approval},null,2))}</pre></details><details><summary>Generated Python</summary><pre>${esc(V.files?.['workflow.py']||'Not yet available')}</pre></details><details><summary>Previous versions</summary><ul class="evidence-list">${model().vs.filter(v=>family(v)===family(V)).map(v=>`<li>${button('workflow',`Version ${v.number} · ${statusText(v.status)}`,'text',v.id)}</li>`).join('')}</ul></details>`);}
  async function connect(){
    set({connected:true,stage:'discover'});
    const M=model();
    if(M.busy)return;
    if(!M.D){set({autoBuild:true});await start('discover');}
    else if(!M.latest.reporting||!M.latest.invoices){set({stage:'build',workflowOpen:false});await start('build-all');}
  }
  async function runActive(id){
    const v=ver(id);if(!v?.approval||S.runBusy)return;
    const input=v.sampleInput || {deal:{id:'D001',client:'Acme Logistics',stage:'closed_won',value_usd:18000},documents:{signed_agreement:true,brand_assets:true},financeApproved:false,completedActions:[]};
    set({runBusy:true});
    await start('run',{versionId:id,input},(job,error)=>{set({runBusy:false});if(job?.status==='completed'){toast(statusText(job.result.output.status));load(true);}else toast(error?.message||job?.error?.message||'Execution failed.');});
  }
  function go(stage){set({stage,interactive:stage==='run'?S.interactive:false});window.scrollTo({top:0});}
  const actions={
    stage:go,connect,refresh:()=>load(),source,opportunity:showOpportunity,
    buildAll:()=>{if(model().busy)return;set({stage:'build',workflowOpen:false,connected:true});start('build-all');},
    workflow:id=>{document.getElementById('evidence-dialog').close();set({viewVer:id,stage:'build',workflowOpen:true,interactive:false});fetchVer(id);window.scrollTo({top:0});},
    backWorkflows:()=>set({workflowOpen:false}),
    openRun:id=>{set({viewVer:id,stage:'run',interactive:false,runs:0,runNote:''});fetchVer(id);window.scrollTo({top:0});},
    toggleInter:()=>set({interactive:!S.interactive,runNote:''}),
    compare:id=>set({compareCase:id}),
    versionEvidence,closeModal:()=>document.getElementById('evidence-dialog').close(),
    approve:id=>approve(ver(id)),runActive,
    policy:()=>modal('A new company policy',`<p class="eyebrow">Company document</p><h3>Finance approval</h3><p style="margin:16px 0 24px">${esc(POLICY)}</p><p class="small muted" style="margin-bottom:24px">Platy will test the current onboarding software against this policy, then build and verify an updated version. Existing releases remain available.</p>${button('evolve','Add policy & update workflow '+icon('arrow'),'primary','',model().busy)}`),
    evolve:()=>{document.getElementById('evidence-dialog').close();if(model().busy)return;set({stage:'build',workflowOpen:false});start('evolve',{policyText:POLICY});}
  };
  document.addEventListener('click',event=>{const el=event.target.closest('[data-act]');if(!el||el.disabled)return;const action=actions[el.dataset.act];if(action){event.preventDefault();action(el.dataset.arg);}});
  document.addEventListener('change',event=>{if(event.target.id==='version-select'){set({viewVer:event.target.value,interactive:false,runs:0,runNote:''});fetchVer(event.target.value);}});
  document.getElementById('evidence-dialog').addEventListener('click',event=>{if(event.target===event.currentTarget)event.currentTarget.close();});
  setInterval(()=>{if(model().busy)render();},1000);
  render();load();
})();
