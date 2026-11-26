'use client';
import {useEffect,useState,useCallback,useRef} from 'react';
import dynamic from 'next/dynamic';
import {Activity,GitBranch,SlidersHorizontal,Sun,Moon,Pause,Play,LockKeyhole,X,Send,Check,ArrowUpRight,BarChart3,Radio,Maximize,Minimize,Gamepad2,RefreshCw,Search,LogOut} from 'lucide-react';
import Office,{Ryan} from './Office';
import {agents,emptyAgents,type AgentId,type AgentState,type Snapshot} from '../lib/model';
import {avatarMode} from '../lib/game-state.mjs';
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
  {id:'outreach',status:'idle',activity:'Work session finished',updatedAt:completedAt,completedAt,result:'Outreach is complete. Ready for your review.'},
  {id:'contacts',status:step%3===0?'working':'idle',activity:step%3===0?'Researching contacts':'Ready for the next task',updatedAt:completedAt},
  {id:'manager',status:'idle',activity:'Ready for the next task',updatedAt:completedAt,result:'Inbox Ryan needs a calendar review. Outreach Ryan has finished. Network Ryan is researching contacts.'},
 ];return {version:1,observedAt:new Date().toISOString(),agents:states,events:states.map((a,i)=>({id:`demo-${i}`,agentId:a.id,at:completedAt,kind:i===1?'completed':i===0?'waiting':'contacts',label:a.activity,status:a.status}))};
}
export default function Dashboard(){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [connection,setConnection]=useState('loading');
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
 const [messages,setMessages]=useState<Message[]>([]);
 const [drafts,setDrafts]=useState<Record<string,string>>({});
 const [sending,setSending]=useState(false);
 const [error,setError]=useState('');
 const [unlock,setUnlock]=useState(false);
 const [accessKey,setAccessKey]=useState('');
 const [unlocking,setUnlocking]=useState(false);
 const [filter,setFilter]=useState('all');
 const [query,setQuery]=useState('');
 const [fullscreen,setFullscreen]=useState(false);
 const messageRequest=useRef<{id:string;agentId:AgentId;prompt:string}|null>(null);
 const refresh=useCallback(async()=>{
  try{
   const r=await fetch('/api/activity',{cache:'no-store'});if(r.status===401){setConnection('locked');setSnapshot(null);setMessages([]);return;}
   if(!r.ok)throw new Error();const data=await r.json();setConnection(data.connection);setSnapshot(data.snapshot);
   const extras=await Promise.allSettled([fetch('/api/review',{cache:'no-store'}),fetch('/api/messages',{cache:'no-store'})]);
   if(extras[0].status==='fulfilled'&&extras[0].value.ok)setReviewed(await extras[0].value.json());
   if(extras[1].status==='fulfilled'&&extras[1].value.ok)setMessages((await extras[1].value.json()).messages);
  }catch{setConnection('error');}
 },[]);
 useEffect(()=>{let active=true;const loop=async()=>{await refresh();if(active)timer=setTimeout(loop,10000);};let timer:ReturnType<typeof setTimeout>;void loop();return()=>{active=false;clearTimeout(timer);};},[refresh]);
 useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>{setNow(Date.now());setDemoStep(x=>x+1);},6000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{const changed=()=>setFullscreen(!!document.fullscreenElement);document.addEventListener('fullscreenchange',changed);const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setSelected(null);setPanel(null);setUnlock(false);}};window.addEventListener('keydown',escape);return()=>{document.removeEventListener('fullscreenchange',changed);window.removeEventListener('keydown',escape);};},[]);
 const visible=demo?demoData(demoStep,demoEpoch):snapshot;
 const online=demo||connection==='connected'&&!!snapshot&&now-Date.parse(snapshot.observedAt)<90000;
 const states=agents.map(a=>visible?.agents.find(s=>s.id===a.id)||emptyAgents.find(s=>s.id===a.id)!);
 const reviews=demo?demoReviewed:reviewed;
 const chosen=agents.find(a=>a.id===selected);
 const state=states.find(a=>a.id===selected);
 const mode=state?avatarMode(state,reviews,online):'idle';
 const attention=states.filter(a=>avatarMode(a,reviews,online)==='attention').length;
 const celebrations=states.filter(a=>avatarMode(a,reviews,online)==='celebrate').length;
 const eventList=visible?.events||[];
 const currentMessages=messages.filter(m=>m.agentId===selected);
 function choose(id:AgentId){setSelected(id);setPanel(null);setError('');}
 function openPanel(next:Panel){setPanel(p=>p===next?null:next);setSelected(null);setError('');}
 async function login(e:React.FormEvent){e.preventDefault();setUnlocking(true);setError('');try{const r=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:accessKey})});const d=await r.json();if(!r.ok)throw new Error(d.error);setUnlock(false);setAccessKey('');setDemo(false);await refresh();}catch(e){setError(e instanceof Error?e.message:'Could not unlock.');}finally{setUnlocking(false);}}
 async function review(){if(!state?.completedAt||!selected)return;if(demo){setDemoReviewed(v=>({...v,[selected]:state.completedAt!}));return;}setError('');try{const r=await fetch('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agentId:selected,completedAt:state.completedAt})});if(!r.ok)throw new Error((await r.json()).error);setReviewed(v=>({...v,[selected]:state.completedAt!}));}catch(e){setError(e instanceof Error?e.message:'Review failed.');}}
 async function send(e:React.FormEvent){e.preventDefault();if(!selected||!drafts[selected]?.trim()||sending)return;if(demo){setError('Switch to live to send.');return;}if(connection==='locked'){setUnlock(true);return;}setSending(true);setError('');
  const prompt=drafts[selected].trim();if(!messageRequest.current||messageRequest.current.prompt!==prompt||messageRequest.current.agentId!==selected)messageRequest.current={id:new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+crypto.randomUUID(),agentId:selected,prompt};
  try{const r=await fetch('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(messageRequest.current)});const message=await r.json();if(!r.ok)throw new Error(message.error);setMessages(v=>[...v.filter(m=>m.id!==message.id),message]);setDrafts(v=>({...v,[message.agentId]:''}));messageRequest.current=null;}catch(e){setError(e instanceof Error?e.message:'Message not sent.');}finally{setSending(false);}
 }
 async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{setError('Fullscreen is unavailable in this browser.');}}
 return <div className="game-shell">
  <Office states={states} selected={selected} onSelect={choose} night={night} paused={paused} reviewed={reviews} online={online}/>
  <div className="hud-top-left"><button className="hq-badge" onClick={()=>{setSelected(null);setPanel(null);}} aria-label="Office"><span>r.</span><strong>HQ</strong></button>{demo&&<button className="demo-badge" onClick={()=>setDemo(false)}>Demo <X size={12}/></button>}</div>
  <div className="hud-top-right"><button className={`signal-badge ${online?'connected':''}`} title={connection==='locked'?'Unlock office':online?'Bridge connected':'Bridge offline'} onClick={()=>connection==='locked'?setUnlock(true):openPanel('settings')}><i/>{connection==='locked'&&!demo?<LockKeyhole size={13}/>:<Radio size={14}/>}</button><Button label={night?'Daylight':'Nighttime'} onClick={()=>setNight(v=>!v)}>{night?<Sun size={18}/>:<Moon size={18}/>}</Button><Button label={fullscreen?'Exit fullscreen':'Fullscreen'} onClick={()=>void toggleFullscreen()}>{fullscreen?<Minimize size={17}/>:<Maximize size={17}/>}</Button></div>
  <div className="hud-bottom"><div className="agent-switcher">{agents.map(a=>{const s=states.find(s=>s.id===a.id)!;const m=avatarMode(s,reviews,online);return <button key={a.id} title={a.name} aria-label={`Select ${a.name}`} className={`avatar-shortcut ${selected===a.id?'active':''}`} onClick={()=>choose(a.id)} style={{'--agent-color':a.color} as React.CSSProperties}><Ryan size={54} still manager={a.id==='manager'}/><span className="shortcut-status">{m==='attention'?'!':m==='celebrate'?'★':m==='working'?'•':''}</span></button>;})}</div><div className="hud-dock"><Button label="Activity" active={panel==='activity'} badge={attention+celebrations} onClick={()=>openPanel('activity')}><Activity size={19}/></Button><Button label="Workflows" active={panel==='workflow'} onClick={()=>openPanel('workflow')}><GitBranch size={19}/></Button><Button label="Stats" active={panel==='stats'} onClick={()=>openPanel('stats')}><BarChart3 size={19}/></Button><span className="dock-divider"/><Button label={paused?'Resume animations':'Pause animations'} active={paused} onClick={()=>setPaused(v=>!v)}>{paused?<Play size={17}/>:<Pause size={17}/>}</Button><Button label="Settings" active={panel==='settings'} onClick={()=>openPanel('settings')}><SlidersHorizontal size={19}/></Button></div></div>
  {chosen&&state&&<section className="floating-panel chat-panel" role="dialog" aria-label={`Chat with ${chosen.name}`}>
   <header className="panel-header"><div className="chat-avatar" style={{'--agent-color':chosen.color} as React.CSSProperties}><Ryan size={54} still manager={chosen.id==='manager'}/></div><div><h2>{chosen.name}</h2><span className={`compact-status ${mode}`}>{!online?'Offline':mode==='celebrate'?'Ready for review':mode==='attention'?'Needs attention':mode==='working'?'Working':'Idle'}</span></div>{chosen.thread&&<a className="hud-button" href={`codex://threads/${chosen.thread}`} aria-label="Open original Codex chat" title="Open in Codex"><ArrowUpRight size={17}/></a>}<button className="hud-button" onClick={()=>setSelected(null)} aria-label="Close chat"><X size={18}/></button></header>
   <div className="chat-history">
    {state.result&&<article className={`agent-result ${mode==='celebrate'?'unreviewed':''}`}><div className="message-label"><span>{mode==='attention'?'!':mode==='celebrate'?'★':'✦'}</span><span>{chosen.name}</span><time>{relative(state.completedAt||state.updatedAt,now)}</time></div><p>{state.result}</p>{mode==='celebrate'&&<button className="review-button" onClick={()=>void review()}><Check size={16}/>Reviewed</button>}</article>}
    {!state.result&&!currentMessages.length&&<div className="chat-empty"><Ryan status={state.status} size={106} manager={chosen.id==='manager'}/></div>}
    {currentMessages.map(m=><div className="message-pair" key={m.id}><div className="user-message"><p>{m.prompt}</p><span>{statusNames[m.status]||m.status}</span></div>{m.reply&&<div className="assistant-message"><div className="message-label"><span>✦</span>{chosen.name}</div><p>{m.reply}</p></div>}</div>)}
    {mode==='working'&&<div className="typing-indicator" aria-label="Agent working"><i/><i/><i/></div>}
    {mode==='celebrate'&&!state.result&&<button className="review-button" onClick={()=>void review()}><Check size={16}/>Reviewed</button>}
   </div>
   {error&&<p className="inline-error" role="alert">{error}</p>}
   <form className="prompt-composer" onSubmit={send}><textarea aria-label={`Message ${chosen.name}`} placeholder={chosen.id==='manager'?'Summarize, plan, or delegate…':`Message ${chosen.name}…`} value={drafts[chosen.id]||''} maxLength={4000} onChange={e=>setDrafts(v=>({...v,[chosen.id]:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();e.currentTarget.form?.requestSubmit();}}}/><div className="composer-bottom">{chosen.thread?<a href={`codex://threads/${chosen.thread}`}><span className="codex-symbol">✳</span>Codex<ArrowUpRight size={11}/></a>:<span><span className="codex-symbol">✳</span>Manager · Codex</span>}<button className="send-button" type="submit" disabled={sending||!drafts[chosen.id]?.trim()} aria-label="Send to Codex">{sending?<RefreshCw className="spin" size={16}/>:<Send size={17}/>}</button></div></form>
  </section>}
  {panel&&<section className={`floating-panel utility-panel ${panel==='workflow'?'wide-panel':''}`} role="dialog" aria-label={panel}><header className="panel-header"><h2>{panel==='activity'?'Activity':panel==='workflow'?'Workflows':panel==='stats'?'Stats':'Settings'}</h2><button className="hud-button" aria-label="Close panel" onClick={()=>setPanel(null)}><X size={18}/></button></header>
   {panel==='workflow'&&<Workflow states={states} onSelect={choose}/>}
   {panel==='activity'&&<><div className="activity-filters"><label><Search size={15}/><input aria-label="Search activity" placeholder="Search" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Filter agent" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All</option>{agents.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div><div className="scroll-panel">{eventList.filter(e=>(filter==='all'||e.agentId===filter)&&e.label.toLowerCase().includes(query.toLowerCase())).map(e=><button className="event-row" key={e.id} onClick={()=>choose(e.agentId)}><i style={{background:agents.find(a=>a.id===e.agentId)?.color}}/><div><strong>{e.label}</strong><span>{agents.find(a=>a.id===e.agentId)?.name}</span></div><time>{relative(e.at,now)}</time></button>)}{!eventList.length&&<div className="empty-state">No activity</div>}</div></>}
   {panel==='stats'&&<div className="stats-panel"><div><strong>{online?states.filter(a=>a.status==='working').length:0}</strong><span>Working</span></div><div><strong>{attention}</strong><span>Attention</span></div><div><strong>{celebrations}</strong><span>To review</span></div><div><strong>{eventList.filter(e=>e.kind==='completed').length}</strong><span>Recent completions</span></div></div>}
   {panel==='settings'&&<div className="settings-panel"><div className="setting-row"><span><Radio size={16}/>Bridge</span><b className={online?'online-text':''}>{connection==='locked'?'Locked':online?'Online':'Offline'}</b></div><div className="setting-row"><span><Gamepad2 size={16}/>Demo</span><button role="switch" aria-checked={demo} aria-label="Demo mode" className={`toggle ${demo?'on':''}`} onClick={()=>{setDemo(d=>!d);setDemoEpoch(Date.now());setDemoReviewed({});}}><i/></button></div><div className="setting-row"><span>{night?<Moon size={16}/>:<Sun size={16}/>}Night</span><button role="switch" aria-checked={night} aria-label="Night mode" className={`toggle ${night?'on':''}`} onClick={()=>setNight(v=>!v)}><i/></button></div><div className="setting-row"><span><Pause size={16}/>Animations</span><button role="switch" aria-checked={!paused} aria-label="Animations" className={`toggle ${!paused?'on':''}`} onClick={()=>setPaused(v=>!v)}><i/></button></div><button className="settings-action" onClick={()=>void refresh()}><RefreshCw size={16}/>Refresh</button>{connection==='locked'?<button className="settings-action" onClick={()=>setUnlock(true)}><LockKeyhole size={16}/>Unlock</button>:<button className="settings-action" onClick={async()=>{await fetch('/api/session',{method:'DELETE'});await refresh();}}><LogOut size={16}/>Lock</button>}<a className="settings-action" href="https://github.com/Ryanx-ai/ryancagents" target="_blank" rel="noreferrer"><GitBranch size={16}/>Source<ArrowUpRight size={13}/></a></div>}
  </section>}
  {error&&!selected&&!unlock&&<button className="toast" onClick={()=>setError('')}>{error}<X size={14}/></button>}
  {unlock&&<div className="modal-scrim"><form className="unlock-dialog" role="dialog" aria-label="Unlock office" onSubmit={login}><header><LockKeyhole size={22}/><h2>Unlock</h2><button type="button" className="hud-button" aria-label="Close unlock" onClick={()=>setUnlock(false)}><X size={18}/></button></header><label>Access key<input type="password" autoComplete="current-password" value={accessKey} onChange={e=>setAccessKey(e.target.value)} autoFocus required/></label>{error&&<p className="inline-error">{error}</p>}<button className="primary-button" disabled={unlocking}>{unlocking?'Unlocking…':'Enter'}<ArrowUpRight size={16}/></button></form></div>}
 </div>;
}
