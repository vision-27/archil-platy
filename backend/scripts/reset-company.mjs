// Deliberate rehearsal reset, with a complete local and remote archive first.
// Stop the backend first; the Store's exclusive owner lock enforces this.
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig } from '../src/config.mjs';
import { Store } from '../src/store.mjs';
import { CompanyDisk } from '../src/company-disk.mjs';
import { loadCompanyFiles } from '../src/discovery.mjs';
if (process.argv[2] !== '--archive') throw new Error('Stop the backend, then pass --archive to preserve and reset this synthetic company rehearsal.');
const config = await loadConfig();
const store = new Store(config.directory);
try {
  const previous = store.getCompany();
  if (!previous) { console.log('No company state to reset.'); }
  else {
    const archiveId = randomUUID();
    const directory = join(config.directory, 'company', 'history');
    await mkdir(directory, { recursive: true });
    const archive = { kind: 'rehearsal-archive', at: new Date().toISOString(), state: previous };
    await writeFile(join(directory, `${archiveId}.json`), JSON.stringify(archive, null, 2), { flag: 'wx' });
    const disk = new CompanyDisk({ ...config.archil, directory: join(config.directory, 'company') });
    await disk.saveEvidence(archiveId, archive);
    // Only the mutable, synthetic company source is reset. Immutable software,
    // test/execution artifacts, approvals and old lab runs remain retained.
    try {
      await disk.writeCompanyFiles(await loadCompanyFiles());
      if (previous.files.some(file => file.name === 'policy_update.md')) await disk.disk.deleteObject('company/policy_update.md');
      store.saveCompany(null);
    } catch (error) {
      await disk.writeCompanyFiles(Object.fromEntries(previous.files.map(file => [file.name, file.content]))).catch(() => {});
      throw error;
    }
    console.log(JSON.stringify({ reset: true, archiveId, diskId: disk.diskId, previousVersions: previous.versions.length, retained: 'All immutable version and execution artifacts; complete state archive locally and on the same Archil disk.' }));
  }
} finally { store.close(); }
