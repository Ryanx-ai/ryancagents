import test from 'node:test';
import assert from 'node:assert/strict';
import {SANDBOX_KEY,MAX_NODES,MAX_EDGES,SANDBOX_TEMPLATES,sandboxTemplate,sandboxNodeRole,sandboxEligibleTargets,createSandboxGraph,validateSandboxGraph,readSandboxGraph,saveSandboxGraph,addSandboxNode,addSandboxTemplate,addSandboxAgentExample,duplicateSandboxNode,updateSandboxNode,removeSandboxNodes,connectSandboxEdge,removeSandboxEdges} from '../lib/workflow-sandbox.mjs';
const memory=(initial=null)=>{let raw=initial;return {getItem(key){assert.equal(key,SANDBOX_KEY);return raw;},setItem(key,value){assert.equal(key,SANDBOX_KEY);raw=value;},raw:()=>raw};};

test('sandbox starts as a fresh inert three-step sample',()=>{
 const a=createSandboxGraph(),b=createSandboxGraph();
 assert.equal(a.nodes.length,3);assert.equal(a.edges.length,2);assert.deepEqual(a.nodes.map(node=>node.data.kind),['trigger','action','review']);
 a.nodes[0].data.label='Changed';assert.equal(b.nodes[0].data.label,'Start manually');
 assert.deepEqual(Object.keys(b),['version','nodes','edges']);
});
test('add, edit, connect and group delete are immutable and remove incident edges',()=>{
 const original=createSandboxGraph(),before=JSON.stringify(original);
 const added=addSandboxNode(original,{label:'Result',kind:'output',notes:'Practice only',position:{x:900,y:100}}),id=added.nodes.at(-1).id;
 assert.equal(JSON.stringify(original),before);assert.match(id,/^sandbox_/);
 const edited=updateSandboxNode(added,id,{position:{x:920,y:130},data:{label:'Reviewed result'}});
 assert.equal(added.nodes.at(-1).data.label,'Result');assert.equal(edited.nodes.at(-1).data.notes,'Practice only');
 const connected=connectSandboxEdge(edited,'sandbox-review',id);
 assert.equal(connected.edges.length,3);assert.equal(connectSandboxEdge(connected,'sandbox-review',id).edges.length,3);
 const removed=removeSandboxNodes(connected,['sandbox-action',id]);
 assert.equal(removed.nodes.length,2);assert.equal(removed.edges.length,0);
 assert.equal(removeSandboxEdges(connected,[connected.edges[0].id,connected.edges[2].id]).edges.length,1);
});
test('cycles are allowed but self edges, missing endpoints and duplicate graph entries are rejected',()=>{
 const graph=createSandboxGraph();assert.equal(connectSandboxEdge(graph,'sandbox-review','sandbox-start').edges.length,3);
 assert.throws(()=>connectSandboxEdge(graph,'sandbox-start','sandbox-start'));
 assert.throws(()=>connectSandboxEdge(graph,'sandbox-start','missing'));
 for(const mutate of [g=>g.nodes.push(g.nodes[0]),g=>g.edges.push(g.edges[0]),g=>g.edges.push({...g.edges[0],id:'duplicate-pair'}),g=>g.edges[0].target='missing']){
  const invalid=createSandboxGraph();mutate(invalid);assert.throws(()=>validateSandboxGraph(invalid));
 }
 assert.deepEqual(removeSandboxNodes(graph,graph.nodes.map(node=>node.id)),{version:1,nodes:[],edges:[]});
});
test('unknown node and edge fields never persist execution or credential payloads',()=>{
 const graph=createSandboxGraph();Object.assign(graph.nodes[0],{agentId:'manager',credentials:{token:'SECRET'},selected:true});
 Object.assign(graph.nodes[0].data,{run:true,apiKey:'SECRET',connector:'gmail'});Object.assign(graph.edges[0],{command:'SEND',animated:true});
 const clean=validateSandboxGraph(graph),storage=memory();saveSandboxGraph(graph,storage);
 assert.doesNotMatch(JSON.stringify(clean),/SECRET|manager|gmail|SEND|animated|credentials|apiKey|selected/);
 assert.equal(storage.raw(),JSON.stringify(clean));
 assert.throws(()=>validateSandboxGraph({...graph,execute:true}));assert.throws(()=>validateSandboxGraph({...graph,version:2}));
});
test('node content and geometry remain bounded',()=>{
 const graph=createSandboxGraph(),id=graph.nodes[0].id;
 for(const input of [{label:''},{label:'x'.repeat(61)},{kind:'run'},{notes:'x'.repeat(1001)},{position:{x:Infinity,y:0}},{position:{x:0,y:10001}}])assert.throws(()=>addSandboxNode(graph,input));
 assert.throws(()=>updateSandboxNode(graph,id,{data:{notes:'x'.repeat(1001)}}));
 assert.throws(()=>updateSandboxNode(graph,'missing',{data:{label:'Changed'}}));
 let maximum={version:1,nodes:[],edges:[]};for(let i=0;i<MAX_NODES;i++)maximum=addSandboxNode(maximum,{label:`Step ${i}`});
 assert.throws(()=>addSandboxNode(maximum));
 for(let i=0;maximum.edges.length<MAX_EDGES;i++){const source=maximum.nodes[Math.floor(i/(MAX_NODES-1))].id;const target=maximum.nodes[(i%(MAX_NODES-1))+1].id;if(source!==target)maximum=connectSandboxEdge(maximum,source,target);}
 assert.throws(()=>connectSandboxEdge(maximum,maximum.nodes[3].id,maximum.nodes[0].id));
});
test('save and reload use only the dedicated browser key',()=>{
 const storage=memory();assert.deepEqual(readSandboxGraph(storage),{graph:null,error:null});
 const graph=createSandboxGraph();assert.deepEqual(saveSandboxGraph(graph,storage),graph);assert.deepEqual(readSandboxGraph(storage),{graph,error:null});
});
test('corrupt, future and unknown storage remain untouched by attempted saves',()=>{
 for(const raw of ['broken','null',JSON.stringify({...createSandboxGraph(),version:2}),JSON.stringify({...createSandboxGraph(),futureData:{keep:true}}),'x'.repeat(250001)]){
  const storage=memory(raw),loaded=readSandboxGraph(storage);assert.equal(loaded.graph,null);assert.ok(loaded.error);
  assert.throws(()=>saveSandboxGraph(createSandboxGraph(),storage));assert.equal(storage.raw(),raw);
 }
});
test('storage access and quota errors fail visibly without claiming a save',()=>{
 const old=JSON.stringify(createSandboxGraph());
 const denied={getItem(){throw Error('Denied');},setItem(){throw Error('Denied');}};
 assert.ok(readSandboxGraph(denied).error);assert.throws(()=>saveSandboxGraph(createSandboxGraph(),denied));
 const full={getItem(){return old;},setItem(){throw Error('Quota');}};
 assert.throws(()=>saveSandboxGraph(createSandboxGraph(),full),/could not be saved/);assert.equal(full.getItem(),old);
});

