import test from 'node:test';
import assert from 'node:assert/strict';
import {SANDBOX_KEY,MAX_NODES,MAX_EDGES,createSandboxGraph,validateSandboxGraph,readSandboxGraph,saveSandboxGraph,addSandboxNode,updateSandboxNode,removeSandboxNodes,connectSandboxEdge,removeSandboxEdges} from '../lib/workflow-sandbox.mjs';
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
