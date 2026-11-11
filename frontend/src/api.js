// Thin client for the workflow-lab backend (contract: backend/docs/API.md).
// Calls are same-origin; Vite proxies /api and /health to 127.0.0.1:4310.

export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json', 'X-Platy-Demo': '1' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    // No response at all: the caller may safely replay a POST with the SAME request key.
    throw new ApiError(0, 'network', 'Could not reach the workflow-lab backend. Is it running on port 4310?');
  }
  const isJSON = (response.headers.get('content-type') ?? '').includes('application/json');
  const payload = isJSON ? await response.json().catch(() => null) : await response.text();
  if (!response.ok) {
    const error = isJSON ? payload?.error : null;
    throw new ApiError(response.status, error?.code ?? 'http_error', error?.message ?? `Request failed (${response.status}).`);
  }
  return payload;
}

export const api = {
  health: () => request('/health'),
  catalog: () => request('/api/catalog'),
  runs: () => request('/api/runs').then(data => data.runs),
  run: id => request(`/api/runs/${id}`).then(data => data.run),
  start: ({ workflowId, runner, requestKey }) => request('/api/runs', { method: 'POST', body: { workflowId, runner, requestKey } }),
  approve: run => request(`/api/runs/${run.id}/approval`, { method: 'POST', body: { decision: 'approve', workflowHash: run.workflowHash, resultHash: run.resultHash } }).then(data => data.run),
  artifact: (id, name) => request(`/api/runs/${id}/artifacts/${name}`)
};

export const ACTIVE = ['queued', 'preparing', 'running'];
export const isActive = run => ACTIVE.includes(run?.status);