test('existing version-one custom canvas round trips without replacing labels, positions or notes',()=>{
 const old=createSandboxGraph();old.nodes[1].data={label:'My old custom action',kind:'output',notes:'Keep my plans'};old.nodes[1].position={x:-123,y:456};
 const raw=JSON.stringify(old),storage=memory(raw),restored=readSandboxGraph(storage);
 assert.deepEqual(restored,{graph:old,error:null});saveSandboxGraph(restored.graph,storage);assert.equal(storage.raw(),raw);
 const expanded=addSandboxTemplate(restored.graph,'gmail-draft');assert.deepEqual(expanded.nodes.slice(0,3),old.nodes);assert.deepEqual(expanded.edges,old.edges);
});
test('app templates persist only supported bounded example settings',()=>{
 let graph=addSandboxTemplate(createSandboxGraph(),'gmail-draft');const id=graph.nodes.at(-1).id;
 graph=updateSandboxNode(graph,id,{data:{config:{recipient:'example@example.com',subject:'Practice',body:'Only a local sketch'},run:true}});
 const storage=memory();saveSandboxGraph(graph,storage);assert.deepEqual(readSandboxGraph(storage).graph,graph);
 assert.equal(graph.nodes.at(-1).data.templateId,'gmail-draft');assert.doesNotMatch(storage.raw(),/"run"|credentials|execute/);
 for(const patch of [{templateId:'unknown'},{config:{apiKey:'not-supported'}},{config:{subject:'x'.repeat(1001)}},{config:{subject:5}}])assert.throws(()=>updateSandboxNode(graph,id,{data:patch}));
 assert.throws(()=>updateSandboxNode(createSandboxGraph(),'sandbox-start',{data:{config:{body:'Invalid'}}}));
 assert.equal(new Set(SANDBOX_TEMPLATES.map(template=>template.id)).size,SANDBOX_TEMPLATES.length);
 assert.equal(sandboxTemplate('missing'),null);
});
test('add-next makes a new branch without disconnecting an existing successor',()=>{
 const original=createSandboxGraph(),before=JSON.stringify(original);
 const next=addSandboxTemplate(original,'review',{afterId:'sandbox-action'}),added=next.nodes.at(-1);
 assert.deepEqual(next.edges.slice(0,original.edges.length),original.edges);
 assert.equal(next.edges.at(-1).source,'sandbox-action');assert.equal(next.edges.at(-1).target,added.id);
 assert.equal(added.data.templateId,'review');assert.ok(added.position.y>original.nodes[1].position.y);
 assert.equal(JSON.stringify(original),before);
});
test('insert replaces exactly one connection as an immutable all-or-nothing change',()=>{
 const original=connectSandboxEdge(createSandboxGraph(),'sandbox-start','sandbox-review'),before=JSON.stringify(original);
 const replaced=original.edges[0],next=addSandboxTemplate(original,'condition',{edgeId:replaced.id}),added=next.nodes.at(-1);
 assert.equal(next.edges.length,original.edges.length+1);assert.ok(!next.edges.some(edge=>edge.id===replaced.id));
 for(const edge of original.edges.slice(1))assert.deepEqual(next.edges.find(item=>item.id===edge.id),edge);
 assert.ok(next.edges.some(edge=>edge.source===replaced.source&&edge.target===added.id));
 assert.ok(next.edges.some(edge=>edge.source===added.id&&edge.target===replaced.target));
 assert.equal(JSON.stringify(original),before);
 assert.throws(()=>addSandboxTemplate(original,'condition',{edgeId:'gone'}));
 assert.throws(()=>addSandboxTemplate(original,'condition',{edgeId:replaced.id,afterId:'sandbox-start'}));
 let full={version:1,nodes:[],edges:[]};for(let i=0;i<10;i++)full=addSandboxNode(full,{label:`Step ${i}`});
 for(const source of full.nodes)for(const target of full.nodes)if(source.id!==target.id&&full.edges.length<MAX_EDGES)full=connectSandboxEdge(full,source.id,target.id);
 const fullBefore=JSON.stringify(full);assert.throws(()=>addSandboxTemplate(full,'review',{edgeId:full.edges[0].id}),/80 connections/);assert.equal(JSON.stringify(full),fullBefore);
});
test('duplicate copies local settings with fresh identity but no copied links or shared nested state',()=>{
 let original=addSandboxTemplate(createSandboxGraph(),'gmail-draft',{afterId:'sandbox-review'});const source=original.nodes.at(-1);
 original=updateSandboxNode(original,source.id,{data:{config:{subject:'Original'},notes:'Keep me'}});
 const next=duplicateSandboxNode(original,source.id),copy=next.nodes.at(-1);
 assert.notEqual(copy.id,source.id);assert.equal(copy.data.label,'Draft email copy');assert.equal(copy.data.notes,'Keep me');assert.deepEqual(next.edges,original.edges);
 copy.data.config.subject='Changed';assert.equal(original.nodes.at(-1).data.config.subject,'Original');
});
test('oversized serialized example settings cannot replace an existing readable save',()=>{
 const original=createSandboxGraph(),storage=memory(JSON.stringify(original));let large={version:1,nodes:[],edges:[]};
 for(let i=0;i<MAX_NODES;i++){large=addSandboxTemplate(large,'gmail-draft');large=updateSandboxNode(large,large.nodes.at(-1).id,{data:{config:{recipient:'\u0000'.repeat(1000),subject:'\u0000'.repeat(1000),body:'\u0000'.repeat(1000)}}});}
 assert.throws(()=>saveSandboxGraph(large,storage),/too large to save/);assert.deepEqual(readSandboxGraph(storage).graph,original);
});

