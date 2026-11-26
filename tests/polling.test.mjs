import test from 'node:test';
import assert from 'node:assert/strict';
import {pollRetryDelay} from '../lib/polling.mjs';
test('browser polling slows exponentially after repeated failures and caps ordinary backoff',()=>{
 assert.deepEqual([1,2,3,4,5,6,7,99].map(n=>pollRetryDelay(n,null)),[10000,20000,40000,80000,160000,300000,300000,300000]);
 assert.equal(pollRetryDelay(1,null),10000);
});
test('numeric and date Retry-After headers can extend the five-minute backoff',()=>{
 const now=Date.parse('2026-11-26T09:00:00Z');
 assert.equal(pollRetryDelay(1,'60',now),60000);assert.equal(pollRetryDelay(1,'1800',now),1800000);
 assert.equal(pollRetryDelay(2,'Thu, 26 Nov 2026 09:10:00 GMT',now),600000);assert.equal(pollRetryDelay(99,'7200',now),3600000);
});
test('invalid or expired Retry-After values do not collapse the polling delay',()=>{
 const now=Date.parse('2026-11-26T09:00:00Z');
 for(const value of ['bad','-5','0','Thu, 26 Nov 2026 08:00:00 GMT'])assert.equal(pollRetryDelay(3,value,now),40000);
 assert.equal(pollRetryDelay(NaN,'bad',now),10000);
});
