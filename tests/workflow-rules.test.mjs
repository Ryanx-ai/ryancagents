import test from 'node:test';
import assert from 'node:assert/strict';
import {workflowCatalog} from '../lib/workflow-catalog.ts';
import {workflowRules} from '../lib/workflow-rules.ts';

function rule(agent,id){const result=workflowRules[agent].find(item=>item.id===id);assert.ok(result,`${agent} must retain ${id}`);return result;}
function covers(agent,id,stages,kind){const item=rule(agent,id);for(const stage of stages)assert.ok(item.stageIds.includes(stage),`${id} must apply to ${stage}`);if(kind)assert.equal(item.kind,kind);}

test('all six workflows have bounded static rules referencing only their own real stages',()=>{
 assert.deepEqual(Object.keys(workflowRules).sort(),Object.keys(workflowCatalog).sort());
 const ids=new Set();
 for(const [agent,rules] of Object.entries(workflowRules)){
  const stages=new Set(workflowCatalog[agent].stages.map(stage=>stage.id));
  assert.ok(rules.length>=5&&rules.length<=9,`${agent} rule count`);
  for(const item of rules){
   assert.deepEqual(Object.keys(item).sort(),['id','title','requirement','hold','kind','stageIds','source'].sort(),'rules contain requirements, not synthetic execution/status fields');
   assert.ok(!ids.has(item.id),`unique rule ID: ${item.id}`);ids.add(item.id);
   assert.ok(['check','review','scope'].includes(item.kind));
   for(const field of ['title','requirement','hold','source'])assert.ok(typeof item[field]==='string'&&item[field].trim(),`${item.id}.${field}`);
   assert.ok(item.title.length<=80&&item.requirement.length<=380&&item.hold.length<=300,`${item.id} stays readable`);
   assert.ok(item.stageIds.length>0);assert.equal(new Set(item.stageIds).size,item.stageIds.length);
   for(const stage of item.stageIds)assert.ok(stages.has(stage),`${item.id}: unknown or cross-agent stage ${stage}`);
   assert.match(item.source,/^(?:workspace:)?[A-Za-z0-9][A-Za-z0-9_./-]*\.(?:md|json|mjs|ts)$/,'safe logical source path');
   assert.ok(!item.source.includes('..')&&!item.source.includes('.local')&&!item.source.includes('/Users/'));
  }
 }
});

test('Network map updates retain independent schema, identity, ownership, validation and readback gates',()=>{
 for(const id of ['contacts-schema-readiness','contacts-canonical-headers','contacts-row-identity','contacts-field-ownership','contacts-validation-projection','contacts-readback-evidence'])covers('contacts',id,['contacts-map']);
 covers('contacts','contacts-release',['contacts-review','contacts-handoff'],'review');
 covers('contacts','contacts-research-scope',['contacts-deduplicate','contacts-held']);
 covers('contacts','contacts-contact-evidence',['contacts-enrich']);
 assert.notEqual(rule('contacts','contacts-readback-evidence').id,rule('contacts','contacts-release').id,'storage verification and human release remain separate gates');
});

test('Inbox booking, selected reminders and read-only board projection retain separate rules',()=>{
 covers('scheduler','scheduler-booking-authority',['scheduler-availability','scheduler-book']);
 covers('scheduler','scheduler-exclusions',['scheduler-exclusions','scheduler-book']);
 covers('scheduler','scheduler-attention-resolution',['scheduler-attention'],'review');
 covers('scheduler','scheduler-reminder-selection',['scheduler-reminders'],'scope');
 covers('scheduler','scheduler-reminder-timing',['scheduler-reminders']);
 const board=rule('scheduler','scheduler-board-projection');
 assert.deepEqual(board.stageIds,['scheduler-calendar','scheduler-board']);
 assert.ok(!board.stageIds.includes('scheduler-book'),'projection does not become booking authority');
});

test('Outreach standing authority does not remove lease, fresh eligibility, follow-up or evidence gates',()=>{
 covers('outreach','outreach-audience-authority',['outreach-trigger','outreach-cycle'],'scope');
 covers('outreach','outreach-quota-lease',['outreach-guard','outreach-send','outreach-held']);
 covers('outreach','outreach-fresh-eligibility',['outreach-checks','outreach-send']);
 covers('outreach','outreach-single-followup',['outreach-followup']);
 covers('outreach','outreach-send-verification',['outreach-send','outreach-verify','outreach-held']);
 covers('outreach','outreach-sheet-ownership',['outreach-verify']);
});

test('Proposal save/review/export and Designer validation/publishing remain distinct boundaries',()=>{
 covers('proposal','proposal-current-base',['proposal-template']);
 covers('proposal','proposal-revision-save',['proposal-save']);
 covers('proposal','proposal-layout-review',['proposal-save','proposal-review'],'review');
 covers('proposal','proposal-explicit-export',['proposal-review','proposal-output'],'review');
 covers('designer','designer-validation',['designer-check'],'check');
 covers('designer','designer-publish-authority',['designer-output'],'scope');
});

test('Manager rules cover all five existing destinations without replacing status-only or prerequisite gates',()=>{
 const workerStages=workflowCatalog.manager.stages.filter(stage=>stage.targetAgent).map(stage=>stage.id);
 covers('manager','manager-existing-roles',workerStages,'scope');
 covers('manager','manager-status-only',['manager-context','manager-output'],'scope');
 covers('manager','manager-dependencies',['manager-plan','manager-delegate']);
 covers('manager','manager-receipt-evidence',['manager-reports','manager-output']);
 covers('manager','manager-review-boundary',['manager-review'],'review');
});
