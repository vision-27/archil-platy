# Backend validation — 10 November 2026 (Pacific)

## Current platform: three different workflows

The redesigned UI has Connections, Discoveries, Workflows and Impact. Full code, sandbox IDs and detailed tests are optional evidence; onboarding compares actual before/after behavior. Demo connections, releases and business effects are explicitly synthetic/simulated. Impact counts completed synthetic jobs with actions or blocking reasons; manual effort is not labelled realized savings.

`npm.cmd test --prefix backend`: **42 passed**. Frontend production build passed. New coverage includes three different concurrent workflows, partial failure preservation, per-workflow exact approval, old-record migration, recovery of all specifications and rejection of unsupported policies.

Real batch `f74a6db2-dade-4084-b696-83f2448308a6` was started by clicking Connect sample systems in the redesigned UI. It recovered all three specifications via live discovery, then started three model calls together at `2026-11-11T04:53:06.607Z` (invoices one millisecond later). All passed on their first attempt and were re-tested after promotion to the company disk. All forks were stopped.

| Workflow | Version | Sandbox | Independent checks |
| --- | --- | --- | --- |
| Onboarding | `b7d59d62-ca1d-4050-a862-a4ee59617dae` | `01a1c8f3-a128-7254-adc9-a8a0746bac73` | 12/12 |
| Reporting | `80b8b48f-2f0f-4ed2-abc7-207702f7c2e0` | `01a1c8f3-a125-7061-b859-ec8ed81275a8` | 7/7 |
| Invoices | `eb613d9a-157d-4c1e-b58b-6312b30ee39d` | `01a1c8f3-a126-77fb-b939-fb0048a2a656` | 9/9 |

The product browser check passed at `2026-11-11T04:59:16.258Z`: six real generated-app requests, two per workflow. Each held at the required approval gate, then completed with approval. All three exact-version simulated releases persisted independently after reload. Actual generated UIs differed: onboarding checklist, reporting review desk, invoice/PO routing. Test locators were adjusted for reporting's approval toggle button and invoices' Evaluate routing button; generated files were not modified. No page errors, desktop screenshots inspected, and 390px layouts had no horizontal page overflow.

A separate intercepted-browser contract check verified Connect ? discover ? build-all starts exactly once for a fresh workspace. That orchestration check used synthetic HTTP responses and is distinct from the real batch and six real executions above.

Evidence retained locally: `parallel-workflows.json`, `platform-verification.json` and `platform-*.png` under the company evidence directory. These contain actual run receipts but are excluded from Git. Remote version evidence remains on the company disk. Real network connections, production deployment and realized ROI are not claimed.

## Current company-loop automated checks

`npm.cmd test --prefix backend`: **36 passed, 0 failed**. In addition to the older lab tests, coverage includes cited discovery/ranking, strict generated-workflow inputs, independent policy/threshold/idempotency checks, fake-transport discover/build/evolve/run/approve, request replay and concurrency, restart interruption, three-attempt repair limits, remote code/source tampering, sandbox HTML headers, generated-form rejection/repair, shutdown during approval, and CLI diagnostic/tool-call handling. Model/disk doubles in these tests are not live-provider evidence.

The company loop uses the host's ChatGPT-authenticated Codex CLI (`gpt-6.1-sol`) and real Archil serverless execution on the same persistent disk. A first live rehearsal passed workflow tests and API execution but exposed generated HTML bridge errors during browser testing. Those earlier runs were archived completely as `611979d0-f4b4-4edc-84d4-2656a7db3f19`, locally under `company/history/` and remotely under `evidence/`; they are not represented as successful browser acceptance.

Generated forms are now rejected because `sandbox="allow-scripts"` blocks form submission before submit handlers run. The builder is explicitly constrained to the API's exact input shape and click-driven controls. Current live/browser evidence is recorded by `rehearse:company -- --browser` and its per-version JSON/screenshot artifacts. See the final rehearsal entry below when available.

## Final company rehearsal: live and browser verified

Completed on 10 November 2026 Pacific (11 November UTC), using disk `dsk-00000000001186f4` in `aws-us-west-2`. All four generation receipts came from live `gpt-6.1-sol` calls through the host's ChatGPT login: two discovery roles, baseline builder, and policy evolution. No OpenAI API key was used. Discovery ranked onboarding first from three cited opportunities; its 30 monthly hours describe synthetic recorded effort, not measured savings.

| Version | ID | Independent checks | Generated tests | Browser bridge |
| --- | --- | --- | --- | --- |
| Original SOP | `b59925d2-75e8-4267-ba4f-085c971f100f` | 12/12 passed | Passed | 4 real browser-to-Archil requests passed |
| Finance policy | `d64d81dd-625a-41c9-bd91-edb52104bd91` | 12/12 passed | Passed | 5 requests passed, including duplicate submission |

