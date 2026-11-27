// This graph is browser-local practice data. It has no agents, connectors,
// credentials, commands, schedules or execution state.
export const SANDBOX_KEY='ryan-workflow-sandbox-v1';
export const MAX_NODES=40;
export const MAX_EDGES=80;
export const SANDBOX_KINDS=Object.freeze(['trigger','action','review','output']);
// Design-time descriptions only. No template contains code, credentials or a runner.
export const SANDBOX_TEMPLATES=Object.freeze([
 {id:'manual-start',app:'manual',appLabel:'Manual',label:'Manual start',description:'Start a workflow from an example input.',kind:'trigger',category:'triggers',fields:[{key:'input',label:'Example input',multiline:true}]},
 {id:'schedule',app:'schedule',appLabel:'Schedule',label:'Scheduled start',description:'Sketch when a workflow would begin.',kind:'trigger',category:'triggers',fields:[{key:'schedule',label:'Schedule description'},{key:'timezone',label:'Timezone'}]},
 {id:'gmail-new',app:'gmail',appLabel:'Gmail',label:'New email',description:'Describe the incoming emails to watch.',kind:'trigger',category:'triggers',fields:[{key:'query',label:'Email search query',placeholder:'label:inbox is:unread'}]},
 {id:'gmail-search',app:'gmail',appLabel:'Gmail',label:'Find emails',description:'Look up messages matching a query.',kind:'action',category:'apps',fields:[{key:'query',label:'Search query',placeholder:'subject:meeting'}]},
 {id:'gmail-draft',app:'gmail',appLabel:'Gmail',label:'Draft email',description:'Plan an email draft without sending it.',kind:'action',category:'apps',fields:[{key:'recipient',label:'Example recipient'},{key:'subject',label:'Subject'},{key:'body',label:'Draft body',multiline:true}]},
 {id:'gmail-send',app:'gmail',appLabel:'Gmail',label:'Send email',description:'Sketch a send step. No email will be sent.',kind:'action',category:'apps',fields:[{key:'recipient',label:'Example recipient'},{key:'subject',label:'Subject'},{key:'body',label:'Message body',multiline:true}]},
 {id:'calendar-check',app:'calendar',appLabel:'Google Calendar',label:'Check availability',description:'Describe a calendar availability check.',kind:'action',category:'apps',fields:[{key:'date',label:'Example date'},{key:'window',label:'Time window'}]},
 {id:'calendar-event',app:'calendar',appLabel:'Google Calendar',label:'Create event',description:'Plan an event and its expected details.',kind:'action',category:'apps',fields:[{key:'title',label:'Event title'},{key:'start',label:'Start time'},{key:'end',label:'End time'}]},
 {id:'sheets-find',app:'sheets',appLabel:'Google Sheets',label:'Find row',description:'Describe a lookup in a spreadsheet.',kind:'action',category:'apps',fields:[{key:'sheet',label:'Example spreadsheet'},{key:'match',label:'Match rule'}]},
 {id:'sheets-add',app:'sheets',appLabel:'Google Sheets',label:'Add row',description:'Plan the columns to add to a sheet.',kind:'action',category:'apps',fields:[{key:'sheet',label:'Example spreadsheet'},{key:'columns',label:'Column values',multiline:true}]},
 {id:'contacts-research',app:'contacts',appLabel:'Contacts',label:'Research contact',description:'Sketch the information needed for a contact.',kind:'action',category:'apps',fields:[{key:'company',label:'Example company'},{key:'criteria',label:'Research criteria',multiline:true}]},
 {id:'ghl-contact',app:'gohighlevel',appLabel:'GoHighLevel',label:'Update contact',description:'Plan a CRM update. GHL is not connected here.',kind:'action',category:'apps',fields:[{key:'contact',label:'Example contact reference'},{key:'changes',label:'Proposed changes',multiline:true}]},
 {id:'codex-brief',app:'codex',appLabel:'Codex',label:'Agent brief',description:'Write a pretend agent instruction. No model call.',kind:'action',category:'apps',fields:[{key:'brief',label:'Example brief',multiline:true}]},
 {id:'studio-proposal',app:'studio',appLabel:'Proposal Studio',label:'Prepare proposal',description:'Sketch a proposal handoff without creating a draft.',kind:'action',category:'apps',fields:[{key:'template',label:'Example template'},{key:'notes',label:'Example meeting notes',multiline:true}]},
 {id:'condition',app:'logic',appLabel:'Flow tools',label:'Condition',description:'Describe a rule for choosing the next path.',kind:'action',category:'logic',fields:[{key:'condition',label:'Condition',placeholder:'Reviewed equals yes'},{key:'otherwise',label:'Otherwise'}]},
 {id:'delay',app:'logic',appLabel:'Flow tools',label:'Wait',description:'Describe a pause. No timer will be scheduled.',kind:'action',category:'logic',fields:[{key:'duration',label:'Example duration',placeholder:'15 minutes'}]},
 {id:'review',app:'review',appLabel:'Human review',label:'Ask Ryan to review',description:'Add an explicit decision before the next step.',kind:'review',category:'logic',fields:[{key:'decision',label:'Review instruction',multiline:true}]},
 {id:'result',app:'output',appLabel:'Output',label:'Record result',description:'Describe the result the workflow should produce.',kind:'output',category:'logic',fields:[{key:'result',label:'Expected result',multiline:true}]},
]);
export function sandboxTemplate(id){return SANDBOX_TEMPLATES.find(template=>template.id===id)||null;}
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value);
function label(value){if(typeof value!=='string'||!value.trim()||value.trim().length>60)throw Error('Node labels need 1–60 characters.');return value.trim();}
function position(value){if(!record(value)||!['x','y'].every(key=>Number.isFinite(value[key])&&Math.abs(value[key])<=10000))throw Error('Node positions must stay within the sandbox.');return {x:value.x,y:value.y};}
function nodeData(value){
 if(!record(value)||!SANDBOX_KINDS.includes(value.kind)||typeof value.notes!=='string'||value.notes.length>1000)throw Error('Node details are invalid. Keep notes under 1,000 characters.');
 const data={label:label(value.label),kind:value.kind,notes:value.notes};
 if(value.templateId!==undefined){
  const template=sandboxTemplate(value.templateId);if(!template)throw Error('This sandbox action is not supported.');
  const config=value.config??{};
  if(!record(config)||Object.entries(config).some(([key,text])=>!template.fields.some(field=>field.key===key)||typeof text!=='string'||text.length>1000))throw Error('Action settings contain unsupported or oversized fields.');
  data.templateId=template.id;data.config={...config};
 }else if(value.config!==undefined)throw Error('Action settings need a supported sandbox template.');
 return data;
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
 next.nodes.push({id:`sandbox_${globalThis.crypto.randomUUID()}`,type:'sandbox',position:position(input.position??{x:80,y:80}),data:nodeData({label:input.label??'New step',kind:input.kind??'action',notes:input.notes??'',...(input.templateId!==undefined?{templateId:input.templateId,config:input.config??{}}:{})})});
 return next;
}
export function addSandboxTemplate(graph,templateId,placement={}){
 const template=sandboxTemplate(templateId);if(!template)throw Error('Choose a supported sandbox action.');
 if(placement.afterId&&placement.edgeId)throw Error('Choose one insertion position.');
 let next=validateSandboxGraph(graph),point=placement.position,after=null,edge=null;
 if(placement.afterId){after=next.nodes.find(node=>node.id===placement.afterId);if(!after)throw Error('The preceding node no longer exists.');point??={x:after.position.x+280,y:after.position.y+next.edges.filter(item=>item.source===after.id).length*160};}
 if(placement.edgeId){edge=next.edges.find(item=>item.id===placement.edgeId);if(!edge)throw Error('This connection no longer exists.');const source=next.nodes.find(node=>node.id===edge.source),target=next.nodes.find(node=>node.id===edge.target);point??={x:(source.position.x+target.position.x)/2,y:(source.position.y+target.position.y)/2+100};next=removeSandboxEdges(next,[edge.id]);}
 next=addSandboxNode(next,{templateId,label:template.label,kind:template.kind,notes:'',position:point??{x:80,y:80}});
 const id=next.nodes.at(-1).id;
 if(after)next=connectSandboxEdge(next,after.id,id);
 if(edge){next=connectSandboxEdge(next,edge.source,id);next=connectSandboxEdge(next,id,edge.target);}
 return next;
}
export function duplicateSandboxNode(graph,id){
 const current=validateSandboxGraph(graph),source=current.nodes.find(node=>node.id===id);if(!source)throw Error('This node no longer exists.');
 return addSandboxNode(current,{...source.data,label:`${source.data.label.slice(0,55)} copy`,position:{x:Math.min(10000,source.position.x+40),y:Math.min(10000,source.position.y+130)}});
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
 const serialized=JSON.stringify(next);if(serialized.length>250000)throw Error('This sandbox is too large to save. Shorten its notes or settings.');
 try{browserStorage(storage).setItem(SANDBOX_KEY,serialized);}
 catch{throw Error('The sandbox could not be saved in this browser. Existing data was kept.');}
 return next;
}
