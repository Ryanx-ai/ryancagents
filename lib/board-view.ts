import type {BoardColor,BoardNote,BoardNoteDraft,BoardPatch,BoardResponse,BoardUpdate,BoardCalendarState} from './board.mjs';
export type {BoardColor,BoardNote,BoardPatch,BoardCalendarState};
export type BoardData=BoardResponse;
export type BoardCreateInput=BoardNoteDraft;
export type BoardUpdateInput=BoardUpdate;
export type BoardFilter='today'|'open'|'done';
export const NOTE_COLORS:readonly {id:BoardColor;label:string;paper:string}[]=[
 {id:'yellow',label:'Yellow',paper:'#f0d98f'},
 {id:'peach',label:'Peach',paper:'#eab9a0'},
 {id:'mint',label:'Mint',paper:'#bbd3b0'},
 {id:'blue',label:'Blue',paper:'#b7cfdc'},
 {id:'lavender',label:'Lavender',paper:'#cfc0dc'},
];
const dayFormat=new Intl.DateTimeFormat('en-SG',{timeZone:'Asia/Singapore',weekday:'short',day:'numeric',month:'short'});
const timeFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Singapore',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const dateTimeFormat=new Intl.DateTimeFormat('en-SG',{timeZone:'Asia/Singapore',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function boardDateLabel(day:string){const date=new Date(`${day}T00:00:00+08:00`);return Number.isFinite(date.getTime())?dayFormat.format(date):day;}
export function boardTimeLabel(value:string){const date=new Date(value);return Number.isFinite(date.getTime())?timeFormat.format(date):'';}
export function boardNoteTime(note:BoardNote){
 if(!note.calendar)return '';
 if(note.calendar.allDay)return 'All day';
 const start=boardTimeLabel(note.calendar.start),end=boardTimeLabel(note.calendar.end);
 return start&&end?`${start}–${end} SGT`:start?`${start} SGT`:'';
}
export function boardSyncLabel(calendar:BoardCalendarState){
 const at=calendar.observedAt?new Date(calendar.observedAt):null;
 const last=at&&Number.isFinite(at.getTime())?`${dateTimeFormat.format(at)} SGT`:null;
 if(calendar.status==='current')return last?`Calendar synced ${last}`:'Calendar sync time unavailable';
 if(calendar.status==='unconfigured')return 'Calendar not synced';
 if(calendar.status==='waiting')return last?`Waiting for today’s calendar · last sync ${last}`:'Waiting for today’s calendar';
 return last?`Calendar ${calendar.status==='error'?'update failed':'needs an update'} · last sync ${last}`:`Calendar ${calendar.status==='error'?'update failed':'needs an update'}`;
}
export function boardNotesForView(data:BoardData,filter:BoardFilter){
 return data.notes.filter(note=>filter==='today'?note.date===data.day:filter==='done'?note.done:!note.done).sort((a,b)=>{
  const day=a.date.localeCompare(b.date);if(day)return day;
  const aCalendar=a.source==='calendar',bCalendar=b.source==='calendar';
  if(aCalendar!==bCalendar)return aCalendar?-1:1;
  if(aCalendar&&bCalendar){
   const allDay=Number(!!b.calendar?.allDay)-Number(!!a.calendar?.allDay);if(allDay)return allDay;
   const startA=Date.parse(a.calendar?.start||''),startB=Date.parse(b.calendar?.start||'');
   if(Number.isFinite(startA)&&Number.isFinite(startB)&&startA!==startB)return startA-startB;
  }
  return a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id);
 });
}
export function boardTodayOpen(data:BoardData|null){return data?boardNotesForView(data,'today').filter(note=>!note.done):[];}
export function boardCalendarLink(note:BoardNote){
 try{const url=new URL(note.calendar?.url||'');return url.protocol==='https:'&&(url.hostname==='calendar.google.com'||['google.com','www.google.com'].includes(url.hostname)&&url.pathname.startsWith('/calendar/'))?url.href:null;}catch{return null;}
}
export function boardMeetingLinks(note:BoardNote):{label:string;url:string}[]{
 const links=note.calendar?.links;if(!Array.isArray(links))return [];
 const seen=new Set<string>(),result:{label:string;url:string}[]=[];
 for(const link of links.slice(0,8)){
  if(!link||typeof link.url!=='string'||link.url.length>2000||/[\u0000-\u001f\u007f]/.test(link.url))continue;
  try{
   const url=new URL(link.url);if(url.protocol!=='https:'||url.username||url.password||seen.has(url.href))continue;
   seen.add(url.href);
   const label=typeof link.label==='string'?link.label.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,100):'';
   result.push({label:label||url.hostname,url:url.href});
  }catch{}
 }
 return result;
}
export function boardDraftFromNote(note:BoardNote):BoardCreateInput{return {id:note.id,date:note.date,title:note.title,body:note.body,color:note.color};}
export function boardDraftChanged(draft:BoardCreateInput,initial:BoardCreateInput){return draft.title!==initial.title||draft.body!==initial.body||draft.date!==initial.date||draft.color!==initial.color;}
// Done/Reopen can advance the revision beneath an editor, but must not accept
// content from another device on behalf of the person still editing an old copy.
export function boardBaseAfterToggle(base:BoardNote|null,submitted:BoardNote,updated:BoardNote):BoardNote|null{
 return base?.id===submitted.id&&base.version===submitted.version&&updated.id===submitted.id&&updated.version>=submitted.version?updated:base;
}
