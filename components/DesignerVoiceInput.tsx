'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {ArrowDownLeft,LoaderCircle,Mic,Square,X} from 'lucide-react';
import {MAX_VOICE_CHARS,createDesignerVoiceController,type DesignerVoiceController,type VoiceRecognizer,type VoiceState} from '../lib/designer-voice.mjs';
import styles from './DesignerVoiceInput.module.css';

type Props={onInsert:(text:string)=>void;remainingChars:number;disabled?:boolean;onBusyChange?:(busy:boolean)=>void};
type VoiceWindow=Window&{SpeechRecognition?:new()=>VoiceRecognizer;webkitSpeechRecognition?:new()=>VoiceRecognizer};
const initial:VoiceState={phase:'ready',transcript:'',interim:'',error:null,notice:null};

export default function DesignerVoiceInput({onInsert,remainingChars,disabled=false,onBusyChange}:Props){
 const [open,setOpen]=useState(false),[availability,setAvailability]=useState<'checking'|'supported'|'unsupported'|'insecure'>('checking');
 const [state,setState]=useState<VoiceState>(initial),[insertError,setInsertError]=useState('');
 const controller=useRef<DesignerVoiceController|null>(null),trigger=useRef<HTMLButtonElement>(null),startButton=useRef<HTMLButtonElement>(null),transcript=useRef<HTMLTextAreaElement>(null);
 const busyCallback=useRef(onBusyChange);busyCallback.current=onBusyChange;
 const id=useId(),busy=['starting','listening','stopping'].includes(state.phase),review=['review','error'].includes(state.phase);
 const available=Math.max(0,Math.min(MAX_VOICE_CHARS,Number.isFinite(remainingChars)?Math.floor(remainingChars):0));
 const text=state.transcript.trim(),fits=text.length<=available;
 useEffect(()=>{
  if(!window.isSecureContext){setAvailability('insecure');return;}
  const browser=window as VoiceWindow,Recognition=browser.SpeechRecognition||browser.webkitSpeechRecognition;
  if(!Recognition){setAvailability('unsupported');return;}
  setAvailability('supported');
  const voice=createDesignerVoiceController({createRecognizer:()=>new Recognition(),onChange:setState});controller.current=voice;
  const discard=()=>{voice.cancel();setOpen(false);setInsertError('');};
  const visibility=()=>{if(document.visibilityState==='hidden')discard();};
  document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',discard);
  return()=>{controller.current=null;voice.dispose();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',discard);busyCallback.current?.(false);};
 },[]);
 useEffect(()=>{busyCallback.current?.(busy);},[busy]);
 useEffect(()=>{if(disabled){controller.current?.cancel();setOpen(false);setInsertError('');}},[disabled]);
 useEffect(()=>{if(open)startButton.current?.focus({preventScroll:true});},[open]);
 useEffect(()=>{if(open&&review&&state.transcript)transcript.current?.focus({preventScroll:true});},[open,review]);
 function dismiss(){controller.current?.cancel();setOpen(false);setInsertError('');trigger.current?.focus({preventScroll:true});}
 function insert(){if(disabled||busy||!text||!fits)return;try{onInsert(text);dismiss();}catch{setInsertError('The text could not be added. Your transcript is still here.');}}
 const label=state.phase==='starting'?'Starting microphone…':state.phase==='listening'?'Listening…':state.phase==='stopping'?'Finishing transcript…':review?'Review transcript':'Voice input';
 return <div className={styles.voice} onKeyDownCapture={event=>{if(open&&event.key==='Escape'){event.preventDefault();event.stopPropagation();dismiss();}}}>
  <button ref={trigger} type="button" className={styles.trigger} disabled={disabled} aria-expanded={open} aria-controls={`${id}-panel`} onClick={()=>open?dismiss():setOpen(true)}><Mic size={14}/>Voice input<span>Trial</span></button>
  {open&&<section id={`${id}-panel`} className={styles.panel} aria-label="Designer Ryan voice input">
   <header className={styles.header}><span><Mic size={15}/>{label}</span><button type="button" className={styles.close} aria-label="Cancel voice input" onClick={dismiss}><X size={16}/></button></header>
   <p id={`${id}-disclosure`} className={styles.disclosure}>Your browser may send audio to its speech service. Review the text before adding it to your prompt.</p>
   {availability!=='supported'?<p className={styles.unavailable} role="status">{availability==='checking'?'Checking browser support…':availability==='insecure'?'Voice input needs a secure HTTPS page. You can keep typing.':'Voice input is not supported in this browser. You can keep typing.'}</p>:<>
    {state.error&&<p className={styles.error} role="alert">{state.error}</p>}
    {state.notice&&<p className={styles.notice} role="status">{state.notice}</p>}
    {busy&&<div className={styles.capture}><div className={styles.recording} role="status">{state.phase==='listening'?<span className={styles.recordDot}/>:<LoaderCircle size={13} className={styles.spin}/>}<span>{state.phase==='listening'?'Speak now · up to 60 seconds':label}</span></div><p className={styles.liveText}>{state.transcript}{state.transcript&&state.interim?' ':''}<span>{state.interim}</span>{!state.transcript&&!state.interim?'Your words will appear here.':''}</p></div>}
    {review&&<label className={styles.transcriptLabel} htmlFor={`${id}-transcript`}>Transcript<textarea ref={transcript} id={`${id}-transcript`} className={styles.transcript} value={state.transcript} maxLength={MAX_VOICE_CHARS} rows={4} placeholder="Edit the recognized text…" onChange={event=>{controller.current?.setTranscript(event.target.value);setInsertError('');}} onKeyDown={event=>{if(event.key==='Enter'&&(event.metaKey||event.ctrlKey)){event.preventDefault();event.stopPropagation();}}}/><span className={styles.count}>{text.length.toLocaleString()} characters · {available.toLocaleString()} available in prompt</span></label>}
    {review&&!fits&&<p className={styles.error} role="alert">Shorten the transcript by {text.length-available} characters to fit. Your typed prompt will stay intact.</p>}
    {insertError&&<p className={styles.error} role="alert">{insertError}</p>}
    <div className={styles.actions}><button type="button" className={styles.secondary} onClick={dismiss}>Cancel</button>{busy?<button type="button" className={styles.primary} disabled={state.phase==='stopping'} onClick={()=>controller.current?.stop()}><Square size={12}/>{state.phase==='stopping'?'Finishing…':'Stop'}</button>:<>{review&&<button type="button" className={styles.secondary} onClick={()=>controller.current?.start()} aria-describedby={`${id}-disclosure`} disabled={disabled}>Record again</button>}{review?<button type="button" className={styles.primary} disabled={disabled||!text||!fits} onClick={insert}><ArrowDownLeft size={14}/>Use text</button>:<button ref={startButton} type="button" className={styles.primary} disabled={disabled||available===0} aria-describedby={`${id}-disclosure`} onClick={()=>controller.current?.start()}><Mic size={14}/>Start recording</button>}</>}</div>
    {!busy&&!review&&<p className={styles.footnote}>{available===0?'Your prompt is full. Make room before recording.':'Up to 60 seconds. Nothing is sent to Designer Ryan until you send your prompt.'}</p>}
   </>}
  </section>}
 </div>;
}
