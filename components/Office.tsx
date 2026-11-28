"use client";
import {useEffect,useRef,useState} from 'react';
import {agents,emptyAgents,type AgentState,type AgentId,type Status} from '../lib/model';
import {avatarMode,needsReview,nextCompletionCue,ambientStep,activityBubble} from '../lib/game-state.mjs';
import {getOfficeTime} from '../lib/office-time.mjs';
import {boardTimeLabel,type BoardNote} from '../lib/board-view';
import styles from './Office.module.css';
import {useWardrobe} from './WardrobeProvider';
import {useRyanSheet} from './useRyanSheet';
import type {Palette} from '../lib/wardrobe.mjs';
import dayPlate from '../public/office/ryan-hq-day.webp';
import nightPlate from '../public/office/ryan-hq-night.webp';

const places:Record<AgentId,{home:number;floor:'upstairs'|'downstairs'}>={
 scheduler:{home:19,floor:'downstairs'},outreach:{home:39,floor:'downstairs'},contacts:{home:59,floor:'downstairs'},
 manager:{home:29,floor:'upstairs'},designer:{home:69,floor:'upstairs'},
 proposal:{home:79,floor:'downstairs'},
};
export function Ryan({status='idle',size=132,still=false,pose,manager=false,agentId,palette}:{status?:Status;size?:number;still?:boolean;pose?:string;manager?:boolean;agentId?:AgentId;palette?:Palette|null}) {
 const savedPalette=useWardrobe(agentId);
 const kind=agentId==='designer'?'designer':agentId==='manager'||manager?'manager':'standard';
 const state=pose||status;
 const row=state==='walk-right'?1:state==='walk-left'?2:state==='wave'?3:state==='celebrate'?4:state==='working'?7:state==='attention'||state==='waiting'?6:state==='error'?5:state==='review'?8:state==='look-up'?9:state==='look-down'?10:0;
 const sheet=useRyanSheet(kind,palette===undefined?savedPalette:palette,still,row);
 const frames=row===3?4:row===4?5:[1,2,5,9,10].includes(row)?8:6;
 return <span aria-hidden="true" className={`ryan-sprite ${still?'still':''}`} style={{width:size,height:size*208/192,backgroundImage:`url(${sheet.url})`,backgroundSize:sheet.cropped?`${size}px ${size*208/192}px`:`${size*8}px ${size*208/192*11}px`,backgroundPositionY:sheet.cropped?0:-row*size*208/192,'--frame-end':`${-size*frames}px`,'--frames':frames} as React.CSSProperties}/>;
}
function DigitalClock({onNightChange}:{onNightChange:(night:boolean)=>void}) {
 const [time,setTime]=useState('--:--:--');
 const lastNight=useRef<boolean|null>(null);
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>;
  const tick=()=>{
   clearTimeout(timer);
   const current=getOfficeTime();
   setTime(current.time);
   if(lastNight.current!==current.night){lastNight.current=current.night;onNightChange(current.night);}
   if(document.visibilityState==='visible')timer=setTimeout(tick,1000-Date.now()%1000);
  };
  const onVisibility=()=>{if(document.visibilityState==='visible')tick();else clearTimeout(timer);};
  tick();document.addEventListener('visibilitychange',onVisibility);
  return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',onVisibility);};
 },[onNightChange]);
 return <g className="office-clock" transform="translate(513 170)" role="img" aria-label={`Singapore time ${time}`} aria-live="off">
  <rect x="-73" y="-29" width="146" height="58" rx="4" fill="#75634f"/>
  <rect x="-69" y="-25" width="138" height="50" rx="2" fill="#1d292c" stroke="#9b8261" strokeWidth="1"/>
  <text className="office-clock-digits" textAnchor="middle" y="1">{time}</text>
  <text className="office-clock-zone" textAnchor="middle" y="17">SGT</text>
 </g>;
}
// Screen interiors stay registered to the Blender desk anchors. Furniture lives
// in the plate; only these small status displays update with agent activity.
function Monitor({x,y,agentId,color,active=false,kind='worker'}:{x:number;y:number;agentId:AgentId;color:string;active?:boolean;kind?:'worker'|'manager'|'designer'}) {
 return <g transform={`translate(${x} ${y})`} data-desk={kind} data-desk-state="occupied" data-agent={agentId}>
  <rect x="1" y="-103" width={kind==='designer'?63:53} height="32" fill={active?'#233c42':'#29313b'}/>
  {kind==='designer'?<g opacity={active?1:.55}><rect x="7" y="-97" width="16" height="19" fill="#c6a7df"/><rect x="27" y="-97" width="29" height="5" fill="#9cbcae"/><path d="M27-87H50M27-81H44" stroke="#c9be9d" strokeWidth="3"/></g>:<path d="M8-94H29M8-86H44M8-78H35" stroke={color} strokeWidth="3" opacity={active?.9:.3}/>}
 </g>;
}

