import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, isActive } from './api.js';
import { copy } from './copy.js';
import { Icon, Note } from './ui.jsx';
import Evidence from './views/Evidence.jsx';
import Workflows from './views/Workflows.jsx';
import RunView from './views/RunView.jsx';
import Runs from './views/Runs.jsx';

function parseRoute(hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'workflows') return { name: 'workflows' };
  if (parts[0] === 'runs' && parts[1]) return { name: 'run', id: parts[1] };
  if (parts[0] === 'runs') return { name: 'runs' };
  return { name: 'evidence' };
}
export const go = path => { window.location.hash = path; };

export default function App() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  const [catalog, setCatalog] = useState(null);
  const [runs, setRuns] = useState([]);
  const [online, setOnline] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [runner, setRunner] = useState(null);
  // A POST whose response was lost keeps its request key so a retry replays it, never duplicates it.
  const [pendingStart, setPendingStart] = useState(null);
  const [startError, setStartError] = useState(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const onHash = () => { setRoute(parseRoute(window.location.hash)); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      const data = await api.catalog();
      setCatalog(data); setOnline(true); setLoadError(null);
      setRunner(current => current ?? (data.runners.find(r => r.id === 'archil')?.available ? 'archil' : 'local'));
    } catch (error) { setOnline(false); setLoadError(error.message); }
  }, []);
  const refreshRuns = useCallback(async () => {
    try { setRuns(await api.runs()); setOnline(true); } catch { setOnline(false); }
  }, []);

  useEffect(() => { loadCatalog(); refreshRuns(); }, [loadCatalog, refreshRuns]);
  // Keep the sidebar count and workflow cards fresh; faster while something is running.
  const anyActive = runs.some(isActive);
  useEffect(() => {
    const timer = setInterval(refreshRuns, anyActive ? 1500 : 5000);
    return () => clearInterval(timer);
  }, [refreshRuns, anyActive]);

  const startRun = useCallback(async (workflowId, chosenRunner = runner) => {
    const attempt = pendingStart && pendingStart.workflowId === workflowId && pendingStart.runner === chosenRunner
      ? pendingStart : { workflowId, runner: chosenRunner, requestKey: crypto.randomUUID() };
    setPendingStart(attempt); setStartError(null); setStarting(true);
    try {
      const { run } = await api.start(attempt);
      setPendingStart(null);
      setRuns(list => [run, ...list.filter(item => item.id !== run.id)]);
      go(`/runs/${run.id}`);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 0) setPendingStart(null);
      setStartError({ ...attempt, message: error.message, retryable: error.status === 0, code: error.code });
    } finally { setStarting(false); }
  }, [runner, pendingStart]);

  const activeRun = runs.find(isActive);
  const crumbs = {
    evidence: copy.nav.evidence, workflows: copy.nav.workflows, runs: copy.nav.runs,
    run: 'Experiment'
  };
  const navItems = [
    { id: 'evidence', href: '#/', icon: 'search', label: copy.nav.evidence },
    { id: 'workflows', href: '#/workflows', icon: 'flask', label: copy.nav.workflows },
    { id: 'runs', href: '#/runs', icon: 'list', label: copy.nav.runs, count: runs.length }
  ];
  const currentNav = route.name === 'run' ? 'runs' : route.name;
  const shared = { catalog, runs, runner, setRunner, startRun, starting, startError, activeRun, refreshRuns };

  return (
    <>
      <aside className="sidebar">
        <a className="brand" href="#/"><img src="/platy-logo-ink.png" alt="" />{copy.product}</a>
        <div className="workspace-name">
          <span className="workspace-avatar">{catalog?.company?.name?.[0] ?? 'P'}</span>
          <span>{catalog?.company?.name ?? 'Loading…'}<small>{copy.labName}</small></span>
          <span className={`tiny-dot${online === false ? ' off' : ''}`} title={online === false ? 'Backend offline' : 'Backend online'} />
        </div>
        <nav aria-label="Main">
          {navItems.map(item => (
            <a key={item.id} className="nav-item" href={item.href} aria-current={currentNav === item.id ? 'page' : undefined}>
              <Icon name={item.icon} />{item.label}
              {item.count ? <span className="nav-count">{item.count}</span> : null}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="companion-card">
            <strong><img src="/agent-p.png" alt="" />Demo boundaries</strong>
            <ul>{copy.honesty.map(line => <li key={line}>{line}</li>)}</ul>
          </div>
          <div className="local-footer">Runs on 127.0.0.1 · nothing leaves this machine except Archil runs</div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb"><span>{copy.labName}</span><span aria-hidden="true">/</span><b>{crumbs[route.name]}</b></div>
          <div className="top-actions">
            {activeRun && route.id !== activeRun.id && (
              <a className="badge" href={`#/runs/${activeRun.id}`}><span className="tiny-dot" style={{ background: 'var(--orange)' }} />Experiment running · view</a>
            )}
            <span className="badge"><Icon name="shield" />Synthetic data</span>
          </div>
        </header>
        <main className="content">
          {online === false && !catalog ? (
            <div className="pc-view">
              <Note tone="bad"><strong>Backend unavailable.</strong> {loadError} Start it with <code>npm.cmd start --prefix backend</code>, then retry.</Note>
              <div><button className="pc-btn dark" onClick={() => { loadCatalog(); refreshRuns(); }}><Icon name="refresh" />Retry</button></div>
            </div>
          ) : !catalog ? (
            <div className="pc-view"><p className="pc-muted">Loading the workflow lab…</p></div>
          ) : route.name === 'evidence' ? <Evidence {...shared} />
            : route.name === 'workflows' ? <Workflows {...shared} />
            : route.name === 'runs' ? <Runs {...shared} />
            : <RunView key={route.id} id={route.id} {...shared} />}
        </main>
      </div>
    </>
  );
}
