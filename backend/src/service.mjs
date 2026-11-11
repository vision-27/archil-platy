import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { bundleFor, catalog, hash } from './catalog.mjs';
import { exactObject, HttpError, requireValue } from './errors.mjs';
import { Store } from './store.mjs';
import { ArchilRunner, LocalRunner } from './runners.mjs';

export const artifactNames = ['workflow.mjs', 'scenario.json', 'entry.mjs', 'harness.mjs', 'gateway.mjs', 'manifest.json', 'result.json', 'output.json', 'network.json'];
const now = () => new Date().toISOString();

export function validateResult(result, fixture) {
  const invalid = () => { throw new HttpError(502, 'invalid_result', 'Runner returned incomplete or inconsistent test evidence.'); };
  if (result?.schemaVersion !== 1 || result.synthetic !== true || result.scenarioSetId !== fixture.id || !Array.isArray(result.scenarios) || result.scenarios.length !== fixture.scenarios.length) invalid();
  const ids = new Set();
  for (const row of result.scenarios) {
    const scenario = fixture.scenarios.find(item => item.id === row.id);
    if (!scenario || ids.has(row.id) || !Array.isArray(row.assertions) || !Array.isArray(row.actions) || !Array.isArray(row.deliveries) || row.deliveries.length !== scenario.deliveries || !row.before || !row.after) invalid();
    ids.add(row.id);
    const expected = { 'grant-count': scenario.expected.grantCount, 'access-state': scenario.expected.access, 'unrelated-records': false, 'review-required': scenario.expected.pendingReview, 'workflow-errors': 0, 'source-records': JSON.stringify([fixture.context.crm, fixture.context.billing]) };
    if (row.assertions.length !== Object.keys(expected).length || new Set(row.assertions.map(check => check.id)).size !== row.assertions.length) invalid();
    for (const check of row.assertions) if (!Object.hasOwn(expected, check.id) || check.expected !== expected[check.id] || check.passed !== (check.expected === check.actual)) invalid();
    if (row.passed !== row.assertions.every(check => check.passed)) invalid();
  }
  const passed = result.scenarios.filter(row => row.passed).length;
  if (result.summary?.total !== fixture.scenarios.length || result.summary?.passed !== passed || result.summary?.failed !== fixture.scenarios.length - passed) invalid();
  return result;
}

