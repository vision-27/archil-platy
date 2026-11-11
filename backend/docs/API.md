# Workflow lab backend contract

API base: `http://127.0.0.1:4310`. Bind is loopback only. Use your frontend dev server's `/api` proxy (target this base) so browser calls remain same-origin. Backend does not serve frontend assets or enable CORS. This is a local single-user demo API, not a hosted tenant service.

All POSTs require `Content-Type: application/json` and `X-Platy-Demo: 1`. Payload limit is 16 KiB. Error shape: `{ "error": { "code": "...", "message": "..." } }`. Display failures; do not silently change runners or replay mutations with a new request key.

## Catalog and evidence

`GET /api/catalog` returns `schemaVersion`, `company`, `policy`, `context` (CRM, billing, onboarding records), calculated `findings` with record/field evidence, `workflows`, `scenarioSetId`, `scenarios`, `runners`, and `honesty`.

Each workflow has `id`, `version`, `name`, `description`, `generation: "prewritten"`, `code`, `workflowHash`, and `bundleHash`. Workflow IDs currently are `access-v1` and `access-v2`. Scenario IDs: `normal-paid`, `customer-on-hold`, `duplicate-event`, `missing-identity`, `uncertain-write`.

Runner availability is configuration only; it is not proof of successful provider connectivity. Show `run.runner` as the actual execution mode. Company context and story are provisional synthetic fixtures; generation and correction are prewritten.

## Create and inspect an experiment

```js
const requestKey = crypto.randomUUID(); // retain until the outcome of this request is known
const response = await fetch('/api/runs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Platy-Demo': '1' },
  body: JSON.stringify({ workflowId: 'access-v1', runner: 'archil', requestKey })
});
const { run, reused } = await response.json();
```

New request: 202. Exact request-key replay: 200 and the same run. Reusing a key for changed workflow/runner/bundle: 409. Only one active experiment is allowed (409 `run_in_progress`). Missing Archil configuration: 503, never local fallback. Unknown workflow IDs or arbitrary source code in the request are rejected.

`GET /api/runs` returns `{ runs: [...] }`, most recent first. `GET /api/runs/:id` returns `{ run }`. Poll at 500–1000 ms only while status is `queued`, `preparing`, or `running`.

Run fields:

| Field | Meaning |
| --- | --- |
| `id`, `workflowId`, `workflowVersion` | Experiment and bundled workflow identity |
| `workflowHash`, `bundleHash` | SHA-256 of exact source; hash of source, fixture, gateway and harness files |
| `runner` | `local` or `archil` |
| `status` | `queued`, `preparing`, `running`, `completed`, `failed`, `interrupted` |
| `createdAt`, `updatedAt`, `completedAt` | ISO timestamps; completedAt initially null |
| `sandboxId`, `sandboxStatus`, `workspacePath` | Real provider metadata when created; null for local runs |
| `runtime` | Local Node version or Archil base image and image digest (null when unavailable) |
| `events` | Ordered `{ sequence, at, message }` progress records |
| `safety` | Synthetic-data, external-integration, policy-readback and demo-boundary disclosures |
| `result`, `resultHash` | Validated report and exact result artifact hash; null until completion |
| `artifacts` | `{ name, sha256, bytes, url }` for retained local copies |
| `approval` | Null or exact-version simulated approval record |
| `error`, `cleanupWarning` | Failure information; cleanupWarning is optional |

`completed` means the experiment completed, not that every test passed. The deliberate first-version failure is `completed` with `result.summary.failed: 1`. A runner/protocol failure is `failed` with no approvable report. A server restart marks unfinished runs `interrupted`, preserving IDs and artifacts without automatically running anything again.

`result.summary` is `{ total, passed, failed }`. Each `result.scenarios[]` entry contains:

- `id`, `name`, `passed`, `explanation`.
- `assertions[]`: `{ id, label, expected, actual, passed }`.
- `actions[]`: `{ sequence, system, operation, input, output, simulated: true }`.
- `deliveries[]`: one workflow decision per delivery; the duplicate scenario has two deliveries against the same state.
- `before`, `after`: independent mock company state for that scenario.

The uncertain-write scenario grants simulated access once, then loses the response. A second event must not cause another write. Passing that test means uncertainty was handled as expected; it does not mean a real business outcome was verified.

## Artifacts

`GET /api/runs/:id/artifacts/:name` returns text after verifying its recorded SHA-256. Only names already in the run's artifact list are accessible; arbitrary paths are rejected. Types include workflow, fixture, harness, manifest, result, process output, and network-policy JSON.

The artifact URLs serve local retained copies. On Archil, uploaded inputs, manifest, result, and network policy also live in `/workspace` on the sandbox's persistent root disk. The sandbox is stopped after execution, not deleted. Root files survive stopping; deleting the sandbox deletes that remote copy. No additional disk, branch or checkpoint is claimed.

## Simulated approval

```js
await fetch(`/api/runs/${run.id}/approval`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Platy-Demo': '1' },
  body: JSON.stringify({ decision: 'approve', workflowHash: run.workflowHash, resultHash: run.resultHash })
});
```

Returns `{ run }`. Approval requires every scenario passing, unchanged current workflow/test bundle, matching workflow/result hashes, and retained artifact integrity. Repeating the same approval preserves the original timestamp. No deployment, provider write or authorization grant occurs. Button copy should say **Record simulated approval**.

## UI ownership and integration

Claude owns planned frontend work; Codex owns backend. Reuse browser Platyform assets from the source path in the root `CLAUDE-HANDOFF.md`. The user will supply the final story. Do not hard-code run IDs, fake provider progress, label prewritten correction as agent-generated, or change backend files to make a visual scenario pass.
