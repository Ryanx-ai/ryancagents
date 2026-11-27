// This graph is browser-local practice data. It has no agents, connectors,
// credentials, commands, schedules or execution state.
export const SANDBOX_KEY='ryan-workflow-sandbox-v1';
export const MAX_NODES=40;
export const MAX_EDGES=80;
export const SANDBOX_KINDS=Object.freeze(['trigger','action','review','output']);
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value);
function label(value){if(typeof value!=='string'||!value.trim()||value.trim().length>60)throw Error('Node labels need 1–60 characters.');return value.trim();}
function position(value){if(!record(value)||!['x','y'].every(key=>Number.isFinite(value[key])&&Math.abs(value[key])<=10000))throw Error('Node positions must stay within the sandbox.');return {x:value.x,y:value.y};}
function nodeData(value){
 if(!record(value)||!SANDBOX_KINDS.includes(value.kind)||typeof value.notes!=='string'||value.notes.length>1000)throw Error('Node details are invalid. Keep notes under 1,000 characters.');
 return {label:label(value.label),kind:value.kind,notes:value.notes};
}
export function validateSandboxGraph(value){
 if(!record(value)||value.version!==1||Object.keys(value).some(key=>!['version','nodes','edges'].includes(key)))throw Error('This sandbox format is not supported.');
 if(!Array.isArray(value.nodes)||value.nodes.length>MAX_NODES||!Array.isArray(value.edges)||value.edges.length>MAX_EDGES)throw Error('The sandbox supports up to 40 nodes and 80 connections.');
 const ids=new Set();
 const nodes=value.nodes.map(node=>{
  if(!record(node)||!validId(node.id)||ids.has(node.id)||node.type!=='sandbox')throw Error('The sandbox contains an invalid or duplicate node.');
  ids.add(node.id);
  // Ignore imported/transient React Flow properties and all unknown payloads.
  return {id:node.id,type:'sandbox',position:position(node.position),data:nodeData(node.data)};
 });
 const edgeIds=new Set(),pairs=new Set();
 const edges=value.edges.map(edge=>{
  if(!record(edge)||!validId(edge.id)||edgeIds.has(edge.id)||!ids.has(edge.source)||!ids.has(edge.target)||edge.source===edge.target)throw Error('The sandbox contains an invalid connection.');
  const pair=JSON.stringify([edge.source,edge.target]);if(pairs.has(pair))throw Error('The sandbox contains a duplicate connection.');
  edgeIds.add(edge.id);pairs.add(pair);
  return {id:edge.id,source:edge.source,target:edge.target};
 });
 return {version:1,nodes,edges};
}
export function createSandboxGraph(){
 return validateSandboxGraph({version:1,nodes:[
  {id:'sandbox-start',type:'sandbox',position:{x:40,y:100},data:{label:'Start manually',kind:'trigger',notes:''}},
  {id:'sandbox-action',type:'sandbox',position:{x:320,y:100},data:{label:'Prepare a result',kind:'action',notes:''}},
  {id:'sandbox-review',type:'sandbox',position:{x:600,y:100},data:{label:'Review the result',kind:'review',notes:''}},
 ],edges:[{id:'edge-start-action',source:'sandbox-start',target:'sandbox-action'},{id:'edge-action-review',source:'sandbox-action',target:'sandbox-review'}]});
}
export function addSandboxNode(graph,input={}){
 const next=validateSandboxGraph(graph);if(next.nodes.length>=MAX_NODES)throw Error('The sandbox already has 40 nodes.');
 if(!record(input))throw Error('Node details are invalid.');
 next.nodes.push({id:`sandbox_${globalThis.crypto.randomUUID()}`,type:'sandbox',position:position(input.position??{x:80,y:80}),data:nodeData({label:input.label??'New step',kind:input.kind??'action',notes:input.notes??''})});
 return next;
}
export function updateSandboxNode(graph,id,patch){
 const next=validateSandboxGraph(graph),index=next.nodes.findIndex(node=>node.id===id);
 if(index<0)throw Error('This sandbox node no longer exists.');
 if(!record(patch)||(patch.data!==undefined&&!record(patch.data)))throw Error('Node details are invalid.');
 const node=next.nodes[index];
 next.nodes[index]={...node,position:patch.position===undefined?node.position:position(patch.position),data:patch.data===undefined?node.data:nodeData({...node.data,...patch.data})};
 return next;
}
function selection(ids){if(!Array.isArray(ids)||ids.length>MAX_NODES+MAX_EDGES||ids.some(id=>!validId(id)))throw Error('The sandbox selection is invalid.');return new Set(ids);}
export function removeSandboxNodes(graph,ids){
 const next=validateSandboxGraph(graph),removed=selection(ids);
 next.nodes=next.nodes.filter(node=>!removed.has(node.id));
 next.edges=next.edges.filter(edge=>!removed.has(edge.source)&&!removed.has(edge.target));
 return next;
}
export function connectSandboxEdge(graph,source,target){
 const next=validateSandboxGraph(graph),ids=new Set(next.nodes.map(node=>node.id));
 if(!ids.has(source)||!ids.has(target)||source===target)throw Error('Connect two different sandbox nodes.');
 if(next.edges.some(edge=>edge.source===source&&edge.target===target))return next;
 if(next.edges.length>=MAX_EDGES)throw Error('The sandbox already has 80 connections.');
 next.edges.push({id:`edge_${globalThis.crypto.randomUUID()}`,source,target});return next;
}
export function removeSandboxEdges(graph,ids){const next=validateSandboxGraph(graph),removed=selection(ids);next.edges=next.edges.filter(edge=>!removed.has(edge.id));return next;}
function browserStorage(storage){
 if(storage)return storage;
 try{if(globalThis.localStorage)return globalThis.localStorage;}catch{}
 throw Error('Browser storage is unavailable.');
}
export function readSandboxGraph(storage){
 try{
  const raw=browserStorage(storage).getItem(SANDBOX_KEY);if(raw===null)return {graph:null,error:null};
  if(typeof raw!=='string'||raw.length>250000)throw Error('Invalid sandbox data.');
  return {graph:validateSandboxGraph(JSON.parse(raw)),error:null};
 }catch{return {graph:null,error:'The saved sandbox could not be read. Existing data was kept.'};}
}
export function saveSandboxGraph(graph,storage){
 const next=validateSandboxGraph(graph),current=readSandboxGraph(storage);
 if(current.error)throw Error(current.error);
 try{browserStorage(storage).setItem(SANDBOX_KEY,JSON.stringify(next));}
 catch{throw Error('The sandbox could not be saved in this browser. Existing data was kept.');}
 return next;
}
