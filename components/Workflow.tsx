'use client';

import {useCallback,useEffect,useId,useMemo,useRef,useState,type CSSProperties} from 'react';
import dynamic from 'next/dynamic';
import {ReactFlow,Background,Controls,Handle,Position,MarkerType,type Node,type NodeProps,type Edge,type ReactFlowInstance} from '@xyflow/react';
import {ArrowLeft,ArrowUpRight,GitBranch,History,Info,MessageSquare,Plus,LockKeyhole,PanelRightClose,PanelRightOpen,Shield,ShieldCheck,Waypoints,Zap} from 'lucide-react';
import '@xyflow/react/dist/style.css';
import {agents,type AgentId,type AgentState,type Activity} from '../lib/model';
import {workflowCatalog,type WorkflowStage} from '../lib/workflow-catalog';
import {workflowRules} from '../lib/workflow-rules';
import WorkflowRules from './WorkflowRules';
import {workflowGraphs,workflowOutgoing,workflowRouteMoves,workflowDiagramLabel,type WorkflowPort} from '../lib/workflow-graphs';
import IntegrationLogo,{integrationMeta,type IntegrationName} from './IntegrationLogo';
import MessageContent from './MessageContent';
import {Ryan} from './Office';
import styles from './Workflow.module.css';

const PlanningMap=dynamic(()=>import('./PlanningMap'),{loading:()=> <p className={styles.loading}>Opening saved map…</p>});
const SandboxWorkflow=dynamic(()=>import('./SandboxWorkflow'),{loading:()=> <p className={styles.loading}>Opening sandbox…</p>,ssr:false});
type Receipt={id:string;agentId:AgentId;status:string;createdAt:string;pickedUpAt?:string;queuedAt?:string;deliveredAt?:string;repliedAt?:string};
type Props={states:AgentState[];events?:Activity[];messages?:Receipt[];online?:boolean;demo?:boolean;paused?:boolean;onSelect:(id:AgentId)=>void;onCreate?:()=>void};
type StageData={stage:WorkflowStage;color:string;incoming:WorkflowPort[];outgoing:WorkflowPort[];inspect:(id:string)=>void;openWorkflow:(id:AgentId)=>void;ruleCount:number;openRules:(id:string|null)=>void};
const inspectorTabs=['step','rules','connections','history'] as const;
type InspectorTab=typeof inspectorTabs[number];
const ports={left:Position.Left,right:Position.Right,top:Position.Top,bottom:Position.Bottom};
const capabilityNames={codex:'Codex task',local:'On this Mac',manual:'Ryan action',planned:'Planned'};
const stateNames:Record<string,string>={working:'Working',idle:'Idle',waiting:'Waiting',error:'Needs attention',offline:'Offline'};
const receiptNames:Record<string,string>={planning:'Planning request',pending:'Queued for Mac',queued:'Queued in Codex',delivered:'Delivered to chat',replied:'Reply received',uncertain:'Delivery uncertain · check chat',failed:'Delivery failed',expired:'Request expired'};

