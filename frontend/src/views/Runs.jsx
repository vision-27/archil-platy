import { copy } from '../copy.js';
import { Icon, Status, runVerdict, runnerLabel, time } from '../ui.jsx';

export default function Runs({ catalog, runs }) {
  const nameOf = id => catalog.workflows.find(w => w.id === id)?.name ?? id;
  return (
    <div className="pc-view">
      <div className="pc-head">
        <div className="pc-head-copy">
          <p className="pc-eyebrow">History</p>
          <h1 className="pc-h1">{copy.nav.runs}</h1>
        </div>
        <a className="pc-btn dark" href="#/workflows"><Icon name="flask" />New experiment</a>
      </div>
      <section className="pc-panel">
        {runs.length === 0 ? (
          <div className="empty"><img src="/agent-p.png" alt="" /><p>No experiments yet. Test a workflow to see results here.</p></div>
        ) : (
          <div className="pc-list">
            {runs.map(run => {
              const verdict = runVerdict(run);
              return (
                <a className="pc-lrow" key={run.id} href={`#/runs/${run.id}`}>
                  <div>
                    <div className="pc-row-title">{nameOf(run.workflowId)} <span className="pc-muted" style={{ fontWeight: 400 }}>v{run.workflowVersion}</span></div>
                    <p className="pc-muted pc-small">{runnerLabel(run.runner)} · started {time(run.createdAt)}{run.approval ? ' · simulated approval recorded' : ''}</p>
                  </div>
                  <span className="pc-actions"><Status tone={verdict.tone} live={verdict.live}>{verdict.label}</Status><Icon name="chevron" /></span>
                </a>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
