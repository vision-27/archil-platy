# Platypus workflow lab backend

Local backend for **Platy Builds Platy**. It reads Northstar Agency documents from an Archil disk, discovers and ranks opportunities, generates Python and an HTML application using the host's ChatGPT-authenticated Codex CLI, tests the software in Archil, and evolves it when the supported Finance policy changes. The earlier bundled JavaScript workflow lab remains available separately.

Requires Node 22.19+, Codex CLI with a ChatGPT login, and Archil credentials. Uses native HTTP and SQLite plus the official `disk` SDK pinned to 1.12.1. No OpenAI API key or production connector is used. Subscription limits still apply; there is no automatic API billing fallback.

## Start

From the repository root:

```powershell
npm.cmd ci --prefix backend
npm.cmd start --prefix backend
```

Company API: http://127.0.0.1:4310/api/company
Health: http://127.0.0.1:4310/health

SQLite records and retained artifacts live in `backend/.data/`. Set `PLATY_DATA_DIR` to a different directory for an independent rehearsal. One server owns a data directory at a time, and only one experiment runs at a time. Shutdown waits for active work; crash recovery marks unfinished work interrupted and never reruns it automatically.

## Configure Archil

Create `.env` in the repository root using `.env.example`:

```dotenv
ARCHIL_API_KEY=your-key-here
ARCHIL_REGION=aws-us-west-2
ARCHIL_NETWORK_MODE=deny-all
PORT=4310
CODEX_MODEL=gpt-6.1-sol
```

Restart the backend after environment changes. Environment variables override `.env`. Secrets are read by the host only; they are not passed into sandbox environment variables or artifacts. Root `.env` is ignored by Git. Never paste keys into UI fields or commit them.

## Company loop

Run `codex login status` to verify the host is logged in using ChatGPT. If needed, use `codex login` interactively. Do not copy authentication tokens into the application or share them with frontend developers. The adapter invokes ephemeral Codex sessions with tool integrations disabled, structured JSON output, an isolated working directory and a bounded timeout. Generated Python never executes on the host.

```powershell
npm.cmd run rehearse:company --prefix backend
```

This resumes saved discovery/versions when available and clearly prints reuse. Otherwise it performs live discovery, build and policy evolution. It then executes four actual Archil preview calls, verifies HTML delivery and records simulated approval. Evidence is saved in `backend/.data/company/rehearsal.json`. It does not claim browser interaction testing.

For the full generated-HTML check, run the development bridge in another terminal, then use the browser-enabled rehearsal:

```powershell
npm.cmd run preview:check --prefix backend
# In another terminal, with the API still running:
npm.cmd run rehearse:company --prefix backend -- --browser
```

The bridge harness is at `http://127.0.0.1:4311`. It is a developer test utility, not the product frontend. The browser check uses a disposable headless Edge profile on Windows; on other platforms install Playwright Chromium with `npx playwright install chromium` from `backend`. It checks the actual generated baseline and updated app through their iframe message bridge and real Archil execution, saving JSON evidence and screenshots under `backend/.data/company/`. No existing browser login or profile is used.

For a genuinely fresh live rehearsal, stop the backend, then run `npm.cmd run reset:company --prefix backend` and restart. Reset first archives the complete company state locally and in `evidence/` on the same disk; then it restores the five synthetic source files and removes the current synthetic policy. Immutable software, execution evidence and older workflow-lab records remain retained. The exclusive owner lock prevents resetting a running backend. Full live discovery and generation take minutes; a 90-second presentation should use clearly labelled saved results or be rehearsed around those waits.

The workflow is `POST /api/company/discover`, then `/build`, then `/evolve` with the exact Finance policy, with `/run` for interactive client execution. Poll `/api/company/jobs/:id`. See the portable [frontend handoff](../FRONTEND-HANDOFF.md) for all schemas and the iframe bridge.

One persistent company disk holds `company/`, `memory/`, `versions/<id>/selected/` (older runs use `attempt-N/`), `evidence/<id>.json` and `executions/<id>/`. Its identity is saved in `backend/.data/company/disk.json`; `ARCHIL_COMPANY_DISK_ID` optionally selects an existing disk. Each serverless invocation mounts only the selected version read-only plus its own writable execution directory. It explicitly requests deny-all egress on that call; no independent network probe is claimed. It uses Python 3.12, 1 vCPU, 512 MiB and bounded execution/output. Disk storage and execution can incur Archil charges.

Discovery is not given a preferred winner. Ranking uses recorded synthetic effort with difficulty/risk penalties, not promised time savings. The independent acceptance contract supports onboarding only; another selection produces an explicit limitation. Evolution supports the exact documented Finance policy, not arbitrary policy understanding. The model generates real source and tests; the backend's 12 independent cases cover missing documents, invalid deals, duplicate/partial completion and the strict $10,000 threshold. Each of three concurrent candidates gets one initial build plus at most two repairs (up to nine model calls). Generated tests must also pass.

