import test from 'node:test';
import assert from 'node:assert/strict';
import {completionKey,completionRows,knownCompletion,reviewWatermarks,reviewSheetState,completionOwnsLatestResult} from '../lib/completions.mjs';
const before='2026-11-26T06:00:00.000Z',now='2026-11-26T07:00:00.000Z',after='2026-11-26T08:00:00.000Z';
const states=[{id:'manager',completedAt:now,result:'The latest result'}];
const events=[{agentId:'manager',at:before,kind:'completed',label:'Earlier task'},{agentId:'manager',at:now,kind:'completed',label:'Latest task'}];
test('completion list deduplicates the current result and keeps past work separately actionable',()=>{
 const rows=completionRows(states,events);
 assert.equal(rows.length,2);assert.equal(rows[0].result,'The latest result');assert.equal(rows[1].result,undefined);
 assert.equal(rows[0].current,true);assert.equal(rows[1].current,false);
});
test('marking one completion done never acknowledges another completion',()=>{
 const marked={[completionKey('manager',now)]:true};
 const reviews=reviewWatermarks({},marked);
 const rows=completionRows(states,events,reviews,marked);
 assert.deepEqual(rows.map(r=>r.done),[true,false]);
 assert.equal(completionRows([{id:'manager',completedAt:after}],[],reviews,marked)[0].done,false);
});
test('older acknowledgements cannot move the latest reviewed timestamp backwards',()=>{
 assert.deepEqual(reviewWatermarks({manager:now},{[completionKey('manager',before)]:true}),{manager:now});
 assert.deepEqual(reviewWatermarks({}, {[completionKey('manager',now)]:true,[completionKey('manager',before)]:true}),{manager:now});
});
test('review API accepts only actual current or historical completion timestamps',()=>{
 const snapshot={agents:states,events};
 assert.equal(knownCompletion(snapshot,'manager',now),true);assert.equal(knownCompletion(snapshot,'manager',before),true);
 assert.equal(knownCompletion(snapshot,'manager',after),false);assert.equal(knownCompletion(snapshot,'contacts',now),false);
 assert.equal(knownCompletion({events:[{...events[0],kind:'working'}]},'manager',before),false);
 assert.equal(completionKey('../../private',now),null);assert.equal(completionKey('manager','bad date'),null);
});

test('a reviewed completion cannot hide a newer attention request in All or To review',()=>{
 const state={id:'manager',status:'waiting',completedAt:now,attentionAt:after,result:'Please approve the next step.'};
 assert.equal(completionOwnsLatestResult(state),false,'chat must not put Mark done on a newer input request');
 const marked={[completionKey('manager',now)]:true};
 const all=reviewSheetState([state],events,{},marked,true,'all');
 assert.deepEqual(all.visibleAttention,[state]);
 assert.equal(all.visible.find(row=>row.completedAt===now).done,true);
 assert.equal(all.visible.find(row=>row.completedAt===now).result,null,'a newer request is not relabelled as the old completed result');
 const pending=reviewSheetState([state],events,{},marked,true,'review');
 assert.deepEqual(pending.visibleAttention,[state]);
 assert.ok(pending.visible.every(row=>!row.done));
 const done=reviewSheetState([state],events,{},marked,true,'done');
 assert.deepEqual(done.visibleAttention,[]);
 assert.equal(done.visible.length,1);
 assert.deepEqual(reviewSheetState([state],events,{},marked,false,'all').visibleAttention,[],'offline presence does not claim current attention');
});

test('a later genuine completion retains its result after earlier attention',()=>{
 const state={id:'manager',status:'idle',completedAt:after,attentionAt:now,result:'The approved task is complete.'};
 const view=reviewSheetState([state],[],{}, {},true,'all');
 assert.equal(view.visible[0].result,state.result);
 assert.equal(completionOwnsLatestResult(state),true);
 assert.equal(completionOwnsLatestResult(undefined),false);
 assert.deepEqual(view.visibleAttention,[]);
});
