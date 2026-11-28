'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,ChevronDown,LoaderCircle} from 'lucide-react';
import IntegrationLogo from './IntegrationLogo';
import {PROPOSAL_STUDIO_LAUNCHER} from '../lib/manager-resources';
import {STUDIO_URL,STUDIO_LAUNCH_MESSAGES,createStudioLaunchController,isMacDeviceHint,type StudioLaunchController,type StudioLaunchState,type StudioPendingWindow,type StudioRequest} from '../lib/studio-launch-client.mjs';
import styles from './StudioLaunchControl.module.css';

type Props={request:StudioRequest;disabled?:boolean;compact?:boolean;isAuthorized?:()=>boolean};
const initial:StudioLaunchState={phase:'idle',reason:null,opened:false};

function pendingStudioWindow(isAuthorized:()=>boolean):StudioPendingWindow|null{
 const popup=window.open('about:blank',`ryan-studio-${crypto.randomUUID()}`);
 if(!popup)return null;
 try{popup.opener=null;popup.document.title='Launching Proposal Studio';popup.document.body.textContent='Launching Proposal Studio… This tab opens Studio only after Ryan HQ verifies it is ready.';}catch{try{popup.close();}catch{}return null;}
 const ownsBlank=()=>{try{return !popup.closed&&popup.location.href==='about:blank';}catch{return false;}};
 return {
  navigate(url){if(url!==STUDIO_URL||!isAuthorized()||!ownsBlank())return false;try{popup.location.replace(STUDIO_URL);return true;}catch{return false;}},
  close(){if(ownsBlank())try{popup.close();}catch{}},
 };
}

export default function StudioLaunchControl({request,disabled=false,compact=false,isAuthorized=()=>true}:Props){
 const [state,setState]=useState<StudioLaunchState>(initial),[macHint,setMacHint]=useState<boolean|null>(null);
 const controller=useRef<StudioLaunchController|null>(null),allowed=useRef(isAuthorized),disabledRef=useRef(disabled);
 allowed.current=isAuthorized;disabledRef.current=disabled;
 useEffect(()=>{setMacHint(isMacDeviceHint({platform:navigator.platform,userAgent:navigator.userAgent,maxTouchPoints:navigator.maxTouchPoints}));},[]);
 useEffect(()=>{
  const current=createStudioLaunchController({request,onChange:setState,openWindow:()=>pendingStudioWindow(()=>!disabledRef.current&&allowed.current())});
  controller.current=current;setState(initial);
  return()=>{controller.current=null;current.dispose();};
 },[request]);
 useEffect(()=>{if(disabled)controller.current?.cancel();},[disabled]);
 const busy=['checking','launching','verifying'].includes(state.phase),ready=state.phase==='ready';
 const phaseLabel=state.phase==='checking'?'Checking this device…':state.phase==='launching'?'Launching Studio…':state.phase==='verifying'?'Verifying Studio…':ready?'Verified ready on this Mac':state.phase==='unavailable'?'Launch unavailable':disabled?'Launch unavailable in Demo':macHint===false?'Use the office Mac':'Local Mac app';
 function launch(){if(disabled||macHint===null||!allowed.current())return;void controller.current?.start({isMac:macHint});}
 const message=state.reason?STUDIO_LAUNCH_MESSAGES[state.reason]:null;
 return <div className={`${styles.control} ${compact?styles.compact:styles.full} ${state.phase!=='idle'?styles.active:''}`}>
  <div className={styles.main}>
   <IntegrationLogo name="studio" size={compact?20:25} decorative/>
   <div className={styles.title}><strong>Proposal Studio</strong><span role="status">{phaseLabel}</span></div>
   <button type="button" className={styles.launch} disabled={disabled||macHint===null||busy} onClick={launch} aria-label={macHint===false?'How to open Proposal Studio on the Mac':ready?'Check, launch and open Proposal Studio':'Launch and open Proposal Studio'}>{busy?<LoaderCircle size={15} className={styles.spin}/>:macHint===false?<ArrowUpRight size={15}/>:<span>{ready?'Open':state.phase==='unavailable'?'Retry':'Launch'}</span>}</button>
  </div>
  {message&&<p className={styles.message} role="status">{message}</p>}
  {ready&&<div className={styles.readyActions}><span>{state.opened?'Opened in a new tab.':'A new tab was not available.'}</span>{!state.opened&&<a href={STUDIO_URL} target="_blank" rel="noopener noreferrer">Open local Studio<ArrowUpRight size={12}/></a>}</div>}
  {busy&&<p className={styles.busyNote}>Allow local network access if your browser asks. <button type="button" onClick={()=>controller.current?.cancel()}>Stop waiting</button></p>}
  <details className={styles.fallback}><summary>Open manually<ChevronDown size={11} aria-hidden="true"/></summary><div><a href={STUDIO_URL} target="_blank" rel="noopener noreferrer">Open local Studio<ArrowUpRight size={12}/></a><p>On the office Mac, open <strong>Start Proposal Editor.command</strong> in Finder. The local link opens Studio on the device you are using.</p><code>{PROPOSAL_STUDIO_LAUNCHER}</code></div></details>
 </div>;
}