test('AI example adds a main path and three distinct attachments without replacing an existing graph',()=>{
 const original=createSandboxGraph(),before=JSON.stringify(original),next=addSandboxAgentExample(original);
 assert.deepEqual(next.nodes.slice(0,3),original.nodes);assert.deepEqual(next.edges.slice(0,2),original.edges);assert.equal(JSON.stringify(original),before);
 const cluster=next.nodes.slice(3),agent=cluster.find(node=>sandboxNodeRole(node)==='agent');
 assert.deepEqual(cluster.map(sandboxNodeRole),['main','agent','main','model','memory','tool']);
 assert.deepEqual(next.edges.filter(edge=>edge.attachment).map(edge=>edge.attachment),['model','memory','tool']);
 assert.ok(next.edges.filter(edge=>edge.attachment).every(edge=>edge.target===agent.id));
 const storage=memory();saveSandboxGraph(next,storage);assert.deepEqual(readSandboxGraph(storage).graph,next);
 assert.equal(next.version,1);assert.doesNotMatch(JSON.stringify(next),/"status"|"credentials"|"execution"|"apiKey"/);
});
test('attachment ports enforce matching role, AI Agent target and single model/memory slots',()=>{
 let graph=addSandboxAgentExample({version:1,nodes:[],edges:[]});const agent=graph.nodes.find(node=>sandboxNodeRole(node)==='agent'),model=graph.nodes.find(node=>sandboxNodeRole(node)==='model'),trigger=graph.nodes[0];
 graph=removeSandboxEdges(graph,graph.edges.filter(edge=>edge.attachment==='model').map(edge=>edge.id));
 assert.throws(()=>connectSandboxEdge(graph,model.id,agent.id),/attachment port/);
 assert.throws(()=>connectSandboxEdge(graph,model.id,agent.id,{attachment:'memory'}),/matching/);
 assert.throws(()=>connectSandboxEdge(graph,model.id,trigger.id,{attachment:'model'}),/matching/);
 assert.throws(()=>connectSandboxEdge(graph,trigger.id,agent.id,{attachment:'tool'}),/matching/);
 graph=connectSandboxEdge(graph,model.id,agent.id,{attachment:'model'});
 graph=addSandboxTemplate(graph,'ai-chat-model');const another=graph.nodes.at(-1);const before=JSON.stringify(graph);
 assert.throws(()=>connectSandboxEdge(graph,another.id,agent.id,{attachment:'model'}),/one model/);assert.equal(JSON.stringify(graph),before);
 const tools=addSandboxTemplate(graph,'calendar-tool',{attachId:agent.id});assert.equal(tools.edges.filter(edge=>edge.attachment==='tool').length,2);
 assert.throws(()=>addSandboxTemplate(graph,'ai-memory',{attachId:agent.id}),/one model/);
});
test('inspector targets exclude occupied single attachment slots and become available when freed',()=>{
 let graph=addSandboxAgentExample({version:1,nodes:[],edges:[]});
 const agent=graph.nodes.find(node=>sandboxNodeRole(node)==='agent');
 graph=addSandboxTemplate(graph,'ai-chat-model');const model=graph.nodes.at(-1);
 graph=addSandboxTemplate(graph,'ai-memory');const memory=graph.nodes.at(-1);
 graph=addSandboxTemplate(graph,'calendar-tool');const tool=graph.nodes.at(-1);
 const before=JSON.stringify(graph);
 assert.deepEqual(sandboxEligibleTargets(graph,model.id),[]);
 assert.deepEqual(sandboxEligibleTargets(graph,memory.id),[]);
 assert.deepEqual(sandboxEligibleTargets(graph,tool.id).map(node=>node.id),[agent.id],'multiple distinct tool attachments remain eligible');
 assert.equal(JSON.stringify(graph),before,'reading choices does not change the canvas');
 for(const [role,source] of [['model',model],['memory',memory]]){
  const freed=removeSandboxEdges(graph,graph.edges.filter(edge=>edge.target===agent.id&&edge.attachment===role).map(edge=>edge.id));
  assert.deepEqual(sandboxEligibleTargets(freed,source.id).map(node=>node.id),[agent.id]);
  const attached=connectSandboxEdge(freed,source.id,agent.id,{attachment:role});
  assert.deepEqual(sandboxEligibleTargets(attached,source.id),[]);
 }
 const connected=connectSandboxEdge(graph,tool.id,agent.id,{attachment:'tool'});
 assert.deepEqual(sandboxEligibleTargets(connected,tool.id),[],'an existing source-target connection is not offered twice');
 assert.deepEqual(sandboxEligibleTargets(graph,''),[]);
 assert.deepEqual(sandboxEligibleTargets(null,'missing'),[]);
});
test('attachment branches cannot become sequential paths or be split by a primary action',()=>{
 const graph=addSandboxAgentExample({version:1,nodes:[],edges:[]}),before=JSON.stringify(graph),edge=graph.edges.find(edge=>edge.attachment==='model'),model=graph.nodes.find(node=>node.id===edge.source);
 assert.throws(()=>addSandboxTemplate(graph,'gmail-draft',{edgeId:edge.id}),/main path/);
 assert.throws(()=>addSandboxTemplate(graph,'gmail-draft',{afterId:model.id}),/attachment port/);
 assert.throws(()=>addSandboxTemplate(graph,'ai-memory',{edgeId:graph.edges[0].id}),/attachment port/);
 assert.throws(()=>updateSandboxNode(graph,model.id,{data:{templateId:'ai-memory'}}),/matching/);
 assert.equal(JSON.stringify(graph),before);
 const deleted=removeSandboxNodes(graph,[edge.target]);assert.equal(deleted.edges.length,0);assert.equal(deleted.nodes.length,5);
});

