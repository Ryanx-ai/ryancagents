'use client';
import {useEffect,useRef,useState} from 'react';
import {Clock3,Moon,Sun} from 'lucide-react';
import styles from './OfficeLighting.module.css';
export type LightingMode='auto'|'day'|'night';
const options=[{id:'auto' as const,label:'Auto',Icon:Clock3},{id:'day' as const,label:'Day',Icon:Sun},{id:'night' as const,label:'Night',Icon:Moon}];
export function LightingOptions({mode,onChange}:{mode:LightingMode;onChange:(mode:LightingMode)=>void}){
 return <div className={styles.options} role="group" aria-label="Office lighting">{options.map(({id,label,Icon})=><button type="button" key={id} aria-pressed={mode===id} onClick={()=>onChange(id)}><Icon size={15} aria-hidden="true"/><span>{label}</span></button>)}</div>;
}
export default function OfficeLighting({mode,night,onChange}:{mode:LightingMode;night:boolean;onChange:(mode:LightingMode)=>void}){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false);};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);trigger.current?.focus();}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);};
 },[open]);
 const label=mode==='auto'?`Automatic (${night?'night':'day'})`:`${night?'Night':'Day'} preview`;
 return <div className={styles.root} ref={root}>
  <button ref={trigger} type="button" className={styles.trigger} title={`Lighting: ${label}`} aria-label={`Lighting: ${label}`} aria-expanded={open} aria-haspopup="dialog" onClick={()=>setOpen(v=>!v)}>{night?<Moon size={18}/>:<Sun size={18}/>}<span className={styles.mode}>{mode==='auto'?'A':'P'}</span></button>
  {open&&<div className={styles.popover} role="dialog" aria-label="Office lighting"><strong>Lighting</strong><LightingOptions mode={mode} onChange={next=>{onChange(next);setOpen(false);trigger.current?.focus();}}/><small>Auto follows Singapore time.</small></div>}
 </div>;
}
