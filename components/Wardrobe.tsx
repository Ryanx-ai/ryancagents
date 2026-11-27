'use client';
import {useEffect,useId,useRef,useState,type CSSProperties,type MouseEvent} from 'react';
import {Check,RotateCcw,X} from 'lucide-react';
import {agents} from '../lib/model';
import {CLOTHING_PARTS,COLOR_PRESETS,defaultPalette,palettesEqual,wardrobeOutfit,type ClothingPart,type Palette} from '../lib/wardrobe.mjs';
import {Ryan} from './Office';
import {useWardrobe,useWardrobeActions} from './WardrobeProvider';
import styles from './Wardrobe.module.css';

const partLabels:Record<ClothingPart,string>={jacket:'Jacket',shirt:'Shirt',pants:'Trousers'};
const outfitLabels={standard:'Classic Ryan',manager:'Tailored suit',designer:'Studio overshirt'};
const previewPoses=[{id:'idle',label:'Idle'},{id:'walk-right',label:'Walk'},{id:'working',label:'Work'},{id:'celebrate',label:'Yay'}];
function checkColor(hex:string){const values=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16));return values[0]*.299+values[1]*.587+values[2]*.114>155?'#26313a':'#fff8e8';}

type ColorsProps={value:Palette;original:Palette;onChange:(palette:Palette)=>void;disabled?:boolean};
export function ClothingColors({value,original,onChange,disabled=false}:ColorsProps){
 const id=useId();
 return <div className={styles.colors}>{CLOTHING_PARTS.map(part=>{
  const options=[{name:'Original',color:original[part]},...COLOR_PRESETS[part].filter(preset=>preset.color!==original[part])];
  return <fieldset key={part} disabled={disabled} className={styles.colorField}>
   <legend>{partLabels[part]}</legend>
   <div className={styles.colorTools}>
    <div className={styles.swatches}>{options.map(preset=><label key={preset.name} className={styles.swatch} title={`${preset.name} ${preset.color}`} style={{'--swatch':preset.color,'--check':checkColor(preset.color)} as CSSProperties}>
     <input type="radio" name={`${id}-${part}`} value={preset.color} checked={value[part]===preset.color} aria-label={`${partLabels[part]}: ${preset.name}`} onChange={()=>onChange({...value,[part]:preset.color})}/>
     <span aria-hidden="true">{value[part]===preset.color&&<Check size={14} strokeWidth={3}/>}</span>
    </label>)}</div>
    <label className={styles.customColor}><input type="color" value={value[part]} aria-label={`Custom ${partLabels[part].toLowerCase()} color`} onChange={event=>onChange({...value,[part]:event.target.value})}/><span>Custom</span></label>
   </div>
   <span className={styles.hexValue}>{value[part]}</span>
  </fieldset>;
 })}</div>;
}

type Props={agent:typeof agents[number];onClose:()=>void};
export default function Wardrobe({agent,onClose}:Props){
 const saved=useWardrobe(agent.id),actions=useWardrobeActions();
 const outfit=wardrobeOutfit(agent.id),original=defaultPalette(outfit);
 const [palette,setPalette]=useState<Palette|null>(()=>saved||null),[dirty,setDirty]=useState(false),[notice,setNotice]=useState('');
 const [pose,setPose]=useState('idle');
 const dialogRef=useRef<HTMLDialogElement>(null),closeRef=useRef<HTMLButtonElement>(null),dismissed=useRef(false),backdropPress=useRef(false);
 const id=useId();
 useEffect(()=>{
  const dialog=dialogRef.current;if(!dialog)return;
  const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
  dismissed.current=false;dialog.showModal();closeRef.current?.focus({preventScroll:true});
  return()=>{if(dialog.open)dialog.close();if(trigger?.isConnected)trigger.focus({preventScroll:true});};
 },[]);
 useEffect(()=>{if(!dirty)setPalette(saved||null);},[saved,dirty]);
 function close(){if(dismissed.current)return;dismissed.current=true;dialogRef.current?.close();onClose();}
 function change(next:Palette){setPalette(next);setDirty(true);setNotice('');}
 function reset(){setPalette(null);setDirty(true);setNotice('Original colors previewed. Apply to save.');}
 function apply(){const success=palette&&!palettesEqual(palette,original)?actions.setPalette(agent.id,palette):actions.resetPalette(agent.id);if(success){setDirty(false);close();}}
 function outside(event:{clientX:number;clientY:number}){const box=dialogRef.current?.getBoundingClientRect();return !!box&&(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom);}
 function backdropClick(event:MouseEvent<HTMLDialogElement>){if(backdropPress.current&&event.target===event.currentTarget&&outside(event))close();backdropPress.current=false;}
 return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={`${id}-title`} onCancel={event=>{event.preventDefault();event.stopPropagation();close();}} onClose={()=>{if(!dialogRef.current?.open)close();}} onKeyDownCapture={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}}} onPointerDown={event=>{backdropPress.current=event.target===event.currentTarget&&outside(event);}} onPointerCancel={()=>{backdropPress.current=false;}} onClick={backdropClick}>
  <div className={styles.shell}>
   <header className={styles.header}><div><span>Wardrobe</span><h2 id={`${id}-title`}>{agent.name}</h2></div><button ref={closeRef} type="button" className={styles.close} aria-label="Close wardrobe" onClick={close}><X size={20}/></button></header>
   {actions.error&&<div role="alert" className={styles.error}>{actions.error}</div>}
   {notice&&<div role="status" className={styles.notice}><Check size={14}/>{notice}</div>}
   <div className={styles.body}>
    <div className={styles.portrait}><div className={styles.mirror}><span className={styles.shadow}/><Ryan agentId={agent.id} palette={palette} pose={pose} size={218}/></div><span className={styles.outfitName}>{outfitLabels[outfit]}</span><div className={styles.poseControls} role="group" aria-label="Preview animation">{previewPoses.map(item=><button key={item.id} type="button" aria-pressed={pose===item.id} onClick={()=>setPose(item.id)}>{item.label}</button>)}</div></div>
    <div className={styles.controls}><ClothingColors value={palette||original} original={original} onChange={change} disabled={!actions.ready}/><button type="button" className={styles.reset} disabled={!actions.ready||(!saved&&!dirty)} onClick={reset}><RotateCcw size={14}/>Reset original</button></div>
   </div>
   <footer className={styles.footer}><span>Colors stay in this browser.</span><div><button type="button" className={styles.cancel} onClick={close}>Cancel</button><button type="button" className={styles.apply} disabled={!actions.ready||!dirty} onClick={apply}><Check size={15}/>Apply colors</button></div></footer>
  </div>
 </dialog>;
}
