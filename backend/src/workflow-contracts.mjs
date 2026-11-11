import { CONTRACT, validateInput, checkOutput, evaluateVersion } from './company-checks.mjs';
import { exactObject, requireValue } from './errors.mjs';
export const WORKFLOWS = {
 onboarding: CONTRACT,
 reporting: {
  input: { client: 'Acme Logistics', month: '2026-10', exports: { search: true, social: true }, attributionDiscrepancy: false, discrepancyReviewed: false, accountLeadApproved: false, completedActions: [] },
  output: {status:'needs_exports | needs_discrepancy_review | needs_account_lead_approval | completed',checklist:[],executedActions:[],blockingReasons:[]},
  rules: ['Ordered actions: collect_exports, reconcile_metrics, draft_deck, record_account_lead_approval. Never publish or send the deck.', 'Missing any export blocks all actions with needs_exports.', 'When exports present, collect_exports and reconcile_metrics may run. Attribution discrepancy requires discrepancyReviewed=true before drafting; status needs_discrepancy_review otherwise.', 'After discrepancy review (or no discrepancy) draft_deck may run. Account lead approval is always required before record_account_lead_approval; status needs_account_lead_approval until approved, then completed.', 'completedActions records already performed actions; omit them from executedActions. Checklist must include every action with done=true for prior or newly executed actions, plus attribution_review and account_lead_approval accurate boolean flags. Blocked results include reasons.']
 },
 invoices: {
  input: { invoice: { id: 'INV-001', vendor: 'Creative Supplies', amount_usd: 1200, po_id: 'PO-001' }, purchaseOrder: { id: 'PO-001', vendor: 'Creative Supplies', amount_usd: 1200 }, budgetOwner: 'Maya', budgetOwnerApproved: false, completedActions: [] },
  output: {status:'needs_purchase_order | needs_match_review | needs_budget_owner | needs_budget_owner_approval | completed',checklist:[],executedActions:[],blockingReasons:[]},
  rules: ['Ordered actions: match_purchase_order, route_budget_owner, handoff_finance. Never pay, access banking, or record payment.', 'Null purchaseOrder gives needs_purchase_order and no actions. PO id, vendor and amount must exactly match invoice; mismatch gives needs_match_review and no actions.', 'Matched invoices execute match_purchase_order; empty budgetOwner gives needs_budget_owner. A nonempty budgetOwner permits route_budget_owner. Only budgetOwnerApproved=true permits handoff_finance and completed; otherwise needs_budget_owner_approval.', 'Skip completedActions in new executedActions. Checklist contains all action IDs with accurate prior/new done booleans and budget_owner_approval matching input. Blocked results need reasons.']
 }
};
export const workflowActions = id => id==='reporting' ? ['collect_exports','reconcile_metrics','draft_deck','record_account_lead_approval'] : ['match_purchase_order','route_budget_owner','handoff_finance'];
export function inferWorkflow(name) { const matches=[['onboarding',/onboard/i],['reporting',/report/i],['invoices',/invoice/i]].filter(([,re])=>re.test(name)); requireValue(matches.length===1,409,'unsupported_workflow','Workflow name must identify exactly one supported workflow.'); return matches[0][0]; }
export function validateWorkflowInput(id,input) {
 if(id==='onboarding')return validateInput(input);
 const actions=workflowActions(id), bounded=x=>typeof x==='string'&&x.length<=160, money=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1e12;
 let ok=exactObject(input,Object.keys(WORKFLOWS[id].input));
 if(ok&&id==='reporting')ok=bounded(input.client)&&!!input.client&&/^\d{4}-\d{2}$/.test(input.month)&&exactObject(input.exports,['search','social'])&&Object.values(input.exports).every(x=>typeof x==='boolean')&&['attributionDiscrepancy','discrepancyReviewed','accountLeadApproved'].every(k=>typeof input[k]==='boolean');
 if(ok&&id==='invoices')ok=exactObject(input.invoice,['id','vendor','amount_usd','po_id'])&&['id','vendor','po_id'].every(k=>bounded(input.invoice[k])&&!!input.invoice[k])&&money(input.invoice.amount_usd)&&(input.purchaseOrder===null||(exactObject(input.purchaseOrder,['id','vendor','amount_usd'])&&['id','vendor'].every(k=>bounded(input.purchaseOrder[k])&&!!input.purchaseOrder[k])&&money(input.purchaseOrder.amount_usd)))&&bounded(input.budgetOwner)&&typeof input.budgetOwnerApproved==='boolean';
 ok=ok&&Array.isArray(input.completedActions)&&input.completedActions.length<=actions.length&&input.completedActions.every(x=>actions.includes(x))&&new Set(input.completedActions).size===input.completedActions.length;
 requireValue(ok,400,'invalid_workflow_input','Input must match the selected workflow contract exactly.');return input;
}
export function expectedWorkflow(id,input) {
 const actions=workflowActions(id);let status,allowed=[];
 if(id==='reporting'){
  if(!Object.values(input.exports).every(Boolean))status='needs_exports';
  else {allowed=actions.slice(0,2);if(input.attributionDiscrepancy&&!input.discrepancyReviewed)status='needs_discrepancy_review';else{allowed.push(actions[2]);if(!input.accountLeadApproved)status='needs_account_lead_approval';else{allowed.push(actions[3]);status='completed';}}}
 }else{const p=input.purchaseOrder,i=input.invoice;if(!p)status='needs_purchase_order';else if(p.id!==i.po_id||p.vendor!==i.vendor||p.amount_usd!==i.amount_usd)status='needs_match_review';else{allowed=[actions[0]];if(!input.budgetOwner.trim())status='needs_budget_owner';else{allowed.push(actions[1]);if(!input.budgetOwnerApproved)status='needs_budget_owner_approval';else{allowed.push(actions[2]);status='completed';}}}}
 return {status,executedActions:allowed.filter(x=>!input.completedActions.includes(x))};
}
export function checkWorkflowOutput(id,output,input,policy=false){
 if(id==='onboarding')return checkOutput(output,input,policy);
 const expected=expectedWorkflow(id,input),failures=[];const check=(ok,msg)=>{if(!ok)failures.push(msg);};
 check(output&&typeof output==='object'&&!Array.isArray(output),'Output object required');
 for(const k of ['status','executedActions'])check(JSON.stringify(output?.[k])===JSON.stringify(expected[k]),`${k} differs from independent rules`);
 check(Array.isArray(output?.blockingReasons)&&output.blockingReasons.every(x=>typeof x==='string')&&(expected.status==='completed'||output.blockingReasons.some(x=>x.trim())),'Blocked result needs reasons');
 const list=output?.checklist;check(Array.isArray(list)&&list.length<=30&&list.every(x=>x&&typeof x.id==='string'&&typeof x.label==='string'&&typeof x.done==='boolean'&&x.required===true)&&new Set(list.map(x=>x.id)).size===list.length,'Structured unique checklist required');
 for(const action of workflowActions(id))check(list?.find(x=>x.id===action)?.done===(input.completedActions.includes(action)||expected.executedActions.includes(action)),`Checklist ${action}`);
 for(const [key,value] of id==='reporting'?[['attribution_review',!input.attributionDiscrepancy||input.discrepancyReviewed],['account_lead_approval',input.accountLeadApproved]]:[['budget_owner_approval',input.budgetOwnerApproved]])check(list?.find(x=>x.id===key)?.done===value,`Checklist ${key}`);
 return {passed:!failures.length,expected,actual:output??null,failures};
}
export function workflowCases(id){const sample=WORKFLOWS[id].input,make=(name,changes={})=>({id:name,name,input:{...structuredClone(sample),...changes}});return id==='reporting'?[make('approval-required'),make('approved',{accountLeadApproved:true}),make('missing-export',{exports:{search:false,social:true},accountLeadApproved:true}),make('discrepancy',{attributionDiscrepancy:true,accountLeadApproved:true}),make('reviewed',{attributionDiscrepancy:true,discrepancyReviewed:true,accountLeadApproved:true}),make('duplicate',{accountLeadApproved:true,completedActions:workflowActions(id)}),make('partial',{completedActions:['collect_exports']})]:[make('approval-required'),make('approved',{budgetOwnerApproved:true}),make('missing-po',{purchaseOrder:null,budgetOwnerApproved:true}),make('mismatch',{purchaseOrder:{...sample.purchaseOrder,amount_usd:1201},budgetOwnerApproved:true}),make('wrong-vendor',{purchaseOrder:{...sample.purchaseOrder,vendor:'Other'}}),make('wrong-po',{purchaseOrder:{...sample.purchaseOrder,id:'PO-OTHER'}}),make('missing-owner',{budgetOwner:'',budgetOwnerApproved:true}),make('duplicate',{budgetOwnerApproved:true,completedActions:workflowActions(id)}),make('partial',{budgetOwnerApproved:true,completedActions:['match_purchase_order']})];}
export async function evaluateWorkflow(disk,prefix,id,policy=false){if(id==='onboarding')return evaluateVersion(disk,prefix,policy);const cases=workflowCases(id);const {outputs,execution}=await disk.executeCases({prefix,inputs:cases.map(x=>x.input)});requireValue(Array.isArray(outputs)&&outputs.length===cases.length,502,'invalid_batch','Incomplete execution evidence.');const results=cases.map((row,i)=>({id:row.id,name:row.name,...checkWorkflowOutput(id,outputs[i],row.input)}));const passed=results.filter(x=>x.passed).length;return {summary:{total:results.length,passed,failed:results.length-passed},cases:results,execution,provenance:'Host-authored independent checks from synthetic Slack procedures; no real publication or payment.'};}
