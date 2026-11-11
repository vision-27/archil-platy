// A stateful in-process mock gateway. No HTTP clients, credentials or real integrations.
// It records attempted actions; business rules belong to the workflow and assertions.
export function createGateway(context, scenario) {
  const state = { ...structuredClone(context), events: {} };
  const actions = [];
  const trace = (system, operation, input, output) => {
    actions.push({ sequence: actions.length + 1, system, operation, input: structuredClone(input), output: structuredClone(output), simulated: true });
    return structuredClone(output);
  };
  const tools = Object.freeze({
    getCustomer(id) { return trace('crm', 'getCustomer', { id }, state.crm.find(row => row.id === id) ?? null); },
    getInvoice(customerId) { return trace('billing', 'getInvoice', { customerId }, state.billing.find(row => row.customerId === customerId) ?? null); },
    getAccess(customerId) { return trace('onboarding', 'getAccess', { customerId }, state.onboarding.find(row => row.customerId === customerId)?.access === true); },
    getEvent(id) { return trace('gateway', 'getEvent', { id }, state.events[id] ?? null); },
    recordEvent(id, status) { state.events[id] = status; trace('gateway', 'recordEvent', { id, status }, { saved: true }); },
    grantAccess(customerId, eventId) {
      const row = state.onboarding.find(item => item.customerId === customerId);
      if (!row) throw new Error('Unknown synthetic customer.');
      row.access = true;
      trace('onboarding', 'grantAccess', { customerId, eventId }, { access: true, response: scenario.fault === 'response_lost' ? 'lost' : 'received' });
      if (scenario.fault === 'response_lost') throw new Error('Synthetic response loss after mutation.');
      return { access: true };
    }
  });
  return { tools, state, actions };
}
