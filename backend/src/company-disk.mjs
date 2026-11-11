import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const LIMIT = 2 * 1024 * 1024;
const FILES = new Set(['workflow.py', 'app.html', 'test_workflow.py', 'README.md', 'requirements.txt']);
const safePath = value => typeof value === 'string' && value.length < 240 && value.split('/').every(part => /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(part) && part !== '..' && part !== '.');
const bounded = value => { const text = String(value ?? ''); if (Buffer.byteLength(text) > LIMIT) throw new Error('Archil artifact exceeds 2 MB limit.'); return text; };

export class CompanyDisk {
  constructor({ apiKey, region = 'aws-us-west-2', directory, diskId = process.env.ARCHIL_COMPANY_DISK_ID, client } = {}) {
    Object.assign(this, { apiKey, region, directory, diskId, client });
    this.pending = Promise.resolve();
  }
  async ensure() {
    if (!this.initializing) this.initializing = this.initialize().catch(error => { this.initializing = null; throw error; });
    return this.initializing;
  }
  async initialize() {
    if (!this.client) {
      if (!this.apiKey) throw new Error('ARCHIL_API_KEY is required; generated code never runs locally.');
      this.client = new (await import('disk')).Archil({ apiKey: this.apiKey, region: this.region });
    }
    const metadata = join(this.directory, 'disk.json');
    if (!this.diskId) {
      try { const saved = JSON.parse(await readFile(metadata, 'utf8')); this.diskId = saved.id; if (saved.region !== this.region) throw new Error('Company disk region mismatch.'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    this.disk = this.diskId ? await this.client.disks.get(this.diskId) : (await this.client.disks.create({ name: 'northstar-company' })).disk;
    this.diskId = this.disk.id;
    await mkdir(this.directory, { recursive: true });
    await writeFile(metadata, JSON.stringify({ id: this.diskId, region: this.region }, null, 2));
    return { id: this.diskId, region: this.region };
  }
  async putFiles(prefix, files) {
    if (!safePath(prefix) || prefix.split('/')[0] === 'executions') throw new Error('Invalid version prefix.');
    const entries = Object.entries(files);
    if (!entries.length || entries.some(([name, value]) => !FILES.has(name) || typeof value !== 'string' || Buffer.byteLength(value) > LIMIT)) throw new Error('Invalid generated file name or size.');
    const operation = this.pending.then(async () => {
      await this.ensure();
      // Check the reservation first, including incomplete prior uploads.
      try { await this.disk.getObject(`${prefix}/manifest.json`); throw new Error('Version files are immutable.'); }
      catch (error) { if (!(error.status === 404 || error.statusCode === 404 || error.code === 'NoSuchKey')) throw error; }
      await this.disk.putObject(`${prefix}/manifest.json`, JSON.stringify({ files: entries.map(([name]) => name), createdAt: new Date().toISOString() }));
      for (const [name, content] of entries) await this.disk.putObject(`${prefix}/${name}`, content);
      return { prefix, files: entries.map(([name]) => name) };
    });
    this.pending = operation.catch(() => {});
    return operation;
  }
  async getFile(path) {
    if (!safePath(path) || !FILES.has(path.split('/').at(-1))) throw new Error('Invalid artifact path.');
    await this.ensure();
    const bytes = await this.disk.getObject(path);
    if (bytes.byteLength > LIMIT) throw new Error('Archil artifact exceeds 2 MB limit.');
    return Buffer.from(bytes).toString('utf8');
  }
  async saveMemory(name, value) {
    if (!['company_context.json', 'workflow_map.json', 'opportunities.json', 'specification.json', 'specifications.json', 'discovery.json', 'state.json'].includes(name)) throw new Error('Invalid memory file name.');
    const text = bounded(JSON.stringify(value, null, 2));
    await this.ensure();
    await this.disk.putObject(`memory/${name}`, text);
    return { path: `memory/${name}` };
  }
  async writeCompanyFiles(files) {
    const names = new Set(['hubspot_deals.csv', 'slack_export.md', 'onboarding_sop.md', 'client_tracker.csv', 'timesheets.csv', 'policy_update.md']);
    const entries = Object.entries(files);
    if (!entries.length || entries.some(([name, value]) => !names.has(name) || typeof value !== 'string' || Buffer.byteLength(value) > LIMIT)) throw new Error('Invalid company source file.');
    await this.ensure();
    for (const [name, value] of entries) await this.disk.putObject(`company/${name}`, value);
    return { files: entries.map(([name]) => `company/${name}`) };
  }
  async readCompanyFiles(names) {
    const allowed = ['hubspot_deals.csv', 'slack_export.md', 'onboarding_sop.md', 'client_tracker.csv', 'timesheets.csv', 'policy_update.md'];
    if (!Array.isArray(names) || names.some(name => !allowed.includes(name))) throw new Error('Invalid company source name.');
    await this.ensure();
    return Object.fromEntries(await Promise.all(names.map(async name => {
      const bytes = await this.disk.getObject(`company/${name}`);
      if (bytes.byteLength > LIMIT) throw new Error('Company file exceeds limit.');
      return [name, Buffer.from(bytes).toString('utf8')];
    })));
  }
  async removePolicy() {
    await this.ensure();
    try { await this.disk.deleteObject('company/policy_update.md'); }
    catch (error) { if (!(error.status === 404 || error.statusCode === 404 || error.code === 'NoSuchKey')) throw error; }
  }
  async saveEvidence(versionId, value) {
    if (!/^[a-f0-9-]{36}$/.test(versionId)) throw new Error('Invalid version ID.');
    await this.ensure();
    await this.disk.putObject(`evidence/${versionId}.json`, bounded(JSON.stringify(value)));
  }
  async invoke(prefix, input, mode) {
    if (!safePath(prefix) || prefix.split('/')[0] === 'executions') throw new Error('Invalid version prefix.');
    await this.ensure();
    const runPath = `executions/${randomUUID()}`;
    const inputText = bounded(JSON.stringify(input));
    await this.disk.putObject(`${runPath}/input.json`, inputText);
    const launcher = Buffer.from(await readFile(new URL('../execution/company-entry.py', import.meta.url))).toString('base64');
    // Only trusted constants and an encoded trusted launcher enter the shell.
    const command = `printf '%s' '${launcher}' | base64 -d > /tmp/company-entry.py && timeout -k 5s 45s python3 -I /tmp/company-entry.py ${mode}`;
    let result;
    try {
      result = await this.client.exec({ disks: { code: { disk: this.diskId, subdirectory: prefix, readOnly: true }, io: { disk: this.diskId, subdirectory: runPath } }, command,
        baseImage: 'python:3.12-slim', network: { egress: { default: 'deny', allow: [] } }, vcpuCount: 1, memSizeMib: 512 });
    } catch {
      throw new Error('Archil execution failed. No local fallback or policy relaxation occurred.');
    }
    const stdout = bounded(result.stdout); const stderr = bounded(result.stderr);
    const execution = { diskId: this.diskId, prefix, runPath, exitCode: result.exitCode, timing: result.timing ?? null,
      networkMode: 'deny-all', networkVerification: 'Requested on this serverless call; no independent egress probe.', image: 'python:3.12-slim', supplemental: mode === 'test' };
    await this.disk.putObject(`${runPath}/execution.json`, JSON.stringify(execution));
    await this.disk.putObject(`${runPath}/stdout.log`, stdout);
    await this.disk.putObject(`${runPath}/stderr.log`, stderr);
    if (result.exitCode !== 0) return { exitCode: result.exitCode, stdout, stderr, execution };
    let envelope;
    try { envelope = JSON.parse(stdout); } catch { throw new Error('Archil returned an invalid workflow envelope.'); }
    execution.exitCode = envelope.exitCode;
    await this.disk.putObject(`${runPath}/result.json`, bounded(JSON.stringify(envelope)));
    await this.disk.putObject(`${runPath}/execution.json`, JSON.stringify(execution));
    return { ...envelope, execution };
  }
  async executeVersion({ prefix, input }) {
    const result = await this.invoke(prefix, input, 'run');
    if (result.execution.exitCode !== 0 || !result.output || typeof result.output !== 'object' || Array.isArray(result.output)) throw new Error('Generated workflow did not return a JSON object successfully.');
    return { output: result.output, execution: result.execution };
  }
  async testVersion({ prefix }) { return this.invoke(prefix, {}, 'test'); }
  async executeCases({ prefix, inputs }) {
    if (!Array.isArray(inputs) || !inputs.length || inputs.length > 32 || inputs.some(input => !input || typeof input !== 'object' || Array.isArray(input))) throw new Error('Batch requires 1 to 32 JSON input objects.');
    const result = await this.invoke(prefix, inputs, 'batch');
    if (result.execution.exitCode !== 0 || !Array.isArray(result.outputs) || result.outputs.length !== inputs.length || result.outputs.some(value => !value || typeof value !== 'object' || Array.isArray(value))) throw new Error('Generated workflow batch failed.');
    return { outputs: result.outputs, execution: result.execution };
  }
}