test('new tools fan across the attachment row without moving existing user positions',()=>{
 let original=addSandboxAgentExample({version:1,nodes:[],edges:[]});const agent=original.nodes.find(node=>sandboxNodeRole(node)==='agent'),firstTool=original.nodes.find(node=>sandboxNodeRole(node)==='tool');
 original=updateSandboxNode(original,firstTool.id,{position:{x:123,y:456}});const before=JSON.stringify(original);
 const second=addSandboxTemplate(original,'calendar-tool',{attachId:agent.id}),third=addSandboxTemplate(second,'sheets-tool',{attachId:agent.id});
 assert.deepEqual(second.nodes.at(-1).position,{x:agent.position.x+290+190,y:agent.position.y+240});
 assert.deepEqual(third.nodes.at(-1).position,{x:agent.position.x+290+380,y:agent.position.y+240});
 assert.deepEqual(third.nodes.slice(0,original.nodes.length),original.nodes);assert.equal(JSON.stringify(original),before);
 const explicit=addSandboxTemplate(third,'ai-tool',{attachId:agent.id,position:{x:900,y:600}});assert.deepEqual(explicit.nodes.at(-1).position,{x:900,y:600});
});
test('AI example capacity errors are atomic and unsupported attachment data never overwrites saved graphs',()=>{
 let graph=createSandboxGraph();while(graph.nodes.length<37)graph=addSandboxNode(graph);
 const before=JSON.stringify(graph);assert.throws(()=>addSandboxAgentExample(graph),/40 nodes/);assert.equal(JSON.stringify(graph),before);
 const invalid=addSandboxAgentExample({version:1,nodes:[],edges:[]});invalid.edges[0].attachment='credentials';
 const storage=memory(JSON.stringify(invalid));assert.ok(readSandboxGraph(storage).error);assert.throws(()=>saveSandboxGraph(createSandboxGraph(),storage));assert.equal(storage.raw(),JSON.stringify(invalid));
});
