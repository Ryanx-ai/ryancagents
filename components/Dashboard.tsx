'use client';
import {useEffect,useState,useCallback,useRef} from 'react';
import dynamic from 'next/dynamic';
import {Activity,GitBranch,SlidersHorizontal,Sun,Moon,Pause,Play,LockKeyhole,X,Send,Check,ArrowUpRight,BarChart3,Radio,Maximize,Minimize,Gamepad2,RefreshCw,Search,LogOut,Info,Plus,ClipboardList} from 'lucide-react';
import Office,{Ryan} from './Office';
import CharacterCard from './CharacterCard';
import {WardrobeProvider} from './WardrobeProvider';
import {useBlackboard} from './useBlackboard';
import {boardNotesForView} from '../lib/board-view';
import profileStyles from './DashboardProfiles.module.css';
import MessageContent from './MessageContent';
import ManagerResources from './ManagerResources';
import IntegrationLogo,{integrationMeta} from './IntegrationLogo';
import ReviewSheet from './ReviewSheet';
import {completionKey,completionRows} from '../lib/completions.mjs';
import {pollRetryDelay} from '../lib/polling.mjs';
import {normalizeMessageText} from '../lib/message-content.mjs';
import {agents,emptyAgents,type AgentId,type AgentState,type Snapshot} from '../lib/model';
import {avatarMode,needsReview,mergeReviews} from '../lib/game-state.mjs';
const AgentCreator=dynamic(()=>import('./AgentCreator'),{ssr:false});
const Wardrobe=dynamic(()=>import('./Wardrobe'),{ssr:false});
const Blackboard=dynamic(()=>import('./Blackboard'),{ssr:false});
const DesignerVoiceInput=dynamic(()=>import('./DesignerVoiceInput'),{ssr:false});
const Workflow=dynamic(()=>import('./Workflow'),{loading:()=> <div className="panel-loading"><RefreshCw className="spin" size={22}/></div>});
const statusNames:Record<string,string>={planning:'Planning',pending:'Queued for Mac',queued:'Queued in Codex',delivered:'Delivered',replied:'Replied',uncertain:'Check Codex before retrying',failed:'Failed',expired:'Expired'};
type Message={id:string;agentId:AgentId;prompt:string;status:string;reply?:string;createdAt:string};
type Panel='activity'|'workflow'|'stats'|'settings'|null;
function relative(at:string|null|undefined,now:number){if(!at)return '—';const sec=Math.max(0,Math.floor((now-Date.parse(at))/1000));return sec<60?'now':sec<3600?`${Math.floor(sec/60)}m`:sec<86400?`${Math.floor(sec/3600)}h`:`${Math.floor(sec/86400)}d`;}
function Button({label,active=false,onClick,children,badge}:{label:string;active?:boolean;onClick:()=>void;children:React.ReactNode;badge?:number}){return <button className={`hud-button ${active?'active':''}`} title={label} aria-label={label} aria-pressed={active} onClick={onClick}>{children}{!!badge&&<span className="button-badge">{badge}</span>}</button>;}
function demoData(step:number,epoch:number):Snapshot {
 const completedAt=new Date(epoch).toISOString();
 const states:AgentState[]=[
  {id:'scheduler',status:'waiting',activity:'Waiting for input',updatedAt:completedAt,attentionAt:completedAt,result:'<heartbeat><automation_id>demo-inbox</automation_id><decision>NOTIFY</decision><message>A calendar conflict needs your review. **Confirm the proposed time** in [Calendar](https://calendar.google.com/calendar/u/0/r).</message></heartbeat>'},
  {id:'outreach',status:'idle',activity:'Work session finished',updatedAt:completedAt,completedAt,result:'Outreach is complete. **Three drafts** are ready for your review.\n\n### Next steps\n\n- Review the messages in [Gmail drafts](https://mail.google.com/mail/u/0/#drafts).\n- Confirm the contact list before sending.\n\nNothing has been sent in this demo.'},
  {id:'contacts',status:step%3===0?'working':'idle',activity:step%3===0?'Researching contacts':'Ready for the next task',updatedAt:completedAt},
  {id:'designer',progress:'Debugging…',status:step%2===0?'working':'idle',activity:step%2===0?'Running a task':'Ready for the next task',updatedAt:completedAt,result:'The studio is ready for your next design request.'},
  {id:'manager',status:'idle',activity:'Ready for the next task',updatedAt:completedAt,completedAt,result:'Your office has **two items to review**.\n\n### Inbox\n\n- A calendar conflict needs your decision. [Open calendar](https://calendar.google.com/calendar/u/0/r).\n- Review the proposed time before replying.\n\n### Outreach\n\nThree drafts are ready. [Open drafts](https://mail.google.com/mail/u/0/#drafts).\n\n### Network\n\nContact research is in progress.'},
 ];return {version:1,observedAt:new Date().toISOString(),agents:states,events:states.map((a,i)=>({id:`demo-${i}`,agentId:a.id,at:completedAt,kind:i===1?'completed':i===0?'waiting':'contacts',label:a.activity,status:a.status}))};
}
function useVisiblePolling(task:()=>Promise<number>,session:string|null){
 useEffect(()=>{if(!session)return;let active=true,running=false;let timer:ReturnType<typeof setTimeout>;
  const run=async()=>{clearTimeout(timer);if(!active||running)return;if(document.hidden){timer=setTimeout(run,60000);return;}running=true;let delay=30000;try{delay=await task();}finally{running=false;if(active)timer=setTimeout(run,delay);}};
  const visible=()=>{if(!document.hidden)void run();};document.addEventListener('visibilitychange',visible);void run();
  return()=>{active=false;clearTimeout(timer);document.removeEventListener('visibilitychange',visible);};
 },[task,session]);
}
export default function Dashboard(){return <WardrobeProvider><OfficeDashboard/></WardrobeProvider>;}
function OfficeDashboard(){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [connection,setConnection]=useState('locked');
 const [serviceError,setServiceError]=useState('');
 const [selected,setSelected]=useState<AgentId|null>(null);
 const [profile,setProfile]=useState<AgentId|null>(null);
 const [wardrobe,setWardrobe]=useState<AgentId|null>(null);
 const [creatingAgent,setCreatingAgent]=useState(false);
 const [boardOpen,setBoardOpen]=useState(false);
 const [panel,setPanel]=useState<Panel>(null);
 const [night,setNight]=useState(true);
 const [paused,setPaused]=useState(false);
 const [now,setNow]=useState(0);
 const [demo,setDemo]=useState(false);
 const [demoEpoch,setDemoEpoch]=useState(0);
 const [demoStep,setDemoStep]=useState(0);
 const [reviewed,setReviewed]=useState<Record<string,string>>({});
 const [demoReviewed,setDemoReviewed]=useState<Record<string,string>>({});
 const [completed,setCompleted]=useState<Record<string,boolean>>({});
 const [demoCompleted,setDemoCompleted]=useState<Record<string,boolean>>({});
 const [reviewing,setReviewing]=useState<Record<string,boolean>>({});
 const [messages,setMessages]=useState<Message[]>([]);
 const [drafts,setDrafts]=useState<Record<string,string>>({});
 const [sending,setSending]=useState(false);
 const [voiceBusy,setVoiceBusy]=useState(false);
 const [error,setError]=useState('');
 const [sessionToken,setSessionToken]=useState<string|null>(null);
 const tokenRef=useRef<string|null>(null);
 const authEpoch=useRef(0);
 const etags=useRef(new Map<string,string>());
 const refreshFailures=useRef(0);const messageFailures=useRef(0);
 const messageGeneration=useRef(0);const messagePollSequence=useRef(0);const refreshSequence=useRef(0);
 const unlock=!sessionToken;
 const [personalKey,setPersonalKey]=useState('');
 const [accessKey,setAccessKey]=useState('');
 const [unlocking,setUnlocking]=useState(false);
 const [filter,setFilter]=useState('all');
 const [query,setQuery]=useState('');
 const [fullscreen,setFullscreen]=useState(false);
 const messageRequest=useRef<{id:string;agentId:AgentId;prompt:string}|null>(null);
 const chatRef=useRef<HTMLElement>(null);
 const lockOffice=useCallback(()=>{authEpoch.current++;tokenRef.current=null;etags.current.clear();refreshFailures.current=0;messageFailures.current=0;setServiceError('');setSending(false);setUnlocking(false);setSessionToken(null);setConnection('locked');setSnapshot(null);setMessages([]);setReviewed({});setCompleted({});setDemoCompleted({});setReviewing({});setDrafts({});setSelected(null);setProfile(null);setWardrobe(null);setCreatingAgent(false);setBoardOpen(false);setPanel(null);setDemo(false);setAccessKey('');setPersonalKey('');messageRequest.current=null;},[]);
 useEffect(()=>{
  if(!selected||unlock||profile||wardrobe||creatingAgent||boardOpen)return;
  const dismiss=(event:PointerEvent)=>{
   if(event.button!==0||!event.isPrimary||!(event.target instanceof Element))return;
   if(chatRef.current?.contains(event.target)||document.querySelector('dialog[open]'))return;
   // Agent buttons choose explicitly on click. Let that action complete without
   // closing/reopening the current chat during its preceding pointer event.
   if(event.target.closest('.world-ryan,.avatar-shortcut'))return;
   setSelected(null);
  };
  document.addEventListener('pointerdown',dismiss,true);
  return()=>document.removeEventListener('pointerdown',dismiss,true);
 },[selected,unlock,profile,wardrobe,creatingAgent,boardOpen]);
 const request=useCallback(async(url:string,init:RequestInit={})=>{
  const token=tokenRef.current;if(!token)throw new Error('Unlock the office first.');
  const isRead=!init.method||init.method==='GET';const cached=isRead?etags.current.get(url):null;
  const r=await fetch(url,{...init,signal:init.signal??AbortSignal.timeout(20000),headers:{...init.headers,Authorization:`Bearer ${token}`,...(cached?{'If-None-Match':cached}:{})}});
  if(tokenRef.current!==token)throw new Error('Session ended.');
  if(r.status===401){lockOffice();throw new Error('Unlock the office again.');}
  return r;
 },[lockOffice]);
 const boardDay=now?new Date(now+8*60*60*1000).toISOString().slice(0,10):'';
 const board=useBlackboard(demo?null:sessionToken,boardDay,request);
 const todayNotes=board.data?boardNotesForView({...board.data,day:boardDay},'today'):[];
 function openBoard(){setSelected(null);setPanel(null);setBoardOpen(true);void board.refresh(false);}
 const refresh=useCallback(async()=>{
  const token=tokenRef.current;if(!token)return 10000;const sequence=++refreshSequence.current;
  let retryAfter:string|null=null;
  try{
   const responses=await Promise.all([request('/api/activity',{cache:'no-store'}),request('/api/review?details=1',{cache:'no-store'})]);
   const [activity,reviews]=await Promise.all(responses.map(async r=>r.status===304?null:r.json()));
   if(tokenRef.current!==token||sequence!==refreshSequence.current)return 10000;
   if(responses[0].ok&&activity){setConnection(activity.connection);setSnapshot(activity.snapshot);}
   else if(responses[0].status===304)setConnection('connected');
   if(responses[1].ok&&reviews){setReviewed(current=>mergeReviews(current,reviews.reviewed));setCompleted(current=>({...current,...reviews.completed}));}
   const failed=responses.find(r=>!r.ok&&r.status!==304);
   if(failed){retryAfter=failed.headers.get('retry-after');throw new Error((responses[0]===failed?activity:reviews)?.error||'Office storage is unavailable. Retrying shortly.');}
   responses.forEach((r,i)=>{if(r.ok&&r.headers.get('etag'))etags.current.set(i===0?'/api/activity':'/api/review?details=1',r.headers.get('etag')!);});
   refreshFailures.current=0;setServiceError('');return 10000;
  }catch(e){
   if(tokenRef.current!==token||sequence!==refreshSequence.current)return 10000;
   setConnection('error');setServiceError(e instanceof Error?e.message:'Office storage is unavailable. Retrying shortly.');
   etags.current.delete('/api/activity');etags.current.delete('/api/review?details=1');
   return pollRetryDelay(++refreshFailures.current,retryAfter);
  }
 },[request]);
 useVisiblePolling(refresh,demo?null:sessionToken);
 const waitingForReply=messages.some(m=>['pending','planning','queued','delivered'].includes(m.status));
 const pollMessages=useCallback(async()=>{
  if(!sessionToken)return 10000;let retryAfter:string|null=null;
  const generation=messageGeneration.current;const sequence=++messagePollSequence.current;
  try{const r=await request('/api/messages',{cache:'no-store'});retryAfter=r.headers.get('retry-after');
   const data=r.status===304?null:await r.json();
   if(tokenRef.current!==sessionToken||sequence!==messagePollSequence.current)return 10000;
   if(generation!==messageGeneration.current){etags.current.delete('/api/messages');return 1500;}
   if(r.status!==304){if(!r.ok)throw new Error(data?.error||'Messages are unavailable. Retrying shortly.');if(!Array.isArray(data?.messages))throw new Error('Invalid message response. Retrying shortly.');setMessages(data.messages);if(r.headers.get('etag'))etags.current.set('/api/messages',r.headers.get('etag')!);}
   messageFailures.current=0;return waitingForReply?1500:10000;
  }catch(e){if(tokenRef.current!==sessionToken||sequence!==messagePollSequence.current)return 10000;setServiceError(e instanceof Error?e.message:'Messages are unavailable.');etags.current.delete('/api/messages');return pollRetryDelay(++messageFailures.current,retryAfter);}
 },[sessionToken,waitingForReply,request]);
 useVisiblePolling(pollMessages,demo?null:sessionToken);
 useEffect(()=>{const restored=(e:PageTransitionEvent)=>{if(e.persisted)lockOffice();};window.addEventListener('pageshow',restored);return()=>window.removeEventListener('pageshow',restored);},[lockOffice]);
 useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>{setNow(Date.now());setDemoStep(x=>x+1);},6000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{const changed=()=>setFullscreen(!!document.fullscreenElement);document.addEventListener('fullscreenchange',changed);const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setSelected(null);setPanel(null);}};window.addEventListener('keydown',escape);return()=>{document.removeEventListener('fullscreenchange',changed);window.removeEventListener('keydown',escape);};},[]);
 const visible=demo?demoData(demoStep,demoEpoch):snapshot;
 const online=demo||connection==='connected'&&!!snapshot&&now-Date.parse(snapshot.observedAt)<150000;
 const states=agents.map(a=>visible?.agents.find(s=>s.id===a.id)||emptyAgents.find(s=>s.id===a.id)!);
 const reviews=demo?demoReviewed:reviewed;
 const completions=demo?demoCompleted:completed;
 const chosen=agents.find(a=>a.id===selected);
 const profileAgent=agents.find(a=>a.id===profile);
 const wardrobeAgent=agents.find(a=>a.id===wardrobe);
 const state=states.find(a=>a.id===selected);
 const result=normalizeMessageText(state?.result||'');
 const mode=state?avatarMode(state,reviews,online):'idle';
 const attention=states.filter(a=>avatarMode(a,reviews,online)==='attention').length;
 const celebrations=states.filter(a=>needsReview(a,reviews)).length;
 const pendingReview=state?needsReview(state,reviews):false;
 const eventList=visible?.events||[];
 const toReview=completionRows(states,eventList,reviews,completions).filter(r=>!r.done).length;
 const currentMessages=messages.filter(m=>m.agentId===selected);
 function choose(id:AgentId){setSelected(id);setPanel(null);setError('');}
 function openWardrobe(id:AgentId){setProfile(null);setCreatingAgent(false);setWardrobe(id);}
 function openPanel(next:Panel){setPanel(p=>p===next?null:next);setSelected(null);setError('');}
 async function login(e:React.FormEvent){e.preventDefault();if(unlocking)return;const epoch=authEpoch.current;setUnlocking(true);setError('');try{const r=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:accessKey,personalKey})});const d=await r.json();if(authEpoch.current!==epoch)return;if(!r.ok||!d.token)throw new Error(d.error||'Could not unlock.');tokenRef.current=d.token;setSessionToken(d.token);setAccessKey('');setPersonalKey('');setDemo(false);}catch(e){if(authEpoch.current===epoch)setError(e instanceof Error?e.message:'Could not unlock.');}finally{if(authEpoch.current===epoch)setUnlocking(false);}}
 async function review(agentId:AgentId|null=selected,completedAt:string|null|undefined=state?.completedAt){
  if(!agentId||!completedAt)return;const id=completionKey(agentId,completedAt);if(!id||reviewing[id])return;
  if(demo){setDemoReviewed(v=>mergeReviews(v,{[agentId]:completedAt}));setDemoCompleted(v=>({...v,[id]:true}));return;}
  const epoch=authEpoch.current;setError('');setReviewing(v=>({...v,[id]:true}));
  try{const r=await request('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agentId,completedAt})});if(!r.ok)throw new Error((await r.json()).error||'Could not save review.');if(authEpoch.current===epoch){setReviewed(v=>mergeReviews(v,{[agentId]:completedAt}));setCompleted(v=>({...v,[id]:true}));}}
  catch(e){if(authEpoch.current===epoch)setError(e instanceof Error?e.message:'Review failed.');}
  finally{if(authEpoch.current===epoch)setReviewing(v=>({...v,[id]:false}));}
 }
 async function send(e:React.FormEvent){e.preventDefault();if(!selected||!drafts[selected]?.trim()||sending||selected==='designer'&&voiceBusy)return;if(demo){setError('Switch to live to send.');return;}if(!sessionToken)return;const epoch=authEpoch.current;setSending(true);setError('');
  const prompt=drafts[selected].trim();if(!messageRequest.current||messageRequest.current.prompt!==prompt||messageRequest.current.agentId!==selected)messageRequest.current={id:new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+crypto.randomUUID(),agentId:selected,prompt};
  try{const r=await request('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(messageRequest.current)});const message=await r.json();if(authEpoch.current!==epoch)return;if(!r.ok)throw new Error(message.error);messageGeneration.current++;etags.current.delete('/api/messages');setMessages(v=>[...v.filter(m=>m.id!==message.id),message]);setDrafts(v=>({...v,[message.agentId]:''}));messageRequest.current=null;}catch(e){if(authEpoch.current===epoch)setError(e instanceof Error?e.message:'Message not sent.');}finally{if(authEpoch.current===epoch)setSending(false);}
 }
 async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{setError('Fullscreen is unavailable in this browser.');}}
 return <div className={`game-shell ${unlock?'office-locked':''}`}><div className="office-stage" inert={unlock} aria-hidden={unlock?true:undefined}>
  <Office states={states} selected={selected} onSelect={choose} onProfile={setProfile} night={night} onNightChange={setNight} paused={paused||unlock||!!profile||!!wardrobe||creatingAgent||boardOpen} reviewed={reviews} online={online} boardNotes={todayNotes} boardDay={boardDay} onBoard={openBoard}/>
  <div className="hud-top-left"><button className="hq-badge" onClick={()=>{setSelected(null);setPanel(null);}} aria-label="Office"><span>r.</span><strong>HQ</strong></button>{demo&&<button className="demo-badge" onClick={()=>setDemo(false)}>Demo <X size={12}/></button>}</div>
  <div className="hud-top-right"><button className={`signal-badge ${online?'connected':''}`} title={connection==='locked'?'Unlock office':online?'Bridge connected':serviceError||'Bridge offline'} onClick={()=>openPanel('settings')}><i/>{connection==='locked'&&!demo?<LockKeyhole size={13}/>:<Radio size={14}/>}</button><span className="hud-button" role="img" aria-label={night?'Nighttime, Singapore time':'Daytime, Singapore time'} title={night?'Night · 7pm–7am SGT':'Day · 7am–7pm SGT'}>{night?<Moon size={18}/>:<Sun size={18}/>}</span><Button label={fullscreen?'Exit fullscreen':'Fullscreen'} onClick={()=>void toggleFullscreen()}>{fullscreen?<Minimize size={17}/>:<Maximize size={17}/>}</Button></div>
  <div className={`hud-bottom ${profileStyles.loadout}`}><div className="agent-switcher">{agents.map(a=>{const s=states.find(s=>s.id===a.id)!;const m=avatarMode(s,reviews,online);return <button key={a.id} title={a.name} aria-label={`Select ${a.name}`} className={`avatar-shortcut ${selected===a.id?'active':''}`} onClick={()=>choose(a.id)} style={{'--agent-color':a.color} as React.CSSProperties}><Ryan size={54} still agentId={a.id}/><span className="shortcut-status">{m==='attention'?'!':needsReview(s,reviews)?'★':m==='working'?'•':''}</span></button>;})}<button type="button" className={`avatar-shortcut ${profileStyles.addAgent}`} aria-label="Create agent" title="Create agent" onClick={()=>setCreatingAgent(true)}><Plus size={21} strokeWidth={1.5} aria-hidden="true"/></button></div><div className="hud-dock"><Button label="Activity" active={panel==='activity'} badge={attention+celebrations} onClick={()=>openPanel('activity')}><Activity size={19}/></Button><Button label="Workflows" active={panel==='workflow'} onClick={()=>openPanel('workflow')}><GitBranch size={19}/></Button><Button label="Stats" badge={toReview} active={panel==='stats'} onClick={()=>openPanel('stats')}><BarChart3 size={19}/></Button><Button label="Blackboard" active={boardOpen} onClick={openBoard}><ClipboardList size={19}/></Button><span className="dock-divider"/><Button label={paused?'Resume animations':'Pause animations'} active={paused} onClick={()=>setPaused(v=>!v)}>{paused?<Play size={17}/>:<Pause size={17}/>}</Button><Button label="Settings" active={panel==='settings'} onClick={()=>openPanel('settings')}><SlidersHorizontal size={19}/></Button></div></div>
  {chosen&&state&&<section ref={chatRef} className="floating-panel chat-panel" role="dialog" aria-label={`Chat with ${chosen.name}`}>
   <header className="panel-header"><div className="chat-avatar" style={{'--agent-color':chosen.color} as React.CSSProperties}><Ryan size={54} still agentId={chosen.id}/></div><div><div className={profileStyles.nameRow}><h2>{chosen.name}</h2><button type="button" className={profileStyles.infoButton} onClick={()=>setProfile(chosen.id)} aria-label={`View ${chosen.name} profile`} title="Character profile" aria-haspopup="dialog"><Info size={15} aria-hidden="true"/></button></div><span className={`compact-status ${mode}`}>{!online||mode==='offline'?'Offline':mode==='review'?'Ready for review':mode==='attention'?'Needs attention':mode==='working'?'Working':'Idle'}</span></div>{chosen.thread&&<a className="hud-button" href={`codex://threads/${chosen.thread}`} aria-label="Open original Codex chat" title="Open in Codex"><ArrowUpRight size={17}/></a>}<button className="hud-button" onClick={()=>setSelected(null)} aria-label="Close chat"><X size={18}/></button></header>
   {chosen.id==='manager'&&<ManagerResources/>}
   {chosen.id==='proposal'&&<a className={profileStyles.studioLink} href={integrationMeta.studio.href} target="_blank" rel="noopener noreferrer" title="Open Proposal Studio on this Mac"><IntegrationLogo name="studio" size={23} decorative/><span>Open Studio</span><ArrowUpRight size={18} aria-hidden="true"/></a>}
   <div className="chat-history">
    {(result||pendingReview)&&<article className={`agent-result ${pendingReview?'unreviewed':''}`}><div className="message-label"><span>{mode==='attention'?'!':pendingReview?'★':'✦'}</span><span>{chosen.name}</span><time>{relative(state.completedAt||state.updatedAt,now)}</time></div><MessageContent text={result||'This task finished without a text summary. Open the original Codex chat to review it.'}/>{pendingReview?<button className="review-button" disabled={!!reviewing[completionKey(state.id,state.completedAt)||'']} onClick={()=>void review()}><Check size={16}/>Mark done</button>:state.completedAt&&<span className="done-receipt"><Check size={14}/>Done</span>}</article>}
    {!result&&!pendingReview&&!currentMessages.length&&<div className="chat-empty"><Ryan status={state.status} size={106} agentId={chosen.id}/></div>}
    {currentMessages.map(m=><div className="message-pair" key={m.id}><div className="user-message"><p>{m.prompt}</p><span>{statusNames[m.status]||m.status}</span></div>{m.reply&&<div className="assistant-message"><div className="message-label"><span>✦</span>{chosen.name}</div><MessageContent text={m.reply}/></div>}</div>)}
    {mode==='working'&&<div className="typing-indicator" aria-label="Agent working"><i/><i/><i/></div>}
   </div>
   {error&&<p className="inline-error" role="alert">{error}</p>}
   <form className="prompt-composer" onSubmit={send}><textarea aria-label={`Message ${chosen.name}`} placeholder={chosen.id==='manager'?'Summarize, plan, or delegate…':`Message ${chosen.name}…`} value={drafts[chosen.id]||''} maxLength={4000} onChange={e=>setDrafts(v=>({...v,[chosen.id]:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();e.currentTarget.form?.requestSubmit();}}}/>{chosen.id==='designer'&&!unlock&&!profile&&!wardrobe&&!creatingAgent&&!boardOpen&&<DesignerVoiceInput disabled={sending} onBusyChange={setVoiceBusy} remainingChars={Math.max(0,4000-(drafts.designer?.length||0)-(drafts.designer?1:0))} onInsert={text=>setDrafts(current=>{const existing=current.designer||'';const next=(existing?existing+'\n':'')+text;return next.length<=4000?{...current,designer:next}:current;})}/>}<div className="composer-bottom">{chosen.thread?<a href={`codex://threads/${chosen.thread}`}><span className="codex-symbol">✳</span>Codex<ArrowUpRight size={11}/></a>:<span><span className="codex-symbol">✳</span>Manager · Codex</span>}<button className="send-button" type="submit" disabled={sending||chosen.id==='designer'&&voiceBusy||!drafts[chosen.id]?.trim()} aria-label="Send to Codex">{sending?<RefreshCw className="spin" size={16}/>:<Send size={17}/>}</button></div></form>
  </section>}
  {panel&&<section className={`floating-panel utility-panel ${panel==='workflow'?`wide-panel ${profileStyles.workflowWindow}`:panel==='stats'?'review-panel':''}`} role="dialog" aria-label={panel}><header className="panel-header"><h2>{panel==='activity'?'Activity':panel==='workflow'?'Workflows':panel==='stats'?'Reviews & shortcuts':'Settings'}</h2><button className="hud-button" aria-label="Close panel" onClick={()=>setPanel(null)}><X size={18}/></button></header>
   {panel==='workflow'&&<Workflow states={states} events={eventList} messages={messages} online={online} demo={demo} paused={paused||unlock||!!profile||!!wardrobe||creatingAgent||boardOpen} onSelect={choose} onCreate={()=>setCreatingAgent(true)}/>}
   {panel==='activity'&&<><div className="activity-filters"><label><Search size={15}/><input aria-label="Search activity" placeholder="Search" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Filter agent" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All</option>{agents.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div><div className="scroll-panel">{eventList.filter(e=>(filter==='all'||e.agentId===filter)&&e.label.toLowerCase().includes(query.toLowerCase())).map(e=><button className="event-row" key={e.id} onClick={()=>choose(e.agentId)}><i style={{background:agents.find(a=>a.id===e.agentId)?.color}}/><div><strong>{e.label}</strong><span>{agents.find(a=>a.id===e.agentId)?.name}</span></div><time>{relative(e.at,now)}</time></button>)}{!eventList.length&&<div className="empty-state">No activity</div>}</div></>}
   {panel==='stats'&&<ReviewSheet states={states} events={eventList} reviewed={reviews} completed={completions} online={online} pending={reviewing} onDone={(id,at)=>void review(id,at)} onSelect={choose} onPanel={openPanel}/>}
   {panel==='settings'&&<div className="settings-panel">{serviceError&&<p className="inline-error" role="status">{serviceError}</p>}<a className="setting-row" href="https://vercel.com/pangea6/~/settings/billing" target="_blank" rel="noopener noreferrer"><span>Usage alert</span><b>US$10 <ArrowUpRight size={12}/></b></a><div className="setting-row"><span><Radio size={16}/>Bridge</span><b className={online?'online-text':''}>{connection==='locked'?'Locked':online?'Online':'Offline'}</b></div><div className="setting-row"><span><Gamepad2 size={16}/>Demo</span><button role="switch" aria-checked={demo} aria-label="Demo mode" className={`toggle ${demo?'on':''}`} onClick={()=>{setDemo(d=>!d);setDemoEpoch(Date.now());setDemoReviewed({});setDemoCompleted({});}}><i/></button></div><div className="setting-row"><span>{night?<Moon size={16}/>:<Sun size={16}/>}Lighting</span><b>Automatic · SGT</b></div><div className="setting-row"><span><Pause size={16}/>Animations</span><button role="switch" aria-checked={!paused} aria-label="Animations" className={`toggle ${!paused?'on':''}`} onClick={()=>setPaused(v=>!v)}><i/></button></div><button className="settings-action" onClick={()=>void refresh()}><RefreshCw size={16}/>Refresh</button><button className="settings-action" onClick={lockOffice}><LogOut size={16}/>Lock</button><a className="settings-action" href="https://github.com/Ryanx-ai/ryancagents" target="_blank" rel="noreferrer"><GitBranch size={16}/>Source<ArrowUpRight size={13}/></a></div>}
  </section>}
  {error&&!selected&&!unlock&&<button className="toast" onClick={()=>setError('')}>{error}<X size={14}/></button>}
  </div>
  {!unlock&&boardOpen&&<Blackboard data={board.data} loading={board.loading} error={demo?"Switch off Demo to use your live blackboard.":board.error} busyIds={board.busyIds} onRefresh={()=>board.refresh()} onCreate={board.create} onUpdate={board.update} onClose={()=>setBoardOpen(false)}/>}
  {!unlock&&creatingAgent&&<AgentCreator onClose={()=>setCreatingAgent(false)}/>}
  {!unlock&&profileAgent&&<CharacterCard agent={profileAgent} onClose={()=>setProfile(null)} onWardrobe={()=>openWardrobe(profileAgent.id)}/>}
  {!unlock&&wardrobeAgent&&<Wardrobe key={wardrobeAgent.id} agent={wardrobeAgent} onClose={()=>setWardrobe(null)}/>}
  {unlock&&<div className="modal-scrim"><form className="unlock-dialog" role="dialog" aria-modal="true" aria-label="Unlock office" autoComplete="off" onSubmit={login}><header><LockKeyhole size={22}/><h2>Unlock office</h2></header><label>Office access key<input type="password" autoComplete="new-password" name="office-access" value={accessKey} onChange={e=>setAccessKey(e.target.value)} autoFocus required/></label><label>Personal access key<input type="password" autoComplete="new-password" name="personal-access" value={personalKey} onChange={e=>setPersonalKey(e.target.value)} required/></label><p className="unlock-protection"><LockKeyhole size={12}/>Bot-protected access</p>{error&&<p className="inline-error" role="alert">{error}</p>}<button className="primary-button" disabled={unlocking}>{unlocking?'Checking…':'Unlock'}<ArrowUpRight size={16}/></button></form></div>}

 </div>;
}
