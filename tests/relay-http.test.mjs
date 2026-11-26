import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {PromptRelay} from '../scripts/prompt-relay.mjs';
async function fixture(t){const dir=await mkdtemp(path.join(tmpdir(),'ryan-conditional-relay-'));t.after(()=>rm(dir,{recursive:true,force:true}));return new PromptRelay({url:'https://fixture.invalid',bridgeKey:'fixture',agents:[]},path.join(dir,'journal.json'));}
test('queue validators avoid decoding unchanged bodies and are not reused after restart',async t=>{
 const r=await fixture(t);const calls=[];const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
 globalThis.fetch=async(url,options)=>{calls.push(options);return calls.length===1?new Response(JSON.stringify({revision:'one',messages:[]}),{headers:{ETag:'"first"'}}):{status:304,ok:false,json(){throw new Error('304 has no JSON body');}};};
 const first=await r.request('GET',undefined,{queue:'1'});assert.equal(first.revision,'one');assert.equal(calls[0].headers['If-None-Match'],undefined);
 const next=await r.request('GET',undefined,{queue:'1',recover:'1'});assert.deepEqual(next,{unchanged:true});assert.equal(calls[1].headers['If-None-Match'],'"first"');
 const restarted=await fixture(t);await restarted.request('GET',undefined,{queue:'1'});assert.equal(calls[2].headers['If-None-Match'],undefined);
});
test('a failed response or malformed body never advances the queue validator',async t=>{
 const r=await fixture(t);r.queueETag='"before"';const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
 globalThis.fetch=async()=>new Response(JSON.stringify({code:'STORAGE_LIMIT'}),{status:503,headers:{ETag:'"wrong"','Retry-After':'60'}});
 await assert.rejects(r.request('GET',undefined,{queue:'1'}),e=>e.status===503&&e.retryAfterMs===60000);assert.equal(r.queueETag,'"before"');
 globalThis.fetch=async()=>new Response('not json',{headers:{ETag:'"wrong"'}});await assert.rejects(r.request('GET',undefined,{queue:'1'}));assert.equal(r.queueETag,'"before"');
});
