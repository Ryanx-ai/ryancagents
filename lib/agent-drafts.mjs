export const AGENT_DRAFTS_KEY='ryan-agent-drafts-v1';
export const AGENT_DRAFT_RECOVERY_KEY='ryan-agent-draft-recovery-v1';
export const MAX_AGENT_DRAFTS=50;
export const CONNECTOR_IDS=Object.freeze(['gmail','calendar','contacts','sheets','gohighlevel','studio','codex']);
export const OUTFITS=Object.freeze([{id:'standard',label:'Classic Ryan'},{id:'manager',label:'The suit'},{id:'designer',label:'Studio glasses'}]);
const draftKeys=new Set(['schemaVersion','id','status','name','description','workflow','outfit','requestedConnectors','connectorVerification','activation','createdAt','updatedAt']);
const uuid=/^draft_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isRecord=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
function text(value,label,max,partial=false){if(typeof value!=='string'||(!partial&&!value.trim())||(partial?value.length:value.trim().length)>max)throw new Error(`${label} must contain ${partial?'0':'1'}–${max} characters.`);return partial?value:value.trim();}
function fields(value,partial=false){
 if(!isRecord(value)||!isRecord(value.workflow))throw new Error('The draft is missing its workflow.');
 const w=value.workflow;
 if(Object.keys(w).some(key=>!['trigger','input','steps','output'].includes(key)))throw new Error('This workflow contains unsupported fields.');
 if(!Array.isArray(w.steps)||w.steps.length<1||w.steps.length>12)throw new Error('Add between 1 and 12 workflow steps.');
 if(!OUTFITS.some(outfit=>outfit.id===value.outfit))throw new Error('Choose an available Ryan outfit.');
 if(!Array.isArray(value.requestedConnectors)||value.requestedConnectors.length>CONNECTOR_IDS.length||value.requestedConnectors.some(id=>!CONNECTOR_IDS.includes(id))||new Set(value.requestedConnectors).size!==value.requestedConnectors.length)throw new Error('The connector requests are invalid.');
 return {name:text(value.name,'Name',60,partial),description:text(value.description,'Task description',2000,partial),workflow:{trigger:text(w.trigger,'Trigger',300,partial),input:text(w.input,'Input',1500,partial),steps:w.steps.map(step=>text(step,'Workflow step',500,partial)),output:text(w.output,'Output',1500,partial)},outfit:value.outfit,requestedConnectors:[...value.requestedConnectors]};
}
export function validateAgentDraft(value){
 if(!isRecord(value)||value.schemaVersion!==1||Object.keys(value).some(key=>!draftKeys.has(key)))throw new Error('This draft format is not supported.');
 if(value.status!=='draft'||value.activation!=='unavailable'||value.connectorVerification!=='not_verified')throw new Error('Only inactive drafts with unverified connectors can be imported.');
 if(typeof value.id!=='string'||!uuid.test(value.id))throw new Error('The draft ID is invalid.');
 for(const key of ['createdAt','updatedAt'])if(typeof value[key]!=='string'||value[key].length>40||!Number.isFinite(Date.parse(value[key])))throw new Error('The draft timestamps are invalid.');
 if(Date.parse(value.createdAt)>Date.parse(value.updatedAt))throw new Error('The draft timestamps are out of order.');
 return {schemaVersion:1,id:value.id,status:'draft',...fields(value),connectorVerification:'not_verified',activation:'unavailable',createdAt:new Date(value.createdAt).toISOString(),updatedAt:new Date(value.updatedAt).toISOString()};
}
export function createAgentDraft(input,previous){
 const prior=previous?validateAgentDraft(previous):null;
 const now=new Date(Math.max(Date.now(),prior?Date.parse(prior.updatedAt):0)).toISOString();
 return validateAgentDraft({schemaVersion:1,id:prior?.id||`draft_${globalThis.crypto.randomUUID()}`,status:'draft',...fields(input),connectorVerification:'not_verified',activation:'unavailable',createdAt:prior?.createdAt||now,updatedAt:now});
}
function storageOrThrow(storage){
 if(storage)return storage;
 try{if(globalThis.localStorage)return globalThis.localStorage;}catch{}
 throw new Error('Browser storage is unavailable. Export your draft to keep a copy.');
}
export function readAgentDrafts(storage){
 try{
  const raw=storageOrThrow(storage).getItem(AGENT_DRAFTS_KEY);
  if(raw===null)return {drafts:[],error:null};
  if(typeof raw!=='string'||raw.length>1000000)throw new Error();
  const saved=JSON.parse(raw);
  if(!isRecord(saved)||saved.version!==1||Object.keys(saved).some(key=>!['version','drafts'].includes(key))||!Array.isArray(saved.drafts)||saved.drafts.length>MAX_AGENT_DRAFTS)throw new Error();
  const drafts=saved.drafts.map(validateAgentDraft);
  if(new Set(drafts.map(draft=>draft.id)).size!==drafts.length)throw new Error();
  return {drafts:drafts.sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt)),error:null};
 }catch{return {drafts:[],error:'Saved drafts could not be read. Existing data was kept; export your current draft to keep a copy.'};}
}
function writeDrafts(drafts,storage){
 try{storageOrThrow(storage).setItem(AGENT_DRAFTS_KEY,JSON.stringify({version:1,drafts}));}
 catch{throw new Error('Could not save to this browser. Existing drafts were kept; export your draft to keep a copy.');}
 return drafts;
}
export function saveAgentDraft(value,storage){
 const draft=validateAgentDraft(value),current=readAgentDrafts(storage);
 if(current.error)throw new Error(current.error);
 const drafts=[draft,...current.drafts.filter(item=>item.id!==draft.id)];
 if(drafts.length>MAX_AGENT_DRAFTS)throw new Error(`This browser has ${MAX_AGENT_DRAFTS} drafts. Export or delete one before saving another.`);
 return writeDrafts(drafts,storage);
}
export function deleteAgentDraft(id,storage){
 if(typeof id!=='string'||!uuid.test(id))throw new Error('The draft ID is invalid.');
 const current=readAgentDrafts(storage);if(current.error)throw new Error(current.error);
 return writeDrafts(current.drafts.filter(draft=>draft.id!==id),storage);
}
export function exportAgentDraft(value){return JSON.stringify({kind:'ryan-agent-draft',version:1,draft:validateAgentDraft(value)},null,2);}
export function importAgentDraft(raw){
 if(typeof raw!=='string'||raw.length>65536)throw new Error('Choose a draft JSON file smaller than 64 KB.');
 let saved;try{saved=JSON.parse(raw);}catch{throw new Error('This file is not valid JSON.');}
 if(!isRecord(saved)||saved.kind!=='ryan-agent-draft'||saved.version!==1)throw new Error('Choose an exported Ryan agent draft.');
 // Imports are new local copies, so importing a backup cannot overwrite its source.
 return createAgentDraft(validateAgentDraft(saved.draft));
}
export function canActivateAgentDraft(){return false;}

