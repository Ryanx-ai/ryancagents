import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {atomicBoardUpdate,newBoardState,checkedBoardState,boardView,validateBoardCreate,validateBoardUpdate,createBoardNote,updateBoardNote,validateCalendarSnapshot,ingestBoardCalendar,singaporeDay,validDay} from '../lib/board.mjs';

const NOW=Date.parse('2026-11-27T03:00:00Z'),DAY=86400000,HOUR=3600000;
const scope={accountId:'work@example.com',calendarId:'work-calendar'};
const create=(extra={})=>({id:randomUUID(),date:'2026-11-27',title:'Fixture task',body:'Review fixture',color:'yellow',...extra});
const event=(extra={})=>({eventId:'fixture-event',title:'Fixture meeting',body:'',start:'2026-11-27T11:30:00+08:00',end:'2026-11-27T12:00:00+08:00',allDay:false,...extra});
const snapshot=(events=[event()],extra={})=>({version:1,status:'ok',day:'2026-11-27',timeZone:'Asia/Singapore',...scope,observedAt:new Date(NOW).toISOString(),complete:true,events,...extra});
const calendar=(state,input,now=NOW)=>ingestBoardCalendar(state,validateCalendarSnapshot(input,scope,now),now);
function fixture(initial=null){
 let value=initial?structuredClone(initial):null,revision=0,writes=0,lose=false;
 return {adapter:{async read(){return value?{value:structuredClone(value),etag:String(revision)}:null;},async write(next,etag){if(etag!==(value?String(revision):null))throw Object.assign(Error('conflict'),{conflict:true});value=structuredClone(next);revision++;writes++;if(lose){lose=false;throw Error('Lost response');}},isConflict:error=>error.conflict===true},get state(){return value;},get writes(){return writes;},loseNextResponse(){lose=true;}};
}
const update=(f,mutate)=>atomicBoardUpdate(f.adapter,mutate,{sleep:async()=>{}});

