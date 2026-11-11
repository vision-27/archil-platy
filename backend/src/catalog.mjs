import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { requireValue } from './errors.mjs';

const root = new URL('../', import.meta.url);
export const hash = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const definitions = [
  { id: 'access-v1', version: 1, name: 'Initial access repair', generation: 'prewritten', description: 'Grants access to paid customers. Intentionally omits CRM eligibility to demonstrate a failing test.' },
  { id: 'access-v2', version: 2, name: 'Access repair with eligibility check', generation: 'prewritten', description: 'Checks the CRM account is active before granting access; retains event deduplication and uncertain-write handling.' }
];
export async function bundleFor(workflowId) {
  const definition = definitions.find(item => item.id === workflowId);
  requireValue(definition, 400, 'unknown_workflow', 'Choose a bundled workflow from /api/catalog.');
  const code = await readFile(new URL(`workflows/${definition.id}.mjs`, root), 'utf8');
  const fixtureText = await readFile(new URL('scenarios/access-repair.json', root), 'utf8');
  const files = { 'workflow.mjs': code, 'scenario.json': fixtureText };
  for (const name of ['entry.mjs', 'harness.mjs', 'gateway.mjs']) files[name] = await readFile(new URL(`execution/${name}`, root), 'utf8');
  const workflowHash = hash(code);
  const bundleHash = hash(Object.keys(files).sort().map(name => [name, hash(files[name])]));
  return { workflow: { ...definition, code, workflowHash }, fixture: JSON.parse(fixtureText), workflowHash, bundleHash, files };
}
export async function catalog(runners) {
  const bundles = await Promise.all(definitions.map(item => bundleFor(item.id)));
  const fixture = bundles[0].fixture;
  const findings = fixture.context.billing.filter(invoice => invoice.status === 'paid' && !fixture.context.onboarding.find(row => row.customerId === invoice.customerId)?.access).map(invoice => ({
    id: `finding-${invoice.customerId}`, customerId: invoice.customerId, title: 'Paid customer has no access',
    evidence: [{ system: 'billing', recordId: invoice.id, field: 'status', value: invoice.status }, { system: 'onboarding', recordId: invoice.customerId, field: 'access', value: false }, { system: 'crm', recordId: invoice.customerId, field: 'status', value: fixture.context.crm.find(row => row.id === invoice.customerId)?.status }]
  }));
  return { schemaVersion: 1, company: fixture.company, policy: fixture.policy, context: fixture.context, findings,
    workflows: bundles.map(bundle => ({ ...bundle.workflow, bundleHash: bundle.bundleHash })),
    scenarioSetId: fixture.id, scenarios: fixture.scenarios.map(({ id, name, expected, deliveries, fault }) => ({ id, name, expected, deliveries, fault })), runners,
    honesty: { companyData: 'synthetic', integrations: 'stateful mocks', workflowGeneration: 'prewritten', correction: 'prewritten', scenarioGeneration: 'prewritten', approval: 'simulated only', liveDeployment: false, keenable: 'not integrated' } };
}
