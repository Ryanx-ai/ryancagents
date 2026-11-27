'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {ReactFlow,Background,Controls,MiniMap,Handle,Position,addEdge,useNodesState,useEdgesState,type Connection,type NodeProps,type Node,type Edge} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './workflow-polish.css';
import {agents,type AgentState,type AgentId} from '../lib/model';
import {ArrowUpRight,Check,Save,RotateCcw,Plus,Pencil,X} from 'lucide-react';
import IntegrationLogo,{integrationMeta,type IntegrationName} from './IntegrationLogo';

type FlowData={label:string;agentId:AgentId;index:number;status:string};
const services:Record<AgentId,IntegrationName[][]>={
 scheduler:[['gmail'],['calendar'],['gmail','calendar']],
 outreach:[['contacts','sheets'],['gmail'],['gmail','sheets']],
 contacts:[['contacts'],['gohighlevel'],['sheets']],
 manager:[['codex'],['codex'],['codex']],
 designer:[['codex'],['codex'],['codex']],
 proposal:[['codex'],['studio'],['studio']],
};
const Actions=createContext<{open:(id:AgentId)=>void;rename:(id:string,label:string)=>void}|null>(null);
function AgentNode({id,data,selected}:NodeProps<Node<FlowData>>){
 const actions=useContext(Actions)!;const agent=agents.find(a=>a.id===data.agentId)!;
 const marks=services[data.agentId][Math.abs(data.index)%3];
 return <div className={`flow-node ${selected?'selected':''}`} style={{'--agent-color':agent.color} as React.CSSProperties}>
  <Handle type="target" position={Position.Left}/>
  <div className="flow-node-top"><small>{agent.name}</small><span className={`flow-dot ${data.status}`} title={`${agent.name}: ${data.status}`} aria-label={`Agent activity: ${data.status}`}/></div>
  <div className="flow-node-main"><div className={`flow-logo-stack ${marks.length>1?'multiple':''}`}>{marks.map(name=><span className="flow-service-mark" key={name} title={integrationMeta[name].label}><IntegrationLogo name={name} size={25} decorative/></span>)}</div><strong>{data.label}</strong></div>
  <div className="flow-node-bottom"><span className="flow-services" title={marks.map(name=>integrationMeta[name].label).join(' · ')}>{marks.map(name=>name==='sheets'?'Sheets':name==='calendar'?'Calendar':name==='contacts'?'Contacts':integrationMeta[name].label).join(' · ')}</span><div className="flow-node-actions nodrag nopan"><button type="button" title={`Open ${agent.name}`} aria-label={`Open ${agent.name}`} onClick={e=>{e.stopPropagation();actions.open(data.agentId);}} onDoubleClick={e=>e.stopPropagation()}><ArrowUpRight size={15}/></button><button type="button" title="Rename step" aria-label={`Rename ${data.label}`} onClick={e=>{e.stopPropagation();actions.rename(id,data.label);}} onDoubleClick={e=>e.stopPropagation()}><Pencil size={13}/></button></div></div>
  <Handle type="source" position={Position.Right}/>
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
export default function Workflow({states,onSelect}:{states:AgentState[];onSelect:(id:AgentId)=>void}){
 const [nodes,setNodes,onNodesChange]=useNodesState(initialNodes);const [edges,setEdges,onEdgesChange]=useEdgesState(initialEdges);
 const [notice,setNotice]=useState('');const [editing,setEditing]=useState<string|null>(null);const [label,setLabel]=useState('');
 const rename=useCallback((id:string,nextLabel:string)=>{setEditing(id);setLabel(nextLabel);},[]);
 const actions=useMemo(()=>({open:onSelect,rename}),[onSelect,rename]);
 useEffect(()=>{try{
  const restored=restoreLayout(JSON.parse(localStorage.getItem('ryan-flow-v2')||'null'));
  if(restored){setNodes(restored.nodes);setEdges(restored.edges);}
 }catch{}},[setNodes,setEdges]);
 useEffect(()=>{setNodes(ns=>ns.map(n=>({...n,data:{...n.data,status:states.find(s=>s.id===n.data.agentId)?.status||'offline'}})));setEdges(es=>es.map(e=>({...e,animated:states.find(s=>e.source.startsWith(s.id))?.status==='working'})));},[states,setNodes,setEdges]);
 const connect=useCallback((connection:Connection)=>setEdges(es=>addEdge({...connection,style:{stroke:'#b3ad9c'}},es)),[setEdges]);
 function addStep(){const agentId=nodes.find(n=>n.selected)?.data.agentId||'scheduler';const i=agents.findIndex(a=>a.id===agentId);setNodes(ns=>[...ns,{id:`${agentId}-${Date.now()}`,type:'agent',position:{x:80,y:55+i*132},data:{label:'New step',agentId,index:i*3,status:states.find(s=>s.id===agentId)?.status||'idle'}}]);setNotice('Step added');}
 function save(){try{localStorage.setItem('ryan-flow-v2',JSON.stringify({version:4,nodes,edges}));setNotice('Map saved');}catch{setNotice('Could not save this map');}}
 return <section className="workflow-panel workflow-polished"><div className="workflow-toolbar"><span className="planning-chip" title="Editing this map does not run agents or change their instructions.">Planning map</span><div className="button-group"><button className="subtle-button" disabled={nodes.length>=60} onClick={addStep}><Plus size={15}/>Add step</button><button className="icon-button" title="Reset layout" aria-label="Reset workflow layout" onClick={()=>{setNodes(initialNodes);setEdges(initialEdges);try{localStorage.removeItem('ryan-flow-v2');}catch{}setNotice('Layout reset');}}><RotateCcw size={16}/></button><button className="subtle-button" onClick={save}><Save size={15}/>Save</button></div></div>
  <Actions.Provider value={actions}><div className="flow-canvas"><ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={connect} nodeTypes={nodeTypes} onNodeDoubleClick={(_,node)=>rename(node.id,node.data.label)} fitView fitViewOptions={{padding:.1}} minZoom={.3} maxZoom={1.8} zoomOnDoubleClick={false} deleteKeyCode={['Backspace','Delete']}><Background gap={22} size={1} color="#64717c"/><Controls/><MiniMap nodeColor={node=>agents.find(a=>a.id===node.data.agentId)?.color||'#aaa'} maskColor="rgba(17,21,26,.55)"/></ReactFlow></div></Actions.Provider>
  {notice&&<div className="workflow-notice" role="status"><Check size={13}/>{notice}<button aria-label="Dismiss map notification" onClick={()=>setNotice('')}><X size={13}/></button></div>}
  {editing&&<div className="modal-scrim"><form className="dialog workflow-rename" role="dialog" aria-modal="true" aria-label="Rename workflow step" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setEditing(null);}}} onSubmit={e=>{e.preventDefault();if(label.trim()){setNodes(ns=>ns.map(n=>n.id===editing?{...n,data:{...n.data,label:label.trim().slice(0,60)}}:n));setEditing(null);setNotice('Step renamed');}}}><h2>Rename step</h2><label>Step name<input autoFocus value={label} onChange={e=>setLabel(e.target.value)} maxLength={60}/></label><div className="button-group"><button type="button" className="subtle-button" onClick={()=>setEditing(null)}>Cancel</button><button className="primary-button">Save</button></div></form></div>}
 </section>;
}
