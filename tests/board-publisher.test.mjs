import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarFingerprint,boardPublishDecision,boardPublishFailure,BOARD_CHECKIN_MS} from '../scripts/board-publisher.mjs';
const snapshot={version:1,day:'2026-11-27',observedAt:'2026-11-27T03:00:00Z',status:'ok',events:[{eventId:'b',title:'Second'},{eventId:'a',title:'First'}]};
test('publisher fingerprint ignores check time and event order but detects source content/day changes',()=>{
 const hash=calendarFingerprint(snapshot);
 assert.equal(hash,calendarFingerprint({...snapshot,observedAt:'2026-11-27T03:15:00Z',events:[...snapshot.events].reverse()}));
 assert.notEqual(hash,calendarFingerprint({...snapshot,day:'2026-11-28'}));
 assert.notEqual(hash,calendarFingerprint({...snapshot,events:[{eventId:'a',title:'Moved'}]}));
});
test('unchanged calendars publish at most hourly and changed calendars publish next eligible cycle',()=>{
 const now=10000000,journal={fingerprint:calendarFingerprint(snapshot),publishedAt:now};
 assert.equal(boardPublishDecision(snapshot,journal,now+15*60000).publish,false);
 assert.equal(boardPublishDecision(snapshot,journal,now+BOARD_CHECKIN_MS).publish,true);
 assert.equal(boardPublishDecision({...snapshot,events:[]},journal,now+1000).publish,true);
});
test('upgrading or advancing the declared horizon publishes even when the event list is unchanged',()=>{
 const now=10000000,journal={fingerprint:calendarFingerprint(snapshot),publishedAt:now};
 const horizon={...snapshot,version:2,rangeStart:'2026-11-27',rangeEnd:'2026-12-10'};
 assert.equal(boardPublishDecision(horizon,journal,now+1000).reason,'changed');
 const upgraded={fingerprint:calendarFingerprint(horizon),publishedAt:now};
 assert.equal(boardPublishDecision({...horizon,observedAt:'2026-11-27T03:15:00Z',events:[...horizon.events].reverse()},upgraded,now+1000).reason,'unchanged');
 assert.equal(boardPublishDecision({...horizon,day:'2026-11-28',rangeStart:'2026-11-28',rangeEnd:'2026-12-11'},upgraded,now+1000).reason,'changed');
});
test('publisher retries are bounded and respect authentication/429 backoff',()=>{
 const now=10000000;
 assert.equal(boardPublishFailure({},401,null,now).retryAt,now+3600000);
 const failure=boardPublishFailure({},429,'900',now);assert.equal(failure.retryAt,now+900000);
 assert.equal(boardPublishDecision(snapshot,failure,now+10000).reason,'backoff');
 assert.ok(boardPublishFailure({failures:7},503,'999999',now).retryAt<=now+3600000);
});
