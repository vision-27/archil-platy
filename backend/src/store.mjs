import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { HttpError, requireValue } from './errors.mjs';

export class Store {
  constructor(directory) {
    mkdirSync(directory, { recursive: true });
    // Separate SQLite lock is held for the server lifetime; OS releases it on crash.
    this.owner = new DatabaseSync(join(directory, 'owner.sqlite'));
    try { this.owner.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE'); }
    catch { this.owner.close(); throw new Error('Another backend owns this data directory.'); }
    try {
      this.db = new DatabaseSync(join(directory, 'state.sqlite'));
      this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
        CREATE TABLE IF NOT EXISTS company_state (id INTEGER PRIMARY KEY CHECK(id=1), record TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS company_history (id TEXT PRIMARY KEY, archived_at TEXT NOT NULL, record TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL, status TEXT NOT NULL, record TEXT NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS one_active_run ON runs ((1)) WHERE status IN ('queued','preparing','running');`);
      for (const run of this.list()) {
        if (['queued', 'preparing', 'running'].includes(run.status)) {
          run.status = 'interrupted';
          run.error = { code: 'server_restarted', message: 'Server restarted during this run. No automatic rerun. Inspect any retained sandbox before starting a new experiment.' };
          run.completedAt = new Date().toISOString();
          this.save(run);
        }
      }
    } catch (error) { this.db?.close(); this.owner.close(); throw error; }
  }
  get(id) {
    const row = this.db.prepare('SELECT record FROM runs WHERE id=?').get(id);
    requireValue(row, 404, 'run_not_found', 'Run not found.');
    return JSON.parse(row.record);
  }
  list() { return this.db.prepare('SELECT record FROM runs ORDER BY rowid DESC').all().map(row => JSON.parse(row.record)); }
  getCompany() { const row = this.db.prepare('SELECT record FROM company_state WHERE id=1').get(); return row ? JSON.parse(row.record) : null; }
  saveCompany(state) { this.db.prepare('INSERT INTO company_state VALUES (1,?) ON CONFLICT(id) DO UPDATE SET record=excluded.record').run(JSON.stringify(state)); }
  resetCompany(id, state) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.getCompany();
      if (previous) this.db.prepare('INSERT INTO company_history VALUES (?,?,?)').run(id, new Date().toISOString(), JSON.stringify(previous));
      this.saveCompany(state);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  create(run, requestKey, fingerprint) {
    const previous = this.db.prepare('SELECT record,fingerprint FROM runs WHERE request_key=?').get(requestKey);
    if (previous) {
      requireValue(previous.fingerprint === fingerprint, 409, 'request_key_conflict', 'This request key belongs to different run inputs.');
      return { run: JSON.parse(previous.record), reused: true };
    }
    requireValue(!this.db.prepare("SELECT id FROM runs WHERE status IN ('queued','preparing','running')").get(), 409, 'run_in_progress', 'Wait for the current experiment to finish.');
    requireValue(this.db.prepare('SELECT COUNT(*) AS count FROM runs').get().count < 500, 409, 'run_limit', 'This demo data directory has reached its 500-run limit. Use a new data directory.');
    try { this.db.prepare('INSERT INTO runs VALUES (?,?,?,?,?)').run(run.id, requestKey, fingerprint, run.status, JSON.stringify(run)); }
    catch (error) { throw new HttpError(409, 'run_conflict', 'Another request started this experiment. Refresh the runs list.'); }
    return { run, reused: false };
  }
  save(run) {
    const result = this.db.prepare('UPDATE runs SET status=?,record=? WHERE id=?').run(run.status, JSON.stringify(run), run.id);
    requireValue(result.changes === 1, 404, 'run_not_found', 'Run not found.');
  }
  approve(id, decision) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const run = this.get(id);
      requireValue(run.status === 'completed' && run.result?.summary.failed === 0 && run.workflowHash === decision.workflowHash && run.resultHash === decision.resultHash, 409, 'approval_conflict', 'Approve only the exact completed, passing run you reviewed.');
      if (!run.approval) { run.approval = decision; this.save(run); }
      this.db.exec('COMMIT');
      return run;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  close() { this.db.close(); this.owner.close(); }
}
