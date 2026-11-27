import {validatePalette} from './wardrobe.mjs';
// Keep the original keys so existing drafts and unfinished input remain discoverable.
export const AGENT_DRAFTS_KEY='ryan-agent-drafts-v1';
export const AGENT_DRAFT_RECOVERY_KEY='ryan-agent-draft-recovery-v1';
export const MAX_AGENT_DRAFTS=50;
export const CONNECTOR_IDS=Object.freeze(['gmail','calendar','contacts','sheets','gohighlevel','studio','codex']);
export const OUTFITS=Object.freeze([{id:'standard',label:'Classic Ryan'},{id:'manager',label:'The suit'},{id:'designer',label:'Studio glasses'}]);
const draftKeys=new Set(['schemaVersion','id','status','name','description','workflow','outfit','palette','requestedConnectors','connectorVerification','activation','createdAt','updatedAt']);
const uuid=/^draft_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isRecord=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
function text(value,label,max,partial=false){if(typeof value!=='string'||(!partial&&!value.trim())||(partial?value.length:value.trim().length)>max)throw new Error(`${label} must contain ${partial?'0':'1'}–${max} characters.`);return partial?value:value.trim();}
function workflow(value,partial,version){
 if(version===2&&(value===null||value===undefined))return null;
 if(!isRecord(value))throw new Error('The draft is missing its workflow.');
 if(Object.keys(value).some(key=>!['trigger','input','steps','output'].includes(key)))throw new Error('This workflow contains unsupported fields.');
 const minimum=version===1?1:0;
 if(!Array.isArray(value.steps)||value.steps.length<minimum||value.steps.length>12)throw new Error(`Add between ${minimum} and 12 workflow steps.`);
 // A v2 outline is optional, user-written planning material. It may be unfinished.
 const outline=partial||version===2;
 return {trigger:text(value.trigger,'Trigger',300,outline),input:text(value.input,'Input',1500,outline),steps:value.steps.map(step=>text(step,'Workflow step',500,outline)),output:text(value.output,'Output',1500,outline)};
}
function fields(value,partial=false,version=2){
 if(!isRecord(value))throw new Error('The draft format is invalid.');
 if(!OUTFITS.some(outfit=>outfit.id===value.outfit))throw new Error('Choose an available Ryan outfit.');
 if(!Array.isArray(value.requestedConnectors)||value.requestedConnectors.length>CONNECTOR_IDS.length||value.requestedConnectors.some(id=>!CONNECTOR_IDS.includes(id))||new Set(value.requestedConnectors).size!==value.requestedConnectors.length)throw new Error('The connector requests are invalid.');
 const name=text(value.name,'Name',60,partial||version===2);
 return {name:partial?name:name.trim(),description:text(value.description,'Prompt',2000,partial),workflow:workflow(value.workflow,partial,version),outfit:value.outfit,...(value.palette===undefined?{}:{palette:validatePalette(value.palette)}),requestedConnectors:[...value.requestedConnectors]};
}
export function validateAgentDraft(value){
 if(!isRecord(value)||![1,2].includes(value.schemaVersion)||Object.keys(value).some(key=>!draftKeys.has(key)))throw new Error('This draft format is not supported.');
 if(value.status!=='draft'||value.activation!=='unavailable'||value.connectorVerification!=='not_verified')throw new Error('Only inactive drafts with unverified connectors can be imported.');
 if(typeof value.id!=='string'||!uuid.test(value.id))throw new Error('The draft ID is invalid.');
 for(const key of ['createdAt','updatedAt'])if(typeof value[key]!=='string'||value[key].length>40||!Number.isFinite(Date.parse(value[key])))throw new Error('The draft timestamps are invalid.');
 if(Date.parse(value.createdAt)>Date.parse(value.updatedAt))throw new Error('The draft timestamps are out of order.');
 return {schemaVersion:value.schemaVersion,id:value.id,status:'draft',...fields(value,false,value.schemaVersion),connectorVerification:'not_verified',activation:'unavailable',createdAt:new Date(value.createdAt).toISOString(),updatedAt:new Date(value.updatedAt).toISOString()};
}
export function createAgentDraft(input,previous){
 const prior=previous?validateAgentDraft(previous):null;
 const now=new Date(Math.max(Date.now(),prior?Date.parse(prior.updatedAt):0)).toISOString();
 return validateAgentDraft({schemaVersion:2,id:prior?.id||`draft_${globalThis.crypto.randomUUID()}`,status:'draft',...fields(input),connectorVerification:'not_verified',activation:'unavailable',createdAt:prior?.createdAt||now,updatedAt:now});
}
function storageOrThrow(storage){if(storage)return storage;try{if(globalThis.localStorage)return globalThis.localStorage;}catch{}throw new Error('Browser storage is unavailable. Export your draft to keep a copy.');}
export function readAgentDrafts(storage){
 try{
  const raw=storageOrThrow(storage).getItem(AGENT_DRAFTS_KEY);if(raw===null)return {drafts:[],error:null};
  if(typeof raw!=='string'||raw.length>1000000)throw new Error();
  const saved=JSON.parse(raw);
  if(!isRecord(saved)||![1,2].includes(saved.version)||Object.keys(saved).some(key=>!['version','drafts'].includes(key))||!Array.isArray(saved.drafts)||saved.drafts.length>MAX_AGENT_DRAFTS)throw new Error();
  const drafts=saved.drafts.map(validateAgentDraft);if(new Set(drafts.map(draft=>draft.id)).size!==drafts.length)throw new Error();
  return {drafts:drafts.sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt)),error:null};
 }catch{return {drafts:[],error:'Saved drafts could not be read. Existing data was kept; export your current draft to keep a copy.'};}
}
function writeDrafts(drafts,storage){
 try{storageOrThrow(storage).setItem(AGENT_DRAFTS_KEY,JSON.stringify({version:2,drafts}));}
 catch{throw new Error('Could not save to this browser. Existing drafts were kept; export your draft to keep a copy.');}
 return drafts;
}
export function saveAgentDraft(value,storage){
 const draft=validateAgentDraft(value),current=readAgentDrafts(storage);if(current.error)throw new Error(current.error);
 const drafts=[draft,...current.drafts.filter(item=>item.id!==draft.id)];
 if(drafts.length>MAX_AGENT_DRAFTS)throw new Error(`This browser has ${MAX_AGENT_DRAFTS} drafts. Export or delete one before saving another.`);
 return writeDrafts(drafts,storage);
}
export function deleteAgentDraft(id,storage){
 if(typeof id!=='string'||!uuid.test(id))throw new Error('The draft ID is invalid.');
 const current=readAgentDrafts(storage);if(current.error)throw new Error(current.error);
 return writeDrafts(current.drafts.filter(draft=>draft.id!==id),storage);
}
export function exportAgentDraft(value){const draft=validateAgentDraft(value);return JSON.stringify({kind:'ryan-agent-draft',version:draft.schemaVersion,draft},null,2);}
export function importAgentDraft(raw){
 if(typeof raw!=='string'||raw.length>65536)throw new Error('Choose a draft JSON file smaller than 64 KB.');
 let saved;try{saved=JSON.parse(raw);}catch{throw new Error('This file is not valid JSON.');}
 if(!isRecord(saved)||saved.kind!=='ryan-agent-draft'||![1,2].includes(saved.version)||Object.keys(saved).some(key=>!['kind','version','draft'].includes(key))||saved.draft?.schemaVersion!==saved.version)throw new Error('Choose an exported Ryan agent draft.');
 const draft=validateAgentDraft(saved.draft),now=new Date().toISOString();
 // Imports are new local copies; retain the source schema and every editable field.
 return {...draft,id:`draft_${globalThis.crypto.randomUUID()}`,createdAt:now,updatedAt:now};
}
export function canActivateAgentDraft(){return false;}