Build and evolve prepare a Python sandbox with company files and specification on its root filesystem, stop it to commit a checkpoint, then call the official sandbox `fork()` three times. Each fork inherits verified context, has no mounted company disk, and reports deny-all egress before code runs. Host-side model calls generate three approaches concurrently. All face the same independent checks. Selection uses fewest attempts, then shortest workflow source, then label; it is a deterministic demo heuristic, not proof of superior software. The selected exact files are copied to the company disk and tested again. Base and child sandboxes are stopped and retained, including unsuccessful attempts. Their storage can remain billable. `job.forks` and `version.forks` expose IDs, progress, tests and cleanup status.

Approval requires the latest passing version, its exact source/result hashes, unchanged company sources and matching remote source files. Approval is simulated and never deploys anything. The last approved version remains active when a candidate fails. Preview runs are allowed for a selected passing version before approval, using synthetic data only. Restart marks unfinished jobs interrupted and never replays paid work.

Use a same-origin frontend proxy for `/api`. The backend binds to loopback and does not enable public CORS or authentication. Generated HTML must remain in `sandbox="allow-scripts"` without `allow-same-origin`. The preview response adds a restrictive CSP. The frontend is responsible for the bounded, explicitly enabled message bridge; the integrated Platyform UI in frontend/ supplies that bridge. Run node backend/scripts/verify-product.mjs from the repository root with both servers running for product verification.

The builder must generate buttons with click listeners, not forms: this sandbox blocks form submission before submit handlers run. The backend rejects generated `<form>` elements and supplies the failure to the bounded repair loop. Payloads must match the API exactly; extra application fields are rejected, not silently forwarded.

## Earlier bundled workflow lab

The remaining sections describe the older prewritten access-repair demo, retained for compatibility. Its sandbox lifecycle and policy readback differ from the new company's serverless execution.

`deny-all` explicitly requests zero egress and checks the effective policy before running. Archil documents custom network policies on Developer plans and above. For a Free account, explicitly set `ARCHIL_NETWORK_MODE=managed`; the adapter requires the provider to report `managed: true` and deny-by-default. That mode permits Archil's managed destinations and is not a fully offline sandbox. There is no automatic weakening after a denied policy request.

Each run creates a 1-vCPU/512-MiB sandbox from `node:22-bookworm-slim`, requests a 300-second session TTL and 60-second idle TTL, uploads only the bundled source/fixtures, and records an image digest if the provider supplies one (otherwise null). The sandbox runs the exact same harness as local mode. It is stopped after execution; persistent root files are kept. Stopped remote disks may incur storage charges. Run records include their sandbox IDs for deliberate cleanup in the Archil console. We do not delete demo evidence automatically.

Network verification here means effective-policy API readback, not independent verification of every network path. This demo is not a production security boundary. Local mode runs trusted bundled code in a child process with a minimal environment and is not suitable for arbitrary untrusted programs.

## Rehearse

Keep the server running, then in another PowerShell terminal:

```powershell
npm.cmd run rehearse --prefix backend -- local
npm.cmd run rehearse --prefix backend -- archil
```

Each command creates two new runs. Version 1 must fail only the hold case (4/5 pass); version 2 must pass all five. The script then records simulated approval bound to the corrected workflow and result hashes. Provider requests are real only in `archil` mode. Calls remain entirely synthetic business operations in either mode.

To verify root files survive a stop/start without rerunning a workflow:

```powershell
node backend/scripts/verify-retention.mjs <completed-archil-run-id>
```

## Tests

```powershell
npm.cmd test --prefix backend
```

Tests exercise real local child processes, SQLite persistence/recovery, exact approval, HTTP boundaries, duplicate request prevention, artifact tampering, scenario assertions, and the Archil SDK adapter with an injected provider. These tests alone do not establish live Archil execution; see `docs/VALIDATION.md` for the separately recorded live rehearsal.

## Change the story

- `scenarios/access-repair.json`: provisional company records, policy, and independent scenario expectations.
- `workflows/access-v1.mjs`, `access-v2.mjs`: explicitly prewritten demonstration workflows.
- `execution/gateway.mjs`: stateful mock tool implementation; records every action.
- `execution/harness.mjs`: resets state for each case and checks outcomes independently of workflow code.
- `src/catalog.mjs`: workflow catalog and record-based mismatch detection.

The service API accepts only catalog IDs, not arbitrary uploaded code, shell commands, credentials, or production destinations. Changing a workflow/fixture/harness changes the bundle hash and requires a new experiment before approval. Test assertions are not rewritten by workflow correction.

API details: [docs/API.md](docs/API.md). Integrated product setup: root `README.md`.

## Real, simulated, and deferred

Real: local HTTP API, SQLite, hashing, process execution, Archil SDK integration, remote sandbox lifecycle, artifact transfers, policy readback.

Simulated: company data, CRM/billing/onboarding, business writes, approval. Workflow/scenario generation and correction are prewritten, not live AI.

Deferred: final user story, frontend integration, Keenable research, live LLM generation, branches/checkpoints, arbitrary workflow uploads, production deployment and multi-tenant authentication.

Archil references checked before implementation:
- https://docs.archil.com/getting-started/quickstart
- https://docs.archil.com/compute/sandboxes/introduction
- https://docs.archil.com/compute/sandboxes/firewall
- https://docs.archil.com/sdks/typescript
