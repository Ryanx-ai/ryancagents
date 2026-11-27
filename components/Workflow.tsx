'use client';

import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import dynamic from 'next/dynamic';
import {ReactFlow,Background,Controls,Handle,Position,MarkerType,type Node,type NodeProps,type Edge} from '@xyflow/react';
import {ArrowLeft,ArrowUpRight,GitBranch,History,Info,MessageSquare,Plus,LockKeyhole,ShieldCheck,Waypoints,Zap} from 'lucide-react';
import '@xyflow/react/dist/style.css';
import {agents,type AgentId,type AgentState,type Activity} from '../lib/model';
import {workflowCatalog,type WorkflowStage} from '../lib/workflow-catalog';
import IntegrationLogo,{integrationMeta,type IntegrationName} from './IntegrationLogo';
import MessageContent from './MessageContent';
import {Ryan} from './Office';
import styles from './Workflow.module.css';

const PlanningMap=dynamic(()=>import('./PlanningMap'),{loading:()=> <p className={styles.loading}>Opening saved map…</p>});
const SandboxWorkflow=dynamic(()=>import('./SandboxWorkflow'),{loading:()=> <p className={styles.loading}>Opening sandbox…</p>,ssr:false});
type Receipt={id:string;agentId:AgentId;status:string;createdAt:string;pickedUpAt?:string;queuedAt?:string;deliveredAt?:string;repliedAt?:string};
type Props={states:AgentState[];events?:Activity[];messages?:Receipt[];online?:boolean;demo?:boolean;paused?:boolean;onSelect:(id:AgentId)=>void;onCreate?:()=>void};
type StageData={stage:WorkflowStage;color:string;incoming:Position;outgoing:Position;inspect:(id:string)=>void};
const capabilityNames={codex:'Codex task',local:'On this Mac',manual:'Ryan action',planned:'Planned'};
const stateNames:Record<string,string>={working:'Working',idle:'Idle',waiting:'Waiting',error:'Needs attention',offline:'Offline'};
const routeHints:Partial<Record<AgentId,string>>={scheduler:'Triage branches into opt-outs, scheduling or meeting-change alerts.',manager:'Status questions return a summary. Requested work goes through scope checks before delegation.',proposal:'Review can loop back to the same draft. PDF export requires your request.'};
const receiptNames:Record<string,string>={planning:'Planning request',pending:'Queued for Mac',queued:'Queued in Codex',delivered:'Delivered to chat',replied:'Reply received',uncertain:'Delivery uncertain · check chat',failed:'Delivery failed',expired:'Request expired'};

