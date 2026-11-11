import { useEffect, useRef, useState } from 'react';
import { api, isActive } from '../api.js';
import { copy } from '../copy.js';
import { Icon, Note, Status, bytes, plural, runVerdict, runnerLabel, short, time } from '../ui.jsx';
import { StartError } from './Workflows.jsx';

const POLL_MS = 800;

function useRun(id) {
  const [run, setRun] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let alive = true; let timer;
    const tick = async () => {
      try {
        const next = await api.run(id);
        if (!alive) return;
        setRun(next); setError(null);
        if (isActive(next)) timer = setTimeout(tick, POLL_MS);
      } catch (err) {
        if (!alive) return;
        setError(err);
        if (err.status === 0) timer = setTimeout(tick, POLL_MS * 3); // backend blip: keep trying
      }
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [id]);
  return [run, setRun, error];
}

function stageOf(run) {
  const order = { queued: 0, preparing: 1, running: 2 };
  if (run.status in order) return { index: order[run.status], bad: false };
  if (run.status === 'completed') return { index: run.approval ? 5 : 4, bad: run.result?.summary.failed > 0 ? 3 : false };
  const reached = run.events.some(e => /running tests|running trusted/i.test(e.message)) ? 2 : run.events.length > 1 ? 1 : 0;
  return { index: reached, bad: reached };
}

