"use client";
import {useEffect,useRef,useState} from 'react';
import {agents,emptyAgents,type AgentState,type AgentId,type Status} from '../lib/model';
import {avatarMode,needsReview,nextCompletionCue,ambientStep,activityBubble} from '../lib/game-state.mjs';

const places:Record<AgentId,{home:number;floor:'upstairs'|'downstairs'}>={
 scheduler:{home:19,floor:'downstairs'},outreach:{home:39,floor:'downstairs'},contacts:{home:59,floor:'downstairs'},
 manager:{home:29,floor:'upstairs'},designer:{home:69,floor:'upstairs'},
};
export function Ryan({status='idle',size=132,still=false,pose,manager=false,agentId}:{status?:Status;size?:number;still?:boolean;pose?:string;manager?:boolean;agentId?:AgentId}) {
 const state=pose||status;
 const row=state==='walk-right'?1:state==='walk-left'?2:state==='wave'?3:state==='celebrate'?4:state==='working'?7:state==='attention'||state==='waiting'?6:state==='error'?5:state==='review'?8:state==='look-up'?9:state==='look-down'?10:0;
 const frames=row===3?4:row===4?5:[1,2,5,9,10].includes(row)?8:6;
 const sheet=agentId==='designer'?'/assets/designer-ryan.png':agentId==='manager'||manager?'/assets/manager-ryan-sheet.png':'/assets/maple-ryan.png';
 return <span aria-hidden="true" className={`ryan-sprite ${still?'still':''}`} style={{width:size,height:size*208/192,backgroundImage:`url(${sheet})`,backgroundSize:`${size*8}px ${size*208/192*11}px`,backgroundPositionY:-row*size*208/192,'--frame-end':`${-size*frames}px`,'--frames':frames} as React.CSSProperties}/>;
}
function Plant({x,y,scale=1}:{x:number;y:number;scale?:number}) {
 return <g transform={`translate(${x} ${y}) scale(${scale})`}><path d="M-13 0H13L9 26H-9Z" fill="#987450"/><path d="M-16 0H16V6H-16Z" fill="#bc9567"/><path d="M0 1V-48M0-17L-18-36M0-26L19-46" stroke="#47745e" strokeWidth="4"/><path d="M-3-29Q-31-25-27-48Q-5-48-3-29M1-38Q2-67 18-61Q28-45 1-38M3-19Q31-42 28-19Q20-9 3-19M-2-10Q-31-11-24-28Q-7-32-2-10" fill="#4f846c"/><path d="M-3-29L-22-44M2-39L15-55" stroke="#78a885" strokeWidth="2"/></g>;
}
function Window({x,y,w=236,h=134,moon=false}:{x:number;y:number;w?:number;h?:number;moon?:boolean}) {
 return <g transform={`translate(${x} ${y})`}><rect x="-7" y="-7" width={w+14} height={h+14} fill="#403f46"/><svg width={w} height={h} overflow="hidden"><rect width={w} height={h} fill="url(#sky)"/>{moon&&<circle cx={w-42} cy="27" r="15" fill="#f0d6a3" opacity=".8"/>}{Array.from({length:Math.ceil(w/31)},(_,n)=><g key={n}><rect x={n*31} y={h-55+(n%3)*10} width="25" height="66" fill={n%2?'#262e40':'#30384a'}/>{[0,1,2].map(k=><rect key={k} x={n*31+6} y={h-43+(n%3)*10+k*14} width="4" height="5" fill="#ba9668" opacity={n%2?.4:.7}/>)}</g>)}</svg><path d={`M${w/2} 0V${h}M0 ${h/2}H${w}`} stroke="#44434a" strokeWidth="6"/><path d={`M0 3H${w}M3 0V${h}`} stroke="#72706a" strokeWidth="3"/><rect x="-11" y={h} width={w+22} height="8" fill="#77706a"/></g>;
}
function Pendant({x,y}:{x:number;y:number}) {
 return <g transform={`translate(${x} ${y})`}><path d="M0 0V18" stroke="#20252a" strokeWidth="3"/><path d="M-29 31L-14 18H14L29 31Z" fill="#72736b"/><path d="M-26 32H26" stroke="#ead3a1" strokeWidth="3"/><ellipse cy="37" rx="36" ry="10" fill="#eac98d" opacity=".15" filter="url(#glow)"/></g>;
}
function DigitalClock() {
 const [time,setTime]=useState('--:--:--');
 useEffect(()=>{
  const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Singapore',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  let timer:ReturnType<typeof setTimeout>;
  const tick=()=>{
   clearTimeout(timer);
   setTime(formatter.format(new Date()));
   if(document.visibilityState==='visible')timer=setTimeout(tick,1000-Date.now()%1000);
  };
  const onVisibility=()=>{if(document.visibilityState==='visible')tick();else clearTimeout(timer);};
  tick();document.addEventListener('visibilitychange',onVisibility);
  return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',onVisibility);};
 },[]);
 return <g className="office-clock" transform="translate(513 170)" role="img" aria-label={`Singapore time ${time}`} aria-live="off">
  <rect x="-73" y="-29" width="146" height="58" rx="4" fill="#75634f"/>
  <rect x="-69" y="-25" width="138" height="50" rx="2" fill="#1d292c" stroke="#9b8261" strokeWidth="1"/>
  <text className="office-clock-digits" textAnchor="middle" y="1">{time}</text>
  <text className="office-clock-zone" textAnchor="middle" y="17">SGT</text>
 </g>;
}
function Desk({x,y,color,active=false,kind='worker',empty=false}:{x:number;y:number;color:string;active?:boolean;kind?:'worker'|'manager'|'designer';empty?:boolean}) {
 return <g transform={`translate(${x} ${y})`} data-desk={kind} data-desk-state={empty?'empty':'occupied'}>
  <ellipse cy="-1" rx="85" ry="9" fill="#15181d" opacity=".36"/>
  <path d="M-30-58Q-30-72-15-72H8Q22-72 22-58V-17H-30Z" fill={empty?'#4b5359':'#596365'}/><rect x="-26" y="-22" width="50" height="8" rx="3" fill="#777a70"/><path d="M-1-14V-2M-20-1H18" stroke="#303638" strokeWidth="4"/>
  <rect x="-79" y="-53" width="161" height="10" fill={kind==='manager'?'#b89872':'#ac8967'}/><rect x="-76" y="-43" width="155" height="6" fill="#644f40"/><path d="M-69-37V0M70-37V0" stroke="#39373a" strokeWidth="8"/><path d="M-69-16H70" stroke="#413b37" strokeWidth="4"/>
  <rect x="-4" y="-108" width={kind==='designer'?73:63} height="43" rx="3" fill="#1d232b" stroke="#6c6f77" strokeWidth="3"/><rect x="1" y="-103" width={kind==='designer'?63:53} height="32" fill={active?'#233c42':empty?'#252c32':'#29313b'}/>
  {!empty&&(kind==='designer'?<g opacity={active?1:.55}><rect x="7" y="-97" width="16" height="19" fill="#c6a7df"/><rect x="27" y="-97" width="29" height="5" fill="#9cbcae"/><path d="M27-87H50M27-81H44" stroke="#c9be9d" strokeWidth="3"/></g>:<path d="M8-94H29M8-86H44M8-78H35" stroke={color} strokeWidth="3" opacity={active?.9:.3}/>)}
  <path d="M28-64V-56M15-54H43" stroke="#747579" strokeWidth="5"/><rect x="-13" y="-58" width="32" height="4" fill="#5a616a"/>
  {!empty&&<><rect x="61" y="-67" width="10" height="13" fill={color}/><path d="M71-64H75V-58H71" fill="none" stroke={color} strokeWidth="2"/></>}
  <rect x="-61" y="-59" width="28" height="5" fill="#d5cdb6"/><rect x="-58" y="-63" width="23" height="4" fill={kind==='designer'?'#a891b7':'#a1a69e'}/>
  <path d="M-64-65V-104L-49-117" stroke="#88877b" fill="none" strokeWidth="3"/><path d="M-56-118L-43-125L-34-114L-48-107Z" fill="#b8aa82"/><path d="M-48-107L-72-61H-18L-34-114Z" fill="url(#lamp)" opacity={empty?.12:.3}/>
  {kind==='manager'&&<g><rect x="-54" y="-37" width="35" height="32" fill="#695747"/><path d="M-51-23H-23" stroke="#443e37" strokeWidth="2"/><path d="M-41-28H-32M-41-13H-32" stroke="#b69b72" strokeWidth="2"/></g>}
  {kind==='designer'&&<g><path d="M-32-66H-7L-4-56H-34Z" fill="#343c48" stroke="#b9a6cd"/><path d="M-21-65L-10-74" stroke="#b1b6bd" strokeWidth="2"/></g>}
 </g>;
}
function Bookcase({x,y}:{x:number;y:number}) {
 return <g transform={`translate(${x} ${y})`}><rect x="-27" width="58" height="112" fill="#705b49"/><rect x="-22" y="5" width="48" height="102" fill="#3a3432"/>{[0,1,2].map(i=><g key={i} transform={`translate(0 ${i*34})`}><rect x="-22" y="33" width="48" height="4" fill="#8c7054"/>{[0,1,2,3,4].map(j=><rect key={j} x={-18+j*8} y={9+(j%2)*4} width="6" height={24-(j%2)*4} fill={['#959b87','#a27761','#747b90','#b6a47d','#6c8980'][j]}/>)}</g>)}</g>;
}

