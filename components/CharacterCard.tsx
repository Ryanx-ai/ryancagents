'use client';

import {useEffect,useId,useRef,type CSSProperties,type MouseEvent} from 'react';
import {Shirt,X} from 'lucide-react';
import {type agents} from '../lib/model';
import {Ryan} from './Office';
import styles from './CharacterCard.module.css';

type Props={agent:typeof agents[number];onClose:()=>void;onWardrobe?:()=>void};

function Corner({className}:{className:string}) {
 return <svg className={className} viewBox="0 0 28 28" aria-hidden="true"><path d="M0 12V0H12V4H4V12ZM7 7H25V11H11V25H7Z" fill="currentColor"/><path d="M15 15H22V22H15Z" fill="var(--character-accent)"/></svg>;
}

export default function CharacterCard({agent,onClose,onWardrobe}:Props) {
 const dialogRef=useRef<HTMLDialogElement>(null);
 const dismissed=useRef(false);
 const backdropPress=useRef(false);
 const id=useId();

 useEffect(()=>{
  const dialog=dialogRef.current;
  if(!dialog)return;
  const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
  dismissed.current=false;
  dialog.showModal();
  return()=>{
   if(dialog.open)dialog.close();
   if(trigger?.isConnected)trigger.focus({preventScroll:true});
  };
 },[]);

 function dismiss() {
  if(dismissed.current)return;
  dismissed.current=true;
  dialogRef.current?.close();
  onClose();
 }
 function outside(event:{clientX:number;clientY:number}) {
  const bounds=dialogRef.current?.getBoundingClientRect();
  return !!bounds&&(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom);
 }
 function backdropClick(event:MouseEvent<HTMLDialogElement>) {
  if(backdropPress.current&&event.target===event.currentTarget&&outside(event))dismiss();
  backdropPress.current=false;
 }

 return <dialog
  ref={dialogRef}
  className={styles.dialog}
  aria-labelledby={`${id}-name`}
  aria-describedby={`${id}-role`}
  style={{'--character-accent':agent.color} as CSSProperties}
  onCancel={event=>{event.preventDefault();event.stopPropagation();dismiss();}}
  onClose={()=>{if(!dialogRef.current?.open)dismiss();}}
  onKeyDownCapture={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dismiss();}}}
  onPointerDown={event=>{backdropPress.current=event.target===event.currentTarget&&outside(event);}}
  onPointerCancel={()=>{backdropPress.current=false;}}
  onClick={backdropClick}
 >
  <div className={styles.frame}>
   <Corner className={`${styles.corner} ${styles.topLeft}`}/>
   <Corner className={`${styles.corner} ${styles.topRight}`}/>
   <Corner className={`${styles.corner} ${styles.bottomRight}`}/>
   <Corner className={`${styles.corner} ${styles.bottomLeft}`}/>
   <span className={styles.crest} aria-hidden="true"/>
   <button type="button" className={styles.close} onClick={dismiss} aria-label={`Close ${agent.name} card`} autoFocus><X size={18} strokeWidth={1.75}/></button>
   <div className={styles.interior}>
    <div className={styles.portrait} aria-hidden="true">
     <svg className={styles.room} viewBox="0 0 292 270" preserveAspectRatio="none">
      <defs><pattern id={`${id}-brick`} width="64" height="56" patternUnits="userSpaceOnUse"><rect width="64" height="56" fill="#303638"/><path d="M0 0H64M0 28H64M32 0V28M0 28V56M64 28V56" fill="none" stroke="#242a2c" strokeWidth="2"/><path d="M2 2H62M2 30H62" stroke="#3a4041" strokeOpacity=".55"/></pattern></defs>
      <rect width="292" height="270" fill={`url(#${id}-brick)`}/>
      <rect y="196" width="292" height="74" fill="#343732"/>
      <path d="M0 197H292" stroke="#666451" strokeWidth="3"/><path d="M0 213H292M0 237H292M0 268H292M54 196L12 270M115 196L103 270M177 196L189 270M238 196L280 270" stroke="#222926" strokeWidth="2"/>
      <path d="M0 215H292M0 239H292" stroke="#525448" strokeOpacity=".4"/>
      <ellipse cx="146" cy="247" rx="49" ry="8" fill="#141b1b" opacity=".6"/>
     </svg>
     <div className={styles.sprite}><Ryan agentId={agent.id} size={224} still/></div>
    </div>
    <div className={styles.copy}>
     <h2 id={`${id}-name`}>{agent.name}</h2>
     <div className={styles.divider} aria-hidden="true"><span/></div>
     <p id={`${id}-role`}>{agent.profileDescription}</p>
     {onWardrobe&&<button type="button" className={styles.wardrobe} aria-haspopup="dialog" onClick={()=>{dismiss();onWardrobe();}}><Shirt size={16} aria-hidden="true"/>Wardrobe</button>}
    </div>
   </div>
  </div>
 </dialog>;
}
