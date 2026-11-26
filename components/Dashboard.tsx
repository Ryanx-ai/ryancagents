'use client';
import {useEffect,useState,useCallback,useRef} from 'react';
import dynamic from 'next/dynamic';
import {Activity,GitBranch,SlidersHorizontal,Sun,Moon,Pause,Play,LockKeyhole,X,Send,Check,ArrowUpRight,BarChart3,Radio,Maximize,Minimize,Gamepad2,RefreshCw,Search,LogOut} from 'lucide-react';
import Office,{Ryan} from './Office';
import MessageContent from './MessageContent';
import ReviewSheet from './ReviewSheet';
import {completionKey,completionRows} from '../lib/completions.mjs';
import {agents,emptyAgents,type AgentId,type AgentState,type Snapshot} from '../lib/model';
import {avatarMode,needsReview,mergeReviews} from '../lib/game-state.mjs';
const Workflow=dynamic(()=>import('./Workflow'),{loading:()=> <div className="panel-loading"><RefreshCw className="spin" size={22}/></div>});
const statusNames:Record<string,string>={planning:'Planning',pending:'Queued for Mac',queued:'Queued in Codex',delivered:'Delivered',replied:'Replied',uncertain:'Check Codex before retrying',failed:'Failed',expired:'Expired'};
type Message={id:string;agentId:AgentId;prompt:string;status:string;reply?:string;createdAt:string};
type Panel='activity'|'workflow'|'stats'|'settings'|null;
function relative(at:string|null|undefined,now:number){if(!at)return '—';const sec=Math.max(0,Math.floor((now-Date.parse(at))/1000));return sec<60?'now':sec<3600?`${Math.floor(sec/60)}m`:sec<86400?`${Math.floor(sec/3600)}h`:`${Math.floor(sec/86400)}d`;}
function Button({label,active=false,onClick,children,badge}:{label:string;active?:boolean;onClick:()=>void;children:React.ReactNode;badge?:number}){return <button className={`hud-button ${active?'active':''}`} title={label} aria-label={label} aria-pressed={active} onClick={onClick}>{children}{!!badge&&<span className="button-badge">{badge}</span>}</button>;}
function demoData(step:number,epoch:number):Snapshot {
 const completedAt=new Date(epoch).toISOString();
 const states:AgentState[]=[
  {id:'scheduler',status:'waiting',activity:'Waiting for input',updatedAt:completedAt,attentionAt:completedAt,result:'A calendar conflict needs your review.'},
  {id:'outreach',status:'idle',activity:'Work session finished',updatedAt:completedAt,completedAt,result:'Outreach is complete. **Three drafts** are ready for your review.\n\n### Next steps\n\n- Review the messages in [Gmail drafts](https://mail.google.com/mail/u/0/#drafts).\n- Confirm the contact list before sending.\n\nNothing has been sent in this demo.'},
  {id:'contacts',status:step%3===0?'working':'idle',activity:step%3===0?'Researching contacts':'Ready for the next task',updatedAt:completedAt},
  {id:'manager',status:'idle',activity:'Ready for the next task',updatedAt:completedAt,completedAt,result:'Your office has **two items to review**.\n\n### Inbox\n\n- A calendar conflict needs your decision. [Open calendar](https://calendar.google.com/calendar/u/0/r).\n- Review the proposed time before replying.\n\n### Outreach\n\nThree drafts are ready. [Open drafts](https://mail.google.com/mail/u/0/#drafts).\n\n### Network\n\nContact research is in progress.'},
 ];return {version:1,observedAt:new Date().toISOString(),agents:states,events:states.map((a,i)=>({id:`demo-${i}`,agentId:a.id,at:completedAt,kind:i===1?'completed':i===0?'waiting':'contacts',label:a.activity,status:a.status}))};
}
export default function Dashboard(){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [connection,setConnection]=useState('locked');
 const [selected,setSelected]=useState<AgentId|null>(null);
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
 const [error,setError]=useState('');
 const [sessionToken,setSessionToken]=useState<string|null>(null);
 const tokenRef=useRef<string|null>(null);
 const authEpoch=useRef(0);
 const unlock=!sessionToken;
 const [personalKey,setPersonalKey]=useState('');
 const [accessKey,setAccessKey]=useState('');
 const [unlocking,setUnlocking]=useState(false);
 const [filter,setFilter]=useState('all');
 const [query,setQuery]=useState('');
 const [fullscreen,setFullscreen]=useState(false);
 const messageRequest=useRef<{id:string;agentId:AgentId;prompt:string}|null>(null);
 const lockOffice=useCallback(()=>{authEpoch.current++;tokenRef.current=null;setSending(false);setUnlocking(false);setSessionToken(null);setConnection('locked');setSnapshot(null);setMessages([]);setReviewed({});setCompleted({});setDemoCompleted({});setReviewing({});setDrafts({});setSelected(null);setPanel(null);setDemo(false);setAccessKey('');setPersonalKey('');messageRequest.current=null;},[]);
 const request=useCallback(async(url:string,init:RequestInit={})=>{
  const token=tokenRef.current;if(!token)throw new Error('Unlock the office first.');
  const r=await fetch(url,{...init,headers:{...init.headers,Authorization:`Bearer ${token}`}});
  if(tokenRef.current!==token)throw new Error('Session ended.');
  if(r.status===401){lockOffice();throw new Error('Unlock the office again.');}return r;
 },[lockOffice]);
 const refresh=useCallback(async()=>{
  const token=tokenRef.current;if(!token)return;
  try{
   const responses=await Promise.all([request('/api/activity',{cache:'no-store'}),request('/api/review?details=1',{cache:'no-store'})]);
   const [activity,reviews]=await Promise.all(responses.map(async r=>r.ok?r.json():null));
   if(tokenRef.current!==token)return;
   if(!activity)throw new Error();setConnection(activity.connection);setSnapshot(activity.snapshot);
   if(reviews){setReviewed(current=>mergeReviews(current,reviews.reviewed));setCompleted(current=>({...current,...reviews.completed}));}
  }catch{if(tokenRef.current===token)setConnection('error');}
 },[request]);
 useEffect(()=>{if(!sessionToken)return;let active=true;const loop=async()=>{await refresh();if(active)timer=setTimeout(loop,10000);};let timer:ReturnType<typeof setTimeout>;void loop();return()=>{active=false;clearTimeout(timer);};},[refresh,sessionToken]);
 const waitingForReply=messages.some(m=>['pending','planning','queued','delivered'].includes(m.status));
 useEffect(()=>{if(!sessionToken)return;let active=true;let timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{try{const r=await request('/api/messages',{cache:'no-store'});if(r.ok){const data=await r.json();if(active&&tokenRef.current===sessionToken)setMessages(data.messages);}}catch{}if(active)timer=setTimeout(poll,waitingForReply?1500:10000);};
  void poll();return()=>{active=false;clearTimeout(timer);};
 },[sessionToken,waitingForReply,request]);
 useEffect(()=>{const restored=(e:PageTransitionEvent)=>{if(e.persisted)lockOffice();};window.addEventListener('pageshow',restored);return()=>window.removeEventListener('pageshow',restored);},[lockOffice]);
 useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>{setNow(Date.now());setDemoStep(x=>x+1);},6000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{const changed=()=>setFullscreen(!!document.fullscreenElement);document.addEventListener('fullscreenchange',changed);const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setSelected(null);setPanel(null);}};window.addEventListener('keydown',escape);return()=>{document.removeEventListener('fullscreenchange',changed);window.removeEventListener('keydown',escape);};},[]);
 const visible=demo?demoData(demoStep,demoEpoch):snapshot;
 const online=demo||connection==='connected'&&!!snapshot&&now-Date.parse(snapshot.observedAt)<90000;
 const states=agents.map(a=>visible?.agents.find(s=>s.id===a.id)||emptyAgents.find(s=>s.id===a.id)!);
 const reviews=demo?demoReviewed:reviewed;
 const completions=demo?demoCompleted:completed;
 const chosen=agents.find(a=>a.id===selected);
 const state=states.find(a=>a.id===selected);
 const mode=state?avatarMode(state,reviews,online):'idle';
 const attention=states.filter(a=>avatarMode(a,reviews,online)==='attention').length;
 const celebrations=states.filter(a=>needsReview(a,reviews)).length;
 const pendingReview=state?needsReview(state,reviews):false;
 const eventList=visible?.events||[];
 const toReview=completionRows(states,eventList,reviews,completions).filter(r=>!r.done).length;
 const currentMessages=messages.filter(m=>m.agentId===selected);
 function choose(id:AgentId){setSelected(id);setPanel(null);setError('');}
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
 async function send(e:React.FormEvent){e.preventDefault();if(!selected||!drafts[selected]?.trim()||sending)return;if(demo){setError('Switch to live to send.');return;}if(!sessionToken)return;const epoch=authEpoch.current;setSending(true);setError('');
  const prompt=drafts[selected].trim();if(!messageRequest.current||messageRequest.current.prompt!==prompt||messageRequest.current.agentId!==selected)messageRequest.current={id:new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+crypto.randomUUID(),agentId:selected,prompt};
  try{const r=await request('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(messageRequest.current)});const message=await r.json();if(authEpoch.current!==epoch)return;if(!r.ok)throw new Error(message.error);setMessages(v=>[...v.filter(m=>m.id!==message.id),message]);setDrafts(v=>({...v,[message.agentId]:''}));messageRequest.current=null;}catch(e){if(authEpoch.current===epoch)setError(e instanceof Error?e.message:'Message not sent.');}finally{if(authEpoch.current===epoch)setSending(false);}
 }
 async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{setError('Fullscreen is unavailable in this browser.');}}
 return <div className={`game-shell ${unlock?'office-locked':''}`}><div className="office-stage" inert={unlock} aria-hidden={unlock?true:undefined}>
  <Office states={states} selected={selected} onSelect={choose} night={night} paused={paused||unlock} reviewed={reviews} online={online}/>
  <div className="hud-top-left"><button className="hq-badge" onClick={()=>{setSelected(null);setPanel(null);}} aria-label="Office"><span>r.</span><strong>HQ</strong></button>{demo&&<button className="demo-badge" onClick={()=>setDemo(false)}>Demo <X size={12}/></button>}</div>
  <div className="hud-top-right"><button className={`signal-badge ${online?'connected':''}`} title={connection==='locked'?'Unlock office':online?'Bridge connected':'Bridge offline'} onClick={()=>openPanel('settings')}><i/>{connection==='locked'&&!demo?<LockKeyhole size={13}/>:<Radio size={14}/>}</button><Button label={night?'Daylight':'Nighttime'} onClick={()=>setNight(v=>!v)}>{night?<Sun size={18}/>:<Moon size={18}/>}</Button><Button label={fullscreen?'Exit fullscreen':'Fullscreen'} onClick={()=>void toggleFullscreen()}>{fullscreen?<Minimize size={17}/>:<Maximize size={17}/>}</Button></div>
  <div className="hud-bottom"><div className="agent-switcher">{agents.map(a=>{const s=states.find(s=>s.id===a.id)!;const m=avatarMode(s,reviews,online);return <button key={a.id} title={a.name} aria-label={`Select ${a.name}`} className={`avatar-shortcut ${selected===a.id?'active':''}`} onClick={()=>choose(a.id)} style={{'--agent-color':a.color} as React.CSSProperties}><Ryan size={54} still manager={a.id==='manager'}/><span className="shortcut-status">{m==='attention'?'!':needsReview(s,reviews)?'★':m==='working'?'•':''}</span></button>;})}</div><div className="hud-dock"><Button label="Activity" active={panel==='activity'} badge={attention+celebrations} onClick={()=>openPanel('activity')}><Activity size={19}/></Button><Button label="Workflows" active={panel==='workflow'} onClick={()=>openPanel('workflow')}><GitBranch size={19}/></Button><Button label="Stats" badge={toReview} active={panel==='stats'} onClick={()=>openPanel('stats')}><BarChart3 size={19}/></Button><span className="dock-divider"/><Button label={paused?'Resume animations':'Pause animations'} active={paused} onClick={()=>setPaused(v=>!v)}>{paused?<Play size={17}/>:<Pause size={17}/>}</Button><Button label="Settings" active={panel==='settings'} onClick={()=>openPanel('settings')}><SlidersHorizontal size={19}/></Button></div></div>
  {chosen&&state&&<section className="floating-panel chat-panel" role="dialog" aria-label={`Chat with ${chosen.name}`}>
   <header className="panel-header"><div className="chat-avatar" style={{'--agent-color':chosen.color} as React.CSSProperties}><Ryan size={54} still manager={chosen.id==='manager'}/></div><div><h2>{chosen.name}</h2><span className={`compact-status ${mode}`}>{!online?'Offline':mode==='review'?'Ready for review':mode==='attention'?'Needs attention':mode==='working'?'Working':'Idle'}</span></div>{chosen.thread&&<a className="hud-button" href={`codex://threads/${chosen.thread}`} aria-label="Open original Codex chat" title="Open in Codex"><ArrowUpRight size={17}/></a>}<button className="hud-button" onClick={()=>setSelected(null)} aria-label="Close chat"><X size={18}/></button></header>
   <div className="chat-history">
    {state.result&&<article className={`agent-result ${pendingReview?'unreviewed':''}`}><div className="message-label"><span>{mode==='attention'?'!':pendingReview?'★':'✦'}</span><span>{chosen.name}</span><time>{relative(state.completedAt||state.updatedAt,now)}</time></div><MessageContent text={state.result}/>{pendingReview?<button className="review-button" disabled={!!reviewing[completionKey(state.id,state.completedAt)||'']} onClick={()=>void review()}><Check size={16}/>Mark done</button>:state.completedAt&&<span className="done-receipt"><Check size={14}/>Done</span>}</article>}
    {!state.result&&!currentMessages.length&&<div className="chat-empty"><Ryan status={state.status} size={106} manager={chosen.id==='manager'}/></div>}
    {currentMessages.map(m=><div className="message-pair" key={m.id}><div className="user-message"><p>{m.prompt}</p><span>{statusNames[m.status]||m.status}</span></div>{m.reply&&<div className="assistant-message"><div className="message-label"><span>✦</span>{chosen.name}</div><MessageContent text={m.reply}/></div>}</div>)}
    {mode==='working'&&<div className="typing-indicator" aria-label="Agent working"><i/><i/><i/></div>}
    {pendingReview&&!state.result&&<button className="review-button" disabled={!!reviewing[completionKey(state.id,state.completedAt)||'']} onClick={()=>void review()}><Check size={16}/>Mark done</button>}
   </div>
   {error&&<p className="inline-error" role="alert">{error}</p>}
   <form className="prompt-composer" onSubmit={send}><textarea aria-label={`Message ${chosen.name}`} placeholder={chosen.id==='manager'?'Summarize, plan, or delegate…':`Message ${chosen.name}…`} value={drafts[chosen.id]||''} maxLength={4000} onChange={e=>setDrafts(v=>({...v,[chosen.id]:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();e.currentTarget.form?.requestSubmit();}}}/><div className="composer-bottom">{chosen.thread?<a href={`codex://threads/${chosen.thread}`}><span className="codex-symbol">✳</span>Codex<ArrowUpRight size={11}/></a>:<span><span className="codex-symbol">✳</span>Manager · Codex</span>}<button className="send-button" type="submit" disabled={sending||!drafts[chosen.id]?.trim()} aria-label="Send to Codex">{sending?<RefreshCw className="spin" size={16}/>:<Send size={17}/>}</button></div></form>
  </section>}
  {panel&&<section className={`floating-panel utility-panel ${panel==='workflow'?'wide-panel':panel==='stats'?'review-panel':''}`} role="dialog" aria-label={panel}><header className="panel-header"><h2>{panel==='activity'?'Activity':panel==='workflow'?'Workflows':panel==='stats'?'Reviews & shortcuts':'Settings'}</h2><button className="hud-button" aria-label="Close panel" onClick={()=>setPanel(null)}><X size={18}/></button></header>
   {panel==='workflow'&&<Workflow states={states} onSelect={choose}/>}
   {panel==='activity'&&<><div className="activity-filters"><label><Search size={15}/><input aria-label="Search activity" placeholder="Search" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Filter agent" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All</option>{agents.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div><div className="scroll-panel">{eventList.filter(e=>(filter==='all'||e.agentId===filter)&&e.label.toLowerCase().includes(query.toLowerCase())).map(e=><button className="event-row" key={e.id} onClick={()=>choose(e.agentId)}><i style={{background:agents.find(a=>a.id===e.agentId)?.color}}/><div><strong>{e.label}</strong><span>{agents.find(a=>a.id===e.agentId)?.name}</span></div><time>{relative(e.at,now)}</time></button>)}{!eventList.length&&<div className="empty-state">No activity</div>}</div></>}
   {panel==='stats'&&<ReviewSheet states={states} events={eventList} reviewed={reviews} completed={completions} online={online} pending={reviewing} onDone={(id,at)=>void review(id,at)} onSelect={choose} onPanel={openPanel}/>}
   {panel==='settings'&&<div className="settings-panel"><div className="setting-row"><span><Radio size={16}/>Bridge</span><b className={online?'online-text':''}>{connection==='locked'?'Locked':online?'Online':'Offline'}</b></div><div className="setting-row"><span><Gamepad2 size={16}/>Demo</span><button role="switch" aria-checked={demo} aria-label="Demo mode" className={`toggle ${demo?'on':''}`} onClick={()=>{setDemo(d=>!d);setDemoEpoch(Date.now());setDemoReviewed({});setDemoCompleted({});}}><i/></button></div><div className="setting-row"><span>{night?<Moon size={16}/>:<Sun size={16}/>}Night</span><button role="switch" aria-checked={night} aria-label="Night mode" className={`toggle ${night?'on':''}`} onClick={()=>setNight(v=>!v)}><i/></button></div><div className="setting-row"><span><Pause size={16}/>Animations</span><button role="switch" aria-checked={!paused} aria-label="Animations" className={`toggle ${!paused?'on':''}`} onClick={()=>setPaused(v=>!v)}><i/></button></div><button className="settings-action" onClick={()=>void refresh()}><RefreshCw size={16}/>Refresh</button><button className="settings-action" onClick={lockOffice}><LogOut size={16}/>Lock</button><a className="settings-action" href="https://github.com/Ryanx-ai/ryancagents" target="_blank" rel="noreferrer"><GitBranch size={16}/>Source<ArrowUpRight size={13}/></a></div>}
  </section>}
  {error&&!selected&&!unlock&&<button className="toast" onClick={()=>setError('')}>{error}<X size={14}/></button>}
  </div>
  {unlock&&<div className="modal-scrim"><form className="unlock-dialog" role="dialog" aria-modal="true" aria-label="Unlock office" autoComplete="off" onSubmit={login}><header><LockKeyhole size={22}/><h2>Unlock office</h2></header><label>Office access key<input type="password" autoComplete="new-password" name="office-access" value={accessKey} onChange={e=>setAccessKey(e.target.value)} autoFocus required/></label><label>Personal access key<input type="password" autoComplete="new-password" name="personal-access" value={personalKey} onChange={e=>setPersonalKey(e.target.value)} required/></label><p className="unlock-protection"><LockKeyhole size={12}/>Bot-protected access</p>{error&&<p className="inline-error" role="alert">{error}</p>}<button className="primary-button" disabled={unlocking}>{unlocking?'Checking…':'Unlock'}<ArrowUpRight size={16}/></button></form></div>}

 </div>;
}
