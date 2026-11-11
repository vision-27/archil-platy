import { copy } from '../copy.js';
import { Icon } from '../ui.jsx';

const records = [
  { key: 'crm', title: 'CRM', columns: ['id', 'name', 'status'] },
  { key: 'billing', title: 'Billing', columns: ['id', 'customerId', 'status'] },
  { key: 'onboarding', title: 'Onboarding', columns: ['customerId', 'access'] }
];

export default function Evidence({ catalog }) {
  const { company, policy, findings, context } = catalog;
  const nameOf = id => context.crm.find(row => row.id === id)?.name ?? id;
  return (
    <div className="pc-view">
      <div className="pc-head">
        <div className="pc-head-copy">
          <p className="pc-eyebrow">{copy.evidence.eyebrow(company.name)}</p>
          <h1 className="pc-h1">{copy.evidence.title}</h1>
          <p className="pc-lede">{copy.evidence.lede}</p>
        </div>
        <a className="pc-btn dark" href="#/workflows">{copy.evidence.cta}<Icon name="arrow" /></a>
      </div>

      <div className="pc-split">
        <section className="pc-panel" aria-labelledby="findings-title">
          <div className="pc-row-head">
            <h2 className="pc-h3" id="findings-title">{copy.evidence.findingsTitle(findings.length)}</h2>
            <span className="pc-status s-bad">Needs a fix</span>
          </div>
          <div className="pc-list">
            {findings.map(finding => (
              <div className="pc-lrow" key={finding.id}>
                <div className="pc-stack" style={{ gap: 10 }}>
                  <div>
                    <div className="pc-row-title">{nameOf(finding.customerId)}</div>
                    <p className="pc-muted pc-small">{finding.title}</p>
                  </div>
                  <div className="chips">
                    {finding.evidence.map(item => (
                      <span className="chip" key={`${item.system}-${item.field}`}>
                        <span className="sys">{item.system}</span>{item.field} <b>{String(item.value)}</b>
                      </span>
                    ))}
                  </div>
                </div>
                {finding.evidence.find(item => item.system === 'crm')?.value !== 'active' && (
                  <span className="pc-status s-part">Account on hold</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <aside className="pc-dark" aria-labelledby="policy-title">
          <p className="pc-dark-muted">{copy.evidence.policyTitle}</p>
          <h2 className="pc-h3" id="policy-title" style={{ fontWeight: 500, lineHeight: 1.45 }}>{policy.text}</h2>
          <p className="pc-dark-muted pc-small">{company.description}</p>
        </aside>
      </div>

      <section className="pc-stack" aria-labelledby="records-title">
        <h2 className="pc-h2" id="records-title">{copy.evidence.recordsTitle}</h2>
        <div className="pc-grid2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' }}>
          {records.map(source => (
            <div className="pc-inner" key={source.key}>
              <h3 className="pc-h3" style={{ fontSize: '1.0625rem' }}>{source.title}</h3>
              <div className="table-wrap">
                <table className="pc-table">
                  <thead><tr>{source.columns.map(col => <th key={col}>{col}</th>)}</tr></thead>
                  <tbody>
                    {context[source.key].map((row, index) => (
                      <tr key={index}>{source.columns.map(col => <td key={col}>{String(row[col])}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
