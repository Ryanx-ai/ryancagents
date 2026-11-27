import test from 'node:test';
import assert from 'node:assert/strict';
import {boardNotesForView,boardTodayOpen,boardMeetingLinks,boardCalendarLink,boardBaseAfterToggle,boardDraftFromNote,boardDraftChanged} from '../lib/board-view.ts';

const day='2026-11-27';
function note(id,{start,allDay=false,done=false,date=day,...rest}={}){
 return {id,source:start?'calendar':'manual',date,title:id,body:'',color:'yellow',done,version:1,createdAt:'2026-11-26T00:00:00Z',updatedAt:'2026-11-26T00:00:00Z',...(start?{calendar:{eventId:id,calendarId:'fixture',accountId:'fixture',start,end:start,allDay}}:{}),...rest};
}
function data(notes){return {version:1,day,timeZone:'Asia/Singapore',notes,calendar:{status:'current',observedAt:null,lastAttemptAt:null,day}};}

test('board follows date and meeting time, all-day first and manual notes after meetings',()=>{
 const notes=[note('manual'),note('late',{start:'2026-11-27T15:00:00+08:00'}),note('morning',{start:'2026-11-27T01:00:00Z',done:true}),note('all-day',{start:day,allDay:true}),note('tomorrow',{start:'2026-11-28T08:00:00+08:00',date:'2026-11-28'})];
 const original=notes.map(item=>item.id),board=data(notes);
 assert.deepEqual(boardNotesForView(board,'today').map(item=>item.id),['all-day','morning','late','manual']);
 assert.deepEqual(boardNotesForView(board,'open').map(item=>item.id),['all-day','late','manual','tomorrow']);
 assert.deepEqual(boardNotesForView(board,'done').map(item=>item.id),['morning']);
 assert.deepEqual(boardTodayOpen(board).map(item=>item.id),['all-day','late','manual']);
 assert.deepEqual(notes.map(item=>item.id),original,'sorting does not mutate the snapshot');
});

test('marking a meeting done does not move it out of chronological order',()=>{
 const board=data([note('late',{start:'2026-11-27T10:00:00+08:00'}),note('early',{start:'2026-11-27T09:00:00+08:00'})]);
 const before=boardNotesForView(board,'today').map(item=>item.id);
 board.notes[1].done=true;
 assert.deepEqual(boardNotesForView(board,'today').map(item=>item.id),before);
});

test('meeting links preserve safe HTTPS URLs and reject executable, insecure, and credential-bearing URLs',()=>{
 const event=note('meeting',{start:'2026-11-27T09:00:00+08:00'});
 event.calendar.url='https://calendar.google.com/calendar/event?eid=fixture';
 event.calendar.links=[
  {label:'Meeting notes',url:'https://docs.google.com/document/d/fixture/edit?authuser=1#heading=notes'},
  {label:'Duplicate',url:'https://docs.google.com/document/d/fixture/edit?authuser=1#heading=notes'},
  {label:'Unsafe',url:'javascript:alert(1)'},
  {label:'Insecure',url:'http://example.com/meeting'},
  {label:'Credentials',url:'https://name:secret@example.com/meeting'},
  {label:'Control',url:'https://example.com/meet\ning'},
  {label:'',url:'https://meet.google.com/fixture'},
 ];
 assert.deepEqual(boardMeetingLinks(event),[
  {label:'Meeting notes',url:'https://docs.google.com/document/d/fixture/edit?authuser=1#heading=notes'},
  {label:'meet.google.com',url:'https://meet.google.com/fixture'},
 ]);
 assert.equal(boardCalendarLink(event),event.calendar.url,'calendar source stays separate');
 assert.deepEqual(boardMeetingLinks(note('manual')),[]);
});

test('meeting links remain bounded even with malformed snapshot data',()=>{
 const event=note('meeting',{start:day,allDay:true});
 event.calendar.links=Array.from({length:12},(_,index)=>({label:'x'.repeat(120),url:`https://example.com/${index}`}));
 assert.equal(boardMeetingLinks(event).length,8);
 assert.ok(boardMeetingLinks(event).every(link=>link.label.length===100));
 event.calendar.links=[null,{label:'Too long',url:`https://example.com/${'a'.repeat(2000)}`}];
 assert.deepEqual(boardMeetingLinks(event),[]);
});

test('Done and Reopen preserve an editing conflict when another device changed the note',()=>{
 const base=note('shared',{title:'Original task',body:'Original details'});
 const initial=boardDraftFromNote(base),draft={...initial,title:'My unsaved title'};
 const remote={...base,version:2,body:'Changed on another device'};
 const done={...remote,version:3,done:true};
 const afterDone=boardBaseAfterToggle(base,remote,done);
 assert.equal(afterDone,base,'a fresh board-list Done does not silently accept the remote content');
 assert.notEqual(afterDone.version,done.version,'the editor must still display its version conflict');
 const reopened={...done,version:4,done:false};
 assert.equal(boardBaseAfterToggle(afterDone,done,reopened),base,'Reopen must retain the same conflict');
 assert.equal(boardDraftChanged(draft,initial),true);
 assert.equal(draft.title,'My unsaved title');
 assert.equal(draft.body,'Original details','the local draft is preserved until explicit conflict resolution');
});

test('Done advances the editor base only when it used that exact note version',()=>{
 const base=note('shared');const done={...base,done:true,version:2};
 assert.equal(boardBaseAfterToggle(base,base,done),done,'a local Done needs no false conflict');
 assert.equal(boardBaseAfterToggle(base,note('other'),{...done,id:'other'}),base);
 assert.equal(boardBaseAfterToggle(null,base,done),null);
});