function StageNode({data,selected}:NodeProps<Node<StageData>>) {
 const {stage}=data,worker=agents.find(agent=>agent.id===stage.targetAgent);
 const Icon=stage.kind==='trigger'?Zap:stage.kind==='review'?ShieldCheck:stage.kind==='output'?ArrowUpRight:Waypoints;
 return <div className={`${styles.stageNode} ${worker?styles.workerNode:''}`} style={{'--flow-accent':worker?.color||data.color} as CSSProperties}>
  {data.incoming.map(port=><Handle key={`in-${port}`} id={`in-${port}`} type="target" position={ports[port]} isConnectable={false}/>)}
  <button type="button" className={`${styles.stage} ${styles[stage.kind]||''} ${worker?styles.workerStage:''} ${selected?styles.selected:''} nodrag`} onClick={event=>{event.stopPropagation();if(worker)data.openWorkflow(worker.id);else data.inspect(stage.id);}} aria-label={worker?`View ${worker.name} workflow`:`Inspect ${stage.label}`} aria-pressed={worker?undefined:selected}>
   <span className={styles.stageKind}>{worker?<GitBranch size={12}/>:<Icon size={12}/>} {worker?'Existing agent':stage.capability==='manual'?'Ryan action':stage.kind==='review'?'Guard / review':stage.kind}</span>
   <span className={styles.stageMain}>{worker?<span className={styles.workerSprite}><Ryan agentId={worker.id} size={48} still/></span>:<span className={styles.serviceIcon}>{stage.connector?<IntegrationLogo name={stage.connector} size={27} decorative/>:<Icon size={25}/>}</span>}<strong>{stage.label}</strong></span>
   <span className={`${styles.capability} ${stage.capability==='planned'?styles.planned:''}`}>{worker?<><span>View workflow</span><ArrowUpRight size={12}/></>:capabilityNames[stage.capability]}</span>
  </button>
  {data.ruleCount>0&&<button type="button" className={`${styles.nodeRules} nodrag nopan`} onClick={event=>{event.stopPropagation();data.openRules(stage.id);}} aria-label={`View ${data.ruleCount} rules for ${stage.label}`} title={`${data.ruleCount} documented rules`}><Shield size={11} aria-hidden="true"/><span>{data.ruleCount}</span></button>}
  {worker&&<button type="button" className={`${styles.workerDetails} nodrag`} onClick={event=>{event.stopPropagation();data.inspect(stage.id);}} aria-label={`Inspect ${worker.name} handoff`}>Handoff details</button>}
  {data.outgoing.map(port=><Handle key={`out-${port}`} id={`out-${port}`} type="source" position={ports[port]} isConnectable={false}/>)}
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
   })}<button className={`${styles.agent} ${styles.sandboxAgent} ${selection==='sandbox'?styles.activeAgent:''}`} onClick={()=>setSelection('sandbox')} aria-pressed={selection==='sandbox'} aria-label="Sandbox · practice workflow"><span className={`${styles.avatar} ${styles.silhouette}`}><Ryan size={42} still/></span><span><strong>Sandbox</strong><small>Practice</small></span></button></div>
   <div className={styles.rosterActions}>{props.onCreate&&<button className={styles.create} onClick={props.onCreate}><Plus size={16}/>Add agent</button>}<button onClick={()=>setSketchbook(true)}><LockKeyhole size={14}/>Saved map</button></div>
  </nav>
  {selection==='sandbox'?<SandboxWorkflow/>:<AgentWorkflow key={selection} {...props} agentId={selection} onViewWorkflow={setSelection}/>}
 </section>;
}