function Track({ run }) {
  const { index, bad } = stageOf(run);
  return (
    <ol className="pc-track" aria-label="Experiment progress">
      {copy.run.stages.map((label, i) => {
        const failedHere = bad !== false && i === bad;
        const state = failedHere ? 'bad' : i < index ? 'done' : i === index ? 'now' : 'next';
        return (
          <li key={label} className={state === 'bad' ? 'now' : state} aria-current={i === index ? 'step' : undefined}>
            <span className={`pc-mark ${state}`}>
              {state === 'done' && <Icon name="check" />}{state === 'bad' && <Icon name="x" />}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

const fmt = value => (typeof value === 'string' ? value : JSON.stringify(value));

function AccessDiff({ before, after, nameOf }) {
  const rows = (after?.onboarding ?? []).map(row => ({ row, was: before?.onboarding?.find(b => b.customerId === row.customerId)?.access }));
  return (
    <div className="chips">
      {rows.map(({ row, was }) => (
        <span className="chip" key={row.customerId} style={was !== row.access ? { borderColor: 'var(--pc-accent-strong)' } : undefined}>
          {nameOf(row.customerId)} <b>{was ? 'access' : 'no access'}{was !== row.access ? ` → ${row.access ? 'access' : 'no access'}` : ''}</b>
        </span>
      ))}
    </div>
  );
}

function Scenario({ scenario, nameOf, defaultOpen }) {
  return (
    <details className="scenario" open={defaultOpen}>
      <summary>
        <span className={`result-mark ${scenario.passed ? 'pass' : 'fail'}`}><Icon name={scenario.passed ? 'check' : 'x'} label={scenario.passed ? 'Passed' : 'Failed'} /></span>
        <span>
          <span className="pc-row-title" style={{ display: 'block' }}>{scenario.name}</span>
          <span className="pc-muted pc-small">{scenario.explanation}</span>
        </span>
        <Icon name="chevron" />
      </summary>
      <div className="scenario-body">
        <div className="table-wrap">
          <table className="pc-table">
            <thead><tr><th>Check</th><th>Expected</th><th>Actual</th><th><span className="sr-only">Result</span></th></tr></thead>
            <tbody>
              {scenario.assertions.map(a => (
                <tr key={a.id}>
                  <td>{a.label}</td>
                  <td><span className="val" title={fmt(a.expected)}>{fmt(a.expected)}</span></td>
                  <td><span className="val" title={fmt(a.actual)}>{fmt(a.actual)}</span></td>
                  <td>{a.passed ? <Status tone="ok">Pass</Status> : <Status tone="bad">Fail</Status>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pc-stack" style={{ gap: 8 }}>
          <span className="pc-small" style={{ fontWeight: 600 }}>Onboarding access, before → after</span>
          <AccessDiff before={scenario.before} after={scenario.after} nameOf={nameOf} />
        </div>
        <details>
          <summary className="pc-link" style={{ cursor: 'pointer' }}>Simulated calls ({scenario.actions.length}) · {plural(scenario.deliveries.length, 'delivery', 'deliveries')}</summary>
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="pc-table">
              <thead><tr><th>#</th><th>System</th><th>Operation</th><th>Input</th><th>Output</th></tr></thead>
              <tbody>
                {scenario.actions.map(action => (
                  <tr key={action.sequence}>
                    <td className="num">{action.sequence}</td><td>{action.system}</td><td className="mono">{action.operation}</td>
                    <td><span className="val" title={fmt(action.input)}>{fmt(action.input)}</span></td>
                    <td><span className="val" title={fmt(action.output)}>{fmt(action.output)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="pc-small pc-muted" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {scenario.deliveries.map((d, i) => <li key={i}>Delivery {i + 1}: <b>{d.status}</b> — {d.reason}</li>)}
          </ul>
        </details>
      </div>
    </details>
  );
}

function Artifacts({ run }) {
  const [selected, setSelected] = useState(null);
  const [content, setContent] = useState({ text: '', error: null, loading: false });
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    setContent({ text: '', error: null, loading: true });
    api.artifact(run.id, selected)
      .then(text => alive && setContent({ text: selected.endsWith('.json') ? prettyJSON(text) : text, error: null, loading: false }))
      .catch(err => alive && setContent({ text: '', error: err.message, loading: false }));
    return () => { alive = false; };
  }, [run.id, selected]);
  if (!run.artifacts.length) return <p className="pc-muted">Artifacts appear once the sandbox inputs are prepared.</p>;
  return (
    <div className="pc-stack" style={{ gap: 14 }}>
      <div className="artifact-list">
        {run.artifacts.map(a => (
          <button key={a.name} aria-pressed={selected === a.name} onClick={() => setSelected(selected === a.name ? null : a.name)}>
            <span className="mono">{a.name}</span><small>{bytes(a.bytes)} · sha {a.sha256.slice(0, 8)}</small>
          </button>
        ))}
      </div>
      {selected && (content.error ? <Note tone="bad">{content.error}</Note>
        : <pre className="code"><code>{content.loading ? 'Loading…' : content.text}</code></pre>)}
      {run.runner === 'archil' && <p className="pc-muted pc-small">These are verified local copies. The same inputs and results also live in <code>{run.workspacePath ?? '/workspace'}</code> on the stopped sandbox's persistent disk.</p>}
    </div>
  );
}
const prettyJSON = text => { try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; } };

function Approval({ run, setRun }) {
  const [checked, setChecked] = useState(false);
  const [state, setState] = useState({ busy: false, error: null });
  const passing = run.status === 'completed' && run.result?.summary.failed === 0;
  if (!passing) return null;
  const approve = async () => {
    setState({ busy: true, error: null });
    try { setRun(await api.approve(run)); setState({ busy: false, error: null }); }
    catch (err) { setState({ busy: false, error: err.message }); }
  };
  return (
    <section className="pc-panel" aria-labelledby="approval-title">
      <div className="pc-row-head">
        <h2 className="pc-h3" id="approval-title">{copy.run.approveTitle}</h2>
        {run.approval ? <Status tone="ok">Recorded {time(run.approval.at)}</Status> : <Status>Awaiting review</Status>}
      </div>
      <dl className="pc-facts">
        <div><dt>Workflow hash</dt><dd className="hash">{run.workflowHash}</dd></div>
        <div><dt>Result hash</dt><dd className="hash">{run.resultHash}</dd></div>
      </dl>
      {run.approval ? <Note tone="ok">{copy.run.approvedNote}</Note> : (
        <>
          <label className="approve-check">
            <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />
            <span>{copy.run.approveCheck}</span>
          </label>
          {state.error && <Note tone="bad">{state.error}</Note>}
          <div className="pc-actions">
            <button className="pc-btn dark" disabled={!checked || state.busy} onClick={approve}><Icon name="shield" />{state.busy ? 'Recording…' : copy.run.approveButton}</button>
            <span className="pc-muted pc-small">No deployment, provider write or access grant happens.</span>
          </div>
        </>
      )}
    </section>
  );
}

function Execution({ run }) {
  const logRef = useRef(null);
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [run.events.length]);
  const safety = run.safety ?? {};
  return (
    <aside className="pc-dark" aria-labelledby="exec-title">
      <div className="pc-row-head">
        <h2 className="pc-h3" id="exec-title">{runnerLabel(run.runner)}</h2>
        <Icon name={run.runner === 'archil' ? 'box' : 'play'} />
      </div>
      <dl className="pc-facts">
        {run.runner === 'archil' ? (
          <>
            <div><dt>Sandbox</dt><dd className="mono" title={run.sandboxId ?? ''}>{run.sandboxId ? short(run.sandboxId) : 'Creating…'}</dd></div>
            <div><dt>Sandbox status</dt><dd>{run.sandboxStatus ?? '—'}</dd></div>
            <div><dt>Workspace disk</dt><dd className="mono">{run.workspacePath ?? '—'}</dd></div>
            <div><dt>Image</dt><dd>{run.runtime?.baseImage ?? '—'}</dd></div>
          </>
        ) : (
          <div><dt>Runtime</dt><dd>Node {run.runtime?.node ?? '—'} child process</dd></div>
        )}
        <div><dt>Network</dt><dd>{safety.networkMode ?? '—'}{safety.networkPolicyVerified ? ' · policy verified' : ''}</dd></div>
        <div><dt>Started</dt><dd>{time(run.createdAt)}</dd></div>
      </dl>
      {safety.verification && <p className="pc-dark-muted pc-small">{safety.verification}</p>}
      {run.cleanupWarning && <Note tone="warn">{run.cleanupWarning}</Note>}
      <h3 className="pc-small" style={{ margin: '8px 0 0', fontWeight: 600 }}>Live log</h3>
      <ol className="log" ref={logRef} aria-live="polite">
        {run.events.map((event, i) => (
          <li key={event.sequence} className={i === run.events.length - 1 ? 'latest' : ''}><time>{time(event.at)}</time><span>{event.message}</span></li>
        ))}
      </ol>
    </aside>
  );
}

export default function RunView({ id, catalog, startRun, starting, startError, refreshRuns }) {
  const [run, setRun, error] = useRun(id);
  const [tab, setTab] = useState('results');
  const wasActive = useRef(false);
  useEffect(() => {
    if (!run) return;
    if (wasActive.current && !isActive(run)) refreshRuns();
    wasActive.current = isActive(run);
  }, [run, refreshRuns]);

  if (error && !run) return <div className="pc-view"><Note tone="bad">{error.message}</Note><a className="pc-link" href="#/runs">Back to experiments</a></div>;
  if (!run) return <div className="pc-view"><p className="pc-muted">Loading experiment…</p></div>;

  const workflow = catalog.workflows.find(w => w.id === run.workflowId);
  const nameOf = cid => catalog.context.crm.find(row => row.id === cid)?.name ?? cid;
  const verdict = runVerdict(run);
  const summary = run.result?.summary;
  const failedTests = summary && summary.failed > 0;
  const next = failedTests ? catalog.workflows.find(w => w.version > (workflow?.version ?? 0)) : null;
  const stale = workflow && workflow.bundleHash !== run.bundleHash;

  const headline = isActive(run) ? `Testing ${workflow?.name ?? run.workflowId}`
    : run.status === 'failed' ? 'The experiment did not finish'
    : run.status === 'interrupted' ? 'The experiment was interrupted'
    : failedTests ? `${plural(summary.failed, 'scenario')} failed`
    : run.approval ? 'Approved for this exact version'
    : 'Every scenario passed';

  return (
    <div className="pc-view">
      <div className="pc-head">
        <div className="pc-head-copy">
          <p className="pc-eyebrow">{workflow?.name ?? run.workflowId} · version {run.workflowVersion} · {runnerLabel(run.runner)}</p>
          <h1 className="pc-h1">{headline}</h1>
          {summary && <p className="pc-lede">{failedTests ? copy.run.failedLede(summary.failed, summary.total) : copy.run.passedLede(summary.total)}</p>}
        </div>
        <Status tone={verdict.tone} live={verdict.live}>{verdict.label}</Status>
      </div>

      <Track run={run} />
      {error && <Note tone="warn">Lost contact with the backend; retrying… ({error.message})</Note>}
      {run.error && <Note tone="bad"><strong>{run.error.code}:</strong> {run.error.message}</Note>}
      {stale && <Note tone="warn">The bundled workflow or tests changed after this run. Run the current version before approving.</Note>}

      {failedTests && next && (
        <section className="pc-panel" style={{ background: 'var(--pc-soft)' }}>
          <div className="pc-row-head">
            <div className="pc-stack" style={{ gap: 6 }}>
              <h2 className="pc-h3">What went wrong</h2>
              {run.result.scenarios.filter(s => !s.passed).map(s => <p key={s.id} style={{ margin: 0 }}><b>{s.name}:</b> {s.explanation}</p>)}
              <p className="pc-muted pc-small">Version {next.version}: {next.description} <i>(prewritten correction)</i></p>
            </div>
            <button className="pc-btn accent" disabled={starting} onClick={() => startRun(next.id, run.runner)}>{copy.run.tryCorrected}<Icon name="arrow" /></button>
          </div>
          <StartError startError={startError} startRun={startRun} />
        </section>
      )}

      <div className="pc-split">
        <div className="pc-stack">
          {summary && (
            <div className="pc-metrics">
              <div className="pc-metric"><span className="pc-muted">Passed</span><span className="pc-big" style={{ color: 'var(--pc-ok-ink)' }}>{summary.passed}</span></div>
              <div className="pc-metric"><span className="pc-muted">Failed</span><span className="pc-big" style={{ color: summary.failed ? 'var(--pc-bad-ink)' : undefined }}>{summary.failed}</span></div>
              <div className="pc-metric"><span className="pc-muted">Scenarios</span><span className="pc-big">{summary.total}</span></div>
            </div>
          )}
          <section className="pc-panel">
            <div className="pc-tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'results'} onClick={() => setTab('results')}>Test results</button>
              <button role="tab" aria-selected={tab === 'artifacts'} onClick={() => setTab('artifacts')}>Artifacts ({run.artifacts.length})</button>
            </div>
            {tab === 'results' ? (
              run.result ? (
                <div>{run.result.scenarios.map(s => <Scenario key={s.id} scenario={s} nameOf={nameOf} defaultOpen={!s.passed} />)}</div>
              ) : isActive(run) ? (
                <div className="empty"><img src="/agent-p.png" alt="" /><p>Running {catalog.scenarios.length} scenarios against simulated CRM, billing and onboarding…</p></div>
              ) : <p className="pc-muted">No validated results were produced. Inspect the retained artifacts.</p>
            ) : <Artifacts run={run} />}
          </section>
          <Approval run={run} setRun={setRun} />
        </div>
        <Execution run={run} />
      </div>
    </div>
  );
}
