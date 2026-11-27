'use client';

import {useEffect,useMemo,useRef,useState,type KeyboardEvent} from 'react';
import {ReactFlow,Background,Controls,Handle,Position,MarkerType,type Node,type Edge,type NodeProps,type OnNodesChange,type OnEdgesChange,type ReactFlowInstance} from '@xyflow/react';
import {ArrowUpRight,GitBranch,Link2,Plus,ShieldCheck,Trash2,Undo2,Waypoints,Zap} from 'lucide-react';
import {Ryan} from './Office';
import {MAX_NODES,MAX_EDGES,SANDBOX_KINDS,createSandboxGraph,validateSandboxGraph,readSandboxGraph,saveSandboxGraph,addSandboxNode,updateSandboxNode,removeSandboxNodes,connectSandboxEdge,removeSandboxEdges,type SandboxGraph,type SandboxNode,type SandboxNodeData} from '../lib/workflow-sandbox.mjs';
import styles from './SandboxWorkflow.module.css';

type Kind=SandboxNodeData['kind'];
type CanvasNode=Node<SandboxNodeData&Record<string,unknown>>;
type Selection={kind:'node'|'edge';id:string}|null;
const kindLabels:Record<Kind,string>={trigger:'Trigger',action:'Action',review:'Review',output:'Output'};
const icons={trigger:Zap,action:Waypoints,review:ShieldCheck,output:ArrowUpRight};

function SandboxNodeView({data,selected}:NodeProps<CanvasNode>) {
 const Icon=icons[data.kind];
 return <div className={`${styles.node} ${selected?styles.selected:''}`}>
  <Handle type="target" position={Position.Left} aria-label={`Connect into ${data.label}`}/>
  <span className={styles.nodeKind}><Icon size={13}/>{kindLabels[data.kind]}</span>
  <strong>{data.label}</strong><small>{data.notes?'Notes added':'Practice node'}</small>
  <Handle type="source" position={Position.Right} aria-label={`Connect from ${data.label}`}/>
 </div>;
}
const nodeTypes={sandbox:SandboxNodeView};

function NodeEditor({node,onSave,onDelete,onEditEnd}:{node:SandboxNode;onSave:(data:SandboxNodeData)=>void;onDelete:()=>void;onEditEnd:()=>void}) {
 const [label,setLabel]=useState(node.data.label);
 useEffect(()=>{setLabel(node.data.label);},[node.id,node.data.label]);
 return <form className={styles.editor} onSubmit={event=>event.preventDefault()} onBlur={event=>{if(!(event.relatedTarget instanceof HTMLElement)||!event.currentTarget.contains(event.relatedTarget))onEditEnd();}}>
  <h4>Configure node</h4>
  <label>Name<input value={label} onChange={event=>{const value=event.target.value;setLabel(value);if(value.trim())onSave({...node.data,label:value});}} required maxLength={60} aria-invalid={!label.trim()}/></label>
  {!label.trim()&&<small role="status">Enter a node name to save.</small>}
  <label>Type<select value={node.data.kind} onChange={event=>onSave({...node.data,kind:event.target.value as Kind})}>{SANDBOX_KINDS.map(value=><option key={value} value={value}>{kindLabels[value]}</option>)}</select></label>
  <label>Notes<textarea value={node.data.notes} onChange={event=>onSave({...node.data,notes:event.target.value})} maxLength={1000} rows={4} placeholder="Describe a pretend action or decision…"/></label>
  <small>Notes describe this node. They are never sent to an agent.</small>
  <div className={styles.editorActions}><button type="button" className={styles.delete} onClick={onDelete}><Trash2 size={15}/>Delete</button></div>
 </form>;
}

