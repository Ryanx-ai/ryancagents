import test from 'node:test';
import assert from 'node:assert/strict';
import {atomicOfficeUpdate,newOfficeState,requireStrongETag,queueOfficeMessage,saveOfficeReceipt,saveOfficeReview} from '../lib/office-store.mjs';
function fixture(initial=newOfficeState()){
 let value=structuredClone(initial),version=1,writes=0,failAfterCommit=false;
 return {
  adapter:{async read(){return value?{value:structuredClone(value),etag:String(version)}:null;},async write(next,etag){if(etag!==String(version))throw Object.assign(new Error('conflict'),{conflict:true});value=structuredClone(next);version++;writes++;if(failAfterCommit){failAfterCommit=false;throw new Error('lost response');}},isConflict:e=>e.conflict===true},
  get state(){return value;},get writes(){return writes;},loseNextResponse(){failAfterCommit=true;},
 };
}
const message=(id,extra={})=>({id,agentId:'manager',prompt:`Fixture ${id}`,createdAt:new Date().toISOString(),status:'pending',...extra});
const update=(f,fn)=>atomicOfficeUpdate(f.adapter,fn,{sleep:async()=>{}});
test('concurrent enqueues, receipts and reviews merge through ETag conflicts',async()=>{
 const f=fixture(newOfficeState([message('existing')]));
 await Promise.all([
  update(f,s=>queueOfficeMessage(s,message('one'))),
  update(f,s=>queueOfficeMessage(s,message('two'))),
  update(f,s=>saveOfficeReceipt(s,'existing',{status:'replied',reply:'Complete'})),
  update(f,s=>saveOfficeReview(s,'manager-123')),
  update(f,s=>saveOfficeReview(s,'designer-456')),
 ]);
 assert.deepEqual(f.state.messages.map(m=>m.id).sort(),['existing','one','two']);
 assert.equal(f.state.messages[0].reply,'Complete');assert.deepEqual(f.state.completed,{'manager-123':true,'designer-456':true});
});
test('a committed prompt with a lost HTTP response retries idempotently',async()=>{
 const f=fixture();const m=message('one');f.loseNextResponse();
 await assert.rejects(update(f,s=>queueOfficeMessage(s,m)),/lost response/);
 const retry=await update(f,s=>queueOfficeMessage(s,m));assert.equal(retry.created,false);assert.equal(f.state.messages.length,1);assert.equal(f.writes,1);
 await assert.rejects(update(f,s=>queueOfficeMessage(s,{...m,prompt:'Different'})),e=>e.code==='MESSAGE_ID_CONFLICT');
});
test('queue revision changes in the same commit as enqueue, not for receipts or reviews',async()=>{
 const f=fixture();const before=f.state.queueRevision;
 await update(f,s=>queueOfficeMessage(s,message('one')));const after=f.state.queueRevision;assert.notEqual(after,before);
 await update(f,s=>saveOfficeReceipt(s,'one',{status:'queued'}));await update(f,s=>saveOfficeReview(s,'manager-123'));assert.equal(f.state.queueRevision,after);
});
test('a stale in-flight receipt cannot overwrite a completed reply',async()=>{
 const f=fixture(newOfficeState([message('one')]));
 await Promise.all([update(f,s=>saveOfficeReceipt(s,'one',{status:'replied',reply:'Final result',repliedAt:'2026-11-26T10:00:00Z'})),update(f,s=>saveOfficeReceipt(s,'one',{status:'queued',reply:null}))]);
 assert.equal(f.state.messages[0].status,'replied');assert.equal(f.state.messages[0].reply,'Final result');
});
test('expired history is pruned without dropping old undelivered commands',async()=>{
 const old=new Date(Date.now()-8*86400000).toISOString();
 const f=fixture(newOfficeState([message('pending',{createdAt:old}),message('queued',{createdAt:old,status:'queued'}),message('done',{createdAt:old,status:'replied'})]));
 await update(f,s=>queueOfficeMessage(s,message('new')));assert.deepEqual(f.state.messages.map(m=>m.id),['pending','queued','new']);
});
test('missing migration state fails closed rather than accepting an empty replacement',async()=>{
 const f=fixture(null);await assert.rejects(update(f,s=>queueOfficeMessage(s,message('one'))),e=>e.code==='STORAGE_MIGRATION_REQUIRED');assert.equal(f.writes,0);
});
test('offline retries return the original accepted command and signed system messages can queue offline',async()=>{
 const f=fixture();const m=message('one');await update(f,s=>queueOfficeMessage(s,m));
 const retry=await update(f,s=>queueOfficeMessage(s,m,false,false));assert.equal(retry.created,false);
 await assert.rejects(update(f,s=>queueOfficeMessage(s,message('two'),false,false)),e=>e.code==='BRIDGE_OFFLINE');
 await update(f,s=>queueOfficeMessage(s,message('alert',{source:'vercel-spending'})));assert.equal(f.state.messages.length,2);
});
test('bridge assignments require an existing manager parent in the same state',async()=>{
 const f=fixture();const assignment=message('child',{agentId:'designer',parentId:'parent'});
 await assert.rejects(update(f,s=>queueOfficeMessage(s,assignment,true)),e=>e.code==='MANAGER_REQUEST_REQUIRED');
 await update(f,s=>queueOfficeMessage(s,message('parent')));await update(f,s=>queueOfficeMessage(s,assignment,true));assert.equal(f.state.messages.length,2);
});

test('compressed or missing validators are rejected without pretending a weak ETag is strong',()=>{
 assert.equal(requireStrongETag('"storage-version"'),'"storage-version"');
 for(const etag of ['W/"storage-version"','',' ',null,undefined])assert.throws(()=>requireStrongETag(etag),e=>e.code==='STORAGE_VALIDATOR');
});
