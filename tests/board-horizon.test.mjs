import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {atomicBoardUpdate,newBoardState,checkedBoardState,boardView,createBoardNote,updateBoardNote,validateCalendarSnapshot,ingestBoardCalendar,calendarSnapshotRange,singaporeDay,BOARD_CALENDAR_DAYS} from '../lib/board.mjs';

const NOW=Date.parse('2026-11-27T03:00:00Z'),DAY=86400000,HOUR=3600000;
const scope={accountId:'work@example.com',calendarId:'work-calendar'};
const event=(extra={})=>({eventId:'fixture-event',title:'Fixture meeting',body:'Fixture source notes',start:'2026-11-27T11:30:00+08:00',end:'2026-11-27T12:00:00+08:00',allDay:false,...extra});
const snapshot=(events=[event()],now=NOW,extra={})=>({version:2,status:'ok',day:singaporeDay(now),...calendarSnapshotRange(singaporeDay(now)),timeZone:'Asia/Singapore',...scope,observedAt:new Date(now).toISOString(),complete:true,events,...extra});
const legacy=(events=[event()],now=NOW)=>{const {rangeStart,rangeEnd,...value}=snapshot(events,now);return {...value,version:1};};
const ingest=(state,input,now=NOW)=>ingestBoardCalendar(state,validateCalendarSnapshot(input,scope,now),now);
const failed=(now=NOW,reason='partial')=>{const {events,complete,...input}=snapshot([],now);return {...input,status:'error',reason};};
const future=()=>event({eventId:'future',start:'2026-12-03T16:30:00Z',end:'2026-12-03T17:00:00Z'});

test('calendar v2 requires exactly 14 inclusive Singapore dates, including month/year transitions',()=>{
 assert.equal(BOARD_CALENDAR_DAYS,14);
 assert.deepEqual(calendarSnapshotRange('2026-11-27'),{rangeStart:'2026-11-27',rangeEnd:'2026-12-10'});
 assert.deepEqual(calendarSnapshotRange('2026-12-25'),{rangeStart:'2026-12-25',rangeEnd:'2027-01-07'});
 assert.deepEqual(calendarSnapshotRange('2028-02-20'),{rangeStart:'2028-02-20',rangeEnd:'2028-03-04'});
 const good=snapshot();assert.deepEqual(validateCalendarSnapshot(validateCalendarSnapshot(good,scope,NOW),scope,NOW),validateCalendarSnapshot(good,scope,NOW));
 for(const patch of [{rangeStart:undefined},{rangeEnd:undefined},{rangeStart:'2026-11-26'},{rangeEnd:'2026-12-09'},{rangeEnd:'2026-12-11'},{rangeEnd:'2026-12-1'},{version:3},{version:1}])assert.throws(()=>validateCalendarSnapshot({...good,...patch},scope,NOW));
 assert.equal(validateCalendarSnapshot(legacy(),scope,NOW).version,1);
 assert.throws(()=>validateCalendarSnapshot({...failed(),rangeEnd:'2026-12-09'},scope,NOW));
});

