import {randomUUID} from 'node:crypto';

export const OFFICE_STATE_PATH='office/state-v2.json';
export const HISTORY_DAYS=7;
const terminal=new Set(['replied','failed','uncertain','expired']);
const receiptRank={pending:0,planning:1,queued:2,uncertain:2.5,delivered:3,failed:4,expired:4,replied:5};
export class OfficeStorageError extends Error {
 constructor(code,message,status=503){super(message);this.name='OfficeStorageError';this.code=code;this.status=status;}
}
// Compressed HTTP representations can expose a weak ETag. Never strip W/ and
// pretend it is strong; the version must come from an identity-encoded read.
export function requireStrongETag(etag){
 if(typeof etag!=='string'||!etag.trim()||/^W\//i.test(etag))throw new OfficeStorageError('STORAGE_VALIDATOR','Office storage version could not be verified. Retry shortly.');
 return etag;
}
export function newOfficeState(messages=[],completed={}){
 return {version:2,revision:randomUUID(),queueRevision:randomUUID(),updatedAt:new Date().toISOString(),messages,completed};
}
export function checkedState(value){
 if(!value)throw new OfficeStorageError('STORAGE_MIGRATION_REQUIRED','Office storage is being upgraded. Try again shortly.');
 if(value.version!==2||!Array.isArray(value.messages)||!value.completed||typeof value.completed!=='object'||typeof value.queueRevision!=='string')throw new OfficeStorageError('STORAGE_INVALID','Office storage needs attention. Your requests have not been discarded.');
 return value;
}
/** Retry only an ETag conflict. A successful write is the sole commit point. */
export async function atomicOfficeUpdate(adapter,mutate,{attempts=8,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 for(let attempt=0;attempt<attempts;attempt++){
  const current=await adapter.read();
  const state=structuredClone(checkedState(current?.value));
  const result=mutate(state);
  if(result?.changed===false)return result.value;
  const cutoff=Date.now()-HISTORY_DAYS*86400000;
  // Never evict an undelivered command. Old terminal history matches the former
  // seven-day API window; queued/delivered commands stay until acknowledged.
  state.messages=state.messages.filter(m=>!terminal.has(m.status)||Date.parse(m.createdAt)>=cutoff);
  state.revision=randomUUID();state.updatedAt=new Date().toISOString();
  if(Buffer.byteLength(JSON.stringify(state))>8*1024*1024)throw new OfficeStorageError('STORAGE_CAPACITY','Office history needs maintenance before accepting more work.');
  try{await adapter.write(state,current.etag);return result?.value;}
  catch(error){if(!adapter.isConflict(error))throw error;if(attempt===attempts-1)throw new OfficeStorageError('STORAGE_BUSY','Office storage is busy. Retry this request.');await sleep(Math.min(250,15*2**attempt)+Math.floor(Math.random()*20));}
 }
}
export function queueOfficeMessage(state,message,requireManagerParent=false,bridgeReady=true){
 const existing=state.messages.find(m=>m.id===message.id);
 if(existing){
  if(existing.agentId!==message.agentId||existing.prompt!==message.prompt||existing.parentId!==message.parentId)throw new OfficeStorageError('MESSAGE_ID_CONFLICT','Message ID already used',409);
  return {changed:false,value:{message:existing,created:false}};
 }
 if(!bridgeReady)throw new OfficeStorageError('BRIDGE_OFFLINE','Mac bridge offline. Open Codex and try again.');
 if(requireManagerParent&&!state.messages.some(m=>m.id===message.parentId&&m.agentId==='manager'))throw new OfficeStorageError('MANAGER_REQUEST_REQUIRED','Manager request required',403);
 state.messages.push(message);state.queueRevision=randomUUID();
 return {value:{message,created:true}};
}
export function saveOfficeReceipt(state,id,receipt){
 const index=state.messages.findIndex(m=>m.id===id);
 if(index<0)throw new OfficeStorageError('MESSAGE_NOT_FOUND','Unknown message',404);
 const current=state.messages[index];
 // A delayed queued/delivered HTTP request must never erase a finished reply.
 if((receiptRank[receipt.status]??-1)<(receiptRank[current.status]??0))return {changed:false,value:{ok:true}};
 const next={...current,...receipt};
 if(JSON.stringify(next)===JSON.stringify(current))return {changed:false,value:{ok:true}};
 state.messages[index]=next;
 return {value:{ok:true}};
}
export function saveOfficeReview(state,key){
 if(state.completed[key])return {changed:false,value:{ok:true,id:key}};
 state.completed[key]=true;return {value:{ok:true,id:key}};
}