Both versions passed on their initial generation attempt. Evaluating the original software under the new policy yielded 5/12 passing and 7 failing cases (including missing Finance checklist requirements). The $18,000 unapproved case returned `completed` where the policy required `needs_finance_approval`; this was a real policy assertion failure, not a crash or timeout.

The isolated headless browser used the actual generated HTML, the sandboxed iframe and reference bridge, and real Archil compute. Baseline: $18,000, $8,000, exactly $10,000 and Finance-approved $18,000 all completed. Updated app: unapproved $18,000 blocked; $8,000 and exactly $10,000 completed; approved $18,000 completed; repeating that completed request recorded zero new actions. Nine browser-driven requests total. A test locator was widened to accommodate the generated labels "Finance approval" and "Finance approved"; no generated result was changed to satisfy the test.

Exact simulated approval was recorded for v2 at `2026-11-11T03:56:13.447Z`. Restarting the backend retained that approved active version. The preview was read back from Archil and matched the retained generated HTML; remote `memory/state.json` and `evidence/<version-id>.json` matched the active version, approval and result hash.

Retained proof under `backend/.data/company/`: `rehearsal.json`, `browser-<version-id>.json`, and `preview-<version-id>.png`. These are execution evidence, not frontend product acceptance. The reference bridge is a developer utility. The supplied product UI is now integrated in frontend/ and has its own product verification script.

Limits: one synthetic company, onboarding acceptance rules, and the exact Finance policy. No real CRM/Slack/email/payment integration, general policy watcher, arbitrary workflow acceptance, public hosting or production deployment is implemented. Serverless egress deny-all was requested per call; no independent network probe was performed. A complete fresh generation takes minutes; saved runs must be labelled as saved during a short demonstration.

Von supplied an independent description-only reasoning review through Relay. No code inspection or independent execution by Von is claimed. Its host-owned trust-display and expected-policy-failure guidance is explicit in the portable frontend handoff.

## Parallel fork live verification

Job `755003b0-88fb-4960-8d93-fdb1786d9b08` created version `daccf75e-42cc-4eb5-8a5a-ca0bce655a8f`. Base sandbox `01a1c8da-99ee-7064-9416-ac55134d0aa2` was stopped with committed checkpoint `sandbox-01a1c8da-99ee-7064-9416-ac55134d0aa2-epoch-1`. Three actual SDK sandbox forks inherited byte-verified company files and specification, with no mounted company disk.

| Candidate | Sandbox ID | Independent checks | Outcome |
| --- | --- | --- | --- |
| A | `01a1c8da-c829-73d2-8b98-ec982aaba903` | 12/12 | Passed, stopped |
| B | `01a1c8da-c827-7932-92cb-ab8e1c178b59` | 12/12 | Passed, stopped |
| C | `01a1c8da-c826-7037-9524-de71908250e9` | 12/12 | Selected, stopped |

All generated unittest suites passed on the first attempt. Three live model calls started together at `2026-11-11T04:26:03.206Z` and overlapped. Candidate pipelines ran concurrently; their individual test commands were brief and did not all overlap. Fork C won the documented deterministic heuristic. Its exact source bytes were copied to `versions/<version-id>/selected` on the company disk and passed generated tests plus 12/12 independent checks again. The baseline still failed 7/12 checks under the new policy. Total job time was approximately 3 minutes 20 seconds.

Effective deny-all egress was read back from each fork before execution; no independent network probe or production security claim is made. Base and forks were stopped and retained, not deleted. The final implementation disables idle expiry during host-side generation while retaining a 900-second hard lifetime; the successful live run used the earlier 300-second idle setting. No model or Archil credentials were uploaded. Evidence: `backend/.data/company/parallel-forks.json` plus version evidence on the company disk.

The selected generated HTML passed five real requests through the reference browser bridge, including strict threshold handling and duplicate suppression. An initial verification attempt started before the version became available in the dropdown; rerunning after completion passed. Backend restart retained the selected version and fork records.

The 36 automated tests additionally cover concurrent generation, one-candidate failure, deterministic selection, failed promotion, cleanup, missing checkpoints, unexpected network policy, corrupted inherited context and mutated source. Injected SDK tests are separate from the live evidence above.

## Integrated Platyform product verification

The supplied ZIP UI is now the active application in `frontend/`, served through the existing Vite proxy. Real backend mode is the default; `?mock=1` explicitly selects labelled mock data. The original archive and a backup of the earlier frontend remain preserved.