export class LabService {
  constructor({ directory, archil = {}, runners } = {}) {
    this.directory = resolve(directory);
    this.runners = runners ?? { local: new LocalRunner(), archil: new ArchilRunner(archil) };
    this.store = new Store(this.directory);
    this.pending = new Set();
    this.closing = false;
  }
  catalog() { return catalog(Object.values(this.runners).map(runner => runner.availability())); }
  get(id) { return this.store.get(id); }
  list() { return this.store.list(); }
  runDirectory(id) { return join(this.directory, 'runs', id); }
  update(id, patch, message) {
    const run = this.get(id);
    Object.assign(run, patch, { updatedAt: now() });
    if (message) run.events.push({ sequence: run.events.length + 1, at: now(), message });
    this.store.save(run);
    return run;
  }
  async start(input) {
    requireValue(!this.closing, 503, 'shutting_down', 'Backend is shutting down.');
    requireValue(exactObject(input, ['workflowId', 'runner', 'requestKey']) && typeof input.workflowId === 'string' && ['local', 'archil'].includes(input.runner) && typeof input.requestKey === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(input.requestKey), 400, 'invalid_request', 'Provide workflowId, runner (local or archil), and a unique 8–100 character requestKey.');
    const bundle = await bundleFor(input.workflowId);
    const runner = this.runners[input.runner];
    requireValue(runner?.availability().available, 503, 'runner_unavailable', 'Selected runner is not configured. No automatic fallback.');
    const run = { id: randomUUID(), workflowId: input.workflowId, workflowVersion: bundle.workflow.version, workflowHash: bundle.workflowHash, bundleHash: bundle.bundleHash,
      scenarioSetId: bundle.fixture.id, runner: input.runner, generation: 'prewritten', approvalMode: 'simulated', status: 'queued', createdAt: now(), updatedAt: now(), completedAt: null,
      sandboxId: null, sandboxStatus: null, workspacePath: null, result: null, resultHash: null, artifacts: [], approval: null, error: null,
      safety: { syntheticData: true, productionCredentials: false, externalIntegrations: false, networkPolicyVerified: false, productionSecurityBoundary: false },
      events: [{ sequence: 1, at: now(), message: 'Experiment accepted. No production actions will be performed.' }] };
    const created = this.store.create(run, input.requestKey, hash([input.workflowId, input.runner, bundle.bundleHash]));
    if (!created.reused) {
      const work = new Promise(resolve => setImmediate(resolve)).then(() => this.execute(run.id, bundle, runner));
      this.pending.add(work);
      work.then(() => this.pending.delete(work), () => this.pending.delete(work));
    }
    return created;
  }
  async saveArtifact(id, name, content) {
    requireValue(artifactNames.includes(name), 400, 'invalid_artifact', 'Unknown artifact.');
    const bytes = Buffer.from(content);
    requireValue(bytes.length <= 2 * 1024 * 1024, 502, 'artifact_too_large', 'Artifact exceeds demo limits.');
    await writeFile(join(this.runDirectory(id), name), bytes);
    const run = this.get(id);
    const artifact = { name, sha256: hash(bytes), bytes: bytes.length, url: `/api/runs/${id}/artifacts/${name}` };
    run.artifacts = [...run.artifacts.filter(item => item.name !== name), artifact];
    this.store.save(run);
    return artifact;
  }
  async execute(id, bundle, runner) {
    try {
      this.update(id, { status: 'preparing' }, 'Preparing immutable workflow, scenario and harness artifacts.');
      await mkdir(this.runDirectory(id), { recursive: true });
      const manifest = { runId: id, workflowId: bundle.workflow.id, workflowHash: bundle.workflowHash, bundleHash: bundle.bundleHash, generation: 'prewritten', scenarioGeneration: 'prewritten', synthetic: true, files: Object.fromEntries(Object.entries(bundle.files).map(([name, content]) => [name, hash(content)])) };
      const files = { ...bundle.files, 'manifest.json': JSON.stringify(manifest, null, 2) + '\n' };
      for (const [name, content] of Object.entries(files)) await this.saveArtifact(id, name, content);
      const output = await runner.run({ runId: id, directory: this.runDirectory(id), files, update: (patch, message) => this.update(id, patch, message) });
      const result = validateResult(JSON.parse(output.resultText), bundle.fixture);
      await this.saveArtifact(id, 'result.json', output.resultText);
      await this.saveArtifact(id, 'output.json', JSON.stringify(output.output, null, 2));
      if (output.network) await this.saveArtifact(id, 'network.json', JSON.stringify(output.network, null, 2));
      this.update(id, { status: 'completed', completedAt: now(), result, resultHash: hash(output.resultText), ...(output.runtime ? { runtime: output.runtime } : {}) }, `Experiment finished: ${result.summary.passed}/${result.summary.total} scenarios passed. This is simulated evidence, not production acceptance.`);
    } catch (error) {
      this.update(id, { status: 'failed', completedAt: now(), error: error instanceof HttpError ? { code: error.code, message: error.message } : { code: 'execution_failed', message: 'The experiment could not produce validated results. Retained artifacts are available for inspection.' } }, 'Experiment failed to complete; approval is unavailable.');
    }
  }
  async artifact(id, name) {
    const run = this.get(id);
    const metadata = run.artifacts.find(item => item.name === name);
    requireValue(artifactNames.includes(name) && metadata, 404, 'artifact_not_found', 'Artifact not found.');
    let content;
    try { content = await readFile(join(this.runDirectory(id), name)); }
    catch { throw new HttpError(409, 'artifact_missing', 'Retained artifact is missing.'); }
    requireValue(hash(content) === metadata.sha256, 409, 'artifact_changed', 'Retained artifact no longer matches its recorded hash.');
    return content;
  }
  async approve(id, input) {
    requireValue(exactObject(input, ['workflowHash', 'resultHash', 'decision']) && input.decision === 'approve' && /^[a-f0-9]{64}$/.test(input.workflowHash ?? '') && /^[a-f0-9]{64}$/.test(input.resultHash ?? ''), 400, 'invalid_approval', 'Provide decision=approve and the exact workflowHash and resultHash you reviewed.');
    const run = this.get(id);
    requireValue(run.status === 'completed' && run.result?.summary.failed === 0, 409, 'tests_not_passing', 'Only completed runs with every scenario passing can be approved.');
    const current = await bundleFor(run.workflowId);
    requireValue(current.bundleHash === run.bundleHash, 409, 'workflow_changed', 'Workflow or test inputs changed. Run the current version before approval.');
    for (const artifact of run.artifacts) await this.artifact(id, artifact.name);
    return this.store.approve(id, { decision: 'approve', simulated: true, deployed: false, workflowHash: input.workflowHash, resultHash: input.resultHash, bundleHash: run.bundleHash, at: now() });
  }
  async idle() { await Promise.allSettled([...this.pending]); }
  async close() { this.closing = true; await this.idle(); this.store.close(); }
}