function StageNode({data,selected}:NodeProps<Node<StageData>>) {
 const {stage}=data;
 const Icon=stage.kind==='trigger'?Zap:stage.kind==='review'?ShieldCheck:stage.kind==='output'?ArrowUpRight:Waypoints;
 return <div style={{'--flow-accent':data.color} as CSSProperties}>
  <Handle type="target" position={data.incoming} isConnectable={false}/>
  {stage.id==='scheduler-output'&&<><Handle id="top" type="target" position={Position.Top} isConnectable={false}/><Handle id="bottom" type="target" position={Position.Bottom} isConnectable={false}/></>}
  {stage.id==='proposal-template'&&<Handle id="refine" type="target" position={Position.Bottom} isConnectable={false}/>}
  {stage.id==='manager-output'&&<Handle id="summary" type="target" position={Position.Top} isConnectable={false}/>}
  <button type="button" className={`${styles.stage} ${styles[stage.kind]||''} ${selected?styles.selected:''} nodrag`} onClick={()=>data.inspect(stage.id)} aria-label={`Inspect ${stage.label}`} aria-pressed={selected}>
   <span className={styles.stageKind}><Icon size={12}/>{stage.kind==='review'?'Review gate':stage.kind}</span>
   <span className={styles.stageMain}><span className={styles.serviceIcon}>{stage.connector?<IntegrationLogo name={stage.connector} size={27} decorative/>:<Icon size={25}/>}</span><strong>{stage.label}</strong></span>
   <span className={`${styles.capability} ${stage.capability==='planned'?styles.planned:''}`}>{capabilityNames[stage.capability]}</span>
  </button>
  <Handle type="source" position={data.outgoing} isConnectable={false}/>
  {stage.id==='proposal-review'&&<Handle id="refine" type="source" position={Position.Top} isConnectable={false}/>}
  {stage.id==='manager-context'&&<Handle id="summary" type="source" position={Position.Bottom} isConnectable={false}/>}
 </div>;
}
const nodeTypes={stage:StageNode};
function time(at?:string|null) {
 if(!at||!Number.isFinite(Date.parse(at)))return 'Not observed';
 return new Intl.DateTimeFormat('en-SG',{timeZone:'Asia/Singapore',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(at))+' SGT';
}

export default function Workflow(props:Props) {
 const [selection,setSelection]=useState<AgentId|'sandbox'>('scheduler');
 const [sketchbook,setSketchbook]=useState(false);
 const accent=selection==='sandbox'?'#b6c7d1':agents.find(a=>a.id===selection)!.color;
 if(sketchbook)return <section className={styles.sketchbook}><div className={styles.sketchHeader}><button onClick={()=>setSketchbook(false)}><ArrowLeft size={16}/>Agent workflows</button><span>Saved map · read only</span></div><PlanningMap states={props.states} onSelect={props.onSelect} online={props.online} paused={props.paused} onSandbox={()=>{setSketchbook(false);setSelection('sandbox');}}/></section>;
 return <section className={styles.workspace} aria-label="Agent workflows" style={{'--flow-accent':accent} as CSSProperties}>
  <nav className={styles.roster} aria-label="Workflow agents">
   <div className={styles.rosterTitle}><GitBranch size={16}/><span>Your agency</span></div>
   <div className={styles.agentList}>{agents.map(a=>{
    const status=props.online?props.states.find(s=>s.id===a.id)?.status||'offline':'offline';
    return <button key={a.id} className={`${styles.agent} ${a.id===selection?styles.activeAgent:''}`} onClick={()=>setSelection(a.id)} aria-pressed={a.id===selection} style={{'--flow-accent':a.color} as CSSProperties}><span className={styles.avatar}><Ryan agentId={a.id} size={42} still/></span><span><strong>{a.name.replace(' Ryan','')}</strong><small>{stateNames[status]}</small></span><i className={styles[status]} aria-hidden="true"/></button>;
   })}<button className={`${styles.agent} ${styles.sandboxAgent} ${selection==='sandbox'?styles.activeAgent:''}`} onClick={()=>setSelection('sandbox')} aria-pressed={selection==='sandbox'} aria-label="Dummy Ryan · Play sandbox"><span className={`${styles.avatar} ${styles.silhouette}`}><Ryan size={42} still/></span><span><strong>Dummy Ryan</strong><small>Play sandbox</small></span></button></div>
   <div className={styles.rosterActions}>{props.onCreate&&<button className={styles.create} onClick={props.onCreate}><Plus size={16}/>Add agent</button>}<button onClick={()=>setSketchbook(true)}><LockKeyhole size={14}/>Saved map</button></div>
  </nav>
  {selection==='sandbox'?<SandboxWorkflow/>:<AgentWorkflow key={selection} {...props} agentId={selection}/>}
 </section>;
}

function AgentWorkflow({agentId,states,events=[],messages=[],online=false,demo=false,paused=false,onSelect}:Props&{agentId:AgentId}) {
 const [selectedStage,setSelectedStage]=useState<string|null>(null);
 const [tab,setTab]=useState<'step'|'connections'|'history'>('step');
 const [wide,setWide]=useState(false);
 useEffect(()=>{const media=window.matchMedia('(min-width: 801px)');const update=()=>setWide(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 const inspectorRef=useRef<HTMLElement>(null);
 const agent=agents.find(a=>a.id===agentId)!;
 const definition=workflowCatalog[agentId];
 const stage=definition.stages.find(s=>s.id===selectedStage)||definition.stages[0];
 const state=states.find(s=>s.id===agentId);
 const status=online?state?.status||'offline':'offline';
 const moving=online&&status==='working'&&!paused;
 const connectors=[...new Set(definition.stages.map(s=>s.connector).filter(Boolean))] as IntegrationName[];
 const history=[...events.filter(e=>e.agentId===agentId).map(e=>({id:`event-${e.id}`,at:e.at,label:e.label,detail:'Observed activity'})),...messages.filter(m=>m.agentId===agentId).map(m=>{const at=m.status==='replied'?m.repliedAt:m.status==='delivered'?m.deliveredAt:m.status==='queued'?m.queuedAt:m.status==='planning'?m.pickedUpAt:undefined;return {id:`message-${m.id}`,at:at||m.createdAt,label:receiptNames[m.status]||'Request status unknown',detail:at?'Prompt receipt':'Request created'};})].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,20);
 const {nodes,edges}=useMemo(()=>{
  const inspect=(id:string)=>{setSelectedStage(id);setTab('step');};
  const nodes:Node<StageData>[]=definition.stages.map((s,i)=>{
   const row=Math.floor(i/3),reverse=row%2===1,col=reverse?2-i%3:i%3;
   const incoming=i>0&&i%3===0?Position.Top:reverse?Position.Right:Position.Left;
   const outgoing=i%3===2?Position.Bottom:reverse?Position.Left:Position.Right;
   return {id:s.id,type:'stage',initialWidth:206,initialHeight:126,position:{x:col*306,y:row*190},data:{stage:s,color:agent.color,incoming,outgoing,inspect},selected:s.id===stage.id,draggable:false,connectable:false,deletable:false};
  });
  let routes=definition.stages.slice(1).map((s,i)=>({source:definition.stages[i].id,target:s.id,label:''}));
  if(agentId==='scheduler') {
   const positions:Record<string,{x:number;y:number}>={'scheduler-trigger':{x:0,y:190},'scheduler-read':{x:276,y:190},'scheduler-exclusions':{x:552,y:0},'scheduler-availability':{x:552,y:190},'scheduler-book':{x:828,y:190},'scheduler-attention':{x:552,y:380},'scheduler-output':{x:1104,y:190}};
   nodes.forEach(n=>{n.position=positions[n.id];n.data.incoming=Position.Left;n.data.outgoing=Position.Right;});
   routes=[['scheduler-trigger','scheduler-read',''],['scheduler-read','scheduler-exclusions','Opt-out'],['scheduler-read','scheduler-availability','Scheduling'],['scheduler-read','scheduler-attention','Meeting change'],['scheduler-availability','scheduler-book','Eligible'],['scheduler-exclusions','scheduler-output',''],['scheduler-book','scheduler-output',''],['scheduler-attention','scheduler-output','Unresolved alerts']].map(([source,target,label])=>({source,target,label}));
  }
  if(agentId==='manager'){routes=routes.map(r=>r.target==='manager-plan'?{...r,label:'Requested work'}:r);routes.push({source:'manager-context',target:'manager-output',label:'Status only'});}
  if(agentId==='proposal') {
   routes=routes.map(r=>r.target==='proposal-output'?{...r,label:'Export requested'}:r);
   routes.push({source:'proposal-review',target:'proposal-template',label:'Refine same draft'});
  }
  const edges:Edge[]=routes.map(r=>({...r,
   ...(r.source==='scheduler-exclusions'&&r.target==='scheduler-output'?{targetHandle:'top'}:{}),
   ...(r.source==='scheduler-attention'&&r.target==='scheduler-output'?{targetHandle:'bottom'}:{}),
   ...(r.source==='proposal-review'&&r.target==='proposal-template'?{sourceHandle:'refine',targetHandle:'refine'}:{}),
   ...(r.source==='manager-context'&&r.target==='manager-output'?{sourceHandle:'summary',targetHandle:'summary'}:{}),
   id:`${r.source}-${r.target}`,type:'smoothstep',reconnectable:false,deletable:false,animated:moving,className:`${styles.activityEdge} ${moving?styles.flowing:''}`,markerEnd:{type:MarkerType.ArrowClosed,color:agent.color,width:14,height:14},style:{stroke:agent.color,strokeWidth:2,opacity:moving?.95:.55},labelStyle:{fill:'#d4e0e7',fontSize:10},labelBgStyle:{fill:'#20313d',fillOpacity:.95},labelBgPadding:[6,4],labelBgBorderRadius:4}));
  return {nodes,edges};
 },[definition,agent.color,stage.id,agentId,moving]);
 return <div className={styles.content}>
   <header className={styles.header}><div><h3>{agent.name}</h3><p>{definition.intent}</p></div><button className={styles.chat} onClick={()=>onSelect(agentId)}><MessageSquare size={15}/><span>Chat</span></button></header>
   <div className={styles.runtime}><span className={`${styles.status} ${styles[status]}`}>{demo?'Demo · ':''}{stateNames[status]}</span><span className={styles.progress}>{online&&status==='working'?(state?.progress||state?.activity||'Working in Codex'):online&&status==='error'?'Check the original chat for the error.':online&&status==='waiting'?'Check the latest context in chat.':status==='offline'?'Agent activity unavailable':online?'Ready for the next task':'Live activity unavailable'}</span><span className={styles.observed}>{time(state?.updatedAt)}</span></div>
   <div className={styles.workArea}>
    <div className={styles.graphArea}>
     <div className={styles.graphLabel}><span><LockKeyhole size={11}/>Read-only workflow</span><span>{definition.stages.length} steps</span></div>
     <div className={styles.mobileSteps} aria-label="Workflow steps">{routeHints[agentId]&&<p className={styles.routeHint}>{routeHints[agentId]}</p>}{definition.stages.map((item,i)=><button key={item.id} aria-pressed={stage.id===item.id} onClick={()=>{setSelectedStage(item.id);setTab('step');inspectorRef.current?.scrollIntoView({block:'start'});}}><span>{i+1}</span>{item.connector&&<IntegrationLogo name={item.connector} size={21} decorative/>}<strong>{item.label}</strong><small>{item.kind==='review'?'Review gate':capabilityNames[item.capability]}</small><ArrowUpRight size={13}/></button>)}</div>
     <div className={styles.canvas}>{wide&&<ReactFlow key={agentId} nodes={nodes} edges={edges} nodeTypes={nodeTypes} nodesDraggable={false} nodesConnectable={false} edgesFocusable={false} deleteKeyCode={null} fitView fitViewOptions={{padding:'5%',maxZoom:1}} minZoom={.35} maxZoom={1.5} zoomOnDoubleClick={false} onNodeClick={(_,node)=>{setSelectedStage(node.id);setTab('step');}}><Background gap={22} size={1} color="#52616c"/><Controls showInteractive={false}/></ReactFlow>}</div>
     <p className={styles.graphNote}><Info size={13}/>Moving dots mean this agent is working. Individual steps are not tracked.{paused?' Animation paused.':''}</p>
    </div>
    <aside ref={inspectorRef} className={styles.inspector} aria-label={`${agent.name} workflow details`}>
     <div className={styles.tabs} aria-label="Workflow details">{(['step','connections','history'] as const).map(t=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t==='step'?'Step':t==='connections'?'Connections':'History'}</button>)}</div>
     <div className={styles.inspectorBody}>
      {tab==='step'&&<><span className={styles.detailKind}>{stage.kind==='review'?'Review gate':stage.kind}</span><h4>{stage.label}</h4><p>{stage.detail}</p><span className={styles.detailBadge}>{capabilityNames[stage.capability]}</span><dl><dt>Input</dt><dd>{stage.inputs.join(' · ')}</dd><dt>Output</dt><dd>{stage.outputs.join(' · ')}</dd>{stage.reviewGate&&<><dt><ShieldCheck size={13}/>Review gate</dt><dd>{stage.reviewGate}</dd></>}</dl><details className={styles.details}><summary>Workflow scope</summary><p><strong>Starts with</strong><br/>{definition.trigger}</p><p><strong>Produces</strong><br/>{definition.outputs.join(' · ')}</p>{definition.limitations.map(l=><p key={l}>{l}</p>)}<small>Source review: {definition.lastVerified}</small></details></>}
      {tab==='connections'&&<><h4>Tools & account scope</h4><p>{definition.accountScope}</p><div className={styles.connectorList}>{connectors.map(c=><div className={styles.connector} key={c}><IntegrationLogo name={c} size={25} decorative/><div><strong>{integrationMeta[c].label}</strong><small>{c==='codex'?'Existing agent chat':c==='studio'?'Local application · this Mac':'Access managed in Codex'}</small></div><a href={c==='codex'?`codex://threads/${agent.thread}`:integrationMeta[c].href} aria-label={`Open ${integrationMeta[c].label}`} target={c==='codex'?undefined:'_blank'} rel="noopener noreferrer"><ArrowUpRight size={16}/></a></div>)}</div><p className={styles.scopeNote}>Logos identify tools. This dashboard cannot verify account permissions or connection health.</p>{definition.limitations.map(l=><p className={styles.limit} key={l}>{l}</p>)}<details className={styles.details}><summary>Source references</summary>{definition.evidence.map(e=><p key={e.source}><strong>{e.label}</strong><br/><span className={styles.source}>{e.source}</span></p>)}<small>Reviewed {definition.lastVerified}</small></details></>}
      {tab==='history'&&<><h4><History size={16}/>Recent activity</h4><p>Bridge events and prompt receipts{demo?' from the demo':''}.</p>{!online&&<p className={styles.scopeNote}>The bridge is offline. Saved events may be out of date.</p>}{history.length?<ol className={styles.history}>{history.map(e=><li key={e.id}><strong>{e.label}</strong><span>{e.detail}</span><time>{time(e.at)}</time></li>)}</ol>:<p className={styles.empty}>No activity recorded yet. Open the agent’s chat to start a task.</p>}{state?.result&&<details className={styles.details}><summary>Latest response</summary><MessageContent text={state.result}/></details>}<button className={styles.openChat} onClick={()=>onSelect(agentId)}>Open {agent.name} chat<ArrowUpRight size={15}/></button></>}
     </div>
    </aside>
   </div>
  </div>;
}