test('range events use interval overlap with exclusive end and keep one row per stable occurrence',()=>{
 const good=[event(),future(),event({eventId:'all-day',allDay:true,start:'2026-11-26',end:'2026-11-29'}),event({eventId:'last-minute',start:'2026-12-10T23:59:00+08:00',end:'2026-12-11T00:30:00+08:00'}),event({eventId:'overnight',start:'2026-11-26T23:00:00+08:00',end:'2026-11-27T01:00:00+08:00'})];
 const state=newBoardState();ingest(state,snapshot(good));assert.equal(state.calendar.length,5);
 assert.equal(state.calendar.find(n=>n.calendar.eventId==='future').date,'2026-12-04');
 assert.equal(state.calendar.find(n=>n.calendar.eventId==='all-day').date,'2026-11-26');
 assert.equal(state.calendar.find(n=>n.calendar.eventId==='overnight').date,'2026-11-26');
 assert.equal(state.calendar.find(n=>n.calendar.eventId==='last-minute').date,'2026-12-10');
 for(const outside of [event({start:'2026-12-11T00:00:00+08:00',end:'2026-12-11T01:00:00+08:00'}),event({start:'2026-11-26T23:00:00+08:00',end:'2026-11-27T00:00:00+08:00'}),event({allDay:true,start:'2026-12-11',end:'2026-12-12'}),event({allDay:true,start:'2026-11-26',end:'2026-11-27'})])assert.throws(()=>validateCalendarSnapshot(snapshot([outside]),scope,NOW));
 assert.throws(()=>validateCalendarSnapshot(snapshot([event(),event()]),scope,NOW));
 assert.throws(()=>validateCalendarSnapshot(snapshot(Array.from({length:201},(_,i)=>event({eventId:String(i)}))),scope,NOW));
 checkedBoardState(state);
});

test('legacy boards project honest one-day coverage and upgrade without losing notes or acknowledgements',()=>{
 const state=newBoardState();createBoardNote(state,{id:randomUUID(),date:'2027-01-10',title:'Future manual task',body:'Keep this task',color:'yellow'},NOW);
 ingest(state,legacy());delete state.source.rangeStart;delete state.source.rangeEnd;
 checkedBoardState(state);assert.equal(boardView(state,undefined,NOW).calendar.rangeEnd,'2026-11-27');
 const note=state.calendar[0];updateBoardNote(state,{id:note.id,version:1,patch:{done:true,color:'mint'}},NOW+1);
 const manual=structuredClone(state.manual),acknowledged=structuredClone(state.calendar[0]);
 ingest(state,snapshot([event(),future()],NOW+60000),NOW+60000);
 assert.deepEqual(state.manual,manual);assert.deepEqual(state.calendar.find(n=>n.id===note.id),acknowledged);
 assert.equal(state.calendar.length,2);assert.equal(boardView(state,undefined,NOW+60000).calendar.rangeEnd,'2026-12-10');checkedBoardState(state);
});

test('calendar rescheduling, cancellation and reappearance preserve stable Done/color flags',()=>{
 const state=newBoardState();ingest(state,snapshot([future()]));const original=state.calendar[0];
 updateBoardNote(state,{id:original.id,version:1,patch:{done:true,color:'peach'}},NOW+1);
 const moved=event({...future(),start:'2026-12-05T08:00:00+08:00',end:'2026-12-05T09:00:00+08:00'});
 ingest(state,snapshot([moved],NOW+60000),NOW+60000);assert.equal(state.calendar[0].id,original.id);assert.equal(state.calendar[0].date,'2026-12-05');assert.equal(state.calendar[0].version,3);assert.equal(state.calendar[0].done,true);
 ingest(state,snapshot([{eventId:'future',status:'cancelled'}],NOW+120000),NOW+120000);assert.equal(state.calendar.length,0);
 ingest(state,snapshot([moved],NOW+180000),NOW+180000);assert.equal(state.calendar[0].id,original.id);assert.equal(state.calendar[0].version,4);assert.equal(state.calendar[0].done,true);assert.equal(state.calendar[0].color,'peach');
 ingest(state,snapshot([],NOW+240000),NOW+240000);assert.equal(state.calendar.length,0);assert.equal(state.calendarFlags[original.id].done,true);checkedBoardState(state);
});

test('daily range advance refreshes coverage without changing unchanged event versions',()=>{
 const late=Date.parse('2026-11-27T15:55:00Z'),afterMidnight=late+10*60000,state=newBoardState();
 ingest(state,snapshot([future()],late),late);const note=structuredClone(state.calendar[0]);
 assert.equal(boardView(state,undefined,afterMidnight).calendar.status,'stale');
 ingest(state,snapshot([future()],afterMidnight),afterMidnight);
 assert.deepEqual(state.calendar[0],note);assert.equal(state.source.day,'2026-11-28');assert.equal(state.source.rangeEnd,'2026-12-11');assert.equal(boardView(state,undefined,afterMidnight).calendar.status,'current');
});

