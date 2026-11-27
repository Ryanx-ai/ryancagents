'use client';
import {useEffect,useId,useMemo,useRef,useState,type CSSProperties,type FormEvent,type MouseEvent} from 'react';
import {ArrowLeft,ArrowUpRight,CalendarDays,Check,CheckCheck,Clock3,LoaderCircle,PencilLine,Plus,RefreshCw,StickyNote,Undo2,X} from 'lucide-react';
import {NOTE_COLORS,boardCalendarLink,boardDateLabel,boardDraftChanged,boardDraftFromNote,boardNotesForView,boardNoteTime,boardSyncLabel,type BoardColor,type BoardCreateInput,type BoardData,type BoardFilter,type BoardNote,type BoardUpdateInput} from '../lib/board-view';
import styles from './Blackboard.module.css';

export type BlackboardProps={
 data:BoardData|null;loading:boolean;error?:string|null;busyIds?:ReadonlySet<string>;
 onRefresh:()=>void|Promise<void>;onCreate:(input:BoardCreateInput)=>Promise<BoardNote>;
 onUpdate:(input:BoardUpdateInput)=>Promise<BoardNote>;onClose:()=>void;
};
type Editor={id:string;base:BoardNote|null;draft:BoardCreateInput;initial:BoardCreateInput};
type Conflict={id:string;current:BoardNote|null};
const filters:readonly {id:BoardFilter;label:string}[]=[{id:'today',label:'Today'},{id:'open',label:'Open'},{id:'done',label:'Done'}];
function paper(color:BoardColor){return {'--paper':NOTE_COLORS.find(item=>item.id===color)?.paper||NOTE_COLORS[0].paper} as CSSProperties;}
function errorMessage(error:unknown){return error instanceof Error?error.message:'The note could not be saved. Try again.';}
function conflictNote(error:unknown,id:string):Conflict|null{
 if(!error||typeof error!=='object')return null;
 const value=error as {status?:number;code?:string;current?:BoardNote};
 const current=value.current?.id===id&&Number.isInteger(value.current.version)?value.current:null;
 if(!['NOTE_CONFLICT','NOTE_ID_CONFLICT'].includes(value.code||'')&&!(value.status===409&&current))return null;
 return {id,current};
}
function newDraft(day:string):BoardCreateInput{return {id:crypto.randomUUID(),date:day,title:'',body:'',color:'yellow'};}

