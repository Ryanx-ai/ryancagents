import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {PromptRelay} from '../scripts/prompt-relay.mjs';
const id='20261126-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const laterId='20261126-cccccccc-cccc-cccc-cccc-cccccccccccc';
const stamp=new Date().toISOString();
const command=(agentId='scheduler',messageId=id)=>({id:messageId,agentId,prompt:'Read-only fixture request',createdAt:stamp,status:'pending'});
async function relay(t,runner=async()=>{},planner){const dir=await mkdtemp(path.join(tmpdir(),'ryan-fast-relay-'));t.after(()=>rm(dir,{recursive:true,force:true}));const r=new PromptRelay({codexPath:'/fixture/codex',agents:[{id:'scheduler',threadId:'fixture-chat'}]},path.join(dir,'journal.json'),runner,planner);await r.load();return r;}

test('queue pickup flushes its receipt in the same tick and unchanged polls do not redispatch',async t=>{
 let dispatched=0;const r=await relay(t,async()=>{dispatched++;});const calls=[];
 r.request=async(method,body,query)=>{calls.push({method,body,query});return method==='GET'?(query.revision?{revision:'one',unchanged:true}:{revision:'one',messages:[command()]}):{ok:true};};
 await r.tick();assert.equal(dispatched,1);assert.equal(calls[0].query.recover,'1');assert.equal(calls[1].method,'PATCH');assert.equal(calls[1].body.status,'queued');assert.ok(calls[1].body.pickedUpAt);assert.ok(calls[1].body.queuedAt);
 await r.tick();assert.equal(dispatched,1);assert.equal(calls[2].query.recover,undefined);assert.equal(calls[2].query.revision,'one');assert.equal(calls.length,3);
});
test('periodic recovery runs even when the queue revision has not changed',async t=>{
 const r=await relay(t);const queries=[];r.request=async(method,body,query)=>{queries.push(query);return {revision:'one',messages:[]};};
 await r.tick();await r.tick();r.nextRecoveryAt=Date.now()-1;await r.tick();assert.equal(queries[0].recover,'1');assert.equal(queries[1].recover,undefined);assert.equal(queries[2].recover,'1');
});
test('a failed queue read retains its cursor and still flushes newly observed replies',async t=>{
 const r=await relay(t);r.queueRevision='before';r.entries[id]={...command(),status:'replied',reply:'Fixture result',dirty:true};let patched=false;
 r.request=async(method)=>{if(method==='GET')throw new Error('queue unavailable');patched=true;return {ok:true};};
 await assert.rejects(r.tick(),/queue unavailable/);assert.equal(r.queueRevision,'before');assert.equal(r.nextRecoveryAt,0);assert.equal(patched,true);assert.equal(r.entries[id].dirty,false);
});
test('a busy manager retains its next command even if subsequent revision checks are unchanged',async t=>{
 let release;const waiting=new Promise(resolve=>release=resolve);let plans=0;const r=await relay(t,undefined,async()=>{plans++;if(plans===1)await waiting;return {summary:'Fixture complete',assignments:[]};});
 r.request=async(method,body,query)=>method==='GET'?(query.revision?{revision:'one',unchanged:true}:{revision:'one',messages:[command('manager'),command('manager',laterId)]}):{ok:true};
 await r.tick();assert.equal(plans,1);assert.equal(r.pending.has(laterId),true);release();await r.managerTask;await r.tick();await r.managerTask;assert.equal(plans,2);assert.equal(r.entries[laterId].status,'replied');assert.equal(r.pending.size,0);
});
test('log observations arriving before queue CLI exits are not overwritten by a late queued status',async t=>{
 let r;r=await relay(t,async()=>{
  r.observe('scheduler',{type:'event_msg',timestamp:stamp,payload:{type:'user_message',message:command().prompt}});
  r.observe('scheduler',{type:'event_msg',timestamp:new Date(Date.parse(stamp)+1000).toISOString(),payload:{type:'task_complete',last_agent_message:'Fixture reply'}});
 });
 await r.dispatch(command());assert.equal(r.entries[id].status,'replied');assert.equal(r.entries[id].reply,'Fixture reply');assert.ok(r.entries[id].deliveredAt);assert.ok(r.entries[id].repliedAt);assert.ok(r.entries[id].queuedAt);
});
test('in-flight receipt writes cannot clear a newer observation',async t=>{
 const r=await relay(t);r.entries[id]={...command(),status:'queued',dirty:true};r.request=async()=>{r.entries[id].status='delivered';r.entries[id].deliveredAt=stamp;return {ok:true};};
 await r.flushReceipts();assert.equal(r.entries[id].dirty,true);assert.equal(r.entries[id].status,'delivered');
});
test('concurrent flush loops share one write and preserve a newer receipt for the next flush',async t=>{
 const r=await relay(t);let release;const blocked=new Promise(resolve=>release=resolve);const statuses=[];
 r.entries[id]={...command(),status:'queued',dirty:true};
 r.request=async(method,body)=>{statuses.push(body.status);if(statuses.length===1)await blocked;return {ok:true};};
 const first=r.flushReceipts(),overlapping=r.flushReceipts();assert.strictEqual(first,overlapping);assert.deepEqual(statuses,['queued']);
 r.entries[id].status='replied';r.entries[id].reply='Fixture reply';release();await first;assert.equal(r.entries[id].dirty,true);
 await r.flushReceipts();assert.deepEqual(statuses,['queued','replied']);assert.equal(r.entries[id].dirty,false);
 await r.flushReceipts();assert.equal(statuses.length,2);
});
test('partial receipt failure holds the flush guard until the remaining writes finish',async t=>{
 const r=await relay(t);let release;const blocked=new Promise(resolve=>release=resolve);let writes=0;
 r.entries[id]={...command(),status:'queued',dirty:true};r.entries[laterId]={...command('scheduler',laterId),status:'queued',dirty:true};
 r.request=async(method,body)=>{writes++;if(body.id===id)throw new Error('Fixture failure');await blocked;return {ok:true};};
 const first=r.flushReceipts();const rejected=assert.rejects(first,/Fixture failure/);await Promise.resolve();await Promise.resolve();
 assert.strictEqual(r.flushReceipts(),first);assert.equal(writes,2);release();await rejected;assert.equal(r.receiptTask,null);assert.equal(r.entries[id].dirty,true);assert.equal(r.entries[laterId].dirty,false);
});
test('queue and receipt retries perform no network calls during their failure backoff',async t=>{
 const r=await relay(t);let now=1000;let reads=0,writes=0;
 r.queueBackoff.now=()=>now;r.queueBackoff.random=()=>0;r.receiptBackoff.now=()=>now;r.receiptBackoff.random=()=>0;
 r.entries[id]={...command(),status:'replied',reply:'Keep this reply',dirty:true};
 r.request=async method=>{if(method==='GET'){reads++;throw Object.assign(new Error('Storage unavailable'),{retryAfterMs:30000});}writes++;throw Object.assign(new Error('Storage unavailable'),{retryAfterMs:30000});};
 await assert.rejects(r.tick(),/Storage unavailable/);assert.equal(reads,1);assert.equal(writes,1);
 for(let i=0;i<10;i++){await r.tick();await r.flushReceipts();}assert.equal(reads,1);assert.equal(writes,1);assert.equal(r.entries[id].dirty,true);
 now+=30000;r.request=async method=>{if(method==='GET'){reads++;return {revision:'after',messages:[]};}writes++;return {ok:true};};
 await r.tick();assert.equal(reads,2);assert.equal(writes,2);assert.equal(r.entries[id].dirty,false);assert.equal(r.queueBackoff.failures,0);assert.equal(r.receiptBackoff.failures,0);
});
