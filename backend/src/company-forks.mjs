import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { HttpError, requireValue } from './errors.mjs';

const LIMIT = 2 * 1024 * 1024;
const names = ['workflow.py','app.html','test_workflow.py','README.md'];
const network = { egress: { default: 'deny', allow: [] } };
const bounded = value => { const text = String(value ?? ''); requireValue(Buffer.byteLength(text) <= LIMIT, 502, 'fork_output_limit', 'Fork output exceeded the demo limit.'); return text; };
async function waitFor(sandbox, state, timeout = 120_000) {
  const deadline = Date.now() + timeout;
  while (sandbox.status !== state) {
    requireValue(sandbox.status !== 'failed' && Date.now() < deadline, 502, 'fork_lifecycle_failed', 'Archil fork did not reach the required state.');
    await new Promise(resolve => setTimeout(resolve, 500)); await sandbox.refresh();
  }
}
async function verifyNetwork(sandbox) {
  const policy = await sandbox.getNetwork();
  requireValue(policy?.egress?.default === 'deny' && (policy.egress.allow ?? []).length === 0, 502, 'fork_network_unverified', 'Fork did not report deny-all egress. Generated code was not executed.');
}
async function download(sandbox, path) {
  const chunks = []; let size = 0;
  await sandbox.files.downloadFile(path, chunk => { size += chunk.length; requireValue(size <= LIMIT, 502, 'fork_file_limit', 'Fork artifact exceeded limit.'); chunks.push(Buffer.from(chunk)); });
  return Buffer.concat(chunks).toString('utf8');
}

// A real Archil sandbox fork, exposing the same test methods as CompanyDisk.
// No company disk is mounted: each fork owns its copied root filesystem.
class CandidateFork {
  constructor(sandbox, record, notify, launcher) { Object.assign(this, { sandbox, record, notify, launcher }); this.uploaded = null; }
  async putFiles(prefix, files) {
    requireValue(/^[a-zA-Z0-9/_-]+$/.test(prefix), 400, 'invalid_fork_prefix', 'Invalid candidate artifact path.');
    requireValue(names.every(name => typeof files[name] === 'string') && Object.keys(files).length === names.length, 400, 'invalid_fork_files', 'Provide the four generated files.');
    const target = `/work/${prefix}`;
    const setup = await this.sandbox.exec(`mkdir -p '${target}' && ln -sfn '${target}' /mnt/archil/code`, { timeoutSeconds: 15 });
    requireValue(setup.exitCode === 0, 502, 'fork_upload_failed', 'Could not prepare candidate files.');
    for (const name of names) await this.sandbox.files.uploadFile(Buffer.from(files[name]), `${target}/${name}`);
    this.record.artifactPath = target;
    this.uploaded = { ...files };
  }
  async getFile(path) {
    const name = path.split('/').at(-1); requireValue(names.includes(name), 400, 'invalid_fork_file', 'Unknown generated artifact.');
    return download(this.sandbox, `/mnt/archil/code/${name}`);
  }
  async verifyFiles() {
    for (const name of names) requireValue(await this.getFile(name) === this.uploaded[name], 502, 'fork_source_changed', 'Generated files changed during execution. Candidate rejected.');
  }
  async invoke(prefix, input, mode) {
    await verifyNetwork(this.sandbox);
    await this.sandbox.files.uploadFile(Buffer.from(bounded(JSON.stringify(input))), '/mnt/archil/io/input.json');
    // Restore trusted transport before each execution. The model never supplies it.
    await this.sandbox.files.uploadFile(this.launcher, '/tmp/company-entry.py');
    const startedAt = new Date().toISOString();
    const result = await this.sandbox.exec(`timeout -k 5s 45s python3 -I /tmp/company-entry.py ${mode}`, { timeoutSeconds: 55, env: {} });
    const execution = { sandboxId: this.sandbox.id, baseSandboxId: this.record.baseSandboxId, baseCheckpoint: this.record.baseCheckpoint, forkId: this.record.id, prefix,
      runPath: `sandbox:${this.sandbox.id}/${randomUUID()}`, startedAt, completedAt: new Date().toISOString(), exitCode: result.exitCode,
      networkMode: 'deny-all', networkVerification: 'Control-plane policy readback for this fork; no independent egress probe.', image: 'python:3.12-slim', supplemental: mode === 'test' };
    const stdout = bounded(result.stdout), stderr = bounded(result.stderr);
    await this.verifyFiles();
    if (result.exitCode !== 0) return { exitCode: result.exitCode, stdout, stderr, execution };
    let envelope; try { envelope = JSON.parse(stdout); } catch { throw new HttpError(502, 'fork_invalid_output', 'Fork returned an invalid execution envelope.'); }
    execution.exitCode = envelope.exitCode;
    return { ...envelope, execution };
  }
  async testVersion({ prefix }) { return this.invoke(prefix, {}, 'test'); }
  async executeCases({ prefix, inputs }) {
    const result = await this.invoke(prefix, inputs, 'batch');
    requireValue(result.exitCode === 0 && Array.isArray(result.outputs) && result.outputs.length === inputs.length, 502, 'fork_batch_failed', 'Fork could not complete the independent test inputs.');
    return { outputs: result.outputs, execution: result.execution };
  }
}

