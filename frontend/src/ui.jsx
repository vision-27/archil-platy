// Small presentational helpers shared by every view.

const paths = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  chevron: 'M9 6l6 6-6 6',
  alert: 'M12 8v5M12 16.5v.01M10.3 3.9L2.6 17.3A2 2 0 004.3 20h15.4a2 2 0 001.7-2.7L13.7 3.9a2 2 0 00-3.4 0z',
  info: 'M12 11v5M12 8v.01M12 21a9 9 0 100-18 9 9 0 000 18z',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  flask: 'M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 006 21h12a1.7 1.7 0 001.5-2.5L14 9V3M7.5 14h9',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  box: 'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z',
  file: 'M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5zM14 3v5h5',
  play: 'M7 5v14l11-7L7 5z',
  refresh: 'M20 11a8 8 0 10-2.3 5.7M20 4v7h-7'
};

export function Icon({ name, label }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      <path d={paths[name]} />
    </svg>
  );
}

export function Status({ tone = 'none', live = false, children }) {
  return <span className={`pc-status s-${tone}${live ? ' live' : ''}`}>{children}</span>;
}

export function Note({ tone = 'info', children }) {
  return (
    <div className={`pc-note pc-note-${tone}`} role={tone === 'bad' ? 'alert' : 'status'}>
      <Icon name={tone === 'ok' ? 'check' : tone === 'info' ? 'info' : 'alert'} />
      <div>{children}</div>
    </div>
  );
}

export const short = hash => (hash ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : '—');
export const time = iso => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—');
export const bytes = n => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// One place that turns a run into a headline status the whole UI agrees on.
export function runVerdict(run) {
  if (!run) return { tone: 'none', label: 'Unknown' };
  switch (run.status) {
    case 'queued': return { tone: 'accent', label: 'Queued', live: true };
    case 'preparing': return { tone: 'accent', label: 'Preparing', live: true };
    case 'running': return { tone: 'accent', label: 'Running tests', live: true };
    case 'interrupted': return { tone: 'part', label: 'Interrupted' };
    case 'failed': return { tone: 'bad', label: 'Experiment failed' };
    case 'completed': {
      const s = run.result?.summary;
      if (!s) return { tone: 'part', label: 'Completed' };
      if (s.failed > 0) return { tone: 'bad', label: `${s.failed} of ${s.total} failed` };
      return run.approval ? { tone: 'ok', label: 'Approved (simulated)' } : { tone: 'ok', label: `${s.passed}/${s.total} passed` };
    }
    default: return { tone: 'none', label: run.status };
  }
}

export const runnerLabel = runner => (runner === 'archil' ? 'Archil sandbox' : 'Local mock');
