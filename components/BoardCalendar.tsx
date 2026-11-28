'use client';
import {useEffect,useId,useMemo,useRef,useState,type KeyboardEvent} from 'react';
import {ArrowUpRight,CalendarDays,Check,ChevronLeft,ChevronRight,LoaderCircle} from 'lucide-react';
import {boardCalendarCoverage,boardCalendarNotes,boardCalendarOverlaps,boardDateLabel,boardMonthDays,boardMonthLabel,boardNoteTime,boardShiftDay,boardShiftMonth,type BoardData,type BoardNote} from '../lib/board-view';
import styles from './BoardCalendar.module.css';

type Props={data:BoardData|null;loading:boolean;error?:string|null;activeId?:string;disabled?:boolean;onOpen:(note:BoardNote)=>void;onRefresh:()=>void;registerButton:(id:string,button:HTMLButtonElement|null)=>void};
const weekdays=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export default function BoardCalendar({data,loading,error,activeId,disabled,onOpen,onRefresh,registerButton}:Props){
 const [selected,setSelected]=useState<string|null>(null),[month,setMonth]=useState<string|null>(null),[focused,setFocused]=useState<string|null>(null);
 const dayRefs=useRef(new Map<string,HTMLButtonElement>()),focusAfterRender=useRef(false);
 const id=useId(),today=data?.day||'',coverage=data?boardCalendarCoverage(data):null;
 const currentMonth=month||today,days=useMemo(()=>boardMonthDays(currentMonth),[currentMonth]);
 const events=useMemo(()=>data?boardCalendarNotes(data,selected):[],[data,selected]);
 const calendarNotes=useMemo(()=>data?.notes.filter(note=>note.source==='calendar')||[],[data]);
 const covered=(day:string)=>!!coverage&&day>=coverage.start&&day<=coverage.end;
 const activeDay=focused&&days.includes(focused)&&covered(focused)?focused:selected&&days.includes(selected)&&covered(selected)?selected:days.includes(today)&&covered(today)?today:days.find(covered);
 const previousMonth=boardShiftMonth(currentMonth,-1),nextMonth=boardShiftMonth(currentMonth,1);
 const canPrevious=!!coverage&&previousMonth.slice(0,7)>=coverage.start.slice(0,7),canNext=!!coverage&&nextMonth<=coverage.end;
 const groups=useMemo(()=>{
  const result:{day:string;notes:BoardNote[]}[]=[];
  for(const note of events){const date=selected||(note.date<today?today:note.date);let group=result.find(item=>item.day===date);if(!group){group={day:date,notes:[]};result.push(group);}group.notes.push(note);}
  return result;
 },[events,selected,today]);
 useEffect(()=>{if(focusAfterRender.current){focusAfterRender.current=false;if(focused)dayRefs.current.get(focused)?.focus();}},[focused,currentMonth]);
 // Coverage can advance at Singapore midnight or after a fresh source snapshot.
 useEffect(()=>{if(selected&&coverage&&(selected<coverage.start||selected>coverage.end))setSelected(null);},[selected,coverage?.start,coverage?.end]);
 useEffect(()=>{if(month&&coverage&&(month.slice(0,7)<coverage.start.slice(0,7)||month.slice(0,7)>coverage.end.slice(0,7)))setMonth(null);},[month,coverage?.start,coverage?.end]);
 function chooseDay(day:string){setSelected(day);setFocused(day);setMonth(day.slice(0,7)+'-01');}
 function moveFocus(event:KeyboardEvent<HTMLButtonElement>,day:string){
  const index=days.indexOf(day);let target='';
  if(event.key==='ArrowLeft')target=boardShiftDay(day,-1);
  else if(event.key==='ArrowRight')target=boardShiftDay(day,1);
  else if(event.key==='ArrowUp')target=boardShiftDay(day,-7);
  else if(event.key==='ArrowDown')target=boardShiftDay(day,7);
  else if(event.key==='Home')target=boardShiftDay(day,-index%7);
  else if(event.key==='End')target=boardShiftDay(day,6-index%7);
  else return;
  event.preventDefault();if(!covered(target))return;
  focusAfterRender.current=true;setFocused(target);setMonth(target.slice(0,7)+'-01');
 }
 function showUpcoming(){setSelected(null);setMonth(null);setFocused(null);}
 const reliable=data?.calendar.status==='current'&&!error;
 const scopeLabel=coverage?coverage.start===coverage.end?boardDateLabel(coverage.start):`${boardDateLabel(coverage.start)}–${boardDateLabel(coverage.end)}`:null;

 if(!data)return <div className={styles.unavailable} aria-busy={loading}>{loading?<LoaderCircle size={25} className={styles.spin}/>:<CalendarDays size={28}/>}<p>{loading?'Loading the calendar…':'Calendar unavailable.'}</p>{!loading&&<button type="button" onClick={onRefresh}>Try again</button>}</div>;
 return <div className={styles.layout} aria-busy={loading}>
  <aside className={styles.monthCard} aria-label="Choose a meeting date">
   <div className={styles.monthHeader}><h3 id={`${id}-month`}>{boardMonthLabel(currentMonth)}</h3><div><button type="button" disabled={!canPrevious||disabled} aria-label="Previous month" onClick={()=>{setMonth(previousMonth);setFocused(null);}}><ChevronLeft size={16}/></button><button type="button" disabled={!canNext||disabled} aria-label="Next month" onClick={()=>{setMonth(nextMonth);setFocused(null);}}><ChevronRight size={16}/></button></div></div>
   <table className={styles.month} aria-labelledby={`${id}-month`}><thead><tr>{weekdays.map(day=><th key={day} scope="col"><abbr title={day==='Thu'?'Thursday':day==='Tue'?'Tuesday':day==='Wed'?'Wednesday':day==='Sat'?'Saturday':day==='Mon'?'Monday':day==='Fri'?'Friday':'Sunday'}>{day.slice(0,1)}</abbr></th>)}</tr></thead><tbody>{Array.from({length:6},(_,row)=><tr key={row}>{days.slice(row*7,row*7+7).map(day=>{
    const count=calendarNotes.filter(note=>boardCalendarOverlaps(note,day)).length;
    return <td key={day}><button type="button" ref={button=>{if(button)dayRefs.current.set(day,button);else dayRefs.current.delete(day);}} className={`${day.slice(0,7)!==currentMonth.slice(0,7)?styles.adjacent:''} ${day===today?styles.today:''}`} aria-label={`${boardDateLabel(day)}${day===today?', today':''}${covered(day)?`, ${count} ${count===1?'meeting':'meetings'}`:', outside synced dates'}`} aria-current={day===today?'date':undefined} aria-pressed={selected===day} tabIndex={day===activeDay?0:-1} disabled={!covered(day)||disabled} onKeyDown={event=>moveFocus(event,day)} onClick={()=>chooseDay(day)}><span>{Number(day.slice(-2))}</span><i aria-hidden="true" className={count?styles.hasMeetings:undefined}/></button></td>;
   })}</tr>)}</tbody></table>
   <button type="button" className={styles.upcomingButton} aria-pressed={selected===null} disabled={disabled} onClick={showUpcoming}>Today & upcoming</button>
   <p className={styles.scope}>{scopeLabel?<>Synced dates<br/><span>{scopeLabel}</span></>:'No calendar dates synced yet.'}<small>Singapore time</small></p>
  </aside>
  <section className={styles.agenda} aria-labelledby={`${id}-agenda`}>
   <div className={styles.agendaHeader}><div><h3 id={`${id}-agenda`}>{selected?boardDateLabel(selected):'Today & upcoming'}</h3><p>Google Calendar</p></div><span>{events.length} {events.length===1?'meeting':'meetings'}</span></div>
   {(!reliable||!coverage)&&<p className={styles.syncWarning} role="status">{data.calendar.status==='unconfigured'?'Calendar sync is not configured.':data.calendar.status==='error'||error?'The latest update could not be loaded. Showing the last synced meetings.':data.calendar.status==='stale'?'This calendar needs an update. Showing the last synced meetings.':data.calendar.status==='waiting'?'Waiting for the calendar to sync.':'Calendar coverage is unavailable.'}</p>}
   {!events.length?<div className={styles.empty}><CalendarDays size={28}/><h4>{reliable&&coverage?'No meetings scheduled':'No synced meetings to show'}</h4><p>{reliable&&coverage?(selected?'No meetings on this date.':'No meetings in the synced dates.'):scopeLabel?'Refresh to check for a newer calendar snapshot.':'Upcoming meetings will appear after the calendar syncs.'}</p>{(!reliable||!coverage)&&<button type="button" disabled={loading} onClick={onRefresh}>Refresh</button>}</div>:<div className={styles.groups}>{groups.map(group=><section key={group.day} aria-label={boardDateLabel(group.day)}>{!selected&&<h4 className={styles.dayHeading}><time dateTime={group.day}>{group.day===today?'Today':boardDateLabel(group.day)}</time></h4>}<ol>{group.notes.map(note=><li key={note.id}><button type="button" ref={button=>registerButton(note.id,button)} disabled={disabled} className={`${styles.meeting} ${activeId===note.id?styles.active:''}`} onClick={()=>onOpen(note)} aria-label={`Open meeting: ${note.title}${note.done?', done on board':''}`}><span className={styles.meetingTime}>{note.calendar?.allDay?'All day':boardNoteTime(note).replace(' SGT','')}<i aria-hidden="true"/></span><span className={styles.meetingText}><strong>{note.title}</strong>{note.date<group.day&&<small>From {boardDateLabel(note.date)}</small>}{note.done&&<small className={styles.done}><Check size={11}/>Done on board</small>}</span><ArrowUpRight size={15}/></button></li>)}</ol></section>)}</div>}
  </section>
 </div>;
}
