import {createHash,randomUUID} from 'node:crypto';
import {OfficeStorageError} from './office-store.mjs';
import {normalizeCalendarLinks} from './calendar-details.mjs';

export const BOARD_PATH='office/board-v1.json';
export const BOARD_COLORS=Object.freeze(['yellow','peach','mint','blue','lavender']);
const MAX_MANUAL=200,MAX_EVENTS=200,MAX_FLAGS=2000,HOUR=3600000,DAY=86400000;
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const manualId=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const calendarId=value=>typeof value==='string'&&/^cal_[0-9a-f]{40}$/.test(value);
const iso=value=>typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value));
const qualifiedTimestamp=value=>iso(value)&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)&&new Date(value.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)===value.slice(0,10);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stamp=now=>new Date(now).toISOString();
function fail(message,code='BOARD_INPUT',status=400,current){const error=new OfficeStorageError(code,message,status);if(current)error.current=current;throw error;}
function keys(value,allowed){return record(value)&&Object.keys(value).every(key=>allowed.includes(key));}
function text(value,max,required=false){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))fail(`Enter ${required?'1':'0'}–${max} characters.`);return value.trim();}
export function singaporeDay(now=Date.now()){return new Date(now+8*HOUR).toISOString().slice(0,10);}
export function validDay(value){return typeof value==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function color(value){if(!BOARD_COLORS.includes(value))fail('Choose an available note color.');return value;}
function publicNote(note){const {id,source,date,title,body,color,done,version,createdAt,updatedAt,calendar}=note;return structuredClone({id,source,date,title,body,color,done,version,createdAt,updatedAt,...(calendar?{calendar}:{})});}
function validNote(note){
 if(!keys(note,['id','source','date','title','body','color','done','version','createdAt','updatedAt','createHash','calendar'])||!['manual','calendar'].includes(note.source)||!(note.source==='manual'?manualId(note.id):calendarId(note.id))||!validDay(note.date)||typeof note.title!=='string'||!note.title.trim()||note.title.length>160||typeof note.body!=='string'||note.body.length>2000||!BOARD_COLORS.includes(note.color)||typeof note.done!=='boolean'||!Number.isSafeInteger(note.version)||note.version<1||!iso(note.createdAt)||!iso(note.updatedAt))return false;
 if(note.source==='manual')return typeof note.createHash==='string'&&/^[a-f0-9]{64}$/.test(note.createHash)&&!note.calendar;
 if(!keys(note.calendar,['eventId','calendarId','accountId','start','end','allDay','url','links'])||!scopeText(note.calendar.eventId)||!scopeText(note.calendar.calendarId)||!scopeText(note.calendar.accountId)||typeof note.calendar.start!=='string'||typeof note.calendar.end!=='string'||typeof note.calendar.allDay!=='boolean')return false;
 try{eventUrl(note.calendar.url);normalizeCalendarLinks(note.calendar.links);return true;}catch{return false;}
}
export function newBoardState(){return {version:1,revision:'initial',updatedAt:null,manual:[],calendar:[],calendarFlags:{},source:null};}
export function checkedBoardState(value){
 const invalid=()=>fail('The board storage needs attention. Existing notes were not replaced.','BOARD_STORAGE_INVALID',503);
 if(!keys(value,['version','revision','updatedAt','manual','calendar','calendarFlags','source'])||value.version!==1||typeof value.revision!=='string'||(value.updatedAt!==null&&!iso(value.updatedAt))||!Array.isArray(value.manual)||value.manual.length>MAX_MANUAL||!Array.isArray(value.calendar)||value.calendar.length>MAX_EVENTS||!record(value.calendarFlags)||Object.keys(value.calendarFlags).length>MAX_FLAGS)return invalid();
 if(value.manual.some(note=>!validNote(note)||note.source!=='manual')||value.calendar.some(note=>!validNote(note)||note.source!=='calendar'))return invalid();
 if(new Set([...value.manual,...value.calendar].map(note=>note.id)).size!==value.manual.length+value.calendar.length)return invalid();
 for(const [id,flag] of Object.entries(value.calendarFlags))if(!calendarId(id)||!record(flag)||typeof flag.done!=='boolean'||!BOARD_COLORS.includes(flag.color)||!Number.isSafeInteger(flag.version)||flag.version<1||!iso(flag.createdAt)||!iso(flag.updatedAt)||!iso(flag.lastSeenAt))return invalid();
 for(const note of value.calendar){const flag=value.calendarFlags[note.id];if(!flag||flag.version!==note.version||flag.done!==note.done||flag.color!==note.color)return invalid();}
 const s=value.source;if(s!==null&&(!record(s)||typeof s.accountId!=='string'||typeof s.calendarId!=='string'||(s.day!==null&&!validDay(s.day))||(s.observedAt!==null&&!iso(s.observedAt))||!iso(s.lastAttemptAt)||!['unavailable','authentication','partial',null].includes(s.reason)||typeof s.fingerprint!=='string'))return invalid();
 return value;
}
export function boardView(state,day=singaporeDay(),now=Date.now(),configured=true){
 if(!validDay(day))fail('Choose a valid Singapore calendar date.');
 const s=state.source;
 const status=!configured?'unconfigured':!s?'waiting':s.reason?'error':!s.observedAt||now-Date.parse(s.observedAt)>90*60000||s.day!==singaporeDay(now)?'stale':'current';
 return {version:1,day,timeZone:'Asia/Singapore',notes:[...state.manual,...state.calendar].map(publicNote).sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)),calendar:{status,observedAt:s?.observedAt??null,lastAttemptAt:s?.lastAttemptAt??null,day:s?.day??null,...(s?.reason?{reason:s.reason}:{})}};
}
export function validateBoardCreate(value){
 if(!keys(value,['id','date','title','body','color'])||!manualId(value.id)||!validDay(value.date))fail('Enter a valid note ID and date.');
 return {id:value.id,date:value.date,title:text(value.title,160,true),body:text(value.body,2000),color:color(value.color)};
}
export function validateBoardUpdate(value){
 if(!keys(value,['id','version','patch'])||(!manualId(value.id)&&!calendarId(value.id))||!Number.isSafeInteger(value.version)||value.version<1||!keys(value.patch,['date','title','body','color','done'])||!Object.keys(value.patch).length)fail('The note update is invalid.');
 const patch={};
 if(Object.hasOwn(value.patch,'date')){if(!validDay(value.patch.date))fail('Choose a valid note date.');patch.date=value.patch.date;}
 for(const [key,max] of [['title',160],['body',2000]])if(Object.hasOwn(value.patch,key))patch[key]=text(value.patch[key],max,key==='title');
 if(Object.hasOwn(value.patch,'color'))patch.color=color(value.patch.color);
 if(Object.hasOwn(value.patch,'done')){if(typeof value.patch.done!=='boolean')fail('Choose Done or Open.');patch.done=value.patch.done;}
 return {id:value.id,version:value.version,patch};
}
export function createBoardNote(state,value,now=Date.now()){
 const input=validateBoardCreate(value),fingerprint=hash(input),existing=state.manual.find(note=>note.id===input.id);
 if(existing){if(existing.createHash!==fingerprint)fail('This note ID was already used for different content.','NOTE_ID_CONFLICT',409,publicNote(existing));return {changed:false,value:{note:publicNote(existing),created:false}};}
 // Completed history expires only on a real write; open tasks are never evicted.
 state.manual=state.manual.filter(note=>!note.done||Date.parse(note.updatedAt)>=now-90*DAY);
 if(state.manual.length>=MAX_MANUAL)fail('The board holds 200 retained notes. Completed notes are retained for 90 days; open notes are never removed automatically.','BOARD_CAPACITY',409);
 const note={...input,source:'manual',done:false,version:1,createdAt:stamp(now),updatedAt:stamp(now),createHash:fingerprint};
 state.manual.push(note);return {value:{note:publicNote(note),created:true}};
}
export function updateBoardNote(state,value,now=Date.now()){
 const input=validateBoardUpdate(value),notes=manualId(input.id)?state.manual:state.calendar,note=notes.find(item=>item.id===input.id);
 if(!note)fail('This note is no longer on the board. Refresh the board.','NOTE_NOT_FOUND',404);
 if(note.version!==input.version)fail('This note changed on another screen. Review the latest version before saving.','NOTE_CONFLICT',409,publicNote(note));
 if(note.source==='calendar'&&Object.keys(input.patch).some(key=>!['done','color'].includes(key)))fail('Calendar content is read-only here. Only its board status and color can change.');
 if(Object.entries(input.patch).every(([key,value])=>note[key]===value))return {changed:false,value:publicNote(note)};
 Object.assign(note,input.patch,{version:note.version+1,updatedAt:stamp(now)});
 if(note.source==='calendar')Object.assign(state.calendarFlags[note.id],{done:note.done,color:note.color,version:note.version,updatedAt:note.updatedAt});
 return {value:publicNote(note)};
}
function scopeText(value){return typeof value==='string'&&value.length>0&&value.length<=320&&!/[\r\n]/.test(value);}
function eventUrl(value){
 if(value===undefined||value==='')return undefined;
 try{const url=new URL(value);if(typeof value==='string'&&value.length<=2000&&!/[\u0000-\u001f\u007f-\u009f\\]/.test(value)&&url.protocol==='https:'&&!url.username&&!url.password&&(url.hostname==='calendar.google.com'||url.hostname==='www.google.com'&&url.pathname.startsWith('/calendar/')))return url.href;}catch{}
 fail('Calendar links must point to Google Calendar.');
}
function calendarEvent(value,day,scope){
 if(!keys(value,['eventId','title','body','start','end','allDay','url','links','status'])||!scopeText(value.eventId))fail('A calendar event ID is missing or invalid.');
 if(value.status==='cancelled')return {eventId:value.eventId,cancelled:true};
 if(value.status!==undefined&&!['confirmed','tentative'].includes(value.status))fail('The calendar event status is invalid.');
 const allDay=value.allDay===true;if(value.allDay!==undefined&&typeof value.allDay!=='boolean')fail('The calendar event type is invalid.');
 let start,end;
 if(allDay){if(!validDay(value.start)||!validDay(value.end))fail('All-day calendar events need ISO dates.');start=value.start;end=value.end;}
 else{if(!qualifiedTimestamp(value.start)||!qualifiedTimestamp(value.end))fail('Calendar event times need a complete date, time and explicit timezone.');start=stamp(Date.parse(value.start));end=stamp(Date.parse(value.end));}
 const dayStart=Date.parse(day+'T00:00:00+08:00'),dayEnd=dayStart+DAY;
 const from=Date.parse(allDay?start+'T00:00:00+08:00':start),to=Date.parse(allDay?end+'T00:00:00+08:00':end);
 if(to<=from||from>=dayEnd||to<=dayStart)fail('Every event must overlap the complete Singapore day snapshot.');
 const url=eventUrl(value.url);
 let links;try{links=normalizeCalendarLinks(value.links);}catch(error){fail(error.message);}
 return {eventId:value.eventId,title:text(value.title,160,true),body:text(value.body??'',2000),start,end,allDay,...(url?{url}:{}),...(links.length?{links}:{})};
}
export function validateCalendarSnapshot(value,scope,now=Date.now()){
 if(!scopeText(scope?.accountId)||!scopeText(scope?.calendarId))fail('Calendar source is not configured.','CALENDAR_UNCONFIGURED',503);
 if(!keys(value,['version','status','day','timeZone','accountId','calendarId','observedAt','complete','events','reason'])||value.version!==1||value.accountId!==scope.accountId||value.calendarId!==scope.calendarId||value.timeZone!=='Asia/Singapore'||!validDay(value.day)||!qualifiedTimestamp(value.observedAt))fail('Calendar snapshot scope is invalid.');
 const observed=Date.parse(value.observedAt);if(observed>now+60000||observed<now-2*HOUR||value.day!==singaporeDay(observed)||value.day!==singaporeDay(now))fail('Calendar snapshot is not a recent check of today in Singapore.');
 const common={version:1,day:value.day,timeZone:'Asia/Singapore',accountId:scope.accountId,calendarId:scope.calendarId,observedAt:stamp(observed)};
 if(value.status==='error'){
  if(!['unavailable','authentication','partial'].includes(value.reason)||value.events!==undefined||value.complete!==undefined)fail('Calendar error snapshots must not replace event data.');
  return {...common,status:'error',reason:value.reason};
 }
 if((value.status!==undefined&&value.status!=='ok')||value.complete!==true||!Array.isArray(value.events)||value.events.length>MAX_EVENTS||value.reason!==undefined)fail('A successful calendar snapshot must be complete and contain at most 200 events.');
 const events=value.events.map(event=>calendarEvent(event,value.day,scope));if(new Set(events.map(event=>event.eventId)).size!==events.length)fail('Calendar event IDs must be unique.');
 return {...common,status:'ok',complete:true,events:events.filter(event=>!event.cancelled).sort((a,b)=>a.eventId.localeCompare(b.eventId))};
}
export function ingestBoardCalendar(state,input,now=Date.now()){
 const previous=state.source,observed=Date.parse(input.observedAt),lastAttempt=Date.parse(previous?.lastAttemptAt)||0;
 if(observed<lastAttempt)fail('A newer calendar check is already on the board.','CALENDAR_STALE',409);
 const sameScope=previous?.accountId===input.accountId&&previous?.calendarId===input.calendarId;
 if(input.status==='error'){
  if(sameScope&&previous.reason===input.reason&&observed-lastAttempt<HOUR)return {changed:false,value:{ok:true,changed:false}};
  if(previous&&observed===lastAttempt)fail('Two different calendar snapshots used the same observation time.','CALENDAR_CONFLICT',409);
  state.source={accountId:input.accountId,calendarId:input.calendarId,day:sameScope?previous.day:null,observedAt:sameScope?previous.observedAt:null,lastAttemptAt:input.observedAt,reason:input.reason,fingerprint:sameScope?previous.fingerprint:''};
  if(!sameScope)state.calendar=[];
  return {value:{ok:true,changed:true}};
 }
 const fingerprint=hash([input.accountId,input.calendarId,input.day,input.events]);
 if(sameScope&&!previous.reason&&previous.fingerprint===fingerprint&&observed-lastAttempt<HOUR)return {changed:false,value:{ok:true,changed:false}};
 if(observed===lastAttempt&&previous&&(previous.reason||previous.fingerprint!==fingerprint))fail('Two different calendar snapshots used the same observation time.','CALENDAR_CONFLICT',409);
 const active=new Map(state.calendar.map(note=>[note.id,note])),next=[];
 for(const event of input.events){
  const id='cal_'+hash([input.accountId,input.calendarId,event.eventId]).slice(0,40),calendar={eventId:event.eventId,accountId:input.accountId,calendarId:input.calendarId,start:event.start,end:event.end,allDay:event.allDay,...(event.url?{url:event.url}:{}),...(event.links?.length?{links:event.links}:{})};
  const old=active.get(id),flag=state.calendarFlags[id];
  const changed=!old||old.date!==input.day||old.title!==event.title||old.body!==event.body||JSON.stringify(old.calendar)!==JSON.stringify(calendar);
  const note={id,source:'calendar',date:input.day,title:event.title,body:event.body,calendar,done:flag?.done??false,color:flag?.color??'blue',version:flag?(changed?flag.version+1:flag.version):1,createdAt:flag?.createdAt??stamp(now),updatedAt:changed?stamp(now):flag.updatedAt};
  state.calendarFlags[id]={done:note.done,color:note.color,version:note.version,createdAt:note.createdAt,updatedAt:note.updatedAt,lastSeenAt:input.observedAt};next.push(note);
 }
 const activeIds=new Set(next.map(note=>note.id));
 for(const [id,flag] of Object.entries(state.calendarFlags))if(!activeIds.has(id)&&Date.parse(flag.lastSeenAt)<now-180*DAY)delete state.calendarFlags[id];
 if(Object.keys(state.calendarFlags).length>MAX_FLAGS)fail('Calendar acknowledgement history needs maintenance. Existing data was kept.','BOARD_CAPACITY',409);
 // A complete snapshot is authoritative for this source/day. Missing, moved and
 // cancelled rows leave the board; their bounded acknowledgement tombstones stay.
 state.calendar=next;state.source={accountId:input.accountId,calendarId:input.calendarId,day:input.day,observedAt:input.observedAt,lastAttemptAt:input.observedAt,reason:null,fingerprint};
 return {value:{ok:true,changed:true}};
}
export async function atomicBoardUpdate(adapter,mutate,{attempts=8,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 for(let attempt=0;attempt<attempts;attempt++){
  const current=await adapter.read(),state=structuredClone(current?checkedBoardState(current.value):newBoardState());
  const result=mutate(state);if(result?.changed===false)return result.value;
  state.revision=randomUUID();state.updatedAt=stamp(Date.now());checkedBoardState(state);
  if(Buffer.byteLength(JSON.stringify(state))>2*1024*1024)fail('The board has reached its storage limit.','BOARD_CAPACITY',409);
  try{await adapter.write(state,current?.etag??null);return result?.value;}
  catch(error){
   // Create-if-absent may lose to another first writer or commit before a lost
   // response. Re-read that known path and merge; never overwrite initialization.
   const retry=current?adapter.isConflict(error):Boolean(await adapter.read());
   if(!retry)throw error;if(attempt===attempts-1)fail('The board is busy. Refresh and retry.','BOARD_BUSY',503);
   await sleep(Math.min(250,15*2**attempt)+Math.floor(Math.random()*20));
  }
 }
}
