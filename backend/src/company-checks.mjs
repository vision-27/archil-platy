import { exactObject, requireValue } from './errors.mjs';

export const POLICY = 'All clients with contracts over $10,000 must receive Finance approval before onboarding can proceed.';
export const ACTIONS = ['create_workspace', 'generate_checklist', 'schedule_kickoff', 'update_tracker'];
export const CONTRACT = {
  entrypoint: 'workflow.py exports run(payload) -> JSON object; Python standard library only',
  input: { deal: { id: 'D001', client: 'Acme Logistics', stage: 'closed_won', value_usd: 18000 }, documents: { signed_agreement: true, brand_assets: true }, financeApproved: false, completedActions: [] },
  output: { client: 'same client', dealId: 'same deal id', status: 'completed | needs_documents | needs_finance_approval | skipped', checklist: [{ id: 'action ID or document name or finance_approval', label: 'Readable label', done: false, required: true }], missingDocuments: [], blockingReasons: [], executedActions: [] },
  rules: [
    `executedActions uses only these ordered IDs: ${ACTIONS.join(', ')}. These are synthetic action records only.`,
    'Reject ineligible deal stages or unknown/null/negative values as skipped with a reason and no actions.',
    'Missing documents pause before any actions; missingDocuments contains signed_agreement and/or brand_assets.',
    'Skip completedActions when recording new actions. Include all four action IDs in checklist; mark done if already completed or just executed.',
    'When the supplied company sources include the Finance policy, values strictly above 10000 require financeApproved=true before any actions. Include finance_approval checklist item for those clients.',
    'Do not add the Finance rule before it exists in the supplied company sources.',
    'Every blocked/skipped result includes a blockingReasons message. Return client and dealId on every result.'
  ]
};
export function validateInput(input) {
  const ok = exactObject(input, ['deal','documents','financeApproved','completedActions']) &&
    exactObject(input.deal, ['id','client','stage','value_usd']) && ['id','client','stage'].every(k => typeof input.deal[k] === 'string' && input.deal[k].length > 0 && input.deal[k].length <= 160) &&
    (input.deal.value_usd === null || (typeof input.deal.value_usd === 'number' && Number.isFinite(input.deal.value_usd) && Math.abs(input.deal.value_usd) <= 1e12)) &&
    exactObject(input.documents, ['signed_agreement','brand_assets']) && ['signed_agreement','brand_assets'].every(k => typeof input.documents[k] === 'boolean') &&
    typeof input.financeApproved === 'boolean' && Array.isArray(input.completedActions) && input.completedActions.length <= ACTIONS.length &&
    input.completedActions.every(id => ACTIONS.includes(id)) && new Set(input.completedActions).size === input.completedActions.length;
  requireValue(ok, 400, 'invalid_client_input', 'Provide a bounded deal, document flags, financeApproved boolean and unique known completedActions.');
  return input;
}
export function expectedOutput(input, policy) {
  const { deal, documents, financeApproved, completedActions } = input;
  const missing = Object.keys(documents).filter(key => !documents[key]);
  const eligible = deal.stage === 'closed_won' && typeof deal.value_usd === 'number' && deal.value_usd >= 0;
  const status = !eligible ? 'skipped' : missing.length ? 'needs_documents' : policy && deal.value_usd > 10000 && !financeApproved ? 'needs_finance_approval' : 'completed';
  return { status, missingDocuments: eligible ? missing : [], executedActions: status === 'completed' ? ACTIONS.filter(id => !completedActions.includes(id)) : [] };
}
export function checkOutput(output, input, policy) {
  const expected = expectedOutput(input, policy);
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };
  check(output && typeof output === 'object' && !Array.isArray(output), 'Output must be an object');
  if (!output || typeof output !== 'object') return { passed: false, expected, actual: output ?? null, failures };
  check(output.client === input.deal.client && output.dealId === input.deal.id, 'Client/deal identity must be preserved');
  for (const key of ['status','executedActions']) check(JSON.stringify(output[key]) === JSON.stringify(expected[key]), `${key} differs from business requirements`);
  check(Array.isArray(output.missingDocuments) && JSON.stringify([...output.missingDocuments].sort()) === JSON.stringify([...expected.missingDocuments].sort()), 'Missing documents differ');
  check(Array.isArray(output.blockingReasons) && output.blockingReasons.every(x => typeof x === 'string') && (expected.status === 'completed' || output.blockingReasons.some(x => x.trim())), 'Blocked/skipped results need reasons');
  const checklist = output.checklist;
  check(Array.isArray(checklist) && checklist.length <= 30 && checklist.every(x => x && typeof x.id === 'string' && typeof x.label === 'string' && typeof x.done === 'boolean' && typeof x.required === 'boolean') && new Set(checklist.map(x => x.id)).size === checklist.length, 'Checklist must have unique structured entries');
  if (Array.isArray(checklist)) {
    for (const id of ACTIONS) {
      const row = checklist.find(x => x?.id === id);
      check(row?.required === true && row.done === (input.completedActions.includes(id) || expected.executedActions.includes(id)), `Checklist state for ${id} is incorrect`);
    }
    if (policy && input.deal.stage === 'closed_won' && input.deal.value_usd > 10000) {
      const row = checklist.find(x => x?.id === 'finance_approval');
      check(row?.required === true && row.done === input.financeApproved, 'Finance approval must be visible and accurate');
    }
  }
  return { passed: failures.length === 0, expected, actual: output, failures };
}
export function acceptanceCases(policy = false) {
  const make = (id, name, changes = {}) => ({ id, name, input: { ...structuredClone(CONTRACT.input), ...changes } });
  const deal = (value_usd, stage='closed_won') => ({ ...CONTRACT.input.deal, value_usd, stage });
  return [
    make('high-value', '$18,000 client without Finance approval'),
    make('low-value', '$8,000 follows original route', { deal: deal(8000) }),
    make('threshold', 'Exactly $10,000 follows original route', { deal: deal(10000) }),
    make('above-threshold', '$10,000.01 respects strict threshold', { deal: deal(10000.01) }),
    make('finance-approved', '$18,000 with Finance approval', { financeApproved: true }),
    make('missing-agreement', 'Missing signed agreement pauses work', { documents: { signed_agreement: false, brand_assets: true }, financeApproved: true }),
    make('missing-assets', 'Missing brand assets pauses work', { documents: { signed_agreement: true, brand_assets: false }, financeApproved: true }),
    make('ineligible', 'Proposal-stage deal is skipped', { deal: deal(8000, 'proposal') }),
    make('unknown-value', 'Unknown value is skipped', { deal: deal(null) }),
    make('negative-value', 'Negative value is skipped', { deal: deal(-1) }),
    make('duplicate', 'Duplicate event creates no duplicate actions', { completedActions: [...ACTIONS], financeApproved: true }),
    make('partial', 'Partial completion resumes remaining actions', { completedActions: ACTIONS.slice(0,2), financeApproved: true })
  ].map(row => ({ ...row, expected: expectedOutput(row.input, policy) }));
}
export async function evaluateVersion(disk, prefix, policy) {
  const cases = acceptanceCases(policy);
  const { outputs, execution } = await disk.executeCases({ prefix, inputs: cases.map(row => row.input) });
  requireValue(Array.isArray(outputs) && outputs.length === cases.length, 502, 'invalid_batch', 'Incomplete execution evidence.');
  const results = cases.map((row, index) => ({ id: row.id, name: row.name, ...checkOutput(outputs[index], row.input, policy) }));
  const passed = results.filter(row => row.passed).length;
  return { summary: { total: results.length, passed, failed: results.length - passed }, cases: results, execution, provenance: 'Host-authored acceptance checks against synthetic SOP; generated tests are supplemental.' };
}
