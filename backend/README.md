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
Archil references checked before implementation:
- https://docs.archil.com/getting-started/quickstart
- https://docs.archil.com/compute/sandboxes/introduction
- https://docs.archil.com/compute/sandboxes/firewall
- https://docs.archil.com/sdks/typescript