export default function Blackboard({data,loading,error,busyIds,onRefresh,onCreate,onUpdate,onClose}:BlackboardProps){
 const [filter,setFilter]=useState<BoardFilter>('today'),[editor,setEditor]=useState<Editor|null>(null);
 const [pending,setPending]=useState<ReadonlySet<string>>(()=>new Set()),[mutationError,setMutationError]=useState(''),[notice,setNotice]=useState('');
 const [conflict,setConflict]=useState<Conflict|null>(null),[discard,setDiscard]=useState(false);
 const pendingRef=useRef(new Set<string>()),mounted=useRef(false),dismissed=useRef(false),backdropPress=useRef(false),nextAction=useRef<(()=>void)|null>(null);
 const dialogRef=useRef<HTMLDialogElement>(null),titleRef=useRef<HTMLInputElement>(null),detailRef=useRef<HTMLHeadingElement>(null),newRef=useRef<HTMLButtonElement>(null),keepRef=useRef<HTMLButtonElement>(null);
 const previousEditor=useRef<string|null>(null),noteButtons=useRef(new Map<string,HTMLButtonElement>());
 const id=useId();
 const notes=useMemo(()=>data?boardNotesForView(data,filter):[],[data,filter]);
 const counts=useMemo(()=>data?{today:data.notes.filter(note=>note.date===data.day).length,open:data.notes.filter(note=>!note.done).length,done:data.notes.filter(note=>note.done).length}:null,[data]);
 const dirty=!!editor&&editor.base?.source!=='calendar'&&boardDraftChanged(editor.draft,editor.initial);
 const activeNote=editor?.base?.source==='calendar'?(data?.notes.find(note=>note.id===editor.id)||editor.base):editor?.base;
 const latest=editor?(conflict?.id===editor.id?conflict.current:null)||data?.notes.find(note=>note.id===editor.id):null;
 const changedElsewhere=!!editor?.base&&!!latest&&latest.version!==editor.base.version;
 const editorConflict=!!editor&&(conflict?.id===editor.id||changedElsewhere);
 const sourceRemoved=!!data&&!!editor?.base&&!data.notes.some(note=>note.id===editor.id)&&conflict?.current?.id!==editor.id;
 const busy=(noteId:string)=>pending.has(noteId)||!!busyIds?.has(noteId);
 const saving=!!editor&&busy(editor.id);
 const calendarEditor=editor?.base?.source==='calendar';

 useEffect(()=>{
  const dialog=dialogRef.current;if(!dialog)return;
  const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
  mounted.current=true;dismissed.current=false;dialog.showModal();
  return()=>{mounted.current=false;if(dialog.open)dialog.close();if(trigger?.isConnected)trigger.focus({preventScroll:true});};
 },[]);
 useEffect(()=>{
  if(editor){if(editor.base?.source==='calendar')detailRef.current?.focus({preventScroll:true});else titleRef.current?.focus({preventScroll:true});}
  else if(previousEditor.current)(noteButtons.current.get(previousEditor.current)||newRef.current)?.focus({preventScroll:true});
  previousEditor.current=editor?.id||null;
 },[editor?.id]);
 useEffect(()=>{if(discard)keepRef.current?.focus({preventScroll:true});},[discard]);
 useEffect(()=>{if(!dirty||saving)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty,saving]);
 function close(){if(dismissed.current)return;dismissed.current=true;dialogRef.current?.close();onClose();}
 function guard(action:()=>void){if(editor&&(pendingRef.current.has(editor.id)||busyIds?.has(editor.id))){setNotice('Saving your note…');return;}if(dirty){nextAction.current=action;setDiscard(true);}else action();}
 function clearMessages(){setMutationError('');setNotice('');setConflict(null);}
 function openNew(){if(!data)return;guard(()=>{const draft=newDraft(data.day);setEditor({id:draft.id,base:null,draft,initial:{...draft}});clearMessages();});}
 function openNote(note:BoardNote){if(editor?.id===note.id)return;guard(()=>{const draft=boardDraftFromNote(note);setEditor({id:note.id,base:note,draft,initial:{...draft}});clearMessages();});}
 function chooseFilter(next:BoardFilter){guard(()=>{setFilter(next);setEditor(null);clearMessages();});}
 function edit<K extends keyof BoardCreateInput>(key:K,value:BoardCreateInput[K]){setEditor(current=>current?{...current,draft:{...current.draft,[key]:value}}:current);setMutationError('');setNotice('');}
 function start(noteId:string){if(pendingRef.current.has(noteId)||busyIds?.has(noteId))return false;pendingRef.current.add(noteId);setPending(new Set(pendingRef.current));setMutationError('');setNotice('');return true;}
 function finish(noteId:string){pendingRef.current.delete(noteId);if(mounted.current)setPending(new Set(pendingRef.current));}
 async function refresh(){try{await onRefresh();if(mounted.current)setMutationError('');}catch(e){if(mounted.current)setMutationError(errorMessage(e));}}
 async function save(versionOverride?:number){
  if(!editor||calendarEditor)return;
  if(sourceRemoved){setMutationError('This note is no longer on the board. Pin a new copy to keep your edits.');return;}
  const submitted=editor,draft={...editor.draft,title:editor.draft.title.trim(),body:editor.draft.body.trim()};
  if(!draft.title){setMutationError('Give this note a title.');titleRef.current?.focus();return;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)){setMutationError('Choose a date for this note.');return;}
  if(!start(submitted.id))return;
  try{
   const version=versionOverride??submitted.base?.version;
   const note=version!==undefined?await onUpdate({id:submitted.id,version,patch:{title:draft.title,body:draft.body,date:draft.date,color:draft.color}}):await onCreate(draft);
   if(!mounted.current)return;
   setEditor(current=>current?.id===submitted.id?null:current);setConflict(null);setNotice(submitted.base?'Note saved.':'Note added.');
   if(note.date!==data?.day&&filter==='today')setFilter(note.done?'done':'open');
  }catch(e){if(mounted.current){const collision=conflictNote(e,submitted.id);setConflict(collision);setMutationError(collision?'This note changed elsewhere. Your edits are kept.':errorMessage(e));}}
  finally{finish(submitted.id);}
 }
 async function toggle(note:BoardNote){
  if(!start(note.id))return;
  try{
   const updated=await onUpdate({id:note.id,version:note.version,patch:{done:!note.done}});
   if(!mounted.current)return;
   setEditor(current=>current?.id===note.id?{...current,base:updated}:current);
   setConflict(null);setNotice(updated.done?(updated.source==='calendar'?'Done on this board.':'Marked done.'):'Note reopened.');
  }catch(e){if(mounted.current){const collision=conflictNote(e,note.id);setConflict(collision);setMutationError(collision?'This note changed elsewhere. Refresh and try again.':errorMessage(e));}}
  finally{finish(note.id);}
 }
 function useLatest(){if(!editor||!latest)return;const draft=boardDraftFromNote(latest);setEditor({id:latest.id,base:latest,draft,initial:{...draft}});clearMessages();}
 function copyRemoved(){if(!editor||calendarEditor)return;const draft={...editor.draft,id:crypto.randomUUID()};setEditor({id:draft.id,base:null,draft,initial:{...draft,title:'',body:''}});clearMessages();}
 function outside(event:{clientX:number;clientY:number}){const box=dialogRef.current?.getBoundingClientRect();return !!box&&(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom);}
 function backdropClick(event:MouseEvent<HTMLDialogElement>){if(backdropPress.current&&event.target===event.currentTarget&&outside(event))guard(close);backdropPress.current=false;}
 function submit(event:FormEvent){event.preventDefault();void save();}
 const externalLink=activeNote?boardCalendarLink(activeNote):null;

 return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={`${id}-title`} onCancel={event=>{event.preventDefault();event.stopPropagation();if(discard){setDiscard(false);nextAction.current=null;}else guard(close);}} onClose={()=>{if(!dialogRef.current?.open)close();}} onKeyDownCapture={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(discard){setDiscard(false);nextAction.current=null;}else guard(close);}}} onPointerDown={event=>{backdropPress.current=event.target===event.currentTarget&&outside(event);}} onPointerCancel={()=>{backdropPress.current=false;}} onClick={backdropClick}>
  <div className={styles.shell}>
   <header className={styles.header}><div><h2 id={`${id}-title`}>Blackboard</h2><p>{data?boardDateLabel(data.day):'Today'}<span>Singapore time</span></p></div><div className={styles.headerActions}><button ref={newRef} type="button" className={styles.newButton} disabled={!data||saving} onClick={openNew}><Plus size={16}/>New note</button><button type="button" className={styles.iconButton} aria-label="Close blackboard" disabled={saving} onClick={()=>guard(close)}><X size={20}/></button></div></header>
   <div className={styles.toolbar}><div className={styles.filters} role="group" aria-label="Filter notes">{filters.map(item=><button key={item.id} type="button" aria-pressed={filter===item.id} disabled={saving} onClick={()=>chooseFilter(item.id)}>{item.label}<span>{counts?counts[item.id]:'—'}</span></button>)}</div><button type="button" className={styles.iconButton} disabled={loading} aria-label="Refresh blackboard" onClick={()=>void refresh()}><RefreshCw size={16} className={loading?styles.spin:undefined}/></button></div>
   {discard&&<div className={styles.discard} role="alert"><p>Discard your unsaved note changes?</p><div><button ref={keepRef} type="button" className={styles.secondary} onClick={()=>{setDiscard(false);nextAction.current=null;titleRef.current?.focus();}}>Keep editing</button><button type="button" className={styles.danger} onClick={()=>{const action=nextAction.current;nextAction.current=null;setDiscard(false);action?.();}}>Discard changes</button></div></div>}
   {(error||mutationError)&&<div className={styles.error} role="alert"><span>{mutationError||error}</span><button type="button" disabled={loading} onClick={()=>void refresh()}><RefreshCw size={14}/>Refresh</button></div>}
   {notice&&<div className={styles.notice} role="status"><Check size={14}/>{notice}</div>}
   <div className={`${styles.workspace} ${editor?styles.withEditor:''}`}>
    <section className={styles.board} aria-label={`${filters.find(item=>item.id===filter)?.label} notes`} aria-busy={loading}>
     {!data?<div className={styles.empty}>{loading?<><LoaderCircle size={23} className={styles.spin}/><p>Loading the board…</p></>:<><StickyNote size={26}/><p>The board is unavailable.</p><button type="button" className={styles.secondary} onClick={()=>void refresh()}>Try again</button></>}</div>:<>
      {!notes.length&&!error&&<div className={styles.empty}>{filter==='done'?<CheckCheck size={30}/>:<StickyNote size={30}/>}<h3>{filter==='today'?'No notes for today':filter==='open'?'No open notes':'No finished notes yet'}</h3><p>{filter==='done'?'Mark a note done when it’s finished.':data.calendar.status==='current'?'Pin a task or a reminder.':'Calendar notes may still be waiting to sync.'}</p>{filter!=='done'&&<button type="button" className={styles.chalkButton} onClick={openNew}><Plus size={15}/>New note</button>}</div>}
      <div className={styles.notes}>{notes.map(note=><article key={note.id} className={`${styles.note} ${note.done?styles.done:''} ${editor?.id===note.id?styles.selectedNote:''}`} style={paper(note.color)} aria-busy={busy(note.id)}>
       <button type="button" ref={button=>{if(button)noteButtons.current.set(note.id,button);else noteButtons.current.delete(note.id);}} className={styles.noteContent} onClick={()=>openNote(note)} aria-label={`Open note: ${note.title}`}>
        <div className={styles.noteTop}><span>{note.date===data.day?'Today':boardDateLabel(note.date)}</span>{note.source==='calendar'?<CalendarDays size={14}/>:<PencilLine size={13}/>}</div><h3>{note.title}</h3>{note.body&&<p>{note.body}</p>}{note.calendar&&<span className={styles.eventTime}><Clock3 size={12}/>{boardNoteTime(note)}</span>}
       </button>
       <footer className={styles.noteFooter}><span>{note.source==='calendar'?'Calendar':'Note'}</span><button type="button" disabled={busy(note.id)} className={styles.doneButton} onClick={()=>void toggle(note)} aria-label={`${note.done?'Reopen':'Mark done'}${note.source==='calendar'?' on board':''}: ${note.title}`}>{busy(note.id)?<LoaderCircle size={13} className={styles.spin}/>:note.done?<Undo2 size={13}/>:<Check size={14}/>}<span>{note.done?'Reopen':'Done'}</span></button></footer>
      </article>)}</div>
     </>}
    </section>
    {editor&&<section className={styles.editor} style={paper(calendarEditor?activeNote?.color||editor.draft.color:editor.draft.color)} aria-label={calendarEditor?'Calendar note':editor.base?'Edit note':'New note'}>
     <div className={styles.editorTop}><button type="button" className={styles.editorBack} disabled={saving} onClick={()=>guard(()=>{setEditor(null);clearMessages();})}><ArrowLeft size={14}/>Board</button><span>{calendarEditor?<><CalendarDays size={13}/>Calendar</>:<><PencilLine size={13}/>{editor.base?'Edit note':'New note'}</>}</span></div>
     {sourceRemoved&&<div className={styles.conflict} role="status"><strong>{calendarEditor?'This calendar event is no longer on the board.':'This note is no longer on the board.'}</strong>{!calendarEditor&&<><p>Your edits are still here.</p><div><button type="button" onClick={copyRemoved}>Prepare a new copy</button></div></>}</div>}
     {calendarEditor&&activeNote?<div className={styles.calendarDetail}><h3 ref={detailRef} tabIndex={-1}>{activeNote.title}</h3><p className={styles.detailTime}><CalendarDays size={14}/>{boardDateLabel(activeNote.date)}</p><p className={styles.detailTime}><Clock3 size={14}/>{boardNoteTime(activeNote)}</p>{activeNote.body&&<p className={styles.detailBody}>{activeNote.body}</p>}<div className={styles.calendarSource}><span>{activeNote.calendar?.accountId}</span>{externalLink&&<a href={externalLink} target="_blank" rel="noopener noreferrer">Open calendar<ArrowUpRight size={14}/></a>}</div><button type="button" className={styles.saveButton} disabled={sourceRemoved||busy(activeNote.id)} onClick={()=>void toggle(activeNote)}>{busy(activeNote.id)?<LoaderCircle size={15} className={styles.spin}/>:activeNote.done?<Undo2 size={15}/>:<Check size={15}/>}<span>{activeNote.done?'Reopen on board':'Done on board'}</span></button><p className={styles.boardOnly}>Only this board changes.</p></div>:<form className={styles.editorForm} onSubmit={submit}>
      {editorConflict&&<div className={styles.conflict} role="status"><strong>Updated elsewhere</strong><p>Your edits are still here.</p>{latest&&<p className={styles.latestTitle}>Latest: {latest.title}</p>}<div>{latest?<><button type="button" disabled={saving} onClick={useLatest}>Use latest</button><button type="button" disabled={saving||!dirty} onClick={()=>void save(latest.version)}>Save my version</button></>:<button type="button" disabled={loading} onClick={()=>void refresh()}>Load latest</button>}</div></div>}
      <fieldset disabled={saving}><label htmlFor={`${id}-note-title`}>Title<input ref={titleRef} id={`${id}-note-title`} value={editor.draft.title} maxLength={160} placeholder="What needs doing?" onChange={event=>edit('title',event.target.value)} required/></label><label htmlFor={`${id}-note-body`}>Details<textarea id={`${id}-note-body`} value={editor.draft.body} maxLength={2000} rows={6} placeholder="Add the details…" onChange={event=>edit('body',event.target.value)}/><small>{editor.draft.body.length} / 2,000</small></label><label htmlFor={`${id}-note-date`}>Date<input id={`${id}-note-date`} type="date" value={editor.draft.date} onChange={event=>edit('date',event.target.value)} required/></label><fieldset className={styles.colors}><legend>Paper color</legend><div>{NOTE_COLORS.map(color=><label key={color.id} style={paper(color.id)} title={color.label}><input type="radio" name={`${id}-note-color`} aria-label={color.label} checked={editor.draft.color===color.id} onChange={()=>edit('color',color.id)}/><span aria-hidden="true">{editor.draft.color===color.id&&<Check size={14}/>}</span></label>)}</div></fieldset></fieldset>
      <div className={styles.editorActions}><button type="button" className={styles.cancelButton} disabled={saving} onClick={()=>guard(()=>{setEditor(null);clearMessages();})}>Cancel</button><button type="submit" className={styles.saveButton} disabled={saving||sourceRemoved||editorConflict||!!editor.base&&!dirty}>{saving?<LoaderCircle size={15} className={styles.spin}/>:<Check size={15}/>}<span>{saving?'Saving…':editor.base?'Save changes':'Pin note'}</span></button></div>
     </form>}
    </section>}
   </div>
   <footer className={styles.syncFooter}><CalendarDays size={14}/><span>{data?boardSyncLabel(data.calendar):'Calendar status unavailable'}</span>{data&&['stale','error'].includes(data.calendar.status)&&<span className={styles.syncDot} aria-label="Calendar needs attention"/>}</footer>
  </div>
 </dialog>;
}