test('Singapore dates cross midnight correctly and reject impossible dates',()=>{
 assert.equal(singaporeDay(Date.parse('2026-11-26T16:00:00Z')),'2026-11-27');
 assert.equal(singaporeDay(Date.parse('2026-11-26T15:59:59Z')),'2026-11-26');
 for(const day of ['2026-02-30','2026-13-01','2026-1-1','not-a-date'])assert.equal(validDay(day),false);
});
test('manual notes retain future dates and project only public fields',()=>{
 const state=newBoardState(),input=create({date:'2026-12-20',title:'  Future task  '});
 const note=createBoardNote(state,input,NOW).value.note;
 assert.equal(note.title,'Future task');assert.equal(note.done,false);assert.equal(note.version,1);
 const view=boardView(state,'2026-11-27',NOW);assert.equal(view.notes[0].date,'2026-12-20');assert.equal(view.notes[0].source,'manual');assert.equal(view.calendar.status,'waiting');
 assert.doesNotMatch(JSON.stringify(view),/createHash|calendarFlags|fingerprint/);
 for(const value of [{...input,token:'secret'},{...input,id:'bad'},{...input,title:'x'.repeat(161)},{...input,body:'x'.repeat(2001)},{...input,color:'red'},{...input,date:'2026-02-30'}])assert.throws(()=>validateBoardCreate(value));
 for(const value of [{id:input.id,version:0,patch:{done:true}},{id:input.id,version:1,patch:{run:true}},{id:input.id,version:1,patch:{}},{id:input.id,version:1,patch:{done:'yes'}}])assert.throws(()=>validateBoardUpdate(value));
});
test('concurrent initialization and independent note edits merge without overwriting',async()=>{
 const f=fixture(),a=create(),b=create();
 await Promise.all([update(f,s=>createBoardNote(s,a,NOW)),update(f,s=>createBoardNote(s,b,NOW))]);
 assert.equal(f.state.manual.length,2);assert.equal(f.writes,2);
 await Promise.all([update(f,s=>updateBoardNote(s,{id:a.id,version:1,patch:{done:true}},NOW)),update(f,s=>updateBoardNote(s,{id:b.id,version:1,patch:{title:'Changed'}},NOW))]);
 assert.equal(f.state.manual.find(n=>n.id===a.id).done,true);assert.equal(f.state.manual.find(n=>n.id===b.id).title,'Changed');
});
test('create is idempotent even after a lost first-write response and a later edit',async()=>{
 const f=fixture(),input=create();f.loseNextResponse();
 const first=await update(f,s=>createBoardNote(s,input,NOW));assert.equal(first.created,false);assert.equal(f.writes,1);
 await update(f,s=>updateBoardNote(s,{id:input.id,version:1,patch:{title:'Edited'}},NOW+1));
 const retry=await update(f,s=>createBoardNote(s,input,NOW+2));assert.equal(retry.created,false);assert.equal(retry.note.title,'Edited');assert.equal(f.writes,2);
 await assert.rejects(update(f,s=>createBoardNote(s,{...input,title:'Different'},NOW)),e=>e.code==='NOTE_ID_CONFLICT');
});
test('same-note concurrent edits conflict with the latest safe note and no-op patches do not write',async()=>{
 const f=fixture(),input=create();await update(f,s=>createBoardNote(s,input,NOW));
 const outcomes=await Promise.allSettled([update(f,s=>updateBoardNote(s,{id:input.id,version:1,patch:{done:true}},NOW)),update(f,s=>updateBoardNote(s,{id:input.id,version:1,patch:{title:'Other screen'}},NOW))]);
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
 const error=outcomes.find(r=>r.status==='rejected').reason;assert.equal(error.code,'NOTE_CONFLICT');assert.equal(error.status,409);assert.equal(error.current.version,2);assert.ok(!Object.hasOwn(error.current,'createHash'));
 const current=f.state.manual[0],writes=f.writes;await update(f,s=>updateBoardNote(s,{id:current.id,version:current.version,patch:{done:current.done}},NOW));assert.equal(f.writes,writes);
 await update(f,s=>updateBoardNote(s,{id:current.id,version:current.version,patch:{done:!current.done}},NOW));assert.equal(f.state.manual[0].done,!current.done);
});
test('missing updates and corrupt state never initialize or overwrite a board',async()=>{
 const f=fixture();await assert.rejects(update(f,s=>updateBoardNote(s,{id:randomUUID(),version:1,patch:{done:true}},NOW)),e=>e.code==='NOTE_NOT_FOUND');assert.equal(f.writes,0);
 for(const invalid of [{version:99},{...newBoardState(),unknown:'preserve'},{...newBoardState(),manual:[null]}]){
  const broken=fixture(invalid);await assert.rejects(update(broken,s=>createBoardNote(s,create(),NOW)),e=>e.code==='BOARD_STORAGE_INVALID');assert.equal(broken.writes,0);assert.deepEqual(broken.state,invalid);
 }
});
test('manual retention expires only old completed notes and never drops open tasks',()=>{
 const state=newBoardState();const open=createBoardNote(state,create(),NOW-100*DAY).value.note,done=createBoardNote(state,create(),NOW-100*DAY).value.note;
 updateBoardNote(state,{id:done.id,version:1,patch:{done:true}},NOW-99*DAY);createBoardNote(state,create(),NOW);
 assert.ok(state.manual.some(n=>n.id===open.id));assert.ok(!state.manual.some(n=>n.id===done.id));
 while(state.manual.length<200)createBoardNote(state,create(),NOW);
 assert.throws(()=>createBoardNote(state,create(),NOW),e=>e.code==='BOARD_CAPACITY');assert.equal(state.manual.length,200);
});
test('calendar input requires exact account, calendar, day, timezone and complete bounded coverage',()=>{
 const good=snapshot();assert.deepEqual(validateCalendarSnapshot(validateCalendarSnapshot(good,scope,NOW),scope,NOW),validateCalendarSnapshot(good,scope,NOW));
 for(const invalid of [{...good,accountId:'personal@example.com'},{...good,calendarId:'other'},{...good,day:'2026-11-26'},{...good,timeZone:'UTC'},{...good,complete:false},{...good,observedAt:'2026-11-27T11:00:00'},{...good,observedAt:new Date(NOW+61000).toISOString()},{...good,events:Array(201).fill(event())},{...good,events:[event(),event()]},{...good,events:[event({start:'2026-11-28T10:00:00+08:00',end:'2026-11-28T11:00:00+08:00'})]},{...good,events:[event({url:'https://example.com/private'})]}])assert.throws(()=>validateCalendarSnapshot(invalid,scope,NOW));
 assert.equal(validateCalendarSnapshot(snapshot([event({allDay:true,start:'2026-11-26',end:'2026-11-28'})]),scope,NOW).events[0].allDay,true);
 assert.throws(()=>validateCalendarSnapshot(snapshot([event({allDay:true,start:'2026-11-26',end:'2026-11-27'})]),scope,NOW));
});
test('observation and timed-event timestamps require complete RFC3339 with an explicit timezone',()=>{
 for(const observedAt of ['2026-11-27','2026-11-27T03:00:00','2026-11-27T03:00Z','2026-11-27 03:00:00Z','2026-11-27T11:00:00+0800','2026-11-27T24:00:00Z'])assert.throws(()=>validateCalendarSnapshot(snapshot([],{observedAt}),scope,NOW),observedAt);
 for(const observedAt of ['2026-11-27T03:00:00Z','2026-11-27T03:00:00.000Z','2026-11-27T11:00:00+08:00'])assert.equal(validateCalendarSnapshot(snapshot([],{observedAt}),scope,NOW).observedAt,new Date(NOW).toISOString());
 const normalizedInvalidDate=Date.parse('2026-03-02T03:00:00Z');
 assert.throws(()=>validateCalendarSnapshot(snapshot([],{day:'2026-03-02',observedAt:'2026-02-30T03:00:00Z'}),scope,normalizedInvalidDate));
 assert.throws(()=>validateCalendarSnapshot(snapshot([event({start:'2026-11-27T11:30+08:00'})]),scope,NOW));
});
test('stable calendar IDs preserve board-only acknowledgements through rename, cancellation and return',()=>{
 const state=newBoardState(),raw=snapshot(),copy=JSON.stringify(raw);calendar(state,raw);
 const note=state.calendar[0],id=note.id;updateBoardNote(state,{id,version:1,patch:{done:true,color:'mint'}},NOW+1);
 assert.equal(JSON.stringify(raw),copy);assert.throws(()=>updateBoardNote(state,{id,version:2,patch:{title:'Change Google'}},NOW),/read-only/);
 calendar(state,snapshot([event({title:'Renamed meeting'})],{observedAt:new Date(NOW+60000).toISOString()}),NOW+60000);
 assert.equal(state.calendar[0].id,id);assert.equal(state.calendar[0].done,true);assert.equal(state.calendar[0].color,'mint');assert.equal(state.calendar[0].version,3);
 calendar(state,snapshot([{eventId:'fixture-event',status:'cancelled'}],{observedAt:new Date(NOW+120000).toISOString()}),NOW+120000);assert.equal(state.calendar.length,0);assert.equal(state.calendarFlags[id].done,true);
 calendar(state,snapshot([event()],{observedAt:new Date(NOW+180000).toISOString()}),NOW+180000);assert.equal(state.calendar[0].id,id);assert.equal(state.calendar[0].done,true);assert.equal(state.calendar[0].version,4);
 checkedBoardState(state);
});
test('complete snapshots remove missing or moved events while partial/error checks preserve existing content',()=>{
 const state=newBoardState();calendar(state,snapshot([event(),event({eventId:'second'})]));
 calendar(state,snapshot([event()],{observedAt:new Date(NOW+60000).toISOString()}),NOW+60000);assert.equal(state.calendar.length,1);
 const before=structuredClone(state.calendar),lastGood=state.source.observedAt;
 const failed={version:1,status:'error',...scope,day:'2026-11-27',timeZone:'Asia/Singapore',observedAt:new Date(NOW+120000).toISOString(),reason:'partial'};
 calendar(state,failed,NOW+120000);assert.deepEqual(state.calendar,before);assert.equal(state.source.observedAt,lastGood);assert.equal(boardView(state,undefined,NOW+120000).calendar.status,'error');
 assert.throws(()=>validateCalendarSnapshot({...failed,complete:true,events:[]},scope,NOW+120000));
 calendar(state,snapshot([event()],{observedAt:new Date(NOW+180000).toISOString()}),NOW+180000);assert.equal(state.source.reason,null);assert.equal(state.calendar[0].version,before[0].version);
});
test('duplicate publications skip writes, freshness heartbeats are hourly and stale snapshots cannot roll state back',async()=>{
 const f=fixture(),raw=snapshot();await update(f,s=>calendar(s,raw));
 await update(f,s=>calendar(s,raw));await update(f,s=>calendar(s,snapshot(undefined,{observedAt:new Date(NOW+30*60000).toISOString()}),NOW+30*60000));assert.equal(f.writes,1);
 await update(f,s=>calendar(s,snapshot(undefined,{observedAt:new Date(NOW+HOUR).toISOString()}),NOW+HOUR));assert.equal(f.writes,2);assert.equal(f.state.calendar[0].version,1);
 await assert.rejects(update(f,s=>calendar(s,snapshot([],{observedAt:new Date(NOW+30*60000).toISOString()}),NOW+HOUR)),e=>e.code==='CALENDAR_STALE');
 await assert.rejects(update(f,s=>calendar(s,snapshot([],{observedAt:new Date(NOW+HOUR).toISOString()}),NOW+HOUR)),e=>e.code==='CALENDAR_CONFLICT');
 assert.equal(boardView(f.state,'2026-11-27',NOW+HOUR+91*60000).calendar.status,'stale');
});
test('calendar ingest and user acknowledgements merge through concurrent CAS writes',async()=>{
 const f=fixture();await update(f,s=>calendar(s,snapshot()));const note=f.state.calendar[0];
 const results=await Promise.allSettled([update(f,s=>updateBoardNote(s,{id:note.id,version:1,patch:{done:true}},NOW+1)),update(f,s=>calendar(s,snapshot([event({title:'Updated source'})],{observedAt:new Date(NOW+60000).toISOString()}),NOW+60000))]);
 assert.ok(results.some(r=>r.status==='fulfilled'));
 const acknowledgement=results[0];if(acknowledgement.status==='rejected')assert.equal(acknowledgement.reason.code,'NOTE_CONFLICT');else assert.equal(f.state.calendar[0].done,true);
 assert.equal(f.state.calendar[0].title,'Updated source');checkedBoardState(f.state);
});
test('optional calendar links preserve legacy boards and acknowledgements through updates',async()=>{
 const f=fixture();await update(f,s=>calendar(s,snapshot()));const legacy=structuredClone(f.state),id=f.state.calendar[0].id;
 assert.ok(!Object.hasOwn(checkedBoardState(legacy).calendar[0].calendar,'links'));
 await update(f,s=>updateBoardNote(s,{id,version:1,patch:{done:true}},NOW+1));
 const links=[{label:' Agenda ',url:'https://DOCS.example.com:443/plan'},{label:'Duplicate',url:'https://docs.example.com/plan'}];
 const enriched=snapshot([event({body:'Source meeting notes',url:'https://calendar.google.com/calendar/event?eid=fixture',links})],{observedAt:new Date(NOW+60000).toISOString()});
 await update(f,s=>calendar(s,enriched,NOW+60000));
 const note=boardView(f.state,undefined,NOW+60000).notes[0];
 assert.equal(note.id,id);assert.equal(note.done,true);assert.equal(note.version,3);assert.equal(note.body,'Source meeting notes');assert.equal(note.calendar.url,'https://calendar.google.com/calendar/event?eid=fixture');
 assert.deepEqual(note.calendar.links,[{label:'Agenda',url:'https://docs.example.com/plan'}]);
 const writes=f.writes;await update(f,s=>calendar(s,enriched,NOW+60000));assert.equal(f.writes,writes);
 await assert.rejects(update(f,s=>updateBoardNote(s,{id,version:3,patch:{links:[]}},NOW+60000)),e=>e.code==='BOARD_INPUT');
 const changed=snapshot([event({links:[{label:'Updated agenda',url:'https://docs.example.com/new'}]})],{observedAt:new Date(NOW+120000).toISOString()});
 await update(f,s=>calendar(s,changed,NOW+120000));assert.equal(f.state.calendar[0].done,true);assert.equal(f.state.calendar[0].version,4);assert.equal(f.state.calendar[0].calendar.links[0].url,'https://docs.example.com/new');
});
test('unsafe wire or persisted calendar links fail closed without replacing existing notes',async()=>{
 for(const links of [null,[{label:'Bad',url:'javascript:alert(1)'}],[{label:'Bad',url:'https://user:password@example.com'}],Array(9).fill({label:'Too many',url:'https://example.com'}),[{label:'Unknown field',url:'https://example.com',secret:'no'}]])assert.throws(()=>validateCalendarSnapshot(snapshot([event({links})]),scope,NOW));
 const state=newBoardState();calendar(state,snapshot());state.calendar[0].calendar.links=[{label:'Invalid persisted data',url:'http://example.com'}];
 const f=fixture(state);await assert.rejects(update(f,s=>createBoardNote(s,create(),NOW)),e=>e.code==='BOARD_STORAGE_INVALID');assert.equal(f.writes,0);assert.deepEqual(f.state,state);
 const noLinks=validateCalendarSnapshot(snapshot([event()]),scope,NOW),emptyLinks=validateCalendarSnapshot(snapshot([event({links:[]})]),scope,NOW);assert.deepEqual(noLinks,emptyLinks);
});
