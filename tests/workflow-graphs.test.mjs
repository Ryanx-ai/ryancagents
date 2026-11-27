import test from 'node:test';
import assert from 'node:assert/strict';
import {workflowCatalog} from '../lib/workflow-catalog.ts';
import {workflowGraphs,workflowOutgoing,workflowRouteMoves} from '../lib/workflow-graphs.ts';

function reaches(graph,start,target,without=[]){
 const seen=new Set(without),queue=[start];while(queue.length){const id=queue.shift();if(seen.has(id))continue;if(id===target)return true;seen.add(id);queue.push(...workflowOutgoing(graph,id).map(route=>route.target));}return false;
}
test('all six documented graphs cover every stage with finite explicit positions and valid ports',()=>{
 assert.deepEqual(Object.keys(workflowGraphs).sort(),Object.keys(workflowCatalog).sort());
 const globalIds=new Set();
 for(const [id,graph] of Object.entries(workflowGraphs)){
  const stages=workflowCatalog[id].stages,ids=new Set(stages.map(stage=>stage.id));
  assert.equal(ids.size,stages.length);assert.deepEqual(Object.keys(graph.positions).sort(),[...ids].sort(),`${id} position coverage`);
  for(const stage of stages){assert.ok(!globalIds.has(stage.id));globalIds.add(stage.id);if(stage.targetAgent)assert.ok(workflowCatalog[stage.targetAgent]);}
  for(const point of Object.values(graph.positions))assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));
  for(const route of graph.routes){assert.ok(ids.has(route.source)&&ids.has(route.target),`${id}: ${route.source} → ${route.target}`);assert.notEqual(route.source,route.target);assert.ok(['left','right','top','bottom'].includes(route.sourcePort));assert.ok(['left','right','top','bottom'].includes(route.targetPort));}
  assert.ok(stages.every(stage=>graph.routes.some(route=>route.source===stage.id||route.target===stage.id)),`${id} has no disconnected documentation cards`);
 }
});
test('Manager exposes five eligible worker workflows, direct status reply and non-blocking queued handoff',()=>{
 const graph=workflowGraphs.manager,stages=workflowCatalog.manager.stages;
 const workers=stages.filter(stage=>stage.targetAgent);
 assert.deepEqual(workers.map(stage=>stage.targetAgent).sort(),['contacts','designer','outreach','proposal','scheduler']);
 for(const worker of workers){assert.ok(graph.routes.some(route=>route.source==='manager-delegate'&&route.target===worker.id&&route.kind==='handoff'));assert.ok(graph.routes.some(route=>route.source===worker.id&&route.target==='manager-reports'&&route.kind==='context'));}
 assert.ok(graph.routes.some(route=>route.source==='manager-context'&&route.target==='manager-output'&&route.label==='Status only'));
 assert.ok(reaches(graph,'manager-delegate','manager-output',workers.map(stage=>stage.id)),'queued handoff does not wait for worker completion');
 assert.equal(workflowOutgoing(graph,'manager-reports').some(route=>route.target==='manager-delegate'),false,'reports do not automatically reassign work');
});
test('Inbox separates source projection from writes and keeps reminders explicitly selected',()=>{
 const graph=workflowGraphs.scheduler;
 assert.ok(reaches(graph,'scheduler-trigger','scheduler-board',['scheduler-read','scheduler-book']),'board read does not require a new booking');
 assert.ok(graph.routes.filter(route=>route.target==='scheduler-calendar'||route.target==='scheduler-board').every(route=>route.kind==='projection'));
 assert.deepEqual(workflowOutgoing(graph,'scheduler-board'),[],'board Done cannot resolve attention or trigger a source write');
 assert.ok(graph.routes.some(route=>route.target==='scheduler-reminders'&&route.label==='Selected meetings only'));
 assert.ok(reaches(graph,'scheduler-read','scheduler-attention'));
});
test('Network research handoff cannot bypass Ryan release or leave a retained hold automatically',()=>{
 const graph=workflowGraphs.contacts;
 assert.ok(reaches(graph,'contacts-trigger','contacts-handoff'));
 assert.equal(reaches(graph,'contacts-trigger','contacts-handoff',['contacts-review']),false);
 assert.equal(reaches(graph,'contacts-held','contacts-handoff'),false);
 assert.equal(workflowCatalog.contacts.stages.find(stage=>stage.id==='contacts-review').capability,'manual');
});
test('Outreach standing and scoped entry both retain provider, history and preparation gates',()=>{
 const graph=workflowGraphs.outreach;
 for(const start of ['outreach-cycle','outreach-trigger'])for(const gate of ['outreach-guard','outreach-checks','outreach-draft'])assert.equal(reaches(graph,start,'outreach-send',[gate]),false,`${start} must pass ${gate}`);
 assert.ok(reaches(graph,'outreach-cycle','outreach-followup'));
 assert.equal(reaches(graph,'outreach-held','outreach-send'),false,'a hold is not an automatic resend path');
 assert.ok(workflowOutgoing(graph,'outreach-held').every(route=>route.kind==='context'));
 const followup=workflowCatalog.outreach.stages.find(stage=>stage.id==='outreach-followup');assert.match(followup.detail,/exactly one/i);assert.match(followup.detail,/five Monday–Friday business days/);
});
test('Proposal and Designer preserve review, explicit export, validation and refinement loops',()=>{
 const proposal=workflowGraphs.proposal,designer=workflowGraphs.designer;
 assert.equal(reaches(proposal,'proposal-trigger','proposal-output',['proposal-review']),false);
 assert.ok(proposal.routes.some(route=>route.target==='proposal-output'&&route.label==='Export requested'));
 assert.ok(proposal.routes.some(route=>route.source==='proposal-review'&&route.target==='proposal-template'));
 assert.equal(reaches(designer,'designer-trigger','designer-output',['designer-check']),false);
 assert.ok(designer.routes.some(route=>route.target==='designer-output'&&route.label==='Authorized publish'));
 assert.ok(designer.routes.some(route=>route.source==='designer-review'&&route.target==='designer-build'));
 assert.ok(reaches(designer,'designer-check','designer-review',['designer-output']),'reviewable handoff does not require deployment');
});
test('only internal agent routes can move, strictly while online and working with animation enabled',()=>{
 for(const graph of Object.values(workflowGraphs))for(const route of graph.routes){
  assert.equal(workflowRouteMoves(route.kind,false,'working',false),false);
  assert.equal(workflowRouteMoves(route.kind,true,'idle',false),false);
  assert.equal(workflowRouteMoves(route.kind,true,'working',true),false);
  assert.equal(workflowRouteMoves(route.kind,true,'working',false),!['handoff','context','projection'].includes(route.kind));
 }
});
