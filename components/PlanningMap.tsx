'use client';
import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {ReactFlow,Background,Controls,MiniMap,Handle,Position,type NodeProps,type Node,type Edge} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './workflow-polish.css';
import {agents,type AgentState,type AgentId} from '../lib/model';
import {ArrowUpRight,LockKeyhole} from 'lucide-react';
import workflowStyles from './Workflow.module.css';
import IntegrationLogo,{integrationMeta,type IntegrationName} from './IntegrationLogo';

type FlowData={label:string;agentId:AgentId;index:number;status:string};
const services:Record<AgentId,IntegrationName[][]>={
 scheduler:[['gmail'],['calendar'],['gmail','calendar']],
 outreach:[['contacts','sheets'],['gmail'],['gmail','sheets']],
 contacts:[['contacts'],['sheets'],['sheets']],
 manager:[['codex'],['codex'],['codex']],
 designer:[['codex'],['codex'],['codex']],
 proposal:[['codex'],['studio'],['studio']],
};
const Actions=createContext<{open:(id:AgentId)=>void}|null>(null);
function AgentNode({id,data,selected}:NodeProps<Node<FlowData>>){
 const actions=useContext(Actions)!;const agent=agents.find(a=>a.id===data.agentId)!;
 const marks=services[data.agentId][Math.abs(data.index)%3];
 return <div className={`flow-node ${selected?'selected':''}`} style={{'--agent-color':agent.color} as React.CSSProperties}>
  <Handle type="target" position={Position.Left} isConnectable={false}/>
  <div className="flow-node-top"><small>{agent.name}</small><small>Read only</small></div>
  <div className="flow-node-main"><div className={`flow-logo-stack ${marks.length>1?'multiple':''}`}>{marks.map(name=><span className="flow-service-mark" key={name} title={integrationMeta[name].label}><IntegrationLogo name={name} size={25} decorative/></span>)}</div><strong>{data.label}</strong></div>
  <div className="flow-node-bottom"><span className="flow-services" title={marks.map(name=>integrationMeta[name].label).join(' · ')}>{marks.map(name=>name==='sheets'?'Sheets':name==='calendar'?'Calendar':name==='contacts'?'Contacts':integrationMeta[name].label).join(' · ')}</span><div className="flow-node-actions nodrag nopan"><button type="button" title={`Open ${agent.name}`} aria-label={`Open ${agent.name}`} onClick={e=>{e.stopPropagation();actions.open(data.agentId);}} onDoubleClick={e=>e.stopPropagation()}><ArrowUpRight size={15}/></button></div></div>
  <Handle type="source" position={Position.Right} isConnectable={false}/>
 </div>;
}
const nodeTypes={agent:AgentNode};
const initialNodes:Node<FlowData>[]=agents.flatMap((agent,i)=>agent.steps.map((label,j)=>({id:`${agent.id}-${j}`,type:'agent',position:{x:35+j*310,y:30+i*132},data:{label,agentId:agent.id,index:i*3+j,status:'idle'}})));
const initialEdges:Edge[]=agents.flatMap(agent=>[0,1].map(i=>({id:`${agent.id}-e${i}`,source:`${agent.id}-${i}`,target:`${agent.id}-${i+1}`,style:{stroke:agent.color,strokeWidth:1.5},animated:false})));
function restoreLayout(saved:{version:number;nodes:Node<FlowData>[];edges:Edge[]}|null){
 if(![2,3,4].includes(saved?.version)||!Array.isArray(saved.nodes)||!Array.isArray(saved.edges)||saved.nodes.length>69)return null;
 const valid=saved.nodes.every(n=>n&&typeof n.id==='string'&&n.type==='agent'&&agents.some(a=>a.id===n.data?.agentId)&&typeof n.data?.label==='string'&&Number.isInteger(n.data?.index)&&Number.isFinite(n.position?.x)&&Number.isFinite(n.position?.y));
 const savedIds=new Set(saved.nodes.map(n=>n?.id));
 if(!valid||savedIds.size!==saved.nodes.length)return null;
 // Append new agent rows below the saved layout, keeping every existing
 // position and label. Version 4 saves respect deliberately removed rows.
 const addedAgents=agents.filter(a=>((saved.version===2&&a.id==='designer')||(saved.version<4&&a.id==='proposal'))&&!saved.nodes.some(n=>n.data.agentId===a.id));
 const nextRow=Math.max(30,...saved.nodes.map(n=>n.position.y+132));
 const additions=addedAgents.flatMap((agent,row)=>initialNodes.filter(n=>n.data.agentId===agent.id).map(n=>({...n,position:{...n.position,y:nextRow+row*132}})));
 const addedIds=new Set(additions.map(n=>n.id));
 return {nodes:[...saved.nodes,...additions],edges:[...saved.edges.filter(e=>e&&typeof e.id==='string'&&savedIds.has(e.source)&&savedIds.has(e.target)),...initialEdges.filter(e=>addedIds.has(e.source))]};
}
export default function PlanningMap({states,onSelect,online=false,paused=false,onSandbox}:{states:AgentState[];onSelect:(id:AgentId)=>void;online?:boolean;paused?:boolean;onSandbox?:()=>void}){
 const [nodes,setNodes]=useState(initialNodes);const [savedEdges,setEdges]=useState(initialEdges);
 const actions=useMemo(()=>({open:onSelect}),[onSelect]);
 useEffect(()=>{try{
  const restored=restoreLayout(JSON.parse(localStorage.getItem('ryan-flow-v2')||'null'));
  if(restored){setNodes(restored.nodes);setEdges(restored.edges);}
 }catch{}},[]);
 const lockedNodes=useMemo(()=>nodes.map(node=>({...node,draggable:false,connectable:false,deletable:false})),[nodes]);
 const edges=useMemo(()=>savedEdges.map(edge=>{
  const source=nodes.find(node=>node.id===edge.source),target=nodes.find(node=>node.id===edge.target);
  const moving=online&&!paused&&source?.data.agentId===target?.data.agentId&&states.find(state=>state.id===source?.data.agentId)?.status==='working';
  return {...edge,type:'default',reconnectable:false,deletable:false,animated:moving,className:`${workflowStyles.activityEdge} ${moving?workflowStyles.flowing:''}`,style:{stroke:agents.find(agent=>agent.id===source?.data.agentId)?.color||'#a6bdca',strokeWidth:2}};
 }),[savedEdges,nodes,states,online,paused]);
 return <section className="workflow-panel workflow-polished"><div className="workflow-toolbar"><span className="planning-chip"><LockKeyhole size={12}/>Read-only saved map</span>{onSandbox&&<button className="subtle-button" onClick={onSandbox}>Open Sandbox<ArrowUpRight size={14}/></button>}</div>
  <Actions.Provider value={actions}><div className="flow-canvas"><ReactFlow nodes={lockedNodes} edges={edges} nodeTypes={nodeTypes} nodesDraggable={false} nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} fitView fitViewOptions={{padding:'5%'}} minZoom={.3} maxZoom={1.8} zoomOnDoubleClick={false}><Background gap={22} size={1} color="#64717c"/><Controls showInteractive={false}/><MiniMap nodeColor={node=>agents.find(agent=>agent.id===node.data.agentId)?.color||'#aaa'} maskColor="rgba(17,21,26,.55)"/></ReactFlow></div></Actions.Provider>
 </section>;
}
