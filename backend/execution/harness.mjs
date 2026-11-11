import { createGateway } from './gateway.mjs';

// The same harness runs locally and in Archil. Workflows receive no expected outcomes.
export async function evaluate(workflow, fixture) {
  const scenarios = [];
  for (const scenario of fixture.scenarios) {
    const gateway = createGateway(fixture.context, scenario);
    const before = structuredClone(gateway.state);
    const deliveries = [];
    for (let delivery = 0; delivery < scenario.deliveries; delivery++) {
      try {
        deliveries.push(await workflow.run({ id: scenario.eventId, customerId: scenario.customerId }, gateway.tools));
      } catch (error) {
        deliveries.push({ status: 'error', reason: String(error.message).slice(0, 500) });
      }
    }
    const after = structuredClone(gateway.state);
    const grants = gateway.actions.filter(action => action.operation === 'grantAccess');
    const actualAccess = after.onboarding.find(row => row.customerId === scenario.customerId)?.access === true;
    const unrelatedChanged = after.onboarding.some((row, i) => row.customerId !== scenario.customerId && row.access !== before.onboarding[i].access);
    const checks = [
      ['grant-count', 'Expected number of access writes', scenario.expected.grantCount, grants.length],
      ['access-state', 'Expected final access state', scenario.expected.access, actualAccess],
      ['unrelated-records', 'Unrelated customer records unchanged', false, unrelatedChanged],
      ['review-required', 'Uncertain writes remain pending review', scenario.expected.pendingReview, after.events[scenario.eventId] === 'outcome_unknown'],
      ['workflow-errors', 'No unhandled workflow errors', 0, deliveries.filter(item => item?.status === 'error').length],
      ['source-records', 'CRM and billing were not mutated', JSON.stringify([before.crm, before.billing]), JSON.stringify([after.crm, after.billing])]
    ];
    const assertions = checks.map(([id, label, expected, actual]) => ({ id, label, expected, actual, passed: expected === actual }));
    scenarios.push({ id: scenario.id, name: scenario.name, passed: assertions.every(check => check.passed), assertions, actions: gateway.actions, deliveries, before, after,
      explanation: assertions.every(check => check.passed) ? 'Observed mock behavior matches this scenario’s independent expectations.' : scenario.id === 'customer-on-hold' ? 'The workflow granted access despite the CRM hold. Add an eligibility check before dispatch.' : 'Observed behavior differs from the scenario expectations; inspect the failed assertions.' });
  }
  return { schemaVersion: 1, synthetic: true, scenarioSetId: fixture.id, summary: { total: scenarios.length, passed: scenarios.filter(item => item.passed).length, failed: scenarios.filter(item => !item.passed).length }, scenarios };
}