export class CompanyForks {
  constructor({ apiKey, region = 'aws-us-west-2', client } = {}) { Object.assign(this, { apiKey, region, client }); }
  async prepare({ versionId, files, specification, records, notify }) {
    const client = this.client ?? new (await import('disk')).Archil({ apiKey: this.apiKey, region: this.region });
    let base; const children = [];
    const launcher = await readFile(new URL('../execution/company-entry.py', import.meta.url));
    const stop = async (sandbox, record) => {
      try { await sandbox.stop({ wait: false }); await waitFor(sandbox, 'stopped', 45_000); if (record) record.sandboxStatus = 'stopped'; }
      catch { if (record) record.cleanupWarning = 'Stop unconfirmed. Check the retained sandbox; a 900-second lifetime was requested.'; }
      if (record) notify(record);
    };
    const pool = { base: null, runners: [], close: async () => {
      await Promise.allSettled(children.map(({ sandbox, record }) => stop(sandbox, record)));
      if (base && base.status !== 'stopped') await stop(base, pool.base);
    } };
    try {
      base = await client.sandboxes.create({ name: `platy-base-${versionId}`, baseImage: 'python:3.12-slim', vcpuCount: 1, memSizeMiB: 512,
        maxTtlSeconds: 900, idleTtlSeconds: 0, env: {}, ports: [], mounts: [], network }, { wait: false });
      for (const record of records) { record.baseSandboxId = base.id; notify(record); }
      await waitFor(base, 'running'); await verifyNetwork(base);
      const setup = await base.exec('mkdir -p /mnt/archil/io /company', { timeoutSeconds: 15 });
      requireValue(setup.exitCode === 0, 502, 'fork_setup_failed', 'Could not prepare base sandbox.');
      for (const [name, content] of Object.entries(files)) {
        requireValue(/^[a-z_]+\.(csv|md)$/.test(name), 400, 'invalid_context_name', 'Invalid company source name.');
        await base.files.uploadFile(Buffer.from(content), `/company/${name}`);
      }
      await base.files.uploadFile(Buffer.from(JSON.stringify(specification)), '/company/specification.json');
      await base.stop({ wait: false }); await waitFor(base, 'stopped', 45_000);
      requireValue(base.checkpoint, 502, 'missing_base_checkpoint', 'Archil did not report a committed base checkpoint.');
      pool.base = { sandboxId: base.id, checkpoint: base.checkpoint, status: 'stopped', companyContextPath: '/company' };
      const results = await Promise.allSettled(records.map(async record => {
        record.baseCheckpoint = base.checkpoint;
        const sandbox = await base.fork({ name: `platy-${record.id}`, wait: false });
        children.push({ sandbox, record }); record.sandboxId = sandbox.id; record.sandboxStatus = sandbox.status; notify(record);
        await waitFor(sandbox, 'running'); await verifyNetwork(sandbox);
        record.sandboxStatus = 'running'; notify(record);
        const context = JSON.parse(await download(sandbox, '/company/specification.json'));
        requireValue(JSON.stringify(context) === JSON.stringify(specification), 502, 'fork_context_mismatch', 'Fork did not preserve the prepared specification.');
        for (const [name, content] of Object.entries(files)) requireValue(await download(sandbox, `/company/${name}`) === content, 502, 'fork_context_mismatch', 'Fork did not preserve company inputs.');
        record.contextVerified = true; notify(record);
        return new CandidateFork(sandbox, record, notify, launcher);
      }));
      pool.runners = results.map((result, index) => {
        if (result.status === 'fulfilled') return result.value;
        Object.assign(records[index], { status: 'failed', stage: 'failed', summary: 'Archil fork preparation failed; no candidate generated.' }); notify(records[index]);
        return null;
      });
      requireValue(pool.runners.some(Boolean), 502, 'forks_unavailable', 'No Archil fork could be prepared. Previous software remains available.');
      return pool;
    } catch (error) {
      await pool.close();
      if (error instanceof HttpError) throw error;
      throw new HttpError(502, 'forks_unavailable', 'Archil could not prepare real sandbox forks. No simulated fork fallback was used.');
    }
  }
}