function Actor({agent,index,state,mode,pendingReview,online,selected,onSelect,paused}:{agent:typeof agents[number];index:number;state:AgentState;mode:string;pendingReview:boolean;online:boolean;selected:boolean;onSelect:()=>void;paused:boolean}) {
 const {home,floor}=places[agent.id];
 const [x,setX]=useState(home);const [ambient,setAmbient]=useState('idle');
 const [walkDuration,setWalkDuration]=useState(4200);
 const position=useRef(home);const sequence=useRef(0);const actor=useRef<HTMLButtonElement>(null);
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
 return <button ref={actor} className={`world-ryan ${floor} ${agent.id} ${visualMode} ${mode==='review'&&!celebrating?'settled-review':''} ${selected?'selected':''}`} style={{left:`${x}%`,'--agent-color':agent.color,'--walk-duration':`${walkDuration}ms`,'--sprite-duration':pose==='idle'?'2.4s':pose.startsWith('walk')?'.85s':'1.2s'} as React.CSSProperties} onClick={onSelect} aria-label={`Talk to ${agent.name}${mode==='attention'?', needs attention':pendingReview?', ready for review':''}`} data-pose={pose} data-floor={floor}>
  {mode==='attention'&&<span className="attention-marker" aria-label="Needs attention">!</span>}
  {celebrating&&<><span className="yay-marker">yay!</span><span className="confetti" aria-hidden="true">{Array.from({length:8},(_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}/>)}</span></>}
  {pendingReview&&!celebrating&&mode!=='attention'&&mode!=='working'&&<span className="review-marker" aria-label="Ready for review">★</span>}
  {bubble&&<span className="thought-bubble" role="status"><span className="bubble-label">Activity</span><span className="bubble-text">{bubble}</span></span>}
  <span className="sprite-shadow"/><Ryan status={state.status} size={112} pose={pose} still={paused} agentId={agent.id}/>
  <span className="actor-name"><i/>{agent.name}</span>
 </button>;
}
export default function Office({states,selected,onSelect,night,paused,reviewed,online=true}:{states:AgentState[];selected:AgentId|null;onSelect:(id:AgentId)=>void;night:boolean;paused:boolean;reviewed:Record<string,string>;online?:boolean}) {
 const camera=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(selected&&camera.current){const el=camera.current;el.scrollTo({left:el.scrollWidth*places[selected].home/100-el.clientWidth/2,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}},[selected]);
 const working=(id:AgentId)=>states.find(s=>s.id===id)?.status==='working';
 return <div ref={camera} className={`office-camera ${night?'night':'day'} ${paused?'motion-paused':''}`}><div className="office-world office-world--duplex">
  <svg className="world-art" viewBox="0 0 1100 800" preserveAspectRatio="none" role="img" aria-label="A two-storey pixel office. Four desks downstairs, including one empty desk. Manager Ryan and Designer Ryan have desks upstairs, beside a staircase.">
   <defs>
    <linearGradient id="sky" x2="0" y2="1"><stop stopColor={night?'#252c47':'#859fa6'}/><stop offset="1" stopColor={night?'#83645f':'#dfc6a0'}/></linearGradient>
    <linearGradient id="wall" x2="0" y2="1"><stop stopColor="#454449"/><stop offset="1" stopColor="#34383e"/></linearGradient>
    <linearGradient id="lamp" x2="0" y2="1"><stop stopColor="#ffe2a3" stopOpacity=".7"/><stop offset="1" stopColor="#ffe2a3" stopOpacity="0"/></linearGradient>
    <pattern id="bricks" width="70" height="36" patternUnits="userSpaceOnUse"><path d="M0 36H70M35 0V36" fill="none" stroke="#555057" strokeWidth="1" opacity=".3"/></pattern>
    <pattern id="floor" width="96" height="20" patternUnits="userSpaceOnUse"><rect width="96" height="20" fill="#665444"/><path d="M0 19H96M48 0V19" stroke="#483f37" strokeWidth="2"/><path d="M6 6H37M61 12H88" stroke="#8b7055" opacity=".3"/></pattern>
    <filter id="glow"><feGaussianBlur stdDeviation="4"/></filter>
   </defs>
   <rect width="1100" height="800" fill="#22272f"/>
   <rect x="33" y="43" width="1034" height="757" fill="url(#wall)"/><rect x="33" y="43" width="1034" height="535" fill="url(#bricks)"/>
   <path d="M33 42H1067V56H33Z" fill="#736653"/><path d="M33 57H1067" stroke="#b59769" strokeOpacity=".25" strokeWidth="3"/>
   <Window x={152} y={94} w={264} h={132}/><Window x={606} y={94} w={264} h={132} moon/>
   <Pendant x={319} y={56}/><Pendant x={759} y={56}/>
   <rect x="33" y="281" width="956" height="48" fill="url(#floor)"/><path d="M26 280H995" stroke="#b09069" strokeWidth="7"/>
   <rect x="26" y="328" width="969" height="23" fill="#493d34"/><path d="M26 329H995" stroke="#c1a27d" strokeWidth="5"/><path d="M33 348H991" stroke="#262b2e" strokeWidth="7"/>
   <Bookcase x={103} y={171}/><Plant x={453} y={268} scale={.8}/><Plant x={912} y={268} scale={.8}/>
   <DigitalClock/>
   <g transform="translate(926 110)"><rect width="49" height="91" fill="#847462"/><rect x="5" y="5" width="39" height="81" fill="#554f4a"/>{['#c6a7df','#8bc6aa','#efb66d','#a6b5ff'].map((color,i)=><g key={color} transform={`translate(${10+i%2*18} ${13+Math.floor(i/2)*30})`}><rect width="13" height="21" fill="#e1d7c0"/><rect y="4" width="13" height="13" fill={color}/><circle cx="6" cy="1" r="2" fill="#c0aa7e"/></g>)}</g>
   <Desk x={319} y={297} color="#efdab0" active={working('manager')} kind="manager"/><Desk x={759} y={297} color="#c6a7df" active={working('designer')} kind="designer"/>
   {[119,339,559,779].map((x,i)=><Window key={x} x={x} y={395} w={160} h={120} moon={i===2}/>)}
   {[209,429,649,869].map(x=><Pendant key={x} x={x} y={351}/>)}
   <path d="M53 57V328M1047 57V800M53 353V800" stroke="#524942" strokeWidth="23"/><path d="M46 57V328M1041 57V800M46 353V800" stroke="#7f6b52" strokeWidth="4"/>
   <rect x="33" y="580" width="1034" height="220" fill="url(#floor)"/><path d="M26 579H1074" stroke="#b09069" strokeWidth="7"/>
   <g aria-hidden="true"><path d="M976 594L1057 318" stroke="#383a3b" strokeWidth="11"/>{Array.from({length:12},(_,i)=><g key={i}><rect x={970+i*7} y={592-i*24} width="34" height="6" fill="#a38766"/><path d={`M${974+i*7} ${592-i*24}V${562-i*24}`} stroke="#747a75" strokeWidth="3"/></g>)}<path d="M973 562L1053 286" stroke="#c0ae87" strokeWidth="4"/><path d="M989 282H1065" stroke="#c0ae87" strokeWidth="4"/></g>
   {(['scheduler','outreach','contacts'] as const).map(id=><Desk key={id} x={places[id].home*11} y={598} color={agents.find(a=>a.id===id)!.color} active={working(id)}/>)}
   <Desk x={869} y={598} color="#939fa6" empty/>
   <Plant x={95} y={570} scale={.8}/><Plant x={946} y={567} scale={.65}/>
   <g transform="translate(549 367)"><rect x="-65" y="-9" width="130" height="22" rx="2" fill="#292e34" stroke="#73634c"/><text className="office-sign-lettering" textAnchor="middle" y="6">Ryan HQ</text></g>
   <g transform="translate(123 697)"><ellipse cx="59" cy="43" rx="96" ry="18" fill="#332c2b" opacity=".35"/><rect x="-20" y="-20" width="146" height="47" rx="6" fill="#798578"/><path d="M29-15V25M77-15V25" stroke="#525e54" strokeWidth="3"/><rect x="-25" y="9" width="156" height="30" rx="5" fill="#626b63"/><rect x="-27" y="-1" width="15" height="38" rx="4" fill="#939889"/><rect x="118" y="-1" width="15" height="38" rx="4" fill="#939889"/><rect x="5" y="-7" width="23" height="23" rx="3" fill="#bc9c76"/><path d="M-9 39V48M114 39V48" stroke="#302d2c" strokeWidth="7"/></g>
   <g transform="translate(925 683)"><rect x="-36" y="0" width="78" height="65" rx="3" fill="#62574e"/><rect x="-33" y="4" width="72" height="13" fill="#b3a18b"/><path d="M-31 31H37M-31 49H37" stroke="#39352f" strokeWidth="3"/><path d="M-4 23H11M-4 41H11M-4 59H11" stroke="#b6a48b" strokeWidth="2"/><rect x="-18" y="-36" width="35" height="35" rx="3" fill="#242d32"/><rect x="-13" y="-31" width="25" height="12" fill="#5c6f6d"/><rect x="-9" y="-12" width="18" height="10" fill="#d0bfa1"/></g>
   <Plant x={1030} y={735} scale={1.15}/><Plant x={61} y={747} scale={.85}/>
  </svg>
  {agents.map((agent,index)=>{const state=states.find(a=>a.id===agent.id)||emptyAgents.find(a=>a.id===agent.id)!;return <Actor key={agent.id} agent={agent} index={index} state={state} mode={avatarMode(state,reviewed,online)} pendingReview={needsReview(state,reviewed)} online={online} selected={selected===agent.id} onSelect={()=>onSelect(agent.id)} paused={paused}/>;})}
  <div className="world-vignette"/>
 </div></div>;
}
