import { readFile, writeFile } from 'node:fs/promises';
import { evaluate } from './harness.mjs';
import * as workflow from './workflow.mjs';

const fixture = JSON.parse(await readFile(new URL('./scenario.json', import.meta.url), 'utf8'));
const result = await evaluate(workflow, fixture);
await writeFile(new URL('./result.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ summary: result.summary, runtime: process.version }));
// An assertion failure is a completed experiment, not a broken runner.