test('partial and failed reads preserve last-good coverage, events and observation; stale input cannot roll them back',()=>{
 const state=newBoardState();ingest(state,snapshot([future()]));const good=structuredClone(state);
 const tomorrow=NOW+DAY;ingest(state,failed(tomorrow),tomorrow);
 assert.deepEqual(state.calendar,good.calendar);assert.equal(state.source.observedAt,good.source.observedAt);assert.equal(state.source.rangeStart,good.source.rangeStart);assert.equal(state.source.rangeEnd,good.source.rangeEnd);
 const view=boardView(state,undefined,tomorrow);assert.equal(view.calendar.status,'error');assert.equal(view.calendar.reason,'partial');assert.equal(view.calendar.lastAttemptAt,new Date(tomorrow).toISOString());
 assert.throws(()=>validateCalendarSnapshot({...snapshot([],tomorrow),complete:false},scope,tomorrow));
 assert.throws(()=>ingest(state,snapshot([],tomorrow-60000),tomorrow),e=>e.code==='CALENDAR_STALE');
 assert.throws(()=>ingest(state,snapshot([],tomorrow),tomorrow),e=>e.code==='CALENDAR_CONFLICT');
 ingest(state,snapshot([future()],tomorrow+60000),tomorrow+60000);assert.equal(state.source.reason,null);assert.equal(state.calendar[0].version,good.calendar[0].version);checkedBoardState(state);
});

test('an obsolete one-day publisher cannot overwrite an established horizon or cause a Blob write',async()=>{
 const state=newBoardState();ingest(state,snapshot([future()]));const before=structuredClone(state);let writes=0;
 const adapter={async read(){return {value:structuredClone(state),etag:'fixed'};},async write(){writes++;},isConflict:()=>false};
 await assert.rejects(atomicBoardUpdate(adapter,s=>ingest(s,legacy([],NOW+60000),NOW+60000)),e=>e.code==='CALENDAR_RANGE_REQUIRED'&&e.status===409);
 assert.equal(writes,0);assert.deepEqual(state,before);
 // A legacy error may report a failed check, but must preserve the established range.
 const {rangeStart,rangeEnd,...oldFailure}=failed(NOW+120000);ingest(state,{...oldFailure,version:1},NOW+120000);assert.equal(state.source.rangeEnd,'2026-12-10');assert.deepEqual(state.calendar,before.calendar);
});

test('v2 duplicates coalesce for an hour and heartbeats preserve note versions',()=>{
 const state=newBoardState();ingest(state,snapshot([future(),event()]));const before=structuredClone(state.calendar);
 const result=ingest(state,snapshot([event(),future()],NOW+30*60000),NOW+30*60000);assert.equal(result.changed,false);assert.equal(state.source.observedAt,new Date(NOW).toISOString());
 ingest(state,snapshot([future(),event()],NOW+HOUR),NOW+HOUR);assert.equal(state.source.observedAt,new Date(NOW+HOUR).toISOString());assert.deepEqual(state.calendar,before);
});

test('malformed stored coverage fails closed instead of claiming an unsynced range',()=>{
 const state=newBoardState();ingest(state,snapshot());
 for(const patch of [{rangeEnd:'2026-12-09'},{rangeStart:'2026-11-26'},{rangeEnd:undefined},{rangeStart:null,rangeEnd:null}])assert.throws(()=>checkedBoardState({...state,source:{...state.source,...patch}}),e=>e.code==='BOARD_STORAGE_INVALID');
 const empty=newBoardState();ingest(empty,failed());assert.equal(boardView(empty,undefined,NOW).calendar.rangeStart,null);assert.equal(boardView(empty,undefined,NOW).calendar.rangeEnd,null);checkedBoardState(empty);
});