function recoveryStorage(storage){if(storage)return storage;try{if(globalThis.sessionStorage)return globalThis.sessionStorage;}catch{}throw new Error('Tab recovery is unavailable.');}
function validateRecovery(value){
 if(!isRecord(value)||value.version!==1||Object.keys(value).some(key=>!['version','form','editing','step','unlocked'].includes(key)))throw new Error('Unsupported recovery data.');
 if(!isRecord(value.form)||Object.keys(value.form).some(key=>!['name','description','workflow','outfit','requestedConnectors'].includes(key)))throw new Error('Unsupported recovery fields.');
 if(!Number.isInteger(value.step)||value.step<0||value.step>3||!Number.isInteger(value.unlocked)||value.unlocked<value.step||value.unlocked>3)throw new Error('Invalid recovery step.');
 return {version:1,form:fields(value.form,true),editing:value.editing===null?null:validateAgentDraft(value.editing),step:value.step,unlocked:value.unlocked};
}
export function readAgentDraftRecovery(storage){
 try{const raw=recoveryStorage(storage).getItem(AGENT_DRAFT_RECOVERY_KEY);if(raw===null)return {recovery:null,error:null};if(typeof raw!=='string'||raw.length>65536)throw new Error();return {recovery:validateRecovery(JSON.parse(raw)),error:null};}
 catch{return {recovery:null,error:'Tab recovery is unavailable. Existing recovery data was kept.'};}
}
export function saveAgentDraftRecovery(value,storage){
 const recovery=validateRecovery(value),current=readAgentDraftRecovery(storage);if(current.error)throw new Error(current.error);
 try{recoveryStorage(storage).setItem(AGENT_DRAFT_RECOVERY_KEY,JSON.stringify(recovery));}catch{throw new Error('Unfinished changes could not be kept in this tab.');}
 return recovery;
}
export function clearAgentDraftRecovery(storage){recoveryStorage(storage).removeItem(AGENT_DRAFT_RECOVERY_KEY);}
