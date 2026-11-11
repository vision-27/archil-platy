import { copy } from '../copy.js';
import { Icon, Note, Status, runVerdict, short, time } from '../ui.jsx';

export function RunnerPicker({ catalog, runner, setRunner }) {
  const chosen = catalog.runners.find(r => r.id === runner);
  return (
    <div className="pc-stack" style={{ gap: 10 }}>
      <span className="pc-small" style={{ fontWeight: 600 }}>{copy.workflows.runnerLabel}</span>
      <div className="pc-seg" role="group" aria-label={copy.workflows.runnerLabel}>
        {catalog.runners.map(option => (
          <button key={option.id} type="button" aria-pressed={runner === option.id} disabled={!option.available}
            title={option.available ? option.label : option.reason} onClick={() => setRunner(option.id)}>
            <Icon name={option.id === 'archil' ? 'box' : 'play'} />{option.label}
          </button>
        ))}
      </div>
      <p className="pc-muted pc-small">
        {chosen?.id === 'archil'
          ? `Runs in a fresh Archil sandbox (${chosen.region ?? 'default region'}, network ${chosen.networkMode ?? 'default'}). Files persist in its /workspace disk.`
          : chosen?.isolation}
        {catalog.runners.filter(r => !r.available).map(r => <span key={r.id}> {r.label} unavailable: {r.reason}</span>)}
      </p>
    </div>
  );
}

export function StartError({ startError, startRun }) {
  if (!startError) return null;
  const message = startError.code === 'run_in_progress' ? 'Another experiment is still running. Wait for it to finish.' : startError.message;
  return (
    <Note tone="bad">
      {message}{' '}
      {startError.retryable && <button className="pc-link" onClick={() => startRun(startError.workflowId, startError.runner)}>Retry the same request</button>}
    </Note>
  );
}

export default function Workflows({ catalog, runs, runner, setRunner, startRun, starting, startError, activeRun }) {
  const latestFor = id => runs.find(run => run.workflowId === id);
  return (
    <div className="pc-view">
      <div className="pc-head">
        <div className="pc-head-copy">
          <p className="pc-eyebrow">{copy.workflows.eyebrow}</p>
          <h1 className="pc-h1">{copy.workflows.title}</h1>
          <p className="pc-lede">{copy.workflows.lede}</p>
        </div>
      </div>

      <RunnerPicker catalog={catalog} runner={runner} setRunner={setRunner} />
      <StartError startError={startError} startRun={startRun} />
      {activeRun && <Note tone="info">An experiment is running. <a className="pc-link" href={`#/runs/${activeRun.id}`}>Follow it live</a></Note>}

      <div className="pc-grid2">
        {catalog.workflows.map(workflow => {
          const latest = latestFor(workflow.id);
          const verdict = latest && runVerdict(latest);
          return (
            <article className="pc-panel wf-card" key={workflow.id} aria-labelledby={`wf-${workflow.id}`}>
              <div className="pc-row-head">
                <div>
                  <span className="wf-version">Version {workflow.version} · {workflow.generation}</span>
                  <h2 className="pc-h3" id={`wf-${workflow.id}`}>{workflow.name}</h2>
                </div>
                {verdict ? <Status tone={verdict.tone} live={verdict.live}>{verdict.label}</Status> : <Status>Not tested</Status>}
              </div>
              <p className="pc-muted">{workflow.description}</p>
              <dl className="pc-facts">
                <div><dt>Workflow hash</dt><dd className="hash" title={workflow.workflowHash}>{short(workflow.workflowHash)}</dd></div>
                <div><dt>Last tested</dt><dd>{latest ? <a className="pc-link" href={`#/runs/${latest.id}`}>{time(latest.createdAt)}</a> : 'Never'}</dd></div>
              </dl>
              <details>
                <summary className="pc-link" style={{ cursor: 'pointer' }}>View workflow source</summary>
                <pre className="code" style={{ marginTop: 12 }}><code>{workflow.code}</code></pre>
              </details>
              <div className="pc-actions" style={{ marginTop: 'auto' }}>
                <button className="pc-btn dark" disabled={starting || Boolean(activeRun) || !runner} onClick={() => startRun(workflow.id)}>
                  <Icon name={runner === 'archil' ? 'box' : 'play'} />{starting ? 'Starting…' : copy.workflows.run(runner)}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <section className="pc-panel" aria-labelledby="scenarios-title">
        <h2 className="pc-h3" id="scenarios-title">{copy.workflows.scenariosTitle}</h2>
        <div className="table-wrap">
          <table className="pc-table">
            <thead><tr><th>Scenario</th><th>Deliveries</th><th>Injected fault</th><th className="num">Expected grants</th><th>Expected access</th><th>Needs review</th></tr></thead>
            <tbody>
              {catalog.scenarios.map(s => (
                <tr key={s.id}>
                  <td>{s.name}</td><td className="num">{s.deliveries}</td><td>{s.fault ?? '—'}</td>
                  <td className="num">{s.expected.grantCount}</td><td>{s.expected.access ? 'Yes' : 'No'}</td><td>{s.expected.pendingReview ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