function Actor({agent,index,state,mode,pendingReview,online,selected,onSelect,onProfile,paused}:{agent:typeof agents[number];index:number;state:AgentState;mode:string;pendingReview:boolean;online:boolean;selected:boolean;onSelect:()=>void;onProfile:()=>void;paused:boolean}) {
 const {home,floor}=places[agent.id];
 const [x,setX]=useState(home);const [ambient,setAmbient]=useState('idle');
 const [walkDuration,setWalkDuration]=useState(4200);
 const position=useRef(home);const sequence=useRef(0);const actor=useRef<HTMLDivElement>(null);
 const [cue,setCue]=useState<{seen:string|null;until:number}>();
 useEffect(()=>{if(online)setCue(previous=>nextCompletionCue(previous,state.completedAt,Date.now()));},[state.completedAt,online]);
 useEffect(()=>{if(!cue?.until)return;const timer=setTimeout(()=>setCue(previous=>previous?{...previous,until:0}:previous),Math.max(0,cue.until-Date.now()));return()=>clearTimeout(timer);},[cue?.until]);
 const celebrating=mode==='review'&&!!cue?.until&&cue.seen===state.completedAt;
 const visualMode=celebrating?'celebrate':mode;
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const stop=()=>{clearTimeout(timer);setAmbient('idle');};
  const freeze=()=>{const el=actor.current;if(el?.parentElement){const frozen=parseFloat(getComputedStyle(el).left)/el.parentElement.clientWidth*100;if(Number.isFinite(frozen)){setX(frozen);position.current=frozen;}}stop();};
  if(!['idle','offline','review'].includes(visualMode)){setX(home);position.current=home;setAmbient('idle');return;}
  if(paused||selected){freeze();return;}
  const act=()=>{const next=ambientStep(index,sequence.current++,position.current);setWalkDuration(next.duration);setAmbient(next.pose);setX(next.x);position.current=next.x;timer=setTimeout(act,next.duration);};
  const motionChanged=()=>{freeze();if(!reduced.matches)act();};
  if(reduced.matches)freeze();else timer=setTimeout(act,200+index*450);
  reduced.addEventListener('change',motionChanged);
  return()=>{clearTimeout(timer);reduced.removeEventListener('change',motionChanged);};
 },[visualMode,home,index,paused,selected]);
 const pose=celebrating?'celebrate':mode==='attention'?'attention':mode==='working'?'working':ambient;
 const bubble=activityBubble(state,online);
 return <div ref={actor} className={`world-ryan ${styles.actor} ${floor} ${agent.id} ${visualMode} ${mode==='review'&&!celebrating?'settled-review':''} ${selected?'selected':''}`} style={{left:`${x}%`,'--agent-color':agent.color,'--walk-duration':`${walkDuration}ms`,'--sprite-duration':pose==='idle'?'2.4s':pose.startsWith('walk')?'.85s':'1.2s'} as React.CSSProperties} role="group" aria-label={agent.name} data-pose={pose} data-floor={floor}>
  <button type="button" className={styles.chatHit} onClick={onSelect} aria-label={`Talk to ${agent.name}${mode==='attention'?', needs attention':pendingReview?', ready for review':''}`}/>
  {mode==='attention'&&<span className="attention-marker" aria-label="Needs attention">!</span>}
  {celebrating&&<><span className="yay-marker">yay!</span><span className="confetti" aria-hidden="true">{Array.from({length:8},(_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}/>)}</span></>}
  {pendingReview&&!celebrating&&mode!=='attention'&&mode!=='working'&&<span className="review-marker" aria-label="Ready for review">★</span>}
  {bubble&&<span className="thought-bubble" role="status"><span className="bubble-text">{bubble}</span></span>}
  <span className="sprite-shadow"/><Ryan status={state.status} size={112} pose={pose} still={paused} agentId={agent.id}/>
  <span className={`actor-name ${styles.nameplate}`}><i aria-hidden="true"/><span>{agent.name}</span><button type="button" className={styles.profileButton} onClick={onProfile} aria-label={`View ${agent.name} profile`} aria-haspopup="dialog" title={`View ${agent.name} profile`}><span aria-hidden="true">i</span></button></span>
 </div>;
}
export default function Office({states,selected,onSelect,onProfile,night,onNightChange,paused,reviewed,online=true,boardNotes=[],boardDay='',onBoard}:{states:AgentState[];selected:AgentId|null;onSelect:(id:AgentId)=>void;onProfile:(id:AgentId)=>void;night:boolean;onNightChange:(night:boolean)=>void;paused:boolean;reviewed:Record<string,string>;online?:boolean;boardNotes?:BoardNote[];boardDay?:string;onBoard?:()=>void}) {
 const camera=useRef<HTMLDivElement>(null);
 const boardDate=boardDay?new Intl.DateTimeFormat('en-SG',{timeZone:'Asia/Singapore',day:'numeric',month:'short'}).format(new Date(`${boardDay}T00:00:00+08:00`)):'';
 useEffect(()=>{if(selected&&camera.current){const el=camera.current;el.scrollTo({left:el.scrollWidth*places[selected].home/100-el.clientWidth/2,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}},[selected]);
 const working=(id:AgentId)=>states.find(s=>s.id===id)?.status==='working';
 return <div ref={camera} className={`office-camera ${night?'night':'day'} ${paused?'motion-paused':''}`}><div className="office-world office-world--duplex">
  <svg className={`world-art ${styles.scene}`} viewBox="0 0 1100 800" preserveAspectRatio="none" role="img" aria-label="A two-storey office. Inbox Ryan, Outreach Ryan, Network Ryan, and Proposal Ryan have four desks downstairs. Manager Ryan and Designer Ryan have desks upstairs, beside a staircase.">
   <image href={night?nightPlate.src:dayPlate.src} width="1100" height="800" preserveAspectRatio="none"/>
   <g transform="translate(513 118)"><rect x="-73" y="-11" width="146" height="26" rx="2" fill="#292e34" stroke="#73634c"/><text className="office-sign-lettering" textAnchor="middle" y="6">Ryan HQ</text></g>
   <DigitalClock onNightChange={onNightChange}/>
   <Monitor x={319} y={297} agentId="manager" color="#efdab0" active={working('manager')} kind="manager"/>
   <Monitor x={759} y={297} agentId="designer" color="#c6a7df" active={working('designer')} kind="designer"/>
   {(['scheduler','outreach','contacts','proposal'] as const).map(id=><Monitor key={id} x={places[id].home*11} y={598} agentId={id} color={agents.find(a=>a.id===id)!.color} active={working(id)}/>)}
  </svg>
  {onBoard&&<button type="button" className={styles.blackboard} onClick={onBoard} aria-label={`Open today's blackboard${boardDate?`, ${boardDate}, Singapore time`:''}${boardNotes.length?`, ${boardNotes.filter(note=>!note.done).length} open notes`:''}`} aria-haspopup="dialog"><span className={styles.boardTitle}>Today {boardDate&&<time dateTime={boardDay}>{boardDate}</time>}</span><span className={styles.boardPapers}>{boardNotes.slice(0,4).map((note,i)=><span key={note.id} className={`${styles.boardPaper} ${note.done?styles.paperDone:''}`} style={{'--paper-tilt':`${i%2?3:-3}deg`,'--paper-color':({yellow:'#f0d98f',peach:'#eab9a0',mint:'#bbd3b0',blue:'#b7cfdc',lavender:'#cfc0dc'} as Record<string,string>)[note.color||'yellow']||'#f0d98f'} as React.CSSProperties}>{note.calendar&&<span className={styles.boardPaperTime}>{note.calendar.allDay?'All day':boardTimeLabel(note.calendar.start)}</span>}<span className={styles.boardPaperText}>{note.title}</span></span>)}{!boardNotes.length&&<span className={styles.boardEmpty}>Pin a note <span>+</span></span>}</span><span className={styles.chalk}/></button>}
  {agents.map((agent,index)=>{const state=states.find(a=>a.id===agent.id)||emptyAgents.find(a=>a.id===agent.id)!;return <Actor key={agent.id} agent={agent} index={index} state={state} mode={avatarMode(state,reviewed,online)} pendingReview={needsReview(state,reviewed)} online={online} selected={selected===agent.id} onSelect={()=>onSelect(agent.id)} onProfile={()=>onProfile(agent.id)} paused={paused}/>;})}
  <div className="world-vignette"/>
 </div></div>;
}
