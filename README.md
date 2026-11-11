# Platy Builds Platy

The supplied Platyform browser UI is integrated in `frontend/`. It uses the real backend by default through Vite's same-origin `/api` proxy. Company data and business actions are synthetic; discovery, code generation, Archil execution and fork evidence are real. Previously completed work is labelled saved results.

## Run

Requires Node 22.19+, a ChatGPT-authenticated Codex CLI, and the root `.env` Archil configuration described in `backend/README.md`.

```powershell
npm.cmd ci --prefix backend
npm.cmd ci --prefix frontend
npm.cmd start --prefix backend
```

In a second terminal:

```powershell
npm.cmd run dev --prefix frontend
```

Open **http://127.0.0.1:5173**. No frontend API key or manual connection setup is needed. `?mock=1` deliberately selects labelled UI-only mock data. Normal loading uses the real backend.

## Demo

1. **Connections:** load the supplied Northstar system snapshots. A new workspace starts live discovery, then automatically builds its workflows. Existing results are clearly labelled saved.
2. **Discoveries:** review the three opportunities, their explanations and optional source citations. Manual hours are recorded sample effort, not realized savings.
3. **Workflows:** onboarding, reporting and invoice approvals build concurrently in three separate Archil forks. Each has its own generated app, checks and release decision. One failure does not erase passing siblings.
4. **Review:** see the workflow as a short process. For onboarding, compare the actual old/new client decisions: $18,000 waits for Finance under the policy, while $8,000 and exactly $10,000 preserve the original route.
5. **Approve & release:** activate an exact tested version in **Demo production**. This is a simulated release; no real connector or deployment runs.
6. **Impact:** run approved workflows against sample clients, reports or invoices. Counts come from actual synthetic executions. Realized business impact remains unmeasured.

The generated apps remain available through ?Open generated app,? with explicit interaction enablement. Full tests, code, version history and sandbox IDs are behind optional evidence views.

A fresh build takes minutes. The three-workflow endpoint is `POST /api/company/build-all`; a batch can complete with partial failures, so inspect its per-workflow results. Each workflow has its own input contract and approved release in `activeVersions`. Policy evolution currently supports the documented Finance rule only.

## Verify

```powershell
npm.cmd test --prefix backend
npm.cmd run build --prefix frontend
# With backend and frontend running, and a completed three-workflow build:
node backend/scripts/verify-product.mjs
```

The product check drives all three actual generated apps through the redesigned UI, verifies approval gates and successful approved inputs in Archil, records independent simulated releases, and checks persistence and mobile overflow. It performs real compute calls and records a simulated approval. Evidence and screenshots stay under `backend/.data/company/`.

The original supplied ZIP is preserved. The previous frontend entrypoint and source are archived in `backend/.data/frontend-before-platyform.zip`. Active application source is `frontend/index.html`, `frontend/src/company-app.js` and `frontend/src/platform.css`; changes can be made directly here.