function AgentWorkflow({agentId,states,events=[],messages=[],online=false,demo=false,paused=false,onSelect,onViewWorkflow}:Props&{agentId:AgentId;onViewWorkflow:(id:AgentId)=>void}) {
 const [selectedStage,setSelectedStage]=useState<string|null>(null);
 const [tab,setTab]=useState<InspectorTab>('step');
 const [ruleStageId,setRuleStageId]=useState<string|null>(null);
 const tabId=useId(),tabRefs=useRef<Partial<Record<InspectorTab,HTMLButtonElement>>>({});
 const [wide,setWide]=useState(false),[detailsOpen,setDetailsOpen]=useState(false);
 useEffect(()=>{const media=window.matchMedia('(min-width: 801px)');const update=()=>setWide(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 const inspectorRef=useRef<HTMLElement>(null),inspectorBodyRef=useRef<HTMLDivElement>(null),detailsButton=useRef<HTMLButtonElement>(null),flowRef=useRef<ReactFlowInstance<Node<StageData>,Edge>|null>(null);
 useEffect(()=>{if(!wide)return;const frame=requestAnimationFrame(()=>{void flowRef.current?.fitView({padding:agentId==='outreach'?'7%':'5%',maxZoom:1});});return()=>cancelAnimationFrame(frame);},[wide,detailsOpen,agentId]);
 useEffect(()=>{if(wide||!detailsOpen)return;const frame=requestAnimationFrame(()=>inspectorRef.current?.scrollIntoView({block:'start'}));return()=>cancelAnimationFrame(frame);},[wide,detailsOpen,selectedStage,tab,ruleStageId]);
 useEffect(()=>{inspectorBodyRef.current?.scrollTo({top:0});},[tab,selectedStage,ruleStageId]);
 const agent=agents.find(a=>a.id===agentId)!;
 const definition=workflowCatalog[agentId],topology=workflowGraphs[agentId],rules=workflowRules[agentId];
 const openRules=useCallback((id:string|null)=>{setRuleStageId(id);if(id)setSelectedStage(id);setTab('rules');setDetailsOpen(true);requestAnimationFrame(()=>{tabRefs.current.rules?.focus({preventScroll:true});if(!wide)inspectorRef.current?.scrollIntoView({block:'start'});});},[wide]);
 const inspectStage=useCallback((id:string)=>{setSelectedStage(id);setRuleStageId(id);setTab('step');setDetailsOpen(true);},[]);
 const inspectRuleStage=(id:string)=>{inspectStage(id);requestAnimationFrame(()=>tabRefs.current.step?.focus({preventScroll:true}));};
 const stage=definition.stages.find(s=>s.id===selectedStage)||definition.stages[0];
 const state=states.find(s=>s.id===agentId);
 const status=online?state?.status||'offline':'offline';
 const connectors=[...new Set(definition.stages.map(s=>s.connector).filter(Boolean))] as IntegrationName[];
 const history=[...events.filter(e=>e.agentId===agentId).map(e=>({id:`event-${e.id}`,at:e.at,label:e.label,detail:'Observed activity'})),...messages.filter(m=>m.agentId===agentId).map(m=>{const at=m.status==='replied'?m.repliedAt:m.status==='delivered'?m.deliveredAt:m.status==='queued'?m.queuedAt:m.status==='planning'?m.pickedUpAt:undefined;return {id:`message-${m.id}`,at:at||m.createdAt,label:receiptNames[m.status]||'Request status unknown',detail:at?'Prompt receipt':'Request created'};})].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,20);
 const {nodes,edges}=useMemo(()=>{
  const nodes:Node<StageData>[]=definition.stages.map(item=>({id:item.id,type:'stage',initialWidth:206,initialHeight:item.targetAgent?154:126,position:topology.positions[item.id],data:{stage:item,color:agent.color,incoming:[...new Set(topology.routes.filter(route=>route.target===item.id).map(route=>route.targetPort))],outgoing:[...new Set(workflowOutgoing(topology,item.id).map(route=>route.sourcePort))],inspect:inspectStage,openWorkflow:onViewWorkflow,ruleCount:rules.filter(rule=>rule.stageIds.includes(item.id)).length,openRules},selected:item.id===stage.id,draggable:false,connectable:false,deletable:false}));
  const edges:Edge[]=topology.routes.map((route,index)=>{
   const moving=workflowRouteMoves(route.kind,online,status,paused),destination=definition.stages.find(item=>item.id===route.target)?.targetAgent,color=agents.find(item=>item.id===destination)?.color||agent.color;
   const reportedWorker=route.kind==='context'&&definition.stages.some(item=>item.id===route.source&&item.targetAgent);
   return {id:`${route.source}-${route.target}-${index}`,source:route.source,target:route.target,sourceHandle:`out-${route.sourcePort}`,targetHandle:`in-${route.targetPort}`,type:'default',reconnectable:false,deletable:false,animated:moving,className:`${styles.activityEdge} ${moving?styles.flowing:''} ${route.kind==='handoff'||reportedWorker?styles.handoffEdge:''} ${route.kind==='projection'?styles.projectionEdge:''}`,markerEnd:{type:MarkerType.ArrowClosed,color,width:14,height:14},style:{stroke:color,strokeWidth:1.8,opacity:moving?.95:.65},label:route.kind==='handoff'||reportedWorker?'':workflowDiagramLabel(route),ariaLabel:route.label,labelStyle:{fill:'#d4e0e7',fontSize:10},labelBgStyle:{fill:'#20313d',fillOpacity:.95},labelBgPadding:[4,3],labelBgBorderRadius:4};
  });
  return {nodes,edges};
 },[definition,topology,rules,agent.color,stage.id,onViewWorkflow,inspectStage,openRules,online,status,paused]);
 return <div className={styles.content}>
   <header className={styles.header}><div><h3>{agent.name}</h3><p>{definition.intent}</p></div><button className={styles.chat} onClick={()=>onSelect(agentId)}><MessageSquare size={15}/><span>Chat</span></button></header>
   <div className={styles.runtime}><span className={`${styles.status} ${styles[status]}`}>{demo?'Demo · ':''}{stateNames[status]}</span><span className={styles.progress}>{online&&status==='working'?(state?.progress||state?.activity||'Working in Codex'):online&&status==='error'?'Check the original chat for the error.':online&&status==='waiting'?'Check the latest context in chat.':status==='offline'?'Agent activity unavailable':online?'Ready for the next task':'Live activity unavailable'}</span><span className={styles.observed}>{time(state?.updatedAt)}</span></div>
   <div className={`${styles.workArea} ${!detailsOpen?styles.canvasFocused:''}`}>
    <div className={styles.graphArea}>
     <div className={styles.graphLabel}><span><LockKeyhole size={11}/>Read-only workflow</span><div className={styles.graphActions}><button type="button" className={styles.rulesAccess} onClick={()=>openRules(null)} aria-expanded={detailsOpen&&tab==='rules'} aria-label={`View all ${rules.length} workflow rules`}><Shield size={13} aria-hidden="true"/>Rules<span>{rules.length}</span></button><button ref={detailsButton} type="button" onClick={()=>setDetailsOpen(value=>!value)} aria-expanded={detailsOpen}>{detailsOpen?<PanelRightClose size={14}/>:<PanelRightOpen size={14}/>}<span>{detailsOpen?'Expand canvas':'Details & history'}</span></button></div></div>
     <p className={styles.topologySummary}>{topology.summary}</p>
     <div className={styles.mobileSteps} aria-label="Workflow routes">{definition.stages.map(item=>{
      const next=workflowOutgoing(topology,item.id),worker=agents.find(agent=>agent.id===item.targetAgent),ruleCount=rules.filter(rule=>rule.stageIds.includes(item.id)).length;
      return <article key={item.id} className={styles.mobileStage}>
       <button aria-pressed={stage.id===item.id} onClick={()=>{if(worker){onViewWorkflow(worker.id);return;}inspectStage(item.id);}}>{worker?<span className={styles.mobileSprite}><Ryan agentId={worker.id} size={35} still/></span>:item.connector?<IntegrationLogo name={item.connector} size={21} decorative/>:<Waypoints size={19}/>}<strong>{item.label}</strong><small>{worker?'View workflow':item.capability==='manual'?'Ryan action':item.kind==='review'?'Guard / review':capabilityNames[item.capability]}</small><ArrowUpRight size={13}/></button>
       {ruleCount>0&&<button type="button" className={styles.mobileRuleBadge} onClick={()=>openRules(item.id)} aria-label={`View ${ruleCount} rules for ${item.label}`}><Shield size={13} aria-hidden="true"/>Rules<span>{ruleCount}</span></button>}
       {worker&&<button type="button" className={styles.mobileHandoffDetails} onClick={()=>{inspectStage(item.id);}} aria-label={`Inspect ${worker.name} handoff`}>Handoff details<Info size={12}/></button>}
       {next.length>0&&<ul className={styles.mobileRoutes}>{next.map((route,index)=><li key={`${route.target}-${index}`}><span>{route.label||'Next'}</span><button type="button" onClick={()=>{const target=definition.stages.find(stage=>stage.id===route.target);if(target?.targetAgent){onViewWorkflow(target.targetAgent);return;}inspectStage(route.target);}}>{definition.stages.find(stage=>stage.id===route.target)?.label}<ArrowUpRight size={11}/></button></li>)}</ul>}
      </article>;
     })}</div>
     <div className={styles.canvas}>{wide&&<ReactFlow key={agentId} onInit={instance=>{flowRef.current=instance;}} nodes={nodes} edges={edges} nodeTypes={nodeTypes} nodesDraggable={false} nodesConnectable={false} edgesFocusable={false} deleteKeyCode={null} fitView fitViewOptions={{padding:agentId==='outreach'?'7%':'5%',maxZoom:1}} minZoom={.2} maxZoom={1.5} zoomOnDoubleClick={false} onNodeClick={(_,node)=>{inspectStage(node.id);}}><Background gap={22} size={1} color="#52616c"/><Controls showInteractive={false}/></ReactFlow>}</div>
     <p className={styles.graphNote}><Info size={13}/>Moving dots show this agent’s activity. Dashed handoffs and projections are supported routes, not live transfers. Individual steps are not tracked.{paused?' Animation paused.':''}</p>
    </div>
    <aside ref={inspectorRef} className={`${styles.inspector} ${!detailsOpen?styles.inspectorHidden:''}`} aria-label={`${agent.name} workflow details`}>
     <div className={styles.inspectorHeading}><span>Workflow details</span><button type="button" aria-label="Close workflow details" onClick={()=>{setDetailsOpen(false);detailsButton.current?.focus();}}><PanelRightClose size={15}/></button></div>
     <div className={styles.tabs} role="tablist" aria-label="Workflow details">{inspectorTabs.map(t=><button key={t} type="button" role="tab" id={`${tabId}-tab-${t}`} aria-selected={tab===t} aria-controls={`${tabId}-panel`} tabIndex={tab===t?0:-1} ref={element=>{if(element)tabRefs.current[t]=element;else delete tabRefs.current[t];}} onClick={()=>setTab(t)} onKeyDown={event=>{const index=inspectorTabs.indexOf(t);let next:InspectorTab|undefined;if(event.key==='ArrowRight')next=inspectorTabs[(index+1)%inspectorTabs.length];else if(event.key==='ArrowLeft')next=inspectorTabs[(index+inspectorTabs.length-1)%inspectorTabs.length];else if(event.key==='Home')next=inspectorTabs[0];else if(event.key==='End')next=inspectorTabs[inspectorTabs.length-1];if(next){event.preventDefault();setTab(next);tabRefs.current[next]?.focus();}}}>{t==='step'?'Step':t==='rules'?'Rules':t==='connections'?'Connections':'History'}</button>)}</div>
     <div ref={inspectorBodyRef} className={styles.inspectorBody} id={`${tabId}-panel`} role="tabpanel" aria-labelledby={`${tabId}-tab-${tab}`} tabIndex={0}>
      {tab==='rules'&&<WorkflowRules rules={rules} stages={definition.stages} stageId={ruleStageId} onAll={()=>openRules(null)} onSelectStage={inspectRuleStage}/>}
      {tab==='step'&&<><span className={styles.detailKind}>{stage.kind==='review'?'Review gate':stage.kind}</span><h4>{stage.label}</h4><p>{stage.detail}</p><span className={styles.detailBadge}>{capabilityNames[stage.capability]}</span><dl><dt>Input</dt><dd>{stage.inputs.join(' · ')}</dd><dt>Output</dt><dd>{stage.outputs.join(' · ')}</dd>{stage.reviewGate&&<><dt><ShieldCheck size={13}/>Guard / review</dt><dd>{stage.reviewGate}</dd></>}</dl>{workflowOutgoing(topology,stage.id).length>0&&<ul className={styles.routeDetails} aria-label="Next routes">{workflowOutgoing(topology,stage.id).map((route,index)=><li key={`${route.target}-${index}`}><strong>{route.label||'Next'}</strong><span>{definition.stages.find(item=>item.id===route.target)?.label}</span></li>)}</ul>}{stage.targetAgent&&<button className={styles.openChat} onClick={()=>onViewWorkflow(stage.targetAgent!)}>View {stage.label} workflow<ArrowUpRight size={13}/></button>}<details className={styles.details}><summary>Workflow scope</summary><p><strong>Starts with</strong><br/>{definition.trigger}</p><p><strong>Produces</strong><br/>{definition.outputs.join(' · ')}</p>{definition.limitations.map(l=><p key={l}>{l}</p>)}<small>Source review: {definition.lastVerified}</small></details></>}
      {tab==='connections'&&<><h4>Tools & account scope</h4><p>{definition.accountScope}</p><div className={styles.connectorList}>{connectors.map(c=><div className={styles.connector} key={c}><IntegrationLogo name={c} size={25} decorative/><div><strong>{integrationMeta[c].label}</strong><small>{c==='codex'?'Existing agent chat':c==='studio'?'Local application · this Mac':'Access managed in Codex'}</small></div><a href={c==='codex'?`codex://threads/${agent.thread}`:integrationMeta[c].href} aria-label={`Open ${integrationMeta[c].label}`} target={c==='codex'?undefined:'_blank'} rel="noopener noreferrer"><ArrowUpRight size={16}/></a></div>)}</div><p className={styles.scopeNote}>Logos identify tools. This dashboard cannot verify account permissions or connection health.</p>{definition.limitations.map(l=><p className={styles.limit} key={l}>{l}</p>)}<details className={styles.details}><summary>Source references</summary>{definition.evidence.map(e=><p key={e.source}><strong>{e.label}</strong><br/><span className={styles.source}>{e.source}</span></p>)}<small>Reviewed {definition.lastVerified}</small></details></>}
      {tab==='history'&&<><h4><History size={16}/>Recent activity</h4><p>Bridge events and prompt receipts{demo?' from the demo':''}.</p>{!online&&<p className={styles.scopeNote}>The bridge is offline. Saved events may be out of date.</p>}{history.length?<ol className={styles.history}>{history.map(e=><li key={e.id}><strong>{e.label}</strong><span>{e.detail}</span><time>{time(e.at)}</time></li>)}</ol>:<p className={styles.empty}>No activity recorded yet. Open the agent’s chat to start a task.</p>}{state?.result&&<details className={styles.details}><summary>Latest response</summary><MessageContent text={state.result}/></details>}<button className={styles.openChat} onClick={()=>onSelect(agentId)}>Open {agent.name} chat<ArrowUpRight size={15}/></button></>}
     </div>
    </aside>
   </div>
  </div>;
}