function recoveryStorage(storage){if(storage)return storage;try{if(globalThis.sessionStorage)return globalThis.sessionStorage;}catch{}throw new Error('Tab recovery is unavailable.');}
function validateRecovery(value){
 if(!isRecord(value)||![1,2].includes(value.version)||Object.keys(value).some(key=>!(value.version===1?['version','form','editing','step','unlocked']:['version','form','editing','step','unlocked','view']).includes(key)))throw new Error('Unsupported recovery data.');
 if(!isRecord(value.form)||Object.keys(value.form).some(key=>!['name','description','workflow','outfit','palette','requestedConnectors'].includes(key)))throw new Error('Unsupported recovery fields.');
 const max=value.version===1?3:1;
 if(!Number.isInteger(value.step)||value.step<0||value.step>max||!Number.isInteger(value.unlocked)||value.unlocked<value.step||value.unlocked>max)throw new Error('Invalid recovery step.');
 if(value.version===2&&value.view!==undefined&&!['builder','customize'].includes(value.view))throw new Error('Invalid recovery screen.');
 const legacy=value.version===1;
 return {version:2,form:fields(value.form,true,value.version),editing:value.editing===null?null:validateAgentDraft(value.editing),step:legacy?Math.min(value.step,1):value.step,unlocked:legacy?Math.min(value.unlocked,1):value.unlocked,view:legacy?(value.step===1||value.step===2?'customize':'builder'):value.view||'builder'};
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
