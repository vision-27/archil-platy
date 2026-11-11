import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HttpError } from './errors.mjs';

const execFileAsync = promisify(execFile);
async function waitForSandbox(sandbox, desired, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (sandbox.status !== desired) {
    if (sandbox.status === 'failed' || Date.now() >= deadline) throw new Error('Sandbox lifecycle did not reach the requested state.');
    await new Promise(resolve => setTimeout(resolve, 500));
    await sandbox.refresh();
  }
}
const safeLocalEnvironment = () => Object.fromEntries(['SystemRoot', 'WINDIR', 'TEMP', 'TMP'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
export class LocalRunner {
  availability() { return { id: 'local', available: true, label: 'Local mock execution', isolation: 'Trusted bundled code in a child process; not a security sandbox.' }; }
  async run({ directory, update }) {
    update({ status: 'running', safety: { syntheticData: true, productionCredentials: false, externalIntegrations: false, networkPolicyVerified: false, networkMode: 'local-unrestricted', productionSecurityBoundary: false } }, 'Running trusted bundled workflow locally against simulated integrations.');
    const output = await execFileAsync(process.execPath, ['entry.mjs'], { cwd: directory, env: safeLocalEnvironment(), timeout: 15_000, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
    return { resultText: await readFile(join(directory, 'result.json'), 'utf8'), output: { stdout: output.stdout, stderr: output.stderr }, runtime: { node: process.version } };
  }
}

export class ArchilRunner {
  constructor({ apiKey, region = 'aws-us-east-1', networkMode = 'deny-all', client } = {}) {
    Object.assign(this, { apiKey, region, networkMode, client });
    if (!['deny-all', 'managed'].includes(networkMode)) throw new Error('ARCHIL_NETWORK_MODE must be deny-all or managed.');
    if (!['aws-us-east-1', 'aws-us-west-2', 'aws-eu-west-1'].includes(region)) throw new Error('Choose an Archil AWS region supporting sandboxes.');
  }
  availability() { return { id: 'archil', available: Boolean(this.apiKey || this.client), label: 'Archil sandbox', networkMode: this.networkMode, region: this.region, reason: this.apiKey || this.client ? 'Configured; live connectivity has not been preflighted.' : 'Set ARCHIL_API_KEY in the server environment or root .env.' }; }
  async run({ runId, files, update }) {
    if (!this.apiKey && !this.client) throw new HttpError(503, 'archil_not_configured', 'Set ARCHIL_API_KEY. Archil runs never fall back to local mode.');
    const client = this.client ?? new (await import('disk')).Archil({ apiKey: this.apiKey, region: this.region });
    let sandbox;
    try {
      update({}, 'Creating Archil sandbox; workspace files will persist in its root filesystem.');
      sandbox = await client.sandboxes.create({ name: `platy-${runId}`, baseImage: 'node:22-bookworm-slim', vcpuCount: 1, memSizeMiB: 512,
        maxTtlSeconds: 300, idleTtlSeconds: 60, env: {}, ports: [], mounts: [],
        ...(this.networkMode === 'deny-all' ? { network: { egress: { default: 'deny', allow: [] } } } : {}) }, { wait: false });
      update({ sandboxId: sandbox.id, sandboxStatus: sandbox.status, workspacePath: '/workspace' }, 'Archil sandbox created.');
      await waitForSandbox(sandbox, 'running', 120_000);
      update({ sandboxStatus: sandbox.status, runtime: { imageDigest: sandbox.imageDigest || null, baseImage: sandbox.baseImage } }, 'Sandbox is running; runtime metadata recorded after provisioning.');
      const policy = await sandbox.getNetwork();
      const denyAll = policy?.egress?.default === 'deny' && (policy.egress.allow ?? []).length === 0;
      const managed = policy?.managed === true && policy.egress?.default === 'deny';
      if (this.networkMode === 'deny-all' ? !denyAll : !managed) throw new HttpError(502, 'network_policy_unverified', 'Archil did not return the requested network policy. Workflow was not executed.');
      const safety = { syntheticData: true, productionCredentials: false, externalIntegrations: false, networkPolicyVerified: true,
        networkMode: denyAll ? 'deny-all' : 'provider-managed-allowlist', productionSecurityBoundary: false,
        verification: 'Control-plane policy readback; not an independent egress penetration test.' };
      update({ safety }, 'Effective sandbox network policy checked.');
      const setup = await sandbox.exec('mkdir -p /workspace', { timeoutSeconds: 15 });
      if (setup.exitCode !== 0) throw new Error('Sandbox workspace creation failed.');
      for (const [name, content] of Object.entries(files)) await sandbox.files.uploadFile(Buffer.from(content), `/workspace/${name}`);
      update({ status: 'running' }, 'Inputs and harness uploaded. Running tests in Archil.');
      const output = await sandbox.exec('node entry.mjs', { cwd: '/workspace', timeoutSeconds: 30, env: {} });
      if (output.exitCode !== 0) throw new HttpError(502, 'sandbox_execution_failed', 'Archil process did not finish successfully. Inspect the retained sandbox.');
      const chunks = []; let size = 0;
      await sandbox.files.downloadFile('/workspace/result.json', chunk => {
        size += chunk.length;
        if (size > 2 * 1024 * 1024) throw new Error('Sandbox result exceeds the demo size limit.');
        chunks.push(Buffer.from(chunk));
      });
      await sandbox.files.uploadFile(Buffer.from(JSON.stringify(policy, null, 2)), '/workspace/network.json');
      return { resultText: Buffer.concat(chunks).toString('utf8'), output: { stdout: output.stdout, stderr: output.stderr }, network: policy };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      // SDK errors can contain HTTP bodies or signed URLs. Never return them to UI/logs.
      throw new HttpError(502, 'archil_run_failed', 'Archil execution could not be confirmed. Check credentials, region, plan and retained sandbox in the Archil console. No local fallback or automatic rerun occurred.');
    } finally {
      if (sandbox) {
        try { await sandbox.stop({ wait: false }); await waitForSandbox(sandbox, 'stopped', 30_000); update({ sandboxStatus: 'stopped' }, 'Sandbox stopped; root filesystem artifacts retained.'); }
        catch { update({ sandboxStatus: 'stop_unconfirmed', cleanupWarning: 'Sandbox stop could not be confirmed. Check the Archil console. A 300-second session TTL was requested.' }, 'Sandbox stop unconfirmed.'); }
      }
    }
  }
}
