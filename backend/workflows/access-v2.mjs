// PREWRITTEN DEMO CORRECTION: adds CRM eligibility before any dispatch.
export async function run(event, tools) {
  if (!event.customerId) return { status: 'blocked', reason: 'Missing customer identity.' };
  const previous = tools.getEvent(event.id);
  if (previous) return { status: previous, reason: 'Event already recorded; no repeated write.' };
  const invoice = tools.getInvoice(event.customerId);
  if (!invoice || invoice.status !== 'paid') return { status: 'skipped', reason: 'No paid invoice.' };
  const customer = tools.getCustomer(event.customerId);
  if (!customer || customer.status !== 'active') return { status: 'blocked', reason: 'CRM account is on hold or eligibility is unknown.' };
  if (tools.getAccess(event.customerId)) return { status: 'skipped', reason: 'Access already exists.' };
  tools.recordEvent(event.id, 'dispatching');
  try {
    tools.grantAccess(event.customerId, event.id);
    tools.recordEvent(event.id, 'verified');
    return { status: 'verified', reason: 'Eligible paid customer received simulated access.' };
  } catch {
    tools.recordEvent(event.id, 'outcome_unknown');
    return { status: 'outcome_unknown', reason: 'Response lost. Requires review; do not retry.' };
  }
}
