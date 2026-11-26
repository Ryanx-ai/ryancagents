import test from 'node:test';
import assert from 'node:assert/strict';
import {RequestBackoff,responseError} from '../scripts/backoff.mjs';
import {commandLifetime} from '../scripts/prompt-relay.mjs';
test('storage failures exponentially back off and a success restores fast polling',()=>{
 let time=1000;const backoff=new RequestBackoff({now:()=>time,random:()=>0});assert.equal(backoff.ready(),true);
 assert.equal(backoff.fail(new Error('offline')),5000);assert.equal(backoff.ready(),false);time+=4999;assert.equal(backoff.ready(),false);time++;assert.equal(backoff.ready(),true);
 assert.equal(backoff.fail(new Error('offline')),10000);backoff.success();assert.equal(backoff.ready(),true);assert.equal(backoff.fail(new Error('offline')),5000);
});
test('Retry-After is honored and HTTP errors expose only safe status codes',async()=>{
 const error=await responseError(new Response(JSON.stringify({code:'STORAGE_LIMIT',error:'Private internal detail'}),{status:503,headers:{'Retry-After':'120'}}),'Fixture');
 assert.equal(error.retryAfterMs,120000);assert.equal(error.message,'Fixture HTTP 503 (STORAGE_LIMIT)');
 const backoff=new RequestBackoff({now:()=>0,random:()=>0});assert.equal(backoff.fail(error),120000);assert.equal(backoff.fail({status:401}),60000);
});
test('signed spending alerts remain deliverable for seven days; normal prompts expire after one hour',()=>{
 assert.equal(commandLifetime({source:'vercel-spending'}),7*86400000);assert.equal(commandLifetime({source:'other'}),3600000);assert.equal(commandLifetime({}),3600000);
});