export default function SandboxWorkflow() {
 const [graph,setGraph]=useState<SandboxGraph|null>(null);
 const graphRef=useRef<SandboxGraph|null>(null);
 const historyRef=useRef<SandboxGraph[]>([]);
 const editSession=useRef<string|null>(null);
 const [undoCount,setUndoCount]=useState(0);
 const dragOriginal=useRef<SandboxGraph|null>(null);
 const storageRef=useRef<Storage|null>(null);
 const flowRef=useRef<ReactFlowInstance<CanvasNode,Edge>|null>(null);
 const canvasRef=useRef<HTMLDivElement>(null);
 const blockedStorage=useRef(false);
 const [selection,setSelection]=useState<Selection>(null);
 const [newKind,setNewKind]=useState<Kind>('action');
 const [from,setFrom]=useState('');
 const [to,setTo]=useState('');
 const [notice,setNotice]=useState('');
 const [saveState,setSaveState]=useState('Browser only');
 const [storageError,setStorageError]=useState('');

 useEffect(()=>{
  let restored:ReturnType<typeof readSandboxGraph>={graph:null,error:null};
  try{storageRef.current=window.localStorage;restored=readSandboxGraph(storageRef.current);}
  catch{restored.error='Browser storage is unavailable.';}
  if(restored.error){blockedStorage.current=true;setStorageError(`${restored.error} Existing saved data is untouched; this session will not save.`);}
  const initial=restored.graph||createSandboxGraph();graphRef.current=initial;setGraph(initial);
  setSaveState(restored.graph?'Saved in this browser':'Starter canvas · browser only');
  return()=>{
   // A panel switch mid-drag must not discard its last visible position.
   if(dragOriginal.current&&graphRef.current&&storageRef.current&&!blockedStorage.current)try{saveSandboxGraph(graphRef.current,storageRef.current);}catch{}
  };
 },[]);

 const hasGraph=graph!==null;
 useEffect(()=>{
  const canvas=canvasRef.current;if(!canvas)return;
  let width=Math.round(canvas.clientWidth),height=Math.round(canvas.clientHeight);
  let timer:ReturnType<typeof setTimeout>;
  const observer=new ResizeObserver(entries=>{
   const box=entries[0]?.contentRect;if(!box)return;
   const nextWidth=Math.round(box.width),nextHeight=Math.round(box.height);
   if(!nextWidth||!nextHeight||(nextWidth===width&&nextHeight===height))return;
   width=nextWidth;height=nextHeight;clearTimeout(timer);
   // The initial fit belongs to React Flow. Only a real canvas resize resets
   // the viewport; graph edits and normal rerenders preserve the user's pan.
   if(flowRef.current)timer=setTimeout(()=>{if(graphRef.current?.nodes.length)void flowRef.current?.fitView({padding:'8%',maxZoom:1});},120);
  });
  observer.observe(canvas);
  return()=>{clearTimeout(timer);observer.disconnect();};
 },[hasGraph]);

 const selectedNode=graph?.nodes.find(node=>selection?.kind==='node'&&node.id===selection.id);
 const selectedEdge=graph?.edges.find(edge=>selection?.kind==='edge'&&edge.id===selection.id);
 useEffect(()=>{editSession.current=null;},[selection?.kind,selection?.id]);
 useEffect(()=>{
  if(!graph)return;
  if(from&&!graph.nodes.some(node=>node.id===from))setFrom('');
  if(to&&!graph.nodes.some(node=>node.id===to))setTo('');
 },[graph,from,to]);

 function persist(next:SandboxGraph) {
  if(blockedStorage.current||!storageRef.current){setSaveState('Session only');return;}
  try{saveSandboxGraph(next,storageRef.current);setSaveState('Saved in this browser');}
  catch(error){blockedStorage.current=true;setSaveState('Session only');setStorageError(`${error instanceof Error?error.message:'Could not save.'} Your canvas remains available in this session.`);}
 }
 function commit(next:SandboxGraph,previous=graphRef.current,remember=true) {
  const clean=validateSandboxGraph(next);
  if(JSON.stringify(clean)===JSON.stringify(previous))return;
  if(remember&&previous){historyRef.current=[...historyRef.current.slice(-29),previous];setUndoCount(historyRef.current.length);}
  graphRef.current=clean;setGraph(clean);persist(clean);
 }
 function change(operation:(current:SandboxGraph)=>SandboxGraph,message:string) {
  if(!graphRef.current)return;
  editSession.current=null;
  try{commit(operation(graphRef.current));setNotice(message);}catch(error){setNotice(error instanceof Error?error.message:'This change could not be applied.');}
 }
 function editNode(id:string,data:SandboxNodeData) {
  const previous=graphRef.current;if(!previous)return;
  try{
   const next=updateSandboxNode(previous,id,{data});if(JSON.stringify(next)===JSON.stringify(previous))return;
   commit(next,previous,editSession.current!==id);editSession.current=id;setNotice('');
  }catch(error){setNotice(error instanceof Error?error.message:'This change could not be saved.');}
 }
 function addNode() {
  if(!graphRef.current)return;
  editSession.current=null;
  try{
   const count=graphRef.current.nodes.length;
   const next=addSandboxNode(graphRef.current,{kind:newKind,label:`New ${kindLabels[newKind].toLowerCase()}`,position:{x:40+(count%3)*250,y:40+Math.floor(count/3)*160}});
   commit(next);const node=next.nodes.at(-1)!;setSelection({kind:'node',id:node.id});setFrom(node.id);setNotice('Node added. Give it a name in the inspector.');
   void flowRef.current?.setCenter(node.position.x+95,node.position.y+53,{zoom:Math.max(.75,flowRef.current.getZoom()),duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:180});
  }catch(error){setNotice(error instanceof Error?error.message:'Could not add this node.');}
 }
 function connect(source:string,target:string) {
  if(graphRef.current?.edges.some(edge=>edge.source===source&&edge.target===target)){setNotice('These nodes are already connected.');return;}
  change(current=>connectSandboxEdge(current,source,target),'Connection added.');
 }
 function deleteSelection() {
  if(!selection)return;
  change(current=>selection.kind==='node'?removeSandboxNodes(current,[selection.id]):removeSandboxEdges(current,[selection.id]),selection.kind==='node'?'Node and its connections removed.':'Connection removed.');
  setSelection(null);
 }
 function undo() {
  editSession.current=null;
  const previous=historyRef.current.pop();if(!previous)return;
  setUndoCount(historyRef.current.length);commit(previous,graphRef.current,false);setSelection(null);setNotice('Last change undone.');
 }
 const onNodesChange:OnNodesChange<CanvasNode>=changes=>{
  const current=graphRef.current;if(!current)return;
  const changed=changes.applyTo(current.nodes.map(node=>({...node,selected:selection?.kind==='node'&&selection.id===node.id})) as CanvasNode[]);
  const selectedId=changes.getByType('select').filter(change=>change.selected).at(-1)?.id;
  const picked=changed.find(node=>node.selected&&node.id===selectedId)||changed.find(node=>node.selected);
  if(picked&&(selection?.kind!=='node'||selection.id!==picked.id)){setSelection({kind:'node',id:picked.id});setFrom(picked.id);}
  else if(!picked)setSelection(previous=>previous?.kind==='node'?null:previous);
  const next={...current,nodes:current.nodes.map(node=>{
   const moved=changed.find(item=>item.id===node.id);
   return moved&&Number.isFinite(moved.position.x)&&Number.isFinite(moved.position.y)?{...node,position:{...moved.position}}:node;
  })};
  if(JSON.stringify(next.nodes.map(n=>n.position))===JSON.stringify(current.nodes.map(n=>n.position)))return;
  try{
   const clean=validateSandboxGraph(next);
   if(dragOriginal.current){graphRef.current=clean;setGraph(clean);}else commit(clean);
  }catch{/* Keep the last valid canvas when a drag leaves its supported bounds. */}
 };
 const onEdgesChange:OnEdgesChange<Edge>=changes=>{
  const current=graphRef.current;if(!current)return;
  const changed=changes.applyTo(current.edges.map(edge=>({...edge,selected:selection?.kind==='edge'&&selection.id===edge.id})));
  const selectedId=changes.getByType('select').filter(change=>change.selected).at(-1)?.id;
  const picked=changed.find(edge=>edge.selected&&edge.id===selectedId)||changed.find(edge=>edge.selected);
  if(picked&&(selection?.kind!=='edge'||selection.id!==picked.id))setSelection({kind:'edge',id:picked.id});
  else if(!picked)setSelection(previous=>previous?.kind==='edge'?null:previous);
 };
 function keyboard(event:KeyboardEvent) {
  if(event.target instanceof HTMLElement&&(event.target.isContentEditable||event.target.closest('input,textarea,select')))return;
  if((event.key==='Delete'||event.key==='Backspace')&&selection){event.preventDefault();event.stopPropagation();deleteSelection();}
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'&&!event.shiftKey){event.preventDefault();event.stopPropagation();undo();}
 }
 const nodes=useMemo<CanvasNode[]>(()=>graph?.nodes.map(node=>({...node,selected:selection?.kind==='node'&&selection.id===node.id,initialWidth:190,initialHeight:106}))||[],[graph,selection]);
 const edges=useMemo<Edge[]>(()=>graph?.edges.map(edge=>({...edge,type:'smoothstep',selected:selection?.kind==='edge'&&selection.id===edge.id,animated:false,interactionWidth:28,markerEnd:{type:MarkerType.ArrowClosed,color:'#a6c0cf'},style:{stroke:selection?.kind==='edge'&&selection.id===edge.id?'#f0d29f':'#a6c0cf',strokeWidth:2}}))||[],[graph,selection]);

 if(!graph)return <p className={styles.loading}>Opening sandbox…</p>;
 return <div className={styles.playground} onKeyDown={keyboard}>
  <header className={styles.header}><span className={styles.silhouette}><Ryan size={58} still/></span><div><span className={styles.eyebrow}>Play sandbox</span><h3>Dummy Ryan</h3><p>Build a practice workflow. Nothing here runs or connects to an account.</p></div></header>
  <div className={styles.toolbar}>
   <div className={styles.addGroup}><select aria-label="New node type" value={newKind} onChange={event=>setNewKind(event.target.value as Kind)}>{SANDBOX_KINDS.map(value=><option key={value} value={value}>{kindLabels[value]}</option>)}</select><button onClick={addNode} disabled={graph.nodes.length>=MAX_NODES}><Plus size={16}/>Add node</button></div>
   <div className={styles.tools}><button onClick={undo} disabled={!undoCount} title="Undo last change"><Undo2 size={15}/><span>Undo</span></button><button onClick={deleteSelection} disabled={!selection}><Trash2 size={15}/><span>Delete selected</span></button><button disabled={!graph.nodes.length} onClick={()=>{change(()=>({version:1,nodes:[],edges:[]}),'Canvas cleared. Undo restores it.');setSelection(null);}}>Clear canvas</button></div>
  </div>
  {storageError&&<p className={styles.warning} role="alert">{storageError}</p>}
  <div className={styles.workArea}>
   <div className={styles.canvasWrap}>
    <div ref={canvasRef} className={styles.canvas} aria-label="Editable sandbox canvas"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onInit={instance=>{flowRef.current=instance;}} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={(_,node)=>{setSelection({kind:'node',id:node.id});setFrom(node.id);}} onEdgeClick={(_,edge)=>setSelection({kind:'edge',id:edge.id})} onPaneClick={()=>setSelection(null)} onNodeDragStart={(_,node)=>{editSession.current=null;dragOriginal.current=graphRef.current;setSelection({kind:'node',id:node.id});}} onNodeDragStop={()=>{const previous=dragOriginal.current;dragOriginal.current=null;if(previous&&graphRef.current)commit(graphRef.current,previous);}} onConnect={connection=>{if(connection.source&&connection.target)connect(connection.source,connection.target);}} deleteKeyCode={null} multiSelectionKeyCode={null} fitView fitViewOptions={{padding:'5%',maxZoom:1}} minZoom={.3} maxZoom={1.8} zoomOnDoubleClick={false} onNodeDoubleClick={(_,node)=>{setSelection({kind:'node',id:node.id});document.getElementById('sandbox-node-inspector')?.scrollIntoView({block:'nearest'});}}><Background gap={22} size={1} color="#52616c"/><Controls showInteractive={false}/></ReactFlow>
     {!graph.nodes.length&&<div className={styles.empty}><Waypoints size={27}/><strong>Your canvas is clear</strong><p>Add a node to start building.</p></div>}
    </div>
    <p className={styles.canvasHint}>Drag nodes to arrange them. Join the dots, or use Connect nodes.</p>
   </div>
   <aside className={styles.inspector} id="sandbox-node-inspector" aria-label="Sandbox node settings">
    {selectedNode?<NodeEditor node={selectedNode} onSave={data=>editNode(selectedNode.id,data)} onEditEnd={()=>{editSession.current=null;}} onDelete={deleteSelection}/>:selectedEdge?<div className={styles.edgeEditor}><h4>Connection</h4><p>{graph.nodes.find(n=>n.id===selectedEdge.source)?.data.label}<ArrowUpRight size={14}/>{graph.nodes.find(n=>n.id===selectedEdge.target)?.data.label}</p><button className={styles.delete} onClick={deleteSelection}><Trash2 size={15}/>Delete connection</button></div>:<div className={styles.pickHint}><Waypoints size={22}/><h4>Make it yours</h4><p>Select a node to rename it, choose its type or add notes.</p></div>}
    <form className={styles.connect} onSubmit={event=>{event.preventDefault();if(from&&to)connect(from,to);}}><h4><Link2 size={16}/>Connect nodes</h4><label>From<select value={from} onChange={event=>setFrom(event.target.value)} required><option value="">Choose a node</option>{graph.nodes.map(node=><option key={node.id} value={node.id}>{node.data.label}</option>)}</select></label><label>To<select value={to} onChange={event=>setTo(event.target.value)} required><option value="">Choose a node</option>{graph.nodes.filter(node=>node.id!==from).map(node=><option key={node.id} value={node.id}>{node.data.label}</option>)}</select></label><button type="submit" disabled={!from||!to||from===to||graph.edges.length>=MAX_EDGES}><GitBranch size={15}/>Connect</button></form>
   </aside>
  </div>
  <footer className={styles.footer}><span role="status">{notice||saveState}</span><span>{graph.nodes.length}/{MAX_NODES} nodes · {graph.edges.length}/{MAX_EDGES} links · {saveState}</span></footer>
 </div>;
}
