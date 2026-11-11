# Platyform — frontend context

This is a context brief, not a transfer of ownership. Implementation is continuing in parallel. Coordinate before editing the active frontend entrypoint or styles so changes do not overwrite each other.

## What we are building

Platyform is a platform that understands a company's operations, discovers problems worth solving, builds the software to solve them, and adapts that software as the company changes.

The current product story is:

**Connect systems → discovery agents find opportunities → three workflows build concurrently in Archil → review and approve each workflow → see its release and impact.**

The three workflows are **client onboarding, monthly reporting, and invoice approvals**. Each gets its own Archil sandbox fork. These are three different workflows, not three competing implementations of onboarding. That backend change is implemented and undergoing live validation.

## Design direction

The previous UI felt like a hardcoded hackathon walkthrough. It exposed too many files, logs, tests, hashes and version numbers. The redesign should feel like a calm, useful operating platform.

- Persistent workspace sidebar: Connections, Discoveries, Workflows, Impact.
- Restrained neutral colors, subtle green accents, generous space and compact typography. Use the Platy mascot sparingly.
- One obvious next action per screen. Put code, source citations, sandbox IDs and full test evidence in optional details.
- Show business outcomes first: “Waiting for Finance approval” is more useful than a raw status enum or a test table.
- Make it clear what Platy is doing automatically, what is ready for review, and what still needs a person.
- Use real backend state. No invented progress percentages, test results, build success or live activity.

### Connections

Present familiar systems such as HubSpot, Slack, company documents and spreadsheets. For this hackathon they are **sample exports**, not working OAuth integrations. Label the workspace as a sample company and the connection action accordingly. Do not claim a real customer account is connected.

### Discoveries

Show the actual discovered problems, short explanations, source evidence on demand, and the current manual effort associated with each. Discovery already reads the company files and produces cited opportunities.

Starting discovery in a fresh workspace should also authorize the automatic build after discovery completes. Loading saved work must not silently trigger fresh model or compute work. Saved results must be distinguishable from an active run.

### Workflows

Show three independent cards: onboarding, reporting, invoices. Each has a name, one-line purpose, actual state, test summary and its own review/release action. One failed workflow must not hide successful siblings.

Inside a workflow, prefer a simple visual process and a concise behavior comparison over a wall of code. The generated app can be opened as a secondary view.

### Make changes understandable

Version numbers alone do not communicate the demo. Show the business difference using actual test outputs:

- Original onboarding: an eligible $18,000 client proceeds when documents are complete.
- After the new policy: that client waits for Finance approval.
- An $8,000 client still proceeds.
- Exactly $10,000 does not require Finance approval.
- An approved $18,000 client proceeds; repeating the request creates no duplicate actions.

Highlight the added Finance approval node in the workflow. Never imply a meaningful behavior change merely because another version was generated.

### Release and impact

The user wants an approval-to-production story. In this implementation, call the destination **Demo production** and label the release **simulated**. Approval records an exact tested version; it does not deploy real integrations or change real accounts.

Impact should distinguish:

- Actual counts from synthetic executions, such as completed runs, blocked runs, and duplicate suppression.
- Recorded manual effort from the synthetic timesheets, which is an opportunity estimate, not realized time savings.
- Realized business impact, which is not measured. Do not invent ROI, money saved, or customer outcomes.

## Backend that already works

- Live company discovery and source citations.
- Real model-generated Python, HTML, tests and README.
- Real Archil execution, persistent company files and sandbox forks.
- Independent host-authored business checks plus model-generated tests.
- Bounded repair attempts and exact source/result hashes.
- Policy evolution and tested before/after comparison.
- Exact-version simulated approval.
- Interactive generated app execution through a bounded iframe bridge.

The earlier onboarding implementation passed a live three-candidate fork build and product browser verification. That verifies the previous implementation; the new three-different-workflow behavior is still under implementation and must be verified separately.

## API integration

All requests use the application's same-origin `/api` proxy. Do not put provider credentials in the frontend.

POST requests send JSON and `X-Platy-Demo: 1`. Long-running operations return HTTP 202 with `{ job }`; poll `GET /api/company/jobs/:id` approximately once per second.

Stable operations:

| Method and route | Purpose |
| --- | --- |
| `GET /api/company` | Workspace, files, discovery, versions, jobs and approved release state |
| `POST /api/company/discover` | `{requestKey}`; discover company workflows |
| `POST /api/company/build` | Legacy onboarding build |
| `POST /api/company/evolve` | `{requestKey, policyText}`; supported Finance policy update |
| `GET /api/company/jobs/:id` | `{job}` including state, events and fork progress |
| `GET /api/company/versions/:id` | `{version}` including files, tests, hashes and approval |
| `GET /api/company/versions/:id/preview` | Sandboxed generated HTML |
| `POST /api/company/run` | `{requestKey, versionId, input}`; execute that version |
| `POST /api/company/versions/:id/approve` | `{sourceHash, resultHash}`; exact-version simulated approval |

**In progress — verify final shapes before relying on them:** `POST /api/company/build-all` with `{requestKey}` builds three different workflows concurrently. The result contains `versionIds`, `successes` and `failures`; each version/fork identifies its `workflowId` and `workflowName`. Canonical workflow IDs are `onboarding`, `reporting`, `invoices`. The workspace will track approved releases independently per workflow in `activeVersions`. Each workflow has a different validated input contract; do not send onboarding inputs to reporting or invoices.

Job states: `queued`, `running`, `completed`, `failed`, `interrupted`. Version states: `candidate`, `passed`, `approved`, `failed`. Fork rows progressively expose status, sandbox ID, summary, attempts and test counts. A completed batch may contain individual failed workflows; inspect each version.

Use a stable unique request key for each deliberate operation. Retry a lost request with the same key. Show backend errors and retained prior working versions instead of inventing success.

Exact supported policy text:

> All clients with contracts over $10,000 must receive Finance approval before onboarding can proceed.

## Generated app boundary

Render generated HTML only inside `iframe sandbox="allow-scripts"`. Do not add same-origin, form, popup or navigation privileges.

The app sends `{type:'platy:run', requestId, input}` to its parent. The parent verifies `event.source`, requires explicit interaction enablement, binds the request to the displayed version, permits one in-flight request and caps calls. It calls the backend, polls the job, and returns `{type:'platy:result', requestId, ok, output, error}` to that same iframe.

Never accept a URL, version override, command or credentials from generated HTML. Never fabricate an execution result. The backend enforces each workflow's input and output rules.

## Collaboration now

The current session is rebuilding the platform shell and user flow while backend work adds the three-workflow batch. Helpful parallel contributions are design feedback, copy refinements, workflow-specific presentation ideas, or an agreed separate component. Before changing shared entrypoints/styles, agree on file ownership and get the latest implementation.

Acceptance is a clean, rehearsable end-to-end experience. Keep the implementation small. No framework migration, connector OAuth, production deployment, agent swarm visualization or large analytics system is needed for this hackathon.
