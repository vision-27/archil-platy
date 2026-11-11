// Provisional story copy. Nalin will supply the final presentation story;
// replace strings here rather than editing views. Data (company, records,
// workflows, scenarios) always comes from GET /api/catalog.

export const copy = {
  product: 'Platy',
  labName: 'Workflow lab',
  nav: { evidence: 'Evidence', workflows: 'Workflows', runs: 'Experiments' },

  evidence: {
    eyebrow: company => `${company} · synthetic company`,
    title: 'Paid customers are still waiting for access',
    lede: 'Platy compared billing, onboarding and CRM records and found paid customers who never got access. Before anything touches real systems, a proposed fix is tested in an isolated sandbox.',
    findingsTitle: count => `${count} paid customer${count === 1 ? '' : 's'} without access`,
    policyTitle: 'Company policy the fix must follow',
    recordsTitle: 'Source records',
    cta: 'Test a proposed fix'
  },

  workflows: {
    eyebrow: 'Step 2 · Proposed fixes',
    title: 'Test a workflow before it runs for real',
    lede: 'Each workflow runs against the same scenarios with stateful mock integrations. Nothing reaches a production system.',
    runnerLabel: 'Where should the tests run?',
    scenariosTitle: 'Scenarios every workflow must pass',
    run: runner => runner === 'archil' ? 'Run tests in Archil' : 'Run tests locally'
  },

  run: {
    stages: ['Accepted', 'Preparing', 'Running', 'Results', 'Approval'],
    failedLede: (failed, total) => `${failed} of ${total} scenarios failed. The workflow is not safe to approve.`,
    passedLede: total => `All ${total} scenarios passed. You can record a simulated approval for this exact version.`,
    tryCorrected: 'Test the corrected workflow',
    approveTitle: 'Simulated approval',
    approveCheck: 'I reviewed this exact workflow and its test evidence.',
    approveButton: 'Record simulated approval',
    approvedNote: 'Simulated approval recorded for this exact version. Nothing was deployed and no access was granted.'
  },

  honesty: [
    'Synthetic company data',
    'Prewritten workflows and correction',
    'Stateful mock integrations',
    'Approval is simulated'
  ]
};