`node backend/scripts/verify-product.mjs` passed at `2026-11-11T04:36:40.665Z` against version `daccf75e-42cc-4eb5-8a5a-ca0bce655a8f`. Five browser-driven requests traversed the product's own iframe bridge and actual Archil compute: unapproved $18,000 blocked, $8,000 completed, exactly $10,000 completed, approved $18,000 completed, and duplicate submission executed zero new actions. The test recorded exact-version simulated approval through the UI, reloaded the page, and verified approval and all three saved fork cards persisted. The 390px company layout had no horizontal page overflow; there were no JavaScript page errors. Desktop fork/application and mobile screenshots were inspected. This does not claim every mobile interaction or a new full discovery run through the UI was exercised.

The browser check exposed and fixed premature stage reset during initial workspace loading. Test locators were adjusted for the generated button's trailing arrow. Test rows now show concise statuses with expandable complete evidence, rather than unbounded JSON in narrow columns. Saved model output is labelled saved. The frontend production build passed.

Evidence: `backend/.data/company/product-verification.json`, `product-forks.png`, `product-app.png`, `product-mobile.png`. Commands and the demo path are documented in the root README; frontend work continues directly in the integrated application, with no separate frontend handoff required.

## Earlier bundled workflow lab: automated checks

`npm.cmd test --prefix backend`: 11 passed, 0 failed, 0 skipped. Covers independent scenario assertions, response-loss/deduplication, real local child-process execution, SQLite persistence and single-server ownership, exact approval and replay, artifact tampering, interruption recovery, HTTP origin/host/input boundaries, and the injected Archil adapter contract. The HTTP Host test uses Node's raw HTTP client because fetch normalizes Host.

`npm.cmd run rehearse --prefix backend -- local`: passed through the running HTTP API, with the initial hold failure, corrected 5/5 suite, and exact simulated approval.

## Earlier bundled workflow lab: real Archil rehearsal

Region: `aws-us-west-2`. Official SDK: `disk@1.12.1`. Provider credentials stayed on the backend host. No live CRM, billing, onboarding or model requests occurred.

| Workflow | Run ID | Archil sandbox ID | Outcome |
| --- | --- | --- | --- |
| Initial prewritten v1 | `f555aa3f-6bad-48e7-b831-136c38f8bec7` | `01a1c86f-597d-76d2-a9e9-964fc2e7ffce` | 4/5 scenarios passed; only customer-on-hold failed |
| Corrected prewritten v2 | `5bee37bd-677d-488c-bfb6-2482892eacfa` | `01a1c86f-da70-7049-9feb-27dd374223cd` | 5/5 passed; exact-version simulated approval recorded |
| Corrected v2 after runtime metadata fix | `a369844f-2b01-4e9c-9b4f-92d8020cdd2d` | `01a1c878-b808-72bc-be8e-7209cffe5aed` | 5/5 passed; sandbox stopped |

Both real runs uploaded the actual workflow, harness, gateway, scenario and manifest files, executed `node entry.mjs` in Archil, downloaded result evidence, checked the effective deny-all policy through `getNetwork()`, and stopped their sandboxes successfully. Nine local artifacts are retained per run, including process output; eight of those artifacts also exist on the remote root filesystem.

The first two records captured an empty SDK image digest. The adapter now records runtime metadata after the sandbox reaches running and represents an unavailable digest as null. The third real run still received no digest; exact OCI digest provenance remains unavailable from these SDK responses. Historical records were not retroactively altered.

## Persistence

`node backend/scripts/verify-retention.mjs 5bee37bd-677d-488c-bfb6-2482892eacfa`: passed. Started the already-stopped corrected sandbox, downloaded all eight remote artifacts, compared every SHA-256 against the retained run metadata, and stopped it again. It did not execute the workflow again.

Verified files: `workflow.mjs`, `scenario.json`, `entry.mjs`, `harness.mjs`, `gateway.mjs`, `manifest.json`, `result.json`, `network.json`.

Restarted the backend after all experiments completed. The corrected run remained completed, its simulated approval was retained, and all nine artifact records remained available.

## Limits

- This proves actual Archil compute, transfers, lifecycle and root-filesystem persistence for this synthetic workload.
- Egress verification is effective-policy API readback, not a penetration test or proof of a production security boundary.
- All business records, integrations, mutations and approval effects are simulated.
- Workflow/scenario generation and correction are prewritten. No live LLM or Keenable work is claimed.
- No branching, separate mounted disk, production deployment, multi-tenant acceptance or frontend visual acceptance is claimed.
- Stopped sandbox root disks were retained deliberately. Their IDs above can be used for later cleanup; storage can remain billable.
