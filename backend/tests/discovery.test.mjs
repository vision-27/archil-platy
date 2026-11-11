import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCompanyFiles, validateCitation, rankOpportunities, discoverCompany } from '../src/discovery.mjs';

test('fixture contains five files and 20 deal records',async()=>{const files=await loadCompanyFiles();assert.equal(Object.keys(files).length,5);assert.equal(files['hubspot_deals.csv'].trim().split(/\r?\n/).length,21);});
test('baseline evidence supports onboarding the closed-won $8000 deal without a minimum',async()=>{
 const files=await loadCompanyFiles();assert.match(files['hubspot_deals.csv'],/Birch Studio,8000,closed_won/);
 assert.match(files['onboarding_sop.md'],/all closed_won.*known nonnegative.*no minimum contract value/);
 assert.match(files['slack_export.md'],/Birch Studio.*standard onboarding procedure/);
 assert.doesNotMatch(files['slack_export.md'],/onboarding threshold/);
});
test('citations reject fabricated quotes and wrong line numbers',()=>{
 const files={'note.md':'one\ntwo'};validateCitation({file:'note.md',line:2,quote:'two'},files);
 assert.throws(()=>validateCitation({file:'note.md',line:1,quote:'two'},files),/does not match/);
 assert.throws(()=>validateCitation({file:'note.md',line:2,quote:'invented'},files),/does not match/);
});
test('host ranks cited measured hours with difficulty and risk penalty, not a fixed winner',()=>{
 const files={'timesheets.csv':'workflow,occurrences_per_month,minutes_per_occurrence\nSmall,10,60\nLarge,20,60'};
 const item=(id,line,difficulty,risk)=>({id,difficulty,risk,timesheetCitation:{file:'timesheets.csv',line,quote:files['timesheets.csv'].split('\n')[line-1]},citations:[]});
 const ranked=rankOpportunities([item('large',3,5,5),item('small',2,1,1)],files);
 assert.equal(ranked[0].id,'small');assert.equal(ranked[0].monthlyHours,10);assert.equal(ranked[1].monthlyHours,20);
 assert.throws(()=>rankOpportunities([item('bad',1,1,1)],files),/monthly frequency/);
});
test('discovery refuses unsupported evidence before requesting the second model role',async()=>{
 let calls=0;const model={async generate(){calls++;return {value:{context:{company:'x',summary:'x',citations:[{file:'a',line:1,quote:'false'}]},workflows:[{id:'w',name:'Work',trigger:'Event',steps:['Handle'],citations:[{file:'a',line:1,quote:'real'}]}]},receipt:{live:false}};}};
 await assert.rejects(discoverCompany({model,files:{a:'real'}}),/does not match/);assert.equal(calls,1);
});
test('empty workflows and empty opportunities fail safely with a typed error',async()=>{
 const c={file:'a',line:1,quote:'real'},context={company:'x',summary:'x',citations:[c]};
 await assert.rejects(discoverCompany({model:{async generate(){return {value:{context,workflows:[]}};}},files:{a:'real'}}),e=>e.code==='invalid_model_shape');
 let calls=0;const model={async generate(){calls++;return {value:calls===1?{context,workflows:[{id:'w',name:'Work',trigger:'Event',steps:['Handle'],citations:[c]}]}:{opportunities:[],specifications:[]}};}};
 await assert.rejects(discoverCompany({model,files:{a:'real'}}),e=>e.code==='invalid_model_shape');assert.equal(calls,2);
});
