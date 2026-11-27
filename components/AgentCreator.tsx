'use client';
import {useEffect,useId,useRef,useState,type FormEvent,type MouseEvent} from 'react';
import {ArrowDown,ArrowLeft,ArrowRight,ArrowUp,Check,Download,FolderOpen,LockKeyhole,Plus,RotateCcw,Save,Trash2,Upload,X} from 'lucide-react';
import {Ryan} from './Office';
import {ClothingColors} from './Wardrobe';
import {defaultPalette} from '../lib/wardrobe.mjs';
import IntegrationLogo,{integrationMeta} from './IntegrationLogo';
import {CONNECTOR_IDS,OUTFITS,clearAgentDraftRecovery,createAgentDraft,deleteAgentDraft,exportAgentDraft,importAgentDraft,readAgentDraftRecovery,readAgentDrafts,saveAgentDraftRecovery,saveAgentDraft,validateAgentDraft,type AgentDraft,type ConnectorId,type DraftInput,type Outfit} from '../lib/agent-drafts.mjs';
import styles from './AgentCreator.module.css';

type Props={onClose:()=>void;onSaved?:(draft:AgentDraft)=>void;initialDraft?:AgentDraft};
const stages=['Describe','Workflow','Outfit & name','Review'];
const titles=['Give your Ryan a job','Shape the workflow','Make this Ryan yours','Review your draft'];
const blank=():DraftInput=>({name:'',description:'',workflow:{trigger:'',input:'',steps:['','',''],output:''},outfit:'standard',requestedConnectors:[]});
function inputFrom(draft:AgentDraft):DraftInput{return {name:draft.name,description:draft.description,outfit:draft.outfit,...(draft.palette?{palette:{...draft.palette}}:{}),requestedConnectors:[...draft.requestedConnectors],workflow:{...draft.workflow,steps:[...draft.workflow.steps]}};}
function issue(form:DraftInput,step:number){
 if(step===0&&!form.description.trim())return 'Describe what this Ryan should handle.';
 if(step===1){if(!form.workflow.trigger.trim())return 'Add a trigger for this workflow.';if(!form.workflow.input.trim())return 'Describe the input this Ryan needs.';if(form.workflow.steps.some(value=>!value.trim()))return 'Write each workflow step, or remove the empty ones.';if(!form.workflow.output.trim())return 'Describe the expected output.';}
 if(step===2&&!form.name.trim())return 'Give this Ryan a name.';
 return null;
}
function spriteId(outfit:Outfit){return outfit==='standard'?undefined:outfit;}
function download(draft:AgentDraft){
 const url=URL.createObjectURL(new Blob([exportAgentDraft(draft)],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download=`${draft.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'ryan'}-draft.json`;
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function AgentCreator({onClose,onSaved,initialDraft}:Props){
 const [editing,setEditing]=useState<AgentDraft|null>(()=>{try{return initialDraft?validateAgentDraft(initialDraft):null;}catch{return null;}});
 const [form,setForm]=useState<DraftInput>(()=>editing?inputFrom(editing):blank());
 const [step,setStep]=useState(0),[unlocked,setUnlocked]=useState(editing?3:0);
 const [view,setView]=useState<'builder'|'library'>('builder');
 const [drafts,setDrafts]=useState<AgentDraft[]>([]),[dirty,setDirtyState]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [recoveryError,setRecoveryError]=useState(''),[recoverySaved,setRecoverySaved]=useState(false);
 const [discard,setDiscard]=useState(false),[deleteTarget,setDeleteTarget]=useState<string|null>(null);
 const dialogRef=useRef<HTMLDialogElement>(null),bodyRef=useRef<HTMLDivElement>(null),headingRef=useRef<HTMLHeadingElement>(null),fileRef=useRef<HTMLInputElement>(null),keepRef=useRef<HTMLButtonElement>(null);
 const pendingAction=useRef<(()=>void)|null>(null),dismissed=useRef(false),backdropPress=useRef(false),dirtyRef=useRef(false),discardTrigger=useRef<HTMLElement|null>(null);
 const id=useId();
 useEffect(()=>{
  const dialog=dialogRef.current;if(!dialog)return;
  const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
  dismissed.current=false;dialog.showModal();
  const saved=readAgentDrafts();setDrafts(saved.drafts);if(saved.error)setError(saved.error);
  if(!initialDraft){const {recovery,error:recoveryProblem}=readAgentDraftRecovery();if(recoveryProblem)setRecoveryError(recoveryProblem);if(recovery){setEditing(recovery.editing);setForm(recovery.form);setStep(recovery.step);setUnlocked(recovery.unlocked);setDirty(true);setRecoverySaved(true);setNotice('Recovered unfinished draft in this tab.');}}
  return()=>{if(dialog.open)dialog.close();if(trigger?.isConnected)trigger.focus({preventScroll:true});};
 },[]);
 useEffect(()=>{bodyRef.current?.scrollTo({top:0});headingRef.current?.focus({preventScroll:true});},[step,view]);
 useEffect(()=>{if(discard)keepRef.current?.focus();},[discard]);
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 useEffect(()=>{if(!dirty)return;try{saveAgentDraftRecovery({version:1,form,editing,step,unlocked});setRecoverySaved(true);setRecoveryError('');}catch(e){setRecoverySaved(false);setRecoveryError(e instanceof Error?e.message:'Tab recovery is unavailable.');}},[dirty,form,editing,step,unlocked]);
 function setDirty(value:boolean){dirtyRef.current=value;setDirtyState(value);}
 function forgetRecovery(){try{clearAgentDraftRecovery();setRecoverySaved(false);setRecoveryError('');}catch{setRecoveryError('The old recovery checkpoint could not be cleared from this tab.');}}
 function close(){if(dismissed.current)return;dismissed.current=true;dialogRef.current?.close();onClose();}
 function guard(action:()=>void){if(dirtyRef.current){pendingAction.current=action;discardTrigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setDiscard(true);}else action();}
 function cancelDiscard(){setDiscard(false);pendingAction.current=null;if(discardTrigger.current?.isConnected)discardTrigger.current.focus({preventScroll:true});}
 function change(next:DraftInput){setForm(next);setDirty(true);setError('');setNotice('');}
 function selectOutfit(outfit:Outfit){const {palette:_,...rest}=form;change({...rest,outfit});}
 function resetColors(){const {palette:_,...rest}=form;change(rest);}
 function workflow(key:'trigger'|'input'|'output',value:string){change({...form,workflow:{...form.workflow,[key]:value}});}
 function updateStep(index:number,value:string){change({...form,workflow:{...form.workflow,steps:form.workflow.steps.map((old,i)=>i===index?value:old)}});}
 function moveStep(index:number,direction:number){const steps=[...form.workflow.steps];[steps[index],steps[index+direction]]=[steps[index+direction],steps[index]];change({...form,workflow:{...form.workflow,steps}});}
 function connector(value:ConnectorId){change({...form,requestedConnectors:form.requestedConnectors.includes(value)?form.requestedConnectors.filter(item=>item!==value):[...form.requestedConnectors,value]});}
 function loadDraft(draft:AgentDraft,imported=false){setEditing(draft);setForm(inputFrom(draft));setStep(imported?3:0);setUnlocked(3);setDirty(imported);setView('builder');setError('');setNotice(imported?'Imported as a new copy. Save it to keep it in this browser.':'');}
 function newDraft(){setEditing(null);setForm(blank());setStep(0);setUnlocked(0);setDirty(false);setView('builder');setError('');setNotice('');}
 function submit(event:FormEvent){
  event.preventDefault();setNotice('');
  if(step<3){const problem=issue(form,step);if(problem){setError(problem);return;}setError('');setStep(step+1);setUnlocked(value=>Math.max(value,step+1));return;}
  for(let i=0;i<3;i++){const problem=issue(form,i);if(problem){setStep(i);setError(problem);return;}}
  let draft:AgentDraft;
  try{draft=createAgentDraft(form,editing||undefined);const saved=saveAgentDraft(draft);setDrafts(saved);setEditing(draft);setDirty(false);forgetRecovery();setError('');setNotice('Saved in this browser. This Ryan is not active.');}catch(e){setError(e instanceof Error?e.message:'Could not save this draft. Export it to keep a copy.');return;}
  onSaved?.(draft);
 }
 async function importFile(file:File|undefined){
  if(!file)return;
  if(file.size>65536){setError('Choose a draft JSON file smaller than 64 KB.');return;}
  try{const draft=importAgentDraft(await file.text());if(dialogRef.current?.open)guard(()=>loadDraft(draft,true));}catch(e){setError(e instanceof Error?e.message:'Could not import this draft.');}
 }
 function exportCurrent(){try{download(createAgentDraft(form,editing||undefined));setError('');}catch(e){setError(e instanceof Error?e.message:'Complete the draft before exporting.');}}
 function removeDraft(draft:AgentDraft){try{setDrafts(deleteAgentDraft(draft.id));setDeleteTarget(null);setNotice('Draft deleted from this browser.');if(editing?.id===draft.id){setEditing(null);setDirty(true);}}catch(e){setError(e instanceof Error?e.message:'Could not delete this draft.');}}
 function outside(event:{clientX:number;clientY:number}){const box=dialogRef.current?.getBoundingClientRect();return !!box&&(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom);}
 function backdropClick(event:MouseEvent<HTMLDialogElement>){if(backdropPress.current&&event.target===event.currentTarget&&outside(event))guard(close);backdropPress.current=false;}
 const previewName=form.name.trim()||'Your new Ryan';
 return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={`${id}-title`} onCancel={event=>{event.preventDefault();event.stopPropagation();discard?cancelDiscard():guard(close);}} onClose={()=>{if(!dialogRef.current?.open)close();}} onKeyDownCapture={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();discard?cancelDiscard():guard(close);}}} onPointerDown={event=>{backdropPress.current=event.target===event.currentTarget&&outside(event);}} onPointerCancel={()=>{backdropPress.current=false;}} onClick={backdropClick}>
  <form className={styles.shell} onSubmit={submit} noValidate>
   <header className={styles.header}><div><span className={styles.mode}>Draft builder</span><h2 id={`${id}-title`}>Create a Ryan</h2></div><div className={styles.headerActions}><button type="button" className={styles.iconButton} title={view==='library'?'Back to builder':'Saved drafts'} aria-label={view==='library'?'Back to builder':'Open saved drafts'} onClick={()=>{setView(value=>value==='library'?'builder':'library');setNotice('');}}>{view==='library'?<ArrowLeft size={19}/>:<FolderOpen size={19}/>}</button><button type="button" className={styles.iconButton} aria-label="Close agent creator" onClick={()=>guard(close)}><X size={20}/></button></div></header>
   <input ref={fileRef} type="file" accept="application/json,.json" className={styles.fileInput} aria-label="Import agent draft JSON" onChange={event=>{void importFile(event.target.files?.[0]);event.target.value='';}}/>
   {view==='builder'&&<nav className={styles.stages} aria-label="Agent draft steps">{stages.map((label,index)=><button type="button" key={label} aria-current={step===index?'step':undefined} disabled={index>unlocked} onClick={()=>{setStep(index);setError('');}}><span>{index<step?<Check size={12}/>:index+1}</span>{label}</button>)}</nav>}
   {discard&&<div className={styles.discard} role="alert"><p>Discard your unsaved changes?</p><div><button type="button" ref={keepRef} className={styles.secondary} onClick={cancelDiscard}>Keep editing</button><button type="button" className={styles.danger} onClick={()=>{const action=pendingAction.current;cancelDiscard();setDirty(false);forgetRecovery();action?.();}}>Discard changes</button></div></div>}
   {error&&<div className={styles.error} role="alert">{error}</div>}
   {recoveryError&&<div className={styles.error} role="alert">{recoveryError}</div>}
   {notice&&<div className={styles.notice} role="status"><Check size={15}/>{notice}</div>}
   <div className={styles.body} ref={bodyRef}>
    {view==='library'?<section className={styles.library}>
     <div className={styles.sectionHeading}><div><h3 ref={headingRef} tabIndex={-1}>Saved drafts</h3><p>Only in this browser. None are active agents.</p></div><button type="button" className={styles.secondary} onClick={()=>guard(newDraft)}><Plus size={15}/>New draft</button></div>
     <button type="button" className={styles.importButton} onClick={()=>fileRef.current?.click()}><Upload size={16}/>Import draft JSON</button>
     {!drafts.length&&<div className={styles.empty}><FolderOpen size={30}/><h4>No saved drafts yet</h4><p>Build a Ryan or import a draft to get started.</p></div>}
     <div className={styles.draftList}>{drafts.map(draft=><article key={draft.id} className={styles.draftRow}><div className={styles.miniRyan}><Ryan agentId={spriteId(draft.outfit)} palette={draft.palette||null} size={64} still/></div><div className={styles.draftDetails}><h4>{draft.name}</h4><p>{draft.description}</p><span>Draft · Not active</span></div><div className={styles.rowActions}><button type="button" className={styles.secondary} onClick={()=>guard(()=>loadDraft(draft))}>Edit</button><button type="button" className={styles.iconButton} aria-label={`Export ${draft.name}`} title="Export JSON" onClick={()=>download(draft)}><Download size={16}/></button><button type="button" className={styles.iconButton} aria-label={`Delete ${draft.name}`} title="Delete draft" onClick={()=>setDeleteTarget(draft.id)}><Trash2 size={15}/></button></div>{deleteTarget===draft.id&&<div className={styles.deleteConfirm}><span>Delete this saved draft?</span><button type="button" className={styles.secondary} onClick={()=>setDeleteTarget(null)}>Keep</button><button type="button" className={styles.danger} onClick={()=>removeDraft(draft)}>Delete</button></div>}</article>)}</div>
    </section>:<div className={styles.workspace}>
     <section className={styles.editor}>
      <div className={styles.sectionHeading}><div><h3 ref={headingRef} tabIndex={-1}>{titles[step]}</h3><p>{step===0?'Start with the job, in your own words.':step===1?'Edit the plan this Ryan should follow.':step===2?'Choose an existing outfit and give him a name.':'Check the plan before saving it locally.'}</p></div></div>
      {step===0&&<><label className={styles.field} htmlFor={`${id}-description`}>What should this Ryan handle?<textarea id={`${id}-description`} value={form.description} maxLength={2000} rows={7} placeholder="Review new leads, flag duplicates, and prepare a contact summary." onChange={event=>change({...form,description:event.target.value})}/><span className={styles.fieldFoot}>{form.description.length} / 2,000</span></label><div className={styles.connectionNote}><LockKeyhole size={16}/><div><strong>AI generation not connected</strong><p>You’ll write and edit the workflow in the next step.</p></div></div><button type="button" className={styles.textButton} onClick={()=>fileRef.current?.click()}><Upload size={14}/>Import an existing draft</button></>}
      {step===1&&<>
       <label className={styles.field} htmlFor={`${id}-trigger`}>Trigger<input id={`${id}-trigger`} value={form.workflow.trigger} maxLength={300} placeholder="When I request a contact review" onChange={event=>workflow('trigger',event.target.value)}/></label>
       <label className={styles.field} htmlFor={`${id}-input`}>Input<textarea id={`${id}-input`} value={form.workflow.input} maxLength={1500} rows={2} placeholder="The contact list and criteria to check" onChange={event=>workflow('input',event.target.value)}/></label>
       <fieldset className={styles.stepFields}><legend>Workflow steps</legend>{form.workflow.steps.map((value,index)=><div className={styles.stepRow} key={index}><span className={styles.stepNumber}>{index+1}</span><input aria-label={`Workflow step ${index+1}`} value={value} maxLength={500} placeholder="Describe this action" onChange={event=>updateStep(index,event.target.value)}/><div className={styles.stepActions}><button type="button" disabled={index===0} aria-label={`Move step ${index+1} up`} onClick={()=>moveStep(index,-1)}><ArrowUp size={13}/></button><button type="button" disabled={index===form.workflow.steps.length-1} aria-label={`Move step ${index+1} down`} onClick={()=>moveStep(index,1)}><ArrowDown size={13}/></button><button type="button" disabled={form.workflow.steps.length===1} aria-label={`Remove step ${index+1}`} onClick={()=>change({...form,workflow:{...form.workflow,steps:form.workflow.steps.filter((_,i)=>i!==index)}})}><X size={13}/></button></div></div>)}<button type="button" className={styles.textButton} disabled={form.workflow.steps.length>=12} onClick={()=>change({...form,workflow:{...form.workflow,steps:[...form.workflow.steps,'']}})}><Plus size={14}/>Add step</button></fieldset>
       <label className={styles.field} htmlFor={`${id}-output`}>Output<textarea id={`${id}-output`} value={form.workflow.output} maxLength={1500} rows={2} placeholder="A reviewed list and a summary for my approval" onChange={event=>workflow('output',event.target.value)}/></label>
       <fieldset className={styles.connectors}><legend>Requested connectors</legend><p>Selections request access. They do not connect accounts or grant permission.</p><div className={styles.connectorGrid}>{CONNECTOR_IDS.map(connectorId=><label key={connectorId} className={styles.connector}><input type="checkbox" checked={form.requestedConnectors.includes(connectorId)} onChange={()=>connector(connectorId)}/><IntegrationLogo name={connectorId} size={22} decorative/><span><strong>{integrationMeta[connectorId].label}</strong><small>Not verified</small></span></label>)}</div></fieldset>
      </>}
      {step===2&&<><label className={styles.field} htmlFor={`${id}-name`}>Name<input id={`${id}-name`} value={form.name} maxLength={60} placeholder="Research Ryan" onChange={event=>change({...form,name:event.target.value})}/></label><fieldset className={styles.outfits}><legend>Outfit</legend><div>{OUTFITS.map(outfit=><label key={outfit.id} className={styles.outfit}><input type="radio" name={`${id}-outfit`} checked={form.outfit===outfit.id} onChange={()=>selectOutfit(outfit.id)}/><Ryan agentId={spriteId(outfit.id)} palette={form.outfit===outfit.id?form.palette||null:null} size={88} still/><span>{outfit.label}</span>{form.outfit===outfit.id&&<Check size={14} className={styles.outfitCheck}/>}</label>)}</div><p>The outfit keeps its original shape.</p></fieldset><section className={styles.paletteEditor} aria-label="Clothing colors"><div className={styles.paletteHeader}><h4>Clothing colors</h4><button type="button" disabled={!form.palette} onClick={resetColors}><RotateCcw size={13}/>Reset colors</button></div><ClothingColors value={form.palette||defaultPalette(form.outfit)} original={defaultPalette(form.outfit)} onChange={palette=>change({...form,palette})}/></section></>}
      {step===3&&<><div className={styles.reviewDescription}><h4>{previewName}</h4><p>{form.description}</p></div><dl className={styles.reviewFields}><div><dt>Trigger</dt><dd>{form.workflow.trigger}</dd></div><div><dt>Input</dt><dd>{form.workflow.input}</dd></div><div><dt>Workflow</dt><dd><ol>{form.workflow.steps.map((value,index)=><li key={index}>{value}</li>)}</ol></dd></div><div><dt>Output</dt><dd>{form.workflow.output}</dd></div><div><dt>Connectors</dt><dd>{form.requestedConnectors.length?<div className={styles.reviewConnectors}>{form.requestedConnectors.map(connectorId=><span key={connectorId}><IntegrationLogo name={connectorId} size={17} decorative/>{integrationMeta[connectorId].label}<small>Not verified</small></span>)}</div>:'None requested'}</dd></div></dl><div className={styles.connectionNote}><LockKeyhole size={17}/><div><strong>Activation unavailable</strong><p>A bridge agent mapping and verified connector grants are required before this draft can run.</p></div></div><button type="button" className={styles.textButton} onClick={exportCurrent}><Download size={15}/>Export draft JSON</button></>}
     </section>
     <aside className={styles.preview} aria-label="Character preview"><div className={styles.previewStage}><span className={styles.previewShadow}/><Ryan agentId={spriteId(form.outfit)} palette={form.palette||null} size={208} still/></div><h4>{previewName}</h4><p>{OUTFITS.find(outfit=>outfit.id===form.outfit)?.label}</p><span className={styles.draftBadge}>Draft · Not active</span></aside>
    </div>}
   </div>
   <footer className={styles.footer}><span>{dirty?(recoverySaved?'Unfinished changes are kept in this tab':'Draft not saved yet'):'Saved only in this browser'}</span><div>{view==='library'?<button type="button" className={styles.secondary} onClick={()=>setView('builder')}><ArrowLeft size={15}/>Back to builder</button>:<>{step>0&&<button type="button" className={styles.secondary} onClick={()=>{setStep(step-1);setError('');}}><ArrowLeft size={15}/>Back</button>}<button type="submit" className={styles.primary} disabled={step===3&&!!editing&&!dirty}>{step===3?<><Save size={16}/>{editing?'Save changes':'Save draft'}</>:<>Continue<ArrowRight size={16}/></>}</button></>}</div></footer>
  </form>
 </dialog>;
}
